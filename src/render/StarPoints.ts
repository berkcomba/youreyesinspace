import { _ } from '../i18n';
import {
  AdditiveBlending, BufferAttribute, BufferGeometry, Points, Scene, ShaderMaterial, Vector3, type PerspectiveCamera,
} from 'three';
import { SKY_RADIUS_KM } from '../core/constants';
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
}

/** camera distance from the Sun (pc) beyond which famous stars are labelled as landmarks */
const LANDMARK_DIST_PC = 40;
/** famous stars that are not among the naked-eye brightest but everyone looks for */
const EXTRA_LANDMARKS = ['Polaris', 'Proxima Centauri', 'Barnard\'s Star', 'Mizar', 'Algol', 'Castor', 'Mira', 'Alcor', 'Alnilam', 'Wolf 359', 'Kapteyn\'s Star', 'Tau Ceti'];

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
      this.namedStars.push({ index: i, name: this.catalog.nameOf(i), dir: this.direction(i), mag: m });
    }
    if (hideIndex !== 0) {
      // Always offer the Sun as a label so the way home is obvious
      this.namedStars.push({ index: 0, name: _('Güneş'), dir: this.direction(0), mag: this.apparentMag(0), landmark: true });
    }
    // Far from home the whole catalogue is too faint to label; keep the famous stars findable
    this.far = camPc.length() > LANDMARK_DIST_PC;
    if (this.far) {
      for (const i of this.landmarks) {
        if (i === 0 || i === hideIndex) continue;
        if (this.namedStars.some((n) => n.index === i)) continue;
        this.namedStars.push({ index: i, name: this.catalog.nameOf(i), dir: this.direction(i), mag: this.catalog.mags[i] + 2.5, landmark: true });
      }
    }
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
    if (best < 0 && this.far) {
      // landmarks are pickable regardless of brightness
      for (const i of this.landmarks) {
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
