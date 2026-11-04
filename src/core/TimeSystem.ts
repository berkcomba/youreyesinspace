import { DAY_S, J2000_JD } from './constants';
import { _ } from '../i18n';

const RATE_STEPS = [
  1, 2, 5, 10, 30, 60, 300, 900, 3600, 3600 * 6, DAY_S, DAY_S * 3, DAY_S * 7, DAY_S * 30,
  DAY_S * 90, DAY_S * 365.25, DAY_S * 365.25 * 5, DAY_S * 365.25 * 10, DAY_S * 365.25 * 25, DAY_S * 365.25 * 100,
  DAY_S * 365.25 * 1000,
];

type RateUnit = 'dk' | 'sa' | 'gün' | 'hafta' | 'ay' | 'yıl';

/** "{n} <unit>/s" (singular forms are their own keys: "1 day/s", not "1 days/s") */
function perSecond(n: string | number, unit: RateUnit): string {
  if (n === 1 || n === '1') {
    switch (unit) {
      case 'dk': return _('1 dk/s'); case 'sa': return _('1 sa/s'); case 'gün': return _('1 gün/s');
      case 'hafta': return _('1 hafta/s'); case 'ay': return _('1 ay/s'); case 'yıl': return _('1 yıl/s');
    }
  }
  switch (unit) {
    case 'dk': return _('{n} dk/s', { n }); case 'sa': return _('{n} sa/s', { n }); case 'gün': return _('{n} gün/s', { n });
    case 'hafta': return _('{n} hafta/s', { n }); case 'ay': return _('{n} ay/s', { n }); case 'yıl': return _('{n} yıl/s', { n });
  }
}

/** The selectable presets (s/s) of the time menu: a Universe Sandbox-like ladder from real time to a millennium per second */
export const RATE_PRESETS: ReadonlyArray<{ rate: number; label: () => string }> = [
  { rate: 1, label: () => _('Gerçek zaman') },
  { rate: 60, label: () => perSecond(1, 'dk') },
  { rate: 600, label: () => perSecond(10, 'dk') },
  { rate: 3600, label: () => perSecond(1, 'sa') },
  { rate: 3600 * 6, label: () => perSecond(6, 'sa') },
  { rate: DAY_S, label: () => perSecond(1, 'gün') },
  { rate: DAY_S * 7, label: () => perSecond(1, 'hafta') },
  { rate: DAY_S * 30, label: () => perSecond(1, 'ay') },
  { rate: DAY_S * 365.25, label: () => perSecond(1, 'yıl') },
  { rate: DAY_S * 365.25 * 10, label: () => perSecond(10, 'yıl') },
  { rate: DAY_S * 365.25 * 100, label: () => perSecond(100, 'yıl') },
  { rate: DAY_S * 365.25 * 1000, label: () => perSecond(1000, 'yıl') },
];

/**
 * Simulation clock. Holds Julian Date (TT ≈ UTC for our purposes) as a double and
 * a time-warp multiplier. Positive/negative warps and pause are supported.
 */
export class TimeSystem {
  /** Julian date of the simulation */
  jd: number;
  /** Seconds of simulated time per real second */
  rate = 1;
  paused = false;
  private rateIndex = 0;
  private direction = 1;

  constructor(date: Date = new Date()) {
    this.jd = TimeSystem.dateToJD(date);
  }

  /** Seconds since J2000 epoch */
  get t(): number {
    return (this.jd - J2000_JD) * DAY_S;
  }

  /** Julian centuries since J2000 */
  get T(): number {
    return (this.jd - J2000_JD) / 36525;
  }

  get date(): Date {
    return TimeSystem.jdToDate(this.jd);
  }

  get effectiveRate(): number {
    return this.paused ? 0 : this.rate * this.direction;
  }

  advance(realDt: number): void {
    if (this.paused) return;
    this.jd += (realDt * this.rate * this.direction) / DAY_S;
  }

  setNow(): void {
    this.jd = TimeSystem.dateToJD(new Date());
    this.rateIndex = 0;
    this.rate = 1;
    this.direction = 1;
    this.paused = false;
  }

  setDate(d: Date): void {
    this.jd = TimeSystem.dateToJD(d);
  }

  /** Shift the clock by `seconds` of simulated time (tours use it to bring a feature into daylight) */
  jump(seconds: number): void {
    this.jd += seconds / DAY_S;
  }

  togglePause(): void {
    this.paused = !this.paused;
  }

  /** +1 forward, −1 backward */
  get dir(): number { return this.direction; }

  /** Run the clock forward or backward at the current rate */
  setDirection(dir: 1 | -1): void {
    this.direction = dir;
    this.paused = false;
  }

  /**
   * Set an arbitrary rate (s/s); snaps the step index to the nearest preset for +/-
   * @param dir direction to run in (forward unless given)
   */
  setRate(rate: number, dir: 1 | -1 = 1): void {
    this.rate = Math.max(1e-3, rate);
    this.direction = dir;
    this.paused = false;
    let best = 0;
    for (let i = 0; i < RATE_STEPS.length; i++) if (Math.abs(Math.log(RATE_STEPS[i] / this.rate)) < Math.abs(Math.log(RATE_STEPS[best] / this.rate))) best = i;
    this.rateIndex = best;
  }

  faster(): void {
    if (this.paused) {
      this.paused = false;
      return;
    }
    if (this.direction < 0) {
      if (this.rateIndex === 0) {
        this.direction = 1;
      } else {
        this.rateIndex--;
      }
    } else {
      this.rateIndex = Math.min(RATE_STEPS.length - 1, this.rateIndex + 1);
    }
    this.rate = RATE_STEPS[this.rateIndex];
  }

  slower(): void {
    if (this.paused) {
      this.paused = false;
      return;
    }
    if (this.direction > 0) {
      if (this.rateIndex === 0) {
        this.direction = -1;
      } else {
        this.rateIndex--;
      }
    } else {
      this.rateIndex = Math.min(RATE_STEPS.length - 1, this.rateIndex + 1);
    }
    this.rate = RATE_STEPS[this.rateIndex];
  }

  /** Jump several steps forward in warp */
  forwardWarp(): void {
    if (this.direction < 0) {
      this.direction = 1;
      this.rateIndex = 0;
    } else {
      this.rateIndex = Math.min(RATE_STEPS.length - 1, this.rateIndex + 1);
    }
    this.paused = false;
    this.rate = RATE_STEPS[this.rateIndex];
  }

  reverseWarp(): void {
    if (this.direction > 0) {
      this.direction = -1;
      this.rateIndex = 0;
    } else {
      this.rateIndex = Math.min(RATE_STEPS.length - 1, this.rateIndex + 1);
    }
    this.paused = false;
    this.rate = RATE_STEPS[this.rateIndex];
  }

  rateLabel(): string {
    if (this.paused) return _('Duraklatıldı');
    const r = this.rate;
    const sign = this.direction < 0 ? '−' : '';
    const f = (x: number) => (Number.isInteger(x) ? `${x}` : x.toPrecision(3));
    if (r < 60) return `${sign}${f(r)}× (${f(r)} s/s)`;
    if (r < 3600) return sign + perSecond(f(r / 60), 'dk');
    if (r < DAY_S) return sign + perSecond(f(r / 3600), 'sa');
    if (r < DAY_S * 7) return sign + perSecond(f(r / DAY_S), 'gün');
    if (r === DAY_S * 7) return sign + perSecond(1, 'hafta');
    if (r === DAY_S * 30) return sign + perSecond(1, 'ay');
    if (r < DAY_S * 365.25) return sign + perSecond(f(r / DAY_S), 'gün');
    return sign + perSecond(f(r / (DAY_S * 365.25)), 'yıl');
  }

  static dateToJD(d: Date): number {
    return d.getTime() / 86_400_000 + 2_440_587.5;
  }

  static jdToDate(jd: number): Date {
    return new Date((jd - 2_440_587.5) * 86_400_000);
  }

  formatDate(): string {
    const d = this.date;
    if (!Number.isFinite(d.getTime())) return '—';
    const pad = (n: number) => String(n).padStart(2, '0');
    const y = d.getUTCFullYear();
    const yStr = y < 0 ? `${-y} BCE` : String(y).padStart(4, '0');
    return `${yStr}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} UTC`;
  }
}
