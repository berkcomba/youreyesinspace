import type { CelestialBody } from '../core/CelestialBody';
import type { BodyData, SimpleElements } from '../data/types';

const STELLAR = new Set(['star', 'pulsar', 'blackhole']);

/** Companions lighter than this fraction of the primary keep orbiting the primary itself (S-stars …) */
const MIN_MASS_RATIO = 0.01;

/**
 * Rewrite a system so that a stellar binary orbits its common centre of mass.
 *
 * Input: a body list whose first entry is the (orbit-less) primary and which contains exactly
 * one stellar-mass companion (star / pulsar / black hole) on a Keplerian orbit around it, with
 * `a` being the *relative* semi-major axis. Output: an invisible `barycenter` root, the primary
 * on an orbit of size a·m₂/M (periapsis rotated by 180°) and the companion on a·m₁/M — same
 * period, eccentricity and plane, so the two always stay on opposite sides of the centre of
 * mass. Planets and moons keep their parents (they move with their star).
 *
 * Systems without such a companion are returned unchanged.
 */
export function toBarycentric(bodies: BodyData[], baryId: string, baryName: string): BodyData[] {
  const root = bodies[0];
  if (!root || root.parent || root.type === 'barycenter') return bodies;
  const companions = bodies.filter((b) =>
    b.parent === root.id && STELLAR.has(b.type) && b.orbit?.kind === 'simple' && b.mass / root.mass >= MIN_MASS_RATIO);
  if (companions.length !== 1) return bodies;
  const comp = companions[0];
  const o = comp.orbit as SimpleElements;
  const M = root.mass + comp.mass;

  const bary: BodyData = {
    id: baryId, name: baryName, type: 'barycenter',
    radius: 0, mass: M,
    appearance: { kind: 'none', seed: 0 },
  };
  const primary: BodyData = {
    ...root, parent: baryId,
    orbit: { ...o, a: (o.a * comp.mass) / M, argPeri: (o.argPeri + 180) % 360 },
  };
  const secondary: BodyData = {
    ...comp, parent: baryId,
    orbit: { ...o, a: (o.a * root.mass) / M },
  };
  return [bary, primary, secondary, ...bodies.filter((b) => b !== root && b !== comp)];
}

/** The other half of a barycentric pair (null when `b` does not orbit a barycentre) */
export function binaryPartner(b: CelestialBody): CelestialBody | null {
  const p = b.parent;
  if (!p || p.data.type !== 'barycenter') return null;
  return p.children.find((c) => c !== b) ?? null;
}
