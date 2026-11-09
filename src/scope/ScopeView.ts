/**
 * The telescope view widget: an object (ScopeTarget) seen from the ground through a chosen
 * instrument, with the atmosphere, the optics and the eye in between. Mounted by the simulation's
 * info card and by the encyclopedia pages (src/scope/wiki.ts).
 */
import { ENC, ScopeGL, type FrameParams } from './gl';
import { jdOf, solarGeometry, type SolarGeo } from './ephem';
import { INSTRUMENTS, SKY_MU, airmass, instrument, limitingMag, magRange, type Instrument } from './instruments';
import { buildScene, type Images, type Note, type Raster, type Scene } from './scene';
import type { ScopeDeep, ScopeStrings, ScopeTarget } from './types';

const SEC = 206_264.806;
const STORE = 'yeits.scope.v1';
const SEEING = [0.6, 1.2, 2, 3.5];
const SEEING_KEY = ['s06', 's12', 's20', 's35'];

export interface ScopeOptions {
  /** Julian date of the view (the simulation's clock); now when absent */
  jd?: number;
  /** a narrow host (the info card): fewer readouts */
  compact?: boolean;
  /** prefix of asset urls (images) */
  base?: string;
  lang?: string;
}

interface Settings { ins: string; alt: number; seeing: number; bortle: number }

const rasterCache = new Map<string, Promise<Raster | null>>();
function loadRaster(url: string): Promise<Raster | null> {
  let p = rasterCache.get(url);
  if (!p) {
    p = new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = img.naturalWidth; c.height = img.naturalHeight;
        const ctx = c.getContext('2d', { willReadFrequently: true });
        if (!ctx) { resolve(null); return; }
        ctx.drawImage(img, 0, 0);
        resolve({ w: c.width, h: c.height, data: ctx.getImageData(0, 0, c.width, c.height).data });
      };
      img.onerror = () => resolve(null);
      img.src = url;
    });
    rasterCache.set(url, p);
  }
  return p;
}

function loadSettings(): Partial<Settings> {
  try { return JSON.parse(localStorage.getItem(STORE) ?? '{}') as Partial<Settings>; } catch { return {}; }
}

const fmtNum = (x: number, d: number, lang: string) => x.toLocaleString(lang, { minimumFractionDigits: d, maximumFractionDigits: d });
function fmtAngle(a: number, lang: string): string {
  if (a >= 3600) return `${fmtNum(a / 3600, a >= 36000 ? 0 : 1, lang)}°`;
  if (a >= 60) return `${fmtNum(a / 60, a >= 600 ? 0 : 1, lang)}′`;
  if (a >= 1) return `${fmtNum(a, a >= 10 ? 0 : 1, lang)}″`;
  if (a >= 1e-3) return `${fmtNum(a * 1000, a >= 0.01 ? 0 : 1, lang)} mas`;
  return `${fmtNum(a * 1e6, 0, lang)} µas`;
}
const tpl = (s: string, p: Record<string, string | number>) => Object.keys(p).reduce((o, k) => o.split(`{${k}}`).join(String(p[k])), s);

const smooth = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export class ScopeView {
  readonly el: HTMLElement;
  private gl: ScopeGL | null = null;
  private canvas = document.createElement('canvas');
  private overlay = document.createElement('canvas');
  private stage = document.createElement('div');
  private readout = document.createElement('div');
  private notesEl = document.createElement('ul');
  private caption = document.createElement('p');
  private insSel = document.createElement('select');
  private zoom = document.createElement('input');
  private zoomVal = document.createElement('span');
  private zoomName = document.createElement('span');
  private altIn = document.createElement('input');
  private altVal = document.createElement('span');
  private seeSel = document.createElement('select');
  private skySel = document.createElement('select');
  private skyWrap!: HTMLElement;
  private ins: Instrument;
  private M = 100;
  /** visual only: how much closer than the whole field stop the picture is shown */
  private crop = 1;
  private field = 60;
  private alt: number;
  private seeing: number;
  private bortle: number;
  private jd: number;
  private geo: SolarGeo | null = null;
  private scene: Scene | null = null;
  private images: Images = new Map();
  private W = 0;
  private H = 0;
  private scale = 1;
  private raf = 0;
  private dirty = true;
  private visible = false;
  private tilt: [number, number] = [0, 0];
  private last = 0;
  private io: IntersectionObserver;
  private ro: ResizeObserver;
  private lang: string;
  private destroyed = false;

  constructor(host: HTMLElement, private target: ScopeTarget, private T: ScopeStrings, private opts: ScopeOptions = {}) {
    this.el = host;
    this.lang = opts.lang ?? document.documentElement.lang ?? 'en';
    this.jd = opts.jd ?? jdOf(Date.now());
    const s = loadSettings();
    this.alt = s.alt ?? 45;
    this.seeing = s.seeing ?? 2;
    this.bortle = s.bortle ?? 4;
    this.geo = target.kind === 'solar' ? solarGeometry(target, this.jd) : null;
    // the observer's own telescope carries over between objects; the big ones are picked per object
    const remembered = s.ins ? INSTRUMENTS.find((i) => i.id === s.ins && i.group === 'amateur') : undefined;
    this.ins = !this.deep?.prefer && remembered && this.shows(remembered) ? remembered : this.defaultInstrument();
    this.resetZoom();
    const p = target.kind === 'solar' ? target.primary.id : '';
    if (p && p !== 'sun' && p !== 'moon') this.crop = 3;
    this.build();
    this.stage.classList.toggle('close', this.crop > 1);
    try { this.gl = new ScopeGL(this.canvas); } catch { this.fail(); }
    this.io = new IntersectionObserver((e) => { this.visible = e.some((x) => x.isIntersecting); if (this.visible) this.kick(); });
    this.io.observe(this.stage);
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(this.stage);
    document.addEventListener('visibilitychange', this.onVis);
    void this.loadImages();
  }

  /* ---------------- the object ---------------- */

  private get deep(): ScopeDeep | null { return this.target.kind === 'solar' ? null : this.target; }

  private objMag(): number { return this.geo ? this.geo.mag : this.deep!.mag; }

  /** angular size, arcsec */
  private objSize(): number {
    if (this.geo) {
      const t = this.target;
      if (t.kind === 'solar' && t.target !== t.primary.id) return this.geo.moons.find((m) => m.id === t.target)?.diam ?? 1;
      return this.geo.diam * (t.kind === 'solar' && t.primary.rings ? 2.3 : 1);
    }
    return this.deep!.size;
  }

  private targetMag(): number {
    const t = this.target;
    if (t.kind === 'solar' && this.geo && t.target !== t.primary.id) return this.geo.moons.find((m) => m.id === t.target)?.mag ?? this.geo.mag;
    return this.objMag();
  }

  private shows(ins: Instrument): boolean {
    if (ins.mode !== 'visual') return true;
    const d = this.deep;
    if (d?.special === 'sgra') return false;
    const ext = airmass(this.alt) * 0.2;
    const lim = limitingMag(ins, this.bortle, ext, magRange(ins)[1] * 0.5);
    const size = this.objSize();
    // extended light is harder to see than a star of the same magnitude
    const penalty = d && size > 30 && d.kind !== 'open' ? Math.min(3, 1.2 * Math.log10(size / 30) + 0.6) : 0;
    return this.targetMag() + penalty <= lim;
  }

  private defaultInstrument(): Instrument {
    const t = this.target;
    const d = this.deep;
    if (d?.prefer) return instrument(d.prefer);
    if (d?.special === 'sgra') return instrument('vla');
    if (t.kind === 'solar') {
      const id = t.primary.id;
      if (id === 'sun' || id === 'moon') return instrument('apo100');
      if (['mercury', 'venus', 'mars', 'jupiter', 'saturn'].includes(id)) return instrument('sct203');
    }
    if (d && d.size > 3 * 3600) return instrument('bino');
    const order = ['ach70', 'apo100', 'mak127', 'sct203', 'dob305', 'dob406', 'hale'];
    if (d?.kind === 'star' && d.mag < 9) return instrument('apo100');
    for (const id of order) if (this.shows(instrument(id))) return instrument(id);
    return instrument('hale');
  }

  /** magnification / field that frames the object */
  private resetZoom(): void {
    const ins = this.ins;
    const size = Math.max(this.objSize(), 1e-6);
    if (ins.mode === 'visual') {
      const [lo, hi] = magRange(ins);
      const t = this.target;
      const span = ins.afov! * 3600;
      let want: number;
      if (this.deep?.kind === 'star' || this.deep?.kind === 'pulsar') want = ins.D * 1.4;
      else if (t.kind === 'solar' && (t.primary.id === 'sun' || t.primary.id === 'moon')) want = (span * 0.75) / size;
      else if (t.kind === 'solar') want = Math.max(ins.D * 1.2, (span * 0.18) / size);
      // deep sky: no smaller exit pupil than ~2 mm (1 mm for small bright planetaries and globulars)
      else want = Math.min((span * 0.45) / size, ins.D / (this.deep?.kind === 'pn' || this.deep?.kind === 'globular' ? 1 : 2));
      this.M = Math.round(Math.max(lo, Math.min(hi, want)));
    } else {
      const [lo, hi] = this.fieldRange();
      const t = this.target;
      let want = size * 1.7;
      if (t.kind === 'solar' && t.target !== t.primary.id && this.geo) want = Math.max(want, Math.hypot(...this.geo.center) * 2.6);
      if (this.deep?.kind === 'star' || this.deep?.kind === 'pulsar') want = ins.mode === 'radio' ? ins.beam! * 12 : 30;
      // the EHT looks at the shadow, not at the host galaxy
      if (ins.id === 'eht') want = 160e-6;
      this.field = Math.max(lo, Math.min(hi, want));
    }
  }

  private fieldRange(): [number, number] {
    const ins = this.ins;
    if (ins.mode === 'radio') return [ins.beam! * 5, ins.beam! * (ins.id === 'eht' ? 40 : 500)];
    return ins.id === 'hale' ? [6, 1200] : [1.5, 60];
  }

  /* ---------------- DOM ---------------- */

  private build(): void {
    const T = this.T;
    const el = this.el;
    el.classList.add('scope');
    if (this.opts.compact) el.classList.add('scope-compact');
    this.stage.className = 'scope-stage';
    // a closer look at the middle of the eyepiece: the screen is far coarser than the eye
    this.stage.addEventListener('click', () => {
      if (this.ins.mode !== 'visual') return;
      this.crop = this.crop > 1 ? 1 : 3;
      this.stage.classList.toggle('close', this.crop > 1);
      this.rebuild();
    });
    this.canvas.className = 'scope-gl';
    this.overlay.className = 'scope-ov';
    this.stage.append(this.canvas, this.overlay);
    const ctl = document.createElement('div');
    ctl.className = 'scope-ctl';
    const row = (label: string, ...kids: HTMLElement[]) => {
      const l = document.createElement('label');
      const n = document.createElement('span');
      n.className = 'n';
      n.textContent = label;
      l.append(n, ...kids);
      return l;
    };
    // instruments, grouped
    for (const [g, key] of [['amateur', 'gAmateur'], ['research', 'gResearch'], ['radio', 'gRadio']] as const) {
      const og = document.createElement('optgroup');
      og.label = T[key];
      for (const i of INSTRUMENTS.filter((x) => x.group === g)) {
        const o = document.createElement('option');
        o.value = i.id;
        o.textContent = T[i.label] ?? i.id;
        og.append(o);
      }
      this.insSel.append(og);
    }
    this.insSel.value = this.ins.id;
    this.insSel.addEventListener('change', () => {
      this.ins = instrument(this.insSel.value);
      this.save();
      this.resetZoom();
      this.syncControls();
      this.rebuild();
    });
    this.zoom.type = 'range';
    this.zoom.addEventListener('input', () => {
      const v = +this.zoom.value;
      if (this.ins.mode === 'visual') this.M = Math.round(10 ** v);
      else this.field = 10 ** v;
      this.zoomText();
      this.rebuild();
    });
    this.zoomVal.className = 'v';
    this.altIn.type = 'range';
    Object.assign(this.altIn, { min: 5, max: 90, step: 1 });
    this.altIn.value = String(this.alt);
    this.altVal.className = 'v';
    this.altIn.addEventListener('input', () => {
      this.alt = +this.altIn.value;
      this.altVal.textContent = `${this.alt}°`;
      this.save();
      this.rebuild();
    });
    this.altVal.textContent = `${this.alt}°`;
    SEEING.forEach((s, k) => {
      const o = document.createElement('option');
      o.value = String(s);
      o.textContent = T[SEEING_KEY[k]];
      this.seeSel.append(o);
    });
    this.seeSel.value = String(this.seeing);
    this.seeSel.addEventListener('change', () => { this.seeing = +this.seeSel.value; this.save(); this.rebuild(); });
    for (let b = 1; b <= 9; b++) {
      const o = document.createElement('option');
      o.value = String(b);
      const d = b === 1 ? T.b1 : b === 4 ? T.b4 : b === 6 ? T.b6 : b === 9 ? T.b9 : '';
      o.textContent = tpl(T.bortle, { n: b }) + (d ? ` · ${d}` : '');
      this.skySel.append(o);
    }
    this.skySel.value = String(this.bortle);
    this.skySel.addEventListener('change', () => { this.bortle = +this.skySel.value; this.save(); this.rebuild(); });

    const zoomRow = row('', this.zoom, this.zoomVal);
    zoomRow.classList.add('wide');
    zoomRow.querySelector('.n')!.replaceWith(this.zoomName);
    this.zoomName.className = 'n';
    const altRow = row(T.alt, this.altIn, this.altVal);
    altRow.classList.add('wide');
    this.skyWrap = row(T.sky, this.skySel);
    ctl.append(row(T.ins, this.insSel), zoomRow, altRow, row(T.seeing, this.seeSel), this.skyWrap);
    this.readout.className = 'scope-ro';
    this.notesEl.className = 'scope-notes';
    this.caption.className = 'scope-cap';
    el.replaceChildren(this.stage, ctl, this.readout, this.notesEl, this.caption);
    this.syncControls();
  }

  private syncControls(): void {
    const ins = this.ins;
    this.insSel.value = ins.id;
    if (ins.mode === 'visual') {
      const [lo, hi] = magRange(ins);
      this.zoomName.textContent = this.T.mag;
      Object.assign(this.zoom, { min: Math.log10(lo), max: Math.log10(hi), step: 0.005 });
      this.zoom.value = String(Math.log10(this.M));
      this.zoom.disabled = lo === hi;
    } else {
      const [lo, hi] = this.fieldRange();
      this.zoomName.textContent = this.T.field;
      Object.assign(this.zoom, { min: Math.log10(lo), max: Math.log10(hi), step: 0.005 });
      this.zoom.value = String(Math.log10(this.field));
      this.zoom.disabled = false;
    }
    this.skyWrap.hidden = ins.mode !== 'visual';
    this.altIn.disabled = ins.mode === 'radio';
    this.seeSel.disabled = ins.mode === 'radio';
    this.zoomText();
  }

  private zoomText(): void {
    this.zoomVal.textContent = this.ins.mode === 'visual' ? `${this.M}×` : fmtAngle(this.field, this.lang);
  }

  private save(): void {
    try { localStorage.setItem(STORE, JSON.stringify({ ins: this.ins.id, alt: this.alt, seeing: this.seeing, bortle: this.bortle })); } catch { /* private mode */ }
  }

  private fail(): void {
    const p = document.createElement('p');
    p.className = 'scope-fail';
    p.textContent = this.T.noGl;
    this.stage.replaceChildren(p);
  }

  private async loadImages(): Promise<void> {
    const base = this.opts.base ?? '';
    const want: Array<[string, string]> = [];
    const t = this.target;
    if (t.kind === 'solar') {
      if (t.primary.look === 'moon') want.push(['moon', `${base}/scope/moon.jpg`]);
      if (t.primary.look === 'mars') want.push(['mars', `${base}/scope/mars.jpg`]);
    } else if (t.img) want.push([t.img, `${base}${t.img}`]);
    if (!want.length) return;
    const got = await Promise.all(want.map(([, u]) => loadRaster(u)));
    if (this.destroyed) return;
    want.forEach(([k], i) => { const r = got[i]; if (r) this.images.set(k, r); });
    this.rebuild();
  }

  /* ---------------- sizing and the loop ---------------- */

  private resize(): void {
    const w = this.stage.clientWidth;
    if (!w) return;
    const h = Math.round(this.opts.compact ? w * 0.86 : Math.min(w * 0.72, 500));
    this.stage.style.height = `${h}px`;
    const dpr = Math.min(window.devicePixelRatio || 1, this.opts.compact ? 1.5 : 1.25);
    const W = Math.min(1000, Math.round(w * dpr)), H = Math.min(640, Math.round(h * dpr));
    this.canvas.width = W; this.canvas.height = H;
    const od = Math.min(window.devicePixelRatio || 1, 2);
    this.overlay.width = Math.round(w * od); this.overlay.height = Math.round(h * od);
    this.overlay.getContext('2d')!.setTransform(od, 0, 0, od, 0, 0);
    if (W !== this.W || H !== this.H) { this.W = W; this.H = H; this.rebuild(); }
    else this.drawOverlay();
  }

  private onVis = () => { if (!document.hidden) this.kick(); };

  private kick(): void {
    if (!this.raf && !this.destroyed) this.raf = requestAnimationFrame(this.frame);
  }

  private rebuild(): void {
    this.dirty = true;
    this.kick();
  }

  setJd(jd: number): void {
    if (this.target.kind !== 'solar' || Math.abs(jd - this.jd) < 1 / 1440) return;
    this.jd = jd;
    this.geo = solarGeometry(this.target, jd);
    this.rebuild();
  }

  private frame = (now: number) => {
    this.raf = 0;
    if (this.destroyed || !this.gl || !this.W) return;
    const dt = Math.min(0.1, this.last ? (now - this.last) / 1000 : 0.016);
    this.last = now;
    if (this.dirty) { this.dirty = false; this.compose(); }
    const f = this.params(now / 1000, dt);
    if (this.scene) this.gl.draw(f, this.skyY);
    if (this.visible && !document.hidden && this.ins.mode === 'visual') this.raf = requestAnimationFrame(this.frame);
  };

  private skyY = 1e-9;

  /* ---------------- physics ---------------- */

  private get extinction(): number { return airmass(this.alt) * 0.2; }

  private lim(): number { return limitingMag(this.ins, this.bortle, this.extinction, this.M); }

  /** the new picture of the sky above the atmosphere */
  private compose(): void {
    const ins = this.ins;
    const visual = ins.mode === 'visual';
    if (visual) this.scale = ((ins.id === 'eye' ? ins.afov! : ins.afov! / this.M) * 3600) / (0.96 * Math.min(this.W, this.H) * this.crop);
    else this.scale = this.field / this.H;
    const lim = ins.mode === 'radio' ? 0 : this.lim();
    this.scene = buildScene({
      target: this.target, geo: this.geo, ins, W: this.W, H: this.H, scale: this.scale, lim,
      images: this.images, jd: this.jd, visual,
    });
    const sc = this.scene;
    // radio maps are normalised to their own peak, and would overflow half floats at ENC
    if (ins.mode !== 'radio') for (let k = 0; k < sc.sky.length; k++) sc.sky[k] *= ENC;
    for (let k = 0; k < sc.nStars; k++) sc.stars[k * 8 + 2] *= ENC;
    sc.peak *= ENC;
    this.gl!.setScene(this.W, this.H, sc.sky, sc.stars, sc.nStars);
    this.renderText();
  }

  private params(time: number, dt: number): FrameParams {
    const ins = this.ins;
    const sc = this.scene!;
    const X = airmass(this.alt);
    const z = (90 - this.alt) * Math.PI / 180;
    const tanz = Math.min(5, Math.tan(z));
    const ext = [0.11, 0.19, 0.31].map((k) => 10 ** (-0.4 * k * X)) as [number, number, number];
    const D = ins.D / 1000;
    const lam = ins.lambda ?? 550e-9;
    const lamD = (SEC * lam) / D;
    const lamD3: [number, number, number] = ins.mode === 'visual' ? [lamD * 610 / 550, lamD, lamD * 460 / 550] : [lamD, lamD, lamD];
    const fwhmV = this.seeing * X ** 0.6;
    const fwhm = fwhmV * (lam / 550e-9) ** -0.2;
    const r0 = (0.98 * lam) / (fwhm / SEC);
    const f: FrameParams = {
      mode: 0, time, scale: this.scale, tilt: [0, 0], boil: 0, iso: 1, sigma: [1, 1, 1], disp: [0, 0, 0], ext, las: 0,
      jit: 0, scint: 0, colorTw: 0, lamD: lamD3, obs: ins.obstruction, strehl: 0, sigSe: 1, speck: 0,
      haloA: fwhm * 1.3, haloW: 0.05, spikes: ins.spikes, spikeAng: ins.spikes === 6 ? 0 : Math.PI / 4,
      flip: [1, 1], sky: [0, 0, 0], gain: 1, k: 1, stop: 0, noise: 0, soft: 1, white: 1, mono: 0,
    };
    if (ins.mode === 'radio') {
      f.mode = 2;
      const b = ins.beam! / 2.355;
      f.sigma = [b, b, b];
      f.las = ins.las ? ins.las / 2.355 : 0;
      f.ext = [1, 1, 1];
      const peak = sc.radioPeak;
      f.white = peak > 0 ? peak * 1.05 : 1;
      f.noise = peak > 0 ? 0.012 : 0.22;
      // stretched to show lobes beside a core; the EHT's ring is shown linear, its shadow open
      f.soft = ins.id === 'eht' ? 1 : 0.04;
      this.skyY = 1;
      return f;
    }
    if (ins.mode === 'detector') {
      f.mode = 1;
      const ao = ins.strehl !== undefined;
      f.strehl = ao ? ins.strehl! : 0;
      f.sigSe = ao ? (fwhm * 0.8) / 2.355 : Math.hypot(fwhm / 2.355, 0.42 * lamD);
      const s = ao ? Math.hypot(0.42 * lamD, 0.6 * this.scale, fwhm * 0.12) : f.sigSe;
      f.sigma = [s, s, s];
      f.haloW = ao ? 0.08 : 0.04;
      if (ao) f.ext = [0.93, 0.93, 0.93];
      f.mono = ao ? 1 : 0;
      // noise: a star at the exposure's limit stands 4σ above it
      const core = Math.max(ao ? 0.42 * lamD : f.sigSe, 0.6 * this.scale);
      const fl = 10 ** (-0.4 * (ins.limit ?? 23)) * ENC;
      const peakLim = (fl / (2 * Math.PI * core * core)) * (ao ? Math.max(0.2, f.strehl) : 1);
      f.noise = peakLim / 4;
      f.soft = f.noise * 3;
      const ft = 10 ** (-0.4 * this.targetMag()) * ENC;
      const starPeak = this.deep?.kind === 'star' || this.deep?.kind === 'pulsar' ? (ft / (2 * Math.PI * core * core)) * 0.5 : 0;
      f.white = Math.max(sc.peak * 0.8, starPeak, f.noise * 60);
      // a display stretch, not a log of everything: ~3000:1 below white at most
      f.soft = Math.max(f.soft, f.white * 3e-4);
      this.skyY = f.noise * 2;
      return f;
    }
    // visual
    const flip = ins.orient === 'inverted' ? [-1, -1] : ins.orient === 'mirrored' ? [-1, 1] : [1, 1];
    f.flip = flip as [number, number];
    const M = ins.id === 'eye' ? 1 : this.M;
    const sTilt = 0.42 * lamD * (D / r0) ** (5 / 6);
    const fwhmSe = D > r0 ? fwhm * Math.sqrt(Math.max(0, 1 - (r0 / D) ** (1 / 3))) : 0;
    f.strehl = Math.exp(-0.134 * (D / r0) ** (5 / 3));
    f.sigSe = Math.max(fwhmSe / 2.355, 0.42 * lamD);
    const eye = (ins.id === 'eye' ? 60 : 60 / M) / 2.355;
    const chroma = ins.chroma ?? 0;
    const base = (l: number, extra: number) => Math.sqrt((fwhmSe / 2.355) ** 2 + (0.42 * l) ** 2 + eye * eye + extra * extra + (0.45 * this.scale) ** 2);
    f.sigma = [base(lamD3[0], chroma * 0.45), base(lamD3[1], chroma * 0.1), base(lamD3[2], chroma)];
    // image motion: an Ornstein–Uhlenbeck walk with the eye's ~0.1 s memory
    const tau = 0.09;
    for (const k of [0, 1] as const) {
      const g = Math.sqrt(-2 * Math.log(Math.max(1e-9, Math.random()))) * Math.cos(2 * Math.PI * Math.random());
      this.tilt[k] += (-this.tilt[k] / tau) * dt + sTilt * Math.sqrt((2 * dt) / tau) * g;
    }
    f.tilt = [this.tilt[0], this.tilt[1]];
    f.boil = sTilt * 0.55 + fwhmSe * 0.12;
    const theta0 = (0.314 * r0 / 5000) * SEC;
    f.iso = Math.max(theta0 * 4, this.scale * 3);
    f.jit = sTilt * 0.5;
    f.speck = D > 2 * r0 && f.sigSe / this.scale > 2.5 ? 0.7 : 0;
    f.scint = Math.min(0.65, 0.09 * (D * 100) ** (-2 / 3) * X ** 1.75);
    f.colorTw = smooth(38, 10, this.alt) * (D < 0.15 ? 1 : 0.35);
    f.disp = [-0.4 * tanz, 0, 0.55 * tanz];
    f.haloA = fwhm * 1.3;
    f.haloW = 0.06;
    const sun = this.target.kind === 'solar' && this.target.primary.id === 'sun';
    const mu = sun ? 30 : SKY_MU[this.bortle - 1] - 2.5 * Math.log10(1 + 0.25 * (X - 1));
    const b = (this.bortle - 1) / 8;
    const tint = [0.86 + 0.36 * b, 0.97, 1.16 - 0.4 * b];
    const ty = 0.2126 * tint[0] + 0.7152 * tint[1] + 0.0722 * tint[2];
    const sky = 10 ** (-0.4 * mu) * ENC;
    f.sky = [sky * tint[0] / ty, sky * tint[1] / ty, sky * tint[2] / ty];
    const exit = ins.D / M;
    f.gain = ins.id === 'eye' ? 1 : 0.88 * Math.min(1, (exit / 7) ** 2);
    this.skyY = sky;
    const ys = sky * f.gain;
    // the eye adapts down to about a dark rural sky seen through a wide exit pupil, no further
    f.k = Math.max(ys * 9, 10 ** (-0.4 * 21.5) * ENC * 9, sc.peak * f.gain * 0.32);
    f.stop = 0.48 * Math.min(this.W, this.H) * this.crop;
    return f;
  }

  /* ---------------- text: readout, notes, caption, overlay ---------------- */

  private renderText(): void {
    const T = this.T, ins = this.ins, L = this.lang;
    const rows: Array<[string, string]> = [];
    const D = ins.D / 1000;
    if (ins.mode === 'visual') {
      const M = ins.id === 'eye' ? 1 : this.M;
      rows.push([T.rTfov, fmtAngle((ins.id === 'eye' ? ins.afov! : ins.afov! / M) * 3600, L)]);
      if (ins.id !== 'eye') rows.push([T.rExit, `${fmtNum(ins.D / M, 1, L)} mm`]);
      rows.push([T.rRes, fmtAngle(Math.max(116 / ins.D, 60 / M), L)]);
      rows.push([T.rLim, fmtNum(this.lim(), 1, L)]);
    } else if (ins.mode === 'detector') {
      rows.push([T.rTfov, fmtAngle(this.field, L)]);
      rows.push([T.rRes, fmtAngle(ins.strehl ? 1.22 * SEC * ins.lambda! / D : this.seeing * airmass(this.alt) ** 0.6, L)]);
      rows.push([T.rLim, fmtNum(this.lim(), 1, L)]);
    } else {
      rows.push([T.rTfov, fmtAngle(this.field, L)]);
      rows.push([T.rBeam, fmtAngle(ins.beam!, L)]);
      if (ins.las) rows.push([T.rLas, fmtAngle(ins.las, L)]);
    }
    if (this.targetMag() < 40) rows.push([T.rBright, fmtNum(this.targetMag(), 1, L)]);
    const size = this.objSize();
    if (size > 0) rows.push([T.rSize, fmtAngle(size, L)]);
    if (this.geo && this.target.kind === 'solar' && this.target.primary.id !== 'sun') {
      const lit = fmtNum(50 * (1 + Math.cos(this.geo.phase * Math.PI / 180)), 0, L);
      rows.push([T.rLit, L === 'tr' ? `%${lit}` : `${lit} %`]);
    }
    this.readout.replaceChildren(...rows.slice(0, this.opts.compact ? 6 : 8).map(([k, v]) => {
      const d = document.createElement('div');
      const a = document.createElement('span'), b = document.createElement('span');
      a.textContent = k; b.textContent = v; b.className = 'v';
      d.append(a, b);
      return d;
    }));
    // notes
    const notes: Note[] = [...(this.scene?.notes ?? [])];
    if (ins.mode === 'visual' && !this.shows(ins) && this.deep?.special !== 'sgra') notes.unshift(['nFaint', { m: fmtNum(this.targetMag(), 1, L), l: fmtNum(this.lim(), 1, L) }]);
    if (ins.mode === 'detector' && ins.strehl) notes.push(['nAo']);
    if (ins.mode === 'radio' && ins.las && size > ins.las * 1.5) notes.push(['nLas', { las: fmtAngle(ins.las, L) }]);
    if (ins.mode === 'radio' && size > 0 && size < ins.beam! * 0.6 && !notes.some(([k]) => k === 'nEht' || k === 'nRadioDark')) notes.push(['nBeam']);
    if (ins.mode !== 'radio' && this.target.kind !== 'solar') notes.push(['nField']);
    const seen = new Set<string>();
    this.notesEl.replaceChildren(...notes.filter(([k]) => !seen.has(k) && seen.add(k)).map(([k, p]) => {
      const li = document.createElement('li');
      li.textContent = tpl(T[k] ?? k, p ?? {});
      return li;
    }));
    this.notesEl.hidden = !this.notesEl.childElementCount;
    const orient = ins.orient === 'inverted' ? T.oInverted : ins.orient === 'mirrored' ? T.oMirrored : T.oUpright;
    this.caption.textContent = ins.mode === 'visual' ? `${T.capVisual} ${orient} ${this.crop > 1 ? T.hWhole : T.hClose}` : ins.mode === 'detector' ? T.capDetector : T.capRadio;
    this.drawOverlay();
  }

  private drawOverlay(): void {
    const c = this.overlay.getContext('2d')!;
    const w = this.stage.clientWidth, h = this.stage.clientHeight;
    c.clearRect(0, 0, w, h);
    if (!this.scene) return;
    const ins = this.ins;
    const flip = ins.mode === 'visual' ? (ins.orient === 'inverted' ? [-1, -1] : ins.orient === 'mirrored' ? [-1, 1] : [1, 1]) : [1, 1];
    const pxArc = (this.scale * this.W) / w; // arcsec per css px
    c.font = '10.5px -apple-system, system-ui, sans-serif';
    c.textBaseline = 'middle';
    // compass, lower right
    const ox = w - 30, oy = h - 30, len = 16;
    c.strokeStyle = 'rgba(189, 155, 108, 0.8)';
    c.fillStyle = 'rgba(189, 155, 108, 0.9)';
    c.lineWidth = 1.2;
    const arrow = (dx: number, dy: number, label: string) => {
      c.beginPath(); c.moveTo(ox, oy); c.lineTo(ox + dx * len, oy + dy * len); c.stroke();
      c.textAlign = 'center';
      c.fillText(label, ox + dx * (len + 8), oy + dy * (len + 8));
    };
    arrow(0, -flip[1], this.T.north);
    arrow(-flip[0], 0, this.T.east);
    // scale bar, lower left (radio: the beam above it)
    const nice = (x: number) => { const p = 10 ** Math.floor(Math.log10(x)); const f = x / p; return (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * p; };
    const units = [1e-6, 1e-3, 1, 60, 3600];
    const target = pxArc * w * 0.18;
    let unit = 1;
    for (const u of units) if (target >= u) unit = u;
    const val = nice(target / unit) * unit;
    const bar = val / pxArc;
    const bx = 14, by = h - 16;
    c.strokeStyle = 'rgba(228, 228, 222, 0.7)';
    c.beginPath(); c.moveTo(bx, by); c.lineTo(bx + bar, by); c.moveTo(bx, by - 3); c.lineTo(bx, by + 3); c.moveTo(bx + bar, by - 3); c.lineTo(bx + bar, by + 3); c.stroke();
    c.fillStyle = 'rgba(228, 228, 222, 0.8)';
    c.textAlign = 'left';
    c.fillText(fmtAngle(val, this.lang), bx + bar + 6, by);
    if (ins.mode === 'radio') {
      const r = ins.beam! / pxArc / 2;
      if (r > 1.5 && r < h / 3) {
        c.strokeStyle = 'rgba(228, 228, 222, 0.7)';
        c.beginPath(); c.arc(bx + r, by - 14 - r, r, 0, Math.PI * 2); c.stroke();
      }
    }
    // moons by name
    if (this.geo && this.target.kind === 'solar') {
      const cx = -this.geo.center[0], cy = -this.geo.center[1];
      c.fillStyle = 'rgba(138, 146, 156, 0.95)';
      c.textAlign = 'left';
      const placed: Array<[number, number, number, number]> = [];
      const free = (x0: number, y0: number, x1: number, y1: number) => placed.every(([a, b, cc, d]) => x1 < a || x0 > cc || y1 < b || y0 > d);
      for (const m of this.geo.moons) {
        if (m.hidden) continue;
        const x = w / 2 + flip[0] * (cx + m.x) / pxArc, y = h / 2 - flip[1] * (cy + m.y) / pxArc;
        if (x < 8 || x > w - 50 || y < 8 || y > h - 8) continue;
        if (Math.hypot(x - w / 2 - flip[0] * cx / pxArc, y - h / 2 + flip[1] * cy / pxArc) < (this.geo.diam / 2) / pxArc + 10) continue;
        if (ins.mode === 'visual' && Math.hypot(x - w / 2, y - h / 2) > 0.48 * Math.min(w, h) * this.crop - 6) continue;
        // close moons: stack the names instead of overprinting them
        const tw = c.measureText(m.name).width;
        const dy = [-8, 10, -20, 22, -32, 34].find((d) => free(x + 6, y + d - 6, x + 6 + tw, y + d + 6));
        if (dy === undefined) continue;
        placed.push([x + 6, y + dy - 6, x + 6 + tw, y + dy + 6]);
        c.fillText(m.name, x + 6, y + dy);
      }
    }
  }

  destroy(): void {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    this.io.disconnect();
    this.ro.disconnect();
    document.removeEventListener('visibilitychange', this.onVis);
    this.gl?.dispose();
    this.gl = null;
    this.el.replaceChildren();
  }
}

export function mountScope(host: HTMLElement, target: ScopeTarget, T: ScopeStrings, opts?: ScopeOptions): ScopeView {
  return new ScopeView(host, target, T, opts);
}
