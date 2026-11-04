/**
 * What the star catalogue and its tier worker share: the per-star flags, the 5 pc cell grid the
 * nearest-star queries use, the B−V guess for stars without a colour index, and the tier record.
 * Kept free of DOM and i18n imports so the worker can load it.
 */

/** A background-loaded slice of the catalogue (see scripts/build-catalog.mjs) */
export interface CatalogTier {
  file: string;
  first: number;
  count: number;
  label: string;
}

/** Flags (per star) */
export const STAR_NAMED = 1, STAR_WD = 2, STAR_PLANETS = 4, STAR_GAIA_DIST = 8, STAR_VELOCITY = 16;

/** Tier stars sorted into 5 pc cells (±2 kpc), for the nearest-star queries of free flight */
export const GRID_PC = 5;
export const GRID_HALF = 400;
export const GRID_SPAN = GRID_HALF * 2 + 1;

export function cell(v: number): number {
  return Math.max(-GRID_HALF, Math.min(GRID_HALF, Math.floor(v / GRID_PC))) + GRID_HALF;
}

export function cellKey(x: number, y: number, z: number): number {
  return (cell(x) * GRID_SPAN + cell(y)) * GRID_SPAN + cell(z);
}

const BV_BY_CLASS = [-0.33, -0.17, 0.0, 0.30, 0.58, 0.81, 1.40, 1.60];

/** B−V guess from spectral class (OBAFGKM index) and subclass when the catalogue lacks a colour index */
export function guessBv(cls: number, sub: number): number {
  const s = sub === 255 ? 5 : sub;
  if (cls > 7) return 0.65;
  const next = BV_BY_CLASS[Math.min(cls + 1, 7)];
  return BV_BY_CLASS[cls] + ((next - BV_BY_CLASS[cls]) * s) / 10;
}
