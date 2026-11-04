import {
  HalfFloatType, LinearFilter, NoBlending, type PerspectiveCamera, type Scene, ShaderMaterial, Vector2, Vector3, WebGLRenderTarget, type WebGLRenderer,
} from 'three';
import { FullScreenQuad, Pass } from 'three/addons/postprocessing/Pass.js';
import { Shaders } from './shaders';

/** scene layer of the objects drawn into the light-shaft mask (cloud decks) */
export const GODRAYS_LAYER = 7;

/**
 * Crepuscular rays of the brightest star in view: screen-space light shafts (GPU Gems 3, ch. 13)
 * seeded by the star's disc where it is not covered — the depth buffer gives the ground, the
 * horizon, moons and rings; the cloud decks are drawn over the mask in their own mask mode and
 * carve the shafts. Rays need air to scatter in: the owner sets the strength from the density
 * of the atmosphere around the camera, so there are none in open space.
 */
export class GodRaysPass extends Pass {
  private readonly mask: WebGLRenderTarget;
  private readonly rays: WebGLRenderTarget;
  /** the unoccluded source and its blur: the reference the shafts are measured against */
  private readonly base: WebGLRenderTarget;
  private readonly full: WebGLRenderTarget;
  private readonly maskMat: ShaderMaterial;
  private readonly blurMat: ShaderMaterial;
  private readonly addMat: ShaderMaterial;
  private readonly quad: FullScreenQuad;
  /** the cloud materials switched into mask mode while the decks are drawn (uMask uniform) */
  cloudMaterials: ShaderMaterial[] = [];
  private scene: Scene | null = null;
  private camera: PerspectiveCamera | null = null;
  /** overall strength this frame (0 disables the pass's work) */
  strength = 0;
  private readonly color = new Vector3(1, 1, 1);
  private w = 1;
  private h = 1;

  constructor() {
    super();
    this.needsSwap = true;
    const opts = { type: HalfFloatType, depthBuffer: false, generateMipmaps: false, minFilter: LinearFilter, magFilter: LinearFilter };
    this.mask = new WebGLRenderTarget(1, 1, opts);
    this.rays = new WebGLRenderTarget(1, 1, opts);
    this.base = new WebGLRenderTarget(1, 1, opts);
    this.full = new WebGLRenderTarget(1, 1, opts);
    this.maskMat = new ShaderMaterial({
      uniforms: { tDepth: { value: null }, uSun: { value: new Vector2() }, uSunDepth: { value: 1 }, uRadius: { value: 0.01 }, uAspect: { value: 1 }, uOpen: { value: 0 } },
      vertexShader: Shaders.fullscreenVert, fragmentShader: Shaders.godraysMaskFrag,
      depthTest: false, depthWrite: false, blending: NoBlending,
    });
    this.blurMat = new ShaderMaterial({
      uniforms: { tDiffuse: { value: this.mask.texture }, uSun: { value: new Vector2() }, uDensity: { value: 0.9 }, uDecay: { value: 0.965 } },
      vertexShader: Shaders.fullscreenVert, fragmentShader: Shaders.godraysBlurFrag,
      depthTest: false, depthWrite: false, blending: NoBlending,
    });
    this.addMat = new ShaderMaterial({
      uniforms: { tDiffuse: { value: null }, tRays: { value: this.rays.texture }, tFull: { value: this.full.texture }, uColor: { value: this.color }, uShadow: { value: 0.55 }, tDepth: { value: null }, uSunDepth: { value: 1 } },
      vertexShader: Shaders.fullscreenVert, fragmentShader: Shaders.godraysAddFrag,
      depthTest: false, depthWrite: false, blending: NoBlending,
    });
    this.quad = new FullScreenQuad(this.maskMat);
  }

  attach(scene: Scene, camera: PerspectiveCamera): void {
    this.scene = scene;
    this.camera = camera;
  }

  /**
   * Point the pass at a star. `ndc` is its screen position, `radiusNdc` the disc radius in NDC x
   * units, `depth` its encoded depth, `color` its light; `strength` scales the shafts (0: none).
   */
  target(ndc: Vector2, radiusNdc: number, depth: number, color: Vector3, strength: number, aspect: number): void {
    this.strength = strength;
    if (strength <= 0) return;
    const mu = this.maskMat.uniforms, bu = this.blurMat.uniforms;
    (mu.uSun.value as Vector2).copy(ndc);
    // at least ~2.5 mask texels so a distant star still seeds the shafts
    mu.uRadius.value = Math.max(radiusNdc, 5 / Math.max(this.w, 1));
    mu.uSunDepth.value = depth;
    this.addMat.uniforms.uSunDepth.value = depth;
    mu.uAspect.value = aspect;
    (bu.uSun.value as Vector2).set(ndc.x * 0.5 + 0.5, ndc.y * 0.5 + 0.5);
    this.color.copy(color).multiplyScalar(strength);
  }

  setSize(width: number, height: number): void {
    // quarter resolution: the shafts are soft by nature
    this.w = Math.max(1, Math.round(width / 4));
    this.h = Math.max(1, Math.round(height / 4));
    for (const rt of [this.mask, this.rays, this.base, this.full]) rt.setSize(this.w, this.h);
  }

  render(renderer: WebGLRenderer, writeBuffer: WebGLRenderTarget, readBuffer: WebGLRenderTarget): void {
    if (this.strength <= 0 || !readBuffer.depthTexture) {
      // nothing to add: pass the frame through untouched
      this.needsSwap = false;
      return;
    }
    this.needsSwap = true;
    const autoClear = renderer.autoClear;
    renderer.autoClear = false;
    // 1. source mask from the disc and the depth buffer (and once unoccluded, as the reference)
    const mu = this.maskMat.uniforms;
    mu.tDepth.value = readBuffer.depthTexture;
    this.quad.material = this.maskMat;
    mu.uOpen.value = 1;
    renderer.setRenderTarget(this.base);
    this.quad.render(renderer);
    mu.uOpen.value = 0;
    renderer.setRenderTarget(this.mask);
    this.quad.render(renderer);
    // 2. the cloud decks carve it (their alpha, black)
    if (this.scene && this.camera && this.cloudMaterials.length) {
      for (const m of this.cloudMaterials) m.uniforms.uMask.value = 1;
      const layers = this.camera.layers.mask;
      this.camera.layers.set(GODRAYS_LAYER);
      renderer.render(this.scene, this.camera);
      this.camera.layers.mask = layers;
      for (const m of this.cloudMaterials) m.uniforms.uMask.value = 0;
    }
    // 3. radial blur toward the star, of both
    const bu = this.blurMat.uniforms;
    this.quad.material = this.blurMat;
    bu.tDiffuse.value = this.mask.texture;
    renderer.setRenderTarget(this.rays);
    this.quad.render(renderer);
    bu.tDiffuse.value = this.base.texture;
    renderer.setRenderTarget(this.full);
    this.quad.render(renderer);
    // 4. add to the frame
    this.addMat.uniforms.tDiffuse.value = readBuffer.texture;
    this.addMat.uniforms.tDepth.value = readBuffer.depthTexture;
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    if (this.clear) renderer.clear();
    this.quad.material = this.addMat;
    this.quad.render(renderer);
    renderer.autoClear = autoClear;
  }

  dispose(): void {
    for (const rt of [this.mask, this.rays, this.base, this.full]) rt.dispose();
    this.maskMat.dispose();
    this.blurMat.dispose();
    this.addMat.dispose();
    this.quad.dispose();
  }
}
