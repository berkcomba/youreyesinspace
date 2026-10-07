import { Matrix4, Quaternion, Vector3 } from 'three';
import type { CelestialBody } from '../core/CelestialBody';
import type { Universe } from '../core/Universe';
import type { Input } from '../input/Input';

export type CameraMode = 'free' | 'orbit';

/**
 * Orbit pivot that is not a body: a fixed point of the current frame (galaxy centre, nebula, …)
 * with a "surface" radius the camera cannot descend below.
 */
export interface OrbitAnchor {
  position: Vector3;
  radius: number;
  name: string;
}

interface Autopilot {
  kind: 'goto' | 'center' | 'centerDir' | 'gotoPoint';
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
}

const _v = new Vector3();
const _v2 = new Vector3();
const _q = new Quaternion();
const _q2 = new Quaternion();
const _m = new Matrix4();
const X = new Vector3(1, 0, 0);
const Y = new Vector3(0, 1, 0);
const Z = new Vector3(0, 0, 1);

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
  speedMultiplier = 1;
  /** current speed in km/s (for HUD) */
  speed = 0;
  altitude = 0;
  nearest: CelestialBody | null = null;
  autopilot: Autopilot | null = null;
  /** Slow automatic rotation around the orbit pivot (rad/s) — used by guided tours while dwelling */
  autoOrbit = 0;
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

  /** Fly to a body (autopilot). */
  goTo(body: CelestialBody, sunPos: Vector3): void {
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
    const duration = 2.2 + Math.min(4.5, Math.max(0, Math.log10(ratio)) * 0.9);
    this.autopilot = {
      kind: 'goto', target: body, point: null, t: 0, duration,
      r0: r0.clone(), dir1, dist1, q0: this.quaternion.clone(),
    };
    this.setReference(body);
    this.target = body;
    this.anchor = null;
    this.mode = 'orbit';
  }

  /**
   * Fly to a fixed point of the current frame (e.g. a galaxy centre) and stop `arriveDist` km
   * away, approaching along `approachDir` (unit, from the point toward the camera's final spot).
   */
  goToPoint(point: Vector3, arriveDist: number, approachDir?: Vector3, anchor?: { radius: number; name: string }): void {
    const r0 = _v.copy(this.position).sub(point);
    const dir1 = approachDir ? approachDir.clone().normalize() : (r0.lengthSq() > 0 ? r0.clone().normalize() : new Vector3(0, 0.3, 1).normalize());
    const ratio = Math.max(r0.length(), 1) / arriveDist;
    const duration = 3 + Math.min(6, Math.abs(Math.log10(ratio)) * 1.1);
    this.autopilot = {
      kind: 'gotoPoint', target: null, point: point.clone(), anchor, t: 0, duration,
      r0: r0.clone(), dir1, dist1: arriveDist, q0: this.quaternion.clone(),
    };
    this.target = null;
    this.anchor = null;
    this.mode = 'free';
  }

  /** Rotate to look at a body without moving. */
  centerOn(body: CelestialBody): void {
    this.autopilot = {
      kind: 'center', target: body, point: null, t: 0, duration: 0.9,
      r0: new Vector3(), dir1: new Vector3(), dist1: 0, q0: this.quaternion.clone(),
    };
    this.target = body;
  }

  /** Rotate to look along a fixed direction (e.g. toward a distant star) without moving. */
  centerOnDirection(dir: Vector3): void {
    this.autopilot = {
      kind: 'centerDir', target: null, point: null, t: 0, duration: 0.9,
      r0: new Vector3(), dir1: dir.clone().normalize(), dist1: 0, q0: this.quaternion.clone(),
    };
  }

  /**
   * Re-express the camera in another system's frame (pos_new = pos_old + delta) and reset
   * per-system state (reference body, target, autopilot).
   */
  shiftFrame(delta: Vector3, newReference: CelestialBody): void {
    this.position.add(delta);
    this.autopilot = null;
    this.mode = 'free';
    this.target = null;
    this.anchor = null;
    this.setReference(newReference);
    // velocity is kept: star frames are static relative to each other, so free flight stays smooth
  }

  setMode(mode: CameraMode): void {
    if (mode === 'orbit' && !this.target && !this.anchor) return;
    this.mode = mode;
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
    if (this.reference) {
      _v.copy(this.reference.position).sub(this.refLastPos);
      this.position.add(_v);
      this.refLastPos.copy(this.reference.position);
    }

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
      if (ap.kind === 'centerDir' || !tgtPos) {
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
        _m.lookAt(new Vector3(), _v.copy(tgtPos).sub(this.position), _v2.set(0, 1, 0).applyQuaternion(ap.q0));
        _q.setFromRotationMatrix(_m);
        this.quaternion.copy(ap.q0).slerp(_q, smoothstep(Math.min(1, s * 1.6)));
      } else {
        _m.lookAt(new Vector3(), _v.copy(tgtPos).sub(this.position), _v2.set(0, 1, 0).applyQuaternion(ap.q0));
        _q.setFromRotationMatrix(_m);
        this.quaternion.copy(ap.q0).slerp(_q, s);
      }
      if (ap.t >= ap.duration || dx !== 0 || dy !== 0 || touching || input.down('KeyW') || input.down('KeyS')) {
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

    // 3. Mouse look / orbit
    if (!this.autopilot) {
      const pivot: { position: Vector3; radius: number } | null = this.target ?? this.anchor;
      if (this.mode === 'orbit' && pivot) {
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
          const up = _v2.set(0, 1, 0).applyQuaternion(this.quaternion);
          _q.setFromAxisAngle(up, this.autoOrbit * dt);
          offset.applyQuaternion(_q);
          this.quaternion.premultiply(_q);
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
    if (this.mode === 'orbit' || this.autopilot) {
      const { body, altitude } = this.universe.nearestBody(this.position);
      this.nearest = body;
      this.altitude = altitude;
    }
    void viewportW; void viewportH; void fovRad;
  }
}
