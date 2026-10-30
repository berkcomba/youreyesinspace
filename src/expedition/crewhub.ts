/**
 * The cockpit's handle on the crew ledger (engine.ts): in the relay's room when there is one,
 * otherwise right here in the page. Either way the cockpit only sees summaries.
 */
import { Ledger, isTrustedPid, type CrewEvent, type CrewRecord, type GateResult, type LedgerCmd, type Tally } from './engine';
import type { CrewToHost } from './protocol';
import type { Link } from './link';

export interface CrewHub {
  readonly remote: boolean;
  /** a campaign (re)opened: its room code and, without a relay, its saved players */
  use(room: string, records: Record<string, CrewRecord>): void;
  cmd(c: LedgerCmd): void;
  /** events the cockpit vouches for: demo crew and chat */
  inject(e: CrewEvent): void;
  /** a phone message over the development relay */
  fromPhone(m: CrewToHost): void;
  onTally(cb: (t: Tally) => void): void;
  /** null: the relay lost this question (restarted mid-gate) */
  onResult(cb: (r: GateResult | null, attemptId: string) => void): void;
}

const TALLY_MS = 250;
const INJECT_MS = 250;

export function openHub(link: Link, saveSoon: () => void): CrewHub {
  return link.server ? remoteHub(link) : localHub(link, saveSoon);
}

function localHub(link: Link, saveSoon: () => void): CrewHub {
  let room = '';
  let ledger: Ledger | null = null;
  const tallySubs: Array<(t: Tally) => void> = [];
  const resultSubs: Array<(r: GateResult | null, id: string) => void> = [];
  setInterval(() => {
    if (!ledger?.dirty) return;
    const t = ledger.tally();
    for (const f of tallySubs) f(t);
  }, TALLY_MS);
  return {
    remote: false,
    use(r, records): void {
      room = r;
      ledger = new Ledger(records, false, (m) => link.send({ from: 'host', msg: { t: 'me', room, ...m } }), saveSoon);
    },
    cmd(c): void {
      if (!ledger) return;
      const r = ledger.cmd(c);
      if (c.t === 'reveal') queueMicrotask(() => { for (const f of resultSubs) f(r, c.attemptId); });
    },
    inject(e): void { if (isTrustedPid(e.pid)) ledger?.event(e); },
    fromPhone(m): void {
      if (!ledger || m.room !== room || isTrustedPid(m.pid)) return;
      if (m.t === 'hello') ledger.event({ t: 'hello', pid: m.pid, nick: m.nick });
      else if (m.t === 'vote') ledger.event({ t: 'vote', pid: m.pid, voteId: m.voteId, nodeId: m.nodeId });
      else if (m.t === 'answer') ledger.event({ t: 'answer', pid: m.pid, attemptId: m.attemptId, choiceId: m.choiceId });
      else if (m.t === 'ping') ledger.event({ t: 'hello', pid: m.pid, nick: ledger.records[m.pid]?.nick ?? '' });
    },
    onTally(cb): void { tallySubs.push(cb); },
    onResult(cb): void { resultSubs.push(cb); },
  };
}

function remoteHub(link: Link): CrewHub {
  const tallySubs: Array<(t: Tally) => void> = [];
  const resultSubs: Array<(r: GateResult | null, id: string) => void> = [];
  let queue: CrewEvent[] = [];
  let timer = 0;
  link.onRelay((m) => {
    if (m.t === 'tally') for (const f of tallySubs) f(m.x as Tally);
    else if (m.t === 'result') for (const f of resultSubs) f((m.r as GateResult | null) ?? null, String(m.attemptId));
  });
  return {
    remote: true,
    use(): void { /* the room keeps its own players */ },
    cmd(c): void {
      // queued chat answers must land before the lock that ends the question
      if (queue.length) { clearTimeout(timer); timer = 0; link.relay({ t: 'inject', events: queue.splice(0) }); }
      link.relay({ t: 'cmd', c });
    },
    inject(e): void {
      queue.push(e);
      timer ||= window.setTimeout(() => { timer = 0; while (queue.length) link.relay({ t: 'inject', events: queue.splice(0, 2000) }); }, INJECT_MS);
    },
    fromPhone(): void { /* phones talk to the relay */ },
    onTally(cb): void { tallySubs.push(cb); },
    onResult(cb): void { resultSubs.push(cb); },
  };
}
