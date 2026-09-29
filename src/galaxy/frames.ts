import { Matrix3, Vector3 } from 'three';
import { raDecToScene } from '../math/frames';

/**
 * Galactic reference directions in the scene frame.
 * Galactic north pole (J2000): RA 192.859°, Dec 27.128°; galactic centre RA 266.405°, Dec −28.936°.
 */
export const GAL_NORTH = raDecToScene(192.859, 27.128);
export const GAL_CENTER_DIR = raDecToScene(266.405, -28.936);
export const GAL_X = GAL_CENTER_DIR.clone().sub(GAL_NORTH.clone().multiplyScalar(GAL_CENTER_DIR.dot(GAL_NORTH))).normalize();
export const GAL_Y = new Vector3().crossVectors(GAL_NORTH, GAL_X).normalize();

/** Distance from the Sun to the galactic centre (pc) and the Sun's height above the plane (pc) */
export const SUN_GALACTOCENTRIC_PC = 8200;
export const SUN_HEIGHT_PC = 20;

/** Galactic (l, b) radians → scene unit vector */
export function galacticToScene(l: number, b: number, out = new Vector3()): Vector3 {
  const cb = Math.cos(b);
  return out
    .copy(GAL_X).multiplyScalar(cb * Math.cos(l))
    .addScaledVector(GAL_Y, cb * Math.sin(l))
    .addScaledVector(GAL_NORTH, Math.sin(b));
}

/**
 * Milky Way local basis (columns X, Y, Z in scene frame): X points from the centre toward the Sun,
 * Y is the galactic north pole, Z completes the right-handed set.
 */
export function milkyWayBasis(out = new Matrix3()): Matrix3 {
  const x = GAL_X.clone().negate();
  const y = GAL_NORTH.clone();
  const z = new Vector3().crossVectors(x, y).normalize();
  return out.set(
    x.x, y.x, z.x,
    x.y, y.y, z.y,
    x.z, y.z, z.z,
  );
}

/** Milky Way centre position (pc, scene frame, relative to the Sun) */
export function milkyWayCenterPc(out = new Vector3()): Vector3 {
  return out.copy(GAL_X).multiplyScalar(SUN_GALACTOCENTRIC_PC).addScaledVector(GAL_NORTH, -SUN_HEIGHT_PC);
}

/** Build a galaxy basis from its sky direction, position angle (deg, N→E) and inclination (deg, 0 = face-on). */
export function galaxyBasisFromSky(dir: Vector3, positionAngleDeg: number, inclinationDeg: number, out = new Matrix3()): Matrix3 {
  const pole = raDecToScene(0, 90);
  const d = dir.clone().normalize();
  const eN = pole.clone().sub(d.clone().multiplyScalar(pole.dot(d)));
  if (eN.lengthSq() < 1e-8) eN.set(1, 0, 0).sub(d.clone().multiplyScalar(d.x));
  eN.normalize();
  const eE = new Vector3().crossVectors(d, eN).normalize();
  const pa = (positionAngleDeg * Math.PI) / 180;
  const inc = (inclinationDeg * Math.PI) / 180;
  // major axis on the sky
  const major = eN.clone().multiplyScalar(Math.cos(pa)).addScaledVector(eE, Math.sin(pa)).normalize();
  // disc normal: the line of sight tilted by the inclination about the major axis
  const perp = new Vector3().crossVectors(major, d).normalize();
  const normal = d.clone().multiplyScalar(Math.cos(inc)).addScaledVector(perp, Math.sin(inc)).normalize();
  const z = new Vector3().crossVectors(major, normal).normalize();
  return out.set(
    major.x, normal.x, z.x,
    major.y, normal.y, z.y,
    major.z, normal.z, z.z,
  );
}
