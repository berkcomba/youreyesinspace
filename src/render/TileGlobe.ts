import {
  BufferAttribute, BufferGeometry, Frustum, Group, Matrix4, Mesh, Quaternion, ShaderMaterial, Sphere, SRGBColorSpace,
  Texture, TextureLoader, Vector3, type Camera, type IUniform,
} from 'three';
import type { CelestialBody } from '../core/CelestialBody';
import type { BodyImagery, TileProvider } from '../data/imagery';
import { DEG } from '../core/constants';
import { Shaders } from './shaders';

type Uniforms = Record<string, IUniform>;
type TexStatus = 'idle' | 'queued' | 'loading' | 'ready' | 'error';

interface TexSlot {
  status: TexStatus;
  tex: Texture | null;
}

/** Texel magnification (screen px per texel) above which a tile is split */
const REFINE_PX = 1.6;
/** Time (ms) a subtree may stay unused before it is released */
const PRUNE_AFTER_MS = 4000;
/** Queued requests older than this are dropped (the camera moved on) */
const STALE_REQUEST_MS = 150;
/** Global texture budget (all globes); pruning gets aggressive above it */
const TEXTURE_BUDGET = 320;
/** Parallel tile downloads */
const MAX_CONCURRENT = 8;

// ---------------------------------------------------------------------------
// Shared loader with a small priority queue (low levels first, then most recent)
// ---------------------------------------------------------------------------
interface LoadJob {
  node: TileNode;
  slot: 'day' | 'night';
  url: string;
  requestedAt: number;
}

class TileLoader {
  private readonly loader = new TextureLoader();
  private queue: LoadJob[] = [];
  private inFlight = 0;
  textureCount = 0;
  maxAnisotropy = 1;

  constructor() {
    this.loader.crossOrigin = 'anonymous';
  }

  enqueue(job: LoadJob): void {
    this.queue.push(job);
  }

  /** Drop stale requests, start the most important ones. */
  flush(now: number): void {
    // requests for tiles that are no longer needed are cancelled (they were never started)
    this.queue = this.queue.filter((j) => {
      if (now - j.node.lastUsed < STALE_REQUEST_MS) return true;
      j.node[j.slot].status = 'idle';
      return false;
    });
    if (this.inFlight >= MAX_CONCURRENT || this.queue.length === 0) return;
    this.queue.sort((a, b) => a.node.z - b.node.z || b.requestedAt - a.requestedAt);
    while (this.inFlight < MAX_CONCURRENT && this.queue.length > 0) {
      const job = this.queue.shift()!;
      this.start(job);
    }
  }

  private start(job: LoadJob): void {
    const slot = job.node[job.slot];
    slot.status = 'loading';
    this.inFlight++;
    this.loader.load(
      job.url,
      (tex) => {
        this.inFlight--;
        if (job.node.disposed) { tex.dispose(); return; }
        tex.colorSpace = SRGBColorSpace;
        tex.anisotropy = this.maxAnisotropy;
        tex.needsUpdate = true;
        slot.tex = tex;
        slot.status = 'ready';
        this.textureCount++;
      },
      undefined,
      () => {
        this.inFlight--;
        slot.status = 'error';
      },
    );
  }

  release(slot: TexSlot): void {
    if (slot.tex) { slot.tex.dispose(); this.textureCount--; }
    slot.tex = null;
    slot.status = 'idle';
  }
}

const tileLoader = new TileLoader();

// ---------------------------------------------------------------------------
// Quadtree node
// ---------------------------------------------------------------------------
class TileNode {
  readonly key: string;
  children: TileNode[] | null = null;
  mesh: Mesh | null = null;
  material: ShaderMaterial | null = null;
  readonly day: TexSlot = { status: 'idle', tex: null };
  readonly night: TexSlot = { status: 'idle', tex: null };
  /** performance.now() of the last frame that needed this node */
  lastUsed = -Infinity;
  disposed = false;

  /** full (server) tile bounds, degrees */
  readonly span: number;
  readonly lon0: number;
  readonly latTop: number;
  /** part of the tile that lies on the globe */
  readonly cLon0: number;
  readonly cLon1: number;
  readonly cLat0: number;
  readonly cLat1: number;
  readonly empty: boolean;

  /** body-frame centre of the clipped patch (km) and bounding radius */
  readonly center = new Vector3();
  boundRadius = 0;

  constructor(readonly z: number, readonly x: number, readonly y: number, readonly parent: TileNode | null, readonly globe: TileGlobe) {
    this.key = `${z}/${x}/${y}`;
    this.span = globe.imagery.day.span0 / 2 ** z;
    this.lon0 = -180 + x * this.span;
    this.latTop = 90 - y * this.span;
    this.cLon0 = Math.max(this.lon0, -180);
    this.cLon1 = Math.min(this.lon0 + this.span, 180);
    this.cLat1 = Math.min(this.latTop, 90);
    this.cLat0 = Math.max(this.latTop - this.span, -90);
    this.empty = this.cLon1 - this.cLon0 <= 1e-9 || this.cLat1 - this.cLat0 <= 1e-9;
    if (!this.empty) {
      globe.surfacePoint((this.cLat0 + this.cLat1) / 2, (this.cLon0 + this.cLon1) / 2, this.center);
      const p = new Vector3();
      let r = 0;
      for (const lat of [this.cLat0, (this.cLat0 + this.cLat1) / 2, this.cLat1]) {
        for (const lon of [this.cLon0, (this.cLon0 + this.cLon1) / 2, this.cLon1]) {
          r = Math.max(r, globe.surfacePoint(lat, lon, p).distanceTo(this.center));
        }
      }
      // a wide patch bulges beyond its corner points
      this.boundRadius = r * 1.05 + 1e-3;
    }
  }

  ensureChildren(): TileNode[] {
    if (!this.children) {
      const z = this.z + 1;
      this.children = [];
      for (let dy = 0; dy < 2; dy++) {
        for (let dx = 0; dx < 2; dx++) {
          const c = new TileNode(z, this.x * 2 + dx, this.y * 2 + dy, this, this.globe);
          if (!c.empty) this.children.push(c);
        }
      }
    }
    return this.children;
  }

  /** Nearest ancestor-or-self with a ready texture in the slot */
  source(slot: 'day' | 'night'): TileNode | null {
    let n: TileNode | null = this;
    while (n) {
      if (n[slot].status === 'ready') return n;
      n = n.parent;
    }
    return null;
  }

  /** Recursively release everything below this node (this node itself is kept). */
  releaseChildren(): void {
    if (!this.children) return;
    for (const c of this.children) c.dispose();
    this.children = null;
  }

  dispose(): void {
    this.releaseChildren();
    this.disposed = true;
    if (this.mesh) { this.globe.group.remove(this.mesh); this.mesh.geometry.dispose(); this.mesh = null; }
    this.material?.dispose();
    this.material = null;
    tileLoader.release(this.day);
    tileLoader.release(this.night);
  }
}

// ---------------------------------------------------------------------------
// Globe
// ---------------------------------------------------------------------------
const _q = new Quaternion();
const _camLocal = new Vector3();
const _p = new Vector3();
const _m4 = new Matrix4();
const _frustum = new Frustum();
const _sphere = new Sphere();

/**
 * Streams real imagery tiles onto an ellipsoid in the body-fixed frame and adapts the
 * quadtree level to the camera (screen texel size). Add `group` to the body's transform group.
 */
export class TileGlobe {
  readonly group = new Group();
  /** Ready once the level-0 tiles are on the GPU (before that the procedural globe is shown) */
  active = false;
  /** Tiles drawn last frame */
  drawn = 0;

  private readonly roots: TileNode[] = [];
  private readonly Re: number;
  private readonly Rp: number;
  private readonly e2: number;
  private readonly baseUniforms: Uniforms;
  private frame = 0;
  private rendered = new Set<TileNode>();
  private prevRendered = new Set<TileNode>();

  constructor(
    readonly body: CelestialBody,
    readonly imagery: BodyImagery,
    lit: Uniforms,
    extra: { atmColor: Vector3; atmDensity: number; sunsetColor: Vector3 },
    maxAnisotropy: number,
  ) {
    tileLoader.maxAnisotropy = Math.max(tileLoader.maxAnisotropy, maxAnisotropy);
    this.Re = body.equatorialRadius;
    this.Rp = body.polarRadius;
    const f = 1 - this.Rp / this.Re;
    this.e2 = 2 * f - f * f;
    this.baseUniforms = {
      ...lit,
      uAtmColor: { value: extra.atmColor },
      uAtmDensity: { value: extra.atmDensity },
      uSunsetColor: { value: extra.sunsetColor },
      uOceanSpec: { value: imagery.hasOceanSpecular ? 1 : 0 },
    };
    this.group.frustumCulled = false;
    const cols = Math.ceil(360 / imagery.day.span0);
    const rows = Math.ceil(180 / imagery.day.span0);
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const n = new TileNode(0, x, y, null, this);
      if (!n.empty) this.roots.push(n);
    }
    // preload the root tiles so the swap from the procedural globe happens as early as possible
    for (const r of this.roots) {
      r.lastUsed = Infinity; // never dropped from the queue
      this.request(r, 'day');
      if (imagery.night) this.request(r, 'night');
    }
    tileLoader.flush(performance.now());
  }

  /** Geodetic lat/lon (deg) → body-frame position on the ellipsoid (km) */
  surfacePoint(latDeg: number, lonDeg: number, out: Vector3): Vector3 {
    const lat = latDeg * DEG;
    const lon = lonDeg * DEG;
    const sl = Math.sin(lat), cl = Math.cos(lat);
    const N = this.Re / Math.sqrt(1 - this.e2 * sl * sl);
    return out.set(N * cl * Math.cos(lon), N * (1 - this.e2) * sl, -N * cl * Math.sin(lon));
  }

  /**
   * Per-frame LOD selection. `camPos` is the absolute camera position; the body's own
   * `position`/`rotation` are used to move into the body frame in double precision.
   */
  update(camPos: Vector3, camera: Camera, pxPerRad: number): void {
    this.frame++;
    const now = performance.now();
    const b = this.body;
    _camLocal.copy(camPos).sub(b.position).applyQuaternion(_q.copy(b.rotation).invert());
    const camDist = _camLocal.length();
    // sub-camera point (geocentric, good enough for culling) and horizon angle
    const camLat = Math.asin(Math.min(1, Math.max(-1, _camLocal.y / camDist))) / DEG;
    const camLon = Math.atan2(-_camLocal.z, _camLocal.x) / DEG;
    const horizon = Math.acos(Math.min(1, this.Re / Math.max(camDist, this.Re))) / DEG;

    _m4.copy(camera.matrixWorld).invert().premultiply(camera.projectionMatrix);
    _frustum.setFromProjectionMatrix(_m4);

    this.active = this.roots.every((r) => r.day.status === 'ready');

    const rendered = this.rendered;
    rendered.clear();

    const visit = (n: TileNode): void => {
      n.lastUsed = now;
      // --- horizon cull: closest point of the lat/lon rectangle to the sub-camera point
      const lat = Math.min(n.cLat1, Math.max(n.cLat0, camLat));
      let dl = camLon - n.cLon0;
      dl -= Math.floor(dl / 360) * 360; // 0..360 east of the west edge
      const w = n.cLon1 - n.cLon0;
      const lon = dl <= w ? camLon : (dl - w < 360 - dl ? n.cLon1 : n.cLon0);
      const ang = angularDistance(camLat, camLon, lat, lon);
      if (ang > horizon + n.span * 0.05 + 2) return;
      // --- frustum cull (camera-relative world space)
      _p.copy(n.center).applyQuaternion(b.rotation).add(b.position).sub(camPos);
      _sphere.center.copy(_p);
      _sphere.radius = n.boundRadius;
      if (!_frustum.intersectsSphere(_sphere)) return;

      // --- LOD: screen size of one texel at the nearest point of the patch
      this.surfacePoint(lat, lon, _p);
      const dMin = Math.max(_p.distanceTo(_camLocal), 1e-3);
      const texelKm = (n.span * DEG * this.Re) / this.imagery.day.tileSize;
      const texelPx = (texelKm / dMin) * pxPerRad;
      if (n.z < this.imagery.day.maxLevel && texelPx > REFINE_PX) {
        for (const c of n.ensureChildren()) visit(c);
      } else {
        rendered.add(n);
      }
    };
    for (const r of this.roots) visit(r);

    // --- draw list
    for (const n of rendered) {
      this.request(n, 'day');
      if (this.imagery.night) this.request(n, 'night');
      // progressive: make sure the parent arrives too, so a refined region never falls back to level 0
      if (n.day.status !== 'ready' && n.parent && n.parent.day.status === 'idle') {
        n.parent.lastUsed = now;
        this.request(n.parent, 'day');
      }
      const daySrc = n.source('day');
      if (!daySrc) continue;
      const mesh = n.mesh ?? this.buildMesh(n);
      mesh.visible = true;
      const u = n.material!.uniforms;
      u.uDay.value = daySrc.day.tex;
      mapInto(n, daySrc, u.uDayMap.value as Vector3);
      const nightSrc = this.imagery.night ? n.source('night') : null;
      if (nightSrc) {
        u.uNight.value = nightSrc.night.tex;
        mapInto(n, nightSrc, u.uNightMap.value as Vector3);
        u.uHasNight.value = 1;
      } else {
        u.uHasNight.value = 0;
      }
    }
    for (const n of this.prevRendered) if (!rendered.has(n) && n.mesh) n.mesh.visible = false;
    this.drawn = rendered.size;
    const tmp = this.prevRendered; this.prevRendered = rendered; this.rendered = tmp;

    tileLoader.flush(now);
    if (this.frame % 60 === 0) this.prune(now);
  }

  hide(): void {
    for (const n of this.prevRendered) if (n.mesh) n.mesh.visible = false;
    this.prevRendered.clear();
    this.drawn = 0;
  }

  dispose(): void {
    for (const r of this.roots) r.dispose();
    this.roots.length = 0;
  }

  private request(n: TileNode, slot: 'day' | 'night'): void {
    const s = n[slot];
    if (s.status !== 'idle') return;
    const provider: TileProvider = slot === 'day' ? this.imagery.day : this.imagery.night!;
    s.status = 'queued';
    tileLoader.enqueue({ node: n, slot, url: provider.url(n.z, n.x, n.y), requestedAt: performance.now() });
  }

  /** Release subtrees that have not been needed for a while (roots are never released). */
  private prune(now: number): void {
    const overBudget = tileLoader.textureCount > TEXTURE_BUDGET;
    const ttl = overBudget ? 500 : PRUNE_AFTER_MS;
    const rec = (n: TileNode): void => {
      if (!n.children) return;
      let stale = true;
      for (const c of n.children) {
        rec(c);
        if (now - c.lastUsed < ttl || c.children) stale = false;
      }
      if (stale) n.releaseChildren();
    };
    for (const r of this.roots) rec(r);
  }

  /** Grid patch on the ellipsoid, positions relative to the patch centre (body frame). */
  private buildMesh(n: TileNode): Mesh {
    const extent = Math.max(n.cLon1 - n.cLon0, n.cLat1 - n.cLat0);
    const seg = Math.min(48, Math.max(12, Math.ceil(extent / 3)));
    const verts = (seg + 1) * (seg + 1);
    const pos = new Float32Array(verts * 3);
    const nor = new Float32Array(verts * 3);
    const uv = new Float32Array(verts * 2);
    const latSpan = n.cLat1 - n.cLat0;
    const lonSpan = n.cLon1 - n.cLon0;
    let k = 0;
    for (let i = 0; i <= seg; i++) {
      const lat = n.cLat0 + (latSpan * i) / seg;
      for (let j = 0; j <= seg; j++, k++) {
        const lon = n.cLon0 + (lonSpan * j) / seg;
        this.surfacePoint(lat, lon, _p).sub(n.center);
        pos[k * 3] = _p.x; pos[k * 3 + 1] = _p.y; pos[k * 3 + 2] = _p.z;
        const cl = Math.cos(lat * DEG);
        nor[k * 3] = cl * Math.cos(lon * DEG); nor[k * 3 + 1] = Math.sin(lat * DEG); nor[k * 3 + 2] = -cl * Math.sin(lon * DEG);
        uv[k * 2] = (lon - n.lon0) / n.span;
        uv[k * 2 + 1] = (lat - (n.latTop - n.span)) / n.span;
      }
    }
    const idx = new Uint16Array(seg * seg * 6);
    let t = 0;
    for (let i = 0; i < seg; i++) {
      for (let j = 0; j < seg; j++) {
        const a = i * (seg + 1) + j, b = a + 1, c = a + seg + 1, d = c + 1;
        idx[t++] = a; idx[t++] = b; idx[t++] = c;
        idx[t++] = b; idx[t++] = d; idx[t++] = c;
      }
    }
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(pos, 3));
    geo.setAttribute('normal', new BufferAttribute(nor, 3));
    geo.setAttribute('uv', new BufferAttribute(uv, 2));
    geo.setIndex(new BufferAttribute(idx, 1));

    const mat = new ShaderMaterial({
      vertexShader: Shaders.tileVert,
      fragmentShader: Shaders.tileFrag,
      uniforms: {
        ...this.baseUniforms,
        uDay: { value: null },
        uDayMap: { value: new Vector3(0, 0, 1) },
        uNight: { value: null },
        uNightMap: { value: new Vector3(0, 0, 1) },
        uHasNight: { value: 0 },
      },
    });
    const mesh = new Mesh(geo, mat);
    mesh.position.copy(n.center);
    mesh.frustumCulled = false;
    n.mesh = mesh;
    n.material = mat;
    this.group.add(mesh);
    return mesh;
  }
}

/** UV mapping of node `n` into the texture of its ancestor-or-self `src`: (offset.xy, scale) */
function mapInto(n: TileNode, src: TileNode, out: Vector3): void {
  const k = n.z - src.z;
  if (k === 0) { out.set(0, 0, 1); return; }
  const f = 2 ** k;
  const cx = n.x - src.x * f;
  const cy = n.y - src.y * f;
  out.set(cx / f, (f - cy - 1) / f, 1 / f);
}

function angularDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const a = lat1 * DEG, b = lat2 * DEG, dl = (lon2 - lon1) * DEG;
  const c = Math.sin(a) * Math.sin(b) + Math.cos(a) * Math.cos(b) * Math.cos(dl);
  return Math.acos(Math.min(1, Math.max(-1, c))) / DEG;
}
