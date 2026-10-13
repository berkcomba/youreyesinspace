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
  if (ev > 1e9) return `${(ev / 1e9).toPrecision(3)} GeV`;
  if (ev > 1e6) return `${(ev / 1e6).toPrecision(3)} MeV`;
  if (ev > 1e3) return `${(ev / 1e3).toPrecision(3)} keV`;
  if (ev > 1) return `${ev.toPrecision(3)} eV`;
  if (ev > 1e-3) return `${(ev * 1e3).toPrecision(3)} meV`;
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
  }
}
