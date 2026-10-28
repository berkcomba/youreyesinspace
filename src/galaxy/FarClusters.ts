import { Vector3 } from 'three';
import { Rng, hashSeed } from '../gen/SystemGenerator';
import { _ } from '../i18n';
import { TYPE_CODE, type GalaxySource } from './galaxies';
import type { FarTier } from './FarUniverse';

const MPC = 1e6;

/** A far-universe point: tier k, index i within it */
export interface FarRef {
  tier: number;
  index: number;
  /** member galaxy of the resolved cluster, -1 = the cluster itself */
  member: number;
}

export function farKey(r: FarRef): string { return `f${r.tier}:${r.index}${r.member >= 0 ? `#${r.member}` : ''}`; }
export function sameFar(a: FarRef | null, b: FarRef | null): boolean {
  return !!a && !!b && a.tier === b.tier && a.index === b.index && a.member === b.member;
}

/**
 * One aggregated far-universe point resolved into its member galaxies: a cored (King-like)
 * distribution, Schechter-like luminosities, the morphology–density relation (ellipticals and
 * lenticulars in the core, spirals in the outskirts) and a giant cD at the centre of the rich
 * ones. Deterministic for the (tier, index) pair.
 */
export class FarCluster implements GalaxySource {
  readonly count: number;
  readonly catalogCount = 0;
  readonly positions: Float32Array;
  readonly radius: Float32Array;
  readonly absMag: Float32Array;
  readonly type: Uint8Array;
  readonly seed: Uint32Array;
  readonly normal: Float32Array;
  readonly major: Float32Array;
  readonly axisRatio: Float32Array;
  readonly arms: Float32Array;
  readonly pitch: Float32Array;
  /** cluster centre (pc, scene) and the tier point's radius (pc) */
  readonly centre: Vector3;
  readonly radiusPc: number;
  /** richness: number of members above the sprite limit */
  readonly richness: number;
  /** rough total luminosity (solar) and virial-ish mass (solar) of the cluster */
  readonly luminosity: number;
  readonly massSolar: number;

  constructor(readonly tier: FarTier, readonly index: number, readonly tierIndex: number) {
    const p = tier.positions;
    this.centre = new Vector3(p[index * 3], p[index * 3 + 1], p[index * 3 + 2]);
    this.radiusPc = tier.radius[index];
    const M = tier.absMag[index];
    const lum = Math.pow(10, (4.83 - M) / 2.5);
    this.luminosity = lum;
    // a galaxy cluster's luminosity is carried by ~L*/3 galaxies on average: L* ≈ 2e10 L☉
    const rng = new Rng(hashSeed(tier.seed[index], tierIndex, 0xfa7));
    const supercluster = tier.spec.mode !== 'web';
    const n = Math.min(900, Math.max(20, Math.round((lum / 7e9) * (supercluster ? 0.25 : 1) * rng.range(0.8, 1.25))));
    this.count = n;
    this.richness = n;
    this.massSolar = lum * 250; // M/L ≈ 250 for clusters (dark-matter dominated)
    this.positions = new Float32Array(n * 3);
    this.radius = new Float32Array(n);
    this.absMag = new Float32Array(n);
    this.type = new Uint8Array(n);
    this.seed = new Uint32Array(n);
    this.normal = new Float32Array(n * 3);
    this.major = new Float32Array(n * 3);
    this.axisRatio = new Float32Array(n);
    this.arms = new Float32Array(n);
    this.pitch = new Float32Array(n);

    const R = this.radiusPc;
    const rc = R * (supercluster ? 0.3 : 0.12); // core radius
    const nrm = new Vector3(), tmp = new Vector3(), maj = new Vector3();
    for (let i = 0; i < n; i++) {
      // King-like radial profile, truncated at ~1.6 R; superclusters: several sub-clumps
      let r: number;
      let cx = 0, cy = 0, cz = 0;
      if (supercluster) {
        const clump = i % 5;
        const cr = new Rng(hashSeed(tier.seed[index], clump, 0x5c));
        const cd = R * cr.range(0.2, 0.9);
        const zc = cr.range(-1, 1), th = cr.range(0, Math.PI * 2), rr = Math.sqrt(1 - zc * zc);
        cx = rr * Math.cos(th) * cd; cy = rr * Math.sin(th) * cd; cz = zc * cd;
        r = rc * 0.5 * Math.sqrt(1 / Math.max(rng.next(), 1e-4) - 1);
      } else {
        r = rc * 1.8 * Math.sqrt(1 / Math.max(rng.next(), 1e-4) - 1);
      }
      r = Math.min(r, R * 1.6);
      const zc = rng.range(-1, 1), th = rng.range(0, Math.PI * 2), rr = Math.sqrt(1 - zc * zc);
      const x = cx + rr * Math.cos(th) * r, y = cy + rr * Math.sin(th) * r, z = cz + zc * r;
      // Schechter-like luminosity: -22.5 … -17 with a steep faint end; the central cD brighter
      let Mg: number;
      if (i === 0 && !supercluster && n > 80) Mg = -23.5 + rng.range(-0.5, 0.3);
      else Mg = -17 - 5.5 * Math.pow(rng.next(), 2.2) + rng.range(-0.3, 0.3);
      // morphology–density: ellipticals / S0 dominate the core, spirals the outskirts
      const dens = Math.exp(-r / (rc * 1.5));
      const u = rng.next();
      const pE = 0.15 + 0.5 * dens, pS0 = pE + 0.15 + 0.2 * dens;
      const t = i === 0 && Mg < -23 ? 'E' : u < pE ? 'E' : u < pS0 ? 'S0' : u < 0.93 ? (rng.chance(0.55) ? 'SB' : 'S') : 'Irr';
      this.positions[i * 3] = this.centre.x + x; this.positions[i * 3 + 1] = this.centre.y + y; this.positions[i * 3 + 2] = this.centre.z + z;
      this.absMag[i] = Mg;
      this.radius[i] = 2000 * Math.pow(10, (-Mg - 16) / 5) * (t === 'Irr' ? 0.6 : t === 'E' && Mg < -23 ? 1.8 : 1);
      this.type[i] = TYPE_CODE[t];
      this.seed[i] = hashSeed(tier.seed[index], i, 0x9a1a);
      this.axisRatio[i] = t === 'E' ? 0.5 + rng.next() * 0.5 : 0.08 + rng.next() * 0.08;
      this.arms[i] = t === 'SB' ? (rng.chance(0.7) ? 2 : 4) : rng.chance(0.6) ? 2 : rng.int(3, 4);
      this.pitch[i] = rng.range(8, 25);
      nrm.set(rng.next() * 2 - 1, rng.next() * 2 - 1, rng.next() * 2 - 1).normalize();
      tmp.set(Math.abs(nrm.y) < 0.9 ? 0 : 1, Math.abs(nrm.y) < 0.9 ? 1 : 0, 0);
      maj.crossVectors(tmp, nrm).normalize();
      this.normal[i * 3] = nrm.x; this.normal[i * 3 + 1] = nrm.y; this.normal[i * 3 + 2] = nrm.z;
      this.major[i * 3] = maj.x; this.major[i * 3 + 1] = maj.y; this.major[i * 3 + 2] = maj.z;
    }
  }

  get clusterName(): string { return this.tier.name(this.index); }

  name(i: number): string {
    const code = (this.seed[i] % 0xffff).toString(16).toUpperCase().padStart(4, '0');
    return `${this.clusterName.replace(/^.*YE-/, 'YE-')}-${code}`;
  }

  typeCode(i: number): number { return this.type[i]; }

  /** distance (pc) of the camera from the cluster centre in units of its radius */
  ratio(camPc: Vector3): number { return this.centre.distanceTo(camPc) / Math.max(this.radiusPc, 1); }
}

/** the knot resolves into galaxies once the camera is within this many radii */
export const RESOLVE_RATIO = 25;
/** a member galaxy within this many of its radii is adopted as a real galaxy (cloud, stars, interior) */
export const ADOPT_RATIO = 18;

/** Which far-universe point the camera is closest to (in radii), among the visible tiers. */
export function nearestFarPoint(tiers: FarTier[], camPc: Vector3, tierVisible: (k: number) => boolean): { tier: number; index: number; ratio: number } | null {
  let best: { tier: number; index: number; ratio: number } | null = null;
  for (let k = 0; k < tiers.length; k++) {
    if (!tierVisible(k)) continue;
    const t = tiers[k];
    const p = t.positions, r = t.radius;
    // coarse rejection: anything farther than 60 Mpc cannot be within RESOLVE_RATIO radii
    const lim2 = (60 * MPC) * (60 * MPC);
    for (let i = 0; i < t.count; i++) {
      const dx = p[i * 3] - camPc.x, dy = p[i * 3 + 1] - camPc.y, dz = p[i * 3 + 2] - camPc.z;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 > lim2) continue;
      const ratio = Math.sqrt(d2) / Math.max(r[i], 1);
      if (!best || ratio < best.ratio) best = { tier: k, index: i, ratio };
    }
  }
  return best;
}

export function farKindLabel(tier: FarTier): string {
  return tier.spec.mode === 'web' ? _('Prosedürel galaksi kümesi') : _('Prosedürel süperküme düğümü');
}
