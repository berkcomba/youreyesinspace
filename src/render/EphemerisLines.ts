import { BufferAttribute, BufferGeometry, Color, Line, LineBasicMaterial, Matrix3, Scene, Vector3 } from 'three';
import type { CelestialBody } from '../core/CelestialBody';
import { ephemeris, type EphemTable } from '../core/Ephemeris';
import { mathToScene } from '../math/kepler';

const _id3 = new Matrix3();
const _p = new Vector3(), _m = new Vector3();
const MAX_PTS = 1500;
const COLOR = new Color(0.47, 1.0, 0.92);

/**
 * Flown/planned path of a sampled-ephemeris spacecraft (BepiColombo, Europa Clipper, Hera).
 * Each table segment becomes one polyline in its centre body's frame; vertices are static, only the
 * segment's origin (centre − camera) moves. Long segments are decimated to MAX_PTS vertices.
 * The part already flown is drawn fully, the future dimmed, split at the current time.
 */
class Trail {
  readonly lines: Line[] = [];
  private readonly centers: string[] = [];
  private readonly colorAttrs: BufferAttribute[] = [];
  private readonly times: Float64Array[] = [];
  private lastJd = NaN;

  constructor(readonly table: EphemTable) {
    for (const s of table.segments) {
      const stride = Math.max(1, Math.ceil(s.n / MAX_PTS));
      const n = Math.floor((s.n - 1) / stride) + 1;
      const pos = new Float32Array(n * 3);
      const col = new Float32Array(n * 3);
      const t = new Float64Array(n);
      for (let k = 0; k < n; k++) {
        const i = k * stride;
        _m.set(s.p[i * 3], s.p[i * 3 + 1], s.p[i * 3 + 2]);
        mathToScene(_m, _id3, _p);
        pos[k * 3] = _p.x; pos[k * 3 + 1] = _p.y; pos[k * 3 + 2] = _p.z;
        t[k] = s.jd0 + s.step * i;
      }
      const g = new BufferGeometry();
      g.setAttribute('position', new BufferAttribute(pos, 3));
      const ca = new BufferAttribute(col, 3);
      g.setAttribute('color', ca);
      const mat = new LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.8, depthWrite: false });
      const line = new Line(g, mat);
      line.frustumCulled = false;
      line.renderOrder = -4;
      this.lines.push(line);
      this.centers.push(s.center);
      this.colorAttrs.push(ca);
      this.times.push(t);
    }
  }

  update(camPos: Vector3, jd: number, lookup: (id: string) => CelestialBody | undefined, visible: boolean): void {
    // recolour past/future at most once a simulated minute (NaN on the first call → always stale)
    const stale = !(Math.abs(jd - this.lastJd) <= 1 / 1440);
    for (let i = 0; i < this.lines.length; i++) {
      const line = this.lines[i];
      const c = lookup(this.centers[i]);
      if (!c || !visible) { line.visible = false; continue; }
      line.visible = true;
      line.position.copy(c.position).sub(camPos);
      if (stale) {
        const t = this.times[i], arr = this.colorAttrs[i].array as Float32Array;
        for (let k = 0; k < t.length; k++) {
          const f = t[k] <= jd ? 1 : 0.32;
          arr[k * 3] = COLOR.r * f; arr[k * 3 + 1] = COLOR.g * f; arr[k * 3 + 2] = COLOR.b * f;
        }
        this.colorAttrs[i].needsUpdate = true;
      }
    }
    if (stale) this.lastJd = jd;
  }

  dispose(scene: Scene): void {
    for (const l of this.lines) {
      scene.remove(l);
      l.geometry.dispose();
      (l.material as LineBasicMaterial).dispose();
    }
  }
}

export class EphemerisLines {
  private readonly trails = new Map<string, Trail>();
  private readonly wanted = new Set<string>();

  constructor(private readonly scene: Scene) {
    ephemeris.onLoad((id) => { if (this.wanted.has(id)) this.build(id); });
  }

  /** Register the bodies whose tables should be drawn when available. */
  track(bodies: Iterable<CelestialBody>): void {
    this.wanted.clear();
    for (const b of bodies) {
      const o = b.data.orbit;
      if (o?.kind === 'ephemeris') {
        this.wanted.add(o.table);
        if (ephemeris.get(o.table)) this.build(o.table);
      }
    }
    for (const id of [...this.trails.keys()]) if (!this.wanted.has(id)) { this.trails.get(id)!.dispose(this.scene); this.trails.delete(id); }
  }

  private build(id: string): void {
    if (this.trails.has(id)) return;
    const t = ephemeris.get(id);
    if (!t) return;
    const tr = new Trail(t);
    for (const l of tr.lines) this.scene.add(l);
    this.trails.set(id, tr);
  }

  /** @param visible per table: the trails are a scene element, not part of the everyday sky */
  update(camPos: Vector3, jd: number, lookup: (id: string) => CelestialBody | undefined, visible: (table: string) => boolean): void {
    for (const [id, tr] of this.trails) tr.update(camPos, jd, lookup, visible(id));
  }
}
