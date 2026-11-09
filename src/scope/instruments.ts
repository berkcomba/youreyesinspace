/**
 * The instruments of the telescope view. Visual ones are looked through with an eyepiece (a dark-
 * adapted eye, a circular field stop); research telescopes give a long-exposure detector image;
 * radio telescopes a map of brightness smoothed by their beam.
 */

export type ScopeMode = 'visual' | 'detector' | 'radio';

export interface Instrument {
  id: string;
  /** key into the strings (scopeStrings) */
  label: string;
  group: 'amateur' | 'research' | 'radio';
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
  /** detector: limiting magnitude of the exposure */
  limit?: number;
}

export const INSTRUMENTS: Instrument[] = [
  { id: 'eye', label: 'iEye', group: 'amateur', mode: 'visual', D: 7, obstruction: 0, spikes: 0, fixedMag: 1, afov: 50, orient: 'upright' },
  { id: 'bino', label: 'iBino', group: 'amateur', mode: 'visual', D: 50, obstruction: 0, spikes: 0, fixedMag: 10, afov: 65, orient: 'upright' },
  { id: 'ach70', label: 'iAch70', group: 'amateur', mode: 'visual', D: 70, F: 700, obstruction: 0, spikes: 0, afov: 52, orient: 'mirrored', chroma: 1.1 },
  { id: 'apo100', label: 'iApo100', group: 'amateur', mode: 'visual', D: 100, F: 700, obstruction: 0, spikes: 0, afov: 62, orient: 'mirrored' },
  { id: 'mak127', label: 'iMak127', group: 'amateur', mode: 'visual', D: 127, F: 1500, obstruction: 0.3, spikes: 0, afov: 52, orient: 'mirrored' },
  { id: 'newt130', label: 'iNewt130', group: 'amateur', mode: 'visual', D: 130, F: 650, obstruction: 0.25, spikes: 4, afov: 62, orient: 'inverted' },
  { id: 'sct203', label: 'iSct203', group: 'amateur', mode: 'visual', D: 203, F: 2032, obstruction: 0.34, spikes: 0, afov: 62, orient: 'mirrored' },
  { id: 'dob305', label: 'iDob305', group: 'amateur', mode: 'visual', D: 305, F: 1500, obstruction: 0.2, spikes: 4, afov: 68, orient: 'inverted' },
  { id: 'dob406', label: 'iDob406', group: 'amateur', mode: 'visual', D: 406, F: 1800, obstruction: 0.2, spikes: 4, afov: 68, orient: 'inverted' },
  { id: 'hale', label: 'iHale', group: 'research', mode: 'detector', D: 5080, obstruction: 0.36, spikes: 4, lambda: 550e-9, limit: 23.5 },
  { id: 'vlt', label: 'iVlt', group: 'research', mode: 'detector', D: 8200, obstruction: 0.14, spikes: 4, lambda: 2.2e-6, strehl: 0.45, limit: 24 },
  { id: 'keck', label: 'iKeck', group: 'research', mode: 'detector', D: 10000, obstruction: 0.24, spikes: 6, lambda: 2.2e-6, strehl: 0.4, limit: 24.5 },
  { id: 'fast', label: 'iFast', group: 'radio', mode: 'radio', D: 300_000, obstruction: 0, spikes: 0, lambda: 0.21, beam: 174 },
  { id: 'effelsberg', label: 'iEffelsberg', group: 'radio', mode: 'radio', D: 100_000, obstruction: 0, spikes: 0, lambda: 0.21, beam: 530 },
  { id: 'vla', label: 'iVla', group: 'radio', mode: 'radio', D: 36_400_000, obstruction: 0, spikes: 0, lambda: 0.21, beam: 1.3, las: 36 },
  { id: 'alma', label: 'iAlma', group: 'radio', mode: 'radio', D: 1_400_000, obstruction: 0, spikes: 0, lambda: 1.3e-3, beam: 0.25, las: 3.5 },
  { id: 'eht', label: 'iEht', group: 'radio', mode: 'radio', D: 10_700_000_000, obstruction: 0, spikes: 0, lambda: 1.3e-3, beam: 25e-6, las: 150e-6 },
];

export const instrument = (id: string): Instrument => INSTRUMENTS.find((i) => i.id === id) ?? INSTRUMENTS[0];

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
