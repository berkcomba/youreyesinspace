import { CHAPTERS, NODES, NODE, chapterOpen, nodeState, type ChapterId, type ExpeditionNode, type NodeState } from './manifest';

const COL = 150;
const ROW = 104;
const GAP = 44;
const HEAD = 72;
const SVG_NS = 'http://www.w3.org/2000/svg';

interface Placed { n: ExpeditionNode; x: number; y: number }
interface Band { id: ChapterId; y0: number; y1: number }

/** Rows by depth inside each chapter, chapters top → bottom (Earth → the horizon). */
function layout(): { placed: Map<string, Placed>; bands: Band[]; width: number } {
  const placed = new Map<string, Placed>();
  const bands: Band[] = [];
  let y = 0;
  let maxCols = 1;
  for (const ch of CHAPTERS) {
    const nodes = NODES.filter((n) => n.chapter === ch.id);
    const depth = new Map<string, number>();
    const d = (n: ExpeditionNode): number => {
      const known = depth.get(n.id);
      if (known !== undefined) return known;
      const inside = n.after.map((a) => NODE.get(a)!).filter((p) => p.chapter === ch.id);
      const v = inside.length ? Math.max(...inside.map(d)) + 1 : 0;
      depth.set(n.id, v);
      return v;
    };
    const rows: ExpeditionNode[][] = [];
    for (const n of nodes) (rows[d(n)] ??= []).push(n);
    const y0 = y;
    maxCols = Math.max(maxCols, ...rows.map((r) => r.length));
    rows.forEach((row, i) => {
      row.forEach((n, j) => placed.set(n.id, { n, x: (j - (row.length - 1) / 2) * COL, y: y0 + HEAD + ROW / 2 + i * ROW }));
    });
    y += HEAD + rows.length * ROW;
    bands.push({ id: ch.id, y0, y1: y });
    y += GAP;
  }
  return { placed, bands, width: Math.max(440, maxCols * COL + 40) };
}

const el = <K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>, parent?: Element): SVGElementTagNameMap[K] => {
  const e = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  parent?.appendChild(e);
  return e;
};

export class CampaignMap {
  readonly root: HTMLDivElement;
  private svg: SVGSVGElement;
  private world: SVGGElement;
  private lay = layout();
  private view = { x: 0, y: 0, k: 1 };
  private selected: string | null = null;
  private drawn = '';
  onSelect: (id: string) => void = () => {};

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'xp-map-canvas';
    this.svg = el('svg', { class: 'xp-map-svg' });
    this.world = el('g', {}, this.svg);
    this.root.appendChild(this.svg);
    parent.appendChild(this.root);
    this.bindPanZoom();
  }

  /** Redraw with the campaign's progress. */
  render(discovered: ReadonlySet<string>, assisted: ReadonlySet<string>, current: string | null = null): void {
    const key = `${[...discovered].join()}|${[...assisted].join()}|${current}|${this.selected}`;
    if (key === this.drawn) return;   // a rebuild restarts the halo animations
    this.drawn = key;
    const g = this.world;
    g.replaceChildren();
    const { placed, bands, width } = this.lay;
    // chapter bands
    for (const b of bands) {
      const ch = CHAPTERS.find((c) => c.id === b.id)!;
      const open = chapterOpen(b.id, discovered);
      const band = el('g', { class: `xp-band${open ? ' open' : ' fog'}` }, g);
      const left = -width / 2;
      el('rect', { x: left, y: b.y0, width, height: b.y1 - b.y0, rx: 2 }, band);
      const i = CHAPTERS.indexOf(ch);
      const t = el('text', { x: left + 14, y: b.y0 + 26, class: 'xp-band-kicker' }, band);
      t.textContent = `CHAPTER ${['I', 'II', 'III', 'IV', 'V'][i]} · ${ch.scale.toUpperCase()}`;
      const tt = el('text', { x: left + 14, y: b.y0 + 50, class: 'xp-band-title' }, band);
      const total = NODES.filter((n) => n.chapter === ch.id);
      const got = total.filter((n) => discovered.has(n.id)).length;
      tt.textContent = `${ch.title}  ${got}/${total.length}`;
    }
    // edges
    const edges = el('g', { class: 'xp-edges' }, g);
    for (const p of placed.values()) {
      for (const a of p.n.after) {
        const q = placed.get(a)!;
        const sa = discovered.has(a), sb = discovered.has(p.n.id);
        const st = nodeState(p.n, discovered, assisted);
        const cls = sa && sb ? 'done' : sa && st === 'reachable' ? 'frontier' : 'locked';
        const my = (q.y + p.y) / 2;
        el('path', { d: `M${q.x},${q.y} C${q.x},${my} ${p.x},${my} ${p.x},${p.y}`, class: `xp-edge ${cls}${this.selected === p.n.id && sa ? ' sel' : ''}` }, edges);
      }
    }
    // nodes
    for (const p of placed.values()) {
      const st: NodeState = nodeState(p.n, discovered, assisted);
      const node = el('g', { class: `xp-node ${st}${this.selected === p.n.id ? ' sel' : ''}${current === p.n.id ? ' current' : ''}`, transform: `translate(${p.x},${p.y})`, tabindex: 0, role: 'button', 'aria-label': `${p.n.title}, ${st}` }, g);
      if (st === 'reachable') el('circle', { r: 21, class: 'xp-node-halo' }, node);
      el('circle', { r: p.n.kind === 'OBJECT' ? 11 : 0, class: 'xp-node-dot' }, node);
      if (p.n.kind !== 'OBJECT') el('rect', { x: -10, y: -10, width: 20, height: 20, transform: p.n.kind === 'REGION' ? 'rotate(45)' : '', rx: p.n.kind === 'CONCEPT' ? 10 : 1, class: 'xp-node-dot' }, node);
      if (st === 'assisted') { const a = el('text', { y: 4, class: 'xp-node-mark' }, node); a.textContent = 'A'; }
      if (st === 'discovered') el('path', { d: 'M-4.5,0.5 L-1,4 L5,-3.5', class: 'xp-node-check' }, node);
      const label = el('text', { y: 32, class: 'xp-node-label' }, node);
      label.textContent = p.n.title.replace(' — Home', '');
      node.addEventListener('click', (e) => { e.stopPropagation(); this.select(p.n.id); });
      node.addEventListener('keydown', (e) => { if ((e as KeyboardEvent).key === 'Enter') this.select(p.n.id); });
    }
  }

  select(id: string | null): void {
    this.selected = id;
    this.world.querySelectorAll('.xp-node.sel').forEach((n) => n.classList.remove('sel'));
    if (id) this.onSelect(id);
  }

  /** Centre the view on a node (or the chapter band) */
  focus(id: string, k = 1, tries = 20): void {
    const p = this.lay.placed.get(id);
    if (!p) return;
    const r = this.root.getBoundingClientRect();
    if (!r.height) { if (tries > 0) requestAnimationFrame(() => this.focus(id, k, tries - 1)); return; }
    this.view.k = k;
    this.view.x = r.width / 2 - p.x * k;
    this.view.y = r.height / 2 - p.y * k;
    this.apply(true);
  }

  fitChapter(ch: ChapterId): void {
    const b = this.lay.bands.find((x) => x.id === ch)!;
    const r = this.root.getBoundingClientRect();
    const h = b.y1 - b.y0;
    // long chapters keep a readable scale and start at the top; the rest scrolls
    const k = Math.max(0.35, Math.min(1.1, (r.width - 40) / this.lay.width, Math.max(0.7, (r.height - 20) / h)));
    this.view.k = k;
    this.view.x = r.width / 2;
    this.view.y = h * k <= r.height - 20 ? r.height / 2 - ((b.y0 + b.y1) / 2) * k : 10 - b.y0 * k;
    this.apply(true);
  }

  private apply(animate = false): void {
    this.world.style.transition = animate && !matchMedia('(prefers-reduced-motion: reduce)').matches ? 'transform 0.6s cubic-bezier(.2,.7,.2,1)' : 'none';
    this.world.style.transform = `translate(${this.view.x}px, ${this.view.y}px) scale(${this.view.k})`;
  }

  private bindPanZoom(): void {
    let drag: { x: number; y: number; vx: number; vy: number; moved: boolean } | null = null;
    this.svg.addEventListener('pointerdown', (e) => {
      drag = { x: e.clientX, y: e.clientY, vx: this.view.x, vy: this.view.y, moved: false };
    });
    window.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;
      this.view.x = drag.vx + dx;
      this.view.y = drag.vy + dy;
      this.apply();
    });
    window.addEventListener('pointerup', () => { drag = null; });
    this.svg.addEventListener('wheel', (e) => {
      e.preventDefault();
      // plain wheel scrolls the tree; pinch (ctrlKey) or ⌘/Ctrl + wheel zooms
      if (!e.ctrlKey && !e.metaKey) {
        this.view.x -= e.deltaX;
        this.view.y -= e.deltaY;
        this.apply();
        return;
      }
      const r = this.root.getBoundingClientRect();
      const mx = e.clientX - r.left, my = e.clientY - r.top;
      const k = Math.min(2.2, Math.max(0.3, this.view.k * Math.exp(-e.deltaY * (Math.abs(e.deltaY) < 40 ? 0.01 : 0.0015))));
      this.view.x = mx - ((mx - this.view.x) * k) / this.view.k;
      this.view.y = my - ((my - this.view.y) * k) / this.view.k;
      this.view.k = k;
      this.apply();
    }, { passive: false });
  }
}
