import { DAY_S } from './constants';

/**
 * Sampled spacecraft ephemerides from NASA/JPL Horizons (see scripts/fetch-horizons.mjs).
 *
 * A table is a list of uniformly sampled position segments, each relative to a named body of the
 * simulation (km, ecliptic J2000 math frame). Segments are stored densest first; `sample()` picks
 * the first segment covering the requested time and interpolates with a 4-point Lagrange
 * polynomial (position) and its derivative (velocity). Outside every segment the body is hidden:
 * nothing is ever extrapolated beyond what Horizons published.
 *
 * Tables load on demand. `ensure()` only schedules a background fetch a few seconds after boot,
 * so a plain visit stays light; `prioritize()` (event opened, body selected) fetches at once.
 */
export interface EphemSegment {
  center: string;
  jd0: number;
  /** sample spacing, days */
  step: number;
  n: number;
  /** flat xyz, km */
  p: number[];
}

export interface EphemTable {
  id: string;
  name: string;
  target: string;
  source: string;
  frame: string;
  fetched: string;
  segments: EphemSegment[];
}

export type EphemStatus = 'idle' | 'loading' | 'ready' | 'missing';

type V3 = { x: number; y: number; z: number; set(x: number, y: number, z: number): unknown };

const IDLE_DELAY_MS = 7000;

class EphemerisStore {
  private readonly tables = new Map<string, EphemTable>();
  private readonly status = new Map<string, EphemStatus>();
  private readonly pending = new Map<string, Promise<EphemTable | null>>();
  private readonly listeners = new Set<(id: string) => void>();
  private idleTimer = 0;
  private readonly queue = new Set<string>();
  /** fetches scheduled by ensure() stay queued while this is true (embed mode keeps traffic minimal) */
  deferBackground = false;

  get(id: string): EphemTable | undefined {
    return this.tables.get(id);
  }

  state(id: string): EphemStatus {
    return this.status.get(id) ?? 'idle';
  }

  onLoad(fn: (id: string) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /** Queue a table for a background fetch shortly after boot. */
  ensure(id: string): void {
    if (this.status.has(id) || this.queue.has(id)) return;
    this.queue.add(id);
    if (!this.idleTimer) {
      this.idleTimer = window.setTimeout(() => {
        this.idleTimer = 0;
        if (this.deferBackground) { this.idleTimer = window.setTimeout(() => this.flush(), IDLE_DELAY_MS); return; }
        this.flush();
      }, IDLE_DELAY_MS);
    }
  }

  private flush(): void {
    for (const id of this.queue) void this.prioritize(id);
    this.queue.clear();
  }

  /** Fetch now (idempotent). Resolves to the table, or null when it does not exist. */
  prioritize(id: string): Promise<EphemTable | null> {
    this.queue.delete(id);
    const t = this.tables.get(id);
    if (t) return Promise.resolve(t);
    const p = this.pending.get(id);
    if (p) return p;
    this.status.set(id, 'loading');
    const base = import.meta.env.BASE_URL.replace(/\/$/, '');
    const job = fetch(`${base}/ephem/${id}.json`)
      .then((r) => (r.ok ? (r.json() as Promise<EphemTable>) : null))
      .catch(() => null)
      .then((tab) => {
        this.pending.delete(id);
        if (!tab || !Array.isArray(tab.segments)) { this.status.set(id, 'missing'); return null; }
        tab.segments.sort((a, b) => a.step - b.step);
        this.tables.set(id, tab);
        this.status.set(id, 'ready');
        for (const fn of this.listeners) fn(id);
        return tab;
      });
    this.pending.set(id, job);
    return job;
  }

  /** [first, last] Julian date covered by the table (or null when not loaded / empty) */
  span(id: string): [number, number] | null {
    const t = this.tables.get(id);
    if (!t || !t.segments.length) return null;
    let a = Infinity, b = -Infinity;
    for (const s of t.segments) { a = Math.min(a, s.jd0); b = Math.max(b, s.jd0 + s.step * (s.n - 1)); }
    return [a, b];
  }

  /**
   * Interpolate position (km) and velocity (km/s) at `jd`, math frame, relative to the returned
   * centre body id. Returns null when the table is not loaded or `jd` is outside it.
   */
  sample(id: string, jd: number, outPos: V3, outVel: V3): string | null {
    const t = this.tables.get(id);
    if (!t) return null;
    for (const s of t.segments) {
      const last = s.jd0 + s.step * (s.n - 1);
      if (jd < s.jd0 || jd > last) continue;
      const u = (jd - s.jd0) / s.step;
      // indices i0..i3 around u, clamped at the ends
      let i1 = Math.floor(u);
      if (i1 > s.n - 2) i1 = s.n - 2;
      if (i1 < 1) i1 = Math.min(1, s.n - 2);
      const i0 = Math.max(0, i1 - 1), i2 = Math.min(s.n - 1, i1 + 1), i3 = Math.min(s.n - 1, i1 + 2);
      const x = u - i1; // local parameter in [0,1] between i1 and i2 (nodes at -1,0,1,2)
      if (s.n < 4) {
        // very short table: linear
        const f = Math.min(1, Math.max(0, x));
        lerp(s.p, i1, i2, f, outPos);
        const k = 1 / (s.step * DAY_S);
        outVel.set((s.p[i2 * 3] - s.p[i1 * 3]) * k, (s.p[i2 * 3 + 1] - s.p[i1 * 3 + 1]) * k, (s.p[i2 * 3 + 2] - s.p[i1 * 3 + 2]) * k);
        return s.center;
      }
      // Lagrange basis for nodes -1,0,1,2
      const l0 = -x * (x - 1) * (x - 2) / 6;
      const l1 = (x + 1) * (x - 1) * (x - 2) / 2;
      const l2 = -(x + 1) * x * (x - 2) / 2;
      const l3 = (x + 1) * x * (x - 1) / 6;
      // derivatives d/dx
      const d0 = -(3 * x * x - 6 * x + 2) / 6;
      const d1 = (3 * x * x - 4 * x - 1) / 2;
      const d2 = -(3 * x * x - 2 * x - 2) / 2;
      const d3 = (3 * x * x - 1) / 6;
      const p = s.p;
      const a = i0 * 3, b = i1 * 3, c = i2 * 3, d = i3 * 3;
      outPos.set(
        l0 * p[a] + l1 * p[b] + l2 * p[c] + l3 * p[d],
        l0 * p[a + 1] + l1 * p[b + 1] + l2 * p[c + 1] + l3 * p[d + 1],
        l0 * p[a + 2] + l1 * p[b + 2] + l2 * p[c + 2] + l3 * p[d + 2],
      );
      const k = 1 / (s.step * DAY_S);
      outVel.set(
        (d0 * p[a] + d1 * p[b] + d2 * p[c] + d3 * p[d]) * k,
        (d0 * p[a + 1] + d1 * p[b + 1] + d2 * p[c + 1] + d3 * p[d + 1]) * k,
        (d0 * p[a + 2] + d1 * p[b + 2] + d2 * p[c + 2] + d3 * p[d + 2]) * k,
      );
      return s.center;
    }
    return null;
  }
}

function lerp(p: number[], i: number, j: number, f: number, out: V3): void {
  out.set(
    p[i * 3] + (p[j * 3] - p[i * 3]) * f,
    p[i * 3 + 1] + (p[j * 3 + 1] - p[i * 3 + 1]) * f,
    p[i * 3 + 2] + (p[j * 3 + 2] - p[i * 3 + 2]) * f,
  );
}

export const ephemeris = new EphemerisStore();
