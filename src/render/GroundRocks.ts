import {
  CustomBlending, DepthTexture, DynamicDrawUsage, Group, InstancedBufferAttribute, InstancedMesh, Matrix4, NoColorSpace, OneMinusSrcAlphaFactor,
  OrthographicCamera, Quaternion, ShaderMaterial, SrcAlphaFactor, TextureLoader, Vector3, WebGLRenderTarget,
  type BufferGeometry, type IUniform, type Mesh, type Texture, type WebGLRenderer,
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { RockFamily } from '../data/groundMaterials';
import { Shaders } from './shaders';

/** levels of detail per rock (scripts/rocks-gen.py, rocks-build.py): `rock<i>_<lod>` */
const LODS = 3;
/** a rock is drawn at a level while its size ÷ distance exceeds these, and not at all below the last */
const LOD_AT = [0.05, 0.012, 0.004];
/** the visitor's own spot: rocks this close (km, plus their half-size) are not drawn, nor walked into */
const CLEAR_KM = 0.0004;
/** the camera moves this far (km) before the rocks are sorted into their levels again */
const RESORT_KM = 0.0005;

/**
 * Two populations, sizes drawn from a power law (N(>d) ∝ d⁻², many small, few large): stones
 * close around the visitor and boulders out to a few hundred metres. `p`: share of the cells that
 * hold one, at full rockiness.
 */
const POPULATIONS = [
  { cell: 0.0008, radius: 0.035, p: 0.75, dmin: 0.00007, dmax: 0.0005 },
  { cell: 0.006, radius: 0.32, p: 0.22, dmin: 0.0005, dmax: 0.0032 },
];
/** above this height over the ground (km) no rock is drawn */
const MAX_ALT_KM = 0.4;
/** the shadow map: texels per side, half-width (km) of the square around the visitor, its depth (km) */
const SHADOW_RES = 2048, SHADOW_HALF = 0.045, SHADOW_DEPTH = 0.12;
/** the map is redrawn once the Sun has moved this far from where it was drawn for */
const SHADOW_REDO_COS = Math.cos(0.0003);

interface Rock { m: Float32Array; size: number; kind: number; shade: number }

const _x = new Vector3(1, 0, 0), _y = new Vector3(0, 1, 0);
const _right = new Vector3(), _up = new Vector3(), _c = new Vector3();
const _local = new Matrix4(), _identity = new Matrix4();

interface Shapes {
  /** [rock][level] */
  geos: BufferGeometry[][];
  /** the family's surface atlas (rgb: normal in the rock's frame, a: albedo ÷ 2), null for the plain scans */
  map: Texture | null;
}

const shapes = new Map<string, Promise<Shapes>>();

function loadGeos(url: string): Promise<BufferGeometry[][]> {
  return new GLTFLoader().loadAsync(`${url}?v=${__BUILD_ID__}`).then((gltf) => {
    const out: BufferGeometry[][] = [];
    gltf.scene.traverse((o) => {
      const m = /^rock(\d+)_(\d)$/.exec(o.name);
      if (m && (o as Mesh).isMesh) (out[+m[1]] ??= [])[+m[2]] = (o as Mesh).geometry;
    });
    return out.filter((r) => r && r.length === LODS && r.every(Boolean));
  });
}

/**
 * A family's rock shapes and atlas (scripts/rocks-gen.py), fetched once; the plain photoscanned
 * rocks (scripts/rocks-build.py) when there is no family or it fails to load.
 */
function loadShapes(family: RockFamily | null): Promise<Shapes> {
  const key = family ?? 'cc0';
  let p = shapes.get(key);
  if (!p) {
    p = family
      ? Promise.all([
        loadGeos(`/ground/rocks/rocks-${family}.glb`),
        new TextureLoader().loadAsync(`/ground/rocks/rocks-${family}.webp?v=${__BUILD_ID__}`).then((t) => {
          t.flipY = false;
          t.colorSpace = NoColorSpace;
          t.anisotropy = 4;
          t.needsUpdate = true;
          return t;
        }),
      ]).then(([geos, map]) => ({ geos, map }), () => loadShapes(null))
      : loadGeos('/ground/cc0/rocks.glb').then((geos) => ({ geos, map: null }));
    p.catch(() => shapes.delete(key));
    shapes.set(key, p);
  }
  return p;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Rocks strewn over a landing ground: stones and boulders of the world's rock family, each cell
 * of a grid holding at most one, its rock a pure function of the cell's address — so they stay
 * put as the visitor walks and the cells around them are filled in. Instanced per shape and level
 * of detail; they share the terrain's uniforms: the ground's colour where each lies, its sunlight
 * maps (a rock in a hill's shadow is in shadow), the Sun, the air.
 */
export class GroundRocks {
  readonly group = new Group();
  private readonly mat: ShaderMaterial;
  /** the cells visited so far: their rock, or null for an empty one */
  private readonly cells = new Map<number, Rock | null>();
  private kinds = 0;
  /** each shape's height (its width is 1) */
  private heights: number[] = [];
  /** [shape][level] */
  private meshes: InstancedMesh[][] = [];
  private readonly lastCam = new Vector3(NaN, NaN, NaN);
  private disposed = false;
  private readonly m = new Matrix4();
  private readonly q = new Quaternion();
  private readonly tilt = new Quaternion();
  private readonly pos = new Vector3();
  private readonly scl = new Vector3();
  private readonly nrm = new Vector3();
  private shadowTarget: WebGLRenderTarget | null = null;
  private readonly shadowCam = new OrthographicCamera(-SHADOW_HALF, SHADOW_HALF, SHADOW_HALF, -SHADOW_HALF, 0, SHADOW_DEPTH);
  private readonly depthMat = new ShaderMaterial({ vertexShader: Shaders.groundRockDepthVert, fragmentShader: 'void main() { gl_FragColor = vec4(1.0); }' });
  /** the Sun the shadow map was drawn for, and whether the rocks have been re-sorted since */
  private readonly shadowSun = new Vector3(NaN, NaN, NaN);
  private resorted = false;

  constructor(
    private readonly uniforms: Record<string, IUniform>, private readonly surfaceY: (x: number, z: number) => number,
    private readonly density: number, private readonly seed: number, family: RockFamily | null, private readonly renderOrder: number,
  ) {
    const shared = ['uTex0', 'uTex1', 'uTex2', 'uTex3', 'uTex4', 'uSun0', 'uSun1', 'uSun2', 'uSun3', 'uSun4', 'uHalf', 'uRings',
      'uSunlit', 'uProcedural', 'uSunDir', 'uSunColor', 'uFill', 'uOpacity', 'uAtmColor', 'uAtmDensity', 'uHaze', 'uNear', 'uCamLocal',
      'uRockShadow', 'uRockShadowMat', 'uRockShadowOn', 'uRockShadowTexel'];
    this.mat = new ShaderMaterial({
      vertexShader: Shaders.groundRockVert,
      fragmentShader: Shaders.groundRockFrag,
      uniforms: { ...Object.fromEntries(shared.map((k) => [k, uniforms[k]])), uRockMap: { value: null }, uRockMapOn: { value: 0 } },
      blending: CustomBlending, blendSrc: SrcAlphaFactor, blendDst: OneMinusSrcAlphaFactor,
      depthTest: true, depthWrite: true,
    });
    loadShapes(family).then(({ geos, map }) => {
      if (this.disposed || !geos.length) return;
      this.mat.uniforms.uRockMap.value = map;
      this.mat.uniforms.uRockMapOn.value = map ? 1 : 0;
      this.build(geos);
    }, (err) => console.warn('Kayalar yüklenemedi', err));
  }

  /** rock fields and bare stretches: a smooth noise over ~40 m cells, 0 … 1 */
  private field(x: number, z: number): number {
    const hash = (i: number, j: number): number => {
      const s = Math.sin(i * 127.1 + j * 311.7 + this.seed * 0.013) * 43758.5453;
      return s - Math.floor(s);
    };
    const u = x / 0.04, v = z / 0.04, i = Math.floor(u), j = Math.floor(v);
    const fu = u - i, fv = v - j, su = fu * fu * (3 - 2 * fu), sv = fv * fv * (3 - 2 * fv);
    const a = hash(i, j), b = hash(i + 1, j), c = hash(i, j + 1), d = hash(i + 1, j + 1);
    return (a * (1 - su) + b * su) * (1 - sv) + (c * (1 - su) + d * su) * sv;
  }

  /** the rock of cell (i, j) of population `p`, if it holds one */
  private cell(p: number, i: number, j: number): Rock | null {
    const key = ((p * 2097152 + i + 1048576) * 2097152) + j + 1048576;
    const known = this.cells.get(key);
    if (known !== undefined) return known;
    const pop = POPULATIONS[p];
    const rnd = mulberry32(Math.imul(i, 73856093) ^ Math.imul(j, 19349663) ^ Math.imul(p + 1, 83492791) ^ this.seed);
    const x = (i + rnd()) * pop.cell, z = (j + rnd()) * pop.cell;
    const keep = rnd(), u = rnd(), yaw = rnd(), sq = rnd(), st = rnd(), shade = rnd(), kind = rnd();
    const f = this.field(x, z);
    let rock: Rock | null = null;
    if (keep < this.density * pop.p * (0.15 + 1.7 * f * f)) {
      const qmin = pop.dmin / pop.dmax;
      const d = pop.dmin / Math.sqrt(1 - u * (1 - qmin * qmin));
      // seated on the ground, leaning partly with its slope
      const e = Math.max(0.0005, d), Y = this.surfaceY;
      const y = Y(x, z);
      const up = this.pos.set(0, 1, 0);
      this.nrm.set(Y(x - e, z) - Y(x + e, z), 2 * e, Y(x, z - e) - Y(x, z + e)).normalize().lerp(up, 0.4).normalize();
      this.tilt.setFromUnitVectors(up, this.nrm);
      this.q.setFromAxisAngle(up, yaw * Math.PI * 2).premultiply(this.tilt);
      const k = Math.min(this.kinds - 1, Math.floor(kind * this.kinds));
      // (the flattest scans are raised: half buried, a slab would read as a stain on the ground)
      const tall = Math.max(1, 0.45 / this.heights[k]) * (0.8 + 0.45 * sq);
      this.scl.set(d * (0.85 + 0.3 * st), d * tall, d * (0.85 + 0.3 * (1 - st)));
      this.m.compose(this.pos.set(x, y - d * 0.03, z), this.q, this.scl);
      // most a little darker than the dust around them, a few lighter
      rock = { m: new Float32Array(this.m.elements), size: d, kind: k, shade: 0.62 + 0.45 * shade * shade };
    }
    this.cells.set(key, rock);
    return rock;
  }

  private build(geos: BufferGeometry[][]): void {
    this.kinds = geos.length;
    this.heights = geos.map((levels) => {
      levels[0].computeBoundingBox();
      const b = levels[0].boundingBox!;
      return Math.max(0.05, b.max.y - b.min.y);
    });
    // a shape's share of the most rocks ever in view at once (the stones' disc and the boulders')
    const most = POPULATIONS.reduce((s, p) => s + Math.PI * (p.radius / p.cell) ** 2 * p.p * 1.9, 0);
    this.meshes = geos.map((levels) => levels.map((geo) => {
      const cap = Math.ceil((most / geos.length) * 1.5);
      const attr = new InstancedBufferAttribute(new Float32Array(cap * 2), 2);
      attr.setUsage(DynamicDrawUsage);
      const own = geo.clone();
      own.setAttribute('aRock', attr);
      const mesh = new InstancedMesh(own, this.mat, cap);
      mesh.instanceMatrix.setUsage(DynamicDrawUsage);
      mesh.count = 0;
      mesh.frustumCulled = false;
      mesh.renderOrder = this.renderOrder;
      this.group.add(mesh);
      return mesh;
    }));
    this.lastCam.set(NaN, NaN, NaN);
  }

  /** @param cam camera in the patch frame (km) */
  update(cam: Vector3): void {
    if (!this.meshes.length || !this.group.visible) return;
    if (this.lastCam.distanceToSquared(cam) < RESORT_KM * RESORT_KM) return;
    this.lastCam.copy(cam);
    for (const levels of this.meshes) for (const mesh of levels) mesh.count = 0;
    const alt = cam.y - this.surfaceY(cam.x, cam.z);
    if (alt < MAX_ALT_KM) {
      for (let p = 0; p < POPULATIONS.length; p++) {
        const { cell, radius } = POPULATIONS[p];
        const r = Math.max(0, radius * radius - alt * alt) ** 0.5;
        const i0 = Math.floor((cam.x - r) / cell), i1 = Math.floor((cam.x + r) / cell);
        const j0 = Math.floor((cam.z - r) / cell), j1 = Math.floor((cam.z + r) / cell);
        for (let j = j0; j <= j1; j++) {
          for (let i = i0; i <= i1; i++) {
            const rock = this.cell(p, i, j);
            if (rock) this.show(rock, cam);
          }
        }
      }
    }
    // forget the cells left far behind
    if (this.cells.size > 60000) this.cells.clear();
    this.resorted = true;
    for (const levels of this.meshes) {
      for (const mesh of levels) {
        mesh.visible = mesh.count > 0;
        if (!mesh.count) continue;
        mesh.instanceMatrix.needsUpdate = true;
        mesh.geometry.getAttribute('aRock').needsUpdate = true;
      }
    }
  }

  /**
   * Draw the rocks' depth as the Sun sees them, over a square round the visitor (`sunDir`: unit,
   * patch frame) — again only once they have been re-sorted or the Sun has moved on.
   */
  renderShadows(renderer: WebGLRenderer, sunDir: Vector3): void {
    const u = this.uniforms;
    const cam = this.lastCam;
    if (!this.meshes.length || !this.group.visible || sunDir.y < 0.005 || !(cam.y - this.surfaceY(cam.x, cam.z) < MAX_ALT_KM)) {
      u.uRockShadowOn.value = 0;
      return;
    }
    if (!this.resorted && this.shadowSun.dot(sunDir) > SHADOW_REDO_COS) return;
    this.resorted = false;
    this.shadowSun.copy(sunDir);
    if (!this.shadowTarget) {
      this.shadowTarget = new WebGLRenderTarget(SHADOW_RES, SHADOW_RES, {
        depthTexture: new DepthTexture(SHADOW_RES, SHADOW_RES), depthBuffer: true, stencilBuffer: false, generateMipmaps: false,
      });
      u.uRockShadow.value = this.shadowTarget.depthTexture;
      u.uRockShadowTexel.value = 1 / SHADOW_RES;
    }
    // the Sun's view (patch frame): centred on the ground under the visitor, its centre snapped
    // to whole texels across the Sun's view so the shadows do not crawl as the visitor walks
    const right = _right.crossVectors(Math.abs(sunDir.y) > 0.99 ? _x : _y, sunDir).normalize();
    const up = _up.crossVectors(sunDir, right);
    const texel = (2 * SHADOW_HALF) / SHADOW_RES;
    const c = _c.set(cam.x, this.surfaceY(cam.x, cam.z), cam.z);
    const a = Math.round(c.dot(right) / texel) * texel, b = Math.round(c.dot(up) / texel) * texel, h = c.dot(sunDir);
    c.copy(right).multiplyScalar(a).addScaledVector(up, b).addScaledVector(sunDir, h + SHADOW_DEPTH / 2);
    _local.makeBasis(right, up, sunDir).setPosition(c);
    this.group.updateWorldMatrix(true, false);
    const parent = this.group.parent?.matrixWorld ?? _identity;
    this.shadowCam.matrixAutoUpdate = false;
    this.shadowCam.matrix.multiplyMatrices(parent, _local);
    this.shadowCam.updateMatrixWorld(true);
    (u.uRockShadowMat.value as Matrix4).multiplyMatrices(this.shadowCam.projectionMatrix, _local.invert());
    const prev = renderer.getRenderTarget(), prevClear = renderer.autoClear;
    for (const levels of this.meshes) for (const mesh of levels) mesh.material = this.depthMat;
    renderer.setRenderTarget(this.shadowTarget);
    renderer.autoClear = false;
    renderer.clear(true, true, false);
    renderer.render(this.group, this.shadowCam);
    renderer.setRenderTarget(prev);
    renderer.autoClear = prevClear;
    for (const levels of this.meshes) for (const mesh of levels) mesh.material = this.mat;
    u.uRockShadowOn.value = 1;
  }

  /** draws `rock` at the level of detail its size and distance from `cam` call for */
  private show(rock: Rock, cam: Vector3): void {
    const M = rock.m, size = rock.size;
    const dx = M[12] - cam.x, dy = M[13] - cam.y, dz = M[14] - cam.z;
    const flat = Math.hypot(dx, dz);
    if (flat < CLEAR_KM + size * 0.55 && -dy < size + 0.003) return;
    const s = size / Math.max(1e-6, Math.hypot(flat, dy));
    const lod = s > LOD_AT[0] ? 0 : s > LOD_AT[1] ? 1 : s > LOD_AT[2] ? 2 : -1;
    if (lod < 0) return;
    const mesh = this.meshes[rock.kind][lod];
    if (mesh.count >= mesh.instanceMatrix.count) return;
    const k = mesh.count++;
    (mesh.instanceMatrix.array as Float32Array).set(M, k * 16);
    const a = mesh.geometry.getAttribute('aRock').array as Float32Array;
    a[k * 2] = rock.shade;
    a[k * 2 + 1] = size;
  }

  dispose(): void {
    this.disposed = true;
    for (const levels of this.meshes) for (const mesh of levels) { mesh.geometry.dispose(); mesh.dispose(); }
    this.mat.dispose();
    this.depthMat.dispose();
    this.shadowTarget?.depthTexture?.dispose();
    this.shadowTarget?.dispose();
    this.uniforms.uRockShadowOn.value = 0;
    this.group.removeFromParent();
  }
}
