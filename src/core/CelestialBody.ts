import { Matrix3, Matrix4, Quaternion, Vector3 } from 'three';
import { _, fixed } from '../i18n';
import type { BodyData } from '../data/types';
import { basisFromPole, poleToScene } from '../math/frames';
import {
  isKeplerian, mathToScene, periodDays, positionFromE, resolveElements, solveKepler, visViva,
  type ResolvedElements,
} from '../math/kepler';
import { DAY_S, DEG, G } from './constants';

const _identity3 = new Matrix3();

const _math = new Vector3();
const _tmp = new Vector3();
const _tmp2 = new Vector3();
const _m4 = new Matrix4();
const _qSpin = new Quaternion();
const _yAxis = new Vector3(0, 1, 0);

/**
 * A celestial body: a node of the hierarchical universe graph.
 * Positions are absolute (scene frame, km, double precision JS numbers).
 */
export class CelestialBody {
  readonly data: BodyData;
  readonly id: string;
  parent: CelestialBody | null = null;
  children: CelestialBody[] = [];
  depth = 0;

  /** Absolute position, scene frame, km */
  readonly position = new Vector3();
  /** Position relative to parent, scene frame, km */
  readonly localPosition = new Vector3();
  /** Orbital speed relative to parent (km/s) */
  orbitalSpeed = 0;
  /** Orbit reference basis (math → scene) */
  readonly orbitBasis = new Matrix3();
  /** Orbit plane normal in scene frame */
  readonly orbitNormal = new Vector3(0, 1, 0);
  /** North pole, scene frame */
  readonly pole = new Vector3(0, 1, 0);
  /** Basis with local Y = pole (no spin) */
  readonly poleBasis = new Matrix3();
  /** Full orientation (pole + spin) */
  readonly rotation = new Quaternion();
  /** Spin angle about pole (rad) */
  spinAngle = 0;
  /** Current resolved orbital elements */
  resolved: ResolvedElements | null = null;
  /** Current eccentric anomaly */
  E = 0;
  /** Orbital period (days) */
  periodDays = 0;
  /** Gravitational parameter km^3/s^2 */
  readonly gm: number;
  /** Distance from the system's root star (km) */
  distanceToStar = 0;
  /** Sidereal rotation period in seconds (signed); 0 if synchronous */
  rotationPeriodS = 0;

  constructor(data: BodyData) {
    this.data = data;
    this.id = data.id;
    this.gm = (G * data.mass) / 1e9;
    if (typeof data.rotationPeriod === 'number') this.rotationPeriodS = data.rotationPeriod * 3600;
    if (data.pole) poleToScene(data.pole, this.pole);
    basisFromPole(this.pole, this.poleBasis);
  }

  get name(): string {
    return _(this.data.name);
  }

  get radius(): number {
    return this.data.radius;
  }

  get equatorialRadius(): number {
    const f = this.data.flattening ?? 0;
    // mean radius ≈ (2Re + Rp)/3 → Re = 3R / (3 - f)
    return (3 * this.data.radius) / (3 - f);
  }

  get polarRadius(): number {
    return this.equatorialRadius * (1 - (this.data.flattening ?? 0));
  }

  /** Root of hierarchy (the star) */
  get root(): CelestialBody {
    let b: CelestialBody = this;
    while (b.parent) b = b.parent;
    return b;
  }

  /** Update orbit basis using parent's pole (called once parent is resolved). */
  updateOrbitBasis(): void {
    const o = this.data.orbit;
    if (!o || !this.parent) {
      this.orbitBasis.identity();
      return;
    }
    if (o.kind !== 'simple' || o.frame === 'ecliptic') {
      this.orbitBasis.identity();
    } else {
      basisFromPole(this.parent.pole, this.orbitBasis);
    }
  }

  /** Non-Keplerian placements (spacecraft): linear trajectory, surface fix, Lagrange point. */
  private updateSpecial(jd: number): void {
    const o = this.data.orbit!;
    const p = this.parent!;
    this.resolved = null;
    this.periodDays = 0;
    if (o.kind === 'linear') {
      const dt = (jd - o.epoch) * DAY_S;
      _math.set(o.pos[0] + o.vel[0] * dt, o.pos[1] + o.vel[1] * dt, o.pos[2] + o.vel[2] * dt);
      mathToScene(_math, _identity3, this.localPosition);
      this.orbitalSpeed = Math.hypot(o.vel[0], o.vel[1], o.vel[2]);
      _math.set(o.vel[0], o.vel[1], o.vel[2]);
      mathToScene(_math, _identity3, _tmp);
      // point the model along its velocity
      this.rotation.setFromUnitVectors(_yAxis, _tmp.normalize());
    } else if (o.kind === 'surface') {
      const lat = o.lat * DEG, lon = o.lon * DEG;
      // body-fixed frame of the parent: +Y pole, +X prime meridian, east longitude = rotation about +Y
      _tmp.set(Math.cos(lat) * Math.cos(lon), Math.sin(lat), -Math.cos(lat) * Math.sin(lon));
      _tmp.applyQuaternion(p.rotation);
      this.localPosition.copy(_tmp).multiplyScalar(p.radius + (o.alt ?? 0));
      this.orbitalSpeed = (2 * Math.PI * p.radius * Math.cos(lat)) / Math.max(p.rotationSecondsAbs, 1);
      this.rotation.setFromUnitVectors(_yAxis, _tmp.normalize());
    } else if (o.kind === 'lagrange') {
      const gp = p.parent;
      if (gp) _tmp.copy(p.position).sub(gp.position).normalize();
      else _tmp.set(1, 0, 0);
      if (o.point === 'L1') _tmp.negate();
      this.localPosition.copy(_tmp).multiplyScalar(o.distance);
      this.orbitalSpeed = p.orbitalSpeed * ((p.localPosition.length() + (o.point === 'L2' ? o.distance : -o.distance)) / Math.max(p.localPosition.length(), 1));
      this.rotation.setFromUnitVectors(_yAxis, _tmp.negate().normalize());
    } else if (o.kind === 'trajectory') {
      // mission vehicle: absolute position & velocity from the planner's evaluator
      if (!o.evaluate(jd, this.position, _tmp)) { this.position.copy(p.position); _tmp.set(0, 0, 0); }
      this.localPosition.copy(this.position).sub(p.position);
      this.orbitalSpeed = _tmp.length();
      if (this.orbitalSpeed > 1e-9) this.rotation.setFromUnitVectors(_yAxis, _tmp.normalize());
    }
    this.position.copy(p.position).add(this.localPosition);
    this.orbitNormal.copy(p.orbitNormal);
    this.pole.copy(_yAxis).applyQuaternion(this.rotation);
    basisFromPole(this.pole, this.poleBasis);
    this.spinAngle = 0;
    this.distanceToStar = this.position.distanceTo(this.root.position);
  }

  /** Evaluate orbital state at Julian date jd. Parent must already be updated. */
  update(jd: number, tSeconds: number): void {
    const o = this.data.orbit;
    if (o && this.parent && !isKeplerian(o)) {
      this.updateSpecial(jd);
      return;
    }
    if (o && this.parent && isKeplerian(o)) {
      const parentGM = this.parent.gm;
      const r = resolveElements(o, jd, parentGM);
      this.resolved = r;
      this.periodDays = periodDays(r);
      this.E = solveKepler(r.M, r.e);
      positionFromE(r, this.E, _math);
      mathToScene(_math, this.orbitBasis, this.localPosition);
      this.position.copy(this.parent.position).add(this.localPosition);
      this.orbitalSpeed = visViva(parentGM, this.localPosition.length(), r.a);

      // orbit normal (math frame): (sin i sin Ω, −sin i cos Ω, cos i)
      const si = Math.sin(r.i), ci = Math.cos(r.i);
      _tmp.set(si * Math.sin(r.node), -si * Math.cos(r.node), ci);
      mathToScene(_tmp, this.orbitBasis, this.orbitNormal);

      // Pole: explicit, or derived from orbit normal (+ optional tilt)
      if (!this.data.pole) {
        if (this.data.tilt) {
          // tilt the orbit normal about the orbit's ascending node direction
          _tmp2.set(Math.cos(r.node), Math.sin(r.node), 0);
          mathToScene(_tmp2, this.orbitBasis, _tmp2);
          _qSpin.setFromAxisAngle(_tmp2.normalize(), this.data.tilt * DEG);
          this.pole.copy(this.orbitNormal).applyQuaternion(_qSpin);
        } else {
          this.pole.copy(this.orbitNormal);
        }
        basisFromPole(this.pole, this.poleBasis);
      }
    } else {
      this.localPosition.set(0, 0, 0);
      if (this.parent) this.position.copy(this.parent.position);
      else this.position.set(0, 0, 0);
    }

    // Spin
    if (this.data.rotationPeriod === 'sync' && this.parent) {
      // Keep local +X pointing at the parent: express (-localPosition) in pole basis.
      _tmp.copy(this.localPosition).negate();
      // transpose(poleBasis) * v
      const m = this.poleBasis.elements;
      const lx = m[0] * _tmp.x + m[1] * _tmp.y + m[2] * _tmp.z;
      const lz = m[6] * _tmp.x + m[7] * _tmp.y + m[8] * _tmp.z;
      this.spinAngle = Math.atan2(-lz, lx);
    } else if (this.rotationPeriodS !== 0) {
      const pm = (this.data.primeMeridian ?? 0) * DEG;
      this.spinAngle = pm + (2 * Math.PI * tSeconds) / this.rotationPeriodS;
    } else {
      this.spinAngle = 0;
    }

    _m4.setFromMatrix3(this.poleBasis);
    this.rotation.setFromRotationMatrix(_m4);
    _qSpin.setFromAxisAngle(_yAxis, this.spinAngle);
    this.rotation.multiply(_qSpin);

    this.distanceToStar = this.parent ? this.position.distanceTo(this.root.position) : 0;
  }

  /** Effective rotation period in hours (positive) for display */
  get displayRotationHours(): number {
    if (this.data.rotationPeriod === 'sync') return this.periodDays * 24;
    return Math.abs(this.data.rotationPeriod ?? 0);
  }

  get surfaceGravity(): number {
    // m/s²
    return (G * this.data.mass) / Math.pow(this.data.radius * 1000, 2);
  }

  get escapeVelocity(): number {
    // km/s
    return Math.sqrt((2 * G * this.data.mass) / (this.data.radius * 1000)) / 1000;
  }

  get density(): number {
    // g/cm³
    const v = (4 / 3) * Math.PI * Math.pow(this.data.radius * 1e5, 3); // cm³
    return (this.data.mass * 1000) / v;
  }

  /** Sphere-of-influence radius (km) */
  get soiRadius(): number {
    if (!this.parent || !this.resolved) return Infinity;
    return this.resolved.a * Math.pow(this.data.mass / this.parent.data.mass, 0.4);
  }

  get siderealDayDisplay(): string {
    const h = this.displayRotationHours;
    if (h === 0) return '—';
    if (h < 48) return _('{n} sa', { n: fixed(h, 2) });
    return _('{n} gün', { n: fixed((h / 24), 2) });
  }

  periodDisplay(): string {
    const d = this.periodDays;
    if (!d) return '—';
    if (d < 1) return _('{n} sa', { n: fixed((d * 24), 2) });
    if (d < 1000) return _('{n} gün', { n: fixed(d, 2) });
    return _('{n} yıl', { n: fixed((d / 365.25), 2) });
  }

  /** Equilibrium temperature estimate (K) from star luminosity and albedo */
  equilibriumTemperature(starRadiusKm: number, starTempK: number): number {
    if (!this.parent) return this.data.temperature ?? 0;
    const d = Math.max(this.distanceToStar, 1);
    const A = this.data.albedo ?? 0.3;
    return starTempK * Math.pow(1 - A, 0.25) * Math.sqrt(starRadiusKm / (2 * d));
  }

  /** Seconds in one sidereal rotation, absolute */
  get rotationSecondsAbs(): number {
    if (this.data.rotationPeriod === 'sync') return this.periodDays * DAY_S;
    return Math.abs(this.rotationPeriodS);
  }
}
