/**
 * Stellar physics helpers: turning catalogue observables (apparent magnitude, distance, B-V)
 * into approximate physical parameters used for rendering and system generation.
 */

export const SUN_TEMPERATURE_K = 5772;
export const SUN_RADIUS_KM = 695_700;
export const SUN_MASS_KG = 1.9885e30;
export const SUN_ABS_MAG = 4.83;

/** B-V colour index → effective temperature (Ballesteros 2012) */
export function bvToTemperature(bv: number): number {
  const b = Math.min(Math.max(bv, -0.4), 2.2);
  return 4600 * (1 / (0.92 * b + 1.7) + 1 / (0.92 * b + 0.62));
}

/** Absolute visual magnitude from apparent magnitude and distance (pc) */
export function absoluteMagnitude(mag: number, distPc: number): number {
  return mag - 5 * Math.log10(Math.max(distPc, 1e-6) / 10);
}

/** Bolometric correction (Reed 1998 polynomial) */
export function bolometricCorrection(T: number): number {
  const x = Math.log10(Math.max(T, 1500)) - 4;
  return -8.499 * x ** 4 + 13.421 * x ** 3 - 8.131 * x ** 2 - 3.901 * x - 0.438;
}

/** Bolometric luminosity in solar units */
export function luminosityFromAbsMag(absMagV: number, T: number): number {
  const mBol = absMagV + bolometricCorrection(T);
  return Math.pow(10, (4.74 - mBol) / 2.5);
}

/** Radius in solar radii from luminosity and temperature (Stefan–Boltzmann) */
export function radiusFromLuminosity(lumSolar: number, T: number): number {
  return Math.sqrt(lumSolar) * Math.pow(SUN_TEMPERATURE_K / T, 2);
}

/**
 * Rough mass estimate (solar masses). Main sequence: mass–luminosity relation;
 * giants and supergiants: capped so the orbital periods stay plausible.
 */
export function massFromLuminosity(lumSolar: number, lumClass: number): number {
  let m: number;
  if (lumSolar < 0.03) m = Math.pow(lumSolar / 0.23, 1 / 2.3);
  else if (lumSolar < 16) m = Math.pow(lumSolar, 1 / 4);
  else if (lumSolar < 54_000) m = Math.pow(lumSolar / 1.4, 1 / 3.5);
  else m = lumSolar / 32_000;
  if (lumClass >= 1 && lumClass <= 3) m = Math.min(Math.max(m, 1.2), 25);
  return Math.min(Math.max(m, 0.075), 80);
}

/** Temperature → spectral class letter + subclass, e.g. "G2" */
export function spectralFromTemperature(T: number): string {
  const table: Array<[number, number, string]> = [
    [30000, 60000, 'O'], [10000, 30000, 'B'], [7500, 10000, 'A'], [6000, 7500, 'F'],
    [5200, 6000, 'G'], [3700, 5200, 'K'], [2000, 3700, 'M'],
  ];
  for (const [lo, hi, cls] of table) {
    if (T >= lo && T < hi) {
      const sub = Math.min(9, Math.max(0, Math.floor(((hi - T) / (hi - lo)) * 10)));
      return `${cls}${sub}`;
    }
  }
  return T >= 60000 ? 'O0' : 'M9';
}

export const LUM_CLASS_LABEL: Record<number, string> = {
  1: 'I', 2: 'II', 3: 'III', 4: 'IV', 5: 'V',
};

export const LUM_CLASS_DESC: Record<number, string> = {
  1: 'Süperdev', 2: 'Parlak dev', 3: 'Dev', 4: 'Alt dev', 5: 'Anakol (cüce)',
};

/** Temperature (K) → linear RGB (approximate blackbody, normalised so max channel = 1) */
export function temperatureToRgb(T: number): [number, number, number] {
  T = Math.min(Math.max(T, 1000), 40000) / 100;
  let r: number, g: number, b: number;
  if (T <= 66) {
    r = 1;
    g = Math.min(Math.max((99.4708025861 * Math.log(T) - 161.1195681661) / 255, 0), 1);
    b = T <= 19 ? 0 : Math.min(Math.max((138.5177312231 * Math.log(T - 10) - 305.0447927307) / 255, 0), 1);
  } else {
    r = Math.min(Math.max((329.698727446 * Math.pow(T - 60, -0.1332047592)) / 255, 0), 1);
    g = Math.min(Math.max((288.1221695283 * Math.pow(T - 60, -0.0755148492)) / 255, 0), 1);
    b = 1;
  }
  return [r, g, b];
}

export function bvToRgb(bv: number): [number, number, number] {
  return temperatureToRgb(bvToTemperature(bv));
}

/**
 * Light colour a star casts on its planets, normalised so a G2V star gives ~white.
 * Saturation is exaggerated a little so red dwarfs read as orange-lit worlds.
 */
export function starLightColor(T: number): [number, number, number] {
  const [r, g, b] = temperatureToRgb(T);
  const [sr, sg, sb] = temperatureToRgb(SUN_TEMPERATURE_K);
  const out: [number, number, number] = [r / sr, g / sg, b / sb];
  const mx = Math.max(out[0], out[1], out[2]);
  // Eyes adapt to the dominant light: keep only ~60 % of the tint so surfaces stay readable
  for (let i = 0; i < 3; i++) out[i] = 1 - 0.6 * (1 - out[i] / mx);
  return out;
}
