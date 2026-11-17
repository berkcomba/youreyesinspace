import { Vector3 } from 'three';
import { raDecToScene } from '../math/frames';
import { galacticToScene } from '../galaxy/frames';

/**
 * Sky coordinates of positions in the scene frame (parsecs from the Sun): equatorial (J2000 RA /
 * Dec) and galactic (l / b), both ways, and a parser for what people type into the search box.
 */

const RAD = 180 / Math.PI;
// the scene images of the frames' axes: a direction's components along them are its x, y, z there
const EQ = [raDecToScene(0, 0), raDecToScene(90, 0), raDecToScene(0, 90)];
const GAL = [galacticToScene(0, 0), galacticToScene(Math.PI / 2, 0), galacticToScene(0, Math.PI / 2)];   // (radians)

function angles(dir: Vector3, axes: Vector3[]): [number, number] {
  const n = dir.length() || 1;
  const x = dir.dot(axes[0]) / n, y = dir.dot(axes[1]) / n, z = dir.dot(axes[2]) / n;
  return [((Math.atan2(y, x) * RAD) + 360) % 360, Math.asin(Math.max(-1, Math.min(1, z))) * RAD];
}

/** [RA°, Dec°] of a scene-frame direction */
export function sceneToRaDec(dir: Vector3): [number, number] { return angles(dir, EQ); }
/** [l°, b°] of a scene-frame direction */
export function sceneToGalactic(dir: Vector3): [number, number] { return angles(dir, GAL); }

const pad = (x: number, w: number, d = 0) => x.toFixed(d).padStart(w + (d ? d + 1 : 0), '0');

/** 05h 35m 17.3s  −05° 23′ 28″ */
export function fmtRaDec(ra: number, dec: number): string {
  let s = Math.round((ra / 15) * 36000) / 10;   // tenths of a second of time
  const h = Math.floor(s / 3600) % 24; s -= Math.floor(s / 3600) * 3600;
  const m = Math.floor(s / 60); s -= m * 60;
  const sign = dec < 0 ? '−' : '+';
  let a = Math.round(Math.abs(dec) * 3600);
  const d = Math.floor(a / 3600); a -= d * 3600;
  const am = Math.floor(a / 60); a -= am * 60;
  return `${pad(h, 2)}h ${pad(m, 2)}m ${pad(s, 2, 1)}s  ${sign}${pad(d, 2)}° ${pad(am, 2)}′ ${pad(a, 2)}″`;
}

/** l 209.01°  b −19.38° */
export function fmtGalactic(l: number, b: number): string {
  return `l ${l.toFixed(2)}°  b ${b < 0 ? '−' : '+'}${Math.abs(b).toFixed(2)}°`;
}

export interface SkyQuery {
  /** unit direction, scene frame */
  dir: Vector3;
  ra: number;
  dec: number;
  l: number;
  b: number;
  /** distance from the Sun when one was given */
  distPc: number | null;
}

const UNIT_PC: Record<string, number> = { pc: 1, kpc: 1e3, mpc: 1e6, gpc: 1e9, ly: 1 / 3.26156, kly: 1e3 / 3.26156, mly: 1e6 / 3.26156, gly: 1e9 / 3.26156, ıy: 1 / 3.26156, iy: 1 / 3.26156 };

/** one sexagesimal or decimal angle: "05h35m17s", "5:35:17", "05 35 17", "-05°23'28\"", "83.82" */
function angle(s: string, hours: boolean): number | null {
  const t = s.trim().replace(/[−–]/g, '-').replace(/,/g, '.');
  const neg = t.startsWith('-');
  const parts = t.replace(/^[+-]/, '').split(/[hdms°′″'":\s]+/i).filter(Boolean).map(Number);
  if (!parts.length || parts.length > 3 || parts.some((x) => !Number.isFinite(x))) return null;
  const v = parts[0] + (parts[1] ?? 0) / 60 + (parts[2] ?? 0) / 3600;
  const sexHours = hours && (/[h:]/i.test(t) || parts.length > 1);
  return (neg ? -1 : 1) * (sexHours ? v * 15 : v);
}

/**
 * Parse a coordinate query. Understood:
 *   RA/Dec   "83.82 -5.39", "RA 83.82 Dec -5.39", "05h35m17s -05°23'28\"", "5:35:17 -5:23:28", "05 35 17 -05 23 28"
 *   galactic "l 209 b -19.4", "l=209.0 b=-19.4", "gal 209 -19.4", "G209.01-19.38"
 * each optionally followed by a distance: "1.3 kpc", "1344 ly", "412 pc", "16.5 Mpc".
 */
export function parseSkyQuery(raw: string): SkyQuery | null {
  let q = raw.trim().toLowerCase().replace(/[−–]/g, '-');
  if (!q || !/\d/.test(q)) return null;
  // distance suffix
  let distPc: number | null = null;
  const dm = /(?:^|\s|,)(\d+(?:[.,]\d+)?)\s*(gpc|mpc|kpc|pc|gly|mly|kly|ly|ıy|iy)\s*$/.exec(q);
  if (dm) { distPc = parseFloat(dm[1].replace(',', '.')) * UNIT_PC[dm[2]]; q = q.slice(0, dm.index).trim().replace(/,$/, ''); }
  // galactic: "G209.01-19.38" (the survey designation form)
  let m = /^g(\d{1,3}(?:\.\d+)?)([+-]\d{1,2}(?:\.\d+)?)$/.exec(q.replace(/\s+/g, ''));
  let l: number | null = null, b: number | null = null, ra: number | null = null, dec: number | null = null;
  if (m) { l = parseFloat(m[1]); b = parseFloat(m[2]); }
  else if ((m = /^(?:gal(?:actic|aktik)?\s+|l\s*=?\s*)([+-]?\d+(?:[.,]\d+)?)[\s,;]+(?:b\s*=?\s*)?([+-]?\d+(?:[.,]\d+)?)$/.exec(q))) {
    l = parseFloat(m[1].replace(',', '.')); b = parseFloat(m[2].replace(',', '.'));
  } else {
    q = q.replace(/^(?:ra|rektasensiyon|sağ açıklık|sag aciklik)\s*=?\s*/, '');
    // split RA from Dec at "dec", a comma or semicolon, or the sign of the declination
    let ras: string | null = null, decs: string | null = null;
    const byWord = /^(.+?)\s*(?:dec|dek|δ|deklinasyon)\s*=?\s*(.+)$/.exec(q);
    const bySep = /^(.+?)\s*[;,]\s*(.+)$/.exec(q);
    const bySign = /^(.+?)\s+([+-].+)$/.exec(q);
    if (byWord) { ras = byWord[1]; decs = byWord[2]; }
    else if (bySep && /\d\s*$/.test(bySep[1])) { ras = bySep[1]; decs = bySep[2]; }
    else if (bySign) { ras = bySign[1]; decs = bySign[2]; }
    else {
      // unsigned: "83.82 5.39" or "05 35 17 05 23 28" (split in half)
      const w = q.split(/\s+/);
      if (w.length === 2 || w.length === 4 || w.length === 6) { ras = w.slice(0, w.length / 2).join(' '); decs = w.slice(w.length / 2).join(' '); }
    }
    if (ras === null || decs === null) return null;
    // a single decimal for RA is degrees unless it has an hour mark; sexagesimal RA is hours
    ra = angle(ras, true); dec = angle(decs, false);
    if (ra === null || dec === null) return null;
  }
  if (l !== null && b !== null) {
    if (b < -90 || b > 90) return null;
    l = ((l % 360) + 360) % 360;
    const dir = galacticToScene(l / RAD, b / RAD).normalize();
    [ra, dec] = sceneToRaDec(dir);
    return { dir, ra, dec, l, b, distPc };
  }
  if (ra === null || dec === null || dec < -90 || dec > 90 || ra < 0 || ra > 360) return null;
  const dir = raDecToScene(ra, dec).normalize();
  [l, b] = sceneToGalactic(dir);
  return { dir, ra, dec, l, b, distPc };
}
