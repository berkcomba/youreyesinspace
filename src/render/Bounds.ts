import { type BufferGeometry, Sphere, Vector3 } from 'three';

/**
 * Give a geometry that is never frustum-culled (sky-filling point clouds, belts, generated stars)
 * a nominal bounding sphere up front. The renderer's depth sort asks every object for its sphere
 * centre, and computing it over a hundred thousand points is a stall in the very frame the
 * geometry first appears in — a system switch, a new star cell.
 */
export function presetBounds(geo: BufferGeometry, radius = 1e15): BufferGeometry {
  geo.boundingSphere = new Sphere(new Vector3(), radius);
  return geo;
}
