import type { TimeSystem } from '../core/TimeSystem';
import type { TourPlayer } from '../core/TourPlayer';
import type { SkyEvent } from '../data/events';
import { _ } from '../i18n';
import { beacon, openFromEmbedUrl } from '../app/share';
import { fmtEventDate } from './EventPanel';

function $<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element #${id}`);
  return el as T;
}

function fmtRate(r: number): string {
  if (r < 60) return `${Math.round(r)}×`;
  if (r < 3600) return `${(r / 60).toFixed(r < 600 ? 1 : 0).replace(/\.0$/, '')} ${_('dk/s')}`;
  if (r < 86400) return `${(r / 3600).toFixed(r < 36000 ? 1 : 0).replace(/\.0$/, '')} ${_('sa/s')}`;
  if (r < 86400 * 365) return `${(r / 86400).toFixed(r < 864000 ? 1 : 0).replace(/\.0$/, '')} ${_('gün/s')}`;
  return `${(r / (86400 * 365.25)).toFixed(1)} ${_('yıl/s')}`;
}

export interface EmbedHost {
  time: TimeSystem;
  tours: TourPlayer;
  /** replay the current event scene */
  replayEvent(): void;
}

/**
 * The minimal chrome of the iframe view (?embed=1): one-line title + date top-left, play/pause,
 * rate and sound controls bottom-left, "Open in Your Eyes In Space ↗" bottom-right.
 */
export class EmbedUI {
  private readonly root = $('embed-ui');
  private readonly play = $<HTMLButtonElement>('embed-play');
  private readonly rate = $('embed-rate');
  private readonly mute = $<HTMLButtonElement>('embed-mute');
  private readonly open = $<HTMLAnchorElement>('embed-open');
  private event: SkyEvent | null = null;
  private lastRate = '';
  private lastPaused: boolean | null = null;

  constructor(private readonly host: EmbedHost) {
    document.body.classList.add('embed');
    this.root.hidden = false;
    this.play.addEventListener('click', () => {
      // one control for both the narration and the clock
      if (host.tours.active) host.tours.togglePause();
      else host.time.togglePause();
    });
    $('embed-slower').addEventListener('click', () => host.time.slower());
    $('embed-faster').addEventListener('click', () => host.time.faster());
    $('embed-replay').addEventListener('click', () => host.replayEvent());
    this.mute.addEventListener('click', () => {
      host.tours.muted = !host.tours.muted;
      this.renderMute();
    });
    this.open.addEventListener('click', () => beacon('open_click', this.event?.id ?? '', true));
    this.renderMute();
    this.setEvent(null);
  }

  setEvent(e: SkyEvent | null): void {
    this.event = e;
    $('embed-head-title').textContent = e ? _(e.title) : 'Your Eyes In Space';
    $('embed-head-date').textContent = e ? fmtEventDate(e) : '';
    this.open.href = openFromEmbedUrl(e);
    this.open.title = _('Tam uygulamada aç (yeni sekme)');
    $<HTMLButtonElement>('embed-replay').hidden = !e;
  }

  private renderMute(): void {
    const m = this.host.tours.muted;
    this.mute.textContent = m ? '🔇' : '🔊';
    this.mute.title = m ? _('Anlatım sesini aç') : _('Anlatım sesini kapat');
  }

  /** Call once per frame */
  update(): void {
    const t = this.host.time;
    const paused = this.host.tours.active ? this.host.tours.state.paused : t.paused;
    if (paused !== this.lastPaused) {
      this.lastPaused = paused;
      this.play.textContent = paused ? '▶\uFE0E' : '❚❚';
    }
    const r = t.paused ? _('duraklatıldı') : `${t.effectiveRate < 0 ? '−' : ''}${fmtRate(t.rate)}`;
    if (r !== this.lastRate) { this.lastRate = r; this.rate.textContent = r; }
  }
}
