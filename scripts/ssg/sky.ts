import { CONSTELLATIONS, boundaryTable, toB1875, unitRaDec } from './astro';
import type { CoreCatalog } from './catalog';

/**
 * Data for the locator widget (/wiki/locator.js), one file for every page:
 *   s: naked-eye stars [ra, dec, V, B−V, page slug, name, 1 if a proper name]
 *   b: constellation boundaries as J2000 polylines [abbr A, abbr B, ra0, dec0, ra1, dec1, …]
 *   c: constellation label points {abbr: [ra, dec, Latin name]}
 */

const COLS = 2880; // 0.5 min of RA
const ROWS = 2160; // 5′ of Dec

const r2 = (x: number) => Math.round(x * 100) / 100;

/** B1875 → J2000: the transpose of the J2000 → B1875 rotation */
function makeFromB1875(): (ra: number, dec: number) => [number, number] {
  const cols = [[0, 0], [90, 0], [0, 90]].map(([a, d]) => unitRaDec(...toB1875(a, d)));
  return (ra, dec) => {
    const v = unitRaDec(ra, dec);
    const x = cols[0][0] * v[0] + cols[0][1] * v[1] + cols[0][2] * v[2];
    const y = cols[1][0] * v[0] + cols[1][1] * v[1] + cols[1][2] * v[2];
    const z = cols[2][0] * v[0] + cols[2][1] * v[1] + cols[2][2] * v[2];
    let a = Math.atan2(y, x) * 180 / Math.PI;
    if (a < 0) a += 360;
    return [a, Math.asin(Math.max(-1, Math.min(1, z))) * 180 / Math.PI];
  };
}

export interface SkyData { s: Array<Array<string | number>>; b: Array<Array<string | number>>; c: Record<string, [number, number, string]> }

export function skyData(cat: CoreCatalog, slugOf: (i: number) => string | undefined): SkyData {
  const abbrs = Object.keys(CONSTELLATIONS);
  const table = boundaryTable();
  const fromB = makeFromB1875();

  // the Roman table rasterised in B1875: first row whose strip contains the cell centre
  const grid = new Uint8Array(COLS * ROWS).fill(255);
  for (let r = 0; r < ROWS; r++) {
    const dc = -90 + (r + 0.5) / 12;
    let left = COLS;
    for (const [lo, hi, dl, c] of table) {
      if (dl > dc) continue;
      const k = abbrs.indexOf(c);
      for (let col = Math.ceil(lo * 120 - 0.5); col < Math.ceil(hi * 120 - 0.5); col++) {
        if (grid[r * COLS + col] === 255) { grid[r * COLS + col] = k; left--; }
      }
      if (!left) break;
    }
    for (let col = 0; col < COLS; col++) if (grid[r * COLS + col] === 255) grid[r * COLS + col] = abbrs.indexOf('Oct');
  }

  const lines: Array<Array<string | number>> = [];
  const emit = (a: number, b: number, pts: Array<[number, number]>) => {
    const out: Array<string | number> = [abbrs[a], abbrs[b]];
    for (const [ra, dec] of pts) { const [x, y] = fromB(ra, dec); out.push(r2(x), r2(y)); }
    lines.push(out);
  };
  // constant-RA edges between neighbouring columns, merged over consecutive rows
  for (let col = 0; col < COLS; col++) {
    const nx = (col + 1) % COLS;
    let start = -1, pa = -1, pb = -1;
    for (let r = 0; r <= ROWS; r++) {
      const a = r < ROWS ? grid[r * COLS + col] : -1, b = r < ROWS ? grid[r * COLS + nx] : -1;
      const edge = a !== b && r < ROWS;
      if (start >= 0 && (!edge || a !== pa || b !== pb)) {
        const ra = ((col + 1) / 120) * 15, d0 = -90 + start / 12, d1 = -90 + r / 12;
        const n = Math.max(1, Math.ceil(d1 - d0));
        emit(pa, pb, Array.from({ length: n + 1 }, (_, k) => [ra, d0 + (d1 - d0) * k / n] as [number, number]));
        start = -1;
      }
      if (edge && start < 0) { start = r; pa = a; pb = b; }
    }
  }
  // constant-Dec edges between neighbouring rows, merged over consecutive columns
  for (let r = 0; r < ROWS - 1; r++) {
    let start = -1, pa = -1, pb = -1;
    for (let col = 0; col <= COLS; col++) {
      const a = col < COLS ? grid[r * COLS + col] : -1, b = col < COLS ? grid[(r + 1) * COLS + col] : -1;
      const edge = a !== b && col < COLS;
      if (start >= 0 && (!edge || a !== pa || b !== pb)) {
        const dec = -90 + (r + 1) / 12, a0 = (start / 120) * 15, a1 = (col / 120) * 15;
        const n = Math.max(1, Math.ceil(a1 - a0));
        emit(pa, pb, Array.from({ length: n + 1 }, (_, k) => [a0 + (a1 - a0) * k / n, dec] as [number, number]));
        start = -1;
      }
      if (edge && start < 0) { start = col; pa = a; pb = b; }
    }
  }

  // label points: area-weighted mean direction of each constellation's cells
  const sum = abbrs.map(() => [0, 0, 0]);
  for (let r = 0; r < ROWS; r += 2) {
    const dec = -90 + (r + 0.5) / 12, w = Math.cos(dec * Math.PI / 180);
    for (let col = 0; col < COLS; col += 2) {
      const v = unitRaDec(((col + 0.5) / 120) * 15, dec), s = sum[grid[r * COLS + col]];
      s[0] += v[0] * w; s[1] += v[1] * w; s[2] += v[2] * w;
    }
  }
  const labels: Record<string, [number, number, string]> = {};
  abbrs.forEach((abbr, k) => {
    const [x, y, z] = sum[k], n = Math.hypot(x, y, z) || 1;
    let ra = Math.atan2(y, x) * 180 / Math.PI;
    if (ra < 0) ra += 360;
    const [jr, jd] = fromB(ra, Math.asin(z / n) * 180 / Math.PI);
    labels[abbr] = [r2(jr), r2(jd), CONSTELLATIONS[abbr][0]];
  });

  const stars: Array<Array<string | number>> = [];
  for (let i = 1; i < cat.n; i++) {
    if (cat.mag[i] > 6) continue;
    const { ra, dec } = cat.raDec(i);
    stars.push([r2(ra), r2(dec), Math.round(cat.mag[i] * 10) / 10, Math.round(cat.bv[i] * 10) / 10, slugOf(i) ?? '', cat.nameOf(i), cat.names.get(i)?.proper ? 1 : 0]);
  }
  return { s: stars, b: lines, c: labels };
}
