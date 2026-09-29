import { Vector3 } from 'three';
import type { StarCatalog, StarInfo } from '../data/StarCatalog';
import { PLANET_HOTKEYS, SOLAR_BELTS, SOLAR_SYSTEM } from '../data/solarSystem';
import { generateSystem } from '../gen/SystemGenerator';
import { GalaxyIndex } from '../galaxy/galaxies';
import { ProcStars } from '../galaxy/ProcStars';
import { PARSEC_KM } from './constants';
import type { CelestialBody } from './CelestialBody';
import { StarSystem } from './StarSystem';

const _v = new Vector3();

/** Universal star id: `c{n}` = catalogue star n (c0 = Sun), `p…` = procedural star */
export type StarId = string;

export function catalogIndexOf(id: StarId): number {
  return id.startsWith('c') ? parseInt(id.slice(1), 10) : -1;
}

/**
 * The universe graph.
 *
 * Level 0: galaxies – the Milky Way, a catalogue of real neighbours and a procedural cosmic web.
 * Level 1: stars – the real HYG catalogue around the Sun, procedural stars everywhere else,
 *          generated on demand from each galaxy's density model.
 * Level 2: star systems – the Solar System from the hand-made catalogue, everything else
 *          generated deterministically from the star. Only the *current* system is fully
 *          instantiated; others are rendered as points.
 *
 * Hierarchical coordinates: every system has its own km-scale origin, so double precision is
 * spent where it matters (planet surfaces) and never on galactic distances.
 */
export class Universe {
  current: StarSystem;
  readonly galaxies: GalaxyIndex;
  readonly procStars: ProcStars;
  /** galaxy the camera is currently inside (null = intergalactic space) */
  currentGalaxy: number | null = 0;
  private readonly cache = new Map<StarId, StarSystem>();
  private readonly listeners: Array<(sys: StarSystem, prev: StarSystem) => void> = [];

  constructor(readonly catalog: StarCatalog) {
    this.galaxies = new GalaxyIndex();
    this.procStars = new ProcStars(this.galaxies);
    this.current = this.system('c0');
  }

  /** Physical description of any star */
  starInfo(id: StarId): StarInfo {
    const ci = catalogIndexOf(id);
    return ci >= 0 ? this.catalog.info(ci) : this.procStars.info(id);
  }

  starName(id: StarId): string {
    const ci = catalogIndexOf(id);
    return ci >= 0 ? this.catalog.nameOf(ci) : this.procStars.info(id).name;
  }

  /** Star position in parsecs (scene frame, relative to the Sun) */
  starPositionPc(id: StarId, out = new Vector3()): Vector3 {
    const ci = catalogIndexOf(id);
    return ci >= 0 ? this.catalog.position(ci, out) : this.procStars.positionPc(id, out);
  }

  /** Galaxy a star belongs to */
  galaxyOfStar(id: StarId): number {
    return catalogIndexOf(id) >= 0 ? 0 : this.procStars.galaxyOf(id);
  }

  /** Instantiate (or fetch from cache) a star's system. */
  system(id: StarId): StarSystem {
    const cached = this.cache.get(id);
    if (cached) return cached;
    let sys: StarSystem;
    const ci = catalogIndexOf(id);
    if (ci === 0) {
      sys = new StarSystem('sol', 'c0', 0, new Vector3(), SOLAR_SYSTEM, SOLAR_BELTS, PLANET_HOTKEYS);
    } else {
      const info = this.starInfo(id);
      const gen = generateSystem(info);
      const origin = info.position.clone().multiplyScalar(PARSEC_KM);
      sys = new StarSystem(gen.id, id, ci, origin, gen.bodies, gen.belts, gen.planetIds);
    }
    // keep a handful of recently visited systems alive
    if (this.cache.size > 6) {
      for (const k of this.cache.keys()) {
        if (k !== 'c0' && k !== this.current?.starId) { this.cache.delete(k); break; }
      }
    }
    this.cache.set(id, sys);
    return sys;
  }

  onSystemChange(fn: (sys: StarSystem, prev: StarSystem) => void): void {
    this.listeners.push(fn);
  }

  /**
   * Make another system the current frame. Returns the offset (km) to add to any position
   * expressed in the previous system's frame to re-express it in the new one.
   */
  switchTo(id: StarId, jd: number, tSeconds: number): Vector3 {
    const prev = this.current;
    if (prev.starId === id) return new Vector3();
    const next = this.system(id);
    next.update(jd, tSeconds);
    const delta = new Vector3().copy(prev.origin).sub(next.origin);
    this.current = next;
    for (const fn of this.listeners) fn(next, prev);
    return delta;
  }

  /** Camera position in the current frame (km) → parsecs relative to the Sun */
  toParsecs(localKm: Vector3, out = new Vector3()): Vector3 {
    return out.copy(localKm).add(this.current.origin).multiplyScalar(1 / PARSEC_KM);
  }

  /** Direction & distance (km) from a local position to a star */
  starRelative(id: StarId, localKm: Vector3, out = new Vector3()): Vector3 {
    this.starPositionPc(id, out).multiplyScalar(PARSEC_KM);
    return out.sub(this.current.origin).sub(localKm);
  }

  /** Direction & distance (km) from a local position to a galaxy centre */
  galaxyRelative(i: number, localKm: Vector3, out = new Vector3()): Vector3 {
    this.galaxies.position(i, out).multiplyScalar(PARSEC_KM);
    return out.sub(this.current.origin).sub(localKm);
  }

  /** Nearest star (catalogue or generated) to a local position; used to decide frame switches */
  nearestStar(localKm: Vector3): { id: StarId; distPc: number } {
    const p = this.toParsecs(localKm, _v);
    const c = this.catalog.nearest(p.x, p.y, p.z);
    let best = { id: `c${c.index}`, distPc: c.distPc };
    const pr = this.procStars.nearest(p);
    if (pr && pr.distPc < best.distPc) best = pr;
    return best;
  }

  /* ---------- delegates to the current system ---------- */
  get bodies(): CelestialBody[] { return this.current.bodies; }
  get roots(): CelestialBody[] { return this.current.roots; }
  get star(): CelestialBody { return this.current.star; }
  get(id: string): CelestialBody | undefined { return this.current.get(id); }
  update(jd: number, tSeconds: number): void { this.current.update(jd, tSeconds); }
  dominantBody(point: { x: number; y: number; z: number }): CelestialBody { return this.current.dominantBody(point); }
  nearestBody(point: { x: number; y: number; z: number }): { body: CelestialBody; altitude: number } { return this.current.nearestBody(point); }
}
