/**
 * Academy — drives a lesson: which section/step is open, moves the 3-D scene according to the
 * step's cues, and remembers progress in localStorage.
 */
import { COURSE, type Chapter, type Course, type SceneCue, type Section, type Step } from '../data/lessons';
import type { TourHost, TourOverrides, TourPlayer } from './TourPlayer';

const STORE_KEY = 'yeits.academy';
/** gentle drift around whatever the step flew to */
const LESSON_ORBIT = 0.035;

interface Stored {
  visited: string[];
  last?: { section: string; step: number };
  /** lecturer narration on/off and auto-advance when a clip ends */
  voice?: boolean;
  auto?: boolean;
}

interface LectureClip { duration: number; sentences: Array<{ start: number; end: number; text: string }>; script: string }
interface LectureManifest { steps: Record<string, LectureClip> }

export interface NarrationState {
  /** a clip exists for the current step */
  available: boolean;
  loading: boolean;
  enabled: boolean;
  auto: boolean;
  playing: boolean;
  time: number;
  duration: number;
  sentence: string;
}

export class LessonPlayer {
  readonly course: Course = COURSE;
  section: Section | null = null;
  chapter: Chapter | null = null;
  stepIndex = 0;
  onChange: (() => void) | null = null;

  private overrides: TourOverrides = {};
  private visited = new Set<string>();
  private last: Stored['last'];
  private flight: object | null = null;
  private settled = false;

  /* narration */
  onNarration: ((n: NarrationState) => void) | null = null;
  readonly narration: NarrationState = { available: false, loading: false, enabled: true, auto: false, playing: false, time: 0, duration: 0, sentence: '' };
  private readonly audio = new Audio();
  private manifests = new Map<string, Promise<LectureManifest | null>>();
  private clip: LectureClip | null = null;
  private clipToken = 0;
  private lastEmit = '';

  constructor(private readonly host: TourHost, private readonly tours: TourPlayer) {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        const s = JSON.parse(raw) as Stored;
        this.visited = new Set(s.visited ?? []);
        this.last = s.last;
        if (s.voice !== undefined) this.narration.enabled = s.voice;
        if (s.auto !== undefined) this.narration.auto = s.auto;
      }
    } catch { /* ignore */ }
    this.audio.preload = 'auto';
    this.audio.addEventListener('ended', () => {
      this.narration.playing = false;
      this.emitNarration(true);
      if (this.narration.auto && this.section) window.setTimeout(() => { if (this.section && !this.narration.playing) this.next(); }, 900);
    });
    this.audio.addEventListener('play', () => { this.narration.playing = true; this.emitNarration(true); });
    this.audio.addEventListener('pause', () => { this.narration.playing = false; this.emitNarration(true); });
  }

  /* ---- narration ---- */
  private manifest(sectionId: string): Promise<LectureManifest | null> {
    let p = this.manifests.get(sectionId);
    if (!p) {
      p = fetch(`${import.meta.env.BASE_URL}lessons/en/${sectionId}.json`, { cache: 'no-cache' })
        .then((r) => (r.ok ? (r.json() as Promise<LectureManifest>) : null))
        .catch(() => null);
      this.manifests.set(sectionId, p);
    }
    return p;
  }

  private async loadClip(section: Section, step: Step): Promise<void> {
    const token = ++this.clipToken;
    this.stopClip();
    this.narration.loading = true;
    this.emitNarration(true);
    const m = await this.manifest(section.id);
    if (token !== this.clipToken) return;
    const clip = m?.steps[step.id] ?? null;
    this.clip = clip && clip.duration ? clip : null;
    this.narration.loading = false;
    this.narration.available = this.clip !== null;
    this.narration.duration = this.clip?.duration ?? 0;
    this.narration.time = 0;
    this.narration.sentence = this.clip?.sentences[0]?.text ?? '';
    if (this.clip) {
      this.audio.src = `${import.meta.env.BASE_URL}lessons/en/${section.id}/${step.id}.mp3`;
      if (this.narration.enabled) this.audio.play().catch(() => { this.narration.playing = false; this.emitNarration(true); });
    }
    this.emitNarration(true);
  }

  private stopClip(): void {
    if (!this.audio.paused) this.audio.pause();
    this.audio.removeAttribute('src');
    this.audio.load();
    this.clip = null;
    this.narration.available = false;
    this.narration.playing = false;
    this.narration.time = 0;
    this.narration.duration = 0;
    this.narration.sentence = '';
  }

  /** play / pause the lecturer */
  toggleNarration(): void {
    if (!this.clip) return;
    if (this.audio.paused) {
      if (this.audio.ended) this.audio.currentTime = 0;
      this.narration.enabled = true;
      this.save();
      this.audio.play().catch(() => {});
    } else this.audio.pause();
  }
  setNarrationEnabled(on: boolean): void {
    this.narration.enabled = on;
    this.save();
    if (!on) { if (!this.audio.paused) this.audio.pause(); }
    else if (this.clip && this.audio.paused) this.audio.play().catch(() => {});
    this.emitNarration(true);
  }
  setAutoAdvance(on: boolean): void {
    this.narration.auto = on;
    this.save();
    this.emitNarration(true);
  }
  seekNarration(t: number): void {
    if (!this.clip) return;
    this.audio.currentTime = Math.max(0, Math.min(this.clip.duration, t));
    this.emitNarration(true);
  }

  private emitNarration(force = false): void {
    const n = this.narration;
    if (this.clip) {
      n.time = this.audio.currentTime || 0;
      const s = this.clip.sentences.find((x) => n.time >= x.start && n.time < x.end) ?? (n.time >= n.duration - 0.05 ? this.clip.sentences[this.clip.sentences.length - 1] : null);
      if (s) n.sentence = s.text;
    }
    const sig = `${n.available}|${n.loading}|${n.enabled}|${n.auto}|${n.playing}|${Math.floor(n.time * 4)}|${n.sentence}`;
    if (!force && sig === this.lastEmit) return;
    this.lastEmit = sig;
    this.onNarration?.(n);
  }

  get active(): boolean { return this.section !== null; }
  get step(): Step | null { return this.section?.steps[this.stepIndex] ?? null; }
  get resume(): Stored['last'] { return this.last; }

  /* ---- progress ---- */
  private key(section: Section, i: number) { return `${section.id}/${section.steps[i].id}`; }
  isVisited(section: Section, i: number) { return this.visited.has(this.key(section, i)); }
  /** fraction of the section's steps seen */
  progress(section: Section): number {
    let n = 0;
    for (let i = 0; i < section.steps.length; i++) if (this.isVisited(section, i)) n++;
    return n / section.steps.length;
  }
  chapterProgress(ch: Chapter): number {
    let n = 0, t = 0;
    for (const s of ch.sections) { t += s.steps.length; n += this.progress(s) * s.steps.length; }
    return t ? n / t : 0;
  }
  private save() {
    try {
      const s: Stored = { visited: [...this.visited], last: this.last, voice: this.narration.enabled, auto: this.narration.auto };
      localStorage.setItem(STORE_KEY, JSON.stringify(s));
    } catch { /* ignore */ }
  }

  /* ---- navigation ---- */
  findSection(id: string): { chapter: Chapter; section: Section } | null {
    for (const ch of this.course.chapters) for (const s of ch.sections) if (s.id === id) return { chapter: ch, section: s };
    return null;
  }

  open(sectionId: string, stepIndex = 0): void {
    const hit = this.findSection(sectionId);
    if (!hit) return;
    if (this.tours.active) this.tours.stop();
    this.chapter = hit.chapter;
    this.section = hit.section;
    this.go(Math.max(0, Math.min(stepIndex, hit.section.steps.length - 1)));
  }

  go(i: number): void {
    if (!this.section) return;
    if (i < 0 || i >= this.section.steps.length) return;
    this.stepIndex = i;
    const step = this.section.steps[i];
    this.visited.add(this.key(this.section, i));
    this.last = { section: this.section.id, step: i };
    this.save();
    this.resetScene();
    if (step.scene?.length) this.applyScene(step.scene);
    this.onChange?.();
    void this.loadClip(this.section, step);
  }

  next(): void {
    if (!this.section) return;
    if (this.stepIndex + 1 < this.section.steps.length) this.go(this.stepIndex + 1);
    else {
      // end of section: continue into the next one when there is one
      const nxt = this.nextSection();
      if (nxt) this.open(nxt.id, 0);
    }
  }
  prev(): void { if (this.stepIndex > 0) this.go(this.stepIndex - 1); }

  nextSection(): Section | null {
    if (!this.section) return null;
    const all = this.course.chapters.flatMap((c) => c.sections);
    const i = all.indexOf(this.section);
    return all[i + 1] ?? null;
  }

  close(): void {
    if (!this.section) return;
    this.section = null;
    this.chapter = null;
    this.clipToken++;
    this.stopClip();
    this.resetScene();
    this.onChange?.();
  }

  /* ---- scene ---- */
  private resetScene(): void {
    this.overrides = {};
    this.host.setTourOverrides(this.overrides);
    this.flight = null;
    this.settled = false;
  }

  private applyScene(cues: SceneCue[]): void {
    const h = this.host;
    const u = h.universe;
    for (const cue of cues) {
      switch (cue.action) {
        case 'goto':
          switch (cue.kind ?? 'body') {
            case 'body': h.goToTourBody(cue.ref); break;
            case 'blackhole': h.goToBlackHole(cue.ref); break;
            case 'landmark': {
              const l = u.landmark(cue.ref);
              if (l) h.goToLandmark(u.landmarks.indexOf(l));
              break;
            }
            case 'star': {
              const hits = u.catalog.search(cue.ref, 1);
              if (hits.length) h.goToStar(`c${hits[0]}`);
              break;
            }
            case 'galaxy': break;
          }
          this.flight = h.camera.autopilot;
          break;
        case 'overview': {
          const moon = u.get(cue.ref)?.data.type === 'moon';
          this.overrides = { ...this.overrides, ...(moon ? { moonOrbits: true } : { orbits: true }) };
          h.setTourOverrides(this.overrides);
          h.goToOverview(cue.ref);
          this.flight = h.camera.autopilot;
          break;
        }
        case 'vantage':
          h.goToVantageOf(cue.ref, cue.elev, cue.az, cue.dist);
          this.flight = h.camera.autopilot;
          break;
        case 'rate':
          h.time.setRate(cue.rate);
          break;
        case 'backdrop':
          h.showBackdrop(true);
          this.flight = null;
          this.settled = true; // the backdrop manages its own drift
          break;
        case 'grid':
          this.overrides = { ...this.overrides, eclipticGrid: cue.ecliptic, equatorialGrid: cue.equatorial };
          h.setTourOverrides(this.overrides);
          break;
        case 'orbits':
          this.overrides = { ...this.overrides, orbits: cue.on };
          h.setTourOverrides(this.overrides);
          break;
      }
    }
  }

  update(_dt: number): void {
    if (!this.section) return;
    // a tour started while a lesson was open takes over the scene
    if (this.tours.active) { this.close(); return; }
    if (this.clip && this.narration.playing) this.emitNarration();
    if (this.settled) return;
    const cam = this.host.camera;
    // once the flight we launched has finished, drift gently around the target
    if (this.flight && cam.autopilot !== this.flight) {
      this.flight = null;
      if (!cam.autopilot && cam.target) cam.autoOrbit = LESSON_ORBIT;
      this.settled = true;
    }
  }
}
