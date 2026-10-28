import { Vector3, type PerspectiveCamera } from 'three';
import type { CelestialBody } from '../core/CelestialBody';
import type { BodyView } from './BodyRenderer';
import type { NamedStarScreen } from './StarPoints';
import type { LandmarkScreen } from './LandmarkSprites';
import { AU_KM } from '../core/constants';
import { fmtScaleDistance } from '../ui/format';

export interface StarSelectionScreen {
  name: string;
  /** unit direction from camera */
  dir: Vector3;
  /** 'star' (default), 'galaxy' or 'landmark' – changes the reticle colour/size */
  kind?: 'star' | 'galaxy' | 'landmark';
  /** apparent radius in px (galaxies) so the reticle hugs the object */
  radiusPx?: number;
  /** distance from the camera (km), appended to the label */
  distKm?: number;
}

/** A labelled point on a body's surface (guided tours) */
export interface SurfacePinScreen {
  /** position relative to the camera (km) */
  dir: Vector3;
  label: string;
  /** fade in / out (0..1) */
  alpha: number;
  /** the feature's outline on the surface, relative to the camera; null where it faces away */
  ring: Array<Vector3 | null> | null;
}

/** The Sun seen from elsewhere: a marker with its distance, or a compass arrow when off-screen */
export interface SunMarkerScreen {
  /** unit direction from the camera */
  dir: Vector3;
  /** "Sun · 4.2 ly" */
  label: string;
  /** the Sun is the current selection: the reticle labels it, so only the off-screen compass is drawn */
  selected?: boolean;
}

export interface ScreenItem {
  body: CelestialBody;
  x: number;
  y: number;
  radiusPx: number;
  /** camera distance (km) */
  distance: number;
  visible: boolean;
  labelShown: boolean;
  /** label text box when drawn (clicking the name selects the body) */
  labelBox: { x: number; y: number; w: number; h: number } | null;
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

const LANDMARK_COLORS: Record<string, string> = {
  nebula: 'rgba(255, 150, 175, 0.9)',
  cluster: 'rgba(255, 235, 190, 0.9)',
  remnant: 'rgba(170, 240, 235, 0.9)',
  star: 'rgba(225, 230, 255, 0.9)',
  pulsar: 'rgba(150, 230, 255, 0.95)',
  planetary: 'rgba(160, 245, 225, 0.9)',
  globular: 'rgba(255, 225, 170, 0.9)',
};

/** Muted brass — the one accent colour of the interface, used only for the selected object. */
const SELECTION_COLOR = 'rgba(189, 155, 108, 0.95)';

const SUN_COLOR = 'rgba(255, 225, 160, 0.9)';
/** bodies farther than this (km) carry their distance in the label: "Mars · 1.2 AU" */
const BODY_DIST_LABEL_KM = 0.01 * AU_KM;
/** A drawn sky label: clicking the text selects the object even when its dot is sub-pixel */
export interface LabelHit {
  kind: 'star' | 'galaxy' | 'landmark' | 'blackhole';
  /** catalogue / galaxy / landmark index; -1 for generated stars and black holes */
  index: number;
  name: string;
  /** star id for generated stars */
  id?: string;
  x: number; y: number; w: number; h: number;
}


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
  /** append the camera distance to labels: "Mars · 1.2 AU", "Sirius · 8.6 ly" */
  showDistances = false;
  /** labels drawn in the last frame (for click / hover hit-testing) */
  private readonly labelHits: LabelHit[] = [];
  /** star names that won a spot last frame: they keep priority so declutter does not flicker */
  private shownStars = new Set<string>();
  private shownStarsNext = new Set<string>();
  showGalaxyNames = true;
  /** procedural star labels in green (matches the point tint of the same setting) */
  highlightProcedural = false;
  hoverId: string | null = null;
  /** draw a centre crosshair (free roam / pointer lock) */
  crosshair = false;
  /** clean view: no markers, labels, names or reticle at all (the crosshair stays) */
  clean = false;
  /** event scene playing: no finder reticle around the subject the camera is composed on */
  cinematic = false;
  /**
   * A guided tour is playing: only these body ids (the step's subject, its primary and moons,
   * everything the narration refers to) keep their markers and labels; the sky names (stars,
   * galaxies, landmarks, other black holes) rest so the shot is not papered with tags.
   */
  scope: Set<string> | null = null;
  /** where the sun marker / compass was last drawn (click target), screen px */
  private sunHit: { x: number; y: number; w: number; h: number } | null = null;

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
    landmarks: LandmarkScreen[] = [],
    pin: SurfacePinScreen | null = null,
    sun: SunMarkerScreen | null = null,
    /** standing on `body`: its ground hides everything below the local horizon (`up`) */
    ground: { body: CelestialBody; up: Vector3 } | null = null,
  ): ScreenItem[] {
    const ctx = this.ctx;
    const W = this.width, H = this.height;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    this.items.length = 0;
    this.labelHits.length = 0;
    this.sunHit = null;

    // Project all bodies
    const byId = new Map<string, ScreenItem>();
    for (const v of views) {
      _v.copy(v.relPos).project(camera);
      const inFront = _v.z < 1 && _v.z > -1;
      const x = (_v.x * 0.5 + 0.5) * W;
      const y = (-_v.y * 0.5 + 0.5) * H;
      const visible = inFront && !v.body.hidden && !v.body.filtered && x > -50 && x < W + 50 && y > -50 && y < H + 50;
      const item: ScreenItem = { body: v.body, x, y, radiusPx: v.apparentRadiusPx, distance: v.distance, visible, labelShown: false, labelBox: null };
      this.items.push(item);
      byId.set(v.body.id, item);
    }

    if (!uiVisible) return this.items;
    ctx.font = '500 12px Inter, ui-sans-serif, system-ui, sans-serif';
    ctx.textBaseline = 'middle';
    if (this.clean) {
      // clean view: only the selection keeps its reticle (and name), so a click still answers
      if (selectedStar) this.drawStarReticle(selectedStar, camera);
      const it = selected ? byId.get(selected.id) : undefined;
      if (it && it.visible && it.radiusPx <= Math.max(W, H) && !(this.cinematic && it.radiusPx >= 6)) {
        ctx.globalAlpha = it.radiusPx < 6 ? 0.85 : 0.5;
        this.drawBodyReticle(it);
        ctx.globalAlpha = 1;
        const offset = Math.max(it.radiusPx, 5) + 8;
        ctx.fillStyle = 'rgba(255,255,255,0.98)';
        ctx.fillText(it.distance > BODY_DIST_LABEL_KM ? this.withDist(selected!.name, it.distance) : selected!.name, it.x + offset, it.y - offset * 0.35);
      }
      this.drawCrosshair();
      return this.items;
    }

    // Bodies large enough on screen hide the sky labels behind them (ground, planet discs)
    const occluders = views.filter((v) => v.apparentRadiusPx > 40 && v.meshVisible && v.body !== ground?.body);
    const anyOccluder = occluders.length > 0 || ground !== null;
    const occluded = (dir: Vector3, beyond = Infinity): boolean => {
      if (ground && dir.dot(ground.up) < -0.01) return true;
      for (const v of occluders) {
        const d = v.distance;
        if (d >= beyond) continue; // the occluder itself, or something behind the body in question
        if (d <= v.body.radius) return true;
        const cosA = dir.dot(v.relPos) / d;
        if (cosA <= 0) continue;
        const sinR = v.body.radius / d;
        if (cosA * cosA > 1 - sinR * sinR) return true;
      }
      return false;
    };
    const viewOf = new Map<CelestialBody, BodyView>();
    for (const v of views) viewOf.set(v.body, v);

    ctx.font = '500 12px Inter, ui-sans-serif, system-ui, sans-serif';
    ctx.textBaseline = 'middle';

    // The sun marker's label gets its spot first; star and landmark labels keep clear of it
    const sunBox = sun && (this.showMarkers || this.showLabels) ? this.sunLabelBox(sun, camera) : null;

    // Star names (behind everything). Brightest first; later labels skip occupied spots.
    // Landmarks (the Sun and famous stars, far from home) are shown with the markers even when
    // star names are off: they are the only way to find the way around the galaxy.
    // Generated-star names (entries with an id) are governed by their own setting upstream, so they
    // draw even when catalogue star names are off.
    const scope = this.scope;
    const anyForced = !this.showStarNames && namedStars.some((s) => (s.landmark && this.showMarkers) || s.id !== undefined);
    if (!scope && (this.showStarNames || anyForced)) {
      ctx.font = '400 11px Inter, ui-sans-serif, system-ui, sans-serif';
      const taken: Array<{ x: number; y: number; w: number }> = sunBox ? [sunBox] : [];
      const shown = this.shownStars;
      const rank = (s: NamedStarScreen): number => (s.index === 0 ? -99 : s.mag - (shown.has(s.name) ? 0.5 : 0));
      const sortedStars = [...namedStars].sort((a, b) => rank(a) - rank(b));
      const next = this.shownStarsNext;
      next.clear();
      for (const s of sortedStars) {
        if (!this.showStarNames && !(s.landmark && this.showMarkers) && s.id === undefined) continue;
        if (selectedStar && selectedStar.kind === 'star' && selectedStar.name === s.name) continue;
        if (anyOccluder && occluded(s.dir)) continue;
        _v.copy(s.dir).multiplyScalar(1e11).project(camera);
        if (_v.z > 1 || _v.z < -1) continue;
        const x = (_v.x * 0.5 + 0.5) * W;
        const y = (-_v.y * 0.5 + 0.5) * H;
        if (x < 0 || x > W || y < 0 || y > H) continue;
        const label = this.withDist(s.name, s.distKm);
        const w = ctx.measureText(label).width + 10;
        let clash = false;
        for (const t of taken) {
          if (Math.abs(t.y - y) < 14 && x + 7 < t.x + t.w && x + 7 + w > t.x) { clash = true; break; }
        }
        if (clash) continue;
        taken.push({ x: x + 7, y, w });
        next.add(s.name);
        this.labelHits.push({ kind: 'star', index: s.index, name: s.name, id: s.id, x: x + 7, y: y - 14, w, h: 14 });
        // fade the faintest labels so dense fields don't turn into a wall of text
        const fade = s.index === 0 || s.landmark ? 1 : Math.max(0.45, Math.min(1, 1 - (s.mag - 1.5) / 4));
        ctx.fillStyle = s.index === 0 ? 'rgba(255, 225, 160, 0.85)'
          : s.index < 0 ? (this.highlightProcedural ? `rgba(120, 255, 160, ${0.85 * fade})` : `rgba(195, 208, 235, ${0.7 * fade})`)
          : `rgba(205, 215, 235, ${0.75 * fade})`;
        ctx.globalAlpha = s.alpha ?? 1;
        if (s.landmark) {
          // the star itself is invisible from here: give the label a small ring to point at
          ctx.strokeStyle = s.index === 0 ? 'rgba(255, 225, 160, 0.85)' : 'rgba(205, 215, 235, 0.7)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(x, y, 3.5, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.fillText(label, x + 7, y - 7);
        ctx.globalAlpha = 1;
      }
      this.shownStarsNext = shown;
      this.shownStars = next;
      ctx.font = '500 12px Inter, ui-sans-serif, system-ui, sans-serif';
    }

    // Galaxy names
    if (!scope && this.showGalaxyNames && namedGalaxies.length) {
      ctx.font = 'italic 400 11px Inter, ui-sans-serif, system-ui, sans-serif';
      for (const s of namedGalaxies) {
        if (selectedStar && selectedStar.kind === 'galaxy' && selectedStar.name === s.name) continue;
        if (anyOccluder && occluded(s.dir)) continue;
        _v.copy(s.dir).multiplyScalar(1e11).project(camera);
        if (_v.z > 1 || _v.z < -1) continue;
        const x = (_v.x * 0.5 + 0.5) * W;
        const y = (-_v.y * 0.5 + 0.5) * H;
        if (x < 0 || x > W || y < 0 || y > H) continue;
        ctx.fillStyle = 'rgba(215, 190, 255, 0.6)';
        const glabel = this.withDist(s.name, s.distKm);
        ctx.fillText(glabel, x + 7, y + 9);
        this.labelHits.push({ kind: 'galaxy', index: s.index, name: s.name, x: x + 7, y: y + 2, w: ctx.measureText(glabel).width, h: 14 });
      }
      ctx.font = '500 12px Inter, ui-sans-serif, system-ui, sans-serif';
    }

    // Deep-sky landmarks (nebulae, clusters, remnants, record stars): dashed ring + name
    if (!scope && (this.showMarkers || this.showLabels) && landmarks.length) {
      ctx.font = '400 11px Inter, ui-sans-serif, system-ui, sans-serif';
      const taken: Array<{ x: number; y: number; w: number }> = sunBox ? [sunBox] : [];
      for (const s of landmarks) {
        if (selectedStar && selectedStar.kind === 'landmark' && selectedStar.name === s.name) continue;
        if (anyOccluder && occluded(s.dir)) continue;
        _v.copy(s.dir).multiplyScalar(1e11).project(camera);
        if (_v.z > 1 || _v.z < -1) continue;
        const x = (_v.x * 0.5 + 0.5) * W;
        const y = (-_v.y * 0.5 + 0.5) * H;
        if (x < -20 || x > W + 20 || y < -20 || y > H + 20) continue;
        const r = Math.min(Math.max(6, s.radiusPx), Math.max(W, H));
        if (r > H * 0.6) continue; // we're inside / on top of it
        const color = LANDMARK_COLORS[s.kind] ?? 'white';
        if (this.showMarkers) {
          ctx.strokeStyle = color;
          ctx.globalAlpha = s.undiscovered ? 0.5 : 0.75;
          ctx.lineWidth = 1;
          // undiscovered generated objects: a sparse dotted ring, until the visitor has been there
          ctx.setLineDash(s.undiscovered ? [1, 4] : s.kind === 'star' || s.kind === 'pulsar' ? [] : [3, 3]);
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.globalAlpha = 1;
        }
        if (this.showLabels) {
          const label = this.withDist(s.undiscovered ? `◇ ${s.name}` : s.name, s.distKm);
          const w = ctx.measureText(label).width + 10;
          const lx = x + r * 0.71 + 6, ly = y - r * 0.71 - 6;
          let clash = false;
          for (const t of taken) {
            if (Math.abs(t.y - ly) < 14 && lx < t.x + t.w && lx + w > t.x) { clash = true; break; }
          }
          if (clash) continue;
          taken.push({ x: lx, y: ly, w });
          this.labelHits.push({ kind: 'landmark', index: s.index, name: s.name, x: lx, y: ly - 7, w, h: 14 });
          ctx.fillStyle = color;
          if (s.undiscovered) ctx.globalAlpha = 0.7;
          ctx.fillText(label, lx, ly);
          ctx.globalAlpha = 1;
        }
      }
      ctx.font = '500 12px Inter, ui-sans-serif, system-ui, sans-serif';
    }

    // Black holes in other systems: ring marker + name
    if (!scope && this.showMarkers && blackHoles.length) {
      for (const s of blackHoles) {
        if (selectedStar && selectedStar.name === s.name) continue;
        if (anyOccluder && occluded(s.dir)) continue;
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
          const blabel = this.withDist(s.name, s.distKm);
          ctx.fillText(blabel, x + 10, y - 6);
          this.labelHits.push({ kind: 'blackhole', index: -1, name: s.name, x: x + 10, y: y - 13, w: ctx.measureText(blabel).width, h: 14 });
        }
        ctx.globalAlpha = 1;
      }
    }

    // The Sun from afar: ring + "Sun · distance" on the sky, or a compass arrow when it is off-screen
    if (sun && (this.showMarkers || this.showLabels)) this.drawSun(sun, camera);

    // Selected catalogue star / galaxy: reticle + name
    if (selectedStar) this.drawStarReticle(selectedStar, camera);

    // Decide label visibility (declutter)
    const occupied: Array<{ x: number; y: number; w: number; h: number }> = [];
    const sorted = [...this.items].sort((a, b) => {
      // bigger / more important first
      const ia = a.body === selected ? 1e9 : a.radiusPx * 10 + (5 - a.body.depth) * 100 + Math.log10(Math.max(a.body.radius, 1));
      const ib = b.body === selected ? 1e9 : b.radiusPx * 10 + (5 - b.body.depth) * 100 + Math.log10(Math.max(b.body.radius, 1));
      return ib - ia;
    });

    for (const it of sorted) {
      if (!it.visible) continue;
      const b = it.body;
      const isSel = b === selected;
      // guided tour: only what the step is about carries a tag
      if (scope && !isSel && !scope.has(b.id)) continue;
      const parentItem = b.parent ? byId.get(b.parent.id) : undefined;

      // Moons: hide when their parent system is unresolved and they sit within the parent's neighbourhood
      if ((b.data.type === 'moon' || b.data.type === 'spacecraft') && parentItem && !isSel) {
        const d = Math.hypot(it.x - parentItem.x, it.y - parentItem.y);
        // event spacecraft (sampled ephemerides) keep their label right down to the planet's limb;
        // landers sit on the disc itself: once the planet is resolved, they are hidden only when
        // on its far side (the occlusion test below), not for being near its centre
        const kind = b.data.orbit?.kind;
        const keep = kind === 'ephemeris' ? 8 : kind === 'surface' ? (parentItem.radiusPx < 8 ? 26 : 0) : 26 + parentItem.radiusPx * 0.4;
        if (d < keep && it.radiusPx < 2) continue;
      }
      // A barycentre inside a system (Pluto–Charon): its cross only once the pair is resolved apart
      if (b.data.type === 'barycenter' && b.parent && !isSel) {
        const prim = b.children[0] ? byId.get(b.children[0].id) : undefined;
        if (!prim || Math.hypot(it.x - prim.x, it.y - prim.y) < 10 + prim.radiusPx) continue;
      }
      // Small bodies far away: too faint to be meaningfully labelled
      const minor = b.data.type === 'moon' || b.data.type === 'asteroid' || b.data.type === 'comet';
      if (!isSel && minor && it.radiusPx < 0.003) continue;
      // Unresolved bodies behind a planet disc in the foreground: no marker through the planet
      if (!isSel && it.radiusPx < 6 && anyOccluder) {
        const v = viewOf.get(b);
        if (v && occluded(_v.copy(v.relPos).multiplyScalar(1 / Math.max(v.distance, 1e-9)), v.distance)) continue;
      }
      // Camera very close: skip marker/label (we're on the surface)
      if (it.radiusPx > Math.max(W, H)) continue;
      // The home star far behind us is labelled by the sun marker (with its distance) instead
      if (sun && b.id === 'sun' && !isSel) continue;

      const color = TYPE_COLORS[b.data.type] ?? 'white';
      const label = it.distance > BODY_DIST_LABEL_KM ? this.withDist(b.name, it.distance) : b.name;
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
        if (isSel && this.cinematic && it.radiusPx >= 6) {
          // a composed shot: the resolved subject needs no reticle
        } else if (isSel) {
          this.drawBodyReticle(it);
        } else if (b.data.type === 'star') {
          // no marker on the sun
        } else if (b.data.type === 'blackhole') {
          // ring with a dot
          ctx.beginPath();
          ctx.arc(it.x, it.y, 6, 0, Math.PI * 2);
          ctx.moveTo(it.x + 1.5, it.y);
          ctx.arc(it.x, it.y, 1.5, 0, Math.PI * 2);
          ctx.stroke();
        } else if (b.data.type === 'barycenter') {
          // thin cross: the (empty) centre of mass of a binary
          ctx.beginPath();
          ctx.moveTo(it.x - 6, it.y); ctx.lineTo(it.x + 6, it.y);
          ctx.moveTo(it.x, it.y - 6); ctx.lineTo(it.x, it.y + 6);
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
        it.labelBox = box;
      }
    }

    // Tour surface pin: a dot on the feature, a leader line and the feature's name
    if (pin?.ring) {
      ctx.globalAlpha = 0.85 * Math.max(0, Math.min(1, pin.alpha));
      ctx.strokeStyle = SELECTION_COLOR;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 5]);
      ctx.beginPath();
      let pen = false;
      for (const p of pin.ring) {
        if (p) _v.copy(p).project(camera);
        if (!p || _v.z >= 1 || _v.z <= -1) { pen = false; continue; }
        const x = (_v.x * 0.5 + 0.5) * W, y = (-_v.y * 0.5 + 0.5) * H;
        if (pen) ctx.lineTo(x, y); else ctx.moveTo(x, y);
        pen = true;
      }
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }
    if (pin) {
      _v.copy(pin.dir).project(camera);
      if (_v.z < 1 && _v.z > -1) {
        const x = (_v.x * 0.5 + 0.5) * W;
        const y = (-_v.y * 0.5 + 0.5) * H;
        if (x > -20 && x < W + 20 && y > -20 && y < H + 20) {
          // lead the label away from the nearest screen edge so it stays readable
          const sx = x > W * 0.6 ? -1 : 1;
          const sy = y < H * 0.35 ? 1 : -1;
          const lx = x + sx * 34, ly = y + sy * 30;
          ctx.font = '500 13px Inter, ui-sans-serif, system-ui, sans-serif';
          const tw = ctx.measureText(pin.label).width;
          const ex = lx + sx * (tw + 8);
          ctx.globalAlpha = Math.max(0, Math.min(1, pin.alpha));
          ctx.strokeStyle = SELECTION_COLOR;
          ctx.fillStyle = SELECTION_COLOR;
          ctx.lineWidth = 1.25;
          ctx.beginPath();
          ctx.arc(x, y, 7, 0, Math.PI * 2);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(x, y, 2.2, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.moveTo(x + sx * 7 * Math.SQRT1_2, y + sy * 7 * Math.SQRT1_2);
          ctx.lineTo(lx, ly);
          ctx.lineTo(ex, ly);
          ctx.stroke();
          ctx.textAlign = sx > 0 ? 'left' : 'right';
          ctx.fillStyle = 'rgba(255, 250, 240, 0.98)';
          ctx.fillText(pin.label, lx + sx * 4, ly - 9);
          ctx.globalAlpha = 1;
          ctx.textAlign = 'left';
          ctx.font = '500 12px Inter, ui-sans-serif, system-ui, sans-serif';
        }
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

    this.drawCrosshair();
    return this.items;
  }

  /** Finder-chart reticle of the selected body: a thin circle with four short ticks */
  private drawBodyReticle(it: ScreenItem): void {
    const ctx = this.ctx;
    const r = Math.max(it.radiusPx + 8, 12);
    ctx.strokeStyle = SELECTION_COLOR;
    ctx.lineWidth = 1;
    const t = 5;
    ctx.beginPath();
    ctx.arc(it.x, it.y, r, 0, Math.PI * 2);
    ctx.moveTo(it.x - r - t, it.y); ctx.lineTo(it.x - r, it.y);
    ctx.moveTo(it.x + r, it.y); ctx.lineTo(it.x + r + t, it.y);
    ctx.moveTo(it.x, it.y - r - t); ctx.lineTo(it.x, it.y - r);
    ctx.moveTo(it.x, it.y + r); ctx.lineTo(it.x, it.y + r + t);
    ctx.stroke();
  }

  /** Corner-bracket reticle + name of the selected sky object (star, galaxy, landmark) */
  private drawStarReticle(sel: StarSelectionScreen, camera: PerspectiveCamera): void {
    const ctx = this.ctx;
    const W = this.width, H = this.height;
    _v.copy(sel.dir).multiplyScalar(1e11).project(camera);
    if (!(_v.z < 1 && _v.z > -1)) return;
    const x = (_v.x * 0.5 + 0.5) * W;
    const y = (-_v.y * 0.5 + 0.5) * H;
    if (!(x > -40 && x < W + 40 && y > -40 && y < H + 40)) return;
    const isGal = sel.kind === 'galaxy';
    const r = Math.min(Math.max(H, W), Math.max(12, (sel.radiusPx ?? 0) + 8)), g = r * 0.45;
    ctx.strokeStyle = isGal ? 'rgba(215, 190, 255, 0.95)' : sel.kind === 'landmark' ? 'rgba(255, 170, 190, 0.95)' : 'rgba(255, 220, 150, 0.95)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      ctx.moveTo(x + sx * r, y + sy * (r - g));
      ctx.lineTo(x + sx * r, y + sy * r);
      ctx.lineTo(x + sx * (r - g), y + sy * r);
    }
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.98)';
    ctx.fillText(this.withDist(sel.name, sel.distKm), x + r + 8, y - r * 0.35);
  }

  /** Free-roam crosshair (pointer locked: clicks pick under the centre) */
  private drawCrosshair(): void {
    if (!this.crosshair) return;
    const ctx = this.ctx;
    const cx = this.width / 2, cy = this.height / 2;
    ctx.globalAlpha = 1;
    ctx.strokeStyle = 'rgba(240, 240, 235, 0.7)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - 12, cy); ctx.lineTo(cx - 4, cy);
    ctx.moveTo(cx + 4, cy); ctx.lineTo(cx + 12, cy);
    ctx.moveTo(cx, cy - 12); ctx.lineTo(cx, cy - 4);
    ctx.moveTo(cx, cy + 4); ctx.lineTo(cx, cy + 12);
    ctx.stroke();
    ctx.fillStyle = 'rgba(240, 240, 235, 0.8)';
    ctx.fillRect(cx - 0.75, cy - 0.75, 1.5, 1.5);
  }

  /** Screen position of the Sun, or null when it is off-screen */
  private sunScreenPos(sun: SunMarkerScreen, camera: PerspectiveCamera): { x: number; y: number } | null {
    _v.copy(sun.dir).multiplyScalar(1e11).project(camera);
    const x = (_v.x * 0.5 + 0.5) * this.width;
    const y = (-_v.y * 0.5 + 0.5) * this.height;
    return _v.z < 1 && _v.z > -1 && x >= 0 && x <= this.width && y >= 0 && y <= this.height ? { x, y } : null;
  }

  /** The strip the sun label occupies (same geometry as the star-name `taken` entries) */
  private sunLabelBox(sun: SunMarkerScreen, camera: PerspectiveCamera): { x: number; y: number; w: number } | null {
    const p = this.sunScreenPos(sun, camera);
    if (!p) return null;
    this.ctx.font = '500 11px Inter, ui-sans-serif, system-ui, sans-serif';
    const w = this.ctx.measureText(sun.label).width + 10;
    this.ctx.font = '500 12px Inter, ui-sans-serif, system-ui, sans-serif';
    return { x: p.x + 9, y: p.y - 8, w };
  }

  private drawSun(sun: SunMarkerScreen, camera: PerspectiveCamera): void {
    const ctx = this.ctx;
    const W = this.width, H = this.height;
    ctx.font = '500 11px Inter, ui-sans-serif, system-ui, sans-serif';
    const p = this.sunScreenPos(sun, camera);
    if (p && sun.selected) { ctx.font = '500 12px Inter, ui-sans-serif, system-ui, sans-serif'; return; }
    if (p) {
      // on the sky: a small ring and the label
      const { x, y } = p;
      ctx.strokeStyle = SUN_COLOR;
      ctx.fillStyle = SUN_COLOR;
      ctx.lineWidth = 1;
      if (this.showMarkers) {
        ctx.beginPath();
        ctx.arc(x, y, 4.5, 0, Math.PI * 2);
        ctx.moveTo(x + 1.2, y);
        ctx.arc(x, y, 1.2, 0, Math.PI * 2);
        ctx.stroke();
      }
      if (this.showLabels) ctx.fillText(sun.label, x + 9, y - 8);
      const w = ctx.measureText(sun.label).width + 12;
      this.sunHit = { x: x - 10, y: y - 18, w: w + 10, h: 28 };
    } else {
      // off-screen: a compass at the bottom centre, pointing the way to turn
      _v.copy(sun.dir).transformDirection(camera.matrixWorldInverse);
      const ang = Math.hypot(_v.x, _v.y) < 1e-4 ? 0 : Math.atan2(-_v.y, _v.x); // screen y runs down
      const cx = W / 2, cy = H - 78, R = 15;
      ctx.strokeStyle = 'rgba(255, 225, 160, 0.55)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.stroke();
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(ang);
      ctx.fillStyle = SUN_COLOR;
      ctx.beginPath();
      ctx.moveTo(R - 3, 0);
      ctx.lineTo(-3, -5);
      ctx.lineTo(-1, 0);
      ctx.lineTo(-3, 5);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      ctx.textAlign = 'center';
      ctx.fillStyle = SUN_COLOR;
      ctx.fillText(sun.label, cx, cy + R + 12);
      ctx.textAlign = 'left';
      const w = Math.max(2 * R, ctx.measureText(sun.label).width) + 16;
      this.sunHit = { x: cx - w / 2, y: cy - R - 6, w, h: 2 * R + 30 };
    }
    ctx.font = '500 12px Inter, ui-sans-serif, system-ui, sans-serif';
  }

  /** `true` when a screen point (px) is on the sun marker or its compass */
  hitSun(x: number, y: number): boolean {
    const h = this.sunHit;
    return !!h && x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h;
  }

  /** Pick nearest body to screen point (px). */
  /** "Name · 8.6 ly" when distances are on, otherwise just the name */
  private withDist(name: string, km?: number): string {
    return !this.showDistances || km === undefined ? name : `${name} · ${fmtScaleDistance(km)}`;
  }

  /** Sky label under a screen point (a few px of slack around the text) */
  hitLabel(x: number, y: number, pad = 3): LabelHit | null {
    // last drawn is on top
    for (let i = this.labelHits.length - 1; i >= 0; i--) {
      const l = this.labelHits[i];
      if (x >= l.x - pad && x <= l.x + l.w + pad && y >= l.y - pad && y <= l.y + l.h + pad) return l;
    }
    return null;
  }

  pick(x: number, y: number, maxDist = 22): CelestialBody | null {
    let best: CelestialBody | null = null;
    let bestD = Infinity;
    for (const it of this.items) {
      if (!it.visible) continue;
      const lb = it.labelBox;
      if (lb && x >= lb.x - 3 && x <= lb.x + lb.w + 3 && y >= lb.y - 3 && y <= lb.y + lb.h + 3) return it.body;
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
