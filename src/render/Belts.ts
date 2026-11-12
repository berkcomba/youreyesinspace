import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, Matrix3, Points, Scene, ShaderMaterial, Vector3, type PerspectiveCamera } from 'three';
import { AU_KM, DEG } from '../core/constants';
import type { GeneratedBelt } from '../gen/SystemGenerator';
import type { CelestialBody } from '../core/CelestialBody';
import { Rng } from '../gen/SystemGenerator';
import { Shaders } from './shaders';
import { disposeOrPin } from './ProgramPins';
import { presetBounds } from './Bounds';
import { STAR_SHARED_UNIFORMS } from './starTrail';

/** Orbital elements of one belt particle (km, rad, rad/s; mean anomaly at J2000) */
export interface BeltParticle {
  belt: number; index: number;
  a: number; e: number; i: number; node: number; argPeri: number; M0: number; n: number;
  /** 0…1 brightness draw of the particle */
  size: number;
}

const _m = new Vector3();
const _p = new Vector3();

/** Procedural belt elements by seed: a system revisited (the Sun, mostly) gets them back for free */
const elemCache = new Map<number, { e0: Float32Array; e1: Float32Array }>();
const ELEM_CACHE_MAX = 24;

/** GPU-animated Keplerian particle belts (asteroid belt, Kuiper belt, trojans) for the current system. */
export class Belts {
  readonly points: Array<Points | null> = [];
  private readonly mats: Array<ShaderMaterial | null> = [];
  private readonly opacities: number[] = [];
  private readonly elems: Array<{ e0: Float32Array; e1: Float32Array; attr: BufferAttribute } | null> = [];
  /** body each belt circles (a star or a pair's barycentre) */
  readonly centers: CelestialBody[] = [];
  /** per belt: catalogue index of its first body (Solar System small bodies), null = procedural */
  readonly real: Array<number | null> = [];
  private readonly specs: GeneratedBelt[] = [];
  private readonly bases: Matrix3[] = [];
  /** last camera position / epoch time, for picking */
  private readonly camPos = new Vector3();
  private tSeconds = 0;
  private pixelRatio = 1;
  private visible = true;
  private dim = 0;

  private retiredMats: ShaderMaterial[] = [];

  constructor(private readonly scene: Scene) {}

  /**
   * Replace the belts with those of a new system. The belts themselves (tens of thousands of
   * orbits each) are built one per frame in `update()` — or at once when something asks for
   * their particles — since a frame switch in flight happens far outside them.
   * @param centerOf the body a belt circles (its `gm` sets the particle periods)
   * @param basisOf orbit reference plane → scene for that centre (identity for the ecliptic, the
   *   centre's pole basis otherwise)
   */
  setSystem(specs: GeneratedBelt[], centerOf: (s: GeneratedBelt) => CelestialBody, basisOf: (c: CelestialBody) => Matrix3): void {
    for (const p of this.points) {
      if (!p) continue;
      this.scene.remove(p);
      p.geometry.dispose();
    }
    // the materials are released one switch later: freeing them now would drop the shared belt
    // program just before the new system's belts need it again
    for (const m of this.retiredMats) disposeOrPin(m);
    this.retiredMats = this.mats.filter((m): m is ShaderMaterial => !!m);
    this.points.length = 0;
    this.mats.length = 0;
    this.opacities.length = 0;
    this.elems.length = 0;
    this.centers.length = 0;
    this.real.length = 0;
    this.specs.length = 0;
    this.bases.length = 0;

    for (const s of specs) {
      const center = centerOf(s);
      this.centers.push(center);
      this.real.push(s.real ? s.real.first : null);
      this.specs.push(s);
      this.bases.push(basisOf(center).clone());
      this.opacities.push(s.opacity);
      this.points.push(null);
      this.mats.push(null);
      this.elems.push(null);
    }
  }

  /** Build belt `b` (its orbital elements, geometry and material) if it is not yet */
  private build(b: number): void {
    if (this.elems[b] || !this.specs[b]) return;
    const s = this.specs[b];
    const center = this.centers[b];
    const starGM = center.gm;
    let e0: Float32Array, e1: Float32Array;
    if (s.real) { e0 = s.real.e0; e1 = s.real.e1; }
    else {
      const cached = elemCache.get(s.seed);
      if (cached && cached.e0.length === s.count * 4) {
        // a copy: `hide` marks particles in the live arrays
        e0 = cached.e0.slice(); e1 = cached.e1.slice();
        elemCache.delete(s.seed); elemCache.set(s.seed, cached);
      } else {
        e0 = new Float32Array(s.count * 4); e1 = new Float32Array(s.count * 4);
        this.generate(s, starGM, e0, e1);
        if (elemCache.size >= ELEM_CACHE_MAX) elemCache.delete(elemCache.keys().next().value!);
        elemCache.set(s.seed, { e0: e0.slice(), e1: e1.slice() });
      }
    }
    const pos = new Float32Array(s.count * 3); // dummy for bounding
    const geo = presetBounds(new BufferGeometry());
    geo.setAttribute('position', new BufferAttribute(pos, 3));
    geo.setAttribute('elems0', new BufferAttribute(e0, 4));
    const attr1 = new BufferAttribute(e1, 4);
    geo.setAttribute('elems1', attr1);
    this.elems[b] = { e0, e1, attr: attr1 };
    const mat = new ShaderMaterial({
      vertexShader: Shaders.beltVert,
      fragmentShader: Shaders.beltFrag,
      uniforms: {
        uTime: { value: this.tSeconds },
        uSunPos: { value: new Vector3() },
        uPixelRatio: { value: this.pixelRatio },
        uBasis: { value: this.bases[b].clone() },
        uColor: { value: new Color(s.color[0], s.color[1], s.color[2]) },
        uOpacity: { value: s.opacity },
        uStarScale: STAR_SHARED_UNIFORMS.uStarScale,
      },
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
    });
    const pts = new Points(geo, mat);
    pts.frustumCulled = false;
    pts.renderOrder = -6;
    this.scene.add(pts);
    this.points[b] = pts;
    this.mats[b] = mat;
    this.refresh(b);
  }

  private generate(s: GeneratedBelt, starGM: number, e0: Float32Array, e1: Float32Array): void {
    const rng = new Rng(s.seed);
    const trojanN = s.trojan ? Math.sqrt(starGM / Math.pow(s.trojan.aAU * AU_KM, 3)) : 0;
    for (let i = 0; i < s.count; i++) {
      let aAU = s.aMin + (s.aMax - s.aMin) * rng.next();
      if (s.gaps) {
        for (const [gc, hw] of s.gaps) {
          if (Math.abs(aAU - gc) < hw) aAU += (aAU < gc ? -1 : 1) * hw * 1.5;
        }
      }
      const a = aAU * AU_KM;
      const e = Math.pow(rng.next(), 1.5) * s.eMax;
      const u1 = Math.max(rng.next(), 1e-6), u2 = rng.next();
      const gauss = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      const inc = Math.abs(gauss) * s.iSigmaDeg * DEG;
      const node = rng.next() * Math.PI * 2;
      const w = rng.next() * Math.PI * 2;
      let M0 = rng.next() * Math.PI * 2;
      let n = Math.sqrt(starGM / (a * a * a));
      if (s.trojan) {
        const spread = (rng.next() - 0.5) * 50 * DEG;
        const L = s.trojan.meanLongitudeDeg * DEG + spread;
        M0 = L - (node + w);
        n = trojanN;
      }
      e0[i * 4] = a; e0[i * 4 + 1] = e; e0[i * 4 + 2] = inc; e0[i * 4 + 3] = node;
      e1[i * 4] = w; e1[i * 4 + 1] = M0; e1[i * 4 + 2] = n; e1[i * 4 + 3] = rng.next();
    }
  }

  private refresh(b: number): void {
    const m = this.mats[b], p = this.points[b];
    if (!m || !p) return;
    p.visible = this.visible && this.dim < 0.995;
    m.uniforms.uOpacity.value = this.opacities[b] * (1 - this.dim);
    m.uniforms.uTime.value = this.tSeconds;
    (m.uniforms.uSunPos.value as Vector3).copy(this.centers[b].position).sub(this.camPos);
    m.uniforms.uPixelRatio.value = this.pixelRatio;
  }

  /** @param dim 0…1: drowned in a bright daytime sky (seen from a planet's surface) */
  update(tSeconds: number, camPos: Vector3, pixelRatio: number, visible: boolean, dim = 0): void {
    this.tSeconds = tSeconds;
    this.camPos.copy(camPos);
    this.pixelRatio = pixelRatio;
    this.visible = visible;
    this.dim = dim;
    let built = false;
    for (let b = 0; b < this.specs.length; b++) {
      if (!this.elems[b] && !built) { this.build(b); built = true; }
      this.refresh(b);
    }
  }

  /** Elements of particle `index` of belt `belt` */
  particle(belt: number, index: number): BeltParticle | null {
    this.build(belt);
    const el = this.elems[belt];
    if (!el || index < 0 || index * 4 >= el.e0.length) return null;
    const { e0, e1 } = el;
    const k = index * 4;
    return { belt, index, a: e0[k], e: e0[k + 1], i: e0[k + 2], node: e0[k + 3], argPeri: e1[k], M0: e1[k + 1], n: e1[k + 2], size: Math.abs(e1[k + 3]) };
  }

  /** Stop drawing a particle (it has become a real body) */
  hide(belt: number, index: number): void {
    this.build(belt);
    const el = this.elems[belt];
    if (!el) return;
    const k = index * 4 + 3;
    if (el.e1[k] > 0) { el.e1[k] = -el.e1[k]; el.attr.needsUpdate = true; }
  }

  /** Camera-relative position (km) of a particle of belt `b` at the current time */
  private position(b: number, e0: Float32Array, e1: Float32Array, k: number, out: Vector3): Vector3 {
    const a = e0[k], e = e0[k + 1], inc = e0[k + 2], node = e0[k + 3];
    const w = e1[k], M0 = e1[k + 1], n = e1[k + 2];
    const M = (M0 + n * this.tSeconds) % (Math.PI * 2);
    let E = e > 0.8 ? Math.PI : M + e * Math.sin(M);
    for (let it = 0; it < 8; it++) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    const P = a * (Math.cos(E) - e), Q = a * Math.sqrt(1 - e * e) * Math.sin(E);
    const cw = Math.cos(w), sw = Math.sin(w), cO = Math.cos(node), sO = Math.sin(node), ci = Math.cos(inc), si = Math.sin(inc);
    const xw = P * cw - Q * sw, yw = P * sw + Q * cw;
    _m.set(xw * cO - yw * ci * sO, xw * sO + yw * ci * cO, yw * si);
    out.set(_m.x, _m.z, -_m.y).applyMatrix3(this.bases[b]).add(this.centers[b].position).sub(this.camPos);
    return out;
  }

  /**
   * The belt particle under a screen point, when the camera is close enough for the rocks to be
   * individual objects (inside / next to the belt). Hidden particles are skipped.
   */
  pick(x: number, y: number, camera: PerspectiveCamera, W: number, H: number, maxPx = 10, catalogue = true): BeltParticle | null {
    let best: BeltParticle | null = null;
    let bestD = maxPx;
    // belts still queued (a few frames after a switch) are not under the pointer: not yet drawn
    for (let b = 0; b < this.elems.length; b++) {
      if (!this.points[b]?.visible) continue;
      // catalogue bodies are real objects at any range (a full scan: clicks only, not hover)
      const real = this.real[b];
      if (real && !catalogue) continue;
      const camToStar = this.centers[b].position.distanceTo(this.camPos);
      const { e0, e1 } = this.elems[b]!;
      const count = e0.length / 4;
      // "near": the camera is in the belt's zone, and the rock itself is within a fraction of its
      // orbit radius (a km-scale rock is not a visible object from the other side of the system)
      let aMax = 0, aMin = Infinity;
      for (let i = 0; i < count; i += 97) { const a = e0[i * 4]; aMax = Math.max(aMax, a); aMin = Math.min(aMin, a); }
      if (camToStar > aMax * 1.8 || camToStar < aMin * 0.35) continue;
      for (let i = 0; i < count; i++) {
        const k = i * 4;
        if (e1[k + 3] < 0) continue;
        this.position(b, e0, e1, k, _p);
        const dist = _p.length();
        if (dist < 1 || (!real && dist > e0[k] * 0.4)) continue;
        _p.project(camera);
        if (_p.z > 1 || _p.z < -1) continue;
        const sx = (_p.x * 0.5 + 0.5) * W, sy = (-_p.y * 0.5 + 0.5) * H;
        const d = Math.hypot(sx - x, sy - y);
        if (d < bestD) { bestD = d; best = this.particle(b, i); }
      }
    }
    return best;
  }
}
