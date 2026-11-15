/**
 * Multiplayer rooms ("parties"): up to 16 explorers fly the same universe together.
 *
 *   browser ──REST──▶ /party/rooms, /party/id, /party/create, /party/room/{CODE}
 *   browser ──ws────▶ /party/room/{CODE}/ws ──▶ Party (one object per room)
 *   browser ──PUT───▶ /party/room/{CODE}/shot ──▶ Party ──▶ R2 (SHOTS)
 *   Party ──RPC──▶ Lobby (the public room list)
 *
 * The universe is deterministic, so a room only relays where everyone is, the shared clock and
 * its events (chat, screenshots, votes). Same rules as the expedition relay: ids are minted and
 * signed here, everything a client sends is validated and rate limited, the owner's rights come
 * from a key only the creator was given.
 */
import { DurableObject } from 'cloudflare:workers';
import {
  BEACON_KM, CATCH_KM, CHAT_KEEP, CLOSE, EMOTES, HIDE_MS, HUNT_MS, HUNT_TARGETS, MAX_CHAT, MAX_MSG, MAX_ROOM_NAME, MAX_SHOT_BYTES, MAX_TITLE, PARTY_COLORS, PARTY_MAX, SEEK_MS, SHOTS_KEEP, VOTE_MS,
  cleanText, isAvatar, isMode, maskBad, validPlace, validPose,
  type AvatarId, type ChatLine, type Clock, type Emote, type Hide, type HideHint, type Hunt, type Member, type Mode, type Pose, type RoomInfo, type ServerMsg, type Shot, type Vote,
} from '../../src/party/protocol';
import { hex, identify, originAllowed, refuse, sameString, sha256, signPid, type Env } from './index';

const OPEN = 1;
const CODE_RE = /^[A-Z2-9]{6}$/;
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
/** an empty room is kept this long (a reload, a dropped connection), then forgotten */
const EMPTY_MS = 15 * 60_000;
const POSE_FLUSH_MS = 100;
/** poses: sustained per second and burst; everything else shares a slower bucket */
const POSE_RATE = 15, POSE_BURST = 30;
const MSG_RATE = 3, MSG_BURST = 8;
const SHOT_GAP_MS = 5_000;
const SHOT_ID_RE = /^[a-f0-9]{24}\.(jpg|webp)$/;
const VOTE_GAP_MS = 20_000;
/** rooms one player may open per hour, and the most the lobby keeps at once */
const CREATE_PER_HOUR = 6;
const MAX_ROOMS = 3000;
const PARSEC_KM = 3.0856775814913673e13;
const LY_PER_PC = 3.261563777;
/** hide and seek: the hints, by seconds into the search */
const HINTS: Array<[number, HideHint['kind']]> = [[90, 'ly'], [180, 'dir'], [300, 'spectral'], [420, 'star']];
const HEAT_MS = 1000;

const verifyToken = async (env: Env, token: string | null): Promise<string | null> => {
  const m = token?.match(/^([a-f0-9]{24})\.([A-Za-z0-9_-]{22})$/);
  return m && sameString(await signPid(env, m[1]), m[2]) ? m[1] : null;
};

const randomCode = (): string => Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');

function cors(origin: string | null, env: Env): Record<string, string> {
  return origin && originAllowed(env, origin)
    ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'GET, POST, PUT', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '600', Vary: 'Origin' }
    : { Vary: 'Origin' };
}

const json = (body: unknown, status: number, headers: Record<string, string>): Response =>
  new Response(JSON.stringify(body), { status, headers: { ...headers, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

async function body(req: Request): Promise<Record<string, unknown>> {
  const text = await req.text();
  if (text.length > 4096) return {};
  try { const v = JSON.parse(text); return v && typeof v === 'object' ? v : {}; } catch { return {}; }
}

/* ---------------- entry ---------------- */

export async function partyRoute(env: Env, req: Request, url: URL): Promise<Response> {
  const origin = req.headers.get('Origin');
  const h = cors(origin, env);
  const path = url.pathname;

  // screenshots are public by link (shared in chat, kept after the room closes)
  const shot = path.match(/^\/party\/shot\/([A-Z2-9]{6})\/([a-f0-9]{24})\.(jpg|webp)$/);
  if (shot && req.method === 'GET') {
    const obj = await env.SHOTS.get(`party/${shot[1]}/${shot[2]}.${shot[3]}`);
    if (!obj) return new Response('Not found', { status: 404 });
    return new Response(obj.body, {
      headers: {
        'Content-Type': shot[3] === 'jpg' ? 'image/jpeg' : 'image/webp',
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Cross-Origin-Resource-Policy': 'cross-origin',
        'Access-Control-Allow-Origin': '*',
        ETag: obj.httpEtag,
      },
    });
  }

  if (req.method === 'OPTIONS') return new Response(null, { status: originAllowed(env, origin) ? 204 : 403, headers: h });
  if (!originAllowed(env, origin)) return new Response('Forbidden origin', { status: 403 });
  if (!env.CREW_SECRET || env.CREW_SECRET.length < 32) return new Response('Relay not configured', { status: 503 });
  const ip = req.headers.get('CF-Connecting-IP') ?? '';
  const lobby = env.LOBBY.get(env.LOBBY.idFromName('lobby'));

  if (path === '/party/rooms' && req.method === 'GET') return json({ rooms: await lobby.list() }, 200, h);

  // a signed player id: kept with a valid token, a new one needs a solved challenge
  if (path === '/party/id' && req.method === 'POST') {
    const b = await body(req);
    const who = await identify(env, typeof b.t === 'string' ? b.t : null, typeof b.ts === 'string' ? b.ts : null, ip);
    return who ? json(who, 200, h) : json({ challenge: true }, 401, h);
  }

  if (path === '/party/create' && req.method === 'POST') {
    const b = await body(req);
    const pid = await verifyToken(env, typeof b.t === 'string' ? b.t : null);
    if (!pid) return json({ challenge: true }, 401, h);
    const name = maskBad(cleanText(b.name, MAX_ROOM_NAME));
    const pass = typeof b.pass === 'string' ? b.pass.slice(0, 64) : '';
    const max = Math.min(PARTY_MAX, Math.max(2, Math.round(Number(b.max) || PARTY_MAX)));
    const listed = b.listed !== false;
    const mode: Mode = isMode(b.mode) ? b.mode : 'free';
    if (!name) return json({ error: 'name' }, 400, h);
    if (!(await lobby.allowCreate(pid))) return json({ error: 'busy' }, 429, h);
    const key = hex(crypto.getRandomValues(new Uint8Array(16)));
    for (let i = 0; i < 6; i++) {
      const code = randomCode();
      const ok = await env.PARTY.get(env.PARTY.idFromName(code)).init({ code, name, pass, max, listed, mode, keyHash: await sha256(key) });
      if (ok) return json({ code, key }, 200, h);
    }
    return json({ error: 'busy' }, 503, h);
  }

  const room = path.match(/^\/party\/room\/([A-Za-z2-9]{6})(?:\/(ws|shot))?$/);
  if (!room) return new Response('Not found', { status: 404, headers: h });
  const code = room[1].toUpperCase();
  if (!CODE_RE.test(code)) return new Response('Not found', { status: 404, headers: h });
  const stub = env.PARTY.get(env.PARTY.idFromName(code));

  if (!room[2] && req.method === 'GET') {
    const info = await stub.info();
    return info ? json(info, 200, h) : json({ error: 'gone' }, 404, h);
  }

  if (room[2] === 'ws') {
    if (req.headers.get('Upgrade')?.toLowerCase() !== 'websocket') return new Response('Expected a WebSocket', { status: 426 });
    const pid = await verifyToken(env, url.searchParams.get('t'));
    if (!pid) return refuse(CLOSE.challenge, 'challenge required');
    // fresh headers: nothing a client sends in X-* reaches the object
    return stub.fetch(new Request(url.toString(), { headers: { Upgrade: 'websocket', 'X-Pid': pid } }));
  }

  if (room[2] === 'shot' && req.method === 'PUT') {
    const pid = await verifyToken(env, url.searchParams.get('t'));
    if (!pid) return json({ error: 'auth' }, 401, h);
    const len = Number(req.headers.get('Content-Length') ?? 0);
    if (len > MAX_SHOT_BYTES) return json({ error: 'size' }, 413, h);
    const bytes = new Uint8Array(await req.arrayBuffer());
    if (bytes.length === 0 || bytes.length > MAX_SHOT_BYTES) return json({ error: 'size' }, 413, h);
    const res = await stub.upload(pid, bytes);
    return 'error' in res ? json(res, res.error === 'slow' ? 429 : 400, h) : json(res, 200, h);
  }

  return new Response('Not found', { status: 404, headers: h });
}

/* ---------------- lobby: the public room list ---------------- */

interface LobbyRow { code: string; name: string; count: number; max: number; locked: number; listed: number; at: number; seen: number; mode: string | null; [k: string]: SqlStorageValue }

export class Lobby extends DurableObject<Env> {
  private readonly sql: SqlStorage;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql.exec(`CREATE TABLE IF NOT EXISTS rooms (code TEXT PRIMARY KEY, name TEXT, count INTEGER, max INTEGER, locked INTEGER, listed INTEGER, at INTEGER, seen INTEGER)`);
    this.sql.exec(`CREATE TABLE IF NOT EXISTS makers (pid TEXT, at INTEGER)`);
    const cols = this.sql.exec<{ name: string }>(`PRAGMA table_info(rooms)`).toArray();
    if (!cols.some((c) => c.name === 'mode')) this.sql.exec(`ALTER TABLE rooms ADD COLUMN mode TEXT`);
  }

  /** listed rooms with someone in them (or just opened), fullest first */
  async list(): Promise<RoomInfo[]> {
    const now = Date.now();
    const rows = this.sql.exec<LobbyRow>(
      `SELECT * FROM rooms WHERE listed = 1 AND (count > 0 OR at > ?) AND seen > ? ORDER BY count DESC, at DESC LIMIT 100`,
      now - 10 * 60_000, now - EMPTY_MS * 2,
    ).toArray();
    return rows.map((r) => ({ code: r.code, name: r.name, count: r.count, max: r.max, locked: r.locked === 1, at: r.at, mode: isMode(r.mode) ? r.mode : 'free' }));
  }

  async upsert(r: RoomInfo & { listed: boolean }): Promise<void> {
    this.sql.exec(
      `INSERT INTO rooms (code, name, count, max, locked, listed, at, seen, mode) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(code) DO UPDATE SET name = excluded.name, count = excluded.count, max = excluded.max, locked = excluded.locked, listed = excluded.listed, seen = excluded.seen, mode = excluded.mode`,
      r.code, r.name, r.count, r.max, r.locked ? 1 : 0, r.listed ? 1 : 0, r.at, Date.now(), r.mode,
    );
  }

  async remove(code: string): Promise<void> {
    this.sql.exec(`DELETE FROM rooms WHERE code = ?`, code);
  }

  async allowCreate(pid: string): Promise<boolean> {
    const now = Date.now();
    this.sql.exec(`DELETE FROM makers WHERE at < ?`, now - 3600_000);
    this.sql.exec(`DELETE FROM rooms WHERE seen < ?`, now - EMPTY_MS * 4);
    const mine = this.sql.exec<{ n: number }>(`SELECT COUNT(*) AS n FROM makers WHERE pid = ?`, pid).one().n;
    const total = this.sql.exec<{ n: number }>(`SELECT COUNT(*) AS n FROM rooms`).one().n;
    if (mine >= CREATE_PER_HOUR || total >= MAX_ROOMS) return false;
    this.sql.exec(`INSERT INTO makers (pid, at) VALUES (?, ?)`, pid, now);
    return true;
  }
}

/* ---------------- party: one room ---------------- */

interface Meta { code: string; name: string; salt: string; passHash: string; keyHash: string; max: number; listed: boolean; created: number; mode?: Mode }

interface Att {
  pid: string;
  joined: boolean;
  nick: string;
  avatar: AvatarId;
  color: number;
  since: number;
  /** message bucket */
  tokens: number; at: number;
  /** pose bucket */
  ptokens: number; pat: number;
  strikes: number;
  lastVote: number;
  lastText: string;
  lastTextAt: number;
}

export class Party extends DurableObject<Env> {
  private meta: Meta | null = null;
  private chat: ChatLine[] = [];
  private shots: Shot[] = [];
  private vote: Vote | null = null;
  private clock: Clock | null = null;
  private owner: string | null = null;
  private muted = new Set<string>();
  private banned = new Set<string>();
  private emptySince = 0;
  /** latest pose per player, and the ones not yet sent */
  private readonly poses = new Map<string, Pose>();
  private readonly dirty = new Set<string>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  /** last upload per player (a socket attachment would be overwritten by messages handled during the R2 write) */
  private readonly lastShot = new Map<string, number>();
  /** the modes' state (null in the rooms that do not play them) */
  private hunt: Hunt | null = null;
  private hide: Hide | null = null;
  private heatAt = 0;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
    void ctx.blockConcurrencyWhile(async () => {
      const s = await ctx.storage.get(['meta', 'chat', 'shots', 'vote', 'clock', 'owner', 'muted', 'banned', 'emptySince', 'hunt', 'hide']);
      this.meta = (s.get('meta') as Meta | undefined) ?? null;
      this.chat = (s.get('chat') as ChatLine[] | undefined) ?? [];
      this.shots = (s.get('shots') as Shot[] | undefined) ?? [];
      this.vote = (s.get('vote') as Vote | undefined) ?? null;
      this.clock = (s.get('clock') as Clock | undefined) ?? null;
      this.owner = (s.get('owner') as string | undefined) ?? null;
      this.muted = new Set((s.get('muted') as string[] | undefined) ?? []);
      this.banned = new Set((s.get('banned') as string[] | undefined) ?? []);
      this.emptySince = (s.get('emptySince') as number | undefined) ?? 0;
      this.hunt = (s.get('hunt') as Hunt | undefined) ?? null;
      this.hide = (s.get('hide') as Hide | undefined) ?? null;
    });
  }

  private get mode(): Mode { const m = this.meta?.mode; return isMode(m) ? m : 'free'; }

  /** RPC (creation): false when the code is already taken */
  async init(o: { code: string; name: string; pass: string; max: number; listed: boolean; mode: Mode; keyHash: string }): Promise<boolean> {
    if (this.meta) return false;
    const salt = hex(crypto.getRandomValues(new Uint8Array(8)));
    const now = Date.now();
    this.meta = { code: o.code, name: o.name, salt, passHash: o.pass ? await sha256(`${salt}:${o.pass}`) : '', keyHash: o.keyHash, max: o.max, listed: o.listed, created: now, mode: o.mode };
    this.emptySince = now;
    this.hunt = o.mode === 'hunt' ? { round: 0, target: null, ends: 0, found: [], scores: {} } : null;
    this.hide = o.mode === 'hide' ? { round: 0, phase: 'idle', hider: null, ends: 0, caught: null, hints: [], scores: {} } : null;
    await this.ctx.storage.put({ meta: this.meta, emptySince: now, hunt: this.hunt, hide: this.hide });
    await this.ctx.storage.setAlarm(now + EMPTY_MS);
    await this.publish();
    return true;
  }

  /** RPC: what the lobby and a shared link show */
  async info(): Promise<RoomInfo | null> {
    return this.meta ? this.roomInfo() : null;
  }

  /** RPC: a screenshot from a member, stored in R2 until it is posted (`shot` message) */
  async upload(pid: string, bytes: Uint8Array): Promise<{ id: string; url: string } | { error: string }> {
    if (!this.meta) return { error: 'gone' };
    if (!this.socketsOf(pid).some((w) => w.readyState === OPEN && this.att(w)?.joined)) return { error: 'member' };
    const now = Date.now();
    if (now - (this.lastShot.get(pid) ?? 0) < SHOT_GAP_MS) return { error: 'slow' };
    this.lastShot.set(pid, now);
    const jpg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    const webp = String.fromCharCode(...bytes.subarray(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.subarray(8, 12)) === 'WEBP';
    if (!jpg && !webp) return { error: 'type' };
    const id = hex(crypto.getRandomValues(new Uint8Array(12)));
    const ext = jpg ? 'jpg' : 'webp';
    await this.env.SHOTS.put(`party/${this.meta.code}/${id}.${ext}`, bytes, {
      httpMetadata: { contentType: jpg ? 'image/jpeg' : 'image/webp' },
      customMetadata: { pid },
    });
    return { id: `${id}.${ext}`, url: `/party/shot/${this.meta.code}/${id}.${ext}` };
  }

  async fetch(req: Request): Promise<Response> {
    const pid = req.headers.get('X-Pid') ?? '';
    const [client, server] = Object.values(new WebSocketPair());
    if (!this.meta) { server.accept(); server.close(CLOSE.gone, 'no such room'); return new Response(null, { status: 101, webSocket: client }); }
    if (this.banned.has(pid)) { server.accept(); server.close(CLOSE.kicked, 'kicked'); return new Response(null, { status: 101, webSocket: client }); }
    // one socket per player: a second tab takes over
    for (const old of this.socketsOf(pid)) old.close(CLOSE.replaced, 'replaced');
    this.ctx.acceptWebSocket(server, [pid]);
    const now = Date.now();
    server.serializeAttachment({
      pid, joined: false, nick: '', avatar: 'frog', color: 0, since: now,
      tokens: MSG_BURST, at: now, ptokens: POSE_BURST, pat: now, strikes: 0, lastVote: 0, lastText: '', lastTextAt: 0,
    } satisfies Att);
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, data: string | ArrayBuffer): Promise<void> {
    if (typeof data !== 'string' || data.length > MAX_MSG) return ws.close(1009, 'message too big');
    const a = this.att(ws);
    if (!a || !this.meta) return;
    let m: Record<string, unknown>;
    try { m = JSON.parse(data); } catch { return; }
    if (!m || typeof m !== 'object') return;
    const now = Date.now();

    if (m.t === 'pose') {
      if (!a.joined) return;
      a.ptokens = Math.min(POSE_BURST, a.ptokens + ((now - a.pat) / 1000) * POSE_RATE);
      a.pat = now;
      if (a.ptokens < 1) return this.strike(ws, a);
      a.ptokens -= 1;
      ws.serializeAttachment(a);
      const p = validPose(m);
      if (!p) return;
      this.poses.set(a.pid, p);
      this.dirty.add(a.pid);
      this.timer ??= setTimeout(() => this.flushPoses(), POSE_FLUSH_MS);
      return;
    }

    a.tokens = Math.min(MSG_BURST, a.tokens + ((now - a.at) / 1000) * MSG_RATE);
    a.at = now;
    if (a.tokens < 1) return this.strike(ws, a);
    a.tokens -= 1;

    if (m.t === 'hello') { await this.hello(ws, a, m); return; }
    if (!a.joined) { ws.serializeAttachment(a); return; }
    this.settleVote(now);
    this.settleGame(now);

    switch (m.t) {
      case 'chat': {
        if (this.muted.has(a.pid)) { this.send(ws, { t: 'notice', code: 'muted' }); break; }
        const text = maskBad(cleanText(m.text, MAX_CHAT));
        if (!text) break;
        if (text === a.lastText && now - a.lastTextAt < 10_000) { this.send(ws, { t: 'notice', code: 'slow' }); break; }
        a.lastText = text; a.lastTextAt = now;
        const line: ChatLine = { pid: a.pid, nick: a.nick, color: a.color, text, at: now };
        this.chat = [...this.chat.slice(-(CHAT_KEEP - 1)), line];
        await this.ctx.storage.put('chat', this.chat);
        this.broadcast({ t: 'chat', line });
        break;
      }
      case 'shot': {
        const id = typeof m.id === 'string' && SHOT_ID_RE.test(m.id) ? m.id : '';
        const place = validPlace(m.place);
        // the upload says whose it is: only its uploader posts it, once
        const obj = id && place && !this.shots.some((s) => s.id === id) ? await this.env.SHOTS.head(`party/${this.meta.code}/${id}`) : null;
        if (!place || obj?.customMetadata?.pid !== a.pid) { this.send(ws, { t: 'notice', code: 'shot-missing' }); break; }
        place.name = maskBad(place.name);
        const url = `/party/shot/${this.meta.code}/${id}`;
        const shot: Shot = { id, pid: a.pid, nick: a.nick, color: a.color, url, title: maskBad(cleanText(m.title, MAX_TITLE)) || place.name, place, at: now };
        this.shots = [...this.shots.slice(-(SHOTS_KEEP - 1)), shot];
        await this.ctx.storage.put('shots', this.shots);
        this.broadcast({ t: 'shot', shot });
        break;
      }
      case 'vote': {
        if (this.muted.has(a.pid)) { this.send(ws, { t: 'notice', code: 'muted' }); break; }
        if (this.vote) { this.send(ws, { t: 'notice', code: 'vote-busy' }); break; }
        if (now - a.lastVote < VOTE_GAP_MS) { this.send(ws, { t: 'notice', code: 'slow' }); break; }
        const place = validPlace(m.place);
        if (!place) break;
        place.name = maskBad(place.name);
        a.lastVote = now;
        const shotId = typeof m.shot === 'string' && this.shots.some((s) => s.id === m.shot) ? m.shot : null;
        this.vote = {
          id: hex(crypto.getRandomValues(new Uint8Array(6))), pid: a.pid, nick: a.nick,
          title: maskBad(cleanText(m.title, MAX_TITLE)) || place.name, place, shot: shotId, ends: now + VOTE_MS, yes: [a.pid], no: [],
        };
        await this.ctx.storage.put('vote', this.vote);
        await this.scheduleAlarm();
        this.broadcast({ t: 'vote', vote: this.vote });
        this.settleVote(now);
        break;
      }
      case 'ballot': {
        const v = this.vote;
        if (!v || m.id !== v.id) break;
        v.yes = v.yes.filter((p) => p !== a.pid);
        v.no = v.no.filter((p) => p !== a.pid);
        (m.yes === true ? v.yes : v.no).push(a.pid);
        await this.ctx.storage.put('vote', v);
        this.broadcast({ t: 'vote', vote: v });
        this.settleVote(now);
        break;
      }
      case 'clock': {
        if (a.pid !== this.owner) break;
        const jd = Number(m.jd), r = Number(m.r);
        if (!Number.isFinite(jd) || Math.abs(jd) > 1e9 || !Number.isFinite(r) || Math.abs(r) > 1e13) break;
        this.clock = { jd, r, at: now };
        await this.ctx.storage.put('clock', this.clock);
        this.broadcast({ t: 'clock', clock: this.clock }, ws);
        break;
      }
      case 'kick': case 'mute': {
        if (a.pid !== this.owner || typeof m.pid !== 'string' || m.pid === a.pid) break;
        const target = m.pid;
        if (m.t === 'kick') {
          this.banned.add(target);
          await this.ctx.storage.put('banned', [...this.banned].slice(-500));
          for (const w of this.socketsOf(target)) { w.close(CLOSE.kicked, 'kicked'); await this.left(w); }
        } else {
          if (m.on === true) this.muted.add(target); else this.muted.delete(target);
          await this.ctx.storage.put('muted', [...this.muted]);
          for (const w of this.socketsOf(target)) { const t = this.att(w); if (t?.joined) this.broadcast({ t: 'member', m: this.member(t) }); }
        }
        break;
      }
      case 'emote': {
        if (EMOTES.includes(m.e as Emote)) this.broadcast({ t: 'emote', pid: a.pid, e: m.e as Emote });
        break;
      }
      case 'avatar': {
        if (!isAvatar(m.avatar)) break;
        a.avatar = m.avatar;
        this.broadcast({ t: 'member', m: this.member(a) });
        break;
      }
      case 'round': {
        if (a.pid !== this.owner) break;
        if (this.hunt) await this.nextHunt(now);
        else if (this.hide) await this.nextHide(now);
        break;
      }
      case 'found': {
        const h = this.hunt;
        const place = validPlace(m.place);
        if (!h || !h.target || m.round !== h.round || now >= h.ends || !place || h.found.some((f) => f.pid === a.pid)) break;
        const pts = [3, 2, 1][h.found.length] ?? 1;
        h.found.push({ pid: a.pid, nick: a.nick, color: a.color, at: now, pts, name: maskBad(place.name) });
        h.scores[a.pid] = (h.scores[a.pid] ?? 0) + pts;
        // three finders (or everyone present) close the round
        if (h.found.length >= Math.min(3, this.joined().length)) h.ends = now;
        await this.ctx.storage.put('hunt', h);
        this.broadcast({ t: 'hunt', hunt: h });
        break;
      }
    }
    ws.serializeAttachment(a);
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string): Promise<void> {
    try { ws.close(code, reason); } catch { /* already closed */ }
    await this.left(ws);
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    await this.left(ws);
  }

  async alarm(): Promise<void> {
    const now = Date.now();
    this.settleVote(now);
    this.settleGame(now);
    if (this.meta && this.joined().length === 0 && this.emptySince && now - this.emptySince >= EMPTY_MS) {
      const code = this.meta.code;
      this.meta = null;
      await this.ctx.storage.deleteAll();
      await this.lobby().remove(code);
      return;
    }
    await this.scheduleAlarm();
  }

  /* ---------------- internals ---------------- */

  private async hello(ws: WebSocket, a: Att, m: Record<string, unknown>): Promise<void> {
    const meta = this.meta!;
    if (a.joined) return;
    // the creator's key opens the room without its password
    const keyed = typeof m.key === 'string' && m.key.length <= 64 && sameString(await sha256(m.key), meta.keyHash);
    if (meta.passHash && !keyed) {
      const pass = typeof m.pass === 'string' ? m.pass.slice(0, 64) : '';
      if (!sameString(await sha256(`${meta.salt}:${pass}`), meta.passHash)) return ws.close(CLOSE.password, 'password');
    }
    const others = this.joined().filter((w) => w !== ws);
    if (others.length >= meta.max) return ws.close(CLOSE.full, 'room full');
    const used = new Set(others.map((w) => this.att(w)!.color));
    a.joined = true;
    a.nick = maskBad(cleanText(m.nick, 20)) || `Explorer ${a.pid.slice(0, 4)}`;
    a.avatar = isAvatar(m.avatar) ? m.avatar : 'frog';
    a.color = PARTY_COLORS.findIndex((_, i) => !used.has(i));
    if (a.color < 0) a.color = 0;
    a.since = Date.now();
    // the creator's key always takes the room back; otherwise an ownerless room goes to whoever arrives
    const prev = this.owner;
    if (keyed) this.owner = a.pid;
    else if (!others.some((w) => this.att(w)!.pid === this.owner)) this.owner = a.pid;
    if (this.owner !== prev) await this.ctx.storage.put('owner', this.owner);
    ws.serializeAttachment(a);
    const demoted = prev && prev !== this.owner ? others.find((w) => this.att(w)!.pid === prev) : undefined;
    if (demoted) this.broadcast({ t: 'member', m: this.member(this.att(demoted)!) });
    if (this.emptySince) { this.emptySince = 0; await this.ctx.storage.put('emptySince', 0); }
    const now = Date.now();
    this.send(ws, {
      t: 'welcome', you: a.pid, now, room: this.roomInfo(),
      members: this.joined().map((w) => this.member(this.att(w)!)),
      chat: this.chat, shots: this.shots, vote: this.vote, clock: this.clock,
      poses: [...this.poses].filter(([pid]) => pid !== a.pid && pid !== this.hidden()),
      hunt: this.hunt, hide: this.hide,
    });
    this.broadcast({ t: 'join', m: this.member(a) }, ws);
    await this.publish();
  }

  private async left(ws: WebSocket): Promise<void> {
    const a = this.att(ws);
    if (!a?.joined || !this.meta) return;
    // a kick closes the socket itself and leaves at once; the close event that may follow must not leave twice
    a.joined = false;
    try { ws.serializeAttachment(a); } catch { /* closed */ }
    // a takeover by the same player's new tab is not a departure
    if (this.socketsOf(a.pid).some((w) => w !== ws && w.readyState === OPEN)) return;
    this.poses.delete(a.pid);
    this.dirty.delete(a.pid);
    this.broadcast({ t: 'leave', pid: a.pid }, ws);
    // a hider who leaves ends the round, without points
    if (this.hide?.hider === a.pid && (this.hide.phase === 'hide' || this.hide.phase === 'seek')) {
      this.hide.phase = 'over';
      this.hide.caught = null;
      this.hide.ends = Date.now();
      await this.ctx.storage.put('hide', this.hide);
      this.broadcast({ t: 'hide', hide: this.hide });
    }
    const rest = this.joined().filter((w) => w !== ws);
    if (a.pid === this.owner && rest.length) {
      // the longest-standing member takes over
      const next = rest.map((w) => this.att(w)!).sort((x, y) => x.since - y.since)[0];
      this.owner = next.pid;
      await this.ctx.storage.put('owner', this.owner);
      this.broadcast({ t: 'member', m: this.member(next) });
    }
    if (!rest.length) {
      this.emptySince = Date.now();
      await this.ctx.storage.put('emptySince', this.emptySince);
      await this.scheduleAlarm();
    }
    await this.publish();
  }

  /** the vote ends when its time is up, when a majority of those present said yes, or when it can no longer pass */
  private settleVote(now: number): void {
    const v = this.vote;
    if (!v) return;
    const present = new Set(this.joined().map((w) => this.att(w)!.pid));
    const yes = v.yes.filter((p) => present.has(p)).length;
    const no = v.no.filter((p) => present.has(p)).length;
    const need = Math.floor(present.size / 2) + 1;
    const passed = yes >= need;
    const failed = !passed && (now >= v.ends || present.size - no < need);
    if (!passed && !failed) return;
    this.vote = null;
    void this.ctx.storage.delete('vote');
    this.broadcast({ t: 'voted', id: v.id, passed, place: v.place, title: v.title });
  }

  private flushPoses(): void {
    this.timer = null;
    const now = Date.now();
    this.heat(now);
    if (!this.dirty.size) return;
    // the hider is nowhere to be seen while the round runs
    const hidden = this.hidden();
    const list: Array<[string, Pose]> = [];
    for (const pid of this.dirty) { const p = this.poses.get(pid); if (p && pid !== hidden) list.push([pid, p]); }
    this.dirty.clear();
    // everyone gets everyone else's: the sender's own pose is skipped per socket
    for (const ws of this.joined()) {
      const me = this.att(ws)!.pid;
      const mine = list.filter(([pid]) => pid !== me);
      if (mine.length) this.send(ws, { t: 'poses', list: mine });
    }
  }

  /** hide and seek: the player out of sight this round (null between rounds) */
  private hidden(): string | null {
    const h = this.hide;
    return h && (h.phase === 'hide' || h.phase === 'seek') ? h.hider : null;
  }

  /** hide and seek: each seeker's distance to the hider (from the parsec positions: km-precise), and the catch */
  private heat(now: number): void {
    const h = this.hide;
    if (!h || h.phase !== 'seek' || !h.hider) return;
    const hp = this.poses.get(h.hider);
    if (!hp) return;
    const tell = now - this.heatAt >= HEAT_MS;
    for (const ws of this.joined()) {
      const pid = this.att(ws)!.pid;
      const p = pid === h.hider ? undefined : this.poses.get(pid);
      if (!p) continue;
      const km = Math.hypot(p.g[0] - hp.g[0], p.g[1] - hp.g[1], p.g[2] - hp.g[2]) * PARSEC_KM;
      if (km < CATCH_KM) {
        h.phase = 'over';
        h.caught = pid;
        h.ends = now;
        h.scores[pid] = (h.scores[pid] ?? 0) + 3;
        this.dirty.add(h.hider);
        void this.ctx.storage.put('hide', h);
        this.broadcast({ t: 'hide', hide: h });
        return;
      }
      if (tell) { this.send(ws, km < BEACON_KM ? { t: 'heat', km, at: hp } : { t: 'heat', km }); this.heatAt = now; }
    }
  }

  private hint(kind: HideHint['kind'], p: Pose, now: number): HideHint {
    const r = Math.hypot(p.g[0], p.g[1], p.g[2]);
    if (kind === 'ly') {
      const ly = r * LY_PER_PC;
      const mag = 10 ** Math.max(0, Math.floor(Math.log10(Math.max(ly, 1))) - 1);
      return { at: now, kind, v: [Math.round(ly / mag) * mag] };
    }
    if (kind === 'dir') return { at: now, kind, v: p.g.map((x) => Math.round((x / Math.max(r, 1e-9)) * 100) / 100) };
    return { at: now, kind, s: p.s };
  }

  /** the round clocks: hiding → seeking (hints on the way) → over */
  private settleGame(now: number): void {
    const h = this.hide;
    if (!h || (h.phase !== 'hide' && h.phase !== 'seek')) return;
    let changed = false;
    if (h.phase === 'hide' && now >= h.ends) { h.phase = 'seek'; h.ends = now + SEEK_MS; changed = true; }
    if (h.phase === 'seek') {
      const start = h.ends - SEEK_MS;
      const hp = h.hider ? this.poses.get(h.hider) : undefined;
      for (const [sec, kind] of HINTS) {
        if (!hp || now - start < sec * 1000 || h.hints.some((x) => x.kind === kind)) continue;
        h.hints.push(this.hint(kind, hp, now));
        changed = true;
      }
      if (now >= h.ends) {
        h.phase = 'over';
        h.caught = null;
        if (h.hider) { h.scores[h.hider] = (h.scores[h.hider] ?? 0) + 3; this.dirty.add(h.hider); }
        changed = true;
      }
    }
    if (!changed) return;
    void this.ctx.storage.put('hide', h);
    this.broadcast({ t: 'hide', hide: h });
    void this.scheduleAlarm();
  }

  private present(): string[] {
    return [...new Set(this.joined().map((w) => this.att(w)!.pid))];
  }

  private async nextHunt(now: number): Promise<void> {
    const h = this.hunt!;
    let t = HUNT_TARGETS[Math.floor(Math.random() * HUNT_TARGETS.length)];
    while (t === h.target) t = HUNT_TARGETS[Math.floor(Math.random() * HUNT_TARGETS.length)];
    h.round++;
    h.target = t;
    h.ends = now + HUNT_MS;
    h.found = [];
    await this.ctx.storage.put('hunt', h);
    this.broadcast({ t: 'hunt', hunt: h });
  }

  private async nextHide(now: number): Promise<void> {
    const h = this.hide!;
    const present = this.present();
    if (present.length < 2) { this.broadcast({ t: 'notice', code: 'need-two' }); return; }
    // whoever found the last one hides next; else someone who did not hide last time
    const pool = present.filter((p) => p !== h.hider);
    h.hider = h.caught && present.includes(h.caught) ? h.caught : pool[Math.floor(Math.random() * pool.length)];
    h.round++;
    h.phase = 'hide';
    h.ends = now + HIDE_MS;
    h.caught = null;
    h.hints = [];
    await this.ctx.storage.put('hide', h);
    this.broadcast({ t: 'hide', hide: h });
    await this.scheduleAlarm();
  }

  private strike(ws: WebSocket, a: Att): void {
    a.strikes++;
    ws.serializeAttachment(a);
    if (a.strikes > 60) ws.close(1008, 'rate limit');
  }

  private async scheduleAlarm(): Promise<void> {
    const h = this.hide;
    let game: number | undefined;
    if (h?.phase === 'hide') game = h.ends;
    else if (h?.phase === 'seek') {
      const start = h.ends - SEEK_MS;
      const next = HINTS.filter(([, kind]) => !h.hints.some((x) => x.kind === kind)).map(([sec]) => start + sec * 1000);
      game = Math.min(h.ends, ...next);
    }
    const at = [this.vote?.ends, this.emptySince ? this.emptySince + EMPTY_MS : undefined, game].filter((x): x is number => !!x);
    if (at.length) await this.ctx.storage.setAlarm(Math.min(...at));
  }

  /** tell the lobby how the room stands */
  private async publish(): Promise<void> {
    if (!this.meta) return;
    try { await this.lobby().upsert({ ...this.roomInfo(), listed: this.meta.listed }); } catch (err) { console.error('lobby', String(err)); }
  }

  private roomInfo(): RoomInfo {
    const m = this.meta!;
    return { code: m.code, name: m.name, count: this.joined().length, max: m.max, locked: !!m.passHash, at: m.created, mode: this.mode };
  }

  private member(a: Att): Member {
    return { pid: a.pid, nick: a.nick, avatar: a.avatar, color: a.color, owner: a.pid === this.owner, muted: this.muted.has(a.pid) };
  }

  private att(ws: WebSocket): Att | null {
    return ws.deserializeAttachment() as Att | null;
  }

  private socketsOf(pid: string): WebSocket[] {
    return this.ctx.getWebSockets(pid);
  }

  private joined(): WebSocket[] {
    return this.ctx.getWebSockets().filter((w) => w.readyState === OPEN && this.att(w)?.joined);
  }

  private send(ws: WebSocket, m: ServerMsg): void {
    if (ws.readyState === OPEN) ws.send(JSON.stringify(m));
  }

  private broadcast(m: ServerMsg, except?: WebSocket): void {
    const text = JSON.stringify(m);
    for (const ws of this.joined()) if (ws !== except) ws.send(text);
  }

  private lobby(): DurableObjectStub<Lobby> {
    return this.env.LOBBY.get(this.env.LOBBY.idFromName('lobby'));
  }
}
