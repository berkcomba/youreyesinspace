import { BufferAttribute, BufferGeometry, Mesh, Quaternion, Scene, ShaderMaterial, SRGBColorSpace, TextureLoader, Vector3, type Texture } from 'three';
import type { CelestialBody } from '../core/CelestialBody';
import { groundSite } from './GroundGen';
import { loadHeights, type HeightField } from './Terrain';

/** A mountain raised on a globe for a tour's postcard view, from a relief built offline */
export interface ReliefSpec {
  body: CelestialBody;
  /** directory under /tour-media/terrain/ (h.png, c.jpg, meta.json; see scripts/olympus-relief.py) */
  source: string;
  /** vertical exaggeration */
  scale: number;
}

interface ReliefMeta { lat: number; lon: number; size: number; hmin: number; hmax: number; credit: string }
interface ReliefData { meta: ReliefMeta; heights: HeightField; color: Texture }

/** Grid vertices per side over the square footprint */
const N = 385;
/** The footprint's outer ~12 % eases down to the globe's surface */
const EDGE = 0.12;
/** Radius (km) over which the curvature is taken out, centred on the summit */
const FLAT_KM = 330;

const loader = new TextureLoader();
const cache = new Map<string, Promise<ReliefData>>();

function load(source: string): Promise<ReliefData> {
  let p = cache.get(source);
  if (!p) {
    const dir = `/tour-media/terrain/${source}/`;
    const v = `?v=${__BUILD_ID__}`;
    p = (async () => {
      const meta = (await (await fetch(`${dir}meta.json${v}`)).json()) as ReliefMeta;
      const [heights, color] = await Promise.all([
        loadHeights(`${dir}h.png${v}`, meta.hmin, meta.hmax, meta.size / 2),
        new Promise<Texture>((resolve, reject) => loader.load(`${dir}c.jpg${v}`, (t) => { t.colorSpace = SRGBColorSpace; t.anisotropy = 8; resolve(t); }, undefined, reject)),
      ]);
      return { meta, heights, color };
    })();
    p.catch(() => cache.delete(source));
    cache.set(source, p);
  }
  return p;
}

/** Bilinear height (km) at (u east, v south) in 0..1 over the footprint */
function sample(f: HeightField, u: number, v: number): number {
  const x = Math.min(Math.max(u, 0), 1) * (f.n - 1), y = Math.min(Math.max(v, 0), 1) * (f.n - 1);
  const x0 = Math.min(Math.floor(x), f.n - 2), y0 = Math.min(Math.floor(y), f.n - 2);
  const fx = x - x0, fy = y - y0, d = f.data, n = f.n;
  const a = d[y0 * n + x0], b = d[y0 * n + x0 + 1], c = d[(y0 + 1) * n + x0], e = d[(y0 + 1) * n + x0 + 1];
  return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + e * fx) * fy;
}

/**
 * Lift (km) that takes the globe's curvature out under the volcano: on a world as small as Mars
 * a summit 500 km away sinks ~35 km below the horizon, and from any distance that fits it in the
 * frame the mountain would read as a low plateau. Flat-topped bump, zero slope at both ends.
 */
function flatten(rKm: number, R: number): number {
  const x = Math.min(1, rKm / FLAT_KM);
  return ((FLAT_KM * FLAT_KM) / (2 * R)) * (1 - x * x) * (1 - x * x);
}

/** The summit's tangent frame (object coordinates) */
function siteFrame(body: CelestialBody, m: ReliefMeta) {
  const site = groundSite(body, m.lat, m.lon);
  const center = site.pos.clone();
  const up = site.up.clone();
  const east = new Vector3(0, 1, 0).cross(up);
  if (east.lengthSq() < 1e-8) east.set(1, 0, 0);
  east.normalize();
  const north = new Vector3().crossVectors(up, east).normalize();
  return { center, up, east, north, R0: center.length() };
}

/**
 * Relief height (km above the globe) at (u east, v south) over the footprint, `r` km from the
 * summit. Measured from the footprint's lowest point: ground dipping below the globe's smooth
 * surface would let the globe show through there, pale in its grazing-angle haze.
 */
function heightAt(d: ReliefData, scale: number, u: number, v: number, r: number, R0: number): number {
  const fade = smooth((1 - r / (d.meta.size / 2)) / EDGE);
  return fade > 0 ? ((sample(d.heights, u, v) - d.meta.hmin) * scale + flatten(r, R0)) * fade - (1 - fade) * 0.5 : -0.5;
}

function groundAt(s: ReliefSpec, d: ReliefData, dir: Vector3): number {
  const f = siteFrame(s.body, d.meta);
  const n = new Vector3().copy(dir).normalize();
  const r = Math.acos(Math.min(1, Math.max(-1, n.dot(f.up)))) * f.R0;
  if (r >= d.meta.size / 2) return 0;
  const t = n.addScaledVector(f.up, -n.dot(f.up));
  if (t.lengthSq() > 1e-12) t.normalize().multiplyScalar(r);
  const u = t.dot(f.east) / d.meta.size + 0.5, v = 0.5 - t.dot(f.north) / d.meta.size;
  return Math.max(0, heightAt(d, s.scale, u, v, r, f.R0));
}

function smooth(x: number): number {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
}

const VERT = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
attribute float aS;
uniform float uLift;
varying vec3 vWorldPos;
varying vec3 vWorldNormal;
varying vec2 vUv;
varying vec3 vUp;
void main() {
  // uLift raises the relief out of the globe (0 = flush with the surface)
  vec3 p = position;
  vec3 up = normalize(p);
  float h = dot(p, up);
  p = up * aS + up * (h - aS) * uLift;
  vec4 wp = modelMatrix * vec4(p, 1.0);
  vWorldPos = wp.xyz;
  vWorldNormal = normalize(mat3(modelMatrix) * normalize(mix(up, normal, uLift)));
  vUv = uv;
  vUp = normalize(mat3(modelMatrix) * up);
  gl_Position = projectionMatrix * viewMatrix * wp;
  #include <logdepthbuf_vertex>
}`;

const FRAG = /* glsl */ `
#include <logdepthbuf_pars_fragment>
uniform sampler2D uColor;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform float uFill;
uniform vec3 uHaze;
varying vec3 vWorldPos;
varying vec3 vWorldNormal;
varying vec2 vUv;
varying vec3 vUp;
void main() {
  #include <logdepthbuf_fragment>
  vec3 N = normalize(vWorldNormal);
  // the Viking mosaic, toned like the globe's imagery tiles (tile.frag)
  vec3 alb = texture2D(uColor, vUv).rgb;
  float lum = dot(alb, vec3(0.299, 0.587, 0.114));
  alb = pow(max(mix(vec3(lum), alb, 1.2), 0.0), vec3(1.08));
  // Viking caught the eastern scarp in glancing light, near-white: under our own lighting, three
  // times taller and seen from that side it would read as snow — back to a bright dust tone
  float over = smoothstep(0.3, 0.65, lum);
  alb = mix(alb, vec3(0.5, 0.27, 0.17), over);
  // slopes shade within a band round the level ground's light (as lit on the globe): the
  // exaggerated flanks keep their form without sunward faces burning out or shadows going black
  float level = max(dot(normalize(vUp), uSunDir), 0.0);
  float diff = clamp(dot(N, uSunDir), level * 0.4, level * 1.3 + 0.03);
  // the work light only matters where the Sun is low or down
  float lamp = uFill * (0.35 + 0.65 * max(dot(N, normalize(-vWorldPos)), 0.0)) * (1.0 - smoothstep(0.1, 0.4, level));
  float lit = max(diff, lamp) + 0.015;
  vec3 col = alb * lit * uSunColor;
  // dusty air: distant slopes fade toward the sky colour
  float d = length(vWorldPos);
  col = mix(col, uHaze, 1.0 - exp(-d / 1400.0));
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

/**
 * Real relief round a summit (heights × `scale`), drawn over a globe whose own mesh is a smooth
 * ellipsoid: a square grid draped with the orbital imagery, rising out of the surface over a
 * second or two once its maps have loaded. Positioned in the camera-relative frame like the
 * bodies (camera at the origin, km).
 */
export class Relief {
  private mesh: Mesh | null = null;
  private mat: ShaderMaterial | null = null;
  private spec: ReliefSpec | null = null;
  private lift = 0;
  private want = false;
  private readonly tmp = new Vector3();

  constructor(private readonly scene: Scene) {}

  get body(): CelestialBody | null {
    return this.spec?.body ?? null;
  }

  /** Summit (object coordinates, km, exaggerated) of a relief whose site is `lat`, `lon` */
  static summit(body: CelestialBody, lat: number, lon: number, peakKm: number, scale: number, out: Vector3): Vector3 {
    const site = groundSite(body, lat, lon);
    return out.copy(site.pos).addScaledVector(site.up, peakKm * scale + flatten(0, site.pos.length()));
  }

  /**
   * Raise the relief. Resolves with a function giving the relief's ground (km above the globe's
   * surface, exaggerated) under an object-frame direction from the body's centre — 0 outside it.
   */
  show(spec: ReliefSpec): Promise<(dir: Vector3) => number> {
    const same = this.spec && this.spec.body === spec.body && this.spec.source === spec.source && this.spec.scale === spec.scale;
    if (!same) {
      this.dispose();
      this.spec = spec;
      this.lift = 0;
    }
    this.want = true;
    const p = load(spec.source);
    p.then((d) => {
      if (this.spec === spec && !this.mesh) this.build(spec, d);
    }).catch((err) => console.warn(`Kabartma yüklenemedi: ${spec.source}`, err));
    return p.then((d) => (dir: Vector3) => groundAt(spec, d, dir));
  }

  hide(): void {
    this.want = false;
  }

  /** Per frame: ease the relief up/down and follow the body. */
  update(dt: number, camPos: Vector3, sunPos: Vector3, sunColor: Vector3, fill: number, haze: Vector3): void {
    const s = this.spec;
    if (!s) return;
    if (!this.mesh || !this.mat) {
      if (!this.want) this.dispose();
      return;
    }
    this.lift = this.want ? Math.min(1, this.lift + dt / 2) : this.lift - dt / 1.5;
    if (this.lift <= 0) { this.dispose(); return; }
    const b = s.body;
    this.mesh.position.copy(b.position).sub(camPos);
    this.mesh.quaternion.copy(b.rotation);
    const u = this.mat.uniforms;
    u.uLift.value = smooth(this.lift);
    u.uSunDir.value.copy(sunPos).sub(b.position).normalize();
    u.uSunColor.value.copy(sunColor);
    u.uFill.value = fill;
    u.uHaze.value.copy(haze);
  }

  dispose(): void {
    if (this.mesh) {
      this.scene.remove(this.mesh);
      this.mesh.geometry.dispose();
      this.mat?.dispose();
    }
    this.mesh = null;
    this.mat = null;
    this.spec = null;
    this.lift = 0;
  }

  private build(s: ReliefSpec, d: ReliefData): void {
    const m = d.meta;
    const { center, up, east, north, R0 } = siteFrame(s.body, m);
    const pos = new Float32Array(N * N * 3);
    const sAttr = new Float32Array(N * N);
    const uvs = new Float32Array(N * N * 2);
    const dir = new Vector3(), rotAxis = new Vector3();
    const q = new Quaternion();
    for (let i = 0; i < N; i++) {
      const v = i / (N - 1);
      const yKm = (0.5 - v) * m.size;
      for (let j = 0; j < N; j++) {
        const u = j / (N - 1);
        const xKm = (u - 0.5) * m.size;
        const r = Math.hypot(xKm, yKm);
        // great-circle step from the summit toward (east, north)
        const axis = this.tmp.copy(north).multiplyScalar(yKm).addScaledVector(east, xKm);
        rotAxis.crossVectors(up, axis);
        dir.copy(center);
        if (r > 1e-6) dir.applyQuaternion(q.setFromAxisAngle(rotAxis.normalize(), r / R0));
        const surfR = dir.length();
        dir.normalize();
        // the footprint's rim (and the square's corners beyond it) settle just under the globe
        const h = heightAt(d, s.scale, u, v, r, R0);
        const k = i * N + j;
        pos[k * 3] = dir.x * (surfR + h);
        pos[k * 3 + 1] = dir.y * (surfR + h);
        pos[k * 3 + 2] = dir.z * (surfR + h);
        sAttr[k] = surfR;
        // image row 0 is north: no flip (flipY stays on, so v runs south → 1 − v)
        uvs[k * 2] = u;
        uvs[k * 2 + 1] = 1 - v;
      }
    }
    const idx = new Uint32Array((N - 1) * (N - 1) * 6);
    let w = 0;
    for (let i = 0; i < N - 1; i++) {
      for (let j = 0; j < N - 1; j++) {
        const a = i * N + j, b2 = a + 1, c = a + N, e = c + 1;
        idx[w++] = a; idx[w++] = c; idx[w++] = b2;
        idx[w++] = b2; idx[w++] = c; idx[w++] = e;
      }
    }
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(pos, 3));
    geo.setAttribute('aS', new BufferAttribute(sAttr, 1));
    geo.setAttribute('uv', new BufferAttribute(uvs, 2));
    geo.setIndex(new BufferAttribute(idx, 1));
    geo.computeVertexNormals();
    // whatever the winding, the normals point away from the planet
    const nrm = geo.getAttribute('normal') as BufferAttribute;
    for (let k = 0; k < N * N; k++) {
      const px = pos[k * 3], py = pos[k * 3 + 1], pz = pos[k * 3 + 2];
      if (nrm.getX(k) * px + nrm.getY(k) * py + nrm.getZ(k) * pz < 0) nrm.setXYZ(k, -nrm.getX(k), -nrm.getY(k), -nrm.getZ(k));
    }
    this.mat = new ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: {
        uColor: { value: d.color },
        uLift: { value: 0 },
        uSunDir: { value: new Vector3(1, 0, 0) },
        uSunColor: { value: new Vector3(1, 1, 1) },
        uFill: { value: 0 },
        uHaze: { value: new Vector3() },
      },
    });
    this.mesh = new Mesh(geo, this.mat);
    this.mesh.frustumCulled = false;
    this.scene.add(this.mesh);
  }
}
