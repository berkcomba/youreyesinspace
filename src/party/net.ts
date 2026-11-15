import { CLOSE, type ClientMsg, type Mode, type RoomInfo, type ServerMsg } from './protocol';

/**
 * Transport to the multiplayer relay (worker/src/party.ts): the same worker as the expedition,
 * set with VITE_XP_SERVER; in development without it, a local `wrangler dev` on port 8787.
 */
const XP = (import.meta.env.VITE_XP_SERVER as string | undefined)?.replace(/\/$/, '') ?? '';
const WS_BASE = XP || (import.meta.env.DEV ? `ws://${location.hostname}:8787` : '');
const HTTP_BASE = WS_BASE.replace(/^ws/, 'http');

export const partyAvailable = WS_BASE !== '';
export const shotUrl = (path: string): string => (/^https?:/.test(path) ? path : `${HTTP_BASE}${path}`);

/* the signed player id is shared with the expedition's crew page (same relay, same secret) */
const TOKEN_KEY = 'yeis.crew.token';
const KEYS_KEY = 'yeis.party.keys';

export const store = {
  get: (k: string): string => { try { return localStorage.getItem(k) ?? ''; } catch { return ''; } },
  set: (k: string, v: string): void => { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
};

async function call<T>(path: string, init?: RequestInit): Promise<{ status: number; body: T | null }> {
  try {
    const r = await fetch(`${HTTP_BASE}${path}`, init);
    let body: T | null = null;
    try { body = (await r.json()) as T; } catch { /* empty or not JSON */ }
    return { status: r.status, body };
  } catch {
    return { status: 0, body: null };
  }
}

const post = <T>(path: string, data: unknown) => call<T>(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });

/** Make sure we hold a signed player id; 'challenge' = a Turnstile token is needed (pass it as `ts`) */
export async function ensureId(ts?: string): Promise<'ok' | 'challenge' | 'error'> {
  const r = await post<{ pid?: string; token?: string; challenge?: boolean }>('/party/id', { t: store.get(TOKEN_KEY) || undefined, ts });
  if (r.status === 200 && r.body?.token) { store.set(TOKEN_KEY, r.body.token); return 'ok'; }
  return r.status === 401 ? 'challenge' : 'error';
}

export async function listRooms(): Promise<RoomInfo[] | null> {
  const r = await call<{ rooms: RoomInfo[] }>('/party/rooms');
  return r.status === 200 && r.body ? r.body.rooms : null;
}

export async function roomInfo(code: string): Promise<RoomInfo | null | 'error'> {
  const r = await call<RoomInfo>(`/party/room/${encodeURIComponent(code)}`);
  if (r.status === 200 && r.body) return r.body;
  return r.status === 404 ? null : 'error';
}

export async function createRoom(o: { name: string; pass: string; max: number; listed: boolean; mode: Mode }): Promise<{ code: string } | { error: 'challenge' | 'busy' | 'name' | 'error' }> {
  const r = await post<{ code?: string; key?: string; error?: string; challenge?: boolean }>('/party/create', { ...o, t: store.get(TOKEN_KEY) });
  if (r.status === 200 && r.body?.code && r.body.key) {
    saveKey(r.body.code, r.body.key);
    return { code: r.body.code };
  }
  if (r.status === 401) return { error: 'challenge' };
  if (r.status === 429 || r.status === 503) return { error: 'busy' };
  return { error: r.body?.error === 'name' ? 'name' : 'error' };
}

export async function uploadShot(code: string, blob: Blob): Promise<{ id: string; url: string } | { error: string }> {
  const r = await call<{ id?: string; url?: string; error?: string }>(`/party/room/${code}/shot?t=${encodeURIComponent(store.get(TOKEN_KEY))}`, {
    method: 'PUT', headers: { 'Content-Type': blob.type }, body: blob,
  });
  if (r.status === 200 && r.body?.id && r.body.url) return { id: r.body.id, url: r.body.url };
  return { error: r.body?.error ?? (r.status === 0 ? 'network' : 'error') };
}

/** owner keys of the rooms this browser created (the key brings the owner's rights back after a reload) */
function keys(): Record<string, string> {
  try { return JSON.parse(store.get(KEYS_KEY) || '{}') as Record<string, string>; } catch { return {}; }
}
function saveKey(code: string, key: string): void {
  const all = keys();
  all[code] = key;
  // the newest few are enough
  store.set(KEYS_KEY, JSON.stringify(Object.fromEntries(Object.entries(all).slice(-20))));
}
export const keyOf = (code: string): string | undefined => keys()[code];

export type PartyStatus = 'connecting' | 'open' | 'closed' | 'password' | 'gone' | 'kicked' | 'full' | 'challenge' | 'replaced';
const TERMINAL: Record<number, PartyStatus> = {
  [CLOSE.password]: 'password', [CLOSE.gone]: 'gone', [CLOSE.kicked]: 'kicked', [CLOSE.full]: 'full', [CLOSE.challenge]: 'challenge', [CLOSE.replaced]: 'replaced',
};

/** One room's socket: says hello on every (re)connect, reconnects with backoff until a terminal close. */
export class PartySocket {
  private ws: WebSocket | null = null;
  private retry = 0;
  private retryTimer = 0;
  private keepalive = 0;
  private stopped = false;
  onMessage: (m: ServerMsg) => void = () => {};
  onStatus: (s: PartyStatus) => void = () => {};

  constructor(readonly code: string, private readonly hello: () => ClientMsg) {
    this.connect();
  }

  send(m: ClientMsg): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(m));
  }

  get open(): boolean { return this.ws?.readyState === WebSocket.OPEN; }

  close(): void {
    this.stopped = true;
    clearTimeout(this.retryTimer);
    clearInterval(this.keepalive);
    this.ws?.close(1000);
    this.ws = null;
  }

  private connect(): void {
    if (this.stopped) return;
    this.onStatus('connecting');
    const sock = new WebSocket(`${WS_BASE}/party/room/${encodeURIComponent(this.code)}/ws?t=${encodeURIComponent(store.get(TOKEN_KEY))}`);
    this.ws = sock;
    sock.onopen = (): void => {
      this.retry = 0;
      sock.send(JSON.stringify(this.hello()));
      clearInterval(this.keepalive);
      this.keepalive = window.setInterval(() => { if (sock.readyState === WebSocket.OPEN) sock.send('ping'); }, 30_000);
    };
    sock.onmessage = (e): void => {
      if (sock !== this.ws || typeof e.data !== 'string' || e.data === 'pong') return;
      let m: ServerMsg;
      try { m = JSON.parse(e.data) as ServerMsg; } catch { return; }
      if (m.t === 'welcome') this.onStatus('open');
      this.onMessage(m);
    };
    sock.onclose = (e): void => {
      if (sock !== this.ws) return;
      clearInterval(this.keepalive);
      this.ws = null;
      const terminal = TERMINAL[e.code];
      if (terminal || this.stopped) { this.stopped = true; this.onStatus(terminal ?? 'closed'); return; }
      this.onStatus('closed');
      const wait = Math.min(15_000, 1000 * 2 ** this.retry++) * (0.5 + Math.random());
      this.retryTimer = window.setTimeout(() => this.connect(), wait);
    };
  }
}
