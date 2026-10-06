import { Color, InstancedInterleavedBuffer, InterleavedBufferAttribute, Scene, Vector3 } from 'three';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { evaluatePhase, type FrameLookup, type Phase } from '../astro/mission';
import type { ActiveMission } from '../core/Missions';
import { CAMERA_FAR_KM, DAY_S } from '../core/constants';

const N = 320;
const FAR = CAMERA_FAR_KM * 0.5;
const _p = new Vector3(), _v = new Vector3();

/** Sample times (jd) along the flown part of a mission: launch → arrival (+ one revolution of the final orbit) */
function sampleTimes(phases: Phase[], out: number[]): void {
  out.length = 0;
  const segs: Array<[number, number]> = [];
  for (const ph of phases) {
    if (ph.kind === 'docked' && ph.t0 === -Infinity) continue;
    let t1 = ph.t1;
    if (!Number.isFinite(t1)) {
      if (ph.kind === 'orbit') t1 = ph.t0 + (2 * Math.PI) / ph.omega / DAY_S;
      else if (ph.kind === 'conic') {
        // one revolution if bound, otherwise a stretch beyond the target
        const r = ph.r0.length(), v2 = ph.v0.lengthSq();
        const a = 1 / (2 / r - v2 / ph.mu);
        t1 = a > 0 ? ph.t0 + (2 * Math.PI * Math.sqrt((a * a * a) / ph.mu)) / DAY_S : ph.t0 + (ph.t0 - (segs[segs.length - 1]?.[0] ?? ph.t0 - 100)) * 0.5;
      } else continue;
    }
    if (t1 > ph.t0) segs.push([ph.t0, t1]);
  }
  const total = segs.reduce((s, [a, b]) => s + (b - a), 0);
  if (total <= 0) return;
  for (const [a, b] of segs) {
    const n = Math.max(8, Math.round((N * (b - a)) / total));
    for (let i = 0; i < n; i++) out.push(a + ((b - a) * i) / (n - 1));
  }
}

/**
 * One mission route as a screen-space polyline (2 px), re-evaluated every frame in the current
 * reference frame; the part already flown is dimmed.
 */
class TrajectoryLine {
  readonly line: LineSegments2;
  private readonly geometry = new LineSegmentsGeometry();
  private readonly material: LineMaterial;
  private readonly segs: Float32Array;
  private readonly cols: Float32Array;
  private readonly segBuf: InstancedInterleavedBuffer;
  private readonly colBuf: InstancedInterleavedBuffer;
  private readonly times: number[] = [];
  private readonly pts: Float32Array;
  private readonly past: Uint8Array;
  private readonly dim: Color;

  constructor(readonly mission: ActiveMission, readonly color: Color) {
    const cap = N * 2;
    this.pts = new Float32Array(cap * 3);
    this.past = new Uint8Array(cap);
    this.segs = new Float32Array(cap * 6);
    this.cols = new Float32Array(cap * 6);
    this.segBuf = new InstancedInterleavedBuffer(this.segs, 6, 1);
    this.colBuf = new InstancedInterleavedBuffer(this.cols, 6, 1);
    this.geometry.setAttribute('instanceStart', new InterleavedBufferAttribute(this.segBuf, 3, 0));
    this.geometry.setAttribute('instanceEnd', new InterleavedBufferAttribute(this.segBuf, 3, 3));
    this.geometry.setAttribute('instanceColorStart', new InterleavedBufferAttribute(this.colBuf, 3, 0));
    this.geometry.setAttribute('instanceColorEnd', new InterleavedBufferAttribute(this.colBuf, 3, 3));
    this.geometry.instanceCount = 0;
    this.dim = color.clone().multiplyScalar(0.3);
    this.material = new LineMaterial({
      color: 0xffffff, vertexColors: true, linewidth: 2, transparent: true, opacity: 0.95, depthWrite: false, depthTest: true,
    });
    this.line = new LineSegments2(this.geometry, this.material);
    this.line.frustumCulled = false;
    this.line.renderOrder = -4;
    sampleTimes(mission.plan.phases, this.times);
  }

  update(camPos: Vector3, jdNow: number, frame: FrameLookup, resW: number, resH: number): void {
    const phases = this.mission.plan.phases;
    let n = 0;
    for (let i = 0; i < this.times.length; i++) {
      const t = this.times[i];
      let ph = phases[0];
      for (const q of phases) if (t >= q.t0) ph = q; else break;
      if (!evaluatePhase(ph, t, frame, _p, _v)) continue;
      _p.sub(camPos);
      // interstellar legs: keep vertices inside the far plane (direction is all that matters)
      const d = _p.length();
      if (d > FAR) _p.multiplyScalar(FAR / d);
      this.pts[n * 3] = _p.x; this.pts[n * 3 + 1] = _p.y; this.pts[n * 3 + 2] = _p.z;
      this.past[n] = t < jdNow ? 1 : 0;
      n++;
    }
    const segs = this.segs, cols = this.cols, pts = this.pts;
    const nSeg = Math.max(0, n - 1);
    for (let i = 0; i < nSeg; i++) {
      const o = i * 6, a = i * 3;
      segs[o] = pts[a]; segs[o + 1] = pts[a + 1]; segs[o + 2] = pts[a + 2];
      segs[o + 3] = pts[a + 3]; segs[o + 4] = pts[a + 4]; segs[o + 5] = pts[a + 5];
      const c0 = this.past[i] ? this.dim : this.color;
      const c1 = this.past[i + 1] ? this.dim : this.color;
      cols[o] = c0.r; cols[o + 1] = c0.g; cols[o + 2] = c0.b;
      cols[o + 3] = c1.r; cols[o + 4] = c1.g; cols[o + 5] = c1.b;
    }
    this.geometry.instanceCount = nSeg;
    this.segBuf.needsUpdate = true;
    this.colBuf.needsUpdate = true;
    this.material.resolution.set(resW, resH);
    this.line.visible = nSeg > 0;
  }

  dispose(scene: Scene): void {
    scene.remove(this.line);
    this.geometry.dispose();
    this.material.dispose();
  }
}

const COLORS = [new Color(1.0, 0.72, 0.25), new Color(0.35, 0.95, 0.8), new Color(1.0, 0.45, 0.7), new Color(0.55, 0.7, 1.0)];

export class TrajectoryLines {
  private readonly lines = new Map<ActiveMission, TrajectoryLine>();
  private seq = 0;

  constructor(private readonly scene: Scene) {}

  add(m: ActiveMission): void {
    if (this.lines.has(m)) return;
    const l = new TrajectoryLine(m, COLORS[this.seq++ % COLORS.length]);
    this.scene.add(l.line);
    this.lines.set(m, l);
  }

  remove(m: ActiveMission): void {
    const l = this.lines.get(m);
    if (!l) return;
    l.dispose(this.scene);
    this.lines.delete(m);
  }

  /** @param resW/resH render-target size in device pixels (fat lines are measured in screen space) */
  update(camPos: Vector3, jdNow: number, frame: FrameLookup, visible: boolean, resW: number, resH: number): void {
    for (const l of this.lines.values()) {
      if (!visible) { l.line.visible = false; continue; }
      l.update(camPos, jdNow, frame, resW, resH);
    }
  }
}
