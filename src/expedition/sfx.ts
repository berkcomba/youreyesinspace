/**
 * Synthesised sound effects (Web Audio, no sample files). Shared by the host cockpit and the
 * crew page. Browsers keep the AudioContext suspended until the first user gesture, so the
 * context is created lazily and resumed on the first pointer/key event.
 */

export type Sfx =
  | 'join' | 'vote' | 'answer' | 'tap' | 'gateOpen' | 'tick' | 'lock' | 'pass' | 'fail'
  | 'launch' | 'arrive' | 'discovered' | 'whoosh'
  | 'impact' | 'alarm' | 'rumble' | 'repair' | 'count' | 'hatch';

const STORE = 'yeis.xp.sfx';

class SoundBoard {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private last = new Map<Sfx, number>();
  enabled = localStorage.getItem(STORE) !== 'off';

  constructor() {
    const unlock = (): void => { void this.context()?.resume(); };
    addEventListener('pointerdown', unlock, { capture: true });
    addEventListener('keydown', unlock, { capture: true });
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    localStorage.setItem(STORE, on ? 'on' : 'off');
  }

  private context(): AudioContext | null {
    if (this.ctx) return this.ctx;
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.55;
    const comp = this.ctx.createDynamicsCompressor();
    this.master.connect(comp).connect(this.ctx.destination);
    const len = this.ctx.sampleRate * 2;
    this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    let b = 0;
    for (let i = 0; i < len; i++) { b = (b + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = b * 3.5; }   // brown-ish
    return this.ctx;
  }

  play(name: Sfx): void {
    if (!this.enabled) return;
    const ctx = this.context();
    if (!ctx || ctx.state !== 'running' || !this.master) return;
    const now = performance.now();
    const gap = name === 'answer' || name === 'vote' ? 90 : 40;
    if (now - (this.last.get(name) ?? 0) < gap) return;   // a burst of votes is one sound, not a buzz
    this.last.set(name, now);
    const t = ctx.currentTime + 0.01;
    switch (name) {
      case 'join': this.tone(659, t, 0.12, 0.18, 'sine'); this.tone(988, t + 0.09, 0.22, 0.16, 'sine'); break;
      case 'vote': this.tone(520 + Math.random() * 120, t, 0.07, 0.14, 'triangle'); break;
      case 'answer': this.tone(1400 + Math.random() * 300, t, 0.035, 0.07, 'sine'); break;
      case 'tap': this.tone(880, t, 0.06, 0.16, 'triangle'); break;
      case 'tick': this.tone(1760, t, 0.03, 0.12, 'square', 2400); this.tone(880, t, 0.05, 0.06, 'sine'); break;
      case 'gateOpen':
        this.sweep(220, 880, t, 0.5, 0.12);
        [523, 659, 784, 1047].forEach((f, i) => this.tone(f, t + 0.32 + i * 0.05, 0.9, 0.09, 'sine'));
        break;
      case 'lock': this.tone(130, t, 0.25, 0.32, 'sine'); this.noiseBurst(t, 0.12, 0.25, 900); break;
      case 'pass': [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, t + i * 0.08, 0.5, 0.14, 'triangle')); break;
      case 'fail': this.tone(392, t, 0.28, 0.16, 'sawtooth', 1200); this.tone(311, t + 0.24, 0.5, 0.16, 'sawtooth', 900); break;
      case 'whoosh': this.noiseBurst(t, 0.7, 0.2, 2200, 300); break;
      case 'launch':
        this.noiseBurst(t, 3.2, 0.5, 140, 1400);
        this.sweep(55, 110, t, 3, 0.16);
        break;
      case 'arrive': this.noiseBurst(t, 1.4, 0.25, 1600, 200); this.tone(392, t + 0.5, 1.2, 0.08, 'sine'); break;
      case 'discovered':
        [[523, 659, 784], [587, 740, 880], [659, 831, 988, 1319]].forEach((ch, i) => ch.forEach((f) => this.tone(f, t + i * 0.22, i === 2 ? 1.8 : 0.3, 0.09, 'triangle')));
        this.noiseBurst(t + 0.44, 1.6, 0.06, 6000, 9000);
        break;
      case 'impact':
        this.noiseBurst(t, 0.9, 0.7, 380, 60);
        this.sweep(90, 32, t, 0.8, 0.35);
        this.tone(1900, t + 0.02, 0.4, 0.05, 'square', 3000);
        break;
      case 'alarm': [0, 0.36, 0.72].forEach((d) => { this.tone(880, t + d, 0.16, 0.09, 'square', 2200); this.tone(660, t + d + 0.17, 0.16, 0.09, 'square', 2200); }); break;
      case 'rumble': this.noiseBurst(t, 3.4, 0.4, 70, 260); break;
      case 'repair': [440, 554, 659, 880].forEach((f, i) => this.tone(f, t + i * 0.09, 0.22, 0.08, 'sine')); this.noiseBurst(t, 0.6, 0.06, 4000, 7000); break;
      case 'count': this.tone(1046, t, 0.09, 0.12, 'sine'); break;
      case 'hatch': this.noiseBurst(t, 0.8, 0.25, 3000, 700); this.tone(196, t + 0.55, 0.3, 0.14, 'triangle'); break;
    }
  }

  private tone(freq: number, t: number, dur: number, gain: number, type: OscillatorType, lowpass?: number): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node: AudioNode = o;
    if (lowpass) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lowpass; node = o.connect(f); }
    node.connect(g).connect(this.master!);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private sweep(f0: number, f1: number, t: number, dur: number, gain: number): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + dur * 0.3);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master!);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private noiseBurst(t: number, dur: number, gain: number, f0: number, f1 = f0): void {
    const ctx = this.ctx!;
    const s = ctx.createBufferSource();
    s.buffer = this.noise;
    s.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 0.8;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + Math.min(0.4, dur * 0.35));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(this.master!);
    s.start(t, Math.random());
    s.stop(t + dur + 0.05);
  }
}

export const sfx = new SoundBoard();
