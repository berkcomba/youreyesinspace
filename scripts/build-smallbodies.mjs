#!/usr/bin/env node
/**
 * Real Solar System small bodies from the JPL Small-Body Database (SBDB query API):
 *   public/data/smallbodies.bin   — orbits for the GPU belts (28 bytes / body)
 *   public/data/smallbodies.json  — groups + designation, name and physical data per body
 *
 * Input: the JSON pages written by the SBDB query API with
 *   fields=pdes,name,class,neo,pha,epoch,e,a,i,om,w,ma,H,diameter,albedo,rot_per,spec_T,spec_B
 * (asteroids; NEOs, Mars-crossers, Trojans, Centaurs, TNOs, Hildas and the main belt to H 16) and
 *   fields=full_name,pdes,name,prefix,class,neo,pha,kind,epoch,e,a,q,i,om,w,ma,tp,H,G,M1,K1,diameter,albedo,rot_per,spec_B,spec_T
 * (comets). Elements are heliocentric, ecliptic J2000; the mean anomaly is carried to J2000 so
 * the app can propagate every body from one epoch.
 *
 * usage: node scripts/build-smallbodies.mjs --sbdb /path/to/sbdb-dir
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith('--') ? [...acc, [a.slice(2), all[i + 1]]] : acc), []));
if (!args.sbdb) { console.error('usage: build-smallbodies.mjs --sbdb DIR'); process.exit(1); }
const outDir = resolve(import.meta.dirname, '../public/data');

const J2000 = 2451545.0;
const K_GAUSS = 0.01720209895; // rad/day for a = 1 AU
const DEG = Math.PI / 180;
const TAU = Math.PI * 2;

/** bodies already modelled by hand in src/data/solarSystem.ts: SBDB designation → body id */
const HAND_MADE = {
  1: 'ceres', 4: 'vesta', 134340: 'pluto', 136199: 'eris', 136108: 'haumea', 136472: 'makemake', 225088: 'gonggong',
  50000: 'quaoar', 90482: 'orcus', 90377: 'sedna', 65803: 'didymos', 3200: 'phaethon',
  '1P': 'halley', '55P': 'tempeltuttle', '2P': 'encke', '8P': 'tuttle',
};

const GROUPS = [
  { key: 'main', name: 'Asteroit Kuşağı', classes: ['IMB', 'MBA', 'OMB', 'MCA', 'AST'] },
  { key: 'neo', name: "Dünya'ya yakın cisimler", classes: ['IEO', 'ATE', 'APO', 'AMO'] },
  { key: 'trojan', name: 'Truva Asteroitleri', classes: ['TJN'] },
  { key: 'outer', name: 'Kentaurlar ve Kuiper Kuşağı', classes: ['CEN', 'TNO', 'PAA', 'HYA'] },
  { key: 'comet', name: 'Kuyruklu yıldızlar', classes: [] },
];
const groupOf = new Map(GROUPS.flatMap((g, k) => g.classes.map((c) => [c, k])));
const CLASSES = ['IEO', 'ATE', 'APO', 'AMO', 'MCA', 'IMB', 'MBA', 'OMB', 'TJN', 'CEN', 'TNO', 'PAA', 'HYA', 'AST', 'JFc', 'JFC', 'HTC', 'ETc', 'CTc', 'COM', 'PAR', 'HYP'];

const num = (v) => (v === null || v === undefined || v === '' ? null : +v);
const lists = GROUPS.map(() => []);
let skipped = 0, hand = 0;

for (const file of readdirSync(args.sbdb).filter((f) => f.endsWith('.json')).sort()) {
  const page = JSON.parse(readFileSync(resolve(args.sbdb, file), 'utf8'));
  const F = Object.fromEntries(page.fields.map((f, k) => [f, k]));
  const comet = 'M1' in F;
  for (const r of page.data) {
    const get = (k) => (F[k] === undefined ? null : r[F[k]]);
    const pdes = String(get('pdes')).trim();
    const cls = get('class');
    const e = num(get('e')), i = num(get('i')), om = num(get('om')), w = num(get('w'));
    if (e === null || i === null || om === null || w === null || e >= 1) { skipped++; continue; }
    let a, M0;
    if (comet) {
      const q = num(get('q')), tp = num(get('tp'));
      if (q === null || tp === null) { skipped++; continue; }
      a = q / (1 - e);
      M0 = (K_GAUSS / Math.pow(a, 1.5)) * (J2000 - tp);
    } else {
      a = num(get('a'));
      const ma = num(get('ma')), epoch = num(get('epoch'));
      if (a === null || ma === null || epoch === null) { skipped++; continue; }
      M0 = ma * DEG + (K_GAUSS / Math.pow(a, 1.5)) * (J2000 - epoch);
    }
    if (!(a > 0) || a > 2000) { skipped++; continue; }
    M0 = ((M0 % TAU) + TAU) % TAU;
    const g = comet ? GROUPS.length - 1 : groupOf.get(cls);
    if (g === undefined) { skipped++; continue; }
    const H = comet ? num(get('M1')) : num(get('H'));
    const handId = HAND_MADE[pdes];
    if (handId) hand++;
    lists[g].push({
      pdes, name: (get('name') ?? '').trim(), cls, a, e, i: i * DEG, om: om * DEG, w: w * DEG, M0, H,
      neo: get('neo') === 'Y', pha: get('pha') === 'Y',
      diam: num(get('diameter')), alb: num(get('albedo')), rot: num(get('rot_per')), spec: get('spec_T') || get('spec_B') || '',
      hand: handId ?? '',
    });
  }
}

const byH = (x, y) => (x.H ?? 99) - (y.H ?? 99);
for (const l of lists) l.sort(byH);
const all = lists.flat();

/* ---- binary: 16-byte header, then 28-byte records ---- */
const REC = 28;
const buf = Buffer.alloc(16 + all.length * REC);
buf.write('YESB', 0, 'ascii');
buf.writeUInt32LE(1, 4);
buf.writeUInt32LE(all.length, 8);
buf.writeUInt32LE(REC, 12);
all.forEach((b, k) => {
  const o = 16 + k * REC;
  buf.writeFloatLE(b.a, o);
  buf.writeFloatLE(b.e, o + 4);
  buf.writeFloatLE(b.i, o + 8);
  buf.writeFloatLE(b.om, o + 12);
  buf.writeFloatLE(b.w, o + 16);
  buf.writeFloatLE(b.M0, o + 20);
  buf.writeInt16LE(b.H === null ? 32767 : Math.round(b.H * 100), o + 24);
  buf.writeUInt8(Math.max(0, CLASSES.indexOf(b.cls)), o + 26);
  buf.writeUInt8((b.neo ? 1 : 0) | (b.pha ? 2 : 0) | (b.hand ? 4 : 0), o + 27);
});
writeFileSync(resolve(outDir, 'smallbodies.bin'), buf);

/* ---- sidecar: one tab-separated line per body ---- */
const f = (v, d) => (v === null ? '' : String(+v.toFixed(d)));
const rows = all.map((b) => [b.pdes, b.name, f(b.diam, 3), f(b.alb, 3), f(b.rot, 3), b.spec, b.hand].join('\t').replace(/\t+$/, ''));
let first = 0;
const groups = GROUPS.map((g, k) => { const out = { key: g.key, name: g.name, first, count: lists[k].length }; first += lists[k].length; return out; });
writeFileSync(resolve(outDir, 'smallbodies.json'), JSON.stringify({
  source: 'NASA/JPL Small-Body Database', fetched: new Date().toISOString().slice(0, 10), classes: CLASSES, groups, rows: rows.join('\n'),
}));

console.log(`small bodies: ${all.length} (${groups.map((g) => `${g.key} ${g.count}`).join(', ')}), ${hand} hand-made matched, ${skipped} skipped`);
console.log(`smallbodies.bin ${(buf.length / 1e6).toFixed(2)} MB`);
