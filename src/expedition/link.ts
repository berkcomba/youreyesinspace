import type { HostToCrew, Wire } from './protocol';

/**
 * Transport between the cockpit and crew phones.
 *  - Production: the realtime relay (worker/), set with VITE_XP_SERVER (wss://…). Phones talk
 *    to room shards, the cockpit to the room, which also runs the crew ledger (engine.ts): the
 *    cockpit sends commands and gets summaries back over `relay` / `onRelay`.
 *  - Development without a relay: the Vite dev server forwards messages over its websocket
 *    (phones on the same network), plus a BroadcastChannel for tabs of one browser.
 */
export interface Link {
  send(w: Wire): void;
  on(cb: (w: Wire) => void): void;
  /** enter a room: the cockpit with its host token, a phone without */
  join(room: string, hostToken?: string): void;
  /** true when the relay server carries the messages (presence comes from it, no heartbeats) */
  readonly server: boolean;
  /** connection changes: phones learn their player id here; the cockpit hears 'taken' */
  onStatus(cb: (s: LinkStatus) => void): void;
  /** cockpit ⇄ relay room (ledger commands, tallies, results); unused without the relay */
  relay(m: object): void;
  onRelay(cb: (m: { t: string; [k: string]: unknown }) => void): void;
  /** phones: a solved Turnstile token, after a 'challenge' status */
  solve(token: string): void;
}

export type LinkStatus =
  | { kind: 'open' }
  | { kind: 'closed' }
  | { kind: 'id'; pid: string }
  | { kind: 'full' }
  | { kind: 'taken' }
  /** a new phone must prove it is a person (Turnstile) before the relay gives it an id */
  | { kind: 'challenge' };

const SERVER = (import.meta.env.VITE_XP_SERVER as string | undefined)?.replace(/\/$/, '') ?? '';

export function openLink(role: 'host' | 'crew'): Link {
  return SERVER ? serverLink(role) : devLink();
}

/* ---------------- dev: Vite relay + BroadcastChannel ---------------- */

type Tagged = Wire & { id: string };

function devLink(): Link {
  const subs: Array<(w: Wire) => void> = [];
  const seen = new Set<string>();
  const deliver = (w: Tagged): void => {
    if (!w || seen.has(w.id)) return;
    seen.add(w.id);
    if (seen.size > 4000) seen.clear();
    for (const s of subs) s(w);
  };
  const bc = 'BroadcastChannel' in window ? new BroadcastChannel('yeis-expedition') : null;
  bc?.addEventListener('message', (e) => deliver(e.data as Tagged));
  const hot = import.meta.hot;
  hot?.on('xp:wire', (w: Tagged) => deliver(w));
  return {
    server: false,
    send(w: Wire): void {
      const t: Tagged = { ...w, id: crypto.randomUUID() };
      seen.add(t.id);
      bc?.postMessage(t);
      hot?.send('xp:wire', t);
    },
    on(cb): void { subs.push(cb); },
    join(): void { /* rooms are filtered by the receivers */ },
    onStatus(): void { /* always "open" */ },
    relay(): void { /* the cockpit runs the ledger itself */ },
    onRelay(): void { /* never called */ },
    solve(): void { /* no challenge without the relay */ },
  };
}

/* ---------------- production: realtime relay ---------------- */

const TOKEN_KEY = 'yeis.crew.token';

function serverLink(role: 'host' | 'crew'): Link {
  const subs: Array<(w: Wire) => void> = [];
  const relaySubs: Array<(m: { t: string; [k: string]: unknown }) => void> = [];
  const status: Array<(s: LinkStatus) => void> = [];
  const emit = (s: LinkStatus): void => { for (const f of status) f(s); };
  let room = '';
  let hostToken = '';
  let ws: WebSocket | null = null;
  let ready = false;
  let retry = 0;
  let retryTimer = 0;
  let stopped = false;
  const outbox: string[] = [];
  let challenge = '';

  const store = {
    get: (k: string): string => { try { return localStorage.getItem(k) ?? ''; } catch { return ''; } },
    set: (k: string, v: string): void => { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
  };

  const raw = (text: string): void => {
    if (ws && ready && ws.readyState === WebSocket.OPEN) ws.send(text);
    // phones: the hello/answer typed while connecting; cockpit: ledger commands during a blip
    else if (outbox.length < (role === 'host' ? 500 : 20)) outbox.push(text);
  };

  const connect = (): void => {
    clearTimeout(retryTimer);
    if (!room || stopped) return;
    const path = `${SERVER}/room/${encodeURIComponent(room)}/${role}`;
    const q = new URLSearchParams();
    if (role === 'crew' && store.get(TOKEN_KEY)) q.set('t', store.get(TOKEN_KEY));
    if (role === 'crew' && challenge) { q.set('ts', challenge); challenge = ''; }   // single use
    const sock = new WebSocket(q.size ? `${path}?${q}` : path);
    ws = sock;
    ready = false;
    let keepalive = 0;
    sock.onopen = (): void => {
      retry = 0;
      if (role === 'host') sock.send(JSON.stringify({ t: 'auth', token: hostToken }));
      keepalive = window.setInterval(() => { if (sock.readyState === WebSocket.OPEN) sock.send('ping'); }, 30_000);
    };
    sock.onmessage = (e): void => {
      if (sock !== ws || typeof e.data !== 'string' || e.data === 'pong') return;
      let m: { t: string; [k: string]: unknown };
      try { m = JSON.parse(e.data); } catch { return; }
      if (role === 'host') {
        if (m.t === 'ready') {
          ready = true;
          emit({ kind: 'open' });
          for (const text of outbox.splice(0)) sock.send(text);
          return;
        }
        for (const f of relaySubs) f(m);
        return;
      }
      if (m.t === 'id') {
        store.set(TOKEN_KEY, String(m.token));
        ready = true;
        emit({ kind: 'id', pid: String(m.pid) });
        emit({ kind: 'open' });
        for (const text of outbox.splice(0)) sock.send(text);
        return;
      }
      if (m.t === 'full') { emit({ kind: 'full' }); return; }
      if (m.t === 'state' || m.t === 'me') for (const s of subs) s({ from: 'host', msg: m as unknown as HostToCrew });
    };
    sock.onclose = (e): void => {
      clearInterval(keepalive);
      if (sock !== ws) return;
      ready = false;
      ws = null;
      emit({ kind: 'closed' });
      if (e.code === 4003) { emit({ kind: 'taken' }); return; }
      if (e.code === 4401) { emit({ kind: 'challenge' }); return; }
      if (e.code === 4009 || e.code === 1013) { if (e.code === 1013) emit({ kind: 'full' }); return; }
      // jittered backoff, so 20,000 phones do not all reconnect in the same second
      const wait = Math.min(15_000, 1000 * 2 ** retry++) * (0.5 + Math.random());
      retryTimer = window.setTimeout(connect, wait);
    };
  };

  return {
    server: true,
    send(w: Wire): void {
      const m = w.msg;
      if (role === 'host') {
        // a stale screen is useless after a blip: the next one replaces it
        if (m.t === 'state' && ws && ready) ws.send(JSON.stringify({ t: 'state', s: m.s }));
        return;
      }
      if (m.t === 'hello') raw(JSON.stringify({ t: 'hello', nick: m.nick }));
      else if (m.t === 'vote') raw(JSON.stringify({ t: 'vote', voteId: m.voteId, nodeId: m.nodeId }));
      else if (m.t === 'answer') raw(JSON.stringify({ t: 'answer', attemptId: m.attemptId, choiceId: m.choiceId }));
    },
    on(cb): void { subs.push(cb); },
    onStatus(cb): void { status.push(cb); },
    relay(m: object): void { if (role === 'host') raw(JSON.stringify(m)); },
    onRelay(cb): void { relaySubs.push(cb); },
    solve(token: string): void {
      challenge = token;
      retry = 0;
      if (!ws) connect();
    },
    join(r: string, token?: string): void {
      if (r === room && (token ?? '') === hostToken && ws) return;
      room = r;
      hostToken = token ?? '';
      stopped = false;
      retry = 0;
      outbox.length = 0;
      const old = ws;
      ws = null;
      old?.close(1000);
      connect();
    },
  };
}
