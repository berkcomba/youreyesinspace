import { Matrix3, Vector3 } from 'three';
import { DEG, OBLIQUITY_J2000 } from '../core/constants';
import type { PoleRaDec } from '../data/types';

/**
 * Coordinate conventions
 * ----------------------
 * "Ecliptic math frame": x → vernal equinox, z → ecliptic north, y = z × x (right-handed).
 * "Scene frame" (three.js, Y-up): X = x, Y = z, Z = -y.
 * All simulation positions are stored in scene frame, in kilometres.
 */

export function eclipticToScene(x: number, y: number, z: number, out = new Vector3()): Vector3 {
  return out.set(x, z, -y);
}

/** ICRF equatorial unit vector (RA/Dec deg) → ecliptic math frame */
export function raDecToEclipticMath(raDeg: number, decDeg: number, out = new Vector3()): Vector3 {
  const ra = raDeg * DEG;
  const dec = decDeg * DEG;
  const xe = Math.cos(dec) * Math.cos(ra);
  const ye = Math.cos(dec) * Math.sin(ra);
  const ze = Math.sin(dec);
  const ce = Math.cos(OBLIQUITY_J2000);
  const se = Math.sin(OBLIQUITY_J2000);
  // rotate about x by -ε (equatorial → ecliptic)
  return out.set(xe, ye * ce + ze * se, -ye * se + ze * ce);
}

/** ICRF RA/Dec → scene-frame unit vector */
export function raDecToScene(raDeg: number, decDeg: number, out = new Vector3()): Vector3 {
  const v = raDecToEclipticMath(raDeg, decDeg);
  return eclipticToScene(v.x, v.y, v.z, out);
}

export function poleToScene(pole: PoleRaDec, out = new Vector3()): Vector3 {
  return raDecToScene(pole.ra, pole.dec, out);
}

const _tmpA = new Vector3();
const _tmpB = new Vector3();
const _up = new Vector3(0, 1, 0);
const _xAxis = new Vector3(1, 0, 0);

/**
 * Build an orthonormal basis whose local +Y is the given pole (scene frame).
 * Local +X lies (as far as possible) in the ecliptic plane along the ascending node direction.
 * Returns a Matrix3 whose columns are (X', pole, Z').
 */
export function basisFromPole(pole: Vector3, out = new Matrix3()): Matrix3 {
  const p = _tmpA.copy(pole).normalize();
  const ref = Math.abs(p.dot(_up)) > 0.9999 ? _xAxis : _up;
  // X' = ref × p  (perpendicular to both ref and pole)
  const x = _tmpB.crossVectors(ref, p).normalize();
  // Z' = X' × p
  const zx = x.y * p.z - x.z * p.y;
  const zy = x.z * p.x - x.x * p.z;
  const zz = x.x * p.y - x.y * p.x;
  out.set(
    x.x, p.x, zx,
    x.y, p.y, zy,
    x.z, p.z, zz,
  );
  return out;
}

/** Ecliptic longitude/latitude (deg) → scene unit vector */
export function lonLatToScene(lonDeg: number, latDeg: number, out = new Vector3()): Vector3 {
  const lon = lonDeg * DEG;
  const lat = latDeg * DEG;
  return eclipticToScene(Math.cos(lat) * Math.cos(lon), Math.cos(lat) * Math.sin(lon), Math.sin(lat), out);
}
