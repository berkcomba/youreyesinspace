import {
  BufferAttribute, BufferGeometry, CubeCamera, CustomBlending, HalfFloatType, LinearFilter, LinearMipmapLinearFilter, Matrix3, Matrix4, Mesh, OneFactor,
  OrthographicCamera, Scene, ShaderMaterial, SrcAlphaFactor, Vector2, Vector3, Vector4, WebGLCoordinateSystem, WebGLCubeRenderTarget, WebGLRenderTarget, ZeroFactor,
  type IUniform, PerspectiveCamera, type WebGLRenderer,
} from 'three';
import type { GalaxyModel } from '../galaxy/GalaxyModel';
import { GpuTimer } from './GpuTimer';
import { MORPHOLOGY_CODE, PALETTE_CODE, type NebulaProfile } from './nebula/NebulaProfile';
import { Shaders } from './shaders';

/** most volumes raymarched per frame (each costs a full-screen pass) */
const MAX_GALAXIES = 2;
/**
 * every resolved nebula is raymarched, down to a few pixels across (ProcClouds' slots plus the
 * clouds still fading out of one): a small one costs only the few pixels of its screen rect, and
 * all of them go to the buffer in one draw list
 */
const MAX_NEBULAE = 112;
/** inside this many radii a galaxy is the backdrop, cached in a cube map */
const CUBE_RATIO = 1.4;
/** leaving a galaxy, its whole-sky mean fades out of the eye adaptation between CUBE_RATIO and this (galaxy radii) */
const ADAPT_OUT_RATIO = 2.1;
/** camera travel (galaxy radii) after which the cached backdrop is re-rendered (≈20 pc for the Milky Way) */
const CUBE_REFRESH = 0.0015;
/** each cube face is raymarched in this many strips, one per frame (a whole face is a frame's worth of GPU time) */
const FACE_STRIPS = 4;
/** buffer resolution (linear) and step share of the backdrop galaxy raymarched directly (on the move / while its cube is rebuilt): motion hides the softer image */
const RACING_SCALE = 0.6;
const RACING_STEPS = 0.5;
/** approaching / leaving a galaxy faster than this share of its distance per frame counts as racing */
const RACING_APPROACH = 0.01;
/** cross-fade time (s) between the cached backdrop cube and the direct raymarch of the same galaxy */
const CUBE_BLEND_S = 0.4;
/** buffer shrink (linear) once the drawn volumes cover the view, the pixel budget it then aims for on large buffers, its floor (relative to the drawing buffer) and the smoothing of the coverage (s) */
const COVER_SHRINK = 0.3;
const COVER_BUDGET_PX = 600_000;
const COVER_MIN_SCALE = 0.3;
const COVER_TAU_S = 0.3;
/** GPU budget loop: lowest resolution factor, and its rates (per second) down while over budget and back up */
const QUALITY_MIN = 0.6;
const QUALITY_DOWN_RATE = 0.6;
const QUALITY_UP_RATE = 0.12;
/** eye adaptation time constant (s): short, so a wheel step or a turn is not followed by a visible re-exposure; it only irons out single-frame glitches */
const ADAPT_TAU_S = 0.08;

/** Visible-light dust opacity of a Milky-Way-like disc at the solar circle (per pc; with the lane / filament factors ≈0.5 mag/kpc mean) */
const DUST_PER_PC = 0.0028;
const DUST_BY_TYPE: Record<string, number> = { E: 0, S0: 0.25, S: 1, SB: 1, Irr: 0.5 };
const TYPE_CODE: Record<string, number> = { E: 0, S0: 1, S: 2, SB: 3, Irr: 4 };

/** Nebula Engine 2.0: emission calibration per morphology (peak column ≈ the sprite's brightness) */
const PROFILE_EMIT: Record<NebulaProfile['morphology'], number> = {
  'hii-cavity': 1.6, 'hii-pillars': 1.6, 'molecular-dark': 1.0, 'reflection-wisps': 2.6,
  'planetary-shell': 0.9, 'planetary-bipolar': 0.9, 'snr-filaments': 1.0, 'wind-bubble': 1.0,
};
const PROFILE_STEPS: Record<NebulaProfile['morphology'], number> = {
  'hii-cavity': 80, 'hii-pillars': 80, 'molecular-dark': 64, 'reflection-wisps': 56,
  'planetary-shell': 96, 'planetary-bipolar': 96, 'snr-filaments': 88, 'wind-bubble': 80,
};

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
  /** the full step budget, while a frame's draw runs on a share of it */
  steps = 0;
  /** share of the full step budget this frame (ProcClouds: a nebula a few pixels across needs a fraction of it) */
  stepScale = 1;
  constructor(readonly kind: 'galaxy' | 'nebula', readonly mat: ShaderMaterial, geo: BufferGeometry) {
    this.mesh = new Mesh(geo, mat);
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
  }
  get u(): Record<string, IUniform> { return this.mat.uniforms; }
  /** radius (local units) of the sphere the shader actually marches: the screen rect it is drawn in */
  get bound(): number { return this.kind === 'nebula' ? 1.3 : (this.u.uBox.value as Vector3).length(); }
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
  /** Nebula Engine 2.0 debug view for profile nebulae: 0 off, 1 gas, 2 dust, 3 ionisation, 4 transmittance */
  debug = 0;
  /** buffer resolution relative to the drawing buffer */
  scale = 0.5;
  /** GPU time of the volume pass (null until the first render; unsupported drivers report NaN) */
  gpu: GpuTimer | null = null;
  private rt: WebGLRenderTarget;
  /** the backdrop galaxy raymarched directly, at reduced resolution (see RACING_SCALE) */
  private rt2: WebGLRenderTarget;
  private readonly scene = new Scene();
  private readonly cam = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly geo: BufferGeometry;
  /** unit quad of the nebulae: each is drawn into the screen rect of its bounding sphere (uRect) */
  private readonly quad: BufferGeometry;
  private readonly composite: Mesh;
  private readonly compositeMat: ShaderMaterial;
  private readonly invProj = new Matrix4();
  private readonly camRot = new Matrix3();
  private readonly list: Volume[] = [];
  private readonly adaptRt: WebGLRenderTarget[] = [];
  private readonly adaptMat: ShaderMaterial;
  private readonly adaptScene = new Scene();
  private adaptFront = 0;
  private adaptReset = true;
  /** share of the cached backdrop shown: cross-fades with the direct raymarch instead of switching */
  private cubeMix = 0;
  /**
   * weight of the cube's whole-sky mean in the eye adaptation. Unlike cubeMix it does not follow
   * the display path: a stale cube (racing, direct raymarch) still gives the right mean light, so
   * setting off, stopping or the cube rebuild never shift the exposure. Ramps in once a cube exists
   * and out again between CUBE_RATIO and ADAPT_OUT_RATIO as we leave the galaxy.
   */
  private adaptCube = 0;
  private lastFrameMs = 0;
  /** smoothed share of the view the drawn volumes cover (buffer resolution, see render) */
  private cover = 0;
  /** GPU time (ms) the pass may take per frame before its resolution is eased down */
  budgetMs = 6;
  /** resolution factor (QUALITY_MIN … 1) the GPU budget loop currently applies */
  quality = 1;

  constructor(mainScene: Scene) {
    this.geo = new BufferGeometry();
    this.geo.setAttribute('position', new BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
    this.geo.setAttribute('uv', new BufferAttribute(new Float32Array([0, 0, 2, 0, 0, 2]), 2));
    this.quad = new BufferGeometry();
    this.quad.setAttribute('position', new BufferAttribute(new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, -1, 0, 1, 1, 0, -1, 1, 0]), 3));
    this.quad.setAttribute('uv', new BufferAttribute(new Float32Array([0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1]), 2));
    // mipmapped: its top level is the frame's mean glow (eye adaptation in the composite)
    this.rt = new WebGLRenderTarget(4, 4, { type: HalfFloatType, depthBuffer: false, generateMipmaps: true, minFilter: LinearMipmapLinearFilter, magFilter: LinearFilter });
    this.rt2 = new WebGLRenderTarget(4, 4, { type: HalfFloatType, depthBuffer: false, generateMipmaps: true, minFilter: LinearMipmapLinearFilter, magFilter: LinearFilter });
    this.compositeMat = new ShaderMaterial({
      vertexShader: Shaders.volumeVert,
      fragmentShader: Shaders.volumeCompositeFrag,
      uniforms: {
        uVol: { value: this.rt.texture }, uDaylight: { value: 0 }, uTexel: { value: new Vector2(0.25, 0.25) }, uView: { value: new Vector2(1, 1) },
        uVol2: { value: this.rt2.texture }, uTexel2: { value: new Vector2(0.25, 0.25) }, uDirectMix: { value: 0 },
        uCube: { value: null }, uCubeMix: { value: 0 }, uAdapt: { value: null }, uInvProj: { value: new Matrix4() }, uCamRot: { value: new Matrix3() },
      },
      transparent: true, depthWrite: false, depthTest: true,
      blending: CustomBlending, blendSrc: OneFactor, blendDst: SrcAlphaFactor, blendSrcAlpha: ZeroFactor, blendDstAlpha: OneFactor,
    });
    // eye adaptation state: one texel, ping-ponged, pulled toward the frame's mean glow each frame
    for (let i = 0; i < 2; i++) this.adaptRt.push(new WebGLRenderTarget(1, 1, { type: HalfFloatType, depthBuffer: false, generateMipmaps: false, minFilter: LinearFilter, magFilter: LinearFilter }));
    this.adaptMat = new ShaderMaterial({
      vertexShader: Shaders.volumeVert,
      fragmentShader: Shaders.volumeAdaptFrag,
      uniforms: {
        uVol: { value: this.rt.texture }, uRtLod: { value: 2 }, uRtUsed: { value: 0 },
        uVol2: { value: this.rt2.texture }, uRt2Lod: { value: 2 }, uDirectW: { value: 0 },
        uCube: { value: null }, uCubeW: { value: 0 }, uCubeLod: { value: 9 },
        uPrev: { value: null }, uBlend: { value: 1 },
      },
      depthWrite: false, depthTest: false,
    });
    const adaptMesh = new Mesh(this.geo, this.adaptMat);
    adaptMesh.frustumCulled = false;
    this.adaptScene.add(adaptMesh);
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
    for (const frag of [Shaders.volumeGalaxyFrag, Shaders.volumeNebula2Frag]) {
      const m = this.material(frag, frag === Shaders.volumeNebula2Frag ? profileUniforms() : {});
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
      vertexShader: RECT_VERT,
      fragmentShader: frag,
      uniforms: {
        uRect: { value: new Vector4(-1, 1, -1, 1) },
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
      uNear: { value: 0.07 }, uCoreFade: { value: 1 },
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

  /**
   * Nebula Engine 2.0: a volume driven by a resolved profile (morphology family, salted structure
   * seeds, local star lights, palette). The object's orientation and lights come from the profile,
   * so the same id always renders the same nebula.
   */
  nebulaProfile(profile: NebulaProfile): Volume {
    const extra = profileUniforms();
    extra.uMorph.value = MORPHOLOGY_CODE[profile.morphology];
    extra.uPalette.value = PALETTE_CODE[profile.paletteId];
    (extra.uTint.value as Vector3).set(profile.tint[0], profile.tint[1], profile.tint[2]);
    extra.uEmission.value = profile.emissionScale;
    extra.uExtinction.value = profile.extinctionScale;
    extra.uTurb.value = profile.turbulence;
    extra.uFilScale.value = profile.filamentScale;
    extra.uCavity.value = profile.cavityScale;
    (extra.uAxis.value as Vector3).copy(profile.axis);
    extra.uDoubleShell.value = profile.doubleShell;
    const lights = extra.uLights.value as Vector4[];
    const cols = extra.uLightCol.value as Vector3[];
    const n = Math.min(4, profile.lights.length);
    for (let i = 0; i < n; i++) {
      const l = profile.lights[i];
      lights[i].set(l.position.x, l.position.y, l.position.z, l.intensity);
      cols[i].copy(l.color);
    }
    extra.uNLights.value = n;
    extra.uDebug.value = this.debug;
    const mat = this.material(Shaders.volumeNebula2Frag, extra);
    mat.uniforms.uSeed.value = (profile.seed % 1000) * 0.173;
    mat.uniforms.uEmit.value = PROFILE_EMIT[profile.morphology];
    mat.uniforms.uSteps.value = PROFILE_STEPS[profile.morphology];
    mat.uniforms.uBox.value.set(1.3, 1.3, 1.3);
    const q = new Matrix4().makeRotationFromQuaternion(profile.orientation);
    (mat.uniforms.uToLocal.value as Matrix3).setFromMatrix4(q);
    const v = new Volume('nebula', mat, this.quad);
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
    for (const v of nebulae) if (v.u.uDebug) v.u.uDebug.value = this.debug;
    this.gpu ??= new GpuTimer(renderer);
    this.gpu.begin();

    const prevTarget = renderer.getRenderTarget();
    const prevAlpha = renderer.getClearAlpha();
    const prevAuto = renderer.autoClear;
    renderer.setClearAlpha(1);
    renderer.autoClear = false;

    // the galaxy we are inside barely changes until we travel tens of parsecs: it is raymarched into
    // a cube map (a strip of a face per frame, double-buffered) and only looked up per frame
    const inside = galaxies.find((v) => v.ratio < CUBE_RATIO) ?? null;
    if (!inside) this.racing = false;
    const now = performance.now();
    const dt = this.lastFrameMs ? Math.min(0.1, (now - this.lastFrameMs) / 1000) : 1 / 60;
    this.lastFrameMs = now;
    const ownerBefore = this.cubeOwner;
    const useCube = inside !== null && !this.forceDirect && this.backdropCube(renderer, inside);
    // the cube and the direct raymarch differ a little (resolution, steps): cross-fade between
    // them instead of switching, so stopping, setting off or crossing the backdrop radius never
    // changes the sky in one frame
    if (this.cubeOwner !== ownerBefore) this.cubeMix = 0;
    const step = dt / CUBE_BLEND_S;
    this.cubeMix = useCube ? Math.min(1, this.cubeMix + step) : Math.max(0, this.cubeMix - step);
    // the backdrop galaxy drawn directly (its cube missing, stale or still fading in) goes to its
    // own smaller buffer: motion hides the softer image, and the nebulae in front keep their
    // resolution whatever the backdrop is doing
    const backdropVol = this.cubeMix > 0 ? this.cubeOwner : inside;
    const direct = backdropVol !== null && this.cubeMix < 1 && galaxies.includes(backdropVol) ? backdropVol : null;
    const draw = [...galaxies.filter((v) => v !== backdropVol), ...nebulae];
    for (const v of galaxies) {
      const o = v.u.uOrigin.value as Vector3;
      if (o.distanceTo(v.lastOrigin) > RACING_APPROACH * v.ratio) v.racing = 8;
      else if (v.racing > 0) v.racing--;
      v.lastOrigin.copy(o);
    }
    const cu = this.compositeMat.uniforms, au = this.adaptMat.uniforms;
    cu.uCubeMix.value = this.cubeMix;
    cu.uDirectMix.value = direct ? 1 - this.cubeMix : 0;
    cu.uCube.value = au.uCube.value = this.cubes[this.front]?.texture ?? null;
    // eye adaptation inputs. The cube's whole-sky mean stands for the galaxy we are in whenever a
    // cube exists, stale or not (its mean light hardly changes over a rebuild distance); leaving,
    // it hands over to the view mean of the galaxy now in front of us
    const owner = this.cubeOwner;
    const cubeOk = owner !== null && galaxies.includes(owner) && Number.isFinite(this.cubeAt.x);
    const wantCube = !cubeOk ? 0 : inside === owner ? 1 : 1 - smoothstep(CUBE_RATIO, ADAPT_OUT_RATIO, owner.ratio);
    this.adaptCube = wantCube > this.adaptCube ? Math.min(wantCube, this.adaptCube + step) : wantCube;
    au.uCubeW.value = this.adaptCube;
    // the direct raymarch only counts while no cube exists yet (entering) or once we are leaving;
    // its view mean is scaled by the view's share of the sky so it hands over to the cube's
    // whole-sky mean without a step (the rest of the sky around a galaxy we are in is dark)
    const tv = Math.tan((camera.fov * Math.PI) / 360), th = tv * camera.aspect;
    const skyShare = Math.asin(Math.sin(Math.atan(tv)) * Math.sin(Math.atan(th))) / Math.PI;
    au.uDirectW.value = direct ? (1 - this.cubeMix) * (inside !== null ? 1 - this.adaptCube : 1) * skyShare : 0;
    this.composite.visible = draw.length > 0 || direct !== null || this.cubeMix > 0;

    camera.updateMatrixWorld();
    this.invProj.copy(camera.projectionMatrixInverse);
    this.camRot.setFromMatrix4(camera.matrixWorld);
    cu.uInvProj.value.copy(this.invProj);
    cu.uCamRot.value.copy(this.camRot);
    const tanX = this.invProj.elements[0], tanY = this.invProj.elements[5];
    // a volume filling the view (the nebula we fly through) is a full-screen raymarch of dozens of
    // noise samples per pixel: the buffer shrinks with the drawn area. The medium is soft at that
    // range, so the coarser grid hardly shows, while the small, distant volumes keep the full grid
    let cover = 0;
    for (const v of draw) {
      const r = screenRect(v, this.camRot, tanX, tanY);
      if (r) cover += (r[1] - r[0]) * (r[3] - r[2]) * 0.25;
    }
    cover = Math.min(1, cover);
    this.cover += (cover - this.cover) * Math.min(1, dt / COVER_TAU_S);
    const size = renderer.getDrawingBufferSize(_size);
    // covered: a share of the base resolution, and on large (HiDPI) buffers a pixel budget, so a
    // 3k-wide display does not march six times the samples of a laptop panel for the same haze
    const covered = Math.min(this.scale, Math.max(Math.min(this.scale * (1 - COVER_SHRINK), Math.sqrt(COVER_BUDGET_PX / (size.x * size.y))), COVER_MIN_SCALE));
    let scale = this.scale + (covered - this.scale) * smoothstep(0.2, 0.8, this.cover);
    // and the pass keeps to its GPU budget whatever the machine: measured over the last frames,
    // the resolution eases down while it runs over (cost ∝ pixels) and creeps back once well under
    const ms = this.gpu.ms;
    if (this.gpu.supported && Number.isFinite(ms) && this.gpu.samples > 3) {
      if (ms > this.budgetMs) this.quality = Math.max(QUALITY_MIN, this.quality - dt * QUALITY_DOWN_RATE * Math.min(3, ms / this.budgetMs - 1));
      else if (ms < this.budgetMs * 0.6) this.quality = Math.min(1, this.quality + dt * QUALITY_UP_RATE);
    } else this.quality = 1;
    scale = Math.max(scale * this.quality, Math.min(this.scale, COVER_MIN_SCALE * QUALITY_MIN));
    // the buffer is allocated once at the base size and the frame drawn into a viewport of it:
    // no reallocation (a hitch) and no step in the image when the resolution moves
    const baseW = Math.max(4, Math.round(size.x * this.scale)), baseH = Math.max(4, Math.round(size.y * this.scale));
    if (this.rt.width !== baseW || this.rt.height !== baseH) { this.rt.setSize(baseW, baseH); cu.uTexel.value.set(1 / baseW, 1 / baseH); au.uRtLod.value = Math.floor(Math.log2(Math.max(baseW, baseH))); }
    const w = Math.max(4, Math.min(baseW, Math.round(size.x * scale))), h = Math.max(4, Math.min(baseH, Math.round((w * baseH) / baseW)));
    this.rt.viewport.set(0, 0, w, h);
    (cu.uView.value as Vector2).set(w / baseW, h / baseH);
    const w2 = Math.max(4, Math.round(baseW * RACING_SCALE)), h2 = Math.max(4, Math.round(baseH * RACING_SCALE));
    if (this.rt2.width !== w2 || this.rt2.height !== h2) { this.rt2.setSize(w2, h2); cu.uTexel2.value.set(1 / w2, 1 / h2); au.uRt2Lod.value = Math.floor(Math.log2(Math.max(w2, h2))); }
    this.rt2.viewport.set(0, 0, w2, h2);
    // each volume only where its bounding sphere lands on screen: small / distant ones cost a few
    // thousand pixels instead of a full-screen pass
    const pass = (rt: WebGLRenderTarget, list: Volume[], roughSteps: (v: Volume) => boolean): boolean => {
      const vw = rt.viewport.z, vh = rt.viewport.w;
      // the whole buffer is cleared, viewport or not: its top mip must stay the (scaled) frame mean
      rt.scissor.set(0, 0, rt.width, rt.height);
      rt.scissorTest = true;
      renderer.setRenderTarget(rt);
      renderer.clear(true, false, false);
      let drawn = false;
      const batch: Volume[] = [];
      for (const v of list) {
        const r = screenRect(v, this.camRot, tanX, tanY);
        if (!r) continue;
        if (v.kind === 'nebula') {
          // the nebulae (dozens, most of them a few pixels across) share one render call: each is
          // a quad over its own rect, drawn in list order (far to near)
          const padX = 4 / vw, padY = 4 / vh;
          (v.u.uRect.value as Vector4).set(Math.max(-1, r[0] - padX), Math.min(1, r[1] + padX), Math.max(-1, r[2] - padY), Math.min(1, r[3] + padY));
          v.mesh.renderOrder = batch.length;
          v.steps = v.u.uSteps.value as number;
          v.u.uSteps.value = Math.max(12, Math.round(v.steps * v.stepScale));
          v.mesh.visible = true;
          batch.push(v);
          continue;
        }
        const x0 = Math.max(0, Math.floor((r[0] + 1) * 0.5 * vw) - 2), x1 = Math.min(vw, Math.ceil((r[1] + 1) * 0.5 * vw) + 2);
        const y0 = Math.max(0, Math.floor((r[2] + 1) * 0.5 * vh) - 2), y1 = Math.min(vh, Math.ceil((r[3] + 1) * 0.5 * vh) + 2);
        if (x1 <= x0 || y1 <= y0) continue;
        rt.scissor.set(x0, y0, x1 - x0, y1 - y0);
        renderer.setRenderTarget(rt);
        const steps = v.u.uSteps.value as number;
        if (roughSteps(v)) v.u.uSteps.value = Math.round(steps * RACING_STEPS);
        v.mesh.visible = true;
        renderer.render(this.scene, this.cam);
        v.mesh.visible = false;
        v.u.uSteps.value = steps;
        drawn = true;
      }
      if (batch.length) {
        rt.scissor.set(0, 0, vw, vh);
        renderer.setRenderTarget(rt);
        renderer.render(this.scene, this.cam);
        for (const v of batch) { v.mesh.visible = false; v.u.uSteps.value = v.steps; }
        drawn = true;
      }
      rt.scissorTest = false;
      rt.scissor.set(0, 0, rt.width, rt.height);
      return drawn;
    };
    // a galaxy approached fast from outside is transient too: fewer steps while it races
    const drawn = pass(this.rt, draw, (v) => v.kind === 'galaxy' && v.racing > 0);
    const drawn2 = direct ? pass(this.rt2, [direct], () => !this.forceDirect) : false;
    // only a render regenerates the mipmaps: after a bare clear the top level is stale. The value
    // is the viewport's share of the buffer: the top mip averages the cleared rest in
    au.uRtUsed.value = drawn ? (w * h) / (baseW * baseH) : 0;
    if (!drawn2) cu.uDirectMix.value = au.uDirectW.value = 0;
    // eye adaptation: pull the state toward this frame's mean glow (one texel, ping-pong)
    const back = 1 - this.adaptFront;
    au.uPrev.value = this.adaptRt[this.adaptFront].texture;
    au.uBlend.value = this.adaptReset ? 1 : 1 - Math.exp(-dt / ADAPT_TAU_S);
    this.adaptReset = false;
    renderer.setRenderTarget(this.adaptRt[back]);
    renderer.render(this.adaptScene, this.cam);
    this.adaptFront = back;
    cu.uAdapt.value = this.adaptRt[back].texture;

    renderer.setRenderTarget(prevTarget);
    renderer.setClearAlpha(prevAlpha);
    renderer.autoClear = prevAuto;
    this.gpu.end();
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
      this.adaptMat.uniforms.uCubeLod.value = Math.floor(Math.log2(n));
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
    this.rt2.dispose();
    for (const c of this.cubes) c.dispose();
    for (const r of this.adaptRt) r.dispose();
    this.adaptMat.dispose();
    this.compositeMat.dispose();
    this.geo.dispose();
    this.quad.dispose();
    this.gpu?.dispose();
  }
}

/**
 * Vertex shader of the raymarched volumes: the geometry's uv spans the NDC rect `uRect`
 * (x0, x1, y0, y1) at the far plane. The full-screen triangle of the galaxies keeps the whole view
 * (its uv runs to 2); a nebula's quad covers only the rect of its bounding sphere.
 */
const RECT_VERT = /* glsl */ `
varying vec2 vUv;
uniform vec4 uRect;
void main() {
  vec2 ndc = mix(uRect.xz, uRect.yw, uv);
  vUv = ndc * 0.5 + 0.5;
  gl_Position = vec4(ndc, 1.0, 1.0);
}`;

/** uniforms of the profile-driven nebula shader (nebula_density / nebula_lighting) */
function profileUniforms(): Record<string, IUniform> {
  return {
    uMorph: { value: 0 }, uTurb: { value: 0.5 }, uFilScale: { value: 1 }, uCavity: { value: 0.3 },
    uAxis: { value: new Vector3(0, 1, 0) }, uDoubleShell: { value: 0 },
    uLights: { value: Array.from({ length: 4 }, () => new Vector4(0, 0, 0, 0)) },
    uLightCol: { value: Array.from({ length: 4 }, () => new Vector3(1, 1, 1)) },
    uNLights: { value: 1 },
    uPalette: { value: 0 }, uTint: { value: new Vector3(1, 1, 1) }, uEmission: { value: 1 }, uExtinction: { value: 1 },
    uDebug: { value: 0 },
  };
}

function smoothstep(a: number, b: number, x: number): number {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
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
  const r = v.bound;
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

