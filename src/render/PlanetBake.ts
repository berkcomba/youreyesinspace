import {
  HalfFloatType, LinearFilter, LinearMipmapLinearFilter, Mesh, OrthographicCamera, PlaneGeometry, RGBAFormat, Scene, ShaderMaterial,
  SRGBColorSpace, UnsignedByteType, WebGLCubeRenderTarget, type IUniform, type WebGLRenderer,
} from 'three';
import { Shaders } from './shaders';
import type { BodyView } from './BodyRenderer';

/**
 * Baked surface maps of a procedural body.
 *
 * The globe shaders describe every world as functions of the direction on the sphere (height,
 * albedo, cloud bands). Evaluating them per pixel every frame limits how rich they can be and
 * leaves the far view shimmering (no mipmaps). Instead each body that grows to a few pixels is
 * baked once into two cube maps — A: albedo + material flag, N: slopes + cavity + height — a
 * few faces per frame, and the surface shader samples those (mipmapped, anisotropic) from then
 * on, adding procedural grain only where the camera comes closer than the bake resolves.
 */
export interface SurfaceBake {
  a: WebGLCubeRenderTarget;
  n: WebGLCubeRenderTarget;
  res: number;
  bytes: number;
}

type BakeKind = 'terrestrial' | 'gas';

interface Job {
  view: BodyView;
  kind: BakeKind;
  res: number;
  /** 0 height → scratch, 1 albedo → A, 2 slopes → N */
  pass: number;
  face: number;
  a: WebGLCubeRenderTarget;
  n: WebGLCubeRenderTarget;
  /** pass 0: the scratch cube is the target, so it must not be bound as this material's sampler */
  height: ShaderMaterial;
  surface: ShaderMaterial;
  normal: ShaderMaterial;
  /** the three programs have linked (programsReady) */
  linked: boolean;
}

/** texels per face edge: the base tier, and the close-up tier */
export const BAKE_RES = 512;
export const BAKE_RES_CLOSE = 1024;
/** apparent radius (px) from which a body is baked, and from which the close-up tier is wanted */
const BAKE_PX = 2.5;
const CLOSE_PX = 360;
/** GPU memory the finished bakes may hold (bytes, mipmaps included); the least recently seen go first */
const BUDGET = 192 * 1024 * 1024;
/** seconds for the maps to fade in over the procedural surface */
export const BAKE_FADE_S = 0.6;

function bytesOf(res: number): number {
  return Math.round(2 * 6 * res * res * 4 * 1.34);
}

export class SurfaceBaker {
  private readonly scene = new Scene();
  private readonly cam = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly quad: Mesh;
  private readonly scratch = new Map<number, WebGLCubeRenderTarget>();
  private job: Job | null = null;
  private readonly done = new Map<BodyView, SurfaceBake>();
  private readonly lastSeen = new Map<BodyView, number>();
  private bytes = 0;

  constructor(private readonly renderer: WebGLRenderer, private readonly maxAnisotropy = 1) {
    this.quad = new Mesh(new PlaneGeometry(2, 2), new ShaderMaterial());
    this.quad.frustumCulled = false;
    this.scene.add(this.quad);
  }

  /** true while a bake is in progress or one is still wanted by a visible view */
  pending(views: readonly BodyView[]): boolean {
    if (this.job) return true;
    for (const v of views) {
      const res = SurfaceBaker.wanted(v);
      if (res && (this.done.get(v)?.res ?? 0) < res) return true;
    }
    return false;
  }

  /** Tier a view wants right now (0 = none) */
  static wanted(view: BodyView): number {
    if (!view.meshVisible || view.imageryActive || view.bakeKind === null) return 0;
    if (view.apparentRadiusPx < BAKE_PX) return 0;
    return view.apparentRadiusPx > CLOSE_PX ? BAKE_RES_CLOSE : BAKE_RES;
  }

  /** Advance the current bake by a few faces, start the next most urgent one. */
  update(views: readonly BodyView[], now: number): void {
    for (const v of views) if (v.meshVisible && v.apparentRadiusPx >= BAKE_PX) this.lastSeen.set(v, now);
    if (!this.job) {
      let best: BodyView | null = null, bestPx = 0, bestRes = 0;
      for (const v of views) {
        const res = SurfaceBaker.wanted(v);
        if (!res) continue;
        const have = this.done.get(v);
        if (have && have.res >= res) continue;
        if (v.apparentRadiusPx > bestPx) { best = v; bestPx = v.apparentRadiusPx; bestRes = res; }
      }
      if (best) this.start(best, bestRes);
    }
    if (this.job) this.step();
  }

  private start(view: BodyView, res: number): void {
    const kind = view.bakeKind!;
    if (!this.reserve(bytesOf(res), view)) return;
    const mk = (srgb: boolean) => {
      const rt = new WebGLCubeRenderTarget(res, {
        format: RGBAFormat, type: UnsignedByteType, depthBuffer: false, stencilBuffer: false,
        generateMipmaps: true, minFilter: LinearMipmapLinearFilter, magFilter: LinearFilter,
        ...(srgb ? { colorSpace: SRGBColorSpace } : {}),
      });
      rt.texture.anisotropy = this.maxAnisotropy;
      return rt;
    };
    const a = mk(true), n = mk(false);
    const scratch = this.scratchFor(res);
    const palette = view.surfaceMat!.uniforms;
    const shared: Record<string, IUniform> = {};
    for (const [k, u] of Object.entries(palette)) shared[k] = u;
    const frag = kind === 'gas' ? Shaders.bakeGasFrag : Shaders.bakeTerrestrialFrag;
    const height = new ShaderMaterial({
      vertexShader: Shaders.fullscreenVert, fragmentShader: frag,
      uniforms: { ...shared, uFace: { value: 0 }, uRes: { value: res }, uPass: { value: 0 }, uHeightMap: { value: null } },
      depthTest: false, depthWrite: false,
    });
    const surface = new ShaderMaterial({
      vertexShader: Shaders.fullscreenVert, fragmentShader: frag,
      uniforms: { ...shared, uFace: { value: 0 }, uRes: { value: res }, uPass: { value: 1 }, uHeightMap: { value: scratch.texture } },
      depthTest: false, depthWrite: false,
    });
    // cavity strength: the small worlds' relief is modest, their hollows should not go black
    const normal = new ShaderMaterial({
      vertexShader: Shaders.fullscreenVert,
      fragmentShader: Shaders.bakeNormalFrag,
      uniforms: { uFace: { value: 0 }, uRes: { value: res }, uPass: { value: 2 }, uHeightMap: { value: scratch.texture }, uCavityScale: { value: kind === 'gas' ? 3 : 9 } },
      depthTest: false, depthWrite: false,
    });
    this.job = { view, kind, res, pass: 0, face: 0, a, n, height, surface, normal, linked: false };
  }

  /**
   * Hand the job's programs to the driver and report whether they have linked. With
   * KHR_parallel_shader_compile that happens in the background; the first bake draw would wait for
   * it on the main thread instead — the terrestrial noise stack takes tens of seconds on D3D
   * (ANGLE) with a cold cache, the page frozen meanwhile.
   */
  private programsReady(j: Job): boolean {
    if (j.linked) return true;
    const r = this.renderer;
    const prevTarget = r.getRenderTarget();
    r.setRenderTarget(this.scratchFor(j.res), 0);
    let linked = true;
    for (const m of [j.height, j.surface, j.normal]) {
      this.quad.material = m;
      r.compile(this.scene, this.cam);
      const p = (r.properties.get(m) as { currentProgram?: { isReady(): boolean } }).currentProgram;
      if (p && !p.isReady()) linked = false;
    }
    r.setRenderTarget(prevTarget);
    return (j.linked = linked);
  }

  private scratchFor(res: number): WebGLCubeRenderTarget {
    let rt = this.scratch.get(res);
    if (!rt) {
      rt = new WebGLCubeRenderTarget(res, {
        format: RGBAFormat, type: HalfFloatType, depthBuffer: false, stencilBuffer: false,
        generateMipmaps: false, minFilter: LinearFilter, magFilter: LinearFilter,
      });
      this.scratch.set(res, rt);
    }
    return rt;
  }

  /** Make room for `bytes` under the budget; false if the bake would not fit even then. */
  private reserve(bytes: number, keep: BodyView): boolean {
    if (bytes > BUDGET) return false;
    while (this.bytes + bytes > BUDGET) {
      let victim: BodyView | null = null, oldest = Infinity;
      for (const v of this.done.keys()) {
        if (v === keep) continue;
        const t = this.lastSeen.get(v) ?? 0;
        if (t < oldest) { oldest = t; victim = v; }
      }
      if (!victim) return false;
      this.release(victim);
    }
    return true;
  }

  private step(): void {
    const j = this.job!;
    if (!this.programsReady(j)) return;
    const r = this.renderer;
    const prevTarget = r.getRenderTarget();
    const prevAuto = r.autoClear;
    r.autoClear = false;
    // the height pass is the expensive one (the whole noise stack per texel)
    const perFrame = j.pass === 0 ? (j.res > BAKE_RES ? 1 : 2) : 3;
    for (let i = 0; i < perFrame && j.pass < 3; i++) {
      const target = j.pass === 0 ? this.scratchFor(j.res) : j.pass === 1 ? j.a : j.n;
      const mat = j.pass === 0 ? j.height : j.pass === 1 ? j.surface : j.normal;
      mat.uniforms.uFace.value = j.face;
      this.quad.material = mat;
      r.setRenderTarget(target, j.face);
      r.render(this.scene, this.cam);
      if (++j.face === 6) { j.face = 0; j.pass++; }
    }
    r.setRenderTarget(prevTarget);
    r.autoClear = prevAuto;
    if (j.pass < 3) return;
    // finished: hand the maps to the view, retire the previous tier
    j.height.dispose();
    j.surface.dispose();
    j.normal.dispose();
    const old = this.done.get(j.view);
    if (old) { old.a.dispose(); old.n.dispose(); this.bytes -= old.bytes; }
    const bake: SurfaceBake = { a: j.a, n: j.n, res: j.res, bytes: bytesOf(j.res) };
    this.done.set(j.view, bake);
    this.bytes += bake.bytes;
    j.view.setBake(bake);
    // the close-up scratch is large: keep only the base one around
    if (j.res > BAKE_RES) { this.scratch.get(j.res)?.dispose(); this.scratch.delete(j.res); }
    this.job = null;
  }

  /** Drop a view's maps (it left the scene, or made room for another) */
  release(view: BodyView): void {
    if (this.job?.view === view) {
      this.job.a.dispose(); this.job.n.dispose(); this.job.height.dispose(); this.job.surface.dispose(); this.job.normal.dispose();
      this.job = null;
    }
    const b = this.done.get(view);
    if (b) {
      b.a.dispose(); b.n.dispose();
      this.bytes -= b.bytes;
      this.done.delete(view);
      view.setBake(null);
    }
    this.lastSeen.delete(view);
  }

  dispose(): void {
    for (const v of [...this.done.keys()]) this.release(v);
    for (const s of this.scratch.values()) s.dispose();
    this.scratch.clear();
    this.quad.geometry.dispose();
  }
}
