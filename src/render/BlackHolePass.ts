import { Quaternion, Vector3 } from 'three';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import type { CelestialBody } from '../core/CelestialBody';
import { Shaders } from './shaders';

const _q = new Quaternion();

/**
 * Full-screen gravitational-lensing pass for the most prominent black hole in view.
 * Rays near the hole are traced as Schwarzschild null geodesics (with the accretion disk),
 * the rest of the frame gets the analytic weak-field deflection.
 */
export class BlackHolePass extends ShaderPass {
  constructor() {
    super({
      uniforms: {
        tDiffuse: { value: null },
        uTanHalfFov: { value: 0.5 },
        uAspect: { value: 1 },
        uBHPos: { value: new Vector3(0, 0, -100) },
        uDiskNormal: { value: new Vector3(0, 1, 0) },
        uDiskInner: { value: 3 },
        uDiskOuter: { value: 12 },
        uDiskTemp: { value: 8000 },
        uDiskBright: { value: 0 },
        uRegionAngle: { value: 0 },
        uTime: { value: 0 },
        uSeed: { value: 1 },
        uQuality: { value: 1 },
      },
      vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position, 1.0); }`,
      fragmentShader: Shaders.blackholeFrag,
    });
    this.enabled = false;
  }

  /** Ray-march quality: 1 = full (260 RK4 steps), 0.5 = half the steps at twice the step size (mobile). */
  get quality(): number { return this.uniforms.uQuality.value as number; }
  set quality(q: number) { this.uniforms.uQuality.value = Math.min(1, Math.max(0.25, q)); }

  /**
   * Point the pass at a black hole. `relPos` is the hole's camera-relative position (km).
   * Returns false (and disables the pass) when lensing would be sub-pixel.
   */
  target(body: CelestialBody, relPos: Vector3, camQuat: Quaternion, fovRad: number, aspect: number, viewportH: number, time: number): boolean {
    const a = body.data.appearance;
    if (a.kind !== 'blackhole') { this.enabled = false; return false; }
    const rs = body.radius;
    const D = relPos.length() / rs;
    const pxPerRad = viewportH / 2 / Math.tan(fovRad / 2);
    const thetaE = Math.sqrt(2 / Math.max(D, 1e-3)); // Einstein angle for a source at infinity
    if (thetaE * pxPerRad < 0.25 || D < 1.001) { this.enabled = false; return false; }

    const u = this.uniforms;
    _q.copy(camQuat).invert();
    (u.uBHPos.value as Vector3).copy(relPos).divideScalar(rs).applyQuaternion(_q);
    (u.uDiskNormal.value as Vector3).copy(body.pole).applyQuaternion(_q).normalize();
    u.uDiskInner.value = a.disk.inner;
    u.uDiskOuter.value = a.disk.outer;
    u.uDiskTemp.value = a.disk.temperature;
    u.uDiskBright.value = a.disk.brightness;
    u.uTanHalfFov.value = Math.tan(fovRad / 2);
    u.uAspect.value = aspect;
    u.uTime.value = ((time % 500) + 500) % 500; // hours, wrapped: large arguments would break sin/cos precision in the shader
    u.uSeed.value = a.seed;
    // ray-traced region: everything the disk and the strong-field shadow could touch
    const outer = a.disk.brightness > 0 ? a.disk.outer : 3;
    const strong = Math.asin(Math.min(1, (outer * 1.6) / D));
    const region = Math.max(strong, 2.5 * thetaE);
    u.uRegionAngle.value = D < outer * 1.8 ? Math.PI : region;
    this.enabled = true;
    return true;
  }
}
