import { Matrix3, Vector3 } from 'three';
import type { Rng } from '../gen/SystemGenerator';

export type GalaxyType = 'E' | 'S0' | 'S' | 'SB' | 'Irr';

export const GALAXY_TYPE_LABEL: Record<GalaxyType, string> = {
  E: 'Eliptik', S0: 'Lentiküler', S: 'Sarmal', SB: 'Çubuklu sarmal', Irr: 'Düzensiz',
};

export interface GalaxyParams {
  id: string;
  name: string;
  type: GalaxyType;
  seed: number;
  /** centre, pc, scene frame, relative to the Sun */
  center: Vector3;
  /** columns: in-plane X, disc normal Y, in-plane Z (scene frame) */
  basis: Matrix3;
  /** visible radius (pc) */
  radius: number;
  /** absolute visual magnitude of the whole galaxy */
  absMag: number;
  /** number of spiral arms (S / SB) */
  arms: number;
  /** pitch angle (deg) */
  pitchDeg: number;
  /** b/a for ellipticals, disc thickness proxy otherwise */
  axisRatio: number;
  description?: string;
  /** true for real, named galaxies */
  catalog: boolean;
  /** distance from the Sun (pc) – cached */
  distancePc: number;
}

export type Population = 'bulge' | 'disc' | 'arm' | 'hii' | 'halo';

export const POPULATION_COLOR: Record<Population, [number, number, number]> = {
  bulge: [1.0, 0.86, 0.66],
  disc: [1.0, 0.93, 0.82],
  arm: [0.78, 0.85, 1.0],
  hii: [1.0, 0.62, 0.72],
  halo: [1.0, 0.9, 0.78],
};

const _tmp = new Vector3();

/**
 * Analytic galaxy model: density field for procedural star placement and a sampler that
 * produces the "far tier" point cloud. Local coordinates: X,Z in the disc plane, Y = normal (pc).
 */
export class GalaxyModel {
  readonly p: GalaxyParams;
  readonly luminosity: number;
  readonly scaleLength: number;
  readonly scaleHeight: number;
  readonly bulgeRadius: number;
  readonly barLength: number;
  private readonly armPhase: number[] = [];
  private readonly armWeight: number[] = [];
  private readonly armCdf: number[] = [];
  private readonly blobs: Array<{ c: Vector3; s: number; w: number }> = [];

  constructor(params: GalaxyParams) {
    this.p = params;
    this.luminosity = Math.pow(10, (4.83 - params.absMag) / 2.5);
    const R = params.radius;
    this.scaleLength = R / 3.6;
    this.scaleHeight = params.type === 'E' ? R * params.axisRatio : R * 0.022;
    this.bulgeRadius = params.type === 'E' ? R * 0.45 : params.type === 'S0' ? R * 0.3 : R * 0.09;
    this.barLength = params.type === 'SB' ? R * 0.3 : 0;
    const n = Math.max(1, params.arms);
    for (let k = 0; k < n; k++) {
      this.armPhase.push((2 * Math.PI * k) / n + (params.type === 'SB' ? 0 : 0.3));
      // barred spirals: the two arms leaving the bar ends dominate, the others are minor
      this.armWeight.push(params.type === 'SB' && n > 2 && k % 2 === 1 ? 0.4 : 1);
    }
    const wsum = this.armWeight.reduce((a, b) => a + b, 0);
    let acc = 0;
    for (const w of this.armWeight) { acc += w / wsum; this.armCdf.push(acc); }
    // irregular galaxies: a handful of star-forming clumps
    let s = params.seed >>> 0;
    const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    const nb = 3 + Math.floor(rnd() * 4);
    for (let i = 0; i < nb; i++) {
      this.blobs.push({
        c: new Vector3((rnd() - 0.5) * R * 1.2, (rnd() - 0.5) * R * 0.3, (rnd() - 0.5) * R * 1.2),
        s: R * (0.2 + rnd() * 0.3), w: 0.4 + rnd(),
      });
    }
  }

  get radius(): number { return this.p.radius; }
  get center(): Vector3 { return this.p.center; }
  get basis(): Matrix3 { return this.p.basis; }

  /** scene-frame pc (relative to the Sun) → galaxy-local pc */
  toLocal(scenePc: Vector3, out = new Vector3()): Vector3 {
    _tmp.copy(scenePc).sub(this.p.center);
    const m = this.p.basis.elements;
    return out.set(
      m[0] * _tmp.x + m[1] * _tmp.y + m[2] * _tmp.z,
      m[3] * _tmp.x + m[4] * _tmp.y + m[5] * _tmp.z,
      m[6] * _tmp.x + m[7] * _tmp.y + m[8] * _tmp.z,
    );
  }

  /** galaxy-local pc → scene-frame pc (relative to the Sun) */
  toScene(local: Vector3, out = new Vector3()): Vector3 {
    return out.copy(local).applyMatrix3(this.p.basis).add(this.p.center);
  }

  /** Angular offset (rad) to the nearest arm ridge at cylindrical radius r */
  private armDistance(r: number, theta: number): number {
    const tanP = Math.tan((this.p.pitchDeg * Math.PI) / 180);
    const r0 = Math.max(this.barLength, this.bulgeRadius * 0.8);
    const base = Math.log(Math.max(r, r0) / r0) / Math.max(tanP, 0.05);
    let best = Math.PI;
    for (let k = 0; k < this.armPhase.length; k++) {
      let d = theta - (base + this.armPhase[k]);
      d = Math.atan2(Math.sin(d), Math.cos(d));
      // minor arms count as "further away" so they modulate the density less
      best = Math.min(best, Math.abs(d) / this.armWeight[k]);
    }
    return best;
  }

  /**
   * Relative stellar density at a local point. Normalised so that a Milky-Way-like disc has
   * ≈1 at the solar radius (8.2 kpc) in the mid-plane.
   */
  density(local: Vector3): number {
    const t = this.p.type;
    const R = this.p.radius;
    if (t === 'Irr') {
      let d = 0;
      for (const b of this.blobs) {
        const dx = local.x - b.c.x, dy = (local.y - b.c.y) * 2.0, dz = local.z - b.c.z;
        d += b.w * Math.exp(-(dx * dx + dy * dy + dz * dz) / (2 * b.s * b.s));
      }
      return d * 3;
    }
    const r = Math.hypot(local.x, local.z);
    if (t === 'E') {
      const q = Math.max(0.3, this.p.axisRatio);
      const rr = Math.hypot(r, local.y / q) / this.bulgeRadius + 1e-3;
      return 6 / (rr * Math.pow(1 + rr, 3));
    }
    // disc
    const h = this.scaleLength, hz = this.scaleHeight;
    const sech = 1 / Math.cosh(local.y / hz);
    let disc = Math.exp(-(r - 8200 * (R / 15000)) / h) * sech * sech;
    if (r > R * 1.25) disc *= Math.exp(-(r - R * 1.25) / (R * 0.1));
    if (t === 'S' || t === 'SB') {
      const theta = Math.atan2(local.z, local.x);
      const da = this.armDistance(r, theta);
      const armW = 0.34;
      const arm = Math.exp(-(da * da) / (2 * armW * armW));
      disc *= 0.55 + 1.6 * arm;
      if (this.barLength > 0 && r < this.barLength) {
        const bar = Math.exp(-Math.pow(local.z / (this.barLength * 0.25), 2));
        disc *= 0.6 + 2.5 * bar;
      }
    }
    // bulge (Hernquist-like), flattened
    const rb = Math.hypot(r, local.y / 0.7) / this.bulgeRadius + 1e-3;
    const bulge = 12 / (rb * Math.pow(1 + rb, 3));
    return disc + bulge;
  }

  /** Sample one point of the far-tier cloud. Returns local pc and the population. */
  sample(rng: Rng, out: Vector3): Population {
    const t = this.p.type;
    const R = this.p.radius;
    if (t === 'Irr') {
      if (rng.chance(0.55)) {
        // diffuse old population
        const h = R / 2.2;
        const r = Math.min(-h * (Math.log(Math.max(rng.next(), 1e-9)) + Math.log(Math.max(rng.next(), 1e-9))), R * 1.2);
        const th = rng.next() * Math.PI * 2;
        out.set(r * Math.cos(th), gauss(rng) * R * 0.12, r * Math.sin(th));
        return 'disc';
      }
      const b = this.blobs[Math.floor(rng.next() * this.blobs.length)];
      out.set(b.c.x + gauss(rng) * b.s, b.c.y + gauss(rng) * b.s * 0.5, b.c.z + gauss(rng) * b.s);
      return rng.chance(0.25) ? 'hii' : 'arm';
    }
    if (t === 'E') {
      const u = Math.min(rng.next(), 0.985);
      const su = Math.sqrt(u);
      const r = Math.min(this.bulgeRadius * (su / (1 - su)), R * 1.4);
      randomDir(rng, out).multiplyScalar(r);
      out.y *= Math.max(0.3, this.p.axisRatio);
      return 'bulge';
    }
    const bulgeFrac = t === 'S0' ? 0.45 : 0.13;
    if (rng.next() < bulgeFrac) {
      const u = Math.min(rng.next(), 0.97);
      const su = Math.sqrt(u);
      const r = Math.min(this.bulgeRadius * (su / (1 - su)), R * 0.6);
      randomDir(rng, out).multiplyScalar(r);
      out.y *= 0.7;
      return 'bulge';
    }
    // exponential disc: r ~ Gamma(2, h)
    const h = this.scaleLength;
    let r = -h * (Math.log(Math.max(rng.next(), 1e-9)) + Math.log(Math.max(rng.next(), 1e-9)));
    r = Math.min(r, R * 1.3);
    let theta = rng.next() * Math.PI * 2;
    let pop: Population = 'disc';
    if (t === 'S' || t === 'SB') {
      if (this.barLength > 0 && r < this.barLength * 0.85 && rng.chance(0.35)) {
        theta = (rng.chance(0.5) ? 0 : Math.PI) + gauss(rng) * 0.22;
        pop = 'bulge';
      } else if (rng.chance(0.5)) {
        // snap toward the nearest arm ridge
        const tanP = Math.tan((this.p.pitchDeg * Math.PI) / 180);
        const r0 = Math.max(this.barLength, this.bulgeRadius * 0.8);
        const base = Math.log(Math.max(r, r0) / r0) / Math.max(tanP, 0.05);
        const u = rng.next();
        let k = 0;
        while (k < this.armCdf.length - 1 && u > this.armCdf[k]) k++;
        const ph = this.armPhase[k];
        theta = base + ph + gauss(rng) * (0.2 + 0.12 * Math.min(1, r / R));
        pop = rng.chance(0.12) ? 'hii' : 'arm';
      }
    }
    const hz = this.scaleHeight * (pop === 'arm' || pop === 'hii' ? 0.6 : 1.4);
    const uz = Math.min(Math.max(rng.next(), 1e-6), 1 - 1e-6);
    const z = hz * Math.atanh(2 * uz - 1);
    out.set(r * Math.cos(theta), z, r * Math.sin(theta));
    return pop;
  }
}

function gauss(rng: Rng): number {
  const u1 = Math.max(rng.next(), 1e-9), u2 = rng.next();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function randomDir(rng: Rng, out: Vector3): Vector3 {
  const z = rng.next() * 2 - 1;
  const t = rng.next() * Math.PI * 2;
  const s = Math.sqrt(1 - z * z);
  return out.set(s * Math.cos(t), z, s * Math.sin(t));
}
