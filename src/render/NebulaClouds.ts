import {
  AdditiveBlending, BufferAttribute, BufferGeometry, Matrix3, Points, Scene, ShaderMaterial, Vector3, Vector4,
} from 'three';
import { SKY_RADIUS_KM } from '../core/constants';
import type { Landmark } from '../core/Universe';
import { LANDMARK_IMAGES, type LandmarkImage } from '../data/landmarkImages';
import { Rng } from '../gen/SystemGenerator';
import { raDecToScene } from '../math/frames';
import { Shaders } from './shaders';

/** sample grid over the photograph */
const GRID = 160;
/** gas blobs per object */
const COUNT = 24000;
/** brightness exponent for the sampling density (the rest goes into the point weight) */
const DENSITY_POW = 0.65;
/** ∫ blob profile over the unit disc / π, for uSoftness = 1 (see points.frag) */
const PROFILE_K = 0.164;
/** ACES pre-scale compensation shared with the photo sprite */
const PHOTO_GAIN = 0.55;

interface Cloud {
  index: number;
  landmark: Landmark;
  points: Points;
  mat: ShaderMaterial;
  center: Vector3;
}

/**
 * Photographed deep-sky landmarks as volumetric point clouds built from the photograph itself:
 * blobs are sampled where the picture is bright, keep its colours, and get procedural depth
 * (coherent sheets inside an ellipsoid for nebulae, a filled sphere for clusters, a hollow shell
 * for supernova remnants). Seen from Earth the cloud reproduces the picture; from anywhere
 * else it is a real 3-D object. Hands over to the flat sprite when only a few pixels wide.
 */
export class NebulaClouds {
  private readonly clouds: Cloud[] = [];
  /** fires once every cloud is built (the sprites then start fading out up close) */
  onReady: (() => void) | null = null;
  private pending = 0;

  constructor(readonly landmarks: Landmark[], private readonly scene: Scene, private readonly maxPointPx: number) {
    if (typeof document === 'undefined') return;
    landmarks.forEach((l, i) => {
      const photo = LANDMARK_IMAGES[l.def.id];
      if (!photo) return;
      this.pending++;
      const im = new Image();
      im.onload = () => { this.build(i, l, photo, im); this.done(); };
      im.onerror = () => this.done();
      im.src = `${import.meta.env.BASE_URL}nebulae/${photo.file}.jpg`;
    });
  }

  private done(): void {
    if (--this.pending === 0) this.onReady?.();
  }

  private build(index: number, l: Landmark, photo: LandmarkImage, im: HTMLImageElement): void {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = GRID;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    ctx.drawImage(im, 0, 0, GRID, GRID);
    const data = ctx.getImageData(0, 0, GRID, GRID).data;

    // linear luminance per cell and the sampling CDF
    const lum = new Float32Array(GRID * GRID);   // vignetted (drives sampling and weight)
    const raw = new Float32Array(GRID * GRID);   // unvignetted (for the chroma)
    const cdf = new Float32Array(GRID * GRID);
    let sum = 0, lmax = 1e-6;
    for (let i = 0; i < GRID * GRID; i++) {
      const r = srgb(data[i * 4]), g = srgb(data[i * 4 + 1]), b = srgb(data[i * 4 + 2]);
      // same superellipse vignette as the sprite: the picture's frame must not become a wall
      const px = ((i % GRID) + 0.5) / GRID * 2 - 1, py = (Math.floor(i / GRID) + 0.5) / GRID * 2 - 1;
      const q = Math.pow(px * px * px * px + py * py * py * py, 0.25);
      const mask = 1 - smoothstep(0.68, 1.0, q);
      const L = (0.2126 * r + 0.7152 * g + 0.0722 * b) * mask;
      lum[i] = L;
      raw[i] = L / Math.max(mask, 1e-3);
      if (L > lmax) lmax = L;
      // the sky background of the photograph is not gas
      if (L > 0.004) sum += Math.pow(L, DENSITY_POW);
      cdf[i] = sum;
    }
    if (sum <= 0) return;

    const R = l.def.radiusPc;
    const half = photo.span * R;            // half-width of the photographed field (pc)
    const cell = (2 * half) / GRID;         // pc per cell
    const rng = new Rng(0x5eb0 + index * 7919);
    // several independently warped sheets: one would be a single-valued relief that collapses
    // to a line when seen edge-on
    const sheets = [new ValueNoise(rng, 4, 9), new ValueNoise(rng, 5, 11), new ValueNoise(rng, 6, 13)];
    const kind = l.def.kind;
    const depth = kind === 'cluster' ? half * 0.55 : kind === 'remnant' ? R : R * 0.6;

    const pos = new Float32Array(COUNT * 3);
    const col = new Float32Array(COUNT * 3);
    const w = new Float32Array(COUNT);
    const size = new Float32Array(COUNT);
    for (let n = 0; n < COUNT; n++) {
      // inverse-CDF sample of a cell
      const u = rng.next() * sum;
      let lo = 0, hi = GRID * GRID - 1;
      while (lo < hi) { const mid = (lo + hi) >> 1; if (cdf[mid] < u) lo = mid + 1; else hi = mid; }
      const i = lo;
      const cx = i % GRID, cy = Math.floor(i / GRID);
      const fx = (cx + rng.next()) / GRID, fy = (cy + rng.next()) / GRID;
      const x = (fx - 0.5) * 2 * half;
      const y = (0.5 - fy) * 2 * half;      // image rows count down; north is up
      const L = lum[i];
      // depth: ellipsoid envelope so the object is as round as it is wide
      const rr = Math.min(1, Math.hypot(x, y) / (half * 0.98));
      const env = Math.sqrt(1 - 0.8 * rr * rr);
      let z: number;
      if (kind === 'cluster') {
        z = depth * env * rng.range(-1, 1);
      } else if (kind === 'remnant') {
        // expanding shell: the filaments sit on a sphere of the object's radius
        const rs = Math.min(1, Math.hypot(x, y) / R);
        z = (rng.chance(0.5) ? 1 : -1) * depth * Math.sqrt(1 - rs * rs) * rng.range(0.85, 1.05);
      } else {
        // coherent sheets of gas: neighbouring pixels share a depth, with some scatter between
        const sheet = sheets[Math.min(2, Math.floor(rng.next() * 3))];
        const nz = sheet.at(fx, fy) * 1.2 + gauss(rng) * 0.3;
        z = depth * env * Math.max(-1, Math.min(1, nz));
      }
      pos[n * 3] = x; pos[n * 3 + 1] = y; pos[n * 3 + 2] = z;
      // chroma only: brightness is carried by density × weight
      const inv = 1 / Math.max(raw[i], 1e-4);
      col[n * 3] = Math.min(srgb(data[i * 4]) * inv, 4);
      col[n * 3 + 1] = Math.min(srgb(data[i * 4 + 1]) * inv, 4);
      col[n * 3 + 2] = Math.min(srgb(data[i * 4 + 2]) * inv, 4);
      w[n] = Math.pow(L, 1 - DENSITY_POW);
      // bright knots are densely sampled and get small, crisp blobs; faint haze is sparse and
      // gets big soft ones so it doesn't turn grainy
      size[n] = rng.range(0.85, 1.25) * Math.min(2.4, Math.max(0.5, Math.pow((0.25 * lmax) / Math.max(L, 1e-4), 0.2)));
    }

    const blob = (1.7 * 2 * half) / Math.sqrt(COUNT);
    // surface brightness calibration: a region of image brightness L renders at PHOTO_GAIN·L
    const alpha = (PHOTO_GAIN * sum * cell * cell) / (COUNT * Math.PI * blob * blob * PROFILE_K);

    // frame: x to the right and y up as seen from Earth (north up, east left), z toward Earth
    const center = l.positionPc.clone();
    const toEarth = center.clone().negate().normalize();
    const north = raDecToScene(0, 90);
    const up = north.clone().addScaledVector(toEarth, -north.dot(toEarth)).normalize();
    const right = new Vector3().crossVectors(toEarth, up).negate(); // forward × up, forward = −toEarth
    const basis = new Matrix3().set(right.x, up.x, toEarth.x, right.y, up.y, toEarth.y, right.z, up.z, toEarth.z);

    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(pos, 3));
    geo.setAttribute('color', new BufferAttribute(col, 3));
    geo.setAttribute('weight', new BufferAttribute(w, 1));
    geo.setAttribute('size', new BufferAttribute(size, 1));
    const mat = new ShaderMaterial({
      vertexShader: Shaders.nebulaCloudVert,
      fragmentShader: Shaders.pointsFrag,
      uniforms: {
        uBasis: { value: basis },
        uCenterRel: { value: new Vector3() },
        uPixelRatio: { value: 1 },
        uSkyRadius: { value: SKY_RADIUS_KM * 0.985 },
        uPxPerRad: { value: 1000 },
        uBlobRadius: { value: blob },
        uAlpha: { value: alpha },
        uFade: { value: 0 },
        uMaxPx: { value: this.maxPointPx },
        uSoftness: { value: 1.0 },
        uTint: { value: new Vector4(0, 0, 0, 0) },
      },
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
    });
    const points = new Points(geo, mat);
    points.frustumCulled = false;
    points.renderOrder = -11;
    points.visible = false;
    this.scene.add(points);
    this.clouds.push({ index, landmark: l, points, mat, center });
  }

  /**
   * Crossfade weight of the cloud vs the photo sprite from the object's apparent radius (px):
   * the cloud takes over once the object is clearly resolved.
   */
  static handover(radiusPx: number): number {
    const t = Math.min(1, Math.max(0, (radiusPx - 8) / 12));
    return t * t * (3 - 2 * t);
  }

  /**
   * @param camPc camera (scene pc)
   * @param k flux → alpha·px² calibration of the landmark sprites (keeps both LODs equally bright)
   */
  update(camPc: Vector3, pxPerRad: number, pixelRatio: number, k: number, visible: boolean): void {
    for (const c of this.clouds) {
      const u = c.mat.uniforms;
      const rel = u.uCenterRel.value as Vector3;
      rel.copy(c.center).sub(camPc);
      const d = Math.max(rel.length(), 1e-6);
      const R = c.landmark.def.radiusPc;
      const px = Math.atan(R / d) * pxPerRad;
      const t = NebulaClouds.handover(px);
      if (!visible || t <= 0) { c.points.visible = false; continue; }
      // same brightness law as the sprite: physical flux spread over the apparent disc, with the
      // navigation floor once we are within a few hundred radii
      const m = c.landmark.def.absMag + 5 * Math.log10(d) - 5;
      const flux = Math.pow(10, -0.4 * m);
      const pxc = Math.max(px, 0.75);
      const physical = Math.min((k * flux) / (0.61 * pxc * pxc), 1);
      const near = 0.6 * (1 - smoothstep(60, 600, d / R));
      u.uFade.value = Math.max(physical, near) * t;
      u.uPxPerRad.value = pxPerRad;
      u.uPixelRatio.value = pixelRatio;
      c.points.visible = true;
    }
  }

  dispose(): void {
    for (const c of this.clouds) {
      this.scene.remove(c.points);
      c.points.geometry.dispose();
      c.mat.dispose();
    }
    this.clouds.length = 0;
  }
}

/** Two-octave value noise on the unit square, roughly in −1..1 */
class ValueNoise {
  private readonly a: Float32Array;
  private readonly b: Float32Array;
  constructor(rng: Rng, private readonly ga: number, private readonly gb: number) {
    this.a = new Float32Array((ga + 1) * (ga + 1));
    this.b = new Float32Array((gb + 1) * (gb + 1));
    for (let i = 0; i < this.a.length; i++) this.a[i] = rng.next();
    for (let i = 0; i < this.b.length; i++) this.b[i] = rng.next();
  }
  at(x: number, y: number): number {
    const v = sample(this.a, this.ga, x, y) + 0.5 * sample(this.b, this.gb, x, y);
    return (v / 1.5 - 0.5) * 2;
  }
}

function sample(g: Float32Array, n: number, x: number, y: number): number {
  const fx = Math.min(x * n, n - 1e-6), fy = Math.min(y * n, n - 1e-6);
  const ix = Math.floor(fx), iy = Math.floor(fy);
  let tx = fx - ix, ty = fy - iy;
  tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty);
  const w = n + 1;
  const v00 = g[iy * w + ix], v10 = g[iy * w + ix + 1], v01 = g[(iy + 1) * w + ix], v11 = g[(iy + 1) * w + ix + 1];
  return (v00 * (1 - tx) + v10 * tx) * (1 - ty) + (v01 * (1 - tx) + v11 * tx) * ty;
}

function srgb(byte: number): number {
  return Math.pow(byte / 255, 2.2);
}

function gauss(rng: Rng): number {
  return Math.sqrt(-2 * Math.log(Math.max(rng.next(), 1e-9))) * Math.cos(2 * Math.PI * rng.next());
}

function smoothstep(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}
