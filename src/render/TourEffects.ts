import { AdditiveBlending, CanvasTexture, Scene, Sprite, SpriteMaterial, Vector3 } from 'three';
import type { CelestialBody } from '../core/CelestialBody';

/**
 * A pulse of light travelling from one body to another in a fixed number of real seconds — the
 * tour's "sunlight takes eight minutes to reach Earth" demonstration. Drawn as a soft additive
 * glow with a short trail, kept ~12 px wide whatever the distance.
 */
export class LightPulse {
  private readonly sprites: Sprite[] = [];
  private from: CelestialBody | null = null;
  private to: CelestialBody | null = null;
  private seconds = 1;
  private t = 0;
  private readonly tmp = new Vector3();

  constructor(private readonly scene: Scene) {
    const tex = LightPulse.texture();
    // head + 5 fading trail blobs
    for (let i = 0; i < 6; i++) {
      const mat = new SpriteMaterial({ map: tex, blending: AdditiveBlending, depthTest: false, depthWrite: false, transparent: true, opacity: i === 0 ? 1 : 0.55 * (1 - i / 6) });
      const s = new Sprite(mat);
      s.renderOrder = 50;
      s.visible = false;
      s.frustumCulled = false;
      scene.add(s);
      this.sprites.push(s);
    }
  }

  get active(): boolean {
    return this.from !== null;
  }

  start(from: CelestialBody, to: CelestialBody, seconds: number): void {
    this.from = from;
    this.to = to;
    this.seconds = Math.max(0.5, seconds);
    this.t = 0;
  }

  stop(): void {
    this.from = this.to = null;
    for (const s of this.sprites) s.visible = false;
  }

  /** @param dt real seconds; @param pxPerRad screen scale; the pulse lingers briefly on arrival */
  update(dt: number, camPos: Vector3, pxPerRad: number): void {
    if (!this.from || !this.to) return;
    this.t += dt;
    const u = this.t / this.seconds;
    if (u > 1.25) { this.stop(); return; }
    const a = this.from.position;
    const b = this.to.position;
    const dir = this.tmp.copy(b).sub(a);
    const len = dir.length();
    dir.normalize();
    // start at the source's limb, end at the target's limb
    const s0 = this.from.radius * 1.05;
    const s1 = len - this.to.radius * 1.05;
    const arrive = Math.min(1, u);
    const fade = u > 1 ? 1 - (u - 1) / 0.25 : 1;
    for (let i = 0; i < this.sprites.length; i++) {
      const sp = this.sprites[i];
      const k = Math.max(0, arrive - i * 0.012);
      const pos = sp.position.copy(a).addScaledVector(dir, s0 + (s1 - s0) * k).sub(camPos);
      const dist = pos.length();
      const px = i === 0 ? 14 : 9;
      sp.scale.setScalar((2 * px * dist) / pxPerRad);
      (sp.material as SpriteMaterial).opacity = (i === 0 ? 1 : 0.55 * (1 - i / 6)) * fade;
      sp.visible = true;
    }
  }

  dispose(): void {
    for (const s of this.sprites) { this.scene.remove(s); (s.material as SpriteMaterial).dispose(); }
    (this.sprites[0]?.material as SpriteMaterial | undefined)?.map?.dispose();
  }

  private static texture(): CanvasTexture {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d')!;
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,250,235,1)');
    grad.addColorStop(0.25, 'rgba(255,230,170,0.85)');
    grad.addColorStop(0.6, 'rgba(255,190,110,0.25)');
    grad.addColorStop(1, 'rgba(255,170,90,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    return new CanvasTexture(c);
  }
}
