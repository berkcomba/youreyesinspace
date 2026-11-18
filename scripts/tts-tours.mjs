/**
 * Generate the guided-tour narration with ElevenLabs text-to-speech (model eleven_v4, one narrator
 * voice per language, VOICES below).
 *
 *   ELEVENLABS_API_KEY=… node scripts/tts-tours.mjs [--lang tr,en,de,es,fr] [--tour solar-system | events/<id> | events]
 *       [--step <stepId>] [--force] [--dry] [--max-chars N]
 *
 * --max-chars stops queuing once that many characters are booked (the plan's monthly quota); the
 * rest is voiced on a later run, since finished clips are kept. A clip voiced by another voice (an
 * earlier engine) counts as changed and is redone.
 *
 * For every tour step (and every sky event's scene, under events/<id>) and language it writes
 *   public/tours/<lang>/<tour>/<step>.mp3           (24 kHz, 64 kbps)
 *   public/tours/<lang>/<tour>.json                 { steps: { [stepId]: { duration, sentences: [{start,end,text}] } } }
 * The manifest's sentence timings (derived from the API's per-character timestamps) drive the
 * subtitles in `TourPlayer`. Existing files are kept unless --force is given, so re-running only
 * voices new or changed steps (a step is "changed" when its text hash or the voice differs from
 * the manifest).
 *
 * Narration text: Turkish comes from src/data/tours.ts; other languages from the locale
 * dictionaries (src/i18n/locales/<lang>/data.json), the same strings the UI shows as subtitles.
 * The key is read from the environment only — never commit it.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { register } from 'node:module';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const ROOT = new URL('..', import.meta.url).pathname;
const OUT = join(ROOT, 'public', 'tours');
const API = 'https://api.elevenlabs.io/v1/text-to-speech';
const MODEL = 'eleven_v4';
const FORMAT = 'mp3_44100_64';
/** narrator per language (ElevenLabs voice ids) */
const VOICES = {
  en: 'bspuYFxLiTNbJCeVTjFX', // Rick – Science Communicator
  tr: 'DpEiQMnL9WxMsymCsjPY', // Emrullah Uzun – Storyteller
  de: 'kkJxCnlRCckmfFvzDW5Q', // Alexander – Deep TV Narrator
  es: '5egO01tkUjEzu7xSSE8M', // Carmelo – Mature, Mysterious and Clear (Castilian)
  fr: 'Qrl71rx6Yg8RvyPYRGCQ', // Guillaume – Narrator
};
const voiceOf = (lang) => `elevenlabs:${MODEL}:${VOICES[lang]}`;
/** the plan's concurrency limit (Starter: 3) */
const CONCURRENCY = 3;

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : def;
};
const langs = opt('--lang', 'tr,en,de,es,fr').split(',');
const onlyTour = opt('--tour', null);
/** one step of the tour only (--tour must name it) */
const onlyStep = opt('--step', null);
const force = args.includes('--force');
const dry = args.includes('--dry');
const maxChars = Number(opt('--max-chars', 'Infinity'));
const key = process.env.ELEVENLABS_API_KEY;
if (!key && !dry) {
  console.error('ELEVENLABS_API_KEY is not set');
  process.exit(1);
}

// the data modules import each other without extensions (Vite style); resolve those to .ts
register('data:text/javascript,' + encodeURIComponent(`
  export async function resolve(spec, ctx, next) {
    try { return await next(spec, ctx); }
    catch (e) { if (spec.startsWith('.') && !/\\.\\w+$/.test(spec)) return next(spec + '.ts', ctx); throw e; }
  }`));
const { TOURS } = await import('../src/data/tours.ts');
const { EVENTS, eventTour } = await import('../src/data/events.ts');
// events play as one-scene tours whose audio lives under tours/<lang>/events/<id>
const ALL = [...TOURS, ...EVENTS.map(eventTour)];
const audioId = (tour) => tour.audio ?? tour.id;

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
/** set when the last timeSentences() fell back to the proportional estimate */
let estimated = false;
function timeSentences(text, ts, duration) {
  estimated = false;
  const sents = sentences(text);
  const chars = ts?.characters ?? [];
  const times = chars.map((_, i) => [ts.character_start_times_seconds[i], ts.character_end_times_seconds[i]]);
  // matched without whitespace: the sentence splitter re-joins merged fragments ("4." + "6 …")
  // with a space the spoken text does not have, and the engine may collapse or add spaces
  const flat = [];
  const at = [];
  chars.forEach((c, i) => { if (!/\s/.test(c)) { flat.push(c); at.push(i); } });
  const joined = flat.join('');
  const result = [];
  let cursor = 0;
  let fallback = false;
  for (const s of sents) {
    const probe = s.replace(/\s+/g, '');
    let idx = joined.indexOf(probe, cursor);
    if (idx < 0) idx = joined.indexOf(probe.slice(0, 16), cursor);
    if (idx < 0) { fallback = true; break; }
    const end = Math.min(joined.length - 1, idx + probe.length - 1);
    result.push({ start: round(times[at[idx]][0]), end: round(times[at[end]][1]), text: s });
    cursor = end + 1;
  }
  if (fallback || result.length !== sents.length) {
    estimated = true;
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
  const body = { text, model_id: MODEL, language_code: lang };
  for (let attempt = 0; attempt < 5; attempt++) {
    const r = await fetch(`${API}/${VOICES[lang]}/with-timestamps?output_format=${FORMAT}`, {
      method: 'POST',
      headers: { 'xi-api-key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (r.ok) {
      const j = await r.json();
      return { audio: Buffer.from(j.audio_base64, 'base64'), ts: j.alignment };
    }
    const msg = await r.text();
    if (r.status === 429 || r.status >= 500) {
      await new Promise((res) => setTimeout(res, 2000 * (attempt + 1)));
      continue;
    }
    throw new Error(`${r.status} ${msg}`);
  }
  throw new Error('gave up after retries');
}

/** the clip's length, from the written file (the API returns only the character timings) */
function mp3Duration(file) {
  return Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]).toString().trim());
}


let totalChars = 0;
const jobs = [];
for (const lang of langs) {
  for (const tour of ALL) {
    if (onlyTour && tour.id !== onlyTour && audioId(tour) !== onlyTour && !(onlyTour === 'events' && audioId(tour).startsWith('events/'))) continue;
    const dir = join(OUT, lang, audioId(tour));
    const manifestPath = join(OUT, lang, `${audioId(tour)}.json`);
    const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : { voice: voiceOf(lang), locale: lang, steps: {} };
    // a step voiced by another voice / engine is redone (its entry keeps its voice until then)
    for (const st of Object.values(manifest.steps)) st.voice ??= manifest.voice;
    manifest.voice = voiceOf(lang);
    manifest.locale = lang;
    const seen = new Set();
    for (const step of tour.steps) {
      const text = lang === 'tr' ? step.text : dicts[lang]?.[step.text];
      if (!text) {
        console.warn(`! ${lang}/${tour.id}/${step.id}: no ${lang} translation, skipping`);
        continue;
      }
      seen.add(step.id);
      if (onlyStep && step.id !== onlyStep) continue;
      const file = join(dir, `${step.id}.mp3`);
      const h = hash(text);
      const cur = manifest.steps[step.id];
      if (!force && cur && cur.hash === h && cur.voice === voiceOf(lang) && !cur.estimated && existsSync(file)) continue;
      if (totalChars + text.length > maxChars) continue;
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

console.log(`${jobs.length} clips to synthesize, ${totalChars} characters (ElevenLabs credits)`);
if (dry) process.exit(0);

let done = 0;
let failed = 0;
const pending = new Set();
async function run(job) {
  const { lang, tour, step, text, file, manifest, h } = job;
  try {
    const { audio, ts } = await synthesize(text, lang);
    writeFileSync(file, audio);
    const duration = mp3Duration(file);
    const sentences = timeSentences(text, ts, duration);
    manifest.steps[step.id] = { hash: h, voice: voiceOf(lang), duration: round(duration), sentences, ...(estimated ? { estimated: true } : {}) };
    if (estimated) console.warn(`  (subtitle timings of ${lang}/${tour.id}/${step.id} estimated: redone on the next run)`);
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
