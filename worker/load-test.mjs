// Load test for the expedition relay: a cockpit plus N phones in a fresh room, through a full
// Knowledge Gate (open → everyone answers → lock → reveal → every phone gets its score).
//
//   node load-test.mjs wss://yeis-expedition.<sub>.workers.dev [phones=2000] [per second=400] [--expect TOTAL]
//   node load-test.mjs wss://… [phones] [per second] --join ROOM      (more phones for that room)
//   either run also takes --family 4|6
//
// One machine runs out of ports around 15k sockets, so for a bigger crew start the cockpit run
// with --expect, then add --join runs with its room code (from other machines, or from this one
// with `--family 6` next to a `--family 4` cockpit run).
// Raise the file limit first: `ulimit -n 65536`.
// New phones need a Turnstile pass when the relay has TURNSTILE_SECRET: test against `wrangler dev`
// or a deployment without it.
import { randomBytes } from 'node:crypto';
import WebSocket from 'ws';

const argv = process.argv.slice(2);
const flag = (name) => { const i = argv.indexOf(name); return i < 0 ? '' : argv.splice(i, 2)[1]; };
const joinRoom = flag('--join').toUpperCase();
const expect = Number(flag('--expect')) || 0;
const family = Number(flag('--family')) || undefined;   // 4 or 6: IPv4 and IPv6 each get their own ports
const [url, nArg, rampArg] = argv;
if (!url?.startsWith('ws')) { console.error('usage: node load-test.mjs wss://… [phones] [per second] [--expect N | --join ROOM]'); process.exit(1); }
const N = Number(nArg) || 2000;
const RAMP = Number(rampArg) || 400;
const ORIGIN = 'https://stream.youreyesinspace.com';
const base = url.replace(/\/$/, '');
const room = joinRoom || 'LT' + randomBytes(3).toString('hex').toUpperCase().slice(0, 4);
const opts = { headers: { Origin: ORIGIN }, handshakeTimeout: 15_000, family };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pct = (a, p) => { if (!a.length) return '-'; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(s.length * p))] + ' ms'; };
const lat = (a) => `p50 ${pct(a, 0.5)}, p95 ${pct(a, 0.95)}, p99 ${pct(a, 0.99)}`;
const tag = joinRoom ? `[join ${room}]` : `[cockpit ${room}]`;

const t0 = Date.now();
const stat = { id: 0, full: 0, failed: 0, challenged: 0, closed: 0, state: 0, stateLag: [], acked: 0, scored: 0 };

/* ---------- phones: they follow the public state like the real crew page ---------- */
const phones = [];
let revealSent = 0;
let done = null;
const finished = new Promise((r) => { done = r; });
const phone = (i) => new Promise((ready) => {
  const ws = new WebSocket(`${base}/room/${room}/crew`, opts);
  const p = { ws, answered: '', acked: '', scored: '', scoredAt: 0 };
  ws.on('message', (d) => {
    const s = String(d);
    if (s === 'pong') return;
    const m = JSON.parse(s);
    if (m.t === 'id') { stat.id++; ws.send(JSON.stringify({ t: 'hello', nick: `Load${joinRoom ? 'J' : ''}${i}` })); phones.push(p); ready(); }
    else if (m.t === 'full') { stat.full++; ready(); }
    else if (m.t === 'state') {
      const st = m.s;
      if (st.probe) { stat.state++; stat.stateLag.push(Date.now() - st.probe); }
      if (st.gate && p.answered !== st.gate) {
        p.answered = st.gate;
        setTimeout(() => ws.readyState === WebSocket.OPEN && ws.send(JSON.stringify({ t: 'answer', attemptId: st.gate, choiceId: Math.random() < 0.7 ? 'a' : 'b' })), Math.random() * 1000);
      }
      if (st.revealSent) revealSent = st.revealSent;   // same machine clock as the cockpit run
      if (st.done) done();
    } else if (m.t === 'me') {
      if (m.answered && p.acked !== m.answered.attemptId) { p.acked = m.answered.attemptId; stat.acked++; }
      if (m.last && p.scored !== m.last.attemptId) { p.scored = m.last.attemptId; p.scoredAt = Date.now(); stat.scored++; }
    }
  });
  ws.on('error', () => { stat.failed++; ready(); });
  ws.on('close', (c) => { if (c === 4401) stat.challenged++; else stat.closed++; ready(); });
});

async function openPhones() {
  const pending = [];
  for (let i = 0; i < N; i++) {
    pending.push(phone(i));
    if (i % RAMP === RAMP - 1) { await sleep(1000); process.stdout.write(`\r${tag} phones opening: ${i + 1}/${N}   `); }
  }
  await Promise.all(pending);
  console.log(`\n${tag} phones in ${((Date.now() - t0) / 1000).toFixed(1)} s: ${stat.id} connected, ${stat.full} full, ${stat.challenged} challenged, ${stat.failed} failed, ${stat.closed} closed`);
}

const phoneReport = () => {
  console.log(`${tag} state fan-out: ${stat.state} / ${stat.id * 3} delivered, ${lat(stat.stateLag)}`);
  console.log(`${tag} answers acknowledged ("locked in"): ${stat.acked} / ${stat.id}`);
  const lags = revealSent ? phones.filter((p) => p.scoredAt).map((p) => p.scoredAt - revealSent) : [];
  console.log(`${tag} scores delivered after reveal: ${stat.scored} / ${stat.acked}, ${lat(lags)}`);
};

if (joinRoom) {
  await openPhones();
  console.log(`${tag} waiting for the cockpit run…`);
  await Promise.race([finished, sleep(10 * 60_000)]);
  phoneReport();
  for (const p of phones) p.ws.terminate();
  process.exit(0);
}

/* ---------- cockpit ---------- */
const host = new WebSocket(`${base}/room/${room}/host`, opts);
let tally = null;
let result = null;
const authed = new Promise((ok, fail) => {
  host.on('open', () => host.send(JSON.stringify({ t: 'auth', token: randomBytes(32).toString('hex') })));
  host.on('message', (d) => {
    const m = JSON.parse(String(d));
    if (m.t === 'ready') ok();
    else if (m.t === 'tally') tally = m.x;
    else if (m.t === 'result') result = { at: Date.now(), r: m.r };
  });
  host.on('close', (c, r) => fail(new Error(`cockpit closed ${c} ${r}`)));
});
await authed;
const send = (m) => host.send(JSON.stringify(m));
const state = (s) => send({ t: 'state', s: { stage: 'LOAD', ...s } });
const until = async (ok, ms) => { const end = Date.now() + ms; while (!ok() && Date.now() < end) await sleep(100); return ok(); };
console.log(`${tag} room ${room}: cockpit ready. Join more phones with: node load-test.mjs ${base} <phones> <per second> --join ${room}`);
state({});

await openPhones();
const total = Math.max(expect, N);
const t1 = Date.now();
await until(() => (tally?.crew ?? 0) >= total * 0.99, 5 * 60_000);
console.log(`${tag} room sees ${tally?.crew} crew online (expected ${total}) after ${((Date.now() - t1) / 1000).toFixed(1)} s more`);

for (let k = 0; k < 3; k++) { state({ probe: Date.now() }); await sleep(1500); }

const attemptId = 'load-' + Date.now();
send({ t: 'cmd', c: { t: 'gate', attemptId, nodeId: 'load', gateIndex: 0, choices: ['a', 'b', 'c', 'd'], windowMs: 60_000, practice: false } });
state({ gate: attemptId });
const tg = Date.now();
await until(() => tally?.gate?.attemptId === attemptId && tally.gate.answers >= tally.gate.eligible * 0.99, 30_000);
console.log(`${tag} room counted ${tally?.gate?.answers} / ${tally?.gate?.eligible} answers in ${((Date.now() - tg) / 1000).toFixed(1)} s (phones answer within 1 s)`);
await sleep(2000);

send({ t: 'cmd', c: { t: 'lock' } });
const tr = Date.now();
send({ t: 'cmd', c: { t: 'reveal', attemptId, correctId: 'a' } });
await until(() => result, 15_000);
const r = result?.r;
console.log(`${tag} reveal result in ${result ? result.at - tr : '-'} ms: ${r ? `${r.correct}/${r.answers} correct, ${r.passed ? 'passed' : 'failed'}, ${r.rows?.length} board rows` : 'none'}`);
state({ revealSent: tr });
await sleep(8000);
state({ done: true });
await Promise.race([finished, sleep(3000)]);
phoneReport();
for (const p of phones) p.ws.terminate();
host.close();
process.exit(0);
