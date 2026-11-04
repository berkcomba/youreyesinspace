import { Vector3 } from 'three';
import type { StarInfo } from '../data/StarCatalog';
import type { LandmarkDef } from '../data/landmarks';
import { Rng } from '../gen/SystemGenerator';
import {
  bolometricCorrection, bvToTemperature, radiusFromLuminosity, spectralFromTemperature, temperatureToRgb,
  LUM_CLASS_LABEL, SUN_MASS_KG, SUN_RADIUS_KM,
} from '../astro/stellar';
import type { Landmark } from '../core/Universe';

/**
 * Member stars of the generated star clusters. Every member is a real star of the universe: it has
 * a deterministic id (`k{landmark id}#{n}`), physical parameters consistent with the cluster's age
 * (main sequence below the turn-off, giants at it, blue stragglers / horizontal branch), and a
 * planetary system generated on demand like any other star.
 */
export interface ClusterMember {
  /** offset from the cluster centre (pc, scene frame) */
  x: number; y: number; z: number;
  massSolar: number;
  temperature: number;
  luminosity: number;
  lumClass: number;
  absMag: number;
  color: [number, number, number];
}

/** cluster parameters stored on a procedural landmark */
export interface ClusterParams {
  ageMyr: number;
  /** total members (rendered / selectable ones are capped) */
  count: number;
  /** [Fe/H], globulars */
  feh?: number;
  /** centre of the member distribution relative to the landmark (pc, scene frame); the landmark centre by default */
  centrePc?: [number, number, number];
  /** radius of the member distribution (pc); the landmark radius by default (an H II region's exciting cluster is far smaller than the cloud) */
  radiusPc?: number;
  /**
   * faintest-allowed absolute magnitude floor: no member brighter than this. Catalogue nebulae use
   * it so the generated members only fill in below the survey's completeness limit and never
   * duplicate the real stars already in the catalogue.
   */
  minAbsMag?: number;
}

/** Does this landmark carry real, selectable member stars? */
export function hasMembers(def: LandmarkDef): boolean {
  return def.cluster !== undefined || def.kind === 'cluster' || def.kind === 'globular';
}

/** Are the members drawn / pickable? Generated objects: always; catalogue objects: only when given explicit parameters */
export function drawsMembers(def: LandmarkDef): boolean {
  return def.procedural ? hasMembers(def) : def.cluster !== undefined;
}

/** apparent magnitude the star catalogue is complete to (Tycho-2) */
const CATALOG_COMPLETE_MAG = 11.0;

/**
 * Member parameters for a catalogue emission nebula: the young exciting cluster inside the cloud.
 * Members stay fainter than the catalogue's completeness limit at the nebula's distance, so the
 * bright O/B stars remain the real ones (e.g. the Trapezium in M42).
 */
export function nebulaCluster(radiusPc: number, distancePc: number | undefined): ClusterParams {
  return catalogueCluster(distancePc, {
    ageMyr: 2,
    count: Math.round(Math.min(Math.max(150 * radiusPc / 6, 60), MAX_OPEN)),
    radiusPc: radiusPc * 0.35,
  });
}

/**
 * Member parameters for a catalogue cluster (MWSC open clusters, Harris globulars, the hand-picked
 * ones): generated members below the star catalogue's completeness limit at its distance, so a
 * nearby cluster whose bright stars the catalogue already holds (the Pleiades) only gains its faint
 * dwarfs, while a distant one gets the whole population. Without them the cluster would resolve
 * into nothing but the unresolved glow: the sprite's stars vanish and no real ones replace them.
 */
export function catalogueCluster(distancePc: number | undefined, params: Omit<ClusterParams, 'minAbsMag'>): ClusterParams {
  const d = distancePc ?? 50_000;
  return { ...params, minAbsMag: CATALOG_COMPLETE_MAG - 5 * Math.log10(Math.max(d, 10) / 10) };
}

/** Member count of a globular from its integrated magnitude (capped: the draw is one point per member) */
export function globularCount(absMag: number): number {
  return Math.round(Math.min(MAX_GLOBULAR, 2500 * Math.pow(10, -0.4 * (absMag + 7))));
}

export const MAX_OPEN = 700;
export const MAX_GLOBULAR = 6000;

export function memberId(landmarkId: string, n: number): string { return `k${landmarkId}#${n}`; }
export function isMemberId(id: string): boolean { return id.startsWith('k'); }
export function parseMemberId(id: string): { landmarkId: string; n: number } | null {
  const m = /^k(.+)#(\d+)$/.exec(id);
  return m ? { landmarkId: m[1], n: +m[2] } : null;
}

/** Deterministic member list of a cluster landmark (cached by the caller). */
export function clusterMembers(def: LandmarkDef): ClusterMember[] {
  const c = def.cluster ?? { ageMyr: def.kind === 'globular' ? 12_000 : 200, count: 300 };
  const rng = new Rng(hashStr(def.id) ^ 0x5c1a);
  const R = c.radiusPc ?? def.radiusPc;
  const [cx, cy, cz] = c.centrePc ?? [0, 0, 0];
  const globular = def.kind === 'globular';
  const n = Math.min(c.count, globular ? MAX_GLOBULAR : MAX_OPEN);
  // main-sequence turn-off mass from the age (t_MS ≈ 10 Gyr · M^-2.5)
  const mTurn = Math.pow(c.ageMyr / 10_000, -1 / 2.5);
  const out: ClusterMember[] = [];
  const p = new Vector3();
  for (let i = 0; i < n; i++) {
    let m = 0, T = 0, L = 0, lumClass = 5, absMag = 0;
    // stars brighter than the floor are re-drawn (they are the catalogue's, not ours)
    for (let attempt = 0; attempt < 12; attempt++) {
      // Kroupa-like IMF between 0.3 M☉ and the turn-off (heavier stars are already remnants)
      const u = rng.next();
      if (u < 0.45) m = 0.3 + rng.next() * 0.5;
      else m = Math.min(0.8 * Math.pow(1 - rng.next() * 0.999, -1 / 1.35), Math.max(mTurn * 1.08, 0.85));
      lumClass = 5;
      if (m >= mTurn * 0.92 && m <= mTurn * 1.08 && rng.chance(0.55)) {
        // at the turn-off: red giants (globulars: the red giant branch; young clusters: red supergiants)
        lumClass = 3;
        const ms = mainSequenceL(m);
        // evolved stars: the giant-branch gain shrinks with mass (massive stars evolve at roughly
        // constant luminosity); nothing brighter than the Eddington-limited ~1e6 L☉
        if (m > 4) {
          L = Math.min(ms * (m > 12 ? rng.range(1.5, 4) : rng.range(5, 15)), 1.2e6);
          T = rng.range(3600, 4800);
        } else {
          // low-mass stars climb a long giant branch: most sit near its foot (10–30 L☉), a few
          // reach the tip at ~2000 L☉ (M_V ≈ −3), cooler and redder the higher they are
          const g = Math.pow(rng.next(), 2.5);
          L = ms * Math.pow(10, 1.0 + 2.4 * g);
          T = 5000 - 1300 * g + rng.range(-150, 150);
        }
        if (m > 8) { lumClass = 1; T = rng.range(3400, 4000); }
      } else if (m > mTurn * 1.08) {
        // past the turn-off and still here: horizontal branch (globulars) / blue stragglers
        lumClass = 3;
        L = rng.range(30, 70);
        T = globular ? rng.range(7000, 12_000) : rng.range(9000, 15_000);
      } else {
        L = mainSequenceL(m);
        T = 5772 * Math.pow(m, 0.505);
        if (globular && c.feh !== undefined) T *= 1 + 0.025 * Math.max(0, -c.feh - 1); // metal-poor stars run bluer
      }
      absMag = 4.74 - 2.5 * Math.log10(Math.max(L, 1e-9)) - bolometricCorrection(T);
      if (c.minAbsMag === undefined || absMag >= c.minAbsMag) break;
      if (attempt === 11) {
        // give up: a dwarf just below the floor
        lumClass = 5; absMag = c.minAbsMag + rng.range(0.2, 1.5);
        L = Math.pow(10, (4.74 - absMag) / 2.5); m = Math.min(Math.max(Math.pow(L, 1 / 4), 0.3), 2); T = 5772 * Math.pow(m, 0.505);
      }
    }
    // position: Plummer sphere (open) or King-like (globular), heavy stars sink to the centre
    const seg = Math.pow(Math.min(m / Math.max(mTurn, 0.9), 1), 0.5);
    let r: number;
    if (globular) {
      const rc = R * 0.12;
      const uu = Math.max(rng.next(), 1e-5);
      r = rc * Math.sqrt(1 / uu - 1) * 0.55 * (1.2 - 0.5 * seg);
    } else {
      const a = R * 0.45 * (1.15 - 0.45 * seg);
      const uu = Math.max(rng.next(), 1e-4);
      r = a / Math.sqrt(Math.pow(uu, -2 / 3) - 1);
    }
    r = Math.min(r, R * 1.5);
    const zc = rng.range(-1, 1), th = rng.range(0, Math.PI * 2), rr = Math.sqrt(1 - zc * zc);
    p.set(rr * Math.cos(th), rr * Math.sin(th), zc).multiplyScalar(r);
    out.push({ x: p.x + cx, y: p.y + cy, z: p.z + cz, massSolar: m, temperature: T, luminosity: L, lumClass, absMag, color: temperatureToRgb(T) });
  }
  return out;
}

function mainSequenceL(m: number): number {
  return m < 0.43 ? 0.23 * Math.pow(m, 2.3) : m < 2 ? Math.pow(m, 4) : m < 20 ? 1.4 * Math.pow(m, 3.5) : 32000 * m;
}

export function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h >>> 0;
}

/**
 * Member-star registry: caches member lists per cluster and answers the universe's star queries
 * (info / position / nearest) for `k…` ids.
 */
export class ClusterStars {
  private readonly cache = new Map<string, ClusterMember[]>();
  private readonly infoCache = new Map<string, StarInfo>();

  constructor(private readonly landmarkOf: (id: string) => Landmark | undefined) {}

  members(l: Landmark): ClusterMember[] {
    let m = this.cache.get(l.def.id);
    if (!m) {
      m = clusterMembers(l.def);
      if (this.cache.size > 16) this.cache.delete(this.cache.keys().next().value!);
      this.cache.set(l.def.id, m);
    }
    return m;
  }

  /** Landmark + member behind an id (null when the id is malformed or the cluster unknown) */
  resolve(id: string): { landmark: Landmark; member: ClusterMember; n: number } | null {
    const p = parseMemberId(id);
    if (!p) return null;
    const landmark = this.landmarkOf(p.landmarkId);
    if (!landmark) return null;
    const list = this.members(landmark);
    const member = list[p.n];
    return member ? { landmark, member, n: p.n } : null;
  }

  static nameOf(clusterName: string, n: number): string { return `${clusterName} ${n + 1}`; }

  galaxyOf(id: string): number { return this.resolve(id)?.landmark.galaxy ?? 0; }

  positionPc(id: string, out = new Vector3()): Vector3 {
    const r = this.resolve(id);
    if (!r) return out.set(0, 0, 0);
    return out.set(r.member.x, r.member.y, r.member.z).add(r.landmark.positionPc);
  }

  info(id: string): StarInfo {
    const cached = this.infoCache.get(id);
    if (cached) return cached;
    const r = this.resolve(id);
    if (!r) throw new Error(`Bad cluster star id ${id}`);
    const { landmark, member: s, n } = r;
    const position = new Vector3(s.x, s.y, s.z).add(landmark.positionPc);
    const distancePc = position.length();
    const radiusSolar = radiusFromLuminosity(s.luminosity, s.temperature);
    const info: StarInfo = {
      index: hashStr(id) & 0x7fffffff,
      name: ClusterStars.nameOf(landmark.def.name, n),
      names: null,
      hip: 0,
      position,
      distancePc,
      mag: s.absMag + 5 * Math.log10(Math.max(distancePc, 1e-3)) - 5,
      absMag: s.absMag,
      bv: bvFromTemperature(s.temperature),
      temperature: s.temperature,
      luminosity: s.luminosity,
      radiusSolar,
      radiusKm: radiusSolar * SUN_RADIUS_KM,
      massSolar: s.massSolar,
      massKg: s.massSolar * SUN_MASS_KG,
      spectral: spectralFromTemperature(s.temperature) + (LUM_CLASS_LABEL[s.lumClass] ?? 'V'),
      lumClass: s.lumClass,
      catalogSpectral: '',
      isWhiteDwarf: false,
      procedural: true,
    };
    if (this.infoCache.size > 64) this.infoCache.delete(this.infoCache.keys().next().value!);
    this.infoCache.set(id, info);
    return info;
  }

  /** Nearest member of any cluster the point is inside / next to (scene pc). */
  nearest(p: Vector3, landmarks: Landmark[], from = 0): { id: string; distPc: number } | null {
    let best: { id: string; distPc: number } | null = null;
    for (let i = from; i < landmarks.length; i++) {
      const l = landmarks[i];
      if (!hasMembers(l.def)) continue;
      const R = l.def.radiusPc * 2;
      if (l.positionPc.distanceToSquared(p) > R * R) continue;
      const ox = p.x - l.positionPc.x, oy = p.y - l.positionPc.y, oz = p.z - l.positionPc.z;
      const list = this.members(l);
      for (let n = 0; n < list.length; n++) {
        const s = list[n];
        const d2 = (s.x - ox) ** 2 + (s.y - oy) ** 2 + (s.z - oz) ** 2;
        if (!best || d2 < best.distPc * best.distPc) best = { id: memberId(l.def.id, n), distPc: Math.sqrt(d2) };
      }
    }
    return best;
  }
}

function bvFromTemperature(T: number): number {
  let lo = -0.4, hi = 2.2;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (bvToTemperature(mid) > T) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}
