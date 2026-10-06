import { Vector3 } from 'three';
import { evaluatePhase, phaseAt, type FrameLookup, type MissionPlan, type Phase } from '../astro/mission';
import type { BodyData } from '../data/types';
import type { CelestialBody } from './CelestialBody';
import type { StarSystem } from './StarSystem';
import type { Universe } from './Universe';

export interface ActiveMission {
  id: string;
  name: string;
  plan: MissionPlan;
  /** body in the current system, when representable there */
  body: CelestialBody | null;
  /** system the body was added to */
  bodySystem: StarSystem | null;
  /** phase the vehicle was in at the last update */
  phase: Phase | null;
  /** time rate requested at launch so the trip fits a minute (restored on arrival) */
  autoRate: boolean;
}

export interface MissionHooks {
  spawned(m: ActiveMission, body: CelestialBody): void;
  despawned(m: ActiveMission, body: CelestialBody): void;
  /** the followed vehicle entered a phase that lives in another system */
  frameSwitch(m: ActiveMission, systemId: string): void;
  arrived(m: ActiveMission): void;
}

const _p = new Vector3(), _v = new Vector3();

/**
 * Launched missions: keeps each vehicle's body in sync with the current reference frame
 * (spawning it when its phase is representable here, removing it otherwise) and hands the
 * camera over to the destination system when a followed ship arrives at another star.
 */
export class Missions {
  readonly list: ActiveMission[] = [];
  followed: ActiveMission | null = null;
  private seq = 0;
  readonly lookup: FrameLookup;

  constructor(private readonly universe: Universe, private readonly hooks: MissionHooks) {
    const u = universe;
    this.lookup = {
      get systemId() { return u.current.starId; },
      get origin() { return u.current.origin; },
      body: (id) => u.current.get(id),
    };
  }

  launch(plan: MissionPlan, jd: number, tSeconds: number): ActiveMission {
    this.seq++;
    const sameShip = this.list.filter((m) => m.plan.ship.id === plan.ship.id).length;
    const m: ActiveMission = {
      id: `mission-${this.seq}`,
      name: sameShip ? `${plan.ship.name} (${sameShip + 1})` : plan.ship.name,
      plan, body: null, bodySystem: null, phase: null, autoRate: false,
    };
    this.list.push(m);
    this.sync(m, jd, tSeconds);
    return m;
  }

  cancel(m: ActiveMission): void {
    const i = this.list.indexOf(m);
    if (i < 0) return;
    this.despawn(m);
    this.list.splice(i, 1);
    if (this.followed === m) this.followed = null;
  }

  byBody(b: CelestialBody): ActiveMission | undefined {
    return this.list.find((m) => m.body === b);
  }

  /** Called once per frame before the system is evaluated. */
  update(jd: number, tSeconds: number): void {
    for (const m of this.list) this.sync(m, jd, tSeconds);
  }

  private sync(m: ActiveMission, jd: number, tSeconds: number): void {
    const ph = phaseAt(m.plan.phases, jd);
    const prev = m.phase;
    m.phase = ph;
    // the frame changed under us: the body belongs to the previous system
    if (m.body && m.bodySystem !== this.universe.current) this.despawn(m);
    if ('system' in ph && ph.system !== this.universe.current.starId) {
      if (m.body) this.despawn(m);
      // the followed ship entered another system: hand the camera over
      if (!(this.followed === m && prev !== ph)) return;
      this.hooks.frameSwitch(m, ph.system);
      if (ph.system !== this.universe.current.starId) return;
    }
    if (!m.body) this.spawn(m, jd, tSeconds);
    if (prev && prev !== ph && (ph.kind === 'orbit' || ph.kind === 'rest' || (ph.kind === 'docked' && ph.t0 !== -Infinity) || (ph.kind === 'conic' && ph.t1 === Infinity && prev.kind === 'conic'))) {
      this.hooks.arrived(m);
    }
  }

  private spawn(m: ActiveMission, jd: number, tSeconds: number): void {
    const sys = this.universe.current;
    const ship = m.plan.ship;
    const plan = m.plan;
    const evaluate = (t: number, outPos: { x: number; y: number; z: number }, outVel: { x: number; y: number; z: number }): boolean => {
      const ok = evaluatePhase(phaseAt(plan.phases, t), t, this.lookup, _p, _v);
      if (ok) {
        (outPos as Vector3).copy(_p);
        (outVel as Vector3).copy(_v);
      }
      return ok;
    };
    const facts: Record<string, string> = { 'Görev': `${plan.originName} → ${plan.targetName}`, ...ship.facts };
    const data: BodyData = {
      id: m.id, name: m.name, type: 'spacecraft', parent: sys.star.id,
      radius: ship.radiusKm, mass: ship.massKg, albedo: 0.4,
      orbit: { kind: 'trajectory', evaluate },
      appearance: ship.model.kind === 'glb'
        ? { kind: 'spacecraft', model: `/models/${ship.model.file}.glb`, seed: 500 + this.seq, representative: ship.model.representative }
        : { kind: 'spacecraft', model: '', seed: 500 + this.seq, procedural: ship.model.shape, glow: ship.franchise === 'Star Wars' ? [0.95, 0.55, 0.9] : ship.franchise === 'The Expanse' ? [0.6, 0.85, 1] : [0.35, 0.7, 1] },
      description: ship.description,
      facts,
    };
    const b = sys.addBody(data);
    b.update(jd, tSeconds);
    m.body = b;
    m.bodySystem = sys;
    this.hooks.spawned(m, b);
  }

  private despawn(m: ActiveMission): void {
    if (!m.body) return;
    const b = m.body;
    m.bodySystem?.removeBody(b.id);
    m.body = null;
    m.bodySystem = null;
    this.hooks.despawned(m, b);
  }

  /** Remaining time to the planned arrival (s), negative once arrived. */
  static eta(m: ActiveMission, jd: number): number {
    return (m.plan.arrivalJd - jd) * 86400;
  }
}
