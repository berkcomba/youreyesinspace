import { Vector3 } from 'three';
import type { StarCatalog, StarInfo } from '../data/StarCatalog';
import { PLANET_HOTKEYS, SOLAR_BELTS, SOLAR_SYSTEM } from '../data/solarSystem';
import { generateSystem } from '../gen/SystemGenerator';
import { BLACK_HOLES, type BlackHoleEntry } from '../data/blackholes';
import { LANDMARKS, landmarkStarBodies, landmarkStarInfo, type LandmarkDef } from '../data/landmarks';
import { raDecToScene } from '../math/frames';
import type { BodyData } from '../data/types';
import { GalaxyIndex } from '../galaxy/galaxies';
import { milkyWayCenterPc } from '../galaxy/frames';
import { ProcStars } from '../galaxy/ProcStars';
import { PARSEC_KM } from './constants';
import type { CelestialBody } from './CelestialBody';
import { StarSystem } from './StarSystem';

const _v = new Vector3();

/** Universal star id: `c{n}` = catalogue star n (c0 = Sun), `p…` = procedural star, `b{n}` = black-hole system */
export type StarId = string;

export function catalogIndexOf(id: StarId): number {
  return id.startsWith('c') ? parseInt(id.slice(1), 10) : -1;
}

/** A black hole resolved against the catalogues */
export interface BlackHole {
  entry: BlackHoleEntry;
  /** star id of the system that contains it (`b{n}` or the host's `c{n}`) */
  systemStarId: StarId;
  /** position of the system in parsecs (scene frame) */
  positionPc: Vector3;
  galaxy: number;
  /** StarInfo of the primary (stand-alone systems only) */
  info: StarInfo | null;
}

/** A hand-made system that is not in the HYG catalogue (black-hole systems, landmark stars) */
export interface ExtraSystem {
  id: StarId;
  name: string;
  positionPc: Vector3;
  galaxy: number;
  info: StarInfo;
  bodies: () => BodyData[];
}

/** A deep-sky landmark resolved against the galaxy catalogue */
export interface Landmark {
  def: LandmarkDef;
  positionPc: Vector3;
  galaxy: number;
  /** system id for star-type landmarks (`l{n}`) */
  systemId: StarId | null;
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
  /** real black holes (stand-alone systems `b{n}` and companions of catalogue stars) */
  readonly blackHoles: BlackHole[] = [];
  /** nebulae, clusters, remnants and record stars (Milky Way + nearby galaxies) */
  readonly landmarks: Landmark[] = [];
  private readonly extraSystems = new Map<StarId, ExtraSystem>();
  private readonly cache = new Map<StarId, StarSystem>();
  private readonly listeners: Array<(sys: StarSystem, prev: StarSystem) => void> = [];

  constructor(readonly catalog: StarCatalog) {
    this.galaxies = new GalaxyIndex();
    this.procStars = new ProcStars(this.galaxies);
    const findGalaxy = (q: string): number | null => {
      for (let i = 1; i < this.galaxies.catalogCount; i++) if (this.galaxies.name(i).includes(q)) return i;
      return null;
    };
    const ctx = {
      milkyWayCenterPc: () => milkyWayCenterPc(),
      galaxyPositionPc: (q: string) => {
        const i = findGalaxy(q);
        return i === null ? null : { index: i, position: this.galaxies.position(i) };
      },
      galaxyPlanePoint: (q: string, ra: number, dec: number) => {
        const i = findGalaxy(q);
        return i === null ? new Vector3() : this.galaxyPlanePoint(i, ra, dec);
      },
    };
    for (const entry of BLACK_HOLES) {
      if (entry.host.kind === 'catalog') {
        const hit = catalog.search(entry.host.starRef, 1)[0];
        if (hit === undefined) continue;
        this.blackHoles.push({ entry, systemStarId: `c${hit}`, positionPc: catalog.position(hit), galaxy: 0, info: null });
      } else {
        const pos = entry.host.positionPc(ctx);
        const galaxy = entry.galaxy?.(ctx) ?? 0;
        const info = entry.info?.(pos) ?? null;
        this.blackHoles.push({ entry, systemStarId: entry.id, positionPc: pos, galaxy, info });
        if (info && entry.bodies) this.extraSystems.set(entry.id, { id: entry.id, name: entry.name, positionPc: pos, galaxy, info, bodies: entry.bodies });
      }
    }
    LANDMARKS.forEach((def, n) => {
      const gi = def.galaxy === null ? 0 : findGalaxy(def.galaxy);
      if (gi === null) return;
      const pos = def.distancePc !== undefined ? raDecToScene(def.ra, def.dec).multiplyScalar(def.distancePc) : this.galaxyPlanePoint(gi, def.ra, def.dec);
      let systemId: StarId | null = null;
      if (def.star) {
        systemId = `l${n}`;
        this.extraSystems.set(systemId, { id: systemId, name: def.name, positionPc: pos, galaxy: gi, info: landmarkStarInfo(def, pos), bodies: () => landmarkStarBodies(def) });
      }
      this.landmarks.push({ def, positionPc: pos, galaxy: gi, systemId });
    });
    this.current = this.system('c0');
  }

  /**
   * 3D position (pc) of a sky direction inside galaxy i: where the sightline from the Sun
   * crosses the galaxy's disc plane (falls back to the galaxy's distance for edge-on cases).
   */
  galaxyPlanePoint(i: number, ra: number, dec: number): Vector3 {
    const dir = raDecToScene(ra, dec);
    const c = this.galaxies.position(i);
    const n = new Vector3(this.galaxies.normal[i * 3], this.galaxies.normal[i * 3 + 1], this.galaxies.normal[i * 3 + 2]);
    const D = c.length();
    const denom = dir.dot(n);
    let t = Math.abs(denom) < 0.12 ? D : c.dot(n) / denom;
    t = Math.min(Math.max(t, D * 0.8), D * 1.2);
    return dir.multiplyScalar(t);
  }

  /** Hand-made (non-catalogue) system by id, if any */
  extraSystem(id: StarId): ExtraSystem | undefined {
    return this.extraSystems.get(id);
  }

  /** Landmark by id */
  landmark(id: string): Landmark | undefined {
    return this.landmarks.find((l) => l.def.id === id);
  }

  /** Landmarks whose name/summary matches */
  searchLandmarks(query: string, limit = 5): number[] {
    const q = query.toLowerCase();
    const out: number[] = [];
    for (let i = 0; i < this.landmarks.length && out.length < limit; i++) {
      const d = this.landmarks[i].def;
      if (d.name.toLowerCase().includes(q) || d.summary.toLowerCase().includes(q)) out.push(i);
    }
    return out;
  }

  /** Direction & distance (km) from a local position to landmark i */
  landmarkRelative(i: number, localKm: Vector3, out = new Vector3()): Vector3 {
    out.copy(this.landmarks[i].positionPc).multiplyScalar(PARSEC_KM);
    return out.sub(this.current.origin).sub(localKm);
  }

  /** Black hole by universal id (`b0`, `cygx1`, …) */
  blackHole(id: string): BlackHole | undefined {
    return this.blackHoles.find((b) => b.entry.id === id);
  }

  /** Black holes whose name matches the query */
  searchBlackHoles(query: string, limit = 4): BlackHole[] {
    const q = query.toLowerCase();
    return this.blackHoles.filter((b) => b.entry.name.toLowerCase().includes(q) || b.entry.summary.toLowerCase().includes(q)).slice(0, limit);
  }

  /** Physical description of any star */
  starInfo(id: StarId): StarInfo {
    const ex = this.extraSystems.get(id);
    if (ex) return ex.info;
    const ci = catalogIndexOf(id);
    return ci >= 0 ? this.catalog.info(ci) : this.procStars.info(id);
  }

  starName(id: StarId): string {
    const ex = this.extraSystems.get(id);
    if (ex) return ex.name;
    const ci = catalogIndexOf(id);
    return ci >= 0 ? this.catalog.nameOf(ci) : this.procStars.info(id).name;
  }

  /** Star position in parsecs (scene frame, relative to the Sun) */
  starPositionPc(id: StarId, out = new Vector3()): Vector3 {
    const ex = this.extraSystems.get(id);
    if (ex) return out.copy(ex.positionPc);
    const ci = catalogIndexOf(id);
    return ci >= 0 ? this.catalog.position(ci, out) : this.procStars.positionPc(id, out);
  }

  /** Galaxy a star belongs to */
  galaxyOfStar(id: StarId): number {
    const ex = this.extraSystems.get(id);
    if (ex) return ex.galaxy;
    return catalogIndexOf(id) >= 0 ? 0 : this.procStars.galaxyOf(id);
  }

  /** Instantiate (or fetch from cache) a star's system. */
  system(id: StarId): StarSystem {
    const cached = this.cache.get(id);
    if (cached) return cached;
    let sys: StarSystem;
    const ci = catalogIndexOf(id);
    const ex = this.extraSystems.get(id);
    if (ex) {
      const origin = ex.positionPc.clone().multiplyScalar(PARSEC_KM);
      sys = new StarSystem(`x-${id}`, id, -1, origin, ex.bodies(), [], []);
    } else if (ci === 0) {
      sys = new StarSystem('sol', 'c0', 0, new Vector3(), SOLAR_SYSTEM, SOLAR_BELTS, PLANET_HOTKEYS);
    } else {
      const info = this.starInfo(id);
      const gen = generateSystem(info);
      const origin = info.position.clone().multiplyScalar(PARSEC_KM);
      // black holes orbiting catalogue stars (X-ray binaries)
      for (const b of this.blackHoles) {
        if (b.systemStarId !== id || !b.entry.companionBody) continue;
        const host = b.entry.host;
        if (host.kind === 'catalog' && host.hostName) {
          // the HYG proper name is the X-ray source; the star itself has its own designation
          const old = gen.bodies[0].name;
          for (const body of gen.bodies) body.name = body.name.replace(old, host.hostName);
        }
        gen.bodies.push(b.entry.companionBody(gen.bodies[0].id, info.massKg));
      }
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
    for (const ex of this.extraSystems.values()) {
      const d = ex.positionPc.distanceTo(p);
      if (d < best.distPc) best = { id: ex.id, distPc: d };
    }
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
