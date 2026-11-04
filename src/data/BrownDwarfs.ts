import type { HostStarOverride } from './blackholes';

/**
 * L, T and Y dwarfs of the UltracoolSheet (public/data/browndwarfs.json, written by
 * scripts/build-catalog.mjs). Each row points at its catalogue star; the measured spectral type
 * replaces the photometric guess, and temperature, mass and radius follow from it.
 */

/** catalogue index, spectral type, numeric type (10 = L0, 20 = T0, 30 = Y0), young, parallax distance */
export type BrownDwarfRow = [number, string, number, 0 | 1, 0 | 1];

export interface BrownDwarfData {
  source: string;
  rows: BrownDwarfRow[];
}

export async function loadBrownDwarfs(baseUrl: string): Promise<BrownDwarfData> {
  const res = await fetch(`${baseUrl}data/browndwarfs.json?v=${__BUILD_ID__}`);
  if (!res.ok) throw new Error(`browndwarfs.json: ${res.status}`);
  return res.json() as Promise<BrownDwarfData>;
}

/** effective temperature (K) by numeric type: Filippazzo et al. 2015, Kirkpatrick et al. 2021 */
const TEFF: Array<[number, number]> = [
  [10, 2300], [12, 2050], [14, 1800], [16, 1600], [18, 1450], [20, 1300], [22, 1200],
  [24, 1100], [26, 950], [28, 750], [30, 450], [32, 380], [34, 300],
];
/** mass (M☉) of a field-age (a few Gyr) dwarf by numeric type: evolutionary models at the temperatures above */
const FIELD_MASS: Array<[number, number]> = [[10, 0.08], [14, 0.072], [18, 0.065], [22, 0.06], [26, 0.05], [28, 0.04], [30, 0.02], [34, 0.01]];

function interp(table: Array<[number, number]>, x: number): number {
  if (x <= table[0][0]) return table[0][1];
  for (let i = 1; i < table.length; i++) {
    if (x <= table[i][0]) {
      const [x0, y0] = table[i - 1], [x1, y1] = table[i];
      return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
    }
  }
  return table[table.length - 1][1];
}

/** Hydrogen burning needs ≳ 0.075 M☉; below it the object is a brown dwarf */
export const HYDROGEN_BURNING_LIMIT = 0.075;

export interface BrownDwarf {
  spectral: string;
  /** numeric type (10 = L0, 20 = T0, 30 = Y0) */
  type: number;
  young: boolean;
  override: HostStarOverride;
}

export function brownDwarf(row: BrownDwarfRow): BrownDwarf {
  const [, sptText, type, young] = row;
  const temperature = interp(TEFF, type);
  // young (< ~300 Myr) objects of the same type are cooler for their mass: lighter, and still contracting
  const massSolar = Math.max(0.004, interp(FIELD_MASS, type) * (young ? 0.3 : 1));
  const radiusSolar = young ? 0.15 : 0.1;
  const spectral = sptText || `${'MLTY'[Math.floor(type / 10)] ?? 'Y'}${type % 10}`;
  return {
    spectral, type, young: !!young,
    override: { massSolar, radiusSolar, temperature, luminosity: radiusSolar * radiusSolar * Math.pow(temperature / 5772, 4), spectral },
  };
}
