import {
  AdditiveBlending, DoubleSide, DynamicDrawUsage, InstancedBufferAttribute, InstancedBufferGeometry, Mesh, PlaneGeometry, Scene,
  ShaderMaterial, Vector3,
} from 'three';
import { Shaders } from './shaders';
import type { CelestialBody } from '../core/CelestialBody';

/** What a shower looks like: its radiant, speed and how busy the sky is. */
export interface MeteorShowerSpec {
  /** unit vector (scene frame) toward the radiant — meteors fly the opposite way */
  radiant: Vector3;
  /** atmospheric entry speed (km/s): sets how fast the streaks cross the sky */
  speed: number;
  /** meteors per real second (a cinematic figure, not the hourly rate) */
  rate: number;
  /** fraction that are fireballs (0–1) */
  fireballs?: number;
}

/** instance pool: enough for a ~40/s storm with 2 s streaks and some headroom */
const N = 320;
/** entry altitude the real streaks start at (km); the exaggerated streak begins well above it */
const BURN_END_KM = 82;
/** the streaks are stretched: a real meteor is a ~40 km scratch invisible from orbit */
const TRAVEL_MIN_KM = 650;
const TRAVEL_MAX_KM = 1400;
/** the streaks cross their stretched path at this multiple of the real entry speed (so they still read as fast) */
const SPEED_SCALE = 20;

const _u = new Vector3();
const _v = new Vector3();
const _p = new Vector3();

/**
 * A meteor shower raining into a body's atmosphere: parallel streaks (all from the same radiant)
 * lighting up on the hemisphere that faces the stream, brightest at the head, dying out ~80 km
 * up. Purely cosmetic — real time, independent of the simulation clock — and exaggerated in
 * length and brightness so it reads from a few radii out, which is where the event scenes park.
 */
export class MeteorShower {
  private readonly mesh: Mesh;
  private readonly mat: ShaderMaterial;
  private readonly geo: InstancedBufferGeometry;
  private readonly aStart: InstancedBufferAttribute;
  private readonly aBirth: InstancedBufferAttribute;
  private readonly aLife: InstancedBufferAttribute;
  private readonly aTravel: InstancedBufferAttribute;
  private readonly aLen: InstancedBufferAttribute;
  private readonly aWidth: InstancedBufferAttribute;
  private readonly aKind: InstancedBufferAttribute;
  private readonly aSeed: InstancedBufferAttribute;
  private next = 0;
  private time = 0;
  private acc = 0;
  private body: CelestialBody | null = null;
  private spec: MeteorShowerSpec | null = null;
  private readonly dir = new Vector3();
  /** fading out after stop() so the last streaks finish */
  private stopping = false;

  constructor(private readonly scene: Scene) {
    const plane = new PlaneGeometry(1, 2, 1, 1);
    plane.translate(0.5, 0, 0); // x: 0 … 1 along the streak, y: −1 … 1 across
    this.geo = new InstancedBufferGeometry();
    this.geo.index = plane.index;
    this.geo.setAttribute('position', plane.getAttribute('position'));
    const f = (n: number) => new InstancedBufferAttribute(new Float32Array(N * n), n);
    this.aStart = f(3); this.aBirth = f(1); this.aLife = f(1); this.aTravel = f(1);
    this.aLen = f(1); this.aWidth = f(1); this.aKind = f(1); this.aSeed = f(1);
    for (const [k, a] of Object.entries({ iStart: this.aStart, iBirth: this.aBirth, iLife: this.aLife, iTravel: this.aTravel, iLen: this.aLen, iWidth: this.aWidth, iKind: this.aKind, iSeed: this.aSeed })) {
      a.setUsage(DynamicDrawUsage);
      this.geo.setAttribute(k, a);
    }
    this.geo.instanceCount = N;
    this.mat = new ShaderMaterial({
      vertexShader: Shaders.meteorVert,
      fragmentShader: Shaders.meteorFrag,
      uniforms: {
        uBodyRel: { value: new Vector3() },
        uDir: { value: new Vector3(0, -1, 0) },
        uTime: { value: 0 },
        uPxPerRad: { value: 1000 },
        uIntensity: { value: 1 },
      },
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      side: DoubleSide,
    });
    this.mesh = new Mesh(this.geo, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 40;
    this.mesh.visible = false;
    scene.add(this.mesh);
  }

  get active(): boolean {
    return this.body !== null;
  }

  /** Start (or retune) the shower over `body`. */
  start(body: CelestialBody, spec: MeteorShowerSpec): void {
    if (this.body !== body) this.clear();
    this.body = body;
    this.spec = spec;
    this.stopping = false;
    this.dir.copy(spec.radiant).normalize().negate();
    (this.mat.uniforms.uDir.value as Vector3).copy(this.dir);
    this.mesh.visible = true;
  }

  /** Stop spawning; the streaks already in the air burn out over the next couple of seconds. */
  stop(): void {
    if (!this.body) return;
    this.stopping = true;
  }

  private clear(): void {
    this.aLife.array.fill(0);
    this.aLife.needsUpdate = true;
    this.next = 0;
    this.acc = 0;
  }

  /** @param dt real seconds; @param pxPerRad screen scale */
  update(dt: number, camPos: Vector3, pxPerRad: number): void {
    if (!this.body || !this.spec) return;
    this.time += dt;
    const u = this.mat.uniforms;
    u.uTime.value = this.time;
    u.uPxPerRad.value = pxPerRad;
    (u.uBodyRel.value as Vector3).copy(this.body.position).sub(camPos);

    if (this.stopping) {
      // done once the youngest streak has died
      let alive = false;
      const birth = this.aBirth.array as Float32Array;
      const life = this.aLife.array as Float32Array;
      for (let i = 0; i < N && !alive; i++) alive = life[i] > 0 && birth[i] + life[i] > this.time;
      if (!alive) { this.mesh.visible = false; this.body = null; this.spec = null; this.stopping = false; this.clear(); }
      return;
    }

    // far away the streaks are sub-pixel: don't bother spawning (they resume as the camera returns)
    const dist = (u.uBodyRel.value as Vector3).length();
    if (dist > this.body.radius * 60) return;

    this.acc += this.spec.rate * dt;
    let spawned = 0;
    while (this.acc >= 1 && spawned < 24) { this.acc -= 1; this.spawn(); spawned++; }
    if (this.acc > 4) this.acc = 4; // after a stall, don't dump a burst
    if (spawned) {
      for (const a of [this.aStart, this.aBirth, this.aLife, this.aTravel, this.aLen, this.aWidth, this.aKind, this.aSeed]) a.needsUpdate = true;
    }
  }

  private spawn(): void {
    const b = this.body!;
    const s = this.spec!;
    const i = this.next;
    this.next = (this.next + 1) % N;
    const R = b.radius;
    const fireball = Math.random() < (s.fireballs ?? 0.06);

    // where it dies: a point of the sphere at burn-out altitude on the hemisphere facing the stream.
    // Uniform over the disc the stream presents to the body, then lifted onto that sphere.
    const rEnd = R + BURN_END_KM;
    const rho = rEnd * 0.985 * Math.sqrt(Math.random());
    const th = Math.random() * Math.PI * 2;
    perpBasis(this.dir, _u, _v);
    _p.copy(_u).multiplyScalar(Math.cos(th) * rho).addScaledVector(_v, Math.sin(th) * rho);
    const c = Math.sqrt(Math.max(0, rEnd * rEnd - rho * rho));
    _p.addScaledVector(this.dir, -c); // end point, body-relative (upstream side of the sphere)

    // the streak flies in along the stream to that point from well above the air
    const travel = (fireball ? 1.6 : 1) * (TRAVEL_MIN_KM + Math.random() * (TRAVEL_MAX_KM - TRAVEL_MIN_KM));
    _p.addScaledVector(this.dir, -travel); // start point
    const speed = Math.max(12, s.speed) * SPEED_SCALE; // km per real second along the stretched path
    const life = (travel / speed) * (0.85 + Math.random() * 0.3);

    (this.aStart.array as Float32Array).set([_p.x, _p.y, _p.z], i * 3);
    (this.aBirth.array as Float32Array)[i] = this.time + Math.random() * 0.05;
    (this.aLife.array as Float32Array)[i] = life;
    (this.aTravel.array as Float32Array)[i] = travel;
    (this.aLen.array as Float32Array)[i] = travel * (fireball ? 0.75 : 0.55 + Math.random() * 0.2);
    (this.aWidth.array as Float32Array)[i] = fireball ? 2.6 + Math.random() * 1.0 : 0.9 + Math.random() * 0.5;
    (this.aKind.array as Float32Array)[i] = fireball ? 1 : 0;
    (this.aSeed.array as Float32Array)[i] = Math.random();
  }

  dispose(): void {
    this.scene.remove(this.mesh);
    this.geo.dispose();
    this.mat.dispose();
  }
}

/** two unit vectors perpendicular to `d` (and each other) */
function perpBasis(d: Vector3, u: Vector3, v: Vector3): void {
  u.set(0, 1, 0);
  if (Math.abs(d.y) > 0.9) u.set(1, 0, 0);
  u.cross(d).normalize();
  v.crossVectors(d, u).normalize();
}
