/**
 * Multiplayer (party) protocol, shared by the browser and the relay (worker/src/party.ts).
 *
 * A party is a room of up to PARTY_MAX explorers in the same universe: the universe is
 * deterministic, so only where everyone is (pose), the shared clock and the room's events
 * (chat, screenshots, votes) travel. The relay validates everything here: the code is open
 * source, so any field can be forged.
 */

export const PARTY_MAX = 16;
export const AVATARS = ['frog', 'bee', 'flamingo', 'spacesuit', 'mech-panda', 'mech-frog', 'mech-bee', 'mech-flamingo'] as const;
export type AvatarId = (typeof AVATARS)[number];
/** accent colours of the players (label, ring, chat name), picked in join order */
export const PARTY_COLORS = ['#7cc4ff', '#ffb46b', '#9be38f', '#ff8fb1', '#c7a6ff', '#ffe27a', '#6fe0d2', '#ff9a8a', '#a8c0ff', '#e6c39a', '#8de0a5', '#f5a3e8', '#b5e86f', '#7fb2c9', '#ffc7a8', '#d0d0d0'];

export const MAX_MSG = 2048;
export const MAX_CHAT = 280;
export const MAX_TITLE = 80;
export const MAX_ROOM_NAME = 40;
export const MAX_SHOT_BYTES = 700_000;
export const CHAT_KEEP = 60;
export const SHOTS_KEEP = 40;
export const VOTE_MS = 30_000;

export type Vec3 = [number, number, number];
export type Quat = [number, number, number, number];

/**
 * Where someone is: a star system (`s`), optionally a body of it (`b`) the offset `o` is taken
 * from (so a player orbiting Jupiter stays at Jupiter whatever the clocks say), else the system's
 * origin; `g` is the same point in parsecs from the Sun, for players in other systems. `l`: they
 * stand on `b`'s surface at that latitude / east longitude (deg).
 */
export interface Pose { s: string; b: string | null; o: Vec3; g: Vec3; q: Quat; l?: [number, number] }
/** a saved spot: a pose with a name (screenshots, votes) */
export interface Place extends Pose { name: string }

/**
 * What a room plays, chosen when it is made: everyone roams free; a treasure hunt for kinds of
 * worlds; hide and seek across the galaxy.
 */
export const MODES = ['free', 'hunt', 'hide'] as const;
export type Mode = (typeof MODES)[number];
export const isMode = (x: unknown): x is Mode => typeof x === 'string' && (MODES as readonly string[]).includes(x);

export interface Member { pid: string; nick: string; avatar: AvatarId; color: number; owner: boolean; muted: boolean }
export interface ChatLine { pid: string; nick: string; color: number; text: string; at: number; sys?: boolean }
export interface Shot { id: string; pid: string; nick: string; color: number; url: string; title: string; place: Place; at: number }
export interface Vote { id: string; pid: string; nick: string; title: string; place: Place; shot: string | null; ends: number; yes: string[]; no: string[] }
/** the simulation clock: Julian date `jd` at server time `at` (ms), running at `r` s/s (0 = paused) */
export interface Clock { jd: number; r: number; at: number }
export interface RoomInfo { code: string; name: string; count: number; max: number; locked: boolean; at: number; mode: Mode }

/** treasure hunt: what to find (the client knows how to tell; see src/party/hunt.ts) */
export const HUNT_TARGETS = [
  'ringed', 'life', 'ocean', 'lava', 'geyser', 'moon-land', 'exo-land', 'red-dwarf', 'blue-star', 'white-dwarf',
  'giant-star', 'binary', 'blackhole', 'pulsar', 'nebula', 'cluster', 'far', 'galaxy', 'comet', 'saturn',
] as const;
export type HuntTarget = (typeof HUNT_TARGETS)[number];
export const HUNT_MS = 6 * 60_000;
export interface HuntFind { pid: string; nick: string; color: number; at: number; pts: number; name: string }
export interface Hunt { round: number; target: HuntTarget | null; ends: number; found: HuntFind[]; scores: Record<string, number> }

/** hide and seek: a minute to hide, then the seekers have the hints and a hot/cold distance */
export const HIDE_MS = 60_000;
export const SEEK_MS = 8 * 60_000;
/** a seeker this close to the hider (km) has found them */
export const CATCH_KM = 200_000;
/** and from this close (km, 10 light-years) sees the hider's blinking beacon */
export const BEACON_KM = 10 * 9.4607304725808e12;
export type HidePhase = 'idle' | 'hide' | 'seek' | 'over';
/** distance from the Sun (ly), direction from the Sun (unit), the star's spectral type, then the star itself */
export interface HideHint { at: number; kind: 'ly' | 'dir' | 'spectral' | 'star'; s?: string; v?: number[] }
export interface Hide { round: number; phase: HidePhase; hider: string | null; ends: number; caught: string | null; hints: HideHint[]; scores: Record<string, number> }

export type Emote = 'wave' | 'yes' | 'no' | 'jump';
export const EMOTES: readonly Emote[] = ['wave', 'yes', 'no', 'jump'];

export type ClientMsg =
  | { t: 'hello'; nick: string; avatar: AvatarId; pass?: string; key?: string }
  | ({ t: 'pose' } & Pose)
  | { t: 'chat'; text: string }
  | { t: 'shot'; id: string; title: string; place: Place }
  | { t: 'vote'; title: string; place: Place; shot?: string }
  | { t: 'ballot'; id: string; yes: boolean }
  | { t: 'clock'; jd: number; r: number }
  | { t: 'kick'; pid: string }
  | { t: 'mute'; pid: string; on: boolean }
  | { t: 'emote'; e: Emote }
  | { t: 'avatar'; avatar: AvatarId }
  /** the owner starts the next hunt / hide-and-seek round */
  | { t: 'round' }
  | { t: 'found'; round: number; place: Place };

export type ServerMsg =
  | {
    t: 'welcome'; you: string; now: number; room: RoomInfo; members: Member[]; chat: ChatLine[]; shots: Shot[]; vote: Vote | null; clock: Clock | null; poses: Array<[string, Pose]>;
    hunt: Hunt | null; hide: Hide | null;
  }
  | { t: 'join'; m: Member }
  | { t: 'leave'; pid: string }
  | { t: 'member'; m: Member }
  | { t: 'poses'; list: Array<[string, Pose]> }
  | { t: 'hunt'; hunt: Hunt }
  | { t: 'hide'; hide: Hide }
  /** hide and seek: how far the hider is from you (km) */
  /** a seeker's distance to the hider, and within BEACON_KM where the hider's beacon is */
  | { t: 'heat'; km: number; at?: Pose }
  | { t: 'chat'; line: ChatLine }
  | { t: 'shot'; shot: Shot }
  | { t: 'vote'; vote: Vote }
  | { t: 'voted'; id: string; passed: boolean; place: Place; title: string }
  | { t: 'clock'; clock: Clock }
  | { t: 'emote'; pid: string; e: Emote }
  | { t: 'notice'; code: 'muted' | 'slow' | 'vote-busy' | 'shot-missing' | 'need-two' };

/** WebSocket close codes the client acts on */
export const CLOSE = { challenge: 4401, password: 4403, gone: 4404, kicked: 4410, replaced: 4009, full: 1013 } as const;

/* ---------------- validation (relay side; the client uses it for its own input too) ---------------- */

/** star and body ids are only looked up, never rendered: any printable text (cluster members are `k<landmark>#<n>`) */
const STAR_RE = /^[^\u0000-\u001f\u007f-\u009f<>"`\\]{1,96}$/;
const BODY_RE = STAR_RE;
const finite = (x: unknown, lim: number): x is number => typeof x === 'number' && Number.isFinite(x) && Math.abs(x) <= lim;

function vec(x: unknown, n: 3 | 4, lim: number): number[] | null {
  if (!Array.isArray(x) || x.length !== n) return null;
  for (const v of x) if (!finite(v, lim)) return null;
  return x as number[];
}

export function cleanText(x: unknown, max: number): string {
  return String(x ?? '').normalize('NFKC').replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2066-\u2069]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

export function validPose(x: unknown): Pose | null {
  if (!x || typeof x !== 'object') return null;
  const p = x as Record<string, unknown>;
  if (typeof p.s !== 'string' || !STAR_RE.test(p.s)) return null;
  if (p.b !== null && (typeof p.b !== 'string' || !BODY_RE.test(p.b))) return null;
  // km from the frame's system: the frame stays put until a star is within a few parsecs, so
  // inside a nebula or out between the galaxies this is as far as anywhere (2e10 pc ≈ 6e23 km)
  const o = vec(p.o, 3, 1e24), g = vec(p.g, 3, 2e10), q = vec(p.q, 4, 1.01);
  if (!o || !g || !q) return null;
  const pose: Pose = { s: p.s, b: p.b as string | null, o: o as Vec3, g: g as Vec3, q: q as Quat };
  const l = p.l;
  if (pose.b && Array.isArray(l) && l.length === 2 && finite(l[0], 90) && finite(l[1], 720)) pose.l = [l[0], l[1]];
  return pose;
}

export function validPlace(x: unknown): Place | null {
  const p = validPose(x);
  if (!p) return null;
  const name = cleanText((x as { name?: unknown }).name, MAX_TITLE);
  return { ...p, name };
}

export const isAvatar = (x: unknown): x is AvatarId => typeof x === 'string' && (AVATARS as readonly string[]).includes(x);

/* ---------------- chat filter ---------------- */

/**
 * Masks the worst words of the five UI languages. Deliberately short: it is a floor against the
 * obvious, not a moderator (the room owner can mute and kick). Letters are folded first so
 * spacing, repeats and the usual digit swaps do not slip past.
 */
const BAD = [
  // en
  'fuck', 'shit', 'cunt', 'nigger', 'nigga', 'faggot', 'retard', 'whore', 'slut', 'bitch', 'dick', 'pussy', 'rape',
  // tr
  // (folded words must not be harmless words elsewhere: no "göt" → "got", "piç" → "pic", "coño" → "cono")
  'amk', 'aq', 'orospu', 'sik', 'sikerim', 'siktir', 'yarrak', 'yarak', 'amcık', 'ibne', 'pezevenk', 'kahpe', 'gavat',
  // de
  'fotze', 'hurensohn', 'schlampe', 'wichser', 'arschloch', 'schwuchtel',
  // fr
  'putain', 'salope', 'connard', 'enculé', 'pédé', 'nique',
  // es
  'puta', 'pendejo', 'cabrón', 'maricón', 'gilipollas', 'joder',
];
const fold = (s: string): string => s.toLowerCase()
  .replace(/[0@]/g, 'o').replace(/[1!|]/g, 'i').replace(/3/g, 'e').replace(/4/g, 'a').replace(/5|\$/g, 's').replace(/7/g, 't')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ı/g, 'i');
const BAD_FOLDED = BAD.map(fold);
/** whole words only: "sik" must not mask "fizik", "aq" not "aqua" */
const BAD_RE = new RegExp(`(^|[^\\p{L}])(${BAD_FOLDED.map((w) => w.split('').map((c) => `${c}+`).join('[\\s._-]*')).join('|')})(?=$|[^\\p{L}])`, 'giu');

export function maskBad(text: string): string {
  const folded = fold(text);
  if (folded.length !== text.length) return text;   // a fold changed the length: positions would not line up
  let out = text;
  for (const m of folded.matchAll(BAD_RE)) {
    const start = (m.index ?? 0) + m[1].length, len = m[2].length;
    out = out.slice(0, start) + '*'.repeat(len) + out.slice(start + len);
  }
  return out;
}
