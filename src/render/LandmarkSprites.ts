import {
  AdditiveBlending, CanvasTexture, InstancedBufferAttribute, InstancedBufferGeometry, LinearMipmapLinearFilter, Mesh, PlaneGeometry,
  NoColorSpace, Scene, ShaderMaterial, Vector3,
  type PerspectiveCamera,
} from 'three';
import { SKY_RADIUS_KM } from '../core/constants';
import type { Landmark } from '../core/Universe';
import { LANDMARK_ATLAS_GRID, LANDMARK_ATLAS_SLOT, LANDMARK_IMAGES } from '../data/landmarkImages';
import { GalaxyCloud } from './GalaxyCloud';
import { Shaders } from './shaders';

const _rel = new Vector3();
const _proj = new Vector3();
const KIND_CODE = { nebula: 0, cluster: 1, remnant: 2, star: 3, pulsar: 4 } as const;

/** Screen-space info for a landmark label/marker */
export interface LandmarkScreen {
  index: number;
  name: string;
  /** unit direction from the camera, scene frame */
  dir: Vector3;
  /** apparent radius (px) */
  radiusPx: number;
  kind: Landmark['def']['kind'];
}

/**
 * Nebulae, clusters, supernova remnants and record stars as instanced billboards at their real
 * positions, plus the label/pick bookkeeping for them.
 */
export class LandmarkSprites {
  readonly mesh: Mesh;
  readonly named: LandmarkScreen[] = [];
  private readonly mat: ShaderMaterial;
  private readonly camPc = new Vector3();
  private readonly pool: LandmarkScreen[] = [];

  constructor(readonly landmarks: Landmark[], scene: Scene) {
    const n = landmarks.length;
    const pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
    const rad = new Float32Array(n), kind = new Float32Array(n), mag = new Float32Array(n), seed = new Float32Array(n), idx = new Float32Array(n);
    const img = new Float32Array(n), span = new Float32Array(n);
    const files: string[] = [];
    landmarks.forEach((l, i) => {
      pos[i * 3] = l.positionPc.x; pos[i * 3 + 1] = l.positionPc.y; pos[i * 3 + 2] = l.positionPc.z;
      col[i * 3] = l.def.color[0]; col[i * 3 + 1] = l.def.color[1]; col[i * 3 + 2] = l.def.color[2];
      rad[i] = l.def.radiusPc;
      kind[i] = KIND_CODE[l.def.kind];
      mag[i] = l.def.absMag;
      seed[i] = (i * 7.31) % 13;
      idx[i] = i;
      const photo = LANDMARK_IMAGES[l.def.id];
      if (photo && files.length < LANDMARK_ATLAS_GRID * LANDMARK_ATLAS_GRID) {
        img[i] = files.length; span[i] = photo.span; files.push(photo.file);
      } else {
        img[i] = -1; span[i] = 1.6;
      }
    });
    const quad = new PlaneGeometry(2, 2);
    const geo = new InstancedBufferGeometry();
    geo.index = quad.index;
    geo.setAttribute('position', quad.getAttribute('position'));
    geo.setAttribute('uv', quad.getAttribute('uv'));
    geo.setAttribute('iPos', new InstancedBufferAttribute(pos, 3));
    geo.setAttribute('iColor', new InstancedBufferAttribute(col, 3));
    geo.setAttribute('iRadius', new InstancedBufferAttribute(rad, 1));
    geo.setAttribute('iKind', new InstancedBufferAttribute(kind, 1));
    geo.setAttribute('iAbsMag', new InstancedBufferAttribute(mag, 1));
    geo.setAttribute('iSeed', new InstancedBufferAttribute(seed, 1));
    geo.setAttribute('iIndex', new InstancedBufferAttribute(idx, 1));
    geo.setAttribute('iImg', new InstancedBufferAttribute(img, 1));
    geo.setAttribute('iSpan', new InstancedBufferAttribute(span, 1));
    geo.instanceCount = n;
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
    if (files.length && typeof document !== 'undefined') setTimeout(() => this.loadAtlas(files), 1500);
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

  /** Once the volumetric clouds exist, photographed sprites fade out as they get resolved */
  setCloudHandover(on: boolean): void { this.mat.uniforms.uCloudOn.value = on ? 1 : 0; }

  /** flux → alpha·px² calibration shared with the clouds */
  get k(): number { return this.mat.uniforms.uK.value as number; }

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
    for (let i = 0; i < this.landmarks.length; i++) {
      const l = this.landmarks[i];
      if (l.systemId !== null && l.systemId === currentSystem) { hide = i; continue; }
      // labels: only when the host galaxy is resolved (inside or close), so a far galaxy's
      // landmarks don't pile onto its own label
      if (galaxyRatio(l.galaxy) > 4) continue;
      let m = this.pool[i];
      if (!m) { m = { index: i, name: l.def.name, dir: new Vector3(), radiusPx: 0, kind: l.def.kind }; this.pool[i] = m; }
      this.direction(i, m.dir);
      m.radiusPx = this.angularRadius(i) * pxPerRad;
      this.named.push(m);
    }
    u.uHideIndex.value = hide;
    u.uTime.value = (performance.now() * 1e-3) % 1000;
  }

  /** Landmark nearest to a screen point (px) among the currently labelled ones */
  pick(x: number, y: number, camera: PerspectiveCamera, W: number, H: number, maxPx = 14): number | null {
    let best = -1;
    let bestScore = Infinity;
    for (const m of this.named) {
      _rel.copy(m.dir);
      _proj.copy(_rel).multiplyScalar(1e11).project(camera);
      if (_proj.z > 1 || _proj.z < -1) continue;
      const sx = (_proj.x * 0.5 + 0.5) * W;
      const sy = (-_proj.y * 0.5 + 0.5) * H;
      const dist = Math.hypot(sx - x, sy - y);
      const reach = Math.max(maxPx, Math.min(m.radiusPx, H * 0.25));
      if (dist > reach) continue;
      const score = dist / reach;
      if (score < bestScore) { bestScore = score; best = m.index; }
    }
    return best >= 0 ? best : null;
  }
}
