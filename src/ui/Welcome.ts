import { _ } from '../i18n';

/** localStorage flag: the welcome has been seen in this browser */
const KEY = 'yeits.welcomed';
/** flight time of each shot (s) */
const FLIGHT_S = 5;
/** slow sweep around the subject once the shot has arrived (rad/s) */
const DRIFT = 0.012;
/** clock rate on the Saturn page (s/s): the planet turns once in about a minute, the rings stream */
const SATURN_RATE = 600;

/** What the welcome needs from the app: the cinematic shot helpers of the tours and the backdrop */
export interface WelcomeHost {
  camera: { autoOrbit: number };
  time: { rate: number; setRate(rate: number): void };
  engine: { mobile: boolean };
  overlay: { cinematic: boolean };
  hasBody(id: string): boolean;
  goToLimb(bodyId: string, elev: number, az: number, dist: number, aimR: number, aimAz: number, seconds?: number): void;
  goToFramed(refId: string, towardId: string, dist: number, az: number, elev: number, yaw: number, pitch?: number, seconds?: number): void;
  setTourScope(ids: string[] | null): void;
  setTourOverrides(o: { orbits?: boolean }): void;
  showBackdrop(fly: boolean): void;
  settle(frames: number, min?: number): Promise<void>;
}

/** the shots, in page order (the last page is the backdrop) */
const SHOTS = ['saturn', 'moon', 'io', 'sun'] as const;
/** warm-up: at most this many frames at each shot */
const WARM_FRAMES = 40;

/**
 * First-visit introduction: five pages (the product, the data, what to do, who made it and why,
 * support) laid over live shots of the simulation — Saturn over the shoulder, the Earth from
 * behind the Moon, Jupiter rising over Io, the Sun — and back to the circling system at the end.
 * Shown once per browser; `?target=`, `?event=`, the embed and the stream never see it.
 */
export class Welcome {
  private readonly root = document.getElementById('welcome') as HTMLElement;
  private readonly pages = Array.from(this.root.querySelectorAll<HTMLElement>('.welcome-page'));
  private readonly dots = document.getElementById('welcome-dots') as HTMLElement;
  private readonly back = document.getElementById('welcome-back') as HTMLButtonElement;
  private readonly next = document.getElementById('welcome-next') as HTMLButtonElement;
  private page = -1;
  private driftTimer = 0;
  /** the visitor's clock rate, restored when the welcome closes */
  private savedRate = 1;
  private readonly onKey = (e: KeyboardEvent): void => {
    if (this.root.hidden) return;
    if (e.key === 'ArrowRight' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.go(this.page + 1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); this.go(this.page - 1); }
    else if (e.key === 'Escape') { e.preventDefault(); this.finish(); }
    else return;
    // the app's own key handling (flight keys, shortcuts) stays out of it
    e.stopImmediatePropagation();
  };

  constructor(private readonly host: WelcomeHost) {
    this.pages.forEach((_p, i) => {
      const d = document.createElement('span');
      d.className = 'welcome-dot';
      d.addEventListener('click', () => this.go(i));
      this.dots.appendChild(d);
    });
    this.back.addEventListener('click', () => this.go(this.page - 1));
    this.next.addEventListener('click', () => this.go(this.page + 1));
    (document.getElementById('welcome-skip') as HTMLButtonElement).addEventListener('click', () => this.finish());
  }

  /** true when this browser has not been through the welcome yet */
  static get due(): boolean {
    try { return localStorage.getItem(KEY) === null; } catch { return false; }
  }

  /** Mark it seen without showing (returning visitors who arrive by a deep link) */
  static dismiss(): void {
    try { localStorage.setItem(KEY, '1'); } catch { /* ignore */ }
  }

  get open(): boolean { return !this.root.hidden; }

  /**
   * Behind the loading screen: cut to every shot in turn and let a few frames render there, so
   * the planets' shaders compile and their surfaces bake before anyone watches. Ends on the
   * backdrop the first flight departs from.
   */
  async prepare(): Promise<void> {
    const h = this.host;
    if (!h.hasBody('saturn') || !h.hasBody('earth')) return;
    for (const shot of SHOTS) {
      this.shoot(shot, 0.02);
      await h.settle(WARM_FRAMES);
    }
    h.setTourOverrides({});
    h.setTourScope(null);
    h.showBackdrop(false);
    await h.settle(2, 2);
  }

  /** Show the first page and fly to its shot. */
  start(): void {
    if (!this.host.hasBody('saturn') || !this.host.hasBody('earth')) { Welcome.dismiss(); return; }
    this.root.hidden = false;
    this.savedRate = this.host.time.rate;
    document.body.classList.add('welcoming');
    window.addEventListener('keydown', this.onKey, true);
    this.host.overlay.cinematic = true;
    this.host.setTourOverrides({ orbits: false });
    this.go(0);
  }

  private go(i: number): void {
    if (i >= this.pages.length) { this.finish(); return; }
    if (i < 0 || i === this.page) return;
    this.page = i;
    this.pages.forEach((p, k) => { p.hidden = k !== i; });
    Array.from(this.dots.children).forEach((d, k) => d.classList.toggle('on', k === i));
    this.back.disabled = i === 0;
    const last = i === this.pages.length - 1;
    (this.next.firstElementChild as HTMLElement).textContent = last ? _('Keşfe başla') : _('Devam');
    this.next.classList.toggle('go', last);
    // page content fades in anew
    const p = this.pages[i];
    p.classList.remove('in');
    void p.offsetWidth;
    p.classList.add('in');
    this.shoot(p.dataset.shot ?? '');
  }

  /** The live shot behind a page (`seconds`: flight time; the warm-up cuts) */
  private shoot(shot: string, seconds = FLIGHT_S): void {
    const h = this.host;
    window.clearTimeout(this.driftTimer);
    h.camera.autoOrbit = 0;
    // wide screens: the panel is on the left, the subject sits right of centre (yaw); narrow
    // (portrait) screens: the panel is at the bottom, the subject smaller and above the centre
    const narrow = window.innerWidth < window.innerHeight;
    // Saturn spins under a fixed camera; everywhere else the clock runs as the visitor had it
    if (this.open) h.time.setRate(shot === 'saturn' ? SATURN_RATE : this.savedRate);
    const framed = (ref: string, toward: string, dist: number, az: number, elev: number, yaw: number): void =>
      h.goToFramed(ref, toward, narrow ? dist * 1.6 : dist, az, elev, narrow ? 0 : yaw, narrow ? 11 : 0, seconds);
    switch (shot) {
      case 'saturn':
        // over the shoulder, the rings sweeping away toward the Sun (the tours' Saturn shot)
        h.goToLimb('saturn', 12, 30, 1.6, 1.9, 80, seconds);
        break;
      case 'moon':
        // earthrise: the far side of the Moon in the foreground, the Earth a marble beside it
        if (h.hasBody('moon')) framed('moon', 'earth', 4, -20, 6, 15);
        else framed('earth', 'sun', 4, 150, 12, 15);
        break;
      case 'io':
        // Io, plumes on its limb, Jupiter hanging behind
        if (h.hasBody('io') && h.hasBody('jupiter')) framed('io', 'jupiter', 6, -14, 12, 9);
        else if (h.hasBody('mars')) framed('mars', 'sun', 4, 150, 10, 15);
        break;
      case 'sun':
        framed('sun', 'earth', 5, 180, 12, 15);
        break;
      case 'system':
        h.setTourOverrides({});
        h.setTourScope(null);
        h.showBackdrop(true);
        return;
    }
    h.setTourOverrides({ orbits: false });
    h.setTourScope([]);
    // once there, a slow sweep keeps the picture alive while the visitor reads
    if (!this.open) return;
    const page = this.page;
    this.driftTimer = window.setTimeout(() => { if (this.page === page && this.open) h.camera.autoOrbit = DRIFT; }, seconds * 1000 + 200);
  }

  /** Close for good: the flag is set, the app is handed back on the circling backdrop. */
  finish(): void {
    if (this.root.hidden) return;
    Welcome.dismiss();
    window.clearTimeout(this.driftTimer);
    window.removeEventListener('keydown', this.onKey, true);
    this.root.hidden = true;
    document.body.classList.remove('welcoming');
    const h = this.host;
    h.overlay.cinematic = false;
    h.time.setRate(this.savedRate);
    h.setTourOverrides({});
    h.setTourScope(null);
    // the last page already pulled back to the system; from any other page, fly there now
    if (this.pages[this.page]?.dataset.shot !== 'system') h.showBackdrop(true);
    this.page = -1;
  }
}
