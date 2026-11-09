/**
 * The instruments of the telescope view. Visual ones are looked through with an eyepiece (a dark-
 * adapted eye, a circular field stop); research telescopes give a long-exposure detector image;
 * radio telescopes a map of brightness smoothed by their beam.
 */

export type ScopeMode = 'visual' | 'detector' | 'radio';

/** emission lines a filter passes: Hα, [O III], both (a dual-band filter), Hβ + [O III] (UHC) */
export type Line = 'ha' | 'oiii' | 'duo' | 'uhc';

export interface Filter {
  id: string;
  /** key into the strings, or a filter name shown as it is (F200W) */
  label: string;
  /** effective wavelength per picture channel (r, g, b), metres; one number: a single-filter grey image */
  lam: number | [number, number, number];
  /** a line filter: the continuum it lets through, against a broad band */
  line?: Line;
  cont?: number;
  /** visual: colour filter transmission per channel */
  t?: [number, number, number];
  /** detector: limiting magnitude against the instrument's reference band */
  dm?: number;
  /** detector: pixel scale (arcsec) and field (arcsec, the short side) of the camera behind it */
  pix?: number;
  fov?: number;
}

export interface Instrument {
  id: string;
  /** key into the strings (scopeStrings) */
  label: string;
  group: 'amateur' | 'commercial' | 'research' | 'space' | 'radio';
  /** a smart telescope: a camera that stacks short exposures, no eyepiece */
  smart?: boolean;
  /** above the atmosphere: no seeing, no extinction, any altitude */
  space?: boolean;
  mode: ScopeMode;
  /** aperture, mm */
  D: number;
  /** focal length, mm (visual) */
  F?: number;
  /** central obstruction, fraction of the diameter */
  obstruction: number;
  /** diffraction spikes: 0, 4 (spider vanes), 6 (hexagonal segments) */
  spikes: 0 | 4 | 6;
  /** visual: fixed magnification (eye, binoculars) */
  fixedMag?: number;
  /** visual: apparent field of the eyepiece, degrees */
  afov?: number;
  /** visual: image as seen: upright, rotated 180° (straight through), mirrored (star diagonal) */
  orient?: 'upright' | 'inverted' | 'mirrored';
  /** extra blur of the blue (and some of the red) light: residual colour of an achromat, arcsec at 100× */
  chroma?: number;
  /** detector / radio: observing wavelength, metres */
  lambda?: number;
  /** detector: adaptive optics, Strehl ratio delivered */
  strehl?: number;
  /** radio: synthesised / single-dish beam FWHM, arcsec */
  beam?: number;
  /** radio interferometer: largest angular scale it recovers, arcsec */
  las?: number;
  /** detector: limiting magnitude of a one-hour exposure in the reference band (ground: 1.2″ seeing, a dark site) */
  limit?: number;
  /** detector: default exposure, seconds; the longest one offered */
  exp?: number;
  expMax?: number;
  /** detector: pixel scale and field (the short side), arcsec */
  pix?: number;
  fov?: number;
  /** filters (detector), bands (radio), eyepiece filters (visual telescopes); the first is the default */
  filters?: Filter[];
  /** radio interferometer: array configurations, beam and largest scale ×k */
  configs?: Array<{ id: string; label: string; k: number; las: number }>;
}

const VIS: [number, number, number] = [610e-9, 550e-9, 460e-9];

/** eyepiece filters for any telescope */
const EYE_FILTERS: Filter[] = [
  { id: 'none', label: 'fNone', lam: VIS },
  { id: 'uhc', label: 'fUhc', lam: VIS, line: 'uhc', cont: 0.18, t: [0.35, 1, 0.9] },
  { id: 'oiii', label: 'fOiiiVis', lam: VIS, line: 'oiii', cont: 0.06, t: [0.15, 1, 0.75] },
  { id: 'w21', label: 'fW21', lam: VIS, t: [0.9, 0.5, 0.03] },
  { id: 'w80a', label: 'fW80a', lam: VIS, t: [0.12, 0.35, 0.8] },
];

/** a ground CCD camera, broad bands B V R I and Hα */
const CCD: Filter[] = [
  { id: 'rgb', label: 'fRgbBvr', lam: [650e-9, 550e-9, 440e-9] },
  { id: 'B', label: 'B', lam: 440e-9, dm: -0.2 },
  { id: 'V', label: 'V', lam: 550e-9 },
  { id: 'R', label: 'R', lam: 650e-9, dm: 0.1 },
  { id: 'I', label: 'I', lam: 800e-9, dm: -0.4 },
  { id: 'ha', label: 'fHaNb', lam: 656e-9, line: 'ha', cont: 0.03, dm: -3.2 },
];

/** a near-infrared camera behind adaptive optics */
const AO_IR: Filter[] = [
  { id: 'jhk', label: 'fRgbJhk', lam: [2.15e-6, 1.65e-6, 1.25e-6] },
  { id: 'J', label: 'J', lam: 1.25e-6, dm: 0.6 },
  { id: 'H', label: 'H', lam: 1.65e-6, dm: 0.3 },
  { id: 'Ks', label: 'Ks', lam: 2.15e-6 },
];

const SMART: Filter[] = [
  { id: 'rgb', label: 'fUvIr', lam: VIS },
  { id: 'duo', label: 'fDuo', lam: VIS, line: 'duo', cont: 0.06, dm: -2.6 },
];

export const INSTRUMENTS: Instrument[] = [
  { id: 'eye', label: 'iEye', group: 'amateur', mode: 'visual', D: 7, obstruction: 0, spikes: 0, fixedMag: 1, afov: 50, orient: 'upright' },
  { id: 'bino', label: 'iBino', group: 'amateur', mode: 'visual', D: 50, obstruction: 0, spikes: 0, fixedMag: 10, afov: 65, orient: 'upright' },
  { id: 'ach70', label: 'iAch70', group: 'amateur', mode: 'visual', D: 70, F: 700, obstruction: 0, spikes: 0, afov: 52, orient: 'mirrored', chroma: 1.1, filters: EYE_FILTERS },
  { id: 'apo100', label: 'iApo100', group: 'amateur', mode: 'visual', D: 100, F: 700, obstruction: 0, spikes: 0, afov: 62, orient: 'mirrored', filters: EYE_FILTERS },
  { id: 'mak127', label: 'iMak127', group: 'amateur', mode: 'visual', D: 127, F: 1500, obstruction: 0.3, spikes: 0, afov: 52, orient: 'mirrored', filters: EYE_FILTERS },
  { id: 'newt130', label: 'iNewt130', group: 'amateur', mode: 'visual', D: 130, F: 650, obstruction: 0.25, spikes: 4, afov: 62, orient: 'inverted', filters: EYE_FILTERS },
  { id: 'sct203', label: 'iSct203', group: 'amateur', mode: 'visual', D: 203, F: 2032, obstruction: 0.34, spikes: 0, afov: 62, orient: 'mirrored', filters: EYE_FILTERS },
  { id: 'dob305', label: 'iDob305', group: 'amateur', mode: 'visual', D: 305, F: 1500, obstruction: 0.2, spikes: 4, afov: 68, orient: 'inverted', filters: EYE_FILTERS },
  { id: 'dob406', label: 'iDob406', group: 'amateur', mode: 'visual', D: 406, F: 1800, obstruction: 0.2, spikes: 4, afov: 68, orient: 'inverted', filters: EYE_FILTERS },
  // popular models, with their makers' figures
  { id: 'astromaster70', label: 'cAstroMaster70', group: 'commercial', mode: 'visual', D: 70, F: 900, obstruction: 0, spikes: 0, afov: 52, orient: 'mirrored', chroma: 0.8, filters: EYE_FILTERS },
  { id: 'heritage130', label: 'cHeritage130', group: 'commercial', mode: 'visual', D: 130, F: 650, obstruction: 0.27, spikes: 4, afov: 52, orient: 'inverted', filters: EYE_FILTERS },
  { id: 'skymax102', label: 'cSkymax102', group: 'commercial', mode: 'visual', D: 102, F: 1300, obstruction: 0.32, spikes: 0, afov: 52, orient: 'mirrored', filters: EYE_FILTERS },
  { id: 'nexstar127', label: 'cNexStar127', group: 'commercial', mode: 'visual', D: 127, F: 1500, obstruction: 0.3, spikes: 0, afov: 52, orient: 'mirrored', filters: EYE_FILTERS },
  { id: 'evostar80', label: 'cEvostar80', group: 'commercial', mode: 'visual', D: 80, F: 600, obstruction: 0, spikes: 0, afov: 52, orient: 'mirrored', chroma: 0.15, filters: EYE_FILTERS },
  { id: 'skyliner200', label: 'cSkyliner200', group: 'commercial', mode: 'visual', D: 200, F: 1200, obstruction: 0.24, spikes: 4, afov: 52, orient: 'inverted', filters: EYE_FILTERS },
  { id: 'nexstar8se', label: 'cNexStar8', group: 'commercial', mode: 'visual', D: 203, F: 2032, obstruction: 0.34, spikes: 0, afov: 52, orient: 'mirrored', filters: EYE_FILTERS },
  { id: 'skyliner250', label: 'cSkyliner250', group: 'commercial', mode: 'visual', D: 254, F: 1200, obstruction: 0.24, spikes: 4, afov: 52, orient: 'inverted', filters: EYE_FILTERS },
  { id: 'cpc1100', label: 'cCpc1100', group: 'commercial', mode: 'visual', D: 280, F: 2800, obstruction: 0.34, spikes: 0, afov: 52, orient: 'mirrored', filters: EYE_FILTERS },
  { id: 'skymaster15', label: 'cSkyMaster15', group: 'commercial', mode: 'visual', D: 70, obstruction: 0, spikes: 0, fixedMag: 15, afov: 66, orient: 'upright' },
  { id: 'seestar', label: 'cSeestar', group: 'commercial', smart: true, mode: 'detector', D: 50, F: 250, obstruction: 0, spikes: 0, lambda: 550e-9, limit: 18.8, exp: 1200, expMax: 4 * 3600, pix: 2.39, fov: 2630, filters: SMART },
  { id: 'vespera', label: 'cVespera', group: 'commercial', smart: true, mode: 'detector', D: 50, F: 250, obstruction: 0, spikes: 0, lambda: 550e-9, limit: 18.8, exp: 1200, expMax: 4 * 3600, pix: 1.45, fov: 5040, filters: SMART },
  { id: 'evscope', label: 'cEvscope', group: 'commercial', smart: true, mode: 'detector', D: 114, F: 450, obstruction: 0.3, spikes: 4, lambda: 550e-9, limit: 19.9, exp: 1200, expMax: 4 * 3600, pix: 1.33, fov: 2040, filters: [SMART[0]] },
  { id: 'hale', label: 'iHale', group: 'research', mode: 'detector', D: 5080, obstruction: 0.36, spikes: 4, lambda: 550e-9, limit: 25, exp: 600, expMax: 10 * 3600, pix: 0.18, fov: 1200, filters: CCD },
  { id: 'vlt', label: 'iVlt', group: 'research', mode: 'detector', D: 8200, obstruction: 0.14, spikes: 4, lambda: 2.2e-6, strehl: 0.45, limit: 23.3, exp: 1800, expMax: 10 * 3600, pix: 0.027, fov: 28, filters: AO_IR },
  { id: 'keck', label: 'iKeck', group: 'research', mode: 'detector', D: 10000, obstruction: 0.24, spikes: 6, lambda: 2.2e-6, strehl: 0.4, limit: 23.8, exp: 1800, expMax: 10 * 3600, pix: 0.01, fov: 10, filters: AO_IR },
  {
    id: 'hubble', label: 'iHubble', group: 'space', mode: 'detector', D: 2400, obstruction: 0.33, spikes: 4, lambda: 600e-9, strehl: 0.8, limit: 28.2,
    exp: 2400, expMax: 1e6, pix: 0.04, fov: 162, space: true,
    filters: [
      { id: 'rgb', label: 'fRgbHst', lam: [814e-9, 555e-9, 435e-9] },
      { id: 'F336W', label: 'F336W', lam: 336e-9, dm: -1.4 },
      { id: 'F435W', label: 'F435W', lam: 435e-9, dm: -0.3 },
      { id: 'F555W', label: 'F555W', lam: 555e-9 },
      { id: 'F814W', label: 'F814W', lam: 814e-9, dm: -0.2 },
      { id: 'F656N', label: 'F656N', lam: 656e-9, line: 'ha', cont: 0.012, dm: -4.4 },
      { id: 'F502N', label: 'F502N', lam: 502e-9, line: 'oiii', cont: 0.012, dm: -4.4 },
      { id: 'F160W', label: 'F160W', lam: 1.54e-6, dm: -0.1, pix: 0.13, fov: 123 },
    ],
  },
  {
    id: 'jwst', label: 'iJwst', group: 'space', mode: 'detector', D: 6500, obstruction: 0.11, spikes: 6, lambda: 2e-6, strehl: 0.85, limit: 29.3,
    exp: 2000, expMax: 1e6, pix: 0.031, fov: 260, space: true,
    filters: [
      { id: 'rgb', label: 'fRgbJwst', lam: [4.44e-6, 2e-6, 0.9e-6], pix: 0.063 },
      { id: 'F090W', label: 'F090W', lam: 0.9e-6, dm: -0.4 },
      { id: 'F150W', label: 'F150W', lam: 1.5e-6 },
      { id: 'F200W', label: 'F200W', lam: 2e-6 },
      { id: 'F277W', label: 'F277W', lam: 2.77e-6, pix: 0.063 },
      { id: 'F356W', label: 'F356W', lam: 3.56e-6, dm: -0.1, pix: 0.063 },
      { id: 'F444W', label: 'F444W', lam: 4.44e-6, dm: -0.5, pix: 0.063 },
      { id: 'F770W', label: 'fMiri', lam: 7.7e-6, dm: -4.5, pix: 0.11, fov: 74 },
    ],
  },
  { id: 'fast', label: 'iFast', group: 'radio', mode: 'radio', D: 300_000, obstruction: 0, spikes: 0, lambda: 0.21, beam: 174 },
  {
    id: 'effelsberg', label: 'iEffelsberg', group: 'radio', mode: 'radio', D: 100_000, obstruction: 0, spikes: 0, lambda: 0.21, beam: 530,
    filters: [{ id: 'L', label: 'bL', lam: 0.21 }, { id: 'C', label: 'bC', lam: 0.06 }, { id: 'K', label: 'bK', lam: 0.013 }],
  },
  {
    id: 'vla', label: 'iVla', group: 'radio', mode: 'radio', D: 36_400_000, obstruction: 0, spikes: 0, lambda: 0.21, beam: 1.3, las: 36,
    filters: [{ id: 'L', label: 'bL', lam: 0.21 }, { id: 'C', label: 'bC', lam: 0.06 }, { id: 'X', label: 'bX', lam: 0.03 }, { id: 'K', label: 'bK', lam: 0.013 }, { id: 'Q', label: 'bQ', lam: 0.007 }],
    configs: [{ id: 'A', label: 'vA', k: 1, las: 1 }, { id: 'B', label: 'vB', k: 3.3, las: 3.3 }, { id: 'C', label: 'vC', k: 10.8, las: 27 }, { id: 'D', label: 'vD', k: 35, las: 27 }],
  },
  {
    id: 'alma', label: 'iAlma', group: 'radio', mode: 'radio', D: 1_400_000, obstruction: 0, spikes: 0, lambda: 1.3e-3, beam: 0.25, las: 3.5,
    filters: [{ id: '6', label: 'bAlma6', lam: 1.3e-3 }, { id: '3', label: 'bAlma3', lam: 3e-3 }, { id: '7', label: 'bAlma7', lam: 0.87e-3 }, { id: '9', label: 'bAlma9', lam: 0.45e-3 }],
  },
  { id: 'eht', label: 'iEht', group: 'radio', mode: 'radio', D: 10_700_000_000, obstruction: 0, spikes: 0, lambda: 1.3e-3, beam: 25e-6, las: 150e-6 },
];

export const instrument = (id: string): Instrument => INSTRUMENTS.find((i) => i.id === id) ?? INSTRUMENTS[0];

/** a 1¼″ eyepiece case: focal length (mm), apparent field (°), design */
export const EYEPIECES: Array<{ f: number; afov: number; kind: 'epPlossl' | 'epWide' | 'epUltra' }> = [
  { f: 40, afov: 43, kind: 'epPlossl' }, { f: 32, afov: 50, kind: 'epPlossl' }, { f: 25, afov: 52, kind: 'epPlossl' },
  { f: 20, afov: 68, kind: 'epWide' }, { f: 15, afov: 52, kind: 'epPlossl' }, { f: 12, afov: 68, kind: 'epWide' },
  { f: 10, afov: 52, kind: 'epPlossl' }, { f: 8, afov: 68, kind: 'epWide' }, { f: 6, afov: 68, kind: 'epWide' },
  { f: 4.7, afov: 82, kind: 'epUltra' }, { f: 3.5, afov: 82, kind: 'epUltra' },
];

/** visible linear r, g, b → one band at λ (metres): interpolated in log λ, extrapolated a little; Sun-coloured light → 1 */
export function bandWeights(lam: number): [number, number, number] {
  const L = Math.log(lam);
  const lr = Math.log(610e-9), lg = Math.log(550e-9), lb = Math.log(460e-9);
  let w: [number, number, number];
  if (L >= lr) { const s = 1.3 * Math.tanh((L - lr) / 1.2); w = [1 + s, -s, 0]; }
  else if (L >= lg) { const s = (L - lg) / (lr - lg); w = [s, 1 - s, 0]; }
  else if (L >= lb) { const s = (L - lb) / (lg - lb); w = [0, s, 1 - s]; }
  else { const s = Math.min(1, (lb - L) / (lg - lb)); w = [0, -s, 1 + s]; }
  // the Sun's colour in linear sRGB (B−V 0.65), luminance 1
  const sun = [1.16, 0.98, 0.79];
  const k = w[0] * sun[0] + w[1] * sun[1] + w[2] * sun[2];
  return [w[0] / k, w[1] / k, w[2] / k];
}

/** visual: naked-eye limiting magnitude at the zenith for a Bortle class */
const NELM = [7.6, 7.1, 6.6, 6.3, 5.9, 5.5, 5.0, 4.5, 4.0];
/** visual: sky surface brightness, V mag/arcsec², per Bortle class */
export const SKY_MU = [22.0, 21.9, 21.7, 21.3, 20.8, 20.3, 19.5, 18.9, 18.0];

/** faintest star the instrument shows (visual: with the sky and the extinction) */
export function limitingMag(ins: Instrument, bortle: number, extinction: number, magnification: number): number {
  if (ins.mode === 'detector') return (ins.limit ?? 22) - extinction;
  if (ins.mode === 'radio') return -Infinity;
  const nelm = NELM[Math.max(0, Math.min(8, bortle - 1))];
  if (ins.id === 'eye') return nelm - extinction;
  // the aperture's light grasp, and a darker background at higher power (up to ~1 mag)
  const exitPupil = ins.D / magnification;
  const darker = Math.min(1.2, Math.max(0, 2.5 * Math.log10(7 / Math.max(exitPupil, 0.5)) * 0.35));
  return nelm + 5 * Math.log10(ins.D / 7) - 0.5 + darker - extinction;
}

/** visual: the magnification range an eyepiece set gives (exit pupil 7 mm … 0.5 mm, capped at 600×) */
export function magRange(ins: Instrument): [number, number] {
  if (ins.fixedMag) return [ins.fixedMag, ins.fixedMag];
  return [Math.max(1, Math.ceil(ins.D / 7)), Math.min(600, Math.round(ins.D * 2))];
}

/** Kasten & Young air mass */
export function airmass(altDeg: number): number {
  return 1 / (Math.sin(altDeg * Math.PI / 180) + 0.50572 * (altDeg + 6.07995) ** -1.6364);
}
