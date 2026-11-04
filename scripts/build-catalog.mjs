#!/usr/bin/env node
/**
 * Builds the star catalogue and the exoplanet table of the web app.
 *
 *   node scripts/build-catalog.mjs --hyg hygdata_v41.csv --athyg athyg_40.csv.gz \
 *        --gcns <dir of GCNS csv slices> --exo pscomppars.csv [--ucs UltracoolSheet-Main.csv]
 *
 * Sources
 *   HYG v4.1 (astronexus, CC BY-SA 4.0)        order and names of the original 109 401 stars
 *   AT-HYG v4.0 (astronexus, CC BY-SA 4.0)     Tycho-2 + Gaia DR3 distances and space velocities (2.5 M stars)
 *   GCNS (Gaia Collaboration, Smart et al. 2021) every star within 100 pc, down to the faintest dwarfs
 *   NASA Exoplanet Archive, PSCompPars          confirmed planets and their measured host stars
 *   UltracoolSheet (Best et al. 2024)           L, T and Y brown dwarfs with spectral types and distances
 *
 * Fetching: HYG / AT-HYG from github.com/astronexus/HYG-Database and codeberg.org/astronexus/athyg;
 * GCNS from the Gaia archive (external.gaiaedr3_gcns_main_1: source_id, ra, dec, dist_50, pmra, pmdec,
 * adoptedrv, phot_g/bp/rp_mean_mag, wd_prob, gcns_prob); PSCompPars through the archive's TAP service;
 * UltracoolSheet from zenodo.org/records/13993077 (main table as CSV).
 *
 * Output (public/data)
 *   stars.bin          core catalogue, loaded at start-up (format 2, 32-byte records):
 *                      the HYG stars in their original order — so `c<index>` ids, seeds and saved
 *                      discoveries stay valid — then every exoplanet host that HYG lacks
 *   star-names.json    [index, proper, bayer, gliese, constellation, host] for named core stars
 *   stars-gcns.bin     tier files (format 3, 26/30-byte records), appended in the background in
 *   stars-tycho-a.bin  this order: GCNS stars missing from the core, then AT-HYG to V 10.5,
 *   stars-tycho-b.bin  V 10.5–11.5 and the rest (each file stays under GitHub's 50 MB warning)
 *   stars-tycho-c.bin
 *   catalog.json       core size and the tier list (first index, count) the app loads from
 *   exoplanets.json    hosts (measured stellar parameters) and their planets
 *   browndwarfs.json   [core index, spectral type, numeric type (10 L0, 20 T0, 30 Y0), young, parallax distance]
 *
 * Positions: parsecs, scene frame (ecliptic J2000, Y = ecliptic north, Z = −y_ecl).
 * Velocities: heliocentric space velocity, km/s, same frame (0.1 km/s steps).
 *
 * Core record (32 bytes, little-endian)
 *   f32 x, y, z | i16 mag·100 | i16 B−V·1000 (−32768 unknown) | u32 hip | u8 class (0..6 OBAFGKM,
 *   7 other, 255 unknown) | u8 subclass (255 unknown) | u8 luminosity class (1..5, 0 unknown) |
 *   u8 flags (bit0 named, bit1 white dwarf, bit2 has planets, bit3 Gaia distance, bit4 velocity known) |
 *   i16 vx, vy, vz (0.1 km/s) | u16 reserved
 *
 * Tier record (26 bytes; 30 for Gaia ids)
 *   f32 x, y, z | u8 (V + 5)·10 | u8 (B−V + 0.6)·60 (255 unknown) | u8 class·10 + subclass (255 unknown) |
 *   u8 luminosity class (bits 0–2) + bit3 white dwarf, bit4 Gaia distance, bit5 velocity known |
 *   id: u32 (TYC packed as tyc1·2^17·4 … see packTyc, bit31 = AT-HYG id) or 2× u32 Gaia DR3 source_id (hi, lo) |
 *   i16 vx, vy, vz (0.1 km/s)
 */
import { createReadStream, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createGunzip } from 'node:zlib';
import { createInterface } from 'node:readline';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const arg = (k) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : null; };
const SRC = { hyg: arg('hyg'), athyg: arg('athyg'), gcns: arg('gcns'), exo: arg('exo'), ucs: arg('ucs') };
for (const [k, v] of Object.entries(SRC)) if (!v || !existsSync(v)) { console.error(`missing --${k}`); process.exit(1); }
const outDir = resolve(here, '../public/data');
mkdirSync(outDir, { recursive: true });

/* ------------------------------------------------------------------ */
/*  Frames and photometry                                              */
/* ------------------------------------------------------------------ */

const DEG = Math.PI / 180;
const OBLIQUITY = 23.439291 * DEG;
const CE = Math.cos(OBLIQUITY), SE = Math.sin(OBLIQUITY);
/** km/s → pc/yr */
const KMS_PC_YR = 1.02271e-6;
/** proper motion (mas/yr) × distance (pc) → km/s */
const K_PM = 4.740470446 / 1000;

/** equatorial (x → RA 0, z → north) → scene (x, z_ecl, −y_ecl) */
function eqToScene(x, y, z) {
  const ym = y * CE + z * SE, zm = -y * SE + z * CE;
  return [x, zm, -ym];
}

function raDecDist(raDeg, decDeg, d) {
  const ra = raDeg * DEG, dec = decDeg * DEG;
  return [d * Math.cos(dec) * Math.cos(ra), d * Math.cos(dec) * Math.sin(ra), d * Math.sin(dec)];
}

/** heliocentric velocity (km/s, equatorial) from proper motion, distance and radial velocity */
function spaceVelocity(raDeg, decDeg, distPc, pmra, pmdec, rv) {
  const ra = raDeg * DEG, dec = decDeg * DEG;
  const sa = Math.sin(ra), ca = Math.cos(ra), sd = Math.sin(dec), cd = Math.cos(dec);
  const va = K_PM * pmra * distPc, vd = K_PM * pmdec * distPc, vr = rv ?? 0;
  return [
    vr * cd * ca - va * sa - vd * sd * ca,
    vr * cd * sa + va * ca - vd * sd * sa,
    vr * sd + vd * cd,
  ];
}

/** Gaia DR3 G, BP−RP → Johnson V (Riello et al. 2021, valid −0.5 … 2.75, extrapolated gently beyond) */
function gaiaToV(g, bprp) {
  const x = Math.min(Math.max(bprp, -0.5), 4.5);
  return g - (-0.02704 + 0.01424 * x - 0.2156 * x * x + 0.01426 * x * x * x);
}

/** BP−RP → B−V along the dwarf sequence (Pecaut & Mamajek 2013, Gaia DR3 colours) */
const BPRP = [-0.40, -0.12, 0.00, 0.30, 0.45, 0.60, 0.82, 0.98, 1.20, 1.45, 1.84, 2.20, 2.50, 3.00, 3.60, 4.50];
const BV = [-0.30, -0.10, 0.00, 0.25, 0.37, 0.48, 0.65, 0.82, 1.00, 1.15, 1.41, 1.48, 1.52, 1.75, 1.95, 2.10];
function bprpToBv(x) {
  if (x <= BPRP[0]) return BV[0];
  for (let i = 1; i < BPRP.length; i++) if (x <= BPRP[i]) return BV[i - 1] + ((BV[i] - BV[i - 1]) * (x - BPRP[i - 1])) / (BPRP[i] - BPRP[i - 1]);
  return BV[BV.length - 1];
}

/** inverse of the app's bvToTemperature (Ballesteros 2012) */
function temperatureToBv(T) {
  const f = (b) => 4600 * (1 / (0.92 * b + 1.7) + 1 / (0.92 * b + 0.62));
  let lo = -0.4, hi = 2.2;
  for (let k = 0; k < 50; k++) { const m = (lo + hi) / 2; if (f(m) > T) lo = m; else hi = m; }
  return (lo + hi) / 2;
}

const GREEK = {
  Alp: 'α', Bet: 'β', Gam: 'γ', Del: 'δ', Eps: 'ε', Zet: 'ζ', Eta: 'η', The: 'θ', Iot: 'ι', Kap: 'κ',
  Lam: 'λ', Mu: 'μ', Nu: 'ν', Xi: 'ξ', Omi: 'ο', Pi: 'π', Rho: 'ρ', Sig: 'σ', Tau: 'τ', Ups: 'υ',
  Phi: 'φ', Chi: 'χ', Psi: 'ψ', Ome: 'ω',
};

/** "21Alp And" → "α And", "  Ups2Eri" → "υ² Eri", "  5    Ari" → "5 Ari" */
function prettyBayerFlamsteed(bf) {
  const s = bf.trim();
  if (!s) return '';
  const m = /^(\d+)?\s*([A-Za-z]{2,3})?(\d)?\s*([A-Za-z]{3})$/.exec(s);
  if (!m) return s.replace(/\s+/g, ' ');
  const [, flam, grk, sup, con] = m;
  const sups = '⁰¹²³⁴⁵⁶⁷⁸⁹';
  if (grk && GREEK[grk]) return `${GREEK[grk]}${sup ? sups[+sup] : ''} ${con}`;
  if (grk) return `${grk}${sup ?? ''} ${con}`;
  if (flam) return `${flam} ${con}`;
  return s;
}

function parseSpect(sp) {
  const s = (sp ?? '').trim();
  if (!s) return [255, 255, 0, 0];
  let flags = 0;
  if (/^D[ABOQZC]/.test(s) || /^WD/.test(s)) flags |= 2;
  const m = /^(?:sd|d|g|c)?([OBAFGKM])(\d)?(?:\.\d)?\s*(Ia|Ib|III|II|IV|V|I)?/.exec(s);
  if (!m) return [7, 255, 0, flags];
  const cls = 'OBAFGKM'.indexOf(m[1]);
  const sub = m[2] !== undefined ? +m[2] : 255;
  const lumMap = { Ia: 1, Ib: 1, I: 1, II: 2, III: 3, IV: 4, V: 5 };
  return [cls, sub, m[3] ? lumMap[m[3]] : 0, flags];
}

function parseCsvLine(line) {
  const out = []; let cur = ''; let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) { if (c === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true;
    else if (c === ',') { out.push(cur); cur = ''; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

const num = (s) => { if (s === undefined || s === '') return null; const v = +s; return Number.isFinite(v) ? v : null; };

/** TYC1 (1…9537) · TYC2 (1…12121) · TYC3 (1…4) in 31 bits */
function packTyc(tyc) {
  const m = /^(\d+)-(\d+)-(\d+)$/.exec(tyc);
  if (!m) return null;
  return ((+m[1] << 16) | (+m[2] << 2) | (+m[3] - 1)) >>> 0;
}

/* ------------------------------------------------------------------ */
/*  1. HYG v4.1: the original core in its original order               */
/* ------------------------------------------------------------------ */

const core = [];
const coreByHyg = new Map();
const coreByHip = new Map();
{
  const lines = readFileSync(SRC.hyg, 'utf8').split(/\r?\n/);
  const H = Object.fromEntries(parseCsvLine(lines[0]).map((k, i) => [k, i]));
  for (let li = 1; li < lines.length; li++) {
    if (!lines[li]) continue;
    const f = parseCsvLine(lines[li]);
    const dist = num(f[H.dist]);
    if (dist === null || dist >= 100000) continue;
    const mag = num(f[H.mag]);
    if (mag === null) continue;
    const [cls, sub, lum, spFlags] = parseSpect(f[H.spect]);
    const vx = num(f[H.vx]), vy = num(f[H.vy]), vz = num(f[H.vz]);
    const r = {
      pos: eqToScene(+f[H.x], +f[H.y], +f[H.z]),
      vel: vx !== null && (vx || vy || vz) ? eqToScene(vx / KMS_PC_YR, vy / KMS_PC_YR, vz / KMS_PC_YR) : null,
      mag, ci: num(f[H.ci]), hip: parseInt(f[H.hip], 10) || 0, cls, sub, lum, flags: spFlags, gaiaDist: false,
      proper: (f[H.proper] ?? '').trim(), bayer: prettyBayerFlamsteed(f[H.bf] ?? ''), gl: (f[H.gl] ?? '').trim(), con: (f[H.con] ?? '').trim(),
      host: '',
    };
    const idx = core.length;
    core.push(r);
    coreByHyg.set(+f[H.id], idx);
    if (r.hip) coreByHip.set(r.hip, idx);
  }
  console.log(`HYG core: ${core.length}`);
}
const HYG_CORE = core.length;

/* ------------------------------------------------------------------ */
/*  2. AT-HYG: update the core, collect the rest                       */
/* ------------------------------------------------------------------ */

const at = []; // AT-HYG stars not in the core: compact objects
const coreGaia = new Map(); // Gaia DR3 id → core index
const atByGaia = new Map(); // Gaia DR3 id → index in `at`
const atByHip = new Map();
let updated = 0;
{
  const rl = createInterface({ input: createReadStream(SRC.athyg).pipe(createGunzip()), crlfDelay: Infinity });
  let H = null;
  for await (const line of rl) {
    const f = line.split(',');
    if (!H) { H = Object.fromEntries(f.map((k, i) => [k, i])); continue; }
    if (f[H.id] === '1') continue; // the Sun
    const dist = num(f[H.dist]);
    const gaiaDist = (f[H.dist_src] ?? '').startsWith('G');
    const vx = num(f[H.vx]), vy = num(f[H.vy]), vz = num(f[H.vz]);
    const vel = vx !== null && vy !== null && vz !== null ? eqToScene(vx, vy, vz) : null;
    const hyg = num(f[H.hyg]);
    const gaia = f[H.gaia];
    const ci = coreByHyg.get(hyg ?? -1);
    if (ci !== undefined) {
      const r = core[ci];
      if (gaiaDist && dist !== null && dist > 0) { r.pos = eqToScene(+f[H.x0], +f[H.y0], +f[H.z0]); r.gaiaDist = true; updated++; }
      if (vel) r.vel = vel;
      if (r.ci === null) r.ci = num(f[H.ci]);
      if (gaia) coreGaia.set(gaia, ci);
      continue;
    }
    if (dist === null || dist <= 0 || dist >= 100000) continue;
    const mag = num(f[H.mag]);
    if (mag === null) continue;
    const [cls, sub, lum, spFlags] = parseSpect(f[H.spect]);
    const tyc = packTyc(f[H.tyc] ?? '');
    const r = {
      pos: eqToScene(+f[H.x0], +f[H.y0], +f[H.z0]), vel, mag, ci: num(f[H.ci]), cls, sub, lum, flags: spFlags, gaiaDist,
      id: tyc ?? ((0x80000000 | +f[H.id]) >>> 0), hip: parseInt(f[H.hip], 10) || 0,
      proper: (f[H.proper] ?? '').trim(), bayer: f[H.bayer] || f[H.flam] ? prettyBayerFlamsteed(`${f[H.flam] ?? ''}${f[H.bayer] ?? ''} ${f[H.con]}`) : '',
      gl: (f[H.gl] ?? '').trim(), con: (f[H.con] ?? '').trim(), host: '', ra: +f[H.ra] * 15, dec: +f[H.dec], dist,
    };
    if (gaia) atByGaia.set(gaia, at.length);
    if (r.hip) atByHip.set(r.hip, at.length);
    at.push(r);
  }
  console.log(`AT-HYG: ${updated} core stars moved to Gaia DR3 distances, ${at.length} further stars`);
}

/* ------------------------------------------------------------------ */
/*  3. GCNS: the 100 pc census                                         */
/* ------------------------------------------------------------------ */

const gc = [];
const gcByGaia = new Map();
{
  let seen = 0;
  for (const file of readdirSync(SRC.gcns).filter((f) => f.endsWith('.csv')).sort((a, b) => parseInt(a.replace(/\D/g, ''), 10) - parseInt(b.replace(/\D/g, ''), 10))) {
    const lines = readFileSync(join(SRC.gcns, file), 'utf8').split(/\r?\n/);
    const H = Object.fromEntries(lines[0].split(',').map((k, i) => [k, i]));
    for (let li = 1; li < lines.length; li++) {
      if (!lines[li]) continue;
      const f = lines[li].split(',');
      seen++;
      const id = f[H.source_id];
      if (coreGaia.has(id) || atByGaia.has(id)) continue;
      const d = num(f[H.dist_50]);
      const g = num(f[H.phot_g_mean_mag]);
      if (d === null || g === null) continue;
      const distPc = d * 1000;
      const ra = +f[H.ra], dec = +f[H.dec];
      const bp = num(f[H.phot_bp_mean_mag]), rp = num(f[H.phot_rp_mean_mag]);
      const bprp = bp !== null && rp !== null ? bp - rp : null;
      const wd = (num(f[H.wd_prob]) ?? 0) > 0.5;
      // no colour: the faint ones are overwhelmingly late M dwarfs
      const x = bprp ?? (wd ? 0.3 : 2.8);
      const pmra = num(f[H.pmra]), pmdec = num(f[H.pmdec]);
      const vel = pmra !== null && pmdec !== null ? eqToScene(...spaceVelocity(ra, dec, distPc, pmra, pmdec, num(f[H.adoptedrv]))) : null;
      gcByGaia.set(id, gc.length);
      gc.push({
        pos: eqToScene(...raDecDist(ra, dec, distPc)), vel, mag: gaiaToV(g, x), ci: bprp !== null ? (wd ? Math.max(-0.3, 0.6 * bprp) : bprpToBv(bprp)) : null,
        cls: 255, sub: 255, lum: wd ? 0 : 5, flags: wd ? 2 : 0, gaiaDist: true, gaia: BigInt(id), ra, dec, dist: distPc, host: '',
      });
    }
  }
  console.log(`GCNS: ${seen} rows, ${gc.length} not in HYG / AT-HYG`);
}

/* ------------------------------------------------------------------ */
/*  4. Exoplanet hosts                                                 */
/* ------------------------------------------------------------------ */

/** Bolometric correction BC_V(Teff), Torres (2010) after Flower (1996) */
function bolometricCorrection(teff) {
  const l = Math.log10(Math.max(2800, teff));
  if (l < 3.7) return -0.190537291496456e5 + 0.155144866764412e5 * l - 0.421278819301717e4 * l ** 2 + 0.381476328422343e3 * l ** 3;
  if (l < 3.9) return -0.370510203809015e5 + 0.385672629965804e5 * l - 0.150651486316025e5 * l ** 2 + 0.261724637119416e4 * l ** 3 - 0.170623810323864e3 * l ** 4;
  return -0.118115450538963e6 + 0.137145973583929e6 * l - 0.636233812100225e5 * l ** 2 + 0.147412923562646e5 * l ** 3 - 0.170587278406872e4 * l ** 4 + 0.788731721804990e2 * l ** 5;
}

/** V for hosts only measured in the infrared: from the archive's luminosity (or radius) and temperature */
function vFromPhysics(h) {
  const f = h.rows[0];
  const mass = num(f[EH.st_mass]), lum = num(f[EH.st_lum]), rad = num(f[EH.st_rad]);
  // microlensing hosts often only have a mass: a main-sequence dwarf of that mass
  const teff = num(f[EH.st_teff]) ?? (mass ? 5772 * mass ** 0.505 : null);
  if (!teff || !h.dist) return null;
  const logL = lum ?? (rad ? Math.log10(rad * rad * (teff / 5772) ** 4) : mass ? Math.log10(mass < 0.43 ? 0.23 * mass ** 2.3 : mass ** 4) : null);
  if (logL === null) return null;
  return 4.74 - 2.5 * logL - bolometricCorrection(teff) + 5 * Math.log10(h.dist) - 5;
}

const exoLines = readFileSync(SRC.exo, 'utf8').split(/\r?\n/).filter(Boolean);
const EH = Object.fromEntries(parseCsvLine(exoLines[0]).map((k, i) => [k, i]));
const hosts = new Map(); // hostname → { rows, gaia, hip, ra, dec, dist, ... }
for (const l of exoLines.slice(1)) {
  const f = parseCsvLine(l);
  const name = f[EH.hostname];
  let h = hosts.get(name);
  if (!h) {
    h = {
      name, rows: [], gaia: f[EH.gaia_dr3_id].replace('Gaia DR3 ', '').trim(), hip: parseInt(f[EH.hip_name].replace('HIP ', ''), 10) || 0,
      ra: num(f[EH.ra]), dec: num(f[EH.dec]), dist: num(f[EH.sy_dist]), v: num(f[EH.sy_vmag]), g: num(f[EH.sy_gaiamag]),
      pmra: num(f[EH.sy_pmra]), pmdec: num(f[EH.sy_pmdec]), teff: num(f[EH.st_teff]), core: -1,
    };
    hosts.set(name, h);
  }
  h.rows.push(f);
}
// pulsar-timing planets orbit neutron stars (PSR B1257+12 …): hand-made pulsar systems in the app, not catalogue stars
for (const [name, h] of hosts) if (h.rows.every((f) => f[EH.discoverymethod] === 'Pulsar Timing')) hosts.delete(name);

/** RA/Dec grid (1° cells) of the stars a host could be */
function buildGrid(list) {
  const grid = new Map();
  list.forEach((r, i) => {
    const key = `${Math.floor(r.ra)}:${Math.floor(r.dec)}`;
    let c = grid.get(key); if (!c) grid.set(key, c = []); c.push(i);
  });
  return grid;
}
function nearestInGrid(grid, list, h) {
  let best = -1, bestSep = 4 / 3600; // 4″
  for (let dr = -1; dr <= 1; dr++) for (let dd = -1; dd <= 1; dd++) {
    for (const i of grid.get(`${Math.floor(h.ra) + dr}:${Math.floor(h.dec) + dd}`) ?? []) {
      const r = list[i];
      const sep = Math.hypot((r.ra - h.ra) * Math.cos(h.dec * DEG), r.dec - h.dec);
      if (sep < bestSep && (!h.dist || Math.abs(r.dist - h.dist) / h.dist < 0.3)) { bestSep = sep; best = i; }
    }
  }
  return best;
}
// the core's sky positions, for the positional fallback
const coreSky = core.map((r) => {
  const [x, y, z] = r.pos; // scene → equatorial
  const xm = x, ym = -z, zm = y;
  const ye = ym * CE - zm * SE, ze = ym * SE + zm * CE;
  const d = Math.hypot(xm, ye, ze);
  return { ra: ((Math.atan2(ye, xm) / DEG) + 360) % 360, dec: Math.asin(ze / d) / DEG, dist: d };
});
const coreGrid = buildGrid(coreSky), atGrid = buildGrid(at), gcGrid = buildGrid(gc);

const promoted = []; // stars moved from a tier into the core
let viaId = 0, viaPos = 0, fromArchive = 0;
const claimed = new Set();
for (const h of [...hosts.values()].sort((a, b) => a.name.localeCompare(b.name))) {
  const lookup = (byGaia, byHip) => (h.gaia && byGaia.has(h.gaia) ? byGaia.get(h.gaia) : h.hip && byHip?.has(h.hip) ? byHip.get(h.hip) : -1);
  let ci = lookup(coreGaia, coreByHip);
  if (ci < 0) {
    const ai = lookup(atByGaia, atByHip);
    const gi = lookup(gcByGaia, null);
    if (ai >= 0 && !at[ai].taken) { at[ai].taken = true; promoted.push(at[ai]); ci = HYG_CORE + promoted.length - 1; viaId++; }
    else if (gi >= 0 && !gc[gi].taken) { gc[gi].taken = true; promoted.push(gc[gi]); ci = HYG_CORE + promoted.length - 1; viaId++; }
  } else viaId++;
  if (ci < 0 && h.ra !== null && h.dec !== null) {
    const c = nearestInGrid(coreGrid, coreSky, h);
    if (c >= 0) { ci = c; viaPos++; }
    else {
      const ai = nearestInGrid(atGrid, at, h);
      if (ai >= 0 && !at[ai].taken) { at[ai].taken = true; promoted.push(at[ai]); ci = HYG_CORE + promoted.length - 1; viaPos++; }
      else {
        const gi = nearestInGrid(gcGrid, gc, h);
        if (gi >= 0 && !gc[gi].taken) { gc[gi].taken = true; promoted.push(gc[gi]); ci = HYG_CORE + promoted.length - 1; viaPos++; }
      }
    }
  }
  // the other component of an unresolved binary (HD 41004 B …) gets its own star
  if (ci >= 0 && claimed.has(ci)) ci = -1;
  if (ci < 0) {
    if (h.ra === null || h.dec === null || !h.dist) { console.warn(`  no position: ${h.name}`); continue; }
    // not in any star catalogue (most Kepler / TESS / microlensing hosts): from the archive itself
    const mag = h.v ?? (h.g !== null ? h.g + 0.3 : vFromPhysics(h));
    if (mag === null) { console.warn(`  no magnitude: ${h.name}`); continue; }
    const vel = h.pmra !== null && h.pmdec !== null ? eqToScene(...spaceVelocity(h.ra, h.dec, h.dist, h.pmra, h.pmdec, null)) : null;
    promoted.push({
      pos: eqToScene(...raDecDist(h.ra, h.dec, h.dist)), vel, mag, ci: h.teff ? temperatureToBv(h.teff) : null,
      cls: 255, sub: 255, lum: 0, flags: 0, gaiaDist: !!h.gaia, hip: h.hip, proper: '', bayer: '', gl: '', con: '', host: '',
    });
    ci = HYG_CORE + promoted.length - 1;
    fromArchive++;
  }
  h.core = ci;
  claimed.add(ci);
}
console.log(`hosts: ${hosts.size} — ${viaId} matched by catalogue id, ${viaPos} by position, ${fromArchive} from the archive`);

/* ------------------------------------------------------------------ */
/*  4b. Brown dwarfs (UltracoolSheet)                                  */
/* ------------------------------------------------------------------ */

// L, T and Y dwarfs with a distance. Gaia sees most L dwarfs (then the catalogue star is the brown
// dwarf, and gets its name); the colder ones are added like the archive-only planet hosts. Close
// companions of stars (≲ 10 000 AU) belong to their primary's system and are left out here.
const dwarfsOut = [];
if (SRC.ucs) {
  const text = readFileSync(SRC.ucs, 'utf8').split(/\r?\n/).filter(Boolean);
  const UH = Object.fromEntries(parseCsvLine(text[0]).map((k, i) => [k, i]));
  const val = (f, k) => { const v = num(f[UH[k]]); return v === null || Number.isNaN(v) ? null : v; };
  const str = (f, k) => { const s = (f[UH[k]] ?? '').trim(); return s === 'nan' || s === 'null' || s === 'NaN' ? '' : s; };
  let byId = 0, byPos = 0, added = 0, companions = 0;
  for (const line of text.slice(1)) {
    const f = parseCsvLine(line);
    const spt = val(f, 'sptnum_formula'), dist = val(f, 'dist_formula');
    const ra = val(f, 'ra_j2000_formula'), dec = val(f, 'dec_j2000_formula');
    if (spt === null || spt < 10 || dist === null || dist <= 0 || ra === null || dec === null) continue;
    const primary = str(f, 'has_higher_mass_companion');
    const sep = val(f, 'sep_companion');
    if (primary && primary !== 'N' && (sep === null || sep * dist < 10_000)) { companions++; continue; }
    const name = str(f, 'name');
    const gaia = str(f, 'sourceID_Gaia_DR3');
    const h = { ra, dec, dist };
    let ci = gaia && coreGaia.has(gaia) ? coreGaia.get(gaia) : -1;
    if (ci < 0 && gaia) {
      const ai = atByGaia.get(gaia), gi = gcByGaia.get(gaia);
      const r = ai !== undefined ? at[ai] : gi !== undefined ? gc[gi] : null;
      // already promoted (a planet host, or listed twice): the same star
      if (r?.taken) ci = HYG_CORE + promoted.indexOf(r);
      else if (r) { r.taken = true; promoted.push(r); ci = HYG_CORE + promoted.length - 1; }
    }
    if (ci >= 0) byId++;
    else {
      const gi = nearestInGrid(gcGrid, gc, h);
      if (gi >= 0 && !gc[gi].taken) { gc[gi].taken = true; promoted.push(gc[gi]); ci = HYG_CORE + promoted.length - 1; byPos++; }
    }
    if (ci < 0) {
      // too cold for Gaia: V from J (V − J ≈ 5.5 for L, 7.5 for T/Y dwarfs; only decides the point's visibility)
      const J = val(f, 'J_2MASS') ?? val(f, 'J_MKO');
      const mag = J !== null ? J + (spt < 20 ? 5.5 : 7.5) : 5 * Math.log10(dist) - 5 + (spt < 20 ? 18 : 24);
      const pmra = val(f, 'pmra_formula'), pmdec = val(f, 'pmdec_formula');
      const vel = pmra !== null && pmdec !== null ? eqToScene(...spaceVelocity(ra, dec, dist, pmra, pmdec, val(f, 'rv_formula'))) : null;
      promoted.push({
        pos: eqToScene(...raDecDist(ra, dec, dist)), vel, mag, ci: 2.2,
        cls: 255, sub: 255, lum: 0, flags: 0, gaiaDist: false, hip: 0, proper: '', bayer: '', gl: '', con: '', host: '',
      });
      ci = HYG_CORE + promoted.length - 1;
      added++;
    }
    const r = ci < HYG_CORE ? core[ci] : promoted[ci - HYG_CORE];
    if (!r.proper && !r.bayer && !r.gl) r.proper = name;
    const sptText = str(f, 'spt_opt') || str(f, 'spt_ir');
    const age = str(f, 'age_category');
    const young = /gamma|beta|VL-G|INT-G|young|\b[A-Z]{2,4}\??$/.test(`${sptText} ${str(f, 'spt_ir')} ${age}`) && !/^(Field|FLD-G)$/.test(age) ? 1 : 0;
    dwarfsOut.push([ci, sptText, spt, young, str(f, 'dist_formula_source').startsWith('dist_plx') ? 1 : 0]);
  }
  console.log(`brown dwarfs: ${dwarfsOut.length} — ${byId} by Gaia id, ${byPos} by position, ${added} added; ${companions} close companions left out`);
}

for (const r of promoted) core.push(r);
if (SRC.ucs) {
  writeFileSync(resolve(outDir, 'browndwarfs.json'), JSON.stringify({ source: 'UltracoolSheet (Best, Liu, Magnier & Dupuy 2024)', rows: dwarfsOut }));
}

/* ------------------------------------------------------------------ */
/*  5. Exoplanet table                                                 */
/* ------------------------------------------------------------------ */

const hostsOut = [];
for (const h of [...hosts.values()].sort((a, b) => a.core - b.core)) {
  if (h.core < 0) continue;
  const r = core[h.core];
  r.flags |= 4;
  r.host = h.name;
  const f0 = h.rows[0];
  const pick = (k) => num(f0[EH[k]]);
  const planets = h.rows.map((f) => {
    const n = (k) => num(f[EH[k]]);
    const p = {
      name: f[EH.pl_name], method: f[EH.discoverymethod], year: n('disc_year'), facility: f[EH.disc_facility],
      P: n('pl_orbper'), a: n('pl_orbsmax'), e: n('pl_orbeccen'), i: n('pl_orbincl'), w: n('pl_orblper'),
      tc: n('pl_tranmid'), tp: n('pl_orbtper'), R: n('pl_rade'), M: n('pl_bmasse'), Mprov: f[EH.pl_bmassprov],
      rho: n('pl_dens'), Teq: n('pl_eqt'), S: n('pl_insol'), lambda: n('pl_projobliq'),
      tran: f[EH.tran_flag] === '1' ? 1 : 0, rv: f[EH.rv_flag] === '1' ? 1 : 0, ima: f[EH.ima_flag] === '1' ? 1 : 0,
      ttv: f[EH.ttv_flag] === '1' ? 1 : 0, cb: f[EH.cb_flag] === '1' ? 1 : 0, controv: f[EH.pl_controv_flag] === '1' ? 1 : 0,
    };
    for (const k of Object.keys(p)) if (p[k] === null || p[k] === '' || p[k] === 0 && ['tran', 'rv', 'ima', 'ttv', 'cb', 'controv'].includes(k)) delete p[k];
    return p;
  }).sort((a, b) => (a.a ?? (a.P ?? 1e9) / 1e3) - (b.a ?? (b.P ?? 1e9) / 1e3));
  const st = {
    teff: pick('st_teff'), rad: pick('st_rad'), mass: pick('st_mass'), lum: pick('st_lum'), met: pick('st_met'), age: pick('st_age'),
    rotp: pick('st_rotp'), logg: pick('st_logg'), spect: f0[EH.st_spectype] || undefined, snum: pick('sy_snum'), dist: h.dist,
  };
  for (const k of Object.keys(st)) if (st[k] === null || st[k] === undefined) delete st[k];
  hostsOut.push({ i: h.core, name: h.name, ...st, planets });
}
writeFileSync(resolve(outDir, 'exoplanets.json'), JSON.stringify({ source: 'NASA Exoplanet Archive, PSCompPars', fetched: new Date().toISOString().slice(0, 10), hosts: hostsOut }));
console.log(`exoplanets.json: ${hostsOut.length} hosts, ${hostsOut.reduce((s, h) => s + h.planets.length, 0)} planets`);

/* ------------------------------------------------------------------ */
/*  6. Core catalogue                                                  */
/* ------------------------------------------------------------------ */

const v16 = (v) => Math.max(-32767, Math.min(32767, Math.round(v * 10)));
{
  const REC = 32, HEAD = 16;
  const buf = Buffer.alloc(HEAD + core.length * REC);
  buf.write('YEST', 0, 'ascii');
  buf.writeUInt32LE(2, 4); buf.writeUInt32LE(core.length, 8); buf.writeUInt32LE(REC, 12);
  const names = [];
  core.forEach((r, idx) => {
    const o = HEAD + idx * REC;
    let flags = r.flags & 0x07;
    if (r.gaiaDist) flags |= 8;
    if (r.vel) flags |= 16;
    if (r.proper || r.bayer || r.gl || r.host) { flags |= 1; names.push([idx, r.proper, r.bayer, r.gl, r.con, r.host]); }
    buf.writeFloatLE(r.pos[0], o); buf.writeFloatLE(r.pos[1], o + 4); buf.writeFloatLE(r.pos[2], o + 8);
    buf.writeInt16LE(Math.round(Math.max(-327, Math.min(327, r.mag)) * 100), o + 12);
    buf.writeInt16LE(r.ci === null ? -32768 : Math.round(Math.max(-32, Math.min(32, r.ci)) * 1000), o + 14);
    buf.writeUInt32LE((r.hip ?? 0) >>> 0, o + 16);
    buf.writeUInt8(r.cls, o + 20); buf.writeUInt8(r.sub, o + 21); buf.writeUInt8(r.lum, o + 22); buf.writeUInt8(flags, o + 23);
    const v = r.vel ?? [0, 0, 0];
    buf.writeInt16LE(v16(v[0]), o + 24); buf.writeInt16LE(v16(v[1]), o + 26); buf.writeInt16LE(v16(v[2]), o + 28);
  });
  writeFileSync(resolve(outDir, 'stars.bin'), buf);
  for (const n of names) if (!n[5]) n.length = 5;
  writeFileSync(resolve(outDir, 'star-names.json'), JSON.stringify(names));
  console.log(`stars.bin: ${core.length} stars (${(buf.length / 1e6).toFixed(2)} MB), names: ${names.length}`);
}

/* ------------------------------------------------------------------ */
/*  7. Tier files                                                      */
/* ------------------------------------------------------------------ */

function writeTier(file, list, first, gaiaIds) {
  const REC = gaiaIds ? 30 : 26, HEAD = 24;
  const buf = Buffer.alloc(HEAD + list.length * REC);
  buf.write('YEST', 0, 'ascii');
  buf.writeUInt32LE(3, 4); buf.writeUInt32LE(list.length, 8); buf.writeUInt32LE(REC, 12); buf.writeUInt32LE(first, 16); buf.writeUInt32LE(gaiaIds ? 2 : 1, 20);
  list.forEach((r, k) => {
    const o = HEAD + k * REC;
    buf.writeFloatLE(r.pos[0], o); buf.writeFloatLE(r.pos[1], o + 4); buf.writeFloatLE(r.pos[2], o + 8);
    buf.writeUInt8(Math.max(0, Math.min(255, Math.round((r.mag + 5) * 10))), o + 12);
    buf.writeUInt8(r.ci === null ? 255 : Math.max(0, Math.min(254, Math.round((r.ci + 0.6) * 60))), o + 13);
    buf.writeUInt8(r.cls > 7 ? 255 : r.cls * 10 + (r.sub > 9 ? 5 : r.sub), o + 14);
    buf.writeUInt8((r.lum & 7) | (r.flags & 2 ? 8 : 0) | (r.gaiaDist ? 16 : 0) | (r.vel ? 32 : 0), o + 15);
    let p = o + 16;
    if (gaiaIds) { buf.writeUInt32LE(Number(r.gaia >> 32n), p); buf.writeUInt32LE(Number(r.gaia & 0xffffffffn), p + 4); p += 8; }
    else { buf.writeUInt32LE(r.id >>> 0, p); p += 4; }
    const v = r.vel ?? [0, 0, 0];
    buf.writeInt16LE(v16(v[0]), p); buf.writeInt16LE(v16(v[1]), p + 2); buf.writeInt16LE(v16(v[2]), p + 4);
  });
  writeFileSync(resolve(outDir, file), buf);
  console.log(`${file}: ${list.length} stars from index ${first} (${(buf.length / 1e6).toFixed(2)} MB)`);
  return first + list.length;
}
const byMag = (a, b) => a.mag - b.mag;
const gcRest = gc.filter((r) => !r.taken && r.dist <= 100).sort(byMag);
const atRest = at.filter((r) => !r.taken);
const tiers = [
  { file: 'stars-gcns.bin', list: gcRest, gaia: true, label: 'Gaia Catalogue of Nearby Stars (100 pc)' },
  { file: 'stars-tycho-a.bin', list: atRest.filter((r) => r.mag <= 10.5).sort(byMag), label: 'AT-HYG (Tycho-2 + Gaia DR3), V ≤ 10.5' },
  { file: 'stars-tycho-b.bin', list: atRest.filter((r) => r.mag > 10.5 && r.mag <= 11.5).sort(byMag), label: 'AT-HYG (Tycho-2 + Gaia DR3), V 10.5–11.5' },
  { file: 'stars-tycho-c.bin', list: atRest.filter((r) => r.mag > 11.5).sort(byMag), label: 'AT-HYG (Tycho-2 + Gaia DR3), V > 11.5' },
];
let next = core.length;
const manifest = { core: core.length, total: 0, tiers: [] };
for (const t of tiers) {
  manifest.tiers.push({ file: t.file, first: next, count: t.list.length, label: t.label });
  next = writeTier(t.file, t.list, next, !!t.gaia);
}
manifest.total = next;
writeFileSync(resolve(outDir, 'catalog.json'), JSON.stringify(manifest));
console.log(`total: ${next} stars`);
