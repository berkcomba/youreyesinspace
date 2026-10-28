import {
  AdditiveBlending, BufferAttribute, BufferGeometry, Matrix3, Points, Scene, ShaderMaterial, Vector3, Vector4,
} from 'three';
import { SKY_RADIUS_KM } from '../core/constants';
import type { Landmark } from '../core/Universe';
import { LANDMARK_IMAGES } from '../data/landmarkImages';
import { Rng } from '../gen/SystemGenerator';
import { NebulaClouds } from './NebulaClouds';
import { Shaders } from './shaders';
import type { NebulaKind, Volume, Volumes } from './Volumes';

/** clouds alive at once (the most resolved ones) */
const MAX_CLOUDS = 4;
/** cached geometries (recently visited objects come back instantly) */
const MAX_CACHE = 10;

interface Cloud {
  id: string;
  points: Points;
  mat: ShaderMaterial;
  center: Vector3;
  radiusPc: number;
  absMag: number;
  /** raymarched gas (nebulae, planetaries, remnants); the points then only carry the stars */
  volume: Volume | null;
}

/**
 * Volumetric stand-ins for the deep-sky landmarks that have no photograph (all generated ones
 * and a few real ones): built procedurally by kind when the object gets resolved — gas sheets and
 * knots for nebulae, a shell with lobes for planetary nebulae, a star swarm for clusters, a
 * filamentary shell for remnants. Shares the brightness law and the point shader of the
 * photographic clouds, so the handover from the flat sprite is seamless.
 */
export class ProcClouds {
  private readonly clouds = new Map<string, Cloud>();
  private daylight = 0;
  private readonly active = new Set<number>();

  constructor(private readonly landmarks: Landmark[], private readonly scene: Scene, private readonly maxPointPx: number, private readonly volumes: Volumes | null = null) {}

  setDaylight(d: number): void {
    this.daylight = Math.min(1, d * 1.5);
    for (const c of this.clouds.values()) c.mat.uniforms.uDaylight.value = this.daylight;
  }

  /**
   * Pick the resolved landmarks, build their clouds if needed, fade them in. Returns the indices
   * (into `landmarks`) that currently have a cloud, for the sprite handover.
   */
  update(camPc: Vector3, pxPerRad: number, pixelRatio: number, k: number, visible: boolean): Set<number> {
    this.active.clear();
    const cands: Array<{ i: number; px: number; d: number }> = [];
    for (let i = 0; i < this.landmarks.length; i++) {
      const l = this.landmarks[i];
      const kind = l.def.kind;
      if (kind === 'star' || kind === 'pulsar' || LANDMARK_IMAGES[l.def.id]) continue;
      const d = Math.max(l.positionPc.distanceTo(camPc), 1e-6);
      const px = Math.atan(l.def.radiusPc / d) * pxPerRad;
      if (px < 7) continue;
      cands.push({ i, px, d });
    }
    cands.sort((a, b) => b.px - a.px);
    const wanted = new Set<string>();
    let built = false;   // one build per frame (20+ ms each): two newcomers arrive a frame apart
    for (const c of cands.slice(0, MAX_CLOUDS)) {
      const l = this.landmarks[c.i];
      wanted.add(l.def.id);
      let cloud = this.clouds.get(l.def.id);
      // built for the other mode (gas as points vs raymarched): rebuild
      if (cloud && cloud.volume !== null && !this.volumes!.enabled) { this.destroy(cloud); this.clouds.delete(l.def.id); cloud = undefined; }
      if (!cloud) {
        if (built) continue;
        cloud = this.build(l); this.clouds.set(l.def.id, cloud); built = true;
      }
      const u = cloud.mat.uniforms;
      (u.uCenterRel.value as Vector3).copy(cloud.center).sub(camPc);
      const t = NebulaClouds.handover(c.px);
      if (!visible || t <= 0) { cloud.points.visible = false; if (cloud.volume) cloud.volume.active = false; continue; }
      // same law as the sprite: physical flux spread over the disc, navigation floor up close
      const m = cloud.absMag + 5 * Math.log10(c.d) - 5;
      const flux = Math.pow(10, -0.4 * m);
      const pxc = Math.max(c.px, 0.75);
      const physical = Math.min((k * flux) / (0.61 * pxc * pxc), 1);
      const nearR = l.def.kind === 'globular' ? 150 : 600;   // as landmark.vert
      const near = 0.6 * (1 - smoothstep(nearR * 0.1, nearR, c.d / cloud.radiusPc));
      u.uFade.value = Math.max(physical, near) * t;
      u.uPxPerRad.value = pxPerRad;
      u.uPixelRatio.value = pixelRatio;
      cloud.points.visible = true;
      if (cloud.volume) {
        const v = cloud.volume;
        v.place(camPc, cloud.center, cloud.radiusPc, v.u.uToLocal.value, pxPerRad);
        v.u.uFade.value = u.uFade.value;
        v.active = this.volumes!.enabled;
      }
      this.active.add(c.i);
    }
    // hide the rest; evict the oldest unused clouds beyond the cache size
    for (const [id, c] of this.clouds) {
      if (wanted.has(id)) continue;
      c.points.visible = false;
      if (c.volume) c.volume.active = false;
      if (this.clouds.size > MAX_CACHE) { this.destroy(c); this.clouds.delete(id); }
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

  private build(l: Landmark): Cloud {
    const R = l.def.radiusPc;
    const rng = new Rng(hashStr(l.def.id));
    const kind = l.def.kind;
    const col = l.def.color;
    let g: Generated;
    let volume: Volume | null = null;
    const gas = !this.volumes?.enabled || kind === 'cluster' || kind === 'globular';
    if (!gas) {
      const vk: NebulaKind = kind === 'planetary' ? 'planetary' : kind === 'remnant' ? 'remnant' : col[2] > col[0] * 1.1 ? 'reflection' : 'emission';
      const vr = new Rng(hashStr(l.def.id) ^ 0x51f3);
      volume = this.volumes!.nebula(vk, col, () => vr.next());
    }
    if (kind === 'cluster') g = openCluster(rng, R, col);
    else if (kind === 'globular') g = globular(rng, R, col);
    else if (kind === 'planetary') g = planetary(rng, R, col, gas);
    else if (kind === 'remnant') g = remnant(rng, R, col, gas);
    else g = nebula(rng, R, col, gas);

    const geo = new BufferGeometry();
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
    return { id: l.def.id, points, mat, center: l.positionPc.clone(), radiusPc: R, absMag: l.def.absMag, volume };
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
function nebula(rng: Rng, R: number, color: RGB, gas = true): Generated {
  const g = new Gen();
  const N = 9000;
  const noise = new Noise3(rng);
  const nClump = rng.int(4, 9);
  const clumps: Array<{ c: Vector3; s: number; w: number }> = [];
  for (let i = 0; i < nClump; i++) clumps.push({ c: ball(rng, new Vector3()).multiplyScalar(R * 0.6), s: R * rng.range(0.22, 0.5), w: rng.range(0.5, 1) });
  // one bright ionised core where the exciting stars sit
  const core = clumps[0];
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
  // young stars: a loose cluster in the core, a few scattered
  const nStars = rng.int(25, 70);
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

/** Open cluster: a Plummer sphere of a few hundred stars, young ones still wrapped in faint gas */
function openCluster(rng: Rng, R: number, color: RGB): Generated {
  const g = new Gen();
  const a = R * 0.45;
  const p = new Vector3();
  const young = color[2] > color[0]; // bluish tint = young
  // the member stars themselves are drawn by ClusterStarPoints; here only the unresolved faint
  // majority as a soft Plummer glow
  for (let i = 0; i < 500; i++) {
    const u = Math.max(rng.next(), 1e-4);
    const r = a / Math.sqrt(Math.pow(u, -2 / 3) - 1);
    if (r > R * 1.6) continue;
    sphereDir(rng, p).multiplyScalar(r);
    g.add(p.x, p.y, p.z, young ? WHITE : YELLOW_STAR, 0.05, rng.range(1.0, 1.8));
  }
  const N = 1200;
  if (young) {
    // remnants of the birth cloud, lit blue by the cluster
    const noise = new Noise3(rng);
    const haze: RGB = mix3(color, [0.5, 0.65, 1.0], 0.5);
    let tries = 0, n = 0;
    while (n < N && tries++ < N * 20) {
      ball(rng, p).multiplyScalar(R * 1.2);
      const f = noise.fbm(p.x / R * 2, p.y / R * 2, p.z / R * 2);
      const env = Math.exp(-p.lengthSq() / (2 * R * R * 0.35));
      if (rng.next() > Math.max(0, f - 0.35) * 1.8 * env) continue;
      g.add(p.x, p.y, p.z, haze, 0.15, rng.range(1.5, 2.6));
      n++;
    }
  }
  const blob = (1.7 * 2 * R) / Math.sqrt(N);
  return g.done(blob, 0.08);
}

/** Globular cluster: thousands of old stars, steeply concentrated, a few blue stragglers in the core */
function globular(rng: Rng, R: number, color: RGB): Generated {
  const g = new Gen();
  const rc = R * 0.12; // core radius
  const p = new Vector3();
  const old: RGB = mix3(color, YELLOW_STAR, 0.5);
  // the resolved members are drawn by ClusterStarPoints; this is the unresolved glow of the
  // hundreds of thousands of faint stars
  const N = 2500;
  for (let i = 0; i < N; i++) {
    const u = Math.max(rng.next(), 1e-5);
    const r = rc * Math.sqrt(Math.pow(u, -1.0) - 1) * 0.5;
    if (r > R) continue;
    sphereDir(rng, p).multiplyScalar(r);
    g.add(p.x, p.y, p.z, old, 0.07, rng.range(1.0, 2.0));
  }
  const blob = (1.7 * 2 * R) / Math.sqrt(N);
  return g.done(blob, 0.06);
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
