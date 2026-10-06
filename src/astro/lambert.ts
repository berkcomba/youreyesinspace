import { Vector3 } from 'three';

/**
 * Two-body tools for the mission planner: Lambert's problem (universal variables) and
 * universal-variable Kepler propagation (f & g functions). All vectors are km / km/s in any
 * inertial frame; `mu` in km³/s².
 *
 * Algorithms follow Curtis, "Orbital Mechanics for Engineering Students" (§3.7, §5.3).
 */

/** Stumpff C(z) */
export function stumpffC(z: number): number {
  if (z > 1e-8) return (1 - Math.cos(Math.sqrt(z))) / z;
  if (z < -1e-8) return (Math.cosh(Math.sqrt(-z)) - 1) / -z;
  return 0.5;
}

/** Stumpff S(z) */
export function stumpffS(z: number): number {
  if (z > 1e-8) { const s = Math.sqrt(z); return (s - Math.sin(s)) / (s * s * s); }
  if (z < -1e-8) { const s = Math.sqrt(-z); return (Math.sinh(s) - s) / (s * s * s); }
  return 1 / 6;
}

export interface LambertSolution {
  v1: Vector3;
  v2: Vector3;
  /** transfer angle (rad) */
  dTheta: number;
}

const _c = new Vector3();

/**
 * Solve Lambert's problem: velocity at r1 that reaches r2 after `dt` seconds (single revolution).
 * @param normal reference "north" of the orbital plane — the transfer goes the short or the long
 *        way around so that the motion is prograde with respect to it.
 */
export function lambert(r1: Vector3, r2: Vector3, dt: number, mu: number, normal: Vector3, prograde = true): LambertSolution | null {
  if (dt <= 0) return null;
  const R1 = r1.length(), R2 = r2.length();
  if (R1 < 1e-6 || R2 < 1e-6) return null;
  _c.crossVectors(r1, r2);
  const cosT = Math.min(1, Math.max(-1, r1.dot(r2) / (R1 * R2)));
  let dTheta = Math.acos(cosT);
  const up = _c.dot(normal) >= 0;
  if (prograde ? !up : up) dTheta = 2 * Math.PI - dTheta;
  const sinT = Math.sin(dTheta);
  if (Math.abs(sinT) < 1e-9 || 1 - cosT < 1e-12) return null; // collinear: plane undefined
  const A = sinT * Math.sqrt((R1 * R2) / (1 - cosT));
  if (Math.abs(A) < 1e-9) return null;
  const sqrtMu = Math.sqrt(mu);

  const y = (z: number): number => R1 + R2 + (A * (z * stumpffS(z) - 1)) / Math.sqrt(stumpffC(z));
  const F = (z: number): number => {
    const yy = y(z);
    if (yy < 0) return -Infinity;
    const C = stumpffC(z);
    return Math.pow(yy / C, 1.5) * stumpffS(z) + A * Math.sqrt(yy) - sqrtMu * dt;
  };

  // F is monotonic in z (y < 0 counts as −∞); bracket the root between a hyperbolic z and the
  // single-revolution limit z → 4π² where F → +∞
  let lo = -1;
  let hi = 4 * Math.PI * Math.PI - 1e-4;
  while (F(lo) > 0) { lo *= 2; if (lo < -1e7) return null; }
  if (!(F(hi) > 0)) return null;
  let z = 0;
  for (let i = 0; i < 100; i++) {
    z = 0.5 * (lo + hi);
    const f = F(z);
    if (!Number.isFinite(f) || f < 0) lo = z; else hi = z;
    if (hi - lo < 1e-11 * Math.max(1, Math.abs(z))) break;
  }
  const yy = y(z);
  if (!(yy > 0)) return null;
  const f = 1 - yy / R1;
  const g = A * Math.sqrt(yy / mu);
  const gdot = 1 - yy / R2;
  if (Math.abs(g) < 1e-12) return null;
  const v1 = new Vector3().copy(r2).addScaledVector(r1, -f).multiplyScalar(1 / g);
  const v2 = new Vector3().copy(r2).multiplyScalar(gdot).sub(r1).multiplyScalar(1 / g);
  return { v1, v2, dTheta };
}

/**
 * Propagate a two-body state by `dt` seconds (universal variables). Writes the new position and
 * velocity into `outR`/`outV` (which may alias r0/v0).
 */
export function propagate(r0: Vector3, v0: Vector3, dt: number, mu: number, outR: Vector3, outV: Vector3): void {
  const R0 = r0.length();
  const V0sq = v0.lengthSq();
  const vr0 = r0.dot(v0) / R0;
  const alpha = 2 / R0 - V0sq / mu; // 1/a
  const sqrtMu = Math.sqrt(mu);
  // elliptic: reduce by whole periods to keep χ small
  if (alpha > 1e-16) {
    const a = 1 / alpha;
    const T = 2 * Math.PI * Math.sqrt((a * a * a) / mu);
    if (Number.isFinite(T) && T > 0) dt -= Math.floor(dt / T) * T;
  }
  if (Math.abs(dt) < 1e-9) { outR.copy(r0); outV.copy(v0); return; }
  let chi = Math.abs(alpha) > 1e-16 ? sqrtMu * Math.abs(alpha) * dt : (sqrtMu * dt) / R0;
  for (let i = 0; i < 60; i++) {
    const z = alpha * chi * chi;
    const C = stumpffC(z), S = stumpffS(z);
    const f = ((R0 * vr0) / sqrtMu) * chi * chi * C + (1 - alpha * R0) * chi * chi * chi * S + R0 * chi - sqrtMu * dt;
    const df = ((R0 * vr0) / sqrtMu) * chi * (1 - z * S) + (1 - alpha * R0) * chi * chi * C + R0;
    const step = f / df;
    chi -= step;
    if (Math.abs(step) < 1e-9 * Math.max(1, Math.abs(chi))) break;
  }
  const z = alpha * chi * chi;
  const C = stumpffC(z), S = stumpffS(z);
  const f = 1 - ((chi * chi) / R0) * C;
  const g = dt - ((chi * chi * chi) / sqrtMu) * S;
  const rx = f * r0.x + g * v0.x, ry = f * r0.y + g * v0.y, rz = f * r0.z + g * v0.z;
  const R = Math.hypot(rx, ry, rz);
  const fdot = (sqrtMu / (R * R0)) * (alpha * chi * chi * chi * S - chi);
  const gdot = 1 - ((chi * chi) / R) * C;
  const vx = fdot * r0.x + gdot * v0.x, vy = fdot * r0.y + gdot * v0.y, vz = fdot * r0.z + gdot * v0.z;
  outR.set(rx, ry, rz);
  outV.set(vx, vy, vz);
}

/** Hohmann transfer time (s) between circular radii r1, r2 */
export function hohmannTime(r1: number, r2: number, mu: number): number {
  const a = 0.5 * (r1 + r2);
  return Math.PI * Math.sqrt((a * a * a) / mu);
}

/** Δv to leave a circular parking orbit (radius rp) with hyperbolic excess speed vInf */
export function escapeDv(mu: number, rp: number, vInf: number): number {
  if (mu <= 0 || rp <= 0) return vInf;
  const vPark = Math.sqrt(mu / rp);
  return Math.sqrt(vInf * vInf + (2 * mu) / rp) - vPark;
}

/** Δv to capture from hyperbolic excess speed vInf into a circular orbit of radius rc */
export function captureDv(mu: number, rc: number, vInf: number): number {
  return escapeDv(mu, rc, vInf);
}

/**
 * Unpowered flyby geometry: periapsis radius that turns the excess velocity by `delta` radians.
 */
export function flybyPeriapsis(mu: number, vInf: number, delta: number): number {
  const s = Math.sin(delta / 2);
  if (s <= 1e-9) return Infinity;
  return (mu / (vInf * vInf)) * (1 / s - 1);
}

/** Maximum turn angle (rad) for a given periapsis radius */
export function maxTurnAngle(mu: number, vInf: number, rp: number): number {
  return 2 * Math.asin(1 / (1 + (rp * vInf * vInf) / mu));
}
