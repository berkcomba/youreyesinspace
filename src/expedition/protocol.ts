/**
 * The Great Expedition: messages between the host cockpit and the crew phones.
 * Shared by both bundles, so nothing here may carry a correct answer before the reveal.
 */

export type Stage =
  | 'LOBBY' | 'ROUTE_VOTE' | 'BOARDING' | 'TRANSIT' | 'GATE_READY' | 'GATE_OPEN' | 'GATE_LOCKED'
  | 'GATE_REVEAL' | 'NODE_ARRIVAL' | 'NODE_COMPLETE' | 'SPACE_EVENT';

export const GATE_NAMES = ['Orientation', 'Science', 'Discovery'] as const;

/** the crew boards for this long before every launch */
export const BOARD_MS = 15_000;

export interface PublicChoice { id: string; label: string }

export interface PublicGate {
  attemptId: string;
  nodeId: string;
  gateIndex: number;          // 0..2
  attempt: number;            // 1, 2, …
  prompt: string;
  choices: PublicChoice[];
  opensAt: number;            // host clock, ms
  closesAt: number;
  eligible: number;
  quorum: number;
  answers: number;            // count only while open
  practice: boolean;
  /** a chapter finale's last gate: more points, higher bar */
  boss?: boolean;
  /** share of correct answers needed (0.5 normally) */
  need?: number;
  /** points multiplier (boss gate, space event bonus) */
  mult?: number;
  /** set after the lock */
  distribution?: number[];
  /** set at the reveal */
  correctId?: string;
  explanation?: string;
  passed?: boolean;
  failReason?: 'quorum' | 'accuracy';
}

export interface PublicVote {
  voteId: string;
  options: Array<{ nodeId: string; title: string; votes: number }>;
  closesAt: number;
  closed: boolean;
  winner?: string;
}

export interface PublicEvent {
  voteId: string;
  title: string;
  text: string;
  options: Array<{ id: string; label: string; hint: string; votes: number }>;
  closesAt: number;
  closed: boolean;
  /** after the vote: the crew's choice, what happened and its effect */
  pick?: string;
  outcome?: string;
  effect?: string;
}

export interface PublicSnapshot {
  room: string;
  campaign: string;           // community / crew name
  host: string;
  stage: Stage;
  paused: boolean;
  target?: { id: string; title: string; chapter: string };
  gate?: PublicGate;
  vote?: PublicVote;
  event?: PublicEvent;
  /** ship hull, 0–100 */
  hull: number;
  /** bonus or penalty waiting for the next gate */
  next?: { mult?: number; time?: number };
  /** BOARDING: launch time, host clock */
  departsAt?: number;
  discovered: number;
  total: number;
  chapterProgress: Array<{ id: string; title: string; discovered: number; total: number; open: boolean }>;
  lastDiscovered?: { id: string; title: string; facts: string[]; accuracy: number; assisted: boolean };
  crew: number;
  leaders: Array<{ nick: string; points: number }>;
  rev: number;
  sentAt: number;
}

export type CrewToHost =
  | { t: 'hello'; room: string; pid: string; nick: string }
  | { t: 'ping'; room: string; pid: string }
  /** relay only: the player's last socket closed */
  | { t: 'bye'; room: string; pid: string }
  | { t: 'vote'; room: string; pid: string; voteId: string; nodeId: string }
  /** `age`: relay only, ms the answer waited in the relay since it arrived (timing fairness) */
  | { t: 'answer'; room: string; pid: string; attemptId: string; choiceId: string; age?: number };

export type HostToCrew =
  | { t: 'state'; room: string; s: PublicSnapshot }
  | { t: 'me'; room: string; pid: string; points: number; sessionPoints: number; answered?: { attemptId: string; choiceId: string }; votedFor?: string; rejected?: string; last?: GateScore };

/** The player's result for the most recent revealed gate. */
export interface GateScore { attemptId: string; gain: number; ms: number; rank: number }

export type Wire = { from: 'host' | 'crew'; msg: CrewToHost | HostToCrew };

/** Room codes avoid look-alike characters (0/O, 1/I/L). */
export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function randomId(n = 16): string {
  const b = new Uint8Array(n);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}

export function randomCode(len = 6): string {
  const b = new Uint8Array(len);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => CODE_ALPHABET[x % CODE_ALPHABET.length]).join('');
}

/** Minimum valid answers for a gate to count (see the design brief, §3.1). */
export function quorumFor(eligible: number): number {
  return eligible === 0 ? 0 : Math.min(eligible, 200, Math.max(3, Math.ceil(eligible * 0.2)));
}

export const POINTS_MAX = 100;
export const POINTS_MIN = 50;
const GRACE_MS = 2000;

/**
 * A correct answer earns 100 points within the first two seconds, sliding linearly to 50 at
 * the deadline: speed matters, but knowing the answer always matters more.
 */
export function pointsFor(ms: number, windowMs: number): number {
  const f = Math.min(1, Math.max(0, (ms - GRACE_MS) / Math.max(1, windowMs - GRACE_MS)));
  return Math.round(POINTS_MAX - (POINTS_MAX - POINTS_MIN) * f);
}

export function gateOutcome(eligible: number, answers: number, correct: number, practice: boolean, need = 0.5): { passed: boolean; failReason?: 'quorum' | 'accuracy' } {
  const quorumMet = practice ? answers > 0 : eligible > 0 && answers >= quorumFor(eligible);
  if (!quorumMet) return { passed: false, failReason: 'quorum' };
  return correct / answers >= need ? { passed: true } : { passed: false, failReason: 'accuracy' };
}
