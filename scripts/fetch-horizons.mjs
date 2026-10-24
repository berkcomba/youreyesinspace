#!/usr/bin/env node
/**
 * Sampled ephemerides for the spacecraft of the Events tab, straight from NASA/JPL Horizons.
 *
 *   node scripts/fetch-horizons.mjs            → public/ephem/<id>.json for every entry below
 *   node scripts/fetch-horizons.mjs bepicolombo
 *   node scripts/fetch-horizons.mjs --probes   → print updated straight-line states for the
 *                                                interstellar probes (paste into spacecraft.ts)
 *
 * Each file holds one or more uniformly sampled position segments (km, ecliptic J2000, relative
 * to a named body of the simulation); the app interpolates them with a cubic (src/data/ephemeris.ts).
 * Dense segments cover the hours around the event, coarse ones the weeks before and after, so the
 * files stay small. Nothing is extrapolated: outside the sampled span the vehicle is not shown.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const OUT = join(ROOT, 'public', 'ephem');
const API = 'https://ssd.jpl.nasa.gov/api/horizons.api';

/** Horizons centre codes of simulation bodies */
const CENTERS = { sun: '500@10', mercury: '500@199', earth: '500@399', didymos: '@20065803' };

/**
 * id        simulation body id (spacecraft.ts)
 * target    Horizons COMMAND
 * segments  [{ center, start, stop, step }] — step in Horizons syntax ('1 h', '5 m', '1 d')
 */
const SPEC = [
  {
    id: 'bepicolombo', target: '-121', name: 'BepiColombo',
    segments: [
      { center: 'mercury', start: '2026-10-15', stop: '2026-11-19', step: '3 h' },
      { center: 'mercury', start: '2026-11-19', stop: '2026-11-26', step: '5 m' },
      { center: 'mercury', start: '2026-11-26', stop: '2026-12-16', step: '15 m' },
    ],
  },
  {
    id: 'europaclipper', target: '-159', name: 'Europa Clipper',
    segments: [
      { center: 'sun', start: '2026-10-15', stop: '2026-11-19', step: '12 h' },
      { center: 'earth', start: '2026-11-19', stop: '2026-12-17', step: '1 h' },
      { center: 'earth', start: '2026-12-03 08:00', stop: '2026-12-04 08:00', step: '1 m' },
      { center: 'sun', start: '2026-12-17', stop: '2027-02-15', step: '12 h' },
    ],
  },
  {
    id: 'hera', target: '-91', name: 'Hera',
    segments: [
      { center: 'didymos', start: '2026-10-01', stop: '2026-11-04 01:00', step: '1 h' },
    ],
  },
];

/** interstellar probes: heliocentric state at one epoch (straight-line model in the app) */
const PROBES = [
  { id: 'voyager1', target: '-31' }, { id: 'voyager2', target: '-32' },
  { id: 'pioneer10', target: '-23' }, { id: 'pioneer11', target: '-24' }, { id: 'newhorizons', target: '-98' },
];

const STEP_DAYS = { m: 1 / 1440, h: 1 / 24, d: 1 };

function q(params) {
  const u = new URL(API);
  // every value but `format` is quoted, as Horizons expects
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, k === 'format' ? v : `'${v}'`);
  return u.toString();
}

async function vectors(target, center, start, stop, step) {
  const url = q({
    format: 'text', COMMAND: target, OBJ_DATA: 'NO', MAKE_EPHEM: 'YES', EPHEM_TYPE: 'VECTORS',
    CENTER: center, START_TIME: start, STOP_TIME: stop, STEP_SIZE: step,
    REF_PLANE: 'ECLIPTIC', REF_SYSTEM: 'ICRF', VEC_TABLE: '2', OUT_UNITS: 'KM-S', CSV_FORMAT: 'YES', VEC_CORR: 'NONE',
  });
  const res = await fetch(url);
  const text = await res.text();
  const m = /\$\$SOE([\s\S]*?)\$\$EOE/.exec(text);
  if (!m) throw new Error(`Horizons returned no data for ${target} @ ${center} ${start}–${stop}:\n${text.slice(0, 600)}`);
  const rows = m[1].trim().split('\n').map((l) => l.split(',').map((s) => s.trim()));
  const src = /\{source: ([^}]+)\}/.exec(text)?.[1] ?? 'JPL Horizons';
  return {
    source: src,
    rows: rows.map((r) => ({ jd: parseFloat(r[0]), p: [parseFloat(r[2]), parseFloat(r[3]), parseFloat(r[4])], v: [parseFloat(r[5]), parseFloat(r[6]), parseFloat(r[7])] })),
  };
}

const round = (x, d) => Math.round(x * 10 ** d) / 10 ** d;

async function build(spec) {
  const segments = [];
  let source = '';
  for (const s of spec.segments) {
    const [n, unit] = s.step.split(' ');
    const step = parseFloat(n) * STEP_DAYS[unit];
    const { rows, source: src } = await vectors(spec.target, CENTERS[s.center], s.start, s.stop, s.step);
    source = src;
    // positions to 10 m: ample for a vehicle that is drawn as a point until you are within a few km
    const p = new Array(rows.length * 3);
    for (let i = 0; i < rows.length; i++) { p[i * 3] = round(rows[i].p[0], 2); p[i * 3 + 1] = round(rows[i].p[1], 2); p[i * 3 + 2] = round(rows[i].p[2], 2); }
    segments.push({ center: s.center, jd0: rows[0].jd, step, n: rows.length, p });
    console.log(`  ${spec.id} @${s.center} ${s.start} → ${s.stop} ${s.step}: ${rows.length} samples`);
  }
  // dense segments first so lookups prefer them where spans overlap
  segments.sort((a, b) => a.step - b.step);
  const out = {
    id: spec.id, name: spec.name, target: spec.target,
    source: `NASA/JPL Horizons (${source})`, frame: 'ecliptic J2000, km', fetched: new Date().toISOString().slice(0, 10),
    segments,
  };
  mkdirSync(OUT, { recursive: true });
  const file = join(OUT, `${spec.id}.json`);
  writeFileSync(file, JSON.stringify(out));
  console.log(`✔ ${file}`);
}

async function probes() {
  const epoch = '2026-10-22';
  console.log(`// NASA/JPL Horizons heliocentric states, ecliptic J2000, ${epoch} 00:00 TDB`);
  for (const pr of PROBES) {
    const { rows } = await vectors(pr.target, CENTERS.sun, epoch, '2026-10-23', '1 d');
    const r = rows[0];
    console.log(`${pr.id}: state(${r.jd}, [${r.p.map((x) => x.toExponential(6)).join(', ')}], [${r.v.map((x) => x.toFixed(4)).join(', ')}])`);
  }
}

const args = process.argv.slice(2);
if (args.includes('--probes')) await probes();
else {
  const only = args.filter((a) => !a.startsWith('--'));
  for (const spec of SPEC) if (!only.length || only.includes(spec.id)) await build(spec);
}
