/**
 * A pick candidate: what a click near a drawn object would hit. Every picker reports what it
 * actually draws (size on screen, alpha) so candidates from different layers compare fairly.
 */
export interface PickHit<T> {
  value: T;
  /** screen distance from the click to the object's centre (px) */
  dist: number;
  /** how far from the centre a click still counts (drawn radius + finger/mouse slack, px) */
  reach: number;
  /** how visible the object is as drawn (0–1) */
  vis: number;
  /** extended object (nebula, galaxy disc): a point source right under the cursor beats it */
  extended?: boolean;
}

/** Objects drawn fainter than this are not clickable: what you can't see you can't hit */
export const PICK_MIN_VIS = 0.04;

/** Lower is better. Distance relative to reach, with brighter and compact objects preferred. */
export function pickScore(h: PickHit<unknown>): number {
  return h.dist / h.reach + (1 - Math.min(1, h.vis)) * 0.35 + (h.extended ? 0.25 : 0);
}

export function better<T>(a: PickHit<T> | null, b: PickHit<T> | null): PickHit<T> | null {
  if (!a) return b;
  if (!b) return a;
  return pickScore(b) < pickScore(a) ? b : a;
}

/** Drawn point-star diameter (px) and alpha for a flux, as in stars.vert */
export function starLook(m: number): { size: number; alpha: number } {
  const flux = Math.pow(10, -0.4 * m);
  return { size: Math.min(30, 1.3 + 3 * Math.pow(flux, 0.4)), alpha: Math.min(1, 0.16 + 0.9 * Math.pow(flux, 0.45)) };
}
