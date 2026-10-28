import {
  AdditiveBlending, BufferAttribute, BufferGeometry, Points, Scene, ShaderMaterial, Vector3, Vector4,
  type PerspectiveCamera,
} from 'three';
import { SKY_RADIUS_KM } from '../core/constants';
import type { Landmark } from '../core/Universe';
import { memberId, type ClusterMember, type ClusterStars } from '../galaxy/ClusterStars';
import { PROCEDURAL_TINT } from './ProcStarPoints';
import { Shaders } from './shaders';
import { better, PICK_MIN_VIS, starLook, type PickHit } from './pickHit';

/** a cluster's members fade in between these on-screen radii (px); below, the glow stands alone */
const RESOLVE_PX = 10;
const FULL_PX = 30;
const MAX_ACTIVE = 4;

const _rel = new Vector3();
const _proj = new Vector3();

interface View {
  id: string;
  landmark: Landmark;
  members: ClusterMember[];
  /** LOD cross-fade 0…1 (members vs. the unresolved glow) */
  fade: number;
  points: Points;
  mat: ShaderMaterial;
  camRel: Vector3;
}

/**
 * Member stars of the resolved clusters, drawn with the catalogue star shader (magnitude-sized
 * points, one per member) so that inside a cluster the sky is full of real, clickable stars.
 */
export class ClusterStarPoints {
  private readonly views = new Map<string, View>();
  private highlight = false;
  private daylight = 0;

  constructor(private readonly landmarks: Landmark[], private readonly stars: ClusterStars, private readonly scene: Scene) {}

  setHighlight(on: boolean): void { this.highlight = on; for (const v of this.views.values()) v.mat.uniforms.uTint.value.w = on ? 0.85 : 0; }
  setDaylight(d: number): void { this.daylight = d; for (const v of this.views.values()) { v.mat.uniforms.uMagLimit.value = 8.5 - 13 * d; v.mat.uniforms.uDaylight.value = d * 0.6; } }
  setVisible(on: boolean): void { for (const v of this.views.values()) v.points.visible = on; }

  /** @param hideId id of the current system's star (drawn as a body) */
  update(camPc: Vector3, pxPerRad: number, pixelRatio: number, hideId: string | null, visible: boolean): void {
    const cands: Array<{ l: Landmark; px: number }> = [];
    for (const l of this.landmarks) {
      if (!l.def.procedural || (l.def.kind !== 'cluster' && l.def.kind !== 'globular')) continue;
      const d = Math.max(l.positionPc.distanceTo(camPc), 1e-6);
      const px = Math.atan(l.def.radiusPc / d) * pxPerRad;
      if (px < RESOLVE_PX) continue;
      cands.push({ l, px });
    }
    cands.sort((a, b) => b.px - a.px);
    const wanted = new Set<string>();
    let built = false;   // one build per frame
    for (const c of cands.slice(0, MAX_ACTIVE)) {
      wanted.add(c.l.def.id);
      let v = this.views.get(c.l.def.id);
      if (!v) {
        if (built) continue;
        v = this.build(c.l); this.views.set(c.l.def.id, v); built = true;
      }
      v.camRel.copy(camPc).sub(c.l.positionPc);
      const u = v.mat.uniforms;
      (u.uCamPc.value as Vector3).copy(v.camRel);
      u.uPixelRatio.value = pixelRatio;
      let hide = -1;
      if (hideId && hideId.startsWith(`k${c.l.def.id}#`)) hide = +hideId.slice(hideId.indexOf('#') + 1);
      u.uHideIndex.value = hide;
      const t = Math.min(1, (c.px - RESOLVE_PX) / (FULL_PX - RESOLVE_PX));
      v.fade = t * t * (3 - 2 * t);
      u.uFade.value = v.fade;
      v.points.visible = visible;
    }
    for (const [id, v] of this.views) {
      if (wanted.has(id)) continue;
      this.scene.remove(v.points);
      v.points.geometry.dispose();
      v.mat.dispose();
      this.views.delete(id);
    }
  }

  private build(l: Landmark): View {
    const members = this.stars.members(l);
    const n = members.length;
    const pos = new Float32Array(n * 3), mag = new Float32Array(n), col = new Float32Array(n * 3), idx = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const s = members[i];
      pos[i * 3] = s.x; pos[i * 3 + 1] = s.y; pos[i * 3 + 2] = s.z;
      mag[i] = s.absMag;
      col[i * 3] = s.color[0]; col[i * 3 + 1] = s.color[1]; col[i * 3 + 2] = s.color[2];
      idx[i] = i;
    }
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(pos, 3));
    geo.setAttribute('absMag', new BufferAttribute(mag, 1));
    geo.setAttribute('color', new BufferAttribute(col, 3));
    geo.setAttribute('starIndex', new BufferAttribute(idx, 1));
    const mat = new ShaderMaterial({
      vertexShader: Shaders.starsVert,
      fragmentShader: Shaders.pointsFrag,
      uniforms: {
        uCamPc: { value: new Vector3() },
        uPixelRatio: { value: 1 },
        uSkyRadius: { value: SKY_RADIUS_KM },
        uHideIndex: { value: -1 },
        uMagLimit: { value: 8.5 - 13 * this.daylight },
        uFade: { value: 0 },
        uDaylight: { value: this.daylight * 0.6 },
        uSoftness: { value: 0.0 },
        uTint: { value: new Vector4(...PROCEDURAL_TINT, this.highlight ? 0.85 : 0) },
      },
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
    });
    const points = new Points(geo, mat);
    points.frustumCulled = false;
    points.renderOrder = -10;
    this.scene.add(points);
    return { id: l.def.id, landmark: l, members, fade: 0, points, mat, camRel: new Vector3() };
  }

  /** Apparent magnitude of a member from the last camera position (null when its cluster is not resolved) */
  apparentMag(id: string): number | null {
    for (const v of this.views.values()) {
      if (!id.startsWith(`k${v.id}#`)) continue;
      const s = v.members[+id.slice(id.indexOf('#') + 1)];
      if (!s) return null;
      const d = Math.max(Math.hypot(s.x - v.camRel.x, s.y - v.camRel.y, s.z - v.camRel.z), 1e-7);
      return s.absMag + 5 * Math.log10(d) - 5;
    }
    return null;
  }

  /** Members are pickable exactly when they are drawn: same magnitude limit as the shader, once faded in */
  pick(x: number, y: number, camera: PerspectiveCamera, W: number, H: number, hideId: string | null, slackPx = 7): string | null {
    return this.pickHit(x, y, camera, W, H, hideId, slackPx)?.value ?? null;
  }

  pickHit(x: number, y: number, camera: PerspectiveCamera, W: number, H: number, hideId: string | null, slackPx = 7): PickHit<string> | null {
    let best: PickHit<string> | null = null;
    for (const v of this.views.values()) {
      if (!v.points.visible || v.fade < 0.15) continue;
      const magLimit = v.mat.uniforms.uMagLimit.value as number;
      for (let i = 0; i < v.members.length; i++) {
        const s = v.members[i];
        _rel.set(s.x - v.camRel.x, s.y - v.camRel.y, s.z - v.camRel.z);
        const d = _rel.length();
        const m = s.absMag + 5 * Math.log10(Math.max(d, 1e-7)) - 5;
        if (m > magLimit) continue;
        const look = starLook(m);
        const vis = look.alpha * v.fade;
        if (vis < PICK_MIN_VIS) continue;
        const reach = look.size / 2 + slackPx;
        _proj.copy(_rel).multiplyScalar(1e11 / d).project(camera);
        if (_proj.z > 1 || _proj.z < -1) continue;
        const dist = Math.hypot((_proj.x * 0.5 + 0.5) * W - x, (-_proj.y * 0.5 + 0.5) * H - y);
        if (dist > reach) continue;
        const id = memberId(v.id, i);
        if (id === hideId) continue;
        best = better(best, { value: id, dist, reach, vis });
      }
    }
    return best;
  }
}
