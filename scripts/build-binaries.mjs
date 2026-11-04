#!/usr/bin/env node
/**
 * Measured multiple stars for the Hipparcos stars of the catalogue → public/data/binaries.json
 *
 *   node scripts/build-binaries.mjs --dir <folder with the files below>
 *
 * Sources
 *   msc/sys.tsv, msc/comp.tsv, msc/orb.tsv   Tokovinin's Multiple Star Catalogue (2018ApJS..235....6T,
 *                                            VizieR J/ApJS/235/6, current version from www.ctio.noirlab.edu/~atokovin/stars)
 *   orb6orbits.txt                           Sixth Catalog of Orbits of Visual Binary Stars (USNO; Hartkopf, Mason & Worley)
 *
 * Output: { sources, systems: { [HIP]: NodeSpec } } in the shape of src/gen/Multiplicity.ts —
 * 'primary' is the catalogue star itself, companions carry their kind, mass and spectral type,
 * pairs their period (days) and eccentricity. Triples and higher come from the MSC (its hierarchy,
 * masses and periods); plain binaries from ORB6, the secondary's mass from the magnitude difference.
 * Branches that are separate catalogue stars (their own HIP) are left out; the runtime also drops
 * levels wider than the distance to the star's nearest catalogue neighbour.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const arg = (k) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : undefined; };
const DIR = arg('dir') ?? '/tmp/yeis-cat2';
const outFile = resolve(dirname(fileURLToPath(import.meta.url)), '../public/data/binaries.json');

const YEAR = 365.25;
/** wider levels are separate catalogue stars as a rule (and leave the system's scale) */
const MAX_PERIOD_DAYS = 2e5 * YEAR;
const num = (s) => { const v = parseFloat(s); return Number.isFinite(v) ? v : 0; };
const round = (v, d) => { const f = 10 ** d; return Math.round(v * f) / f; };
const sig = (v, n = 4) => +v.toPrecision(n);

/* ---------- companion physics from the MSC columns ---------- */

function kindOf(sp, mass) {
  if (/^D[ABCOQZX]?/.test(sp) && !/^dM/.test(sp)) return 'wd';
  if (/^W[RNC]/.test(sp)) return 'wr';
  if ((mass > 0 && mass < 0.075) || /^[LTY]\d/.test(sp)) return 'bd';
  if (/[\d.](\s*)(Ia|Ib|III|II|I)(?!V)/.test(sp)) return 'giant';
  return 'ms';
}

/** effective temperature (K) of a spectral class (dwarf scale, Pecaut & Mamajek 2013) */
const TEFF = { O: [44900, 30000], B: [30000, 9700], A: [9700, 7200], F: [7200, 5900], G: [5900, 5200], K: [5200, 3850], M: [3850, 2300] };
function spTemperature(sp) {
  const m = /^([OBAFGKM])(\d(?:\.\d)?)?/.exec(sp);
  if (!m) return 0;
  const [hot, cool] = TEFF[m[1]];
  const sub = m[2] !== undefined ? parseFloat(m[2]) : 5;
  return Math.round(hot * Math.pow(cool / hot, sub / 10));
}

/** physical companion from an MSC component: kind, mass, and (when typed) temperature and radius */
function companion(sp, mass) {
  const kind = kindOf(sp, mass);
  const spec = { kind, massSolar: round(mass, 3) };
  if (sp) spec.spectral = sp;
  const T = kind === 'ms' || kind === 'giant' ? spTemperature(sp) : 0;
  if (T) {
    spec.temperature = T;
    // hot (super)giants: a few times the main-sequence radius; the cool ones keep the generic red-giant size
    if (kind === 'giant' && T > 7000) spec.radiusSolar = round(Math.pow(mass, 0.57) * (/(Ia|Ib|I)(?![IV])/.test(sp) && !/III|II/.test(sp) ? 4 : 2), 2);
  }
  return spec;
}

/* ---------- MSC ---------- */

const tsv = (f) => readFileSync(join(DIR, 'msc', f), 'utf8').split(/\r?\n/).filter((l) => l.includes('|')).map((l) => l.split('|').map((s) => s.trim()));

const sysByWds = new Map();
for (const f of tsv('sys.tsv')) {
  const [wds, P, S, parent, type, per, punit, sep, sunit, , v1, sp1, v2, sp2, m1, mc1, m2, mc2] = f;
  if (/X/.test(type)) continue; // optical
  const unit = { d: 1, y: YEAR, k: 1000 * YEAR, M: 1e6 * YEAR }[punit] ?? 0;
  const sepArcsec = num(sep) * ({ '"': 1, m: 1e-3, "'": 60 }[sunit] ?? 0);
  const row = { P, S, parent, periodDays: num(per) * unit, sepArcsec, v1: num(v1), v2: num(v2), sp1, sp2, m1: num(m1), mc1, m2: num(m2), mc2 };
  (sysByWds.get(wds) ?? sysByWds.set(wds, []).get(wds)).push(row);
}
const orbE = new Map();
for (const f of tsv('orb.tsv')) {
  const [wds, system, , , e] = f;
  const [P, S] = system.split(/[,.]/);
  // a handful of rows carry e ≥ 1 (typos in the source): an orbit needs 0 ≤ e < 1, else e is unknown
  const ecc = num(e);
  if (P && S && ecc >= 0 && ecc < 1) orbE.set(`${wds}|${P}|${S}`, ecc);
}
const compsByWds = new Map();
for (const f of tsv('comp.tsv')) {
  const [wds, , , plx, , , , , label, , sp, hip] = f;
  (compsByWds.get(wds) ?? compsByWds.set(wds, []).get(wds)).push({ label, hip: parseInt(hip, 10) || 0, plx: num(plx), sp });
}

const systems = {};
let mscCount = 0, mscLeaves = 0;
for (const [wds, rows] of sysByWds) {
  const comps = compsByWds.get(wds) ?? [];
  const plx = comps.find((c) => c.plx > 0)?.plx ?? 0;
  const rowOf = (label) => rows.find((r) => r.P === label || r.S === label);
  const subRow = (label) => rows.find((r) => r.parent === label);
  const labelsUnder = (label, out = new Set()) => {
    out.add(label);
    const r = subRow(label);
    if (r) { labelsUnder(r.P, out); labelsUnder(r.S, out); }
    return out;
  };
  const leafInfo = (label) => {
    const r = rowOf(label);
    if (!r) return { mass: 0, sp: '', v: 0 };
    return r.P === label
      ? { mass: r.mc1 === 's' ? 0 : r.m1, sp: r.sp1, v: r.v1 }
      : { mass: r.mc2 === 's' ? 0 : r.m2, sp: r.sp2, v: r.v2 };
  };
  const periodOf = (r, mass) => {
    if (r.periodDays > 0) return r.periodDays;
    if (!(r.sepArcsec > 0 && plx > 0 && mass > 0)) return 0;
    // projected separation → a (statistical factor 1.26), Kepler's third law
    const a = (r.sepArcsec * 1000 / plx) * 1.26;
    return Math.sqrt((a * a * a) / mass) * YEAR;
  };
  const massOf = (label) => {
    const r = subRow(label);
    if (!r) return leafInfo(label).mass;
    return massOf(r.P) + massOf(r.S);
  };

  /** NodeSpec of a label; `onPath`: this branch holds the catalogue star (its first leaf becomes 'primary') */
  const expand = (label, onPath, refMass) => {
    const r = subRow(label);
    if (!r) {
      if (onPath) return 'primary';
      const info = leafInfo(label);
      let mass = info.mass;
      if (!(mass > 0)) mass = refMass > 0 ? refMass * (info.v > 0 && leafInfo(rows[0].P).v > 0 ? 10 ** (-0.1 * Math.max(0, info.v - leafInfo(rows[0].P).v)) : 0.5) : 0.5;
      mscLeaves++;
      return companion(info.sp, mass);
    }
    const mA = massOf(r.P) || 1, mB = massOf(r.S) || mA * 0.5;
    const a = expand(r.P, onPath, mA);
    const periodDays = periodOf(r, mA + mB);
    if (!(periodDays > 0) || periodDays > MAX_PERIOD_DAYS) return a;
    const b = expand(r.S, false, mA);
    const e = orbE.get(`${wds}|${r.P}|${r.S}`);
    const spec = { pair: [a, b], periodDays: sig(periodDays, 5), e: e !== undefined ? round(e, 3) : round(Math.min(0.5, 0.1 * Math.log10(Math.max(periodDays, 10))), 2) };
    if (e === undefined) spec.uncertain = true;
    return spec;
  };

  for (const c of comps) {
    if (!c.hip || systems[c.hip]) continue;
    // climb from the HIP component while the other side is not a catalogue star of its own
    let node = c.label;
    for (let guard = 0; guard < 8; guard++) {
      const r = rowOf(node);
      if (!r || r.parent === 't') break;
      const other = r.P === node ? r.S : r.P;
      if (comps.some((o) => o.hip && o.hip !== c.hip && labelsUnder(other).has(o.label))) break;
      if (periodOf(r, massOf(r.P) + massOf(r.S)) > MAX_PERIOD_DAYS) break;
      // the root pair's composite has no label of its own
      node = r.parent === '*' ? '*root' : r.parent;
      if (node === '*root') break;
    }
    let tree;
    if (node === '*root') {
      const r = rows.find((x) => x.parent === '*');
      const mA = massOf(r.P) || 1, mB = massOf(r.S) || mA * 0.5;
      const periodDays = periodOf(r, mA + mB);
      const a = expand(r.P, true, mA);
      if (periodDays > 0 && periodDays <= MAX_PERIOD_DAYS) {
        const e = orbE.get(`${wds}|${r.P}|${r.S}`);
        tree = { pair: [a, expand(r.S, false, mA)], periodDays: sig(periodDays, 5), e: e !== undefined ? round(e, 3) : round(Math.min(0.5, 0.1 * Math.log10(Math.max(periodDays, 10))), 2) };
        if (e === undefined) tree.uncertain = true;
      } else tree = a;
    } else tree = expand(node, true, massOf(node));
    if (tree === 'primary') continue;
    systems[c.hip] = tree;
    mscCount++;
  }
}
console.log(`MSC: ${sysByWds.size} systems → ${mscCount} catalogue stars, ${mscLeaves} companions`);

/* ---------- ORB6: binaries not in the MSC ---------- */

let orbCount = 0;
{
  const best = new Map();
  for (const l of readFileSync(join(DIR, 'orb6orbits.txt'), 'utf8').split(/\r?\n/)) {
    if (!/^\d{6}\.\d\d[+-]\d{6}/.test(l)) continue;
    const hip = parseInt(l.slice(58, 64), 10);
    if (!hip || systems[hip]) continue;
    const grade = parseInt(l.slice(233, 234), 10);
    if (!(grade >= 1) || grade === 5) continue; // 5: indeterminate
    const pUnit = { y: YEAR, d: 1, h: 1 / 24, m: 1 / 1440, c: 100 * YEAR }[l[92]];
    const P = num(l.slice(81, 92)) * (pUnit ?? 0);
    const e = num(l.slice(187, 195));
    if (!(P > 0) || e >= 1) continue;
    const v1 = num(l.slice(66, 71)), v2 = num(l.slice(73, 78));
    const aArcsec = num(l.slice(105, 114)) * ({ a: 1, m: 1e-3, M: 60 }[l[114]] ?? 0);
    // 8, 9: interferometric / astrometric orbits (definitive enough)
    const rank = grade >= 8 ? 2.5 : grade;
    const prev = best.get(hip);
    if (prev && prev.rank <= rank) continue;
    best.set(hip, { rank, P, e, dv: v1 > 0 && v2 > 0 ? v2 - v1 : null, aArcsec, uncertain: grade === 4 });
  }
  // [period (days), e, V2 − V1 (null: unknown), a (arcsec, 0: unknown), preliminary]
  for (const [hip, o] of best) {
    systems[hip] = { orb: [sig(o.P, 6), round(o.e, 4), o.dv === null ? null : round(o.dv, 2), sig(o.aArcsec, 4), o.uncertain ? 1 : 0] };
    orbCount++;
  }
}
console.log(`ORB6: ${orbCount} further binaries`);

const json = JSON.stringify({
  sources: {
    msc: 'Multiple Star Catalogue (Tokovinin 2018, ApJS 235, 6)',
    orb6: 'Sixth Catalog of Orbits of Visual Binary Stars (USNO)',
  },
  systems,
});
writeFileSync(outFile, json);
console.log(`binaries.json: ${Object.keys(systems).length} stars, ${(json.length / 1e6).toFixed(2)} MB`);
