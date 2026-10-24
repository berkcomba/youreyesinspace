#!/usr/bin/env node
/**
 * Usage counter for the About panel → public/stats.json
 *
 *   node scripts/fetch-stats.mjs [--days N] [--seed file.json ...]
 *
 * Reads Cloud Run request logs (gcloud must be authenticated), counts page opens per day and
 * merges them into the existing stats.json, so the file keeps history beyond the 30-day log
 * retention. A "page open" is a GET of the HTML shell (any query string). `visits` counts every
 * request including crawlers and link previews; `human` / `visitors` exclude a user-agent bot list
 * and are kept for our own reading.
 *
 * --seed: merge previously exported `gcloud logging read --format json` dumps instead of (or in
 * addition to) querying; used once to backfill the launch weeks.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const OUT = new URL('../public/stats.json', import.meta.url);
const PROJECT = process.env.GCP_PROJECT || 'youreyesinspace';
const SERVICE = process.env.CLOUD_RUN_SERVICE || 'youreyesinthespace';

const args = process.argv.slice(2);
const days = Number(args[args.indexOf('--days') + 1]) || 3;
const seeds = args.flatMap((a, i) => (a === '--seed' ? [args[i + 1]] : []));
const noFetch = args.includes('--no-fetch');

const BOT = /bot|crawl|spider|slurp|facebookexternalhit|linkedinbot|whatsapp|telegram|preview|curl|python|go-http|headless|lighthouse|pingdom|uptime|monitor|ahrefs|semrush|bingpreview|Twitterbot|Discordbot|Googlebot|Applebot|GPTBot|ClaudeBot|Bytespider|PetalBot|YandexBot|DuckDuckBot|Amazonbot|Mediapartners|AdsBot|okhttp|axios|node-fetch|Java\//i;
const PAGE = /^https?:\/\/[^/]+\/?(\?.*)?$/;

const FILTER = [
  'resource.type="cloud_run_revision"',
  `resource.labels.service_name="${SERVICE}"`,
  'httpRequest.requestMethod="GET"',
  '(httpRequest.requestUrl:"youreyesinspace.com/" OR httpRequest.requestUrl:"run.app/")',
  ...['/assets/', '/textures/', '/data/', '/models/', '.png', '.jpg', '.ico', '.xml', 'robots.txt', '.json', '.js', '.css', '.mp3', '.glb', '_b.gif']
    .map((s) => `NOT httpRequest.requestUrl:"${s}"`),
].join(' AND ');

/** @type {{since:string, updatedAt:string, visits:number, human:number, visitors:number, days:Record<string,{visits:number,human:number,visitors:number}>}} */
const stats = existsSync(OUT)
  ? JSON.parse(readFileSync(OUT, 'utf8'))
  : { since: '2026-09-29', updatedAt: '', visits: 0, human: 0, visitors: 0, days: {} };

/** per-day tallies from one batch of log rows; a day present in the batch replaces the stored day */
function tally(rows) {
  const byDay = new Map();
  for (const r of rows) {
    const h = r.httpRequest || {};
    if (!PAGE.test(h.requestUrl || '') && !/index\.html/.test(h.requestUrl || '')) continue;
    const day = (r.timestamp || '').slice(0, 10);
    if (!day) continue;
    const d = byDay.get(day) ?? { visits: 0, human: 0, ips: new Set() };
    d.visits++;
    const ua = h.userAgent || '';
    if (ua && !BOT.test(ua)) { d.human++; d.ips.add(h.remoteIp || '?'); }
    byDay.set(day, d);
  }
  return byDay;
}

function merge(byDay, { partialDays = [] } = {}) {
  for (const [day, d] of byDay) {
    // the first/last day of a dump may be cut off; never let a partial day shrink a stored one
    const prev = stats.days[day];
    if (partialDays.includes(day) && prev && prev.visits >= d.visits) continue;
    stats.days[day] = { visits: d.visits, human: d.human, visitors: d.ips.size };
  }
}

for (const f of seeds) {
  const rows = JSON.parse(readFileSync(f, 'utf8'));
  const byDay = tally(rows);
  const ds = [...byDay.keys()].sort();
  merge(byDay, { partialDays: [ds[0], ds[ds.length - 1]] });
  console.error(`seed ${f}: ${rows.length} rows, ${ds[0]} → ${ds[ds.length - 1]}`);
}

if (!noFetch) {
  const json = execFileSync('gcloud', [
    'logging', 'read', FILTER,
    '--project', PROJECT, `--freshness=${days}d`, '--limit', '300000', '--format', 'json',
  ], { maxBuffer: 1 << 30, encoding: 'utf8' });
  const rows = JSON.parse(json);
  const byDay = tally(rows);
  const ds = [...byDay.keys()].sort();
  merge(byDay, { partialDays: [ds[0]] }); // today is partial too, but newer always wins
  console.error(`gcloud: ${rows.length} rows, ${ds[0]} → ${ds[ds.length - 1]}`);
}

const dayKeys = Object.keys(stats.days).sort();
stats.days = Object.fromEntries(dayKeys.map((k) => [k, stats.days[k]]));
stats.since = dayKeys[0] ?? stats.since;
stats.visits = dayKeys.reduce((s, k) => s + stats.days[k].visits, 0);
stats.human = dayKeys.reduce((s, k) => s + stats.days[k].human, 0);
stats.visitors = dayKeys.reduce((s, k) => s + stats.days[k].visitors, 0);
stats.updatedAt = new Date().toISOString().slice(0, 10);

writeFileSync(OUT, JSON.stringify(stats, null, 1) + '\n');
console.error(`stats.json: ${stats.since} → ${stats.updatedAt}: ${stats.visits} visits, ${stats.human} human, ${stats.visitors} visitor-days`);
