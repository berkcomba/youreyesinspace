import {
  AdditiveBlending, BufferAttribute, BufferGeometry, Points, Scene, ShaderMaterial, Vector3, type PerspectiveCamera,
} from 'three';
import { PARSEC_KM, SKY_RADIUS_KM } from '../core/constants';
import type { StarCatalog } from '../data/StarCatalog';
import { bvToRgb } from '../astro/stellar';
import { Shaders } from './shaders';

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
export class StarPoints {
  readonly points: Points;
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

  constructor(readonly catalog: StarCatalog, scene: Scene) {
    const n = catalog.count;
    const col = new Float32Array(n * 3);
    const idx = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const [r, g, b] = bvToRgb(catalog.bvs[i]);
      col[i * 3] = r;
      col[i * 3 + 1] = g;
      col[i * 3 + 2] = b;
      idx[i] = i;
    }
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(catalog.positions, 3));
    geo.setAttribute('absMag', new BufferAttribute(catalog.absMags, 1));
    geo.setAttribute('color', new BufferAttribute(col, 3));
    geo.setAttribute('starIndex', new BufferAttribute(idx, 1));

    this.mat = new ShaderMaterial({
      vertexShader: Shaders.starsVert,
      fragmentShader: Shaders.pointsFrag,
      uniforms: {
        uCamPc: { value: new Vector3() },
        uPixelRatio: { value: 1 },
        uSkyRadius: { value: SKY_RADIUS_KM },
        uHideIndex: { value: 0 },
        uMagLimit: { value: 8.5 },
        uSoftness: { value: 0.0 },
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

    this.points = new Points(geo, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = -10;
    scene.add(this.points);
  }

  setPixelRatio(pr: number): void {
    this.mat.uniforms.uPixelRatio.value = pr;
  }

  setVisible(v: boolean): void {
    this.points.visible = v;
  }

  /** Apparent magnitude of star i as seen from the current camera position */
  apparentMag(i: number): number {
    const p = this.catalog.positions;
    const dx = p[i * 3] - this.camPc.x, dy = p[i * 3 + 1] - this.camPc.y, dz = p[i * 3 + 2] - this.camPc.z;
    const d = Math.max(Math.sqrt(dx * dx + dy * dy + dz * dz), 1e-7);
    return this.catalog.absMags[i] + 5 * Math.log10(d) - 5;
  }

  /** Unit direction from the camera to star i */
  direction(i: number, out = new Vector3()): Vector3 {
    const p = this.catalog.positions;
    return out.set(p[i * 3] - this.camPc.x, p[i * 3 + 1] - this.camPc.y, p[i * 3 + 2] - this.camPc.z).normalize();
  }

  /**
   * @param camPc camera position in parsecs (scene frame, relative to the Sun)
   * @param hideIndex catalogue index of the current system's star
   */
  update(camPc: Vector3, hideIndex: number): void {
    this.camPc.copy(camPc);
    this.mat.uniforms.uCamPc.value.copy(camPc);
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
    const p = this.catalog.positions;
    return Math.hypot(p[i * 3] - this.camPc.x, p[i * 3 + 1] - this.camPc.y, p[i * 3 + 2] - this.camPc.z);
  }

  /** Pick the star nearest to a screen point (px). Only stars brighter than `magLimit` are considered. */
  pick(x: number, y: number, camera: PerspectiveCamera, W: number, H: number, hideIndex: number, maxPx = 14, magLimit = 6.5): number | null {
    const p = this.catalog.positions;
    let best = -1;
    let bestScore = Infinity;
    for (let i = 0; i < this.catalog.count; i++) {
      if (i === hideIndex) continue;
      _rel.set(p[i * 3] - this.camPc.x, p[i * 3 + 1] - this.camPc.y, p[i * 3 + 2] - this.camPc.z);
      const d = _rel.length();
      const m = this.catalog.absMags[i] + 5 * Math.log10(Math.max(d, 1e-7)) - 5;
      if (m > magLimit) continue;
      _proj.copy(_rel).multiplyScalar(1e11 / d).project(camera);
      if (_proj.z > 1 || _proj.z < -1) continue;
      const sx = (_proj.x * 0.5 + 0.5) * W;
      const sy = (-_proj.y * 0.5 + 0.5) * H;
      const dist = Math.hypot(sx - x, sy - y);
      if (dist > maxPx) continue;
      // prefer brighter stars when several overlap
      const score = dist + m * 0.8;
      if (score < bestScore) { bestScore = score; best = i; }
    }
    if (best < 0) {
      // marked stars (the Sun, the neighbourhood, far landmarks) are pickable regardless of brightness
      for (const i of this.marked) {
        if (i === hideIndex) continue;
        _rel.set(p[i * 3] - this.camPc.x, p[i * 3 + 1] - this.camPc.y, p[i * 3 + 2] - this.camPc.z);
        _proj.copy(_rel).multiplyScalar(1e11 / _rel.length()).project(camera);
        if (_proj.z > 1 || _proj.z < -1) continue;
        const sx = (_proj.x * 0.5 + 0.5) * W;
        const sy = (-_proj.y * 0.5 + 0.5) * H;
        const dist = Math.hypot(sx - x, sy - y);
        if (dist > maxPx + 4 || dist >= bestScore) continue;
        bestScore = dist; best = i;
      }
    }
    return best >= 0 ? best : null;
  }
}
