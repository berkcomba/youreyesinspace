/**
 * A short trombone "ta-da" synthesised with Web Audio (no sample to load or license): three quick
 * pickup notes rising to a held B♭-major chord with a slide into it and a late vibrato.
 *
 * The brass tone: two slightly detuned sawtooths through a low-pass filter whose cutoff opens with
 * each attack (the "blat" of a lip-buzzed note) and settles; each note scoops up into its pitch
 * the way a slide trombone does. A light feedback delay stands in for a hall.
 *
 * Browsers start audio only after a user gesture: without one the context stays suspended and
 * nothing is played (resolves false).
 */
export async function playTromboneFanfare(volume: number): Promise<boolean> {
  if (volume <= 0) return false;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return false;
  const ctx = new AC();
  try { await ctx.resume(); } catch { /* stays suspended */ }
  if (ctx.state !== 'running') { void ctx.close(); return false; }

  const length = scheduleFanfare(ctx, ctx.destination, volume, ctx.currentTime + 0.05);
  window.setTimeout(() => void ctx.close(), (length + 0.2) * 1000);
  return true;
}

/** Schedule the fanfare on any context (an OfflineAudioContext renders it for checks); returns its length (s) */
export function scheduleFanfare(ctx: BaseAudioContext, destination: AudioNode, volume: number, t0: number): number {
  const out = ctx.createDynamicsCompressor();
  out.threshold.value = -14; out.ratio.value = 3;
  const master = ctx.createGain();
  master.gain.value = 0.32 * volume;
  // the hall: a short feedback delay, filtered dark
  const delay = ctx.createDelay(1);
  delay.delayTime.value = 0.13;
  const fb = ctx.createGain(); fb.gain.value = 0.28;
  const damp = ctx.createBiquadFilter(); damp.type = 'lowpass'; damp.frequency.value = 1800;
  const wet = ctx.createGain(); wet.gain.value = 0.22;
  master.connect(out);
  master.connect(delay); delay.connect(damp); damp.connect(fb); fb.connect(delay); damp.connect(wet); wet.connect(out);
  out.connect(destination);

  const hz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);
  // F3 B♭3 D4 pickups, then the chord B♭3 D4 F4 (the top voice slides up from E4)
  const pickups: Array<[number, number, number]> = [[53, 0, 0.13], [58, 0.15, 0.13], [62, 0.3, 0.13]];
  for (const [m, at, dur] of pickups) voice(ctx, master, hz(m), t0 + at, dur, 0.9, false);
  const hold = 1.15;
  voice(ctx, master, hz(65), t0 + 0.47, hold, 1, true, hz(64));
  voice(ctx, master, hz(62), t0 + 0.47, hold, 0.7, true);
  voice(ctx, master, hz(58), t0 + 0.47, hold, 0.6, true);
  return 0.47 + hold + 1.4;
}

function voice(ctx: BaseAudioContext, dest: AudioNode, f: number, at: number, dur: number, level: number, vibrato: boolean, slideFrom?: number): void {
  const end = at + dur;
  const gain = ctx.createGain();
  // attack, a small accent decay, sustain, release
  gain.gain.setValueAtTime(0, at);
  gain.gain.linearRampToValueAtTime(level, at + 0.035);
  gain.gain.linearRampToValueAtTime(level * 0.78, at + 0.12);
  gain.gain.setValueAtTime(level * 0.78, Math.max(at + 0.12, end - 0.08));
  gain.gain.linearRampToValueAtTime(0, end + 0.12);
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.Q.value = 1.4;
  filter.frequency.setValueAtTime(f * 1.5, at);
  filter.frequency.exponentialRampToValueAtTime(f * 7, at + 0.05);
  filter.frequency.exponentialRampToValueAtTime(f * 4, at + 0.25);
  filter.connect(gain);
  gain.connect(dest);
  const lfo = vibrato ? ctx.createOscillator() : null;
  const lfoGain = vibrato ? ctx.createGain() : null;
  if (lfo && lfoGain) {
    lfo.frequency.value = 5.2;
    lfoGain.gain.setValueAtTime(0, at);
    lfoGain.gain.linearRampToValueAtTime(0, at + 0.35);
    lfoGain.gain.linearRampToValueAtTime(f * 0.012, at + 0.7);   // ±20 cents, arriving late
    lfo.connect(lfoGain);
    lfo.start(at); lfo.stop(end + 0.2);
  }
  for (const detune of [-6, 5]) {
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.detune.value = detune;
    // the slide: a scoop into the note (a semitone below for the top voice, a few cents otherwise)
    const from = slideFrom ?? f * 0.97;
    osc.frequency.setValueAtTime(from, at);
    osc.frequency.exponentialRampToValueAtTime(f, at + (slideFrom ? 0.16 : 0.05));
    if (lfoGain) lfoGain.connect(osc.frequency);
    osc.connect(filter);
    osc.start(at); osc.stop(end + 0.2);
  }
}
