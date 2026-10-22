/**
 * Academy — interactive canvas widgets shown inside lesson steps.
 *
 * Each widget is a small self-contained 2-D animation with its own controls and readouts.
 * They share a base class that handles the canvas, DPR, resizing and the animation loop.
 */
import type { WidgetSpec } from '../../data/lessons';

export interface Widget {
  el: HTMLElement;
  destroy(): void;
}

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;
const C = {
  bg: '#0b0e13', grid: '#1f242d', line: '#3a414d', text: '#d3d6dc', dim: '#7c8390', faint: '#4a515c',
  accent: '#bd9b6c', earth: '#5f9ad8', mars: '#d4694a', sun: '#f2c45a', star: '#efe9d8', venus: '#e3c9a0',
  green: '#7fbf8a', red: '#d46a5a', blue: '#6fa3d6', purple: '#a58ad6',
};

function $(tag: string, cls?: string, text?: string): HTMLElement {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}
const fmt = (x: number, d = 1) => x.toFixed(d);
const padZ = (n: number) => (n < 10 ? '0' : '') + Math.floor(n);
const hms = (deg: number) => {
  const h = ((deg / 15) % 24 + 24) % 24;
  const m = (h % 1) * 60;
  return `${padZ(h)}h ${padZ(m)}m`;
};
const dms = (deg: number) => {
  const s = deg < 0 ? '−' : '+';
  const a = Math.abs(deg);
  return `${s}${padZ(a)}° ${padZ((a % 1) * 60)}′`;
};
const wrap360 = (d: number) => ((d % 360) + 360) % 360;

/* ------------------------------------------------------------------ base ---- */

abstract class CanvasWidget implements Widget {
  el = $('div', 'lw');
  protected canvas = document.createElement('canvas');
  protected ctx = this.canvas.getContext('2d')!;
  protected controls = $('div', 'lw-controls');
  protected readout = $('div', 'lw-readout');
  protected w = 0;
  protected h = 0;
  protected playing = true;
  private raf = 0;
  private last = 0;
  private ro: ResizeObserver | null = null;

  constructor(private aspect: number) {
    this.canvas.className = 'lw-canvas';
    this.el.append(this.canvas, this.readout, this.controls);
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(this.el);
    this.raf = requestAnimationFrame(this.tick);
  }

  private resize() {
    const cssW = this.el.clientWidth;
    if (cssW <= 0) return;
    const cssH = Math.round(cssW / this.aspect);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.style.height = `${cssH}px`;
    this.canvas.width = Math.round(cssW * dpr);
    this.canvas.height = Math.round(cssH * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.w = cssW;
    this.h = cssH;
  }

  private tick = (now: number) => {
    this.raf = requestAnimationFrame(this.tick);
    if (this.w === 0) return;
    const dt = this.last ? Math.min((now - this.last) / 1000, 0.05) : 0;
    this.last = now;
    this.ctx.clearRect(0, 0, this.w, this.h);
    this.draw(this.playing ? dt : 0);
  };

  protected abstract draw(dt: number): void;

  destroy() {
    cancelAnimationFrame(this.raf);
    this.ro?.disconnect();
    this.el.remove();
  }

  /* -- controls -- */
  protected slider(label: string, min: number, max: number, step: number, value: number, show: (v: number) => string, onInput: (v: number) => void) {
    const wrap = $('label', 'lw-slider');
    const name = $('span', 'lw-slider-label', label);
    const val = $('span', 'lw-slider-value', show(value));
    const input = document.createElement('input');
    input.type = 'range';
    input.min = String(min); input.max = String(max); input.step = String(step); input.value = String(value);
    input.addEventListener('input', () => { const v = parseFloat(input.value); val.textContent = show(v); onInput(v); });
    wrap.append(name, input, val);
    this.controls.appendChild(wrap);
    return { input, set: (v: number) => { input.value = String(v); val.textContent = show(v); } };
  }

  protected segmented<T extends string>(options: Array<[T, string]>, value: T, onChange: (v: T) => void) {
    const wrap = $('div', 'lw-seg');
    const btns = new Map<T, HTMLElement>();
    for (const [v, label] of options) {
      const b = $('button', v === value ? 'active' : '', label);
      b.addEventListener('click', () => { btns.forEach((x, k) => x.classList.toggle('active', k === v)); onChange(v); });
      btns.set(v, b);
      wrap.appendChild(b);
    }
    this.controls.appendChild(wrap);
    return wrap;
  }

  protected playButton() {
    const b = $('button', 'lw-play', '❚❚');
    b.title = 'Play / pause';
    b.addEventListener('click', () => { this.playing = !this.playing; b.textContent = this.playing ? '❚❚' : '▶'; });
    this.controls.appendChild(b);
    return b;
  }

  protected setReadout(pairs: Array<[string, string, string?]>) {
    // cheap diff: rebuild only when the count changes, otherwise update text
    if (this.readout.children.length !== pairs.length) {
      this.readout.replaceChildren(...pairs.map(() => { const d = $('div', 'lw-ro'); d.append($('span', 'k'), $('span', 'v')); return d; }));
    }
    pairs.forEach(([k, v, color], i) => {
      const d = this.readout.children[i];
      d.children[0].textContent = k;
      d.children[1].textContent = v;
      (d.children[1] as HTMLElement).style.color = color ?? '';
    });
  }

  /* -- drawing helpers -- */
  protected text(s: string, x: number, y: number, color = C.text, size = 11, align: CanvasTextAlign = 'left', font = 'sans') {
    const c = this.ctx;
    c.fillStyle = color;
    c.font = `${size}px ${font === 'serif' ? 'Georgia, "Times New Roman", serif' : font === 'mono' ? 'ui-monospace, Menlo, monospace' : '-apple-system, system-ui, sans-serif'}`;
    c.textAlign = align;
    c.textBaseline = 'middle';
    c.fillText(s, x, y);
  }
  protected circle(x: number, y: number, r: number, stroke?: string, fill?: string, width = 1, dash?: number[]) {
    const c = this.ctx;
    c.beginPath();
    c.arc(x, y, r, 0, TAU);
    if (fill) { c.fillStyle = fill; c.fill(); }
    if (stroke) { c.strokeStyle = stroke; c.lineWidth = width; c.setLineDash(dash ?? []); c.stroke(); c.setLineDash([]); }
  }
  protected line(x0: number, y0: number, x1: number, y1: number, stroke: string, width = 1, dash?: number[]) {
    const c = this.ctx;
    c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1);
    c.strokeStyle = stroke; c.lineWidth = width; c.setLineDash(dash ?? []); c.stroke(); c.setLineDash([]);
  }
  protected glow(x: number, y: number, r: number, color: string) {
    const c = this.ctx;
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g;
    c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
  }
}

/* ------------------------------------------------- 1. retrograde models ---- */

const ZODIAC = ['♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓'];
const MARS = { a: 1.5237, P: 1.8808, i: 1.85 * DEG, node: 49.6 * DEG, phase: 2.1 };

class ModelsWidget extends CanvasWidget {
  private t = 0.0;             // years
  private speed = 0.35;        // years per second
  private k = 0;               // 0 = heliocentric view, 1 = geocentric (Ptolemy) view
  private kTarget: number;
  private trail: Array<{ lon: number; lat: number; t: number }> = [];
  private lastLon = NaN;
  private retro = false;

  constructor(spec: { mode: 'ptolemy' | 'copernicus'; lock?: boolean }) {
    super(480 / 420);
    this.k = this.kTarget = spec.mode === 'ptolemy' ? 1 : 0;
    if (!spec.lock) {
      this.segmented<'ptolemy' | 'copernicus'>([['ptolemy', 'Ptolemy · Earth fixed'], ['copernicus', 'Copernicus · Sun fixed']], spec.mode, (m) => { this.kTarget = m === 'ptolemy' ? 1 : 0; });
    } else {
      this.controls.appendChild($('div', 'lw-caption', spec.mode === 'ptolemy' ? 'Ptolemy\'s model · Earth fixed, Mars on an epicycle' : 'Copernican model · Sun fixed'));
    }
    this.playButton();
    this.slider('Speed', 0.05, 1.2, 0.05, this.speed, (v) => `${fmt(v * 365, 0)} d/s`, (v) => { this.speed = v; });
  }

  private earth(t: number) { const a = TAU * t; return { x: Math.cos(a), y: Math.sin(a), z: 0 }; }
  private mars(t: number) {
    const u = TAU * t / MARS.P + MARS.phase - MARS.node;
    const cu = Math.cos(u), su = Math.sin(u), ci = Math.cos(MARS.i), si = Math.sin(MARS.i);
    return {
      x: MARS.a * (Math.cos(MARS.node) * cu - Math.sin(MARS.node) * su * ci),
      y: MARS.a * (Math.sin(MARS.node) * cu + Math.cos(MARS.node) * su * ci),
      z: MARS.a * su * si,
    };
  }

  protected draw(dt: number) {
    const c = this.ctx;
    this.t += dt * this.speed;
    this.k += (this.kTarget - this.k) * Math.min(1, dt * 4);
    const k = this.k;

    const e = this.earth(this.t), m = this.mars(this.t);
    const g = { x: m.x - e.x, y: m.y - e.y, z: m.z - e.z };
    const lon = Math.atan2(g.y, g.x), lat = Math.atan2(g.z, Math.hypot(g.x, g.y));
    const dist = Math.hypot(g.x, g.y, g.z);
    if (dt > 0) {
      if (!Number.isNaN(this.lastLon)) {
        let d = lon - this.lastLon; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU;
        this.retro = d < 0;
      }
      this.lastLon = lon;
      const last = this.trail[this.trail.length - 1];
      if (!last || this.t - last.t > 0.004) this.trail.push({ lon, lat, t: this.t });
      while (this.trail.length && this.t - this.trail[0].t > 2.3) this.trail.shift();
    }

    /* ---- top: orbit view ---- */
    const stripH = 96;
    const topH = this.h - stripH;
    const cx = this.w / 2, cy = topH / 2 + 4;
    const fit = (1 - k) * 1.95 + k * 2.65;
    const S = (Math.min(this.w, topH) / 2 - 14) / fit;
    // the view is centred on the Sun (k=0) or on the Earth (k=1): the relative geometry is the same
    const ox = -(k * e.x) * S, oy = (k * e.y) * S;
    const P = (p: { x: number; y: number }) => ({ x: cx + ox + p.x * S, y: cy + oy - p.y * S });
    const sunP = P({ x: 0, y: 0 }), earthP = P(e), marsP = P(m);

    c.fillStyle = C.bg; c.fillRect(0, 0, this.w, this.h);

    // sky circle with longitude ticks
    const Rsky = fit * S - 4;
    this.circle(cx, cy, Rsky, C.grid, undefined, 1);
    for (let i = 0; i < 12; i++) {
      const a = i * 30 * DEG;
      this.line(cx + Math.cos(a) * (Rsky - 5), cy - Math.sin(a) * (Rsky - 5), cx + Math.cos(a) * Rsky, cy - Math.sin(a) * Rsky, C.line);
      this.text(ZODIAC[i], cx + Math.cos(a + 15 * DEG) * (Rsky - 13), cy - Math.sin(a + 15 * DEG) * (Rsky - 13), C.faint, 11, 'center');
    }

    // heliocentric circles (fade with k)
    if (k < 0.999) {
      c.globalAlpha = 1 - k;
      this.circle(sunP.x, sunP.y, 1 * S, C.line, undefined, 1);
      this.circle(sunP.x, sunP.y, MARS.a * S, C.line, undefined, 1);
      c.globalAlpha = 1;
    }
    // geocentric circles: deferent (radius a) and epicycle (radius 1) centred on Earth + Mars_helio
    if (k > 0.001) {
      c.globalAlpha = k;
      this.circle(earthP.x, earthP.y, MARS.a * S, C.line, undefined, 1);
      this.circle(earthP.x, earthP.y, 1 * S, C.faint, undefined, 1, [3, 4]);   // Ptolemy's Sun orbit
      const ec = P({ x: e.x + m.x, y: e.y + m.y });
      this.circle(ec.x, ec.y, 1 * S, C.accent, undefined, 1, [2, 3]);
      this.line(earthP.x, earthP.y, ec.x, ec.y, C.faint, 1);
      this.circle(ec.x, ec.y, 2, undefined, C.accent);
      this.text('epicycle', ec.x + 6, ec.y - 10, C.accent, 10);
      this.text('deferent', earthP.x + MARS.a * S * 0.72, earthP.y - MARS.a * S * 0.72, C.dim, 10);
      c.globalAlpha = 1;
    }

    // line of sight Earth → Mars → sky
    const dir = { x: Math.cos(lon), y: Math.sin(lon) };
    const ex = earthP.x - cx, ey = -(earthP.y - cy);
    const b = ex * dir.x + ey * dir.y;
    const s = -b + Math.sqrt(Math.max(0, b * b - (ex * ex + ey * ey) + Rsky * Rsky));
    const skyX = cx + ex + dir.x * s, skyY = cy - (ey + dir.y * s);
    this.line(earthP.x, earthP.y, skyX, skyY, this.retro ? 'rgba(212,106,90,0.8)' : 'rgba(189,155,108,0.7)', 1);
    this.circle(skyX, skyY, 3, undefined, this.retro ? C.red : C.accent);

    // Sun, Earth, Mars
    this.glow(sunP.x, sunP.y, 16, 'rgba(242,196,90,0.55)');
    this.circle(sunP.x, sunP.y, 5, undefined, C.sun);
    this.circle(earthP.x, earthP.y, 4, undefined, C.earth);
    this.circle(marsP.x, marsP.y, 3.2, undefined, C.mars);
    this.text('Sun', sunP.x, sunP.y + 14, C.dim, 10, 'center');
    this.text('Earth', earthP.x, earthP.y + 13, C.dim, 10, 'center');
    this.text('Mars', marsP.x, marsP.y - 11, C.dim, 10, 'center');

    /* ---- bottom: the sky strip ---- */
    const sy = topH + 6, sh = stripH - 12;
    c.fillStyle = '#0f131a'; c.fillRect(0, sy, this.w, sh);
    const midY = sy + sh / 2;
    const X = (l: number) => ((wrap360(l / DEG) / 360) * this.w);
    for (let i = 0; i < 12; i++) {
      const x = X(i * 30 * DEG);
      this.line(x, sy, x, sy + sh, C.grid);
      this.text(ZODIAC[i], x + this.w / 24, sy + 9, C.faint, 10, 'center');
    }
    this.line(0, midY, this.w, midY, C.grid, 1, [2, 4]);
    this.text('ecliptic', 4, midY - 7, C.faint, 9);
    const LAT = 14 / DEG;  // exaggerate latitude ×14 so the loop shape is visible
    for (const pt of this.trail) {
      const age = (this.t - pt.t) / 2.3;
      c.globalAlpha = (1 - age) * 0.85;
      this.circle(X(pt.lon), midY - pt.lat * LAT, 1.3, undefined, C.mars);
    }
    c.globalAlpha = 1;
    const mr = 2 + 5 * Math.min(1, (0.52 / dist) ** 2);
    this.glow(X(lon), midY - lat * LAT, mr * 2.4, 'rgba(212,105,74,0.5)');
    this.circle(X(lon), midY - lat * LAT, mr, undefined, C.mars);
    this.text('sky as seen from Earth · Mars against the zodiac (latitude ×14)', this.w - 6, sy + sh - 8, C.faint, 9, 'right');

    this.setReadout([
      ['Time', `${fmt(this.t, 2)} yr`],
      ['Earth–Mars', `${fmt(dist, 2)} AU`],
      ['Motion', this.retro ? '◀ retrograde' : 'direct ▶', this.retro ? C.red : C.green],
      ['Brightness', `${fmt((0.52 / dist) ** 2 * 100, 0)} %`],
    ]);
  }
}

/* -------------------------------------------------- 2. Eudoxus' spheres ---- */

type V3 = { x: number; y: number; z: number };
const rot = (v: V3, axis: V3, ang: number): V3 => {
  // Rodrigues
  const cs = Math.cos(ang), sn = Math.sin(ang);
  const dot = axis.x * v.x + axis.y * v.y + axis.z * v.z;
  const cr = { x: axis.y * v.z - axis.z * v.y, y: axis.z * v.x - axis.x * v.z, z: axis.x * v.y - axis.y * v.x };
  return {
    x: v.x * cs + cr.x * sn + axis.x * dot * (1 - cs),
    y: v.y * cs + cr.y * sn + axis.y * dot * (1 - cs),
    z: v.z * cs + cr.z * sn + axis.z * dot * (1 - cs),
  };
};

class EudoxusWidget extends CanvasWidget {
  private theta = 0;
  private tilt = 14 * DEG;
  private drift = 0.55;           // zodiacal drift per loop-rotation (fraction)
  private speed = 0.5;            // loop turns per second
  private hist: Array<{ th: number; lon: number }> = [];

  constructor() {
    super(480 / 400);
    this.playButton();
    this.slider('Axis tilt', 2, 30, 1, 14, (v) => `${v}°`, (v) => { this.tilt = v * DEG; this.hist.length = 0; });
    this.slider('Zodiacal drift', 0.1, 1.5, 0.05, this.drift, (v) => `${fmt(v, 2)}`, (v) => { this.drift = v; this.hist.length = 0; });
  }

  private point(th: number): V3 {
    const A = { x: 0, y: 0, z: 1 };
    const B = { x: 0, y: Math.sin(this.tilt), z: Math.cos(this.tilt) };
    const p0 = { x: 1, y: 0, z: 0 };
    return rot(rot(p0, B, -th), A, th);
  }
  private lon(p: V3) { return Math.atan2(p.y, p.x); }

  protected draw(dt: number) {
    const c = this.ctx;
    this.theta += dt * this.speed * TAU;
    c.fillStyle = C.bg; c.fillRect(0, 0, this.w, this.h);

    const stripH = 110;
    const topH = this.h - stripH;
    const cx = this.w / 2, cy = topH / 2 + 6, R = Math.min(this.w, topH) / 2 - 22;
    const pitch = 22 * DEG;
    // view: from +x, slightly above; screen x = y, screen y = z (pitched)
    const proj = (v: V3) => ({ x: cx + v.y * R, y: cy - (v.z * Math.cos(pitch) - v.x * Math.sin(pitch)) * R, d: v.x * Math.cos(pitch) + v.z * Math.sin(pitch) });

    const circle3 = (fn: (a: number) => V3, color: string, width = 1, dash?: number[]) => {
      c.lineWidth = width; c.setLineDash(dash ?? []);
      let prev = proj(fn(0));
      for (let i = 1; i <= 96; i++) {
        const p = proj(fn(i / 96 * TAU));
        c.strokeStyle = color; c.globalAlpha = p.d > 0 ? 0.95 : 0.25;
        c.beginPath(); c.moveTo(prev.x, prev.y); c.lineTo(p.x, p.y); c.stroke();
        prev = p;
      }
      c.globalAlpha = 1; c.setLineDash([]);
    };

    // sphere
    this.circle(cx, cy, R, C.line, 'rgba(255,255,255,0.015)');
    // outer sphere equator & axis (A = z)
    circle3((a) => ({ x: Math.cos(a), y: Math.sin(a), z: 0 }), C.faint, 1, [3, 4]);
    const aT = proj({ x: 0, y: 0, z: 1.12 }), aB = proj({ x: 0, y: 0, z: -1.12 });
    this.line(aT.x, aT.y, aB.x, aB.y, C.dim, 1);
    this.text('axis 1', aT.x + 6, aT.y, C.dim, 10);
    // inner sphere: axis B rotated about A by theta; its equator
    const Bn = rot({ x: 0, y: Math.sin(this.tilt), z: Math.cos(this.tilt) }, { x: 0, y: 0, z: 1 }, this.theta);
    const e1 = { x: 1, y: 0, z: 0 };
    const e1r = rot(e1, { x: 0, y: 0, z: 1 }, this.theta);
    const e2 = { x: Bn.y * e1r.z - Bn.z * e1r.y, y: Bn.z * e1r.x - Bn.x * e1r.z, z: Bn.x * e1r.y - Bn.y * e1r.x };
    circle3((a) => ({ x: e1r.x * Math.cos(a) + e2.x * Math.sin(a), y: e1r.y * Math.cos(a) + e2.y * Math.sin(a), z: e1r.z * Math.cos(a) + e2.z * Math.sin(a) }), C.accent, 1, [2, 3]);
    const bT = proj({ x: Bn.x * 1.12, y: Bn.y * 1.12, z: Bn.z * 1.12 }), bB = proj({ x: -Bn.x * 1.12, y: -Bn.y * 1.12, z: -Bn.z * 1.12 });
    this.line(bT.x, bT.y, bB.x, bB.y, C.accent, 1);
    this.text('axis 2', bT.x + 6, bT.y, C.accent, 10);

    // hippopede path
    c.lineWidth = 1.6;
    let prev = proj(this.point(0));
    for (let i = 1; i <= 240; i++) {
      const p = proj(this.point(i / 240 * TAU));
      c.strokeStyle = C.mars; c.globalAlpha = p.d > 0 ? 0.9 : 0.25;
      c.beginPath(); c.moveTo(prev.x, prev.y); c.lineTo(p.x, p.y); c.stroke();
      prev = p;
    }
    c.globalAlpha = 1;
    const pt = this.point(this.theta);
    const pp = proj(pt);
    this.glow(pp.x, pp.y, 10, 'rgba(212,105,74,0.6)');
    this.circle(pp.x, pp.y, 3.5, undefined, C.mars);
    this.text('hippopede', cx, cy + R + 12, C.dim, 10, 'center', 'serif');

    /* strip: apparent longitude vs time */
    if (dt > 0) {
      const lon = this.drift * this.theta + this.lon(pt);
      this.hist.push({ th: this.theta, lon });
      while (this.hist.length && this.theta - this.hist[0].th > 2 * TAU) this.hist.shift();
    }
    const sy = topH + 6, sh = stripH - 12;
    c.fillStyle = '#0f131a'; c.fillRect(0, sy, this.w, sh);
    this.text('apparent position along the zodiac →', 6, sy + 9, C.faint, 9);
    this.text('time →', this.w - 6, sy + sh - 8, C.faint, 9, 'right');
    if (this.hist.length > 2) {
      const t0 = this.theta - 2 * TAU;
      const lMin = Math.min(...this.hist.map((h) => h.lon)), lMax = Math.max(...this.hist.map((h) => h.lon));
      const span = Math.max(lMax - lMin, 0.3);
      const X = (th: number) => 8 + ((th - t0) / (2 * TAU)) * (this.w - 16);
      const Y = (l: number) => sy + sh - 14 - ((l - lMin) / span) * (sh - 28);
      let retro = false;
      for (let i = 1; i < this.hist.length; i++) {
        const a = this.hist[i - 1], b = this.hist[i];
        const r = b.lon < a.lon;
        if (r) retro = true;
        this.line(X(a.th), Y(a.lon), X(b.th), Y(b.lon), r ? C.red : C.accent, 1.5);
      }
      const last = this.hist[this.hist.length - 1];
      this.circle(X(last.th), Y(last.lon), 3, undefined, C.mars);
      let maxLon = 0, maxLat = 0;
      for (let i = 0; i < 72; i++) { const q = this.point(i / 72 * TAU); maxLon = Math.max(maxLon, Math.abs(this.lon(q))); maxLat = Math.max(maxLat, Math.abs(Math.asin(q.z))); }
      this.setReadout([
        ['Figure-eight size', `${fmt(2 * maxLon / DEG, 1)}° wide × ${fmt(2 * maxLat / DEG, 1)}° tall`],
        ['Retrograde?', retro ? 'yes — the loop outruns the drift' : 'no — the drift wins', retro ? C.red : C.green],
      ]);
    }
  }
}

/* ------------------------------------------------- 3. synodic periods ---- */

const PLANETS: Record<string, { a: number; P: number; color: string; S: number }> = {
  Mercury: { a: 0.387, P: 0.2408, color: '#b9b2a8', S: 115.9 },
  Venus: { a: 0.723, P: 0.6152, color: C.venus, S: 583.9 },
  Mars: { a: 1.524, P: 1.8808, color: C.mars, S: 779.9 },
  Jupiter: { a: 5.203, P: 11.862, color: '#d8b48a', S: 398.9 },
  Saturn: { a: 9.537, P: 29.457, color: '#e0d2a8', S: 378.1 },
};

class SynodicWidget extends CanvasWidget {
  private t = 0;
  private speed = 0.4;
  private planet = 'Mars';
  private lastAlign = 0;
  private measured = NaN;
  private flash = 0;
  private prevDiff = 0;

  constructor() {
    super(480 / 400);
    this.segmented(Object.keys(PLANETS).map((k) => [k, k] as [string, string]), this.planet, (p) => { this.planet = p; this.t = 0; this.lastAlign = 0; this.measured = NaN; this.prevDiff = 0; });
    this.playButton();
    this.slider('Speed', 0.1, 3, 0.1, this.speed, (v) => `${fmt(v, 1)} yr/s`, (v) => { this.speed = v; });
  }

  protected draw(dt: number) {
    const c = this.ctx;
    const pl = PLANETS[this.planet];
    this.t += dt * this.speed;
    const ae = TAU * this.t, ap = TAU * this.t / pl.P;
    // alignment when heliocentric longitudes coincide (opposition for superior, inferior conjunction for inferior)
    let diff = ((ap - ae) % TAU + TAU) % TAU; if (diff > Math.PI) diff -= TAU;
    if (dt > 0 && this.prevDiff < 0 && diff >= 0 && this.t > 0.01 && Math.abs(diff - this.prevDiff) < 1) {
      if (this.lastAlign > 0) this.measured = this.t - this.lastAlign;
      this.lastAlign = this.t;
      this.flash = 1;
    }
    this.prevDiff = diff;
    this.flash = Math.max(0, this.flash - dt * 1.2);

    c.fillStyle = C.bg; c.fillRect(0, 0, this.w, this.h);
    const cx = this.w / 2, cy = this.h / 2, R = Math.min(this.w, this.h) / 2 - 26;
    const outer = Math.max(1, pl.a);
    const rd = (a: number) => R * Math.sqrt(a / outer);
    const rE = rd(1), rP = rd(pl.a);
    const E = { x: cx + rE * Math.cos(ae), y: cy - rE * Math.sin(ae) };
    const Pp = { x: cx + rP * Math.cos(ap), y: cy - rP * Math.sin(ap) };

    // fixed-star reference direction
    this.line(cx, cy, cx + R + 18, cy, C.grid, 1, [2, 4]);
    this.text('★ to a fixed star', cx + R + 2, cy - 10, C.faint, 9, 'right');
    // orbits
    this.circle(cx, cy, rE, C.line);
    this.circle(cx, cy, rP, C.line);
    // start marks (sidereal lap counter)
    this.line(cx + rP - 5, cy, cx + rP + 5, cy, C.dim, 1.5);
    // alignment line through Sun and Earth
    const far = R + 10;
    this.line(cx - Math.cos(ae) * far, cy + Math.sin(ae) * far, cx + Math.cos(ae) * far, cy - Math.sin(ae) * far, `rgba(189,155,108,${0.25 + this.flash * 0.6})`, 1, [4, 4]);
    this.line(E.x, E.y, Pp.x, Pp.y, 'rgba(255,255,255,0.25)', 1);
    if (this.flash > 0) this.circle(cx, cy, R * (1 - this.flash) + 8, `rgba(189,155,108,${this.flash * 0.6})`, undefined, 2);

    this.glow(cx, cy, 18, 'rgba(242,196,90,0.5)');
    this.circle(cx, cy, 6, undefined, C.sun);
    this.circle(E.x, E.y, 4.5, undefined, C.earth);
    this.circle(Pp.x, Pp.y, 4.5, undefined, pl.color);
    this.text('Earth', E.x, E.y + 13, C.dim, 10, 'center');
    this.text(this.planet, Pp.x, Pp.y - 12, C.dim, 10, 'center');

    const formula = 1 / Math.abs(1 - 1 / pl.P);
    const since = this.t - this.lastAlign;
    this.setReadout([
      ['Sidereal period P', `${fmt(pl.P, 3)} yr = ${fmt(pl.P * 365.25, 0)} d`],
      ['Laps completed', `${Math.floor(this.t / pl.P)}`],
      ['Since last alignment', `${fmt(since * 365.25, 0)} d`],
      ['Synodic S (formula)', `${fmt(formula, 3)} yr = ${fmt(formula * 365.25, 0)} d`, C.accent],
      ['Synodic S (stopwatch)', Number.isNaN(this.measured) ? 'waiting for two alignments…' : `${fmt(this.measured * 365.25, 0)} d`, C.green],
    ]);
  }
}

/* --------------------------------------------- 4. the celestial sphere ---- */

const STARS: Record<string, { ra: number; dec: number; color: string; glow: string }> = {
  Sirius: { ra: 101.287, dec: -16.716, color: '#cfe3ff', glow: 'rgba(207,227,255,0.5)' },
  Betelgeuse: { ra: 88.793, dec: 7.407, color: '#ffb28a', glow: 'rgba(255,178,138,0.5)' },
  Vega: { ra: 279.235, dec: 38.784, color: '#dfe8ff', glow: 'rgba(223,232,255,0.5)' },
  Polaris: { ra: 37.955, dec: 89.264, color: '#fff2d6', glow: 'rgba(255,242,214,0.5)' },
};
const OBLIQ = 23.44 * DEG;

class SphereWidget extends CanvasWidget {
  private lat = 41 * DEG;
  private lst = 6.75;       // hours
  private starName = 'Sirius';
  private yaw = -32 * DEG;
  private pitch = 24 * DEG;
  private dragging: { x: number; y: number; yaw: number; pitch: number } | null = null;
  private speed = 1;        // sidereal hours per second

  constructor(private mode: 'altaz' | 'diurnal' | 'equatorial') {
    super(480 / 430);
    this.playing = mode !== 'altaz';
    this.segmented(Object.keys(STARS).map((k) => [k, k] as [string, string]), this.starName, (s) => { this.starName = s; });
    const pb = this.playButton();
    pb.textContent = this.playing ? '❚❚' : '▶';
    this.slider('Latitude φ', -90, 90, 1, 41, (v) => `${v}°`, (v) => { this.lat = v * DEG; });
    const lstS = this.slider('Sidereal time', 0, 24, 0.05, this.lst, (v) => `${padZ(v)}h ${padZ((v % 1) * 60)}m`, (v) => { this.lst = v; });
    this.lstSet = lstS.set;
    this.slider('Speed', 0.1, 4, 0.1, 1, (v) => `${fmt(v, 1)} h/s`, (v) => { this.speed = v; });
    this.canvas.addEventListener('pointerdown', (e) => { this.dragging = { x: e.clientX, y: e.clientY, yaw: this.yaw, pitch: this.pitch }; this.canvas.setPointerCapture(e.pointerId); });
    this.canvas.addEventListener('pointermove', (e) => {
      if (!this.dragging) return;
      this.yaw = this.dragging.yaw - (e.clientX - this.dragging.x) * 0.008;
      this.pitch = Math.max(-5 * DEG, Math.min(85 * DEG, this.dragging.pitch + (e.clientY - this.dragging.y) * 0.008));
    });
    this.canvas.addEventListener('pointerup', () => { this.dragging = null; });
    this.canvas.style.cursor = 'grab';
    this.controls.appendChild($('div', 'lw-caption', 'Drag the sky to look around.'));
  }
  private lstSet: (v: number) => void = () => {};

  /** equatorial (hour angle H, declination δ) → horizon unit vector (east, north, up) */
  private toHorizon(H: number, dec: number): V3 {
    const sp = Math.sin(this.lat), cp = Math.cos(this.lat);
    const Pp = { x: 0, y: cp, z: sp };          // celestial pole
    const Q = { x: 0, y: -sp, z: cp };          // equator on the meridian (south)
    const cd = Math.cos(dec), sd = Math.sin(dec);
    return {
      x: cd * Math.cos(H) * Q.x - cd * Math.sin(H) * 1 + sd * Pp.x,
      y: cd * Math.cos(H) * Q.y + sd * Pp.y,
      z: cd * Math.cos(H) * Q.z + sd * Pp.z,
    };
  }
  private raToH(raDeg: number) { return (this.lst * 15 - raDeg) * DEG; }

  protected draw(dt: number) {
    const c = this.ctx;
    if (dt > 0) { this.lst = (this.lst + dt * this.speed) % 24; this.lstSet(this.lst); }
    c.fillStyle = C.bg; c.fillRect(0, 0, this.w, this.h);
    const cx = this.w / 2, cy = this.h / 2 + 6, R = Math.min(this.w, this.h) / 2 - 24;
    const cyaw = Math.cos(this.yaw), syaw = Math.sin(this.yaw), cpi = Math.cos(this.pitch), spi = Math.sin(this.pitch);
    const proj = (v: V3) => {
      const x1 = v.x * cyaw - v.y * syaw, y1 = v.x * syaw + v.y * cyaw, z1 = v.z;
      return { x: cx + x1 * R, y: cy - (-y1 * spi + z1 * cpi) * R, d: y1 * cpi + z1 * spi };
    };
    const circle3 = (fn: (a: number) => V3, color: string, width = 1, dash?: number[], backAlpha = 0.22, n = 120) => {
      c.lineWidth = width; c.setLineDash(dash ?? []);
      let prev = proj(fn(0));
      for (let i = 1; i <= n; i++) {
        const p = proj(fn(i / n * TAU));
        c.strokeStyle = color; c.globalAlpha = p.d > 0 ? 0.95 : backAlpha;
        c.beginPath(); c.moveTo(prev.x, prev.y); c.lineTo(p.x, p.y); c.stroke();
        prev = p;
      }
      c.globalAlpha = 1; c.setLineDash([]);
    };
    const arc3 = (fn: (s: number) => V3, color: string, width = 1, n = 40) => {
      c.lineWidth = width; c.strokeStyle = color;
      c.beginPath();
      for (let i = 0; i <= n; i++) { const p = proj(fn(i / n)); if (i === 0) c.moveTo(p.x, p.y); else c.lineTo(p.x, p.y); }
      c.stroke();
    };

    const star = STARS[this.starName];
    const H = this.raToH(star.ra), dec = star.dec * DEG;
    const sv = this.toHorizon(H, dec);
    const alt = Math.asin(Math.max(-1, Math.min(1, sv.z)));
    const az = wrap360(Math.atan2(sv.x, sv.y) / DEG);

    // sphere outline
    this.circle(cx, cy, R, C.grid);
    // horizon disk (ground)
    c.beginPath();
    for (let i = 0; i <= 90; i++) { const a = i / 90 * TAU; const p = proj({ x: Math.cos(a), y: Math.sin(a), z: 0 }); if (i === 0) c.moveTo(p.x, p.y); else c.lineTo(p.x, p.y); }
    c.closePath();
    c.fillStyle = 'rgba(120,100,70,0.10)'; c.fill();
    c.strokeStyle = C.accent; c.lineWidth = 1.2; c.stroke();

    // back-half: equatorial grid (drawn first so the ground overlays it)
    const eqGrid = this.mode !== 'altaz';
    if (eqGrid) {
      circle3((a) => this.toHorizon(a, 0), C.blue, 1.2);
      if (this.mode === 'equatorial') {
        for (let d = -60; d <= 60; d += 30) if (d !== 0) circle3((a) => this.toHorizon(a, d * DEG), 'rgba(111,163,214,0.35)', 1, [2, 4]);
        for (let hh = 0; hh < 24; hh += 3) {
          const Hh = this.raToH(hh * 15);
          arc3((s) => this.toHorizon(Hh, -Math.PI / 2 + s * Math.PI), 'rgba(111,163,214,0.28)', 1, 48);
        }
        // ecliptic
        circle3((l) => {
          const d = Math.asin(Math.sin(OBLIQ) * Math.sin(l));
          const ra = Math.atan2(Math.sin(l) * Math.cos(OBLIQ), Math.cos(l));
          return this.toHorizon(this.raToH(ra / DEG), d);
        }, C.sun, 1.2, [5, 4]);
        const ve = proj(this.toHorizon(this.raToH(0), 0));
        this.circle(ve.x, ve.y, 3, C.sun, undefined, 1);
        this.text('♈︎ vernal equinox', ve.x + 7, ve.y, C.sun, 10);
        const ecl = proj((() => { const l = 90 * DEG; return this.toHorizon(this.raToH(90), Math.asin(Math.sin(OBLIQ) * Math.sin(l))); })());
        this.text('ecliptic', ecl.x + 6, ecl.y - 6, C.sun, 10);
      }
      // pole and axis
      const pole = { x: 0, y: Math.cos(this.lat), z: Math.sin(this.lat) };
      const pp = proj(pole), pn = proj({ x: -pole.x * 1.0, y: -pole.y, z: -pole.z });
      this.line(pn.x, pn.y, pp.x, pp.y, 'rgba(111,163,214,0.5)', 1, [3, 3]);
      this.circle(pp.x, pp.y, 3, undefined, C.blue);
      this.text(this.lat >= 0 ? 'north celestial pole' : 'north celestial pole (below horizon)', pp.x + 7, pp.y - 6, C.blue, 10);
      const eqLbl = proj(this.toHorizon(0, 0));
      this.text('celestial equator', eqLbl.x + 6, eqLbl.y + 8, C.blue, 10);
      // altitude of the pole = latitude arc
      arc3((s) => ({ x: 0, y: Math.cos(this.lat * s), z: Math.sin(this.lat * s) }), 'rgba(111,163,214,0.6)', 1.5, 24);
      const mid = proj({ x: 0, y: Math.cos(this.lat / 2) * 1.06, z: Math.sin(this.lat / 2) * 1.06 });
      this.text(`φ = ${fmt(this.lat / DEG, 0)}°`, mid.x, mid.y, C.blue, 10, 'center');
      // star's daily track
      circle3((a) => this.toHorizon(a, dec), 'rgba(239,233,216,0.5)', 1, [2, 3], 0.12);
    }

    // meridian (through zenith, N and S)
    circle3((a) => ({ x: 0, y: Math.cos(a), z: Math.sin(a) }), 'rgba(189,155,108,0.45)', 1, [4, 4], 0.1);

    // compass labels
    const cardinal: Array<[string, V3]> = [['N', { x: 0, y: 1.1, z: 0 }], ['E', { x: 1.1, y: 0, z: 0 }], ['S', { x: 0, y: -1.1, z: 0 }], ['W', { x: -1.1, y: 0, z: 0 }]];
    for (const [l, v] of cardinal) { const p = proj(v); this.text(l, p.x, p.y, C.accent, 12, 'center', 'serif'); }
    const zen = proj({ x: 0, y: 0, z: 1 });
    this.circle(zen.x, zen.y, 2, undefined, C.accent);
    this.text('zenith', zen.x, zen.y - 11, C.accent, 10, 'center');

    // observer
    this.circle(cx, cy, 2.5, undefined, C.text);

    // altitude & azimuth arcs for the star
    const up = sv.z >= 0;
    const azRad = az * DEG;
    arc3((s) => ({ x: Math.sin(azRad * s), y: Math.cos(azRad * s), z: 0 }), 'rgba(127,191,138,0.8)', 2, 60);
    if (up) {
      arc3((s) => ({ x: Math.cos(alt * s) * Math.sin(azRad), y: Math.cos(alt * s) * Math.cos(azRad), z: Math.sin(alt * s) }), 'rgba(212,106,90,0.85)', 2, 30);
      const foot = proj({ x: Math.sin(azRad), y: Math.cos(azRad), z: 0 });
      this.line(cx, cy, foot.x, foot.y, 'rgba(255,255,255,0.15)', 1);
    }
    const sp = proj(sv);
    this.line(cx, cy, sp.x, sp.y, up ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.10)', 1);
    c.globalAlpha = up ? 1 : 0.35;
    this.glow(sp.x, sp.y, 12, star.glow);
    this.circle(sp.x, sp.y, 3.5, undefined, star.color);
    this.text(this.starName, sp.x + 8, sp.y - 8, star.color, 11, 'left', 'serif');
    c.globalAlpha = 1;

    const circumpolar = dec > Math.PI / 2 - Math.abs(this.lat) && Math.sign(dec) === Math.sign(this.lat || 1);
    const neverRises = -dec > Math.PI / 2 - Math.abs(this.lat) && Math.sign(dec) !== Math.sign(this.lat || 1);
    const Hh = ((H / DEG / 15) + 12 + 24) % 24 - 12;
    const ro: Array<[string, string, string?]> = [
      ['Altitude h', `${fmt(alt / DEG, 1)}°${up ? '' : ' (below horizon)'}`, C.red],
      ['Azimuth A', `${fmt(az, 1)}° (N→E)`, C.green],
    ];
    if (this.mode !== 'altaz') {
      ro.push(['Right ascension α', hms(star.ra), C.blue], ['Declination δ', dms(star.dec), C.blue], ['Hour angle H', `${Hh < 0 ? '−' : '+'}${padZ(Math.abs(Hh))}h ${padZ((Math.abs(Hh) % 1) * 60)}m`]);
      ro.push(['Status', circumpolar ? 'circumpolar — never sets' : neverRises ? 'never rises from here' : 'rises and sets', circumpolar ? C.green : neverRises ? C.red : C.text]);
      ro.push(['Max altitude', `${fmt(90 - Math.abs(this.lat / DEG - star.dec), 1)}°`]);
    }
    this.setReadout(ro);
  }
}

/* ------------------------------------------------------- 5. precession ---- */

const POLE_STARS: Array<{ name: string; ra: number; dec: number }> = [
  { name: 'Polaris', ra: 37.95, dec: 89.26 }, { name: 'Vega', ra: 279.23, dec: 38.78 }, { name: 'Thuban', ra: 211.10, dec: 64.38 },
  { name: 'Deneb', ra: 310.36, dec: 45.28 }, { name: 'Alderamin', ra: 319.64, dec: 62.59 }, { name: 'Kochab', ra: 222.68, dec: 74.16 },
  { name: 'Errai', ra: 354.84, dec: 77.63 }, { name: 'Alfirk', ra: 322.16, dec: 70.56 }, { name: 'Tau Her', ra: 244.94, dec: 46.31 },
];
const toEcliptic = (raDeg: number, decDeg: number) => {
  const a = raDeg * DEG, d = decDeg * DEG, e = OBLIQ;
  const beta = Math.asin(Math.sin(d) * Math.cos(e) - Math.cos(d) * Math.sin(e) * Math.sin(a));
  const lambda = Math.atan2(Math.sin(a) * Math.cos(e) + Math.tan(d) * Math.sin(e), Math.cos(a));
  return { lambda: wrap360(lambda / DEG), beta: beta / DEG };
};

class PrecessionWidget extends CanvasWidget {
  private year = 2025;
  private speed = 400;
  private set: (v: number) => void = () => {};

  constructor() {
    super(480 / 420);
    this.playing = false;
    const pb = this.playButton(); pb.textContent = '▶';
    const s = this.slider('Year', -13000, 15000, 10, this.year, (v) => (v < 0 ? `${-v} BCE` : `${v} CE`), (v) => { this.year = v; });
    this.set = s.set;
    this.slider('Speed', 50, 2000, 50, this.speed, (v) => `${v} yr/s`, (v) => { this.speed = v; });
  }

  protected draw(dt: number) {
    const c = this.ctx;
    if (dt > 0) { this.year += dt * this.speed; if (this.year > 15000) this.year = -13000; this.set(Math.round(this.year)); }
    c.fillStyle = C.bg; c.fillRect(0, 0, this.w, this.h);
    const cx = this.w / 2 + 30, cy = this.h / 2 + 4, R = Math.min(this.w, this.h) / 2 - 30;
    const maxCo = 52;                               // degrees from the ecliptic pole shown
    const P = (lambda: number, beta: number) => { const r = (90 - beta) / maxCo * R; const a = lambda * DEG; return { x: cx + Math.cos(a) * r, y: cy - Math.sin(a) * r }; };

    // graticule
    for (let co = 10; co <= 50; co += 10) this.circle(cx, cy, co / maxCo * R, C.grid, undefined, 1);
    for (let l = 0; l < 360; l += 30) { const p = P(l, 90 - maxCo); this.line(cx, cy, p.x, p.y, C.grid); this.text(`${l}°`, P(l, 90 - maxCo - 4).x, P(l, 90 - maxCo - 4).y, C.faint, 9, 'center'); }
    this.circle(cx, cy, 2.5, undefined, C.sun);
    this.text('north ecliptic pole', cx + 6, cy - 8, C.sun, 10);

    // precession circle
    this.circle(cx, cy, OBLIQ / DEG / maxCo * R, C.accent, undefined, 1.2, [5, 4]);
    this.text('path of the celestial pole · 25 772 yr', P(270, 90 - OBLIQ / DEG - 5).x, P(270, 90 - OBLIQ / DEG - 5).y, C.accent, 10, 'center');

    // stars
    for (const s of POLE_STARS) {
      const e = toEcliptic(s.ra, s.dec);
      if (90 - e.beta > maxCo) continue;
      const p = P(e.lambda, e.beta);
      const big = s.name === 'Polaris' || s.name === 'Vega' || s.name === 'Thuban';
      this.glow(p.x, p.y, big ? 9 : 5, 'rgba(239,233,216,0.45)');
      this.circle(p.x, p.y, big ? 2.8 : 1.8, undefined, C.star);
      this.text(s.name, p.x + 6, p.y + 7, C.dim, 10, 'left', 'serif');
    }

    // pole position now
    const lam = wrap360(90 - 360 * (this.year - 2000) / 25772);
    const pole = P(lam, 90 - OBLIQ / DEG);
    this.line(pole.x - 9, pole.y, pole.x + 9, pole.y, C.blue, 1.4);
    this.line(pole.x, pole.y - 9, pole.x, pole.y + 9, C.blue, 1.4);
    this.circle(pole.x, pole.y, 5, C.blue, undefined, 1.4);
    this.text('celestial pole', pole.x + 10, pole.y - 10, C.blue, 10);
    // J2000 marker
    const p2000 = P(90, 90 - OBLIQ / DEG);
    this.circle(p2000.x, p2000.y, 2, undefined, C.faint);
    this.text('2000', p2000.x - 8, p2000.y + 9, C.faint, 9, 'right');

    // nearest star
    let best = { name: '', sep: 1e9 };
    for (const s of POLE_STARS) {
      const e = toEcliptic(s.ra, s.dec);
      const d1 = (90 - e.beta) * DEG, d2 = OBLIQ, dl = (e.lambda - lam) * DEG;
      const sep = Math.acos(Math.cos(d1) * Math.cos(d2) + Math.sin(d1) * Math.sin(d2) * Math.cos(dl)) / DEG;
      if (sep < best.sep) best = { name: s.name, sep };
    }

    // inset: spinning Earth with precessing axis
    const ix = 54, iy = this.h - 62, ir = 26;
    const phase = lam * DEG;
    const tiltX = Math.sin(phase) * Math.sin(OBLIQ), tiltY = -Math.cos(OBLIQ);
    this.circle(ix, iy, ir + 20, C.grid, undefined, 1, [2, 4]);
    this.line(ix, iy + ir + 20, ix, iy - ir - 20, C.faint, 1, [2, 3]);
    this.text('ecliptic pole ↑', ix, iy - ir - 28, C.faint, 9, 'center');
    this.circle(ix, iy, ir, undefined, 'rgba(95,154,216,0.25)');
    this.circle(ix, iy, ir, C.earth, undefined, 1);
    const ax = tiltX * (ir + 18) * (Math.cos(phase) > 0 ? 1 : 1), ay = tiltY * (ir + 18);
    this.line(ix - ax, iy - ay, ix + ax, iy + ay, C.text, 1.6);
    this.circle(ix + ax, iy + ay, 2.5, undefined, C.blue);
    this.text('Earth\'s axis sweeps a 23.4° cone', ix, iy + ir + 30, C.dim, 9, 'center');

    this.setReadout([
      ['Year', this.year < 0 ? `${Math.round(-this.year)} BCE` : `${Math.round(this.year)} CE`],
      ['Pole longitude λ', `${fmt(lam, 1)}°`],
      ['Nearest bright star', `${best.name} · ${fmt(best.sep, 1)}° from the pole`, best.sep < 5 ? C.green : C.text],
      ['Equinox shift since 2000', `${fmt((this.year - 2000) * 50.29 / 3600, 1)}°`],
    ]);
  }
}

/* ------------------------------------------------------------ 6. spectrum ---- */

const BANDS: Array<{ name: string; lo: number; hi: number; color: string; source: string }> = [
  { name: 'Gamma ray', lo: 1e-14, hi: 1e-11, color: '#9b6bd6', source: 'gamma-ray bursts, pulsars, annihilation' },
  { name: 'X-ray', lo: 1e-11, hi: 1e-8, color: '#6f86d6', source: 'million-degree gas, accretion onto black holes' },
  { name: 'Ultraviolet', lo: 1e-8, hi: 3.8e-7, color: '#7a9bd9', source: 'hot young stars, white dwarfs' },
  { name: 'Visible', lo: 3.8e-7, hi: 7.5e-7, color: '#ffffff', source: 'ordinary stars, galaxies' },
  { name: 'Infrared', lo: 7.5e-7, hi: 1e-3, color: '#c9775b', source: 'warm dust, planets, the first galaxies' },
  { name: 'Microwave', lo: 1e-3, hi: 1e-1, color: '#b1865a', source: 'the cosmic microwave background, molecules' },
  { name: 'Radio', lo: 1e-1, hi: 1e2, color: '#8c9a64', source: 'pulsars, cold hydrogen, jets' },
];
const TELESCOPES: Array<{ name: string; lo: number; hi: number; row: number; space: boolean }> = [
  { name: 'Fermi', lo: 1e-14, hi: 1.2e-11, row: 0, space: true },
  { name: 'Chandra', lo: 1.2e-10, hi: 1.2e-8, row: 1, space: true },
  { name: 'Hubble', lo: 1.15e-7, hi: 2.5e-6, row: 0, space: true },
  { name: 'JWST', lo: 6e-7, hi: 2.8e-5, row: 1, space: true },
  { name: 'Keck / VLT', lo: 3.2e-7, hi: 2.5e-5, row: 2, space: false },
  { name: 'ALMA', lo: 3.2e-4, hi: 3.6e-3, row: 0, space: false },
  { name: 'Planck', lo: 3.5e-4, hi: 1e-2, row: 1, space: true },
  { name: 'VLA', lo: 7e-3, hi: 4, row: 0, space: false },
  { name: 'LOFAR', lo: 1.3, hi: 30, row: 1, space: false },
];
const LOG_MIN = -14, LOG_MAX = 2;
/** rough atmospheric transmission as a function of log10(λ / m) */
function transmission(lg: number): number {
  const pts: Array<[number, number]> = [
    [-14, 0], [-7.0, 0], [-6.55, 0.05], [-6.5, 0.85], [-6.0, 0.85], [-5.9, 0.55], [-5.3, 0.55], [-5.25, 0.08], [-5.1, 0.08], [-5.05, 0.6], [-4.85, 0.6], [-4.8, 0.05],
    [-3.6, 0.05], [-3.5, 0.3], [-3.0, 0.45], [-2.2, 0.75], [-2.0, 0.95], [1.0, 0.95], [1.3, 0.5], [1.6, 0], [2, 0],
  ];
  for (let i = 1; i < pts.length; i++) {
    if (lg <= pts[i][0]) { const [x0, y0] = pts[i - 1], [x1, y1] = pts[i]; const u = (lg - x0) / (x1 - x0); return y0 + (y1 - y0) * (u * u * (3 - 2 * u)); }
  }
  return 0;
}
function fmtLambda(m: number): string {
  if (m < 1e-12) return `${fmt(m * 1e15, 1)} fm`;
  if (m < 1e-9) return `${fmt(m * 1e12, 1)} pm`;
  if (m < 1e-6) return `${fmt(m * 1e9, 1)} nm`;
  if (m < 1e-3) return `${fmt(m * 1e6, 2)} µm`;
  if (m < 1e-2) return `${fmt(m * 1e3, 2)} mm`;
  if (m < 1) return `${fmt(m * 1e2, 1)} cm`;
  return `${fmt(m, 1)} m`;
}
function fmtFreq(hz: number): string {
  if (hz > 1e18) return `${(hz / 1e18).toPrecision(3)} EHz`;
  if (hz > 1e15) return `${(hz / 1e15).toPrecision(3)} PHz`;
  if (hz > 1e12) return `${(hz / 1e12).toPrecision(3)} THz`;
  if (hz > 1e9) return `${(hz / 1e9).toPrecision(3)} GHz`;
  if (hz > 1e6) return `${(hz / 1e6).toPrecision(3)} MHz`;
  return `${(hz / 1e3).toPrecision(3)} kHz`;
}
function fmtEnergy(ev: number): string {
  if (ev >= 1e9) return `${(ev / 1e9).toPrecision(3)} GeV`;
  if (ev >= 1e6) return `${(ev / 1e6).toPrecision(3)} MeV`;
  if (ev >= 1e3) return `${(ev / 1e3).toPrecision(3)} keV`;
  if (ev >= 1) return `${ev.toPrecision(3)} eV`;
  if (ev >= 1e-3) return `${(ev * 1e3).toPrecision(3)} meV`;
  return `${(ev * 1e6).toPrecision(3)} µeV`;
}
function fmtTemp(k: number): string {
  if (k > 1e6) return `${(k / 1e6).toPrecision(2)} million K`;
  if (k > 1e4) return `${Math.round(k / 1000)} 000 K`;
  if (k > 10) return `${Math.round(k)} K`;
  return `${k.toPrecision(2)} K`;
}

class SpectrumWidget extends CanvasWidget {
  private lg = Math.log10(5.5e-7);
  private phase = 0;

  constructor() {
    super(480 / 300);
    this.slider('Wavelength', LOG_MIN, LOG_MAX, 0.01, this.lg, (v) => fmtLambda(10 ** v), (v) => { this.lg = v; });
    const setFromX = (clientX: number) => {
      const r = this.canvas.getBoundingClientRect();
      const u = (clientX - r.left - 12) / (this.w - 24);
      this.lg = Math.max(LOG_MIN, Math.min(LOG_MAX, LOG_MIN + u * (LOG_MAX - LOG_MIN)));
      (this.controls.querySelector('input') as HTMLInputElement).value = String(this.lg);
      (this.controls.querySelector('.lw-slider-value') as HTMLElement).textContent = fmtLambda(10 ** this.lg);
    };
    let down = false;
    this.canvas.addEventListener('pointerdown', (e) => { down = true; setFromX(e.clientX); this.canvas.setPointerCapture(e.pointerId); });
    this.canvas.addEventListener('pointermove', (e) => { if (down) setFromX(e.clientX); });
    this.canvas.addEventListener('pointerup', () => { down = false; });
    this.canvas.style.cursor = 'crosshair';
    this.controls.appendChild($('div', 'lw-caption', 'Click or drag on the spectrum.'));
  }

  protected draw(dt: number) {
    const c = this.ctx;
    this.phase += dt * 2.2;
    c.fillStyle = C.bg; c.fillRect(0, 0, this.w, this.h);
    const x0 = 12, x1 = this.w - 12;
    const X = (lg: number) => x0 + (lg - LOG_MIN) / (LOG_MAX - LOG_MIN) * (x1 - x0);
    const waveY = 34, atmTop = 62, atmH = 46, bandY = atmTop + atmH + 6, bandH = 26, telY = bandY + bandH + 14;

    // wave animation: pixel wavelength grows with log λ
    const pxL = 5 + 150 * (this.lg - LOG_MIN) / (LOG_MAX - LOG_MIN);
    c.beginPath();
    for (let x = x0; x <= x1; x++) { const y = waveY + Math.sin((x / pxL) * TAU - this.phase) * 9; if (x === x0) c.moveTo(x, y); else c.lineTo(x, y); }
    c.strokeStyle = C.accent; c.lineWidth = 1.3; c.stroke();
    this.text('the wave, to scale with the slider', x0, 12, C.faint, 9);

    // atmosphere transmission
    c.beginPath(); c.moveTo(x0, atmTop + atmH);
    for (let x = x0; x <= x1; x += 2) { const lg = LOG_MIN + (x - x0) / (x1 - x0) * (LOG_MAX - LOG_MIN); c.lineTo(x, atmTop + atmH - transmission(lg) * atmH); }
    c.lineTo(x1, atmTop + atmH); c.closePath();
    c.fillStyle = 'rgba(111,163,214,0.22)'; c.fill(); c.strokeStyle = 'rgba(111,163,214,0.8)'; c.lineWidth = 1; c.stroke();
    this.text('atmospheric transparency (ground level)', x0 + 4, atmTop - 6, C.blue, 9);
    this.text('opaque', x0 + 4, atmTop + atmH - 6, C.faint, 9);

    // bands
    for (const b of BANDS) {
      const a = X(Math.log10(b.lo)), z = X(Math.log10(b.hi));
      if (b.name === 'Visible') {
        const g = c.createLinearGradient(a, 0, z, 0);
        ['#8a4fd6', '#4f6fe8', '#4fc1e8', '#5fd68a', '#e8e04f', '#f08c3a', '#e8453a'].forEach((col, i, arr) => g.addColorStop(i / (arr.length - 1), col));
        c.fillStyle = g;
      } else c.fillStyle = b.color + '55';
      c.fillRect(a, bandY, z - a, bandH);
      if (z - a > 36) this.text(b.name, (a + z) / 2, bandY + bandH / 2, b.name === 'Visible' ? '#111' : C.text, 10, 'center');
    }
    // axis ticks
    for (let lg = LOG_MIN; lg <= LOG_MAX; lg += 2) { const x = X(lg); this.line(x, bandY + bandH, x, bandY + bandH + 4, C.dim); this.text(`10${sup(lg)} m`, x, bandY + bandH + 10, C.dim, 9, 'center', 'mono'); }

    // telescopes
    for (const t of TELESCOPES) {
      const a = X(Math.log10(t.lo)), z = X(Math.log10(t.hi)), y = telY + 10 + t.row * 14;
      this.line(a, y, z, y, t.space ? C.accent : C.green, 3);
      this.text(t.name, (a + z) / 2, y - 7, t.space ? C.accent : C.green, 9, 'center');
    }
    this.text('space', x1, telY + 2, C.accent, 9, 'right');
    this.text('ground', x1 - 36, telY + 2, C.green, 9, 'right');

    // marker
    const mx = X(this.lg);
    this.line(mx, 20, mx, telY + 44, 'rgba(255,255,255,0.55)', 1, [3, 3]);
    this.circle(mx, atmTop + atmH - transmission(this.lg) * atmH, 3.5, undefined, C.text);

    const lam = 10 ** this.lg, nu = 2.998e8 / lam, ev = 1.2398e-6 / lam, T = 2.898e-3 / lam, tr = transmission(this.lg);
    const band = BANDS.find((b) => lam >= b.lo && lam < b.hi) ?? BANDS[BANDS.length - 1];
    this.setReadout([
      ['Band', band.name, band.name === 'Visible' ? C.text : band.color],
      ['Wavelength λ', fmtLambda(lam)],
      ['Frequency ν = c/λ', fmtFreq(nu)],
      ['Photon energy E = hν', fmtEnergy(ev)],
      ['Blackbody peaking here', fmtTemp(T)],
      ['Reaches the ground?', tr > 0.6 ? 'yes' : tr > 0.2 ? 'partly' : 'no — needs a space telescope', tr > 0.6 ? C.green : tr > 0.2 ? C.accent : C.red],
      ['Typical sources', band.source],
    ]);
  }
}
const sup = (n: number) => String(n).replace('-', '⁻').replace(/\d/g, (d) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[+d]);

/* ===================================================== Chapter 2 widgets ==== */

/** Kepler's equation: mean anomaly M (rad) → true anomaly θ and r/a for eccentricity e < 1 */
function kepler(M: number, e: number): { theta: number; r: number } {
  let E = e < 0.8 ? M : Math.PI;
  for (let i = 0; i < 12; i++) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
  const theta = 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2));
  return { theta, r: 1 - e * Math.cos(E) };
}

/* ------------------------------------------------------- 7. the ellipse ---- */

class EllipseWidget extends CanvasWidget {
  private e = 0.5;
  private M = 0;
  private theta = 0;
  private speed = 0.25;   // orbits per second

  constructor(conics: boolean) {
    super(480 / 380);
    this.playButton();
    this.slider('Eccentricity e', 0, conics ? 1.6 : 0.95, 0.01, this.e, (v) => fmt(v, 2), (v) => { this.e = v; });
    this.slider('Speed', 0.05, 1, 0.05, this.speed, (v) => fmt(v, 2), (v) => { this.speed = v; });
  }

  protected draw(dt: number) {
    const c = this.ctx;
    const e = this.e;
    c.fillStyle = C.bg; c.fillRect(0, 0, this.w, this.h);
    const open = e >= 1;
    // scale: keep the semi-latus rectum p = a(1−e²) fixed on screen so all conics pass through the same point
    const Sx = this.w * 0.56, Sy = this.h / 2;
    const pPx = Math.min(this.w, this.h) * 0.27;
    const a = open ? NaN : pPx / (1 - e * e);
    const b = open ? NaN : a * Math.sqrt(1 - e * e);
    const cx = open ? NaN : Sx - a * e;
    const R = (th: number) => pPx / (1 + e * Math.cos(th));

    if (dt > 0) {
      if (!open) { this.M = (this.M + dt * this.speed * TAU) % TAU; this.theta = kepler(this.M, e).theta; }
      else {
        const lim = Math.acos(-1 / e) - 0.05;
        this.theta += dt * this.speed * 1.2 * (1 + e * Math.cos(this.theta)) ** 2 / (1 + e) ** 2;
        if (this.theta > lim) this.theta = -lim;
      }
    }

    // axes & centre
    if (!open) {
      this.line(cx - a, Sy, cx + a, Sy, C.grid);
      this.line(cx, Sy - b, cx, Sy + b, C.grid);
      this.circle(cx, Sy, 2, undefined, C.dim);
      this.text('centre', cx, Sy + 12, C.dim, 10, 'center');
      // a and b labels
      this.line(cx, Sy - b - 10, cx + a, Sy - b - 10, C.accent, 1);
      this.text('a', cx + a / 2, Sy - b - 18, C.accent, 11, 'center', 'serif');
      this.line(cx - a - 10, Sy, cx - a - 10, Sy - b, C.blue, 1);
      this.text('b', cx - a - 18, Sy - b / 2, C.blue, 11, 'center', 'serif');
      // second focus
      const F2 = cx - a * e;
      this.circle(F2, Sy, 3, C.faint, undefined, 1);
      this.text('empty focus', F2, Sy + 13, C.faint, 10, 'center');
    } else {
      this.line(Sx - this.w, Sy, Sx + this.w, Sy, C.grid);
    }
    // the curve
    c.beginPath();
    const lim = open ? Math.acos(-1 / e) - 0.02 : Math.PI;
    for (let i = 0; i <= 400; i++) {
      const th = -lim + (2 * lim * i) / 400;
      const r = R(th);
      if (r < 0 || r > 4000) continue;
      const x = Sx + r * Math.cos(th), y = Sy - r * Math.sin(th);
      if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
    }
    if (!open) c.closePath();
    c.strokeStyle = C.text; c.lineWidth = 1.5; c.stroke();
    if (open && e === 1) this.text('parabola', Sx - pPx * 1.0, Sy - pPx * 1.6, C.dim, 10, 'center', 'serif');

    // planet
    const r = R(this.theta);
    const px = Sx + r * Math.cos(this.theta), py = Sy - r * Math.sin(this.theta);
    this.line(Sx, Sy, px, py, C.red, 1.2);
    this.text('r', (Sx + px) / 2 + 6, (Sy + py) / 2 - 6, C.red, 11, 'center', 'serif');
    // θ arc
    c.beginPath(); c.arc(Sx, Sy, 22, -this.theta, 0, this.theta < 0); c.strokeStyle = C.green; c.lineWidth = 1; c.stroke();
    this.text('θ', Sx + 30 * Math.cos(this.theta / 2), Sy - 30 * Math.sin(this.theta / 2), C.green, 11, 'center', 'serif');
    if (!open) {
      const F2 = cx - a * e;
      this.line(F2, Sy, px, py, 'rgba(255,255,255,0.18)', 1, [3, 3]);
    }
    this.glow(Sx, Sy, 16, 'rgba(242,196,90,0.55)');
    this.circle(Sx, Sy, 5, undefined, C.sun);
    this.text('Sun · focus', Sx, Sy + 14, C.dim, 10, 'center');
    this.circle(px, py, 4, undefined, C.earth);
    // perihelion / aphelion marks
    if (!open) {
      this.text('perihelion', Sx + R(0) + 6, Sy, C.dim, 10, 'left');
      this.text('aphelion', Sx + R(Math.PI) * Math.cos(Math.PI) - 6, Sy, C.dim, 10, 'right');
    }

    const kind = e < 1 ? (e < 0.005 ? 'circle' : 'ellipse') : e === 1 ? 'parabola' : 'hyperbola';
    const ro: Array<[string, string, string?]> = [
      ['Curve', `${kind} · e = ${fmt(e, 2)}`, e < 1 ? C.green : e === 1 ? C.accent : C.red],
      ['r / a now', open ? '—' : fmt(r / a, 3)],
    ];
    if (!open) {
      ro.push(['b / a = √(1 − e²)', fmt(Math.sqrt(1 - e * e), 3)], ['Perihelion r_p / a', fmt(1 - e, 3)], ['Aphelion r_a / a', fmt(1 + e, 3)], ['Sun off centre by', `${fmt(e * 100, 0)} % of a`]);
    } else ro.push(['Total energy', e > 1 ? 'positive — unbound' : 'zero — barely unbound', C.red], ['Asymptote angle', e > 1 ? `±${fmt(Math.acos(-1 / e) / DEG, 0)}°` : '±180°']);
    this.setReadout(ro);
  }
}

/* ------------------------------------------------ 8. Kepler's second law ---- */

class Kepler2Widget extends CanvasWidget {
  private e = 0.6;
  private M = 0;
  private speed = 0.12;
  private readonly N = 10;

  constructor() {
    super(480 / 360);
    this.playButton();
    this.slider('Eccentricity e', 0, 0.9, 0.01, this.e, (v) => fmt(v, 2), (v) => { this.e = v; });
    this.slider('Speed', 0.03, 0.5, 0.01, this.speed, (v) => fmt(v, 2), (v) => { this.speed = v; });
  }

  protected draw(dt: number) {
    const c = this.ctx;
    const e = this.e;
    c.fillStyle = C.bg; c.fillRect(0, 0, this.w, this.h);
    if (dt > 0) this.M = (this.M + dt * this.speed * TAU) % TAU;
    const a = Math.min(this.w * 0.42, this.h * 0.44);
    const cx = this.w / 2, Sy = this.h / 2;   // ellipse centred on the canvas, Sun at the right-hand focus
    const Sx = cx + a * e;
    const b = a * Math.sqrt(1 - e * e);
    const pos = (M: number) => { const k = kepler(M, e); const r = k.r * a; return { x: Sx + r * Math.cos(k.theta), y: Sy - r * Math.sin(k.theta), r: k.r, theta: k.theta }; };

    // orbit
    c.beginPath(); c.ellipse(cx, Sy, a, b, 0, 0, TAU); c.strokeStyle = C.line; c.lineWidth = 1; c.stroke();

    // equal-time sectors: N per orbit; the current one fills live, all others shown faintly
    const seg = TAU / this.N;
    const cur = Math.floor(this.M / seg);
    for (let i = 0; i < this.N; i++) {
      const m0 = i * seg, m1 = i === cur ? this.M : (i + 1) * seg;
      if (i > cur) continue;
      c.beginPath(); c.moveTo(Sx, Sy);
      for (let j = 0; j <= 24; j++) { const p = pos(m0 + ((m1 - m0) * j) / 24); c.lineTo(p.x, p.y); }
      c.closePath();
      c.fillStyle = i === cur ? 'rgba(189,155,108,0.45)' : i % 2 ? 'rgba(111,163,214,0.16)' : 'rgba(127,191,138,0.16)';
      c.fill();
      c.strokeStyle = 'rgba(255,255,255,0.12)'; c.stroke();
    }
    const p = pos(this.M);
    this.line(Sx, Sy, p.x, p.y, C.accent, 1.2);
    this.glow(Sx, Sy, 16, 'rgba(242,196,90,0.55)');
    this.circle(Sx, Sy, 5, undefined, C.sun);
    // velocity arrow ∝ speed
    const v = Math.sqrt(2 / p.r - 1);                 // in units of circular speed at a
    const p2 = pos(this.M + 0.01);
    const tx = p2.x - p.x, ty = p2.y - p.y, tl = Math.hypot(tx, ty) || 1;
    const L = 14 + 26 * v;
    this.line(p.x, p.y, p.x + (tx / tl) * L, p.y + (ty / tl) * L, C.green, 2);
    this.circle(p.x, p.y, 4.5, undefined, C.earth);
    this.text(`sector ${cur + 1} of ${this.N} · each takes P/${this.N}`, 10, this.h - 12, C.dim, 10);
    this.text('every shaded sector has the same area', this.w - 10, this.h - 12, C.dim, 10, 'right');

    const vp = Math.sqrt((1 + e) / (1 - e));
    this.setReadout([
      ['Distance r / a', fmt(p.r, 3)],
      ['Speed v / v_circ', fmt(v, 3), C.green],
      ['v_p / v_a = (1+e)/(1−e)', fmt((1 + e) / (1 - e), 2)],
      ['Sector area', `πab / ${this.N} = ${fmt((Math.PI * Math.sqrt(1 - e * e)) / this.N, 3)} a²`],
      ['Perihelion speed', `${fmt(vp, 2)} v_circ`],
    ]);
  }
}

/* ------------------------------------------------- 9. Kepler's third law ---- */

const K3_BODIES: Array<[string, number, number, string]> = [
  ['Mercury', 0.387, 0.2408, '#b9b2a8'], ['Venus', 0.723, 0.6152, C.venus], ['Earth', 1, 1, C.earth], ['Mars', 1.524, 1.8808, C.mars],
  ['Ceres', 2.77, 4.60, '#9a9690'], ['Jupiter', 5.203, 11.862, '#d8b48a'], ['Saturn', 9.537, 29.457, '#e0d2a8'], ['Uranus', 19.19, 84.01, '#9fd3dc'],
  ['Neptune', 30.07, 164.8, '#6f8fd6'], ['Pluto', 39.48, 247.9, '#c9b8a8'], ['Halley', 17.83, 75.3, C.dim], ['Eris', 67.9, 559, '#d8d8d8'],
];

class Kepler3Widget extends CanvasWidget {
  private aTest = 2.5;

  constructor() {
    super(480 / 360);
    this.playing = false;
    this.slider('Test orbit a', -1, 2.1, 0.01, Math.log10(this.aTest), (v) => `${(10 ** v).toPrecision(3)} AU`, (v) => { this.aTest = 10 ** v; });
  }

  protected draw() {
    const c = this.ctx;
    c.fillStyle = C.bg; c.fillRect(0, 0, this.w, this.h);
    const L = 54, Rm = 16, T = 16, B = 36;
    const x0 = L, x1 = this.w - Rm, y0 = T, y1 = this.h - B;
    const la0 = -1, la1 = 2.1, lp0 = -1.5, lp1 = 3.15;
    const X = (a: number) => x0 + ((Math.log10(a) - la0) / (la1 - la0)) * (x1 - x0);
    const Y = (P: number) => y1 - ((Math.log10(P) - lp0) / (lp1 - lp0)) * (y1 - y0);
    // grid
    for (let d = -1; d <= 2; d++) { const x = X(10 ** d); this.line(x, y0, x, y1, C.grid); this.text(`${10 ** d} AU`, x, y1 + 10, C.dim, 9, 'center', 'mono'); }
    for (let d = -1; d <= 3; d++) { const y = Y(10 ** d); this.line(x0, y, x1, y, C.grid); this.text(d < 0 ? `${10 ** d} yr` : `${10 ** d} yr`, x0 - 4, y, C.dim, 9, 'right', 'mono'); }
    this.text('semi-major axis a (log)', (x0 + x1) / 2, y1 + 24, C.dim, 10, 'center');
    c.save(); c.translate(12, (y0 + y1) / 2); c.rotate(-Math.PI / 2); this.text('period P (log)', 0, 0, C.dim, 10, 'center'); c.restore();
    // the law
    c.beginPath();
    for (let i = 0; i <= 100; i++) { const a = 10 ** (la0 + ((la1 - la0) * i) / 100); const x = X(a), y = Y(a ** 1.5); if (i === 0) c.moveTo(x, y); else c.lineTo(x, y); }
    c.strokeStyle = C.accent; c.lineWidth = 1.5; c.stroke();
    this.text('P² = a³  (slope 3/2)', X(0.2) + 6, Y(0.2 ** 1.5) - 12, C.accent, 11, 'left', 'serif');
    // bodies
    for (const [name, a, P, col] of K3_BODIES) {
      const x = X(a), y = Y(P);
      this.glow(x, y, 7, 'rgba(255,255,255,0.25)');
      this.circle(x, y, 3, undefined, col);
      const right = a < 20;
      this.text(name, x + (right ? 7 : -7), y + (name === 'Halley' ? 9 : -8), C.text, 10, right ? 'left' : 'right');
    }
    // test point
    const a = this.aTest, P = a ** 1.5;
    const tx = X(a), ty = Y(P);
    this.line(tx, ty, tx, y1, 'rgba(212,106,90,0.5)', 1, [3, 3]);
    this.line(x0, ty, tx, ty, 'rgba(212,106,90,0.5)', 1, [3, 3]);
    this.circle(tx, ty, 5, C.red, 'rgba(212,106,90,0.3)', 1.5);

    this.setReadout([
      ['Test a', `${a.toPrecision(3)} AU`],
      ['P = a^(3/2)', `${P.toPrecision(3)} yr = ${(P * 365.25).toPrecision(3)} d`, C.red],
      ['a³ / P²', fmt((a ** 3) / (P * P), 3)],
      ['Mean orbital speed', `${fmt((29.78 * TAU * a) / (P * TAU), 1)} km/s`],
    ]);
  }
}

/* ------------------------------------------------- 10. Newton's cannon ---- */

class CannonWidget extends CanvasWidget {
  private vKm = 6.5;
  private readonly h0 = 0.08;   // mountain height in Earth radii
  private pos = { x: 0, y: 1.08 };
  private vel = { x: 0, y: 0 };
  private trail: Array<{ x: number; y: number }> = [];
  private state: 'flying' | 'landed' | 'escaped' = 'flying';
  private tSince = 0;
  private readonly VC = 7.905;  // km/s, circular speed at the surface (sets the unit)

  constructor() {
    super(480 / 400);
    this.slider('Launch speed', 0, 12, 0.1, this.vKm, (v) => `${fmt(v, 1)} km/s`, (v) => { this.vKm = v; this.reset(); });
    const b = $('button', 'lw-play', '↺'); b.title = 'Fire again';
    b.addEventListener('click', () => this.reset());
    this.controls.appendChild(b);
    this.reset();
  }

  private reset() {
    this.pos = { x: 0, y: 1 + this.h0 };
    this.vel = { x: this.vKm / this.VC, y: 0 };
    this.trail = [{ ...this.pos }];
    this.state = 'flying';
    this.tSince = 0;
  }

  protected draw(dt: number) {
    const c = this.ctx;
    c.fillStyle = C.bg; c.fillRect(0, 0, this.w, this.h);
    const r0 = 1 + this.h0;
    const vcirc = Math.sqrt(1 / r0), vesc = Math.sqrt(2 / r0);
    const v = this.vKm / this.VC;
    const invA = 2 / r0 - v * v;                      // 1/a
    const eOrb = Math.abs(r0 * v * v - 1);
    // physics: GM = 1, R = 1
    if (this.state === 'flying' && dt > 0) {
      let steps = 40;
      const h = (dt * 2.2) / steps;
      for (let i = 0; i < steps; i++) {
        const r = Math.hypot(this.pos.x, this.pos.y);
        const ax = -this.pos.x / (r * r * r), ay = -this.pos.y / (r * r * r);
        this.vel.x += ax * h / 2; this.vel.y += ay * h / 2;
        this.pos.x += this.vel.x * h; this.pos.y += this.vel.y * h;
        const r2 = Math.hypot(this.pos.x, this.pos.y);
        this.vel.x += -this.pos.x / (r2 ** 3) * h / 2; this.vel.y += -this.pos.y / (r2 ** 3) * h / 2;
        if (r2 < 1) { this.state = 'landed'; break; }
        if (r2 > 9) { this.state = 'escaped'; break; }
      }
      const last = this.trail[this.trail.length - 1];
      if (Math.hypot(this.pos.x - last.x, this.pos.y - last.y) > 0.01) this.trail.push({ ...this.pos });
      if (this.trail.length > 1200) this.trail.shift();
    } else if (dt > 0) {
      this.tSince += dt;
      if (this.tSince > 1.6) this.reset();
    }

    const apo = invA > 0 ? (2 / invA - r0) : Infinity;
    // frame the whole orbit: launch point at the top (r0), far side at the bottom (apogee, capped)
    const bottom = Math.min(Math.max(1.4, Number.isFinite(apo) ? apo * 1.04 : 3.6), 4.4);
    const aOrb = (r0 + Math.min(Number.isFinite(apo) ? apo : 3.6, 4.4)) / 2;
    const eFit = Math.abs(aOrb - r0) / aOrb;
    const bOrb = Math.max(1.05, aOrb * Math.sqrt(Math.max(0, 1 - eFit * eFit)));
    const S = Math.min((this.h - 36) / (r0 + bottom), (this.w / 2 - 12) / bOrb);
    const cx = this.w / 2, cy = 18 + r0 * S;
    const P = (p: { x: number; y: number }) => ({ x: cx + p.x * S, y: cy - p.y * S });
    // predicted conic (faint)
    if (v > 0.05) {
      c.beginPath();
      const peri = v >= vcirc;                          // launch point is periapsis when faster than circular
      const p = r0 * (1 + (peri ? eOrb : -eOrb));       // semi-latus rectum from r0 = p/(1 ± e)
      let started = false;
      for (let i = 0; i <= 400; i++) {
        const th = -Math.PI + (TAU * i) / 400;
        const r = p / (1 + (peri ? eOrb : -eOrb) * Math.cos(th));
        if (r < 0 || r > 20) { started = false; continue; }
        // launch point at angle 90° (top), moving +x
        const ang = Math.PI / 2 - th;
        const q = P({ x: r * Math.cos(ang), y: r * Math.sin(ang) });
        if (!started) { c.moveTo(q.x, q.y); started = true; } else c.lineTo(q.x, q.y);
      }
      c.strokeStyle = 'rgba(255,255,255,0.12)'; c.lineWidth = 1; c.setLineDash([3, 4]); c.stroke(); c.setLineDash([]);
    }
    // Earth
    const E = P({ x: 0, y: 0 });
    this.circle(E.x, E.y, S, undefined, 'rgba(95,154,216,0.22)');
    this.circle(E.x, E.y, S, C.earth, undefined, 1.2);
    // atmosphere hint & mountain
    const M = P({ x: 0, y: r0 });
    c.beginPath(); c.moveTo(E.x - 0.06 * S, E.y - S + 2); c.lineTo(M.x, M.y); c.lineTo(E.x + 0.06 * S, E.y - S + 2); c.closePath(); c.fillStyle = '#6d6a63'; c.fill();
    // trail
    c.beginPath();
    this.trail.forEach((t, i) => { const q = P(t); if (i === 0) c.moveTo(q.x, q.y); else c.lineTo(q.x, q.y); });
    c.strokeStyle = C.accent; c.lineWidth = 1.6; c.stroke();
    const B = P(this.pos);
    if (this.state !== 'landed') { this.glow(B.x, B.y, 8, 'rgba(189,155,108,0.6)'); this.circle(B.x, B.y, 3, undefined, C.text); }
    this.text(this.state === 'landed' ? 'hit the ground' : this.state === 'escaped' ? 'gone — escape trajectory' : '', cx, this.h - 14, this.state === 'landed' ? C.red : C.green, 11, 'center');

    const kind = v < vcirc * 0.999 ? (invA > 0 && 2 / invA - r0 < 1 ? 'sub-orbital — falls back' : 'elliptical orbit (launch at apogee)') : v < vcirc * 1.001 ? 'circular orbit' : v < vesc ? 'elliptical orbit (launch at perigee)' : v === vesc ? 'parabola — just escapes' : 'hyperbola — escapes';
    this.setReadout([
      ['Launch speed', `${fmt(this.vKm, 1)} km/s`],
      ['Circular speed here', `${fmt(vcirc * this.VC, 2)} km/s`, C.green],
      ['Escape speed here', `${fmt(vesc * this.VC, 2)} km/s`, C.red],
      ['Result', kind, v >= vesc ? C.red : v >= vcirc * 0.999 ? C.green : C.accent],
      ['Total energy E', `${fmt((v * v / 2 - 1 / r0), 3)} (units GMm/R)`, invA > 0 ? C.green : C.red],
      ['Highest point', Number.isFinite(apo) && invA > 0 ? `${fmt((Math.max(apo, r0) - 1) * 6371, 0)} km up` : '∞'],
    ]);
  }
}

/* ----------------------------------------------------- 11. two bodies ---- */

const PAIRS: Record<string, { q: number; r1: number; r2: number; e: number; c1: string; c2: string; note: string }> = {
  'Earth–Moon': { q: 81.3, r1: 0.0166, r2: 0.0045, e: 0.055, c1: C.earth, c2: '#c9c4b8', note: 'centre of mass 4 670 km from Earth\'s centre — inside the Earth' },
  'Pluto–Charon': { q: 8.2, r1: 0.061, r2: 0.031, e: 0.0, c1: '#c9b8a8', c2: '#8f8a84', note: 'centre of mass 2 130 km above Pluto\'s surface — a true double planet' },
  'Sirius A–B': { q: 2.02, r1: 0.004, r2: 0.002, e: 0.59, c1: '#dfe8ff', c2: '#aab8d8', note: 'a 50-year binary: a 2.0 M☉ star and a 1.0 M☉ white dwarf' },
  'Equal masses': { q: 1, r1: 0.03, r2: 0.03, e: 0.3, c1: C.sun, c2: C.mars, note: 'identical ellipses, always diametrically opposite' },
};

class TwoBodyWidget extends CanvasWidget {
  private pair = 'Pluto–Charon';
  private M = 0;
  private speed = 0.2;

  constructor() {
    super(480 / 360);
    this.segmented(Object.keys(PAIRS).map((k) => [k, k] as [string, string]), this.pair, (p) => { this.pair = p; });
    this.playButton();
    this.slider('Speed', 0.05, 0.6, 0.05, this.speed, (v) => fmt(v, 2), (v) => { this.speed = v; });
  }

  protected draw(dt: number) {
    const c = this.ctx;
    const P = PAIRS[this.pair];
    const q = P.q, e = P.e;
    c.fillStyle = C.bg; c.fillRect(0, 0, this.w, this.h);
    if (dt > 0) this.M = (this.M + dt * this.speed * TAU) % TAU;
    const a = Math.min(this.w, this.h) * 0.4;                // separation semi-major axis in px
    const f1 = 1 / (q + 1), f2 = q / (q + 1);                // a1 = a·m2/(m1+m2), a2 = a·m1/(m1+m2)
    const cx = this.w / 2, cy = this.h / 2;
    const k = kepler(this.M, e);
    const dx = k.r * a * Math.cos(k.theta), dy = -k.r * a * Math.sin(k.theta);
    const b1 = { x: cx - dx * f1, y: cy - dy * f1 }, b2 = { x: cx + dx * f2, y: cy + dy * f2 };
    // ellipses about the COM (offset: COM is at a focus of each)
    const drawOrbit = (A: number, sign: number, col: string) => {
      const B = A * Math.sqrt(1 - e * e);
      c.beginPath(); c.ellipse(cx - sign * A * e, cy, A, B, 0, 0, TAU); c.strokeStyle = col; c.lineWidth = 1; c.setLineDash([3, 3]); c.stroke(); c.setLineDash([]);
    };
    drawOrbit(a * f1, -1, 'rgba(255,255,255,0.3)');
    drawOrbit(a * f2, 1, 'rgba(255,255,255,0.3)');
    this.line(b1.x, b1.y, b2.x, b2.y, 'rgba(255,255,255,0.18)', 1);
    // bodies
    const R1 = Math.max(3, P.r1 * a), R2 = Math.max(2.5, P.r2 * a);
    this.circle(b1.x, b1.y, R1, undefined, P.c1);
    this.circle(b2.x, b2.y, R2, undefined, P.c2);
    // COM
    this.line(cx - 7, cy, cx + 7, cy, C.accent, 1.4); this.line(cx, cy - 7, cx, cy + 7, C.accent, 1.4);
    this.text('centre of mass', cx + 10, cy - 10, C.accent, 10);
    const [n1, n2] = this.pair.split('–');
    this.text(n1, b1.x, b1.y - R1 - 9, C.text, 10, 'center');
    this.text(n2 ?? '', b2.x, b2.y - R2 - 9, C.text, 10, 'center');
    this.text(P.note, this.w / 2, this.h - 12, C.dim, 10, 'center');
    const insideR1 = a * f1 * (1 + e) < R1;
    this.setReadout([
      ['Mass ratio m₁ / m₂', fmt(q, 2)],
      ['a₁ / a₂ = m₂ / m₁', `${fmt(f1, 3)} / ${fmt(f2, 3)}`],
      ['Eccentricity', fmt(e, 2)],
      ['Centre of mass', insideR1 ? `inside ${n1}` : 'in open space', insideR1 ? C.green : C.accent],
      ['Same period', 'both bodies, always opposite'],
    ]);
  }
}

/* -------------------------------------------------- 12. virial theorem ---- */

class VirialWidget extends CanvasWidget {
  private e = 0.6;
  private M = 0;
  private speed = 0.15;
  private hist: Array<{ t: number; K: number; U: number }> = [];
  private t = 0;
  private sumK = 0; private sumU = 0; private n = 0;

  constructor() {
    super(480 / 360);
    this.playButton();
    this.slider('Eccentricity e', 0, 0.85, 0.01, this.e, (v) => fmt(v, 2), (v) => { this.e = v; this.reset(); });
    this.slider('Speed', 0.03, 0.5, 0.01, this.speed, (v) => fmt(v, 2), (v) => { this.speed = v; });
  }
  private reset() { this.hist = []; this.t = 0; this.sumK = this.sumU = 0; this.n = 0; this.M = 0; }

  protected draw(dt: number) {
    const c = this.ctx;
    const e = this.e;
    c.fillStyle = C.bg; c.fillRect(0, 0, this.w, this.h);
    // units: GM = 1, a = 1, m = 1  → U = −1/r, K = (2/r − 1)/2, E = −1/2
    const k = kepler(this.M, e);
    const U = -1 / k.r, K = (2 / k.r - 1) / 2;
    if (dt > 0) {
      this.M = (this.M + dt * this.speed * TAU) % TAU;
      this.t += dt * this.speed;                    // in orbits
      this.sumK += K * dt; this.sumU += U * dt; this.n += dt;
      this.hist.push({ t: this.t, K, U });
      while (this.hist.length && this.t - this.hist[0].t > 3) this.hist.shift();
    }
    const avgK = this.n ? this.sumK / this.n : K, avgU = this.n ? this.sumU / this.n : U;

    // left: orbit
    const ox = this.w * 0.2, oy = this.h * 0.42, A = this.w * 0.13, B = A * Math.sqrt(1 - e * e);
    c.beginPath(); c.ellipse(ox - A * e, oy, A, B, 0, 0, TAU); c.strokeStyle = C.line; c.lineWidth = 1; c.stroke();
    const px = ox + k.r * A * Math.cos(k.theta), py = oy - k.r * A * Math.sin(k.theta);
    this.line(ox, oy, px, py, 'rgba(255,255,255,0.2)');
    this.glow(ox, oy, 12, 'rgba(242,196,90,0.5)'); this.circle(ox, oy, 4, undefined, C.sun); this.circle(px, py, 3.5, undefined, C.earth);
    // energy bars
    const bx = ox - 60, by = this.h * 0.62, bw = 120, scale = 40;
    const bar = (label: string, val: number, y: number, col: string) => {
      const zero = bx + bw / 2;
      c.fillStyle = col; c.fillRect(Math.min(zero, zero + val * scale), y, Math.abs(val * scale), 10);
      this.text(label, bx - 6, y + 5, C.dim, 10, 'right', 'serif');
      this.text(fmt(val, 2), bx + bw + 6, y + 5, col, 10, 'left', 'mono');
    };
    this.line(bx + bw / 2, by - 6, bx + bw / 2, by + 48, C.faint);
    bar('K', K, by, C.green); bar('U', U, by + 16, C.blue); bar('E', K + U, by + 32, C.text);
    this.text('units of GMm/a', bx + bw / 2, by + 58, C.faint, 9, 'center');

    // right: time series
    const gx0 = this.w * 0.42, gx1 = this.w - 12, gy0 = 14, gy1 = this.h - 30;
    const Y = (v: number) => gy1 - ((v + 2.6) / 3.6) * (gy1 - gy0);
    const t0 = Math.max(0, this.t - 3);
    const X = (t: number) => gx0 + ((t - t0) / 3) * (gx1 - gx0);
    for (const v of [1, 0.5, 0, -0.5, -1, -1.5, -2, -2.5]) { this.line(gx0, Y(v), gx1, Y(v), C.grid); this.text(fmt(v, 1), gx0 - 4, Y(v), C.faint, 9, 'right', 'mono'); }
    this.text('time (orbits) →', gx1, gy1 + 12, C.faint, 9, 'right');
    const series = (key: 'K' | 'U', col: string) => {
      c.beginPath();
      this.hist.forEach((h, i) => { const x = X(h.t), y = Y(h[key]); if (i === 0) c.moveTo(x, y); else c.lineTo(x, y); });
      c.strokeStyle = col; c.lineWidth = 1.5; c.stroke();
    };
    series('K', C.green); series('U', C.blue);
    this.line(gx0, Y(-0.5), gx1, Y(-0.5), C.text, 1);
    this.text('E = −½', gx0 + 4, Y(-0.5) - 8, C.text, 10, 'left', 'serif');
    this.line(gx0, Y(avgK), gx1, Y(avgK), C.green, 1, [4, 4]);
    this.text('⟨K⟩', gx1 - 4, Y(avgK) - 8, C.green, 10, 'right', 'serif');
    this.line(gx0, Y(avgU), gx1, Y(avgU), C.blue, 1, [4, 4]);
    this.text('⟨U⟩', gx1 - 4, Y(avgU) + 9, C.blue, 10, 'right', 'serif');
    this.line(gx0, Y(-avgU / 2), gx1, Y(-avgU / 2), C.accent, 1, [2, 3]);
    this.text('−½⟨U⟩', gx1 - 40, Y(-avgU / 2) - 8, C.accent, 10, 'right', 'serif');

    this.setReadout([
      ['K now', fmt(K, 3), C.green], ['U now', fmt(U, 3), C.blue], ['E = K + U', fmt(K + U, 3)],
      ['⟨K⟩', fmt(avgK, 3), C.green], ['−½⟨U⟩', fmt(-avgU / 2, 3), C.accent],
      ['⟨K⟩ / ⟨U⟩', this.n > 0.05 ? fmt(avgK / avgU, 3) + '  (→ −0.5)' : '—'],
    ]);
  }
}

/* ------------------------------------------------- physics helpers (ch. 3) ---- */

const H_PLANCK = 6.62607015e-34, C_LIGHT = 2.99792458e8, K_B = 1.380649e-23, SIGMA_SB = 5.670374419e-8;
const EV = 1.602176634e-19;
const PC_M = 3.0857e16;
const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
/** 1.23 × 10⁻⁷ */
function sci(x: number, d = 2): string {
  if (x === 0 || !Number.isFinite(x)) return String(x);
  const e = Math.floor(Math.log10(Math.abs(x)));
  const m = x / 10 ** e;
  if (e >= -2 && e <= 3) return x.toFixed(Math.max(0, d - e));
  const es = String(Math.abs(e)).split('').map((ch) => SUP[+ch]).join('');
  return `${m.toFixed(d)} × 10${e < 0 ? '⁻' : ''}${es}`;
}
/** Planck function B_λ(T) in W m⁻³ sr⁻¹; λ in metres */
function planck(lam: number, T: number): number {
  const x = (H_PLANCK * C_LIGHT) / (lam * K_B * T);
  if (x > 700) return 0;
  return (2 * H_PLANCK * C_LIGHT * C_LIGHT) / lam ** 5 / Math.expm1(x);
}
/** approximate sRGB colour of a blackbody at temperature T (K) */
function tempRGB(T: number): [number, number, number] {
  const t = Math.min(40000, Math.max(1000, T)) / 100;
  let r: number, g: number, b: number;
  if (t <= 66) {
    r = 255;
    g = 99.4708025861 * Math.log(t) - 161.1195681661;
    b = t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  } else {
    r = 329.698727446 * Math.pow(t - 60, -0.1332047592);
    g = 288.1221695283 * Math.pow(t - 60, -0.0755148492);
    b = 255;
  }
  const cl = (v: number) => Math.max(0, Math.min(255, v));
  return [cl(r), cl(g), cl(b)];
}
/** approximate colour of monochromatic light of wavelength nm (380–780) */
function waveRGB(nm: number): [number, number, number] {
  let r = 0, g = 0, b = 0;
  if (nm >= 380 && nm < 440) { r = -(nm - 440) / 60; b = 1; }
  else if (nm < 490) { g = (nm - 440) / 50; b = 1; }
  else if (nm < 510) { g = 1; b = -(nm - 510) / 20; }
  else if (nm < 580) { r = (nm - 510) / 70; g = 1; }
  else if (nm < 645) { r = 1; g = -(nm - 645) / 65; }
  else if (nm <= 780) { r = 1; }
  let f = 1;
  if (nm < 420) f = 0.3 + 0.7 * (nm - 380) / 40; else if (nm > 700) f = 0.3 + 0.7 * (780 - nm) / 80;
  if (nm < 380 || nm > 780) f = 0;
  return [255 * r * f, 255 * g * f, 255 * b * f];
}
const rgba = (c: [number, number, number], a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
const hexA = (hex: string, a: number) => `rgba(${parseInt(hex.slice(1, 3), 16)},${parseInt(hex.slice(3, 5), 16)},${parseInt(hex.slice(5, 7), 16)},${a})`;
/** draw the visible rainbow between two x positions mapped from λ₀..λ₁ nm */
function rainbow(ctx: CanvasRenderingContext2D, X: (nm: number) => number, y: number, h: number, alpha = 0.55) {
  for (let nm = 380; nm < 780; nm += 2) {
    ctx.fillStyle = rgba(waveRGB(nm), alpha);
    ctx.fillRect(X(nm), y, Math.max(1, X(nm + 2) - X(nm) + 0.5), h);
  }
}
const log10 = Math.log10;

/* ------------------------------------------------- 13. stellar parallax ---- */

class ParallaxWidget extends CanvasWidget {
  private dpc = 2.5;         // distance in parsecs
  private phase = 0;         // Earth's orbital phase
  private speed = 0.25;      // orbits per second
  private bgStars: Array<{ x: number; y: number; s: number }> = [];

  constructor() {
    super(480 / 360);
    this.playButton();
    this.slider('Distance to star', log10(1.3), 2, 0.01, log10(this.dpc), (v) => `${fmt(10 ** v, 10 ** v < 10 ? 2 : 1)} pc`, (v) => { this.dpc = 10 ** v; });
    this.slider('Speed', 0.05, 1, 0.05, this.speed, (v) => `${fmt(v, 2)} yr/s`, (v) => { this.speed = v; });
    let seed = 7;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let i = 0; i < 70; i++) this.bgStars.push({ x: rnd(), y: rnd(), s: 0.6 + rnd() * 1.4 });
  }

  protected draw(dt: number) {
    const c = this.ctx;
    c.fillStyle = C.bg; c.fillRect(0, 0, this.w, this.h);
    if (dt > 0) this.phase = (this.phase + dt * this.speed * TAU) % TAU;
    const p = 1 / this.dpc;                   // arcsec
    const ex = Math.cos(this.phase), ey = Math.sin(this.phase);

    /* left: geometry (exaggerated) */
    const gw = this.w * 0.56;
    const sx = gw / 2, sy = this.h - 54, Ro = 30;
    const starY = this.h * 0.30;
    const E = { x: sx + ex * Ro, y: sy - ey * Ro * 0.35 };     // orbit seen obliquely
    // far background stars band
    for (const s of this.bgStars.slice(0, 25)) this.circle(10 + s.x * (gw - 20), 6 + s.y * 10, s.s * 0.6, undefined, 'rgba(220,220,230,0.5)');
    this.text('background stars (effectively at infinity)', gw / 2, 20, C.faint, 9, 'center');
    // orbit
    c.beginPath(); c.ellipse(sx, sy, Ro, Ro * 0.35, 0, 0, TAU); c.strokeStyle = C.line; c.lineWidth = 1; c.stroke();
    this.glow(sx, sy, 12, 'rgba(242,196,90,0.5)'); this.circle(sx, sy, 4, undefined, C.sun);
    this.text('Sun', sx + 8, sy + 10, C.dim, 9);
    // star
    const S = { x: sx, y: starY + 22 };
    this.glow(S.x, S.y, 10, 'rgba(239,233,216,0.5)'); this.circle(S.x, S.y, 3, undefined, C.star);
    this.text('nearby star', S.x + 10, S.y, C.text, 10);
    // lines of sight from the two extremes and from Earth now
    this.line(sx - Ro, sy, S.x, S.y, 'rgba(255,255,255,0.14)', 1, [3, 3]);
    this.line(sx + Ro, sy, S.x, S.y, 'rgba(255,255,255,0.14)', 1, [3, 3]);
    this.line(E.x, E.y, S.x, S.y, C.accent, 1.2);
    // extend current line of sight past the star to the background
    const dx = S.x - E.x, dy = S.y - E.y, L = Math.hypot(dx, dy);
    const far = { x: S.x + (dx / L) * (S.y - 8) / Math.max(0.3, -dy / L), y: 8 };
    this.line(S.x, S.y, far.x, far.y, 'rgba(189,155,108,0.35)', 1, [2, 3]);
    // baseline and angle label
    this.line(sx - Ro, sy + 14, sx + Ro, sy + 14, C.dim, 1);
    this.text('2 AU baseline', sx, sy + 24, C.dim, 9, 'center');
    c.beginPath(); c.arc(S.x, S.y, 26, Math.PI / 2 - 0.42, Math.PI / 2 + 0.42); c.strokeStyle = C.green; c.lineWidth = 1; c.stroke();
    this.text('2p', S.x, S.y + 36, C.green, 10, 'center', 'serif');
    this.circle(E.x, E.y, 3.5, undefined, C.earth);
    this.text('Earth', E.x + 7, E.y - 7, C.earth, 9);
    this.text('(angles hugely exaggerated)', gw / 2, this.h - 12, C.faint, 9, 'center');

    /* right: through the telescope */
    const vx0 = gw + 8, vw = this.w - vx0 - 8, vcx = vx0 + vw / 2, vcy = this.h / 2, R = Math.min(vw, this.h) / 2 - 10;
    c.save(); c.beginPath(); c.arc(vcx, vcy, R, 0, TAU); c.clip();
    c.fillStyle = '#05070b'; c.fillRect(vx0, 0, vw, this.h);
    for (const s of this.bgStars) this.circle(vcx - R + s.x * 2 * R, vcy - R + s.y * 2 * R, s.s * 0.8, undefined, 'rgba(220,220,230,0.75)');
    const K = Math.min(R * 0.6, 70 / this.dpc);                    // screen exaggeration
    // yearly trace
    c.beginPath(); c.ellipse(vcx, vcy, K, K * 0.35, 0, 0, TAU); c.strokeStyle = 'rgba(189,155,108,0.35)'; c.lineWidth = 1; c.setLineDash([2, 3]); c.stroke(); c.setLineDash([]);
    const nx = vcx - ex * K, ny = vcy + ey * K * 0.35;             // opposite to Earth's displacement
    this.glow(nx, ny, 12, 'rgba(239,233,216,0.7)'); this.circle(nx, ny, 3.2, undefined, '#fff');
    c.restore();
    this.circle(vcx, vcy, R, C.line, undefined, 1.2);
    this.line(vcx - 8, vcy, vcx + 8, vcy, 'rgba(255,255,255,0.15)'); this.line(vcx, vcy - 8, vcx, vcy + 8, 'rgba(255,255,255,0.15)');
    this.text('through the telescope · one year', vcx, 10, C.dim, 9, 'center');
    this.text('shift exaggerated ≈ 10⁵ × for visibility', vcx, this.h - 10, C.faint, 8, 'center');

    const d = this.dpc;
    this.setReadout([
      ['Distance d', `${fmt(d, 2)} pc = ${fmt(d * 3.2616, 2)} ly = ${sci(d * PC_M / 1e3, 2)} km`],
      ['Parallax p = 1/d', p >= 0.1 ? `${fmt(p, 3)}″` : `${fmt(p * 1000, 1)} mas`, C.green],
      ['Full yearly swing 2p', p >= 0.1 ? `${fmt(2 * p, 3)}″` : `${fmt(2000 * p, 1)} mas`],
      ['Gaia error 25 µas → distance error', `${fmt(100 * 25e-6 / p, p > 0.025 ? 2 : 1)} %`, 25e-6 / p < 0.1 ? C.green : C.red],
      ['Light travel time', `${fmt(d * 3.2616, 2)} years`],
    ]);
  }
}

/* ------------------------------------------------- 14. the magnitude scale ---- */

const MAG_OBJECTS: Array<[string, number]> = [
  ['Sun', -26.83], ['Full Moon', -12.7], ['Venus', -4.9], ['Jupiter', -2.9], ['Sirius', -1.46], ['Vega', 0.03],
  ['Polaris', 1.98], ['Naked eye', 6.5], ['Binoculars', 10], ['Pluto', 14], ['Hubble / JWST', 31],
];

class MagnitudeWidget extends CanvasWidget {
  private m1 = -1.46;
  private m2 = 6.5;
  constructor() {
    super(480 / 300);
    this.slider('Star A magnitude', -27, 32, 0.1, this.m1, (v) => fmt(v, 1), (v) => { this.m1 = v; });
    this.slider('Star B magnitude', -27, 32, 0.1, this.m2, (v) => fmt(v, 1), (v) => { this.m2 = v; });
    this.playing = false;
  }
  protected draw() {
    const c = this.ctx;
    c.fillStyle = C.bg; c.fillRect(0, 0, this.w, this.h);
    const x0 = 24, x1 = this.w - 24, ry = 92;
    const X = (m: number) => x0 + ((m + 27) / 59) * (x1 - x0);
    // ruler
    this.line(x0, ry, x1, ry, C.text, 1.2);
    for (let m = -25; m <= 30; m += 5) { this.line(X(m), ry - 5, X(m), ry + 5, C.text); this.text(fmt(m, 0), X(m), ry + 14, C.dim, 9, 'center', 'mono'); }
    this.text('brighter ←', x0, ry - 34, C.faint, 9, 'left'); this.text('→ fainter', x1, ry - 34, C.faint, 9, 'right');
    MAG_OBJECTS.forEach(([name, m], i) => {
      const x = X(m), up = i % 2 === 0;
      this.line(x, ry, x, up ? ry - 12 : ry + 20, C.faint);
      this.text(name, x, up ? ry - 19 : ry + 29, C.dim, 8, 'center');
    });
    // markers
    const mark = (m: number, label: string, col: string) => {
      const x = X(m);
      c.beginPath(); c.moveTo(x, ry - 8); c.lineTo(x - 5, ry - 16); c.lineTo(x + 5, ry - 16); c.closePath(); c.fillStyle = col; c.fill();
      this.text(label, x, ry - 44, col, 10, 'center', 'serif');
    };
    mark(this.m1, 'A', C.accent); mark(this.m2, 'B', C.blue);
    // brightness comparison
    const dm = this.m2 - this.m1;                    // B − A; positive → A brighter
    const ratio = 100 ** (dm / 5);                   // F_A / F_B
    const by = this.h * 0.66;
    const draw = (x: number, rel: number, col: [number, number, number], label: string, m: number) => {
      // disc area ∝ flux relative to the brighter one; floor for visibility
      const r = Math.max(1.2, 26 * Math.sqrt(rel));
      this.glow(x, by, r * 1.9, rgba(col, 0.5));
      this.circle(x, by, r, undefined, '#fff');
      this.text(label, x, by + 44, C.text, 10, 'center', 'serif');
      this.text(`m = ${fmt(m, 2)}`, x, by + 57, C.dim, 9, 'center', 'mono');
      if (rel < 0.002) this.text('(too faint to draw to scale)', x, by + 69, C.faint, 8, 'center');
    };
    const relA = dm >= 0 ? 1 : 1 / 100 ** (-dm / 5), relB = dm >= 0 ? 1 / ratio : 1;
    draw(this.w * 0.3, relA, [189, 155, 108], 'Star A', this.m1);
    draw(this.w * 0.7, relB, [111, 163, 214], 'Star B', this.m2);
    const txt = ratio >= 1 ? `A is ${ratio < 1e4 ? fmt(ratio, ratio < 10 ? 2 : 0) : sci(ratio, 1)} × brighter` : `B is ${1 / ratio < 1e4 ? fmt(1 / ratio, 1 / ratio < 10 ? 2 : 0) : sci(1 / ratio, 1)} × brighter`;
    this.text(txt, this.w / 2, by - 4, C.text, 12, 'center', 'serif');
    this.text(`Δm = ${fmt(Math.abs(dm), 1)} mag`, this.w / 2, by + 12, C.dim, 10, 'center', 'mono');
    this.setReadout([
      ['Magnitude difference Δm = m_B − m_A', fmt(dm, 2)],
      ['Flux ratio F_A / F_B = 100^(Δm/5)', ratio >= 1e4 || ratio <= 1e-4 ? sci(ratio, 2) : fmt(ratio, 3), C.green],
      ['log₁₀(F_A / F_B) = 0.4 Δm', fmt(0.4 * dm, 2)],
      ['One magnitude', '× 2.512 in flux · five magnitudes = × 100'],
    ]);
  }
}

/* --------------------------------------------- 15. inverse square & distance modulus ---- */

class DistModWidget extends CanvasWidget {
  private M = 4.74;          // absolute magnitude
  private logd = 1;          // log10 distance in pc
  private t = 0;
  constructor() {
    super(480 / 340);
    this.slider('Absolute magnitude M', -10, 16, 0.1, this.M, (v) => fmt(v, 1), (v) => { this.M = v; });
    this.slider('Distance', -1, 4, 0.01, this.logd, (v) => { const d = 10 ** v; return d < 1 ? `${fmt(d, 2)} pc` : d < 1000 ? `${fmt(d, 1)} pc` : `${fmt(d / 1000, 2)} kpc`; }, (v) => { this.logd = v; });
  }
  protected draw(dt: number) {
    const c = this.ctx;
    c.fillStyle = C.bg; c.fillRect(0, 0, this.w, this.h);
    this.t += dt;
    const d = 10 ** this.logd;
    const m = this.M + 5 * (this.logd - 1);
    const L = 10 ** (0.4 * (4.74 - this.M));
    const x0 = 46, x1 = this.w - 90, sy = this.h * 0.42;
    const X = (ld: number) => x0 + ((ld + 1) / 5) * (x1 - x0);
    // flux rays: density falls as the rays diverge (2-D stand-in for 1/r²)
    const n = 28;
    for (let i = 0; i < n; i++) {
      const a = -0.55 + (1.1 * i) / (n - 1);
      c.beginPath(); c.moveTo(x0, sy); c.lineTo(x0 + (x1 - x0 + 40) * Math.cos(a), sy + (x1 - x0 + 40) * Math.sin(a));
      c.strokeStyle = 'rgba(189,155,108,0.10)'; c.lineWidth = 1; c.stroke();
    }
    // shells
    for (const ld of [0, 1, 2, 3]) {
      const r = X(ld) - x0;
      c.beginPath(); c.arc(x0, sy, r, -0.6, 0.6); c.strokeStyle = C.line; c.lineWidth = 1; c.setLineDash([3, 4]); c.stroke(); c.setLineDash([]);
      this.text(ld === 0 ? '1 pc' : ld === 1 ? '10 pc' : ld === 2 ? '100 pc' : '1 kpc', X(ld), sy - r * Math.sin(0.6) - 8, ld === 1 ? C.accent : C.faint, 9, 'center');
    }
    this.text('each shell carries the same total power L', x0 + 10, this.h * 0.08, C.dim, 9);
    this.text('area 4πr² grows → flux per m² falls', x0 + 10, this.h * 0.08 + 12, C.dim, 9);
    // star
    const sr = 5 + 7 * Math.max(0, Math.min(1, (10 - this.M) / 20));
    const pulse = 1 + 0.05 * Math.sin(this.t * 3);
    this.glow(x0, sy, sr * 4 * pulse, 'rgba(242,196,90,0.5)'); this.circle(x0, sy, sr, undefined, '#fff3c4');
    this.text(`M = ${fmt(this.M, 1)}`, x0, sy + 22, C.sun, 10, 'center', 'mono');
    this.text(`L = ${sci(L, 1)} L☉`, x0, sy + 34, C.dim, 9, 'center', 'mono');
    // detector
    const dx = X(this.logd);
    c.fillStyle = '#2a2f3a'; c.fillRect(dx - 5, sy - 14, 10, 28);
    c.strokeStyle = C.text; c.lineWidth = 1; c.strokeRect(dx - 5, sy - 14, 10, 28);
    const rel = Math.min(1, 10 ** (-0.4 * (m + 2)));        // glow saturates near m ≈ −2
    this.glow(dx, sy, 14 + 30 * rel, `rgba(255,255,255,${0.15 + 0.6 * rel})`);
    this.text('detector', dx, sy + 24, C.text, 9, 'center');
    this.text(`m = ${fmt(m, 2)}`, dx, sy + 36, C.accent, 11, 'center', 'mono');
    // magnitude meter (right)
    const mx = this.w - 44, my0 = 16, my1 = this.h - 36;
    const Y = (mm: number) => my0 + ((mm + 27) / 58) * (my1 - my0);
    this.line(mx, my0, mx, my1, C.line, 2);
    for (const mm of [-26.8, -12.7, -1.5, 0, 6.5, 14, 31]) { this.line(mx - 4, Y(mm), mx + 4, Y(mm), C.faint); }
    this.text('Sun', mx + 8, Y(-26.8), C.faint, 8); this.text('Moon', mx + 8, Y(-12.7), C.faint, 8); this.text('Sirius', mx + 8, Y(-1.5), C.faint, 8);
    this.text('eye limit', mx + 8, Y(6.5), C.faint, 8); this.text('JWST', mx + 8, Y(31), C.faint, 8);
    const ym = Y(Math.max(-27, Math.min(31, m)));
    c.beginPath(); c.moveTo(mx - 6, ym); c.lineTo(mx - 14, ym - 5); c.lineTo(mx - 14, ym + 5); c.closePath(); c.fillStyle = C.accent; c.fill();
    this.text('apparent magnitude', mx, my1 + 12, C.dim, 8, 'center');
    const visible = m <= 6.5;
    this.setReadout([
      ['Distance d', d < 1000 ? `${fmt(d, 2)} pc = ${fmt(d * 3.2616, 1)} ly` : `${fmt(d / 1000, 2)} kpc = ${fmt(d * 3.2616 / 1000, 1)} kly`],
      ['Distance modulus m − M = 5 log₁₀(d/10 pc)', fmt(m - this.M, 2)],
      ['Apparent magnitude m', fmt(m, 2), C.accent],
      ['Flux relative to 10 pc', sci(10 ** (-0.4 * (m - this.M)), 2)],
      ['Visible to the naked eye?', visible ? `yes (m ≤ 6.5)` : `no — ${fmt(m - 6.5, 1)} mag too faint`, visible ? C.green : C.red],
    ]);
  }
}

/* ------------------------------------------------- 16. Young's double slit ---- */

class DoubleSlitWidget extends CanvasWidget {
  private lam = 550;         // nm
  private dum = 50;          // slit separation, µm
  private readonly aum = 10; // slit width, µm
  private readonly Lm = 1;   // screen distance, m
  private t = 0;
  constructor() {
    super(480 / 360);
    this.playButton();
    this.slider('Wavelength λ', 380, 750, 1, this.lam, (v) => `${fmt(v, 0)} nm`, (v) => { this.lam = v; });
    this.slider('Slit separation d', 20, 150, 1, this.dum, (v) => `${fmt(v, 0)} µm`, (v) => { this.dum = v; });
  }
  protected draw(dt: number) {
    const c = this.ctx;
    this.t += dt;
    c.fillStyle = C.bg; c.fillRect(0, 0, this.w, this.h);
    const col = waveRGB(this.lam);
    const xb = this.w * 0.26, xs = this.w * 0.80, cy = this.h / 2;
    const slitGap = 34;                                 // px, drawing only
    const s1 = { x: xb, y: cy - slitGap / 2 }, s2 = { x: xb, y: cy + slitGap / 2 };
    const lamPx = 12 * (this.lam / 550);
    const phase = (this.t * 1.6 * lamPx) % lamPx;
    // incoming plane waves
    for (let x = xb - phase; x > 8; x -= lamPx) this.line(x, 20, x, this.h - 20, rgba(col, 0.35), 1.2);
    this.text('plane waves', 12, 12, C.faint, 9);
    // barrier
    c.fillStyle = '#4a515c';
    c.fillRect(xb - 3, 10, 6, s1.y - 4 - 10); c.fillRect(xb - 3, s1.y + 4, 6, s2.y - 4 - (s1.y + 4)); c.fillRect(xb - 3, s2.y + 4, 6, this.h - 10 - (s2.y + 4));
    this.text('d', xb - 10, cy, C.text, 11, 'right', 'serif');
    // wavelets from each slit (clipped to the region between barrier and screen)
    c.save(); c.beginPath(); c.rect(xb, 0, xs - xb, this.h); c.clip();
    const maxR = Math.hypot(xs - xb, this.h / 2) + lamPx;
    for (const s of [s1, s2]) {
      for (let r = phase; r < maxR; r += lamPx) {
        c.beginPath(); c.arc(s.x, s.y, r, -Math.PI / 2, Math.PI / 2);
        c.strokeStyle = rgba(col, 0.28 * (1 - r / maxR) + 0.04); c.lineWidth = 1; c.stroke();
      }
    }
    c.restore();
    // physics on the screen: y in metres, screen shows ±60 mm
    const ymax = 0.06;
    const d = this.dum * 1e-6, a = this.aum * 1e-6, lam = this.lam * 1e-9;
    const I = (y: number) => {
      const sin = y / Math.hypot(this.Lm, y);
      const b = Math.PI * a * sin / lam, g = Math.PI * d * sin / lam;
      const env = b === 0 ? 1 : (Math.sin(b) / b) ** 2;
      return env * Math.cos(g) ** 2;
    };
    const stripW = 22;
    for (let py = 12; py < this.h - 12; py++) {
      const y = ((py - cy) / (this.h / 2 - 12)) * ymax;
      const v = I(y);
      c.fillStyle = rgba(col, 0.08 + 0.92 * v); c.fillRect(xs, py, stripW, 1);
    }
    c.strokeStyle = C.line; c.strokeRect(xs, 12, stripW, this.h - 24);
    // intensity graph to the right of the strip
    const gx0 = xs + stripW + 6, gw = this.w - gx0 - 6;
    c.beginPath();
    for (let py = 12; py < this.h - 12; py++) { const y = ((py - cy) / (this.h / 2 - 12)) * ymax; const x = gx0 + I(y) * gw; if (py === 12) c.moveTo(x, py); else c.lineTo(x, py); }
    c.strokeStyle = rgba(col, 0.9); c.lineWidth = 1.2; c.stroke();
    this.text('screen', xs + stripW / 2, 6, C.faint, 8, 'center'); this.text('I(y)', gx0 + gw / 2, 6, C.faint, 8, 'center');
    // first-order rays
    const dy = lam * this.Lm / d;                                   // fringe spacing, m
    const py1 = cy - (dy / ymax) * (this.h / 2 - 12);
    if (py1 > 14) {
      this.line(s1.x, s1.y, xs, py1, 'rgba(255,255,255,0.35)', 1, [2, 3]); this.line(s2.x, s2.y, xs, py1, 'rgba(255,255,255,0.35)', 1, [2, 3]);
      this.text('n = 1', xs - 6, py1 - 8, C.text, 9, 'right');
      this.text('path difference = λ', (xb + xs) / 2, py1 - 14, C.dim, 9, 'center');
    }
    this.text('n = 0', xs - 6, cy - 8, C.text, 9, 'right');
    const theta1 = Math.asin(Math.min(1, lam / d)) / DEG;
    this.setReadout([
      ['Wavelength λ', `${fmt(this.lam, 0)} nm`, rgba(col)],
      ['Fringe spacing Δy = λL/d  (L = 1 m)', `${fmt(dy * 1e3, 2)} mm`, C.green],
      ['First bright fringe  d sin θ = λ', `θ₁ = ${fmt(theta1, 3)}°`],
      ['Bright fringes within ±60 mm', `${2 * Math.floor(ymax / dy) + 1}`],
      ['Single-slit envelope (a = 10 µm) first zero', `±${fmt(lam * this.Lm / a * 1e3, 0)} mm`],
    ]);
  }
}

/* ------------------------------------------------- 17. electromagnetic wave ---- */

class EMWaveWidget extends CanvasWidget {
  private lam = 550;
  private t = 0;
  private show: 'both' | 'E' | 'B' = 'both';
  constructor() {
    super(480 / 280);
    this.playButton();
    this.segmented<'both' | 'E' | 'B'>([['both', 'E and B'], ['E', 'E only'], ['B', 'B only']], 'both', (v) => { this.show = v; });
    this.slider('Wavelength λ', 380, 750, 1, this.lam, (v) => `${fmt(v, 0)} nm`, (v) => { this.lam = v; });
  }
  protected draw(dt: number) {
    const c = this.ctx;
    this.t += dt;
    c.fillStyle = C.bg; c.fillRect(0, 0, this.w, this.h);
    const col = waveRGB(this.lam);
    const x0 = 30, x1 = this.w - 30, y0 = this.h * 0.5;
    const lamPx = 110 * (this.lam / 550);
    const k = TAU / lamPx, omega = k * 90;             // 90 px/s "c"
    const A = this.h * 0.3;
    const skx = 0.55, sky = 0.28;                      // projection of the depth axis
    // axes
    this.line(x0, y0, x1 + 10, y0, C.line, 1);
    c.beginPath(); c.moveTo(x1 + 10, y0); c.lineTo(x1 + 2, y0 - 4); c.lineTo(x1 + 2, y0 + 4); c.closePath(); c.fillStyle = C.line; c.fill();
    this.text('direction of travel →  speed c', x1 - 4, y0 + 14, C.dim, 9, 'right');
    this.line(x0, y0 - A - 8, x0, y0 + A + 8, C.grid); this.text('E', x0 - 10, y0 - A - 4, C.red, 11, 'center', 'serif');
    this.line(x0 - skx * 40, y0 + sky * 40, x0 + skx * 40, y0 - sky * 40, C.grid); this.text('B', x0 + skx * 40 + 10, y0 - sky * 40 - 4, C.blue, 11, 'center', 'serif');
    const Ecol = C.red, Bcol = C.blue;
    // field vectors
    const step = 9;
    for (let x = x0; x <= x1; x += step) {
      const v = Math.sin(k * (x - x0) - omega * this.t);
      if (this.show !== 'E') { // B in the depth plane
        const bx = x + skx * A * v, by = y0 - sky * A * v;
        this.line(x, y0, bx, by, rgba([111, 163, 214], 0.35 + 0.35 * Math.abs(v)), 1.3);
      }
      if (this.show !== 'B') this.line(x, y0, x, y0 - A * v, rgba([212, 106, 90], 0.35 + 0.4 * Math.abs(v)), 1.3);
    }
    // envelopes
    const curve = (fn: (v: number, x: number) => [number, number], stroke: string) => {
      c.beginPath();
      for (let x = x0; x <= x1; x += 2) { const v = Math.sin(k * (x - x0) - omega * this.t); const [px, py] = fn(v, x); if (x === x0) c.moveTo(px, py); else c.lineTo(px, py); }
      c.strokeStyle = stroke; c.lineWidth = 1.6; c.stroke();
    };
    if (this.show !== 'B') curve((v, x) => [x, y0 - A * v], Ecol);
    if (this.show !== 'E') curve((v, x) => [x + skx * A * v, y0 - sky * A * v], Bcol);
    // wavelength bracket between two crests
    const crest0 = x0 + ((omega * this.t) % lamPx) + lamPx * 0.25;
    const cx0 = crest0 > x1 - lamPx - 10 ? crest0 - lamPx : crest0;
    if (cx0 > x0 && cx0 + lamPx < x1) {
      const yb = y0 - A - 12;
      this.line(cx0, yb, cx0 + lamPx, yb, rgba(col), 1); this.line(cx0, yb - 4, cx0, yb + 4, rgba(col)); this.line(cx0 + lamPx, yb - 4, cx0 + lamPx, yb + 4, rgba(col));
      this.text(`λ = ${fmt(this.lam, 0)} nm`, cx0 + lamPx / 2, yb - 9, rgba(col), 10, 'center', 'serif');
    }
    // colour swatch
    c.fillStyle = rgba(col); c.fillRect(this.w - 46, 10, 36, 10); this.text('colour', this.w - 28, 28, C.faint, 8, 'center');
    const lam = this.lam * 1e-9, nu = C_LIGHT / lam;
    this.setReadout([
      ['Frequency ν = c/λ', `${sci(nu, 3)} Hz`],
      ['Period 1/ν', `${sci(1 / nu, 2)} s`],
      ['Photon energy hc/λ', `${fmt(1239.84 / this.lam, 2)} eV`, C.green],
      ['E ⟂ B ⟂ direction of travel; E and B in phase', `|E| / |B| = c`],
    ]);
  }
}

/* ------------------------------------------------- 18. blackbody curves ---- */

class BlackbodyWidget extends CanvasWidget {
  private T = 5772;
  private scale: 'fit' | 'fixed' = 'fit';
  constructor(private mode: 'planck' | 'catastrophe') {
    super(480 / 380);
    this.playing = false;
    if (mode === 'planck') this.segmented<'fit' | 'fixed'>([['fit', 'Scale: fit to curve'], ['fixed', 'Scale: fixed (compare)']], 'fit', (v) => { this.scale = v; });
    this.slider('Temperature T', log10(2000), log10(25000), 0.005, log10(this.T), (v) => `${fmt(10 ** v, 0)} K`, (v) => { this.T = 10 ** v; });
  }
  protected draw() {
    const c = this.ctx;
    c.fillStyle = C.bg; c.fillRect(0, 0, this.w, this.h);
    const T = this.T;
    const lam0 = 50, lam1 = this.mode === 'planck' ? 2500 : 2000;        // nm
    const gx0 = 44, gx1 = this.w - 14, gy0 = 18, gy1 = this.h - 46;
    const X = (nm: number) => gx0 + ((nm - lam0) / (lam1 - lam0)) * (gx1 - gx0);
    const lamMax = 2.897771955e6 / T;                                     // nm
    const peak = planck(lamMax * 1e-9, T);
    const yMax = this.scale === 'fixed' && this.mode === 'planck' ? planck(2.897771955e6 / 7000 * 1e-9, 7000) * 1.1 : peak * 1.12;
    const Y = (B: number) => gy1 - Math.min(1.5, B / yMax) * (gy1 - gy0);
    // visible band + axes
    rainbow(c, X, gy1 + 1, 7, 0.75);
    this.line(gx0, gy1, gx1, gy1, C.text, 1); this.line(gx0, gy0, gx0, gy1, C.line, 1);
    for (let nm = 0; nm <= lam1; nm += 500) if (nm >= lam0) { this.line(X(nm), gy1, X(nm), gy1 + 3, C.text); this.text(fmt(nm, 0), X(nm), gy1 + 16, C.dim, 9, 'center', 'mono'); }
    this.text('wavelength λ (nm)', gx1, gy1 + 28, C.dim, 9, 'right');
    c.save(); c.translate(12, (gy0 + gy1) / 2); c.rotate(-Math.PI / 2); this.text(this.scale === 'fixed' ? 'B_λ (fixed scale)' : 'B_λ (relative)', 0, 0, C.dim, 9, 'center'); c.restore();
    c.save(); c.beginPath(); c.rect(gx0, gy0 - 4, gx1 - gx0, gy1 - gy0 + 4); c.clip();
    // reference stars (planck mode)
    if (this.mode === 'planck') {
      for (const [name, Tr, colr] of [['Betelgeuse 3600 K', 3600, C.red], ['Sun 5772 K', 5772, C.sun], ['Rigel 12 000 K', 12000, C.blue]] as Array<[string, number, string]>) {
        c.beginPath();
        for (let nm = lam0; nm <= lam1; nm += 4) { const y = Y(planck(nm * 1e-9, Tr)); if (nm === lam0) c.moveTo(X(nm), y); else c.lineTo(X(nm), y); }
        c.strokeStyle = colr; c.globalAlpha = 0.35; c.lineWidth = 1; c.setLineDash([3, 3]); c.stroke(); c.setLineDash([]); c.globalAlpha = 1;
        const lmr = 2.897771955e6 / Tr + 320; const yl = Y(planck(lmr * 1e-9, Tr));
        if (yl > gy0 + 6) this.text(name, X(lmr) + 4, yl - 7, colr, 8, 'left');
      }
    }
    // classical approximations (catastrophe mode)
    if (this.mode === 'catastrophe') {
      const rj = (nm: number) => (2 * C_LIGHT * K_B * T) / (nm * 1e-9) ** 4;
      const wien = (nm: number) => (2 * H_PLANCK * C_LIGHT ** 2) / (nm * 1e-9) ** 5 * Math.exp(-(H_PLANCK * C_LIGHT) / (nm * 1e-9 * K_B * T));
      c.beginPath();
      for (let nm = lam0; nm <= lam1; nm += 3) { const y = Y(rj(nm)); if (nm === lam0) c.moveTo(X(nm), y); else c.lineTo(X(nm), y); }
      c.strokeStyle = C.red; c.lineWidth = 1.4; c.setLineDash([5, 4]); c.stroke(); c.setLineDash([]);
      c.beginPath();
      for (let nm = lam0; nm <= lam1; nm += 3) { const y = Y(wien(nm)); if (nm === lam0) c.moveTo(X(nm), y); else c.lineTo(X(nm), y); }
      c.strokeStyle = C.purple; c.lineWidth = 1.2; c.setLineDash([1, 3]); c.stroke(); c.setLineDash([]);
      this.text('Rayleigh–Jeans  2ckT/λ⁴  → ∞', gx1 - 6, gy0 + 10, C.red, 10, 'right', 'serif');
      this.text('Wien approximation  (fails at long λ)', gx1 - 6, gy0 + 24, C.purple, 10, 'right', 'serif');
      this.text('Planck  (measured)', gx1 - 6, gy0 + 38, C.text, 10, 'right', 'serif');
    }
    // current curve with fill
    const col = tempRGB(T);
    c.beginPath(); c.moveTo(X(lam0), gy1);
    for (let nm = lam0; nm <= lam1; nm += 3) c.lineTo(X(nm), Y(planck(nm * 1e-9, T)));
    c.lineTo(X(lam1), gy1); c.closePath(); c.fillStyle = rgba(col, 0.10); c.fill();
    c.beginPath();
    for (let nm = lam0; nm <= lam1; nm += 3) { const y = Y(planck(nm * 1e-9, T)); if (nm === lam0) c.moveTo(X(nm), y); else c.lineTo(X(nm), y); }
    c.strokeStyle = rgba(col); c.lineWidth = 2; c.stroke();
    // Wien peak
    const yp = Y(peak);
    this.line(X(lamMax), gy1, X(lamMax), Math.max(gy0, yp), rgba(col, 0.6), 1, [3, 3]);
    this.text(`λ_max = ${fmt(lamMax, 0)} nm`, X(lamMax) + 5, Math.max(gy0 + 8, yp) + (yp < gy0 + 14 ? 14 : -10), rgba(col), 10, 'left', 'serif');
    c.restore();
    // star swatch
    this.glow(gx1 - 22, gy0 + 60 + (this.mode === 'catastrophe' ? 20 : 0), 22, rgba(col, 0.6)); this.circle(gx1 - 22, gy0 + 60 + (this.mode === 'catastrophe' ? 20 : 0), 9, undefined, rgba(col));
    const band = lamMax < 10 ? 'X-ray' : lamMax < 380 ? 'ultraviolet' : lamMax < 450 ? 'violet / blue' : lamMax < 495 ? 'blue' : lamMax < 570 ? 'green' : lamMax < 590 ? 'yellow' : lamMax < 620 ? 'orange' : lamMax < 750 ? 'red' : lamMax < 1e6 ? 'infrared' : 'radio';
    const ro: Array<[string, string, string?]> = [
      ['Temperature T', `${fmt(T, 0)} K`, rgba(col)],
      ['Peak wavelength λ_max = 2.898×10⁶ nm K / T', `${fmt(lamMax, 0)} nm  (${band})`],
      ['Surface flux σT⁴', `${sci(SIGMA_SB * T ** 4, 2)} W/m²`, C.green],
      ['Relative to the Sun', `× ${sci((T / 5772) ** 4, 2)} per m²`],
    ];
    if (this.mode === 'catastrophe') ro.push(['Rayleigh–Jeans / Planck at 200 nm', sci((2 * C_LIGHT * K_B * T) / (200e-9) ** 4 / Math.max(1e-300, planck(200e-9, T)), 1), C.red]);
    this.setReadout(ro);
  }
}

/* ------------------------------------------------- 19. L = 4πR²σT⁴ ---- */

const LRT_PRESETS: Array<[string, number, number]> = [
  ['Sun', 1, 5772], ['Betelgeuse', 890, 3600], ['Rigel', 79, 12100], ['Sirius A', 1.71, 9940], ['Sirius B (white dwarf)', 0.0084, 25000], ['Proxima Cen', 0.15, 3040],
];

class LRTWidget extends CanvasWidget {
  private logR = 0;
  private logT = log10(5772);
  private sR: { set: (v: number) => void }; private sT: { set: (v: number) => void };
  private t = 0;
  constructor() {
    super(480 / 300);
    this.segmented(LRT_PRESETS.map(([n], i) => [String(i), n] as [string, string]), '0', (i) => {
      const [, R, T] = LRT_PRESETS[+i]; this.logR = log10(R); this.logT = log10(T); this.sR.set(this.logR); this.sT.set(this.logT);
    });
    this.sR = this.slider('Radius R', -2.2, 3.1, 0.01, this.logR, (v) => `${(10 ** v) < 0.1 ? fmt(10 ** v, 3) : fmt(10 ** v, 10 ** v < 10 ? 2 : 0)} R☉`, (v) => { this.logR = v; });
    this.sT = this.slider('Temperature T', log10(2500), log10(40000), 0.005, this.logT, (v) => `${fmt(10 ** v, 0)} K`, (v) => { this.logT = v; });
  }
  protected draw(dt: number) {
    const c = this.ctx;
    this.t += dt;
    c.fillStyle = C.bg; c.fillRect(0, 0, this.w, this.h);
    const R = 10 ** this.logR, T = 10 ** this.logT;
    const L = R * R * (T / 5772) ** 4;
    const Mbol = 4.74 - 2.5 * log10(L);
    const col = tempRGB(T);
    // left: star vs Sun (radius drawn on a log scale)
    const rpx = (r: number) => 3 + 58 * (log10(r) + 2.2) / 5.3;
    const cx = this.w * 0.3, cy = this.h * 0.48;
    const rs = rpx(R), rsun = rpx(1);
    this.circle(cx, cy, rsun, 'rgba(242,196,90,0.5)', undefined, 1, [3, 3]);
    this.text('Sun, to the same (log) scale', cx, cy + Math.max(rs, rsun) + 16, C.faint, 8, 'center');
    const flick = 1 + 0.03 * Math.sin(this.t * 2.3);
    this.glow(cx, cy, rs * 1.8 * flick + 6, rgba(col, 0.55)); this.circle(cx, cy, rs, undefined, rgba(col));
    this.text(`R = ${R < 0.1 ? fmt(R, 3) : fmt(R, R < 10 ? 2 : 0)} R☉`, cx, 16, C.text, 10, 'center', 'mono');
    this.text(`T = ${fmt(T, 0)} K`, cx, 30, rgba(col), 10, 'center', 'mono');
    this.text('radius drawn on a log scale', cx, this.h - 10, C.faint, 8, 'center');
    // right: log luminosity bar
    const bx = this.w * 0.62, bw = this.w * 0.3, by0 = 24, by1 = this.h - 34;
    const Yl = (lg: number) => by1 - ((lg + 5) / 11) * (by1 - by0);
    for (let lg = -5; lg <= 6; lg++) { this.line(bx, Yl(lg), bx + bw, Yl(lg), lg === 0 ? C.line : C.grid); this.text(lg === 0 ? '1 L☉' : `10${lg < 0 ? '⁻' : ''}${SUP[Math.abs(lg)]}`, bx - 6, Yl(lg), lg === 0 ? C.sun : C.faint, 8, 'right', 'mono'); }
    const lgL = Math.max(-5, Math.min(6, log10(L)));
    const top = Yl(lgL);
    const grad = c.createLinearGradient(0, by1, 0, top); grad.addColorStop(0, rgba(col, 0.15)); grad.addColorStop(1, rgba(col, 0.75));
    c.fillStyle = grad; c.fillRect(bx + bw * 0.25, Math.min(top, Yl(0)), bw * 0.5, Math.abs(Yl(0) - top));
    this.line(bx + bw * 0.2, top, bx + bw * 0.8, top, rgba(col), 2);
    this.text(`L = ${L >= 1e4 || L < 1e-2 ? sci(L, 2) : fmt(L, L < 10 ? 2 : 0)} L☉`, bx + bw / 2, Math.max(by0 - 8, top - 12), C.text, 10, 'center', 'mono');
    this.text('luminosity L = 4πR²σT⁴', bx + bw / 2, by1 + 14, C.dim, 9, 'center');
    this.text(`R² → × ${sci(R * R, 1)}`, bx + bw / 2, by1 + 26, C.faint, 8, 'center');
    this.text(`T⁴ → × ${sci((T / 5772) ** 4, 1)}`, bx + bw / 2 + 0, by1 + 36, C.faint, 8, 'center');
    this.setReadout([
      ['Luminosity L / L☉ = (R/R☉)² (T/5772 K)⁴', L >= 1e4 || L < 1e-2 ? sci(L, 3) : fmt(L, 3), C.green],
      ['Luminosity in watts', `${sci(L * 3.828e26, 2)} W`],
      ['Absolute bolometric magnitude M_bol', fmt(Mbol, 2)],
      ['Surface flux σT⁴', `${sci(SIGMA_SB * T ** 4, 2)} W/m²`],
      ['Peak wavelength λ_max', `${fmt(2.897771955e6 / T, 0)} nm`, rgba(col)],
    ]);
  }
}

/* ------------------------------------------------- 20. Planck's quantum ladder ---- */

class QuantumWidget extends CanvasWidget {
  private logLam = log10(2000);   // nm
  private logT = log10(5772);
  constructor() {
    super(480 / 320);
    this.playing = false;
    this.slider('Wavelength of the mode λ', 2, 5, 0.01, this.logLam, (v) => { const nm = 10 ** v; return nm < 1000 ? `${fmt(nm, 0)} nm` : `${fmt(nm / 1000, 2)} µm`; }, (v) => { this.logLam = v; });
    this.slider('Temperature T', log10(300), log10(20000), 0.005, this.logT, (v) => `${fmt(10 ** v, 0)} K`, (v) => { this.logT = v; });
  }
  protected draw() {
    const c = this.ctx;
    c.fillStyle = C.bg; c.fillRect(0, 0, this.w, this.h);
    const lam = 10 ** this.logLam * 1e-9, T = 10 ** this.logT;
    const nu = C_LIGHT / lam, hnu = H_PLANCK * nu, kT = K_B * T;
    const x = hnu / kT;
    const meanE = x > 500 ? 0 : hnu / Math.expm1(x);          // J
    const nm = lam * 1e9;
    const col: [number, number, number] = nm > 780 ? [214, 120, 90] : nm < 380 ? [165, 138, 214] : waveRGB(nm);
    /* left: ladder in units of kT, 0..8 */
    const lx = 40, lw = this.w * 0.36, ly0 = 16, ly1 = this.h - 30;
    const Y = (ekT: number) => ly1 - (ekT / 8) * (ly1 - ly0);
    this.line(lx, ly0, lx, ly1, C.line, 1);
    for (let e = 0; e <= 8; e += 2) { this.line(lx - 3, Y(e), lx, Y(e), C.text); this.text(`${e} kT`, lx - 6, Y(e), C.faint, 8, 'right', 'mono'); }
    this.line(lx, Y(1), lx + lw, Y(1), C.accent, 1, [4, 3]); this.text('kT (classical average)', lx + lw, Y(1) - 7, C.accent, 8, 'right');
    const P0 = 1 - Math.exp(-x);                                // normalisation of the geometric distribution
    let n = 0;
    for (; n * x <= 8 && n < 400; n++) {
      const y = Y(n * x), prob = P0 * Math.exp(-n * x);
      if (y < ly0) break;
      this.line(lx, y, lx + lw * 0.3, y, rgba(col, 0.9), x < 0.08 ? 0.5 : 1.2);
      c.fillStyle = rgba(col, 0.55); c.fillRect(lx + lw * 0.34, y - Math.max(1, Math.min(4, (x / 8) * (ly1 - ly0) * 0.6)), lw * 0.62 * prob, Math.max(2, Math.min(8, (x / 8) * (ly1 - ly0) * 0.6)));
      if (x > 0.5 && n < 9) this.text(`n = ${n}`, lx + lw * 0.32, y - 7, C.faint, 8, 'left');
    }
    this.text(`rungs every hν = ${fmt(x, x < 0.1 ? 3 : 2)} kT`, lx + lw / 2, ly1 + 12, C.text, 9, 'center');
    this.text('bars: probability of being on each rung', lx + lw / 2, ly1 + 22, C.faint, 8, 'center');
    const ym = Y(meanE / kT); this.line(lx, ym, lx + lw, ym, C.green, 1.5); this.text('⟨E⟩', lx + lw + 4, ym, C.green, 9, 'left', 'serif');
    /* right: ⟨E⟩/kT against x = hν/kT */
    const gx0 = this.w * 0.52, gx1 = this.w - 14, gy0 = 16, gy1 = this.h - 30;
    const GX = (xx: number) => gx0 + (xx / 8) * (gx1 - gx0), GY = (v: number) => gy1 - (v / 1.15) * (gy1 - gy0);
    this.line(gx0, gy1, gx1, gy1, C.text, 1); this.line(gx0, gy0, gx0, gy1, C.line, 1);
    for (let xx = 0; xx <= 8; xx += 2) this.text(fmt(xx, 0), GX(xx), gy1 + 10, C.faint, 8, 'center', 'mono');
    this.text('x = hν / kT →', gx1, gy1 + 22, C.dim, 9, 'right');
    this.line(gx0, GY(1), gx1, GY(1), C.accent, 1, [4, 3]); this.text('classical: ⟨E⟩ = kT for every mode', gx0 + 4, GY(1) - 8, C.accent, 8, 'left');
    c.beginPath();
    for (let xx = 0.01; xx <= 8; xx += 0.05) { const v = xx / Math.expm1(xx); const px = GX(xx), py = GY(v); if (xx <= 0.011) c.moveTo(px, py); else c.lineTo(px, py); }
    c.strokeStyle = C.green; c.lineWidth = 1.8; c.stroke();
    this.text('quantum: ⟨E⟩ = hν / (e^x − 1)', gx0 + 4, GY(0.42), C.green, 9, 'left', 'serif');
    const mx = GX(Math.min(8, x)), my = GY(x > 500 ? 0 : x / Math.expm1(x));
    this.glow(mx, my, 10, rgba(col, 0.7)); this.circle(mx, my, 3.5, undefined, '#fff');
    c.save(); c.translate(gx0 - 10, (gy0 + gy1) / 2); c.rotate(-Math.PI / 2); this.text('⟨E⟩ / kT', 0, 0, C.dim, 9, 'center'); c.restore();
    this.setReadout([
      ['Mode: λ, ν', `${lam * 1e9 < 1000 ? fmt(lam * 1e9, 0) + ' nm' : fmt(lam * 1e6, 2) + ' µm'},  ${sci(nu, 2)} Hz`],
      ['Quantum of energy hν', `${fmt(hnu / EV, hnu / EV < 0.1 ? 4 : 3)} eV`, rgba(col)],
      ['Thermal energy kT', `${fmt(kT / EV, 3)} eV`, C.accent],
      ['x = hν / kT', fmt(x, 2)],
      ['Average energy ⟨E⟩ / kT', `${fmt(meanE / kT, 3)}  ${x < 0.3 ? '≈ classical' : x > 3 ? '— frozen out' : ''}`, C.green],
      ['Probability of any excitation, e^(−x)', x > 100 ? sci(Math.exp(-x), 1) : fmt(Math.exp(-x), 4)],
    ]);
  }
}

/* ------------------------------------------------- 21. colour index (UBV) ---- */

const UBV: Array<[string, number, number, string]> = [['U', 365, 68, '#a58ad6'], ['B', 440, 98, '#6fa3d6'], ['V', 550, 89, '#b7cf7a']];
const CI_STARS: Array<[string, number, number, number]> = [          // name, T, B−V, U−B (observed)
  ['Rigel', 12100, -0.03, -0.66], ['Vega', 9600, 0.00, 0.00], ['Sirius', 9940, 0.00, -0.05], ['Sun', 5772, 0.65, 0.17], ['Arcturus', 4290, 1.23, 1.27], ['Betelgeuse', 3600, 1.85, 2.06],
];

class ColorIndexWidget extends CanvasWidget {
  private logT = log10(5772);
  private zp = [0, 0, 0];
  private bbLine: Array<{ T: number; bv: number; ub: number }> = [];
  private cache: { T: number; mags: number[] } | null = null;
  constructor() {
    super(480 / 400);
    this.playing = false;
    this.zp = this.rawMags(9600).map((m) => -m);                    // Vega-like zero point
    for (let lt = log10(2500); lt <= log10(40000) + 1e-9; lt += 0.03) { const T = 10 ** lt; const m = this.mags(T); this.bbLine.push({ T, bv: m[1] - m[2], ub: m[0] - m[1] }); }
    const s = this.slider('Temperature T', log10(2500), log10(30000), 0.005, this.logT, (v) => `${fmt(10 ** v, 0)} K`, (v) => { this.logT = v; });
    this.segmented(CI_STARS.map(([n, T]) => [String(T), n] as [string, string]), '5772', (v) => { this.logT = log10(+v); s.set(this.logT); });
  }
  private band(nm: number, i: number) { const [, c0, fwhm] = UBV[i]; const s = fwhm / 2.355; return Math.exp(-0.5 * ((nm - c0) / s) ** 2); }
  private rawMags(T: number): number[] {
    const out = [0, 0, 0];
    for (let i = 0; i < 3; i++) {
      let sum = 0;
      for (let nm = 250; nm <= 800; nm += 2) sum += planck(nm * 1e-9, T) * this.band(nm, i);
      out[i] = -2.5 * log10(sum);
    }
    return out;
  }
  private mags(T: number): number[] { return this.rawMags(T).map((m, i) => m + this.zp[i]); }
  protected draw() {
    const c = this.ctx;
    c.fillStyle = C.bg; c.fillRect(0, 0, this.w, this.h);
    const T = 10 ** this.logT;
    if (!this.cache || Math.abs(this.cache.T - T) > 0.5) this.cache = { T, mags: this.mags(T) };
    const [U, B, V] = this.cache.mags;
    const bv = B - V, ub = U - B;
    const col = tempRGB(T);
    /* top: spectrum with filter bands */
    const gx0 = 30, gx1 = this.w - 14, gy0 = 14, gy1 = this.h * 0.5;
    const lam0 = 250, lam1 = 900;
    const X = (nm: number) => gx0 + ((nm - lam0) / (lam1 - lam0)) * (gx1 - gx0);
    let pk = 0; for (let nm = lam0; nm <= lam1; nm += 5) pk = Math.max(pk, planck(nm * 1e-9, T));
    const Y = (b: number) => gy1 - (b / (pk * 1.08)) * (gy1 - gy0);
    rainbow(c, X, gy1 + 1, 6, 0.7);
    this.line(gx0, gy1, gx1, gy1, C.text, 1);
    for (const nm of [300, 400, 500, 600, 700, 800]) this.text(fmt(nm, 0), X(nm), gy1 + 15, C.faint, 8, 'center', 'mono');
    UBV.forEach(([name, c0, fwhm, fc], i) => {
      c.beginPath(); c.moveTo(X(c0 - 2 * fwhm), gy1);
      for (let nm = c0 - 2 * fwhm; nm <= c0 + 2 * fwhm; nm += 2) c.lineTo(X(nm), gy1 - this.band(nm, i) * (gy1 - gy0) * 0.55);
      c.lineTo(X(c0 + 2 * fwhm), gy1); c.closePath(); c.fillStyle = hexA(fc, 0.18); c.fill();
      this.text(name, X(c0), gy1 - (gy1 - gy0) * 0.55 - 8, fc, 11, 'center', 'serif');
    });
    c.beginPath();
    for (let nm = lam0; nm <= lam1; nm += 3) { const y = Y(planck(nm * 1e-9, T)); if (nm === lam0) c.moveTo(X(nm), y); else c.lineTo(X(nm), y); }
    c.strokeStyle = rgba(col); c.lineWidth = 2; c.stroke();
    this.text(`blackbody ${fmt(T, 0)} K`, gx1 - 4, gy0 + 6, rgba(col), 10, 'right', 'serif');
    /* bottom-left: the three magnitudes as bars */
    const bx = 30, by0 = gy1 + 34, bw = this.w * 0.34;
    this.text('magnitudes through each filter (Vega = 0)', bx, by0 - 10, C.dim, 9);
    [U, B, V].forEach((m, i) => {
      const y = by0 + i * 26;
      const len = Math.max(0, Math.min(1, (3 - m) / 6)) * bw;       // brighter (smaller m) → longer bar
      c.fillStyle = UBV[i][3]; c.globalAlpha = 0.65; c.fillRect(bx + 16, y, len, 12); c.globalAlpha = 1;
      this.text(UBV[i][0], bx + 4, y + 6, UBV[i][3], 11, 'center', 'serif');
      this.text(fmt(m, 2), bx + 20 + len, y + 6, C.text, 9, 'left', 'mono');
    });
    this.text(`B − V = ${fmt(bv, 2)}`, bx, by0 + 92, C.text, 12, 'left', 'serif');
    this.text(`U − B = ${fmt(ub, 2)}`, bx, by0 + 110, C.text, 12, 'left', 'serif');
    this.glow(bx + bw + 30, by0 + 100, 22, rgba(col, 0.6)); this.circle(bx + bw + 30, by0 + 100, 9, undefined, rgba(col));
    /* bottom-right: colour–colour diagram */
    const dx0 = this.w * 0.55, dx1 = this.w - 14, dy0 = gy1 + 30, dy1 = this.h - 24;
    const DX = (v: number) => dx0 + ((v + 0.5) / 2.8) * (dx1 - dx0), DY = (v: number) => dy0 + ((v + 1.3) / 3.7) * (dy1 - dy0);   // U−B increases downward (convention)
    c.strokeStyle = C.line; c.strokeRect(dx0, dy0, dx1 - dx0, dy1 - dy0);
    for (const v of [0, 1, 2]) { this.text(fmt(v, 0), DX(v), dy1 + 9, C.faint, 8, 'center', 'mono'); this.line(DX(v), dy0, DX(v), dy1, C.grid); }
    for (const v of [-1, 0, 1, 2]) { this.text(fmt(v, 0), dx0 - 4, DY(v), C.faint, 8, 'right', 'mono'); this.line(dx0, DY(v), dx1, DY(v), C.grid); }
    this.text('B − V', (dx0 + dx1) / 2, dy1 + 18, C.dim, 9, 'center'); c.save(); c.translate(dx0 - 16, (dy0 + dy1) / 2); c.rotate(-Math.PI / 2); this.text('U − B', 0, 0, C.dim, 9, 'center'); c.restore();
    c.save(); c.beginPath(); c.rect(dx0, dy0, dx1 - dx0, dy1 - dy0); c.clip();
    c.beginPath(); this.bbLine.forEach((q, i) => { const x = DX(q.bv), y = DY(q.ub); if (i === 0) c.moveTo(x, y); else c.lineTo(x, y); });
    c.strokeStyle = 'rgba(255,255,255,0.45)'; c.lineWidth = 1.2; c.stroke();
    this.text('blackbodies', DX(1.6), DY(1.0), C.dim, 8, 'left');
    for (const [name, , sbv, sub] of CI_STARS) { this.circle(DX(sbv), DY(sub), 2.5, undefined, C.accent); this.text(name, DX(sbv) + 5, DY(sub) - 5, C.accent, 7, 'left'); }
    this.glow(DX(bv), DY(ub), 10, rgba(col, 0.8)); this.circle(DX(bv), DY(ub), 3.5, undefined, '#fff');
    c.restore();
    this.text('real stars (orange) vs blackbody line', (dx0 + dx1) / 2, dy0 - 8, C.faint, 8, 'center');
    const Tfit = 4600 * (1 / (0.92 * bv + 1.7) + 1 / (0.92 * bv + 0.62));
    this.setReadout([
      ['Temperature (set)', `${fmt(T, 0)} K`, rgba(col)],
      ['B − V (blackbody, Vega zero point)', fmt(bv, 3), C.green],
      ['U − B', fmt(ub, 3)],
      ['T from B − V (empirical fit)', `${fmt(Tfit, 0)} K`],
      ['Peak wavelength λ_max', `${fmt(2.897771955e6 / T, 0)} nm`],
    ]);
  }
}

/* ------------------------------------------------- 22. Michelson–Morley ---- */

const gammaOf = (b: number) => 1 / Math.sqrt(1 - b * b);

class MichelsonWidget extends CanvasWidget {
  private vkm = 30;                       // Earth's speed through the "ether", km/s
  private mode: 'ether' | 'observed' = 'ether';
  private t = 0;
  constructor() {
    super(480 / 360);
    this.segmented<'ether' | 'observed'>([['ether', 'Ether theory predicts'], ['observed', 'What was observed']], 'ether', (m) => { this.mode = m; });
    this.playButton();
    this.slider('Speed through the ether', 0, 100, 1, this.vkm, (v) => `${fmt(v, 0)} km/s`, (v) => { this.vkm = v; });
  }
  protected draw(dt: number) {
    const c = this.ctx;
    this.t += dt;
    c.fillStyle = C.bg; c.fillRect(0, 0, this.w, this.h);
    const beta = this.mode === 'ether' ? Math.min(0.55, this.vkm / 90) : 0;   // animation (hugely exaggerated)
    const L = Math.min(this.w * 0.26, this.h * 0.36);
    const bx = this.w * 0.36, by = this.h * 0.55;                         // beam splitter
    const m1 = { x: bx + L, y: by }, m2 = { x: bx, y: by - L };          // mirrors
    const det = { x: bx, y: by + L * 0.55 };
    // ether wind arrows
    if (this.mode === 'ether') {
      for (let i = 0; i < 6; i++) {
        const y = 14 + i * (this.h - 28) / 5, x = ((this.t * 40 + i * 37) % (this.w * 0.62));
        this.line(x, y, x + 18, y, 'rgba(165,138,214,0.35)', 1); this.line(x + 18, y, x + 13, y - 3, 'rgba(165,138,214,0.35)'); this.line(x + 18, y, x + 13, y + 3, 'rgba(165,138,214,0.35)');
      }
      this.text('ether wind  (Earth moves right → ether streams left… drawn here flowing with the along-arm)', 8, this.h - 8, C.faint, 8);
    }
    // apparatus
    this.line(bx - L * 0.7, by, bx, by, 'rgba(255,255,255,0.15)', 1);
    this.text('source', bx - L * 0.7, by - 10, C.dim, 9, 'left');
    this.line(bx, by, m1.x, m1.y, C.line, 1); this.line(bx, by, m2.x, m2.y, C.line, 1); this.line(bx, by, det.x, det.y, C.line, 1);
    this.line(bx - 7, by + 7, bx + 7, by - 7, C.text, 2);                   // splitter
    this.line(m1.x + 3, m1.y - 12, m1.x + 3, m1.y + 12, C.text, 3); this.line(m2.x - 12, m2.y - 3, m2.x + 12, m2.y - 3, C.text, 3);
    c.fillStyle = '#2a2f3a'; c.fillRect(det.x - 12, det.y, 24, 8); this.text('detector', det.x, det.y + 18, C.dim, 9, 'center');
    this.text('L', (bx + m1.x) / 2, by + 12, C.text, 11, 'center', 'serif'); this.text('L', bx - 12, (by + m2.y) / 2, C.text, 11, 'center', 'serif');
    // pulses: unit c = L per second (so round trip at rest = 2 s)
    const tPar = 1 / (1 - beta) + 1 / (1 + beta), tPerp = 2 / Math.sqrt(1 - beta * beta);
    const cycle = Math.max(tPar, tPerp) + 0.8;
    const tau = (this.t * 0.6) % cycle;
    let pPar: { x: number; y: number } | null = null, pPerp: { x: number; y: number } | null = null;
    if (tau < tPar) { const out = 1 / (1 - beta); const f = tau < out ? (tau * (1 - beta)) : 1 - (tau - out) * (1 + beta); pPar = { x: bx + f * L, y: by }; }
    if (tau < tPerp) { const half = tPerp / 2; const f = tau < half ? tau / half : 2 - tau / half; pPerp = { x: bx, y: by - f * L }; }
    if (pPar) { this.glow(pPar.x, pPar.y, 9, 'rgba(242,196,90,0.7)'); this.circle(pPar.x, pPar.y, 3, undefined, C.sun); }
    if (pPerp) { this.glow(pPerp.x, pPerp.y, 9, 'rgba(111,163,214,0.7)'); this.circle(pPerp.x, pPerp.y, 3, undefined, C.blue); }
    // arrival marks
    const lag = tPar - tPerp;
    this.text(this.mode === 'ether' ? `along-wind pulse returns late by ${fmt(lag * 100 / 2, 1)} % of a round trip (exaggerated)` : 'both pulses return together — no delay, at any orientation', 8, 12, this.mode === 'ether' ? C.sun : C.green, 9);
    // fringes (right)
    const fx0 = this.w * 0.72, fw = this.w - fx0 - 10, fy0 = 30, fy1 = this.h - 60;
    const period = 16;
    const expectedShift = (2 * 11 * (this.vkm * 1e3 / C_LIGHT) ** 2) / 590e-9;   // fringes, L = 11 m
    const shift = this.mode === 'ether' ? expectedShift * Math.cos(this.t * 0.5) : 0;   // apparatus slowly rotating
    c.save(); c.beginPath(); c.rect(fx0, fy0, fw, fy1 - fy0); c.clip();
    for (let y = fy0; y < fy1; y++) { const v = 0.5 + 0.5 * Math.cos(TAU * ((y - fy0) / period + shift)); c.fillStyle = `rgba(239,233,216,${0.08 + 0.8 * v})`; c.fillRect(fx0, y, fw, 1); }
    c.restore();
    c.strokeStyle = C.line; c.strokeRect(fx0, fy0, fw, fy1 - fy0);
    this.line(fx0 - 6, (fy0 + fy1) / 2, fx0 + fw + 6, (fy0 + fy1) / 2, C.red, 1);
    this.text('fringes', fx0 + fw / 2, fy0 - 10, C.dim, 9, 'center');
    this.text(`apparatus rotating · θ = ${fmt(((this.t * 0.25 * 180 / Math.PI) % 180), 0)}°`, fx0 + fw / 2, fy1 + 12, C.faint, 8, 'center');
    this.text(this.mode === 'ether' ? `shift ${fmt(shift, 2)} fringe` : 'shift 0.00 fringe', fx0 + fw / 2, fy1 + 24, this.mode === 'ether' ? C.sun : C.green, 9, 'center', 'mono');
    this.setReadout([
      ['Earth\'s speed u', `${fmt(this.vkm, 0)} km/s  (β = ${sci(this.vkm * 1e3 / C_LIGHT, 1)})`],
      ['Δt ≈ (L/c) β²  (L = 11 m)', `${sci((11 / C_LIGHT) * (this.vkm * 1e3 / C_LIGHT) ** 2, 2)} s`],
      ['Fringe shift 2Lβ²/λ  (λ = 590 nm)', `${fmt(expectedShift, 2)} fringe`, C.sun],
      ['Instrument sensitivity', '0.01 fringe'],
      ['Observed (1887)', 'no shift, in any season', C.green],
    ]);
  }
}

/* ------------------------------------------------- 23. velocity addition ---- */

class VelocityAddWidget extends CanvasWidget {
  private u = 0.6;      // frame speed / c
  private vp = 0.6;     // object speed in S′ / c
  constructor() {
    super(480 / 330);
    this.playing = false;
    this.slider('Rocket speed u (relative to you)', 0, 0.99, 0.01, this.u, (v) => `${fmt(v, 2)} c`, (v) => { this.u = v; });
    this.slider('Probe speed v′ (relative to rocket)', -0.99, 1, 0.01, this.vp, (v) => `${fmt(v, 2)} c`, (v) => { this.vp = v; });
  }
  protected draw() {
    const c = this.ctx;
    c.fillStyle = C.bg; c.fillRect(0, 0, this.w, this.h);
    const u = this.u, vp = this.vp;
    const gal = u + vp, rel = (u + vp) / (1 + u * vp);
    /* top: arrows */
    const ax0 = 60, ax1 = this.w - 20, ay = 26;
    const AX = (v: number) => ax0 + ((v + 1) / 3) * (ax1 - ax0);          // −1c … 2c
    this.line(ax0, ay + 36, ax1, ay + 36, C.line, 1);
    for (const v of [-1, 0, 1, 2]) { this.line(AX(v), ay + 32, AX(v), ay + 40, v === 1 ? C.red : C.text); this.text(`${v} c`, AX(v), ay + 50, v === 1 ? C.red : C.dim, 9, 'center', 'mono'); }
    this.line(AX(1), ay - 10, AX(1), ay + 36, C.red, 1, [3, 3]); this.text('speed of light', AX(1) + 4, ay - 8, C.red, 8, 'left');
    const arrow = (v: number, y: number, col: string, label: string) => {
      const x = AX(v);
      this.line(AX(0), y, x, y, col, 2.5);
      c.beginPath(); c.moveTo(x, y); c.lineTo(x - 7 * Math.sign(v || 1), y - 4); c.lineTo(x - 7 * Math.sign(v || 1), y + 4); c.closePath(); c.fillStyle = col; c.fill();
      this.text(label, ax0 - 6, y, col, 9, 'right');
    };
    arrow(u, ay, C.accent, 'rocket u');
    arrow(gal, ay + 12, C.dim, 'Galileo u + v′');
    arrow(rel, ay + 24, C.green, 'relativity');
    /* bottom: graph v against v′ for this u */
    const gx0 = 46, gx1 = this.w - 16, gy0 = ay + 70, gy1 = this.h - 26;
    const GX = (x: number) => gx0 + ((x + 1) / 2) * (gx1 - gx0), GY = (y: number) => gy1 - ((y + 1) / 3) * (gy1 - gy0);
    for (const v of [-1, 0, 1, 2]) { this.line(gx0, GY(v), gx1, GY(v), v === 1 || v === -1 ? 'rgba(212,106,90,0.35)' : C.grid); this.text(`${v}c`, gx0 - 4, GY(v), C.faint, 8, 'right', 'mono'); }
    for (const x of [-1, -0.5, 0, 0.5, 1]) { this.line(GX(x), gy0, GX(x), gy1, C.grid); this.text(`${x}c`, GX(x), gy1 + 10, C.faint, 8, 'center', 'mono'); }
    this.text('probe speed in the rocket frame v′ →', gx1, gy1 + 20, C.dim, 9, 'right');
    c.save(); c.translate(14, (gy0 + gy1) / 2); c.rotate(-Math.PI / 2); this.text('speed you measure, v', 0, 0, C.dim, 9, 'center'); c.restore();
    c.save(); c.beginPath(); c.rect(gx0, gy0, gx1 - gx0, gy1 - gy0); c.clip();
    c.beginPath(); c.moveTo(GX(-1), GY(u - 1)); c.lineTo(GX(1), GY(u + 1)); c.strokeStyle = C.dim; c.lineWidth = 1.2; c.setLineDash([4, 4]); c.stroke(); c.setLineDash([]);
    c.beginPath();
    for (let x = -1; x <= 1.0001; x += 0.02) { const y = (u + x) / (1 + u * x); if (x <= -1) c.moveTo(GX(x), GY(y)); else c.lineTo(GX(x), GY(y)); }
    c.strokeStyle = C.green; c.lineWidth = 2; c.stroke();
    c.restore();
    this.glow(GX(vp), GY(rel), 9, 'rgba(127,191,138,0.7)'); this.circle(GX(vp), GY(rel), 3.5, undefined, '#fff');
    this.circle(GX(vp), GY(Math.min(2, gal)), 3, C.dim, undefined, 1);
    this.text(`u = ${fmt(u, 2)} c`, gx1 - 6, gy0 + 10, C.accent, 10, 'right', 'serif');
    this.setReadout([
      ['Galilean: v = u + v′', `${fmt(gal, 3)} c`, gal > 1 ? C.red : C.dim],
      ['Relativistic: v = (u + v′)/(1 + uv′/c²)', `${fmt(rel, 4)} c`, C.green],
      ['Difference', `${fmt(gal - rel, 3)} c`],
      ['γ of the result', Math.abs(rel) < 1 ? fmt(gammaOf(rel), 3) : '∞ (light)'],
    ]);
  }
}

/* ------------------------------------------------- 24. Minkowski diagram ---- */

class MinkowskiWidget extends CanvasWidget {
  private beta = 0.5;
  private ev = { x: 1.2, ct: 2.0 };      // event in S, units of light-seconds
  private dragging = false;
  private readonly range = 3.2;          // axis half-extent
  constructor() {
    super(480 / 420);
    this.playing = false;
    this.slider('Speed of frame S′,  β = u/c', 0, 0.9, 0.01, this.beta, (v) => fmt(v, 2), (v) => { this.beta = v; });
    this.controls.appendChild($('div', 'lw-caption', 'Drag the event (white dot) anywhere on the diagram.'));
    const pos = (e: PointerEvent) => { const r = this.canvas.getBoundingClientRect(); return { px: (e.clientX - r.left) * (this.w / r.width), py: (e.clientY - r.top) * (this.h / r.height) }; };
    this.canvas.addEventListener('pointerdown', (e) => { this.dragging = true; this.canvas.setPointerCapture(e.pointerId); const { px, py } = pos(e); this.setEvent(px, py); });
    this.canvas.addEventListener('pointermove', (e) => { if (this.dragging) { const { px, py } = pos(e); this.setEvent(px, py); } });
    this.canvas.addEventListener('pointerup', () => { this.dragging = false; });
    this.canvas.style.touchAction = 'none';
    this.canvas.style.cursor = 'crosshair';
  }
  private geom() { const S = Math.min(this.w, this.h) / 2 / this.range * 0.92; return { ox: this.w / 2, oy: this.h / 2 + 10, S }; }
  private setEvent(px: number, py: number) { const { ox, oy, S } = this.geom(); this.ev = { x: Math.max(-this.range, Math.min(this.range, (px - ox) / S)), ct: Math.max(-this.range, Math.min(this.range, (oy - py) / S)) }; }
  protected draw() {
    const c = this.ctx;
    c.fillStyle = C.bg; c.fillRect(0, 0, this.w, this.h);
    const { ox, oy, S } = this.geom();
    const P = (x: number, ct: number) => ({ x: ox + x * S, y: oy - ct * S });
    const b = this.beta, g = gammaOf(b);
    const R = this.range;
    // S grid
    for (let k = -3; k <= 3; k++) { const p0 = P(k, -R), p1 = P(k, R); this.line(p0.x, p0.y, p1.x, p1.y, C.grid); const q0 = P(-R, k), q1 = P(R, k); this.line(q0.x, q0.y, q1.x, q1.y, C.grid); }
    // S′ grid: lines of constant x′ (parallel to ct′ axis) and constant ct′ (parallel to x′ axis)
    c.save(); c.beginPath(); c.rect(P(-R, R).x, P(-R, R).y, 2 * R * S, 2 * R * S); c.clip();
    for (let k = -4; k <= 4; k++) {
      // x′ = k: x = γ(k + β ct′)… parametrise by ct′: x = γ(k + β s), ct = γ(s + β k)
      const a0 = { x: g * (k - b * R * 2), ct: g * (-R * 2 + b * k) }, a1 = { x: g * (k + b * R * 2), ct: g * (R * 2 + b * k) };
      let pa = P(a0.x, a0.ct), pb = P(a1.x, a1.ct); this.line(pa.x, pa.y, pb.x, pb.y, 'rgba(189,155,108,0.18)');
      const b0 = { x: g * (-R * 2 + b * k), ct: g * (k - b * R * 2) }, b1 = { x: g * (R * 2 + b * k), ct: g * (k + b * R * 2) };
      pa = P(b0.x, b0.ct); pb = P(b1.x, b1.ct); this.line(pa.x, pa.y, pb.x, pb.y, 'rgba(189,155,108,0.18)');
    }
    // light cone
    let p0 = P(-R, -R), p1 = P(R, R); this.line(p0.x, p0.y, p1.x, p1.y, 'rgba(242,196,90,0.55)', 1.2);
    p0 = P(-R, R); p1 = P(R, -R); this.line(p0.x, p0.y, p1.x, p1.y, 'rgba(242,196,90,0.55)', 1.2);
    c.fillStyle = 'rgba(242,196,90,0.05)'; c.beginPath(); c.moveTo(ox, oy); c.lineTo(P(R, R).x, P(R, R).y); c.lineTo(P(-R, R).x, P(-R, R).y); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(ox, oy); c.lineTo(P(R, -R).x, P(R, -R).y); c.lineTo(P(-R, -R).x, P(-R, -R).y); c.closePath(); c.fill();
    // S axes
    p0 = P(-R, 0); p1 = P(R, 0); this.line(p0.x, p0.y, p1.x, p1.y, C.text, 1.3); p0 = P(0, -R); p1 = P(0, R); this.line(p0.x, p0.y, p1.x, p1.y, C.text, 1.3);
    // S′ axes
    p0 = P(-R * b, -R); p1 = P(R * b, R); this.line(p0.x, p0.y, p1.x, p1.y, C.accent, 1.5);
    p0 = P(-R, -R * b); p1 = P(R, R * b); this.line(p0.x, p0.y, p1.x, p1.y, C.accent, 1.5);
    c.restore();
    this.text('x', P(R, 0).x - 8, P(R, 0).y + 12, C.text, 12, 'center', 'serif'); this.text('ct', P(0, R).x - 12, P(0, R).y + 8, C.text, 12, 'center', 'serif');
    this.text('x′', P(R, R * b).x - 12, P(R, R * b).y - 10, C.accent, 12, 'center', 'serif'); this.text('ct′', P(R * b, R).x + 14, P(R * b, R).y + 8, C.accent, 12, 'center', 'serif');
    this.text('light', P(R, R).x - 18, P(R, R).y + 12, 'rgba(242,196,90,0.9)', 9, 'center');
    this.text('future', ox, P(0, R).y + 26, C.faint, 9, 'center'); this.text('past', ox, P(0, -R).y - 14, C.faint, 9, 'center'); this.text('elsewhere', P(R, 0).x - 30, oy - 12, C.faint, 9, 'center');
    // event and projections
    const e = this.ev, E = P(e.x, e.ct);
    const xp = g * (e.x - b * e.ct), ctp = g * (e.ct - b * e.x);
    // S projections
    this.line(E.x, E.y, E.x, oy, 'rgba(211,214,220,0.4)', 1, [3, 3]); this.line(E.x, E.y, ox, E.y, 'rgba(211,214,220,0.4)', 1, [3, 3]);
    // S′ projections: along x′ direction to ct′ axis and along ct′ direction to x′ axis
    const Pt = P(g * b * ctp, g * ctp);          // point on ct′ axis with ct′ = ctp
    const Px = P(g * xp, g * b * xp);            // point on x′ axis with x′ = xp
    this.line(E.x, E.y, Pt.x, Pt.y, 'rgba(189,155,108,0.6)', 1, [3, 3]); this.line(E.x, E.y, Px.x, Px.y, 'rgba(189,155,108,0.6)', 1, [3, 3]);
    this.circle(Pt.x, Pt.y, 2.5, undefined, C.accent); this.circle(Px.x, Px.y, 2.5, undefined, C.accent);
    this.glow(E.x, E.y, 12, 'rgba(255,255,255,0.6)'); this.circle(E.x, E.y, 4, undefined, '#fff');
    const s2 = e.ct * e.ct - e.x * e.x;
    const kind = Math.abs(s2) < 0.02 ? 'lightlike' : s2 > 0 ? 'timelike' : 'spacelike';
    this.text(`event  (x, ct) = (${fmt(e.x, 2)}, ${fmt(e.ct, 2)})   (x′, ct′) = (${fmt(xp, 2)}, ${fmt(ctp, 2)})`, 8, 12, C.text, 9);
    this.setReadout([
      ['β, γ', `${fmt(b, 2)},  ${fmt(g, 3)}`],
      ['In S: (x, ct)', `(${fmt(e.x, 2)}, ${fmt(e.ct, 2)}) light-seconds`],
      ['In S′: x′ = γ(x − βct),  ct′ = γ(ct − βx)', `(${fmt(xp, 2)}, ${fmt(ctp, 2)})`, C.accent],
      ['Interval s² = (ct)² − x²', `${fmt(s2, 3)} = ${fmt(ctp * ctp - xp * xp, 3)} in S′  — invariant`, C.green],
      ['Separation from the origin', kind + (kind === 'spacelike' ? ' — order of events frame-dependent' : kind === 'timelike' ? ' — causally connectable' : ' — on the light cone'), kind === 'spacelike' ? C.red : C.green],
    ]);
  }
}

/* ------------------------------------------------- 25. Einstein's train ---- */

class TrainWidget extends CanvasWidget {
  private beta = 0.5;
  private t = 0;              // platform time, units where c = 1 and half-length = 1
  private speedUI = 0.35;
  constructor() {
    super(480 / 300);
    this.playButton();
    this.slider('Train speed β', 0, 0.9, 0.01, this.beta, (v) => `${fmt(v, 2)} c`, (v) => { this.beta = v; this.t = 0; });
    const b = $('button', 'lw-play', '↺'); b.title = 'Replay'; b.addEventListener('click', () => { this.t = 0; }); this.controls.appendChild(b);
  }
  protected draw(dt: number) {
    const c = this.ctx;
    c.fillStyle = C.bg; c.fillRect(0, 0, this.w, this.h);
    const b = this.beta, g = gammaOf(b);
    const tA = 1 / (1 - b), tB = 1 / (1 + b);           // arrival times at M′ (platform frame), half-length 1
    const tEnd = tA + 0.8;
    if (dt > 0) { this.t += dt * this.speedUI * 2; if (this.t > tEnd) this.t = -0.4; }
    const t = Math.max(0, this.t);
    const S = this.w * 0.26;                              // px per unit length
    const cx = this.w / 2, yP = this.h * 0.68, yT = this.h * 0.40;
    // camera pans right once the train would leave the picture
    const pan = Math.max(0, (b * t + 1.15) - (cx - 10) / S);
    const X = (x: number) => cx + (x - pan) * S;
    // platform
    c.fillStyle = '#1b1f27'; c.fillRect(0, yP, this.w, 6);
    this.line(X(-1), yP - 6, X(-1), yP + 12, C.text, 2); this.line(X(1), yP - 6, X(1), yP + 12, C.text, 2);
    this.text('A', X(-1), yP + 22, C.text, 11, 'center', 'serif'); this.text('B', X(1), yP + 22, C.text, 11, 'center', 'serif');
    this.circle(X(0), yP - 8, 4, undefined, C.text); this.text('M (platform)', X(0), yP + 22, C.text, 9, 'center');
    // train (contracted length 2 in platform frame, centred at x = βt)
    const xc = b * t;
    c.fillStyle = 'rgba(189,155,108,0.18)'; c.fillRect(X(xc - 1), yT - 16, 2 * S, 30);
    c.strokeStyle = C.accent; c.strokeRect(X(xc - 1), yT - 16, 2 * S, 30);
    for (let i = 0; i < 6; i++) { c.fillStyle = 'rgba(189,155,108,0.35)'; c.fillRect(X(xc - 1) + 8 + i * (2 * S - 16) / 6, yT - 10, (2 * S - 16) / 6 - 6, 10); }
    this.circle(X(xc), yT + 4, 4, undefined, C.accent); this.text('M′ (train)', X(xc), yT - 26, C.accent, 9, 'center');
    this.line(X(xc + 1) + 4, yT, X(xc + 1) + 18, yT, C.accent, 1.5); this.text('β', X(xc + 1) + 24, yT, C.accent, 9, 'left', 'serif');
    // lightning at A and B at t = 0; flashes expand at c
    const flash = (x0: number, col: string) => {
      if (this.t < 0) return;
      const r = t * S;
      c.beginPath(); c.arc(X(x0), yT, r, 0, TAU); c.strokeStyle = col; c.lineWidth = 1.5; c.globalAlpha = Math.max(0.15, 1 - t / tEnd); c.stroke(); c.globalAlpha = 1;
      if (t < 0.25) { this.glow(X(x0), yT - 10, 22, col.replace('1)', '0.8)')); }
    };
    flash(-1, 'rgba(111,163,214,1)'); flash(1, 'rgba(212,106,90,1)');
    // event flags
    const reachedM = t >= 1, reachedMpB = t >= tB, reachedMpA = t >= tA;
    const y0 = 14;
    this.text(`platform clock t = ${fmt(t, 2)}  (half-length / c)`, 8, y0, C.dim, 9);
    this.text(`M: flash from A ${reachedM ? '✓' : '…'}   flash from B ${reachedM ? '✓' : '…'}   ${reachedM ? '→ arrived together: "simultaneous"' : ''}`, 8, y0 + 14, C.text, 9);
    this.text(`M′: flash from B ${reachedMpB ? `✓ at t = ${fmt(tB, 2)}` : '…'}   flash from A ${reachedMpA ? `✓ at t = ${fmt(tA, 2)}` : '…'}   ${reachedMpA ? '→ B first: "B was struck first"' : reachedMpB ? '→ B arrived first' : ''}`, 8, y0 + 28, C.accent, 9);
    this.setReadout([
      ['Train speed β, γ', `${fmt(b, 2)} c,  ${fmt(g, 3)}`],
      ['Platform frame', 'strikes simultaneous'],
      ['M′ gets B, then A', `t_B = ${fmt(tB, 2)},  t_A = ${fmt(tA, 2)}`],
      ['Train frame  Δt′ = γβL/c', `${fmt(g * b * 2, 2)}  (B first)`, C.accent],
      ['Who is right?', 'both frames', C.green],
    ]);
  }
}

/* ------------------------------------------------- 26. light clock ---- */

class LightClockWidget extends CanvasWidget {
  private beta = 0.6;
  private t = 0;
  private ticksRest = 0; private ticksMoving = 0;
  constructor() {
    super(480 / 300);
    this.playButton();
    this.slider('Speed of the moving clock β', 0, 0.95, 0.01, this.beta, (v) => `${fmt(v, 2)} c`, (v) => { this.beta = v; this.t = 0; this.ticksRest = this.ticksMoving = 0; });
  }
  protected draw(dt: number) {
    const c = this.ctx;
    c.fillStyle = C.bg; c.fillRect(0, 0, this.w, this.h);
    const b = this.beta, g = gammaOf(b);
    const x0 = this.w * 0.36, x1 = this.w - 30, span = x1 - x0;
    // mirror separation: shrink at high β so one moving tick (horizontal travel 2βγh) fits on screen
    const h = Math.min(this.h * 0.42, span / (2 * b * g + 0.2));
    const cpx = this.h * 0.46;                             // light speed, px per "second"
    if (dt > 0) this.t += dt;
    const T0 = 2 * h / cpx;                                // rest tick
    const Tm = T0 * g;                                     // moving tick, as seen by us
    const phaseRest = (this.t % T0) / T0;
    const phaseMov = (this.t % Tm) / Tm;
    this.ticksRest = Math.floor(this.t / T0); this.ticksMoving = Math.floor(this.t / Tm);
    const yTop = this.h * 0.2 + (this.h * 0.42 - h) / 2, yBot = yTop + h;
    // rest clock
    const xr = this.w * 0.17;
    this.line(xr - 22, yTop, xr + 22, yTop, C.text, 3); this.line(xr - 22, yBot, xr + 22, yBot, C.text, 3);
    const yr = phaseRest < 0.5 ? yBot - phaseRest * 2 * h : yTop + (phaseRest - 0.5) * 2 * h;
    this.line(xr, yTop, xr, yBot, 'rgba(242,196,90,0.25)', 1, [2, 3]);
    this.glow(xr, yr, 10, 'rgba(242,196,90,0.8)'); this.circle(xr, yr, 3, undefined, '#fff');
    this.text('clock at rest', xr, yTop - 22, C.text, 10, 'center');
    this.text(`ticks: ${this.ticksRest}`, xr, yBot + 18, C.text, 11, 'center', 'mono');
    // moving clock: slides across the right part, wrapping; photon path zig-zag
    const vpx = b * cpx;
    // a lap is a whole number of moving ticks, so the clock never wraps mid-tick
    const ticksPerLap = Math.max(1, Math.floor(span / (vpx * Tm + 1e-9)));
    const Tlap = ticksPerLap * Tm;
    const tLap = vpx > 0 ? this.t % Tlap : 0;
    const xm = x0 + vpx * tLap;
    this.line(xm - 22, yTop, xm + 22, yTop, C.accent, 3); this.line(xm - 22, yBot, xm + 22, yBot, C.accent, 3);
    // photon: in our frame it moves at c along a diagonal; vertical speed c/γ
    const ym = phaseMov < 0.5 ? yBot - phaseMov * 2 * h : yTop + (phaseMov - 0.5) * 2 * h;
    // trail of the photon over this tick
    const xStart = x0 + vpx * (tLap - (tLap % Tm));
    const xMid = xStart + vpx * Tm / 2;
    c.beginPath(); c.moveTo(xStart, yBot); c.lineTo(xMid, yTop); if (phaseMov >= 0.5) c.lineTo(xm, ym); c.strokeStyle = 'rgba(189,155,108,0.45)'; c.lineWidth = 1; c.setLineDash([2, 3]); c.stroke(); c.setLineDash([]);
    if (phaseMov < 0.5) this.line(xStart, yBot, xm, ym, 'rgba(189,155,108,0.45)', 1, [2, 3]);
    this.glow(xm, ym, 10, 'rgba(189,155,108,0.9)'); this.circle(xm, ym, 3, undefined, '#fff');
    this.text(`moving clock  β = ${fmt(b, 2)}`, (x0 + x1) / 2, yTop - 22, C.accent, 10, 'center');
    this.text(`ticks: ${this.ticksMoving}`, xm, yBot + 18, C.accent, 11, 'center', 'mono');
    this.line(x0 - 10, yBot + 32, x1 + 10, yBot + 32, C.grid);
    this.text('both light pulses move at the same speed c on your screen — the moving one has farther to go', this.w / 2, this.h - 10, C.faint, 8, 'center');
    this.setReadout([
      ['γ = 1/√(1 − β²)', fmt(g, 3), C.accent],
      ['Moving clock ticks per rest tick', fmt(1 / g, 3)],
      ['One hour on the moving clock lasts', `${fmt(g, 3)} h for you`],
      ['Path per tick (rest : moving)', `2h : ${fmt(2 * g, 2)} h`],
    ]);
  }
}

/* ------------------------------------------------- 27. cosmic-ray muons ---- */

class MuonWidget extends CanvasWidget {
  private logOneMinusBeta = Math.log10(1 - 0.995);
  private t = 0;
  private readonly hKm = 15;
  private readonly tauUs = 2.2;
  constructor() {
    super(480 / 340);
    this.playButton();
    this.slider('Muon speed β', -4, -0.5, 0.01, this.logOneMinusBeta, (v) => `${(1 - 10 ** v).toFixed(v < -2.5 ? 5 : v < -1.5 ? 4 : 3)} c`, (v) => { this.logOneMinusBeta = v; });
  }
  protected draw(dt: number) {
    const c = this.ctx;
    this.t += dt;
    c.fillStyle = C.bg; c.fillRect(0, 0, this.w, this.h);
    const beta = 1 - 10 ** this.logOneMinusBeta, g = gammaOf(beta);
    const tEarth = (this.hKm * 1e3) / (beta * C_LIGHT) * 1e6;        // µs
    const tMuon = tEarth / g;
    const fClass = Math.exp(-tEarth / this.tauUs), fRel = Math.exp(-tMuon / this.tauUs);
    const colW = this.w * 0.26, y0 = 34, y1 = this.h - 40;
    const col = (x: number, title: string, frac: number, color: string, tLabel: string) => {
      // atmosphere column; survivors drawn as dots whose density ∝ exp(−depth)
      c.fillStyle = 'rgba(111,163,214,0.06)'; c.fillRect(x, y0, colW, y1 - y0);
      c.strokeStyle = C.line; c.strokeRect(x, y0, colW, y1 - y0);
      this.text(title, x + colW / 2, y0 - 16, C.text, 10, 'center');
      this.text(tLabel, x + colW / 2, y0 - 5, C.dim, 8, 'center');
      // falling muons (animated)
      const n = 24;
      for (let i = 0; i < n; i++) {
        const ph = ((this.t * 0.35 + i / n) % 1);
        const depthFrac = ph;                                         // 0 top → 1 ground
        const alive = Math.exp(Math.log(Math.max(1e-9, frac)) * depthFrac);
        if (alive < 0.02) continue;
        const px = x + 8 + ((i * 37) % (colW - 16)), py = y0 + depthFrac * (y1 - y0);
        c.globalAlpha = alive; this.circle(px, py, 1.8, undefined, color); c.globalAlpha = 1;
      }
      // survivors bar at the ground
      const bw = colW - 16, bl = bw * Math.max(0.003, frac);
      c.fillStyle = color; c.fillRect(x + 8, y1 + 8, bl, 8); c.strokeStyle = C.line; c.strokeRect(x + 8, y1 + 8, bw, 8);
      this.text(`${frac < 0.001 ? sci(frac * 100, 1) : fmt(frac * 100, frac < 0.1 ? 2 : 1)} % reach the ground`, x + colW / 2, y1 + 28, color, 9, 'center', 'mono');
    };
    this.text(`created at ${this.hKm} km`, 8, y0 + 6, C.faint, 8); this.text('ground', 8, y1 - 2, C.faint, 8);
    col(this.w * 0.08, 'Newton: no time dilation', fClass, C.red, `${fmt(tEarth, 1)} µs = ${fmt(tEarth / this.tauUs, 1)} lifetimes`);
    col(this.w * 0.39, 'Relativity: muon clock slow by γ', fRel, C.green, `${fmt(tMuon, 2)} µs = ${fmt(tMuon / this.tauUs, 2)} lifetimes`);
    // muon's view: contracted atmosphere
    const x3 = this.w * 0.72, hc = (y1 - y0) / g;
    c.fillStyle = 'rgba(111,163,214,0.06)'; c.fillRect(x3, y1 - hc, colW * 0.9, hc); c.strokeStyle = C.line; c.strokeRect(x3, y1 - hc, colW * 0.9, hc);
    this.text('the muon\'s view', x3 + colW * 0.45, y0 - 16, C.accent, 10, 'center');
    this.text(`atmosphere only ${fmt(this.hKm / g, g > 30 ? 3 : 2)} km thick`, x3 + colW * 0.45, y0 - 5, C.dim, 8, 'center');
    this.line(x3 - 6, y1 - hc, x3 - 6, y1, C.accent, 1); this.text(`${this.hKm}/γ km`, x3 - 10, y1 - hc / 2, C.accent, 8, 'right');
    this.setReadout([
      ['β, γ', `${beta.toFixed(5)},  ${fmt(g, 1)}`, C.accent],
      ['Earth frame  h/(βc)', `${fmt(tEarth, 2)} µs  (τ = 2.2 µs)`],
      ['Muon\'s clock  h/(βcγ)', `${fmt(tMuon, 2)} µs`, C.green],
      ['Survivors: Newton', `${fClass < 1e-3 ? sci(fClass * 100, 1) : fmt(fClass * 100, 2)} %`],
      ['Survivors: Einstein', `${fmt(fRel * 100, 1)} %`, C.green],
      ['Frisch & Smith 1963 (β = 0.995)', '408 ± 9 /h measured; 420 predicted'],
      ['Newtonian prediction', '≈ 27 /h'],
    ]);
  }
}

/* ------------------------------------------------- 28. relativistic energy ---- */

const REL_PARTICLES: Array<[string, number, string]> = [['electron', 0.5110, 'MeV'], ['proton', 938.27, 'MeV'], ['1 kg', 8.98755e16, 'J']];

class RelEnergyWidget extends CanvasWidget {
  private beta = 0.6;
  private pi = 1;
  constructor() {
    super(480 / 360);
    this.playing = false;
    this.segmented(REL_PARTICLES.map(([n], i) => [String(i), n] as [string, string]), '1', (v) => { this.pi = +v; });
    this.slider('Speed β = v/c', 0, 0.995, 0.001, this.beta, (v) => fmt(v, 3), (v) => { this.beta = v; });
  }
  protected draw() {
    const c = this.ctx;
    c.fillStyle = C.bg; c.fillRect(0, 0, this.w, this.h);
    const b = this.beta, g = gammaOf(b);
    const [, mc2, unit] = REL_PARTICLES[this.pi];
    /* left: curves against β (in units of mc², mc) */
    const gx0 = 40, gx1 = this.w * 0.56, gy0 = 16, gy1 = this.h - 30, ymax = 5;
    const GX = (x: number) => gx0 + x * (gx1 - gx0), GY = (y: number) => gy1 - (Math.min(ymax, y) / ymax) * (gy1 - gy0);
    for (let y = 0; y <= ymax; y++) { this.line(gx0, GY(y), gx1, GY(y), C.grid); this.text(fmt(y, 0), gx0 - 4, GY(y), C.faint, 8, 'right', 'mono'); }
    for (const x of [0, 0.5, 1]) { this.line(GX(x), gy0, GX(x), gy1, x === 1 ? 'rgba(212,106,90,0.4)' : C.grid); this.text(`${x}`, GX(x), gy1 + 10, C.faint, 8, 'center', 'mono'); }
    this.text('β = v/c →', gx1, gy1 + 20, C.dim, 9, 'right');
    const curve = (fn: (x: number) => number, col: string, dash?: number[]) => {
      c.beginPath();
      for (let x = 0; x <= 0.9995; x += 0.004) { const y = fn(x); if (x === 0) c.moveTo(GX(x), GY(y)); else c.lineTo(GX(x), GY(y)); }
      c.strokeStyle = col; c.lineWidth = dash ? 1.1 : 1.8; c.setLineDash(dash ?? []); c.stroke(); c.setLineDash([]);
    };
    c.save(); c.beginPath(); c.rect(gx0, gy0, gx1 - gx0, gy1 - gy0); c.clip();
    curve((x) => x, C.dim, [4, 4]);                              // classical p/mc = β
    curve((x) => 0.5 * x * x, C.dim, [2, 3]);                    // classical K/mc² = ½β²
    curve((x) => gammaOf(x) * x, C.blue);                        // p/mc
    curve((x) => gammaOf(x) - 1, C.green);                       // K/mc²
    curve((x) => gammaOf(x), C.accent);                          // γ
    c.restore();
    this.text('γ', GX(0.78), GY(gammaOf(0.78)) - 10, C.accent, 10, 'center', 'serif');
    this.text('p / mc', GX(0.86), GY(gammaOf(0.86) * 0.86) + 12, C.blue, 10, 'center', 'serif');
    this.text('K / mc²', GX(0.9), GY(gammaOf(0.9) - 1) + 12, C.green, 10, 'center', 'serif');
    this.text('dashed: Newton (p = mv, K = ½mv²)', gx0 + 6, gy0 + 8, C.dim, 8, 'left');
    for (const [y, col] of [[g, C.accent], [g * b, C.blue], [g - 1, C.green]] as Array<[number, string]>) { if (y <= ymax) { this.glow(GX(b), GY(y), 7, hexA(col, 0.7)); this.circle(GX(b), GY(y), 3, undefined, '#fff'); } }
    /* right: energy–momentum triangle  E² = (pc)² + (mc²)² */
    const tx0 = this.w * 0.63, ty1 = this.h * 0.72, tw = this.w * 0.32;
    const scale = tw / Math.max(2.2, Math.min(5, g * b + 0.4));
    const pcL = g * b * scale, mL = scale;
    this.line(tx0, ty1, tx0 + pcL, ty1, C.blue, 2.5);                       // pc
    this.line(tx0 + pcL, ty1, tx0 + pcL, ty1 - mL, C.text, 2.5);           // mc²
    this.line(tx0, ty1, tx0 + pcL, ty1 - mL, C.accent, 2.5);               // E
    c.strokeStyle = C.faint; c.strokeRect(tx0 + pcL - 7, ty1 - 7, 7, 7);
    this.text('pc', tx0 + pcL / 2, ty1 + 12, C.blue, 10, 'center', 'serif');
    this.text('mc²', tx0 + pcL + 14, ty1 - mL / 2, C.text, 10, 'left', 'serif');
    this.text('E', tx0 + pcL / 2 - 10, ty1 - mL / 2 - 8, C.accent, 11, 'center', 'serif');
    this.text('E² = (pc)² + (mc²)²', tx0 + tw / 2, this.h * 0.2, C.text, 10, 'center', 'serif');
    this.text('the mc² leg never changes', tx0 + tw / 2, this.h * 0.2 + 14, C.faint, 8, 'center');
    const fmtE = (x: number) => unit === 'J' ? `${sci(x, 3)} J` : x >= 1e4 ? `${fmt(x / 1e3, 2)} GeV` : `${fmt(x, x < 10 ? 3 : 1)} MeV`;
    const Kcl = 0.5 * mc2 * b * b;
    this.setReadout([
      ['γ', fmt(g, 4), C.accent],
      ['Rest energy  E₀ = mc²', fmtE(mc2)],
      ['Total energy  E = γmc²', fmtE(g * mc2), C.accent],
      ['Kinetic energy  K = (γ − 1)mc²', `${fmtE((g - 1) * mc2)}   (Newton: ${fmtE(Kcl)})`, C.green],
      ['Momentum  pc = γβmc²', fmtE(g * b * mc2), C.blue],
    ]);
  }
}

/* ================================================================================ */
/*  Chapter 5 — the interaction of light and matter                                  */
/* ================================================================================ */

const R_H = 1.0967758e7;                 // hydrogen Rydberg constant, m⁻¹
const EV_NM = 1239.842;                  // hc in eV·nm
const M_E = 9.1093837e-31;

/** laboratory emission lines (nm, relative strength) of a few elements */
const EL_LINES: Record<string, Array<[number, number]>> = {
  H: [[656.3, 1], [486.1, 0.55], [434.0, 0.3], [410.2, 0.15], [397.0, 0.08]],
  He: [[587.6, 1], [667.8, 0.5], [501.6, 0.6], [492.2, 0.25], [471.3, 0.2], [447.1, 0.5], [402.6, 0.25], [388.9, 0.35], [706.5, 0.3]],
  Na: [[589.0, 1], [589.6, 0.8], [568.8, 0.2], [615.4, 0.15], [498.3, 0.1], [466.9, 0.08]],
  Ca: [[422.7, 1], [393.4, 0.8], [396.8, 0.7], [445.5, 0.3], [458.6, 0.2], [527.0, 0.15], [558.9, 0.2], [612.2, 0.2], [616.2, 0.25], [643.9, 0.25]],
  Hg: [[435.8, 1], [546.1, 0.9], [577.0, 0.5], [579.1, 0.5], [404.7, 0.5], [407.8, 0.15], [491.6, 0.15], [614.9, 0.1]],
  Ne: [[640.2, 1], [585.2, 0.8], [614.3, 0.7], [633.4, 0.6], [703.2, 0.5], [540.1, 0.4], [616.4, 0.4], [594.5, 0.4], [621.7, 0.4], [650.7, 0.4], [667.8, 0.4], [692.9, 0.3], [724.5, 0.3], [588.2, 0.3], [603.0, 0.3]],
};
const EL_NAMES: Record<string, string> = { H: 'hydrogen', He: 'helium', Na: 'sodium', Ca: 'calcium', Hg: 'mercury', Ne: 'neon' };

/** saturated colour of a spectral line; violet-grey / red-grey outside the visible band */
function lineRGB(nm: number): [number, number, number] {
  if (nm >= 380 && nm <= 780) { const c = waveRGB(nm); const m = Math.max(c[0], c[1], c[2], 1); return [c[0] * 255 / m, c[1] * 255 / m, c[2] * 255 / m]; }
  return nm < 380 ? [150, 120, 230] : [200, 110, 90];
}
/** emission lines on a dark strip, dark lines on a rainbow, or the plain continuum */
function drawLineStrip(ctx: CanvasRenderingContext2D, X: (nm: number) => number, y: number, h: number, lines: Array<[number, number]>, mode: 'em' | 'abs' | 'cont', strength = 1, x0?: number, x1?: number) {
  const L = x0 ?? X(380), R = x1 ?? X(780);
  ctx.save(); ctx.beginPath(); ctx.rect(L, y, R - L, h); ctx.clip();
  if (mode === 'em') {
    ctx.fillStyle = '#05070a'; ctx.fillRect(L, y, R - L, h);
    for (const [nm, s] of lines) { const x = X(nm), a = Math.min(1, s * strength); ctx.fillStyle = rgba(lineRGB(nm), a); ctx.fillRect(x - 1, y, 2, h); ctx.fillStyle = rgba(lineRGB(nm), a * 0.35); ctx.fillRect(x - 2.5, y, 5, h); }
  } else {
    rainbow(ctx, X, y, h, 0.75);
    if (mode === 'abs') for (const [nm, s] of lines) { const x = X(nm), a = Math.min(1, s * strength); ctx.fillStyle = `rgba(5,7,10,${a * 0.92})`; ctx.fillRect(x - 1, y, 2, h); ctx.fillStyle = `rgba(5,7,10,${a * 0.4})`; ctx.fillRect(x - 2.5, y, 5, h); }
  }
  ctx.restore();
}
/** a short sinusoidal "photon" drawn along a segment */
function wavySegment(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, lamPx: number, amp: number, col: string) {
  const L = Math.hypot(x1 - x0, y1 - y0); if (L < 2) return;
  const ux = (x1 - x0) / L, uy = (y1 - y0) / L;
  ctx.beginPath();
  for (let s = 0; s <= L; s += 2) { const o = amp * Math.sin(s / lamPx * TAU); const px = x0 + ux * s - uy * o, py = y0 + uy * s + ux * o; s ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
  ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.stroke();
}
const canvasPos = (canvas: HTMLCanvasElement, e: PointerEvent, w: number, h: number) => { const r = canvas.getBoundingClientRect(); return { x: (e.clientX - r.left) * (w / r.width), y: (e.clientY - r.top) * (h / r.height) }; };

/* ------------------------------------------------- 29. Fraunhofer lines ---- */

const FRAUNHOFER: Array<{ letter: string; nm: number; depth: number; width: number; origin: string }> = [
  { letter: 'A', nm: 759.4, depth: 0.7, width: 1.6, origin: 'O₂ in Earth\'s atmosphere (telluric)' },
  { letter: 'B', nm: 686.7, depth: 0.55, width: 1.2, origin: 'O₂ in Earth\'s atmosphere (telluric)' },
  { letter: 'C', nm: 656.3, depth: 0.75, width: 0.4, origin: 'hydrogen Hα' },
  { letter: 'a', nm: 627.7, depth: 0.3, width: 0.8, origin: 'O₂ (telluric)' },
  { letter: 'D₁', nm: 589.6, depth: 0.8, width: 0.12, origin: 'sodium (Na I)' },
  { letter: 'D₂', nm: 589.0, depth: 0.85, width: 0.12, origin: 'sodium (Na I)' },
  { letter: 'E', nm: 527.0, depth: 0.6, width: 0.1, origin: 'iron (Fe I)' },
  { letter: 'b₁', nm: 518.4, depth: 0.7, width: 0.12, origin: 'magnesium (Mg I)' },
  { letter: 'b₂', nm: 517.3, depth: 0.65, width: 0.12, origin: 'magnesium (Mg I)' },
  { letter: 'b₄', nm: 516.7, depth: 0.6, width: 0.12, origin: 'magnesium + iron' },
  { letter: 'F', nm: 486.1, depth: 0.75, width: 0.35, origin: 'hydrogen Hβ' },
  { letter: 'd', nm: 438.4, depth: 0.5, width: 0.1, origin: 'iron (Fe I)' },
  { letter: 'G', nm: 430.8, depth: 0.7, width: 0.8, origin: 'CH molecule + iron + calcium (the G band)' },
  { letter: 'h', nm: 410.2, depth: 0.6, width: 0.3, origin: 'hydrogen Hδ' },
  { letter: 'H', nm: 396.8, depth: 0.95, width: 1.5, origin: 'ionised calcium (Ca II)' },
  { letter: 'K', nm: 393.4, depth: 0.95, width: 1.8, origin: 'ionised calcium (Ca II)' },
];

class FraunhoferWidget extends CanvasWidget {
  private cursor = 589.3; private zoom = 1;
  constructor() {
    super(480 / 270);
    this.slider('Zoom', 1, 12, 0.1, 1, (v) => `${fmt(v, 1)}×`, (v) => { this.zoom = v; });
    let drag: { x: number; c: number } | null = null;
    this.canvas.addEventListener('pointerdown', (e) => { this.canvas.setPointerCapture(e.pointerId); const { x } = canvasPos(this.canvas, e, this.w, this.h); if (this.zoom < 1.05) { const v = this.view(); this.cursor = v.l0 + x / this.w * v.span; } drag = { x, c: this.cursor }; });
    this.canvas.addEventListener('pointermove', (e) => { if (!drag) return; const { span } = this.view(); const { x } = canvasPos(this.canvas, e, this.w, this.h); this.cursor = Math.max(380, Math.min(780, drag.c + (x - drag.x) / this.w * span)); });
    this.canvas.addEventListener('pointerup', () => { drag = null; });
    this.canvas.style.touchAction = 'none'; this.canvas.style.cursor = 'ew-resize';
    this.controls.appendChild($('div', 'lw-caption', 'Drag across the spectrum; zoom in to resolve the lines.'));
  }
  private view() { const span = 400 / this.zoom; const l0 = Math.max(380, Math.min(780 - span, this.cursor - span / 2)); return { l0, span }; }
  protected draw() {
    const c = this.ctx; c.fillStyle = C.bg; c.fillRect(0, 0, this.w, this.h);
    const { l0, span } = this.view(); const nmPx = span / this.w;
    const X = (nm: number) => (nm - l0) / span * this.w;
    const y0 = 28, hS = 66, yG0 = y0 + hS + 30, hG = this.h - yG0 - 18;
    const I = (nm: number) => { let a = 1; for (const f of FRAUNHOFER) { const s = Math.max(f.width, nmPx * 0.9); const d = (nm - f.nm) / s; a *= 1 - f.depth * Math.exp(-d * d * 1.4); } return a * planck(nm * 1e-9, 5772) / planck(500e-9, 5772); };
    for (let px = 0; px < this.w; px++) { const nm = l0 + px * nmPx; const i = I(nm); const col = waveRGB(nm); c.fillStyle = rgba([col[0] * i, col[1] * i, col[2] * i]); c.fillRect(px, y0, 1.2, hS); }
    let lastX = -99, row = 0;
    for (const f of FRAUNHOFER) { const x = X(f.nm); if (x < 0 || x > this.w) continue; row = x - lastX < 14 && lastX > -99 ? (row + 1) % 2 : 0; lastX = x; const close = Math.abs(f.nm - this.cursor) < Math.max(1, nmPx * 4); this.text(f.letter, x, y0 - 10 - row * 10, close ? C.sun : C.dim, close ? 11 : 9, 'center', 'serif'); this.line(x, y0 - 4, x, y0, close ? C.sun : C.faint); }
    c.beginPath(); for (let px = 0; px < this.w; px++) { const nm = l0 + px * nmPx; const y = yG0 + hG - I(nm) * hG * 0.95; px === 0 ? c.moveTo(px, y) : c.lineTo(px, y); } c.strokeStyle = C.text; c.lineWidth = 1.2; c.stroke();
    this.line(0, yG0 + hG, this.w, yG0 + hG, C.grid);
    const step = span > 300 ? 50 : span > 120 ? 20 : span > 50 ? 10 : span > 20 ? 5 : 1;
    for (let nm = Math.ceil(l0 / step) * step; nm <= l0 + span; nm += step) { const x = X(nm); this.line(x, yG0 + hG, x, yG0 + hG + 4, C.line); this.text(`${nm}`, x, yG0 + hG + 11, C.dim, 8, 'center', 'mono'); }
    this.text('intensity', 6, yG0 + 6, C.dim, 8); this.text('wavelength (nm)', this.w - 6, yG0 + 6, C.dim, 8, 'right');
    const xc = X(this.cursor); this.line(xc, y0 - 4, xc, yG0 + hG, hexA(C.sun, 0.8), 1, [3, 3]);
    let best = FRAUNHOFER[0]; for (const f of FRAUNHOFER) if (Math.abs(f.nm - this.cursor) < Math.abs(best.nm - this.cursor)) best = f;
    const near = Math.abs(best.nm - this.cursor) < Math.max(1.5, nmPx * 4);
    this.setReadout([
      ['Cursor', `${fmt(this.cursor, this.zoom > 4 ? 2 : 1)} nm`, C.sun],
      ['Nearest Fraunhofer line', `${best.letter}  ${fmt(best.nm, 1)} nm${near ? '' : '  (move closer)'}`],
      ['Origin', near ? best.origin : '—', near ? C.green : C.dim],
      ['Line depth', near ? `${Math.round(best.depth * 100)} % of the continuum removed` : '—'],
    ]);
  }
}

/* ------------------------------------------------- 30. Kirchhoff's laws ---- */

class KirchhoffWidget extends CanvasWidget {
  private elem = 'Na'; private gas = true; private T = 5000;
  private obs = { x: 0.82, y: 0.5 }; private dragging = false; private t = 0;
  constructor() {
    super(480 / 300);
    this.segmented<'on' | 'off'>([['on', 'gas on'], ['off', 'gas off']], 'on', (v) => { this.gas = v === 'on'; });
    this.segmented<string>(Object.keys(EL_LINES).map((k) => [k, k] as [string, string]), 'Na', (v) => { this.elem = v; });
    this.slider('Gas temperature', 1500, 10000, 50, 5000, (v) => `${v} K`, (v) => { this.T = v; });
    this.canvas.addEventListener('pointerdown', (e) => { const p = canvasPos(this.canvas, e, this.w, this.h); if (Math.hypot(p.x - this.obs.x * this.w, p.y - this.obs.y * this.h) < 40) { this.dragging = true; this.canvas.setPointerCapture(e.pointerId); } });
    this.canvas.addEventListener('pointermove', (e) => { if (!this.dragging) return; const p = canvasPos(this.canvas, e, this.w, this.h); this.obs = { x: Math.max(0.04, Math.min(0.96, p.x / this.w)), y: Math.max(0.08, Math.min(0.64, p.y / this.h)) }; });
    this.canvas.addEventListener('pointerup', () => { this.dragging = false; });
    this.canvas.style.touchAction = 'none'; this.canvas.style.cursor = 'grab';
    this.controls.appendChild($('div', 'lw-caption', 'Drag the observer: look at the lamp through the gas, at the gas alone, or switch the gas off.'));
  }
  protected draw(dt: number) {
    this.t += dt;
    const c = this.ctx; c.fillStyle = C.bg; c.fillRect(0, 0, this.w, this.h);
    const ySc = this.h * 0.36;
    const lamp = { x: this.w * 0.12, y: ySc }, cloud = { x: this.w * 0.42, y: ySc, r: Math.min(this.w, this.h) * 0.15 };
    const obs = { x: this.obs.x * this.w, y: this.obs.y * this.h };
    const vx = lamp.x - obs.x, vy = lamp.y - obs.y, L2 = vx * vx + vy * vy;
    const tt = Math.max(0, Math.min(1, ((cloud.x - obs.x) * vx + (cloud.y - obs.y) * vy) / L2));
    const segDist = Math.hypot(cloud.x - (obs.x + tt * vx), cloud.y - (obs.y + tt * vy));
    const outside = Math.hypot(obs.x - cloud.x, obs.y - cloud.y) > cloud.r;
    const mode: 'cont' | 'em' | 'abs' = !this.gas ? 'cont' : segDist < cloud.r && outside ? 'abs' : 'em';
    const target = mode === 'em' ? cloud : lamp;
    const g = c.createRadialGradient(lamp.x, lamp.y, 0, lamp.x, lamp.y, this.w * 0.9); g.addColorStop(0, 'rgba(242,196,90,0.22)'); g.addColorStop(1, 'rgba(242,196,90,0)'); c.fillStyle = g; c.fillRect(0, 0, this.w, this.h * 0.7);
    this.glow(lamp.x, lamp.y, 34, 'rgba(255,230,160,0.9)'); this.circle(lamp.x, lamp.y, 9, undefined, '#fff8e0');
    this.text('lamp (hot, dense)', lamp.x, lamp.y + 30, C.text, 9, 'center');
    const lines = EL_LINES[this.elem]; const s = Math.max(0, Math.min(1, (this.T - 1500) / 5000));
    const mix = lines.reduce((acc, [nm, st]) => { const col = lineRGB(nm); return [acc[0] + col[0] * st, acc[1] + col[1] * st, acc[2] + col[2] * st, acc[3] + st]; }, [0, 0, 0, 0] as number[]);
    const gasCol: [number, number, number] = [mix[0] / mix[3], mix[1] / mix[3], mix[2] / mix[3]];
    if (this.gas) {
      for (let i = 0; i < 3; i++) { const rr = cloud.r * (1 - i * 0.22); const pulse = 0.5 + 0.5 * Math.sin(this.t * 2 + i); c.fillStyle = rgba(gasCol, 0.06 + 0.12 * s * pulse); c.beginPath(); c.arc(cloud.x + Math.sin(this.t * 0.7 + i) * 4, cloud.y + Math.cos(this.t * 0.9 + i) * 3, rr, 0, TAU); c.fill(); }
      this.circle(cloud.x, cloud.y, cloud.r, rgba(gasCol, 0.5), undefined, 1, [3, 4]);
      this.text(`${this.elem} gas (thin, ${this.T} K)`, cloud.x, cloud.y + cloud.r + 12, rgba(gasCol, 0.9), 9, 'center');
    } else { this.circle(cloud.x, cloud.y, cloud.r, C.grid, undefined, 1, [3, 4]); this.text('gas off', cloud.x, cloud.y + cloud.r + 12, C.faint, 9, 'center'); }
    this.line(obs.x, obs.y, target.x, target.y, hexA(C.text, 0.5), 1, [4, 4]);
    this.circle(obs.x, obs.y, 13, C.text, '#141922', 1.5); this.circle(obs.x, obs.y, 5, undefined, C.text); this.circle(obs.x + 1, obs.y - 1, 2, undefined, '#000');
    this.text('observer — drag me', obs.x, obs.y - 22, C.text, 9, 'center');
    const yS = this.h * 0.74, hS = this.h * 0.17;
    const X = (nm: number) => 24 + (nm - 380) / 400 * (this.w - 48);
    const strength = mode === 'em' ? 0.35 + s : 0.3 + s * 0.8;
    drawLineStrip(c, X, yS, hS, lines, mode, strength);
    c.strokeStyle = C.line; c.strokeRect(24, yS, this.w - 48, hS);
    for (const nm of [400, 500, 600, 700]) this.text(`${nm}`, X(nm), yS + hS + 9, C.dim, 8, 'center', 'mono');
    const law = mode === 'cont' ? ['Law 1 — continuous spectrum', 'hot dense source seen directly'] : mode === 'em' ? ['Law 2 — emission lines', 'hot thin gas seen against darkness'] : ['Law 3 — absorption lines', 'cool thin gas in front of a continuum'];
    const lc = mode === 'cont' ? C.sun : mode === 'em' ? C.green : C.blue;
    this.text(law[0], this.w / 2, yS - 10, lc, 11, 'center', 'serif');
    this.setReadout([
      ['What the spectroscope sees', law[0], lc],
      ['Why', law[1]],
      ['Element', `${EL_NAMES[this.elem]} — strongest line ${fmt(lines[0][0], 1)} nm`],
      ['Line strength', this.gas ? `${Math.round(Math.min(1, strength) * 100)} %  (grows with temperature)` : '—'],
    ]);
  }
}

/* ------------------------------------------------- 31. identify the element ---- */

class ElementIdWidget extends CanvasWidget {
  private pool = Object.keys(EL_LINES);
  private answer = 'He'; private picked: string | null = null; private score = 0; private tries = 0; private timer = 0; private mode: 'em' | 'abs' = 'em'; private jitter: number[] = [];
  constructor() {
    super(480 / 330);
    this.segmented<'em' | 'abs'>([['em', 'emission'], ['abs', 'absorption']], 'em', (v) => { this.mode = v; });
    const b = $('button', 'lw-btn', '↻ new mystery'); b.addEventListener('click', () => this.next()); this.controls.appendChild(b);
    this.canvas.addEventListener('pointerdown', (e) => { const { y } = canvasPos(this.canvas, e, this.w, this.h); const i = this.rowAt(y); if (i >= 0 && this.picked === null) { this.picked = this.pool[i]; this.tries++; if (this.picked === this.answer) this.score++; this.timer = 2.8; } });
    this.canvas.style.cursor = 'pointer';
    this.controls.appendChild($('div', 'lw-caption', 'Click the reference spectrum that matches the mystery.'));
    this.next();
  }
  private next() { let a = this.answer; while (a === this.answer) a = this.pool[Math.floor(Math.random() * this.pool.length)]; this.answer = a; this.picked = null; this.jitter = EL_LINES[a].map(() => 0.7 + Math.random() * 0.6); }
  private layout() { const top = 22, hM = 44, y0 = top + hM + 30; const hR = (this.h - y0 - 12) / this.pool.length; return { top, hM, y0, hR }; }
  private rowAt(y: number) { const { y0, hR } = this.layout(); const i = Math.floor((y - y0) / hR); return i >= 0 && i < this.pool.length ? i : -1; }
  protected draw(dt: number) {
    if (this.picked !== null) { this.timer -= dt; if (this.timer <= 0) this.next(); }
    const c = this.ctx; c.fillStyle = C.bg; c.fillRect(0, 0, this.w, this.h);
    const { top, hM, y0, hR } = this.layout();
    const X = (nm: number) => 60 + (nm - 380) / 400 * (this.w - 72);
    this.text('mystery', 8, top + hM / 2, C.sun, 9);
    const myst = EL_LINES[this.answer].map(([nm, s], i) => [nm, s * this.jitter[i]] as [number, number]);
    drawLineStrip(c, X, top, hM, myst, this.mode, 1); c.strokeStyle = C.sun; c.strokeRect(X(380), top, X(780) - X(380), hM);
    this.pool.forEach((el, i) => {
      const y = y0 + i * hR + 3, h = hR - 6;
      drawLineStrip(c, X, y, h, EL_LINES[el], this.mode, 1);
      let stroke = C.grid; if (this.picked !== null) { if (el === this.answer) stroke = C.green; else if (el === this.picked) stroke = C.red; }
      c.strokeStyle = stroke; c.lineWidth = stroke === C.grid ? 1 : 2; c.strokeRect(X(380), y, X(780) - X(380), h); c.lineWidth = 1;
      this.text(el, 8, y + h / 2, this.picked !== null && el === this.answer ? C.green : C.text, 11, 'left', 'serif');
      if (this.picked !== null && el === this.answer) this.text(EL_NAMES[el], 28, y + h / 2, C.green, 7);
    });
    for (const nm of [400, 500, 600, 700]) this.text(`${nm}`, X(nm), this.h - 5, C.dim, 7, 'center', 'mono');
    if (this.picked !== null) { const ok = this.picked === this.answer; this.text(ok ? 'Correct!' : `Not quite — it was ${EL_NAMES[this.answer]}`, this.w / 2, top + hM + 15, ok ? C.green : C.red, 11, 'center', 'serif'); }
    else this.text('which element is this?', this.w / 2, top + hM + 15, C.dim, 9, 'center');
    this.setReadout([
      ['Score', `${this.score} / ${this.tries}`, C.accent],
      ['Hint', this.mode === 'em' ? 'compare line spacing, not just colours' : 'dark lines sit where emission lines would be'],
      ['Reveal', this.picked !== null ? `${EL_NAMES[this.answer]} (${this.answer}): strongest line ${fmt(EL_LINES[this.answer][0][0], 1)} nm` : 'pick a spectrum'],
    ]);
  }
}

/* ------------------------------------------------- 32. Doppler-shifted lines ---- */

const DOP_LINES: Array<[number, string]> = [[393.4, 'Ca K'], [396.8, 'Ca H'], [434.0, 'Hγ'], [486.1, 'Hβ'], [518.4, 'Mg b'], [589.3, 'Na D'], [656.3, 'Hα']];

class DopplerLinesWidget extends CanvasWidget {
  private mode: 'star' | 'galaxy' = 'star'; private v = 120; private t = 0;
  private sliderEl: HTMLElement | null = null;
  constructor() {
    super(480 / 320);
    this.playButton();
    this.segmented<'star' | 'galaxy'>([['star', 'star  (km/s)'], ['galaxy', 'galaxy  (fraction of c)']], 'star', (m) => { this.mode = m; this.rebuildSlider(); });
    this.rebuildSlider();
  }
  private rebuildSlider() {
    this.sliderEl?.remove();
    if (this.mode === 'star') { this.v = 120; this.sliderEl = this.slider('Radial velocity v_r', -600, 600, 5, this.v, (v) => `${v > 0 ? '+' : ''}${v} km/s`, (v) => { this.v = v; }).input.parentElement; }
    else { this.v = 0.1; this.sliderEl = this.slider('Radial velocity v_r / c', -0.3, 0.9, 0.005, this.v, (v) => `${v > 0 ? '+' : ''}${fmt(v, 3)} c`, (v) => { this.v = v; }).input.parentElement; }
  }
  protected draw(dt: number) {
    this.t += dt;
    const c = this.ctx; c.fillStyle = C.bg; c.fillRect(0, 0, this.w, this.h);
    const beta = this.mode === 'star' ? this.v / 299792.458 : this.v;
    const z = Math.sqrt((1 + beta) / (1 - beta)) - 1;
    const yS = this.h * 0.3, hTop = this.h * 0.54;
    const bDisp = this.mode === 'star' ? Math.max(-0.8, Math.min(0.8, beta * 250)) : Math.max(-0.8, Math.min(0.85, beta));
    const cpx = this.w * 0.28, period = 0.45, sx0 = this.w * 0.38, obsX = this.w * 0.9;
    const T = this.t % 6; const srcX = (t: number) => sx0 - bDisp * cpx * (t - 3);
    c.save(); c.beginPath(); c.rect(0, 0, this.w, hTop); c.clip();
    for (let k = 0; k * period < T; k++) { const te = k * period; const r = cpx * (T - te); if (r > this.w) continue; this.circle(srcX(te), yS, r, hexA(C.text, Math.max(0.05, 0.5 - r / this.w * 0.6))); }
    c.restore();
    this.glow(srcX(T), yS, 16, 'rgba(255,240,200,0.9)'); this.circle(srcX(T), yS, 5, undefined, '#fff');
    this.circle(obsX, yS, 10, C.text, '#141922', 1.5); this.circle(obsX, yS, 4, undefined, C.text);
    this.text('observer', obsX, yS + 20, C.text, 9, 'center');
    this.text(beta > 0 ? 'receding → waves stretched → redshift' : beta < 0 ? 'approaching → waves compressed → blueshift' : 'at rest — no shift', this.w / 2, 12, beta > 0 ? C.red : beta < 0 ? C.blue : C.dim, 10, 'center');
    if (this.mode === 'star') this.text(`wavefront picture exaggerated ×250  (true β = ${sci(beta, 2)})`, this.w / 2, hTop - 8, C.faint, 8, 'center');
    const X = (nm: number) => 36 + (nm - 350) / 450 * (this.w - 48);
    const y1 = hTop + 22, hS = (this.h - y1 - 34) / 2 - 8, y2 = y1 + hS + 16;
    const rest = DOP_LINES.map(([nm]) => [nm, 0.9] as [number, number]);
    const obs = DOP_LINES.map(([nm]) => [nm * (1 + z), 0.9] as [number, number]);
    this.text('laboratory (rest)', X(800), y1 - 8, C.dim, 8, 'right'); this.text('observed', X(800), y2 - 8, beta > 0 ? C.red : C.blue, 8, 'right');
    drawLineStrip(c, X, y1, hS, rest, 'abs', 1, X(350), X(800));
    drawLineStrip(c, X, y2, hS, obs, 'abs', 1, X(350), X(800));
    let lastRight = -1e9;
    for (let i = 0; i < DOP_LINES.length; i++) {
      const xr = X(rest[i][0]), xo = Math.max(X(350), Math.min(X(800), X(obs[i][0])));
      this.line(xr, y1 + hS, xo, y2, hexA(beta > 0 ? C.red : C.blue, 0.6));
      const tw = DOP_LINES[i][1].length * 4.2; const stacked = xr - tw / 2 < lastRight + 3;
      this.text(DOP_LINES[i][1], xr, y1 - (stacked ? 17 : 8), C.dim, 7, 'center'); lastRight = stacked ? lastRight : xr + tw / 2;
    }
    for (const nm of [400, 500, 600, 700, 800]) this.text(`${nm}`, X(nm), y2 + hS + 9, C.dim, 8, 'center', 'mono');
    const ha = 656.281 * (1 + z);
    this.setReadout([
      ['Radial velocity', this.mode === 'star' ? `${this.v > 0 ? '+' : ''}${this.v} km/s` : `${fmt(this.v, 3)} c`, beta > 0 ? C.red : C.blue],
      ['Redshift z = Δλ/λ', this.mode === 'star' ? sci(z, 2) : fmt(z, 4), C.accent],
      ['Hα 656.28 nm observed at', `${fmt(ha, this.mode === 'star' ? 3 : 1)} nm  (Δλ = ${fmt(ha - 656.281, this.mode === 'star' ? 3 : 1)} nm)`],
      ['Formula', this.mode === 'star' ? 'v_r ≈ c·Δλ/λ   (v ≪ c)' : '1 + z = √((1+β)/(1−β))'],
    ]);
  }
}

/* ------------------------------------------------- 33. spectroscopic binary ---- */

class SpecBinaryWidget extends CanvasWidget {
  private inc = 70; private q = 0.6; private phase = 0;
  constructor() {
    super(480 / 320);
    this.playButton();
    this.slider('Inclination i', 0, 90, 1, 70, (v) => `${v}°`, (v) => { this.inc = v; });
    this.slider('Mass ratio m₂/m₁', 0.2, 1, 0.05, 0.6, (v) => fmt(v, 2), (v) => { this.q = v; });
  }
  protected draw(dt: number) {
    this.phase = (this.phase + dt * 0.22) % 1;
    const c = this.ctx; c.fillStyle = C.bg; c.fillRect(0, 0, this.w, this.h);
    const si = Math.sin(this.inc * DEG), ci = Math.cos(this.inc * DEG);
    const v2 = 220, v1 = this.q * v2, ph = this.phase * TAU;
    const vr1 = v1 * si * Math.sin(ph), vr2 = -v2 * si * Math.sin(ph);
    const ox = this.w * 0.22, oy = this.h * 0.3, R = Math.min(this.w * 0.17, this.h * 0.22);
    const a2 = R, a1 = R * this.q;
    const ellipse = (a: number, col: string) => { c.beginPath(); c.ellipse(ox, oy, a, Math.max(1, a * ci), 0, 0, TAU); c.strokeStyle = col; c.setLineDash([3, 4]); c.stroke(); c.setLineDash([]); };
    ellipse(a1, hexA(C.blue, 0.5)); ellipse(a2, hexA(C.accent, 0.5));
    const p1 = { x: ox + a1 * Math.cos(ph), y: oy + a1 * Math.sin(ph) * ci }, p2 = { x: ox - a2 * Math.cos(ph), y: oy - a2 * Math.sin(ph) * ci };
    this.circle(ox, oy, 2, undefined, C.dim);
    this.glow(p1.x, p1.y, 14, hexA(C.blue, 0.8)); this.circle(p1.x, p1.y, 6, undefined, '#dfe9ff');
    this.glow(p2.x, p2.y, 11, hexA(C.accent, 0.8)); this.circle(p2.x, p2.y, 4, undefined, '#ffe3b8');
    this.text('1', p1.x, p1.y - 12, C.blue, 9, 'center', 'serif'); this.text('2', p2.x, p2.y - 10, C.accent, 9, 'center', 'serif');
    this.text(`orbit as seen from Earth, i = ${this.inc}°`, ox, oy + R + 16, C.dim, 8, 'center');
    this.text(this.inc < 10 ? 'nearly face-on: stars move across the sky, not along the line of sight' : this.inc > 80 ? 'nearly edge-on: full orbital speed along the line of sight' : '', ox, oy + R + 28, C.faint, 7, 'center');
    const gx0 = this.w * 0.47, gx1 = this.w - 12, gy0 = 14, gy1 = this.h * 0.56, gyc = (gy0 + gy1) / 2, vmax = 250;
    const GX = (f: number) => gx0 + f * (gx1 - gx0), GY = (v: number) => gyc - v / vmax * (gy1 - gy0) / 2;
    this.line(gx0, gyc, gx1, gyc, C.grid); this.line(gx0, gy0, gx0, gy1, C.grid);
    for (const [vv, col, sg] of [[v1, C.blue, 1], [v2, C.accent, -1]] as Array<[number, string, number]>) { c.beginPath(); for (let i = 0; i <= 100; i++) { const f = i / 100; const vr = sg * vv * si * Math.sin(f * TAU); i ? c.lineTo(GX(f), GY(vr)) : c.moveTo(GX(f), GY(vr)); } c.strokeStyle = col; c.lineWidth = 1.5; c.stroke(); }
    this.circle(GX(this.phase), GY(vr1), 3.5, undefined, C.blue); this.circle(GX(this.phase), GY(vr2), 3.5, undefined, C.accent);
    this.text('radial velocity (receding ↑)', gx0 + 4, gy0 + 2, C.dim, 8); this.text('+200 km/s', gx0 + 4, GY(200), C.faint, 7); this.text('−200', gx0 + 4, GY(-200), C.faint, 7); this.text('orbital phase →', gx1, gy1 + 8, C.dim, 8, 'right');
    const EX = 60, yS = this.h * 0.7, hS = this.h * 0.15;
    const X = (nm: number) => 24 + (nm - 440) / 280 * (this.w - 48);
    const LINES: Array<[number, string]> = [[486.1, 'Hβ'], [518.4, 'Mg b'], [589.3, 'Na D'], [656.3, 'Hα']];
    const sh = (nm: number, vr: number) => nm * (1 + vr / 299792.458 * EX);
    c.save(); c.beginPath(); c.rect(X(440), yS, X(720) - X(440), hS); c.clip(); rainbow(c, X, yS, hS, 0.75);
    for (const [nm] of LINES) { c.fillStyle = 'rgba(5,7,10,0.85)'; c.fillRect(X(sh(nm, vr1)) - 1, yS, 2, hS); c.fillStyle = `rgba(5,7,10,${0.85 * Math.sqrt(this.q)})`; c.fillRect(X(sh(nm, vr2)) - 1, yS, 2, hS); }
    c.restore();
    for (const [nm, name] of LINES) { this.text(name, X(nm), yS - 8, C.dim, 8, 'center'); this.line(X(sh(nm, vr1)), yS + hS + 1, X(sh(nm, vr1)), yS + hS + 6, C.blue, 2); this.line(X(sh(nm, vr2)), yS + hS + 1, X(sh(nm, vr2)), yS + hS + 6, C.accent, 2); }
    this.text(`line shifts exaggerated ×${EX}`, this.w / 2, yS + hS + 16, C.faint, 8, 'center');
    this.setReadout([
      ['Star 1 (heavier)  v_r', `${vr1 >= 0 ? '+' : ''}${fmt(vr1, 0)} km/s`, C.blue],
      ['Star 2 (lighter)  v_r', `${vr2 >= 0 ? '+' : ''}${fmt(vr2, 0)} km/s`, C.accent],
      ['Amplitudes K₁, K₂ = v sin i', `${fmt(v1 * si, 0)}, ${fmt(v2 * si, 0)} km/s`],
      ['K₁ / K₂ = m₂ / m₁', fmt(this.q, 2), C.green],
    ]);
  }
}

/* ------------------------------------------------- 34. photoelectric effect ---- */

const METALS: Array<[string, number]> = [['Cs', 1.95], ['K', 2.30], ['Na', 2.28], ['Zn', 4.33], ['Cu', 4.70], ['Pt', 5.65]];

class PhotoelectricWidget extends CanvasWidget {
  private lam = 350; private inten = 0.6; private Vret = 0; private metal = 1;
  private photons: Array<{ x: number; y: number; ty: number }> = []; private electrons: Array<{ x: number; y: number; vx: number; vy: number }> = [];
  private emitAcc = 0;
  constructor() {
    super(480 / 250);
    this.segmented<string>(METALS.map(([m, phi]) => [m, `${m} (${fmt(phi, 2)} eV)`] as [string, string]), 'K', (m) => { this.metal = METALS.findIndex(([x]) => x === m); });
    this.slider('Wavelength λ', 150, 700, 1, 350, (v) => `${v} nm`, (v) => { this.lam = v; });
    this.slider('Intensity', 0, 1, 0.01, 0.6, (v) => `${Math.round(v * 100)} %`, (v) => { this.inten = v; });
    this.slider('Retarding voltage', 0, 6, 0.05, 0, (v) => `${fmt(v, 2)} V`, (v) => { this.Vret = v; });
  }
  protected draw(dt: number) {
    const c = this.ctx; c.fillStyle = C.bg; c.fillRect(0, 0, this.w, this.h);
    const phi = METALS[this.metal][1], E = EV_NM / this.lam, Kmax = E - phi, nu = C_LIGHT / (this.lam * 1e-9);
    const ax0 = 12, ax1 = this.w * 0.58, plateX = ax0 + 26, collX = ax1 - 18, yTop = 30, yBot = this.h - 32;
    c.fillStyle = '#131821'; c.fillRect(ax0, yTop - 10, ax1 - ax0, yBot - yTop + 20); c.strokeStyle = C.grid; c.strokeRect(ax0, yTop - 10, ax1 - ax0, yBot - yTop + 20);
    c.fillStyle = '#5a6373'; c.fillRect(plateX - 6, yTop, 8, yBot - yTop); c.fillStyle = '#3c4452'; c.fillRect(collX, yTop, 6, yBot - yTop);
    this.text(`${METALS[this.metal][0]} plate`, plateX - 2, yBot + 14, C.text, 9, 'center'); this.text('collector', collX + 3, yBot + 14, C.text, 9, 'center');
    this.text(`−${fmt(this.Vret, 1)} V`, collX + 3, yTop - 16, this.Vret > 0 ? C.red : C.dim, 9, 'center', 'mono');
    const lampX = (plateX + collX) / 2 + 20, lampY = yTop - 2;
    const col: [number, number, number] = this.lam >= 380 && this.lam <= 780 ? lineRGB(this.lam) : this.lam < 380 ? [170, 120, 255] : [255, 120, 80];
    this.glow(lampX, lampY + 6, 22, rgba(col, 0.6 * (0.3 + this.inten)));
    this.text(this.lam < 380 ? 'ultraviolet' : this.lam > 780 ? 'infrared' : 'visible', lampX, lampY - 16, rgba(col), 8, 'center');
    this.emitAcc += this.inten * 40 * dt;
    while (this.emitAcc >= 1) { this.emitAcc -= 1; this.photons.push({ x: lampX + (Math.random() - 0.5) * 12, y: lampY + 10, ty: yTop + 16 + Math.random() * (yBot - yTop - 32) }); }
    const vPh = this.w * 0.9, v0 = this.w * 0.14;
    for (let i = this.photons.length - 1; i >= 0; i--) {
      const ph = this.photons[i]; const dx = plateX + 3 - ph.x, dy = ph.ty - ph.y, d = Math.hypot(dx, dy), step = vPh * dt;
      if (d <= step) { this.photons.splice(i, 1); if (Kmax > 0) { const K = Kmax * (0.45 + 0.55 * Math.random()); const v = v0 * Math.sqrt(K); const ang = (Math.random() - 0.5) * 0.5; this.electrons.push({ x: plateX + 4, y: ph.ty, vx: v * Math.cos(ang), vy: v * Math.sin(ang) }); } }
      else { ph.x += dx / d * step; ph.y += dy / d * step; this.glow(ph.x, ph.y, 5, rgba(col, 0.9)); }
    }
    const a = v0 * v0 * this.Vret / (2 * (collX - plateX));
    for (let i = this.electrons.length - 1; i >= 0; i--) {
      const e = this.electrons[i]; e.vx -= a * dt; e.x += e.vx * dt; e.y += e.vy * dt;
      if (e.x >= collX || e.x < plateX || e.y < yTop || e.y > yBot) { this.electrons.splice(i, 1); continue; }
      c.fillStyle = C.blue; c.beginPath(); c.arc(e.x, e.y, 1.8, 0, TAU); c.fill();
    }
    const gx0 = this.w * 0.64, gx1 = this.w - 10, gy0 = 24, gy1 = this.h * 0.56, numax = 2.1e15, kAx = 7;
    const GX = (f: number) => gx0 + f / numax * (gx1 - gx0), GY = (k: number) => gy1 - k / kAx * (gy1 - gy0);
    this.line(gx0, gy1, gx1, gy1, C.line); this.line(gx0, gy0, gx0, gy1, C.line);
    this.text('K_max (eV)', gx0 + 3, gy0 - 8, C.dim, 8); this.text('frequency ν →', gx1, gy1 + 9, C.dim, 8, 'right');
    for (let k = 0; k <= kAx; k += 2) this.text(`${k}`, gx0 - 4, GY(k), C.faint, 7, 'right', 'mono');
    METALS.forEach(([, ph], i) => { const nu0 = ph * EV / H_PLANCK, nuEnd = Math.min(numax, (kAx + ph) * EV / H_PLANCK); const col2 = i === this.metal ? C.accent : C.grid; this.line(GX(nu0), gy1, GX(nuEnd), GY(nuEnd * H_PLANCK / EV - ph), col2, i === this.metal ? 1.8 : 1); });
    this.circle(GX(Math.min(numax, nu)), GY(Math.min(kAx, Math.max(0, Kmax))), 4, '#fff', Kmax > 0 ? rgba(col) : C.red);
    this.text(`threshold λ₀ = hc/φ = ${fmt(EV_NM / phi, 0)} nm`, gx0, gy1 + 22, C.dim, 8);
    this.text('same slope h for every metal', gx0, gy1 + 33, C.accent, 8);
    const frac = Kmax <= 0 ? 0 : this.Vret <= 0.45 * Kmax ? 1 : Math.max(0, (Kmax - this.Vret) / (0.55 * Kmax));
    const I = this.inten * frac, my = this.h - 36;
    c.fillStyle = C.grid; c.fillRect(gx0, my, gx1 - gx0, 10); c.fillStyle = I > 0 ? C.green : C.red; c.fillRect(gx0, my, (gx1 - gx0) * I, 10);
    this.text(`photocurrent ${Math.round(I * 100)} %`, gx0, my - 8, C.text, 9);
    this.setReadout([
      ['Photon energy  hν = 1240 eV·nm / λ', `${fmt(E, 2)} eV`, rgba(col)],
      [`Work function φ (${METALS[this.metal][0]})`, `${fmt(phi, 2)} eV`],
      ['K_max = hν − φ', Kmax > 0 ? `${fmt(Kmax, 2)} eV  →  stopping voltage ${fmt(Kmax, 2)} V` : 'below threshold — no electrons at any intensity', Kmax > 0 ? C.green : C.red],
      ['Electrons stopped?', Kmax > 0 ? (this.Vret >= Kmax ? 'yes — V ≥ K_max/e' : 'no — current flows') : '—'],
    ]);
  }
}

/* ------------------------------------------------- 35. a photon across the spectrum ---- */

const PH_BANDS: Array<[number, number, string, string]> = [
  [-13, -11, 'gamma', '#c879ff'], [-11, -8, 'X-ray', '#8aa4ff'], [-8, -6.42, 'UV', '#a88cff'], [-6.42, -6.11, 'visible', '#ffffff'], [-6.11, -3, 'infrared', '#ff9c6a'], [-3, -1, 'microwave', '#ffd27a'], [-1, 3, 'radio', '#9ad0a0'],
];
const PHENOMENA: Array<[number, string, string]> = [
  [5.9e-6, '21 cm line', 'hydrogen hyperfine flip'], [1e-3, 'molecules rotate', 'CO lines in cold clouds'], [0.1, 'molecules vibrate', 'H₂O, CO₂ bands'], [1.8, 'red light', 'Hα; outer electrons'], [3.1, 'violet light', 'Ca H & K'], [13.6, 'ionise hydrogen', 'Lyman limit, 91.2 nm'], [1000, 'inner-shell electrons', 'X-ray lines of iron'], [511e3, 'mₑc²', 'annihilation line'], [1.022e6, 'pair creation', 'γ → e⁺e⁻'], [1e8, 'nuclear reactions', 'γ-ray lines, pion decay'],
];

class PhotonScaleWidget extends CanvasWidget {
  private lg = -6.3; private sl!: { set: (v: number) => void };
  constructor() {
    super(480 / 230);
    this.sl = this.slider('Wavelength  log₁₀(λ / m)', -13, 3, 0.01, this.lg, (v) => fmtLambda(10 ** v), (v) => { this.lg = v; });
    let down = false; const setX = (x: number) => { this.lg = Math.max(-13, Math.min(3, -13 + (x - 16) / (this.w - 32) * 16)); this.sl.set(this.lg); };
    this.canvas.addEventListener('pointerdown', (e) => { down = true; this.canvas.setPointerCapture(e.pointerId); setX(canvasPos(this.canvas, e, this.w, this.h).x); });
    this.canvas.addEventListener('pointermove', (e) => { if (down) setX(canvasPos(this.canvas, e, this.w, this.h).x); });
    this.canvas.addEventListener('pointerup', () => { down = false; });
    this.canvas.style.touchAction = 'none'; this.canvas.style.cursor = 'ew-resize';
  }
  protected draw() {
    const c = this.ctx; c.fillStyle = C.bg; c.fillRect(0, 0, this.w, this.h);
    const X = (lg: number) => 16 + (lg + 13) / 16 * (this.w - 32);
    const lam = 10 ** this.lg, nu = C_LIGHT / lam, E = H_PLANCK * nu / EV, pmom = H_PLANCK / lam, T = H_PLANCK * nu / K_B;
    const yB = 26, hB = 26;
    for (const [a, b, name, col] of PH_BANDS) { c.fillStyle = hexA(col, 0.22); c.fillRect(X(a), yB, X(b) - X(a), hB); c.strokeStyle = hexA(col, 0.5); c.strokeRect(X(a), yB, X(b) - X(a), hB); if (X(b) - X(a) > 26) this.text(name, (X(a) + X(b)) / 2, yB + hB / 2, hexA(col, 0.95), 8, 'center'); }
    rainbow(c, (nm) => X(Math.log10(nm * 1e-9)), yB, hB, 0.9);
    for (let lg = -13; lg <= 3; lg += 2) this.text(`10${lg < 0 ? '⁻' : ''}${String(Math.abs(lg)).split('').map((d) => SUP[+d]).join('')} m`, X(lg), yB + hB + 10, C.dim, 7, 'center', 'mono');
    const xm = X(this.lg); this.line(xm, yB - 8, xm, this.h * 0.66, C.sun, 1.5); this.glow(xm, yB - 8, 8, hexA(C.sun, 0.9));
    const XE = (eV: number) => X(Math.log10(H_PLANCK * C_LIGHT / (eV * EV)));
    const yP = yB + hB + 42;
    this.line(16, yP, this.w - 16, yP, C.grid); this.text('photon energy', 16, yP - 20, C.dim, 8);
    ([[1e-6, '1 µeV'], [1e-3, '1 meV'], [1, '1 eV'], [1e3, '1 keV'], [1e6, '1 MeV'], [1e9, '1 GeV']] as Array<[number, string]>).forEach(([e, lab]) => { const x = XE(e); if (x < 26 || x > this.w - 26) return; this.line(x, yP - 3, x, yP + 3, C.line); this.text(lab, x, yP - 9, C.dim, 7, 'center', 'mono'); });
    let nearest = -1, bestD = 0.5;
    PHENOMENA.forEach(([e], i) => { const d = Math.abs(Math.log10(e / E)); if (d < bestD) { bestD = d; nearest = i; } });
    PHENOMENA.forEach(([e, label, what], i) => { const x = XE(e); if (x < 30 || x > this.w - 30) return; const near = i === nearest; const y = yP + 14 + (i % 3) * 12; this.line(x, yP, x, y - 5, near ? C.sun : C.faint); this.text(label, x, y, near ? C.sun : C.dim, near ? 9 : 7, 'center'); if (near) this.text(what, Math.max(60, Math.min(this.w - 60, x)), yP + 58, C.sun, 8, 'center'); });
    const band = PH_BANDS.find(([a, b]) => this.lg >= a && this.lg < b) ?? PH_BANDS[PH_BANDS.length - 1];
    const yW = this.h * 0.72; const per = 4 + (this.lg + 13) / 16 * 90;
    c.beginPath(); for (let x = 16; x <= this.w - 16; x += 1) { const y = yW + 9 * Math.sin((x - 16) / per * TAU); x === 16 ? c.moveTo(x, y) : c.lineTo(x, y); } c.strokeStyle = hexA(band[3], 0.8); c.lineWidth = 1.5; c.stroke();
    const does = E < 1e-5 ? 'flips nuclear spins; passes through almost everything' : E < 1e-2 ? 'sets molecules rotating; absorbed by water vapour' : E < 0.5 ? 'sets molecules vibrating; warms dust' : E < 3.3 ? 'excites the outer electrons of atoms — colour, chemistry, spectral lines' : E < 13.6 ? 'breaks molecular bonds; excites and ionises the lighter atoms' : E < 1000 ? 'ionises hydrogen and helium; absorbed by interstellar gas' : E < 1e5 ? 'knocks out inner-shell electrons; passes through flesh, not bone' : E < 2e6 ? 'Compton-scatters off electrons; above 1.022 MeV can create e⁺e⁻ pairs' : 'probes nuclei; made in supernovae, jets and cosmic-ray collisions';
    this.text(`${band[2]} photon`, this.w / 2, this.h - 30, hexA(band[3], 1), 11, 'center', 'serif');
    this.text(does, this.w / 2, this.h - 15, C.text, 9, 'center');
    this.setReadout([
      ['Wavelength λ', fmtLambda(lam), C.sun], ['Frequency ν = c/λ', fmtFreq(nu)], ['Energy E = hν', fmtEnergy(E), C.accent],
      ['Momentum p = h/λ', `${sci(pmom, 2)} kg·m/s`], ['Temperature with kT = hν', fmtTemp(T)], ['Photons per second in 1 W', sci(1 / (E * EV), 2)],
    ]);
  }
}

/* ------------------------------------------------- 36. Compton scattering ---- */

class ComptonWidget extends CanvasWidget {
  private theta = 60 * DEG; private lgLam = -2; private t = 0; private dragging = false;
  constructor() {
    super(480 / 300);
    this.playButton();
    this.slider('Incoming wavelength λᵢ  (log₁₀ nm)', -3.5, 1, 0.01, -2, (v) => `${sci(10 ** v, 2)} nm`, (v) => { this.lgLam = v; });
    const setA = (p: { x: number; y: number }) => { const { cx, cy } = this.geom(); this.theta = Math.atan2(-(p.y - cy), p.x - cx); };
    this.canvas.addEventListener('pointerdown', (e) => { this.dragging = true; this.canvas.setPointerCapture(e.pointerId); setA(canvasPos(this.canvas, e, this.w, this.h)); });
    this.canvas.addEventListener('pointermove', (e) => { if (this.dragging) setA(canvasPos(this.canvas, e, this.w, this.h)); });
    this.canvas.addEventListener('pointerup', () => { this.dragging = false; });
    this.canvas.style.touchAction = 'none'; this.canvas.style.cursor = 'crosshair';
    this.controls.appendChild($('div', 'lw-caption', 'Drag anywhere to set the direction of the scattered photon.'));
  }
  private geom() { return { cx: this.w * 0.5, cy: this.h * 0.47, R: Math.min(this.w, this.h) * 0.36 }; }
  protected draw(dt: number) {
    this.t = (this.t + dt * 0.5) % 1;
    const c = this.ctx; c.fillStyle = C.bg; c.fillRect(0, 0, this.w, this.h);
    const { cx, cy, R } = this.geom();
    const lamI = 10 ** this.lgLam * 1e-9, lamC = H_PLANCK / (M_E * C_LIGHT);
    const th = Math.abs(this.theta), dl = lamC * (1 - Math.cos(th)), lamF = lamI + dl;
    const Ei = H_PLANCK * C_LIGHT / lamI / EV, Ef = H_PLANCK * C_LIGHT / lamF / EV, Ke = Ei - Ef, mc2 = M_E * C_LIGHT * C_LIGHT / EV;
    const phi = th < 1e-6 ? Math.PI / 2 : Math.atan(1 / ((1 + Ei / mc2) * Math.tan(th / 2)));
    const sgn = this.theta >= 0 ? 1 : -1;
    this.circle(cx, cy, R, C.grid, undefined, 1, [3, 5]); this.line(cx - R - 10, cy, cx + R + 10, cy, C.grid);
    c.beginPath(); c.arc(cx, cy, 26, 0, -sgn * th, sgn > 0); c.strokeStyle = C.accent; c.lineWidth = 1; c.stroke();
    this.text(`θ = ${fmt(th / DEG, 0)}°`, cx + 38 * Math.cos(-sgn * th / 2), cy + 38 * Math.sin(-sgn * th / 2), C.accent, 9, 'center');
    const inX0 = cx - R - 10;
    const outDir = { x: Math.cos(th), y: -sgn * Math.sin(th) }, eDir = { x: Math.cos(phi), y: sgn * Math.sin(phi) };
    this.line(inX0, cy, cx, cy, hexA(C.purple, 0.45)); this.line(cx, cy, cx + outDir.x * R, cy + outDir.y * R, hexA(C.red, 0.45)); this.line(cx, cy, cx + eDir.x * R * 0.8, cy + eDir.y * R * 0.8, hexA(C.blue, 0.45), 1, [4, 3]);
    const lamPxI = 10, lamPxF = Math.min(40, 10 * (lamF / lamI));
    if (this.t < 0.5) { const f = this.t / 0.5; const hx = inX0 + (cx - inX0) * f; wavySegment(c, Math.max(inX0, hx - 60), cy, hx, cy, lamPxI, 5, C.purple); this.glow(hx, cy, 8, hexA(C.purple, 0.9)); }
    else { const f = (this.t - 0.5) / 0.5, d = R * f; const hx = cx + outDir.x * d, hy = cy + outDir.y * d; const d0 = Math.max(0, d - 60); wavySegment(c, cx + outDir.x * d0, cy + outDir.y * d0, hx, hy, lamPxF, 5, C.red); this.glow(hx, hy, 8, hexA(C.red, 0.9)); const ve = Math.min(1, Math.sqrt(Ke / Math.max(Ei, 1e-30)) * 1.2); const ex = cx + eDir.x * R * 0.8 * f * ve, ey = cy + eDir.y * R * 0.8 * f * ve; this.glow(ex, ey, 7, hexA(C.blue, 0.9)); this.circle(ex, ey, 3, undefined, '#fff'); }
    this.circle(cx, cy, 5, C.blue, this.t < 0.5 ? C.blue : undefined); this.text('e⁻ at rest', cx, cy + 16, C.blue, 8, 'center');
    this.text(`incoming  λᵢ = ${sci(lamI * 1e9, 3)} nm`, inX0, cy - 14, C.purple, 9);
    this.text(`scattered  λ_f = ${sci(lamF * 1e9, 3)} nm`, cx + outDir.x * (R + 6), cy + outDir.y * (R + 6) - 10, C.red, 9, outDir.x < 0 ? 'right' : 'left');
    this.text(`recoil electron  φ = ${fmt(phi / DEG, 0)}°`, cx + eDir.x * (R * 0.8 + 6), cy + eDir.y * (R * 0.8 + 6) + 10, C.blue, 9, eDir.x < 0 ? 'right' : 'left');
    this.setReadout([
      ['Δλ = (h/mₑc)(1 − cos θ)', `${fmt(dl * 1e12, 3)} pm`, C.accent],
      ['Compton wavelength h/mₑc', `${fmt(lamC * 1e12, 3)} pm`],
      ['Photon energy  before → after', `${fmtEnergy(Ei)} → ${fmtEnergy(Ef)}`],
      ['Energy given to the electron', `${fmtEnergy(Ke)}  (${fmt(Ke / Ei * 100, 1)} %)`, C.blue],
      ['Fractional shift Δλ/λᵢ', sci(dl / lamI, 2)],
    ]);
  }
}

/* ------------------------------------------------- 37. Rutherford scattering ---- */

class RutherfordWidget extends CanvasWidget {
  private model: 'thomson' | 'rutherford' = 'rutherford'; private K = 5;
  private parts: Array<{ x: number; y: number; vx: number; vy: number; trail: number[]; done: boolean; age: number }> = [];
  private hist = new Array(18).fill(0) as number[]; private total = 0; private back = 0;
  private static readonly BMAX = 10; private static readonly XR = 14; private static readonly RTH = 12;
  constructor() {
    super(480 / 300);
    this.segmented<'thomson' | 'rutherford'>([['thomson', 'Thomson\'s pudding'], ['rutherford', 'Rutherford\'s nucleus']], 'rutherford', (m) => { this.model = m; this.reset(); });
    this.slider('α-particle energy', 1, 10, 0.5, 5, (v) => `${fmt(v, 1)} MeV`, (v) => { this.K = v; this.reset(); });
    const b = $('button', 'lw-btn', '⟶ fire 20'); b.addEventListener('click', () => this.fire(20)); this.controls.appendChild(b);
    const b2 = $('button', 'lw-btn', '↺ reset'); b2.addEventListener('click', () => this.reset()); this.controls.appendChild(b2);
  }
  private reset() { this.parts = []; this.hist.fill(0); this.total = 0; this.back = 0; }
  private fire(n: number) { for (let i = 0; i < n; i++) { const b = (Math.random() * 2 - 1) * RutherfordWidget.BMAX; this.parts.push({ x: -RutherfordWidget.XR, y: b, vx: 1, vy: 0, trail: [], done: false, age: 0 }); } }
  protected draw(dt: number) {
    const c = this.ctx; c.fillStyle = C.bg; c.fillRect(0, 0, this.w, this.h);
    const { BMAX, XR, RTH } = RutherfordWidget;
    if (this.parts.filter((p) => !p.done).length < 5 && this.total < 2000 && dt > 0) this.fire(1);
    const d = 5 / this.K;                       // closest approach for a head-on hit, in units of the 5 MeV value (45.5 fm for gold)
    const sub = 8, h = dt * 1.4 / sub;
    for (const p of this.parts) {
      if (p.done) { p.age += dt; continue; }
      for (let s = 0; s < sub; s++) {
        const r2 = p.x * p.x + p.y * p.y, r = Math.sqrt(r2);
        const acc = this.model === 'rutherford' || r > RTH ? d / 2 / r2 : (d / 2) * r / (RTH ** 3);
        p.vx += acc * p.x / r * h; p.vy += acc * p.y / r * h; p.x += p.vx * h; p.y += p.vy * h;
      }
      p.trail.push(p.x, p.y); if (p.trail.length > 600) p.trail.splice(0, 2);
      if (Math.hypot(p.x, p.y) > XR * 1.05 && p.x * p.vx + p.y * p.vy > 0) { p.done = true; const deg = Math.abs(Math.atan2(p.vy, p.vx)) / DEG; this.hist[Math.min(17, Math.floor(deg / 10))]++; this.total++; if (deg > 90) this.back++; }
    }
    this.parts = this.parts.filter((p) => p.age < 1.2);
    const S = (this.w * 0.58 - 16) / (2 * XR), cx = this.w * 0.3, cy = this.h / 2;
    const PX = (x: number) => cx + x * S, PY = (y: number) => cy + y * S;
    c.save(); c.beginPath(); c.rect(cx - XR * S, cy - XR * S, 2 * XR * S, 2 * XR * S); c.clip();
    if (this.model === 'thomson') { const g = c.createRadialGradient(cx, cy, 0, cx, cy, RTH * S); g.addColorStop(0, 'rgba(212,106,90,0.35)'); g.addColorStop(1, 'rgba(212,106,90,0.03)'); c.fillStyle = g; c.beginPath(); c.arc(cx, cy, RTH * S, 0, TAU); c.fill(); for (let i = 0; i < 12; i++) { const a = i * 2.4, rr = RTH * S * (0.3 + 0.6 * ((i * 0.37) % 1)); this.circle(cx + rr * Math.cos(a), cy + rr * Math.sin(a), 2, undefined, C.blue); } this.text('positive charge spread over the whole atom', cx, cy + RTH * S - 10, C.red, 8, 'center'); }
    else { this.glow(cx, cy, 10, 'rgba(212,106,90,0.9)'); this.circle(cx, cy, 2.5, undefined, '#fff'); this.text('nucleus', cx + 8, cy - 8, C.red, 8); }
    for (const p of this.parts) { if (p.trail.length < 4) continue; c.beginPath(); c.moveTo(PX(p.trail[0]), PY(p.trail[1])); for (let i = 2; i < p.trail.length; i += 2) c.lineTo(PX(p.trail[i]), PY(p.trail[i + 1])); c.strokeStyle = hexA(C.sun, p.done ? 0.5 * (1 - p.age / 1.2) : 0.7); c.lineWidth = 1; c.stroke(); if (!p.done) { this.glow(PX(p.x), PY(p.y), 5, 'rgba(242,196,90,0.9)'); } }
    c.restore();
    c.strokeStyle = C.grid; c.strokeRect(cx - XR * S, cy - XR * S, 2 * XR * S, 2 * XR * S);
    this.text('α source →', cx - XR * S + 4, cy - XR * S + 10, C.dim, 8);
    const gx0 = this.w * 0.64, gx1 = this.w - 10, gy0 = 24, gy1 = this.h - 36; const bw = (gx1 - gx0) / 18;
    const maxC = Math.max(1, ...this.hist); const HY = (n: number) => gy1 - Math.log10(1 + n) / Math.log10(1 + maxC) * (gy1 - gy0);
    this.hist.forEach((n, i) => { c.fillStyle = i >= 9 ? hexA(C.red, 0.8) : hexA(C.sun, 0.7); c.fillRect(gx0 + i * bw + 1, HY(n), bw - 2, gy1 - HY(n)); });
    if (this.model === 'rutherford' && this.total > 0) { const bOf = (deg: number) => (d / 2) / Math.tan(deg * DEG / 2); c.beginPath(); for (let i = 0; i < 18; i++) { const lo = i * 10, hi = lo + 10; const pred = this.total * (Math.min(BMAX, bOf(Math.max(lo, 0.5))) - Math.min(BMAX, bOf(hi))) / BMAX; const x = gx0 + (i + 0.5) * bw; i ? c.lineTo(x, HY(pred)) : c.moveTo(x, HY(pred)); } c.strokeStyle = C.green; c.lineWidth = 1.5; c.stroke(); this.text('— Rutherford formula ∝ 1/sin⁴(θ/2)', gx0, gy0 - 10, C.green, 7); }
    this.line(gx0, gy1, gx1, gy1, C.line);
    for (const deg of [0, 90, 180]) this.text(`${deg}°`, gx0 + deg / 10 * bw, gy1 + 9, C.dim, 7, 'center', 'mono');
    this.text('scattering angle  (log count)', gx0, gy1 + 20, C.dim, 8);
    this.setReadout([
      ['α particles counted', `${this.total}`, C.sun],
      ['Scattered by more than 90°', `${this.back}  (${this.total ? fmt(this.back / this.total * 100, 1) : '0'} %)`, this.back ? C.red : C.dim],
      ['Closest approach (head-on, gold)', `${fmt(45.5 * d, 1)} fm = 2kZe²/K`],
      ['Beam width here', `±${BMAX} × closest approach (a real foil: ~10⁵ ×)`],
    ]);
  }
}

/* ------------------------------------------------- 38. hydrogen series ---- */

const SERIES: Array<[string, number, string, string]> = [['Lyman', 1, C.purple, 'Ly'], ['Balmer', 2, C.blue, 'H'], ['Paschen', 3, C.red, 'Pa'], ['Brackett', 4, C.accent, 'Br'], ['Pfund', 5, C.green, 'Pf']];
const GREEK_LINE = ['α', 'β', 'γ', 'δ', 'ε', 'ζ', 'η'];
const hLine = (m: number, n: number) => 1 / (R_H * (1 / (m * m) - 1 / (n * n))) * 1e9;   // nm

class SeriesWidget extends CanvasWidget {
  private sel: { m: number; n: number } | null = { m: 2, n: 3 };
  constructor() {
    super(480 / 280);
    this.canvas.addEventListener('pointerdown', (e) => { const { x, y } = canvasPos(this.canvas, e, this.w, this.h); this.pick(x, y); });
    this.canvas.style.cursor = 'pointer';
    this.controls.appendChild($('div', 'lw-caption', 'Click a line to see its transition.'));
  }
  private X(nm: number) { return 14 + (Math.log10(nm) - Math.log10(80)) / (Math.log10(8000) - Math.log10(80)) * (this.w * 0.7 - 20); }
  private rowY(i: number) { return 36 + i * ((this.h - 66) / SERIES.length); }
  private pick(x: number, y: number) {
    let best: { m: number; n: number; d: number } | null = null;
    for (let i = 0; i < SERIES.length; i++) { const m = SERIES[i][1]; const yc = this.rowY(i) + 14; if (Math.abs(y - yc) > 18) continue; for (let n = m + 1; n < m + 40; n++) { const d = Math.abs(this.X(hLine(m, n)) - x); if (d < 7 && (best === null || d < best.d)) best = { m, n, d }; } }
    if (best !== null) this.sel = { m: best.m, n: best.n };
  }
  protected draw() {
    const c = this.ctx; c.fillStyle = C.bg; c.fillRect(0, 0, this.w, this.h);
    const X = (nm: number) => this.X(nm);
    c.fillStyle = 'rgba(255,255,255,0.04)'; c.fillRect(X(380), 18, X(780) - X(380), this.h - 46);
    c.save(); c.beginPath(); c.rect(X(380), this.h - 28, X(780) - X(380), 6); c.clip(); rainbow(c, X, this.h - 28, 6, 0.7); c.restore();
    this.text('visible', (X(380) + X(780)) / 2, 11, C.dim, 8, 'center');
    for (const nm of [100, 200, 500, 1000, 2000, 5000]) { this.text(nm >= 1000 ? `${nm / 1000} µm` : `${nm} nm`, X(nm), this.h - 12, C.dim, 7, 'center', 'mono'); this.line(X(nm), this.h - 22, X(nm), this.h - 18, C.line); }
    for (let i = 0; i < SERIES.length; i++) {
      const [name, m, col, ab] = SERIES[i]; const y = this.rowY(i);
      this.text(`${name}  (m = ${m})`, 14, y, hexA(col, 0.9), 9);
      const lim = hLine(m, 1e6); this.line(X(lim), y + 6, X(lim), y + 24, hexA(col, 0.4), 1, [2, 2]); this.text('limit', X(lim), y + 30, hexA(col, 0.6), 6, 'center');
      for (let n = m + 1; n < m + 40; n++) { const l = hLine(m, n), x = X(l); const isSel = !!this.sel && this.sel.m === m && this.sel.n === n; const colL = l >= 380 && l <= 780 ? rgba(lineRGB(l)) : hexA(col, 0.85); c.fillStyle = isSel ? '#fff' : colL; c.fillRect(x - (isSel ? 1.5 : 0.75), y + 6, isSel ? 3 : 1.5, 18); if (n - m <= 3) this.text(`${ab}${GREEK_LINE[n - m - 1]}`, x, y + 32, isSel ? '#fff' : C.faint, 7, 'center', 'serif'); }
    }
    const lx0 = this.w * 0.76, lx1 = this.w - 10, ly0 = 24, ly1 = this.h - 44;
    const YE = (n: number) => ly0 + (ly1 - ly0) / (n * n);
    for (let n = 1; n <= 8; n++) { const y = YE(n); this.line(lx0, y, lx1, y, n <= 5 ? C.line : C.grid); if (n <= 4) this.text(`n=${n}`, lx0 - 3, y, C.dim, 7, 'right'); }
    this.line(lx0, ly0, lx1, ly0, C.faint, 1, [2, 3]); this.text('0 eV (ionised)', lx1, ly0 - 8, C.faint, 7, 'right'); this.text('−13.6 eV', lx1, ly1 + 9, C.faint, 7, 'right');
    if (this.sel) { const { m, n } = this.sel; const col = SERIES[m - 1][2]; const xa = (lx0 + lx1) / 2, y1 = YE(n), y2 = YE(m); this.line(xa, y1, xa, y2, col, 2); c.beginPath(); c.moveTo(xa, y2); c.lineTo(xa - 4, y2 - 7); c.lineTo(xa + 4, y2 - 7); c.closePath(); c.fillStyle = col; c.fill(); this.text(`${n} → ${m}`, xa + 8, (y1 + y2) / 2, col, 9, 'left', 'serif'); }
    const s = this.sel; const l = s ? hLine(s.m, s.n) : 0;
    this.setReadout(s ? [
      ['Transition', `n = ${s.n}  →  m = ${s.m}   (${SERIES[s.m - 1][0]} ${s.n - s.m <= 7 ? GREEK_LINE[s.n - s.m - 1] : s.n - s.m})`, SERIES[s.m - 1][2]],
      ['Wavelength  1/λ = R_H(1/m² − 1/n²)', l >= 1000 ? `${fmt(l / 1000, 3)} µm` : `${fmt(l, 1)} nm`],
      ['Photon energy  13.6 eV (1/m² − 1/n²)', `${fmt(13.6 * (1 / (s.m * s.m) - 1 / (s.n * s.n)), 3)} eV`, C.accent],
      ['Region', l < 380 ? 'ultraviolet' : l <= 780 ? 'visible' : 'infrared'],
    ] : [['Transition', 'click a line']]);
  }
}

/* ------------------------------------------------- 39. Bohr's atom ---- */

class BohrWidget extends CanvasWidget {
  private n = 1; private target = 1; private from = 1; private anim = 1; private ang = 0;
  private photon: { from: number; to: number; t: number; nm: number } | null = null;
  private lastJump: { from: number; to: number; nm: number } | null = null;
  private emitted: number[] = [];
  private static readonly NMAX = 5;
  constructor() {
    super(480 / 330);
    const b = $('button', 'lw-btn', 'clear spectrum'); b.addEventListener('click', () => { this.emitted = []; }); this.controls.appendChild(b);
    this.canvas.addEventListener('pointerdown', (e) => { const { x, y } = canvasPos(this.canvas, e, this.w, this.h); const k = this.hit(x, y); if (k && k !== this.n && this.anim >= 1) this.jump(k); });
    this.canvas.style.cursor = 'pointer';
    this.controls.appendChild($('div', 'lw-caption', 'Click an orbit or a rung of the energy ladder to make the electron jump.'));
  }
  private geom() { const cx = this.w * 0.29, cy = this.h * 0.4; const unit = Math.min(cx - 16, cy - 16) / (BohrWidget.NMAX ** 2); return { cx, cy, unit, lx0: this.w * 0.64, lx1: this.w - 14, ly0: 22, ly1: this.h * 0.7 }; }
  private YE(n: number) { const { ly0, ly1 } = this.geom(); return ly0 + (ly1 - ly0) / (n * n); }
  private hit(x: number, y: number): number | null {
    const g = this.geom(); let best = 0;
    if (x > g.lx0 - 24) { let bd = 12; for (let n = 1; n <= BohrWidget.NMAX; n++) { const d = Math.abs(this.YE(n) - y); if (d < bd) { bd = d; best = n; } } return best || null; }
    const r = Math.hypot(x - g.cx, y - g.cy); let bd = 10; for (let n = 1; n <= BohrWidget.NMAX; n++) { const d = Math.abs(n * n * g.unit - r); if (d < bd) { bd = d; best = n; } } return best || null;
  }
  private jump(k: number) { this.from = this.n; this.target = k; this.anim = 0; const nm = hLine(Math.min(k, this.from), Math.max(k, this.from)); this.photon = { from: this.from, to: k, t: 0, nm }; this.lastJump = { from: this.from, to: k, nm }; if (k < this.from) this.emitted.push(nm); }
  protected draw(dt: number) {
    const c = this.ctx; c.fillStyle = C.bg; c.fillRect(0, 0, this.w, this.h);
    const g = this.geom();
    if (this.anim < 1) { this.anim = Math.min(1, this.anim + dt * 1.6); if (this.anim >= 1) this.n = this.target; }
    const nEff = this.anim < 1 ? this.from + (this.target - this.from) * (0.5 - 0.5 * Math.cos(this.anim * Math.PI)) : this.n;
    this.ang += dt * 2.4 / (nEff ** 3);
    for (let n = 1; n <= BohrWidget.NMAX; n++) { const r = n * n * g.unit; this.circle(g.cx, g.cy, r, n === this.n ? hexA(C.accent, 0.9) : C.line, undefined, n === this.n ? 1.5 : 1); this.text(`${n}`, g.cx + r + 4, g.cy - 6, C.dim, 8); }
    this.circle(g.cx, g.cy, 4, undefined, C.red); this.text('p⁺', g.cx, g.cy + 12, C.red, 8, 'center');
    const re = nEff * nEff * g.unit, ex = g.cx + re * Math.cos(this.ang), ey = g.cy + re * Math.sin(this.ang);
    this.glow(ex, ey, 10, hexA(C.blue, 0.9)); this.circle(ex, ey, 3.5, undefined, '#fff');
    if (this.photon) {
      const ph = this.photon; ph.t += dt * 1.1; const emit = ph.to < ph.from; const col = rgba(lineRGB(ph.nm));
      const dir = { x: -0.94, y: -0.34 }, maxD = g.cx - 12; const d = (emit ? ph.t : 1 - ph.t) * maxD;
      const tipX = g.cx + dir.x * d, tipY = g.cy + dir.y * d, d0 = Math.max(0, d - 46);
      if (ph.t <= 1) { wavySegment(c, g.cx + dir.x * d0, g.cy + dir.y * d0, tipX, tipY, Math.max(4, Math.min(16, ph.nm / 60)), 4, col); this.glow(tipX, tipY, 7, col); this.text(`${emit ? 'emitted' : 'absorbed'}  ${fmt(ph.nm, 1)} nm`, g.cx - 10, 14, col, 9, 'left'); }
      else this.photon = null;
    }
    for (let n = 1; n <= BohrWidget.NMAX; n++) { const y = this.YE(n); this.line(g.lx0, y, g.lx1, y, n === this.n ? C.accent : C.line, n === this.n ? 2 : 1); this.text(`n = ${n}`, g.lx0 - 4, y, C.dim, 8, 'right'); if (n <= 3) this.text(`${fmt(-13.6 / (n * n), 2)} eV`, g.lx1, y - 7, n === this.n ? C.accent : C.faint, 7, 'right', 'mono'); else if (n === this.n) this.text(`${fmt(-13.6 / (n * n), 2)} eV`, g.lx1, y + 7, C.accent, 7, 'right', 'mono'); }
    this.line(g.lx0, g.ly0, g.lx1, g.ly0, C.faint, 1, [2, 3]); this.text('0 eV — ionised', g.lx0 + 4, g.ly0 - 8, C.faint, 7, 'left');
    const xl = (g.lx0 + g.lx1) / 2 - 20; this.glow(xl, this.YE(nEff), 8, hexA(C.blue, 0.9)); this.circle(xl, this.YE(nEff), 3, undefined, '#fff');
    if (this.photon) { const ph = this.photon; const xa = xl + 36; const col = SERIES[Math.min(ph.from, ph.to) - 1][2]; this.line(xa, this.YE(ph.from), xa, this.YE(ph.to), col, 2); const yh = this.YE(ph.to), up = ph.to > ph.from ? -1 : 1; c.beginPath(); c.moveTo(xa, yh); c.lineTo(xa - 4, yh - 7 * up); c.lineTo(xa + 4, yh - 7 * up); c.closePath(); c.fillStyle = col; c.fill(); }
    const yS = this.h * 0.8, hS = this.h * 0.11; const X = (nm: number) => 14 + (Math.log10(nm) - Math.log10(90)) / (Math.log10(2000) - Math.log10(90)) * (this.w - 28);
    c.fillStyle = '#05070a'; c.fillRect(14, yS, this.w - 28, hS);
    c.save(); c.beginPath(); c.rect(14, yS, this.w - 28, hS); c.clip(); rainbow(c, X, yS, hS, 0.16); c.restore();
    for (const nm of this.emitted) { c.fillStyle = rgba(lineRGB(nm)); c.fillRect(X(nm) - 1, yS, 2, hS); }
    for (const nm of [100, 200, 400, 700, 1000, 2000]) this.text(`${nm}`, X(nm), yS + hS + 8, C.dim, 7, 'center', 'mono');
    this.text('UV', X(135), yS - 7, C.faint, 7, 'center'); this.text('visible', X(540), yS - 7, C.faint, 7, 'center'); this.text('IR', X(1400), yS - 7, C.faint, 7, 'center');
    this.text('emitted photons (nm)', 14, yS - 7, C.dim, 8);
    const L = this.lastJump;
    this.setReadout([
      ['Electron level', `n = ${this.n}   E = ${fmt(-13.6 / (this.n * this.n), 2)} eV   r = ${this.n * this.n} a₀ = ${fmt(0.0529 * this.n * this.n, 3)} nm`, C.accent],
      ['Orbital speed  v = αc / n', `${fmt(2188 / this.n, 0)} km/s  =  c / ${fmt(137.036 * this.n, 0)}`],
      ['Last jump', L ? `${L.from} → ${L.to}:  ${L.to < L.from ? 'emitted' : 'absorbed'} ${fmt(L.nm, 1)} nm  (${SERIES[Math.min(L.from, L.to) - 1][0]} ${GREEK_LINE[Math.abs(L.from - L.to) - 1] ?? ''})` : 'click a level'],
    ]);
  }
}

/* ------------------------------------------------- 40. hydrogen-like ions ---- */

const HYDROGENIC: Array<[string, number, number, string]> = [['H', 1, 1836.15, 'hydrogen'], ['D', 1, 3670.48, 'deuterium'], ['He⁺', 2, 7294.3, 'ionised helium'], ['Li²⁺', 3, 12786, 'doubly ionised lithium'], ['Ps', 1, 1, 'positronium (e⁺e⁻)']];

class HydrogenicWidget extends CanvasWidget {
  private i = 2; private t = 0;
  constructor() { super(480 / 230); this.segmented<string>(HYDROGENIC.map(([s]) => [s, s] as [string, string]), 'He⁺', (s) => { this.i = HYDROGENIC.findIndex(([x]) => x === s); }); }
  protected draw(dt: number) {
    this.t += dt;
    const c = this.ctx; c.fillStyle = C.bg; c.fillRect(0, 0, this.w, this.h);
    const [sym, Z, Mratio, name] = HYDROGENIC[this.i];
    const muH = 1836.15 / (1 + 1836.15), mu = Mratio / (1 + Mratio);
    const RyH = 13.605693 * muH, E1 = 13.605693 * mu * Z * Z;
    const En = (n: number) => -E1 / (n * n), EnH = (n: number) => -RyH / (n * n);
    const lam = (m: number, n: number, E: (k: number) => number) => EV_NM / (E(n) - E(m));
    const ly0 = 22, ly1 = this.h * 0.74, Emin = -Math.max(E1, RyH) * 1.05;
    const YE = (E: number) => ly0 + (E / Emin) * (ly1 - ly0);
    const ladders: Array<[number, number, string, (n: number) => number, string]> = [[16, this.w * 0.25, 'H (reference)', EnH, C.dim], [this.w * 0.31, this.w * 0.56, `${sym}   Z = ${Z}`, En, C.accent]];
    for (const [x0, x1, label, E, col] of ladders) {
      this.text(label, (x0 + x1) / 2, ly0 - 11, col, 9, 'center');
      for (let n = 1; n <= 8; n++) { const y = YE(E(n)); this.line(x0, y, x1, y, col, n === 1 ? 2 : 1); if (n <= 2) this.text(`n=${n}   ${fmt(E(n), 1)} eV`, x1 - 2, y - 7, col, 7, 'right', 'mono'); }
      this.line(x0, YE(0), x1, YE(0), C.faint, 1, [2, 3]);
      const xa = (x0 + x1) / 2; this.line(xa, YE(E(2)), xa, YE(E(1)), hexA(col, 0.8), 1.5); this.text('Lyα', xa + 4, (YE(E(2)) + YE(E(1))) / 2, col, 7);
    }
    this.text('0 eV', 16, YE(0) - 7, C.faint, 7);
    const ox = this.w * 0.79, oy = this.h * 0.4, S = Math.min(this.w * 0.18, this.h * 0.32) / 9;
    for (let n = 1; n <= 3; n++) { this.circle(ox, oy, n * n * S, C.grid, undefined, 1, [2, 3]); this.circle(ox, oy, n * n * S / Z * (muH / mu), hexA(C.accent, 0.8)); }
    this.circle(ox, oy, 3, undefined, C.red); this.text(Z > 1 ? `${Z}p⁺` : 'p⁺', ox, oy + 11, C.red, 7, 'center');
    const ang = this.t * 1.5; const r1 = S / Z * (muH / mu); this.circle(ox + r1 * Math.cos(ang), oy + r1 * Math.sin(ang), 2.5, undefined, '#fff');
    this.text(`orbits: grey = H, gold = ${sym}`, ox, oy + 9 * S + 12, C.dim, 8, 'center');
    this.text('rₙ = a₀ n² / Z  ·  mₑ/μ', ox, oy + 9 * S + 24, C.accent, 8, 'center', 'serif');
    this.setReadout([
      [`${name}: ionisation 13.6 eV·Z²·μ/mₑ`, `${fmt(E1, 2)} eV  (H: ${fmt(RyH, 2)})`, C.accent],
      ['Reduced mass  μ/mₑ = M/(M + mₑ)', fmt(mu, 5)],
      ['Lyman α  (2 → 1)', `${fmt(lam(1, 2, En), 2)} nm   (H: ${fmt(lam(1, 2, EnH), 2)} nm)`],
      ['Balmer α  (3 → 2)', `${fmt(lam(2, 3, En), 2)} nm   (H: ${fmt(lam(2, 3, EnH), 2)} nm)`],
      ['Ground-state radius  a₀ (mₑ/μ) / Z', `${fmt(52.918 / mu / Z, 2)} pm`],
    ]);
  }
}

/* ------------------------------------------------- 41. de Broglie waves ---- */

const DB_PARTICLES: Array<[string, number, number, string]> = [
  ['electron, 100 eV', M_E, 5.93e6, 'λ ≈ atomic spacing: diffracts off crystals (Davisson–Germer 1927)'],
  ['proton, room temperature', 1.6726e-27, 2700, 'thermal particles: used to probe crystal structure'],
  ['C₆₀ molecule, 200 m/s', 1.2e-24, 200, 'diffracted through a grating in Vienna, 1999'],
  ['dust grain, 1 µm', 1e-15, 1e-3, 'λ far below nuclear size — behaves classically'],
  ['baseball, 40 m/s', 0.145, 40, 'λ ≈ 10⁻³⁴ m: no wave behaviour, ever'],
];

class MatterWaveWidget extends CanvasWidget {
  private n = 3; private t = 0; private part = 0;
  constructor() {
    super(480 / 300);
    this.playButton();
    this.slider('Wavelengths around the orbit  n = 2πr/λ', 1, 6, 0.02, 3, (v) => fmt(v, 2), (v) => { this.n = v; });
    this.segmented<string>(DB_PARTICLES.map(([l], i) => [String(i), l.split(',')[0]] as [string, string]), '0', (v) => { this.part = +v; });
  }
  protected draw(dt: number) {
    this.t += dt;
    const c = this.ctx; c.fillStyle = C.bg; c.fillRect(0, 0, this.w, this.h);
    const cx = this.w * 0.28, cy = this.h * 0.5, R = Math.min(this.w * 0.2, this.h * 0.34);
    const n = this.n, K = 10;
    let sre = 0, sim = 0; for (let k = 0; k < K; k++) { sre += Math.cos(TAU * n * k); sim += Math.sin(TAU * n * k); } const closure = Math.hypot(sre, sim) / K;
    this.circle(cx, cy, R, C.line, undefined, 1, [3, 4]); this.circle(cx, cy, 4, undefined, C.red);
    const near = Math.abs(n - Math.round(n)) < 0.03;
    if (closure < 0.95) { c.beginPath(); for (let i = 0; i <= 360; i++) { const phi = i * DEG; const r = R + Math.sin(n * phi - this.t * 3) * R * 0.28; i ? c.lineTo(cx + r * Math.cos(phi), cy + r * Math.sin(phi)) : c.moveTo(cx + r * Math.cos(phi), cy + r * Math.sin(phi)); } c.strokeStyle = hexA(C.red, 0.35); c.lineWidth = 1; c.setLineDash([2, 3]); c.stroke(); c.setLineDash([]); }
    c.beginPath();
    for (let i = 0; i <= 360; i++) { const phi = i * DEG; let s = 0; for (let k = 0; k < K; k++) s += Math.sin(n * (phi + TAU * k) - this.t * 3); s /= K; const r = R + s * R * 0.28; i ? c.lineTo(cx + r * Math.cos(phi), cy + r * Math.sin(phi)) : c.moveTo(cx + r * Math.cos(phi), cy + r * Math.sin(phi)); }
    c.strokeStyle = near ? C.green : hexA(C.blue, 0.5 + 0.5 * closure); c.lineWidth = 1.8; c.stroke();
    this.text(near ? `n = ${Math.round(n)}: the wave closes on itself — a standing wave` : `n = ${fmt(n, 2)}: each loop is out of step with the last — it cancels`, cx, cy + R * 1.3 + 8, near ? C.green : C.red, 9, 'center');
    this.text('2πr = nλ   ⇔   mvr = nħ', cx, 14, C.accent, 10, 'center', 'serif');
    const [label, m, v, note] = DB_PARTICLES[this.part]; const p = m * v, lam = H_PLANCK / p;
    const px0 = this.w * 0.56, py0 = 24;
    this.text(label, px0, py0, C.text, 10); this.text(`m = ${sci(m, 2)} kg,  v = ${sci(v, 2)} m/s`, px0, py0 + 14, C.dim, 8, 'left', 'mono');
    this.text(`λ = h / mv = ${sci(lam, 2)} m`, px0, py0 + 34, C.accent, 11, 'left', 'serif');
    const bx0 = px0, bx1 = this.w - 12, by = this.h * 0.56; const LX = (lg: number) => bx0 + (lg + 36) / 30 * (bx1 - bx0);
    this.line(bx0, by, bx1, by, C.line);
    for (const [lg, nm, row] of [[-35, 'Planck length', 0], [-15, 'proton', 0], [-10, 'atom', 0], [-7, 'light', 0], [-6, 'bacterium', 1]] as Array<[number, string, number]>) { const x = LX(lg); this.line(x, by - 4, x, by + 4 + row * 9, C.faint); this.text(nm, Math.min(x, bx1 - 14), by + 12 + row * 10, C.dim, 7, 'center'); }
    const lx = Math.max(bx0, Math.min(bx1, LX(Math.log10(lam)))); this.glow(lx, by, 9, hexA(C.accent, 0.9)); this.circle(lx, by, 3, undefined, '#fff'); this.text('λ', lx, by - 12, C.accent, 9, 'center', 'serif');
    this.text(note, px0, by + 34, C.text, 8);
    this.setReadout([
      ['Closure of the wave after 10 loops', `${fmt(closure * 100, 0)} %   ${near ? '— allowed orbit' : '— forbidden'}`, near ? C.green : C.red],
      ['de Broglie wavelength', `${sci(lam, 3)} m`, C.accent],
      ['Momentum p = mv', `${sci(p, 2)} kg·m/s`],
    ]);
  }
}

/* ------------------------------------------------- 42. hydrogen orbitals ---- */

const ORBITALS: Array<[string, number, number, (rho: number, ct: number, st: number) => number]> = [
  ['1s', 1, 0, (r) => Math.exp(-r)],
  ['2s', 2, 0, (r) => (2 - r) * Math.exp(-r / 2)],
  ['2p z', 2, 1, (r, ct) => r * Math.exp(-r / 2) * ct],
  ['2p x', 2, 1, (r, _ct, st) => r * Math.exp(-r / 2) * st],
  ['3s', 3, 0, (r) => (27 - 18 * r + 2 * r * r) * Math.exp(-r / 3)],
  ['3p z', 3, 1, (r, ct) => (6 - r) * r * Math.exp(-r / 3) * ct],
  ['3d z²', 3, 2, (r, ct) => r * r * Math.exp(-r / 3) * (3 * ct * ct - 1)],
  ['3d xz', 3, 2, (r, ct, st) => r * r * Math.exp(-r / 3) * st * ct],
  ['3d x²−y²', 3, 2, (r, _ct, st) => r * r * Math.exp(-r / 3) * st * st],
];

class OrbitalsWidget extends CanvasWidget {
  private sel = 0; private showBohr = true; private img: HTMLCanvasElement | null = null; private imgFor = -1; private max = 1;
  private probe: { x: number; y: number } | null = null;
  constructor() {
    super(480 / 300);
    this.segmented<string>(ORBITALS.map(([l], i) => [String(i), l] as [string, string]), '0', (v) => { this.sel = +v; });
    this.segmented<'on' | 'off'>([['on', 'Bohr orbit shown'], ['off', 'hidden']], 'on', (v) => { this.showBohr = v === 'on'; });
    let down = false;
    this.canvas.addEventListener('pointerdown', (e) => { down = true; this.canvas.setPointerCapture(e.pointerId); this.probe = canvasPos(this.canvas, e, this.w, this.h); });
    this.canvas.addEventListener('pointermove', (e) => { if (down) this.probe = canvasPos(this.canvas, e, this.w, this.h); });
    this.canvas.addEventListener('pointerup', () => { down = false; });
    this.canvas.style.touchAction = 'none'; this.canvas.style.cursor = 'crosshair';
    this.controls.appendChild($('div', 'lw-caption', 'Press on the cloud to probe |ψ|² at that point.'));
  }
  private extent() { const n = ORBITALS[this.sel][1]; return n === 1 ? 5 : n === 2 ? 14 : 28; }
  private render() {
    const psi = ORBITALS[this.sel][3]; const N = 160, ext = this.extent();
    const cv = document.createElement('canvas'); cv.width = N; cv.height = N; const ctx = cv.getContext('2d')!; const id = ctx.createImageData(N, N);
    const vals = new Float32Array(N * N); let max = 0;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const x = (i / (N - 1) * 2 - 1) * ext, z = (1 - j / (N - 1) * 2) * ext; const r = Math.hypot(x, z); const ct = r > 0 ? z / r : 1, st = r > 0 ? Math.abs(x) / r : 0; const p = psi(r, ct, st); vals[j * N + i] = p; if (p * p > max) max = p * p; }
    for (let k = 0; k < N * N; k++) { const p = vals[k]; const v = Math.pow(p * p / max, 0.42); const o = k * 4; if (p >= 0) { id.data[o] = 255 * Math.pow(v, 0.8); id.data[o + 1] = 200 * v; id.data[o + 2] = 120 * v; } else { id.data[o] = 120 * v; id.data[o + 1] = 190 * v; id.data[o + 2] = 255 * Math.pow(v, 0.8); } id.data[o + 3] = Math.min(255, v * 300); }
    ctx.putImageData(id, 0, 0); this.img = cv; this.imgFor = this.sel; this.max = max;
  }
  protected draw() {
    const c = this.ctx; c.fillStyle = C.bg; c.fillRect(0, 0, this.w, this.h);
    if (this.imgFor !== this.sel || !this.img) this.render();
    const [label, n, l, psi] = ORBITALS[this.sel]; const ext = this.extent();
    const S = Math.min(this.w * 0.55, this.h - 28), ix = 8, iy = (this.h - S) / 2 + 4;
    c.imageSmoothingEnabled = true; c.drawImage(this.img!, ix, iy, S, S); c.strokeStyle = C.grid; c.strokeRect(ix, iy, S, S);
    const cx = ix + S / 2, cy = iy + S / 2; const toPx = (a0: number) => a0 / ext * S / 2;
    if (this.showBohr) { this.circle(cx, cy, toPx(n * n), hexA(C.accent, 0.85), undefined, 1, [4, 3]); this.text(`Bohr orbit  r = ${n * n} a₀`, cx, iy + S - 9, C.accent, 8, 'center'); }
    this.circle(cx, cy, 2, undefined, C.red);
    this.text(`${label}   n = ${n}, l = ${l}   —  slice through the nucleus, ±${ext} a₀`, ix + 2, iy - 9, C.text, 9);
    this.line(ix + 8, iy + 12, ix + 8 + toPx(n === 1 ? 2 : n === 2 ? 5 : 10), iy + 12, C.text, 2); this.text(`${n === 1 ? 2 : n === 2 ? 5 : 10} a₀`, ix + 10 + toPx(n === 1 ? 2 : n === 2 ? 5 : 10), iy + 12, C.text, 7);
    const gx0 = this.w * 0.62, gx1 = this.w - 10, gy0 = 32, gy1 = this.h * 0.6;
    const rmax = ext * 1.2; const radial = (r: number) => { let m = 0; for (let a = 0; a <= 90; a += 15) { const v = psi(r, Math.cos(a * DEG), Math.sin(a * DEG)); m = Math.max(m, v * v); } return r * r * m; };
    let pmax = 0, rpk = 0; const Ns = 120; const P: number[] = []; for (let i = 0; i <= Ns; i++) { const r = i / Ns * rmax; const v = radial(r); P.push(v); if (v > pmax) { pmax = v; rpk = r; } }
    this.line(gx0, gy1, gx1, gy1, C.line); this.line(gx0, gy0, gx0, gy1, C.line);
    c.beginPath(); P.forEach((v, i) => { const x = gx0 + i / Ns * (gx1 - gx0), y = gy1 - v / pmax * (gy1 - gy0) * 0.9; i ? c.lineTo(x, y) : c.moveTo(x, y); }); c.strokeStyle = C.accent; c.lineWidth = 1.5; c.stroke();
    const xb = gx0 + (n * n) / rmax * (gx1 - gx0); this.line(xb, gy0, xb, gy1, hexA(C.accent, 0.5), 1, [3, 3]); this.text(`${n * n} a₀`, xb, gy1 + 9, C.accent, 7, 'center');
    this.text('radial probability  P(r) = r² |R(r)|²', gx0, gy0 - 12, C.dim, 8); this.text(`r → (0 … ${fmt(rmax, 0)} a₀)`, gx1, gy1 + 9, C.dim, 7, 'right');
    this.text(`most probable r = ${fmt(rpk, 1)} a₀${Math.round(rpk) === n * n ? '  — Bohr\'s radius' : ''}`, gx0, gy1 + 24, C.text, 8);
    this.text(`nodes: ${n - l - 1} radial, ${l} angular`, gx0, gy1 + 36, C.dim, 8);
    let probeTxt = 'press on the cloud';
    if (this.probe && this.probe.x >= ix && this.probe.x <= ix + S && this.probe.y >= iy && this.probe.y <= iy + S) { const x = (this.probe.x - cx) / (S / 2) * ext, z = -(this.probe.y - cy) / (S / 2) * ext; const r = Math.hypot(x, z); const ct = r > 0 ? z / r : 1, st = r > 0 ? Math.abs(x) / r : 0; const v = psi(r, ct, st); probeTxt = `r = ${fmt(r, 2)} a₀,   |ψ|² = ${fmt(v * v / this.max * 100, 1)} % of peak,   sign ${v >= 0 ? '+' : '−'}`; this.circle(this.probe.x, this.probe.y, 5, '#fff'); }
    this.setReadout([
      ['Orbital', `${label}:  E = ${fmt(-13.6 / (n * n), 2)} eV,   L = √(l(l+1)) ħ = ${l === 0 ? '0' : fmt(Math.sqrt(l * (l + 1)), 2) + ' ħ'}`, C.accent],
      ['Probe', probeTxt],
      ['Colour', 'warm = ψ > 0, cool = ψ < 0;  brightness ∝ |ψ|²'],
    ]);
  }
}

/* ------------------------------------------------- 43. wave packet ---- */

class WavePacketWidget extends CanvasWidget {
  private sx = 1.2; private N = 25; private t = 0;
  constructor() {
    super(480 / 300);
    this.playButton();
    this.slider('Position spread Δx', 0.35, 4, 0.01, 1.2, (v) => fmt(v, 2), (v) => { this.sx = v; this.t = 0; });
    this.slider('Number of waves added', 3, 61, 2, 25, (v) => `${v}`, (v) => { this.N = v; this.t = 0; });
    const b = $('button', 'lw-play', '↺'); b.title = 'restart'; b.addEventListener('click', () => { this.t = 0; }); this.controls.appendChild(b);
  }
  protected draw(dt: number) {
    this.t += dt * 0.6; if (this.t > 6) this.t = 0;
    const c = this.ctx; c.fillStyle = C.bg; c.fillRect(0, 0, this.w, this.h);
    const k0 = 7, sk = 1 / (2 * this.sx), N = this.N, kspan = 3.2 * sk;
    const ks: number[] = [], As: number[] = [];
    for (let i = 0; i < N; i++) { const k = k0 + (i / (N - 1) * 2 - 1) * kspan; ks.push(k); As.push(Math.exp(-((k - k0) ** 2) / (2 * sk * sk))); }
    const norm = As.reduce((a, b) => a + b, 0);
    const gx0 = 12, gx1 = this.w - 12, yc = this.h * 0.3, amp = this.h * 0.2, xr = 12;
    const X = (x: number) => gx0 + (x + xr) / (2 * xr) * (gx1 - gx0);
    this.line(gx0, yc, gx1, yc, C.grid);
    const env: number[] = []; let sumP = 0, sumPx = 0, sumPxx = 0; c.beginPath(); let first = true;
    for (let px = gx0; px <= gx1; px += 1.5) { const x = -xr + (px - gx0) / (gx1 - gx0) * 2 * xr; let re = 0, im = 0; for (let i = 0; i < N; i++) { const ph = ks[i] * x - 0.5 * (ks[i] - k0) ** 2 * this.t; re += As[i] * Math.cos(ph); im += As[i] * Math.sin(ph); } re /= norm; im /= norm; const y = yc - re * amp; first ? c.moveTo(px, y) : c.lineTo(px, y); first = false; const P = re * re + im * im; sumP += P; sumPx += P * x; sumPxx += P * x * x; env.push(px, Math.sqrt(P) * amp); }
    c.strokeStyle = C.blue; c.lineWidth = 1.2; c.stroke();
    c.beginPath(); for (let i = 0; i < env.length; i += 2) i ? c.lineTo(env[i], yc - env[i + 1]) : c.moveTo(env[i], yc - env[i + 1]); for (let i = env.length - 2; i >= 0; i -= 2) c.lineTo(env[i], yc + env[i + 1]); c.closePath(); c.fillStyle = hexA(C.blue, 0.12); c.fill();
    const dxpx = this.sx / (2 * xr) * (gx1 - gx0); this.line(X(0) - dxpx, yc + amp + 8, X(0) + dxpx, yc + amp + 8, C.accent, 2); this.text('2Δx', X(0), yc + amp + 17, C.accent, 8, 'center');
    this.text('position:  Re ψ(x) and the envelope |ψ|', gx0, 12, C.dim, 8);
    const ky0 = this.h * 0.64, kh = this.h * 0.2; const KX = (k: number) => gx0 + (k - (k0 - 4)) / 8 * (gx1 - gx0);
    this.line(gx0, ky0 + kh, gx1, ky0 + kh, C.grid);
    for (let i = 0; i < N; i++) { const x = KX(ks[i]); const hh = As[i] * As[i] * kh; c.fillStyle = hexA(C.blue, 0.8); c.fillRect(x - 1.5, ky0 + kh - hh, 3, hh); }
    c.beginPath(); for (let px = gx0; px <= gx1; px += 2) { const k = (k0 - 4) + (px - gx0) / (gx1 - gx0) * 8; const a = Math.exp(-((k - k0) ** 2) / (2 * sk * sk)); const y = ky0 + kh - a * a * kh; px === gx0 ? c.moveTo(px, y) : c.lineTo(px, y); } c.strokeStyle = hexA(C.blue, 0.5); c.lineWidth = 1; c.stroke();
    this.text('momentum (p = ħk) of the waves that were added', gx0, ky0 - 8, C.dim, 8);
    const dkpx = sk / 8 * (gx1 - gx0); this.line(KX(k0) - dkpx, ky0 + kh + 7, KX(k0) + dkpx, ky0 + kh + 7, C.accent, 2); this.text('2Δp/ħ', KX(k0), ky0 + kh + 16, C.accent, 8, 'center');
    const meas = Math.sqrt(Math.max(0, sumPxx / sumP - (sumPx / sumP) ** 2));
    this.setReadout([
      ['Δx  (Gaussian width)', fmt(this.sx, 2), C.accent], ['Δp / ħ = Δk', fmt(sk, 3), C.accent],
      ['Product  Δx · Δp', `${fmt(this.sx * sk, 3)} ħ  =  ħ/2, the minimum`, C.green],
      ['Measured on screen', `Δx = ${fmt(meas, 2)}${N < 15 ? '  (few waves: the packet repeats)' : this.t > 0.6 ? '  (dispersion: the packet spreads with time)' : ''}`],
    ]);
  }
}

/* ------------------------------------------------- 44. Pauli and the periodic table ---- */

const ELEMENTS = 'H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn Ga Ge As Se Br Kr'.split(' ');
const ELEMENT_NAMES = 'hydrogen helium lithium beryllium boron carbon nitrogen oxygen fluorine neon sodium magnesium aluminium silicon phosphorus sulfur chlorine argon potassium calcium scandium titanium vanadium chromium manganese iron cobalt nickel copper zinc gallium germanium arsenic selenium bromine krypton'.split(' ');
const SUBSHELLS: Array<[string, number, number]> = [['1s', 1, 1], ['2s', 2, 1], ['2p', 2, 3], ['3s', 3, 1], ['3p', 3, 3], ['4s', 4, 1], ['3d', 3, 5], ['4p', 4, 3]];

class PauliWidget extends CanvasWidget {
  private Z = 8; private pauli = true; private t = 0;
  constructor() {
    super(480 / 300);
    this.slider('Number of electrons Z', 1, 36, 1, 8, (v) => `${v}  (${ELEMENTS[v - 1]})`, (v) => { this.Z = v; });
    this.segmented<'on' | 'off'>([['on', 'Pauli principle on'], ['off', 'off — everything falls to 1s']], 'on', (v) => { this.pauli = v === 'on'; });
  }
  private fill(): number[][] {
    let left = this.Z; const out: number[][] = [];
    for (const [, , k] of SUBSHELLS) { const orb = new Array(k).fill(0) as number[]; let cap = Math.min(left, 2 * k); left -= cap; for (let i = 0; i < k && cap > 0; i++) { orb[i] = 1; cap--; } for (let i = 0; i < k && cap > 0; i++) { orb[i] = 2; cap--; } out.push(orb); }
    if (this.Z === 24) { out[5] = [1]; out[6] = [1, 1, 1, 1, 1]; } if (this.Z === 29) { out[5] = [1]; out[6] = [2, 2, 2, 2, 2]; }
    return out;
  }
  protected draw(dt: number) {
    this.t += dt;
    const c = this.ctx; c.fillStyle = C.bg; c.fillRect(0, 0, this.w, this.h);
    const conf = this.fill(), Z = this.Z;
    const bx0 = 48, boxW = 24, boxH = 26, gap = 5; const rowStep = Math.min(46, (this.h * 0.86 - 44) / (SUBSHELLS.length - 1)); const rowY = (i: number) => this.h * 0.86 - boxH - i * rowStep;
    SUBSHELLS.forEach(([label, , k], i) => {
      const y = rowY(i); this.text(label, bx0 - 8, y + boxH / 2, C.text, 10, 'right', 'serif');
      for (let j = 0; j < k; j++) {
        const x = bx0 + j * (boxW + gap); c.strokeStyle = C.line; c.strokeRect(x, y, boxW, boxH);
        if (this.pauli) { const e = conf[i][j]; if (e >= 1) this.text('↑', x + 7, y + boxH / 2, C.blue, 14, 'center'); if (e >= 2) this.text('↓', x + 17, y + boxH / 2, C.red, 14, 'center'); }
        else if (i === 0) { for (let q = 0; q < Math.min(Z, 12); q++) this.text(q % 2 ? '↓' : '↑', x + 2 + (q % 6) * 2.8, y + boxH / 2 + (q < 6 ? -5 : 5), q % 2 ? C.red : C.blue, 9, 'center'); if (Z > 12) this.text(`×${Z}`, x + boxW + 6, y + boxH / 2, C.red, 8); }
      }
    });
    this.text('energy ↑', bx0 - 8, rowY(SUBSHELLS.length - 1) - 14, C.dim, 8, 'right');
    const sup = (n: number) => String(n).split('').map((d) => SUP[+d]).join('');
    const confStr = this.pauli ? SUBSHELLS.map(([l], i) => { const n = conf[i].reduce((a, b) => a + b, 0); return n ? `${l}${sup(n)}` : ''; }).filter(Boolean).join(' ') : `1s${sup(Z)}  — impossible`;
    const sx = this.w * 0.7, sy = this.h * 0.42, sR = Math.min(26, (this.h * 0.42 - 40) / 4 - 4);
    const perShell = [0, 0, 0, 0, 0]; if (this.pauli) SUBSHELLS.forEach(([, n], i) => { perShell[n] += conf[i].reduce((a, b) => a + b, 0); }); else perShell[1] = Z;
    this.circle(sx, sy, 8, undefined, C.red); this.text(`${Z}+`, sx, sy, '#fff', 7, 'center', 'mono');
    for (let n = 1; n <= 4; n++) { const r = 16 + n * sR; this.circle(sx, sy, r, C.grid, undefined, 1, [2, 3]); const cnt = perShell[n]; for (let q = 0; q < cnt; q++) { const a = this.t * (0.6 / n) + q / cnt * TAU; this.circle(sx + r * Math.cos(a), sy + r * Math.sin(a), this.pauli ? 2.5 : Math.max(1.2, 2.5 - cnt / 30), undefined, C.blue); } if (cnt) this.text(`${cnt}`, sx + r + 5, sy - 4, C.dim, 7); }
    this.text(`${ELEMENTS[Z - 1]} — ${ELEMENT_NAMES[Z - 1]}`, sx, sy + 16 + 4 * sR + 16, C.text, 11, 'center', 'serif');
    this.text(this.pauli ? 'shells  n = 1 … 4' : 'no shells: every electron in n = 1', sx, sy - 16 - 4 * sR - 12, C.dim, 8, 'center');
    const noble = [2, 10, 18, 36].includes(Z);
    const nmax = Math.max(1, ...SUBSHELLS.filter((_, i) => conf[i].some((e) => e > 0)).map(([, n]) => n));
    const valence = SUBSHELLS.reduce((s, [, n], i) => s + (n === nmax ? conf[i].reduce((a, b) => a + b, 0) : 0), 0);
    this.setReadout([
      ['Configuration', confStr, this.pauli ? C.accent : C.red],
      ['Outer-shell electrons', this.pauli ? `${valence}${noble ? ' — closed shell: inert (noble gas)' : valence === 1 ? ' — one loose electron: alkali metal' : valence === 7 ? ' — one short of a full shell: halogen' : ''}` : 'all of them, in one state — no shells, no chemistry'],
      ['Rule', this.pauli ? 'Pauli: 2 per orbital · Hund: singles first' : 'no exclusion → all in 1s: tiny, identical, inert atoms'],
    ]);
  }
}

/* ------------------------------------------------------- 0. ancient sky ---- */

/** [RA°, Dec° (J2000), V, B−V, name?] — the naked-eye sky down to ~mag 3 where it matters for the figures */
type SkyStar = [number, number, number, number, string?];
const SKY: SkyStar[] = [
  // Orion
  [88.793, 7.407, 0.45, 1.85, 'Betelgeuse'], [78.634, -8.202, 0.18, -0.03, 'Rigel'], [81.283, 6.350, 1.64, -0.22], [84.053, -1.202, 1.69, -0.18],
  [85.190, -1.943, 1.74, -0.20], [83.002, -0.299, 2.25, -0.17], [86.939, -9.670, 2.07, -0.17],
  // Ursa Major — the Plough
  [165.932, 61.751, 1.79, 1.06, 'Dubhe'], [165.460, 56.382, 2.37, 0.03], [178.458, 53.695, 2.44, 0.04], [183.857, 57.033, 3.31, 0.08],
  [193.507, 55.960, 1.76, -0.02], [200.981, 54.925, 2.23, 0.06], [206.885, 49.313, 1.86, -0.10, 'Alkaid'],
  // Ursa Minor & Draco
  [37.955, 89.264, 1.98, 0.60, 'Polaris'], [222.677, 74.156, 2.07, 1.47, 'Kochab'], [230.182, 71.834, 3.00, 0.06], [211.097, 64.376, 3.65, -0.05, 'Thuban'], [269.152, 51.489, 2.23, 1.52],
  // Cassiopeia
  [10.127, 56.537, 2.24, 1.17], [2.295, 59.150, 2.28, 0.34], [14.177, 60.717, 2.15, -0.15], [21.454, 60.235, 2.68, 0.16], [28.599, 63.670, 3.35, -0.15],
  // Scorpius
  [247.352, -26.432, 1.06, 1.83, 'Antares'], [241.359, -19.805, 2.56, -0.07], [240.083, -22.622, 2.29, -0.12], [239.713, -26.114, 2.89, -0.19], [245.297, -25.593, 2.90, 0.13],
  [248.971, -28.216, 2.82, -0.25], [252.541, -34.293, 2.29, 1.15], [252.968, -38.048, 3.00, -0.20], [253.498, -42.362, 3.60, 1.40], [258.038, -43.239, 3.33, 0.44],
  [264.330, -42.998, 1.86, 0.40], [265.622, -39.030, 2.39, -0.17], [263.402, -37.104, 1.62, -0.22, 'Shaula'], [262.691, -37.296, 2.70, -0.18],
  // Leo
  [152.093, 11.967, 1.36, -0.09, 'Regulus'], [177.265, 14.572, 2.14, 0.09, 'Denebola'], [154.993, 19.842, 2.01, 1.13], [168.527, 20.524, 2.56, 0.13], [151.833, 16.763, 3.48, -0.03],
  [154.173, 23.417, 3.43, 0.31], [148.191, 26.007, 3.88, 1.22], [146.463, 23.774, 2.97, 0.81], [168.560, 15.430, 3.33, -0.01],
  // Taurus
  [68.980, 16.509, 0.87, 1.54, 'Aldebaran'], [81.573, 28.607, 1.65, -0.13, 'Elnath'], [84.411, 21.143, 3.00, -0.19], [56.871, 24.105, 2.87, -0.09, 'Pleiades'], [67.166, 15.871, 3.40, 0.18], [64.948, 15.628, 3.65, 0.99], [67.154, 19.180, 3.53, 1.01],
  // Gemini
  [113.650, 31.888, 1.58, 0.03, 'Castor'], [116.329, 28.026, 1.14, 1.00, 'Pollux'], [99.428, 16.399, 1.93, 0.00], [95.740, 22.514, 2.87, 1.64], [100.983, 25.131, 3.06, 1.40], [110.031, 21.982, 3.50, 0.34],
  // Cygnus, Lyra, Aquila
  [310.358, 45.280, 1.25, 0.09, 'Deneb'], [305.557, 40.257, 2.23, 0.68], [292.680, 27.960, 3.05, 1.13], [311.553, 33.970, 2.48, 1.02], [296.244, 45.131, 2.86, -0.03],
  [279.235, 38.784, 0.03, 0.00, 'Vega'], [297.696, 8.868, 0.76, 0.22, 'Altair'],
  // Boötes, Virgo, Corona Borealis, Ophiuchus
  [213.915, 19.182, -0.05, 1.23, 'Arcturus'], [201.298, -11.161, 0.98, -0.23, 'Spica'], [233.672, 26.715, 2.23, -0.02], [263.734, 12.560, 2.08, 0.15],
  // Canis Major & Minor, Auriga, Carina
  [101.287, -16.716, -1.46, 0.00, 'Sirius'], [104.656, -28.972, 1.50, -0.21], [107.098, -26.393, 1.83, 0.68], [95.675, -17.956, 1.98, -0.24],
  [114.825, 5.225, 0.34, 0.42, 'Procyon'], [79.172, 45.998, 0.08, 0.80, 'Capella'], [95.988, -52.696, -0.72, 0.15, 'Canopus'],
  // Perseus, Andromeda, Pegasus
  [51.081, 49.861, 1.79, 0.48, 'Mirfak'], [47.042, 40.956, 2.12, -0.05, 'Algol'],
  [2.097, 29.090, 2.06, -0.11], [17.433, 35.620, 2.05, 1.58], [30.975, 42.330, 2.26, 1.37],
  [346.190, 15.205, 2.49, -0.04], [345.944, 28.083, 2.42, 1.67], [3.309, 15.184, 2.83, -0.23], [326.046, 9.875, 2.39, 1.53],
  // Sagittarius — the teapot
  [276.043, -34.385, 1.85, -0.03], [283.816, -26.297, 2.02, -0.13], [275.249, -29.828, 2.70, 1.38], [276.993, -25.421, 2.81, 1.04], [285.653, -29.880, 2.60, 0.06], [281.414, -26.991, 3.17, -0.11], [286.735, -27.670, 3.32, 1.19], [271.452, -30.424, 2.98, 0.98],
  // Centaurus & Crux
  [219.902, -60.834, -0.27, 0.71, 'α Centauri'], [210.956, -60.373, 0.61, -0.23, 'Hadar'],
  [186.650, -63.099, 0.77, -0.24, 'Acrux'], [191.930, -59.689, 1.25, -0.24], [187.791, -57.113, 1.59, 1.59], [183.786, -58.749, 2.79, -0.19],
  // odds and ends
  [344.413, -29.622, 1.16, 0.09, 'Fomalhaut'], [24.429, -57.237, 0.46, -0.16, 'Achernar'], [141.897, -8.659, 1.98, 1.44, 'Alphard'], [319.645, 62.585, 2.44, 0.22],
  [31.793, 23.462, 2.00, 1.15, 'Hamal'], [10.897, -17.987, 2.04, 1.02], [332.058, -46.961, 1.74, -0.13], [120.896, -40.003, 2.25, -0.26], [122.383, -47.337, 1.80, -0.14],
  [222.720, -16.042, 2.75, 0.15], [229.252, -9.383, 2.61, -0.07], [326.760, -16.127, 2.87, 0.29], [322.890, -5.571, 2.90, 0.83],
];
/** constellation figures as index pairs into SKY */
const SKY_LINES: Array<[number, number]> = [
  [0, 2], [0, 4], [2, 5], [4, 3], [3, 5], [4, 6], [5, 1], [1, 6],                               // Orion
  [7, 8], [8, 9], [9, 10], [10, 7], [10, 11], [11, 12], [12, 13],                                // Plough
  [15, 16],                                                                                       // Ursa Minor (the Guards)
  [20, 19], [19, 21], [21, 22], [22, 23],                                                        // Cassiopeia
  [25, 26], [26, 27], [26, 28], [28, 24], [24, 29], [29, 30], [30, 31], [31, 32], [32, 33], [33, 34], [34, 35], [35, 36], [36, 37], // Scorpius
  [38, 42], [42, 40], [40, 43], [43, 44], [44, 45], [38, 46], [46, 39], [40, 41], [41, 39], [41, 46], // Leo
  [47, 51], [51, 52], [52, 53], [47, 49], [53, 48],                                              // Taurus
  [54, 58], [58, 57], [55, 59], [59, 56],                                                        // Gemini
  [60, 61], [61, 62], [64, 61], [61, 63],                                                        // Cygnus
  [71, 74], [71, 73], [73, 72],                                                                  // Canis Major
  [78, 79],                                                                                       // Perseus
  [80, 84], [84, 83], [83, 85], [85, 80], [80, 81], [81, 82], [83, 86],                          // Great Square, Andromeda, Pegasus
  [94, 89], [89, 90], [90, 92], [92, 88], [88, 93], [93, 91], [91, 92], [89, 87], [87, 91],      // Sagittarius — the teapot
  [95, 96], [97, 99], [98, 100],                                                                 // Centaurus pointers, Crux
];
const bvRGB = (bv: number) => tempRGB(4600 * (1 / (0.92 * bv + 1.7) + 1 / (0.92 * bv + 0.62)));

const WANDERERS: Array<{ name: string; L0: number; n: number; a: number; color: string; r: number }> = [
  { name: 'Mercury', L0: 252.2509, n: 4.09233, a: 0.38710, color: '#d9d4c7', r: 1.7 },
  { name: 'Venus', L0: 181.9798, n: 1.60213, a: 0.72333, color: '#fff4d6', r: 3.4 },
  { name: 'Mars', L0: 355.4533, n: 0.52403, a: 1.52371, color: '#e07a55', r: 2.0 },
  { name: 'Jupiter', L0: 34.3965, n: 0.08309, a: 5.20289, color: '#f3e3c2', r: 2.9 },
  { name: 'Saturn', L0: 49.9544, n: 0.03346, a: 9.53668, color: '#e8d9a8', r: 2.0 },
];
const EARTH_ORBIT = { L0: 100.4664, n: 0.98561 };
const ANCIENT_CITIES: Array<[string, string, number]> = [['athens', 'Athens 38°N', 38.0], ['babylon', 'Babylon 32°N', 32.5], ['alexandria', 'Alexandria 31°N', 31.2]];
const ANCIENT_EPOCHS: Array<[string, string, number]> = [['-500', '500 BCE', -500], ['150', '150 CE · Ptolemy', 150], ['2025', 'Today', 2025]];

class AncientSkyWidget extends CanvasWidget {
  private lat = 38 * DEG;
  private year = -500;
  private doy = 300;            // day of the (tropical) year
  private hour = 22;            // local mean solar time
  private mode: 'night' | 'nights' = 'night';
  private speed = 1;
  private azc = 180 * DEG;      // azimuth at the centre of the view (south)
  private figures = true;
  private dragging: { x: number; azc: number } | null = null;
  private starsEq: V3[] = [];   // unit vectors, equatorial frame of date
  private trails: Array<Array<{ ra: number; dec: number; d: number }>> = WANDERERS.map(() => []);
  private setDoy: (v: number) => void = () => {};
  private setHour: (v: number) => void = () => {};

  constructor() {
    super(480 / 400);
    this.precess();
    this.segmented<'night' | 'nights'>([['night', 'One night'], ['nights', 'Night after night']], this.mode, (m) => { this.mode = m; this.trails.forEach((t) => t.length = 0); });
    this.playButton();
    this.segmented(ANCIENT_CITIES.map(([k, l]) => [k, l] as [string, string]), 'athens', (k) => { this.lat = ANCIENT_CITIES.find((c) => c[0] === k)![2] * DEG; });
    this.segmented(ANCIENT_EPOCHS.map(([k, l]) => [k, l] as [string, string]), '-500', (k) => { this.year = ANCIENT_EPOCHS.find((c) => c[0] === k)![2]; this.precess(); this.trails.forEach((t) => t.length = 0); });
    this.setDoy = this.slider('Day of year', 0, 365, 1, this.doy, (v) => `${fmt(v, 0)}`, (v) => { this.doy = v; }).set;
    this.setHour = this.slider('Local time', 0, 24, 0.05, this.hour, (v) => `${padZ(v)}:${padZ((v % 1) * 60)}`, (v) => { this.hour = v; }).set;
    this.slider('Speed', 0.2, 3, 0.1, this.speed, (v) => `${fmt(v, 1)}×`, (v) => { this.speed = v; });
    this.segmented<'on' | 'off'>([['on', 'Figures'], ['off', 'Stars only']], 'on', (v) => { this.figures = v === 'on'; });
    this.controls.appendChild($('div', 'lw-caption', 'Drag to look around. The sky turns about the point in the north where no bright star sits; the ecliptic is the road of the Sun, Moon and wanderers.'));
    this.canvas.addEventListener('pointerdown', (e) => { this.dragging = { x: e.clientX, azc: this.azc }; this.canvas.setPointerCapture(e.pointerId); });
    this.canvas.addEventListener('pointermove', (e) => {
      if (!this.dragging || !this.w) return;
      this.azc = ((this.dragging.azc - (e.clientX - this.dragging.x) * (this.fov / this.w)) % TAU + TAU) % TAU;
    });
    this.canvas.addEventListener('pointerup', () => { this.dragging = null; });
    this.canvas.style.cursor = 'grab';
  }

  private readonly fov = 170 * DEG;

  /** stars from J2000 to the mean equator & equinox of `year`: a rotation about the ecliptic pole */
  private precess() {
    const dl = 0.013969 * (this.year - 2000) * DEG;   // 50.29″ per year
    const ce = Math.cos(OBLIQ), se = Math.sin(OBLIQ), cl = Math.cos(dl), sl = Math.sin(dl);
    this.starsEq = SKY.map(([ra, dec]) => {
      const a = ra * DEG, d = dec * DEG;
      const x = Math.cos(d) * Math.cos(a), y = Math.cos(d) * Math.sin(a), z = Math.sin(d);
      const xe = x, ye = ce * y + se * z, ze = -se * y + ce * z;          // → ecliptic
      const xr = xe * cl - ye * sl, yr = xe * sl + ye * cl;               // precess in longitude
      return { x: xr, y: ce * yr - se * ze, z: se * yr + ce * ze };       // → equatorial of date
    });
  }
  private eclToEq(lon: number, lat: number): V3 {
    const x = Math.cos(lat) * Math.cos(lon), y = Math.cos(lat) * Math.sin(lon), z = Math.sin(lat);
    return { x, y: Math.cos(OBLIQ) * y - Math.sin(OBLIQ) * z, z: Math.sin(OBLIQ) * y + Math.cos(OBLIQ) * z };
  }
  /** equatorial unit vector → horizon (east, north, up) for local sidereal time `lst` (rad) */
  private toHorizon(v: V3, lst: number): V3 {
    const H = lst - Math.atan2(v.y, v.x), dec = Math.asin(Math.max(-1, Math.min(1, v.z)));
    const sp = Math.sin(this.lat), cp = Math.cos(this.lat), cd = Math.cos(dec), sd = Math.sin(dec);
    return { x: -cd * Math.sin(H), y: -cd * Math.cos(H) * sp + sd * cp, z: cd * Math.cos(H) * cp + sd * sp };
  }

  protected draw(dt: number) {
    const c = this.ctx;
    if (dt > 0) {
      if (this.mode === 'night') { this.hour = (this.hour + dt * this.speed * 0.5) % 24; this.setHour(this.hour); }
      else { this.doy += dt * this.speed * 1.5; if (this.doy > 365) { this.doy -= 365; this.year += 1; this.precess(); } this.setDoy(this.doy); }
    }
    const d = (this.year - 2000) * 365.2422 + this.doy;                 // days from J2000 (mean)
    const sunLon = wrap360(280.46 + 0.98565 * d) * DEG;
    const sunEq = this.eclToEq(sunLon, 0);
    const lst = Math.atan2(sunEq.y, sunEq.x) + (this.hour - 12) * 15 * DEG;
    const sunH = this.toHorizon(sunEq, lst);
    const sunAlt = Math.asin(sunH.z) / DEG;

    const moonLon = wrap360(218.316 + 13.176396 * d) * DEG;
    const node = wrap360(125.045 - 0.052954 * d) * DEG;
    const moonLat = 5.128 * DEG * Math.sin(moonLon - node);
    const moonH = this.toHorizon(this.eclToEq(moonLon, moonLat), lst);
    const elong = wrap360((moonLon - sunLon) / DEG);                      // 0 new · 90 first quarter · 180 full
    const lit = (1 - Math.cos(elong * DEG)) / 2;

    const eL = (EARTH_ORBIT.L0 + EARTH_ORBIT.n * d) * DEG;
    const ex = Math.cos(eL), ey = Math.sin(eL);
    const planets = WANDERERS.map((p, i) => {
      const L = (p.L0 + p.n * d) * DEG;
      const gx = p.a * Math.cos(L) - ex, gy = p.a * Math.sin(L) - ey;
      const lon = Math.atan2(gy, gx), dist = Math.hypot(gx, gy);
      const eq = this.eclToEq(lon, 0);
      if (dt > 0 && this.mode === 'nights') {
        const tr = this.trails[i]; const last = tr[tr.length - 1];
        if (!last || d - last.d >= 1) tr.push({ ra: Math.atan2(eq.y, eq.x), dec: Math.asin(eq.z), d });
        while (tr.length && d - tr[0].d > 240) tr.shift();
      }
      const elongP = Math.abs((((lon - sunLon) / DEG + 540) % 360) - 180);
      return { ...p, hz: this.toHorizon(eq, lst), dist, elong: elongP, size: p.name === 'Mars' ? 1.3 + 2.2 * Math.min(1, (0.6 / dist) ** 2) : p.name === 'Venus' ? 2.4 + 1.4 * Math.min(1, 0.4 / dist) : p.r };
    });

    /* ---- geometry: cylindrical panorama ---- */
    const groundH = 64, horizonY = this.h - groundH;
    const s = this.w / this.fov;                                         // px per radian
    const P = (v: V3) => {
      const az = Math.atan2(v.x, v.y);
      const da = ((az - this.azc + Math.PI) % TAU + TAU) % TAU - Math.PI;
      const alt = Math.asin(Math.max(-1, Math.min(1, v.z)));
      return { x: this.w / 2 + da * s, y: horizonY - alt * s, alt, inView: Math.abs(da) < this.fov / 2 + 0.1 };
    };

    /* ---- sky ---- */
    const day = Math.max(0, Math.min(1, (sunAlt + 12) / 14));           // 0 night … 1 day
    const dusk = Math.max(0, 1 - Math.abs(sunAlt + 4) / 10);            // twilight glow strength
    const mix = (a: number[], b: number[], t: number) => a.map((v, i) => v + (b[i] - v) * t);
    const top = mix([6, 8, 16], [92, 150, 220], day), bot = mix([12, 15, 26], [160, 196, 236], day);
    const g = c.createLinearGradient(0, 0, 0, horizonY);
    g.addColorStop(0, `rgb(${top.map(Math.round).join(',')})`); g.addColorStop(1, `rgb(${bot.map(Math.round).join(',')})`);
    c.fillStyle = g; c.fillRect(0, 0, this.w, horizonY);
    const sp = P(sunH);
    if (dusk > 0) {
      const gg = c.createRadialGradient(sp.x, horizonY, 0, sp.x, horizonY, this.w * 0.55);
      gg.addColorStop(0, `rgba(240,150,70,${0.55 * dusk})`); gg.addColorStop(0.5, `rgba(180,90,90,${0.2 * dusk})`); gg.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = gg; c.fillRect(0, 0, this.w, horizonY);
    }
    const starA = Math.max(0, Math.min(1, (-sunAlt - 5) / 11));

    // ecliptic
    c.save(); c.beginPath(); c.rect(0, 0, this.w, horizonY); c.clip();
    c.setLineDash([3, 5]); c.lineWidth = 1; c.strokeStyle = `rgba(242,196,90,${0.18 + 0.2 * starA})`;
    let prev: { x: number; y: number; inView: boolean } | null = null;
    for (let i = 0; i <= 180; i++) {
      const q = P(this.toHorizon(this.eclToEq(i / 180 * TAU, 0), lst));
      if (prev && prev.inView && q.inView && Math.abs(q.x - prev.x) < this.w / 2) { c.beginPath(); c.moveTo(prev.x, prev.y); c.lineTo(q.x, q.y); c.stroke(); }
      prev = q;
    }
    c.setLineDash([]);
    // celestial pole
    const pole = P({ x: 0, y: Math.cos(this.lat), z: Math.sin(this.lat) });
    if (pole.inView) {
      c.globalAlpha = 0.45 + 0.4 * starA;
      this.line(pole.x - 5, pole.y, pole.x + 5, pole.y, C.blue); this.line(pole.x, pole.y - 5, pole.x, pole.y + 5, C.blue);
      this.text('the sky turns here', pole.x + 8, pole.y - 7, C.blue, 9);
      c.globalAlpha = 1;
    }

    // stars
    const pts = this.starsEq.map((v) => P(this.toHorizon(v, lst)));
    if (this.figures && starA > 0) {
      c.strokeStyle = `rgba(189,155,108,${0.28 * starA})`; c.lineWidth = 1;
      for (const [i, j] of SKY_LINES) {
        const a = pts[i], b = pts[j];
        if (a.alt < -0.02 && b.alt < -0.02) continue;
        if (!a.inView && !b.inView) continue;
        if (Math.abs(a.x - b.x) > this.w / 2) continue;
        c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke();
      }
    }
    if (starA > 0) {
      SKY.forEach(([, , mag, bv, name], i) => {
        const q = pts[i];
        if (!q.inView || q.alt < -0.01) return;
        const vis = starA * Math.max(0, Math.min(1, (4.2 - mag) / 1.2)) * Math.min(1, 0.35 + q.alt * 3);  // extinction near the horizon
        if (vis <= 0) return;
        const r = Math.max(0.6, 2.4 - 0.42 * mag);
        const [cr, cg, cb] = bvRGB(bv);
        c.globalAlpha = vis;
        if (mag < 1.2) this.glow(q.x, q.y, r * 4, `rgba(${cr | 0},${cg | 0},${cb | 0},0.35)`);
        this.circle(q.x, q.y, r, undefined, `rgb(${cr | 0},${cg | 0},${cb | 0})`);
        if (name && (mag < 1.7 || name === 'Kochab' || name === 'Thuban' || name === 'Polaris' || name === 'Pleiades')) this.text(name, q.x + 5, q.y - 7, `rgba(211,214,220,${0.75})`, 9, 'left', 'serif');
        c.globalAlpha = 1;
      });
    }

    // wanderers and their trails among the stars
    const visible: string[] = [];
    planets.forEach((p, i) => {
      const tr = this.trails[i];
      if (tr.length > 1) {
        c.fillStyle = p.color;
        for (let k = 0; k < tr.length; k++) {
          const q = P(this.toHorizon({ x: Math.cos(tr[k].dec) * Math.cos(tr[k].ra), y: Math.cos(tr[k].dec) * Math.sin(tr[k].ra), z: Math.sin(tr[k].dec) }, lst));
          if (!q.inView || q.alt < 0) continue;
          c.globalAlpha = 0.15 + 0.5 * (k / tr.length) * starA;
          c.beginPath(); c.arc(q.x, q.y, 1, 0, TAU); c.fill();
        }
        c.globalAlpha = 1;
      }
      const q = P(p.hz);
      if (!q.inView || q.alt < 0) return;
      const a = Math.max(0, Math.min(1, (-sunAlt + (p.name === 'Venus' ? 3 : p.name === 'Jupiter' ? 0 : -4)) / 8));
      if (a <= 0) return;
      visible.push(p.name);
      c.globalAlpha = a;
      this.glow(q.x, q.y, p.size * 4, hexA(p.color, 0.35));
      this.circle(q.x, q.y, p.size, undefined, p.color);
      this.text(p.name, q.x + 6, q.y - 8, p.color, 10, 'left', 'serif');
      c.globalAlpha = 1;
    });

    // the Moon
    const mp = P(moonH);
    if (mp.inView && mp.alt > -0.02) {
      const r = 7;
      const ang = Math.atan2(sp.y - mp.y, sp.x - mp.x);
      c.save(); c.translate(mp.x, mp.y); c.rotate(ang);
      this.glow(0, 0, r * 2.6, `rgba(230,230,220,${0.25 * lit})`);
      c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fillStyle = `rgba(60,62,70,${0.9 - 0.6 * day})`; c.fill();
      const ax = r * Math.cos(elong * DEG);                                 // terminator semi-axis (signed, + toward the Sun)
      c.beginPath(); c.moveTo(0, -r); c.arc(0, 0, r, -Math.PI / 2, Math.PI / 2);
      if (ax >= 0) c.ellipse(0, 0, Math.max(0.01, ax), r, 0, Math.PI / 2, -Math.PI / 2, true);
      else c.ellipse(0, 0, Math.max(0.01, -ax), r, 0, Math.PI / 2, 3 * Math.PI / 2, false);
      c.closePath(); c.fillStyle = '#efe9d8'; c.fill();
      c.restore();
      this.text('Moon', mp.x + 10, mp.y - 10, C.text, 10, 'left', 'serif');
    }
    // the Sun
    if (sp.inView && sunAlt > -1.5) {
      this.glow(sp.x, sp.y, 40, 'rgba(255,230,160,0.7)');
      this.circle(sp.x, sp.y, 7, undefined, '#fff6dc');
    }
    c.restore();

    /* ---- ground, horizon, compass ---- */
    c.fillStyle = `rgb(${mix([14, 13, 12], [70, 62, 48], day).map(Math.round).join(',')})`;
    c.beginPath(); c.moveTo(0, horizonY);
    for (let x = 0; x <= this.w; x += 8) {
      const a = (x / s + this.azc);
      c.lineTo(x, horizonY - (3 + 2.5 * Math.sin(a * 3.1) + 1.8 * Math.sin(a * 7.3 + 1.2) + Math.sin(a * 17)) * (0.7 + 0.3 * Math.cos(a * 1.7)));
    }
    c.lineTo(this.w, this.h); c.lineTo(0, this.h); c.closePath(); c.fill();
    // a temple on the skyline, fixed to an azimuth so it slides with the view
    const tx = P({ x: Math.sin(205 * DEG), y: Math.cos(205 * DEG), z: 0 }).x;
    if (tx > -40 && tx < this.w + 40) {
      c.fillStyle = `rgb(${mix([22, 20, 18], [96, 84, 66], day).map(Math.round).join(',')})`;
      c.fillRect(tx - 22, horizonY - 7, 44, 5);
      for (let k = 0; k < 6; k++) c.fillRect(tx - 19 + k * 7.2, horizonY - 20, 2.4, 14);
      c.fillRect(tx - 24, horizonY - 23, 48, 3); c.beginPath(); c.moveTo(tx - 24, horizonY - 23); c.lineTo(tx, horizonY - 31); c.lineTo(tx + 24, horizonY - 23); c.closePath(); c.fill();
    }
    // the observer
    const ox = this.w / 2, oy = this.h - 10;
    c.fillStyle = C.accent; c.strokeStyle = C.accent; c.lineWidth = 1.4;
    this.circle(ox, oy - 15, 2.6, undefined, C.accent);
    this.line(ox, oy - 12, ox, oy - 4, C.accent, 1.6); this.line(ox, oy - 10, ox - 4, oy - 6, C.accent, 1.3); this.line(ox, oy - 10, ox + 4, oy - 13, C.accent, 1.3);
    this.line(ox, oy - 4, ox - 3, oy + 1, C.accent, 1.4); this.line(ox, oy - 4, ox + 3, oy + 1, C.accent, 1.4);
    // compass along the horizon
    for (const [l, azd] of [['N', 0], ['E', 90], ['S', 180], ['W', 270]] as Array<[string, number]>) {
      const q = P({ x: Math.sin(azd * DEG), y: Math.cos(azd * DEG), z: 0 });
      if (!q.inView) continue;
      this.line(q.x, horizonY + 2, q.x, horizonY + 8, C.accent);
      this.text(l, q.x, horizonY + 16, C.accent, 11, 'center', 'serif');
    }

    const phase = elong < 10 || elong > 350 ? 'new' : elong < 80 ? 'waxing crescent' : elong < 100 ? 'first quarter' : elong < 170 ? 'waxing gibbous' : elong < 190 ? 'full' : elong < 260 ? 'waning gibbous' : elong < 280 ? 'last quarter' : 'waning crescent';
    const polaris = this.starsEq[14];   // Polaris
    const poleDist = Math.acos(Math.max(-1, Math.min(1, polaris.z))) / DEG;
    const yr = this.year < 0 ? `${-this.year} BCE` : `${this.year} CE`;
    this.setReadout([
      ['When', `${yr} · day ${fmt(this.doy, 0)} · ${padZ(this.hour)}:${padZ((this.hour % 1) * 60)}`],
      ['Sun', sunAlt > 0 ? `${fmt(sunAlt, 0)}° up — daylight` : sunAlt > -18 ? `${fmt(-sunAlt, 0)}° below the horizon — twilight` : 'night', sunAlt > 0 ? C.sun : sunAlt > -18 ? C.accent : C.text],
      ['Moon', `${phase} · ${fmt(lit * 100, 0)} % lit`],
      ['Wanderers', visible.length ? visible.join(', ') : 'none in view', visible.length ? C.green : C.dim],
      ['Pole star', poleDist < 2 ? `Polaris (${fmt(poleDist, 1)}° off)` : `none · Polaris ${fmt(poleDist, 0)}° off`, poleDist < 2 ? C.green : C.red],
    ]);
  }
}

/* ================================================================================ */
/*  Chapter 6 — Telescopes                                                           */
/* ================================================================================ */

const ARCSEC = Math.PI / 180 / 3600;
/** Bessel J₁ (Numerical Recipes polynomial approximation) */
function J1(x: number): number {
  const ax = Math.abs(x);
  if (ax < 8) {
    const y = x * x;
    const a1 = x * (72362614232.0 + y * (-7895059235.0 + y * (242396853.1 + y * (-2972611.439 + y * (15704.48260 + y * (-30.16036606))))));
    const a2 = 144725228442.0 + y * (2300535178.0 + y * (18583304.74 + y * (99447.43394 + y * (376.9991397 + y))));
    return a1 / a2;
  }
  const z = 8 / ax, y = z * z, xx = ax - 2.356194491;
  const a1 = 1.0 + y * (0.183105e-2 + y * (-0.3516396496e-4 + y * (0.2457520174e-5 + y * (-0.240337019e-6))));
  const a2 = 0.04687499995 + y * (-0.2002690873e-3 + y * (0.8449199096e-5 + y * (-0.88228987e-6 + y * 0.105787412e-6)));
  const ans = Math.sqrt(0.636619772 / ax) * (Math.cos(xx) * a1 - z * Math.sin(xx) * a2);
  return x < 0 ? -ans : ans;
}
/** normalised Airy intensity for x = π D sin θ / λ */
const airy = (x: number) => (Math.abs(x) < 1e-6 ? 1 : (2 * J1(x) / x) ** 2);
/** small seeded PRNG */
function mulberry(seed: number) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const gaussRand = (rnd: () => number) => Math.sqrt(-2 * Math.log(rnd() + 1e-12)) * Math.cos(TAU * rnd());
const fmtAngle = (as: number) => (as < 1e-3 ? `${fmt(as * 1e6, 0)} µas` : as < 1 ? `${fmt(as * 1e3, as < 0.01 ? 1 : 0)} mas` : as < 60 ? `${fmt(as, as < 10 ? 2 : 1)}″` : as < 3600 ? `${fmt(as / 60, 1)}′` : `${fmt(as / 3600, 2)}°`);
const fmtLen = (m: number) => (m < 1e-3 ? `${fmt(m * 1e6, 0)} µm` : m < 1e-2 ? `${fmt(m * 1e3, 1)} mm` : m < 1 ? `${fmt(m * 100, 0)} cm` : m < 1e3 ? `${fmt(m, m < 10 ? 1 : 0)} m` : `${fmt(m / 1e3, 0)} km`);
const fmtYr = (y: number) => (y >= 1e9 ? `${fmt(y / 1e9, 2)} Gyr` : y >= 1e6 ? `${fmt(y / 1e6, 1)} Myr` : y >= 1e3 ? `${fmt(y / 1e3, 1)} kyr` : `${fmt(y, 0)} yr`);
const fmtDur = (s: number) => (s < 1 ? `${fmt(s * 1e3, 0)} ms` : s < 60 ? `${fmt(s, 1)} s` : s < 3600 ? `${fmt(s / 60, 1)} min` : s < 86400 ? `${fmt(s / 3600, 1)} h` : s < 86400 * 365 ? `${fmt(s / 86400, 1)} d` : `${fmt(s / 86400 / 365.25, 1)} yr`);
const SCOPES: Array<[string, number, string]> = [
  ['eye', 0.007, 'dark-adapted pupil'], ['Galileo 1609', 0.037, 'refractor, 20×'], ['20 cm amateur', 0.2, 'Schmidt–Cassegrain'], ['Yerkes 1897', 1.02, 'largest refractor'], ['Herschel 1789', 1.2, 'speculum reflector'],
  ['Hubble', 2.4, 'in orbit since 1990'], ['Hale 1948', 5.08, 'Palomar'], ['JWST', 6.5, 'at L₂, infrared'], ['VLT (one)', 8.2, 'Paranal'], ['Keck', 10, 'segmented, 1993'], ['GMT', 25.4, 'seven 8.4 m mirrors'], ['ELT', 39.3, '798 segments'],
];

/* ------------------------------------------------- 45. light bucket ---- */

class LightBucketWidget extends CanvasWidget {
  private lgD = Math.log10(0.2); private lgT = 0; private stars: Array<{ x: number; y: number; m: number }> = []; private noise: Float32Array; private img: ImageData | null = null; private readonly NX = 150; private readonly NY = 96;
  private sD!: { set: (v: number) => void };
  constructor() {
    super(480 / 300);
    const rnd = mulberry(7); for (let i = 0; i < 140; i++) this.stars.push({ x: rnd(), y: rnd(), m: 4 + 27 * Math.sqrt(rnd()) });
    this.noise = new Float32Array(this.NX * this.NY); for (let i = 0; i < this.noise.length; i++) this.noise[i] = gaussRand(rnd);
    this.segmented<string>(SCOPES.filter(([n]) => ['eye', '20 cm amateur', 'Hubble', 'Keck', 'ELT'].includes(n)).map(([n]) => [n, n] as [string, string]), '20 cm amateur', (n) => { this.lgD = Math.log10(SCOPES.find(([k]) => k === n)![1]); this.sD.set(this.lgD); });
    this.sD = this.slider('Aperture D', Math.log10(0.007), Math.log10(40), 0.01, this.lgD, (v) => fmtLen(10 ** v), (v) => { this.lgD = v; });
    this.slider('Exposure', -1, Math.log10(36000), 0.01, 0, (v) => fmtDur(10 ** v), (v) => { this.lgT = v; });
  }
  protected draw() {
    const c = this.ctx; c.fillStyle = C.bg; c.fillRect(0, 0, this.w, this.h);
    const D = 10 ** this.lgD, t = 10 ** this.lgT, A = Math.PI * D * D / 4;
    const N0 = 1e10;                              // photons s⁻¹ m⁻² from an m = 0 star (visible band, rough)
    const sky = N0 * 10 ** (-0.4 * 21) * A * t;   // sky photons in a 1″² seeing disc at 21 mag/arcsec²
    const read = 25;                              // read noise² (electrons²)
    const snr = (m: number) => { const n = N0 * 10 ** (-0.4 * m) * A * t; return n / Math.sqrt(n + sky + read); };
    let lo = 0, hi = 40; for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (snr(mid) > 5) lo = mid; else hi = mid; }
    const mlim = lo;
    const px = Math.min(this.w - 16, (this.h - 16) * this.NX / this.NY), py = px * this.NY / this.NX, x0 = 8, y0 = (this.h - py) / 2;
    if (!this.img) this.img = c.createImageData(this.NX, this.NY);
    const d = this.img.data; const sig = 1 / Math.sqrt(sky + read); const stretch = 12;
    for (let i = 0; i < this.NX * this.NY; i++) { const v = 0.5 + stretch * this.noise[i] * sig * Math.sqrt(sky + read) / Math.sqrt(sky + read) * 0.04; const g = Math.max(0, Math.min(255, (12 + v * 40))); d[i * 4] = g * 0.95; d[i * 4 + 1] = g; d[i * 4 + 2] = g * 1.08; d[i * 4 + 3] = 255; }
    c.putImageData(this.img, 0, 0, 0, 0, 0, 0);
    const off = document.createElement('canvas'); off.width = this.NX; off.height = this.NY; off.getContext('2d')!.putImageData(this.img, 0, 0);
    c.imageSmoothingEnabled = false; c.drawImage(off, x0, y0, px, py); c.imageSmoothingEnabled = true;
    let nvis = 0;
    for (const s of this.stars) { const q = snr(s.m); if (q < 1) continue; const b = Math.min(1, Math.log10(q) / 3.5); const r = 1 + 6 * Math.max(0, Math.log10(q) - 0.7) / 3; if (q >= 5) nvis++; this.glow(x0 + s.x * px, y0 + s.y * py, Math.max(1.5, r * 2), `rgba(255,250,235,${0.25 + 0.75 * b})`); if (q >= 5) this.circle(x0 + s.x * px, y0 + s.y * py, Math.max(0.8, r * 0.6), undefined, `rgba(255,255,255,${0.5 + 0.5 * b})`); }
    c.strokeStyle = C.line; c.strokeRect(x0, y0, px, py);
    this.text(`${nvis} of ${this.stars.length} stars above 5σ`, x0 + 6, y0 + py - 10, C.text, 9);
    this.text(`faintest star drawn: m = ${fmt(Math.min(mlim, 31), 1)}`, x0 + px - 6, y0 + py - 10, C.dim, 9, 'right');
    const grasp = (D / 0.007) ** 2;
    this.setReadout([
      ['Collecting area  πD²/4', `${A < 1 ? fmt(A * 1e4, 1) + ' cm²' : fmt(A, 1) + ' m²'}`, C.accent],
      ['Light grasp vs the eye', `${grasp < 1e4 ? fmt(grasp, 0) : sci(grasp, 1)}×  (${fmt(2.5 * Math.log10(grasp), 1)} mag)`],
      ['Photons from an m = 20 star', `${sci(N0 * 1e-8 * A, 1)} /s  ·  ${sci(N0 * 1e-8 * A * t, 1)} in the exposure`],
      ['Limiting magnitude (5σ)', `m ≈ ${fmt(mlim, 1)}`, C.green],
    ]);
  }
}

/* ------------------------------------------------- 46. Snell's law ---- */

const MEDIA: Record<string, [number, number, string]> = { air: [1.000277, 0, 'air'], water: [1.3199, 3100, 'water'], crown: [1.5046, 4200, 'crown glass'], flint: [1.6, 9000, 'flint glass'], diamond: [2.3818, 12100, 'diamond'] };
const nOf = (m: string, nm: number) => MEDIA[m][0] + MEDIA[m][1] / (nm * nm);

class SnellWidget extends CanvasWidget {
  private pair: [string, string] = ['air', 'crown']; private th1 = 40 * DEG; private nm = 550; private dragging = false;
  constructor() {
    super(480 / 300);
    this.segmented<string>([['air→water', 'air → water'], ['air→crown', 'air → crown glass'], ['air→diamond', 'air → diamond'], ['crown→air', 'glass → air'], ['water→air', 'water → air']], 'air→crown', (v) => { this.pair = v.split('→') as [string, string]; });
    this.slider('Wavelength', 400, 700, 1, 550, (v) => `${v} nm`, (v) => { this.nm = v; });
    const set = (e: PointerEvent) => { const { x, y } = canvasPos(this.canvas, e, this.w, this.h); const cx = this.w * 0.5, cy = this.h * 0.5; const dx = x - cx, dy = cy - y; if (dy <= 2) return; this.th1 = Math.max(0.5 * DEG, Math.min(89.5 * DEG, Math.atan2(Math.abs(dx), dy))); if (dx > 0) this.flip = -1; else this.flip = 1; };
    this.canvas.addEventListener('pointerdown', (e) => { this.dragging = true; this.canvas.setPointerCapture(e.pointerId); set(e); });
    this.canvas.addEventListener('pointermove', (e) => { if (this.dragging) set(e); });
    this.canvas.addEventListener('pointerup', () => { this.dragging = false; });
    this.canvas.style.touchAction = 'none'; this.canvas.style.cursor = 'grab';
    this.controls.appendChild($('div', 'lw-caption', 'Drag in the upper medium to aim the incident ray.'));
  }
  private flip = 1;
  protected draw() {
    const c = this.ctx; const cx = this.w / 2, cy = this.h / 2, L = Math.min(this.w, this.h) * 0.46;
    const n1 = nOf(this.pair[0], this.nm), n2 = nOf(this.pair[1], this.nm);
    const col = rgba(waveRGB(this.nm));
    c.fillStyle = hexA(C.blue, 0.03 + 0.06 * (n1 - 1)); c.fillRect(0, 0, this.w, cy); c.fillStyle = hexA(C.blue, 0.03 + 0.06 * (n2 - 1)); c.fillRect(0, cy, this.w, cy);
    this.line(0, cy, this.w, cy, C.line, 1.2); this.line(cx, cy - L, cx, cy + L, C.faint, 1, [4, 4]);
    this.text(`${MEDIA[this.pair[0]][2]}   n₁ = ${fmt(n1, 4)}`, 10, 14, C.text, 10); this.text(`${MEDIA[this.pair[1]][2]}   n₂ = ${fmt(n2, 4)}`, 10, this.h - 12, C.text, 10);
    const s = this.flip, th1 = this.th1;
    const ix = cx - s * L * Math.sin(th1), iy = cy - L * Math.cos(th1);
    // incident
    this.line(ix, iy, cx, cy, col, 2.2); const ux = (cx - ix) / L, uy = (cy - iy) / L; this.arrow(cx - ux * 30, cy - uy * 30, col);
    // reflected (Fresnel, unpolarised)
    const sinT2 = n1 / n2 * Math.sin(th1); const tir = sinT2 > 1;
    let R = 1;
    if (!tir) { const th2 = Math.asin(sinT2); const rs = (n1 * Math.cos(th1) - n2 * Math.cos(th2)) / (n1 * Math.cos(th1) + n2 * Math.cos(th2)); const rp = (n2 * Math.cos(th1) - n1 * Math.cos(th2)) / (n2 * Math.cos(th1) + n1 * Math.cos(th2)); R = (rs * rs + rp * rp) / 2; }
    const rx = cx + s * L * Math.sin(th1), ry = cy - L * Math.cos(th1);
    this.line(cx, cy, rx, ry, rgba(waveRGB(this.nm), Math.max(0.12, R)), tir ? 2.2 : 1.2);
    this.text(`reflected  ${fmt(R * 100, R < 0.1 ? 1 : 0)} %`, rx + s * 6, ry + 10, C.dim, 8, s > 0 ? 'left' : 'right');
    if (!tir) { const th2 = Math.asin(sinT2); const tx = cx + s * L * Math.sin(th2), ty = cy + L * Math.cos(th2); this.line(cx, cy, tx, ty, rgba(waveRGB(this.nm), Math.max(0.2, 1 - R)), 2.2); this.text(`refracted  θ₂ = ${fmt(th2 / DEG, 1)}°`, tx + s * 6, ty - 8, col, 9, s > 0 ? 'left' : 'right'); this.arc(cx, cy, 34, Math.PI / 2, Math.PI / 2 + s * th2 * -1, col); }
    else this.text('total internal reflection', cx, cy + 24, C.red, 10, 'center');
    this.arc(cx, cy, 28, -Math.PI / 2, -Math.PI / 2 - s * th1, col);
    this.text(`θ₁ = ${fmt(th1 / DEG, 1)}°`, cx - s * 40, cy - 40, col, 9, s > 0 ? 'right' : 'left');
    const thc = n1 > n2 ? Math.asin(n2 / n1) : NaN;
    if (!Number.isNaN(thc)) { const kx = cx - s * L * Math.sin(thc), ky = cy - L * Math.cos(thc); this.line(kx, ky, cx, cy, hexA(C.red, 0.5), 1, [3, 3]); this.text(`critical ${fmt(thc / DEG, 1)}°`, kx, ky - 8, C.red, 8, 'center'); }
    this.setReadout([
      ['Snell  n₁ sin θ₁ = n₂ sin θ₂', `${fmt(n1 * Math.sin(th1), 4)} = ${tir ? 'no solution' : fmt(n2 * Math.sin(Math.asin(sinT2)), 4)}`, tir ? C.red : C.accent],
      ['Speed of light in medium 2', `c / ${fmt(n2, 3)} = ${sci(C_LIGHT / n2, 3)} m/s`],
      ['Critical angle  sin θc = n₂/n₁', Number.isNaN(thc) ? 'none (into denser medium)' : `${fmt(thc / DEG, 1)}°`],
      ['Dispersion n(400) − n(700)', `${fmt(nOf(this.pair[1], 400) - nOf(this.pair[1], 700), 4)} for ${MEDIA[this.pair[1]][2]}`],
    ]);
  }
  private arrow(x: number, y: number, col: string) { this.circle(x, y, 2.5, undefined, col); }
  private arc(x: number, y: number, r: number, a0: number, a1: number, col: string) { const c = this.ctx; c.beginPath(); c.arc(x, y, r, Math.min(a0, a1), Math.max(a0, a1)); c.strokeStyle = col; c.lineWidth = 1; c.stroke(); }
}

/* ------------------------------------------------- 47. thin lens / mirror ---- */

class LensWidget extends CanvasWidget {
  private mode: 'lens' | 'mirror' = 'lens'; private p = 2.2; private f = 1;
  constructor() {
    super(480 / 240);
    this.segmented<'lens' | 'mirror'>([['lens', 'converging lens'], ['mirror', 'concave mirror']], 'lens', (v) => { this.mode = v; });
    this.slider('Object distance p / f', 0.3, 4.5, 0.01, 2.2, (v) => `${fmt(v, 2)} f`, (v) => { this.p = v; });
  }
  protected draw() {
    const c = this.ctx; c.fillStyle = C.bg; c.fillRect(0, 0, this.w, this.h);
    const fpx = this.w * 0.13, ax = this.h * 0.56; const ox = this.mode === 'lens' ? this.w * 0.55 : this.w * 0.86; // optic position
    const q = 1 / (1 / this.f - 1 / this.p); const m = -q / this.p; const hO = this.h * 0.22;
    const dir = this.mode === 'lens' ? 1 : -1;                          // image side direction
    const px = ox - this.p * fpx, qx = ox + dir * q * fpx;
    this.line(0, ax, this.w, ax, C.line);
    for (const k of [-2, -1, 1, 2]) { const x = ox - k * fpx * (this.mode === 'lens' ? 1 : 1); if (x > 4 && x < this.w - 4) { this.line(x, ax - 4, x, ax + 4, C.dim); this.text(Math.abs(k) === 1 ? (k > 0 ? 'F' : 'F′') : (k > 0 ? '2F' : '2F′'), x, ax + 12, C.dim, 8, 'center'); } }
    if (this.mode === 'lens') { c.beginPath(); c.ellipse(ox, ax, 7, this.h * 0.34, 0, 0, TAU); c.fillStyle = hexA(C.blue, 0.18); c.fill(); c.strokeStyle = C.blue; c.stroke(); }
    else { c.beginPath(); const R = 2 * fpx; for (let y = -this.h * 0.34; y <= this.h * 0.34; y += 2) { const x = ox - (R - Math.sqrt(Math.max(0, R * R - y * y))); y === -this.h * 0.34 ? c.moveTo(x, ax + y) : c.lineTo(x, ax + y); } c.strokeStyle = C.blue; c.lineWidth = 3; c.stroke(); c.lineWidth = 1; }
    // object
    this.arrowV(px, ax, -hO, C.sun); this.text('object', px, ax - hO - 10, C.sun, 9, 'center');
    const hI = hO * m;                       // signed image height (negative = inverted)
    const real = q > 0;
    // rays from object tip
    const tipY = ax - hO; const F2 = ox + dir * fpx, F1 = ox - fpx;
    // each ray: start, point where it meets the optic, outgoing direction
    const y3 = ax - hO * (F1 - ox) / (F1 - px);
    const rays: Array<[number, number, number, number, string]> = [
      [ox, tipY, F2 - ox, ax - tipY, C.red],                                   // parallel in → through F
      [ox, ax, this.mode === 'lens' ? ox - px : -(ox - px), ax - tipY, C.green],  // through centre / off the vertex
      [ox, y3, dir, 0, C.purple],                                             // through F in → parallel out
    ];
    for (const [x1, y1, dx0, dy0, col] of rays) {
      this.line(px, tipY, x1, y1, col, 1.2);
      const L = Math.hypot(dx0, dy0) || 1, dx = dx0 / L, dy = dy0 / L, far = this.w;
      this.line(x1, y1, x1 + dx * far, y1 + dy * far, col, 1.2);
      if (!real) this.line(x1, y1, x1 - dx * far, y1 - dy * far, hexA(col, 0.45), 1, [3, 4]);
    }
    if (Math.abs(qx) < this.w * 3) { this.arrowV(qx, ax, -hI, real ? C.text : hexA(C.text, 0.6), !real); this.text(real ? 'real image' : 'virtual image', qx, hI < 0 ? ax - hI + 12 : ax - hI - 10, C.text, 9, 'center'); }
    this.setReadout([
      ['1/p + 1/q = 1/f', `1/${fmt(this.p, 2)} + 1/${fmt(q, 2)} = 1`, C.accent],
      ['Image distance q', `${fmt(Math.abs(q), 2)} f  ${real ? '(opposite side: real)' : '(same side: virtual)'}`, real ? C.green : C.purple],
      ['Magnification m = −q/p', `${fmt(m, 2)}  (${Math.abs(m) >= 1 ? 'enlarged' : 'reduced'}, ${m < 0 ? 'inverted' : 'upright'})`],
      ['Use', this.p > 2 ? 'telescope objective (image near F)' : this.p > 1 ? 'projector (enlarged, beyond 2F)' : 'magnifier / eyepiece (object inside F)'],
    ]);
  }
  private arrowV(x: number, y: number, dy: number, col: string, dashed = false) { const c = this.ctx; c.setLineDash(dashed ? [3, 3] : []); this.line(x, y, x, y + dy, col, 2); c.setLineDash([]); c.beginPath(); const s = Math.sign(dy) || 1; c.moveTo(x, y + dy); c.lineTo(x - 4, y + dy - s * 7); c.lineTo(x + 4, y + dy - s * 7); c.closePath(); c.fillStyle = col; c.fill(); }
}

/* ------------------------------------------------- 48. Airy pattern & Rayleigh ---- */

class AiryWidget extends CanvasWidget {
  private lgD = Math.log10(0.2); private nm = 550; private lgSep = Math.log10(1); private img: ImageData | null = null; private readonly N = 110;
  constructor() {
    super(480 / 250);
    this.slider('Aperture D', Math.log10(0.007), Math.log10(40), 0.01, this.lgD, (v) => fmtLen(10 ** v), (v) => { this.lgD = v; });
    this.slider('λ', 350, 2500, 10, 550, (v) => `${v} nm`, (v) => { this.nm = v; });
    this.slider('Star separation', -3, Math.log10(30), 0.01, this.lgSep, (v) => fmtAngle(10 ** v), (v) => { this.lgSep = v; });
  }
  protected draw() {
    const c = this.ctx; c.fillStyle = C.bg; c.fillRect(0, 0, this.w, this.h);
    const D = 10 ** this.lgD, lam = this.nm * 1e-9, sep = 10 ** this.lgSep * ARCSEC, thR = 1.22 * lam / D;
    const half = Math.max(2.6 * thR, 0.8 * sep + 1.5 * thR);
    const N = this.N; if (!this.img) this.img = c.createImageData(N, N); const d = this.img.data;
    const k = Math.PI * D / lam; const s1 = -sep / 2, s2 = sep / 2;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const tx = (i / (N - 1) - 0.5) * 2 * half, ty = (j / (N - 1) - 0.5) * 2 * half; const I = airy(k * Math.hypot(tx - s1, ty)) + airy(k * Math.hypot(tx - s2, ty)); const v = Math.pow(Math.min(1, I / 1.0), 0.45); const o = (j * N + i) * 4; d[o] = 255 * v; d[o + 1] = 245 * v; d[o + 2] = 225 * v; d[o + 3] = 255; }
    const size = Math.min(this.h - 16, this.w * 0.46), x0 = 8, y0 = (this.h - size) / 2;
    const off = document.createElement('canvas'); off.width = N; off.height = N; off.getContext('2d')!.putImageData(this.img, 0, 0); c.drawImage(off, x0, y0, size, size); c.strokeStyle = C.line; c.strokeRect(x0, y0, size, size);
    this.text(`field ${fmtAngle(2 * half / ARCSEC)} across`, x0 + 6, y0 + size - 10, C.dim, 8);
    const sx0 = x0 + size + 20, sx1 = this.w - 12, gy0 = 24, gy1 = this.h - 36;
    this.line(sx0, gy1, sx1, gy1, C.line); this.text('intensity along the line joining the stars', sx0, 12, C.dim, 8);
    let peakMid = 0, peakMax = 0; c.beginPath();
    for (let i = 0; i <= 200; i++) { const tx = (i / 200 - 0.5) * 2 * half; const I = airy(k * Math.abs(tx - s1)) + airy(k * Math.abs(tx - s2)); peakMax = Math.max(peakMax, I); if (Math.abs(tx) < half / 200) peakMid = I; const x = sx0 + i / 200 * (sx1 - sx0), y = gy1 - I / 2 * (gy1 - gy0) * 0.98; i ? c.lineTo(x, y) : c.moveTo(x, y); }
    c.strokeStyle = C.sun; c.lineWidth = 1.5; c.stroke();
    for (const s of [s1, s2]) { const x = sx0 + (s / half / 2 + 0.5) * (sx1 - sx0); this.line(x, gy1, x, gy1 + 5, C.dim); }
    const xr0 = sx0 + (0.5 - thR / half / 2) * (sx1 - sx0), xr1 = sx0 + (0.5 + thR / half / 2) * (sx1 - sx0);
    this.line(xr0, gy1 + 14, xr1, gy1 + 14, C.accent); this.text(`1.22 λ/D = ${fmtAngle(thR / ARCSEC)}`, (xr0 + xr1) / 2, gy1 + 24, C.accent, 8, 'center');
    const ratio = sep / thR; const verdict = ratio >= 1 ? 'resolved (Rayleigh)' : ratio >= 0.77 ? 'barely — a dip is just visible' : ratio >= 0.5 ? 'elongated blob, no dip' : 'single point';
    const dip = peakMax > 0 ? peakMid / peakMax : 1;
    this.setReadout([
      ['Rayleigh limit θ = 1.22 λ/D', fmtAngle(thR / ARCSEC), C.accent],
      ['Separation / θ', `${fmt(ratio, 2)}  →  ${verdict}`, ratio >= 1 ? C.green : ratio >= 0.77 ? C.sun : C.red],
      ['Central dip', ratio >= 0.77 ? `${fmt((1 - dip) * 100, 0)} % below the peaks` : 'none'],
      ['Airy disc on a detector', `${fmtLen(2.44 * lam * 15)} for f/15  ·  ${fmtLen(2.44 * lam * 2)} for f/2`],
    ]);
  }
}

/* ------------------------------------------------- 49. seeing & adaptive optics ---- */

class SeeingWidget extends CanvasWidget {
  private seeing = 1.0; private lgD = Math.log10(4); private nm = 550; private mode: 'short' | 'long' = 'long'; private ao = false; private t = 0; private speck: Array<[number, number]> = []; private nextSpeck = 0; private img: ImageData | null = null; private readonly N = 100;
  constructor() {
    super(480 / 250);
    this.segmented<'short' | 'long'>([['short', 'short exposure (10 ms)'], ['long', 'long exposure']], 'long', (v) => { this.mode = v; });
    this.segmented<'off' | 'on'>([['off', 'adaptive optics off'], ['on', 'AO on']], 'off', (v) => { this.ao = v === 'on'; });
    this.slider('Seeing (FWHM)', 0.3, 3, 0.05, 1, (v) => `${fmt(v, 2)}″`, (v) => { this.seeing = v; });
    this.slider('Aperture D', -1, 1.6, 0.01, this.lgD, (v) => fmtLen(10 ** v), (v) => { this.lgD = v; });
    this.slider('Wavelength', 400, 2200, 10, 550, (v) => `${v} nm`, (v) => { this.nm = v; });
  }
  protected draw(dt: number) {
    this.t += dt;
    const c = this.ctx; c.fillStyle = C.bg; c.fillRect(0, 0, this.w, this.h);
    const D = 10 ** this.lgD, lam = this.nm * 1e-9, see = this.seeing * ARCSEC, thR = 1.22 * lam / D;
    const r0 = 0.98 * lam / see; const nSp = Math.max(1, Math.round((D / r0) ** 2));
    const strehl = this.ao ? Math.min(0.9, 0.25 + 0.65 * Math.min(1, (lam / 550e-9 - 0.5) / 3.5)) : (D < r0 ? 1 : (r0 / D) ** 2 * 0.9);
    const half = Math.max(2.2 * see, 3 * thR); const N = this.N; if (!this.img) this.img = c.createImageData(N, N); const d = this.img.data;
    const sig = see / 2.355; const k = Math.PI * D / lam;
    if (this.t >= this.nextSpeck) { this.nextSpeck = this.t + 0.09; const rnd = Math.random; this.speck = []; for (let i = 0; i < Math.min(nSp, 400); i++) this.speck.push([gaussRand(rnd) * sig, gaussRand(rnd) * sig]); }
    const ao = this.ao; const raw = new Float32Array(N * N); let peak = 1e-12;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const tx = (i / (N - 1) - 0.5) * 2 * half, ty = (j / (N - 1) - 0.5) * 2 * half; let I = 0;
      if (ao) { I = strehl * airy(k * Math.hypot(tx, ty)) + (1 - strehl) * Math.exp(-(tx * tx + ty * ty) / (2 * sig * sig)) * Math.min(1, (thR / sig) ** 2 * 0.3 + 0.08); }
      else if (this.mode === 'long' || D <= r0 * 1.2) { const s2 = sig * sig + (thR / 2.355) ** 2 * 1.4; I = Math.exp(-(tx * tx + ty * ty) / (2 * s2)); }
      else { for (const [sx, sy] of this.speck) I += airy(k * Math.hypot(tx - sx, ty - sy)); }
      raw[j * N + i] = I; if (I > peak) peak = I;
    }
    for (let o = 0; o < N * N; o++) { const v = Math.sqrt(Math.min(1, raw[o] / peak)); d[o * 4] = 255 * v; d[o * 4 + 1] = 245 * v; d[o * 4 + 2] = 225 * v; d[o * 4 + 3] = 255; }
    const size = Math.min(this.h - 16, this.w * 0.46), x0 = 8, y0 = (this.h - size) / 2;
    const off = document.createElement('canvas'); off.width = N; off.height = N; off.getContext('2d')!.putImageData(this.img, 0, 0); c.drawImage(off, x0, y0, size, size); c.strokeStyle = C.line; c.strokeRect(x0, y0, size, size);
    this.text(`${fmtAngle(2 * half / ARCSEC)} across`, x0 + 6, y0 + size - 10, C.dim, 8);
    const bx0 = x0 + size + 22, bx1 = this.w - 14, by = 40;
    const rows: Array<[string, number, string]> = [['diffraction limit 1.22 λ/D', thR, C.accent], ['seeing disc', see, C.red], ['delivered FWHM', ao ? Math.max(thR, see * Math.sqrt(1 - strehl) * 0.5) : Math.sqrt(see * see + thR * thR), ao ? C.green : C.sun]];
    const maxA = Math.max(see, thR) * 1.1; this.text('angular size (log scale)', bx0, by - 20, C.dim, 8);
    rows.forEach(([lab, v, col], i) => { const y = by + i * 36; const frac = Math.max(0.02, (Math.log10(v / ARCSEC) + 3) / (Math.log10(maxA / ARCSEC) + 3)); c.fillStyle = hexA(col, 0.8); c.fillRect(bx0, y, (bx1 - bx0) * Math.min(1, frac), 10); this.text(`${lab}: ${fmtAngle(v / ARCSEC)}`, bx0, y - 7, col, 8); });
    this.text(`r₀ = ${fmtLen(r0)}  →  D/r₀ = ${fmt(D / r0, 1)}  →  ~${nSp > 1e4 ? sci(nSp, 1) : nSp} speckles`, bx0, by + 118, C.text, 9);
    this.text(ao ? `AO corrects ~${Math.min(nSp, 5000)} modes; Strehl ≈ ${fmt(strehl, 2)}` : D > r0 ? 'bigger D only collects more light into the same blur' : 'small aperture: diffraction-limited even through turbulence', bx0, by + 134, C.dim, 8);
    this.setReadout([
      ['Fried parameter r₀ ∝ λ^(6/5)', `${fmtLen(r0)} at ${this.nm} nm`, C.accent],
      ['Image FWHM', fmtAngle(rows[2][1] / ARCSEC), rows[2][2]],
      ['Strehl ratio', fmt(strehl, strehl < 0.1 ? 3 : 2), strehl > 0.3 ? C.green : C.red],
      ['Limited by', ao ? 'residual AO error' : D > r0 ? 'the atmosphere (seeing)' : 'diffraction'],
    ]);
  }
}

/* ------------------------------------------------- 50. chromatic aberration ---- */

class ChromaticWidget extends CanvasWidget {
  private design: 'single' | 'achromat' | 'apo' = 'single'; private focusAt = 1.0; private V = 60;
  constructor() {
    super(480 / 230);
    this.segmented<'single' | 'achromat' | 'apo'>([['single', 'single lens'], ['achromat', 'achromatic doublet'], ['apo', 'apochromat (3 glasses)']], 'single', (v) => { this.design = v; });
    this.slider('Abbe number V', 30, 90, 1, 60, (v) => `${v}`, (v) => { this.V = v; });
    this.slider('Focal plane', 0.96, 1.04, 0.0005, 1.0, (v) => `${fmt((v - 1) * 1000, 1)} ‰`, (v) => { this.focusAt = v; });
  }
  private focal(nm: number) { const f0 = 1; const dev = (550 - nm) / 300; if (this.design === 'single') return f0 * (1 - dev * 1.6 / this.V * 1.0); if (this.design === 'achromat') return f0 * (1 + 0.012 * ((nm - 560) / 300) ** 2 * 60 / this.V); return f0 * (1 + 0.0012 * ((nm - 560) / 300) ** 2); }
  protected draw() {
    const c = this.ctx; c.fillStyle = C.bg; c.fillRect(0, 0, this.w, this.h);
    const ax = this.h * 0.5, lx = this.w * 0.16, fpx = this.w * 0.62, hA = this.h * 0.3;
    this.line(0, ax, this.w, ax, C.grid);
    c.beginPath(); c.ellipse(lx, ax, 6, hA + 6, 0, 0, TAU); c.fillStyle = hexA(C.blue, 0.18); c.fill(); c.strokeStyle = C.blue; c.stroke();
    if (this.design !== 'single') { c.beginPath(); c.ellipse(lx + 9, ax, 3, hA + 6, 0, 0, TAU); c.fillStyle = hexA(C.purple, 0.18); c.fill(); c.strokeStyle = C.purple; c.stroke(); }
    if (this.design === 'apo') { c.beginPath(); c.ellipse(lx + 16, ax, 2.5, hA + 6, 0, 0, TAU); c.fillStyle = hexA(C.green, 0.18); c.fill(); c.strokeStyle = C.green; c.stroke(); }
    const waves = [440, 550, 650]; const fs = waves.map((nm) => this.focal(nm));
    const fpX = lx + fpx * this.focusAt; this.line(fpX, ax - hA - 14, fpX, ax + hA + 14, C.text, 1, [4, 3]); this.text('focal plane', fpX, ax + hA + 22, C.text, 8, 'center');
    const blur: number[] = [];
    waves.forEach((nm, i) => { const col = rgba(waveRGB(nm), 0.85); const fx = lx + fpx * fs[i]; for (const h of [-hA, -hA / 2, hA / 2, hA]) { this.line(0, ax + h, lx, ax + h, col, 1); const slope = -h / (fx - lx); const xe = this.w; this.line(lx, ax + h, xe, ax + h + slope * (xe - lx), col, 1); } this.line(fx, ax - 5, fx, ax + 5, col, 2); blur.push(Math.abs(2 * hA * (fpX - fx) / (fx - lx))); });
    // zoom inset of focal region
    const ix = this.w * 0.78, iy = 10, iw = this.w * 0.2, ih = this.h * 0.42; c.fillStyle = '#10141b'; c.fillRect(ix, iy, iw, ih); c.strokeStyle = C.line; c.strokeRect(ix, iy, iw, ih);
    this.text('blur spots at the focal plane', ix + iw / 2, iy + 10, C.dim, 7, 'center');
    waves.forEach((nm, i) => { const r = Math.max(1.2, Math.min(ih * 0.4, blur[i] * 6)); const cy = iy + ih * 0.6; this.circle(ix + iw / 2, cy, r, rgba(waveRGB(nm), 0.9), rgba(waveRGB(nm), 0.18)); });
    const spread = (Math.max(...fs) - Math.min(...fs));
    const blurF = fs.map((f) => 0.6 * Math.abs(this.focusAt - f) / f);
    this.setReadout([
      ['f (blue / green / red), f₅₅₀ = 1000', `${fmt(fs[0] * 1000, 1)} / ${fmt(fs[1] * 1000, 1)} / ${fmt(fs[2] * 1000, 1)}`, C.accent],
      ['Longitudinal colour spread', `${fmt(spread * 1000, 2)} ‰ of f ≈ f/${fmt(1 / Math.max(spread, 1e-5), 0)}`, spread > 5e-3 ? C.red : spread > 5e-4 ? C.sun : C.green],
      ['Blur spot (D = 0.6 f), ‰ of f', `b ${fmt(blurF[0] * 1000, 1)} · g ${fmt(blurF[1] * 1000, 1)} · r ${fmt(blurF[2] * 1000, 1)}`],
      ['Design', this.design === 'single' ? 'one glass: blue focuses short' : this.design === 'achromat' ? 'crown + flint: 2 colours united' : 'fluorite / ED triplet: 3 colours united'],
    ]);
  }
}

/* ------------------------------------------------- 51. reflector designs ---- */

type Design = 'prime' | 'newton' | 'cass' | 'greg' | 'schmidt' | 'nasmyth';
class DesignsWidget extends CanvasWidget {
  private design: Design = 'newton'; private t = 0; private F = 3;
  constructor() {
    super(480 / 230);
    this.segmented<Design>([['prime', 'prime focus'], ['newton', 'Newtonian'], ['cass', 'Cassegrain'], ['greg', 'Gregorian'], ['nasmyth', 'Nasmyth'], ['schmidt', 'Schmidt camera']], 'newton', (v) => { this.design = v; });
    this.slider('Primary f-ratio', 1.2, 6, 0.1, 3, (v) => `f/${fmt(v, 1)}`, (v) => { this.F = v; });
    this.playButton();
  }
  protected draw(dt: number) {
    this.t += dt;
    const c = this.ctx; c.fillStyle = C.bg; c.fillRect(0, 0, this.w, this.h);
    const ax = this.h * 0.5, Dpx = this.h * 0.62, R = Dpx / 2, fpx = Dpx * this.F;
    const sch = this.design === 'schmidt';
    const mx = sch ? this.w * 0.86 : Math.min(this.w * 0.9, this.w * 0.22 + fpx * (this.design === 'cass' || this.design === 'nasmyth' ? 0.75 : this.design === 'greg' ? 1.0 : 1.05)); // primary vertex x
    const scale = Math.min(1, (this.w - 30) / (fpx * (sch ? 1.4 : 1.1) + 40)); const f = fpx * scale, rr = R;
    const vx = sch ? this.w - 24 : Math.min(this.w - 24, 30 + f * (this.design === 'cass' || this.design === 'nasmyth' ? 0.72 : this.design === 'greg' ? 1.3 : 1.05));
    void mx;
    // primary mirror
    c.beginPath(); for (let y = -rr; y <= rr; y += 2) { const x = sch ? vx - (2 * f - Math.sqrt(Math.max(0, 4 * f * f - y * y))) : vx - y * y / (4 * f); y === -rr ? c.moveTo(x, ax + y) : c.lineTo(x, ax + y); } c.strokeStyle = C.blue; c.lineWidth = 3; c.stroke(); c.lineWidth = 1;
    const hole = this.design === 'cass' || this.design === 'greg'; if (hole) { c.fillStyle = C.bg; c.fillRect(vx - 6, ax - rr * 0.16, 12, rr * 0.32); }
    const Fx = vx - f;                                     // prime focus
    const heights = [-0.9, -0.6, -0.3, 0.3, 0.6, 0.9].map((k) => k * rr);
    const paths: number[][][] = [];
    for (const h of heights) {
      const hitX = sch ? vx - (2 * f - Math.sqrt(4 * f * f - h * h)) : vx - h * h / (4 * f);
      const pts: number[][] = [[0, ax + h], [hitX, ax + h]];
      if (this.design === 'prime') pts.push([Fx, ax], [Fx - 18, ax + (ax + h - ax) * -18 / (hitX - Fx)]);
      else if (this.design === 'newton') { const dx = Fx - hitX, dy = -h; const L = Math.hypot(dx, dy); const flatX = Fx + rr * 0.55; const tt = (flatX - hitX) / dx; const px = hitX + dx * tt, py = ax + h + dy * tt; const ux = dx / L, uy = dy / L; const nx = Math.SQRT1_2, ny = -Math.SQRT1_2; const dot = ux * nx + uy * ny; const rx = ux - 2 * dot * nx, ry = uy - 2 * dot * ny; const rem = L * (1 - tt); pts.push([px, py], [px + rx * rem, py + ry * rem], [px + rx * (rem + 16), py + ry * (rem + 16)]); }
      else if (this.design === 'cass' || this.design === 'nasmyth') { const sx = Fx + f * 0.25; const tt = (sx - hitX) / (Fx - hitX); const px = hitX + (Fx - hitX) * tt, py = ax + h - h * tt; const F2x = vx + f * 0.18; if (this.design === 'cass') { pts.push([px, py], [F2x, ax], [F2x + 14, ax - (py - ax) * 14 / (F2x - px)]); } else { const tx = vx - rr * 0.35; const tt2 = (tx - px) / (F2x - px); const qx = px + (F2x - px) * tt2, qy = py + (ax - py) * tt2; const rem = Math.hypot(F2x - qx, ax - qy); pts.push([px, py], [qx, qy], [qx, qy - rem * 1.0 * Math.sign(1)]); } }
      else if (this.design === 'greg') { const sx = Fx - f * 0.3; const px = hitX + (sx - hitX), py = ax + h + (-h) * (sx - hitX) / (Fx - hitX); const F2x = vx + f * 0.2; pts.push([Fx, ax], [px, py], [F2x, ax], [F2x + 14, ax - (py - ax) * 14 / (F2x - px)]); }
      else { const plateX = vx - 2 * f; const fx = vx - f, fy = ax; pts.splice(1, 1, [plateX, ax + h], [hitX, ax + h * 0.98]); const dirx = fx - hitX, diry = fy - ax - h * 0.98; const L = Math.hypot(dirx, diry); pts.push([hitX + dirx / L * (L - 2), ax + h * 0.98 + diry / L * (L - 2)]); }
      paths.push(pts);
    }
    // secondary / flats / plate
    if (this.design === 'newton') { const flatX = Fx + rr * 0.55; this.line(flatX - 10, ax - 10, flatX + 10, ax + 10, C.purple, 3); }
    if (this.design === 'cass' || this.design === 'nasmyth') { const sx = Fx + f * 0.25; c.beginPath(); c.moveTo(sx + 5, ax - rr * 0.32); c.quadraticCurveTo(sx - 7, ax, sx + 5, ax + rr * 0.32); c.strokeStyle = C.purple; c.lineWidth = 3; c.stroke(); c.lineWidth = 1; }
    if (this.design === 'nasmyth') { const tx = vx - rr * 0.35; this.line(tx - 10, ax + 10, tx + 10, ax - 10, C.purple, 3); }
    if (this.design === 'greg') { const sx = Fx - f * 0.3; c.beginPath(); c.moveTo(sx - 5, ax - rr * 0.36); c.quadraticCurveTo(sx + 9, ax, sx - 5, ax + rr * 0.36); c.strokeStyle = C.purple; c.lineWidth = 3; c.stroke(); c.lineWidth = 1; }
    if (sch) { const plateX = vx - 2 * f; this.line(plateX, ax - rr, plateX, ax + rr, C.green, 3); this.text('corrector plate', plateX, ax - rr - 10, C.green, 8, 'center'); c.beginPath(); for (let y = -rr * 0.5; y <= rr * 0.5; y += 2) { const x = vx - f + y * y / (2 * f); y === -rr * 0.5 ? c.moveTo(x, ax + y) : c.lineTo(x, ax + y); } c.strokeStyle = C.sun; c.setLineDash([3, 3]); c.stroke(); c.setLineDash([]); this.text('curved focal surface', vx - f, ax + rr * 0.5 + 12, C.sun, 8, 'center'); }
    // rays with travelling pulses
    for (const pts of paths) {
      c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.strokeStyle = hexA(C.sun, 0.55); c.lineWidth = 1; c.stroke();
      let total = 0; const segs: number[] = []; for (let i = 1; i < pts.length; i++) { const L = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); segs.push(L); total += L; }
      for (let k = 0; k < 3; k++) { let s = ((this.t * 120 + k * total / 3) % total); for (let i = 0; i < segs.length; i++) { if (s <= segs[i]) { const u = s / segs[i]; const x = pts[i][0] + (pts[i + 1][0] - pts[i][0]) * u, y = pts[i][1] + (pts[i + 1][1] - pts[i][1]) * u; this.glow(x, y, 4, hexA(C.sun, 0.95)); break; } s -= segs[i]; } }
    }
    const info: Record<Design, [string, number, string]> = {
      prime: ['focus inside the tube, in front of the primary', 1, 'fast, wide field; the detector blocks light'],
      newton: ['flat diagonal; focus at the side of the tube', 1, 'simple and cheap; eyepiece at the top'],
      cass: ['convex hyperboloid; focus behind the primary', 3, 'long f in a short tube; heavy instruments at the back'],
      greg: ['concave ellipsoid beyond prime focus', 3.5, 'upright image; accessible intermediate focus (solar heat stop)'],
      nasmyth: ['Cassegrain + flat out through the altitude axis', 3, 'instruments on fixed platforms, never move'],
      schmidt: ['spherical primary + corrector at 2R; no coma', 1, 'very wide field (6°) on a curved surface — surveys'],
    };
    const [desc, mag, pro] = info[this.design]; const Feff = this.F * mag;
    this.setReadout([
      ['Secondary', desc, C.accent],
      ['Effective focal ratio', `f/${fmt(Feff, 1)}  (focal length ${fmt(Feff, 1)} × D)`],
      ['Tube length', `≈ ${fmt(this.design === 'schmidt' ? 2 * this.F : this.design === 'greg' ? this.F * 1.3 : this.design === 'cass' || this.design === 'nasmyth' ? this.F * 0.75 : this.F, 1)} × D`],
      ['Why', pro],
    ]);
  }
}

/* ------------------------------------------------- 52. plate scale & field ---- */

const TARGETS: Array<[string, number, number, string]> = [['Moon', 1860, 1860, 'moon'], ['Jupiter', 45, 45, 'jupiter'], ['Saturn', 43, 19, 'saturn'], ['Orion Nebula', 3900, 3600, 'nebula'], ['Andromeda', 11400, 3600, 'galaxy'], ['Pleiades', 6600, 6600, 'cluster']];
const SENSORS: Array<[string, number, number, number]> = [['phone sensor', 6.2, 4.6, 0], ['APS-C', 23.5, 15.6, 0], ['full frame', 36, 24, 0], ['eyepiece 25 mm', 0, 0, 25], ['eyepiece 10 mm', 0, 0, 10], ['eyepiece 4 mm', 0, 0, 4]];
class PlateScaleWidget extends CanvasWidget {
  private lgF = Math.log10(1000); private tgt = 0; private sens = 2;
  constructor() {
    super(480 / 240);
    this.segmented<string>(TARGETS.map(([n]) => [n, n] as [string, string]), 'Moon', (n) => { this.tgt = TARGETS.findIndex(([k]) => k === n); });
    this.segmented<string>(SENSORS.map(([n]) => [n, n] as [string, string]), 'full frame', (n) => { this.sens = SENSORS.findIndex(([k]) => k === n); });
    this.slider('Focal length f', Math.log10(50), Math.log10(150000), 0.01, this.lgF, (v) => fmtLen(10 ** v / 1000), (v) => { this.lgF = v; });
  }
  protected draw() {
    const c = this.ctx; c.fillStyle = C.bg; c.fillRect(0, 0, this.w, this.h);
    const f = 10 ** this.lgF; const scale = 206265 / f; // arcsec per mm
    const [, sw, sh, fe] = SENSORS[this.sens]; const eye = fe > 0; const afov = 60; // apparent field of eyepiece, degrees
    const M = eye ? f / fe : 0; const fovW = eye ? afov * 3600 / M : sw * scale, fovH = eye ? fovW : sh * scale;
    const [name, tw, th, kind] = TARGETS[this.tgt];
    const box = Math.min(this.h - 40, this.w * 0.56); const cx = this.w * 0.32, cy = this.h / 2 - 6;
    const pxPerAs = (eye ? box : box) / Math.max(fovW, fovH);
    const fw = fovW * pxPerAs, fh = fovH * pxPerAs;
    c.save(); c.beginPath(); if (eye) c.arc(cx, cy, fw / 2, 0, TAU); else c.rect(cx - fw / 2, cy - fh / 2, fw, fh); c.clip();
    c.fillStyle = '#05070b'; c.fillRect(0, 0, this.w, this.h);
    const rnd = mulberry(3); for (let i = 0; i < 120; i++) { const x = cx + (rnd() - 0.5) * box * 1.4, y = cy + (rnd() - 0.5) * box * 1.4; this.circle(x, y, 0.6 + rnd(), undefined, `rgba(255,255,255,${0.2 + rnd() * 0.5})`); }
    const rw = tw * pxPerAs, rh = th * pxPerAs;
    if (kind === 'moon') { const g = c.createRadialGradient(cx - rw * 0.2, cy - rw * 0.2, rw * 0.1, cx, cy, rw / 2); g.addColorStop(0, '#d9d6cc'); g.addColorStop(1, '#8e8a80'); c.fillStyle = g; c.beginPath(); c.arc(cx, cy, rw / 2, 0, TAU); c.fill(); const r2 = mulberry(11); for (let i = 0; i < 14; i++) { const a = r2() * TAU, r = r2() * rw * 0.42; c.fillStyle = 'rgba(60,65,80,0.35)'; c.beginPath(); c.ellipse(cx + r * Math.cos(a), cy + r * Math.sin(a), rw * (0.04 + 0.08 * r2()), rw * (0.03 + 0.06 * r2()), a, 0, TAU); c.fill(); } }
    else if (kind === 'jupiter') { c.fillStyle = '#d8c3a0'; c.beginPath(); c.ellipse(cx, cy, rw / 2, rh / 2 * 0.94, 0, 0, TAU); c.fill(); c.save(); c.beginPath(); c.ellipse(cx, cy, rw / 2, rh / 2 * 0.94, 0, 0, TAU); c.clip(); for (const [k, col] of [[-0.45, '#a8785a'], [-0.2, '#b58a68'], [0.15, '#a8785a'], [0.45, '#b58a68']] as Array<[number, string]>) { c.fillStyle = col; c.fillRect(cx - rw, cy + k * rh / 2 - rh * 0.05, 2 * rw, rh * 0.1); } c.fillStyle = '#c8664a'; c.beginPath(); c.ellipse(cx + rw * 0.15, cy + rh * 0.2, rw * 0.1, rh * 0.06, 0, 0, TAU); c.fill(); c.restore(); }
    else if (kind === 'saturn') { c.strokeStyle = '#cfc2a0'; c.lineWidth = Math.max(1, rh * 0.18); c.beginPath(); c.ellipse(cx, cy, rw / 2, rw / 2 * 0.3, 0, 0, TAU); c.stroke(); c.lineWidth = 1; c.fillStyle = '#e0cfa2'; c.beginPath(); c.ellipse(cx, cy, rh / 2 * 1.1, rh / 2, 0, 0, TAU); c.fill(); if (rw > 60) { c.strokeStyle = '#05070b'; c.lineWidth = Math.max(0.8, rw * 0.012); c.beginPath(); c.ellipse(cx, cy, rw / 2 * 0.89, rw / 2 * 0.3 * 0.89, 0, 0, TAU); c.stroke(); c.lineWidth = 1; } }
    else if (kind === 'nebula') { const g = c.createRadialGradient(cx, cy, 0, cx, cy, rw / 2); g.addColorStop(0, 'rgba(255,220,200,0.9)'); g.addColorStop(0.4, 'rgba(200,90,110,0.5)'); g.addColorStop(1, 'rgba(120,40,80,0)'); c.fillStyle = g; c.beginPath(); c.ellipse(cx, cy, rw / 2, rh / 2, 0.4, 0, TAU); c.fill(); }
    else if (kind === 'galaxy') { c.save(); c.translate(cx, cy); c.rotate(-0.5); const g = c.createRadialGradient(0, 0, 0, 0, 0, rw / 2); g.addColorStop(0, 'rgba(255,240,220,0.95)'); g.addColorStop(0.15, 'rgba(230,210,190,0.6)'); g.addColorStop(1, 'rgba(120,120,160,0)'); c.fillStyle = g; c.beginPath(); c.ellipse(0, 0, rw / 2, rh / 2, 0, 0, TAU); c.fill(); c.restore(); }
    else { const r2 = mulberry(5); for (let i = 0; i < 9; i++) { const x = cx + (r2() - 0.5) * rw * 0.8, y = cy + (r2() - 0.5) * rh * 0.8; this.glow(x, y, Math.max(2, rw * 0.03), 'rgba(170,200,255,0.9)'); } }
    c.restore();
    if (eye) this.circle(cx, cy, fw / 2, C.line, undefined, 1.5); else { c.strokeStyle = C.line; c.strokeRect(cx - fw / 2, cy - fh / 2, fw, fh); }
    this.text(eye ? `eyepiece field ${fmtAngle(fovW)} · ${fmt(M, 0)}×` : `${SENSORS[this.sens][0]}: ${fmtAngle(fovW)} × ${fmtAngle(fovH)}`, cx, cy + Math.max(fw, fh) / 2 + 12, C.dim, 8, 'center');
    const tx = this.w * 0.66; let ty = 24;
    const lines: Array<[string, string]> = [[`${name}`, `${fmtAngle(tw)}${tw !== th ? ' × ' + fmtAngle(th) : ''} on the sky`], ['image size', eye ? `${fmt(tw / 3600 * M, 1)}° apparent` : `${fmt(tw / scale, tw / scale < 10 ? 2 : 1)} mm${tw !== th ? ' × ' + fmt(th / scale, 1) + ' mm' : ''}`], ['pixels across (4 µm)', eye ? '—' : `${fmt(tw / scale / 0.004, 0)}`], ['fits the frame?', tw <= fovW && th <= fovH ? 'yes' : 'no — overflows']];
    for (const [k, v] of lines) { this.text(k, tx, ty, C.dim, 9); this.text(v, tx, ty + 13, k === 'fits the frame?' ? (v === 'yes' ? C.green : C.red) : C.text, 10); ty += 34; }
    this.setReadout([
      ['Plate scale 206 265 / f', `${scale >= 10 ? fmt(scale, 0) : fmt(scale, 2)}″ per mm  ·  ${fmt(scale * 0.004, scale * 0.004 < 1 ? 3 : 1)}″ per 4 µm pixel`, C.accent],
      ['Field of view', eye ? `${fmtAngle(fovW)} true field (60° apparent)` : `${fmtAngle(fovW)} × ${fmtAngle(fovH)}`],
      ['Magnification', eye ? `${fmt(M, 0)}× (max useful ≈ 2× per mm of D)` : `${fmt(f / 50, 1)}× vs a 50 mm camera lens`],
      ['Rule', '2× f → 2× image, 4× pixels, 4× exposure'],
    ]);
  }
}

/* ------------------------------------------------- 53. compare telescopes ---- */

class ScopesWidget extends CanvasWidget {
  private a = 1; private b = 9;
  constructor() {
    super(480 / 250);
    this.controls.appendChild($('div', 'lw-caption', 'A:'));
    this.segmented<string>(SCOPES.map(([n]) => [n, n] as [string, string]), SCOPES[1][0], (n) => { this.a = SCOPES.findIndex(([k]) => k === n); });
    this.controls.appendChild($('div', 'lw-caption', 'B:'));
    this.segmented<string>(SCOPES.map(([n]) => [n, n] as [string, string]), SCOPES[9][0], (n) => { this.b = SCOPES.findIndex(([k]) => k === n); });
  }
  protected draw() {
    const c = this.ctx; c.fillStyle = C.bg; c.fillRect(0, 0, this.w, this.h);
    const A = SCOPES[this.a], B = SCOPES[this.b]; const Dmax = Math.max(A[1], B[1]); const Rpx = Math.min(this.h * 0.3, this.w * 0.15);
    const cx = [this.w * 0.17, this.w * 0.45]; const col = [C.sun, C.blue]; const cy = this.h * 0.46;
    [A, B].forEach((s, i) => { const r = Math.max(1.5, s[1] / Dmax * Rpx); this.circle(cx[i], cy, r, col[i], hexA(col[i], 0.15), 1.5); if (s[1] / Dmax * Rpx < 1.5) this.text('(too small to draw to scale)', cx[i], cy + 16, C.dim, 7, 'center'); this.text(`${s[0]} — ${fmtLen(s[1])}`, cx[i], cy + Rpx + 14, col[i], 9, 'center'); this.text(s[2], cx[i], cy + Rpx + 26, C.dim, 8, 'center'); });
    this.text('apertures to the same scale', this.w * 0.31, 14, C.dim, 8, 'center');
    const bx = this.w * 0.66, bw = this.w * 0.22; const lgA = (D: number) => 2 * Math.log10(D / 0.007);
    const rows: Array<[string, (D: number) => number, (v: number) => string, number]> = [
      ['light grasp vs eye (log)', lgA, (v) => `10^${fmt(v, 1)}`, 2 * Math.log10(40 / 0.007)],
      ['limiting magnitude (visual)', (D) => 7.5 + 5 * Math.log10(D * 100), (v) => `m ${fmt(v, 1)}`, 7.5 + 5 * Math.log10(4000)],
      ['resolution 1.22 λ/D at 550 nm', (D) => -Math.log10(1.22 * 550e-9 / D / ARCSEC), (v) => fmtAngle(10 ** -v), 2.5],
    ];
    rows.forEach(([lab, fn, show, maxv], i) => { const y = 30 + i * 62; this.text(lab, bx, y, C.dim, 8); [A, B].forEach((s, j) => { const v = fn(s[1]); const yy = y + 10 + j * 14; c.fillStyle = hexA(col[j], 0.75); c.fillRect(bx, yy, Math.max(2, bw * Math.max(0, (i === 2 ? v + 2 : v) / (i === 2 ? maxv + 2 : maxv))), 9); this.text(show(v), bx + bw + 4, yy + 5, col[j], 8); }); });
    const ratio = (B[1] / A[1]) ** 2;
    this.setReadout([
      ['Light grasp  B / A = (D_B/D_A)²', `${ratio >= 1 ? (ratio > 1e4 ? sci(ratio, 1) : fmt(ratio, 1)) + '×' : fmt(1 / ratio, 1) + '× less'}  (${fmt(Math.abs(2.5 * Math.log10(ratio)), 1)} mag)`, C.accent],
      ['Same photons collected in', ratio >= 1 ? `B needs 1/${fmt(ratio, ratio > 100 ? 0 : 1)} of A\'s exposure` : `A needs 1/${fmt(1 / ratio, 1)} of B\'s exposure`],
      ['Diffraction limit  A / B', `${fmtAngle(1.22 * 550e-9 / A[1] / ARCSEC)} / ${fmtAngle(1.22 * 550e-9 / B[1] / ARCSEC)}`],
      ['Seeing-limited (r₀ ≈ 15 cm, no AO)?', `A ${A[1] > 0.15 ? 'yes' : 'no'} · B ${B[1] > 0.15 ? 'yes' : 'no'}`],
    ]);
  }
}

/* ------------------------------------------------- 54. mounts & field rotation ---- */

class MountWidget extends CanvasWidget {
  private mount: 'eq' | 'altaz' = 'altaz'; private lat = 35; private dec = 20; private H = -30;
  constructor() {
    super(480 / 240);
    this.segmented<'eq' | 'altaz'>([['eq', 'equatorial'], ['altaz', 'alt-azimuth']], 'altaz', (v) => { this.mount = v; });
    this.playButton();
    this.slider('Latitude φ', -60, 60, 1, 35, (v) => `${v}°`, (v) => { this.lat = v; });
    this.slider('Star declination δ', -30, 89, 1, 20, (v) => `${v}°`, (v) => { this.dec = v; });
    this.slider('Time (hour angle)', -6, 6, 0.01, -2, (v) => `${fmt(v, 1)} h`, (v) => { this.H = v * 15; });
  }
  protected draw(dt: number) {
    if (this.playing) { this.H += dt * 15 * 0.25; if (this.H > 90) this.H = -90; }
    const c = this.ctx; c.fillStyle = C.bg; c.fillRect(0, 0, this.w, this.h);
    const phi = this.lat * DEG, dec = this.dec * DEG, H = this.H * DEG;
    const sinA = Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H); const alt = Math.asin(sinA);
    const az = Math.atan2(-Math.cos(dec) * Math.sin(H), Math.sin(dec) * Math.cos(phi) - Math.cos(dec) * Math.sin(phi) * Math.cos(H));
    const q = Math.atan2(Math.sin(H), Math.tan(phi) * Math.cos(dec) - Math.sin(dec) * Math.cos(H)); // parallactic angle
    const rate = 15 * Math.cos(phi) * Math.cos(az) / Math.max(1e-3, Math.cos(alt)); // arcsec/s of field rotation
    // sky dome (left): azimuth around, altitude radial
    const cx = this.w * 0.27, cy = this.h * 0.52, R = Math.min(this.h * 0.42, this.w * 0.24);
    this.circle(cx, cy, R, C.line); for (const a of [30, 60]) this.circle(cx, cy, R * (1 - a / 90), C.grid, undefined, 1, [2, 4]);
    this.text('N', cx, cy - R - 8, C.dim, 8, 'center'); this.text('S', cx, cy + R + 8, C.dim, 8, 'center'); this.text('E', cx + R + 8, cy, C.dim, 8, 'center'); this.text('W', cx - R - 8, cy, C.dim, 8, 'center');
    const sky = (altr: number, azr: number) => [cx + R * (1 - altr / (Math.PI / 2)) * Math.sin(azr), cy - R * (1 - altr / (Math.PI / 2)) * Math.cos(azr)];
    c.beginPath(); let started = false; for (let h = -180; h <= 180; h += 2) { const hr = h * DEG; const sa = Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(hr); if (sa < 0) { started = false; continue; } const a2 = Math.atan2(-Math.cos(dec) * Math.sin(hr), Math.sin(dec) * Math.cos(phi) - Math.cos(dec) * Math.sin(phi) * Math.cos(hr)); const [x, y] = sky(Math.asin(sa), a2); started ? c.lineTo(x, y) : c.moveTo(x, y); started = true; } c.strokeStyle = hexA(C.sun, 0.5); c.stroke();
    const pole = sky(Math.abs(phi), phi >= 0 ? 0 : Math.PI); this.circle(pole[0], pole[1], 3, C.accent); this.text('celestial pole', pole[0] + 6, pole[1], C.accent, 7);
    if (alt > 0) { const [sx, sy] = sky(alt, az); this.glow(sx, sy, 8, 'rgba(255,255,255,0.9)'); const len = 14; const ang = this.mount === 'altaz' ? 0 : q; this.line(sx - len * Math.sin(ang), sy - len * Math.cos(ang), sx + len * Math.sin(ang), sy + len * Math.cos(ang), hexA(C.blue, 0.9), 1.5); this.line(sx - len * Math.cos(ang), sy + len * Math.sin(ang), sx + len * Math.cos(ang), sy - len * Math.sin(ang), hexA(C.blue, 0.9), 1.5); }
    else this.text('star below the horizon', cx, cy, C.red, 9, 'center');
    // eyepiece view (right)
    const ex = this.w * 0.72, ey = this.h * 0.5, Re = Math.min(this.h * 0.36, this.w * 0.2);
    this.circle(ex, ey, Re, C.line, '#05070b', 1.5);
    const fieldRot = this.mount === 'altaz' ? q : 0;
    const rnd = mulberry(21); c.save(); c.beginPath(); c.arc(ex, ey, Re, 0, TAU); c.clip(); c.translate(ex, ey); c.rotate(fieldRot);
    this.circle(0, 0, 3, undefined, '#fff'); for (let i = 0; i < 16; i++) { const a = rnd() * TAU, r = (0.25 + 0.7 * rnd()) * Re; this.circle(r * Math.cos(a), r * Math.sin(a), 1 + rnd() * 1.5, undefined, `rgba(255,255,255,${0.4 + 0.5 * rnd()})`); }
    this.line(0, -Re, 0, Re, hexA(C.blue, 0.4)); this.line(-Re, 0, Re, 0, hexA(C.blue, 0.4)); this.text('N', 0, -Re + 10, C.blue, 8, 'center'); c.restore();
    this.text(this.mount === 'altaz' ? 'alt-az: the field turns' : 'equatorial: the field stays put', ex, ey + Re + 12, this.mount === 'altaz' ? C.sun : C.green, 9, 'center');
    this.setReadout([
      ['Altitude · azimuth', alt > 0 ? `${fmt(alt / DEG, 1)}° · ${fmt(((az / DEG) + 360) % 360, 0)}°` : 'set', C.accent],
      ['Parallactic angle', `${fmt(q / DEG, 1)}°`],
      ['Field rotation (alt-az)', alt > 0 ? `${fmt(rate, 1)}″/s = ${fmt(rate * 60 / 3600, 2)}°/min${alt > 85 * DEG ? '  — near zenith: cannot follow' : ''}` : '—', alt > 85 * DEG ? C.red : this.mount === 'altaz' ? C.sun : C.dim],
      ['Axis rates', this.mount === 'eq' ? 'polar axis 15″/s, declination 0 — one motor' : alt > 0 ? `az ${fmt(15 * (Math.sin(phi) + Math.cos(phi) * Math.tan(alt) * Math.cos(az)) * 1, 1)}″/s · alt ${fmt(15 * Math.cos(phi) * Math.sin(az), 1)}″/s — both vary` : '—'],
    ]);
  }
}

/* ------------------------------------------------- 55. Jansky's chart ---- */

class JanskyWidget extends CanvasWidget {
  private day = 60; private hyp: 'sun' | 'stars' = 'stars'; private noise: number[] = [];
  constructor() {
    super(480 / 260);
    this.segmented<'sun' | 'stars'>([['sun', 'if the source were the Sun'], ['stars', 'if the source were fixed to the stars']], 'stars', (v) => { this.hyp = v; });
    this.slider('Day of the year', 0, 365, 1, 60, (v) => `day ${v}`, (v) => { this.day = v; });
    this.playButton(); this.playing = false;
    const rnd = mulberry(99); for (let i = 0; i < 4000; i++) this.noise.push(gaussRand(rnd));
  }
  protected draw(dt: number) {
    if (this.playing) { this.day = (this.day + dt * 20) % 366; }
    const c = this.ctx; c.fillStyle = C.bg; c.fillRect(0, 0, this.w, this.h);
    const rows = 12, x0 = 52, x1 = this.w - 14, y0 = 20, rowH = (this.h - 48) / rows;
    const X = (hour: number) => x0 + hour / 24 * (x1 - x0);
    for (let hh = 0; hh <= 24; hh += 6) { this.line(X(hh), y0 - 4, X(hh), this.h - 26, C.grid); this.text(`${hh}h`, X(hh), this.h - 18, C.dim, 8, 'center'); }
    this.text('local solar time →', x1, this.h - 8, C.dim, 7, 'right');
    const peakHour = (d: number) => ((12 + (18 - 12) - d * 3.9344 / 60) % 24 + 24) % 24; // peaks at 18h on day 0, 3.93 min earlier each day
    for (let r = 0; r < rows; r++) {
      const d = Math.floor(this.day) - (rows - 1 - r); if (d < 0) continue; const yb = y0 + (r + 1) * rowH - 3;
      this.text(`d ${d}`, x0 - 6, yb - rowH * 0.35, C.dim, 8, 'right');
      const pk = peakHour(d); c.beginPath();
      for (let i = 0; i <= 160; i++) { const hr = i / 160 * 24; let dh = Math.abs(hr - pk); dh = Math.min(dh, 24 - dh); const sig = Math.exp(-dh * dh / (2 * 1.1 * 1.1)); const n = this.noise[(d * 160 + i) % this.noise.length] * 0.05; const v = 0.12 + 0.85 * sig + n + (Math.sin(hr * 1.3 + d) > 0.95 ? 0.3 : 0); const y = yb - Math.max(0, Math.min(1, v)) * rowH * 0.9; i ? c.lineTo(X(hr), y) : c.moveTo(X(hr), y); }
      c.strokeStyle = r === rows - 1 ? C.sun : hexA(C.text, 0.35 + 0.5 * r / rows); c.lineWidth = r === rows - 1 ? 1.4 : 1; c.stroke();
      const pred = this.hyp === 'sun' ? 18 : pk; this.line(X(pred), yb - rowH * 0.95, X(pred), yb, this.hyp === 'sun' ? hexA(C.red, 0.6) : hexA(C.green, 0.6), 1, [2, 2]);
    }
    this.text(this.hyp === 'sun' ? 'prediction (red): same solar time every day' : 'prediction (green): 3 m 56 s earlier each day', x0, 10, this.hyp === 'sun' ? C.red : C.green, 8);
    const d = Math.floor(this.day); const pk = peakHour(d); const gained = d * 3.9344;
    this.setReadout([
      ['Peak today', `${Math.floor(pk)}h ${padZ((pk % 1) * 60)}m local time`, C.sun],
      ['Drift (−3 m 56 s per day)', `${fmt(gained / 60, 1)} h earlier after ${d} days`],
      ['Period of the signal', this.hyp === 'sun' ? '23h 56m 04s ≠ 24h: not the Sun' : '23h 56m 04s = sidereal: stars', this.hyp === 'sun' ? C.red : C.green],
      ['Direction', 'RA 18h, Dec −20°: Galactic Centre'],
    ]);
  }
}

/* ------------------------------------------------- 56. radio dish ---- */

class DishWidget extends CanvasWidget {
  private lgD = Math.log10(25); private lgLam = Math.log10(0.21); private lgS = 0; private t = 0;
  constructor() {
    super(480 / 240);
    this.segmented<string>([['vla', 'VLA dish 25 m · 21 cm'], ['gbt', 'GBT 100 m · 21 cm'], ['alma', 'ALMA 12 m · 1.3 mm'], ['fast', 'FAST 300 m · 21 cm'], ['eff', 'Effelsberg 100 m · 6 cm']], 'vla', (v) => { const m: Record<string, [number, number]> = { vla: [25, 0.21], gbt: [100, 0.21], alma: [12, 0.0013], fast: [300, 0.21], eff: [100, 0.06] }; this.lgD = Math.log10(m[v][0]); this.lgLam = Math.log10(m[v][1]); this.sD.set(this.lgD); this.sL.set(this.lgLam); });
    this.sD = this.slider('Dish diameter D', 0, Math.log10(500), 0.01, this.lgD, (v) => fmtLen(10 ** v), (v) => { this.lgD = v; });
    this.sL = this.slider('Wavelength λ', -3.3, 1, 0.01, this.lgLam, (v) => fmtLen(10 ** v), (v) => { this.lgLam = v; });
    this.slider('Source flux density', -3, 4, 0.01, 0, (v) => `${10 ** v >= 1 ? fmt(10 ** v, 10 ** v > 100 ? 0 : 1) + ' Jy' : fmt(10 ** v * 1000, 0) + ' mJy'}`, (v) => { this.lgS = v; });
  }
  private sD!: { set: (v: number) => void }; private sL!: { set: (v: number) => void };
  protected draw(dt: number) {
    this.t += dt;
    const c = this.ctx; c.fillStyle = C.bg; c.fillRect(0, 0, this.w, this.h);
    const D = 10 ** this.lgD, lam = 10 ** this.lgLam, S = 10 ** this.lgS;
    const hpbw = 1.2 * lam / D; const A = Math.PI * D * D / 4, Aeff = 0.6 * A; const P = S * 1e-26 * Aeff * 1e7;
    // dish picture (left)
    const cx = this.w * 0.26, base = this.h * 0.82, R = Math.min(this.w * 0.22, this.h * 0.4), f = R * 0.9;
    c.beginPath(); for (let x = -R; x <= R; x += 2) { const y = base - x * x / (4 * f); x === -R ? c.moveTo(cx + x, y) : c.lineTo(cx + x, y); } c.strokeStyle = C.blue; c.lineWidth = 3; c.stroke(); c.lineWidth = 1;
    const fy = base - f; this.circle(cx, fy, 4, C.accent, hexA(C.accent, 0.5)); this.text('feed', cx + 8, fy, C.accent, 8);
    for (const x of [-R * 0.7, R * 0.7]) this.line(cx + x, base - x * x / (4 * f), cx, fy, C.faint);
    const ph = (this.t * 40) % 24;
    for (let k = 0; k < 6; k++) { const y = 10 + k * 24 + ph; if (y < base - R * R / (4 * f) - 40) this.line(cx - R, y, cx + R, y, hexA(C.sun, 0.5)); }
    for (let k = 0; k < 4; k++) { const r = (k * 18 + (24 - ph) * 0.75) % 72; if (r > 2) { c.beginPath(); c.arc(cx, fy, r, 0.25 * Math.PI, 0.75 * Math.PI); c.strokeStyle = hexA(C.sun, 0.6 * (1 - r / 72)); c.stroke(); } }
    this.text(`surface accurate to λ/20 = ${fmtLen(lam / 20)}`, cx, base + 14, C.dim, 8, 'center');
    // beam pattern (right)
    const gx0 = this.w * 0.55, gx1 = this.w - 12, gy0 = 30, gy1 = this.h * 0.62; const span = 3.5 * hpbw;
    this.line(gx0, gy1, gx1, gy1, C.line); this.text('beam pattern (power vs angle)', gx0, gy0 - 14, C.dim, 8);
    c.beginPath(); for (let i = 0; i <= 200; i++) { const th = (i / 200 - 0.5) * 2 * span; const I = airy(Math.PI * D * th / lam); const x = gx0 + i / 200 * (gx1 - gx0), y = gy1 - I * (gy1 - gy0); i ? c.lineTo(x, y) : c.moveTo(x, y); } c.strokeStyle = C.sun; c.lineWidth = 1.5; c.stroke();
    const xh1 = gx0 + (0.5 + hpbw / 2 / (2 * span)) * (gx1 - gx0);
    const xa = gx0 + (0.5 - hpbw / 2 / (2 * span)) * (gx1 - gx0); this.line(xa, gy1 - 0.5 * (gy1 - gy0), xh1, gy1 - 0.5 * (gy1 - gy0), C.accent, 1.5); this.text(`HPBW ${fmtAngle(hpbw / ARCSEC)}`, (xa + xh1) / 2, gy1 - 0.5 * (gy1 - gy0) - 9, C.accent, 8, 'center');
    this.text('side lobes', gx0 + (gx1 - gx0) * 0.86, gy1 - 12, C.dim, 7, 'center');
    const moon = 1860 * ARCSEC; this.text(hpbw > moon ? `the beam is ${fmt(hpbw / moon, 1)}× the Moon` : `the Moon is ${fmt(moon / hpbw, 0)} beams wide`, gx0, gy1 + 14, C.text, 9);
    this.text(`the eye: 1′ — this dish: ${fmtAngle(hpbw / ARCSEC)}`, gx0, gy1 + 28, C.dim, 8);
    this.setReadout([
      ['Half-power beam width 1.2 λ/D', fmtAngle(hpbw / ARCSEC), C.accent],
      ['Collecting area · effective (60 %)', `${fmt(A, 0)} m²  ·  ${fmt(Aeff, 0)} m²`],
      ['Power collected (10 MHz band)', `${sci(P, 2)} W = ${sci(P * 3600, 1)} J/h`, C.sun],
      ['Frequency', `${fmtFreq(C_LIGHT / lam)}  ·  photon energy ${fmtEnergy(H_PLANCK * C_LIGHT / lam / EV)}`],
    ]);
  }
}

/* ------------------------------------------------- 57. interferometer ---- */

class InterferometerWidget extends CanvasWidget {
  private lgB = Math.log10(1000); private lgLam = Math.log10(0.21); private lgSrc = Math.log10(1); private srcOff = 0; private t = 0; private n = 2; private uv: Array<[number, number]> = [];
  constructor() {
    super(480 / 270);
    this.segmented<string>([['2', '2 antennas'], ['3', '3'], ['5', '5'], ['8', '8 (Y-shaped)']], '2', (v) => { this.n = +v; this.uv = []; });
    this.playButton(); this.playing = false;
    this.slider('Baseline B', 1, Math.log10(1.2e7), 0.01, this.lgB, (v) => fmtLen(10 ** v), (v) => { this.lgB = v; this.uv = []; });
    this.slider('Wavelength λ', -3.3, 0.5, 0.01, this.lgLam, (v) => fmtLen(10 ** v), (v) => { this.lgLam = v; this.uv = []; });
    this.slider('Source angular size', -5, Math.log10(600), 0.01, this.lgSrc, (v) => fmtAngle(10 ** v), (v) => { this.lgSrc = v; });
    this.controls.appendChild($('div', 'lw-caption', 'Press play to let the Earth rotate and fill the uv plane.'));
  }
  protected draw(dt: number) {
    if (this.playing) { this.t += dt; }
    const c = this.ctx; c.fillStyle = C.bg; c.fillRect(0, 0, this.w, this.h);
    const B = 10 ** this.lgB, lam = 10 ** this.lgLam, src = 10 ** this.lgSrc * ARCSEC; const fr = lam / B;
    const xarg = Math.PI * src * B / lam; const vis = Math.abs(xarg < 1e-6 ? 1 : 2 * J1(xarg) / xarg);
    // antennas (top-left)
    const ax0 = 14, ax1 = this.w * 0.44, ay = this.h * 0.36; const ant = (x: number) => { c.beginPath(); c.moveTo(x - 9, ay); c.quadraticCurveTo(x, ay - 14, x + 9, ay); c.strokeStyle = C.blue; c.lineWidth = 2.5; c.stroke(); c.lineWidth = 1; this.line(x, ay, x, ay + 12, C.line); };
    const pos = this.n === 2 ? [0, 1] : this.n === 3 ? [0, 0.35, 1] : this.n === 5 ? [0, 0.15, 0.45, 0.8, 1] : [0, 0.08, 0.2, 0.4, 0.55, 0.7, 0.86, 1];
    pos.forEach((p) => ant(ax0 + 12 + p * (ax1 - ax0 - 24)));
    this.line(ax0, ay + 12, ax1, ay + 12, C.faint); this.text(`B = ${fmtLen(B)}`, (ax0 + ax1) / 2, ay + 24, C.text, 9, 'center');
    const tilt = (ax1 - ax0) * 0.11; for (let k = 0; k < 5; k++) { const d = (k * 16 + (this.t * 30) % 16); const y = ay - 90 + d; this.line(ax0, y + tilt, ax1, y - tilt, hexA(C.sun, 0.35)); }
    this.text('plane waves from the source', ax0, ay - 100, C.dim, 8);
    this.text(`delay across B = B sin θ / c`, ax0, ay + 38, C.dim, 8);
    // fringes on the sky (top-right)
    const fx0 = this.w * 0.52, fx1 = this.w - 12, fy0 = 14, fy1 = this.h * 0.46; const span = 4 * fr;
    c.fillStyle = '#05070b'; c.fillRect(fx0, fy0, fx1 - fx0, fy1 - fy0);
    const W = fx1 - fx0; for (let i = 0; i < W; i++) { const thx = (i / W - 0.5) * 2 * span; const env = airy(Math.PI * (B * 0.06) * thx / lam) ; const fringe = 0.5 + 0.5 * vis * Math.cos(2 * Math.PI * (thx - this.srcOff) / fr); const v = env * fringe; c.fillStyle = `rgba(255,210,120,${v})`; c.fillRect(fx0 + i, fy0, 1.2, fy1 - fy0); }
    c.strokeStyle = C.line; c.strokeRect(fx0, fy0, fx1 - fx0, fy1 - fy0);
    this.text(`fringe spacing λ/B = ${fmtAngle(fr / ARCSEC)}`, fx0 + 4, fy1 + 10, C.accent, 8); this.text(`visibility ${fmt(vis, 2)}`, fx1 - 4, fy1 + 10, vis > 0.5 ? C.green : vis > 0.1 ? C.sun : C.red, 8, 'right');
    // uv coverage (bottom)
    const ux = this.w * 0.5, uy = this.h * 0.74, Ru = Math.min(this.h * 0.17, this.w * 0.12);
    this.circle(ux, uy, Ru, C.grid); this.line(ux - Ru, uy, ux + Ru, uy, C.grid); this.line(ux, uy - Ru, ux, uy + Ru, C.grid); this.text('uv plane (baselines seen from the source)', ux, uy - Ru - 8, C.dim, 8, 'center');
    const Hn = (this.t * 0.15) % (TAU);
    if (this.playing || this.uv.length === 0) { const decl = 45 * DEG; for (let i = 0; i < pos.length; i++) for (let j = i + 1; j < pos.length; j++) { const b = (pos[j] - pos[i]); const u = b * Math.sin(Hn), v = b * Math.cos(Hn) * Math.sin(decl); this.uv.push([u, v], [-u, -v]); } if (this.uv.length > 4000) this.uv.splice(0, this.uv.length - 4000); }
    for (const [u, v] of this.uv) { c.fillStyle = hexA(C.blue, 0.5); c.fillRect(ux + u * Ru * 0.95 - 1, uy - v * Ru * 0.95 - 1, 2, 2); }
    this.text(`${pos.length} antennas → ${pos.length * (pos.length - 1) / 2} baselines${this.playing ? ' · Earth rotating' : ''}`, ux, uy + Ru + 10, C.text, 8, 'center');
    const eq = 1.22 * lam / fr * 1;
    this.setReadout([
      ['Resolution θ ≈ λ/B', fmtAngle(fr / ARCSEC), C.accent],
      ['Resolution of a single dish', `${fmtLen(B)} wide — but only ${pos.length} × 25 m of area`],
      ['Source of this size', vis > 0.9 ? 'unresolved: full fringes' : vis > 0.1 ? 'partly resolved: fringes fade' : 'resolved out: no fringes', vis > 0.5 ? C.green : C.red],
      ['Famous baselines', 'VLA 36 km · VLBA 8600 km · EHT 10 700 km'],
    ]); void eq;
  }
}

/* ------------------------------------------------- 58. atmospheric windows ---- */

const SITES: Array<[string, number]> = [['sea level', 0], ['Mauna Kea 4.2 km', 4.2], ['SOFIA 13 km', 13], ['balloon 40 km', 40], ['orbit', 400]];
class AtmWindowWidget extends CanvasWidget {
  private alt = 0; private sA!: { set: (v: number) => void };
  constructor() {
    super(480 / 230);
    this.segmented<string>(SITES.map(([n]) => [n, n] as [string, string]), 'sea level', (n) => { this.alt = SITES.find(([k]) => k === n)![1]; this.sA.set(Math.min(60, this.alt)); });
    this.sA = this.slider('Altitude', 0, 60, 0.1, 0, (v) => `${fmt(v, 1)} km`, (v) => { this.alt = v; });
  }
  /** transmission at wavelength λ (m) from space down to altitude h (km) */
  private T(lam: number, h: number): number {
    const fAir = Math.exp(-h / 8), fH2O = Math.exp(-h / 2), fO3 = h < 15 ? 1 : h < 35 ? (35 - h) / 20 : 0;
    const lg = Math.log10(lam); let tau = 0;
    const band = (c0: number, w: number, depth: number) => depth * Math.exp(-(((lg - c0) / w) ** 2));
    // UV / X / gamma: O2, N2, O3
    if (lam < 3.1e-7) tau += 30 * fO3 * Math.min(1, (3.1e-7 - lam) / 2e-8 + 0.05) + 40 * fAir * (lam < 2e-7 ? 1 : 0);
    if (lam < 1e-8) tau += 200 * fAir;
    tau += 0.1 * fAir * (lam < 5e-7 ? (5e-7 / lam) ** 4 * 0.3 : 0);  // Rayleigh (blue)
    // IR water & CO2 bands
    for (const [c0, w, d] of [[Math.log10(0.94e-6), 0.012, 1.5], [Math.log10(1.14e-6), 0.012, 2], [Math.log10(1.38e-6), 0.02, 6], [Math.log10(1.87e-6), 0.02, 6], [Math.log10(2.7e-6), 0.04, 20], [Math.log10(3.2e-6), 0.02, 4], [Math.log10(6.3e-6), 0.09, 30], [Math.log10(15e-6), 0.07, 25], [Math.log10(4.3e-6), 0.015, 15]] as Array<[number, number, number]>) tau += band(c0, w, d) * (c0 === Math.log10(4.3e-6) || c0 === Math.log10(15e-6) ? fAir : fH2O);
    if (lam > 20e-6 && lam < 1e-3) tau += 40 * fH2O * Math.min(1, (lg - Math.log10(20e-6)) / 0.5) * (lam > 3e-4 ? Math.max(0.15, 1 - (lg - Math.log10(3e-4)) / 0.8) : 1);
    if (lam > 3.3e-4 && lam < 4e-4) tau -= 25 * fH2O * Math.exp(-(((lg - Math.log10(3.5e-4)) / 0.015) ** 2)) * 0; // (sub-mm windows are left to the general term)
    for (const c0 of [Math.log10(1.35e-2), Math.log10(5e-3), Math.log10(1.6e-3)]) tau += band(c0, 0.02, 1.5) * fH2O;
    // ionosphere
    if (lam > 15) tau += 50 * Math.min(1, (lg - Math.log10(15)) / 0.4) * (h < 300 ? 1 : 0);
    return Math.exp(-Math.max(0, tau));
  }
  protected draw() {
    const c = this.ctx; c.fillStyle = C.bg; c.fillRect(0, 0, this.w, this.h);
    const x0 = 36, x1 = this.w - 12, y0 = 26, y1 = this.h - 40; const lg0 = -10, lg1 = 2.5;
    const X = (lam: number) => x0 + (Math.log10(lam) - lg0) / (lg1 - lg0) * (x1 - x0);
    const bands: Array<[number, number, string, string]> = [[1e-10, 1e-8, 'X-ray', C.purple], [1e-8, 3.8e-7, 'UV', '#a88cff'], [3.8e-7, 7.8e-7, 'visible', '#fff'], [7.8e-7, 1e-3, 'infrared', '#ff9c6a'], [1e-3, 1e-1, 'microwave', '#ffd27a'], [1e-1, 3e2, 'radio', '#9ad0a0']];
    for (const [a, b, n, col] of bands) { c.fillStyle = hexA(col === '#fff' ? '#ffffff' : col, 0.06); c.fillRect(X(a), y0, X(b) - X(a), y1 - y0); this.text(n, (X(a) + X(b)) / 2, y0 - 10, col, 8, 'center'); }
    rainbow(c, (nm) => X(nm * 1e-9), y0 - 16, 4, 0.9);
    c.beginPath(); c.moveTo(x0, y1);
    for (let i = 0; i <= x1 - x0; i++) { const lam = 10 ** (lg0 + i / (x1 - x0) * (lg1 - lg0)); const T = this.T(lam, this.alt); c.lineTo(x0 + i, y1 - T * (y1 - y0)); }
    c.lineTo(x1, y1); c.closePath(); c.fillStyle = hexA(C.blue, 0.35); c.fill(); c.strokeStyle = C.blue; c.stroke();
    this.line(x0, y1, x1, y1, C.line); this.line(x0, y0, x0, y1, C.line); this.text('T', x0 - 6, y0 - 12, C.dim, 7, 'right'); this.text('1', x0 - 6, y0, C.dim, 7, 'right'); this.text('0', x0 - 6, y1, C.dim, 7, 'right');
    for (const lg of [-9, -7, -5, -3, -1, 1]) { const x = X(10 ** lg); this.line(x, y1, x, y1 + 4, C.line); this.text(fmtLambda(10 ** lg), x, y1 + 12, C.dim, 7, 'center'); }
    const obs: Array<[number, string]> = [[1e-9, 'Chandra'], [1.5e-7, 'Hubble UV'], [5.5e-7, 'VLT'], [2.2e-6, 'Keck AO'], [1e-5, 'JWST'], [1e-4, 'Herschel'], [1.3e-3, 'ALMA'], [2.1e-1, 'VLA'], [3, 'LOFAR']];
    for (const [lam, n] of obs) { const T = this.T(lam, this.alt); const x = X(lam); this.circle(x, y1 - T * (y1 - y0), 3, undefined, T > 0.5 ? C.green : C.red); this.text(n, x, y1 + 24, T > 0.5 ? C.green : C.dim, 7, 'center'); }
    const h = this.alt; const windows: string[] = []; const probe: Array<[string, number]> = [['UV', 2e-7], ['visible', 5.5e-7], ['near-IR K', 2.2e-6], ['mid-IR 10 µm', 1e-5], ['far-IR', 1e-4], ['sub-mm', 8.5e-4], ['radio', 0.21], ['X-ray', 1e-9]];
    for (const [n, lam] of probe) if (this.T(lam, h) > 0.5) windows.push(n);
    this.setReadout([
      ['Altitude', `${fmt(h, 1)} km: above ${fmt((1 - Math.exp(-h / 8)) * 100, h > 30 ? 2 : 0)} % of air, ${fmt((1 - Math.exp(-h / 2)) * 100, h > 10 ? 2 : 0)} % of H₂O`, C.accent],
      ['Open windows (T > 0.5)', windows.join(', ') || 'none'],
      ['Still closed', probe.filter(([n]) => !windows.includes(n)).map(([n]) => n).join(', ') || 'nothing'],
      ['Blocked by', h < 15 ? 'O₃ (UV) · H₂O, CO₂ (IR) · O₂, N₂ (X-ray)' : h < 35 ? 'residual O₃ (UV) · O₂, N₂ (X-ray)' : h < 300 ? 'residual air (soft X-ray)' : 'nothing'],
    ]);
  }
}

/* ------------------------------------------------- 59. infrared: the warm telescope ---- */

class IrThermalWidget extends CanvasWidget {
  private lgT = Math.log10(290); private lgBand = Math.log10(10e-6); private target = 1;
  private readonly TGT: Array<[string, number, string]> = [['dust cloud 30 K', 30, 'far-IR, 100 µm'], ['protostar / exoplanet 300 K', 300, 'mid-IR, 10 µm'], ['brown dwarf 1000 K', 1000, 'near-IR, 3 µm'], ['z = 10 galaxy (3000 K → 3 µm)', 300, 'rest-frame UV redshifted into the IR']];
  constructor() {
    super(480 / 240);
    this.segmented<string>([['amb', 'ground telescope 290 K'], ['n2', 'LN₂ 77 K'], ['jwst', 'JWST 40 K'], ['he', 'liquid He 4 K']], 'amb', (v) => { this.lgT = Math.log10({ amb: 290, n2: 77, jwst: 40, he: 4.2 }[v]!); this.sT.set(this.lgT); });
    this.sT = this.slider('Telescope temperature', Math.log10(3), Math.log10(320), 0.01, this.lgT, (v) => `${fmt(10 ** v, 0)} K`, (v) => { this.lgT = v; });
    this.slider('Observing wavelength', Math.log10(0.6e-6), Math.log10(500e-6), 0.01, this.lgBand, (v) => fmtLambda(10 ** v), (v) => { this.lgBand = v; });
  }
  private sT!: { set: (v: number) => void };
  protected draw() {
    const c = this.ctx; c.fillStyle = C.bg; c.fillRect(0, 0, this.w, this.h);
    const T = 10 ** this.lgT, lamB = 10 ** this.lgBand; const eps = 0.04; // emissivity of mirror + structure seen by the detector
    const x0 = 44, x1 = this.w - 12, y0 = 18, y1 = this.h - 36; const lg0 = Math.log10(0.5e-6), lg1 = Math.log10(1e-3);
    const X = (lam: number) => x0 + (Math.log10(lam) - lg0) / (lg1 - lg0) * (x1 - x0);
    const yTop = Math.log10(planck(9.7e-6, 300) * eps * 1e3), yBot = yTop - 14; const Y = (B: number) => y1 - Math.max(0, Math.min(1, (Math.log10(Math.max(B, 1e-300)) - yBot) / (yTop - yBot))) * (y1 - y0);
    this.line(x0, y1, x1, y1, C.line); this.line(x0, y0, x0, y1, C.line); this.text('log B_λ', x0 - 4, y0 - 4, C.dim, 7, 'right');
    for (const lam of [1e-6, 3e-6, 1e-5, 3e-5, 1e-4, 3e-4]) { const x = X(lam); this.line(x, y1, x, y1 + 4, C.line); this.text(fmtLambda(lam), x, y1 + 12, C.dim, 7, 'center'); }
    const curves: Array<[number, number, string, string]> = [[T, eps, C.red, `telescope ${fmt(T, 0)} K × ε 0.04`], [250, 0.15, C.sun, 'sky 250 K (ground only)'], [2.725, 1, C.purple, 'CMB 2.7 K']];
    curves.forEach(([Tc, e, col, lab], ci) => { if (lab.startsWith('sky') && T < 200) return; c.beginPath(); let first = true; for (let i = 0; i <= 200; i++) { const lam = 10 ** (lg0 + i / 200 * (lg1 - lg0)); const B = planck(lam, Tc) * e; const y = Y(B); if (y >= y1 - 0.5) { first = true; continue; } first ? c.moveTo(X(lam), y) : c.lineTo(X(lam), y); first = false; } c.strokeStyle = col; c.lineWidth = 1.5; c.stroke(); const lmax = 2.898e-3 / Tc; const yl = Math.max(y0 + 6, Y(planck(lmax, Tc) * e) - 9); if (lmax > 0.5e-6 && lmax < 1e-3) { if (ci === 0) this.text(lab, X(lmax) - 8, yl, col, 8, 'right'); else this.text(lab, Math.min(x1 - 4, X(lmax) + 8), yl + (ci === 1 ? 12 : 0), col, 8, 'left'); } else this.text(lab, x1 - 4, Y(planck(1e-3, Tc) * e) - 8, col, 8, 'right'); });
    // target: a faint source — draw as a flat dim line scaled to show where it sits relative to background (schematic)
    const [tn, tT, tband] = this.TGT[this.target]; void tband;
    const dil = 1e-6; c.beginPath(); for (let i = 0; i <= 200; i++) { const lam = 10 ** (lg0 + i / 200 * (lg1 - lg0)); const y = Y(planck(lam, tT) * dil); i ? c.lineTo(X(lam), y) : c.moveTo(X(lam), y); } c.strokeStyle = C.green; c.setLineDash([3, 3]); c.stroke(); c.setLineDash([]);
    this.text(`target: ${tn} (diluted 10⁻⁶)`, x0 + 6, y0 + 6, C.green, 8);
    const xb = X(lamB); c.fillStyle = hexA(C.accent, 0.12); c.fillRect(xb - 6, y0, 12, y1 - y0); this.line(xb, y0, xb, y1, C.accent); this.text('band', xb, y1 - 6, C.accent, 7, 'center');
    const bgTel = planck(lamB, T) * eps, bg300 = planck(lamB, 290) * eps, sig = planck(lamB, tT) * dil;
    const gain = 2.5 * Math.log10(bg300 / Math.max(bgTel, 1e-300));
    this.setReadout([
      ['Telescope peak λ_max = 2898 µm·K / T', fmtLambda(2.898e-3 / T), C.red],
      ['Telescope glow in the band', `${sci(bgTel, 1)} W m⁻³ sr⁻¹`, gain > 5 ? C.green : gain > 1 ? C.sun : C.red],
      ['Target / background · cooling gain', `${sci(sig / Math.max(bgTel, 1e-300), 1)} · ${fmt(gain, 1)} mag vs 290 K`, sig > bgTel ? C.green : C.red],
      ['Rule', lamB < 2.5e-6 ? 'near-IR: OH sky lines dominate' : lamB < 30e-6 ? 'mid-IR: cool the telescope below ~50 K' : 'far-IR: telescope < 10 K, space only'],
    ]);
    this.target = lamB < 2.5e-6 ? 2 : lamB < 30e-6 ? 1 : 0;
  }
}

/* ------------------------------------------------- 60. grazing-incidence X-ray mirrors ---- */

class GrazingWidget extends CanvasWidget {
  private lgE = 0; private ang = 0.8; private coat: 'au' | 'ir' | 'ni' | 'ml' = 'ir'; private t = 0; private photons: Array<{ s: number; ok: boolean; shell: number }> = []; private acc = 0; private hit = 0; private lost = 0;
  constructor() {
    super(480 / 240);
    this.segmented<'au' | 'ir' | 'ni' | 'ml'>([['ir', 'iridium (Chandra)'], ['au', 'gold (XMM)'], ['ni', 'nickel'], ['ml', 'multilayer (NuSTAR)']], 'ir', (v) => { this.coat = v; this.reset(); });
    this.slider('Photon energy', -1, Math.log10(80), 0.01, 0, (v) => fmtEnergy(10 ** v * 1000), (v) => { this.lgE = v; this.reset(); });
    this.slider('Grazing angle', 0.05, 4, 0.01, 0.8, (v) => `${fmt(v, 2)}°`, (v) => { this.ang = v; this.reset(); });
  }
  private reset() { this.hit = 0; this.lost = 0; }
  private thetaC(E: number) { const rho = { au: 19.3, ir: 22.6, ni: 8.9, ml: 19.3 }[this.coat]; return 3.6 * Math.sqrt(rho / 19) / E; }
  private R(th: number, E: number) { const tc = this.thetaC(E); if (this.coat === 'ml') { const base = th < tc ? 0.85 : 0; const bragg = th < 3.5 * tc && th >= tc ? 0.45 * Math.exp(-(((th - 2 * tc) / (1.2 * tc)) ** 2)) + 0.25 : 0; return Math.max(base, bragg) * Math.exp(-((th / 6) ** 2)); } if (th <= tc) return 0.92 - 0.3 * (th / tc) ** 4; const r = th / tc; const s = Math.sqrt(r * r - 1); return 0.92 * ((r - s) / (r + s)) ** 2; }
  protected draw(dt: number) {
    this.t += dt;
    const c = this.ctx; c.fillStyle = C.bg; c.fillRect(0, 0, this.w, this.h);
    const E = 10 ** this.lgE; const R1 = this.R(this.ang, E); const R2 = R1 * R1;
    // Wolter-I nested shells (left)
    const x0 = 12, x1 = this.w * 0.46, ax = this.h * 0.56, fx = this.w * 0.58; const shells = [0.42, 0.33, 0.25, 0.18];
    for (const s of shells) { const r = s * this.h * 0.6; for (const sg of [-1, 1]) { this.line(x0, ax + sg * r, x1 * 0.62, ax + sg * r * 0.84, C.blue, 2); this.line(x1 * 0.62, ax + sg * r * 0.84, x1, ax + sg * r * 0.55, C.blue, 2); } }
    this.text('paraboloid', x1 * 0.35, ax - shells[0] * this.h * 0.6 - 10, C.dim, 7, 'center'); this.text('hyperboloid', x1 * 0.8, ax - shells[0] * this.h * 0.6 - 10, C.dim, 7, 'center');
    this.line(x1, ax, fx + 10, ax, C.faint, 1, [3, 3]); this.circle(fx, ax, 3, C.accent); this.text('focus', fx, ax + 12, C.accent, 7, 'center');
    this.acc += dt * 10; while (this.acc >= 1) { this.acc -= 1; const sh = Math.floor(Math.random() * shells.length); const ok = Math.random() < R2; this.photons.push({ s: 0, ok, shell: sh }); if (ok) this.hit++; else this.lost++; }
    for (let i = this.photons.length - 1; i >= 0; i--) { const p = this.photons[i]; p.s += dt * 1.1; const r = shells[p.shell] * this.h * 0.6 * 0.98; let x: number, y: number; const stage = p.s < 0.4 ? 0 : p.s < 0.6 ? 1 : 2; if (stage === 0) { const u = p.s / 0.4; x = x0 - 20 + (x1 * 0.62 - x0 + 20) * u; y = ax - r; } else if (stage === 1) { const u = (p.s - 0.4) / 0.2; x = x1 * 0.62 + (x1 - x1 * 0.62) * u; y = ax - r * (0.86 - 0.3 * u); } else { const u = (p.s - 0.6) / 0.4; x = x1 + (fx - x1) * u; y = ax - r * 0.56 * (1 - u); } if (!p.ok && p.s > 0.4 + Math.random() * 0.02) { this.glow(x, y, 5, hexA(C.red, 0.8)); this.photons.splice(i, 1); continue; } if (p.s > 1) { this.photons.splice(i, 1); continue; } this.glow(x, y, 3.5, hexA(C.purple, 0.95)); }
    this.text(`${fmt(E, E < 1 ? 2 : 1)} keV photons at ${fmt(this.ang, 2)}°`, x0, 12, C.text, 9);
    // reflectivity curve (right)
    const gx0 = this.w * 0.66, gx1 = this.w - 16, gy0 = 30, gy1 = this.h * 0.7;
    this.line(gx0, gy1, gx1, gy1, C.line); this.line(gx0, gy0, gx0, gy1, C.line); this.text('reflectivity vs grazing angle', gx0, gy0 - 14, C.dim, 8);
    c.beginPath(); for (let i = 0; i <= 150; i++) { const th = i / 150 * 4; const y = gy1 - this.R(th, E) * (gy1 - gy0); i ? c.lineTo(gx0 + i / 150 * (gx1 - gx0), y) : c.moveTo(gx0, y); } c.strokeStyle = C.purple; c.lineWidth = 1.5; c.stroke();
    for (const th of [1, 2, 3, 4]) this.text(`${th}°`, gx0 + th / 4 * (gx1 - gx0), gy1 + 10, C.dim, 7, 'center');
    const xa = gx0 + this.ang / 4 * (gx1 - gx0); this.line(xa, gy0, xa, gy1, hexA(C.accent, 0.7), 1, [3, 3]); this.circle(xa, gy1 - R1 * (gy1 - gy0), 3, undefined, C.accent);
    const tc = this.thetaC(E); if (tc < 4) this.text(`θc ≈ ${fmt(tc, 2)}°`, Math.min(gx1 - 26, gx0 + tc / 4 * (gx1 - gx0)), gy0 + 8, C.red, 8, 'center');
    const total = this.hit + this.lost; this.text(`${total ? fmt(this.hit / total * 100, 0) : '–'} % of photons reach the focus (two bounces)`, gx0, gy1 + 26, R2 > 0.5 ? C.green : R2 > 0.1 ? C.sun : C.red, 9);
    const fl = 10; const rmax = fl * Math.tan(4 * this.ang * DEG);
    this.setReadout([
      ['Critical angle θc ≈ 3.6° √(ρ/19) / E', `${fmt(tc, 2)}° at ${fmt(E, 1)} keV`, C.accent],
      ['Reflectivity: one bounce · two', `${fmt(R1 * 100, 0)} % · ${fmt(R2 * 100, 0)} %`, R2 > 0.5 ? C.green : C.red],
      ['Shell radius r ≈ f tan 4θ (f = 10 m)', `${fmt(rmax, 2)} m — thin rings, nest many`],
      ['Design', this.coat === 'ml' ? 'Bragg multilayers work beyond θc (NuSTAR, 79 keV)' : 'total external reflection below θc only'],
    ]);
  }
}

/* ------------------------------------------------- 61. gamma-ray detection ---- */

type GTech = 'mask' | 'compton' | 'pair' | 'cherenkov';
class GammaDetectWidget extends CanvasWidget {
  private lgE = 2; private t = 0; private override: GTech | 'auto' = 'auto';
  constructor() {
    super(480 / 250);
    this.segmented<GTech | 'auto'>([['auto', 'choose by energy'], ['mask', 'coded mask'], ['compton', 'Compton'], ['pair', 'pair conversion'], ['cherenkov', 'Cherenkov']], 'auto', (v) => { this.override = v; });
    this.slider('Photon energy', Math.log10(20), Math.log10(1e8), 0.01, 2, (v) => fmtEnergy(10 ** v * 1e3), (v) => { this.lgE = v; });
  }
  private tech(): GTech { if (this.override !== 'auto') return this.override; const E = 10 ** this.lgE; return E < 500 ? 'mask' : E < 3e4 ? 'compton' : E < 1e8 * 0.5 ? 'pair' : 'cherenkov'; }
  protected draw(dt: number) {
    this.t += dt; const c = this.ctx; c.fillStyle = C.bg; c.fillRect(0, 0, this.w, this.h);
    const E = 10 ** this.lgE, tech = this.tech(); const ph = (this.t % 2.4) / 2.4; const W = this.w, H = this.h;
    const info: Record<GTech, [string, string, string]> = {
      mask: ['Swift-BAT, INTEGRAL', '~arcminutes', '20 keV – 10 MeV'],
      compton: ['COMPTEL, COSI', '1–3°', '0.3 – 30 MeV'],
      pair: ['Fermi-LAT, AGILE', '0.1–1°', '20 MeV – 300 GeV'],
      cherenkov: ['H.E.S.S., MAGIC, VERITAS, CTA', '0.05–0.1°', '50 GeV – 100 TeV'],
    };
    if (tech === 'mask') {
      const mx = W * 0.2, mw = W * 0.5, my = H * 0.22, dy = H * 0.72; const rnd = mulberry(5); const cells = 24; const pat: boolean[] = []; for (let i = 0; i < cells; i++) pat.push(rnd() < 0.5);
      for (let i = 0; i < cells; i++) if (pat[i]) { c.fillStyle = '#8a8f99'; c.fillRect(mx + i * mw / cells, my - 4, mw / cells, 8); }
      this.text('tungsten coded mask', mx + mw / 2, my - 16, C.text, 9, 'center'); c.fillStyle = '#2a3140'; c.fillRect(mx, dy, mw, 8); this.text('position-sensitive detector (CdZnTe)', mx + mw / 2, dy + 20, C.text, 9, 'center');
      const srcAng = 0.25 * Math.sin(this.t * 0.4); for (let i = 0; i < cells; i++) if (!pat[i]) { const xm = mx + (i + 0.5) * mw / cells; const xd = xm + srcAng * (dy - my); c.fillStyle = hexA(C.purple, 0.45); c.fillRect(xd - mw / cells / 2, dy - 2, mw / cells, 6); }
      for (let k = 0; k < 10; k++) { const u = (ph + k / 10) % 1; const i = Math.floor(((k * 7) % cells)); const xm = mx + (i + 0.5) * mw / cells; const xs = xm - srcAng * (my - 0) ; const x = xs + (xm + srcAng * (dy - my) - xs) * u, y = u * dy; if (pat[i] && y > my) continue; this.glow(x, y, 3, hexA(C.purple, 0.9)); }
      this.text('the shadow pattern shifts with the source direction → decode it', mx + mw / 2, H * 0.9, C.dim, 8, 'center');
    } else if (tech === 'compton') {
      const d1 = H * 0.4, d2 = H * 0.72; c.fillStyle = '#2a3140'; c.fillRect(W * 0.15, d1, W * 0.45, 6); c.fillRect(W * 0.15, d2, W * 0.45, 10); this.text('scatter layer (Si / Ge)', W * 0.62, d1 + 3, C.text, 8); this.text('absorber (CsI / Ge)', W * 0.62, d2 + 5, C.text, 8);
      const px = W * 0.35; const theta = 40 * DEG; const sx = px + Math.tan(theta) * (d2 - d1); const u = ph; if (u < 0.5) this.glow(px, u / 0.5 * d1, 4, hexA(C.purple, 0.95)); else { const v = (u - 0.5) / 0.5; this.glow(px + (sx - px) * v, d1 + (d2 - d1) * v, 4, hexA(C.purple, 0.95)); this.glow(px - 20 * v, d1 + 30 * v, 2.5, hexA(C.blue, 0.9)); }
      this.line(px, 0, px, d1, hexA(C.purple, 0.3), 1, [3, 3]); this.line(px, d1, sx, d2, hexA(C.purple, 0.3), 1, [3, 3]);
      this.text(`θ from E₁, E₂: cos θ = 1 − mₑc² (1/E₂ − 1/E)`, W * 0.15, H * 0.9, C.dim, 8);
      const cx = W * 0.84, cy = H * 0.42, r = H * 0.22; this.circle(cx, cy, r, hexA(C.purple, 0.7)); this.circle(cx + r * 0.6, cy - r * 0.2, r * 0.9, hexA(C.purple, 0.5)); this.circle(cx - r * 0.3, cy + r * 0.5, r * 0.95, hexA(C.purple, 0.5)); this.circle(cx + r * 0.5, cy + r * 0.6, 3, undefined, C.sun); this.text('event circles on the sky', cx, cy + r + 14, C.dim, 7, 'center'); this.text('intersect at the source', cx, cy + r + 24, C.sun, 7, 'center');
    } else if (tech === 'pair') {
      const top = H * 0.18, bot = H * 0.7; for (let i = 0; i < 8; i++) { const y = top + i * (bot - top) / 8; c.fillStyle = i % 2 ? '#3b4252' : '#2a3140'; c.fillRect(W * 0.2, y, W * 0.4, 3); }
      c.fillStyle = '#4a3a2a'; c.fillRect(W * 0.2, bot + 6, W * 0.4, H * 0.14); this.text('tungsten converter foils + silicon strip trackers', W * 0.62, top + 8, C.text, 8); this.text('CsI calorimeter: total energy', W * 0.62, bot + 16, C.text, 8); this.text('anti-coincidence shield vetoes charged cosmic rays', W * 0.62, bot - 20, C.dim, 7);
      const px = W * 0.38, conv = top + (bot - top) * 0.3; if (ph < 0.4) this.glow(px, ph / 0.4 * conv, 4, hexA(C.purple, 0.95)); else { const v = (ph - 0.4) / 0.6; const yy = conv + (bot + 20 - conv) * v; this.line(px, conv, px - 14 * v, yy, C.blue, 1.5); this.line(px, conv, px + 14 * v, yy, C.red, 1.5); this.glow(px - 14 * v, yy, 3, hexA(C.blue, 0.9)); this.glow(px + 14 * v, yy, 3, hexA(C.red, 0.9)); }
      this.line(px, 0, px, conv, hexA(C.purple, 0.3), 1, [3, 3]); this.text('γ → e⁺ e⁻  (E > 1.022 MeV); the pair\'s bisector points back to the source', W * 0.2, H * 0.92, C.dim, 8);
    } else {
      const gy = H * 0.86; c.fillStyle = '#1a2a1a'; c.fillRect(0, gy, W, H - gy); for (const x of [W * 0.3, W * 0.5, W * 0.7]) { c.beginPath(); c.moveTo(x - 10, gy); c.quadraticCurveTo(x, gy - 14, x + 10, gy); c.strokeStyle = C.blue; c.lineWidth = 2; c.stroke(); c.lineWidth = 1; }
      this.text('12–28 m Cherenkov telescopes, 100 m apart', W * 0.5, gy - 22, C.text, 8, 'center');
      if (ph < 0.3) { this.glow(W * 0.5, ph / 0.3 * H * 0.2, 4, hexA(C.purple, 0.95)); }
      else { const v = (ph - 0.3) / 0.7; const depth = H * 0.2 + v * (gy - H * 0.2); const rnd = mulberry(Math.floor(this.t / 2.4)); c.strokeStyle = hexA(C.blue, 0.5); for (let i = 0; i < 40; i++) { const y0 = H * 0.2 + rnd() * (depth - H * 0.2); const x0 = W * 0.5 + (rnd() - 0.5) * (y0 - H * 0.2) * 0.3; const L = 20 + rnd() * 30; const y1 = Math.min(depth, y0 + L); const x1 = x0 + (rnd() - 0.5) * 12; if (y0 < depth) this.line(x0, y0, x1, y1, hexA(C.blue, 0.5)); } if (v > 0.5) { c.fillStyle = hexA(C.blue, 0.12 * (v - 0.5) * 2); c.beginPath(); c.moveTo(W * 0.5, H * 0.3); c.lineTo(W * 0.2, gy); c.lineTo(W * 0.8, gy); c.closePath(); c.fill(); } }
      this.text('air shower: ~10⁹ particles at 10 km; a 5 ns flash of blue light lights a 250 m pool on the ground', W * 0.5, H * 0.08, C.dim, 8, 'center');
    }
    const [instr, res, range] = info[tech];
    const rate = 1e-3 * (E / 1e5) ** -1.5; // photons m⁻² s⁻¹ above E for a bright source (very rough, Crab-like)
    this.setReadout([
      ['Technique', `${tech === 'mask' ? 'coded-mask shadowgram' : tech === 'compton' ? 'Compton telescope' : tech === 'pair' ? 'pair-conversion tracker' : 'imaging atmospheric Cherenkov'}  (${range})`, C.accent],
      ['Instruments', instr],
      ['Angular resolution', res, C.sun],
      ['Crab photons above this energy', `≈ ${sci(rate, 1)} m⁻² s⁻¹ → ${rate > 1e-4 ? 'a 1 m² satellite works' : 'need the atmosphere (10⁵ m²)'}`],
    ]);
  }
}

/* ------------------------------------------------- 62. one galaxy, seven skies ---- */

type Band = 'radio' | 'hi' | 'fir' | 'nir' | 'vis' | 'uv' | 'xray' | 'gamma';
class MultiviewWidget extends CanvasWidget {
  private band: Band = 'vis'; private maps: Record<string, Float32Array> | null = null; private readonly NX = 180; private readonly NY = 110; private img: ImageData | null = null; private t = 0;
  constructor() {
    super(480 / 290);
    this.segmented<Band>([['radio', 'radio continuum'], ['hi', 'HI 21 cm'], ['fir', 'far-IR'], ['nir', 'near-IR'], ['vis', 'visible'], ['uv', 'ultraviolet'], ['xray', 'X-ray'], ['gamma', 'gamma']], 'vis', (v) => { this.band = v; });
  }
  private build() {
    const NX = this.NX, NY = this.NY; const mk = () => new Float32Array(NX * NY);
    const old = mk(), arms = mk(), dust = mk(), hi = mk(), halo = mk(), pts = mk(), jets = mk(), bulge = mk();
    const rnd = mulberry(42); const incl = 0.55; const cx = NX / 2, cy = NY / 2; const Rd = NX * 0.14;
    for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
      const x = (i - cx) / Rd, y = (j - cy) / Rd / incl; const r = Math.hypot(x, y), th = Math.atan2(y, x); const o = j * NX + i;
      old[o] = Math.exp(-r / 1.2); bulge[o] = Math.exp(-((r / 0.25) ** 0.8)) * 1.5;
      let a = 0, d = 0; for (const k of [0, Math.PI]) { const phi = Math.log(Math.max(r, 0.05)) / 0.3 + k; let dphi = ((th - phi) % TAU + TAU) % TAU; if (dphi > Math.PI) dphi -= TAU; a += Math.exp(-((dphi * r / 0.22) ** 2)); let dd = dphi + 0.22; dd = ((dd + Math.PI) % TAU + TAU) % TAU - Math.PI; d += Math.exp(-((dd * r / 0.14) ** 2)); }
      const taper = Math.exp(-(((r - 1.4) / 1.1) ** 2)) * (r > 0.3 ? 1 : r / 0.3);
      arms[o] = a * taper; dust[o] = d * taper * Math.exp(-r / 2.5) + 0.25 * Math.exp(-r / 1.0) * (r > 0.2 ? 1 : 0);
      hi[o] = Math.exp(-(((r - 1.6) / 1.4) ** 2)) * (1 - Math.exp(-((r / 0.4) ** 2))) + 0.3 * a * taper;
      const rs = Math.hypot((i - cx) / Rd, (j - cy) / Rd); halo[o] = Math.exp(-((rs / 1.6) ** 1.2)) * 0.8;
      const jl = Math.exp(-(((i - cx) / (Rd * 0.12)) ** 2)) * Math.exp(-Math.abs(j - cy) / (Rd * 1.6)) * (Math.abs(j - cy) > Rd * 0.2 ? 1 : 0.3); jets[o] = jl + Math.exp(-((rs / 1.5) ** 2)) * 0.35 + 0.3 * a * taper;
    }
    for (let n = 0; n < 60; n++) { const r = 0.3 + rnd() * 1.6, th = rnd() * TAU; const x = Math.round(cx + r * Math.cos(th) * Rd), y = Math.round(cy + r * Math.sin(th) * Rd * incl); if (x > 1 && x < NX - 1 && y > 1 && y < NY - 1) { const o = y * NX + x; const a = arms[o]; if (rnd() < 0.3 + a) { pts[o] += 2 + rnd() * 3; pts[o - 1] += 1; pts[o + 1] += 1; pts[o - NX] += 1; pts[o + NX] += 1; } } }
    this.maps = { old, arms, dust, hi, halo, pts, jets, bulge };
  }
  protected draw(dt: number) {
    this.t += dt; if (!this.maps) this.build();
    const c = this.ctx; c.fillStyle = C.bg; c.fillRect(0, 0, this.w, this.h);
    const m = this.maps!, NX = this.NX, NY = this.NY; if (!this.img) this.img = c.createImageData(NX, NY); const d = this.img.data;
    const cols: Record<Band, [[number, number, number], [number, number, number]]> = { radio: [[20, 40, 90], [255, 200, 120]], hi: [[10, 30, 40], [120, 230, 255]], fir: [[30, 10, 20], [255, 130, 60]], nir: [[20, 15, 10], [255, 220, 170]], vis: [[8, 10, 16], [255, 245, 230]], uv: [[10, 10, 30], [150, 170, 255]], xray: [[10, 10, 25], [190, 120, 255]], gamma: [[12, 8, 20], [255, 90, 160]] };
    for (let o = 0; o < NX * NY; o++) {
      let v = 0; let tint = 0; // tint: 0 = base colour, 1 = second colour
      switch (this.band) {
        case 'radio': v = m.jets[o] * 0.9; break;
        case 'hi': v = m.hi[o] * 0.9; break;
        case 'fir': v = m.dust[o] * 1.2 + m.bulge[o] * 0.15; break;
        case 'nir': v = m.old[o] * 0.9 + m.bulge[o] * 0.5 + m.arms[o] * 0.15; break;
        case 'vis': { const ext = Math.exp(-m.dust[o] * 2.2); v = (m.old[o] * 0.6 + m.bulge[o] * 0.4 + m.arms[o] * 0.7) * ext; tint = m.arms[o] * ext > m.old[o] ? 1 : 0; break; }
        case 'uv': v = m.arms[o] ** 1.5 * 1.1 * Math.exp(-m.dust[o] * 1.5) + m.bulge[o] * 0.03; break;
        case 'xray': v = m.halo[o] * 0.35 + m.pts[o] * 0.4 + m.bulge[o] * 0.5 * (Math.abs(Math.sin(this.t * 2)) > 0.1 ? 1 : 0.5); break;
        case 'gamma': v = m.old[o] * 0.12 + m.bulge[o] * 0.15 + (m.pts[o] > 3 ? 0.9 : 0) * (m.pts[o] > 0 ? 1 : 0) * ((o * 7919) % 5 === 0 ? 1 : 0.2); break;
      }
      if (this.band === 'vis') { const ext = Math.exp(-m.dust[o] * 2.2); const blue = m.arms[o] * ext; const warm = (m.old[o] * 0.6 + m.bulge[o] * 0.4) * ext; const tot = blue + warm; const vv = Math.pow(Math.min(1, tot * 0.9), 0.6); const fb = tot > 0 ? blue / tot : 0; d[o * 4] = 8 + (255 * (1 - fb * 0.3)) * vv; d[o * 4 + 1] = 10 + (235 * (1 - fb * 0.1)) * vv; d[o * 4 + 2] = 16 + (210 + 45 * fb) * vv; d[o * 4 + 3] = 255; continue; }
      const vv = Math.pow(Math.min(1, v), this.band === 'gamma' ? 0.9 : 0.55); const [c0, c1] = cols[this.band]; void tint;
      d[o * 4] = c0[0] + (c1[0] - c0[0]) * vv; d[o * 4 + 1] = c0[1] + (c1[1] - c0[1]) * vv; d[o * 4 + 2] = c0[2] + (c1[2] - c0[2]) * vv; d[o * 4 + 3] = 255;
    }
    const pw = Math.min(this.w - 16, (this.h - 46) * NX / NY), phh = pw * NY / NX, x0 = (this.w - pw) / 2, y0 = 8;
    const off = document.createElement('canvas'); off.width = NX; off.height = NY; off.getContext('2d')!.putImageData(this.img, 0, 0); c.imageSmoothingEnabled = true; c.drawImage(off, x0, y0, pw, phh); c.strokeStyle = C.line; c.strokeRect(x0, y0, pw, phh);
    const cap: Record<Band, [string, string, string]> = {
      radio: ['synchrotron: cosmic-ray electrons in the magnetic field; jets from the active nucleus', 'VLA, MeerKAT, LOFAR', 'non-thermal'],
      hi: ['cold atomic hydrogen, far beyond the stars; a hole in the centre where gas is molecular', 'VLA, FAST, SKA', '~100 K gas'],
      fir: ['dust warmed by hidden young stars: the dark lanes are now the bright ones', 'Herschel, Spitzer, JWST/MIRI', '20–50 K dust'],
      nir: ['the old stars that carry most of the mass; dust is transparent', '2MASS, Spitzer/IRAC, JWST/NIRCam', '3000–5000 K stars'],
      vis: ['photospheres of stars; blue arms, yellow bulge, dust lanes in silhouette', 'Hubble, VLT, Subaru, Rubin', '3000–30 000 K'],
      uv: ['only the hot young O and B stars: star formation in the last 100 Myr', 'GALEX, Hubble, Swift-UVOT', '> 20 000 K'],
      xray: ['hot halo gas and accreting binaries; the nucleus flickers', 'Chandra, XMM-Newton, eROSITA', '10⁶–10⁷ K'],
      gamma: ['cosmic rays hitting gas; a few pulsars; the nucleus if it is a blazar', 'Fermi-LAT, H.E.S.S.', 'non-thermal'],
    };
    const [what, who, temp] = cap[this.band];
    this.text(what, this.w / 2, y0 + phh + 14, C.text, 9, 'center');
    this.setReadout([['Band', this.band, C.accent], ['Telescopes', who], ['Temperature / mechanism', temp]]);
  }
}

/* ------------------------------------------------- 63. all-sky maps (Mollweide) ---- */

type SkyBand = 'r408' | 'hi' | 'dust' | 'nir' | 'opt' | 'xray' | 'gamma';
class SkyMapWidget extends CanvasWidget {
  private band: SkyBand = 'opt'; private readonly NX = 240; private readonly NY = 120; private img: Record<string, ImageData> = {}; private cur: [number, number] | null = null; private noise: Float32Array;
  private readonly MARK: Array<[number, number, string]> = [[0, 0, 'Galactic Centre'], [184.6, -5.8, 'Crab'], [263.6, -2.8, 'Vela'], [76.2, 5.8, 'Cyg A'], [309.5, 19.4, 'Cen A'], [280.5, -32.9, 'LMC'], [302.8, -44.3, 'SMC'], [121.2, -21.6, 'M31'], [209, -19.4, 'Orion'], [30, 60, 'N. Polar Spur']];
  constructor() {
    super(480 / 260);
    this.segmented<SkyBand>([['r408', 'radio 408 MHz'], ['hi', 'HI 21 cm'], ['dust', 'far-IR dust'], ['nir', 'near-IR stars'], ['opt', 'optical'], ['xray', 'soft X-ray'], ['gamma', 'gamma (Fermi)']], 'opt', (v) => { this.band = v; });
    const rnd = mulberry(1234); this.noise = new Float32Array(this.NX * this.NY); for (let i = 0; i < this.noise.length; i++) this.noise[i] = rnd();
    this.canvas.addEventListener('pointermove', (e) => { const { x, y } = canvasPos(this.canvas, e, this.w, this.h); this.cur = [x, y]; });
    this.canvas.addEventListener('pointerleave', () => { this.cur = null; });
    this.controls.appendChild($('div', 'lw-caption', 'Galactic coordinates: the Milky Way runs across the middle, its centre in the middle. Move the pointer to read l, b and the brightness in every band.'));
  }
  /** brightness 0..1 at galactic (l, b) degrees for a band */
  private B(band: SkyBand, l: number, b: number, n: number): number {
    const ab = Math.abs(b); const dl = ((l + 180) % 360 + 360) % 360 - 180; // −180..180, 0 at GC
    const plane = (w: number) => Math.exp(-((b / w) ** 2)); const centre = Math.exp(-((dl / 25) ** 2 + (b / 8) ** 2)); const bulge = Math.exp(-((dl / 12) ** 2 + (b / 7) ** 2));
    const blob = (l0: number, b0: number, w: number) => { let d = ((l - l0 + 540) % 360) - 180; return Math.exp(-((d * Math.cos(b * DEG) / w) ** 2 + ((b - b0) / w) ** 2)); };
    const lmc = blob(280.5, -32.9, 4), smc = blob(302.8, -44.3, 2.5), m31 = blob(121.2, -21.6, 1.5), ori = blob(209, -19.4, 6), oph = blob(355, 17, 7), taurus = blob(172, -15, 6);
    const spur = Math.exp(-(((Math.hypot(dl - 30, b - 15) - 55) / 8) ** 2)) * (b > 0 ? 1 : 0.2); // Loop I
    const cirrus = 0.6 * n + 0.4 * ((Math.sin(l * 0.3 + b * 0.5) + 1) / 2);
    switch (band) {
      case 'r408': return Math.min(1, 0.35 * plane(6) + 0.6 * centre + 0.35 * spur + 0.08 + 0.03 * n + blob(76.2, 5.8, 1.5) + blob(309.5, 19.4, 1.5) * 0.8 + blob(263.6, -2.8, 2) * 0.5 + blob(184.6, -5.8, 1.2) * 0.6);
      case 'hi': return Math.min(1, 0.7 * plane(9) * (1 - 0.2 * Math.cos(dl * DEG * 2)) + 0.25 * cirrus * Math.exp(-ab / 40) + 0.25 * lmc + 0.2 * smc + 0.08 * blob(290, -40, 15) + 0.05);
      case 'dust': return Math.min(1, 0.9 * plane(2.5) + 0.3 * plane(6) * (0.6 + 0.4 * centre) + 0.35 * ori + 0.3 * oph + 0.25 * taurus + 0.12 * cirrus * Math.exp(-ab / 25) + 0.3 * lmc + 0.15 * smc + 0.01);
      case 'nir': return Math.min(1, 0.6 * plane(3) + 0.8 * bulge + 0.2 * plane(10) * Math.exp(-Math.abs(dl) / 90) + 0.35 * lmc + 0.2 * smc + 0.4 * m31 + 0.03 + 0.04 * n);
      case 'opt': { const ext = Math.exp(-3 * (0.9 * plane(2.5) + 0.3 * ori + 0.3 * oph + 0.25 * taurus)); return Math.min(1, (0.5 * plane(8) * (0.7 + 0.5 * Math.exp(-Math.abs(dl) / 70)) + 0.6 * bulge + 0.05 + 0.06 * n) * ext + 0.35 * lmc + 0.2 * smc + 0.25 * m31); }
      case 'xray': { const absorb = Math.exp(-2.5 * plane(4)); return Math.min(1, (0.25 + 0.5 * spur + 0.2 * (b < 0 && Math.abs(dl) < 60 ? 1 : 0) * Math.exp(-ab / 30) + 0.1 * n + 0.6 * blob(263.6, -2.8, 4) + 0.5 * blob(76, 1, 4)) * absorb + 0.9 * blob(184.6, -5.8, 1.2) * 1 + 0.6 * bulge * absorb + 0.4 * blob(263.6, -2.8, 1)); }
      case 'gamma': { const bubbles = (Math.exp(-((dl / 20) ** 2 + ((b - 28) / 22) ** 2)) + Math.exp(-((dl / 20) ** 2 + ((b + 28) / 22) ** 2))) * 0.25; return Math.min(1, 0.7 * plane(3) * (0.6 + 0.6 * Math.exp(-Math.abs(dl) / 60)) + bubbles + 0.06 + 0.05 * n + 0.9 * blob(263.6, -2.8, 1.2) + 0.9 * blob(184.6, -5.8, 1.2) + 0.9 * blob(195.1, 4.3, 1.2) + 0.5 * blob(86, -38, 1.2) + 0.5 * blob(150, 50, 1.2) + 0.4 * lmc); }
    }
  }
  private render(band: SkyBand): ImageData {
    if (this.img[band]) return this.img[band];
    const NX = this.NX, NY = this.NY; const im = this.ctx.createImageData(NX, NY); const d = im.data;
    const pal: Record<SkyBand, [[number, number, number], [number, number, number], [number, number, number]]> = { r408: [[5, 5, 30], [200, 60, 40], [255, 240, 150]], hi: [[5, 10, 20], [30, 120, 160], [220, 255, 255]], dust: [[10, 5, 15], [180, 60, 20], [255, 230, 160]], nir: [[8, 6, 4], [170, 110, 60], [255, 240, 210]], opt: [[6, 7, 12], [150, 140, 130], [255, 250, 235]], xray: [[5, 5, 20], [80, 40, 160], [255, 220, 255]], gamma: [[8, 5, 15], [120, 30, 100], [255, 220, 120]] };
    const [p0, p1, p2] = pal[band];
    for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
      const o = (j * NX + i) * 4; const X = (i + 0.5) / NX * 2 - 1, Y = 1 - (j + 0.5) / NY * 2; // −1..1
      const th = Math.asin(Math.max(-1, Math.min(1, Y))); const inside = (X * X + Y * Y) <= 1.0001 && Math.abs(X) <= Math.cos(th) + 1e-9;
      if (!inside) { d[o] = 11; d[o + 1] = 14; d[o + 2] = 19; d[o + 3] = 255; continue; }
      const lon = -Math.PI * X / Math.max(1e-6, Math.cos(th)); const lat = Math.asin((2 * th + Math.sin(2 * th)) / Math.PI); // lon: east to the left (astronomical convention)
      const l = ((lon / DEG) + 360) % 360, b = lat / DEG; const v = Math.pow(this.B(band, l, b, this.noise[j * NX + i]), 0.75);
      const t = v < 0.5 ? v * 2 : (v - 0.5) * 2; const a = v < 0.5 ? p0 : p1, bb = v < 0.5 ? p1 : p2;
      d[o] = a[0] + (bb[0] - a[0]) * t; d[o + 1] = a[1] + (bb[1] - a[1]) * t; d[o + 2] = a[2] + (bb[2] - a[2]) * t; d[o + 3] = 255;
    }
    this.img[band] = im; return im;
  }
  protected draw() {
    const c = this.ctx; c.fillStyle = C.bg; c.fillRect(0, 0, this.w, this.h);
    const pw = Math.min(this.w - 16, (this.h - 70) * 2), phh = pw / 2, x0 = (this.w - pw) / 2, y0 = 10;
    const im = this.render(this.band); const off = document.createElement('canvas'); off.width = this.NX; off.height = this.NY; off.getContext('2d')!.putImageData(im, 0, 0); c.drawImage(off, x0, y0, pw, phh);
    c.beginPath(); c.ellipse(x0 + pw / 2, y0 + phh / 2, pw / 2, phh / 2, 0, 0, TAU); c.strokeStyle = C.line; c.stroke();
    const proj = (l: number, b: number): [number, number] => { let lon = ((l + 180) % 360) - 180; let th = b * DEG; for (let k = 0; k < 8; k++) th -= (2 * th + Math.sin(2 * th) - Math.PI * Math.sin(b * DEG)) / (2 + 2 * Math.cos(2 * th)); const X = -lon * DEG / Math.PI * Math.cos(th), Y = Math.sin(th); return [x0 + (X + 1) / 2 * pw, y0 + (1 - Y) / 2 * phh]; };
    for (const [l, b, n] of this.MARK) { const [x, y] = proj(l, b); this.circle(x, y, 2.5, hexA('#ffffff', 0.7)); this.text(n, x + 4, y - 6, hexA('#ffffff', 0.75), 7); }
    for (const l of [90, 180, 270]) { const [x] = proj(l, 0); this.text(`l = ${l}°`, x, y0 + phh + 8, C.dim, 7, 'center'); } this.text('l = 0', x0 + pw / 2, y0 + phh + 8, C.dim, 7, 'center');
    const src: Record<SkyBand, string> = { r408: 'Haslam et al. 1982 (synchrotron)', hi: 'HI4PI 2016 (21 cm column density)', dust: 'IRAS / Planck 100–350 µm', nir: '2MASS / COBE-DIRBE', opt: 'Mellinger / Gaia', xray: 'ROSAT 0.25–1.5 keV', gamma: 'Fermi-LAT > 1 GeV' };
    this.text(`schematic rendering of the ${src[this.band]} sky`, x0 + pw / 2, y0 + phh + 20, C.dim, 7, 'center');
    const pairs: Array<[string, string, string?]> = [['Map', src[this.band], C.accent]];
    if (this.cur) {
      const X = (this.cur[0] - x0) / pw * 2 - 1, Y = 1 - (this.cur[1] - y0) / phh * 2; const th = Math.asin(Math.max(-1, Math.min(1, Y)));
      if (X * X + Y * Y <= 1) { const lon = -Math.PI * X / Math.max(1e-6, Math.cos(th)); const lat = Math.asin((2 * th + Math.sin(2 * th)) / Math.PI); const l = ((lon / DEG) + 360) % 360, b = lat / DEG; const i = Math.floor((this.cur[0] - x0) / pw * this.NX), j = Math.floor((this.cur[1] - y0) / phh * this.NY); const n = this.noise[Math.max(0, Math.min(this.noise.length - 1, j * this.NX + i))];
        pairs.push(['Pointer', `l = ${fmt(l, 1)}°, b = ${fmt(b, 1)}°`]);
        const bands: SkyBand[] = ['r408', 'hi', 'dust', 'nir', 'opt', 'xray', 'gamma']; const names = ['radio', 'HI', 'dust', 'near-IR', 'optical', 'X-ray', 'gamma'];
        pairs.push(['Relative brightness here', bands.map((bd, k) => `${names[k]} ${'▮'.repeat(Math.round(this.B(bd, l, b, n) * 5))}`).join('  ')]); }
    } else pairs.push(['Pointer', 'move over the map']);
    this.setReadout(pairs);
  }
}

/* ------------------------------------------------- 64. data growth ---- */

const SURVEYS: Array<[string, number, number, string]> = [['POSS I (plates)', 1955, 3e12, '1872 plates, ~1.5 GB each if scanned'], ['IRAS', 1984, 1e11, 'whole sky in 10 months'], ['2MASS', 2001, 1.2e13, '4 million images'], ['SDSS DR7', 2009, 4e13, 'images + spectra'], ['Pan-STARRS1', 2016, 2e15, '1.6 billion objects'], ['Gaia (raw)', 2019, 1e15, '1.8 billion stars'], ['ZTF', 2021, 3e15, 'the northern sky every 2 nights'], ['Rubin (10 yr)', 2033, 5e17, '20 TB per night'], ['SKA (1 yr)', 2030, 6e17, '600 PB / yr archive']];
class DataGrowthWidget extends CanvasWidget {
  private year = 2010; private lgBw = Math.log10(1e8);
  constructor() {
    super(480 / 230);
    this.slider('Year', 1950, 2035, 1, 2010, (v) => `${v}`, (v) => { this.year = v; });
    this.slider('Your connection', 6, 11, 0.1, 8, (v) => `${fmt(10 ** v / 1e6 < 1000 ? 10 ** v / 1e6 : 10 ** v / 1e9, 0)} ${10 ** v / 1e6 < 1000 ? 'Mbit/s' : 'Gbit/s'}`, (v) => { this.lgBw = v; });
  }
  protected draw() {
    const c = this.ctx; c.fillStyle = C.bg; c.fillRect(0, 0, this.w, this.h);
    const x0 = 56, x1 = this.w - 14, y0 = 16, y1 = this.h - 30; const Xy = (y: number) => x0 + (y - 1950) / 92 * (x1 - x0), Yb = (b: number) => y1 - (Math.log10(b) - 10) / 8.5 * (y1 - y0);
    this.line(x0, y1, x1, y1, C.line); this.line(x0, y0, x0, y1, C.line);
    for (const [lg, lab] of [[12, '1 TB'], [15, '1 PB'], [18, '1 EB']] as Array<[number, string]>) { const y = Yb(10 ** lg); this.line(x0, y, x1, y, C.grid); this.text(lab, x0 - 6, y, C.dim, 8, 'right'); }
    for (const yr of [1960, 1980, 2000, 2020]) this.text(`${yr}`, Xy(yr), y1 + 10, C.dim, 8, 'center');
    this.line(Xy(1955), Yb(3e12 * 0.3), Xy(2035), Yb(3e12 * 0.3 * 10 ** 8), hexA(C.accent, 0.4), 1, [4, 4]); this.text('×10 per decade', Xy(2000), Yb(3e12 * 0.3 * 10 ** 4.5) - 10, C.accent, 8, 'center');
    let near = SURVEYS[0]; for (const s of SURVEYS) if (Math.abs(s[1] - this.year) < Math.abs(near[1] - this.year)) near = s;
    for (const s of SURVEYS) { const x = Xy(s[1]), y = Yb(s[2]); const sel = s === near; this.circle(x, y, sel ? 5 : 3, sel ? C.sun : undefined, sel ? hexA(C.sun, 0.5) : C.blue); const below = s[0].startsWith('Rubin'); this.text(s[0], Math.max(x0 + 24, Math.min(x1 - 24, x)), below ? y + 14 : y - 10, sel ? C.sun : C.dim, sel ? 9 : 7, 'center'); }
    const xy = Xy(this.year); this.line(xy, y0, xy, y1, hexA(C.text, 0.4), 1, [3, 3]);
    const bw = 10 ** this.lgBw; const secs = near[2] * 8 / bw;
    this.setReadout([
      [`${near[0]} (${near[1]})`, `${near[2] >= 1e15 ? fmt(near[2] / 1e15, 1) + ' PB' : near[2] >= 1e12 ? fmt(near[2] / 1e12, 1) + ' TB' : fmt(near[2] / 1e9, 0) + ' GB'} — ${near[3]}`, C.sun],
      ['Time to download it', fmtDur(secs), secs > 86400 * 30 ? C.red : C.green],
      ['Equivalent', `${sci(near[2] / 4.7e9, 1)} DVDs · ${sci(near[2] / 1.5e9, 1)} photo plates`],
      ['Lesson', near[2] > 1e15 ? 'software must classify, flag and alert' : 'still small enough for human eyes'],
    ]);
  }
}

/* ------------------------------------------------- 65. cross-match ---- */

class CrossmatchWidget extends CanvasWidget {
  private density = 40; private sigma = 0.6; private r = 1.0; private stars: Array<[number, number]> = []; private xs: Array<{ x: number; y: number; truth: number }> = [];
  private readonly FIELD = 60; // arcsec across
  constructor() {
    super(480 / 250);
    this.segmented<string>([['sparse', 'sparse field (5 / arcmin²)'], ['disc', 'Galactic disc (40)'], ['core', 'cluster core (400)']], 'disc', (v) => { this.density = { sparse: 5, disc: 40, core: 400 }[v]!; this.regen(); });
    this.slider('Match radius r', 0.1, 5, 0.05, 1, (v) => `${fmt(v, 2)}″`, (v) => { this.r = v; });
    this.slider('X-ray position error σ', 0.1, 2, 0.05, 0.6, (v) => `${fmt(v, 2)}″`, (v) => { this.sigma = v; this.regen(); });
    const b = $('button', 'lw-btn', '↻ new field'); b.addEventListener('click', () => this.regen()); this.controls.appendChild(b);
    this.regen();
  }
  private regen() {
    const rnd = mulberry(Math.floor(Math.random() * 1e9)); const F = this.FIELD; const n = Math.round(this.density * (F / 60) ** 2);
    this.stars = []; for (let i = 0; i < n; i++) this.stars.push([rnd() * F, rnd() * F]);
    this.xs = []; for (let i = 0; i < 24; i++) { const hasTruth = rnd() < 0.6 && this.stars.length; if (hasTruth) { const k = Math.floor(rnd() * this.stars.length); const [sx, sy] = this.stars[k]; this.xs.push({ x: sx + gaussRand(rnd) * this.sigma, y: sy + gaussRand(rnd) * this.sigma, truth: k }); } else this.xs.push({ x: rnd() * F, y: rnd() * F, truth: -1 }); }
  }
  protected draw() {
    const c = this.ctx; c.fillStyle = C.bg; c.fillRect(0, 0, this.w, this.h);
    const size = Math.min(this.h - 12, this.w * 0.55), x0 = 8, y0 = (this.h - size) / 2, s = size / this.FIELD;
    c.fillStyle = '#05070b'; c.fillRect(x0, y0, size, size); c.strokeStyle = C.line; c.strokeRect(x0, y0, size, size);
    for (const [sx, sy] of this.stars) this.circle(x0 + sx * s, y0 + sy * s, 1.6, undefined, hexA(C.blue, 0.9));
    let tp = 0, fp = 0, fn = 0, amb = 0;
    for (const X of this.xs) {
      const within: number[] = []; this.stars.forEach(([sx, sy], k) => { if (Math.hypot(sx - X.x, sy - X.y) <= this.r) within.push(k); });
      let nearest = -1, dmin = 1e9; for (const k of within) { const d = Math.hypot(this.stars[k][0] - X.x, this.stars[k][1] - X.y); if (d < dmin) { dmin = d; nearest = k; } }
      let col = C.dim;
      if (nearest < 0) { if (X.truth >= 0) { fn++; col = C.sun; } }
      else if (nearest === X.truth) { tp++; col = C.green; if (within.length > 1) amb++; }
      else { fp++; col = C.red; }
      this.circle(x0 + X.x * s, y0 + X.y * s, this.r * s, hexA(col, 0.8), hexA(col, 0.12)); this.circle(x0 + X.x * s, y0 + X.y * s, 2.2, undefined, C.sun);
      if (nearest >= 0) this.line(x0 + X.x * s, y0 + X.y * s, x0 + this.stars[nearest][0] * s, y0 + this.stars[nearest][1] * s, col, 1);
    }
    this.text(`${this.FIELD}″ × ${this.FIELD}″ · ${this.stars.length} Gaia stars (blue) · ${this.xs.length} X-ray sources (yellow)`, x0 + 4, y0 + size - 8, C.dim, 7);
    const lx = x0 + size + 16; let ly = 28;
    for (const [lab, n, col] of [['true matches', tp, C.green], ['false matches (wrong star)', fp, C.red], ['missed (counterpart outside r)', fn, C.sun], ['no counterpart, correctly unmatched', this.xs.length - tp - fp - fn - this.xs.filter((x) => x.truth < 0 && this.stars.some(([sx, sy]) => Math.hypot(sx - x.x, sy - x.y) <= this.r)).length + 0, C.dim]] as Array<[string, number, string]>) { this.circle(lx + 5, ly, 4, col, hexA(col, 0.3)); this.text(`${lab}: ${n}`, lx + 14, ly, C.text, 9); ly += 20; }
    const Sigma = this.density / 3600; const pch = 1 - Math.exp(-Math.PI * this.r * this.r * Sigma);
    const truth = this.xs.filter((x) => x.truth >= 0).length;
    this.text(`chance of a random star within r: ${fmt(pch * 100, pch < 0.01 ? 2 : 1)} %`, lx, ly + 6, pch > 0.2 ? C.red : C.text, 9);
    this.text(`r = ${fmt(this.r / this.sigma, 1)} σ captures ${fmt((1 - Math.exp(-((this.r / this.sigma) ** 2) / 2)) * 100, 0)} % of true counterparts`, lx, ly + 22, C.dim, 8);
    this.setReadout([
      ['Completeness (found / real)', `${truth ? fmt(tp / truth * 100, 0) : '–'} %`, C.green],
      ['Reliability (true / all matches)', `${tp + fp ? fmt(tp / (tp + fp) * 100, 0) : '–'} %`, fp > tp * 0.3 ? C.red : C.green],
      ['P(chance) = 1 − exp(−π r² Σ)', `${fmt(pch * 100, pch < 0.01 ? 2 : 1)} %  with Σ = ${this.density} / arcmin²`, pch > 0.2 ? C.red : C.accent],
      ['Rule', pch > 0.2 ? 'positions alone cannot identify counterparts here — add colour, variability, proper motion' : 'r ≈ 2–3σ: nearly complete and still reliable'],
    ]); void amb;
  }
}

/* ------------------------------------------------------------ factory ---- */


/* ================================================================================ */
/*  CHAPTER 7 — binaries and planets                                                 */
/* ================================================================================ */

const GRAV = 6.674e-11, MSUN = 1.989e30, RSUN = 6.957e8, AU_M = 1.496e11, MEARTH = 5.972e24, REARTH = 6.371e6, DAY_SEC = 86400;
const fmtSci = (x: number, d = 2) => (x === 0 ? '0' : Math.abs(x) >= 1e4 || Math.abs(x) < 1e-3 ? sci(x, d) : fmt(x, Math.abs(x) >= 100 ? 0 : Math.abs(x) >= 10 ? 1 : d));
/** position of a body on a Keplerian orbit projected on the sky: e, i, node Ω, periastron ω (rad), mean anomaly M → (x east, y north) in units of a */
function skyPos(M: number, e: number, inc: number, Om: number, om: number): { x: number; y: number; r: number; theta: number } {
  const { theta, r } = kepler(M, e);
  const u = theta + om;                   // argument of latitude
  const cu = Math.cos(u), su = Math.sin(u), cO = Math.cos(Om), sO = Math.sin(Om), ci = Math.cos(inc);
  return { x: r * (cu * sO + su * cO * ci), y: r * (cu * cO - su * sO * ci), r, theta };
}
/** overlap area of two discs of radii r1, r2 whose centres are d apart */
function discOverlap(r1: number, r2: number, d: number): number {
  if (d >= r1 + r2) return 0;
  if (d <= Math.abs(r1 - r2)) return Math.PI * Math.min(r1, r2) ** 2;
  const a1 = Math.acos((d * d + r1 * r1 - r2 * r2) / (2 * d * r1)), a2 = Math.acos((d * d + r2 * r2 - r1 * r1) / (2 * d * r2));
  return r1 * r1 * (a1 - Math.sin(2 * a1) / 2) + r2 * r2 * (a2 - Math.sin(2 * a2) / 2);
}
function starField(ctx: CanvasRenderingContext2D, w: number, h: number, seed: number, n = 60) {
  const rnd = mulberry(seed);
  for (let i = 0; i < n; i++) { const x = rnd() * w, y = rnd() * h, r = 0.4 + rnd() * 1.1; ctx.fillStyle = `rgba(230,230,240,${0.25 + rnd() * 0.5})`; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); }
}

/* ------------------------------------------------- 70. optical double vs bound pair ---- */

class DoubleTestWidget extends CanvasWidget {
  private mode: 'chance' | 'bound' = 'chance';
  private t = 0; private speed = 4;   // years per second
  constructor() {
    super(480 / 300);
    this.segmented<'chance' | 'bound'>([['chance', 'Chance alignment'], ['bound', 'Bound pair']], 'chance', (m) => { this.mode = m; this.t = 0; });
    this.playButton();
    this.slider('Speed', 1, 10, 0.5, 4, (v) => `${fmt(v, 1)} yr/s`, (v) => { this.speed = v; });
  }
  private pos(t: number): { a: [number, number]; b: [number, number]; cm: [number, number] } {
    const W = this.w * 0.58, H = this.h;
    if (this.mode === 'chance') {
      // two unrelated proper motions (px per year), crossing within a few arcsec around t ≈ 10 yr
      const a: [number, number] = [W * 0.28 + t * 2.1, H * 0.52 - t * 0.9];
      const b: [number, number] = [W * 0.34 + t * 0.6, H * 0.40 + t * 1.6];
      return { a, b, cm: a };
    }
    const cm: [number, number] = [W * 0.22 + t * 2.0, H * 0.55 - t * 0.9];
    const P = 28, e = 0.35, q = 0.6, A = 34;  // px
    const M = (t / P) * TAU;
    const s = skyPos(M, e, 52 * DEG, 30 * DEG, 100 * DEG);
    const a: [number, number] = [cm[0] - s.x * A * q / (1 + q), cm[1] + s.y * A * q / (1 + q)];
    const b: [number, number] = [cm[0] + s.x * A / (1 + q), cm[1] - s.y * A / (1 + q)];
    return { a, b, cm };
  }
  protected draw(dt: number) {
    this.t = (this.t + dt * this.speed) % 40;
    const c = this.ctx; c.fillStyle = C.bg; c.fillRect(0, 0, this.w, this.h);
    const W = this.w * 0.58;
    c.save(); c.beginPath(); c.rect(0, 0, W, this.h); c.clip();
    starField(c, W, this.h, 17);
    // trails: one dot per year observed so far
    for (let y = 0; y <= this.t; y += 1) {
      const p = this.pos(y);
      c.fillStyle = hexA(C.blue, 0.45); c.beginPath(); c.arc(p.a[0], p.a[1], 1.4, 0, TAU); c.fill();
      c.fillStyle = hexA(C.accent, 0.45); c.beginPath(); c.arc(p.b[0], p.b[1], 1.4, 0, TAU); c.fill();
    }
    const p = this.pos(this.t);
    if (this.mode === 'bound') { const p0 = this.pos(0), p1 = this.pos(40); this.line(p0.cm[0], p0.cm[1], p1.cm[0], p1.cm[1], C.faint, 1, [3, 4]); this.text('centre of mass', p1.cm[0] - 8, p1.cm[1] - 10, C.faint, 8, 'right'); }
    this.glow(p.a[0], p.a[1], 12, hexA(C.blue, 0.8)); this.circle(p.a[0], p.a[1], 4.5, undefined, '#e4ecff');
    this.glow(p.b[0], p.b[1], 9, hexA(C.accent, 0.8)); this.circle(p.b[0], p.b[1], 3.2, undefined, '#ffe7c0');
    this.line(p.a[0], p.a[1], p.b[0], p.b[1], hexA(C.text, 0.35), 1, [2, 3]);
    this.text(`year ${Math.floor(this.t)}`, 8, 12, C.dim, 9); this.text('N ↑  E ←', W - 8, 12, C.faint, 8, 'right');
    c.restore();
    // separation and position angle against time
    const gx0 = W + 34, gx1 = this.w - 10, g1y0 = 16, g1y1 = this.h * 0.47, g2y0 = this.h * 0.58, g2y1 = this.h - 18;
    const series: Array<{ rho: number; pa: number }> = [];
    for (let y = 0; y <= 40; y += 0.5) { const q = this.pos(y); const dx = q.b[0] - q.a[0], dy = q.b[1] - q.a[1]; series.push({ rho: Math.hypot(dx, dy), pa: wrap360(Math.atan2(-dx, -dy) / DEG) }); }
    const rhoMax = Math.max(...series.map((s) => s.rho)) * 1.1;
    const plot = (y0: number, y1: number, get: (s: { rho: number; pa: number }) => number, max: number, label: string, col: string) => {
      this.line(gx0, y1, gx1, y1, C.grid); this.line(gx0, y0, gx0, y1, C.grid);
      c.beginPath(); series.forEach((s, k) => { const x = gx0 + (k / (series.length - 1)) * (gx1 - gx0), yy = y1 - get(s) / max * (y1 - y0); k ? c.lineTo(x, yy) : c.moveTo(x, yy); }); c.strokeStyle = hexA(col, 0.4); c.lineWidth = 1; c.stroke();
      c.beginPath(); const n = Math.floor(this.t * 2); for (let k = 0; k <= n; k++) { const x = gx0 + (k / (series.length - 1)) * (gx1 - gx0), yy = y1 - get(series[k]) / max * (y1 - y0); k ? c.lineTo(x, yy) : c.moveTo(x, yy); } c.strokeStyle = col; c.lineWidth = 1.6; c.stroke();
      this.text(label, gx0 + 3, y0 + 1, C.dim, 8);
    };
    plot(g1y0, g1y1, (s) => s.rho, rhoMax, 'separation ρ', C.green);
    plot(g2y0, g2y1, (s) => s.pa, 360, 'position angle θ (0–360°)', C.purple);
    this.text('years →', gx1, g2y1 + 9, C.dim, 8, 'right'); this.text('0', gx0 - 2, g2y1 + 9, C.faint, 8, 'right'); this.text('40', gx1, g2y1 + 9 + 0, C.faint, 8, 'left');
    const cur = series[Math.min(series.length - 1, Math.floor(this.t * 2))];
    this.setReadout([
      ['Separation ρ', `${fmt(cur.rho / 6, 2)}″`, C.green],
      ['Position angle θ', `${fmt(cur.pa, 0)}°`, C.purple],
      ['Relative motion', this.mode === 'chance' ? 'straight line, constant rate — no orbit' : 'closed curve about a shared drift — bound', this.mode === 'chance' ? C.red : C.green],
      ['Verdict after 40 yr', this.mode === 'chance' ? 'optical double' : 'physical (visual) binary'],
    ]);
  }
}

/* ------------------------------------------------- 71. visual binary: apparent orbit ---- */

class VisualOrbitWidget extends CanvasWidget {
  private e = 0.5; private inc = 55; private Om = 40; private om = 70; private M = 0; private speed = 0.12;
  constructor(private mode: 'observe' | 'deproject') {
    super(480 / 340);
    this.playButton();
    this.slider('Eccentricity e', 0, 0.9, 0.01, 0.5, (v) => fmt(v, 2), (v) => { this.e = v; });
    this.slider('Inclination i', 0, 89, 1, 55, (v) => `${v}°`, (v) => { this.inc = v; });
    this.slider('Node Ω', 0, 180, 1, 40, (v) => `${v}°`, (v) => { this.Om = v; });
    this.slider('Periastron ω', 0, 360, 1, 70, (v) => `${v}°`, (v) => { this.om = v; });
  }
  protected draw(dt: number) {
    this.M = (this.M + dt * this.speed * TAU) % TAU;
    const c = this.ctx; c.fillStyle = C.bg; c.fillRect(0, 0, this.w, this.h);
    const inc = this.inc * DEG, Om = this.Om * DEG, om = this.om * DEG, e = this.e;
    const cx = this.w * 0.5, cy = this.h * 0.5, S = Math.min(this.w, this.h) * 0.26;
    const X = (x: number) => cx - x * S, Y = (y: number) => cy - y * S;  // east to the left, north up
    starField(c, this.w, this.h, 5, 40);
    // apparent orbit
    const pts: Array<{ x: number; y: number }> = [];
    for (let k = 0; k <= 240; k++) { const s = skyPos(k / 240 * TAU, e, inc, Om, om); pts.push({ x: s.x, y: s.y }); }
    // true orbit (face-on, same node orientation) for the deproject view
    if (this.mode === 'deproject') {
      c.beginPath(); for (let k = 0; k <= 240; k++) { const s = skyPos(k / 240 * TAU, e, 0, Om, om); k ? c.lineTo(X(s.x), Y(s.y)) : c.moveTo(X(s.x), Y(s.y)); } c.strokeStyle = hexA(C.text, 0.28); c.lineWidth = 1; c.setLineDash([2, 3]); c.stroke(); c.setLineDash([]);
      const tc = skyPos(Math.PI, e, 0, Om, om), tp = skyPos(0, e, 0, Om, om); // apastron & periastron
      const ctr = { x: (tc.x + tp.x) / 2, y: (tc.y + tp.y) / 2 };
      this.circle(X(ctr.x), Y(ctr.y), 2, hexA(C.text, 0.4)); this.text('true orbit (face-on), primary at focus', X(tc.x), Y(tc.y) + 12, hexA(C.text, 0.5), 8, 'center');
    }
    c.beginPath(); pts.forEach((p, k) => (k ? c.lineTo(X(p.x), Y(p.y)) : c.moveTo(X(p.x), Y(p.y)))); c.strokeStyle = hexA(C.accent, this.mode === 'observe' ? 0.35 : 0.9); c.lineWidth = 1.2; c.stroke();
    // apparent ellipse geometry: centre = midpoint of the projected major-axis endpoints; semi-axes from extremes
    const pa = skyPos(0, e, inc, Om, om), ap = skyPos(Math.PI, e, inc, Om, om);
    const ctr = { x: (pa.x + ap.x) / 2, y: (pa.y + ap.y) / 2 };
    let A = 0, B = Infinity, angA = 0;
    for (const p of pts) { const d = Math.hypot(p.x - ctr.x, p.y - ctr.y); if (d > A) { A = d; angA = Math.atan2(p.y - ctr.y, p.x - ctr.x); } }
    for (const p of pts) { const dx = p.x - ctr.x, dy = p.y - ctr.y; const perp = Math.abs(-Math.sin(angA) * dx + Math.cos(angA) * dy); const along = Math.abs(Math.cos(angA) * dx + Math.sin(angA) * dy); if (along < A * 0.08 && perp < B) B = perp; }
    if (!isFinite(B)) B = A * Math.cos(inc);
    const f = Math.sqrt(Math.max(0, A * A - B * B));
    const foci = [{ x: ctr.x + f * Math.cos(angA), y: ctr.y + f * Math.sin(angA) }, { x: ctr.x - f * Math.cos(angA), y: ctr.y - f * Math.sin(angA) }];
    const nearest = foci.reduce((m, q) => (Math.hypot(q.x, q.y) < Math.hypot(m.x, m.y) ? q : m));
    for (const q of foci) this.circle(X(q.x), Y(q.y), 3, C.red, undefined, 1);
    this.text('apparent foci', X(foci[0].x) + 6, Y(foci[0].y) - 8, C.red, 8);
    this.line(X(ctr.x) - 4, Y(ctr.y), X(ctr.x) + 4, Y(ctr.y), hexA(C.accent, 0.7)); this.line(X(ctr.x), Y(ctr.y) - 4, X(ctr.x), Y(ctr.y) + 4, hexA(C.accent, 0.7));
    // measurements so far (observe mode)
    if (this.mode === 'observe') {
      const n = Math.floor(this.M / TAU * 48);
      for (let k = 0; k <= n; k++) { const s = skyPos(k / 48 * TAU, e, inc, Om, om); c.fillStyle = hexA(C.accent, 0.85); c.beginPath(); c.arc(X(s.x), Y(s.y), 1.8, 0, TAU); c.fill(); }
    }
    // primary & secondary
    const s = skyPos(this.M, e, inc, Om, om);
    this.glow(X(0), Y(0), 14, hexA(C.blue, 0.8)); this.circle(X(0), Y(0), 5, undefined, '#e4ecff'); this.text('primary', X(0) + 8, Y(0) + 10, C.blue, 8);
    this.glow(X(s.x), Y(s.y), 9, hexA(C.accent, 0.8)); this.circle(X(s.x), Y(s.y), 3.2, undefined, '#ffe7c0');
    this.line(X(0), Y(0), X(s.x), Y(s.y), hexA(C.text, 0.3), 1, [2, 3]);
    // north/east and the position angle arc
    const rho = Math.hypot(s.x, s.y), th = wrap360(Math.atan2(s.x, s.y) / DEG);
    this.line(X(0), Y(0), X(0), Y(0) - 40, hexA(C.text, 0.3)); this.text('N', X(0), Y(0) - 48, C.dim, 9, 'center'); this.text('E', X(0) + 48, Y(0), C.dim, 9, 'center');
    c.beginPath(); c.arc(X(0), Y(0), 22, -Math.PI / 2, -Math.PI / 2 - th * DEG, true); c.strokeStyle = hexA(C.purple, 0.8); c.lineWidth = 1; c.stroke();
    const off = Math.hypot(nearest.x, nearest.y);
    this.text(this.mode === 'observe' ? 'the apparent orbit: what the micrometer or the camera records' : 'colour: apparent orbit · grey: true orbit · the primary is not at an apparent focus', this.w / 2, this.h - 10, C.dim, 8, 'center');
    const ro: Array<[string, string, string?]> = [
      ['Separation ρ', `${fmt(rho, 3)} a`, C.accent],
      ['Position angle θ', `${fmt(th, 1)}°`, C.purple],
      ['Apparent axes ã, b̃', `${fmt(A, 3)} a, ${fmt(B, 3)} a`],
      ['Primary off apparent focus by', `${fmt(off, 3)} a${off < 0.01 ? ' — face-on or circular' : ''}`, off < 0.01 ? C.green : C.red],
    ];
    if (this.mode === 'deproject') ro.push(['Mass error if i ignored, (ã/a)³', `×${fmt(A ** 3, 2)}`, C.red], ['cos³ i', fmt(Math.cos(inc) ** 3, 2)]);
    this.setReadout(ro);
  }
}

/* ------------------------------------------------- 72. astrometric binary ---- */

class AstrometricWidget extends CanvasWidget {
  private m2 = 1.0; private P = 50; private d = 2.64; private exag = 1; private reveal = false; private t = 0; private m1 = 2.0;
  constructor() {
    super(480 / 260);
    this.playButton();
    const b = $('button', '', 'Reveal companion'); b.addEventListener('click', () => { this.reveal = !this.reveal; b.classList.toggle('active', this.reveal); }); this.controls.appendChild(b);
    this.slider('Companion mass m₂', 0.001, 1.5, 0.001, 1.0, (v) => (v < 0.01 ? `${fmt(v * 1047, 1)} M_J` : `${fmt(v, 2)} M☉`), (v) => { this.m2 = v; });
    this.slider('Period P', 2, 80, 1, 50, (v) => `${v} yr`, (v) => { this.P = v; });
    this.slider('Distance d', 1.3, 20, 0.1, 2.64, (v) => `${fmt(v, 1)} pc`, (v) => { this.d = v; });
    this.slider('Vertical exaggeration', 1, 100, 1, 1, (v) => `×${v}`, (v) => { this.exag = v; });
  }
  protected draw(dt: number) {
    this.t = (this.t + dt * 6) % 100;
    const c = this.ctx; c.fillStyle = C.bg; c.fillRect(0, 0, this.w, this.h);
    starField(c, this.w, this.h, 23, 50);
    const a = Math.cbrt((this.m1 + this.m2) * this.P * this.P);          // AU
    const a1 = a * this.m2 / (this.m1 + this.m2), a2 = a - a1;
    const alpha1 = a1 / this.d, alpha2 = a2 / this.d;                      // arcsec
    const mu = 1.3;                                                        // arcsec / yr proper motion (Sirius-like)
    const span = mu * 100;                                                 // arcsec over 100 yr
    const px = (this.w - 40) / span;                                       // px per arcsec horizontally
    const X = (t: number, wob: number) => 20 + t * mu * px + wob * px * this.exag;
    const Y = (wob: number) => this.h * 0.5 - wob * px * this.exag;
    this.line(20, this.h * 0.5, this.w - 20, this.h * 0.5, C.faint, 1, [3, 4]);
    const path = (amp: number, sign: number, col: string, upto: number, dots: boolean) => {
      c.beginPath();
      for (let t = 0; t <= upto; t += 0.25) { const ph = t / this.P * TAU; const x = X(t, sign * amp * Math.cos(ph) * 0.3), y = Y(sign * amp * Math.sin(ph)); t ? c.lineTo(x, y) : c.moveTo(x, y); }
      c.strokeStyle = col; c.lineWidth = 1.3; c.stroke();
      if (dots) for (let t = 0; t <= upto; t += 1) { const ph = t / this.P * TAU; c.fillStyle = col; c.beginPath(); c.arc(X(t, sign * amp * Math.cos(ph) * 0.3), Y(sign * amp * Math.sin(ph)), 1.5, 0, TAU); c.fill(); }
    };
    path(alpha1, 1, C.blue, this.t, true);
    if (this.reveal) path(alpha2, -1, hexA(C.accent, 0.8), this.t, false);
    const ph = this.t / this.P * TAU;
    const sx = X(this.t, alpha1 * Math.cos(ph) * 0.3), sy = Y(alpha1 * Math.sin(ph));
    this.glow(sx, sy, 16, hexA(C.blue, 0.85)); this.circle(sx, sy, 5, undefined, '#e9f0ff');
    if (this.reveal) { const cxp = X(this.t, -alpha2 * Math.cos(ph) * 0.3), cyp = Y(-alpha2 * Math.sin(ph)); this.glow(cxp, cyp, 7, hexA(C.accent, 0.7)); this.circle(cxp, cyp, 2.5, undefined, '#ffe7c0'); this.line(sx, sy, cxp, cyp, hexA(C.text, 0.25), 1, [2, 3]); }
    this.text(`proper motion ${fmt(mu, 1)}″/yr →   year ${Math.floor(this.t)}`, 20, 12, C.dim, 9);
    this.text(`straight line: the centre of mass · wobble: the visible star's orbit about it${this.exag > 1 ? `  (vertical ×${this.exag})` : ''}`, this.w / 2, this.h - 10, C.dim, 8, 'center');
    const det = alpha1 * 1000;   // mas
    this.setReadout([
      ['Relative orbit a (Kepler III)', `${fmt(a, 1)} AU`],
      ['Visible star\'s orbit a₁ = a m₂/(m₁+m₂)', `${fmt(a1, 2)} AU`, C.blue],
      ['Angular wobble α₁ = a₁/d', det >= 1000 ? `${fmt(det / 1000, 2)}″` : det >= 1 ? `${fmt(det, 1)} mas` : `${fmt(det * 1000, 1)} µas`, C.blue],
      ['Detectable by', det > 100 ? 'meridian circle (Bessel, 1844)' : det > 1 ? 'Hipparcos-class astrometry' : det > 0.02 ? 'Gaia' : 'nothing yet', det > 0.02 ? C.green : C.red],
      ['Primary m₁ (assumed)', `${fmt(this.m1, 1)} M☉`],
    ]);
  }
}

/* ------------------------------------------------- 73. classify the binary ---- */

type BinClass = 'optical' | 'visual' | 'astrometric' | 'eclipsing' | 'spectrum' | 'spectroscopic';
const BIN_CLASSES: Array<[BinClass, string]> = [['optical', 'Optical double'], ['visual', 'Visual'], ['astrometric', 'Astrometric'], ['eclipsing', 'Eclipsing'], ['spectrum', 'Spectrum'], ['spectroscopic', 'Spectroscopic']];
const BIN_CARDS: Array<{ kind: 'tracks' | 'orbit' | 'wobble' | 'lc' | 'twotypes' | 'shifting'; answer: BinClass[]; hint: string; name: string }> = [
  { kind: 'tracks', answer: ['optical'], hint: 'Two stars 4″ apart in 1900, 9″ apart today, drifting along two different straight lines; parallaxes 40 and 3 mas.', name: 'a pair in Aquila' },
  { kind: 'orbit', answer: ['visual'], hint: 'Two resolved stars; position angle has swung through 200° since 1830 while the separation varied between 0.4″ and 6″.', name: 'γ Virginis' },
  { kind: 'wobble', answer: ['astrometric'], hint: 'A single bright image whose path against the background shows a 50-year wave of 2.5″ amplitude; nothing visible beside it (in 1844).', name: 'Sirius, 1844' },
  { kind: 'lc', answer: ['eclipsing', 'spectroscopic'], hint: 'One image; brightness drops 1.3 magnitudes for ten hours every 2.867 days, and the lines shift back and forth with the same period.', name: 'Algol' },
  { kind: 'twotypes', answer: ['spectrum'], hint: 'One image, never seen to move or vary; the spectrum shows broad hydrogen lines of an A star together with the TiO bands of an M giant.', name: 'a composite in Cygnus' },
  { kind: 'shifting', answer: ['spectroscopic'], hint: 'One image, constant brightness; the Ca II K line is double on some plates and single on others, with a 20.5-day rhythm.', name: 'Mizar A, 1889' },
];

class BinaryClassifyWidget extends CanvasWidget {
  private card = 0; private picked = new Set<BinClass>(); private checked = false; private score = 0; private t = 0;
  private btns = new Map<BinClass, HTMLElement>();
  constructor() {
    super(480 / 270);
    const row = $('div', 'lw-seg');
    for (const [k, label] of BIN_CLASSES) { const b = $('button', '', label); b.addEventListener('click', () => { if (this.checked) return; if (this.picked.has(k)) this.picked.delete(k); else this.picked.add(k); b.classList.toggle('active', this.picked.has(k)); }); this.btns.set(k, b); row.appendChild(b); }
    this.controls.appendChild(row);
    const check = $('button', '', 'Check'); check.addEventListener('click', () => { if (this.checked || !this.picked.size) return; this.checked = true; const ans = new Set(BIN_CARDS[this.card].answer); const ok = ans.size === this.picked.size && [...ans].every((k) => this.picked.has(k)); if (ok) this.score++; });
    const next = $('button', '', 'Next system'); next.addEventListener('click', () => { this.card = (this.card + 1) % BIN_CARDS.length; this.picked.clear(); this.checked = false; this.btns.forEach((b) => b.classList.remove('active')); });
    this.controls.append(check, next);
  }
  protected draw(dt: number) {
    this.t += dt;
    const c = this.ctx; c.fillStyle = C.bg; c.fillRect(0, 0, this.w, this.h);
    const card = BIN_CARDS[this.card];
    const px0 = 10, py0 = 10, pw = this.w * 0.46, ph = this.h - 20;
    c.fillStyle = '#0f131a'; c.fillRect(px0, py0, pw, ph); c.strokeStyle = C.grid; c.strokeRect(px0, py0, pw, ph);
    c.save(); c.beginPath(); c.rect(px0, py0, pw, ph); c.clip();
    const cx = px0 + pw / 2, cy = py0 + ph / 2;
    switch (card.kind) {
      case 'tracks': { starField(c, this.w, this.h, 31, 40); for (const [x0, y0, vx, vy, col] of [[cx - 50, cy + 20, 1.1, -0.5, C.blue], [cx - 40, cy + 5, 0.3, 0.9, C.accent]] as Array<[number, number, number, number, string]>) { for (let y = 0; y < 60; y += 5) { c.fillStyle = hexA(col, 0.3 + 0.7 * y / 60); c.beginPath(); c.arc(x0 + vx * y, y0 + vy * y, 2, 0, TAU); c.fill(); } } this.text('1900 → 1960, one dot per 5 yr', cx, py0 + ph - 10, C.dim, 8, 'center'); break; }
      case 'orbit': { starField(c, this.w, this.h, 33, 30); const e = 0.88; for (let k = 0; k < 60; k++) { const s = skyPos(k / 60 * TAU, e, 32 * DEG, 20 * DEG, 250 * DEG); c.fillStyle = hexA(C.accent, 0.8); c.beginPath(); c.arc(cx - s.x * 36 + 20, cy - s.y * 36, 1.6, 0, TAU); c.fill(); } this.glow(cx + 20, cy, 10, hexA(C.blue, 0.8)); this.circle(cx + 20, cy, 3.5, undefined, '#e4ecff'); this.text('positions of B relative to A, 1830–2020', cx, py0 + ph - 10, C.dim, 8, 'center'); break; }
      case 'wobble': { starField(c, this.w, this.h, 35, 40); c.beginPath(); for (let x = 0; x <= pw - 20; x += 2) { const y = cy + 12 * Math.sin(x / (pw - 20) * TAU * 2); x ? c.lineTo(px0 + 10 + x, y) : c.moveTo(px0 + 10 + x, y); } c.strokeStyle = C.blue; c.lineWidth = 1.4; c.stroke(); const xx = px0 + 10 + ((this.t * 20) % (pw - 20)); this.glow(xx, cy + 12 * Math.sin((xx - px0 - 10) / (pw - 20) * TAU * 2), 14, hexA(C.blue, 0.85)); this.text('path on the sky, 100 years; nothing else seen', cx, py0 + ph - 10, C.dim, 8, 'center'); break; }
      case 'lc': { const gx0 = px0 + 14, gx1 = px0 + pw - 10, gy0 = py0 + 20, gy1 = py0 + ph - 24; this.line(gx0, gy1, gx1, gy1, C.grid); c.beginPath(); for (let k = 0; k <= 200; k++) { const ph2 = k / 200; const dip = Math.exp(-(((ph2 - 0.5) / 0.035) ** 2)) * 0.72 + Math.exp(-(((ph2 - 0.0) / 0.035) ** 2)) * 0.08 + Math.exp(-(((ph2 - 1.0) / 0.035) ** 2)) * 0.08; const y = gy0 + dip * (gy1 - gy0 - 10); k ? c.lineTo(gx0 + ph2 * (gx1 - gx0), y) : c.moveTo(gx0 + ph2 * (gx1 - gx0), y); } c.strokeStyle = C.green; c.lineWidth = 1.6; c.stroke(); this.text('brightness against phase, P = 2.867 d; lines shift with P', cx, py0 + ph - 10, C.dim, 8, 'center'); break; }
      case 'twotypes': { const X = (nm: number) => px0 + 10 + (nm - 400) / 300 * (pw - 20); rainbow(c, X, cy - 22, 44, 0.7); for (const nm of [410, 434, 486, 656]) { c.fillStyle = 'rgba(5,7,10,0.9)'; c.fillRect(X(nm) - 2.5, cy - 22, 5, 44); } for (const [a, b] of [[615, 627], [705, 720], [650, 653]]) { c.fillStyle = 'rgba(5,7,10,0.55)'; c.fillRect(X(a), cy - 22, X(b) - X(a), 44); } this.text('broad Balmer lines (A)  +  TiO bands (M)', cx, py0 + ph - 10, C.dim, 8, 'center'); break; }
      case 'shifting': { const X = (nm: number) => px0 + 10 + (nm - 390) / 10 * (pw - 20); for (let row = 0; row < 5; row++) { const y = py0 + 24 + row * (ph - 50) / 4; rainbow(c, (nm) => X(nm), y - 7, 14, 0.35); const sh = 0.9 * Math.sin(row / 5 * TAU); for (const s of [sh, -sh]) { c.fillStyle = 'rgba(5,7,10,0.9)'; c.fillRect(X(393.4 + s) - 1, y - 7, 2, 14); } this.text(`night ${row * 4 + 1}`, px0 + 6, y, C.faint, 7); } this.text('the K line of Ca II on five nights', cx, py0 + ph - 10, C.dim, 8, 'center'); break; }
    }
    c.restore();
    // text side
    const tx = px0 + pw + 14, tw = this.w - tx - 10;
    this.text(`System ${this.card + 1} of ${BIN_CARDS.length}`, tx, py0 + 10, C.dim, 9);
    const words = card.hint.split(' '); let line = '', y = py0 + 30; c.font = '10px -apple-system, system-ui, sans-serif';
    for (const wd of words) { const test = line ? `${line} ${wd}` : wd; if (c.measureText(test).width > tw) { this.text(line, tx, y, C.text, 10); line = wd; y += 14; } else line = test; }
    if (line) this.text(line, tx, y, C.text, 10);
    y += 22;
    if (this.checked) {
      const ans = new Set(card.answer); const ok = ans.size === this.picked.size && [...ans].every((k) => this.picked.has(k));
      this.text(ok ? '✓ correct' : '✗ not quite', tx, y, ok ? C.green : C.red, 11); y += 16;
      this.text(`${card.name}: ${card.answer.map((k) => BIN_CLASSES.find(([kk]) => kk === k)![1].toLowerCase()).join(' + ')}`, tx, y, C.accent, 9);
    } else this.text('pick every class that applies, then Check', tx, y, C.faint, 9);
    this.setReadout([['Score', `${this.score} / ${BIN_CARDS.length}`, C.green], ['Classes picked', [...this.picked].map((k) => BIN_CLASSES.find(([kk]) => kk === k)![1]).join(', ') || '—']]);
  }
}

/* ------------------------------------------------- 74. mass ratio from the centre of mass ---- */

class MassRatioWidget extends CanvasWidget {
  private q = 1.6; private inc = 30; private t = 0;
  constructor() {
    super(480 / 280);
    this.playButton();
    this.slider('Mass ratio m₁/m₂', 1, 5, 0.1, 1.6, (v) => fmt(v, 1), (v) => { this.q = v; });
    this.slider('Inclination i', 0, 80, 1, 30, (v) => `${v}°`, (v) => { this.inc = v; });
  }
  protected draw(dt: number) {
    this.t = (this.t + dt * 4) % 60;
    const c = this.ctx; c.fillStyle = C.bg; c.fillRect(0, 0, this.w, this.h);
    starField(c, this.w, this.h, 41, 55);
    const P = 24, e = 0.3, A = Math.min(this.w, this.h) * 0.3;
    const cm = (t: number) => ({ x: this.w * 0.2 + t / 60 * this.w * 0.6, y: this.h * 0.62 - t / 60 * this.h * 0.22 });
    const a2 = A / (1 + 1 / this.q), a1 = A - a2;   // a1/a2 = m2/m1 = 1/q
    const pos = (t: number) => { const s = skyPos(t / P * TAU, e, this.inc * DEG, 20 * DEG, 60 * DEG); const o = cm(t); return { a: { x: o.x - s.x * a1, y: o.y + s.y * a1 }, b: { x: o.x + s.x * a2, y: o.y - s.y * a2 }, o }; };
    const o0 = cm(0), o1 = cm(60); this.line(o0.x, o0.y, o1.x, o1.y, C.faint, 1, [3, 4]); this.text('centre of mass: uniform straight-line motion', o1.x - 6, o1.y - 10, C.faint, 8, 'right');
    for (let t = 0; t <= this.t; t += 0.5) { const p = pos(t); c.fillStyle = hexA(C.blue, 0.5); c.beginPath(); c.arc(p.a.x, p.a.y, 1.3, 0, TAU); c.fill(); c.fillStyle = hexA(C.accent, 0.5); c.beginPath(); c.arc(p.b.x, p.b.y, 1.3, 0, TAU); c.fill(); }
    const p = pos(this.t);
    // the two ellipses about the current CM
    for (const [amp, sg, col] of [[a1, -1, C.blue], [a2, 1, C.accent]] as Array<[number, number, string]>) { c.beginPath(); for (let k = 0; k <= 120; k++) { const s = skyPos(k / 120 * TAU, e, this.inc * DEG, 20 * DEG, 60 * DEG); const x = p.o.x + sg * s.x * amp, y = p.o.y - sg * s.y * amp; k ? c.lineTo(x, y) : c.moveTo(x, y); } c.strokeStyle = hexA(col, 0.35); c.lineWidth = 1; c.setLineDash([2, 3]); c.stroke(); c.setLineDash([]); }
    this.circle(p.o.x, p.o.y, 2.2, undefined, C.text);
    this.line(p.a.x, p.a.y, p.b.x, p.b.y, hexA(C.text, 0.3), 1, [2, 3]);
    this.glow(p.a.x, p.a.y, 13, hexA(C.blue, 0.85)); this.circle(p.a.x, p.a.y, 3 + 2.5 * Math.min(1, this.q / 3), undefined, '#e4ecff'); this.text('1', p.a.x, p.a.y - 11, C.blue, 9, 'center', 'serif');
    this.glow(p.b.x, p.b.y, 10, hexA(C.accent, 0.85)); this.circle(p.b.x, p.b.y, 3.5, undefined, '#ffe7c0'); this.text('2', p.b.x, p.b.y - 10, C.accent, 9, 'center', 'serif');
    this.text(`year ${Math.floor(this.t)}`, 8, 12, C.dim, 9);
    this.setReadout([
      ['Apparent semi-major axis of star 1, α₁', `${fmt(a1 / A, 3)} α`, C.blue],
      ['Apparent semi-major axis of star 2, α₂', `${fmt(a2 / A, 3)} α`, C.accent],
      ['Measured α₂/α₁ = m₁/m₂', fmt(a2 / a1, 2), C.green],
      ['Changes with inclination?', 'no — both orbits shrink by the same factor'],
    ]);
  }
}

/* ------------------------------------------------- 75. mass from Kepler III ---- */

const VB_PRESETS: Record<string, { alpha: number; p: number; P: number; q: number; dp: number }> = {
  'Sirius': { alpha: 7.50, p: 0.3792, P: 50.13, q: 2.02, dp: 0.4 },
  'α Cen AB': { alpha: 17.57, p: 0.747, P: 79.9, q: 1.23, dp: 0.2 },
  'Procyon': { alpha: 4.3, p: 0.285, P: 40.8, q: 2.5, dp: 0.3 },
  '70 Oph': { alpha: 4.55, p: 0.196, P: 88.4, q: 1.28, dp: 0.5 },
  '61 Cyg': { alpha: 24.3, p: 0.286, P: 678, q: 1.11, dp: 0.2 },
};

class BinaryMassWidget extends CanvasWidget {
  private alpha = 7.5; private p = 0.3792; private P = 50.13; private q = 2.02; private dp = 0.4; private s: { set: (v: number) => void }[] = [];
  constructor() {
    super(480 / 230);
    this.segmented(Object.keys(VB_PRESETS).map((k) => [k, k] as [string, string]), 'Sirius', (k) => { const v = VB_PRESETS[k]; this.alpha = v.alpha; this.p = v.p; this.P = v.P; this.q = v.q; this.dp = v.dp; this.s[0].set(v.alpha); this.s[1].set(v.p); this.s[2].set(v.P); this.s[3].set(v.q); this.s[4].set(v.dp); });
    this.s.push(this.slider('Angular semi-major axis α', 0.2, 30, 0.01, 7.5, (v) => `${fmt(v, 2)}″`, (v) => { this.alpha = v; }));
    this.s.push(this.slider('Parallax p', 0.01, 0.8, 0.001, 0.3792, (v) => `${fmt(v * 1000, 0)} mas`, (v) => { this.p = v; }));
    this.s.push(this.slider('Period P', 1, 700, 0.1, 50.13, (v) => `${fmt(v, 1)} yr`, (v) => { this.P = v; }));
    this.s.push(this.slider('Mass ratio m₁/m₂', 0.5, 4, 0.01, 2.02, (v) => fmt(v, 2), (v) => { this.q = v; }));
    this.s.push(this.slider('Parallax uncertainty', 0, 20, 0.1, 0.4, (v) => `±${fmt(v, 1)} %`, (v) => { this.dp = v; }));
  }
  protected draw() {
    const c = this.ctx; c.fillStyle = C.bg; c.fillRect(0, 0, this.w, this.h);
    const a = this.alpha / this.p, Msum = a ** 3 / (this.P * this.P), m2 = Msum / (1 + this.q), m1 = Msum - m2;
    const d = 1 / this.p;
    const lo = (this.alpha / (this.p * (1 + this.dp / 100))) ** 3 / this.P ** 2, hi = (this.alpha / (this.p * (1 - this.dp / 100))) ** 3 / this.P ** 2;
    // orbit against the solar system, log scale 0.3–300 AU
    const gx0 = 50, gx1 = this.w - 16, gy = this.h * 0.36;
    const X = (au: number) => gx0 + (Math.log10(au) - Math.log10(0.3)) / 3 * (gx1 - gx0);
    this.line(gx0, gy, gx1, gy, C.grid);
    for (const [au, name] of [[1, 'Earth'], [5.2, 'Jupiter'], [9.5, 'Saturn'], [30, 'Neptune'], [100, '100 AU']] as Array<[number, string]>) { this.line(X(au), gy - 4, X(au), gy + 4, C.faint); this.text(name, X(au), gy + 14, C.faint, 8, 'center'); }
    this.glow(X(a), gy, 14, hexA(C.accent, 0.8)); this.circle(X(a), gy, 4, undefined, '#ffe7c0');
    this.text(`a = ${fmt(a, 1)} AU`, X(a), gy - 16, C.accent, 10, 'center');
    this.text('semi-major axis of the relative orbit, a = α / p, against the solar system (log scale)', this.w / 2, 14, C.dim, 8, 'center');
    // mass bar with the parallax error band
    const by = this.h * 0.74, bx0 = 50, bx1 = this.w - 16, mmax = Math.max(6, hi * 1.2);
    const BX = (m: number) => bx0 + m / mmax * (bx1 - bx0);
    this.line(bx0, by, bx1, by, C.grid);
    for (let m = 0; m <= mmax; m += mmax > 20 ? 10 : mmax > 8 ? 2 : 1) { this.line(BX(m), by - 3, BX(m), by + 3, C.faint); this.text(`${m}`, BX(m), by + 12, C.faint, 8, 'center'); }
    c.fillStyle = hexA(C.red, 0.25); c.fillRect(BX(lo), by - 12, BX(hi) - BX(lo), 24);
    c.fillStyle = hexA(C.blue, 0.8); c.fillRect(BX(0), by - 8, BX(m1) - BX(0), 16);
    c.fillStyle = hexA(C.accent, 0.8); c.fillRect(BX(m1), by - 8, BX(Msum) - BX(m1), 16);
    this.text(`m₁ = ${fmt(m1, 2)}`, BX(m1 / 2), by - 18, C.blue, 9, 'center'); this.text(`m₂ = ${fmt(m2, 2)}`, BX(m1 + m2 / 2), by - 18, C.accent, 9, 'center');
    this.text('M☉', bx1 + 2, by + 12, C.faint, 8, 'right');
    this.text(`red band: the total mass if the parallax is wrong by ±${fmt(this.dp, 1)} % → ±${fmt(3 * this.dp, 1)} % in mass`, this.w / 2, this.h - 8, C.dim, 8, 'center');
    this.setReadout([
      ['Distance d = 1/p', `${fmt(d, 2)} pc = ${fmt(d * 3.2616, 1)} ly`],
      ['a = α/p', `${fmt(a, 2)} AU`, C.accent],
      ['m₁ + m₂ = a³/P²', `${fmt(Msum, 2)} M☉  (${fmt(lo, 2)}–${fmt(hi, 2)})`, C.green],
      ['m₁, m₂ (with the ratio)', `${fmt(m1, 2)}, ${fmt(m2, 2)} M☉`],
    ]);
  }
}

/* ------------------------------------------------- 76. mass–luminosity relation ---- */

const ML_MS: Array<[number, number, string?, string?]> = [
  [0.12, 0.0016, 'Proxima'], [0.16, 0.0032], [0.21, 0.0063], [0.27, 0.011], [0.33, 0.016], [0.40, 0.024], [0.47, 0.041], [0.55, 0.062], [0.63, 0.085, '61 Cyg B', 'l'], [0.70, 0.15, '61 Cyg A'],
  [0.78, 0.26], [0.85, 0.38], [0.91, 0.50, 'α Cen B', 'l'], [1.00, 1.00, 'Sun'], [1.10, 1.52, 'α Cen A', 'l'], [1.20, 2.2], [1.33, 3.4], [1.50, 5.6], [1.70, 9.0], [1.90, 15],
  [2.06, 25, 'Sirius A', 'l'], [2.30, 38], [2.60, 62], [3.00, 110], [3.17, 180, 'Algol A'], [3.60, 300], [4.20, 520], [5.00, 900], [6.00, 1600], [7.20, 2800],
  [8.50, 4600], [10.0, 7500], [12.0, 13000], [15.0, 26000], [18.0, 45000], [22.0, 80000], [28.0, 150000],
];
const ML_OFF: Array<[number, number, string]> = [[1.02, 0.026, 'Sirius B (WD)'], [0.60, 0.00049, 'Procyon B (WD)'], [2.57, 79, 'Capella Aa+Ab (giants)'], [2.48, 73, ''], [0.70, 6.9, 'Algol B (subgiant)']];

class MassLuminosityWidget extends CanvasWidget {
  private n = 3.5; private range: 'all' | 'low' | 'mid' | 'high' = 'all'; private showOff = true;
  constructor() {
    super(480 / 330);
    this.segmented<'all' | 'low' | 'mid' | 'high'>([['all', 'All'], ['low', '< 0.4 M☉'], ['mid', '0.4–2 M☉'], ['high', '> 2 M☉']], 'all', (r) => { this.range = r; });
    const b = $('button', 'active', 'Non-main-sequence'); b.addEventListener('click', () => { this.showOff = !this.showOff; b.classList.toggle('active', this.showOff); }); this.controls.appendChild(b);
    this.slider('Fitted exponent n in L ∝ Mⁿ', 1, 5, 0.05, 3.5, (v) => fmt(v, 2), (v) => { this.n = v; });
  }
  protected draw() {
    const c = this.ctx; c.fillStyle = C.bg; c.fillRect(0, 0, this.w, this.h);
    const gx0 = 46, gx1 = this.w - 14, gy0 = 14, gy1 = this.h - 30;
    const X = (m: number) => gx0 + (Math.log10(m) + 1.1) / 2.7 * (gx1 - gx0), Y = (l: number) => gy1 - (Math.log10(l) + 4) / 9.6 * (gy1 - gy0);
    for (let k = -4; k <= 5; k++) { this.line(gx0, Y(10 ** k), gx1, Y(10 ** k), C.grid); this.text(k === 0 ? '1' : `10${sup(k)}`, gx0 - 4, Y(10 ** k), C.faint, 8, 'right'); }
    for (const m of [0.1, 0.3, 1, 3, 10, 30]) { this.line(X(m), gy0, X(m), gy1, C.grid); this.text(`${m}`, X(m), gy1 + 10, C.faint, 8, 'center'); }
    this.text('L / L☉', gx0 + 4, gy0 + 4, C.dim, 8); this.text('M / M☉', gx1, gy1 + 20, C.dim, 8, 'right');
    const inRange = (m: number) => this.range === 'all' || (this.range === 'low' ? m < 0.4 : this.range === 'mid' ? m >= 0.4 && m <= 2 : m > 2);
    // fitted line through (1, 1)
    c.beginPath(); c.moveTo(X(0.08), Y(0.08 ** this.n)); c.lineTo(X(40), Y(40 ** this.n)); c.strokeStyle = hexA(C.accent, 0.9); c.lineWidth = 1.5; c.stroke();
    let ss = 0, cnt = 0;
    for (const [m, l, name, side] of ML_MS) { const use = inRange(m); c.fillStyle = use ? C.star : hexA(C.star, 0.25); c.beginPath(); c.arc(X(m), Y(l), 2.6, 0, TAU); c.fill(); if (name && use) this.text(name, X(m) + (side === 'l' ? -6 : 6), Y(l) + (side === 'l' ? 4 : -5), C.dim, 7, side === 'l' ? 'right' : 'left'); if (use) { const r = Math.log10(l) - this.n * Math.log10(m); ss += r * r; cnt++; } }
    if (this.showOff) for (const [m, l, name] of ML_OFF) { c.fillStyle = C.red; c.beginPath(); c.arc(X(m), Y(l), 3, 0, TAU); c.fill(); if (name) this.text(name, X(m) + 6, Y(l) + 1, C.red, 7); }
    this.text(`L ∝ M^${fmt(this.n, 2)}`, X(20), Y(20 ** this.n) - 12, C.accent, 10, 'center');
    const rms = cnt ? Math.sqrt(ss / cnt) : 0;
    // best exponent for the selected range (least squares through the origin in log space)
    let sxy = 0, sxx = 0; for (const [m, l] of ML_MS) if (inRange(m)) { const x = Math.log10(m), y = Math.log10(l); sxy += x * y; sxx += x * x; }
    const best = sxx ? sxy / sxx : 0;
    this.setReadout([
      ['RMS scatter (dex)', fmt(rms, 2), rms < 0.15 ? C.green : rms < 0.3 ? C.accent : C.red],
      ['Best n for this range', fmt(best, 2), C.green],
      ['Lifetime ∝ M/L', `∝ M^${fmt(1 - this.n, 1)}`],
      ['10 M☉: L, lifetime', `${fmtSci(10 ** this.n, 1)} L☉, ${fmtSci(1e10 * 10 ** (1 - this.n), 1)} yr`],
    ]);
  }
}

/* ------------------------------------------------- 77. radial-velocity curve shape ---- */

class RvShapeWidget extends CanvasWidget {
  private e = 0.4; private om = 60; private M = 0;
  constructor() {
    super(480 / 260);
    this.playButton();
    this.slider('Eccentricity e', 0, 0.9, 0.01, 0.4, (v) => fmt(v, 2), (v) => { this.e = v; });
    this.slider('Argument of periastron ω', 0, 360, 1, 60, (v) => `${v}°`, (v) => { this.om = v; });
  }
  protected draw(dt: number) {
    this.M = (this.M + dt * 0.5) % TAU;
    const c = this.ctx; c.fillStyle = C.bg; c.fillRect(0, 0, this.w, this.h);
    const e = this.e, om = this.om * DEG, K = 1 / Math.sqrt(1 - e * e);
    const vr = (M: number) => { const { theta } = kepler(M, e); return K * (Math.cos(theta + om) + e * Math.cos(om)); };
    // orbit, top view: observer at the bottom looking up (+y toward observer)
    const ox = this.w * 0.25, oy = this.h * 0.48, S = Math.min(this.w * 0.17, this.h * 0.3);
    c.beginPath(); for (let k = 0; k <= 160; k++) { const { theta, r } = kepler(k / 160 * TAU, e); const x = r * Math.cos(theta + om), y = r * Math.sin(theta + om); k ? c.lineTo(ox + x * S, oy - y * S) : c.moveTo(ox + x * S, oy - y * S); } c.strokeStyle = hexA(C.accent, 0.6); c.lineWidth = 1; c.stroke();
    this.circle(ox, oy, 2.5, undefined, C.dim); this.text('CM', ox + 6, oy + 8, C.faint, 8);
    const { theta, r } = kepler(this.M, e); const px = ox + r * Math.cos(theta + om) * S, py = oy - r * Math.sin(theta + om) * S;
    const pp = { x: ox + (1 - e) * Math.cos(om) * S, y: oy - (1 - e) * Math.sin(om) * S }; this.circle(pp.x, pp.y, 2, C.purple); this.text('periastron', pp.x + 5, pp.y - 6, C.purple, 8);
    this.line(ox - S * 0.9, oy, ox + S * 0.9, oy, C.faint, 1, [2, 4]); this.text('line of nodes', ox + S * 0.9, oy - 8, C.faint, 7, 'right');
    const ex = ox, ey = oy + S * 1.55; this.text('▲', ex, ey - 14, C.text, 10, 'center'); this.text('to Earth', ex, ey, C.dim, 8, 'center');
    this.glow(px, py, 11, hexA(C.blue, 0.85)); this.circle(px, py, 4, undefined, '#e4ecff');
    // velocity arrow component along the line of sight
    const v = vr(this.M); this.line(px, py, px, py + v * 18, v > 0 ? C.red : C.blue, 2);
    // RV curve
    const gx0 = this.w * 0.5, gx1 = this.w - 12, gy0 = 16, gy1 = this.h - 28, gyc = (gy0 + gy1) / 2, vmax = 3.3;
    const GX = (f: number) => gx0 + f * (gx1 - gx0), GY = (vv: number) => gyc - vv / vmax * (gy1 - gy0) / 2;
    this.line(gx0, gyc, gx1, gyc, C.grid); this.line(gx0, gy0, gx0, gy1, C.grid); this.text('γ', gx0 - 8, gyc, C.faint, 8);
    c.beginPath(); for (let k = 0; k <= 200; k++) { const f = k / 200; const y = GY(vr(f * TAU)); k ? c.lineTo(GX(f), y) : c.moveTo(GX(f), y); } c.strokeStyle = C.accent; c.lineWidth = 1.6; c.stroke();
    this.circle(GX(this.M / TAU), GY(v), 3.5, undefined, C.blue);
    this.text('radial velocity (receding ↑)', gx0 + 4, gy0 + 2, C.dim, 8); this.text('phase →', gx1, gy1 + 10, C.dim, 8, 'right');
    const off = e * Math.cos(om) * K;
    let vmaxv = -Infinity, vminv = Infinity; for (let k = 0; k < 200; k++) { const vv = vr(k / 200 * TAU); if (vv > vmaxv) vmaxv = vv; if (vv < vminv) vminv = vv; }
    this.setReadout([
      ['K / K(e = 0)  = (1 − e²)^−½', fmt(K, 2), C.accent],
      ['Curve offset from γ, e cos ω', `${off >= 0 ? '+' : ''}${fmt(off, 2)} K₀`],
      ['Skew: time rising / time falling', fmt(this.riseFraction(vr), 2)],
      ['Shape', e < 0.05 ? 'sinusoid — ω unmeasurable' : Math.abs(Math.sin(om)) > 0.9 ? 'symmetric, sharp peak' : 'asymmetric: fast on one side'],
    ]);
  }
  private riseFraction(vr: (M: number) => number): number { let up = 0; for (let k = 0; k < 200; k++) if (vr((k + 1) / 200 * TAU) > vr(k / 200 * TAU)) up++; return up / (200 - up); }
}

/* ------------------------------------------------- 78. the mass function ---- */

class MassFunctionWidget extends CanvasWidget {
  private P = 10; private K1 = 20; private inc = 60; private m1 = 1.0; private s: { set: (v: number) => void }[] = [];
  constructor() {
    super(480 / 250);
    this.segmented([['Example', 'Textbook'], ['51 Peg', '51 Peg b'], ['Cyg X-1', 'Cygnus X-1'], ['Sirius', 'Sirius (as SB1)']], 'Example', (k) => {
      const v = k === '51 Peg' ? [4.23, 0.056, 80, 1.1] : k === 'Cyg X-1' ? [5.6, 75, 27, 21] : k === 'Sirius' ? [18300, 6.3, 44, 2.06] : [10, 20, 60, 1.0];
      this.P = v[0]; this.K1 = v[1]; this.inc = v[2]; this.m1 = v[3]; this.s[0].set(Math.log10(v[0])); this.s[1].set(Math.log10(v[1])); this.s[2].set(v[2]); this.s[3].set(v[3]);
    });
    this.s.push(this.slider('Period P', 0, 4.5, 0.01, 1, (v) => fmtDur(10 ** v * DAY_SEC), (v) => { this.P = 10 ** v; }));
    this.s.push(this.slider('Semi-amplitude K₁', -1.5, 2.5, 0.01, Math.log10(20), (v) => (10 ** v < 1 ? `${fmt(10 ** v * 1000, 0)} m/s` : `${fmt(10 ** v, 1)} km/s`), (v) => { this.K1 = 10 ** v; }));
    this.s.push(this.slider('Inclination i', 5, 90, 1, 60, (v) => `${v}°`, (v) => { this.inc = v; }));
    this.s.push(this.slider('Primary mass m₁ (from spectrum)', 0.1, 30, 0.1, 1.0, (v) => `${fmt(v, 1)} M☉`, (v) => { this.m1 = v; }));
  }
  private solve(f: number, m1: number, sini: number): number { let lo = 0, hi = 1e4; for (let k = 0; k < 80; k++) { const m = (lo + hi) / 2; if ((m * sini) ** 3 / (m1 + m) ** 2 > f) hi = m; else lo = m; } return (lo + hi) / 2; }
  protected draw() {
    const c = this.ctx; c.fillStyle = C.bg; c.fillRect(0, 0, this.w, this.h);
    const f = (this.P * DAY_SEC) * (this.K1 * 1e3) ** 3 / (TAU * GRAV) / MSUN;   // M☉
    const sini = Math.sin(this.inc * DEG), m2 = this.solve(f, this.m1, sini);
    const gx0 = 50, gx1 = this.w - 14, gy0 = 14, gy1 = this.h - 26;
    const lmin = Math.log10(Math.max(1e-5, f * 0.3)), lmax = Math.log10(Math.max(f * 1e4, m2 * 3, this.m1 * 3));
    const X = (i: number) => gx0 + (i - 5) / 85 * (gx1 - gx0), Y = (m: number) => gy1 - (Math.log10(m) - lmin) / (lmax - lmin) * (gy1 - gy0);
    for (let k = Math.ceil(lmin); k <= Math.floor(lmax); k++) { this.line(gx0, Y(10 ** k), gx1, Y(10 ** k), C.grid); this.text(k === 0 ? '1' : `10${sup(k)}`, gx0 - 4, Y(10 ** k), C.faint, 8, 'right'); }
    for (const i of [10, 30, 50, 70, 90]) { this.line(X(i), gy0, X(i), gy1, C.grid); this.text(`${i}°`, X(i), gy1 + 10, C.faint, 8, 'center'); }
    this.text('companion mass m₂ (M☉)', gx0 + 4, gy0 + 2, C.dim, 8); this.text('inclination i →', gx1, gy1 + 10, C.dim, 8, 'right');
    // m2(i) for the assumed m1
    c.beginPath(); for (let i = 5; i <= 90; i += 1) { const m = this.solve(f, this.m1, Math.sin(i * DEG)); i === 5 ? c.moveTo(X(i), Y(m)) : c.lineTo(X(i), Y(m)); } c.strokeStyle = C.accent; c.lineWidth = 1.6; c.stroke();
    this.line(gx0, Y(f), gx1, Y(f), C.green, 1, [4, 3]); this.text(`f(m) = ${fmtSci(f, 2)} M☉ — absolute lower limit`, gx0 + 6, Y(f) - 8, C.green, 8);
    this.line(gx0, Y(this.m1), gx1, Y(this.m1), hexA(C.blue, 0.6), 1, [2, 3]); this.text('m₁', gx1 - 4, Y(this.m1) - 7, C.blue, 8, 'right');
    this.circle(X(this.inc), Y(m2), 4, undefined, C.accent);
    this.text(`m₂ = ${fmtSci(m2, 2)} M☉ at i = ${this.inc}°`, X(this.inc) + (this.inc > 60 ? -8 : 8), Y(m2) - 10, C.accent, 9, this.inc > 60 ? 'right' : 'left');
    const m2min = this.solve(f, this.m1, 1);
    const kind = m2 < 0.013 ? 'planet' : m2 < 0.08 ? 'brown dwarf' : m2 < 1.4 ? 'star / white dwarf' : m2 < 3 ? 'neutron star' : 'black hole';
    this.setReadout([
      ['f(m) = PK₁³/2πG', `${fmtSci(f, 3)} M☉`, C.green],
      ['m₂ minimum (i = 90°)', m2min < 0.08 ? `${fmt(m2min * 1047, 2)} M_J` : `${fmt(m2min, 2)} M☉`],
      ['m₂ at this i', m2 < 0.08 ? `${fmt(m2 * 1047, 2)} M_J` : `${fmt(m2, 2)} M☉`, C.accent],
      ['If dark, it is a…', kind, m2 > 3 ? C.red : C.text],
    ]);
  }
}

/* ------------------------------------------------- 79. eclipsing binary ---- */

class EclipseWidget extends CanvasWidget {
  private Rl = 2.6; private Rs = 1.2; private Tl = 5000; private Ts = 9000; private inc = 88; private phase = 0; private P = 2.5; private a = 12;
  constructor(private mode: 'animate' | 'measure') {
    super(480 / 340);
    this.playButton();
    this.slider('Large star radius R_l', 1, 4, 0.05, 2.6, (v) => `${fmt(v, 2)} R☉`, (v) => { this.Rl = v; if (this.Rs > v) this.Rs = v; });
    this.slider('Small star radius R_s', 0.3, 3, 0.05, 1.2, (v) => `${fmt(v, 2)} R☉`, (v) => { this.Rs = Math.min(v, this.Rl); });
    this.slider('T large', 3000, 12000, 100, 5000, (v) => `${v} K`, (v) => { this.Tl = v; });
    this.slider('T small', 3000, 20000, 100, 9000, (v) => `${v} K`, (v) => { this.Ts = v; });
    this.slider('Inclination i', 70, 90, 0.1, 88, (v) => `${fmt(v, 1)}°`, (v) => { this.inc = v; });
  }
  /** normalised flux at phase f (0 = small star in front) */
  private flux(f: number): number {
    const ph = f * TAU, ci = Math.cos(this.inc * DEG);
    const dx = this.a * Math.sin(ph), dy = this.a * Math.cos(ph) * ci, d = Math.hypot(dx, dy);
    const Fl = Math.PI * this.Rl ** 2 * this.Tl ** 4, Fs = Math.PI * this.Rs ** 2 * this.Ts ** 4;
    const ov = discOverlap(this.Rl, this.Rs, d);
    const smallInFront = Math.cos(ph) > 0;
    const lost = smallInFront ? ov * this.Tl ** 4 : ov * this.Ts ** 4;
    return (Fl + Fs - lost) / (Fl + Fs);
  }
  protected draw(dt: number) {
    this.phase = (this.phase + dt * 0.12) % 1;
    const c = this.ctx; c.fillStyle = C.bg; c.fillRect(0, 0, this.w, this.h);
    const ph = this.phase * TAU, ci = Math.cos(this.inc * DEG);
    // top: the system as seen from Earth
    const cx = this.w / 2, cy = this.h * 0.25, S = Math.min(this.w / (2 * this.a + 8), this.h * 0.2 / 4.2);
    const xl = cx - 0.3 * this.a * Math.sin(ph) * S, yl = cy + 0.3 * this.a * Math.cos(ph) * ci * S;
    const xs = cx + 0.7 * this.a * Math.sin(ph) * S, ys = cy - 0.7 * this.a * Math.cos(ph) * ci * S;
    const drawStar = (x: number, y: number, R: number, T: number) => { const col = tempRGB(T); this.glow(x, y, R * S * 1.6, rgba(col, 0.5)); this.circle(x, y, R * S, undefined, rgba(col)); };
    const smallInFront = Math.cos(ph) > 0;
    if (smallInFront) { drawStar(xl, yl, this.Rl, this.Tl); drawStar(xs, ys, this.Rs, this.Ts); } else { drawStar(xs, ys, this.Rs, this.Ts); drawStar(xl, yl, this.Rl, this.Tl); }
    this.text(`i = ${fmt(this.inc, 1)}°  ·  a = ${this.a} R☉  ·  P = ${this.P} d`, 10, 12, C.dim, 9);
    // light curve
    const gx0 = 40, gx1 = this.w - 12, gy0 = this.h * 0.5, gy1 = this.h - 24;
    let fmin = 1; const N = 400; const curve: number[] = []; for (let k = 0; k <= N; k++) { const F = this.flux(k / N); curve.push(F); if (F < fmin) fmin = F; }
    const lo = Math.max(0, Math.min(fmin - 0.05, 0.9));
    const GX = (f: number) => gx0 + f * (gx1 - gx0), GY = (F: number) => gy1 - (F - lo) / (1 - lo) * (gy1 - gy0);
    this.line(gx0, gy1, gx1, gy1, C.grid); this.line(gx0, gy0, gx0, gy1, C.grid);
    this.text('1.0', gx0 - 4, GY(1), C.faint, 8, 'right'); this.text(fmt(lo, 2), gx0 - 4, GY(lo), C.faint, 8, 'right');
    c.beginPath(); curve.forEach((F, k) => (k ? c.lineTo(GX(k / N), GY(F)) : c.moveTo(GX(k / N), GY(F)))); c.strokeStyle = C.green; c.lineWidth = 1.6; c.stroke();
    this.circle(GX(this.phase), GY(this.flux(this.phase)), 3.5, undefined, C.accent);
    this.text('relative flux', gx0 + 4, gy0 - 8, C.dim, 8); this.text('phase (0 = small star in front) →', gx1, gy1 + 10, C.dim, 8, 'right');
    const Fp = this.flux(0.5), Fs = this.flux(0);  // primary: hotter star hidden
    const hotIsSmall = this.Ts >= this.Tl;
    const prim = hotIsSmall ? Fp : Fs, sec = hotIsSmall ? Fs : Fp;
    const eclipses = ci < (this.Rl + this.Rs) / this.a;
    const ro: Array<[string, string, string?]> = [
      ['cos i vs (R_l+R_s)/a', `${fmt(ci, 3)} ${eclipses ? '<' : '≥'} ${fmt((this.Rl + this.Rs) / this.a, 3)}: ${eclipses ? 'eclipses' : 'none'}`, eclipses ? C.green : C.red],
      ['Primary min. (hot star hidden)', `${fmt((1 - prim) * 100, 1)} % = ${fmt(-2.5 * Math.log10(prim), 2)} mag`, C.green],
      ['Secondary min.', `${fmt((1 - sec) * 100, 2)} %`],
      ['Mid-eclipse', this.a * ci + this.Rs <= this.Rl ? 'total (flat bottom)' : 'partial'],
    ];
    if (this.mode === 'measure') {
      // contacts for the small star crossing the large one (phase 0), from the overlap condition along the chord
      const b = this.a * ci;                                        // impact parameter (R☉)
      const half = (R: number) => Math.sqrt(Math.max(0, R * R - b * b));
      const x1 = half(this.Rl + this.Rs), x2 = half(Math.abs(this.Rl - this.Rs));
      const v = TAU * this.a * RSUN / (this.P * DAY_SEC) / 1e3;      // relative orbital speed, km/s
      const tOf = (x: number) => x * RSUN / 1e3 / v / 3600;          // hours from mid-eclipse
      const ta = -tOf(x1), tb = -tOf(x2), tc = tOf(x2), td = tOf(x1);
      for (const [t, name] of [[ta, 'a'], [tb, 'b'], [tc, 'c'], [td, 'd']] as Array<[number, string]>) { const f = 0.5 + t * 3600 * 1e3 * v / (TAU * this.a * RSUN); this.line(GX(f), gy0 + 10, GX(f), gy1, hexA(C.purple, 0.7), 1, [2, 3]); this.text(`t${name}`, GX(f) + (name === 'a' || name === 'c' ? -3 : 3), gy0 + 4, C.purple, 8, name === 'a' || name === 'c' ? 'right' : 'left'); }
      const RsEst = v / 2 * (tb - ta) * 3600 * 1e3 / RSUN, RlEst = v / 2 * (tc - ta) * 3600 * 1e3 / RSUN;
      const B0 = 1, Bp = prim, Bs = sec; const ratio4 = (B0 - Bp) / (B0 - Bs); const Tratio = Math.pow(Math.max(ratio4, 1e-6), 0.25);
      const total = hotIsSmall && this.a * ci + this.Rs <= this.Rl;
      ro.push(['v = 2πa/P', `${fmt(v, 0)} km/s`], ['t_b − t_a, t_c − t_a', `${fmt(tb - ta, 2)} h, ${fmt(tc - ta, 2)} h`, C.purple],
        ['R_s = v(t_b−t_a)/2', `${fmt(RsEst, 2)} R☉`, Math.abs(RsEst - this.Rs) < 0.05 ? C.green : C.red],
        ['R_l = v(t_c−t_a)/2', `${fmt(RlEst, 2)} R☉`, Math.abs(RlEst - this.Rl) < 0.05 ? C.green : C.red],
        ['True R_s, R_l', `${fmt(this.Rs, 2)}, ${fmt(this.Rl, 2)} R☉`],
        ['T_s/T_l from depths', fmt(Tratio, 3), total ? C.green : C.red],
        ['True T_s/T_l', fmt(this.Ts / this.Tl, 3)]);
      if (!total) ro.push(['Note', 'depth ratio needs a hotter small star, totally eclipsed']);
    }
    this.setReadout(ro);
  }
}

/* ------------------------------------------------- 80. light-curve gallery ---- */

class LcGalleryWidget extends CanvasWidget {
  private type: 'EA' | 'EB' | 'EW' = 'EA'; private phase = 0;
  constructor() {
    super(480 / 280);
    this.segmented<'EA' | 'EB' | 'EW'>([['EA', 'Algol (detached)'], ['EB', 'β Lyrae (semi-detached)'], ['EW', 'W UMa (contact)']], 'EA', (t) => { this.type = t; });
    this.playButton();
  }
  private params() {
    return this.type === 'EA' ? { a: 16, R1: 2.9, R2: 3.5, T1: 12500, T2: 4500, ell: 0.0, name: 'Algol: B8 V + K2 IV, P = 2.87 d', q: 0.22 }
      : this.type === 'EB' ? { a: 6, R1: 2.4, R2: 2.0, T1: 13000, T2: 9000, ell: 0.35, name: 'β Lyrae: tidally stretched stars, P = 12.9 d', q: 0.5 }
        : { a: 3.6, R1: 1.8, R2: 1.5, T1: 5800, T2: 5700, ell: 0.6, name: 'W UMa: a common envelope, P = 0.33 d', q: 0.6 };
  }
  private flux(f: number): number {
    const p = this.params(); const ph = f * TAU + Math.PI, ci = Math.cos(84 * DEG);
    const d = Math.hypot(p.a * Math.sin(ph), p.a * Math.cos(ph) * ci);
    const F1 = Math.PI * p.R1 ** 2 * p.T1 ** 4, F2 = Math.PI * p.R2 ** 2 * p.T2 ** 4, ov = discOverlap(p.R1, p.R2, d);
    const lost = Math.cos(ph) > 0 ? ov * p.T1 ** 4 : ov * p.T2 ** 4;
    const ellip = 1 - p.ell * 0.5 * (1 + Math.cos(2 * ph)) * 0.5;       // projected area shrinks at conjunctions
    return (F1 + F2 - lost) / (F1 + F2) * ellip;
  }
  protected draw(dt: number) {
    this.phase = (this.phase + dt * 0.15) % 1;
    const c = this.ctx; c.fillStyle = C.bg; c.fillRect(0, 0, this.w, this.h);
    const p = this.params(); const ph = this.phase * TAU + Math.PI;
    // geometry, face-on sketch (top) with tidal stretching
    const cx = this.w / 2, cy = this.h * 0.27, S = Math.min(this.w, this.h) * 0.021;
    const x1 = cx - p.a * S * p.q / (1 + p.q) * Math.sin(ph) * 0 - p.a * S * (p.q / (1 + p.q)) * Math.sin(ph), x2 = cx + p.a * S * (1 / (1 + p.q)) * Math.sin(ph);
    const y1 = cy + p.a * S * (p.q / (1 + p.q)) * Math.cos(ph) * 0.18, y2 = cy - p.a * S * (1 / (1 + p.q)) * Math.cos(ph) * 0.18;
    const blob = (x: number, y: number, R: number, T: number, stretch: number, toward: number) => { c.save(); c.translate(x, y); c.rotate(toward); c.scale(1 + stretch, 1 - stretch * 0.4); this.glow(0, 0, R * S * 1.5, rgba(tempRGB(T), 0.45)); this.circle(0, 0, R * S, undefined, rgba(tempRGB(T))); c.restore(); };
    const ang = Math.atan2(y2 - y1, x2 - x1);
    if (Math.cos(ph) > 0) { blob(x1, y1, p.R1, p.T1, p.ell * 0.5, ang); blob(x2, y2, p.R2, p.T2, p.ell * 0.5, ang); } else { blob(x2, y2, p.R2, p.T2, p.ell * 0.5, ang); blob(x1, y1, p.R1, p.T1, p.ell * 0.5, ang); }
    if (this.type === 'EB') { c.beginPath(); c.moveTo(x1 + p.R1 * S * 0.8 * Math.cos(ang), y1 + p.R1 * S * 0.8 * Math.sin(ang)); c.quadraticCurveTo((x1 + x2) / 2, (y1 + y2) / 2 - 10, x2 - p.R2 * S * Math.cos(ang), y2 - p.R2 * S * Math.sin(ang)); c.strokeStyle = hexA(C.accent, 0.5); c.lineWidth = 2; c.stroke(); this.text('gas stream', (x1 + x2) / 2, (y1 + y2) / 2 - 16, hexA(C.accent, 0.7), 7, 'center'); }
    this.text(p.name, cx, 12, C.dim, 9, 'center');
    // light curve
    const gx0 = 40, gx1 = this.w - 12, gy0 = this.h * 0.5, gy1 = this.h - 22;
    const N = 300; const cur: number[] = []; let fmin = 1; for (let k = 0; k <= N; k++) { const F = this.flux(k / N); cur.push(F); fmin = Math.min(fmin, F); }
    const lo = Math.min(0.9, fmin - 0.05);
    const GX = (f: number) => gx0 + f * (gx1 - gx0), GY = (F: number) => gy1 - (F - lo) / (1 - lo) * (gy1 - gy0);
    this.line(gx0, gy1, gx1, gy1, C.grid); this.line(gx0, gy0, gx0, gy1, C.grid);
    c.beginPath(); cur.forEach((F, k) => (k ? c.lineTo(GX(k / N), GY(F)) : c.moveTo(GX(k / N), GY(F)))); c.strokeStyle = C.green; c.lineWidth = 1.6; c.stroke();
    this.circle(GX(this.phase), GY(this.flux(this.phase)), 3.5, undefined, C.accent);
    this.text('relative flux', gx0 + 4, gy0 - 8, C.dim, 8); this.text('phase →', gx1, gy1 + 10, C.dim, 8, 'right');
    const d1 = 1 - this.flux(0.5), d2 = 1 - this.flux(0);
    this.setReadout([
      ['Between eclipses', p.ell === 0 ? 'flat (spherical stars)' : p.ell < 0.5 ? 'varying (ellipsoidal)' : 'varying (shared envelope)', C.green],
      ['Primary / secondary depth', `${fmt(Math.max(d1, d2) * 100, 1)} % / ${fmt(Math.min(d1, d2) * 100, 1)} %`],
      ['R/a (how close)', `${fmt((p.R1 + p.R2) / p.a, 2)}`],
      ['Configuration', this.type === 'EA' ? 'detached' : this.type === 'EB' ? 'semi-detached (Roche lobe)' : 'contact'],
    ]);
  }
}

/* ------------------------------------------------- 81. planet radial-velocity wobble ---- */

class PlanetRvWidget extends CanvasWidget {
  private mp = 317.8; private P = 4332.6; private Ms = 1; private phase = 0; private s: { set: (v: number) => void }[] = [];
  constructor() {
    super(480 / 270);
    this.segmented([['Jupiter', 'Jupiter'], ['Earth', 'Earth'], ['51Peg', '51 Peg b'], ['Proxima', 'Proxima b']], 'Jupiter', (k) => {
      const v = k === 'Jupiter' ? [317.8, 4332.6, 1.0] : k === 'Earth' ? [1, 365.25, 1.0] : k === '51Peg' ? [146, 4.23, 1.11] : [1.07, 11.19, 0.122];
      this.mp = v[0]; this.P = v[1]; this.Ms = v[2]; this.s[0].set(Math.log10(v[0])); this.s[1].set(Math.log10(v[1])); this.s[2].set(v[2]);
    });
    this.playButton();
    this.s.push(this.slider('Planet mass m_p sin i', -0.5, 3.5, 0.01, Math.log10(317.8), (v) => (10 ** v < 30 ? `${fmt(10 ** v, 2)} M⊕` : `${fmt(10 ** v / 317.8, 2)} M_J`), (v) => { this.mp = 10 ** v; }));
    this.s.push(this.slider('Orbital period P', 0, 4.3, 0.01, Math.log10(4332.6), (v) => fmtDur(10 ** v * DAY_SEC), (v) => { this.P = 10 ** v; }));
    this.s.push(this.slider('Star mass M★', 0.1, 2, 0.01, 1, (v) => `${fmt(v, 2)} M☉`, (v) => { this.Ms = v; }));
  }
  protected draw(dt: number) {
    this.phase = (this.phase + dt * 0.4) % 1;
    const c = this.ctx; c.fillStyle = C.bg; c.fillRect(0, 0, this.w, this.h);
    const mp = this.mp * MEARTH, Ms = this.Ms * MSUN, Ps = this.P * DAY_SEC;
    const a = Math.cbrt(GRAV * (Ms + mp) * Ps * Ps / (4 * Math.PI * Math.PI));
    const K = Math.cbrt(2 * Math.PI * GRAV / Ps) * mp / Math.pow(Ms + mp, 2 / 3);   // m/s, i = 90°
    // left: the star's reflex orbit (exaggerated) around the CM
    const ox = this.w * 0.24, oy = this.h * 0.45, S = Math.min(this.w * 0.17, this.h * 0.3);
    const ph = this.phase * TAU;
    c.beginPath(); c.arc(ox, oy, S, 0, TAU); c.strokeStyle = hexA(C.blue, 0.5); c.lineWidth = 1; c.setLineDash([3, 4]); c.stroke(); c.setLineDash([]);
    const px = ox + S * Math.cos(ph), py = oy - S * Math.sin(ph) * 0.35, sx = ox - S * 0.28 * Math.cos(ph), sy = oy + S * 0.28 * Math.sin(ph) * 0.35;
    c.beginPath(); c.ellipse(ox, oy, S * 0.28, S * 0.28 * 0.35, 0, 0, TAU); c.strokeStyle = hexA(C.star, 0.5); c.stroke();
    this.circle(ox, oy, 2, undefined, C.dim);
    this.glow(sx, sy, 14, hexA(C.star, 0.8)); this.circle(sx, sy, 6, undefined, '#fff4d6');
    this.circle(px, py, 3, undefined, C.blue);
    this.text('star wobble exaggerated', ox, oy + S * 0.5 + 14, C.faint, 7, 'center');
    const vrNow = -Math.sin(ph); this.line(sx, sy, sx, sy + vrNow * 18, vrNow > 0 ? C.red : C.blue, 2);
    this.text('▼ to Earth', ox, this.h - 12, C.dim, 8, 'center');
    // right: RV curve with noise bands
    const gx0 = this.w * 0.5, gx1 = this.w - 12, gy0 = 14, gy1 = this.h - 26, gyc = (gy0 + gy1) / 2;
    const scaleV = Math.max(K * 1.3, 0.5);
    const GX = (f: number) => gx0 + f * (gx1 - gx0), GY = (v: number) => gyc - v / scaleV * (gy1 - gy0) / 2;
    for (const [sig, name, col] of [[10, '1995 (10 m/s)', C.red], [1, 'HARPS (1 m/s)', C.accent], [0.3, 'ESPRESSO (0.3 m/s)', C.green]] as Array<[number, string, string]>) {
      if (sig < scaleV * 1.2) { c.fillStyle = hexA(col, 0.08); c.fillRect(gx0, GY(sig), gx1 - gx0, GY(-sig) - GY(sig)); this.text(name, gx1 - 2, GY(sig) - 6, hexA(col, 0.8), 7, 'right'); }
    }
    this.line(gx0, gyc, gx1, gyc, C.grid); this.line(gx0, gy0, gx0, gy1, C.grid);
    c.beginPath(); for (let k = 0; k <= 200; k++) { const f = k / 200; k ? c.lineTo(GX(f), GY(K * Math.sin(f * TAU))) : c.moveTo(GX(f), GY(K * Math.sin(f * TAU))); } c.strokeStyle = C.star; c.lineWidth = 1.6; c.stroke();
    this.circle(GX(this.phase), GY(K * Math.sin(ph)), 3.5, undefined, C.star);
    this.text(`K = ${K < 1 ? fmt(K * 100, 1) + ' cm/s' : fmt(K, K < 10 ? 2 : 1) + ' m/s'}`, gx0 + 4, gy0 + 2, C.star, 10);
    this.text('one orbit →', gx1, gy1 + 10, C.dim, 8, 'right');
    const detect = K > 10 ? 'easy (1995 tech)' : K > 1 ? 'modern spectrographs' : K > 0.3 ? 'state of the art' : 'not yet possible';
    this.setReadout([
      ['Semi-major axis a', `${fmt(a / AU_M, 3)} AU`],
      ['K (i = 90°)', `${K < 1 ? fmt(K * 100, 1) + ' cm/s' : fmt(K, 2) + ' m/s'}`, C.star],
      ['Star orbit radius', `${fmt(a * mp / (Ms + mp) / RSUN, 4)} R☉`],
      ['Detectability', detect, K > 1 ? C.green : K > 0.3 ? C.accent : C.red],
      ['Δλ/λ = K/c', fmtSci(K / C_LIGHT, 2)],
    ]);
  }
}

/* ------------------------------------------------- 82. transit ---- */

class TransitWidget extends CanvasWidget {
  private Rp = 11.2; private aAU = 0.05; private b = 0.3; private Rs = 1; private phase = 0; private limb = true;
  constructor() {
    super(480 / 300);
    this.segmented([['hj', 'Hot Jupiter'], ['earth', 'Earth-Sun'], ['trappist', 'TRAPPIST-1e']], 'hj', (k) => {
      const v = k === 'hj' ? [11.2, 0.05, 0.3, 1] : k === 'earth' ? [1, 1, 0.3, 1] : [0.92, 0.029, 0.2, 0.12];
      this.Rp = v[0]; this.aAU = v[1]; this.b = v[2]; this.Rs = v[3]; this.sl[0].set(Math.log10(v[0])); this.sl[1].set(Math.log10(v[1])); this.sl[2].set(v[2]); this.sl[3].set(v[3]);
    });
    this.playButton();
    const t = $('button', 'active', 'Limb darkening'); t.addEventListener('click', () => { this.limb = !this.limb; t.classList.toggle('active', this.limb); }); this.controls.appendChild(t);
    this.sl.push(this.slider('Planet radius R_p', -0.3, 1.3, 0.01, Math.log10(11.2), (v) => `${fmt(10 ** v, 2)} R⊕`, (v) => { this.Rp = 10 ** v; }));
    this.sl.push(this.slider('Orbit a', -2, 0.7, 0.01, Math.log10(0.05), (v) => `${fmt(10 ** v, 3)} AU`, (v) => { this.aAU = 10 ** v; }));
    this.sl.push(this.slider('Impact parameter b = a cos i / R★', 0, 1.3, 0.01, 0.3, (v) => fmt(v, 2), (v) => { this.b = v; }));
    this.sl.push(this.slider('Star radius R★', 0.1, 2, 0.01, 1, (v) => `${fmt(v, 2)} R☉`, (v) => { this.Rs = v; }));
  }
  private sl: { set: (v: number) => void }[] = [];
  /** flux at planet centre offset (x, b) in stellar radii, with simple linear limb darkening */
  private flux(x: number): number {
    const k = this.Rp * REARTH / (this.Rs * RSUN); const d = Math.hypot(x, this.b);
    if (!this.limb) { const ov = discOverlap(1, k, d); return 1 - ov / Math.PI; }
    const u = 0.6; const I = (r: number) => 1 - u * (1 - Math.sqrt(Math.max(0, 1 - r * r)));
    const norm = Math.PI * (1 - u / 3);
    // numerically integrate blocked intensity over the planet disc
    let blocked = 0; const n = 14;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const px = x + (i + 0.5) / n * 2 * k - k, py = this.b + (j + 0.5) / n * 2 * k - k; if (Math.hypot(px - x, py - this.b) > k) continue; const r = Math.hypot(px, py); if (r < 1) blocked += I(r) * (2 * k / n) ** 2; }
    return 1 - blocked / norm;
  }
  protected draw(dt: number) {
    this.phase = (this.phase + dt * 0.25) % 1;
    const c = this.ctx; c.fillStyle = C.bg; c.fillRect(0, 0, this.w, this.h);
    const k = this.Rp * REARTH / (this.Rs * RSUN);
    const xNow = (this.phase - 0.5) * 3.2;     // in R★
    // star disc
    const cx = this.w / 2, cy = this.h * 0.28, R = this.h * 0.2;
    const g = c.createRadialGradient(cx, cy, 0, cx, cy, R); g.addColorStop(0, '#fff2c8'); g.addColorStop(1, this.limb ? '#b8862e' : '#f3d58a'); c.fillStyle = g; c.beginPath(); c.arc(cx, cy, R, 0, TAU); c.fill();
    this.line(cx - R * 1.7, cy + this.b * R, cx + R * 1.7, cy + this.b * R, hexA(C.blue, 0.5), 1, [3, 4]);
    this.circle(cx + xNow * R, cy + this.b * R, Math.max(1.2, k * R), undefined, '#0b0f1c');
    this.text(`b = ${fmt(this.b, 2)}`, cx + R * 1.75, cy + this.b * R, C.blue, 8);
    // light curve
    const gx0 = 44, gx1 = this.w - 12, gy0 = this.h * 0.56, gy1 = this.h - 24;
    const N = 240; const cur: number[] = []; let fmin = 1; for (let i = 0; i <= N; i++) { const F = this.flux((i / N - 0.5) * 3.2); cur.push(F); fmin = Math.min(fmin, F); }
    const depth = 1 - fmin, lo = 1 - Math.max(depth * 1.4, 1e-5);
    const GX = (f: number) => gx0 + f * (gx1 - gx0), GY = (F: number) => gy1 - (F - lo) / (1 - lo) * (gy1 - gy0);
    this.line(gx0, gy1, gx1, gy1, C.grid); this.line(gx0, gy0, gx0, gy1, C.grid);
    this.text('1', gx0 - 4, GY(1), C.faint, 8, 'right'); this.text(`−${depth < 1e-3 ? fmt(depth * 1e6, 0) + ' ppm' : fmt(depth * 100, 2) + ' %'}`, gx0 - 4, GY(fmin), C.faint, 8, 'right');
    c.beginPath(); cur.forEach((F, i) => (i ? c.lineTo(GX(i / N), GY(F)) : c.moveTo(GX(i / N), GY(F)))); c.strokeStyle = C.green; c.lineWidth = 1.6; c.stroke();
    this.circle(GX(this.phase), GY(this.flux(xNow)), 3.5, undefined, C.accent);
    this.text('relative flux', gx0 + 4, gy0 - 8, C.dim, 8); this.text('time →', gx1, gy1 + 10, C.dim, 8, 'right');
    // numbers
    const aM = this.aAU * AU_M, RsM = this.Rs * RSUN, Ms = this.Rs ** 1.25;     // crude M–R for the readout
    const P = TAU * Math.sqrt(aM ** 3 / (GRAV * Ms * MSUN));
    const chord = Math.sqrt(Math.max(0, (1 + k) ** 2 - this.b ** 2)) * 2;        // in R★
    const dur = chord * RsM / (TAU * aM / P);
    const prob = RsM / aM;
    const transits = this.b < 1 + k;
    this.setReadout([
      ['Depth (R_p/R★)²', `${fmt(k * k * 100, 3)} % = ${fmt(k * k * 1e6, 0)} ppm`, C.green],
      ['Transit?', transits ? 'yes' : 'no (b > 1 + k)', transits ? C.green : C.red],
      ['Period P', fmtDur(P)],
      ['Duration', transits ? fmtDur(dur) : '—'],
      ['Probability R★/a', `${fmt(prob * 100, 2)} % (1 in ${fmt(1 / prob, 0)})`, prob > 0.05 ? C.green : C.accent],
      ['Shape', !transits ? '—' : this.b > 1 - k ? 'V-shaped (grazing)' : this.limb ? 'rounded bottom' : 'flat bottom'],
    ]);
  }
}

/* ------------------------------------------------- 83. detection methods ---- */

type MethodKey = 'rv' | 'transit' | 'imaging' | 'micro' | 'astro' | 'timing';
const METHOD_INFO: Record<MethodKey, { name: string; col: string; note: string }> = {
  rv: { name: 'RV', col: '#6fa8ff', note: 'measures m sin i; best for massive, close planets' },
  transit: { name: 'Transit', col: '#7fd08a', note: 'measures radius; needs i ≈ 90°, best for short P' },
  imaging: { name: 'Imaging', col: '#f0a36a', note: 'young, self-luminous giants far from the star' },
  micro: { name: 'Microlens.', col: '#c58cff', note: 'one-off events; sensitive to cold planets at a few AU' },
  astro: { name: 'Astrom.', col: '#ffd86a', note: 'measures true mass; favours wide orbits (Gaia)' },
  timing: { name: 'Timing', col: '#ff7b7b', note: 'pulsars and eclipse timing; the first confirmed planets' },
};
/** synthetic population: [method, mass (M⊕), separation (AU)] seeded to mimic the real catalogue layout */
function methodPopulation(): Array<[MethodKey, number, number]> {
  const rnd = mulberry(77); const out: Array<[MethodKey, number, number]> = [];
  const add = (m: MethodKey, n: number, lm: number, sm: number, la: number, sa: number) => { for (let i = 0; i < n; i++) out.push([m, 10 ** (lm + gaussRand(rnd) * sm), 10 ** (la + gaussRand(rnd) * sa)]); };
  add('rv', 180, 2.0, 0.7, -0.3, 0.6); add('rv', 80, 1.3, 0.4, -0.9, 0.4);
  add('transit', 320, 0.7, 0.45, -1.3, 0.35); add('transit', 120, 2.3, 0.4, -1.4, 0.3);
  add('imaging', 25, 3.3, 0.35, 1.9, 0.4); add('micro', 45, 1.9, 0.6, 0.45, 0.25); add('astro', 12, 2.6, 0.3, 0.5, 0.3); add('timing', 10, 0.8, 0.9, -0.2, 0.5);
  return out.filter(([, m, a]) => m > 0.05 && m < 2e4 && a > 0.004 && a < 300);
}
const SOLAR_SYS: Array<[string, number, number]> = [['Mercury', 0.055, 0.39], ['Venus', 0.815, 0.72], ['Earth', 1, 1], ['Mars', 0.107, 1.52], ['Jupiter', 317.8, 5.2], ['Saturn', 95.2, 9.5], ['Uranus', 14.5, 19.2], ['Neptune', 17.1, 30.1]];

class MethodsWidget extends CanvasWidget {
  private on: Record<MethodKey, boolean> = { rv: true, transit: true, imaging: true, micro: true, astro: true, timing: true };
  private pop = methodPopulation(); private focus: MethodKey | null = null;
  constructor() {
    super(480 / 330);
    const bar = $('div', 'lw-seg'); bar.style.flexWrap = 'wrap';
    (Object.keys(METHOD_INFO) as MethodKey[]).forEach((k) => {
      const b = $('button', 'active', METHOD_INFO[k].name); b.style.borderBottom = `2px solid ${METHOD_INFO[k].col}`;
      b.addEventListener('click', () => { this.on[k] = !this.on[k]; b.classList.toggle('active', this.on[k]); this.focus = this.on[k] ? k : null; });
      b.addEventListener('mouseenter', () => { this.focus = k; }); bar.appendChild(b);
    });
    this.controls.appendChild(bar);
  }
  protected draw() {
    const c = this.ctx; c.fillStyle = C.bg; c.fillRect(0, 0, this.w, this.h);
    const gx0 = 46, gx1 = this.w - 14, gy0 = 14, gy1 = this.h - 30;
    const X = (a: number) => gx0 + (Math.log10(a) + 2.4) / 4.9 * (gx1 - gx0), Y = (m: number) => gy1 - (Math.log10(m) + 1.4) / 5.8 * (gy1 - gy0);
    for (let k = -1; k <= 4; k++) { this.line(gx0, Y(10 ** k), gx1, Y(10 ** k), C.grid); this.text(k === 0 ? '1' : `10${sup(k)}`, gx0 - 4, Y(10 ** k), C.faint, 8, 'right'); }
    for (let k = -2; k <= 2; k++) { this.line(X(10 ** k), gy0, X(10 ** k), gy1, C.grid); this.text(k === 0 ? '1' : `10${sup(k)}`, X(10 ** k), gy1 + 10, C.faint, 8, 'center'); }
    this.text('planet mass (M⊕)', gx0 + 4, gy0 + 2, C.dim, 8); this.text('separation (AU) →', gx1, gy1 + 20, C.dim, 8, 'right');
    this.line(gx0, Y(317.8), gx1, Y(317.8), hexA(C.faint, 0.6), 1, [2, 4]); this.text('Jupiter mass', gx1 - 2, Y(317.8) - 6, C.faint, 7, 'right');
    this.line(gx0, Y(1), gx1, Y(1), hexA(C.faint, 0.6), 1, [2, 4]);
    const counts: Partial<Record<MethodKey, number>> = {};
    for (const [m, mass, a] of this.pop) { if (!this.on[m]) continue; counts[m] = (counts[m] ?? 0) + 1; const dim = this.focus && this.focus !== m; c.fillStyle = hexA(METHOD_INFO[m].col, dim ? 0.15 : 0.75); c.beginPath(); c.arc(X(a), Y(mass), 2.1, 0, TAU); c.fill(); }
    for (const [name, mass, a] of SOLAR_SYS) { this.circle(X(a), Y(mass), 3.5, '#ffffff', undefined, 1.2); this.text(name, X(a) + 5, Y(mass) - 5, C.text, 7); }
    const total = Object.values(counts).reduce((s, v) => s + (v ?? 0), 0);
    const ro: Array<[string, string, string?]> = [['Planets shown (synthetic)', `${total}`]];
    if (this.focus) ro.push([METHOD_INFO[this.focus].name, METHOD_INFO[this.focus].note, METHOD_INFO[this.focus].col]);
    ro.push(['Earth at 1 AU region', 'nearly empty', C.accent], ['Selection effect', 'easy ≠ common']);
    this.setReadout(ro);
  }
}

/* ------------------------------------------------- 84. mass–radius / density ---- */

/** mass–radius loci for pure compositions (M⊕, R⊕), smoothed power-law fits */
const MR_CURVES: Array<{ name: string; col: string; f: (m: number) => number }> = [
  { name: 'iron', col: '#c8c8d0', f: (m) => 0.82 * m ** 0.27 * (m < 1 ? 1 : 1 - 0.04 * Math.log10(m)) },
  { name: 'rock (Earth-like)', col: '#d9a066', f: (m) => 1.0 * m ** 0.28 * (m < 1 ? 1 : 1 - 0.03 * Math.log10(m)) },
  { name: 'water world', col: '#6fc3ff', f: (m) => 1.35 * m ** 0.28 },
  { name: 'H/He gas giant', col: '#f4d07a', f: (m) => 11.5 / Math.sqrt(1 + (m / 60) ** -1.2) },
];
const DENSITY_PLANETS: Array<[string, number, number]> = [['Earth', 1, 1], ['Venus', 0.815, 0.95], ['Mars', 0.107, 0.53], ['Mercury', 0.055, 0.38], ['Neptune', 17.1, 3.88], ['Uranus', 14.5, 4.01], ['Saturn', 95.2, 9.45], ['Jupiter', 317.8, 11.2], ['Kepler-10b', 3.3, 1.47], ['55 Cnc e', 8.0, 1.88], ['GJ 1214 b', 8.2, 2.74], ['Kepler-11e', 8.0, 4.19], ['WASP-17 b', 154, 22.3], ['HD 209458 b', 220, 15.4], ['TRAPPIST-1e', 0.69, 0.92], ['Kepler-36b', 4.5, 1.49], ['Kepler-36c', 8.1, 3.68], ['LHS 1140 b', 6.4, 1.73]];

class DensityWidget extends CanvasWidget {
  private m = 5; private r = 2; private drag = false;
  constructor() {
    super(480 / 330);
    this.slider('Test planet mass', -1.3, 3, 0.01, Math.log10(5), (v) => `${fmt(10 ** v, 2)} M⊕`, (v) => { this.m = 10 ** v; });
    this.slider('Test planet radius', -0.5, 1.4, 0.01, Math.log10(2), (v) => `${fmt(10 ** v, 2)} R⊕`, (v) => { this.r = 10 ** v; });
    const move = (e: PointerEvent) => { const p = canvasPos(this.canvas, e, this.w, this.h); this.m = 10 ** ((p.x - 46) / (this.w - 60) * 4.3 - 1.3); this.r = 10 ** ((this.h - 30 - p.y) / (this.h - 44) * 1.9 - 0.5); this.m = Math.min(1000, Math.max(0.05, this.m)); this.r = Math.min(25, Math.max(0.3, this.r)); };
    this.canvas.addEventListener('pointerdown', (e) => { this.drag = true; move(e); });
    this.canvas.addEventListener('pointermove', (e) => { if (this.drag) move(e); });
    window.addEventListener('pointerup', () => { this.drag = false; });
  }
  protected draw() {
    const c = this.ctx; c.fillStyle = C.bg; c.fillRect(0, 0, this.w, this.h);
    const gx0 = 46, gx1 = this.w - 14, gy0 = 14, gy1 = this.h - 30;
    const X = (m: number) => gx0 + (Math.log10(m) + 1.3) / 4.3 * (gx1 - gx0), Y = (r: number) => gy1 - (Math.log10(r) + 0.5) / 1.9 * (gy1 - gy0);
    for (const k of [-1, 0, 1, 2, 3]) { this.line(X(10 ** k), gy0, X(10 ** k), gy1, C.grid); this.text(k === 0 ? '1' : `10${sup(k)}`, X(10 ** k), gy1 + 10, C.faint, 8, 'center'); }
    for (const r of [0.5, 1, 2, 4, 10, 20]) { this.line(gx0, Y(r), gx1, Y(r), C.grid); this.text(`${r}`, gx0 - 4, Y(r), C.faint, 8, 'right'); }
    this.text('radius (R⊕)', gx0 + 4, gy0 + 2, C.dim, 8); this.text('mass (M⊕) →', gx1, gy1 + 20, C.dim, 8, 'right');
    for (const cv of MR_CURVES) { c.beginPath(); let first = true; for (let lm = -1.3; lm <= 3; lm += 0.05) { const m = 10 ** lm; if (cv.name.startsWith('H/He') && m < 3) continue; const r = cv.f(m); first ? c.moveTo(X(m), Y(r)) : c.lineTo(X(m), Y(r)); first = false; } c.strokeStyle = hexA(cv.col, 0.75); c.lineWidth = 1.4; c.stroke(); if (cv.name.startsWith('H/He')) this.text(cv.name, X(22) + 4, Y(cv.f(22)) - 8, cv.col, 8); else { const mEnd = 900; this.text(cv.name, X(mEnd) - 4, Y(cv.f(mEnd)) - 6, cv.col, 8, 'right'); } }
    for (const [name, m, r] of DENSITY_PLANETS) { const solar = ['Earth', 'Venus', 'Mars', 'Mercury', 'Neptune', 'Uranus', 'Saturn', 'Jupiter'].includes(name); c.fillStyle = solar ? '#ffffff' : C.accent; c.beginPath(); c.arc(X(m), Y(r), solar ? 3 : 2.5, 0, TAU); c.fill(); this.text(name, X(m) + 5, Y(r) - 4, solar ? C.text : C.accent, 7); }
    // test planet
    this.glow(X(this.m), Y(this.r), 12, hexA(C.green, 0.7)); this.circle(X(this.m), Y(this.r), 5, '#ffffff', C.green, 1.5);
    const rho = this.m * MEARTH / (4 / 3 * Math.PI * (this.r * REARTH) ** 3) / 1000;   // g/cm³
    const g = GRAV * this.m * MEARTH / (this.r * REARTH) ** 2 / 9.81;
    const vesc = Math.sqrt(2 * GRAV * this.m * MEARTH / (this.r * REARTH)) / 1e3;
    const best = MR_CURVES.map((cv) => ({ cv, d: Math.abs(Math.log10(cv.f(this.m) / this.r)) })).sort((a, b) => a.d - b.d)[0];
    const kind = rho > 8 ? 'iron-rich' : rho > 3.5 ? 'rocky' : rho > 1.8 ? 'water / thick atmosphere' : rho > 0.6 ? 'gas or ice giant' : 'inflated hot giant';
    this.setReadout([
      ['Test planet (drag it)', `${fmt(this.m, 2)} M⊕, ${fmt(this.r, 2)} R⊕`, C.green],
      ['Mean density (Earth 5.51)', `${fmt(rho, 2)} g/cm³`, C.green],
      ['Nearest composition curve', best.cv.name, best.cv.col],
      ['Likely nature', kind],
      ['g, v_esc', `${fmt(g, 2)} g, ${fmt(vesc, 1)} km/s`],
    ]);
  }
}

/* ------------------------------------------------- 85. habitable-zone planet ---- */

const HZ_STARS: Array<{ key: string; name: string; M: number; R: number; L: number; T: number }> = [
  { key: 'M', name: 'M dwarf (0.12 M☉)', M: 0.12, R: 0.15, L: 0.0016, T: 3050 }, { key: 'K', name: 'K dwarf (0.7 M☉)', M: 0.7, R: 0.7, L: 0.15, T: 4600 },
  { key: 'G', name: 'Sun-like (1 M☉)', M: 1, R: 1, L: 1, T: 5772 }, { key: 'F', name: 'F star (1.3 M☉)', M: 1.3, R: 1.3, L: 3.2, T: 6500 }, { key: 'A', name: 'A star (2 M☉)', M: 2, R: 1.8, L: 20, T: 8500 },
];

class HabitableWidget extends CanvasWidget {
  private star = HZ_STARS[2]; private aAU = 1; private aSet!: { set: (v: number) => void }; private phase = 0;
  constructor() {
    super(480 / 280);
    this.segmented(HZ_STARS.map((s) => [s.key, s.key === 'G' ? 'Sun' : s.key + ' dwarf'] as [string, string]), 'G', (k) => { this.star = HZ_STARS.find((s) => s.key === k)!; const a = Math.sqrt(this.star.L); this.aAU = a; this.aSet.set(Math.log10(a)); });
    this.playButton();
    this.aSet = this.slider('Planet orbit a', -2, 1, 0.01, 0, (v) => `${fmt(10 ** v, 3)} AU`, (v) => { this.aAU = 10 ** v; });
  }
  protected draw(dt: number) {
    this.phase = (this.phase + dt * 0.3) % 1;
    const c = this.ctx; c.fillStyle = C.bg; c.fillRect(0, 0, this.w, this.h);
    const s = this.star;
    const hzIn = Math.sqrt(s.L / 1.1), hzOut = Math.sqrt(s.L / 0.53);          // conservative HZ (Kopparapu-like flux limits)
    const ox = this.w * 0.3, oy = this.h * 0.5, S = Math.min(this.w * 0.26, this.h * 0.42);
    const R = (a: number) => (Math.log10(a) + 2.1) / 3.2 * S;                      // log radial scale
    c.beginPath(); c.arc(ox, oy, R(hzOut), 0, TAU); c.arc(ox, oy, R(hzIn), 0, TAU, true); c.fillStyle = hexA(C.green, 0.18); c.fill('evenodd');
    this.circle(ox, oy, R(hzIn), hexA(C.green, 0.5)); this.circle(ox, oy, R(hzOut), hexA(C.green, 0.5));
    this.text('habitable zone', ox, oy - R(hzOut) - 6, C.green, 8, 'center');
    const col = tempRGB(s.T); this.glow(ox, oy, 16 + s.R * 6, rgba(col, 0.7)); this.circle(ox, oy, 4 + s.R * 3, undefined, rgba(col));
    c.beginPath(); c.arc(ox, oy, R(this.aAU), 0, TAU); c.strokeStyle = hexA(C.accent, 0.6); c.setLineDash([3, 3]); c.stroke(); c.setLineDash([]);
    const ph = this.phase * TAU; this.circle(ox + R(this.aAU) * Math.cos(ph), oy + R(this.aAU) * Math.sin(ph), 3.5, undefined, C.accent);
    this.text('log radial scale', ox, oy + S + 10, C.faint, 7, 'center');
    // numbers for an Earth twin
    const aM = this.aAU * AU_M, Teq = 278.5 * Math.pow(s.L, 0.25) / Math.sqrt(this.aAU) * Math.pow(1 - 0.3, 0.25);
    const P = TAU * Math.sqrt(aM ** 3 / (GRAV * s.M * MSUN)), K = Math.cbrt(2 * Math.PI * GRAV / P) * MEARTH / Math.pow(s.M * MSUN, 2 / 3);
    const depth = (REARTH / (s.R * RSUN)) ** 2, prob = s.R * RSUN / aM;
    const astro = (aM * MEARTH / (s.M * MSUN)) / (10 * PC_M) / (DEG / 3600) * 1e6;   // µas at 10 pc
    const inHZ = this.aAU >= hzIn && this.aAU <= hzOut;
    const flux = s.L / this.aAU ** 2;
    // right-hand bar chart of detectability
    const bx = this.w * 0.58, by0 = 20, bw = this.w * 0.38;
    const bars: Array<[string, number, number, string]> = [
      ['RV K (m/s)', K, 1, `${fmt(K, 2)}`], ['transit depth (ppm)', depth * 1e6, 20, `${fmt(depth * 1e6, 0)}`], ['transit prob. (%)', prob * 100, 1, `${fmt(prob * 100, 2)}`], ['astrometry (µas @10 pc)', astro, 10, `${fmt(astro, 2)}`],
    ];
    bars.forEach(([name, v, need, label], i) => { const y = by0 + i * 34; const f = Math.min(1, Math.max(0.02, 0.5 + 0.25 * Math.log10(v / need))); this.text(name, bx, y, C.dim, 8); c.fillStyle = hexA(v >= need ? C.green : C.red, 0.7); c.fillRect(bx, y + 6, bw * f, 8); this.line(bx + bw * 0.5, y + 4, bx + bw * 0.5, y + 16, C.faint, 1); this.text(label, bx + bw * f + 4, y + 10, C.text, 8); });
    this.text('bar midpoint = current detection limit', bx, by0 + 4 * 34, C.faint, 7);
    this.setReadout([
      ['Star', `${s.name}`], ['L, T', `${s.L} L☉, ${s.T} K`],
      ['Habitable zone (conservative)', `${fmt(hzIn, 3)} – ${fmt(hzOut, 3)} AU`, C.green],
      ['Earth twin at a', inHZ ? 'inside HZ' : flux > 1.1 ? 'too hot' : 'too cold', inHZ ? C.green : C.red], ['T_eq, P', `${fmt(Teq, 0)} K, ${fmtDur(P)}`],
      ['Tidally locked?', this.aAU < 0.1 * Math.sqrt(s.M) ? 'likely' : 'no'],
      ['Easiest route', s.M < 0.3 ? 'transits + RV (small star)' : s.M > 1.2 ? 'none easy (hot, few lines)' : 'long RV series / transit'],
    ]);
  }
}


/* =========================================================== chapter 8 widgets ===== */

const K_EV = 8.617333e-5;                         // Boltzmann constant in eV/K
/** Harvard class boundaries (log T anchors, O5 → M9) */
const HARVARD: Array<[string, number]> = [['O', 42000], ['B', 30000], ['A', 9900], ['F', 7200], ['G', 6000], ['K', 5200], ['M', 3800]];
const M9_T = 2400;
/** temperature for a point along the sequence: 0 = O5 … 69 = M9 (class index × 10 + subclass) */
function seqTemp(v: number): number {
  const ci = Math.min(6, Math.floor(v / 10)), sub = v - ci * 10;
  const T0 = HARVARD[ci][1], T1 = ci < 6 ? HARVARD[ci + 1][1] : M9_T;
  return 10 ** (Math.log10(T0) + (Math.log10(T1) - Math.log10(T0)) * sub / 10);
}
function spectralClass(T: number): string {
  for (let i = 0; i < HARVARD.length; i++) {
    const T0 = HARVARD[i][1], T1 = i < 6 ? HARVARD[i + 1][1] : M9_T;
    if (T <= T0 && T > T1) { const f = (Math.log10(T0) - Math.log10(T)) / (Math.log10(T0) - Math.log10(T1)); return `${HARVARD[i][0]}${Math.min(9, Math.floor(f * 10))}`; }
  }
  return T > HARVARD[0][1] ? 'O3' : T > 1300 ? 'L' : T > 500 ? 'T' : 'Y';
}
const sigm = (x: number) => 1 / (1 + Math.exp(-x));
const lgauss = (T: number, Tp: number, w: number) => Math.exp(-(((Math.log10(T) - Math.log10(Tp)) / w) ** 2));
/** Boltzmann: N₂/N₁ for hydrogen */
const boltz21 = (T: number) => 4 * Math.exp(-10.2 / (K_EV * T));
/** Saha: N_{i+1}/N_i for ionisation energy chi (eV), partition ratio 2Z₊/Z, electron pressure Pe (N/m²) */
function sahaRatio(T: number, Pe: number, chi: number, zr: number): number {
  const ne = Pe / (K_B * T);
  return (zr / ne) * Math.pow(2 * Math.PI * M_E * K_B * T / (H_PLANCK * H_PLANCK), 1.5) * Math.exp(-chi / (K_EV * T));
}
/** fraction of all hydrogen in n = 2 (Boltzmann × Saha) */
function balmerFraction(T: number, Pe: number): number { const b = boltz21(T), s = sahaRatio(T, Pe, 13.6, 1); return (b / (1 + b)) * (1 / (1 + s)); }
/** absorption features of a stellar photosphere at temperature T: [nm, depth, width nm] */
function stellarLines(T: number): Array<[number, number, number, string]> {
  const H = Math.min(1, balmerFraction(T, 20) / balmerFraction(9900, 20)) ** 0.5;
  const HeI = 0.55 * lgauss(T, 22000, 0.11), HeII = 0.5 * sigm((T - 33000) / 3500);
  const CaII = Math.min(1, lgauss(T, 5000, 0.14) * 1.1) * sigm((10500 - T) / 600);
  const met = 0.55 * sigm((6800 - T) / 600) * sigm((T - 3200) / 300), Na = 0.6 * lgauss(T, 4300, 0.16), Mg = 0.45 * lgauss(T, 5600, 0.12), CH = 0.35 * lgauss(T, 5400, 0.08);
  const TiO = 0.75 * sigm((3900 - T) / 180);
  const out: Array<[number, number, number, string]> = [];
  for (const [nm, f] of [[656.3, 1], [486.1, 0.85], [434.0, 0.7], [410.2, 0.55], [397.0, 0.45]] as Array<[number, number]>) out.push([nm, H * 0.85 * f, 1.2 + 2.5 * H, 'H']);
  for (const nm of [447.1, 471.3, 501.6, 587.6, 667.8]) out.push([nm, HeI, 0.9, 'He I']);
  for (const nm of [454.1, 468.6, 541.1]) out.push([nm, HeII, 0.9, 'He II']);
  out.push([393.4, CaII * 0.95, 1.6, 'Ca II K'], [396.8, CaII * 0.85, 1.6, 'Ca II H']);
  out.push([589.3, Na * 0.8, 0.8, 'Na D'], [518.0, Mg * 0.7, 1.2, 'Mg b'], [430.5, CH * 0.8, 1.6, 'CH G']);
  for (const nm of [438.4, 527.0, 532.8, 495.7, 404.6, 440.5, 466.8, 516.7, 558.9, 614.1, 643.0]) out.push([nm, met * 0.5, 0.5, 'Fe I']);
  out.push([422.7, met * 0.9 * sigm((5200 - T) / 400), 0.7, 'Ca I']);
  for (const [nm, w] of [[628, 10], [714, 12], [768, 10]] as Array<[number, number]>) out.push([nm + w / 2, TiO, w, 'TiO']);
  return out;
}
/** draw an absorption spectrum strip: continuum at T times the given features */
function drawSpectrumStrip(ctx: CanvasRenderingContext2D, x0: number, x1: number, y: number, h: number, T: number, lines: Array<[number, number, number, string]>, l0 = 380, l1 = 780, gain = 1) {
  const span = l1 - l0, n = Math.max(60, Math.floor(x1 - x0));
  const norm = planck(Math.max(l0, Math.min(l1, 2.9e6 / T)) * 1e-9, T);
  for (let i = 0; i < n; i++) {
    const nm = l0 + (i + 0.5) / n * span; let a = 1;
    for (const [c, d, w] of lines) { const dd = (nm - c) / Math.max(w, span / n * 0.8); if (Math.abs(dd) < 4) a *= 1 - d * Math.exp(-dd * dd * 1.2); }
    const I = Math.min(1, gain * a * planck(nm * 1e-9, T) / norm); const col = waveRGB(nm);
    ctx.fillStyle = rgba([col[0] * I, col[1] * I, col[2] * I]); ctx.fillRect(x0 + i / n * (x1 - x0), y, (x1 - x0) / n + 0.6, h);
  }
}
/** MK absolute magnitudes M_V by temperature anchor and luminosity class [Ia, Ib, II, III, IV, V] */
const MK_T = [22000, 9700, 6500, 5800, 5200, 3600];
const MK_MV: number[][] = [[-6.8, -6.0, -5.0, -3.5, -3.0, -2.5], [-7.1, -5.0, -2.8, -0.1, 0.3, 0.6], [-8.2, -5.0, -2.3, 1.2, 2.3, 3.5], [-8.0, -4.6, -2.0, 0.4, 3.0, 4.8], [-7.5, -4.5, -2.2, 0.7, 3.1, 5.9], [-7.0, -4.6, -2.5, -0.6, 7.0, 9.9]];
const MK_NAMES = ['Ia', 'Ib', 'II', 'III', 'IV', 'V'];
function mkMv(T: number, cls: number): number {
  const lt = Math.log10(T); const c0 = Math.floor(cls), c1 = Math.min(5, c0 + 1), fc = cls - c0;
  const at = (i: number) => MK_MV[i][c0] * (1 - fc) + MK_MV[i][c1] * fc;
  if (lt >= Math.log10(MK_T[0])) return at(0); if (lt <= Math.log10(MK_T[5])) return at(5);
  for (let i = 0; i < 5; i++) { const a = Math.log10(MK_T[i]), b = Math.log10(MK_T[i + 1]); if (lt <= a && lt >= b) { const f = (a - lt) / (a - b); return at(i) * (1 - f) + at(i + 1) * f; } }
  return at(5);
}
const bolCorr = (T: number) => (T > 5772 ? -6 : -30) * (Math.log10(T) - 3.76) ** 2;      // crude bolometric correction
const lumFromMv = (Mv: number, T: number) => 10 ** ((4.74 - (Mv + bolCorr(T))) / 2.5);
const mvFromLum = (L: number, T: number) => 4.74 - 2.5 * Math.log10(L) - bolCorr(T);
const radiusFromLT = (L: number, T: number) => Math.sqrt(L) * (5772 / T) ** 2;
/** B−V from temperature (Ballesteros, inverted numerically) */
function bvFromT(T: number): number { let lo = -0.4, hi = 2.2; for (let k = 0; k < 40; k++) { const m = (lo + hi) / 2; const Tm = 4600 * (1 / (0.92 * m + 1.7) + 1 / (0.92 * m + 0.62)); if (Tm > T) lo = m; else hi = m; } return (lo + hi) / 2; }
/** main-sequence relations from mass (M☉) */
function mainSequence(M: number): { L: number; R: number; T: number } {
  const L = M < 0.43 ? 0.23 * M ** 2.3 : M < 2 ? M ** 4 : M < 55 ? 1.4 * M ** 3.5 : 32000 * M;
  const R = M < 1 ? M ** 0.8 : M < 2 ? M ** 0.57 : 2 ** 0.57 * (M / 2) ** 0.65;
  return { L, R, T: 5772 * Math.pow(L / (R * R), 0.25) };
}
const LSUN_W = 3.828e26;

/* ------------------------------------------------- 86. the Harvard sequence ---- */

const SEQ_EXAMPLES: Array<[string, string]> = [['O', 'ζ Puppis (O4), Mintaka (O9.5)'], ['B', 'Spica (B1), Rigel (B8)'], ['A', 'Vega (A0), Sirius (A1), Altair (A7)'], ['F', 'Canopus (F0), Procyon (F5)'], ['G', 'Sun (G2), Capella (G8)'], ['K', 'Arcturus (K1.5), Aldebaran (K5)'], ['M', 'Betelgeuse (M2), Proxima (M5.5)']];

class SpectralSeqWidget extends CanvasWidget {
  private v = 20;
  constructor() {
    super(480 / 330);
    this.slider('Spectral type', 0, 69, 1, 20, (v) => `${HARVARD[Math.min(6, Math.floor(v / 10))][0]}${v % 10}`, (v) => { this.v = v; });
  }
  protected draw() {
    const c = this.ctx; c.fillStyle = C.bg; c.fillRect(0, 0, this.w, this.h);
    const T = seqTemp(this.v), ci = Math.min(6, Math.floor(this.v / 10));
    const x0 = 34, x1 = this.w - 10;
    // reference strips
    const refs = [0, 10, 20, 30, 40, 50, 60];
    const sh = 13; let y = 10;
    refs.forEach((rv, i) => { const Tr = seqTemp(rv); drawSpectrumStrip(c, x0, x1, y, sh, Tr, stellarLines(Tr)); this.text(`${HARVARD[i][0]}0`, x0 - 6, y + sh / 2, i === ci ? C.accent : C.dim, 9, 'right', 'mono'); if (i === ci) { c.strokeStyle = C.accent; c.lineWidth = 1; c.strokeRect(x0 - 1, y - 1, x1 - x0 + 2, sh + 2); } y += sh + 3; });
    // main spectrum
    const ys = y + 10, hs = 60;
    const lines = stellarLines(T);
    drawSpectrumStrip(c, x0, x1, ys, hs, T, lines);
    const X = (nm: number) => x0 + (nm - 380) / 400 * (x1 - x0);
    let lastX = -99, row = 0;
    const labelled = new Set<string>();
    for (const [nm, d, , name] of lines.slice().sort((a, b) => a[0] - b[0])) { if (d < 0.12) continue; if (name === 'Fe I' && labelled.has('Fe I')) continue; if (name === 'TiO' && labelled.has('TiO')) continue; const x = X(nm); row = x - lastX < 22 && lastX > -99 ? (row + 1) % 2 : 0; lastX = x; this.text(name, x, ys + hs + 9 + row * 9, C.dim, 7, 'center'); this.line(x, ys + hs, x, ys + hs + 3, C.faint); labelled.add(name); }
    // intensity trace
    const yg0 = ys + hs + 30, yg1 = this.h - 22;
    c.beginPath(); for (let px = 0; px <= x1 - x0; px += 2) { const nm = 380 + px / (x1 - x0) * 400; let a = 1; for (const [cn, d, w] of lines) { const dd = (nm - cn) / Math.max(w, 1.2); if (Math.abs(dd) < 4) a *= 1 - d * Math.exp(-dd * dd * 1.2); } const I = a * planck(nm * 1e-9, T) / planck(Math.max(380, Math.min(780, 2.9e6 / T)) * 1e-9, T); const yy = yg1 - I * (yg1 - yg0); px ? c.lineTo(x0 + px, yy) : c.moveTo(x0 + px, yy); } c.strokeStyle = C.text; c.lineWidth = 1; c.stroke();
    for (const nm of [400, 500, 600, 700]) { this.line(X(nm), yg1, X(nm), yg1 + 3, C.line); this.text(`${nm}`, X(nm), yg1 + 10, C.dim, 8, 'center', 'mono'); }
    this.text('nm', x1, yg1 + 10, C.dim, 8, 'right');
    const strongest = lines.filter((l) => l[1] > 0.15).sort((a, b) => b[1] - a[1]).map((l) => l[3]).filter((v, i, arr) => arr.indexOf(v) === i).slice(0, 4).join(', ');
    const bv = bvFromT(T);
    this.setReadout([
      ['Type', spectralClass(T), C.accent], ['Temperature', `${fmt(T, 0)} K`],
      ['B − V', `${bv >= 0 ? '+' : ''}${fmt(bv, 2)}`], ['Strongest lines', strongest || '—'],
      ['Examples', SEQ_EXAMPLES[ci][1]], ['Balmer strength (A0 = 1)', fmt(Math.min(1, balmerFraction(T, 20) / balmerFraction(9900, 20)), 2), C.green],
    ]);
  }
}

/* ------------------------------------------------- 87. a planet's spectrum ---- */

type PlanetSpec = { name: string; a: number; T: number; A: (nm: number) => number; bands: Array<[number, number, number, string]>; note: string };
const PLANET_SPECTRA: PlanetSpec[] = [
  { name: 'Moon', a: 1, T: 390, A: (nm) => 0.08 + 0.06 * (nm - 400) / 600, bands: [], note: 'grey, slightly reddish regolith; no atmosphere, no bands' },
  { name: 'Venus', a: 0.723, T: 230, A: (nm) => 0.75 * sigm((nm - 380) / 40) * (nm < 500 ? 0.75 + 0.25 * (nm - 380) / 120 : 1), bands: [[870, 0.08, 6, 'CO₂'], [1050, 0.12, 8, 'CO₂'], [1200, 0.15, 10, 'CO₂']], note: 'sulphuric-acid clouds: bright, UV absorber in the blue, CO₂ bands in the near-IR' },
  { name: 'Earth', a: 1, T: 255, A: (nm) => 0.42 * (nm < 500 ? 1 : 0.65 + 0.35 * Math.exp(-(nm - 500) / 300)) * (nm > 700 ? 1.12 : 1), bands: [[760, 0.45, 2.5, 'O₂ A'], [687, 0.25, 2, 'O₂ B'], [720, 0.2, 8, 'H₂O'], [820, 0.2, 8, 'H₂O'], [940, 0.4, 12, 'H₂O'], [1130, 0.45, 15, 'H₂O'], [1400, 0.7, 25, 'H₂O']], note: 'Rayleigh-blue, O₂ A-band, water, the vegetation red edge past 700 nm' },
  { name: 'Mars', a: 1.524, T: 210, A: (nm) => 0.08 + 0.2 * sigm((nm - 560) / 50), bands: [[2000, 0.2, 30, 'CO₂']], note: 'iron oxides absorb the blue: red surface, thin CO₂ air' },
  { name: 'Jupiter', a: 5.2, T: 125, A: (nm) => 0.32 + 0.22 * sigm((nm - 480) / 50), bands: [[619, 0.3, 5, 'CH₄'], [727, 0.5, 6, 'CH₄'], [790, 0.35, 5, 'CH₄'], [890, 0.8, 9, 'CH₄'], [1000, 0.5, 10, 'CH₄'], [1150, 0.6, 15, 'CH₄'], [1350, 0.8, 25, 'CH₄+H₂O'], [1650, 0.7, 30, 'CH₄'], [2200, 0.8, 50, 'CH₄'], [645, 0.12, 5, 'NH₃']], note: 'ammonia clouds, methane bands deepening to the red and infrared; emits 1.7× what it absorbs' },
  { name: 'Saturn', a: 9.58, T: 95, A: (nm) => 0.3 + 0.2 * sigm((nm - 500) / 60), bands: [[619, 0.25, 5, 'CH₄'], [727, 0.45, 6, 'CH₄'], [790, 0.3, 5, 'CH₄'], [890, 0.7, 9, 'CH₄'], [1150, 0.5, 15, 'CH₄'], [1350, 0.75, 25, 'CH₄+H₂O'], [1650, 0.6, 30, 'CH₄'], [2200, 0.75, 50, 'CH₄']], note: 'a hazier Jupiter: the same methane bands, weaker; emits 2.3× what it absorbs' },
];

class PlanetSpectrumWidget extends CanvasWidget {
  private body = PLANET_SPECTRA[4]; private range: 'vis' | 'ir' = 'vis';
  constructor() {
    super(480 / 290);
    this.segmented(PLANET_SPECTRA.map((p) => [p.name, p.name] as [string, string]), 'Jupiter', (k) => { this.body = PLANET_SPECTRA.find((p) => p.name === k)!; });
    this.segmented<'vis' | 'ir'>([['vis', 'Visible 380–1000 nm'], ['ir', 'Infrared 0.4–50 µm']], 'vis', (r) => { this.range = r; });
  }
  /** reflected and thermal spectral radiance per unit area (W m⁻² m⁻¹ sr⁻¹) */
  private parts(nm: number): { refl: number; therm: number } {
    const b = this.body; const dil = (RSUN / (b.a * AU_M)) ** 2;
    let lines = 1; for (const f of FRAUNHOFER) { const d = (nm - f.nm) / Math.max(f.width, 0.8); if (Math.abs(d) < 4) lines *= 1 - f.depth * Math.exp(-d * d * 1.4); }
    let bands = 1; for (const [cn, dpt, w] of b.bands) { const d = (nm - cn) / w; if (Math.abs(d) < 4) bands *= 1 - dpt * Math.exp(-d * d * 1.2); }
    const A = Math.max(0.02, b.A(Math.min(nm, 1000)));
    return { refl: A * bands * lines * planck(nm * 1e-9, 5772) * dil, therm: 0.95 * planck(nm * 1e-9, b.T) };
  }
  protected draw() {
    const c = this.ctx; c.fillStyle = C.bg; c.fillRect(0, 0, this.w, this.h);
    const b = this.body, gx0 = 44, gx1 = this.w - 12;
    if (this.range === 'vis') {
      const l0 = 380, l1 = 1000, X = (nm: number) => gx0 + (nm - l0) / (l1 - l0) * (gx1 - gx0);
      const ys = 12, hs = 54, n = gx1 - gx0;
      const norm = Math.max(...Array.from({ length: 50 }, (_, i) => this.parts(l0 + i / 50 * (l1 - l0)).refl));
      for (let i = 0; i < n; i++) { const nm = l0 + (i + 0.5) / n * (l1 - l0); const I = Math.min(1, this.parts(nm).refl / norm); const col = nm <= 780 ? waveRGB(nm) : [140, 64, 50] as [number, number, number]; c.fillStyle = rgba([col[0] * I, col[1] * I, col[2] * I]); c.fillRect(gx0 + i, ys, 1.6, hs); }
      this.text('reflected sunlight', gx0 + 4, ys + hs + 9, C.dim, 8); this.text('← visible | near-infrared →', X(780), ys + hs + 9, C.faint, 7, 'center'); this.line(X(780), ys, X(780), ys + hs, hexA(C.text, 0.3), 1, [2, 3]);
      const yg0 = ys + hs + 24, yg1 = this.h - 24;
      // solar reference (dashed) and planet
      const sun = (nm: number) => planck(nm * 1e-9, 5772) / planck(500e-9, 5772) * 0.9;
      c.beginPath(); for (let i = 0; i <= n; i += 2) { const nm = l0 + i / n * (l1 - l0); const y = yg1 - sun(nm) * (yg1 - yg0); i ? c.lineTo(gx0 + i, y) : c.moveTo(gx0 + i, y); } c.strokeStyle = hexA(C.sun, 0.45); c.setLineDash([3, 3]); c.lineWidth = 1; c.stroke(); c.setLineDash([]);
      c.beginPath(); for (let i = 0; i <= n; i++) { const nm = l0 + i / n * (l1 - l0); const y = yg1 - this.parts(nm).refl / norm * 0.95 * (yg1 - yg0); i ? c.lineTo(gx0 + i, y) : c.moveTo(gx0 + i, y); } c.strokeStyle = C.text; c.lineWidth = 1.2; c.stroke();
      for (const [cn, dpt, , name] of b.bands) if (cn < l1 && dpt > 0.15) { this.text(name, X(cn), yg0 - 2, C.accent, 7, 'center'); this.line(X(cn), yg0 + 2, X(cn), yg0 + 8, hexA(C.accent, 0.6)); }
      for (const f of FRAUNHOFER) if (f.depth > 0.6 && f.nm < 700) this.text(f.letter, X(f.nm), yg1 - 6, hexA(C.sun, 0.8), 7, 'center', 'serif');
      for (const nm of [400, 500, 600, 700, 800, 900, 1000]) { this.line(X(nm), yg1, X(nm), yg1 + 3, C.line); this.text(`${nm}`, X(nm), yg1 + 10, C.dim, 8, 'center', 'mono'); }
      this.text('— planet  ‑ ‑ Sun  letters = solar lines', gx0 + 2, yg0 + 8, C.dim, 7);
    } else {
      const lm0 = Math.log10(0.4), lm1 = Math.log10(50), X = (um: number) => gx0 + (Math.log10(um) - lm0) / (lm1 - lm0) * (gx1 - gx0);
      const gy0 = 14, gy1 = this.h - 24;
      const samples: Array<[number, number, number]> = []; let top = -Infinity;
      for (let i = 0; i <= 300; i++) { const um = 10 ** (lm0 + i / 300 * (lm1 - lm0)); const p = this.parts(um * 1000); const r = Math.log10(p.refl * um * 1e-6 + 1e-30), t = Math.log10(p.therm * um * 1e-6 + 1e-30); samples.push([um, r, t]); top = Math.max(top, r, t); }
      const bot = top - 6, Y = (v: number) => gy1 - Math.max(0, Math.min(1, (v - bot) / (top - bot))) * (gy1 - gy0);
      for (let k = 0; k <= 6; k++) { const y = Y(top - k); this.line(gx0, y, gx1, y, C.grid); this.text(k ? `10${sup(-k)}` : '1', gx0 - 4, y, C.faint, 8, 'right'); }
      c.beginPath(); samples.forEach(([um, r], i) => (i ? c.lineTo(X(um), Y(r)) : c.moveTo(X(um), Y(r)))); c.strokeStyle = C.sun; c.lineWidth = 1.4; c.stroke();
      c.beginPath(); samples.forEach(([um, , t], i) => (i ? c.lineTo(X(um), Y(t)) : c.moveTo(X(um), Y(t)))); c.strokeStyle = C.red; c.lineWidth = 1.4; c.stroke();
      for (const um of [0.5, 1, 2, 5, 10, 20, 50]) { this.line(X(um), gy1, X(um), gy1 + 3, C.line); this.text(`${um}`, X(um), gy1 + 10, C.dim, 8, 'center', 'mono'); }
      this.text('µm', gx1, gy1 + 10, C.dim, 8, 'right'); this.text('λF_λ (relative, log)', gx0 + 4, gy0 + 2, C.dim, 8);
      this.text('reflected sunlight', X(0.6), Y(samples[40][1]) - 10, C.sun, 8); this.text(`thermal emission, ${b.T} K`, X(12), Y(samples.find((s) => s[0] > 12)![2]) - 10, C.red, 8, 'center');
      for (const [cn, dpt, , name] of b.bands) if (cn >= 1000 && dpt > 0.4) this.text(name, X(cn / 1000), Y(samples.find((s) => s[0] * 1000 > cn)![1]) + 10, C.accent, 7, 'center');
    }
    // crossover
    let cross = NaN; for (let um = 0.5; um < 60; um *= 1.02) { const p = this.parts(um * 1000); if (p.therm > p.refl) { cross = um; break; } }
    const peak = 2898 / b.T;
    const Fsun = 1361 / b.a ** 2, Aeff = 0.3, Teq = Math.pow(Fsun * (1 - Aeff) / (4 * SIGMA_SB), 0.25);
    this.setReadout([
      ['Body', b.name, C.accent], ['Visible albedo, T_emit', `≈ ${fmt(b.A(550), 2)}, ${b.T} K`],
      ['Its own glow peaks at', `${fmt(peak, 1)} µm`, C.red], ['Thermal beats reflected beyond', isNaN(cross) ? '> 50 µm' : `${fmt(cross, 1)} µm`],
      ['Equilibrium T for albedo 0.3', `${fmt(Teq, 0)} K`], ['Signature', b.note],
    ]);
  }
}

/* ------------------------------------------------- 88. Boltzmann ---- */

class BoltzmannWidget extends CanvasWidget {
  private T = 5800;
  constructor() { super(480 / 260); this.slider('Temperature', Math.log10(3000), Math.log10(40000), 0.005, Math.log10(5800), (v) => `${fmt(10 ** v, 0)} K`, (v) => { this.T = 10 ** v; }); }
  protected draw() {
    const c = this.ctx; c.fillStyle = C.bg; c.fillRect(0, 0, this.w, this.h);
    const T = this.T, kT = K_EV * T;
    // left: level ladder with populations (log bars)
    const lx0 = 40, lx1 = this.w * 0.42, ly0 = 14, ly1 = this.h - 26;
    const E = (n: number) => -13.6 / (n * n), Ey = (e: number) => ly1 - (e + 13.6) / 13.6 * (ly1 - ly0) * 0.92;
    const pop = (n: number) => (n * n) * Math.exp(-(E(n) - E(1)) / kT);
    for (let n = 1; n <= 6; n++) { const y = Ey(E(n)); this.line(lx0, y, lx1, y, hexA(C.text, 0.5)); const lp = Math.log10(pop(n)); const f = Math.max(0, (lp + 12) / 12); c.fillStyle = hexA(n === 2 ? C.accent : C.blue, 0.6); c.fillRect(lx0, y - 5, (lx1 - lx0) * f, 4); this.text(`n=${n}`, lx0 - 4, y, C.dim, 8, 'right', 'mono'); if (n <= 3) this.text(`${sci(pop(n), 1)}`, lx0 + (lx1 - lx0) * f + 4, y - 3, n === 2 ? C.accent : C.dim, 7, 'left', 'mono'); }
    this.line(lx0, Ey(0), lx1, Ey(0), C.faint, 1, [3, 3]); this.text('ionised', lx1, Ey(0) - 6, C.faint, 7, 'right');
    this.text('N_n / N₁ (log bars, 10⁻¹² … 1)', lx0, ly1 + 10, C.dim, 7);
    // right: N2/N1 against T
    const gx0 = this.w * 0.52, gx1 = this.w - 12, gy0 = 14, gy1 = this.h - 26;
    const lT0 = Math.log10(3000), lT1 = Math.log10(40000);
    const X = (TT: number) => gx0 + (Math.log10(TT) - lT0) / (lT1 - lT0) * (gx1 - gx0), Y = (r: number) => gy1 - (Math.log10(r) + 12) / 12 * (gy1 - gy0);
    for (let k = -12; k <= 0; k += 2) { this.line(gx0, Y(10 ** k), gx1, Y(10 ** k), C.grid); this.text(k ? `10${sup(k)}` : '1', gx0 - 3, Y(10 ** k), C.faint, 7, 'right'); }
    for (const TT of [3000, 5000, 10000, 20000, 40000]) { this.line(X(TT), gy1, X(TT), gy1 + 3, C.line); this.text(`${TT / 1000}k`, X(TT), gy1 + 10, C.dim, 7, 'center', 'mono'); }
    c.beginPath(); for (let i = 0; i <= 120; i++) { const TT = 10 ** (lT0 + i / 120 * (lT1 - lT0)); const y = Y(Math.max(1e-12, boltz21(TT))); i ? c.lineTo(X(TT), y) : c.moveTo(X(TT), y); } c.strokeStyle = C.accent; c.lineWidth = 1.6; c.stroke();
    this.circle(X(T), Y(Math.max(1e-12, boltz21(T))), 3.5, undefined, C.accent); this.text('N₂ / N₁', gx0 + 4, gy0 + 2, C.accent, 8);
    for (const [TT, name] of [[5772, 'Sun'], [9700, 'Vega'], [22000, 'B2']] as Array<[number, string]>) { this.line(X(TT), gy0, X(TT), gy1, hexA(C.faint, 0.5), 1, [2, 4]); this.text(name, X(TT), gy1 - 4, C.faint, 7, 'center'); }
    const r21 = boltz21(T);
    this.setReadout([
      ['kT', `${fmt(kT, 2)} eV  (E₂ − E₁ = 10.2 eV)`], ['N₂ / N₁', sci(r21, 2), C.accent],
      ['Atoms in n = 2', r21 > 0.01 ? `1 in ${fmt(1 / r21, 0)}` : `1 in ${sci(1 / r21, 1)}`], ['N₃ / N₁', sci(9 * Math.exp(-12.09 / kT), 2)],
      ['Trend', 'rises steeply with T — but see Saha', C.dim],
    ]);
  }
}

/* ------------------------------------------------- 89. Saha ---- */

const SAHA_EL: Array<{ key: string; name: string; chi: number; zr: number; note: string }> = [
  { key: 'H', name: 'H I → H II', chi: 13.6, zr: 1, note: 'half ionised near 9 600 K at P_e = 20 N/m²' },
  { key: 'He', name: 'He I → He II', chi: 24.6, zr: 4, note: 'neutral through the B stars; He II lines define class O' },
  { key: 'Ca', name: 'Ca I → Ca II', chi: 6.11, zr: 2 * 2.30 / 1.32, note: 'already ionised in the Sun — hence the strength of H and K' },
  { key: 'Na', name: 'Na I → Na II', chi: 5.14, zr: 1, note: 'the D lines fade above the G stars as sodium ionises' },
  { key: 'Fe', name: 'Fe I → Fe II', chi: 7.90, zr: 2 * 40 / 25, note: 'neutral-iron lines strong in K stars, Fe II in A and F' },
];

class SahaWidget extends CanvasWidget {
  private elem = SAHA_EL[0]; private Pe = 20; private T = 5800;
  constructor() {
    super(480 / 260);
    this.segmented(SAHA_EL.map((e) => [e.key, e.name] as [string, string]), 'H', (k) => { this.elem = SAHA_EL.find((e) => e.key === k)!; });
    this.slider('Electron pressure P_e', -1, 3, 0.05, Math.log10(20), (v) => `${fmt(10 ** v, 10 ** v < 10 ? 1 : 0)} N/m²`, (v) => { this.Pe = 10 ** v; });
    this.slider('Temperature', Math.log10(2500), Math.log10(60000), 0.005, Math.log10(5800), (v) => `${fmt(10 ** v, 0)} K`, (v) => { this.T = 10 ** v; });
  }
  private frac(T: number) { const r = sahaRatio(T, this.Pe, this.elem.chi, this.elem.zr); return r / (1 + r); }
  protected draw() {
    const c = this.ctx; c.fillStyle = C.bg; c.fillRect(0, 0, this.w, this.h);
    const gx0 = 44, gx1 = this.w - 12, gy0 = 24, gy1 = this.h - 26;
    const lT0 = Math.log10(2500), lT1 = Math.log10(60000);
    const X = (T: number) => gx0 + (Math.log10(T) - lT0) / (lT1 - lT0) * (gx1 - gx0), Y = (f: number) => gy1 - f * (gy1 - gy0);
    for (const f of [0, 0.25, 0.5, 0.75, 1]) { this.line(gx0, Y(f), gx1, Y(f), C.grid); this.text(`${f * 100}%`, gx0 - 4, Y(f), C.faint, 8, 'right'); }
    for (const T of [3000, 5000, 10000, 20000, 40000]) { this.line(X(T), gy1, X(T), gy1 + 3, C.line); this.text(`${T / 1000}k`, X(T), gy1 + 10, C.dim, 8, 'center', 'mono'); }
    // Harvard classes along the top
    for (let i = 0; i < HARVARD.length; i++) { const T0 = HARVARD[i][1], T1 = i < 6 ? HARVARD[i + 1][1] : M9_T; const xa = Math.max(gx0, X(Math.min(T0, 60000))), xb = Math.max(gx0, X(T1)); c.fillStyle = rgba(tempRGB(Math.sqrt(T0 * T1)), 0.18); c.fillRect(xb, 6, xa - xb, 10); this.text(HARVARD[i][0], (xa + xb) / 2, 11, C.dim, 8, 'center'); }
    // other pressures faint
    for (const p of [0.2, 2000]) { const keep = this.Pe; this.Pe = p; c.beginPath(); for (let i = 0; i <= 160; i++) { const T = 10 ** (lT0 + i / 160 * (lT1 - lT0)); const y = Y(this.frac(T)); i ? c.lineTo(X(T), y) : c.moveTo(X(T), y); } c.strokeStyle = hexA(C.accent, 0.2); c.lineWidth = 1; c.stroke(); this.Pe = keep; }
    c.beginPath(); for (let i = 0; i <= 200; i++) { const T = 10 ** (lT0 + i / 200 * (lT1 - lT0)); const y = Y(this.frac(T)); i ? c.lineTo(X(T), y) : c.moveTo(X(T), y); } c.strokeStyle = C.accent; c.lineWidth = 1.8; c.stroke();
    this.circle(X(this.T), Y(this.frac(this.T)), 4, undefined, C.accent);
    this.text('ionised fraction', gx0 + 4, gy0 + 2, C.dim, 8); this.text('faint curves: P_e = 0.2 and 2000 N/m²', gx1 - 2, gy1 - 6, C.faint, 7, 'right');
    let lo = 2500, hi = 60000; for (let k = 0; k < 50; k++) { const m = Math.sqrt(lo * hi); if (this.frac(m) < 0.5) lo = m; else hi = m; }
    const T50 = Math.sqrt(lo * hi); const f = this.frac(this.T);
    this.setReadout([
      ['χ, 2Z₊/Z', `${fmt(this.elem.chi, 2)} eV, ${fmt(this.elem.zr, 2)}`], ['Half ionised at', `${fmt(T50, 0)} K  (${spectralClass(T50)})`, C.accent],
      ['At T', `${fmt(f * 100, f > 0.99 || f < 0.01 ? 3 : 1)} % ionised`], ['n_e at T', `${sci(this.Pe / (K_B * this.T), 1)} m⁻³`],
      ['Lower P_e →', 'ionises at lower T (giants)', C.dim], ['Note', this.elem.note],
    ]);
  }
}

/* ------------------------------------------------- 90. the Balmer peak ---- */

class BalmerPeakWidget extends CanvasWidget {
  private Pe = 20;
  constructor() { super(480 / 250); this.slider('Electron pressure P_e', -1, 3, 0.05, Math.log10(20), (v) => `${fmt(10 ** v, 10 ** v < 10 ? 1 : 0)} N/m²`, (v) => { this.Pe = 10 ** v; }); }
  protected draw() {
    const c = this.ctx; c.fillStyle = C.bg; c.fillRect(0, 0, this.w, this.h);
    const gx0 = 44, gx1 = this.w - 12, gy0 = 26, gy1 = this.h - 26, T0 = 4000, T1 = 25000;
    const X = (T: number) => gx0 + (T - T0) / (T1 - T0) * (gx1 - gx0), Y = (f: number) => gy1 - f * (gy1 - gy0);
    for (const f of [0, 0.5, 1]) this.line(gx0, Y(f), gx1, Y(f), C.grid);
    for (const T of [5000, 10000, 15000, 20000, 25000]) { this.line(X(T), gy1, X(T), gy1 + 3, C.line); this.text(`${T / 1000}k`, X(T), gy1 + 10, C.dim, 8, 'center', 'mono'); }
    for (let i = 1; i < HARVARD.length; i++) { const Ta = Math.min(T1, HARVARD[i][1]), Tb = i < 6 ? HARVARD[i + 1][1] : M9_T; if (Ta < T0) continue; const xa = X(Ta), xb = X(Math.max(T0, Tb)); c.fillStyle = rgba(tempRGB(Math.sqrt(Ta * Math.max(T0, Tb))), 0.18); c.fillRect(xb, 6, xa - xb, 10); this.text(HARVARD[i][0], (xa + xb) / 2, 11, C.dim, 8, 'center'); }
    let peakT = T0, peakF = 0; const prod: number[] = [];
    for (let i = 0; i <= 210; i++) { const T = T0 + i / 210 * (T1 - T0); const f = balmerFraction(T, this.Pe); prod.push(f); if (f > peakF) { peakF = f; peakT = T; } }
    const plot = (fn: (T: number) => number, col: string, dash?: number[]) => { c.beginPath(); for (let i = 0; i <= 210; i++) { const T = T0 + i / 210 * (T1 - T0); const y = Y(fn(T)); i ? c.lineTo(X(T), y) : c.moveTo(X(T), y); } c.strokeStyle = col; c.lineWidth = dash ? 1 : 1.8; if (dash) c.setLineDash(dash); c.stroke(); c.setLineDash([]); };
    plot((T) => { const b = boltz21(T); return b / (1 + b) / 0.03; }, C.blue, [4, 3]);
    plot((T) => 1 / (1 + sahaRatio(T, this.Pe, 13.6, 1)), C.red, [4, 3]);
    plot((T) => balmerFraction(T, this.Pe) / peakF, C.green);
    this.line(X(peakT), gy0, X(peakT), gy1, hexA(C.green, 0.5), 1, [2, 3]); this.text(`peak ${fmt(peakT, 0)} K`, X(peakT) + 4, gy0 + 10, C.green, 8);
    this.text('Boltzmann N₂/(N₁+N₂) ×33', X(17000), Y(0.62), C.blue, 8); this.text('Saha N_I/N_total', X(5200), Y(0.93), C.red, 8); this.text('product (scaled)', X(peakT) + 4, Y(0.75), C.green, 8);
    const fSun = balmerFraction(5772, this.Pe);
    this.setReadout([
      ['Peak of N₂/N_total', `${fmt(peakT, 0)} K (${spectralClass(peakT)})`, C.green], ['Peak fraction', `${sci(peakF, 2)}`],
      ['At the Sun', `${sci(fSun, 2)} (${fmt(fSun / peakF * 100, 1)} % of peak)`], ['At 20 000 K', `${sci(balmerFraction(20000, this.Pe), 2)}`],
      ['Lower P_e', 'shifts the peak cooler', C.dim],
    ]);
  }
}

/* ------------------------------------------------- 91. the cool end ---- */

type CoolObj = { key: string; name: string; T: number; ex: string; mass: string; feats: Array<[number, number, number, string]>; refl?: boolean };
const COOL_OBJS: CoolObj[] = [
  { key: 'M', name: 'M5 V', T: 3000, ex: 'Proxima Centauri', mass: '0.12 M☉', feats: [[0.62, 0.5, 0.012, 'TiO'], [0.66, 0.45, 0.012, 'TiO'], [0.71, 0.6, 0.015, 'TiO'], [0.77, 0.55, 0.015, 'TiO'], [0.82, 0.4, 0.015, 'TiO'], [0.74, 0.3, 0.008, 'VO'], [1.4, 0.25, 0.05, 'H₂O'], [1.9, 0.3, 0.06, 'H₂O'], [2.3, 0.2, 0.03, 'CO'], [0.589, 0.4, 0.004, 'Na']] },
  { key: 'L', name: 'L5', T: 1700, ex: '2MASS 1507−16', mass: '~0.06 M☉', feats: [[0.77, 0.7, 0.03, 'K I'], [0.59, 0.5, 0.02, 'Na I'], [0.87, 0.4, 0.015, 'FeH'], [0.99, 0.45, 0.015, 'FeH'], [0.86, 0.3, 0.01, 'CrH'], [1.4, 0.55, 0.06, 'H₂O'], [1.9, 0.6, 0.07, 'H₂O'], [2.3, 0.3, 0.04, 'CO'], [1.15, 0.2, 0.03, 'H₂O']] },
  { key: 'T', name: 'T5', T: 1100, ex: 'Gliese 229 B', mass: '~0.04 M☉', feats: [[0.77, 0.8, 0.05, 'K I'], [1.15, 0.6, 0.04, 'CH₄'], [1.35, 0.85, 0.06, 'H₂O+CH₄'], [1.65, 0.75, 0.05, 'CH₄'], [1.9, 0.8, 0.07, 'H₂O'], [2.2, 0.8, 0.08, 'CH₄'], [1.0, 0.3, 0.02, 'FeH'], [2.35, 0.4, 0.04, 'CH₄']] },
  { key: 'Y', name: 'Y1', T: 400, ex: 'WISE 0855−0714 (250 K)', mass: '~0.005–0.01 M☉', feats: [[1.15, 0.7, 0.04, 'CH₄'], [1.35, 0.9, 0.07, 'H₂O+CH₄'], [1.5, 0.5, 0.03, 'NH₃'], [1.65, 0.85, 0.05, 'CH₄'], [1.9, 0.9, 0.08, 'H₂O'], [2.2, 0.9, 0.09, 'CH₄'], [1.03, 0.4, 0.02, 'NH₃']] },
  { key: 'J', name: 'Jupiter', T: 125, ex: 'reflected sunlight + 5 µm glow', mass: '0.001 M☉', refl: true, feats: [[0.619, 0.3, 0.006, 'CH₄'], [0.727, 0.5, 0.007, 'CH₄'], [0.79, 0.35, 0.006, 'CH₄'], [0.89, 0.8, 0.01, 'CH₄'], [1.0, 0.5, 0.012, 'CH₄'], [1.15, 0.6, 0.02, 'CH₄'], [1.35, 0.85, 0.03, 'CH₄+H₂O'], [1.65, 0.7, 0.04, 'CH₄'], [2.2, 0.85, 0.06, 'CH₄'], [0.645, 0.12, 0.006, 'NH₃']] },
];

class CoolSpectraWidget extends CanvasWidget {
  private sel = 'M';
  constructor() { super(480 / 320); this.segmented(COOL_OBJS.map((o) => [o.key, o.name] as [string, string]), 'M', (k) => { this.sel = k; }); }
  protected draw() {
    const c = this.ctx; c.fillStyle = C.bg; c.fillRect(0, 0, this.w, this.h);
    const gx0 = 52, gx1 = this.w - 10, l0 = 0.5, l1 = 2.5, X = (um: number) => gx0 + (um - l0) / (l1 - l0) * (gx1 - gx0);
    const rowH = (this.h - 50) / COOL_OBJS.length;
    COOL_OBJS.forEach((o, i) => {
      const y0 = 8 + i * rowH, y1 = y0 + rowH - 8, on = o.key === this.sel;
      const flux = (um: number) => { let a = 1; for (const [cn, d, w] of o.feats) { const dd = (um - cn) / w; if (Math.abs(dd) < 4) a *= 1 - d * Math.exp(-dd * dd * 1.2); } const cont = Math.pow(o.refl ? planck(um * 1e-6, 5772) * um ** 2 : planck(um * 1e-6, o.T) * um ** 2, 0.25); return a * cont; };
      let top = 0; for (let k = 0; k <= 100; k++) top = Math.max(top, flux(l0 + k / 100 * (l1 - l0)));
      c.beginPath(); for (let px = 0; px <= gx1 - gx0; px++) { const um = l0 + px / (gx1 - gx0) * (l1 - l0); const y = y1 - flux(um) / top * (y1 - y0) * 0.9; px ? c.lineTo(gx0 + px, y) : c.moveTo(gx0 + px, y); } c.strokeStyle = on ? C.accent : hexA(C.text, 0.45); c.lineWidth = on ? 1.6 : 1; c.stroke();
      this.text(o.name, gx0 - 6, (y0 + y1) / 2 - 5, on ? C.accent : C.dim, 9, 'right'); this.text(`${o.T} K`, gx0 - 6, (y0 + y1) / 2 + 6, C.faint, 7, 'right', 'mono');
      if (on) { const done = new Set<string>(); for (const [cn, d, , name] of o.feats) if (d > 0.3 && !done.has(name)) { done.add(name); this.text(name, X(cn), y0 + 2, C.accent, 7, 'center'); } }
    });
    const yax = this.h - 22;
    for (const um of [0.5, 1, 1.5, 2, 2.5]) { this.line(X(um), yax, X(um), yax + 3, C.line); this.text(`${um}`, X(um), yax + 10, C.dim, 8, 'center', 'mono'); }
    this.text('µm', gx1, yax + 10, C.dim, 8, 'right'); this.line(X(0.78), 8, X(0.78), yax, hexA(C.text, 0.15), 1, [2, 4]); this.text('visible | infrared', X(0.78), yax - 2, C.faint, 7, 'center');
    const o = COOL_OBJS.find((q) => q.key === this.sel)!;
    const absorbers = [...new Set(o.feats.filter((f) => f[1] > 0.3).map((f) => f[3]))].join(', ');
    this.setReadout([
      ['Object', `${o.name} — ${o.ex}`, C.accent], ['Temperature, mass', `${o.T} K, ${o.mass}`],
      ['Dominant absorbers', absorbers], ['Light source', o.refl ? 'reflected sunlight (own glow only in mid-IR)' : 'its own photosphere'],
      ['Status', o.key === 'M' ? 'star: hydrogen fusion' : o.key === 'J' ? 'planet: never fused' : 'brown dwarf: cooling since birth'],
    ]);
  }
}

/* ------------------------------------------------- 92. building the H–R diagram ---- */

type HRStar = { name?: string; T: number; L: number; kind: 'ms' | 'g' | 'sg' | 'wd' };
const HR_NAMED: HRStar[] = [
  { name: 'Sun', T: 5772, L: 1, kind: 'ms' }, { name: 'Sirius A', T: 9940, L: 25, kind: 'ms' }, { name: 'Vega', T: 9600, L: 40, kind: 'ms' }, { name: 'Spica', T: 25300, L: 20500, kind: 'ms' }, { name: 'Proxima', T: 3040, L: 0.0017, kind: 'ms' }, { name: 'Barnard', T: 3130, L: 0.0035, kind: 'ms' }, { name: 'Altair', T: 7550, L: 10.6, kind: 'ms' }, { name: 'Procyon', T: 6530, L: 6.9, kind: 'ms' }, { name: 'α Cen B', T: 5260, L: 0.5, kind: 'ms' }, { name: '61 Cyg A', T: 4530, L: 0.15, kind: 'ms' }, { name: 'Regulus', T: 12460, L: 290, kind: 'ms' }, { name: 'Achernar', T: 15000, L: 3150, kind: 'ms' }, { name: 'ζ Pup', T: 40000, L: 800000, kind: 'ms' },
  { name: 'Arcturus', T: 4290, L: 170, kind: 'g' }, { name: 'Aldebaran', T: 3900, L: 440, kind: 'g' }, { name: 'Capella', T: 4970, L: 79, kind: 'g' }, { name: 'Pollux', T: 4670, L: 33, kind: 'g' }, { name: 'Gacrux', T: 3630, L: 820, kind: 'g' },
  { name: 'Betelgeuse', T: 3600, L: 120000, kind: 'sg' }, { name: 'Antares', T: 3660, L: 75000, kind: 'sg' }, { name: 'Rigel', T: 12100, L: 120000, kind: 'sg' }, { name: 'Deneb', T: 8500, L: 196000, kind: 'sg' }, { name: 'Canopus', T: 7400, L: 10700, kind: 'sg' }, { name: 'Polaris', T: 6015, L: 1260, kind: 'sg' },
  { name: 'Sirius B', T: 25200, L: 0.026, kind: 'wd' }, { name: 'Procyon B', T: 7740, L: 0.00049, kind: 'wd' }, { name: '40 Eri B', T: 16500, L: 0.013, kind: 'wd' }, { name: 'Van Maanen 2', T: 6220, L: 0.00017, kind: 'wd' },
];
function hrField(): HRStar[] {
  const rnd = mulberry(8); const out: HRStar[] = [];
  for (let i = 0; i < 320; i++) { const lm = -1.1 + Math.pow(rnd(), 0.55) * 2.6; const M = 10 ** lm; const ms = mainSequence(M); out.push({ T: ms.T * 10 ** (gaussRand(rnd) * 0.02), L: ms.L * 10 ** (gaussRand(rnd) * 0.12), kind: 'ms' }); }
  for (let i = 0; i < 45; i++) out.push({ T: 3700 + rnd() * 1500, L: 10 ** (1.3 + rnd() * 1.6), kind: 'g' });
  for (let i = 0; i < 10; i++) out.push({ T: 10 ** (3.55 + rnd() * 0.75), L: 10 ** (4 + rnd() * 1.6), kind: 'sg' });
  for (let i = 0; i < 28; i++) { const T = 10 ** (3.75 + rnd() * 0.75); out.push({ T, L: (0.012 ** 2) * (T / 5772) ** 4 * 10 ** (gaussRand(rnd) * 0.2), kind: 'wd' }); }
  return out;
}
const KIND_COL: Record<HRStar['kind'], string> = { ms: '#ffffff', g: '#f0a36a', sg: '#ff7b7b', wd: '#8fb7ff' };

class HrBuildWidget extends CanvasWidget {
  private field = hrField(); private shown = 0; private xa: 'type' | 'bv' | 'T' = 'type'; private ya: 'Mv' | 'L' = 'Mv';
  constructor() {
    super(480 / 360);
    this.playButton(); this.playing = true;
    this.segmented<'type' | 'bv' | 'T'>([['type', 'x: spectral class'], ['bv', 'x: B−V'], ['T', 'x: temperature']], 'type', (v) => { this.xa = v; });
    this.segmented<'Mv' | 'L'>([['Mv', 'y: M_V'], ['L', 'y: L/L☉']], 'Mv', (v) => { this.ya = v; });
    const b = $('button', 'lw-btn', 'Restart'); b.addEventListener('click', () => { this.shown = 0; this.playing = true; }); this.controls.appendChild(b);
  }
  protected draw(dt: number) {
    const total = HR_NAMED.length + this.field.length;
    if (this.playing) this.shown = Math.min(total, this.shown + dt * 60);
    const c = this.ctx; c.fillStyle = C.bg; c.fillRect(0, 0, this.w, this.h);
    const gx0 = 46, gx1 = this.w - 14, gy0 = 18, gy1 = this.h - 30;
    const lT0 = Math.log10(45000), lT1 = Math.log10(2600);
    const xOf = (T: number) => { if (this.xa === 'bv') { const bv = bvFromT(T); return gx0 + (bv + 0.4) / 2.4 * (gx1 - gx0); } return gx0 + (lT0 - Math.log10(T)) / (lT0 - lT1) * (gx1 - gx0); };
    const yOf = (L: number, T: number) => { if (this.ya === 'L') return gy1 - (Math.log10(L) + 5) / 11.5 * (gy1 - gy0); const Mv = mvFromLum(L, T); return gy0 + (Mv + 11) / 28 * (gy1 - gy0); };
    // axes
    if (this.ya === 'L') for (let k = -4; k <= 6; k += 2) { const y = yOf(10 ** k, 5772); this.line(gx0, y, gx1, y, C.grid); this.text(k ? `10${sup(k)}` : '1', gx0 - 4, y, C.faint, 8, 'right'); }
    else for (let m = -10; m <= 15; m += 5) { const y = gy0 + (m + 11) / 28 * (gy1 - gy0); this.line(gx0, y, gx1, y, C.grid); this.text(`${m > 0 ? '+' : ''}${m}`, gx0 - 4, y, C.faint, 8, 'right'); }
    if (this.xa === 'type') for (let i = 0; i < HARVARD.length; i++) { const T0 = Math.min(45000, HARVARD[i][1]), T1 = i < 6 ? HARVARD[i + 1][1] : 2600; const xa = xOf(T0), xb = xOf(T1); c.fillStyle = rgba(tempRGB(Math.sqrt(T0 * T1)), 0.12); c.fillRect(xa, gy0, xb - xa, gy1 - gy0); this.text(HARVARD[i][0], (xa + xb) / 2, gy1 + 10, C.dim, 9, 'center'); }
    else if (this.xa === 'bv') for (const bv of [-0.4, 0, 0.4, 0.8, 1.2, 1.6, 2.0]) { const x = gx0 + (bv + 0.4) / 2.4 * (gx1 - gx0); this.line(x, gy1, x, gy1 + 3, C.line); this.text(`${bv >= 0 ? '+' : ''}${fmt(bv, 1)}`, x, gy1 + 10, C.dim, 8, 'center', 'mono'); }
    else for (const T of [40000, 20000, 10000, 5000, 3000]) { const x = xOf(T); this.line(x, gy1, x, gy1 + 3, C.line); this.text(`${T / 1000}k`, x, gy1 + 10, C.dim, 8, 'center', 'mono'); }
    this.text(this.ya === 'L' ? 'L / L☉' : 'M_V', gx0 + 4, gy0 + 2, C.dim, 8); this.text(this.xa === 'type' ? 'spectral class →' : this.xa === 'bv' ? 'B − V →' : '← temperature', gx1, gy1 + 20, C.dim, 8, 'right');
    // stars: field first, then named on top
    const n = Math.floor(this.shown); const counts = { ms: 0, g: 0, sg: 0, wd: 0 };
    const all = [...this.field, ...HR_NAMED];
    for (let i = 0; i < n; i++) { const s = all[i]; counts[s.kind]++; const x = xOf(s.T), y = yOf(s.L, s.T); if (x < gx0 || x > gx1 || y < gy0 || y > gy1) continue; c.fillStyle = hexA(KIND_COL[s.kind], s.name ? 1 : 0.55); c.beginPath(); c.arc(x, y, s.name ? 2.8 : 1.8, 0, TAU); c.fill(); if (s.name) this.text(s.name, x + 4, y - 4, hexA(KIND_COL[s.kind], 0.9), 7); }
    if (n >= total) { this.text('main sequence', xOf(7000), yOf(7, 7000) - 14, C.text, 9, 'center'); this.text('giants', xOf(4200), yOf(200, 4200) - 12, KIND_COL.g, 9, 'center'); this.text('supergiants', xOf(8000), yOf(80000, 8000) - 12, KIND_COL.sg, 9, 'center'); this.text('white dwarfs', xOf(14000), yOf(0.004, 14000) + 14, KIND_COL.wd, 9, 'center'); }
    const tot = Math.max(1, n);
    this.setReadout([
      ['Stars plotted', `${n} / ${total}`], ['Main sequence', `${fmt(counts.ms / tot * 100, 0)} %`, KIND_COL.ms],
      ['Giants / supergiants', `${fmt(counts.g / tot * 100, 0)} % / ${fmt(counts.sg / tot * 100, 0)} %`, KIND_COL.g], ['White dwarfs', `${fmt(counts.wd / tot * 100, 0)} %`, KIND_COL.wd],
      ['Axes', 'same shape whatever the clothes', C.dim],
    ]);
  }
}

/* ------------------------------------------------- 93. the main sequence as a mass sequence ---- */

class HrMassWidget extends CanvasWidget {
  private M = 1;
  constructor() { super(480 / 300); this.slider('Mass', -1.1, 2, 0.01, 0, (v) => `${fmt(10 ** v, 10 ** v < 1 ? 2 : 1)} M☉`, (v) => { this.M = 10 ** v; }); }
  protected draw() {
    const c = this.ctx; c.fillStyle = C.bg; c.fillRect(0, 0, this.w, this.h);
    const gx0 = 44, gx1 = this.w * 0.6, gy0 = 14, gy1 = this.h - 28;
    const lT0 = Math.log10(60000), lT1 = Math.log10(2500), lL0 = -4, lL1 = 6.5;
    const X = (T: number) => gx0 + (lT0 - Math.log10(T)) / (lT0 - lT1) * (gx1 - gx0), Y = (L: number) => gy1 - (Math.log10(L) - lL0) / (lL1 - lL0) * (gy1 - gy0);
    for (let k = -4; k <= 6; k += 2) { this.line(gx0, Y(10 ** k), gx1, Y(10 ** k), C.grid); this.text(k ? `10${sup(k)}` : '1', gx0 - 4, Y(10 ** k), C.faint, 8, 'right'); }
    for (const T of [40000, 20000, 10000, 5000, 3000]) { this.line(X(T), gy1, X(T), gy1 + 3, C.line); this.text(`${T / 1000}k`, X(T), gy1 + 10, C.dim, 8, 'center', 'mono'); }
    this.text('L / L☉', gx0 + 4, gy0 + 2, C.dim, 8); this.text('← T', gx1, gy1 + 20, C.dim, 8, 'right');
    c.beginPath(); for (let i = 0; i <= 100; i++) { const M = 10 ** (-1.1 + i / 100 * 3.1); const ms = mainSequence(M); i ? c.lineTo(X(ms.T), Y(ms.L)) : c.moveTo(X(ms.T), Y(ms.L)); } c.strokeStyle = hexA(C.text, 0.5); c.lineWidth = 1.5; c.stroke();
    for (const M of [0.1, 0.3, 1, 3, 10, 30, 100]) { const ms = mainSequence(M); this.circle(X(ms.T), Y(ms.L), 2, undefined, C.faint); this.text(`${M}`, X(ms.T) + 5, Y(ms.L) + 4, C.faint, 7, 'left', 'mono'); }
    const ms = mainSequence(this.M), col = tempRGB(ms.T);
    this.glow(X(ms.T), Y(ms.L), 10, rgba(col, 0.8)); this.circle(X(ms.T), Y(ms.L), 4, '#ffffff', rgba(col));
    // star vs Sun to scale (radius), right panel
    const px = this.w * 0.8, py = this.h * 0.45, S = Math.min(this.w * 0.17, this.h * 0.32) / Math.max(1, ms.R) * (ms.R > 1 ? 1 : 1);
    const rStar = ms.R * S, rSun = 1 * S;
    this.circle(px, py, rSun, hexA(C.sun, 0.8), undefined, 1, [3, 3]);
    this.glow(px, py, rStar * 1.4, rgba(col, 0.5)); this.circle(px, py, Math.max(1.5, rStar), undefined, rgba(col));
    this.text(ms.R > 1 ? 'dashed: the Sun' : 'dashed circle: the Sun', px, py + Math.max(rStar, rSun) + 14, C.dim, 8, 'center');
    const tau = 1e10 * this.M / ms.L, logg = 2 + Math.log10(274 * this.M / ms.R ** 2);
    this.setReadout([
      ['Mass', `${fmt(this.M, 2)} M☉`, C.accent], ['Type', `${spectralClass(ms.T)} V`],
      ['T, L', `${fmt(ms.T, 0)} K, ${sci(ms.L, 2)} L☉`], ['R, log g', `${fmt(ms.R, 2)} R☉, ${fmt(logg, 2)}`],
      ['Main-sequence lifetime', tau > 1e10 ? `${sci(tau, 1)} yr (longer than the universe)` : tau > 1e8 ? `${fmt(tau / 1e9, 1)} Gyr` : `${fmt(tau / 1e6, 0)} Myr`, tau < 1e8 ? C.red : C.green],
      ['Status', this.M < 0.08 ? 'below 0.08 M☉: a brown dwarf, no sustained fusion' : this.M > 150 ? 'above ~150 M☉: unstable to radiation pressure' : 'hydrogen-burning main-sequence star'],
    ]);
  }
}

/* ------------------------------------------------- 94. radius lines ---- */

const HR_PRESETS: Array<[string, number, number]> = [['Sun', 5772, 1], ['Sirius B', 25200, 0.026], ['Proxima', 3040, 0.0017], ['Rigel', 12100, 120000], ['Aldebaran', 3900, 440], ['Betelgeuse', 3600, 120000]];

class HrRadiusWidget extends CanvasWidget {
  private T = 5772; private L = 1; private drag = false;
  private readonly gx0 = 44; private readonly lT0 = Math.log10(60000); private readonly lT1 = Math.log10(2500); private readonly lL0 = -5; private readonly lL1 = 6.5;
  constructor() {
    super(480 / 300);
    this.segmented(HR_PRESETS.map((p) => [p[0], p[0]] as [string, string]), 'Sun', (k) => { const p = HR_PRESETS.find((q) => q[0] === k)!; this.T = p[1]; this.L = p[2]; });
    const move = (e: PointerEvent) => { const p = canvasPos(this.canvas, e, this.w, this.h); const gx1 = this.w * 0.62, gy0 = 14, gy1 = this.h - 28; const lT = this.lT0 - (p.x - this.gx0) / (gx1 - this.gx0) * (this.lT0 - this.lT1); const lL = this.lL0 + (gy1 - p.y) / (gy1 - gy0) * (this.lL1 - this.lL0); this.T = 10 ** Math.max(this.lT1, Math.min(this.lT0, lT)); this.L = 10 ** Math.max(this.lL0, Math.min(this.lL1, lL)); };
    this.canvas.addEventListener('pointerdown', (e) => { this.drag = true; move(e); });
    this.canvas.addEventListener('pointermove', (e) => { if (this.drag) move(e); });
    window.addEventListener('pointerup', () => { this.drag = false; });
    this.canvas.style.cursor = 'crosshair';
  }
  protected draw() {
    const c = this.ctx; c.fillStyle = C.bg; c.fillRect(0, 0, this.w, this.h);
    const gx0 = this.gx0, gx1 = this.w * 0.62, gy0 = 14, gy1 = this.h - 28;
    const X = (T: number) => gx0 + (this.lT0 - Math.log10(T)) / (this.lT0 - this.lT1) * (gx1 - gx0), Y = (L: number) => gy1 - (Math.log10(L) - this.lL0) / (this.lL1 - this.lL0) * (gy1 - gy0);
    for (let k = -4; k <= 6; k += 2) { this.line(gx0, Y(10 ** k), gx1, Y(10 ** k), C.grid); this.text(k ? `10${sup(k)}` : '1', gx0 - 4, Y(10 ** k), C.faint, 8, 'right'); }
    for (const T of [40000, 20000, 10000, 5000, 3000]) { this.line(X(T), gy1, X(T), gy1 + 3, C.line); this.text(`${T / 1000}k`, X(T), gy1 + 10, C.dim, 8, 'center', 'mono'); }
    // radius lines
    for (const R of [0.001, 0.01, 0.1, 1, 10, 100, 1000]) { const Lf = (T: number) => R * R * (T / 5772) ** 4; c.beginPath(); c.moveTo(X(60000), Y(Lf(60000))); c.lineTo(X(2500), Y(Lf(2500))); c.strokeStyle = hexA(C.purple, 0.45); c.lineWidth = 1; c.setLineDash([3, 4]); c.stroke(); c.setLineDash([]); const Tl = 10 ** (this.lT0 - 0.1); const yl = Y(Lf(Tl)); if (yl > gy0 && yl < gy1) this.text(`${R} R☉`, X(Tl), yl - 6, C.purple, 7); else { const Tr = 10 ** (this.lT1 + 0.08); const yr = Y(Lf(Tr)); if (yr > gy0 && yr < gy1) this.text(`${R} R☉`, X(Tr), yr - 6, C.purple, 7, 'right'); } }
    // MS guide
    c.beginPath(); for (let i = 0; i <= 60; i++) { const ms = mainSequence(10 ** (-1.1 + i / 60 * 3)); i ? c.lineTo(X(ms.T), Y(ms.L)) : c.moveTo(X(ms.T), Y(ms.L)); } c.strokeStyle = hexA(C.text, 0.25); c.lineWidth = 3; c.stroke();
    for (const [name, T, L] of HR_PRESETS) { this.circle(X(T), Y(L), 2, undefined, C.dim); this.text(name, X(T) + 4, Y(L) - 4, C.dim, 7); }
    const R = radiusFromLT(this.L, this.T), col = tempRGB(this.T);
    this.glow(X(this.T), Y(this.L), 10, rgba(col, 0.8)); this.circle(X(this.T), Y(this.L), 4.5, '#ffffff', rgba(col));
    // scale picture
    const px = this.w * 0.81, py = this.h * 0.42, box = Math.min(this.w * 0.17, this.h * 0.3);
    const big = Math.max(R, 1), s = box / big;
    this.circle(px, py, Math.max(1.5, 1 * s), hexA(C.sun, 0.9), R < 1 ? hexA(C.sun, 0.25) : undefined, 1, R >= 1 ? [3, 3] : undefined);
    this.glow(px, py, Math.max(2, R * s) * 1.3, rgba(col, 0.5)); this.circle(px, py, Math.max(1.5, R * s), undefined, rgba(col));
    this.text(R >= 1 ? 'dashed: the Sun' : 'yellow: the Sun', px, py + box + 12, C.dim, 8, 'center');
    const reach = R * RSUN / AU_M;
    this.setReadout([
      ['Drag the star', `T = ${fmt(this.T, 0)} K, L = ${sci(this.L, 2)} L☉`], ['Radius R = √L (T☉/T)²', R < 0.05 ? `${fmt(R, 4)} R☉ = ${fmt(R * RSUN / REARTH, 1)} R⊕` : `${fmt(R, R < 10 ? 2 : 0)} R☉`, C.purple],
      ['Placed at the Sun, it would reach', reach > 30 ? `${fmt(reach, 1)} AU — past ${reach > 9.5 ? 'Saturn' : reach > 5.2 ? 'Jupiter' : reach > 1.5 ? 'Mars' : 'Earth'}` : reach > 0.3 ? `${fmt(reach, 2)} AU (${reach > 1.5 ? 'past Mars' : reach > 1 ? 'past Earth' : reach > 0.7 ? 'past Venus' : 'past Mercury'})` : `${fmt(R * RSUN / 1e6, 0)} thousand km`],
      ['Region', R > 100 ? 'supergiant' : R > 5 ? 'giant' : R > 0.05 ? 'dwarf (main sequence)' : 'white dwarf'],
      ['Mean density if 1 M☉', `${sci(MSUN / (4 / 3 * Math.PI * (R * RSUN) ** 3) / 1000, 1)} g/cm³`],
    ]);
  }
}

/* ------------------------------------------------- 95. the extended diagram ---- */

class HrExtendedWidget extends CanvasWidget {
  private age = 4.5;
  constructor() { super(480 / 330); this.slider('Age of the cooling objects', -3, 1, 0.01, Math.log10(4.5), (v) => (10 ** v < 1 ? `${fmt(10 ** v * 1000, 0)} Myr` : `${fmt(10 ** v, 1)} Gyr`), (v) => { this.age = 10 ** v; }); }
  protected draw() {
    const c = this.ctx; c.fillStyle = C.bg; c.fillRect(0, 0, this.w, this.h);
    const gx0 = 46, gx1 = this.w - 14, gy0 = 14, gy1 = this.h - 30;
    const lT0 = 4.75, lT1 = 1.75, lL0 = -12, lL1 = 6.5;
    const X = (T: number) => gx0 + (lT0 - Math.log10(T)) / (lT0 - lT1) * (gx1 - gx0), Y = (L: number) => gy1 - (Math.log10(L) - lL0) / (lL1 - lL0) * (gy1 - gy0);
    for (let k = -12; k <= 6; k += 3) { this.line(gx0, Y(10 ** k), gx1, Y(10 ** k), C.grid); this.text(k ? `10${sup(k)}` : '1', gx0 - 4, Y(10 ** k), C.faint, 8, 'right'); }
    for (const T of [30000, 10000, 3000, 1000, 300, 100]) { this.line(X(T), gy1, X(T), gy1 + 3, C.line); this.text(`${T >= 1000 ? T / 1000 + ' 000' : T} K`, X(T), gy1 + 10, C.dim, 8, 'center', 'mono'); }
    this.text('L / L☉', gx0 + 4, gy0 + 2, C.dim, 8);
    // radius lines
    for (const [R, lab] of [[1, '1 R☉'], [0.1, '0.1 R☉ ≈ R_Jup'], [0.009, '0.009 R☉ ≈ R⊕']] as Array<[number, string]>) { const Lf = (T: number) => R * R * (T / 5772) ** 4; c.beginPath(); c.moveTo(X(10 ** lT0), Y(Lf(10 ** lT0))); c.lineTo(X(10 ** lT1), Y(Lf(10 ** lT1))); c.strokeStyle = hexA(C.purple, 0.4); c.setLineDash([3, 4]); c.lineWidth = 1; c.stroke(); c.setLineDash([]); const Tl = 40000; this.text(lab, X(Tl) + 3, Y(Lf(Tl)) + 9, C.purple, 7, 'left'); }
    // main sequence
    c.beginPath(); for (let i = 0; i <= 60; i++) { const ms = mainSequence(10 ** (-1.1 + i / 60 * 3)); i ? c.lineTo(X(ms.T), Y(ms.L)) : c.moveTo(X(ms.T), Y(ms.L)); } c.strokeStyle = hexA(C.text, 0.5); c.lineWidth = 2.5; c.stroke(); this.text('main sequence', X(20000), Y(8000) - 12, C.text, 8, 'center');
    // zones
    const zone = (T0: number, T1: number, name: string, col: string) => { c.fillStyle = hexA(col, 0.08); c.fillRect(X(T0), gy0, X(T1) - X(T0), gy1 - gy0); this.text(name, (X(T0) + X(T1)) / 2, gy0 + 10, hexA(col, 0.8), 8, 'center'); };
    zone(2400, 1300, 'L', '#f0a36a'); zone(1300, 500, 'T', '#c58cff'); zone(500, 120, 'Y', '#6fc3ff');
    // cooling objects
    const t = this.age;
    const bd = (M: number) => ({ L: 4e-5 * Math.pow(M / 0.05, 2.64) * Math.pow(t, -1.3), T: 1550 * Math.pow(M / 0.05, 0.83) * Math.pow(t, -0.32) });
    for (const [M, name] of [[0.07, '0.07 M☉'], [0.05, '0.05 M☉'], [0.03, '0.03 M☉'], [0.015, '15 M_J']] as Array<[number, string]>) {
      c.beginPath(); for (let i = 0; i <= 40; i++) { const tt = 10 ** (-3 + i / 40 * 4); const o = { L: 4e-5 * Math.pow(M / 0.05, 2.64) * Math.pow(tt, -1.3), T: 1550 * Math.pow(M / 0.05, 0.83) * Math.pow(tt, -0.32) }; i ? c.lineTo(X(o.T), Y(o.L)) : c.moveTo(X(o.T), Y(o.L)); } c.strokeStyle = hexA(C.accent, 0.3); c.lineWidth = 1; c.stroke();
      const o = bd(M); this.circle(X(o.T), Y(o.L), 3, undefined, C.accent); this.text(name, X(o.T) + 5, Y(o.L) + 3, C.accent, 7);
    }
    const jup = { T: 125 * Math.pow(t / 4.5, -0.32), L: 2.3e-9 * Math.pow(t / 4.5, -1.3) }, sat = { T: 95 * Math.pow(t / 4.5, -0.32), L: 5.1e-10 * Math.pow(t / 4.5, -1.3) };
    const fixed: Array<[string, number, number, string, number, number, CanvasTextAlign]> = [['Sun', 5772, 1, C.sun, 5, -4, 'left'], ['Proxima', 3040, 0.0017, '#ff9a6a', 5, -4, 'left'], ['Sirius B', 25200, 0.026, '#8fb7ff', 5, -4, 'left'], ['Gl 229 B', 950, 6e-6, '#c58cff', 5, -4, 'left'], ['WISE 0855', 250, 3.7e-8, '#6fc3ff', -5, -4, 'right'], ['Earth 255 K', 255, 3.2e-10, '#6fa8ff', -5, -3, 'right'], ['Venus 230 K', 230, 1.9e-10, '#f4d07a', 5, 9, 'left'], ['Mars 210 K', 210, 4.2e-11, '#e07a5f', -5, 8, 'right']];
    for (const [name, T, L, col, dx, dy, al] of fixed) { this.circle(X(T), Y(L), 3, undefined, col); this.text(name, X(T) + dx, Y(L) + dy, col, 7, al); }
    for (const [name, o, col, dx, dy, al] of [['Jupiter', jup, '#f4c37a', 6, -6, 'left'], ['Saturn', sat, '#e8d7a0', 6, 10, 'left']] as Array<[string, { T: number; L: number }, string, number, number, CanvasTextAlign]>) { this.glow(X(o.T), Y(o.L), 8, hexA(col, 0.7)); this.circle(X(o.T), Y(o.L), 3.5, '#ffffff', col); this.text(name, X(o.T) + dx, Y(o.L) + dy, col, 8, al); }
    this.setReadout([
      ['Age shown', t < 1 ? `${fmt(t * 1000, 0)} Myr` : `${fmt(t, 1)} Gyr`, C.accent],
      ['Jupiter', `${fmt(jup.T, 0)} K, ${sci(jup.L, 1)} L☉`, '#f4c37a'], ['…in watts', `${sci(jup.L * LSUN_W, 1)} W`],
      ['Jupiter\'s class if self-luminous', jup.T > 1300 ? 'L' : jup.T > 500 ? 'T' : 'Y (beyond Y)'],
      ['Earth\'s thermal glow', '3 × 10⁻¹⁰ L☉'],
      ['Star vs planet', 'decided by mass, not shown here', C.dim],
    ]);
  }
}

/* ------------------------------------------------- 96. luminosity classes ---- */

const LC_TEMPS: Array<[string, number]> = [['B2', 22000], ['A0', 9700], ['F5', 6500], ['G2', 5800], ['K0', 5200], ['M2', 3600]];
const LC_EXAMPLES: Record<string, string[]> = { B2: ['χ² Ori (B2 Ia)', 'κ Ori (B0.5 Ia)', 'β CMa (B1 II–III)', 'γ Peg (B2 IV)', 'Spica (B1 V)', ''], A0: ['Deneb (A2 Ia)', 'η Leo (A0 Ib)', 'β Ori (B8 Ia)', 'δ UMa (A3 III)', 'Altair (A7 IV–V)', 'Vega (A0 V)'], F5: ['α Lep (F0 Ib)', 'Polaris (F7 Ib)', 'Canopus (A9 II)', 'ι Per (F8 III)', 'Procyon (F5 IV–V)', 'π³ Ori (F6 V)'], G2: ['β Aqr (G0 Ib)', 'ε Gem (G8 Ib)', 'ε Leo (G1 II)', 'Capella (G8 III)', 'β Hyi (G2 IV)', 'Sun (G2 V)'], K0: ['ε Peg (K2 Ib)', 'ζ Cep (K1 Ib)', 'ν Oph (K0 II)', 'Arcturus (K1.5 III)', 'η Cep (K0 IV)', 'σ Dra (K0 V)'], M2: ['Betelgeuse (M2 Iab)', 'Antares (M1.5 Iab)', 'ρ Per (M4 II)', 'Gacrux (M3.5 III)', '', 'Lacaille 8760 (M0 V)'] };
const classFromLogg = (g: number) => g >= 3.9 ? 5 : g >= 3.2 ? 4 : g >= 2.2 ? 3 : g >= 1.3 ? 2 : g >= 0.6 ? 1 : 0;
const classFrac = (g: number) => { const centres = [0.3, 1.0, 1.8, 2.6, 3.6, 4.4]; if (g <= centres[0]) return 0; if (g >= centres[5]) return 5; for (let i = 0; i < 5; i++) if (g >= centres[i] && g <= centres[i + 1]) return i + (g - centres[i]) / (centres[i + 1] - centres[i]); return 5; };

class LuminosityClassWidget extends CanvasWidget {
  private tc = 'A0'; private logg = 4.2;
  constructor() {
    super(480 / 290);
    this.segmented(LC_TEMPS.map((t) => [t[0], t[0]] as [string, string]), 'A0', (k) => { this.tc = k; });
    this.slider('Surface gravity log g', 0, 5, 0.05, 4.2, (v) => fmt(v, 2), (v) => { this.logg = v; });
  }
  protected draw() {
    const c = this.ctx; c.fillStyle = C.bg; c.fillRect(0, 0, this.w, this.h);
    const T = LC_TEMPS.find((t) => t[0] === this.tc)![1];
    const cls = classFromLogg(this.logg), cf = classFrac(this.logg), Mv = mkMv(T, cf), L = lumFromMv(Mv, T), R = radiusFromLT(L, T);
    // left: Hγ profile
    const lx0 = 14, lx1 = this.w * 0.56, ly0 = 14, ly1 = this.h - 28;
    const depthH = Math.min(1, balmerFraction(T, 20) / balmerFraction(9900, 20)) ** 0.4 * 0.75 + 0.05;
    const wStark = 1.3 * 10 ** (0.4 * (this.logg - 4.4)) * (T > 5000 ? 1 : 0.6);           // nm, half width of the wings
    const core = 0.04 + 0.03 * Math.sqrt(T / 10000);
    const prof = (dl: number) => 1 - depthH * (0.65 / (1 + (dl / wStark) ** 2) ** 1.1 + 0.35 * Math.exp(-((dl / core) ** 2)));
    const span = 6, Xl = (dl: number) => lx0 + (dl + span) / (2 * span) * (lx1 - lx0), Yl = (I: number) => ly1 - I * (ly1 - ly0) * 0.9;
    this.line(lx0, Yl(1), lx1, Yl(1), C.grid); this.line(lx0, ly1, lx1, ly1, C.grid);
    // strip
    for (let px = 0; px <= lx1 - lx0; px++) { const dl = -span + px / (lx1 - lx0) * 2 * span; const I = prof(dl); const col = waveRGB(434); c.fillStyle = rgba([col[0] * I, col[1] * I, col[2] * I]); c.fillRect(lx0 + px, ly0, 1.3, 16); }
    c.beginPath(); for (let px = 0; px <= lx1 - lx0; px++) { const dl = -span + px / (lx1 - lx0) * 2 * span; const y = Yl(prof(dl)); px ? c.lineTo(lx0 + px, y) : c.moveTo(lx0 + px, y); } c.strokeStyle = C.text; c.lineWidth = 1.4; c.stroke();
    for (const dl of [-4, -2, 0, 2, 4]) { this.line(Xl(dl), ly1, Xl(dl), ly1 + 3, C.line); this.text(`${dl >= 0 ? '+' : ''}${dl}`, Xl(dl), ly1 + 10, C.dim, 8, 'center', 'mono'); }
    this.text('Hγ 434 nm: Δλ (nm)', lx1, ly1 + 20, C.dim, 8, 'right');
    // equivalent width
    let ew = 0; for (let dl = -20; dl <= 20; dl += 0.02) ew += (1 - prof(dl)) * 0.02;
    this.text(`equivalent width ≈ ${fmt(ew * 10, 1)} Å`, lx0 + 4, ly0 + 26, C.dim, 8);
    // right: inset HR with class loci
    const gx0 = this.w * 0.64, gx1 = this.w - 12, gy0 = 14, gy1 = this.h - 28;
    const lT0 = Math.log10(30000), lT1 = Math.log10(3000);
    const X = (TT: number) => gx0 + (lT0 - Math.log10(TT)) / (lT0 - lT1) * (gx1 - gx0), Y = (mv: number) => gy0 + (mv + 9) / 20 * (gy1 - gy0);
    for (let ci = 0; ci < 6; ci++) { c.beginPath(); for (let i = 0; i <= 30; i++) { const TT = 10 ** (lT0 - i / 30 * (lT0 - lT1)); const y = Y(mkMv(TT, ci)); i ? c.lineTo(X(TT), y) : c.moveTo(X(TT), y); } c.strokeStyle = hexA(ci === cls ? C.accent : C.text, ci === cls ? 0.9 : 0.25); c.lineWidth = ci === 5 ? 2 : 1; c.stroke(); this.text(MK_NAMES[ci], gx1 - 2, Y(mkMv(3000, ci)) - 4, ci === cls ? C.accent : C.faint, 7, 'right'); }
    for (const m of [-8, -4, 0, 4, 8]) this.text(`${m > 0 ? '+' : ''}${m}`, gx0 - 3, Y(m), C.faint, 7, 'right', 'mono');
    this.text('M_V', gx0 + 2, gy0 + 2, C.dim, 7);
    this.circle(X(T), Y(Mv), 4, '#ffffff', C.accent);
    const ex = LC_EXAMPLES[this.tc][cls];
    this.setReadout([
      ['Type', `${this.tc} ${MK_NAMES[cls]}`, C.accent], ['log g → class', `${fmt(this.logg, 2)}: ${cls === 5 ? 'dwarf' : cls === 4 ? 'subgiant' : cls === 3 ? 'giant' : cls === 2 ? 'bright giant' : 'supergiant'}`],
      ['M_V, L', `${Mv > 0 ? '+' : ''}${fmt(Mv, 1)}, ${sci(L, 1)} L☉`], ['Radius', R > 10 ? `${fmt(R, 0)} R☉` : `${fmt(R, 1)} R☉`],
      ['Hγ wings', wStark > 0.6 ? 'broad — dense atmosphere' : wStark > 0.2 ? 'moderate' : 'narrow — tenuous atmosphere', C.dim], ['Example', ex || '—'],
    ]);
  }
}

/* ------------------------------------------------- 97. spectroscopic parallax ---- */

type SpStar = { name: string; type: string; T: number; cls: number; V: number; d: number; note: string };
const SP_STARS: SpStar[] = [
  { name: 'Antares', type: 'M1.5', T: 3660, cls: 0.5, V: 1.0, d: 170, note: 'razor-thin lines, strong TiO: a supergiant' },
  { name: 'Spica', type: 'B1', T: 25300, cls: 5, V: 0.98, d: 77, note: 'broad He I and H lines: a dwarf (also a close binary)' },
  { name: 'Deneb', type: 'A2', T: 8500, cls: 0, V: 1.25, d: 800, note: 'the narrowest Balmer lines of any bright A star' },
  { name: 'Arcturus', type: 'K1.5', T: 4290, cls: 3, V: -0.05, d: 11.3, note: 'moderately narrow lines, strong CN: a giant' },
  { name: 'Vega', type: 'A0', T: 9600, cls: 5, V: 0.03, d: 7.7, note: 'broad Balmer wings: the A0 V standard' },
  { name: 'Canopus', type: 'A9', T: 7400, cls: 2, V: -0.74, d: 95, note: 'narrow lines, Fe II strong: a bright giant' },
  { name: 'Barnard\'s Star', type: 'M4', T: 3130, cls: 5, V: 9.5, d: 1.83, note: 'broad Ca I, pressure-broadened K I: a dwarf' },
  { name: 'Polaris', type: 'F7', T: 6015, cls: 1, V: 1.98, d: 133, note: 'narrow lines of an Ib supergiant (a Cepheid)' },
];

class SpecParallaxWidget extends CanvasWidget {
  private star = SP_STARS[0]; private pick: number | null = null; private btns: HTMLButtonElement[] = [];
  constructor() {
    super(480 / 240);
    this.segmented(SP_STARS.map((s) => [s.name, s.name] as [string, string]), 'Antares', (k) => { this.star = SP_STARS.find((s) => s.name === k)!; this.pick = null; this.btns.forEach((b) => b.classList.remove('active')); });
    const bar = $('div', 'lw-seg'); const lab = $('span', 'lw-caption', 'Luminosity class: '); lab.style.marginRight = '6px'; this.controls.appendChild(lab);
    MK_NAMES.forEach((n, i) => { const b = $('button', '', n) as HTMLButtonElement; b.addEventListener('click', () => { this.pick = i; this.btns.forEach((x) => x.classList.toggle('active', x === b)); }); this.btns.push(b); bar.appendChild(b); });
    this.controls.appendChild(bar);
  }
  protected draw() {
    const c = this.ctx; c.fillStyle = C.bg; c.fillRect(0, 0, this.w, this.h);
    const s = this.star;
    // simulated spectrum with class-dependent line widths
    const x0 = 14, x1 = this.w - 14, ys = 12, hs = 50;
    const lines = stellarLines(s.T).map(([nm, d, w, name]) => [nm, d, name === 'TiO' ? w : w * Math.max(0.05, 10 ** (0.45 * (classFracToLogg(s.cls) - 4.4))), name] as [number, number, number, string]);
    drawSpectrumStrip(c, x0, x1, ys, hs, s.T, lines);
    this.text(`${s.name}: V = ${fmt(s.V, 2)}, spectrum classified ${s.type} — which luminosity class?`, x0, ys + hs + 12, C.dim, 8);
    // zoom on Hβ / Ca region: profile
    const gx0 = 44, gx1 = this.w - 14, gy0 = ys + hs + 24, gy1 = this.h - 24;
    const zc = s.T > 5000 ? 486.1 : 422.7, zs = s.T > 5000 ? 5 : 1.5;
    c.beginPath(); for (let px = 0; px <= gx1 - gx0; px++) { const nm = zc - zs + px / (gx1 - gx0) * 2 * zs; let a = 1; for (const [cn, d, w] of lines) { const dd = (nm - cn) / Math.max(w, 0.05); if (Math.abs(dd) < 4) a *= 1 - d * Math.exp(-dd * dd * 1.2); } const y = gy1 - a * (gy1 - gy0) * 0.9; px ? c.lineTo(gx0 + px, y) : c.moveTo(gx0 + px, y); } c.strokeStyle = C.text; c.lineWidth = 1.3; c.stroke();
    this.line(gx0, gy1, gx1, gy1, C.grid); this.text(`${s.T > 5000 ? 'Hβ' : 'Ca I'} ${zc} nm, ±${zs} nm`, gx0 + 4, gy0 + 2, C.dim, 8); this.text(s.note, gx1 - 2, gy0 + 2, C.faint, 7, 'right');
    const ro: Array<[string, string, string?]> = [['Spectral type (given)', s.type, C.accent]];
    if (this.pick === null) ro.push(['Luminosity class', 'choose one below'], ['M_V, distance', '— waiting for the class —'], ['Hint', 'line widths: narrow ⇒ tenuous ⇒ luminous']);
    else {
      const Mv = mkMv(s.T, this.pick), d = 10 ** ((s.V - Mv + 5) / 5), ratio = d / s.d, right = Math.abs(this.pick - s.cls) <= 0.5;
      ro.push(['Chosen class → M_V', `${MK_NAMES[this.pick]}: ${Mv > 0 ? '+' : ''}${fmt(Mv, 1)}`], ['d = 10^((m−M+5)/5)', d > 1000 ? `${fmt(d / 1000, 2)} kpc` : `${fmt(d, d < 10 ? 2 : 0)} pc`, right ? C.green : C.red],
        ['Gaia / Hipparcos distance', `${fmt(s.d, s.d < 10 ? 2 : 0)} pc`], ['Ratio', `${fmt(ratio, 2)}× ${right ? '— consistent within the class width' : ratio > 1 ? '— far too distant: class too luminous' : '— far too near: class too faint'}`, right ? C.green : C.red]);
      if (right) ro.push(['Actual class', `${MK_NAMES[Math.round(s.cls)]}`, C.green]);
    }
    this.setReadout(ro);
  }
}
const classFracToLogg = (cf: number) => [0.3, 1.0, 1.8, 2.6, 3.6, 4.4][Math.round(cf)];

/* ===================================================== Chapter 9 widgets ==== */

const M_H = 1.6735575e-27;
const SIGMA_T = 6.6524587e-29;
/** pseudo-Voigt profile with unit peak; v in Doppler widths, a = damping parameter (Lorentz HWHM / Doppler width) */
function voigtH(a: number, v: number): number {
  const fG = 2 * Math.sqrt(Math.LN2), fL = 2 * a;
  const f = (fG ** 5 + 2.69269 * fG ** 4 * fL + 2.42843 * fG ** 3 * fL ** 2 + 4.47163 * fG ** 2 * fL ** 3 + 0.07842 * fG * fL ** 4 + fL ** 5) ** 0.2;
  const r = fL / f;
  const eta = 1.36603 * r - 0.47719 * r * r + 0.11116 * r ** 3;
  const g = Math.exp(-4 * Math.LN2 * v * v / (f * f));
  const l = 1 / (1 + 4 * v * v / (f * f));
  return eta * l + (1 - eta) * g;
}
/** perceived colour of a spectrum F(nm) over 380–780 nm, normalised so the brightest channel is 255·scale */
let SPEC_WHITE: [number, number, number] | null = null;
function specColor(F: (nm: number) => number, scale = 1): [number, number, number] {
  const integ = (G: (nm: number) => number): [number, number, number] => { let r = 0, g = 0, b = 0; for (let nm = 385; nm < 780; nm += 5) { const c = waveRGB(nm); const f = G(nm); r += c[0] * f; g += c[1] * f; b += c[2] * f; } return [r, g, b]; };
  if (!SPEC_WHITE) SPEC_WHITE = integ((nm) => planck(nm * 1e-9, 5772));   // white balance: unattenuated sunlight → white
  const [r0, g0, b0] = SPEC_WHITE;
  let [r, g, b] = integ(F);
  r /= r0; g /= g0; b /= b0;
  const m = Math.max(r, g, b, 1e-30);
  const s = 255 * Math.min(1, scale) / m;
  return [r * s, g * s, b * s];
}
/** Eddington gray atmosphere intensities (units of 3F/4π) at vertical depth τ: upward μ>0, downward μ<0 */
function grayI(tau: number, mu: number): number {
  const a = 2 / 3;
  if (mu > 0) return tau + a + mu;
  const m = -mu; if (m < 1e-6) return 0;
  const e = Math.exp(-tau / m);
  return (tau + a - m) * (1 - e) + tau * e;
}
function axesBox(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number) {
  ctx.strokeStyle = C.line; ctx.lineWidth = 1; ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
}

/* ------------------------------------------- 9.1a specific intensity ---- */

class IntensityWidget extends CanvasWidget {
  private r = 8;
  private t = 0;
  constructor() {
    super(1.8);
    this.slider('Distance (R★)', 2, 60, 0.5, this.r, (v) => `${fmt(v, 1)} R★`, (v) => { this.r = v; });
    this.playButton();
  }
  protected draw(dt: number) {
    const c = this.ctx, w = this.w, h = this.h;
    this.t += dt;
    const r = this.r;
    const pix = 3.5 * DEG;                       // pixel angular size
    const alpha = Math.asin(Math.min(1, 1 / r));  // angular radius of star
    const resolved = alpha > pix / 2;
    const F = 1 / (r * r);
    const I = 1;
    const pixFrac = resolved ? 1 : (alpha / (pix / 2)) ** 2;
    const pixBright = I * pixFrac;
    // ---- left: geometry
    const gx0 = 10, gx1 = w * 0.52, gy = h * 0.42;
    const sx = gx0 + 30, sr = 10;
    this.glow(sx, gy, sr * 2.2, hexA(C.sun, 0.5));
    this.circle(sx, gy, sr, undefined, C.sun);
    const ox = sx + 40 + (gx1 - sx - 60) * (Math.log(r) - Math.log(2)) / (Math.log(60) - Math.log(2));
    // photons streaming
    for (let i = 0; i < 24; i++) {
      const ph = ((this.t * 0.35 + i / 24) % 1);
      const ang = (i / 24 - 0.5) * 1.2;
      const d = sr + ph * (gx1 - sx);
      const px = sx + d * Math.cos(ang), py = gy + d * Math.sin(ang);
      if (px < gx1) { c.fillStyle = hexA(C.sun, 0.25 + 0.4 * (1 - ph)); c.fillRect(px - 1, py - 1, 2, 2); }
    }
    // observer + cone
    {
      c.fillStyle = C.text; c.fillRect(ox - 2, gy - 7, 4, 14);
      this.line(ox, gy, sx, gy - sr, hexA(C.accent, 0.6), 1, [3, 3]);
      this.line(ox, gy, sx, gy + sr, hexA(C.accent, 0.6), 1, [3, 3]);
      const pl = Math.min(70, ox - sx - 14), pa = Math.max(pix / 2, Math.atan(sr / (ox - sx)) * (resolved ? 0.4 : 1.3));
      this.line(ox, gy, ox - pl * Math.cos(pa), gy - pl * Math.sin(pa), C.blue, 1);
      this.line(ox, gy, ox - pl * Math.cos(pa), gy + pl * Math.sin(pa), C.blue, 1);
      this.text('one pixel', ox, gy - 16, C.blue, 9, 'center');
      this.text(`disc 2α = ${fmt(2 * alpha / DEG, 1)}°`, ox, gy + 20, C.accent, 9, 'center');
      this.text(`r = ${fmt(r, 1)} R★`, ox, gy + 32, C.dim, 9, 'center');
    }
    this.text('star', sx, gy + sr + 14, C.dim, 10, 'center');
    // ---- right: camera view, 5x5 pixel grid
    const vx = w * 0.56, vy = 12, vs = Math.min(w * 0.42, h * 0.56);
    const n = 7, ps = vs / n;
    c.fillStyle = '#05070b'; c.fillRect(vx, vy, vs, vs);
    const cx = vx + vs / 2, cy = vy + vs / 2;
    const discR = (alpha / (pix * n / 2)) * (vs / 2);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const px0 = vx + i * ps, py0 = vy + j * ps;
      // coverage of this pixel by the disc (sampled)
      let cov = 0; const S = 6;
      for (let a = 0; a < S; a++) for (let b = 0; b < S; b++) {
        const xx = px0 + (a + 0.5) * ps / S - cx, yy = py0 + (b + 0.5) * ps / S - cy;
        if (xx * xx + yy * yy < discR * discR) cov++;
      }
      cov /= S * S;
      if (discR < ps / 2 && Math.hypot(px0 + ps / 2 - cx, py0 + ps / 2 - cy) < ps / 2) cov = Math.min(1, Math.PI * discR * discR / (ps * ps));
      c.fillStyle = rgba(tempRGB(5800), Math.min(1, cov));
      c.fillRect(px0 + 0.5, py0 + 0.5, ps - 1, ps - 1);
      c.strokeStyle = hexA(C.grid, 0.9); c.strokeRect(px0 + 0.5, py0 + 0.5, ps - 1, ps - 1);
    }
    this.text(resolved ? 'resolved: each pixel sees the same I' : 'unresolved: pixel brightness ∝ flux', vx + vs / 2, vy + vs + 12, resolved ? C.green : C.accent, 10, 'center');
    // ---- bottom: bars F and I vs r curve
    const bx0 = 14, bx1 = w * 0.52, by0 = h * 0.66, by1 = h - 16;
    axesBox(c, bx0, by0, bx1, by1);
    const X = (rr: number) => bx0 + (rr - 2) / 58 * (bx1 - bx0);
    const Y = (v: number) => by1 - v * (by1 - by0) * 0.92;
    c.beginPath();
    for (let rr = 2; rr <= 60; rr += 0.5) { const yv = Math.min(1, (4 / (rr * rr)) * 1); const px = X(rr), py = Y(yv); rr === 2 ? c.moveTo(px, py) : c.lineTo(px, py); }
    c.strokeStyle = C.accent; c.lineWidth = 1.5; c.stroke();
    c.beginPath();
    for (let rr = 2; rr <= 60; rr += 0.5) { const al = Math.asin(1 / rr); const pf = al > pix / 2 ? 1 : (al / (pix / 2)) ** 2; const px = X(rr), py = Y(pf); rr === 2 ? c.moveTo(px, py) : c.lineTo(px, py); }
    c.strokeStyle = C.green; c.lineWidth = 1.5; c.stroke();
    this.line(X(r), by0, X(r), by1, hexA(C.text, 0.4), 1, [2, 3]);
    this.text('flux F ∝ 1/r²', bx1 - 6, by0 + 10, C.accent, 10, 'right');
    this.text('surface brightness I (per pixel)', bx1 - 6, by0 + 22, C.green, 10, 'right');
    this.text('distance →', bx0 + 4, by1 - 8, C.dim, 9);
    this.setReadout([
      ['Angular radius α', `${fmt(alpha / DEG, 2)}°`],
      ['Flux (r = 2 → 1)', fmt(F * 4, 3), C.accent],
      ['Intensity of disc', resolved ? '1.000 (constant)' : '— (unresolved)', C.green],
      ['Pixel brightness', fmt(pixBright, 3), resolved ? C.green : C.accent],
    ]);
  }
}

/* ------------------------------------------------- 9.1b mean intensity ---- */

class MeanIntensityWidget extends CanvasWidget {
  private tau = 0.5;
  constructor() {
    super(1.7);
    this.slider('Optical depth τ', 0, 6, 0.05, this.tau, (v) => fmt(v, 2), (v) => { this.tau = v; });
  }
  protected draw() {
    const c = this.ctx, w = this.w, h = this.h;
    const tau = this.tau;
    const S = tau + 2 / 3;
    // numeric J and anisotropy
    let J = 0; const N = 200;
    for (let i = 0; i < N; i++) { const mu = -1 + (i + 0.5) * 2 / N; J += grayI(tau, mu) * (2 / N); }
    J /= 2;
    // ---- left: polar diagram
    const px = w * 0.3, py = h * 0.5, R = Math.min(w * 0.26, h * 0.42);
    const norm = grayI(tau, 1);
    for (const k of [0.25, 0.5, 0.75, 1]) this.circle(px, py, R * k, hexA(C.grid, 0.9), undefined, 1, [2, 3]);
    this.line(px - R - 6, py, px + R + 6, py, C.line, 1);
    this.line(px, py - R - 6, px, py + R + 6, C.line, 1);
    c.beginPath();
    for (let i = 0; i <= 180; i++) {
      const th = i * DEG;                      // angle from vertical (up)
      const mu = Math.cos(th);
      const I = grayI(tau, mu) / norm;
      const x = px + R * I * Math.sin(th), y = py - R * I * Math.cos(th);
      i === 0 ? c.moveTo(x, y) : c.lineTo(x, y);
    }
    for (let i = 180; i >= 0; i--) {
      const th = i * DEG; const mu = Math.cos(th);
      const I = grayI(tau, mu) / norm;
      c.lineTo(px - R * I * Math.sin(th), py - R * I * Math.cos(th));
    }
    c.closePath();
    c.fillStyle = hexA(C.sun, 0.18); c.fill();
    c.strokeStyle = C.sun; c.lineWidth = 1.6; c.stroke();
    this.circle(px, py, R * (J / norm), C.green, undefined, 1.2, [4, 3]);
    this.text('up (to surface)', px, py - R - 16, C.dim, 10, 'center');
    this.text('down (into star)', px, py + R + 16, C.dim, 10, 'center');
    this.text('I(θ)', px + R * 0.72, py - R * 0.75, C.sun, 11, 'left');
    this.text('⟨I⟩', px - R * (J / norm) - 4, py - 8, C.green, 11, 'right');
    // ---- right: atmosphere column with marker
    const ax = w * 0.68, ay0 = 14, ay1 = h - 14, aw = w * 0.14;
    const g = c.createLinearGradient(0, ay0, 0, ay1);
    g.addColorStop(0, '#0a0c12'); g.addColorStop(0.15, hexA(C.sun, 0.25)); g.addColorStop(1, hexA('#ffffff', 0.9));
    c.fillStyle = g; c.fillRect(ax, ay0, aw, ay1 - ay0);
    const Yt = (t: number) => ay0 + (ay1 - ay0) * (0.1 + 0.85 * t / 6);
    for (const t of [0, 1, 2, 4, 6]) { this.line(ax - 4, Yt(t), ax, Yt(t), C.dim); this.text(`τ=${t}`, ax - 7, Yt(t), C.dim, 9, 'right'); }
    this.line(ax, Yt(tau), ax + aw, Yt(tau), C.green, 2);
    this.circle(ax + aw / 2, Yt(tau), 4, undefined, C.green);
    this.text('space', ax + aw + 6, ay0 + 8, C.dim, 10);
    this.text('hotter gas ↓', ax + aw + 6, ay1 - 8, C.dim, 10);
    const T_over = (0.75 * (tau + 2 / 3)) ** 0.25;
    this.setReadout([
      ['Depth τ', fmt(tau, 2)],
      ['T / T_eff (gray)', fmt(T_over, 3)],
      ['⟨I⟩ / B(T local)', fmt(J / S, 3), C.green],
      ['⟨I⟩ / B(T_eff)', fmt(J / (4 / 3), 3), C.sun],
    ]);
  }
}

/* ------------------------------------------------- 9.1c flux integral ---- */

type FluxField = 'iso' | 'surface' | 'gradient' | 'beam';
class FluxCosWidget extends CanvasWidget {
  private field: FluxField = 'surface';
  private a = 0.5;
  private t = 0;
  constructor() {
    super(1.7);
    this.segmented<FluxField>([['iso', 'Isotropic'], ['surface', 'Stellar surface'], ['gradient', 'I = 1 + a·cos θ'], ['beam', 'Narrow beam']], this.field, (v) => { this.field = v; });
    this.slider('Anisotropy a', -1, 1, 0.05, this.a, (v) => fmt(v, 2), (v) => { this.a = v; });
    this.playButton();
  }
  private I(mu: number): number {
    switch (this.field) {
      case 'iso': return 1;
      case 'surface': return mu > 0 ? 1 : 0;
      case 'gradient': return Math.max(0, 1 + this.a * mu);
      case 'beam': return mu > 0.94 ? 1 : 0;
    }
  }
  protected draw(dt: number) {
    const c = this.ctx, w = this.w, h = this.h;
    this.t += dt;
    const N = 400; let J = 0, F = 0, P = 0;
    for (let i = 0; i < N; i++) { const mu = -1 + (i + 0.5) * 2 / N; const I = this.I(mu); const dO = TAU * (2 / N); J += I * dO; F += I * mu * dO; P += I * mu * mu * dO; }
    J /= 4 * Math.PI;
    // polar diagram
    const px = w * 0.28, py = h * 0.5, R = Math.min(w * 0.24, h * 0.4);
    this.line(px - R - 8, py, px + R + 8, py, C.line);
    this.line(px, py - R - 8, px, py + R + 8, C.line);
    this.text('↑ outward', px + 6, py - R - 4, C.dim, 9);
    c.beginPath();
    for (let i = 0; i <= 360; i++) { const th = i * DEG; const I = this.I(Math.cos(th)); const x = px + R * I * Math.sin(th), y = py - R * I * Math.cos(th); i === 0 ? c.moveTo(x, y) : c.lineTo(x, y); }
    c.closePath(); c.fillStyle = hexA(C.sun, 0.18); c.fill(); c.strokeStyle = C.sun; c.lineWidth = 1.5; c.stroke();
    // animated arrows with cos weighting through a horizontal surface element
    for (let k = 0; k < 16; k++) {
      const th = (k + 0.5) / 16 * TAU;
      const mu = Math.cos(th); const I = this.I(mu);
      if (I <= 0) continue;
      const ph = (this.t * 0.4 + k / 16) % 1;
      const d = R * 0.15 + ph * R * I * 0.8;
      const x = px + d * Math.sin(th), y = py - d * Math.cos(th);
      c.fillStyle = mu > 0 ? hexA(C.green, 0.9 - ph * 0.6) : hexA(C.red, 0.9 - ph * 0.6);
      c.fillRect(x - 1.5, y - 1.5, 3, 3);
    }
    c.fillStyle = C.text; c.fillRect(px - 18, py - 1.5, 36, 3);
    this.text('dA', px + 22, py + 8, C.text, 9);
    // bars
    const bx = w * 0.6, bw = w * 0.34, by1 = h - 30, by0 = 24;
    const items: Array<[string, number, string, string]> = [
      ['⟨I⟩ = (1/4π)∫I dΩ', J, C.sun, 'mean intensity'],
      ['F = ∫I cos θ dΩ', F / Math.PI, C.green, 'flux (units of π)'],
      ['P·c = ∫I cos²θ dΩ', P / (4 * Math.PI / 3), C.purple, 'pressure (units of 4π/3c)'],
    ];
    const bh = (by1 - by0) / items.length;
    items.forEach(([lab, v, col, sub], i) => {
      const y = by0 + i * bh + 10;
      this.text(lab, bx, y, C.text, 11);
      this.text(sub, bx, y + 13, C.dim, 9);
      const zero = bx + bw * 0.5;
      c.fillStyle = hexA(C.grid, 1); c.fillRect(bx, y + 24, bw, 12);
      const len = Math.max(-1, Math.min(1, v)) * bw * 0.5;
      c.fillStyle = col; c.fillRect(Math.min(zero, zero + len), y + 24, Math.abs(len), 12);
      this.line(zero, y + 22, zero, y + 38, C.text, 1);
      this.text(fmt(v, 3), zero + (len >= 0 ? len + 6 : len - 6), y + 30, col, 10, len >= 0 ? 'left' : 'right');
    });
    this.setReadout([
      ['⟨I⟩ (units of I_max)', fmt(J, 3), C.sun],
      ['F / π', fmt(F / Math.PI, 3), C.green],
      ['P_rad / (u/3)', fmt(P / Math.max(1e-9, 4 * Math.PI * J / 3), 3), C.purple],
      ['Net flow', F > 1e-3 ? 'outward' : F < -1e-3 ? 'inward' : 'none (cancels)'],
    ]);
  }
}

/* --------------------------------------------- 9.1d radiation pressure ---- */

type RpMode = 'grain' | 'star';
class RadPressureWidget extends CanvasWidget {
  private mode: RpMode = 'grain';
  private logS = Math.log10(1);     // grain radius µm
  private rho = 2000;
  private dist = 1;                 // AU
  private mass = 10;                // M☉
  private t = 0;
  private sl: Array<ReturnType<CanvasWidget['slider']>> = [];
  constructor() {
    super(1.7);
    this.segmented<RpMode>([['grain', 'Dust grain near the Sun'], ['star', 'Inside a star']], this.mode, (v) => { this.mode = v; this.toggle(); });
    this.sl.push(this.slider('Grain radius', -1.5, 1.5, 0.05, this.logS, (v) => `${fmt(10 ** v, 2)} µm`, (v) => { this.logS = v; }));
    this.sl.push(this.slider('Grain density', 500, 5000, 100, this.rho, (v) => `${v} kg/m³`, (v) => { this.rho = v; }));
    this.sl.push(this.slider('Distance', 0.3, 30, 0.1, this.dist, (v) => `${fmt(v, 1)} AU`, (v) => { this.dist = v; }));
    this.sl.push(this.slider('Stellar mass', 0.5, 150, 0.5, this.mass, (v) => `${fmt(v, 1)} M☉`, (v) => { this.mass = v; }));
    this.playButton();
    this.toggle();
  }
  private toggle() {
    const g = this.mode === 'grain';
    this.sl.forEach((s, i) => { (s.input.parentElement as HTMLElement).style.display = (i < 3) === g ? '' : 'none'; });
  }
  protected draw(dt: number) {
    const c = this.ctx, w = this.w, h = this.h;
    this.t += dt;
    if (this.mode === 'grain') {
      const s = 10 ** this.logS * 1e-6, r = this.dist * AU_M;
      const Lsun = LSUN_W;
      const Frad = Lsun / (4 * Math.PI * r * r * C_LIGHT) * Math.PI * s * s;
      const m = 4 / 3 * Math.PI * s ** 3 * this.rho;
      const Fg = GRAV * MSUN * m / (r * r);
      const beta = Frad / Fg;
      const Prad = Lsun / (4 * Math.PI * r * r * C_LIGHT);
      // scene
      const sx = 50, sy = h * 0.46;
      this.glow(sx, sy, 60, hexA(C.sun, 0.6)); this.circle(sx, sy, 22, undefined, C.sun);
      const gx = w * 0.55, gy = sy;
      const gr = 6 + 2 * this.logS;
      this.circle(gx, gy, Math.max(3, gr), C.text, '#8a8f99');
      const scale = 70;
      const lr = Math.min(w * 0.4, scale * Math.log10(1 + beta * 9) );
      const lg = Math.min(w * 0.4, scale * Math.log10(1 + 9 / Math.max(1e-9, beta)) );
      const arrow = (x0: number, y0: number, x1: number, col: string, lab: string, dy: number) => {
        this.line(x0, y0 + dy, x1, y0 + dy, col, 2);
        const d = Math.sign(x1 - x0);
        this.line(x1, y0 + dy, x1 - d * 7, y0 + dy - 4, col, 2); this.line(x1, y0 + dy, x1 - d * 7, y0 + dy + 4, col, 2);
        this.text(lab, (x0 + x1) / 2, y0 + dy + (dy < 0 ? -10 : 12), col, 10, 'center');
      };
      arrow(gx, gy, gx + 8 + lr, C.sun, 'radiation', -14);
      arrow(gx, gy, gx - 8 - lg, C.blue, 'gravity', 14);
      // sunlight streaks
      for (let i = 0; i < 10; i++) { const ph = (this.t * 0.5 + i / 10) % 1; const x = sx + 30 + ph * (gx - sx - 50); this.line(x, sy - 40 + i * 8, x + 10, sy - 40 + i * 8, hexA(C.sun, 0.5 * (1 - ph) + 0.1), 1); }
      // verdict
      const verdict = beta > 1 ? 'light wins → grain blown out' : beta > 0.5 ? 'nearly balanced → unbound orbit' : 'gravity wins → bound orbit';
      this.text(verdict, w / 2, h * 0.8, beta > 1 ? C.sun : C.blue, 12, 'center');
      this.text(`critical radius at this density: ${fmt(3 * Lsun / (16 * Math.PI * GRAV * MSUN * C_LIGHT * this.rho) * 1e6, 2)} µm (independent of distance)`, w / 2, h * 0.8 + 16, C.dim, 9, 'center');
      this.setReadout([
        ['P_rad at this distance', `${sci(Prad * 1e6, 2)} µPa`],
        ['F_rad / F_grav = β', fmt(beta, 3), beta > 1 ? C.sun : C.blue],
        ['Radiation force', `${sci(Frad, 2)} N`, C.sun],
        ['Gravity', `${sci(Fg, 2)} N`, C.blue],
      ]);
    } else {
      const M = this.mass;
      // Eddington quartic: 1 - β = 0.003 μ⁴ β⁴ M², μ = 0.62
      const mu = 0.62; let b = 0.9;
      for (let i = 0; i < 60; i++) b = 1 - 0.003 * mu ** 4 * b ** 4 * M * M;
      const ratio = (1 - b) / b;
      const ms = mainSequence(M);
      const Ledd = 3.2e4 * M;                 // L☉ for κ_es, X = 0.7
      const gamma = ms.L / Ledd;
      // bar
      const bx = w * 0.12, bw = w * 0.76, by = h * 0.3, bh = 36;
      c.fillStyle = hexA(C.grid, 1); c.fillRect(bx, by, bw, bh);
      const fr = (1 - b);
      c.fillStyle = C.blue; c.fillRect(bx, by, bw * b, bh);
      c.fillStyle = C.sun; c.fillRect(bx + bw * b, by, bw * fr, bh);
      this.text(`gas pressure ${fmt(100 * b, 1)} %`, bx + 8, by + bh / 2, '#fff', 11);
      if (fr > 0.08) this.text(`radiation ${fmt(100 * fr, 1)} %`, bx + bw - 8, by + bh / 2, '#000', 11, 'right');
      this.text('share of the central pressure (Eddington standard model)', w / 2, by - 12, C.dim, 10, 'center');
      // L/L_Edd gauge
      const gy = h * 0.6;
      c.fillStyle = hexA(C.grid, 1); c.fillRect(bx, gy, bw, 14);
      const gl = Math.min(1, Math.log10(1 + 9 * Math.min(1, gamma)) );
      c.fillStyle = gamma > 0.5 ? C.red : C.accent; c.fillRect(bx, gy, bw * gl, 14);
      this.text(`L / L_Edd = ${gamma < 0.01 ? sci(gamma, 1) : fmt(gamma, 3)}  (L_Edd = 4πGMc/κ_es ≈ ${sci(Ledd, 1)} L☉)`, w / 2, gy + 28, C.text, 10, 'center');
      this.text(gamma > 0.5 ? 'radiation pressure dominates the outer layers → strong wind, Eddington limit near' : 'gravity comfortably holds the atmosphere', w / 2, gy + 44, gamma > 0.5 ? C.red : C.dim, 10, 'center');
      this.setReadout([
        ['Mass', `${fmt(M, 1)} M☉`],
        ['P_rad / P_gas (centre)', ratio < 0.01 ? sci(ratio, 2) : fmt(ratio, 3), C.sun],
        ['Luminosity', `${sci(ms.L, 2)} L☉`],
        ['Γ = L / L_Edd', gamma < 0.01 ? sci(gamma, 2) : fmt(gamma, 3), gamma > 0.5 ? C.red : C.text],
      ]);
    }
  }
}

/* ----------------------------------------------- 9.2a which temperature ---- */

type CtFit = 'total' | 'bv' | 'ub' | 'jump';
class ColorTempWidget extends CanvasWidget {
  private T = 9500;
  private fit: CtFit = 'bv';
  constructor() {
    super(1.7);
    this.slider('T_eff', 4000, 20000, 100, this.T, (v) => `${v} K`, (v) => { this.T = v; });
    this.segmented<CtFit>([['total', 'Fit total flux'], ['bv', 'Fit B−V slope'], ['ub', 'Fit U−B slope'], ['jump', 'Show Balmer jump']], this.fit, (v) => { this.fit = v; });
  }
  /** synthetic SED: Planck × Balmer jump × UV line blanketing, in W m⁻³ (scaled so the total equals σT⁴/π) */
  private sed(nm: number, T: number): number {
    const D = 0.55 * Math.exp(-(((Math.log10(T) - Math.log10(9700)) / 0.13) ** 2));   // Balmer jump in mag (peaks at A0)
    const jump = nm < 364.6 ? 10 ** (-0.4 * D) : 1;
    const bl = T < 7500 ? Math.max(0, (7500 - T) / 3500) : 0;
    const blank = nm < 520 ? 1 - bl * 0.55 * Math.exp(-((nm - 380) / 70)) : 1;
    const Tc = T * (1 + 0.1 * Math.exp(-(((Math.log10(T) - Math.log10(9700)) / 0.14) ** 2)));   // Paschen continuum looks hotter where the Balmer jump redistributes flux
    return planck(nm * 1e-9, Tc) * jump * blank;
  }
  private bbTempForRatio(l1: number, l2: number, ratio: number): number {
    let lo = 2000, hi = 60000;
    for (let i = 0; i < 50; i++) { const mid = Math.sqrt(lo * hi); const r = planck(l1 * 1e-9, mid) / planck(l2 * 1e-9, mid); if (r > ratio) hi = mid; else lo = mid; }
    return Math.sqrt(lo * hi);
  }
  protected draw() {
    const c = this.ctx, w = this.w, h = this.h;
    const T = this.T;
    // renormalise SED so that ∫ = ∫B (energy conserved → redistribution)
    let sI = 0, sB = 0;
    for (let nm = 100; nm < 5000; nm += 5) { sI += this.sed(nm, T); sB += planck(nm * 1e-9, T); }
    const kN = sB / sI;
    const F = (nm: number) => this.sed(nm, T) * kN;
    const Tbv = this.bbTempForRatio(440, 550, F(440) / F(550));
    const bandU = (G: (nm: number) => number) => { let s = 0; for (let nm = 340; nm <= 400; nm += 5) s += G(nm); return s / 13; };
    const Tub = (() => { const target = bandU(F) / F(440); let lo = 2000, hi = 60000; for (let i = 0; i < 50; i++) { const mid = Math.sqrt(lo * hi); const r = bandU((nm) => planck(nm * 1e-9, mid)) / planck(440e-9, mid); if (r > target) hi = mid; else lo = mid; } return Math.sqrt(lo * hi); })();
    const Dj = -2.5 * Math.log10(F(364) / F(366));
    const Tfit = this.fit === 'total' ? T : this.fit === 'bv' ? Tbv : this.fit === 'ub' ? Tub : T;
    // axes: log F vs λ 300–1000
    const x0 = 44, x1 = w - 12, y0 = 12, y1 = h - 30;
    axesBox(c, x0, y0, x1, y1);
    const X = (nm: number) => x0 + (nm - 300) / 700 * (x1 - x0);
    const Bmax = Math.max(planck(300e-9, T), planck(1000e-9, T), planck(2.898e-3 / T, T));
    const lmin = Math.log10(Bmax) - 1.6, lmax = Math.log10(Bmax) + 0.15;
    const Y = (v: number) => y1 - (Math.log10(Math.max(v, 1e-300)) - lmin) / (lmax - lmin) * (y1 - y0);
    rainbow(c, X, y1 - 6, 6, 0.6);
    for (const nm of [300, 400, 500, 600, 700, 800, 900, 1000]) { this.text(`${nm}`, X(nm), y1 + 12, C.dim, 9, 'center'); }
    this.text('nm', x1 - 2, y1 + 22, C.dim, 9, 'right');
    this.text('log F_λ', x0 + 4, y0 + 10, C.dim, 9);
    // fitted blackbody, scaled to match at the fit point
    const bbScale = this.fit === 'total' ? 1 : this.fit === 'bv' ? F(550) / planck(550e-9, Tfit) : this.fit === 'ub' ? F(440) / planck(440e-9, Tfit) : 1;
    c.beginPath();
    for (let nm = 300; nm <= 1000; nm += 4) { const v = planck(nm * 1e-9, Tfit) * bbScale; const px = X(nm), py = Y(v); nm === 300 ? c.moveTo(px, py) : c.lineTo(px, py); }
    c.strokeStyle = this.fit === 'jump' ? hexA(C.dim, 0.6) : C.accent; c.lineWidth = 1.5; c.setLineDash([5, 4]); c.stroke(); c.setLineDash([]);
    // SED
    c.beginPath();
    for (let nm = 300; nm <= 1000; nm += 2) { const px = X(nm), py = Y(F(nm)); nm === 300 ? c.moveTo(px, py) : c.lineTo(px, py); }
    c.strokeStyle = C.star; c.lineWidth = 2; c.stroke();
    // fit markers
    const mark = (nm: number, col: string, lab: string) => { this.line(X(nm), y0, X(nm), y1, hexA(col, 0.45), 1, [2, 3]); this.text(lab, X(nm) + 3, y0 + 10, col, 9); };
    if (this.fit === 'bv') { mark(440, C.blue, 'B'); mark(550, C.green, 'V'); }
    if (this.fit === 'ub') { mark(370, C.purple, 'U (340–400)'); mark(440, C.blue, 'B'); }
    if (this.fit === 'jump') { mark(364.6, C.purple, 'Balmer limit 364.6 nm'); this.text(`jump D = ${fmt(Dj, 2)} mag`, X(364.6) + 6, Y(F(366)) - 12, C.purple, 10); }
    this.text('star (synthetic SED)', x1 - 8, y0 + 12, C.star, 10, 'right');
    this.text(this.fit === 'jump' ? 'blackbody at T_eff' : `fitted blackbody ${fmt(Tfit, 0)} K`, x1 - 8, y0 + 24, this.fit === 'jump' ? C.dim : C.accent, 10, 'right');
    this.setReadout([
      ['Effective T (total flux)', `${T} K`, C.text],
      ['Colour T from B−V', `${fmt(Tbv, 0)} K`, this.fit === 'bv' ? C.accent : C.dim],
      ['Colour T from U−B', `${fmt(Tub, 0)} K`, this.fit === 'ub' ? C.accent : C.dim],
      ['Balmer jump', `${fmt(Dj, 2)} mag`, this.fit === 'jump' ? C.purple : C.dim],
    ]);
  }
}

/* ----------------------------------------------- 9.2b optical depth slab ---- */

class OpticalDepthWidget extends CanvasWidget {
  private lr = 0; private lk = 0; private ls = 0;
  private t = 0;
  private photons: Array<{ x: number; y: number; alive: boolean; fate: number }> = [];
  private rnd = mulberry(7);
  constructor() {
    super(1.8);
    this.slider('Density ρ', -1, 1, 0.05, this.lr, (v) => `${fmt(10 ** v, 2)} (rel.)`, (v) => { this.lr = v; });
    this.slider('Opacity κ', -1, 1, 0.05, this.lk, (v) => `${fmt(10 ** v, 2)} (rel.)`, (v) => { this.lk = v; });
    this.slider('Thickness s', -1, 1, 0.05, this.ls, (v) => `${fmt(10 ** v, 2)} (rel.)`, (v) => { this.ls = v; });
    this.playButton();
  }
  protected draw(dt: number) {
    const c = this.ctx, w = this.w, h = this.h;
    this.t += dt;
    const rho = 10 ** this.lr, kap = 10 ** this.lk, s = 10 ** this.ls;
    const tau = rho * kap * s;
    const trans = Math.exp(-tau);
    // slab geometry
    const sx0 = w * 0.3, slabW = Math.max(10, w * 0.085 * Math.sqrt(s)), sx1 = sx0 + Math.min(w * 0.3, slabW);
    const sy0 = 12, sy1 = h * 0.5;
    c.fillStyle = `rgba(190,160,110,${Math.min(0.85, 0.08 + 0.09 * rho * kap)})`;
    c.fillRect(sx0, sy0, sx1 - sx0, sy1 - sy0);
    c.strokeStyle = C.line; c.strokeRect(sx0, sy0, sx1 - sx0, sy1 - sy0);
    this.text('slab', (sx0 + sx1) / 2, sy1 + 10, C.dim, 9, 'center');
    // photons
    if (dt > 0 && this.photons.length < 90 && this.rnd() < 0.6) {
      const y = sy0 + 6 + this.rnd() * (sy1 - sy0 - 12);
      this.photons.push({ x: 10, y, alive: true, fate: -Math.log(this.rnd() + 1e-9) });  // fate: optical depth it survives
    }
    const speed = 120 * dt;
    for (const p of this.photons) {
      if (!p.alive) continue;
      p.x += speed;
      if (p.x > sx0 && p.x < sx1) {
        const tauHere = tau * (p.x - sx0) / (sx1 - sx0);
        if (tauHere > p.fate) { p.alive = false; this.circle(p.x, p.y, 3, undefined, hexA(C.red, 0.7)); continue; }
      }
      c.fillStyle = p.x < sx0 ? C.sun : hexA(C.sun, 1);
      c.fillRect(p.x - 2, p.y - 1, 4, 2);
      if (p.x > w) p.alive = false;
    }
    this.photons = this.photons.filter((p) => p.alive || p.x > sx0);
    this.photons = this.photons.filter((p) => p.alive);
    // intensity bars
    const barY = sy1 + 20;
    c.fillStyle = C.sun; c.fillRect(10, barY, sx0 - 20, 8);
    this.text('I₀', 10, barY + 18, C.dim, 9);
    c.fillStyle = hexA(C.sun, 0.25); c.fillRect(sx1 + 10, barY, w - sx1 - 20, 8);
    c.fillStyle = C.sun; c.fillRect(sx1 + 10, barY, (w - sx1 - 20) * trans, 8);
    this.text(`I = I₀ e^−τ = ${fmt(100 * trans, trans < 0.01 ? 2 : 1)} % of I₀`, sx1 + 10, barY + 18, C.sun, 9);
    // curve e^-τ
    const gx0 = 44, gx1 = w - 12, gy0 = h * 0.72, gy1 = h - 14;
    axesBox(c, gx0, gy0, gx1, gy1);
    const X = (lt: number) => gx0 + (lt + 3) / 6 * (gx1 - gx0);
    const Y = (v: number) => gy1 - v * (gy1 - gy0) * 0.9 - 2;
    c.beginPath();
    for (let lt = -3; lt <= 3; lt += 0.05) { const px = X(lt), py = Y(Math.exp(-(10 ** lt))); lt === -3 ? c.moveTo(px, py) : c.lineTo(px, py); }
    c.strokeStyle = C.accent; c.lineWidth = 1.5; c.stroke();
    this.line(X(0), gy0, X(0), gy1, hexA(C.text, 0.3), 1, [2, 3]);
    this.circle(X(Math.log10(tau)), Y(trans), 4, undefined, C.sun);
    for (const lt of [-3, -2, -1, 0, 1, 2, 3]) this.text(lt === 0 ? 'τ = 1' : `10${sup(lt)}`, X(lt), gy1 - 7, C.dim, 8, 'center');
    this.text('transmitted fraction vs optical depth', gx0 + 6, gy0 + 9, C.dim, 9);
    this.text('thin', X(-2.5), gy0 + 9, C.green, 9, 'center');
    this.text('thick', X(2.5), gy0 + 9, C.red, 9, 'center');
    this.setReadout([
      ['Optical depth τ = κρs', tau < 0.01 ? sci(tau, 2) : fmt(tau, 2), tau > 1 ? C.red : C.green],
      ['Transmitted', trans < 1e-4 ? sci(trans, 1) : `${fmt(100 * trans, 1)} %`, C.sun],
      ['Mean free path / s', fmt(1 / tau, tau > 10 ? 3 : 2)],
      ['Regime', tau < 0.1 ? 'optically thin' : tau < 3 ? 'τ ≈ 1 — the "surface"' : 'optically thick'],
    ]);
  }
}

/* ------------------------------------------------------------- 9.2c sunset ---- */

type SunsetWorld = 'earth' | 'mars';
class SunsetWidget extends CanvasWidget {
  private world: SunsetWorld = 'earth';
  private z = 60;
  constructor() {
    super(1.8);
    this.segmented<SunsetWorld>([['earth', 'Earth (Rayleigh)'], ['mars', 'Mars (dust)']], this.world, (v) => { this.world = v; });
    this.slider('Zenith angle', 0, 89.5, 0.5, this.z, (v) => `${fmt(v, 1)}°`, (v) => { this.z = v; });
  }
  private tauV(nm: number): number {
    if (this.world === 'earth') {
      const ray = 0.097 * (550 / nm) ** 4.05;
      const aer = 0.04 * (550 / nm) ** 1.3;
      const oz = nm < 340 ? 1.5 * (340 - nm) / 40 : 0.03 * Math.exp(-(((nm - 600) / 60) ** 2));
      return ray + aer + oz;
    }
    return 0.6 * (550 / nm) ** 0.25;
  }
  private albedo(nm: number): number { return this.world === 'earth' ? 1 : 0.55 + 0.4 * sigm((nm - 560) / 40); }
  protected draw() {
    const c = this.ctx, w = this.w, h = this.h;
    const zr = this.z * DEG;
    const X = 1 / (Math.cos(zr) + 0.50572 * (96.07995 - this.z) ** -1.6364);   // Kasten–Young air mass
    const Tsun = 5772;
    const trans = (nm: number) => Math.exp(-this.tauV(nm) * X);
    const direct = (nm: number) => planck(nm * 1e-9, Tsun) * trans(nm);
    const sky = (nm: number) => planck(nm * 1e-9, Tsun) * (1 - Math.exp(-this.tauV(nm) * 1.2)) * this.albedo(nm) * (this.world === 'earth' ? 1 : (nm / 550) ** 1.0);
    const halo = (nm: number) => planck(nm * 1e-9, Tsun) * (this.world === 'earth' ? 0.04 * (550 / nm) ** 1.3 : this.tauV(nm) * (550 / nm) ** 2.2) * Math.exp(-this.tauV(nm) * X * 0.6);
    const discCol = specColor(direct, 1);
    const skyCol = specColor(sky, 1);
    const haloCol = specColor(halo, 1);
    const dimV = trans(550);
    // ---- left: spectrum plot
    const x0 = 40, x1 = w * 0.6, y0 = 14, y1 = h - 30;
    axesBox(c, x0, y0, x1, y1);
    const Xn = (nm: number) => x0 + (nm - 380) / 400 * (x1 - x0);
    const B0 = planck(500e-9, Tsun);
    const Y = (v: number) => y1 - (v / B0) * (y1 - y0) * 0.92;
    rainbow(c, Xn, y1 - 6, 6, 0.55);
    c.beginPath();
    for (let nm = 380; nm <= 780; nm += 2) { const px = Xn(nm), py = Y(planck(nm * 1e-9, Tsun)); nm === 380 ? c.moveTo(px, py) : c.lineTo(px, py); }
    c.strokeStyle = hexA(C.text, 0.4); c.lineWidth = 1; c.setLineDash([4, 3]); c.stroke(); c.setLineDash([]);
    c.beginPath();
    for (let nm = 380; nm <= 780; nm += 2) { const px = Xn(nm), py = Y(direct(nm)); nm === 380 ? c.moveTo(px, py) : c.lineTo(px, py); }
    c.lineTo(Xn(780), y1 - 6); c.lineTo(Xn(380), y1 - 6); c.closePath();
    c.fillStyle = rgba(discCol, 0.3); c.fill();
    c.beginPath();
    for (let nm = 380; nm <= 780; nm += 2) { const px = Xn(nm), py = Y(direct(nm)); nm === 380 ? c.moveTo(px, py) : c.lineTo(px, py); }
    c.strokeStyle = rgba(discCol, 1); c.lineWidth = 2; c.stroke();
    this.text('above the atmosphere', x1 - 6, y0 + 10, C.dim, 9, 'right');
    this.text('transmitted direct sunlight', x1 - 6, y0 + 22, rgba(discCol, 1), 9, 'right');
    for (const nm of [400, 500, 600, 700]) this.text(`${nm}`, Xn(nm), y1 + 12, C.dim, 9, 'center');
    this.text('nm', x1, y1 + 22, C.dim, 9, 'right');
    // ---- right: sky scene
    const sx0 = w * 0.64, sx1 = w - 10, sy0 = 14, sy1 = h - 30;
    const g = c.createLinearGradient(0, sy0, 0, sy1);
    g.addColorStop(0, rgba(skyCol, 1)); g.addColorStop(1, rgba(haloCol, 0.9));
    c.fillStyle = g; c.fillRect(sx0, sy0, sx1 - sx0, sy1 - sy0);
    // sun position: altitude → y
    const alt = 90 - this.z;
    const suy = sy1 - (alt / 90) * (sy1 - sy0) * 0.9 - 6;
    const sux = (sx0 + sx1) / 2;
    this.glow(sux, suy, 36, rgba(haloCol, 0.9));
    this.circle(sux, suy, 11, undefined, rgba(discCol, Math.max(0.35, dimV ** 0.3)));
    c.fillStyle = this.world === 'earth' ? '#1a2a1a' : '#5a3a28'; c.fillRect(sx0, sy1 - 10, sx1 - sx0, 10);
    this.text(this.world === 'earth' ? 'sky · disc · glow' : 'sky · disc · glow', (sx0 + sx1) / 2, sy1 + 12, C.dim, 9, 'center');
    // swatches
    const swy = sy0 + 8;
    const sw = (x: number, col: [number, number, number], lab: string) => { c.fillStyle = rgba(col, 1); c.fillRect(x, swy, 22, 14); c.strokeStyle = C.line; c.strokeRect(x, swy, 22, 14); this.text(lab, x + 11, swy + 24, C.text, 8, 'center'); };
    sw(sx0 + 6, skyCol, 'sky'); sw(sx0 + 40, discCol, 'disc'); sw(sx0 + 74, haloCol, 'glow');
    this.setReadout([
      ['Air mass X', fmt(X, 2)],
      ['τ (450 nm) · X', fmt(this.tauV(450) * X, 2), C.blue],
      ['τ (650 nm) · X', fmt(this.tauV(650) * X, 2), C.red],
      ['Dimming in V', `${fmt(-2.5 * Math.log10(dimV), 2)} mag`, C.sun],
    ]);
  }
}


/* ------------------------------------------------- 9.2d opacity sources ---- */

/** hydrogen ionisation fraction for pure-H gas at T, number density nH (m⁻³), with a 1e-4 metal-electron floor */
function hIonFrac(T: number, nH: number): number {
  const K = 2.4147e21 * T ** 1.5 * Math.exp(-13.598 / (K_EV * T));   // n_e n_p / n_H0 (m⁻³), partition 2·1/2
  const q = K / nH;
  const x = (-q + Math.sqrt(q * q + 4 * q)) / 2;
  return Math.min(1, Math.max(0, x));
}
interface OpacParts { bf: number; hm: number; ff: number; es: number }
/** monochromatic opacity (m² kg⁻¹) of a hydrogen gas at T, ρ, split by process; λ in nm */
function opacityParts(nm: number, T: number, rho: number): OpacParts {
  const nH = rho / M_H;
  const x = hIonFrac(T, nH);
  const ne = nH * Math.max(x, 1e-4);
  const Pe = ne * K_B * T;                     // Pa
  const kT = K_EV * T;
  const n0 = nH * (1 - x);
  // bound-free H I: levels n = 1..6, σ_n = 7.9e-22 n (λ/λ_n)^3 m²; Boltzmann populations
  let bf = 0, Z = 0;
  const pops: number[] = [];
  for (let n = 1; n <= 6; n++) { const p = 2 * n * n * Math.exp(-13.598 * (1 - 1 / (n * n)) / kT); pops.push(p); Z += p; }
  for (let n = 1; n <= 6; n++) {
    const ln = 91.18 * n * n;
    if (nm < ln) bf += (pops[n - 1] / Z) * 7.9e-22 * n * (nm / ln) ** 3;
  }
  const stim = 1 - Math.exp(-1239.84 / (nm * kT));
  bf *= n0 * stim / rho;
  // H⁻: N(H⁻)/N(H I) = 4.158e-10 Pe(cgs) θ^2.5 10^(0.754 θ)
  const th = 5040 / T;
  const ratio = 4.158e-10 * (Pe * 10) * th ** 2.5 * 10 ** (0.754 * th);
  const xq = nm / 1644;
  const sigHm = xq < 1 ? 4.0e-21 * Math.pow(xq, 1.1) * (1 - xq) / 0.233 : 0;
  const hmbf = ratio * n0 * sigHm * stim;
  const hmff = n0 * (Pe * 10) * 1.0e-30 * (nm / 1000) ** 2 * th ** 1.5;   // rough H⁻ free–free per neutral H
  const hm = (hmbf + hmff) / rho;
  // free-free H: α = 3.7e8 T^-1/2 n_e n_p ν^-3 (1-e^-hν/kT) cm⁻¹ (cgs)
  const nu = C_LIGHT / (nm * 1e-9);
  const neC = ne * 1e-6, npC = nH * x * 1e-6;
  const aff = 3.7e8 * T ** -0.5 * neC * npC / nu ** 3 * stim;  // cm⁻¹
  const ff = aff * 100 / rho;                                     // m⁻¹ → m²/kg
  const es = ne * SIGMA_T / rho;
  return { bf, hm, ff, es };
}

class OpacitySourcesWidget extends CanvasWidget {
  private lT = Math.log10(5800);
  private lRho = -3.5;
  constructor() {
    super(1.8);
    this.slider('Temperature', 3.5, 4.7, 0.01, this.lT, (v) => `${fmt(10 ** v, 0)} K`, (v) => { this.lT = v; });
    this.slider('Density', -6, -1, 0.1, this.lRho, (v) => `${sci(10 ** v, 1)} kg/m³`, (v) => { this.lRho = v; });
  }
  protected draw() {
    const c = this.ctx, w = this.w, h = this.h;
    const T = 10 ** this.lT, rho = 10 ** this.lRho;
    const x0 = 46, x1 = w - 12, y0 = 12, y1 = h - 30;
    axesBox(c, x0, y0, x1, y1);
    const lnm0 = Math.log10(100), lnm1 = Math.log10(3000);
    const X = (nm: number) => x0 + (Math.log10(nm) - lnm0) / (lnm1 - lnm0) * (x1 - x0);
    const lk0 = -4, lk1 = 4;
    const Y = (k: number) => y1 - (Math.min(lk1, Math.max(lk0, Math.log10(Math.max(k, 1e-30)))) - lk0) / (lk1 - lk0) * (y1 - y0);
    for (let lk = lk0; lk <= lk1; lk += 2) { this.line(x0, Y(10 ** lk), x1, Y(10 ** lk), hexA(C.grid, 0.9)); this.text(`10${sup(lk)}`, x0 - 4, Y(10 ** lk), C.dim, 9, 'right'); }
    for (const nm of [100, 200, 300, 500, 1000, 2000, 3000]) { this.line(X(nm), y1, X(nm), y1 + 3, C.dim); this.text(`${nm}`, X(nm), y1 + 11, C.dim, 9, 'center'); }
    this.text('nm', x1, y1 + 22, C.dim, 9, 'right');
    this.text('κ_λ (m² kg⁻¹)', x0 + 4, y0 + 10, C.dim, 9);
    rainbow(c, X, y1 - 5, 5, 0.5);
    const series: Array<[keyof OpacParts, string, string]> = [['bf', C.blue, 'H I bound–free'], ['hm', C.accent, 'H⁻ (bf + ff)'], ['ff', C.green, 'H free–free'], ['es', C.purple, 'electron scattering']];
    const pts: Array<{ nm: number; p: OpacParts }> = [];
    for (let l = lnm0; l <= lnm1 + 1e-9; l += 0.006) { const nm = 10 ** l; pts.push({ nm, p: opacityParts(nm, T, rho) }); }
    for (const [k, col] of series) {
      c.beginPath(); let started = false;
      for (const { nm, p } of pts) { const v = p[k]; if (v <= 1e-30) { started = false; continue; } const px = X(nm), py = Y(v); started ? c.lineTo(px, py) : c.moveTo(px, py); started = true; }
      c.strokeStyle = col; c.lineWidth = 1.3; c.stroke();
    }
    c.beginPath();
    pts.forEach(({ nm, p }, i) => { const tot = p.bf + p.hm + p.ff + p.es; const px = X(nm), py = Y(tot); i === 0 ? c.moveTo(px, py) : c.lineTo(px, py); });
    c.strokeStyle = C.star; c.lineWidth = 2.2; c.stroke();
    series.forEach(([, col, lab], i) => this.text(lab, x1 - 8, y0 + 12 + i * 12, col, 9, 'right'));
    this.text('total', x1 - 8, y0 + 12 + 4 * 12, C.star, 9, 'right');
    for (const [nm, lab] of [[91.2, 'Lyman'], [364.6, 'Balmer'], [820.4, 'Paschen'], [1644, 'H⁻ edge']] as Array<[number, string]>) {
      this.line(X(nm), y0, X(nm), y1, hexA(C.text, 0.2), 1, [2, 4]); this.text(lab, X(nm) + 3, y1 - 10, C.dim, 8);
    }
    const p5 = opacityParts(500, T, rho);
    const tot5 = p5.bf + p5.hm + p5.ff + p5.es;
    const dom = (Object.entries(p5) as Array<[keyof OpacParts, number]>).sort((a, b) => b[1] - a[1])[0][0];
    const names: Record<keyof OpacParts, string> = { bf: 'H I bound–free', hm: 'H⁻', ff: 'free–free', es: 'e⁻ scattering' };
    const xion = hIonFrac(T, rho / M_H);
    this.setReadout([
      ['T, ρ', `${fmt(T, 0)} K, ${sci(rho, 1)}`],
      ['H ionised fraction', xion < 1e-3 ? sci(xion, 1) : fmt(xion, 3)],
      ['κ at 500 nm', `${sci(tot5, 2)} m²/kg`, C.star],
      ['Dominant at 500 nm', names[dom], dom === 'bf' ? C.blue : dom === 'hm' ? C.accent : dom === 'ff' ? C.green : C.purple],
    ]);
  }
}

/* ---------------------------------------------------- 9.2e Rosseland mean ---- */

/** crude Rosseland mean (m² kg⁻¹): Kramers bf+ff scaled by ionisation, H⁻ at low T, electron-scattering floor */
function rosselandParts(T: number, rho: number, X = 0.7, Z = 0.02): { es: number; kram: number; hm: number; mol: number } {
  const nH = rho * X / M_H;
  const x = hIonFrac(T, nH);
  const es = 0.02 * (1 + X) * x;
  const kram = (4.34e21 * 0.1 * Z * (1 + X) + 3.68e18 * (1 - Z) * (1 + X)) * rho / T ** 3.5 * x;
  const hm = Math.min(1e3, 7.9e-34 * (Z / 0.02) * Math.sqrt(rho) * T ** 9 * (1 - x) * Math.exp(-((T / 9000) ** 4)));   // H⁻ destroyed above ~9000 K
  const mol = T < 3000 ? 1e-3 * (3000 / T) ** 2 : 0;   // molecular / grain floor at the cool end
  return { es, kram, hm, mol };
}
function rosselandKappa(T: number, rho: number, X = 0.7, Z = 0.02): number {
  const p = rosselandParts(T, rho, X, Z);
  return p.es + p.kram + p.hm + p.mol;
}

class RosselandWidget extends CanvasWidget {
  private lRho = -3;
  private lT = 4.0;
  private Z = 0.02;
  constructor() {
    super(1.7);
    this.slider('Probe T', 3.4, 7.4, 0.02, this.lT, (v) => `${sci(10 ** v, 1)} K`, (v) => { this.lT = v; });
    this.slider('Probe ρ', -8, 2, 0.5, this.lRho, (v) => `${sci(10 ** v, 0)} kg/m³`, (v) => { this.lRho = v; });
    this.slider('Metals Z', 0.0002, 0.04, 0.0002, this.Z, (v) => fmt(v, 4), (v) => { this.Z = v; });
  }
  protected draw() {
    const c = this.ctx, w = this.w, h = this.h;
    const x0 = 46, x1 = w - 12, y0 = 12, y1 = h - 30;
    axesBox(c, x0, y0, x1, y1);
    const X = (lT: number) => x0 + (lT - 3.4) / 4 * (x1 - x0);
    const lk0 = -2.5, lk1 = 3.5;
    const Y = (k: number) => y1 - (Math.min(lk1, Math.max(lk0, Math.log10(k))) - lk0) / (lk1 - lk0) * (y1 - y0);
    for (let lk = -2; lk <= 3; lk++) { this.line(x0, Y(10 ** lk), x1, Y(10 ** lk), hexA(C.grid, 0.9)); this.text(`10${sup(lk)}`, x0 - 4, Y(10 ** lk), C.dim, 9, 'right'); }
    for (let lT = 4; lT <= 7; lT++) { this.line(X(lT), y1, X(lT), y1 + 3, C.dim); this.text(`10${sup(lT)} K`, X(lT), y1 + 11, C.dim, 9, 'center'); }
    this.text('κ̄_Ross (m² kg⁻¹)', x0 + 4, y0 + 10, C.dim, 9);
    const rhos: Array<[number, string]> = [[-8, '#6fa3d6'], [-6, '#7fbf8a'], [-4, '#f2c45a'], [-2, '#d4694a'], [0, '#a58ad6'], [2, '#efe9d8']];
    for (const [lr, col] of rhos) {
      c.beginPath();
      for (let lT = 3.4; lT <= 7.4; lT += 0.02) { const k = rosselandKappa(10 ** lT, 10 ** lr, 0.7, this.Z); const px = X(lT), py = Y(k); lT === 3.4 ? c.moveTo(px, py) : c.lineTo(px, py); }
      c.strokeStyle = Math.abs(lr - this.lRho) < 0.26 ? col : hexA(col, 0.35); c.lineWidth = Math.abs(lr - this.lRho) < 0.26 ? 2.2 : 1.2; c.stroke();
    }
    rhos.forEach(([lr, col], i) => this.text(`ρ = 10${sup(lr)} kg/m³`, x1 - 8, y0 + 12 + i * 11, col, 9, 'right'));
    // probe curve (interpolated density) and point
    c.beginPath();
    for (let lT = 3.4; lT <= 7.4; lT += 0.02) { const k = rosselandKappa(10 ** lT, 10 ** this.lRho, 0.7, this.Z); const px = X(lT), py = Y(k); lT === 3.4 ? c.moveTo(px, py) : c.lineTo(px, py); }
    c.strokeStyle = hexA(C.text, 0.5); c.lineWidth = 1; c.setLineDash([3, 3]); c.stroke(); c.setLineDash([]);
    const kp = rosselandKappa(10 ** this.lT, 10 ** this.lRho, 0.7, this.Z);
    this.circle(X(this.lT), Y(kp), 4.5, '#fff', C.sun);
    // landmarks
    const marks: Array<[number, number, string]> = [[Math.log10(5772), -3.6, 'Sun photosphere'], [7.2, 5.2, 'Sun centre'], [Math.log10(12100), -4.5, 'Rigel photosphere'], [4.5, -5, 'H/He ionisation peak']];
    for (const [lT, lr, lab] of marks) { const k = rosselandKappa(10 ** lT, 10 ** lr, 0.7, this.Z); this.circle(X(lT), Y(k), 3, C.dim); this.text(lab, X(lT) + 6, Y(k) - 8, C.dim, 8); }
    this.line(x0, Y(0.02 * 1.7), x1, Y(0.02 * 1.7), hexA(C.purple, 0.6), 1, [4, 4]);
    this.text('electron scattering 0.02(1+X)', x0 + 6, Y(0.02 * 1.7) - 7, C.purple, 8);
    this.text('Kramers ∝ ρ T^−3.5', X(5.6), Y(rosselandKappa(10 ** 5.6, 10 ** -2, 0.7, this.Z)) - 12, C.dim, 9, 'center');
    this.text('H⁻ ∝ ρ^½ T⁹', X(3.65), Y(rosselandKappa(10 ** 3.65, 10 ** -4, 0.7, this.Z)) - 12, C.dim, 9, 'center');
    const T = 10 ** this.lT, rho = 10 ** this.lRho;
    const parts = rosselandParts(T, rho, 0.7, this.Z);
    const dom = parts.hm >= parts.kram && parts.hm >= parts.es ? 'H⁻' : parts.es >= parts.kram ? 'e⁻ scattering' : 'Kramers (bf + ff)';
    this.setReadout([
      ['T, ρ', `${sci(T, 1)} K, ${sci(rho, 0)}`],
      ['κ̄ (Rosseland)', `${kp < 0.01 || kp > 1e3 ? sci(kp, 2) : fmt(kp, kp < 1 ? 3 : 1)} m²/kg`, C.sun],
      ['Dominant', dom],
      ['Mean free path 1/κ̄ρ', `${sci(1 / (kp * rho), 2)} m`],
    ]);
  }
}

/* ------------------------------------------------------- 9.3a random walk ---- */

class RandomWalkWidget extends CanvasWidget {
  private Rl = 12;            // star radius in mean free paths
  private ellMm = 1;          // mean free path for the Sun estimate, mm
  private speed = 40;         // steps per second
  private rnd = mulberry(11);
  private path: Array<[number, number]> = [[0, 0]];
  private acc = 0;
  private trials: number[] = [];
  private steps = 0;
  constructor() {
    super(1.6);
    this.slider('Star radius R / ℓ', 4, 30, 1, this.Rl, (v) => `${v} steps`, (v) => { this.Rl = v; this.reset(); this.trials = []; });
    this.slider('Speed', 5, 400, 5, this.speed, (v) => `${v} steps/s`, (v) => { this.speed = v; });
    this.slider('Solar ℓ (for the estimate)', 0.1, 10, 0.1, this.ellMm, (v) => `${fmt(v, 1)} mm`, (v) => { this.ellMm = v; });
    this.playButton();
  }
  private reset() { this.path = [[0, 0]]; this.steps = 0; }
  protected draw(dt: number) {
    const c = this.ctx, w = this.w, h = this.h;
    this.acc += dt * this.speed;
    while (this.acc >= 1) {
      this.acc -= 1;
      const [x, y] = this.path[this.path.length - 1];
      const a = this.rnd() * TAU;
      const nx = x + Math.cos(a), ny = y + Math.sin(a);
      this.path.push([nx, ny]); this.steps++;
      if (Math.hypot(nx, ny) >= this.Rl) { this.trials.push(this.steps); if (this.trials.length > 400) this.trials.shift(); this.reset(); break; }
      if (this.path.length > 4000) this.path.splice(0, 1000);
    }
    const cx = w * 0.32, cy = h * 0.5, R = Math.min(w * 0.28, h * 0.44);
    const s = R / this.Rl;
    this.glow(cx, cy, R * 1.1, hexA(C.sun, 0.25));
    this.circle(cx, cy, R, C.sun, hexA(C.sun, 0.08), 1.5);
    this.text('star (edge = escape)', cx, cy + R + 14, C.dim, 9, 'center');
    c.beginPath();
    this.path.forEach(([x, y], i) => { const px = cx + x * s, py = cy + y * s; i === 0 ? c.moveTo(px, py) : c.lineTo(px, py); });
    c.strokeStyle = hexA(C.star, 0.5); c.lineWidth = 1; c.stroke();
    const [lx, ly] = this.path[this.path.length - 1];
    this.circle(cx + lx * s, cy + ly * s, 3, undefined, C.sun);
    this.line(cx, cy, cx + lx * s, cy + ly * s, C.green, 1.2, [3, 3]);
    this.circle(cx, cy, 2.5, undefined, C.green);
    // histogram of trials on the right
    const hx0 = w * 0.64, hx1 = w - 12, hy0 = 16, hy1 = h * 0.62;
    axesBox(c, hx0, hy0, hx1, hy1);
    const pred = this.Rl * this.Rl;
    const maxN = pred * 4;
    const bins = 20, counts = new Array(bins).fill(0);
    for (const n of this.trials) { const b = Math.min(bins - 1, Math.floor(n / maxN * bins)); counts[b]++; }
    const cmax = Math.max(1, ...counts);
    counts.forEach((n: number, i: number) => { const bw = (hx1 - hx0) / bins; c.fillStyle = hexA(C.accent, 0.7); c.fillRect(hx0 + i * bw + 1, hy1 - (n / cmax) * (hy1 - hy0 - 14), bw - 2, (n / cmax) * (hy1 - hy0 - 14)); });
    const mean = this.trials.length ? this.trials.reduce((a, b) => a + b, 0) / this.trials.length : 0;
    const Xn = (n: number) => hx0 + Math.min(1, n / maxN) * (hx1 - hx0);
    this.line(Xn(pred), hy0, Xn(pred), hy1, C.green, 1.5, [4, 3]);
    this.text(`(R/ℓ)² = ${pred}`, Xn(pred) + 4, hy0 + 10, C.green, 9);
    if (mean) { this.line(Xn(mean), hy0, Xn(mean), hy1, C.sun, 1.5); this.text(`mean ${fmt(mean, 0)}`, Xn(mean) + 4, hy0 + 22, C.sun, 9); }
    this.text('steps to escape (histogram of trials)', hx0 + 4, hy1 - 8, C.dim, 8);
    // sun estimate
    const ell = this.ellMm * 1e-3;
    const Nsun = (RSUN / ell) ** 2;
    const tsun = Nsun * ell / C_LIGHT;
    this.text('Sun, from the same rule:', hx0, hy1 + 18, C.text, 10);
    this.text(`N = (R☉/ℓ)² ≈ ${sci(Nsun, 1)} steps`, hx0, hy1 + 32, C.dim, 10);
    this.text(`t ≈ Nℓ/c ≈ ${fmtDur(tsun)}`, hx0, hy1 + 46, C.sun, 10);
    this.text(`(straight line: ${fmt(RSUN / C_LIGHT, 1)} s)`, hx0, hy1 + 60, C.dim, 9);
    this.setReadout([
      ['Current steps', `${this.steps}`],
      ['Net distance / ℓ', fmt(Math.hypot(lx, ly), 1), C.green],
      ['Trials, mean N', this.trials.length ? `${this.trials.length}, ${fmt(mean, 0)}` : '—', C.sun],
      ['Predicted (R/ℓ)²', `${pred}`],
    ]);
  }
}

/* --------------------------------------------------- 9.3b/9.4c limb darkening ---- */

const LIMB_DATA: Array<[number, number[]]> = [   // [nm, I(μ)/I(1) at μ = 1, 0.8, 0.6, 0.4, 0.2, 0.1]
  [400, [1, 0.86, 0.71, 0.55, 0.37, 0.27]],
  [550, [1, 0.89, 0.77, 0.64, 0.49, 0.40]],
  [800, [1, 0.92, 0.84, 0.74, 0.62, 0.55]],
  [1600, [1, 0.95, 0.90, 0.84, 0.76, 0.71]],
];
const LIMB_MU = [1, 0.8, 0.6, 0.4, 0.2, 0.1];
function limbU(nm: number): number { return Math.min(0.95, Math.max(0.15, 0.6 * (550 / nm) ** 0.9)); }
function limbI(mu: number, nm: number): number {
  const u = limbU(nm); const v = 0.15 * (550 / nm) ** 0.5;
  return Math.max(0, 1 - u * (1 - mu) - v * (1 - mu) ** 2 + v * (1 - mu));
}

class LimbDarkWidget extends CanvasWidget {
  private nm = 550;
  private mu = 0.7;
  private drag = false;
  constructor(private mode: 'observe' | 'eddington') {
    super(1.8);
    if (mode === 'observe') this.slider('Wavelength', 400, 1600, 10, this.nm, (v) => `${v} nm`, (v) => { this.nm = v; });
    this.slider('μ = cos θ (disc position)', 0.05, 1, 0.01, this.mu, (v) => fmt(v, 2), (v) => { this.mu = v; });
    const move = (e: PointerEvent) => { const { x, y } = canvasPos(this.canvas, e, this.w, this.h); const cx = this.w * 0.26, cy = this.h * 0.5, R = Math.min(this.w * 0.22, this.h * 0.42); const d = Math.hypot(x - cx, y - cy) / R; if (d <= 1.02) { this.mu = Math.max(0.05, Math.sqrt(Math.max(0, 1 - Math.min(1, d) ** 2))); } };
    this.canvas.addEventListener('pointerdown', (e) => { this.drag = true; move(e); });
    this.canvas.addEventListener('pointermove', (e) => { if (this.drag) move(e); });
    window.addEventListener('pointerup', () => { this.drag = false; });
  }
  protected draw() {
    const c = this.ctx, w = this.w, h = this.h;
    const mu = this.mu, nm = this.nm;
    const theta = Math.acos(mu);
    // ---- left: disc
    const cx = w * 0.26, cy = h * 0.5, R = Math.min(w * 0.22, h * 0.42);
    const sunc = tempRGB(5800);
    const filt = nm > 780 ? [235, 160, 130] as [number, number, number] : lineRGB(nm);
    const base: [number, number, number] = this.mode === 'observe' ? [0.8 * sunc[0] + 0.2 * filt[0], 0.8 * sunc[1] + 0.2 * filt[1], 0.8 * sunc[2] + 0.2 * filt[2]] : sunc;
    const g = c.createRadialGradient(cx, cy, 0, cx, cy, R);
    for (let k = 0; k <= 10; k++) { const r = k / 10; const m = Math.sqrt(Math.max(0, 1 - r * r)); const I = this.mode === 'observe' ? limbI(m, nm) : (3 * m + 2) / 5; g.addColorStop(r, rgba(base, 0.15 + 0.85 * I)); }
    c.fillStyle = g; c.beginPath(); c.arc(cx, cy, R, 0, TAU); c.fill();
    const rr = Math.sqrt(1 - mu * mu) * R;
    this.circle(cx + rr, cy, 5, '#fff', undefined, 1.5);
    this.line(cx, cy, cx + rr, cy, hexA('#fff', 0.4), 1, [2, 3]);
    this.text(this.mode === 'observe' ? 'drag the marker' : 'gray-atmosphere disc', cx, cy + R + 14, C.dim, 9, 'center');
    // ---- right
    const x0 = w * 0.55, x1 = w - 12, y0 = 14, y1 = h - 30;
    if (this.mode === 'observe') {
      // cross-section: slanted line of sight to τ_v = 2μ/3
      const ay0 = y0, ay1 = y0 + (y1 - y0) * 0.5;
      const layers = 6;
      for (let i = 0; i < layers; i++) {
        const t = (0.75 * ((i + 0.5) / layers * 2.5 + 2 / 3)) ** 0.25 * 5772;
        const br = 0.08 + 0.9 * ((t - 4700) / 2600) ** 2;
        c.fillStyle = rgba([255 * br, 200 * br * (0.6 + 0.4 * br), 110 * br * br], 1);
        c.fillRect(x0, ay0 + 14 + i * (ay1 - ay0 - 14) / layers, x1 - x0, (ay1 - ay0 - 14) / layers);
      }
      this.text('surface (τ = 0)', x0 + 4, ay0 + 8, C.dim, 9);
      const Yt = (tv: number) => ay0 + 14 + (tv / 2.5) * (ay1 - ay0 - 14);
      const tv = 2 * mu / 3;
      const ex = x0 + (x1 - x0) * 0.75, ey = ay0 + 14;
      const L = (Yt(tv) - ey) / Math.max(0.05, mu);
      const dx = L * Math.sin(theta);
      this.line(ex + dx, ey - 10, ex + dx - (L + 10) * Math.sin(theta), ey - 10 + (L + 10) * mu, '#fff', 1.5);
      this.circle(ex + dx - L * Math.sin(theta) , Yt(tv), 4, '#fff', C.sun);
      this.text(`to observer, θ = ${fmt(theta / DEG, 0)}°`, ex + dx + 4, ey - 4, C.text, 9, 'left');
      this.text(`τ_v = 2μ/3 = ${fmt(tv, 2)}`, x0 + 4, Yt(tv), C.sun, 9);
      this.line(x0, Yt(2 / 3), x1, Yt(2 / 3), hexA(C.text, 0.3), 1, [2, 3]);
      this.text('τ_v = 2/3 (disc centre)', x1 - 4, Yt(2 / 3) + 8, C.dim, 8, 'right');
      // brightness curve
      const gy0 = ay1 + 16, gy1 = y1;
      axesBox(c, x0, gy0, x1, gy1);
      const X = (m: number) => x0 + (1 - m) * (x1 - x0);
      const Y = (v: number) => gy1 - v * (gy1 - gy0) * 0.9;
      for (const [lnm, , colr] of [[400, 0, C.blue], [800, 0, C.red]] as Array<[number, number, string]>) {
        c.beginPath(); for (let m = 1; m >= 0; m -= 0.02) { const px = X(m), py = Y(limbI(m, lnm)); m === 1 ? c.moveTo(px, py) : c.lineTo(px, py); } c.strokeStyle = hexA(colr, 0.5); c.lineWidth = 1; c.stroke();
      }
      c.beginPath(); for (let m = 1; m >= 0; m -= 0.02) { const px = X(m), py = Y(limbI(m, nm)); m === 1 ? c.moveTo(px, py) : c.lineTo(px, py); } c.strokeStyle = C.star; c.lineWidth = 2; c.stroke();
      this.circle(X(mu), Y(limbI(mu, nm)), 4, '#fff', C.sun);
      this.text('centre', x0 + 4, gy1 - 8, C.dim, 8); this.text('limb', x1 - 4, gy1 - 8, C.dim, 8, 'right');
      this.text('I(μ)/I(1)', x0 + 4, gy0 + 9, C.dim, 8);
      this.text('400', x1 - 30, Y(limbI(0.1, 400)) - 6, C.blue, 8); this.text('800', x1 - 30, Y(limbI(0.1, 800)) - 6, C.red, 8);
      const Tgray = (0.75 * (tv + 2 / 3)) ** 0.25 * 5772;
      this.setReadout([
        ['Position μ, θ', `${fmt(mu, 2)}, ${fmt(theta / DEG, 0)}°`],
        ['I(μ)/I(centre)', fmt(limbI(mu, nm), 3), C.star],
        ['τ_v seen (2μ/3)', fmt(tv, 2), C.sun],
        ['T there (gray model)', `${fmt(Tgray, 0)} K`],
      ]);
    } else {
      axesBox(c, x0, y0, x1, y1);
      const X = (m: number) => x0 + 8 + m * (x1 - x0 - 16);
      const Y = (v: number) => y1 - 8 - v * (y1 - y0 - 16);
      for (const v of [0.2, 0.4, 0.6, 0.8, 1]) { this.line(x0, Y(v), x1, Y(v), hexA(C.grid, 0.9)); this.text(fmt(v, 1), x0 + 3, Y(v) - 6, C.dim, 8); }
      for (const m of [0, 0.2, 0.4, 0.6, 0.8, 1]) this.text(fmt(m, 1), X(m), y1 + 10, C.dim, 8, 'center');
      this.text('μ = cos θ  (limb ← → centre)', (x0 + x1) / 2, y1 + 22, C.dim, 9, 'center');
      c.beginPath(); for (let m = 0; m <= 1; m += 0.02) { const px = X(m), py = Y((3 * m + 2) / 5); m === 0 ? c.moveTo(px, py) : c.lineTo(px, py); } c.strokeStyle = C.accent; c.lineWidth = 2.2; c.stroke();
      this.text('gray atmosphere: (3μ + 2)/5', X(0.5), Y(0.26), C.accent, 9);
      const cols = [C.blue, C.green, C.red, C.purple];
      LIMB_DATA.forEach(([lnm, vals], i) => {
        vals.forEach((v, j) => this.circle(X(LIMB_MU[j]), Y(v), 3, undefined, cols[i]));
        c.beginPath(); vals.forEach((v, j) => { const px = X(LIMB_MU[j]), py = Y(v); j === 0 ? c.moveTo(px, py) : c.lineTo(px, py); }); c.strokeStyle = hexA(cols[i], 0.5); c.lineWidth = 1; c.stroke();
        this.text(`${lnm} nm`, X(0.1) + 6, Y(vals[5]) + (i === 0 ? 8 : -6), cols[i], 8);
      });
      this.line(X(mu), y0, X(mu), y1, hexA('#fff', 0.35), 1, [2, 3]);
      const pred = (3 * mu + 2) / 5;
      const interp = (vals: number[]) => { for (let j = 0; j < LIMB_MU.length - 1; j++) { if (mu <= LIMB_MU[j] && mu >= LIMB_MU[j + 1]) { const f = (LIMB_MU[j] - mu) / (LIMB_MU[j] - LIMB_MU[j + 1]); return vals[j] + f * (vals[j + 1] - vals[j]); } } return vals[5]; };
      this.setReadout([
        ['μ', fmt(mu, 2)],
        ['Gray prediction', fmt(pred, 3), C.accent],
        ['Observed 550 nm', fmt(interp(LIMB_DATA[1][1]), 3), C.green],
        ['Observed 400 / 800 nm', `${fmt(interp(LIMB_DATA[0][1]), 2)} / ${fmt(interp(LIMB_DATA[2][1]), 2)}`],
      ]);
    }
  }
}

/* ------------------------------------------------- 9.3c transfer in a slab ---- */

class TransferWidget extends CanvasWidget {
  private I0 = 1;
  private S = 0.5;
  private tauL = 2;
  private tauC = 0.05;
  constructor() {
    super(1.8);
    this.slider('Background I₀', 0, 2, 0.05, this.I0, (v) => fmt(v, 2), (v) => { this.I0 = v; });
    this.slider('Source function S', 0, 2, 0.05, this.S, (v) => fmt(v, 2), (v) => { this.S = v; });
    this.slider('Line-centre τ', 0, 12, 0.1, this.tauL, (v) => fmt(v, 1), (v) => { this.tauL = v; });
    this.slider('Continuum τ', 0, 3, 0.05, this.tauC, (v) => fmt(v, 2), (v) => { this.tauC = v; });
  }
  protected draw() {
    const c = this.ctx, w = this.w, h = this.h;
    const tau = (x: number) => this.tauC + this.tauL * Math.exp(-x * x * 8);
    const I = (x: number) => this.I0 * Math.exp(-tau(x)) + this.S * (1 - Math.exp(-tau(x)));
    // ---- left: slab cartoon
    const lx0 = 10, lx1 = w * 0.36, ly = h * 0.42;
    const sx0 = lx0 + (lx1 - lx0) * 0.38, sx1 = lx0 + (lx1 - lx0) * 0.66;
    c.fillStyle = hexA(C.accent, 0.1 + 0.5 * Math.min(1, this.tauL / 6)); c.fillRect(sx0, 20, sx1 - sx0, h * 0.6);
    c.strokeStyle = C.line; c.strokeRect(sx0, 20, sx1 - sx0, h * 0.6);
    this.text('gas, S', (sx0 + sx1) / 2, h * 0.6 + 32, C.accent, 10, 'center');
    c.fillStyle = hexA(C.star, Math.min(1, 0.15 + this.I0 / 2)); c.fillRect(lx0 + 4, ly - 20, sx0 - lx0 - 10, 40);
    this.text('I₀', lx0 + 8, ly - 28, C.star, 10);
    const Iout = I(0), Ic = I(1.5);
    c.fillStyle = hexA(C.star, Math.min(1, 0.15 + Ic / 2)); c.fillRect(sx1 + 6, ly - 20, lx1 - sx1 - 10, 40);
    c.fillStyle = hexA(C.star, Math.min(1, 0.15 + Iout / 2)); c.fillRect(sx1 + 6, ly - 6, lx1 - sx1 - 10, 12);
    this.text('out', sx1 + 10, ly - 28, C.star, 10);
    this.text('I = I₀e^−τ + S(1 − e^−τ)', (lx0 + lx1) / 2, h - 16, C.dim, 9, 'center');
    // ---- right: spectrum
    const x0 = w * 0.44, x1 = w - 12, y0 = 14, y1 = h - 30;
    axesBox(c, x0, y0, x1, y1);
    const X = (x: number) => x0 + (x + 2) / 4 * (x1 - x0);
    const Y = (v: number) => y1 - 6 - (v / 2.1) * (y1 - y0 - 12);
    this.line(x0, Y(this.I0), x1, Y(this.I0), hexA(C.star, 0.4), 1, [3, 3]); this.text('I₀', x1 - 4, Y(this.I0) - 7, C.star, 9, 'right');
    this.line(x0, Y(this.S), x1, Y(this.S), hexA(C.accent, 0.6), 1, [3, 3]); this.text('S', x1 - 4, Y(this.S) - 7, C.accent, 9, 'right');
    c.beginPath();
    for (let x = -2; x <= 2; x += 0.02) { const px = X(x), py = Y(I(x)); x === -2 ? c.moveTo(px, py) : c.lineTo(px, py); }
    c.strokeStyle = C.sun; c.lineWidth = 2.2; c.stroke();
    this.text('λ →', x1 - 4, y1 + 12, C.dim, 9, 'right');
    this.text('emergent I_λ', x0 + 4, y0 + 10, C.sun, 9);
    const kind = Math.abs(Iout - Ic) < 0.01 ? 'no line (I₀ = S or τ = 0)' : Iout > Ic ? 'emission line' : 'absorption line';
    const thick = this.tauL + this.tauC > 5 ? ' · core saturated at S' : '';
    this.text(kind + thick, (x0 + x1) / 2, y1 - 10, Iout > Ic ? C.green : C.red, 10, 'center');
    this.setReadout([
      ['I at line centre', fmt(Iout, 3), C.sun],
      ['I in continuum', fmt(Ic, 3)],
      ['Line type', kind, Iout > Ic + 0.01 ? C.green : Iout < Ic - 0.01 ? C.red : C.dim],
      ['Depth / height vs continuum', fmt(Iout - Ic, 3)],
    ]);
  }
}

/* ------------------------------------------------------ 9.3d thermalisation ---- */

class ThermalizeWidget extends CanvasWidget {
  private lEps = -2;
  private t = 0;
  constructor() {
    super(1.7);
    this.slider('Destruction probability ε', -4, 0, 0.1, this.lEps, (v) => sci(10 ** v, 1), (v) => { this.lEps = v; });
    this.playButton();
  }
  protected draw(dt: number) {
    const c = this.ctx, w = this.w, h = this.h;
    this.t += dt;
    const eps = 10 ** this.lEps, se = Math.sqrt(eps);
    const J = (tau: number) => 1 - Math.exp(-Math.sqrt(3 * eps) * tau) / (1 + se);
    const S = (tau: number) => (1 - eps) * J(tau) + eps;
    const tth = 1 / Math.sqrt(3 * eps);
    // plot vs log τ
    const x0 = 44, x1 = w * 0.66, y0 = 14, y1 = h - 30;
    axesBox(c, x0, y0, x1, y1);
    const lt0 = -2, lt1 = 3;
    const X = (tau: number) => x0 + (Math.log10(tau) - lt0) / (lt1 - lt0) * (x1 - x0);
    const Y = (v: number) => y1 - 8 - v * (y1 - y0 - 16);
    for (let lt = lt0; lt <= lt1; lt++) { this.line(X(10 ** lt), y1, X(10 ** lt), y1 + 3, C.dim); this.text(`10${sup(lt)}`, X(10 ** lt), y1 + 11, C.dim, 9, 'center'); }
    this.text('τ', x1, y1 + 22, C.dim, 9, 'right');
    for (const v of [0.5, 1]) { this.line(x0, Y(v), x1, Y(v), hexA(C.grid, 0.9)); this.text(fmt(v, 1), x0 - 4, Y(v), C.dim, 9, 'right'); }
    this.line(x0, Y(1), x1, Y(1), hexA(C.sun, 0.6), 1.5, [5, 4]); this.text('B(T) (Planck, isothermal gas)', x1 - 6, Y(1) + 10, C.sun, 9, 'right');
    const curve = (f: (t: number) => number, col: string, wd: number) => { c.beginPath(); for (let lt = lt0; lt <= lt1; lt += 0.02) { const t = 10 ** lt; const px = X(t), py = Y(f(t)); lt === lt0 ? c.moveTo(px, py) : c.lineTo(px, py); } c.strokeStyle = col; c.lineWidth = wd; c.stroke(); };
    // pure absorption reference
    curve((t) => 1 - Math.exp(-Math.sqrt(3) * t) / 2, hexA(C.dim, 0.6), 1);
    this.text('ε = 1 (pure absorption)', X(0.02), Y(0.56), C.dim, 8);
    curve(J, C.green, 2); curve(S, C.accent, 2);
    this.text('⟨I⟩ / B', X(0.015), Y(J(0.015)) - 10, C.green, 10);
    this.text('S / B', X(0.015), Y(S(0.015)) + 10, C.accent, 10);
    if (tth > 10 ** lt0 && tth < 10 ** lt1) { this.line(X(tth), y0, X(tth), y1, hexA(C.purple, 0.6), 1, [3, 3]); this.text(`τ_th ≈ 1/√3ε = ${fmt(tth, 1)}`, X(tth) + 4, y0 + 10, C.purple, 9); }
    // ---- right: cartoon of scattering vs destruction
    const rx0 = w * 0.72, rx1 = w - 10, ry0 = 14, ry1 = h - 30;
    c.fillStyle = hexA(C.accent, 0.08); c.fillRect(rx0, ry0, rx1 - rx0, ry1 - ry0);
    const n = 9;
    for (let i = 0; i < n; i++) {
      const ph = (this.t * 0.25 + i / n) % 1;
      const yy = ry0 + 10 + ph * (ry1 - ry0 - 20);
      const xx = rx0 + 10 + ((i * 37) % Math.max(1, rx1 - rx0 - 20));
      const destroyed = ((i * 7919) % 1000) / 1000 < eps * 4;
      if (destroyed && ph > 0.5) { this.circle(xx, yy, 2.5, undefined, hexA(C.red, 0.8)); this.circle(xx, yy, 6, hexA(C.sun, 0.5)); }
      else { c.fillStyle = hexA(C.star, 0.8); c.fillRect(xx - 1.5, yy - 1.5, 3, 3); this.line(xx, yy, xx + 6 * Math.cos(i), yy + 6 * Math.sin(i * 1.3), hexA(C.star, 0.4)); }
    }
    this.text('scatter: keeps memory', rx0 + 4, ry1 - 22, C.star, 8);
    this.text('absorb + re-emit: thermal', rx0 + 4, ry1 - 10, C.red, 8);
    this.setReadout([
      ['ε', sci(eps, 1)],
      ['⟨I⟩(0) / B = √ε/(1+√ε)', fmt(J(0), 3), C.green],
      ['S(0) / B', fmt(S(0), 3), C.accent],
      ['Thermalisation depth', fmt(tth, 1), C.purple],
    ]);
  }
}

/* ----------------------------------------------------- 9.4a plane-parallel ---- */

class PlaneParallelWidget extends CanvasWidget {
  private theta = 50;
  constructor() {
    super(1.8);
    this.slider('Ray angle θ from vertical', 0, 85, 1, this.theta, (v) => `${v}°`, (v) => { this.theta = v; });
  }
  protected draw() {
    const c = this.ctx, w = this.w, h = this.h;
    const th = this.theta * DEG, mu = Math.cos(th);
    const x0 = 10, x1 = w * 0.62, y0 = 16, y1 = h - 24;
    const tauMax = 3;
    const Yt = (tv: number) => y0 + 20 + (tv / tauMax) * (y1 - y0 - 20);
    // layers
    const nL = 12;
    for (let i = 0; i < nL; i++) {
      const tv = (i + 0.5) / nL * tauMax;
      const T = (0.75 * (tv + 2 / 3)) ** 0.25 * 5772;
      c.fillStyle = rgba(tempRGB(T), 0.2 + 0.6 * i / nL);
      c.fillRect(x0, Yt(i / nL * tauMax), x1 - x0, Yt((i + 1) / nL * tauMax) - Yt(i / nL * tauMax) + 0.5);
    }
    for (const tv of [0, 0.5, 1, 1.5, 2, 2.5, 3]) { this.line(x0, Yt(tv), x1, Yt(tv), hexA('#000', 0.25)); this.text(`τ_v = ${fmt(tv, 1)}`, x0 + 4, Yt(tv) + 7, hexA('#fff', 0.6), 8); }
    this.text('space', x0 + 4, y0 + 8, C.dim, 9);
    // ray: emerges at top at point ex; travels down-left at angle θ
    const ex = x0 + (x1 - x0) * 0.72, ey = Yt(0);
    const marks: Array<[number, string, string]> = [[2 / 3, '2/3', C.sun], [1, '1', C.accent], [2, '2', C.red]];
    const pxOf = (tv: number) => { const L = (Yt(tv) - ey) / mu; return [ex - L * Math.sin(th), Yt(tv)] as [number, number]; };
    const far = Math.min(tauMax * mu, tauMax);
    const [fx, fy] = pxOf(far);
    this.line(ex + 30 * Math.sin(th), ey - 30 * mu, fx, fy, '#fff', 1.8);
    this.line(ex, ey, ex, Yt(Math.min(tauMax, 2.2)), hexA('#fff', 0.5), 1, [3, 3]);
    this.text('vertical', ex + 4, Yt(1.9), hexA('#fff', 0.6), 8);
    // angle arc
    c.beginPath(); c.arc(ex, ey, 26, Math.PI / 2, Math.PI / 2 + th); c.strokeStyle = C.blue; c.lineWidth = 1; c.stroke();
    this.text(`θ = ${this.theta}°`, ex - 36 * Math.sin(th / 2) - 10, ey + 36 * Math.cos(th / 2), C.blue, 9, 'right');
    for (const [ts, lab, col] of marks) {
      const tv = ts * mu;
      if (tv > tauMax) continue;
      const [mx, my] = pxOf(tv);
      this.circle(mx, my, 4.5, '#000', col, 1);
      this.text(`slant τ = ${lab} → τ_v = ${fmt(tv, 2)}`, mx + 9, my + 9, col, 9, 'left');
    }
    this.text('to observer ↗', ex + 30 * Math.sin(th) + 4, ey - 30 * mu - 2, C.text, 9);
    // ---- right: τ_v(μ) curve for slant 2/3
    const gx0 = w * 0.68, gx1 = w - 12, gy0 = 20, gy1 = h - 30;
    axesBox(c, gx0, gy0, gx1, gy1);
    const X = (m: number) => gx0 + 6 + m * (gx1 - gx0 - 12);
    const Y = (tv: number) => gy1 - 6 - (tv / 0.8) * (gy1 - gy0 - 12);
    c.beginPath(); for (let m = 0; m <= 1; m += 0.02) { const px = X(m), py = Y(2 * m / 3); m === 0 ? c.moveTo(px, py) : c.lineTo(px, py); } c.strokeStyle = C.sun; c.lineWidth = 2; c.stroke();
    this.circle(X(mu), Y(2 * mu / 3), 4, '#fff', C.sun);
    this.text('depth seen τ_v = 2μ/3', gx0 + 4, gy0 + 10, C.sun, 9);
    this.text('limb', gx0 + 4, gy1 - 8, C.dim, 8); this.text('centre', gx1 - 4, gy1 - 8, C.dim, 8, 'right');
    this.text('μ', (gx0 + gx1) / 2, gy1 + 12, C.dim, 9, 'center');
    const tv = 2 * mu / 3;
    const T = (0.75 * (tv + 2 / 3)) ** 0.25 * 5772;
    const zkm = -120 * Math.log(Math.max(1e-3, tv));   // height above τ_v = 1, 120 km scale height
    this.setReadout([
      ['μ = cos θ', fmt(mu, 3)],
      ['Slant path factor 1/μ', fmt(1 / mu, 2)],
      ['τ_v where slant τ = 2/3', fmt(tv, 3), C.sun],
      ['T there (Sun, gray)', `${fmt(T, 0)} K, +${fmt(zkm, 0)} km`],
    ]);
  }
}


/* ------------------------------------------------- 9.4b gray atmosphere T(τ) ---- */

const SOLAR_EMP: Array<[number, number]> = [   // [log τ_500, T] — smoothed empirical quiet-Sun photosphere
  [-3, 4420], [-2.5, 4480], [-2, 4600], [-1.5, 4780], [-1, 5000], [-0.5, 5330], [-0.18, 5780], [0, 6150], [0.3, 7000], [0.7, 8200], [1, 9500], [1.3, 10800],
];
function solarEmpT(lt: number): number {
  if (lt <= SOLAR_EMP[0][0]) return SOLAR_EMP[0][1];
  for (let i = 0; i < SOLAR_EMP.length - 1; i++) { const [a, Ta] = SOLAR_EMP[i], [b, Tb] = SOLAR_EMP[i + 1]; if (lt >= a && lt <= b) return Ta + (Tb - Ta) * (lt - a) / (b - a); }
  return SOLAR_EMP[SOLAR_EMP.length - 1][1];
}
const hopfQ = (tau: number) => 0.7104 - 0.1331 * Math.exp(-3.4488 * tau);

class GrayAtmWidget extends CanvasWidget {
  private Teff = 5772;
  private probe = Math.log10(2 / 3);
  constructor() {
    super(1.7);
    this.slider('T_eff', 3000, 30000, 100, this.Teff, (v) => `${v} K`, (v) => { this.Teff = v; });
    this.slider('Probe log τ', -3, 1.3, 0.05, this.probe, (v) => fmt(v, 2), (v) => { this.probe = v; });
  }
  protected draw() {
    const c = this.ctx, w = this.w, h = this.h;
    const Te = this.Teff;
    const Tg = (tau: number) => Te * (0.75 * (tau + 2 / 3)) ** 0.25;
    const Th = (tau: number) => Te * (0.75 * (tau + hopfQ(tau))) ** 0.25;
    const x0 = 50, x1 = w - 12, y0 = 14, y1 = h - 30;
    axesBox(c, x0, y0, x1, y1);
    const lt0 = -3, lt1 = 1.3;
    const X = (lt: number) => x0 + (lt - lt0) / (lt1 - lt0) * (x1 - x0);
    const T0 = Te * 0.7, T1 = Te * 1.9;
    const Y = (T: number) => y1 - 6 - (T - T0) / (T1 - T0) * (y1 - y0 - 12);
    for (let lt = -3; lt <= 1; lt++) { this.line(X(lt), y1, X(lt), y1 + 3, C.dim); this.text(`10${sup(lt)}`, X(lt), y1 + 11, C.dim, 9, 'center'); }
    this.text('optical depth τ', x1, y1 + 22, C.dim, 9, 'right');
    for (const f of [0.8, 1, 1.2, 1.4, 1.6, 1.8]) { this.line(x0, Y(Te * f), x1, Y(Te * f), hexA(C.grid, 0.9)); this.text(`${fmt(f, 1)} T_eff`, x0 - 4, Y(Te * f), C.dim, 8, 'right'); }
    // temperature-coloured band under the curve
    for (let lt = lt0; lt < lt1; lt += 0.04) { const T = Tg(10 ** lt); c.fillStyle = rgba(tempRGB(T), 0.12); c.fillRect(X(lt), Y(T), X(lt + 0.04) - X(lt) + 0.5, y1 - Y(T)); }
    const curve = (f: (t: number) => number, col: string, wd: number, dash?: number[]) => { c.beginPath(); for (let lt = lt0; lt <= lt1; lt += 0.02) { const px = X(lt), py = Y(f(10 ** lt)); lt === lt0 ? c.moveTo(px, py) : c.lineTo(px, py); } c.strokeStyle = col; c.lineWidth = wd; c.setLineDash(dash ?? []); c.stroke(); c.setLineDash([]); };
    curve(Th, hexA(C.purple, 0.8), 1.2, [4, 3]);
    curve(Tg, C.accent, 2.2);
    // empirical Sun, scaled by Te/5772
    c.beginPath(); SOLAR_EMP.forEach(([lt, T], i) => { const px = X(lt), py = Y(T * Te / 5772); i === 0 ? c.moveTo(px, py) : c.lineTo(px, py); }); c.strokeStyle = C.green; c.lineWidth = 1.6; c.stroke();
    SOLAR_EMP.forEach(([lt, T]) => this.circle(X(lt), Y(T * Te / 5772), 2.5, undefined, C.green));
    this.text('Eddington gray: T⁴ = ¾T_eff⁴(τ + ⅔)', x0 + 8, y0 + 12, C.accent, 10);
    this.text('exact gray (Hopf q(τ))', x0 + 8, y0 + 25, C.purple, 9);
    this.text(Te === 5772 ? 'empirical quiet Sun' : 'empirical Sun scaled to T_eff', x0 + 8, y0 + 38, C.green, 9);
    this.line(X(Math.log10(2 / 3)), y0, X(Math.log10(2 / 3)), y1, hexA(C.text, 0.3), 1, [2, 4]);
    this.text('τ = 2/3', X(Math.log10(2 / 3)) + 3, y1 - 10, C.dim, 8);
    const pt = 10 ** this.probe;
    this.circle(X(this.probe), Y(Tg(pt)), 4.5, '#fff', C.accent);
    this.circle(X(this.probe), Y(solarEmpT(this.probe) * Te / 5772), 4.5, '#fff', C.green);
    this.setReadout([
      ['τ (probe)', fmt(pt, pt < 0.1 ? 3 : 2)],
      ['T gray (Eddington)', `${fmt(Tg(pt), 0)} K`, C.accent],
      ['T empirical (scaled)', `${fmt(solarEmpT(this.probe) * Te / 5772, 0)} K`, C.green],
      ['T(0), T(2/3)', `${fmt(Tg(0), 0)} K, ${fmt(Tg(2 / 3), 0)} K`],
    ]);
  }
}

/* ------------------------------------------------ 9.4d Eddington–Barbier ---- */

type BarbShape = 'linear' | 'hump' | 'step' | 'spike';
class BarbierWidget extends CanvasWidget {
  private shape: BarbShape = 'linear';
  private mu = 0.6;
  private par = 0.5;
  constructor() {
    super(1.8);
    this.segmented<BarbShape>([['linear', 'Linear S'], ['hump', 'Hump'], ['step', 'Step'], ['spike', 'Spike']], this.shape, (v) => { this.shape = v; });
    this.slider('μ = cos θ', 0.1, 1, 0.01, this.mu, (v) => fmt(v, 2), (v) => { this.mu = v; });
    this.slider('Shape parameter', 0, 1, 0.01, this.par, (v) => fmt(v, 2), (v) => { this.par = v; });
  }
  private S(tau: number): number {
    const p = this.par;
    switch (this.shape) {
      case 'linear': return 0.4 + 1.2 * p * tau;
      case 'hump': return 0.5 + Math.exp(-(((tau - 0.3 - 2.2 * p) / 0.35) ** 2));
      case 'step': return tau < 0.2 + 2 * p ? 0.4 : 1.4;
      case 'spike': return 0.5 + 1.5 * Math.exp(-(((tau - 0.2 - 2.2 * p) / 0.08) ** 2));
    }
  }
  protected draw() {
    const c = this.ctx, w = this.w, h = this.h;
    const mu = this.mu;
    const tmax = 4;
    let I = 0; const N = 2000;
    for (let i = 0; i < N; i++) { const t = (i + 0.5) / N * 12; I += this.S(t) * Math.exp(-t / mu) / mu * (12 / N); }
    const est = this.S(mu);
    const x0 = 44, x1 = w - 12, y0 = 14, y1 = h - 30;
    axesBox(c, x0, y0, x1, y1);
    const X = (t: number) => x0 + t / tmax * (x1 - x0);
    const Y = (v: number) => y1 - 6 - v / 2.2 * (y1 - y0 - 12);
    for (let t = 0; t <= tmax; t++) { this.line(X(t), y1, X(t), y1 + 3, C.dim); this.text(`${t}`, X(t), y1 + 11, C.dim, 9, 'center'); }
    this.text('vertical optical depth τ_v', x1, y1 + 22, C.dim, 9, 'right');
    // weight function shaded
    c.beginPath(); c.moveTo(X(0), y1 - 6);
    for (let t = 0; t <= tmax; t += 0.02) c.lineTo(X(t), Y(2 * Math.exp(-t / mu)));
    c.lineTo(X(tmax), y1 - 6); c.closePath(); c.fillStyle = hexA(C.blue, 0.15); c.fill();
    c.beginPath(); for (let t = 0; t <= tmax; t += 0.02) { const px = X(t), py = Y(2 * Math.exp(-t / mu)); t === 0 ? c.moveTo(px, py) : c.lineTo(px, py); } c.strokeStyle = hexA(C.blue, 0.8); c.lineWidth = 1.2; c.stroke();
    this.text('escape weight e^(−τ/μ)', X(mu) + 6, Y(2 * Math.exp(-1)) - 8, C.blue, 9);
    // S(τ)
    c.beginPath(); for (let t = 0; t <= tmax; t += 0.01) { const px = X(t), py = Y(this.S(t)); t === 0 ? c.moveTo(px, py) : c.lineTo(px, py); } c.strokeStyle = C.accent; c.lineWidth = 2.2; c.stroke();
    this.text('source function S(τ)', x0 + 8, y0 + 12, C.accent, 10);
    // marker at τ = μ
    this.line(X(mu), y0, X(mu), y1, hexA(C.sun, 0.6), 1, [3, 3]);
    this.circle(X(mu), Y(est), 5, '#fff', C.sun);
    this.text(`τ = μ = ${fmt(mu, 2)}`, X(mu) + 4, y1 - 10, C.sun, 9);
    // exact I as horizontal line
    this.line(x0, Y(I), x1, Y(I), C.green, 1.5, [6, 3]);
    if (Math.abs(est - I) < 0.04) this.text(`exact I = ${fmt(I, 3)} ≈ S(τ = μ) = ${fmt(est, 3)}`, x1 - 6, Y(I) - 8, C.green, 9, 'right');
    else { this.text(`exact emergent I = ${fmt(I, 3)}`, x1 - 6, Y(I) - 8, C.green, 9, 'right'); this.text(`S(τ = μ) = ${fmt(est, 3)}`, x1 - 6, Y(est) + (est > I ? -8 : 10), C.sun, 9, 'right'); }
    const err = 100 * (est - I) / I;
    this.setReadout([
      ['μ', fmt(mu, 2)],
      ['Exact I(0, μ) = ∫S e^(−τ/μ) dτ/μ', fmt(I, 3), C.green],
      ['Eddington–Barbier S(τ = μ)', fmt(est, 3), C.sun],
      ['Error', `${err >= 0 ? '+' : ''}${fmt(err, 1)} %`, Math.abs(err) < 3 ? C.green : Math.abs(err) < 10 ? C.accent : C.red],
    ]);
  }
}

/* ------------------------------------------------------- 9.5a line anatomy ---- */

class LineProfileWidget extends CanvasWidget {
  private depth = 0.7;
  private fwhm = 0.08;   // nm
  private wing = 0.3;    // Lorentz fraction
  private blur = 0;      // instrument FWHM nm
  constructor() {
    super(1.8);
    this.slider('Core depth', 0.05, 1, 0.01, this.depth, (v) => fmt(v, 2), (v) => { this.depth = v; });
    this.slider('Intrinsic FWHM', 0.01, 0.4, 0.005, this.fwhm, (v) => `${fmt(v, 3)} nm`, (v) => { this.fwhm = v; });
    this.slider('Damping wings', 0, 1, 0.01, this.wing, (v) => fmt(v, 2), (v) => { this.wing = v; });
    this.slider('Instrument blur', 0, 0.3, 0.005, this.blur, (v) => `${fmt(v, 3)} nm`, (v) => { this.blur = v; });
  }
  private prof(dl: number): number {   // absorption depth profile (0..depth)
    const s = this.fwhm / 2;
    const g = Math.exp(-Math.LN2 * (dl / s) ** 2);
    const l = 1 / (1 + (dl / s) ** 2);
    return this.depth * ((1 - this.wing) * g + this.wing * l);
  }
  protected draw() {
    const c = this.ctx, w = this.w, h = this.h;
    const range = 1.0; // ±nm
    const N = 400;
    const dls: number[] = [], raw: number[] = [];
    for (let i = 0; i <= N; i++) { const dl = -range + 2 * range * i / N; dls.push(dl); raw.push(this.prof(dl)); }
    // blur (gaussian convolution)
    let obs = raw;
    if (this.blur > 0.001) {
      const sg = this.blur / 2.3548, dx = 2 * range / N, half = Math.ceil(3 * sg / dx);
      const k: number[] = []; let ks = 0;
      for (let j = -half; j <= half; j++) { const v = Math.exp(-0.5 * ((j * dx) / sg) ** 2); k.push(v); ks += v; }
      obs = raw.map((_, i) => { let s = 0; for (let j = -half; j <= half; j++) { const ii = Math.min(N, Math.max(0, i + j)); s += raw[ii] * k[j + half]; } return s / ks; });
    }
    const dx = 2 * range / N;
    const W = obs.reduce((a, b) => a + b, 0) * dx;
    const Wraw = raw.reduce((a, b) => a + b, 0) * dx;
    const dmax = Math.max(...obs);
    let fw = 0; { const halfd = dmax / 2; let lo = 0, hi = N; while (lo < N && obs[lo] < halfd) lo++; while (hi > 0 && obs[hi] < halfd) hi--; fw = (hi - lo) * dx; }
    const x0 = 40, x1 = w - 12, y0 = 14, y1 = h * 0.74;
    axesBox(c, x0, y0, x1, y1);
    const X = (dl: number) => x0 + (dl + range) / (2 * range) * (x1 - x0);
    const Y = (f: number) => y0 + 8 + (1 - f) * (y1 - y0 - 16);
    this.line(x0, Y(1), x1, Y(1), hexA(C.text, 0.5), 1, [4, 3]); this.text('continuum F_c', x0 + 6, Y(1) - 8, C.dim, 9);
    // equivalent-width rectangle
    c.fillStyle = hexA(C.sun, 0.25); c.fillRect(X(-W / 2), Y(1), X(W / 2) - X(-W / 2), Y(0) - Y(1));
    this.text(`W = ${fmt(W * 1000, 1)} pm`, X(0), Y(0) - 8, C.sun, 9, 'center');
    // profile
    c.beginPath(); dls.forEach((dl, i) => { const px = X(dl), py = Y(1 - obs[i]); i === 0 ? c.moveTo(px, py) : c.lineTo(px, py); }); c.strokeStyle = C.star; c.lineWidth = 2; c.stroke();
    if (this.blur > 0.001) { c.beginPath(); dls.forEach((dl, i) => { const px = X(dl), py = Y(1 - raw[i]); i === 0 ? c.moveTo(px, py) : c.lineTo(px, py); }); c.strokeStyle = hexA(C.dim, 0.6); c.lineWidth = 1; c.setLineDash([3, 3]); c.stroke(); c.setLineDash([]); }
    // FWHM markers
    this.line(X(-fw / 2), Y(1 - dmax / 2), X(fw / 2), Y(1 - dmax / 2), C.green, 1.2);
    this.text(`FWHM ${fmt(fw * 1000, 1)} pm`, X(fw / 2) + 4, Y(1 - dmax / 2), C.green, 9);
    this.text('core', X(0), Y(1 - dmax) + 10, C.red, 9, 'center');
    this.text('wing', X(-0.6), Y(1 - this.prof(-0.6)) - 10, C.accent, 9, 'center');
    this.text('wing', X(0.6), Y(1 - this.prof(0.6)) - 10, C.accent, 9, 'center');
    for (const d of [-1, -0.5, 0, 0.5, 1]) this.text(d === 0 ? 'λ₀' : `${d > 0 ? '+' : ''}${fmt(d, 1)} nm`, X(d), y1 + 10, C.dim, 9, 'center');
    // formation depth strip
    const sy = y1 + 22, sh = h - sy - 6;
    this.text('formation height across the profile (bright = high, cool):', x0, sy - 2, C.dim, 8);
    for (let i = 0; i < N; i += 2) { const tl = raw[i] / Math.max(1e-6, 1 - raw[i]); const hgt = Math.min(1, Math.log10(1 + 20 * tl) / 2.3); c.fillStyle = rgba(tempRGB(6500 - 2200 * hgt), 0.2 + 0.8 * hgt); c.fillRect(X(dls[i]), sy + 6, X(dls[i + 2]) - X(dls[i]) + 0.5, Math.max(2, sh - 6)); }
    this.setReadout([
      ['Equivalent width', `${fmt(W * 1000, 1)} pm`, C.sun],
      ['W before blur', `${fmt(Wraw * 1000, 1)} pm (unchanged)`],
      ['FWHM (observed)', `${fmt(fw * 1000, 1)} pm`, C.green],
      ['Core depth (observed)', fmt(dmax, 3), C.red],
    ]);
  }
}

/* ------------------------------------------------------- 9.5b broadening ---- */

type BrLine = 'ha' | 'nad' | 'fe';
const BR_LINES: Record<BrLine, { nm: number; m: number; name: string; nat: number; press: number; stark: boolean }> = {
  ha: { nm: 656.3, m: 1.008, name: 'Hα', nat: 4.6e-5, press: 0.02, stark: true },
  nad: { nm: 589.0, m: 22.99, name: 'Na D₁', nat: 1.2e-5, press: 0.004, stark: false },
  fe: { nm: 525.0, m: 55.85, name: 'Fe I 525.0', nat: 1.0e-5, press: 0.002, stark: false },
};
class BroadeningWidget extends CanvasWidget {
  private line_: BrLine = 'nad';
  private T = 5800;
  private lP = 0;        // log pressure relative to solar photosphere
  private vt = 1;        // km/s
  constructor() {
    super(1.8);
    this.segmented<BrLine>([['ha', 'Hα'], ['nad', 'Na D'], ['fe', 'Fe I']], this.line_, (v) => { this.line_ = v; });
    this.slider('Temperature', 3000, 30000, 100, this.T, (v) => `${v} K`, (v) => { this.T = v; });
    this.slider('Pressure (rel. to Sun)', -3, 2, 0.1, this.lP, (v) => `×${sci(10 ** v, 1)}`, (v) => { this.lP = v; });
    this.slider('Turbulence', 0, 15, 0.5, this.vt, (v) => `${fmt(v, 1)} km/s`, (v) => { this.vt = v; });
  }
  protected draw() {
    const c = this.ctx, w = this.w, h = this.h;
    const L = BR_LINES[this.line_];
    const lam = L.nm;
    const vth = Math.sqrt(2 * K_B * this.T / (L.m * 1.6605e-27));                 // m/s
    const vD = Math.sqrt(vth * vth + (this.vt * 1e3) ** 2);
    const dlD = lam * vD / C_LIGHT;                       // Doppler width (1/e half-width), nm
    const fwD = 2 * Math.sqrt(Math.LN2) * dlD;
    const fwN = L.nat;
    const P = 10 ** this.lP;
    const fwP = L.press * (L.stark ? P ** (2 / 3) : P) * Math.sqrt(this.T / 5800);
    const fwL = fwN + fwP;
    const a = (fwL / 2) / dlD;
    const fwV = 0.5346 * fwL + Math.sqrt(0.2166 * fwL * fwL + fwD * fwD);
    const range = Math.max(fwV * 3.5, fwD * 4, 0.02);
    const x0 = 40, x1 = w - 12, y0 = 14, y1 = h - 30;
    axesBox(c, x0, y0, x1, y1);
    const X = (dl: number) => x0 + (dl + range) / (2 * range) * (x1 - x0);
    const Y = (v: number) => y1 - 8 - v * (y1 - y0 - 16);
    const curve = (f: (dl: number) => number, col: string, wd: number, dash?: number[]) => { c.beginPath(); for (let i = 0; i <= 400; i++) { const dl = -range + 2 * range * i / 400; const px = X(dl), py = Y(f(dl)); i === 0 ? c.moveTo(px, py) : c.lineTo(px, py); } c.strokeStyle = col; c.lineWidth = wd; c.setLineDash(dash ?? []); c.stroke(); c.setLineDash([]); };
    curve((dl) => Math.exp(-((dl / dlD) ** 2)), C.blue, 1.2, [4, 3]);
    curve((dl) => 1 / (1 + (2 * dl / fwL) ** 2), C.red, 1.2, [4, 3]);
    curve((dl) => voigtH(a, dl / dlD), C.star, 2.2);
    this.text('Gaussian (Doppler + turbulence)', x1 - 8, y0 + 12, C.blue, 9, 'right');
    this.text('Lorentzian (natural + pressure)', x1 - 8, y0 + 24, C.red, 9, 'right');
    this.text('Voigt (combined)', x1 - 8, y0 + 36, C.star, 9, 'right');
    this.text(`${L.name} ${lam} nm`, x0 + 8, y0 + 12, C.text, 11);
    this.text('normalised absorption profile', x0 + 8, y0 + 25, C.dim, 9);
    const tick = range > 0.5 ? 0.5 : range > 0.1 ? 0.1 : range > 0.05 ? 0.02 : 0.01;
    for (let d = -Math.floor(range / tick) * tick; d <= range; d += tick) { this.line(X(d), y1, X(d), y1 + 3, C.dim); this.text(d === 0 ? 'λ₀' : `${d > 0 ? '+' : ''}${fmt(d, tick < 0.05 ? 2 : 1)}`, X(d), y1 + 11, C.dim, 8, 'center'); }
    this.text('nm', x1, y1 + 22, C.dim, 9, 'right');
    const f3 = (v: number) => (v < 1e-3 ? sci(v, 1) : fmt(v, 4)) + ' nm';
    this.setReadout([
      ['Natural width', f3(fwN)],
      ['Doppler FWHM', f3(fwD), C.blue],
      ['Pressure width', f3(fwP), C.red],
      ['Voigt FWHM', f3(fwV), C.star],
    ]);
  }
}

/* --------------------------------------------------------- 9.5c rotation ---- */

class RotationWidget extends CanvasWidget {
  private vsini = 100;
  private vint = 6;    // km/s intrinsic FWHM
  private u = 0.6;
  constructor() {
    super(1.8);
    this.slider('v sin i', 0, 300, 2, this.vsini, (v) => `${v} km/s`, (v) => { this.vsini = v; });
    this.slider('Intrinsic FWHM', 2, 30, 0.5, this.vint, (v) => `${fmt(v, 1)} km/s`, (v) => { this.vint = v; });
    this.slider('Limb darkening u', 0, 1, 0.05, this.u, (v) => fmt(v, 2), (v) => { this.u = v; });
  }
  protected draw() {
    const c = this.ctx, w = this.w, h = this.h;
    const vs = this.vsini, u = this.u;
    // ---- disc
    const cx = w * 0.24, cy = h * 0.48, R = Math.min(w * 0.2, h * 0.4);
    const img = c.createImageData(Math.ceil(2 * R), Math.ceil(2 * R));
    const n = Math.ceil(2 * R);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const x = (i - R) / R, y = (j - R) / R; const r2 = x * x + y * y;
      const k = (j * n + i) * 4;
      if (r2 > 1) { img.data[k + 3] = 0; continue; }
      const mu = Math.sqrt(1 - r2);
      const I = 1 - u * (1 - mu);
      const v = x;   // -1 .. 1 → blue to red
      const t = Math.abs(v) ** 0.8;
      const [tr, tg, tb] = v < 0 ? [70, 120, 255] : [255, 80, 50];
      const rr = 215 + (tr - 215) * t, gg = 215 + (tg - 215) * t, bb = 215 + (tb - 215) * t;
      img.data[k] = rr * I; img.data[k + 1] = gg * I; img.data[k + 2] = bb * I; img.data[k + 3] = 255;
    }
    c.putImageData(img, Math.round(cx - R), Math.round(cy - R));
    this.text(`−${vs}`, cx - R, cy + R + 14, C.blue, 9, 'center'); this.text(`+${vs} km/s`, cx + R, cy + R + 14, C.red, 9, 'center');
    this.text('line-of-sight velocity', cx, cy - R - 10, C.dim, 9, 'center');
    this.line(cx, cy - R, cx, cy + R, hexA('#fff', 0.3), 1, [3, 3]);
    // ---- profile: convolve gaussian with rotation kernel
    const range = Math.max(60, vs * 1.4 + 20);
    const N = 300;
    const sg = this.vint / 2.3548;
    const G = (v: number) => { if (vs < 1) return 0; const x = v / vs; if (Math.abs(x) >= 1) return 0; return (2 * (1 - u) * Math.sqrt(1 - x * x) + Math.PI * u / 2 * (1 - x * x)) / (Math.PI * (1 - u / 3)) / vs; };
    const prof: number[] = [];
    const dv = 2 * range / N;
    for (let i = 0; i <= N; i++) {
      const v = -range + i * dv;
      let s = 0;
      if (vs < 1) s = Math.exp(-0.5 * (v / sg) ** 2);
      else { for (let j = -N; j <= N; j++) { const vv = j * dv; if (Math.abs(vv) > vs) continue; s += G(vv) * Math.exp(-0.5 * ((v - vv) / sg) ** 2) * dv; } }
      prof.push(s);
    }
    // normalise to same equivalent width (depth 0.8 for vs=0 gaussian)
    const area0 = 0.8 * sg * Math.sqrt(TAU);
    const area = prof.reduce((a, b) => a + b, 0) * dv;
    const scale = area0 / Math.max(1e-9, area);
    const depth = Math.max(...prof) * scale;
    const zoom = depth < 0.3 ? 0.6 / depth : 1;
    const x0 = w * 0.5, x1 = w - 12, y0 = 14, y1 = h - 30;
    axesBox(c, x0, y0, x1, y1);
    const X = (v: number) => x0 + (v + range) / (2 * range) * (x1 - x0);
    const Y = (f: number) => y0 + 8 + (1 - f) * (y1 - y0 - 16);
    this.line(x0, Y(1), x1, Y(1), hexA(C.text, 0.4), 1, [4, 3]);
    c.beginPath(); prof.forEach((p, i) => { const v = -range + i * dv; const px = X(v), py = Y(1 - Math.min(1, p * scale * zoom)); i === 0 ? c.moveTo(px, py) : c.lineTo(px, py); }); c.strokeStyle = C.star; c.lineWidth = 2.2; c.stroke();
    if (zoom > 1) this.text(`(rotating profile drawn ×${fmt(zoom, 1)} deeper for visibility)`, (x0 + x1) / 2, y1 - 10, C.dim, 8, 'center');
    c.beginPath(); for (let i = 0; i <= N; i++) { const v = -range + i * dv; const px = X(v), py = Y(1 - 0.8 * Math.exp(-0.5 * (v / sg) ** 2)); i === 0 ? c.moveTo(px, py) : c.lineTo(px, py); } c.strokeStyle = hexA(C.dim, 0.6); c.lineWidth = 1; c.setLineDash([3, 3]); c.stroke(); c.setLineDash([]);
    this.text('non-rotating', x1 - 8, y0 + 12, C.dim, 9, 'right');
    this.text('rotationally broadened (same W)', x1 - 8, y0 + 24, C.star, 9, 'right');
    for (const v of [-range, -range / 2, 0, range / 2, range]) this.text(`${fmt(v, 0)}`, X(v), y1 + 10, C.dim, 8, 'center');
    this.text('km/s', x1, y1 + 22, C.dim, 9, 'right');
    // FWHM
    let lo = 0, hi = N; const hd = depth / 2; while (lo < N && prof[lo] * scale < hd) lo++; while (hi > 0 && prof[hi] * scale < hd) hi--;
    const fw = (hi - lo) * dv;
    const lam = 500;
    this.setReadout([
      ['v sin i', `${vs} km/s`],
      ['Profile FWHM', `${fmt(fw, 1)} km/s`, C.star],
      ['FWHM at 500 nm', `${fmt(lam * fw * 1e3 / C_LIGHT, 3)} nm`],
      ['Core depth (W conserved)', fmt(Math.min(1, depth), 3), C.red],
    ]);
  }
}

/* ------------------------------------------------- 9.5d curve of growth ---- */

class CurveOfGrowthWidget extends CanvasWidget {
  private lt0 = 0;        // log τ₀ (line-centre optical depth)
  private la = -3;        // log damping parameter a
  private cache: Array<[number, number]> | null = null;
  private cacheA = NaN;
  constructor() {
    super(1.8);
    this.slider('log (N f λ) → log τ₀', -3, 5, 0.05, this.lt0, (v) => fmt(v, 2), (v) => { this.lt0 = v; });
    this.slider('Damping a', -4, -1, 0.1, this.la, (v) => sci(10 ** v, 1), (v) => { this.la = v; });
  }
  private W(tau0: number, a: number): number {   // in Doppler widths
    const vmax = Math.max(6, 3 * Math.sqrt(Math.max(1, tau0 * a)) + 6, 2 * Math.sqrt(Math.log(tau0 + 1) + 1) + 4);
    const N = 600; let s = 0;
    for (let i = 0; i < N; i++) { const v = -vmax + (i + 0.5) * 2 * vmax / N; s += (1 - Math.exp(-tau0 * voigtH(a, v))) * (2 * vmax / N); }
    return s;
  }
  protected draw() {
    const c = this.ctx, w = this.w, h = this.h;
    const a = 10 ** this.la, tau0 = 10 ** this.lt0;
    if (this.cacheA !== a || !this.cache) { this.cache = []; for (let l = -3; l <= 5.001; l += 0.1) this.cache.push([l, Math.log10(this.W(10 ** l, a))]); this.cacheA = a; }
    const Wnow = this.W(tau0, a);
    // ---- left: profile
    const px0 = 36, px1 = w * 0.46, py0 = 14, py1 = h - 30;
    axesBox(c, px0, py0, px1, py1);
    const vr = 8;
    const X = (v: number) => px0 + (v + vr) / (2 * vr) * (px1 - px0);
    const Y = (f: number) => py0 + 8 + (1 - f) * (py1 - py0 - 16);
    this.line(px0, Y(1), px1, Y(1), hexA(C.text, 0.4), 1, [4, 3]);
    c.beginPath(); for (let i = 0; i <= 300; i++) { const v = -vr + 2 * vr * i / 300; const f = Math.exp(-tau0 * voigtH(a, v)); const px = X(v), py = Y(f); i === 0 ? c.moveTo(px, py) : c.lineTo(px, py); } c.lineTo(X(vr), Y(1)); c.lineTo(X(-vr), Y(1)); c.closePath(); c.fillStyle = hexA(C.sun, 0.2); c.fill(); c.strokeStyle = C.star; c.lineWidth = 2; c.stroke();
    this.text('profile e^(−τ_λ)', px0 + 6, py0 + 12, C.star, 9);
    this.text('Δλ / Δλ_D', px1 - 4, py1 + 12, C.dim, 9, 'right');
    for (const v of [-6, -3, 0, 3, 6]) this.text(`${v}`, X(v), py1 + 10, C.dim, 8, 'center');
    // ---- right: curve of growth
    const gx0 = w * 0.54, gx1 = w - 12, gy0 = 14, gy1 = h - 30;
    axesBox(c, gx0, gy0, gx1, gy1);
    const GX = (l: number) => gx0 + (l + 3) / 8 * (gx1 - gx0);
    const GY = (lw: number) => gy1 - 8 - (lw + 3) / 5.5 * (gy1 - gy0 - 16);
    for (let l = -3; l <= 5; l++) { this.line(GX(l), gy1, GX(l), gy1 + 3, C.dim); this.text(`${l}`, GX(l), gy1 + 10, C.dim, 8, 'center'); }
    for (let lw = -3; lw <= 2; lw++) { this.line(gx0, GY(lw), gx1, GY(lw), hexA(C.grid, 0.9)); this.text(`${lw}`, gx0 - 3, GY(lw), C.dim, 8, 'right'); }
    this.text('log τ₀ ∝ log N f λ', gx1, gy1 + 22, C.dim, 9, 'right');
    this.text('log W / Δλ_D', gx0 + 4, gy0 + 10, C.dim, 9);
    // regime shading
    const r1 = GX(0.3), r2 = GX(Math.max(1.5, Math.log10(1 / a) - 0.3));
    c.fillStyle = hexA(C.green, 0.06); c.fillRect(gx0, gy0, r1 - gx0, gy1 - gy0);
    c.fillStyle = hexA(C.accent, 0.06); c.fillRect(r1, gy0, r2 - r1, gy1 - gy0);
    c.fillStyle = hexA(C.red, 0.06); c.fillRect(r2, gy0, gx1 - r2, gy1 - gy0);
    this.text('linear', (gx0 + r1) / 2, gy0 + 24, C.green, 8, 'center'); this.text('W ∝ N', (gx0 + r1) / 2, gy0 + 34, C.green, 8, 'center');
    this.text('flat', (r1 + r2) / 2, gy0 + 24, C.accent, 8, 'center'); this.text('W ∝ √ln N', (r1 + r2) / 2, gy0 + 34, C.accent, 8, 'center');
    this.text('damping', (r2 + gx1) / 2, gy0 + 24, C.red, 8, 'center'); this.text('W ∝ √N', (r2 + gx1) / 2, gy0 + 34, C.red, 8, 'center');
    c.beginPath(); this.cache.forEach(([l, lw], i) => { const px = GX(l), py = GY(lw); i === 0 ? c.moveTo(px, py) : c.lineTo(px, py); }); c.strokeStyle = C.star; c.lineWidth = 2.2; c.stroke();
    this.circle(GX(this.lt0), GY(Math.log10(Wnow)), 5, '#fff', C.sun);
    const regime = this.lt0 < 0.3 ? 'linear (weak line)' : this.lt0 < Math.log10(1 / a) - 0.3 ? 'saturated (flat part)' : 'damping (square-root part)';
    this.setReadout([
      ['Line-centre τ₀', tau0 < 0.01 || tau0 > 1e4 ? sci(tau0, 1) : fmt(tau0, 2)],
      ['W / Δλ_D', fmt(Wnow, 3), C.sun],
      ['Central depth', fmt(1 - Math.exp(-tau0), 3)],
      ['Regime', regime, this.lt0 < 0.3 ? C.green : this.lt0 < Math.log10(1 / a) - 0.3 ? C.accent : C.red],
    ]);
  }
}

/* --------------------------------------------------------- 9.5e abundances ---- */

const ABUND: Array<[string, number, number, number | null]> = [   // symbol, mass (u), log ε photosphere, log ε CI meteorites
  ['H', 1.008, 12.00, null], ['He', 4.003, 10.93, null], ['Li', 6.94, 1.05, 3.26], ['Be', 9.012, 1.38, 1.30], ['B', 10.81, 2.70, 2.79],
  ['C', 12.011, 8.43, 7.39], ['N', 14.007, 7.83, 6.26], ['O', 15.999, 8.69, 8.40], ['F', 18.998, 4.56, 4.42], ['Ne', 20.18, 7.93, null],
  ['Na', 22.99, 6.24, 6.27], ['Mg', 24.305, 7.60, 7.53], ['Al', 26.982, 6.45, 6.43], ['Si', 28.085, 7.51, 7.51], ['P', 30.974, 5.41, 5.43],
  ['S', 32.06, 7.12, 7.15], ['Cl', 35.45, 5.50, 5.23], ['Ar', 39.948, 6.40, null], ['K', 39.098, 5.03, 5.08], ['Ca', 40.078, 6.34, 6.29],
  ['Sc', 44.956, 3.15, 3.05], ['Ti', 47.867, 4.95, 4.91], ['V', 50.942, 3.93, 3.96], ['Cr', 51.996, 5.64, 5.64], ['Mn', 54.938, 5.43, 5.48],
  ['Fe', 55.845, 7.50, 7.45], ['Co', 58.933, 4.99, 4.87], ['Ni', 58.693, 6.22, 6.20], ['Cu', 63.546, 4.19, 4.25], ['Zn', 65.38, 4.56, 4.63],
  ['Sr', 87.62, 2.87, 2.88], ['Zr', 91.224, 2.58, 2.58], ['Ba', 137.33, 2.18, 2.18], ['Eu', 151.96, 0.52, 0.51], ['Pb', 207.2, 1.75, 2.04],
];
type AbView = 'sun' | 'both' | 'diff';
class AbundancesWidget extends CanvasWidget {
  private view: AbView = 'both';
  private hover = -1;
  constructor() {
    super(1.9);
    this.segmented<AbView>([['sun', 'Photosphere'], ['both', 'Sun + meteorites'], ['diff', 'Difference']], this.view, (v) => { this.view = v; });
    this.canvas.addEventListener('pointermove', (e) => { const { x } = canvasPos(this.canvas, e, this.w, this.h); const x0 = 40, x1 = this.w - 10; const i = Math.floor((x - x0) / (x1 - x0) * ABUND.length); this.hover = i >= 0 && i < ABUND.length ? i : -1; });
    this.canvas.addEventListener('pointerleave', () => { this.hover = -1; });
  }
  protected draw() {
    const c = this.ctx, w = this.w, h = this.h;
    const x0 = 40, x1 = w - 10, y0 = 14, y1 = h - 26;
    axesBox(c, x0, y0, x1, y1);
    const n = ABUND.length, bw = (x1 - x0) / n;
    if (this.view === 'diff') {
      const Y = (d: number) => (y0 + y1) / 2 - d / 2.6 * (y1 - y0) / 2;
      this.line(x0, Y(0), x1, Y(0), C.text, 1);
      for (const d of [-2, -1, 1, 2]) { this.line(x0, Y(d), x1, Y(d), hexA(C.grid, 0.9)); this.text(`${d > 0 ? '+' : ''}${d}`, x0 - 4, Y(d), C.dim, 8, 'right'); }
      this.text('log ε(Sun) − log ε(CI)', x0 + 6, y0 + 10, C.dim, 9);
      ABUND.forEach(([sym, , s, m], i) => {
        const x = x0 + i * bw;
        if (m === null) { this.text('gas', x + bw / 2, Y(0) - 8, C.faint, 7, 'center'); }
        else { const d = s - m; c.fillStyle = Math.abs(d) < 0.15 ? C.green : d > 0 ? C.accent : C.red; c.fillRect(x + 1.5, Math.min(Y(0), Y(d)), bw - 3, Math.abs(Y(d) - Y(0))); }
        this.text(sym, x + bw / 2, y1 + 9, i === this.hover ? '#fff' : C.dim, 7, 'center');
      });
      this.text('volatiles (C, N, O…) deficient in meteorites · Li deficient in the Sun · refractories agree to ±0.1', (x0 + x1) / 2, y1 - 8, C.dim, 8, 'center');
    } else {
      const Y = (le: number) => y1 - 6 - (le + 0.5) / 13 * (y1 - y0 - 12);
      for (let le = 0; le <= 12; le += 2) { this.line(x0, Y(le), x1, Y(le), hexA(C.grid, 0.9)); this.text(`${le}`, x0 - 4, Y(le), C.dim, 8, 'right'); }
      this.text('log ε = log(N/N_H) + 12', x0 + 6, y0 + 10, C.dim, 9);
      ABUND.forEach(([sym, , s, m], i) => {
        const x = x0 + i * bw;
        const col = sym === 'H' || sym === 'He' ? C.sun : s > 7 ? C.accent : C.blue;
        c.fillStyle = i === this.hover ? '#fff' : hexA(col, 0.85); c.fillRect(x + 1.5, Y(s), bw * (this.view === 'both' ? 0.5 : 1) - 2, y1 - 6 - Y(s));
        if (this.view === 'both' && m !== null) { c.fillStyle = hexA(C.green, 0.85); c.fillRect(x + bw * 0.5, Y(m), bw * 0.5 - 1.5, y1 - 6 - Y(m)); }
        this.text(sym, x + bw / 2, y1 + 9, i === this.hover ? '#fff' : C.dim, 7, 'center');
      });
      this.text('photosphere', x1 - 8, y0 + 12, C.accent, 9, 'right');
      if (this.view === 'both') this.text('CI chondrites', x1 - 8, y0 + 24, C.green, 9, 'right');
    }
    // mass fractions
    let mH = 0, mHe = 0, mZ = 0;
    for (const [sym, A, le] of ABUND) { const mass = A * 10 ** (le - 12); if (sym === 'H') mH += mass; else if (sym === 'He') mHe += mass; else mZ += mass; }
    const tot = mH + mHe + mZ;
    const hv = this.hover >= 0 ? ABUND[this.hover] : null;
    this.setReadout([
      ['X, Y (mass)', `${fmt(mH / tot, 3)}, ${fmt(mHe / tot, 3)}`, C.sun],
      ['Z (metals)', fmt(mZ / tot, 4), C.accent],
      ['Selected', hv ? `${hv[0]}: Sun ${fmt(hv[2], 2)}` + (hv[3] !== null ? `, CI ${fmt(hv[3], 2)}` : ', CI —') : '—', hv ? '#fff' : C.dim],
      ['Atoms per 10⁶ H', hv ? sci(10 ** (hv[2] - 12) * 1e6, 2) : '—'],
    ]);
  }
}

/* ==================================================== Chapter 10 widgets ==== */

/** coarse standard solar model: r/R☉, T (K), ρ (kg m⁻³), M_r/M☉, L_r/L☉, X, κ̄ (m² kg⁻¹) */
const SSM: Array<[number, number, number, number, number, number, number]> = [
  [0.00, 1.57e7, 1.50e5, 0.000, 0.000, 0.34, 0.12],
  [0.05, 1.52e7, 1.30e5, 0.009, 0.080, 0.40, 0.13],
  [0.10, 1.34e7, 9.00e4, 0.070, 0.420, 0.50, 0.15],
  [0.15, 1.16e7, 5.60e4, 0.190, 0.750, 0.62, 0.19],
  [0.20, 9.90e6, 3.50e4, 0.340, 0.920, 0.68, 0.25],
  [0.25, 8.40e6, 2.10e4, 0.490, 0.980, 0.70, 0.32],
  [0.30, 7.10e6, 1.20e4, 0.610, 0.995, 0.71, 0.40],
  [0.40, 5.30e6, 4.00e3, 0.800, 1.000, 0.71, 0.65],
  [0.50, 3.90e6, 1.30e3, 0.900, 1.000, 0.71, 1.00],
  [0.60, 2.90e6, 4.00e2, 0.955, 1.000, 0.71, 1.60],
  [0.70, 2.25e6, 1.50e2, 0.980, 1.000, 0.71, 2.60],
  [0.75, 1.80e6, 8.00e1, 0.988, 1.000, 0.71, 6.0],
  [0.80, 1.30e6, 3.50e1, 0.993, 1.000, 0.71, 20],
  [0.90, 6.00e5, 5.00e0, 0.999, 1.000, 0.71, 150],
  [0.95, 3.00e5, 1.00e0, 0.9998, 1.000, 0.71, 400],
  [0.99, 5.00e4, 5.00e-2, 1.000, 1.000, 0.73, 600],
  [1.00, 5.77e3, 2.00e-4, 1.000, 1.000, 0.74, 0.05],
];
const SSM_RCZ = 0.713;
function ssmAt(x: number): { T: number; rho: number; M: number; L: number; X: number; kap: number; mu: number; P: number } {
  x = Math.min(1, Math.max(0, x));
  let i = 0; while (i < SSM.length - 2 && SSM[i + 1][0] <= x) i++;
  const a = SSM[i], b = SSM[i + 1];
  const f = (x - a[0]) / (b[0] - a[0]);
  const lin = (k: number) => a[k] + f * (b[k] - a[k]);
  const lg = (k: number) => 10 ** (Math.log10(a[k]) + f * (Math.log10(b[k]) - Math.log10(a[k])));
  const T = lg(1), rho = lg(2), M = lin(3), L = lin(4), X = lin(5), kap = lg(6);
  const Y = 0.98 - X;
  const mu = 1 / (2 * X + 0.75 * Y + 0.5 * 0.02);
  const P = rho * K_B * T / (mu * M_H);
  return { T, rho, M, L, X, kap, mu, P };
}
const A_RAD = 4 * SIGMA_SB / C_LIGHT;
const MJUP = 1.898e27, RJUP = 7.1492e7;
const GAMMA_AD = 5 / 3;

/* ------------------------------------------------ 10.1a hydrostatic shell ---- */

class HydrostaticWidget extends CanvasWidget {
  private x = 0.3;
  constructor() {
    super(1.8);
    this.slider('Shell radius r / R☉', 0.01, 0.99, 0.01, this.x, (v) => fmt(v, 2), (v) => { this.x = v; });
  }
  protected draw() {
    const c = this.ctx, w = this.w, h = this.h;
    const x = this.x;
    const m = ssmAt(x);
    const r = x * RSUN;
    const g = GRAV * m.M * MSUN / (r * r);
    const dPdr = -g * m.rho;
    // left: star cross-section
    const cx = w * 0.22, cy = h * 0.5, R = Math.min(w * 0.19, h * 0.42);
    const grad = c.createRadialGradient(cx, cy, 0, cx, cy, R);
    for (let k = 0; k <= 10; k++) { const T = ssmAt(k / 10).T; grad.addColorStop(k / 10, rgba(tempRGB(2300 + 4400 * Math.sqrt(T / 1.57e7)), 0.95)); }
    c.fillStyle = grad; c.beginPath(); c.arc(cx, cy, R, 0, TAU); c.fill();
    this.circle(cx, cy, R * SSM_RCZ, hexA('#fff', 0.25), undefined, 1, [3, 3]);
    this.circle(cx, cy, R * x, '#fff', undefined, 2);
    this.circle(cx, cy, R * (x + 0.03), hexA('#fff', 0.5), undefined, 1);
    this.text('shell', cx + R * x * 0.71 + 6, cy - R * x * 0.71 - 6, '#fff', 9);
    this.text('convection zone →', cx + R * 0.75, cy + R * 0.75, hexA('#fff', 0.5), 8);
    // middle: force diagram on the shell element
    const fx = w * 0.5, fy = h * 0.5;
    const Fg = g * m.rho, Fb = m.P / (0.05 * RSUN), Fa = (m.P + dPdr * 0.05 * RSUN) / (0.05 * RSUN);  // per volume over a 0.05 R☉ slab
    const sc = 60 / Math.max(Fb, 1e-30);
    c.fillStyle = hexA(C.accent, 0.5); c.fillRect(fx - 28, fy - 14, 56, 28); c.strokeStyle = C.accent; c.strokeRect(fx - 28, fy - 14, 56, 28);
    // arrows point AT the slab from outside it: tip = yTip, tail = yTip ∓ len
    const arrow = (x0: number, yTip: number, len: number, col: string, lab: string, side: number) => {
      const d = Math.sign(len);                 // +1: pushes up (tail below), −1: pushes down (tail above)
      const yTail = yTip + d * Math.abs(len);
      this.line(x0, yTail, x0, yTip, col, 2.5);
      this.line(x0, yTip, x0 - 4, yTip + d * 7, col, 2.5); this.line(x0, yTip, x0 + 4, yTip + d * 7, col, 2.5);
      this.text(lab, x0 + side * 8, (yTip + yTail) / 2, col, 9, side > 0 ? 'left' : 'right');
    };
    arrow(fx, fy + 14 + 2, Math.max(8, Fb * sc), C.green, 'P below ↑', -1);
    arrow(fx + 12, fy - 14 - 2, -Math.max(8, Fa * sc), C.red, 'P above ↓', 1);
    arrow(fx - 12, fy - 14 - 2, -Math.max(6, Fg * sc), C.blue, 'gravity ↓', -1);
    this.text('net force = 0', fx, fy + 14 + 2 + Math.max(8, Fb * sc) + 14, C.dim, 9, 'center');
    this.text('forces per unit volume', fx, fy - 100, C.dim, 8, 'center');
    this.text('on a 0.05 R☉ slab', fx, fy - 90, C.dim, 8, 'center');
    // right: P(r)
    const x0 = w * 0.66, x1 = w - 12, y0 = 14, y1 = h - 30;
    axesBox(c, x0, y0, x1, y1);
    const X = (xx: number) => x0 + xx * (x1 - x0);
    const Y = (P: number) => y1 - 6 - (Math.log10(Math.max(P, 1e4)) - 4) / 12.5 * (y1 - y0 - 12);
    c.beginPath(); for (let xx = 0; xx <= 1; xx += 0.01) { const px = X(xx), py = Y(ssmAt(xx).P); xx === 0 ? c.moveTo(px, py) : c.lineTo(px, py); } c.strokeStyle = C.sun; c.lineWidth = 2; c.stroke();
    this.circle(X(x), Y(m.P), 4, '#fff', C.sun);
    this.text('log P (Pa)', x1 - 4, y0 + 10, C.dim, 9, 'right');
    for (const lp of [6, 10, 14]) { this.line(x0, Y(10 ** lp), x1, Y(10 ** lp), hexA(C.grid, 0.9)); this.text(`${lp}`, x0 - 3, Y(10 ** lp), C.dim, 8, 'right'); }
    this.text('0', X(0), y1 + 10, C.dim, 8, 'center'); this.text('r / R☉', (x0 + x1) / 2, y1 + 10, C.dim, 9, 'center'); this.text('1', X(1), y1 + 10, C.dim, 8, 'center');
    this.line(X(SSM_RCZ), y0, X(SSM_RCZ), y1, hexA(C.text, 0.25), 1, [2, 3]);
    const tff = Math.sqrt(RSUN ** 3 / (GRAV * MSUN));
    this.setReadout([
      ['r, M_r', `${fmt(x, 2)} R☉, ${fmt(m.M, 3)} M☉`],
      ['P, ρ', `${sci(m.P, 2)} Pa, ${sci(m.rho, 1)}`],
      ['g = GM_r/r²', `${fmt(g, 0)} m/s²`, C.blue],
      ['dP/dr = −ρg', `${sci(dPdr, 2)} Pa/m`, C.sun],
    ]);
    this.text(`free-fall time if pressure vanished: ${fmt(tff / 60, 0)} min`, w * 0.5, h - 10, C.dim, 9, 'center');
  }
}

/* ------------------------------------------------ 10.1b central pressure ---- */

const PC_BODIES: Array<[string, number, number, number, string]> = [   // name, M (kg), R (m), model P_c (Pa), colour
  ['Sun', MSUN, RSUN, 2.3e16, C.sun],
  ['Proxima Cen', 0.12 * MSUN, 0.15 * RSUN, 2e17, C.red],
  ['Spica A', 11 * MSUN, 7.5 * RSUN, 2e15, C.blue],
  ['Sirius B', 1.0 * MSUN, 0.0084 * RSUN, 4e23, C.star],
  ['Jupiter', MJUP, RJUP, 4e12, C.accent],
  ['Saturn', 5.683e26, 5.8232e7, 1.5e12, C.venus],
  ['Earth', MEARTH, REARTH, 3.6e11, C.earth],
  ['Moon', 7.342e22, 1.7374e6, 5e9, C.dim],
];
class CentralPressureWidget extends CanvasWidget {
  private sel = 0;
  private lM = 0; private lR = 0;
  constructor() {
    super(1.8);
    this.segmented(PC_BODIES.map((b, i) => [String(i), b[0]] as [string, string]), '0', (v) => { this.sel = +v; const b = PC_BODIES[this.sel]; this.lM = Math.log10(b[1] / MSUN); this.lR = Math.log10(b[2] / RSUN); this.sM.set(this.lM); this.sR.set(this.lR); });
    this.sM = this.slider('Mass', -8, 2.5, 0.05, this.lM, (v) => `${sci(10 ** v, 1)} M☉`, (v) => { this.lM = v; this.sel = -1; });
    this.sR = this.slider('Radius', -3, 3, 0.05, this.lR, (v) => `${sci(10 ** v, 1)} R☉`, (v) => { this.lR = v; this.sel = -1; });
  }
  private sM: ReturnType<CanvasWidget['slider']>;
  private sR: ReturnType<CanvasWidget['slider']>;
  protected draw() {
    const c = this.ctx, w = this.w, h = this.h;
    const M = 10 ** this.lM * MSUN, R = 10 ** this.lR * RSUN;
    const crude = 3 * GRAV * M * M / (4 * Math.PI * R ** 4);
    const rhoBar = M / (4 / 3 * Math.PI * R ** 3);
    const x0 = 50, x1 = w - 12, y0 = 14, y1 = h - 30;
    axesBox(c, x0, y0, x1, y1);
    const lp0 = 8, lp1 = 25;
    const Y = (P: number) => y1 - 6 - (Math.log10(P) - lp0) / (lp1 - lp0) * (y1 - y0 - 12);
    for (let lp = 10; lp <= 24; lp += 2) { this.line(x0, Y(10 ** lp), x1, Y(10 ** lp), hexA(C.grid, 0.9)); this.text(`10${sup(lp)}`, x0 - 4, Y(10 ** lp), C.dim, 8, 'right'); }
    this.text('central pressure (Pa)', x0 + 6, y0 + 10, C.dim, 9);
    const n = PC_BODIES.length + 1, bw = (x1 - x0 - 20) / n;
    PC_BODIES.forEach(([name, m, r, pm, col], i) => {
      const bx = x0 + 10 + i * bw;
      const cr = 3 * GRAV * m * m / (4 * Math.PI * r ** 4);
      c.fillStyle = hexA(col, this.sel === i ? 0.95 : 0.45); c.fillRect(bx + 4, Y(cr), bw * 0.4 - 4, y1 - 6 - Y(cr));
      c.fillStyle = hexA(col, this.sel === i ? 0.95 : 0.6); c.fillRect(bx + bw * 0.45, Y(pm), bw * 0.4 - 4, y1 - 6 - Y(pm));
      c.strokeStyle = hexA('#fff', 0.5); c.strokeRect(bx + bw * 0.45, Y(pm), bw * 0.4 - 4, y1 - 6 - Y(pm));
      this.text(name, bx + bw / 2, y1 + 10, this.sel === i ? C.text : C.dim, 8, 'center');
      this.text(`×${fmt(pm / cr, 0)}`, bx + bw / 2, Y(pm) - 8, col, 8, 'center');
    });
    // custom bar
    const bx = x0 + 10 + PC_BODIES.length * bw;
    c.fillStyle = hexA('#fff', 0.7); c.fillRect(bx + bw * 0.2, Y(crude), bw * 0.5, y1 - 6 - Y(crude));
    this.text('yours', bx + bw / 2, y1 + 10, C.text, 8, 'center');
    this.text('faint bar: crude 3GM²/4πR⁴ · outlined bar: real model', x0 + 6, y0 + 22, C.dim, 8);
    this.text('×N = central-condensation factor (model / crude)', x0 + 6, y0 + 32, C.dim, 8);
    const sel = this.sel >= 0 ? PC_BODIES[this.sel] : null;
    this.setReadout([
      ['M, R', `${sci(M / MSUN, 2)} M☉, ${sci(R / RSUN, 2)} R☉`],
      ['Mean density', `${sci(rhoBar, 2)} kg/m³`],
      ['Crude P_c', `${sci(crude, 2)} Pa`, '#fff'],
      ['Model P_c', sel ? `${sci(sel[3], 1)} Pa` : '—', sel ? sel[4] : C.dim],
    ]);
  }
}

/* ---------------------------------------------------- 10.1c mass shells ---- */

type ShellProfile = 'uniform' | 'linear' | 'sun' | 'earth';
const PREM: Array<[number, number]> = [[0, 13090], [0.19, 12170], [0.191, 12170], [0.545, 9900], [0.546, 5570], [0.7, 5000], [0.895, 4400], [0.896, 3400], [0.99, 3380], [0.995, 2900], [1, 2600]];
class MassShellsWidget extends CanvasWidget {
  private prof: ShellProfile = 'sun';
  private x = 0.5;
  constructor() {
    super(1.8);
    this.segmented<ShellProfile>([['uniform', 'Uniform'], ['linear', 'Linear fall'], ['sun', 'Sun (model)'], ['earth', 'Earth (seismology)']], this.prof, (v) => { this.prof = v; });
    this.slider('Radius r / R', 0.02, 1, 0.01, this.x, (v) => fmt(v, 2), (v) => { this.x = v; });
  }
  private rho(x: number): number {   // relative to mean
    switch (this.prof) {
      case 'uniform': return 1;
      case 'linear': return 4 * (1 - x);
      case 'sun': return ssmAt(x).rho / 1408;
      case 'earth': { for (let i = 0; i < PREM.length - 1; i++) { if (x >= PREM[i][0] && x <= PREM[i + 1][0]) { const f = (x - PREM[i][0]) / Math.max(1e-6, PREM[i + 1][0] - PREM[i][0]); return (PREM[i][1] + f * (PREM[i + 1][1] - PREM[i][1])) / 5514; } } return 0.5; }
    }
  }
  protected draw() {
    const c = this.ctx, w = this.w, h = this.h;
    const N = 400; const Mr: number[] = [0]; let acc = 0;
    for (let i = 1; i <= N; i++) { const xx = i / N; acc += 3 * xx * xx * this.rho(xx - 0.5 / N) / N; Mr.push(acc); }
    const Mtot = Mr[N];
    const M = (x: number) => Mr[Math.min(N, Math.round(x * N))] / Mtot;
    const g = (x: number) => (x > 0 ? M(x) / (x * x) : 0);
    let gmax = 0; for (let i = 1; i <= N; i++) gmax = Math.max(gmax, g(i / N));
    let half = 1; for (let i = 1; i <= N; i++) if (M(i / N) >= 0.5) { half = i / N; break; }
    // left: shells
    const cx = w * 0.24, cy = h * 0.5, R = Math.min(w * 0.21, h * 0.43);
    const rmax = Math.max(...Array.from({ length: 50 }, (_, i) => this.rho((i + 0.5) / 50)));
    for (let i = 40; i >= 1; i--) { const xx = i / 40; const d = this.rho(xx - 0.0125) / rmax; c.fillStyle = rgba([255, 200 + 40 * (1 - d), 120 + 100 * (1 - d)], 0.15 + 0.85 * d ** 0.5); c.beginPath(); c.arc(cx, cy, R * xx, 0, TAU); c.fill(); }
    this.circle(cx, cy, R * this.x, '#fff', undefined, 2);
    this.circle(cx, cy, R * half, hexA(C.green, 0.8), undefined, 1, [3, 3]);
    this.text('half-mass radius', cx, cy + R + 14, C.green, 9, 'center');
    // right: M_r and g
    const x0 = w * 0.54, x1 = w - 12, y0 = 14, y1 = h - 30;
    axesBox(c, x0, y0, x1, y1);
    const X = (xx: number) => x0 + xx * (x1 - x0);
    const Y = (v: number) => y1 - 6 - v * (y1 - y0 - 12);
    c.beginPath(); for (let i = 0; i <= N; i += 2) { const px = X(i / N), py = Y(M(i / N)); i === 0 ? c.moveTo(px, py) : c.lineTo(px, py); } c.strokeStyle = C.sun; c.lineWidth = 2; c.stroke();
    c.beginPath(); for (let i = 1; i <= N; i += 2) { const px = X(i / N), py = Y(g(i / N) / gmax); i === 1 ? c.moveTo(px, py) : c.lineTo(px, py); } c.strokeStyle = C.blue; c.lineWidth = 1.5; c.stroke();
    c.beginPath(); for (let i = 1; i <= N; i += 2) { const px = X(i / N), py = Y(this.rho(i / N) / rmax); i === 1 ? c.moveTo(px, py) : c.lineTo(px, py); } c.strokeStyle = hexA(C.text, 0.5); c.lineWidth = 1; c.setLineDash([3, 3]); c.stroke(); c.setLineDash([]);
    this.line(X(this.x), y0, X(this.x), y1, hexA('#fff', 0.4), 1, [2, 3]);
    this.circle(X(this.x), Y(M(this.x)), 4, '#fff', C.sun);
    this.text('M_r / M', x1 - 6, y0 + 12, C.sun, 9, 'right'); this.text('g / g_max', x1 - 6, y0 + 24, C.blue, 9, 'right'); this.text('ρ / ρ_max', x1 - 6, y0 + 36, C.dim, 9, 'right');
    this.text('0', X(0), y1 + 10, C.dim, 8, 'center'); this.text('r / R', (x0 + x1) / 2, y1 + 10, C.dim, 9, 'center'); this.text('1', X(1), y1 + 10, C.dim, 8, 'center');
    this.setReadout([
      ['r / R', fmt(this.x, 2)],
      ['ρ(r) / ρ̄', fmt(this.rho(this.x), 2)],
      ['M_r / M', fmt(M(this.x), 3), C.sun],
      ['Half the mass inside', `${fmt(half, 2)} R`, C.green],
    ]);
  }
}

/* ---------------------------------------------- 10.2a mean molecular weight ---- */

class MeanMolecularWidget extends CanvasWidget {
  private X = 0.70; private Y = 0.28;
  private ion = true;
  private sY: ReturnType<CanvasWidget['slider']> | null = null;
  constructor() {
    super(1.9);
    this.segmented<'ion' | 'neu'>([['ion', 'Fully ionised'], ['neu', 'Neutral']], 'ion', (v) => { this.ion = v === 'ion'; });
    this.slider('Hydrogen X', 0, 1, 0.01, this.X, (v) => fmt(v, 2), (v) => { this.X = v; if (this.X + this.Y > 1) { this.Y = 1 - this.X; this.sY?.set(this.Y); } });
    this.sY = this.slider('Helium Y', 0, 1, 0.01, this.Y, (v) => fmt(v, 2), (v) => { this.Y = Math.min(v, 1 - this.X); this.sY?.set(this.Y); });
  }
  protected draw() {
    const c = this.ctx, w = this.w, h = this.h;
    const X = this.X, Y = this.Y, Z = Math.max(0, 1 - X - Y);
    const muI = 1 / (2 * X + 0.75 * Y + 0.5 * Z), muN = 1 / (X + 0.25 * Y + Z / 16), muE = 1 / (X + 0.5 * Y + 0.5 * Z);
    const mu = this.ion ? muI : muN;
    const rho = 1.5e5, T = 1.57e7;
    const P = rho * K_B * T / (mu * M_H), n = rho / (mu * M_H);
    // particle box: 1 kg scaled → counts proportional to 1/μ contributions
    const bx = 14, by = 14, bw = w * 0.5, bh = h - 44;
    c.fillStyle = hexA(C.grid, 0.5); c.fillRect(bx, by, bw, bh); c.strokeStyle = C.line; c.strokeRect(bx, by, bw, bh);
    const rnd = mulberry(3);
    const nH = Math.round(X * 60), nHe = Math.round(Y * 15), nZ = Math.round(Z * 20);
    const dot = (col: string, r: number) => { const x = bx + 6 + rnd() * (bw - 12), y = by + 6 + rnd() * (bh - 12); this.circle(x, y, r, undefined, col); return [x, y]; };
    for (let i = 0; i < nH; i++) { const [x, y] = dot(C.red, 3); if (this.ion) this.circle(x + 6 + rnd() * 4, y - 4 + rnd() * 8, 1.5, undefined, C.blue); }
    for (let i = 0; i < nHe; i++) { const [x, y] = dot(C.accent, 4.5); if (this.ion) for (let k = 0; k < 2; k++) this.circle(x + 7 + rnd() * 5, y - 6 + rnd() * 12, 1.5, undefined, C.blue); }
    for (let i = 0; i < nZ; i++) { const [x, y] = dot(C.green, 6); if (this.ion) for (let k = 0; k < 4; k++) this.circle(x + 9 + rnd() * 6, y - 8 + rnd() * 16, 1.5, undefined, C.blue); }
    this.text(`1 kg: ${this.ion ? 'nuclei + free electrons' : 'neutral atoms'}`, bx + 6, by + bh - 10, C.dim, 9);
    this.text('H', bx + 6, by + 10, C.red, 9); this.text('He', bx + 22, by + 10, C.accent, 9); this.text('metals', bx + 42, by + 10, C.green, 9); if (this.ion) this.text('e⁻', bx + 82, by + 10, C.blue, 9);
    // μ scale
    const sx0 = w * 0.58, sx1 = w - 14, sy = h * 0.4;
    this.line(sx0, sy, sx1, sy, C.line, 2);
    const Xm = (m: number) => sx0 + (m - 0.4) / 1.6 * (sx1 - sx0);
    // tick labels alternate above / below the scale so they never collide
    for (const [m, lab, col, up] of [[0.5, 'ionised H', C.red, 1], [0.62, 'Sun core', C.sun, 0], [1.0, 'neutral H', C.dim, 1], [1.33, 'ionised He', C.accent, 0]] as Array<[number, string, string, number]>) { this.line(Xm(m), sy - 5, Xm(m), sy + 5, col); this.text(lab, Xm(m), up ? sy - 12 : sy + 16, col, 8, 'center'); }
    this.circle(Xm(mu), sy, 6, '#fff', C.star);
    this.text(`μ = ${fmt(mu, 3)}`, sx0, sy - 34, C.star, 12);
    this.text('0.4', sx0, sy + 28, C.dim, 8, 'center'); this.text('2.0', sx1, sy + 28, C.dim, 8, 'center');
    // pressure bar relative to solar
    const Pref = rho * K_B * T / (0.62 * M_H);
    const py = h * 0.7;
    this.text('P at solar-centre ρ, T', sx0, py - 24, C.dim, 9); this.text('relative to μ = 0.62:', sx0, py - 13, C.dim, 9);
    c.fillStyle = hexA(C.grid, 1); c.fillRect(sx0, py, sx1 - sx0, 14);
    c.fillStyle = C.sun; c.fillRect(sx0, py, (sx1 - sx0) * Math.min(1, P / Pref / 1.3), 14);
    this.text(`${fmt(P / Pref, 2)} ×`, sx1 - 4, py + 7, '#000', 9, 'right');
    this.setReadout([
      ['X, Y, Z', `${fmt(X, 2)}, ${fmt(Y, 2)}, ${fmt(Z, 2)}`],
      ['μ (ionised / neutral)', `${fmt(muI, 3)} / ${fmt(muN, 2)}`, C.star],
      ['μ_e, n per m³', `${fmt(muE, 2)}, ${sci(n, 2)}`],
      ['P at solar centre', `${sci(P, 2)} Pa`, C.sun],
    ]);
  }
}

/* ---------------------------------------------------- 10.2b pressure mix ---- */

const HBAR = 1.054571817e-34;
function pDeg(rho: number, muE = 2): number {
  const n = rho / (muE * M_H);
  const nr = (3 * Math.PI * Math.PI) ** (2 / 3) / 5 * HBAR * HBAR / M_E * n ** (5 / 3);
  const ur = (3 * Math.PI * Math.PI) ** (1 / 3) / 4 * HBAR * C_LIGHT * n ** (4 / 3);
  return Math.min(nr, ur);
}
class PressureMixWidget extends CanvasWidget {
  private lT = Math.log10(1.57e7);
  private lRho = Math.log10(1.5e5);
  private mu = 0.62;
  constructor() {
    super(1.7);
    this.slider('Temperature', 3.5, 9, 0.05, this.lT, (v) => `${sci(10 ** v, 1)} K`, (v) => { this.lT = v; });
    this.slider('Probe density', -8, 12, 0.1, this.lRho, (v) => `${sci(10 ** v, 1)} kg/m³`, (v) => { this.lRho = v; });
    this.slider('μ (gas)', 0.5, 2, 0.01, this.mu, (v) => fmt(v, 2), (v) => { this.mu = v; });
  }
  protected draw() {
    const c = this.ctx, w = this.w, h = this.h;
    const T = 10 ** this.lT;
    const x0 = 50, x1 = w - 12, y0 = 14, y1 = h - 30;
    axesBox(c, x0, y0, x1, y1);
    const lr0 = -8, lr1 = 12, lp0 = 0, lp1 = 30;
    const X = (lr: number) => x0 + (lr - lr0) / (lr1 - lr0) * (x1 - x0);
    const Y = (P: number) => y1 - 6 - (Math.min(lp1, Math.max(lp0, Math.log10(Math.max(P, 1e-30)))) - lp0) / (lp1 - lp0) * (y1 - y0 - 12);
    for (let lp = 0; lp <= 30; lp += 5) { this.line(x0, Y(10 ** lp), x1, Y(10 ** lp), hexA(C.grid, 0.9)); this.text(`10${sup(lp)}`, x0 - 4, Y(10 ** lp), C.dim, 8, 'right'); }
    for (let lr = -8; lr <= 12; lr += 4) { this.line(X(lr), y1, X(lr), y1 + 3, C.dim); this.text(`10${sup(lr)}`, X(lr), y1 + 11, C.dim, 8, 'center'); }
    this.text('ρ (kg m⁻³)', x1, y1 + 22, C.dim, 9, 'right'); this.text('P (Pa)', x0 + 4, y0 + 10, C.dim, 9);
    const Pg = (rho: number) => rho * K_B * T / (this.mu * M_H);
    const Pr = A_RAD * T ** 4 / 3;
    const curve = (f: (rho: number) => number, col: string, wd: number, dash?: number[]) => { c.beginPath(); for (let lr = lr0; lr <= lr1; lr += 0.1) { const px = X(lr), py = Y(f(10 ** lr)); lr === lr0 ? c.moveTo(px, py) : c.lineTo(px, py); } c.strokeStyle = col; c.lineWidth = wd; c.setLineDash(dash ?? []); c.stroke(); c.setLineDash([]); };
    curve(Pg, C.sun, 1.5, [5, 3]);
    curve(() => Pr, C.purple, 1.5, [5, 3]);
    curve((rho) => pDeg(rho), C.blue, 1.5, [5, 3]);
    curve((rho) => Pg(rho) + Pr + pDeg(rho), C.star, 2.2);
    this.text('ideal gas ∝ ρT', X(-3), Y(Pg(1e-3)) - 10, C.sun, 9);
    this.text('radiation aT⁴/3', X(-7.5), Y(Pr) - 8, C.purple, 9);
    this.text('degenerate e⁻ ∝ ρ^5/3 (→ ρ^4/3)', X(5), Y(pDeg(1e5)) + 14, C.blue, 9);
    // objects: [label, ρ, T, colour, dx, dy, align] — offsets chosen so labels do not collide
    const objs: Array<[string, number, number, string, number, number, CanvasTextAlign]> = [
      ['Sun centre', 1.5e5, 1.57e7, C.sun, 6, -8, 'left'], ['Sirius B centre', 3e10, 2.5e7, C.star, -6, 4, 'right'],
      ['Jupiter centre', 2e4, 2e4, C.accent, 4, 13, 'left'], ['60 M☉ star centre', 2e3, 4e7, C.purple, -6, 2, 'right'],
      ['supergiant envelope', 1e-6, 1e5, C.red, 4, 13, 'left'], ['neutron-star crust', 1e12, 1e8, C.blue, -6, 14, 'right'],
    ];
    for (const [lab, rho, To, col, dx, dy, al] of objs) { const Pt = rho * K_B * To / (0.62 * M_H) + A_RAD * To ** 4 / 3 + pDeg(rho); this.circle(X(Math.log10(rho)), Y(Pt), 3, col); this.text(lab, X(Math.log10(rho)) + dx, Y(Pt) + dy, col, 8, al); }
    // probe
    const rho = 10 ** this.lRho;
    const pg = Pg(rho), pd = pDeg(rho), tot = pg + Pr + pd;
    this.line(X(this.lRho), y0, X(this.lRho), y1, hexA('#fff', 0.35), 1, [2, 3]);
    this.circle(X(this.lRho), Y(tot), 5, '#fff', C.star);
    const dom = pg >= Pr && pg >= pd ? 'ideal gas' : Pr >= pd ? 'radiation' : 'degenerate electrons';
    this.setReadout([
      ['P_gas / P_rad / P_deg', `${fmt(100 * pg / tot, 0)} / ${fmt(100 * Pr / tot, 0)} / ${fmt(100 * pd / tot, 0)} %`],
      ['Total P', `${sci(tot, 2)} Pa`, C.star],
      ['Dominant', dom, dom === 'ideal gas' ? C.sun : dom === 'radiation' ? C.purple : C.blue],
      ['Degenerate when T <', `${sci(1300 * (rho / 2) ** (2 / 3), 1)} K`],
    ]);
  }
}

/* -------------------------------------------------- 10.2c giant radius ---- */

const MR_OBJ: Array<[string, number, number, string, number, number, CanvasTextAlign]> = [   // name, M (M_Jup), R (R_Jup), colour, label dx, dy, align
  ['Mars', 0.000338, 0.0474, C.mars, 5, -7, 'left'], ['Venus', 0.00256, 0.0846, C.venus, -6, 4, 'right'], ['Earth', 0.00315, 0.0892, C.earth, 5, -7, 'left'],
  ['Uranus', 0.0457, 0.357, C.blue, -6, 11, 'right'], ['Neptune', 0.0540, 0.346, C.blue, 5, -7, 'left'],
  ['Saturn', 0.299, 0.843, C.venus, -6, 11, 'right'], ['Jupiter', 1, 1, C.accent, 6, 9, 'left'], ['HD 209458 b', 0.69, 1.38, C.red, 6, 3, 'left'], ['WASP-17 b', 0.49, 1.93, C.red, 5, -7, 'left'], ['Kepler-7 b', 0.43, 1.61, C.red, -6, 3, 'right'],
  ['Gliese 229 B', 40, 0.9, C.purple, -6, 12, 'right'], ['Teide 1', 55, 1.0, C.purple, 4, 12, 'left'], ['TRAPPIST-1', 94, 1.16, C.red, 5, 11, 'left'], ['Proxima Cen', 126, 1.5, C.red, 5, -7, 'left'], ['Sun', 1047, 9.73, C.sun, -6, 4, 'right'],
];
class GiantRadiusWidget extends CanvasWidget {
  private lM = 0;
  constructor() {
    super(1.8);
    this.slider('Mass', -3.5, 3.1, 0.02, this.lM, (v) => `${sci(10 ** v, 2)} M_Jup`, (v) => { this.lM = v; });
  }
  private rH(M: number): number { const x = M / 0.76; return 1.67 * x ** (1 / 3) / (1 + x ** (2 / 3)) ** 0.7; }
  private rRock(M: number): number { return 0.0892 * (M / 0.00315) ** 0.27; }
  private rMS(M: number): number { const Ms = M / 1047; return Ms < 0.08 ? 0 : 9.73 * (Ms < 1 ? Ms ** 0.8 : Ms ** 0.57); }
  protected draw() {
    const c = this.ctx, w = this.w, h = this.h;
    const x0 = 50, x1 = w - 12, y0 = 14, y1 = h - 30;
    axesBox(c, x0, y0, x1, y1);
    const lm0 = -3.6, lm1 = 3.2, lr0 = -1.5, lr1 = 1.2;
    const X = (lm: number) => x0 + (lm - lm0) / (lm1 - lm0) * (x1 - x0);
    const Y = (R: number) => y1 - 6 - (Math.log10(R) - lr0) / (lr1 - lr0) * (y1 - y0 - 12);
    for (const lr of [-1, 0, 1]) { this.line(x0, Y(10 ** lr), x1, Y(10 ** lr), hexA(C.grid, 0.9)); this.text(lr === 0 ? '1 R_Jup' : `10${sup(lr)}`, x0 - 4, Y(10 ** lr), C.dim, 8, 'right'); }
    for (const lm of [-3, -2, -1, 0, 1, 2, 3]) { this.line(X(lm), y1, X(lm), y1 + 3, C.dim); this.text(lm === 0 ? '1 M_Jup' : `10${sup(lm)}`, X(lm), y1 + 11, C.dim, 8, 'center'); }
    this.text('mass', x1, y1 + 22, C.dim, 9, 'right');
    const curve = (f: (M: number) => number, a: number, b: number, col: string, wd: number, dash?: number[]) => { c.beginPath(); let st = false; for (let lm = a; lm <= b; lm += 0.02) { const R = f(10 ** lm); if (R <= 0) continue; const px = X(lm), py = Y(R); st ? c.lineTo(px, py) : c.moveTo(px, py); st = true; } c.strokeStyle = col; c.lineWidth = wd; c.setLineDash(dash ?? []); c.stroke(); c.setLineDash([]); };
    curve((M) => this.rRock(M), lm0, 0.5, C.mars, 1.5, [4, 3]);
    curve((M) => this.rH(M), lm0, Math.log10(80), C.accent, 2.2);
    curve((M) => this.rMS(M), Math.log10(84), lm1, C.sun, 2);
    this.text('cold H/He: R ∝ M^⅓ then M^−⅓', X(-2.6), Y(this.rH(10 ** -2.6)) - 12, C.accent, 9);
    this.text('rock / iron', X(-2.8), Y(this.rRock(10 ** -2.8)) + 12, C.mars, 9);
    this.line(X(Math.log10(13)), y0, X(Math.log10(13)), y1, hexA(C.purple, 0.5), 1, [2, 3]); this.text('D burning ≥ 13 M_Jup', X(Math.log10(13)) - 4, y0 + 10, C.purple, 8, 'right');
    this.line(X(Math.log10(80)), y0, X(Math.log10(80)), y1, hexA(C.sun, 0.5), 1, [2, 3]); this.text('H burning', X(Math.log10(80)) + 3, y0 + 10, C.sun, 8); this.text('≥ 80 M_Jup', X(Math.log10(80)) + 3, y0 + 20, C.sun, 8);
    for (const [name, M, R, col, dx, dy, al] of MR_OBJ) { this.circle(X(Math.log10(M)), Y(R), 3, '#000', col); this.text(name, X(Math.log10(M)) + dx, Y(R) + dy, col, 8, al); }
    const M = 10 ** this.lM;
    const R = M < 84 ? this.rH(M) : this.rMS(M);
    this.circle(X(this.lM), Y(R), 5, '#fff', C.star);
    const rhoBar = M * MJUP / (4 / 3 * Math.PI * (R * RJUP) ** 3);
    this.setReadout([
      ['Mass', M < 0.01 ? `${fmt(M / 0.00315, 2)} M⊕` : M > 84 ? `${fmt(M / 1047, 3)} M☉` : `${fmt(M, 2)} M_Jup`],
      ['Radius (R_Jup, R⊕)', `${fmt(R, 2)}, ${fmt(R / 0.0892, 1)}`, C.star],
      ['Mean density', `${fmt(rhoBar, 0)} kg/m³`],
      ['Regime', M < 1 ? 'ordinary, R ∝ M^⅓' : M < 80 ? 'degenerate, R ≈ const' : 'star: thermal pressure'],
    ]);
  }
}

/* ---------------------------------------------- 10.3a Kelvin–Helmholtz time ---- */

const KH_PRESETS: Array<[string, number, number, number]> = [   // name, log M/M☉, log R/R☉, log L/L☉
  ['Sun', 0, 0, 0], ['Jupiter (excess heat)', Math.log10(9.55e-4), Math.log10(0.1028), Math.log10(3.3e17 / LSUN_W)], ['Saturn (excess heat)', Math.log10(2.86e-4), Math.log10(0.0837), Math.log10(1.6e17 / LSUN_W)],
  ['Sirius A', Math.log10(2.06), Math.log10(1.71), Math.log10(25.4)], ['Betelgeuse', Math.log10(17), Math.log10(900), Math.log10(1.2e5)], ['Proxima Cen', Math.log10(0.12), Math.log10(0.154), Math.log10(0.0017)],
];
class KhTimescaleWidget extends CanvasWidget {
  private lM = 0; private lR = 0; private lL = 0;
  private sl: Array<ReturnType<CanvasWidget['slider']>> = [];
  constructor() {
    super(1.9);
    this.segmented(KH_PRESETS.map((p, i) => [String(i), p[0]] as [string, string]), '0', (v) => { const p = KH_PRESETS[+v]; this.lM = p[1]; this.lR = p[2]; this.lL = p[3]; this.sl[0].set(this.lM); this.sl[1].set(this.lR); this.sl[2].set(this.lL); });
    this.sl.push(this.slider('Mass', -4, 2, 0.05, 0, (v) => `${sci(10 ** v, 1)} M☉`, (v) => { this.lM = v; }));
    this.sl.push(this.slider('Radius', -2, 3.5, 0.05, 0, (v) => `${sci(10 ** v, 1)} R☉`, (v) => { this.lR = v; }));
    this.sl.push(this.slider('Luminosity', -10, 6, 0.1, 0, (v) => `${sci(10 ** v, 1)} L☉`, (v) => { this.lL = v; }));
  }
  protected draw() {
    const w = this.w, h = this.h;
    const M = 10 ** this.lM * MSUN, R = 10 ** this.lR * RSUN, L = 10 ** this.lL * LSUN_W;
    const yr = 3.156e7;
    const tKH = GRAV * M * M / (2 * R * L) / yr;
    const tNuc = 0.007 * 0.1 * M * C_LIGHT ** 2 / L / yr;
    const tDyn = Math.sqrt(R ** 3 / (GRAV * M));
    // timeline
    const x0 = 20, x1 = w - 20, ty = h * 0.42;
    const lt0 = 2, lt1 = 14;
    const X = (t: number) => x0 + (Math.min(lt1, Math.max(lt0, Math.log10(t))) - lt0) / (lt1 - lt0) * (x1 - x0);
    this.line(x0, ty, x1, ty, C.line, 2);
    for (let lt = lt0; lt <= lt1; lt += 2) { this.line(X(10 ** lt), ty - 4, X(10 ** lt), ty + 4, C.dim); this.text(`10${sup(lt)} yr`, X(10 ** lt), ty + 16, C.dim, 8, 'center'); }
    const marks: Array<[number, string, string, number]> = [[5e3, 'recorded history', C.dim, -22], [6.6e7, 'end of dinosaurs', C.dim, -36], [4.54e9, 'age of Earth', C.earth, -50], [1.26e10, 'oldest clusters', C.dim, -64], [1.38e10, 'universe', C.purple, -78]];
    for (const [t, lab, col, dy] of marks) { this.line(X(t), ty, X(t), ty + dy, hexA(col, 0.6), 1, [2, 2]); this.text(lab, X(t), ty + dy - 6, col, 8, 'center'); }
    const flag = (t: number, lab: string, col: string, dy: number) => { this.line(X(t), ty, X(t), ty + dy, col, 2); this.circle(X(t), ty, 4, '#000', col); this.text(lab, X(t), ty + dy + (dy > 0 ? 10 : -8), col, 10, 'center'); };
    flag(tKH, `t_KH = ${fmtYr(tKH)}`, C.sun, 36);
    flag(tNuc, `t_nuc = ${fmtYr(tNuc)}`, C.green, 60);
    const verdict = tKH > 4.5e9 ? 'gravity alone could have powered it for the age of the solar system' : tKH > 1e8 ? 'gravity could power it for a geologically long time, but not the age of the Earth' : 'gravity could not power it for geological time: a nuclear source is required';
    this.text(verdict, w / 2, h - 28, tKH > 4.5e9 ? C.green : C.red, 10, 'center');
    this.text(`dynamical (free-fall) time: ${fmtDur(tDyn)} · t_KH / t_dyn = ${sci(tKH * yr / tDyn, 1)}`, w / 2, h - 12, C.dim, 9, 'center');
    this.setReadout([
      ['GM²/2R (available)', `${sci(GRAV * M * M / (2 * R), 2)} J`],
      ['t_KH = GM²/2RL', fmtYr(tKH), C.sun],
      ['t_nuc (0.07 % of Mc²)', fmtYr(tNuc), C.green],
      ['t_nuc / t_KH', sci(tNuc / tKH, 1)],
    ]);
  }
}

/* ------------------------------------------------ 10.3b binding energy ---- */

const BE: Array<[string, number, number]> = [   // symbol, A, B/A (MeV)
  ['²H', 2, 1.112], ['³H', 3, 2.827], ['³He', 3, 2.573], ['⁴He', 4, 7.074], ['⁶Li', 6, 5.332], ['⁷Li', 7, 5.606], ['⁹Be', 9, 6.463], ['¹⁰B', 10, 6.475], ['¹¹B', 11, 6.928],
  ['¹²C', 12, 7.680], ['¹³C', 13, 7.470], ['¹⁴N', 14, 7.476], ['¹⁶O', 16, 7.976], ['²⁰Ne', 20, 8.032], ['²⁴Mg', 24, 8.261], ['²⁸Si', 28, 8.448], ['³²S', 32, 8.493], ['⁴⁰Ca', 40, 8.551],
  ['⁴⁸Ti', 48, 8.723], ['⁵²Cr', 52, 8.776], ['⁵⁶Fe', 56, 8.790], ['⁵⁸Ni', 58, 8.732], ['⁶²Ni', 62, 8.795], ['⁶⁴Zn', 64, 8.736], ['⁸⁴Kr', 84, 8.717], ['¹⁰⁷Ag', 107, 8.554], ['¹²⁰Sn', 120, 8.505],
  ['¹⁵⁰Nd', 150, 8.250], ['¹⁹⁷Au', 197, 7.916], ['²⁰⁸Pb', 208, 7.867], ['²³⁵U', 235, 7.591], ['²³⁸U', 238, 7.570],
];
class BindingEnergyWidget extends CanvasWidget {
  private hover = -1;
  private step = 0;
  constructor() {
    super(1.8);
    this.segmented<'0' | '1' | '2' | '3'>([['0', '4 ¹H → ⁴He'], ['1', '3 ⁴He → ¹²C'], ['2', '¹²C → … → ⁵⁶Fe'], ['3', '²³⁵U fission']], '0', (v) => { this.step = +v; });
    this.canvas.addEventListener('pointermove', (e) => { const { x, y } = canvasPos(this.canvas, e, this.w, this.h); let best = -1, bd = 1e9; BE.forEach(([, A, b], i) => { const d = Math.hypot(this.X(A) - x, this.Y(b) - y); if (d < bd) { bd = d; best = i; } }); this.hover = bd < 18 ? best : -1; });
    this.canvas.addEventListener('pointerleave', () => { this.hover = -1; });
  }
  private X(A: number): number { return 46 + Math.log10(A) / Math.log10(260) * (this.w - 58); }
  private Y(b: number): number { return this.h - 36 - b / 9.5 * (this.h - 52); }
  protected draw() {
    const c = this.ctx, w = this.w, h = this.h;
    const x0 = 46, x1 = w - 12, y0 = 14, y1 = h - 30;
    axesBox(c, x0, y0, x1, y1);
    for (const b of [2, 4, 6, 8]) { this.line(x0, this.Y(b), x1, this.Y(b), hexA(C.grid, 0.9)); this.text(`${b}`, x0 - 4, this.Y(b), C.dim, 8, 'right'); }
    for (const A of [1, 2, 4, 8, 16, 32, 64, 128, 256]) { this.line(this.X(A), y1, this.X(A), y1 + 3, C.dim); this.text(`${A}`, this.X(A), y1 + 11, C.dim, 8, 'center'); }
    this.text('mass number A', x1, y1 + 22, C.dim, 9, 'right'); this.text('binding energy per nucleon (MeV)', x0 + 6, y0 + 10, C.dim, 9);
    c.beginPath(); BE.forEach(([, A, b], i) => { const px = this.X(A), py = this.Y(b); i === 0 ? c.moveTo(px, py) : c.lineTo(px, py); }); c.strokeStyle = hexA(C.star, 0.6); c.lineWidth = 1.2; c.stroke();
    BE.forEach(([sym, A, b], i) => { const hi = i === this.hover; this.circle(this.X(A), this.Y(b), hi ? 5 : 3, hi ? '#fff' : undefined, A === 4 || A === 12 || A === 16 || A === 56 ? C.sun : C.star); if (hi || ['⁴He', '¹²C', '¹⁶O', '⁵⁶Fe', '²³⁸U'].includes(sym)) this.text(sym, this.X(A), this.Y(b) - 10, hi ? '#fff' : C.dim, 9, 'center'); });
    this.circle(this.X(1), this.Y(0), 3, undefined, C.red); this.text('¹H', this.X(1) + 6, this.Y(0) - 6, C.red, 9);
    // highlighted step
    const steps: Array<[number, number, number, number, string]> = [[1, 0, 4, 7.074, 'H → He: 7.07 MeV per nucleon released (0.7 % of mass)'], [4, 7.074, 12, 7.680, 'He → C: 0.61 MeV per nucleon'], [12, 7.680, 56, 8.790, 'C → Fe: 1.11 MeV per nucleon, over several burning stages'], [235, 7.591, 118, 8.50, 'U → two fragments: 0.9 MeV per nucleon — fission releases energy too']];
    const [Aa, ba, Ab, bb, lab] = steps[this.step];
    this.line(this.X(Aa), this.Y(ba), this.X(Ab), this.Y(bb), C.green, 2.5);
    this.circle(this.X(Ab), this.Y(bb), 6, C.green, undefined, 2);
    this.text(lab, (x0 + x1) / 2, y1 - 12, C.green, 10, 'center');
    const hv = this.hover >= 0 ? BE[this.hover] : null;
    this.setReadout([
      ['Hovered nucleus', hv ? `${hv[0]} (A = ${hv[1]})` : '—', hv ? '#fff' : C.dim],
      ['B/A', hv ? `${fmt(hv[2], 3)} MeV` : '—'],
      ['Total binding', hv ? `${fmt(hv[1] * hv[2], 1)} MeV` : '—'],
      ['Step shown', `${fmt(bb - ba, 2)} MeV / nucleon`, C.green],
    ]);
  }
}

/* ------------------------------------------------------ 10.3c Gamow peak ---- */

const GAMOW_RX: Array<[string, number, number, number]> = [['p + p', 1, 1, 0.5], ['p + ¹²C (CNO)', 1, 6, 12 / 13], ['⁴He + ⁴He', 2, 2, 2], ['¹²C + ¹²C', 6, 6, 6]];
class GamowWidget extends CanvasWidget {
  private rx = 0;
  private lT = Math.log10(1.57e7);
  constructor() {
    super(1.8);
    this.segmented(GAMOW_RX.map((r, i) => [String(i), r[0]] as [string, string]), '0', (v) => { this.rx = +v; });
    this.slider('Temperature', 6.3, 9.3, 0.02, this.lT, (v) => `${sci(10 ** v, 2)} K`, (v) => { this.lT = v; });
  }
  protected draw() {
    const c = this.ctx, w = this.w, h = this.h;
    const [, Z1, Z2, mu] = GAMOW_RX[this.rx];
    const T = 10 ** this.lT;
    const kT = K_EV * T / 1000;                           // keV
    const b = 31.28 * Z1 * Z2 * Math.sqrt(mu);          // keV^1/2
    const E0 = (b * kT / 2) ** (2 / 3);
    const dE = 4 * Math.sqrt(E0 * kT / 3);
    const nu = (3 * E0 / kT - 2) / 3;
    const Emax = E0 + 3 * dE + 3 * kT;
    const x0 = 44, x1 = w - 12, y0 = 14, y1 = h - 30;
    axesBox(c, x0, y0, x1, y1);
    const X = (E: number) => x0 + E / Emax * (x1 - x0);
    const Y = (v: number) => y1 - 6 - v * (y1 - y0 - 12);
    const mb = (E: number) => Math.exp(-E / kT);
    const tun = (E: number) => Math.exp(-b / Math.sqrt(E));
    const prodMax = mb(E0) * tun(E0);
    const curve = (f: (E: number) => number, col: string, wd: number, dash?: number[]) => { c.beginPath(); for (let i = 1; i <= 300; i++) { const E = Emax * i / 300; const px = X(E), py = Y(Math.min(1, f(E))); i === 1 ? c.moveTo(px, py) : c.lineTo(px, py); } c.strokeStyle = col; c.lineWidth = wd; c.setLineDash(dash ?? []); c.stroke(); c.setLineDash([]); };
    curve(mb, C.red, 1.5, [4, 3]);
    curve((E) => tun(E) / tun(Emax), C.blue, 1.5, [4, 3]);
    c.beginPath(); c.moveTo(X(0), Y(0)); for (let i = 1; i <= 300; i++) { const E = Emax * i / 300; c.lineTo(X(E), Y(mb(E) * tun(E) / prodMax * 0.85)); } c.lineTo(X(Emax), Y(0)); c.closePath(); c.fillStyle = hexA(C.sun, 0.3); c.fill();
    curve((E) => mb(E) * tun(E) / prodMax * 0.85, C.sun, 2.2);
    this.line(X(E0), y0, X(E0), y1, hexA(C.sun, 0.5), 1, [2, 3]);
    this.text(`E₀ = ${fmt(E0, 1)} keV`, X(E0) + 4, y0 + 12, C.sun, 10);
    this.text(`width ${fmt(dE, 1)} keV`, X(E0) + 4, y0 + 24, C.sun, 9);
    this.line(X(kT), y1 - 14, X(kT), y1, C.red, 1); this.text(`kT = ${fmt(kT, 2)} keV`, X(kT) + 3, y1 - 10, C.red, 9);
    this.text('Maxwell–Boltzmann e^(−E/kT)', x1 - 8, y0 + 12, C.red, 9, 'right');
    this.text('tunnelling e^(−b/√E)', x1 - 8, y0 + 24, C.blue, 9, 'right');
    this.text('product: Gamow peak', x1 - 8, y0 + 36, C.sun, 9, 'right');
    this.text('energy (keV) →', x1, y1 + 12, C.dim, 9, 'right');
    const Ecoul = 1.44 * Z1 * Z2 / 1.4 * 1000;   // keV at 1.4 fm
    this.setReadout([
      ['Coulomb barrier', `${fmt(Ecoul / 1000, 2)} MeV = ${fmt(Ecoul / kT, 0)} kT`],
      ['Gamow peak E₀', `${fmt(E0, 1)} keV = ${fmt(E0 / kT, 1)} kT`, C.sun],
      ['Peak height e^(−3E₀/kT)', sci(Math.exp(-3 * E0 / kT), 1)],
      ['Rate ∝ T^ν, ν ≈', fmt(nu, 1), C.green],
    ]);
  }
}


/* ------------------------------------------------------- 10.3d pp chain ---- */

interface PpNode { id: string; x: number; y: number; lab: string; col: string }
interface PpEdge { from: string; to: string; lab: string; rate: number; branch: number }
const PP_NODES: PpNode[] = [
  { id: 'p1', x: 0.08, y: 0.25, lab: '¹H', col: C.red }, { id: 'p2', x: 0.08, y: 0.55, lab: '¹H', col: C.red },
  { id: 'd', x: 0.26, y: 0.4, lab: '²H', col: C.accent }, { id: 'he3', x: 0.44, y: 0.4, lab: '³He', col: C.sun },
  { id: 'he4', x: 0.86, y: 0.4, lab: '⁴He', col: C.green },
  { id: 'be7', x: 0.62, y: 0.68, lab: '⁷Be', col: C.purple }, { id: 'li7', x: 0.78, y: 0.82, lab: '⁷Li', col: C.purple }, { id: 'b8', x: 0.78, y: 0.56, lab: '⁸B', col: C.blue },
];
const PP_EDGES: PpEdge[] = [
  { from: 'p1', to: 'd', lab: 'p + p → d + e⁺ + ν (0.42 MeV ν)  ·  9 Gyr', rate: 0.15, branch: 0 },
  { from: 'p2', to: 'd', lab: '', rate: 0.15, branch: 0 },
  { from: 'd', to: 'he3', lab: 'd + p → ³He + γ  ·  1 s', rate: 1.2, branch: 0 },
  { from: 'he3', to: 'he4', lab: '³He + ³He → ⁴He + 2p  ·  10⁶ yr (PP I, 69 %)', rate: 0.5, branch: 1 },
  { from: 'he3', to: 'be7', lab: '³He + ⁴He → ⁷Be + γ (PP II/III, 31 %)', rate: 0.4, branch: 2 },
  { from: 'be7', to: 'li7', lab: '⁷Be + e⁻ → ⁷Li + ν (0.86 MeV ν)', rate: 0.6, branch: 2 },
  { from: 'li7', to: 'he4', lab: '⁷Li + p → 2 ⁴He', rate: 0.9, branch: 2 },
  { from: 'be7', to: 'b8', lab: '⁷Be + p → ⁸B + γ (PP III, 0.1 %)', rate: 0.5, branch: 3 },
  { from: 'b8', to: 'he4', lab: '⁸B → ⁸Be* + e⁺ + ν (≤ 15 MeV ν) → 2 ⁴He', rate: 0.8, branch: 3 },
];
class PpChainWidget extends CanvasWidget {
  private branch = 1;
  private t = 0;
  private hover = -1;
  constructor() {
    super(1.8);
    this.segmented<'1' | '2' | '3'>([['1', 'PP I (69 %)'], ['2', 'PP II (31 %)'], ['3', 'PP III (0.1 %)']], '1', (v) => { this.branch = +v; });
    this.playButton();
    this.canvas.addEventListener('pointermove', (e) => { const { x, y } = canvasPos(this.canvas, e, this.w, this.h); let best = -1, bd = 1e9; PP_EDGES.forEach((ed, i) => { const a = this.pos(ed.from), b = this.pos(ed.to); const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2; const d = Math.hypot(mx - x, my - y); if (d < bd) { bd = d; best = i; } }); this.hover = bd < 40 ? best : -1; });
  }
  private pos(id: string): [number, number] { const n = PP_NODES.find((k) => k.id === id)!; return [20 + n.x * (this.w - 40), 14 + n.y * (this.h - 60)]; }
  protected draw(dt: number) {
    const c = this.ctx, w = this.w, h = this.h;
    this.t += dt;
    const active = (ed: PpEdge) => ed.branch === 0 || ed.branch === this.branch || (ed.branch === 2 && this.branch === 3 && ed.to !== 'li7' && ed.from !== 'li7');
    PP_EDGES.forEach((ed, i) => {
      const a = this.pos(ed.from), b = this.pos(ed.to);
      const on = active(ed);
      this.line(a[0], a[1], b[0], b[1], on ? hexA(C.text, 0.5) : hexA(C.text, 0.12), on ? 1.5 : 1);
      if (on) {
        const k = 3; for (let j = 0; j < k; j++) { const ph = ((this.t * ed.rate * 0.5 + j / k) % 1); const px = a[0] + (b[0] - a[0]) * ph, py = a[1] + (b[1] - a[1]) * ph; this.glow(px, py, 7, hexA(C.sun, 0.9)); }
      }
      if (i === this.hover && ed.lab) { const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2; c.fillStyle = 'rgba(0,0,0,0.75)'; const tw = ed.lab.length * 5.4 + 12; c.fillRect(Math.min(w - tw - 4, Math.max(4, mx - tw / 2)), my - 22, tw, 16); this.text(ed.lab, Math.min(w - tw / 2 - 4, Math.max(tw / 2 + 4, mx)), my - 14, C.star, 9, 'center'); }
    });
    for (const n of PP_NODES) {
      const [x, y] = this.pos(n.id);
      const on = PP_EDGES.some((ed) => active(ed) && (ed.from === n.id || ed.to === n.id));
      this.circle(x, y, 13, on ? n.col : hexA(n.col, 0.3), on ? hexA(n.col, 0.3) : 'rgba(0,0,0,0)', 1.5);
      this.text(n.lab, x, y, on ? C.text : C.faint, 11, 'center');
    }
    this.text('hover an arrow for the reaction · glowing dots run at the relative speed of each step (slowest sped up enormously)', w / 2, h - 32, C.dim, 8, 'center');
    const eNu = this.branch === 1 ? 0.53 : this.branch === 2 ? 1.69 : 7.8;
    const eMax = this.branch === 1 ? 0.42 : this.branch === 2 ? 0.86 : 15;
    this.setReadout([
      ['Net: 4 ¹H → ⁴He + 2e⁺ + 2ν', '26.73 MeV'],
      ['Lost to ν per ⁴He', `${fmt(eNu, 2)} MeV`, C.purple],
      ['Max ν energy', `${fmt(eMax, 2)} MeV`, C.purple],
      ['Bottleneck (weak)', 'p + p ≈ 9 Gyr', C.red],
    ]);
  }
}

/* -------------------------------------------------- 10.3e pp vs CNO vs 3α ---- */

function epsPP(rho: number, X: number, T: number): number { const T6 = T / 1e6; return 0.241 * rho * X * X * T6 ** (-2 / 3) * Math.exp(-33.80 * T6 ** (-1 / 3)); }
function epsCNO(rho: number, X: number, Xcno: number, T: number): number { const T6 = T / 1e6; return 8.67e20 * rho * X * Xcno * T6 ** (-2 / 3) * Math.exp(-152.28 * T6 ** (-1 / 3)); }
function eps3a(rho: number, Y: number, T: number): number { const T8 = T / 1e8; return 50.9 * rho * rho * Y ** 3 * T8 ** -3 * Math.exp(-44.027 / T8); }
class PpCnoWidget extends CanvasWidget {
  private lRho = Math.log10(1.5e5);
  private X = 0.7;
  private Xcno = 0.01;
  constructor() {
    super(1.7);
    this.slider('Density', 2, 6, 0.1, this.lRho, (v) => `${sci(10 ** v, 1)} kg/m³`, (v) => { this.lRho = v; });
    this.slider('Hydrogen X', 0.01, 0.75, 0.01, this.X, (v) => fmt(v, 2), (v) => { this.X = v; });
    this.slider('CNO fraction X_CNO', 0.0001, 0.03, 0.0001, this.Xcno, (v) => fmt(v, 4), (v) => { this.Xcno = v; });
  }
  protected draw() {
    const c = this.ctx, w = this.w, h = this.h;
    const rho = 10 ** this.lRho, X = this.X, Y = Math.max(0.02, 0.98 - X);
    const x0 = 50, x1 = w - 12, y0 = 14, y1 = h - 30;
    axesBox(c, x0, y0, x1, y1);
    const lt0 = 6.5, lt1 = 8.5, le0 = -8, le1 = 10;
    const Xp = (lT: number) => x0 + (lT - lt0) / (lt1 - lt0) * (x1 - x0);
    const Yp = (e: number) => y1 - 6 - (Math.min(le1, Math.max(le0, Math.log10(Math.max(e, 1e-30)))) - le0) / (le1 - le0) * (y1 - y0 - 12);
    for (let le = -6; le <= 8; le += 2) { this.line(x0, Yp(10 ** le), x1, Yp(10 ** le), hexA(C.grid, 0.9)); this.text(`10${sup(le)}`, x0 - 4, Yp(10 ** le), C.dim, 8, 'right'); }
    for (const lT of [6.5, 7, 7.5, 8, 8.5]) { this.line(Xp(lT), y1, Xp(lT), y1 + 3, C.dim); this.text(`${sci(10 ** lT, 0)}`, Xp(lT), y1 + 11, C.dim, 8, 'center'); }
    this.text('T (K)', x1, y1 + 22, C.dim, 9, 'right'); this.text('ε (W kg⁻¹)', x0 + 4, y0 + 10, C.dim, 9);
    const curve = (f: (T: number) => number, col: string) => { c.beginPath(); let st = false; for (let lT = lt0; lT <= lt1; lT += 0.01) { const e = f(10 ** lT); if (e < 10 ** le0) { st = false; continue; } const px = Xp(lT), py = Yp(e); st ? c.lineTo(px, py) : c.moveTo(px, py); st = true; } c.strokeStyle = col; c.lineWidth = 2; c.stroke(); };
    curve((T) => epsPP(rho, X, T), C.sun);
    curve((T) => epsCNO(rho, X, this.Xcno, T), C.blue);
    curve((T) => eps3a(rho, Y, T), C.red);
    this.text('pp chain ~T⁴', Xp(6.85), Yp(epsPP(rho, X, 10 ** 6.85)) - 12, C.sun, 9);
    this.text('CNO cycle ~T¹⁷', Xp(7.45), Yp(epsCNO(rho, X, this.Xcno, 10 ** 7.45)) - 12, C.blue, 9);
    this.text('triple-α ~T⁴¹', Xp(8.1), Yp(eps3a(rho, Y, 10 ** 8.1)) - 12, C.red, 9);
    // crossover
    let Tx = 0; for (let lT = 6.8; lT <= 8; lT += 0.002) { if (epsCNO(rho, X, this.Xcno, 10 ** lT) > epsPP(rho, X, 10 ** lT)) { Tx = 10 ** lT; break; } }
    if (Tx) { this.line(Xp(Math.log10(Tx)), y0, Xp(Math.log10(Tx)), y1, hexA(C.green, 0.6), 1, [3, 3]); this.text(`pp = CNO at ${sci(Tx, 2)} K`, Xp(Math.log10(Tx)) + 4, y0 + 12, C.green, 9); }
    const stars: Array<[string, number]> = [['Proxima', 4.5e6], ['Sun', 1.57e7], ['Sirius A', 2.1e7], ['Spica', 3.0e7], ['He core flash', 1.0e8], ['He burning', 1.5e8]];
    stars.forEach(([lab, T], i) => { const lT = Math.log10(T); if (lT < lt0 || lT > lt1) return; this.line(Xp(lT), y1 - 4, Xp(lT), y1 - 14 - (i % 2) * 10, C.dim); this.text(lab, Xp(lT), y1 - 20 - (i % 2) * 10, C.dim, 8, 'center'); });
    const Ts = 1.57e7;
    const ep = epsPP(rho, X, Ts), ec = epsCNO(rho, X, this.Xcno, Ts);
    this.setReadout([
      ['ε_pp at T☉ (W/kg)', sci(ep, 2), C.sun],
      ['ε_CNO at T☉ (W/kg)', sci(ec, 2), C.blue],
      ['CNO share at T☉', `${fmt(100 * ec / (ep + ec), 1)} %`],
      ['pp = CNO at', Tx ? `${fmt(Tx / 1e6, 1)} MK` : '—', C.green],
    ]);
  }
}

/* -------------------------------------------- 10.4a radiative gradient ---- */

class RadGradientWidget extends CanvasWidget {
  private x = 0.5;
  private kMul = 1; private lMul = 1;
  constructor() {
    super(1.8);
    this.slider('Probe r / R☉', 0.02, 0.98, 0.01, this.x, (v) => fmt(v, 2), (v) => { this.x = v; });
    this.slider('Opacity × ', 0.1, 10, 0.1, this.kMul, (v) => `×${fmt(v, 1)}`, (v) => { this.kMul = v; });
    this.slider('Luminosity × ', 0.1, 10, 0.1, this.lMul, (v) => `×${fmt(v, 1)}`, (v) => { this.lMul = v; });
  }
  private grads(x: number): { rad: number; ad: number } {
    const m = ssmAt(x); const r = x * RSUN;
    const g = GRAV * m.M * MSUN / (r * r);
    const rad = 3 / (4 * A_RAD * C_LIGHT) * (m.kap * this.kMul * m.rho / m.T ** 3) * (m.L * this.lMul * LSUN_W) / (4 * Math.PI * r * r);
    const ad = (1 - 1 / GAMMA_AD) * m.mu * M_H * g / K_B;
    return { rad, ad };
  }
  protected draw() {
    const c = this.ctx, w = this.w, h = this.h;
    const x0 = 50, x1 = w - 12, y0 = 14, y1 = h - 30;
    axesBox(c, x0, y0, x1, y1);
    const X = (x: number) => x0 + x * (x1 - x0);
    const lg0 = -4, lg1 = 1;
    const Y = (gval: number) => y1 - 6 - (Math.min(lg1, Math.max(lg0, Math.log10(gval))) - lg0) / (lg1 - lg0) * (y1 - y0 - 12);
    for (let lg = -4; lg <= 1; lg++) { this.line(x0, Y(10 ** lg), x1, Y(10 ** lg), hexA(C.grid, 0.9)); this.text(`10${sup(lg)}`, x0 - 4, Y(10 ** lg), C.dim, 8, 'right'); }
    this.text('|dT/dr| (K per metre)', x0 + 4, y0 + 10, C.dim, 9);
    for (const x of [0, 0.25, 0.5, 0.75, 1]) this.text(fmt(x, 2), X(x), y1 + 10, C.dim, 8, 'center');
    this.text('r / R☉', x1, y1 + 22, C.dim, 9, 'right');
    // convective shading
    let first = -1;
    for (let i = 2; i <= 98; i++) { const x = i / 100; const gr = this.grads(x); if (gr.rad > gr.ad && first < 0) first = x; if (gr.rad > gr.ad) { c.fillStyle = hexA(C.accent, 0.12); c.fillRect(X(x - 0.005), y0, X(x + 0.005) - X(x - 0.005), y1 - y0); } }
    const curve = (f: (x: number) => number, col: string, wd: number, dash?: number[]) => { c.beginPath(); for (let i = 2; i <= 98; i++) { const x = i / 100; const px = X(x), py = Y(f(x)); i === 2 ? c.moveTo(px, py) : c.lineTo(px, py); } c.strokeStyle = col; c.lineWidth = wd; c.setLineDash(dash ?? []); c.stroke(); c.setLineDash([]); };
    curve((x) => this.grads(x).ad, C.green, 1.8, [5, 3]);
    curve((x) => this.grads(x).rad, C.sun, 2.2);
    this.text('radiative gradient needed to carry L_r', x0 + 8, y0 + 24, C.sun, 9);
    this.text('adiabatic gradient (1 − 1/γ) μm_H g/k', x0 + 8, y0 + 36, C.green, 9);
    if (first > 0) { this.line(X(first), y0, X(first), y1, C.accent, 1.5, [3, 3]); this.text(`convection from ${fmt(first, 2)} R☉`, X(first) - 4, y1 - 12, C.accent, 9, 'right'); }
    this.line(X(SSM_RCZ), y0, X(SSM_RCZ), y0 + 14, hexA('#fff', 0.5), 1); this.text('0.713 (helioseismic)', X(SSM_RCZ) + 3, y0 + 8, hexA('#fff', 0.6), 8);
    const gr = this.grads(this.x); const m = ssmAt(this.x);
    this.circle(X(this.x), Y(gr.rad), 4, '#fff', C.sun); this.circle(X(this.x), Y(gr.ad), 4, '#fff', C.green);
    this.setReadout([
      ['r: T, ρ, κ̄', `${sci(m.T, 2)} K, ${sci(m.rho, 1)}, ${fmt(m.kap * this.kMul, 2)}`],
      ['|dT/dr|_rad', `${sci(gr.rad * 1000, 2)} K/km`, C.sun],
      ['|dT/dr|_ad', `${sci(gr.ad * 1000, 2)} K/km`, C.green],
      ['Transport here', gr.rad > gr.ad ? 'convective' : 'radiative', gr.rad > gr.ad ? C.accent : C.blue],
    ]);
  }
}

/* ------------------------------------------------- 10.4b Schwarzschild ---- */

class ConvectionWidget extends CanvasWidget {
  private mode: 'star' | 'air' = 'air';
  private ratio = 1.3;      // actual / adiabatic gradient
  private y = 0.05; private v = 0; private t = 0;
  constructor() {
    super(1.8);
    this.segmented<'air' | 'star'>([['air', 'Earth\'s atmosphere'], ['star', 'Stellar layer']], this.mode, (v) => { this.mode = v; this.reset(); });
    this.slider('Actual gradient / adiabatic', 0.3, 2, 0.01, this.ratio, (v) => fmt(v, 2), (v) => { this.ratio = v; this.reset(); });
    const b = $('button', 'lw-btn', 'Release bubble'); b.addEventListener('click', () => this.reset()); this.controls.appendChild(b);
    this.playButton();
  }
  private reset() { this.y = 0.05; this.v = 0; this.t = 0; }
  protected draw(dt: number) {
    const c = this.ctx, w = this.w, h = this.h;
    const air = this.mode === 'air';
    const g = air ? 9.8 : 274, T0 = air ? 300 : 2e6, H = air ? 10 : 1e5;                   // height scale: km
    const Gad = air ? 9.8 : (1 - 1 / GAMMA_AD) * 0.62 * M_H * g / K_B * 1000;             // K per km
    const Gen = this.ratio * Gad;
    // integrate bubble (y in km, dimensionless time scaled)
    const tscale = air ? 60 : 3e4;   // seconds per animation second
    if (dt > 0) {
      const steps = 20; const ddt = dt * tscale / steps;
      for (let i = 0; i < steps; i++) {
        const Tb = T0 - Gad * this.y, Te = T0 - Gen * this.y;
        const a = g * (Tb - Te) / Te;                 // m/s²
        this.v += a * ddt; this.y += this.v * ddt / 1000;
        this.v *= 1 - 0.02 * ddt / tscale * 60;
        if (this.y > H) { this.y = H; this.v = 0; }
        if (this.y < 0) { this.y = 0; this.v = Math.abs(this.v) * 0.3; }
      }
      this.t += dt;
    }
    // left: layer with bubble
    const lx0 = 16, lx1 = w * 0.42, ly0 = 14, ly1 = h - 30;
    const Yh = (yk: number) => ly1 - yk / H * (ly1 - ly0);
    for (let i = 0; i < 24; i++) { const yk = (i + 0.5) / 24 * H; const Te = T0 - Gen * yk; const f = (Te - (T0 - Gad * H * 2)) / (Gad * H * 2); c.fillStyle = air ? `rgba(${120 + 120 * f},${160 + 60 * f},${255},0.5)` : rgba(tempRGB(2500 + 20000 * Math.max(0, Math.min(1, f))), 0.6); c.fillRect(lx0, Yh((i + 1) / 24 * H), lx1 - lx0, (ly1 - ly0) / 24 + 1); }
    c.strokeStyle = C.line; c.strokeRect(lx0, ly0, lx1 - lx0, ly1 - ly0);
    const Tb = T0 - Gad * this.y, Te = T0 - Gen * this.y;
    const bx = (lx0 + lx1) / 2, by = Yh(this.y);
    this.circle(bx, by, 14, '#fff', Tb > Te ? hexA(C.red, 0.6) : hexA(C.blue, 0.6), 1.5);
    this.text(`${Tb > Te ? '+' : ''}${fmt(Tb - Te, air ? 1 : 0)} K`, bx, by - 22, Tb > Te ? C.red : C.blue, 10, 'center');
    this.text(air ? 'ground' : 'deeper layer', (lx0 + lx1) / 2, ly1 + 10, C.dim, 9, 'center');
    this.text(air ? `${H} km` : `${sci(H, 0)} km`, lx0 + 4, ly0 + 10, C.dim, 8);
    // right: T vs height
    const x0 = w * 0.5, x1 = w - 12, y0 = 14, y1 = h - 30;
    axesBox(c, x0, y0, x1, y1);
    const Tlo = T0 - 2 * Gad * H, Thi = T0;
    const X = (T: number) => x0 + 6 + (T - Tlo) / (Thi - Tlo) * (x1 - x0 - 12);
    const Y = (yk: number) => y1 - 6 - yk / H * (y1 - y0 - 12);
    this.line(X(T0), Y(0), X(Math.max(Tlo, T0 - Gad * H)), Y(H), C.green, 2, [5, 3]);
    this.line(X(T0), Y(0), X(Math.max(Tlo, T0 - Gen * H)), Y(Math.min(H, (T0 - Tlo) / Gen)), C.sun, 2);
    this.circle(X(Tb), Y(this.y), 5, '#fff', Tb > Te ? C.red : C.blue);
    this.text('adiabat (bubble)', x1 - 6, y0 + 12, C.green, 9, 'right'); this.text('environment', x1 - 6, y0 + 24, C.sun, 9, 'right');
    this.text('T →', x1 - 4, y1 + 12, C.dim, 9, 'right'); this.text('height ↑', x0 + 4, y0 + 10, C.dim, 9);
    const stable = this.ratio < 1;
    const N = Math.sqrt(Math.abs(g * (Gad - Gen) / 1000 / T0));
    this.text(stable ? 'STABLE: bubble oscillates' : 'UNSTABLE: bubble runs away', (x0 + x1) / 2, y1 - 24, stable ? C.blue : C.red, 10, 'center');
    this.text(stable ? '(Brunt–Väisälä oscillation)' : '(convection sets in)', (x0 + x1) / 2, y1 - 12, stable ? C.blue : C.red, 9, 'center');
    this.setReadout([
      ['Adiabatic gradient', air ? `${fmt(Gad, 1)} K/km (g/c_p)` : `${sci(Gad, 2)} K/km`, C.green],
      ['Actual gradient', air ? `${fmt(Gen, 1)} K/km` : `${sci(Gen, 2)} K/km`, C.sun],
      ['Schwarzschild', stable ? 'stable (radiative)' : 'convective', stable ? C.blue : C.red],
      [stable ? 'Oscillation period' : 'e-folding time', fmtDur(stable ? TAU / N : 1 / N)],
    ]);
  }
}

/* -------------------------------------------------- 10.4c mixing length ---- */

class MixingLengthWidget extends CanvasWidget {
  private x = 0.9;
  private alpha = 1.8;
  private t = 0;
  private seeds: Array<[number, number, number]> = Array.from({ length: 26 }, (_, i) => { const r = mulberry(i + 1); return [r(), r(), r()]; });
  constructor() {
    super(1.8);
    this.slider('Depth r / R☉ (convection zone)', 0.72, 0.999, 0.001, this.x, (v) => fmt(v, 3), (v) => { this.x = v; });
    this.slider('Mixing-length α', 0.5, 3, 0.1, this.alpha, (v) => fmt(v, 1), (v) => { this.alpha = v; });
    this.playButton();
  }
  private mlt(x: number) {
    const m = ssmAt(x); const r = x * RSUN;
    const g = GRAV * m.M * MSUN / (r * r);
    const HP = m.P / (m.rho * g);
    const ell = this.alpha * HP;
    const F = LSUN_W / (4 * Math.PI * r * r);
    const cP = 2.5 * K_B / (m.mu * M_H);
    const v = Math.cbrt(g * ell * F / (m.rho * cP * m.T));
    const dT = F / (m.rho * cP * v);
    const dnab = dT / m.T * HP / ell;
    return { HP, ell, F, v, dT, dnab, T: m.T, rho: m.rho };
  }
  protected draw(dt: number) {
    const c = this.ctx, w = this.w, h = this.h;
    this.t += dt;
    const q = this.mlt(this.x);
    // left: granulation cartoon, speed scaled to v
    const gx0 = 14, gy0 = 14, gs = Math.min(w * 0.4, h - 44);
    c.save(); c.beginPath(); c.rect(gx0, gy0, gs, gs); c.clip();
    c.fillStyle = '#5a3a10'; c.fillRect(gx0, gy0, gs, gs);
    const sp = Math.min(0.5, q.v / 4000);
    for (const [sx, sy, ph] of this.seeds) {
      const life = ((this.t * sp * 0.6 + ph) % 1);
      const rr = gs * 0.13 * Math.sin(life * Math.PI);
      const gg = c.createRadialGradient(gx0 + sx * gs, gy0 + sy * gs, 0, gx0 + sx * gs, gy0 + sy * gs, Math.max(1, rr));
      gg.addColorStop(0, 'rgba(255,225,160,1)'); gg.addColorStop(0.75, 'rgba(240,190,110,0.9)'); gg.addColorStop(1, 'rgba(90,58,16,0)');
      c.fillStyle = gg; c.beginPath(); c.arc(gx0 + sx * gs, gy0 + sy * gs, Math.max(1, rr), 0, TAU); c.fill();
    }
    c.restore(); c.strokeStyle = C.line; c.strokeRect(gx0, gy0, gs, gs);
    this.text('granulation (schematic): hot gas up in the cells, cool gas down in the lanes', gx0, gy0 + gs + 12, C.dim, 8);
    // right: v_c and δT vs r
    const x0 = w * 0.52, x1 = w - 12, y0 = 14, y1 = h - 30;
    axesBox(c, x0, y0, x1, y1);
    const X = (x: number) => x0 + (x - 0.72) / 0.279 * (x1 - x0);
    const Yv = (v: number) => y1 - 6 - (Math.log10(Math.max(v, 1)) - 0) / 3.5 * (y1 - y0 - 12);
    for (const lv of [0, 1, 2, 3]) { this.line(x0, Yv(10 ** lv), x1, Yv(10 ** lv), hexA(C.grid, 0.9)); this.text(`10${sup(lv)}`, x0 - 4, Yv(10 ** lv), C.dim, 8, 'right'); }
    this.text('v_c (m/s)', x0 + 4, y0 + 10, C.sun, 9);
    c.beginPath(); for (let x = 0.72; x <= 0.999; x += 0.003) { const px = X(x), py = Yv(this.mlt(x).v); x === 0.72 ? c.moveTo(px, py) : c.lineTo(px, py); } c.strokeStyle = C.sun; c.lineWidth = 2; c.stroke();
    const YdT = (d: number) => y1 - 6 - (Math.log10(Math.max(d, 1e-6)) + 6) / 9 * (y1 - y0 - 12);
    c.beginPath(); for (let x = 0.72; x <= 0.999; x += 0.003) { const px = X(x), py = YdT(this.mlt(x).dT); x === 0.72 ? c.moveTo(px, py) : c.lineTo(px, py); } c.strokeStyle = C.red; c.lineWidth = 1.5; c.setLineDash([4, 3]); c.stroke(); c.setLineDash([]);
    this.text('δT (K, 10⁻⁶…10³, dashed)', x1 - 6, y0 + 10, C.red, 9, 'right');
    this.line(X(this.x), y0, X(this.x), y1, hexA('#fff', 0.4), 1, [2, 3]);
    this.circle(X(this.x), Yv(q.v), 4, '#fff', C.sun);
    for (const x of [0.75, 0.85, 0.95]) this.text(fmt(x, 2), X(x), y1 + 10, C.dim, 8, 'center');
    this.text('r / R☉', x1, y1 + 22, C.dim, 9, 'right');
    this.setReadout([
      ['H_P, ℓ = αH_P (Mm)', `${fmt(q.HP / 1e6, 1)}, ${fmt(q.ell / 1e6, 1)}`],
      ['Convective velocity', `${q.v < 100 ? fmt(q.v, 1) : fmt(q.v, 0)} m/s`, C.sun],
      ['Temperature excess δT', q.dT < 0.01 ? `${sci(q.dT, 1)} K` : `${fmt(q.dT, 2)} K`, C.red],
      ['∇ − ∇_ad', sci(q.dnab, 1)],
    ]);
  }
}

/* ------------------------------------------------------ 10.5a polytrope ---- */

function laneEmden(n: number): { xi: number[]; th: number[]; xi1: number; dth1: number } {
  const xi: number[] = [0], th: number[] = [1];
  let x = 1e-4, y = 1 - x * x / 6, z = -x / 3;
  const hstep = 0.005;
  const f = (xx: number, yy: number, zz: number) => -Math.pow(Math.max(yy, 0), n) - 2 * zz / xx;
  let guard = 0;
  while (y > 0 && guard++ < 20000) {
    const k1y = z, k1z = f(x, y, z);
    const k2y = z + hstep / 2 * k1z, k2z = f(x + hstep / 2, y + hstep / 2 * k1y, z + hstep / 2 * k1z);
    const k3y = z + hstep / 2 * k2z, k3z = f(x + hstep / 2, y + hstep / 2 * k2y, z + hstep / 2 * k2z);
    const k4y = z + hstep * k3z, k4z = f(x + hstep, y + hstep * k3y, z + hstep * k3z);
    y += hstep / 6 * (k1y + 2 * k2y + 2 * k3y + k4y); z += hstep / 6 * (k1z + 2 * k2z + 2 * k3z + k4z); x += hstep;
    xi.push(x); th.push(Math.max(0, y));
    if (x > 40) break;
  }
  return { xi, th, xi1: x, dth1: z };
}
class PolytropeWidget extends CanvasWidget {
  private n = 1.5;
  private cache: ReturnType<typeof laneEmden> | null = null; private cacheN = NaN;
  constructor() {
    super(1.8);
    this.slider('Polytropic index n', 0, 4.9, 0.1, this.n, (v) => fmt(v, 1), (v) => { this.n = v; });
  }
  protected draw() {
    const c = this.ctx, w = this.w, h = this.h;
    const n = this.n;
    if (this.cacheN !== n || !this.cache) { this.cache = laneEmden(n); this.cacheN = n; }
    const { xi, th, xi1, dth1 } = this.cache;
    const cond = n >= 4.9 ? Infinity : -xi1 / (3 * dth1);
    const x0 = 44, x1 = w * 0.6, y0 = 14, y1 = h - 30;
    axesBox(c, x0, y0, x1, y1);
    const X = (r: number) => x0 + r * (x1 - x0);
    const Y = (v: number) => y1 - 6 - v * (y1 - y0 - 12);
    // density profile ρ/ρ_c = θ^n
    c.beginPath(); xi.forEach((xx, i) => { const px = X(Math.min(1, xx / xi1)), py = Y(Math.pow(th[i], n)); i === 0 ? c.moveTo(px, py) : c.lineTo(px, py); }); c.strokeStyle = C.sun; c.lineWidth = 2.2; c.stroke();
    // mass profile m/M = -ξ²θ' / (-ξ1²θ'(ξ1))
    const mtot = -xi1 * xi1 * dth1;
    c.beginPath(); for (let i = 1; i < xi.length; i++) { const dth = (th[i] - th[i - 1]) / (xi[i] - xi[i - 1]); const m = -xi[i] * xi[i] * dth / mtot; const px = X(Math.min(1, xi[i] / xi1)), py = Y(Math.min(1, m)); i === 1 ? c.moveTo(px, py) : c.lineTo(px, py); } c.strokeStyle = C.green; c.lineWidth = 1.5; c.stroke();
    // Sun overlay
    c.beginPath(); for (let x = 0; x <= 1; x += 0.01) { const px = X(x), py = Y(ssmAt(x).rho / 1.5e5); x === 0 ? c.moveTo(px, py) : c.lineTo(px, py); } c.strokeStyle = hexA(C.text, 0.5); c.lineWidth = 1; c.setLineDash([3, 3]); c.stroke(); c.setLineDash([]);
    // legend in the empty left-middle region (density still high above it, mass still low below it)
    this.text('ρ / ρ_c = θⁿ', X(0.06), Y(0.46), C.sun, 9); this.text('m(r) / M', X(0.06), Y(0.40), C.green, 9); this.text('Sun (dashed)', X(0.06), Y(0.34), C.dim, 9);
    this.text('0', X(0), y1 + 10, C.dim, 8, 'center'); this.text('r / R', (x0 + x1) / 2, y1 + 10, C.dim, 9, 'center'); this.text('1', X(1), y1 + 10, C.dim, 8, 'center');
    // right: cross-section
    const cx = w * 0.8, cy = h * 0.47, R = Math.min(w * 0.17, h * 0.38);
    for (let k = 40; k >= 1; k--) { const r = k / 40; let i = 0; while (i < xi.length - 1 && xi[i] / xi1 < r) i++; const d = Math.pow(th[i], n); c.fillStyle = rgba(tempRGB(2300 + 4400 * d ** 0.4), 0.3 + 0.7 * d ** 0.5); c.beginPath(); c.arc(cx, cy, R * r, 0, TAU); c.fill(); }
    this.circle(cx, cy, R, C.line);
    this.text(`n = ${fmt(n, 1)}`, cx, cy + R + 14, C.text, 10, 'center');
    const note = n < 0.3 ? 'uniform sphere' : Math.abs(n - 1) < 0.15 ? 'Jupiter / Saturn: R independent of M' : Math.abs(n - 1.5) < 0.15 ? 'fully convective star, white dwarf (NR)' : Math.abs(n - 3) < 0.2 ? 'Eddington standard model, Chandrasekhar WD' : n > 4.5 ? 'radius → ∞' : '';
    if (note) this.text(note, cx, cy + R + 26, C.accent, 8, 'center');
    this.setReadout([
      ['ξ₁ (surface)', Number.isFinite(cond) ? fmt(xi1, 3) : '∞'],
      ['ρ_c / ρ̄', Number.isFinite(cond) ? fmt(cond, cond < 100 ? 2 : 0) : '∞', C.sun],
      ['−ξ₁²θ′(ξ₁)', fmt(mtot, 3), C.green],
      ['Half-mass radius', (() => { for (let i = 1; i < xi.length; i++) { const dth = (th[i] - th[i - 1]) / (xi[i] - xi[i - 1]); if (-xi[i] * xi[i] * dth / mtot >= 0.5) return `${fmt(xi[i] / xi1, 2)} R`; } return '—'; })()],
    ]);
  }
}

/* --------------------------------------------------- 10.5b solar model ---- */

class SolarModelWidget extends CanvasWidget {
  private x = 0.25;
  private view: 'trp' | 'mlx' = 'trp';
  private drag = false;
  constructor() {
    super(1.8);
    this.segmented<'trp' | 'mlx'>([['trp', 'T, ρ, P'], ['mlx', 'M_r, L_r, X']], this.view, (v) => { this.view = v; });
    this.slider('Cursor r / R☉', 0, 1, 0.005, this.x, (v) => fmt(v, 3), (v) => { this.x = v; });
    const move = (e: PointerEvent) => { const { x } = canvasPos(this.canvas, e, this.w, this.h); const x0 = 50, x1 = this.w - 12; this.x = Math.min(1, Math.max(0, (x - x0) / (x1 - x0))); };
    this.canvas.addEventListener('pointerdown', (e) => { this.drag = true; move(e); });
    this.canvas.addEventListener('pointermove', (e) => { if (this.drag) move(e); });
    window.addEventListener('pointerup', () => { this.drag = false; });
  }
  protected draw() {
    const c = this.ctx, w = this.w, h = this.h;
    const x0 = 50, x1 = w - 12, y0 = 14, y1 = h - 30;
    axesBox(c, x0, y0, x1, y1);
    const X = (x: number) => x0 + x * (x1 - x0);
    c.fillStyle = hexA(C.accent, 0.08); c.fillRect(X(SSM_RCZ), y0, x1 - X(SSM_RCZ), y1 - y0);
    this.text('convection zone', X(SSM_RCZ) + 4, y1 - 10, C.accent, 8);
    for (const x of [0, 0.25, 0.5, 0.75, 1]) this.text(fmt(x, 2), X(x), y1 + 10, C.dim, 8, 'center');
    this.text('r / R☉', x1, y1 + 22, C.dim, 9, 'right');
    const m = ssmAt(this.x);
    if (this.view === 'trp') {
      const Y = (v: number) => y1 - 6 - v * (y1 - y0 - 12);
      // each quantity relative to its central value: P falls fastest, T slowest
      const c0 = ssmAt(0);
      const lines: Array<[string, (q: ReturnType<typeof ssmAt>) => number, string]> = [['T / T_c', (q) => q.T / c0.T, C.sun], ['ρ / ρ_c', (q) => q.rho / c0.rho, C.green], ['P / P_c', (q) => q.P / c0.P, C.blue]];
      lines.forEach(([lab, f, col], i) => { c.beginPath(); for (let x = 0; x <= 1; x += 0.005) { const px = X(x), py = Y(Math.min(1, Math.max(0, f(ssmAt(x))))); x === 0 ? c.moveTo(px, py) : c.lineTo(px, py); } c.strokeStyle = col; c.lineWidth = 2; c.stroke(); this.text(lab, x1 - 8, y0 + 12 + i * 12, col, 9, 'right'); this.circle(X(this.x), Y(Math.min(1, Math.max(0, f(m)))), 4, '#fff', col); });
      for (const v of [0.25, 0.5, 0.75, 1]) { this.line(x0, Y(v), x1, Y(v), hexA(C.grid, 0.9)); this.text(fmt(v, 2), x0 - 4, Y(v), C.dim, 8, 'right'); }
      this.text(`T_c = ${sci(c0.T, 2)} K · ρ_c = ${sci(c0.rho, 2)} kg/m³ · P_c = ${sci(c0.P, 2)} Pa`, x0 + 8, y0 + 12, C.dim, 8);
    } else {
      const Y = (v: number) => y1 - 6 - v * (y1 - y0 - 12);
      const lines: Array<[string, (q: ReturnType<typeof ssmAt>) => number, string]> = [['M_r / M☉', (q) => q.M, C.sun], ['L_r / L☉', (q) => q.L, C.green], ['X (hydrogen)', (q) => q.X, C.blue]];
      lines.forEach(([lab, f, col], i) => { c.beginPath(); for (let x = 0; x <= 1; x += 0.005) { const px = X(x), py = Y(f(ssmAt(x))); x === 0 ? c.moveTo(px, py) : c.lineTo(px, py); } c.strokeStyle = col; c.lineWidth = 2; c.stroke(); this.text(lab, x0 + 8, y0 + 12 + i * 12, col, 9); this.circle(X(this.x), Y(f(m)), 4, '#fff', col); });
      for (const v of [0.25, 0.5, 0.75, 1]) { this.line(x0, Y(v), x1, Y(v), hexA(C.grid, 0.9)); this.text(fmt(v, 2), x0 - 4, Y(v), C.dim, 8, 'right'); }
    }
    this.line(X(this.x), y0, X(this.x), y1, hexA('#fff', 0.4), 1, [2, 3]);
    this.setReadout([
      ['T, ρ (K, kg/m³)', `${sci(m.T, 2)}, ${sci(m.rho, 2)}`, C.sun],
      ['P', `${sci(m.P, 2)} Pa`, C.blue],
      ['M_r, L_r', `${fmt(m.M, 3)} M☉, ${fmt(m.L, 3)} L☉`, C.green],
      ['X, μ', `${fmt(m.X, 2)}, ${fmt(m.mu, 2)}`],
    ]);
  }
}

/* ------------------------------------------------ 10.6a ends of the sequence ---- */

class MsRangeWidget extends CanvasWidget {
  private lM = Math.log10(0.05);
  constructor() {
    super(1.8);
    this.slider('Mass', -3.2, 2.5, 0.02, this.lM, (v) => (10 ** v < 0.1 ? `${fmt(10 ** v * 1047, 1)} M_Jup` : `${fmt(10 ** v, 2)} M☉`), (v) => { this.lM = v; });
  }
  private Tpeak(M: number): number { return 3e6 * (M / 0.08) ** 1.1; }
  protected draw() {
    const c = this.ctx, w = this.w, h = this.h;
    const M = 10 ** this.lM;
    // left: peak central T vs mass (0.0005–0.3)
    const x0 = 46, x1 = w * 0.5, y0 = 14, y1 = h - 30;
    axesBox(c, x0, y0, x1, y1);
    const lm0 = -3.2, lm1 = -0.5;
    const X = (lm: number) => x0 + (lm - lm0) / (lm1 - lm0) * (x1 - x0);
    const Y = (T: number) => y1 - 6 - (Math.log10(T) - 4) / 3.2 * (y1 - y0 - 12);
    for (let lt = 4; lt <= 7; lt++) { this.line(x0, Y(10 ** lt), x1, Y(10 ** lt), hexA(C.grid, 0.9)); this.text(`10${sup(lt)}`, x0 - 4, Y(10 ** lt), C.dim, 8, 'right'); }
    this.text('peak central T (K) of a contracting body', x0 + 6, y0 + 10, C.dim, 8);
    for (const [lm, lab] of [[-3, '1 M_Jup'], [-2, '10'], [Math.log10(0.08), '80 M_Jup'], [-0.5, '0.3 M☉']] as Array<[number, string]>) this.text(lab, X(lm), y1 + 10, C.dim, 8, 'center');
    c.beginPath(); for (let lm = lm0; lm <= lm1; lm += 0.02) { const px = X(lm), py = Y(this.Tpeak(10 ** lm)); lm === lm0 ? c.moveTo(px, py) : c.lineTo(px, py); } c.strokeStyle = C.sun; c.lineWidth = 2.2; c.stroke();
    for (const [T, lab, col, dy] of [[3e6, 'H ignition', C.sun, -7], [2.5e6, 'Li burning', C.green, 9], [5e5, 'D burning', C.purple, -7]] as Array<[number, string, string, number]>) { this.line(x0, Y(T), x1, Y(T), hexA(col, 0.6), 1, [4, 3]); this.text(lab, x1 - 4, Y(T) + dy, col, 8, 'right'); }
    this.line(X(Math.log10(0.08)), y0, X(Math.log10(0.08)), y1, hexA(C.sun, 0.4), 1, [2, 3]);
    this.line(X(Math.log10(0.013)), y0, X(Math.log10(0.013)), y1, hexA(C.purple, 0.4), 1, [2, 3]);
    this.text('planets', X(-2.6), y0 + 24, C.dim, 8, 'center'); this.text('brown dwarfs', X(-1.55), y0 + 24, C.purple, 8, 'center'); this.text('stars', X(-0.75), y0 + 24, C.sun, 8, 'center');
    if (this.lM <= lm1) this.circle(X(this.lM), Y(this.Tpeak(M)), 5, '#fff', C.star);
    // right: L/L_Edd on the MS (0.08–300)
    const rx0 = w * 0.58, rx1 = w - 12;
    axesBox(c, rx0, y0, rx1, y1);
    const RX = (lm: number) => rx0 + (lm + 1.1) / 3.6 * (rx1 - rx0);
    const RY = (g: number) => y1 - 6 - (Math.log10(g) + 7) / 7.3 * (y1 - y0 - 12);
    for (let lg = -6; lg <= 0; lg += 2) { this.line(rx0, RY(10 ** lg), rx1, RY(10 ** lg), hexA(C.grid, 0.9)); this.text(`10${sup(lg)}`, rx0 - 4, RY(10 ** lg), C.dim, 8, 'right'); }
    this.text('L / L_Edd along the main sequence', rx1 - 4, y1 - 10, C.dim, 8, 'right');
    for (const [lm, lab] of [[-1, '0.1'], [0, '1'], [1, '10'], [2, '100 M☉']] as Array<[number, string]>) this.text(lab, RX(lm), y1 + 10, C.dim, 8, 'center');
    const gam = (Mm: number) => mainSequence(Mm).L / (3.2e4 * Mm);
    c.beginPath(); for (let lm = Math.log10(0.08); lm <= 2.5; lm += 0.02) { const px = RX(lm), py = RY(gam(10 ** lm)); lm <= Math.log10(0.08) + 1e-9 ? c.moveTo(px, py) : c.lineTo(px, py); } c.strokeStyle = C.red; c.lineWidth = 2.2; c.stroke();
    this.line(rx0, RY(1), rx1, RY(1), C.red, 1, [4, 3]); this.text('Eddington limit', rx1 - 4, RY(1) + 9, C.red, 8, 'right');
    this.line(rx0, RY(0.5), rx1, RY(0.5), hexA(C.accent, 0.6), 1, [2, 3]); this.text('strong winds, eruptions', rx1 - 4, RY(0.5) + 9, C.accent, 8, 'right');
    const objs: Array<[string, number]> = [['Proxima', 0.12], ['Sun', 1], ['Spica', 11], ['η Car', 100], ['R136a1', 200]];
    for (const [lab, Mm] of objs) { const px = RX(Math.log10(Mm)), py = RY(gam(Mm)); this.circle(px, py, 3, '#000', C.star); if (Mm > 50) this.text(lab, px - 5, py + 10, C.dim, 8, 'right'); else this.text(lab, px + 4, py - 7, C.dim, 8); }
    if (M >= 0.08) this.circle(RX(this.lM), RY(gam(M)), 5, '#fff', C.star);
    const kind = M < 0.013 ? 'planet: no fusion ever' : M < 0.065 ? 'brown dwarf: burns D only' : M < 0.08 ? 'brown dwarf: burns D and Li, not H' : M < 100 ? 'star' : 'above the Eddington limit: unstable';
    this.setReadout([
      ['Mass', M < 0.1 ? `${fmt(M * 1047, 1)} M_Jup` : `${fmt(M, 2)} M☉`],
      ['Peak central T', M < 0.3 ? `${sci(this.Tpeak(M), 1)} K` : `> ${sci(this.Tpeak(0.3), 1)} K`, C.sun],
      ['L / L_Edd', M >= 0.08 ? sci(gam(M), 1) : '—', C.red],
      ['Nature', kind, M < 0.08 ? C.purple : M < 100 ? C.sun : C.red],
    ]);
  }
}

/* --------------------------------------------- 10.6b main-sequence structure ---- */

const MS_INT: Array<[number, number, number, number, number]> = [   // log M, log T_c, log ρ_c, conv-envelope mass fraction, conv-core mass fraction
  [-1, 6.65, 5.7, 1, 0], [-0.52, 6.88, 5.18, 1, 0], [-0.3, 7.0, 5.1, 0.35, 0], [0, 7.196, 5.18, 0.02, 0], [0.11, 7.26, 5.0, 0.002, 0.03], [0.3, 7.32, 4.78, 0, 0.2], [0.7, 7.42, 4.3, 0, 0.25], [1, 7.49, 3.95, 0, 0.3], [1.48, 7.58, 3.4, 0, 0.5], [1.78, 7.61, 3.3, 0, 0.65],
];
function msInterior(M: number): { Tc: number; rhoc: number; fenv: number; fcore: number } {
  const lm = Math.max(-1, Math.min(1.78, Math.log10(M)));
  let i = 0; while (i < MS_INT.length - 2 && MS_INT[i + 1][0] <= lm) i++;
  const a = MS_INT[i], b = MS_INT[i + 1]; const f = (lm - a[0]) / (b[0] - a[0]);
  const L = (k: number) => a[k] + f * (b[k] - a[k]);
  return { Tc: 10 ** L(1), rhoc: 10 ** L(2), fenv: L(3), fcore: L(4) };
}
class MsStructureWidget extends CanvasWidget {
  private lM = Math.log10(2);
  private t = 0;
  constructor() {
    super(1.8);
    this.slider('Mass', -1, 1.78, 0.02, this.lM, (v) => `${fmt(10 ** v, 2)} M☉`, (v) => { this.lM = v; });
    this.playButton();
  }
  protected draw(dt: number) {
    const c = this.ctx, w = this.w, h = this.h;
    this.t += dt;
    const M = 10 ** this.lM;
    const ms = mainSequence(M), q = msInterior(M);
    const rEnv = q.fenv >= 1 ? 0 : 1 - Math.pow(q.fenv, 0.35) * 0.9;         // inner radius of convective envelope (fraction)
    const rCore = q.fcore > 0 ? 0.12 + 0.45 * Math.pow(q.fcore, 0.6) : 0;    // outer radius of convective core
    const rBurn = 0.25;
    const cx = w * 0.3, cy = h * 0.47, R = Math.min(w * 0.26, h * 0.4);
    // interior shading: hot white core → orange → surface colour at the rim
    const g = c.createRadialGradient(cx, cy, 0, cx, cy, R);
    g.addColorStop(0, '#fff6dc'); g.addColorStop(0.35, rgba(tempRGB(5200), 1)); g.addColorStop(0.85, rgba(tempRGB(3600), 1)); g.addColorStop(1, rgba(tempRGB(ms.T), 1));
    c.fillStyle = g; c.beginPath(); c.arc(cx, cy, R, 0, TAU); c.fill();
    // burning core shading
    c.fillStyle = hexA('#fff', 0.15); c.beginPath(); c.arc(cx, cy, R * rBurn, 0, TAU); c.fill();
    // convective cells
    const cells = (r0: number, r1: number) => {
      const nR = Math.max(1, Math.round((r1 - r0) * 6)), nA = 14;
      for (let i = 0; i < nR; i++) for (let j = 0; j < nA; j++) {
        const rr = R * (r0 + (i + 0.5) / nR * (r1 - r0)), a = (j / nA) * TAU + this.t * 0.3 * (i % 2 ? 1 : -1);
        const sz = R * (r1 - r0) / nR * 0.45;
        c.strokeStyle = hexA('#fff', 0.8); c.lineWidth = 1.3; c.beginPath(); c.arc(cx + rr * Math.cos(a), cy + rr * Math.sin(a), sz, a + this.t * 2, a + this.t * 2 + 4.5); c.stroke();
      }
    };
    if (q.fenv > 0) cells(rEnv, 1);
    if (q.fcore > 0) cells(0, rCore);
    this.circle(cx, cy, R, C.line);
    if (q.fenv > 0 && q.fenv < 1) this.circle(cx, cy, R * rEnv, hexA('#fff', 0.5), undefined, 1, [3, 3]);
    if (q.fcore > 0) this.circle(cx, cy, R * rCore, hexA('#fff', 0.5), undefined, 1, [3, 3]);
    this.text(`${spectralClass(ms.T)} V · ${fmt(M, 2)} M☉`, cx, cy + R + 14, C.text, 10, 'center');
    // right: legend + bars
    const x0 = w * 0.62, x1 = w - 12;
    const bar = (y: number, lab: string, v: number, col: string) => { this.text(lab, x0, y, C.text, 10); c.fillStyle = hexA(C.grid, 1); c.fillRect(x0, y + 8, x1 - x0, 12); c.fillStyle = col; c.fillRect(x0, y + 8, (x1 - x0) * Math.min(1, v), 12); this.text(`${fmt(100 * v, v < 0.01 && v > 0 ? 1 : 0)} % of mass`, x1 - 4, y + 14, '#000', 9, 'right'); };
    bar(h * 0.12, 'convective envelope', q.fenv, C.accent);
    bar(h * 0.32, 'convective core', q.fcore, C.blue);
    const cno = M < 1 ? 0.01 * M ** 4 : Math.min(1, 0.01 * M ** 6);
    bar(h * 0.52, 'CNO share of burning', Math.min(1, cno), C.red);
    this.text(M < 1.3 ? 'lower main sequence: pp chain,' : 'upper main sequence: CNO cycle,', x0, h * 0.74, C.dim, 8);
    this.text(M < 1.3 ? 'radiative core, convective envelope' : 'convective core, radiative envelope', x0, h * 0.74 + 11, C.dim, 8);
    this.text(M < 0.35 ? '(fully convective below 0.35 M☉)' : M > 50 ? '(radiation pressure important)' : '', x0, h * 0.74 + 23, C.dim, 8);
    this.setReadout([
      ['T_c, ρ_c', `${sci(q.Tc, 2)} K, ${sci(q.rhoc, 1)}`, C.sun],
      ['L☉, R☉, T_eff', `${fmtSci(ms.L)}, ${fmt(ms.R, 2)}, ${fmt(ms.T, 0)} K`],
      ['Dominant chain', cno > 0.5 ? 'CNO cycle' : 'pp chain', cno > 0.5 ? C.red : C.sun],
      ['Mixed zones', `${q.fenv >= 1 ? 'whole star' : `env ${fmt(100 * q.fenv, 0)} %`}, core ${fmt(100 * q.fcore, 0)} %`],
    ]);
  }
}

/* ------------------------------------------------------- 10.6c lifetimes ---- */

class MsLifetimeWidget extends CanvasWidget {
  private lM = 0;
  private lAge = Math.log10(4.6e9);
  constructor() {
    super(1.8);
    this.slider('Mass', -1, 2, 0.02, this.lM, (v) => `${fmt(10 ** v, 2)} M☉`, (v) => { this.lM = v; });
    this.slider('Cluster age', 6, 10.15, 0.05, this.lAge, (v) => fmtYr(10 ** v), (v) => { this.lAge = v; });
  }
  // fraction of the hydrogen a star gets to burn on the main sequence: ~all of it when fully convective
  // (below ~0.4 M☉), ~10 % for Sun-like stars, more for massive stars with growing convective cores
  private tMS(M: number): number { const fuel = 0.1 + 0.8 / (1 + Math.exp((M - 0.4) / 0.04)) + Math.max(0, Math.min(0.3, 0.15 * Math.log10(M / 1.2))); const ms = mainSequence(M); return 1e10 * (fuel / 0.1) * M / ms.L; }
  protected draw() {
    const c = this.ctx, w = this.w, h = this.h;
    const x0 = 50, x1 = w - 12, y0 = 14, y1 = h - 30;
    axesBox(c, x0, y0, x1, y1);
    const X = (lm: number) => x0 + (lm + 1) / 3 * (x1 - x0);
    const lt0 = 5.5, lt1 = 13.5;
    const Y = (t: number) => y1 - 6 - (Math.min(lt1, Math.max(lt0, Math.log10(t))) - lt0) / (lt1 - lt0) * (y1 - y0 - 12);
    for (let lt = 6; lt <= 13; lt++) { this.line(x0, Y(10 ** lt), x1, Y(10 ** lt), hexA(C.grid, 0.9)); this.text(`10${sup(lt)}`, x0 - 4, Y(10 ** lt), C.dim, 8, 'right'); }
    for (const [lm, lab] of [[-1, '0.1'], [0, '1'], [1, '10'], [2, '100 M☉']] as Array<[number, string]>) this.text(lab, X(lm), y1 + 10, C.dim, 8, 'center');
    this.text('main-sequence lifetime (yr)', x0 + 6, y0 + 10, C.dim, 9);
    const marks: Array<[number, string, string]> = [[1.38e10, 'age of the universe', C.purple], [4.6e9, 'age of the Sun', C.sun], [6.6e7, 'since the dinosaurs', C.dim], [3e5, 'Homo sapiens', C.dim]];
    for (const [t, lab, col] of marks) { this.line(x0, Y(t), x1, Y(t), hexA(col, 0.6), 1, [4, 3]); this.text(lab, x1 - 6, Y(t) - 7, col, 8, 'right'); }
    c.beginPath(); for (let lm = -1; lm <= 2; lm += 0.02) { const px = X(lm), py = Y(this.tMS(10 ** lm)); lm === -1 ? c.moveTo(px, py) : c.lineTo(px, py); } c.strokeStyle = C.star; c.lineWidth = 2.2; c.stroke();
    // cluster age → turn-off mass
    const age = 10 ** this.lAge;
    let mto = 100; for (let lm = -1; lm <= 2; lm += 0.005) { if (this.tMS(10 ** lm) < age) { mto = 10 ** lm; break; } }
    c.fillStyle = hexA(C.red, 0.1); c.fillRect(X(Math.log10(mto)), y0, x1 - X(Math.log10(mto)), y1 - y0);
    this.line(X(Math.log10(mto)), y0, X(Math.log10(mto)), y1, C.red, 1.5, [3, 3]);
    this.text(`turn-off ${fmt(mto, 2)} M☉: stars above have left the sequence`, X(Math.log10(mto)) + 4, y0 + 24, C.red, 8);
    this.line(x0, Y(age), x1, Y(age), hexA(C.red, 0.5), 1);
    const M = 10 ** this.lM; const t = this.tMS(M); const ms = mainSequence(M);
    this.circle(X(this.lM), Y(t), 5, '#fff', C.star);
    this.setReadout([
      ['Mass, type', `${fmt(M, 2)} M☉, ${spectralClass(ms.T)} V`],
      ['Luminosity', `${fmtSci(ms.L)} L☉`],
      ['Main-sequence lifetime', fmtYr(t), C.star],
      ['Generations since Big Bang', t > 1.38e10 ? 'none finished yet' : fmt(1.38e10 / t, 1), t > 1.38e10 ? C.green : C.red],
    ]);
  }
}

/* ==================================================== Chapter 11 widgets ==== */

const MU0 = 4e-7 * Math.PI;
const sub = (n: number) => String(n).replace(/\d/g, (d) => '₀₁₂₃₄₅₆₇₈₉'[+d]);
const M_P = 1.67262e-27;
const T_SUN_AGE = 4.57;   // Gyr
const LSUN_SCALE = 3.84e26;
/** luminosity (L☉) of the Sun at age t (Gyr) — Gough's fit, extended */
const sunL = (t: number) => 1 / (1 + 0.4 * (1 - t / T_SUN_AGE));
const sunR = (t: number) => 0.88 * (sunL(t) / sunL(0)) ** 0.35;
const sunTeff = (t: number) => 5777 * (sunL(t) / sunR(t) ** 2) ** 0.25;
/** central hydrogen fraction at age t (Gyr) and the depletion profile against r/R☉ */
const sunXc = (t: number) => Math.max(0, 0.71 - 0.37 * (t / T_SUN_AGE) ** 0.85);
const sunX = (r: number, t: number) => { const w = 0.13 * (0.8 + 0.2 * t / T_SUN_AGE); return 0.71 - (0.71 - sunXc(t)) * Math.exp(-((r / w) ** 2)); };
const PLOT_MARGIN = 50;
/** draw a polyline y(x) over [xa, xb] with n samples */
function plotCurve(ctx: CanvasRenderingContext2D, xa: number, xb: number, n: number, X: (x: number) => number, Y: (x: number) => number | null, col: string, width = 2, dash?: number[]) {
  ctx.beginPath(); let pen = false;
  for (let i = 0; i <= n; i++) { const x = xa + (xb - xa) * i / n; const y = Y(x); if (y === null || !isFinite(y)) { pen = false; continue; } const px = X(x); pen ? ctx.lineTo(px, y) : ctx.moveTo(px, y); pen = true; }
  ctx.strokeStyle = col; ctx.lineWidth = width; ctx.setLineDash(dash ?? []); ctx.stroke(); ctx.setLineDash([]);
}

/* ---------------------------------------------- 11.1a the Sun through time ---- */

class SunHistoryWidget extends CanvasWidget {
  private t = T_SUN_AGE;
  constructor() {
    super(1.8);
    this.slider('Age of the Sun', 0, 10, 0.02, this.t, (v) => `${fmt(v, 2)} Gyr`, (v) => { this.t = v; });
  }
  protected draw() {
    const c = this.ctx, w = this.w, h = this.h;
    const t = this.t, L = sunL(t), R = sunR(t), T = sunTeff(t);
    // left: the Sun to scale and colour
    const cx = w * 0.2, cy = h * 0.47, R0 = Math.min(w * 0.13, h * 0.3);
    this.glow(cx, cy, R0 * R * 1.5, rgba(tempRGB(T), 0.35));
    const g = c.createRadialGradient(cx, cy, 0, cx, cy, R0 * R);
    g.addColorStop(0, rgba(tempRGB(T + 600), 1)); g.addColorStop(0.85, rgba(tempRGB(T), 1)); g.addColorStop(1, rgba(tempRGB(T - 900), 1));
    c.fillStyle = g; c.beginPath(); c.arc(cx, cy, R0 * R, 0, TAU); c.fill();
    this.circle(cx, cy, R0, hexA('#fff', 0.3), undefined, 1, [3, 3]);
    this.text('dashed: today', cx, cy + R0 * 1.4 + 12, C.dim, 8, 'center');
    this.text(`${spectralClass(T)} V`, cx, cy - R0 * 1.4 - 12, C.text, 10, 'center');
    // right: L, R, T against age
    const x0 = w * 0.42, x1 = w - 12, y0 = 14, y1 = h - 30;
    axesBox(c, x0, y0, x1, y1);
    const X = (tt: number) => x0 + tt / 10 * (x1 - x0);
    const Y = (v: number) => y1 - 6 - (v - 0.5) / 1.6 * (y1 - y0 - 12);
    for (const v of [0.6, 0.8, 1, 1.2, 1.4, 1.6, 1.8, 2]) { this.line(x0, Y(v), x1, Y(v), hexA(C.grid, 0.9)); this.text(fmt(v, 1), x0 - 4, Y(v), C.dim, 8, 'right'); }
    for (const tt of [0, 2, 4, 6, 8, 10]) this.text(`${tt}`, X(tt), y1 + 10, C.dim, 8, 'center');
    this.text('age (Gyr)', x1, y1 + 22, C.dim, 9, 'right');
    this.text('relative to today', x0 + 6, y0 + 10, C.dim, 8);
    plotCurve(c, 0, 10, 200, X, (tt) => Y(sunL(tt)), C.sun);
    plotCurve(c, 0, 10, 200, X, (tt) => Y(sunR(tt)), C.green);
    plotCurve(c, 0, 10, 200, X, (tt) => Y(sunTeff(tt) / 5777), C.blue);
    this.text('L', x1 - 6, Y(sunL(9.6)) - 8, C.sun, 10, 'right'); this.text('R', x1 - 6, Y(sunR(9.8)) - 8, C.green, 10, 'right'); this.text('T_eff', x1 - 6, Y(sunTeff(9.8) / 5777) + 10, C.blue, 10, 'right');
    this.line(X(T_SUN_AGE), y0, X(T_SUN_AGE), y1, hexA('#fff', 0.3), 1, [2, 3]); this.text('today', X(T_SUN_AGE) + 3, y0 + 22, C.dim, 8);
    this.line(X(t), y0, X(t), y1, hexA('#fff', 0.6), 1);
    for (const [v, col] of [[L, C.sun], [R, C.green], [T / 5777, C.blue]] as Array<[number, string]>) this.circle(X(t), Y(v), 4, '#fff', col);
    // Earth
    const Teq = 255 * L ** 0.25;
    const epoch = t < 0.05 ? 'birth of the Sun' : t < 0.6 ? 'the Earth forms (t ≈ 0.05–0.1 Gyr)' : t < 1.1 ? 'faint young Sun: early oceans, first life' : t < 4.4 ? 'Precambrian Earth' : t < 4.7 ? 'the present' : t < 5.6 ? 'oceans begin to evaporate' : t < 9.5 ? 'Earth uninhabitable; Mars warms' : 'core hydrogen nearly exhausted';
    this.setReadout([
      ['L, R, T_eff', `${fmt(L, 2)} L☉, ${fmt(R, 2)} R☉, ${fmt(T, 0)} K`, C.sun],
      ['Solar constant', `${fmt(1361 * L, 0)} W/m²`],
      ['Earth T_eq (A = 0.3, no greenhouse)', `${fmt(Teq, 0)} K = ${fmt(Teq - 273.15, 0)} °C`, Teq < 273 ? C.blue : C.red],
      ['Epoch', epoch, C.dim],
    ]);
  }
}

/* ------------------------------------------------ 11.1b interior composition ---- */

class SolarCompositionWidget extends CanvasWidget {
  private t = T_SUN_AGE;
  constructor() {
    super(1.8);
    this.slider('Age', 0, 10, 0.02, this.t, (v) => `${fmt(v, 2)} Gyr`, (v) => { this.t = v; });
  }
  protected draw() {
    const c = this.ctx, w = this.w, h = this.h;
    const x0 = PLOT_MARGIN, x1 = w - 12, y0 = 14, y1 = h - 30;
    axesBox(c, x0, y0, x1, y1);
    const X = (r: number) => x0 + r * (x1 - x0);
    const Y = (v: number) => y1 - 6 - v * (y1 - y0 - 12);
    c.fillStyle = hexA(C.accent, 0.08); c.fillRect(X(SSM_RCZ), y0, x1 - X(SSM_RCZ), y1 - y0);
    this.text('convection zone (mixed)', X(SSM_RCZ) + 4, y1 - 10, C.accent, 8);
    for (const v of [0.2, 0.4, 0.6, 0.8]) { this.line(x0, Y(v), x1, Y(v), hexA(C.grid, 0.9)); this.text(fmt(v, 1), x0 - 4, Y(v), C.dim, 8, 'right'); }
    for (const r of [0, 0.25, 0.5, 0.75, 1]) this.text(fmt(r, 2), X(r), y1 + 10, C.dim, 8, 'center');
    this.text('r / R☉', x1, y1 + 22, C.dim, 9, 'right');
    this.text('mass fraction', x0 + 6, y0 + 10, C.dim, 8);
    const t = this.t;
    const he3 = (r: number) => 0.03 * Math.min(1, t / 2) * Math.exp(-(((r - 0.28) / 0.08) ** 2)) + 0.0005;
    plotCurve(c, 0, 1, 200, X, (r) => Y(0.71), hexA(C.blue, 0.4), 1, [3, 3]);
    plotCurve(c, 0, 1, 200, X, (r) => Y(0.27), hexA(C.sun, 0.4), 1, [3, 3]);
    plotCurve(c, 0, 1, 200, X, (r) => Y(sunX(r, t)), C.blue);
    plotCurve(c, 0, 1, 200, X, (r) => Y(0.98 - sunX(r, t)), C.sun);
    plotCurve(c, 0, 1, 200, X, (r) => Y(10 * he3(r)), C.green);
    this.text('X (hydrogen)', x1 - 8, Y(0.74) - 10, C.blue, 9, 'right'); this.text('Y (helium)', x1 - 8, Y(0.24) + 10, C.sun, 9, 'right'); this.text('³He × 10', X(0.28), Y(10 * he3(0.28)) - 10, C.green, 9, 'center');
    this.text('dashed: zero-age composition', x0 + 6, y0 + 22, C.dim, 8);
    const Xc = sunXc(t), Yc = 0.98 - Xc;
    const mu = 1 / (2 * Xc + 0.75 * Yc + 0.5 * 0.02);
    // hydrogen consumed inside 0.3 R☉ (≈ 0.6 M☉ of gas) relative to the whole star
    let burned = 0; for (let r = 0; r < 0.5; r += 0.005) { const m = ssmAt(r), m2 = ssmAt(r + 0.005); burned += (0.71 - sunX(r, t)) * (m2.M - m.M); }
    this.setReadout([
      ['Centre X, Y', `${fmt(Xc, 2)}, ${fmt(Yc, 2)}`, C.blue],
      ['Central μ', fmt(mu, 2), C.sun],
      ['Hydrogen burned so far', `${fmt(100 * burned / 0.71, 1)} % of the Sun\'s total`, C.green],
      ['Core', Xc <= 0 ? 'exhausted: main sequence over' : Xc < 0.1 ? 'nearly exhausted' : 'burning', Xc <= 0 ? C.red : C.text],
    ]);
  }
}

/* ------------------------------------------------- 11.1c energy generation ---- */

class SolarEnergyWidget extends CanvasWidget {
  private x = 0.1;
  private prof: Array<{ r: number; pp: number; cno: number; L: number }> = [];
  private r50 = 0; private r99 = 0; private cnoShare = 0;
  constructor() {
    super(1.8);
    this.slider('Cursor r / R☉', 0, 0.4, 0.002, this.x, (v) => fmt(v, 3), (v) => { this.x = v; });
    // integrate once: W m⁻³ profiles, normalised so the total is L☉
    let L = 0; const dr = 0.002;
    for (let r = 0; r <= 0.5; r += dr) {
      const m = ssmAt(r);
      const pp = epsPP(m.rho, m.X, m.T) * m.rho, cno = epsCNO(m.rho, m.X, 0.7 * 0.02 * 0.5, m.T) * m.rho;
      L += (pp + cno) * 4 * Math.PI * (r * RSUN) ** 2 * dr * RSUN;
      this.prof.push({ r, pp, cno, L });
    }
    const k = LSUN_SCALE / L;
    let cnoL = 0;
    for (let i = 0; i < this.prof.length; i++) { const q = this.prof[i]; q.pp *= k; q.cno *= k; q.L *= k; cnoL += q.cno * 4 * Math.PI * (q.r * RSUN) ** 2 * dr * RSUN; }
    this.cnoShare = cnoL / LSUN_SCALE;
    this.r50 = this.prof.find((q) => q.L >= 0.5 * LSUN_SCALE)?.r ?? 0; this.r99 = this.prof.find((q) => q.L >= 0.99 * LSUN_SCALE)?.r ?? 0;
  }
  private at(r: number) { const i = Math.min(this.prof.length - 1, Math.max(0, Math.round(r / 0.002))); return this.prof[i]; }
  protected draw() {
    const c = this.ctx, w = this.w, h = this.h;
    const x0 = PLOT_MARGIN, x1 = w - 46, y0 = 14, y1 = h - 30;
    axesBox(c, x0, y0, x1, y1);
    const X = (r: number) => x0 + r / 0.4 * (x1 - x0);
    const YL = (e: number) => y1 - 6 - (Math.log10(Math.max(e, 1e-3)) + 3) / 6 * (y1 - y0 - 12);
    const YR = (f: number) => y1 - 6 - f * (y1 - y0 - 12);
    for (let le = -2; le <= 2; le++) { this.line(x0, YL(10 ** le), x1, YL(10 ** le), hexA(C.grid, 0.9)); this.text(`10${sup(le)}`, x0 - 4, YL(10 ** le), C.dim, 8, 'right'); }
    for (const f of [0.25, 0.5, 0.75, 1]) this.text(fmt(f, 2), x1 + 4, YR(f), C.green, 8);
    for (const r of [0, 0.1, 0.2, 0.3, 0.4]) this.text(fmt(r, 1), X(r), y1 + 10, C.dim, 8, 'center');
    this.text('r / R☉', x1, y1 + 22, C.dim, 9, 'right');
    this.text('ε (W/m³)', x0 + 6, y0 + 10, C.dim, 8); this.text('L_r / L☉', x1 - 4, y0 + 10, C.green, 8, 'right');
    plotCurve(c, 0, 0.4, 200, X, (r) => YL(this.at(r).pp), C.sun);
    plotCurve(c, 0, 0.4, 200, X, (r) => YL(this.at(r).cno), C.red);
    plotCurve(c, 0, 0.4, 200, X, (r) => YR(this.at(r).L / LSUN_SCALE), C.green);
    this.text('pp chain', X(0.06), YL(this.at(0.06).pp) - 10, C.sun, 9); this.text('CNO cycle', X(0.06), YL(this.at(0.06).cno) + 11, C.red, 9);
    for (const [r, lab] of [[this.r50, '50 %'], [this.r99, '99 %']] as Array<[number, string]>) { this.line(X(r), y0, X(r), y1, hexA(C.green, 0.5), 1, [2, 3]); this.text(lab, X(r) + 3, y0 + 24, C.green, 8); }
    const q = this.at(this.x), m = ssmAt(this.x);
    this.line(X(this.x), y0, X(this.x), y1, hexA('#fff', 0.5), 1);
    this.circle(X(this.x), YL(q.pp), 4, '#fff', C.sun); this.circle(X(this.x), YR(q.L / LSUN_SCALE), 4, '#fff', C.green);
    const tot = q.pp + q.cno;
    this.setReadout([
      ['T, ρ at cursor', `${sci(m.T, 2)} K, ${sci(m.rho, 2)} kg/m³`],
      ['ε (pp + CNO)', `${fmtSci(tot)} W/m³ = ${sci(tot / m.rho, 1)} W/kg`, C.sun],
      ['CNO share here · overall', `${fmt(100 * q.cno / Math.max(tot, 1e-30), 1)} % · ${fmt(100 * this.cnoShare, 1)} %`, C.red],
      ['L_r', `${fmt(100 * q.L / LSUN_SCALE, 1)} % of L☉ (50 % by ${fmt(this.r50, 2)}, 99 % by ${fmt(this.r99, 2)} R☉)`, C.green],
    ]);
  }
}

/* -------------------------------------------------- 11.1d energy transport ---- */

class SolarGradientsWidget extends CanvasWidget {
  private x = 0.5;
  constructor() {
    super(1.8);
    this.slider('Cursor r / R☉', 0.01, 0.995, 0.005, this.x, (v) => fmt(v, 3), (v) => { this.x = v; });
  }
  private gradRad(r: number): number { const m = ssmAt(r); const Mr = Math.max(m.M, 1e-6) * MSUN; return 3 / (16 * Math.PI * A_RAD * C_LIGHT * GRAV) * m.kap * m.P * m.L * LSUN_SCALE / (Mr * m.T ** 4); }
  private gradAd(r: number): number { return 0.4 - 0.25 * Math.exp(-(((r - 0.985) / 0.012) ** 2)); }
  protected draw() {
    const c = this.ctx, w = this.w, h = this.h;
    const x0 = PLOT_MARGIN, x1 = w - 12, y0 = 14, y1 = h - 30;
    axesBox(c, x0, y0, x1, y1);
    const X = (r: number) => x0 + r * (x1 - x0);
    const Y = (g: number) => y1 - 6 - (Math.log10(Math.min(30, Math.max(0.03, g))) + 1.52) / 3 * (y1 - y0 - 12);
    // convective where ∇_rad > ∇_ad
    let rcz = 1; for (let r = 0.3; r < 1; r += 0.002) { if (this.gradRad(r) > this.gradAd(r)) { rcz = r; break; } }
    c.fillStyle = hexA(C.accent, 0.1); c.fillRect(X(rcz), y0, x1 - X(rcz), y1 - y0);
    this.text(`convective (base ${fmt(rcz, 3)} R☉)`, X(rcz) + 4, y1 - 10, C.accent, 8);
    this.text('radiative', X(0.3), y1 - 10, C.dim, 8, 'center');
    for (const g of [0.1, 0.3, 1, 3, 10]) { this.line(x0, Y(g), x1, Y(g), hexA(C.grid, 0.9)); this.text(fmt(g, 1), x0 - 4, Y(g), C.dim, 8, 'right'); }
    for (const r of [0, 0.25, 0.5, 0.75, 1]) this.text(fmt(r, 2), X(r), y1 + 10, C.dim, 8, 'center');
    this.text('r / R☉', x1, y1 + 22, C.dim, 9, 'right');
    this.text('∇ = d ln T / d ln P', x0 + 6, y0 + 10, C.dim, 8);
    plotCurve(c, 0.005, 0.995, 300, X, (r) => Y(this.gradRad(r)), C.red);
    plotCurve(c, 0.005, 0.995, 300, X, (r) => Y(this.gradAd(r)), C.blue);
    this.text('∇_rad (needed to carry L by radiation)', X(0.1), Y(this.gradRad(0.1)) - 12, C.red, 9);
    this.text('∇_ad', X(0.5), Y(0.4) - 10, C.blue, 9);
    const m = ssmAt(this.x);
    const ell = 1 / (m.kap * m.rho);
    // diffusion time from the centre to the cursor: ∫ 3 r κρ / c dr (random walk with local step)
    let tdiff = 0; for (let r = 0.0025; r < Math.min(this.x, rcz); r += 0.005) { const q = ssmAt(r); tdiff += 3 * (r * RSUN) * q.kap * q.rho / C_LIGHT * 0.005 * RSUN; }
    this.line(X(this.x), y0, X(this.x), y1, hexA('#fff', 0.5), 1);
    this.circle(X(this.x), Y(this.gradRad(this.x)), 4, '#fff', C.red); this.circle(X(this.x), Y(this.gradAd(this.x)), 4, '#fff', C.blue);
    this.setReadout([
      ['∇_rad, ∇_ad at cursor', `${fmtSci(this.gradRad(this.x))}, ${fmt(this.gradAd(this.x), 2)}`, this.x > rcz ? C.accent : C.text],
      ['κ̄, ρ', `${fmtSci(m.kap)} m²/kg, ${sci(m.rho, 2)} kg/m³`],
      ['Photon mean free path 1/κ̄ρ', ell < 1e-3 ? `${fmt(ell * 1e6, 0)} μm` : ell < 1 ? `${fmt(ell * 1e3, 2)} mm` : `${fmt(ell, 1)} m`, C.sun],
      ['Diffusion time, centre → cursor', this.x > rcz ? `${fmtYr(tdiff / 3.156e7)} to the CZ base, then weeks by convection` : fmtYr(tdiff / 3.156e7), C.sun],
    ]);
  }
}

/* ------------------------------------------------- 11.1e helioseismology ---- */

/** associated Legendre P_l^m(x), unnormalised, m ≥ 0 */
function legendreP(l: number, m: number, x: number): number {
  let pmm = 1;
  if (m > 0) { const somx2 = Math.sqrt((1 - x) * (1 + x)); let fact = 1; for (let i = 1; i <= m; i++) { pmm *= -fact * somx2; fact += 2; } }
  if (l === m) return pmm;
  let pmmp1 = x * (2 * m + 1) * pmm;
  if (l === m + 1) return pmmp1;
  let pll = 0;
  for (let ll = m + 2; ll <= l; ll++) { pll = (x * (2 * ll - 1) * pmmp1 - (ll + m - 1) * pmm) / (ll - m); pmm = pmmp1; pmmp1 = pll; }
  return pll;
}
class PmodesWidget extends CanvasWidget {
  private l = 6; private m = 3; private t = 0;
  private sM: ReturnType<CanvasWidget['slider']>;
  constructor() {
    super(1.8);
    this.slider('Degree l', 0, 30, 1, this.l, (v) => `${v}`, (v) => { this.l = v; if (this.m > v) { this.m = v; this.sM.set(v); } this.sM.input.max = String(v); });
    this.sM = this.slider('Order m', 0, this.l, 1, this.m, (v) => `${v}`, (v) => { this.m = Math.min(v, this.l); });
    this.playButton();
  }
  protected draw(dt: number) {
    const c = this.ctx, w = this.w, h = this.h;
    this.t += dt;
    const l = this.l, m = this.m;
    const phase = Math.cos(TAU * this.t / 5);   // 5-minute period, 5 s on screen
    // disc
    const cx = w * 0.26, cy = h * 0.5, R = Math.min(w * 0.23, h * 0.44);
    const N = 56; const cell = 2 * R / N;
    let norm = 0; for (let i = 0; i <= 40; i++) norm = Math.max(norm, Math.abs(legendreP(l, m, -1 + 2 * i / 40)));
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
      const px = -R + (i + 0.5) * cell, py = -R + (j + 0.5) * cell;
      const rr = Math.hypot(px, py) / R; if (rr > 1) continue;
      const z = Math.sqrt(1 - rr * rr);               // toward viewer
      const y = -py / R;                              // north up: cos θ (tilted axis 20°)
      const tilt = 20 * DEG; const yy = y * Math.cos(tilt) + z * Math.sin(tilt); const zz = -y * Math.sin(tilt) + z * Math.cos(tilt);
      const lon = Math.atan2(px / R, zz);
      const v = (legendreP(l, m, Math.min(1, Math.max(-1, yy))) / (norm || 1)) * Math.cos(m * lon) * phase;
      const base = tempRGB(5777);
      const k = 0.55 + 0.45 * v;
      c.fillStyle = `rgb(${base[0] * k | 0},${base[1] * k | 0},${(base[2] * k + 90 * Math.max(0, -v)) | 0})`;
      c.fillRect(cx + px - cell / 2, cy + py - cell / 2, cell + 0.5, cell + 0.5);
    }
    this.circle(cx, cy, R, C.line);
    this.text(`Y${sub(l)}${sup(m)} · l = ${l}, m = ${m}`, cx, cy + R + 14, C.text, 10, 'center');
    this.text('blue: moving inward · bright: outward', cx, cy - R - 12, C.dim, 8, 'center');
    // sound speed + turning point
    const x0 = w * 0.6, x1 = w - 12, y0 = 14, y1 = h - 30;
    axesBox(c, x0, y0, x1, y1);
    const X = (r: number) => x0 + r * (x1 - x0);
    const cs = (r: number) => { const q = ssmAt(r); return Math.sqrt(5 / 3 * K_B * q.T / (q.mu * M_H)); };
    const Y = (v: number) => y1 - 6 - (Math.log10(v) - 3.7) / 2 * (y1 - y0 - 12);
    for (const v of [1e4, 3e4, 1e5, 3e5]) { this.line(x0, Y(v), x1, Y(v), hexA(C.grid, 0.9)); this.text(`${fmt(v / 1e3, 0)}`, x0 - 4, Y(v), C.dim, 8, 'right'); }
    this.text('sound speed (km/s)', x0 + 6, y0 + 10, C.dim, 8);
    for (const r of [0, 0.5, 1]) this.text(fmt(r, 1), X(r), y1 + 10, C.dim, 8, 'center'); this.text('r / R☉', x1, y1 + 22, C.dim, 9, 'right');
    plotCurve(c, 0.005, 0.995, 200, X, (r) => Y(cs(r)), C.sun);
    this.line(X(SSM_RCZ), y0, X(SSM_RCZ), y1, hexA(C.accent, 0.5), 1, [2, 3]);
    // inner turning point: c(r)/r = ω/√(l(l+1)) at ν = 3 mHz
    let rt = 0;
    if (l > 0) { const om = TAU * 3e-3, L2 = Math.sqrt(l * (l + 1)); for (let r = 0.01; r < 1; r += 0.005) { if (cs(r) / (r * RSUN) < om / L2) { rt = r; break; } } }
    if (l > 0) { this.line(X(rt), y0, X(rt), y1, C.blue, 1.5, [4, 3]); this.text(`turning point ${fmt(rt, 2)} R☉`, X(rt) + 4, y0 + 24, C.blue, 8); }
    else this.text('l = 0: radial mode, reaches the centre', x0 + 6, y0 + 24, C.blue, 8);
    // model residual (schematic), ×0.1 % scale in a strip
    const ry0 = y1 - 40;
    this.line(x0, ry0, x1, ry0, hexA(C.text, 0.3));
    plotCurve(c, 0.05, 0.95, 100, X, (r) => ry0 - 30 * (0.003 * Math.exp(-(((r - 0.65) / 0.05) ** 2)) - 0.001 * Math.exp(-(((r - 0.2) / 0.1) ** 2)) + 0.0005 * Math.sin(r * 20)) / 0.004, C.green, 1.5);
    this.text('(c_Sun − c_model)/c, ±0.4 % strip', x0 + 6, ry0 - 36, C.green, 8);
    this.setReadout([
      ['Mode', `l = ${l}, m = ${m} · ν ≈ 3.0 mHz (P = 5.5 min)`],
      ['Inner turning point', l > 0 ? `${fmt(rt, 2)} R☉` : 'centre', C.blue],
      ['Surface nodal lines', `${l - m} in latitude, ${m} in longitude`],
      ['Δν (large separation)', `135 μHz · sound crossing ~1 h`, C.sun],
    ]);
  }
}

/* ------------------------------------------------ 11.1f neutrino spectrum ---- */

type NuMode = 'pred' | 'obs' | 'nc';
const NU_LINES: Array<[string, number, number, string]> = [['⁷Be', 0.862, 4.3e9, C.green], ['⁷Be', 0.384, 4.8e8, C.green], ['pep', 1.442, 1.4e8, C.purple]];
function nuContinuum(E: number): Array<[string, number, string]> {
  const beta = (Emax: number, tot: number) => (E > 0 && E < Emax ? tot * 30 / Emax * (E / Emax) ** 2 * (1 - E / Emax) ** 2 : 0);
  return [['pp', beta(0.42, 6.0e10), C.sun], ['⁸B', beta(15, 5.0e6), C.red], ['hep', beta(18.8, 8e3), C.dim], ['CNO', beta(1.73, 5e8), C.blue]];
}
const nuSurvival = (E: number) => 0.32 + 0.25 / (1 + (E / 1.8) ** 3);
class NeutrinoSpectrumWidget extends CanvasWidget {
  private mode: NuMode = 'pred';
  constructor() {
    super(1.8);
    this.segmented<NuMode>([['pred', 'Predicted (SSM)'], ['obs', 'Observed ν_e'], ['nc', 'All flavours (SNO NC)']], this.mode, (v) => { this.mode = v; });
  }
  protected draw() {
    const c = this.ctx, w = this.w, h = this.h;
    const x0 = PLOT_MARGIN + 6, x1 = w - 12, y0 = 14, y1 = h - 30;
    axesBox(c, x0, y0, x1, y1);
    const X = (E: number) => x0 + (Math.log10(E) + 1) / Math.log10(200) * (x1 - x0);
    const Y = (f: number) => y1 - 6 - (Math.log10(Math.max(f, 1)) - 1) / 11 * (y1 - y0 - 12);
    for (let lf = 2; lf <= 12; lf += 2) { this.line(x0, Y(10 ** lf), x1, Y(10 ** lf), hexA(C.grid, 0.9)); this.text(`10${sup(lf)}`, x0 - 4, Y(10 ** lf), C.dim, 8, 'right'); }
    for (const E of [0.1, 0.3, 1, 3, 10]) this.text(`${E}`, X(E), y1 + 10, C.dim, 8, 'center');
    this.text('neutrino energy (MeV)', x1, y1 + 22, C.dim, 9, 'right');
    this.text('flux (cm⁻² s⁻¹ MeV⁻¹; lines: cm⁻² s⁻¹)', x0 + 6, y0 + 10, C.dim, 8);
    // detector thresholds
    for (const [lab, E, col] of [['Ga 0.233', 0.233, C.green], ['Cl 0.814', 0.814, C.accent], ['SK/SNO 5', 5, C.blue], ['Kamiokande 7', 7, C.dim]] as Array<[string, number, string]>) { this.line(X(E), y0, X(E), y1, hexA(col, 0.6), 1, [3, 3]); this.text(lab, X(E) + 3, y0 + 22 + (E > 4 ? 10 : 0), col, 8); }
    const fac = (E: number) => (this.mode === 'obs' ? nuSurvival(E) : 1);
    const names = ['pp', '⁸B', 'hep', 'CNO'];
    names.forEach((_, k) => { plotCurve(c, 0.1, 20, 400, X, (E) => { const f = nuContinuum(E)[k][1] * fac(E); return f > 1 ? Y(f) : null; }, nuContinuum(1)[k][2], 2); });
    for (const [lab, E, f, col] of NU_LINES) { this.line(X(E), y1 - 6, X(E), Y(f * fac(E)), col, 3); this.text(lab, X(E), Y(f * fac(E)) - 8, col, 8, 'center'); }
    this.text('pp', X(0.2), Y(nuContinuum(0.2)[0][1] * fac(0.2)) - 10, C.sun, 9, 'center');
    this.text('⁸B', X(6), Y(nuContinuum(6)[1][1] * fac(6)) - 10, C.red, 9, 'center');
    this.text('CNO', X(1.0), Y(nuContinuum(1.0)[3][1] * fac(1.0)) + 12, C.blue, 9, 'center');
    this.text('hep', X(14), Y(nuContinuum(14)[2][1] * fac(14)) - 10, C.dim, 9, 'center');
    if (this.mode === 'obs') { plotCurve(c, 0.1, 20, 200, X, (E) => y0 + 40 + 30 * (1 - nuSurvival(E)), hexA('#fff', 0.5), 1); this.text('ν_e survival probability (0.32–0.57)', x1 - 6, y0 + 36, hexA('#fff', 0.6), 8, 'right'); }
    const rows: Array<[string, string, string?]> = this.mode === 'pred'
      ? [['Total flux at Earth', '6.5 × 10¹⁰ cm⁻² s⁻¹ (91 % pp)'], ['Cl predicted', '7.6 ± 1.3 SNU', C.accent], ['Ga predicted', '129 SNU', C.green], ['⁸B flux', '5.05 × 10⁶ cm⁻² s⁻¹', C.red]]
      : this.mode === 'obs'
        ? [['Homestake (Cl)', '2.56 SNU = 0.34 of prediction', C.accent], ['GALLEX + SAGE (Ga)', '71 SNU = 0.55', C.green], ['Super-Kamiokande (⁸B)', '0.465 ± 0.015', C.blue], ['SNO charged current (⁸B ν_e)', '0.35 ± 0.03', C.red]]
        : [['SNO neutral current (all flavours)', '5.09 × 10⁶ cm⁻² s⁻¹', C.red], ['SSM ⁸B prediction', '5.05 × 10⁶ cm⁻² s⁻¹ → ratio 1.01 ± 0.12', C.red], ['Conclusion', '2/3 of the ν_e arrive as ν_μ or ν_τ', C.text], ['Borexino (2014–20)', 'pp, ⁷Be, pep, CNO all at the oscillated values', C.green]];
    this.setReadout(rows);
  }
}

/* ---------------------------------------------- 11.1g neutrino oscillation ---- */

class NuOscillationWidget extends CanvasWidget {
  private lE = 0; private s2 = 0.31; private lDm = Math.log10(7.5e-5);
  constructor() {
    super(1.8);
    this.slider('Energy', -1, 1.2, 0.02, this.lE, (v) => `${fmt(10 ** v, 2)} MeV`, (v) => { this.lE = v; });
    this.slider('sin²θ', 0.02, 0.5, 0.01, this.s2, (v) => fmt(v, 2), (v) => { this.s2 = v; });
    this.slider('Δm²', -5, -3.5, 0.02, this.lDm, (v) => `${sci(10 ** v, 1)} eV²`, (v) => { this.lDm = v; });
  }
  private msw(E: number): number {
    const s2 = this.s2, c2t = 1 - 2 * s2, s2t = Math.sqrt(1 - c2t * c2t);
    const beta = 1.52e-5 * E / 10 ** this.lDm;          // ρY_e ≈ 100 g cm⁻³ at production
    const c2m = (c2t - beta) / Math.hypot(c2t - beta, s2t);
    return 0.5 + 0.5 * c2m * c2t;
  }
  protected draw() {
    const c = this.ctx, w = this.w, h = this.h;
    const E = 10 ** this.lE, dm = 10 ** this.lDm, s2 = this.s2, sin22 = 4 * s2 * (1 - s2);
    const Losc = 2.48e-3 * E / dm;   // km
    // left: P_ee vs distance
    const x0 = PLOT_MARGIN, x1 = w * 0.52, y0 = 14, y1 = h - 30;
    axesBox(c, x0, y0, x1, y1);
    const Lmax = 3 * Losc;
    const X = (L: number) => x0 + L / Lmax * (x1 - x0);
    const Y = (p: number) => y1 - 6 - p * (y1 - y0 - 12);
    for (const p of [0.25, 0.5, 0.75, 1]) { this.line(x0, Y(p), x1, Y(p), hexA(C.grid, 0.9)); this.text(fmt(p, 2), x0 - 4, Y(p), C.dim, 8, 'right'); }
    this.text('P(ν_e → ν_e) in vacuum', x0 + 6, y0 + 10, C.dim, 8);
    this.text(`distance (0 – ${Lmax < 1e3 ? `${fmt(Lmax, 0)} km` : `${fmt(Lmax / 1e3, 1)} × 10³ km`})`, x1, y1 + 10, C.dim, 8, 'right');
    plotCurve(c, 0, Lmax, 400, X, (L) => Y(1 - sin22 * Math.sin(1.27 * dm * L / (E * 1e-3)) ** 2), C.sun);
    this.line(x0, Y(1 - sin22 / 2), x1, Y(1 - sin22 / 2), hexA(C.green, 0.7), 1, [4, 3]); this.text(`average 1 − ½ sin²2θ = ${fmt(1 - sin22 / 2, 2)}`, x1 - 6, Y(1 - sin22 / 2) - 8, C.green, 8, 'right');
    // right: survival vs energy for solar neutrinos (MSW)
    const rx0 = w * 0.62, rx1 = w - 12;
    axesBox(c, rx0, y0, rx1, y1);
    const RX = (e: number) => rx0 + (Math.log10(e) + 1) / 2.2 * (rx1 - rx0);
    for (const p of [0.25, 0.5, 0.75, 1]) { this.line(rx0, Y(p), rx1, Y(p), hexA(C.grid, 0.9)); }
    for (const e of [0.1, 1, 10]) this.text(`${e}`, RX(e), y1 + 10, C.dim, 8, 'center'); this.text('E (MeV)', rx1, y1 + 22, C.dim, 9, 'right');
    this.text('P_ee for solar ν (MSW in the Sun)', rx0 + 6, y0 + 10, C.dim, 8);
    plotCurve(c, 0.1, 15.8, 200, RX, (e) => Y(this.msw(e)), C.red);
    const data: Array<[string, number, number, number]> = [['pp', 0.3, 0.57, 0.09], ['⁷Be', 0.862, 0.53, 0.05], ['pep', 1.44, 0.43, 0.11], ['⁸B', 8, 0.32, 0.03]];
    for (const [lab, e, p, err] of data) { this.line(RX(e), Y(p - err), RX(e), Y(p + err), C.text, 1); this.circle(RX(e), Y(p), 3, '#000', C.star); this.text(lab, RX(e), Y(p + err) - 8, C.dim, 8, 'center'); }
    this.text('points: Borexino + SNO/SK', rx1 - 6, y1 - 10, C.dim, 8, 'right');
    this.line(RX(E), y0, RX(E), y1, hexA('#fff', 0.5), 1); this.circle(RX(E), Y(this.msw(E)), 4, '#fff', C.red);
    this.setReadout([
      ['Oscillation length 4πE/Δm²', Losc < 1e3 ? `${fmt(Losc, 1)} km` : `${fmt(Losc / 1e3, 1)} × 10³ km`, C.sun],
      ['Sun–Earth / L_osc', `${sci(1.496e8 / Losc, 1)} oscillations → averaged`],
      ['Vacuum average', fmt(1 - sin22 / 2, 2), C.green],
      [`P_ee with MSW at ${fmt(E, 2)} MeV`, fmt(this.msw(E), 2), C.red],
    ]);
  }
}

/* ------------------------------------------------ 11.2a atmosphere profile ---- */

/** VAL-type mean model: height (km), T (K), n_H (m⁻³) */
const VAL: Array<[number, number, number]> = [
  [-100, 7600, 3.0e23], [0, 6420, 1.2e23], [100, 5800, 4.0e22], [250, 5000, 8.0e21], [500, 4400, 1.5e21], [700, 4900, 4.0e20], [1000, 5900, 9.0e19], [1500, 6400, 1.0e19], [2000, 7000, 2.5e18], [2100, 9000, 1.0e18],
  [2150, 20000, 3.0e17], [2200, 60000, 1.0e17], [2250, 200000, 3.0e16], [2300, 600000, 1.2e16], [2500, 1.0e6, 5.0e15], [5000, 1.4e6, 1.0e15], [10000, 1.6e6, 3.0e14],
];
function valAt(hKm: number): { T: number; n: number } {
  hKm = Math.min(10000, Math.max(-100, hKm));
  let i = 0; while (i < VAL.length - 2 && VAL[i + 1][0] <= hKm) i++;
  const a = VAL[i], b = VAL[i + 1], f = (hKm - a[0]) / (b[0] - a[0]);
  const lg = (k: number) => 10 ** (Math.log10(a[k]) + f * (Math.log10(b[k]) - Math.log10(a[k])));
  return { T: lg(1), n: lg(2) };
}
class AtmProfileWidget extends CanvasWidget {
  private hk = 300;
  private drag = false;
  private readonly hX = (hh: number) => (hh <= 2500 ? (hh + 100) / 2600 * 0.78 : 0.78 + 0.22 * Math.log10(hh / 2500) / Math.log10(4));
  constructor() {
    super(1.8);
    this.slider('Cursor height', -100, 10000, 10, this.hk, (v) => `${fmt(v, 0)} km`, (v) => { this.hk = v; });
    const move = (e: PointerEvent) => { const { x } = canvasPos(this.canvas, e, this.w, this.h); const x0 = PLOT_MARGIN + 6, x1 = this.w - 50; const u = Math.min(1, Math.max(0, (x - x0) / (x1 - x0))); this.hk = u <= 0.78 ? -100 + u / 0.78 * 2600 : 2500 * 4 ** ((u - 0.78) / 0.22); };
    this.canvas.addEventListener('pointerdown', (e) => { this.drag = true; move(e); });
    this.canvas.addEventListener('pointermove', (e) => { if (this.drag) move(e); });
    window.addEventListener('pointerup', () => { this.drag = false; });
  }
  protected draw() {
    const c = this.ctx, w = this.w, h = this.h;
    const x0 = PLOT_MARGIN + 6, x1 = w - 50, y0 = 14, y1 = h - 30;
    axesBox(c, x0, y0, x1, y1);
    const X = (hh: number) => x0 + this.hX(hh) * (x1 - x0);
    const YT = (T: number) => y1 - 6 - (Math.log10(T) - 3.5) / 2.9 * (y1 - y0 - 12);
    const YN = (n: number) => y1 - 6 - (Math.log10(n) - 14) / 10 * (y1 - y0 - 12);
    // layers
    const layers: Array<[number, number, string, string]> = [[-100, 500, 'photosphere', C.sun], [500, 2100, 'chromosphere', C.red], [2100, 2300, 'TR', C.purple], [2300, 10000, 'corona', C.blue]];
    for (const [a, b, lab, col] of layers) { c.fillStyle = hexA(col, 0.07); c.fillRect(X(a), y0, X(b) - X(a), y1 - y0); this.text(lab, (X(a) + X(b)) / 2, y1 - 10, col, 8, 'center'); }
    for (let lt = 4; lt <= 6; lt++) { this.line(x0, YT(10 ** lt), x1, YT(10 ** lt), hexA(C.grid, 0.9)); this.text(`10${sup(lt)}`, x0 - 4, YT(10 ** lt), C.sun, 8, 'right'); }
    for (let ln = 15; ln <= 23; ln += 2) this.text(`10${sup(ln)}`, x1 + 4, YN(10 ** ln), C.green, 8);
    for (const hh of [0, 500, 1000, 1500, 2000, 2500, 5000, 10000]) this.text(hh >= 1000 ? `${hh / 1000}k` : `${hh}`, X(hh), y1 + 10, C.dim, 8, 'center');
    this.text('height above τ₅₀₀ = 1 (km)', x1, y1 + 22, C.dim, 9, 'right');
    this.text('T (K)', x0 + 6, y0 + 10, C.sun, 9); this.text('n_H (m⁻³)', x1 - 4, y0 + 10, C.green, 9, 'right');
    plotCurve(c, -100, 10000, 600, X, (hh) => YT(valAt(hh).T), C.sun);
    plotCurve(c, -100, 10000, 600, X, (hh) => YN(valAt(hh).n), C.green);
    this.text('T minimum 4400 K', X(500), YT(4400) + 12, C.sun, 8, 'center');
    const v = valAt(this.hk);
    this.line(X(this.hk), y0, X(this.hk), y1, hexA('#fff', 0.5), 1);
    this.circle(X(this.hk), YT(v.T), 4, '#fff', C.sun); this.circle(X(this.hk), YN(v.n), 4, '#fff', C.green);
    const P = v.n * 1.1 * K_B * v.T;   // ≈ (n_H + n_e + n_He) k T
    const H = K_B * v.T / ((v.T > 20000 ? 0.6 : 1.3) * M_H * 274);
    const layer = this.hk < 500 ? 'photosphere' : this.hk < 2100 ? 'chromosphere' : this.hk < 2300 ? 'transition region' : 'corona';
    this.setReadout([
      ['Height, layer', `${fmt(this.hk, 0)} km · ${layer}`],
      ['T', `${fmtSci(v.T)} K`, C.sun],
      ['n_H, P', `${sci(v.n, 1)} m⁻³, ${fmtSci(P)} Pa`, C.green],
      ['Scale height kT/μm_H g', H < 1e6 ? `${fmt(H / 1e3, 0)} km` : `${fmt(H / 1e6, 2)} × 10³ km`],
    ]);
  }
}

/* ----------------------------------------------------- 11.2b granulation ---- */

interface Granule { x: number; y: number; vx: number; vy: number; born: number; life: number }
type GranMode = 'int' | 'dop';
type GranScale = 'gran' | 'super';
class GranulationWidget extends CanvasWidget {
  private mode: GranMode = 'int';
  private scale: GranScale = 'gran';
  private seeds: Granule[] = [];
  private t = 0;
  constructor() {
    super(1.8);
    this.segmented<GranMode>([['int', 'Intensity'], ['dop', 'Doppler']], this.mode, (v) => { this.mode = v; });
    this.segmented<GranScale>([['gran', 'Granules'], ['super', 'Supergranules']], this.scale, (v) => { this.scale = v; this.seeds = []; this.t = 0; });
    this.playButton();
    for (let i = 0; i < 70; i++) this.spawn(-Math.random() * 10);
  }
  private spawn(now: number) { this.seeds.push({ x: Math.random(), y: Math.random(), vx: (Math.random() - 0.5) * 0.01, vy: (Math.random() - 0.5) * 0.01, born: now, life: 6 + 6 * Math.random() }); }
  protected draw(dt: number) {
    const c = this.ctx, w = this.w, h = this.h;
    this.t += dt;   // 1 s on screen = 1 min (granules) or 1.5 h (supergranules)
    for (const s of this.seeds) { s.x = (s.x + s.vx * dt + 1) % 1; s.y = (s.y + s.vy * dt + 1) % 1; }
    this.seeds = this.seeds.filter((s) => this.t - s.born < s.life);
    while (this.seeds.length < 70) this.spawn(this.t);
    const pw = w * 0.66, ph = h; const nx = 96, ny = Math.round(nx * ph / pw);
    const cw = pw / nx, ch = ph / ny;
    const base = tempRGB(5777);
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const px = (i + 0.5) / nx, py = (j + 0.5) / ny;
      let d1 = 9, d2 = 9, a1 = 1;
      for (const s of this.seeds) {
        let dx = Math.abs(px - s.x), dy = Math.abs(py - s.y); if (dx > 0.5) dx = 1 - dx; if (dy > 0.5) dy = 1 - dy;
        const age = (this.t - s.born) / s.life; const amp = Math.min(1, age * 5, (1 - age) * 4);
        const d = Math.hypot(dx * pw / ph, dy) / (0.6 + 0.4 * amp);
        if (d < d1) { d2 = d1; d1 = d; a1 = amp; } else if (d < d2) d2 = d;
      }
      const lane = Math.min(1, (d2 - d1) / 0.045);      // 0 in the lane, 1 at the centre
      const v = lane * (0.6 + 0.4 * a1);
      if (this.mode === 'int') { const k = 0.55 + 0.5 * v; c.fillStyle = `rgb(${base[0] * k | 0},${base[1] * k | 0},${base[2] * k | 0})`; }
      else { const up = v - 0.45; c.fillStyle = up > 0 ? `rgb(${120 - 100 * up | 0},${140 - 80 * up | 0},255)` : `rgb(255,${140 + 150 * up | 0},${120 + 150 * up | 0})`; }
      c.fillRect(i * cw, j * ch, cw + 0.5, ch + 0.5);
    }
    const sg = this.scale === 'super';
    const field = sg ? 300000 : 10000, unit = sg ? 'h' : 'min', tScale = sg ? 1.5 : 1;
    this.line(12, h - 14, 12 + pw * (sg ? 30000 : 1000) / field, h - 14, '#fff', 2); this.text(sg ? '30 000 km' : '1000 km', 14 + pw * (sg ? 30000 : 1000) / field, h - 14, '#fff', 8);
    this.text(this.mode === 'dop' ? 'blue: toward you (rising) · red: away (sinking)' : 'bright: hot rising gas · dark lanes: cool sinking gas', pw / 2, 12, '#fff', 9, 'center');
    // right panel: notes
    const x0 = pw + 14;
    this.text(sg ? 'Supergranulation' : 'Granulation', x0, 20, C.text, 11);
    const notes = sg
      ? ['cells ~30 000 km', 'lifetime ~1 day', 'horizontal flow 0.3–0.4 km/s', 'field swept to the lanes:', 'the magnetic network', '(bright in Ca II K)']
      : ['cells 700–1000 km (~scale height)', 'lifetime 5–10 min', 'rise 1–2 km/s, ΔT ~100 K', 'centres 30 % brighter', '~4 million on the Sun', 'convective overshoot'];
    notes.forEach((s, i) => this.text(s, x0, 40 + i * 14, C.dim, 9));
    this.text(`t = ${fmt(this.t * tScale, 0)} ${unit}`, x0, h - 40, C.sun, 11);
    this.text(`${this.seeds.length} cells in view`, x0, h - 24, C.dim, 9);
  }
}

/* -------------------------------------------------------- 11.2c spicules ---- */

interface Spicule { x: number; t0: number; v: number; life: number }
type SpicMode = 'ball' | 'obs';
const FLASH_LINES: Array<[string, number, number]> = [['Ca II K', 393.4, 1], ['Ca II H', 396.8, 0.9], ['Hδ', 410.2, 0.4], ['Hγ', 434.0, 0.5], ['Hβ', 486.1, 0.7], ['Mg I b', 517.5, 0.3], ['He I D₃', 587.6, 0.5], ['Na I D', 589.3, 0.25], ['Hα', 656.3, 1]];
class SpiculesWidget extends CanvasWidget {
  private v = 25; private mode: SpicMode = 'obs'; private t = 0;
  private sp: Spicule[] = [];
  constructor() {
    super(1.8);
    this.segmented<SpicMode>([['obs', 'As observed (rise to ~10 Mm, fade)'], ['ball', 'Ballistic flight']], this.mode, (v) => { this.mode = v; });
    this.slider('Launch speed', 10, 80, 1, this.v, (v) => `${v} km/s`, (v) => { this.v = v; });
    this.playButton();
  }
  protected draw(dt: number) {
    const c = this.ctx, w = this.w, h = this.h;
    this.t += dt * 30;   // 1 s = 30 s solar
    const g = 0.274;     // km/s²
    const hmax = this.v * this.v / (2 * g), tflight = 2 * this.v / g;
    // spawn along network boundaries (clusters)
    if (Math.random() < dt * 6) { const k = Math.floor(Math.random() * 6); this.sp.push({ x: (k + 0.5) / 6 + (Math.random() - 0.5) * 0.06, t0: this.t, v: this.v * (0.8 + 0.4 * Math.random()), life: this.mode === 'ball' ? 2 * this.v * (0.8 + 0.4 * Math.random()) / g : 600 + 300 * Math.random() }); }
    this.sp = this.sp.filter((s) => this.t - s.t0 < s.life);
    // limb view: solar edge at the bottom, height scale 12 000 km over the panel
    const px0 = 10, px1 = w * 0.64, ground = h * 0.72, kmPx = (ground - 20) / 12000;
    c.fillStyle = hexA(C.sun, 0.9); c.fillRect(px0, ground, px1 - px0, h - ground);
    for (let i = 1; i <= 6; i++) { const y = ground - i * 2000 * kmPx; this.line(px0, y, px1, y, hexA(C.grid, 0.8), 1, [2, 4]); this.text(`${i * 2} Mm`, px1 - 4, y - 6, C.dim, 8, 'right'); }
    for (const s of this.sp) {
      const tau = this.t - s.t0;
      let hk: number, alpha: number;
      if (this.mode === 'ball') { hk = s.v * tau - 0.5 * g * tau * tau; alpha = 0.9; }
      else { const up = Math.min(tau, 10000 / s.v); hk = s.v * up; alpha = tau < 10000 / s.v ? 0.9 : Math.max(0, 0.9 * (1 - (tau - 10000 / s.v) / (s.life - 10000 / s.v))); }
      if (hk <= 0) continue;
      const x = px0 + s.x * (px1 - px0);
      const grad = c.createLinearGradient(0, ground, 0, ground - hk * kmPx);
      grad.addColorStop(0, rgba([255, 110, 90], alpha)); grad.addColorStop(1, rgba([255, 60, 60], 0));
      c.fillStyle = grad; c.fillRect(x - 1.5, ground - hk * kmPx, 3, hk * kmPx);
    }
    this.text(this.mode === 'ball' ? `ballistic: h_max = v²/2g = ${fmt(hmax, 0)} km, flight ${fmt(tflight / 60, 1)} min` : 'observed: ~10 000 km at 20–25 km/s, 5–15 min, most fade rather than fall', (px0 + px1) / 2, 12, C.text, 9, 'center');
    this.text('spicules shoot up from the network boundaries (Hα at the limb)', (px0 + px1) / 2, ground + 14, '#000', 8, 'center');
    // flash spectrum
    const sx0 = 10, sx1 = w - 12, sy0 = h * 0.8, sy1 = h - 8;
    c.fillStyle = '#000'; c.fillRect(sx0, sy0, sx1 - sx0, sy1 - sy0);
    const SX = (nm: number) => sx0 + (nm - 380) / 320 * (sx1 - sx0);
    for (const [lab, nm, s] of FLASH_LINES) { c.fillStyle = rgba(waveRGB(nm), 0.3 + 0.7 * s); c.fillRect(SX(nm) - 1, sy0, 2 + s, sy1 - sy0); this.text(lab, SX(nm), sy0 - 7, rgba(waveRGB(nm), 1), 7, 'center'); }
    this.text('flash spectrum: the Fraunhofer lines in emission', sx0 + 4, sy0 + 9, C.dim, 8);
    this.text('400', SX(400), sy1 - 6, C.dim, 7, 'center'); this.text('500', SX(500), sy1 - 6, C.dim, 7, 'center'); this.text('600 nm', SX(600), sy1 - 6, C.dim, 7, 'center');
    // right notes
    const nx = w * 0.67;
    this.text('Chromosphere', nx, 20, C.text, 11);
    ['4400 → 25 000 K', 'density falls 10⁴', 'emission lines (Kirchhoff 2)', 'Hα 656.3 nm: the red colour', 'He discovered here, 1868', `~10⁵ spicules at any time`, 'network · plages · filaments', 'β falls through 1'].forEach((s, i) => this.text(s, nx, 40 + i * 14, C.dim, 9));
    this.text(`${this.sp.length} spicules · t = ${fmt(this.t / 60, 1)} min`, nx, h * 0.72, C.red, 9);
  }
}

/* -------------------------------------------------- 11.2d coronal ionisation ---- */

const FE_STAGES: Array<[string, number, string, string]> = [   // ion, log T peak, line(s), AIA colour
  ['Fe I', 4.0, '', '#886655'], ['Fe II', 4.3, '', '#997766'], ['Fe III', 4.6, '', '#aa8877'], ['Fe VIII', 5.6, '13.1 nm (AIA 131)', '#4cc3b8'], ['Fe IX', 5.85, '17.1 nm (AIA 171)', '#e0b050'], ['Fe X', 6.0, '637.4 nm red line', '#d85a3a'], ['Fe XI', 6.1, '18.0 nm', '#d08040'], ['Fe XII', 6.2, '19.3 nm (AIA 193)', '#c9924e'], ['Fe XIII', 6.25, '20.2 nm', '#b49070'], ['Fe XIV', 6.3, '21.1 nm (AIA 211) · 530.3 nm green line', '#a874c8'], ['Fe XV', 6.35, '28.4 nm', '#8f82d0'], ['Fe XVI', 6.45, '33.5 nm (AIA 335)', '#4a7fd6'], ['Fe XVIII', 6.85, '9.4 nm (AIA 94)', '#6fbf8a'], ['Fe XX', 7.0, '13.3 nm', '#7fd07f'], ['Fe XXIV', 7.3, '19.2 nm (flares)', '#e0e0e0'],
];
function feFractions(lgT: number): number[] { const f = FE_STAGES.map(([, p]) => Math.exp(-(((lgT - p) / 0.13) ** 2))); const s = f.reduce((a, b) => a + b, 1e-9); return f.map((v) => v / s); }
class CoronalIonsWidget extends CanvasWidget {
  private lgT = 6.2;
  constructor() {
    super(1.8);
    this.slider('Temperature', 4, 7.5, 0.01, this.lgT, (v) => `${sci(10 ** v, 1)} K`, (v) => { this.lgT = v; });
  }
  protected draw() {
    const c = this.ctx, w = this.w, h = this.h;
    const x0 = PLOT_MARGIN, x1 = w * 0.62, y0 = 14, y1 = h - 30;
    axesBox(c, x0, y0, x1, y1);
    const X = (lg: number) => x0 + (lg - 4) / 3.5 * (x1 - x0);
    const Y = (f: number) => y1 - 6 - f * (y1 - y0 - 12);
    for (const f of [0.25, 0.5, 0.75, 1]) { this.line(x0, Y(f), x1, Y(f), hexA(C.grid, 0.9)); this.text(fmt(f, 2), x0 - 4, Y(f), C.dim, 8, 'right'); }
    for (let lg = 4; lg <= 7; lg++) this.text(`10${sup(lg)}`, X(lg), y1 + 10, C.dim, 8, 'center');
    this.text('T (K)', x1, y1 + 22, C.dim, 9, 'right'); this.text('fraction of iron in each ionisation stage', x0 + 6, y0 + 10, C.dim, 8);
    // TR lines on the axis
    for (const [lab, lg, col] of [['Lyα', 4.3, C.red], ['C IV', 5.0, C.purple], ['O VI', 5.5, C.blue]] as Array<[string, number, string]>) { this.line(X(lg), y1 - 14, X(lg), y1 - 6, col, 2); this.text(lab, X(lg), y1 - 20, col, 7, 'center'); }
    FE_STAGES.forEach(([ion, , , col], k) => { plotCurve(c, 4, 7.5, 240, X, (lg) => Y(feFractions(lg)[k]), col, 1.5); if (k % 2 === 0 || k > 10) this.text(ion, X(FE_STAGES[k][1]), Y(1) + 18 + (k % 3) * 9, col, 7, 'center'); });
    this.line(X(this.lgT), y0, X(this.lgT), y1, hexA('#fff', 0.5), 1);
    const fr = feFractions(this.lgT);
    let kd = 0; fr.forEach((v, k) => { if (v > fr[kd]) kd = k; });
    // right: tinted disc + lit lines
    const cx = w * 0.8, cy = h * 0.34, R = Math.min(w * 0.14, h * 0.26);
    const col = FE_STAGES[kd][3];
    this.glow(cx, cy, R * 1.6, hexA(col, 0.35));
    const g = c.createRadialGradient(cx, cy, 0, cx, cy, R); g.addColorStop(0, hexA(col, 1)); g.addColorStop(0.8, hexA(col, 0.8)); g.addColorStop(1, hexA(col, 0.3));
    c.fillStyle = g; c.beginPath(); c.arc(cx, cy, R, 0, TAU); c.fill();
    this.text(`dominant: ${FE_STAGES[kd][0]}`, cx, cy + R + 14, col, 10, 'center');
    const lit = FE_STAGES.map((s, k) => [s, fr[k]] as [typeof s, number]).filter(([s, f]) => f > 0.08 && s[2]).sort((a, b) => b[1] - a[1]).slice(0, 4);
    this.text('lines lit at this T:', w * 0.65, h * 0.66, C.dim, 8);
    lit.forEach(([s, f], i) => { this.text(`${s[0]}  ${s[2]}`, w * 0.65, h * 0.66 + 13 + i * 12, s[3], 8); c.fillStyle = hexA(s[3], 0.8); c.fillRect(w * 0.65, h * 0.66 + 19 + i * 12, (w * 0.33) * f, 2); });
    if (!lit.length) this.text(this.lgT < 5.5 ? 'no coronal iron lines: chromosphere / TR (Lyα, C IV, O VI)' : '—', w * 0.65, h * 0.66 + 13, C.dim, 8);
    const where = this.lgT < 4.5 ? 'photosphere / low chromosphere' : this.lgT < 5.7 ? 'transition region' : this.lgT < 6.15 ? 'quiet corona, coronal holes' : this.lgT < 6.6 ? 'active-region corona' : 'flare plasma';
    this.setReadout([
      ['T', `${sci(10 ** this.lgT, 2)} K · ${where}`],
      ['Dominant ion', `${FE_STAGES[kd][0]} (${fmt(100 * fr[kd], 0)} %)`, col],
      ['kT', `${fmt(K_B * 10 ** this.lgT / EV, this.lgT < 5 ? 1 : 0)} eV`],
      ['Thermal emission peaks at', `${fmtSci(2.9e6 / 10 ** this.lgT)} nm (${this.lgT > 6.5 ? 'soft X-rays' : this.lgT > 5.6 ? 'EUV' : 'UV'})`, C.sun],
    ]);
  }
}

/* -------------------------------------------------------- 11.2e solar wind ---- */

function parkerU(x: number): number {   // x = r/r_c → v/c_s on the transonic branch
  const rhs = 4 * Math.log(x) + 4 / x - 3;
  const f = (u: number) => u * u - Math.log(u * u) - rhs;
  let lo: number, hi: number;
  if (x < 1) { lo = 1e-4; hi = 1; } else { lo = 1; hi = 60; }
  for (let i = 0; i < 60; i++) { const mid = (lo + hi) / 2; if (x < 1 ? f(mid) > 0 : f(mid) > 0) { if (x < 1) lo = mid; else hi = mid; } else { if (x < 1) hi = mid; else lo = mid; } }
  return (lo + hi) / 2;
}
class SolarWindWidget extends CanvasWidget {
  private T6 = 1.5;
  constructor() {
    super(1.8);
    this.slider('Coronal temperature', 0.5, 3, 0.05, this.T6, (v) => `${fmt(v, 2)} × 10⁶ K`, (v) => { this.T6 = v; });
  }
  protected draw() {
    const c = this.ctx, w = this.w, h = this.h;
    const T = this.T6 * 1e6, cs = Math.sqrt(2 * K_B * T / M_P), rc = GRAV * MSUN / (2 * cs * cs);
    const v = (r: number) => cs * parkerU(r / rc);
    const x0 = PLOT_MARGIN, x1 = w * 0.6, y0 = 14, y1 = h - 30;
    axesBox(c, x0, y0, x1, y1);
    const X = (r: number) => x0 + Math.log10(r / RSUN) / Math.log10(AU_M / RSUN) * (x1 - x0);
    const Y = (vv: number) => y1 - 6 - vv / 1000e3 * (y1 - y0 - 12);
    for (const vv of [200, 400, 600, 800, 1000]) { this.line(x0, Y(vv * 1e3), x1, Y(vv * 1e3), hexA(C.grid, 0.9)); this.text(`${vv}`, x0 - 4, Y(vv * 1e3), C.dim, 8, 'right'); }
    for (const [r, lab] of [[1, '1 R☉'], [10, '10'], [100, '100'], [215, '1 AU']] as Array<[number, string]>) this.text(lab, X(r * RSUN), y1 + 10, C.dim, 8, 'center');
    this.text('wind speed (km/s)', x0 + 6, y0 + 10, C.dim, 8);
    plotCurve(c, 0, 1, 300, (u) => x0 + u * (x1 - x0), (u) => { const r = RSUN * (AU_M / RSUN) ** u; return r < rc * 0.02 ? null : Y(Math.min(1200e3, v(r))); }, C.sun);
    this.line(X(rc), y0, X(rc), y1, hexA(C.red, 0.6), 1, [3, 3]); this.text(`critical point ${fmt(rc / RSUN, 1)} R☉`, X(rc) + 4, y0 + 24, C.red, 8);
    this.line(x0, Y(cs), x1, Y(cs), hexA(C.red, 0.4), 1, [2, 3]); this.text(`c_s = ${fmt(cs / 1e3, 0)} km/s`, x1 - 6, Y(cs) - 8, C.red, 8, 'right');
    this.circle(X(rc), Y(cs), 4, '#fff', C.red);
    for (const [vv, lab] of [[400e3, 'slow wind'], [750e3, 'fast wind (holes)']] as Array<[number, string]>) { this.line(X(AU_M) - 30, Y(vv), x1, Y(vv), hexA(C.blue, 0.6), 1); this.text(lab, X(AU_M) - 34, Y(vv), C.blue, 7, 'right'); }
    const v1 = v(AU_M);
    this.circle(X(AU_M), Y(v1), 4, '#fff', C.sun);
    // right: Parker spiral, top view, out to 1.2 AU
    const cx = w * 0.8, cy = h * 0.5, Rp = Math.min(w * 0.17, h * 0.42);
    const Om = TAU / (25.4 * 86400);
    this.circle(cx, cy, Rp / 1.2, hexA(C.earth, 0.5), undefined, 1, [2, 3]);
    for (let k = 0; k < 6; k++) {
      c.beginPath();
      for (let r = 0.05; r <= 1.2; r += 0.01) { const rr = r * AU_M; const phi = k * TAU / 6 - Om * (rr - 0.05 * AU_M) / Math.max(v(rr), 1e3); const px = cx + Rp * r / 1.2 * Math.cos(phi), py = cy - Rp * r / 1.2 * Math.sin(phi); r === 0.05 ? c.moveTo(px, py) : c.lineTo(px, py); }
      c.strokeStyle = hexA(C.sun, 0.7); c.lineWidth = 1.2; c.stroke();
    }
    this.glow(cx, cy, 10, C.sun); this.circle(cx + Rp / 1.2, cy, 3, undefined, C.earth);
    const psi = Math.atan(Om * AU_M / v1) / DEG;
    this.text(`Parker spiral · ψ = ${fmt(psi, 0)}° at 1 AU`, cx, cy + Rp + 12, C.dim, 8, 'center');
    // 1 AU numbers from a mass flux of 2 × 10⁹ kg/s
    const n1 = 2e9 / (4 * Math.PI * AU_M * AU_M * M_P * v1);
    let travel = 0; for (let u = 0; u < 1; u += 0.002) { const r = RSUN * (AU_M / RSUN) ** u, r2 = RSUN * (AU_M / RSUN) ** (u + 0.002); if (r > rc * 0.3) travel += (r2 - r) / v(r); }
    this.setReadout([
      ['c_s, r_c', `${fmt(cs / 1e3, 0)} km/s, ${fmt(rc / RSUN, 1)} R☉`, C.red],
      ['v at 1 AU', `${fmt(v1 / 1e3, 0)} km/s`, C.sun],
      ['n at 1 AU (Ṁ = 2 × 10⁹ kg/s)', `${fmt(n1 / 1e6, 1)} cm⁻³`],
      ['Travel time to 1 AU', `${fmt(travel / 86400, 1)} days`],
    ]);
  }
}

/* --------------------------------------------------------------- 11.2f CME ---- */

class CmeWidget extends CanvasWidget {
  private v = 1000; private n = 20; private lM = 12.5; private t = 0;
  constructor() {
    super(1.8);
    this.slider('CME speed', 300, 3000, 10, this.v, (v) => `${v} km/s`, (v) => { this.v = v; this.t = 0; });
    this.slider('Density at 1 AU', 5, 200, 1, this.n, (v) => `${v} cm⁻³`, (v) => { this.n = v; });
    this.slider('Mass', 11.5, 13.5, 0.05, this.lM, (v) => `${sci(10 ** v, 1)} kg`, (v) => { this.lM = v; });
    this.playButton();
  }
  protected draw(dt: number) {
    const c = this.ctx, w = this.w, h = this.h;
    const travel = AU_M / (this.v * 1e3);     // s
    this.t += dt * travel / 8;                 // 1 AU trip takes 8 s on screen
    if (this.t > travel * 1.25) this.t = -travel * 0.1;
    const frac = Math.max(0, this.t / travel);
    // top: Sun → Earth track
    const sx = 40, ex = w * 0.6, yy = h * 0.3;
    this.glow(sx, yy, 26, C.sun); this.circle(sx, yy, 12, undefined, C.sun);
    this.line(sx + 14, yy, ex - 10, yy, hexA(C.grid, 1), 1, [3, 3]);
    this.circle(ex, yy, 5, undefined, C.earth);
    for (const [f, lab] of [[0.39, 'Mercury'], [0.72, 'Venus']] as Array<[number, string]>) { this.circle(sx + f * (ex - sx), yy, 2, undefined, C.dim); this.text(lab, sx + f * (ex - sx), yy + 12, C.dim, 7, 'center'); }
    if (frac > 0 && frac < 1.25) {
      const px = sx + Math.min(frac, 1.2) * (ex - sx); const rr = 6 + 24 * frac;
      const g = c.createRadialGradient(px, yy, 0, px, yy, rr); g.addColorStop(0, hexA(C.red, 0.5)); g.addColorStop(1, hexA(C.red, 0));
      c.fillStyle = g; c.beginPath(); c.arc(px, yy, rr, 0, TAU); c.fill();
      c.strokeStyle = hexA(C.red, 0.8); c.lineWidth = 1.5; c.beginPath(); c.arc(px, yy, rr, -1.2, 1.2); c.stroke();
    }
    this.text(`t = ${fmt(Math.max(0, this.t) / 3600, 1)} h`, (sx + ex) / 2, yy - 36, C.text, 10, 'center');
    this.text(frac >= 1 ? 'arrived: geomagnetic storm' : frac > 0 ? 'CME in transit' : 'launch…', (sx + ex) / 2, yy - 22, frac >= 1 ? C.red : C.dim, 9, 'center');
    // magnetosphere
    const rho = this.n * 1e6 * M_P, ram = rho * (this.v * 1e3) ** 2;
    const B0 = 3.1e-5, rmp = 1.3 * (B0 * B0 / (2 * MU0 * ram)) ** (1 / 6);        // in R_E
    const quietR = 1.3 * (B0 * B0 / (2 * MU0 * 5e6 * M_P * (4e5) ** 2)) ** (1 / 6);
    const r = frac >= 1 && frac < 1.25 ? rmp : quietR;
    const cx = w * 0.8, cy = h * 0.6, s = Math.min(w * 0.16, h * 0.3) / 12;   // px per R_E
    this.circle(cx, cy, 6.6 * s, hexA(C.dim, 0.6), undefined, 1, [2, 3]); this.text('GEO 6.6 R_E', cx, cy + 6.6 * s + 9, C.dim, 7, 'center');
    c.beginPath(); c.moveTo(cx - r * s, cy); for (let a = -90; a <= 90; a += 5) { const y = Math.sin(a * DEG) * r * s * 1.4; const x = -r * s * Math.cos(a * DEG) + 0.4 * y * y / (r * s); c.lineTo(cx + x, cy + y); } c.strokeStyle = hexA(C.blue, 0.8); c.lineWidth = 1.5; c.stroke();
    this.circle(cx, cy, s, undefined, C.earth);
    for (let k = 0; k < 10; k++) this.line(cx - r * s - 8 - k * 4, cy - 40 + k * 9, cx - r * s - 2, cy - 40 + k * 9, hexA(C.red, frac >= 1 ? 0.8 : 0.3), 1);
    this.text(`magnetopause ${fmt(r, 1)} R_E`, cx, cy - r * s * 1.4 - 10, C.blue, 8, 'center');
    const Ek = 0.5 * 10 ** this.lM * (this.v * 1e3) ** 2;
    this.setReadout([
      ['Travel time to 1 AU', `${fmt(travel / 3600, 0)} h = ${fmt(travel / 86400, 1)} days`, C.sun],
      ['Kinetic energy ½mv²', `${sci(Ek, 1)} J = ${sci(Ek / 4.184e15, 1)} Mt TNT`, C.red],
      ['Ram pressure ρv² at 1 AU', `${sci(ram, 1)} Pa`],
      ['Stand-off (quiet → storm)', `${fmt(quietR, 1)} → ${fmt(rmp, 1)} R_E${rmp < 6.6 ? ' — inside GEO!' : ''}`, rmp < 6.6 ? C.red : C.blue],
    ]);
  }
}

/* ------------------------------------------------ 11.2g differential rotation ---- */

type RotMode = 'surf' | 'int';
const omegaSurf = (phiDeg: number) => { const s = Math.sin(phiDeg * DEG); return 14.71 - 2.39 * s * s - 1.79 * s ** 4; };   // deg/day sidereal
class DiffRotWidget extends CanvasWidget {
  private mode: RotMode = 'surf'; private days = 0; private phi = 30;
  constructor() {
    super(1.8);
    this.segmented<RotMode>([['surf', 'Surface: meridians'], ['int', 'Interior (helioseismology)']], this.mode, (v) => { this.mode = v; });
    this.slider('Latitude', 0, 85, 1, this.phi, (v) => `${v}°`, (v) => { this.phi = v; });
    this.playButton();
  }
  protected draw(dt: number) {
    const c = this.ctx, w = this.w, h = this.h;
    this.days += dt * 4;
    const cx = w * 0.3, cy = h * 0.5, R = Math.min(w * 0.26, h * 0.44);
    if (this.mode === 'surf') {
      const g = c.createRadialGradient(cx - R * 0.3, cy - R * 0.3, 0, cx, cy, R); g.addColorStop(0, rgba(tempRGB(6300), 1)); g.addColorStop(1, rgba(tempRGB(5000), 1));
      c.fillStyle = g; c.beginPath(); c.arc(cx, cy, R, 0, TAU); c.fill();
      const om0 = omegaSurf(30);   // frame co-rotating with 30° latitude
      for (let k = 0; k < 8; k++) {
        c.beginPath(); let pen = false;
        for (let lat = -85; lat <= 85; lat += 2) {
          const lon = (k * 45 + (omegaSurf(lat) - om0) * this.days) * DEG;
          const x = Math.cos(lat * DEG) * Math.sin(lon), z = Math.cos(lat * DEG) * Math.cos(lon), y = Math.sin(lat * DEG);
          if (z <= 0) { pen = false; continue; }
          const px = cx + R * x, py = cy - R * y; pen ? c.lineTo(px, py) : c.moveTo(px, py); pen = true;
        }
        c.strokeStyle = hexA(k % 2 ? '#fff' : C.earth, 0.8); c.lineWidth = 1.5; c.stroke();
      }
      for (const lat of [-60, -30, 0, 30, 60]) this.line(cx - R * Math.cos(lat * DEG), cy - R * Math.sin(lat * DEG), cx + R * Math.cos(lat * DEG), cy - R * Math.sin(lat * DEG), hexA('#000', 0.15), 1, [2, 4]);
      const yl = cy - R * Math.sin(this.phi * DEG);
      this.line(cx - R * Math.cos(this.phi * DEG), yl, cx + R * Math.cos(this.phi * DEG), yl, C.red, 1.5);
      this.text(`day ${fmt(this.days, 0)}`, cx, cy + R + 14, C.text, 10, 'center');
      this.text('frame rotating with latitude 30°: equator pulls ahead, poles fall behind', cx, cy - R - 12, C.dim, 8, 'center');
    } else {
      // meridional cut: Ω(r, θ) colour map
      const N = 70;
      for (let i = -N; i <= N; i++) for (let j = -N; j <= N; j++) {
        const x = i / N, y = j / N, r = Math.hypot(x, y); if (r > 1) continue;
        const lat = Math.asin(Math.min(1, Math.abs(y) / Math.max(r, 1e-6))) / DEG;
        const surf = omegaSurf(lat) * 1e9 / (360 * 86400);   // nHz
        const core = 432;
        const f = 0.5 + 0.5 * Math.tanh((r - 0.705) / 0.015);
        const om = core + (surf - core) * f;
        const u = Math.min(1, Math.max(0, (om - 330) / 140));
        c.fillStyle = `rgb(${255 * u | 0},${80 + 100 * (1 - Math.abs(u - 0.5) * 2) | 0},${255 * (1 - u) | 0})`;
        c.fillRect(cx + x * R - R / N / 2, cy - y * R - R / N / 2, R / N + 0.6, R / N + 0.6);
      }
      this.circle(cx, cy, R, C.line); this.circle(cx, cy, R * 0.705, hexA('#fff', 0.7), undefined, 1, [3, 3]);
      this.text('tachocline 0.70 R☉', cx + R * 0.5, cy + R * 0.5 + 10, '#fff', 8);
      this.text('rigid core ~27 d', cx, cy, '#000', 9, 'center');
      this.text('red: fast (25 d) · blue: slow (35 d)', cx, cy + R + 14, C.dim, 8, 'center');
    }
    // right: ω(φ)
    const x0 = w * 0.62, x1 = w - 12, y0 = 14, y1 = h - 30;
    axesBox(c, x0, y0, x1, y1);
    const X = (lat: number) => x0 + lat / 90 * (x1 - x0);
    const Y = (P: number) => y1 - 6 - (P - 24) / 16 * (y1 - y0 - 12);
    for (const P of [26, 30, 34, 38]) { this.line(x0, Y(P), x1, Y(P), hexA(C.grid, 0.9)); this.text(`${P}`, x0 - 4, Y(P), C.dim, 8, 'right'); }
    for (const lat of [0, 30, 60, 90]) this.text(`${lat}°`, X(lat), y1 + 10, C.dim, 8, 'center');
    this.text('rotation period (days)', x0 + 6, y0 + 10, C.dim, 8);
    plotCurve(c, 0, 90, 90, X, (lat) => Y(360 / omegaSurf(lat)), C.sun);
    plotCurve(c, 0, 90, 90, X, (lat) => { const Ps = 360 / omegaSurf(lat); return Y(Ps / (1 - Ps / 365.25)); }, C.green, 1.5, [3, 3]);
    this.text('sidereal', x0 + 8, Y(360 / omegaSurf(5)) - 10, C.sun, 8); this.text('synodic (from Earth)', x0 + 8, Y(360 / omegaSurf(5) / (1 - 360 / omegaSurf(5) / 365.25)) - 10, C.green, 8);
    const Ps = 360 / omegaSurf(this.phi), Psyn = Ps / (1 - Ps / 365.25);
    this.circle(X(this.phi), Y(Ps), 4, '#fff', C.red);
    const Peq = 360 / omegaSurf(0);
    this.setReadout([
      [`ω at ${this.phi}°`, `${fmt(omegaSurf(this.phi), 2)} °/day`, C.sun],
      ['Sidereal period', `${fmt(Ps, 1)} d (equator ${fmt(Peq, 1)} d)`, C.sun],
      ['Synodic period', `${fmt(Psyn, 1)} d`, C.green],
      ['Lap gained by the equator', this.phi < 1 ? '—' : `one every ${fmt(1 / (1 / Peq - 1 / Ps), 0)} days`, C.red],
    ]);
  }
}

/* ---------------------------------------------------------- 11.3a sunspot ---- */

class SunspotWidget extends CanvasWidget {
  private B = 0.3; private Tu = 4000;
  constructor() {
    super(1.8);
    this.slider('Field strength B', 0, 0.4, 0.005, this.B, (v) => `${fmt(v, 3)} T = ${fmt(v * 1e4, 0)} G`, (v) => { this.B = v; });
    this.slider('Umbral temperature', 3500, 5500, 10, this.Tu, (v) => `${v} K`, (v) => { this.Tu = v; });
  }
  protected draw() {
    const c = this.ctx, w = this.w, h = this.h;
    // balance B²/2μ₀ + P_in = P_out at the depth where it works: the spot sinks (Wilson depression) until P_out(z) ≥ B²/2μ₀ / 0.7 (gas inside ~30 % of outside)
    const Pmag = this.B * this.B / (2 * MU0), Pout = Math.max(1.0e4, Pmag / 0.7), Pin = Pout - Pmag;
    const depth = 150 * Math.log(Pout / 1e4);   // km, with a 150 km pressure scale height
    const bright = (this.Tu / 5777) ** 4, brightPen = (5500 / 5777) ** 4;
    // left: the spot
    const cx = w * 0.19, cy = h * 0.47, R = Math.min(w * 0.16, h * 0.36);
    const base = tempRGB(5777);
    c.fillStyle = rgba(base, 1); c.fillRect(cx - R * 1.15, cy - R * 1.15, R * 2.3, R * 2.3);
    for (let i = 0; i < 400; i++) { const a = (i * 2.399) % TAU, rr = R * (0.6 + 0.55 * ((i * 0.618) % 1)); c.fillStyle = hexA('#000', 0.08); c.fillRect(cx + rr * Math.cos(a) - 1, cy + rr * Math.sin(a) - 1, 2, 2); }
    const rU = R * (0.3 + 0.5 * this.B / 0.4);
    c.fillStyle = rgba(tempRGB(5500).map((v) => v * brightPen) as [number, number, number], 1); c.beginPath(); c.arc(cx, cy, R, 0, TAU); c.fill();
    for (let k = 0; k < 90; k++) { const a = k * TAU / 90; this.line(cx + rU * Math.cos(a), cy + rU * Math.sin(a), cx + R * Math.cos(a + 0.05), cy + R * Math.sin(a + 0.05), hexA('#000', 0.25 + 0.2 * (k % 2)), 1.5); }
    c.fillStyle = rgba(tempRGB(this.Tu).map((v) => v * bright) as [number, number, number], 1); c.beginPath(); c.arc(cx, cy, rU, 0, TAU); c.fill();
    this.text('umbra', cx, cy, bright > 0.4 ? '#000' : '#fff', 8, 'center'); this.text('penumbra', cx, cy + (rU + R) / 2, '#000', 7, 'center');
    this.text('photosphere 5777 K', cx, cy - R * 1.15 - 8, C.dim, 8, 'center');
    // middle: pressure balance bars
    const bx = w * 0.4, by0 = h * 0.14, by1 = h * 0.8, bw = w * 0.07;
    const Pmax = Pout * 1.15;
    const Yp = (P: number) => by1 - P / Pmax * (by1 - by0);
    this.text(`pressure (10⁴ Pa) at depth ${fmt(depth, 0)} km`, bx - 8, by0 - 22, C.dim, 8);
    const stepP = Pout > 6e4 ? 2e4 : 1e4;
    for (let P = stepP; P < Pmax; P += stepP) { this.line(bx - 4, Yp(P), bx + bw * 2.6, Yp(P), hexA(C.grid, 0.9)); this.text(`${P / 1e4}`, bx - 8, Yp(P), C.dim, 8, 'right'); }
    c.fillStyle = hexA(C.sun, 0.8); c.fillRect(bx, Yp(Pout), bw, by1 - Yp(Pout)); this.text('outside', bx + bw / 2, by1 + 10, C.sun, 8, 'center'); this.text('P_gas', bx + bw / 2, Yp(Pout) - 8, C.sun, 8, 'center');
    const bx2 = bx + bw * 1.4;
    c.fillStyle = hexA(C.purple, 0.8); c.fillRect(bx2, Yp(Pmag), bw, by1 - Yp(Pmag));
    c.fillStyle = hexA(C.green, 0.8); c.fillRect(bx2, Yp(Pmag + Pin), bw, Yp(Pmag) - Yp(Pmag + Pin));
    this.text('inside', bx2 + bw / 2, by1 + 10, C.purple, 8, 'center');
    if (Pmag / Pmax > 0.08) this.text('B²/2μ₀', bx2 + bw / 2, Yp(Pmag / 2), '#000', 8, 'center');
    if (Pin / Pmax > 0.08) this.text('P_gas', bx2 + bw / 2, Yp(Pmag + Pin / 2), '#000', 8, 'center');
    if (depth > 0) this.text(`Wilson depression ≈ ${fmt(depth, 0)} km`, bx + bw * 1.2, by1 + 22, C.accent, 8, 'center');
    // right: Zeeman triplet of Fe I 630.25 nm
    const x0 = w * 0.62, x1 = w - 12, y0 = h * 0.14, y1 = h * 0.8;
    axesBox(c, x0, y0, x1, y1);
    const dl = 4.67e-8 * 2.5 * 630.25 ** 2 * this.B;   // nm
    const X = (d: number) => x0 + (d + 0.04) / 0.08 * (x1 - x0);
    const prof = (d: number) => { const gw = 0.006; const g = (m: number) => Math.exp(-(((d - m) / gw) ** 2)); return 1 - 0.6 * (0.5 * g(0) + 0.25 * g(dl) + 0.25 * g(-dl)); };
    plotCurve(c, -0.04, 0.04, 300, X, (d) => y1 - 6 - prof(d) * (y1 - y0 - 12), C.text);
    for (const [m, lab, col] of [[0, 'π', C.text], [dl, 'σ+', C.blue], [-dl, 'σ−', C.red]] as Array<[number, string, string]>) { this.line(X(m), y0, X(m), y1, hexA(col, 0.5), 1, [2, 3]); this.text(lab, X(m), y0 + 10, col, 8, 'center'); }
    this.text('Fe I 630.25 nm, g = 2.5', x0 + 6, y1 - 10, C.dim, 8); this.text('−0.04', X(-0.04), y1 + 10, C.dim, 7, 'center'); this.text('+0.04 nm', X(0.04), y1 + 10, C.dim, 7, 'center');
    this.setReadout([
      ['Magnetic pressure B²/2μ₀', `${fmtSci(Pmag)} Pa (photosphere ≈ 10⁴ Pa at τ = 1)`, C.purple],
      ['Balance depth · gas inside', `${depth > 0 ? `${fmt(depth, 0)} km below (P_out ${fmtSci(Pout)} Pa)` : 'at the surface'} · ${fmtSci(Pin)} Pa = ${fmt(100 * Pin / Pout, 0)} %`, C.green],
      ['Umbra brightness (T/5777)⁴', `${fmt(100 * bright, 0)} % · penumbra ${fmt(100 * brightPen, 0)} %`, C.sun],
      ['Zeeman splitting Δλ', `${fmt(dl, 4)} nm = ${fmt(dl * 10, 3)} Å`, C.blue],
    ]);
  }
}

/* ------------------------------------------------------- 11.3b sunspot cycle ---- */

/** cycle start year, peak year, peak sunspot number (v2 scale) */
const CYCLES: Array<[number, number, number]> = [
  [1698, 1705, 90], [1712, 1718, 100], [1723, 1727, 200], [1734, 1738, 175], [1745, 1750, 140], [1755, 1761, 144], [1766, 1769, 193], [1775, 1778, 264], [1784, 1788, 235], [1798, 1805, 82], [1810, 1816, 81], [1823, 1829, 119], [1833, 1837, 245], [1843, 1848, 219], [1855, 1860, 186], [1867, 1870, 234], [1878, 1883, 124], [1890, 1894, 147], [1902, 1906, 107], [1913, 1917, 175], [1923, 1928, 130], [1933, 1937, 199], [1944, 1947, 219], [1954, 1958, 285], [1964, 1968, 157], [1976, 1979, 233], [1986, 1989, 213], [1996, 2001, 180], [2008, 2014, 116], [2019, 2024, 160],
];
function sunspotNumber(year: number): number {
  let R = 0;
  for (const [t0, tp, A] of CYCLES) { const tau = year - t0; if (tau < 0) continue; const x = tau / (tp - t0); R += A * x ** 3 * Math.exp(3 * (1 - x)); }
  return R;
}
class ButterflyWidget extends CanvasWidget {
  private year = 1958.5;
  private spots: Array<[number, number, number]> = [];   // year, latitude, cycle index
  private drag = false;
  constructor() {
    super(1.8);
    this.slider('Year', 1700, 2030, 0.1, this.year, (v) => fmt(v, 1), (v) => { this.year = v; });
    let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    CYCLES.forEach(([t0], k) => { for (let y = t0; y < t0 + 13; y += 0.05) { const n = sunspotNumber(y) / 30; const ph = Math.min(1, (y - t0) / 12); for (let i = 0; i < n; i++) { const lat = (34 - 29 * ph) + (rnd() - 0.5) * 12; this.spots.push([y, rnd() < 0.5 ? lat : -lat, k]); } } });
    const move = (e: PointerEvent) => { const { x } = canvasPos(this.canvas, e, this.w, this.h); const x0 = PLOT_MARGIN, x1 = this.w * 0.7; this.year = Math.min(2030, Math.max(1700, 1700 + (x - x0) / (x1 - x0) * 330)); };
    this.canvas.addEventListener('pointerdown', (e) => { this.drag = true; move(e); });
    this.canvas.addEventListener('pointermove', (e) => { if (this.drag) move(e); });
    window.addEventListener('pointerup', () => { this.drag = false; });
  }
  protected draw() {
    const c = this.ctx, w = this.w, h = this.h;
    const x0 = PLOT_MARGIN, x1 = w * 0.7;
    const X = (y: number) => x0 + (y - 1700) / 330 * (x1 - x0);
    // top: sunspot number
    const y0 = 12, y1 = h * 0.46;
    axesBox(c, x0, y0, x1, y1);
    const Y = (R: number) => y1 - 4 - R / 300 * (y1 - y0 - 8);
    for (const R of [100, 200, 300]) { this.line(x0, Y(R), x1, Y(R), hexA(C.grid, 0.9)); this.text(`${R}`, x0 - 4, Y(R), C.dim, 8, 'right'); }
    c.fillStyle = hexA(C.blue, 0.1); c.fillRect(X(1700), y0, X(1715) - X(1700), y1 - y0); this.text('Maunder min. (1645–1715)', X(1716), y0 + 10, C.blue, 7);
    c.fillStyle = hexA(C.blue, 0.1); c.fillRect(X(1790), y0, X(1830) - X(1790), y1 - y0); this.text('Dalton min.', X(1810), y0 + 10, C.blue, 7, 'center');
    plotCurve(c, 1700, 2030, 660, X, (y) => Y(Math.min(300, sunspotNumber(y))), C.sun, 1.5);
    this.text('sunspot number', x0 + 6, y0 + 10, C.dim, 8);
    this.text('19', X(1958), Y(285) - 7, C.dim, 7, 'center'); this.text('24', X(2014), Y(116) - 7, C.dim, 7, 'center'); this.text('cycle 1', X(1761), Y(144) - 7, C.dim, 7, 'center');
    // bottom: butterfly diagram
    const b0 = h * 0.5, b1 = h - 30;
    axesBox(c, x0, b0, x1, b1);
    const YL = (lat: number) => (b0 + b1) / 2 - lat / 45 * (b1 - b0) / 2;
    for (const lat of [-30, 0, 30]) { this.line(x0, YL(lat), x1, YL(lat), hexA(C.grid, 0.9)); this.text(`${lat}°`, x0 - 4, YL(lat), C.dim, 8, 'right'); }
    for (const [y, lat, k] of this.spots) { if (y < 1700) continue; c.fillStyle = hexA(k % 2 ? C.red : C.blue, 0.55); c.fillRect(X(y), YL(lat), 1.2, 1.2); }
    for (let y = 1700; y <= 2030; y += 50) this.text(`${y}`, X(y), b1 + 10, C.dim, 8, 'center');
    this.text('spot latitude (colour: Hale polarity of the leading spots in the north)', x0 + 6, b0 + 10, C.dim, 8);
    this.line(X(this.year), y0, X(this.year), b1, hexA('#fff', 0.6), 1);
    // right: the disc at this date
    const cx = w * 0.85, cy = h * 0.42, R = Math.min(w * 0.12, h * 0.3);
    const g = c.createRadialGradient(cx - R * 0.3, cy - R * 0.3, 0, cx, cy, R); g.addColorStop(0, rgba(tempRGB(6200), 1)); g.addColorStop(1, rgba(tempRGB(5000), 1));
    c.fillStyle = g; c.beginPath(); c.arc(cx, cy, R, 0, TAU); c.fill();
    const Rn = sunspotNumber(this.year);
    let ci = -1; CYCLES.forEach(([t0, tp], k) => { if (this.year >= t0 && this.year < t0 + 13 && sunspotNumber(this.year) > 2) { if (ci < 0 || Math.abs(this.year - tp) < Math.abs(this.year - CYCLES[ci][1])) ci = k; } });
    const ph = ci >= 0 ? Math.min(1, (this.year - CYCLES[ci][0]) / 12) : 0;
    const groups = Math.round(Rn / 12);
    let s2 = Math.floor(this.year * 10); const r2 = () => { s2 = (s2 * 48271) % 2147483647; return s2 / 2147483647; };
    for (let i = 0; i < groups; i++) {
      const lat = ((34 - 29 * ph) + (r2() - 0.5) * 10) * (r2() < 0.5 ? 1 : -1) * DEG, lon = (r2() - 0.5) * 2.6;
      const x = cx + R * Math.cos(lat) * Math.sin(lon), y = cy - R * Math.sin(lat); const fore = Math.cos(lat) * Math.cos(lon);
      if (fore <= 0) continue;
      const lead = (ci % 2 === 0) === (lat > 0) ? C.blue : C.red, foll = lead === C.blue ? C.red : C.blue;
      this.circle(x + 4 * fore, y, 2.5, undefined, lead); this.circle(x - 4 * fore, y - 1.5, 2, undefined, foll);
    }
    this.text(`${fmt(this.year, 1)}`, cx, cy + R + 14, C.text, 10, 'center');
    this.text(groups ? `R ≈ ${fmt(Rn, 0)} · ${groups} groups` : `R ≈ ${fmt(Rn, 0)}`, cx, cy + R + 27, C.dim, 8, 'center');
    this.text(ci >= 0 ? `cycle ${ci - 4 > 0 ? ci - 4 : `−${5 - ci}`}, year ${fmt(this.year - CYCLES[ci][0], 1)}` : 'minimum', cx, cy - R - 12, C.dim, 8, 'center');
    this.setReadout([
      ['Sunspot number', fmt(Rn, 0), C.sun],
      ['Mean spot latitude', ci >= 0 ? `±${fmt(34 - 29 * ph, 0)}° (Spörer\'s law)` : '—'],
      ['Leading polarity, north', ci >= 0 ? (ci % 2 === 0 ? 'positive (blue)' : 'negative (red)') : '—', ci >= 0 ? (ci % 2 === 0 ? C.blue : C.red) : C.dim],
      ['Period', '11.0 yr spots · 22 yr magnetic'],
    ]);
  }
}

/* ------------------------------------------------------ 11.3c flare energy ---- */

class FlareEnergyWidget extends CanvasWidget {
  private lB = Math.log10(0.03); private lL = Math.log10(1e7); private t = 0;
  constructor() {
    super(1.8);
    this.slider('Field strength', -2.3, -0.7, 0.02, this.lB, (v) => `${fmt(10 ** v * 1e4, 0)} G`, (v) => { this.lB = v; });
    this.slider('Loop size', 6, 8, 0.02, this.lL, (v) => `${fmt(10 ** v / 1e3, 0)} km`, (v) => { this.lL = v; });
    this.playButton();
  }
  protected draw(dt: number) {
    const c = this.ctx, w = this.w, h = this.h;
    this.t = (this.t + dt / 6) % 1;
    const B = 10 ** this.lB, L = 10 ** this.lL;
    const Estored = B * B / (2 * MU0) * L ** 3, E = 0.3 * Estored;
    const flux = 1e-4 * E / 3e24;
    const cls = flux < 1e-7 ? 'A' : flux < 1e-6 ? 'B' : flux < 1e-5 ? 'C' : flux < 1e-4 ? 'M' : 'X';
    const mult = flux / (cls === 'A' ? 1e-8 : cls === 'B' ? 1e-7 : cls === 'C' ? 1e-6 : cls === 'M' ? 1e-5 : 1e-4);
    // left: reconnection cartoon
    const cx = w * 0.27, gy = h * 0.82, S = Math.min(w * 0.24, h * 0.6);
    c.fillStyle = hexA(C.sun, 0.9); c.fillRect(cx - S, gy, 2 * S, h - gy);
    const ph = this.t;   // 0: stressed antiparallel loops; 0.5: X-point; 1: relaxed
    const pinch = ph < 0.5 ? ph * 2 : 1, relax = ph < 0.5 ? 0 : (ph - 0.5) * 2;
    for (let k = 1; k <= 4; k++) {
      const a = k / 4;
      // two arcades pressed together: left foot at −S·a, right foot at +S·a, with a cusp growing toward the centre
      for (const side of [-1, 1]) {
        c.beginPath();
        for (let u = 0; u <= 1; u += 0.02) {
          const x = side * (0.05 + 0.95 * a) * S * (1 - u) + side * 0.03 * S * u;
          const yTop = S * (0.25 + 0.55 * a) * (1 - relax * 0.5);
          const y = gy - yTop * Math.sin(u * Math.PI / 2) ** 0.8 - pinch * (1 - relax) * 0.2 * S * (1 - Math.abs(u - 1)) * u;
          u === 0 ? c.moveTo(cx + x, y) : c.lineTo(cx + x, y);
        }
        c.strokeStyle = hexA(relax > 0 && k < 3 ? C.red : C.blue, 0.85); c.lineWidth = 1.5; c.stroke();
      }
    }
    if (ph > 0.35 && ph < 0.75) { const a = 1 - Math.abs(ph - 0.55) / 0.2; this.glow(cx, gy - S * 0.42, S * 0.25 * a, hexA('#fff', 0.9 * a)); this.text('X-point: reconnection', cx, gy - S * 0.42 - 16 * a, '#fff', 8, 'center'); }
    if (relax > 0) { const y = gy - S * (0.75 + 0.9 * relax); this.glow(cx, y, S * 0.12, hexA(C.red, 0.6)); c.strokeStyle = hexA(C.red, 0.7); c.lineWidth = 1.5; c.beginPath(); c.arc(cx, y + S * 0.1, S * 0.12, Math.PI, 0); c.stroke(); this.text('erupting prominence / CME core', cx, y - S * 0.16, C.red, 8, 'center'); }
    if (relax > 0.2) for (const side of [-1, 1]) { c.fillStyle = hexA('#fff', 0.6 * Math.min(1, relax * 2)); c.fillRect(cx + side * 0.45 * S - 10, gy - 3, 20, 3); }
    this.text(ph < 0.5 ? 'field stressed by photospheric motions' : 'relaxed loops + flare ribbons at the footpoints', cx, 14, C.dim, 8, 'center');
    this.line(cx - S * 0.5, gy + 12, cx + S * 0.5, gy + 12, '#000', 1); this.text(`${fmt(L / 1e3, 0)} km`, cx, gy + 20, '#000', 8, 'center');
    // right: energy ladder
    const x0 = w * 0.6, x1 = w - 12, y0 = 14, y1 = h - 30;
    axesBox(c, x0, y0, x1, y1);
    const Y = (lgE: number) => y1 - 6 - (lgE - 16) / 12 * (y1 - y0 - 12);
    for (let lg = 17; lg <= 27; lg += 2) { this.line(x0, Y(lg), x1, Y(lg), hexA(C.grid, 0.9)); this.text(`10${sup(lg)}`, x0 - 4, Y(lg), C.dim, 8, 'right'); }
    this.text('energy (J)', x0 + 6, y0 + 10, C.dim, 8);
    const marks: Array<[number, string, string]> = [[6.3e13, 'Hiroshima', C.dim], [4.2e17, 'largest H-bomb (100 Mt)', C.dim], [6e20, "world's energy use / yr", C.dim], [3e22, 'C1 flare', C.green], [3e23, 'M1', C.accent], [3e24, 'X1', C.red], [5e25, 'Carrington 1859 (~X45)', C.red], [1e26, 'Proxima superflare 2019', C.purple], [3.84e26, 'Sun, per second', C.sun], [1e28, 'Kepler superflares', C.purple]];
    for (const [e, lab, col] of marks) { if (Math.log10(e) < 16) continue; this.line(x0, Y(Math.log10(e)), x0 + 10, Y(Math.log10(e)), col, 1.5); this.text(lab, x0 + 14, Y(Math.log10(e)), col, 8); }
    const lgE = Math.log10(E);
    this.line(x0, Y(lgE), x1, Y(lgE), hexA('#fff', 0.8), 1.5); this.circle(x1 - 10, Y(lgE), 5, '#fff', cls === 'X' ? C.red : cls === 'M' ? C.accent : C.green);
    this.text(`${cls}${fmt(mult, mult < 10 ? 1 : 0)}`, x1 - 10, Y(lgE) - 12, '#fff', 10, 'center');
    this.setReadout([
      ['Stored B²/2μ₀ · L³', `${sci(Estored, 1)} J (${fmtSci(B * B / (2 * MU0))} J/m³)`, C.blue],
      ['Released (~30 % free energy)', `${sci(E, 1)} J = ${sci(E / 4.184e15, 1)} Mt TNT`, '#fff'],
      ['GOES class (1–8 Å peak)', `${cls}${fmt(mult, mult < 10 ? 1 : 0)} · ${sci(flux, 1)} W/m²`, cls === 'X' ? C.red : cls === 'M' ? C.accent : C.green],
      ['Flare temperature, duration', `${cls === 'X' ? '20–30' : cls === 'M' ? '10–20' : '5–10'} MK · minutes to hours`],
    ]);
  }
}

/* ------------------------------------------------------------- 11.3d dynamo ---- */

class DynamoWidget extends CanvasWidget {
  private yr = 3; private t = 0;
  private sY: ReturnType<CanvasWidget['slider']>;
  constructor() {
    super(1.8);
    this.sY = this.slider('Cycle phase', 0, 22, 0.05, this.yr, (v) => `${fmt(v, 1)} yr`, (v) => { this.yr = v; });
    this.playButton();
  }
  protected draw(dt: number) {
    const c = this.ctx, w = this.w, h = this.h;
    if (this.playing) { this.yr = (this.yr + dt * 1.2) % 22; this.sY.set(Math.round(this.yr * 20) / 20); }
    this.t += dt;
    const yr = this.yr, half = yr % 11, pol = yr < 11 ? 1 : -1;   // pol: sign of the northern polar field at the start of the half-cycle
    const cx = w * 0.3, cy = h * 0.5, R = Math.min(w * 0.26, h * 0.44);
    const g = c.createRadialGradient(cx - R * 0.3, cy - R * 0.3, 0, cx, cy, R); g.addColorStop(0, rgba(tempRGB(6200), 1)); g.addColorStop(1, rgba(tempRGB(5000), 1));
    c.fillStyle = g; c.beginPath(); c.arc(cx, cy, R, 0, TAU); c.fill();
    // field lines beneath the surface: start as meridians, wound by Δω·t with a visual gain
    const wind = Math.min(half, 6) * 0.5;      // winding years (saturates)
    const om0 = omegaSurf(45);
    for (let k = 0; k < 6; k++) {
      c.beginPath(); let pen = false;
      for (let lat = -80; lat <= 80; lat += 2) {
        const lon = (k * 60 + 15 + (omegaSurf(lat) - om0) * wind * 20) * DEG;
        const x = Math.cos(lat * DEG) * Math.sin(lon), z = Math.cos(lat * DEG) * Math.cos(lon), y = Math.sin(lat * DEG);
        if (z <= 0) { pen = false; continue; }
        const px = cx + R * 0.97 * x, py = cy - R * 0.97 * y; pen ? c.lineTo(px, py) : c.moveTo(px, py); pen = true;
      }
      c.strokeStyle = hexA(pol > 0 ? C.blue : C.red, 0.55); c.lineWidth = 1.2; c.stroke();
    }
    // polar caps: reverse at maximum (year ~5.5 of the half cycle)
    const polNow = half < 5.5 ? pol : -pol;
    const capA = Math.abs(half - 5.5) / 5.5;
    for (const s of [1, -1]) { const col = (polNow * s > 0) ? C.blue : C.red; c.fillStyle = hexA(col, 0.25 + 0.5 * capA); c.beginPath(); c.arc(cx, cy, R, s > 0 ? -Math.PI * 0.72 : Math.PI * 0.28, s > 0 ? -Math.PI * 0.28 : Math.PI * 0.72); c.lineTo(cx, cy - s * R * 0.78); c.closePath(); c.fill(); }
    // spots: emerge from year ~1.5, latitude 35 → 5, with Hale polarity and Joy tilt
    const act = half < 1.5 ? 0 : Math.sin(Math.PI * Math.min(1, (half - 1.5) / 9.5));
    const nGroups = Math.round(10 * act);
    let s2 = 11 + Math.floor(yr * 7); const r2 = () => { s2 = (s2 * 48271) % 2147483647; return s2 / 2147483647; };
    const latMean = 35 - 30 * Math.min(1, Math.max(0, (half - 1.5) / 9.5));
    for (let i = 0; i < nGroups; i++) {
      const hemi = r2() < 0.5 ? 1 : -1; const lat = hemi * (latMean + (r2() - 0.5) * 10) * DEG, lon = (r2() - 0.5) * 2.4;
      const fore = Math.cos(lat) * Math.cos(lon); if (fore <= 0) continue;
      const x = cx + R * Math.cos(lat) * Math.sin(lon), y = cy - R * Math.sin(lat);
      const lead = (pol > 0) === (hemi > 0) ? C.blue : C.red, foll = lead === C.blue ? C.red : C.blue;   // Hale's law
      const tilt = Math.abs(lat) * 0.5;   // Joy's law: following spot nearer the pole
      this.circle(x + 5 * fore, y, 3, undefined, lead); this.circle(x - 5 * fore, y - hemi * 5 * Math.sin(tilt), 2.4, undefined, foll);
    }
    // poleward drift arrows of following flux after maximum
    if (half > 5 && half < 10) for (const s of [1, -1]) { const y = cy - s * R * 0.55, y2 = cy - s * R * 0.72; this.line(cx + R * 0.1, y, cx + R * 0.1, y2, hexA('#fff', 0.7), 1.5); this.line(cx + R * 0.1, y2, cx + R * 0.1 - 3, y2 + s * 5, hexA('#fff', 0.7), 1.5); this.line(cx + R * 0.1, y2, cx + R * 0.1 + 3, y2 + s * 5, hexA('#fff', 0.7), 1.5); }
    const stage = half < 1 ? 'minimum: weak poloidal field' : half < 3 ? 'Ω effect: differential rotation winds the field' : half < 5.5 ? 'buoyant flux tubes emerge: bipolar groups (Hale, Joy)' : half < 6.5 ? 'maximum: polar fields reverse' : half < 9.5 ? 'following flux drifts poleward, spots near the equator' : 'decay: poloidal field rebuilt, reversed';
    this.text(stage, cx, cy - R - 12, C.text, 9, 'center');
    this.text(`year ${fmt(yr, 1)} of 22 · ${yr < 11 ? 'first' : 'second'} half: leading spots ${pol > 0 ? 'blue' : 'red'} in the north`, cx, cy + R + 14, C.dim, 8, 'center');
    // right: butterfly building
    const x0 = w * 0.62, x1 = w - 12, y0 = 14, y1 = h - 30;
    axesBox(c, x0, y0, x1, y1);
    const X = (y: number) => x0 + y / 22 * (x1 - x0);
    const YL = (lat: number) => (y0 + y1) / 2 - lat / 45 * (y1 - y0) / 2;
    for (const lat of [-30, 0, 30]) { this.line(x0, YL(lat), x1, YL(lat), hexA(C.grid, 0.9)); this.text(`${lat}°`, x0 - 4, YL(lat), C.dim, 8, 'right'); }
    let s3 = 5; const r3 = () => { s3 = (s3 * 48271) % 2147483647; return s3 / 2147483647; };
    for (let y = 0; y < 22; y += 0.05) { if (y > yr) break; const hh = y % 11; if (hh < 1.5) continue; const a = Math.sin(Math.PI * Math.min(1, (hh - 1.5) / 9.5)); const lm = 35 - 30 * Math.min(1, (hh - 1.5) / 9.5); for (let i = 0; i < a * 4; i++) { const lat = (lm + (r3() - 0.5) * 12) * (r3() < 0.5 ? 1 : -1); c.fillStyle = hexA(y < 11 ? C.blue : C.red, 0.6); c.fillRect(X(y), YL(lat), 1.5, 1.5); } }
    for (const y of [0, 5.5, 11, 16.5, 22]) this.text(y % 11 === 0 ? `min ${y}` : 'max', X(y), y1 + 10, C.dim, 8, 'center');
    this.text('butterfly diagram (years)', x0 + 6, y0 + 10, C.dim, 8);
    this.line(X(yr), y0, X(yr), y1, hexA('#fff', 0.5), 1);
    this.setReadout([
      ['Stage', stage, C.text],
      ['Polar field (north)', polNow > 0 ? 'positive' : 'negative', polNow > 0 ? C.blue : C.red],
      ['Spot latitude', act > 0 ? `±${fmt(latMean, 0)}°` : '—'],
      ['Magnetic Reynolds number', '~10⁸: field frozen into the gas'],
    ]);
  }
}

/* ----------------------------------------------------- 11.3e stellar activity ---- */

type ActType = 'F5' | 'G2' | 'K5' | 'M0' | 'M5';
const ACT_TYPES: Record<ActType, { tau: number; L: number; T: number; P0: number }> = {   // turnover time (d), L_bol (L☉), T_eff, rotation period at the Sun's age (d)
  F5: { tau: 7, L: 3.0, T: 6500, P0: 10 }, G2: { tau: 14, L: 1.0, T: 5777, P0: 25 }, K5: { tau: 25, L: 0.15, T: 4400, P0: 40 }, M0: { tau: 45, L: 0.07, T: 3800, P0: 60 }, M5: { tau: 90, L: 0.004, T: 3000, P0: 100 },
};
const actLxLbol = (Ro: number) => (Ro < 0.1 ? 1e-3 : 1e-3 * (Ro / 0.1) ** -2.3);
class ActivityWidget extends CanvasWidget {
  private type: ActType = 'G2'; private lP = Math.log10(25);
  constructor() {
    super(1.8);
    this.segmented<ActType>([['F5', 'F5 V'], ['G2', 'G2 V (Sun)'], ['K5', 'K5 V'], ['M0', 'M0 V'], ['M5', 'M5 V']], this.type, (v) => { this.type = v; });
    this.slider('Rotation period', -0.7, 2.1, 0.02, this.lP, (v) => `${fmt(10 ** v, 1)} d`, (v) => { this.lP = v; });
  }
  protected draw() {
    const c = this.ctx, w = this.w, h = this.h;
    const x0 = PLOT_MARGIN, x1 = w * 0.66, y0 = 14, y1 = h - 30;
    axesBox(c, x0, y0, x1, y1);
    const X = (Ro: number) => x0 + (Math.log10(Ro) + 2) / 3 * (x1 - x0);
    const Y = (f: number) => y1 - 6 - (Math.log10(f) + 8) / 6 * (y1 - y0 - 12);
    for (let lg = -7; lg <= -3; lg++) { this.line(x0, Y(10 ** lg), x1, Y(10 ** lg), hexA(C.grid, 0.9)); this.text(`10${sup(lg)}`, x0 - 4, Y(10 ** lg), C.dim, 8, 'right'); }
    for (const Ro of [0.01, 0.1, 1, 10]) this.text(`${Ro}`, X(Ro), y1 + 10, C.dim, 8, 'center');
    this.text('Rossby number P_rot / τ_c', x1, y1 + 22, C.dim, 9, 'right'); this.text('L_X / L_bol', x0 + 6, y0 + 10, C.dim, 8);
    c.fillStyle = hexA(C.red, 0.06); c.fillRect(x0, y0, X(0.1) - x0, y1 - y0); this.text('saturated', X(0.03), y0 + 24, C.red, 8, 'center'); this.text('unsaturated: ∝ Ro⁻²·³', X(1.5), y0 + 24, C.dim, 8, 'center');
    plotCurve(c, 0.01, 10, 200, X, (Ro) => Y(actLxLbol(Ro)), C.sun, 2);
    const stars: Array<[string, number, number, string]> = [['Sun', 1.8, 1e-6, C.sun], ['α Cen A', 1.9, 7e-7, C.dim], ['α Cen B', 1.7, 3e-6, C.dim], ['61 Cyg A', 1.4, 3e-6, C.dim], ['Proxima', 0.9, 1e-4, C.red], ['Sun at 100 Myr', 0.36, 3e-5, C.accent], ['EK Dra (G1.5, 50 Myr)', 0.2, 3e-4, C.green], ['AB Dor (K0, 0.5 d)', 0.025, 1e-3, C.blue], ['TRAPPIST-1', 0.03, 7e-4, C.purple]];
    for (const [lab, Ro, f, col] of stars) { this.circle(X(Ro), Y(f), 3, '#000', col); this.text(lab, X(Ro) + 5, Y(f) - (lab.startsWith('α Cen A') ? 8 : -7), col, 7); }
    const T = ACT_TYPES[this.type], P = 10 ** this.lP, Ro = P / T.tau, f = actLxLbol(Ro), LX = f * T.L * LSUN_SCALE;
    const age = 4.57 * (P / T.P0) ** 2;   // Skumanich, scaled per type
    this.circle(X(Ro), Y(f), 5, '#fff', C.star);
    // right: the star and a summary
    const cx = w * 0.84, cy = h * 0.34, R = Math.min(w * 0.1, h * 0.2);
    this.glow(cx, cy, R * (1.3 + 2 * Math.min(1, f / 1e-3)), hexA(C.blue, 0.2 + 0.4 * Math.min(1, f / 1e-3)));
    const g = c.createRadialGradient(cx, cy, 0, cx, cy, R); g.addColorStop(0, rgba(tempRGB(T.T + 500), 1)); g.addColorStop(1, rgba(tempRGB(T.T), 1));
    c.fillStyle = g; c.beginPath(); c.arc(cx, cy, R, 0, TAU); c.fill();
    const nsp = Math.round(12 * Math.min(1, f / 3e-4)); let s2 = 3; const r2 = () => { s2 = (s2 * 48271) % 2147483647; return s2 / 2147483647; };
    for (let i = 0; i < nsp; i++) { const a = r2() * TAU, rr = R * Math.sqrt(r2()) * 0.9; this.circle(cx + rr * Math.cos(a), cy + rr * Math.sin(a), R * (0.05 + 0.1 * r2()), undefined, hexA('#000', 0.6)); }
    this.text(`${this.type} V · P = ${fmt(P, 1)} d`, cx, cy + R + 14, C.text, 9, 'center');
    this.text('corona glow ∝ L_X/L_bol · spots ∝ activity', cx, cy + R + 26, C.dim, 7, 'center');
    const regime = Ro < 0.1 ? 'saturated: young / fast rotator, superflares likely' : Ro < 0.5 ? 'very active: large spots, frequent flares' : Ro < 1.5 ? 'moderately active' : 'quiet, Sun-like or older';
    this.setReadout([
      ['Rossby number', `${fmt(Ro, 2)} (τ_c = ${T.tau} d)`, C.sun],
      ['L_X / L_bol', `${sci(f, 1)} = ${fmt(f / 1e-6, 0)} × Sun`, C.blue],
      ['L_X', `${sci(LX, 1)} W`],
      ['Gyrochronology age · regime', `${age < 0.01 ? '< 10 Myr' : fmtYr(age * 1e9)} · ${regime}`, Ro < 0.5 ? C.red : C.text],
    ]);
  }
}

/* ================================================================================ */
/*  CHAPTER 12 — THE INTERSTELLAR MEDIUM AND STAR FORMATION                          */
/* ================================================================================ */

const YR_S = 3.156e7, MH = 1.6735575e-27;
/** Cardelli, Clayton & Mathis (1989) extinction law: A_λ/A_V for x = 1/λ in μm⁻¹ */
function ccm89(x: number, Rv: number): number {
  let a: number, b: number;
  if (x < 1.1) { a = 0.574 * x ** 1.61; b = -0.527 * x ** 1.61; }
  else if (x < 3.3) { const y = x - 1.82; a = 1 + 0.17699 * y - 0.50447 * y ** 2 - 0.02427 * y ** 3 + 0.72085 * y ** 4 + 0.01979 * y ** 5 - 0.7753 * y ** 6 + 0.32999 * y ** 7; b = 1.41338 * y + 2.28305 * y ** 2 + 1.07233 * y ** 3 - 5.38434 * y ** 4 - 0.62251 * y ** 5 + 5.3026 * y ** 6 - 2.09002 * y ** 7; }
  else if (x < 8) { const fa = x >= 5.9 ? -0.04473 * (x - 5.9) ** 2 - 0.009779 * (x - 5.9) ** 3 : 0, fb = x >= 5.9 ? 0.213 * (x - 5.9) ** 2 + 0.1207 * (x - 5.9) ** 3 : 0; a = 1.752 - 0.316 * x - 0.104 / ((x - 4.67) ** 2 + 0.341) + fa; b = -3.09 + 1.825 * x + 1.206 / ((x - 4.62) ** 2 + 0.263) + fb; }
  else { const y = Math.min(x, 10) - 8; a = -1.073 - 0.628 * y + 0.137 * y ** 2 - 0.07 * y ** 3; b = 13.67 + 4.257 * y - 0.42 * y ** 2 + 0.374 * y ** 3; }
  return a + b / Rv;
}
const ISM_CLOUDS: Array<{ name: string; T: number; n: number; M: number; size: number; Av: string; mu: number }> = [
  { name: 'Diffuse H I cloud', T: 50, n: 5e8, M: 50, size: 5, Av: '< 1', mu: 1 },
  { name: 'Diffuse molecular cloud', T: 30, n: 2e9, M: 30, size: 3, Av: '1–5', mu: 2 },
  { name: 'Giant molecular cloud', T: 15, n: 2e8, M: 3e5, size: 50, Av: '—', mu: 2 },
  { name: 'Dark cloud complex', T: 10, n: 5e8, M: 1e4, size: 10, Av: '~5', mu: 2 },
  { name: 'Clump', T: 10, n: 1e9, M: 30, size: 2, Av: '~10', mu: 2 },
  { name: 'Dense core', T: 10, n: 1e10, M: 10, size: 0.1, Av: '> 10', mu: 2 },
  { name: 'Hot core', T: 200, n: 1e14, M: 300, size: 0.07, Av: '50–1000', mu: 2 },
  { name: 'Bok globule', T: 10, n: 2e10, M: 30, size: 0.5, Av: '~10', mu: 2 },
];
const jeansMass = (T: number, mu: number, rho: number) => (5 * K_B * T / (GRAV * mu * MH)) ** 1.5 * Math.sqrt(3 / (4 * Math.PI * rho));   // kg
const jeansLength = (T: number, mu: number, rho: number) => Math.sqrt(15 * K_B * T / (4 * Math.PI * GRAV * mu * MH * rho));   // m
const freeFallTime = (rho: number) => Math.sqrt(3 * Math.PI / (32 * GRAV * rho));   // s

/* ------------------------------------------------------ 12.1a extinction ---- */

type ExtStar = 'B0' | 'A0' | 'G2' | 'K5';
const EXT_STARS: Record<ExtStar, { T: number; MV: number; BV: number; label: string }> = { B0: { T: 30000, MV: -4.0, BV: -0.30, label: 'B0 V' }, A0: { T: 9600, MV: 0.6, BV: 0.0, label: 'A0 V' }, G2: { T: 5777, MV: 4.8, BV: 0.65, label: 'G2 V' }, K5: { T: 4000, MV: -0.2, BV: 1.5, label: 'K5 III' } };
class ExtinctionWidget extends CanvasWidget {
  private Av = 1.1; private Rv = 3.1; private lkpc = Math.log10(0.8); private star: ExtStar = 'B0'; private t = 0;
  constructor() {
    super(1.8);
    this.segmented<ExtStar>([['B0', 'B0 V'], ['A0', 'A0 V'], ['G2', 'G2 V (Sun)'], ['K5', 'K5 III']], this.star, (v) => { this.star = v; });
    this.slider('Extinction A_V', 0, 5, 0.05, this.Av, (v) => `${fmt(v, 2)} mag`, (v) => { this.Av = v; });
    this.slider('R_V = A_V / E(B−V)', 2.2, 5.5, 0.05, this.Rv, (v) => fmt(v, 2), (v) => { this.Rv = v; });
    this.slider('Distance', -1, 0.7, 0.02, this.lkpc, (v) => `${fmt(10 ** v, 2)} kpc`, (v) => { this.lkpc = v; });
  }
  protected draw(dt: number) {
    const c = this.ctx, w = this.w, h = this.h; this.t += dt;
    const S = EXT_STARS[this.star], d = 10 ** this.lkpc * 1e3;
    const AB = this.Av * ccm89(1 / 0.44, this.Rv), EBV = AB - this.Av;
    const mV = S.MV + 5 * Math.log10(d) - 5 + this.Av, mV0 = mV - this.Av;
    const dApp = 10 ** ((mV - S.MV + 5) / 5);
    // left: geometry
    const gx0 = 10, gx1 = w * 0.46, gy = h * 0.42;
    const sx = gx0 + 22, cx = (gx0 + gx1) / 2, cw = (gx1 - gx0) * 0.22;
    for (let i = 0; i < 70; i++) { const a = i * 2.399, r = cw * 0.9 * Math.sqrt((i * 0.618) % 1); const x = cx + r * Math.cos(a) * 1.1, y = gy + r * Math.sin(a) * 0.9; this.glow(x, y, cw * 0.35, hexA('#5a4632', 0.06 + 0.1 * Math.min(1, this.Av / 2))); }
    this.text('dust cloud', cx, gy - cw - 10, C.dim, 8, 'center');
    const col = tempRGB(S.T);
    this.glow(sx, gy, 14, rgba(col, 0.8)); this.circle(sx, gy, 4, undefined, rgba(col, 1)); this.text(S.label, sx, gy + 16, C.dim, 8, 'center');
    const ax = gx1 - 12; const red = tempRGB(Math.max(2500, S.T / (1 + 0.5 * EBV)));
    for (let k = 0; k < 7; k++) { const ph = ((this.t * 0.25 + k / 7) % 1); const x = sx + (ax - sx) * ph; const inside = Math.abs(x - cx) < cw; const colK = x > cx + cw * 0.3 ? red : col; c.fillStyle = rgba(colK, inside ? 0.5 : 0.9); c.fillRect(x, gy - 1 + (k - 3) * 1.2, 3, 2); }
    this.text('A', ax, gy + 14, C.text, 10, 'center'); this.text('reddened, dimmed', ax, gy + 26, C.dim, 8, 'center');
    const by = gy - cw - 34; this.line(cx, gy - cw * 0.8, cx + 20, by + 8, hexA(C.blue, 0.6), 1, [2, 3]); this.circle(cx + 22, by + 6, 2, undefined, C.blue);
    for (let k = 0; k < 4; k++) { const ph = ((this.t * 0.35 + k / 4) % 1); c.fillStyle = hexA(C.blue, 0.7); c.fillRect(cx + 20 * ph, gy - cw * 0.8 - (cw * 0.8 + gy - by - 8) * ph, 2, 2); }
    this.text('B: blue reflection nebula', cx + 28, by + 6, C.blue, 8);
    // left-bottom: magnitudes bar
    const my = h * 0.78; const Xm = (m: number) => gx0 + 20 + (m + 5) / 25 * (gx1 - gx0 - 30);
    this.line(gx0 + 20, my, gx1 - 10, my, C.grid, 1); for (let m = -5; m <= 20; m += 5) { this.text(`${m}`, Xm(m), my + 10, C.dim, 7, 'center'); }
    this.text('apparent V magnitude', gx0 + 20, my - 22, C.dim, 8);
    this.circle(Xm(mV0), my, 4, '#000', C.sun); this.text('no dust', Xm(mV0), my - 10, C.sun, 7, 'center');
    this.circle(Xm(mV), my, 4, '#000', C.red); this.text(`with A_V`, Xm(mV), my + 22, C.red, 7, 'center');
    // right: spectrum
    const x0 = w * 0.55, x1 = w - 12, y0 = 14, y1 = h - 30;
    axesBox(c, x0, y0, x1, y1);
    const X = (nm: number) => x0 + (nm - 300) / 700 * (x1 - x0);
    let pk = 0; for (let nm = 300; nm <= 1000; nm += 5) pk = Math.max(pk, planck(nm * 1e-9, S.T));
    const Y = (f: number) => y1 - 6 - f / pk * (y1 - y0 - 14);
    for (let nm = 300; nm < 1000; nm += 5) { c.fillStyle = rgba(waveRGB(nm), 0.12); c.fillRect(X(nm), y0, X(nm + 5) - X(nm) + 0.5, y1 - y0); }
    plotCurve(c, 300, 1000, 140, X, (nm) => Y(planck(nm * 1e-9, S.T)), C.text, 1.5, [3, 3]);
    plotCurve(c, 300, 1000, 140, X, (nm) => Y(planck(nm * 1e-9, S.T) * 10 ** (-0.4 * this.Av * ccm89(1000 / nm, this.Rv))), C.red, 2);
    for (const [nm, lab] of [[365, 'U'], [440, 'B'], [550, 'V'], [800, 'I']] as Array<[number, string]>) { this.line(X(nm), y0, X(nm), y1, hexA(C.grid, 1), 1, [2, 4]); this.text(lab, X(nm), y0 + 10, C.dim, 8, 'center'); }
    this.text('intrinsic', x1 - 6, y0 + 10, C.text, 8, 'right'); this.text('through the cloud', x1 - 6, y0 + 22, C.red, 8, 'right');
    this.text('300', X(300), y1 + 10, C.dim, 7, 'center'); this.text('1000 nm', X(1000), y1 + 10, C.dim, 7, 'center');
    this.setReadout([
      ['Apparent magnitude', `V = ${fmt(mV, 2)} (would be ${fmt(mV0, 2)} without dust)`, C.red],
      ['Colour excess E(B−V)', `${fmt(EBV, 2)} → observed B−V = ${fmt(S.BV + EBV, 2)} (intrinsic ${fmt(S.BV, 2)})`, C.blue],
      ['Optical depth · dust column', `τ_V = ${fmt(this.Av / 1.086, 2)} · N_d ≈ ${sci(this.Av / 1.086 / 2e-13, 1)} m⁻² · n_d ≈ ${sci(this.Av / 1.086 / 2e-13 / (d * PC_M), 1)} m⁻³`],
      ['Distance if dust is ignored', `${fmt(dApp / 1e3, 2)} kpc instead of ${fmt(d / 1e3, 2)}: ${fmt(100 * (dApp / d - 1), 0)} % too far`, C.accent],
    ]);
  }
}

/* --------------------------------------------- 12.1b Mie + extinction curve ---- */

class ExtcurveWidget extends CanvasWidget {
  private la = Math.log10(0.1); private Rv = 3.1;
  constructor() {
    super(1.8);
    this.slider('Grain radius a', -2, 0.3, 0.02, this.la, (v) => `${fmt(10 ** v, 10 ** v < 0.1 ? 3 : 2)} μm`, (v) => { this.la = v; });
    this.slider('R_V (grain-size proxy)', 2.2, 5.5, 0.05, this.Rv, (v) => fmt(v, 2), (v) => { this.Rv = v; });
  }
  protected draw() {
    const c = this.ctx, w = this.w, h = this.h;
    const a = 10 ** this.la;   // μm
    const Q = (x: number) => { const r = 2 * x * 0.5; return x < 0.02 ? 0 : 2 - 4 * Math.sin(r) / r + 4 * (1 - Math.cos(r)) / (r * r); };   // anomalous diffraction, m = 1.5
    // left: Q vs x = 2πa/λ
    const x0 = PLOT_MARGIN, x1 = w * 0.46, y0 = 14, y1 = h - 30;
    axesBox(c, x0, y0, x1, y1);
    const X = (lx: number) => x0 + (lx + 1.5) / 3 * (x1 - x0);
    const Y = (q: number) => y1 - 6 - q / 4 * (y1 - y0 - 12);
    for (const q of [1, 2, 3]) { this.line(x0, Y(q), x1, Y(q), hexA(C.grid, 0.9)); this.text(`${q}`, x0 - 4, Y(q), C.dim, 8, 'right'); }
    for (const lx of [-1, 0, 1]) this.text(lx === 0 ? '1' : `10${sup(lx)}`, X(lx), y1 + 10, C.dim, 8, 'center');
    this.text('x = 2πa/λ', x1, y1 + 22, C.dim, 9, 'right'); this.text('Q_ext = σ/πa²', x0 + 6, y0 + 10, C.dim, 8);
    const xv0 = Math.log10(2 * Math.PI * a / 0.7), xv1 = Math.log10(2 * Math.PI * a / 0.4);
    c.fillStyle = hexA(C.sun, 0.12); c.fillRect(X(Math.max(-1.5, xv0)), y0, X(Math.min(1.5, xv1)) - X(Math.max(-1.5, xv0)), y1 - y0);
    this.text('visible', X((Math.max(-1.5, xv0) + Math.min(1.5, xv1)) / 2), y1 - 12, C.sun, 8, 'center');
    plotCurve(c, -1.5, 1.5, 300, X, (lx) => Y(Q(10 ** lx)), C.text, 2);
    plotCurve(c, -1.5, Math.log10(2), 60, X, (lx) => Y(Math.min(4, 0.9 * 10 ** lx)), C.accent, 1, [3, 3]);
    this.text('Q ~ a/λ', X(0.1), Y(1.2) - 10, C.accent, 8); this.text('Q → 2 (blocked)', X(1.2), Y(2.1) - 10, C.dim, 8, 'center'); this.text('Q → 0', X(-1.2), Y(0.15) - 10, C.dim, 8, 'center');
    // right: CCM extinction curve
    const u0 = w * 0.57, u1 = w - 12;
    axesBox(c, u0, y0, u1, y1);
    const U = (ix: number) => u0 + ix / 10 * (u1 - u0);
    const V = (r: number) => y1 - 6 - r / 7 * (y1 - y0 - 12);
    for (const r of [1, 2, 3, 4, 5, 6]) { this.line(u0, V(r), u1, V(r), hexA(C.grid, 0.9)); this.text(`${r}`, u0 - 4, V(r), C.dim, 8, 'right'); }
    for (const ix of [2, 4, 6, 8, 10]) this.text(`${ix}`, U(ix), y1 + 10, C.dim, 8, 'center');
    this.text('1/λ (μm⁻¹)', u1, y1 + 22, C.dim, 9, 'right'); this.text('A_λ / A_V', u0 + 6, y0 + 10, C.dim, 8);
    for (const [ix, lab] of [[1 / 0.365, 'U'], [1 / 0.44, 'B'], [1 / 0.55, 'V']] as Array<[number, string]>) { this.line(U(ix), y0, U(ix), y1, hexA(C.grid, 1), 1, [2, 4]); this.text(lab, U(ix), y0 + 22, C.dim, 8, 'center'); }
    plotCurve(c, 0.3, 10, 300, U, (ix) => V(Math.min(7, ccm89(ix, 3.1))), hexA(C.dim, 0.6), 1, [3, 3]);
    plotCurve(c, 0.3, 10, 300, U, (ix) => V(Math.min(7, ccm89(ix, this.Rv))), C.red, 2);
    plotCurve(c, 0.3, 10, 100, U, (ix) => V(Math.min(7, ix / (1 / 0.55))), C.accent, 1, [4, 3]);
    this.text('Mie ∝ 1/λ', U(6.5), V(6.5 * 0.55) - 10, C.accent, 8, 'center');
    this.text('217.5 nm bump', U(4.6), V(ccm89(4.6, this.Rv)) - 12, C.red, 8, 'center');
    this.text(`R_V = ${fmt(this.Rv, 1)}`, u1 - 6, y0 + 10, C.red, 8, 'right'); this.text('R_V = 3.1 (diffuse ISM)', u1 - 6, y0 + 22, C.dim, 8, 'right');
    const qV = Q(2 * Math.PI * a / 0.55);
    this.setReadout([
      ['At 550 nm', `x = ${fmt(2 * Math.PI * a / 0.55, 2)} · Q = ${fmt(qV, 2)} · σ = ${sci(qV * Math.PI * (a * 1e-6) ** 2, 1)} m²`, C.text],
      ['Regime', a < 0.03 ? 'λ ≫ a: nearly transparent in the visible (UV only)' : a < 0.3 ? 'λ ~ a: strong reddening, σ ∝ a³/λ' : 'λ ≪ a: grey extinction, σ ∝ a²', C.accent],
      ['A_B/A_V · E(B−V)/A_V', `${fmt(ccm89(1 / 0.44, this.Rv), 2)} · ${fmt(1 / this.Rv, 2)}`, C.red],
      ['Bump · far-UV', `A(217.5)/A_V = ${fmt(ccm89(4.6, this.Rv), 1)} · A(125 nm)/A_V = ${fmt(ccm89(8, this.Rv), 1)}`],
    ]);
  }
}

/* -------------------------------------------------------- 12.1c 21-cm line ---- */

class Hi21cmWidget extends CanvasWidget {
  private lN = 25; private T = 80; private dv = 10; private t = 0;
  constructor() {
    super(1.8);
    this.slider('H I column density N_H', 23.5, 26.5, 0.02, this.lN, (v) => `10^${fmt(v, 1)} m⁻²`, (v) => { this.lN = v; });
    this.slider('Spin temperature', 10, 300, 1, this.T, (v) => `${v} K`, (v) => { this.T = v; });
    this.slider('Line width (FWHM)', 2, 30, 0.5, this.dv, (v) => `${fmt(v, 1)} km/s`, (v) => { this.dv = v; });
  }
  protected draw(dt: number) {
    const c = this.ctx, w = this.w, h = this.h; this.t += dt;
    const N = 10 ** this.lN, tau = 5.2e-23 * N / (this.T * this.dv);   // 5.2e-19 for N in cm⁻²
    // left: atom
    const cx = w * 0.22, cy = h * 0.42, R = Math.min(w * 0.14, h * 0.26);
    const period = 6, ph = (this.t % period) / period, aligned = ph < 0.5;
    this.circle(cx, cy, R, hexA(C.grid, 1), undefined, 1, [3, 3]);
    this.circle(cx, cy, 7, undefined, C.red); this.text('p', cx, cy, '#000', 9, 'center');
    const arrow = (x: number, y: number, dir: number, col: string, len = 14) => { this.line(x, y + dir * len / 2, x, y - dir * len / 2, col, 2); this.line(x, y - dir * len / 2, x - 3, y - dir * len / 2 + dir * 4, col, 2); this.line(x, y - dir * len / 2, x + 3, y - dir * len / 2 + dir * 4, col, 2); };
    arrow(cx, cy - 14, 1, C.red, 12);
    const ea = this.t * 1.6; const ex = cx + R * Math.cos(ea), ey = cy + R * Math.sin(ea);
    this.circle(ex, ey, 4, undefined, C.blue); arrow(ex, ey - 12, aligned ? 1 : -1, C.blue, 12);
    this.text(aligned ? 'spins parallel: higher energy' : 'spins antiparallel: ground state', cx, cy - R - 16, aligned ? C.accent : C.green, 9, 'center');
    if (!aligned && ph < 0.75) { const q = (ph - 0.5) / 0.25; const px = cx + R * 1.1 + q * (w * 0.2); c.beginPath(); for (let i = 0; i <= 40; i++) { const x = px - 24 + i * 1.2, y = cy + 6 * Math.sin(i * 0.7 + this.t * 20); i ? c.lineTo(x, y) : c.moveTo(x, y); } c.strokeStyle = hexA(C.sun, 1 - q * 0.6); c.lineWidth = 1.5; c.stroke(); this.text('λ = 21.1 cm · ν = 1420 MHz · hν = 5.9 μeV', cx, cy + R + 16, C.sun, 8, 'center'); }
    else this.text('spontaneous flip once in 11 Myr · collisions every ~100 yr', cx, cy + R + 16, C.dim, 8, 'center');
    // right: profile
    const x0 = w * 0.5, x1 = w - 12, y0 = 14, y1 = h - 30;
    axesBox(c, x0, y0, x1, y1);
    const X = (v: number) => x0 + (v + 40) / 80 * (x1 - x0);
    const Tmax = 300; const Y = (T: number) => y1 - 6 - T / Tmax * (y1 - y0 - 12);
    for (const T of [100, 200, 300]) { this.line(x0, Y(T), x1, Y(T), hexA(C.grid, 0.9)); this.text(`${T}`, x0 - 4, Y(T), C.dim, 8, 'right'); }
    for (const v of [-40, -20, 0, 20, 40]) this.text(`${v}`, X(v), y1 + 10, C.dim, 8, 'center');
    this.text('velocity (km/s)', x1, y1 + 22, C.dim, 9, 'right'); this.text('brightness temperature T_B (K)', x0 + 6, y0 + 10, C.dim, 8);
    const sig = this.dv / 2.3548;
    const tauV = (v: number) => tau * Math.exp(-(v * v) / (2 * sig * sig));
    this.line(x0, Y(this.T), x1, Y(this.T), hexA(C.accent, 0.6), 1, [4, 3]); this.text(`T_spin = ${this.T} K (saturation)`, x1 - 6, Y(this.T) - 8, C.accent, 8, 'right');
    plotCurve(c, -40, 40, 200, X, (v) => Y(Math.min(Tmax, this.T * tauV(v))), hexA(C.dim, 0.7), 1, [3, 3]);
    plotCurve(c, -40, 40, 200, X, (v) => Y(this.T * (1 - Math.exp(-tauV(v)))), C.sun, 2);
    this.text('optically thin: T_B = T τ', x0 + 6, y0 + 22, C.dim, 8); this.text('T_B = T (1 − e^−τ)', x0 + 6, y0 + 34, C.sun, 8);
    const sigmaMsun = N * MH * PC_M ** 2 / MSUN;
    this.setReadout([
      ['Optical depth at line centre τ_H', `${fmt(tau, tau < 0.1 ? 3 : 2)} — ${tau < 0.3 ? 'optically thin: T_B ∝ N_H' : tau < 1 ? 'turning over' : 'optically thick: T_B → T, N_H hidden'}`, tau < 0.3 ? C.green : tau < 1 ? C.accent : C.red],
      ['Peak brightness temperature', `${fmt(this.T * (1 - Math.exp(-tau)), 1)} K`, C.sun],
      ['Mass per unit area', `${fmt(sigmaMsun, 1)} M☉ pc⁻² (N_H m_H)`],
      ['Path length for n = 5 × 10⁸ m⁻³', `${fmt(N / 5e8 / PC_M, N / 5e8 / PC_M < 10 ? 2 : 0)} pc`],
    ]);
  }
}

/* ----------------------------------------------------- 12.1d ISM phases ---- */

class IsmPhasesWidget extends CanvasWidget {
  private sel = 5;
  constructor() {
    super(1.8);
    this.canvas.addEventListener('pointerdown', (e) => { const { x, y } = canvasPos(this.canvas, e, this.w, this.h); let best = -1, bd = 1e9; ISM_CLOUDS.forEach((cl, i) => { const [px, py] = this.pos(cl); const d = Math.hypot(px - x, py - y); if (d < bd) { bd = d; best = i; } }); if (bd < 40) this.sel = best; });
  }
  private pos(cl: { n: number; T: number }): [number, number] { const x0 = PLOT_MARGIN, x1 = this.w * 0.64, y0 = 14, y1 = this.h - 30; return [x0 + (Math.log10(cl.n) - 7.5) / 8 * (x1 - x0), y1 - (Math.log10(cl.T) - 0.7) / 2.1 * (y1 - y0)]; }
  protected draw() {
    const c = this.ctx, w = this.w, h = this.h;
    const x0 = PLOT_MARGIN, x1 = w * 0.64, y0 = 14, y1 = h - 30;
    axesBox(c, x0, y0, x1, y1);
    for (let lx = 8; lx <= 15; lx++) { const [px] = this.pos({ n: 10 ** lx, T: 10 }); this.line(px, y0, px, y1, hexA(C.grid, 0.8)); this.text(`10${sup(lx)}`, px, y1 + 10, C.dim, 8, 'center'); }
    for (const T of [10, 100, 1000]) { const [, py] = this.pos({ n: 1e8, T }); this.line(x0, py, x1, py, hexA(C.grid, 0.8)); this.text(`${T}`, x0 - 4, py, C.dim, 8, 'right'); }
    this.text('number density n (m⁻³)', x1, y1 + 22, C.dim, 9, 'right'); this.text('T (K)', x0 + 6, y0 + 10, C.dim, 8);
    // isobars nT = const
    for (const lp of [10, 11, 12, 14, 16]) { c.beginPath(); let pen = false; for (let lx = 7.5; lx <= 15.5; lx += 0.1) { const lT = lp - lx; if (lT < 0.7 || lT > 2.8) { pen = false; continue; } const [px, py] = this.pos({ n: 10 ** lx, T: 10 ** lT }); pen ? c.lineTo(px, py) : c.moveTo(px, py); pen = true; } c.strokeStyle = hexA(C.line, 0.6); c.lineWidth = 1; c.setLineDash([2, 4]); c.stroke(); c.setLineDash([]); const [px, py] = this.pos({ n: 10 ** (lp - 2.75), T: 10 ** 2.75 }); if (px > x0 && px < x1) this.text(`nT = 10${sup(lp)}`, px + 4, py + 8, C.faint, 7); }
    ISM_CLOUDS.forEach((cl, i) => {
      const [px, py] = this.pos(cl); const r = 6 + 6 * Math.log10(cl.size * 20 + 1);
      const mj = jeansMass(cl.T, cl.mu, cl.mu * MH * cl.n) / MSUN; const unstable = cl.M > mj;
      const col = unstable ? C.red : C.blue;
      this.circle(px, py, r, i === this.sel ? '#fff' : hexA(col, 0.9), hexA(col, i === this.sel ? 0.5 : 0.25), i === this.sel ? 2 : 1);
      this.text(cl.name.replace('Giant molecular cloud', 'GMC').replace('Dark cloud complex', 'dark complex').replace('Diffuse molecular cloud', 'diffuse molecular').replace('Diffuse H I cloud', 'diffuse H I'), px, py - r - 8, i === this.sel ? C.text : C.dim, 8, 'center');
    });
    this.text('circle size ∝ log(cloud size) · red: M > M_J (unstable) · blue: stable', x0 + 6, y0 + 22, C.dim, 8);
    // right: card
    const cl = ISM_CLOUDS[this.sel]; const rx = w * 0.69, ry = 14;
    this.text(cl.name, rx, ry + 10, C.text, 12);
    const rows: Array<[string, string]> = [['T', `${cl.T} K`], ['n', `${sci(cl.n, 0)} m⁻³ = ${sci(cl.n / 1e6, 0)} cm⁻³`], ['Mass', `${cl.M >= 1000 ? sci(cl.M, 0) : cl.M} M☉`], ['Size', `${cl.size} pc`], ['A_V', cl.Av], ['μ', `${cl.mu} (${cl.mu === 1 ? 'atomic' : 'molecular'})`], ['Pressure nT', `${sci(cl.n * cl.T, 1)} K m⁻³`], ['Free-fall time', fmtYr(freeFallTime(cl.mu * MH * cl.n) / YR_S)]];
    rows.forEach(([k, v], i) => { this.text(k, rx, ry + 34 + i * 16, C.dim, 9); this.text(v, w - 12, ry + 34 + i * 16, C.text, 9, 'right'); });
    const mj = jeansMass(cl.T, cl.mu, cl.mu * MH * cl.n) / MSUN;
    const vol = 4 / 3 * Math.PI * (cl.size / 2 * PC_M) ** 3, Mrho = cl.n * cl.mu * MH * vol / MSUN;
    this.setReadout([
      ['Jeans mass at this T, n', `${mj >= 100 ? sci(mj, 1) : fmt(mj, 1)} M☉ — ${cl.M > mj ? 'cloud mass exceeds it: unstable' : 'cloud mass below it: stable'}`, cl.M > mj ? C.red : C.blue],
      ['Mass from n × volume', `${Mrho >= 1000 ? sci(Mrho, 1) : fmt(Mrho, 1)} M☉ (uniform sphere; real clouds are clumpy)`],
      ['Vacuum comparison', `${sci(cl.n / 1e6, 0)} cm⁻³ vs ~10⁴ cm⁻³ in the best laboratory vacuum, 2.5 × 10¹⁹ in air`],
    ]);
  }
}

/* --------------------------------------------------- 12.1e heating/cooling ---- */

class HeatcoolWidget extends CanvasWidget {
  private ln = 8; private lG = 0; private Av = 0; private lz = -17;
  constructor() {
    super(1.8);
    this.slider('Density n', 7, 13, 0.05, this.ln, (v) => `10^${fmt(v, 1)} m⁻³`, (v) => { this.ln = v; });
    this.slider('UV field G₀ (Habing units)', -1, 3, 0.05, this.lG, (v) => `${fmt(10 ** v, 10 ** v < 1 ? 2 : 0)}`, (v) => { this.lG = v; });
    this.slider('Depth into the cloud A_V', 0, 10, 0.1, this.Av, (v) => `${fmt(v, 1)} mag`, (v) => { this.Av = v; });
    this.slider('Cosmic-ray ionisation rate ζ', -18, -15, 0.05, this.lz, (v) => `10^${fmt(v, 1)} s⁻¹`, (v) => { this.lz = v; });
  }
  /** heating per H nucleus (erg/s) and cooling per H² (erg cm³/s), cgs */
  private rates(ncm: number, T: number, G0: number, Av: number, zeta: number) {
    const Tdust = 10 * Math.pow(1 + G0 * Math.exp(-1.0 * Av), 0.2);
    const heat = zeta * 1.6e-11 + 2e-26 * G0 * Math.exp(-2.5 * Av) / (1 + ncm / 1e5);   // cosmic rays (10 eV per ionisation) + photoelectric on grains
    const line = 2e-26 * (1e7 * Math.exp(-1.184e5 / (T + 1000)) + 1.4e-2 * Math.sqrt(T) * Math.exp(-92 / T)) / (1 + ncm / 1e3);   // Lyα + C II / O I (Koyama & Inutsuka 2002), C⁺ → CO at high n
    const co = 1e-31 * Math.pow(T / 10, 2.5) / (1 + ncm / 3e3);   // CO rotational lines, optically thick at high n
    const dust = 2e-33 * Math.sqrt(T) * (T - Tdust);   // gas–grain collisions
    return { heat, cool: line + co + dust, Tdust };
  }
  private teq(ncm: number, G0: number, Av: number, zeta: number): number {
    let lo = 0.3, hi = 4.2;
    for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2, T = 10 ** mid; const r = this.rates(ncm, T, G0, Av, zeta); if (ncm * r.cool > r.heat) hi = mid; else lo = mid; }
    return 10 ** ((lo + hi) / 2);
  }
  protected draw() {
    const c = this.ctx, w = this.w, h = this.h;
    const ncm = 10 ** this.ln / 1e6, G0 = 10 ** this.lG, zeta = 10 ** this.lz;
    const Teq = this.teq(ncm, G0, this.Av, zeta), rq = this.rates(ncm, Teq, G0, this.Av, zeta);
    // left: heating vs cooling against T at this n
    const x0 = PLOT_MARGIN, x1 = w * 0.47, y0 = 14, y1 = h - 30;
    axesBox(c, x0, y0, x1, y1);
    const X = (lT: number) => x0 + (lT - 0.5) / 3.5 * (x1 - x0);
    const Y = (lr: number) => y1 - 6 - (lr + 30) / 10 * (y1 - y0 - 12);
    for (let lr = -29; lr <= -21; lr += 2) { this.line(x0, Y(lr), x1, Y(lr), hexA(C.grid, 0.9)); this.text(`10${sup(lr)}`, x0 - 4, Y(lr), C.dim, 7, 'right'); }
    for (const lT of [1, 2, 3, 4]) this.text(`10${sup(lT)}`, X(lT), y1 + 10, C.dim, 8, 'center');
    this.text('T (K)', x1, y1 + 22, C.dim, 9, 'right'); this.text('rate per H atom (erg s⁻¹)', x0 + 6, y0 + 10, C.dim, 8);
    plotCurve(c, 0.5, 4, 200, X, (lT) => Y(Math.log10(ncm * this.rates(ncm, 10 ** lT, G0, this.Av, zeta).cool)), C.blue, 2);
    plotCurve(c, 0.5, 4, 200, X, (lT) => Y(Math.log10(this.rates(ncm, 10 ** lT, G0, this.Av, zeta).heat)), C.red, 2);
    this.text('cooling n Λ(T)', x1 - 6, y0 + 10, C.blue, 8, 'right'); this.text('heating Γ', x1 - 6, y0 + 22, C.red, 8, 'right');
    this.circle(X(Math.log10(Teq)), Y(Math.log10(rq.heat)), 5, '#fff', C.sun); this.text(`T_eq = ${fmt(Teq, 0)} K`, X(Math.log10(Teq)), Y(Math.log10(rq.heat)) - 14, C.sun, 9, 'center');
    // right: T_eq vs n with cloud types
    const u0 = w * 0.58, u1 = w - 12;
    axesBox(c, u0, y0, u1, y1);
    const U = (ln: number) => u0 + (ln - 7) / 6 * (u1 - u0);
    const V = (lT: number) => y1 - 6 - (lT - 0.5) / 2.5 * (y1 - y0 - 12);
    for (const lT of [1, 2, 3]) { this.line(u0, V(lT), u1, V(lT), hexA(C.grid, 0.9)); this.text(`10${sup(lT)}`, u0 - 4, V(lT), C.dim, 8, 'right'); }
    for (let ln = 8; ln <= 12; ln += 2) this.text(`10${sup(ln)}`, U(ln), y1 + 10, C.dim, 8, 'center');
    this.text('n (m⁻³)', u1, y1 + 22, C.dim, 9, 'right'); this.text('equilibrium T (K)', u0 + 6, y0 + 10, C.dim, 8);
    plotCurve(c, 7, 13, 120, U, (ln) => V(Math.log10(this.teq(10 ** ln / 1e6, G0, this.Av, zeta))), C.sun, 2);
    plotCurve(c, 7, 13, 120, U, (ln) => V(Math.log10(this.teq(10 ** ln / 1e6, 1, 0, 1e-17))), hexA(C.dim, 0.6), 1, [3, 3]);
    this.text('G₀ = 1, A_V = 0, ζ = 10⁻¹⁷', u1 - 6, y1 - 12, C.dim, 7, 'right');
    for (const cl of ISM_CLOUDS) { if (cl.n > 1e13) continue; this.circle(U(Math.log10(cl.n)), V(Math.log10(cl.T)), 3, undefined, hexA(C.blue, 0.8)); this.text(cl.name.replace('Giant molecular cloud', 'GMC').replace('Diffuse H I cloud', 'diffuse H I').replace('Diffuse molecular cloud', 'diffuse mol.').replace('Dark cloud complex', 'dark complex'), U(Math.log10(cl.n)) + 5, V(Math.log10(cl.T)) - 6, C.dim, 7); }
    this.circle(U(this.ln), V(Math.log10(Teq)), 5, '#fff', C.sun);
    const crPart = zeta * 1.6e-11 / rq.heat;
    this.setReadout([
      ['Equilibrium temperature', `${fmt(Teq, 0)} K (dust at ${fmt(rq.Tdust, 0)} K)`, C.sun],
      ['Heating', `${fmt(100 * crPart, 0)} % cosmic rays · ${fmt(100 * (1 - crPart), 0)} % photoelectric (UV × e^−2.5A_V = ${sci(G0 * Math.exp(-2.5 * this.Av), 1)})`, C.red],
      ['Cooling', Teq > 3000 ? 'Lyα dominates' : Teq > 40 ? 'C II 158 μm and O I 63 μm fine-structure lines' : ncm > 1e3 ? 'CO rotational lines + gas–dust collisions' : 'C II 158 μm', C.blue],
      ['Timescale to cool', `${fmtYr(1.5 * K_B * Teq / (ncm * 1e6 * rq.cool * 1e-7 * 1e-6) / YR_S)} (≪ free-fall: the gas stays in thermal balance)`],
    ]);
  }
}

/* ---------------------------------------------------------- 12.2a Jeans ---- */

class JeansWidget extends CanvasWidget {
  private lT = 1; private mu = 2; private ln = 10;
  constructor() {
    super(1.8);
    this.slider('Temperature', 0.7, 2.3, 0.02, this.lT, (v) => `${fmt(10 ** v, 0)} K`, (v) => { this.lT = v; });
    this.segmented<'1' | '2'>([['1', 'atomic H (μ = 1)'], ['2', 'molecular H₂ (μ = 2)']], '2', (v) => { this.mu = +v; });
    this.slider('Density n', 7, 15, 0.05, this.ln, (v) => `10^${fmt(v, 1)} m⁻³`, (v) => { this.ln = v; });
  }
  protected draw() {
    const c = this.ctx, w = this.w, h = this.h;
    const T = 10 ** this.lT, n = 10 ** this.ln, rho = this.mu * MH * n;
    const MJ = jeansMass(T, this.mu, rho), RJ = jeansLength(T, this.mu, rho);
    const vT = Math.sqrt(K_B * T / (this.mu * MH)), P0 = rho * vT * vT, MBE = 1.18 * vT ** 4 / (Math.sqrt(P0) * GRAV ** 1.5);
    const x0 = PLOT_MARGIN, x1 = w * 0.64, y0 = 14, y1 = h - 30;
    axesBox(c, x0, y0, x1, y1);
    const X = (ln: number) => x0 + (ln - 7) / 8 * (x1 - x0);
    const Y = (lM: number) => y1 - 6 - (lM + 2) / 9 * (y1 - y0 - 12);
    for (let lM = -1; lM <= 6; lM++) { this.line(x0, Y(lM), x1, Y(lM), hexA(C.grid, 0.9)); this.text(`10${sup(lM)}`, x0 - 4, Y(lM), C.dim, 8, 'right'); }
    for (let ln = 8; ln <= 14; ln += 2) this.text(`10${sup(ln)}`, X(ln), y1 + 10, C.dim, 8, 'center');
    this.text('n (m⁻³)', x1, y1 + 22, C.dim, 9, 'right'); this.text('mass (M☉)', x0 + 6, y0 + 10, C.dim, 8);
    const lineFor = (TT: number, mu: number, col: string, wd: number, dash?: number[]) => plotCurve(c, 7, 15, 80, X, (ln) => Y(Math.log10(jeansMass(TT, mu, mu * MH * 10 ** ln) / MSUN)), col, wd, dash);
    lineFor(10, 2, hexA(C.dim, 0.5), 1, [3, 3]); this.text('M_J (10 K, H₂)', X(14.6), Y(Math.log10(jeansMass(10, 2, 2 * MH * 10 ** 14.6) / MSUN)) - 8, C.dim, 7, 'right');
    lineFor(50, 1, hexA(C.dim, 0.5), 1, [3, 3]); this.text('M_J (50 K, H I)', X(7.4), Y(Math.log10(jeansMass(50, 1, MH * 10 ** 7.4) / MSUN)) - 8, C.dim, 7);
    lineFor(T, this.mu, C.sun, 2);
    plotCurve(c, 7, 15, 80, X, (ln) => { const r = this.mu * MH * 10 ** ln, v = Math.sqrt(K_B * T / (this.mu * MH)); return Y(Math.log10(1.18 * v ** 4 / (Math.sqrt(r * v * v) * GRAV ** 1.5) / MSUN)); }, C.green, 1.5, [5, 3]);
    this.text(`M_J (${fmt(T, 0)} K, μ = ${this.mu})`, X(12.5), Y(Math.log10(jeansMass(T, this.mu, this.mu * MH * 10 ** 12.5) / MSUN)) - 10, C.sun, 8, 'center');
    this.text('Bonnor–Ebert', X(8.5), Y(Math.log10(1.18 * vT ** 4 / (Math.sqrt(this.mu * MH * 10 ** 8.5 * vT * vT) * GRAV ** 1.5) / MSUN)) + 12, C.green, 8, 'center');
    c.fillStyle = hexA(C.red, 0.05); c.beginPath(); c.moveTo(X(7), Y(Math.log10(jeansMass(T, this.mu, this.mu * MH * 1e7) / MSUN))); for (let ln = 7; ln <= 15; ln += 0.5) c.lineTo(X(ln), Y(Math.log10(jeansMass(T, this.mu, this.mu * MH * 10 ** ln) / MSUN))); c.lineTo(X(15), y0); c.lineTo(X(7), y0); c.closePath(); c.fill();
    this.text('collapses', X(13.5), y0 + 24, C.red, 9, 'center'); this.text('stable', X(8), y1 - 14, C.blue, 9, 'center');
    for (const cl of ISM_CLOUDS) { if (cl.n > 1e15 || cl.M > 1e6) continue; const mj = jeansMass(cl.T, cl.mu, cl.mu * MH * cl.n) / MSUN; const col = cl.M > mj ? C.red : C.blue; this.circle(X(Math.log10(cl.n)), Y(Math.log10(cl.M)), 4, '#000', col); this.text(cl.name.replace('Giant molecular cloud', 'GMC').replace('Diffuse H I cloud', 'diffuse H I').replace('Diffuse molecular cloud', 'diffuse mol.').replace('Dark cloud complex', 'dark complex'), X(Math.log10(cl.n)) + 6, Y(Math.log10(cl.M)) - 7, col, 7); }
    this.line(X(this.ln), y0, X(this.ln), y1, hexA('#fff', 0.4), 1);
    // right: the cloud at the chosen n
    const cx = w * 0.82, cy = h * 0.4, R = Math.min(w * 0.12, h * 0.25);
    this.glow(cx, cy, R, hexA(C.blue, 0.35)); this.circle(cx, cy, R, hexA(C.blue, 0.8));
    this.line(cx - R, cy + R + 10, cx + R, cy + R + 10, C.dim, 1); this.text(`R_J = ${RJ / PC_M < 1 ? `${fmt(RJ / PC_M, 2)} pc` : `${fmt(RJ / PC_M, 0)} pc`}`, cx, cy + R + 20, C.text, 9, 'center');
    this.text(`M_J = ${MJ / MSUN >= 100 ? sci(MJ / MSUN, 1) : fmt(MJ / MSUN, 1)} M☉`, cx, cy, C.text, 10, 'center');
    this.setReadout([
      ['Jeans mass · length', `${MJ / MSUN >= 100 ? sci(MJ / MSUN, 2) : fmt(MJ / MSUN, 1)} M☉ · ${RJ / PC_M < 1 ? fmt(RJ / PC_M, 3) : fmt(RJ / PC_M, 1)} pc`, C.sun],
      ['Bonnor–Ebert mass (P₀ = nkT)', `${MBE / MSUN >= 100 ? sci(MBE / MSUN, 2) : fmt(MBE / MSUN, 1)} M☉ (c_BE = 1.18 vs c_J = 5.46)`, C.green],
      ['Sound speed · free-fall time', `${fmt(vT / 1e3, 2)} km/s · ${fmtYr(freeFallTime(rho) / YR_S)}`],
      ['Scaling', 'M_J ∝ T^{3/2} ρ^{−1/2} μ^{−3/2}: cold, dense, molecular gas collapses first'],
    ]);
  }
}

/* ------------------------------------------------------ 12.2b free fall ---- */

/** θ = r/r₀ from ξ + ½ sin 2ξ = χ t (Newton) */
function collapseTheta(tauFrac: number): number {   // tauFrac = t/t_ff in [0,1]
  const target = tauFrac * Math.PI / 2; let xi = Math.min(Math.PI / 2 - 1e-6, Math.max(0, target));
  for (let i = 0; i < 30; i++) { const f = xi + 0.5 * Math.sin(2 * xi) - target, df = 1 + Math.cos(2 * xi); if (df < 1e-9) break; xi -= f / df; xi = Math.min(Math.PI / 2 - 1e-9, Math.max(0, xi)); }
  return Math.cos(xi) ** 2;
}
class FreefallWidget extends CanvasWidget {
  private lrho = Math.log10(3e-17); private mode: 'homo' | 'inout' = 'homo'; private u = 0;
  constructor() {
    super(1.8);
    this.slider('Initial density ρ₀', -20, -14, 0.05, this.lrho, (v) => `${sci(10 ** v, 1)} kg/m³`, (v) => { this.lrho = v; });
    this.segmented<'homo' | 'inout'>([['homo', 'uniform → homologous'], ['inout', 'centrally condensed → inside-out']], this.mode, (v) => { this.mode = v; });
    this.playButton();
  }
  protected draw(dt: number) {
    const c = this.ctx, w = this.w, h = this.h;
    this.u = (this.u + dt / 10) % 1.08;
    const rho0 = 10 ** this.lrho, tff = freeFallTime(rho0), u = Math.min(1, this.u);
    // left: shells
    const cx = w * 0.24, cy = h * 0.46, R = Math.min(w * 0.2, h * 0.4);
    const shells = [0.2, 0.4, 0.6, 0.8, 1.0];
    const shellTheta = (s: number) => { if (this.mode === 'homo') return collapseTheta(u); const rhoBar = 1.8 - 0.8 * s * s; return collapseTheta(Math.min(1, u * Math.sqrt(rhoBar))); };   // inner shells: higher mean density → shorter t_ff
    for (let i = shells.length - 1; i >= 0; i--) { const s = shells[i], th = shellTheta(s); const r = R * s * th; this.circle(cx, cy, Math.max(1, r), hexA(C.blue, 0.9), hexA(C.blue, 0.05 + 0.15 * Math.min(1, 0.05 / (th * th * th + 1e-4))), 1); }
    for (let k = 0; k < 24; k++) { const a = k * TAU / 24, s = 0.6 + 0.4 * ((k * 7) % 5) / 5, th = shellTheta(s), r = R * s * th; this.line(cx + r * Math.cos(a) * 1.08, cy + r * Math.sin(a) * 1.08, cx + r * Math.cos(a) * 0.95, cy + r * Math.sin(a) * 0.95, hexA('#fff', 0.5), 1); }
    this.circle(cx, cy, R, hexA(C.grid, 1), undefined, 1, [3, 4]);
    this.text(`t = ${fmt(u, 2)} t_ff = ${fmtYr(u * tff / YR_S)}`, cx, cy + R + 16, C.text, 9, 'center');
    this.text(this.mode === 'homo' ? 'all shells arrive together' : 'inner shells fall first', cx, cy - R - 12, C.dim, 8, 'center');
    // right: r/r0 and log density vs time
    const x0 = w * 0.55, x1 = w - 12, y0 = 14, y1 = h - 30;
    axesBox(c, x0, y0, x1, y1);
    const X = (f: number) => x0 + f * (x1 - x0);
    const Y = (v: number) => y1 - 6 - v * (y1 - y0 - 12);
    for (const v of [0.2, 0.4, 0.6, 0.8, 1]) { this.line(x0, Y(v), x1, Y(v), hexA(C.grid, 0.9)); this.text(`${v}`, x0 - 4, Y(v), C.blue, 8, 'right'); this.text(`${v * 8}`, x1 + 4, Y(v), C.accent, 8); }
    for (const f of [0, 0.5, 1]) this.text(`${fmt(f * tff / YR_S / 1e3, 0)} kyr`, X(f), y1 + 10, C.dim, 8, 'center');
    this.text('r/r₀', x0 + 6, y0 + 10, C.blue, 8); this.text('log₁₀ ρ/ρ₀', x1 - 6, y0 + 10, C.accent, 8, 'right');
    plotCurve(c, 0, 1, 300, X, (f) => Y(collapseTheta(f)), C.blue, 2);
    plotCurve(c, 0, 0.9995, 300, X, (f) => Y(Math.min(1, -3 * Math.log10(Math.max(1e-9, collapseTheta(f))) / 8)), C.accent, 2, [4, 3]);
    this.line(X(u), y0, X(u), y1, hexA('#fff', 0.4), 1);
    const th = collapseTheta(u), r0 = 0.1 * PC_M, vin = Math.sqrt(8 * Math.PI * GRAV * rho0 / 3) * r0 * Math.sqrt(Math.max(0, 1 / Math.max(th, 1e-6) - 1));
    this.setReadout([
      ['Free-fall time (3π/32Gρ₀)^½', fmtYr(tff / YR_S), C.sun],
      ['Now', `r/r₀ = ${fmt(th, 3)} · ρ/ρ₀ = ${sci(1 / Math.max(th, 1e-9) ** 3, 1)}`, C.blue],
      ['Infall speed of the surface (r₀ = 0.1 pc)', `${vin / 1e3 < 100 ? fmt(vin / 1e3, 2) : sci(vin / 1e3, 1)} km/s`, C.accent],
      ['Note', 't_ff is independent of r₀: a uniform cloud collapses homologously; a condensed one inside-out'],
    ]);
  }
}

/* ------------------------------------------------- 12.2c fragmentation ---- */

class FragmentationWidget extends CanvasWidget {
  private le = -1; private lTtr = 3; private mu = 1; private lrho = -17;
  private sR: ReturnType<CanvasWidget['slider']>;
  constructor() {
    super(1.8);
    this.slider('Radiative efficiency e', -2, 0, 0.05, this.le, (v) => fmt(10 ** v, 2), (v) => { this.le = v; });
    this.slider('Temperature when adiabatic', 2, 3.5, 0.05, this.lTtr, (v) => `${fmt(10 ** v, 0)} K`, (v) => { this.lTtr = v; });
    this.segmented<'1' | '2'>([['1', 'μ = 1'], ['2', 'μ = 2']], '1', (v) => { this.mu = +v; });
    this.sR = this.slider('Density during collapse', -17, -9, 0.05, this.lrho, (v) => `${sci(10 ** v, 1)} kg/m³`, (v) => { this.lrho = v; });
    this.playButton();
  }
  protected draw(dt: number) {
    const c = this.ctx, w = this.w, h = this.h;
    if (this.playing) { this.lrho += dt * 0.6; if (this.lrho > -9) this.lrho = -17; this.sR.set(Math.round(this.lrho * 20) / 20); }
    const e = 10 ** this.le, Ttr = 10 ** this.lTtr;
    const Mmin = 0.03 * Ttr ** 0.25 / (Math.sqrt(e) * this.mu ** 2.25);   // M☉
    // isothermal 10 K branch until M_J reaches Mmin, then adiabatic (γ = 5/3): M_J ∝ ρ^{1/2}
    const T0 = 10; const rhoA = (5 * K_B * T0 / (GRAV * this.mu * MH)) ** 3 * 3 / (4 * Math.PI) / (Mmin * MSUN) ** 2;
    const MJ = (rho: number) => rho < rhoA ? jeansMass(T0, this.mu, rho) / MSUN : Mmin * Math.sqrt(rho / rhoA);
    const Tof = (rho: number) => rho < rhoA ? T0 : T0 * (rho / rhoA) ** (2 / 3);
    const x0 = PLOT_MARGIN, x1 = w * 0.58, y0 = 14, y1 = h - 30;
    axesBox(c, x0, y0, x1, y1);
    const X = (lr: number) => x0 + (lr + 17) / 8 * (x1 - x0);
    const Y = (lM: number) => y1 - 6 - (lM + 2.5) / 7 * (y1 - y0 - 12);
    for (let lM = -2; lM <= 4; lM++) { this.line(x0, Y(lM), x1, Y(lM), hexA(C.grid, 0.9)); this.text(`10${sup(lM)}`, x0 - 4, Y(lM), C.dim, 8, 'right'); }
    for (let lr = -17; lr <= -9; lr += 2) this.text(`10${sup(lr)}`, X(lr), y1 + 10, C.dim, 8, 'center');
    this.text('ρ (kg m⁻³)', x1, y1 + 22, C.dim, 9, 'right'); this.text('Jeans mass (M☉)', x0 + 6, y0 + 10, C.dim, 8);
    plotCurve(c, -17, -9, 200, X, (lr) => Y(Math.log10(jeansMass(T0, this.mu, 10 ** lr) / MSUN)), hexA(C.dim, 0.5), 1, [3, 3]);
    this.text('isothermal 10 K: M_J ∝ ρ^−1/2', X(-13), Y(Math.log10(jeansMass(T0, this.mu, 1e-13) / MSUN)) - 10, C.dim, 7, 'center');
    plotCurve(c, -17, -9, 300, X, (lr) => Y(Math.max(-2.5, Math.min(4.5, Math.log10(MJ(10 ** lr))))), C.sun, 2);
    const lrA = Math.log10(rhoA);
    if (lrA > -17 && lrA < -9) { this.circle(X(lrA), Y(Math.log10(Mmin)), 5, '#fff', C.red); this.text(`M_J^min = ${fmt(Mmin, 2)} M☉`, X(lrA), Y(Math.log10(Mmin)) + 16, C.red, 9, 'center'); this.text('adiabatic: M_J ∝ ρ^+1/2', X(Math.min(-9.5, lrA + 2)), Y(Math.log10(MJ(10 ** Math.min(-9.5, lrA + 2)))) - 10, C.sun, 7, 'center'); }
    this.line(X(this.lrho), y0, X(this.lrho), y1, hexA('#fff', 0.4), 1);
    // right: the cascade
    const rho = 10 ** this.lrho, cx = w * 0.8, cy = h * 0.42, R = Math.min(w * 0.14, h * 0.3);
    const Mcloud = 1000, nFrag = Math.min(400, Math.max(1, Math.floor(Mcloud / MJ(rho))));
    this.circle(cx, cy, R, hexA(C.blue, 0.6), hexA(C.blue, 0.06), 1, [3, 3]);
    let s = 17; const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    const rf = Math.max(1.5, R / Math.sqrt(nFrag) * 0.8);
    for (let i = 0; i < nFrag; i++) { const a = rnd() * TAU, rr = R * Math.sqrt(rnd()) * 0.92; this.circle(cx + rr * Math.cos(a), cy + rr * Math.sin(a), rf, undefined, hexA(rho < rhoA ? C.blue : C.sun, 0.7)); }
    this.text(`1000 M☉ cloud → ${nFrag} Jeans-mass fragments`, cx, cy + R + 14, C.text, 9, 'center');
    this.text(rho < rhoA ? 'isothermal: still fragmenting' : 'adiabatic: fragmentation has stopped', cx, cy - R - 12, rho < rhoA ? C.blue : C.sun, 8, 'center');
    this.setReadout([
      ['Minimum fragment mass 0.03 T^¼/(e^½ μ^9/4)', `${fmt(Mmin, 2)} M☉ (${fmt(Mmin * 1047, 0)} M_Jup)`, C.red],
      ['At this density', `M_J = ${MJ(rho) >= 100 ? sci(MJ(rho), 1) : fmt(MJ(rho), 2)} M☉ · T = ${fmt(Tof(rho), 0)} K · ${rho < rhoA ? 'optically thin' : 'optically thick'}`, C.sun],
      ['Transition density', `${sci(rhoA, 1)} kg/m³ = ${sci(rhoA / (this.mu * MH), 1)} m⁻³`],
      ['Refined estimates', '~0.01 M☉ with radiative transfer, grain and molecule physics — the deuterium-burning limit'],
    ]);
  }
}

/* -------------------------------------------------- 12.2d magnetic support ---- */

class MagcollapseWidget extends CanvasWidget {
  private lB = 0; private lR = -1; private ln = 10; private lM = 1; private t = 0;
  constructor() {
    super(1.8);
    this.slider('Field strength B', -0.5, 2.5, 0.05, this.lB, (v) => `${fmt(10 ** v, 10 ** v < 10 ? 1 : 0)} nT = ${fmt(10 ** v * 10, 0)} μG`, (v) => { this.lB = v; });
    this.slider('Radius R', -1.7, 0.5, 0.05, this.lR, (v) => `${fmt(10 ** v, 2)} pc`, (v) => { this.lR = v; });
    this.slider('Density n_H₂', 8, 12, 0.05, this.ln, (v) => `10^${fmt(v, 1)} m⁻³`, (v) => { this.ln = v; });
    this.slider('Cloud mass', 0, 3, 0.05, this.lM, (v) => `${fmt(10 ** v, 0)} M☉`, (v) => { this.lM = v; });
  }
  protected draw(dt: number) {
    const c = this.ctx, w = this.w, h = this.h; this.t += dt;
    const B = 10 ** this.lB, R = 10 ** this.lR, n = 10 ** this.ln, M = 10 ** this.lM;
    const MB = 70 * B * R * R, tAD = 10e9 * (n / 1e10) * B ** -2 * R * R, tff = freeFallTime(2 * MH * n) / YR_S, MJ = jeansMass(10, 2, 2 * MH * n) / MSUN;
    const super_ = M > MB;
    // left: cloud with field lines
    const cx = w * 0.24, cy = h * 0.45, Rp = Math.min(w * 0.18, h * 0.36);
    const squeeze = super_ ? 0.6 + 0.4 * Math.abs(Math.sin(this.t * 0.8)) : 1;
    c.save(); c.beginPath(); c.ellipse(cx, cy, Rp * squeeze, Rp, 0, 0, TAU); c.fillStyle = hexA(C.blue, 0.12); c.fill(); c.strokeStyle = hexA(C.blue, 0.8); c.lineWidth = 1; c.stroke(); c.restore();
    const nl = Math.max(3, Math.min(15, Math.round(3 + this.lB * 4)));
    for (let i = 0; i < nl; i++) { const f = (i + 0.5) / nl * 2 - 1; const xo = f * Rp * 1.3; c.beginPath(); for (let y = -Rp * 1.3; y <= Rp * 1.3; y += 4) { const inside = Math.abs(y) < Rp ? Math.sqrt(1 - (y / Rp) ** 2) : 0; const x = cx + xo * (1 - inside * (1 - squeeze) * 0.8 * (Math.abs(f) < 1 ? 1 : 0)); y === -Rp * 1.3 ? c.moveTo(x, cy + y) : c.lineTo(x, cy + y); } c.strokeStyle = hexA(C.purple, 0.7); c.lineWidth = 1; c.stroke(); }
    this.text(`B = ${fmt(B, B < 10 ? 1 : 0)} nT · R = ${fmt(R, 2)} pc · M = ${fmt(M, 0)} M☉`, cx, cy + Rp + 16, C.text, 9, 'center');
    this.text(super_ ? 'supercritical: gravity overwhelms the field' : 'subcritical: the field holds the cloud up', cx, cy - Rp - 12, super_ ? C.red : C.purple, 9, 'center');
    // right: bars
    const bx0 = w * 0.55, bx1 = w - 12, y0 = 14, ymid = h * 0.5, y1 = h - 30;
    const bar = (x: number, yb: number, yt: number, col: string, lab: string, val: string) => { c.fillStyle = hexA(col, 0.8); c.fillRect(x, yt, 36, yb - yt); this.text(lab, x + 18, yb + 10, col, 8, 'center'); this.text(val, x + 18, yt - 8, C.text, 8, 'center'); };
    // masses
    const YM = (lm: number) => ymid - 20 - (lm + 1) / 5 * (ymid - 20 - y0 - 10);
    this.text('masses (M☉, log)', bx0, y0 + 6, C.dim, 8);
    this.line(bx0, YM(Math.log10(M)), bx1, YM(Math.log10(M)), hexA('#fff', 0.5), 1, [3, 3]); this.text(`cloud ${fmt(M, 0)}`, bx1 - 4, YM(Math.log10(M)) - 8, C.text, 8, 'right');
    bar(bx0 + 10, ymid - 20, YM(Math.log10(Math.max(0.1, MB))), C.purple, 'M_B', MB >= 100 ? sci(MB, 1) : fmt(MB, 1));
    bar(bx0 + 70, ymid - 20, YM(Math.log10(Math.max(0.1, MJ))), C.sun, 'M_J (10 K)', fmt(MJ, 1));
    bar(bx0 + 130, ymid - 20, YM(Math.log10(Math.max(0.1, M))), super_ ? C.red : C.blue, 'cloud', fmt(M, 0));
    // times
    const YT = (lt: number) => y1 - 6 - (lt - 4) / 7 * (y1 - 6 - ymid - 24);
    this.text('timescales (yr, log)', bx0, ymid + 6, C.dim, 8);
    bar(bx0 + 10, y1 - 6, YT(Math.log10(tff)), C.sun, 't_ff', fmtYr(tff));
    bar(bx0 + 70, y1 - 6, YT(Math.min(11, Math.log10(tAD))), C.purple, 't_AD', fmtYr(tAD));
    bar(bx0 + 130, y1 - 6, YT(Math.log10(1.4e10)), C.dim, 'universe', '13.8 Gyr');
    this.setReadout([
      ['Magnetic critical mass 70 M☉ (B/nT)(R/pc)²', `${MB >= 100 ? sci(MB, 2) : fmt(MB, 2)} M☉ → ${super_ ? 'supercritical (M > M_B)' : 'subcritical (M < M_B)'}`, super_ ? C.red : C.purple],
      ['Ambipolar diffusion time', `${fmtYr(tAD)} = ${fmt(tAD / tff, 0)} × t_ff`, C.purple],
      ['Free-fall time · thermal Jeans mass', `${fmtYr(tff)} · ${fmt(MJ, 1)} M☉`, C.sun],
      ['Magnetic flux Φ = πR²B', `${sci(Math.PI * (R * PC_M) ** 2 * B * 1e-9, 1)} Wb — conserved while the field is frozen in`],
    ]);
  }
}

/* ------------------------------------------------- 12.2e protostar tracks ---- */

/** schematic protostellar track of a 1 M☉ cloud (after Wuchterl & Tscharnuter 2003): [u, logT, logL, t (yr), stage] */
const PROTO_STAGES: Array<[number, number, number, number, string]> = [
  [0, 2.15, -1.8, 1e3, 'isothermal collapse: the cloud is transparent, 10 K'],
  [0.2, 2.5, -0.3, 1e4, 'first hydrostatic core, ~5 AU, with a dust photosphere'],
  [0.4, 2.9, 1.0, 3e4, 'accretion shock powers the luminosity; dust vaporises at 1000 K'],
  [0.55, 3.4, 1.4, 5e4, 'H₂ dissociates at 2000 K: second collapse to ~1.3 R☉'],
  [0.75, 3.62, 1.2, 2e5, 'main accretion phase; deuterium burning gives up to 60 % of L'],
  [0.9, 3.63, 0.4, 5e5, 'deuterium burn-out, envelope exhausted: L drops'],
  [1, 3.62, 0.0, 1e6, 'pre-main-sequence star on the Hayashi track'],
];
function protoPoint(u: number, M: number): { lT: number; lL: number; t: number; stage: string } {
  let i = 0; while (i < PROTO_STAGES.length - 2 && PROTO_STAGES[i + 1][0] <= u) i++;
  const a = PROTO_STAGES[i], b = PROTO_STAGES[i + 1], f = Math.min(1, Math.max(0, (u - a[0]) / (b[0] - a[0])));
  const lm = Math.log10(M);
  return { lT: a[1] + (b[1] - a[1]) * f + 0.08 * lm, lL: a[2] + (b[2] - a[2]) * f + 1.5 * lm, t: 10 ** (Math.log10(a[3]) + (Math.log10(b[3]) - Math.log10(a[3])) * f) * M ** -0.5, stage: a[4] };
}
class ProtostartrackWidget extends CanvasWidget {
  private u = 0.3;
  private sU: ReturnType<CanvasWidget['slider']>;
  constructor() {
    super(1.8);
    this.sU = this.slider('Stage (1 M☉ cloud)', 0, 1, 0.005, this.u, (v) => fmt(v, 2), (v) => { this.u = v; });
    this.playButton();
  }
  protected draw(dt: number) {
    const c = this.ctx, w = this.w, h = this.h;
    if (this.playing) { this.u = (this.u + dt * 0.06) % 1; this.sU.set(Math.round(this.u * 200) / 200); }
    const x0 = PLOT_MARGIN, x1 = w * 0.6, y0 = 14, y1 = h - 30;
    axesBox(c, x0, y0, x1, y1);
    const X = (lT: number) => x1 - (lT - 2) / 2.2 * (x1 - x0);
    const Y = (lL: number) => y1 - 6 - (lL + 2.5) / 6 * (y1 - y0 - 12);
    for (let lL = -2; lL <= 3; lL++) { this.line(x0, Y(lL), x1, Y(lL), hexA(C.grid, 0.9)); this.text(`10${sup(lL)}`, x0 - 4, Y(lL), C.dim, 8, 'right'); }
    for (const lT of [2, 2.5, 3, 3.5, 4]) this.text(`${lT}`, X(lT), y1 + 10, C.dim, 8, 'center');
    this.text('log T_eff (K) →  cooler', x1, y1 + 22, C.dim, 9, 'right'); this.text('L (L☉)', x0 + 6, y0 + 10, C.dim, 8);
    for (const M of [0.05, 0.1, 0.5, 1, 2, 10]) { const col = M === 1 ? C.sun : hexA(C.dim, 0.7); plotCurve(c, 0, 1, 200, (u) => X(protoPoint(u, M).lT), (u) => Y(protoPoint(u, M).lL), col, M === 1 ? 2 : 1); const p = protoPoint(0.75, M); this.text(`${M} M☉`, X(p.lT) - 6, Y(p.lL) - 8, col, 7, 'right'); }
    for (const [u, lab] of [[0.2, '10 kyr'], [0.4, '30 kyr'], [0.75, '0.2 Myr'], [1, '1 Myr']] as Array<[number, string]>) { const p = protoPoint(u, 1); this.text(lab, X(p.lT) + 6, Y(p.lL) + 8, C.faint, 7); }
    // Hayashi tracks hint
    this.line(X(3.6), Y(-0.5), X(3.6), Y(1), hexA(C.green, 0.5), 1, [2, 3]); this.text('PMS tracks', X(3.6) - 4, Y(-0.3), C.green, 7, 'right');
    const P = protoPoint(this.u, 1);
    this.circle(X(P.lT), Y(P.lL), 5, '#fff', C.sun);
    // right-top: structure cartoon
    const cx = w * 0.8, cy = h * 0.3, R = Math.min(w * 0.14, h * 0.24);
    const envel = 1 - this.u * 0.9, core = this.u < 0.2 ? 0 : this.u < 0.55 ? 0.35 : 0.12, dustPh = this.u < 0.4 ? 0.9 * envel : 0;
    this.glow(cx, cy, R * Math.max(0.05, envel), hexA(C.blue, 0.3));
    if (dustPh > 0) { this.circle(cx, cy, R * dustPh, hexA(C.accent, 0.8), undefined, 1, [3, 3]); this.text('dust photosphere', cx, cy - R * dustPh - 8, C.accent, 7, 'center'); }
    if (core > 0) { this.glow(cx, cy, R * core * 1.3, rgba(tempRGB(this.u < 0.55 ? 1500 : 4000), 0.9)); this.circle(cx, cy, R * core, undefined, rgba(tempRGB(this.u < 0.55 ? 1500 : 4000), 1)); this.text(this.u < 0.55 ? 'first core ~5 AU' : 'core ~1–2 R☉', cx, cy + R * core + 10, C.text, 7, 'center'); }
    if (this.u > 0.35 && this.u < 0.95) for (let k = 0; k < 10; k++) { const a = k * TAU / 10 + this.u * 3, r1 = R * envel * 0.9, r2 = R * Math.max(core, 0.1) * 1.4; this.line(cx + r1 * Math.cos(a), cy + r1 * Math.sin(a), cx + r2 * Math.cos(a), cy + r2 * Math.sin(a), hexA('#fff', 0.35), 1); }
    this.text('infalling envelope', cx, cy + R + 12, C.dim, 7, 'center');
    // right-bottom: infall profile
    const px0 = w * 0.66, px1 = w - 12, py0 = h * 0.58, py1 = h - 30;
    axesBox(c, px0, py0, px1, py1);
    const PX = (v: number) => px0 + (v + 3) / 6 * (px1 - px0);
    const PY = (f: number) => py1 - 6 - f / 1.3 * (py1 - py0 - 12);
    const infall = this.u > 0.1 ? Math.min(1, (this.u - 0.1) / 0.3) : 0;
    const prof = (v: number) => { const em = Math.exp(-(v * v) / 2.2), blue = infall * 0.45 * Math.exp(-((v + 0.9) ** 2) / 0.3), red = infall * 0.3 * Math.exp(-((v - 0.9) ** 2) / 0.3), abs = 0.75 * Math.exp(-(v * v) / 0.12); return 0.15 + em * (1 - abs) + blue + red; };
    plotCurve(c, -3, 3, 200, PX, (v) => PY(prof(v)), C.sun, 1.5);
    this.line(PX(0), py0, PX(0), py1, hexA(C.grid, 1), 1, [2, 3]);
    this.text('blue', PX(-1.2), py0 + 10, C.blue, 7, 'center'); this.text('red', PX(1.2), py0 + 10, C.red, 7, 'center'); this.text('optically thick line: blue-asymmetric infall profile', px0 + 4, py1 + 10, C.dim, 7);
    this.setReadout([
      ['Stage', P.stage, C.sun],
      ['Time since collapse began', fmtYr(P.t)],
      ['L · T_eff', `${fmt(10 ** P.lL, 10 ** P.lL < 1 ? 2 : 1)} L☉ · ${fmt(10 ** P.lT, 0)} K · R_phot ≈ ${fmt(Math.sqrt(10 ** P.lL) * (5772 / 10 ** P.lT) ** 2, 1)} R☉`],
      ['Energy source', this.u < 0.2 ? 'gravitational, radiated freely' : this.u < 0.6 ? 'accretion shock (kinetic energy of infall)' : this.u < 0.9 ? 'accretion + deuterium burning' : 'gravitational contraction (Kelvin–Helmholtz)'],
    ]);
  }
}

/* ------------------------------------------------------- 12.3a PMS tracks ---- */

/** Bernasconi & Maeder (1996) contraction times: [M, Myr] */
const PMS_TIMES: Array<[number, number]> = [[0.8, 68.4], [1, 38.9], [1.5, 35.4], [2, 23.4], [3, 7.24], [5, 1.15], [9, 0.288], [15, 0.117], [25, 0.0708], [60, 0.0282]];
function pmsTime(M: number): number {
  const lm = Math.log10(M);
  for (let i = 0; i < PMS_TIMES.length - 1; i++) { const [m0, t0] = PMS_TIMES[i], [m1, t1] = PMS_TIMES[i + 1]; if (M <= m1 || i === PMS_TIMES.length - 2) { const f = (lm - Math.log10(m0)) / (Math.log10(m1) - Math.log10(m0)); return 10 ** (Math.log10(t0) + (Math.log10(t1) - Math.log10(t0)) * Math.min(1.2, Math.max(-0.2, f))); } }
  return 1;
}
/** schematic PMS track: fraction s ∈ [0,1] → (logT, logL); Hayashi descent then Henyey rise */
function pmsPoint(s: number, M: number): { lT: number; lL: number; conv: number } {
  const ms = mainSequence(M), lTz = Math.log10(ms.T), lLz = Math.log10(ms.L), lm = Math.log10(M);
  const lTH = 3.575 + 0.06 * lm;                                   // Hayashi track temperature
  const lLtop = lLz + Math.max(0.3, 1.6 - 0.9 * lm);              // where the track starts
  const dip = M < 1.2 ? 0.45 : M < 3 ? 0.5 - 0.25 * (lm - 0.08) : 0.1;   // depth of the luminosity minimum below ZAMS
  const lLmin = lLz - dip;
  const sH = M < 3 ? 0.55 : 0.25;                                   // fraction of the track spent on the Hayashi descent
  if (s < sH) { const f = s / sH; return { lT: lTH + 0.01 * f, lL: lLtop + (lLmin - lLtop) * f, conv: 1 }; }
  const f = (s - sH) / (1 - sH);
  const bump = Math.sin(Math.PI * f) * (M < 0.5 ? 0 : 0.12);
  return { lT: lTH + 0.01 + (lTz - lTH - 0.01) * f, lL: lLmin + (lLz - lLmin) * f + bump, conv: M < 0.5 ? 1 : Math.max(M > 10 ? 0.35 : 0.02, 1 - f * 1.2) };
}
class PmstracksWidget extends CanvasWidget {
  private lM = 0; private s = 0;
  constructor() {
    super(1.8);
    this.slider('Mass', Math.log10(0.8), Math.log10(60), 0.01, this.lM, (v) => `${fmt(10 ** v, 10 ** v < 3 ? 2 : 0)} M☉`, (v) => { this.lM = v; this.s = 0; });
    this.playButton();
  }
  protected draw(dt: number) {
    const c = this.ctx, w = this.w, h = this.h;
    const M = 10 ** this.lM;
    this.s = (this.s + dt * 0.08) % 1.1; const s = Math.min(1, this.s);
    const x0 = PLOT_MARGIN, x1 = w * 0.62, y0 = 14, y1 = h - 30;
    axesBox(c, x0, y0, x1, y1);
    const X = (lT: number) => x1 - (lT - 3.5) / 1.3 * (x1 - x0);
    const Y = (lL: number) => y1 - 6 - (lL + 1) / 8 * (y1 - y0 - 12);
    for (let lL = -1; lL <= 7; lL++) { this.line(x0, Y(lL), x1, Y(lL), hexA(C.grid, 0.9)); this.text(`10${sup(lL)}`, x0 - 4, Y(lL), C.dim, 8, 'right'); }
    for (const lT of [3.6, 3.8, 4.0, 4.2, 4.4, 4.6, 4.8]) this.text(fmt(lT, 1), X(lT), y1 + 10, C.dim, 8, 'center');
    this.text('log T_eff (K)  ← hotter', x1, y1 + 22, C.dim, 9, 'right'); this.text('L (L☉)', x0 + 6, y0 + 10, C.dim, 8);
    // forbidden region (right of the Hayashi line for this mass)
    const lTH = 3.575 + 0.06 * this.lM;
    c.fillStyle = hexA(C.red, 0.07); c.fillRect(X(lTH) , y0, x1 - X(lTH), y1 - y0); this.text('forbidden', (X(lTH) + x1) / 2, y0 + 24, C.red, 8, 'center'); this.text('(no hydrostatic star)', (X(lTH) + x1) / 2, y0 + 36, C.red, 7, 'center');
    this.line(X(lTH), y0, X(lTH), y1, hexA(C.red, 0.5), 1, [3, 3]); this.text('Hayashi track', X(lTH) - 4, y1 - 14, C.red, 8, 'right');
    // ZAMS
    plotCurve(c, Math.log10(0.5), Math.log10(80), 60, (lm) => X(Math.log10(mainSequence(10 ** lm).T)), (lm) => Y(Math.log10(mainSequence(10 ** lm).L)), hexA(C.dim, 0.6), 1.5, [5, 4]); this.text('ZAMS', X(Math.log10(mainSequence(40).T)) + 6, Y(Math.log10(mainSequence(40).L)) + 10, C.dim, 8);
    for (const [m] of PMS_TIMES) { const col = Math.abs(Math.log10(m) - this.lM) < 0.02 ? C.sun : hexA(C.blue, 0.6); plotCurve(c, 0, 1, 120, (u) => X(pmsPoint(u, m).lT), (u) => Y(pmsPoint(u, m).lL), col, col === C.sun ? 2 : 1); const p0 = pmsPoint(0, m); this.text(`${m}`, X(p0.lT) + 4, Y(p0.lL), C.dim, 7); }
    plotCurve(c, 0, 1, 120, (u) => X(pmsPoint(u, M).lT), (u) => Y(pmsPoint(u, M).lL), C.sun, 2);
    const P = pmsPoint(s, M), ms = mainSequence(M), L = 10 ** P.lL, T = 10 ** P.lT, R = Math.sqrt(L) * (5772 / T) ** 2;
    this.circle(X(P.lT), Y(P.lL), 5, '#fff', rgba(tempRGB(T), 1));
    // right: structure
    const cx = w * 0.81, cy = h * 0.36, Rp = Math.min(w * 0.13, h * 0.24) * Math.min(1, 0.35 + 0.65 * Math.log10(R + 1) / 1.5);
    c.fillStyle = rgba(tempRGB(T), 1); c.beginPath(); c.arc(cx, cy, Rp, 0, TAU); c.fill();
    const convOuter = P.conv, coreConv = M > 1.2 && s > 0.75 ? 0.2 : 0;
    if (convOuter < 1) { c.fillStyle = hexA('#000', 0.35); c.beginPath(); c.arc(cx, cy, Rp * (1 - convOuter), 0, TAU); c.fill(); }
    for (let k = 0; k < 16; k++) { const a = k * TAU / 16 + this.s; const r1 = Rp * (1 - convOuter) + 2, r2 = Rp - 3; if (r2 > r1) { c.beginPath(); c.arc(cx, cy, (r1 + r2) / 2, a, a + 0.15); c.strokeStyle = hexA('#000', 0.5); c.lineWidth = Math.max(1, (r2 - r1) * 0.6); c.stroke(); } }
    if (coreConv > 0) { c.fillStyle = hexA('#fff', 0.35); c.beginPath(); c.arc(cx, cy, Rp * coreConv, 0, TAU); c.fill(); }
    this.text(convOuter >= 0.99 ? 'fully convective' : coreConv > 0 ? 'radiative envelope, convective core' : convOuter > 0.3 ? 'radiative core growing' : 'radiative interior', cx, cy + Rp + 14, C.text, 9, 'center');
    this.text(`R = ${fmt(R, 1)} R☉ (ZAMS ${fmt(ms.R, 1)})`, cx, cy + Rp + 26, C.dim, 8, 'center');
    const tTot = pmsTime(M) * 1e6, tNow = tTot * (s < 0.55 ? 0.4 * (s / 0.55) ** 0.5 : 0.4 + 0.6 * ((s - 0.55) / 0.45) ** 1.5);
    const tKH = GRAV * (M * MSUN) ** 2 / (ms.R * RSUN * ms.L * LSUN_W) / YR_S;
    this.setReadout([
      ['Time to the ZAMS (Bernasconi & Maeder)', `${fmtYr(tTot)} · now at ${fmtYr(tNow)}`, C.sun],
      ['Kelvin–Helmholtz estimate GM²/RL at ZAMS', fmtYr(tKH)],
      ['Now', `L = ${L >= 100 ? sci(L, 1) : fmt(L, 2)} L☉ · T_eff = ${fmt(T, 0)} K · ${s < (M < 3 ? 0.55 : 0.25) ? 'descending the Hayashi track' : s < 1 ? 'Henyey track: radiative core, contracting' : 'on the zero-age main sequence'}`, C.text],
      ['Burning', s < 0.3 ? 'deuterium (²H + p → ³He)' : s < 0.7 ? 'none yet: gravitational contraction' : s < 1 ? 'PP I first steps + ¹²C → ¹⁴N (CNO), core adjusting' : M > 1.3 ? 'CNO cycle, convective core' : 'pp chain, radiative core'],
    ]);
  }
}

/* -------------------------------------------------------------- 12.3b IMF ---- */

type ImfForm = 'salpeter' | 'kroupa' | 'chabrier';
/** dN/dm (per unit mass) up to normalisation */
function imfDm(m: number, form: ImfForm): number {
  if (form === 'salpeter') return m ** -2.35;
  if (form === 'kroupa') return m < 0.08 ? 0.08 ** -1 * (m / 0.08) ** -0.3 : m < 0.5 ? (m / 0.08) ** -1.3 * 0.08 ** -1 : (0.5 / 0.08) ** -1.3 * 0.08 ** -1 * (m / 0.5) ** -2.3;
  // Chabrier 2003: ξ(log m) log-normal below 1 M☉, power law above; dN/dm = ξ(log m)/(m ln 10)
  const xi = m < 1 ? 0.158 * Math.exp(-((Math.log10(m) - Math.log10(0.079)) ** 2) / (2 * 0.69 ** 2)) : 0.158 * Math.exp(-((0 - Math.log10(0.079)) ** 2) / (2 * 0.69 ** 2)) * m ** -1.3;
  return xi / (m * Math.LN10);
}
class ImfWidget extends CanvasWidget {
  private form: ImfForm = 'kroupa'; private lMc = 3;
  constructor() {
    super(1.8);
    this.segmented<ImfForm>([['salpeter', 'Salpeter 1955'], ['kroupa', 'Kroupa 2001'], ['chabrier', 'Chabrier 2003']], this.form, (v) => { this.form = v; });
    this.slider('Cluster mass', 2, 5, 0.05, this.lMc, (v) => `${sci(10 ** v, 0)} M☉`, (v) => { this.lMc = v; });
  }
  protected draw() {
    const c = this.ctx, w = this.w, h = this.h;
    const Mc = 10 ** this.lMc, mlo = this.form === 'salpeter' ? 0.08 : 0.01, mhi = 120;
    // normalise: ∫ m dN = Mc
    let mass = 0, N = 0; const nb = 400; const bins: number[] = []; const dlm = (Math.log10(mhi) - Math.log10(mlo)) / nb;
    for (let i = 0; i < nb; i++) { const m = 10 ** (Math.log10(mlo) + (i + 0.5) * dlm); const dn = imfDm(m, this.form) * m * Math.LN10 * dlm; bins.push(dn); mass += dn * m; N += dn; }
    const k = Mc / mass; N *= k;
    const ranges: Array<[number, number, string, string]> = [[0.013, 0.08, 'brown dwarfs', C.purple], [0.08, 0.5, 'M dwarfs', C.red], [0.5, 2, '0.5–2 (Sun-like)', C.sun], [2, 8, '2–8 (A, B)', C.blue], [8, 120, '> 8 (supernovae)', '#fff']];
    const stats = ranges.map(([a, b]) => { let n = 0, mm = 0, l = 0; for (let i = 0; i < nb; i++) { const m = 10 ** (Math.log10(mlo) + (i + 0.5) * dlm); if (m >= a && m < b) { n += bins[i] * k; mm += bins[i] * k * m; l += bins[i] * k * mainSequence(Math.max(0.08, m)).L * (m < 0.08 ? 1e-3 : 1); } } return { n, mm, l }; });
    const Ltot = stats.reduce((s, r) => s + r.l, 0);
    // left: ξ(log m)
    const x0 = PLOT_MARGIN, x1 = w * 0.56, y0 = 14, y1 = h - 30;
    axesBox(c, x0, y0, x1, y1);
    const X = (lm: number) => x0 + (lm + 2.1) / 4.3 * (x1 - x0);
    const Y = (lx: number) => y1 - 6 - (lx + 2) / 6 * (y1 - y0 - 12);
    for (let lx = -1; lx <= 3; lx++) { this.line(x0, Y(lx), x1, Y(lx), hexA(C.grid, 0.9)); this.text(`10${sup(lx)}`, x0 - 4, Y(lx), C.dim, 8, 'right'); }
    for (const lm of [-2, -1, 0, 1, 2]) this.text(lm === 0 ? '1' : `10${sup(lm)}`, X(lm), y1 + 10, C.dim, 8, 'center');
    this.text('mass (M☉)', x1, y1 + 22, C.dim, 9, 'right'); this.text('ξ(log m): stars per dex, per 10³ M☉ formed', x0 + 6, y0 + 10, C.dim, 8);
    for (const [a, b, lab, col] of ranges) { c.fillStyle = hexA(col, 0.05); c.fillRect(X(Math.log10(a)), y0, X(Math.log10(b)) - X(Math.log10(a)), y1 - y0); this.text(lab, (X(Math.log10(a)) + X(Math.log10(b))) / 2, y1 - 12, col, 7, 'center'); }
    for (const f of ['salpeter', 'kroupa', 'chabrier'] as ImfForm[]) { const lo = f === 'salpeter' ? 0.08 : 0.01; let mm = 0; for (let i = 0; i < nb; i++) { const m = 10 ** (Math.log10(lo) + (i + 0.5) * dlm); mm += imfDm(m, f) * m * Math.LN10 * dlm * m; } const kk = 1e3 / mm; plotCurve(c, Math.log10(lo), Math.log10(mhi), 150, X, (lm) => Y(Math.log10(imfDm(10 ** lm, f) * 10 ** lm * Math.LN10 * kk)), f === this.form ? C.sun : hexA(C.dim, 0.5), f === this.form ? 2 : 1, f === this.form ? undefined : [3, 3]); }
    for (const [m, lab] of [[0.013, 'D burning'], [0.072, 'H burning']] as Array<[number, string]>) { this.line(X(Math.log10(m)), y0, X(Math.log10(m)), y1, hexA(C.accent, 0.6), 1, [2, 3]); this.text(lab, X(Math.log10(m)), y0 + 24 + (m > 0.05 ? 12 : 0), C.accent, 7, 'center'); }
    this.text('slope −1.35', X(1.2), Y(Math.log10(imfDm(10 ** 1.2, 'salpeter') * 10 ** 1.2 * Math.LN10 * 1e3 / 3.6)) - 10, C.dim, 7, 'center');
    // right: bars of number, mass, light
    const bx0 = w * 0.64, bx1 = w - 12, by0 = 14, by1 = h - 30;
    this.text(`cluster of ${sci(Mc, 0)} M☉: ${N >= 1e4 ? sci(N, 1) : fmt(N, 0)} stars`, bx0, by0 + 6, C.text, 9);
    const rowH = (by1 - by0 - 30) / ranges.length;
    ranges.forEach(([, , lab, col], i) => {
      const y = by0 + 30 + i * rowH; const st = stats[i];
      this.text(lab, bx0, y + 4, col, 8);
      const bw = bx1 - bx0 - 4;
      const fN = st.n / N, fM = st.mm / Mc, fL = st.l / Ltot;
      c.fillStyle = hexA(C.blue, 0.8); c.fillRect(bx0, y + 10, bw * fN, 6); this.text(`${fmt(100 * fN, fN < 0.01 ? 2 : 0)} % of stars (${st.n >= 1e4 ? sci(st.n, 1) : fmt(st.n, 0)})`, bx0 + bw * fN + 4, y + 13, C.blue, 7);
      c.fillStyle = hexA(C.sun, 0.8); c.fillRect(bx0, y + 18, bw * fM, 6); this.text(`${fmt(100 * fM, 0)} % of mass`, bx0 + bw * fM + 4, y + 21, C.sun, 7);
      c.fillStyle = hexA('#fff', 0.7); c.fillRect(bx0, y + 26, bw * fL, 6); this.text(`${fmt(100 * fL, fL < 0.01 ? 2 : 0)} % of light`, bx0 + bw * fL + 4, y + 29, C.text, 7);
    });
    this.setReadout([
      ['Stars formed', `${N >= 1e4 ? sci(N, 2) : fmt(N, 0)} · mean mass ${fmt(Mc / N, 2)} M☉`, C.sun],
      ['Future supernovae (> 8 M☉)', `${fmt(stats[4].n, stats[4].n < 10 ? 1 : 0)} stars holding ${fmt(100 * stats[4].mm / Mc, 0)} % of the mass and ${fmt(100 * stats[4].l / Ltot, 0)} % of the light`, '#fff'],
      ['Most massive star expected', `${fmt(Math.min(120, (0.3 * Mc) ** 0.75 * 1.5), 0)} M☉ (statistical upper end)`],
      ['Brown dwarfs', this.form === 'salpeter' ? 'not included below 0.08 M☉' : `${fmt(100 * stats[0].n / N, 0)} % of objects, ${fmt(100 * stats[0].mm / Mc, 1)} % of the mass`, C.purple],
    ]);
  }
}

/* --------------------------------------------------------- 12.3c Strömgren ---- */

type OBType = 'O3' | 'O5' | 'O6' | 'O8' | 'B0' | 'B2';
const OB_STARS: Record<OBType, { T: number; L: number; lQ: number }> = { O3: { T: 44600, L: 8e5, lQ: 49.6 }, O5: { T: 41500, L: 4e5, lQ: 49.3 }, O6: { T: 39000, L: 1.3e5, lQ: 49.0 }, O8: { T: 35000, L: 6e4, lQ: 48.5 }, B0: { T: 30000, L: 2.5e4, lQ: 47.8 }, B2: { T: 21000, L: 5e3, lQ: 45.6 } };
class StromgrenWidget extends CanvasWidget {
  private type: OBType = 'O6'; private ln = 8; private t = 0;
  constructor() {
    super(1.8);
    this.segmented<OBType>([['O3', 'O3 V'], ['O5', 'O5 V'], ['O6', 'O6 V'], ['O8', 'O8 V'], ['B0', 'B0 V'], ['B2', 'B2 V']], this.type, (v) => { this.type = v; this.t = 0; });
    this.slider('Gas density n_H', 6, 10, 0.05, this.ln, (v) => `10^${fmt(v, 1)} m⁻³`, (v) => { this.ln = v; this.t = 0; });
    this.playButton();
  }
  protected draw(dt: number) {
    const c = this.ctx, w = this.w, h = this.h; this.t += dt;
    const S = OB_STARS[this.type], n = 10 ** this.ln, Q = 10 ** S.lQ, alpha = 3.1e-19;
    const rS = (3 * Q / (4 * Math.PI * alpha)) ** (1 / 3) * n ** (-2 / 3);   // m
    const tRec = 1 / (alpha * n), tNow = this.t / 8 * 5 * tRec;   // 8 s of animation ≈ 5 recombination times
    const Rfront = rS * (1 - Math.exp(-tNow / tRec)) ** (1 / 3);
    // left: the nebula
    const cx = w * 0.27, cy = h * 0.46, Rp = Math.min(w * 0.22, h * 0.42);
    c.fillStyle = hexA('#2a2118', 0.6); c.fillRect(cx - Rp * 1.15, cy - Rp * 1.05, Rp * 2.3, Rp * 2.1);
    for (let i = 0; i < 80; i++) { const a = i * 2.399, r = Rp * 1.1 * Math.sqrt((i * 0.618) % 1); this.circle(cx + r * Math.cos(a) * 1.05, cy + r * Math.sin(a) * 0.95, 1, undefined, hexA('#8a7a66', 0.5)); }
    const frac = Rfront / rS;
    this.glow(cx, cy, Rp * frac * 1.05, hexA('#ff4b3a', 0.55)); this.glow(cx, cy, Rp * frac * 0.6, hexA('#ff9a7a', 0.4));
    this.circle(cx, cy, Rp * frac, hexA('#ffb0a0', 0.8), undefined, 1);
    this.glow(cx, cy, 10, rgba(tempRGB(S.T), 1)); this.circle(cx, cy, 3, undefined, '#fff');
    this.circle(cx, cy, Rp, hexA(C.dim, 0.5), undefined, 1, [3, 4]); this.text('r_S', cx + Rp + 4, cy, C.dim, 8);
    this.text(`ionisation front at ${fmt(100 * frac, 0)} % of r_S · t = ${fmtYr(tNow / YR_S)}`, cx, cy + Rp + 16, C.text, 9, 'center');
    this.text('H II: Hα fluorescence   ·   outside: neutral H I + dust', cx, cy - Rp - 12, C.dim, 8, 'center');
    const bar = Rp * 2 / (2 * rS / PC_M); this.line(cx - Rp, cy + Rp + 28, cx - Rp + bar, cy + Rp + 28, C.text, 2); this.text('1 pc', cx - Rp + bar / 2, cy + Rp + 38, C.text, 8, 'center');
    // right: r_S vs n for the types
    const x0 = w * 0.6, x1 = w - 12, y0 = 14, y1 = h - 30;
    axesBox(c, x0, y0, x1, y1);
    const X = (ln: number) => x0 + (ln - 6) / 4 * (x1 - x0);
    const Y = (lr: number) => y1 - 6 - (lr + 1.5) / 4 * (y1 - y0 - 12);
    for (let lr = -1; lr <= 2; lr++) { this.line(x0, Y(lr), x1, Y(lr), hexA(C.grid, 0.9)); this.text(`${10 ** lr}`, x0 - 4, Y(lr), C.dim, 8, 'right'); }
    for (let ln = 6; ln <= 10; ln++) this.text(`10${sup(ln)}`, X(ln), y1 + 10, C.dim, 8, 'center');
    this.text('n_H (m⁻³)', x1, y1 + 22, C.dim, 9, 'right'); this.text('Strömgren radius (pc)', x0 + 6, y0 + 10, C.dim, 8);
    for (const k of Object.keys(OB_STARS) as OBType[]) { const st = OB_STARS[k]; const col = k === this.type ? C.sun : hexA(C.dim, 0.6); plotCurve(c, 6, 10, 40, X, (ln) => Y(Math.log10((3 * 10 ** st.lQ / (4 * Math.PI * alpha)) ** (1 / 3) * (10 ** ln) ** (-2 / 3) / PC_M)), col, k === this.type ? 2 : 1); this.text(k, x1 - 4, Y(Math.log10((3 * 10 ** st.lQ / (4 * Math.PI * alpha)) ** (1 / 3) * 1e10 ** (-2 / 3) / PC_M)), col, 7, 'right'); }
    this.circle(X(this.ln), Y(Math.log10(rS / PC_M)), 5, '#fff', C.sun);
    const Mion = 4 / 3 * Math.PI * rS ** 3 * n * MH / MSUN;
    const lamMax = 2.898e-3 / S.T * 1e9, Egam = EV_NM / lamMax, Nwien = S.L * LSUN_W / (Egam * EV);
    this.setReadout([
      ['Ionising photons N (λ < 91.2 nm)', `${sci(Q, 1)} s⁻¹ (model atmospheres) · Wien estimate L/E_γ = ${sci(Nwien, 1)} with λ_max = ${fmt(lamMax, 0)} nm, E = ${fmt(Egam, 0)} eV`, C.sun],
      ['Strömgren radius', `${rS / PC_M < 1 ? fmt(rS / PC_M, 2) : fmt(rS / PC_M, 1)} pc`, '#ff9a7a'],
      ['Recombination time 1/αn', `${fmtYr(tRec / YR_S)} — the front reaches equilibrium in a few of these`],
      ['Ionised mass', `${Mion >= 1000 ? sci(Mion, 1) : fmt(Mion, 1)} M☉ of hydrogen at ~8000 K`],
    ]);
  }
}

/* ------------------------------------------------------------ 12.3d P Cygni ---- */

type ShellMode = 'outflow' | 'inverse' | 'fuori';
class PcygniWidget extends CanvasWidget {
  private v = 80; private tau = 1.2; private mode: ShellMode = 'outflow'; private t = 0;
  private sV: ReturnType<CanvasWidget['slider']>;
  constructor() {
    super(1.8);
    this.segmented<ShellMode>([['outflow', 'P Cygni (wind)'], ['inverse', 'inverse P Cygni (infall)'], ['fuori', 'FU Orionis outburst']], this.mode, (v) => { this.mode = v; if (v === 'fuori') { this.v = 300; this.sV.set(300); } });
    this.sV = this.slider('Shell speed', 20, 400, 5, this.v, (v) => `${v} km/s`, (v) => { this.v = v; });
    this.slider('Optical depth of the shell', 0.1, 5, 0.05, this.tau, (v) => fmt(v, 2), (v) => { this.tau = v; });
  }
  protected draw(dt: number) {
    const c = this.ctx, w = this.w, h = this.h; this.t += dt;
    const infall = this.mode === 'inverse', sgn = infall ? -1 : 1;
    // left: geometry (observer to the right)
    const cx = w * 0.22, cy = h * 0.46, R = Math.min(w * 0.15, h * 0.3);
    const ph = (this.t * 0.3) % 1, rs = R * (infall ? 1.3 - 0.5 * ph : 0.8 + 0.5 * ph);
    this.circle(cx, cy, rs, hexA(C.blue, 0.7), hexA(C.blue, 0.06), 1);
    this.circle(cx, cy, R, hexA(C.blue, 0.25), undefined, 1, [3, 3]);
    this.glow(cx, cy, 16, rgba(tempRGB(this.mode === 'fuori' ? 7000 : 4500), 1)); this.circle(cx, cy, 5, undefined, '#fff');
    // shaded part A in front of the star (toward observer)
    c.beginPath(); c.moveTo(cx + 5, cy - 5); c.lineTo(cx + R * 1.1, cy - 7); c.lineTo(cx + R * 1.1, cy + 7); c.lineTo(cx + 5, cy + 5); c.closePath(); c.fillStyle = hexA(C.red, 0.35); c.fill();
    for (let k = 0; k < 8; k++) { const a = k * TAU / 8 + 0.2; const r1 = R * 0.95, r2 = R * (0.95 + 0.2 * sgn); this.line(cx + r1 * Math.cos(a), cy + r1 * Math.sin(a), cx + r2 * Math.cos(a), cy + r2 * Math.sin(a), hexA('#fff', 0.6), 1.5); }
    this.text('A: absorbs starlight, ' + (infall ? 'moving away → redshifted' : 'approaching → blueshifted'), cx + R * 0.55, cy + 18, C.red, 7, 'center');
    this.text('C', cx, cy - R - 8, C.sun, 8, 'center'); this.text('C', cx, cy + R + 10, C.sun, 8, 'center'); this.text('emission from the shell seen sideways: no net shift', cx, cy + R + 24, C.sun, 7, 'center');
    this.text('D', cx - R - 8, cy, C.dim, 8, 'center'); this.text('B', cx + R + 10, cy - 14, C.dim, 8, 'center');
    this.line(cx + R * 1.2, cy, w * 0.44, cy, hexA(C.text, 0.6), 1); this.text('to Earth →', w * 0.44, cy - 10, C.text, 8, 'right');
    this.text(infall ? 'infalling shell' : 'expanding shell', cx, cy - R - 24, C.text, 9, 'center');
    // right: profile
    const x0 = w * 0.52, x1 = w - 12, y0 = 14, y1 = h - 30;
    axesBox(c, x0, y0, x1, y1);
    const vmax = 500; const X = (v: number) => x0 + (v + vmax) / (2 * vmax) * (x1 - x0);
    const Y = (f: number) => y1 - 6 - f / 3.2 * (y1 - y0 - 12);
    for (const v of [-400, -200, 0, 200, 400]) this.text(`${v}`, X(v), y1 + 10, C.dim, 8, 'center');
    this.text('velocity (km/s)   blueshift ← | → redshift', x1, y1 + 22, C.dim, 9, 'right'); this.text('intensity / continuum', x0 + 6, y0 + 10, C.dim, 8);
    this.line(x0, Y(1), x1, Y(1), hexA(C.grid, 1), 1, [3, 3]); this.text('continuum', x1 - 6, Y(1) - 8, C.dim, 7, 'right');
    const emA = this.mode === 'fuori' ? 0.6 : 1.4 * Math.min(1, this.tau), wid = this.v * 0.9;
    const prof = (u: number) => { const em = emA * Math.exp(-(u * u) / (2 * wid * wid)); const abs = (1 - Math.exp(-this.tau)) * Math.exp(-((u + sgn * this.v) ** 2) / (2 * (0.25 * this.v) ** 2)); return (1 + em) * (1 - 0.85 * abs); };
    plotCurve(c, -vmax, vmax, 300, X, (u) => Y(prof(u)), C.sun, 2);
    this.line(X(-sgn * this.v), y0, X(-sgn * this.v), y1, hexA(C.red, 0.5), 1, [2, 3]); this.text(`${infall ? '+' : '−'}${this.v} km/s`, X(-sgn * this.v), y0 + 10, C.red, 8, 'center');
    this.line(X(0), y0, X(0), y1, hexA(C.grid, 1), 1, [2, 3]); this.text('λ₀', X(0), y0 + 10, C.dim, 8, 'center');
    const mdot = this.mode === 'fuori' ? 1e-4 : infall ? 1e-8 * this.tau : 1e-8 * this.tau * (this.v / 80) ** 2;
    this.setReadout([
      ['Profile', this.mode === 'outflow' ? 'P Cygni: broad emission + blueshifted absorption → mass loss' : infall ? 'inverse P Cygni: redshifted absorption → accretion onto the star' : 'FU Ori: disk outshines the star 100–1000×, broad blueshifted wind lines', C.sun],
      ['Absorption at', `${infall ? '+' : '−'}${this.v} km/s · depth ${fmt(100 * (1 - Math.exp(-this.tau)) * 0.85, 0)} %`, C.red],
      ['Typical rate', `${sci(mdot, 1)} M☉/yr ${this.mode === 'fuori' ? '(0.01 M☉ in a century; Δm ≈ −4 for decades)' : '(the Sun: 10⁻¹⁴)'}`],
      ['Also in the spectrum', 'Balmer, Ca II H & K and Fe emission; Li I 670.8 nm absorption (youth); forbidden [O I], [S II] (thin gas)'],
    ]);
  }
}

/* -------------------------------------------------------- 12.3e disk formation ---- */

class ProtodiskWidget extends CanvasWidget {
  private lw = -14; private lr0 = -1; private M = 1; private u = 0;
  constructor() {
    super(1.8);
    this.slider('Initial angular velocity ω₀', -15, -13, 0.05, this.lw, (v) => `${sci(10 ** v, 1)} s⁻¹ (P = ${fmtYr(TAU / 10 ** v / YR_S)})`, (v) => { this.lw = v; });
    this.slider('Initial radius r₀', -1.7, -0.3, 0.05, this.lr0, (v) => `${fmt(10 ** v, 2)} pc`, (v) => { this.lr0 = v; });
    this.slider('Mass', 0.3, 3, 0.1, this.M, (v) => `${fmt(v, 1)} M☉`, (v) => { this.M = v; });
    this.playButton();
  }
  protected draw(dt: number) {
    const c = this.ctx, w = this.w, h = this.h;
    this.u = (this.u + dt / 9) % 1.15; const u = Math.min(1, this.u);
    const w0 = 10 ** this.lw, r0 = 10 ** this.lr0 * PC_M, Mkg = this.M * MSUN;
    const rf = w0 * w0 * r0 ** 4 / (GRAV * Mkg);
    const rho0 = Mkg / (4 / 3 * Math.PI * r0 ** 3), tff = freeFallTime(rho0);
    const th = collapseTheta(u);   // axial collapse follows free fall
    const thEq = Math.max(th, rf / r0);   // equatorial collapse halts at r_f
    // left: side view; log-scaled radius so AU-scale disks remain visible
    const cx = w * 0.26, cy = h * 0.46, R = Math.min(w * 0.2, h * 0.4);
    const scale = (x: number) => R * Math.max(0.03, 1 + Math.log10(Math.max(x, 1e-4)) / 4);   // 1 → R, 1e-4 → 0
    const ax = scale(thEq), az = scale(th);
    this.circle(cx, cy, R, hexA(C.grid, 1), undefined, 1, [3, 4]);
    c.beginPath(); c.ellipse(cx, cy, ax, Math.max(2, az), 0, 0, TAU); c.fillStyle = hexA(C.blue, 0.15 + 0.5 * (1 - th)); c.fill(); c.strokeStyle = hexA(C.blue, 0.9); c.lineWidth = 1; c.stroke();
    const disk = thEq > th * 1.5;
    if (disk) { this.glow(cx, cy, 10, rgba(tempRGB(3500), 1)); this.circle(cx, cy, 3, undefined, '#fff'); const jl = R * 0.9 * Math.min(1, (thEq / th - 1.5) / 3); for (const s of [-1, 1]) { c.beginPath(); c.moveTo(cx - 3, cy); c.lineTo(cx - 8, cy + s * jl); c.lineTo(cx + 8, cy + s * jl); c.lineTo(cx + 3, cy); c.closePath(); c.fillStyle = hexA(C.red, 0.5); c.fill(); this.glow(cx, cy + s * jl, 8, hexA(C.red, 0.7)); } this.text('jets → Herbig–Haro objects', cx, cy - R - 12, C.red, 8, 'center'); }
    else this.text('collapse: faster along the axis than in the plane', cx, cy - R - 12, C.dim, 8, 'center');
    // rotation arrows
    for (let k = 0; k < 6; k++) { const a = k * TAU / 6 + this.u * 8 * (1 / Math.max(thEq, 0.01)) ** 0.3; const x = cx + ax * Math.cos(a), y = cy + Math.max(2, az) * Math.sin(a) * 0.9; this.circle(x, y, 1.5, undefined, hexA('#fff', 0.7)); }
    this.text(`t = ${fmt(u, 2)} t_ff · equator at ${thEq * r0 / AU_M < 1e4 ? fmt(thEq * r0 / AU_M, 0) + ' AU' : fmt(thEq * r0 / PC_M, 3) + ' pc'} · pole at ${th * r0 / AU_M < 1e4 ? fmt(th * r0 / AU_M, 0) + ' AU' : fmt(th * r0 / PC_M, 3) + ' pc'}`, cx, cy + R + 16, C.text, 8, 'center');
    this.text('(radius drawn on a log scale)', cx, cy + R + 28, C.faint, 7, 'center');
    // right: r_f and spin budget
    const x0 = w * 0.58, x1 = w - 12, y0 = 14, y1 = h - 30;
    axesBox(c, x0, y0, x1, y1);
    const X = (lw: number) => x0 + (lw + 15) / 2 * (x1 - x0);
    const Y = (lr: number) => y1 - 6 - (lr + 0.5) / 5 * (y1 - y0 - 12);   // AU, 10^-0.5 .. 10^4.5
    for (let lr = 0; lr <= 4; lr++) { this.line(x0, Y(lr), x1, Y(lr), hexA(C.grid, 0.9)); this.text(`10${sup(lr)}`, x0 - 4, Y(lr), C.dim, 8, 'right'); }
    for (const lw of [-15, -14.5, -14, -13.5, -13]) this.text(`10^${lw}`, X(lw), y1 + 10, C.dim, 7, 'center');
    this.text('ω₀ (s⁻¹)', x1, y1 + 22, C.dim, 9, 'right'); this.text('disk radius r_f (AU)', x0 + 6, y0 + 10, C.dim, 8);
    for (const lr0 of [-1.7, -1, -0.3]) { const col = Math.abs(lr0 - this.lr0) < 0.03 ? C.sun : hexA(C.dim, 0.6); plotCurve(c, -15, -13, 40, X, (lw) => Y(Math.log10((10 ** lw) ** 2 * (10 ** lr0 * PC_M) ** 4 / (GRAV * Mkg) / AU_M)), col, col === C.sun ? 2 : 1); this.text(`r₀ = ${fmt(10 ** lr0, 2)} pc`, x1 - 4, Y(Math.log10(1e-26 * (10 ** lr0 * PC_M) ** 4 / (GRAV * Mkg) / AU_M)) - 8, col, 7, 'right'); }
    plotCurve(c, -15, -13, 40, X, (lw) => Y(Math.log10((10 ** lw) ** 2 * r0 ** 4 / (GRAV * Mkg) / AU_M)), C.sun, 2);
    this.line(x0, Y(Math.log10(30)), x1, Y(Math.log10(30)), hexA(C.accent, 0.6), 1, [4, 3]); this.text('Neptune\'s orbit', x0 + 6, Y(Math.log10(30)) - 8, C.accent, 7);
    this.line(x0, Y(Math.log10(RSUN / AU_M)), x1, Y(Math.log10(RSUN / AU_M)), hexA(C.red, 0.6), 1, [4, 3]); this.text('R☉', x0 + 6, Y(Math.log10(RSUN / AU_M)) - 8, C.red, 7);
    this.circle(X(this.lw), Y(Math.log10(rf / AU_M)), 5, '#fff', C.sun);
    const vEdge = w0 * r0, vKep = Math.sqrt(GRAV * Mkg / rf), wStar = w0 * (r0 / RSUN) ** 2, wBreak = Math.sqrt(GRAV * Mkg / RSUN ** 3);
    this.setReadout([
      ['Disk radius r_f = ω₀²r₀⁴/GM', `${rf / AU_M >= 1e4 ? sci(rf / AU_M, 1) : fmt(rf / AU_M, rf / AU_M < 10 ? 2 : 0)} AU`, C.sun],
      ['Initial edge speed · Keplerian speed at r_f', `${fmt(vEdge, 1)} m/s · ${fmt(vKep / 1e3, 1)} km/s`],
      ['If all spin were kept to R☉', `ω = ${sci(wStar, 1)} s⁻¹ = ${sci(wStar / wBreak, 1)} × breakup — impossible: angular momentum must be shed (disk, jets, magnetic braking)`, C.red],
      ['Free-fall time', fmtYr(tff / YR_S)],
    ]);
  }
}

/* ============================================================================ */
/*  CHAPTER 13 — MAIN SEQUENCE AND POST-MAIN-SEQUENCE EVOLUTION                   */
/* ============================================================================ */

/** Schaller et al. (1992) elapsed times (Myr) to the numbered points of Fig. 13.1 (Table 13.1) */
const EVO_TIMES: Array<[number, number[]]> = [
  [25, [0, 6.33044, 6.40774, 6.41337, 6.43767, 6.51783, 7.04971, 7.0591]],
  [15, [0, 11.4099, 11.5842, 11.5986, 11.6118, 11.6135, 11.6991, 12.7554]],
  [12, [0, 15.7149, 16.0176, 16.0337, 16.0555, 16.1150, 16.4230, 16.7120, 17.5847, 17.6749]],
  [9, [0, 25.9376, 26.3886, 26.4198, 26.4580, 26.5019, 27.6446, 28.1330, 28.9618, 29.2294]],
  [7, [0, 42.4607, 43.1880, 43.2291, 43.3388, 43.4304, 45.3175, 46.1810, 47.9727, 48.3916]],
  [5, [0, 92.9357, 94.4591, 94.5735, 94.9218, 95.2108, 99.3835, 100.888, 107.208, 108.454]],
  [4, [0, 162.043, 164.734, 164.916, 165.701, 166.362, 172.38, 185.435, 192.198, 194.284]],
  [3, [0, 346.240, 352.503, 352.792, 355.018, 357.310, 366.880, 420.502, 440.536]],
  [2.5, [0, 574.337, 584.916, 586.165, 589.786, 595.476, 607.356, 710.235, 757.056]],
  [2, [0, 1094.08, 1115.94, 1117.74, 1129.12, 1148.10, 1160.96, 1379.94, 1411.25]],
  [1.5, [0, 2632.52, 2690.39, 2699.52, 2756.73, 2910.76]],
  [1.25, [0, 4703.20, 4910.11, 4933.83, 5114.83, 5588.92]],
  [1, [0, 7048.40, 9844.57, 11386.0, 11635.8, 12269.8]],
  [0.8, [0, 18828.9, 25027.9]],
];
/** main-sequence lifetime (Myr): end of core H burning — point 2 above 2 M☉, point 3 below (Schaller), extrapolated outside */
function evoMsLifetime(M: number): number {
  const rows = EVO_TIMES.map(([m, t]) => [Math.log10(m), Math.log10(m >= 2 ? t[1] : t[Math.min(2, t.length - 1)])] as [number, number]).reverse();
  const lm = Math.log10(M);
  if (lm <= rows[0][0]) return 10 ** (rows[0][1] - 2.5 * (lm - rows[0][0]));
  const last = rows[rows.length - 1];
  if (lm >= last[0]) return 10 ** (last[1] - 1.15 * (lm - last[0]));
  for (let i = 0; i < rows.length - 1; i++) if (lm <= rows[i + 1][0]) { const f = (lm - rows[i][0]) / (rows[i + 1][0] - rows[i][0]); return 10 ** (rows[i][1] + f * (rows[i + 1][1] - rows[i][1])); }
  return 1e4;
}
/** Hayashi-line temperature of a giant of mass M */
const giantLT = (M: number) => 3.62 + 0.035 * Math.log10(M);
/** luminosity, radius and T_eff of a main-sequence star at fraction u of its lifetime */
function msEvolved(M: number, u: number) {
  const ms = mainSequence(M); const L = ms.L * (1 + 0.4 * u + 0.7 * u * u), R = ms.R * (1 + 0.35 * u * u);
  return { L, R, T: 5772 * Math.pow(L / (R * R), 0.25) };
}
/** schematic track points 1..n for the masses of Table 13.1, in (log T_eff, log L) */
function evoTrackPoints(M: number, n: number): Array<{ lT: number; lL: number }> {
  const ms = mainSequence(M), lT1 = Math.log10(ms.T), lL1 = Math.log10(ms.L), lTH = giantLT(M), lm = Math.log10(M);
  const pts: Array<{ lT: number; lL: number }> = [{ lT: lT1, lL: lL1 }];
  if (M >= 2) {
    const loop = M >= 20 ? 0.45 : M >= 12 ? 0.12 : 0.28;
    pts.push({ lT: lT1 - 0.07, lL: lL1 + 0.3 }, { lT: lT1 - 0.03, lL: lL1 + 0.38 }, { lT: lT1 - 0.15, lL: lL1 + 0.33 }, { lT: lTH + 0.05, lL: lL1 + 0.23 }, { lT: lTH - 0.02, lL: lL1 + 0.68 }, { lT: lTH + loop, lL: lL1 + 0.83 }, { lT: lTH + 0.05, lL: lL1 + 0.98 }, { lT: lTH - 0.03, lL: lL1 + 1.08 }, { lT: lTH - 0.06, lL: lL1 + 1.3 });
  } else {
    const p2 = msEvolved(M, 0.72), p3 = msEvolved(M, 1);
    pts.push({ lT: Math.log10(p2.T), lL: Math.log10(p2.L) }, { lT: Math.log10(p3.T), lL: Math.log10(p3.L) }, { lT: Math.log10(p3.T) - 0.03, lL: Math.log10(p3.L) + 0.17 }, { lT: lTH, lL: Math.log10(p3.L) + 0.4 + 0.3 * lm }, { lT: lTH - 0.08, lL: 3.3 });
  }
  return pts.slice(0, n);
}
/** piecewise-linear interpolation through track points with softened corners, u in [0, n-1] */
function splineAt(pts: Array<{ lT: number; lL: number }>, u: number): { lT: number; lL: number } {
  const n = pts.length; const i = Math.max(0, Math.min(n - 2, Math.floor(u))); const t = Math.max(0, Math.min(1, u - i));
  const s = t * t * (3 - 2 * t) * 0.3 + t * 0.7;                                   // mild ease keeps corners but rounds them a little
  const p1 = pts[i], p2 = pts[Math.min(n - 1, i + 1)];
  return { lT: p1.lT + s * (p2.lT - p1.lT), lL: p1.lL + s * (p2.lL - p1.lL) };
}
/** H–R frame: axes, grid and labels; returns mapping functions */
function hrFrame(c: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, lTa: number, lTb: number, lLa: number, lLb: number, yLabel = 'L (L☉)') {
  axesBox(c, x0, y0, x1, y1);
  const X = (lT: number) => x1 - (lT - lTa) / (lTb - lTa) * (x1 - x0);
  const Y = (lL: number) => y1 - 6 - (lL - lLa) / (lLb - lLa) * (y1 - y0 - 12);
  c.font = '8px -apple-system, system-ui, sans-serif'; c.textBaseline = 'middle';
  for (let lL = Math.ceil(lLa); lL <= Math.floor(lLb); lL++) { c.strokeStyle = hexA(C.grid, 0.9); c.lineWidth = 1; c.beginPath(); c.moveTo(x0, Y(lL)); c.lineTo(x1, Y(lL)); c.stroke(); c.fillStyle = C.dim; c.textAlign = 'right'; c.fillText(lL === 0 ? '1' : `10${sup(lL)}`, x0 - 4, Y(lL)); }
  c.textAlign = 'center'; for (let lT = Math.ceil(lTa * 10) / 10; lT <= lTb + 1e-9; lT = Math.round((lT + 0.2) * 10) / 10) c.fillText(fmt(lT, 1), X(lT), y1 + 10);
  c.textAlign = 'right'; c.fillStyle = C.dim; c.font = '9px -apple-system, system-ui, sans-serif'; c.fillText('log T_eff (K)  ← hotter', x1, y1 + 22);
  c.textAlign = 'left'; c.font = '8px -apple-system, system-ui, sans-serif'; c.fillText(yLabel, x0 + 6, y0 + 10);
  return { X, Y };
}

type EvoPhase = 'pms' | 'ms' | 'sgb' | 'rgb' | 'he' | 'agb' | 'pagb' | 'wd' | 'sn';
/** phase and H–R position of a star of mass M at age t (Myr) */
function evoState(M: number, t: number, popII = false): { phase: EvoPhase; lT: number; lL: number } {
  const tP = pmsTime(M), tMS = evoMsLifetime(M), lm = Math.log10(M), lTH = giantLT(M);
  if (t < tP) { const p = pmsPoint(t / tP, M); return { phase: 'pms', lT: p.lT, lL: p.lL }; }
  const u = (t - tP) / tMS;
  if (u < 1) { const s = msEvolved(M, u); return { phase: 'ms', lT: Math.log10(s.T), lL: Math.log10(s.L) }; }
  const w = Math.max(0, Math.min(1, (lm - 0.1) / 0.2));                    // 0 below 1.25 M☉, 1 above 2 M☉
  const fS = 0.18 + w * (0.012 - 0.18), fR = 0.06 + w * (0.02 - 0.06), fH = 0.012 + w * (0.08 - 0.012), fA = 0.001 + w * (0.01 - 0.001), fP = 2e-6;
  const to = msEvolved(M, 1), lTto = Math.log10(to.T), lLto = Math.log10(to.L);
  const lLbase = lLto + (M < 2 ? 0.45 + 0.3 * lm : -0.15), lLtip = M < 2 ? 3.3 : lLbase + 0.45;
  let v = u - 1;
  if (v < fS) { const f = v / fS; return { phase: 'sgb', lT: lTto + f * (lTH - lTto), lL: lLto + f * (lLbase - lLto) }; }
  v -= fS;
  if (v < fR) { const f = (v / fR) ** 0.6; return { phase: 'rgb', lT: lTH - 0.08 * f, lL: lLbase + f * (lLtip - lLbase) }; }
  v -= fR;
  if (v < fH) {
    const f = v / fH;
    if (M < 2) return popII ? { phase: 'he', lT: 3.68 + 0.35 * f, lL: 1.7 - 0.1 * f } : { phase: 'he', lT: 3.68 + 0.02 * Math.sin(f * 6), lL: 1.7 + 0.1 * f };
    const loop = M >= 20 ? 0.45 : M >= 12 ? 0.12 : 0.28;
    return { phase: 'he', lT: lTH + loop * Math.sin(Math.PI * f) ** 2, lL: lLtip + 0.15 + 0.15 * f };
  }
  v -= fH;
  if (M > 8) return { phase: 'sn', lT: lTH, lL: lLtip + 0.3 };
  if (v < fA) { const f = v / fA; return { phase: 'agb', lT: lTH - 0.06 - 0.06 * f, lL: lLtip + 0.3 + f * (M < 2 ? 0.45 : 0.7) }; }
  v -= fA;
  const lLagb = lLtip + 0.3 + (M < 2 ? 0.45 : 0.7);
  if (v < fP) { const f = v / fP; return { phase: 'pagb', lT: lTH - 0.12 + f * (5.0 - lTH + 0.12), lL: lLagb - 0.1 * f }; }
  const tWD = Math.max(0.01, (v - fP) * tMS);                               // Myr since the planetary nebula
  const L = 10 ** (-0.4 - 1.25 * Math.log10(tWD / 5));                       // Mestel-like cooling, 0.4 L☉ at 5 Myr
  const R = 0.0135, T = 5772 * Math.pow(L / (R * R), 0.25);
  return { phase: 'wd', lT: Math.log10(T), lL: Math.log10(L) };
}
const PHASE_META: Record<EvoPhase, [string, string]> = { pms: ['pre-main-sequence', C.purple], ms: ['main sequence', C.blue], sgb: ['subgiant branch', C.accent], rgb: ['red giant branch', C.red], he: ['core He burning (HB / clump / loop)', C.sun], agb: ['asymptotic giant branch', C.mars], pagb: ['post-AGB / planetary nebula', C.green], wd: ['white dwarf', '#dfe7ff'], sn: ['gone: supernova (M > 8 M☉)', C.dim] };

/* ------------------------------------------------------ 13.1a timescales ---- */

class EvotimescalesWidget extends CanvasWidget {
  private lM = 0;
  constructor() {
    super(1.8);
    this.slider('Mass', Math.log10(0.1), 2, 0.01, this.lM, (v) => `${fmt(10 ** v, 10 ** v < 3 ? 2 : 0)} M☉`, (v) => { this.lM = v; });
  }
  protected draw() {
    const c = this.ctx, w = this.w, h = this.h;
    const M = 10 ** this.lM, ms = mainSequence(M);
    const tff = (m: number) => { const s = mainSequence(m); const rho = m * MSUN / (4 / 3 * Math.PI * (s.R * RSUN) ** 3); return Math.sqrt(3 * Math.PI / (32 * GRAV * rho)) / YR_S; };
    const tkh = (m: number) => { const s = mainSequence(m); return GRAV * (m * MSUN) ** 2 / (s.R * RSUN * s.L * LSUN_W) / YR_S; };
    const tnuc = (m: number) => evoMsLifetime(m) * 1e6;
    const x0 = PLOT_MARGIN, x1 = w * 0.58, y0 = 14, y1 = h - 30;
    axesBox(c, x0, y0, x1, y1);
    const X = (lm: number) => x0 + (lm + 1) / 3 * (x1 - x0);
    const Y = (lt: number) => y1 - 6 - (lt + 7) / 19 * (y1 - y0 - 12);
    for (let lt = -6; lt <= 11; lt += 2) { this.line(x0, Y(lt), x1, Y(lt), hexA(C.grid, 0.9)); this.text(`10${sup(lt)}`, x0 - 4, Y(lt), C.dim, 8, 'right'); }
    for (const lm of [-1, 0, 1, 2]) this.text(lm === 0 ? '1' : `10${sup(lm)}`, X(lm), y1 + 10, C.dim, 8, 'center');
    this.text('mass (M☉)', x1, y1 + 22, C.dim, 9, 'right'); this.text('timescale (yr)', x0 + 6, y0 + 10, C.dim, 8);
    this.line(x0, Y(Math.log10(13.8e9)), x1, Y(Math.log10(13.8e9)), hexA(C.purple, 0.6), 1, [3, 3]); this.text('age of the universe', x1 - 4, Y(Math.log10(13.8e9)) - 7, C.purple, 7, 'right');
    plotCurve(c, -1, 2, 80, X, (lm) => Y(Math.log10(tnuc(10 ** lm))), C.sun, 2); this.text('t_nuc (main sequence)', X(1.2), Y(Math.log10(tnuc(10 ** 1.2))) - 10, C.sun, 8, 'center');
    plotCurve(c, -1, 2, 80, X, (lm) => Y(Math.log10(tkh(10 ** lm))), C.blue, 2); this.text('t_KH = GM²/RL', X(1.2), Y(Math.log10(tkh(10 ** 1.2))) - 10, C.blue, 8, 'center');
    plotCurve(c, -1, 2, 80, X, (lm) => Y(Math.log10(tff(10 ** lm))), C.red, 2); this.text('t_ff', X(1.2), Y(Math.log10(tff(10 ** 1.2))) - 10, C.red, 8, 'center');
    const vals = [tff(M), tkh(M), tnuc(M)]; const cols = [C.red, C.blue, C.sun];
    vals.forEach((v, i) => this.circle(X(this.lM), Y(Math.log10(v)), 4, '#fff', cols[i]));
    this.line(X(this.lM), y0, X(this.lM), y1, hexA(C.text, 0.25), 1, [2, 3]);
    // right: life budget
    const bx0 = w * 0.65, bx1 = w - 12; let y = y0 + 8;
    this.text(`life budget of a ${fmt(M, M < 3 ? 2 : 0)} M☉ star`, bx0, y, C.text, 9); y += 16;
    const tMS = tnuc(M), tKH = tkh(M);
    const items: Array<[string, number, string]> = [['pre-MS contraction (~t_KH)', pmsTime(M) * 1e6, C.purple], ['main sequence (t_nuc)', tMS, C.blue], ['SGB + RGB', tMS * (M < 1.25 ? 0.24 : 0.03), C.accent], ['core He burning', tMS * (M < 1.25 ? 0.012 : 0.08), C.sun], ['AGB + planetary nebula', tMS * 0.003, C.mars]];
    const tot = items.reduce((s, it) => s + it[1], 0);
    for (const [lab, t, col] of items) { const f = t / tot; this.text(lab, bx0, y, col, 8); c.fillStyle = hexA(col, 0.8); c.fillRect(bx0, y + 7, (bx1 - bx0) * Math.max(0.004, f), 6); this.text(`${fmtYr(t)} · ${fmt(100 * f, f < 0.01 ? 2 : 0)} %`, bx0 + (bx1 - bx0) * Math.max(0.004, f) + 4 > bx1 - 60 ? bx1 : bx0 + (bx1 - bx0) * Math.max(0.004, f) + 4, y + 10, C.dim, 7, bx0 + (bx1 - bx0) * Math.max(0.004, f) + 4 > bx1 - 60 ? 'right' : 'left'); y += 24; }
    this.text(`core H burning: ${fmt(100 * tMS / tot, 0)} % of its life`, bx0, y + 4, C.text, 8);
    this.text(M > 0.9 && tMS < 13.8e9 ? 'transitions run on t_KH: few stars caught there' : 't_MS > age of the universe: none has left the MS yet', bx0, y + 18, C.dim, 7);
    this.setReadout([
      ['Free-fall (3π/32Gρ̄)^½', `${fmt(vals[0] * YR_S / 60, 0)} min · ρ̄ = ${fmtSci(M * MSUN / (4 / 3 * Math.PI * (ms.R * RSUN) ** 3), 0)} kg m⁻³`, C.red],
      ['Kelvin–Helmholtz GM²/RL', `${fmtYr(tKH)} — contraction and the readjustments between fuels`, C.blue],
      ['Nuclear (main-sequence lifetime)', `${fmtYr(tMS)} — L = ${fmtSci(ms.L, 1)} L☉, so t_nuc ∝ M/L ∝ M^−2.5`, C.sun],
      ['Ratio t_nuc : t_KH : t_ff', `1 : ${sci(tKH / tMS, 0)} : ${sci(vals[0] / tMS, 0)}`],
    ]);
  }
}

/* --------------------------------------------- 13.1b main-sequence ageing ---- */

class MscoreWidget extends CanvasWidget {
  private lM = 0; private u = 0.47;
  constructor() {
    super(1.8);
    this.slider('Mass', Math.log10(0.8), Math.log10(1.5), 0.01, this.lM, (v) => `${fmt(10 ** v, 2)} M☉`, (v) => { this.lM = v; });
    this.slider('Age / t_MS', 0, 1.15, 0.005, this.u, (v) => fmt(v, 2), (v) => { this.u = v; });
  }
  protected draw() {
    const c = this.ctx, w = this.w, h = this.h;
    const M = 10 ** this.lM, tMS = evoMsLifetime(M) * 1e6, u = this.u, um = Math.min(1, u);
    const X0 = 0.71, Y0 = 0.27, Z = 0.02; const Xc = X0 * (1 - um), Yc = Y0 + X0 * um;
    const mu = (X: number, Y: number) => 1 / (2 * X + 0.75 * Y + 0.5 * Z);
    const Tc0 = 13.6e6 * M ** 0.5, rc0 = 8.8e4 / M ** 0.7;
    const Tc = Tc0 * (1 + 0.4 * um), rc = rc0 * (1 + 1.3 * um + 0.9 * um * um);
    const s = msEvolved(M, um); const ms = mainSequence(M);
    const core = u > 1 ? Math.min(0.13, 0.08 * (u - 1) / 0.1) : 0;   // isothermal core mass fraction after H exhaustion
    // left: histories
    const x0 = PLOT_MARGIN, x1 = w * 0.55, y0 = 14, y1 = h - 30;
    axesBox(c, x0, y0, x1, y1);
    const X = (uu: number) => x0 + uu / 1.15 * (x1 - x0);
    const Y = (f: number) => y1 - 6 - f / 3.4 * (y1 - y0 - 12);
    for (let f = 0; f <= 3; f += 0.5) { this.line(x0, Y(f), x1, Y(f), hexA(C.grid, 0.9)); this.text(fmt(f, 1), x0 - 4, Y(f), C.dim, 8, 'right'); }
    for (const uu of [0, 0.25, 0.5, 0.75, 1]) this.text(fmt(uu, 2), X(uu), y1 + 10, C.dim, 8, 'center');
    this.text('age / main-sequence lifetime', x1, y1 + 22, C.dim, 9, 'right'); this.text('relative to the ZAMS value', x0 + 6, y0 + 10, C.dim, 8);
    c.fillStyle = hexA(C.red, 0.08); c.fillRect(X(1), y0, x1 - X(1), y1 - y0); this.text('core H', (X(1) + x1) / 2, y1 - 36, C.red, 7, 'center'); this.text('gone', (X(1) + x1) / 2, y1 - 26, C.red, 7, 'center');
    const curves: Array<[string, (v: number) => number, string]> = [
      ['L / L₀', (v) => msEvolved(M, Math.min(1, v)).L / ms.L, C.sun], ['R / R₀', (v) => msEvolved(M, Math.min(1, v)).R / ms.R, C.accent], ['T_c / T_c0', (v) => 1 + 0.4 * Math.min(1, v), C.red], ['ρ_c / ρ_c0', (v) => { const q = Math.min(1, v); return 1 + 1.3 * q + 0.9 * q * q; }, C.purple], ['X_c / X₀', (v) => 1 - Math.min(1, v), C.blue], ['μ_c / μ₀', (v) => mu(X0 * (1 - Math.min(1, v)), Y0 + X0 * Math.min(1, v)) / mu(X0, Y0), C.green],
    ];
    for (const [, f, col] of curves) plotCurve(c, 0, 1.15, 100, X, (v) => Y(f(v)), col, 1.5);
    const labs = curves.map(([lab, f, col]) => ({ lab, y: Y(f(1.15)), col })).sort((a, b) => a.y - b.y);
    for (let i = 1; i < labs.length; i++) labs[i].y = Math.max(labs[i].y, labs[i - 1].y + 10);
    for (const e of labs) this.text(e.lab, X(1.02), e.y, e.col, 7);
    this.line(X(u), y0, X(u), y1, hexA(C.text, 0.4), 1, [2, 3]);
    if (Math.abs(M - 1) < 0.03) { this.circle(X(0.47), Y(1.3), 4, C.sun); this.text('Sun today', X(0.47), Y(1.3) - 10, C.sun, 7, 'center'); }
    // right: interior profile
    const px0 = w * 0.63, px1 = w - 12, py0 = 14, py1 = h - 30;
    axesBox(c, px0, py0, px1, py1);
    const PX = (m: number) => px0 + m * (px1 - px0); const PY = (f: number) => py1 - 6 - f * (py1 - py0 - 12);
    for (const m of [0, 0.25, 0.5, 0.75, 1]) this.text(fmt(m, 2), PX(m), py1 + 10, C.dim, 8, 'center');
    this.text('mass coordinate M_r / M', px1, py1 + 22, C.dim, 9, 'right'); this.text('interior profiles', px0 + 6, py0 + 10, C.dim, 8);
    const Xr = (m: number) => { const prof = X0 - (X0 - Xc) * Math.exp(-((m / 0.32) ** 2)); return u > 1 && m < core ? 0 : prof; };
    plotCurve(c, 0, 1, 120, PX, (m) => PY(Xr(m) / 0.75), C.blue, 2); this.text('X(M_r)', PX(0.8), PY(X0 / 0.75) - 9, C.blue, 8, 'center');
    const Tr = (m: number) => { const base = Math.exp(-((m / 0.45) ** 1.4)); return u > 1 && m < core ? Math.exp(-((core / 0.45) ** 1.4)) : base; };
    plotCurve(c, 0, 1, 120, PX, (m) => PY(0.95 * Tr(m)), C.red, 2); this.text('T(M_r)', PX(0.35), PY(0.95 * Tr(0.35)) - 9, C.red, 8, 'center');
    const Lr = (m: number) => { const edge = u > 1 ? core : 0; const q = Math.max(0, m - edge) / (0.35 + 0.2 * (u > 1 ? 1 : 0) - edge); return Math.min(1, 1 - Math.exp(-(q ** 1.6) * 3)); };
    plotCurve(c, 0, 1, 120, PX, (m) => PY(0.9 * Lr(m)), C.sun, 1.5, [4, 3]); this.text('L_r / L', PX(0.6), PY(0.9) - 9, C.sun, 8, 'center');
    if (u > 1) { c.fillStyle = hexA(C.red, 0.12); c.fillRect(PX(0), py0, PX(core) - PX(0), py1 - py0); this.text('He core', PX(core / 2), py0 + 26, C.red, 7, 'center'); this.text('dT/dr = 0', PX(core / 2), py0 + 36, C.red, 7, 'center'); this.text('H shell →', PX(core) + 4, PY(0.5), C.sun, 7); }
    this.setReadout([
      ['Age', `${fmtYr(u * tMS)} of t_MS = ${fmtYr(tMS)}${u > 1 ? ' — past hydrogen exhaustion, thick H shell burning' : ''}`, C.text],
      ['Core', u > 1 ? `X_c = 0 · isothermal He core of ${fmt(100 * core, 0)} % of the mass, growing on shell ash${core >= 0.13 ? ' — at the Schönberg–Chandrasekhar limit' : ''}` : `X_c = ${fmt(Xc, 2)} (from ${X0}) · Y_c = ${fmt(Yc, 2)} · μ_c = ${fmt(mu(Xc, Yc), 3)} (from ${fmt(mu(X0, Y0), 3)})`, C.blue],
      ['Centre', `T_c = ${fmt(Tc / 1e6, 1)} × 10⁶ K · ρ_c = ${fmtSci(rc, 1)} kg m⁻³ · P_c = ${fmtSci(rc * K_B * Tc / (mu(Xc, Yc) * M_H), 1)} Pa`, C.red],
      ['Surface', `L = ${fmt(s.L, 2)} L☉ (+${fmt(100 * (s.L / ms.L - 1), 0)} %) · R = ${fmt(s.R, 2)} R☉ · T_eff = ${fmt(s.T, 0)} K`, C.sun],
    ]);
  }
}

/* ------------------------------------------ 13.1c Schönberg–Chandrasekhar ---- */

class SclimitWidget extends CanvasWidget {
  private muE = 0.63; private muI = 1.34; private deg = 0;
  constructor() {
    super(1.8);
    this.slider('μ envelope', 0.55, 0.8, 0.01, this.muE, (v) => fmt(v, 2), (v) => { this.muE = v; });
    this.slider('μ core', 0.6, 1.4, 0.01, this.muI, (v) => fmt(v, 2), (v) => { this.muI = v; });
    this.slider('Electron degeneracy', 0, 1, 0.01, this.deg, (v) => v === 0 ? 'none (ideal gas)' : v < 0.5 ? 'partial' : 'strong', (v) => { this.deg = v; });
  }
  protected draw() {
    const c = this.ctx, w = this.w, h = this.h;
    const q = 0.37 * (this.muE / this.muI) ** 2;           // exact S–C fraction
    const boost = 1 + 2.5 * this.deg;                        // degenerate pressure support raises P_ic,max
    const qDeg = q * Math.sqrt(boost);
    // left: P_ic,max / P_env against core fraction
    const x0 = PLOT_MARGIN, x1 = w * 0.55, y0 = 14, y1 = h - 30;
    axesBox(c, x0, y0, x1, y1);
    const X = (f: number) => x0 + f / 0.3 * (x1 - x0);
    const Y = (lp: number) => y1 - 6 - (lp + 1.5) / 3.5 * (y1 - y0 - 12);
    for (let lp = -1; lp <= 2; lp++) { this.line(x0, Y(lp), x1, Y(lp), hexA(C.grid, 0.9)); this.text(`10${sup(lp)}`, x0 - 4, Y(lp), C.dim, 8, 'right'); }
    for (const f of [0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3]) this.text(fmt(f, 2), X(f), y1 + 10, C.dim, 8, 'center');
    this.text('isothermal core mass fraction M_ic / M', x1, y1 + 22, C.dim, 9, 'right'); this.text('pressure / envelope demand', x0 + 6, y0 + 10, C.dim, 8);
    this.line(x0, Y(0), x1, Y(0), C.accent, 1.5); this.text('P_env ∼ GM²/4πR⁴: what the envelope needs', x0 + 8, Y(0) - 9, C.accent, 7);
    plotCurve(c, 0.01, 0.3, 120, X, (f) => Y(Math.log10((q / f) ** 2)), C.blue, 2); this.text('P_ic,max ∝ (kT/μ_ic m_H)⁴ / G³M_ic²  (ideal)', X(0.11), Y(Math.log10((q / 0.11) ** 2)) + 12, C.blue, 7);
    if (this.deg > 0) { plotCurve(c, 0.01, 0.3, 120, X, (f) => Y(Math.log10(boost * (q / f) ** 2)), C.purple, 2); this.text('+ degenerate electrons', X(0.2), Y(Math.log10(boost * (q / 0.2) ** 2)) - 9, C.purple, 7); }
    const lim = this.deg > 0 ? qDeg : q;
    c.fillStyle = hexA(C.red, 0.08); c.fillRect(X(Math.min(0.3, lim)), y0, x1 - X(Math.min(0.3, lim)), y1 - y0); this.text('core cannot support envelope', X(Math.min(0.3, lim)) + 4, y0 + 24, C.red, 7); this.text('→ collapse on t_KH', X(Math.min(0.3, lim)) + 4, y0 + 34, C.red, 7);
    this.line(X(lim), y0, X(lim), y1, C.red, 1, [3, 3]); this.text(`(M_ic/M)_SC = ${fmt(lim, 3)}`, X(lim), y1 - 14, C.red, 8, X(lim) > x1 - 70 ? 'right' : 'left');
    // right: P_ic(R_ic) for a given core mass, showing the maximum
    const px0 = w * 0.63, px1 = w - 12, py0 = 14, py1 = h - 30;
    axesBox(c, px0, py0, px1, py1);
    const PX = (r: number) => px0 + r / 3 * (px1 - px0); const PY = (p: number) => py1 - 6 - (p + 0.6) / 1.7 * (py1 - py0 - 12);
    for (const r of [0, 1, 2, 3]) this.text(r === 1 ? 'R_max' : `${r} R_max`, PX(r), py1 + 10, C.dim, 8, 'center');
    this.text('core radius R_ic', px1, py1 + 22, C.dim, 9, 'right'); this.text('P_ic at fixed M_ic, T_ic', px0 + 6, py0 + 10, C.dim, 8);
    this.line(px0, PY(0), px1, PY(0), hexA(C.grid, 0.9));
    // P ∝ (1/R³)(a − b/R): thermal term minus gravity term, normalised so the maximum sits at R = 1 with P = 1
    const clampP = (p: number) => Math.max(-0.6, Math.min(1.08, p));
    const P = (r: number) => 4 * (1 / r ** 3) * (1 - 0.75 / r);
    plotCurve(c, 0.5, 3, 150, PX, (r) => PY(clampP(P(r))), C.blue, 2);
    plotCurve(c, 0.5, 3, 150, PX, (r) => PY(clampP(4 / r ** 3)), C.green, 1, [3, 3]); this.text('thermal ∝ M kT / μm_H R³', PX(1.05), PY(0.75), C.green, 7);
    plotCurve(c, 0.5, 3, 150, PX, (r) => PY(clampP(-3 / r ** 4)), C.red, 1, [3, 3]); this.text('gravity ∝ −GM² / R⁴', PX(1.3), PY(-0.4), C.red, 7);
    this.circle(PX(1), PY(1), 4, '#fff', C.blue); this.text('P_ic,max at R_ic = (2/5) GM_ic μ_ic m_H / kT_ic', PX(1) + 8, PY(1) + 14, C.text, 7);
    this.text('P_ic = (3/4πR³)(M kT/μm_H − GM²/5R)', px0 + 8, py1 - 14, C.dim, 7);
    this.setReadout([
      ['Schönberg–Chandrasekhar fraction', `0.37 (μ_env/μ_ic)² = 0.37 × (${fmt(this.muE, 2)}/${fmt(this.muI, 2)})² = ${fmt(q, 3)} — the rough estimate 0.54 (μ_env/μ_ic)² gives ${fmt(0.54 * (this.muE / this.muI) ** 2, 3)}`, C.blue],
      ['With degeneracy', this.deg === 0 ? 'ideal gas only: a 1 M☉ star would leave the main sequence when the He core reaches 8 % of its mass' : `pressure support ×${fmt(boost, 1)}: the core may reach ${fmt(100 * qDeg, 0)} % before collapsing${qDeg > 0.12 ? ' — like the partly degenerate 1 M☉ core (~13 %)' : ''}`, C.purple],
      ['Why a maximum', 'at large R the core is too dilute to press on the envelope; at small R its own gravity eats the thermal pressure — so for a given M_ic and T_ic there is a largest surface pressure it can supply'],
    ]);
  }
}

/* ---------------------------------------------- 13.1d evolutionary tracks ---- */

class EvotracksWidget extends CanvasWidget {
  private idx = 5; private u = 0.5;
  constructor() {
    super(1.8);
    this.slider('Mass (Table 13.1)', 0, EVO_TIMES.length - 1, 1, this.idx, (v) => `${EVO_TIMES[Math.round(v)][0]} M☉`, (v) => { this.idx = Math.round(v); this.u = Math.min(this.u, EVO_TIMES[this.idx][1].length - 1); });
    this.slider('Position along track', 0, 9, 0.01, this.u, (v) => `point ${fmt(1 + v, 2)}`, (v) => { this.u = v; });
    this.playButton();
  }
  protected draw(dt: number) {
    const c = this.ctx, w = this.w, h = this.h;
    const [M, times] = EVO_TIMES[this.idx]; const n = times.length;
    if (dt > 0) { this.u = (this.u + dt * 0.35) % (n - 1 + 0.6); }
    const u = Math.min(n - 1, this.u);
    const x0 = PLOT_MARGIN, x1 = w * 0.64, y0 = 14, y1 = h - 30;
    const { X, Y } = hrFrame(c, x0, y0, x1, y1, 3.4, 4.8, -1, 6);
    plotCurve(c, Math.log10(0.5), Math.log10(60), 60, (lm) => X(Math.log10(mainSequence(10 ** lm).T)), (lm) => Y(Math.log10(mainSequence(10 ** lm).L)), hexA(C.dim, 0.5), 1, [5, 4]); this.text('ZAMS', X(Math.log10(mainSequence(0.6).T)) - 4, Y(Math.log10(mainSequence(0.6).L)), C.dim, 8, 'right');
    for (const [m, t] of EVO_TIMES) {
      const pts = evoTrackPoints(m, t.length); const sel = m === M;
      plotCurve(c, 0, t.length - 1, 100, (v) => X(splineAt(pts, v).lT), (v) => Y(splineAt(pts, v).lL), sel ? C.sun : hexA(C.blue, 0.22), sel ? 2 : 1);
      this.text(`${m}`, X(pts[0].lT) + 5, Y(pts[0].lL) + 2, sel ? C.sun : C.dim, 7);
      if (sel) pts.forEach((p, i) => { this.circle(X(p.lT), Y(p.lL), 2.5, undefined, C.sun); this.text(`${i + 1}`, X(p.lT) + (i === 0 ? -8 : 6), Y(p.lL) - 6, C.text, 7, 'center'); });
    }
    const pts = evoTrackPoints(M, n); const P = splineAt(pts, u); const T = 10 ** P.lT, L = 10 ** P.lL, R = Math.sqrt(L) * (5772 / T) ** 2;
    this.circle(X(P.lT), Y(P.lL), 6, '#fff', rgba(tempRGB(T), 1), 1.5);
    if (M === 1) { const s = msEvolved(1, 0.47); this.circle(X(Math.log10(s.T)), Y(Math.log10(s.L)), 3, C.sun); this.text('☉ today', X(Math.log10(s.T)) + 6, Y(Math.log10(s.L)) + 8, C.sun, 7); }
    const i = Math.min(n - 2, Math.floor(u)), f = u - i; const age = times[i] + f * (times[i + 1] - times[i]);
    // right: the table for this mass
    const bx0 = w * 0.7; let y = y0 + 8;
    this.text(`${M} M☉ — elapsed time (Myr) to each point`, bx0, y, C.text, 9); y += 14;
    const labels = M >= 2 ? ['ZAMS', 'core H → 0.05: overall contraction', 'thick H shell ignites', 'S–C limit: core contracts (SGB)', 'base of the giant branch', 'He ignition (3α)', 'blue loop: core He burning', 'loop ends, He → CO', 'core He exhausted', 'early AGB'] : M >= 1.5 ? ['ZAMS', 'mid main sequence', 'core H exhausted', 'S–C limit (partly degenerate)', 'base of the RGB', 'RGB tip: He core flash'] : M === 0.8 ? ['ZAMS', 'mid main sequence', 'core H exhausted'] : ['ZAMS', 'mid main sequence (☉ today lies before)', 'core H exhausted (9.8 Gyr)', 'S–C limit at ~13 % (degenerate)', 'base of the RGB', 'RGB tip: He core flash'];
    times.forEach((t, k) => { const hot = Math.abs(u - k) < 0.5; this.text(`${k + 1}`, bx0, y, hot ? C.sun : C.dim, 8); this.text(t === 0 ? '0' : t < 100 ? fmt(t, 2) : fmt(t, 0), bx0 + 40, y, hot ? C.sun : C.text, 8, 'right'); this.text(labels[k] ?? '', bx0 + 46, y, hot ? C.text : C.dim, 7); y += 13; });
    if (y + 10 < y1) { const tMS = M >= 2 ? times[1] : times[Math.min(2, n - 1)]; this.text(`main sequence: ${fmtYr(tMS * 1e6)} · after it: ${fmtYr((times[n - 1] - tMS) * 1e6)} (${fmt(100 * (times[n - 1] - tMS) / tMS, 0)} %)`, bx0, y + 6, C.dim, 7); }
    this.setReadout([
      ['Age since the ZAMS', `${fmtYr(age * 1e6)} — between points ${i + 1} and ${i + 2}`, C.sun],
      ['Star now', `L = ${L >= 100 ? sci(L, 1) : fmt(L, 2)} L☉ · T_eff = ${fmt(T, 0)} K (${spectralClass(T)}) · R = ${R >= 100 ? fmt(R, 0) : fmt(R, 1)} R☉`, C.text],
      ['Doing', labels[Math.round(u)] ?? '', C.dim],
      ['Models', 'Schaller et al. 1992: X = 0.68, Y = 0.30, Z = 0.02, mass loss and convective overshooting; track shapes schematic, times from Table 13.1'],
    ]);
  }
}

/* --------------------------------------------- 13.2a giant stages (1, 5 M☉) ---- */

type GiantStage = { name: string; lT: number; lL: number; core: number; he: number; hsh: number; conv: number; what: string; burn: string };
function giantStages(five: boolean): GiantStage[] {
  if (!five) return [
    { name: 'ZAMS (point 1)', lT: 3.76, lL: -0.15, core: 0.25, he: 0, hsh: 0, conv: 0.3, what: 'hydrogen burning by the pp chain in a radiative core; thin convective envelope', burn: 'core H (pp)' },
    { name: 'Sun today (4.6 Gyr)', lT: 3.762, lL: 0, core: 0.22, he: 0, hsh: 0, conv: 0.29, what: 'X_c down from 0.71 to 0.34; μ up, core contracted and hotter, L up 30 %', burn: 'core H (pp)' },
    { name: 'core H exhausted (point 3, 9.8 Gyr)', lT: 3.773, lL: 0.33, core: 0.03, he: 0, hsh: 0.06, conv: 0.28, what: 'isothermal He core (3 % of the mass), thick H-burning shell; R = 1.35 R☉, L = 2.1 L☉', burn: 'thick H shell' },
    { name: 'Schönberg–Chandrasekhar (point 4)', lT: 3.745, lL: 0.5, core: 0.08, he: 0, hsh: 0.1, conv: 0.4, what: 'partly degenerate core reaches ~13 % and contracts on t_KH; envelope expands and cools', burn: 'H shell, narrowing' },
    { name: 'subgiant → base of RGB (point 5)', lT: 3.68, lL: 0.78, core: 0.05, he: 0, hsh: 0.07, conv: 0.75, what: 'H⁻ opacity drives a deep convective envelope: the star reaches the Hayashi line', burn: 'H shell' },
    { name: 'first dredge-up', lT: 3.66, lL: 1.4, core: 0.04, he: 0, hsh: 0.05, conv: 0.9, what: 'convection reaches processed layers: Li ↓, ³He ↑, ¹²C/¹⁴N ↓ at the surface', burn: 'H shell' },
    { name: 'RGB tip: He core flash (point 6)', lT: 3.54, lL: 3.3, core: 0.02, he: 0.02, hsh: 0.025, conv: 0.95, what: 'degenerate He core of 0.45 M☉ ignites explosively: 10¹¹ L☉ for seconds, absorbed by the envelope', burn: '3α flash + H shell' },
    { name: 'horizontal branch / red clump', lT: 3.68, lL: 1.7, core: 0.1, he: 0, hsh: 0.3, conv: 0.5, what: 'quiet core He burning for ~10⁸ yr; convective core; RR Lyrae stars pulsate here', burn: 'core He (3α) + H shell' },
    { name: 'early AGB', lT: 3.6, lL: 2.6, core: 0.03, he: 0.05, hsh: 0.07, conv: 0.85, what: 'inert, degenerate CO core; He shell supplies the energy; second ascent of the Hayashi line', burn: 'He shell (+ weak H shell)' },
    { name: 'thermal-pulse AGB (Mira)', lT: 3.5, lL: 3.7, core: 0.012, he: 0.018, hsh: 0.022, conv: 0.97, what: 'He shell flashes every ~10⁵ yr; pulsations; superwind 10⁻⁴ M☉/yr strips the envelope', burn: 'H shell, He flashes' },
    { name: 'post-AGB', lT: 4.3, lL: 3.6, core: 0.5, he: 0.75, hsh: 0.9, conv: 0, what: 'envelope gone; the hot core crosses the diagram at constant L and ionises the ejecta', burn: 'dying H/He shells' },
    { name: 'planetary nebula + white dwarf', lT: 4.9, lL: 1.5, core: 0.9, he: 0.97, hsh: 0.99, conv: 0, what: '0.55 M☉ CO white dwarf, R ≈ 0.013 R☉, cooling for ever; nebula merges with the ISM in 5 × 10⁴ yr', burn: 'none' },
  ];
  return [
    { name: 'ZAMS (point 1)', lT: 4.19, lL: 2.6, core: 0.25, he: 0, hsh: 0, conv: 0, what: 'CNO cycle in a convective core (≈ 25 % of the mass), radiative envelope', burn: 'core H (CNO)' },
    { name: 'X_c → 0.05: overall contraction (point 2)', lT: 4.12, lL: 2.9, core: 0.12, he: 0, hsh: 0, conv: 0, what: 'the shrinking convective core runs out of H; the whole star contracts, L and T_eff rise', burn: 'core H (dying)' },
    { name: 'thick H shell ignites (point 3)', lT: 4.228, lL: 3.05, core: 0.06, he: 0, hsh: 0.12, conv: 0, what: 'L = 1130 L☉, T_eff = 16 900 K, R = 3.9 R☉; the envelope absorbs energy, L dips', burn: 'thick H shell' },
    { name: 'Schönberg–Chandrasekhar (point 4)', lT: 4.05, lL: 3.0, core: 0.08, he: 0, hsh: 0.12, conv: 0, what: 'isothermal core past the limit contracts on t_KH; subgiant branch crossed in 0.35 Myr', burn: 'H shell, narrowing' },
    { name: 'base of the RGB (point 5)', lT: 3.67, lL: 2.9, core: 0.06, he: 0, hsh: 0.08, conv: 0.7, what: 'envelope convection deepens; Hayashi line; first dredge-up (Li gone from the inner 98 %)', burn: 'H shell' },
    { name: 'He ignition at the tip (point 6)', lT: 3.6, lL: 3.3, core: 0.05, he: 0.05, hsh: 0.06, conv: 0.8, what: 'T_c = 1.3 × 10⁸ K, ρ_c = 7.7 × 10⁶ kg m⁻³: quiet 3α ignition (non-degenerate)', burn: 'core He + H shell' },
    { name: 'blue loop (point 7)', lT: 3.9, lL: 3.4, core: 0.1, he: 0, hsh: 0.35, conv: 0.1, what: 'core He burning with a convective core; T_eff rises as the H shell strengthens; Cepheids here', burn: 'core He + H shell' },
    { name: 'end of the loop (point 8)', lT: 3.67, lL: 3.55, core: 0.08, he: 0, hsh: 0.3, conv: 0.5, what: 'core μ up, core contracts, envelope expands; core He soon exhausted → CO', burn: 'core He (ending)' },
    { name: 'early AGB (point 10)', lT: 3.761, lL: 3.29, core: 0.0008 / 0.0056 * 0.08, he: 0.0029 / 0.0056 * 0.08, hsh: 0.08, conv: 0.75, what: 'L = 1940 L☉, T_eff = 5770 K, R = 44 R☉; He shell at 0.003 R, CO core at 0.0008 R; second dredge-up', burn: 'He shell' },
    { name: 'thermal-pulse AGB', lT: 3.52, lL: 4.3, core: 0.01, he: 0.015, hsh: 0.018, conv: 0.97, what: 'shell flashes every few thousand years; third dredge-up → carbon star; superwind', burn: 'H shell, He flashes' },
    { name: 'post-AGB', lT: 4.4, lL: 4.2, core: 0.5, he: 0.75, hsh: 0.9, conv: 0, what: 'F/G supergiant spectrum turning blue; the ejected envelope becomes a planetary nebula', burn: 'dying shells' },
    { name: 'white dwarf (0.9 M☉, CO)', lT: 5.0, lL: 2.0, core: 0.9, he: 0.97, hsh: 0.99, conv: 0, what: 'mass loss kept the core under 1.4 M☉; a 4–8 M☉ star would leave an ONeMg dwarf', burn: 'none' },
  ];
}
class GiantstagesWidget extends CanvasWidget {
  private five = false; private s = 1;
  constructor() {
    super(1.8);
    this.segmented<'one' | 'five'>([['one', '1 M☉ (Fig. 13.4)'], ['five', '5 M☉ (Fig. 13.5)']], 'one', (v) => { this.five = v === 'five'; });
    this.slider('Stage', 0, 11, 0.01, this.s, (v) => giantStages(this.five)[Math.round(v)].name, (v) => { this.s = v; });
  }
  protected draw() {
    const c = this.ctx, w = this.w, h = this.h;
    const st = giantStages(this.five); const k = Math.round(this.s); const S = st[k];
    const x0 = PLOT_MARGIN, x1 = w * 0.58, y0 = 14, y1 = h - 30;
    const { X, Y } = hrFrame(c, x0, y0, x1, y1, 3.4, 5.1, -0.5, 4.6);
    plotCurve(c, Math.log10(0.5), Math.log10(20), 60, (lm) => X(Math.log10(mainSequence(10 ** lm).T)), (lm) => Y(Math.log10(mainSequence(10 ** lm).L)), hexA(C.dim, 0.5), 1, [5, 4]);
    const P = splineAt(st, this.s);
    plotCurve(c, 0, st.length - 1, 220, (v) => X(splineAt(st, v).lT), (v) => Y(splineAt(st, v).lL), hexA(C.sun, 0.9), 1.5);
    st.forEach((p, i) => { this.circle(X(p.lT), Y(p.lL), i === k ? 4 : 2, i === k ? '#fff' : undefined, i === k ? C.sun : hexA(C.sun, 0.8)); });
    const T = 10 ** P.lT, L = 10 ** P.lL, R = Math.sqrt(L) * (5772 / T) ** 2;
    this.circle(X(P.lT), Y(P.lL), 6, '#fff', rgba(tempRGB(T), 1), 1.5);
    for (const [lab, lT, lL] of [['SGB', 3.72, this.five ? 2.75 : 0.95], ['RGB', 3.56, this.five ? 3.05 : 2.4], ['HB', 3.72, this.five ? 3.6 : 1.9], ['AGB', 3.47, this.five ? 3.9 : 3.0], ['post-AGB', 4.5, this.five ? 4.4 : 3.85], ['WD', 4.95, this.five ? 1.6 : 1.1]] as Array<[string, number, number]>) this.text(lab, X(lT), Y(lL), C.dim, 8, 'center');
    // right: cross-section
    const cx = w * 0.79, cy = h * 0.42, Rp = Math.min(w * 0.17, h * 0.3);
    this.text(S.name, cx, y0 + 6, C.sun, 9, 'center');
    const conv = S.conv;
    c.fillStyle = rgba(tempRGB(T), 1); c.beginPath(); c.arc(cx, cy, Rp, 0, TAU); c.fill();
    if (conv > 0) {
      c.fillStyle = hexA('#000000', 0.42); c.beginPath(); c.arc(cx, cy, Rp, 0, TAU); c.moveTo(cx + Rp * (1 - conv), cy); c.arc(cx, cy, Rp * (1 - conv), TAU, 0, true); c.fill('evenodd');
      const r1 = Rp * (1 - conv), r2 = Rp; const rings = Math.max(1, Math.floor((r2 - r1) / 14));
      for (let k = 0; k < rings; k++) { const rc = r1 + (r2 - r1) * (k + 0.5) / rings; const cells = Math.max(8, Math.round(rc / 7)); for (let i = 0; i < cells; i++) { const a = i * TAU / cells + k * 0.3; c.beginPath(); c.arc(cx + rc * Math.cos(a), cy + rc * Math.sin(a), Math.min(5, (r2 - r1) / rings * 0.35), 0, TAU); c.strokeStyle = hexA('#ffffff', 0.25); c.lineWidth = 1; c.stroke(); } }
    }
    const rr = (f: number) => Math.max(0, f) * Rp;
    if (S.hsh > 0) { this.circle(cx, cy, Math.max(rr(S.hsh), 3), C.sun, hexA(C.sun, 0.35), 1.5); }
    if (S.he > 0) { this.circle(cx, cy, Math.max(rr(S.he), 2.5), C.mars, hexA(C.mars, 0.5), 1.5); }
    if (S.core > 0) { this.circle(cx, cy, Math.max(rr(S.core), 2), '#fff', S.burn.startsWith('core He') ? hexA(C.mars, 0.9) : S.burn.startsWith('core H') ? hexA(C.sun, 0.9) : '#e8e8ff', 1); }
    this.text(`R = ${R >= 100 ? fmt(R, 0) : fmt(R, R < 0.1 ? 3 : 1)} R☉ (not to scale)`, cx, cy + Rp + 14, C.dim, 8, 'center');
    const legend: Array<[string, string]> = [['convective envelope', '#4a4a52'], ['H-burning shell', C.sun], ['He-burning shell / core', C.mars], ['inert core (He or CO)', '#e8e8ff']];
    let ly = cy + Rp + 30; for (const [lab, col] of legend) { c.fillStyle = col; c.fillRect(cx - Rp, ly - 4, 8, 8); this.text(lab, cx - Rp + 12, ly, C.dim, 7); ly += 11; }
    this.setReadout([
      ['Stage', S.what, C.text],
      ['Burning', S.burn, S.burn === 'none' ? C.dim : C.sun],
      ['Surface', `L = ${L >= 100 ? sci(L, 1) : fmt(L, 2)} L☉ · T_eff = ${fmt(T, 0)} K (${spectralClass(T)}) · R = ${R >= 100 ? fmt(R, 0) : fmt(R, R < 0.1 ? 3 : 2)} R☉`],
      ['Structure', `convective envelope: outer ${fmt(100 * S.conv, 0)} % of the radius${S.hsh > 0 ? ` · H shell at ${fmt(S.hsh, S.hsh < 0.05 ? 3 : 2)} R` : ''}${S.core > 0 ? ` · core ${fmt(S.core, S.core < 0.05 ? 3 : 2)} R` : ''}`],
    ]);
  }
}

/* ------------------------------------------------- 13.2b helium core flash ---- */

class HeflashWidget extends CanvasWidget {
  private lrho = 7.3;
  constructor() {
    super(1.8);
    this.slider('Core density', 5.5, 8, 0.05, this.lrho, (v) => `10^${fmt(v, 1)} kg m⁻³`, (v) => { this.lrho = v; });
  }
  protected draw() {
    const c = this.ctx, w = this.w, h = this.h;
    const rho = 10 ** this.lrho, mue = 2;
    const ne = rho / (mue * M_H);
    const TF = (H_PLANCK ** 2 / (2 * 9.109e-31 * K_B)) * (3 * ne / (8 * Math.PI)) ** (2 / 3);   // Fermi temperature
    const Pdeg = (H_PLANCK ** 2 / (20 * 9.109e-31)) * (3 / Math.PI) ** (2 / 3) * ne ** (5 / 3);
    const Pgas = (T: number) => rho * K_B * T / (1.34 * M_H);
    // left: P vs T
    const x0 = PLOT_MARGIN, x1 = w * 0.5, y0 = 14, y1 = h - 30;
    axesBox(c, x0, y0, x1, y1);
    const X = (lT: number) => x0 + (lT - 7) / 2 * (x1 - x0);
    const Y = (lP: number) => y1 - 6 - (lP - 16.5) / 5 * (y1 - y0 - 12);
    for (let lP = 17; lP <= 21; lP++) { this.line(x0, Y(lP), x1, Y(lP), hexA(C.grid, 0.9)); this.text(`10${sup(lP)}`, x0 - 4, Y(lP), C.dim, 8, 'right'); }
    for (const lT of [7, 7.5, 8, 8.5, 9]) this.text(`10^${fmt(lT, 1)}`, X(lT), y1 + 10, C.dim, 8, 'center');
    this.text('temperature (K)', x1, y1 + 22, C.dim, 9, 'right'); this.text('pressure (Pa)', x0 + 6, y0 + 10, C.dim, 8);
    plotCurve(c, 7, 9, 60, X, (lT) => Y(Math.log10(Pgas(10 ** lT))), C.blue, 2); this.text('ideal gas ρkT/μm_H', X(8.6), Y(Math.log10(Pgas(10 ** 8.6))) - 10, C.blue, 8, 'center');
    this.line(x0, Y(Math.log10(Pdeg)), x1, Y(Math.log10(Pdeg)), C.purple, 2); this.text('degenerate electrons Kρ^5/3: no T', x0 + 8, Y(Math.log10(Pdeg)) - 9, C.purple, 8);
    this.line(X(Math.log10(TF)), y0, X(Math.log10(TF)), y1, hexA(C.purple, 0.6), 1, [3, 3]); this.text('T_F', X(Math.log10(TF)) + 3, y0 + 24, C.purple, 8);
    this.line(X(8), y0, X(8), y1, hexA(C.red, 0.6), 1, [3, 3]); this.text('3α ignites', X(8) + 3, y1 - 14, C.red, 8);
    c.fillStyle = hexA(C.purple, 0.07); c.fillRect(x0, y0, X(Math.log10(TF)) - x0, y1 - y0);
    this.text(TF > 1e8 ? 'degenerate at ignition → flash' : 'ideal at ignition → quiet start', x0 + 8, y0 + 36, TF > 1e8 ? C.purple : C.blue, 8);
    // right: luminosity of helium burning vs time, two cases (toy model)
    const px0 = w * 0.58, px1 = w - 12, py0 = 14, py1 = h - 30;
    axesBox(c, px0, py0, px1, py1);
    const PX = (f: number) => px0 + f * (px1 - px0); const PY = (lL: number) => py1 - 6 - (lL + 1) / 13 * (py1 - py0 - 12);
    for (let lL = 0; lL <= 11; lL += 2) { this.line(px0, PY(lL), px1, PY(lL), hexA(C.grid, 0.9)); this.text(`10${sup(lL)}`, px0 - 4, PY(lL), C.dim, 8, 'right'); }
    this.text('time (schematic) →', px1, py1 + 22, C.dim, 9, 'right'); this.text('He-burning luminosity (L☉)', px0 + 6, py0 + 10, C.dim, 8);
    // toy model: ε_3α ∝ T⁻³ exp(−44.027/T₈), normalised to 100 L☉ at T₈ = 1.04; ideal gas has a thermostat (expansion), a degenerate core has none until kT ≈ E_F
    const epsHat = (T8: number) => Math.exp(44.027 * (1 / 1.04 - 1 / T8)) * (1.04 / T8) ** 3;
    const TF8 = TF / 1e8;
    const sim = (degen: boolean) => { const out: number[] = []; let T8 = 1.0, lift = false; for (let i = 0; i < 400; i++) { if (degen && !lift) { T8 += Math.min(0.03, 2e-3 * epsHat(T8)); if (T8 > 1.5 * TF8 || T8 > 3.2) lift = true; } else if (degen && lift) { T8 += (1.06 - T8) * 0.08; } else { T8 += Math.min(0.03, 2e-3 * epsHat(T8)) - 0.1 * (T8 - 1.0); } out.push(Math.min(11, Math.max(0, Math.log10(100 * epsHat(T8))))); } return out; };
    const a = sim(false), b = sim(true);
    plotCurve(c, 0, 1, 399, PX, (f) => PY(a[Math.round(f * 399)]), C.blue, 2); this.text('non-degenerate (M > 1.8 M☉): thermostat', PX(0.55), PY(a[399]) - 10, C.blue, 8, 'center');
    plotCurve(c, 0, 1, 399, PX, (f) => PY(b[Math.round(f * 399)]), C.purple, 2);
    const pk = Math.max(...b); const ipk = b.indexOf(pk); this.text(`degenerate: flash to 10^${fmt(pk, 0)} L☉`, PX(Math.min(0.75, ipk / 399 + 0.05)), PY(pk) + 10, C.purple, 8, 'center');
    this.text('galaxy luminosity 10¹¹ L☉', px1 - 4, PY(11) + 8, C.dim, 7, 'right');
    this.setReadout([
      ['Core at ignition', `ρ = ${fmtSci(rho, 0)} kg m⁻³ · T_F = ${fmtSci(TF, 1)} K vs T_ign ≈ 10⁸ K → ${TF > 1e8 ? 'electrons degenerate (P_deg ' + fmt(Pdeg / Pgas(1e8), 1) + '× P_gas)' : 'gas nearly ideal'}`, TF > 1e8 ? C.purple : C.blue],
      ['Runaway', TF > 1e8 ? 'heating does not raise P, the core does not expand, ε_3α ∝ T⁴⁰ soars until kT ≈ E_F lifts the degeneracy; the energy is absorbed by the envelope' : 'heating raises P, the core expands and cools: ε settles to the horizontal-branch value', C.text],
      ['Triple alpha', 'ε_3α ∝ ρ² Y³ T⁴⁰ near 10⁸ K — doubles for every 2 % in T; 3 ⁴He → ¹²C (+ γ), then ¹²C + ⁴He → ¹⁶O'],
      ['Who flashes', 'stars below ~1.8 M☉: their He cores (≈ 0.45 M☉) become degenerate during the RGB climb; models could not follow it (tracks end at point 6)'],
    ]);
  }
}

/* ------------------------------------------------- 13.2c thermal pulses AGB ---- */

class ThermalpulsesWidget extends CanvasWidget {
  private Mc = 0.6; private t = 0;
  constructor() {
    super(1.8);
    this.slider('Core mass', 0.55, 0.95, 0.01, this.Mc, (v) => `${fmt(v, 2)} M☉`, (v) => { this.Mc = v; });
    this.playButton();
  }
  protected draw(dt: number) {
    const c = this.ctx, w = this.w, h = this.h;
    const Mc = this.Mc; const dtp = 10 ** (3.05 - 4.5 * (Mc - 1)); const LH = 5.9e4 * (Mc - 0.52);
    this.t = (this.t + dt * 0.12) % 6;
    const N = 6;
    const lum = (x: number) => { // x in interpulse units
      const n = Math.floor(x), f = x - n; const amp = 1 + 0.25 * n; const fl = f < 0.03 ? Math.exp(-(((f - 0.012) / 0.012) ** 2)) : f < 0.12 ? 0.25 * Math.exp(-(f - 0.03) / 0.03) : 0;
      const LHe = LH * (0.02 + 60 * amp * fl); const quench = f < 0.2 ? 1 - 0.9 * Math.exp(-(((f - 0.03) / 0.08) ** 2)) : 1;
      const LHn = LH * quench * (0.8 + 0.25 * f); const Lsurf = LHn + 0.3 * LHe * (f > 0.02 ? 1 : 0) + LH * 0.15 * Math.exp(-(((f - 0.1) / 0.15) ** 2)) * (f > 0.03 ? 1 : 0);
      return { LHe, LH: LHn, L: Math.max(LHn, Lsurf) };
    };
    const x0 = PLOT_MARGIN, x1 = w - 12, y0 = 14, y1 = h - 30;
    axesBox(c, x0, y0, x1, y1);
    const X = (x: number) => x0 + x / N * (x1 - x0); const Y = (lL: number) => y1 - 6 - (lL - 1) / 6 * (y1 - y0 - 12);
    for (let lL = 1; lL <= 7; lL++) { this.line(x0, Y(lL), x1, Y(lL), hexA(C.grid, 0.9)); this.text(`10${sup(lL)}`, x0 - 4, Y(lL), C.dim, 8, 'right'); }
    for (let n = 0; n <= N; n++) this.text(fmtYr(n * dtp), X(n), y1 + 10, C.dim, 8, 'center');
    this.text('time on the TP-AGB', x1, y1 + 22, C.dim, 9, 'right'); this.text('luminosity (L☉)', x0 + 6, y0 + 10, C.dim, 8);
    plotCurve(c, 0, N, 1500, X, (x) => Y(Math.log10(Math.max(10, lum(x).LHe))), C.mars, 1.5); this.text('L_He (shell flashes)', X(0.3), Y(Math.log10(LH * 0.02)) - 9, C.mars, 8);
    plotCurve(c, 0, N, 1500, X, (x) => Y(Math.log10(Math.max(10, lum(x).LH))), C.sun, 1.5); this.text('L_H (hydrogen shell)', X(0.3), Y(Math.log10(LH)) + 12, C.sun, 8);
    plotCurve(c, 0, N, 1500, X, (x) => Y(Math.log10(lum(x).L)), '#fff', 1, [3, 2]); this.text('L surface', X(N - 0.7), Y(Math.log10(lum(N - 0.7).L)) - 9, C.text, 8, 'center');
    const cur = lum(this.t); this.line(X(this.t), y0, X(this.t), y1, hexA(C.text, 0.35), 1, [2, 3]);
    this.text('interpulse: H shell dominates, He ash piles onto the thin He layer', X(0.6), y0 + 26, C.dim, 7); this.text('flash: He layer ignites, pushes the H shell out and quenches it', X(0.6), y0 + 37, C.dim, 7);
    const f = this.t - Math.floor(this.t);
    this.setReadout([
      ['Core mass → interpulse period', `M_c = ${fmt(Mc, 2)} M☉ · Δt ≈ ${fmtYr(dtp)} · pulse ${Math.floor(this.t) + 1} of ${N}, growing in amplitude`, C.mars],
      ['Now', f < 0.03 ? 'He shell flash: L_He ~ ' + sci(cur.LHe, 1) + ' L☉, hydrogen shell quenched' : f < 0.2 ? 'after the flash: intershell convection, third dredge-up possible; surface L dips then recovers' : 'quiet interpulse: hydrogen shell burning, He layer growing', C.text],
      ['Luminosities', `L_H = ${sci(cur.LH, 1)} · L_He = ${sci(cur.LHe, 1)} · L = ${sci(cur.L, 1)} L☉ (Paczyński: L ≈ 5.9×10⁴ (M_c − 0.52) = ${sci(LH, 1)} L☉)`, C.sun],
      ['Observed as', 'Mira / long-period variables (100–700 d); period changes of R Hya, R Aql, W Dra may be shell flashes made visible'],
    ]);
  }
}

/* --------------------------------------------- 13.2d s-process & carbon stars ---- */

const SPROC_STABLE: Array<[number, number[]]> = [[38, [46, 48, 49, 50]], [39, [50]], [40, [50, 51, 52, 54, 56]], [41, [52]], [42, [50, 52, 53, 54, 55, 56, 58]], [43, []], [44, [52, 54, 55, 56, 57, 58, 60]]];
const SPROC_PATH: Array<[number, number, string]> = [[38, 50, '⁸⁸Sr'], [38, 51, '⁸⁹Sr β⁻ 50 d'], [39, 50, '⁸⁹Y'], [39, 51, '⁹⁰Y β⁻ 64 h'], [40, 50, '⁹⁰Zr'], [40, 51, '⁹¹Zr'], [40, 52, '⁹²Zr'], [40, 53, '⁹³Zr (1.5 Myr: captures first)'], [40, 54, '⁹⁴Zr'], [40, 55, '⁹⁵Zr β⁻ 64 d'], [41, 54, '⁹⁵Nb β⁻ 35 d'], [42, 53, '⁹⁵Mo'], [42, 54, '⁹⁶Mo'], [42, 55, '⁹⁷Mo'], [42, 56, '⁹⁸Mo'], [42, 57, '⁹⁹Mo β⁻ 66 h'], [43, 56, '⁹⁹Tc — 2.1 × 10⁵ yr: seen in S and C stars'], [43, 57, '¹⁰⁰Tc β⁻ 16 s'], [44, 56, '¹⁰⁰Ru']];
const SPROC_EL = ['Sr', 'Y', 'Zr', 'Nb', 'Mo', 'Tc', 'Ru'];
class SprocessWidget extends CanvasWidget {
  private step = 0; private co = 0.5;
  constructor() {
    super(1.8);
    this.slider('C/O at the surface', 0.3, 2, 0.01, this.co, (v) => fmt(v, 2), (v) => { this.co = v; });
    this.playButton();
  }
  protected draw(dt: number) {
    const c = this.ctx, w = this.w, h = this.h;
    this.step = (this.step + dt * 1.2) % (SPROC_PATH.length + 2); const k = Math.min(SPROC_PATH.length - 1, Math.floor(this.step));
    // left: chart of nuclides
    const x0 = 46, x1 = w * 0.56, y0 = 20, y1 = h - 34;
    const cw = (x1 - x0) / 15, ch = (y1 - y0) / 7;
    const CX = (N: number) => x0 + (N - 46) * cw, CY = (Z: number) => y1 - (Z - 38 + 1) * ch;
    for (const [Z, Ns] of SPROC_STABLE) { this.text(`${SPROC_EL[Z - 38]} ${Z}`, x0 - 4, CY(Z) + ch / 2, Z === 43 ? C.red : C.dim, 8, 'right'); for (const N of Ns) { c.fillStyle = hexA(C.dim, 0.35); c.fillRect(CX(N) + 1, CY(Z) + 1, cw - 2, ch - 2); } }
    for (let N = 46; N <= 60; N += 2) this.text(`${N}`, CX(N) + cw / 2, y1 + 10, C.dim, 8, 'center');
    this.text('neutron number N →', x1, y1 + 22, C.dim, 9, 'right'); this.text('Z ↑', x0 + 4, y0 - 8, C.dim, 8);
    this.text('grey: stable isotopes · ⁹⁹Tc has none', x0 + 10, y0 + 2, C.dim, 7);
    for (let i = 0; i <= k; i++) { const [Z, N] = SPROC_PATH[i]; const isTc = Z === 43; c.fillStyle = isTc ? hexA(C.red, 0.85) : hexA(C.sun, i === k ? 0.95 : 0.5); c.fillRect(CX(N) + 1, CY(Z) + 1, cw - 2, ch - 2); if (i > 0) { const [Z0, N0] = SPROC_PATH[i - 1]; const beta = Z !== Z0; this.line(CX(N0) + cw / 2, CY(Z0) + ch / 2, CX(N) + cw / 2, CY(Z) + ch / 2, beta ? C.blue : C.green, 1.5); } }
    this.text(SPROC_PATH[k][2], (x0 + x1) / 2, y0 + 14, C.text, 9, 'center');
    this.text('→ (n,γ) capture', x1 - 4, y0 + 2, C.green, 7, 'right'); this.text('↖ β⁻ decay', x1 - 4, y0 + 12, C.blue, 7, 'right');
    // right: C/O chemistry
    const px0 = w * 0.64, px1 = w - 12, py0 = 14, py1 = h - 30;
    const co = this.co, Cn = co, On = 1; const CO = Math.min(Cn, On), spareC = Math.max(0, Cn - On), spareO = Math.max(0, On - Cn);
    const type = co < 0.95 ? 'M' : co <= 1.05 ? 'S' : 'C';
    this.text(`atmosphere with C/O = ${fmt(co, 2)}: spectral type ${type}`, px0, py0 + 6, type === 'C' ? C.red : type === 'S' ? C.accent : C.blue, 9);
    const bars: Array<[string, number, string]> = [['CO (locks up the scarcer element)', CO, C.dim], ['free O → TiO, VO, H₂O, silicate dust', spareO, C.blue], ['free C → C₂, CN, SiC, graphite dust', spareC, C.red], ['ZrO (S stars, Zr from the s-process)', co > 0.85 && co < 1.15 ? 0.4 * (1 - Math.abs(co - 1) / 0.15) : 0, C.accent]];
    let y = py0 + 30; const bw = px1 - px0 - 10;
    for (const [lab, v, col] of bars) { this.text(lab, px0, y, col, 8); c.fillStyle = hexA(col, 0.8); c.fillRect(px0, y + 7, bw * Math.min(1, v), 7); y += 26; }
    const desc = type === 'M' ? 'oxygen-rich: TiO bands, silicate dust; the giants of the first ascent and most of the AGB' : type === 'S' ? 'C ≈ O: ZrO instead of TiO, technetium lines — s-process ash reaching the surface' : 'carbon star: C₂ and CN bands, SiC and graphite dust; third dredge-up has flipped the ratio';
    const lines: string[] = []; let cur = ''; for (const word of desc.split(' ')) { if ((cur + ' ' + word).length > 40) { lines.push(cur); cur = word; } else cur = cur ? cur + ' ' + word : word; } lines.push(cur);
    lines.forEach((ln, i) => this.text(ln, px0, y + 4 + 10 * i, C.text, 7));
    this.text('CO (11.1 eV) forms first, taking all of the scarcer element', px0, py1 - 10, C.dim, 7);
    this.setReadout([
      ['Third dredge-up', 'in stars above ~2 M☉ the post-flash convection reaches the intershell, where C/O ≈ 5–10; each pulse raises the surface C/O until the star turns from M to S to C', C.text],
      ['Neutron sources', '¹³C(α,n)¹⁶O and ²²Ne(α,n)²⁵Mg in the intershell; captures every few years, so unstable nuclei decay before the next: the slow process', C.green],
      ['Technetium', '⁹⁹Tc half-life 2.1 × 10⁵ yr — Merrill 1952: its lines in S stars prove nucleosynthesis in the last few hundred thousand years', C.red],
      ['Products', 'about half the elements beyond iron: Sr, Y, Zr, Ba, La, Ce, Pb — the "s-process peaks" at closed neutron shells N = 50, 82, 126'],
    ]);
  }
}

/* --------------------------------------------------- 13.2e AGB mass loss ---- */

class AgbmasslossWidget extends CanvasWidget {
  private lL = Math.log10(7000); private R = 310; private M0 = 1; private eta = 1;
  constructor() {
    super(1.8);
    this.slider('Luminosity', 3, 4.6, 0.02, this.lL, (v) => `${sci(10 ** v, 1)} L☉`, (v) => { this.lL = v; });
    this.slider('Radius', 100, 600, 5, this.R, (v) => `${v} R☉`, (v) => { this.R = v; });
    this.slider('Initial mass', 0.8, 8, 0.1, this.M0, (v) => `${fmt(v, 1)} M☉`, (v) => { this.M0 = v; });
    this.slider('η (Reimers)', 0.3, 3, 0.05, this.eta, (v) => fmt(v, 2), (v) => { this.eta = v; });
  }
  protected draw() {
    const c = this.ctx, w = this.w, h = this.h;
    const L = 10 ** this.lL, R = this.R, M0 = this.M0, eta = this.eta;
    const finalMass = (m: number) => Math.min(1.38, 0.5 + 0.1 * m);        // initial–final mass relation (schematic, book values)
    const Mf = finalMass(M0);
    const mdot = (M: number) => 4e-13 * eta * L * R / M;                  // M☉/yr
    const T = 5772 * Math.pow(L / (R * R), 0.25);
    // M(t): M² = M0² − 2·4e-13 η L R t
    const kk = 8e-13 * eta * L * R; const tEnd = (M0 * M0 - Mf * Mf) / kk;
    const x0 = PLOT_MARGIN, x1 = w * 0.55, y0 = 14, y1 = h - 30;
    axesBox(c, x0, y0, x1, y1);
    const X = (t: number) => x0 + t / (tEnd * 1.1) * (x1 - x0); const Y = (M: number) => y1 - 6 - M / (M0 * 1.1) * (y1 - y0 - 12);
    for (let i = 0; i <= 5; i++) { const t = tEnd * 1.1 * i / 5; this.text(fmtYr(t), X(t), y1 + 10, C.dim, 7, 'center'); }
    for (let M = 0; M <= M0; M += M0 > 3 ? 1 : 0.2) { this.line(x0, Y(M), x1, Y(M), hexA(C.grid, 0.9)); this.text(fmt(M, 1), x0 - 4, Y(M), C.dim, 8, 'right'); }
    this.text('time on the AGB', x1, y1 + 22, C.dim, 9, 'right'); this.text('mass (M☉)', x0 + 6, y0 + 10, C.dim, 8);
    c.fillStyle = hexA(C.purple, 0.1); c.fillRect(x0, Y(Mf), x1 - x0, y1 - Y(Mf)); this.text(`degenerate core ${fmt(Mf, 2)} M☉ → white dwarf`, x0 + 8, Y(Mf) + 10, C.purple, 7);
    plotCurve(c, 0, tEnd, 120, X, (t) => Y(Math.sqrt(Math.max(Mf * Mf, M0 * M0 - kk * t))), C.sun, 2);
    // superwind: last 10 % faster
    const tsw = tEnd * 0.85; this.line(X(tsw), y0, X(tsw), y1, hexA(C.red, 0.5), 1, [3, 3]); this.text('superwind 10⁻⁴ M☉/yr, OH/IR phase', X(tsw) - 4, y0 + 24, C.red, 7, 'right');
    this.text('M² = M₀² − 8×10⁻¹³ η L R t  (L, R constant — not really)', x0 + 8, y1 - 14, C.dim, 7);
    // right: initial–final mass relation
    const px0 = w * 0.63, px1 = w - 12, py0 = 14, py1 = h - 30;
    axesBox(c, px0, py0, px1, py1);
    const PX = (m: number) => px0 + m / 10 * (px1 - px0); const PY = (m: number) => py1 - 6 - m / 1.6 * (py1 - py0 - 12);
    for (const m of [0, 2, 4, 6, 8, 10]) this.text(`${m}`, PX(m), py1 + 10, C.dim, 8, 'center');
    for (const m of [0.5, 1, 1.5]) { this.line(px0, PY(m), px1, PY(m), hexA(C.grid, 0.9)); this.text(fmt(m, 1), px0 - 4, PY(m), C.dim, 8, 'right'); }
    this.text('initial mass (M☉)', px1, py1 + 22, C.dim, 9, 'right'); this.text('final (white dwarf) mass', px0 + 6, py0 + 10, C.dim, 8);
    this.line(px0, PY(1.4), px1, PY(1.4), C.red, 1.5, [4, 3]); this.text('Chandrasekhar limit 1.4 M☉', px1 - 4, PY(1.4) - 8, C.red, 8, 'right');
    plotCurve(c, 0.8, 8, 40, PX, (m) => PY(finalMass(m)), C.sun, 2);
    plotCurve(c, 4, 8, 20, PX, (m) => PY(Math.min(1.58, 0.9 + (m - 4) * 0.35)), hexA(C.red, 0.6), 1, [3, 3]); this.text('no mass loss: core', PX(7.2), PY(1.05), C.red, 7, 'center'); this.text('would pass 1.4 M☉', PX(7.2), PY(0.97), C.red, 7, 'center');
    c.fillStyle = hexA(C.blue, 0.07); c.fillRect(PX(0.8), py0, PX(4) - PX(0.8), py1 - py0); this.text('CO cores', PX(2.4), py1 - 14, C.blue, 8, 'center');
    c.fillStyle = hexA(C.green, 0.07); c.fillRect(PX(4), py0, PX(8) - PX(4), py1 - py0); this.text('ONeMg cores', PX(6), py1 - 14, C.green, 8, 'center');
    c.fillStyle = hexA(C.red, 0.1); c.fillRect(PX(8), py0, px1 - PX(8), py1 - py0); this.text('SN', PX(9), py1 - 14, C.red, 8, 'center');
    this.circle(PX(M0), PY(Mf), 5, '#fff', C.sun);
    this.setReadout([
      ['Reimers rate now', `Ṁ = 4×10⁻¹³ η L R / M = ${sci(mdot(M0), 1)} M☉ yr⁻¹ at M = ${fmt(M0, 1)} M☉ (T_eff = ${fmt(T, 0)} K, g = ${fmt(274 * M0 / (R * R), 4)} m s⁻²)`, C.sun],
      ['Envelope gone after', `${fmtYr(tEnd)} — ${fmt(M0 - Mf, 2)} M☉ returned to the ISM, enriched in He, C, N, s-process; dust: ${T < 3200 ? 'condenses (silicates or SiC/graphite)' : 'too hot to condense near the star'}`, C.text],
      ['Remnant', `${fmt(Mf, 2)} M☉ ${M0 < 4 ? 'CO white dwarf (core never hot enough for carbon burning)' : 'ONeMg white dwarf (carbon burned; ²²Ne(α,n)²⁵Mg, ²²Ne(α,γ)²⁶Mg)'} — below 1.4 M☉ thanks to the wind`, C.purple],
      ['Driver', 'radiation pressure on dust grains formed at ~3000 K, dragging the gas; helped by pulsation and shell flashes — mechanism still uncertain'],
    ]);
  }
}

/* ----------------------------------------------------- 13.2f planetary nebula ---- */

class PlanetaryWidget extends CanvasWidget {
  private v = 20; private age = 10000;
  constructor() {
    super(1.8);
    this.slider('Expansion speed', 5, 60, 1, this.v, (v) => `${v} km/s`, (v) => { this.v = v; });
    this.slider('Age', 0, 50000, 250, this.age, (v) => fmtYr(v), (v) => { this.age = v; });
  }
  protected draw(dt: number) {
    const c = this.ctx, w = this.w, h = this.h;
    if (dt > 0) { this.age = (this.age + dt * 2500) % 50000; }
    const age = this.age, v = this.v; const Rpc = v * 1e3 * age * YR_S / PC_M;   // radius in pc
    const d = 213; const thetaArcmin = 2 * Rpc / d * (180 / Math.PI) * 60;
    // central star: post-AGB crossing in ~1e4 yr at L≈5000, then fading
    const f = Math.min(1, age / 10000); const lT = 3.7 + 1.4 * f; const Lstar = age < 10000 ? 5000 : 5000 * Math.pow(10000 / age, 2.2);
    const T = 10 ** lT;
    const bright = Math.max(0, 1 - age / 50000) * Math.min(1, (T - 25000) / 20000 + 0.2) * Math.pow(0.3 / Math.max(0.05, Rpc), 1.2) * 0.8;
    // left: nebula
    const cx = w * 0.28, cy = h * 0.5, scale = Math.min(w * 0.26, h * 0.46) / 1.0;   // 1 pc = scale px
    c.fillStyle = C.bg; c.fillRect(0, 0, w * 0.56, h);
    const Rpx = Math.max(2, Rpc * scale);
    if (age > 0) {
      const g = c.createRadialGradient(cx, cy, Rpx * 0.3, cx, cy, Rpx * 1.15);
      g.addColorStop(0, hexA('#2ad4c8', 0.02 + 0.5 * Math.min(1, bright)));
      g.addColorStop(0.65, hexA('#2ad4c8', 0.35 * Math.min(1, bright)));
      g.addColorStop(0.85, hexA('#e0484f', 0.5 * Math.min(1, bright)));
      g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g; c.beginPath(); c.arc(cx, cy, Rpx * 1.15, 0, TAU); c.fill();
      c.fillStyle = hexA('#000000', 0.5); c.beginPath(); c.arc(cx, cy, Rpx * 0.35, 0, TAU); c.fill();
    }
    this.circle(cx, cy, 2.5 + (age < 10000 ? 1.5 : 0), undefined, rgba(tempRGB(T), 1)); this.glow(cx, cy, 10, rgba(tempRGB(T), 0.6));
    this.line(cx - scale * 0.5, h - 18, cx + scale * 0.5, h - 18, C.text, 1); this.text('1 pc', cx, h - 28, C.text, 8, 'center');
    this.text('[O III] 500.7 nm teal · Hα + [N II] red rim', 8, 12, C.dim, 7); this.text(`T_gas ≈ 10⁴ K · n ∝ R⁻³ → surface brightness fades`, 8, 23, C.dim, 7);
    if (bright < 0.03 && age > 1000) this.text('merged with the ISM', cx, cy - Rpx - 10, C.dim, 8, 'center');
    // right: H–R
    const x0 = w * 0.64, x1 = w - 12, y0 = 14, y1 = h - 30;
    const { X, Y } = hrFrame(c, x0, y0, x1, y1, 3.4, 5.3, -2, 4.5);
    plotCurve(c, Math.log10(0.3), Math.log10(8), 50, (lm) => X(Math.log10(mainSequence(10 ** lm).T)), (lm) => Y(Math.log10(mainSequence(10 ** lm).L)), hexA(C.dim, 0.5), 1, [5, 4]); this.text('MS', X(3.6), Y(-0.9), C.dim, 7);
    plotCurve(c, 0, 1, 60, (q) => X(3.7 + 1.4 * q), () => Y(Math.log10(5000)), C.green, 1.5);
    plotCurve(c, 0, 1, 60, (q) => X(5.1 - 0.7 * q * q), (q) => Y(Math.log10(5000) - 5 * q), C.purple, 1.5, [3, 3]); this.text('WD cooling', X(4.6), Y(-0.3), C.purple, 7);
    this.text('post-AGB: constant L', X(4.4), Y(3.9), C.green, 7, 'center'); this.text('AGB', X(3.55), Y(3.9), C.red, 7, 'center');
    const lTs = age < 10000 ? lT : 5.1 - 0.7 * Math.min(1, Math.log10(Lstar / 5000) / -5) ** 2;
    this.circle(X(lTs), Y(Math.log10(Lstar)), 5, '#fff', rgba(tempRGB(10 ** lTs), 1), 1.5);
    this.setReadout([
      ['Nebula', `R = ${fmt(Rpc, 2)} pc, diameter ${fmt(2 * Rpc, 2)} pc · at 213 pc (Helix) that is ${fmt(thetaArcmin, 1)}′${Math.abs(thetaArcmin - 16) < 1.5 ? ' — the Helix\'s 16′' : ''}`, '#2ad4c8'],
      ['Kinematic age', `t = R / v = ${fmtYr(age)} at ${v} km/s · typical PN: 10–30 km/s, 0.3 pc, ~10⁴ yr; gone in 5 × 10⁴ yr`, C.text],
      ['Central star', `T_eff ≈ ${fmtSci(10 ** lTs, 0)} K · L = ${fmtSci(Lstar, 1)} L☉ · ${age < 10000 ? 'crossing the H–R diagram; UV ionises the ejecta' : 'shells out: fading white dwarf'}`, rgba(tempRGB(10 ** lTs), 1)],
      ['Galaxy', '~1500 known, ~15 000 estimated; ~0.5 M☉ each → ≈ 1 M☉ yr⁻¹ of enriched gas back to the ISM'],
    ]);
  }
}

/* ------------------------------------------------- 13.3a stellar populations ---- */

class StellarpopsWidget extends CanvasWidget {
  private t = 13.8; private seedPts: Array<[number, number, number]> = [];
  constructor() {
    super(1.8);
    this.slider('Time since the Big Bang', 0, 13.8, 0.05, this.t, (v) => `${fmt(v, 1)} Gyr`, (v) => { this.t = v; });
    let s = 7; const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    for (let i = 0; i < 700; i++) { const kind = rnd(); const r = kind < 0.55 ? rnd() ** 0.7 : kind < 0.75 ? rnd() * 0.25 : rnd() ** 0.5; const ang = rnd() * TAU; const z = kind < 0.55 ? (rnd() - 0.5) * 0.06 : kind < 0.75 ? (rnd() - 0.5) * 0.3 * (1 - r) : (rnd() - 0.5) * 1.6 * Math.sqrt(1 - r * r); this.seedPts.push([r * Math.cos(ang), z, kind]); }
  }
  protected draw() {
    const c = this.ctx, w = this.w, h = this.h;
    const t = this.t;
    const Z = (tt: number) => 0.03 * (1 - Math.exp(-tt / 6.5)) ** 1.4;        // schematic enrichment
    // left: edge-on Galaxy
    const cx = w * 0.3, cy = h * 0.5, sc = Math.min(w * 0.26, h * 0.5);
    c.fillStyle = hexA(C.sun, 0.05); c.beginPath(); c.ellipse(cx, cy, sc * 1.05, sc * 0.78, 0, 0, TAU); c.fill();
    this.text('halo: Pop II, globulars, 10–13 Gyr, Z ~ 10⁻⁴–10⁻³, fast', cx, cy - sc * 0.78 - 8, C.accent, 7, 'center');
    for (const [x, z, kind] of this.seedPts) {
      const popI = kind < 0.55, bulge = kind >= 0.55 && kind < 0.75;
      const born = popI ? 5 + 8.8 * ((kind) / 0.55) : bulge ? 1 + 3 * ((kind - 0.55) / 0.2) : 0.3 + 1.5 * ((kind - 0.75) / 0.25);
      if (born > t) continue;
      const col = popI ? (kind < 0.15 ? C.blue : kind < 0.4 ? C.star : C.sun) : bulge ? C.venus : C.red;
      c.fillStyle = hexA(col, popI ? 0.9 : 0.7); c.fillRect(cx + x * sc, cy + z * sc, popI && kind < 0.15 ? 2 : 1.5, popI && kind < 0.15 ? 2 : 1.5);
    }
    if (t < 0.3) this.text('only hydrogen and helium: no stars yet', cx, cy, C.dim, 9, 'center');
    if (t >= 0.3 && t < 1.5) this.text('Population III: Z = 0, massive, short-lived (none found)', cx, cy + sc * 0.55, C.purple, 8, 'center');
    this.text('disc: Pop I, Z ≈ 0.01–0.03, slow, 0–9 Gyr; Sun Z = 0.02', cx, cy + sc * 0.78 + 10, C.blue, 7, 'center');
    this.text('bulge', cx, cy - sc * 0.33, C.venus, 7, 'center');
    this.circle(cx + 0.6 * sc, cy, 3, C.sun); this.text('☉', cx + 0.6 * sc + 7, cy, C.sun, 8);
    // right: enrichment curve
    const x0 = w * 0.66, x1 = w - 12, y0 = 14, y1 = h - 30;
    axesBox(c, x0, y0, x1, y1);
    const X = (tt: number) => x0 + tt / 13.8 * (x1 - x0); const Y = (z: number) => y1 - 6 - z / 0.032 * (y1 - y0 - 12);
    for (const z of [0, 0.01, 0.02, 0.03]) { this.line(x0, Y(z), x1, Y(z), hexA(C.grid, 0.9)); this.text(fmt(z, 2), x0 - 4, Y(z), C.dim, 8, 'right'); }
    for (const tt of [0, 5, 10, 13.8]) this.text(fmt(tt, 0), X(tt), y1 + 10, C.dim, 8, 'center');
    this.text('Gyr after the Big Bang', x1, y1 + 22, C.dim, 9, 'right'); this.text('Z of newly formed stars', x0 + 6, y0 + 10, C.dim, 8);
    plotCurve(c, 0, t, 60, X, (tt) => Y(Z(tt)), C.sun, 2); plotCurve(c, t, 13.8, 60, X, (tt) => Y(Z(tt)), hexA(C.sun, 0.3), 1, [3, 3]);
    c.fillStyle = hexA(C.purple, 0.1); c.fillRect(X(0.1), y0, X(1.0) - X(0.1), y1 - y0); this.text('III', X(0.55), y0 + 24, C.purple, 8, 'center');
    c.fillStyle = hexA(C.accent, 0.08); c.fillRect(X(1.0), y0, X(4) - X(1.0), y1 - y0); this.text('II', X(2.5), y0 + 24, C.accent, 8, 'center');
    c.fillStyle = hexA(C.blue, 0.06); c.fillRect(X(4), y0, x1 - X(4), y1 - y0); this.text('I', X(9), y0 + 24, C.blue, 8, 'center');
    this.circle(X(9.2), Y(0.02), 4, C.sun); this.text('Sun forms', X(9.2), Y(0.02) - 10, C.sun, 7, 'center');
    this.line(X(t), y0, X(t), y1, hexA(C.text, 0.4), 1, [2, 3]);
    this.setReadout([
      ['Now', `${fmt(t, 1)} Gyr after the Big Bang · new stars form with Z ≈ ${fmt(Z(t), 3)}`, C.sun],
      ['Population III', 'the first stars, Z = 0: born ~0.1–1 Gyr, massive and gone; still hypothetical', C.purple],
      ['Population II', 'metal-poor (Z ~ 10⁻⁴–10⁻³, [Fe/H] −1 to −2.5), old, in the halo and bulge, large random velocities; Baade 1944', C.accent],
      ['Population I', 'metal-rich (Z up to 0.03), disc, near-circular orbits, all ages including the Sun; each generation adds metals via winds, PNe and supernovae', C.blue],
    ]);
  }
}

/* ------------------------------------------------- 13.3b main-sequence fitting ---- */

type FitCluster = 'hyades' | 'pleiades' | 'praesepe' | 'm67';
const FIT_CLUSTERS: Record<FitCluster, { name: string; dm: number; age: number; ebv: number }> = { hyades: { name: 'Hyades', dm: 3.33, age: 625, ebv: 0.0 }, pleiades: { name: 'Pleiades', dm: 5.65, age: 115, ebv: 0.04 }, praesepe: { name: 'Praesepe (M44)', dm: 6.3, age: 650, ebv: 0.03 }, m67: { name: 'M67', dm: 9.6, age: 4000, ebv: 0.04 } };
class MsfittingWidget extends CanvasWidget {
  private cl: FitCluster = 'pleiades'; private shift = 0; private stars: Array<[number, number]> = [];
  constructor() {
    super(1.8);
    this.segmented<FitCluster>([['hyades', 'Hyades'], ['pleiades', 'Pleiades'], ['praesepe', 'Praesepe'], ['m67', 'M67']], this.cl, (v) => { this.cl = v; this.build(); });
    this.slider('Vertical shift m − M', 0, 12, 0.02, this.shift, (v) => `${fmt(v, 2)} mag`, (v) => { this.shift = v; });
    this.build();
  }
  private build() {
    const cfg = FIT_CLUSTERS[this.cl]; let s = 13; const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    this.stars = [];
    for (let i = 0; i < 160; i++) {
      const M = 10 ** (Math.log10(0.4) + rnd() * (Math.log10(6) - Math.log10(0.4)));
      const st = evoState(M, cfg.age); if (st.phase === 'wd' || st.phase === 'sn' || st.phase === 'pagb') continue;
      const T = 10 ** st.lT, L = 10 ** st.lL; const bin = rnd() < 0.25 ? -0.75 * rnd() : 0;
      this.stars.push([bvFromT(T) + cfg.ebv + (rnd() - 0.5) * 0.04, mvFromLum(L, T) + cfg.dm + 3.1 * cfg.ebv + bin + (rnd() - 0.5) * 0.1]);
    }
  }
  protected draw() {
    const c = this.ctx, w = this.w, h = this.h;
    const cfg = FIT_CLUSTERS[this.cl];
    const x0 = PLOT_MARGIN, x1 = w * 0.6, y0 = 14, y1 = h - 30;
    axesBox(c, x0, y0, x1, y1);
    const X = (bv: number) => x0 + (bv + 0.3) / 2.1 * (x1 - x0); const Y = (Mv: number) => y0 + 6 + (Mv + 4) / 20 * (y1 - y0 - 12);
    for (let Mv = -4; Mv <= 16; Mv += 4) { this.line(x0, Y(Mv), x1, Y(Mv), hexA(C.grid, 0.9)); this.text(`${Mv}`, x0 - 4, Y(Mv), C.dim, 8, 'right'); }
    for (const bv of [0, 0.5, 1, 1.5]) this.text(fmt(bv, 1), X(bv), y1 + 10, C.dim, 8, 'center');
    this.text('B − V', x1, y1 + 22, C.dim, 9, 'right'); this.text('M_V (calibrated)  ·  cluster: V − shift', x0 + 6, y0 + 10, C.dim, 8);
    // calibrated MS from parallax stars
    plotCurve(c, Math.log10(0.25), Math.log10(8), 80, (lm) => X(bvFromT(mainSequence(10 ** lm).T)), (lm) => Y(mvFromLum(mainSequence(10 ** lm).L, mainSequence(10 ** lm).T)), C.sun, 2); this.text('calibrated ZAMS (parallaxes)', X(1.0), Y(mvFromLum(mainSequence(0.6).L, mainSequence(0.6).T)) + 14, C.sun, 7);
    for (const [bv, V] of this.stars) { const Mv = V - this.shift; if (Mv > 16.5 || Mv < -4.5) continue; this.circle(X(bv), Y(Mv), 1.8, undefined, hexA(C.blue, 0.85)); }
    // fit quality: rms distance in magnitude of unevolved MS stars (B−V > 0.4) from the ZAMS
    let sum = 0, n = 0; for (const [bv, V] of this.stars) { if (bv < 0.45 || bv > 1.4) continue; let lo = Math.log10(0.25), hi = Math.log10(8); for (let k = 0; k < 30; k++) { const m = (lo + hi) / 2; if (bvFromT(mainSequence(10 ** m).T) > bv) lo = m; else hi = m; } const ms = mainSequence(10 ** lo); const r = V - this.shift - mvFromLum(ms.L, ms.T) + 0.25; sum += Math.min(4, Math.abs(r)); n++; }
    const rms = n ? sum / n : 9; const good = Math.abs(this.shift - cfg.dm - 3.1 * cfg.ebv) < 0.15;
    const dist = 10 ** ((this.shift - 3.1 * cfg.ebv + 5) / 5);
    // right
    const bx0 = w * 0.67, bx1 = w - 12; let y = y0 + 8;
    this.text(cfg.name, bx0, y, C.text, 10); y += 16;
    this.text(`shift applied: ${fmt(this.shift, 2)} mag`, bx0, y, C.blue, 8); y += 12;
    this.text(`mean offset from ZAMS: ${fmt(rms, 2)} mag`, bx0, y, rms < 0.35 ? C.green : C.dim, 8); y += 12;
    c.fillStyle = hexA(C.grid, 1); c.fillRect(bx0, y, bx1 - bx0, 6); c.fillStyle = good ? C.green : C.blue; c.fillRect(bx0, y, (bx1 - bx0) * Math.max(0, 1 - rms / 2), 6); y += 16;
    this.text(good ? 'fit: the lower main sequence lies on the calibration' : this.shift < cfg.dm + 3.1 * cfg.ebv ? 'cluster too faint → shift more' : 'cluster too bright → shift less', bx0, y, good ? C.green : C.dim, 8); y += 20;
    this.text('reddening E(B−V) moves the cluster right and', bx0, y, C.dim, 7); y += 10; this.text(`down by A_V = 3.1 E(B−V) = ${fmt(3.1 * cfg.ebv, 2)} mag: remove first`, bx0, y, C.dim, 7); y += 16;
    this.text('binaries sit up to 0.75 mag above; fit the lower edge', bx0, y, C.dim, 7); y += 10;
    this.text(`turn-off: ${cfg.age < 200 ? 'B stars still on the MS' : cfg.age < 1000 ? 'A stars leaving' : 'near solar: old cluster, giants present'}`, bx0, y, C.dim, 7);
    this.setReadout([
      ['Distance modulus → distance', `m − M = ${fmt(this.shift - 3.1 * cfg.ebv, 2)} (after A_V) → d = 10^((m−M+5)/5) = ${fmt(dist, 0)} pc`, good ? C.green : C.blue],
      ['Literature', `${cfg.name}: m − M ≈ ${fmt(cfg.dm, 2)}, d ≈ ${fmt(10 ** ((cfg.dm + 5) / 5), 0)} pc, age ${fmtYr(cfg.age * 1e6)}`, C.text],
      ['Method', 'all members share one distance, so the apparent CMD is the absolute CMD shifted by m − M; the Hyades (parallaxes) calibrate the ZAMS used for everything farther'],
    ]);
  }
}

/* ------------------------------------------------------ 13.3c isochrones (CMD) ---- */

const ISO_CLUSTERS: Array<[string, number]> = [['NGC 2362', 1.0e6], ['h + χ Per', 6.5e6], ['Pleiades', 1.15e8], ['Hyades', 6.25e8], ['NGC 752', 1.9e9], ['M67', 4.0e9], ['M3 / 47 Tuc', 1.2e10]];
class IsochroneWidget extends CanvasWidget {
  private lt = 8; private popII = false; private masses: number[] = [];
  constructor() {
    super(1.8);
    this.slider('Cluster age', 6, 10.14, 0.01, this.lt, (v) => fmtYr(10 ** v), (v) => { this.lt = v; });
    this.segmented<'I' | 'II'>([['I', 'metal-rich (open cluster)'], ['II', 'metal-poor (globular)']], 'I', (v) => { this.popII = v === 'II'; });
    let s = 21; const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    // IMF-weighted sample via inverse CDF on a grid (Kroupa), 0.15–40 M☉
    const grid: number[] = []; const cdf: number[] = []; let acc = 0; const lo = Math.log10(0.15), hi = Math.log10(40);
    for (let i = 0; i < 400; i++) { const lm = lo + (i + 0.5) / 400 * (hi - lo); const m = 10 ** lm; acc += imfDm(m, 'kroupa') * m; grid.push(lm); cdf.push(acc); }
    for (let i = 0; i < 1400; i++) { const r = rnd() * acc; let k = 0; while (k < 399 && cdf[k] < r) k++; this.masses.push(10 ** (grid[k] + (rnd() - 0.5) * (hi - lo) / 400)); }
    // guarantee some massive stars for the young ages
    for (let i = 0; i < 25; i++) this.masses.push(10 ** (Math.log10(3) + rnd() * (Math.log10(40) - Math.log10(3))));
  }
  protected draw() {
    const c = this.ctx, w = this.w, h = this.h;
    const t = 10 ** this.lt / 1e6;
    const x0 = PLOT_MARGIN, x1 = w * 0.62, y0 = 14, y1 = h - 30;
    axesBox(c, x0, y0, x1, y1);
    const X = (bv: number) => x0 + (bv + 0.4) / 2.4 * (x1 - x0); const Y = (Mv: number) => y0 + 6 + (Mv + 9) / 26 * (y1 - y0 - 12);
    for (let Mv = -8; Mv <= 16; Mv += 4) { this.line(x0, Y(Mv), x1, Y(Mv), hexA(C.grid, 0.9)); this.text(`${Mv}`, x0 - 4, Y(Mv), C.dim, 8, 'right'); }
    for (const bv of [-0.3, 0, 0.5, 1, 1.5, 2]) this.text(fmt(bv, 1), X(bv), y1 + 10, C.dim, 8, 'center');
    this.text('B − V', x1, y1 + 22, C.dim, 9, 'right'); this.text(`M_V  —  isochrone at ${fmtYr(t * 1e6)}`, x0 + 6, y0 + 10, C.dim, 8);
    plotCurve(c, Math.log10(0.15), Math.log10(40), 80, (lm) => X(bvFromT(mainSequence(10 ** lm).T)), (lm) => Y(mvFromLum(mainSequence(10 ** lm).L, mainSequence(10 ** lm).T)), hexA(C.dim, 0.5), 1, [5, 4]);
    const counts: Partial<Record<EvoPhase, number>> = {}; let mTO = 0;
    let s = 5; const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    for (const M of this.masses) {
      let st = evoState(M, t, this.popII);
      if (st.phase === 'sn') continue;
      // blue stragglers: 1.5 % of stars above the turn-off kept on the MS in old clusters
      if (t > 500 && st.phase !== 'ms' && st.phase !== 'pms' && M < 2.5 * Math.max(1, mTO || 1) && rnd() < 0.015) { const ms = mainSequence(M * 1.3); st = { phase: 'ms', lT: Math.log10(ms.T), lL: Math.log10(ms.L) }; }
      if (st.phase === 'ms') mTO = Math.max(mTO, M);
      counts[st.phase] = (counts[st.phase] ?? 0) + 1;
      const T = 10 ** st.lT, L = 10 ** st.lL; const bv = bvFromT(T) + (rnd() - 0.5) * 0.03, Mv = mvFromLum(L, T) + (rnd() - 0.5) * 0.12;
      if (Mv > 17 || Mv < -9) continue;
      const col = st.phase === 'ms' ? hexA('#ffffff', 0.85) : PHASE_META[st.phase][1];
      this.circle(X(bv), Y(Mv), st.phase === 'ms' || st.phase === 'pms' ? 1.5 : 2.2, undefined, col);
    }
    if (mTO > 0) { const to = msEvolved(mTO, 1); this.text('turn-off', X(bvFromT(to.T)) - 8, Y(mvFromLum(to.L, to.T)), C.text, 8, 'right'); }
    const gap = mTO > 1.3 && mTO < 12; if (gap) this.text('Hertzsprung gap', X(0.65), Y(mvFromLum(msEvolved(mTO, 1).L, msEvolved(mTO, 1).T) - 0.5), C.accent, 8, 'center');
    // right: legend + cluster list
    const bx0 = w * 0.69, bx1 = w - 12; let y = y0 + 8;
    this.text(`turn-off ≈ ${fmt(mTO, mTO < 3 ? 2 : 0)} M☉ (${spectralClass(msEvolved(mTO, 1).T)})`, bx0, y, C.text, 9); y += 14;
    for (const ph of ['pms', 'ms', 'sgb', 'rgb', 'he', 'agb', 'pagb', 'wd'] as EvoPhase[]) { const n = counts[ph] ?? 0; this.text(`${PHASE_META[ph][0]}: ${n}`, bx0, y, n ? PHASE_META[ph][1] : C.faint, 7); y += 10; }
    y += 6; this.text('real clusters (turn-off ages)', bx0, y, C.dim, 8); y += 12;
    for (const [name, age] of ISO_CLUSTERS) { const near = Math.abs(Math.log10(age) - this.lt) < 0.12; this.text(`${name}`, bx0, y, near ? C.sun : C.dim, 7); this.text(fmtYr(age), bx1, y, near ? C.sun : C.dim, 7, 'right'); if (near) this.line(bx0, y + 6, bx1, y + 6, hexA(C.sun, 0.5)); y += 10; }
    this.setReadout([
      ['Turn-off clock', `t ≈ t_MS(M_TO): stars of ${fmt(mTO, mTO < 3 ? 2 : 0)} M☉ are leaving now; everything heavier has gone to the giant branches or beyond${(counts.sn ?? 0) ? '' : ''}`, C.text],
      ['What you see', t < 20 ? 'upper MS only; low-mass stars still contracting (PMS, above the MS to the right): h + χ Persei' : gap ? 'a Hertzsprung gap between the turn-off and the red giants: the SGB crossing takes ~1 % of t_MS' : 'no gap: below ~1.25 M☉ the partly degenerate core makes the subgiant branch slow and continuous (M67, M3)', C.accent],
      ['Helium burners', this.popII ? 'metal-poor: a blue horizontal branch spread in colour (RR Lyrae in the strip)' : mTO > 2 ? 'blue loop: core-He stars sit left of the giants (Cepheids among them)' : 'red clump: the HB of metal-rich stars bunches near B−V ≈ 1', C.sun],
      ['Blue stragglers', t > 500 ? 'a few MS stars above the turn-off: rejuvenated by mass transfer or collisions' : 'none expected yet'],
    ]);
  }
}

/* -------------------------------------------------- 13.3d counts by phase ---- */

class PhasecountsWidget extends CanvasWidget {
  private lt = 10; private lN = 5;
  constructor() {
    super(1.8);
    this.slider('Cluster age', 7, 10.14, 0.01, this.lt, (v) => fmtYr(10 ** v), (v) => { this.lt = v; });
    this.slider('Stars formed', 3, 6, 0.1, this.lN, (v) => sci(10 ** v, 0), (v) => { this.lN = v; });
  }
  protected draw() {
    const c = this.ctx, w = this.w, h = this.h;
    const t = 10 ** this.lt / 1e6, N = 10 ** this.lN;
    // cumulative IMF in log mass, then count stars whose main-sequence lifetime falls in each phase window (exact, no binning)
    const lo = Math.log10(0.08), hi = Math.log10(100), nb = 600; const cum: number[] = [0];
    for (let i = 0; i < nb; i++) { const m = 10 ** (lo + (i + 0.5) / nb * (hi - lo)); cum.push(cum[i] + imfDm(m, 'kroupa') * m); }
    const F = (lm: number) => { const x = Math.max(0, Math.min(nb, (lm - lo) / (hi - lo) * nb)); const i = Math.floor(x); return i >= nb ? cum[nb] : cum[i] + (x - i) * (cum[i + 1] - cum[i]); };
    const nIn = (lmA: number, lmB: number) => N * Math.max(0, F(Math.min(hi, lmB)) - F(Math.max(lo, lmA))) / cum[nb];
    const lmFor = (fn: (m: number) => number, target: number) => { let a = lo, b = hi; for (let k = 0; k < 50; k++) { const m = (a + b) / 2; if (fn(10 ** m) > target) a = m; else b = m; } return (a + b) / 2; };
    const lmTO = lmFor(evoMsLifetime, t), mTO = 10 ** lmTO, tMS = evoMsLifetime(mTO);
    const wq = Math.max(0, Math.min(1, (lmTO - 0.1) / 0.2));
    const fS = 0.18 + wq * (0.012 - 0.18), fR = 0.06 + wq * (0.02 - 0.06), fH = 0.012 + wq * (0.08 - 0.012), fA = 0.001 + wq * (0.01 - 0.001), fP = 2e-6;
    const win = (a: number, b: number) => nIn(lmFor(evoMsLifetime, t / (1 + a)), lmFor(evoMsLifetime, t / (1 + b)));
    const lmPms = pmsTime(0.08) > t ? lmFor(pmsTime, t) : lo;
    const counts: Record<EvoPhase, number> = {
      pms: nIn(lo, lmPms), ms: nIn(lmPms, lmTO), sgb: win(0, fS), rgb: win(fS, fS + fR), he: win(fS + fR, fS + fR + fH),
      agb: Math.min(win(fS + fR + fH, fS + fR + fH + fA), nIn(lmFor(evoMsLifetime, t / (1 + fS + fR + fH + fA)), Math.log10(8))), pagb: win(fS + fR + fH + fA, fS + fR + fH + fA + fP),
      wd: nIn(lmFor(evoMsLifetime, t / (1 + fS + fR + fH + fA + fP)), Math.log10(8)), sn: nIn(Math.max(Math.log10(8), lmFor(evoMsLifetime, t / (1 + fS + fR + fH))), hi),
    };
    const x0 = w * 0.3, x1 = w - 14, y0 = 14, y1 = h - 30;
    const phases: EvoPhase[] = ['pms', 'ms', 'sgb', 'rgb', 'he', 'agb', 'pagb', 'wd', 'sn'];
    const rowH = (y1 - y0) / phases.length;
    const LX = (n: number) => x0 + Math.max(0, Math.log10(Math.max(0.3, n)) + 0.6) / (this.lN + 0.8) * (x1 - x0);
    for (let e = 0; e <= this.lN; e++) { this.line(LX(10 ** e), y0, LX(10 ** e), y1, hexA(C.grid, 0.9)); this.text(`10${sup(e)}`, LX(10 ** e), y1 + 10, C.dim, 8, 'center'); }
    this.text('expected number of stars (log)', x1, y1 + 22, C.dim, 9, 'right');
    const shortLab: Record<EvoPhase, string> = { pms: 'pre-main-sequence', ms: 'main sequence', sgb: 'subgiant branch', rgb: 'red giant branch', he: 'core He burning (HB)', agb: 'AGB', pagb: 'post-AGB / PN', wd: 'white dwarfs', sn: 'exploded (> 8 M☉)' };
    phases.forEach((ph, i) => {
      const y = y0 + i * rowH; const n = counts[ph]; const col = PHASE_META[ph][1];
      this.text(shortLab[ph], x0 - 6, y + rowH / 2, col, 8, 'right');
      const bw = Math.max(1, LX(n) - x0); c.fillStyle = hexA(col, 0.75); c.fillRect(x0, y + rowH * 0.2, bw, rowH * 0.6);
      const lab = n >= 1 ? (n >= 1e4 ? sci(n, 1) : fmt(n, n < 10 ? 1 : 0)) : n > 0.01 ? `${fmt(n, 2)} (likely none)` : '0';
      const inside = x0 + bw + 70 > x1; this.text(lab, inside ? x0 + bw - 4 : x0 + bw + 4, y + rowH / 2, inside ? C.bg : C.text, 8, inside ? 'right' : 'left');
    });
    const frac = (ph: EvoPhase) => counts[ph] / Math.max(1, counts.ms);
    this.setReadout([
      ['Cluster', `${sci(N, 0)} stars formed, age ${fmtYr(t * 1e6)} · turn-off ${fmt(mTO, mTO < 3 ? 2 : 1)} M☉ (t_MS = ${fmtYr(tMS * 1e6)})`, C.text],
      ['Why so few giants', `a phase holding a fraction f of a star's life is populated by ≈ f × (stars near the turn-off): RGB/MS = ${sci(frac('rgb'), 1)}, HB/MS = ${sci(frac('he'), 1)}, AGB/MS = ${sci(frac('agb'), 1)}, post-AGB/MS = ${sci(frac('pagb'), 1)}`, C.red],
      ['Hertzsprung gap', mTO > 1.3 ? `turn-off above 1.25 M☉: the SGB holds only ${counts.sgb < 1 ? fmt(counts.sgb, 2) : fmt(counts.sgb, 0)} stars — a gap` : `turn-off below 1.25 M☉: slow, continuous SGB with ${fmt(counts.sgb, 0)} stars — no gap (M67, M3)`, C.accent],
      ['Remnants', `${fmt(counts.wd, 0)} white dwarfs${counts.sn > 0.5 ? ` · ${fmt(counts.sn, 0)} stars above 8 M☉ have exploded as supernovae` : ''}`, '#dfe7ff'],
    ]);
  }
}

export function createWidget(spec: WidgetSpec): Widget {
  switch (spec.type) {
    case 'ancientsky': return new AncientSkyWidget();
    case 'models': return new ModelsWidget(spec);
    case 'eudoxus': return new EudoxusWidget();
    case 'synodic': return new SynodicWidget();
    case 'sphere': return new SphereWidget(spec.mode);
    case 'precession': return new PrecessionWidget();
    case 'spectrum': return new SpectrumWidget();
    case 'ellipse': return new EllipseWidget(spec.conics ?? false);
    case 'kepler2': return new Kepler2Widget();
    case 'kepler3': return new Kepler3Widget();
    case 'cannon': return new CannonWidget();
    case 'twobody': return new TwoBodyWidget();
    case 'virial': return new VirialWidget();
    case 'parallax': return new ParallaxWidget();
    case 'magnitude': return new MagnitudeWidget();
    case 'distmod': return new DistModWidget();
    case 'doubleslit': return new DoubleSlitWidget();
    case 'emwave': return new EMWaveWidget();
    case 'blackbody': return new BlackbodyWidget(spec.mode ?? 'planck');
    case 'lrt': return new LRTWidget();
    case 'quantum': return new QuantumWidget();
    case 'colorindex': return new ColorIndexWidget();
    case 'michelson': return new MichelsonWidget();
    case 'velocityadd': return new VelocityAddWidget();
    case 'minkowski': return new MinkowskiWidget();
    case 'train': return new TrainWidget();
    case 'lightclock': return new LightClockWidget();
    case 'muon': return new MuonWidget();
    case 'relenergy': return new RelEnergyWidget();
    case 'fraunhofer': return new FraunhoferWidget();
    case 'kirchhoff': return new KirchhoffWidget();
    case 'elementid': return new ElementIdWidget();
    case 'dopplerlines': return new DopplerLinesWidget();
    case 'specbinary': return new SpecBinaryWidget();
    case 'photoelectric': return new PhotoelectricWidget();
    case 'photonscale': return new PhotonScaleWidget();
    case 'compton': return new ComptonWidget();
    case 'rutherford': return new RutherfordWidget();
    case 'series': return new SeriesWidget();
    case 'bohr': return new BohrWidget();
    case 'hydrogenic': return new HydrogenicWidget();
    case 'matterwave': return new MatterWaveWidget();
    case 'orbitals': return new OrbitalsWidget();
    case 'wavepacket': return new WavePacketWidget();
    case 'pauli': return new PauliWidget();
    case 'lightbucket': return new LightBucketWidget();
    case 'snell': return new SnellWidget();
    case 'lens': return new LensWidget();
    case 'airy': return new AiryWidget();
    case 'seeing': return new SeeingWidget();
    case 'chromatic': return new ChromaticWidget();
    case 'designs': return new DesignsWidget();
    case 'platescale': return new PlateScaleWidget();
    case 'scopes': return new ScopesWidget();
    case 'mount': return new MountWidget();
    case 'jansky': return new JanskyWidget();
    case 'dish': return new DishWidget();
    case 'interferometer': return new InterferometerWidget();
    case 'atmwindow': return new AtmWindowWidget();
    case 'irthermal': return new IrThermalWidget();
    case 'grazing': return new GrazingWidget();
    case 'gammadetect': return new GammaDetectWidget();
    case 'multiview': return new MultiviewWidget();
    case 'skymap': return new SkyMapWidget();
    case 'datagrowth': return new DataGrowthWidget();
    case 'crossmatch': return new CrossmatchWidget();
    case 'doubletest': return new DoubleTestWidget();
    case 'visualorbit': return new VisualOrbitWidget(spec.mode);
    case 'astrometric': return new AstrometricWidget();
    case 'binaryclassify': return new BinaryClassifyWidget();
    case 'massratio': return new MassRatioWidget();
    case 'binarymass': return new BinaryMassWidget();
    case 'massluminosity': return new MassLuminosityWidget();
    case 'rvshape': return new RvShapeWidget();
    case 'massfunction': return new MassFunctionWidget();
    case 'eclipse': return new EclipseWidget(spec.mode);
    case 'lcgallery': return new LcGalleryWidget();
    case 'planetrv': return new PlanetRvWidget();
    case 'transit': return new TransitWidget();
    case 'methods': return new MethodsWidget();
    case 'density': return new DensityWidget();
    case 'habitable': return new HabitableWidget();
    case 'spectralseq': return new SpectralSeqWidget();
    case 'planetspectrum': return new PlanetSpectrumWidget();
    case 'boltzmann': return new BoltzmannWidget();
    case 'saha': return new SahaWidget();
    case 'balmerpeak': return new BalmerPeakWidget();
    case 'coolspectra': return new CoolSpectraWidget();
    case 'hrbuild': return new HrBuildWidget();
    case 'hrmass': return new HrMassWidget();
    case 'hrradius': return new HrRadiusWidget();
    case 'hrextended': return new HrExtendedWidget();
    case 'luminosityclass': return new LuminosityClassWidget();
    case 'specparallax': return new SpecParallaxWidget();
    case 'intensity': return new IntensityWidget();
    case 'meanintensity': return new MeanIntensityWidget();
    case 'fluxcos': return new FluxCosWidget();
    case 'radpressure': return new RadPressureWidget();
    case 'colortemp': return new ColorTempWidget();
    case 'opticaldepth': return new OpticalDepthWidget();
    case 'sunset': return new SunsetWidget();
    case 'opacitysources': return new OpacitySourcesWidget();
    case 'rosseland': return new RosselandWidget();
    case 'randomwalk': return new RandomWalkWidget();
    case 'limbdark': return new LimbDarkWidget(spec.mode);
    case 'transfer': return new TransferWidget();
    case 'thermalize': return new ThermalizeWidget();
    case 'planeparallel': return new PlaneParallelWidget();
    case 'grayatm': return new GrayAtmWidget();
    case 'barbier': return new BarbierWidget();
    case 'lineprofile': return new LineProfileWidget();
    case 'broadening': return new BroadeningWidget();
    case 'rotation': return new RotationWidget();
    case 'curveofgrowth': return new CurveOfGrowthWidget();
    case 'abundances': return new AbundancesWidget();
    case 'hydrostatic': return new HydrostaticWidget();
    case 'centralpressure': return new CentralPressureWidget();
    case 'massshells': return new MassShellsWidget();
    case 'meanmolecular': return new MeanMolecularWidget();
    case 'pressuremix': return new PressureMixWidget();
    case 'giantradius': return new GiantRadiusWidget();
    case 'khtimescale': return new KhTimescaleWidget();
    case 'bindingenergy': return new BindingEnergyWidget();
    case 'gamow': return new GamowWidget();
    case 'ppchain': return new PpChainWidget();
    case 'ppcno': return new PpCnoWidget();
    case 'radgradient': return new RadGradientWidget();
    case 'convection': return new ConvectionWidget();
    case 'mixinglength': return new MixingLengthWidget();
    case 'polytrope': return new PolytropeWidget();
    case 'solarmodel': return new SolarModelWidget();
    case 'msrange': return new MsRangeWidget();
    case 'msstructure': return new MsStructureWidget();
    case 'mslifetime': return new MsLifetimeWidget();
    case 'sunhistory': return new SunHistoryWidget();
    case 'solarcomposition': return new SolarCompositionWidget();
    case 'solarenergy': return new SolarEnergyWidget();
    case 'solargradients': return new SolarGradientsWidget();
    case 'pmodes': return new PmodesWidget();
    case 'neutrinospectrum': return new NeutrinoSpectrumWidget();
    case 'nuoscillation': return new NuOscillationWidget();
    case 'atmprofile': return new AtmProfileWidget();
    case 'granulation': return new GranulationWidget();
    case 'spicules': return new SpiculesWidget();
    case 'coronalions': return new CoronalIonsWidget();
    case 'solarwind': return new SolarWindWidget();
    case 'cme': return new CmeWidget();
    case 'diffrot': return new DiffRotWidget();
    case 'sunspot': return new SunspotWidget();
    case 'butterfly': return new ButterflyWidget();
    case 'flareenergy': return new FlareEnergyWidget();
    case 'dynamo': return new DynamoWidget();
    case 'activity': return new ActivityWidget();
    case 'extinction': return new ExtinctionWidget();
    case 'extcurve': return new ExtcurveWidget();
    case 'hi21cm': return new Hi21cmWidget();
    case 'ismphases': return new IsmPhasesWidget();
    case 'heatcool': return new HeatcoolWidget();
    case 'jeans': return new JeansWidget();
    case 'freefall': return new FreefallWidget();
    case 'fragmentation': return new FragmentationWidget();
    case 'magcollapse': return new MagcollapseWidget();
    case 'protostartrack': return new ProtostartrackWidget();
    case 'pmstracks': return new PmstracksWidget();
    case 'imf': return new ImfWidget();
    case 'stromgren': return new StromgrenWidget();
    case 'pcygni': return new PcygniWidget();
    case 'protodisk': return new ProtodiskWidget();
    case 'evotimescales': return new EvotimescalesWidget();
    case 'mscore': return new MscoreWidget();
    case 'sclimit': return new SclimitWidget();
    case 'evotracks': return new EvotracksWidget();
    case 'giantstages': return new GiantstagesWidget();
    case 'heflash': return new HeflashWidget();
    case 'thermalpulses': return new ThermalpulsesWidget();
    case 'sprocess': return new SprocessWidget();
    case 'agbmassloss': return new AgbmasslossWidget();
    case 'planetary': return new PlanetaryWidget();
    case 'stellarpops': return new StellarpopsWidget();
    case 'msfitting': return new MsfittingWidget();
    case 'isochrone': return new IsochroneWidget();
    case 'phasecounts': return new PhasecountsWidget();
  }
}
