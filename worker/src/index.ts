/**
 * Streamer Mode realtime relay (The Great Expedition).
 *
 *   phones ──ws──▶ Shard ×32 per room ──batches every 200 ms──▶ Room ──ws──▶ streamer cockpit
 *   phones ◀──── state + per-player results, routed back the same way ◀───────
 *
 * The cockpit runs the show (questions, flights, the campaign); the room runs the crew ledger
 * (src/expedition/engine.ts: players, answers, points, ranks), so the streamer's browser only
 * handles summaries however big the crew. Every rule is enforced here rather than trusted from a
 * client: the code is open source, so assume anyone can speak the protocol.
 *  - The host proves itself with a secret token whose hash claims the room on first use.
 *  - A phone's player id is minted here and signed (HMAC, CREW_SECRET), so nobody can act
 *    under someone else's id; ids sent by clients are ignored.
 *  - Phones can only send hello / vote / answer, size- and rate-limited per socket.
 *  - Answer timing is measured on arrival here, never taken from the phone.
 *  - A new player id needs a Turnstile pass (when TURNSTILE_SECRET is set), so scripted crowds
 *    cost a solved challenge per fake player.
 */
import { DurableObject } from 'cloudflare:workers';
import { Ledger, isTrustedPid, type CrewEvent, type CrewRecord, type LedgerCmd, type MeMsg } from '../../src/expedition/engine';

export interface Env {
  ROOM: DurableObjectNamespace<Room>;
  SHARD: DurableObjectNamespace<Shard>;
  CREW_SECRET: string;
  /** optional: without it new players are not challenged (local development, forks) */
  TURNSTILE_SECRET?: string;
  ALLOWED_ORIGINS: string;
}

const SHARDS = 32;
/** 32 × 800 ≈ 25k phones per room: also the cost ceiling of a single stream */
const SHARD_CAP = 800;
const FLUSH_MS = 200;
const MAX_CREW_MSG = 512;
/** cockpit → room: per-gate summaries go the other way, at most this often */
const TALLY_MS = 250;
const SAVE_EVERY = 8;   // ticks
/** per phone: sustained messages per second, and the burst allowance */
const RATE = 2;
const BURST = 10;
const OPEN = 1;
const ID_RE = /^[A-Za-z0-9_-]{1,48}$/;
const isId = (x: unknown): x is string => typeof x === 'string' && ID_RE.test(x);

function shardOf(pid: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < pid.length; i++) h = Math.imul(h ^ pid.charCodeAt(i), 0x01000193);
  return (h >>> 0) % SHARDS;
}

const hex = (b: ArrayBuffer | Uint8Array): string => Array.from(new Uint8Array(b), (x) => x.toString(16).padStart(2, '0')).join('');
const b64url = (b: ArrayBuffer): string => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

function sameString(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

async function sha256(text: string): Promise<string> {
  return hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));
}

/* ---------------- crew identity ---------------- */

let keyCache: { secret: string; key: Promise<CryptoKey> } | null = null;

function hmacKey(secret: string): Promise<CryptoKey> {
  if (keyCache?.secret !== secret) {
    keyCache = { secret, key: crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']) };
  }
  return keyCache.key;
}

async function signPid(env: Env, pid: string): Promise<string> {
  const mac = await crypto.subtle.sign('HMAC', await hmacKey(env.CREW_SECRET), new TextEncoder().encode(`crew:${pid}`));
  return b64url(mac.slice(0, 16));
}

/** A valid `pid.signature` token keeps its id; a fresh one needs a solved challenge. */
async function identify(env: Env, token: string | null, challenge: string | null, ip: string): Promise<{ pid: string; token: string } | null> {
  const m = token?.match(/^([a-f0-9]{24})\.([A-Za-z0-9_-]{22})$/);
  if (m && sameString(await signPid(env, m[1]), m[2])) return { pid: m[1], token: token! };
  if (env.TURNSTILE_SECRET && !(await turnstileOk(env.TURNSTILE_SECRET, challenge, ip))) return null;
  const pid = hex(crypto.getRandomValues(new Uint8Array(12)));
  return { pid, token: `${pid}.${await signPid(env, pid)}` };
}

async function turnstileOk(secret: string, response: string | null, ip: string): Promise<boolean> {
  if (!response || response.length > 2048) return false;
  const body = new FormData();
  body.append('secret', secret);
  body.append('response', response);
  if (ip) body.append('remoteip', ip);
  try {
    const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body });
    return ((await r.json()) as { success?: boolean }).success === true;
  } catch {
    return false;
  }
}

/** Refuse a phone with a reason it can act on: a WebSocket close code (HTTP errors are opaque to browsers). */
function refuse(code: number, reason: string): Response {
  const [client, server] = Object.values(new WebSocketPair());
  server.accept();
  server.close(code, reason);
  return new Response(null, { status: 101, webSocket: client });
}

function originAllowed(env: Env, origin: string | null): boolean {
  if (!origin) return false;
  return env.ALLOWED_ORIGINS.split(',').map((s) => s.trim()).some((p) => (p.endsWith('*') ? origin.startsWith(p.slice(0, -1)) : origin === p));
}

function cleanNick(x: unknown): string {
  return String(x ?? '').normalize('NFKC').replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2066-\u2069]/g, '').trim().slice(0, 20);
}

/* ---------------- entry ---------------- */

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname === '/health') return new Response('ok');
    const kick = url.pathname.match(/^\/kick\/([A-Za-z0-9_-]{1,40})$/);
    if (kick) return kickChatroom(env, req, kick[1]);
    if (url.pathname === '/yt/start' || url.pathname === '/yt/poll') return youtubeChat(env, req, url);
    const m = url.pathname.match(/^\/room\/([A-Za-z0-9]{4,8})\/(host|crew)$/);
    if (!m) return new Response('Not found', { status: 404 });
    if (req.headers.get('Upgrade')?.toLowerCase() !== 'websocket') return new Response('Expected a WebSocket', { status: 426 });
    if (!originAllowed(env, req.headers.get('Origin'))) return new Response('Forbidden origin', { status: 403 });
    if (!env.CREW_SECRET || env.CREW_SECRET.length < 32) return new Response('Relay not configured', { status: 503 });
    const code = m[1].toUpperCase();
    // fresh headers: nothing a client sends in X-* can reach the objects
    if (m[2] === 'host') {
      return env.ROOM.get(env.ROOM.idFromName(code)).fetch(new Request(url.toString(), { headers: { Upgrade: 'websocket', 'X-Room': code } }));
    }
    const who = await identify(env, url.searchParams.get('t'), url.searchParams.get('ts'), req.headers.get('CF-Connecting-IP') ?? '');
    if (!who) return refuse(4401, 'challenge required');
    const { pid, token } = who;
    const shard = shardOf(pid);
    return env.SHARD.get(env.SHARD.idFromName(`${code}#${shard}`)).fetch(new Request(url.toString(), {
      headers: { Upgrade: 'websocket', 'X-Room': code, 'X-Pid': pid, 'X-Token': token, 'X-Shard': String(shard) },
    }));
  },
} satisfies ExportedHandler<Env>;

/**
 * Kick chat is read over its public Pusher socket, which needs the channel's chatroom id;
 * kick.com does not allow browsers to look it up cross-origin, so the cockpit asks here.
 */
async function kickChatroom(env: Env, req: Request, slug: string): Promise<Response> {
  const origin = req.headers.get('Origin');
  if (!originAllowed(env, origin)) return new Response('Forbidden origin', { status: 403 });
  const headers = { 'Access-Control-Allow-Origin': origin!, 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=3600', Vary: 'Origin' };
  const cache = caches.default;
  const key = new Request(`https://kick-cache.invalid/${slug.toLowerCase()}`);
  const hit = await cache.match(key);
  if (hit) return new Response(hit.body, { headers });
  const r = await fetch(`https://kick.com/api/v2/channels/${slug}`, { headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0 (YourEyesInSpace expedition relay)' } });
  if (!r.ok) return new Response(JSON.stringify({ error: r.status === 404 ? 'No such Kick channel' : 'Kick did not answer' }), { status: r.status === 404 ? 404 : 502, headers });
  const id = ((await r.json()) as { chatroom?: { id?: number } }).chatroom?.id;
  if (typeof id !== 'number') return new Response(JSON.stringify({ error: 'No chatroom for this channel' }), { status: 404, headers });
  // Kick hands its web client the realtime credentials; they rotate, so ask rather than hard-code
  let appKey = '', cluster = 'us2';
  try {
    const c = await fetch('https://web.kick.com/api/v1/realtime/connection', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ client: { id: 'yeis-relay', type: 'web' }, capabilities: { accepted_providers: [{ provider: 'pusher' }] } }),
    });
    const j = (await c.json()) as { data?: { connections?: Array<{ provider?: string; credentials?: { app_key?: string; cluster?: string } }> } };
    const p = j.data?.connections?.find((x) => x.provider === 'pusher')?.credentials;
    if (p?.app_key && /^[a-f0-9]{10,40}$/.test(p.app_key)) { appKey = p.app_key; cluster = /^[a-z0-9]{2,8}$/.test(p.cluster ?? '') ? p.cluster! : 'us2'; }
  } catch { /* the cockpit reports chat as unavailable */ }
  if (!appKey) return new Response(JSON.stringify({ error: 'Kick chat is unavailable right now' }), { status: 502, headers });
  const body = JSON.stringify({ chatroomId: id, appKey, cluster });
  await cache.put(key, new Response(body, { headers: { 'Cache-Control': 'public, max-age=21600' } }));
  return new Response(body, { headers });
}

/**
 * YouTube live chat has no public socket and its Data API quota runs out within a stream, so
 * the cockpit polls the chat the way youtube.com's own chat frame does, through here (YouTube
 * does not allow it cross-origin). Stateless: the cockpit carries the continuation token.
 *   /yt/start?ref=@handle | channel URL | video URL or id → { videoId, k, v, c }
 *   /yt/poll?k=…&v=…&c=… → { lines, c, wait }
 */
const YT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36',
  'Accept-Language': 'en-US,en;q=0.9',
  Cookie: 'SOCS=CAI; CONSENT=YES+1',
};

async function youtubeChat(env: Env, req: Request, url: URL): Promise<Response> {
  const origin = req.headers.get('Origin');
  if (!originAllowed(env, origin)) return new Response('Forbidden origin', { status: 403 });
  const headers = { 'Access-Control-Allow-Origin': origin!, 'Content-Type': 'application/json', 'Cache-Control': 'no-store', Vary: 'Origin' };
  const reply = (body: unknown, status = 200): Response => new Response(JSON.stringify(body), { status, headers });
  try {
    if (url.pathname === '/yt/start') {
      const ref = (url.searchParams.get('ref') ?? '').trim().slice(0, 200);
      let videoId = ref.match(/(?:v=|youtu\.be\/|\/live\/|\/shorts\/)([\w-]{11})/)?.[1] ?? (/^[\w-]{11}$/.test(ref) && !ref.startsWith('@') ? ref : '');
      if (!videoId) {
        const path = ref.match(/youtube\.com\/((?:@[\w.-]{1,100})|(?:channel\/UC[\w-]{22})|(?:c\/[\w.-]{1,100}))/)?.[1]
          ?? (/^@[\w.-]{1,100}$/.test(ref) ? ref : /^UC[\w-]{22}$/.test(ref) ? `channel/${ref}` : /^[\w.-]{1,100}$/.test(ref) ? `@${ref}` : '');
        if (!path) return reply({ error: 'Not a YouTube channel or video' }, 400);
        const r = await fetch(`https://www.youtube.com/${path}/live`, { headers: YT_HEADERS });
        if (r.status === 404) return reply({ error: 'No such YouTube channel' }, 404);
        const html = await r.text();
        videoId = html.match(/<link rel="canonical" href="https:\/\/www\.youtube\.com\/watch\?v=([\w-]{11})"/)?.[1] ?? '';
        if (!videoId || !/"isLive":true/.test(html)) return reply({ error: 'Not live right now' }, 404);
      }
      const html = await (await fetch(`https://www.youtube.com/live_chat?v=${videoId}&is_popout=1`, { headers: YT_HEADERS })).text();
      const k = html.match(/"INNERTUBE_API_KEY":"([\w-]{20,60})"/)?.[1];
      const v = html.match(/"INNERTUBE_CONTEXT_CLIENT_VERSION":"([\d.]{6,30})"/)?.[1];
      // "Live chat" (every message), not the default "Top chat" (filtered)
      const all = html.match(/"title":"Live chat","selected":(?:true|false),"continuation":\{"reloadContinuationData":\{"continuation":"([\w%-]+)"/)?.[1]
        ?? html.match(/"continuation":"([\w%-]{10,})"/)?.[1];
      if (!k || !v || !all) return reply({ error: 'Live chat is off for this stream' }, 404);
      return reply({ videoId, k, v, c: all });
    }
    const k = url.searchParams.get('k') ?? '', v = url.searchParams.get('v') ?? '', c = url.searchParams.get('c') ?? '';
    if (!/^[\w-]{20,60}$/.test(k) || !/^[\d.]{6,30}$/.test(v) || !/^[\w%-]{10,3000}$/.test(c)) return reply({ error: 'Bad request' }, 400);
    const r = await fetch(`https://www.youtube.com/youtubei/v1/live_chat/get_live_chat?key=${k}&prettyPrint=false`, {
      method: 'POST',
      headers: { ...YT_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ context: { client: { clientName: 'WEB', clientVersion: v } }, continuation: c }),
    });
    if (!r.ok) return reply({ error: `YouTube answered ${r.status}` }, 502);
    type Run = { text?: string };
    type Msg = { id?: string; authorName?: { simpleText?: string }; authorExternalChannelId?: string; message?: { runs?: Run[] } };
    type Cont = { continuation?: string; timeoutMs?: number };
    const j = (await r.json()) as { continuationContents?: { liveChatContinuation?: {
      actions?: Array<{ addChatItemAction?: { item?: { liveChatTextMessageRenderer?: Msg } } }>;
      continuations?: Array<{ invalidationContinuationData?: Cont; timedContinuationData?: Cont; reloadContinuationData?: Cont }>;
    } } };
    const lcc = j.continuationContents?.liveChatContinuation;
    if (!lcc) return reply({ error: 'The stream has ended' }, 410);
    const lines = (lcc.actions ?? []).flatMap((a) => {
      const m = a.addChatItemAction?.item?.liveChatTextMessageRenderer;
      if (!m?.authorExternalChannelId) return [];
      return [{ ch: m.authorExternalChannelId, nick: cleanNick((m.authorName?.simpleText ?? '').replace(/^@/, '')) || 'YouTube viewer', text: (m.message?.runs ?? []).map((x) => x.text ?? '').join('').slice(0, 200) }];
    });
    const next = lcc.continuations?.[0];
    const d = next?.invalidationContinuationData ?? next?.timedContinuationData ?? next?.reloadContinuationData;
    if (!d?.continuation) return reply({ error: 'The stream has ended' }, 410);
    return reply({ lines, c: d.continuation, wait: Math.max(1000, Math.min(10_000, d.timeoutMs ?? 3000)) });
  } catch {
    return reply({ error: 'YouTube did not answer' }, 502);
  }
}

/* ---------------- events (shard → room) ---------------- */

type Queued = Exclude<CrewEvent, { t: 'answer' }> | { t: 'answer'; pid: string; attemptId: string; choiceId: string; at: number };

/* ---------------- Room: one per room code, holds the cockpit socket and the crew ledger ---------------- */

interface HostAtt { authed: boolean; since: number }

interface Row { pid: string; nick: string; points: number; answered: number; correct: number; award: string | null; first: number; last: number; [k: string]: SqlStorageValue }

export class Room extends DurableObject<Env> {
  private code = '';
  private state: string | null = null;
  private shards = new Set<number>();
  private records: Record<string, CrewRecord> = {};
  private ledger: Ledger;
  private unsaved = new Set<string>();
  private outbox = new Map<number, Array<[string, string]>>();
  private outTimer: ReturnType<typeof setTimeout> | null = null;
  private ticker: ReturnType<typeof setInterval> | null = null;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private ticks = 0;
  private rosterLoaded = false;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
    const sql = ctx.storage.sql;
    sql.exec('CREATE TABLE IF NOT EXISTS crew (pid TEXT PRIMARY KEY, nick TEXT NOT NULL, points INTEGER NOT NULL, answered INTEGER NOT NULL, correct INTEGER NOT NULL, award TEXT, first INTEGER NOT NULL, last INTEGER NOT NULL)');
    for (const r of sql.exec<Row>('SELECT * FROM crew')) {
      this.records[r.pid] = { nick: r.nick, points: r.points, answered: r.answered, correct: r.correct, award: r.award ?? undefined, firstSeen: r.first, lastSeen: r.last };
    }
    this.ledger = new Ledger(this.records, true, (m) => this.toPhone(m), (pid) => this.unsaved.add(pid));
    void ctx.blockConcurrencyWhile(async () => {
      this.code = (await ctx.storage.get<string>('code')) ?? '';
      this.shards = new Set((await ctx.storage.get<number[]>('shards')) ?? []);
    });
  }

  async fetch(req: Request): Promise<Response> {
    const code = req.headers.get('X-Room') ?? '';
    if (this.code !== code) { this.code = code; await this.ctx.storage.put('code', code); }
    if (this.ctx.getWebSockets('host').length >= 8) return new Response('Too many host connections', { status: 429 });
    const [client, server] = Object.values(new WebSocketPair());
    this.ctx.acceptWebSocket(server, ['host']);
    server.serializeAttachment({ authed: false, since: Date.now() } satisfies HostAtt);
    // a socket that never authenticates is dropped (see alarm)
    await this.ctx.storage.setAlarm(Date.now() + 10_000);
    return new Response(null, { status: 101, webSocket: client });
  }

  async alarm(): Promise<void> {
    for (const ws of this.ctx.getWebSockets('host')) {
      const a = ws.deserializeAttachment() as HostAtt;
      if (!a.authed && Date.now() - a.since > 9_000) ws.close(4001, 'auth timeout');
    }
  }

  async webSocketMessage(ws: WebSocket, data: string | ArrayBuffer): Promise<void> {
    if (typeof data !== 'string') return ws.close(1003, 'text only');
    let m: { t?: string; token?: unknown; s?: unknown; c?: unknown; events?: unknown };
    try { m = JSON.parse(data); } catch { return ws.close(1007, 'bad json'); }
    const att = ws.deserializeAttachment() as HostAtt;
    if (!att.authed) {
      if (m.t !== 'auth' || typeof m.token !== 'string' || !/^[a-f0-9]{32,128}$/.test(m.token)) return ws.close(4001, 'auth required');
      const hash = await sha256(m.token);
      const stored = await this.ctx.storage.get<string>('tokenHash');
      if (stored && !sameString(stored, hash)) return ws.close(4003, 'room taken');
      if (!stored) await this.ctx.storage.put('tokenHash', hash);
      // one cockpit per room: a reload or a second tab takes over
      for (const other of this.hosts()) if (other !== ws) other.close(4009, 'replaced');
      ws.serializeAttachment({ authed: true, since: att.since } satisfies HostAtt);
      await this.loadRoster();
      ws.send(JSON.stringify({ t: 'ready' }));
      ws.send(JSON.stringify({ t: 'tally', x: this.ledger.tally() }));
      this.ticker ??= setInterval(() => this.tick(), TALLY_MS);
      return;
    }
    if (m.t === 'state' && m.s && typeof m.s === 'object') {
      this.state = JSON.stringify({ t: 'state', room: this.code, s: m.s });
      await Promise.all([...this.shards].map((k) => this.shard(k).deliver(this.state, [])));
    } else if (m.t === 'cmd' && m.c && typeof m.c === 'object') {
      const c = m.c as LedgerCmd;
      let r = null;
      try { r = this.ledger.cmd(c); } catch (err) { console.error('cmd failed', c.t, String(err)); }
      if (c.t === 'reveal') ws.send(JSON.stringify({ t: 'result', attemptId: c.attemptId, r }));
      this.flushOut();
    } else if (m.t === 'inject' && Array.isArray(m.events)) {
      // the cockpit vouches for its demo crew and chat, never for a phone
      for (const e of (m.events as CrewEvent[]).slice(0, 5000)) if (e && typeof e.pid === 'string' && isTrustedPid(e.pid) && e.pid.length <= 64) this.ledger.event(e);
    }
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string): Promise<void> {
    try { ws.close(code, reason); } catch { /* already closed */ }
    if (!this.hosts().length && this.ticker) { clearInterval(this.ticker); this.ticker = null; this.save(); }
  }

  /** RPC from a shard: crew events, plus how many phones it holds. */
  async ingest(shard: number, events: CrewEvent[], members: number): Promise<void> {
    const had = this.shards.has(shard);
    if (members > 0 && !had) this.shards.add(shard);
    if (members === 0 && had) this.shards.delete(shard);
    if (had !== this.shards.has(shard)) await this.ctx.storage.put('shards', [...this.shards]);
    await this.loadRoster();
    for (const e of events) if (!isTrustedPid(e.pid)) this.ledger.event(e);
    this.flushOut();
    if (!this.ticker) this.saveTimer ??= setTimeout(() => { this.saveTimer = null; this.save(); }, 2000);
  }

  /** RPC from a shard waking up with no state to show its first phone. */
  async latest(): Promise<string | null> {
    return this.state;
  }

  private tick(): void {
    if (this.ledger.dirty) {
      const msg = JSON.stringify({ t: 'tally', x: this.ledger.tally() });
      for (const ws of this.hosts()) ws.send(msg);
    }
    if (++this.ticks % SAVE_EVERY === 0) this.save();
  }

  private save(): void {
    if (!this.unsaved.size) return;
    const sql = this.ctx.storage.sql;
    const ids = [...this.unsaved];
    this.unsaved.clear();
    this.ctx.storage.transactionSync(() => {
      for (const pid of ids) {
        const r = this.records[pid];
        if (!r) sql.exec('DELETE FROM crew WHERE pid = ?', pid);
        else sql.exec('INSERT OR REPLACE INTO crew VALUES (?, ?, ?, ?, ?, ?, ?, ?)', pid, r.nick, r.points, r.answered, r.correct, r.award ?? null, r.firstSeen, r.lastSeen);
      }
    });
  }

  /** After a restart the ledger asks the shards who is still connected. */
  private async loadRoster(): Promise<void> {
    if (this.rosterLoaded) return;
    this.rosterLoaded = true;
    const lists = await Promise.all([...this.shards].map((k) => this.shard(k).roster().catch(() => [])));
    for (const e of lists.flat()) this.ledger.event(e);
    this.ledger.tally();   // nobody "joined": they were here all along
    this.flushOut();
  }

  private toPhone(m: MeMsg): void {
    if (isTrustedPid(m.pid)) return;
    const k = shardOf(m.pid);
    let list = this.outbox.get(k);
    if (!list) this.outbox.set(k, (list = []));
    list.push([m.pid, JSON.stringify({ ...m, t: 'me', room: this.code })]);
  }

  /** per-player messages go out in one call per shard */
  private flushOut(): void {
    if (this.outTimer || !this.outbox.size) return;
    this.outTimer = setTimeout(() => {
      this.outTimer = null;
      const batches = [...this.outbox];
      this.outbox.clear();
      for (const [k, list] of batches) this.shard(k).deliver(null, list).catch((err) => console.error('deliver failed', String(err)));
    }, 50);
  }

  private hosts(): WebSocket[] {
    return this.ctx.getWebSockets('host').filter((ws) => ws.readyState === OPEN && (ws.deserializeAttachment() as HostAtt).authed);
  }

  private shard(k: number): DurableObjectStub<Shard> {
    return this.env.SHARD.get(this.env.SHARD.idFromName(`${this.code}#${k}`));
  }
}

/* ---------------- Shard: up to SHARD_CAP phones of one room ---------------- */

interface CrewAtt { pid: string; nick: string; tokens: number; at: number; strikes: number }

export class Shard extends DurableObject<Env> {
  private code = '';
  private index = 0;
  private state: string | null = null;
  private queue: Queued[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
    void ctx.blockConcurrencyWhile(async () => {
      this.code = (await ctx.storage.get<string>('code')) ?? '';
      this.index = (await ctx.storage.get<number>('index')) ?? 0;
    });
  }

  async fetch(req: Request): Promise<Response> {
    const code = req.headers.get('X-Room') ?? '';
    const pid = req.headers.get('X-Pid') ?? '';
    const token = req.headers.get('X-Token') ?? '';
    if (this.code !== code) {
      this.code = code;
      this.index = Number(req.headers.get('X-Shard') ?? 0);
      await this.ctx.storage.put({ code, index: this.index });
    }
    const [client, server] = Object.values(new WebSocketPair());
    if (this.members() >= SHARD_CAP) {
      server.accept();
      server.send(JSON.stringify({ t: 'full' }));
      server.close(1013, 'room full');
      return new Response(null, { status: 101, webSocket: client });
    }
    // one socket per player: a second tab takes over
    for (const old of this.ctx.getWebSockets(pid)) old.close(4009, 'replaced');
    this.ctx.acceptWebSocket(server, [pid]);
    server.serializeAttachment({ pid, nick: '', tokens: BURST, at: Date.now(), strikes: 0 } satisfies CrewAtt);
    server.send(JSON.stringify({ t: 'id', pid, token }));
    if (!this.state) this.state = await this.room().latest();
    if (this.state) server.send(this.state);
    this.schedule();   // the room learns this shard has members
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, data: string | ArrayBuffer): Promise<void> {
    if (typeof data !== 'string' || data.length > MAX_CREW_MSG) return ws.close(1009, 'message too big');
    const a = ws.deserializeAttachment() as CrewAtt;
    const now = Date.now();
    a.tokens = Math.min(BURST, a.tokens + ((now - a.at) / 1000) * RATE);
    a.at = now;
    if (a.tokens < 1) {
      a.strikes++;
      ws.serializeAttachment(a);
      if (a.strikes > 30) ws.close(1008, 'rate limit');
      return;
    }
    a.tokens -= 1;
    let m: { t?: string; nick?: unknown; voteId?: unknown; nodeId?: unknown; attemptId?: unknown; choiceId?: unknown };
    try { m = JSON.parse(data); } catch { ws.serializeAttachment(a); return; }
    if (m.t === 'hello') {
      const nick = cleanNick(m.nick);
      if (nick) { a.nick = nick; this.push({ t: 'hello', pid: a.pid, nick }); }
    } else if (m.t === 'vote') {
      if (isId(m.voteId) && isId(m.nodeId)) this.push({ t: 'vote', pid: a.pid, voteId: m.voteId, nodeId: m.nodeId });
    } else if (m.t === 'answer') {
      if (isId(m.attemptId) && isId(m.choiceId)) this.push({ t: 'answer', pid: a.pid, attemptId: m.attemptId, choiceId: m.choiceId, at: now });
    }
    ws.serializeAttachment(a);
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string): Promise<void> {
    try { ws.close(code, reason); } catch { /* already closed */ }
    this.left(ws);
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    this.left(ws);
  }

  /** RPC from the room: a new public state for everyone, and/or per-player messages. */
  async deliver(state: string | null, list: Array<[string, string]>): Promise<void> {
    if (state) {
      this.state = state;
      for (const ws of this.ctx.getWebSockets()) if (ws.readyState === OPEN) ws.send(state);
    }
    for (const [pid, msg] of list) for (const ws of this.ctx.getWebSockets(pid)) if (ws.readyState === OPEN) ws.send(msg);
  }

  /** RPC from the room: everyone here who has said hello. */
  async roster(): Promise<CrewEvent[]> {
    return this.ctx.getWebSockets()
      .filter((ws) => ws.readyState === OPEN)
      .map((ws) => ws.deserializeAttachment() as CrewAtt)
      .filter((a) => a.nick)
      .map((a) => ({ t: 'hello', pid: a.pid, nick: a.nick }));
  }

  private left(ws: WebSocket): void {
    const a = ws.deserializeAttachment() as CrewAtt | null;
    if (!a) return;
    // a takeover by the same player's new tab is not a departure
    const still = this.ctx.getWebSockets(a.pid).some((w) => w !== ws && w.readyState === OPEN);
    if (!still && a.nick) this.push({ t: 'bye', pid: a.pid });
    else this.schedule();
  }

  private members(): number {
    return this.ctx.getWebSockets().filter((ws) => ws.readyState === OPEN).length;
  }

  private push(e: Queued): void {
    if (this.queue.length < 20_000) this.queue.push(e);
    this.schedule();
  }

  private schedule(): void {
    this.timer ??= setTimeout(() => void this.flush(), FLUSH_MS);
  }

  private async flush(): Promise<void> {
    this.timer = null;
    const now = Date.now();
    const events: CrewEvent[] = this.queue.splice(0).map((e) => (e.t === 'answer' ? { t: 'answer', pid: e.pid, attemptId: e.attemptId, choiceId: e.choiceId, age: now - e.at } : e));
    try {
      await this.room().ingest(this.index, events, this.members());
    } catch (err) {
      console.error('ingest failed', String(err));
    }
  }

  private room(): DurableObjectStub<Room> {
    return this.env.ROOM.get(this.env.ROOM.idFromName(this.code));
  }
}
