import type { Universe, StarId } from './Universe';
import type { CameraController } from '../camera/CameraController';
import type { TimeSystem } from './TimeSystem';
import { TOURS, type TourDef, type TourStep, type TourTarget } from '../data/tours';
import { _, currentLocale } from '../i18n';

/** Navigation the player needs from the app (a subset of UIHost) */
export interface TourHost {
  universe: Universe;
  camera: CameraController;
  time: TimeSystem;
  goToBodyId(id: string): void;
  goToStar(id: StarId): void;
  goToGalaxy(i: number): void;
  goToLandmark(i: number): void;
  goToBlackHole(id: string): void;
}

/** Per-step timing produced by scripts/tts-tours.mjs */
interface StepTiming {
  /** hash of the narrated text — doubles as the cache-buster of the clip */
  hash?: string;
  duration: number;
  sentences: { start: number; end: number; text: string }[];
}
interface TourManifest {
  steps: Record<string, StepTiming>;
}

export type TourPhase = 'idle' | 'flying' | 'dwell';

export interface TourState {
  tour: TourDef | null;
  stepIndex: number;
  phase: TourPhase;
  paused: boolean;
  /** 0..1 within the current step's narration */
  progress: number;
  subtitle: string;
  /** true when no audio is available for this locale and English (text-only tour) */
  silent: boolean;
}

/** Reading speed used when no audio file exists (characters per second) */
const SILENT_CPS = 14;
const DEFAULT_DWELL = 1.5;
const DEFAULT_ORBIT = 0.05;

/**
 * Plays a guided tour: for each step it starts the flight and the narration at the same moment,
 * shows the sentence being spoken as a subtitle, lets the camera drift slowly around the target
 * once it has arrived, and only moves on when the voice has finished *and* the camera is there.
 */
export class TourPlayer {
  readonly state: TourState = { tour: null, stepIndex: -1, phase: 'idle', paused: false, progress: 0, subtitle: '', silent: false };
  onChange: ((s: TourState) => void) | null = null;

  private readonly audio = new Audio();
  private manifest: TourManifest | null = null;
  private audioLocale: string = currentLocale();
  /** resolves once we know which locale has audio for the running tour (and its manifest) */
  private ready: Promise<void> = Promise.resolve();
  /** seconds since the narration (or its silent stand-in) finished; −1 while still playing */
  private sinceEnd = -1;
  private elapsed = 0;
  private audioEnded = false;
  private audioFailed = false;
  private savedRate = 1;
  private savedPaused = false;
  private token = 0;
  /** the flight we started for the current step — a different one means the user navigated away */
  private flight: object | null = null;
  /** set when the player stops itself (user navigated elsewhere / tour finished) */
  onEnd: ((reason: 'finished' | 'interrupted') => void) | null = null;

  constructor(private readonly host: TourHost) {
    this.audio.preload = 'auto';
    this.audio.addEventListener('ended', () => { this.audioEnded = true; });
    this.audio.addEventListener('error', () => { this.audioFailed = true; });
    if (import.meta.env.DEV) (window as unknown as { __tourAudio: HTMLAudioElement }).__tourAudio = this.audio;
  }

  get active(): boolean {
    return this.state.tour !== null;
  }

  get step(): TourStep | null {
    const t = this.state.tour;
    return t ? t.steps[this.state.stepIndex] ?? null : null;
  }

  /** Narration text of the current step in the UI language */
  get stepText(): string {
    const s = this.step;
    return s ? _(s.text) : '';
  }

  /** Tours whose every destination exists in this build */
  available(): TourDef[] {
    return TOURS.filter((t) => t.steps.every((s) => this.resolvable(s.target)));
  }

  start(tourId: string): void {
    const tour = TOURS.find((t) => t.id === tourId);
    if (!tour) return;
    if (this.active) this.teardown();
    const time = this.host.time;
    this.savedRate = time.rate;
    this.savedPaused = time.paused;
    this.state.tour = tour;
    this.state.silent = false;
    this.state.paused = false;
    this.manifest = null;
    this.ready = this.resolveAudio(tour);
    this.playStep(0);
  }

  stop(): void {
    if (!this.active) return;
    this.teardown();
    this.emit();
  }

  togglePause(): void {
    if (!this.active) return;
    this.state.paused = !this.state.paused;
    if (this.state.paused) this.audio.pause();
    else if (!this.audioEnded && !this.audioFailed && this.audio.src) void this.audio.play().catch(() => { this.audioFailed = true; });
    this.emit();
  }

  next(): void {
    const t = this.state.tour;
    if (!t) return;
    if (this.state.stepIndex + 1 >= t.steps.length) {
      this.stop();
      this.onEnd?.('finished');
    } else this.playStep(this.state.stepIndex + 1);
  }

  prev(): void {
    if (!this.active) return;
    // restart the current step if we are more than a few seconds in, else go back one
    const back = this.elapsed > 4 || this.state.stepIndex === 0 ? this.state.stepIndex : this.state.stepIndex - 1;
    this.playStep(back);
  }

  /** Call once per frame */
  update(dt: number): void {
    const step = this.step;
    if (!step || this.state.paused) return;
    const cam = this.host.camera;
    // the user asked for another destination → hand the controls back
    if (cam.autopilot && cam.autopilot !== this.flight) {
      this.stop();
      this.onEnd?.('interrupted');
      return;
    }
    this.elapsed += dt;
    const s = this.state;
    const timing = this.timing(step);
    const duration = timing?.duration ?? this.silentDuration(step);

    // narration progress & subtitle
    const useAudio = !this.audioFailed && this.audio.src !== '';
    const t = useAudio ? this.audio.currentTime : this.elapsed;
    s.progress = duration > 0 ? Math.min(1, t / duration) : 1;
    if (timing && timing.sentences.length) {
      const cur = timing.sentences.find((x) => t >= x.start && t < x.end) ?? (t >= duration ? timing.sentences[timing.sentences.length - 1] : timing.sentences[0]);
      s.subtitle = cur.text;
    } else {
      s.subtitle = _(step.text);
    }

    const narrationDone = useAudio ? this.audioEnded : this.elapsed >= duration;
    if (narrationDone) {
      this.sinceEnd = this.sinceEnd < 0 ? 0 : this.sinceEnd + dt;
    }
    const arrived = cam.autopilot === null;
    if (s.phase === 'flying' && arrived) s.phase = 'dwell';
    if (arrived) cam.autoOrbit = step.orbitRate ?? DEFAULT_ORBIT;

    if (narrationDone && arrived && this.sinceEnd >= (step.dwell ?? DEFAULT_DWELL)) this.next();
    else this.emit();
  }

  /* ---------------------------------------------------------------- */

  private playStep(i: number): void {
    const tour = this.state.tour!;
    const step = tour.steps[i];
    const myToken = ++this.token;
    this.state.stepIndex = i;
    this.state.phase = 'flying';
    this.state.progress = 0;
    this.state.subtitle = _(step.text);
    this.elapsed = 0;
    this.sinceEnd = -1;
    this.audioEnded = false;
    this.audioFailed = false;
    this.host.camera.autoOrbit = 0;
    this.host.time.setRate(step.timeRate ?? 1);
    this.navigate(step.target);
    this.flight = this.host.camera.autopilot;

    // Start the narration right away (same user gesture for the first step) — the manifest is
    // only needed for subtitles and can arrive later.
    this.audio.pause();
    void this.ready.then(() => {
      if (myToken !== this.token) return;
      if (this.state.silent) { this.audioFailed = true; return; }
      this.audio.src = this.audioUrl(this.audioLocale, tour.id, step.id, this.timing(step)?.hash);
      this.audio.currentTime = 0;
      void this.audio.play().catch(() => { if (myToken === this.token) this.audioFailed = true; });
    });
    this.emit();
  }

  private teardown(): void {
    this.token++;
    this.audio.pause();
    this.audio.removeAttribute('src');
    this.audio.load();
    const time = this.host.time;
    time.setRate(this.savedRate);
    if (this.savedPaused) time.togglePause();
    this.host.camera.autoOrbit = 0;
    this.flight = null;
    this.state.tour = null;
    this.state.stepIndex = -1;
    this.state.phase = 'idle';
    this.state.progress = 0;
    this.state.subtitle = '';
    this.state.paused = false;
  }

  private emit(): void {
    this.onChange?.(this.state);
  }

  private timing(step: TourStep): StepTiming | null {
    return this.manifest?.steps[step.id] ?? null;
  }

  private silentDuration(step: TourStep): number {
    return Math.max(4, _(step.text).length / SILENT_CPS);
  }

  private audioUrl(locale: string, tourId: string, stepId: string, version?: string): string {
    return `${import.meta.env.BASE_URL}tours/${locale}/${tourId}/${stepId}.mp3${version ? `?v=${version}` : ''}`;
  }

  private manifestUrl(locale: string, tourId: string): string {
    return `${import.meta.env.BASE_URL}tours/${locale}/${tourId}.json`;
  }

  /**
   * Use the UI language when it has audio, otherwise fall back to English (subtitles stay in the
   * UI language). A locale "has audio" when its manifest exists; the manifest also gives us the
   * sentence timings for the subtitles.
   */
  private async resolveAudio(tour: TourDef): Promise<void> {
    const want = currentLocale();
    for (const loc of want === 'en' ? ['en'] : [want, 'en']) {
      try {
        const r = await fetch(this.manifestUrl(loc, tour.id));
        if (!r.ok || !(r.headers.get('content-type') ?? '').includes('json')) continue;
        const m = (await r.json()) as TourManifest;
        if (this.state.tour !== tour) return;
        this.manifest = m;
        this.audioLocale = loc;
        return;
      } catch { /* offline / missing */ }
    }
    if (this.state.tour === tour) this.state.silent = true;
  }

  private resolvable(t: TourTarget): boolean {
    const u = this.host.universe;
    switch (t.kind) {
      case 'body': return u.current.catalogIndex === 0 ? !!u.get(t.ref) : true;
      case 'star': return u.catalog.search(t.ref, 1).length > 0;
      case 'blackhole': return !!u.blackHole(t.ref);
      case 'landmark': return !!u.landmark(t.ref);
      case 'galaxy': return this.resolveGalaxy(t.ref) !== null;
    }
  }

  private resolveGalaxy(ref: string): number | null {
    if (ref.startsWith('#')) return parseInt(ref.slice(1), 10);
    const g = this.host.universe.galaxies;
    for (let i = 1; i < g.catalogCount; i++) if (g.rawName(i).includes(ref)) return i;
    return null;
  }

  private navigate(t: TourTarget): void {
    const h = this.host;
    const u = h.universe;
    switch (t.kind) {
      case 'body': h.goToBodyId(t.ref); break;
      case 'blackhole': h.goToBlackHole(t.ref); break;
      case 'landmark': {
        const l = u.landmark(t.ref);
        if (l) h.goToLandmark(u.landmarks.indexOf(l));
        break;
      }
      case 'star': {
        const hits = u.catalog.search(t.ref, 1);
        if (hits.length) h.goToStar(`c${hits[0]}`);
        break;
      }
      case 'galaxy': {
        const gi = this.resolveGalaxy(t.ref);
        if (gi !== null) h.goToGalaxy(gi);
        break;
      }
    }
  }
}
