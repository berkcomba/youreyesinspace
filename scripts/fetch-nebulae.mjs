#!/usr/bin/env node
// Downloads public-domain / CC BY photographs of the deep-sky landmarks from Wikimedia Commons,
// crops them square and resizes them to 512 px (macOS `sips`), writing public/nebulae/<id>.jpg.
// The per-object credits live in src/data/landmarkImages.ts — keep both in sync.
//
//   node scripts/fetch-nebulae.mjs            # all
//   node scripts/fetch-nebulae.mjs m42 m1     # subset
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const OUT = 'public/nebulae';
const SIZE = 512;
const UA = 'YourEyesInSpace/0.3 (https://youreyesinspace.com; asset pipeline)';

/** id → Commons file title (without "File:") */
const FILES = {
  m42: 'Orion Nebula - Hubble 2006 mosaic 18000.jpg',
  carina: 'Carina Nebula by ESO.jpg',
  m16: 'Eagle Nebula from ESO.jpg',
  m8: 'Lagoon Nebula (ESO).jpg',
  m1: 'Crab Nebula.jpg',
  m57: 'M57 The Ring Nebula.JPG',
  m27: 'M27 - Dumbbell Nebula.jpg',
  helix: 'NGC7293 (2004).jpg',
  casa: 'Cassiopeia A Spitzer Crop.jpg',
  '30dor': 'Tarantula Nebula TRAPPIST.jpg',
  sn1987a: 'SN 1987A HST.jpg',
  ngc346: 'Stellar sculptors in NGC 346 (heic2502a).jpg',
  ngc604: 'NGC 604.jpg',
  pleiades: 'Pleiades large.jpg',
  omegacen: 'Omega Centauri by ESO.jpg',
};

const want = process.argv.slice(2);
mkdirSync(OUT, { recursive: true });

async function fetchBuf(url) {
  const r = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow' });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return Buffer.from(await r.arrayBuffer());
}

function sipsSize(file) {
  const out = execFileSync('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', file]).toString();
  const w = +/pixelWidth: (\d+)/.exec(out)[1];
  const h = +/pixelHeight: (\d+)/.exec(out)[1];
  return [w, h];
}

for (const [id, title] of Object.entries(FILES)) {
  if (want.length && !want.includes(id)) continue;
  const dest = join(OUT, `${id}.jpg`);
  const tmp = `/tmp/nebula-${id}-src.jpg`;
  try {
    // Special:FilePath with ?width= gives a server-side thumbnail (saves pulling 40 MB originals)
    const url = `https://commons.wikimedia.org/w/index.php?title=Special:FilePath/${encodeURIComponent(title)}&width=1400`;
    writeFileSync(tmp, await fetchBuf(url));
    const [w, h] = sipsSize(tmp);
    const s = Math.min(w, h);
    execFileSync('sips', ['-c', String(s), String(s), tmp, '--out', tmp], { stdio: 'ignore' });
    execFileSync('sips', ['-Z', String(SIZE), '-s', 'format', 'jpeg', '-s', 'formatOptions', '82', tmp, '--out', dest], { stdio: 'ignore' });
    console.log(`${id}: ${w}x${h} → ${dest}`);
  } catch (e) {
    console.error(`${id}: FAILED ${e.message}`);
  }
}
console.log(existsSync(OUT) ? 'done' : 'nothing written');
