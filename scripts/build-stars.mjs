#!/usr/bin/env node
/**
 * Converts the HYG star database (v4.x CSV) into a compact binary catalogue for the web app.
 *
 *   node scripts/build-stars.mjs /path/to/hygdata_v41.csv
 *
 * Output:
 *   public/data/stars.bin        – 24-byte little-endian records (see layout below)
 *   public/data/star-names.json  – names for stars that have any (proper / Bayer-Flamsteed / Gliese)
 *
 * Record layout (24 bytes):
 *   f32 x, f32 y, f32 z      position in parsecs, *scene frame* (ecliptic J2000, Y = ecliptic north, Z = -y_ecl)
 *   i16 mag*100              apparent visual magnitude
 *   i16 ci*1000              B-V colour index (-32768 = unknown)
 *   u32 hip                  Hipparcos number (0 = none)
 *   u8  spectral class       0..6 = O B A F G K M, 7 = other (W, C, S, L, T, D...), 255 = unknown
 *   u8  spectral subclass    0..9, 255 = unknown
 *   u8  luminosity class     1..5 = I..V (Ia/Ib -> 1), 0 = unknown
 *   u8  flags                bit0 = has a name entry, bit1 = suspected white dwarf
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const src = process.argv[2];
if (!src) {
  console.error('usage: build-stars.mjs <hygdata.csv>');
  process.exit(1);
}
const outDir = resolve(here, '../public/data');
mkdirSync(outDir, { recursive: true });

const OBLIQUITY = (23.439291 * Math.PI) / 180;
const CE = Math.cos(OBLIQUITY), SE = Math.sin(OBLIQUITY);

const GREEK = {
  Alp: 'α', Bet: 'β', Gam: 'γ', Del: 'δ', Eps: 'ε', Zet: 'ζ', Eta: 'η', The: 'θ', Iot: 'ι', Kap: 'κ',
  Lam: 'λ', Mu: 'μ', Nu: 'ν', Xi: 'ξ', Omi: 'ο', Pi: 'π', Rho: 'ρ', Sig: 'σ', Tau: 'τ', Ups: 'υ',
  Phi: 'φ', Chi: 'χ', Psi: 'ψ', Ome: 'ω',
};

/** "21Alp And" → "α And", "  3Bet Cas" → "β Cas", "  Ups2Eri" → "υ² Eri", "  5    Ari" → "5 Ari" */
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

function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; } else q = false;
      } else cur += c;
    } else if (c === '"') q = true;
    else if (c === ',') { out.push(cur); cur = ''; }
    else cur += c;
  }
  out.push(cur);
  return out;
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
  const lum = m[3] ? lumMap[m[3]] : 0;
  return [cls, sub, lum, flags];
}

const text = readFileSync(src, 'utf8');
const lines = text.split(/\r?\n/);
const header = parseCsvLine(lines[0]);
const col = (name) => {
  const i = header.indexOf(name);
  if (i < 0) throw new Error(`missing column ${name}`);
  return i;
};
const C = {
  hip: col('hip'), gl: col('gl'), bf: col('bf'), proper: col('proper'), dist: col('dist'),
  mag: col('mag'), spect: col('spect'), ci: col('ci'), x: col('x'), y: col('y'), z: col('z'), con: col('con'),
};

const records = [];
const names = [];
for (let li = 1; li < lines.length; li++) {
  const line = lines[li];
  if (!line) continue;
  const f = parseCsvLine(line);
  const dist = parseFloat(f[C.dist]);
  if (!Number.isFinite(dist) || dist >= 100000) continue; // unknown distance
  const mag = parseFloat(f[C.mag]);
  if (!Number.isFinite(mag)) continue;
  // equatorial pc → ecliptic math (rotate about x by −ε) → scene (x, z, −y)
  const xe = parseFloat(f[C.x]), ye = parseFloat(f[C.y]), ze = parseFloat(f[C.z]);
  const xm = xe, ym = ye * CE + ze * SE, zm = -ye * SE + ze * CE;
  const ciRaw = f[C.ci].trim();
  const ci = ciRaw === '' ? null : parseFloat(ciRaw);
  const [cls, sub, lum, spFlags] = parseSpect(f[C.spect]);
  const proper = (f[C.proper] ?? '').trim();
  const bayer = prettyBayerFlamsteed(f[C.bf] ?? '');
  const gl = (f[C.gl] ?? '').trim();
  const con = (f[C.con] ?? '').trim();
  const hip = parseInt(f[C.hip], 10) || 0;
  let flags = spFlags;
  const idx = records.length;
  if (proper || bayer || gl) {
    flags |= 1;
    names.push([idx, proper, bayer, gl, con]);
  }
  records.push({ x: xm, y: zm, z: -ym, mag, ci, hip, cls, sub, lum, flags });
}

const REC = 24;
const HEADER = 12;
const buf = Buffer.alloc(HEADER + records.length * REC);
buf.write('YEST', 0, 'ascii');
buf.writeUInt32LE(1, 4);
buf.writeUInt32LE(records.length, 8);
let o = HEADER;
for (const r of records) {
  buf.writeFloatLE(r.x, o); buf.writeFloatLE(r.y, o + 4); buf.writeFloatLE(r.z, o + 8);
  buf.writeInt16LE(Math.round(Math.max(-327, Math.min(327, r.mag)) * 100), o + 12);
  buf.writeInt16LE(r.ci === null ? -32768 : Math.round(Math.max(-32, Math.min(32, r.ci)) * 1000), o + 14);
  buf.writeUInt32LE(r.hip >>> 0, o + 16);
  buf.writeUInt8(r.cls, o + 20); buf.writeUInt8(r.sub, o + 21); buf.writeUInt8(r.lum, o + 22); buf.writeUInt8(r.flags, o + 23);
  o += REC;
}
writeFileSync(resolve(outDir, 'stars.bin'), buf);
writeFileSync(resolve(outDir, 'star-names.json'), JSON.stringify(names));
console.log(`stars: ${records.length}  (${(buf.length / 1e6).toFixed(2)} MB)   names: ${names.length}`);
