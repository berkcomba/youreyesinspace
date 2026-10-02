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
  }

  get(id: string): CelestialBody | undefined {
    return this.byId.get(id);
  }

  /** The primary star */
  get star(): CelestialBody {
    return this.roots[0];
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
