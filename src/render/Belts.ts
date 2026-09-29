import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, Matrix3, Points, Scene, ShaderMaterial, Vector3 } from 'three';
import { AU_KM, DEG } from '../core/constants';
import type { GeneratedBelt } from '../gen/SystemGenerator';
import { Rng } from '../gen/SystemGenerator';
import { Shaders } from './shaders';

/** GPU-animated Keplerian particle belts (asteroid belt, Kuiper belt, trojans) for the current system. */
export class Belts {
  readonly points: Points[] = [];
  private readonly mats: ShaderMaterial[] = [];

  constructor(private readonly scene: Scene) {}

  /**
   * Replace the belts with those of a new system.
   * @param basis orbit reference plane → scene (identity for the ecliptic, star pole basis otherwise)
   */
  setSystem(specs: GeneratedBelt[], starGM: number, basis: Matrix3): void {
    for (const p of this.points) {
      this.scene.remove(p);
      p.geometry.dispose();
    }
    for (const m of this.mats) m.dispose();
    this.points.length = 0;
    this.mats.length = 0;

    for (const s of specs) {
      const rng = new Rng(s.seed);
      const e0 = new Float32Array(s.count * 4);
      const e1 = new Float32Array(s.count * 4);
      const pos = new Float32Array(s.count * 3); // dummy for bounding
      const trojanN = s.trojan ? Math.sqrt(starGM / Math.pow(s.trojan.aAU * AU_KM, 3)) : 0;

      for (let i = 0; i < s.count; i++) {
        let aAU = s.aMin + (s.aMax - s.aMin) * rng.next();
        if (s.gaps) {
          for (const [gc, hw] of s.gaps) {
            if (Math.abs(aAU - gc) < hw) aAU += (aAU < gc ? -1 : 1) * hw * 1.5;
          }
        }
        const a = aAU * AU_KM;
        const e = Math.pow(rng.next(), 1.5) * s.eMax;
        const u1 = Math.max(rng.next(), 1e-6), u2 = rng.next();
        const gauss = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
        const inc = Math.abs(gauss) * s.iSigmaDeg * DEG;
        const node = rng.next() * Math.PI * 2;
        const w = rng.next() * Math.PI * 2;
        let M0 = rng.next() * Math.PI * 2;
        let n = Math.sqrt(starGM / (a * a * a));
        if (s.trojan) {
          const spread = (rng.next() - 0.5) * 50 * DEG;
          const L = s.trojan.meanLongitudeDeg * DEG + spread;
          M0 = L - (node + w);
          n = trojanN;
        }
        e0[i * 4] = a; e0[i * 4 + 1] = e; e0[i * 4 + 2] = inc; e0[i * 4 + 3] = node;
        e1[i * 4] = w; e1[i * 4 + 1] = M0; e1[i * 4 + 2] = n; e1[i * 4 + 3] = rng.next();
      }
      const geo = new BufferGeometry();
      geo.setAttribute('position', new BufferAttribute(pos, 3));
      geo.setAttribute('elems0', new BufferAttribute(e0, 4));
      geo.setAttribute('elems1', new BufferAttribute(e1, 4));
      const mat = new ShaderMaterial({
        vertexShader: Shaders.beltVert,
        fragmentShader: Shaders.beltFrag,
        uniforms: {
          uTime: { value: 0 },
          uSunPos: { value: new Vector3() },
          uPixelRatio: { value: 1 },
          uBasis: { value: basis.clone() },
          uColor: { value: new Color(s.color[0], s.color[1], s.color[2]) },
          uOpacity: { value: s.opacity },
        },
        transparent: true,
        blending: AdditiveBlending,
        depthWrite: false,
      });
      const pts = new Points(geo, mat);
      pts.frustumCulled = false;
      pts.renderOrder = -6;
      this.scene.add(pts);
      this.points.push(pts);
      this.mats.push(mat);
    }
  }

  update(tSeconds: number, sunRel: Vector3, pixelRatio: number, visible: boolean): void {
    for (let i = 0; i < this.mats.length; i++) {
      this.points[i].visible = visible;
      const m = this.mats[i];
      m.uniforms.uTime.value = tSeconds;
      m.uniforms.uSunPos.value.copy(sunRel);
      m.uniforms.uPixelRatio.value = pixelRatio;
    }
  }
}
