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
    const img = new Float32Array(n), span = new Float32Array(n), cloud = new Float32Array(n);
    const files = this.files;
    landmarks.forEach((l, i) => {
      pos[i * 3] = l.positionPc.x; pos[i * 3 + 1] = l.positionPc.y; pos[i * 3 + 2] = l.positionPc.z;
      col[i * 3] = l.def.color[0]; col[i * 3 + 1] = l.def.color[1]; col[i * 3 + 2] = l.def.color[2];
      rad[i] = l.def.radiusPc;
      kind[i] = KIND_CODE[l.def.kind];
      mag[i] = l.def.absMag;
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
    geo.instanceCount = n;
    const old = this.geo;
    this.geo = geo;
    if (this.mesh) { this.mesh.geometry = geo; old?.dispose(); }
    this.pool.length = Math.min(this.pool.length, n);
    this.cloudFlags = cloud;
  }

  private cloudFlags = new Float32Array(0);

  /** Mark the landmarks that currently have a volumetric cloud (their sprite yields to it when resolved) */
  setCloudFlags(indices: Iterable<number>): void {
    const f = this.cloudFlags;
    f.fill(0);
    for (const i of indices) if (i < f.length) f[i] = 1;
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
    let hide = -1;
    this.named.length = 0;
    this.pickable.length = 0;
    const proc: LandmarkScreen[] = [];
    for (let i = 0; i < this.landmarks.length; i++) {
      const l = this.landmarks[i];
      if (l.systemId !== null && l.systemId === currentSystem) { hide = i; continue; }
      // labels: only when the host galaxy is resolved (inside or close), so a far galaxy's
      // landmarks don't pile onto its own label
      if (galaxyRatio(l.galaxy) > 4) continue;
      let m = this.pool[i];
      if (!m || m.index !== i || m.name !== l.def.name) { m = { index: i, name: l.def.name, dir: new Vector3(), radiusPx: 0, kind: l.def.kind, distKm: 0 }; this.pool[i] = m; }
      this.direction(i, m.dir);
      m.distKm = l.positionPc.distanceTo(camPc) * PARSEC_KM;
      m.radiusPx = this.angularRadius(i) * pxPerRad;
      if (l.def.procedural) {
        // generated objects are many: label only the ones that are resolved / close
        const ratio = m.distKm / (l.def.radiusPc * PARSEC_KM);
        if (m.radiusPx < 1.5 && ratio > 400) { if (this.spriteAlpha(l, m.radiusPx, ratio) > 0.03) this.pickable.push(m); continue; }
        m.undiscovered = !this.discoveries?.has(l.def.id);
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
    u.uTime.value = (performance.now() * 1e-3) % 1000;
  }

  /** The sprite's alpha as the vertex shader computes it (landmark.vert), for "is it on screen?" */
  private spriteAlpha(l: Landmark, radiusPx: number, ratio: number): number {
    const m = l.def.absMag + 5 * Math.log10(Math.max(l.positionPc.distanceTo(this.camPc), 1e-6)) - 5;
    const flux = Math.pow(10, -0.4 * m);
    const pxc = Math.max(radiusPx, 0.75);
    const physical = Math.min(((this.mat.uniforms.uK.value as number) * flux) / (0.61 * pxc * pxc), 1);
    const nearR = l.def.kind === 'globular' ? 150 : 600;
    const near = 0.6 * (1 - smooth01((ratio - nearR * 0.1) / (nearR * 0.9)));
    return Math.max(physical, near) * smooth01((ratio - 0.8) / 1.4);
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
      const vis = Math.max(minVis, this.spriteAlpha(l, m.radiusPx, ratio));
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
