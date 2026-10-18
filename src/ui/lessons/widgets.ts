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
  }
}
