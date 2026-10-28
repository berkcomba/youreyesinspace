import { Matrix4, Quaternion, Vector3 } from 'three';
import type { CelestialBody } from '../core/CelestialBody';
import type { Universe } from '../core/Universe';
import type { Input } from '../input/Input';

export type CameraMode = 'free' | 'orbit' | 'surface';

/**
 * Orbit pivot that is not a body: a fixed point of the current frame (galaxy centre, nebula, …)
 * with a "surface" radius the camera cannot descend below.
 */
export interface OrbitAnchor {
  position: Vector3;
  radius: number;
  name: string;
}

/**
 * A visitor standing on a body ('surface' mode): fixed to the ground at a landing site, turning
 * with the planet, free to look around, walk and zoom in on the sky. The site frame is the one
 * generated ground uses: origin on the ellipsoid, +X east, +Y up, +Z south (object coordinates
 * given by `sitePos` / `siteQuat`), `ground(x, z)` the terrain's own height there.
 */
export interface SurfaceStand {
  body: CelestialBody;
  /** the landing site on the body's ellipsoid (object frame, km) and its frame */
  sitePos: Vector3;
  siteQuat: Quaternion;
  /** y (km, site frame) of the ground at a local offset, curvature included */
  ground: (x: number, z: number) => number;
  /** walker's offset from the site (km, site frame) */
  x: number;
  z: number;
  /** eye height above the ground (km) */
  eye: number;
  /** heading (rad, 0 = north, positive toward east) and elevation of the gaze (rad, positive up) */
  yaw: number;
  pitch: number;
  /** binocular zoom: the field of view is divided by this */
  zoom: number;
}

interface Autopilot {
  kind: 'goto' | 'center' | 'centerDir' | 'gotoPoint' | 'land' | 'pose';
  target: CelestialBody | null;
  /** fixed destination (current frame, km) for 'gotoPoint' */
  point: Vector3 | null;
  /** 'gotoPoint': settle into orbit around the point on arrival, with this minimum radius */
  anchor?: { radius: number; name: string };
  t: number;
  duration: number;
  r0: Vector3; // start offset from target
  dir1: Vector3; // end direction (unit) – for 'centerDir': the direction to look at
  dist1: number;
  q0: Quaternion;
  /** 'goto': screen-up at arrival (unit); default keeps the roll the flight started with */
  up1?: Vector3;
  /** 'pose': end point, aim point and screen-up in the target's body frame (object coordinates, km) */
  pose?: { pos: Vector3; look: Vector3; up: Vector3; frame: Quaternion | null; descend: boolean };
}

const _v = new Vector3();
const _v2 = new Vector3();
const _q = new Quaternion();
const _q2 = new Quaternion();
const _qYaw = new Quaternion();
const _qPitch = new Quaternion();
const _standPos = new Vector3();
const _standQ = new Quaternion();
const _m = new Matrix4();
const _end = new Vector3();
const _hint = new Vector3();
const _qDown = new Quaternion();
const _origin = new Vector3();
const X = new Vector3(1, 0, 0);
const Y = new Vector3(0, 1, 0);
const Z = new Vector3(0, 0, 1);
/** keyboard flight controls (orbit and free mode) */
const MOVE_KEYS = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE', 'KeyR', 'KeyF', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];

function smoothstep(t: number): number {
  t = Math.min(Math.max(t, 0), 1);
  return t * t * (3 - 2 * t);
}

/**
 * Space-sim camera with floating-origin semantics: `position` is the absolute
 * position in km (double precision); the three.js camera always sits at the origin.
 */
export class CameraController {
  readonly position = new Vector3();
  readonly quaternion = new Quaternion();
  mode: CameraMode = 'free';
  /** Body whose motion we inherit (frame of reference) */
  reference: CelestialBody | null = null;
  /** Body we orbit / look at in orbit mode */
  target: CelestialBody | null = null;
  /** Non-body orbit pivot (galaxy, nebula…); used when `target` is null */
  anchor: OrbitAnchor | null = null;
  /** where the visitor stands while landing / landed (see `land`) */
  surface: SurfaceStand | null = null;
  /** walking speed on the ground (km/s), for the HUD */
  walkSpeed = 0;
  speedMultiplier = 1;
  /** current speed in km/s (for HUD) */
  speed = 0;
  altitude = 0;
  nearest: CelestialBody | null = null;
  autopilot: Autopilot | null = null;
  /**
   * Slow automatic rotation around the orbit pivot (rad/s) — the opening view and guided tours
   * while dwelling. Any new flight or re-targeting clears it.
   */
  autoOrbit = 0;
  /**
   * Slow automatic push-in (negative) / pull-out (positive) toward the orbit pivot, in
   * ln(distance) per second — the tours' cinematic drift. Cleared like `autoOrbit`.
   */
  autoDolly = 0;
  mouseSensitivity = 0.0032;
  invertY = false;
  /**
   * Extra length scale (km) for free-flight speed, supplied by the app: distance to the nearest
   * procedural star / galaxy edge. Speed = min(altitude, speedHintKm) × 0.9 × multiplier.
   */
  speedHintKm = Infinity;

  private readonly refLastPos = new Vector3();
  private readonly velocity = new Vector3();

  constructor(private readonly universe: Universe) {}

  setReference(b: CelestialBody | null): void {
    this.reference = b;
    if (b) this.refLastPos.copy(b.position);
  }

  /**
   * Inherit the reference body's motion since the last frame. `update` does this first thing,
   * but a flight planned from inside the frame loop (tour cues fire after the bodies moved and
   * before the camera caught up) must measure its start offset after the catch-up too — at
   * thousands of times real time one frame of lag is hundreds of kilometres.
   */
  private catchUp(): void {
    if (!this.reference) return;
    _v.copy(this.reference.position).sub(this.refLastPos);
    this.position.add(_v);
    this.refLastPos.copy(this.reference.position);
  }

  /** Place camera at an offset from a body and look at it. */
  placeAt(body: CelestialBody, offset: Vector3): void {
    this.position.copy(body.position).add(offset);
    this.lookAt(body.position);
    this.setReference(body);
    this.target = body;
    this.anchor = null;
    this.mode = 'orbit';
    this.autopilot = null;
  }

  /** Orbit a fixed point of the current frame (galaxy centre, nebula…) without moving first. */
  orbitPoint(point: Vector3, radius: number, name: string): void {
    this.anchor = { position: point.clone(), radius, name };
    this.target = null;
    this.setReference(null);
    this.autopilot = null;
    this.autoOrbit = 0;
    this.autoDolly = 0;
    this.mode = 'orbit';
    this.lookAt(point);
  }

  lookAt(point: Vector3): void {
    _v.copy(point).sub(this.position);
    if (_v.lengthSq() === 0) return;
    // keep current up vector where possible
    _v2.set(0, 1, 0).applyQuaternion(this.quaternion);
    _m.lookAt(new Vector3(0, 0, 0), _v, _v2);
    this.quaternion.setFromRotationMatrix(_m);
  }

  /** Fly to a body (autopilot). `durationS` overrides the distance-based flight time. */
  goTo(body: CelestialBody, sunPos: Vector3, durationS?: number): void {
    this.catchUp();
    const r0 = _v.copy(this.position).sub(body.position);
    let dist1 = body.radius * 3.6;
    if (body.data.rings) dist1 = Math.max(dist1, body.data.rings.outer * 2.2);
    if (body.data.type === 'star') dist1 = body.radius * 6;
    if (body.data.type === 'spacecraft') dist1 = body.radius * 4.5;
    // pulsars: far enough to see the sweeping beams
    if (body.data.appearance.kind === 'pulsar') dist1 = body.radius * (body.data.appearance.quiet ? 8 : Math.max(30, body.data.appearance.beamLength * 0.9));
    const bhDisk = body.data.appearance.kind === 'blackhole' && body.data.appearance.disk.brightness > 0 ? body.data.appearance.disk.outer : 0;
    if (body.data.type === 'blackhole') dist1 = body.radius * Math.max(28, bhDisk * 3.4);
    let dir1: Vector3;
    if (r0.length() < body.radius * 1.5) {
      dir1 = r0.lengthSq() > 0 ? r0.clone().normalize() : new Vector3(0, 0.3, 1).normalize();
    } else {
      dir1 = r0.clone().normalize();
      // Bias toward the sunlit hemisphere so we don't arrive over the night side
      const sunDir = _v2.copy(sunPos).sub(body.position).normalize();
      if (body.data.type !== 'star' && dir1.dot(sunDir) < 0.25) {
        dir1.lerp(sunDir, 0.45).normalize();
      }
      // Landers/rovers: come in from above so the ground stays below us
      if (body.data.orbit?.kind === 'surface' && body.parent) {
        const up = _v2.copy(body.position).sub(body.parent.position).normalize();
        dir1.lerp(up, 0.7).normalize();
      }
      // slightly above the orbital plane for a nicer composition
      dir1.addScaledVector(body.pole, 0.18).normalize();
      // black holes: arrive ~14° above the accretion-disk plane (the classic lensed-disk view)
      if (body.data.type === 'blackhole' && bhDisk > 0) {
        const inPlane = _v2.copy(dir1).addScaledVector(body.pole, -dir1.dot(body.pole));
        if (inPlane.lengthSq() < 1e-6) inPlane.set(1, 0, 0).addScaledVector(body.pole, -body.pole.x);
        inPlane.normalize();
        dir1.copy(inPlane).multiplyScalar(Math.cos(0.25)).addScaledVector(body.pole, Math.sin(0.25)).normalize();
      }
    }
    // barycentres: far enough to see both components' orbits, looking down on their plane
    if (body.data.type === 'barycenter' && body.children.length) {
      let aMax = 1;
      for (const c of body.children) aMax = Math.max(aMax, c.resolved?.a ?? 0, c.radius * 8);
      dist1 = aMax * 3.2;
      const n = body.children[0].orbitNormal;
      if (n.lengthSq() > 0) dir1.addScaledVector(n, 1.2).normalize();
    }
    // mission vehicles: three-quarter view from the sunlit side, slightly behind
    if (body.data.orbit?.kind === 'trajectory') {
      const fwd = new Vector3(0, 1, 0).applyQuaternion(body.rotation);
      const sunDir = new Vector3().copy(sunPos).sub(body.position).normalize();
      const side = new Vector3().crossVectors(fwd, sunDir);
      if (side.lengthSq() < 1e-6) side.crossVectors(fwd, new Vector3(0, 1, 0));
      side.normalize();
      dir1 = side.multiplyScalar(0.75).addScaledVector(sunDir, 0.6).addScaledVector(fwd, -0.3).normalize();
      dist1 = body.radius * 5.5;
    }
    const ratio = Math.max(r0.length(), 1) / dist1;
    const duration = durationS ?? 2.2 + Math.min(4.5, Math.max(0, Math.log10(ratio)) * 0.9);
    this.autopilot = {
      kind: 'goto', target: body, point: null, t: 0, duration,
      r0: r0.clone(), dir1, dist1, q0: this.quaternion.clone(),
    };
    this.autoOrbit = 0;
    this.autoDolly = 0;
    this.setReference(body);
    this.target = body;
    this.anchor = null;
    this.mode = 'orbit';
  }

  /**
   * Fly to an explicit vantage point around a body: `dir1` (unit, from the body) and `dist1` km
   * away, ending in orbit mode around it. Used by guided tours for overviews and surface close-ups.
   * `durationS` overrides the distance-based flight time; `up1` fixes the roll at arrival.
   */
  goToVantage(body: CelestialBody, dir1: Vector3, dist1: number, durationS?: number, up1?: Vector3): void {
    this.catchUp();
    const r0 = _v.copy(this.position).sub(body.position);
    const ratio = Math.max(r0.length(), 1) / dist1;
    const duration = durationS ?? 2.2 + Math.min(4.5, Math.abs(Math.log10(ratio)) * 0.9);
    this.autopilot = {
      kind: 'goto', target: body, point: null, t: 0, duration,
      r0: r0.clone(), dir1: dir1.clone().normalize(), dist1, q0: this.quaternion.clone(),
      up1: up1?.clone().normalize(),
    };
    this.autoOrbit = 0;
    this.autoDolly = 0;
    this.setReference(body);
    this.target = body;
    this.anchor = null;
    this.mode = 'orbit';
  }

  /**
   * Tour close-up: arrive on the far side of the body from the Sun, a little above it, so the
   * Sun (and the inner system) hangs in the sky just over the planet's limb. `elevRad` is the
   * angle of the Sun above the body's centre as seen from the camera.
   */
  goToBacklit(body: CelestialBody, sunPos: Vector3, durationS?: number, elevRad = 0.36): void {
    let dist1 = body.radius * 3.6;
    if (body.data.rings) dist1 = Math.max(dist1, body.data.rings.outer * 2.2);
    if (body.data.type === 'spacecraft') dist1 = body.radius * 4.5;
    const toSun = new Vector3().copy(sunPos).sub(body.position).normalize();
    // "up" = the body's pole, made perpendicular to the Sun direction (so the Sun rises straight up the screen)
    const up = new Vector3().copy(body.pole).addScaledVector(toSun, -body.pole.dot(toSun));
    if (up.lengthSq() < 1e-6) up.set(0, 1, 0).addScaledVector(toSun, -toSun.y);
    up.normalize();
    // camera a little above the body–Sun line, looking slightly down at the body: the Sun then
    // sits `elevRad` above the body's centre on screen
    const dir1 = new Vector3().copy(toSun).multiplyScalar(-Math.cos(elevRad)).addScaledVector(up, Math.sin(elevRad));
    this.goToVantage(body, dir1, dist1, durationS, up);
  }

  /**
   * Fly to a fixed point of the current frame (e.g. a galaxy centre) and stop `arriveDist` km
   * away, approaching along `approachDir` (unit, from the point toward the camera's final spot).
   */
  goToPoint(point: Vector3, arriveDist: number, approachDir?: Vector3, anchor?: { radius: number; name: string }): void {
    this.catchUp();
    const r0 = _v.copy(this.position).sub(point);
    const dir1 = approachDir ? approachDir.clone().normalize() : (r0.lengthSq() > 0 ? r0.clone().normalize() : new Vector3(0, 0.3, 1).normalize());
    const ratio = Math.max(r0.length(), 1) / arriveDist;
    const duration = 3 + Math.min(6, Math.abs(Math.log10(ratio)) * 1.1);
    this.autopilot = {
      kind: 'gotoPoint', target: null, point: point.clone(), anchor, t: 0, duration,
      r0: r0.clone(), dir1, dist1: arriveDist, q0: this.quaternion.clone(),
    };
    this.autoOrbit = 0;
    this.autoDolly = 0;
    this.target = null;
    this.anchor = null;
    this.mode = 'free';
  }

  /**
   * Descend to a landing site and stand there ('surface' mode on arrival). The flight is the
   * `goTo` curve — direction swung and distance eased on a log scale — toward the stand, which
   * turns with the planet meanwhile, while the view settles from wherever it was onto the horizon.
   */
  land(stand: SurfaceStand, durationS?: number): void {
    this.catchUp();
    this.surface = stand;
    const body = stand.body;
    const r0 = _v.copy(this.position).sub(body.position);
    this.standPose(stand, _v2, _q);
    const dist1 = Math.max(_v2.sub(body.position).length(), 1e-6);
    const ratio = Math.max(r0.length(), 1) / dist1;
    const duration = durationS ?? 2.5 + Math.min(6, Math.max(0, Math.log10(ratio)) * 1.0);
    this.autopilot = {
      kind: 'land', target: body, point: null, t: 0, duration,
      r0: r0.clone(), dir1: new Vector3(), dist1, q0: this.quaternion.clone(),
    };
    this.autoOrbit = 0;
    this.autoDolly = 0;
    this.setReference(body);
    this.target = body;
    this.anchor = null;
    this.mode = 'orbit';
  }

  /**
   * Fly to a pose fixed to the body's surface (`pos`, aim point `look` and screen-up `up` in its
   * object coordinates, km) and stay there in free flight, riding along with the body: a view
   * across its landscape that orbit mode, always aimed at the centre, cannot frame. With
   * `spin` false the pose ignores the body's rotation (its orientation now is kept): a view of
   * a planet and its rings that must not wheel round while the clock runs fast.
   */
  goToPose(body: CelestialBody, pos: Vector3, look: Vector3, up: Vector3, durationS: number, o: { spin?: boolean; descend?: boolean } = {}): void {
    const spin = o.spin ?? true;
    this.catchUp();
    const r0 = _v.copy(this.position).sub(body.position);
    this.autopilot = {
      kind: 'pose', target: body, point: null, t: 0, duration: durationS,
      r0: r0.clone(), dir1: new Vector3(), dist1: pos.length(), q0: this.quaternion.clone(),
      pose: { pos: pos.clone(), look: look.clone(), up: up.clone(), frame: spin ? null : body.rotation.clone(), descend: !!o.descend },
    };
    this.autoOrbit = 0;
    this.autoDolly = 0;
    this.setReference(body);
    this.target = body;
    this.anchor = null;
    this.mode = 'orbit';
  }

  /** World pose of a 'pose' flight's end point (the body's current rotation applied). */
  private posePose(body: CelestialBody, pose: NonNullable<Autopilot['pose']>, outPos: Vector3, outQuat: Quaternion): void {
    const rot = pose.frame ?? body.rotation;
    outPos.copy(pose.pos).applyQuaternion(rot).add(body.position);
    const look = _v.copy(pose.look).applyQuaternion(rot).add(body.position).sub(outPos);
    const up = _v2.copy(pose.up).applyQuaternion(rot);
    _m.lookAt(new Vector3(), look, up);
    outQuat.setFromRotationMatrix(_m);
  }

  /** Absolute position and orientation of a stand (the body's current rotation applied). */
  standPose(s: SurfaceStand, outPos: Vector3, outQuat: Quaternion): void {
    const b = s.body;
    // site frame → world
    _q2.copy(b.rotation).multiply(s.siteQuat);
    outPos.set(s.x, s.ground(s.x, s.z) + s.eye, s.z).applyQuaternion(s.siteQuat).add(s.sitePos).applyQuaternion(b.rotation).add(b.position);
    // look along −Z (north) turned by the heading about +Y, then tilted about the new +X
    outQuat.copy(_q2).multiply(_qYaw.setFromAxisAngle(Y, -s.yaw)).multiply(_qPitch.setFromAxisAngle(X, s.pitch));
  }

  /** The stand's geodetic position (deg) after walking, for the HUD. */
  standLatLon(s: SurfaceStand): { lat: number; lon: number } {
    _v.set(s.x, 0, s.z).applyQuaternion(s.siteQuat).add(s.sitePos);
    const b = s.body;
    const re = b.equatorialRadius, e2 = 1 - (b.polarRadius / re) ** 2;
    const rho = Math.hypot(_v.x, _v.z);
    let lat = Math.atan2(_v.y, rho * (1 - e2));
    for (let i = 0; i < 3; i++) {
      const sl = Math.sin(lat);
      const N = re / Math.sqrt(1 - e2 * sl * sl);
      const h = rho / Math.max(Math.cos(lat), 1e-9) - N;
      lat = Math.atan2(_v.y, rho * (1 - (e2 * N) / (N + h)));
    }
    return { lat: lat * (180 / Math.PI), lon: Math.atan2(-_v.z, _v.x) * (180 / Math.PI) };
  }

  /** Rotate to look at a body without moving. */
  centerOn(body: CelestialBody): void {
    this.autopilot = {
      kind: 'center', target: body, point: null, t: 0, duration: 0.9,
      r0: new Vector3(), dir1: new Vector3(), dist1: 0, q0: this.quaternion.clone(),
    };
    this.autoOrbit = 0;
    this.autoDolly = 0;
    this.target = body;
  }

  /** Rotate to look along a fixed direction (e.g. toward a distant star) without moving. */
  centerOnDirection(dir: Vector3): void {
    this.autopilot = {
      kind: 'centerDir', target: null, point: null, t: 0, duration: 0.9,
      r0: new Vector3(), dir1: dir.clone().normalize(), dist1: 0, q0: this.quaternion.clone(),
    };
    this.autoOrbit = 0;
    this.autoDolly = 0;
  }

  /**
   * Re-express the camera in another system's frame (pos_new = pos_old + delta) and reset
   * per-system state (reference body, target, autopilot).
   */
  shiftFrame(delta: Vector3, newReference: CelestialBody): void {
    this.position.add(delta);
    this.autopilot = null;
    this.autoOrbit = 0;
    this.autoDolly = 0;
    this.mode = 'free';
    this.target = null;
    this.anchor = null;
    this.setReference(newReference);
    // velocity is kept: star frames are static relative to each other, so free flight stays smooth
  }

  setMode(mode: CameraMode): void {
    if (mode === 'orbit' && !this.target && !this.anchor) return;
    this.mode = mode;
    this.autoOrbit = 0;
    this.autoDolly = 0;
    if (mode === 'orbit') {
      if (this.target) {
        this.setReference(this.target);
        this.lookAt(this.target.position);
      } else if (this.anchor) {
        this.lookAt(this.anchor.position);
      }
    }
  }

  toggleMode(): void {
    this.setMode(this.mode === 'free' ? 'orbit' : 'free');
  }

  update(dt: number, input: Input, viewportW: number, viewportH: number, fovRad: number): void {
    // 1. Inherit reference-frame motion
    this.catchUp();
    // a flight or a mode switch of any kind ends the stand
    if (this.mode !== 'surface' && this.autopilot?.kind !== 'land') this.surface = null;

    const { dx, dy, wheel, pinch, panX, panY } = input.flush();
    const ySign = this.invertY ? -1 : 1;
    const touching = pinch !== 0 || panX !== 0 || panY !== 0;

    // 2. Autopilot
    if (this.autopilot) {
      const ap = this.autopilot;
      ap.t += dt;
      const s = smoothstep(ap.t / ap.duration);
      const tgt = ap.target;
      const tgtPos = tgt ? tgt.position : ap.point;
      if (ap.kind === 'pose' && ap.pose && tgt) {
        this.posePose(tgt, ap.pose, _standPos, _standQ);
        _end.copy(_standPos);
        // screen-up on the way down: toward the view's aim, so the frame tilts up onto it at the end
        _hint.copy(ap.pose.look).sub(ap.pose.pos).applyQuaternion(ap.pose.frame ?? tgt.rotation);
        const d0 = Math.max(ap.r0.length(), 1e-3);
        const dst = _standPos.sub(tgt.position);
        const d1 = Math.max(dst.length(), 1e-6);
        const dist = Math.exp((1 - s) * Math.log(d0) + s * Math.log(d1));
        const from = _v.copy(ap.r0).normalize();
        const to = dst.multiplyScalar(1 / d1);
        const ang = Math.acos(Math.min(Math.max(from.dot(to), -1), 1));
        let dir: Vector3 = from;
        if (ang >= 1e-4) {
          const sa = Math.sin(ang);
          dir = _v2.copy(from).multiplyScalar(Math.sin((1 - s) * ang) / sa).addScaledVector(to, Math.sin(s * ang) / sa);
        }
        this.position.copy(tgt.position).addScaledVector(dir, dist);
        // descending: look down at the landing spot so the ground is seen to grow, then pitch up
        // onto the final view over the last third
        if (ap.pose.descend) {
          const toEnd = _v.copy(_end).sub(this.position);
          if (toEnd.lengthSq() > 1e-6 && _hint.lengthSq() > 1e-9) {
            _hint.addScaledVector(toEnd, -_hint.dot(toEnd) / toEnd.lengthSq());
            _m.lookAt(_origin, toEnd, _hint.normalize());
            _qDown.setFromRotationMatrix(_m);
          } else _qDown.copy(_standQ);
          const tNow = ap.t / ap.duration;
          this.quaternion.copy(ap.q0).slerp(_qDown, smoothstep(Math.min(1, tNow * 4)));
          this.quaternion.slerp(_standQ, smoothstep((tNow - 0.62) / 0.38));
        } else {
          this.quaternion.copy(ap.q0).slerp(_standQ, smoothstep(Math.min(1, s * 1.25)));
        }
        if (ap.t >= ap.duration || dx !== 0 || dy !== 0 || touching) {
          if (ap.t >= ap.duration) this.posePose(tgt, ap.pose, this.position, this.quaternion);
          this.autopilot = null;
          this.mode = 'free';
          this.target = null;
          this.setReference(tgt);
        }
        this.velocity.set(0, 0, 0);
      } else if (ap.kind === 'land' && this.surface && tgt) {
        // the stand moves with the planet's spin: re-aim at it every frame
        const st = this.surface;
        this.standPose(st, _standPos, _standQ);
        const d0 = Math.max(ap.r0.length(), 1e-3);
        const dst = _standPos.sub(tgt.position);
        const d1 = Math.max(dst.length(), 1e-6);
        const dist = Math.exp((1 - s) * Math.log(d0) + s * Math.log(d1));
        const from = _v.copy(ap.r0).normalize();
        const to = dst.multiplyScalar(1 / d1);
        const dot = Math.min(Math.max(from.dot(to), -1), 1);
        const ang = Math.acos(dot);
        let dir: Vector3;
        if (ang < 1e-4) dir = from;
        else {
          const sa = Math.sin(ang);
          dir = _v2.copy(from).multiplyScalar(Math.sin((1 - s) * ang) / sa).addScaledVector(to, Math.sin(s * ang) / sa);
        }
        // the last stretch comes straight down onto the stand (the log curve would still be
        // sliding sideways a few metres up)
        this.position.copy(tgt.position).addScaledVector(dir, dist);
        this.quaternion.copy(ap.q0).slerp(_standQ, smoothstep(Math.min(1, s * 1.25)));
        if (ap.t >= ap.duration) {
          this.autopilot = null;
          this.mode = 'surface';
          this.setReference(tgt);
          this.target = tgt;
          this.standPose(st, this.position, this.quaternion);
        }
        this.velocity.set(0, 0, 0);
      } else if (ap.kind === 'centerDir' || !tgtPos) {
        _m.lookAt(new Vector3(), ap.dir1, _v2.set(0, 1, 0).applyQuaternion(ap.q0));
        _q.setFromRotationMatrix(_m);
        this.quaternion.copy(ap.q0).slerp(_q, s);
      } else if (ap.kind === 'goto' || ap.kind === 'gotoPoint') {
        const d0 = Math.max(ap.r0.length(), 1e-3);
        const dist = Math.exp((1 - s) * Math.log(d0) + s * Math.log(ap.dist1));
        const from = _v.copy(ap.r0).normalize();
        // slerp direction
        const dot = Math.min(Math.max(from.dot(ap.dir1), -1), 1);
        const ang = Math.acos(dot);
        let dir: Vector3;
        if (ang < 1e-4) dir = from;
        else {
          const sa = Math.sin(ang);
          dir = _v2.copy(from).multiplyScalar(Math.sin((1 - s) * ang) / sa).addScaledVector(ap.dir1, Math.sin(s * ang) / sa);
        }
        this.position.copy(tgtPos).addScaledVector(dir, dist);
        // orientation: blend toward looking at target
        _m.lookAt(new Vector3(), _v.copy(tgtPos).sub(this.position), ap.up1 ? _v2.copy(ap.up1) : _v2.set(0, 1, 0).applyQuaternion(ap.q0));
        _q.setFromRotationMatrix(_m);
        this.quaternion.copy(ap.q0).slerp(_q, smoothstep(Math.min(1, s * 1.6)));
      } else {
        _m.lookAt(new Vector3(), _v.copy(tgtPos).sub(this.position), _v2.set(0, 1, 0).applyQuaternion(ap.q0));
        _q.setFromRotationMatrix(_m);
        this.quaternion.copy(ap.q0).slerp(_q, s);
      }
      if (ap.kind !== 'land' && ap.kind !== 'pose' && (ap.t >= ap.duration || dx !== 0 || dy !== 0 || touching || input.down('KeyW') || input.down('KeyS'))) {
        if (ap.kind === 'goto' && tgt) {
          this.mode = 'orbit';
          this.setReference(tgt);
          this.lookAt(tgt.position);
        } else if (ap.kind === 'gotoPoint' && ap.anchor && ap.point) {
          // settle into orbit around the point so drag / wheel keep working
          this.anchor = { position: ap.point.clone(), radius: ap.anchor.radius, name: ap.anchor.name };
          this.target = null;
          this.setReference(null);
          this.mode = 'orbit';
          this.lookAt(ap.point);
        }
        this.autopilot = null;
      }
      this.velocity.set(0, 0, 0);
    }

    // Any hand on the controls ends the automatic drift (opening backdrop, tour dwell): it must
    // not creep back once the visitor has taken over.
    if ((this.autoOrbit !== 0 || this.autoDolly !== 0) && (dx !== 0 || dy !== 0 || wheel !== 0 || touching || MOVE_KEYS.some((k) => input.down(k)))) { this.autoOrbit = 0; this.autoDolly = 0; }

    // 3. Mouse look / orbit
    if (!this.autopilot) {
      const pivot: { position: Vector3; radius: number } | null = this.target ?? this.anchor;
      if (this.mode === 'surface' && this.surface) {
        this.updateStand(dt, input, dx, dy, wheel, pinch, panX, panY, ySign);
      } else if (this.mode === 'orbit' && pivot) {
        const tgt = pivot;
        const offset = _v.copy(this.position).sub(tgt.position);
        if (dx !== 0 || dy !== 0) {
          const up = _v2.set(0, 1, 0).applyQuaternion(this.quaternion);
          _q.setFromAxisAngle(up, -dx * this.mouseSensitivity);
          const right = new Vector3(1, 0, 0).applyQuaternion(this.quaternion);
          _q2.setFromAxisAngle(right, -dy * this.mouseSensitivity * ySign);
          _q.multiply(_q2);
          offset.applyQuaternion(_q);
          this.quaternion.premultiply(_q);
        } else if (this.autoOrbit !== 0) {
          // sweep around the body's axis so the elevation holds (around screen-up a high
          // overview would tumble over the pole instead of circling it)
          const axis = this.target ? _v2.copy(this.target.pole) : _v2.set(0, 0, 0);
          if (axis.lengthSq() < 1e-6) axis.set(0, 1, 0).applyQuaternion(this.quaternion);
          _q.setFromAxisAngle(axis.normalize(), this.autoOrbit * dt);
          offset.applyQuaternion(_q);
          this.quaternion.premultiply(_q);
        }
        if (this.autoDolly !== 0 && dx === 0 && dy === 0) {
          offset.setLength(Math.max(tgt.radius * 1.3, offset.length() * Math.exp(this.autoDolly * dt)));
        }
        if (wheel !== 0 || pinch !== 0) {
          const minD = tgt.radius * 1.02;
          // wheel down / fingers together ⇒ farther
          const f = Math.exp(wheel * 0.0012 - pinch);
          const len = Math.max(minD, offset.length() * f);
          offset.setLength(len);
        }
        // Roll with Q/E in orbit mode
        const roll = (input.down('KeyQ') ? 1 : 0) - (input.down('KeyE') ? 1 : 0);
        if (roll !== 0) {
          _q.setFromAxisAngle(Z.clone().applyQuaternion(this.quaternion), roll * dt * 1.2);
          this.quaternion.premultiply(_q);
        }
        this.position.copy(tgt.position).add(offset);
        // Keyboard movement in orbit mode: W/S dolly, A/D & R/F orbit
        const dolly = (input.down('KeyW') ? 1 : 0) - (input.down('KeyS') ? 1 : 0);
        if (dolly !== 0) {
          const minD = tgt.radius * 1.02;
          const len = Math.max(minD, offset.length() * Math.exp(-dolly * dt * 1.5));
          offset.setLength(len);
          this.position.copy(tgt.position).add(offset);
        }
        const strafe = (input.down('KeyD') ? 1 : 0) - (input.down('KeyA') ? 1 : 0);
        const climb = (input.down('KeyR') ? 1 : 0) - (input.down('KeyF') ? 1 : 0);
        if (strafe !== 0 || climb !== 0) {
          const up = new Vector3(0, 1, 0).applyQuaternion(this.quaternion);
          const right = new Vector3(1, 0, 0).applyQuaternion(this.quaternion);
          _q.setFromAxisAngle(up, -strafe * dt * 1.2);
          _q2.setFromAxisAngle(right, climb * dt * 1.2);
          _q.multiply(_q2);
          offset.applyQuaternion(_q);
          this.quaternion.premultiply(_q);
          this.position.copy(tgt.position).add(offset);
        }
        this.speed = 0;
      } else {
        // Free flight
        if (dx !== 0 || dy !== 0) {
          _q.setFromAxisAngle(Y, -dx * this.mouseSensitivity);
          _q2.setFromAxisAngle(X, -dy * this.mouseSensitivity * ySign);
          this.quaternion.multiply(_q).multiply(_q2);
        }
        const roll = (input.down('KeyQ') ? 1 : 0) - (input.down('KeyE') ? 1 : 0);
        if (roll !== 0) {
          _q.setFromAxisAngle(Z, roll * dt * 1.2);
          this.quaternion.multiply(_q);
        }
        if (wheel !== 0) {
          this.speedMultiplier *= Math.exp(-wheel * 0.0015);
          this.speedMultiplier = Math.min(Math.max(this.speedMultiplier, 1e-4), 1e6);
        }
        // Speed scales with altitude above the nearest body
        const { body, altitude } = this.universe.nearestBody(this.position);
        this.nearest = body;
        this.altitude = altitude;
        let base = Math.max(Math.min(altitude, this.speedHintKm), 0.002) * 0.9;
        base *= this.speedMultiplier;
        if (input.down('ShiftLeft') || input.down('ShiftRight')) base *= 10;
        if (input.down('ControlLeft') || input.down('ControlRight')) base *= 0.1;

        const move = _v.set(
          (input.down('KeyD') ? 1 : 0) - (input.down('KeyA') ? 1 : 0),
          (input.down('KeyR') ? 1 : 0) - (input.down('KeyF') ? 1 : 0),
          (input.down('KeyS') ? 1 : 0) - (input.down('KeyW') ? 1 : 0),
        );
        if (move.lengthSq() > 0) move.normalize().multiplyScalar(base).applyQuaternion(this.quaternion);
        // inertia
        const k = 1 - Math.exp(-dt * 6);
        this.velocity.lerp(move, k);
        // touch: pinch flies forward/back, two-finger drag slides the same way the fingers move
        // (fly metaphor, like one-finger look). Impulses decay through the same inertia
        // (∫v·e^(-6t) = v/6), so a doubling pinch (ln 2) travels ≈ 0.45·base
        if (touching) {
          const impulse = _v2.set(panX / 160, -panY / 160, -pinch).multiplyScalar(base * 4).applyQuaternion(this.quaternion);
          this.velocity.add(impulse);
        }
        if (this.velocity.lengthSq() < 1e-12) this.velocity.set(0, 0, 0);
        this.position.addScaledVector(this.velocity, dt);
        this.speed = this.velocity.length();

        // Collision: don't go below the surface
        if (body) {
          const d = _v2.copy(this.position).sub(body.position);
          const minD = body.radius * 1.0005;
          if (d.length() < minD) {
            d.setLength(minD);
            this.position.copy(body.position).add(d);
            this.velocity.set(0, 0, 0);
          }
        }
      }
    }

    // altitude/nearest for HUD (orbit mode too)
    if (this.mode === 'surface' && this.surface) {
      this.nearest = this.surface.body;
      this.altitude = this.surface.eye;
    } else if (this.mode === 'orbit' || this.autopilot) {
      const { body, altitude } = this.universe.nearestBody(this.position);
      this.nearest = body;
      this.altitude = altitude;
    }
    void viewportW; void viewportH; void fovRad;
  }

  /** eye height of a standing visitor (km) */
  static readonly EYE_KM = 0.0017;
  /** the highest the visitor can rise above the ground before taking off (km) */
  static readonly MAX_EYE_KM = 60;
  /** climb (+1) / descend (−1) held from the UI (touch buttons) */
  liftInput = 0;
  /** walking pace (km/s); Shift runs ×8, Ctrl creeps ×0.2 */
  static readonly WALK_KM_S = 0.0015;

  /**
   * On the ground: the mouse (or a finger) turns the head, W/A/S/D walk over the relief, the
   * wheel (or a pinch) zooms the view like binoculars, Q/E are ignored (no roll on foot).
   */
  private updateStand(dt: number, input: Input, dx: number, dy: number, wheel: number, pinch: number, panX: number, panY: number, ySign: number): void {
    const s = this.surface!;
    if (dx !== 0 || dy !== 0) {
      // the zoomed view turns proportionally slower, as through binoculars
      const k = this.mouseSensitivity / s.zoom;
      s.yaw += dx * k;
      s.pitch -= dy * k * ySign;
    }
    const maxPitch = Math.PI / 2 - 0.02;
    s.pitch = Math.min(maxPitch, Math.max(-maxPitch, s.pitch));
    if (wheel !== 0 || pinch !== 0) s.zoom = Math.min(16, Math.max(1, s.zoom * Math.exp(-wheel * 0.0012 + pinch)));
    // walking: forward along the heading, sideways across it (horizontal, the ground sets the height)
    const fwd = (input.down('KeyW') || input.down('ArrowUp') ? 1 : 0) - (input.down('KeyS') || input.down('ArrowDown') ? 1 : 0);
    const side = (input.down('KeyD') || input.down('ArrowRight') ? 1 : 0) - (input.down('KeyA') || input.down('ArrowLeft') ? 1 : 0);
    const fast = input.down('ShiftLeft') || input.down('ShiftRight') ? 8 : input.down('ControlLeft') || input.down('ControlRight') ? 0.2 : 1;
    // climbing: R / F (or the bar's buttons) lift the eye above the ground, faster the higher we are
    const lift = (input.down('KeyR') || this.liftInput > 0 ? 1 : 0) - (input.down('KeyF') || this.liftInput < 0 ? 1 : 0);
    if (lift !== 0) {
      const rate = Math.max(0.002, s.eye * 1.2) * fast;
      s.eye = Math.min(CameraController.MAX_EYE_KM, Math.max(CameraController.EYE_KM, s.eye + lift * rate * dt));
    }
    // aloft we move faster too: a drone's pace, not a walker's
    const pace = CameraController.WALK_KM_S * Math.max(1, Math.pow(s.eye / CameraController.EYE_KM, 0.9) * 0.6) * fast;
    const move = _v.set(fwd * Math.sin(s.yaw) + side * Math.cos(s.yaw), 0, -fwd * Math.cos(s.yaw) + side * Math.sin(s.yaw));
    // two-finger drag walks too
    if (panX !== 0 || panY !== 0) move.add(_v2.set(-panY * Math.sin(s.yaw) / 60 + panX * Math.cos(s.yaw) / 60, 0, panY * Math.cos(s.yaw) / 60 + panX * Math.sin(s.yaw) / 60));
    if (move.lengthSq() > 0) {
      if (move.lengthSq() > 1) move.normalize();
      s.x += move.x * pace * dt;
      s.z += move.z * pace * dt;
      this.walkSpeed = move.length() * pace;
    } else this.walkSpeed = 0;
    this.speed = this.walkSpeed;
    this.standPose(s, this.position, this.quaternion);
  }
}
