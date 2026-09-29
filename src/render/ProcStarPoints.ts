import {
  AdditiveBlending, BufferAttribute, BufferGeometry, DynamicDrawUsage, Points, Scene, ShaderMaterial, Vector3,
  type PerspectiveCamera,
} from 'three';
import { SKY_RADIUS_KM } from '../core/constants';
import { ProcStars, type ProcTier } from '../galaxy/ProcStars';
import type { NamedStarScreen } from './StarPoints';
import { Shaders } from './shaders';

/** Label candidates: brightest generated stars from the camera's position */
const LABEL_MAG_LIMIT = 3.8;
const LABEL_MAX = 140;

const _rel = new Vector3();
const _proj = new Vector3();

interface TierView {
  tier: ProcTier;
  points: Points;
  mat: ShaderMaterial;
  version: number;
  camRel: Vector3;
}

/** Renders the procedural star tiers with the same magnitude-based shader as the catalogue. */
export class ProcStarPoints {
  private readonly views: TierView[] = [];
  private readonly camPc = new Vector3();
  /** bright generated stars offered to the overlay as labels (refreshed a few times per second) */
  readonly namedStars: NamedStarScreen[] = [];
  private labelAcc = 1;
  private labelVersion = -1;
  private readonly labelCam = new Vector3(Infinity, Infinity, Infinity);

  constructor(readonly proc: ProcStars, scene: Scene) {
    for (const tier of proc.tiers) {
      const geo = new BufferGeometry();
      const pos = new BufferAttribute(tier.positions, 3); pos.setUsage(DynamicDrawUsage);
      const mag = new BufferAttribute(tier.absMags, 1); mag.setUsage(DynamicDrawUsage);
      const col = new BufferAttribute(tier.colors, 3); col.setUsage(DynamicDrawUsage);
      const idx = new Float32Array(tier.capacity);
      for (let i = 0; i < idx.length; i++) idx[i] = i;
      geo.setAttribute('position', pos);
      geo.setAttribute('absMag', mag);
      geo.setAttribute('color', col);
      geo.setAttribute('starIndex', new BufferAttribute(idx, 1));
      geo.setDrawRange(0, 0);
      const mat = new ShaderMaterial({
        vertexShader: Shaders.starsVert,
        fragmentShader: Shaders.pointsFrag,
        uniforms: {
          uCamPc: { value: new Vector3() },
          uPixelRatio: { value: 1 },
          uSkyRadius: { value: SKY_RADIUS_KM },
          uHideIndex: { value: -1 },
          uMagLimit: { value: 8.5 },
          uSoftness: { value: 0.0 },
        },
        transparent: true,
        blending: AdditiveBlending,
        depthWrite: false,
      });
      const points = new Points(geo, mat);
      points.frustumCulled = false;
      points.renderOrder = -10;
      scene.add(points);
      this.views.push({ tier, points, mat, version: -1, camRel: new Vector3() });
    }
  }

  setVisible(v: boolean): void { for (const t of this.views) t.points.visible = v; }

  /** @param hideId id of the current system's star (rendered as a mesh) */
  update(camPc: Vector3, pixelRatio: number, hideId: string | null, dt = 0): void {
    this.camPc.copy(camPc);
    let versionSum = 0;
    for (const v of this.views) {
      versionSum += v.tier.version;
      const t = v.tier;
      if (v.version !== t.version) {
        v.version = t.version;
        const geo = v.points.geometry;
        for (const name of ['position', 'absMag', 'color']) {
          const a = geo.getAttribute(name) as BufferAttribute;
          a.needsUpdate = true;
        }
        geo.setDrawRange(0, t.count);
      }
      v.camRel.copy(camPc).sub(t.origin);
      v.mat.uniforms.uCamPc.value.copy(v.camRel);
      v.mat.uniforms.uPixelRatio.value = pixelRatio;
      v.mat.uniforms.uHideIndex.value = hideId !== null ? (t.indexOf.get(hideId) ?? -1) : -1;
    }

    // label candidates – only when the camera moved noticeably or the cells changed
    this.labelAcc += dt;
    const moved = this.labelCam.distanceToSquared(camPc) > 1e-4;
    if (this.labelAcc >= 0.25 && (moved || versionSum !== this.labelVersion)) {
      this.labelAcc = 0;
      this.labelVersion = versionSum;
      this.labelCam.copy(camPc);
      this.refreshLabels(hideId);
    }
  }

  private refreshLabels(hideId: string | null): void {
    const found: Array<{ id: string; m: number; x: number; y: number; z: number }> = [];
    for (const v of this.views) {
      const t = v.tier;
      const p = t.positions;
      for (let i = 0; i < t.count; i++) {
        const dx = p[i * 3] - v.camRel.x, dy = p[i * 3 + 1] - v.camRel.y, dz = p[i * 3 + 2] - v.camRel.z;
        const d2 = dx * dx + dy * dy + dz * dz;
        // m = M + 5·log10(d) − 5  ⇒  m ≤ limit ⇔ d² ≤ 10^((limit − M + 5)/2.5)
        if (d2 > Math.pow(10, (LABEL_MAG_LIMIT - t.absMags[i] + 5) / 2.5)) continue;
        const m = t.absMags[i] + 2.5 * Math.log10(Math.max(d2, 1e-14)) - 5;
        if (t.ids[i] === hideId) continue;
        found.push({ id: t.ids[i], m, x: dx, y: dy, z: dz });
      }
    }
    found.sort((a, b) => a.m - b.m);
    this.namedStars.length = 0;
    for (const f of found.slice(0, LABEL_MAX)) {
      this.namedStars.push({ index: -1, name: ProcStars.nameOf(f.id), dir: new Vector3(f.x, f.y, f.z).normalize(), mag: f.m });
    }
  }

  /** Apparent magnitude of a generated star from the last camera position */
  apparentMag(id: string): number | null {
    for (const v of this.views) {
      const i = v.tier.indexOf.get(id);
      if (i === undefined) continue;
      const p = v.tier.positions;
      const d = Math.max(Math.hypot(p[i * 3] - v.camRel.x, p[i * 3 + 1] - v.camRel.y, p[i * 3 + 2] - v.camRel.z), 1e-7);
      return v.tier.absMags[i] + 5 * Math.log10(d) - 5;
    }
    return null;
  }

  pick(x: number, y: number, camera: PerspectiveCamera, W: number, H: number, hideId: string | null, maxPx = 14, magLimit = 6.5): string | null {
    let best: string | null = null;
    let bestScore = Infinity;
    for (const v of this.views) {
      const t = v.tier;
      const p = t.positions;
      for (let i = 0; i < t.count; i++) {
        _rel.set(p[i * 3] - v.camRel.x, p[i * 3 + 1] - v.camRel.y, p[i * 3 + 2] - v.camRel.z);
        const d = _rel.length();
        const m = t.absMags[i] + 5 * Math.log10(Math.max(d, 1e-7)) - 5;
        if (m > magLimit) continue;
        _proj.copy(_rel).multiplyScalar(1e11 / d).project(camera);
        if (_proj.z > 1 || _proj.z < -1) continue;
        const sx = (_proj.x * 0.5 + 0.5) * W;
        const sy = (-_proj.y * 0.5 + 0.5) * H;
        const dist = Math.hypot(sx - x, sy - y);
        if (dist > maxPx) continue;
        const score = dist + m * 0.8;
        if (score < bestScore && t.ids[i] !== hideId) { bestScore = score; best = t.ids[i]; }
      }
    }
    return best;
  }
}
