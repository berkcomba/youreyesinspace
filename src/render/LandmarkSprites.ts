import {
  AdditiveBlending, InstancedBufferAttribute, InstancedBufferGeometry, Mesh, PlaneGeometry, Scene, ShaderMaterial, Vector3,
  type PerspectiveCamera,
} from 'three';
import { SKY_RADIUS_KM } from '../core/constants';
import type { Landmark } from '../core/Universe';
import { GalaxyCloud } from './GalaxyCloud';
import { Shaders } from './shaders';

const _rel = new Vector3();
const _proj = new Vector3();
const KIND_CODE = { nebula: 0, cluster: 1, remnant: 2, star: 3, pulsar: 4 } as const;

/** Screen-space info for a landmark label/marker */
export interface LandmarkScreen {
  index: number;
  name: string;
  /** unit direction from the camera, scene frame */
  dir: Vector3;
  /** apparent radius (px) */
  radiusPx: number;
  kind: Landmark['def']['kind'];
}

/**
 * Nebulae, clusters, supernova remnants and record stars as instanced billboards at their real
 * positions, plus the label/pick bookkeeping for them.
 */
export class LandmarkSprites {
  readonly mesh: Mesh;
  readonly named: LandmarkScreen[] = [];
  private readonly mat: ShaderMaterial;
  private readonly camPc = new Vector3();
  private readonly pool: LandmarkScreen[] = [];

  constructor(readonly landmarks: Landmark[], scene: Scene) {
    const n = landmarks.length;
    const pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
    const rad = new Float32Array(n), kind = new Float32Array(n), mag = new Float32Array(n), seed = new Float32Array(n), idx = new Float32Array(n);
    landmarks.forEach((l, i) => {
      pos[i * 3] = l.positionPc.x; pos[i * 3 + 1] = l.positionPc.y; pos[i * 3 + 2] = l.positionPc.z;
      col[i * 3] = l.def.color[0]; col[i * 3 + 1] = l.def.color[1]; col[i * 3 + 2] = l.def.color[2];
      rad[i] = l.def.radiusPc;
      kind[i] = KIND_CODE[l.def.kind];
      mag[i] = l.def.absMag;
      seed[i] = (i * 7.31) % 13;
      idx[i] = i;
    });
    const quad = new PlaneGeometry(2, 2);
    const geo = new InstancedBufferGeometry();
    geo.index = quad.index;
    geo.setAttribute('position', quad.getAttribute('position'));
    geo.setAttribute('uv', quad.getAttribute('uv'));
    geo.setAttribute('iPos', new InstancedBufferAttribute(pos, 3));
    geo.setAttribute('iColor', new InstancedBufferAttribute(col, 3));
    geo.setAttribute('iRadius', new InstancedBufferAttribute(rad, 1));
    geo.setAttribute('iKind', new InstancedBufferAttribute(kind, 1));
    geo.setAttribute('iAbsMag', new InstancedBufferAttribute(mag, 1));
    geo.setAttribute('iSeed', new InstancedBufferAttribute(seed, 1));
    geo.setAttribute('iIndex', new InstancedBufferAttribute(idx, 1));
    geo.instanceCount = n;
    this.mat = new ShaderMaterial({
      vertexShader: Shaders.landmarkVert,
      fragmentShader: Shaders.landmarkFrag,
      uniforms: {
        uCamPc: { value: new Vector3() },
        uSkyRadius: { value: SKY_RADIUS_KM * 0.985 },
        uPxPerRad: { value: 1000 },
        uK: { value: 1 },
        uHideIndex: { value: -1 },
        uTime: { value: 0 },
      },
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
    });
    this.mesh = new Mesh(geo, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -11;
    scene.add(this.mesh);
  }

  setVisible(v: boolean): void { this.mesh.visible = v; }

  /** Unit direction from the camera to landmark i */
  direction(i: number, out = new Vector3()): Vector3 {
    return out.copy(this.landmarks[i].positionPc).sub(this.camPc).normalize();
  }

  /** Apparent angular radius (rad) of landmark i from the last camera position */
  angularRadius(i: number): number {
    const l = this.landmarks[i];
    return Math.atan(l.def.radiusPc / Math.max(l.positionPc.distanceTo(this.camPc), 1e-6));
  }

  /**
   * @param camPc camera (scene pc)
   * @param currentSystem id of the current system (a star landmark we're in is drawn as a body)
   * @param galaxyDist function giving the camera's distance to a galaxy centre in galaxy radii
   */
  update(camPc: Vector3, pxPerRad: number, currentSystem: string, galaxyRatio: (gi: number) => number): void {
    this.camPc.copy(camPc);
    const u = this.mat.uniforms;
    u.uCamPc.value.copy(camPc);
    u.uPxPerRad.value = pxPerRad;
    u.uK.value = (0.16 * GalaxyCloud.gain * Math.PI * pxPerRad * pxPerRad) / 1.17;
    let hide = -1;
    this.named.length = 0;
    for (let i = 0; i < this.landmarks.length; i++) {
      const l = this.landmarks[i];
      if (l.systemId !== null && l.systemId === currentSystem) { hide = i; continue; }
      // labels: only when the host galaxy is resolved (inside or close), so a far galaxy's
      // landmarks don't pile onto its own label
      if (galaxyRatio(l.galaxy) > 4) continue;
      let m = this.pool[i];
      if (!m) { m = { index: i, name: l.def.name, dir: new Vector3(), radiusPx: 0, kind: l.def.kind }; this.pool[i] = m; }
      this.direction(i, m.dir);
      m.radiusPx = this.angularRadius(i) * pxPerRad;
      this.named.push(m);
    }
    u.uHideIndex.value = hide;
    u.uTime.value = (performance.now() * 1e-3) % 1000;
  }

  /** Landmark nearest to a screen point (px) among the currently labelled ones */
  pick(x: number, y: number, camera: PerspectiveCamera, W: number, H: number, maxPx = 14): number | null {
    let best = -1;
    let bestScore = Infinity;
    for (const m of this.named) {
      _rel.copy(m.dir);
      _proj.copy(_rel).multiplyScalar(1e11).project(camera);
      if (_proj.z > 1 || _proj.z < -1) continue;
      const sx = (_proj.x * 0.5 + 0.5) * W;
      const sy = (-_proj.y * 0.5 + 0.5) * H;
      const dist = Math.hypot(sx - x, sy - y);
      const reach = Math.max(maxPx, Math.min(m.radiusPx, H * 0.25));
      if (dist > reach) continue;
      const score = dist / reach;
      if (score < bestScore) { bestScore = score; best = m.index; }
    }
    return best >= 0 ? best : null;
  }
}
