/**
 * The crew cabin: a cutaway of the expedition ship with a seat for everyone aboard. The ship
 * grows with the crew (shuttle → worldship), so a room of thousands is a hull full of tiny
 * figures rather than a list. Names are shown in full for a small crew; for a big one only the
 * top navigators and the latest arrivals get a label. Canvas: thousands of seats stay cheap.
 */

interface ShipClass { name: string; seats: number }
const CLASSES: ShipClass[] = [
  { name: 'Shuttle', seats: 24 },
  { name: 'Cruiser', seats: 120 },
  { name: 'Carrier', seats: 500 },
  { name: 'Ark', seats: 2000 },
  { name: 'Colony ship', seats: 5000 },
  { name: 'Worldship', seats: 10000 },
];

/** muted suit colours in the site palette */
const SUITS = ['#f0f0eb', '#bd9b6c', '#8fb996', '#c98a7e', '#b9c2c9', '#9fb4c7', '#d8c7a3', '#a8a0b8'];
const ARRIVAL_MS = 7000;
const MAX_CALLOUTS = 6;
/** seats at least this big (px) carry their owner's name */
const NAMED_CELL = 24;
/** room above and below the hull for name tags */
const LABEL_BAND = 34;

function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}

function shuffled(n: number, seed: number): Int32Array {
  const a = new Int32Array(n);
  for (let i = 0; i < n; i++) a[i] = i;
  let s = seed >>> 0;
  for (let i = n - 1; i > 0; i--) {
    s = (Math.imul(s ^ (s >>> 15), 0x2c1b3c6d) + 0x6d2b79f5) >>> 0;
    const j = s % (i + 1);
    const t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

function fit(g: CanvasRenderingContext2D, text: string, w: number): string {
  if (g.measureText(text).width <= w) return text;
  let t = text;
  while (t.length > 1 && g.measureText(`${t}…`).width > w) t = t.slice(0, -1);
  return `${t}…`;
}

const esc = (s: string): string => s.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
const fmt = (n: number): string => n.toLocaleString('en-US');

interface Layout {
  w: number; h: number;
  tail: number; body: number; nose: number; mid: number; hh: number;
  ix0: number; iy0: number; iw: number; ih: number;
  rows: number; cols: number; cw: number; ch: number; deck: number;
  order: Int32Array;
}

export interface CabinState {
  /** names in boarding order (the first ones get the first seats) */
  aboard: readonly string[];
  /** everyone connected: seats beyond the named ones are filled anonymously */
  crew: number;
  captain: string;
  ship: string;
  leaders: readonly string[];
}

export class Cabin {
  readonly el: HTMLDivElement;
  private canvas: HTMLCanvasElement;
  private g: CanvasRenderingContext2D;
  private cap: HTMLDivElement;
  private layer = document.createElement('canvas');
  private st: CabinState = { aboard: [], crew: 0, captain: '', ship: '', leaders: [] };
  private cls = CLASSES[0];
  private L: Layout | null = null;
  private dirty = true;
  private seen = new Set<string>();
  private arrivals = new Map<string, number>();
  private pops: Array<{ seat: number; at: number }> = [];
  private lastCrew = 0;
  private font = 'sans-serif';
  private dpr = 1;

  constructor() {
    this.el = document.createElement('div');
    this.el.className = 'cab';
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'cab-canvas';
    this.g = this.canvas.getContext('2d')!;
    this.cap = document.createElement('div');
    this.cap.className = 'cab-cap';
    this.el.append(this.canvas, this.cap);
    const css = getComputedStyle(document.documentElement);
    this.font = css.getPropertyValue('--font').trim() || this.font;
    new ResizeObserver(() => { this.dirty = true; }).observe(this.el);
    requestAnimationFrame((t) => this.frame(t));
  }

  render(s: CabinState): void {
    const now = performance.now();
    const first = this.seen.size === 0 && this.st.crew === 0;
    for (const n of s.aboard) {
      if (this.seen.has(n)) continue;
      this.seen.add(n);
      if (!first) this.arrivals.set(n, now);
    }
    const cls = CLASSES.find((c) => c.seats >= s.crew) ?? CLASSES[CLASSES.length - 1];
    if (cls !== this.cls) { this.cls = cls; this.L = null; this.dirty = true; }
    if (!first && s.crew > this.lastCrew && this.L) {
      const from = Math.min(this.lastCrew, cls.seats), to = Math.min(s.crew, cls.seats);
      for (let i = from; i < to && this.pops.length < 80; i++) this.pops.push({ seat: i, at: now + (i - from) * 25 });
    }
    this.lastCrew = s.crew;
    this.st = s;
    this.dirty = true;
    const next = CLASSES[CLASSES.indexOf(cls) + 1];
    const filled = Math.min(s.crew, cls.seats);
    this.cap.innerHTML = `<b>${esc(s.ship)}</b><span>${cls.name} class · ${fmt(filled)} of ${fmt(cls.seats)} seats taken${s.crew > cls.seats ? ` · +${fmt(s.crew - cls.seats)} more aboard` : next ? ` · a bigger ship at ${fmt(cls.seats + 1)} crew` : ''}</span>`;
  }

  /* ---------------- layout ---------------- */

  private layout(w: number, h: number): Layout {
    const L0 = w * 0.94;
    const tail = w * 0.06, nose = tail + L0, body = nose - L0 * 0.16, mid = h * 0.5;
    const hh = Math.max(20, Math.min(h / 2 - LABEL_BAND, L0 * 0.17));
    const ix0 = tail + L0 * 0.05, ix1 = body - L0 * 0.015;
    const iy0 = mid - hh * 0.8, iy1 = mid + hh * 0.8;
    const iw = ix1 - ix0, ih = iy1 - iy0;
    const seats = this.cls.seats;
    const rows = Math.max(2, Math.round(Math.sqrt((seats * ih) / iw)));
    const cols = Math.ceil(seats / rows);
    const deck = rows <= 4 ? 1 : Math.ceil(rows / Math.min(8, Math.ceil(rows / 5)));
    // small ships fill from the front; big ones fill scattered, like a stadium filling up
    const order = seats <= 120 ? Int32Array.from({ length: rows * cols }, (_, i) => (i % rows) * cols + (cols - 1 - Math.floor(i / rows))) : shuffled(rows * cols, seats);
    return { w, h, tail, body, nose, mid, hh, ix0, iy0, iw, ih, rows, cols, cw: iw / cols, ch: ih / rows, deck, order };
  }

  private seatXY(L: Layout, seat: number): [number, number] {
    const k = L.order[seat], r = Math.floor(k / L.cols), c = k % L.cols;
    return [L.ix0 + (c + 0.5) * L.cw, L.iy0 + (r + 0.5) * L.ch];
  }

  /* ---------------- drawing ---------------- */

  private frame(now: number): void {
    requestAnimationFrame((t) => this.frame(t));
    if (!this.el.isConnected || this.el.offsetParent === null) return;
    const w = this.el.clientWidth, h = this.canvas.clientHeight;
    if (w < 10 || h < 10) return;
    const dpr = Math.min(2, devicePixelRatio || 1);
    if (this.canvas.width !== Math.round(w * dpr) || this.canvas.height !== Math.round(h * dpr) || dpr !== this.dpr) {
      this.dpr = dpr;
      this.canvas.width = this.layer.width = Math.round(w * dpr);
      this.canvas.height = this.layer.height = Math.round(h * dpr);
      this.L = null;
      this.dirty = true;
    }
    if (!this.L || this.L.w !== w || this.L.h !== h) { this.L = this.layout(w, h); this.dirty = true; }
    const L = this.L;
    if (this.dirty) { this.dirty = false; this.drawStatic(L); }
    const g = this.g;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, this.canvas.width, this.canvas.height);
    g.drawImage(this.layer, 0, 0);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.drawEngines(L, now);
    this.drawPops(L, now);
    this.drawCallouts(L, now);
  }

  private hullPath(g: CanvasRenderingContext2D, L: Layout): void {
    const { tail, body, nose, mid, hh } = L;
    g.beginPath();
    g.moveTo(tail, mid - hh * 0.92);
    g.lineTo(body, mid - hh);
    g.bezierCurveTo(body + (nose - body) * 0.6, mid - hh, nose, mid - hh * 0.35, nose, mid);
    g.bezierCurveTo(nose, mid + hh * 0.35, body + (nose - body) * 0.6, mid + hh, body, mid + hh);
    g.lineTo(tail, mid + hh * 0.92);
    g.quadraticCurveTo(tail - hh * 0.12, mid, tail, mid - hh * 0.92);
    g.closePath();
  }

  private drawStatic(L: Layout): void {
    const g = this.layer.getContext('2d')!;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    g.clearRect(0, 0, L.w, L.h);
    const { tail, body, nose, mid, hh } = L;

    // fins and engine housings
    g.fillStyle = '#14171c';
    g.strokeStyle = '#30353b';
    g.lineWidth = 1.5;
    for (const s of [-1, 1]) {
      g.beginPath();
      g.moveTo(tail + hh * 0.9, mid + s * hh * 0.95);
      g.lineTo(tail + hh * 0.15, mid + s * hh * 1.3);
      g.lineTo(tail - hh * 0.15, mid + s * hh * 1.3);
      g.lineTo(tail + hh * 0.05, mid + s * hh * 0.9);
      g.closePath(); g.fill(); g.stroke();
      g.fillStyle = '#1f2329';
      g.fillRect(tail - hh * 0.32, mid + s * hh * 0.45 - hh * 0.17, hh * 0.36, hh * 0.34);
      g.strokeRect(tail - hh * 0.32, mid + s * hh * 0.45 - hh * 0.17, hh * 0.36, hh * 0.34);
      g.fillStyle = '#14171c';
    }

    // hull
    this.hullPath(g, L);
    const hg = g.createLinearGradient(0, mid - hh, 0, mid + hh);
    hg.addColorStop(0, '#2a2f36'); hg.addColorStop(0.5, '#1b1e23'); hg.addColorStop(1, '#101215');
    g.fillStyle = hg;
    g.fill();
    g.strokeStyle = '#454b52';
    g.lineWidth = 1.5;
    g.stroke();

    // canopy
    g.beginPath();
    const cx0 = body + (nose - body) * 0.12;
    g.moveTo(cx0, mid - hh * 0.5);
    g.bezierCurveTo(body + (nose - body) * 0.7, mid - hh * 0.5, nose - (nose - body) * 0.06, mid - hh * 0.15, nose - (nose - body) * 0.06, mid);
    g.bezierCurveTo(nose - (nose - body) * 0.06, mid + hh * 0.15, body + (nose - body) * 0.7, mid + hh * 0.5, cx0, mid + hh * 0.5);
    g.closePath();
    const cg = g.createLinearGradient(cx0, mid - hh * 0.5, nose, mid + hh * 0.5);
    cg.addColorStop(0, 'rgba(240,240,235,0.16)'); cg.addColorStop(1, 'rgba(189,155,108,0.06)');
    g.fillStyle = cg;
    g.fill();
    g.strokeStyle = 'rgba(240,240,235,0.25)';
    g.stroke();

    // interior
    g.fillStyle = '#0c0e12';
    g.fillRect(L.ix0, L.iy0, L.iw, L.ih);
    g.strokeStyle = 'rgba(189,155,108,0.45)';
    g.setLineDash([6, 5]);
    g.strokeRect(L.ix0 - 0.5, L.iy0 - 0.5, L.iw + 1, L.ih + 1);
    g.setLineDash([]);
    g.fillStyle = '#262b31';
    for (let r = L.deck; r < L.rows; r += L.deck) g.fillRect(L.ix0, L.iy0 + r * L.ch - 1, L.iw, 2);

    // registration
    g.fillStyle = 'rgba(240,240,235,0.32)';
    g.font = `500 ${Math.max(10, hh * 0.09)}px ${this.font}`;
    g.textBaseline = 'middle';
    g.fillText(`YEIS · ${this.st.ship.toUpperCase()}`, L.ix0, mid + hh * 0.9);

    // seats
    const s = this.st;
    const seats = this.cls.seats;
    const filled = Math.min(s.crew, seats);
    const named = Math.min(s.aboard.length, filled);
    const cell = Math.min(L.cw, L.ch);
    const showNames = cell >= NAMED_CELL;
    const fig = showNames ? cell * 0.7 : cell;
    const fs = Math.max(9, Math.min(13, cell * 0.22));
    const leaders = new Set(s.leaders.slice(0, 5));
    g.font = `${fs}px ${this.font}`;
    g.textAlign = 'center';
    for (let i = 0; i < seats; i++) {
      const [x, y0] = this.seatXY(L, i);
      const y = showNames ? y0 + cell * 0.14 : y0;
      if (i >= filled) { this.emptySeat(g, x, y, fig); continue; }
      const nick = i < named ? s.aboard[i] : '';
      const hv = nick ? hash(nick) : hash(`seat${i}`);
      this.figure(g, x, y, fig, SUITS[hv % SUITS.length], leaders.has(nick));
      if (showNames && nick) {
        g.fillStyle = leaders.has(nick) ? '#bd9b6c' : 'rgba(240,240,235,0.8)';
        g.fillText(fit(g, nick, L.cw - 4), x, y0 - L.ch / 2 + fs * 0.75);
      }
    }
    g.textAlign = 'start';

    // captain at the helm
    const hx = body + (nose - body) * 0.32, hy = mid + hh * 0.08;
    this.figure(g, hx, hy, Math.min(hh * 0.5, 64), '#bd9b6c', true);
    g.font = `500 ${Math.max(10, Math.min(13, hh * 0.08))}px ${this.font}`;
    g.textAlign = 'center';
    g.fillStyle = '#bd9b6c';
    g.fillText('CAPTAIN', hx, mid + hh * 0.42);
    g.fillStyle = 'rgba(240,240,235,0.85)';
    g.fillText(s.captain, hx, mid - hh * 0.3);
    g.textAlign = 'start';
  }

  private emptySeat(g: CanvasRenderingContext2D, x: number, y: number, cell: number): void {
    if (cell >= 8) {
      const s = Math.min(cell, 64);
      g.fillStyle = 'rgba(240,240,235,0.07)';
      g.fillRect(x - s * 0.22, y - s * 0.05, s * 0.44, s * 0.3);
      g.fillRect(x - s * 0.26, y - s * 0.32, s * 0.08, s * 0.57);
    } else {
      g.fillStyle = 'rgba(240,240,235,0.08)';
      g.fillRect(x - 0.6, y - 0.6, 1.2, 1.2);
    }
  }

  /** a seated crew member: helmeted figure when there is room, a head and shoulders, or a dot */
  private figure(g: CanvasRenderingContext2D, x: number, y: number, cell: number, suit: string, star: boolean): void {
    const s = Math.min(cell, 64);
    if (s >= 20) {
      g.fillStyle = '#262b31';
      g.fillRect(x - s * 0.26, y - s * 0.34, s * 0.09, s * 0.6);
      g.fillStyle = suit;
      g.beginPath(); g.roundRect(x - s * 0.17, y - s * 0.12, s * 0.32, s * 0.36, s * 0.1); g.fill();
      g.beginPath(); g.arc(x, y - s * 0.26, s * 0.16, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(12,14,18,0.75)';
      g.beginPath(); g.ellipse(x + s * 0.05, y - s * 0.27, s * 0.09, s * 0.075, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(240,240,235,0.55)';
      g.beginPath(); g.arc(x + s * 0.08, y - s * 0.3, s * 0.025, 0, Math.PI * 2); g.fill();
    } else if (s >= 7) {
      g.fillStyle = suit;
      g.beginPath(); g.arc(x, y - s * 0.16, s * 0.2, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.ellipse(x, y + s * 0.22, s * 0.28, s * 0.18, 0, Math.PI, 0); g.fill();
    } else {
      g.fillStyle = suit;
      g.beginPath(); g.arc(x, y, Math.max(0.9, s * 0.34), 0, Math.PI * 2); g.fill();
    }
    if (star) {
      g.strokeStyle = '#bd9b6c';
      g.lineWidth = Math.max(1, s * 0.04);
      g.beginPath(); g.arc(x, s >= 7 ? y - s * 0.05 : y, Math.max(3, s * 0.45), 0, Math.PI * 2); g.stroke();
    }
  }

  private drawEngines(L: Layout, now: number): void {
    const g = this.g, { tail, mid, hh } = L;
    for (const s of [-1, 1]) {
      const f = 0.85 + 0.15 * Math.sin(now / 45 + s * 2) + 0.05 * Math.random();
      const x = tail - hh * 0.32, y = mid + s * hh * 0.45, len = hh * 0.9 * f;
      const gr = g.createRadialGradient(x, y, 0, x, y, len);
      gr.addColorStop(0, 'rgba(255,246,225,0.95)');
      gr.addColorStop(0.25, 'rgba(232,200,150,0.55)');
      gr.addColorStop(1, 'rgba(189,155,108,0)');
      g.fillStyle = gr;
      g.beginPath(); g.ellipse(x, y, len, hh * 0.15, 0, Math.PI / 2, Math.PI * 1.5); g.fill();
    }
    const blink = Math.floor(now / 700) % 2 === 0;
    g.fillStyle = blink ? '#c98a7e' : 'rgba(201,138,126,0.25)';
    g.beginPath(); g.arc(L.body, mid - hh * 1.0 - 3, 3, 0, Math.PI * 2); g.fill();
    g.fillStyle = !blink ? '#8fb996' : 'rgba(143,185,150,0.25)';
    g.beginPath(); g.arc(L.body, mid + hh * 1.0 + 3, 3, 0, Math.PI * 2); g.fill();
  }

  private drawPops(L: Layout, now: number): void {
    const g = this.g;
    this.pops = this.pops.filter((p) => now - p.at < 900);
    for (const p of this.pops) {
      const k = (now - p.at) / 900;
      if (k < 0) continue;
      const [x, y] = this.seatXY(L, p.seat);
      const r = Math.max(4, Math.min(L.cw, L.ch) * 0.5) * (0.6 + k * 1.6);
      g.strokeStyle = `rgba(189,155,108,${0.9 * (1 - k)})`;
      g.lineWidth = 1.5;
      g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.stroke();
    }
  }

  /** labels for the latest arrivals and the top navigators when the seats are too small for names */
  private drawCallouts(L: Layout, now: number): void {
    if (Math.min(L.cw, L.ch) >= NAMED_CELL) return;
    const s = this.st, filled = Math.min(s.crew, this.cls.seats), named = Math.min(s.aboard.length, filled);
    const index = new Map<string, number>();
    for (let i = 0; i < named; i++) index.set(s.aboard[i], i);
    const tags: Array<{ nick: string; seat: number; gold: boolean; a: number }> = [];
    for (const nick of s.leaders.slice(0, 3)) { const i = index.get(nick); if (i !== undefined) tags.push({ nick, seat: i, gold: true, a: 1 }); }
    const fresh = [...this.arrivals].filter(([, t]) => now - t < ARRIVAL_MS).sort((a, b) => b[1] - a[1]).slice(0, MAX_CALLOUTS);
    for (const [n, t] of this.arrivals) if (now - t >= ARRIVAL_MS) this.arrivals.delete(n);
    for (const [nick, t] of fresh) {
      const i = index.get(nick);
      if (i === undefined || tags.some((x) => x.nick === nick)) continue;
      const age = now - t;
      tags.push({ nick, seat: i, gold: false, a: Math.min(1, age / 250, (ARRIVAL_MS - age) / 600) });
    }
    const g = this.g;
    g.font = `500 12px ${this.font}`;
    g.textBaseline = 'middle';
    const placed: Array<[number, number, number, number]> = [];
    for (const t of tags) {
      const [x, y] = this.seatXY(L, t.seat);
      const label = t.gold ? `★ ${t.nick}` : t.nick;
      const tw = g.measureText(label).width + 14, th = 20;
      // above the hull for the top half, below it for the bottom half; nudge to avoid overlaps
      const up = y < L.mid;
      let ly = up ? L.mid - L.hh - LABEL_BAND / 2 : L.mid + L.hh + LABEL_BAND / 2;
      let lx = Math.max(4, Math.min(L.w - tw - 4, x - tw / 2));
      for (let k = 0; k < 12; k++) {
        const hit = placed.find(([px, py, pw, ph]) => lx < px + pw + 6 && px < lx + tw + 6 && Math.abs(py - ly) < ph);
        if (!hit) break;
        lx = hit[0] + hit[2] + 8;
        if (lx + tw > L.w - 4) { lx = Math.max(4, x - tw / 2); ly += up ? -th - 4 : th + 4; }
      }
      placed.push([lx, ly, tw, th]);
      g.globalAlpha = Math.max(0, t.a);
      g.strokeStyle = t.gold ? 'rgba(189,155,108,0.7)' : 'rgba(240,240,235,0.35)';
      g.lineWidth = 1;
      g.beginPath(); g.moveTo(x, y); g.lineTo(lx + tw / 2, up ? ly + th / 2 : ly - th / 2); g.stroke();
      g.fillStyle = 'rgba(12,14,18,0.9)';
      g.fillRect(lx, ly - th / 2, tw, th);
      g.strokeStyle = t.gold ? '#bd9b6c' : 'rgba(240,240,235,0.2)';
      g.strokeRect(lx + 0.5, ly - th / 2 + 0.5, tw - 1, th - 1);
      g.fillStyle = t.gold ? '#bd9b6c' : '#f0f0eb';
      g.fillText(label, lx + 7, ly + 0.5);
      g.beginPath(); g.arc(x, y, 3, 0, Math.PI * 2); g.fillStyle = t.gold ? '#bd9b6c' : '#f0f0eb'; g.fill();
    }
    g.globalAlpha = 1;
  }
}

/** keeps boarding order; `known` caps memory for very large crews */
export function addAboard(list: string[], names: readonly string[], known = 5000): void {
  for (const n of names) if (n && !list.includes(n)) list.push(n);
  if (list.length > known) list.splice(known);
}
