/**
 * The view from the flight deck: a canopy frame over the 3D scene, two instrument consoles
 * (velocity, distance, ETA; hull, crew, route) and a 2D effects layer through the window:
 * warp streaks at high speed, asteroid fields, comet dust, flare glare, impacts and repairs.
 * Speed is not simulated: it is read off the camera autopilot as the rate the remaining
 * distance shrinks, so the gauges match what the scene does.
 */
import { sfx } from './sfx';

export type FieldMode = 'none' | 'ahead' | 'through' | 'around';

export interface Readout {
  target: string;
  waypoint: string;
  hull: number;
  crew: number;
  status: string;
}

interface Rock { x: number; y: number; z: number; vx: number; vy: number; vz: number; s: number; rot: number; spin: number; shape: number[]; tone: number; big?: boolean }
interface Spark { x: number; y: number; vx: number; vy: number; life: number; max: number; hue: number; size: number }
interface Streak { a: number; r: number; v: number }

const C_KMS = 299_792.458;
const LY_KM = 9.4607e12;
const AU_KM = 1.495979e8;

const esc = (s: string): string => s.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);

function big(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e4) return `${(n / 1e3).toFixed(0)}k`;
  if (n >= 100) return n.toFixed(0);
  return n.toFixed(n >= 10 ? 1 : 2);
}

function speedText(kms: number): [string, string] {
  if (kms < 0.5) return ['0', 'km/s'];
  if (kms < C_KMS * 0.05) return [Math.round(kms).toLocaleString('en-US'), 'km/s'];
  return [big(kms / C_KMS), '× light'];
}

function distText(km: number): string {
  if (km < 1e6) return `${Math.round(km).toLocaleString('en-US')} km`;
  if (km < LY_KM * 0.05) return `${big(km / AU_KM)} AU`;
  const ly = km / LY_KM;
  if (ly < 1e6) return `${big(ly)} ly`;
  return ly < 1e9 ? `${(ly / 1e6).toFixed(1)} Mly` : `${(ly / 1e9).toFixed(2)} Gly`;
}

const FRAME = `
<svg class="ck-frame" viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true">
  <defs>
    <linearGradient id="ck-metal" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#1f2329" /><stop offset="0.6" stop-color="#121418" /><stop offset="1" stop-color="#090b0f" />
    </linearGradient>
    <linearGradient id="ck-dash" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#262b31" /><stop offset="0.15" stop-color="#14171b" /><stop offset="1" stop-color="#090b0f" />
    </linearGradient>
  </defs>
  <path fill="url(#ck-metal)" fill-rule="evenodd" d="M0,0 H1000 V1000 H0 Z M70,92 Q500,34 930,92 L984,640 Q998,700 944,734 Q760,868 500,886 Q240,868 56,734 Q2,700 16,640 Z" />
  <path class="ck-gasket" fill="none" d="M70,92 Q500,34 930,92 L984,640 Q998,700 944,734 Q760,868 500,886 Q240,868 56,734 Q2,700 16,640 Z" />
  <path fill="url(#ck-metal)" d="M236,58 L252,58 L214,876 L196,872 Z M748,58 L764,58 L804,872 L786,876 Z" />
  <path class="ck-gasket" fill="none" d="M244,60 L205,874 M756,60 L795,874" />
  <path fill="url(#ck-dash)" d="M0,1000 V770 Q120,800 250,850 Q380,898 500,902 Q620,898 750,850 Q880,800 1000,770 V1000 Z" />
  <path class="ck-dashline" fill="none" d="M0,770 Q120,800 250,850 Q380,898 500,902 Q620,898 750,850 Q880,800 1000,770" />
</svg>`;

export class CockpitView {
  readonly el: HTMLDivElement;
  private fx: HTMLCanvasElement;
  private g: CanvasRenderingContext2D;
  private left: HTMLDivElement;
  private right: HTMLDivElement;
  private flash: HTMLDivElement;
  private cracks: SVGSVGElement;
  private visible = false;
  private raf = 0;
  private lastFrame = 0;
  private w = 0;
  private h = 0;

  private mode: FieldMode = 'none';
  private modeUntil = 0;
  private rocks: Rock[] = [];
  private sparks: Spark[] = [];
  private streaks: Streak[] = [];
  private dust = 0;
  private dustUntil = 0;
  private flareFrom = 0;
  private flareUntil = 0;
  private healFrom = 0;
  private pending: number[] = [];

  private speed = 0;
  private lastRem = -1;
  private lastT = 0;
  private readout: Readout = { target: '', waypoint: '', hull: 100, crew: 0, status: 'STANDBY' };
  private shown = '';

  constructor(private telemetry: () => { remainingKm: number; etaS: number } | null) {
    this.el = document.createElement('div');
    this.el.id = 'xp-cockpit';
    this.el.hidden = true;
    this.fx = document.createElement('canvas');
    this.fx.className = 'ck-fx';
    this.g = this.fx.getContext('2d')!;
    this.cracks = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.cracks.setAttribute('class', 'ck-cracks');
    this.cracks.setAttribute('viewBox', '0 0 1000 1000');
    this.cracks.setAttribute('preserveAspectRatio', 'none');
    this.flash = document.createElement('div');
    this.flash.className = 'ck-flash';
    this.left = document.createElement('div');
    this.left.className = 'ck-con ck-left';
    this.right = document.createElement('div');
    this.right.className = 'ck-con ck-right';
    this.el.append(this.fx, this.cracks);
    this.el.insertAdjacentHTML('beforeend', FRAME);
    this.el.append(this.flash, this.left, this.right);
    this.el.insertAdjacentHTML('beforeend', '<div class="ck-lamps"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>');
    for (let i = 0; i < 140; i++) this.streaks.push({ a: Math.random() * Math.PI * 2, r: Math.random(), v: 0.4 + Math.random() });
    addEventListener('resize', () => this.resize());
  }

  show(on: boolean): void {
    if (on === this.visible) return;
    this.visible = on;
    this.el.hidden = !on;
    if (on) { this.resize(); this.lastFrame = performance.now(); this.raf = requestAnimationFrame((t) => this.frame(t)); }
    else { cancelAnimationFrame(this.raf); this.clear(); }
  }

  setReadout(r: Readout): void { this.readout = r; }

  /** asteroid field through the window, for `secs` seconds (0: until changed) */
  field(mode: FieldMode, secs = 0): void {
    this.mode = mode;
    this.modeUntil = secs ? performance.now() + secs * 1000 : 0;
    if (mode === 'through') sfx.play('rumble');
    if (mode === 'none') for (const r of this.rocks) r.vz = Math.max(r.vz, 6);
  }

  /** a big rock (or a jolt, when no field is up) strikes the canopy after `delayMs` */
  hit(delayMs = 0): void {
    const at = performance.now() + delayMs;
    if (this.mode !== 'none' || this.rocks.length) {
      const vz = 7;
      const lead = Math.max(0.6, delayMs / 1000);
      this.rocks.push({ x: (Math.random() - 0.5) * 0.3, y: (Math.random() - 0.5) * 0.2, z: 0.55 + vz * lead, vx: 0, vy: 0, vz, s: 0.34, rot: 0, spin: 1.5, shape: this.shape(), tone: 0.8, big: true });
    } else {
      this.pending.push(at);
    }
  }

  heal(): void { this.healFrom = performance.now(); sfx.play('repair'); }
  flare(secs = 6): void { this.flareFrom = performance.now(); this.flareUntil = this.flareFrom + secs * 1000; }
  comet(density: number, secs = 6): void { this.dust = density; this.dustUntil = performance.now() + secs * 1000; }

  clear(): void {
    this.mode = 'none';
    this.rocks = [];
    this.sparks = [];
    this.pending = [];
    this.dust = 0;
    this.flareUntil = 0;
    this.cracks.innerHTML = '';
  }

  /* ---------------- internals ---------------- */

  private resize(): void {
    const dpr = Math.min(2, devicePixelRatio || 1);
    this.w = innerWidth;
    this.h = innerHeight;
    this.fx.width = Math.round(this.w * dpr);
    this.fx.height = Math.round(this.h * dpr);
    this.g.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  private shape(): number[] {
    const n = 9 + Math.floor(Math.random() * 4);
    return Array.from({ length: n }, () => 0.72 + Math.random() * 0.34);
  }

  private spawn(): void {
    const m = this.mode;
    const far = m === 'ahead' ? 9 + Math.random() * 6 : 6 + Math.random() * 4;
    let x = 0, y = 0;
    do { x = (Math.random() - 0.5) * 7; y = (Math.random() - 0.5) * 4.5; } while (Math.hypot(x, y * 1.3) < (m === 'ahead' ? 0.2 : 0.55));
    const vz = m === 'through' ? 7 + Math.random() * 4 : m === 'around' ? 2.5 + Math.random() : 0.5 + Math.random() * 0.5;
    const vx = m === 'around' ? 2.2 + Math.random() : (Math.random() - 0.5) * 0.1;
    this.rocks.push({ x, y, z: far, vx, vy: (Math.random() - 0.5) * 0.08, vz, s: 0.04 + Math.random() ** 2 * 0.22, rot: Math.random() * 6.3, spin: (Math.random() - 0.5) * 2, shape: this.shape(), tone: 0.55 + Math.random() * 0.45 });
  }

  private impact(x: number, y: number): void {
    sfx.play('impact');
    setTimeout(() => sfx.play('alarm'), 250);
    this.flash.classList.remove('on');
    void this.flash.offsetWidth;
    this.flash.classList.add('on');
    document.body.classList.remove('xp-shake');
    void document.body.offsetWidth;
    document.body.classList.add('xp-shake');
    setTimeout(() => document.body.classList.remove('xp-shake'), 900);
    for (let i = 0; i < 60; i++) {
      const a = Math.random() * Math.PI * 2, v = 120 + Math.random() * 700;
      this.sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0, max: 0.5 + Math.random() * 0.9, hue: 20 + Math.random() * 30, size: 1 + Math.random() * 3 });
    }
    this.crack(x / this.w * 1000, y / this.h * 1000);
  }

  private crack(cx: number, cy: number): void {
    let d = '';
    for (let i = 0; i < 9; i++) {
      let a = (i / 9) * Math.PI * 2 + Math.random() * 0.5, x = cx, y = cy;
      d += `M${cx.toFixed(1)},${cy.toFixed(1)}`;
      const len = 60 + Math.random() * 120;
      for (let s = 0; s < 4; s++) {
        a += (Math.random() - 0.5) * 0.7;
        x += Math.cos(a) * len / 4;
        y += Math.sin(a) * len / 4 * (this.w / this.h);
        d += ` L${x.toFixed(1)},${y.toFixed(1)}`;
      }
    }
    const ring = Array.from({ length: 12 }, (_, i) => {
      const a = (i / 12) * Math.PI * 2, r = 18 + Math.random() * 14;
      return `${i ? 'L' : 'M'}${(cx + Math.cos(a) * r).toFixed(1)},${(cy + Math.sin(a) * r * (this.w / this.h)).toFixed(1)}`;
    }).join(' ');
    this.cracks.innerHTML = `<g class="ck-crack"><path d="${d} ${ring} Z" /></g>`;
  }

  private frame(now: number): void {
    if (!this.visible) return;
    this.raf = requestAnimationFrame((t) => this.frame(t));
    const dt = Math.min(0.05, (now - this.lastFrame) / 1000);
    this.lastFrame = now;
    this.measure(now);
    if (this.modeUntil && now > this.modeUntil) this.field('none');
    while (this.pending.length && this.pending[0] <= now) { this.pending.shift(); this.impact(this.w * (0.35 + Math.random() * 0.3), this.h * (0.3 + Math.random() * 0.25)); }

    const g = this.g, w = this.w, h = this.h, cx = w / 2, cy = h * 0.46;
    g.clearRect(0, 0, w, h);
    const f = Math.min(w, h) * 0.9;

    const warp = this.mode === 'none' ? Math.max(0, Math.min(1, (Math.log10(Math.max(1, this.speed)) - 3.5) / 6)) : 0;
    if (warp > 0.02) {
      const R = Math.hypot(w, h) / 2;
      g.lineCap = 'round';
      for (const s of this.streaks) {
        s.r += s.v * dt * (0.2 + warp * 1.6);
        if (s.r > 1) { s.r = 0.03 + Math.random() * 0.1; s.a = Math.random() * Math.PI * 2; }
        const r0 = s.r * R, r1 = r0 * (1 + warp * 0.5 * s.v);
        const ca = Math.cos(s.a), sa = Math.sin(s.a);
        g.strokeStyle = `rgba(240,240,235,${(0.08 + 0.35 * s.r) * warp})`;
        g.lineWidth = 0.6 + s.r * 1.6;
        g.beginPath(); g.moveTo(cx + ca * r0, cy + sa * r0); g.lineTo(cx + ca * r1, cy + sa * r1); g.stroke();
      }
    }

    if (this.mode !== 'none') {
      const rate = this.mode === 'through' ? 75 : this.mode === 'around' ? 26 : 4;
      let n = rate * dt;
      while (n > 0) { if (Math.random() < n) this.spawn(); n -= 1; }
    }
    this.rocks.sort((a, b) => b.z - a.z);
    const keep: Rock[] = [];
    for (const r of this.rocks) {
      r.z -= r.vz * dt; r.x += r.vx * dt; r.y += r.vy * dt; r.rot += r.spin * dt;
      if (r.big && r.z <= 0.55) { this.impact(cx + r.x / r.z * f, cy + r.y / r.z * f); continue; }
      if (r.z < 0.25) continue;
      const sx = cx + (r.x / r.z) * f, sy = cy + (r.y / r.z) * f, rad = (r.s / r.z) * f;
      if (sx < -rad * 2 || sx > w + rad * 2 || sy < -rad * 2 || sy > h + rad * 2) continue;
      keep.push(r);
      const alpha = Math.min(1, Math.max(0, (14 - r.z) / 4));
      if (r.vz > 4 || Math.abs(r.vx) > 1.5) {
        const zb = r.z + r.vz * 0.07;
        const tx = cx + ((r.x - r.vx * 0.07) / zb) * f, ty = cy + ((r.y - r.vy * 0.07) / zb) * f;
        const trail = g.createLinearGradient(tx, ty, sx, sy);
        trail.addColorStop(0, 'rgba(190,175,150,0)');
        trail.addColorStop(1, `rgba(190,175,150,${0.35 * alpha})`);
        g.strokeStyle = trail;
        g.lineWidth = rad * 1.3;
        g.lineCap = 'round';
        g.beginPath(); g.moveTo(tx, ty); g.lineTo(sx, sy); g.stroke();
      }
      this.drawRock(sx, sy, rad, r, alpha);
    }
    this.rocks = keep;

    if (this.dust > 0 && now < this.dustUntil) {
      const n = this.dust * 60 * dt;
      for (let i = 0; i < n; i++) this.sparks.push({ x: w * (0.4 + Math.random() * 0.8), y: -10 - Math.random() * h * 0.3, vx: -500 - Math.random() * 500, vy: 600 + Math.random() * 500, life: 0, max: 1.5, hue: 195, size: 0.8 + Math.random() * 1.8 });
    }
    if (this.sparks.length) {
      g.globalCompositeOperation = 'lighter';
      this.sparks = this.sparks.filter((p) => {
        p.life += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.985; p.vy *= 0.985;
        if (p.life > p.max) return false;
        const a = 1 - p.life / p.max;
        g.strokeStyle = `hsla(${p.hue},100%,${p.hue > 100 ? 85 : 62}%,${a})`;
        g.lineWidth = p.size;
        g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03); g.stroke();
        return true;
      });
      g.globalCompositeOperation = 'source-over';
    }

    if (now < this.flareUntil) {
      const k = (now - this.flareFrom) / (this.flareUntil - this.flareFrom);
      const a = Math.sin(Math.PI * k) * (0.55 + 0.15 * Math.sin(now / 90));
      const grad = g.createRadialGradient(w * 0.92, h * 0.1, 0, w * 0.92, h * 0.1, Math.max(w, h) * 0.9);
      grad.addColorStop(0, `rgba(255,250,230,${a})`);
      grad.addColorStop(0.25, `rgba(255,190,90,${a * 0.6})`);
      grad.addColorStop(1, 'rgba(255,120,40,0)');
      g.fillStyle = grad;
      g.fillRect(0, 0, w, h);
    }

    const hk = (now - this.healFrom) / 1400;
    if (hk >= 0 && hk < 1) {
      const y = hk * h;
      const grad = g.createLinearGradient(0, y - 80, 0, y + 4);
      grad.addColorStop(0, 'rgba(143,185,150,0)');
      grad.addColorStop(1, `rgba(143,185,150,${0.45 * (1 - hk)})`);
      g.fillStyle = grad;
      g.fillRect(0, y - 80, w, 84);
    }
    this.drawConsoles(now);
  }

  private drawRock(x: number, y: number, rad: number, r: Rock, alpha: number): void {
    const g = this.g, n = r.shape.length;
    g.save();
    g.globalAlpha = alpha;
    g.translate(x, y);
    g.rotate(r.rot);
    g.beginPath();
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2, k = r.shape[i] * rad;
      i ? g.lineTo(Math.cos(a) * k, Math.sin(a) * k) : g.moveTo(Math.cos(a) * k, Math.sin(a) * k);
    }
    g.closePath();
    const lx = Math.cos(-r.rot - 2.3) * rad * 0.5, ly = Math.sin(-r.rot - 2.3) * rad * 0.5;
    const grad = g.createRadialGradient(lx, ly, rad * 0.1, 0, 0, rad * 1.1);
    const t = r.tone;
    grad.addColorStop(0, `rgb(${178 * t | 0},${162 * t | 0},${142 * t | 0})`);
    grad.addColorStop(0.55, `rgb(${92 * t | 0},${82 * t | 0},${72 * t | 0})`);
    grad.addColorStop(1, 'rgb(18,16,15)');
    g.fillStyle = grad;
    g.fill();
    if (rad > 6) {
      g.fillStyle = 'rgba(0,0,0,0.28)';
      for (let i = 0; i < 3; i++) {
        const a = r.shape[i] * 7, d = rad * 0.45 * r.shape[(i + 3) % n];
        g.beginPath(); g.arc(Math.cos(a) * d, Math.sin(a) * d, rad * 0.14 * r.shape[(i + 5) % n], 0, Math.PI * 2); g.fill();
      }
    }
    if (r.big) { g.strokeStyle = 'rgba(255,140,80,0.5)'; g.lineWidth = 2; g.stroke(); }
    g.restore();
  }

  private measure(now: number): void {
    const t = this.telemetry();
    const dt = (now - this.lastT) / 1000;
    if (t && this.lastRem >= 0 && dt > 0 && dt < 1) {
      const v = Math.max(0, (this.lastRem - t.remainingKm) / dt);
      this.speed += (v - this.speed) * Math.min(1, dt * 4);
    } else if (!t) {
      this.speed *= Math.max(0, 1 - dt * 3);
    }
    this.lastRem = t ? t.remainingKm : -1;
    this.lastT = now;
    this.tele = t;
  }

  private tele: { remainingKm: number; etaS: number } | null = null;
  private conAt = 0;

  private drawConsoles(now: number): void {
    if (now - this.conAt < 120) return;
    this.conAt = now;
    const r = this.readout, t = this.tele;
    const [v, unit] = speedText(this.speed);
    const flying = !!t && this.speed > 1;
    const status = this.mode !== 'none' ? 'ASTEROID FIELD' : flying ? 'ENGINES · FULL BURN' : r.status;
    const hullCls = r.hull <= 30 ? 'bad' : r.hull <= 60 ? 'warn' : '';
    const healing = now - this.healFrom < 2500;
    const html = `
      <div class="ck-screen">
        <label>Velocity</label>
        <div class="ck-big">${v}<small>${unit}</small></div>
        <div class="ck-bar"><i style="width:${Math.min(100, Math.max(0, (Math.log10(Math.max(1, this.speed)) / 12) * 100)).toFixed(1)}%"></i></div>
      </div>
      <div class="ck-screen ck-split">
        <div><label>To target</label><b>${flying && t ? distText(t.remainingKm) : '—'}</b></div>
        <div><label>ETA</label><b>${flying && t ? `${t.etaS.toFixed(1)} s` : '—'}</b></div>
      </div>
      <div class="ck-screen"><label>Heading</label><b class="ck-tgt">${esc(r.target || '—')}</b></div>`;
    const right = `
      <div class="ck-screen ${hullCls}${healing ? ' heal' : ''}">
        <label>Hull integrity</label>
        <div class="ck-big">${r.hull}<small>%</small></div>
        <div class="ck-bar hull"><i style="width:${r.hull}%"></i></div>
      </div>
      <div class="ck-screen ck-split">
        <div><label>Crew aboard</label><b>${r.crew.toLocaleString('en-US')}</b></div>
        <div><label>Route</label><b>${esc(r.waypoint || '—')}</b></div>
      </div>
      <div class="ck-screen ck-status${this.mode !== 'none' ? ' alert' : ''}"><i class="ck-dot"></i><b>${esc(status)}</b></div>`;
    const key = html + right;
    if (key === this.shown) return;
    this.shown = key;
    this.left.innerHTML = html;
    this.right.innerHTML = right;
  }
}
