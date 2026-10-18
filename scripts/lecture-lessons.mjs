/**
 * Academy narration: write a lecturer's spoken script for every lesson step with the xAI chat
 * API, then voice it with the xAI text-to-speech API (voice "altair", English only).
 *
 *   XAI_API_KEY=… node scripts/lecture-lessons.mjs [--section greek-tradition] [--scripts-only] [--tts-only] [--force] [--dry] [--model grok-4.7]
 *
 * Writes
 *   public/lessons/en/<section>/<step>.mp3
 *   public/lessons/en/<section>.json   { steps: { [stepId]: { hash, script, duration, sentences: [{start,end,text}] } } }
 * A step is re-scripted when the hash of its slide content changes (or --force); it is re-voiced
 * when its script changes. Progress is persisted after every clip. The key is read from the
 * environment only — never commit it.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { request } from 'node:https';

const ROOT = new URL('..', import.meta.url).pathname;
const OUT = join(ROOT, 'public', 'lessons', 'en');
const CHAT_API = 'https://api.x.ai/v1/chat/completions';
const TTS_API = 'https://api.x.ai/v1/tts';
const VOICE = 'altair';

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : def; };
const onlySection = opt('--section', null);
const model = opt('--model', 'grok-4.7');
const force = args.includes('--force');
const dry = args.includes('--dry');
const scriptsOnly = args.includes('--scripts-only');
const ttsOnly = args.includes('--tts-only');
const key = process.env.XAI_API_KEY;
if (!key && !dry) { console.error('XAI_API_KEY is not set'); process.exit(1); }

const { COURSE } = await import('../src/data/lessons.ts');

const hash = (s) => createHash('sha1').update(s).digest('hex').slice(0, 12);
const round = (x) => Math.round(x * 1000) / 1000;
const strip = (html) => html.replace(/<sub>(.*?)<\/sub>/g, '_$1').replace(/<sup>(.*?)<\/sup>/g, '^$1').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();

function postJson(url, body) {
  return new Promise((resolve, reject) => {
    const req = request(url, { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' } }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, text: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('error', reject);
    req.setTimeout(12 * 60 * 1000, () => req.destroy(new Error('request timed out')));
    req.end(JSON.stringify(body));
  });
}

/* ------------------------------------------------------------- slide → text */

const WIDGETS = {
  models: 'an interactive animation of Mars\'s retrograde loop: a top-down orbit view (Ptolemy\'s epicycle or the Copernican orbits) above a strip showing Mars\'s path against the zodiac',
  eudoxus: 'an interactive model of Eudoxus\'s two nested spheres tracing the hippopede (figure-eight), with sliders for the axis tilt and the zodiacal drift, and a plot of apparent longitude against time',
  synodic: 'an interactive orbit animation with a stopwatch that measures the synodic period between alignments while counting the planet\'s sidereal laps; the planet can be changed',
  sphere: 'an interactive celestial sphere the student can drag: horizon, zenith, meridian, celestial pole and equator, a chosen star with its altitude and azimuth arcs, sliders for latitude and sidereal time',
  precession: 'an interactive view looking down on the north ecliptic pole: the 25 772-year circle of the celestial pole, nearby bright stars (Polaris, Thuban, Vega…), and a year slider from 13 000 BCE to 15 000 CE',
  spectrum: 'an interactive electromagnetic spectrum: a wavelength slider with wavelength, frequency, photon-energy and blackbody-temperature readouts, the atmosphere\'s transparency curve, and the bands of major telescopes',
};
/** fallback: the `/** … *\/` doc comment above each WidgetSpec member in lessons.ts */
const WIDGET_DOCS = (() => {
  const src = readFileSync(join(ROOT, 'src', 'data', 'lessons.ts'), 'utf8');
  const out = {};
  for (const m of src.matchAll(/\/\*\*\s*([^*]+?)\s*\*\/\s*\n\s*\|\s*\{\s*type:\s*'([a-z0-9]+)'/g)) out[m[2]] = m[1].replace(/\s+/g, ' ');
  return out;
})();
const widgetDesc = (w) => WIDGETS[w.type] ?? (WIDGET_DOCS[w.type] ? `an interactive widget — ${WIDGET_DOCS[w.type]}${w.mode ? ` (mode: ${w.mode})` : ''}` : `an interactive ${w.type} widget`);
const SCENES = {
  goto: (c) => `the 3-D view flies to ${c.ref.replace(/^l-/, '')}`,
  overview: (c) => `the 3-D view rises above the orbit of ${c.ref} with orbit lines shown`,
  vantage: (c) => `the 3-D view takes a vantage point near ${c.ref}`,
  backdrop: () => 'the 3-D view shows the whole planetary system slowly circling the Sun',
  grid: (c) => `the ${[c.equatorial && 'equatorial', c.ecliptic && 'ecliptic'].filter(Boolean).join(' and ') || 'no'} grid is drawn on the sky`,
  rate: () => null,
  orbits: () => null,
};

function slideText(section, step, index) {
  const lines = [];
  lines.push(`Section ${section.number} ${section.title} — step ${index + 1} of ${section.steps.length}`);
  if (step.kicker) lines.push(`Kicker: ${step.kicker}`);
  lines.push(`Title: ${step.title}`);
  if (step.scene?.length) {
    const s = step.scene.map((c) => SCENES[c.action]?.(c)).filter(Boolean);
    if (s.length) lines.push(`On screen behind the lesson panel: ${s.join('; ')}.`);
  }
  if (step.widget) lines.push(`Interactive widget on the slide: ${widgetDesc(step.widget)}.`);
  lines.push('');
  for (const b of step.body) {
    switch (b.kind) {
      case 'p': lines.push(strip(b.html)); break;
      case 'eq': lines.push(`FORMULA (LaTeX): ${b.tex}${b.note ? `\n  caption: ${strip(b.note)}` : ''}`); break;
      case 'callout': lines.push(`[${b.title ?? b.tone}] ${strip(b.html)}`); break;
      case 'list': for (const it of b.items) lines.push(`• ${strip(it)}`); break;
      case 'terms': for (const [t, d] of b.items) lines.push(`• ${strip(t)}: ${strip(d)}`); break;
      case 'timeline': for (const it of b.items) lines.push(`• ${it.when} — ${it.title}: ${strip(it.text)}`); break;
      case 'table': lines.push(`TABLE: ${b.head.join(' | ')}`); for (const r of b.rows) lines.push(`  ${r.map(strip).join(' | ')}`); if (b.caption) lines.push(`  caption: ${strip(b.caption)}`); break;
      case 'compare': for (const side of [b.left, b.right]) { lines.push(`${side.title}:`); for (const it of side.items) lines.push(`  • ${strip(it)}`); } break;
      case 'summary': lines.push('IN SHORT:'); for (const it of b.items) lines.push(`  • ${strip(it)}`); break;
      case 'figure': lines.push(`FIGURE: ${strip(b.caption)}`); break;
    }
    lines.push('');
  }
  return lines.join('\n');
}

const SYSTEM = `You are a university professor giving a live, engaging introductory astrophysics lecture to first-year students. You are speaking over the slide below while it is on screen; the students can read it, so do NOT read the slide aloud. Teach it: motivate, explain, connect, give intuition, and point at what is on the screen.

Rules for the spoken script:
- Plain spoken English, first person, warm and confident, like a good lecturer who enjoys the subject. Natural rhythm, short and medium sentences. No markdown, no headings, no bullet points, no stage directions, no "slide says". Do not greet or sign off unless this is the first or last step of the section (then one short sentence is fine).
- Every FORMULA on the slide must be spoken aloud in words and then explained: name each symbol, say what it means physically, and why the relation holds or how it is used. Example style: "one over S equals one over P-Earth minus one over P — S is the synodic period we actually observe, P is the planet's true orbital period…". Say units in full words. Avoid long digit strings; round sensibly in speech ("about forty thousand kilometres").
- When the slide has an interactive widget, tell the students concretely what to try with it and what they should notice. When the 3-D view behind the panel shows something, refer to it briefly ("look at Mars behind the panel…").
- Keep the historical and scientific content faithful to the slide; you may add small, accurate clarifications and one vivid analogy, but do not add facts that contradict the slide.
- Length: 200–330 words for normal steps; a closing "In short" step may be 150–220 words. Output nothing but the script text.`;

async function writeScript(section, step, index) {
  const body = {
    model,
    temperature: 0.5,
    messages: [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: slideText(section, step, index) },
    ],
  };
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await postJson(CHAT_API, body);
      if (r.status !== 200) throw new Error(`${r.status} ${r.text.slice(0, 200)}`);
      const j = JSON.parse(r.text);
      const text = j.choices?.[0]?.message?.content?.trim();
      if (!text || text.length < 400) throw new Error('empty or too short script');
      return text.replace(/\*\*|__|^#+\s*/gm, '').replace(/\n{2,}/g, '\n\n');
    } catch (e) {
      console.warn(`  retry script ${section.id}/${step.id} (${e.message})`);
      await new Promise((res) => setTimeout(res, 2000 * (attempt + 1)));
    }
  }
  throw new Error('gave up writing the script');
}

/* ----------------------------------------------------------------- TTS */

function sentences(text) {
  const out = [];
  const re = /[^.!?…]+[.!?…]+(?:["»”']+)?|[^.!?…]+$/g;
  let m;
  while ((m = re.exec(text.replace(/\s+/g, ' ')))) { const s = m[0].trim(); if (s) out.push(s); }
  const merged = [];
  for (const s of out) {
    if (merged.length && (s.length < 12 || /^\d/.test(s))) merged[merged.length - 1] += ' ' + s;
    else merged.push(s);
  }
  return merged;
}

function timeSentences(text, ts, duration) {
  const sents = sentences(text);
  const chars = ts?.graph_chars ?? [];
  const times = ts?.graph_times ?? [];
  const joined = chars.join('');
  const result = [];
  let cursor = 0, fallback = false;
  for (const s of sents) {
    const probe = s.replace(/\s+/g, ' ');
    let idx = joined.indexOf(probe, cursor);
    if (idx < 0) idx = joined.indexOf(probe.slice(0, 20), cursor);
    if (idx < 0 || !times[idx]) { fallback = true; break; }
    const end = Math.min(joined.length - 1, idx + probe.length - 1);
    result.push({ start: round(times[idx][0]), end: round(times[end]?.[1] ?? times[idx][1]), text: s });
    cursor = end + 1;
  }
  if (fallback || result.length !== sents.length) {
    const total = sents.reduce((a, s) => a + s.length, 0);
    let t = 0;
    return sents.map((s) => { const d = (s.length / total) * duration; const r = { start: round(t), end: round(t + d), text: s }; t += d; return r; });
  }
  for (let i = 0; i < result.length - 1; i++) result[i].end = result[i + 1].start;
  result[result.length - 1].end = round(duration);
  return result;
}

async function synthesize(text) {
  const body = {
    text, voice_id: VOICE, language: 'en',
    output_format: { codec: 'mp3', sample_rate: 24000, bit_rate: 64000 },
    speed: 1.0, text_normalization: true, with_timestamps: true,
  };
  for (let attempt = 0; attempt < 4; attempt++) {
    const r = await fetch(TTS_API, { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (r.ok) { const j = await r.json(); return { audio: Buffer.from(j.audio, 'base64'), duration: j.duration, ts: j.audio_timestamps }; }
    const msg = await r.text();
    if (r.status === 429 || r.status >= 500) { await new Promise((res) => setTimeout(res, 1500 * (attempt + 1))); continue; }
    throw new Error(`${r.status} ${msg}`);
  }
  throw new Error('gave up after retries');
}

/* ----------------------------------------------------------------- run */

function writeManifest(manifest, path) {
  const ordered = { voice: manifest.voice, locale: 'en', steps: {} };
  for (const id of Object.keys(manifest.steps).sort()) ordered.steps[id] = manifest.steps[id];
  writeFileSync(path, JSON.stringify(ordered, null, 1) + '\n');
}

const sections = COURSE.chapters.flatMap((c) => c.sections).filter((s) => !onlySection || s.id === onlySection);
let scriptJobs = 0, ttsJobs = 0, ttsChars = 0;
const work = [];
for (const section of sections) {
  const manifestPath = join(OUT, `${section.id}.json`);
  const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : { voice: VOICE, locale: 'en', steps: {} };
  manifest.voice = VOICE;
  const seen = new Set();
  section.steps.forEach((step, index) => {
    seen.add(step.id);
    const h = hash(slideText(section, step, index));
    const cur = manifest.steps[step.id];
    const needScript = !ttsOnly && (force || !cur || cur.hash !== h || !cur.script);
    const file = join(OUT, section.id, `${step.id}.mp3`);
    const needTts = !scriptsOnly && (needScript || force || !cur?.duration || !existsSync(file) || cur.voicedHash !== hash(cur.script ?? ''));
    if (needScript) scriptJobs++;
    if (needTts) { ttsJobs++; ttsChars += (cur?.script ?? '').length || 1600; }
    if (needScript || needTts) work.push({ section, step, index, h, needScript, needTts, file, manifest, manifestPath });
  });
  for (const id of Object.keys(manifest.steps)) if (!seen.has(id)) delete manifest.steps[id];
  if (!dry) { mkdirSync(join(OUT, section.id), { recursive: true }); writeManifest(manifest, manifestPath); }
}
console.log(`${scriptJobs} scripts to write, ${ttsJobs} clips to voice (≈ ${ttsChars} chars ≈ $${((ttsChars / 1e6) * 15).toFixed(2)} TTS)`);
if (dry) process.exit(0);

let ok = 0, failed = 0;
async function run(job) {
  const { section, step, index, h, file, manifest, manifestPath } = job;
  try {
    const cur = manifest.steps[step.id] ?? {};
    if (job.needScript) {
      cur.script = await writeScript(section, step, index);
      cur.hash = h;
      delete cur.duration; delete cur.sentences; delete cur.voicedHash;
      manifest.steps[step.id] = cur;
      writeManifest(manifest, manifestPath);
      console.log(`✎ ${section.id}/${step.id}  ${cur.script.split(/\s+/).length} words`);
    }
    if (job.needTts && cur.script) {
      const { audio, duration, ts } = await synthesize(cur.script);
      writeFileSync(file, audio);
      cur.duration = round(duration);
      cur.sentences = timeSentences(cur.script, ts, duration);
      cur.voicedHash = hash(cur.script);
      manifest.steps[step.id] = cur;
      writeManifest(manifest, manifestPath);
      console.log(`♪ ${section.id}/${step.id}  ${duration.toFixed(1)} s  ${(audio.length / 1024).toFixed(0)} KB`);
    }
    ok++;
  } catch (e) {
    failed++;
    console.error(`✗ ${section.id}/${step.id}: ${e.message}`);
  }
}

const CONCURRENCY = 5;
const queue = [...work];
await Promise.all(Array.from({ length: CONCURRENCY }, async () => { while (queue.length) await run(queue.shift()); }));
console.log(`done: ${ok} ok, ${failed} failed`);
process.exit(failed ? 1 : 0);
