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
  /** object size setting: 1 = the plain magnitude-to-size scale, larger = every star, planet and asteroid point drawn bigger */
  uStarScale: { value: 1 },
};

/**
 * Drawn diameter (px) of a point whose plain diameter is `size` (at most `cap`), under the object
 * size setting: the faint points grow in full; the brightest, already large discs, only a little.
 * As in stars.vert for the stars (cap 30).
 */
export function scaledPointSize(size: number, cap: number): number {
  const k = STAR_SHARED_UNIFORMS.uStarScale.value;
  return Math.min(cap * Math.pow(k, 0.4), size * k);
}

/** Drawn diameter (px) of a star whose plain diameter is `size`, under the object size setting */
export function scaledStarSize(size: number): number {
  return scaledPointSize(size, 30);
}

const _v = new Vector3();
const _r = new Vector3();
const _w = new Vector3();

/** Follows the camera through space and turns its velocity into the stars' trail. */
export class StarTrail {
  private readonly prev = new Vector3(NaN, NaN, NaN);
  /** camera position relative to the orbit pivot last frame (pc) */
  private readonly prevRel = new Vector3(NaN, NaN, NaN);
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
   * @param pivotPc the point the camera is orbiting (pc, scene frame), null in free flight
   */
  update(camPc: Vector3, dt: number, on: boolean, bufW: number, bufH: number, maxPointPx: number, pivotPc: Vector3 | null = null): void {
    const timed = dt > 1e-4;
    if (timed && Number.isFinite(this.prev.x)) _v.copy(camPc).sub(this.prev).divideScalar(dt);
    else _v.set(0, 0, 0);
    this.prev.copy(camPc);
    // Turning the view around a body swings the camera sideways along a sphere (light-years a
    // second around a galaxy) but is a look, not a flight: only the pivot's own motion and the
    // pull in or out count
    if (pivotPc) {
      _r.copy(camPc).sub(pivotPc);
      const len = _r.length();
      if (timed && len > 0 && Number.isFinite(this.prevRel.x)) {
        // the whole motion relative to the pivot out, the change of distance back in
        _w.copy(_r).sub(this.prevRel).divideScalar(dt);
        _v.sub(_w).addScaledVector(_r, (len - this.prevRel.length()) / (dt * len));
      }
      this.prevRel.copy(camPc).sub(pivotPc);
    } else this.prevRel.set(NaN, NaN, NaN);
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
