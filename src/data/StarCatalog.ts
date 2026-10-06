import { Vector3 } from 'three';
import { _ } from '../i18n';
import { PARSEC_KM } from '../core/constants';
import {
  absoluteMagnitude, bvToTemperature, luminosityFromAbsMag, massFromLuminosity, radiusFromLuminosity,
  spectralFromTemperature, LUM_CLASS_LABEL, SUN_MASS_KG, SUN_RADIUS_KM,
} from '../astro/stellar';

const RECORD = 24;
const HEADER = 12;
const SPECT = 'OBAFGKM';

export interface StarNames {
  proper: string;
  bayer: string;
  gliese: string;
  constellation: string;
}

/** Derived physical description of a catalogue star */
export interface StarInfo {
  index: number;
  name: string;
  names: StarNames | null;
  hip: number;
  /** position in parsecs, scene frame, relative to the Sun */
  position: Vector3;
  distancePc: number;
  mag: number;
  absMag: number;
  bv: number;
  temperature: number;
  /** solar units */
  luminosity: number;
  /** solar radii */
  radiusSolar: number;
  radiusKm: number;
  /** solar masses */
  massSolar: number;
  massKg: number;
  spectral: string;
  lumClass: number;
  catalogSpectral: string;
  isWhiteDwarf: boolean;
  /** true for procedurally generated stars (not in the HYG catalogue) */
  procedural?: boolean;
}

/**
 * Compact HYG-derived star catalogue (see scripts/build-stars.mjs for the binary layout).
 * Index 0 is always the Sun.
 */
export class StarCatalog {
  readonly count: number;
  /** xyz parsecs, scene frame */
  readonly positions: Float32Array;
  readonly mags: Float32Array;
  readonly absMags: Float32Array;
  readonly bvs: Float32Array;
  readonly hips: Uint32Array;
  readonly spectClass: Uint8Array;
  readonly spectSub: Uint8Array;
  readonly lumClass: Uint8Array;
  readonly flags: Uint8Array;
  readonly names = new Map<number, StarNames>();
  /** indices of stars with a proper name, brightest first */
  readonly namedIndices: number[] = [];

  private constructor(buf: ArrayBuffer, namesJson: Array<[number, string, string, string, string]>) {
    const dv = new DataView(buf);
    if (String.fromCharCode(dv.getUint8(0), dv.getUint8(1), dv.getUint8(2), dv.getUint8(3)) !== 'YEST') {
      throw new Error('Geçersiz yıldız kataloğu');
    }
    const n = dv.getUint32(8, true);
    this.count = n;
    this.positions = new Float32Array(n * 3);
    this.mags = new Float32Array(n);
    this.absMags = new Float32Array(n);
    this.bvs = new Float32Array(n);
    this.hips = new Uint32Array(n);
    this.spectClass = new Uint8Array(n);
    this.spectSub = new Uint8Array(n);
    this.lumClass = new Uint8Array(n);
    this.flags = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      const o = HEADER + i * RECORD;
      const x = dv.getFloat32(o, true), y = dv.getFloat32(o + 4, true), z = dv.getFloat32(o + 8, true);
      this.positions[i * 3] = x;
      this.positions[i * 3 + 1] = y;
      this.positions[i * 3 + 2] = z;
      const mag = dv.getInt16(o + 12, true) / 100;
      const ciRaw = dv.getInt16(o + 14, true);
      this.mags[i] = mag;
      this.hips[i] = dv.getUint32(o + 16, true);
      this.spectClass[i] = dv.getUint8(o + 20);
      this.spectSub[i] = dv.getUint8(o + 21);
      this.lumClass[i] = dv.getUint8(o + 22);
      this.flags[i] = dv.getUint8(o + 23);
      const d = Math.sqrt(x * x + y * y + z * z);
      this.absMags[i] = i === 0 ? 4.83 : absoluteMagnitude(mag, d);
      this.bvs[i] = ciRaw === -32768 ? this.guessBv(i) : ciRaw / 1000;
    }
    for (const [idx, proper, bayer, gliese, constellation] of namesJson) {
      this.names.set(idx, { proper, bayer, gliese, constellation });
      if (proper && idx !== 0) this.namedIndices.push(idx);
    }
    this.namedIndices.sort((a, b) => this.mags[a] - this.mags[b]);
  }

  static async load(baseUrl: string): Promise<StarCatalog> {
    // /data/* is served with a one-year immutable cache; the build id busts it on redeploy
    const v = `?v=${__BUILD_ID__}`;
    const [bin, names] = await Promise.all([
      fetch(`${baseUrl}data/stars.bin${v}`).then((r) => { if (!r.ok) throw new Error('stars.bin yüklenemedi'); return r.arrayBuffer(); }),
      fetch(`${baseUrl}data/star-names.json${v}`).then((r) => { if (!r.ok) throw new Error('star-names.json yüklenemedi'); return r.json(); }),
    ]);
    return new StarCatalog(bin, names as Array<[number, string, string, string, string]>);
  }

  /** B-V guess from spectral class when the catalogue lacks a colour index */
  private guessBv(i: number): number {
    const cls = this.spectClass[i];
    const sub = this.spectSub[i] === 255 ? 5 : this.spectSub[i];
    const table = [-0.33, -0.17, 0.0, 0.30, 0.58, 0.81, 1.40, 1.60];
    if (cls > 7) return 0.65;
    const next = table[Math.min(cls + 1, 7)];
    return table[cls] + ((next - table[cls]) * sub) / 10;
  }

  /** Display name: proper → Bayer → Gliese → HIP → catalogue index */
  nameOf(i: number): string {
    if (i === 0) return _('Güneş');
    const n = this.names.get(i);
    if (n?.proper) return n.proper;
    if (n?.bayer) return n.bayer;
    if (n?.gliese) return n.gliese;
    if (this.hips[i]) return `HIP ${this.hips[i]}`;
    return `HYG ${i}`;
  }

  /** Catalogue spectral type string, e.g. "K5V" */
  catalogSpectral(i: number): string {
    const c = this.spectClass[i];
    if (c === 255) return '';
    const letter = c < 7 ? SPECT[c] : '?';
    const sub = this.spectSub[i] === 255 ? '' : String(this.spectSub[i]);
    const lum = LUM_CLASS_LABEL[this.lumClass[i]] ?? '';
    return `${letter}${sub}${lum}`;
  }

  distancePc(i: number): number {
    const p = this.positions;
    return Math.sqrt(p[i * 3] ** 2 + p[i * 3 + 1] ** 2 + p[i * 3 + 2] ** 2);
  }

  position(i: number, out = new Vector3()): Vector3 {
    return out.set(this.positions[i * 3], this.positions[i * 3 + 1], this.positions[i * 3 + 2]);
  }

  /** Position in km, scene frame, relative to the Sun */
  positionKm(i: number, out = new Vector3()): Vector3 {
    return this.position(i, out).multiplyScalar(PARSEC_KM);
  }

  /** Physical parameters derived from the observables (deterministic) */
  info(i: number): StarInfo {
    const bv = this.bvs[i];
    const isWD = (this.flags[i] & 2) !== 0;
    let temperature = bvToTemperature(bv);
    if (isWD) temperature = Math.max(temperature, 8000);
    const absMag = this.absMags[i];
    let luminosity = luminosityFromAbsMag(absMag, temperature);
    let lumClass = this.lumClass[i];
    if (!lumClass) {
      // Guess from position in the HR diagram: dwarfs sit near the main sequence
      const msAbs = 4.83 + 5.5 * (bv - 0.65);
      lumClass = absMag < msAbs - 2.5 ? (absMag < msAbs - 6 ? 1 : 3) : 5;
    }
    let radiusSolar = radiusFromLuminosity(luminosity, temperature);
    let massSolar = massFromLuminosity(luminosity, lumClass);
    if (isWD) {
      radiusSolar = 0.012;
      massSolar = 0.6;
      luminosity = Math.min(luminosity, 0.05);
    }
    if (i === 0) {
      temperature = 5772; luminosity = 1; radiusSolar = 1; massSolar = 1; lumClass = 5;
    }
    return {
      index: i,
      name: this.nameOf(i),
      names: this.names.get(i) ?? null,
      hip: this.hips[i],
      position: this.position(i),
      distancePc: this.distancePc(i),
      mag: this.mags[i],
      absMag,
      bv,
      temperature,
      luminosity,
      radiusSolar,
      radiusKm: radiusSolar * SUN_RADIUS_KM,
      massSolar,
      massKg: massSolar * SUN_MASS_KG,
      spectral: isWD ? 'DA' : spectralFromTemperature(temperature) + (LUM_CLASS_LABEL[lumClass] ?? ''),
      lumClass,
      catalogSpectral: this.catalogSpectral(i),
      isWhiteDwarf: isWD,
    };
  }

  /** Nearest star to a point given in parsecs (scene frame). Brute force over the whole catalogue. */
  nearest(x: number, y: number, z: number, exclude = -1): { index: number; distPc: number } {
    const p = this.positions;
    let best = -1;
    let bestD2 = Infinity;
    for (let i = 0; i < this.count; i++) {
      if (i === exclude) continue;
      const dx = p[i * 3] - x, dy = p[i * 3 + 1] - y, dz = p[i * 3 + 2] - z;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 < bestD2) { bestD2 = d2; best = i; }
    }
    return { index: best, distPc: Math.sqrt(bestD2) };
  }

  /** k nearest stars to a point (pc). */
  nearestK(x: number, y: number, z: number, k: number): Array<{ index: number; distPc: number }> {
    const p = this.positions;
    const out: Array<{ index: number; distPc: number }> = [];
    for (let i = 0; i < this.count; i++) {
      const dx = p[i * 3] - x, dy = p[i * 3 + 1] - y, dz = p[i * 3 + 2] - z;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (out.length < k || d2 < out[out.length - 1].distPc) {
        out.push({ index: i, distPc: d2 });
        out.sort((a, b) => a.distPc - b.distPc);
        if (out.length > k) out.pop();
      }
    }
    for (const o of out) o.distPc = Math.sqrt(o.distPc);
    return out;
  }

  /** Text search over names / HIP / Gliese. Returns indices, brightest first. */
  search(query: string, limit = 8): number[] {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const norm = (s: string) => s.toLowerCase();
    const hits: number[] = [];
    const hipMatch = /^hip\s*(\d+)$/i.exec(q);
    if (hipMatch) {
      const hip = parseInt(hipMatch[1], 10);
      for (let i = 0; i < this.count; i++) if (this.hips[i] === hip) { hits.push(i); break; }
    }
    for (const [idx, n] of this.names) {
      if (hits.length >= limit * 4) break;
      if ((n.proper && norm(n.proper).includes(q)) || (n.bayer && norm(n.bayer).includes(q)) || (n.gliese && norm(n.gliese).includes(q))) {
        hits.push(idx);
      }
    }
    // prefer prefix matches, then brightness
    hits.sort((a, b) => {
      const pa = norm(this.nameOf(a)).startsWith(q) ? 0 : 1;
      const pb = norm(this.nameOf(b)).startsWith(q) ? 0 : 1;
      return pa - pb || this.mags[a] - this.mags[b];
    });
    return hits.slice(0, limit);
  }
}
