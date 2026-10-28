import { Vector3 } from 'three';

/** Stumpff functions c2(z), c3(z) */
function stumpff(z: number): [number, number] {
  if (z > 1e-6) {
    const s = Math.sqrt(z);
    return [(1 - Math.cos(s)) / z, (s - Math.sin(s)) / (s * z)];
  }
  if (z < -1e-6) {
    const s = Math.sqrt(-z);
    return [(1 - Math.cosh(s)) / z, (Math.sinh(s) - s) / (s * -z)];
  }
  return [0.5, 1 / 6];
}

const _r0 = new Vector3();
const _v0 = new Vector3();
const _h = new Vector3();

/**
 * Two-body propagation with universal variables (Vallado, Algorithm 8): the state `r0`, `v0`
 * (km, km/s) after `dt` seconds in the field `gm` (km³/s²), for any conic. Used for the dust a
 * comet sheds — each grain feels a Sun lightened by radiation pressure (β), so its own conic.
 */
export function propagateState(r0: Vector3, v0: Vector3, gm: number, dt: number, outR: Vector3, outV?: Vector3): void {
  if (dt === 0) { outR.copy(r0); outV?.copy(v0); return; }
  _r0.copy(r0); _v0.copy(v0);
  const r0n = _r0.length();
  const v02 = _v0.lengthSq();
  const rdv = _r0.dot(_v0);
  const sqrtMu = Math.sqrt(gm);
  const alpha = 2 / r0n - v02 / gm;    // 1/a
  let chi: number;
  if (alpha > 1e-12) {
    chi = sqrtMu * dt * alpha;
  } else if (Math.abs(alpha) < 1e-12) {
    _h.crossVectors(_r0, _v0);
    const p = _h.lengthSq() / gm;
    const s = 0.5 * Math.atan(1 / (3 * Math.sqrt(gm / (p * p * p)) * dt));
    const w = Math.atan(Math.cbrt(Math.tan(s)));
    chi = (Math.sqrt(p) * 2) / Math.tan(2 * w);
  } else {
    const a = 1 / alpha;
    const sgn = Math.sign(dt);
    const num = -2 * gm * alpha * dt;
    const den = rdv + sgn * Math.sqrt(-gm * a) * (1 - r0n * alpha);
    chi = sgn * Math.sqrt(-a) * Math.log(Math.max(num / den, 1e-300));
  }
  let r = r0n, c2 = 0.5, c3 = 1 / 6, z = 0;
  for (let it = 0; it < 40; it++) {
    z = chi * chi * alpha;
    [c2, c3] = stumpff(z);
    r = chi * chi * c2 + (rdv / sqrtMu) * chi * (1 - z * c3) + r0n * (1 - z * c2);
    const f = sqrtMu * dt - chi * chi * chi * c3 - (rdv / sqrtMu) * chi * chi * c2 - r0n * chi * (1 - z * c3);
    const dchi = f / r;
    chi += dchi;
    if (Math.abs(dchi) < 1e-8 * Math.max(1, Math.abs(chi))) break;
  }
  const f = 1 - (chi * chi / r0n) * c2;
  const g = dt - (chi * chi * chi / sqrtMu) * c3;
  outR.copy(_r0).multiplyScalar(f).addScaledVector(_v0, g);
  if (outV) {
    const gdot = 1 - (chi * chi / r) * c2;
    const fdot = (sqrtMu / (r * r0n)) * chi * (z * c3 - 1);
    outV.copy(_r0).multiplyScalar(fdot).addScaledVector(_v0, gdot);
  }
}
