#!/usr/bin/env node
/**
 * Real deep-sky objects of the Milky Way (and the Magellanic Clouds) → public/data/deepsky.json
 *
 *   pulsars   ATNF Pulsar Catalogue (Manchester et al. 2005), HEASARC table `atnfpulsar`
 *   open      Milky Way Star Clusters (Kharchenko et al. 2013), HEASARC `mwsc`
 *   globular  Harris (1996, 2010 edition), HEASARC `globclust`
 *   pn        Strasbourg–ESO Catalogue of Galactic Planetary Nebulae (Acker et al. 1992), HEASARC `plnebulae`
 *   snr       Green's Catalogue of Galactic SNRs, HEASARC `snrgreen`
 *   hii       WISE Catalog of Galactic H II Regions v3.0 (Anderson et al. 2014), astro.phys.wvu.edu/wise
 *
 * Only objects with a distance are kept (positions are 3D). Green's catalogue has no distances:
 * the well-studied remnants get literature values, the rest the radio Σ–D relation
 * (Case & Bhattacharya 1998), flagged as an estimate.
 *
 * The HEASARC tables are tab-separated dumps of TAP queries (`select * from <table>`).
 *
 * usage: node scripts/build-deepsky.mjs --dir /path/to/tables
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith('--') ? [...acc, [a.slice(2), all[i + 1]]] : acc), []));
if (!args.dir) { console.error('usage: build-deepsky.mjs --dir DIR'); process.exit(1); }
const outFile = resolve(import.meta.dirname, '../public/data/deepsky.json');

function tsv(file) {
  const lines = readFileSync(join(args.dir, file), 'utf8').split('\n').filter((l) => l.length);
  const head = lines[0].split('\t');
  return lines.slice(1).map((l) => {
    const c = l.split('\t');
    const o = {};
    head.forEach((h, i) => { o[h] = c[i] ?? ''; });
    return o;
  });
}

function csv(file) {
  const text = readFileSync(join(args.dir, file), 'utf8');
  const rows = [];
  let row = [], f = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { row.push(f); f = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(f); rows.push(row); row = []; f = ''; }
    else f += ch;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  const head = rows[0];
  return rows.slice(1).filter((r) => r.length > 1).map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ''])));
}

const num = (s) => {
  if (s === undefined || s === null || s === '' || s === 'nan' || s === 'NaN') return null;
  const v = Number(s);
  return Number.isFinite(v) ? v : null;
};
/** round to n significant digits (compact JSON) */
const sig = (v, n = 4) => (v === null || v === 0 ? v : Number(v.toPrecision(n)));
const r4 = (v) => (v === null ? null : Math.round(v * 1e4) / 1e4);
const ARCMIN = Math.PI / (180 * 60);
const ARCSEC = ARCMIN / 60;

/* ------------------------------------------------------------------ pulsars */

const COMPANION_CODES = new Set(['MS', 'NS', 'CO', 'He', 'ONeMg', 'UL', 'BH']);
function pulsars() {
  const out = [];
  let skipped = 0;
  for (const r of tsv('h_atnfpulsar.tsv')) {
    const kpc = num(r.distance);
    const P = num(r.period);
    if (kpc === null || P === null || kpc <= 0) { skipped++; continue; }
    const jname = r.name.replace(/^PSR\s+/, '');
    const bname = r.alt_name.startsWith('PSR B') ? r.alt_name.replace(/^PSR\s+/, '') : '';
    const assoc = r.assoc_object.split(',').map((s) => s.trim()).filter(Boolean);
    const exgal = assoc.find((a) => a.startsWith('EXGAL:'))?.slice(6).replace(/\[.*$/, '') ?? '';
    const galaxy = exgal === 'LMC' ? 'Büyük Macellan' : exgal === 'SMC' ? 'Küçük Macellan' : '';
    if (exgal && !galaxy) { skipped++; continue; } // other galaxies: not resolved here
    // host / associated object, readable form: "GC:47Tuc" → [GC, 47Tuc]
    const host = assoc.map((a) => /^(GC|SNR|PWN):([^[]+)/.exec(a)).find(Boolean);
    let bin = 0;
    const Pb = num(r.period_bin);
    if (Pb !== null) {
      const code = r.companion_type.split(/[,(?]/)[0].trim();
      bin = [sig(Pb, 6), sig(num(r.a1), 5), sig(num(r.eccentricity), 4) ?? 0, sig(num(r.median_mass), 3), COMPANION_CODES.has(code) ? code : ''];
    }
    const disc = num(r.discovery_date);
    out.push([
      jname, bname, r4(num(r.ra)), r4(num(r.dec)), sig(kpc * 1000, 4), sig(P, 8), sig(num(r.period_dot), 4),
      sig(num(r.age), 3), sig(num(r.b_surf), 3), sig(num(r.e_dot), 3), sig(num(r.dm), 5),
      r.pulsar_type || 'R', host ? `${host[1]}:${host[2].replace(/_/g, ' ')}` : '', disc ?? 0, r.discovery_survey.trim(), bin, galaxy,
    ]);
  }
  console.log(`pulsars: ${out.length} (skipped ${skipped} without distance / outside the Magellanic Clouds)`);
  return out;
}

/* ------------------------------------------------------------------ open clusters (MWSC) */

function openClusters() {
  const out = [];
  for (const r of tsv('h_mwsc.tsv')) {
    // '' open cluster, r remnant cluster, n cluster in nebulosity; associations, moving groups,
    // asterisms and the globulars (Harris has those) are left out
    if (!['', 'r', 'n'].includes(r.broad_type)) continue;
    if (r.cluster_type === 'glo' || r.cluster_type === 'ass' || r.cluster_type === 'ast') continue;
    const d = num(r.distance), rDeg = num(r.cluster_radius);
    if (d === null || rDeg === null) continue;
    const rPc = d * Math.tan(rDeg * Math.PI / 180);
    out.push([
      r.name.replace(/_/g, ' '), r4(num(r.ra)), r4(num(r.dec)), Math.round(d), sig(rPc, 3), sig(num(r.log_age), 3),
      num(r.num_cluster_stars) ?? 0, sig(num(r.e_bv), 3), sig(num(r.metallicity), 3), r.broad_type,
    ]);
  }
  console.log(`open clusters: ${out.length}`);
  return out;
}

/* ------------------------------------------------------------------ globular clusters (Harris) */

function globulars() {
  const out = [];
  for (const r of tsv('h_globclust.tsv')) {
    const kpc = num(r.helio_distance);
    if (kpc === null) continue;
    const rh = num(r.half_light_radius); // arcmin
    out.push([
      r.name, r.alt_name, r4(num(r.ra)), r4(num(r.dec)), Math.round(kpc * 1000), sig(num(r.abs_vmag), 3),
      rh !== null ? sig(kpc * 1000 * rh * ARCMIN, 3) : null, sig(num(r.metallicity), 3), sig(num(r.central_concentration), 3),
      r.core_collapse_flag === 'c' ? 1 : 0, sig(num(r.radial_velocity), 4),
    ]);
  }
  console.log(`globular clusters: ${out.length}`);
  return out;
}

/* ------------------------------------------------------------------ planetary nebulae */

function planetaries() {
  const out = [];
  for (const r of tsv('h_plnebulae.tsv')) {
    // an individual distance when there is one, else the mean of the statistical ones
    let kpc = num(r.distance_1), method = r.distance_method_1 || 'I';
    if (kpc === null) {
      const s = [num(r.statdist_1), num(r.statdist_2), num(r.statdist_3), num(r.statdist_4)].filter((v) => v !== null && v > 0);
      if (!s.length) continue;
      kpc = s.reduce((a, b) => a + b, 0) / s.length;
      method = 'S';
    }
    if (kpc <= 0) continue;
    const diam = num(r.opt_diameter) ?? num(r.rad_diameter); // arcsec
    const rPc = diam !== null ? kpc * 1000 * (diam / 2) * ARCSEC : null;
    out.push([
      r.name || r.pn_name, r.pn_name.replace(/^PN\s+/, ''), r4(num(r.ra)), r4(num(r.dec)), sig(kpc * 1000, 3), rPc !== null ? sig(rPc, 3) : null,
      sig(num(r.vmag_cstar), 3), r.spect_type_1.trim(), sig(num(r.exp_velocity_1), 3), method,
    ]);
  }
  console.log(`planetary nebulae: ${out.length}`);
  return out;
}

/* ------------------------------------------------------------------ supernova remnants (Green) */

/** literature distances (kpc) of the well-studied remnants, by Green's G-name */
const SNR_DIST = {
  'G111.7-2.1': [3.4, 'Cas A'], 'G120.1+1.4': [2.5, 'Tycho (SN 1572)'], 'G4.5+6.8': [5.1, 'Kepler (SN 1604)'],
  'G327.6+14.6': [2.2, 'SN 1006'], 'G184.6-5.8': [2.0, 'Crab'], 'G263.9-3.3': [0.287, 'Vela'], 'G74.0-8.5': [0.735, 'Cygnus Loop'],
  'G260.4-3.4': [1.3, 'Puppis A'], 'G189.1+3.0': [1.8, 'IC 443'], 'G34.7-0.4': [3.0, 'W44'], 'G6.4-0.1': [1.9, 'W28'],
  'G43.3-0.2': [8.0, 'W49B'], 'G315.4-2.3': [2.5, 'RCW 86 (SN 185)'], 'G130.7+3.1': [2.0, '3C 58'], 'G1.9+0.3': [8.5, ''],
  'G109.1-1.0': [3.2, 'CTB 109'], 'G89.0+4.7': [1.7, 'HB 21'], 'G205.5+0.5': [1.6, 'Monoceros Loop'], 'G180.0-1.7': [1.3, 'Simeis 147'],
  'G347.3-0.5': [1.0, 'RX J1713.7-3946'], 'G266.2-1.2': [0.75, 'Vela Junior'], 'G11.2-0.3': [4.4, ''], 'G29.7-0.3': [5.8, 'Kes 75'],
  'G320.4-1.2': [5.2, 'MSH 15-52'], 'G69.0+2.7': [2.0, 'CTB 80'], 'G39.7-2.0': [5.5, 'W50 (SS 433)'], 'G21.5-0.9': [4.8, ''],
  'G0.0+0.0': [8.2, 'Sgr A East'], 'G330.2+1.0': [5.0, ''], 'G78.2+2.1': [1.7, 'γ Cygni'], 'G49.2-0.7': [5.4, 'W51C'],
};

/** Σ (W m⁻² Hz⁻¹ sr⁻¹) = S / solid angle; Σ = 2.07e-17 D^-2.38 (D in pc) → distance = D / θ */
function sdDistanceKpc(SmJy, a, b) {
  const omega = (Math.PI / 4) * a * b * ARCMIN * ARCMIN;
  const sigma = (SmJy * 1e-29) / omega;
  const D = Math.pow(sigma / 2.07e-17, -1 / 2.38);
  return D / (Math.sqrt(a * b) * ARCMIN) / 1000;
}
const sdCheck = [];

function remnants() {
  const out = [];
  let lit = 0, sd = 0;
  for (const r of tsv('h_snrgreen.tsv')) {
    const m = /G(\d+\.\d)([+-]\d+\.\d)/.exec(r.name);
    if (!m) continue;
    const gname = `G${Number(m[1]).toFixed(1)}${Number(m[2]) >= 0 ? '+' : '-'}${Math.abs(Number(m[2])).toFixed(1)}`;
    const a = num(r.major_diameter), b = num(r.minor_diameter) ?? a; // arcmin
    if (a === null) continue;
    const theta = Math.sqrt(a * b) * ARCMIN; // mean angular diameter (rad)
    let kpc, method;
    const known = SNR_DIST[gname];
    const S = num(r.flux_1_ghz); // mJy
    if (known) {
      kpc = known[0]; method = 'L'; lit++;
      if (S) sdCheck.push(`${gname} ${known[1]}: ${known[0]} kpc, Σ–D ${sdDistanceKpc(S, a, b).toFixed(2)}`);
    } else {
      if (S === null || S <= 0) continue;
      kpc = Math.min(Math.max(sdDistanceKpc(S, a, b), 0.5), 15);
      method = 'S';
      sd++;
    }
    const alt = known?.[1] || r.alt_names.split(/[,;]/)[0].trim();
    out.push([gname, alt, r4(num(r.ra)), r4(num(r.dec)), sig(kpc * 1000, 3), sig(kpc * 1000 * theta / 2, 3), r.type, sig(num(r.flux_1_ghz), 3), method]);
  }
  console.log(`supernova remnants: ${out.length} (${lit} literature distances, ${sd} Σ–D estimates)`);
  if (args.verbose) console.log(sdCheck.join('\n'));
  return out;
}

/* ------------------------------------------------------------------ H II regions (WISE) */

function hiiRegions() {
  const out = [];
  for (const r of csv('wise_hii.csv')) {
    let kpc = num(r.Distance), method = r.DMethod || '';
    if (kpc === null) { kpc = num(r.Group_Distance); method = 'group'; }
    if (kpc === null) { kpc = num(r.Complex_Distance); method = 'complex'; }
    if (kpc === null || kpc <= 0) continue;
    const names = r.All_Names.split(';').map((s) => s.trim()).filter(Boolean);
    const sh = names.find((n) => /^S\d+$/.test(n));
    const nice = sh ? `Sh2-${sh.slice(1)}` : names.find((n) => /^(M\d+|NGC\s?\d+|IC\s?\d+|RCW\s?\d+|W\s?\d+|Gum\s?\d+)$/.test(n))?.replace(/^(NGC|IC|RCW|W|Gum)\s?/, '$1 ') ?? '';
    const rad = num(r.Radius); // arcsec
    // a named region split into several WISE objects: keep the largest piece
    if (nice) {
      const prev = out.findIndex((o) => o[0] === nice);
      if (prev >= 0) {
        if ((rad ?? 0) * kpc <= out[prev][5] / ARCSEC / 1000) continue;
        out.splice(prev, 1);
      }
    }
    out.push([nice, r.WISE_Name, r4(num(r['RA (J2000)'])), r4(num(r['Dec (J2000)'])), sig(kpc * 1000, 3), rad !== null ? sig(kpc * 1000 * rad * ARCSEC, 3) : 1, r.Catalog, method.replace(/\/Kinematic$/, '/kin')]);
  }
  console.log(`H II regions: ${out.length}`);
  return out;
}

const data = {
  sources: {
    pulsars: 'ATNF Pulsar Catalogue (Manchester et al. 2005) via HEASARC',
    open: 'Milky Way Star Clusters (Kharchenko et al. 2013) via HEASARC',
    globular: 'Harris 1996 (2010 ed.) via HEASARC',
    pn: 'Strasbourg-ESO Catalogue of Galactic Planetary Nebulae (Acker et al. 1992) via HEASARC',
    snr: "Green's Catalogue of Galactic Supernova Remnants via HEASARC",
    hii: 'WISE Catalog of Galactic H II Regions v3.0 (Anderson et al. 2014)',
  },
  pulsars: pulsars(),
  open: openClusters(),
  globular: globulars(),
  pn: planetaries(),
  snr: remnants(),
  hii: hiiRegions(),
};
const json = JSON.stringify(data);
writeFileSync(outFile, json);
console.log(`→ ${outFile} (${(json.length / 1e6).toFixed(2)} MB)`);
