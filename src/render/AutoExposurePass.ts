import {
  HalfFloatType, LinearFilter, LinearMipmapLinearFilter, NoBlending, ShaderMaterial, Vector2, WebGLRenderTarget, type IUniform, type WebGLRenderer,
} from 'three';
import { FullScreenQuad, Pass } from 'three/addons/postprocessing/Pass.js';
import type { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { Shaders } from './shaders';

/** meter buffer side (texels): its top mip is the frame's geometric-mean luminance */
const METER_N = 128;
/** adaptation time constants (s): quick toward a brighter scene, slow back into the dark */
const TAU_UP = 0.35;
const TAU_DOWN = 1.2;

/**
 * Eye adaptation for the whole frame. The HDR buffer is metered (centre-weighted log-average
 * luminance, a small mipmapped buffer); the adapted level follows it with a time constant in a
 * one-texel state texture (ping-pong), and the gain it implies is applied by the output pass, so
 * the pass itself costs no full-resolution work. Everything stays on the GPU: a readback would be
 * a CPU–GPU sync point, and that is a stutter in every frame. Dark scenes are left alone (gain 1):
 * stars and planets keep their physical scale. The heart of a galaxy or a sky full of nebula is
 * pulled back to a bright scene with detail, as Space Engine's auto exposure does.
 */
export class AutoExposurePass extends Pass {
  private readonly meter: WebGLRenderTarget;
  private readonly state: WebGLRenderTarget[] = [];
  private front = 0;
  private readonly meterMat: ShaderMaterial;
  private readonly adaptMat: ShaderMaterial;
  private readonly quad: FullScreenQuad;
  private reset = true;
  private output: IUniform | null = null;
  /** metering and gain on; off, the output is left at gain 1 (the pass stays in the chain so the state follows) */
  active = true;
  /** frame time (s), set by the owner before the composer runs */
  dt = 1 / 60;
  /** log-average where the gain starts to fall: a daylit planet from orbit, the Sun's disc in view
   *  and a dusk on the ground stay below it; the bulge of a galaxy reads 0.4 … 3 */
  target = Math.log(0.12);
  /** 0: off … 1: full compensation above the target */
  strength = 0.9;
  minGain = 0.03;

  constructor() {
    super();
    this.needsSwap = false;
    this.meter = new WebGLRenderTarget(METER_N, METER_N, {
      type: HalfFloatType, depthBuffer: false, generateMipmaps: true, minFilter: LinearMipmapLinearFilter, magFilter: LinearFilter,
    });
    for (let i = 0; i < 2; i++) this.state.push(new WebGLRenderTarget(1, 1, { type: HalfFloatType, depthBuffer: false, generateMipmaps: false, minFilter: LinearFilter, magFilter: LinearFilter }));
    this.meterMat = new ShaderMaterial({
      uniforms: { tDiffuse: { value: null }, uStep: { value: new Vector2(0.25 / METER_N, 0.25 / METER_N) } },
      vertexShader: Shaders.fullscreenVert,
      fragmentShader: Shaders.exposureMeterFrag,
      depthTest: false, depthWrite: false, blending: NoBlending,
    });
    this.adaptMat = new ShaderMaterial({
      uniforms: {
        uMeter: { value: this.meter.texture }, uLod: { value: Math.log2(METER_N) }, uPrev: { value: null },
        uUp: { value: 0 }, uDown: { value: 0 }, uReset: { value: 1 }, uActive: { value: 1 },
        uTarget: { value: this.target }, uStrength: { value: this.strength }, uMinGain: { value: this.minGain },
      },
      vertexShader: Shaders.fullscreenVert,
      fragmentShader: Shaders.exposureAdaptFrag,
      depthTest: false, depthWrite: false, blending: NoBlending,
    });
    this.quad = new FullScreenQuad(this.meterMat);
  }

  /**
   * Let the output pass apply the gain: its shader multiplies the HDR colour by the state's gain
   * texel ahead of tone mapping (exactly what a change of exposure does)
   */
  bindOutput(pass: OutputPass): void {
    const u: IUniform = { value: this.state[this.front].texture };
    pass.uniforms.tGain = u;
    this.output = u;
    pass.material.fragmentShader = pass.material.fragmentShader
      .replace('uniform sampler2D tDiffuse;', 'uniform sampler2D tDiffuse;\n\t\tuniform sampler2D tGain;')
      .replace('gl_FragColor = texture2D( tDiffuse, vUv );', 'gl_FragColor = texture2D( tDiffuse, vUv );\n\t\t\tgl_FragColor.rgb *= texture2D( tGain, vec2( 0.5 ) ).g;');
    pass.material.needsUpdate = true;
  }

  /** forget the adapted level: the next reading is taken as is (teleports, scene cuts) */
  resetAdaptation(): void { this.reset = true; }

  /** the state texture: R adapted log luminance, G the gain in force */
  get stateTexture() { return this.state[this.front].texture; }

  render(renderer: WebGLRenderer, _writeBuffer: WebGLRenderTarget, readBuffer: WebGLRenderTarget): void {
    const dt = Math.min(this.dt, 0.1);
    const autoClear = renderer.autoClear;
    renderer.autoClear = false;
    if (this.active) {
      // 1. meter: log luminance of the frame in a small mipmapped buffer
      this.meterMat.uniforms.tDiffuse.value = readBuffer.texture;
      renderer.setRenderTarget(this.meter);
      this.quad.material = this.meterMat;
      this.quad.render(renderer);
    }
    // 2. the adapted level follows its top mip; the gain comes with it (one texel, ping-pong)
    const back = 1 - this.front;
    const u = this.adaptMat.uniforms;
    u.uPrev.value = this.state[this.front].texture;
    u.uUp.value = 1 - Math.exp(-dt / TAU_UP);
    u.uDown.value = 1 - Math.exp(-dt / TAU_DOWN);
    u.uReset.value = this.reset ? 1 : 0;
    u.uActive.value = this.active ? 1 : 0;
    u.uTarget.value = this.target;
    u.uStrength.value = this.strength;
    u.uMinGain.value = this.minGain;
    this.reset = false;
    renderer.setRenderTarget(this.state[back]);
    this.quad.material = this.adaptMat;
    this.quad.render(renderer);
    this.front = back;
    if (this.output) this.output.value = this.state[back].texture;
    renderer.autoClear = autoClear;
  }

  dispose(): void {
    this.meter.dispose();
    for (const s of this.state) s.dispose();
    this.meterMat.dispose();
    this.adaptMat.dispose();
    this.quad.dispose();
  }
}
