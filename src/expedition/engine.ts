/**
 * The crew ledger: players, answers, votes, points and ranks. It runs inside the relay's room
 * (production: one place sees every phone, the streamer's browser only gets summaries) or
 * inside the cockpit itself (development and the demo crew without a relay).
 * No DOM, no network: the caller feeds events in and ships the outputs.
 */
import { gateOutcome, pointsFor, quorumFor, type GateScore } from './protocol';

export interface CrewRecord {
  nick: string; points: number; answered: number; correct: number; firstSeen: number; lastSeen: number;
  /** `${nodeId}:${gate bitmask}`: gates of the current destination already scored (once per gate, across retries) */
  award?: string;
}

/**
 * Players by source: phones have a relay-minted hex id; `bot-…` are demo crew, `tw:…` / `kk:…` /
 * `yt:…` Twitch / Kick / YouTube chatters. Only the cockpit may speak for those.
 */
export const isTrustedPid = (pid: string): boolean => /^(bot-|tw:|kk:|yt:)/.test(pid);
const isChatPid = (pid: string): boolean => /^(tw:|kk:|yt:)/.test(pid);

/** What reaches the ledger from phones (via the relay) or the cockpit (bots, chat). */
export type CrewEvent =
  | { t: 'hello'; pid: string; nick: string }
  | { t: 'bye'; pid: string }
  | { t: 'vote'; pid: string; voteId: string; nodeId: string }
  /** `age`: ms the answer already waited in the relay since it arrived (timing fairness) */
  | { t: 'answer'; pid: string; attemptId: string; choiceId: string; age?: number }
  /** chat: an answer by letter, the ledger maps it to the open question */
  | { t: 'pick'; pid: string; nick: string; slot: number };

/** Cockpit → ledger. The correct answer only travels at the reveal. */
export type LedgerCmd =
  | { t: 'session' }
  | { t: 'gate'; attemptId: string; nodeId: string; gateIndex: number; choices: string[]; windowMs: number; practice: boolean; mult?: number; need?: number }
  | { t: 'pause' } | { t: 'resume' }
  | { t: 'extend'; ms: number }
  | { t: 'lock' }
  | { t: 'reveal'; attemptId: string; correctId: string }
  | { t: 'vote'; voteId: string; options: string[] }
  | { t: 'voteClose' }
  | { t: 'clear' }
  | { t: 'dropBots' };

export interface Tally {
  crew: number;
  known: number;
  gate?: { attemptId: string; eligible: number; quorum: number; answers: number; distribution?: number[] };
  vote?: { voteId: string; counts: number[] };
  leaders: Array<{ nick: string; points: number }>;
  /** nicks that joined / locked in since the last tally (capped), with the full count */
  joined: string[]; joinedN: number;
  answered: string[];
}

export interface BoardRow { pid: string; nick: string; points: number; gain: number; rank: number; move: number }

export interface GateResult {
  attemptId: string;
  correct: number; answers: number; eligible: number; quorum: number;
  distribution: number[];
  passed: boolean; failReason?: 'quorum' | 'accuracy';
  fastest?: { nick: string; ms: number };
  rows: BoardRow[];
  practice: boolean;
}

/** Per-player screen state, sent to that phone only. */
export interface MeMsg {
  pid: string; points: number; sessionPoints: number;
  answered?: { attemptId: string; choiceId: string }; votedFor?: string; rejected?: string; last?: GateScore;
}

const PHONE_GRACE = 20_000;
const HEARTBEAT_MS = 90_000;
const CHAT_MS = 5 * 60_000;
/** answers already on their way when the clock ran out still count */
const LATE_MS = 1500;
const BOARD_ROWS = 5;

interface Gate {
  attemptId: string; nodeId: string; gateIndex: number; choices: string[]; windowMs: number; practice: boolean;
  mult: number; need: number;
  openedAt: number; pausedAt: number | null; pausedTotal: number; locked: boolean; revealed: boolean;
  eligible: Set<string>; quorum: number;
  answers: Map<string, string>; ms: Map<string, number>;
  scores: Map<string, GateScore>;
}

export class Ledger {
  /** until when each player counts as online (Infinity: a relay socket is open) */
  private seen = new Map<string, number>();
  private session = new Map<string, number>();
  private gate: Gate | null = null;
  private vote: { voteId: string; options: string[]; votes: Map<string, string>; closed: boolean } | null = null;
  private joined: string[] = [];
  private joinedN = 0;
  private answeredFeed: string[] = [];
  private leadersCache: Tally['leaders'] | null = null;
  dirty = true;

  /**
   * @param records persistent players (mutated in place)
   * @param relay   true: presence comes from relay sockets (hello/bye), false: heartbeats
   * @param send    per-player message out
   * @param changed records that need saving
   */
  constructor(
    readonly records: Record<string, CrewRecord>,
    private relay: boolean,
    private send: (m: MeMsg) => void,
    private changed: (pid: string) => void,
    private now: () => number = Date.now,
  ) {}

  /* ---------------- input ---------------- */

  event(e: CrewEvent): void {
    const now = this.now();
    if (e.t === 'hello' || e.t === 'pick') {
      if (!this.hello(e.pid, e.nick, now)) return;
      if (e.t === 'pick') {
        const g = this.gate;
        const id = g && !g.locked ? g.choices[e.slot] : undefined;
        if (g && id) this.answer(e.pid, g.attemptId, id, 0, now);
        else if (this.vote && !this.vote.closed && this.vote.options[e.slot]) this.castVote(e.pid, this.vote.options[e.slot]);
      }
      return;
    }
    if (!this.records[e.pid]) return;   // must say hello first
    if (e.t === 'bye') { if (this.relay && !isTrustedPid(e.pid)) this.seen.set(e.pid, now + PHONE_GRACE); this.dirty = true; return; }
    this.touch(e.pid, now);
    if (e.t === 'vote') {
      const v = this.vote;
      if (v && !v.closed && e.voteId === v.voteId && v.options.includes(e.nodeId)) this.castVote(e.pid, e.nodeId);
      return;
    }
    if (e.t === 'answer') this.answer(e.pid, e.attemptId, e.choiceId, Math.max(0, Math.min(5000, Number(e.age) || 0)), now);
  }

  cmd(c: LedgerCmd): GateResult | null {
    const now = this.now();
    this.dirty = true;
    switch (c.t) {
      case 'session': this.session.clear(); break;
      case 'gate': {
        const eligible = new Set(this.online(now));
        this.gate = {
          attemptId: c.attemptId, nodeId: c.nodeId, gateIndex: c.gateIndex, choices: c.choices, windowMs: c.windowMs, practice: c.practice,
          mult: Math.min(4, Math.max(1, Number(c.mult) || 1)), need: Math.min(0.9, Math.max(0.5, Number(c.need) || 0.5)),
          openedAt: now, pausedAt: null, pausedTotal: 0, locked: false, revealed: false,
          eligible, quorum: c.practice ? 1 : quorumFor(eligible.size),
          answers: new Map(), ms: new Map(), scores: new Map(),
        };
        this.answeredFeed = [];
        break;
      }
      case 'pause': if (this.gate && this.gate.pausedAt === null) this.gate.pausedAt = now; break;
      case 'resume': if (this.gate?.pausedAt != null) { this.gate.pausedTotal += now - this.gate.pausedAt; this.gate.pausedAt = null; } break;
      case 'extend': if (this.gate) this.gate.windowMs += c.ms; break;
      case 'lock': if (this.gate) this.gate.locked = true; break;
      case 'reveal': return this.reveal(c.attemptId, c.correctId);
      case 'vote': this.vote = { voteId: c.voteId, options: c.options, votes: new Map(), closed: false }; break;
      case 'voteClose': if (this.vote) this.vote.closed = true; break;
      case 'clear': this.gate = null; this.vote = null; break;
      case 'dropBots':
        for (const pid of Object.keys(this.records)) if (pid.startsWith('bot-')) { delete this.records[pid]; this.seen.delete(pid); this.changed(pid); }
        this.leadersCache = null;
        break;
    }
    return null;
  }

  /* ---------------- output ---------------- */

  tally(): Tally {
    const now = this.now();
    const g = this.gate;
    const v = this.vote;
    const t: Tally = {
      crew: this.online(now).length,
      known: Object.keys(this.records).length,
      leaders: this.leaders(),
      joined: this.joined.splice(0), joinedN: this.joinedN,
      answered: this.answeredFeed.splice(0),
    };
    this.joinedN = 0;
    if (g) t.gate = { attemptId: g.attemptId, eligible: g.eligible.size, quorum: g.quorum, answers: g.answers.size, distribution: g.locked ? this.distribution(g) : undefined };
    if (v) {
      const counts = v.options.map(() => 0);
      for (const id of v.votes.values()) counts[v.options.indexOf(id)]++;
      t.vote = { voteId: v.voteId, counts };
    }
    this.dirty = false;
    return t;
  }

  /** Everyone online gets their screen state again (a reconnecting cockpit or relay restart). */
  resendAll(): void {
    for (const pid of this.online(this.now())) if (!isTrustedPid(pid)) this.sendMe(pid);
  }

  /* ---------------- internals ---------------- */

  private hello(pid: string, nickIn: string, now: number): boolean {
    const nick = String(nickIn ?? '').normalize('NFKC').replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2066-\u2069]/g, '').trim().slice(0, 20) || 'Crew member';
    let rec = this.records[pid];
    const wasOnline = (this.seen.get(pid) ?? 0) > now;
    if (!rec) {
      rec = this.records[pid] = { nick, points: 0, answered: 0, correct: 0, firstSeen: now, lastSeen: now };
      this.changed(pid);
    } else if (rec.nick !== nick || now - rec.lastSeen > 3600_000) {
      if (rec.nick !== nick) this.leadersCache = null;
      rec.nick = nick;
      rec.lastSeen = now;
      this.changed(pid);
    }
    this.touch(pid, now, true);
    if (!wasOnline) {
      this.joinedN++;
      if (this.joined.length < 20) this.joined.push(nick);
      this.dirty = true;
    }
    if (!isTrustedPid(pid)) this.sendMe(pid);
    return true;
  }

  private touch(pid: string, now: number, hello = false): void {
    if (isChatPid(pid)) this.seen.set(pid, now + CHAT_MS);
    else if (pid.startsWith('bot-') || !this.relay) this.seen.set(pid, now + HEARTBEAT_MS);
    else if (hello) this.seen.set(pid, Infinity);
  }

  private online(now: number): string[] {
    const out: string[] = [];
    for (const [pid, until] of this.seen) {
      if (until > now) out.push(pid);
      else if (now - until > 3600_000) this.seen.delete(pid);
    }
    return out;
  }

  private castVote(pid: string, nodeId: string): void {
    this.vote!.votes.set(pid, nodeId);
    this.dirty = true;
    if (!isTrustedPid(pid)) this.sendMe(pid);
  }

  private answer(pid: string, attemptId: string, choiceId: string, age: number, now: number): void {
    const g = this.gate;
    const reject = (why: string): void => { if (!isTrustedPid(pid)) this.sendMe(pid, why); };
    const at = now - age;
    if (!g || g.revealed || attemptId !== g.attemptId) return reject('This question is closed.');
    if (g.pausedAt !== null) return reject('The expedition is paused.');
    const elapsed = at - g.openedAt - g.pausedTotal;
    if (g.locked || elapsed > g.windowMs + LATE_MS) return reject('Too late: answers are locked.');
    // phones must be in the room when the question opens; chatters can't be counted ahead
    if (!g.eligible.has(pid) && !isTrustedPid(pid)) return reject('You joined after this question opened. You can answer the next one.');
    if (!g.choices.includes(choiceId)) return reject('Unknown choice.');
    if (!g.answers.has(pid)) {   // first answer is final
      g.answers.set(pid, choiceId);
      g.ms.set(pid, Math.max(0, Math.min(g.windowMs, elapsed)));
      if (this.answeredFeed.length < 3) this.answeredFeed.push(this.records[pid]?.nick ?? 'Crew member');
      this.dirty = true;
    }
    if (!isTrustedPid(pid)) this.sendMe(pid);
  }

  private distribution(g: Gate): number[] {
    const d = g.choices.map(() => 0);
    for (const id of g.answers.values()) d[g.choices.indexOf(id)]++;
    return d;
  }

  private reveal(attemptId: string, correctId: string): GateResult | null {
    const g = this.gate;
    if (!g || g.attemptId !== attemptId || g.revealed) return null;
    g.locked = true;
    g.revealed = true;
    const distribution = this.distribution(g);
    const correct = distribution[g.choices.indexOf(correctId)] ?? 0;
    const out = gateOutcome(g.eligible.size, g.answers.size, correct, g.practice, g.need);
    const nickOf = (pid: string): string => this.records[pid]?.nick ?? 'Crew member';

    // totals before the gate, sorted high to low: ranks are "1 + how many have more"
    const gains = new Map<string, number>();
    const total = (pid: string): number => g.practice ? gains.get(pid) ?? 0 : this.records[pid]?.points ?? 0;
    const pool = (): string[] => g.practice ? [...g.answers.keys()] : Object.keys(this.records).filter((id) => this.records[id].points > 0 || g.answers.has(id));
    const sortedTotals = (ids: string[]): Float64Array => Float64Array.from(ids, total).sort().reverse();
    const above = (arr: Float64Array, v: number): number => {   // count of values > v in a descending array
      let lo = 0, hi = arr.length;
      while (lo < hi) { const mid = (lo + hi) >> 1; if (arr[mid] > v) lo = mid + 1; else hi = mid; }
      return lo;
    };
    const before = g.practice ? new Float64Array(0) : sortedTotals(pool().filter((id) => total(id) > 0));

    let fastest: GateResult['fastest'];
    for (const [pid, choice] of g.answers) {
      const rec = g.practice ? undefined : this.records[pid];
      if (rec) { rec.answered++; this.changed(pid); }
      if (choice !== correctId) continue;
      const ms = g.ms.get(pid) ?? g.windowMs;
      if (!fastest || ms < fastest.ms) fastest = { nick: nickOf(pid), ms };
      const pts = Math.round(pointsFor(ms, g.windowMs) * g.mult);
      if (g.practice) { gains.set(pid, pts); continue; }
      if (!rec) continue;
      rec.correct++;
      const mask = rec.award?.startsWith(`${g.nodeId}:`) ? Number(rec.award.slice(g.nodeId.length + 1)) || 0 : 0;
      if (mask & (1 << g.gateIndex)) continue;
      rec.award = `${g.nodeId}:${mask | (1 << g.gateIndex)}`;
      rec.points += pts;
      gains.set(pid, pts);
      this.session.set(pid, (this.session.get(pid) ?? 0) + pts);
    }
    this.leadersCache = null;

    const ids = pool();
    const after = sortedTotals(ids);
    const rankOf = (pid: string): number => 1 + above(after, total(pid));
    // top rows: a partial selection, not a full sort of every player
    const better = (a: string, b: string): boolean => total(a) > total(b) || (total(a) === total(b) && (g.ms.get(a) ?? Infinity) < (g.ms.get(b) ?? Infinity));
    const top: string[] = [];
    for (const id of ids) {
      if (top.length === BOARD_ROWS && !better(id, top[BOARD_ROWS - 1])) continue;
      let i = Math.min(top.length, BOARD_ROWS - 1);
      top[i] = id;
      while (i > 0 && better(top[i], top[i - 1])) { [top[i], top[i - 1]] = [top[i - 1], top[i]]; i--; }
    }
    const rows: BoardRow[] = top.map((pid) => {
      const gain = gains.get(pid) ?? 0;
      const prev = total(pid) - (g.practice ? total(pid) : gain);
      const was = !g.practice && prev > 0 ? 1 + above(before, prev) : 0;
      const rank = rankOf(pid);
      return { pid, nick: nickOf(pid), points: total(pid), gain, rank, move: was ? was - rank : 0 };
    });

    for (const pid of g.answers.keys()) {
      g.scores.set(pid, { attemptId: g.attemptId, gain: gains.get(pid) ?? 0, ms: g.ms.get(pid) ?? 0, rank: rankOf(pid) });
      if (!isTrustedPid(pid)) this.sendMe(pid);
    }
    this.dirty = true;
    return {
      attemptId: g.attemptId, correct, answers: g.answers.size, eligible: g.eligible.size, quorum: g.quorum, distribution,
      passed: out.passed, failReason: out.failReason, fastest, rows, practice: g.practice,
    };
  }

  private leaders(): Tally['leaders'] {
    if (this.leadersCache) return this.leadersCache;
    const top: CrewRecord[] = [];
    for (const r of Object.values(this.records)) {
      if (r.points <= 0 || (top.length === BOARD_ROWS && r.points <= top[BOARD_ROWS - 1].points)) continue;
      let i = Math.min(top.length, BOARD_ROWS - 1);
      top[i] = r;
      while (i > 0 && top[i].points > top[i - 1].points) { [top[i], top[i - 1]] = [top[i - 1], top[i]]; i--; }
    }
    return (this.leadersCache = top.map((r) => ({ nick: r.nick, points: r.points })));
  }

  private sendMe(pid: string, rejected?: string): void {
    const rec = this.records[pid];
    const g = this.gate;
    const a = g?.answers.get(pid);
    this.send({
      pid, points: rec?.points ?? 0, sessionPoints: this.session.get(pid) ?? 0,
      answered: g && a ? { attemptId: g.attemptId, choiceId: a } : undefined,
      votedFor: this.vote?.votes.get(pid), rejected, last: g?.scores.get(pid),
    });
  }
}
