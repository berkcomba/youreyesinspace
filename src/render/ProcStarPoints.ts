import {
  AdditiveBlending, BufferAttribute, BufferGeometry, DynamicDrawUsage, Points, Scene, ShaderMaterial, Vector3, Vector4,
  type PerspectiveCamera,
} from 'three';
import { PARSEC_KM, SKY_RADIUS_KM } from '../core/constants';
import { ProcStars, type ProcTier } from '../galaxy/ProcStars';
import type { NamedStarScreen } from './StarPoints';
import { Shaders } from './shaders';
import { better, PICK_MIN_VIS, starLook, type PickHit } from './pickHit';

/**
 * Tint used by the "highlight procedural content" setting: a green no real star or galaxy ever
 * has, so generated objects are unmistakable next to catalogue ones.
 */
export const PROCEDURAL_TINT: [number, number, number] = [0.35, 1.0, 0.55];

/** Label candidates: brightest generated stars from the camera's position */
const LABEL_MAG_LIMIT = 3.8;
const LABEL_MAX = 140;
/** a star already labelled keeps its label until it fades this much past the limit (no flicker at the edge) */
const LABEL_HYSTERESIS = 0.6;

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
  /** tier + buffer index behind each label, so its direction can follow the camera every frame */
  private readonly labelRefs: Array<{ v: TierView; i: number }> = [];
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
          uFade: { value: 1 },
          uDaylight: { value: 0 },
          uSoftness: { value: 0.0 },
          uTint: { value: new Vector4(...PROCEDURAL_TINT, 0) },
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

  /** Tint every generated star green (debug / "what is real?" view) */
  setHighlight(on: boolean): void { for (const t of this.views) t.mat.uniforms.uTint.value.w = on ? 0.85 : 0; }
  /** Daytime sky (0 none … 1 full), as StarPoints.setDaylight */
  setDaylight(d: number): void { for (const t of this.views) { t.mat.uniforms.uMagLimit.value = 8.5 - 13 * d; t.mat.uniforms.uDaylight.value = d * 0.6; } }

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
      v.mat.uniforms.uHideIndex.value = hideId !== null ? t.indexOfId(hideId) : -1;
    }

    // label set – re-chosen a few times per second or when the cells changed; between refreshes the
    // existing labels track the camera every frame so they glide instead of jumping
    this.labelAcc += dt;
    const moved = this.labelCam.distanceToSquared(camPc) > 1e-4;
    if (versionSum !== this.labelVersion || (this.labelAcc >= 0.25 && moved)) {
      this.labelAcc = 0;
      this.labelVersion = versionSum;
      this.labelCam.copy(camPc);
      this.refreshLabels(hideId);
    } else {
      this.trackLabels();
    }
  }

  /** Update direction, distance and magnitude of the current labels from the current camera position */
  private trackLabels(): void {
    for (let k = 0; k < this.namedStars.length; k++) {
      const { v, i } = this.labelRefs[k];
      const p = v.tier.positions;
      const s = this.namedStars[k];
      s.dir.set(p[i * 3] - v.camRel.x, p[i * 3 + 1] - v.camRel.y, p[i * 3 + 2] - v.camRel.z);
      const d = Math.max(s.dir.length(), 1e-7);
      s.dir.divideScalar(d);
      s.distKm = d * PARSEC_KM;
      s.mag = v.tier.absMags[i] + 5 * Math.log10(d) - 5;
    }
  }

  private refreshLabels(hideId: string | null): void {
    const keep = new Set<string>();
    for (const s of this.namedStars) if (s.id) keep.add(s.id);
    const found: Array<{ v: TierView; i: number; id: string; m: number; x: number; y: number; z: number; kept: boolean }> = [];
    const limit = LABEL_MAG_LIMIT + (keep.size ? LABEL_HYSTERESIS : 0);
    for (const v of this.views) {
      const t = v.tier;
      const p = t.positions;
      for (let i = 0; i < t.count; i++) {
        const dx = p[i * 3] - v.camRel.x, dy = p[i * 3 + 1] - v.camRel.y, dz = p[i * 3 + 2] - v.camRel.z;
        const d2 = dx * dx + dy * dy + dz * dz;
        // m = M + 5·log10(d) − 5  ⇒  m ≤ limit ⇔ d² ≤ 10^((limit − M + 5)/2.5)
        if (d2 > Math.pow(10, (limit - t.absMags[i] + 5) / 2.5)) continue;
        const m = t.absMags[i] + 2.5 * Math.log10(Math.max(d2, 1e-14)) - 5;
        const id = t.idAt(i);
        if (id === hideId) continue;
        const kept = keep.has(id);
        if (!kept && m > LABEL_MAG_LIMIT) continue; // newcomers must clear the strict limit
        found.push({ v, i, id, m, x: dx, y: dy, z: dz, kept });
      }
    }
    // brightest first; a label that is already on screen wins ties against a newcomer
    found.sort((a, b) => (a.m - (a.kept ? LABEL_HYSTERESIS : 0)) - (b.m - (b.kept ? LABEL_HYSTERESIS : 0)));
    const old = new Map<string, NamedStarScreen>();
    for (const s of this.namedStars) if (s.id) old.set(s.id, s);
    this.namedStars.length = 0;
    this.labelRefs.length = 0;
    for (const f of found.slice(0, LABEL_MAX)) {
      const d = Math.max(Math.hypot(f.x, f.y, f.z), 1e-7);
      let s = old.get(f.id);
      if (s) { s.dir.set(f.x, f.y, f.z).divideScalar(d); s.distKm = d * PARSEC_KM; s.mag = f.m; }
      else s = { index: -1, id: f.id, name: ProcStars.nameOf(f.id), distKm: d * PARSEC_KM, dir: new Vector3(f.x, f.y, f.z).divideScalar(d), mag: f.m };
      this.namedStars.push(s);
      this.labelRefs.push({ v: f.v, i: f.i });
    }
  }

  /** Apparent magnitude of a generated star from the last camera position */
  apparentMag(id: string): number | null {
    for (const v of this.views) {
      const i = v.tier.indexOfId(id);
      if (i < 0) continue;
      const p = v.tier.positions;
      const d = Math.max(Math.hypot(p[i * 3] - v.camRel.x, p[i * 3 + 1] - v.camRel.y, p[i * 3 + 2] - v.camRel.z), 1e-7);
      return v.tier.absMags[i] + 5 * Math.log10(d) - 5;
    }
    return null;
  }

  pick(x: number, y: number, camera: PerspectiveCamera, W: number, H: number, hideId: string | null, slackPx = 7): string | null {
    return this.pickHit(x, y, camera, W, H, hideId, slackPx)?.value ?? null;
  }

  pickHit(x: number, y: number, camera: PerspectiveCamera, W: number, H: number, hideId: string | null, slackPx = 7): PickHit<string> | null {
    let best: PickHit<string> | null = null;
    for (const v of this.views) {
      if (!v.points.visible) continue;
      const t = v.tier;
      const p = t.positions;
      const magLimit = v.mat.uniforms.uMagLimit.value as number;
      const fade = v.mat.uniforms.uFade.value as number;
      for (let i = 0; i < t.count; i++) {
        _rel.set(p[i * 3] - v.camRel.x, p[i * 3 + 1] - v.camRel.y, p[i * 3 + 2] - v.camRel.z);
        const d = _rel.length();
        const m = t.absMags[i] + 5 * Math.log10(Math.max(d, 1e-7)) - 5;
        if (m > magLimit) continue;
        const look = starLook(m);
        const vis = look.alpha * fade;
        if (vis < PICK_MIN_VIS) continue;
        const reach = look.size / 2 + slackPx;
        _proj.copy(_rel).multiplyScalar(1e11 / d).project(camera);
        if (_proj.z > 1 || _proj.z < -1) continue;
        const dist = Math.hypot((_proj.x * 0.5 + 0.5) * W - x, (-_proj.y * 0.5 + 0.5) * H - y);
        if (dist > reach) continue;
        const hit = { value: '', dist, reach, vis };
        if (better(best, hit) !== hit) continue;
        const id = t.idAt(i);
        if (id === hideId) continue;
        hit.value = id;
        best = hit;
      }
    }
    return best;
  }
}
