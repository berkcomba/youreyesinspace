import { Vector3 } from 'three';
import { _ } from '../i18n';
import { PARSEC_KM } from '../core/constants';
import {
  absoluteMagnitude, bvToTemperature, luminosityFromAbsMag, massFromLuminosity, radiusFromLuminosity,
  spectralFromTemperature, LUM_CLASS_LABEL, SUN_MASS_KG, SUN_RADIUS_KM,
} from '../astro/stellar';
import { STAR_NAMED, STAR_WD, STAR_PLANETS, STAR_GAIA_DIST, STAR_VELOCITY, GRID_PC, GRID_SPAN, cell, guessBv, type CatalogTier } from './starTierFormat';
import type { TierResult } from './StarTiers.worker';
import TierWorker from './StarTiers.worker?worker';

export { STAR_NAMED, STAR_WD, STAR_PLANETS, STAR_GAIA_DIST, STAR_VELOCITY, type CatalogTier };

/** Per-star rgb and catalogue index of a landed tier, computed off the main thread */
export interface TierAttributes { colors: Float32Array; indices: Float32Array }

const SPECT = 'OBAFGKM';
/** 0.1 km/s × 1 yr in parsecs */
const DRIFT_PC = 1.02271e-7;
/** linear space motion holds near the Sun for ~10⁶ yr (Gliese 710 passes at +1.29 Myr); beyond, the Galaxy's potential bends every path */
const MAX_DRIFT_YEARS = 2e6;

export interface StarNames {
  proper: string;
  bayer: string;
  gliese: string;
  constellation: string;
  /** exoplanet host designation (NASA Exoplanet Archive) */
  host: string;
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

interface CatalogManifest {
  core: number;
  total: number;
  tiers: CatalogTier[];
}

/**
 * The real star catalogue.
 *
 * The core (`stars.bin`, loaded before start) holds the HYG stars in their historical order — their
 * `c<index>` ids, system seeds and saved discoveries depend on it — followed by every exoplanet host
 * HYG lacks. The tiers (Gaia's 100 pc census, then Tycho-2 / Gaia DR3 to V ≈ 12) are appended in the
 * background; their indices continue after the core. Index 0 is always the Sun.
 *
 * Positions are J2000 (pc, scene frame); `setEpoch` moves every star along its measured space velocity.
 */
export class StarCatalog {
  /** stars loaded so far */
  count: number;
  /** stars in stars.bin */
  readonly core: number;
  /** xyz parsecs, scene frame, at J2000 */
  positions: Float32Array;
  /** heliocentric space velocity, 0.1 km/s, scene frame */
  velocities: Int16Array;
  /** apparent V magnitude seen from the Sun at J2000 */
  mags: Float32Array;
  absMags: Float32Array;
  /** 10^(−0.4·absMag): the brightness test of picking without a logarithm per star */
  flux0: Float32Array;
  bvs: Float32Array;
  spectClass: Uint8Array;
  spectSub: Uint8Array;
  lumClass: Uint8Array;
  flags: Uint8Array;
  /** Hipparcos numbers of the core */
  readonly hips: Uint32Array;
  /** per tier star: packed Tycho-2 id (bit 31 set: AT-HYG id) or the low word of the Gaia DR3 source_id */
  private extIds = new Uint32Array(0);
  /** high word of the Gaia DR3 source_id, per tier star (0 for Tycho stars) */
  private extHi = new Uint32Array(0);
  readonly names = new Map<number, StarNames>();
  /** indices of stars with a proper name, brightest first */
  readonly namedIndices: number[] = [];
  /** indices of the exoplanet hosts */
  readonly hostIndices: number[] = [];
  readonly tiers: CatalogTier[];
  readonly loadedTiers: CatalogTier[] = [];
  /** the tiers take part in nearest-star queries and search (off while the deep catalogue is switched off) */
  tierSearch = true;
  /** years since J2000 the positions are evaluated at */
  years = 0;
  /** drift factor: pc per (0.1 km/s) at the current epoch */
  drift = 0;
  private gridKeys: Float64Array<ArrayBufferLike> = new Float64Array(0);
  private gridStart: Uint32Array<ArrayBufferLike> = new Uint32Array(0);
  private gridIdx: Uint32Array<ArrayBufferLike> = new Uint32Array(0);
  private readonly tierListeners: Array<(t: CatalogTier, attrs: TierAttributes) => void> = [];
  private loading: Promise<void> | null = null;

  private constructor(buf: ArrayBuffer, namesJson: Array<[number, string, string, string, string, string?]>, manifest: CatalogManifest) {
    const dv = new DataView(buf);
    if (String.fromCharCode(dv.getUint8(0), dv.getUint8(1), dv.getUint8(2), dv.getUint8(3)) !== 'YEST' || dv.getUint32(4, true) !== 2) {
      throw new Error('Geçersiz yıldız kataloğu');
    }
    const n = dv.getUint32(8, true);
    const REC = dv.getUint32(12, true);
    const HEAD = 16;
    this.count = this.core = n;
    this.tiers = manifest.tiers;
    this.positions = new Float32Array(n * 3);
    this.velocities = new Int16Array(n * 3);
    this.mags = new Float32Array(n);
    this.absMags = new Float32Array(n);
    this.flux0 = new Float32Array(n);
    this.bvs = new Float32Array(n);
    this.hips = new Uint32Array(n);
    this.spectClass = new Uint8Array(n);
    this.spectSub = new Uint8Array(n);
    this.lumClass = new Uint8Array(n);
    this.flags = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      const o = HEAD + i * REC;
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
      this.velocities[i * 3] = dv.getInt16(o + 24, true);
      this.velocities[i * 3 + 1] = dv.getInt16(o + 26, true);
      this.velocities[i * 3 + 2] = dv.getInt16(o + 28, true);
      const d = Math.sqrt(x * x + y * y + z * z);
      this.absMags[i] = i === 0 ? 4.83 : absoluteMagnitude(mag, d);
      this.flux0[i] = Math.pow(10, -0.4 * this.absMags[i]);
      this.bvs[i] = ciRaw === -32768 ? guessBv(this.spectClass[i], this.spectSub[i]) : ciRaw / 1000;
    }
    for (const [idx, proper, bayer, gliese, constellation, host] of namesJson) {
      this.names.set(idx, { proper, bayer, gliese, constellation, host: host ?? '' });
      if (proper && idx !== 0) this.namedIndices.push(idx);
    }
    this.namedIndices.sort((a, b) => this.mags[a] - this.mags[b]);
    for (let i = 0; i < n; i++) if (this.flags[i] & STAR_PLANETS) this.hostIndices.push(i);
  }

  static async load(baseUrl: string): Promise<StarCatalog> {
    // /data/* is served with a one-year immutable cache; the build id busts it on redeploy
    const v = `?v=${__BUILD_ID__}`;
    const get = (f: string) => fetch(`${baseUrl}data/${f}${v}`).then((r) => { if (!r.ok) throw new Error(`${f} yüklenemedi`); return r; });
    const [bin, names, manifest] = await Promise.all([
      get('stars.bin').then((r) => r.arrayBuffer()),
      get('star-names.json').then((r) => r.json()),
      get('catalog.json').then((r) => r.json()),
    ]);
    const cat = new StarCatalog(bin, names, manifest as CatalogManifest);
    cat.baseUrl = baseUrl;
    return cat;
  }

  private baseUrl = '/';

  /** Called once per tier as it lands (after `count` has grown); `attrs` are ready-made draw attributes for the tier's stars */
  onTier(fn: (t: CatalogTier, attrs: TierAttributes) => void): void {
    this.tierListeners.push(fn);
  }

  /**
   * Stream the tiers in (once); each one is usable as soon as it is parsed. Decoding and the cell
   * grid run in a worker (StarTiers.worker.ts): the main thread only copies the finished arrays in.
   */
  loadTiers(): Promise<void> {
    if (this.loading) return this.loading;
    this.loading = (async () => {
      const total = this.core + this.tiers.reduce((s, t) => s + t.count, 0);
      this.grow(total);
      const v = `?v=${__BUILD_ID__}`;
      const worker = new TierWorker();
      try {
        for (const t of this.tiers) {
          const r = await fetch(`${this.baseUrl}data/${t.file}${v}`);
          if (!r.ok) throw new Error(`${t.file} yüklenemedi`);
          const buf = await r.arrayBuffer();
          const res = await new Promise<TierResult>((resolve, reject) => {
            worker.onmessage = (e: MessageEvent<TierResult | { error: string }>) => { if ('error' in e.data) reject(new Error(e.data.error)); else resolve(e.data); };
            worker.onerror = (e) => reject(new Error(e.message));
            worker.postMessage({ tier: t, core: this.core, buf }, [buf]);
          });
          this.adoptTier(res);
          this.count = t.first + t.count;
          this.loadedTiers.push(t);
          for (const fn of this.tierListeners) fn(t, { colors: res.colors, indices: res.indices });
        }
      } finally {
        worker.terminate();
      }
    })();
    return this.loading;
  }

  /** Copy a worker-parsed tier into the catalogue arrays and take its grid */
  private adoptTier(r: TierResult): void {
    const i0 = r.tier.first, k0 = i0 - this.core;
    this.positions.set(r.positions, i0 * 3);
    this.velocities.set(r.velocities, i0 * 3);
    this.mags.set(r.mags, i0); this.absMags.set(r.absMags, i0); this.flux0.set(r.flux0, i0); this.bvs.set(r.bvs, i0);
    this.spectClass.set(r.spectClass, i0); this.spectSub.set(r.spectSub, i0); this.lumClass.set(r.lumClass, i0); this.flags.set(r.flags, i0);
    this.extIds.set(r.extIds, k0); this.extHi.set(r.extHi, k0);
    this.gridKeys = r.gridKeys; this.gridStart = r.gridStart; this.gridIdx = r.gridIdx;
  }

  private grow(n: number): void {
    const g = <T extends Float32Array | Int16Array | Uint8Array>(a: T, per: number, make: (len: number) => T): T => {
      const b = make(n * per);
      b.set(a.subarray(0, this.count * per));
      return b;
    };
    this.positions = g(this.positions, 3, (l) => new Float32Array(l));
    this.velocities = g(this.velocities, 3, (l) => new Int16Array(l));
    this.mags = g(this.mags, 1, (l) => new Float32Array(l));
    this.absMags = g(this.absMags, 1, (l) => new Float32Array(l));
    this.flux0 = g(this.flux0, 1, (l) => new Float32Array(l));
    this.bvs = g(this.bvs, 1, (l) => new Float32Array(l));
    this.spectClass = g(this.spectClass, 1, (l) => new Uint8Array(l));
    this.spectSub = g(this.spectSub, 1, (l) => new Uint8Array(l));
    this.lumClass = g(this.lumClass, 1, (l) => new Uint8Array(l));
    this.flags = g(this.flags, 1, (l) => new Uint8Array(l));
    this.extIds = new Uint32Array(n - this.core);
    this.extHi = new Uint32Array(n - this.core);
  }

  /** Tier stars of one cell (indices into the grid's index list), or null */
  private cellRange(key: number): [number, number] | null {
    const ks = this.gridKeys;
    let lo = 0, hi = ks.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (ks[mid] < key) lo = mid + 1;
      else if (ks[mid] > key) hi = mid - 1;
      else return [this.gridStart[mid], this.gridStart[mid + 1]];
    }
    return null;
  }

  /** Evaluate positions at `years` since J2000 (clamped to ±2 Myr) */
  setEpoch(years: number): void {
    this.years = Math.max(-MAX_DRIFT_YEARS, Math.min(MAX_DRIFT_YEARS, years));
    this.drift = this.years * DRIFT_PC;
  }

  /** Which tier a star index belongs to (null: the core) */
  tierOf(i: number): CatalogTier | null {
    if (i < this.core) return null;
    return this.tiers.find((t) => i >= t.first && i < t.first + t.count) ?? null;
  }

  /** Catalogue designation of a tier star: Gaia DR3 source_id or Tycho-2 number */
  private designation(i: number): string {
    const k = i - this.core;
    const hi = this.extHi[k], lo = this.extIds[k];
    if (this.tierOf(i)?.file === 'stars-gcns.bin') return `Gaia DR3 ${(BigInt(hi) << 32n) | BigInt(lo)}`;
    if (lo & 0x80000000) return `AT-HYG ${lo & 0x7fffffff}`;
    return `TYC ${lo >>> 16}-${(lo >>> 2) & 0x3fff}-${(lo & 3) + 1}`;
  }

  /** Display name: proper → planet-host designation → Bayer → Gliese → HIP → survey designation */
  nameOf(i: number): string {
    if (i === 0) return _('Güneş');
    if (i >= this.core) return this.designation(i);
    const n = this.names.get(i);
    if (n?.proper) return n.proper;
    // "eps Eri", "ups And": the Bayer letter reads better than the archive's abbreviation
    if (n?.host && !(n.bayer && /^[a-z]{2,3}\d? /.test(n.host))) return n.host;
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
    return this.position(i, _p).length();
  }

  /** Position (pc, scene frame, relative to the Sun) at the current epoch */
  position(i: number, out = new Vector3()): Vector3 {
    const p = this.positions, v = this.velocities, k = this.drift;
    return out.set(p[i * 3] + v[i * 3] * k, p[i * 3 + 1] + v[i * 3 + 1] * k, p[i * 3 + 2] + v[i * 3 + 2] * k);
  }

  /** Position in km, scene frame, relative to the Sun */
  positionKm(i: number, out = new Vector3()): Vector3 {
    return this.position(i, out).multiplyScalar(PARSEC_KM);
  }

  /** Space velocity (km/s, scene frame) */
  velocity(i: number, out = new Vector3()): Vector3 {
    const v = this.velocities;
    return out.set(v[i * 3] / 10, v[i * 3 + 1] / 10, v[i * 3 + 2] / 10);
  }

  hasPlanets(i: number): boolean {
    return (this.flags[i] & STAR_PLANETS) !== 0;
  }

  /** Physical parameters derived from the observables (deterministic) */
  info(i: number): StarInfo {
    const bv = this.bvs[i];
    const isWD = (this.flags[i] & STAR_WD) !== 0;
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
    const position = this.position(i);
    return {
      index: i,
      name: this.nameOf(i),
      names: this.names.get(i) ?? null,
      hip: this.hips[i] ?? 0,
      position,
      distancePc: position.length(),
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

  /**
   * Nearest star to a point (pc, scene frame, current epoch): the whole core, and the tier stars
   * within `tierReachPc` (free flight only cares about the next few parsecs).
   */
  nearest(x: number, y: number, z: number, exclude = -1, tierReachPc = 5): { index: number; distPc: number } {
    const p = this.positions, v = this.velocities, k = this.drift;
    let best = -1;
    let bestD2 = Infinity;
    for (let i = 0; i < this.core; i++) {
      if (i === exclude) continue;
      const dx = p[i * 3] + v[i * 3] * k - x, dy = p[i * 3 + 1] + v[i * 3 + 1] * k - y, dz = p[i * 3 + 2] + v[i * 3 + 2] * k - z;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 < bestD2) { bestD2 = d2; best = i; }
    }
    if (this.tierSearch && this.gridKeys.length) {
      // a star can have drifted out of its J2000 cell: widen the search by a generous 150 km/s
      const reach = Math.min(Math.sqrt(bestD2), tierReachPc) + Math.abs(k) * 1500;
      const r = Math.min(Math.ceil(reach / GRID_PC), 8);
      const cx = cell(x), cy = cell(y), cz = cell(z);
      for (let a = Math.max(0, cx - r); a <= Math.min(GRID_SPAN - 1, cx + r); a++) {
        for (let b = Math.max(0, cy - r); b <= Math.min(GRID_SPAN - 1, cy + r); b++) {
          for (let c = Math.max(0, cz - r); c <= Math.min(GRID_SPAN - 1, cz + r); c++) {
            const range = this.cellRange((a * GRID_SPAN + b) * GRID_SPAN + c);
            if (!range) continue;
            for (let g = range[0]; g < range[1]; g++) {
              const i = this.core + this.gridIdx[g];
              if (i === exclude) continue;
              const dx = p[i * 3] + v[i * 3] * k - x, dy = p[i * 3 + 1] + v[i * 3 + 1] * k - y, dz = p[i * 3 + 2] + v[i * 3 + 2] * k - z;
              const d2 = dx * dx + dy * dy + dz * dz;
              if (d2 < bestD2) { bestD2 = d2; best = i; }
            }
          }
        }
      }
    }
    return { index: best, distPc: Math.sqrt(bestD2) };
  }

  /** Text search over names / HIP / Gliese / planet hosts / survey designations. Returns indices, brightest first. */
  search(query: string, limit = 8): number[] {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const norm = (s: string) => s.toLowerCase();
    const hits: number[] = [];
    const hipMatch = /^hip\s*(\d+)$/i.exec(q);
    if (hipMatch) {
      const hip = parseInt(hipMatch[1], 10);
      for (let i = 0; i < this.core; i++) if (this.hips[i] === hip) { hits.push(i); break; }
    }
    const desig = this.findDesignation(q);
    if (desig >= 0) hits.push(desig);
    for (const [idx, n] of this.names) {
      if (hits.length >= limit * 4) break;
      if ((n.proper && norm(n.proper).includes(q)) || (n.bayer && norm(n.bayer).includes(q)) || (n.gliese && norm(n.gliese).includes(q)) || (n.host && norm(n.host).includes(q))) {
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

  /** "TYC 4669-731-1" / "Gaia DR3 4472832130942575872" among the loaded tiers */
  private findDesignation(q: string): number {
    const tyc = /^tyc\s*(\d+)-(\d+)-(\d+)$/.exec(q);
    const gaia = /^gaia\s*(?:dr3\s*)?(\d{6,20})$/.exec(q);
    if ((!tyc && !gaia) || !this.tierSearch) return -1;
    let hi = 0, lo = 0;
    if (tyc) lo = ((+tyc[1] << 16) | (+tyc[2] << 2) | (+tyc[3] - 1)) >>> 0;
    else { const id = BigInt(gaia![1]); hi = Number(id >> 32n); lo = Number(id & 0xffffffffn); }
    const n = this.count - this.core;
    for (let k = 0; k < n; k++) if (this.extIds[k] === lo && this.extHi[k] === hi) return this.core + k;
    return -1;
  }
}

const _p = new Vector3();
