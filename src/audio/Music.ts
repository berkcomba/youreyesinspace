/**
 * Background music for the guided tours and the first-visit welcome.
 *
 * The library is `public/music/music.json` (written by `scripts/build-music.mjs` from the files in
 * `public/music/`). Each scene — a tour, an event, the welcome — asks for a track by key; a tour
 * may name one (`TourDef.music`), otherwise keys are dealt tracks in turn so neighbouring tours
 * get different songs. Playback runs through Web Audio: while the narrator speaks the music
 * ducks — gain down and a low-pass filter closing, as a radio mix would — and opens up again in
 * the pauses. Without Web Audio (or when the element cannot be routed) the gain alone is used.
 *
 * Browsers refuse sound before a user gesture; a refused start is retried on the next pointer or
 * key event, so a welcome that opens on page load begins playing at the first click.
 */
import { loadSettings } from '../ui/Settings';

export interface MusicTrack {
  /** file under public/music/ */
  file: string;
  title: string;
  artist?: string;
  /** licence line shown in the credits (e.g. "CC BY 4.0") */
  license?: string;
  url?: string;
  /** scene keys this track is reserved for (e.g. a song with lyrics: welcome only, never under a narrated tour) */
  scenes?: string[];
}

interface Library { tracks: MusicTrack[] }

/** music level under silence and under speech at full volume (linear gain); the volume setting scales both */
const LEVEL = 0.5;
const DUCKED = 0.13;
/** default of the volume setting: the level the mix was tuned at */
export const DEFAULT_MUSIC_VOLUME = 0.64;
/** low-pass corner while ducked / open (Hz) */
const MUFFLED_HZ = 900;
const OPEN_HZ = 20000;
/** seconds: duck fast so the first word is clear, open slowly so it is not noticed */
const DUCK_S = 0.35;
const OPEN_S = 1.6;
const FADE_IN_S = 2.5;
const FADE_OUT_S = 1.2;
/** scene key of the radio: the whole library shuffled, outside the tours and the welcome */
const RADIO_KEY = 'radio';
/** events that count as a user gesture for sound (touchend and click for Safari) */
const GESTURES = ['pointerdown', 'touchend', 'click', 'keydown'] as const;

export class Music {
  private readonly el = new Audio();
  private tracks: MusicTrack[] = [];
  private keys: string[] = [];
  private ctx: AudioContext | null = null;
  private gain: GainNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private current: MusicTrack | null = null;
  private key: string | null = null;
  private preferred: string | undefined;
  private speaking = false;
  private fadeTimer = 0;
  private waitingForGesture = false;
  private disarm: () => void = () => {};
  private on = true;
  private radioOn = false;
  /** shuffled deck of the radio (track indices still to play) */
  private deck: number[] = [];
  private radioTrack: MusicTrack | null = null;
  private vol = DEFAULT_MUSIC_VOLUME;
  /** the listener paused the radio by hand (it stays quiet until resumed) */
  private hand = false;
  private readonly listeners: Array<() => void> = [];
  /** a track has actually started sounding (the credit line) */
  onStart: ((track: MusicTrack) => void) | null = null;

  constructor(private readonly baseUrl: string) {
    this.el.loop = true;
    this.el.preload = 'none';
    this.el.crossOrigin = 'anonymous';
    const s = loadSettings();
    this.on = s.music;
    this.radioOn = s.radio;
    this.vol = s.musicVolume;
    // radio: the next song when one ends (scenes loop their own track)
    this.el.addEventListener('ended', () => { if (this.key === RADIO_KEY && this.radioOn && this.on) this.playRadio(); });
  }

  /** Hear about on/off, library and track changes (buttons refresh their look) */
  onChange(fn: () => void): void {
    this.listeners.push(fn);
  }

  private changed(): void {
    for (const fn of this.listeners) fn();
  }

  /** The library (empty when there is no music.json: everything then stays silent) */
  async load(): Promise<void> {
    try {
      const r = await fetch(`${this.baseUrl}music/music.json?v=${__BUILD_ID__}`);
      if (!r.ok) return;
      const lib = (await r.json()) as Library;
      this.tracks = Array.isArray(lib.tracks) ? lib.tracks.filter((t) => t && typeof t.file === 'string') : [];
      // a scene asked for music before the library arrived
      if (this.key && !this.current) this.play(this.key, this.preferred);
      else if (!this.key && this.radioOn) this.playRadio();
      this.changed();
    } catch { /* offline: no music */ }
  }

  /** Scene keys in the order tracks are dealt to them (tour ids after 'welcome') */
  setKeys(keys: string[]): void {
    this.keys = keys;
  }

  get available(): boolean { return this.tracks.length > 0; }
  get enabled(): boolean { return this.on; }
  /** the radio (not a scene) is what plays, or would play */
  get onAir(): boolean { return this.key === RADIO_KEY; }
  /** radio paused by hand */
  get held(): boolean { return this.hand; }
  get volume(): number { return this.vol; }
  /** 0…1 (saved by the caller); applies at once to whatever plays */
  set volume(v: number) {
    this.vol = Math.min(1, Math.max(0, v));
    if (this.current && !this.hand) this.setGain((this.speaking ? DUCKED : LEVEL) * this.vol, 0.08);
  }
  get radio(): boolean { return this.radioOn; }
  /** the radio plays whenever no scene has music of its own (saved by the caller) */
  set radio(v: boolean) {
    if (this.radioOn === v) return;
    this.radioOn = v;
    if (v) { this.hand = false; if (!this.key && this.on) this.playRadio(); }
    else if (this.key === RADIO_KEY) { this.key = null; this.silence(); }
  }

  /** Radio: pause / resume by hand (a scene's music is not affected) */
  hold(v: boolean): void {
    if (this.hand === v) return;
    this.hand = v;
    if (!this.onAir) { this.changed(); return; }
    if (v) {
      this.setGain(0, 0.3);
      window.clearTimeout(this.fadeTimer);
      this.fadeTimer = window.setTimeout(() => { if (this.hand) this.el.pause(); }, 350);
    } else if (this.current) {
      void this.el.play().then(() => this.setGain((this.speaking ? DUCKED : LEVEL) * this.vol, 0.6)).catch(() => this.armGesture());
    } else this.playRadio();
    this.changed();
  }

  /** Radio: skip to the next song */
  next(): void {
    if (!this.radioOn || !this.on) return;
    this.hand = false;
    this.key = null;
    this.playRadio();
  }
  /** what is playing (for the credits line) */
  get track(): MusicTrack | null { return this.current; }
  get playing(): boolean { return this.current !== null && !this.el.paused; }

  /** Switch on / off (the setting is saved by the caller) */
  set enabled(v: boolean) {
    if (this.on === v) return;
    this.on = v;
    if (!v) this.silence();
    else if (this.key) this.play(this.key, this.preferred);
    else if (this.radioOn) this.playRadio();
    this.changed();
  }

  /**
   * The track for a scene key: its preferred file if the library has it, else a track reserved for
   * the scene (`scenes`), else dealt by position from the unreserved tracks
   */
  trackFor(key: string, preferred?: string): MusicTrack | null {
    if (!this.tracks.length) return null;
    if (preferred) {
      const t = this.tracks.find((x) => x.file === preferred);
      if (t) return t;
    }
    const reserved = this.tracks.filter((x) => x.scenes?.includes(key));
    if (reserved.length) return reserved[0];
    const pool = this.tracks.filter((x) => !x.scenes?.length);
    if (!pool.length) return null;
    let i = this.keys.indexOf(key);
    if (i < 0) i = this.keys.length + Math.abs(hash(key));
    return pool[i % pool.length];
  }

  /** Start the music of a scene (fades in; a track already playing for another key crossfades) */
  play(key: string, preferred?: string): void {
    this.key = key;
    this.preferred = preferred;
    if (!this.on) return;
    const t = key === RADIO_KEY ? (this.radioTrack ??= this.nextRadioTrack()) : this.trackFor(key, preferred);
    if (!t) return;
    // scenes loop their track; the radio moves on at the end of a song
    this.el.loop = key !== RADIO_KEY;
    // the same song already sounding (the radio had it on): just carry on under the new key
    if (t === this.current && !this.el.paused) { this.changed(); return; }
    this.current = t;
    window.clearTimeout(this.fadeTimer);
    this.route();
    // inside a user gesture this unlocks a context created without one (Safari insists on a
    // synchronous call from the handler)
    if (this.ctx && this.ctx.state !== 'running') void this.ctx.resume();
    this.el.src = `${this.baseUrl}music/${encodeURIComponent(t.file)}`;
    this.el.currentTime = 0;
    this.setGain(0, 0);
    this.el.play().then(() => this.sounding(t)).catch(() => this.armGesture());
  }

  /**
   * The element plays; the music is audible once the context runs too. Without a user gesture a
   * browser may let the element play yet keep the context suspended — silence, and the next
   * gesture has to unlock it.
   */
  private sounding(t: MusicTrack): void {
    const ready = (): void => {
      if (this.current !== t) return;
      this.waitingForGesture = false;
      this.setGain((this.speaking ? DUCKED : LEVEL) * this.vol, FADE_IN_S);
      this.setFilter(this.speaking ? MUFFLED_HZ : OPEN_HZ, 0);
      this.changed();
      this.onStart?.(t);
    };
    const ctx = this.ctx;
    if (!ctx || ctx.state === 'running') { ready(); return; }
    void ctx.resume().then(() => { if (ctx.state === 'running') ready(); });
    window.setTimeout(() => { if (ctx.state !== 'running' && this.current === t) this.armGesture(); }, 250);
  }

  /** Stop at the end of a scene (fades out; the radio, when on, takes over) */
  stop(): void {
    this.key = null;
    this.preferred = undefined;
    if (this.radioOn && this.on && !this.hand && this.tracks.length) { this.playRadio(); return; }
    this.silence();
  }

  /** Next song of the radio (the current one, if a scene interrupted it, counts as played) */
  private playRadio(): void {
    this.radioTrack = this.nextRadioTrack();
    if (this.hand) { this.key = RADIO_KEY; this.changed(); return; }
    this.play(RADIO_KEY);
  }

  /** Deal from a shuffled deck; reshuffle when it runs out, never the same song twice in a row */
  private nextRadioTrack(): MusicTrack | null {
    if (!this.tracks.length) return null;
    if (!this.deck.length) {
      const d = this.tracks.map((_, i) => i);
      for (let i = d.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [d[i], d[j]] = [d[j], d[i]]; }
      const last = this.current ?? this.radioTrack;
      if (d.length > 1 && last && this.tracks[d[0]] === last) d.push(d.shift()!);
      this.deck = d;
    }
    return this.tracks[this.deck.shift()!];
  }

  /** The narrator speaks (duck) or has stopped (open up) */
  duck(speaking: boolean): void {
    if (this.speaking === speaking) return;
    this.speaking = speaking;
    if (!this.current || (this.hand && this.onAir)) return;
    this.setGain((speaking ? DUCKED : LEVEL) * this.vol, speaking ? DUCK_S : OPEN_S);
    this.setFilter(speaking ? MUFFLED_HZ : OPEN_HZ, speaking ? DUCK_S : OPEN_S);
  }

  private silence(): void {
    if (!this.current) return;
    const t = this.current;
    this.current = null;
    this.setGain(0, FADE_OUT_S);
    window.clearTimeout(this.fadeTimer);
    this.fadeTimer = window.setTimeout(() => {
      if (this.current === null || this.current === t) { this.el.pause(); this.el.removeAttribute('src'); this.el.load(); }
    }, FADE_OUT_S * 1000 + 50);
    this.changed();
  }

  /** music is on and a scene asked for it, but the browser waits for a gesture */
  get pending(): boolean { return this.on && this.waitingForGesture; }

  /** Autoplay was refused: start at the first gesture */
  private armGesture(): void {
    if (this.waitingForGesture) return;
    this.waitingForGesture = true;
    const retry = (e: Event): void => {
      // a music button's own click handler starts it (otherwise the press would start and the
      // click, a moment later, switch it off)
      if ((e.target as Element | null)?.closest?.('[data-music-toggle]')) return;
      this.kick();
    };
    this.disarm = (): void => { for (const ev of GESTURES) window.removeEventListener(ev, retry, true); this.disarm = () => {}; };
    for (const ev of GESTURES) window.addEventListener(ev, retry, true);
    this.changed();
  }

  /** Start (or unlock) now — to be called from within a user gesture */
  kick(): void {
    this.disarm();
    this.waitingForGesture = false;
    if (this.ctx && this.ctx.state !== 'running') void this.ctx.resume();
    if (!this.key || !this.on) return;
    if (this.current && !this.el.paused) this.sounding(this.current);
    else { this.current = null; this.play(this.key, this.preferred); }
  }

  /** Element → low-pass → gain → speakers (once) */
  private route(): void {
    if (this.ctx || typeof AudioContext === 'undefined') return;
    try {
      const ctx = new AudioContext();
      const src = ctx.createMediaElementSource(this.el);
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = OPEN_HZ;
      filter.Q.value = 0.5;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      src.connect(filter).connect(gain).connect(ctx.destination);
      this.ctx = ctx; this.gain = gain; this.filter = filter;
    } catch { this.ctx = null; }
  }

  private setGain(v: number, seconds: number): void {
    if (this.gain && this.ctx) {
      const g = this.gain.gain, now = this.ctx.currentTime;
      g.cancelScheduledValues(now);
      g.setValueAtTime(g.value, now);
      if (seconds <= 0) g.setValueAtTime(v, now);
      else g.setTargetAtTime(v, now, seconds / 3); // ~95 % of the way in `seconds`
    } else {
      this.el.volume = v;
    }
  }

  private setFilter(hz: number, seconds: number): void {
    if (!this.filter || !this.ctx) return;
    const f = this.filter.frequency, now = this.ctx.currentTime;
    f.cancelScheduledValues(now);
    f.setValueAtTime(f.value, now);
    if (seconds <= 0) f.setValueAtTime(hz, now);
    else f.exponentialRampToValueAtTime(hz, now + seconds);
  }
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}
