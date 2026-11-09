/**
 * Where a Solar System body stands as seen from the Earth, small enough to run on an encyclopedia
 * page: Keplerian elements for the Earth and the planets, a truncated lunar theory (Meeus, ch. 47)
 * for the Moon, catalogue orbits for moons. Equatorial (ICRF) frame, km.
 */
import type { ScopeBody, ScopeOrbit, ScopeSolar } from './types';

export type V3 = [number, number, number];

const DEG = Math.PI / 180;
const AU = 149_597_870.7;
const J2000 = 2_451_545.0;
const ARCSEC = 206_264.806;
const OBL = 23.4392911 * DEG;

const dot = (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
const len = (a: V3): number => Math.hypot(a[0], a[1], a[2]);
const norm = (a: V3): V3 => scale(a, 1 / (len(a) || 1));
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const vec = { dot, sub, add, scale, len, norm, cross };

const eclToEq = (v: V3): V3 => [v[0], v[1] * Math.cos(OBL) - v[2] * Math.sin(OBL), v[1] * Math.sin(OBL) + v[2] * Math.cos(OBL)];
export const raDecVec = (ra: number, dec: number): V3 => [Math.cos(dec * DEG) * Math.cos(ra * DEG), Math.cos(dec * DEG) * Math.sin(ra * DEG), Math.sin(dec * DEG)];

function kepler(M: number, e: number): number {
  let E = e < 0.8 ? M : Math.PI;
  for (let k = 0; k < 30; k++) {
    const d = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    E -= d;
    if (Math.abs(d) < 1e-10) break;
  }
  return E;
}

/** position in the orbit's reference frame, same units as a */
function orbitXYZ(a: number, e: number, i: number, node: number, argPeri: number, M: number): V3 {
  const E = kepler(((M % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI), e);
  const P = a * (Math.cos(E) - e), Q = a * Math.sqrt(1 - e * e) * Math.sin(E);
  const cw = Math.cos(argPeri), sw = Math.sin(argPeri), cO = Math.cos(node), sO = Math.sin(node), ci = Math.cos(i), si = Math.sin(i);
  const xw = P * cw - Q * sw, yw = P * sw + Q * cw;
  return [xw * cO - yw * ci * sO, xw * sO + yw * ci * cO, yw * si];
}

const EARTH: ScopeOrbit = {
  kind: 'jpl', a: 1.00000261, e: 0.01671123, i: -0.00001531, L: 100.46457166, lonPeri: 102.93768193, node: 0,
  da: 0.00000562, de: -0.00004392, di: -0.01294668, dL: 35999.37244981, dLonPeri: 0.32327364, dNode: 0,
};

/** heliocentric ecliptic position (km) of a heliocentric orbit */
function helio(o: ScopeOrbit, jd: number): V3 {
  if (o.kind === 'jpl') {
    const T = (jd - J2000) / 36525;
    const lonPeri = (o.lonPeri + o.dLonPeri * T) * DEG, node = (o.node + o.dNode * T) * DEG;
    return orbitXYZ((o.a + o.da * T) * AU, o.e + o.de * T, (o.i + o.di * T) * DEG, node, lonPeri - node, (o.L + o.dL * T) * DEG - lonPeri);
  }
  const dt = jd - o.epoch;
  return orbitXYZ(o.a, o.e, o.i * DEG, o.node * DEG, o.argPeri * DEG, (o.M0 + (360 / o.period) * dt) * DEG);
}

/** geocentric Moon, equatorial km (Meeus' main terms: ~0.3° and ~1500 km) */
export function moonGeo(jd: number): V3 {
  const T = (jd - J2000) / 36525;
  const Lp = 218.3164477 + 481267.88123421 * T;
  const D = (297.8501921 + 445267.1114034 * T) * DEG;
  const M = (357.5291092 + 35999.0502909 * T) * DEG;
  const Mp = (134.9633964 + 477198.8675055 * T) * DEG;
  const F = (93.2720950 + 483202.0175233 * T) * DEG;
  const lam = (Lp + 6.289 * Math.sin(Mp) + 1.274 * Math.sin(2 * D - Mp) + 0.658 * Math.sin(2 * D) + 0.214 * Math.sin(2 * Mp) - 0.186 * Math.sin(M) - 0.114 * Math.sin(2 * F)) * DEG;
  const bet = (5.128 * Math.sin(F) + 0.281 * Math.sin(Mp + F) + 0.278 * Math.sin(Mp - F) + 0.173 * Math.sin(2 * D - F)) * DEG;
  const r = 385001 - 20905 * Math.cos(Mp) - 3699 * Math.cos(2 * D - Mp) - 2956 * Math.cos(2 * D) - 570 * Math.cos(2 * Mp);
  return eclToEq([r * Math.cos(bet) * Math.cos(lam), r * Math.cos(bet) * Math.sin(lam), r * Math.sin(bet)]);
}

export const earthHelio = (jd: number): V3 => eclToEq(helio(EARTH, jd));

/** a moon around its planet (equatorial km): catalogue elements in the planet's equator plane */
function moonAround(m: ScopeBody, planet: ScopeBody, jd: number): V3 {
  const o = m.orbit!;
  if (o.kind !== 'simple') return [0, 0, 0];
  const p = orbitXYZ(o.a, o.e, o.i * DEG, o.node * DEG, o.argPeri * DEG, (o.M0 + (360 / o.period) * (jd - o.epoch)) * DEG);
  if (o.frame === 'ecliptic') return eclToEq(p);
  const Z = planet.pole ? raDecVec(planet.pole.ra, planet.pole.dec) : [0, 0, 1] as V3;
  const X = norm(Math.abs(Z[2]) > 0.9999 ? [1, 0, 0] : cross([0, 0, 1], Z));
  const Y = cross(Z, X);
  return add(add(scale(X, p[0]), scale(Y, p[1])), scale(Z, p[2]));
}

export interface SkyBasis {
  /** unit vector from the Earth to the body */
  n: V3;
  /** east and north on the sky */
  E: V3;
  N: V3;
}

export function skyBasis(n: V3): SkyBasis {
  const E = norm(Math.abs(n[2]) > 0.99999 ? [0, 1, 0] : cross([0, 0, 1], n));
  return { n, E, N: cross(n, E) };
}

/** a direction projected on the sky: [west, north] components */
export const onSky = (b: SkyBasis, v: V3): [number, number] => [-dot(v, b.E), dot(v, b.N)];

export interface MoonSpot {
  id: string;
  name: string;
  /** offset from the primary's centre, arcsec, +x west, +y north */
  x: number;
  y: number;
  /** angular diameter, arcsec */
  diam: number;
  mag: number;
  /** behind the planet's disk (occulted) */
  hidden: boolean;
  /** in front of the disk (transit) */
  front: boolean;
}

export interface SolarGeo {
  /** Earth → primary, km */
  dist: number;
  /** Sun → primary, AU */
  r: number;
  /** phase angle (Sun–body–Earth), degrees */
  phase: number;
  /** elongation from the Sun as seen from the Earth, degrees */
  elong: number;
  ra: number;
  dec: number;
  basis: SkyBasis;
  /** unit vector from the primary to the Sun */
  sun: V3;
  /** angular diameter of the primary, arcsec */
  diam: number;
  mag: number;
  /** ring opening seen from the Earth (sub-Earth latitude), degrees */
  ringTilt: number;
  /** body-fixed axes (pole, prime meridian, 90° east of it) in the equatorial frame */
  axes: { X: V3; Y: V3; Z: V3 } | null;
  moons: MoonSpot[];
  /** offset of the selected body from the primary's centre (arcsec), 0 when the primary is selected */
  center: [number, number];
}

/** Mallama & Hilton (2018) V magnitudes; a generic H–G-like law for the rest */
function magnitude(b: ScopeBody, r: number, delta: number, alpha: number, ringTilt: number): number {
  const d = 5 * Math.log10((r * delta) / (AU * AU));
  const a = alpha;
  switch (b.id) {
    case 'mercury': return -0.613 + 6.328e-2 * a - 1.6336e-3 * a * a + 3.3644e-5 * a ** 3 - 3.4265e-7 * a ** 4 + 1.6893e-9 * a ** 5 - 3.0334e-12 * a ** 6 + d;
    case 'venus': return (a < 163.7 ? -4.384 - 1.044e-3 * a + 3.687e-4 * a * a - 2.814e-6 * a ** 3 + 8.938e-9 * a ** 4 : 236.05828 - 2.81914 * a + 8.39034e-3 * a * a) + d;
    case 'mars': return -1.601 + 2.267e-2 * a - 1.302e-4 * a * a + d;
    case 'jupiter': return -9.395 - 3.7e-4 * a + 6.16e-4 * a * a + d;
    case 'saturn': return -8.914 - 1.825 * Math.sin(Math.abs(ringTilt) * DEG) + 2.6e-2 * a + d;
    case 'uranus': return -7.110 + 6.587e-3 * a + 1.045e-4 * a * a + d;
    case 'neptune': return -7.00 + 7.944e-3 * a + 9.617e-5 * a * a + d;
    case 'moon': return -12.73 + 0.026 * a + 4e-9 * a ** 4 + 5 * Math.log10((r / AU) * (delta / 384_400));
    case 'sun': return -26.74 + 5 * Math.log10(delta / AU);
    default: {
      const H = 5 * Math.log10(1329 / (2 * b.radius * Math.sqrt(Math.max(0.02, b.albedo))));
      return H + d + 0.03 * Math.min(a, 120);
    }
  }
}

/** body-fixed axes at `jd`, from the IAU pole and prime meridian */
function bodyAxes(b: ScopeBody, jd: number): { X: V3; Y: V3; Z: V3 } | null {
  if (!b.pole) return null;
  const Z = raDecVec(b.pole.ra, b.pole.dec);
  const X0 = norm(Math.abs(Z[2]) > 0.9999 ? [1, 0, 0] : cross([0, 0, 1], Z)), Y0 = cross(Z, X0);
  const W = ((b.w0 ?? 0) + (b.wRate ?? 0) * (jd - J2000)) * DEG;
  const X = add(scale(X0, Math.cos(W)), scale(Y0, Math.sin(W)));
  return { X, Y: cross(Z, X), Z };
}

export function solarGeometry(s: ScopeSolar, jd: number): SolarGeo | null {
  const p = s.primary;
  const earth = earthHelio(jd);
  let pos: V3;
  if (p.id === 'sun') pos = [0, 0, 0];
  else if (p.id === 'moon') pos = add(earth, moonGeo(jd));
  else if (p.orbit) pos = eclToEq(helio(p.orbit, jd));
  else return null;
  // light time: where the body was when the light left it
  const g0 = sub(pos, earth);
  const lt = len(g0) / 299_792.458 / 86400;
  if (p.id !== 'sun' && p.id !== 'moon' && p.orbit) pos = eclToEq(helio(p.orbit, jd - lt));
  const g = sub(pos, earth), dist = len(g), n = norm(g);
  const basis = skyBasis(n);
  const sun = p.id === 'sun' ? scale(n, -1) : norm(scale(pos, -1));
  const toEarth = scale(n, -1);
  const phase = p.id === 'sun' ? 0 : Math.acos(Math.max(-1, Math.min(1, dot(sun, toEarth)))) / DEG;
  const elong = p.id === 'sun' ? 0 : Math.acos(Math.max(-1, Math.min(1, dot(n, norm(scale(earth, -1)))))) / DEG;
  const ra = ((Math.atan2(n[1], n[0]) / DEG) + 360) % 360, dec = Math.asin(n[2]) / DEG;
  const pole = p.pole ? raDecVec(p.pole.ra, p.pole.dec) : null;
  const ringTilt = pole ? Math.asin(Math.max(-1, Math.min(1, dot(pole, toEarth)))) / DEG : 0;
  const r = len(pos) || AU;
  const diam = (2 * p.radius / dist) * ARCSEC;
  const mag = magnitude(p, r, dist, phase, ringTilt);

  const moons: MoonSpot[] = [];
  let center: [number, number] = [0, 0];
  for (const m of s.moons) {
    if (!m.orbit) continue;
    const rel = moonAround(m, p, jd - lt);
    const [x, y] = onSky(basis, rel);
    const along = dot(rel, n);
    const sx = (x / dist) * ARCSEC, sy = (y / dist) * ARCSEC;
    const sep = Math.hypot(sx, sy);
    const md = len(add(g, rel));
    const ma = Math.acos(Math.max(-1, Math.min(1, dot(norm(scale(add(pos, rel), -1)), norm(scale(add(g, rel), -1)))))) / DEG;
    const spot: MoonSpot = {
      id: m.id, name: m.name, x: sx, y: sy, diam: (2 * m.radius / md) * ARCSEC,
      mag: magnitude(m, len(add(pos, rel)), md, ma, 0),
      hidden: sep < diam / 2 && along > 0, front: sep < diam / 2 && along < 0,
    };
    moons.push(spot);
    if (m.id === s.target) center = [sx, sy];
  }
  return { dist, r: r / AU, phase, elong, ra, dec, basis, sun, diam, mag, ringTilt, axes: bodyAxes(p, jd - lt), moons, center };
}

/** Julian date of a JS time */
export const jdOf = (ms: number): number => ms / 86_400_000 + 2_440_587.5;
