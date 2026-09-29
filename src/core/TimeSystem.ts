import { DAY_S, J2000_JD } from './constants';

const RATE_STEPS = [
  1, 2, 5, 10, 30, 60, 300, 900, 3600, 3600 * 6, DAY_S, DAY_S * 3, DAY_S * 7, DAY_S * 30,
  DAY_S * 90, DAY_S * 365.25, DAY_S * 365.25 * 5, DAY_S * 365.25 * 25, DAY_S * 365.25 * 100,
  DAY_S * 365.25 * 1000,
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

  togglePause(): void {
    this.paused = !this.paused;
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
    if (this.paused) return 'Duraklatıldı';
    const r = this.rate;
    const sign = this.direction < 0 ? '−' : '';
    if (r < 60) return `${sign}${r}× (${r} s/s)`;
    if (r < 3600) return `${sign}${r / 60} dk/s`;
    if (r < DAY_S) return `${sign}${r / 3600} sa/s`;
    if (r < DAY_S * 365.25) return `${sign}${(r / DAY_S).toFixed(0)} gün/s`;
    return `${sign}${(r / (DAY_S * 365.25)).toFixed(0)} yıl/s`;
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
