/**
 * The radio under the settings button: a small record that turns while a song plays; opened, it
 * shows the song, pause / next and the volume. Present only while the radio setting is on (and
 * there is a library). During a tour the record keeps turning for the tour's music — the volume
 * applies to it as well — but "next" is for the radio alone.
 */
import type { Music } from '../audio/Music';

export interface RadioHost {
  music: Music;
  settings: { radio: boolean; musicVolume: number };
  /** save the settings (volume) */
  applySettings(): void;
}

const $ = <T extends HTMLElement = HTMLElement>(id: string): T => document.getElementById(id) as T;

export class RadioWidget {
  private readonly root = $('radio');
  private readonly disc = $<HTMLButtonElement>('radio-disc');
  private readonly title = $('radio-title');
  private readonly artist = $('radio-artist');
  private readonly vol = $<HTMLInputElement>('radio-vol');

  constructor(private readonly host: RadioHost) {
    this.disc.addEventListener('click', () => this.open(this.root.classList.contains('open') ? false : true));
    $('radio-play').addEventListener('click', () => host.music.hold(!host.music.held));
    $('radio-next').addEventListener('click', () => host.music.next());
    this.vol.addEventListener('input', () => {
      const v = Number(this.vol.value);
      host.music.volume = v;
      host.settings.musicVolume = v;
      this.paintVolume();
    });
    this.vol.addEventListener('change', () => host.applySettings());
    host.music.onChange(() => this.sync());
    this.sync();
  }

  open(v: boolean): void {
    this.root.classList.toggle('open', v);
    this.disc.setAttribute('aria-expanded', String(v));
  }

  /** settings or playback changed */
  sync(): void {
    const m = this.host.music;
    const show = this.host.settings.radio && m.available;
    this.root.hidden = !show;
    if (!show) { this.open(false); return; }
    const t = m.track;
    this.title.textContent = t?.title ?? '';
    this.artist.textContent = t?.artist ?? '';
    this.root.classList.toggle('playing', m.playing && !(m.onAir && m.held));
    this.root.classList.toggle('on-air', m.onAir);
    if (document.activeElement !== this.vol) this.vol.value = String(m.volume);
    this.paintVolume();
  }

  private paintVolume(): void {
    this.vol.style.setProperty('--fill', `${Math.round(Number(this.vol.value) * 100)}%`);
  }
}
