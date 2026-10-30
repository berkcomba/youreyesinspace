/**
 * Voice the Streamer Mode narrator with the xAI text-to-speech API (energetic voice, see
 * VOICE_ID in src/expedition/voicelines.ts).
 *
 *   XAI_API_KEY=… node scripts/tts-expedition.mjs [--force] [--dry]
 *
 * Writes public/expedition/voice/<key>.mp3 for every narrator call, destination/discovery line,
 * Knowledge Gate question and answer explanation. The key is a hash of the text, so only new or
 * edited lines are synthesised; clips whose text no longer exists are deleted.
 * The key is read from the environment only — never commit it.
 */
import { writeFileSync, mkdirSync, existsSync, readdirSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const OUT = join(ROOT, 'public', 'expedition', 'voice');
const API = 'https://api.x.ai/v1/tts';
const CONCURRENCY = 4;

const args = process.argv.slice(2);
const force = args.includes('--force');
const dry = args.includes('--dry');
const key = process.env.XAI_API_KEY;
if (!key && !dry) { console.error('XAI_API_KEY is not set'); process.exit(1); }

const V = await import('../src/expedition/voicelines.ts');
const { BANK } = await import('../src/expedition/questions.ts');
const { NODES } = await import('../src/expedition/manifest.ts');
const { GATE_NAMES } = await import('../src/expedition/protocol.ts');

const texts = new Set(Object.values(V.CALL));
for (const n of NODES) {
  if (!n.available) continue;
  texts.add(V.destinationLine(n.title));
  texts.add(V.discoveredLine(n.title));
}
GATE_NAMES.forEach((name, i) => texts.add(V.gateLine(i, name)));
for (const gates of Object.values(BANK)) for (const variants of gates) for (const v of variants) { texts.add(v.q); texts.add(v.why); }
const { EVENTS } = await import('../src/expedition/events.ts');
for (const e of EVENTS) { texts.add(e.intro); for (const o of e.options) for (const r of o.results) texts.add(r.say); }

mkdirSync(OUT, { recursive: true });
const wanted = new Map([...texts].map((t) => [V.voiceKey(t), t]));
const jobs = [...wanted].filter(([k]) => force || !existsSync(join(OUT, `${k}.mp3`)));
const chars = jobs.reduce((a, [, t]) => a + t.length, 0);
const stale = readdirSync(OUT).filter((f) => f.endsWith('.mp3') && !wanted.has(f.slice(0, -4)));
console.log(`${wanted.size} lines, ${jobs.length} to synthesise (${chars} chars ≈ $${((chars / 1e6) * 15).toFixed(2)}), ${stale.length} stale`);
if (dry) process.exit(0);
for (const f of stale) unlinkSync(join(OUT, f));

async function synthesize(text) {
  const body = {
    text, voice_id: V.VOICE_ID, language: 'en',
    output_format: { codec: 'mp3', sample_rate: 24000, bit_rate: 64000 },
    speed: 1.05, text_normalization: true,
  };
  for (let attempt = 0; attempt < 4; attempt++) {
    const r = await fetch(API, { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (r.ok) return Buffer.from(await r.arrayBuffer());
    const msg = await r.text();
    if (r.status === 429 || r.status >= 500) { await new Promise((res) => setTimeout(res, 1500 * (attempt + 1))); continue; }
    throw new Error(`${r.status} ${msg}`);
  }
  throw new Error('gave up after retries');
}

let ok = 0, failed = 0;
const queue = [...jobs];
await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
  while (queue.length) {
    const [k, text] = queue.shift();
    try {
      const audio = await synthesize(text);
      writeFileSync(join(OUT, `${k}.mp3`), audio);
      ok++;
      console.log(`✓ ${k}  ${(audio.length / 1024).toFixed(0)} KB  ${text.slice(0, 60)}`);
    } catch (e) {
      failed++;
      console.error(`✗ ${k}: ${e.message}`);
    }
  }
}));
console.log(`done: ${ok} ok, ${failed} failed`);
process.exit(failed ? 1 : 0);
