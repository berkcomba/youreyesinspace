import {
  AdditiveBlending, BufferAttribute, BufferGeometry, Matrix3, Points, Scene, ShaderMaterial, Vector3, Vector4,
} from 'three';
import { SKY_RADIUS_KM } from '../core/constants';
import type { Landmark } from '../core/Universe';
import { LANDMARK_IMAGES } from '../data/landmarkImages';
import { Rng } from '../gen/SystemGenerator';
import type { LandmarkSprites } from './LandmarkSprites';
import { NebulaClouds } from './NebulaClouds';
import { lightPositionPc, resolveNebulaProfile } from './nebula/NebulaProfile';
import { Shaders } from './shaders';
import type { Volume, Volumes } from './Volumes';
import { presetBounds } from './Bounds';

/**
 * Raymarched nebulae alive at once (the largest on screen). Every nebula that is more than a blob
 * is one of them, so what is seen from afar is the object itself, not a stand-in that changes
 * shape on approach; a small one costs a few hundred pixels of the half-resolution volume buffer.
 */
const MAX_VOLUMES = 96;
/** with the volumetrics switched off the gas is a point cloud (thousands of sprites each): only the nearest few */
const MAX_POINT_CLOUDS = 5;
/** cached clouds beyond the slots (the ones just turned away from come back instantly) */
const CACHE_EXTRA = 64;
/** apparent radius (px) from which a nebula is raymarched, and by which its cloud has replaced the sprite's blob */
const VOLUME_PX = 2.5;
const VOLUME_FULL_PX = 5.5;
/** the same for the point clouds (they hand over like the photographic ones: NebulaClouds.handover) */
const POINTS_PX = 7;
/** the stars inside a raymarched nebula are drawn from this apparent radius (px) */
const STARS_PX = 12;
/** apparent radius (px) from which a volume gets its full step budget; a smaller one a share (its thin sheets are under a pixel anyway) */
const FULL_STEPS_PX = 40;
/** a nebula drawn fainter than this gets no slot, and one fainter than the second ranks lower in proportion */
const MIN_BRIGHTNESS = 0.012;
const FULL_RANK_BRIGHTNESS = 0.12;
/** seconds for a cloud to fade in / out when it wins or loses a slot */
const SLOT_FADE_S = 0.6;
/** how often the landmark list is scanned for resolved objects (ms) */
const SCAN_INTERVAL_MS = 40;

interface Cloud {
  id: string;
  points: Points;
  mat: ShaderMaterial;
  center: Vector3;
  radiusPc: number;
  /** raymarched gas; the points then only carry the stars inside it. Null: the gas is the points (volumetrics off) */
  volume: Volume | null;
  /**
   * slot weight 0…1: a cloud that wins or loses a slot fades over SLOT_FADE_S instead of popping
   * (the sprite fades the opposite way; see LandmarkSprites.setCloudFlags)
   */
  blend: number;
  /** index into `landmarks` as of the last update (−1 when the object is gone) */
  index: number;
}

/**
 * The gas of the deep-sky landmarks that have no photograph (all generated ones and most real
 * ones): nebulae, planetary nebulae, remnants and wind bubbles, raymarched by Nebula Engine 2.0
 * from the moment they are more than a few pixels across. The flat sprite only stands for the
 * unresolved blob; both follow one brightness law (LandmarkSprites.brightness), so the handover
 * changes neither the shape nor the brightness.
 */
export class ProcClouds {
  private readonly clouds = new Map<string, Cloud>();
  private daylight = 0;
  private readonly active = new Map<number, number>();

  constructor(private readonly landmarks: Landmark[], private readonly scene: Scene, private readonly maxPointPx: number, private readonly volumes: Volumes | null = null) {}

  setDaylight(d: number): void {
    this.daylight = Math.min(1, d * 1.5);
    for (const c of this.clouds.values()) c.mat.uniforms.uDaylight.value = this.daylight;
  }

  private lastTime = 0;
  private scanAt = -Infinity;
  private scanCount = -1;
  private readonly cands: Array<{ i: number; rank: number }> = [];
  private readonly indexOf = new Map<string, number>();

  /**
   * Pick the resolved nebulae, build their clouds if needed, fade them in. Returns the share
   * (0…1) of each landmark index a cloud currently carries: its sprite steps back by as much.
   * @param sprites the sprite layer, updated this frame: its distances, apparent radii and brightness law
   * @param forward the camera's viewing direction and @param viewAngle the angle (rad) from it within
   * which an object can be on screen (with a margin): the slots go to what can be seen
   */
  update(camPc: Vector3, pxPerRad: number, pixelRatio: number, visible: boolean, sprites: LandmarkSprites, forward: Vector3, viewAngle: number): Map<number, number> {
    const now = performance.now();
    const dt = this.lastTime ? Math.min((now - this.lastTime) / 1000, 0.1) : 0;
    this.lastTime = now;
    this.active.clear();
    const vol = !!this.volumes?.enabled;
    const minPx = vol ? VOLUME_PX : POINTS_PX;
    const distPc = sprites.distPc, radiusPx = sprites.radiusPx;
    // the walk over every landmark for the resolved few: at the sprite layer's cadence (its
    // distances / radii are what we read), not every frame — the slots fade over seconds anyway
    const cands = this.cands, indexOf = this.indexOf;
    if (now - this.scanAt >= SCAN_INTERVAL_MS || this.scanCount !== this.landmarks.length) {
      this.scanAt = now; this.scanCount = this.landmarks.length;
      cands.length = 0; indexOf.clear();
      const fresh = distPc.length === this.landmarks.length;
      for (let i = 0; i < this.landmarks.length; i++) {
        const l = this.landmarks[i];
        const d = fresh ? distPc[i] : Math.max(l.positionPc.distanceTo(camPc), 1e-6);
        const px = fresh ? radiusPx[i] : Math.atan(l.def.radiusPc / d) * pxPerRad;
        // the cheap test first: almost every landmark is unresolved
        if (px < minPx && !this.clouds.has(l.def.id)) continue;
        const kind = l.def.kind;
        if (kind !== 'nebula' && kind !== 'planetary' && kind !== 'remnant') continue;
        if (LANDMARK_IMAGES[l.def.id]) continue;
        indexOf.set(l.def.id, i);
        if (px < minPx) continue;
        // behind the camera or far off to the side: no slot (we may be inside the nearest ones)
        const ratio = d / l.def.radiusPc;
        if (ratio > 3) {
          const p = l.positionPc;
          const cos = ((p.x - camPc.x) * forward.x + (p.y - camPc.y) * forward.y + (p.z - camPc.z) * forward.z) / d;
          if (Math.acos(Math.min(1, Math.max(-1, cos))) > viewAngle + Math.asin(1.3 / ratio)) continue;
        }
        // the survey catalogues hold thousands of nebulae that are a few pixels across from half
        // the Galaxy away and next to invisible (a star-like brightness until they are resolved):
        // those wait as sprites, and the dim ones rank behind the ones that show
        const bright = sprites.brightness(i, px, ratio, d);
        if (bright < MIN_BRIGHTNESS) continue;
        cands.push({ i, rank: px * Math.min(1, bright / FULL_RANK_BRIGHTNESS) });
      }
    }
    // hysteresis: a cloud holding a slot keeps it until a newcomer is clearly larger on screen,
    // so the slots do not churn while flying past a crowd of similar objects
    const rank = (c: { i: number; rank: number }) => c.rank * ((this.clouds.get(this.landmarks[c.i].def.id)?.blend ?? 0) > 0 ? 1.6 : 1);
    cands.sort((a, b) => rank(b) - rank(a));
    const slots = vol ? MAX_VOLUMES : MAX_POINT_CLOUDS;
    const wanted = new Set<string>();
    // a point cloud takes 20+ ms to build: one per frame. A volume is a material: a few
    let builds = vol ? 8 : 1;
    for (const c of cands.slice(0, slots)) {
      const l = this.landmarks[c.i];
      let cloud = this.clouds.get(l.def.id);
      // built for the other mode (gas as points vs raymarched): rebuild
      if (cloud && (cloud.volume !== null) !== vol) { this.destroy(cloud); this.clouds.delete(l.def.id); cloud = undefined; }
      if (!cloud) {
        if (builds-- <= 0) continue;
        cloud = this.build(l, vol); this.clouds.set(l.def.id, cloud);
      }
      wanted.add(l.def.id);
    }
    // every cloud, whether it holds a slot (fading in / full) or has lost it (fading out)
    for (const [id, cloud] of this.clouds) {
      const i = indexOf.get(id) ?? -1;
      cloud.index = i;
      const target = wanted.has(id) && i >= 0 ? 1 : 0;
      cloud.blend = dt > 0 ? Math.max(0, Math.min(1, cloud.blend + (target ? dt : -dt) / SLOT_FADE_S)) : target;
      if (cloud.blend <= 0 || i < 0) {
        cloud.points.visible = false;
        if (cloud.volume) cloud.volume.active = false;
        if (!target && this.clouds.size > slots + CACHE_EXTRA) { this.destroy(cloud); this.clouds.delete(id); }
        continue;
      }
      const l = this.landmarks[i];
      const d = Math.max(l.positionPc.distanceTo(camPc), 1e-6);
      const px = Math.atan(l.def.radiusPc / d) * pxPerRad;
      const u = cloud.mat.uniforms;
      (u.uCenterRel.value as Vector3).copy(cloud.center).sub(camPc);
      const share = (cloud.volume ? smoothstep(VOLUME_PX, VOLUME_FULL_PX, px) : NebulaClouds.handover(px)) * cloud.blend;
      if (!visible || share <= 0) { cloud.points.visible = false; if (cloud.volume) cloud.volume.active = false; continue; }
      // the sprite's own law: what the cloud takes over is exactly what the sprite gives up
      u.uFade.value = sprites.brightness(i, px, d / cloud.radiusPc, d) * share;
      u.uPxPerRad.value = pxPerRad;
      u.uPixelRatio.value = pixelRatio;
      cloud.points.visible = cloud.volume === null || px >= STARS_PX;
      if (cloud.volume) {
        const v = cloud.volume;
        v.place(camPc, cloud.center, cloud.radiusPc, v.u.uToLocal.value, pxPerRad);
        v.u.uFade.value = u.uFade.value;
        v.stepScale = Math.min(1, Math.max(0.35, px / FULL_STEPS_PX));
        v.active = true;
      }
      this.active.set(i, share);
    }
    return this.active;
  }

  private destroy(c: Cloud): void {
    if (c.volume) this.volumes!.remove(c.volume);
    this.scene.remove(c.points);
    c.points.geometry.dispose();
    c.mat.dispose();
  }

  dispose(): void {
    for (const c of this.clouds.values()) this.destroy(c);
    this.clouds.clear();
  }

  /* ---------------- builders ---------------- */

  private build(l: Landmark, vol: boolean): Cloud {
    const R = l.def.radiusPc;
    const rng = new Rng(hashStr(l.def.id));
    const kind = l.def.kind;
    const col = l.def.color;
    let g: Generated;
    let volume: Volume | null = null;
    let core: Vector3 | undefined;
    // real member stars (ClusterStarPoints, selectable) replace the decorative star points: no
    // fake stars that look clickable but are not
    const members = l.def.cluster !== undefined;
    if (members && l.def.cluster!.centrePc) core = new Vector3(...l.def.cluster!.centrePc);
    if (vol) {
      // the look follows the object's identity (its profile), the same on every visit
      const profile = resolveNebulaProfile(l.def, l.procKind);
      volume = this.volumes!.nebulaProfile(profile);
      // the ionised core sits where the profile's primary light is (object-local → scene)
      core ??= lightPositionPc(profile, 0);
    }
    if (kind === 'planetary') g = planetary(rng, R, col, !vol);
    else if (kind === 'remnant') g = remnant(rng, R, col, !vol);
    else g = nebula(rng, R, col, !vol, core, !members);

    const geo = presetBounds(new BufferGeometry());
    geo.setAttribute('position', new BufferAttribute(g.pos, 3));
    geo.setAttribute('color', new BufferAttribute(g.col, 3));
    geo.setAttribute('weight', new BufferAttribute(g.w, 1));
    geo.setAttribute('size', new BufferAttribute(g.size, 1));
    const mat = new ShaderMaterial({
      vertexShader: Shaders.nebulaCloudVert,
      fragmentShader: Shaders.pointsFrag,
      uniforms: {
        uBasis: { value: new Matrix3() },
        uCenterRel: { value: new Vector3() },
        uPixelRatio: { value: 1 },
        uSkyRadius: { value: SKY_RADIUS_KM * 0.985 },
        uPxPerRad: { value: 1000 },
        uBlobRadius: { value: g.blob },
        uAlpha: { value: g.alpha },
        uFade: { value: 0 },
        uDaylight: { value: this.daylight },
        uMaxPx: { value: this.maxPointPx },
        uSoftness: { value: 1.0 },
        uTint: { value: new Vector4(0, 0, 0, 0) },
      },
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
    });
    const points = new Points(geo, mat);
    points.frustumCulled = false;
    points.renderOrder = -11;
    points.visible = false;
    this.scene.add(points);
    return { id: l.def.id, points, mat, center: l.positionPc.clone(), radiusPc: R, volume, blend: 0, index: -1 };
  }
}

interface Generated {
  pos: Float32Array;
  col: Float32Array;
  w: Float32Array;
  size: Float32Array;
  /** blob radius (pc) at size 1 */
  blob: number;
  /** per-blob peak alpha at unit weight / size */
  alpha: number;
}

class Gen {
  pos: number[] = []; col: number[] = []; w: number[] = []; size: number[] = [];
  add(x: number, y: number, z: number, c: readonly number[], w: number, s: number): void {
    this.pos.push(x, y, z); this.col.push(c[0], c[1], c[2]); this.w.push(w); this.size.push(s);
  }
  done(blob: number, alpha: number): Generated {
    return { pos: new Float32Array(this.pos), col: new Float32Array(this.col), w: new Float32Array(this.w), size: new Float32Array(this.size), blob, alpha };
  }
  get n(): number { return this.w.length; }
}

type RGB = readonly [number, number, number];

/** Uniform point in the unit ball */
function ball(rng: Rng, out: Vector3): Vector3 {
  for (;;) {
    out.set(rng.range(-1, 1), rng.range(-1, 1), rng.range(-1, 1));
    if (out.lengthSq() <= 1) return out;
  }
}
function sphereDir(rng: Rng, out: Vector3): Vector3 {
  const z = rng.range(-1, 1), t = rng.range(0, Math.PI * 2), r = Math.sqrt(1 - z * z);
  return out.set(r * Math.cos(t), r * Math.sin(t), z);
}
function gauss(rng: Rng): number {
  return Math.sqrt(-2 * Math.log(Math.max(rng.next(), 1e-9))) * Math.cos(2 * Math.PI * rng.next());
}
function mix3(a: RGB, b: RGB, t: number): RGB {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}
const WHITE: RGB = [1, 1, 1];
const BLUE_STAR: RGB = [0.75, 0.82, 1.0];
const YELLOW_STAR: RGB = [1.0, 0.92, 0.75];


/** Cheap 3-octave 3D value noise in 0..1 */
class Noise3 {
  private readonly g: Float32Array;
  constructor(rng: Rng, private readonly n = 12) {
    this.g = new Float32Array(n * n * n);
    for (let i = 0; i < this.g.length; i++) this.g[i] = rng.next();
  }
  private at(x: number, y: number, z: number): number {
    const n = this.n;
    const fx = x - Math.floor(x), fy = y - Math.floor(y), fz = z - Math.floor(z);
    const ix = ((Math.floor(x) % n) + n) % n, iy = ((Math.floor(y) % n) + n) % n, iz = ((Math.floor(z) % n) + n) % n;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy), sz = fz * fz * (3 - 2 * fz);
    const v = (a: number, b: number, c: number) => this.g[((a % n) * n + (b % n)) * n + (c % n)];
    const x0 = ix, x1 = ix + 1, y0 = iy, y1 = iy + 1, z0 = iz, z1 = iz + 1;
    const c00 = v(x0, y0, z0) + (v(x1, y0, z0) - v(x0, y0, z0)) * sx;
    const c10 = v(x0, y1, z0) + (v(x1, y1, z0) - v(x0, y1, z0)) * sx;
    const c01 = v(x0, y0, z1) + (v(x1, y0, z1) - v(x0, y0, z1)) * sx;
    const c11 = v(x0, y1, z1) + (v(x1, y1, z1) - v(x0, y1, z1)) * sx;
    const c0 = c00 + (c10 - c00) * sy, c1 = c01 + (c11 - c01) * sy;
    return c0 + (c1 - c0) * sz;
  }
  fbm(x: number, y: number, z: number): number {
    return (this.at(x, y, z) * 0.55 + this.at(x * 2.1 + 7, y * 2.1 + 3, z * 2.1 + 5) * 0.3 + this.at(x * 4.3 + 1, y * 4.3 + 9, z * 4.3 + 2) * 0.15);
  }
}

/** Emission / reflection nebula: a few overlapping gas clumps carved by noise, with embedded young stars */
function nebula(rng: Rng, R: number, color: RGB, gas = true, coreAt?: Vector3, decorativeStars = true): Generated {
  const g = new Gen();
  const N = 9000;
  const noise = new Noise3(rng);
  const nClump = rng.int(4, 9);
  const clumps: Array<{ c: Vector3; s: number; w: number }> = [];
  for (let i = 0; i < nClump; i++) clumps.push({ c: ball(rng, new Vector3()).multiplyScalar(R * 0.6), s: R * rng.range(0.22, 0.5), w: rng.range(0.5, 1) });
  // one bright ionised core where the exciting stars sit (the volume's primary light when given)
  const core = clumps[0];
  if (coreAt) core.c.copy(coreAt);
  const p = new Vector3();
  const hot: RGB = mix3(color, WHITE, 0.55);
  const rim: RGB = mix3(color, [color[0], color[1] * 0.7, color[2] * 0.6], 0.5);
  let tries = 0;
  while (gas && g.n < N && tries++ < N * 40) {
    ball(rng, p).multiplyScalar(R * 1.25);
    let dens = 0;
    for (const c of clumps) dens += c.w * Math.exp(-p.distanceToSquared(c.c) / (2 * c.s * c.s));
    const f = noise.fbm(p.x / R * 2.2, p.y / R * 2.2, p.z / R * 2.2);
    const carved = dens * Math.pow(Math.max(0, f - 0.3) * 1.6, 1.4);
    if (rng.next() > carved) continue;
    const toCore = Math.exp(-p.distanceToSquared(core.c) / (2 * core.s * core.s));
    const col = mix3(rim, hot, Math.min(1, toCore * 1.2));
    const bright = Math.min(1.5, 0.35 + carved * 0.8 + toCore * 0.6);
    g.add(p.x, p.y, p.z, col, bright, rng.range(1.0, 2.6) * (1.2 - 0.5 * Math.min(1, carved)));
  }
  // young stars: a loose cluster in the core, a few scattered (only where no real members exist)
  const nStars = decorativeStars ? rng.int(25, 70) : 0;
  for (let i = 0; i < nStars; i++) {
    const inCore = rng.chance(0.7);
    if (inCore) p.set(gauss(rng), gauss(rng), gauss(rng)).multiplyScalar(core.s * 0.45).add(core.c);
    else ball(rng, p).multiplyScalar(R);
    const t = rng.next();
    const col = t < 0.6 ? BLUE_STAR : t < 0.9 ? WHITE : YELLOW_STAR;
    g.add(p.x, p.y, p.z, col, rng.logRange(0.03, 0.2), 0.1);
  }
  const blob = (1.7 * 2 * R) / Math.sqrt(N);
  return g.done(blob, 0.09);
}

/** Planetary nebula: bright thin shell, polar lobes, a hot central star */
function planetary(rng: Rng, R: number, color: RGB, gas = true): Generated {
  const g = new Gen();
  const N = 6000;
  const noise = new Noise3(rng);
  const axis = sphereDir(rng, new Vector3());
  const bipolar = rng.chance(0.6);
  const p = new Vector3();
  const inner: RGB = mix3(color, [0.6, 0.95, 0.75], 0.5);   // [O III] green-teal inside
  const outer: RGB = mix3(color, [1.0, 0.45, 0.35], 0.55);  // Hα / [N II] red rim
  let tries = 0;
  while (gas && g.n < N && tries++ < N * 30) {
    sphereDir(rng, p);
    const mu = Math.abs(p.dot(axis));
    // shell radius grows toward the poles when bipolar
    const shellR = R * 0.78 * (bipolar ? 1 + 0.75 * Math.pow(mu, 4) : 1);
    const r = shellR + gauss(rng) * R * 0.07;
    p.multiplyScalar(r);
    const f = noise.fbm(p.x / R * 3, p.y / R * 3, p.z / R * 3);
    const equatorDense = bipolar ? 1 - 0.55 * mu : 1;
    if (rng.next() > (0.35 + f) * equatorDense) continue;
    const t = Math.min(1, Math.max(0, (r / shellR - 0.92) / 0.16));
    g.add(p.x, p.y, p.z, mix3(inner, outer, t), 0.6 + 0.6 * f, rng.range(0.6, 1.3));
  }
  // faint filled interior
  for (let i = 0; gas && i < N * 0.18; i++) {
    ball(rng, p).multiplyScalar(R * 0.7);
    g.add(p.x, p.y, p.z, inner, 0.18, rng.range(1.2, 2.2));
  }
  // central star (hot, bluish-white)
  g.add(0, 0, 0, [0.8, 0.88, 1.0], 0.5, 0.05);
  const blob = (1.7 * 2 * R) / Math.sqrt(N);
  return g.done(blob, 0.13);
}

/** Supernova remnant / wind bubble: a filamentary expanding shell with a faint hot interior */
function remnant(rng: Rng, R: number, color: RGB, gas = true): Generated {
  const g = new Gen();
  const N = 7000;
  const noise = new Noise3(rng);
  const p = new Vector3();
  const warm: RGB = mix3(color, [1.0, 0.6, 0.45], 0.4);
  const cool: RGB = mix3(color, [0.6, 0.8, 1.0], 0.4);
  // slightly lopsided shell (denser ISM on one side)
  const squash = sphereDir(rng, new Vector3());
  let tries = 0;
  while (gas && g.n < N && tries++ < N * 30) {
    sphereDir(rng, p);
    const side = p.dot(squash);
    const shellR = R * (0.95 - 0.12 * side);
    const r = shellR + gauss(rng) * R * 0.05;
    p.multiplyScalar(r);
    const f = noise.fbm(p.x / R * 3.5, p.y / R * 3.5, p.z / R * 3.5);
    // filaments: only the noise ridges keep gas
    const fil = Math.pow(Math.max(0, f - 0.38) * 2.2, 1.8) * (0.7 + 0.5 * side);
    if (rng.next() > fil) continue;
    g.add(p.x, p.y, p.z, mix3(cool, warm, Math.min(1, fil)), 0.5 + fil, rng.range(0.6, 1.4));
  }
  for (let i = 0; gas && i < N * 0.12; i++) {
    ball(rng, p).multiplyScalar(R * 0.85);
    g.add(p.x, p.y, p.z, cool, 0.12, rng.range(1.5, 2.5));
  }
  const blob = (1.7 * 2 * R) / Math.sqrt(N);
  return g.done(blob, 0.14);
}

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h >>> 0;
}

function smoothstep(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}
