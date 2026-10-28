import {
  AdditiveBlending, BufferAttribute, BufferGeometry, DynamicDrawUsage, Group, Points, ShaderMaterial, Vector3, type Scene,
} from 'three';
import type { CelestialBody } from '../core/CelestialBody';
import { AU_KM, DAY_S } from '../core/constants';
import { Rng, hashSeed } from '../gen/SystemGenerator';
import { isKeplerian, mathToScene, positionFromE, resolveElements, solveKepler } from '../math/kepler';
import { propagateState } from '../math/propagate';
import { Shaders } from './shaders';

/** dust grid: release times × grain sizes */
const N_TAU = 40;
const N_BETA = 26;
const N_DUST = N_TAU * N_BETA;
/** how far back the dust is followed (days) */
const TMAX_DAYS = 110;
const N_ION = 420;
const N_COMA = 6;
const N_ALL = N_DUST + N_ION + N_COMA;
/** the dust positions are recomputed when the clock moved this much (days) */
const RECOMPUTE_JD = 2e-4;

const DUST_COLOR = [1.0, 0.92, 0.74];
const ION_COLOR = [0.5, 0.66, 1.0];
const COMA_COLOR = [0.78, 0.96, 0.84];

const _p = new Vector3(), _p2 = new Vector3(), _v = new Vector3(), _m = new Vector3(), _rel = new Vector3();
const _r = new Vector3(), _dir = new Vector3(), _e1 = new Vector3(), _e2 = new Vector3(), _up = new Vector3(0, 1, 0);

/**
 * Activity of the nucleus by heliocentric distance (AU): water ice sublimates inside ~3 AU and the
 * production rate climbs steeply toward the Sun (roughly r⁻⁴ outside 2 AU, flattening within).
 */
export function cometActivity(rAU: number, sqrtL = 1): number {
  rAU /= sqrtL; // other stars: the same insolation is reached at √L times the distance
  if (rAU > 6) return 0;
  const a = rAU > 2.2 ? Math.pow(2.2 / rAU, 4) : Math.min(4, Math.pow(2.2 / rAU, 1.6));
  return a * (1 - smooth01((rAU - 4.5) / 1.5));
}
/** √(L/L☉) of the body a comet orbits (1 when it is not a star) */
function sqrtLum(star: CelestialBody): number {
  const T = star.data.temperature;
  if (star.data.type !== 'star' || !T) return 1;
  return (star.data.radius / 695_700) * Math.pow(T / 5772, 2);
}
function smooth01(x: number): number { const t = Math.min(1, Math.max(0, x)); return t * t * (3 - 2 * t); }

interface Tail {
  body: CelestialBody;
  points: Points;
  geo: BufferGeometry;
  pos: Float32Array;
  alpha: Float32Array;
  size: Float32Array;
  /** heliocentric (parent-relative, scene frame) dust positions and their weights */
  dust: Float32Array;
  dustW: Float32Array;
  dustSize: Float32Array;
  /** per-grain ejection velocity (km/s), fixed */
  eject: Float32Array;
  ionJitter: Float32Array;
  lastJd: number;
  activity: number;
}

/**
 * Comet comae and tails. The dust tail is dynamical: grains released over the last months follow
 * their own orbits around a Sun lightened by radiation pressure (β), which bends the tail along
 * the orbit as the real syndynes do. The ion tail streams straight down the solar wind, aberrated
 * by the comet's motion; the coma is a soft green-white glow around the nucleus. Everything
 * scales with the sublimation activity, so a comet far out is a bare nucleus.
 */
export class CometTails {
  readonly group = new Group();
  private readonly tails = new Map<string, Tail>();
  private readonly mat: ShaderMaterial;

  constructor(scene: Scene) {
    this.mat = new ShaderMaterial({
      vertexShader: Shaders.cometVert,
      fragmentShader: Shaders.cometFrag,
      uniforms: { uPxPerRad: { value: 1000 }, uPixelRatio: { value: 1 }, uMaxPx: { value: 400 }, uVis: { value: 1 } },
      transparent: true, depthWrite: false, depthTest: true, blending: AdditiveBlending,
    });
    scene.add(this.group);
  }

  private tailFor(b: CelestialBody): Tail {
    let t = this.tails.get(b.id);
    if (t) return t;
    const pos = new Float32Array(N_ALL * 3);
    const alpha = new Float32Array(N_ALL);
    const size = new Float32Array(N_ALL);
    const color = new Float32Array(N_ALL * 3);
    for (let i = 0; i < N_ALL; i++) {
      const c = i < N_DUST ? DUST_COLOR : i < N_DUST + N_ION ? ION_COLOR : COMA_COLOR;
      color[i * 3] = c[0]; color[i * 3 + 1] = c[1]; color[i * 3 + 2] = c[2];
    }
    // the innermost coma points whiten
    for (let k = 0; k < N_COMA; k++) {
      const i = N_DUST + N_ION + k, w = k / (N_COMA - 1);
      color[i * 3] = COMA_COLOR[0] + (1 - COMA_COLOR[0]) * w; color[i * 3 + 1] = 1; color[i * 3 + 2] = COMA_COLOR[2] + (1 - COMA_COLOR[2]) * w;
    }
    const rng = new Rng(hashSeed(b.data.appearance.kind === 'terrestrial' ? b.data.appearance.seed : 7, 0xc0e7));
    const eject = new Float32Array(N_DUST * 3);
    for (let i = 0; i < N_DUST; i++) {
      // grains leave at a few hundred m/s, mostly from the sunward side (added below), in all directions
      const th = rng.range(0, Math.PI * 2), ph = Math.acos(rng.range(-1, 1)), s = rng.range(0.05, 0.4);
      eject[i * 3] = s * Math.sin(ph) * Math.cos(th); eject[i * 3 + 1] = s * Math.sin(ph) * Math.sin(th); eject[i * 3 + 2] = s * Math.cos(ph);
    }
    const ionJitter = new Float32Array(N_ION * 3);
    for (let i = 0; i < N_ION; i++) { ionJitter[i * 3] = rng.range(-1, 1); ionJitter[i * 3 + 1] = rng.range(-1, 1); ionJitter[i * 3 + 2] = rng.range(0, 1); }
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(pos, 3).setUsage(DynamicDrawUsage));
    geo.setAttribute('alpha', new BufferAttribute(alpha, 1).setUsage(DynamicDrawUsage));
    geo.setAttribute('aSize', new BufferAttribute(size, 1).setUsage(DynamicDrawUsage));
    geo.setAttribute('color', new BufferAttribute(color, 3));
    const points = new Points(geo, this.mat);
    points.frustumCulled = false;
    points.renderOrder = 2;
    this.group.add(points);
    t = {
      body: b, points, geo, pos, alpha, size,
      dust: new Float32Array(N_DUST * 3), dustW: new Float32Array(N_DUST), dustSize: new Float32Array(N_DUST),
      eject, ionJitter, lastJd: NaN, activity: 0,
    };
    this.tails.set(b.id, t);
    return t;
  }

  /** parent-relative state (scene frame, km, km/s) of the nucleus at `jd` */
  private stateAt(b: CelestialBody, jd: number, outPos: Vector3, outVel: Vector3 | null): boolean {
    const o = b.data.orbit;
    if (!o || !b.parent || !isKeplerian(o)) return false;
    const gm = b.parent.gm;
    const r = resolveElements(o, jd, gm);
    positionFromE(r, solveKepler(r.M, r.e), _m);
    mathToScene(_m, b.orbitBasis, outPos);
    if (outVel) {
      const d = 4 / DAY_S; // ±4 s
      const r2 = resolveElements(o, jd + d, gm);
      positionFromE(r2, solveKepler(r2.M, r2.e), _m);
      mathToScene(_m, b.orbitBasis, outVel);
      outVel.sub(outPos).multiplyScalar(1 / 4);
    }
    return true;
  }

  private rebuildDust(t: Tail, jd: number): void {
    const b = t.body;
    const gm = b.parent!.gm;
    for (let k = 0; k < N_TAU; k++) {
      const f = k / (N_TAU - 1);
      const tauDays = TMAX_DAYS * f * f;
      if (!this.stateAt(b, jd - tauDays, _p, _v)) return;
      const rAU = _p.length() / AU_KM;
      const aRel = cometActivity(rAU, sqrtLum(b.parent!));
      // grains leave preferentially sunward (the day side sublimates)
      _dir.copy(_p).normalize();
      for (let m = 0; m < N_BETA; m++) {
        const i = k * N_BETA + m;
        const beta = 0.004 * Math.pow(210, m / (N_BETA - 1));   // 0.004 … 0.84
        _p2.copy(_p);
        _r.set(t.eject[i * 3], t.eject[i * 3 + 1], t.eject[i * 3 + 2]).addScaledVector(_dir, -0.15).add(_v);
        propagateState(_p2, _r, gm * (1 - beta), tauDays * DAY_S, _m);
        if (!Number.isFinite(_m.x + _m.y + _m.z)) _m.copy(_p);
        t.dust[i * 3] = _m.x; t.dust[i * 3 + 1] = _m.y; t.dust[i * 3 + 2] = _m.z;
        // older dust has spread thin; the biggest grains (small β) are few but linger
        const age = tauDays / TMAX_DAYS;
        t.dustW[i] = Math.min(aRel, 1.5) * Math.pow(1 - age, 0.9) / (1 + tauDays / 25) * (0.5 + 0.5 * Math.pow(1 - m / N_BETA, 0.5));
        t.dustSize[i] = 2.4e6 * (0.035 + 0.965 * Math.pow(age, 0.6)) * (0.6 + 0.6 * beta);
      }
    }
    t.lastJd = jd;
  }

  /**
   * @param bodies   all bodies of the scene (comets are picked out)
   * @param dim      0..1 daylight / fade from other layers
   */
  update(bodies: CelestialBody[], jd: number, camPos: Vector3, pxPerRad: number, pixelRatio: number, viewportMinPx: number, visible: boolean, dim: number): void {
    const u = this.mat.uniforms;
    u.uPxPerRad.value = pxPerRad;
    u.uPixelRatio.value = pixelRatio;
    u.uMaxPx.value = Math.min(viewportMinPx * 0.4, 110 * pixelRatio);
    u.uVis.value = visible ? 1 - dim : 0;
    const seen = new Set<string>();
    for (const b of bodies) {
      if (b.data.type !== 'comet' || !b.parent || b.hidden || b.filtered) continue;
      seen.add(b.id);
      const t = this.tailFor(b);
      _rel.copy(b.position).sub(b.parent.position);
      const rAU = _rel.length() / AU_KM;
      const A = cometActivity(rAU, sqrtLum(b.parent));
      t.activity = A;
      if (A < 0.003 || !visible) { t.points.visible = false; continue; }
      t.points.visible = true;
      if (!(Math.abs(jd - t.lastJd) < RECOMPUTE_JD)) this.rebuildDust(t, jd);
      // parent, camera-relative
      _p.copy(b.parent.position).sub(camPos);
      const pos = t.pos, alpha = t.alpha, size = t.size;
      const gain = Math.min(1, A) ** 0.5;
      for (let i = 0; i < N_DUST; i++) {
        pos[i * 3] = _p.x + t.dust[i * 3]; pos[i * 3 + 1] = _p.y + t.dust[i * 3 + 1]; pos[i * 3 + 2] = _p.z + t.dust[i * 3 + 2];
        alpha[i] = t.dustW[i] * 0.1 * gain;
        size[i] = t.dustSize[i] * (0.7 + 0.3 * gain);
      }
      // ion tail: down the solar wind (≈400 km/s radial) as seen from the moving nucleus
      this.stateAt(b, jd, _p2, _v);
      _dir.copy(_p2).normalize().multiplyScalar(400).sub(_v).normalize();
      _e1.crossVectors(_dir, Math.abs(_dir.y) < 0.9 ? _up : _e2.set(1, 0, 0)).normalize();
      _e2.crossVectors(_dir, _e1);
      const L = 0.22 * AU_KM * Math.pow(Math.min(A, 4), 0.6);
      const nuc = _rel.copy(b.position).sub(camPos);
      const wob = (performance.now() / 1000) * 0.05;
      for (let k = 0; k < N_ION; k++) {
        const i = N_DUST + k;
        const s = Math.pow((k + 0.5) / N_ION, 1.4);
        const w = L * 0.012 * (0.3 + s) ;
        // a slow ripple runs down the tail (the real ones kink and disconnect in the wind)
        const jx = t.ionJitter[k * 3], jy = t.ionJitter[k * 3 + 1];
        const rip = Math.sin(s * 14 + wob * 6 + t.ionJitter[k * 3 + 2] * 6) * L * 0.01 * s;
        pos[i * 3] = nuc.x + _dir.x * L * s + _e1.x * (jx * w + rip) + _e2.x * jy * w;
        pos[i * 3 + 1] = nuc.y + _dir.y * L * s + _e1.y * (jx * w + rip) + _e2.y * jy * w;
        pos[i * 3 + 2] = nuc.z + _dir.z * L * s + _e1.z * (jx * w + rip) + _e2.z * jy * w;
        alpha[i] = Math.pow(1 - s, 1.3) * 0.22 * gain * (0.5 + 0.5 * t.ionJitter[k * 3 + 2]);
        size[i] = L * 0.035 * (0.35 + 1.0 * s);
      }
      // coma
      const Rc = 3.5e4 * Math.pow(Math.min(A, 4), 0.5);
      for (let k = 0; k < N_COMA; k++) {
        const i = N_DUST + N_ION + k;
        const f = Math.pow(0.55, k);
        pos[i * 3] = nuc.x; pos[i * 3 + 1] = nuc.y; pos[i * 3 + 2] = nuc.z;
        size[i] = Rc * 2 * f;
        alpha[i] = 0.1 * gain * (0.6 + 0.4 * k / (N_COMA - 1));
      }
      (t.geo.attributes.position as BufferAttribute).needsUpdate = true;
      (t.geo.attributes.alpha as BufferAttribute).needsUpdate = true;
      (t.geo.attributes.aSize as BufferAttribute).needsUpdate = true;
    }
    // comets gone from the scene (another system)
    for (const [id, t] of this.tails) {
      if (seen.has(id)) continue;
      this.group.remove(t.points);
      t.geo.dispose();
      this.tails.delete(id);
    }
  }

  /** activity (0 = bare nucleus) of a comet this frame, for the info panel */
  activityOf(b: CelestialBody): number { return this.tails.get(b.id)?.activity ?? 0; }

  dispose(): void {
    for (const t of this.tails.values()) t.geo.dispose();
    this.tails.clear();
    this.mat.dispose();
  }
}
