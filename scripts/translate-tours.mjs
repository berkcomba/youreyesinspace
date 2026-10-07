/**
 * Translate the guided-tour narration (src/data/tours.ts, Turkish) into the other UI languages
 * with Grok, writing the results into src/i18n/locales/<lang>/data.json so that both the
 * subtitles (`_()`) and the TTS script read the same text.
 *
 *   XAI_API_KEY=… node scripts/translate-tours.mjs [--lang en,de,es,fr] [--model grok-4.7] [--force]
 *
 * Only strings that are missing from the dictionary are translated unless --force is given.
 * Review the output: it is committed like any other translation.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { request } from 'node:https';

/** POST JSON with node:https — reasoning models can take > 5 min, longer than fetch()'s header timeout */
function postJson(url, headers, body) {
  return new Promise((resolve, reject) => {
    const req = request(url, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' } }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, text: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('error', reject);
    // a reasoning model may think for several minutes; give up after 12 so a dead socket retries
    req.setTimeout(12 * 60 * 1000, () => req.destroy(new Error('request timed out')));
    req.end(JSON.stringify(body));
  });
}

const ROOT = new URL('..', import.meta.url).pathname;
const API = 'https://api.x.ai/v1/chat/completions';
const LANG_NAME = { en: 'English', de: 'German', es: 'Spanish (Spain)', fr: 'French' };

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : def;
};
const langs = opt('--lang', 'en,de,es,fr').split(',');
const model = opt('--model', 'grok-4.7');
const force = args.includes('--force');
const key = process.env.XAI_API_KEY;
if (!key) {
  console.error('XAI_API_KEY is not set');
  process.exit(1);
}

const { TOURS } = await import('../src/data/tours.ts');

const SYSTEM = `You are a professional translator and science communicator working on a planetarium app.
You translate Turkish narration for guided space tours into {LANG}. The text will be
1) read aloud by a text-to-speech voice and 2) shown as subtitles.

Rules:
- Translate meaning faithfully; keep every fact, number and name. Do not add or drop information.
- Use natural, warm, spoken-style {LANG} suitable for narration (as a planetarium guide would speak).
- Numbers: write them the way a narrator would say them. Prefer digits for simple numbers (e.g. "22 km", "1977", "4.6 billion years") but keep spelled-out forms where the Turkish spells them out for rhythm. Never use scientific notation. Use the decimal separator and digit grouping of {LANG}.
- Use the standard {LANG} names of celestial objects (e.g. the Turkish "Ülker" is the Pleiades, "Yengeç Bulutsusu" is the Crab Nebula, "Halka Bulutsusu" is the Ring Nebula, "Üçgen Galaksisi" is the Triangulum Galaxy, "Büyük/Küçük Macellan Bulutu" are the Large/Small Magellanic Cloud, "Kutup Yıldızı" is Polaris / the North Star).
- Keep designations as pronounced in the source: when Turkish spells out a catalogue number in words for the voice (e.g. "PSR B Bin Dokuz Yüz On Dokuz artı Yirmi Bir"), write it so a TTS voice reads it correctly in {LANG} (e.g. "PSR B1919+21" may be written as "PSR B 1919 plus 21"). "Cygnus X-Bir" is "Cygnus X-1", "M Seksen Yedi yıldız" is "M87 star" (M87*, say "M87 star").
- Keep sentence boundaries roughly aligned with the source (one Turkish sentence → one or two target sentences) because subtitles are timed per sentence.
- Output ONLY a JSON object mapping each input key (the exact Turkish string) to its translation. No commentary, no markdown fences.`;

async function translateBatch(items, lang) {
  const body = {
    model,
    temperature: 0.2,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SYSTEM.replaceAll('{LANG}', LANG_NAME[lang]) },
      { role: 'user', content: JSON.stringify(Object.fromEntries(items.map((s) => [s, '']))) },
    ],
  };
  for (let attempt = 0; attempt < 3; attempt++) {
    let r;
    try {
      r = await postJson(API, { Authorization: `Bearer ${key}` }, body);
    } catch (e) {
      console.warn(`  retry (${e.message})`);
      continue;
    }
    if (r.status !== 200) {
      if (r.status === 429 || r.status >= 500) { await new Promise((res) => setTimeout(res, 2000 * (attempt + 1))); continue; }
      throw new Error(`${r.status} ${r.text}`);
    }
    const j = JSON.parse(r.text);
    const content = j.choices?.[0]?.message?.content ?? '';
    try {
      const out = JSON.parse(content.replace(/^```(?:json)?\s*|\s*```$/g, ''));
      const missing = items.filter((k) => typeof out[k] !== 'string' || !out[k].trim());
      if (missing.length) throw new Error(`model skipped ${missing.length} keys`);
      return out;
    } catch (e) {
      console.warn(`  retry (${e.message})`);
    }
  }
  throw new Error('translation failed');
}

const strings = [];
for (const t of TOURS) {
  strings.push(t.title, t.summary);
  for (const s of t.steps) strings.push(s.text);
}

// one tour per request keeps the context coherent; requests run in parallel (the model is slow)
const CONCURRENCY = 6;
const jobs = [];
const dicts = {};
for (const lang of langs) {
  const path = join(ROOT, 'src', 'i18n', 'locales', lang, 'data.json');
  const dict = JSON.parse(readFileSync(path, 'utf8'));
  dicts[lang] = { path, dict };
  const todo = strings.filter((s) => force || !dict[s]);
  console.log(`${lang}: ${todo.length} strings`);
  for (const t of TOURS) {
    const b = [t.title, t.summary, ...t.steps.map((s) => s.text)].filter((s) => todo.includes(s));
    if (b.length) jobs.push({ lang, b });
  }
}

let failed = 0;
const queue = [...jobs];
await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
  while (queue.length) {
    const { lang, b } = queue.shift();
    try {
      const out = await translateBatch(b, lang);
      const { path, dict } = dicts[lang];
      for (const k of b) dict[k] = out[k].trim();
      writeFileSync(path, JSON.stringify(dict, null, 2) + '\n');
      console.log(`  ✓ ${lang}: ${b.length} strings (${b[0].slice(0, 30)}…)`);
    } catch (e) {
      failed++;
      console.error(`  ✗ ${lang} (${b[0].slice(0, 30)}…): ${e.message}`);
    }
  }
}));
console.log(failed ? `done with ${failed} failed batches` : 'done');
process.exit(failed ? 1 : 0);
