import {
  AdditiveBlending, BufferAttribute, BufferGeometry, Points, Scene, ShaderMaterial, Vector3, Vector4, type PerspectiveCamera,
} from 'three';
import { PARSEC_KM, SKY_RADIUS_KM } from '../core/constants';
import type { StarCatalog, TierAttributes } from '../data/StarCatalog';
import { bvToRgb } from '../astro/stellar';
import { Shaders } from './shaders';
import { STAR_SHARED_UNIFORMS } from './starTrail';
import { better, PICK_MIN_VIS, starLook, type PickHit } from './pickHit';
import { presetBounds } from './Bounds';

export interface NamedStarScreen {
  index: number;
  name: string;
  /** unit direction from the camera, scene frame */
  dir: Vector3;
  /** apparent magnitude from the camera */
  mag: number;
  /** navigation landmark: shown (and pickable) even when far too faint to see from here */
  landmark?: boolean;
  /** label opacity (landmarks fading in); 1 when omitted */
  alpha?: number;
  /** distance from the camera (km): appended to the label as "· 8.6 ly" */
  distKm?: number;
  /** star id when the entry is not a catalogue star (generated stars) */
  id?: string;
}

/** camera distance from the Sun (pc) beyond which famous stars are labelled as landmarks */
const LANDMARK_DIST_PC = 40;
/** famous stars that are not among the naked-eye brightest but everyone looks for */
const EXTRA_LANDMARKS = ['Polaris', 'Proxima Centauri', 'Barnard\'s Star', 'Mizar', 'Algol', 'Castor', 'Mira', 'Alcor', 'Alnilam', 'Wolf 359', 'Kapteyn\'s Star', 'τ Cet'];
/**
 * The Sun's neighbourhood: the best-known stars within ~25 ly. Between leaving the solar system
 * and reaching the first of them there is nothing to judge scale by, so they are marked — with
 * their distance — regardless of brightness while the camera is still near home.
 */
const NEIGHBOURS = ['Proxima Centauri', 'Rigil Kentaurus', 'Barnard\'s Star', 'Wolf 359', 'Lalande 21185', 'Sirius', 'Luyten\'s Star', 'Ross 154', 'ε Eri', 'Lacaille 9352', 'Ross 128', '61 Cyg', 'Procyon', 'ε Ind', 'τ Cet', 'Kapteyn\'s Star', 'Altair', 'Vega', 'Fomalhaut'];
/** camera distance from the Sun (pc) at which the neighbourhood markers fade in (≈ 0.5 → 1 ly) */
const NEIGHBOUR_FADE_PC: [number, number] = [0.15, 0.3];

const _rel = new Vector3();
const _proj = new Vector3();

/**
 * Renders the whole star catalogue as point sprites at their true 3D positions, so the sky
 * shows parallax as the camera travels between systems. Brightness follows the real
 * distance-dependent apparent magnitude; the current system's star is hidden (it is a mesh).
 */
/** stars per upload slice of a background tier */
const TIER_SLICE = 300_000;

export class StarPoints {
  /** the core catalogue */
  readonly points: Points;
  /** the background-loaded tiers, one draw each */
  private readonly tierPoints: Points[] = [];
  private tiersVisible = true;
  private visible = true;
  readonly namedStars: NamedStarScreen[] = [];
  /** catalogue indices of the landmark stars (Sun first) */
  readonly landmarks: number[] = [0];
  /** catalogue indices of the neighbourhood stars (see NEIGHBOURS) */
  readonly neighbours: number[] = [];
  /** landmark / neighbourhood stars currently marked on the sky: pickable whatever their brightness */
  private readonly marked: number[] = [];
  private far = false;
  private readonly mat: ShaderMaterial;
  private readonly camPc = new Vector3();

  constructor(readonly catalog: StarCatalog, private readonly scene: Scene) {
    this.mat = new ShaderMaterial({
      vertexShader: Shaders.starsVert,
      fragmentShader: Shaders.starsFrag,
      uniforms: {
        uDrift: { value: 0 },
        // every material sharing stars.vert must set every uniform: the three materials share one
        // GL program, and an unset uniform keeps whatever the previous draw left in it
        uMagBoost: { value: 0 },
        uCamPc: { value: new Vector3() },
        uPixelRatio: { value: 1 },
        uSkyRadius: { value: SKY_RADIUS_KM },
        uHideIndex: { value: 0 },
        uMagLimit: { value: 8.5 },
        uFade: { value: 1 },
        uDaylight: { value: 0 },
        uSoftness: { value: 0.0 },
        uTint: { value: new Vector4(0, 0, 0, 0) },
        ...STAR_SHARED_UNIFORMS,
      },
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
    });
    // landmarks: the ~25 brightest named stars as seen from Earth plus a few famous faint ones
    for (const i of catalog.namedIndices) if (i !== 0 && catalog.mags[i] < 1.65) this.landmarks.push(i);
    for (const name of EXTRA_LANDMARKS) {
      const hit = catalog.search(name, 1)[0];
      if (hit !== undefined && hit !== 0 && !this.landmarks.includes(hit)) this.landmarks.push(hit);
    }
    for (const name of NEIGHBOURS) {
      const hit = catalog.search(name, 1)[0];
      if (hit !== undefined && hit !== 0 && !this.neighbours.includes(hit)) this.neighbours.push(hit);
    }

    this.points = this.makePoints(0, catalog.core);
    catalog.onTier((t, attrs) => {
      // a tier goes to the GPU in slices, one per frame: two million stars' attributes uploaded in
      // one go hold a frame for 50 ms or more
      let k = 0;
      const slice = (): void => {
        const n = Math.min(TIER_SLICE, t.count - k);
        const pts = this.makePoints(t.first + k, n, { colors: attrs.colors.subarray(k * 3, (k + n) * 3), indices: attrs.indices.subarray(k, k + n) });
        pts.visible = this.visible && this.tiersVisible;
        this.tierPoints.push(pts);
        k += n;
        if (k < t.count) requestAnimationFrame(slice);
      };
      slice();
    });
  }

  /** One draw over catalogue indices [first, first + n) */
  private makePoints(first: number, n: number, attrs?: TierAttributes): Points {
    const c = this.catalog;
    // a tier arrives with its colours and indices already computed (worker); the core does them here
    const col = attrs?.colors ?? new Float32Array(n * 3);
    const idx = attrs?.indices ?? new Float32Array(n);
    if (!attrs) {
      for (let k = 0; k < n; k++) {
        const [r, g, b] = bvToRgb(c.bvs[first + k]);
        col[k * 3] = r;
        col[k * 3 + 1] = g;
        col[k * 3 + 2] = b;
        idx[k] = first + k;
      }
    }
    const geo = presetBounds(new BufferGeometry());
    geo.setAttribute('position', new BufferAttribute(c.positions.subarray(first * 3, (first + n) * 3), 3));
    geo.setAttribute('velocity', new BufferAttribute(c.velocities.subarray(first * 3, (first + n) * 3), 3));
    geo.setAttribute('absMag', new BufferAttribute(c.absMags.subarray(first, first + n), 1));
    geo.setAttribute('color', new BufferAttribute(col, 3));
    geo.setAttribute('starIndex', new BufferAttribute(idx, 1));
    const pts = new Points(geo, this.mat);
    pts.frustumCulled = false;
    pts.renderOrder = -10;
    this.scene.add(pts);
    return pts;
  }

  /** Show / hide the background-loaded tiers (they stay in memory) */
  setTiersVisible(v: boolean): void {
    this.tiersVisible = v;
    for (const p of this.tierPoints) p.visible = this.visible && v;
  }

  setPixelRatio(pr: number): void {
    this.mat.uniforms.uPixelRatio.value = pr;
  }

  /** Daytime sky (0 none … 1 full): the faint stars go first, the bright ones dim. */
  setDaylight(d: number): void {
    this.mat.uniforms.uMagLimit.value = 8.5 - 13 * d;
    this.mat.uniforms.uDaylight.value = d * 0.6;
  }

  setVisible(v: boolean): void {
    this.visible = v;
    this.points.visible = v;
    for (const p of this.tierPoints) p.visible = v && this.tiersVisible;
  }

  /** Apparent magnitude of star i as seen from the current camera position */
  apparentMag(i: number): number {
    const d = Math.max(this.catalog.position(i, _rel).distanceTo(this.camPc), 1e-7);
    return this.catalog.absMags[i] + 5 * Math.log10(d) - 5;
  }

  /** Unit direction from the camera to star i */
  direction(i: number, out = new Vector3()): Vector3 {
    return this.catalog.position(i, out).sub(this.camPc).normalize();
  }

  /**
   * @param camPc camera position in parsecs (scene frame, relative to the Sun)
   * @param hideIndex catalogue index of the current system's star
   */
  update(camPc: Vector3, hideIndex: number): void {
    this.camPc.copy(camPc);
    this.mat.uniforms.uCamPc.value.copy(camPc);
    this.mat.uniforms.uDrift.value = this.catalog.drift;
    this.mat.uniforms.uHideIndex.value = hideIndex;

    // Named-star label candidates (bright from here)
    this.namedStars.length = 0;
    for (const i of this.catalog.namedIndices) {
      if (i === hideIndex) continue;
      const m = this.apparentMag(i);
      if (m > 3.6) continue;
      this.namedStars.push({ index: i, name: this.catalog.nameOf(i), dir: this.direction(i), mag: m, distKm: this.distancePc(i) * PARSEC_KM });
    }
    // The Sun itself is drawn by the overlay's sun marker (with distance and an off-screen compass);
    // it only needs to stay pickable here when it is not the current system's body.
    this.marked.length = 0;
    if (hideIndex !== 0) this.marked.push(0);
    const dSun = camPc.length();
    this.far = dSun > LANDMARK_DIST_PC;
    if (!this.far && dSun > NEIGHBOUR_FADE_PC[0]) {
      // Leaving home: the nearest famous stars, each with its distance, so the first light-years have a scale
      const alpha = Math.min(1, (dSun - NEIGHBOUR_FADE_PC[0]) / (NEIGHBOUR_FADE_PC[1] - NEIGHBOUR_FADE_PC[0]));
      for (const i of this.neighbours) {
        if (i === hideIndex) continue;
        const distKm = this.distancePc(i) * PARSEC_KM;
        const cur = this.namedStars.find((n) => n.index === i);
        if (cur) { cur.landmark = true; cur.alpha = alpha; cur.distKm = distKm; }
        else this.namedStars.push({ index: i, name: this.catalog.nameOf(i), dir: this.direction(i), mag: this.catalog.mags[i] + 2.5, landmark: true, alpha, distKm });
        this.marked.push(i);
      }
    }
    // Far from home the whole catalogue is too faint to label; keep the famous stars findable
    if (this.far) {
      for (const i of this.landmarks) {
        if (i === 0 || i === hideIndex) continue;
        this.marked.push(i);
        if (this.namedStars.some((n) => n.index === i)) continue;
        this.namedStars.push({ index: i, name: this.catalog.nameOf(i), dir: this.direction(i), mag: this.catalog.mags[i] + 2.5, landmark: true, distKm: this.distancePc(i) * PARSEC_KM });
      }
    }
  }

  /** Distance (pc) from the current camera position to star i */
  distancePc(i: number): number {
    return this.catalog.position(i, _rel).distanceTo(this.camPc);
  }

  /** Pick the star nearest to a screen point (px). Only stars brighter than `magLimit` are considered. */
  pick(x: number, y: number, camera: PerspectiveCamera, W: number, H: number, hideIndex: number, slackPx = 7, magLimit = this.mat.uniforms.uMagLimit.value as number): number | null {
    return this.pickHit(x, y, camera, W, H, hideIndex, slackPx, magLimit)?.value ?? null;
  }

  /** Best candidate under a screen point, sized and weighted as the shader draws it */
  pickHit(x: number, y: number, camera: PerspectiveCamera, W: number, H: number, hideIndex: number, slackPx = 7, magLimit = this.mat.uniforms.uMagLimit.value as number): PickHit<number> | null {
    const c = this.catalog;
    const p = c.positions, v = c.velocities, k = c.drift, f0 = c.flux0;
    const cx = this.camPc.x, cy = this.camPc.y, cz = this.camPc.z;
    const fade = this.mat.uniforms.uFade.value as number;
    // m ≤ magLimit ⇔ d² ≤ 10^(0.4·(magLimit + 5)) · 10^(−0.4·M): a cheap cut before the logarithm
    const reach2 = Math.pow(10, 0.4 * (magLimit + 5));
    const n = this.tiersVisible ? c.count : c.core;
    let best: PickHit<number> | null = null;
    for (let i = 0; i < n; i++) {
      if (i === hideIndex) continue;
      const dx = p[i * 3] + v[i * 3] * k - cx, dy = p[i * 3 + 1] + v[i * 3 + 1] * k - cy, dz = p[i * 3 + 2] + v[i * 3 + 2] * k - cz;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 > reach2 * f0[i]) continue;
      _rel.set(dx, dy, dz);
      const d = Math.sqrt(d2);
      const m = c.absMags[i] + 5 * Math.log10(Math.max(d, 1e-7)) - 5;
      if (m > magLimit) continue;
      const look = starLook(m);
      const vis = look.alpha * fade;
      if (vis < PICK_MIN_VIS) continue;
      const reach = look.size / 2 + slackPx;
      _proj.copy(_rel).multiplyScalar(1e11 / d).project(camera);
      if (_proj.z > 1 || _proj.z < -1) continue;
      const dist = Math.hypot((_proj.x * 0.5 + 0.5) * W - x, (-_proj.y * 0.5 + 0.5) * H - y);
      if (dist > reach) continue;
      best = better(best, { value: i, dist, reach, vis });
    }
    // marked stars (the Sun, the neighbourhood, far landmarks) carry a label: pickable regardless of brightness
    for (const i of this.marked) {
      if (i === hideIndex) continue;
      c.position(i, _rel).sub(this.camPc);
      _proj.copy(_rel).multiplyScalar(1e11 / _rel.length()).project(camera);
      if (_proj.z > 1 || _proj.z < -1) continue;
      const dist = Math.hypot((_proj.x * 0.5 + 0.5) * W - x, (-_proj.y * 0.5 + 0.5) * H - y);
      const reach = slackPx + 4;
      if (dist > reach) continue;
      best = better(best, { value: i, dist, reach, vis: 0.5 });
    }
    return best;
  }
}
