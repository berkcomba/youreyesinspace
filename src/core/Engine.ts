import {
  ACESFilmicToneMapping, Color, PerspectiveCamera, SRGBColorSpace, Scene, Vector2, WebGLRenderer,
} from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { CAMERA_FAR_KM, CAMERA_NEAR_KM } from './constants';
import { BlackHolePass } from '../render/BlackHolePass';

/** Renderer + camera + post-processing. Camera stays at the origin (floating origin). */
export class Engine {
  readonly renderer: WebGLRenderer;
  readonly scene = new Scene();
  readonly camera: PerspectiveCamera;
  readonly composer: EffectComposer;
  readonly bloom: UnrealBloomPass;
  /** gravitational lensing (enabled only while a black hole is resolvable) */
  readonly blackHole: BlackHolePass;
  width = 1;
  height = 1;
  pixelRatio = 1;
  useComposer = true;
  /** user render-resolution scale (1 = device pixels, capped) */
  renderScale = 1;
  /** coarse-pointer devices (phones/tablets): cheaper defaults */
  readonly mobile = window.matchMedia('(pointer: coarse)').matches;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new WebGLRenderer({
      canvas,
      antialias: true,
      logarithmicDepthBuffer: true,
      powerPreference: 'high-performance',
      alpha: false,
    });
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.setClearColor(new Color(0x000000), 1);
    this.renderer.autoClear = true;

    this.camera = new PerspectiveCamera(50, 1, CAMERA_NEAR_KM, CAMERA_FAR_KM);
    this.camera.position.set(0, 0, 0);

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.blackHole = new BlackHolePass();
    this.blackHole.quality = this.mobile ? 0.5 : 1;
    this.composer.addPass(this.blackHole);
    this.bloom = new UnrealBloomPass(new Vector2(1, 1), 0.35, 0.4, 0.92);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize(): void {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    // phones have DPR 3 and small GPUs: cap lower than on desktop, then apply the user's scale
    const cap = this.mobile ? 1.5 : 2;
    this.pixelRatio = Math.max(0.5, Math.min(window.devicePixelRatio || 1, cap) * this.renderScale);
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.setSize(this.width, this.height, false);
    this.composer.setPixelRatio(this.pixelRatio);
    this.composer.setSize(this.width, this.height);
    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
  }

  setRenderScale(scale: number): void {
    if (scale === this.renderScale) return;
    this.renderScale = scale;
    this.resize();
  }

  setFov(deg: number): void {
    this.camera.fov = deg;
    this.camera.updateProjectionMatrix();
  }

  render(): void {
    if (this.useComposer) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
  }
}
