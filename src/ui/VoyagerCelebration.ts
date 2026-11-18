import { _, currentLocale, localeTag, type Locale } from '../i18n';
import { ModelSpin } from './ModelSpin';
import { playTromboneFanfare } from './fanfare';

/**
 * Voyager 1 one light-day from Earth (18 November 2026): a one-time celebration card, shown once
 * per browser until the end of 23 November. Confetti, the probe's story in six dates, and its
 * Golden Record greeting in the visitor's language (the app's language, which follows the
 * browser's unless chosen otherwise), with the other four a tap away.
 *
 * The greetings are cut from NASA's recording of the 55 greetings on the record (public domain,
 * via Wikimedia Commons: "Voyager Golden Record - Greetings In 55 Languages.mp3").
 */

/** localStorage flag: the card has been shown in this browser */
const KEY = 'yeits.voyagerLightDay';
/** shown until the end of 23 November 2026 (UTC) */
const UNTIL = Date.parse('2026-11-24T00:00:00Z');
/** and not before the threshold itself */
const FROM = Date.parse('2026-11-18T10:17:00Z');

interface Greeting {
  /** language name in its own language */
  label: string;
  /** the words on the record, as spoken */
  text: string;
  /** who speaks them (English: Nick Sagan, then six) */
  speaker?: string;
  /** shown after the closing quote mark */
  after?: string;
  src: string;
}

const GREETINGS: Record<Locale, Greeting> = {
  tr: { label: 'Türkçe', text: 'Sayın Türkçe bilen arkadaşlarımız, sabah şerifleriniz hayrolsun.', after: '🥸', src: '/events/voyager/greeting-tr.mp3' },
  en: { label: 'English', text: 'Hello from the children of planet Earth.', speaker: 'Nick Sagan', src: '/events/voyager/greeting-en.mp3' },
  de: { label: 'Deutsch', text: 'Herzliche Grüße an alle.', src: '/events/voyager/greeting-de.mp3' },
  es: { label: 'Español', text: 'Hola y saludos a todos.', src: '/events/voyager/greeting-es.mp3' },
  fr: { label: 'Français', text: 'Bonjour tout le monde.', src: '/events/voyager/greeting-fr.mp3' },
};
const ORDER: Locale[] = ['tr', 'en', 'de', 'es', 'fr'];

/** the six dates of the story: ISO date, then title and text (Turkish source strings) */
const STORY: Array<[string, string, string]> = [
  ['1977-09-05', 'Fırlatma', 'Florida\'dan bir Titan IIIE roketiyle yola çıktı. Kardeşi Voyager 2\'den on altı gün sonra, ama daha hızlı bir rotada.'],
  ['1979-03-05', 'Jüpiter', 'Io\'da etkin volkanlar buldu: Dünya dışında ilk kez canlı bir volkan görüldü.'],
  ['1980-11-12', 'Satürn ve Titan', 'Titan\'ın kalın, turuncu atmosferine yakından baktı, sonra Güneş Sistemi\'nin düzleminden yukarı doğru saptı.'],
  ['1990-02-14', 'Soluk Mavi Nokta', 'Altı milyar kilometreden dönüp Dünya\'nın fotoğrafını çekti: bir güneş ışını içinde, pikselden küçük bir nokta.'],
  ['2012-08-25', 'Yıldızlararası uzay', 'Güneş rüzgârının sona erdiği heliopause\'u aştı; yıldızlararası uzaya giren ilk insan yapımı cisim oldu.'],
  ['2026-11-18', 'Bir ışık günü', 'Dünya\'dan 25,9 milyar kilometre uzakta. Gönderdiği bir sinyal, ışık hızıyla bile bize tam 24 saatte ulaşıyor.'],
];

export interface CelebrationHost {
  /** play the Events tab scene of the milestone */
  playEventById(id: string): void;
  /** the visitor's music volume (0 … 1): the fanfare follows it */
  readonly settings: { musicVolume: number };
}

export class VoyagerCelebration {
  /** due in this browser now: inside the window and not seen yet */
  static get due(): boolean {
    const now = Date.now();
    if (now < FROM || now >= UNTIL) return false;
    try { return localStorage.getItem(KEY) === null; } catch { return false; }
  }

  private root: HTMLElement | null = null;
  private audio: HTMLAudioElement | null = null;
  private confetti: Confetti | null = null;
  private model: ModelSpin | null = null;
  private readonly onKey = (e: KeyboardEvent): void => { if (e.key === 'Escape') { e.preventDefault(); this.close(); } };

  constructor(private readonly host: CelebrationHost) {}

  show(): void {
    if (this.root) return;
    try { localStorage.setItem(KEY, '1'); } catch { /* private mode: it may come back next visit */ }
    const lang = currentLocale();
    const root = document.createElement('div');
    root.className = 'v1day';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-labelledby', 'v1day-title');
    const canvas = document.createElement('canvas');
    canvas.className = 'v1day-confetti';
    root.appendChild(canvas);
    const card = document.createElement('div');
    card.className = 'v1day-card';
    card.innerHTML = `
      <button class="v1day-close" type="button" aria-label="${esc(_('Kapat'))}">×</button>
      <div class="v1day-hero">
        <svg class="v1day-signal" viewBox="0 0 600 120" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
          <line x1="40" y1="60" x2="560" y2="60" class="v1day-path"/>
          <circle cx="40" cy="60" r="7" class="v1day-earth"/>
          <text x="40" y="92" text-anchor="middle">${esc(_('Dünya'))}</text>
          <g class="v1day-probe"><circle cx="560" cy="60" r="3.5"/><circle cx="560" cy="60" r="10" class="v1day-ring"/></g>
          <text x="560" y="92" text-anchor="middle">Voyager 1</text>
          <circle cx="560" cy="60" r="4" class="v1day-pulse"/>
          <text x="300" y="44" text-anchor="middle" class="v1day-lt">${esc(_('24 saat'))}</text>
        </svg>
        <div class="v1day-hero-row">
        <div class="v1day-hero-text">
          <div class="v1day-kicker">${esc(fmtDate('2026-11-18'))} · ${esc(_('bir eşik geçildi'))}</div>
          <h2 id="v1day-title">${esc(_('Voyager 1 artık bir ışık günü uzakta'))}</h2>
          <p>${esc(_('49 yıl önce fırlatılan bir uzay aracı, Dünya\'dan ışığın tam bir günde katettiği uzaklığa ulaştı. Bunu daha önce hiçbir insan yapımı nesne başaramadı.'))}</p>
        </div>
        <div class="v1day-model" title="${esc(_('Sürükleyerek çevir'))}"></div>
        </div>
      </div>
      <dl class="v1day-stats">
        <div><dt>24 ${esc(_('saat'))}</dt><dd>${esc(_('sinyalin Dünya\'ya ulaşma süresi'))}</dd></div>
        <div><dt>${(25.9).toLocaleString(localeTag())} ${esc(_('milyar km'))}</dt><dd>${esc(_('Dünya\'ya uzaklığı'))}</dd></div>
        <div><dt>17 km/s</dt><dd>${esc(_('Güneş\'ten uzaklaşma hızı'))}</dd></div>
      </dl>
      <section class="v1day-record">
        <img src="/tour-media/goldenrecord.jpg" alt="${esc(_('Altın Plak'))}">
        <div class="v1day-record-body">
          <h3>${esc(_('Altın Plak\'tan senin dilinde bir selam'))}</h3>
          <p class="v1day-record-note">${esc(_('Voyager\'ın üzerinde Dünya\'nın seslerini, 115 görüntüyü ve 55 dilde selamı içeren altın kaplama bir plak var. Bu da o selamlardan biri, 1977\'de kaydedildiği gibi:'))}</p>
          <div class="v1day-player">
            <button class="v1day-play" type="button" aria-label="${esc(_('Selamı dinle'))}"><span class="v1day-play-icon" aria-hidden="true"></span></button>
            <div>
              <blockquote class="v1day-quote" lang=""></blockquote>
              <div class="v1day-speaker"></div>
            </div>
          </div>
          <div class="v1day-langs" role="group" aria-label="${esc(_('Diğer dillerde dinle'))}"></div>
        </div>
      </section>
      <ol class="v1day-story">${STORY.map(([date, title, text], i) => `
        <li${i === STORY.length - 1 ? ' class="now"' : ''}><time datetime="${date}">${esc(fmtDate(date))}</time><b>${esc(_(title))}</b><span>${esc(_(text))}</span></li>`).join('')}
      </ol>
      <div class="v1day-actions">
        <button class="primary v1day-watch" type="button">${esc(_('Bu anı izle'))}</button>
        <button class="v1day-later" type="button">${esc(_('Keşfe devam et'))}</button>
      </div>
      <p class="v1day-credit">${esc(_('Selam kaydı: NASA, Voyager Altın Plak (kamu malı).'))}</p>`;
    root.appendChild(card);
    document.body.appendChild(root);
    this.root = root;

    const langs = card.querySelector('.v1day-langs') as HTMLElement;
    for (const l of ORDER) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = GREETINGS[l].label;
      b.dataset.lang = l;
      b.addEventListener('click', () => { this.select(l); void this.play(); });
      langs.appendChild(b);
    }
    this.select(lang);
    card.querySelector('.v1day-play')!.addEventListener('click', () => (this.audio && !this.audio.paused ? this.audio.pause() : void this.play()));
    card.querySelector('.v1day-close')!.addEventListener('click', () => this.close());
    card.querySelector('.v1day-later')!.addEventListener('click', () => this.close());
    card.querySelector('.v1day-watch')!.addEventListener('click', () => { this.close(); this.host.playEventById('voyager1-light-day-2026'); });
    root.addEventListener('pointerdown', (e) => { if (e.target === root || e.target === canvas) this.close(); });
    window.addEventListener('keydown', this.onKey, true);
    (card.querySelector('.v1day-play') as HTMLButtonElement).focus({ preventScroll: true });

    try { this.model = new ModelSpin(card.querySelector('.v1day-model') as HTMLElement, '/models/voyager.glb'); } catch { /* no WebGL left: the card stands without it */ }
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!still) { this.confetti = new Confetti(canvas); this.confetti.start(); }
    // a trombone ta-da with the confetti (only where the browser already allows sound)
    void playTromboneFanfare(this.host.settings.musicVolume);
  }

  private select(l: Locale): void {
    const root = this.root;
    if (!root) return;
    const g = GREETINGS[l];
    if (this.audio) { this.audio.pause(); this.audio = null; }
    this.audio = new Audio(g.src);
    this.audio.preload = 'auto';
    const btn = root.querySelector('.v1day-play') as HTMLElement;
    this.audio.addEventListener('play', () => btn.classList.add('playing'));
    for (const ev of ['pause', 'ended']) this.audio.addEventListener(ev, () => btn.classList.remove('playing'));
    const q = root.querySelector('.v1day-quote') as HTMLElement;
    q.textContent = `“${g.text}”${g.after ? ` ${g.after}` : ''}`;
    q.lang = l;
    (root.querySelector('.v1day-speaker') as HTMLElement).textContent = g.speaker
      ? `${g.label} · ${g.speaker}`
      : g.label;
    for (const b of root.querySelectorAll<HTMLButtonElement>('.v1day-langs button')) b.classList.toggle('active', b.dataset.lang === l);
  }

  private async play(): Promise<void> {
    try { await this.audio?.play(); } catch { /* blocked or missing: the button stays idle */ }
  }

  close(): void {
    if (!this.root) return;
    this.audio?.pause();
    this.audio = null;
    this.confetti?.stop();
    this.confetti = null;
    this.model?.dispose();
    this.model = null;
    window.removeEventListener('keydown', this.onKey, true);
    const root = this.root;
    this.root = null;
    root.classList.add('leaving');
    window.setTimeout(() => root.remove(), 260);
  }
}

/** a calendar date in the reader's language ("5 Eylül 1977", "September 5, 1977", "5. September 1977") */
function fmtDate(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString(localeTag(), { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
}

/** Paper confetti: two bursts from the lower corners, then a gentle fall from the top for a few seconds */
class Confetti {
  private readonly ctx: CanvasRenderingContext2D;
  private parts: Array<{ x: number; y: number; vx: number; vy: number; r: number; vr: number; w: number; h: number; c: string; life: number }> = [];
  private raf = 0;
  private last = 0;
  private t = 0;
  private static readonly COLOURS = ['#bd9b6c', '#e8d3a8', '#f0f0eb', '#8fb996', '#7fa7d9', '#d98f7e', '#c9a7e0'];

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
  }

  start(): void {
    this.resize();
    const W = this.canvas.width, H = this.canvas.height, d = devicePixelRatio || 1;
    const burst = (x: number, dir: number) => {
      for (let i = 0; i < 90; i++) {
        const a = (-Math.PI / 2) + dir * (0.25 + Math.random() * 0.5);
        const v = (900 + Math.random() * 900) * d;
        this.parts.push(this.part(x, H, Math.cos(a) * v, Math.sin(a) * v));
      }
    };
    burst(0, 1);
    burst(W, -1);
    this.last = performance.now();
    const step = (now: number) => {
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      this.t += dt;
      // a light snow of confetti from the top for the first four seconds
      if (this.t < 4) for (let i = 0; i < 3; i++) this.parts.push(this.part(Math.random() * W, -10 * d, (Math.random() - 0.5) * 80 * d, 60 * d));
      this.draw(dt);
      if (this.parts.length || this.t < 4) this.raf = requestAnimationFrame(step);
      else this.ctx.clearRect(0, 0, W, H);
    };
    this.raf = requestAnimationFrame(step);
  }

  stop(): void { cancelAnimationFrame(this.raf); this.parts = []; }

  private part(x: number, y: number, vx: number, vy: number) {
    const d = devicePixelRatio || 1;
    return {
      x, y, vx, vy, r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 12,
      w: (6 + Math.random() * 6) * d, h: (3 + Math.random() * 4) * d,
      c: Confetti.COLOURS[Math.floor(Math.random() * Confetti.COLOURS.length)], life: 0,
    };
  }

  private resize(): void {
    const d = devicePixelRatio || 1;
    this.canvas.width = Math.round(innerWidth * d);
    this.canvas.height = Math.round(innerHeight * d);
  }

  private draw(dt: number): void {
    const { ctx, canvas } = this;
    const d = devicePixelRatio || 1;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const g = 900 * d, drag = Math.exp(-1.6 * dt);
    this.parts = this.parts.filter((p) => p.y < canvas.height + 40 * d && p.life < 9);
    for (const p of this.parts) {
      p.life += dt;
      p.vx *= drag; p.vy = p.vy * drag + g * dt * 0.35;
      // paper flutter: sideways sway, and the flip shows as a width that swings through zero
      p.x += (p.vx + Math.sin(p.life * 6 + p.r) * 30 * d) * dt;
      p.y += p.vy * dt;
      p.r += p.vr * dt;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.r);
      ctx.scale(Math.cos(p.life * 5 + p.r), 1);
      ctx.globalAlpha = Math.min(1, 9 - p.life);
      ctx.fillStyle = p.c;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }
  }
}
