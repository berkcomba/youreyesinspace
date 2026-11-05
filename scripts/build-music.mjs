/**
 * Index the background-music library: every audio file in public/music/ becomes an entry of
 * public/music/music.json, which src/audio/Music.ts reads at start.
 *
 *   node scripts/build-music.mjs
 *
 * Title and artist are taken from the file name ("Artist - Title.mp3" or "Title.mp3"); entries
 * already in music.json keep whatever was edited by hand (title, artist, license, url), so run
 * the script again after adding files and fill the licence lines in the json afterwards. Only
 * royalty-free / Creative Commons music belongs here, and its licence must be named.
 */
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const DIR = join(ROOT, 'public', 'music');
const OUT = join(DIR, 'music.json');
const AUDIO = /\.(mp3|ogg|m4a|aac|opus|webm|wav|flac)$/i;

if (!existsSync(DIR)) {
  console.error(`no ${DIR}: create it and drop the tracks in`);
  process.exit(1);
}
const old = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : { tracks: [] };
const known = new Map((old.tracks ?? []).map((t) => [t.file, t]));

const files = readdirSync(DIR).filter((f) => AUDIO.test(f)).sort((a, b) => a.localeCompare(b, 'en'));
// entries already in the json keep their order (it decides which scene gets which track);
// new files are appended
const present = new Set(files);
const tracks = (old.tracks ?? []).filter((t) => present.has(t.file));
for (const file of files) {
  if (known.has(file)) continue;
  const stem = file.replace(AUDIO, '').replace(/[_]+/g, ' ').trim();
  const m = /^(.+?)\s+-\s+(.+)$/.exec(stem);
  tracks.push(m ? { file, title: m[2], artist: m[1], license: '' } : { file, title: stem, license: '' });
}

writeFileSync(OUT, JSON.stringify({ tracks }, null, 2) + '\n');
console.log(`${tracks.length} track(s) → public/music/music.json`);
for (const t of tracks) if (!t.license) console.log(`  licence missing: ${t.file}`);
