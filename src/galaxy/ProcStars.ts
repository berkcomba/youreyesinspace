import { Vector3 } from 'three';
import type { StarInfo } from '../data/StarCatalog';
import { Rng, hashSeed } from '../gen/SystemGenerator';
import {
  bolometricCorrection, bvToTemperature, radiusFromLuminosity, spectralFromTemperature, temperatureToRgb,
  LUM_CLASS_LABEL, SUN_MASS_KG, SUN_RADIUS_KM,
} from '../astro/stellar';
import type { GalaxyIndex } from './galaxies';
import type { GalaxyModel } from './GalaxyModel';

/** Star id: `p{galaxy}:{tier}:{ci}:{cj}:{ck}:{n}` */
export type ProcStarId = string;

export interface TierSpec {
  /** cell edge (pc) */
  size: number;
  /** stars per pc³ at unit model density */
  density: number;
  /** only luminous stars (giants, OB) – the mid-range tier */
  brightOnly: boolean;
  maxPerCell: number;
  /** cells on each side of the camera cell */
  reach: number;
}

export const TIERS: TierSpec[] = [
  { size: 40, density: 0.011, brightOnly: false, maxPerCell: 800, reach: 2 },
  { size: 400, density: 3.2e-6, brightOnly: true, maxPerCell: 420, reach: 2 },
];

/** Radius around the Sun (pc) where the real catalogue is used instead of procedural stars */
const HYG_RADIUS_PC = 80;

interface StarSample {
  local: Vector3;
  massSolar: number;
  luminosity: number;
  temperature: number;
  lumClass: number;
}

/** One generated cell: stars relative to the cell's centre (scene frame), kept across crossings */
interface CellData {
  key: string;
  i: number; j: number; k: number;
  count: number;
  positions: Float32Array;
  absMags: Float32Array;
  colors: Float32Array;
  /** draw index q of each star (stars inside the catalogue bubble are skipped, so q ≠ row) */
  qs: Uint16Array;
  /** cell centre, scene pc */
  centre: Vector3;
}

/** cells remembered per tier (a 5×5×5 neighbourhood is 125; this keeps the recent trail too) */
const CELL_CACHE = 600;

/** Per-tier GPU-ready buffers, positions relative to `origin` (scene pc) */
export class ProcTier {
  readonly capacity: number;
  readonly positions: Float32Array;
  readonly absMags: Float32Array;
  readonly colors: Float32Array;
  readonly origin = new Vector3();
  count = 0;
  version = 0;
  /** camera cell at the time of generation */
  cell = [NaN, NaN, NaN];
  galaxy = -1;
  /** the cells currently in the buffer, in buffer order, and where each one starts */
  readonly cells: CellData[] = [];
  readonly cellStart: number[] = [];
  /** per row: index into `cells` (ids are built from this on demand instead of 100k strings per crossing) */
  readonly rowCell: Uint16Array;
  private readonly tierIdx: number;

  constructor(readonly spec: TierSpec, tierIdx: number) {
    const n = Math.pow(spec.reach * 2 + 1, 3);
    this.capacity = n * spec.maxPerCell;
    this.positions = new Float32Array(this.capacity * 3);
    this.absMags = new Float32Array(this.capacity);
    this.colors = new Float32Array(this.capacity * 3);
    this.rowCell = new Uint16Array(this.capacity);
    this.tierIdx = tierIdx;
  }

  /** Id of the star in buffer row `row` */
  idAt(row: number): string {
    const c = this.cells[this.rowCell[row]];
    const q = c.qs[row - this.cellStart[this.rowCell[row]]];
    return `p${this.galaxy}:${this.tierIdx}:${c.i}:${c.j}:${c.k}:${q}`;
  }

  /** Buffer row of a star id, or -1 when it is not in the current neighbourhood */
  indexOfId(id: string): number {
    const m = /^p(\d+):(\d+):(-?\d+):(-?\d+):(-?\d+):(\d+)$/.exec(id);
    if (!m || +m[1] !== this.galaxy || +m[2] !== this.tierIdx) return -1;
    const i = +m[3], j = +m[4], k = +m[5], q = +m[6];
    for (let c = 0; c < this.cells.length; c++) {
      const cell = this.cells[c];
      if (cell.i !== i || cell.j !== j || cell.k !== k) continue;
      for (let r = 0; r < cell.count; r++) if (cell.qs[r] === q) return this.cellStart[c] + r;
      return -1;
    }
    return -1;
  }
}

const _local = new Vector3();
const _scene = new Vector3();
const _sunLocal = new Vector3();
const _tmp = new Vector3();
const _sample = new Vector3();

/**
 * Procedural stars: deterministic per-cell generation driven by the analytic galaxy density
 * model. Cells are regenerated as the camera moves; any star can be re-derived from its id
 * alone, so it can be selected, described and turned into a full planetary system.
 */
export class ProcStars {
  readonly tiers: ProcTier[] = TIERS.map((t, i) => new ProcTier(t, i));
  /** galaxy the tiers were last generated for */
  galaxy: number | null = null;
  private readonly infoCache = new Map<string, StarInfo>();
  /** generated cells per tier (a crossing only generates the new slab, the rest is copied) */
  private readonly cellCache: Map<string, CellData>[] = TIERS.map(() => new Map());

  constructor(private readonly galaxies: GalaxyIndex) {}

  /** Regenerate cells if the camera moved into another cell / galaxy. Returns changed tiers. */
  update(camPc: Vector3, galaxy: number | null): ProcTier[] {
    const changed: ProcTier[] = [];
    if (galaxy === null) {
      for (const t of this.tiers) {
        if (t.count !== 0 || t.galaxy !== -1) { t.count = 0; t.cells.length = 0; t.cellStart.length = 0; t.galaxy = -1; t.cell = [NaN, NaN, NaN]; t.version++; changed.push(t); }
      }
      this.galaxy = null;
      return changed;
    }
    const model = this.galaxies.model(galaxy);
    model.toLocal(camPc, _local);
    for (const t of this.tiers) {
      const s = t.spec.size;
      const ci = Math.floor(_local.x / s), cj = Math.floor(_local.y / s), ck = Math.floor(_local.z / s);
      if (t.galaxy === galaxy && t.cell[0] === ci && t.cell[1] === cj && t.cell[2] === ck) continue;
      this.generateTier(t, model, galaxy, ci, cj, ck);
      changed.push(t);
    }
    this.galaxy = galaxy;
    return changed;
  }

  private generateTier(t: ProcTier, model: GalaxyModel, g: number, ci: number, cj: number, ck: number): void {
    const s = t.spec.size;
    if (t.galaxy !== g) this.cellCache[this.tiers.indexOf(t)].clear();
    t.cell = [ci, cj, ck];
    t.galaxy = g;
    t.count = 0;
    t.cells.length = 0;
    t.cellStart.length = 0;
    // buffer origin: centre of the camera cell, scene frame
    _tmp.set((ci + 0.5) * s, (cj + 0.5) * s, (ck + 0.5) * s);
    model.toScene(_tmp, t.origin);
    const r = t.spec.reach;
    const cache = this.cellCache[this.tiers.indexOf(t)];
    for (let i = ci - r; i <= ci + r; i++) {
      for (let j = cj - r; j <= cj + r; j++) {
        for (let k = ck - r; k <= ck + r; k++) {
          const cell = this.cellData(cache, t.spec, model, g, i, j, k);
          if (cell.count === 0) continue;
          const n = Math.min(cell.count, t.capacity - t.count);
          if (n <= 0) break;
          const start = t.count;
          const ox = cell.centre.x - t.origin.x, oy = cell.centre.y - t.origin.y, oz = cell.centre.z - t.origin.z;
          for (let q = 0; q < n; q++) {
            const dst = (start + q) * 3, src = q * 3;
            t.positions[dst] = cell.positions[src] + ox;
            t.positions[dst + 1] = cell.positions[src + 1] + oy;
            t.positions[dst + 2] = cell.positions[src + 2] + oz;
          }
          t.absMags.set(cell.absMags.subarray(0, n), start);
          t.colors.set(cell.colors.subarray(0, n * 3), start * 3);
          t.rowCell.fill(t.cells.length, start, start + n);
          t.cells.push(cell);
          t.cellStart.push(start);
          t.count += n;
        }
      }
    }
    t.version++;
  }

  /** The stars of one cell, generated once and remembered (positions relative to the cell centre) */
  private cellData(cache: Map<string, CellData>, spec: TierSpec, model: GalaxyModel, g: number, i: number, j: number, k: number): CellData {
    const key = `${i}:${j}:${k}`;
    let cell = cache.get(key);
    if (cell) { cache.delete(key); cache.set(key, cell); return cell; }   // refresh (LRU)
    const s = spec.size;
    const n = this.cellCount(spec, model, g, i, j, k);
    const centre = model.toScene(_tmp.set((i + 0.5) * s, (j + 0.5) * s, (k + 0.5) * s), new Vector3());
    cell = { key, i, j, k, count: 0, positions: new Float32Array(n * 3), absMags: new Float32Array(n), colors: new Float32Array(n * 3), qs: new Uint16Array(n), centre };
    if (n > 0) {
      const rng = this.cellRng(spec, g, i, j, k);
      const sample: StarSample = { local: _sample, massSolar: 1, luminosity: 1, temperature: 5772, lumClass: 5 };
      for (let q = 0; q < n; q++) {
        this.sampleStar(rng, spec, model, g, i, j, k, sample);
        if (sample.luminosity <= 0) continue;
        model.toScene(sample.local, _scene).sub(centre);
        const idx = cell.count++;
        cell.positions[idx * 3] = _scene.x; cell.positions[idx * 3 + 1] = _scene.y; cell.positions[idx * 3 + 2] = _scene.z;
        cell.absMags[idx] = absMagOf(sample.luminosity, sample.temperature);
        const [cr, cg, cb] = temperatureToRgb(sample.temperature);
        cell.colors[idx * 3] = cr; cell.colors[idx * 3 + 1] = cg; cell.colors[idx * 3 + 2] = cb;
        cell.qs[idx] = q;
      }
    }
    if (cache.size >= CELL_CACHE) cache.delete(cache.keys().next().value!);
    cache.set(key, cell);
    return cell;
  }

  private cellRng(spec: TierSpec, g: number, i: number, j: number, k: number): Rng {
    return new Rng(hashSeed(g, spec.size, i, j, k, 0x57a2));
  }

  /** Deterministic number of stars in a cell */
  private cellCount(spec: TierSpec, model: GalaxyModel, g: number, i: number, j: number, k: number): number {
    const s = spec.size;
    _tmp.set((i + 0.5) * s, (j + 0.5) * s, (k + 0.5) * s);
    const rho = model.density(_tmp);
    const expected = rho * spec.density * s * s * s;
    if (expected < 0.02) return 0;
    const jitter = new Rng(hashSeed(g, spec.size, i, j, k, 0xc0)).next();
    return Math.min(spec.maxPerCell, Math.floor(expected + jitter));
  }

  /**
   * Draw one star. Uses a fixed number of RNG draws so star q of a cell can be re-derived
   * by drawing q times. Stars inside the HYG bubble (Milky Way only) get luminosity 0 (skipped).
   */
  private sampleStar(rng: Rng, spec: TierSpec, model: GalaxyModel, g: number, i: number, j: number, k: number, out: StarSample): void {
    const s = spec.size;
    out.local.set((i + rng.next()) * s, (j + rng.next()) * s, (k + rng.next()) * s);
    const u1 = rng.next(), u2 = rng.next(), u3 = rng.next(), u4 = rng.next();
    if (spec.brightOnly) {
      if (u2 < 0.55) {
        // giants / supergiants
        out.lumClass = u3 < 0.12 ? 1 : 3;
        out.luminosity = out.lumClass === 1 ? Math.exp(Math.log(3000) + u1 * (Math.log(60000) - Math.log(3000))) : Math.exp(Math.log(60) + u1 * (Math.log(1500) - Math.log(60)));
        out.temperature = 3400 + u4 * (out.lumClass === 1 ? 8000 : 2000);
        out.massSolar = out.lumClass === 1 ? 10 + u3 * 15 : 1.2 + u3 * 3;
      } else {
        const m = Math.min(4 * Math.pow(1 - u1 * 0.995, -1 / 1.3), 60);
        mainSequence(m, out);
      }
    } else {
      const m = Math.min(0.45 * Math.pow(1 - u1 * 0.9995, -1 / 1.3), 40);
      if (m > 0.8 && u2 < 0.06) {
        out.lumClass = 3;
        out.luminosity = Math.exp(Math.log(25) + u3 * (Math.log(400) - Math.log(25)));
        out.temperature = 3600 + u4 * 1400;
        out.massSolar = 1 + u3 * 2;
      } else {
        mainSequence(m, out);
      }
    }
    if (g === 0) {
      model.toLocal(_sunLocal.set(0, 0, 0), _sunLocal);
      if (out.local.distanceTo(_sunLocal) < HYG_RADIUS_PC) out.luminosity = 0;
    }
  }

  /** Parse an id and rebuild the star deterministically */
  private derive(id: ProcStarId): { g: number; tier: TierSpec; sample: StarSample } | null {
    const m = /^p(\d+):(\d+):(-?\d+):(-?\d+):(-?\d+):(\d+)$/.exec(id);
    if (!m) return null;
    const g = +m[1], tierIdx = +m[2], i = +m[3], j = +m[4], k = +m[5], q = +m[6];
    const spec = TIERS[tierIdx];
    if (!spec) return null;
    const model = this.galaxies.model(g);
    const rng = this.cellRng(spec, g, i, j, k);
    const sample: StarSample = { local: new Vector3(), massSolar: 1, luminosity: 1, temperature: 5772, lumClass: 5 };
    for (let n = 0; n <= q; n++) this.sampleStar(rng, spec, model, g, i, j, k, sample);
    return { g, tier: spec, sample };
  }

  static isProc(id: string): boolean { return id.startsWith('p'); }

  galaxyOf(id: ProcStarId): number {
    const m = /^p(\d+):/.exec(id);
    return m ? +m[1] : -1;
  }

  /** Scene-frame position (pc, relative to the Sun) of a procedural star */
  positionPc(id: ProcStarId, out = new Vector3()): Vector3 {
    return out.copy(this.info(id).position);
  }

  static hashOf(id: ProcStarId): number {
    return hashSeed(...id.split(/[p:]/).filter(Boolean).map(Number), 0x9e37) & 0x7fffffff;
  }

  /** Catalogue-style designation without deriving the full star (cheap enough for labels) */
  static nameOf(id: ProcStarId): string {
    return `YE ${ProcStars.hashOf(id).toString(36).toUpperCase()}`;
  }

  info(id: ProcStarId): StarInfo {
    const cached = this.infoCache.get(id);
    if (cached) return cached;
    const d = this.derive(id);
    if (!d) throw new Error(`Bad procedural star id ${id}`);
    const { g, sample } = d;
    const model = this.galaxies.model(g);
    const position = model.toScene(sample.local);
    const distancePc = position.length();
    const T = sample.temperature;
    const L = sample.luminosity;
    const absMag = absMagOf(L, T);
    const hash = ProcStars.hashOf(id);
    const lumLabel = LUM_CLASS_LABEL[sample.lumClass] ?? 'V';
    const radiusSolar = radiusFromLuminosity(L, T);
    const info: StarInfo = {
      index: hash,
      name: ProcStars.nameOf(id),
      names: null,
      hip: 0,
      position,
      distancePc,
      mag: absMag + 5 * Math.log10(Math.max(distancePc, 1e-3)) - 5,
      absMag,
      bv: bvFromTemperature(T),
      temperature: T,
      luminosity: L,
      radiusSolar,
      radiusKm: radiusSolar * SUN_RADIUS_KM,
      massSolar: sample.massSolar,
      massKg: sample.massSolar * SUN_MASS_KG,
      spectral: spectralFromTemperature(T) + lumLabel,
      lumClass: sample.lumClass,
      catalogSpectral: '',
      isWhiteDwarf: false,
      procedural: true,
    };
    if (this.infoCache.size > 64) this.infoCache.delete(this.infoCache.keys().next().value!);
    this.infoCache.set(id, info);
    return info;
  }

  /** Nearest generated star to a point (scene pc). */
  nearest(p: Vector3, exclude: string | null = null): { id: string; distPc: number } | null {
    let best = -1;
    let bestTier: ProcTier | null = null;
    let bestD2 = Infinity;
    for (const t of this.tiers) {
      const ox = p.x - t.origin.x, oy = p.y - t.origin.y, oz = p.z - t.origin.z;
      const pos = t.positions;
      for (let i = 0; i < t.count; i++) {
        const dx = pos[i * 3] - ox, dy = pos[i * 3 + 1] - oy, dz = pos[i * 3 + 2] - oz;
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 < bestD2) { bestD2 = d2; best = i; bestTier = t; }
      }
    }
    if (bestTier && exclude !== null && bestTier.idAt(best) === exclude) {
      // the excluded star itself was the nearest: look again without it
      const excl = bestTier.indexOfId(exclude);
      let b2 = -1, t2: ProcTier | null = null, d2b = Infinity;
      for (const t of this.tiers) {
        const ox = p.x - t.origin.x, oy = p.y - t.origin.y, oz = p.z - t.origin.z;
        const pos = t.positions;
        for (let i = 0; i < t.count; i++) {
          if (t === bestTier && i === excl) continue;
          const dx = pos[i * 3] - ox, dy = pos[i * 3 + 1] - oy, dz = pos[i * 3 + 2] - oz;
          const d2 = dx * dx + dy * dy + dz * dz;
          if (d2 < d2b) { d2b = d2; b2 = i; t2 = t; }
        }
      }
      return t2 ? { id: t2.idAt(b2), distPc: Math.sqrt(d2b) } : null;
    }
    return bestTier ? { id: bestTier.idAt(best), distPc: Math.sqrt(bestD2) } : null;
  }
}

function mainSequence(m: number, out: StarSample): void {
  out.massSolar = m;
  out.lumClass = 5;
  out.luminosity = m < 0.43 ? 0.23 * Math.pow(m, 2.3) : m < 2 ? Math.pow(m, 4) : m < 20 ? 1.4 * Math.pow(m, 3.5) : 32000 * m;
  out.temperature = 5772 * Math.pow(m, 0.505);
}

function absMagOf(L: number, T: number): number {
  const mBol = 4.74 - 2.5 * Math.log10(Math.max(L, 1e-9));
  return mBol - bolometricCorrection(T);
}

/** Invert Ballesteros' formula by bisection */
function bvFromTemperature(T: number): number {
  let lo = -0.4, hi = 2.2;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (bvToTemperature(mid) > T) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}
