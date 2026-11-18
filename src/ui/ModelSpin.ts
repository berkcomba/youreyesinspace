import {
  ACESFilmicToneMapping, Box3, DirectionalLight, Group, HemisphereLight, PerspectiveCamera, Scene, SRGBColorSpace, Vector3, WebGLRenderer,
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

/**
 * A small turntable for one of the spacecraft models (the celebration cards): its own renderer in a
 * canvas inside `host`, lit by a "Sun" from the upper left, turning slowly on its own; drag to turn
 * it by hand (it resumes a few seconds after the last drag). dispose() frees the GL context.
 */
export class ModelSpin {
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(30, 1, 0.01, 100);
  private readonly pivot = new Group();
  private yaw = -0.6;
  private pitch = 0.18;
  private vyaw = 0;
  private dragging = false;
  private lastX = 0;
  private lastY = 0;
  private idleAt = 0;
  private raf = 0;
  private last = 0;
  private readonly ro: ResizeObserver;
  private readonly still = matchMedia('(prefers-reduced-motion: reduce)').matches;

  constructor(private readonly host: HTMLElement, url: string) {
    this.renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    const canvas = this.renderer.domElement;
    canvas.setAttribute('aria-hidden', 'true');
    host.appendChild(canvas);

    const sun = new DirectionalLight(0xfff4e0, 3.2);
    sun.position.set(-3, 2.5, 2);
    this.scene.add(sun, new HemisphereLight(0x9fb4d8, 0x1a1712, 0.55));
    this.scene.add(this.pivot);

    const loader = new GLTFLoader().setDRACOLoader(new DRACOLoader());
    loader.load(`${url}?v=${__BUILD_ID__}`, (gltf) => {
      const model = gltf.scene;
      // centred and scaled to a unit radius, so any model frames the same
      const box = new Box3().setFromObject(model);
      const c = box.getCenter(new Vector3());
      const r = box.getSize(new Vector3()).length() / 2 || 1;
      model.position.sub(c);
      const holder = new Group();
      holder.add(model);
      holder.scale.setScalar(1 / r);
      this.pivot.add(holder);
      host.classList.add('ready');
    }, undefined, () => host.classList.add('failed'));

    this.camera.position.set(0, 0, 2.7);
    this.camera.lookAt(0, 0, 0);

    canvas.addEventListener('pointerdown', (e) => {
      this.dragging = true;
      this.lastX = e.clientX; this.lastY = e.clientY;
      this.vyaw = 0;
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!this.dragging) return;
      const dx = e.clientX - this.lastX, dy = e.clientY - this.lastY;
      this.lastX = e.clientX; this.lastY = e.clientY;
      this.yaw += dx * 0.012;
      this.pitch = Math.max(-1.2, Math.min(1.2, this.pitch + dy * 0.008));
      this.vyaw = dx * 0.012 * 60;
    });
    const up = (): void => { this.dragging = false; this.idleAt = performance.now(); };
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(host);
    this.resize();
    this.last = performance.now();
    const step = (now: number): void => {
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      if (!this.dragging) {
        // a flick keeps turning and slows down; after a few idle seconds the slow spin returns
        this.vyaw *= Math.exp(-2.5 * dt);
        const auto = this.still || now - this.idleAt < 3000 ? 0 : 0.25;
        this.yaw += (this.vyaw + auto) * dt;
      }
      this.pivot.rotation.set(this.pitch, this.yaw, 0, 'XYZ');
      this.renderer.render(this.scene, this.camera);
      this.raf = requestAnimationFrame(step);
    };
    this.raf = requestAnimationFrame(step);
  }

  private resize(): void {
    const w = Math.max(1, this.host.clientWidth), h = Math.max(1, this.host.clientHeight);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  dispose(): void {
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.renderer.domElement.remove();
  }
}
