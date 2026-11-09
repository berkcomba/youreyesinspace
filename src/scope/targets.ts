/**
 * ScopeTargets from the catalogues, shared by the simulation's info card and the encyclopedia
 * builder. Each returns null when the object has nothing to show from the ground (spacecraft,
 * procedural objects, the Earth itself).
 */
import type { BodyData } from '../data/types';
import type { LandmarkDef } from '../data/landmarks';
import { LANDMARK_IMAGES } from '../data/landmarkImages';
import type { DiskLook, ScopeBody, ScopeDeep, ScopeSolar } from './types';

const SEC = 206_264.806;

const KIND: Record<string, ScopeDeep['kind']> = {
  nebula: 'nebula', cluster: 'open', remnant: 'snr', star: 'star', pulsar: 'pulsar', planetary: 'pn', globular: 'globular',
};

/** IAU rotation (deg at J2000, deg/day): the maps and the Great Red Spot sit where they should */
const IAU_W: Record<string, [number, number]> = {
  sun: [84.176, 14.1844], moon: [38.3213, 13.17635815], mars: [176.63, 350.89198226],
  jupiter: [43.3, 870.27], saturn: [38.9, 810.7939024],
};
const MOON_POLE = { ra: 269.9949, dec: 66.5392 };

const LOOKS = new Set(['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'io', 'titan']);

function lookOf(b: BodyData): DiskLook {
  if (LOOKS.has(b.id)) return b.id as DiskLook;
  return (b.albedo ?? 0.2) > 0.45 ? 'ice' : 'rock';
}

function scopeBody(b: BodyData, orbitFrom?: BodyData): ScopeBody {
  const w = IAU_W[b.id];
  const rot = typeof b.rotationPeriod === 'number' ? 360 / (b.rotationPeriod / 24) : 0;
  const o = (orbitFrom ?? b).orbit;
  return {
    id: b.id, name: b.name, radius: b.radius, albedo: b.albedo ?? 0.25, look: lookOf(b),
    pole: b.id === 'moon' ? MOON_POLE : b.pole,
    w0: w ? w[0] : 0, wRate: w ? w[1] : rot,
    orbit: o && (o.kind === 'jpl' || o.kind === 'simple') ? { ...o } as ScopeBody['orbit'] : undefined,
    rings: b.rings ? { inner: b.rings.inner, outer: b.rings.outer, gaps: b.rings.gaps ?? [] } : undefined,
  };
}

/** a Solar System body by id; `name` translates the display names */
export function solarTarget(id: string, bodies: readonly BodyData[], name: (s: string) => string = (s) => s): ScopeSolar | null {
  const byId = new Map(bodies.map((b) => [b.id, b]));
  const b = byId.get(id);
  if (!b || b.id === 'earth' || !['star', 'planet', 'dwarf', 'moon', 'asteroid'].includes(b.type)) return null;
  if (b.type === 'star' && b.id !== 'sun') return null;
  const named = (x: BodyData): BodyData => ({ ...x, name: name(x.name) });
  // the body whose disk is in the middle of the field
  let primary = b;
  if (b.type === 'moon' && b.parent && b.parent !== 'earth') {
    const p = byId.get(b.parent);
    if (!p) return null;
    primary = p.type === 'barycenter' ? bodies.filter((x) => x.parent === p.id).sort((x, y) => y.mass - x.mass)[0] ?? p : p;
  }
  // a body orbiting a barycentre takes the barycentre's heliocentric orbit
  const parent = primary.parent ? byId.get(primary.parent) : undefined;
  const orbitFrom = parent?.type === 'barycenter' ? parent : undefined;
  if (primary.id !== 'sun' && primary.id !== 'moon' && primary.parent !== 'sun' && !orbitFrom) return null;
  const sb = scopeBody(named(primary), orbitFrom);
  if (primary.id !== 'sun' && primary.id !== 'moon' && !sb.orbit) return null;
  const moonParents = new Set([primary.id, ...(orbitFrom ? [orbitFrom.id] : [])]);
  const moons = bodies
    .filter((m) => m.type === 'moon' && m.parent && moonParents.has(m.parent) && m.id !== primary.id && m.orbit?.kind === 'simple' && primary.id !== 'moon')
    .map((m) => scopeBody(named(m)));
  return { kind: 'solar', target: b.id, primary: sb, moons };
}

export function starTarget(o: { name: string; ra: number; dec: number; mag: number; bv?: number }): ScopeDeep | null {
  if (!Number.isFinite(o.mag)) return null;
  return { kind: 'star', name: o.name, ra: o.ra, dec: o.dec, mag: o.mag, size: 0, bv: o.bv };
}

/** "4,0" / "~8.4" / "+1,6" → 4.0 */
function parseMag(s: string | undefined): number | null {
  if (!s) return null;
  const m = /[-−+]?\d+(?:[.,]\d+)?/.exec(s.replace('−', '-'));
  return m ? parseFloat(m[0].replace(',', '.')) : null;
}

/** a deep-sky landmark; `hostDistPc` places objects in other galaxies */
export function landmarkTarget(d: LandmarkDef, name: string, hostDistPc?: number): ScopeDeep | null {
  if (d.procedural) return null;
  // the landmark list has one kind for all clusters; the old (yellow) ones are globulars
  const kind = d.kind === 'cluster' && d.color[2] < 0.8 * d.color[0] ? 'globular' : KIND[d.kind];
  const dist = d.distancePc ?? hostDistPc;
  if (!kind || !dist) return null;
  const mag = parseMag(d.facts['Görünür kadir']) ?? d.absMag + 5 * Math.log10(dist / 10);
  const size = ((2 * d.radiusPc) / dist) * SEC;
  const img = LANDMARK_IMAGES[d.id];
  const usePhoto = img && kind !== 'open' && kind !== 'globular';
  const special = d.id === 'l-m1' ? 'crab' : d.id === 'l-casa' ? 'casa' : d.id === 'l-pleiades' ? 'pleiades' : undefined;
  return {
    kind, name, ra: d.ra, dec: d.dec, mag, size, distPc: dist,
    ...(usePhoto ? { img: `/nebulae/${img.file}.jpg`, imgSpan: ((2 * img.span * d.radiusPc) / dist) * SEC } : {}),
    ...(kind === 'star' ? { bv: d.color[2] > d.color[0] ? 0 : 1 } : {}),
    ...(special ? { special } : {}),
  };
}

export function galaxyTarget(g: { name: string; ra: number; dec: number; distMpc: number; type: ScopeDeep['galType']; diameterKpc: number; absMag: number; axis?: number; pa?: number; inc?: number }, displayName: string): ScopeDeep | null {
  if (!(g.distMpc > 0)) return null;
  const axis = g.axis ?? (g.inc !== undefined ? Math.max(0.15, Math.cos(g.inc * Math.PI / 180)) : g.type === 'E' ? 0.8 : 0.6);
  const special = /M87|Virgo A/.test(g.name) ? 'm87' : /Centaurus A|NGC 5128/.test(g.name) ? 'cena' : undefined;
  return {
    kind: 'galaxy', name: displayName, ra: g.ra, dec: g.dec, galType: g.type,
    mag: g.absMag + 5 * Math.log10(g.distMpc * 1e5),
    size: (g.diameterKpc / (g.distMpc * 1000)) * SEC, axis, pa: g.pa ?? 0, distPc: g.distMpc * 1e6,
    ...(special ? { special } : {}),
  };
}

/** black holes with something to see: Sagittarius A* and M87* (the Event Horizon Telescope's two) */
export function blackHoleTarget(bodyId: string, name: string): ScopeDeep | null {
  if (bodyId === 'sgra') return { kind: 'bh', name, ra: 266.4168, dec: -29.0078, mag: 99, size: 0, special: 'sgra', prefer: 'eht' };
  if (bodyId === 'm87star') {
    return { kind: 'galaxy', name, ra: 187.706, dec: 12.391, mag: 8.6, size: 430, axis: 0.85, pa: 160, galType: 'E', distPc: 16.4e6, special: 'm87', prefer: 'eht' };
  }
  return null;
}
