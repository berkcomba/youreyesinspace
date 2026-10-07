import { AdditiveBlending, BufferAttribute, BufferGeometry, Points, Scene, ShaderMaterial, Vector3 } from 'three';
import type { BodyView } from './BodyRenderer';
import { Shaders } from './shaders';

/**
 * Point-sprite layer: every body is drawn as a small glow whose size follows an
 * approximate apparent magnitude, so distant planets and moons remain visible
 * as "stars" (Space Engine style). Fades out as the real disc becomes resolvable.
 */
export class BodyPoints {
  readonly points: Points;
  private views: BodyView[] = [];
  private pos = new Float32Array(0);
  private col = new Float32Array(0);
  private size = new Float32Array(0);
  private alpha = new Float32Array(0);
  private geo = new BufferGeometry();
  private readonly mat: ShaderMaterial;

  constructor(scene: Scene) {
    this.mat = new ShaderMaterial({
      vertexShader: Shaders.pointsVert,
      fragmentShader: Shaders.pointsFrag,
      uniforms: { uPixelRatio: { value: 1 }, uSoftness: { value: 0.35 } },
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
      depthTest: true,
    });
    this.points = new Points(this.geo, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 6;
    scene.add(this.points);
  }

  /** Re-target to the views of a (new) system. */
  setViews(views: BodyView[]): void {
    this.views = views;
    const n = views.length;
    this.pos = new Float32Array(n * 3);
    this.col = new Float32Array(n * 3);
    this.size = new Float32Array(n);
    this.alpha = new Float32Array(n);
    this.geo.dispose();
    this.geo = new BufferGeometry();
    this.geo.setAttribute('position', new BufferAttribute(this.pos, 3));
    this.geo.setAttribute('color', new BufferAttribute(this.col, 3));
    this.geo.setAttribute('size', new BufferAttribute(this.size, 1));
    this.geo.setAttribute('alpha', new BufferAttribute(this.alpha, 1));
    this.points.geometry = this.geo;
  }

  setPixelRatio(pr: number): void {
    this.mat.uniforms.uPixelRatio.value = pr;
  }

  /** @param starLuminosity luminosity of the system's star in solar units (scales reflected brightness) */
  update(sunPos: Vector3, camPos: Vector3, starLuminosity = 1): void {
    const views = this.views;
    if (!views.length) return;
    for (let i = 0; i < views.length; i++) {
      const v = views[i];
      const b = v.body;
      const rp = v.relPos;
      // Offset the point slightly toward the camera so it isn't z-fighting with its own disc
      this.pos[i * 3] = rp.x;
      this.pos[i * 3 + 1] = rp.y;
      this.pos[i * 3 + 2] = rp.z;

      if (b.data.type === 'star' || b.data.type === 'spacecraft' || b.data.type === 'pulsar' || b.data.type === 'barycenter') {
        this.alpha[i] = 0;
        this.size[i] = 0;
        continue;
      }
      if (b.data.appearance.kind === 'blackhole') {
        // the accretion disk as an unresolved point (the lensing pass takes over once resolvable)
        const dCam = Math.max(v.distance, 1);
        const mag = b.data.appearance.diskAbsMag + 5 * Math.log10(dCam / (10 * 3.0857e13));
        const size = Math.max(1.1, Math.min(7.5, 6.8 - 0.55 * mag));
        const gone = 1 - Math.min(1, Math.max(0, (mag - 11) / 4));
        const discFade = 1 - Math.min(1, Math.max(0, (v.apparentRadiusPx * 6 - 1.0) / 3.0));
        this.size[i] = size;
        this.alpha[i] = gone * discFade;
        const T = b.data.appearance.disk.temperature;
        const warm = T < 8000 ? 1 : 0.85, cool = T > 12000 ? 1 : 0.85;
        this.col[i * 3] = warm; this.col[i * 3 + 1] = 0.9; this.col[i * 3 + 2] = cool;
        continue;
      }
      const dSun = Math.max(b.position.distanceTo(sunPos), 1);
      const dCam = Math.max(v.distance, 1);
      const albedo = b.data.albedo ?? 0.3;
      // pseudo magnitude
      const flux = (starLuminosity * albedo * b.radius * b.radius) / (dSun * dSun * dCam * dCam);
      const mag = -2.5 * Math.log10(flux + 1e-40) - 63.7;
      const size = Math.max(1.1, Math.min(7.5, 6.8 - 0.55 * mag));
      // Fade the sprite as the actual disc grows past ~1.5 px
      const discFade = 1 - Math.min(1, Math.max(0, (v.apparentRadiusPx - 1.0) / 3.0));
      this.size[i] = size;
      // faint planets stay findable (floor 0.35) until they would be far below naked-eye
      // visibility, then vanish (otherwise a whole system piles up into a blob from far away)
      const faint = mag < 6 ? 1 : Math.max(0.35, 1 - (mag - 6) * 0.1);
      const gone = 1 - Math.min(1, Math.max(0, (mag - 11) / 4));
      this.alpha[i] = faint * gone * discFade;

      const c = b.data.appearance;
      let r = 0.85, g = 0.85, bl = 0.85;
      if (c.kind === 'terrestrial') {
        const m = c.landMid ?? c.landLow;
        r = m[0]; g = m[1]; bl = m[2];
        if (c.ocean && c.seaLevel !== undefined) {
          r = r * 0.4 + c.ocean[0] * 0.6 + 0.1;
          g = g * 0.4 + c.ocean[1] * 0.6 + 0.15;
          bl = bl * 0.4 + c.ocean[2] * 0.6 + 0.35;
        }
        if (c.ice && (c.iceCaps ?? 0) > 0) {
          r = r * 0.8 + 0.2; g = g * 0.8 + 0.2; bl = bl * 0.8 + 0.2;
        }
      } else if (c.kind === 'gas') {
        const m = c.bands[0];
        r = m[0]; g = m[1]; bl = m[2];
      }
      // Normalise brightness so the tint reads like a star colour
      const mx = Math.max(r, g, bl, 1e-3);
      this.col[i * 3] = 0.55 + 0.45 * (r / mx);
      this.col[i * 3 + 1] = 0.55 + 0.45 * (g / mx);
      this.col[i * 3 + 2] = 0.55 + 0.45 * (bl / mx);
    }
    (this.geo.attributes.position as BufferAttribute).needsUpdate = true;
    (this.geo.attributes.color as BufferAttribute).needsUpdate = true;
    (this.geo.attributes.size as BufferAttribute).needsUpdate = true;
    (this.geo.attributes.alpha as BufferAttribute).needsUpdate = true;
  }
}
