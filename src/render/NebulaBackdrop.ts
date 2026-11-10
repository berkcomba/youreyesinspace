import {
  AdditiveBlending, DoubleSide, Mesh, PlaneGeometry, SRGBColorSpace, ShaderMaterial, TextureLoader, Vector3, type Scene, type Texture,
} from 'three';
import { SKY_RADIUS_KM } from '../core/constants';
import type { Landmark } from '../core/Universe';
import { NEBULA_BACKDROPS } from '../data/landmarkImages';
import { Shaders } from './shaders';

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h >>> 0;
}

/**
 * The night sky of a world standing inside a nebula: from in there the cloud is no sprite but
 * glowing gas over half the sky. Two molecular-cloud frames in the nebula's own hue are fixed among
 * the stars — the bright one toward its heart, a fainter one behind — rising and setting with
 * them and drowned by the day like they are. Only on the ground; in space the clouds are volumes.
 */
export class NebulaBackdrop {
  private readonly meshes: Mesh[] = [];
  private readonly loader = new TextureLoader();
  private readonly textures = new Map<string, Texture | null>();
  /** frames are not in the repository: once one fails to load the backdrop stays off */
  private missing = false;
  private readonly dir = new Vector3();

  constructor(scene: Scene) {
    const quad = new PlaneGeometry(2, 2);
    for (let k = 0; k < 2; k++) {
      const mat = new ShaderMaterial({
        vertexShader: Shaders.nebulaBackdropVert, fragmentShader: Shaders.nebulaBackdropFrag,
        uniforms: {
          uDir: { value: new Vector3(0, 0, 1) }, uT: { value: new Vector3(1, 0, 0) }, uB: { value: new Vector3(0, 1, 0) },
          uHalf: { value: 1 }, uDist: { value: SKY_RADIUS_KM * 0.9 },
          uTex: { value: null }, uColor: { value: new Vector3(1, 1, 1) }, uAlpha: { value: 0 },
        },
        transparent: true, blending: AdditiveBlending, depthWrite: false, side: DoubleSide,
      });
      const mesh = new Mesh(quad, mat);
      mesh.frustumCulled = false;
      mesh.renderOrder = -11;
      mesh.visible = false;
      scene.add(mesh);
      this.meshes.push(mesh);
    }
  }

  /** whether a frame is on the sky now (for the credit line) */
  get visible(): boolean { return this.meshes[0].visible; }

  /**
   * @param l the nebula the visitor's world lies in (null: none, or not on the ground)
   * @param camPc the camera (scene pc)
   * @param daylight 0 night … 1 day
   * @returns 0 … 1, how far the backdrop stands in for the nebula's own clouds (which, seen
   * from inside, would only grain the sky): the caller fades those by it
   */
  update(l: Landmark | null, camPc: Vector3, daylight: number): number {
    const off = (): number => { for (const m of this.meshes) m.visible = false; return 0; };
    if (!l || this.missing) return off();
    const R = l.def.radiusPc;
    const d = this.dir.copy(l.positionPc).sub(camPc).length();
    // the whole sky glows deep inside; toward the edge the cloud shrinks to one side of it
    const depth = Math.max(0, Math.min(1, 1 - d / R));
    const presence = smooth01((depth + 0.1) / 0.35);
    const weight = presence * (1 - Math.min(1, daylight * 1.5));
    if (presence <= 0.002) return off();
    if (d > 1e-9) this.dir.divideScalar(d); else this.dir.set(0, 0, 1);
    const h = hashStr(l.def.id);
    const pool = l.procKind === 'reflection' || (!l.procKind && l.def.color[2] > l.def.color[0] * 1.2) ? NEBULA_BACKDROPS.reflection : NEBULA_BACKDROPS.hii;
    const files = [pool[h % pool.length], pool[(h >>> 8) % pool.length]];
    const texs = files.map((f) => this.texture(f));
    if (this.missing || !texs[0]) return off();
    for (let k = 0; k < 2; k++) {
      const mesh = this.meshes[k];
      const u = (mesh.material as ShaderMaterial).uniforms;
      if (!texs[k]) { mesh.visible = false; continue; }
      const dir = u.uDir.value as Vector3;
      dir.copy(this.dir);
      if (k === 1) dir.negate().applyAxisAngle(perp(this.dir), 0.35);
      // a basis across the line of sight, turned by the nebula's seed
      const T = u.uT.value as Vector3, B = u.uB.value as Vector3;
      T.copy(perp(dir));
      B.crossVectors(dir, T);
      const turn = (((h >>> (k * 5)) % 360) / 360) * Math.PI * 2;
      const c = Math.cos(turn), s = Math.sin(turn);
      const t0 = T.clone();
      T.multiplyScalar(c).addScaledVector(B, s);
      B.multiplyScalar(c).addScaledVector(t0, -s);
      u.uHalf.value = Math.tan(k === 0 ? 0.7 + 0.3 * depth : 0.9);
      u.uTex.value = texs[k];
      (u.uColor.value as Vector3).set(...l.def.color);
      u.uAlpha.value = (k === 0 ? 0.45 : 0.25) * weight;
      mesh.visible = weight > 0.002;
    }
    return presence;
  }

  private texture(file: string): Texture | null {
    if (this.textures.has(file)) return this.textures.get(file)!;
    this.textures.set(file, null);
    this.loader.load(`${import.meta.env.BASE_URL}nebulae/gen/${file}.jpg`, (t) => {
      t.colorSpace = SRGBColorSpace;
      this.textures.set(file, t);
    }, undefined, () => { this.missing = true; });
    return null;
  }
}

const _perp = new Vector3();
/** a unit vector across `d` */
function perp(d: Vector3): Vector3 {
  return _perp.set(0, 1, 0).cross(d).lengthSq() > 1e-6 ? _perp.normalize() : _perp.set(1, 0, 0);
}

function smooth01(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}
