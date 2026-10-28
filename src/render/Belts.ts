import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, Matrix3, Points, Scene, ShaderMaterial, Vector3, type PerspectiveCamera } from 'three';
import { AU_KM, DEG } from '../core/constants';
import type { GeneratedBelt } from '../gen/SystemGenerator';
import type { CelestialBody } from '../core/CelestialBody';
import { Rng } from '../gen/SystemGenerator';
import { Shaders } from './shaders';

/** Orbital elements of one belt particle (km, rad, rad/s; mean anomaly at J2000) */
export interface BeltParticle {
  belt: number; index: number;
  a: number; e: number; i: number; node: number; argPeri: number; M0: number; n: number;
  /** 0…1 brightness draw of the particle */
  size: number;
}

const _m = new Vector3();
const _p = new Vector3();

/** GPU-animated Keplerian particle belts (asteroid belt, Kuiper belt, trojans) for the current system. */
export class Belts {
  readonly points: Points[] = [];
  private readonly mats: ShaderMaterial[] = [];
  private readonly opacities: number[] = [];
  private readonly elems: Array<{ e0: Float32Array; e1: Float32Array; attr: BufferAttribute }> = [];
  /** body each belt circles (a star or a pair's barycentre) */
  readonly centers: CelestialBody[] = [];
  /** last camera position / epoch time, for picking */
  private readonly camPos = new Vector3();
  private tSeconds = 0;

  private retiredMats: ShaderMaterial[] = [];

  constructor(private readonly scene: Scene) {}

  /**
   * Replace the belts with those of a new system.
   * @param centerOf the body a belt circles (its `gm` sets the particle periods)
   * @param basisOf orbit reference plane → scene for that centre (identity for the ecliptic, the
   *   centre's pole basis otherwise)
   */
  setSystem(specs: GeneratedBelt[], centerOf: (s: GeneratedBelt) => CelestialBody, basisOf: (c: CelestialBody) => Matrix3): void {
    for (const p of this.points) {
      this.scene.remove(p);
      p.geometry.dispose();
    }
    // the materials are released one switch later: freeing them now would drop the shared belt
    // program just before the new system's belts need it again
    for (const m of this.retiredMats) m.dispose();
    this.retiredMats = [...this.mats];
    this.points.length = 0;
    this.mats.length = 0;
    this.elems.length = 0;
    this.centers.length = 0;

    for (const s of specs) {
      const center = centerOf(s);
      const starGM = center.gm;
      const basis = basisOf(center);
      this.centers.push(center);
      const rng = new Rng(s.seed);
      const e0 = new Float32Array(s.count * 4);
      const e1 = new Float32Array(s.count * 4);
      const pos = new Float32Array(s.count * 3); // dummy for bounding
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
      const geo = new BufferGeometry();
      geo.setAttribute('position', new BufferAttribute(pos, 3));
      geo.setAttribute('elems0', new BufferAttribute(e0, 4));
      const attr1 = new BufferAttribute(e1, 4);
      geo.setAttribute('elems1', attr1);
      this.elems.push({ e0, e1, attr: attr1 });
      const mat = new ShaderMaterial({
        vertexShader: Shaders.beltVert,
        fragmentShader: Shaders.beltFrag,
        uniforms: {
          uTime: { value: 0 },
          uSunPos: { value: new Vector3() },
          uPixelRatio: { value: 1 },
          uBasis: { value: basis.clone() },
          uColor: { value: new Color(s.color[0], s.color[1], s.color[2]) },
          uOpacity: { value: s.opacity },
        },
        transparent: true,
        blending: AdditiveBlending,
        depthWrite: false,
      });
      const pts = new Points(geo, mat);
      pts.frustumCulled = false;
      pts.renderOrder = -6;
      this.scene.add(pts);
      this.points.push(pts);
      this.mats.push(mat);
      this.opacities.push(s.opacity);
    }
  }

  /** @param dim 0…1: drowned in a bright daytime sky (seen from a planet's surface) */
  update(tSeconds: number, camPos: Vector3, pixelRatio: number, visible: boolean, dim = 0): void {
    this.tSeconds = tSeconds;
    this.camPos.copy(camPos);
    for (let i = 0; i < this.mats.length; i++) {
      this.points[i].visible = visible && dim < 0.995;
      const m = this.mats[i];
      m.uniforms.uOpacity.value = this.opacities[i] * (1 - dim);
      m.uniforms.uTime.value = tSeconds;
      (m.uniforms.uSunPos.value as Vector3).copy(this.centers[i].position).sub(camPos);
      m.uniforms.uPixelRatio.value = pixelRatio;
    }
  }

  /** Elements of particle `index` of belt `belt` */
  particle(belt: number, index: number): BeltParticle | null {
    const el = this.elems[belt];
    if (!el || index < 0 || index * 4 >= el.e0.length) return null;
    const { e0, e1 } = el;
    const k = index * 4;
    return { belt, index, a: e0[k], e: e0[k + 1], i: e0[k + 2], node: e0[k + 3], argPeri: e1[k], M0: e1[k + 1], n: e1[k + 2], size: Math.abs(e1[k + 3]) };
  }

  /** Stop drawing a particle (it has become a real body) */
  hide(belt: number, index: number): void {
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
    let E = M + e * Math.sin(M);
    for (let it = 0; it < 4; it++) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    const P = a * (Math.cos(E) - e), Q = a * Math.sqrt(1 - e * e) * Math.sin(E);
    const cw = Math.cos(w), sw = Math.sin(w), cO = Math.cos(node), sO = Math.sin(node), ci = Math.cos(inc), si = Math.sin(inc);
    const xw = P * cw - Q * sw, yw = P * sw + Q * cw;
    _m.set(xw * cO - yw * ci * sO, xw * sO + yw * ci * cO, yw * si);
    out.set(_m.x, _m.z, -_m.y).applyMatrix3(this.mats[b].uniforms.uBasis.value as Matrix3).add(this.centers[b].position).sub(this.camPos);
    return out;
  }

  /**
   * The belt particle under a screen point, when the camera is close enough for the rocks to be
   * individual objects (inside / next to the belt). Hidden particles are skipped.
   */
  pick(x: number, y: number, camera: PerspectiveCamera, W: number, H: number, maxPx = 10): BeltParticle | null {
    let best: BeltParticle | null = null;
    let bestD = maxPx;
    for (let b = 0; b < this.elems.length; b++) {
      if (!this.points[b].visible) continue;
      const camToStar = this.centers[b].position.distanceTo(this.camPos);
      const { e0, e1 } = this.elems[b];
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
        if (dist < 1 || dist > e0[k] * 0.4) continue;
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
