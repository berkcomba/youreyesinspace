import type { TourCard, TourPlayer, TourState } from '../core/TourPlayer';
import { _ } from '../i18n';

function $<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element #${id}`);
  return el as T;
}

/** Tour list (side panel) + playback bar (bottom centre) for `TourPlayer` */
export class TourPanel {
  readonly panel = $('tours');
  private readonly list = $('tours-list');
  private readonly bar = $('tour-bar');
  private readonly title = $('tour-title');
  private readonly stepLabel = $('tour-step');
  private readonly subtitle = $('tour-subtitle');
  private readonly fill = $('tour-progress-fill');
  private readonly pauseBtn = $<HTMLButtonElement>('tour-pause');
  private readonly btn = $<HTMLButtonElement>('btn-tours');
  private readonly card = $('tour-card');
  private readonly cardImg = $<HTMLImageElement>('tour-card-img');
  private readonly ui = $('ui');
  private readonly chapter = $('tour-chapter');
  private readonly facts = $('tour-facts');
  private readonly dots = $('tour-dots');
  private lastSubtitle = '';
  private lastStep = -1;
  private lastTour: string | null = null;
  private lastPaused = false;
  private lastCard: TourCard | null = null;
  private cardHideTimer = 0;
  private hudTimer = 0;

  constructor(private readonly player: TourPlayer, private readonly onToggle: (show: boolean) => void) {
    this.build();
    $('tours-close').addEventListener('click', () => this.toggle(false));
    $('tour-prev').addEventListener('click', () => player.prev());
    $('tour-next').addEventListener('click', () => player.next());
    $('tour-stop').addEventListener('click', () => player.stop());
    this.pauseBtn.addEventListener('click', () => player.togglePause());
    player.onChange = (s) => this.render(s);
    // the HUD (title, transport) shows itself while the pointer moves and fades a moment later
    const wake = () => { if (!this.ui.classList.contains('touring')) return; this.ui.classList.add('hud'); window.clearTimeout(this.hudTimer); this.hudTimer = window.setTimeout(() => this.ui.classList.remove('hud'), 2800); };
    window.addEventListener('pointermove', wake, { passive: true });
    window.addEventListener('pointerdown', wake, { passive: true });
    window.addEventListener('keydown', wake);
  }

  toggle(show: boolean): void {
    this.panel.hidden = !show;
    this.btn.classList.toggle('active', show);
    this.onToggle(show);
  }

  private build(): void {
    this.list.innerHTML = '';
    this.player.available().forEach((tour, i) => {
      const el = document.createElement('button');
      el.className = 'tour-item';
      el.dataset.tour = tour.id;
      const index = String(i + 1).padStart(2, '0');
      el.innerHTML = `<span class="tour-index">${index}</span><span class="tour-text"><span class="tour-name">${_(tour.title)}</span><span class="tour-summary">${_(tour.summary)}</span></span><span class="tour-meta">${_('{n} durak', { n: tour.steps.length })}</span>`;
      el.addEventListener('click', () => {
        this.player.start(tour.id);
        this.toggle(false);
      });
      this.list.appendChild(el);
    });
  }

  private render(s: TourState): void {
    if (!s.tour) {
      if (!this.bar.hidden) { this.bar.hidden = true; this.ui.classList.remove('touring', 'hud'); }
      this.lastStep = -1;
      this.lastTour = null;
      this.lastSubtitle = '';
      this.chapter.classList.remove('show');
      this.facts.classList.remove('show');
      this.renderCard(null);
      return;
    }
    this.renderCard(s.card);
    if (this.bar.hidden) {
      this.bar.hidden = false;
      this.ui.classList.add('touring', 'hud');
      window.clearTimeout(this.hudTimer);
      this.hudTimer = window.setTimeout(() => this.ui.classList.remove('hud'), 4000);
    }
    const single = s.tour.steps.length === 1;
    if (this.lastTour !== s.tour.id) {
      this.lastTour = s.tour.id;
      this.title.textContent = _(s.tour.title);
      // a single-scene event has no chapters to count
      this.dots.replaceChildren(...(single ? [] : s.tour.steps.map(() => document.createElement('i'))));
    }
    if (this.lastStep !== s.stepIndex) {
      this.lastStep = s.stepIndex;
      const n = s.tour.steps.length;
      this.stepLabel.textContent = single ? '' : `${String(s.stepIndex + 1).padStart(2, '0')} / ${String(n).padStart(2, '0')}`;
      Array.from(this.dots.children).forEach((d, i) => { d.className = i < s.stepIndex ? 'done' : i === s.stepIndex ? 'now' : ''; });
      this.bar.classList.toggle('silent', s.silent);
      this.bar.title = s.silent ? _('Bu dil için ses bulunamadı; tur altyazıyla ilerliyor') : '';
      this.renderChapter(s);
    }
    if (this.lastSubtitle !== s.subtitle) {
      this.lastSubtitle = s.subtitle;
      this.subtitle.textContent = s.subtitle;
      this.subtitle.classList.remove('in');
      void this.subtitle.offsetWidth;
      this.subtitle.classList.add('in');
    }
    if (this.lastPaused !== s.paused) {
      this.lastPaused = s.paused;
      this.pauseBtn.textContent = s.paused ? '▶\uFE0E' : '❚❚';
      this.bar.classList.toggle('paused', s.paused);
    }
    this.fill.style.width = `${(s.progress * 100).toFixed(1)}%`;
  }

  /** Chapter title (full-screen, self-hiding) and the facts strip of the step that just began. */
  private renderChapter(s: TourState): void {
    const tour = s.tour!;
    const n = tour.steps.length;
    const eyebrow = tour.eyebrow ?? (n > 1 ? `${_(tour.title)} · ${s.stepIndex + 1} / ${n}` : '');
    $('tour-chapter-kicker').textContent = s.title ? eyebrow : '';
    $('tour-chapter-title').textContent = s.title ? _(s.title) : '';
    $('tour-chapter-sub').textContent = s.kicker ? _(s.kicker) : '';
    this.chapter.classList.remove('show');
    this.facts.classList.remove('show');
    this.facts.replaceChildren(...s.facts.map(([k, v]) => {
      const d = document.createElement('div');
      const dt = document.createElement('dt'); dt.textContent = _(k);
      const dd = document.createElement('dd'); dd.textContent = _(v);
      d.append(dt, dd);
      return d;
    }));
    void this.chapter.offsetWidth;
    if (s.title) this.chapter.classList.add('show');
    if (s.facts.length) this.facts.classList.add('show');
  }

  /** Corner inset: fades in with new content, fades out (keeping its content) when cleared. */
  private renderCard(c: TourCard | null): void {
    if (c === this.lastCard) return;
    this.lastCard = c;
    window.clearTimeout(this.cardHideTimer);
    if (!c) {
      this.card.classList.remove('show');
      // drop the picture once the fade-out has finished so a stale frame never flashes
      this.cardHideTimer = window.setTimeout(() => { if (!this.lastCard) { this.cardImg.hidden = true; this.cardImg.removeAttribute('src'); } }, 700);
      return;
    }
    const img = c.image ? `${import.meta.env.BASE_URL}tour-media/${c.image}` : '';
    if (img) {
      this.cardImg.hidden = false;
      if (this.cardImg.getAttribute('src') !== img) this.cardImg.src = img;
    } else {
      this.cardImg.hidden = true;
      this.cardImg.removeAttribute('src');
    }
    $('tour-card-title').textContent = c.title ? _(c.title) : '';
    $('tour-card-big').textContent = c.big ? _(c.big) : '';
    $('tour-card-text').textContent = c.text ? _(c.text) : '';
    $('tour-card-source').textContent = c.source ? _('Görsel: {source}', { source: c.source }) : '';
    // restart the entrance transition when the content changes while shown
    this.card.classList.remove('show');
    void this.card.offsetWidth;
    this.card.classList.add('show');
  }
}
