import { VOICE_DIR, voiceKey } from './voicelines';

const STORE = 'yeis.xp.voice';

/** Plays the pre-rendered narrator clips in order; a missing clip is skipped silently. */
class Narrator {
  enabled = localStorage.getItem(STORE) !== 'off';
  private audio = new Audio();
  private queue: string[] = [];
  private token = 0;
  private busy = false;

  constructor() {
    this.audio.preload = 'auto';
    const done = (): void => { this.busy = false; this.next(); };
    this.audio.addEventListener('ended', done);
    this.audio.addEventListener('error', done);
  }

  get speaking(): boolean { return this.busy; }

  setEnabled(on: boolean): void {
    this.enabled = on;
    localStorage.setItem(STORE, on ? 'on' : 'off');
    if (!on) this.stop();
  }

  /** `interrupt` cuts the current line and drops anything queued. */
  say(text: string | undefined, interrupt = false): void {
    if (!this.enabled || !text) return;
    if (interrupt) this.stop();
    this.queue.push(text);
    this.next();
  }

  stop(): void {
    this.queue = [];
    this.token++;
    this.busy = false;
    this.audio.pause();
  }

  private next(): void {
    if (this.busy) return;
    const text = this.queue.shift();
    if (!text) return;
    this.busy = true;
    const token = ++this.token;
    this.audio.src = `${VOICE_DIR}${voiceKey(text)}.mp3`;
    this.audio.play().catch(() => {
      if (token !== this.token) return;   // superseded by a newer line
      this.busy = false;
      this.next();
    });
  }
}

export const narrator = new Narrator();
