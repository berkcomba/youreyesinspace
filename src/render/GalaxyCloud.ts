import {
  AdditiveBlending, BufferAttribute, BufferGeometry, Points, Scene, ShaderMaterial, Vector3,
} from 'three';
import { SKY_RADIUS_KM } from '../core/constants';
import { Rng } from '../gen/SystemGenerator';
import { GalaxyModel, POPULATION_COLOR } from '../galaxy/GalaxyModel';
import { Shaders } from './shaders';

const _local = new Vector3();

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

  constructor(readonly galaxyIndex: number, readonly model: GalaxyModel, scene: Scene, count: number, maxPointPx: number) {
    const rng = new Rng(model.p.seed ^ 0x9e3779b9);
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const w = new Float32Array(count);
    const v = new Vector3();
    for (let i = 0; i < count; i++) {
      const pop = model.sample(rng, v);
      pos[i * 3] = v.x; pos[i * 3 + 1] = v.y; pos[i * 3 + 2] = v.z;
      const c = POPULATION_COLOR[pop];
      const j = rng.range(0.9, 1.1);
      col[i * 3] = c[0] * j; col[i * 3 + 1] = c[1]; col[i * 3 + 2] = c[2] / j;
      w[i] = pop === 'bulge' ? 1.3 : pop === 'hii' ? 1.5 : pop === 'arm' ? 1.15 : 1.0;
      w[i] *= rng.range(0.6, 1.4);
    }
    this.blobRadius = model.radius / 140;
    // per-blob alpha: total light ∝ L/N, spread over the blob area
    const alpha = GalaxyCloud.gain * (model.luminosity / count) / (this.blobRadius * this.blobRadius);
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(pos, 3));
    geo.setAttribute('color', new BufferAttribute(col, 3));
    geo.setAttribute('weight', new BufferAttribute(w, 1));
    this.mat = new ShaderMaterial({
      vertexShader: Shaders.galaxyCloudVert,
      fragmentShader: Shaders.pointsFrag,
      uniforms: {
        uBasis: { value: model.basis },
        uCenterRel: { value: new Vector3() },
        uPixelRatio: { value: 1 },
        uSkyRadius: { value: SKY_RADIUS_KM * 0.985 },
        uPxPerRad: { value: 1000 },
        uBlobRadius: { value: this.blobRadius },
        uAlpha: { value: alpha },
        uFade: { value: 1 },
        uMaxPx: { value: maxPointPx },
        uExtinction: { value: 0 },
        uSoftness: { value: 1.0 },
      },
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
    });
    this.points = new Points(geo, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = -12;
    scene.add(this.points);
    this.center.copy(model.center);
  }

  /** @param camPc camera (scene pc) */
  update(camPc: Vector3, pxPerRad: number, pixelRatio: number, visible: boolean): void {
    const u = this.mat.uniforms;
    u.uCenterRel.value.copy(this.center).sub(camPc);
    u.uPxPerRad.value = pxPerRad;
    u.uPixelRatio.value = pixelRatio;
    const ratio = u.uCenterRel.value.length() / this.model.radius;
    // crossfade with the sprite: fully on inside 8 radii, gone beyond 18
    const fade = 1 - smoothstep(8, 18, ratio);
    u.uFade.value = fade;
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
  }

  setGain(g: number): void {
    this.mat.uniforms.uAlpha.value = g * (this.model.luminosity / (this.points.geometry.getAttribute('position').count)) / (this.blobRadius * this.blobRadius);
  }

  dispose(scene: Scene): void {
    scene.remove(this.points);
    this.points.geometry.dispose();
    this.mat.dispose();
  }
}

function smoothstep(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}
