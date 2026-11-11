import { Vector2, Vector3 } from 'three';

/**
 * Seconds the "shutter" stays open for the stars' motion blur. Long for a camera, on purpose:
 * it is what turns a fast flight between the stars into streaks one can see.
 */
const EXPOSURE_S = 0.085;

/**
 * Uniforms every star sprite (catalogue, generated, cluster members) is drawn with. The three star
 * renderers share one GL program, so they also share these uniform objects: one update a frame
 * reaches all of them, and none can be left with another's stale value.
 */
export const STAR_SHARED_UNIFORMS = {
  /**
   * Motion blur: camera travel during the exposure (pc, scene frame); zero = sharp stars. A star
   * is drawn as the trail it sweeps across the view while the camera travels that far.
   */
  uStreak: { value: new Vector3() },
  /** drawing buffer size (px) */
  uViewport: { value: new Vector2(1, 1) },
  /** largest point sprite the GPU draws (px) */
  uMaxPoint: { value: 64 },
  /** star size setting: 1 = the plain magnitude-to-size scale, larger = every star drawn bigger */
  uStarScale: { value: 1 },
};

/** Drawn diameter (px) of a star whose plain diameter is `size`, under the star size setting; as in stars.vert */
export function scaledStarSize(size: number): number {
  const k = STAR_SHARED_UNIFORMS.uStarScale.value;
  // the faint stars grow in full; the brightest, already large discs, only a little
  return Math.min(30 * Math.pow(k, 0.4), size * k);
}

const _v = new Vector3();

/** Follows the camera through space and turns its velocity into the stars' trail. */
export class StarTrail {
  private readonly prev = new Vector3(NaN, NaN, NaN);
  private readonly vel = new Vector3();
  private prevSpeed = 0;
  /** camera speed the trails are drawn for (pc/s) */
  speedPc = 0;

  /**
   * @param camPc camera position, parsecs from the Sun (scene frame)
   * @param dt real seconds since the last frame
   * @param on false: sharp stars (setting off)
   * @param bufW,bufH drawing buffer size (px)
   * @param maxPointPx largest point sprite (px of the drawing buffer)
   */
  update(camPc: Vector3, dt: number, on: boolean, bufW: number, bufH: number, maxPointPx: number): void {
    if (dt > 1e-4 && Number.isFinite(this.prev.x)) _v.copy(camPc).sub(this.prev).divideScalar(dt);
    else _v.set(0, 0, 0);
    this.prev.copy(camPc);
    // Arriving somewhere at once (a cut in a tour, a jump to another frame) is a single frame of
    // enormous speed, not a flight: only motion that lasts two frames running leaves a trail
    const speed = _v.length();
    const lasting = Math.min(speed, this.prevSpeed);
    this.prevSpeed = speed;
    if (speed > 0) _v.multiplyScalar(lasting / speed);
    // the frame-to-frame velocity is noisy (frame times, the camera's own easing): smooth it
    this.vel.lerp(_v, 1 - Math.exp(-Math.min(dt, 0.1) * 14));
    this.speedPc = this.vel.length();
    const u = STAR_SHARED_UNIFORMS;
    if (on) u.uStreak.value.copy(this.vel).multiplyScalar(EXPOSURE_S);
    else u.uStreak.value.set(0, 0, 0);
    u.uViewport.value.set(bufW, bufH);
    u.uMaxPoint.value = maxPointPx;
  }
}
