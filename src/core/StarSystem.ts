import { Vector3 } from 'three';
import type { BodyData } from '../data/types';
import type { GeneratedBelt } from '../gen/SystemGenerator';
import { CelestialBody } from './CelestialBody';

/**
 * One star system: a hierarchical body graph with its own local origin.
 * Body positions are expressed in km relative to the system origin (the primary star's
 * barycentre); `origin` places the system in the galactic-scale frame (km, relative to the Sun).
 */
export class StarSystem {
  /** Bodies in hierarchical order (parents before children) */
  readonly bodies: CelestialBody[] = [];
  readonly byId = new Map<string, CelestialBody>();
  readonly roots: CelestialBody[] = [];

  constructor(
    readonly id: string,
    /** universal star id: `c{n}` for catalogue stars, `p…` for procedural ones */
    readonly starId: string,
    /** index into the StarCatalog (0 = Sun, -1 = procedural star) */
    readonly catalogIndex: number,
    /** system origin in km, scene frame, relative to the Sun */
    readonly origin: Vector3,
    catalogue: BodyData[],
    readonly belts: GeneratedBelt[],
    /** planet ids ordered for the 1..9 hotkeys */
    readonly planetIds: string[],
  ) {
    for (const d of catalogue) {
      const b = new CelestialBody(d);
      b.lookup = this.get;
      this.byId.set(b.id, b);
    }
    for (const d of catalogue) {
      const b = this.byId.get(d.id)!;
      if (d.parent) {
        const p = this.byId.get(d.parent);
        if (!p) throw new Error(`Unknown parent ${d.parent} for ${d.id}`);
        b.parent = p;
        p.children.push(b);
      } else {
        this.roots.push(b);
      }
    }
    const visit = (b: CelestialBody, depth: number) => {
      b.depth = depth;
      this.bodies.push(b);
      for (const c of b.children) visit(c, depth + 1);
    };
    for (const r of this.roots) visit(r, 0);
    for (const b of this.bodies) b.updateOrbitBasis();
    this.assignHosts();
  }

  readonly get = (id: string): CelestialBody | undefined => this.byId.get(id);

  /** Add a body at runtime (mission vehicles). The parent must already exist. */
  addBody(data: BodyData): CelestialBody {
    if (this.byId.has(data.id)) this.removeBody(data.id);
    const b = new CelestialBody(data);
    b.lookup = this.get;
    if (data.parent) {
      const p = this.byId.get(data.parent);
      if (!p) throw new Error(`Unknown parent ${data.parent} for ${data.id}`);
      b.parent = p;
      p.children.push(b);
      b.depth = p.depth + 1;
    } else {
      this.roots.push(b);
    }
    this.byId.set(b.id, b);
    this.bodies.push(b);
    b.updateOrbitBasis();
    this.assignHosts();
    return b;
  }

  /** Remove a runtime body (and its children) */
  removeBody(id: string): CelestialBody | undefined {
    const b = this.byId.get(id);
    if (!b) return undefined;
    for (const c of [...b.children]) this.removeBody(c.id);
    this.byId.delete(id);
    const i = this.bodies.indexOf(b);
    if (i >= 0) this.bodies.splice(i, 1);
    if (b.parent) {
      const j = b.parent.children.indexOf(b);
      if (j >= 0) b.parent.children.splice(j, 1);
    } else {
      const j = this.roots.indexOf(b);
      if (j >= 0) this.roots.splice(j, 1);
    }
    this.assignHosts();
    return b;
  }

  /**
   * The primary star. For hierarchical multiples (barycentre roots, possibly nested) it is the
   * catalogue star (`{system}-star`) when present, else the most luminous star of the hierarchy.
   */
  get star(): CelestialBody {
    if (this.primary && this.byId.get(this.primary.id) === this.primary) return this.primary;
    const r = this.roots[0];
    if (r.data.type !== 'barycenter') { this.primary = r; return r; }
    const named = this.byId.get(`${this.id}-star`);
    this.primary = named && named.data.type === 'star' ? named : (brightestBelow(r) ?? r.children[0] ?? r);
    return this.primary;
  }
  private primary: CelestialBody | null = null;

  /**
   * The star that lights `b`: the nearest star up its parent chain; when that chain reaches a
   * barycentre first (circumbinary planets), the most luminous star below the barycentre.
   */
  hostStarOf(b: CelestialBody): CelestialBody {
    const cached = this.hosts.get(b);
    if (cached) return cached;
    let host: CelestialBody | null = null;
    if (b.data.type === 'star' || b.data.type === 'pulsar') host = b;
    for (let p = b.parent; p && !host; p = p.parent) {
      if (p.data.type === 'star' || p.data.type === 'pulsar') host = p;
      else if (p.data.type === 'barycenter') host = brightestBelow(p);
    }
    host ??= this.star;
    this.hosts.set(b, host);
    return host;
  }
  private readonly hosts = new Map<CelestialBody, CelestialBody>();

  /** (Re)assign every body's lighting star (after construction / runtime changes) */
  private assignHosts(): void {
    this.hosts.clear();
    this.primary = null;
    for (const b of this.bodies) b.hostStar = b.data.type === 'star' || b.data.type === 'pulsar' || b.data.type === 'barycenter' ? null : this.hostStarOf(b);
  }

  /** Photosphere temperature of the primary (K) */
  get starTemperature(): number {
    const a = this.star.data.appearance;
    return a.kind === 'star' ? a.temperature : a.kind === 'pulsar' ? 28_000 : 5772;
  }

  update(jd: number, tSeconds: number): void {
    for (const b of this.bodies) {
      if (b.parent && !b.parent.data.pole) b.updateOrbitBasis();
      b.update(jd, tSeconds);
    }
  }

  /** Body whose gravitational influence dominates a point (system-local km). */
  dominantBody(point: { x: number; y: number; z: number }): CelestialBody {
    let best = this.star;
    let bestScore = -Infinity;
    for (const b of this.bodies) {
      const dx = b.position.x - point.x;
      const dy = b.position.y - point.y;
      const dz = b.position.z - point.z;
      const d2 = dx * dx + dy * dy + dz * dz;
      const soi = b.soiRadius;
      if (d2 < soi * soi) {
        const score = b.depth * 1e3 - Math.sqrt(d2) / soi;
        if (score > bestScore) {
          bestScore = score;
          best = b;
        }
      }
    }
    return best;
  }

  /** Nearest body by surface distance (system-local km) */
  nearestBody(point: { x: number; y: number; z: number }): { body: CelestialBody; altitude: number } {
    let best = this.star;
    let bestAlt = Infinity;
    for (const b of this.bodies) {
      const d = Math.sqrt(
        (b.position.x - point.x) ** 2 + (b.position.y - point.y) ** 2 + (b.position.z - point.z) ** 2,
      );
      const alt = d - b.radius;
      if (alt < bestAlt) {
        bestAlt = alt;
        best = b;
      }
    }
    return { body: best, altitude: bestAlt };
  }
}

/** Luminosity proxy R²T⁴ of a star body (0 for anything that does not shine) */
function shine(b: CelestialBody): number {
  const a = b.data.appearance;
  if (a.kind === 'star') return b.data.radius * b.data.radius * Math.pow(a.temperature / 5772, 4);
  if (a.kind === 'pulsar') return 1e-6;
  return 0;
}

/** Most luminous star anywhere below a barycentre */
function brightestBelow(bary: CelestialBody): CelestialBody | null {
  let best: CelestialBody | null = null, bestL = -1;
  const walk = (b: CelestialBody) => {
    for (const c of b.children) {
      if (c.data.type === 'barycenter') walk(c);
      else if (c.data.type === 'star' || c.data.type === 'pulsar') { const l = shine(c); if (l > bestL) { bestL = l; best = c; } }
    }
  };
  walk(bary);
  return best;
}
