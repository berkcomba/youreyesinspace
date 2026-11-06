import {
  absoluteMagnitude, bvToTemperature, luminosityFromAbsMag, massFromLuminosity, radiusFromLuminosity,
  spectralFromTemperature, LUM_CLASS_LABEL,
} from '../../src/astro/stellar';
import { STAR_PLANETS, STAR_VELOCITY, STAR_WD, guessBv } from '../../src/data/starTierFormat';
import { sceneToRaDec } from './astro';

const SPECT = 'OBAFGKM';

const GREEK_ABBR: Record<string, string> = {
  Alp: 'α', Bet: 'β', Gam: 'γ', Del: 'δ', Eps: 'ε', Zet: 'ζ', Eta: 'η', The: 'θ', Iot: 'ι', Kap: 'κ', Lam: 'λ', Mu: 'μ',
  Nu: 'ν', Xi: 'ξ', Omi: 'ο', Pi: 'π', Rho: 'ρ', Sig: 'σ', Tau: 'τ', Ups: 'υ', Phi: 'φ', Chi: 'χ', Psi: 'ψ', Ome: 'ω',
};
const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';

/** a few HYG designations arrive unformatted ("3Pi 4Ori" = 3 Ori, π⁴ Ori) */
export function tidyBayer(s: string): string {
  const m = /^\d*([A-Z][a-z]{1,2}) ?(\d)?([A-Z][A-Za-z][a-z])$/.exec(s);
  if (!m || !GREEK_ABBR[m[1]]) return s;
  return `${GREEK_ABBR[m[1]]}${m[2] ? SUP[+m[2]] : ''} ${m[3]}`;
}

export interface StarNames { proper: string; bayer: string; gliese: string; constellation: string; host: string }

/** The core HYG catalogue (stars.bin) decoded the way StarCatalog does it, plus the derived physics */
export class CoreCatalog {
  readonly n: number;
  readonly pos: Float32Array;
  readonly vel: Int16Array;
  readonly mag: Float32Array;
  readonly bv: Float32Array;
  readonly hip: Uint32Array;
  readonly sc: Uint8Array;
  readonly ss: Uint8Array;
  readonly lc: Uint8Array;
  readonly flags: Uint8Array;
  readonly names = new Map<number, StarNames>();
  private grid = new Map<string, number[]>();

  constructor(buf: Buffer, names: Array<[number, string, string, string, string, string?]>) {
    const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    if (dv.getUint32(4, true) !== 2) throw new Error('stars.bin: unexpected version');
    const n = this.n = dv.getUint32(8, true);
    const REC = dv.getUint32(12, true);
    this.pos = new Float32Array(n * 3); this.vel = new Int16Array(n * 3);
    this.mag = new Float32Array(n); this.bv = new Float32Array(n); this.hip = new Uint32Array(n);
    this.sc = new Uint8Array(n); this.ss = new Uint8Array(n); this.lc = new Uint8Array(n); this.flags = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      const o = 16 + i * REC;
      for (let k = 0; k < 3; k++) { this.pos[i * 3 + k] = dv.getFloat32(o + 4 * k, true); this.vel[i * 3 + k] = dv.getInt16(o + 24 + 2 * k, true); }
      this.mag[i] = dv.getInt16(o + 12, true) / 100;
      const ci = dv.getInt16(o + 14, true);
      this.hip[i] = dv.getUint32(o + 16, true);
      this.sc[i] = dv.getUint8(o + 20); this.ss[i] = dv.getUint8(o + 21); this.lc[i] = dv.getUint8(o + 22); this.flags[i] = dv.getUint8(o + 23);
      this.bv[i] = ci === -32768 ? guessBv(this.sc[i], this.ss[i]) : ci / 1000;
    }
    for (const [idx, proper, bayer, gliese, constellation, host] of names) this.names.set(idx, { proper, bayer, gliese, constellation, host: host ?? '' });
    for (let i = 1; i < n; i++) {
      const k = this.cellKey(this.pos[i * 3], this.pos[i * 3 + 1], this.pos[i * 3 + 2]);
      let c = this.grid.get(k);
      if (!c) this.grid.set(k, (c = []));
      c.push(i);
    }
  }

  private cellKey(x: number, y: number, z: number): string {
    return `${Math.floor(x / 4)},${Math.floor(y / 4)},${Math.floor(z / 4)}`;
  }

  dist(i: number): number {
    const p = this.pos;
    return Math.hypot(p[i * 3], p[i * 3 + 1], p[i * 3 + 2]);
  }

  raDec(i: number): { ra: number; dec: number } {
    return sceneToRaDec(this.pos[i * 3], this.pos[i * 3 + 1], this.pos[i * 3 + 2]);
  }

  hasPlanets(i: number): boolean { return (this.flags[i] & STAR_PLANETS) !== 0; }

  /** heliocentric space velocity, km/s (null when the catalogue has none) */
  speed(i: number): number | null {
    if (!(this.flags[i] & STAR_VELOCITY)) return null;
    const v = this.vel;
    return Math.hypot(v[i * 3], v[i * 3 + 1], v[i * 3 + 2]) / 10;
  }

  /** proper → host designation → Bayer → Gliese → HIP, as StarCatalog.nameOf */
  nameOf(i: number): string {
    const n = this.names.get(i);
    if (n?.proper) return n.proper;
    if (n?.host && !(n.bayer && /^[a-z]{2,3}\d? /.test(n.host))) return n.host;
    if (n?.bayer) return tidyBayer(n.bayer);
    if (n?.gliese) return n.gliese;
    if (this.hip[i]) return `HIP ${this.hip[i]}`;
    return `HYG ${i}`;
  }

  catalogSpectral(i: number): string {
    const c = this.sc[i];
    if (c === 255) return '';
    return `${c < 7 ? SPECT[c] : '?'}${this.ss[i] === 255 ? '' : this.ss[i]}${LUM_CLASS_LABEL[this.lc[i]] ?? ''}`;
  }

  /** StarCatalog.info, without three.js */
  physics(i: number): { absMag: number; temperature: number; luminosity: number; radius: number; mass: number; lumClass: number; spectral: string; wd: boolean } {
    const d = this.dist(i);
    const absMag = absoluteMagnitude(this.mag[i], d);
    const bv = this.bv[i];
    const wd = (this.flags[i] & STAR_WD) !== 0;
    let temperature = bvToTemperature(bv);
    if (wd) temperature = Math.max(temperature, 8000);
    let luminosity = luminosityFromAbsMag(absMag, temperature);
    let lumClass = this.lc[i];
    if (!lumClass) {
      const msAbs = 4.83 + 5.5 * (bv - 0.65);
      lumClass = absMag < msAbs - 2.5 ? (absMag < msAbs - 6 ? 1 : 3) : 5;
    }
    let radius = radiusFromLuminosity(luminosity, temperature);
    let mass = massFromLuminosity(luminosity, lumClass);
    if (wd) { radius = 0.012; mass = 0.6; luminosity = Math.min(luminosity, 0.05); }
    return { absMag, temperature, luminosity, radius, mass, lumClass, spectral: wd ? 'DA' : spectralFromTemperature(temperature) + (LUM_CLASS_LABEL[lumClass] ?? ''), wd };
  }

  /** nearest catalogue stars to star i (pc), up to `k`, within `maxPc` */
  neighbours(i: number, k: number, maxPc: number): Array<{ j: number; d: number }> {
    const p = this.pos;
    const x = p[i * 3], y = p[i * 3 + 1], z = p[i * 3 + 2];
    const r = Math.ceil(maxPc / 4);
    const cx = Math.floor(x / 4), cy = Math.floor(y / 4), cz = Math.floor(z / 4);
    const out: Array<{ j: number; d: number }> = [];
    for (let a = -r; a <= r; a++) for (let b = -r; b <= r; b++) for (let c = -r; c <= r; c++) {
      const cell = this.grid.get(`${cx + a},${cy + b},${cz + c}`);
      if (!cell) continue;
      for (const j of cell) {
        if (j === i) continue;
        const d = Math.hypot(p[j * 3] - x, p[j * 3 + 1] - y, p[j * 3 + 2] - z);
        if (d <= maxPc) out.push({ j, d });
      }
    }
    // the Sun (index 0) is a neighbour too
    const dSun = Math.hypot(x, y, z);
    if (dSun <= maxPc) out.push({ j: 0, d: dSun });
    return out.sort((u, v) => u.d - v.d).slice(0, k);
  }
}
