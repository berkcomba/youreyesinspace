import {
  AdditiveBlending, BufferAttribute, BufferGeometry, Points, Scene, ShaderMaterial, Vector3, Vector4, type PerspectiveCamera,
} from 'three';
import { SKY_RADIUS_KM } from '../core/constants';
import type { GalaxySource } from '../galaxy/galaxies';
import type { NamedStarScreen } from './StarPoints';
import { GalaxyCloud } from './GalaxyCloud';
import { PROCEDURAL_TINT } from './ProcStarPoints';
import { Shaders } from './shaders';

const _rel = new Vector3();
const _proj = new Vector3();

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
        uBoostMag: { value: boostMag },
        uCatalogCount: { value: galaxies.catalogCount },
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

  /** Tint procedural (non-catalogue) galaxies green */
  setHighlight(on: boolean): void { this.mat.uniforms.uTint.value.w = on ? 0.85 : 0; }

  /** Whole-layer visibility (0–1); used for the local ↔ far-universe LOD hand-over */
  setFade(f: number): void {
    this.fade = f;
    this.mat.uniforms.uTierFade.value = f;
    this.applyVisibility();
  }

  private applyVisibility(): void { this.points.visible = this.enabled && this.fade > 0.001; }

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
    // labels: catalogue galaxies that are reasonably prominent from here
    this.named.length = 0;
    for (let i = 0; i < this.galaxies.catalogCount; i++) {
      if (i === hideIndex) continue;
      const { angRad, ratio } = this.apparent(i);
      if (ratio < 6) continue;
      const m = this.apparentMag(i);
      const px = angRad * pxPerRad;
      // physical view: only naked-eye / conspicuous galaxies; boosted view: everything catalogued
      if (boost < 0.5 ? (m > 6.5 && px < 12) : (m > 14 && px < 3)) continue;
      this.named.push({ index: i, name: this.galaxies.name(i), dir: this.direction(i), mag: m });
    }
  }

  /** Galaxy nearest to a screen point (px), or null */
  pick(x: number, y: number, camera: PerspectiveCamera, W: number, H: number, pxPerRad: number, boost: number, hideIndex: number, maxPx = 14): number | null {
    const g = this.galaxies;
    const p = g.positions;
    let best = -1;
    let bestScore = Infinity;
    for (let i = 0; i < g.count; i++) {
      if (i === hideIndex) continue;
      _rel.set(p[i * 3] - this.camPc.x, p[i * 3 + 1] - this.camPc.y, p[i * 3 + 2] - this.camPc.z);
      const d = _rel.length();
      if (d < g.radius[i] * 6) continue;
      const m = g.absMag[i] + 5 * Math.log10(Math.max(d, 1e-3)) - 5;
      const px = (g.radius[i] / d) * pxPerRad;
      if (boost < 0.5 && m > 12 && px < 2) continue;
      _proj.copy(_rel).multiplyScalar(1e11 / d).project(camera);
      if (_proj.z > 1 || _proj.z < -1) continue;
      const sx = (_proj.x * 0.5 + 0.5) * W;
      const sy = (-_proj.y * 0.5 + 0.5) * H;
      const dist = Math.hypot(sx - x, sy - y);
      const reach = Math.max(maxPx, px);
      if (dist > reach) continue;
      const score = dist / reach + m * 0.02;
      if (score < bestScore) { bestScore = score; best = i; }
    }
    return best >= 0 ? best : null;
  }
}
