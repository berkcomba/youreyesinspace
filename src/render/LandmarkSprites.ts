import {
  AdditiveBlending, CanvasTexture, InstancedBufferAttribute, InstancedBufferGeometry, LinearMipmapLinearFilter, Mesh, PlaneGeometry,
  NoColorSpace, Scene, ShaderMaterial, Vector3,
  type PerspectiveCamera,
} from 'three';
import { PARSEC_KM, SKY_RADIUS_KM } from '../core/constants';
import type { Landmark } from '../core/Universe';
import { LANDMARK_ATLAS_GRID, LANDMARK_ATLAS_SLOT, LANDMARK_IMAGES } from '../data/landmarkImages';
import { GalaxyCloud } from './GalaxyCloud';
import { Shaders } from './shaders';
import { better, PICK_MIN_VIS, type PickHit } from './pickHit';

const _proj = new Vector3();

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h >>> 0;
}
const KIND_CODE = { nebula: 0, cluster: 1, remnant: 2, star: 3, pulsar: 4, planetary: 5, globular: 6 } as const;
/** at most this many generated landmarks get labels at once (the biggest on screen) */
const MAX_PROC_LABELS = 36;
/** how often the label / pick lists (the walk over every landmark) are refreshed (ms) */
const LIST_INTERVAL_MS = 40;

/** Screen-space info for a landmark label/marker */
export interface LandmarkScreen {
  index: number;
  name: string;
  /** unit direction from the camera, scene frame */
  dir: Vector3;
  /** apparent radius (px) */
  radiusPx: number;
  kind: Landmark['def']['kind'];
  /** distance from the camera (km) */
  distKm: number;
  /** generated object the visitor has not come close to yet */
  undiscovered?: boolean;
}

/**
 * Nebulae, clusters, supernova remnants and record stars as instanced billboards at their real
 * positions, plus the label/pick bookkeeping for them.
 */
export class LandmarkSprites {
  readonly mesh: Mesh;
  readonly named: LandmarkScreen[] = [];
  /** unlabelled generated objects whose sprite is nevertheless on screen: clickable, as anything visible is */
  private readonly pickable: LandmarkScreen[] = [];
  /** ids of the generated objects already discovered (shared with the app), for the label style */
  discoveries: Set<string> | null = null;
  private readonly mat: ShaderMaterial;
  private readonly camPc = new Vector3();
  private readonly pool: LandmarkScreen[] = [];

  private geo!: InstancedBufferGeometry;
  private readonly quad = new PlaneGeometry(2, 2);
  /** per landmark, from the last update(): distance from the camera (pc) and apparent radius (px) — shared with the cloud / member-star layers so they need not walk the list again */
  distPc = new Float32Array(0);
  radiusPx = new Float32Array(0);
  /** the label / pick lists are rebuilt at LIST_INTERVAL_MS, or at once after a rebuild / system change */
  private listAt = -Infinity;
  private listDirty = true;
  private listSystem = '';
  private galaxyFar = new Int8Array(0);
  /** galaxies the landmarks belong to (size of the per-galaxy cache), from rebuild */
  private galaxyCount = 0;
  /** per landmark: 10^(−0.4·M), so the apparent flux is flux0·100/d² without a log per frame */
  private flux0 = new Float32Array(0);
  /** per landmark: d²/uK beyond which the physical sprite alpha (pxc ≥ 1.2) is under 0.03 */
  private visD2 = new Float32Array(0);
  /** photographs: fixed by the real landmarks (loaded once) */
  private readonly files: string[] = [];
  private atlasRequested = false;

  constructor(readonly landmarks: Landmark[], scene: Scene) {
    this.rebuild();
    const geo = this.geo;
    this.mat = new ShaderMaterial({
      vertexShader: Shaders.landmarkVert,
      fragmentShader: Shaders.landmarkFrag,
      uniforms: {
        uCamPc: { value: new Vector3() },
        uSkyRadius: { value: SKY_RADIUS_KM * 0.985 },
        uPxPerRad: { value: 1000 },
        uK: { value: 1 },
        uHideIndex: { value: -1 },
        uTime: { value: 0 },
        uAtlas: { value: null },
        uAtlasReady: { value: 0 },
        uAtlasGrid: { value: LANDMARK_ATLAS_GRID },
        uCloudOn: { value: 0 },
        uShapes: { value: 0 },
        uDaylight: { value: 0 },
      },
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
    });
    this.mesh = new Mesh(geo, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -11;
    scene.add(this.mesh);
    // photographs are a progressive enhancement: procedural sprites until the atlas is in
    if (this.files.length && typeof document !== 'undefined') { this.atlasRequested = true; setTimeout(() => this.loadAtlas(this.files), 1500); }
  }

  /**
   * (Re)build the instance buffers from `landmarks` — called when the generated landmarks of the
   * camera's neighbourhood change. Atlas slots of the real (photographed) landmarks are stable.
   */
  rebuild(): void {
    const landmarks = this.landmarks;
    const n = landmarks.length;
    const pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
    const rad = new Float32Array(n), kind = new Float32Array(n), mag = new Float32Array(n), seed = new Float32Array(n), idx = new Float32Array(n);
    const img = new Float32Array(n), span = new Float32Array(n), cloud = new Float32Array(n), cat = new Float32Array(n), reach = new Float32Array(n);
    const files = this.files;
    this.distPc = new Float32Array(n); this.radiusPx = new Float32Array(n);
    this.listDirty = true;
    let gmax = 0; for (const l of landmarks) if (l.galaxy >= gmax) gmax = l.galaxy + 1;
    this.galaxyCount = gmax;
    const flux0 = this.flux0 = new Float32Array(n);
    const visD2 = this.visD2 = new Float32Array(n);
    landmarks.forEach((l, i) => {
      flux0[i] = Math.pow(10, -0.4 * l.def.absMag);
      visD2[i] = (flux0[i] * 100) / (0.03 * 0.61 * 1.2 * 1.2);
      pos[i * 3] = l.positionPc.x; pos[i * 3 + 1] = l.positionPc.y; pos[i * 3 + 2] = l.positionPc.z;
      col[i * 3] = l.def.color[0]; col[i * 3 + 1] = l.def.color[1]; col[i * 3 + 2] = l.def.color[2];
      rad[i] = l.def.radiusPc;
      kind[i] = KIND_CODE[l.def.kind];
      mag[i] = l.def.absMag;
      cat[i] = l.def.catalog ? 1 : 0;
      reach[i] = l.reachPc ?? 0;
      seed[i] = l.def.procedural ? (hashStr(l.def.id) % 1000) / 77 : (i * 7.31) % 13;
      idx[i] = i;
      const photo = LANDMARK_IMAGES[l.def.id];
      if (photo) {
        let slot = files.indexOf(photo.file);
        if (slot < 0 && files.length < LANDMARK_ATLAS_GRID * LANDMARK_ATLAS_GRID && !this.atlasRequested) { slot = files.length; files.push(photo.file); }
        img[i] = slot; span[i] = photo.span;
      } else {
        img[i] = -1; span[i] = 1.6;
      }
    });
    // a fresh geometry each time: swapping attributes on a live InstancedBufferGeometry does not
    // reach the GPU reliably (the renderer keeps the old VAO)
    const geo = new InstancedBufferGeometry();
    geo.index = this.quad.index;
    geo.setAttribute('position', this.quad.getAttribute('position'));
    geo.setAttribute('uv', this.quad.getAttribute('uv'));
    geo.setAttribute('iPos', new InstancedBufferAttribute(pos, 3));
    geo.setAttribute('iColor', new InstancedBufferAttribute(col, 3));
    geo.setAttribute('iRadius', new InstancedBufferAttribute(rad, 1));
    geo.setAttribute('iKind', new InstancedBufferAttribute(kind, 1));
    geo.setAttribute('iAbsMag', new InstancedBufferAttribute(mag, 1));
    geo.setAttribute('iSeed', new InstancedBufferAttribute(seed, 1));
    geo.setAttribute('iIndex', new InstancedBufferAttribute(idx, 1));
    geo.setAttribute('iImg', new InstancedBufferAttribute(img, 1));
    geo.setAttribute('iSpan', new InstancedBufferAttribute(span, 1));
    geo.setAttribute('iCloud', new InstancedBufferAttribute(cloud, 1));
    geo.setAttribute('iCat', new InstancedBufferAttribute(cat, 1));
    geo.setAttribute('iReach', new InstancedBufferAttribute(reach, 1));
    geo.instanceCount = n;
    const old = this.geo;
    this.geo = geo;
    if (this.mesh) { this.mesh.geometry = geo; old?.dispose(); }
    this.pool.length = Math.min(this.pool.length, n);
    this.cloudFlags = cloud;
    this.cloudSet.clear();
  }

  private cloudFlags = new Float32Array(0);
  /** indices currently holding a non-zero cloud weight */
  private readonly cloudSet = new Set<number>();

  /**
   * @param weights landmark index → 0…1: the share of a nebula its raymarched cloud carries right
   * now (the sprite gives up as much), or how far a cluster's member stars have faded in (its glow
   * steps back)
   */
  setCloudFlags(weights: Iterable<[number, number]>): void {
    const f = this.cloudFlags;
    // a handful of weights among ten thousand zeros: only an actual change is worth the upload
    let changed = false;
    for (const i of this.cloudSet) if (f[i] !== 0) { f[i] = 0; changed = true; }
    this.cloudSet.clear();
    for (const [i, w] of weights) if (i < f.length) { if (f[i] !== w) { f[i] = w; changed = true; } this.cloudSet.add(i); }
    if (!changed) return;
    const attr = this.geo.getAttribute('iCloud') as InstancedBufferAttribute;
    attr.needsUpdate = true;
  }

  /** Compose the landmark photographs into one atlas texture (grid of square slots). */
  private loadAtlas(files: string[]): void {
    const G = LANDMARK_ATLAS_GRID, S = LANDMARK_ATLAS_SLOT;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = G * S;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let loaded = 0;
    Promise.all(files.map((file, s) => new Promise<void>((resolve) => {
      const im = new Image();
      im.onload = () => { ctx.drawImage(im, (s % G) * S, Math.floor(s / G) * S, S, S); loaded++; resolve(); };
      im.onerror = () => resolve();
      im.src = `${import.meta.env.BASE_URL}nebulae/${file}.jpg`;
    }))).then(() => {
      if (!loaded) return;
      const tex = new CanvasTexture(canvas);
      tex.colorSpace = NoColorSpace; // raw sRGB bytes; decoded explicitly in the shader
      tex.minFilter = LinearMipmapLinearFilter;
      tex.generateMipmaps = true;
      tex.anisotropy = 4;
      this.mat.uniforms.uAtlas.value = tex;
      this.mat.uniforms.uAtlasReady.value = 1;
    });
  }

  /**
   * Credit line for the photograph dominating the view: the largest photographed landmark that is
   * clearly resolved (≥ minPx) and in front of the camera. Null when none / atlas not loaded.
   */
  photoCredit(forward: Vector3, minPx = 60): string | null {
    if (!this.mat.uniforms.uAtlasReady.value) return null;
    let best: string | null = null;
    let bestPx = minPx;
    for (const m of this.named) {
      if (m.radiusPx < bestPx || m.dir.dot(forward) < 0.7) continue;
      const photo = LANDMARK_IMAGES[this.landmarks[m.index].def.id];
      if (!photo) continue;
      bestPx = m.radiusPx;
      best = photo.source;
    }
    return best;
  }

  setVisible(v: boolean): void { this.mesh.visible = v; }

  /** Daytime sky (0 none … 1 full): the sprites drown like the stars do */
  setDaylight(d: number): void { this.mat.uniforms.uDaylight.value = Math.min(1, d * 1.5); }

  /** number of landmarks the buffers were built for */
  get count(): number { return this.geo.instanceCount; }

  /**
   * The drawn shell / ring / filament shapes of the sprites: only while the gas is not raymarched
   * (volumetrics off). With the volumes every nebula larger than a blob is its own cloud, and a
   * sprite still waiting for a slot stays the blob it was from afar.
   */
  setShapes(on: boolean): void { this.mat.uniforms.uShapes.value = on ? 1 : 0; }

  /** Once the volumetric clouds exist, photographed sprites fade out as they get resolved */
  setCloudHandover(on: boolean): void { this.mat.uniforms.uCloudOn.value = on ? 1 : 0; }

  /** flux → alpha·px² calibration shared with the clouds */
  get k(): number { return this.mat.uniforms.uK.value as number; }

  /** Distance (pc) from the last camera position to landmark i */
  distancePc(i: number): number { return this.landmarks[i].positionPc.distanceTo(this.camPc); }

  /** Unit direction from the camera to landmark i */
  direction(i: number, out = new Vector3()): Vector3 {
    return out.copy(this.landmarks[i].positionPc).sub(this.camPc).normalize();
  }

  /** Apparent angular radius (rad) of landmark i from the last camera position */
  angularRadius(i: number): number {
    const l = this.landmarks[i];
    return Math.atan(l.def.radiusPc / Math.max(l.positionPc.distanceTo(this.camPc), 1e-6));
  }

  /**
   * @param camPc camera (scene pc)
   * @param currentSystem id of the current system (a star landmark we're in is drawn as a body)
   * @param galaxyDist function giving the camera's distance to a galaxy centre in galaxy radii
   */
  update(camPc: Vector3, pxPerRad: number, currentSystem: string, galaxyRatio: (gi: number) => number): void {
    this.camPc.copy(camPc);
    const u = this.mat.uniforms;
    u.uCamPc.value.copy(camPc);
    u.uPxPerRad.value = pxPerRad;
    u.uK.value = (0.16 * GalaxyCloud.gain * Math.PI * pxPerRad * pxPerRad) / 1.17;
    u.uTime.value = (performance.now() * 1e-3) % 1000;
    // the sprites themselves are the shader's (every frame, from the uniforms above); the walk over
    // ten thousand landmarks below only serves labels, picking and the hand-over layers, and a
    // direction a few hundredths of a second old is nothing to a label: at 120 Hz it would be a
    // steady 1.5 ms of every frame otherwise
    const now = performance.now();
    if (!this.listDirty && currentSystem === this.listSystem && now - this.listAt < LIST_INTERVAL_MS) {
      // between walks the chosen labels follow the camera every frame (they glide, not step)
      this.track(this.named, camPc, pxPerRad);
      this.track(this.pickable, camPc, pxPerRad);
      return;
    }
    this.listDirty = false; this.listSystem = currentSystem; this.listAt = now;
    let hide = -1;
    this.named.length = 0;
    this.pickable.length = 0;
    const proc: LandmarkScreen[] = [];
    const distPc = this.distPc, radiusPx = this.radiusPx;
    const cx = camPc.x, cy = camPc.y, cz = camPc.z;
    const K = u.uK.value as number;
    // the host galaxy's resolution, per galaxy index (one call per galaxy, not per landmark):
    // -1 unknown, 0 resolved, 1 far
    let galaxyFar = this.galaxyFar;
    if (galaxyFar.length < this.galaxyCount) galaxyFar = this.galaxyFar = new Int8Array(this.galaxyCount);
    galaxyFar.fill(-1);
    for (let i = 0; i < this.landmarks.length; i++) {
      const l = this.landmarks[i];
      const p = l.positionPc;
      const dx = p.x - cx, dy = p.y - cy, dz = p.z - cz;
      const d = Math.max(Math.sqrt(dx * dx + dy * dy + dz * dz), 1e-6);
      const R = l.def.radiusPc;
      const ratio = d / R;
      // small angles (nearly all of them): atan(x) = x to 3e-7
      const px = (ratio > 1000 ? 1 / ratio : Math.atan(1 / ratio)) * pxPerRad;
      distPc[i] = d; radiusPx[i] = px;
      if (l.systemId !== null && l.systemId === currentSystem) { hide = i; continue; }
      // labels: only when the host galaxy is resolved (inside or close), so a far galaxy's
      // landmarks don't pile onto its own label
      let far = l.galaxy < galaxyFar.length ? galaxyFar[l.galaxy] : -1;
      if (far < 0) { far = galaxyRatio(l.galaxy) > 4 ? 1 : 0; if (l.galaxy < galaxyFar.length) galaxyFar[l.galaxy] = far; }
      if (far === 1) continue;
      if (l.def.procedural || l.def.catalog) {
        // generated and catalogue objects are many: label only the ones that are resolved / close;
        // the rest only matter when their sprite is actually visible (then they are clickable).
        // Beyond the navigation floor's reach only the physical flux counts: a bound on it in
        // d² settles almost all of them without the full alpha
        if (px < 1.5 && ratio > 400) {
          if (ratio > 600 && d * d > K * this.visD2[i]) continue;
          if (this.alphaAt(i, px, ratio, d) <= 0.03) continue;
        }
      }
      let m = this.pool[i];
      if (!m || m.index !== i || m.name !== l.def.name) { m = { index: i, name: l.def.name, dir: new Vector3(), radiusPx: 0, kind: l.def.kind, distKm: 0 }; this.pool[i] = m; }
      m.dir.set(dx / d, dy / d, dz / d);
      m.distKm = d * PARSEC_KM;
      m.radiusPx = px;
      if (l.def.procedural || l.def.catalog) {
        if (px < 1.5 && ratio > 400) { this.pickable.push(m); continue; }
        if (l.def.procedural) m.undiscovered = !this.discoveries?.has(l.def.id);
        proc.push(m);
      } else {
        this.named.push(m);
      }
    }
    if (proc.length > MAX_PROC_LABELS) {
      proc.sort((a, b) => b.radiusPx - a.radiusPx);
      for (const m of proc.slice(MAX_PROC_LABELS)) this.pickable.push(m);
      proc.length = MAX_PROC_LABELS;
    }
    for (const m of proc) this.named.push(m);
    u.uHideIndex.value = hide;
  }

  /** Direction, distance and apparent radius of the listed labels from the current camera */
  private track(list: LandmarkScreen[], camPc: Vector3, pxPerRad: number): void {
    const cx = camPc.x, cy = camPc.y, cz = camPc.z;
    for (let k = 0; k < list.length; k++) {
      const m = list[k];
      const l = this.landmarks[m.index];
      if (!l) continue;
      const p = l.positionPc;
      const dx = p.x - cx, dy = p.y - cy, dz = p.z - cz;
      const d = Math.max(Math.sqrt(dx * dx + dy * dy + dz * dz), 1e-6);
      const ratio = d / l.def.radiusPc;
      m.dir.set(dx / d, dy / d, dz / d);
      m.distKm = d * PARSEC_KM;
      m.radiusPx = (ratio > 1000 ? 1 / ratio : Math.atan(1 / ratio)) * pxPerRad;
      this.distPc[m.index] = d; this.radiusPx[m.index] = m.radiusPx;
    }
  }

  /**
   * How bright landmark i is drawn (0…1) at an apparent radius (px), a distance in its own radii
   * and in parsecs: the law of landmark.vert without its fly-through and hand-over terms. The
   * raymarched clouds (ProcClouds) take their brightness from it too, so an object is as bright
   * resolved as it was as a sprite.
   */
  brightness(i: number, radiusPx: number, ratio: number, distPc: number): number {
    const l = this.landmarks[i];
    const flux = (this.flux0[i] * 100) / (distPc * distPc);   // 10^(−0.4·(M + 5 log d − 5))
    const reach = l.reachPc ? 1 - smooth01((distPc - 0.8 * l.reachPc) / (0.2 * l.reachPc)) : 1;
    if (l.def.kind === 'star' || l.def.kind === 'pulsar') {
      let nav = 1 - smooth01((distPc - 8000) / 32000);
      if (l.def.catalog) nav *= 1 - smooth01((distPc - 150) / 250);
      return Math.min(1, 0.2 * nav + 0.9 * Math.pow(flux, 0.45)) * reach;
    }
    const cluster = l.def.kind === 'cluster' || l.def.kind === 'globular';
    const pxc = Math.max(radiusPx, 1.2);
    let physical = Math.min(((this.mat.uniforms.uK.value as number) * flux) / (0.61 * pxc * pxc), cluster ? 1 : 0.8);
    const shell = l.def.kind === 'remnant' || l.def.kind === 'planetary';
    const nearR = l.def.kind === 'globular' ? 150 : shell ? 400 : 600;
    const floorA = cluster ? 0.3 : shell ? 0.4 * (0.5 + 0.5 * smooth01((radiusPx - 1.5) / 6.5)) + 0.45 * (1 - smooth01((ratio - 12) / 48)) : 0.6;
    let near = floorA * (1 - smooth01((ratio - nearR * 0.1) / (nearR * 0.9)));
    if (l.def.catalog) {
      // survey objects: star-like brightness while unresolved, a short navigation floor (landmark.vert)
      physical = Math.min(1, 0.9 * Math.pow((flux * 4) / Math.max(radiusPx * radiusPx, 4), 0.45));
      near *= cluster ? 0.5 * (1 - smooth01((ratio - 6) / 54)) : 1 - smooth01((ratio - 30) / 120);
    }
    return Math.max(physical, near) * reach;
  }

  /** The sprite's alpha as the vertex shader computes it (landmark.vert), for "is it on screen?" */
  private alphaAt(i: number, radiusPx: number, ratio: number, distPc: number): number {
    return this.brightness(i, radiusPx, ratio, distPc) * smooth01((ratio - 0.8) / 1.4);
  }

  /** Landmark nearest to a screen point (px): the labelled ones first, then any visible sprite */
  pick(x: number, y: number, camera: PerspectiveCamera, W: number, H: number, slackPx = 7): number | null {
    return this.pickHit(x, y, camera, W, H, slackPx)?.value ?? null;
  }

  /** Landmark under a screen point: labelled ones count as visible, the rest only as bright as drawn */
  pickHit(x: number, y: number, camera: PerspectiveCamera, W: number, H: number, slackPx = 7): PickHit<number> | null {
    return better(this.pickAmong(this.named, 0.4, x, y, camera, W, H, slackPx), this.pickAmong(this.pickable, 0, x, y, camera, W, H, slackPx));
  }

  private pickAmong(list: LandmarkScreen[], minVis: number, x: number, y: number, camera: PerspectiveCamera, W: number, H: number, slackPx: number): PickHit<number> | null {
    let best: PickHit<number> | null = null;
    for (const m of list) {
      const l = this.landmarks[m.index];
      if (!l) continue;
      const ratio = m.distKm / (l.def.radiusPc * PARSEC_KM);
      const vis = Math.max(minVis, this.alphaAt(m.index, m.radiusPx, ratio, m.distKm / PARSEC_KM));
      if (vis < PICK_MIN_VIS) continue;
      _proj.copy(m.dir).multiplyScalar(1e11).project(camera);
      if (_proj.z > 1 || _proj.z < -1) continue;
      const dist = Math.hypot((_proj.x * 0.5 + 0.5) * W - x, (-_proj.y * 0.5 + 0.5) * H - y);
      // the visible glow is ~0.7 of the nominal radius; huge ones are only clickable near their core
      const reach = Math.max(slackPx + 4, Math.min(m.radiusPx * 0.7, H * 0.25) + slackPx);
      if (dist > reach) continue;
      best = better(best, { value: m.index, dist, reach, vis, extended: m.radiusPx > 6 });
    }
    return best;
  }
}

function smooth01(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}
