import {
  AdditiveBlending, AmbientLight, BackSide, Box3, CircleGeometry, Color, CylinderGeometry, DirectionalLight, DoubleSide, FrontSide, Group, Mesh,
  MeshStandardMaterial, NormalBlending, PlaneGeometry, Quaternion, RingGeometry, Scene, ShaderMaterial, Sphere, SphereGeometry, Vector2, Vector3, Vector4,
  type Camera, type IUniform,
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import type { CelestialBody } from '../core/CelestialBody';
import type { StarSystem } from '../core/StarSystem';
import { AU_KM, DEG, PARSEC_KM } from '../core/constants';
import { starLightColor, temperatureToRgb } from '../astro/stellar';
import { RingParticles } from './RingParticles';
import { Plumes } from './Plumes';
import { IMAGERY } from '../data/imagery';
import type { Clouds } from '../data/types';
import { Shaders } from './shaders';
import { TileGlobe } from './TileGlobe';
import { buildProceduralShip, disposeGroup } from './ProceduralShips';
import { Terrain, type TerrainMeta } from './Terrain';
import type { GeneratedGround } from './GroundGen';

export interface RenderSettings {
  atmospheres: boolean;
  clouds: boolean;
  rings: boolean;
  /** boulder layer when flying through a ring system */
  ringParticles: boolean;
  shadows: boolean;
  /** real imagery tiles (NASA GIBS / Solar System Treks) on bodies listed in IMAGERY */
  imagery: boolean;
  /** tour work light: lift the night side of these bodies (0 = off, 1 = lit as at noon) */
  fill?: ReadonlyMap<string, number> | null;
  /** tour comparison body fading in / out (brightness 0..1) */
  ghost?: { id: string; alpha: number } | null;
}

const _v = new Vector3();
const _qInv = new Quaternion();
const _n = new Vector3();
const _v2 = new Vector3();

type Uniforms = Record<string, IUniform>;

function smooth01(x: number): number {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
}

function vec3(c: [number, number, number]): Vector3 {
  return new Vector3(c[0], c[1], c[2]);
}

/** (coverage, opacity, seed, height / R) of a cloud deck for the ground-shadow lookup; opacity 0 = none */
function cloudUniform(c: Clouds | undefined): Vector4 {
  return c ? new Vector4(c.coverage, c.opacity, c.seed, c.height) : new Vector4(0, 0, 0, 0);
}

function lightingUniforms(): Uniforms {
  return {
    uSunPos: { value: new Vector3() },
    uSunRadius: { value: 695_700 },
    uSunColor: { value: new Vector3(1, 1, 1) },
    uBodyPos: { value: new Vector3() },
    uBodyRadius: { value: 1 },
    uOccluders: { value: [new Vector4(), new Vector4(), new Vector4(), new Vector4()] },
    uRing: { value: new Vector4(0, 0, 0, 0) },
    uRingNormal: { value: new Vector3(0, 1, 0) },
    uRingGaps: { value: [new Vector4(), new Vector4(), new Vector4(), new Vector4()] },
    uFill: { value: 0 },
    uAlpha: { value: 1 },
  };
}

function ringGapUniforms(body: CelestialBody): Vector4[] {
  const out = [new Vector4(), new Vector4(), new Vector4(), new Vector4()];
  const r = body.data.rings;
  if (!r) return out;
  const span = r.outer - r.inner;
  (r.gaps ?? []).slice(0, 4).forEach((g, i) => {
    out[i].set((g[0] - r.inner) / span, (g[1] / span) * 0.5, 0, 0);
  });
  return out;
}

/** Renders one celestial body: surface, clouds, atmosphere, rings, corona. */
// NASA 3D Resources GLBs are Draco-compressed; three r186 resolves the decoder (wasm) through
// the bundler, so it ships as a hashed asset alongside the app.
const gltfLoader = new GLTFLoader().setDRACOLoader(new DRACOLoader());
/**
 * Lander terrain (HiRISE relief + orthophotos, see `Terrain`): fetched inside `TERRAIN_LOAD_KM`
 * of the vehicle, faded in between `TERRAIN_FAR_KM` and `TERRAIN_NEAR_KM` so the descent from
 * orbit never jumps, released again beyond `TERRAIN_DROP_KM`.
 */
const TERRAIN_LOAD_KM = 1500;
const TERRAIN_FAR_KM = 350, TERRAIN_NEAR_KM = 120;
const TERRAIN_DROP_KM = 4000;
const smoothstep = (edge0: number, edge1: number, x: number): number => smooth01((x - edge0) / (edge1 - edge0));
/** the vehicle is drawn after its terrain (depth-tested against it) */
const ORDER_VEHICLE = 3;
/** Loaded glTF scenes by URL (shared between views, cloned per body) */
const modelCache = new Map<string, Promise<Group>>();

function loadModel(url: string): Promise<Group> {
  let p = modelCache.get(url);
  if (!p) {
    p = new Promise<Group>((resolve, reject) => {
      // /models/* is served with an immutable cache; the build id busts it on redeploy
      gltfLoader.load(`${url}?v=${__BUILD_ID__}`, (gltf) => resolve(gltf.scene), undefined, (err) => reject(err));
    });
    modelCache.set(url, p);
  }
  return p;
}

export class BodyView {
  readonly body: CelestialBody;
  readonly group = new Group();
  /** null for spacecraft (a glTF model is used instead of the procedural sphere) */
  readonly surface: Mesh | null = null;
  readonly surfaceMat: ShaderMaterial | null = null;
  /** spacecraft model, once loaded */
  model: Group | null = null;
  private modelRequested = false;
  private ground: Mesh | null = null;
  /** real ground of a lander (HiRISE relief + orthophotos), see `requestTerrain` */
  private terrain: Terrain | null = null;
  private terrainRequested = false;
  private terrainFade = 0;
  /** true while the lander's terrain is what the visitor sees (drives the imagery credit) */
  terrainActive = false;
  /** generated ground under a visitor who has landed on this body (see App.land) */
  landing: { ground: GeneratedGround; terrain: Terrain; site: Group; fade: number } | null = null;
  private landingLast = 0;
  clouds?: Mesh;
  cloudsMat?: ShaderMaterial;
  atmosphere?: Mesh;
  atmosphereMat?: ShaderMaterial;
  rings?: Mesh;
  ringsMat?: ShaderMaterial;
  /** boulder layer, populated only when the camera is close to the ring plane */
  ringParticles?: RingParticles;
  plumes?: Plumes;
  corona?: Mesh;
  coronaMat?: ShaderMaterial;
  /** procedural (primitive-built) model whose GPU resources belong to this view */
  private ownsModel = false;
  /** pulsar: the two beam cones (child of `group`, so they spin with the star) */
  beams?: Group;
  beamMat?: ShaderMaterial;
  /** pulsar: unit magnetic axis in group-local space */
  private magAxis?: Vector3;
  occluders: CelestialBody[] = [];
  /** cloud deck visibility 0..1 — eases toward the setting instead of popping (tours strip Venus) */
  private cloudFade = 1;
  private lastNow = 0;
  /** apparent radius in pixels, updated each frame */
  apparentRadiusPx = 0;
  /** camera distance in km, updated each frame */
  distance = 0;
  /** camera-relative position */
  readonly relPos = new Vector3();
  /** on-screen visibility of the mesh */
  meshVisible = false;
  /** streamed imagery layer, replaces the procedural surface once loaded */
  tiles: TileGlobe | null = null;
  imageryActive = false;

  private lit: Uniforms[] = [];

  constructor(body: CelestialBody, sphereGeo: SphereGeometry, starRadius: number, private readonly maxAnisotropy = 1) {
    this.body = body;
    const d = body.data;
    const a = d.appearance;

    const irregular = d.radius < 50 ? 1.0 : d.radius < 300 && (d.type === 'asteroid' || d.type === 'comet') ? 0.5 : 0;

    const baseUniforms: Uniforms = {
      uSeed: { value: a.seed },
      uTime: { value: 0 },
      uIrregular: { value: irregular },
      uFlattening: { value: d.flattening ?? 0 },
    };

    if (a.kind === 'spacecraft') {
      // model is fetched lazily the first time the vehicle becomes resolvable on screen
      this.group.frustumCulled = false;
      return;
    }
    if (a.kind === 'blackhole' || a.kind === 'none') {
      // black holes are drawn by the screen-space lensing pass (BlackHolePass); barycentres are
      // invisible markers — nothing in the scene graph either way
      this.group.visible = false;
      return;
    }
    if (a.kind === 'star' || a.kind === 'pulsar') {
      // neutron stars: million-kelvin surface → render as a blue-white star
      const T = a.kind === 'star' ? a.temperature : 28_000;
      this.surfaceMat = new ShaderMaterial({
        vertexShader: Shaders.surfaceVert,
        fragmentShader: Shaders.starFrag,
        uniforms: { ...baseUniforms, uRealTime: { value: 0 }, uTemperature: { value: T }, uIntensity: { value: a.kind === 'pulsar' ? 1.8 : 0.9 } },
      });
      // Corona billboard, tinted by the photosphere temperature
      const [cr, cg, cb] = temperatureToRgb(T);
      // corona tint: golden-orange around Sun-like and cooler stars, the photosphere colour for hot ones
      const warm = new Color(cr, cg, cb).lerp(new Color(1.0, 0.56, 0.16), T < 7500 ? 0.85 : 0.15);
      if (a.kind === 'pulsar') warm.lerp(new Color(a.beamColor[0], a.beamColor[1], a.beamColor[2]), 0.5);
      // chromosphere: Hα pink for cool/solar stars, fading to the photosphere colour for hot ones
      const hotness = Math.min(1, Math.max(0, (T - 7000) / 5000));
      const rim = new Color(1.0, 0.36, 0.3).lerp(new Color(cr, cg, cb), hotness);
      this.coronaMat = new ShaderMaterial({
        vertexShader: Shaders.billboardVert,
        fragmentShader: Shaders.coronaFrag,
        uniforms: {
          uTime: { value: 0 },
          uRealTime: { value: 0 },
          uSeed: { value: a.seed },
          uColor: { value: warm },
          uRimColor: { value: rim },
          uProminence: { value: a.kind === 'pulsar' ? 0 : 1 - 0.8 * hotness },
          uIntensity: { value: 1.0 },
          uCoreRadius: { value: 1 / 7 },
        },
        transparent: true,
        blending: AdditiveBlending,
        depthWrite: false,
        depthTest: true,
      });
      this.corona = new Mesh(new PlaneGeometry(2, 2), this.coronaMat);
      this.corona.renderOrder = 5;
      this.corona.frustumCulled = false;
      if (a.kind === 'pulsar' && !a.quiet) this.buildBeams(a.magneticTilt, a.beamHalfAngle, a.beamLength, a.beamColor);
    } else if (a.kind === 'gas') {
      const bands = a.bands.slice(0, 6).map(vec3);
      while (bands.length < 6) bands.push(bands[bands.length - 1].clone());
      const lit = lightingUniforms();
      this.lit.push(lit);
      this.surfaceMat = new ShaderMaterial({
        vertexShader: Shaders.surfaceVert,
        fragmentShader: Shaders.gasgiantFrag,
        uniforms: {
          ...baseUniforms, ...lit,
          uBands: { value: bands },
          uBandCount: { value: Math.min(a.bands.length, 6) },
          uBandFreq: { value: a.bandFreq },
          uTurbulence: { value: a.turbulence },
          uStorm: { value: a.storm ? new Vector4(a.storm[0] * DEG, a.storm[1] * DEG, a.storm[2], 1) : new Vector4(0, 0, 0, 0) },
          uStormColor: { value: a.storm ? new Vector3(a.storm[3], a.storm[4], a.storm[5]) : new Vector3() },
          uHexagon: { value: a.hexagon ? 1 : 0 },
          uAtmColor: { value: d.atmosphere ? vec3(d.atmosphere.color) : new Vector3(1, 1, 1) },
          uAtmDensity: { value: d.atmosphere ? d.atmosphere.density : 0 },
        },
      });
    } else {
      const lit = lightingUniforms();
      this.lit.push(lit);
      this.surfaceMat = new ShaderMaterial({
        vertexShader: Shaders.surfaceVert,
        fragmentShader: Shaders.terrestrialFrag,
        uniforms: {
          ...baseUniforms, ...lit,
          uOcean: { value: a.ocean ? vec3(a.ocean) : new Vector3(0, 0, 0) },
          uLandLow: { value: vec3(a.landLow) },
          uLandMid: { value: vec3(a.landMid ?? a.landLow) },
          uLandHigh: { value: vec3(a.landHigh) },
          uIce: { value: a.ice ? vec3(a.ice) : new Vector3(0.95, 0.95, 0.97) },
          uSeaLevel: { value: a.seaLevel ?? -1 },
          uIceCaps: { value: a.iceCaps ?? 0 },
          uCraters: { value: a.craters ?? 0 },
          uRoughness: { value: a.roughness ?? 1 },
          uCityLights: { value: a.cityLights ? 1 : 0 },
          uVolcanic: { value: a.volcanic ? 1 : 0 },
          uVariation: { value: a.variation ?? 0.5 },
          uAtmColor: { value: d.atmosphere ? vec3(d.atmosphere.color) : new Vector3(1, 1, 1) },
          uAtmDensity: { value: d.atmosphere ? d.atmosphere.density : 0 },
          uSunsetColor: { value: d.atmosphere?.sunsetColor ? vec3(d.atmosphere.sunsetColor) : new Vector3(1, 0.6, 0.35) },
          uCloud: { value: cloudUniform(d.clouds) },
        },
      });
      const img = IMAGERY[d.id];
      if (img) {
        this.tiles = new TileGlobe(body, img, lit, {
          atmColor: this.surfaceMat.uniforms.uAtmColor.value as Vector3,
          atmDensity: d.atmosphere ? d.atmosphere.density : 0,
          sunsetColor: this.surfaceMat.uniforms.uSunsetColor.value as Vector3,
          cloud: this.surfaceMat.uniforms.uCloud.value as Vector4,
        }, maxAnisotropy);
        this.group.add(this.tiles.group);
      }
    }
    this.surface = new Mesh(sphereGeo, this.surfaceMat);
    this.surface.scale.setScalar(body.equatorialRadius);
    this.surface.frustumCulled = false;
    this.group.add(this.surface);

    // Clouds
    if (d.clouds) {
      const lit = lightingUniforms();
      this.lit.push(lit);
      this.cloudsMat = new ShaderMaterial({
        vertexShader: Shaders.surfaceVert,
        fragmentShader: Shaders.cloudsFrag,
        uniforms: {
          uSeed: { value: d.clouds.seed },
          uTime: { value: 0 },
          uIrregular: { value: 0 },
          uFlattening: { value: d.flattening ?? 0 },
          ...lit,
          uColor: { value: vec3(d.clouds.color) },
          uCoverage: { value: d.clouds.coverage },
          uOpacity: { value: d.clouds.opacity },
        },
        transparent: true,
        blending: NormalBlending,
        depthWrite: false,
      });
      this.clouds = new Mesh(sphereGeo, this.cloudsMat);
      this.clouds.scale.setScalar(body.equatorialRadius * (1 + d.clouds.height));
      this.clouds.renderOrder = 2;
      this.clouds.frustumCulled = false;
      this.group.add(this.clouds);
    }

    // Atmosphere shell
    if (d.atmosphere) {
      this.atmosphereMat = new ShaderMaterial({
        vertexShader: Shaders.atmosphereVert,
        fragmentShader: Shaders.atmosphereFrag,
        uniforms: {
          uSunPos: { value: new Vector3() },
          uSunRadius: { value: starRadius },
          uSunColor: { value: new Vector3(1, 1, 1) },
          uBodyPos: { value: new Vector3() },
          uBodyRadius: { value: body.equatorialRadius },
          uOuterRadius: { value: body.equatorialRadius * (1 + d.atmosphere.height * 3.2) },
          uPole: { value: new Vector3(0, 1, 0) },
          uPolarScale: { value: body.equatorialRadius / body.polarRadius },
          uColor: { value: vec3(d.atmosphere.color) },
          uSunsetColor: { value: d.atmosphere.sunsetColor ? vec3(d.atmosphere.sunsetColor) : vec3(d.atmosphere.color) },
          uDensity: { value: d.atmosphere.density },
          uOccluders: { value: [new Vector4(), new Vector4(), new Vector4(), new Vector4()] },
          uAlpha: { value: 1 },
          uGround: { value: 0 },
        },
        transparent: true,
        blending: AdditiveBlending,
        depthWrite: false,
        side: FrontSide,
      });
      this.atmosphere = new Mesh(sphereGeo, this.atmosphereMat);
      this.atmosphere.scale.setScalar(body.equatorialRadius * (1 + d.atmosphere.height * 3.2));
      this.atmosphere.renderOrder = 3;
      this.atmosphere.frustumCulled = false;
    }

    // Rings
    if (d.rings) {
      const lit = lightingUniforms();
      this.lit.push(lit);
      this.ringsMat = new ShaderMaterial({
        vertexShader: Shaders.ringsVert,
        fragmentShader: Shaders.ringsFrag,
        uniforms: {
          ...lit,
          uColor: { value: vec3(d.rings.color) },
          uOpacity: { value: d.rings.opacity },
          uSeed: { value: d.rings.seed },
          uInner: { value: d.rings.inner },
          uOuter: { value: d.rings.outer },
          uGaps: { value: ringGapUniforms(body) },
          uNormal: { value: new Vector3(0, 1, 0) },
          uLocalFade: { value: new Vector2(0, 2000) },
        },
        transparent: true,
        side: DoubleSide,
        depthWrite: false,
      });
      this.rings = new Mesh(new RingGeometry(d.rings.inner, d.rings.outer, 384, 24), this.ringsMat);
      this.rings.rotation.x = -Math.PI / 2;
      this.rings.renderOrder = 4;
      this.rings.frustumCulled = false;
      this.group.add(this.rings);
      // boulders share the lighting uniforms (sun, shadows) with the sheet
      this.ringParticles = new RingParticles(body, lit, this.ringsMat.uniforms.uGaps.value as Vector4[]);
    }

    // Eruptive activity: plumes in the body frame
    if (d.activity) {
      const lit = lightingUniforms();
      this.lit.push(lit);
      this.plumes = new Plumes(body, lit);
      this.group.add(this.plumes.points);
    }
  }

  addTo(scene: Scene): void {
    scene.add(this.group);
    if (this.ringParticles) scene.add(this.ringParticles.group);
    if (this.atmosphere) scene.add(this.atmosphere);
    if (this.corona) scene.add(this.corona);
  }

  /** Choose occluders: parent + brightest siblings for moons; largest-angular-size children for planets */
  computeOccluders(): void {
    const b = this.body;
    const angSize = (x: CelestialBody) => (x.resolved ? x.radius / x.resolved.a : 0);
    const primary = b.parent?.data.type;
    if (b.parent && primary !== 'star' && primary !== 'pulsar' && primary !== 'blackhole') {
      const sibs = b.parent.children.filter((s) => s !== b).sort((p, q) => angSize(q) - angSize(p)).slice(0, 3);
      this.occluders = [b.parent, ...sibs];
    } else {
      this.occluders = [...b.children].sort((p, q) => angSize(q) - angSize(p)).slice(0, 4);
    }
  }

  /** Release GPU resources owned by this view (the sphere geometry is shared and kept). */
  /** Two additive radiation cones along the (tilted) magnetic axis; they spin with `group`. */
  private buildBeams(tiltDeg: number, halfAngleDeg: number, lengthRadii: number, color: [number, number, number]): void {
    const R = this.body.radius;
    const L = R * lengthRadii;
    const rFar = L * Math.tan(halfAngleDeg * DEG);
    this.beamMat = new ShaderMaterial({
      vertexShader: Shaders.beamVert,
      fragmentShader: Shaders.beamFrag,
      uniforms: { uTime: { value: 0 }, uColor: { value: new Vector3(color[0], color[1], color[2]) }, uIntensity: { value: 1 } },
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
      side: DoubleSide,
    });
    // cone with its apex at the star: wide "top" at y = L, narrow "bottom" at y = 0
    const geo = new CylinderGeometry(rFar, R * 0.35, L, 40, 24, true).translate(0, L / 2, 0);
    this.beams = new Group();
    this.magAxis = new Vector3(Math.sin(tiltDeg * DEG), Math.cos(tiltDeg * DEG), 0);
    const tilt = tiltDeg * DEG;
    const up = new Mesh(geo, this.beamMat);
    up.rotation.z = -tilt;
    const down = new Mesh(geo, this.beamMat);
    down.rotation.z = Math.PI - tilt;
    for (const m of [up, down]) { m.frustumCulled = false; m.renderOrder = 4; this.beams.add(m); }
    this.group.add(this.beams);
  }

  /** Take out of the scene without releasing anything (see BodyRenderer.setSystem) */
  detach(scene: Scene): void {
    scene.remove(this.group);
    if (this.ringParticles) scene.remove(this.ringParticles.group);
    if (this.atmosphere) scene.remove(this.atmosphere);
    if (this.corona) scene.remove(this.corona);
  }

  dispose(scene: Scene): void {
    this.detach(scene);
    if (this.corona) this.corona.geometry.dispose();
    if (this.rings) this.rings.geometry.dispose();
    this.ringParticles?.dispose();
    this.plumes?.dispose();
    for (const m of [this.surfaceMat, this.cloudsMat, this.atmosphereMat, this.ringsMat, this.coronaMat, this.beamMat]) m?.dispose();
    if (this.beams) for (const m of this.beams.children) (m as Mesh).geometry.dispose();
    if (this.ground) { this.ground.geometry.dispose(); (this.ground.material as MeshStandardMaterial).dispose(); }
    this.releaseTerrain();
    this.releaseLanding();
    this.tiles?.dispose();
    // model geometries/materials stay in the shared cache (procedural ships own theirs)
    if (this.ownsModel && this.model) disposeGroup(this.model);
  }

  /** Fetch and fit the spacecraft model: centred, bounding radius = body.radius (km). */
  private requestModel(): void {
    const a = this.body.data.appearance;
    if (a.kind !== 'spacecraft' || this.modelRequested) return;
    this.modelRequested = true;
    const fit = (model: Group) => {
      const box = new Box3().setFromObject(model);
      const sphere = box.getBoundingSphere(new Sphere());
      const s = this.body.radius / Math.max(sphere.radius, 1e-9);
      const wrapper = new Group();
      model.position.copy(sphere.center).multiplyScalar(-1);
      wrapper.add(model);
      wrapper.scale.setScalar(s);
      wrapper.traverse((o) => { o.frustumCulled = false; o.renderOrder = ORDER_VEHICLE; });
      this.model = wrapper;
      this.group.add(wrapper);
    };
    if (a.procedural) {
      const g = buildProceduralShip(a.procedural, a.glow);
      this.ownsModel = true;
      fit(g);
      return;
    }
    loadModel(a.model).then((src) => {
      fit(src.clone(true));
      if (this.body.data.orbit?.kind === 'surface' && !a.terrain) this.addGroundPatch();
    }).catch((err) => console.warn(`Model yüklenemedi: ${a.model}`, err));
  }

  /**
   * Landers/rovers: the shared planet sphere is tessellated at ~1 km, so at a few metres altitude
   * the camera sits *inside* the polygon. A tangent ground disc in the parent's surface colour
   * gives the vehicle something to stand on; it's only shown when the camera is close.
   */
  private addGroundPatch(): void {
    const p = this.body.parent;
    if (!p) return;
    const pa = p.data.appearance;
    const c = pa.kind === 'terrestrial' ? (pa.landMid ?? pa.landLow) : [0.4, 0.38, 0.35];
    const geo = new CircleGeometry(3, 96);
    geo.rotateX(-Math.PI / 2); // normal → +Y (radial up in the vehicle's frame)
    const mat = new MeshStandardMaterial({ color: new Color(c[0] * 0.85, c[1] * 0.85, c[2] * 0.85), roughness: 1, metalness: 0 });
    const disc = new Mesh(geo, mat);
    disc.position.y = -this.body.radius * 0.7;
    disc.frustumCulled = false;
    this.ground = disc;
    this.group.add(disc);
  }

  /**
   * Rovers with real ground: the HiRISE terrain patch is fetched once the camera comes within
   * `TERRAIN_LOAD_KM`; the plain disc (if any) goes once it is drawable.
   */
  private requestTerrain(): void {
    const a = this.body.data.appearance;
    if (a.kind !== 'spacecraft' || !a.terrain || this.terrainRequested) return;
    this.terrainRequested = true;
    const dir = a.terrain.dir;
    fetch(`${dir}/meta.json?v=${__BUILD_ID__}`).then((r) => r.json()).then(async (meta: TerrainMeta) => {
      if (!this.terrainRequested) return; // released meanwhile
      const atm = this.body.parent?.data.atmosphere;
      const t = new Terrain({ kind: 'remote', dir, meta }, -this.body.radius * 0.7, this.body.parent?.radius ?? 1e9, this.maxAnisotropy, {
        color: atm ? vec3(atm.color) : new Vector3(1, 1, 1),
        density: atm?.density ?? 0,
        sunsetColor: atm?.sunsetColor ? vec3(atm.sunsetColor) : new Vector3(1, 0.6, 0.35),
      });
      this.terrain = t;
      this.group.add(t.group);
      await t.load();
      if (this.terrain === t && this.ground) { this.group.remove(this.ground); this.ground.geometry.dispose(); this.ground = null; }
    }).catch((err) => console.warn(`Arazi yüklenemedi: ${dir}`, err));
  }

  private releaseTerrain(): void {
    this.terrain?.dispose();
    this.terrain = null;
    this.terrainRequested = false;
    this.terrainFade = 0;
    this.terrainActive = false;
  }

  /**
   * Put generated ground (GroundGen) on this body at its site: a child of the body's transform
   * group, so it turns with the planet. Returns the terrain (ready at once — the maps are on the
   * GPU already), whose `surfaceY` is the ground under the visitor.
   */
  landAt(ground: GeneratedGround): Terrain {
    this.releaseLanding();
    const atm = this.body.data.atmosphere;
    const terrain = new Terrain(ground.source, 0, ground.site.radius, this.maxAnisotropy, {
      color: atm ? vec3(atm.color) : new Vector3(1, 1, 1),
      density: atm?.density ?? 0,
      sunsetColor: atm?.sunsetColor ? vec3(atm.sunsetColor) : new Vector3(1, 0.6, 0.35),
    });
    const site = new Group();
    site.position.copy(ground.site.pos);
    site.quaternion.copy(ground.site.quat);
    site.add(terrain.group);
    this.group.add(site);
    void terrain.load();
    this.landing = { ground, terrain, site, fade: 0 };
    return terrain;
  }

  releaseLanding(): void {
    const L = this.landing;
    if (!L) return;
    L.terrain.dispose();
    L.ground.dispose();
    L.site.removeFromParent();
    this.landing = null;
  }

  /** Fade the landing ground by the camera's distance from its site; light it like the globe. */
  private updateLanding(camPos: Vector3, dtReal: number, sunPos: Vector3, sunColor: Vector3, settings: RenderSettings): void {
    const L = this.landing!;
    const b = this.body;
    // the site, camera-relative
    _v2.copy(L.ground.site.pos).applyQuaternion(b.rotation).add(this.relPos);
    const d = _v2.length();
    const goal = L.terrain.ready ? 1 - smoothstep(L.ground.half * 1.2, L.ground.half * 3, d) : 0;
    const slew = dtReal / 1.5;
    L.fade = L.fade < goal ? Math.min(goal, L.fade + slew) : Math.max(goal, L.fade - slew);
    // camera and Sun in the site frame (+Y up)
    _qInv.copy(b.rotation).multiply(L.ground.site.quat).invert();
    _n.copy(sunPos).sub(camPos).sub(_v2).normalize().applyQuaternion(_qInv);
    _v2.negate().applyQuaternion(_qInv);
    L.terrain.update(L.fade, _n, sunColor, settings.fill?.get(b.id) ?? 0, _v2);
    if (L.fade > 0.002) this.group.visible = true;
  }

  /** Fade the terrain by camera distance; a slew limit smooths the moment it finishes loading. */
  private updateTerrain(dist: number, dtReal: number, sunPos: Vector3, sunColor: Vector3, settings: RenderSettings): void {
    const a = this.body.data.appearance;
    if (a.kind !== 'spacecraft' || !a.terrain) return;
    if (dist < TERRAIN_LOAD_KM) this.requestTerrain();
    else if (dist > TERRAIN_DROP_KM && this.terrainRequested) { this.releaseTerrain(); return; }
    const t = this.terrain;
    const goal = t?.ready ? 1 - smoothstep(TERRAIN_NEAR_KM, TERRAIN_FAR_KM, dist) : 0;
    const slew = dtReal / 1.5;
    this.terrainFade = this.terrainFade < goal ? Math.min(goal, this.terrainFade + slew) : Math.max(goal, this.terrainFade - slew);
    this.terrainActive = this.terrainFade > 0.5 && dist < t!.half * 1.5;
    if (!t) return;
    // the Sun and the camera in the vehicle's frame (+Y = local up; the camera is the origin)
    _qInv.copy(this.body.rotation).invert();
    _v2.copy(this.relPos).negate().applyQuaternion(_qInv);
    _v.copy(sunPos).sub(this.body.position).normalize().applyQuaternion(_qInv);
    t.update(this.terrainFade, _v, sunColor, settings.fill?.get(this.body.parent?.id ?? '') ?? 0, _v2);
  }

  update(
    camPos: Vector3, camQuat: Quaternion, camera: Camera, viewportH: number, fovRad: number,
    sunPos: Vector3, sunRadius: number, sunColor: Vector3, time: number, settings: RenderSettings,
  ): void {
    const b = this.body;
    this.relPos.copy(b.position).sub(camPos);
    const dist = this.relPos.length();
    this.distance = dist;
    if (b.hidden || b.filtered) {
      this.apparentRadiusPx = 0;
      this.meshVisible = false;
      this.group.visible = false;
      if (this.atmosphere) this.atmosphere.visible = false;
      if (this.corona) this.corona.visible = false;
      if (this.ringParticles) this.ringParticles.group.visible = false;
      return;
    }
    const pxPerRad = viewportH / 2 / Math.tan(fovRad / 2);
    this.apparentRadiusPx = (b.radius / Math.max(dist, 1e-6)) * pxPerRad;

    // Hide mesh when sub-pixel (the point layer draws it), keep for the star always
    this.meshVisible = this.apparentRadiusPx > 0.35 || b.data.type === 'star' || b.data.type === 'pulsar';
    this.group.visible = this.meshVisible;
    this.group.position.copy(this.relPos);
    this.group.quaternion.copy(b.rotation);
    if (b.data.type === 'spacecraft') {
      if (this.apparentRadiusPx > 0.2) this.requestModel();
      const a = b.data.appearance;
      if (a.kind === 'spacecraft' && a.terrain) {
        const now = performance.now();
        const dtReal = this.lastNow ? Math.min(0.5, (now - this.lastNow) / 1000) : 0;
        this.lastNow = now;
        this.updateTerrain(dist, dtReal, sunPos, sunColor, settings);
        // the terrain spans kilometres: keep the group alive while the vehicle itself is sub-pixel
        if (this.terrainFade > 0.002) {
          this.group.visible = true;
          if (this.model) this.model.visible = this.meshVisible;
        } else if (this.model) this.model.visible = true;
      }
      if (this.ground) this.ground.visible = dist < 12; // km
      return;
    }
    if (b.data.type === 'blackhole') {
      this.group.visible = false;
      return;
    }

    // Camera-relative sun position
    _v.copy(sunPos).sub(camPos);

    const ringsOn = !!this.rings && settings.rings;
    if (this.rings) this.rings.visible = ringsOn;
    if (this.clouds) {
      // ease the deck in/out over ~2.5 s of real time
      const now = performance.now();
      const dtReal = this.lastNow ? Math.min(0.1, (now - this.lastNow) / 1000) : 0;
      this.lastNow = now;
      const target = settings.clouds ? 1 : 0;
      const step = dtReal / 2.5;
      this.cloudFade = this.cloudFade < target ? Math.min(target, this.cloudFade + step) : Math.max(target, this.cloudFade - step);
      this.clouds.visible = this.cloudFade > 0.002;
    }

    const fill = settings.fill?.get(b.id) ?? 0;
    const alpha = settings.ghost && settings.ghost.id === b.id ? settings.ghost.alpha : 1;
    for (const lit of this.lit) {
      lit.uSunPos.value.copy(_v);
      lit.uSunRadius.value = sunRadius;
      lit.uSunColor.value.copy(sunColor);
      lit.uFill.value = fill;
      lit.uAlpha.value = alpha;
      lit.uBodyPos.value.copy(this.relPos);
      lit.uBodyRadius.value = b.radius;
      const occ = lit.uOccluders.value as Vector4[];
      for (let i = 0; i < 4; i++) {
        const o = this.occluders[i];
        if (o && settings.shadows) {
          occ[i].set(o.position.x - camPos.x, o.position.y - camPos.y, o.position.z - camPos.z, o.radius);
        } else {
          occ[i].set(0, 0, 0, 0);
        }
      }
      if (ringsOn && b.data.rings && settings.shadows) {
        lit.uRing.value.set(b.data.rings.inner, b.data.rings.outer, b.data.rings.opacity, b.data.rings.seed);
        (lit.uRingGaps.value as Vector4[]).forEach((g, i) => g.copy((this.ringsMat!.uniforms.uGaps.value as Vector4[])[i]));
        lit.uRingNormal.value.copy(b.pole);
      } else {
        lit.uRing.value.set(0, 0, 0, 0);
      }
    }
    // wall-clock seconds: granulation, spicules and prominences keep moving while the
    // simulation clock is paused, and do not strobe when it runs a million times faster
    const realTime = (performance.now() * 1e-3) % 86400;
    if (this.surfaceMat) {
      this.surfaceMat.uniforms.uTime.value = time;
      if (this.surfaceMat.uniforms.uRealTime) this.surfaceMat.uniforms.uRealTime.value = realTime;
    }
    if (this.coronaMat) this.coronaMat.uniforms.uRealTime.value = realTime;
    if (this.cloudsMat && b.data.clouds) {
      this.cloudsMat.uniforms.uTime.value = time;
      // smoothstep on the fade so the deck thins gently at both ends of the transition
      const f = this.cloudFade * this.cloudFade * (3 - 2 * this.cloudFade);
      this.cloudsMat.uniforms.uOpacity.value = b.data.clouds.opacity * f;
    }
    if (this.tiles) this.tiles.setTime(time);

    // Imagery tiles take over from the procedural globe as soon as the base level is loaded
    if (this.tiles && this.surface) {
      if (settings.imagery && this.meshVisible) {
        this.tiles.update(camPos, camera, pxPerRad);
        this.imageryActive = this.tiles.active;
      } else {
        this.tiles.hide();
        this.imageryActive = false;
      }
      this.tiles.group.visible = this.imageryActive;
      this.surface.visible = !this.imageryActive;
      // The procedural cloud deck reads as blobs from low orbit; thin it out over real imagery
      if (this.cloudsMat && b.data.clouds) {
        const alt = dist - b.radius;
        const k = this.imageryActive ? smooth01((alt - 600) / 1900) : 1;
        this.cloudsMat.uniforms.uOpacity.value *= k;
        // the ground shadows follow the deck's actual opacity
        const cu = this.surfaceMat?.uniforms.uCloud?.value as Vector4 | undefined;
        if (cu) cu.y = this.cloudsMat.uniforms.uOpacity.value as number;
      }
    }

    if (this.ringsMat) {
      _n.copy(b.pole);
      this.ringsMat.uniforms.uNormal.value.copy(_n);
      if (this.ringParticles) {
        this.ringParticles.update(this.relPos, time * 3600, pxPerRad, ringsOn && settings.ringParticles);
        // where the boulders are, thin the sheet so they do not look pasted on an opaque plane
        (this.ringsMat.uniforms.uLocalFade.value as Vector2).set(0.6 * this.ringParticles.visibility, 2200);
      }
    }

    if (this.plumes) this.plumes.update(this.apparentRadiusPx, pxPerRad, this.meshVisible);

    if (this.atmosphere && this.atmosphereMat) {
      const on = settings.atmospheres && this.meshVisible && this.apparentRadiusPx > 1.5;
      this.atmosphere.visible = on;
      if (on) {
        this.atmosphere.position.copy(this.relPos);
        const u = this.atmosphereMat.uniforms;
        u.uSunPos.value.copy(_v);
        u.uSunRadius.value = sunRadius;
        u.uSunColor.value.copy(sunColor);
        u.uBodyPos.value.copy(this.relPos);
        u.uPole.value.copy(b.pole);
        u.uAlpha.value = alpha;
        const occ = u.uOccluders.value as Vector4[];
        for (let i = 0; i < 4; i++) {
          const o = this.occluders[i];
          if (o && settings.shadows) occ[i].set(o.position.x - camPos.x, o.position.y - camPos.y, o.position.z - camPos.z, o.radius);
          else occ[i].set(0, 0, 0, 0);
        }
        const outer = u.uOuterRadius.value as number;
        const inside = dist < outer * 1.02;
        // from the ground the sky is a bright dome, not the thin limb haze seen from orbit
        // (faint far from the Sun: Pluto's noon sky stays dark)
        const dAU = Math.hypot(_v.x - this.relPos.x, _v.y - this.relPos.y, _v.z - this.relPos.z) / AU_KM;
        u.uGround.value = (1 - smoothstep(0, (outer - b.equatorialRadius) * 0.3, dist - b.polarRadius)) * Math.min(1, 100 / Math.max(1, dAU * dAU));
        // Inside the shell: render the back faces without depth test so the sky is visible
        if (inside) {
          this.atmosphereMat.side = BackSide;
          this.atmosphereMat.depthTest = false;
        } else {
          this.atmosphereMat.side = FrontSide;
          this.atmosphereMat.depthTest = true;
        }
      }
    }

    if (this.landing) {
      const now = performance.now();
      const dtReal = this.landingLast ? Math.min(0.5, (now - this.landingLast) / 1000) : 0;
      this.landingLast = now;
      this.updateLanding(camPos, dtReal, sunPos, sunColor, settings);
    }

    // Pulsar: brightness pulse when a beam sweeps across the line of sight
    let pulse = 0;
    if (this.beams && this.magAxis && this.beamMat && b.data.appearance.kind === 'pulsar') {
      _n.copy(this.magAxis).applyQuaternion(b.rotation);
      const cosA = Math.abs(_n.dot(_v2.copy(this.relPos).normalize()));
      const half = Math.max(1, b.data.appearance.beamHalfAngle) * DEG;
      const ang = Math.acos(Math.min(1, cosA));
      pulse = Math.exp(-(ang * ang) / (half * half * 0.5));
      // beams are a close-range effect; fade them out as the star shrinks to a point
      const k = Math.min(1, Math.max(0, (this.apparentRadiusPx * 40 - 0.5) / 6));
      this.beams.visible = k > 0.01 && settings.atmospheres;
      this.beamMat.uniforms.uTime.value = time;
      this.beamMat.uniforms.uIntensity.value = k;
    }

    if (this.corona && this.coronaMat) {
      // Apparent magnitude of the star from here: beyond a few light-years it must shrink and
      // fade like any other star instead of staying a 70 px glow.
      const T = b.data.temperature ?? 5772;
      const lum = Math.pow(b.radius / 695_700, 2) * Math.pow(T / 5772, 4);
      const absMag = 4.83 - 2.5 * Math.log10(Math.max(lum, 1e-8)) - 2.2 * pulse;
      const m = absMag + 5 * Math.log10(Math.max(dist / PARSEC_KM, 1e-9)) - 5;
      const t = Math.min(1, Math.max(0, (m + 6) / 14.5));
      // Keep the glow at least ~70 px wide while the star is overwhelmingly bright
      const minAngular = (70 * (1 - t) + 4 * t) / pxPerRad;
      const size = Math.max(b.radius * 4.5, dist * minAngular);
      this.corona.position.copy(this.relPos);
      this.corona.quaternion.copy(camQuat);
      this.corona.scale.setScalar(size);
      this.corona.visible = t < 0.999;
      this.coronaMat.uniforms.uTime.value = time;
      this.coronaMat.uniforms.uCoreRadius.value = Math.min(0.5, (b.radius / size) * 0.98);
      // Near the star the disc dominates; far away the glow reads as a bright star
      const far = Math.min(1, Math.max(0, (dist / b.radius - 20) / 400));
      this.coronaMat.uniforms.uIntensity.value = (0.55 + 1.2 * far) * Math.pow(1 - t, 1.5) * (1 + 1.5 * pulse);
    }
  }
}

/** Manages all body views of the current star system. */
export class BodyRenderer {
  readonly views: BodyView[] = [];
  readonly byId = new Map<string, BodyView>();
  private sphereGeo = new SphereGeometry(1, 128, 96);
  /** lights for the PBR spacecraft models (procedural shaders ignore them) */
  private readonly sunLight = new DirectionalLight(0xffffff, 2.2);
  private readonly fillLight = new AmbientLight(0x6688bb, 0.25);

  /** credit line for the imagery currently dominating the view (null = none) */
  imageryCredit: string | null = null;

  constructor(private readonly scene: Scene, private readonly maxAnisotropy = 1) {
    this.sunLight.target.position.set(0, 0, 0);
    scene.add(this.sunLight, this.sunLight.target, this.fillLight);
  }

  /** Rebuild views for a (new) system. The system must have been evaluated once so orbital elements exist. */
  setSystem(system: StarSystem): void {
    // the old views leave the scene now but are released only after the new system has been
    // drawn: disposing first would free the shared star / planet shader programs, and the new
    // system's identical materials would recompile them (a long stall at every frame switch)
    this.flushRetired();
    for (const v of this.views) v.detach(this.scene);
    this.retired.push(...this.views);
    this.retiredFrames = 0;
    this.views.length = 0;
    this.byId.clear();
    const star = system.star;
    for (const b of system.bodies) {
      const v = new BodyView(b, this.sphereGeo, star.radius, this.maxAnisotropy);
      v.addTo(this.scene);
      this.views.push(v);
      this.byId.set(b.id, v);
    }
    for (const v of this.views) v.computeOccluders();
  }

  private retired: BodyView[] = [];
  private retiredFrames = 0;
  private flushRetired(): void {
    for (const v of this.retired) v.dispose(this.scene);
    this.retired.length = 0;
  }

  /** Add a view for a body created at runtime (mission vehicles). */
  addBody(b: CelestialBody, system: StarSystem): BodyView {
    this.removeBody(b.id);
    const v = new BodyView(b, this.sphereGeo, system.star.radius, this.maxAnisotropy);
    v.addTo(this.scene);
    v.computeOccluders();
    this.views.push(v);
    this.byId.set(b.id, v);
    return v;
  }

  removeBody(id: string): void {
    const v = this.byId.get(id);
    if (!v) return;
    v.dispose(this.scene);
    this.byId.delete(id);
    const i = this.views.indexOf(v);
    if (i >= 0) this.views.splice(i, 1);
  }

  /** light colour of a star body, by its photosphere temperature (cached) */
  private readonly lightColors = new Map<CelestialBody, Vector3>();
  private lightColorOf(star: CelestialBody): Vector3 {
    let c = this.lightColors.get(star);
    if (!c) {
      const a = star.data.appearance;
      const T = a.kind === 'star' ? a.temperature : a.kind === 'pulsar' ? 28_000 : 5772;
      const [r, g, b] = starLightColor(T);
      c = new Vector3(r, g, b);
      this.lightColors.set(star, c);
    }
    return c;
  }

  /**
   * @param hostOf the star lighting a body (multiple systems: each planet has its own sun); the
   *   primary (`sunPos` …) is used when absent or when it returns null
   */
  update(
    camPos: Vector3, camQuat: Quaternion, camera: Camera, viewportH: number, fovRad: number,
    sunPos: Vector3, sunRadius: number, sunColor: Vector3, time: number, settings: RenderSettings,
    hostOf?: (b: CelestialBody) => CelestialBody | null,
  ): void {
    if (this.retired.length && ++this.retiredFrames > 2) this.flushRetired();
    // sunlight direction as seen from the camera (spacecraft are only resolvable when close)
    _v.copy(sunPos).sub(camPos);
    const d = _v.length();
    if (d > 0) this.sunLight.position.copy(_v).multiplyScalar(1e3 / d);
    this.sunLight.color.setRGB(sunColor.x, sunColor.y, sunColor.z);
    // the work light for spacecraft: their PBR materials ignore `uFill`, so the ambient term is
    // raised instead — towards white and near-noon strength — by the strongest fill among the
    // vehicles (only one is ever resolvable at a time, so a scene-wide light reads as per-ship)
    let shipFill = 0;
    if (settings.fill) for (const v of this.views) if (v.body.data.type === 'spacecraft') shipFill = Math.max(shipFill, settings.fill.get(v.body.id) ?? 0);
    this.fillLight.intensity = 0.25 + 1.9 * shipFill;
    this.fillLight.color.setRGB(0.4 + 0.6 * shipFill, 0.53 + 0.47 * shipFill, 0.73 + 0.27 * shipFill);
    let credit: string | null = null;
    let best = 12; // px: only credit imagery when the body is clearly resolved
    for (const v of this.views) {
      const host = hostOf?.(v.body) ?? null;
      if (host && host !== v.body) v.update(camPos, camQuat, camera, viewportH, fovRad, host.position, host.radius, this.lightColorOf(host), time, settings);
      else v.update(camPos, camQuat, camera, viewportH, fovRad, sunPos, sunRadius, sunColor, time, settings);
      if (v.imageryActive && v.tiles && v.apparentRadiusPx > best) {
        best = v.apparentRadiusPx;
        credit = v.tiles.imagery.credit;
      }
      if (v.terrainActive) { const a = v.body.data.appearance; if (a.kind === 'spacecraft' && a.terrain) { credit = a.terrain.credit; best = Infinity; } }
    }
    this.imageryCredit = credit;
  }
}
