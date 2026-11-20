import { _, fmtNum } from '../i18n';

/**
 * The donation card: a quiet card in the corner (it blocks nothing, the universe keeps running
 * behind it) that says plainly who uses the site and what the money pays for. It comes:
 *  - after the visitor's second finished tour (then every third one more),
 *  - at the end of every Academy chapter,
 *  - on the fifth visit to the site (then every tenth one more),
 * never twice within COOLDOWN, and not for a long while after someone opened a way to give.
 * Everything is kept in this browser only (localStorage), nothing is sent anywhere.
 */

export type SupportReason = 'visit' | 'tour' | 'chapter' | 'manual';

const KEY = 'yeits.supportAsk';
/** no two cards within this time (any reason) */
const COOLDOWN_MS = 12 * 3600_000;
/** after someone opened GitHub Sponsors / Buy Me a Coffee from it: this long without a card */
const THANKED_MS = 60 * 86400_000;
/** reloads within this time are the same visit */
const SAME_VISIT_MS = 30 * 60_000;
const FIRST_VISIT_ASK = 5, VISIT_EVERY = 10;
const FIRST_TOUR_ASK = 2, TOUR_EVERY = 3;

const SPONSORS = 'https://github.com/sponsors/berkcomba';
const COFFEE = 'https://buymeacoffee.com/berkcomba';

interface State {
  visits: number;
  lastVisitAt: number;
  tours: number;
  nextVisitAsk: number;
  nextTourAsk: number;
  lastShown: number;
  gaveAt: number;
}

function load(): State {
  const d: State = { visits: 0, lastVisitAt: 0, tours: 0, nextVisitAsk: FIRST_VISIT_ASK, nextTourAsk: FIRST_TOUR_ASK, lastShown: 0, gaveAt: 0 };
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...d, ...(JSON.parse(raw) as Partial<State>) };
  } catch { /* private mode, blocked storage */ }
  return d;
}

export interface SupportHost {
  /** a tour, lesson or event is playing: a visit card waits for it */
  readonly busy: boolean;
}

/** the reasons for the money, in order: icon (svg path data), title, text (Turkish source strings) */
const COSTS: Array<[string, string, string]> = [
  ['M4 5h16v5H4zM4 14h16v5H4zM7 7.5h.01M7 16.5h.01',
    'Sunucu ve bant genişliği', 'Her ziyarette yüzlerce megabayt doku, 3B model, harita ve ses indiriliyor.'],
  ['M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3zM5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7',
    'Seslendirme', 'Turlar ve dersler beş dilde, aylık ücretli bir seslendirme servisiyle anlatılıyor.'],
  ['M9.5 9.5l5 5M3.5 9.5l3-3 4 4-3 3zM13.5 17.5l3-3 4 4-3 3zM15 3.5a5.5 5.5 0 0 1 5.5 5.5M15 6.5a2.5 2.5 0 0 1 2.5 2.5',
    'Görüntü ve veri', 'Uydu görüntüleri, gezegen haritaları ve gök katalogları sürekli sunuluyor.'],
  ['M8 6l-6 6 6 6M16 6l6 6-6 6M14 4l-4 16',
    'Geliştirme', 'Yeni gezegenler, yeni dersler ve hata düzeltmeleri için ayrılan zaman.'],
];

export class SupportAsk {
  /** off in stream mode, party rooms and embeds */
  enabled = true;
  private state = load();
  private root: HTMLElement | null = null;
  private readonly onKey = (e: KeyboardEvent): void => { if (e.key === 'Escape') this.close(); };

  constructor(private readonly host: SupportHost) {}

  private save(): void {
    try { localStorage.setItem(KEY, JSON.stringify(this.state)); } catch { /* storage blocked */ }
  }

  private allowed(now = Date.now()): boolean {
    const s = this.state;
    return this.enabled && !this.root && now - s.lastShown > COOLDOWN_MS && now - s.gaveAt > THANKED_MS;
  }

  /** Count this visit (once per SAME_VISIT_MS) and, on the fifth and every tenth after, show the card once the view is free. */
  noteVisit(delayMs: number): void {
    const s = this.state, now = Date.now();
    if (now - s.lastVisitAt > SAME_VISIT_MS) s.visits++;
    s.lastVisitAt = now;
    this.save();
    if (s.visits < s.nextVisitAsk) return;
    let tries = 0;
    const attempt = (): void => {
      // a playing tour or lesson keeps the screen: wait for it (a few minutes at most)
      if (this.host.busy && tries++ < 12) { window.setTimeout(attempt, 30_000); return; }
      if (!this.host.busy && this.show('visit')) {
        this.state.nextVisitAsk = this.state.visits + VISIT_EVERY;
        this.save();
      }
    };
    window.setTimeout(attempt, delayMs);
  }

  /** a guided tour played to its end */
  noteTourFinished(): void {
    const s = this.state;
    s.tours++;
    this.save();
    if (s.tours >= s.nextTourAsk && this.show('tour')) {
      s.nextTourAsk = s.tours + TOUR_EVERY;
      this.save();
    }
  }

  /** the last section of an Academy chapter is behind the visitor */
  noteChapterFinished(): void {
    this.show('chapter');
  }

  /** Show the card (subject to the cooldowns unless `force`); returns whether it opened. */
  show(reason: SupportReason, force = false): boolean {
    if (!force && !this.allowed()) return false;
    if (this.root) return false;
    // opened by hand (the heart in the top bar): no cooldown is spent on it
    if (!force) { this.state.lastShown = Date.now(); this.save(); }
    this.build(reason);
    return true;
  }

  private build(reason: SupportReason): void {
    const root = document.createElement('aside');
    root.className = 'sask';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'false');
    root.setAttribute('aria-labelledby', 'sask-title');
    const kicker = reason === 'manual' ? _('Projeyi destekle')
      : reason === 'tour' ? _('Turları sevdin gibi görünüyor')
      : reason === 'chapter' ? _('Bir bölümü daha bitirdin')
        : _('Yine hoş geldin');
    root.innerHTML = `
      <button class="sask-close icon-btn small" type="button" aria-label="${esc(_('Kapat'))}">✕</button>
      ${hero()}
      <div class="sask-body">
        <div class="sask-kicker">${esc(kicker)}</div>
        <h2 id="sask-title" class="sask-title">${esc(_('Bu evreni herkese açık tutalım'))}</h2>
        <p class="sask-lead"><span class="sask-reach"></span>${esc(_('Aileler çocuklarıyla gezegenleri geziyor, öğretmenler derste tahtaya yansıtıp Güneş Sistemi\'ni anlatıyor, meraklılar galaksiler arasında kayboluyor.'))}</p>
        <p class="sask-why">${esc(_('Hepsi ücretsiz, reklamsız ve açık kaynak; öyle de kalacak. Ama her ziyaretin bir maliyeti var:'))}</p>
        <ul class="sask-costs">
          ${COSTS.map(([d, t, x], i) => `<li style="--i:${i}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg><div><b>${esc(_(t))}</b><span>${esc(_(x))}</span></div></li>`).join('')}
        </ul>
        <p class="sask-ask">${esc(_('Küçük bir katkı bile bu masrafları paylaşmamıza ve yeni şeyler eklemeye devam etmemize yardım eder.'))}</p>
        <div class="sask-actions">
          <a class="sask-give sask-primary" href="${SPONSORS}" target="_blank" rel="noopener noreferrer">
            <svg class="sask-heart" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.7c0 5.6-7.5 10.2-7.5 10.2z"/></svg>
            <span>${esc(_('GitHub Sponsors ile destekle'))}</span>
          </a>
          <a class="sask-give" href="${COFFEE}" target="_blank" rel="noopener noreferrer">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8h11v6.5a4.5 4.5 0 0 1-4.5 4.5h-2A4.5 4.5 0 0 1 5 14.5ZM16 9.5h1.5a2.5 2.5 0 0 1 0 5H16M3.5 21.5h14"/></svg>
            <span>${esc(_('Bir kahve ısmarla'))}</span>
          </a>
        </div>
        <div class="sask-foot">
          <button class="sask-later" type="button">${esc(_('Şimdi değil'))}</button>
          <span>${esc(_('Bağış zorunlu değil; site her zaman ücretsiz kalacak.'))}</span>
        </div>
      </div>`;
    root.querySelector('.sask-close')!.addEventListener('click', () => this.close());
    root.querySelector('.sask-later')!.addEventListener('click', () => this.close());
    root.querySelectorAll<HTMLAnchorElement>('.sask-give').forEach((a) => a.addEventListener('click', () => {
      this.state.gaveAt = Date.now();
      this.save();
      root.classList.add('thanked');
      const t = root.querySelector('.sask-ask');
      if (t) t.textContent = _('Teşekkürler! Bu evreni açık tutan sizsiniz.');
      window.setTimeout(() => this.close(), 2600);
    }));
    document.body.appendChild(root);
    this.root = root;
    document.addEventListener('keydown', this.onKey);
    void this.fillReach(root.querySelector<HTMLElement>('.sask-reach')!);
  }

  /** the site's visit count (the About panel's, regenerated daily), counted up as the card opens */
  private async fillReach(el: HTMLElement): Promise<void> {
    try {
      const r = await fetch(`${import.meta.env.BASE_URL}stats.json`, { cache: 'no-cache' });
      if (!r.ok) return;
      const s = (await r.json()) as { visits?: number };
      const n = s.visits ?? 0;
      if (!(n > 0) || !el.isConnected) return;
      const millions = n >= 1e6;
      const target = millions ? Math.floor(n / 1e5) / 10 : n;
      const render = (v: number): string => millions
        ? _('Your Eyes In Space bugüne kadar {n} milyondan fazla kez ziyaret edildi. ', { n: fmtNum(v, { maximumFractionDigits: 1 }) })
        : _('Your Eyes In Space bugüne kadar {n} kez ziyaret edildi. ', { n: fmtNum(Math.round(v)) });
      const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (still) { el.textContent = render(target); return; }
      const t0 = performance.now(), dur = 1400;
      const step = (now: number): void => {
        if (!el.isConnected) return;
        const k = Math.min(1, (now - t0) / dur);
        const e = 1 - Math.pow(1 - k, 3);
        el.textContent = render(millions ? Math.round(target * e * 10) / 10 : target * e);
        if (k < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    } catch { /* offline: the card reads fine without the number */ }
  }

  /** the top bar's heart: open the card, or close it when it is open */
  toggle(): void {
    if (this.root) this.close();
    else this.show('manual', true);
  }

  get open(): boolean { return this.root !== null; }

  close(): void {
    const root = this.root;
    if (!root) return;
    this.root = null;
    document.removeEventListener('keydown', this.onKey);
    root.classList.add('leaving');
    window.setTimeout(() => root.remove(), 320);
  }
}

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
}

/**
 * The animated picture on top: a night sky with twinkling stars and the odd shooting star, a
 * ringed planet with its moon going round, and on the hill a grown-up and a child at a telescope.
 */
function hero(): string {
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let stars = '';
  // deterministic scatter (no Math.random: the same sky every time)
  for (let i = 0; i < 34; i++) {
    const x = (i * 97.3) % 360, y = (i * 53.7) % 78 + 4;
    const r = i % 7 === 0 ? 1.3 : i % 3 === 0 ? 0.9 : 0.6;
    stars += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r}" style="--d:${((i * 0.37) % 3).toFixed(2)}s"/>`;
  }
  return `
  <svg class="sask-hero" viewBox="0 0 360 120" aria-hidden="true" preserveAspectRatio="xMidYMid slice">
    <defs>
      <linearGradient id="sask-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#070b1a"/><stop offset="0.65" stop-color="#1d2650"/><stop offset="1" stop-color="#3a4a82"/></linearGradient>
      <radialGradient id="sask-dusk" cx="0.5" cy="1" r="0.6"><stop offset="0" stop-color="#e3a64f" stop-opacity="0.38"/><stop offset="1" stop-color="#e3a64f" stop-opacity="0"/></radialGradient>
      <radialGradient id="sask-planet" cx="0.35" cy="0.35" r="0.75"><stop offset="0" stop-color="#f4d9a6"/><stop offset="0.6" stop-color="#c98f52"/><stop offset="1" stop-color="#5b3a1e"/></radialGradient>
      <radialGradient id="sask-glow" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#e3a64f" stop-opacity="0.35"/><stop offset="1" stop-color="#e3a64f" stop-opacity="0"/></radialGradient>
    </defs>
    <rect width="360" height="120" fill="url(#sask-sky)"/>
    <g class="sask-stars" fill="#fff">${stars}</g>
    <line class="sask-meteor" x1="40" y1="14" x2="88" y2="34" stroke="#fff" stroke-width="1.2" stroke-linecap="round"/>
    <g transform="translate(272 44)">
      <circle r="34" fill="url(#sask-glow)"/>
      <g transform="rotate(-18)">
        <path d="M-31 0 A31 7 0 0 1 31 0" fill="none" stroke="#d8c39a" stroke-opacity="0.4" stroke-width="2.4"/>
        <circle r="17" fill="url(#sask-planet)" transform="rotate(18)"/>
        <path d="M-31 0 A31 7 0 0 0 31 0" fill="none" stroke="#ead9b2" stroke-opacity="0.85" stroke-width="2.4"/>
      </g>
      <g><circle cx="40" cy="0" r="3" fill="#cfd6e4"/>${still ? '' : '<animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="9s" repeatCount="indefinite"/>'}</g>
    </g>
    <ellipse cx="96" cy="100" rx="120" ry="48" fill="url(#sask-dusk)"/>
    <path d="M0 120 L0 98 Q70 78 150 92 T360 96 L360 120 Z" fill="#0b0f1d"/>
    <g fill="#0b0f1d" stroke="#0b0f1d">
      <!-- telescope on its tripod, aimed at the planet -->
      <rect x="104" y="70" width="34" height="6" rx="2" transform="rotate(-24 104 76)"/>
      <path d="M112 78 L104 96 M112 78 L120 96 M112 78 L112 96" stroke-width="2" fill="none"/>
      <!-- the child at the eyepiece -->
      <circle cx="96" cy="74" r="4.6"/>
      <path d="M91 80 Q96 77 101 80 L102 95 L90 95 Z"/>
      <!-- the grown-up beside, pointing up -->
      <circle cx="74" cy="64" r="5.4"/>
      <path d="M67 71 Q74 67 81 71 L83 95 L65 95 Z"/>
      <path d="M80 73 L92 58" stroke-width="3" stroke-linecap="round" fill="none"/>
    </g>
  </svg>`;
}
