/**
 * Crew phone (The Great Expedition audience page). Lightweight: no Three.js, no catalogue,
 * no question bank, only the public snapshot the host broadcasts.
 */
import './crew.css';
import { GATE_NAMES, randomId, type GateScore, type HostToCrew, type PublicSnapshot } from './protocol';
import { openLink } from './link';
import { sfx } from './sfx';

const LETTERS = ['A', 'B', 'C', 'D'];
const esc = (s: string): string => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

const store = {
  get: (k: string): string => { try { return localStorage.getItem(k) ?? ''; } catch { return ''; } },
  set: (k: string, v: string): void => { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
};

/** dev relay: chosen here; production relay: minted and signed by the server (see link.ts) */
let pid = store.get('yeis.crew.pid') || (() => { const p = randomId(12); store.set('yeis.crew.pid', p); return p; })();

function codeFromUrl(): string {
  const q = new URLSearchParams(location.search).get('c');
  const m = location.pathname.match(/\/join\/([A-Za-z0-9]{4,8})/);
  return (q ?? m?.[1] ?? '').toUpperCase();
}

const root = document.getElementById('crew')!;
const link = openLink('crew');
let full = false;
let challenged = false;
link.onStatus((s) => {
  if (s.kind === 'id') pid = s.pid;
  else if (s.kind === 'open') { full = false; challenged = false; hello(); }
  else if (s.kind === 'full') { full = true; render(); }
  else if (s.kind === 'challenge') { challenged = true; render(); }
});

/* ---- Turnstile: a new phone proves it is a person once, then keeps its signed id ---- */

const SITEKEY = (import.meta.env.VITE_TURNSTILE_SITEKEY as string | undefined) ?? '';
interface TurnstileApi { render(el: Element, o: Record<string, unknown>): string; reset(id?: string): void }
let turnstile: Promise<TurnstileApi> | null = null;

function loadTurnstile(): Promise<TurnstileApi> {
  turnstile ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    s.async = true;
    s.onload = () => resolve((window as unknown as { turnstile: TurnstileApi }).turnstile);
    s.onerror = () => { turnstile = null; reject(new Error('blocked')); };
    document.head.appendChild(s);
  });
  return turnstile;
}

function mountChallenge(): void {
  const box = root.querySelector<HTMLElement>('#c-ts');
  if (!box || box.dataset.on) return;
  box.dataset.on = '1';
  loadTurnstile().then((ts) => ts.render(box, {
    sitekey: SITEKEY, theme: 'dark', action: 'join',
    callback: (token: string) => { challenged = false; link.solve(token); render(); },
  })).catch(() => { box.textContent = 'The check could not load. Turn off content blockers for this page and reload.'; });
}

let room = '';
let nick = store.get('yeis.crew.nick');
let snap: PublicSnapshot | null = null;
let lastStateAt = 0;
let clockOffset = 0;
let me: { points: number; sessionPoints: number; answered?: { attemptId: string; choiceId: string }; votedFor?: string; last?: GateScore } = { points: 0, sessionPoints: 0 };
let pending: { attemptId: string; choiceId: string; at: number } | null = null;
let notice = '';
let joinedAt = 0;
let lastRendered = '';
let lastKey = '';

link.on((w) => {
  if (w.from !== 'host') return;
  const m = w.msg as HostToCrew;
  if (!room || m.room !== room) return;
  if (m.t === 'state') {
    if (snap && m.s.rev <= snap.rev && Date.now() - lastStateAt < 5000) return;
    cue(snap, m.s);
    snap = m.s;
    lastStateAt = Date.now();
    clockOffset = m.s.sentAt - Date.now();
    if (pending && snap.gate?.attemptId !== pending.attemptId) pending = null;
    render();
  } else if (m.t === 'me' && m.pid === pid) {
    me = { points: m.points, sessionPoints: m.sessionPoints, answered: m.answered, votedFor: m.votedFor, last: m.last };
    if (m.answered && pending?.attemptId === m.answered.attemptId) pending = null;
    if (m.rejected) { notice = m.rejected; pending = null; }
    render();
  }
});

/** Sound cues on stage changes (only for transitions, never on the first snapshot). */
function cue(prev: PublicSnapshot | null, s: PublicSnapshot): void {
  if (!prev) return;
  const g = s.gate;
  if (s.stage === 'GATE_OPEN' && g && prev.gate?.attemptId !== g.attemptId) sfx.play('gateOpen');
  else if (s.stage === 'GATE_REVEAL' && prev.stage !== 'GATE_REVEAL' && g?.correctId && me.answered?.attemptId === g.attemptId) sfx.play(me.answered.choiceId === g.correctId ? 'pass' : 'fail');
  else if (s.stage === 'ROUTE_VOTE' && prev.stage !== 'ROUTE_VOTE') sfx.play('whoosh');
  else if (s.stage === 'SPACE_EVENT' && prev.stage !== 'SPACE_EVENT') sfx.play('fail');
  else if (s.stage === 'NODE_COMPLETE' && prev.stage !== 'NODE_COMPLETE') sfx.play('discovered');
}

function hello(): void { if (room) link.send({ from: 'crew', msg: { t: 'hello', room, pid, nick } }); }

setInterval(() => {
  // the relay knows who is connected; only the dev relay needs a heartbeat
  if (!link.server) hello();
  // an answer not acknowledged yet is sent again (the host keeps only the first)
  if (pending && Date.now() - pending.at > 3000) {
    pending.at = Date.now();
    link.send({ from: 'crew', msg: { t: 'answer', room, pid, attemptId: pending.attemptId, choiceId: pending.choiceId } });
  }
}, 4000);
setInterval(() => { tickClock(); if (room && snap) render(); }, 1000);

/* ================= views ================= */

function header(): string {
  const s = snap!;
  return `
    <header class="c-head">
      <div class="c-brand"><img src="/logo-white.png" alt="" /><div><div class="c-kicker">The Great Expedition</div><div class="c-camp">${esc(s.campaign)}</div></div></div>
      <div class="c-me"><b>${me.points}</b><span>pts</span></div>
    </header>
    <div class="c-sub"><span>${esc(nick)}</span><span class="c-hull${s.hull <= 30 ? ' low' : ''}">Hull ${s.hull}%</span><span><i class="c-live"></i>${s.crew.toLocaleString('en-US')} crew online</span></div>`;
}

function progress(): string {
  const s = snap!;
  return `
    <section class="c-card">
      <div class="c-kicker">Expedition progress</div>
      <div class="c-big">${s.discovered}<span> / ${s.total} destinations</span></div>
      <div class="c-chapters">${s.chapterProgress.map((c) => `
        <div class="c-ch${c.open ? '' : ' fog'}"><span>${esc(c.title)}</span><i><b style="width:${(100 * c.discovered) / c.total}%"></b></i><em>${c.discovered}/${c.total}</em></div>`).join('')}
      </div>
    </section>`;
}

function leaders(): string {
  const s = snap!;
  if (!s.leaders.length) return '';
  return `<section class="c-card"><div class="c-kicker">Top navigators</div><ol class="c-leaders">${s.leaders.map((l, i) => `<li><span>${i + 1}</span><b>${esc(l.nick)}</b><em>${l.points}</em></li>`).join('')}</ol></section>`;
}

function clockHtml(until: number, total: number): string {
  return `<div class="c-timer" data-until="${until}" data-total="${total}"><i></i><span></span></div>`;
}

function body(): string {
  const s = snap!;
  const g = s.gate;
  const t = s.target;
  switch (s.stage) {
    case 'LOBBY':
      return `<section class="c-hero"><div class="c-kicker">Mission control</div><h1>Waiting for the next route</h1><p>The host is picking where the crew goes next. Keep this page open: questions appear here.</p></section>${progress()}${leaders()}`;
    case 'ROUTE_VOTE': {
      const v = s.vote!;
      const total = Math.max(1, v.options.reduce((a, o) => a + o.votes, 0));
      return `<section class="c-hero"><div class="c-kicker">Route vote</div><h1>Where should we go?</h1><p>${v.closed ? (v.winner ? `The crew chose <b>${esc(v.options.find((o) => o.nodeId === v.winner)!.title)}</b>.` : 'Tie: the host decides.') : 'Tap a destination. You can change your vote until it closes.'}</p></section>
        ${v.closed ? '' : clockHtml(v.closesAt, 25000)}
        <div class="c-votes">${v.options.map((o, i) => `
          <button class="c-vote${me.votedFor === o.nodeId ? ' mine' : ''}${v.winner === o.nodeId ? ' win' : ''}" data-vote="${o.nodeId}" ${v.closed ? 'disabled' : ''}>
            <span class="c-l">${LETTERS[i]}</span><span class="c-vt">${esc(o.title)}</span><span class="c-vn">${o.votes}</span>
            <span class="c-vbar"><i style="width:${(100 * o.votes) / total}%"></i></span>
          </button>`).join('')}</div>`;
    }
    case 'SPACE_EVENT': {
      const e = s.event;
      if (!e) return '';
      const total = Math.max(1, e.options.reduce((a, o) => a + o.votes, 0));
      return `<section class="c-hero event"><div class="c-kicker">Space event</div><h1>${esc(e.title)}</h1><p>${esc(e.text)}</p></section>
        ${e.closed ? '' : clockHtml(e.closesAt, 20000)}
        <div class="c-votes">${e.options.map((o, i) => `
          <button class="c-vote${me.votedFor === o.id ? ' mine' : ''}${e.pick === o.id ? ' win' : ''}" data-event-vote="${o.id}" ${e.closed ? 'disabled' : ''}>
            <span class="c-l">${LETTERS[i]}</span><span class="c-vt">${esc(o.label)}<small>${esc(o.hint)}</small></span><span class="c-vn">${o.votes}</span>
            <span class="c-vbar"><i style="width:${(100 * o.votes) / total}%"></i></span>
          </button>`).join('')}</div>
        ${e.outcome ? `<div class="c-event-out">${esc(e.outcome)}${e.effect ? `<b>${esc(e.effect)}</b>` : ''}</div>` : ''}`;
    }
    case 'TRANSIT': case 'GATE_READY': case 'NODE_ARRIVAL':
      return `<section class="c-hero travel"><div class="c-kicker">${s.stage === 'NODE_ARRIVAL' ? 'Final approach' : s.stage === 'GATE_READY' ? 'Holding at waypoint' : 'En route'}</div><h1>${esc(t?.title ?? '')}</h1>
        <p>${s.stage === 'GATE_READY' ? 'A Knowledge Gate is coming up. Get ready!' : s.stage === 'NODE_ARRIVAL' ? 'All gates open. Watch the stream!' : 'Watch the stream: the next question appears here.'}</p>
        <div class="c-warp" aria-hidden="true">${Array.from({ length: 18 }, (_, i) => `<i style="--i:${i}"></i>`).join('')}</div>
        ${me.last?.rank ? `<div class="c-standing">You're <b>#${me.last.rank}</b> on the leaderboard${me.last.gain ? ` · +${me.last.gain} last gate` : ''}</div>` : ''}</section>${progress()}`;
    case 'GATE_OPEN': case 'GATE_LOCKED': case 'GATE_REVEAL': {
      if (!g) return '';
      const mine = me.answered?.attemptId === g.attemptId ? me.answered.choiceId : pending?.attemptId === g.attemptId ? pending.choiceId : null;
      const open = s.stage === 'GATE_OPEN' && !mine && !s.paused;
      const total = Math.max(1, g.distribution?.reduce((a, b) => a + b, 0) ?? 1);
      let foot = '';
      if (s.stage === 'GATE_OPEN') foot = mine ? `<div class="c-locked">${pending ? 'Sending…' : 'Locked in!'} <span>${g.answers} answers so far</span></div>` : notice ? `<div class="c-notice">${esc(notice)}</div>` : '';
      if (s.stage === 'GATE_LOCKED') foot = `<div class="c-locked">Answers locked <span>waiting for the reveal…</span></div>`;
      if (s.stage === 'GATE_REVEAL') {
        const ok = mine === g.correctId;
        const score = me.last?.attemptId === g.attemptId ? me.last : null;
        const gained = score ? (score.gain ? `Correct! +${score.gain} <span>${(score.ms / 1000).toFixed(1)} s</span>` : 'Correct! <span>already scored</span>') : 'Correct!';
        foot = `<div class="c-result ${mine ? (ok ? 'ok' : 'bad') : 'none'}">${mine ? (ok ? (g.practice ? 'Correct!' : gained) : 'Not this time') : 'You didn\'t answer'}</div>
          <div class="c-verdict ${g.passed ? 'pass' : 'fail'}">${g.passed ? 'Engines unlocked' : g.failReason === 'quorum' ? 'Engines locked: not enough answers' : `Engines locked: under ${Math.round((g.need ?? 0.5) * 100)}% correct`}</div>
          <p class="c-why">${esc(g.explanation ?? '')}</p>`;
      }
      return `<section class="c-gate${g.boss ? ' boss' : ''}">
          <div class="c-kicker">${g.boss ? '<span class="c-boss">Boss gate</span> ' : ''}Knowledge Gate ${g.gateIndex + 1} · ${GATE_NAMES[g.gateIndex]}${g.practice ? ' · practice' : ''}${g.mult && g.mult > 1 ? ` · ×${g.mult} points` : ''}</div>
          <div class="c-target">${esc(t?.title ?? '')}</div>
          <h2 class="c-q">${esc(g.prompt)}</h2>
          ${s.stage === 'GATE_OPEN' ? clockHtml(g.closesAt, g.closesAt - g.opensAt) : ''}
          ${s.paused ? '<div class="c-notice">Paused by the host</div>' : ''}
          <div class="c-choices">${g.choices.map((c, i) => {
            const right = g.correctId === c.id, picked = mine === c.id;
            const share = g.distribution ? Math.round((100 * g.distribution[i]) / total) : null;
            return `<button class="c-choice${picked ? ' picked' : ''}${g.correctId ? (right ? ' right' : ' wrong') : ''}" data-choice="${c.id}" ${open ? '' : 'disabled'}>
              <span class="c-l">${LETTERS[i]}</span><span class="c-ct">${esc(c.label)}</span>${share !== null ? `<span class="c-pct">${share}%</span><span class="c-cbar"><i style="width:${share}%"></i></span>` : ''}
            </button>`;
          }).join('')}</div>
          ${foot}
        </section>`;
    }
    case 'NODE_COMPLETE': {
      const d = s.lastDiscovered;
      return `<section class="c-hero done"><div class="c-kicker">${d?.id === 'S01' ? 'Practice complete' : 'Destination discovered'}</div><h1>${esc(d?.title ?? '')}</h1>
        ${d && d.id !== 'S01' ? `<p>Crew accuracy ${d.accuracy}%${d.assisted ? ' · assisted' : ' · clean run'}</p>` : ''}
        <ul class="c-facts">${(d?.facts ?? []).map((f) => `<li>${esc(f)}</li>`).join('')}</ul></section>${leaders()}`;
    }
  }
  return '';
}

function render(): void {
  if (!room) return renderJoin();
  if (!snap && challenged) {
    const html = `<div class="c-wait"><div class="c-kicker">Room ${esc(room)}</div><p>${SITEKEY ? 'One quick check that you\'re a person, then you\'re in.' : 'This crew relay needs a human check that this page is not set up for.'}</p><div id="c-ts" class="c-ts"></div><button class="c-btn ghost" data-leave>Change code</button></div>`;
    if (html !== lastRendered) { root.innerHTML = html; lastRendered = html; }
    if (SITEKEY) mountChallenge();
    return;
  }
  if (!snap) {
    const waited = Date.now() - joinedAt;
    const msg = full ? 'This crew is full right now. Try again in a minute!' : waited > 8000 ? 'Can\'t reach this room yet. Is the stream live and the code right?' : 'Connecting to the expedition…';
    const html = `<div class="c-wait"><div class="c-orbit"><i></i></div><div class="c-kicker">Room ${esc(room)}</div><p>${msg}</p>${waited > 8000 || full ? '<button class="c-btn ghost" data-leave>Change code</button>' : ''}</div>`;
    if (html !== lastRendered) { root.innerHTML = html; lastRendered = html; }
    return;
  }
  const stale = Date.now() - lastStateAt > 12000;
  const html = `${header()}${stale ? '<div class="c-notice top">Waiting for the host… progress is safe.</div>' : ''}<div class="c-body stage-${snap.stage.toLowerCase()}">${body()}</div>`;
  // the clock ticks separately; only rebuild when something else changed
  if (html === lastRendered) return;
  const focused = (document.activeElement as HTMLElement | null)?.dataset;
  // entrance animations play once per stage, not on every answer-count update
  const key = `${snap.stage}|${snap.gate?.attemptId ?? ''}|${snap.vote?.voteId ?? ''}`;
  root.classList.toggle('still', key === lastKey);
  lastKey = key;
  root.innerHTML = html;
  lastRendered = html;
  if (focused?.choice) root.querySelector<HTMLElement>(`[data-choice="${focused.choice}"]`)?.focus();
  tickClock();
}

function tickClock(): void {
  for (const el of root.querySelectorAll<HTMLElement>('.c-timer')) {
    const left = Math.max(0, Number(el.dataset.until) - (Date.now() + clockOffset));
    const total = Number(el.dataset.total) || 1;
    const s = Math.ceil(left / 1000);
    el.querySelector('span')!.textContent = `${s}s`;
    (el.querySelector('i') as HTMLElement).style.width = `${Math.min(100, (100 * left) / total)}%`;
    el.classList.toggle('low', s <= 10);
  }
}

function renderJoin(): void {
  const fromLink = codeFromUrl();
  const code = fromLink || store.get('yeis.crew.room');
  root.innerHTML = `
    <section class="c-join">
      <img class="c-logo" src="/logo-white.png" alt="Your Eyes In Space" />
      <div class="c-kicker">Your Eyes In Space · Viewer crew</div>
      <h1>The Great Expedition</h1>
      <p>You're joining a live stream's crew. Answer science questions together to unlock the next destination, from Earth to the edge of the observable universe.</p>
      <form id="c-form" autocomplete="off">
        ${fromLink
          ? `<div class="c-room">Room <b>${esc(code)}</b></div><input id="c-code" type="hidden" value="${esc(code)}" />`
          : `<label><span>Room code (shown on stream)</span><input id="c-code" maxlength="8" value="${esc(code)}" placeholder="ASTRO7" autocapitalize="characters" spellcheck="false" inputmode="text" required /></label>`}
        <label><span>Your nickname (shown on the leaderboard)</span><input id="c-nick" maxlength="20" value="${esc(nick)}" placeholder="e.g. StarGazer42" spellcheck="false" required /></label>
        <button class="c-btn" type="submit">Join crew</button>
      </form>
      <small>No account, no app. Your points stay with this browser.</small>
    </section>`;
  lastRendered = '';
  const form = root.querySelector('#c-form') as HTMLFormElement;
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const c = (root.querySelector('#c-code') as HTMLInputElement).value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    const n = (root.querySelector('#c-nick') as HTMLInputElement).value.trim().slice(0, 20);
    if (c.length < 4 || !n) return;
    room = c; nick = n;
    store.set('yeis.crew.room', c);
    store.set('yeis.crew.nick', n);
    joinedAt = Date.now();
    snap = null;
    link.join(room);
    hello();
    render();
    setTimeout(render, 8200);
  });
  if (!code) (root.querySelector('#c-code') as HTMLInputElement).focus();
  else if (!nick) (root.querySelector('#c-nick') as HTMLInputElement).focus();
}

root.addEventListener('click', (e) => {
  const t = e.target as HTMLElement;
  const choice = t.closest<HTMLElement>('[data-choice]');
  if (choice && snap?.gate && snap.stage === 'GATE_OPEN' && !(choice as HTMLButtonElement).disabled) {
    const g = snap.gate;
    notice = '';
    pending = { attemptId: g.attemptId, choiceId: choice.dataset.choice!, at: Date.now() };
    link.send({ from: 'crew', msg: { t: 'answer', room, pid, attemptId: g.attemptId, choiceId: pending.choiceId } });
    navigator.vibrate?.(12);
    sfx.play('tap');
    render();
    return;
  }
  const vote = t.closest<HTMLElement>('[data-vote]');
  if (vote && snap?.vote && !snap.vote.closed) {
    me.votedFor = vote.dataset.vote;
    sfx.play('tap');
    link.send({ from: 'crew', msg: { t: 'vote', room, pid, voteId: snap.vote.voteId, nodeId: vote.dataset.vote! } });
    render();
    return;
  }
  const ev = t.closest<HTMLElement>('[data-event-vote]');
  if (ev && snap?.event && !snap.event.closed) {
    me.votedFor = ev.dataset.eventVote;
    sfx.play('tap');
    link.send({ from: 'crew', msg: { t: 'vote', room, pid, voteId: snap.event.voteId, nodeId: ev.dataset.eventVote! } });
    render();
    return;
  }
  if (t.closest('[data-leave]')) { room = ''; snap = null; full = false; challenged = false; link.join(''); render(); }
});

// a direct join link with a remembered nickname drops straight into the room
if (codeFromUrl() && nick) { room = codeFromUrl(); joinedAt = Date.now(); link.join(room); hello(); setTimeout(render, 8200); }
render();
