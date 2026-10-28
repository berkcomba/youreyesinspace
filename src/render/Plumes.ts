import { BufferAttribute, BufferGeometry, NormalBlending, Points, ShaderMaterial, Vector4, type IUniform } from 'three';
import type { CelestialBody } from '../core/CelestialBody';
import type { Activity } from '../data/types';
import { Rng, hashSeed } from '../gen/SystemGenerator';
import { groundSite } from './GroundGen';
import { Shaders } from './shaders';

const N_VENT = 8;
const PER_VENT = 700;

/**
 * Eruptive plumes of an active world — volcanic umbrellas (Io) or cryovolcanic jets (Enceladus,
 * Triton) — as GL points on ballistic arcs from fixed vents, in the body's own frame so they
 * turn with it and stand over the right spot when the visitor lands nearby.
 */
export class Plumes {
  readonly points: Points;
  readonly mat: ShaderMaterial;

  constructor(body: CelestialBody, lit: Record<string, IUniform>) {
    const act = body.data.activity as Activity;
    const vents = ventList(body, act);
    const n = vents.length * PER_VENT;
    const aVent = new Float32Array(n);
    const aRand = new Float32Array(n * 4);
    const pos = new Float32Array(n * 3);
    const rng = new Rng(hashSeed(body.data.appearance.kind === 'terrestrial' ? body.data.appearance.seed : 1, 0xa11e));
    for (let v = 0; v < vents.length; v++) {
      for (let k = 0; k < PER_VENT; k++) {
        const i = v * PER_VENT + k;
        aVent[i] = v;
        aRand[i * 4] = rng.next(); aRand[i * 4 + 1] = rng.next(); aRand[i * 4 + 2] = rng.next(); aRand[i * 4 + 3] = rng.next();
        // a nominal position for the bounding volume (the shader places the point)
        const p = vents[v];
        pos[i * 3] = p.x; pos[i * 3 + 1] = p.y; pos[i * 3 + 2] = p.z;
      }
    }
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(pos, 3));
    geo.setAttribute('aVent', new BufferAttribute(aVent, 1));
    geo.setAttribute('aRand', new BufferAttribute(aRand, 4));
    const ventU: Vector4[] = [];
    for (let i = 0; i < N_VENT; i++) {
      const p = vents[i];
      ventU.push(p ? new Vector4(p.x, p.y, p.z, 1) : new Vector4(0, 0, 0, 0));
    }
    this.mat = new ShaderMaterial({
      vertexShader: Shaders.plumeVert,
      fragmentShader: Shaders.plumeFrag,
      uniforms: {
        ...lit,
        uVent: { value: ventU },
        uHeight: { value: act.height }, uSpread: { value: act.spread }, uFall: { value: act.fall },
        uTime: { value: 0 }, uVis: { value: 0 }, uPxPerKmAt1: { value: 1000 },
        uColor: { value: [...act.color] }, uIntensity: { value: act.intensity ?? 1 },
      },
      transparent: true, depthWrite: false, depthTest: true, blending: NormalBlending,
    });
    this.points = new Points(geo, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 3;
  }

  /** @param pxPerRad projection scale (px per radian); the plumes vanish when the body is a dot */
  update(apparentRadiusPx: number, pxPerRad: number, visible: boolean): void {
    const vis = visible ? Math.min(1, Math.max(0, (apparentRadiusPx - 4) / 20)) : 0;
    this.points.visible = vis > 0.001;
    this.mat.uniforms.uVis.value = vis;
    this.mat.uniforms.uPxPerKmAt1.value = pxPerRad;
    this.mat.uniforms.uTime.value = (performance.now() / 1000) % 36000;
  }

  dispose(): void {
    this.points.geometry.dispose();
    this.mat.dispose();
  }
}

/** vents on the body's ellipsoid (object frame, km): the listed ones, else `count` seeded */
function ventList(body: CelestialBody, act: Activity): { x: number; y: number; z: number }[] {
  const out: { x: number; y: number; z: number }[] = [];
  const latLon: Array<[number, number]> = act.vents ? act.vents.slice(0, N_VENT) : [];
  if (!act.vents) {
    const rng = new Rng(hashSeed(body.data.appearance.kind === 'terrestrial' ? body.data.appearance.seed : 1, 0x7e47));
    const n = Math.min(N_VENT, act.count ?? 4);
    for (let i = 0; i < n; i++) {
      // cryo-activity clusters at a pole (tidal heating), volcanoes favour the low latitudes
      const lat = act.kind === 'cryo' ? -90 + rng.range(4, 16) : (Math.asin(rng.range(-0.8, 0.8)) * 180) / Math.PI;
      latLon.push([lat, rng.range(0, 360)]);
    }
  }
  for (const [lat, lon] of latLon) {
    const p = groundSite(body, lat, lon).pos;
    out.push({ x: p.x, y: p.y, z: p.z });
  }
  return out;
}
