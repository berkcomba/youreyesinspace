import { Vector3 } from 'three';
import { AU_KM, C_KM_S, DAY_S } from '../core/constants';
import { fmtDuration, fmtLightYears } from '../ui/format';
import type { CelestialBody } from '../core/CelestialBody';
import { StarSystem } from '../core/StarSystem';
import type { ShipDef } from '../data/ships';
import { escapeDv, flybyPeriapsis, hohmannTime, lambert, propagate } from './lambert';

/* ------------------------------------------------------------------------------------------ */
/* Ephemeris                                                                                   */
/* ------------------------------------------------------------------------------------------ */

/**
 * Scratch copy of a star system used to evaluate body states at arbitrary dates without
 * disturbing the live simulation. Velocities come from a central difference.
 */
export class Ephemeris {
  readonly system: StarSystem;
  private readonly chains = new Map<string, CelestialBody[]>();

  constructor(live: StarSystem) {
    const data = live.bodies.filter((b) => b.data.orbit?.kind !== 'trajectory').map((b) => b.data);
    this.system = new StarSystem(live.id, live.starId, live.catalogIndex, live.origin, data, [], []);
  }

  body(id: string): CelestialBody | undefined {
    return this.system.get(id);
  }

  private chain(id: string): CelestialBody[] {
    let c = this.chains.get(id);
    if (!c) {
      c = [];
      let b = this.system.get(id);
      while (b) { c.unshift(b); b = b.parent ?? undefined; }
      this.chains.set(id, c);
    }
    return c;
  }

  /** Position (km, system frame) of a body at jd */
  position(id: string, jd: number, out = new Vector3()): Vector3 {
    const chain = this.chain(id);
    for (const b of chain) {
      if (b.parent && !b.parent.data.pole) b.updateOrbitBasis();
      b.update(jd, 0);
    }
    return out.copy(chain[chain.length - 1].position);
  }

  /** Position and velocity (km, km/s) of a body at jd, relative to `centerId` (default: system origin) */
  state(id: string, jd: number, outR: Vector3, outV: Vector3, centerId: string | null = null): void {
    const h = 30 / DAY_S; // 30 s
    this.position(id, jd - h, _e1);
    this.position(id, jd + h, _e2);
    outV.copy(_e2).sub(_e1).multiplyScalar(1 / 60);
    this.position(id, jd, outR);
    if (centerId) {
      this.position(centerId, jd - h, _e1);
      this.position(centerId, jd + h, _e2);
      _e2.sub(_e1).multiplyScalar(1 / 60);
      outV.sub(_e2);
      this.position(centerId, jd, _e1);
      outR.sub(_e1);
    }
  }
}

const _e1 = new Vector3(), _e2 = new Vector3();

/* ------------------------------------------------------------------------------------------ */
/* Requests & plans                                                                            */
/* ------------------------------------------------------------------------------------------ */

export type FarTarget =
  | { kind: 'star'; id: string; name: string; positionKm: Vector3; starBodyId: string; orbitRadiusKm: number; starMassKg: number }
  | { kind: 'point'; name: string; positionKm: Vector3 };

export interface MissionRequest {
  /** body id in the current system */
  originId: string;
  /** body id in the current system (ignored when `far` is set) */
  targetId: string | null;
  /** interstellar / intergalactic destination (FTL ships only); positions in km relative to the Sun */
  far: FarTarget | null;
  ship: ShipDef;
  departureJd: number;
  /** search departures within this many days after `departureJd` (0 = fixed) */
  windowDays: number;
  /** gravity-assist body id (impulsive ships) */
  flybyId: string | null;
  arrival: 'orbit' | 'flyby';
  /** 'dv' = least Δv, 'time' = fastest within the budget */
  optimize: 'dv' | 'time';
  /** index into the ship's warp-factor list (warp ships); -1 = impulse */
  warpIndex: number;
  /** use hyperspace (hyperdrive ships) */
  hyperspace: boolean;
  /** continuous acceleration (g) for brachistochrone ships */
  accelG: number;
}

export type Phase =
  | { kind: 'docked'; t0: number; t1: number; system: string; bodyId: string }
  | { kind: 'conic'; t0: number; t1: number; system: string; centerId: string; r0: Vector3; v0: Vector3; mu: number }
  | { kind: 'line'; t0: number; t1: number; p0: Vector3; p1: Vector3; accel: number; vMax: number }
  | { kind: 'orbit'; t0: number; t1: number; system: string; bodyId: string; radius: number; e1: Vector3; e2: Vector3; omega: number }
  | { kind: 'rest'; t0: number; t1: number; p: Vector3 };

export interface FlybyInfo {
  bodyId: string;
  bodyName: string;
  jd: number;
  altitudeKm: number;
  turnDeg: number;
  vInf: number;
  dv: number;
}

export interface MissionPlan {
  ok: boolean;
  error?: string;
  request: MissionRequest;
  ship: ShipDef;
  originName: string;
  targetName: string;
  departureJd: number;
  arrivalJd: number;
  /** total trip time (s) */
  durationS: number;
  /** path length (km) */
  distanceKm: number;
  /** peak speed along the trip relative to the frame centre (km/s) */
  maxSpeedKms: number;
  dvLaunch: number;
  dvFlyby: number;
  dvArrival: number;
  dvTotal: number;
  /** Δv budget (NaN when not applicable) */
  budget: number;
  feasible: boolean;
  vInfDep: number;
  vInfArr: number;
  flyby: FlybyInfo | null;
  phases: Phase[];
  notes: string[];
  /** universe-frame origin (km) of the system the in-system phases are expressed in */
  frameOrigin: Vector3;
}

const G_KMS2 = 9.80665e-3;
const PARK_ALT_KM = 300;
const NORTH = new Vector3(0, 1, 0); // ecliptic north (scene frame)

const _r1 = new Vector3(), _v1 = new Vector3(), _r2 = new Vector3(), _v2 = new Vector3(), _rf = new Vector3(), _vf = new Vector3();
const _t = new Vector3(), _t2 = new Vector3();

function fail(req: MissionRequest, error: string): MissionPlan {
  return {
    ok: false, error, request: req, ship: req.ship, originName: '', targetName: '', departureJd: req.departureJd, arrivalJd: req.departureJd,
    durationS: 0, distanceKm: 0, maxSpeedKms: 0, dvLaunch: 0, dvFlyby: 0, dvArrival: 0, dvTotal: 0, budget: NaN, feasible: false,
    vInfDep: 0, vInfArr: 0, flyby: null, phases: [], notes: [], frameOrigin: new Vector3(),
  };
}

/** apoapsis of the (elliptical) capture orbit around T with periapsis rp */
function captureApoapsis(T: CelestialBody, rp: number): number {
  const soi = T.soiRadius;
  return Math.max(rp * 1.05, Math.min(rp * 30, Number.isFinite(soi) ? soi * 0.5 : rp * 30));
}

/** Δv to brake from periapsis speed `vPeriHyp` into the rp × ra ellipse */
function ellipseCaptureDv(mu: number, rp: number, ra: number, vPeriHyp: number): number {
  const vPeriEll = Math.sqrt(mu * (2 / rp - 2 / (rp + ra)));
  return Math.max(0, vPeriHyp - vPeriEll);
}

/** altitude for a capture / standard orbit around a body */
export function captureAltitude(b: CelestialBody): number {
  if (b.data.appearance.kind === 'gas') return Math.max(b.radius * 0.5, 2000);
  if (b.data.atmosphere) return Math.max(300, b.radius * 0.05);
  return Math.max(50, b.radius * 0.08);
}

/** child-of-`center` ancestor of b (or b itself) */
function topUnder(b: CelestialBody, center: CelestialBody): CelestialBody {
  let x = b;
  while (x.parent && x.parent !== center) x = x.parent;
  return x;
}

function lca(a: CelestialBody, b: CelestialBody): CelestialBody {
  const anc = new Set<CelestialBody>();
  for (let x: CelestialBody | null = a; x; x = x.parent) anc.add(x);
  for (let x: CelestialBody | null = b; x; x = x.parent) if (anc.has(x)) return x;
  return a.root;
}

function periodAround(mu: number, r: number): number {
  return 2 * Math.PI * Math.sqrt((r * r * r) / mu);
}

/** basis vectors (e1, e2) of a circular orbit around `body` whose plane contains `dir` */
function orbitBasis(body: CelestialBody, dir: Vector3): { e1: Vector3; e2: Vector3 } {
  const n = new Vector3().copy(body.pole);
  const e1 = new Vector3().copy(dir).addScaledVector(n, -dir.dot(n));
  if (e1.lengthSq() < 1e-12) e1.set(1, 0, 0).addScaledVector(n, -n.x);
  e1.normalize();
  const e2 = new Vector3().crossVectors(n, e1).normalize();
  return { e1, e2 };
}

/* ------------------------------------------------------------------------------------------ */
/* Impulsive (Lambert / patched conic) planning                                               */
/* ------------------------------------------------------------------------------------------ */

interface Candidate {
  t0: number; tf: number | null; t1: number;
  dvLaunch: number; dvFlyby: number; dvArrival: number;
  vInfDep: number; vInfArr: number;
  v1: Vector3; v2: Vector3; vfOut: Vector3 | null;
  flyby: FlybyInfo | null;
  maxSpeed: number;
}

export function planMission(req: MissionRequest, live: StarSystem, eph: Ephemeris): MissionPlan {
  const p = req.ship.propulsion;
  if (p.kind === 'impulsive') return planImpulsive(req, live, eph);
  return planLine(req, live, eph);
}

function planImpulsive(req: MissionRequest, live: StarSystem, eph: Ephemeris): MissionPlan {
  if (req.far) return fail(req, `${req.ship.name} ışıktan hızlı değil: Güneş Sistemi dışına bu araçla gidilemez.`);
  if (!req.targetId) return fail(req, 'Hedef seçilmedi.');
  const O = eph.body(req.originId), T = eph.body(req.targetId);
  if (!O || !T) return fail(req, 'Kalkış veya hedef gövdesi bulunamadı.');
  if (O === T) return fail(req, 'Kalkış ve hedef aynı.');
  if (T.data.type === 'star' || T.data.type === 'blackhole' || T.data.type === 'pulsar') return fail(req, 'Yıldızın kendisine yörünge hesaplanamıyor; bir gezegen ya da uydu seçin.');
  const budget = req.ship.propulsion.kind === 'impulsive' ? req.ship.propulsion.dvBudget : NaN;
  const C = lca(O, T);
  const mu = C.gm;
  const notes: string[] = [];
  const system = live.starId;
  const frameOrigin = live.origin.clone();

  const parkR = O.radius + (O.gm > 1 ? PARK_ALT_KM : 0);
  const capR = T.radius + captureAltitude(T);
  const capRa = captureApoapsis(T, capR);
  const launchDv = (vInf: number) => (O.gm > 1 ? escapeDv(O.gm, parkR, vInf) : vInf);
  const arriveDv = (vInf: number) => (req.arrival === 'orbit' && T.gm > 1
    ? ellipseCaptureDv(T.gm, capR, capRa, Math.sqrt(vInf * vInf + (2 * T.gm) / capR))
    : 0);
  if (req.arrival === 'orbit' && T.gm > 1) notes.push(`Varış: ${T.name} çevresinde ${Math.round(capR - T.radius).toLocaleString('tr-TR')} km × ${Math.round(capRa - T.radius).toLocaleString('tr-TR')} km eliptik yakalama yörüngesi.`);

  /* ---- case A: origin is the centre (Earth → Moon): Hohmann from the parking orbit ---- */
  if (O === C || T === C) {
    const down = T === C; // Moon → Earth
    const other = down ? topUnder(O, C) : topUnder(T, C);
    const centre = C;
    const t0 = req.departureJd;
    // radius of the other body's orbit (use its distance at departure as the circular radius)
    eph.state(other.id, t0, _r1, _v1, centre.id);
    const rOther = _r1.length();
    const rIn = down ? centre.radius + captureAltitude(centre) : parkR; // the "deep" end of the transfer
    const tof = hohmannTime(rIn, rOther, centre.gm);
    const t1 = t0 + tof / DAY_S;
    const aT = 0.5 * (rIn + rOther);
    const vDeep = Math.sqrt(centre.gm * (2 / rIn - 1 / aT));   // speed at the deep end
    const vHigh = Math.sqrt(centre.gm * (2 / rOther - 1 / aT)); // speed at the high end
    const vCircHigh = Math.sqrt(centre.gm / rOther);
    const vCircDeep = Math.sqrt(centre.gm / rIn);
    let dvLaunch: number, dvArrival: number, vInfDep: number, vInfArr: number;
    let r0: Vector3, v0: Vector3;
    if (!down) {
      // leave from the parking orbit of the centre body, arrive at `other`
      eph.state(other.id, t1, _r2, _v2, centre.id);
      const dir = _r2.clone().normalize();
      const n = other.orbitNormal.clone();
      r0 = dir.clone().multiplyScalar(-rIn);
      v0 = new Vector3().crossVectors(n, r0).normalize().multiplyScalar(vDeep);
      dvLaunch = vDeep - vCircDeep;
      vInfDep = 0;
      vInfArr = Math.abs(vCircHigh - vHigh);
      dvArrival = arriveDv(vInfArr);
      notes.push(`${centre.name} park yörüngesinden (${PARK_ALT_KM} km) Hohmann transferi.`);
    } else {
      // leave from `other` (where the ship is parked), fall to the centre
      eph.state(other.id, t0, _r1, _v1, centre.id);
      r0 = _r1.clone();
      const n = other.orbitNormal.clone();
      v0 = new Vector3().crossVectors(n, r0).normalize().multiplyScalar(vHigh);
      vInfDep = Math.abs(vCircHigh - vHigh);
      dvLaunch = launchDv(vInfDep);
      vInfArr = 0;
      dvArrival = req.arrival === 'orbit' ? ellipseCaptureDv(centre.gm, rIn, captureApoapsis(centre, rIn), vDeep) : 0;
      notes.push(`${other.name} çevresinden ${centre.name}'a Hohmann inişi.`);
    }
    const phases: Phase[] = [
      { kind: 'docked', t0: -Infinity, t1: t0, system, bodyId: O.id },
      { kind: 'conic', t0, t1, system, centerId: centre.id, r0, v0, mu: centre.gm },
    ];
    appendArrival(phases, req, T, t1, v0, system);
    const dvTotal = dvLaunch + dvArrival;
    return {
      ok: true, request: req, ship: req.ship, originName: O.name, targetName: T.name, departureJd: t0, arrivalJd: t1,
      durationS: tof, distanceKm: Math.PI * aT, maxSpeedKms: Math.max(vDeep, vHigh), dvLaunch, dvFlyby: 0, dvArrival, dvTotal, budget,
      feasible: !(dvTotal > budget), vInfDep, vInfArr, flyby: null, phases, notes, frameOrigin,
    };
  }

  /* ---- case B: siblings around a common centre (planet → planet, moon → moon) ---- */
  const O1 = topUnder(O, C), T1 = topUnder(T, C);
  if (O1 !== O) notes.push(`Kalkış ${O.name} çevresinden; ${O1.name}'in Güneş çevresi hızı temel alındı.`);
  if (T1 !== T) notes.push(`Transfer ${T1.name}'e hesaplandı; ${T.name} yörüngesine giriş ${T1.name} etki küresinde varsayıldı.`);
  let F: CelestialBody | null = null;
  if (req.flybyId) {
    F = eph.body(req.flybyId) ?? null;
    if (!F || F.parent !== C) { notes.push('Sapan gövdesi aynı merkez etrafında değil; yok sayıldı.'); F = null; }
    else if (F === O1 || F === T1) { notes.push('Sapan gövdesi kalkış/hedefle aynı; yok sayıldı.'); F = null; }
  }

  const t0s: number[] = [];
  const nDep = req.windowDays > 0 ? Math.min(60, Math.max(8, Math.round(req.windowDays / 6))) : 1;
  for (let i = 0; i < nDep; i++) t0s.push(req.departureJd + (nDep === 1 ? 0 : (req.windowDays * i) / (nDep - 1)));

  let best: Candidate | null = null;
  let bestFast: Candidate | null = null;
  const consider = (c: Candidate) => {
    const total = c.dvLaunch + c.dvFlyby + c.dvArrival;
    if (!Number.isFinite(total)) return;
    if (!best || total < best.dvLaunch + best.dvFlyby + best.dvArrival) best = c;
    if (total <= budget && (!bestFast || c.t1 - c.t0 < bestFast.t1 - bestFast.t0)) bestFast = c;
  };

  const nTof = F ? (nDep > 1 ? 28 : 44) : (nDep > 1 ? 56 : 96);
  for (const t0 of t0s) {
    eph.state(O1.id, t0, _r1, _v1, C.id);
    const r1 = _r1.clone(), vO = _v1.clone();
    if (!F) {
      eph.state(T1.id, t0, _r2, _v2, C.id);
      const Th = hohmannTime(r1.length(), _r2.length(), mu);
      for (let k = 0; k < nTof; k++) {
        const tof = Th * 0.25 * Math.pow(3.2 / 0.25, k / (nTof - 1));
        const t1 = t0 + tof / DAY_S;
        eph.state(T1.id, t1, _r2, _v2, C.id);
        const sol = lambert(r1, _r2, tof, mu, NORTH);
        if (!sol) continue;
        const vInfDep = _t.copy(sol.v1).sub(vO).length();
        const vInfArr = _t.copy(sol.v2).sub(_v2).length();
        consider({
          t0, tf: null, t1, dvLaunch: launchDv(vInfDep), dvFlyby: 0, dvArrival: arriveDv(vInfArr), vInfDep, vInfArr,
          v1: sol.v1, v2: sol.v2, vfOut: null, flyby: null, maxSpeed: Math.max(sol.v1.length(), sol.v2.length()),
        });
      }
    } else {
      eph.state(F.id, t0, _rf, _vf, C.id);
      eph.state(T1.id, t0, _r2, _v2, C.id);
      const Th1 = hohmannTime(r1.length(), _rf.length(), mu);
      const Th2 = hohmannTime(_rf.length(), _r2.length(), mu);
      const rpMin = F.radius * 1.08 + 200;
      for (let i = 0; i < nTof; i++) {
        const tof1 = Th1 * 0.3 * Math.pow(3.0 / 0.3, i / (nTof - 1));
        const tf = t0 + tof1 / DAY_S;
        eph.state(F.id, tf, _rf, _vf, C.id);
        const rF = _rf.clone(), vF = _vf.clone();
        const leg1 = lambert(r1, rF, tof1, mu, NORTH);
        if (!leg1) continue;
        const vInfIn = new Vector3().copy(leg1.v2).sub(vF);
        const vInfDep = _t.copy(leg1.v1).sub(vO).length();
        const dvLaunch = launchDv(vInfDep);
        if (dvLaunch > budget * 1.6 + 2) continue; // hopeless launch, skip the inner loop
        for (let j = 0; j < nTof; j++) {
          const tof2 = Th2 * 0.3 * Math.pow(3.0 / 0.3, j / (nTof - 1));
          const t1 = tf + tof2 / DAY_S;
          eph.state(T1.id, t1, _r2, _v2, C.id);
          const leg2 = lambert(rF, _r2, tof2, mu, NORTH);
          if (!leg2) continue;
          const vInfOut = _t2.copy(leg2.v1).sub(vF);
          const vin = vInfIn.length(), vout = vInfOut.length();
          const cosD = Math.min(1, Math.max(-1, vInfIn.dot(vInfOut) / (vin * vout)));
          const delta = Math.acos(cosD);
          const rp = flybyPeriapsis(F.gm, Math.min(vin, vout), delta);
          if (rp < rpMin) continue; // would have to fly through the planet
          const rpUse = Math.min(rp, F.radius * 60);
          const dvFlyby = Math.abs(Math.sqrt(vout * vout + (2 * F.gm) / rpUse) - Math.sqrt(vin * vin + (2 * F.gm) / rpUse));
          const vInfArr = _t.copy(leg2.v2).sub(_v2).length();
          consider({
            t0, tf, t1, dvLaunch, dvFlyby, dvArrival: arriveDv(vInfArr), vInfDep, vInfArr,
            v1: leg1.v1, v2: leg2.v2, vfOut: leg2.v1.clone(),
            flyby: { bodyId: F.id, bodyName: F.name, jd: tf, altitudeKm: rpUse - F.radius, turnDeg: (delta * 180) / Math.PI, vInf: vin, dv: dvFlyby },
            maxSpeed: Math.max(leg1.v1.length(), leg1.v2.length(), leg2.v1.length(), leg2.v2.length()),
          });
        }
      }
    }
  }

  const pick: Candidate | null = req.optimize === 'time' && bestFast ? bestFast : best;
  if (!pick) return fail(req, 'Bu geometri için çözüm bulunamadı (sapan açısı yetersiz ya da transfer tanımsız). Başka bir tarih ya da sapan gövdesi deneyin.');
  if (req.optimize === 'time' && !bestFast) notes.push('Bütçe içinde çözüm yok; en düşük Δv\'li rota gösteriliyor.');

  // Build the phases from the chosen candidate (recompute the exact states)
  const c = pick as Candidate;
  const phases: Phase[] = [{ kind: 'docked', t0: -Infinity, t1: c.t0, system, bodyId: O.id }];
  eph.state(O1.id, c.t0, _r1, _v1, C.id);
  // leave along the departure asymptote from just outside the origin body (cosmetic; the arrival
  // error this introduces is negligible against the transfer length)
  _t.copy(c.v1).sub(_v1).normalize();
  _r1.addScaledVector(_t, O.radius * 2.5);
  let dist = 0;
  if (c.tf !== null && c.flyby && c.vfOut) {
    eph.state(c.flyby.bodyId, c.tf, _rf, _vf, C.id);
    phases.push({ kind: 'conic', t0: c.t0, t1: c.tf, system, centerId: C.id, r0: _r1.clone(), v0: c.v1.clone(), mu });
    // periapsis of the flyby hyperbola lies opposite to the deflection (v̂out − v̂in) direction
    const F2 = eph.body(c.flyby.bodyId)!;
    const vIn = new Vector3();
    propagate(_r1, c.v1, (c.tf - c.t0) * DAY_S, mu, _t2, vIn);
    vIn.sub(_vf).normalize();
    _t.copy(c.vfOut).sub(_vf).normalize().sub(vIn).normalize().negate();
    _rf.addScaledVector(_t, F2.radius + c.flyby.altitudeKm);
    phases.push({ kind: 'conic', t0: c.tf, t1: c.t1, system, centerId: C.id, r0: _rf.clone(), v0: c.vfOut.clone(), mu });
    dist = arcLength(_r1, c.v1, (c.tf - c.t0) * DAY_S, mu) + arcLength(_rf, c.vfOut, (c.t1 - c.tf) * DAY_S, mu);
  } else {
    phases.push({ kind: 'conic', t0: c.t0, t1: c.t1, system, centerId: C.id, r0: _r1.clone(), v0: c.v1.clone(), mu });
    dist = arcLength(_r1, c.v1, (c.t1 - c.t0) * DAY_S, mu);
  }
  appendArrival(phases, req, T, c.t1, c.v2, system);
  const dvTotal = c.dvLaunch + c.dvFlyby + c.dvArrival;
  if (req.ship.propulsion.kind === 'impulsive' && req.ship.propulsion.lowThrust) notes.push('İyon motoru: Δv anlık itki varsayımıyla hesaplandı; gerçek düşük itkili rota daha uzun sürer.');
  return {
    ok: true, request: req, ship: req.ship, originName: O.name, targetName: T.name, departureJd: c.t0, arrivalJd: c.t1,
    durationS: (c.t1 - c.t0) * DAY_S, distanceKm: dist, maxSpeedKms: c.maxSpeed, dvLaunch: c.dvLaunch, dvFlyby: c.dvFlyby,
    dvArrival: c.dvArrival, dvTotal, budget, feasible: !(dvTotal > budget), vInfDep: c.vInfDep, vInfArr: c.vInfArr,
    flyby: c.flyby, phases, notes, frameOrigin,
  };
}

/** numerical arc length of a conic over dt seconds */
function arcLength(r0: Vector3, v0: Vector3, dt: number, mu: number): number {
  const n = 64;
  let s = 0;
  const a = new Vector3().copy(r0), b = new Vector3(), v = new Vector3();
  for (let i = 1; i <= n; i++) {
    propagate(r0, v0, (dt * i) / n, mu, b, v);
    s += a.distanceTo(b);
    a.copy(b);
  }
  return s;
}

/** final phase after reaching the target: capture ellipse or continue on the arrival conic */
function appendArrival(phases: Phase[], req: MissionRequest, T: CelestialBody, t1: number, vArr: Vector3, system: string): void {
  if (req.arrival === 'orbit' && T.gm > 1e-3) {
    const rp = T.radius + captureAltitude(T);
    const ra = captureApoapsis(T, rp);
    const { e1, e2 } = orbitBasis(T, vArr.clone().normalize());
    const vp = Math.sqrt(T.gm * (2 / rp - 2 / (rp + ra)));
    // periapsis on the approach side, moving prograde around the body's pole
    phases.push({ kind: 'conic', t0: t1, t1: Infinity, system, centerId: T.id, r0: e1.clone().multiplyScalar(-rp), v0: e2.clone().multiplyScalar(-vp), mu: T.gm });
  } else if (req.arrival === 'orbit') {
    // no gravity to speak of: station-keep next to the body
    phases.push({ kind: 'docked', t0: t1, t1: Infinity, system, bodyId: T.id });
  } else {
    const last = phases[phases.length - 1];
    if (last.kind === 'conic') last.t1 = Infinity;
  }
}

/* ------------------------------------------------------------------------------------------ */
/* Straight-line profiles: warp / hyperspace / brachistochrone                                  */
/* ------------------------------------------------------------------------------------------ */

/** travel time (s) over distance d with acceleration a (km/s²; Infinity = constant speed) capped at vMax */
export function lineDuration(d: number, accel: number, vMax: number): number {
  if (!Number.isFinite(accel)) return d / vMax;
  const tAcc = vMax / accel;
  const dAcc = 0.5 * accel * tAcc * tAcc;
  if (2 * dAcc >= d) return 2 * Math.sqrt(d / accel);
  return 2 * tAcc + (d - 2 * dAcc) / vMax;
}

/** distance covered (km) and speed (km/s) at time τ (s) along such a profile */
export function lineProgress(tau: number, d: number, accel: number, vMax: number): { s: number; v: number } {
  const T = lineDuration(d, accel, vMax);
  if (tau <= 0) return { s: 0, v: 0 };
  if (tau >= T) return { s: d, v: 0 };
  if (!Number.isFinite(accel)) return { s: vMax * tau, v: vMax };
  const tAcc = Math.min(vMax / accel, T / 2);
  const dAcc = 0.5 * accel * tAcc * tAcc;
  if (tau < tAcc) return { s: 0.5 * accel * tau * tau, v: accel * tau };
  if (tau > T - tAcc) { const r = T - tau; return { s: d - 0.5 * accel * r * r, v: accel * r }; }
  return { s: dAcc + (tau - tAcc) * (accel * tAcc), v: accel * tAcc };
}

function planLine(req: MissionRequest, live: StarSystem, eph: Ephemeris): MissionPlan {
  const O = eph.body(req.originId);
  if (!O) return fail(req, 'Kalkış gövdesi bulunamadı.');
  const p = req.ship.propulsion;
  const system = live.starId;
  const frameOrigin = live.origin.clone();
  const notes: string[] = [];
  let accel = Infinity, vMax = 0, modeLabel = '';
  if (p.kind === 'warp') {
    if (req.warpIndex >= 0 && req.warpIndex < p.warpFactors.length) { vMax = p.warpFactors[req.warpIndex].c * C_KM_S; modeLabel = p.warpFactors[req.warpIndex].label; }
    else { vMax = p.impulseC * C_KM_S; modeLabel = `Impulse (${p.impulseC} c)`; }
  } else if (p.kind === 'hyperdrive') {
    vMax = (req.hyperspace ? p.hyperC : p.sublightC) * C_KM_S;
    modeLabel = req.hyperspace ? p.hyperLabel : `Alt ışık (${p.sublightC} c)`;
  } else if (p.kind === 'brachistochrone') {
    accel = req.accelG * G_KMS2;
    vMax = p.maxC * C_KM_S;
    modeLabel = `${req.accelG} g sürekli ivme (flip-and-burn)`;
  } else {
    return fail(req, 'Bilinmeyen itki türü.');
  }
  if (!(vMax > 0)) return fail(req, 'Hız tanımsız.');

  const t0 = req.departureJd;
  const p0 = eph.position(O.id, t0).add(frameOrigin); // universe km
  p0.addScaledVector(O.pole, O.radius * 3); // depart from "standard orbit" above the pole

  const phases: Phase[] = [{ kind: 'docked', t0: -Infinity, t1: t0, system, bodyId: O.id }];
  let targetName = '';
  let p1: Vector3;
  let t1: number;
  let dur: number;

  if (req.far) {
    const far = req.far;
    targetName = far.name;
    p1 = far.positionKm.clone();
    if (far.kind === 'star') {
      // stop short of the star: on the "standard orbit" radius
      _t.copy(p0).sub(p1).normalize();
      p1.addScaledVector(_t, far.orbitRadiusKm);
    }
    const d = p0.distanceTo(p1);
    dur = lineDuration(d, accel, vMax);
    t1 = t0 + dur / DAY_S;
    if (p.kind === 'brachistochrone') notes.push('Yıldızlararası mesafede göreli etkiler ve yakıt yok sayıldı — bu araç gerçekte Güneş Sistemi içi içindir.');
    if (dur > 100 * 365.25 * DAY_S) notes.push('Yolculuk bir insan ömründen uzun.');
    phases.push({ kind: 'line', t0, t1, p0, p1, accel, vMax });
    if (far.kind === 'star') {
      const gmStar = (6.674e-11 * far.starMassKg) / 1e9;
      const e1 = new Vector3().copy(_t); // direction from the star toward where we came from
      const e2 = new Vector3().crossVectors(NORTH, e1);
      if (e2.lengthSq() < 1e-9) e2.set(1, 0, 0);
      e2.normalize();
      e1.crossVectors(e2, NORTH).normalize();
      // re-orient so that e1 points to the arrival point
      e1.copy(_t).addScaledVector(NORTH, -_t.dot(NORTH)).normalize();
      e2.crossVectors(NORTH, e1).normalize();
      phases.push({ kind: 'orbit', t0: t1, t1: Infinity, system: far.id, bodyId: far.starBodyId, radius: far.orbitRadiusKm, e1, e2, omega: (2 * Math.PI) / periodAround(gmStar, far.orbitRadiusKm) });
    } else {
      phases.push({ kind: 'rest', t0: t1, t1: Infinity, p: p1 });
    }
    const dvNote = modeLabel;
    notes.unshift(`${dvNote} · ${fmtLightYears(d)} · ışık bu yolu ${fmtDuration(d / C_KM_S)} sürede alır.`);
    return {
      ok: true, request: req, ship: req.ship, originName: O.name, targetName, departureJd: t0, arrivalJd: t1, durationS: dur,
      distanceKm: d, maxSpeedKms: Math.min(vMax, Number.isFinite(accel) ? Math.sqrt(accel * d) : vMax), dvLaunch: 0, dvFlyby: 0, dvArrival: 0, dvTotal: 0,
      budget: NaN, feasible: true, vInfDep: 0, vInfArr: 0, flyby: null, phases, notes, frameOrigin,
    };
  }

  if (!req.targetId) return fail(req, 'Hedef seçilmedi.');
  const T = eph.body(req.targetId);
  if (!T) return fail(req, 'Hedef gövdesi bulunamadı.');
  if (T === O) return fail(req, 'Kalkış ve hedef aynı.');
  targetName = T.name;
  const standoff = T.radius + captureAltitude(T);
  // the target moves: iterate the arrival time
  t1 = t0;
  p1 = new Vector3();
  dur = 0;
  for (let i = 0; i < 6; i++) {
    eph.position(T.id, t1, p1).add(frameOrigin);
    _t.copy(p0).sub(p1).normalize();
    p1.addScaledVector(_t, standoff);
    const d = p0.distanceTo(p1);
    dur = lineDuration(d, accel, vMax);
    t1 = t0 + dur / DAY_S;
  }
  const d = p0.distanceTo(p1);
  phases.push({ kind: 'line', t0, t1, p0, p1, accel, vMax });
  if (T.gm > 1e-3) {
    const { e1, e2 } = orbitBasis(T, _t.clone().negate());
    phases.push({ kind: 'orbit', t0: t1, t1: Infinity, system, bodyId: T.id, radius: standoff, e1, e2, omega: (2 * Math.PI) / periodAround(T.gm, standoff) });
  } else {
    phases.push({ kind: 'docked', t0: t1, t1: Infinity, system, bodyId: T.id });
  }
  const peak = Number.isFinite(accel) ? Math.min(vMax, Math.sqrt(accel * d)) : vMax;
  notes.unshift(`${modeLabel} · ${(d / AU_KM).toFixed(3)} AU · ışık bu yolu ${fmtDuration(d / C_KM_S)} sürede alır.`);
  if (peak > 0.1 * C_KM_S && p.kind === 'brachistochrone') notes.push('0,1 c üzeri: göreli etkiler yok sayıldı.');
  return {
    ok: true, request: req, ship: req.ship, originName: O.name, targetName, departureJd: t0, arrivalJd: t1, durationS: dur,
    distanceKm: d, maxSpeedKms: peak, dvLaunch: 0, dvFlyby: 0, dvArrival: 0, dvTotal: 0, budget: NaN, feasible: true,
    vInfDep: 0, vInfArr: 0, flyby: null, phases, notes, frameOrigin,
  };
}

/* ------------------------------------------------------------------------------------------ */
/* Runtime evaluation                                                                          */
/* ------------------------------------------------------------------------------------------ */

export interface FrameLookup {
  /** current system's universal star id */
  systemId: string;
  /** current system's origin (km, relative to the Sun) */
  origin: Vector3;
  body(id: string): CelestialBody | undefined;
}

export function phaseAt(phases: Phase[], jd: number): Phase {
  let cur = phases[0];
  for (const ph of phases) if (jd >= ph.t0) cur = ph; else break;
  return cur;
}

const _pr = new Vector3(), _pv = new Vector3();

/**
 * Position (km, current frame) and velocity (km/s) of the vehicle at jd.
 * Returns false when the phase lives in another star system.
 */
export function evaluatePhase(ph: Phase, jd: number, frame: FrameLookup, outPos: Vector3, outVel: Vector3): boolean {
  switch (ph.kind) {
    case 'docked': {
      if (ph.system !== frame.systemId) return false;
      const b = frame.body(ph.bodyId);
      if (!b) return false;
      outPos.copy(b.position).addScaledVector(b.pole, b.radius * 3);
      outVel.set(0, 0, 0);
      return true;
    }
    case 'conic': {
      if (ph.system !== frame.systemId) return false;
      const c = frame.body(ph.centerId);
      if (!c) return false;
      propagate(ph.r0, ph.v0, (jd - ph.t0) * DAY_S, ph.mu, _pr, _pv);
      outPos.copy(c.position).add(_pr);
      outVel.copy(_pv);
      return true;
    }
    case 'line': {
      const d = ph.p0.distanceTo(ph.p1);
      const { s, v } = lineProgress((jd - ph.t0) * DAY_S, d, ph.accel, ph.vMax);
      _pr.copy(ph.p1).sub(ph.p0).normalize();
      outPos.copy(ph.p0).addScaledVector(_pr, s).sub(frame.origin);
      outVel.copy(_pr).multiplyScalar(Math.max(v, 1e-6));
      return true;
    }
    case 'orbit': {
      if (ph.system !== frame.systemId) return false;
      const b = frame.body(ph.bodyId);
      if (!b) return false;
      const th = ph.omega * (jd - ph.t0) * DAY_S;
      const c = Math.cos(th), s = Math.sin(th);
      outPos.copy(b.position).addScaledVector(ph.e1, ph.radius * c).addScaledVector(ph.e2, ph.radius * s);
      const v = ph.omega * ph.radius;
      outVel.copy(ph.e1).multiplyScalar(-s * v).addScaledVector(ph.e2, c * v);
      return true;
    }
    case 'rest':
      outPos.copy(ph.p).sub(frame.origin);
      outVel.set(0, 0, 0);
      return true;
  }
}

/** human label of a phase */
export function phaseLabel(ph: Phase, plan: MissionPlan): string {
  switch (ph.kind) {
    case 'docked': return ph.t0 === -Infinity ? `Fırlatma bekleniyor (${plan.originName})` : `${plan.targetName} yanında`;
    case 'conic': {
      if (ph.t1 === Infinity && ph.centerId !== plan.request.originId && plan.request.arrival === 'orbit') return `${plan.targetName} yörüngesinde`;
      if (ph.t1 === Infinity) return `${plan.targetName} geçildi · hiperbolik yörünge`;
      return plan.flyby && ph.t0 === plan.flyby.jd ? `${plan.flyby.bodyName} sapanından sonra · seyir → ${plan.targetName}` : `Seyir → ${plan.targetName}`;
    }
    case 'line': return `Seyir → ${plan.targetName}`;
    case 'orbit': return `${plan.targetName} yörüngesinde`;
    case 'rest': return `${plan.targetName} — varıldı`;
  }
}
