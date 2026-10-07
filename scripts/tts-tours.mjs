/**
 * Generate the guided-tour narration with the xAI text-to-speech API (voice "altair").
 *
 *   XAI_API_KEY=… node scripts/tts-tours.mjs [--lang tr,en,de,es,fr] [--tour solar-system] [--force] [--dry]
 *
 * For every tour step and language it writes
 *   public/tours/<lang>/<tour>/<step>.mp3           (24 kHz, 64 kbps)
 *   public/tours/<lang>/<tour>.json                 { steps: { [stepId]: { duration, sentences: [{start,end,text}] } } }
 * The manifest's sentence timings (derived from the API's per-character timestamps) drive the
 * subtitles in `TourPlayer`. Existing files are kept unless --force is given, so re-running only
 * voices new or changed steps (a step is "changed" when its text hash differs from the manifest).
 *
 * Narration text: Turkish comes from src/data/tours.ts; other languages from the locale
 * dictionaries (src/i18n/locales/<lang>/data.json), the same strings the UI shows as subtitles.
 * The key is read from the environment only — never commit it.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

const ROOT = new URL('..', import.meta.url).pathname;
const OUT = join(ROOT, 'public', 'tours');
const API = 'https://api.x.ai/v1/tts';
const VOICE = 'altair';
const LANG_TAG = { tr: 'tr', en: 'en', de: 'de', es: 'es-ES', fr: 'fr' };
const CONCURRENCY = 4;

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : def;
};
const langs = opt('--lang', 'tr,en,de,es,fr').split(',');
const onlyTour = opt('--tour', null);
const force = args.includes('--force');
const dry = args.includes('--dry');
const key = process.env.XAI_API_KEY;
if (!key && !dry) {
  console.error('XAI_API_KEY is not set');
  process.exit(1);
}

const { TOURS } = await import('../src/data/tours.ts');

const dicts = {};
for (const l of langs) {
  if (l === 'tr') continue;
  const p = join(ROOT, 'src', 'i18n', 'locales', l, 'data.json');
  dicts[l] = existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : {};
}

const hash = (s) => createHash('sha1').update(s).digest('hex').slice(0, 12);

/** Split narration into sentences (keeps the punctuation) */
function sentences(text) {
  const out = [];
  const re = /[^.!?…]+[.!?…]+(?:["»”']+)?|[^.!?…]+$/g;
  let m;
  while ((m = re.exec(text))) {
    const s = m[0].trim();
    if (s) out.push(s);
  }
  // merge very short fragments (abbreviations, numbers like "4.6") into the previous sentence
  const merged = [];
  for (const s of out) {
    if (merged.length && (s.length < 12 || /^\d/.test(s))) merged[merged.length - 1] += ' ' + s;
    else merged.push(s);
  }
  return merged;
}

/** Map sentences onto the API's per-character timestamps */
function timeSentences(text, ts, duration) {
  const sents = sentences(text);
  const chars = ts?.graph_chars ?? [];
  const times = ts?.graph_times ?? [];
  const joined = chars.join('');
  const result = [];
  let cursor = 0;
  let fallback = false;
  for (const s of sents) {
    const probe = s.replace(/\s+/g, ' ');
    let idx = joined.indexOf(probe, cursor);
    if (idx < 0) { // whitespace may differ; try the first 20 chars
      idx = joined.indexOf(probe.slice(0, 20), cursor);
    }
    if (idx < 0 || !times[idx]) { fallback = true; break; }
    const end = Math.min(joined.length - 1, idx + probe.length - 1);
    result.push({ start: round(times[idx][0]), end: round(times[end]?.[1] ?? times[idx][1]), text: s });
    cursor = end + 1;
  }
  if (fallback || result.length !== sents.length) {
    // proportional estimate
    const total = sents.reduce((a, s) => a + s.length, 0);
    let t = 0;
    return sents.map((s) => {
      const d = (s.length / total) * duration;
      const r = { start: round(t), end: round(t + d), text: s };
      t += d;
      return r;
    });
  }
  // make the subtitles contiguous (no gaps while the voice pauses between sentences)
  for (let i = 0; i < result.length - 1; i++) result[i].end = result[i + 1].start;
  result[result.length - 1].end = round(duration);
  return result;
}
const round = (x) => Math.round(x * 1000) / 1000;

async function synthesize(text, lang) {
  const body = {
    text,
    voice_id: VOICE,
    language: LANG_TAG[lang] ?? lang,
    output_format: { codec: 'mp3', sample_rate: 24000, bit_rate: 64000 },
    speed: 1.0,
    text_normalization: true,
    with_timestamps: true,
  };
  for (let attempt = 0; attempt < 4; attempt++) {
    const r = await fetch(API, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (r.ok) {
      const j = await r.json();
      return { audio: Buffer.from(j.audio, 'base64'), duration: j.duration, ts: j.audio_timestamps };
    }
    const msg = await r.text();
    if (r.status === 429 || r.status >= 500) {
      await new Promise((res) => setTimeout(res, 1500 * (attempt + 1)));
      continue;
    }
    throw new Error(`${r.status} ${msg}`);
  }
  throw new Error('gave up after retries');
}

/** mp3 duration from the decoded audio is not available here; the API returns it */

let totalChars = 0;
const jobs = [];
for (const lang of langs) {
  for (const tour of TOURS) {
    if (onlyTour && tour.id !== onlyTour) continue;
    const dir = join(OUT, lang, tour.id);
    const manifestPath = join(OUT, lang, `${tour.id}.json`);
    const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : { voice: VOICE, locale: lang, steps: {} };
    manifest.voice = VOICE;
    manifest.locale = lang;
    const seen = new Set();
    for (const step of tour.steps) {
      const text = lang === 'tr' ? step.text : dicts[lang]?.[step.text];
      if (!text) {
        console.warn(`! ${lang}/${tour.id}/${step.id}: no ${lang} translation, skipping`);
        continue;
      }
      seen.add(step.id);
      const file = join(dir, `${step.id}.mp3`);
      const h = hash(text);
      const cur = manifest.steps[step.id];
      if (!force && cur && cur.hash === h && existsSync(file)) continue;
      totalChars += text.length;
      jobs.push({ lang, tour, step, text, file, dir, manifest, manifestPath, h });
    }
    // drop steps that no longer exist
    for (const id of Object.keys(manifest.steps)) if (!seen.has(id)) delete manifest.steps[id];
    if (!dry && seen.size) {
      mkdirSync(dir, { recursive: true });
      // nothing to synthesize for this tour → still rewrite so removed steps disappear
      if (!jobs.some((j) => j.manifest === manifest)) writeManifest(manifest, manifestPath);
    }
  }
}

function writeManifest(manifest, path) {
  const ordered = { voice: manifest.voice, locale: manifest.locale, steps: {} };
  for (const id of Object.keys(manifest.steps).sort()) ordered.steps[id] = manifest.steps[id];
  writeFileSync(path, JSON.stringify(ordered, null, 1) + '\n');
}

console.log(`${jobs.length} clips to synthesize, ${totalChars} characters ≈ $${((totalChars / 1e6) * 15).toFixed(2)}`);
if (dry) process.exit(0);

let done = 0;
let failed = 0;
const pending = new Set();
async function run(job) {
  const { lang, tour, step, text, file, manifest, h } = job;
  try {
    const { audio, duration, ts } = await synthesize(text, lang);
    writeFileSync(file, audio);
    manifest.steps[step.id] = { hash: h, duration: round(duration), sentences: timeSentences(text, ts, duration) };
    done++;
    console.log(`✓ ${lang}/${tour.id}/${step.id}  ${duration.toFixed(1)} s  ${(audio.length / 1024).toFixed(0)} KB`);
  } catch (e) {
    failed++;
    console.error(`✗ ${lang}/${tour.id}/${step.id}: ${e.message}`);
  } finally {
    // persist after every clip so an interrupted run keeps its progress
    pending.add(manifest);
    for (const m of pending) writeManifest(m, jobs.find((j) => j.manifest === m).manifestPath);
    pending.clear();
  }
}

const queue = [...jobs];
await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
  while (queue.length) await run(queue.shift());
}));
console.log(`done: ${done} ok, ${failed} failed`);
process.exit(failed ? 1 : 0);
