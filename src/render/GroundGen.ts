import {
  LinearFilter, LinearMipmapLinearFilter, Matrix4, Mesh, NearestFilter, OrthographicCamera, PlaneGeometry, Quaternion, RGBAFormat,
  Scene, ShaderMaterial, SRGBColorSpace, UnsignedByteType, Vector2, Vector3, Vector4, WebGLRenderTarget, type IUniform, type Texture, type WebGLRenderer,
} from 'three';
import type { CelestialBody } from '../core/CelestialBody';
import { DEG } from '../core/constants';
import { Shaders } from './shaders';
import { GRID_N, TERRAIN_MAX_RINGS, type HeightField, type TerrainMeta, type TerrainSource } from './Terrain';
import type { ImageryPatch } from './TileGlobe';

/**
 * Ground for a landing anywhere on a procedural body.
 *
 * The globe's surface shader describes every terrestrial world as a height field and an albedo
 * function of the direction on the sphere (terrestrial_common.glsl). Landing on it, the same two
 * functions are rendered into the nested square maps the lander `Terrain` draws — heights read
 * back for the mesh and for the ground under the visitor's feet, colours kept on the GPU — so the
 * patch continues the globe's own continents, craters and colours, with metre-scale relief and
 * grain added where the globe has no room for them.
 */

/** colour texels per side, by ring (finest first) */
const ALBEDO_RES = [1024, 1024, 512, 512, 512];

export interface GroundSite {
  /** geodetic latitude / east longitude (deg) */
  lat: number;
  lon: number;
  /** the site on the ellipsoid (object frame, km) */
  pos: Vector3;
  /** unit east / north / up at the site (object frame) */
  east: Vector3;
  north: Vector3;
  up: Vector3;
  /** site frame → object frame: +X east, +Y up, +Z south (as the lander frame of surface bodies) */
  quat: Quaternion;
  /** distance of the site from the body's centre (km): the patch's curvature */
  radius: number;
}

export interface GeneratedGround {
  source: TerrainSource;
  site: GroundSite;
  /** km, the outermost ring's half-size */
  half: number;
  /** fraction of the innermost ring (a few hundred metres around the site) that is open water */
  water: number;
  dispose(): void;
}

/** Solid bodies whose sphere the visitor can stand on (the potato-shaped rocks are left out). */
export function landable(b: CelestialBody): boolean {
  const d = b.data;
  if (d.appearance.kind !== 'terrestrial') return false;
  if (d.radius < 50) return false;
  if (d.radius < 300 && (d.type === 'asteroid' || d.type === 'comet')) return false;
  return true;
}

/** Relief amplitude (km) the globe's 0…1 height field spans on this body. */
export function reliefAmplitude(b: CelestialBody): number {
  return Math.min(0.02 * b.radius, 6 + 0.001 * b.radius);
}

/** Ring sizes (km, finest first): the patch reaches 256 km, or half the radius on small worlds. */
export function groundRingSizes(b: CelestialBody): number[] {
  const outer = Math.min(256, b.radius * 0.5);
  const sizes: number[] = [];
  for (let i = 0; i < TERRAIN_MAX_RINGS; i++) sizes.push(outer / 4 ** (TERRAIN_MAX_RINGS - 1 - i));
  return sizes;
}

/** Geodetic lat/lon (deg) → the site frame on the body's ellipsoid (object coordinates). */
export function groundSite(b: CelestialBody, latDeg: number, lonDeg: number): GroundSite {
  const lat = latDeg * DEG, lon = lonDeg * DEG;
  const sl = Math.sin(lat), cl = Math.cos(lat);
  const re = b.equatorialRadius, e2 = 1 - (b.polarRadius / re) ** 2;
  const N = re / Math.sqrt(1 - e2 * sl * sl);
  const pos = new Vector3(N * cl * Math.cos(lon), N * (1 - e2) * sl, -N * cl * Math.sin(lon));
  const up = new Vector3(cl * Math.cos(lon), sl, -cl * Math.sin(lon));
  const east = new Vector3(-Math.sin(lon), 0, -Math.cos(lon));
  const south = new Vector3().crossVectors(east, up);
  const north = south.clone().negate();
  const quat = new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(east, up, south));
  return { lat: latDeg, lon: lonDeg, pos, east, north, up, quat, radius: pos.length() };
}

/** Object-frame point (km) → geodetic latitude / east longitude (deg). */
export function geodetic(b: CelestialBody, p: Vector3): { lat: number; lon: number } {
  const re = b.equatorialRadius, e2 = 1 - (b.polarRadius / re) ** 2;
  const lon = Math.atan2(-p.z, p.x);
  const rho = Math.hypot(p.x, p.z);
  let lat = Math.atan2(p.y, rho * (1 - e2));
  for (let i = 0; i < 4; i++) {
    const sl = Math.sin(lat);
    const N = re / Math.sqrt(1 - e2 * sl * sl);
    const h = rho / Math.max(Math.cos(lat), 1e-9) - N;
    lat = Math.atan2(p.y, rho * (1 - (e2 * N) / (N + h)));
  }
  return { lat: lat / DEG, lon: lon / DEG };
}

const PALETTE_KEYS = ['uSeed', 'uOcean', 'uLandLow', 'uLandMid', 'uLandHigh', 'uIce', 'uSeaLevel', 'uIceCaps', 'uCraters', 'uRoughness', 'uVolcanic', 'uVariation'];

let quadScene: Scene | null = null;
let quadCam: OrthographicCamera | null = null;
let quad: Mesh | null = null;

function fullscreen(renderer: WebGLRenderer, mat: ShaderMaterial, rt: WebGLRenderTarget): void {
  if (!quadScene) {
    quadScene = new Scene();
    quadCam = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
    quad = new Mesh(new PlaneGeometry(2, 2), mat);
    quad.frustumCulled = false;
    quadScene.add(quad);
  }
  quad!.material = mat;
  const prev = renderer.getRenderTarget();
  const prevClear = renderer.autoClear;
  renderer.autoClear = true;
  renderer.setRenderTarget(rt);
  renderer.render(quadScene, quadCam!);
  renderer.setRenderTarget(prev);
  renderer.autoClear = prevClear;
}

/**
 * Render the maps for a landing at `site`. Synchronous: a few GPU passes and one read-back —
 * a fraction of a second once, at the moment the descent begins.
 * @param palette the body's surface-shader uniforms (the palette is shared by reference)
 */
export function generateGround(
  renderer: WebGLRenderer, b: CelestialBody, palette: Record<string, IUniform>, site: GroundSite, maxAnisotropy: number,
  /** real imagery around the site: its colours replace the procedural palette, its seas the procedural ones */
  real: ImageryPatch | null = null,
): GeneratedGround {
  const sizes = groundRingSizes(b);
  const amp = reliefAmplitude(b);
  const flattening = b.data.flattening ?? 0;
  const hmin = -0.7 * amp - 0.05, hmax = 0.8 * amp + 0.05;
  const shared: Record<string, IUniform> = {};
  for (const k of PALETTE_KEYS) shared[k] = palette[k] ?? { value: 0 };
  const siteU: Record<string, IUniform> = {
    uSitePos: { value: site.pos }, uEast: { value: site.east }, uNorth: { value: site.north },
    uUnsquash: { value: 1 / Math.max(1 - flattening, 1e-3) },
    uHalf: { value: 1 }, uAmp: { value: amp },
    // metre-scale relief, a little tamer on the small worlds whose whole relief is modest
    uDetail: { value: Math.min(1, Math.max(0.3, amp / 8)) },
    uRes: { value: 0 },
    uRealMap: { value: real?.tex ?? null },
    uRealRect: { value: real ? new Vector4(real.lon0, real.latBottom, real.span, real.water ? 2 : 1) : new Vector4(0, 0, 1, 0) },
  };
  const heightMat = new ShaderMaterial({
    vertexShader: Shaders.fullscreenVert, fragmentShader: Shaders.groundHeightFrag,
    uniforms: { ...shared, ...siteU, uRange: { value: new Vector2(hmin, hmax) } },
    depthTest: false, depthWrite: false,
  });
  const albedoMat = new ShaderMaterial({
    vertexShader: Shaders.fullscreenVert, fragmentShader: Shaders.groundAlbedoFrag,
    uniforms: { ...shared, ...siteU },
    depthTest: false, depthWrite: false,
  });

  const fields: HeightField[] = [];
  const textures: Texture[] = [];
  const targets: WebGLRenderTarget[] = [];
  const rings: TerrainMeta['rings'] = [];
  const scale = (hmax - hmin) / 16777215;
  let water = 0;
  for (let i = 0; i < sizes.length; i++) {
    const half = sizes[i] / 2;
    siteU.uHalf.value = half;
    // heights: one texel per terrain vertex, read back for the mesh and the walker
    const n = GRID_N[Math.min(i, GRID_N.length - 1)];
    siteU.uRes.value = n;
    const hrt = new WebGLRenderTarget(n, n, { format: RGBAFormat, type: UnsignedByteType, depthBuffer: false, stencilBuffer: false, minFilter: NearestFilter, magFilter: NearestFilter, generateMipmaps: false });
    fullscreen(renderer, heightMat, hrt);
    const px = new Uint8Array(n * n * 4);
    renderer.readRenderTargetPixels(hrt, 0, 0, n, n, px);
    hrt.dispose();
    const data = new Float32Array(n * n);
    let wet = 0;
    for (let k = 0; k < n * n; k++) {
      data[k] = hmin + (px[k * 4] * 65536 + px[k * 4 + 1] * 256 + px[k * 4 + 2]) * scale;
      if (px[k * 4 + 3] >= 128) wet++;
    }
    if (i === 0) water = wet / (n * n);
    fields.push({ half, n, data });
    // colours stay on the GPU
    siteU.uRes.value = 0;
    const res = ALBEDO_RES[Math.min(i, ALBEDO_RES.length - 1)];
    const crt = new WebGLRenderTarget(res, res, { colorSpace: SRGBColorSpace, depthBuffer: false, stencilBuffer: false, generateMipmaps: true, minFilter: LinearMipmapLinearFilter, magFilter: LinearFilter });
    crt.texture.anisotropy = maxAnisotropy;
    fullscreen(renderer, albedoMat, crt);
    targets.push(crt);
    textures.push(crt.texture);
    rings.push({ size: sizes[i], h: '', hmin, hmax, c: '' });
  }
  heightMat.dispose();
  albedoMat.dispose();
  const seed = (palette.uSeed?.value as number | undefined) ?? 0;
  return {
    source: { kind: 'generated', meta: { rings }, fields, textures, seed },
    site,
    half: sizes[sizes.length - 1] / 2,
    water,
    dispose: () => { for (const t of targets) t.dispose(); },
  };
}
