import { Rng, hashSeed } from '../gen/SystemGenerator';
import { TYPE_CODE, vnoise, type GalaxySource } from './galaxies';

const MPC = 1e6;

export interface FarTierSpec {
  /** label for the HUD / info */
  label: string;
  /** inner and outer radius of the spherical shell (pc, from the Sun) */
  rMin: number;
  rMax: number;
  count: number;
  /**
   * 'web'   – discrete cluster nodes joined by filaments (readable structure)
   * 'noise' – statistically homogeneous mottled field (the universe beyond the homogeneity scale)
   */
  mode: 'web' | 'noise';
  /** web: number of nodes; noise: unused */
  nodes: number;
  /** noise wavelengths (pc) for the large-scale modulation and the smaller clumps */
  webScale: number;
  clumpScale: number;
  /** absolute-magnitude range of one aggregated point (bright = whole cluster / supercluster) */
  magBright: number;
  magFaint: number;
  /** physical radius (pc) of a point of magnitude `magFaint`; scales with luminosity^0.35 */
  radiusFaint: number;
  /** magnitude offset applied in the boosted view so each tier is visible at its own scale */
  boostMag: number;
  seed: number;
  /** camera distance from the Sun (pc) at which the tier fades in / out */
  fadeIn: [number, number];
  fadeOut: [number, number] | null;
}

/**
 * Beyond the ~250 Mpc volume that holds individual galaxies, the universe is drawn as
 * aggregated points: clusters out to a few Gpc, then supercluster-scale density knots out to
 * the particle horizon. Every tier is a Sun-centred spherical shell, so zooming out from the
 * Milky Way keeps revealing structure all the way to the edge of the observable universe.
 */
export const FAR_TIERS: FarTierSpec[] = [
  {
    label: 'Galaksi kümeleri',
    rMin: 5 * MPC, rMax: 2600 * MPC, count: 260_000, mode: 'web', nodes: 8000,
    webScale: 420 * MPC, clumpScale: 60 * MPC,
    magBright: -27.5, magFaint: -23.5, radiusFaint: 1.4 * MPC, boostMag: 0.0,
    seed: 0x0FA5B1,
    fadeIn: [120 * MPC, 350 * MPC], fadeOut: [3200 * MPC, 6500 * MPC],
  },
  {
    label: 'Süperküme kompleksleri',
    rMin: 1500 * MPC, rMax: 13_800 * MPC, count: 160_000, mode: 'noise', nodes: 0,
    webScale: 900 * MPC, clumpScale: 260 * MPC,
    magBright: -31.0, magFaint: -27.5, radiusFaint: 16 * MPC, boostMag: 1.5,
    seed: 0x5CA1E5,
    fadeIn: [1500 * MPC, 3500 * MPC], fadeOut: null,
  },
];

/** Comoving radius of the observable universe used by the app (pc). */
export const UNIVERSE_RADIUS_PC = 13_800 * MPC;

interface Node { x: number; y: number; z: number; rich: number; r: number }

export class FarTier implements GalaxySource {
  count = 0;
  readonly catalogCount = 0;
  readonly positions: Float32Array;
  readonly radius: Float32Array;
  readonly absMag: Float32Array;
  readonly type: Uint8Array;
  readonly seed: Uint32Array;
  readonly normal: Float32Array;
  readonly major: Float32Array;
  readonly axisRatio: Float32Array;
  private readonly rng: Rng;

  constructor(readonly spec: FarTierSpec) {
    const N = spec.count;
    this.positions = new Float32Array(N * 3);
    this.radius = new Float32Array(N);
    this.absMag = new Float32Array(N);
    this.type = new Uint8Array(N);
    this.seed = new Uint32Array(N);
    this.normal = new Float32Array(N * 3);
    this.major = new Float32Array(N * 3);
    this.axisRatio = new Float32Array(N);
    this.rng = new Rng(spec.seed);
    if (spec.mode === 'web') this.buildWeb();
    else this.buildNoise();
  }

  /* ------------------------------------------------------------------ */

  private gauss(): number {
    const u1 = Math.max(this.rng.next(), 1e-9), u2 = this.rng.next();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }

  /** Uniform random point in the shell */
  private shellPoint(out: [number, number, number]): void {
    const s = this.spec;
    const r = Math.cbrt(s.rMin ** 3 + (s.rMax ** 3 - s.rMin ** 3) * this.rng.next());
    const cz = this.rng.next() * 2 - 1;
    const phi = this.rng.next() * Math.PI * 2;
    const sxy = Math.sqrt(Math.max(0, 1 - cz * cz));
    out[0] = r * sxy * Math.cos(phi); out[1] = r * sxy * Math.sin(phi); out[2] = r * cz;
  }

  /** Append one aggregated point; `env` 0 = filament/field, 1 = cluster core */
  private place(x: number, y: number, z: number, env: number): void {
    const s = this.spec;
    const i = this.count;
    if (i >= s.count) return;
    const d = Math.sqrt(x * x + y * y + z * z);
    if (d < s.rMin || d > s.rMax) return;
    const rng = this.rng;
    const u = rng.next();
    const M = s.magFaint + (s.magBright - s.magFaint) * Math.pow(u, 2.2 - 1.2 * env) - env * 0.8;
    const lumRatio = Math.pow(10, -0.4 * (M - s.magFaint));
    this.positions[i * 3] = x; this.positions[i * 3 + 1] = y; this.positions[i * 3 + 2] = z;
    this.absMag[i] = M;
    this.radius[i] = s.radiusFaint * Math.pow(lumRatio, 0.35);
    this.type[i] = TYPE_CODE.E;
    this.seed[i] = hashSeed(i, s.seed, Math.floor(x / 1e7));
    this.axisRatio[i] = 0.55 + rng.next() * 0.45;
    // orientation is irrelevant for near-spherical blobs; keep a valid frame anyway
    const nl0 = rng.next() * 2 - 1, nl1 = rng.next() * 2 - 1, nl2 = rng.next() * 2 - 1;
    const nl = Math.hypot(nl0, nl1, nl2) || 1;
    const nx = nl0 / nl, ny = nl1 / nl, nz = nl2 / nl;
    this.normal[i * 3] = nx; this.normal[i * 3 + 1] = ny; this.normal[i * 3 + 2] = nz;
    // major = up × normal, with up = +Y unless the normal is nearly vertical
    const ux = Math.abs(ny) < 0.9 ? 0 : 1, uy = ux ? 0 : 1;
    let mx = uy * nz, my = -ux * nz, mz = ux * ny - uy * nx;
    const ml = Math.hypot(mx, my, mz) || 1;
    mx /= ml; my /= ml; mz /= ml;
    this.major[i * 3] = mx; this.major[i * 3 + 1] = my; this.major[i * 3 + 2] = mz;
    this.count++;
  }

  /** Cluster nodes + filaments (same recipe as the local volume, with a grid neighbour search). */
  private buildWeb(): void {
    const s = this.spec;
    const rng = this.rng;
    const p: [number, number, number] = [0, 0, 0];
    const s1 = 1 / s.webScale;

    // 1. nodes, denser where the very-large-scale noise is high
    const nodes: Node[] = [];
    let tries = 0;
    while (nodes.length < s.nodes && tries < s.nodes * 30) {
      tries++;
      this.shellPoint(p);
      const n1 = vnoise(p[0] * s1 + 13.1, p[1] * s1 + 7.7, p[2] * s1 + 3.3);
      if (rng.next() > 0.12 + 0.88 * n1 * n1) continue;
      const rich = Math.pow(rng.next(), 2.2);
      nodes.push({ x: p[0], y: p[1], z: p[2], rich, r: (2.5 + 6 * rich) * MPC });
    }

    const clusterBudget = Math.floor(s.count * 0.40);
    const filamentBudget = Math.floor(s.count * 0.44);
    const richSum = nodes.reduce((a, n) => a + 0.15 + n.rich, 0);

    // 2. cluster members
    for (const n of nodes) {
      const members = Math.max(3, Math.round(clusterBudget * (0.15 + n.rich) / richSum));
      for (let k = 0; k < members; k++) {
        const rad = n.r * 1.4 * Math.pow(rng.next(), 0.75) * (1 + 0.5 * Math.abs(this.gauss()));
        const gx = this.gauss(), gy = this.gauss(), gz = this.gauss();
        const gl = Math.hypot(gx, gy, gz) || 1;
        const env = Math.max(0, 1 - rad / (n.r * 2.5));
        this.place(n.x + gx / gl * rad, n.y + gy / gl * rad, n.z + gz / gl * rad, 0.5 + 0.5 * env);
      }
    }

    // 3. filaments to the 2–3 nearest nodes (spatial hash so this stays O(n))
    const cell = s.rMax * 2 / 24;
    const grid = new Map<number, number[]>();
    const key = (x: number, y: number, z: number) => {
      const ix = Math.floor((x + s.rMax) / cell), iy = Math.floor((y + s.rMax) / cell), iz = Math.floor((z + s.rMax) / cell);
      return (ix * 73856093) ^ (iy * 19349663) ^ (iz * 83492791);
    };
    nodes.forEach((n, i) => {
      const k = key(n.x, n.y, n.z);
      const list = grid.get(k);
      if (list) list.push(i); else grid.set(k, [i]);
    });
    const edges: Array<[number, number]> = [];
    const seen = new Set<number>();
    const cand: Array<[number, number]> = [];
    for (let a = 0; a < nodes.length; a++) {
      const na = nodes[a];
      cand.length = 0;
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
        const list = grid.get(key(na.x + dx * cell, na.y + dy * cell, na.z + dz * cell));
        if (!list) continue;
        for (const b of list) {
          if (b === a) continue;
          const nb = nodes[b];
          cand.push([(na.x - nb.x) ** 2 + (na.y - nb.y) ** 2 + (na.z - nb.z) ** 2, b]);
        }
      }
      cand.sort((u, v) => u[0] - v[0]);
      const links = Math.min(cand.length, 2 + (rng.next() < 0.5 ? 1 : 0));
      for (let k = 0; k < links; k++) {
        const b = cand[k][1];
        const id = a < b ? a * 65536 + b : b * 65536 + a;
        if (seen.has(id)) continue;
        seen.add(id);
        edges.push([a, b]);
      }
    }
    let lengthSum = 0;
    for (const [a, b] of edges) lengthSum += Math.hypot(nodes[a].x - nodes[b].x, nodes[a].y - nodes[b].y, nodes[a].z - nodes[b].z);
    for (const [a, b] of edges) {
      const na = nodes[a], nb = nodes[b];
      const L = Math.hypot(na.x - nb.x, na.y - nb.y, na.z - nb.z);
      const count = Math.round(filamentBudget * L / lengthSum);
      const bx0 = this.gauss(), by0 = this.gauss(), bz0 = this.gauss();
      const bl = Math.hypot(bx0, by0, bz0) || 1;
      const bow = L * 0.08 * rng.next();
      for (let k = 0; k < count; k++) {
        const t = rng.next();
        const sig = (0.012 + 0.008 * rng.next()) * L + 3 * MPC;
        const w = 4 * t * (1 - t) * bow;
        this.place(
          na.x + (nb.x - na.x) * t + bx0 / bl * w + this.gauss() * sig,
          na.y + (nb.y - na.y) * t + by0 / bl * w + this.gauss() * sig,
          na.z + (nb.z - na.z) * t + bz0 / bl * w + this.gauss() * sig,
          0.25,
        );
      }
    }

    // 4. field
    const s2 = 1 / s.clumpScale;
    tries = 0;
    while (this.count < s.count && tries < s.count * 10) {
      tries++;
      this.shellPoint(p);
      const n2 = vnoise(p[0] * s2 + 101.5, p[1] * s2 + 55.2, p[2] * s2 + 9.9);
      if (rng.next() > n2 * n2) continue;
      this.place(p[0], p[1], p[2], 0.05);
    }
  }

  /** Mottled, statistically homogeneous field. */
  private buildNoise(): void {
    const s = this.spec;
    const rng = this.rng;
    const p: [number, number, number] = [0, 0, 0];
    const s1 = 1 / s.webScale, s2 = 1 / s.clumpScale;
    let tries = 0;
    while (this.count < s.count && tries < s.count * 14) {
      tries++;
      this.shellPoint(p);
      const n1 = vnoise(p[0] * s1 + 13.1, p[1] * s1 + 7.7, p[2] * s1 + 3.3);
      const n2 = vnoise(p[0] * s2 + 101.5, p[1] * s2 + 55.2, p[2] * s2 + 9.9);
      const web = Math.pow(1 - Math.abs(n1 - 0.5) * 2, 4.0) * (0.1 + 0.9 * n2 * n2 * n2);
      if (rng.next() > web) continue;
      this.place(p[0], p[1], p[2], 0.3 * n2);
    }
  }

  /* ------------------------------------------------------------------ */

  name(i: number): string {
    return `${this.spec.label.replace(/leri$/, '')} YE-${(this.seed[i] % 0xffffff).toString(16).toUpperCase().padStart(6, '0')}`;
  }

  /** Visibility of the whole tier for a camera `dSun` pc from the Sun */
  fade(dSun: number): number {
    const [a, b] = this.spec.fadeIn;
    let f = smoothstep(a, b, dSun);
    if (this.spec.fadeOut) f *= 1 - smoothstep(this.spec.fadeOut[0], this.spec.fadeOut[1], dSun);
    return f;
  }
}

/** Fade of the detailed local galaxy index: gone once the camera is far outside it. */
export function localFade(dSun: number): number {
  return 1 - smoothstep(300 * MPC, 700 * MPC, dSun);
}

function smoothstep(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

export class FarUniverse {
  readonly tiers: FarTier[];
  constructor(specs: FarTierSpec[] = FAR_TIERS) {
    this.tiers = specs.map((s) => new FarTier(s));
  }
}
