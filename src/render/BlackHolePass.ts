import { Quaternion, Vector3 } from 'three';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import type { CelestialBody } from '../core/CelestialBody';
import { C_KM_S } from '../core/constants';
import { Shaders } from './shaders';

const _q = new Quaternion();
const _ref = new Vector3();
const _Y = new Vector3(0, 1, 0);
const _X = new Vector3(1, 0, 0);

/**
 * How fast the disc is seen to turn: angular speed of its inner edge, radians per real second.
 * The true rate spans nine orders of magnitude (the last stable orbit takes 5 ms round a
 * 10-solar-mass hole, half an hour round Sgr A*, a month round M87*), none of which a viewer
 * could follow, so its logarithm is mapped on to this range: a heavier hole still turns more
 * slowly, and speeding the clock up still speeds the gas up.
 */
const FLOW_SLOW = 0.65, FLOW_FAST = 2.6;
/** true inner-edge rates (rad/s) shown as FLOW_SLOW and FLOW_FAST */
const TRUE_SLOW = 1e-3, TRUE_FAST = 1e3;
/** a turbulence layer lives until the inner edge has turned this far (rad), then a fresh one replaces it */
const FLOW_LIFE = 5.2;

/**
 * Full-screen gravitational-lensing pass for the most prominent black hole in view.
 * Rays near the hole are traced as Schwarzschild null geodesics (with the accretion disk),
 * the rest of the frame gets the analytic weak-field deflection.
 */
export class BlackHolePass extends ShaderPass {
  /** angle the disc's inner edge has turned so far (rad, as shown) */
  private flowPhase = 0;
  /** current shown angular speed of the inner edge (rad/s) */
  private flowRate = 0;

  constructor() {
    super({
      uniforms: {
        tDiffuse: { value: null },
        uTanHalfFov: { value: 0.5 },
        uAspect: { value: 1 },
        uBHPos: { value: new Vector3(0, 0, -100) },
        uDiskNormal: { value: new Vector3(0, 1, 0) },
        uDiskRef: { value: new Vector3(1, 0, 0) },
        uDiskInner: { value: 3 },
        uDiskOuter: { value: 12 },
        uDiskTemp: { value: 8000 },
        uDiskBright: { value: 0 },
        uRegionAngle: { value: 0 },
        uFlow: { value: [new Vector3(0, 0, 1), new Vector3(0, 0, 0)] },
        uSeed: { value: 1 },
        uQuality: { value: 1 },
        uPixAngle: { value: 1e-3 },
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
   * @param dt real seconds since the last frame
   * @param timeRate simulated seconds per real second (0 paused, negative backwards): the gas follows the clock
   */
  target(body: CelestialBody, relPos: Vector3, camQuat: Quaternion, fovRad: number, aspect: number, viewportH: number, dt: number, timeRate: number): boolean {
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
    // azimuth 0 of the disc: any direction in its plane, as long as it is the same one whichever
    // way the camera looks (the gas pattern would otherwise slide round as the view turns)
    _ref.crossVectors(body.pole, Math.abs(body.pole.y) < 0.9 ? _Y : _X).normalize();
    (u.uDiskRef.value as Vector3).copy(_ref).applyQuaternion(_q);
    u.uDiskInner.value = a.disk.inner;
    u.uDiskOuter.value = a.disk.outer;
    u.uDiskTemp.value = a.disk.temperature;
    // display gain, with a shoulder: the brightest discs would otherwise burn out to plain white
    // and lose both their colour and the structure of the gas
    const b = a.disk.brightness;
    u.uDiskBright.value = b > 0 ? (2.1 * b) / (1 + 0.55 * Math.pow(b, 1.6)) : 0;
    u.uTanHalfFov.value = Math.tan(fovRad / 2);
    u.uAspect.value = aspect;
    u.uPixAngle.value = 1 / pxPerRad;
    u.uSeed.value = a.seed;
    this.flow(dt, timeRate, rs, a.disk.inner);
    // ray-traced region: everything the disk and the strong-field shadow could touch
    const outer = a.disk.brightness > 0 ? a.disk.outer : 3;
    const strong = Math.asin(Math.min(1, (outer * 1.6) / D));
    const region = Math.max(strong, 2.5 * thetaE);
    u.uRegionAngle.value = D < outer * 1.8 ? Math.PI : region;
    this.enabled = true;
    return true;
  }

  /** Carry the gas round: advance the disc's phase and hand the two turbulence layers their age and weight. */
  private flow(dt: number, timeRate: number, rsKm: number, inner: number): void {
    // Keplerian angular speed at the inner edge, as a distant observer times it: sqrt(GM / r³)
    const real = (C_KM_S / rsKm) * Math.sqrt(0.5 / (inner * inner * inner)) * Math.abs(timeRate);
    let want = 0;
    if (real > 0) {
      const k = Math.min(1, Math.max(0, Math.log(real / TRUE_SLOW) / Math.log(TRUE_FAST / TRUE_SLOW)));
      want = FLOW_SLOW * Math.pow(FLOW_FAST / FLOW_SLOW, k) * Math.sign(timeRate);
    }
    const step = Math.min(Math.max(dt, 0), 0.1);
    this.flowRate += (want - this.flowRate) * (1 - Math.exp(-step * 4));
    this.flowPhase += this.flowRate * step;
    const layers = this.uniforms.uFlow.value as Vector3[];
    for (let k = 0; k < 2; k++) {
      const x = this.flowPhase / FLOW_LIFE + k * 0.5;
      const gen = Math.floor(x);
      const age = x - gen; // 0 → 1 over the layer's life
      // a new generation is a new pattern: an offset into the noise that never repeats nearby
      const off = (((gen * 2 + k) * 37.17) % 1000 + 1000) % 1000;
      layers[k].set(age * FLOW_LIFE, off, 1 - Math.abs(2 * age - 1));
    }
  }
}
