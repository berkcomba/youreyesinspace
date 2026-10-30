import { randomCode, randomId } from './protocol';
import { ROOT } from './manifest';
import type { CrewRecord } from './engine';

export type { CrewRecord };

export interface Campaign {
  v: 1;
  id: string;
  /** community name shown to the crew */
  title: string;
  /** streamer / channel name */
  host: string;
  createdAt: number;
  updatedAt: number;
  /** join code, kept across sessions so a returning crew finds the same room */
  room: string;
  /** secret that claims `room` on the relay; never shown, never sent to phones */
  hostKey?: string;
  discovered: string[];
  assisted: string[];
  /** an expedition left mid-way (resumed on the next session) */
  progress: { nodeId: string; gate: number; attempt: number; used: number[]; assisted: boolean; correct: number; answers: number } | null;
  /** players and points when the cockpit runs the ledger itself (no relay); with the relay they live in its room */
  crew: Record<string, CrewRecord>;
  /** legacy (v1 prototype); points per gate are now tracked on each CrewRecord (`award`) */
  awarded: string[];
  stats: { sessions: number; gatesPassed: number; gatesFailed: number; overrides: number };
  /** hull (0–100) and a space event's bonus or penalty for the next gate */
  ship?: { hull: number; next?: { mult?: number; time?: number } };
  log: Array<{ t: number; text: string }>;
  settings: { practice: boolean; demoCrew: boolean; answerSeconds: number; voteSeconds: number; twitch?: string; kick?: string };
}

const KEY = 'yeits.expedition.v1';

interface Saved { campaigns: Record<string, Campaign>; last: string | null }

function read(): Saved {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? '') as Saved;
    if (s && typeof s === 'object' && s.campaigns) return s;
  } catch { /* first visit */ }
  return { campaigns: {}, last: null };
}

function write(s: Saved): void {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* quota: the backup file still works */ }
}

export function listCampaigns(): Campaign[] {
  return Object.values(read().campaigns).sort((a, b) => b.updatedAt - a.updatedAt);
}

export function lastCampaign(): Campaign | null {
  const s = read();
  return (s.last && s.campaigns[s.last]) || null;
}

export function createCampaign(title: string, host: string): Campaign {
  const now = Date.now();
  const c: Campaign = {
    v: 1, id: randomId(12), title, host, createdAt: now, updatedAt: now, room: randomCode(6), hostKey: randomId(32),
    discovered: [ROOT], assisted: [], progress: null, crew: {}, awarded: [],
    stats: { sessions: 0, gatesPassed: 0, gatesFailed: 0, overrides: 0 },
    log: [{ t: now, text: `Campaign founded by ${host}` }],
    settings: { practice: false, demoCrew: false, answerSeconds: 45, voteSeconds: 25 },
  };
  saveCampaign(c);
  return c;
}

export function saveCampaign(c: Campaign): void {
  c.updatedAt = Date.now();
  if (c.log.length > 400) c.log.splice(0, c.log.length - 400);
  c.awarded = [];
  // a big stream leaves thousands of passers-by: only players with points are worth the space
  const ids = Object.keys(c.crew);
  if (ids.length > 5000) for (const id of ids) if (c.crew[id].points === 0 && Date.now() - c.crew[id].lastSeen > 6 * 3600_000) delete c.crew[id];
  const s = read();
  s.campaigns[c.id] = c;
  s.last = c.id;
  write(s);
}

export function forgetCampaign(id: string): void {
  const s = read();
  delete s.campaigns[id];
  if (s.last === id) s.last = null;
  write(s);
}

/* ---- backup file: the campaign plus a checksum, so a damaged file is refused ---- */

async function digest(text: string): Promise<string> {
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(h).slice(0, 12), (x) => x.toString(16).padStart(2, '0')).join('');
}

export async function exportCampaign(c: Campaign): Promise<void> {
  const body = JSON.stringify(c);
  const file = JSON.stringify({ kind: 'yeis-expedition', v: 1, sum: await digest(body), campaign: c });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([file], { type: 'application/json' }));
  a.download = `expedition-${c.title.replace(/[^\w-]+/g, '-').toLowerCase() || 'campaign'}-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export async function importCampaign(file: File): Promise<Campaign> {
  const data = JSON.parse(await file.text()) as { kind?: string; sum?: string; campaign?: Campaign };
  if (data.kind !== 'yeis-expedition' || !data.campaign) throw new Error('This is not an Expedition save file.');
  if (data.sum !== await digest(JSON.stringify(data.campaign))) throw new Error('The save file is damaged or was edited.');
  const c = data.campaign;
  if (c.v !== 1 || !Array.isArray(c.discovered)) throw new Error('Unsupported save version.');
  saveCampaign(c);
  return c;
}
