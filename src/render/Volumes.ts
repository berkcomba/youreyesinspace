import {
  BufferAttribute, BufferGeometry, CubeCamera, CustomBlending, Euler, HalfFloatType, LinearFilter, LinearMipmapLinearFilter, Matrix3, Matrix4, Mesh, OneFactor,
  OrthographicCamera, Scene, ShaderMaterial, SrcAlphaFactor, Vector2, Vector3, Vector4, WebGLCoordinateSystem, WebGLCubeRenderTarget, WebGLRenderTarget, ZeroFactor,
  type IUniform, PerspectiveCamera, type WebGLRenderer,
} from 'three';
import type { GalaxyModel } from '../galaxy/GalaxyModel';
import { Shaders } from './shaders';

/** most volumes raymarched per frame (each costs a full-screen pass) */
const MAX_GALAXIES = 2;
const MAX_NEBULAE = 3;
/** inside this many radii a galaxy is the backdrop, cached in a cube map */
const CUBE_RATIO = 1.4;
/** camera travel (galaxy radii) after which the cached backdrop is re-rendered (≈20 pc for the Milky Way) */
const CUBE_REFRESH = 0.0015;
/** each cube face is raymarched in this many strips, one per frame (a whole face is a frame's worth of GPU time) */
const FACE_STRIPS = 4;
/** buffer resolution (linear) and step share while a galaxy is raymarched on the move: motion hides the softer image */
const RACING_SCALE = 0.6;
const RACING_STEPS = 0.5;
/** approaching / leaving a galaxy faster than this share of its distance per frame counts as racing */
const RACING_APPROACH = 0.01;

/** Visible-light dust opacity of a Milky-Way-like disc at the solar circle (per pc; with the lane / filament factors ≈0.5 mag/kpc mean) */
const DUST_PER_PC = 0.0028;
const DUST_BY_TYPE: Record<string, number> = { E: 0, S0: 0.25, S: 1, SB: 1, Irr: 0.5 };
const TYPE_CODE: Record<string, number> = { E: 0, S0: 1, S: 2, SB: 3, Irr: 4 };

export type NebulaKind = 'emission' | 'reflection' | 'planetary' | 'remnant';
const NEBULA_CODE: Record<NebulaKind, number> = { emission: 0, reflection: 1, planetary: 2, remnant: 3 };
const NEBULA_EMIT: Record<NebulaKind, number> = { emission: 0.2, reflection: 0.22, planetary: 0.12, remnant: 0.12 };

/** A raymarched object: one full-screen pass into the volume buffer */
export class Volume {
  readonly mesh: Mesh;
  /** camera distance in object radii (ordering, culling) */
  ratio = Infinity;
  /** apparent radius (px) */
  px = 0;
  active = false;
  /** object-local origin of the previous frame (speed) */
  readonly lastOrigin = new Vector3(Infinity, 0, 0);
  /** frames left of reduced quality after the last fast frame */
  racing = 0;
  constructor(readonly kind: 'galaxy' | 'nebula', readonly mat: ShaderMaterial, geo: BufferGeometry) {
    this.mesh = new Mesh(geo, mat);
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
  }
  get u(): Record<string, IUniform> { return this.mat.uniforms; }
  /** camera (scene pc) → object-local origin; `toLocal` is the scene → local rotation */
  place(camPc: Vector3, centrePc: Vector3, radiusPc: number, toLocal: Matrix3, pxPerRad: number): void {
    const o = this.u.uOrigin.value as Vector3;
    o.copy(camPc).sub(centrePc).applyMatrix3(toLocal).multiplyScalar(1 / radiusPc);
    this.ratio = o.length();
    this.px = (pxPerRad * radiusPc) / Math.max(this.ratio * radiusPc, 1e-9);
  }
}

/**
 * Volumetric galaxies and nebulae: emission and dust absorption integrated along every view ray
 * (SpaceEngine-style), rendered at reduced resolution and laid over the sky behind all solid
 * bodies. Far galaxies / small nebulae stay sprites and point clouds; these take over once the
 * object is large on screen.
 */
export class Volumes {
  enabled = true;
  /** debugging: raymarch the backdrop every frame instead of using the cached cube */
  forceDirect = false;
  /** buffer resolution relative to the drawing buffer */
  scale = 0.5;
  private rt: WebGLRenderTarget;
  private readonly scene = new Scene();
  private readonly cam = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly geo: BufferGeometry;
  private readonly composite: Mesh;
  private readonly compositeMat: ShaderMaterial;
  private readonly invProj = new Matrix4();
  private readonly camRot = new Matrix3();
  private readonly list: Volume[] = [];

  constructor(mainScene: Scene) {
    this.geo = new BufferGeometry();
    this.geo.setAttribute('position', new BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
    this.geo.setAttribute('uv', new BufferAttribute(new Float32Array([0, 0, 2, 0, 0, 2]), 2));
    // mipmapped: its top level is the frame's mean glow (eye adaptation in the composite)
    this.rt = new WebGLRenderTarget(4, 4, { type: HalfFloatType, depthBuffer: false, generateMipmaps: true, minFilter: LinearMipmapLinearFilter, magFilter: LinearFilter });
    this.compositeMat = new ShaderMaterial({
      vertexShader: Shaders.volumeVert,
      fragmentShader: Shaders.volumeCompositeFrag,
      uniforms: {
        uVol: { value: this.rt.texture }, uDaylight: { value: 0 }, uTexel: { value: new Vector2(0.25, 0.25) }, uUvScale: { value: new Vector2(1, 1) },
        uRtLod: { value: 2 }, uRtUsed: { value: 0 }, uCubeLod: { value: 9 },
        uCube: { value: null }, uUseCube: { value: 0 }, uInvProj: { value: new Matrix4() }, uCamRot: { value: new Matrix3() },
      },
      transparent: true, depthWrite: false, depthTest: true,
      blending: CustomBlending, blendSrc: OneFactor, blendDst: SrcAlphaFactor, blendSrcAlpha: ZeroFactor, blendDstAlpha: OneFactor,
    });
    this.composite = new Mesh(this.geo, this.compositeMat);
    this.composite.frustumCulled = false;
    // after the galaxy sprites (other galaxies are dimmed by this one's dust), before the point
    // clouds and stars (drawn one by one on top)
    this.composite.renderOrder = -12.5;
    this.composite.visible = false;
    mainScene.add(this.composite);
  }

  setDaylight(d: number): void { this.compositeMat.uniforms.uDaylight.value = Math.min(1, d * 1.5); }

  private warmMats: ShaderMaterial[] = [];
  /**
   * Compile the raymarch programs up front (in the background where the driver allows): the first
   * nebula or galaxy we fly into would otherwise stall a frame on shader linking. The materials
   * stay alive so the cached programs are not released.
   */
  warm(renderer: WebGLRenderer): void {
    if (this.warmMats.length) return;
    const scene = new Scene();
    for (const frag of [Shaders.volumeGalaxyFrag, Shaders.volumeNebulaFrag]) {
      const m = this.material(frag, {});
      this.warmMats.push(m);
      const mesh = new Mesh(this.geo, m);
      mesh.frustumCulled = false;
      scene.add(mesh);
    }
    const prev = renderer.getRenderTarget();
    // same target type as the real passes: the program cache key depends on it
    renderer.setRenderTarget(this.rt);
    void renderer.compileAsync(scene, this.cam).catch(() => undefined);
    renderer.setRenderTarget(prev);
  }

  private material(frag: string, extra: Record<string, IUniform>): ShaderMaterial {
    return new ShaderMaterial({
      vertexShader: Shaders.volumeVert,
      fragmentShader: frag,
      uniforms: {
        uInvProj: { value: this.invProj }, uCamRot: { value: this.camRot },
        uToLocal: { value: new Matrix3() }, uOrigin: { value: new Vector3() }, uBox: { value: new Vector3(1.4, 1.4, 1.4) },
        uSteps: { value: 64 }, uFade: { value: 0 }, uEmit: { value: 1 }, uSeed: { value: 0 },
        ...extra,
      },
      transparent: true, depthWrite: false, depthTest: false,
      // front-to-back "over" in premultiplied form: rgb = src + dst·srcT, T = dst·srcT
      blending: CustomBlending, blendSrc: OneFactor, blendDst: SrcAlphaFactor, blendSrcAlpha: ZeroFactor, blendDstAlpha: SrcAlphaFactor,
    });
  }

  /** Volume for a galaxy model; `pointShare` of the light stays with its point cloud */
  galaxy(model: GalaxyModel, gain: number, pointShare: number): Volume {
    const p = model.p;
    const R = model.radius;
    const t = p.type;
    const blobs = Array.from({ length: 6 }, (_, i) => {
      const b = model.blobs[i];
      return b ? new Vector4(b.c.x / R, b.c.y / R, b.c.z / R, b.s / R) : new Vector4(0, 0, 0, 1);
    });
    const mat = this.material(Shaders.volumeGalaxyFrag, {
      uType: { value: TYPE_CODE[t] }, uArms: { value: Math.max(1, p.arms) },
      uTanPitch: { value: Math.tan((p.pitchDeg * Math.PI) / 180) },
      uR0: { value: Math.max(model.barLength, model.bulgeRadius * 0.8) / R },
      uPhase0: { value: model.armPhase[0] ?? 0 },
      uMinorOdd: { value: t === 'SB' && p.arms > 2 ? 1 : 0 },
      uBar: { value: model.barLength / R }, uBulge: { value: model.bulgeRadius / R },
      uHs: { value: model.scaleLength / R }, uHz: { value: model.scaleHeight / R }, uAxis: { value: p.axisRatio },
      uDust: { value: DUST_PER_PC * R * (DUST_BY_TYPE[t] ?? 0) },
      uNear: { value: 0.07 },
      // individuality: lopsided / warped arms, flocculent (patchy) discs, inner rings of barred spirals
      uWarp: { value: 0.1 + 0.5 * hash01(p.seed, 1) },
      uFloc: { value: t === 'S' && hash01(p.seed, 2) < 0.35 ? 0.5 + 0.5 * hash01(p.seed, 3) : 0.15 * hash01(p.seed, 3) },
      uRing: { value: t === 'SB' && hash01(p.seed, 4) < 0.45 ? 1 : t === 'S0' && hash01(p.seed, 4) < 0.3 ? 0.6 : 0 },
      uBlobs: { value: blobs },
      uBlobW: { value: Array.from({ length: 6 }, (_, i) => model.blobs[i]?.w ?? 0) },
      uNBlobs: { value: Math.min(6, model.blobs.length) },
    });
    // column luminosity → pixel value with the sprites' calibration (0.16·π·gain per L☉/pc²)
    mat.uniforms.uEmit.value = 0.5 * gain * model.luminosity * R / model.densityIntegral() * (1 - pointShare);
    mat.uniforms.uSeed.value = (p.seed % 997) * 0.37;
    (mat.uniforms.uToLocal.value as Matrix3).copy(model.basis).transpose();
    const bulgeH = (model.bulgeRadius * 6 * 0.7) / R;
    const box = mat.uniforms.uBox.value as Vector3;
    if (t === 'E') box.set(1.4, 1.4 * Math.max(0.3, p.axisRatio), 1.4);
    else if (t === 'Irr') box.set(1.4, 0.6, 1.4);
    else box.set(1.4, Math.min(1.4, Math.max((model.scaleHeight * 10) / R, bulgeH)), 1.4);
    const v = new Volume('galaxy', mat, this.geo);
    this.add(v);
    return v;
  }

  /** Volume for a nebula of the given kind; `rng01` draws its structure */
  nebula(kind: NebulaKind, color: readonly number[], rng01: () => number): Volume {
    const clumps: Vector4[] = [];
    const weights: number[] = [];
    const n = 4 + Math.floor(rng01() * 3);
    for (let i = 0; i < 6; i++) {
      const v = ballPoint(rng01).multiplyScalar(i === 0 ? 0.3 : 0.6);
      clumps.push(new Vector4(v.x, v.y, v.z, i === 0 ? 0.35 + rng01() * 0.15 : 0.22 + rng01() * 0.28));
      weights.push(i === 0 ? 1 : 0.5 + rng01() * 0.5);
    }
    const axis = ballPoint(rng01).normalize();
    const mat = this.material(Shaders.volumeNebulaFrag, {
      uKind: { value: NEBULA_CODE[kind] },
      uColor: { value: new Vector3(color[0], color[1], color[2]) },
      uClumps: { value: clumps }, uClumpW: { value: weights }, uNClumps: { value: n },
      uAxis: { value: axis }, uBipolar: { value: rng01() < 0.6 ? 1 : 0 },
      uDust: { value: kind === 'emission' ? 2.5 : kind === 'reflection' ? 1.2 : 1.0 },
    });
    mat.uniforms.uSeed.value = rng01() * 100;
    // peak column ≈ the sprite's brightness (uFade carries the physical / navigation level)
    mat.uniforms.uEmit.value = NEBULA_EMIT[kind];
    mat.uniforms.uSteps.value = 56;
    mat.uniforms.uBox.value.set(1.3, 1.3, 1.3);
    // random orientation: no two nebulae seen from the same side
    const q = new Matrix4().makeRotationFromEuler(new Euler(rng01() * 6.28, rng01() * 6.28, rng01() * 6.28));
    (mat.uniforms.uToLocal.value as Matrix3).setFromMatrix4(q);
    const v = new Volume('nebula', mat, this.geo);
    this.add(v);
    return v;
  }

  private add(v: Volume): void {
    this.list.push(v);
    this.scene.add(v.mesh);
  }

  remove(v: Volume): void {
    const i = this.list.indexOf(v);
    if (i >= 0) this.list.splice(i, 1);
    this.scene.remove(v.mesh);
    v.mat.dispose();
  }

  /** Raymarch the active volumes into the buffer; call right before the main render */
  render(renderer: WebGLRenderer, camera: PerspectiveCamera): void {
    const pick = (kind: 'galaxy' | 'nebula', max: number) => this.list
      .filter((v) => v.kind === kind && v.active && (v.u.uFade.value as number) > 0.003)
      .sort((a, b) => b.px - a.px).slice(0, max);
    const galaxies = this.enabled ? pick('galaxy', MAX_GALAXIES).sort((a, b) => b.ratio - a.ratio) : [];
    const nebulae = this.enabled ? pick('nebula', MAX_NEBULAE).sort((a, b) => b.ratio - a.ratio) : [];
    for (const v of this.list) v.mesh.visible = false;

    const prevTarget = renderer.getRenderTarget();
    const prevAlpha = renderer.getClearAlpha();
    const prevAuto = renderer.autoClear;
    renderer.setClearAlpha(1);
    renderer.autoClear = false;

    // the galaxy we are inside barely changes until we travel tens of parsecs: it is raymarched into
    // a cube map (a strip of a face per frame, double-buffered) and only looked up per frame
    const inside = galaxies.find((v) => v.ratio < CUBE_RATIO) ?? null;
    if (!inside) this.racing = false;
    const useCube = inside !== null && !this.forceDirect && this.backdropCube(renderer, inside);
    const draw = [...galaxies.filter((v) => !(useCube && v === inside)), ...nebulae];
    for (const v of galaxies) {
      const o = v.u.uOrigin.value as Vector3;
      if (o.distanceTo(v.lastOrigin) > RACING_APPROACH * v.ratio) v.racing = 8;
      else if (v.racing > 0) v.racing--;
      v.lastOrigin.copy(o);
    }
    // the backdrop drawn directly is always transient (racing, or its cube still being rebuilt)
    const rough = (v: Volume) => v.kind === 'galaxy' && (v === inside ? !this.forceDirect : v.racing > 0);
    const cu = this.compositeMat.uniforms;
    cu.uUseCube.value = useCube ? 1 : 0;
    cu.uCube.value = this.cubes[this.front]?.texture ?? null;
    this.composite.visible = draw.length > 0 || useCube;

    camera.updateMatrixWorld();
    this.invProj.copy(camera.projectionMatrixInverse);
    this.camRot.setFromMatrix4(camera.matrixWorld);
    cu.uInvProj.value.copy(this.invProj);
    cu.uCamRot.value.copy(this.camRot);
    const size = renderer.getDrawingBufferSize(_size);
    const w = Math.max(4, Math.round(size.x * this.scale)), h = Math.max(4, Math.round(size.y * this.scale));
    if (this.rt.width !== w || this.rt.height !== h) { this.rt.setSize(w, h); cu.uTexel.value.set(1 / w, 1 / h); cu.uRtLod.value = Math.floor(Math.log2(Math.max(w, h))); }
    // a galaxy raymarched on the move: a smaller part of the same buffer, no reallocation
    const f = draw.some(rough) ? RACING_SCALE : 1;
    const vw = Math.max(4, Math.round(w * f)), vh = Math.max(4, Math.round(h * f));
    cu.uUvScale.value.set(vw / w, vh / h);
    const rt = this.rt;
    rt.viewport.set(0, 0, vw, vh);
    rt.scissor.set(0, 0, w, h);
    rt.scissorTest = true;
    renderer.setRenderTarget(rt);
    renderer.clear(true, false, false);
    // each volume only where its bounding sphere lands on screen: small / distant ones cost a few
    // thousand pixels instead of a full-screen pass
    const tanX = this.invProj.elements[0], tanY = this.invProj.elements[5];
    let drawn = false;
    for (const v of draw) {
      const r = screenRect(v, this.camRot, tanX, tanY);
      if (!r) continue;
      const x0 = Math.max(0, Math.floor((r[0] + 1) * 0.5 * vw) - 2), x1 = Math.min(vw, Math.ceil((r[1] + 1) * 0.5 * vw) + 2);
      const y0 = Math.max(0, Math.floor((r[2] + 1) * 0.5 * vh) - 2), y1 = Math.min(vh, Math.ceil((r[3] + 1) * 0.5 * vh) + 2);
      if (x1 <= x0 || y1 <= y0) continue;
      rt.scissor.set(x0, y0, x1 - x0, y1 - y0);
      renderer.setRenderTarget(rt);
      const steps = v.u.uSteps.value as number;
      if (rough(v)) v.u.uSteps.value = Math.round(steps * RACING_STEPS);
      v.mesh.visible = true;
      renderer.render(this.scene, this.cam);
      v.mesh.visible = false;
      v.u.uSteps.value = steps;
      drawn = true;
    }
    // only a render regenerates the mipmaps: after a bare clear the top level is stale
    cu.uRtUsed.value = drawn ? 1 : 0;
    rt.scissorTest = false;
    rt.viewport.set(0, 0, w, h);
    rt.scissor.set(0, 0, w, h);

    renderer.setRenderTarget(prevTarget);
    renderer.setClearAlpha(prevAlpha);
    renderer.autoClear = prevAuto;
  }

  private readonly cubes: WebGLCubeRenderTarget[] = [];
  private front = 0;
  /** camera origin (galaxy-local) the front cube was rendered from, and of the one being built */
  private readonly cubeAt = new Vector3(Infinity, 0, 0);
  private readonly buildAt = new Vector3();
  private building = -1;
  private cubeOwner: Volume | null = null;
  /** backdrop origin of the previous frame (speed) */
  private readonly lastAt = new Vector3();
  /** moving too fast for the cube: the backdrop is raymarched directly */
  private racing = false;
  private readonly cubeCams: PerspectiveCamera[] = [];

  /** Keep the backdrop cube fresh; true if it can be used this frame */
  private backdropCube(renderer: WebGLRenderer, v: Volume): boolean {
    if (!this.cubes.length) {
      const n = this.scale < 0.45 ? 320 : 512;
      this.compositeMat.uniforms.uCubeLod.value = Math.floor(Math.log2(n));
      for (let i = 0; i < 2; i++) this.cubes.push(new WebGLCubeRenderTarget(n, { type: HalfFloatType, depthBuffer: false, generateMipmaps: true, minFilter: LinearMipmapLinearFilter, magFilter: LinearFilter }));
      const cc = new CubeCamera(1, 10, this.cubes[0]);
      cc.coordinateSystem = WebGLCoordinateSystem;
      cc.updateCoordinateSystem();
      cc.updateMatrixWorld(true);
      for (const c of cc.children as PerspectiveCamera[]) { c.updateMatrixWorld(true); this.cubeCams.push(c); }
    }
    const origin = v.u.uOrigin.value as Vector3;
    if (this.cubeOwner !== v) { this.cubeOwner = v; this.cubeAt.set(Infinity, 0, 0); this.building = -1; this.lastAt.copy(origin); }
    const moved = origin.distanceTo(this.cubeAt);
    // a rebuild takes 6·FACE_STRIPS frames: at this speed it would be stale before it is done, so
    // the faces are not even started (they used to cost an extra pass on top of the direct raymarch)
    this.racing = origin.distanceTo(this.lastAt) * 6 * FACE_STRIPS > CUBE_REFRESH * 3;
    this.lastAt.copy(origin);
    if (this.building < 0 && moved > CUBE_REFRESH && !this.racing) { this.building = 0; this.buildAt.copy(origin); }
    if (this.building >= 0) {
      // travelling fast: the faces would be stale before they are done; raymarch directly instead
      if (this.racing || origin.distanceTo(this.buildAt) > CUBE_REFRESH * 4) { this.building = -1; return false; }
      const back = this.cubes[1 - this.front];
      const faceIndex = Math.floor(this.building / FACE_STRIPS), strip = this.building % FACE_STRIPS;
      const face = this.cubeCams[faceIndex];
      const saved = origin.clone();
      origin.copy(this.buildAt);
      this.invProj.copy(face.projectionMatrixInverse);
      this.camRot.setFromMatrix4(face.matrixWorld);
      const n = back.width, y0 = Math.round((strip * n) / FACE_STRIPS), y1 = Math.round(((strip + 1) * n) / FACE_STRIPS);
      back.scissor.set(0, y0, n, y1 - y0);
      back.scissorTest = true;
      v.mesh.visible = true;
      renderer.setRenderTarget(back, faceIndex);
      renderer.clear(true, false, false);
      renderer.render(this.scene, this.cam);
      v.mesh.visible = false;
      back.scissorTest = false;
      origin.copy(saved);
      if (++this.building === 6 * FACE_STRIPS) { this.building = -1; this.front = 1 - this.front; this.cubeAt.copy(this.buildAt); }
    }
    return origin.distanceTo(this.cubeAt) < CUBE_REFRESH * 4;
  }

  dispose(): void {
    for (const v of [...this.list]) this.remove(v);
    this.rt.dispose();
    for (const c of this.cubes) c.dispose();
    this.compositeMat.dispose();
    this.geo.dispose();
  }
}

const _size = new Vector2();
const _c = new Vector3();
const _m = new Matrix3();
const HALF_PI = Math.PI / 2;

/**
 * NDC rectangle [x0, x1, y0, y1] covered by a volume's bounding sphere, or null when it is off
 * screen. `camRot` is camera → scene; tanX / tanY are the projection's tan(half fov) terms.
 */
function screenRect(v: Volume, camRot: Matrix3, tanX: number, tanY: number): [number, number, number, number] | null {
  const u = v.u;
  const r = (u.uBox.value as Vector3).length();
  // centre relative to the camera, local → scene → camera (rotations: inverse = transpose)
  _c.copy(u.uOrigin.value as Vector3).negate()
    .applyMatrix3(_m.copy(u.uToLocal.value as Matrix3).transpose())
    .applyMatrix3(_m.copy(camRot).transpose());
  if (_c.length() <= r * 1.001) return [-1, 1, -1, 1];
  const x = axisRange(_c.x, -_c.z, r, tanX);
  const y = x && axisRange(_c.y, -_c.z, r, tanY);
  return x && y ? [x[0], x[1], y[0], y[1]] : null;
}

/** NDC interval of a sphere along one screen axis (a: offset along it, depth: forward distance) */
function axisRange(a: number, depth: number, r: number, tanHalf: number): [number, number] | null {
  const l = Math.hypot(a, depth);
  if (l <= r * 1.001) return [-1, 1];
  const phi = Math.atan2(a, depth), half = Math.asin(r / l);
  const lo = phi - half, hi = phi + half;
  if (hi <= -HALF_PI || lo >= HALF_PI) return null;
  const n0 = lo <= -HALF_PI ? -1 : Math.max(-1, Math.tan(lo) / tanHalf);
  const n1 = hi >= HALF_PI ? 1 : Math.min(1, Math.tan(hi) / tanHalf);
  return n0 < 1 && n1 > -1 && n1 > n0 ? [n0, n1] : null;
}

/** deterministic 0…1 from a seed and a salt */
function hash01(seed: number, salt: number): number {
  let h = (Math.imul(seed | 0, 0x9e3779b1) ^ Math.imul(salt, 0x85ebca6b)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
  h = (h ^ (h >>> 12)) >>> 0;
  return h / 4294967296;
}

function ballPoint(rng01: () => number): Vector3 {
  for (;;) {
    const v = new Vector3(rng01() * 2 - 1, rng01() * 2 - 1, rng01() * 2 - 1);
    if (v.lengthSq() <= 1) return v;
  }
}
