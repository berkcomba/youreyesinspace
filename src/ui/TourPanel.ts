import type { TourPlayer, TourState } from '../core/TourPlayer';
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
  private lastSubtitle = '';
  private lastStep = -1;
  private lastPaused = false;

  constructor(private readonly player: TourPlayer, private readonly onToggle: (show: boolean) => void) {
    this.build();
    $('tours-close').addEventListener('click', () => this.toggle(false));
    $('tour-prev').addEventListener('click', () => player.prev());
    $('tour-next').addEventListener('click', () => player.next());
    $('tour-stop').addEventListener('click', () => player.stop());
    this.pauseBtn.addEventListener('click', () => player.togglePause());
    player.onChange = (s) => this.render(s);
  }

  toggle(show: boolean): void {
    this.panel.hidden = !show;
    this.btn.classList.toggle('active', show);
    this.onToggle(show);
  }

  private build(): void {
    this.list.innerHTML = '';
    for (const tour of this.player.available()) {
      const el = document.createElement('button');
      el.className = 'tour-item';
      el.dataset.tour = tour.id;
      el.innerHTML = `<span class="tour-icon">${tour.icon}</span><span class="tour-text"><span class="tour-name">${_(tour.title)}</span><span class="tour-summary">${_(tour.summary)}</span><span class="tour-meta">${_('{n} durak', { n: tour.steps.length })}</span></span>`;
      el.addEventListener('click', () => {
        this.player.start(tour.id);
        this.toggle(false);
      });
      this.list.appendChild(el);
    }
  }

  private render(s: TourState): void {
    if (!s.tour) {
      if (!this.bar.hidden) this.bar.hidden = true;
      this.lastStep = -1;
      this.lastSubtitle = '';
      return;
    }
    if (this.bar.hidden) this.bar.hidden = false;
    if (this.lastStep !== s.stepIndex) {
      this.lastStep = s.stepIndex;
      this.title.textContent = `${s.tour.icon} ${_(s.tour.title)}`;
      this.stepLabel.textContent = `${s.stepIndex + 1} / ${s.tour.steps.length}`;
      this.bar.classList.toggle('silent', s.silent);
      this.bar.title = s.silent ? _('Bu dil için ses bulunamadı; tur altyazıyla ilerliyor') : '';
    }
    if (this.lastSubtitle !== s.subtitle) {
      this.lastSubtitle = s.subtitle;
      this.subtitle.textContent = s.subtitle;
    }
    if (this.lastPaused !== s.paused) {
      this.lastPaused = s.paused;
      this.pauseBtn.textContent = s.paused ? '▶' : '❚❚';
      this.bar.classList.toggle('paused', s.paused);
    }
    this.fill.style.width = `${(s.progress * 100).toFixed(1)}%`;
  }
}
