import {
  AdditiveBlending, BufferAttribute, BufferGeometry, Points, Scene, ShaderMaterial, Vector2, Vector3, Vector4, type PerspectiveCamera,
} from 'three';
import { PARSEC_KM, SKY_RADIUS_KM } from '../core/constants';
import type { GalaxySource } from '../galaxy/galaxies';
import type { NamedStarScreen } from './StarPoints';
import { GalaxyCloud } from './GalaxyCloud';
import { PROCEDURAL_TINT } from './ProcStarPoints';
import { Shaders } from './shaders';
import { better, PICK_MIN_VIS, type PickHit } from './pickHit';

const _rel = new Vector3();
const _proj = new Vector3();
/** at most this many survey galaxies are labelled at once (the brightest on screen) */
const SURVEY_LABELS = 30;

/**
 * Every galaxy in the index as an analytic sprite (disc / ellipsoid with arms). Handles the
 * whole range from "faint dot in the cosmic web" to "resolved neighbour", handing over to a
 * GalaxyCloud when the camera gets within ~12 radii.
 */
export class GalaxySprites {
  readonly points: Points;
  readonly named: NamedStarScreen[] = [];
  private readonly mat: ShaderMaterial;
  private readonly camPc = new Vector3();

  /** @param boostMag magnitude offset of the boosted-visibility scale (0 for individual galaxies) */
  constructor(readonly galaxies: GalaxySource, scene: Scene, maxPointPx: number, boostMag = 0) {
    const n = galaxies.count;
    const idx = new Float32Array(n);
    const type = new Float32Array(n);
    const seed = new Float32Array(n);
    // spiral geometry packed as (arm count, tan pitch, major-arm weight); the same numbers drive the
    // GalaxyModel, so the sprite's arms line up with the point cloud it fades into
    const spiral = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      idx[i] = i; type[i] = galaxies.type[i]; seed[i] = (galaxies.seed[i] % 1000) / 10;
      const arms = galaxies.arms?.[i] ?? 2;
      const pitch = galaxies.pitch?.[i] ?? 15;
      spiral[i * 3] = arms;
      spiral[i * 3 + 1] = Math.tan((pitch * Math.PI) / 180);
      // barred spirals with > 2 arms: odd arms are minor (GalaxyModel.armWeight)
      spiral[i * 3 + 2] = galaxies.type[i] === 3 && arms > 2 ? 0.4 : 1;
    }
    const geo = new BufferGeometry();
    geo.setAttribute('spiral', new BufferAttribute(spiral, 3));
    geo.setAttribute('position', new BufferAttribute(galaxies.positions.subarray(0, n * 3), 3));
    geo.setAttribute('radius', new BufferAttribute(galaxies.radius.subarray(0, n), 1));
    geo.setAttribute('absMag', new BufferAttribute(galaxies.absMag.subarray(0, n), 1));
    geo.setAttribute('gtype', new BufferAttribute(type, 1));
    geo.setAttribute('gnormal', new BufferAttribute(galaxies.normal.subarray(0, n * 3), 3));
    geo.setAttribute('gmajor', new BufferAttribute(galaxies.major.subarray(0, n * 3), 3));
    geo.setAttribute('axisRatio', new BufferAttribute(galaxies.axisRatio.subarray(0, n), 1));
    geo.setAttribute('seed', new BufferAttribute(seed, 1));
    geo.setAttribute('gindex', new BufferAttribute(idx, 1));
    this.mat = new ShaderMaterial({
      vertexShader: Shaders.galaxyVert,
      fragmentShader: Shaders.galaxyFrag,
      uniforms: {
        uCamPc: { value: new Vector3() },
        uPixelRatio: { value: 1 },
        uSkyRadius: { value: SKY_RADIUS_KM * 0.99 },
        uPxPerRad: { value: 1000 },
        uBoost: { value: 0 },
        uK: { value: 1 },
        uMaxPx: { value: maxPointPx },
        uHideIndex: { value: -1 },
        uTierFade: { value: 1 },
        uNearLod: { value: 1 },
        uCloudIdx: { value: new Vector3(-1, -1, -1) },
        uBoostMag: { value: boostMag },
        uCatalogCount: { value: galaxies.catalogCount },
        uSurvey: { value: new Vector2(galaxies.surveyStart ?? 0, galaxies.surveyEnd ?? 0) },
        uShowProc: { value: 1 },
        uTint: { value: new Vector4(...PROCEDURAL_TINT, 0) },
      },
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
    });
    this.points = new Points(geo, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = -13;
    scene.add(this.points);
  }

  private enabled = true;
  private fade = 1;

  setVisible(v: boolean): void { this.enabled = v; this.applyVisibility(); }

  private procVisible = true;
  /** Show or hide the procedural galaxies; catalogue and survey ones always draw */
  setProcedural(on: boolean): void {
    this.procVisible = on;
    this.mat.uniforms.uShowProc.value = on ? 1 : 0;
  }

  private isProcedural(i: number): boolean {
    const g = this.galaxies;
    return i >= g.catalogCount && !(i >= (g.surveyStart ?? 0) && i < (g.surveyEnd ?? 0));
  }

  /** Keep the sprite when the camera is close (no point cloud takes over, e.g. far-cluster members) */
  setNearLod(on: boolean): void { this.mat.uniforms.uNearLod.value = on ? 1 : 0; }

  /**
   * The galaxies (at most 3) a point cloud stands in for: only their sprites fade out up close.
   * Clouds are few; a galaxy that got none, among nearer neighbours, must not vanish.
   */
  setClouded(indices: readonly number[]): void {
    (this.mat.uniforms.uCloudIdx.value as Vector3).set(indices[0] ?? -1, indices[1] ?? -1, indices[2] ?? -1);
  }

  private clouded(i: number): boolean {
    const c = this.mat.uniforms.uCloudIdx.value as Vector3;
    return i === c.x || i === c.y || i === c.z;
  }

  /** Tint procedural (non-catalogue) galaxies green */
  setHighlight(on: boolean): void { this.mat.uniforms.uTint.value.w = on ? 0.85 : 0; }

  /** Whole-layer visibility (0–1); used for the local ↔ far-universe LOD hand-over */
  setFade(f: number): void {
    this.fade = f;
    this.mat.uniforms.uTierFade.value = f;
    this.applyVisibility();
  }

  private applyVisibility(): void { this.points.visible = this.enabled && this.fade > 0.001; }

  /** cache: squared distance (pc²) beyond which galaxy i is fainter than m₀, per m₀ */
  private readonly magLimits = new Map<number, Float64Array>();
  private magLimit(m0: number): Float64Array {
    let a = this.magLimits.get(m0);
    if (a && a.length === this.galaxies.count) return a;
    const M = this.galaxies.absMag;
    a = new Float64Array(this.galaxies.count);
    for (let i = 0; i < a.length; i++) { const d = Math.pow(10, (m0 - M[i] + 5) / 5); a[i] = d * d; }
    this.magLimits.set(m0, a);
    return a;
  }

  /** Apparent angular radius (rad) and distance ratio of galaxy i from the last camera position */
  apparent(i: number): { angRad: number; ratio: number; distPc: number } {
    const p = this.galaxies.positions;
    const d = Math.max(Math.hypot(p[i * 3] - this.camPc.x, p[i * 3 + 1] - this.camPc.y, p[i * 3 + 2] - this.camPc.z), 1e-3);
    return { angRad: this.galaxies.radius[i] / d, ratio: d / this.galaxies.radius[i], distPc: d };
  }

  apparentMag(i: number): number {
    const { distPc } = this.apparent(i);
    return this.galaxies.absMag[i] + 5 * Math.log10(distPc) - 5;
  }

  direction(i: number, out = new Vector3()): Vector3 {
    const p = this.galaxies.positions;
    return out.set(p[i * 3] - this.camPc.x, p[i * 3 + 1] - this.camPc.y, p[i * 3 + 2] - this.camPc.z).normalize();
  }

  /**
   * @param camPc camera (scene pc)
   * @param boost 0 = physical brightness, 1 = exaggerated
   * @param hideIndex galaxy whose sprite must not draw (we're inside it)
   */
  update(camPc: Vector3, pxPerRad: number, pixelRatio: number, boost: number, hideIndex: number): void {
    this.camPc.copy(camPc);
    const u = this.mat.uniforms;
    u.uCamPc.value.copy(camPc);
    u.uPxPerRad.value = pxPerRad;
    u.uPixelRatio.value = pixelRatio;
    u.uBoost.value = boost;
    u.uHideIndex.value = hideIndex;
    // same light calibration as the point clouds: flux (relative to M=4.83 at 10 pc) → alpha·px²
    // (0.16 = mean coverage of the soft blob sprite over its point area)
    u.uK.value = (0.16 * GalaxyCloud.gain * Math.PI * pxPerRad * pxPerRad) / 1.17;
    // labels: catalogue galaxies that are reasonably prominent from here. Tens of thousands of
    // candidates every frame: distances squared, magnitude cuts as precomputed distance limits
    // (m > m₀ ⇔ d > 10^((m₀ − M + 5)/5)), no allocation until one passes
    this.named.length = 0;
    const g = this.galaxies;
    const P = g.positions, Rg = g.radius;
    const cx = camPc.x, cy = camPc.y, cz = camPc.z;
    const magLimit = this.magLimit(boost < 0.5 ? 6.5 : 14), magLimit11 = this.magLimit(11);
    const pxLimit = boost < 0.5 ? 12 : 3;
    for (let i = 0; i < g.catalogCount; i++) {
      if (i === hideIndex) continue;
      const dx = P[i * 3] - cx, dy = P[i * 3 + 1] - cy, dz = P[i * 3 + 2] - cz;
      const d2 = dx * dx + dy * dy + dz * dz;
      const R = Rg[i];
      if (d2 < 36 * R * R) continue;                       // ratio < 6: we are (nearly) inside
      // physical view: only naked-eye / conspicuous galaxies; boosted view: everything catalogued
      if (d2 > magLimit[i] && d2 * pxLimit * pxLimit > R * R * pxPerRad * pxPerRad) continue;
      const d = Math.max(Math.sqrt(d2), 1e-3);
      const m = g.absMag[i] + 5 * Math.log10(d) - 5;
      this.named.push({ index: i, name: g.name(i), dir: new Vector3(dx / d, dy / d, dz / d), mag: m, distKm: d * PARSEC_KM });
    }
    // the surveys' tens of thousands: only the big / bright ones on screen, at most SURVEY_LABELS
    const s0 = g.surveyStart ?? 0, s1 = g.surveyEnd ?? 0;
    const survey: NamedStarScreen[] = [];
    const px12 = 144 / (pxPerRad * pxPerRad), px4 = 16 / (pxPerRad * pxPerRad);   // (px/pxPerRad)² thresholds on (R/d)²
    for (let i = s0; i < s1; i++) {
      if (i === hideIndex) continue;
      const dx = P[i * 3] - cx, dy = P[i * 3 + 1] - cy, dz = P[i * 3 + 2] - cz;
      const d2 = dx * dx + dy * dy + dz * dz;
      const R = Rg[i];
      const R2 = R * R;
      if (d2 < 36 * R2) continue;
      if (R2 < px12 * d2) {
        if (boost < 0.5 || R2 < px4 * d2) continue;
        if (d2 > magLimit11[i]) continue;
      }
      const d = Math.max(Math.sqrt(d2), 1e-3);
      const m = g.absMag[i] + 5 * Math.log10(d) - 5;
      survey.push({ index: i, name: g.name(i), dir: new Vector3(dx / d, dy / d, dz / d), mag: m, distKm: d * PARSEC_KM });
    }
    if (survey.length > SURVEY_LABELS) { survey.sort((a, b) => a.mag - b.mag); survey.length = SURVEY_LABELS; }
    this.named.push(...survey);
  }

  /** Galaxy nearest to a screen point (px), or null */
  pick(x: number, y: number, camera: PerspectiveCamera, W: number, H: number, pxPerRad: number, boost: number, hideIndex: number, slackPx = 7): number | null {
    return this.pickHit(x, y, camera, W, H, pxPerRad, boost, hideIndex, slackPx)?.value ?? null;
  }

  /**
   * Galaxy under a screen point, weighted by how bright the sprite is drawn (galaxy.vert). With
   * `clouds`, galaxies whose sprite has handed over to a point cloud stay clickable via that cloud.
   */
  pickHit(x: number, y: number, camera: PerspectiveCamera, W: number, H: number, pxPerRad: number, boost: number, hideIndex: number, slackPx = 7, clouds?: ReadonlySet<number> | Map<number, unknown>): PickHit<number> | null {
    if (!this.points.visible) return null;
    const g = this.galaxies;
    const p = g.positions;
    const u = this.mat.uniforms;
    const K = u.uK.value as number, boostMag = u.uBoostMag.value as number, nearLod = u.uNearLod.value as number;
    let best: PickHit<number> | null = null;
    for (let i = 0; i < g.count; i++) {
      if (i === hideIndex || (!this.procVisible && this.isProcedural(i))) continue;
      _rel.set(p[i * 3] - this.camPc.x, p[i * 3 + 1] - this.camPc.y, p[i * 3 + 2] - this.camPc.z);
      const d = Math.max(_rel.length(), 1e-3);
      const ratio = d / g.radius[i];
      const m = g.absMag[i] + 5 * Math.log10(d) - 5;
      const px = (g.radius[i] / d) * pxPerRad;
      const pxc = Math.max(px, 0.75);
      const physical = Math.min((K * Math.pow(10, -0.4 * m)) / (0.61 * pxc * pxc), 1);
      const boostA = Math.min(1, Math.max(0, 1 - (m - boostMag - 7) / 10));
      const lod = nearLod > 0.5 && this.clouded(i) ? smooth01((ratio - 6) / 6) : 1;
      let vis = (physical + (Math.max(physical, boostA) - physical) * boost) * lod * this.fade;
      // the cloud that replaced the sprite is as clickable as the sprite was (from outside it)
      if (clouds?.has(i) && ratio > 1.3) vis = Math.max(vis, 0.5);
      if (vis < PICK_MIN_VIS) continue;
      _proj.copy(_rel).multiplyScalar(1e11 / d).project(camera);
      if (_proj.z > 1 || _proj.z < -1) continue;
      const dist = Math.hypot((_proj.x * 0.5 + 0.5) * W - x, (-_proj.y * 0.5 + 0.5) * H - y);
      const drawn = Math.max(px * 0.8, 1 + 2.5 * boost);
      const reach = Math.min(drawn, H * 0.35) + slackPx;
      if (dist > reach) continue;
      best = better(best, { value: i, dist, reach, vis, extended: px > 6 });
    }
    return best;
  }
}

function smooth01(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}
