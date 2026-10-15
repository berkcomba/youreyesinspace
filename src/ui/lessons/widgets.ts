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

/* ------------------------------------------------------------ factory ---- */

export function createWidget(spec: WidgetSpec): Widget {
  switch (spec.type) {
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
  }
}
