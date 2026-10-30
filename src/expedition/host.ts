import qrcode from 'qrcode-generator';
import './expedition.css';
import { CHAPTERS, NODES, NODE, ROOT, chapterOpen, nodeState, unlockHint, type ExpeditionNode } from './manifest';
import { GATE_NAMES, POINTS_MAX, randomCode, randomId, type CrewToHost, type PublicSnapshot, type Stage, type Wire } from './protocol';
import { variantsFor, type Variant } from './questions';
import { createCampaign, exportCampaign, importCampaign, lastCampaign, listCampaigns, saveCampaign, type Campaign, type CrewRecord } from './store';
import { openLink, type Link, type LinkStatus } from './link';
import { openHub, type CrewHub } from './crewhub';
import { chatSlot, kickChat, twitchChat, type ChatFeed, type ChatLine } from './chat';
import { EVENTS, effectLabel, eventText, rollResult, type EventResult, type SpaceEvent } from './events';
import type { BoardRow, GateResult, Tally } from './engine';
import { CampaignMap } from './map';
import { sfx } from './sfx';
import { narrator } from './narrator';
import { CALL, destinationLine, discoveredLine, gateLine } from './voicelines';

/** The parts of the 3D app the cockpit drives (see App in main.ts). */
export interface Universe3D {
  goToVantageOf(bodyId: string, elev: number, az: number, dist: number, seconds?: number): void;
  goToTourBody(id: string): void;
  goToOverview(bodyId: string, seconds?: number): void;
  hasBody(id: string): boolean;
  hasStar(name: string): boolean;
  hasLandmark(id: string): boolean;
  flyToStarNamed(name: string): string | null;
  starBodyIn(name: string): string | null;
  goHome(): void;
  goToLandmarkAt(id: string, radii: number, swing: number): boolean;
  /** only these bodies (and their family) keep labels; null = all */
  setTourScope(ids: string[] | null): void;
  camera: { autopilot: unknown };
}

/* ---------------- camera adapter ---------------- */

/**
 * Waypoints before gates 1–3 and the arrival shot: elevation°, azimuth° from the noon meridian
 * (small = the camera sits on the sunlit side), distance in body radii. The tour's backlit
 * arrival is a crescent, too dark for a stream, so every shot here faces the day side.
 */
const LEGS: Array<[number, number, number]> = [[20, 42, 14], [12, 26, 7], [8, 12, 4], [10, 18, 2.8]];
/** small spacecraft: stand farther off so the model reads */
const LEG_SCALE: Record<string, number> = { voyager1: 5 };

/** Stars: closer and around the star each waypoint (radii); leg 0 is the interstellar flight itself. */
const STAR_LEGS: Array<[number, number, number]> = [[0, 0, 0], [18, 40, 16], [6, 95, 9], [24, 150, 5]];
/** Nebulae and clusters: [distance in landmark radii, swing° around it] */
const LANDMARK_LEGS: Array<[number, number]> = [[3.2, 0], [2.8, 30], [2.3, 60], [1.9, 95]];

/** Where the camera is aimed for a node: its body, star or landmark (for label scoping). */
function scopeOf(app: Universe3D, n: ExpeditionNode): string | null {
  return n.body ?? (n.star ? app.starBodyIn(n.star) : n.landmark) ?? null;
}

function flyLeg(app: Universe3D, n: ExpeditionNode, leg: number): Promise<void> {
  const k = Math.min(leg, 3);
  if (n.landmark) {
    app.goToLandmarkAt(n.landmark, ...LANDMARK_LEGS[k]);
  } else if (n.star) {
    const here = app.starBodyIn(n.star);
    if (leg === 0 || !here) app.flyToStarNamed(n.star);
    else app.goToVantageOf(here, STAR_LEGS[k][0], STAR_LEGS[k][1], STAR_LEGS[k][2], 4.5);
  } else {
    const id = n.body!;
    app.goHome();
    if (leg >= 3 && n.overview) app.goToOverview(n.overview, 7);
    else {
      const [e, a, d] = LEGS[k];
      app.goToVantageOf(id, e, a, d * (LEG_SCALE[id] ?? 1), leg === 0 ? 7 : 4.5);
    }
  }
  const scope = scopeOf(app, n);
  app.setTourScope(scope ? [scope] : null);
  return new Promise((resolve) => {
    const t0 = performance.now();
    const tick = (): void => {
      const dt = performance.now() - t0;
      if ((dt > 900 && !app.camera.autopilot) || dt > 25000) resolve();
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

/* ---------------- runtime state ---------------- */

interface GateRun {
  attemptId: string;
  nodeId: string;
  gateIndex: number;
  attempt: number;
  variant: Variant;
  recycled: boolean;
  choices: Array<{ id: string; label: string }>;
  correctId: string;
  opensAt: number;
  closesAt: number;
  pausedLeft: number | null;
  extended: boolean;
  practice: boolean;
  /** live counts from the crew ledger */
  eligible: number;
  quorum: number;
  answers: number;
  distribution?: number[];
  boss: boolean;
  need: number;
  mult: number;
  revealing?: boolean;
  revealed: boolean;
  passed?: boolean;
  failReason?: 'quorum' | 'accuracy';
}

interface Board { nodeTitle: string; gateIndex: number; rows: BoardRow[]; fastest?: { nick: string; ms: number }; correct: number; practice: boolean }

interface VoteRun { voteId: string; options: string[]; counts: number[]; closesAt: number; closing?: boolean; closed: boolean; winner?: string; tie?: string[] }

interface EventRun { def: SpaceEvent; voteId: string; counts: number[]; closesAt: number; closing?: boolean; closed: boolean; pick?: number; result?: EventResult }

/** chance of a space event at each of a destination's first two waypoints (at most one per visit) */
const EVENT_CHANCE = 0.4;
const EVENT_SECONDS = 20;
const BOSS_MULT = 2;
const BOSS_NEED = 0.6;
const BOSS_DAMAGE = 25;
const MIN_WINDOW_S = 20;

/** demo crew: re-announced so they stay online */
const BOT_HELLO_MS = 30_000;

const BOT_NAMES = ['NebulaNomad', 'Cosmo_Kat', 'PulsarPete', 'RedDwarfRita', 'LagrangeLu', 'QuasarQueen', 'OortCloudOli', 'Kepler452b', 'ApolloAyse', 'TitanTom', 'PlutoWasRobbed', 'HelioHana', 'Barycentric', 'DarkMatterDan'];

// Must run synchronously inside the click: execCommand needs the user gesture, and
// navigator.clipboard is missing on plain-http LAN origins.
async function copyText(text: string): Promise<boolean> {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
  document.body.appendChild(ta);
  ta.select();
  let ok = false;
  try { ok = document.execCommand('copy'); } catch { /* unsupported */ }
  ta.remove();
  if (ok) return true;
  try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
}

const esc = (s: string): string => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const shuffle = <T,>(a: T[]): T[] => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const LETTERS = ['A', 'B', 'C', 'D'];

/** Gates of `node` this player has already scored, as a bitmask. */
const awardMask = (rec: CrewRecord, node: string): number =>
  rec.award?.startsWith(`${node}:`) ? Number(rec.award.slice(node.length + 1)) || 0 : 0;

function boardList(b: Board): string {
  const move = (m: number): string => m > 0 ? `<span class="xp-move up">▲ ${m}</span>` : m < 0 ? `<span class="xp-move down">▼ ${-m}</span>` : '<span class="xp-move"></span>';
  return `<ol class="xp-board">${b.rows.map((r, i) => `
    <li class="${r.rank === 1 ? 'first' : ''}" style="--d:${i}">
      <span class="xp-rank">${r.rank}</span>
      <span class="xp-nick">${esc(r.nick)}</span>
      ${move(r.move)}
      <span class="xp-gain">${r.gain ? `+${r.gain}` : ''}</span>
      <span class="xp-pts">${r.points.toLocaleString('en-US')}</span>
    </li>`).join('')}</ol>`;
}

function qrSvg(text: string): string {
  const q = qrcode(0, 'M');
  q.addData(text);
  q.make();
  const n = q.getModuleCount();
  let d = '';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) d += `M${c},${r}h1v1h-1z`;
  return `<svg viewBox="-2 -2 ${n + 4} ${n + 4}" shape-rendering="crispEdges" aria-hidden="true"><rect x="-2" y="-2" width="${n + 4}" height="${n + 4}" fill="#f0f0eb"/><path d="${d}" fill="#090b0f"/></svg>`;
}

export function startCockpit(app: Universe3D): Cockpit {
  return new Cockpit(app);
}

class Cockpit {
  private c: Campaign | null = null;
  private link: Link;
  private stage: Stage = 'LOBBY';
  private paused = false;
  private target: ExpeditionNode | null = null;
  private gate: GateRun | null = null;
  private vote: VoteRun | null = null;
  private hub!: CrewHub;
  private tally: Tally | null = null;
  private bots = new Map<string, { nick: string; skill: number }>();
  private botHelloAt = 0;
  private chats: ChatFeed[] = [];
  private ev: EventRun | null = null;
  /** destination where this visit already had its space event */
  private eventAt: string | null = null;
  private lastEvent = '';
  /** hull hit zero: the next action is emergency repairs */
  private breach = false;
  private rev = 0;
  private selected: string | null = null;
  private lastDiscovered: PublicSnapshot['lastDiscovered'];
  private joinBase = '';
  private hideControls = false;
  private botTimers: number[] = [];
  private calledTen = false;
  /* crew-driven work is coalesced: thousands of phones must not redraw the cockpit thousands of times */
  private soonTimer = 0;
  private saveTimer = 0;
  private lastFeed = 0;
  private linkUp = false;
  /** leaderboard of the last revealed gate, shown while flying to the next waypoint */
  private board: Board | null = null;
  private lastTick = 0;

  private root!: HTMLDivElement;
  private map!: CampaignMap;
  private html = new WeakMap<Element, string>();
  private $ = <T extends HTMLElement = HTMLElement>(sel: string): T => this.root.querySelector(sel) as T;

  /** Rewrite only on change: replacing identical markup restarts entrance animations (visible flicker). */
  private set(el: HTMLElement, html: string): boolean {
    if (this.html.get(el) === html) return false;
    this.html.set(el, html);
    el.innerHTML = html;
    return true;
  }

  /** Live counters sit outside the cached markup; a change fades the new value in. */
  private bump(el: Element | null, value: string): void {
    if (!el || el.textContent === value) return;
    const first = el.textContent === '';
    el.textContent = value;
    if (first) return;
    el.classList.remove('xp-bump');
    void (el as HTMLElement).offsetWidth;
    el.classList.add('xp-bump');
  }

  constructor(private app: Universe3D) {
    document.body.classList.add('stream-mode');
    document.title = 'Streamer Mode · Your Eyes In Space';
    this.link = openLink('host');
    this.link.on((w) => this.onWire(w));
    this.link.onStatus((s) => this.onLinkStatus(s.kind));
    this.hub = openHub(this.link, () => this.saveSoon());
    this.hub.onTally((t) => this.onTally(t));
    this.hub.onResult((r, id) => this.onResult(r, id));
    this.build();
    void this.resolveJoinBase();
    const c = lastCampaign();
    if (c) this.useCampaign(c, true);
    else this.showEnroll();
    setInterval(() => this.tick(), 250);
    setInterval(() => this.broadcast(), 2000);
  }

  /* ================= campaign ================= */

  private get discovered(): Set<string> { return new Set(this.c?.discovered ?? [ROOT]); }
  private get assisted(): Set<string> { return new Set(this.c?.assisted ?? []); }

  private useCampaign(c: Campaign, welcome: boolean): void {
    this.c = c;
    c.hostKey ??= randomId(32);
    // prototype saves listed scored gates as `${node}:${gate}:${pid}`; keep those of the open destination
    for (const key of c.awarded ?? []) {
      const [node, gate, pid] = key.split(':');
      const rec = c.crew[pid];
      if (rec && node === c.progress?.nodeId) rec.award = `${node}:${awardMask(rec, node) | (1 << Number(gate))}`;
    }
    c.stats.sessions++;
    c.log.push({ t: Date.now(), text: 'Live session started' });
    saveCampaign(c);
    this.link.join(c.room, c.hostKey);
    this.hub.use(c.room, c.crew);
    this.tally = null;
    this.hub.cmd({ t: 'session' });
    this.hub.cmd({ t: 'clear' });
    this.bots.clear();
    if (c.settings.demoCrew) this.spawnBots();
    this.connectChats();
    this.stage = 'LOBBY';
    this.target = c.progress ? NODE.get(c.progress.nodeId) ?? null : null;
    this.selected = this.target?.id ?? this.firstReachable();
    this.$('#xp-enroll').hidden = true;
    this.render();
    this.map.focus(this.selected ?? ROOT, 0.9);
    if (welcome) this.toast(`Welcome back, ${c.host}. ${c.discovered.length} of ${NODES.length} destinations discovered.`);
  }

  private firstReachable(): string | null {
    return NODES.find((n) => nodeState(n, this.discovered, this.assisted) === 'reachable')?.id ?? null;
  }

  private reachable(): ExpeditionNode[] {
    return NODES.filter((n) => nodeState(n, this.discovered, this.assisted) === 'reachable');
  }

  private save(): void { if (this.c) saveCampaign(this.c); }

  private logLine(text: string): void { this.c?.log.push({ t: Date.now(), text }); }

  /* ================= crew link ================= */

  private async resolveJoinBase(): Promise<void> {
    const h = location.hostname;
    const local = import.meta.env.DEV && (h === 'localhost' || h === '127.0.0.1' || h.endsWith('.localhost'));
    if (h.startsWith('stream.') && !local) { this.joinBase = `${location.origin}/join/`; this.renderJoin(); return; }
    let origin = location.origin;
    if (local) {
      try {
        const r = await fetch('/__xp/lan');
        const j = (await r.json()) as { urls: string[] };
        if (j.urls[0]) origin = j.urls[0];
      } catch { /* not exposed on the network */ }
    }
    this.joinBase = `${origin}/crew.html?c=`;
    this.renderJoin();
  }

  private onWire(w: Wire): void {
    if (w.from !== 'crew' || !this.c) return;
    const m = w.msg as CrewToHost;
    if (typeof m.pid !== 'string' || m.pid.length > 64) return;
    this.hub.fromPhone(m);
  }

  private onLinkStatus(kind: LinkStatus['kind']): void {
    const c = this.c;
    if (kind === 'taken' && c) {
      // another cockpit owns this code (a copied backup, or a one-in-a-billion clash): move to a new room
      c.room = randomCode(6);
      c.hostKey = randomId(32);
      this.save();
      this.link.join(c.room, c.hostKey);
      this.toast(`Room code changed to ${c.room}. Share the new join link.`, 6000);
      this.render();
    } else if (kind === 'open') {
      if (this.linkUp === false && this.c) this.broadcast();
      this.linkUp = true;
    } else if (kind === 'closed' && this.linkUp) {
      this.linkUp = false;
      this.toast('Connection to the crew relay lost. Reconnecting…', 3000);
    }
  }

  private soon(): void {
    if (this.soonTimer) return;
    this.soonTimer = window.setTimeout(() => { this.soonTimer = 0; this.render(); this.broadcast(); }, 300);
  }

  private saveSoon(): void {
    if (!this.saveTimer) this.saveTimer = window.setTimeout(() => { this.saveTimer = 0; this.save(); }, 5000);
  }

  /* ================= stream chat ================= */

  private connectChats(): void {
    for (const f of this.chats) f.close();
    this.chats = [];
    const s = this.c?.settings;
    if (s?.twitch) this.chats.push(twitchChat(s.twitch, (l) => this.onChat(l), () => this.renderChat()));
    if (s?.kick) this.chats.push(kickChat(s.kick, (l) => this.onChat(l), () => this.renderChat()));
    this.renderChat();
  }

  /** A, B, C or D in chat answers the open question, or votes while a route vote runs. */
  private onChat(l: ChatLine): void {
    const slot = chatSlot(l.text);
    if (slot < 0) return;
    const g = this.gate, v = this.vote;
    const open = (this.stage === 'GATE_OPEN' && g && !this.paused && slot < g.choices.length)
      || (this.stage === 'ROUTE_VOTE' && v && !v.closed && !v.closing && slot < v.options.length)
      || (this.stage === 'SPACE_EVENT' && this.ev && !this.ev.closed && !this.ev.closing && slot < this.ev.def.options.length);
    if (open) this.hub.inject({ t: 'pick', pid: l.pid, nick: l.nick, slot });
  }

  private get chatLive(): ChatFeed[] { return this.chats.filter((f) => f.state === 'live'); }

  private renderChat(): void {
    const el = this.root?.querySelector<HTMLElement>('.xp-join-chat');
    const live = this.chatLive;
    if (el) {
      el.hidden = !live.length;
      el.textContent = live.length ? `or type A, B, C or D in ${live.map((f) => (f.source === 'twitch' ? 'Twitch' : 'Kick')).join(' / ')} chat` : '';
    }
    if (!this.$('#xp-menu').hidden && this.$('#xp-menu').querySelector('.xp-chat-state')) {
      for (const f of this.chats) {
        const chip = this.$('#xp-menu').querySelector<HTMLElement>(`.xp-chat-state[data-src="${f.source}"]`);
        if (chip) { chip.className = `xp-chat-state ${f.state}`; chip.textContent = f.state === 'error' ? f.error ?? 'error' : f.state; }
      }
    }
  }

  private onTally(t: Tally): void {
    this.tally = t;
    if (t.joinedN && t.joined.length) {
      this.toast(t.joinedN === 1 ? `${t.joined[0]} joined the crew` : `${t.joined[0]} and ${(t.joinedN - 1).toLocaleString('en-US')} others joined the crew`, 1800);
      sfx.play('join');
    }
    const g = this.gate;
    if (g && !g.revealed && t.gate?.attemptId === g.attemptId) {
      if (t.gate.answers > g.answers && this.stage === 'GATE_OPEN') sfx.play('answer');
      g.answers = t.gate.answers;
      g.eligible = t.gate.eligible;
      g.quorum = t.gate.quorum;
      if (t.gate.distribution && this.stage === 'GATE_LOCKED') g.distribution = t.gate.distribution;
    }
    for (const nick of t.answered) this.feed(nick);
    const e = this.ev;
    if (e && t.vote?.voteId === e.voteId) {
      if (!e.closed && t.vote.counts.some((n, i) => n > (e.counts[i] ?? 0))) sfx.play('vote');
      e.counts = t.vote.counts;
      if (e.closing) this.finishEvent();
    }
    const v = this.vote;
    if (v && t.vote?.voteId === v.voteId) {
      if (!v.closed && t.vote.counts.some((n, i) => n > (v.counts[i] ?? 0))) sfx.play('vote');
      v.counts = t.vote.counts;
      if (v.closing) this.finishVote();
    }
    this.renderCrewCount();
    this.soon();
  }

  /** Who just locked in: names only, never the option (a live split would let viewers copy it). */
  private feed(nick: string): void {
    const box = this.root.querySelector('.xp-feed');
    if (!box) return;
    // a big crew locks in hundreds a second: a few readable names beat a blur
    if (performance.now() - this.lastFeed < 350) return;
    this.lastFeed = performance.now();
    const chip = document.createElement('span');
    chip.className = 'xp-feed-chip';
    chip.innerHTML = `<i></i><b>${esc(nick)}</b> locked in`;
    box.prepend(chip);
    while (box.children.length > 3) box.lastElementChild!.remove();
    setTimeout(() => chip.classList.add('out'), 2200);
    setTimeout(() => chip.remove(), 2700);
  }

  private snapshot(): PublicSnapshot {
    const c = this.c!;
    const disc = this.discovered;
    const g = this.gate;
    const v = this.vote;
    return {
      room: c.room, campaign: c.title, host: c.host, stage: this.stage, paused: this.paused,
      target: this.target ? { id: this.target.id, title: this.target.title, chapter: CHAPTERS.find((x) => x.id === this.target!.chapter)!.title } : undefined,
      gate: g ? {
        attemptId: g.attemptId, nodeId: g.nodeId, gateIndex: g.gateIndex, attempt: g.attempt, prompt: g.variant.q, choices: g.choices,
        opensAt: g.opensAt, closesAt: g.pausedLeft !== null ? Date.now() + g.pausedLeft : g.closesAt,
        eligible: g.eligible, quorum: g.quorum, answers: g.answers, practice: g.practice, boss: g.boss, need: g.need, mult: g.mult,
        distribution: g.distribution,
        correctId: g.revealed ? g.correctId : undefined,
        explanation: g.revealed ? g.variant.why : undefined,
        passed: g.revealed ? g.passed : undefined,
        failReason: g.revealed ? g.failReason : undefined,
      } : undefined,
      vote: v ? { voteId: v.voteId, closesAt: v.closesAt, closed: v.closed, winner: v.winner, options: v.options.map((id, i) => ({ nodeId: id, title: NODE.get(id)!.title, votes: v.counts[i] ?? 0 })) } : undefined,
      discovered: disc.size, total: NODES.length,
      chapterProgress: CHAPTERS.map((ch) => { const ns = NODES.filter((n) => n.chapter === ch.id); return { id: ch.id, title: ch.title, discovered: ns.filter((n) => disc.has(n.id)).length, total: ns.length, open: chapterOpen(ch.id, disc) }; }),
      lastDiscovered: this.stage === 'NODE_COMPLETE' ? this.lastDiscovered : undefined,
      crew: this.tally?.crew ?? 0,
      leaders: this.tally?.leaders ?? [],
      hull: this.hull,
      next: c.ship?.next,
      event: this.ev ? {
        voteId: this.ev.voteId, title: this.ev.def.title, text: eventText(this.ev.def), closesAt: this.ev.closesAt, closed: this.ev.closed,
        options: this.ev.def.options.map((o, i) => ({ id: o.id, label: o.label, hint: o.hint, votes: this.ev!.counts[i] ?? 0 })),
        pick: this.ev.pick !== undefined ? this.ev.def.options[this.ev.pick].id : undefined,
        outcome: this.ev.result?.say, effect: this.ev.result ? effectLabel(this.ev.result) : undefined,
      } : undefined,
      rev: ++this.rev,
      sentAt: Date.now(),
    };
  }

  private broadcast(): void {
    if (!this.c) return;
    this.link.send({ from: 'host', msg: { t: 'state', room: this.c.room, s: this.snapshot() } });
  }

  /* ================= demo crew ================= */

  private spawnBots(): void {
    this.bots.clear();
    BOT_NAMES.forEach((nick, i) => this.bots.set(`bot-${i}`, { nick, skill: 0.5 + Math.random() * 0.4 }));
    this.helloBots();
  }

  private helloBots(): void {
    this.botHelloAt = Date.now();
    for (const [pid, b] of this.bots) this.hub.inject({ t: 'hello', pid, nick: b.nick });
  }

  private removeBots(): void {
    this.bots.clear();
    this.hub.cmd({ t: 'dropBots' });
  }

  private botsAct(kind: 'vote' | 'answer' | 'event'): void {
    for (const t of this.botTimers) clearTimeout(t);
    this.botTimers = [];
    for (const [pid, b] of this.bots) {
      if (kind === 'vote' && this.vote) {
        const v = this.vote;
        this.botTimers.push(window.setTimeout(() => {
          if (!v.closed && !v.closing) this.hub.inject({ t: 'vote', pid, voteId: v.voteId, nodeId: v.options[Math.floor(Math.random() * v.options.length)] });
        }, 1500 + Math.random() * 12000));
      }
      if (kind === 'event' && this.ev) {
        const e = this.ev;
        this.botTimers.push(window.setTimeout(() => {
          if (!e.closed && !e.closing) this.hub.inject({ t: 'vote', pid, voteId: e.voteId, nodeId: e.def.options[Math.floor(Math.random() * e.def.options.length)].id });
        }, 1500 + Math.random() * (EVENT_SECONDS - 4) * 1000));
      }
      if (kind === 'answer' && this.gate) {
        const g = this.gate;
        if (Math.random() < 0.12) continue;   // some never answer
        const window_ = (g.closesAt - g.opensAt) * 0.75;
        this.botTimers.push(window.setTimeout(() => {
          const pick = Math.random() < b.skill ? g.correctId : shuffle(g.choices.filter((x) => x.id !== g.correctId))[0].id;
          this.hub.inject({ t: 'answer', pid, attemptId: g.attemptId, choiceId: pick });
        }, 2500 + Math.random() * window_));
      }
    }
  }

  /* ================= host actions ================= */

  private startVote(): void {
    const options = this.reachable().slice(0, 4).map((n) => n.id);
    if (options.length < 2) return;
    this.vote = { voteId: randomId(8), options, counts: options.map(() => 0), closesAt: Date.now() + this.c!.settings.voteSeconds * 1000, closed: false };
    this.hub.cmd({ t: 'vote', voteId: this.vote.voteId, options });
    this.stage = 'ROUTE_VOTE';
    this.botsAct('vote');
    sfx.play('gateOpen');
    narrator.say(CALL.voteOpen, true);
    this.update();
  }

  private closeVote(): void {
    const v = this.vote;
    if (!v || v.closed || v.closing) return;
    // the final count comes with the ledger's next tally
    v.closing = true;
    this.hub.cmd({ t: 'voteClose' });
    sfx.play('lock');
    setTimeout(() => this.finishVote(), 3000);
  }

  private finishVote(): void {
    const v = this.vote;
    if (!v?.closing) return;
    v.closing = false;
    v.closed = true;
    const best = Math.max(...v.counts);
    const top = v.options.filter((_, i) => v.counts[i] === best);
    if (top.length === 1 && best > 0) { v.winner = top[0]; this.selected = top[0]; }
    else v.tie = top;
    narrator.say(v.winner ? CALL.voteClosed : CALL.voteTie, true);
    if (v.winner) narrator.say(destinationLine(NODE.get(v.winner)!.title));
    this.update();
  }

  private launch(id: string, hostPick = false): void {
    const n = NODE.get(id);
    if (!n || !this.c) return;
    const st = nodeState(n, this.discovered, this.assisted);
    const practiceRun = n.id === ROOT;
    if (st !== 'reachable' && !practiceRun) return;
    const inScene = n.body ? this.app.hasBody(n.body) : n.star ? this.app.hasStar(n.star) : n.landmark ? this.app.hasLandmark(n.landmark) : false;
    if (!inScene) { this.toast('This destination is not available in the simulation yet.'); return; }
    this.target = n;
    if (!this.c.progress || this.c.progress.nodeId !== id) this.c.progress = { nodeId: id, gate: 0, attempt: 1, used: [], assisted: false, correct: 0, answers: 0 };
    this.logLine(`Expedition to ${n.title} started${hostPick ? ' (host selected)' : ''}`);
    this.save();
    const voted = this.vote?.winner === id;
    this.vote = null;
    this.gate = null;
    this.hub.cmd({ t: 'clear' });
    if (practiceRun) narrator.say(CALL.practiceStart, true);
    else if (!voted) narrator.say(destinationLine(n.title), true);   // the vote result already announced it
    void this.fly(this.c.progress.gate);
  }

  private async fly(leg: number): Promise<void> {
    if (!this.target) return;
    this.stage = leg >= 3 ? 'NODE_ARRIVAL' : 'TRANSIT';
    this.update();
    sfx.play('launch');
    if (leg >= 3) narrator.say(CALL.finalApproach);
    else if (leg > 0) narrator.say(this.board ? CALL.enginesBoard : CALL.engines);
    await flyLeg(this.app, this.target, leg);
    if (this.stage !== 'TRANSIT' && this.stage !== 'NODE_ARRIVAL') return;   // abandoned mid-flight
    if (leg >= 3) this.completeNode();
    else if (this.eventDue(leg)) this.startEvent();
    else this.holdAtGate();
  }

  private holdAtGate(): void {
    const leg = this.c?.progress?.gate ?? 0;
    this.stage = 'GATE_READY';
    sfx.play('arrive');
    narrator.say(gateLine(leg, GATE_NAMES[leg]));
    this.update();
  }

  /* ================= space events, hull, boss gates ================= */

  private get hull(): number { return this.c?.ship?.hull ?? 100; }

  private setHull(v: number): void {
    if (!this.c) return;
    this.c.ship = { ...(this.c.ship ?? { hull: 100 }), hull: Math.max(0, Math.min(100, Math.round(v))) };
    if (this.c.ship.hull === 0) { this.breach = true; narrator.say(CALL.hullBreach); }
  }

  private isBoss(n: ExpeditionNode, gate: number): boolean {
    return gate === 2 && n.id !== ROOT && CHAPTERS.some((ch) => ch.finale === n.id);
  }

  private eventDue(leg: number): boolean {
    const n = this.target, c = this.c;
    if (!n || !c || n.id === ROOT || c.settings.practice || leg < 1 || leg > 2) return false;
    if (this.eventAt === n.id) return false;
    return Math.random() < EVENT_CHANCE;
  }

  private startEvent(): void {
    const pool = EVENTS.filter((e) => e.id !== this.lastEvent);
    const def = pool[Math.floor(Math.random() * pool.length)];
    this.lastEvent = def.id;
    this.eventAt = this.target?.id ?? null;
    this.ev = { def, voteId: randomId(8), counts: def.options.map(() => 0), closesAt: Date.now() + EVENT_SECONDS * 1000, closed: false };
    this.hub.cmd({ t: 'vote', voteId: this.ev.voteId, options: def.options.map((o) => o.id) });
    this.stage = 'SPACE_EVENT';
    this.botsAct('event');
    sfx.play('fail');
    narrator.say(def.intro, true);
    this.update();
  }

  private closeEvent(): void {
    const e = this.ev;
    if (!e || e.closed || e.closing) return;
    e.closing = true;
    this.hub.cmd({ t: 'voteClose' });
    sfx.play('lock');
    setTimeout(() => this.finishEvent(), 3000);
  }

  private finishEvent(): void {
    const e = this.ev, c = this.c;
    if (!e?.closing || !c) return;
    e.closing = false;
    e.closed = true;
    const best = Math.max(...e.counts);
    const top = e.def.options.map((_, i) => i).filter((i) => e.counts[i] === best);
    e.pick = top[Math.floor(Math.random() * top.length)];   // a tie (or silence) is settled by fate
    const r = rollResult(e.def.options[e.pick]);
    e.result = r;
    narrator.say(CALL.eventVoteClosed, true);
    narrator.say(r.say);
    if (r.mult || r.time) {
      const next = { ...(c.ship?.next ?? {}) };
      if (r.mult) next.mult = Math.max(next.mult ?? 1, r.mult);
      if (r.time) next.time = (next.time ?? 0) + r.time;
      c.ship = { hull: this.hull, next };
    }
    if (r.hull) this.setHull(this.hull + r.hull);
    sfx.play(r.hull && r.hull < 0 ? 'fail' : 'pass');
    this.logLine(`Space event: ${e.def.title} · ${e.def.options[e.pick].label} · ${effectLabel(r) || 'no effect'}`);
    this.save();
    this.update();
  }

  private afterEvent(): void {
    this.ev = null;
    this.hub.cmd({ t: 'clear' });
    if (this.breach) this.repair();
    else this.holdAtGate();
  }

  /** Hull at zero: patched up back at the start of this destination's route (points are kept). */
  private repair(): void {
    if (!this.resetAfterBreach()) return;
    this.toast('Emergency repairs done: hull 100%. The route restarts from the first waypoint.', 5000);
    void this.fly(0);
  }

  private resetAfterBreach(): boolean {
    const c = this.c;
    if (!this.breach || !c) return false;
    this.breach = false;
    this.setHull(100);
    this.gate = null;
    this.ev = null;
    this.hub.cmd({ t: 'clear' });
    if (c.progress) {
      c.progress.gate = 0;
      c.progress.attempt = 1;
      c.progress.used = [];
      this.logLine(`Hull breach: emergency repairs, ${NODE.get(c.progress.nodeId)?.title ?? ''} route restarted`);
    }
    this.save();
    return true;
  }

  private openGate(): void {
    const n = this.target, c = this.c;
    if (!n || !c || !c.progress) return;
    const p = c.progress;
    const variants = variantsFor(n.id, p.gate);
    if (!variants.length) { this.toast('No questions authored for this gate.'); return; }
    let idx = variants.findIndex((_, i) => !p.used.includes(i));
    const recycled = idx < 0;
    if (recycled) idx = Math.floor(Math.random() * variants.length);
    const v = variants[idx];
    const choices = shuffle([v.right, ...v.wrong]).map((label) => ({ id: randomId(4), label }));
    const now = Date.now();
    const practice = n.id === ROOT || c.settings.practice;
    const boss = !practice && this.isBoss(n, p.gate);
    const next = c.ship?.next;
    if (c.ship) c.ship.next = undefined;
    const windowMs = Math.max(MIN_WINDOW_S, c.settings.answerSeconds + (next?.time ?? 0)) * 1000;
    const mult = (boss ? BOSS_MULT : 1) * (next?.mult ?? 1);
    const need = boss ? BOSS_NEED : 0.5;
    this.gate = {
      attemptId: randomId(8), nodeId: n.id, gateIndex: p.gate, attempt: p.attempt, variant: v, recycled,
      choices, correctId: choices.find((x) => x.label === v.right)!.id,
      opensAt: now, closesAt: now + windowMs, pausedLeft: null, extended: false,
      eligible: this.tally?.crew ?? 0, quorum: 0, answers: 0, practice, revealed: false, boss, need, mult,
    };
    this.hub.cmd({ t: 'gate', attemptId: this.gate.attemptId, nodeId: n.id, gateIndex: p.gate, choices: choices.map((x) => x.id), windowMs, practice, mult, need });
    this.board = null;
    if (!recycled) p.used.push(idx);
    this.save();
    this.stage = 'GATE_OPEN';
    this.botsAct('answer');
    this.calledTen = false;
    sfx.play('gateOpen');
    if (boss) { narrator.say(CALL.bossIntro, true); narrator.say(v.q); }
    else narrator.say(v.q, true);
    this.update();
  }

  private lockGate(): void {
    const g = this.gate;
    if (!g || this.stage !== 'GATE_OPEN') return;
    for (const t of this.botTimers) clearTimeout(t);
    g.closesAt = Math.min(g.closesAt, Date.now());
    g.pausedLeft = null;
    this.hub.cmd({ t: 'lock' });
    this.stage = 'GATE_LOCKED';
    sfx.play('lock');
    narrator.say(CALL.lock, true);
    this.update();
  }

  private reveal(): void {
    const g = this.gate;
    if (!g || this.stage !== 'GATE_LOCKED' || g.revealing) return;
    g.revealing = true;
    this.hub.cmd({ t: 'reveal', attemptId: g.attemptId, correctId: g.correctId });
    setTimeout(() => this.onResult(null, g.attemptId), 8000);
  }

  /** Scores come from the crew ledger: 50–100 per correct answer by speed, once per gate. */
  private onResult(res: GateResult | null, attemptId: string): void {
    const g = this.gate, c = this.c;
    if (!g || !c || g.attemptId !== attemptId || !g.revealing) return;
    g.revealing = false;
    let r = res;
    if (!r) {
      r = { attemptId, correct: 0, answers: 0, eligible: g.eligible, quorum: g.quorum, distribution: g.choices.map(() => 0), passed: false, failReason: 'quorum', rows: [], practice: g.practice };
      this.toast('The crew relay lost this question\'s answers (it restarted). Try another question.', 6000);
    }
    g.passed = r.passed;
    g.failReason = r.failReason;
    g.revealed = true;
    g.distribution = r.distribution;
    g.answers = r.answers;
    g.eligible = r.eligible;
    g.quorum = r.quorum;
    this.board = { nodeTitle: NODE.get(g.nodeId)!.title, gateIndex: g.gateIndex, correct: r.correct, fastest: r.fastest, practice: r.practice, rows: r.rows };
    if (c.progress) { c.progress.correct += r.correct; c.progress.answers += r.answers; }
    if (g.passed) c.stats.gatesPassed++; else c.stats.gatesFailed++;
    this.logLine(`${NODE.get(g.nodeId)!.title} · Gate ${g.gateIndex + 1} ${g.passed ? 'passed' : 'failed'} (${r.correct}/${r.answers} correct)`);
    this.save();
    this.stage = 'GATE_REVEAL';
    sfx.play(g.passed ? 'pass' : 'fail');
    narrator.say(g.passed ? CALL.pass : g.failReason === 'quorum' ? CALL.failQuorum : CALL.failAccuracy, true);
    if (g.boss && !g.passed) {
      narrator.say(CALL.bossFail);
      this.setHull(this.hull - BOSS_DAMAGE);
      this.save();
    }
    narrator.say(g.variant.why);
    this.update();
  }

  private continueJourney(): void {
    const c = this.c, g = this.gate;
    if (!c?.progress || !g) return;
    const practiceTour = this.target?.id === ROOT;
    if (!g.passed && !practiceTour) return;
    c.progress.gate++;
    c.progress.attempt = 1;
    c.progress.used = [];
    if (g.practice && !practiceTour) c.progress.assisted = true;
    this.save();
    this.gate = null;
    void this.fly(c.progress.gate);
  }

  private retry(): void {
    const c = this.c;
    if (!c?.progress) return;
    c.progress.attempt++;
    this.save();
    this.gate = null;
    this.openGate();
  }

  private override(): void {
    const c = this.c, g = this.gate;
    if (!c?.progress || !g) return;
    c.progress.assisted = true;
    c.stats.overrides++;
    this.logLine(`Emergency override at ${NODE.get(g.nodeId)!.title} · Gate ${g.gateIndex + 1}`);
    g.passed = true;
    narrator.say(CALL.override, true);
    this.toast('Emergency override: this destination will be marked ASSISTED.');
    this.continueJourney();
  }

  private completeNode(): void {
    const c = this.c, n = this.target;
    if (!c || !n) return;
    const p = c.progress;
    const practiceTour = n.id === ROOT;
    const assisted = !!p?.assisted;
    const before = new Set(this.reachable().map((x) => x.id));
    if (!practiceTour) {
      if (!c.discovered.includes(n.id)) c.discovered.push(n.id);
      if (assisted && !c.assisted.includes(n.id)) c.assisted.push(n.id);
      this.logLine(`${n.title} discovered${assisted ? ' (assisted)' : ''}`);
    }
    const unlocked = this.reachable().filter((x) => !before.has(x.id)).map((x) => x.title);
    this.lastDiscovered = {
      id: n.id, title: n.title, facts: [...(n.facts ?? []), ...(unlocked.length ? [`New routes: ${unlocked.join(', ')}`] : [])],
      accuracy: p && p.answers ? Math.round((100 * p.correct) / p.answers) : 0, assisted,
    };
    c.progress = null;
    this.save();
    this.stage = 'NODE_COMPLETE';
    sfx.play('discovered');
    narrator.say(practiceTour ? CALL.practiceDone : discoveredLine(n.title), true);
    this.update();
  }

  private backToMap(): void {
    this.resetAfterBreach();
    this.stage = 'LOBBY';
    this.ev = null;
    this.eventAt = null;
    this.hub.cmd({ t: 'clear' });
    this.board = null;
    this.app.setTourScope(null);
    this.gate = null;
    this.vote = null;
    if (this.target && this.discovered.has(this.target.id)) this.target = null;
    this.selected = this.firstReachable() ?? this.selected;
    this.update();
    if (this.selected) this.map.focus(this.selected, 0.9);
  }

  private abandon(): void {
    // the expedition stays saved at its current gate: nothing is skipped, it resumes later
    for (const t of this.botTimers) clearTimeout(t);
    narrator.stop();
    this.gate = null;
    this.paused = false;
    this.backToMap();
    this.toast('Expedition paused at its current gate. Resume it any time, even next stream.');
  }

  private togglePause(): void {
    this.paused = !this.paused;
    const g = this.gate;
    if (g && this.stage === 'GATE_OPEN') {
      if (this.paused) { g.pausedLeft = Math.max(0, g.closesAt - Date.now()); this.hub.cmd({ t: 'pause' }); for (const t of this.botTimers) clearTimeout(t); }
      else if (g.pausedLeft !== null) {
        g.closesAt = Date.now() + g.pausedLeft;
        g.pausedLeft = null;
        this.hub.cmd({ t: 'resume' });
        this.botsAct('answer');
      }
    }
    this.update();
  }

  private extend(): void {
    const g = this.gate;
    if (!g || g.extended || this.stage !== 'GATE_OPEN') return;
    g.extended = true;
    g.closesAt += 15_000;
    this.hub.cmd({ t: 'extend', ms: 15_000 });
    this.update();
  }

  /* ================= clock ================= */

  private tick(): void {
    const now = Date.now();
    if (this.stage === 'GATE_OPEN' && this.gate && !this.paused) {
      const left = Math.ceil((this.gate.closesAt - now) / 1000);
      if (left <= 10 && left > 6 && !this.calledTen) { this.calledTen = true; if (!narrator.speaking) narrator.say(CALL.tenLeft); }
      if (left <= 5 && left > 0 && left !== this.lastTick) sfx.play('tick');
      this.lastTick = left;
      if (now >= this.gate.closesAt) this.lockGate();
    }
    if (this.stage === 'ROUTE_VOTE' && this.vote && !this.vote.closed && now >= this.vote.closesAt) this.closeVote();
    if (this.stage === 'SPACE_EVENT' && this.ev && !this.ev.closed && now >= this.ev.closesAt) this.closeEvent();
    if (this.bots.size && now - this.botHelloAt > BOT_HELLO_MS) this.helloBots();
    this.renderClock();
  }

  private update(): void {
    this.render();
    this.broadcast();
  }

  /* ================= DOM ================= */

  private build(): void {
    const r = document.createElement('div');
    r.id = 'xp';
    r.lang = 'en';   // the page may be lang="tr": CSS uppercase would turn i into İ
    r.innerHTML = `
      <header class="xp-hud">
        <div class="xp-brand">
          <img src="/logo-white.png" alt="" class="xp-logo" />
          <div>
            <div class="xp-kicker">Your Eyes In Space · The Great Expedition</div>
            <div class="xp-campaign" id="xp-campaign"></div>
          </div>
        </div>
        <div class="xp-progress" id="xp-progress"></div>
      </header>
      <aside class="xp-join" id="xp-join"></aside>
      <aside class="xp-leaders" id="xp-leaders"></aside>
      <section class="xp-banner" id="xp-banner" hidden></section>
      <section class="xp-stage" id="xp-stage" hidden></section>
      <section class="xp-mapwrap" id="xp-mapwrap">
        <div class="xp-map-head">
          <div class="xp-map-title">Expedition map</div>
          <div class="xp-chapter-tabs" id="xp-tabs"></div>
        </div>
        <div class="xp-map-body" id="xp-mapbody"></div>
        <div class="xp-detail" id="xp-detail"></div>
      </section>
      <nav class="xp-dock" id="xp-dock"></nav>
      <div class="xp-toasts" id="xp-toasts"></div>
      <div class="xp-modal" id="xp-enroll" hidden></div>
      <div class="xp-modal" id="xp-menu" hidden></div>
      <input type="file" id="xp-file" accept="application/json,.json" hidden />`;
    document.body.appendChild(r);
    this.root = r;
    this.map = new CampaignMap(this.$('#xp-mapbody'));
    this.map.onSelect = (id) => { this.selected = id; this.render(); };
    this.$('#xp-tabs').innerHTML = CHAPTERS.map((c, i) => `<button data-ch="${c.id}" title="${esc(c.title)}">${['I', 'II', 'III', 'IV', 'V'][i]}<span>${esc(c.title)}</span></button>`).join('');
    this.$('#xp-tabs').addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest('button');
      if (b?.dataset.ch) this.map.fitChapter(b.dataset.ch as never);
    });
    r.addEventListener('click', (e) => this.onClick(e));
    r.addEventListener('focusin', (e) => { if ((e.target as HTMLElement).matches('.xp-join-link')) (e.target as HTMLInputElement).select(); });
    this.$<HTMLInputElement>('#xp-file').addEventListener('change', async (e) => {
      const f = (e.target as HTMLInputElement).files?.[0];
      (e.target as HTMLInputElement).value = '';
      if (!f) return;
      try { const c = await importCampaign(f); this.$('#xp-menu').hidden = true; this.useCampaign(c, true); }
      catch (err) { this.toast((err as Error).message, 4000); }
    });
  }

  private onClick(e: MouseEvent): void {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-act]');
    if (!b) return;
    (b as HTMLButtonElement).blur?.();
    const act = b.dataset.act!;
    const arg = b.dataset.arg ?? '';
    const c = this.c;
    switch (act) {
      case 'create': {
        const host = this.$<HTMLInputElement>('#xp-host').value.trim().slice(0, 32);
        const title = this.$<HTMLInputElement>('#xp-title').value.trim().slice(0, 40);
        if (!host || !title) { this.toast('Enter your channel name and a crew name.'); return; }
        const nc = createCampaign(title, host);
        this.useCampaign(nc, false);
        this.showCreated(nc);
        break;
      }
      case 'resume-campaign': { const x = listCampaigns().find((k) => k.id === arg); if (x) { this.$('#xp-menu').hidden = true; this.useCampaign(x, true); } break; }
      case 'import': this.$<HTMLInputElement>('#xp-file').click(); break;
      case 'export': if (c) void exportCampaign(c); break;
      case 'close-modal': this.$('#xp-enroll').hidden = true; this.$('#xp-menu').hidden = true; break;
      case 'new-campaign': this.$('#xp-menu').hidden = true; this.showEnroll(); break;
      case 'menu': this.showMenu(); break;
      case 'launch': this.launch(arg, this.vote?.closed === true && this.vote.winner !== arg); break;
      case 'practice-run': this.launch(ROOT); break;
      case 'vote': this.startVote(); break;
      case 'close-vote': this.closeVote(); break;
      case 'cancel-vote': this.vote = null; this.stage = 'LOBBY'; this.update(); break;
      case 'open-gate': this.openGate(); break;
      case 'lock': this.lockGate(); break;
      case 'extend': this.extend(); break;
      case 'reveal': this.reveal(); break;
      case 'continue': this.continueJourney(); break;
      case 'close-event': this.closeEvent(); break;
      case 'after-event': this.afterEvent(); break;
      case 'repair': this.repair(); break;
      case 'retry': this.retry(); break;
      case 'override': if (confirm('Emergency override skips this gate. The destination will be marked ASSISTED and will not count as a clean run. Continue?')) this.override(); break;
      case 'map': this.backToMap(); break;
      case 'abandon': this.abandon(); break;
      case 'pause': this.togglePause(); break;
      case 'select': this.selected = arg; this.render(); this.map.focus(arg, 0.9); break;
      case 'mute': {
        const on = !(narrator.enabled || sfx.enabled);
        narrator.setEnabled(on); sfx.setEnabled(on);
        this.renderDock();
        break;
      }
      case 'hide-controls': this.hideControls = !this.hideControls; this.root.classList.toggle('stream-clean', this.hideControls); this.render(); break;
      case 'toggle': {
        if (!c) return;
        if (arg === 'voice') narrator.setEnabled(!narrator.enabled);
        if (arg === 'sfx') sfx.setEnabled(!sfx.enabled);
        if (arg === 'practice') c.settings.practice = !c.settings.practice;
        if (arg === 'demo') { c.settings.demoCrew = !c.settings.demoCrew; if (c.settings.demoCrew) this.spawnBots(); else this.removeBots(); }
        this.save(); this.showMenu(); this.update();
        break;
      }
      case 'chat-save': {
        if (!c) return;
        c.settings.twitch = this.$<HTMLInputElement>('#xp-twitch').value.trim().slice(0, 60) || undefined;
        c.settings.kick = this.$<HTMLInputElement>('#xp-kick').value.trim().slice(0, 60) || undefined;
        this.save();
        this.connectChats();
        this.showMenu();
        this.renderChat();
        break;
      }
      case 'answer-time': if (c) { c.settings.answerSeconds = Number(arg); this.save(); this.showMenu(); } break;
      case 'copy-link': {
        if (!c) return;
        void copyText(this.joinBase + c.room).then((ok) => {
          this.toast(ok ? 'Join link copied — paste it in your chat' : 'Link selected — press Ctrl+C / ⌘C');
          if (ok) { b.classList.add('done'); setTimeout(() => b.classList.remove('done'), 1600); }
          else this.root.querySelector<HTMLInputElement>('.xp-join-link')?.select();
        });
        break;
      }
    }
  }

  private toast(text: string, ms = 2600): void {
    const t = document.createElement('div');
    t.className = 'xp-toast';
    t.textContent = text;
    this.$('#xp-toasts').appendChild(t);
    setTimeout(() => t.classList.add('out'), ms);
    setTimeout(() => t.remove(), ms + 400);
  }

  /* ---------- modals ---------- */

  private showEnroll(): void {
    const list = listCampaigns();
    const m = this.$('#xp-enroll');
    m.hidden = false;
    m.innerHTML = `
      <div class="xp-sheet xp-enroll-sheet">
        <div class="xp-kicker">Streamer Mode</div>
        <h1 class="xp-h1">The Great Expedition</h1>
        <p class="xp-lede">Can your community reach the edge of the observable universe? Your viewers join from their phones and answer science questions. Every gate they pass moves the ship.</p>
        <div class="xp-steps">
          <div><b>1</b><span>Enroll your channel and name your crew</span></div>
          <div><b>2</b><span>Viewers scan the QR code and join, no account needed</span></div>
          <div><b>3</b><span>Three Knowledge Gates per destination: 50% correct opens the engines</span></div>
        </div>
        <label class="xp-field"><span>Channel / streamer name</span><input id="xp-host" maxlength="32" placeholder="e.g. AstroBerk" autocomplete="off" /></label>
        <label class="xp-field"><span>Crew name</span><input id="xp-title" maxlength="40" placeholder="e.g. The Pale Blue Dots" autocomplete="off" /></label>
        <div class="xp-row">
          <button class="xp-btn primary" data-act="create">Create campaign</button>
          <button class="xp-btn ghost" data-act="import">Restore from backup file</button>
        </div>
        ${list.length ? `<div class="xp-sub">Campaigns on this computer</div><div class="xp-camps">${list.map((k) => `
          <button class="xp-camp" data-act="resume-campaign" data-arg="${k.id}"><span class="xp-camp-title">${esc(k.title)}</span><span class="xp-camp-meta">${esc(k.host)} · ${k.discovered.length}/${NODES.length} discovered · ${new Date(k.updatedAt).toLocaleDateString('en-GB')}</span></button>`).join('')}</div>` : ''}
        ${this.c ? '<button class="xp-x" data-act="close-modal" aria-label="Close">×</button>' : ''}
      </div>`;
    setTimeout(() => this.$<HTMLInputElement>('#xp-host')?.focus(), 50);
  }

  private showCreated(c: Campaign): void {
    const m = this.$('#xp-menu');
    m.hidden = false;
    m.innerHTML = `
      <div class="xp-sheet">
        <div class="xp-kicker">Campaign created</div>
        <h2 class="xp-h2">${esc(c.title)}</h2>
        <p class="xp-lede">Progress is saved in this browser after every gate, so closing the stream never loses it. Download a backup to restore your crew's progress on another computer.</p>
        <div class="xp-codebox"><span>Crew join code</span><b>${c.room}</b></div>
        <div class="xp-row">
          <button class="xp-btn primary" data-act="export">Download backup</button>
          <button class="xp-btn ghost" data-act="close-modal">Start</button>
        </div>
      </div>`;
  }

  private showMenu(): void {
    const c = this.c;
    if (!c) return;
    const m = this.$('#xp-menu');
    m.hidden = false;
    const tg = (on: boolean) => `<span class="xp-switch${on ? ' on' : ''}"></span>`;
    m.innerHTML = `
      <div class="xp-sheet">
        <button class="xp-x" data-act="close-modal" aria-label="Close">×</button>
        <div class="xp-kicker">Campaign</div>
        <h2 class="xp-h2">${esc(c.title)}</h2>
        <div class="xp-statgrid">
          <div><b>${c.discovered.length}</b><span>discovered</span></div>
          <div><b>${c.stats.gatesPassed}</b><span>gates passed</span></div>
          <div><b>${c.stats.gatesFailed}</b><span>gates failed</span></div>
          <div><b>${Math.max(0, (this.tally?.known ?? 0) - this.bots.size).toLocaleString('en-US')}</b><span>crew members</span></div>
        </div>
        <div class="xp-sub">Rehearsal</div>
        <button class="xp-opt" data-act="toggle" data-arg="demo">${tg(c.settings.demoCrew)}<span><b>Demo crew</b><small>14 simulated viewers join, vote and answer, for testing before you go live</small></span></button>
        <button class="xp-opt" data-act="toggle" data-arg="practice">${tg(c.settings.practice)}<span><b>Practice mode</b><small>No turnout quorum and no points. Destinations found this way are marked ASSISTED.</small></span></button>
        <div class="xp-sub">Sound</div>
        <button class="xp-opt" data-act="toggle" data-arg="voice">${tg(narrator.enabled)}<span><b>Narrator voice</b><small>Reads every question and explanation aloud and calls out destinations, gates and results</small></span></button>
        <button class="xp-opt" data-act="toggle" data-arg="sfx">${tg(sfx.enabled)}<span><b>Sound effects</b><small>Launches, votes, answers, countdown and discoveries</small></span></button>
        <div class="xp-sub">Stream chat</div>
        <p class="xp-opt-note">Viewers can also answer and vote by typing A, B, C or D in your chat. Read-only: nothing is posted.</p>
        <div class="xp-chat-row">
          <label class="xp-field"><span>Twitch channel</span><input id="xp-twitch" maxlength="60" placeholder="e.g. spacechip" value="${esc(c.settings.twitch ?? '')}" autocomplete="off" spellcheck="false" /></label>
          <span class="xp-chat-state ${this.chats.find((f) => f.source === 'twitch')?.state ?? 'off'}" data-src="twitch">${this.chats.find((f) => f.source === 'twitch')?.state ?? 'off'}</span>
        </div>
        <div class="xp-chat-row">
          <label class="xp-field"><span>Kick channel</span><input id="xp-kick" maxlength="60" placeholder="e.g. spacechip" value="${esc(c.settings.kick ?? '')}" autocomplete="off" spellcheck="false" /></label>
          <span class="xp-chat-state ${this.chats.find((f) => f.source === 'kick')?.state ?? 'off'}" data-src="kick">${this.chats.find((f) => f.source === 'kick')?.state ?? 'off'}</span>
        </div>
        <div class="xp-row"><button class="xp-btn" data-act="chat-save">Connect chat</button></div>
        <div class="xp-sub">Answer window</div>
        <div class="xp-seg">${[30, 45, 60, 90].map((s) => `<button data-act="answer-time" data-arg="${s}" class="${c.settings.answerSeconds === s ? 'on' : ''}">${s} s</button>`).join('')}</div>
        <div class="xp-sub">Save</div>
        <div class="xp-row">
          <button class="xp-btn" data-act="export">Download backup</button>
          <button class="xp-btn ghost" data-act="import">Restore backup</button>
          <button class="xp-btn ghost" data-act="new-campaign">Switch campaign</button>
        </div>
        <div class="xp-sub">Logbook</div>
        <ol class="xp-log">${c.log.slice(-8).reverse().map((l) => `<li><time>${new Date(l.t).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}</time>${esc(l.text)}</li>`).join('')}</ol>
      </div>`;
  }

  /* ---------- render ---------- */

  private render(): void {
    const c = this.c;
    if (!c) return;
    const disc = this.discovered;
    this.set(this.$('#xp-campaign'), `<span class="xp-campaign-name">${esc(c.title)}</span><span class="xp-campaign-host">hosted by ${esc(c.host)}</span>`);
    this.set(this.$('#xp-progress'), `
      <div class="xp-progress-num"><b>${disc.size}</b><span>/ ${NODES.length} destinations</span></div>
      <div class="xp-chapters">${CHAPTERS.map((ch) => {
        const ns = NODES.filter((n) => n.chapter === ch.id);
        const got = ns.filter((n) => disc.has(n.id)).length;
        return `<div class="xp-ch${chapterOpen(ch.id, disc) ? '' : ' fog'}" title="${esc(ch.title)} ${got}/${ns.length}"><i style="width:${(100 * got) / ns.length}%"></i></div>`;
      }).join('')}</div>
      <div class="xp-hull${this.hull <= 30 ? ' low' : ''}" title="Ship hull: space events and boss gates can damage it; at 0% the route restarts"><span>Hull</span><i><b style="width:${this.hull}%"></b></i><em>${this.hull}%</em></div>`);
    this.renderJoin();
    this.renderLeaders();
    const lobby = this.stage === 'LOBBY';
    this.$('#xp-mapwrap').hidden = !lobby;
    if (lobby) {
      this.map.render(disc, this.assisted, c.progress?.nodeId ?? null);
      this.renderDetail();
    }
    this.renderBanner();
    this.renderStage();
    this.renderDock();
  }

  private renderJoin(): void {
    const c = this.c;
    if (!c || !this.joinBase) return;
    const url = this.joinBase + c.room;
    const shown = url.replace(/^https?:\/\//, '').replace(/\/crew\.html\?c=.*$/, '/crew').replace(/\/join\/.*$/, '/join');
    const el = this.$('#xp-join');
    if (el.dataset.url !== url) {
      el.dataset.url = url;
      el.innerHTML = `
        <div class="xp-qr">${qrSvg(url)}</div>
        <div class="xp-join-text">
          <div class="xp-kicker">Join the crew</div>
          <div class="xp-join-url">${esc(shown)}</div>
          <div class="xp-join-copy">
            <input class="xp-join-link" readonly value="${esc(url)}" aria-label="Crew join link" />
            <button class="xp-join-btn" data-act="copy-link">Copy link</button>
          </div>
          <div class="xp-join-code">${c.room}</div>
          <div class="xp-join-crew"><i class="xp-live"></i><b class="xp-crew-n"></b> crew online</div>
          <div class="xp-join-chat" hidden></div>
        </div>`;
      this.renderChat();
    }
    this.renderCrewCount();
  }

  private renderCrewCount(): void {
    this.bump(this.root.querySelector('.xp-crew-n'), (this.tally?.crew ?? 0).toLocaleString('en-US'));
  }

  private renderLeaders(): void {
    const top = this.tally?.leaders ?? [];
    const el = this.$('#xp-leaders');
    el.hidden = !top.length;
    this.set(el, `<div class="xp-kicker">Top navigators</div><ol>${top.map((r, i) => `<li><span class="xp-rank">${i + 1}</span><span class="xp-nick">${esc(r.nick)}</span><span class="xp-pts">${r.points}</span></li>`).join('')}</ol>`);
  }

  private renderDetail(): void {
    const el = this.$('#xp-detail');
    const n = this.selected ? NODE.get(this.selected) : null;
    if (!n) { this.set(el, ''); return; }
    const disc = this.discovered;
    const st = nodeState(n, disc, this.assisted);
    const ch = CHAPTERS.find((x) => x.id === n.chapter)!;
    const p = this.c?.progress;
    const inProgress = p?.nodeId === n.id;
    const label: Record<string, string> = { discovered: 'Discovered', assisted: 'Discovered · assisted', reachable: inProgress ? `In progress · Gate ${p!.gate + 1} of 3` : 'Reachable', locked: 'Locked', unavailable: 'Coming later' };
    let action = '';
    if (n.id === ROOT) action = '<button class="xp-btn" data-act="practice-run">Practice run (tutorial)</button>';
    else if (st === 'reachable') action = `<button class="xp-btn primary" data-act="launch" data-arg="${n.id}">${inProgress ? 'Resume expedition' : 'Start expedition'}</button>`;
    this.set(el, `
      <div class="xp-kicker">${esc(ch.title)} · ${n.kind.toLowerCase()}</div>
      <h2 class="xp-h2">${esc(n.title)}</h2>
      <div class="xp-state ${st}">${label[st]}</div>
      <p class="xp-detail-text">${esc(n.summary ?? n.focus)}</p>
      ${n.summary ? `<div class="xp-detail-focus"><span>Science focus</span>${esc(n.focus)}</div>` : ''}
      ${st === 'locked' || st === 'unavailable' ? `<p class="xp-hint">${esc(unlockHint(n, disc))}</p>` : ''}
      ${n.available && n.id !== ROOT ? `<div class="xp-gates">${GATE_NAMES.map((g, i) => `<span class="${(inProgress && i < p!.gate) || st === 'discovered' || st === 'assisted' ? 'done' : ''}">${i + 1} · ${g}</span>`).join('')}</div>` : ''}
      <div class="xp-row">${action}</div>`);
  }

  private renderBanner(): void {
    const el = this.$('#xp-banner');
    const n = this.target;
    const show = !!n && (this.stage === 'TRANSIT' || this.stage === 'GATE_READY' || this.stage === 'NODE_ARRIVAL');
    el.hidden = !show;
    if (!show || !n) return;
    const g = this.c?.progress?.gate ?? 3;
    const what = this.stage === 'NODE_ARRIVAL' ? 'Final approach' : this.stage === 'TRANSIT' ? (g === 0 ? 'Departing for' : 'Engines on: continuing to') : 'Holding at waypoint';
    this.set(el, `
      <div class="xp-kicker">${what}</div>
      <div class="xp-banner-title">${esc(n.title)}</div>
      <div class="xp-pips">${[0, 1, 2].map((i) => `<i class="${i < g ? 'done' : i === g && this.stage !== 'NODE_ARRIVAL' ? 'now' : ''}"></i>`).join('')}<span>${this.stage === 'GATE_READY' ? `Knowledge Gate ${g + 1} ahead: ${GATE_NAMES[g]}` : this.stage === 'NODE_ARRIVAL' ? 'All gates open' : `Waypoint ${g + 1} of 3`}</span></div>
      ${this.nextChip()}
      ${n.id !== ROOT ? '<div class="xp-note">Cinematic route through the simulation, not a real spacecraft trajectory.</div>' : ''}`);
  }

  /** what a space event left for the next gate, and whether it is a boss gate */
  private nextChip(): string {
    const nx = this.c?.ship?.next;
    const n = this.target, g = this.c?.progress?.gate ?? 0;
    const bits: string[] = [];
    if (n && this.stage === 'GATE_READY' && !this.c?.settings.practice && this.isBoss(n, g)) bits.push(`<b class="boss">Boss gate · ×${BOSS_MULT} points · ${BOSS_NEED * 100}% needed</b>`);
    if (nx?.mult) bits.push(`<b class="up">Next gate ×${nx.mult} points</b>`);
    if (nx?.time) bits.push(`<b class="${nx.time > 0 ? 'up' : 'down'}">Next question ${nx.time > 0 ? '+' : '−'}${Math.abs(nx.time)} s</b>`);
    return bits.length ? `<div class="xp-mods">${bits.join('')}</div>` : '';
  }

  private renderStage(): void {
    const el = this.$('#xp-stage');
    const g = this.gate;
    const v = this.vote;
    const e = this.ev;
    if (this.stage === 'SPACE_EVENT' && e) {
      const total = e.counts.reduce((a, b) => a + b, 0);
      el.hidden = false;
      el.className = `xp-stage event${e.closed ? ' resolved' : ''}`;
      const r = e.result;
      this.set(el, `
        <div class="xp-kicker">Space event · the crew decides</div>
        <div class="xp-event-title">${esc(e.def.title)}</div>
        <p class="xp-event-text">${esc(eventText(e.def))}</p>
        <div class="xp-vote-grid">${e.def.options.map((o, i) => `
          <div class="xp-vote${e.pick === i ? ' win' : ''}">
            <span class="xp-vote-letter">${LETTERS[i]}</span>
            <span class="xp-vote-title">${esc(o.label)}</span>
            <span class="xp-vote-focus">${esc(o.hint)}</span>
            <span class="xp-bar"><i data-i="${i}"></i></span>
            <span class="xp-vote-n" data-i="${i}"></span>
          </div>`).join('')}</div>
        ${r ? `<div class="xp-event-out ${r.hull && r.hull < 0 ? 'bad' : 'good'}"><p>${esc(r.say)}</p>${effectLabel(r) ? `<b>${esc(effectLabel(r))}</b>` : ''}${this.breach ? '<b class="breach">Hull breach!</b>' : ''}</div>` : ''}
        <div class="xp-stage-foot">${e.closed ? '' : `<span class="xp-clock" data-until="${e.closesAt}"></span> · <b class="xp-votes-n"></b> votes${this.chatLive.length ? ' · type A or B in chat' : ''}`}</div>`);
      e.counts.forEach((n, i) => {
        this.bump(el.querySelector(`.xp-vote-n[data-i="${i}"]`), String(n));
        const bar = el.querySelector<HTMLElement>(`.xp-bar i[data-i="${i}"]`);
        if (bar) bar.style.width = `${total ? (100 * n) / total : 0}%`;
      });
      this.bump(el.querySelector('.xp-votes-n'), String(total));
      this.renderClock();
      return;
    }
    if (this.stage === 'ROUTE_VOTE' && v) {
      const counts = v.counts;
      const total = counts.reduce((a, b) => a + b, 0);
      el.hidden = false;
      el.className = 'xp-stage vote';
      this.set(el, `
        <div class="xp-kicker">Route vote · where does the crew go next?</div>
        <div class="xp-vote-grid">${v.options.map((id, i) => {
          const n = NODE.get(id)!;
          const win = v.winner === id, tie = v.tie?.includes(id);
          return `<button class="xp-vote${win ? ' win' : ''}${tie ? ' tie' : ''}" ${v.closed && (tie || win) ? `data-act="launch" data-arg="${id}"` : ''}>
            <span class="xp-vote-letter">${LETTERS[i]}</span>
            <span class="xp-vote-title">${esc(n.title)}</span>
            <span class="xp-vote-focus">${esc(n.focus)}</span>
            <span class="xp-bar"><i data-i="${i}"></i></span>
            <span class="xp-vote-n" data-i="${i}"></span>
          </button>`;
        }).join('')}</div>
        <div class="xp-stage-foot">${v.closed ? (v.winner ? `The crew chose <b>${esc(NODE.get(v.winner)!.title)}</b>` : 'Tie: the host picks one of the tied routes') : `<span class="xp-clock" data-until="${v.closesAt}"></span> · <b class="xp-votes-n"></b> votes`}</div>`);
      counts.forEach((n, i) => {
        this.bump(el.querySelector(`.xp-vote-n[data-i="${i}"]`), String(n));
        const bar = el.querySelector<HTMLElement>(`.xp-bar i[data-i="${i}"]`);
        if (bar) bar.style.width = `${total ? (100 * n) / total : 0}%`;
      });
      this.bump(el.querySelector('.xp-votes-n'), String(total));
      this.renderClock();
      return;
    }
    if (g && (this.stage === 'GATE_OPEN' || this.stage === 'GATE_LOCKED' || this.stage === 'GATE_REVEAL')) {
      el.hidden = false;
      el.className = `xp-stage gate ${this.stage.toLowerCase()}${g.boss ? ' boss' : ''}`;
      const n = NODE.get(g.nodeId)!;
      const dist = g.distribution;
      const totalAns = Math.max(1, dist ? dist.reduce((a, b) => a + b, 0) : g.answers);
      const correct = dist ? dist[g.choices.findIndex((x) => x.id === g.correctId)] : 0;
      let foot = '';
      if (this.stage === 'GATE_OPEN') foot = `<span class="xp-clock" data-until="${g.closesAt}"></span><span class="xp-count"><b class="xp-answers-n"></b> answers${g.practice ? ' · practice' : ` · ${g.quorum} needed`}${this.chatLive.length ? ' · type A–D in chat' : ''}</span>${this.paused ? '<span class="xp-paused">Paused</span>' : ''}<span class="xp-feed" aria-live="polite"></span>`;
      if (this.stage === 'GATE_LOCKED') foot = `<span class="xp-count">Answers locked · <b>${g.answers.toLocaleString('en-US')}</b> received</span>`;
      if (this.stage === 'GATE_REVEAL') {
        const pct = g.answers ? Math.round((100 * correct) / g.answers) : 0;
        foot = g.passed
          ? `<span class="xp-verdict pass">Engines unlocked</span><span class="xp-count">${pct}% correct${g.practice ? ' · practice' : ''}</span>`
          : `<span class="xp-verdict fail">Engines locked</span><span class="xp-count">${g.failReason !== 'quorum' ? `Crew knowledge below ${Math.round(g.need * 100)}%: ${pct}% correct` : g.eligible === 0 ? 'No crew was online when the question opened' : `Not enough crew responses: ${g.answers} of ${g.quorum} needed`}</span>`;
      }
      this.set(el, `
        <div class="xp-gate-head">
          <div class="xp-kicker">${g.boss ? '<span class="xp-boss">Boss gate</span> ' : ''}Knowledge Gate ${g.gateIndex + 1} · ${GATE_NAMES[g.gateIndex]}${g.attempt > 1 ? ` · attempt ${g.attempt}` : ''}${g.recycled ? ' · recovery' : ''}${g.mult > 1 ? ` · ×${g.mult} points` : ''}${g.need > 0.5 ? ` · ${Math.round(g.need * 100)}% needed` : ''}</div>
          <div class="xp-gate-target">${esc(n.title)}</div>
        </div>
        <div class="xp-q">${esc(g.variant.q)}</div>
        <div class="xp-choices">${g.choices.map((ch, i) => {
          const right = g.revealed && ch.id === g.correctId;
          const share = dist ? Math.round((100 * dist[i]) / totalAns) : 0;
          return `<div class="xp-choice${right ? ' right' : g.revealed ? ' wrong' : ''}">
            <span class="xp-letter">${LETTERS[i]}</span><span class="xp-choice-label">${esc(ch.label)}</span>
            ${dist ? `<span class="xp-share"><i style="width:${share}%"></i></span><span class="xp-pct">${share}%</span>` : ''}
          </div>`;
        }).join('')}</div>
        ${g.revealed ? `<div class="xp-why">${esc(g.variant.why)}</div>` : ''}
        <div class="xp-stage-foot">${foot}</div>`);
      this.bump(el.querySelector('.xp-answers-n'), g.answers.toLocaleString('en-US'));
      this.renderClock();
      return;
    }
    if (this.stage === 'NODE_COMPLETE' && this.lastDiscovered) {
      const d = this.lastDiscovered;
      const practice = d.id === ROOT;
      el.hidden = false;
      el.className = 'xp-stage done';
      this.set(el, `
        <div class="xp-kicker">${practice ? 'Practice run complete' : 'Destination discovered'}</div>
        <div class="xp-done-title">${esc(d.title)}</div>
        <div class="xp-done-meta">${practice ? 'The crew is ready for the real thing.' : `Crew accuracy ${d.accuracy}% · ${d.assisted ? '<span class="xp-tag">Assisted</span>' : '<span class="xp-tag clean">Clean run</span>'}`}</div>
        ${(() => {
          const facts = `<ul class="xp-facts">${d.facts.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>`;
          const b = this.board;
          if (!b?.rows.length) return facts;
          return `<div class="xp-done-grid">${facts}<div class="xp-done-board"><div class="xp-kicker">Top navigators</div>${boardList(b)}</div></div>`;
        })()}`);
      return;
    }
    const b = this.board;
    if (b && b.rows.length && (this.stage === 'TRANSIT' || this.stage === 'GATE_READY' || this.stage === 'NODE_ARRIVAL')) {
      el.hidden = false;
      el.className = 'xp-stage board';
      this.set(el, `
        <div class="xp-kicker">${b.practice ? 'Practice leaderboard' : 'Leaderboard'} · after Gate ${b.gateIndex + 1} at ${esc(b.nodeTitle)}</div>
        ${boardList(b)}
        <div class="xp-stage-foot">${b.fastest ? `<span>Fastest correct answer: <b>${esc(b.fastest.nick)}</b> in ${(b.fastest.ms / 1000).toFixed(1)} s</span>` : '<span>No correct answers this time</span>'}<span>·</span><span>${b.practice ? 'Practice points are not saved' : `Faster correct answers earn up to ${POINTS_MAX} points`}</span></div>`);
      return;
    }
    el.hidden = true;
  }

  private renderClock(): void {
    for (const el of this.root.querySelectorAll<HTMLElement>('.xp-clock')) {
      const until = Number(el.dataset.until);
      const g = this.gate;
      const left = this.paused && g?.pausedLeft != null ? g.pausedLeft : Math.max(0, until - Date.now());
      const s = Math.ceil(left / 1000);
      el.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
      el.classList.toggle('low', s <= 10);
    }
    this.renderCrewCount();
  }

  private renderDock(): void {
    const el = this.$('#xp-dock');
    const c = this.c!;
    const btn = (act: string, text: string, cls = '', arg = '') => `<button class="xp-btn ${cls}" data-act="${act}"${arg ? ` data-arg="${arg}"` : ''}>${text}</button>`;
    let main = '', side = '';
    const g = this.gate;
    switch (this.stage) {
      case 'LOBBY': {
        const n = this.selected ? NODE.get(this.selected) : null;
        const st = n ? nodeState(n, this.discovered, this.assisted) : null;
        if (c.progress) main = btn('launch', `Resume: ${esc(NODE.get(c.progress.nodeId)!.title)} · Gate ${c.progress.gate + 1}`, 'primary', c.progress.nodeId);
        else if (n && st === 'reachable') main = btn('launch', `Start expedition: ${esc(n.title)}`, 'primary', n.id);
        if (!c.progress && this.reachable().length >= 2) side += btn('vote', 'Start route vote', main ? '' : 'primary');
        break;
      }
      case 'ROUTE_VOTE':
        if (this.vote && !this.vote.closed) main = btn('close-vote', 'Close vote', 'primary');
        else if (this.vote?.winner) main = btn('launch', `Launch: ${esc(NODE.get(this.vote.winner)!.title)}`, 'primary', this.vote.winner);
        else main = '<span class="xp-dock-note">Tie: click one of the tied routes</span>';
        side = btn('cancel-vote', 'Cancel', 'ghost');
        break;
      case 'TRANSIT': case 'NODE_ARRIVAL':
        main = '<span class="xp-dock-note"><i class="xp-spin"></i>In flight…</span>';
        side = btn('abandon', 'Back to map', 'ghost');
        break;
      case 'SPACE_EVENT':
        if (this.ev && !this.ev.closed) main = btn('close-event', this.ev.closing ? 'Counting votes…' : 'Close vote now', 'primary');
        else main = btn('after-event', this.breach ? 'Emergency repairs' : 'Continue to the gate', 'primary');
        side = btn('abandon', 'Back to map', 'ghost');
        break;
      case 'GATE_READY':
        main = btn('open-gate', `Open question · Gate ${(c.progress?.gate ?? 0) + 1}`, 'primary');
        side = btn('abandon', 'Back to map', 'ghost');
        break;
      case 'GATE_OPEN':
        main = btn('lock', 'Lock answers', 'primary');
        side = btn('pause', this.paused ? 'Resume' : 'Pause', 'ghost') + (g && !g.extended ? btn('extend', '+15 s', 'ghost') : '');
        break;
      case 'GATE_LOCKED':
        main = btn('reveal', 'Reveal answer', 'primary');
        break;
      case 'GATE_REVEAL':
        if (this.breach) { main = btn('repair', 'Emergency repairs', 'primary'); side = btn('abandon', 'Back to map', 'ghost'); }
        else if (g?.passed || this.target?.id === ROOT) main = btn('continue', (c.progress?.gate ?? 0) >= 2 ? 'Final approach' : 'Continue journey', 'primary');
        else { main = btn('retry', 'Try another question', 'primary'); side = btn('override', 'Emergency override', 'ghost danger') + btn('abandon', 'Back to map', 'ghost'); }
        break;
      case 'NODE_COMPLETE':
        main = btn('map', 'Back to map', 'primary');
        break;
    }
    this.set(el, `
      <div class="xp-dock-main">${main}${side}</div>
      <div class="xp-dock-tools">
        ${c.settings.demoCrew ? '<span class="xp-chip">Demo crew</span>' : ''}${c.settings.practice ? '<span class="xp-chip">Practice</span>' : ''}
        <button class="xp-icon${narrator.enabled || sfx.enabled ? '' : ' off'}" data-act="mute" title="Narrator and sound effects on/off">${narrator.enabled || sfx.enabled ? '♪' : '×'}</button>
        <button class="xp-icon" data-act="copy-link" title="Copy crew join link">⧉</button>
        <button class="xp-icon" data-act="hide-controls" title="Clean stream view (hide host controls)">${this.hideControls ? '◐' : '◑'}</button>
        <button class="xp-icon" data-act="menu" title="Campaign, rehearsal and backup">☰</button>
      </div>`);
  }
}
