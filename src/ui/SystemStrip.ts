import type { CelestialBody } from '../core/CelestialBody';
import { temperatureToRgb } from '../astro/stellar';
import { AU_KM } from '../core/constants';
import { _ } from '../i18n';
import type { UIHost } from './UI';

type RGB = readonly [number, number, number];

const STARLIKE = new Set(['star', 'pulsar', 'blackhole']);
const PLANETLIKE = new Set(['planet', 'dwarf']);
/** beyond this distance from the system's origin the strip gives way (interstellar space) */
const SHOW_WITHIN_KM = 3000 * AU_KM;
/** moons listed under an open planet, the largest first */
const MAX_MOONS = 16;
const SVG = 'http://www.w3.org/2000/svg';

interface Entry { body: CelestialBody; kind: 'star' | 'planet' | 'moon' }

/**
 * The bodies of the current system as a column of small icons along the right edge: its stars,
 * each followed by the planets and dwarf planets around it (circumbinary ones after the pair),
 * and under the selected planet its moons. A click selects, a double click flies there.
 */
export class SystemStrip {
  private readonly el: HTMLElement;
  private readonly tip = Object.assign(document.createElement('div'), { className: 'ss-tip', hidden: true });
  private readonly buttons = new Map<CelestialBody, HTMLButtonElement>();
  private key = '';
  private selected: CelestialBody | null = null;
  private stars: CelestialBody[] = [];
  private at = -Infinity;

  constructor(private readonly host: UIHost) {
    this.el = document.getElementById('system-strip')!;
    this.el.setAttribute('aria-label', _('Sistemdeki gökcisimleri'));
    this.el.after(this.tip);
    this.el.addEventListener('scroll', () => { this.tip.hidden = true; });
  }

  update(now: number): void {
    if (now - this.at < 200) return;
    this.at = now;
    const { universe, camera } = this.host;
    const sys = universe.current;
    const open = this.openPlanet();
    const key = `${sys.id}|${sys.bodies.length}|${open?.id ?? ''}`;
    if (key !== this.key) { this.key = key; this.build(open); }
    // near any of its stars (the members of a wide multiple can be thousands of AU apart)
    let near = false;
    for (const s of this.stars) if (camera.position.distanceTo(s.position) < SHOW_WITHIN_KM) { near = true; break; }
    const far = !near || camera.mode === 'surface';
    const hide = far || this.buttons.size < 2;
    if (this.el.hidden !== hide) { this.el.hidden = hide; this.tip.hidden = true; }
    const sel = this.host.selected;
    if (sel !== this.selected) {
      this.buttons.get(this.selected!)?.classList.remove('selected');
      this.buttons.get(sel!)?.classList.add('selected');
      this.selected = sel;
    }
  }

  /** the planet whose moons are shown: the selected one, or the one the selected moon circles */
  private openPlanet(): CelestialBody | null {
    let b = this.host.selected;
    if (b?.data.type === 'moon') b = planetOf(b);
    return b && PLANETLIKE.has(b.data.type) ? b : null;
  }

  private build(open: CelestialBody | null): void {
    const entries: Entry[] = [];
    for (const r of this.host.universe.current.roots) collect(r, entries, open);
    this.el.replaceChildren();
    this.tip.hidden = true;
    this.buttons.clear();
    this.selected = null;
    this.stars = entries.filter((e) => e.kind === 'star').map((e) => e.body);
    let moons: HTMLElement | null = null;
    entries.forEach((e, i) => {
      if (e.kind === 'star' && i > 0) this.el.append(Object.assign(document.createElement('div'), { className: 'ss-sep' }));
      const btn = this.item(e);
      if (e.kind === 'moon') {
        if (!moons) { moons = Object.assign(document.createElement('div'), { className: 'ss-moons' }); this.el.append(moons); }
        moons.append(btn);
      } else {
        moons = null;
        this.el.append(btn);
      }
      this.buttons.set(e.body, btn);
    });
  }

  private item(e: Entry): HTMLButtonElement {
    const b = e.body;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `ss-item ss-${e.kind}`;
    btn.setAttribute('aria-label', b.name);
    btn.append(icon(e));
    const show = () => this.showTip(btn, b.name);
    btn.addEventListener('pointerenter', show);
    btn.addEventListener('focus', show);
    btn.addEventListener('pointerleave', () => { this.tip.hidden = true; });
    btn.addEventListener('blur', () => { this.tip.hidden = true; });
    btn.addEventListener('click', () => this.host.select(b));
    btn.addEventListener('dblclick', () => this.host.goTo(b));
    return btn;
  }

  /** the name, to the left of the icon (outside the strip, which clips what overflows it) */
  private showTip(btn: HTMLElement, name: string): void {
    const r = btn.getBoundingClientRect();
    const ui = this.tip.offsetParent?.getBoundingClientRect() ?? { left: 0, top: 0, width: window.innerWidth };
    this.tip.textContent = name;
    this.tip.style.top = `${r.top + r.height / 2 - ui.top}px`;
    this.tip.style.right = `${ui.left + ui.width - r.left + 6}px`;
    this.tip.hidden = false;
  }
}

/** Stars in hierarchy order, each followed by its planets (and the open planet's moons) */
function collect(node: CelestialBody, out: Entry[], open: CelestialBody | null): void {
  const t = node.data.type;
  if (t === 'barycenter' && !hasStar(node)) return;
  if (STARLIKE.has(t)) out.push({ body: node, kind: 'star' });
  for (const c of node.children) if (STARLIKE.has(c.data.type) || (c.data.type === 'barycenter' && hasStar(c))) collect(c, out, open);
  for (const p of planetsOf(node)) {
    out.push({ body: p, kind: 'planet' });
    if (p === open) for (const m of moonsOf(p)) out.push({ body: m, kind: 'moon' });
  }
}

function hasStar(b: CelestialBody): boolean {
  return b.children.some((c) => STARLIKE.has(c.data.type) || (c.data.type === 'barycenter' && hasStar(c)));
}

/** planets, then dwarf planets, each by distance; a planet with a big moon hangs under a barycentre (Pluto) */
function planetsOf(node: CelestialBody): CelestialBody[] {
  const found: Array<{ b: CelestialBody; d: number }> = [];
  for (const c of node.children) {
    if (PLANETLIKE.has(c.data.type)) found.push({ b: c, d: semiMajorKm(c) });
    else if (c.data.type === 'barycenter' && !hasStar(c)) {
      for (const g of c.children) if (PLANETLIKE.has(g.data.type)) found.push({ b: g, d: semiMajorKm(c) });
    }
  }
  const rank = (b: CelestialBody) => (b.data.type === 'planet' ? 0 : 1);
  return found.sort((x, y) => rank(x.b) - rank(y.b) || x.d - y.d).map((x) => x.b);
}

function moonsOf(p: CelestialBody): CelestialBody[] {
  const pool = [...p.children];
  if (p.parent?.data.type === 'barycenter') pool.push(...p.parent.children.filter((c) => c !== p));
  return pool
    .filter((c) => c.data.type === 'moon')
    .sort((a, b) => b.data.radius - a.data.radius)
    .slice(0, MAX_MOONS)
    .sort((a, b) => semiMajorKm(a) - semiMajorKm(b));
}

/** orbit size for ordering: the semi-major axis where the elements give one, else today's distance */
function semiMajorKm(b: CelestialBody): number {
  const o = b.data.orbit;
  if (o?.kind === 'simple') return o.a;
  if (o?.kind === 'jpl') return o.a * AU_KM;
  return b.localPosition.length();
}

function planetOf(m: CelestialBody): CelestialBody | null {
  const p = m.parent;
  if (!p) return null;
  if (PLANETLIKE.has(p.data.type)) return p;
  return p.data.type === 'barycenter' ? p.children.find((c) => PLANETLIKE.has(c.data.type)) ?? null : null;
}

function colourOf(b: CelestialBody): RGB {
  const a = b.data.appearance;
  switch (a.kind) {
    case 'star': {
      const [r, g, bl] = temperatureToRgb(a.temperature);
      const m = Math.max(r, g, bl, 1e-3);
      return [r / m, g / m, bl / m];
    }
    case 'pulsar': return [0.75, 0.85, 1.0];
    case 'blackhole': return [0.05, 0.05, 0.06];
    case 'gas': {
      const s = [0, 0, 0];
      for (const c of a.bands) { s[0] += c[0]; s[1] += c[1]; s[2] += c[2]; }
      const n = Math.max(1, a.bands.length);
      return [s[0] / n, s[1] / n, s[2] / n];
    }
    case 'terrestrial': {
      const m = a.landMid ?? a.landLow;
      let c: [number, number, number] = [m[0], m[1], m[2]];
      if (a.ocean && a.seaLevel !== undefined) c = [c[0] * 0.4 + a.ocean[0] * 0.6, c[1] * 0.4 + a.ocean[1] * 0.6, c[2] * 0.4 + a.ocean[2] * 0.6];
      if (a.ice && (a.iceCaps ?? 0) > 0) c = [c[0] * 0.8 + 0.18, c[1] * 0.8 + 0.18, c[2] * 0.8 + 0.18];
      return c;
    }
    default: return [0.6, 0.6, 0.6];
  }
}

/** a dark world (soot, basalt) is lifted to a readable grey of its own hue against the black sky */
function legible(c: RGB): RGB {
  const m = Math.max(c[0], c[1], c[2]);
  if (m >= 0.42) return c;
  if (m < 1e-3) return [0.42, 0.42, 0.42];
  const k = 0.42 / m;
  return [c[0] * k, c[1] * k, c[2] * k];
}

const css = (c: RGB) => `rgb(${Math.round(Math.min(1, c[0]) * 255)} ${Math.round(Math.min(1, c[1]) * 255)} ${Math.round(Math.min(1, c[2]) * 255)})`;

/** disc radius (px): a star fixed, planets and moons on a log scale of their size */
function radiusPx(e: Entry): number {
  if (e.kind === 'star') return 5.5;
  const r = 2 + 1.7 * Math.log10(Math.max(e.body.data.radius, 100) / 300);
  return Math.min(6.5, Math.max(e.kind === 'moon' ? 1.6 : 2.2, r));
}

function icon(e: Entry): SVGSVGElement {
  const b = e.body;
  const r = radiusPx(e);
  const rings = b.data.rings;
  const w = e.kind === 'moon' ? 14 : 24, h = e.kind === 'moon' ? 12 : 18;
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('width', String(w));
  svg.setAttribute('height', String(h));
  svg.setAttribute('viewBox', `${-w / 2} ${-h / 2} ${w} ${h}`);
  svg.setAttribute('aria-hidden', 'true');
  const el = (tag: string, attrs: Record<string, string | number>) => {
    const n = document.createElementNS(SVG, tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, String(v));
    svg.append(n);
    return n;
  };
  const fill = css(e.kind === 'star' ? colourOf(b) : legible(colourOf(b)));
  if (e.kind === 'star') {
    // a hairline circle around the disc tells a star from a planet of the same colour
    el('circle', { r: r + 2.5, fill: 'none', stroke: fill, 'stroke-opacity': 0.55, 'stroke-width': 0.8 });
    el('circle', { r, fill, stroke: b.data.type === 'blackhole' ? 'var(--text-3)' : 'none', 'stroke-width': 0.8 });
    return svg;
  }
  if (rings) {
    // the far half of the ring behind the disc, the near half across it
    const rx = Math.min(w / 2 - 0.5, r * 2.0), ry = rx * 0.32;
    const ring = { fill: 'none', stroke: css(rings.color), 'stroke-opacity': 0.5 + 0.5 * Math.min(1, rings.opacity), 'stroke-width': 1.1, transform: 'rotate(-18)' };
    el('path', { d: `M${-rx} 0A${rx} ${ry} 0 0 1 ${rx} 0`, ...ring });
    el('circle', { r, fill });
    el('path', { d: `M${-rx} 0A${rx} ${ry} 0 0 0 ${rx} 0`, ...ring });
  } else {
    el('circle', { r, fill });
  }
  return svg;
}
