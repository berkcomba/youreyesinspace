import {
  AdditiveBlending, BufferAttribute, BufferGeometry, Points, Scene, ShaderMaterial, Vector3, Vector4,
} from 'three';
import { SKY_RADIUS_KM } from '../core/constants';
import { Rng } from '../gen/SystemGenerator';
import { GalaxyModel, POPULATION_COLOR } from '../galaxy/GalaxyModel';
import { PROCEDURAL_TINT } from './ProcStarPoints';
import { Shaders } from './shaders';
import type { Volume, Volumes } from './Volumes';

const _local = new Vector3();
/** light left to the point cloud when a volume carries the rest (grain of the star clouds) */
const POINT_SHARE = 0.22;
/**
 * Materials of dropped clouds, kept rather than disposed: disposing the last one releases the
 * shader program, and flying back into a galaxy would stall a frame recompiling it.
 */
const matPool: ShaderMaterial[] = [];

/**
 * Near/inside-galaxy representation: a few hundred thousand unresolved "star blobs" sampled
 * from the analytic model. Replaces the sprite when the camera gets within ~12 radii and is
 * itself replaced by procedural stars in the camera's immediate neighbourhood.
 */
export class GalaxyCloud {
  /** brightness gain of the unresolved star light (tuned so the Milky Way band reads like the real sky) */
  static gain = 0.008;
  readonly points: Points;
  readonly blobRadius: number;
  private readonly mat: ShaderMaterial;
  readonly center = new Vector3();
  private readonly volume: Volume | null;
  private readonly volumes: Volumes | null;
  /** per-blob alpha carrying all of the light (scaled down while a volume carries most of it) */
  private fullAlpha = 0;

  private readonly rng: Rng;
  /** blobs sampled so far: the cloud is built over several frames while it is still faded out */
  private filled = 0;

  constructor(readonly galaxyIndex: number, readonly model: GalaxyModel, scene: Scene, count: number, maxPointPx: number, volumes: Volumes | null = null) {
    this.rng = new Rng(model.p.seed ^ 0x9e3779b9);
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const w = new Float32Array(count);
    this.blobRadius = model.radius / 140;
    // per-blob alpha: total light ∝ L/N, spread over the blob area
    this.volumes = volumes;
    this.volume = volumes ? volumes.galaxy(model, GalaxyCloud.gain, POINT_SHARE) : null;
    const alpha = GalaxyCloud.gain * (model.luminosity / count) / (this.blobRadius * this.blobRadius);
    this.fullAlpha = alpha;
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(pos, 3));
    geo.setAttribute('color', new BufferAttribute(col, 3));
    geo.setAttribute('weight', new BufferAttribute(w, 1));
    this.mat = matPool.pop() ?? new ShaderMaterial({
      vertexShader: Shaders.galaxyCloudVert,
      fragmentShader: Shaders.pointsFrag,
      uniforms: {
        uBasis: { value: null },
        uCenterRel: { value: new Vector3() },
        uPixelRatio: { value: 1 },
        uSkyRadius: { value: SKY_RADIUS_KM * 0.985 },
        uPxPerRad: { value: 1000 },
        uBlobRadius: { value: 1 },
        uAlpha: { value: 0 },
        uFade: { value: 1 },
        uDaylight: { value: 0 },
        uMaxPx: { value: 1 },
        uExtinction: { value: 0 },
        uSoftness: { value: 1.0 },
        uTint: { value: new Vector4(...PROCEDURAL_TINT, 0) },
      },
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
    });
    const u = this.mat.uniforms;
    u.uBasis.value = model.basis;
    u.uBlobRadius.value = this.blobRadius;
    u.uAlpha.value = alpha;
    u.uMaxPx.value = maxPointPx;
    u.uTint.value.w = 0;
    geo.setDrawRange(0, 0);
    this.points = new Points(geo, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = -12;
    scene.add(this.points);
    this.center.copy(model.center);
  }

  get complete(): boolean { return this.filled === this.count; }
  private get count(): number { return (this.points.geometry.getAttribute('weight') as BufferAttribute).count; }

  /** Sample more blobs, for at most `budgetMs` (Infinity: all the rest) */
  private fill(budgetMs: number): void {
    const geo = this.points.geometry;
    const posA = geo.getAttribute('position') as BufferAttribute, colA = geo.getAttribute('color') as BufferAttribute, wA = geo.getAttribute('weight') as BufferAttribute;
    const pos = posA.array as Float32Array, col = colA.array as Float32Array, w = wA.array as Float32Array;
    const rng = this.rng, model = this.model, v = _local, n = this.count;
    const t0 = performance.now();
    let i = this.filled;
    while (i < n) {
      const end = Math.min(n, i + 4096);
      for (; i < end; i++) {
        const pop = model.sample(rng, v);
        pos[i * 3] = v.x; pos[i * 3 + 1] = v.y; pos[i * 3 + 2] = v.z;
        const c = POPULATION_COLOR[pop];
        const j = rng.range(0.9, 1.1);
        col[i * 3] = c[0] * j; col[i * 3 + 1] = c[1]; col[i * 3 + 2] = c[2] / j;
        w[i] = pop === 'bulge' ? 1.3 : pop === 'hii' ? 1.5 : pop === 'arm' ? 1.15 : 1.0;
        w[i] *= rng.range(0.6, 1.4);
      }
      if (performance.now() - t0 > budgetMs) break;
    }
    for (const a of [posA, colA, wA]) {
      a.addUpdateRange(this.filled * a.itemSize, (i - this.filled) * a.itemSize);
      a.needsUpdate = true;
    }
    this.filled = i;
    geo.setDrawRange(0, i);
  }

  /** Daytime sky (0 none … 1 full): the Milky Way is the first thing a bright sky takes */
  setDaylight(d: number): void { this.mat.uniforms.uDaylight.value = Math.min(1, d * 1.5); }

  /** @param camPc camera (scene pc) @param fovDeg vertical field of view */
  update(camPc: Vector3, pxPerRad: number, pixelRatio: number, visible: boolean, fovDeg = 50): void {
    const u = this.mat.uniforms;
    u.uCenterRel.value.copy(this.center).sub(camPc);
    u.uPxPerRad.value = pxPerRad;
    u.uPixelRatio.value = pixelRatio;
    const ratio = u.uCenterRel.value.length() / this.model.radius;
    // crossfade with the sprite: fully on inside 8 radii, gone beyond 18; and gone again under a
    // telescopic field of view, where the unresolved blobs would magnify into soft patches
    const fade = (1 - smoothstep(8, 18, ratio)) * smoothstep(4, 12, fovDeg);
    u.uFade.value = fade;
    if (!this.complete) this.fill(fade > 0.3 ? 12 : 4);
    // inside a disc: dust limits the view to the nearest few kpc (≈1 mag/kpc)
    let ext = 0;
    if (this.model.p.type !== 'E' && ratio < 1.3) {
      this.model.toLocal(camPc, _local);
      const hz = this.model.scaleHeight;
      const r = Math.hypot(_local.x, _local.z);
      const inPlane = (1 - smoothstep(hz * 1.5, hz * 6, Math.abs(_local.y))) * (1 - smoothstep(this.model.radius, this.model.radius * 1.3, r));
      ext = inPlane / (this.model.radius * 0.33);
    }
    u.uExtinction.value = ext;
    this.points.visible = visible && fade > 0.001;
    const v = this.volume;
    const volumetric = !!v && this.volumes!.enabled;
    // a cloud still being built carries the full light in fewer blobs
    u.uAlpha.value = this.fullAlpha * (volumetric ? POINT_SHARE : 1) * (this.count / Math.max(this.filled, 1));
    if (v) {
      v.place(camPc, this.center, this.model.radius, v.u.uToLocal.value, pxPerRad);
      v.u.uFade.value = fade;
      v.u.uSteps.value = ratio < 1.4 ? 88 : 60;
      v.active = visible && volumetric;
    }
  }

  /** Tint the cloud green when it belongs to a procedural (non-catalogue) galaxy */
  setHighlight(on: boolean): void {
    this.mat.uniforms.uTint.value.w = on && !this.model.p.catalog ? 0.85 : 0;
  }

  setGain(g: number): void {
    this.fullAlpha = g * (this.model.luminosity / (this.points.geometry.getAttribute('position').count)) / (this.blobRadius * this.blobRadius);
  }

  dispose(scene: Scene): void {
    if (this.volume) this.volumes!.remove(this.volume);
    scene.remove(this.points);
    this.points.geometry.dispose();
    matPool.push(this.mat);
  }
}

function smoothstep(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}
