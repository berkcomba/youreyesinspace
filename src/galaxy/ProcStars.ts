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

/** Per-tier GPU-ready buffers, positions relative to `origin` (scene pc) */
export class ProcTier {
  readonly capacity: number;
  readonly positions: Float32Array;
  readonly absMags: Float32Array;
  readonly colors: Float32Array;
  readonly ids: string[] = [];
  readonly indexOf = new Map<string, number>();
  readonly origin = new Vector3();
  count = 0;
  version = 0;
  /** camera cell at the time of generation */
  cell = [NaN, NaN, NaN];
  galaxy = -1;

  constructor(readonly spec: TierSpec) {
    const n = Math.pow(spec.reach * 2 + 1, 3);
    this.capacity = n * spec.maxPerCell;
    this.positions = new Float32Array(this.capacity * 3);
    this.absMags = new Float32Array(this.capacity);
    this.colors = new Float32Array(this.capacity * 3);
  }
}

const _local = new Vector3();
const _scene = new Vector3();
const _sunLocal = new Vector3();
const _tmp = new Vector3();

/**
 * Procedural stars: deterministic per-cell generation driven by the analytic galaxy density
 * model. Cells are regenerated as the camera moves; any star can be re-derived from its id
 * alone, so it can be selected, described and turned into a full planetary system.
 */
export class ProcStars {
  readonly tiers: ProcTier[] = TIERS.map((t) => new ProcTier(t));
  /** galaxy the tiers were last generated for */
  galaxy: number | null = null;
  private readonly infoCache = new Map<string, StarInfo>();

  constructor(private readonly galaxies: GalaxyIndex) {}

  /** Regenerate cells if the camera moved into another cell / galaxy. Returns changed tiers. */
  update(camPc: Vector3, galaxy: number | null): ProcTier[] {
    const changed: ProcTier[] = [];
    if (galaxy === null) {
      for (const t of this.tiers) {
        if (t.count !== 0 || t.galaxy !== -1) { t.count = 0; t.ids.length = 0; t.indexOf.clear(); t.galaxy = -1; t.cell = [NaN, NaN, NaN]; t.version++; changed.push(t); }
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
    t.cell = [ci, cj, ck];
    t.galaxy = g;
    t.count = 0;
    t.ids.length = 0;
    t.indexOf.clear();
    // buffer origin: centre of the camera cell, scene frame
    _tmp.set((ci + 0.5) * s, (cj + 0.5) * s, (ck + 0.5) * s);
    model.toScene(_tmp, t.origin);
    const r = t.spec.reach;
    const tierIdx = this.tiers.indexOf(t);
    const sample: StarSample = { local: new Vector3(), massSolar: 1, luminosity: 1, temperature: 5772, lumClass: 5 };
    for (let i = ci - r; i <= ci + r; i++) {
      for (let j = cj - r; j <= cj + r; j++) {
        for (let k = ck - r; k <= ck + r; k++) {
          const n = this.cellCount(t.spec, model, g, i, j, k);
          if (n === 0) continue;
          const rng = this.cellRng(t.spec, g, i, j, k);
          for (let q = 0; q < n; q++) {
            this.sampleStar(rng, t.spec, model, g, i, j, k, sample);
            if (sample.luminosity <= 0) continue;
            if (t.count >= t.capacity) break;
            model.toScene(sample.local, _scene).sub(t.origin);
            const idx = t.count++;
            t.positions[idx * 3] = _scene.x; t.positions[idx * 3 + 1] = _scene.y; t.positions[idx * 3 + 2] = _scene.z;
            t.absMags[idx] = absMagOf(sample.luminosity, sample.temperature);
            const [cr, cg, cb] = temperatureToRgb(sample.temperature);
            t.colors[idx * 3] = cr; t.colors[idx * 3 + 1] = cg; t.colors[idx * 3 + 2] = cb;
            const id = `p${g}:${tierIdx}:${i}:${j}:${k}:${q}`;
            t.ids.push(id);
            t.indexOf.set(id, idx);
          }
        }
      }
    }
    t.version++;
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
    let best: string | null = null;
    let bestD2 = Infinity;
    for (const t of this.tiers) {
      const ox = p.x - t.origin.x, oy = p.y - t.origin.y, oz = p.z - t.origin.z;
      const pos = t.positions;
      for (let i = 0; i < t.count; i++) {
        const dx = pos[i * 3] - ox, dy = pos[i * 3 + 1] - oy, dz = pos[i * 3 + 2] - oz;
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 < bestD2 && t.ids[i] !== exclude) { bestD2 = d2; best = t.ids[i]; }
      }
    }
    return best ? { id: best, distPc: Math.sqrt(bestD2) } : null;
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
