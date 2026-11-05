import type { Universe, StarId } from './Universe';
import type { CameraController } from '../camera/CameraController';
import type { TimeSystem } from './TimeSystem';
import { TOURS, type TourCue, type TourDef, type TourStep, type TourTarget } from '../data/tours';
import { _, currentLocale } from '../i18n';
import { DAY_S } from './constants';
import { exoBodyId } from '../gen/RealSystem';

/** Render settings a tour may force while it plays (undefined = the user's own setting) */
export interface TourOverrides {
  clouds?: boolean;
  orbits?: boolean;
  moonOrbits?: boolean;
  eclipticGrid?: boolean;
  equatorialGrid?: boolean;
  /** field of view, degrees */
  fov?: number;
  /** tone-mapping exposure (the welcome shows every first visit the same picture) */
  exposure?: number;
  /** false: no night-side work light even when close */
  fill?: boolean;
}

/** A live figure shown in the corner card (see the `readout` cue) */
export type ReadoutKind = 'distance' | 'altitude' | 'separation' | 'light';

/** A labelled surface feature the overlay points at during a tour */
export interface SurfacePin {
  bodyId: string;
  lat: number;
  lon: number;
  label: string;
  /** follow the gas giant's rendered storm instead of fixed coordinates */
  storm?: boolean;
  /** outline the feature: a ring of this radius (km) traced on the surface */
  extent?: number;
}

/** Navigation the player needs from the app (a subset of UIHost) */
export interface TourHost {
  universe: Universe;
  camera: CameraController;
  time: TimeSystem;
  goToBodyId(id: string): void;
  /** tour step arrival: worlds framed with their sun in the sky behind them (`starId`: the system the body lives in) */
  goToTourBody(id: string, starId?: StarId): void;
  goToStar(id: StarId): void;
  goToGalaxy(i: number): void;
  goToLandmark(i: number): void;
  goToBlackHole(id: string): void;
  /** camera above a body's orbit around its parent, whole orbit in view (`seconds`: flight time) */
  goToOverview(bodyId: string, seconds?: number): void;
  /** quick hop back to a body after an overview/pin */
  returnTo(bodyId: string): void;
  /** camera close above a point of a body's surface */
  goToSurface(bodyId: string, lat: number, lon: number, storm?: boolean): void;
  /** camera at `elev`° above the equator plane, `az`° around the pole from the noon side, `dist` radii */
  goToVantageOf(bodyId: string, elev: number, az: number, dist: number, seconds?: number, inside?: boolean): void;
  /** over the shoulder of a ringed planet, aimed along its rings (see the `limb` cue) */
  goToLimb(bodyId: string, elev: number, az: number, dist: number, aimR: number, aimAz: number, seconds?: number): void;
  /** over-the-shoulder: `dist` radii from `refId` on the side away from `towardId`, swung `az`/`elev`° off that axis */
  goToShot(refId: string, towardId: string, dist: number, az: number, elev: number, seconds?: number): void;
  /** true-scale copy of `refId` beside `besideId` (null removes it); `shoulder`: seen over the copy's shoulder */
  setComparison(refId: string | null, besideId?: string, shoulder?: boolean): void;
  /** raise a shield volcano's relief on a body and glide down to a telephoto view of it (null: lower it again) */
  setPostcard(p: Omit<Extract<TourCue, { action: 'postcard' }>, 'at' | 'action' | 'delay'> | null): void;
  /** light pulse travelling between two bodies (null stops it) */
  setPulse(p: { from: string; to: string; seconds: number } | null): void;
  /** meteor shower over a body (null stops it); with `approach` the camera flies to the viewing spot */
  setMeteors(m: { ref: string; ra: number; dec: number; speed: number; rate: number; fireballs?: number; approach?: boolean; seconds?: number } | null): void;
  setTourOverrides(o: TourOverrides): void;
  /** bodies whose tags stay on while the step plays (null: every tag again, tour over) */
  setTourScope(ids: string[] | null): void;
  setSurfacePin(pin: SurfacePin | null): void;
  /** camera `alt` km above `refId` on the side facing the `toward` bodies, aimed at their midpoint (called every frame) */
  lookFrom(refId: string, toward: string[], alt: number): void;
  /**
   * Stand on `refId` where the `toward` bodies hang `elev`° over the horizon, descending over
   * `seconds` (with `sep` the clock first runs to the moment the first of them is that many degrees
   * from the star); already standing there, only the gaze turns to them. See the `land` cue.
   */
  landFor(refId: string, toward: string[], o: { elev: number; sep?: number; starElev?: number; seconds?: number }): void;
  /** on the ground: ease the gaze onto the `toward` bodies (called every frame while a `land` cue holds) */
  aimOnSurface(toward: string[], dt: number): void;
  /** formatted live measurement between two bodies ('' when one is missing) */
  measure(kind: ReadoutKind, a: string, b: string, from?: string): string;
  /** field of view in effect right now (degrees) — start value of eased `fov` cues */
  currentFov(): number;
  /** set the simulation clock and move every body to it at once (flights planned in the same frame start from the new geometry) */
  setClock(d: Date): void;
  /** the slowly circling planetary-system view used when nothing is selected */
  showBackdrop(fly: boolean): void;
}

/** Inset shown in the corner during a step (see the `card` cue) */
export interface TourCard {
  image?: string;
  title?: string;
  big?: string;
  text?: string;
  source?: string;
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
  /** corner inset currently shown (photo / trivia), if any */
  card: TourCard | null;
  /** chapter title / kicker / supporting facts of the current step (source language) */
  title: string;
  kicker: string;
  facts: Array<[string, string]>;
  /** real seconds since the step began (drives the chapter-title and facts animations) */
  stepTime: number;
}

/** Cues that start a camera flight of their own */
const FLIGHT_ACTIONS = new Set<TourCue['action']>(['overview', 'vantage', 'shot', 'pin', 'lookFrom', 'land', 'return', 'postcard', 'limb']);
const isFlightCue = (c: TourCue): boolean => FLIGHT_ACTIONS.has(c.action) && !(c.action === 'pin' && c.approach === false);
/** A flight cue is held until the camera has rested this long after its previous flight… */
const FLIGHT_HOLD_S = 1.4;
/** Length of a clock-rate ramp between `a` and `b` s/s */
const rampSeconds = (a: number, b: number): number =>
  Math.min(4, 1 + 0.6 * Math.abs(Math.log10(Math.max(a, 1e-3) / Math.max(b, 1e-3))));
/** …but never more than this long past its narration time, so picture and voice stay together */
const FLIGHT_HOLD_MAX_S = 3.5;

/** Reading speed used when no audio file exists (characters per second) */
const SILENT_CPS = 14;
const DEFAULT_DWELL = 1.5;
const DEFAULT_ORBIT = 0.05;
const PIN_ORBIT = 0.008;

/** Same sentence splitter as scripts/tts-tours.mjs (keeps punctuation, merges tiny fragments) */
function splitSentences(text: string): string[] {
  const out: string[] = [];
  const re = /[^.!?…]+[.!?…]+(?:["»”']+)?|[^.!?…]+$/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const s = m[0].trim();
    if (s) out.push(s);
  }
  const merged: string[] = [];
  for (const s of out) {
    if (merged.length && (s.length < 12 || /^\d/.test(s))) merged[merged.length - 1] += ' ' + s;
    else merged.push(s);
  }
  return merged;
}

/**
 * Plays a guided tour: for each step it starts the flight and the narration at the same moment,
 * shows the sentence being spoken as a subtitle, lets the camera drift slowly around the target
 * once it has arrived, and only moves on when the voice has finished *and* the camera is there.
 */
export class TourPlayer {
  readonly state: TourState = { tour: null, stepIndex: -1, phase: 'idle', paused: false, progress: 0, subtitle: '', silent: false, card: null, title: '', kicker: '', facts: [], stepTime: 0 };
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
  private savedJd = 0;
  private savedAt = 0;
  private token = 0;
  /** the flight we started for the current step — a different one means the user navigated away */
  private flight: object | null = null;
  /** cues of the current step already fired */
  private fired = new Set<TourCue>();
  private cueTimes = new Map<TourCue, number>();
  private overrides: TourOverrides = {};
  private pinned = false;
  /** narration time at which the current card hides itself (Infinity = end of step) */
  private cardUntil = Infinity;
  /** live measurement feeding the card, if any */
  private readout: Extract<TourCue, { action: 'readout' }> | null = null;
  private readoutText = '';
  /** sky-view lock, if any */
  private look: Extract<TourCue, { action: 'lookFrom' }> | null = null;
  /** `land` cue in effect: the bodies the gaze follows from the ground */
  private stand: string[] | null = null;
  /** cinematic drift while dwelling: auto-orbit (rad/s; null = the step's) and push-in (ln/s) */
  private driftRate: number | null = null;
  private dollyRate = 0;
  /** field of view before a postcard's telephoto lens (eased back by the next flight) */
  private postcardFov: number | null = null;
  /** eased field-of-view change in progress (real seconds) */
  private fovTween: { from: number; to: number; t: number; dur: number } | null = null;
  /** time-warp ramp in progress: the clock rate eases between cues instead of jumping */
  private rateTween: { from: number; to: number; t: number; dur: number } | null = null;
  /** rate the step is heading for (end value of the ramp, or the current rate when none runs) */
  private rateGoal = 1;
  /** set once the step's closing ramp-down has started, so it is not re-planned every frame */
  private windingDown = false;
  /** real seconds the camera has been at rest since its last flight (−1 while flying) */
  private restFor = -1;
  /** narration time at which each held flight cue first became due */
  private dueSince = new Map<TourCue, number>();
  /** set when the player stops itself (user navigated elsewhere / tour finished) */
  onEnd: ((reason: 'finished' | 'interrupted') => void) | null = null;
  /** the narrator starts / stops speaking (background music ducks under the voice) */
  onSpeech: ((speaking: boolean) => void) | null = null;
  /** a tour (or event scene) begins */
  onStart: ((tour: TourDef) => void) | null = null;

  constructor(private readonly host: TourHost) {
    this.audio.preload = 'auto';
    this.audio.addEventListener('ended', () => { this.audioEnded = true; this.onSpeech?.(false); });
    this.audio.addEventListener('error', () => { this.audioFailed = true; this.onSpeech?.(false); });
    this.audio.addEventListener('playing', () => this.onSpeech?.(true));
    this.audio.addEventListener('pause', () => this.onSpeech?.(false));
    if (import.meta.env.DEV) (window as unknown as { __tourAudio: HTMLAudioElement }).__tourAudio = this.audio;
  }

  get active(): boolean {
    return this.state.tour !== null;
  }

  /** narration muted (embed mode starts muted; the subtitles still run) */
  get muted(): boolean {
    return this.audio.muted;
  }
  set muted(m: boolean) {
    this.audio.muted = m;
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
    if (tour) this.startDef(tour);
  }

  /** Play any tour definition (events are single-step tours built at run time). */
  startDef(tour: TourDef): void {
    if (this.active) this.stop();
    const time = this.host.time;
    this.savedRate = time.rate;
    this.savedPaused = time.paused;
    this.savedJd = time.jd;
    this.savedAt = performance.now();
    this.state.tour = tour;
    this.state.silent = false;
    this.state.paused = false;
    this.manifest = null;
    if (tour.startIso) {
      const d = new Date(tour.startIso);
      if (!Number.isNaN(d.getTime())) this.host.setClock(d);
    }
    this.ready = this.resolveAudio(tour);
    this.onStart?.(tour);
    this.playStep(0);
  }

  /** End the tour; `onEnd` always hears about it (the app clears event state, URL and meta there). */
  stop(reason: 'finished' | 'interrupted' = 'interrupted'): void {
    if (!this.active) return;
    this.teardown();
    this.emit();
    this.onEnd?.(reason);
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
    if (this.state.stepIndex + 1 >= t.steps.length) this.stop('finished');
    else this.playStep(this.state.stepIndex + 1);
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
      this.stop('interrupted');
      return;
    }
    this.elapsed += dt;
    const s = this.state;
    s.stepTime += dt;
    const timing = this.timing(step);
    const duration = timing?.duration ?? this.silentDuration(step);
    const flying = cam.autopilot !== null;
    this.restFor = flying ? -1 : this.restFor < 0 ? 0 : this.restFor + dt;

    // narration progress & subtitle
    const useAudio = !this.audioFailed && this.audio.src !== '';
    const t = useAudio ? this.audio.currentTime : this.elapsed;
    s.progress = duration > 0 ? Math.min(1, t / duration) : 1;
    if (timing && timing.sentences.length) {
      const cur = timing.sentences.find((x) => t >= x.start && t < x.end) ?? (t >= duration ? timing.sentences[timing.sentences.length - 1] : timing.sentences[0]);
      s.subtitle = cur.text;
    } else {
      // no audio: page through the sentences at reading speed instead of showing the whole text
      s.subtitle = this.silentSentence(step, t, duration);
    }

    // timed cues (surface pins, overviews, cloud toggles…)
    if (step.cues) {
      for (const cue of step.cues) {
        if (this.fired.has(cue)) continue;
        let at = this.cueTimes.get(cue);
        // times are only final once the manifest is in; until then re-derive each frame
        if (at === undefined) {
          at = this.cueTime(step, cue, timing, duration);
          if (timing) this.cueTimes.set(cue, at);
        }
        if (t < at) continue;
        // a new flight right on the heels of the last one reads as a nervous zoom-in-zoom-out:
        // let the camera settle first (bounded, so the picture never lags the voice for long)
        if (isFlightCue(cue)) {
          const since = this.dueSince.get(cue);
          if (since === undefined) this.dueSince.set(cue, t);
          const late = t - (since ?? t);
          if ((flying || this.restFor < FLIGHT_HOLD_S) && late < FLIGHT_HOLD_MAX_S) continue;
          // an over-the-shoulder shot is composed from where its backdrop stands when it fires:
          // while the clock is still ramping down from a time-lapse, a close binary would carry
          // the backdrop out of frame before the camera arrives, so let the ramp finish first
          if (cue.action === 'shot' && this.rateTween && late < FLIGHT_HOLD_MAX_S) continue;
        }
        this.fired.add(cue);
        this.fire(step, cue, timing, duration);
      }
    }
    if (s.card && t >= this.cardUntil) { s.card = null; this.cardUntil = Infinity; this.readout = null; }
    if (this.readout) {
      const r = this.readout;
      const big = this.host.measure(r.kind, r.a, r.b, r.from);
      if (big !== this.readoutText) {
        this.readoutText = big;
        s.card = { title: r.label, big, text: r.text };
      }
    }
    if (this.look) this.host.lookFrom(this.look.ref, this.look.toward, this.look.alt ?? 300);
    if (this.stand) this.host.aimOnSurface(this.stand, dt);
    if (this.fovTween) {
      const f = this.fovTween;
      f.t += dt;
      const k = Math.min(1, f.t / f.dur);
      const e = k * k * (3 - 2 * k);
      this.overrides = { ...this.overrides, fov: f.from + (f.to - f.from) * e };
      this.host.setTourOverrides(this.overrides);
      if (k >= 1) this.fovTween = null;
    }
    this.updateRate(dt, step, t, duration);

    const narrationDone = useAudio ? this.audioEnded : this.elapsed >= duration;
    if (narrationDone) {
      this.sinceEnd = this.sinceEnd < 0 ? 0 : this.sinceEnd + dt;
    }
    const arrived = cam.autopilot === null;
    if (s.phase === 'flying' && arrived) s.phase = 'dwell';
    // a pinned feature should stay put on screen: barely drift while one is shown
    if (arrived) {
      cam.autoOrbit = this.pinned ? PIN_ORBIT : (this.driftRate ?? step.orbitRate ?? DEFAULT_ORBIT);
      cam.autoDolly = this.pinned ? 0 : this.dollyRate;
    }

    if (narrationDone && arrived && this.sinceEnd >= (step.dwell ?? DEFAULT_DWELL)) this.next();
    else this.emit();
  }

  /* ---------------------------------------------------------------- */

  /**
   * Head for a new clock rate with an ease-in-out ramp (linear in rate, so an orbit visibly
   * starts to roll, gathers speed and settles) instead of a jump. The ramp is longer the
   * further the rate moves — about a second plus 0.6 s per decade, four seconds at most.
   */
  private setRate(to: number): void {
    if (to === this.rateGoal && (this.rateTween || this.host.time.rate === to)) return;
    const from = this.host.time.rate;
    this.rateGoal = to;
    if (from === to) { this.rateTween = null; return; }
    this.rateTween = { from, to, t: 0, dur: rampSeconds(from, to) };
  }

  /** Advance the rate ramp; near the end of a step, glide back to the next step's base rate. */
  private updateRate(dt: number, step: TourStep, t: number, duration: number): void {
    if (!this.windingDown) {
      const tour = this.state.tour!;
      const nextStep = tour.steps[this.state.stepIndex + 1];
      const base = nextStep ? nextStep.timeRate ?? 1 : this.savedRate;
      const left = Math.max(0, duration - t) + (step.dwell ?? DEFAULT_DWELL) - Math.max(0, this.sinceEnd);
      const rampingUp = this.rateTween !== null && this.rateTween.to !== base;
      if (!rampingUp && this.rateGoal !== base && left <= rampSeconds(this.rateGoal, base)) {
        this.windingDown = true;
        this.setRate(base);
      }
    }
    const r = this.rateTween;
    if (!r) return;
    r.t += dt;
    const k = Math.min(1, r.t / r.dur);
    const e = k * k * (3 - 2 * k);
    this.host.time.setRate(r.from + (r.to - r.from) * e);
    if (k >= 1) this.rateTween = null;
  }

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
    this.fired.clear();
    this.cueTimes.clear();
    this.dueSince.clear();
    this.restFor = -1;
    this.resetCues();
    this.state.title = step.title ?? '';
    this.state.kicker = step.kicker ?? '';
    this.state.facts = step.facts ?? [];
    this.state.stepTime = 0;
    this.dollyRate = step.dollyRate ?? 0;
    this.host.camera.autoOrbit = 0;
    this.host.camera.autoDolly = 0;
    this.windingDown = false;
    this.setRate(step.timeRate ?? 1);
    // a flight cue in the first sentence or two would cut the approach short (zoom in, then
    // straight back out): make it the approach instead — unless it is delayed, i.e. meant to
    // follow a first look from the approach
    this.navigate(step.target); // selects the target and switches star systems as needed
    this.host.setTourScope(this.scopeOf(step)); // after navigate: the ids live in the step's system
    const early = step.cues?.find((c) => isFlightCue(c) && c.action !== 'return' && c.at <= 1 && c.delay === undefined);
    if (early) {
      this.fired.add(early);
      this.fire(step, early, null, 0); // replaces the flight just planned, same frame
    }
    this.flight = this.host.camera.autopilot;

    // Start the narration right away (same user gesture for the first step) — the manifest is
    // only needed for subtitles and can arrive later.
    this.audio.pause();
    void this.ready.then(() => {
      if (myToken !== this.token) return;
      if (this.state.silent) { this.audioFailed = true; return; }
      this.audio.src = this.audioUrl(this.audioLocale, tour.audio ?? tour.id, step.id, this.timing(step)?.hash);
      this.audio.currentTime = 0;
      void this.audio.play().catch(() => { if (myToken === this.token) this.audioFailed = true; });
    });
    this.emit();
  }

  private teardown(): void {
    this.token++;
    this.audio.pause();
    this.onSpeech?.(false);
    this.audio.removeAttribute('src');
    this.audio.load();
    const time = this.host.time;
    this.rateTween = null;
    if (this.state.tour?.keepClock) {
      // an event scene: the visitor came for this date, so stay on it in real time
      time.setRate(1);
      if (time.paused) time.togglePause();
    } else {
      time.setRate(this.savedRate);
      if (this.savedPaused) time.togglePause();
      // steps fast-forward years and jump the clock for daylight: put the calendar back where the
      // visitor left it (plus the real time that passed, as if the tour had run at their rate)
      const realS = (performance.now() - this.savedAt) / 1000;
      time.jd = this.savedJd + (this.savedPaused ? 0 : (realS * this.savedRate) / DAY_S);
    }
    this.host.camera.autoOrbit = 0;
    this.host.camera.autoDolly = 0;
    this.fired.clear();
    this.resetCues();
    this.host.setTourScope(null);
    this.flight = null;
    this.state.tour = null;
    this.state.stepIndex = -1;
    this.state.phase = 'idle';
    this.state.progress = 0;
    this.state.subtitle = '';
    this.state.paused = false;
    this.state.title = '';
    this.state.kicker = '';
    this.state.facts = [];
    this.state.stepTime = 0;
  }

  private emit(): void {
    this.onChange?.(this.state);
  }

  private timing(step: TourStep): StepTiming | null {
    return this.manifest?.steps[step.id] ?? null;
  }

  /**
   * Narration time (s) at which a cue fires. The cue names a sentence of the source text; the
   * spoken locale may split sentences differently, so the index is mapped proportionally onto
   * the manifest's sentence list (or, without audio, onto the displayed text's sentences).
   */
  private cueTime(step: TourStep, cue: TourCue, timing: StepTiming | null, duration: number): number {
    const srcCount = splitSentences(step.text).length;
    const frac = srcCount > 1 ? Math.min(cue.at, srcCount - 1) / (srcCount - 1) : 0;
    const delay = cue.delay ?? 0;
    if (timing && timing.sentences.length) {
      const i = Math.round(frac * (timing.sentences.length - 1));
      return timing.sentences[i].start + delay;
    }
    // silent: sentence starts proportional to character offsets in the displayed text
    const shown = splitSentences(_(step.text));
    const i = Math.round(frac * Math.max(shown.length - 1, 0));
    const total = shown.reduce((n, s) => n + s.length, 0) || 1;
    let before = 0;
    for (let k = 0; k < i; k++) before += shown[k].length;
    return (before / total) * duration + delay;
  }

  private fire(step: TourStep, raw: TourCue, timing: StepTiming | null, duration: number): void {
    const h = this.host;
    const targetId = this.targetBodyId(step.target);
    const cue = this.resolveCue(raw);
    if (this.postcardFov !== null && isFlightCue(cue) && cue.action !== 'postcard') {
      this.fovTween = { from: this.overrides.fov ?? h.currentFov(), to: this.postcardFov, t: 0, dur: 2.5 };
      this.postcardFov = null;
    }
    switch (cue.action) {
      case 'card':
        this.readout = null;
        this.state.card = { image: cue.image, title: cue.title, big: cue.big, text: cue.text, source: cue.source };
        this.cardUntil = cue.until === undefined ? Infinity : this.cueTime(step, { at: cue.until, action: 'uncard' }, timing, duration);
        break;
      case 'uncard':
        this.readout = null;
        this.state.card = null;
        this.cardUntil = Infinity;
        break;
      case 'compare':
        if (!targetId) break;
        h.setComparison(cue.ref, targetId, cue.shoulder);
        // the host may back the camera off to fit both bodies: adopt that flight as ours
        if (h.camera.autopilot && h.camera.autopilot !== this.flight) {
          this.flight = h.camera.autopilot;
          this.state.phase = 'flying';
        }
        break;
      case 'uncompare':
        h.setComparison(null);
        break;
      case 'vantage': {
        const ref = cue.ref ?? targetId;
        if (!ref) break;
        this.endLook();
        h.goToVantageOf(ref, cue.elev, cue.az, cue.dist, cue.seconds, cue.inside);
        this.flight = h.camera.autopilot;
        this.state.phase = 'flying';
        break;
      }
      case 'limb': {
        const ref = cue.ref ?? targetId;
        if (!ref) break;
        this.endLook();
        h.goToLimb(ref, cue.elev, cue.az, cue.dist, cue.aimR, cue.aimAz, cue.seconds);
        this.flight = h.camera.autopilot;
        this.state.phase = 'flying';
        break;
      }
      case 'shot':
        this.endLook();
        h.goToShot(cue.ref, cue.toward, cue.dist, cue.az ?? 0, cue.elev ?? 0, cue.seconds);
        this.flight = h.camera.autopilot;
        this.state.phase = 'flying';
        break;
      case 'postcard': {
        this.endLook();
        const { at: _at, action: _action, delay: _delay, ...p } = cue;
        h.setPostcard(p);
        if (p.fov !== undefined) this.postcardFov ??= this.overrides.fov ?? h.currentFov();
        if (p.fov !== undefined) this.fovTween = { from: this.overrides.fov ?? h.currentFov(), to: p.fov, t: 0, dur: p.seconds ?? 6 };
        this.flight = h.camera.autopilot;
        this.state.phase = 'flying';
        break;
      }
      case 'dolly':
        this.dollyRate = cue.rate;
        break;
      case 'drift':
        this.driftRate = cue.rate;
        break;
      case 'pulse':
        h.setPulse({ from: cue.from, to: cue.to, seconds: cue.seconds });
        break;
      case 'meteors':
        if (!cue.on) { h.setMeteors(null); break; }
        if (cue.approach) this.endLook();
        h.setMeteors({ ref: cue.ref, ra: cue.ra, dec: cue.dec, speed: cue.speed, rate: cue.rate, fireballs: cue.fireballs, approach: cue.approach, seconds: cue.seconds });
        if (cue.approach && h.camera.autopilot && h.camera.autopilot !== this.flight) {
          this.flight = h.camera.autopilot;
          this.state.phase = 'flying';
        }
        break;
      case 'readout':
        this.readout = cue;
        this.readoutText = '';
        this.cardUntil = cue.until === undefined ? Infinity : this.cueTime(step, { at: cue.until, action: 'uncard' }, timing, duration);
        break;
      case 'lookFrom':
        this.look = cue;
        this.stand = null;
        this.pinned = true; // no drift
        if (cue.fov !== undefined) { this.overrides = { ...this.overrides, fov: cue.fov }; h.setTourOverrides(this.overrides); }
        h.lookFrom(cue.ref, cue.toward, cue.alt ?? 300);
        this.flight = h.camera.autopilot;
        break;
      case 'land':
        this.look = null;
        this.pinned = true;
        if (cue.fov !== undefined) { this.overrides = { ...this.overrides, fov: cue.fov }; h.setTourOverrides(this.overrides); }
        // the sky must hold still on the ground: a rate ramp still running is cut to real time
        if (h.time.rate !== 1) { this.rateTween = null; this.rateGoal = 1; h.time.setRate(1); }
        h.landFor(cue.ref, cue.toward, { elev: cue.elev ?? 9, sep: cue.sep, starElev: cue.starElev, seconds: cue.seconds });
        this.stand = cue.toward;
        this.flight = h.camera.autopilot;
        if (this.flight) this.state.phase = 'flying';
        break;
      case 'fov':
        if (cue.seconds && cue.seconds > 0) {
          this.fovTween = { from: this.overrides.fov ?? h.currentFov(), to: cue.deg, t: 0, dur: cue.seconds };
        } else {
          this.fovTween = null;
          this.overrides = { ...this.overrides, fov: cue.deg };
          h.setTourOverrides(this.overrides);
        }
        break;
      case 'fill':
        this.overrides = { ...this.overrides, fill: cue.on };
        h.setTourOverrides(this.overrides);
        break;
      case 'orbits':
        this.overrides = { ...this.overrides, ...(cue.moons ? { moonOrbits: cue.on } : { orbits: cue.on }) };
        h.setTourOverrides(this.overrides);
        break;
      case 'time': {
        const d = new Date(cue.iso);
        if (!Number.isNaN(d.getTime())) h.setClock(d);
        break;
      }
      case 'clouds':
        this.overrides = { ...this.overrides, clouds: cue.on };
        h.setTourOverrides(this.overrides);
        break;
      case 'rate':
        this.setRate(cue.rate);
        break;
      case 'overview': {
        this.endLook();
        // the orbit lines are the whole point of an overview
        const moon = h.universe.get(cue.ref)?.data.type === 'moon';
        this.overrides = { ...this.overrides, ...(moon ? { moonOrbits: true } : { orbits: true }) };
        h.setTourOverrides(this.overrides);
        h.goToOverview(cue.ref, cue.seconds);
        this.flight = h.camera.autopilot;
        this.state.phase = 'flying';
        break;
      }
      case 'pin':
        h.setSurfacePin({ bodyId: cue.ref, lat: cue.lat, lon: cue.lon, label: cue.label, storm: cue.storm, extent: cue.extent });
        this.pinned = true;
        h.camera.autoOrbit = PIN_ORBIT;
        if (cue.approach !== false) {
          h.goToSurface(cue.ref, cue.lat, cue.lon, cue.storm);
          this.flight = h.camera.autopilot;
          this.state.phase = 'flying';
        }
        break;
      case 'unpin':
        h.setSurfacePin(null);
        this.pinned = false;
        break;
      case 'return':
        this.endLook();
        if (targetId) h.returnTo(targetId);
        else this.navigate(step.target);
        this.flight = h.camera.autopilot;
        this.state.phase = 'flying';
        break;
    }
  }

  /** Undo everything cues may have changed (called on step change and teardown) */
  /** Leave a `lookFrom` shot: the camera gets its own fov and drift back. */
  private endLook(): void {
    if (!this.look && !this.stand) return;
    this.look = null;
    this.stand = null;
    this.pinned = false;
    this.fovTween = null;
    if (this.overrides.fov !== undefined) {
      const { fov: _fov, ...rest } = this.overrides;
      this.overrides = rest;
      this.host.setTourOverrides(this.overrides);
    }
  }

  private resetCues(): void {
    this.overrides = {};
    this.pinned = false;
    this.state.card = null;
    this.cardUntil = Infinity;
    this.readout = null;
    this.readoutText = '';
    this.look = null;
    this.stand = null;
    this.driftRate = null;
    this.dollyRate = 0;
    this.fovTween = null;
    this.postcardFov = null;
    this.host.setTourOverrides(this.overrides);
    this.host.setSurfacePin(null);
    this.host.setComparison(null);
    this.host.setPostcard(null);
    this.host.setPulse(null);
    this.host.setMeteors(null);
  }

  private silentDuration(step: TourStep): number {
    return Math.max(4, _(step.text).length / SILENT_CPS);
  }

  /** Sentence of the displayed text being "read" at narration time `t` (same character-proportional clock as cueTime) */
  private silentSentence(step: TourStep, t: number, duration: number): string {
    const shown = splitSentences(_(step.text));
    if (shown.length <= 1) return _(step.text);
    const total = shown.reduce((n, s) => n + s.length, 0) || 1;
    const pos = Math.min(0.999, Math.max(0, duration > 0 ? t / duration : 0)) * total;
    let before = 0;
    for (const s of shown) {
      before += s.length;
      if (pos < before) return s;
    }
    return shown[shown.length - 1];
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
        const r = await fetch(this.manifestUrl(loc, tour.audio ?? tour.id));
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

  /** Body ids a step is about: its target, the step's `show` list and every body its cues refer to */
  private scopeOf(step: TourStep): string[] {
    const ids: string[] = [];
    const t = step.target;
    const target = this.targetBodyId(t);
    if (target) ids.push(target);
    else if (t.kind === 'blackhole') {
      const bh = this.host.universe.blackHole(t.ref);
      if (bh) ids.push(bh.entry.bodyId);
    }
    if (step.show) ids.push(...step.show.map((id) => this.bodyRef(id)));
    for (const raw of step.cues ?? []) {
      const c = this.resolveCue(raw);
      switch (c.action) {
        case 'overview': case 'pin': case 'postcard': ids.push(c.ref); break;
        case 'vantage': case 'limb': if (c.ref) ids.push(c.ref); break;
        case 'shot': ids.push(c.ref, c.toward); break;
        case 'compare': ids.push(c.ref); break;
        case 'pulse': ids.push(c.from, c.to); break;
        case 'readout': ids.push(c.a, c.b); if (c.from) ids.push(c.from); break;
        case 'lookFrom': case 'land': ids.push(c.ref, ...c.toward); break;
        case 'meteors': if (c.on) ids.push(c.ref); break;
      }
    }
    return ids;
  }

  private resolvable(t: TourTarget): boolean {
    const u = this.host.universe;
    switch (t.kind) {
      case 'body': return u.current.catalogIndex === 0 ? !!u.get(t.ref) : true;
      case 'star': return u.catalog.search(t.ref, 1).length > 0;
      case 'blackhole': return !!u.blackHole(t.ref);
      case 'landmark': return !!u.landmark(t.ref);
      case 'galaxy': return this.resolveGalaxy(t.ref) !== null;
      case 'exoplanet': return u.exoplanets.byName(t.ref) !== null;
    }
  }

  /** The body a step's target is, once its system is current (null for stars, landmarks, galaxies) */
  private targetBodyId(t: TourTarget): string | null {
    if (t.kind === 'body') return t.ref;
    if (t.kind === 'exoplanet') {
      const hit = this.host.universe.exoplanets.byName(t.ref);
      return hit ? exoBodyId(hit.host.i, hit.planet.name) : null;
    }
    return null;
  }

  /**
   * A cue's body reference as an id of the current system: Solar System ids pass through, an
   * archive planet name becomes its generated body, 'star' is the system's star.
   */
  private bodyRef(ref: string): string {
    const u = this.host.universe;
    if (u.get(ref)) return ref;
    if (ref === 'star') return u.star.id;
    const hit = u.exoplanets.byName(ref);
    return hit ? exoBodyId(hit.host.i, hit.planet.name) : ref;
  }

  /** The cue with every body reference resolved (see `bodyRef`) */
  private resolveCue(c: TourCue): TourCue {
    const r = this.bodyRef.bind(this);
    switch (c.action) {
      case 'overview': case 'pin': case 'postcard': case 'compare': return { ...c, ref: r(c.ref) };
      case 'vantage': case 'limb': return c.ref ? { ...c, ref: r(c.ref) } : c;
      case 'shot': return { ...c, ref: r(c.ref), toward: r(c.toward) };
      case 'pulse': return { ...c, from: r(c.from), to: r(c.to) };
      case 'readout': return { ...c, a: r(c.a), b: r(c.b), from: c.from ? r(c.from) : undefined };
      case 'lookFrom': case 'land': return { ...c, ref: r(c.ref), toward: c.toward.map(r) };
      case 'meteors': return c.on ? { ...c, ref: r(c.ref) } : c;
      default: return c;
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
      case 'body': h.goToTourBody(t.ref); break;
      case 'exoplanet': {
        const hit = u.exoplanets.byName(t.ref);
        if (hit) h.goToTourBody(exoBodyId(hit.host.i, hit.planet.name), `c${hit.host.i}`);
        break;
      }
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
