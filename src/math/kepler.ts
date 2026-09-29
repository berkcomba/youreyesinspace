import { Matrix3, Vector3 } from 'three';
import { AU_KM, DAY_S, DEG, J2000_JD } from '../core/constants';
import type { JplElements, OrbitElements, SimpleElements } from '../data/types';

export const GM_SUN_KM3_S2 = 1.32712440018e11;

/** Resolved instantaneous elements (radians, km) */
export interface ResolvedElements {
  a: number; // km
  e: number;
  i: number; // rad
  node: number; // rad
  argPeri: number; // rad
  M: number; // rad, mean anomaly at requested time
  /** mean motion rad/s */
  n: number;
}

const TWO_PI = Math.PI * 2;

export function wrapAngle(a: number): number {
  a %= TWO_PI;
  if (a < 0) a += TWO_PI;
  return a;
}

/** Solve Kepler's equation M = E - e sin E for elliptical orbits. */
export function solveKepler(M: number, e: number): number {
  M = wrapAngle(M);
  let E = e < 0.8 ? M : Math.PI;
  for (let k = 0; k < 30; k++) {
    const f = E - e * Math.sin(E) - M;
    const fp = 1 - e * Math.cos(E);
    const d = f / fp;
    E -= d;
    if (Math.abs(d) < 1e-12) break;
  }
  return E;
}

export type KeplerElements = JplElements | SimpleElements;

export function isKeplerian(el: OrbitElements): el is KeplerElements {
  return el.kind === 'jpl' || el.kind === 'simple';
}

export function resolveElements(el: KeplerElements, jd: number, parentGM: number): ResolvedElements {
  if (el.kind === 'jpl') return resolveJpl(el, jd);
  return resolveSimple(el, jd, parentGM);
}

function resolveJpl(el: JplElements, jd: number): ResolvedElements {
  const T = (jd - J2000_JD) / 36525;
  const a = (el.a + el.da * T) * AU_KM;
  const e = el.e + el.de * T;
  const i = (el.i + el.di * T) * DEG;
  const L = (el.L + el.dL * T) * DEG;
  const lonPeri = (el.lonPeri + el.dLonPeri * T) * DEG;
  const node = (el.node + el.dNode * T) * DEG;
  const argPeri = lonPeri - node;
  const M = wrapAngle(L - lonPeri);
  const n = Math.sqrt(GM_SUN_KM3_S2 / (a * a * a));
  return { a, e, i, node, argPeri, M, n };
}

function resolveSimple(el: SimpleElements, jd: number, parentGM: number): ResolvedElements {
  const dt = jd - el.epoch; // days
  const nDegDay = 360 / el.period;
  const M = wrapAngle((el.M0 + nDegDay * dt) * DEG);
  const node = (el.node + (el.nodeRate ?? 0) * dt) * DEG;
  const argPeri = (el.argPeri + (el.periRate ?? 0) * dt) * DEG;
  // The catalogue period is authoritative (it already includes the secondary's mass)
  void parentGM;
  const n = TWO_PI / (el.period * DAY_S);
  return { a: el.a, e: el.e, i: el.i * DEG, node, argPeri, M, n };
}

/**
 * Position in the orbit's reference frame (math frame: x = reference direction, z = plane normal)
 * given eccentric anomaly E.
 */
export function positionFromE(r: ResolvedElements, E: number, out: Vector3): Vector3 {
  const { a, e, i, node, argPeri } = r;
  const cosE = Math.cos(E);
  const sinE = Math.sin(E);
  const P = a * (cosE - e);
  const Q = a * Math.sqrt(1 - e * e) * sinE;

  const cw = Math.cos(argPeri), sw = Math.sin(argPeri);
  const cO = Math.cos(node), sO = Math.sin(node);
  const ci = Math.cos(i), si = Math.sin(i);

  // rotate perifocal → reference frame
  const xw = P * cw - Q * sw;
  const yw = P * sw + Q * cw;
  const x = xw * cO - yw * ci * sO;
  const y = xw * sO + yw * ci * cO;
  const z = yw * si;
  return out.set(x, y, z);
}

/** Radial distance for given E */
export function radiusFromE(r: ResolvedElements, E: number): number {
  return r.a * (1 - r.e * Math.cos(E));
}

/**
 * Convert a math-frame vector to scene frame through an orbit basis matrix.
 * scene = basis * (x, z, -y)
 */
const _v = new Vector3();
export function mathToScene(v: Vector3, basis: Matrix3, out: Vector3): Vector3 {
  _v.set(v.x, v.z, -v.y);
  return out.copy(_v).applyMatrix3(basis);
}

/** Orbital period in days from resolved elements */
export function periodDays(r: ResolvedElements): number {
  return TWO_PI / r.n / DAY_S;
}

/** Vis-viva orbital speed km/s at distance r */
export function visViva(gm: number, rKm: number, aKm: number): number {
  return Math.sqrt(Math.max(0, gm * (2 / rKm - 1 / aKm)));
}
