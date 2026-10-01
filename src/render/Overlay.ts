import { Vector3, type PerspectiveCamera } from 'three';
import type { CelestialBody } from '../core/CelestialBody';
import type { BodyView } from './BodyRenderer';
import type { NamedStarScreen } from './StarPoints';

export interface StarSelectionScreen {
  name: string;
  /** unit direction from camera */
  dir: Vector3;
  /** 'star' (default) or 'galaxy' – changes the reticle colour/size */
  kind?: 'star' | 'galaxy';
  /** apparent radius in px (galaxies) so the reticle hugs the object */
  radiusPx?: number;
}

export interface ScreenItem {
  body: CelestialBody;
  x: number;
  y: number;
  radiusPx: number;
  visible: boolean;
  labelShown: boolean;
}

const TYPE_COLORS: Record<string, string> = {
  star: 'rgba(255, 220, 150, 0.95)',
  planet: 'rgba(140, 200, 255, 0.95)',
  dwarf: 'rgba(255, 190, 120, 0.95)',
  moon: 'rgba(170, 235, 190, 0.9)',
  asteroid: 'rgba(200, 200, 200, 0.85)',
  comet: 'rgba(210, 170, 255, 0.9)',
  barycenter: 'rgba(255,255,255,0.7)',
  spacecraft: 'rgba(120, 255, 235, 0.95)',
  blackhole: 'rgba(225, 130, 255, 0.95)',
};

const _v = new Vector3();

/** 2D canvas overlay: markers, labels, selection reticle, star names. */
export class Overlay {
  readonly ctx: CanvasRenderingContext2D;
  readonly items: ScreenItem[] = [];
  width = 0;
  height = 0;
  dpr = 1;
  showLabels = true;
  showMarkers = true;
  showStarNames = false;
  showGalaxyNames = true;
  hoverId: string | null = null;
  /** draw a centre crosshair (free roam / pointer lock) */
  crosshair = false;

  constructor(readonly canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
  }

  resize(w: number, h: number, dpr: number): void {
    this.width = w;
    this.height = h;
    this.dpr = dpr;
    this.canvas.width = Math.floor(w * dpr);
    this.canvas.height = Math.floor(h * dpr);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
  }

  /** Project & draw. Returns screen items for picking. */
  draw(
    views: BodyView[], camera: PerspectiveCamera, selected: CelestialBody | null,
    namedStars: NamedStarScreen[], selectedStar: StarSelectionScreen | null, uiVisible: boolean,
    namedGalaxies: NamedStarScreen[] = [],
    blackHoles: NamedStarScreen[] = [],
  ): ScreenItem[] {
    const ctx = this.ctx;
    const W = this.width, H = this.height;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    this.items.length = 0;

    // Project all bodies
    const byId = new Map<string, ScreenItem>();
    for (const v of views) {
      _v.copy(v.relPos).project(camera);
      const inFront = _v.z < 1 && _v.z > -1;
      const x = (_v.x * 0.5 + 0.5) * W;
      const y = (-_v.y * 0.5 + 0.5) * H;
      const visible = inFront && x > -50 && x < W + 50 && y > -50 && y < H + 50;
      const item: ScreenItem = { body: v.body, x, y, radiusPx: v.apparentRadiusPx, visible, labelShown: false };
      this.items.push(item);
      byId.set(v.body.id, item);
    }

    if (!uiVisible) return this.items;

    // Bodies large enough on screen hide the sky labels behind them (ground, planet discs)
    const occluders = views.filter((v) => v.apparentRadiusPx > 40 && v.meshVisible);
    const occluded = (dir: Vector3): boolean => {
      for (const v of occluders) {
        const d = v.distance;
        if (d <= v.body.radius) return true;
        const cosA = dir.dot(v.relPos) / d;
        if (cosA <= 0) continue;
        const sinR = v.body.radius / d;
        if (cosA * cosA > 1 - sinR * sinR) return true;
      }
      return false;
    };

    ctx.font = '500 12px Inter, ui-sans-serif, system-ui, sans-serif';
    ctx.textBaseline = 'middle';

    // Star names (behind everything). Brightest first; later labels skip occupied spots.
    if (this.showStarNames) {
      ctx.font = '400 11px Inter, ui-sans-serif, system-ui, sans-serif';
      const taken: Array<{ x: number; y: number; w: number }> = [];
      const sortedStars = [...namedStars].sort((a, b) => (a.index === 0 ? -99 : a.mag) - (b.index === 0 ? -99 : b.mag));
      for (const s of sortedStars) {
        if (occluders.length && occluded(s.dir)) continue;
        _v.copy(s.dir).multiplyScalar(1e11).project(camera);
        if (_v.z > 1 || _v.z < -1) continue;
        const x = (_v.x * 0.5 + 0.5) * W;
        const y = (-_v.y * 0.5 + 0.5) * H;
        if (x < 0 || x > W || y < 0 || y > H) continue;
        const w = ctx.measureText(s.name).width + 10;
        let clash = false;
        for (const t of taken) {
          if (Math.abs(t.y - y) < 14 && x + 7 < t.x + t.w && x + 7 + w > t.x) { clash = true; break; }
        }
        if (clash) continue;
        taken.push({ x: x + 7, y, w });
        // fade the faintest labels so dense fields don't turn into a wall of text
        const fade = s.index === 0 ? 1 : Math.max(0.45, Math.min(1, 1 - (s.mag - 1.5) / 4));
        ctx.fillStyle = s.index === 0 ? 'rgba(255, 225, 160, 0.85)' : s.index < 0 ? `rgba(195, 208, 235, ${0.7 * fade})` : `rgba(205, 215, 235, ${0.75 * fade})`;
        ctx.fillText(s.name, x + 7, y - 7);
      }
      ctx.font = '500 12px Inter, ui-sans-serif, system-ui, sans-serif';
    }

    // Galaxy names
    if (this.showGalaxyNames && namedGalaxies.length) {
      ctx.font = 'italic 400 11px Inter, ui-sans-serif, system-ui, sans-serif';
      for (const s of namedGalaxies) {
        if (selectedStar && selectedStar.kind === 'galaxy' && selectedStar.name === s.name) continue;
        if (occluders.length && occluded(s.dir)) continue;
        _v.copy(s.dir).multiplyScalar(1e11).project(camera);
        if (_v.z > 1 || _v.z < -1) continue;
        const x = (_v.x * 0.5 + 0.5) * W;
        const y = (-_v.y * 0.5 + 0.5) * H;
        if (x < 0 || x > W || y < 0 || y > H) continue;
        ctx.fillStyle = 'rgba(215, 190, 255, 0.6)';
        ctx.fillText(s.name, x + 7, y + 9);
      }
      ctx.font = '500 12px Inter, ui-sans-serif, system-ui, sans-serif';
    }

    // Black holes in other systems: ring marker + name
    if (this.showMarkers && blackHoles.length) {
      for (const s of blackHoles) {
        if (selectedStar && selectedStar.name === s.name) continue;
        if (occluders.length && occluded(s.dir)) continue;
        _v.copy(s.dir).multiplyScalar(1e11).project(camera);
        if (_v.z > 1 || _v.z < -1) continue;
        const x = (_v.x * 0.5 + 0.5) * W;
        const y = (-_v.y * 0.5 + 0.5) * H;
        if (x < 0 || x > W || y < 0 || y > H) continue;
        ctx.strokeStyle = TYPE_COLORS.blackhole;
        ctx.globalAlpha = 0.8;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.moveTo(x + 1.5, y);
        ctx.arc(x, y, 1.5, 0, Math.PI * 2);
        ctx.stroke();
        if (this.showLabels) {
          ctx.fillStyle = TYPE_COLORS.blackhole;
          ctx.fillText(s.name, x + 10, y - 6);
        }
        ctx.globalAlpha = 1;
      }
    }

    // Selected catalogue star / galaxy: reticle + name
    if (selectedStar) {
      _v.copy(selectedStar.dir).multiplyScalar(1e11).project(camera);
      if (_v.z < 1 && _v.z > -1) {
        const x = (_v.x * 0.5 + 0.5) * W;
        const y = (-_v.y * 0.5 + 0.5) * H;
        if (x > -40 && x < W + 40 && y > -40 && y < H + 40) {
          const isGal = selectedStar.kind === 'galaxy';
          const r = Math.min(Math.max(H, W), Math.max(12, (selectedStar.radiusPx ?? 0) + 8)), g = r * 0.45;
          ctx.strokeStyle = isGal ? 'rgba(215, 190, 255, 0.95)' : 'rgba(255, 220, 150, 0.95)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
            ctx.moveTo(x + sx * r, y + sy * (r - g));
            ctx.lineTo(x + sx * r, y + sy * r);
            ctx.lineTo(x + sx * (r - g), y + sy * r);
          }
          ctx.stroke();
          ctx.fillStyle = 'rgba(255,255,255,0.98)';
          ctx.fillText(selectedStar.name, x + r + 8, y - r * 0.35);
        }
      }
    }

    // Decide label visibility (declutter)
    const occupied: Array<{ x: number; y: number; w: number; h: number }> = [];
    const sorted = [...this.items].sort((a, b) => {
      // bigger / more important first
      const ia = a.body === selected ? 1e9 : a.radiusPx * 10 + (5 - a.body.depth) * 100 + Math.log10(a.body.radius);
      const ib = b.body === selected ? 1e9 : b.radiusPx * 10 + (5 - b.body.depth) * 100 + Math.log10(b.body.radius);
      return ib - ia;
    });

    for (const it of sorted) {
      if (!it.visible) continue;
      const b = it.body;
      const isSel = b === selected;
      const parentItem = b.parent ? byId.get(b.parent.id) : undefined;

      // Moons: hide when their parent system is unresolved and they sit within the parent's neighbourhood
      if ((b.data.type === 'moon' || b.data.type === 'spacecraft') && parentItem && !isSel) {
        const d = Math.hypot(it.x - parentItem.x, it.y - parentItem.y);
        if (d < 26 + parentItem.radiusPx * 0.4 && it.radiusPx < 2) continue;
      }
      // Small bodies far away: too faint to be meaningfully labelled
      const minor = b.data.type === 'moon' || b.data.type === 'asteroid' || b.data.type === 'comet';
      if (!isSel && minor && it.radiusPx < 0.003) continue;
      // Camera very close: skip marker/label (we're on the surface)
      if (it.radiusPx > Math.max(W, H)) continue;

      const color = TYPE_COLORS[b.data.type] ?? 'white';
      const label = b.name;
      const tw = ctx.measureText(label).width;
      const offset = Math.max(it.radiusPx, 5) + 8;
      const lx = it.x + offset, ly = it.y - offset * 0.35;
      const box = { x: lx - 2, y: ly - 8, w: tw + 4, h: 16 };
      const collides = occupied.some((o) => box.x < o.x + o.w && box.x + box.w > o.x && box.y < o.y + o.h && box.y + box.h > o.y);

      // Marker
      if (this.showMarkers && (it.radiusPx < 6 || isSel)) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.globalAlpha = it.radiusPx < 6 ? 0.85 : 0.5;
        if (isSel) {
          const r = Math.max(it.radiusPx + 8, 12);
          ctx.strokeStyle = 'rgba(82, 215, 255, 0.95)';
          ctx.lineWidth = 1.5;
          const g = r * 0.45;
          ctx.beginPath();
          // corner brackets
          const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
          for (const [sx, sy] of corners) {
            ctx.moveTo(it.x + sx * r, it.y + sy * (r - g));
            ctx.lineTo(it.x + sx * r, it.y + sy * r);
            ctx.lineTo(it.x + sx * (r - g), it.y + sy * r);
          }
          ctx.stroke();
        } else if (b.data.type === 'star') {
          // no marker on the sun
        } else if (b.data.type === 'blackhole') {
          // ring with a dot
          ctx.beginPath();
          ctx.arc(it.x, it.y, 6, 0, Math.PI * 2);
          ctx.moveTo(it.x + 1.5, it.y);
          ctx.arc(it.x, it.y, 1.5, 0, Math.PI * 2);
          ctx.stroke();
        } else if (b.data.type === 'spacecraft') {
          // diamond
          ctx.beginPath();
          ctx.moveTo(it.x, it.y - 5);
          ctx.lineTo(it.x + 5, it.y);
          ctx.lineTo(it.x, it.y + 5);
          ctx.lineTo(it.x - 5, it.y);
          ctx.closePath();
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.arc(it.x, it.y, 4, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }

      // Label
      if (this.showLabels && (!collides || isSel)) {
        ctx.fillStyle = isSel ? 'rgba(255,255,255,0.98)' : color;
        ctx.globalAlpha = isSel ? 1 : b.data.type === 'moon' ? 0.8 : 0.92;
        ctx.fillText(label, lx, ly);
        ctx.globalAlpha = 1;
        occupied.push(box);
        it.labelShown = true;
      }
    }

    // Hover hint
    if (this.hoverId) {
      const it = byId.get(this.hoverId);
      if (it && it.visible) {
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(it.x, it.y, Math.max(it.radiusPx + 6, 9), 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // Free-roam crosshair (pointer locked: clicks pick under the centre)
    if (this.crosshair) {
      const cx = W / 2, cy = H / 2;
      ctx.strokeStyle = 'rgba(82, 215, 255, 0.85)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(cx - 12, cy); ctx.lineTo(cx - 4, cy);
      ctx.moveTo(cx + 4, cy); ctx.lineTo(cx + 12, cy);
      ctx.moveTo(cx, cy - 12); ctx.lineTo(cx, cy - 4);
      ctx.moveTo(cx, cy + 4); ctx.lineTo(cx, cy + 12);
      ctx.stroke();
      ctx.fillStyle = 'rgba(82, 215, 255, 0.9)';
      ctx.fillRect(cx - 0.75, cy - 0.75, 1.5, 1.5);
    }
    return this.items;
  }

  /** Pick nearest body to screen point (px). */
  pick(x: number, y: number, maxDist = 22): CelestialBody | null {
    let best: CelestialBody | null = null;
    let bestD = Infinity;
    for (const it of this.items) {
      if (!it.visible) continue;
      const d = Math.hypot(it.x - x, it.y - y);
      const reach = Math.max(maxDist, it.radiusPx);
      if (d < reach) {
        // prefer smaller (closer / more specific) targets when nested
        const score = d - (it.radiusPx < 6 ? 6 : 0);
        if (score < bestD) {
          bestD = score;
          best = it.body;
        }
      }
    }
    return best;
  }
}
