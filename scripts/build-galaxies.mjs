#!/usr/bin/env node
/**
 * Real galaxies → public/data/galaxies.json
 *
 *   UNGC  Updated Nearby Galaxy Catalog (Karachentsev, Makarov & Kaisina 2013): ~870 galaxies
 *         within ~11 Mpc with redshift-independent distances (TRGB, Cepheids …). HEASARC `neargalcat`.
 *   2MRS  2MASS Redshift Survey (Huchra et al. 2012): the 44 600 brightest galaxies of the
 *         infrared sky (Ks ≤ 11.75), distances from the Hubble law. HEASARC `twomassrsc`.
 *
 * 2MRS members of the Virgo and Fornax clusters are put at the clusters' measured distances
 * (their peculiar velocities would smear them along the line of sight); galaxies the UNGC has
 * are taken from the UNGC.
 *
 * Row: [ra, dec, distance Mpc, radius kpc, absolute magnitude (≈V), type, axis ratio, name, source]
 *   type: 0 E, 1 S0, 2 S, 3 SB, 4 Irr; +8 when the morphology is unknown and was guessed
 *   source: 0 UNGC, 1 2MRS (Hubble-law distance), 2 2MRS (cluster distance)
 *
 * usage: node scripts/build-galaxies.mjs --dir /path/to/tables
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith('--') ? [...acc, [a.slice(2), all[i + 1]]] : acc), []));
if (!args.dir) { console.error('usage: build-galaxies.mjs --dir DIR'); process.exit(1); }
const outFile = resolve(import.meta.dirname, '../public/data/galaxies.json');

function tsv(file) {
  const lines = readFileSync(join(args.dir, file), 'utf8').split('\n').filter((l) => l.length);
  const head = lines[0].split('\t');
  return lines.slice(1).map((l) => {
    const c = l.split('\t');
    return Object.fromEntries(head.map((h, i) => [h, c[i] ?? '']));
  });
}
const num = (s) => {
  if (s === undefined || s === '' || s === '-2147483648') return null;
  const v = Number(s);
  return Number.isFinite(v) ? v : null;
};
const r = (v, d) => Math.round(v * 10 ** d) / 10 ** d;
const DEG = Math.PI / 180;
const ARCSEC = DEG / 3600;
const H0 = 70;

/** de Vaucouleurs T-type → 0 E, 1 S0, 2 S, 3 SB, 4 Irr (null: unknown) */
function typeOf(code) {
  const m = /^(-?\d+)([AB]?)/.exec(code.trim());
  if (!m) return null;
  const T = +m[1];
  if (T >= 90 || T === 20) return null;
  if (T <= -4) return 0;
  if (T <= -1) return 1;
  if (T <= 9) return m[2] === 'B' ? 3 : 2;
  return 4;
}

/** deterministic guess for unknown morphologies, by the field mix of bright infrared galaxies */
function guessType(name) {
  let h = 2166136261;
  for (let i = 0; i < name.length; i++) { h ^= name.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  const u = (h % 10000) / 10000;
  return u < 0.22 ? 0 : u < 0.42 ? 1 : u < 0.72 ? 2 : u < 0.95 ? 3 : 4;
}

/** V − Ks colour by type (old populations are redder) */
const V_K = [3.2, 3.1, 2.9, 2.9, 2.3];

/** "MESSIER_087" → "M87", "IC_0342" / "IC0342" → "IC 342", "NGC_4486B" → "NGC 4486B"; null when not a common catalogue */
function niceName(s) {
  s = s.replace(/_/g, ' ').trim();
  const m87 = /^MESSIER\s*0*(\d+)$/.exec(s);
  if (m87) return `M${m87[1]}`;
  const m = /^(NGC|IC|UGCA|UGC|ESO|PGC|DDO|CGCG|MCG|MRK|KKH|KKR|KKs|KK|ARP|IRAS)\s*0*(\d.*)$/i.exec(s);
  if (!m) return null;
  const cat = m[1].toUpperCase() === 'MRK' ? 'Mrk' : m[1].toUpperCase() === 'ARP' ? 'Arp' : m[1];
  return `${cat} ${m[2]}`;
}

function sep(ra1, de1, ra2, de2) {
  const c = Math.sin(de1 * DEG) * Math.sin(de2 * DEG) + Math.cos(de1 * DEG) * Math.cos(de2 * DEG) * Math.cos((ra1 - ra2) * DEG);
  return Math.acos(Math.min(1, c)) / DEG;
}

const out = [];

// UNGC
const ungc = [];
for (const g of tsv('h_neargalcat.tsv')) {
  const ra = num(g.ra), dec = num(g.dec), d = num(g.distance);
  if (ra === null || dec === null || d === null || d <= 0 || g.name === 'Milky Way') continue;
  let t = typeOf(g.morph_type), guessed = 0;
  if (t === null) { t = guessType(g.name); guessed = 8; }
  const M = num(g.abs_bmag) ?? (num(g.bmag) !== null ? num(g.bmag) - 5 * Math.log10(d * 1e6) + 5 : -12);
  // dwarf spheroidals (T −1 … −3 in the UNGC) are spheroids, not lenticular discs
  if (t === 1 && M > -16) t = 0;
  const diamKpc = num(g.linear_diameter) ?? (num(g.major_axis) !== null ? d * 1000 * num(g.major_axis) * 60 * ARCSEC : 1);
  // B → V: −0.6 (typical B − V of the nearby, mostly late-type dwarfs)
  out.push([r(ra, 4), r(dec, 4), r(d, 3), r(diamKpc / 2, 2), r(M - 0.6, 2), t + guessed, r(num(g.axial_ratio) ?? 0.6, 2), niceName(g.name) ?? g.name, 0]);
  ungc.push([ra, dec]);
}
const nUngc = out.length;

// 2MRS
const VIRGO = { ra: 187.706, dec: 12.391, r: 8, cz: [-600, 2800], d: 16.5 };
const FORNAX = { ra: 54.62, dec: -35.45, r: 4, cz: [600, 2400], d: 19.0 };
let skipped = 0, inUngc = 0, clustered = 0;
for (const g of tsv('h_twomassrsc.tsv')) {
  const ra = num(g.ra), dec = num(g.dec), cz = num(g.radial_velocity), K = num(g.ks_mag_0_tot) ?? num(g.ks_mag_0);
  if (ra === null || dec === null || cz === null || K === null) { skipped++; continue; }
  // the UNGC has the nearby ones, with better distances
  if (cz < 1200 && ungc.some(([a, b]) => Math.abs(b - dec) < 0.05 && sep(ra, dec, a, b) < 0.05)) { inUngc++; continue; }
  let d, src = 1;
  for (const c of [VIRGO, FORNAX]) {
    if (cz >= c.cz[0] && cz <= c.cz[1] && sep(ra, dec, c.ra, c.dec) < c.r) {
      // members spread over the cluster's depth (~±1.5 Mpc), deterministically
      const u = ((Math.sin(ra * 12.9898 + dec * 78.233) * 43758.5453) % 1 + 1) % 1;
      d = c.d + (u - 0.5) * 3; src = 2; clustered++;
    }
  }
  if (d === undefined) {
    if (cz < 300) { skipped++; continue; } // Hubble law meaningless; not in the UNGC either
    d = cz / H0;
  }
  const name = niceName(g.alt_name) ?? `2MASX ${g.name.replace(/^2MASS\s+/, '')}`;
  let t = typeOf(g.morph_type), guessed = 0;
  if (t === null) { t = guessType(name); guessed = 8; }
  const MK = K - 5 * Math.log10(d * 1e6) + 5;
  // total (extrapolated) K-band radius, close to the optical R25 (arcsec)
  const rExt = Math.pow(10, num(g.log_tot_semimajor_axis) ?? num(g.log_k20_semimajor_axis) ?? 1.3);
  const radiusKpc = d * 1000 * rExt * ARCSEC;
  out.push([r(ra, 4), r(dec, 4), r(d, 2), r(radiusKpc, 2), r(MK + V_K[t], 2), t + guessed, r(num(g.axis_ratio) ?? 0.6, 2), name, src]);
}
console.log(`UNGC ${nUngc}, 2MRS ${out.length - nUngc} (${clustered} at cluster distances, ${inUngc} taken from the UNGC, ${skipped} without velocity)`);
const json = JSON.stringify({
  sources: {
    ungc: 'Updated Nearby Galaxy Catalog (Karachentsev et al. 2013) via HEASARC',
    tmrs: '2MASS Redshift Survey (Huchra et al. 2012) via HEASARC',
  },
  h0: H0,
  rows: out,
});
writeFileSync(outFile, json);
console.log(`→ ${outFile} (${(json.length / 1e6).toFixed(2)} MB)`);
