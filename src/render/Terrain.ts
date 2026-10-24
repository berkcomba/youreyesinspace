import {
  AlwaysDepth, BufferAttribute, BufferGeometry, CustomBlending, Group, Mesh, OneMinusSrcAlphaFactor, ShaderMaterial,
  SrcAlphaFactor, SRGBColorSpace, TextureLoader, Vector2, Vector3, Vector4, type Texture,
} from 'three';
import { Shaders } from './shaders';

/**
 * Real ground under a lander, out to the horizon: nested square rings of relief + imagery around
 * the vehicle, built offline by `scripts/terrain-scene.py` — HiRISE (1 m) near the rover, CTX and
 * the HRSC+MOLA blend out to ~250 km, so crater rims and mountains stand where they really are.
 *
 * `meta.json` lists the rings finest first (each 4× the size of the previous); each has `size`
 * (km), a height map (`h`: PNG, the 16-bit height in the red and green bytes spanning
 * `hmin`…`hmax` km above the vehicle's own ground level) and an image (`c`).
 *
 * Rendering: one mesh per ring with a square hole where the finer ring sits (a geometry clipmap);
 * the finer ring's edge vertices are snapped onto the coarser ring's edge so there are no cracks.
 * The patch is bent down with the planet's curvature, and the outermost ring's relief and alpha
 * fade to nothing at its edge so it melts into the planet's imagery globe.
 *
 * Tone: the maps are stored at a mid level (`tone`); from altitude the shader scales them to the
 * globe's own colour there (`globeTone`), on the ground to the colour the vehicle's cameras saw
 * (`pano.tone`) — dark sites such as Jezero's floor are not black under the rover.
 *
 * Panorama (optional, `pano`, built by scripts/pano-strip.py): the vehicle's real 360° view as a
 * strip around the horizon, drawn on a band of a sphere `PANO_RADIUS_KM` around the mast while
 * the camera is within `PANO_NEAR_KM`. The relief in front of the band occludes it, the band
 * covers the relief beyond — from the ground the photo is the horizon, from above it is gone.
 */
export interface TerrainMeta {
  rings: { size: number; h: string; hmin: number; hmax: number; c: string }[];
  /** mean colour (0…255) the maps are written at, and the globe's colour at the site */
  tone?: number[];
  globeTone?: number[];
  pano?: { file: string; elevMin: number; elevMax: number; north: number; tone: number[] };
}

/** at most this many rings are drawn (the shader samples as many textures) */
export const TERRAIN_MAX_RINGS = 5;
/** vertices per side of each ring's grid, by ring index (finer grids where the data is finer) */
const GRID_N = [513, 257, 513, 257, 257];
/** share of the outermost ring over which relief and alpha fade out */
const EDGE_FADE = 0.2;
/** draw order: depth floor → terrain → panorama band → vehicle (set in BodyRenderer) */
export const TERRAIN_ORDER_CLEAR = 1, TERRAIN_ORDER_GROUND = 2, TERRAIN_ORDER_PANO = 3;
/** radius (km) of the panorama band: relief nearer than this is drawn in front of the photo */
const PANO_RADIUS_KM = 0.25;
/** the panorama is fully shown within this camera distance (km) from the vehicle, gone at 4× */
const PANO_NEAR_KM = 0.03;
/** the vehicle's cameras' height above its ground (km): the panorama's eye point */
const PANO_MAST_KM = 0.002;
/** the ground's natural tone is fully applied below this camera height (km), gone 5 km up */
const NEAR_TONE_KM = 0.3;

const textureLoader = new TextureLoader();

interface HeightField { half: number; n: number; data: Float32Array }

async function loadHeights(url: string, hmin: number, hmax: number, half: number): Promise<HeightField> {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  await new Promise<void>((resolve, reject) => { img.onload = () => resolve(); img.onerror = () => reject(new Error(`height map ${url}`)); img.src = url; });
  const n = img.width;
  const canvas = document.createElement('canvas');
  canvas.width = n; canvas.height = n;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0);
  const px = ctx.getImageData(0, 0, n, n).data;
  const data = new Float32Array(n * n);
  const scale = (hmax - hmin) / 65535;
  for (let i = 0; i < n * n; i++) data[i] = hmin + (px[i * 4] * 256 + px[i * 4 + 1]) * scale;
  return { half, n, data };
}

/** bilinear height at (x, z) km in the vehicle frame; `null` outside the field */
function sampleField(f: HeightField, x: number, z: number): number | null {
  const u = (x / (2 * f.half) + 0.5) * (f.n - 1);
  const v = (z / (2 * f.half) + 0.5) * (f.n - 1);
  if (u < 0 || v < 0 || u > f.n - 1 || v > f.n - 1) return null;
  const i0 = Math.min(f.n - 2, Math.floor(u)), j0 = Math.min(f.n - 2, Math.floor(v));
  const fu = u - i0, fv = v - j0;
  const d = f.data, n = f.n;
  const a = d[j0 * n + i0], b = d[j0 * n + i0 + 1], c = d[(j0 + 1) * n + i0], e = d[(j0 + 1) * n + i0 + 1];
  return (a * (1 - fu) + b * fu) * (1 - fv) + (c * (1 - fu) + e * fu) * fv;
}

const smooth01 = (x: number): number => { const t = Math.min(1, Math.max(0, x)); return t * t * (3 - 2 * t); };

export class Terrain {
  readonly group = new Group();
  private readonly mat: ShaderMaterial;
  private readonly textures: Texture[] = [];
  private readonly meshes: Mesh[] = [];
  private clear: Mesh | null = null;
  private pano: Mesh | null = null;
  private panoMat: ShaderMaterial | null = null;
  private disposed = false;
  /** half-size (km) of the whole patch */
  readonly half: number;
  private readonly rings: TerrainMeta['rings'];
  private readonly meta: TerrainMeta;

  /**
   * @param groundY      y of the vehicle's ground level in its frame (km)
   * @param curvatureR   radius (km) the patch is bent with — the parent's
   * @param atmosphere   the parent's atmosphere, for haze and the horizon glow (as its imagery tiles)
   */
  constructor(
    private readonly dir: string, meta: TerrainMeta, groundY: number, private readonly curvatureR: number,
    private readonly anisotropy: number, atmosphere: { color: Vector3; density: number; sunsetColor: Vector3 },
  ) {
    this.meta = meta;
    this.rings = meta.rings.slice(0, TERRAIN_MAX_RINGS);
    this.half = this.rings[this.rings.length - 1].size / 2;
    // per-channel gains from the stored tone to the globe's and to the panorama's ground tone;
    // the tones are 8-bit sRGB means, the shader scales decoded (linear) texels
    const lin = (v: number): number => { const c = v / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
    const tone = (meta.tone ?? [128, 128, 128]).map(lin);
    const gain = (target: number[] | undefined, fallback: Vector3): Vector3 => target
      ? new Vector3(...target.map((v, i) => Math.min(12, Math.max(0.1, lin(v) / Math.max(tone[i], 1e-4)))))
      : fallback.clone();
    const globeGain = gain(meta.globeTone, new Vector3(1, 1, 1));
    const nearGain = gain(meta.pano?.tone, globeGain);
    const uniforms: Record<string, { value: unknown }> = {
      uHalf: { value: new Float32Array(TERRAIN_MAX_RINGS).fill(1e9) },
      uRings: { value: this.rings.length },
      uSunDir: { value: new Vector3(0, 1, 0) }, uSunColor: { value: new Vector3(1, 1, 1) },
      uFill: { value: 0 }, uOpacity: { value: 0 },
      uAtmColor: { value: atmosphere.color }, uAtmDensity: { value: atmosphere.density }, uSunsetColor: { value: atmosphere.sunsetColor },
      uHaze: { value: 0 },
      uGlobeGain: { value: globeGain }, uNearGain: { value: nearGain }, uNear: { value: 0 },
    };
    for (let i = 0; i < TERRAIN_MAX_RINGS; i++) uniforms[`uTex${i}`] = { value: null };
    this.mat = new ShaderMaterial({
      vertexShader: Shaders.terrainVert,
      fragmentShader: Shaders.terrainFrag,
      uniforms,
      blending: CustomBlending, blendSrc: SrcAlphaFactor, blendDst: OneMinusSrcAlphaFactor,
      depthTest: true, depthWrite: true,
    });
    this.group.position.y = groundY;
  }

  /** Fetch textures and heights, build the meshes. Resolves when the patch is drawable. */
  async load(): Promise<void> {
    const rings = this.rings;
    const texLoad = (url: string) => new Promise<Texture>((resolve, reject) => {
      // flipY off: row 0 of both the image and the height map is north, mapped to −Z
      textureLoader.load(url, (t) => { t.colorSpace = SRGBColorSpace; t.anisotropy = this.anisotropy; t.flipY = false; resolve(t); }, undefined, reject);
    });
    const v = `?v=${__BUILD_ID__}`;
    const pano = this.meta.pano;
    const [fields, texs, panoTex] = await Promise.all([
      Promise.all(rings.map((r) => loadHeights(`${this.dir}/${r.h}${v}`, r.hmin, r.hmax, r.size / 2))),
      Promise.all(rings.map((r) => texLoad(`${this.dir}/${r.c}${v}`))),
      pano ? texLoad(`${this.dir}/${pano.file}${v}`).catch(() => null) : Promise.resolve(null),
    ]);
    if (this.disposed) { for (const t of texs) t.dispose(); panoTex?.dispose(); return; }
    this.textures.push(...texs);
    if (panoTex) this.textures.push(panoTex);
    const u = this.mat.uniforms;
    const halves = u.uHalf.value as Float32Array;
    for (let i = 0; i < rings.length; i++) {
      u[`uTex${i}`].value = texs[i];
      halves[i] = rings[i].size / 2;
    }
    // the same texture repeated keeps the sampler array complete on every driver
    for (let i = rings.length; i < TERRAIN_MAX_RINGS; i++) u[`uTex${i}`].value = texs[rings.length - 1];

    for (let i = 0; i < rings.length; i++) {
      const mesh = new Mesh(this.buildRing(fields, i), this.mat);
      mesh.renderOrder = TERRAIN_ORDER_GROUND;
      mesh.frustumCulled = false;
      this.meshes.push(mesh);
      this.group.add(mesh);
    }

    // depth floor under the footprint (a little wider, for the relief seen edge-on): the planet's
    // curved surface lowered just below the lowest relief, so the globe's depth never hides ground
    // that really lies below the ellipsoid (a flat plane would miss the rays near the horizon)
    const clearMat = new ShaderMaterial({
      vertexShader: Shaders.depthFloorVert,
      fragmentShader: Shaders.depthClearFrag,
      colorWrite: false, depthTest: true, depthFunc: AlwaysDepth, depthWrite: true,
    });
    this.clear = new Mesh(this.buildFloor(Math.min(0, ...rings.map((r) => r.hmin)) - 0.3), clearMat);
    this.clear.renderOrder = TERRAIN_ORDER_CLEAR;
    this.clear.frustumCulled = false;
    this.group.add(this.clear);

    if (pano && panoTex) this.buildPano(pano, panoTex);
  }

  /** the panorama strip on a band of a sphere around the mast (see the class comment) */
  private buildPano(pano: NonNullable<TerrainMeta['pano']>, tex: Texture): void {
    const u = this.mat.uniforms;
    this.panoMat = new ShaderMaterial({
      vertexShader: Shaders.panoVert,
      fragmentShader: Shaders.panoFrag,
      uniforms: {
        uTex: { value: tex },
        uNorth: { value: pano.north },
        uElev: { value: new Vector2(pano.elevMin, pano.elevMax) },
        // lower edge just below the horizon (the relief shows beneath), upper edge into the sky
        uBand: { value: new Vector4(-5, -2.5, 8, Math.min(26, pano.elevMax - 1)) },
        uSunDir: u.uSunDir, uSunColor: u.uSunColor, uFill: u.uFill,
        uOpacity: { value: 0 },
        uAtmColor: u.uAtmColor, uAtmDensity: u.uAtmDensity,
      },
      blending: CustomBlending, blendSrc: SrcAlphaFactor, blendDst: OneMinusSrcAlphaFactor,
      transparent: true, depthTest: true, depthWrite: false,
    });
    // lat-long band from elevMin to elevMax, inward-facing (seen from inside)
    const SEG = 256, ROWS = 24, R = PANO_RADIUS_KM;
    const pos = new Float32Array((SEG + 1) * (ROWS + 1) * 3);
    for (let j = 0; j <= ROWS; j++) {
      const e = (pano.elevMin + ((pano.elevMax - pano.elevMin) * j) / ROWS) * (Math.PI / 180);
      for (let i = 0; i <= SEG; i++) {
        const az = (2 * Math.PI * i) / SEG, k = (j * (SEG + 1) + i) * 3;
        pos[k] = R * Math.sin(az) * Math.cos(e); pos[k + 1] = R * Math.sin(e); pos[k + 2] = -R * Math.cos(az) * Math.cos(e);
      }
    }
    const idx = new Uint32Array(SEG * ROWS * 6);
    let t = 0;
    for (let j = 0; j < ROWS; j++) {
      for (let i = 0; i < SEG; i++) {
        const a = j * (SEG + 1) + i, b = a + 1, c = a + SEG + 1, d = c + 1;
        idx[t++] = a; idx[t++] = b; idx[t++] = c; idx[t++] = b; idx[t++] = d; idx[t++] = c;
      }
    }
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(pos, 3));
    geo.setIndex(new BufferAttribute(idx, 1));
    this.pano = new Mesh(geo, this.panoMat);
    this.pano.position.y = PANO_MAST_KM;
    this.pano.renderOrder = TERRAIN_ORDER_PANO;
    this.pano.frustumCulled = false;
    this.pano.visible = false;
    this.group.add(this.pano);
  }

  /** how far the planet's surface falls below the tangent plane at (x, z) */
  private drop(x: number, z: number): number {
    return (x * x + z * z) / (2 * this.curvatureR);
  }

  /** the curved surface `y` km above the vehicle's ground, over 1.3× the patch */
  private buildFloor(y: number): BufferGeometry {
    const N = 65, H = this.half * 1.3;
    const pos = new Float32Array(N * N * 3);
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const x = -H + (2 * H * i) / (N - 1), z = -H + (2 * H * j) / (N - 1), k = (j * N + i) * 3;
        pos[k] = x; pos[k + 1] = y - this.drop(x, z); pos[k + 2] = z;
      }
    }
    const idx = new Uint32Array((N - 1) * (N - 1) * 6);
    let t = 0;
    for (let j = 0; j < N - 1; j++) {
      for (let i = 0; i < N - 1; i++) {
        const a = j * N + i, b = a + 1, c = a + N, d = c + 1;
        idx[t++] = a; idx[t++] = c; idx[t++] = b; idx[t++] = b; idx[t++] = c; idx[t++] = d;
      }
    }
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(pos, 3));
    geo.setIndex(new BufferAttribute(idx, 1));
    return geo;
  }

  /** relief at (x, z): finest ring that covers the point, cross-faded into the next at its edge */
  private height(fields: HeightField[], x: number, z: number): number {
    let h = 0, w = 0;
    for (let i = fields.length - 1; i >= 0; i--) {
      const f = fields[i];
      const s = sampleField(f, x, z);
      if (s === null) continue;
      const m = Math.max(Math.abs(x), Math.abs(z)) / f.half;
      const inside = i === fields.length - 1 ? 1 : 1 - smooth01((m - 0.82) / 0.16);
      h = h * (1 - inside) + s * inside;
      w = 1;
    }
    if (!w) return 0;
    // the outer edge settles onto the globe's ellipsoid
    const m = Math.max(Math.abs(x), Math.abs(z)) / this.half;
    return h * (1 - smooth01((m - (1 - EDGE_FADE)) / EDGE_FADE));
  }

  /**
   * Ring `ri`: a regular N×N grid over its square, triangles omitted inside the hole where ring
   * `ri − 1` sits. Its own outer edge is stitched to the next ring: edge heights are snapped onto
   * the straight segments between the vertices the coarser grid has there.
   */
  private buildRing(fields: HeightField[], ri: number): BufferGeometry {
    const N = GRID_N[Math.min(ri, GRID_N.length - 1)];
    const H = this.rings[ri].size / 2;
    const cell = (2 * H) / (N - 1);
    const outermost = ri === this.rings.length - 1;
    // hole: the finer ring's square, in cells of this grid (centred)
    let holeCells = 0;
    if (ri > 0) {
      const inner = this.rings[ri - 1].size;
      holeCells = Math.round(inner / cell);
      if (Math.abs(holeCells * cell - inner) > 1e-6 * inner || holeCells % 2 !== (N - 1) % 2) holeCells = 0; // not aligned: no hole, overlap instead
    }
    const h0 = ((N - 1) - holeCells) / 2, h1 = h0 + holeCells; // hole spans cells [h0, h1)
    // stitching ratio to the next ring's grid along this edge
    let ratio = 1;
    if (!outermost) {
      const No = GRID_N[Math.min(ri + 1, GRID_N.length - 1)];
      const cellO = this.rings[ri + 1].size / (No - 1);
      const segs = Math.round((2 * H) / cellO);
      if (Math.abs(segs * cellO - 2 * H) < 1e-6 * H && (N - 1) % segs === 0) ratio = (N - 1) / segs;
    }

    const hts = new Float32Array(N * N);
    for (let j = 0; j < N; j++) {
      const z = -H + j * cell;
      for (let i = 0; i < N; i++) hts[j * N + i] = this.height(fields, -H + i * cell, z);
    }
    if (ratio > 1) {
      // snap edge vertices between the coarser grid's vertices (every `ratio`-th of ours)
      const snap = (idx: (k: number) => number) => {
        for (let q = 0; q < N - 1; q += ratio) {
          const a = hts[idx(q)], b = hts[idx(q + ratio)];
          for (let m = 1; m < ratio; m++) hts[idx(q + m)] = a + (b - a) * (m / ratio);
        }
      };
      snap((k) => k); snap((k) => (N - 1) * N + k); snap((k) => k * N); snap((k) => k * N + N - 1);
    }

    const pos = new Float32Array(N * N * 3);
    const nor = new Float32Array(N * N * 3);
    const alpha = new Float32Array(N * N);
    for (let j = 0; j < N; j++) {
      const z = -H + j * cell;
      for (let i = 0; i < N; i++) {
        const x = -H + i * cell;
        const k = j * N + i;
        pos[k * 3] = x; pos[k * 3 + 1] = hts[k] - this.drop(x, z); pos[k * 3 + 2] = z;
        // normal from the grid's central differences (one-sided at the border)
        const hx = (hts[j * N + Math.min(N - 1, i + 1)] - hts[j * N + Math.max(0, i - 1)]) / (cell * (Math.min(N - 1, i + 1) - Math.max(0, i - 1)));
        const hz = (hts[Math.min(N - 1, j + 1) * N + i] - hts[Math.max(0, j - 1) * N + i]) / (cell * (Math.min(N - 1, j + 1) - Math.max(0, j - 1)));
        const len = Math.hypot(hx, 1, hz);
        nor[k * 3] = -hx / len; nor[k * 3 + 1] = 1 / len; nor[k * 3 + 2] = -hz / len;
        const m = Math.max(Math.abs(x), Math.abs(z)) / this.half;
        alpha[k] = outermost ? 1 - smooth01((m - (1 - EDGE_FADE)) / EDGE_FADE) : 1;
      }
    }
    const cells = (N - 1) * (N - 1) - holeCells * holeCells;
    const idx = new Uint32Array(cells * 6);
    let t = 0;
    for (let j = 0; j < N - 1; j++) {
      for (let i = 0; i < N - 1; i++) {
        if (i >= h0 && i < h1 && j >= h0 && j < h1) continue;
        const a = j * N + i, b = a + 1, c = a + N, d = c + 1;
        idx[t++] = a; idx[t++] = c; idx[t++] = b;
        idx[t++] = b; idx[t++] = c; idx[t++] = d;
      }
    }
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(pos, 3));
    geo.setAttribute('normal', new BufferAttribute(nor, 3));
    geo.setAttribute('alpha', new BufferAttribute(alpha, 1));
    geo.setIndex(new BufferAttribute(idx.subarray(0, t), 1));
    return geo;
  }

  get ready(): boolean { return this.meshes.length > 0; }

  /**
   * @param sunDir unit vector toward the Sun in the vehicle frame
   * @param cam    camera position in the vehicle frame (km): haze and the ground's natural tone
   *               belong to the view from the ground; from altitude the patch must match the
   *               globe's tiles, which have neither; the panorama shows only right at the vehicle
   */
  update(opacity: number, sunDir: Vector3, sunColor: Vector3, fill: number, cam: Vector3): void {
    const u = this.mat.uniforms;
    u.uOpacity.value = opacity;
    (u.uSunDir.value as Vector3).copy(sunDir);
    (u.uSunColor.value as Vector3).copy(sunColor);
    u.uFill.value = fill;
    u.uHaze.value = 1 - smooth01((cam.y - 2) / 18);
    u.uNear.value = 1 - smooth01((cam.y - NEAR_TONE_KM) / 5);
    this.group.visible = this.meshes.length > 0 && opacity > 0.002;
    if (this.pano && this.panoMat) {
      // gone once the camera is far from the vehicle or well above the mast: seen from higher up
      // the band would stand around the vehicle like a wall
      const near = (1 - smooth01((cam.length() - PANO_NEAR_KM) / (3 * PANO_NEAR_KM))) * (1 - smooth01((cam.y - 0.012) / 0.03));
      this.panoMat.uniforms.uOpacity.value = opacity * near;
      this.pano.visible = near > 0.002;
    }
  }

  dispose(): void {
    this.disposed = true;
    for (const m of this.meshes) m.geometry.dispose();
    this.clear?.geometry.dispose();
    (this.clear?.material as ShaderMaterial | undefined)?.dispose();
    this.pano?.geometry.dispose();
    this.panoMat?.dispose();
    this.mat.dispose();
    for (const t of this.textures) t.dispose();
    this.group.removeFromParent();
  }
}
