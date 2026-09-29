import {
  AdditiveBlending, BufferAttribute, BufferGeometry, Color, Line, Scene, ShaderMaterial, Vector3,
} from 'three';
import type { CelestialBody } from '../core/CelestialBody';
import type { StarSystem } from '../core/StarSystem';
import { isKeplerian, mathToScene, positionFromE } from '../math/kepler';
import { Shaders } from './shaders';

const SEGMENTS = 384;
const _m = new Vector3();
const _s = new Vector3();

export const ORBIT_COLORS: Record<string, Color> = {
  planet: new Color(0.35, 0.75, 1.0),
  dwarf: new Color(1.0, 0.7, 0.35),
  moon: new Color(0.55, 0.95, 0.65),
  asteroid: new Color(0.7, 0.7, 0.7),
  comet: new Color(0.8, 0.55, 1.0),
  star: new Color(1, 1, 1),
  barycenter: new Color(1, 1, 1),
};

class OrbitLine {
  readonly line: Line;
  readonly positions: Float32Array;
  readonly geometry: BufferGeometry;
  readonly material: ShaderMaterial;

  constructor(readonly body: CelestialBody) {
    this.positions = new Float32Array((SEGMENTS + 1) * 3);
    const alpha = new Float32Array(SEGMENTS + 1);
    for (let k = 0; k <= SEGMENTS; k++) {
      const t = k / SEGMENTS;
      // bright just behind the body, fading toward the far side of the orbit
      alpha[k] = 0.12 + 0.88 * Math.pow(1 - t, 1.6);
    }
    this.geometry = new BufferGeometry();
    this.geometry.setAttribute('position', new BufferAttribute(this.positions, 3));
    this.geometry.setAttribute('alpha', new BufferAttribute(alpha, 1));
    this.material = new ShaderMaterial({
      vertexShader: Shaders.orbitVert,
      fragmentShader: Shaders.orbitFrag,
      uniforms: {
        uColor: { value: (ORBIT_COLORS[body.data.type] ?? ORBIT_COLORS.planet).clone() },
        uOpacity: { value: 0.6 },
      },
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
    });
    this.line = new Line(this.geometry, this.material);
    this.line.frustumCulled = false;
    this.line.renderOrder = -5;
  }

  /** Recompute vertices relative to the camera. Vertex 0 is at the body. */
  update(camPos: Vector3): void {
    const b = this.body;
    const r = b.resolved;
    if (!r || !b.parent) return;
    const px = b.parent.position.x - camPos.x;
    const py = b.parent.position.y - camPos.y;
    const pz = b.parent.position.z - camPos.z;
    const arr = this.positions;
    for (let k = 0; k <= SEGMENTS; k++) {
      const E = b.E - (k / SEGMENTS) * Math.PI * 2;
      positionFromE(r, E, _m);
      mathToScene(_m, b.orbitBasis, _s);
      arr[k * 3] = _s.x + px;
      arr[k * 3 + 1] = _s.y + py;
      arr[k * 3 + 2] = _s.z + pz;
    }
    (this.geometry.attributes.position as BufferAttribute).needsUpdate = true;
  }
}

export class OrbitLines {
  readonly lines: OrbitLine[] = [];
  readonly byId = new Map<string, OrbitLine>();

  constructor(private readonly scene: Scene) {}

  /** Rebuild the orbit lines for a (new) system. */
  setSystem(system: StarSystem): void {
    for (const l of this.lines) {
      this.scene.remove(l.line);
      l.geometry.dispose();
      l.material.dispose();
    }
    this.lines.length = 0;
    this.byId.clear();
    for (const b of system.bodies) {
      if (!b.data.orbit || !b.parent || !isKeplerian(b.data.orbit)) continue;
      const l = new OrbitLine(b);
      this.scene.add(l.line);
      this.lines.push(l);
      this.byId.set(b.id, l);
    }
  }

  /**
   * @param apparent map body id → apparent radius px
   * @param pxPerRad pixel scale
   */
  update(
    camPos: Vector3, visible: boolean, showMoons: boolean, pxPerRad: number,
    apparent: (id: string) => number, selectedId: string | null,
  ): void {
    for (const l of this.lines) {
      const b = l.body;
      if (!visible || !b.resolved || !b.parent) {
        l.line.visible = false;
        continue;
      }
      const isMoon = b.data.type === 'moon';
      if (isMoon && !showMoons && selectedId !== b.id && selectedId !== b.parent.id) {
        l.line.visible = false;
        continue;
      }
      // Orbit size in pixels from the camera
      const dParent = Math.sqrt(
        (b.parent.position.x - camPos.x) ** 2 + (b.parent.position.y - camPos.y) ** 2 + (b.parent.position.z - camPos.z) ** 2,
      );
      const orbitPx = (b.resolved.a / Math.max(dParent, 1)) * pxPerRad;
      // Too small to matter, or camera close to the body (line would slice through the view) → hide
      const bodyPx = apparent(b.id);
      const dBody = Math.sqrt(
        (b.position.x - camPos.x) ** 2 + (b.position.y - camPos.y) ** 2 + (b.position.z - camPos.z) ** 2,
      );
      const nearFade = Math.min(1, Math.max(0, (dBody / b.radius - 12) / 30));
      if (orbitPx < 4 || nearFade <= 0) {
        l.line.visible = false;
        continue;
      }
      // Moon orbits: only when the parent system is reasonably resolved
      if (isMoon && orbitPx < 12 && selectedId !== b.id) {
        l.line.visible = false;
        continue;
      }
      // Camera inside (or near) this orbit: it would sweep across the whole sky → fade it out
      const insideFade = selectedId === b.id ? 1 : Math.min(1, Math.max(0, (dParent / b.resolved.a - 0.9) / 0.6));
      if (insideFade <= 0) {
        l.line.visible = false;
        continue;
      }
      l.line.visible = true;
      // fade in gradually
      const fade = Math.min(1, (orbitPx - 4) / 30) * nearFade * insideFade * Math.min(1, Math.max(0, (600 - bodyPx) / 300));
      l.material.uniforms.uOpacity.value = (selectedId === b.id ? 0.95 : 0.55) * fade;
      l.update(camPos);
    }
  }
}
