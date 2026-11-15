import { Vector3, Vector4 } from 'three';
import type { Rng } from '../gen/SystemGenerator';
import type { Population } from './GalaxyModel';

/**
 * Hand-drawn structure of peculiar galaxies: rings (collisional, Hoag-type, polar), tidal tails
 * and warped discs, laid over an ordinary host galaxy. Lengths are in units of the galaxy's
 * radius, which for these galaxies is the extent of the whole system (tails included); the host
 * occupies `body` of it. Host-local frame as in GalaxyModel: X, Z in the disc plane, Y its normal.
 *
 * The same profiles drive the analytic density (procedural stars), the point cloud, the
 * raymarched volume (volume_galaxy.frag) and the sprite (galaxy.frag), so the shape is the same
 * at every distance.
 */

const DEG = Math.PI / 180;
const TAU = Math.PI * 2;
const SQRT_TAU = Math.sqrt(TAU);
/** spokes peak at this share of their ring's density */
const SPOKE_REL = 0.35;
/** a tail's profile runs over s ∈ [TAIL_S0, 1] (s < 0: still inside the host) */
const TAIL_S0 = -0.15;
/** ∫ of the sprite's normalised brightness over the unit disc (galaxy.vert) */
const SPRITE_FLUX = 0.61;
export const MAX_RINGS = 2;
export const MAX_TAILS = 2;
/** RGBA texels per galaxy in the sprite's parameter texture */
export const PEC_TEXELS = 20;

export interface PecRingSpec {
  /** radius and radial gaussian width */
  r: number; w: number;
  /** thickness (gaussian, out of the ring's plane) */
  h?: number;
  /** centre offset in the host's plane (off-centre collisional rings) */
  ox?: number; oz?: number;
  /** ring plane tilted by `tilt` (deg) about the in-plane axis at azimuth `tiltAz` (deg): 90 = polar */
  tilt?: number; tiltAz?: number;
  /** brightness left on the faint side (1: even; C-shaped and lopsided rings less) and where the bright side is (deg) */
  arc?: number; arcPhase?: number;
  /** spokes from `spokeIn` out to the ring (the Cartwheel's) */
  spokes?: number; spokeIn?: number;
  /** outer / inner width (1: symmetric; > 1 a sharp inner edge and a fluffy outside) */
  skew?: number;
  /** width varying round the ring by ± this share, its crest wandering by as many widths */
  wobble?: number;
  /** tightly wound filaments the ring is made of: how many, how far round they wind across one
   *  width (rad) and how strongly they stand out (0 … 1) */
  strands?: number; twist?: number; strandAmp?: number;
  /** share of the galaxy's light; 0 old and yellow … 1 young and blue; star-forming clumps; dust */
  light: number; young: number; knots?: number; dust?: number;
}

export interface PecTailSpec {
  /** where it leaves the host (deg, in-plane angle from X toward Z) and the angle it sweeps over its length (deg) */
  phase: number; sweep: number;
  /** start and end radius; height out of the plane at the end */
  r0: number; r1: number; lift?: number;
  /** gaussian width at the start and the end */
  w0: number; w1: number;
  light: number; young: number; knots?: number; dust?: number;
}

export interface PeculiarSpec {
  /** what the galaxy is, shown instead of the Hubble type (Turkish source string) */
  label: string;
  /** the host galaxy's radius as a share of the whole system's */
  body?: number;
  rings?: PecRingSpec[];
  tails?: PecTailSpec[];
  /** integral-sign warp: height of the disc's rim above / below its plane (radii) */
  bend?: number;
}

interface Ring {
  r: number; w: number; h: number; ox: number; oz: number;
  cAz: number; sAz: number; cT: number; sT: number;
  arc: number; arcPhase: number; spokes: number; spokeIn: number; sw: number;
  /** inner and outer widths (their mean is w) */
  wIn: number; wOut: number;
  wobble: number; strands: number; twist: number; strandAmp: number;
  light: number; young: number; knots: number; dust: number;
  /** ∫ in-plane profile dA (unit amplitude); the spokes' part of it */
  plane: number; spokeFrac: number;
  /** model density at the ring's crest (see normalise) */
  amp: number;
}

interface Tail {
  phase: number; sweep: number; r0: number; r1: number; lift: number; w0: number; w1: number;
  light: number; young: number; knots: number; dust: number;
  /** ∫ profile dV and ∫ in-plane column dA (unit amplitude); sampling envelope maximum */
  vol: number; plane: number; maxW: number;
  amp: number;
}

function smoothstep(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

function gauss(rng: Rng): number {
  const u1 = Math.max(rng.next(), 1e-9), u2 = rng.next();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(TAU * u2);
}

function tailEnv(s: number): number {
  return smoothstep(TAIL_S0, 0.08, s) * Math.pow(1 - Math.min(1, Math.max(0, s)), 0.7);
}

/** where the stars of a component of this colour and clumpiness count (point cloud colours) */
function populationOf(rng: Rng, young: number, knots: number): Population {
  if (rng.next() < young) return rng.next() < 0.04 + 0.12 * knots ? 'hii' : 'arm';
  return young < 0.25 ? 'bulge' : 'disc';
}

const _q = new Vector3();

export class Peculiar {
  readonly body: number;
  /** the host's share of the light */
  readonly bodyShare: number;
  readonly bend: number;
  readonly rings: Ring[];
  readonly tails: Tail[];

  constructor(readonly spec: PeculiarSpec) {
    this.body = spec.body ?? 1;
    this.bend = spec.bend ?? 0;
    this.rings = (spec.rings ?? []).slice(0, MAX_RINGS).map((g) => {
      const az = (g.tiltAz ?? 0) * DEG, t = (g.tilt ?? 0) * DEG;
      const ring: Ring = {
        r: g.r, w: g.w, h: g.h ?? 0.03, ox: g.ox ?? 0, oz: g.oz ?? 0,
        cAz: Math.cos(az), sAz: Math.sin(az), cT: Math.cos(t), sT: Math.sin(t),
        arc: g.arc ?? 1, arcPhase: (g.arcPhase ?? 0) * DEG, spokes: Math.round(g.spokes ?? 0), spokeIn: g.spokeIn ?? 0, sw: g.w * 0.45,
        wIn: (2 * g.w) / (1 + (g.skew ?? 1)), wOut: (2 * g.w * (g.skew ?? 1)) / (1 + (g.skew ?? 1)),
        wobble: Math.min(0.6, g.wobble ?? 0), strands: Math.round(g.strands ?? 0), twist: g.twist ?? 3, strandAmp: g.strandAmp ?? 0.6,
        light: g.light, young: g.young, knots: g.knots ?? 0.5, dust: g.dust ?? 0.3,
        plane: 1, spokeFrac: 0, amp: 0,
      };
      // in-plane integral, numerically (arcs, strands and spokes have no tidy closed form)
      const rMax = ring.r + ring.w * (1 + ring.wobble) + 6 * ring.wOut * (1 + ring.wobble), nR = 320, nP = 240, dr = rMax / nR, dp = TAU / nP;
      let all = 0, spokes = 0;
      for (let i = 0; i < nR; i++) {
        const rho = (i + 0.5) * dr;
        for (let j = 0; j < nP; j++) {
          const phi = (j + 0.5) * dp - Math.PI;
          all += this.ringPlane(ring, rho, phi) * rho;
          if (ring.spokes > 0) spokes += SPOKE_REL * this.spoke(ring, rho, phi) * rho;
        }
      }
      ring.plane = Math.max(all * dr * dp, 1e-9);
      ring.spokeFrac = (spokes * dr * dp) / ring.plane;
      return ring;
    });
    this.tails = (spec.tails ?? []).slice(0, MAX_TAILS).map((g) => {
      const tail: Tail = {
        phase: g.phase * DEG, sweep: g.sweep * DEG, r0: g.r0, r1: g.r1, lift: g.lift ?? 0, w0: g.w0, w1: g.w1,
        light: g.light, young: g.young, knots: g.knots ?? 0.5, dust: g.dust ?? 0.2,
        vol: 0, plane: 0, maxW: 0, amp: 0,
      };
      const n = 400, ds = (1 - TAIL_S0) / n, dr = tail.r1 - tail.r0;
      for (let i = 0; i < n; i++) {
        const s = TAIL_S0 + (i + 0.5) * ds, sc = Math.max(0, s);
        const rho = Math.max(tail.r0 + s * dr, 1e-4);
        const w = tail.w0 + (tail.w1 - tail.w0) * sc;
        const dlp = Math.hypot(dr, rho * tail.sweep);
        const dl = Math.hypot(dlp, 2 * tail.lift * sc);
        const env = tailEnv(s);
        tail.vol += env * TAU * w * w * dl * ds;
        tail.plane += env * SQRT_TAU * w * dlp * ds;
        tail.maxW = Math.max(tail.maxW, env * w * w * dl);
      }
      return tail;
    });
    const light = this.rings.reduce((a, g) => a + g.light, 0) + this.tails.reduce((a, g) => a + g.light, 0);
    this.bodyShare = Math.max(0.05, 1 - light);
  }

  /**
   * Set the components' amplitudes from the host's ∫density dV (pc³) and the galaxy radius (pc),
   * so that each carries its share of the light. Returns the whole galaxy's integral.
   */
  normalise(bodyIntegral: number, radiusPc: number): number {
    const k = bodyIntegral / (this.bodyShare * radiusPc * radiusPc * radiusPc);
    for (const g of this.rings) g.amp = (g.light * k) / (g.plane * SQRT_TAU * g.h);
    for (const g of this.tails) g.amp = (g.light * k) / Math.max(g.vol, 1e-12);
    return bodyIntegral / this.bodyShare;
  }

  /** height of the warped disc above its plane (radii) at in-plane radius rho (radii) and angle phi */
  bendY(rho: number, phi: number): number {
    if (this.bend === 0) return 0;
    const x = Math.max(0, rho / this.body - 0.4) / 0.6;
    return this.bend * Math.cos(phi) * x * x;
  }

  /** host-local point (radii) → ring frame (its plane is y = 0) */
  toRing(g: Ring, x: number, y: number, z: number, out: Vector3): Vector3 {
    const qx = x - g.ox, qz = z - g.oz;
    const x1 = g.cAz * qx + g.sAz * qz, z1 = -g.sAz * qx + g.cAz * qz;
    return out.set(x1, g.cT * y + g.sT * z1, -g.sT * y + g.cT * z1);
  }

  /** ring frame → host-local (radii); `offset` false for directions */
  fromRing(g: Ring, x: number, y: number, z: number, out: Vector3, offset = true): Vector3 {
    const y1 = g.cT * y - g.sT * z, z1 = g.sT * y + g.cT * z;
    const qx = g.cAz * x - g.sAz * z1, qz = g.sAz * x + g.cAz * z1;
    return offset ? out.set(qx + g.ox, y1, qz + g.oz) : out.set(qx, y1, qz);
  }

  private spoke(g: Ring, rho: number, phi: number): number {
    const k = (phi * g.spokes) / TAU;
    const across = (rho * (k - Math.floor(k + 0.5)) * TAU) / g.spokes;
    const win = smoothstep(g.spokeIn, g.spokeIn + 0.06, rho) * (1 - smoothstep(g.r - 2.5 * g.w, g.r - g.w, rho));
    return Math.exp(-(across * across) / (2 * g.sw * g.sw)) * win;
  }

  private side(g: Ring, phi: number): number {
    return 1 - (1 - g.arc) * 0.5 * (1 - Math.cos(phi - g.arcPhase));
  }

  /** the width's factor at angle phi (wobble, mean 1) */
  private widthAt(g: Ring, phi: number): number {
    return 1 + g.wobble * Math.sin(3 * phi + 0.4);
  }

  /** the crest's radius at angle phi */
  private crestAt(g: Ring, phi: number): number {
    return g.r + g.wobble * g.w * Math.sin(2 * phi + 1.9);
  }

  /**
   * The strands' brightening at angle phi, x widths off the crest (mean ≈ 1): broken into
   * stretches round the ring, and only in its bright band (the fluffy outside stays smooth).
   */
  private strand(g: Ring, x: number, phi: number): number {
    if (g.strands === 0) return 1;
    const c = 1 + Math.cos(g.strands * phi + g.twist * x + 1.2 * Math.sin(2 * phi + 0.5));
    const seg = 0.3 + 0.35 * (1 + Math.sin(3 * phi + 2.1 + 0.9 * Math.sin(5 * phi + 0.3)));
    return 1 + g.strandAmp * seg * Math.exp(-0.5 * x * x) * ((c * c) / 1.5 - 1);
  }

  /** a ring's in-plane profile (unit crest) */
  private ringPlane(g: Ring, rho: number, phi: number): number {
    const wf = this.widthAt(g, phi);
    const d = rho - this.crestAt(g, phi);
    const ws = (d < 0 ? g.wIn : g.wOut) * wf;
    let f = Math.exp(-(d * d) / (2 * ws * ws)) * this.side(g, phi) * this.strand(g, d / (g.w * wf), phi);
    if (g.spokes > 0) f += SPOKE_REL * this.spoke(g, rho, phi);
    return f;
  }

  private tailAt(t: Tail, x: number, y: number, z: number): number {
    const rho = Math.hypot(x, z);
    const dr = t.r1 - t.r0;
    const s = (rho - t.r0) / dr;
    if (s < TAIL_S0 || s > 1) return 0;
    const sc = Math.max(0, s);
    const w = t.w0 + (t.w1 - t.w0) * sc;
    let d = Math.atan2(z, x) - (t.phase + t.sweep * s);
    d = Math.atan2(Math.sin(d), Math.cos(d));
    const across = (rho * d * dr) / Math.hypot(dr, rho * t.sweep);
    const dy = y - t.lift * sc * sc;
    return tailEnv(s) * Math.exp(-(across * across + dy * dy) / (2 * w * w));
  }

  /**
   * Density of the rings and tails (model units) at a host-local point (radii). `young` gets the
   * part of it that is young stars (for GalaxyModel.youth).
   */
  density(x: number, y: number, z: number, young?: { v: number }): number {
    let d = 0, yd = 0;
    for (const g of this.rings) {
      const q = this.toRing(g, x, y, z, _q);
      const v = Math.exp(-(q.y * q.y) / (2 * g.h * g.h));
      if (v < 1e-4) continue;
      const f = g.amp * v * this.ringPlane(g, Math.hypot(q.x, q.z), Math.atan2(q.z, q.x));
      d += f; yd += f * g.young;
    }
    for (const t of this.tails) {
      const f = t.amp * this.tailAt(t, x, y, z);
      d += f; yd += f * t.young;
    }
    if (young) young.v = yd;
    return d;
  }

  /**
   * One point of the point cloud: with the components' share of the light, a point of one of them
   * (radii, host-local) and its population; otherwise null and the host is sampled.
   */
  sample(rng: Rng, out: Vector3): Population | null {
    let u = rng.next();
    for (const g of this.rings) {
      if (u < g.light) return this.sampleRing(g, rng, out);
      u -= g.light;
    }
    for (const t of this.tails) {
      if (u < t.light) return this.sampleTail(t, rng, out);
      u -= t.light;
    }
    return null;
  }

  private sampleRing(g: Ring, rng: Rng, out: Vector3): Population {
    let rho: number, phi = 0;
    if (g.spokes > 0 && rng.next() < g.spokeFrac) {
      const k = Math.floor(rng.next() * g.spokes);
      rho = g.spokeIn + rng.next() * Math.max(0.01, g.r - 1.5 * g.w - g.spokeIn);
      phi = (TAU * k) / g.spokes + (gauss(rng) * g.sw) / Math.max(rho, 0.02);
    } else {
      // rejection: a half-gaussian on the side picked by its width (that side's share of the
      // light), kept as the arc, the width's wobble and the strands weigh it
      const top = (1 + g.wobble) * (1 + g.strandAmp * (g.strands > 0 ? 4 / 1.5 - 1 : 0));
      let d = 0;
      for (let k = 0; k < 16; k++) {
        phi = rng.next() * TAU;
        const wf = this.widthAt(g, phi);
        const inner = rng.next() * (g.wIn + g.wOut) < g.wIn;
        d = Math.abs(gauss(rng)) * (inner ? -g.wIn : g.wOut) * wf;
        if (rng.next() * top < this.side(g, phi) * wf * this.strand(g, d / (g.w * wf), phi)) break;
      }
      rho = Math.abs(this.crestAt(g, phi) + d);
    }
    this.fromRing(g, rho * Math.cos(phi), gauss(rng) * g.h, rho * Math.sin(phi), out);
    return populationOf(rng, g.young, g.knots);
  }

  private sampleTail(t: Tail, rng: Rng, out: Vector3): Population {
    const dr = t.r1 - t.r0;
    let s = 0;
    for (let k = 0; k < 16; k++) {
      s = TAIL_S0 + rng.next() * (1 - TAIL_S0);
      const sc = Math.max(0, s);
      const rho = Math.max(t.r0 + s * dr, 1e-4);
      const w = t.w0 + (t.w1 - t.w0) * sc;
      const dl = Math.hypot(Math.hypot(dr, rho * t.sweep), 2 * t.lift * sc);
      if (rng.next() * t.maxW < tailEnv(s) * w * w * dl) break;
    }
    const sc = Math.max(0, s);
    const rho = Math.max(t.r0 + s * dr, 0);
    const w = t.w0 + (t.w1 - t.w0) * sc;
    const phi = t.phase + t.sweep * s;
    out.set(rho * Math.cos(phi) + gauss(rng) * w, t.lift * sc * sc + gauss(rng) * w, rho * Math.sin(phi) + gauss(rng) * w);
    return populationOf(rng, t.young, t.knots);
  }

  /** shader uniforms of the components (volume_galaxy.frag) */
  volumeUniforms(): Record<string, { value: unknown }> {
    const v4 = (n: number) => Array.from({ length: n }, () => new Vector4());
    const rA = v4(MAX_RINGS), rB = v4(MAX_RINGS), rC = v4(MAX_RINGS), rD = v4(MAX_RINGS), rE = v4(MAX_RINGS), rF = v4(MAX_RINGS);
    this.rings.forEach((g, i) => {
      rA[i].set(g.ox, g.oz, g.r, g.w);
      rB[i].set(g.h, g.cAz, g.sAz, g.amp);
      rC[i].set(g.cT, g.sT, g.arc, g.arcPhase);
      rD[i].set(g.spokes, g.spokeIn, g.sw, g.young);
      rE[i].set(g.knots, g.dust, g.wIn, g.wOut);
      rF[i].set(g.wobble, g.strands, g.twist, g.strandAmp);
    });
    const tA = v4(MAX_TAILS), tB = v4(MAX_TAILS), tC = v4(MAX_TAILS);
    this.tails.forEach((t, i) => {
      tA[i].set(t.phase, t.sweep, t.r0, t.r1);
      tB[i].set(t.w0, t.w1, t.lift, t.amp);
      tC[i].set(t.young, t.knots, t.dust, 0);
    });
    return {
      uRingA: { value: rA }, uRingB: { value: rB }, uRingC: { value: rC }, uRingD: { value: rD }, uRingE: { value: rE }, uRingF: { value: rF }, uNRings: { value: this.rings.length },
      uTailA: { value: tA }, uTailB: { value: tB }, uTailC: { value: tC }, uNTails: { value: this.tails.length },
    };
  }

  /**
   * The sprite's parameters (PEC_TEXELS RGBA texels at `o`): the rings' axes and offsets in the
   * scene frame (galaxy.frag projects them with the view), each component's brightness normalised
   * so that its in-plane light is its share of the sprite's.
   */
  spriteTexels(major: Vector3, normal: Vector3, out: Float32Array, o: number): void {
    const zAxis = new Vector3().crossVectors(major, normal).normalize();
    const toScene = (v: Vector3) => new Vector3().addScaledVector(major, v.x).addScaledVector(normal, v.y).addScaledVector(zAxis, v.z);
    const put = (k: number, a: number, b: number, c: number, d: number) => { out.set([a, b, c, d], o + k * 4); };
    put(0, this.body, this.rings.length, this.tails.length, this.bodyShare);
    this.rings.forEach((g, i) => {
      const b = 1 + i * 5;
      const ex = toScene(this.fromRing(g, 1, 0, 0, new Vector3(), false));
      const ez = toScene(this.fromRing(g, 0, 0, 1, new Vector3(), false));
      const off = toScene(new Vector3(g.ox, 0, g.oz));
      put(b, ex.x, ex.y, ex.z, g.r);
      put(b + 1, ez.x, ez.y, ez.z, g.w);
      put(b + 2, off.x, off.y, off.z, (g.light * SPRITE_FLUX) / g.plane);
      put(b + 3, g.arc, g.arcPhase, g.spokes, g.spokeIn);
      put(b + 4, g.sw, g.young, g.knots, g.h);
      put(16 + i * 2, g.wIn, g.wOut, g.wobble, 0);
      put(17 + i * 2, g.strands, g.twist, g.strandAmp, 0);
    });
    this.tails.forEach((t, i) => {
      const b = 11 + i * 2;
      put(b, t.phase, t.sweep, t.r0, t.r1);
      put(b + 1, t.w0, t.w1, (t.light * SPRITE_FLUX) / Math.max(t.plane, 1e-9), t.young);
    });
    put(15, this.bend, 0, 0, 0);
  }
}
