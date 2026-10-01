import {
  AdditiveBlending, AmbientLight, BackSide, Box3, CircleGeometry, Color, DirectionalLight, DoubleSide, FrontSide, Group, Mesh,
  MeshStandardMaterial, NormalBlending, PlaneGeometry, RingGeometry, Scene, ShaderMaterial, Sphere, SphereGeometry, Vector3, Vector4,
  type Camera, type IUniform, type Quaternion,
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import type { CelestialBody } from '../core/CelestialBody';
import type { StarSystem } from '../core/StarSystem';
import { DEG, PARSEC_KM } from '../core/constants';
import { temperatureToRgb } from '../astro/stellar';
import { IMAGERY } from '../data/imagery';
import { Shaders } from './shaders';
import { TileGlobe } from './TileGlobe';

export interface RenderSettings {
  atmospheres: boolean;
  clouds: boolean;
  rings: boolean;
  shadows: boolean;
  /** real satellite imagery tiles on Earth / Moon / Mars */
  imagery: boolean;
}

const _v = new Vector3();
const _n = new Vector3();

type Uniforms = Record<string, IUniform>;

function smooth01(x: number): number {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
}

function vec3(c: [number, number, number]): Vector3 {
  return new Vector3(c[0], c[1], c[2]);
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
  clouds?: Mesh;
  cloudsMat?: ShaderMaterial;
  atmosphere?: Mesh;
  atmosphereMat?: ShaderMaterial;
  rings?: Mesh;
  ringsMat?: ShaderMaterial;
  corona?: Mesh;
  coronaMat?: ShaderMaterial;
  occluders: CelestialBody[] = [];
  /** apparent radius in pixels, updated each frame */
  apparentRadiusPx = 0;
  /** camera distance in km, updated each frame */
  distance = 0;
  /** camera-relative position */
  readonly relPos = new Vector3();
  /** on-screen visibility of the mesh */
  meshVisible = false;
  /** streamed imagery layer (Earth, Moon, Mars), replaces the procedural surface once loaded */
  tiles: TileGlobe | null = null;
  imageryActive = false;

  private lit: Uniforms[] = [];

  constructor(body: CelestialBody, sphereGeo: SphereGeometry, starRadius: number, maxAnisotropy = 1) {
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
    if (a.kind === 'blackhole') {
      // drawn by the screen-space lensing pass (BlackHolePass); nothing in the scene graph
      this.group.visible = false;
      return;
    }
    if (a.kind === 'star') {
      this.surfaceMat = new ShaderMaterial({
        vertexShader: Shaders.surfaceVert,
        fragmentShader: Shaders.starFrag,
        uniforms: { ...baseUniforms, uTemperature: { value: a.temperature }, uIntensity: { value: 0.75 } },
      });
      // Corona billboard, tinted by the photosphere temperature
      const [cr, cg, cb] = temperatureToRgb(a.temperature);
      const warm = new Color(cr, cg, cb).lerp(new Color(1.0, 0.85, 0.6), a.temperature > 5000 && a.temperature < 6500 ? 0.6 : 0.15);
      this.coronaMat = new ShaderMaterial({
        vertexShader: Shaders.billboardVert,
        fragmentShader: Shaders.coronaFrag,
        uniforms: {
          uTime: { value: 0 },
          uColor: { value: warm },
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
        },
      });
      const img = IMAGERY[d.id];
      if (img) {
        this.tiles = new TileGlobe(body, img, lit, {
          atmColor: this.surfaceMat.uniforms.uAtmColor.value as Vector3,
          atmDensity: d.atmosphere ? d.atmosphere.density : 0,
          sunsetColor: this.surfaceMat.uniforms.uSunsetColor.value as Vector3,
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
          uBodyRadius: { value: body.radius },
          uOuterRadius: { value: body.radius * (1 + d.atmosphere.height * 3.2) },
          uColor: { value: vec3(d.atmosphere.color) },
          uSunsetColor: { value: d.atmosphere.sunsetColor ? vec3(d.atmosphere.sunsetColor) : vec3(d.atmosphere.color) },
          uDensity: { value: d.atmosphere.density },
          uOccluders: { value: [new Vector4(), new Vector4(), new Vector4(), new Vector4()] },
        },
        transparent: true,
        blending: AdditiveBlending,
        depthWrite: false,
        side: FrontSide,
      });
      this.atmosphere = new Mesh(sphereGeo, this.atmosphereMat);
      this.atmosphere.scale.setScalar(body.radius * (1 + d.atmosphere.height * 3.2));
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
    }
  }

  addTo(scene: Scene): void {
    scene.add(this.group);
    if (this.atmosphere) scene.add(this.atmosphere);
    if (this.corona) scene.add(this.corona);
  }

  /** Choose occluders: parent + brightest siblings for moons; largest-angular-size children for planets */
  computeOccluders(): void {
    const b = this.body;
    const angSize = (x: CelestialBody) => (x.resolved ? x.radius / x.resolved.a : 0);
    if (b.parent && b.parent.data.type !== 'star') {
      const sibs = b.parent.children.filter((s) => s !== b).sort((p, q) => angSize(q) - angSize(p)).slice(0, 3);
      this.occluders = [b.parent, ...sibs];
    } else {
      this.occluders = [...b.children].sort((p, q) => angSize(q) - angSize(p)).slice(0, 4);
    }
  }

  /** Release GPU resources owned by this view (the sphere geometry is shared and kept). */
  dispose(scene: Scene): void {
    scene.remove(this.group);
    if (this.atmosphere) scene.remove(this.atmosphere);
    if (this.corona) { scene.remove(this.corona); this.corona.geometry.dispose(); }
    if (this.rings) this.rings.geometry.dispose();
    for (const m of [this.surfaceMat, this.cloudsMat, this.atmosphereMat, this.ringsMat, this.coronaMat]) m?.dispose();
    if (this.ground) { this.ground.geometry.dispose(); (this.ground.material as MeshStandardMaterial).dispose(); }
    this.tiles?.dispose();
    // model geometries/materials stay in the shared cache
  }

  /** Fetch and fit the spacecraft model: centred, bounding radius = body.radius (km). */
  private requestModel(): void {
    const a = this.body.data.appearance;
    if (a.kind !== 'spacecraft' || this.modelRequested) return;
    this.modelRequested = true;
    loadModel(a.model).then((src) => {
      const model = src.clone(true);
      const box = new Box3().setFromObject(model);
      const sphere = box.getBoundingSphere(new Sphere());
      const s = this.body.radius / Math.max(sphere.radius, 1e-9);
      const wrapper = new Group();
      model.position.copy(sphere.center).multiplyScalar(-1);
      wrapper.add(model);
      wrapper.scale.setScalar(s);
      wrapper.traverse((o) => { o.frustumCulled = false; });
      this.model = wrapper;
      this.group.add(wrapper);
      if (this.body.data.orbit?.kind === 'surface') this.addGroundPatch();
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

  update(
    camPos: Vector3, camQuat: Quaternion, camera: Camera, viewportH: number, fovRad: number,
    sunPos: Vector3, sunRadius: number, sunColor: Vector3, time: number, settings: RenderSettings,
  ): void {
    const b = this.body;
    this.relPos.copy(b.position).sub(camPos);
    const dist = this.relPos.length();
    this.distance = dist;
    const pxPerRad = viewportH / 2 / Math.tan(fovRad / 2);
    this.apparentRadiusPx = (b.radius / Math.max(dist, 1e-6)) * pxPerRad;

    // Hide mesh when sub-pixel (the point layer draws it), keep for the star always
    this.meshVisible = this.apparentRadiusPx > 0.35 || b.data.type === 'star';
    this.group.visible = this.meshVisible;
    this.group.position.copy(this.relPos);
    this.group.quaternion.copy(b.rotation);
    if (b.data.type === 'spacecraft') {
      if (this.apparentRadiusPx > 0.2) this.requestModel();
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
    if (this.clouds) this.clouds.visible = settings.clouds;

    for (const lit of this.lit) {
      lit.uSunPos.value.copy(_v);
      lit.uSunRadius.value = sunRadius;
      lit.uSunColor.value.copy(sunColor);
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
    if (this.surfaceMat) this.surfaceMat.uniforms.uTime.value = time;
    if (this.cloudsMat) this.cloudsMat.uniforms.uTime.value = time;

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
        this.cloudsMat.uniforms.uOpacity.value = b.data.clouds.opacity * k;
      }
    }

    if (this.ringsMat) {
      _n.copy(b.pole);
      this.ringsMat.uniforms.uNormal.value.copy(_n);
    }

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
        const occ = u.uOccluders.value as Vector4[];
        for (let i = 0; i < 4; i++) {
          const o = this.occluders[i];
          if (o && settings.shadows) occ[i].set(o.position.x - camPos.x, o.position.y - camPos.y, o.position.z - camPos.z, o.radius);
          else occ[i].set(0, 0, 0, 0);
        }
        const outer = u.uOuterRadius.value as number;
        const inside = dist < outer * 1.02;
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

    if (this.corona && this.coronaMat) {
      // Apparent magnitude of the star from here: beyond a few light-years it must shrink and
      // fade like any other star instead of staying a 70 px glow.
      const T = b.data.temperature ?? 5772;
      const lum = Math.pow(b.radius / 695_700, 2) * Math.pow(T / 5772, 4);
      const absMag = 4.83 - 2.5 * Math.log10(Math.max(lum, 1e-8));
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
      this.coronaMat.uniforms.uIntensity.value = (0.35 + 1.4 * far) * Math.pow(1 - t, 1.5);
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
    for (const v of this.views) v.dispose(this.scene);
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

  update(
    camPos: Vector3, camQuat: Quaternion, camera: Camera, viewportH: number, fovRad: number,
    sunPos: Vector3, sunRadius: number, sunColor: Vector3, time: number, settings: RenderSettings,
  ): void {
    // sunlight direction as seen from the camera (spacecraft are only resolvable when close)
    _v.copy(sunPos).sub(camPos);
    const d = _v.length();
    if (d > 0) this.sunLight.position.copy(_v).multiplyScalar(1e3 / d);
    this.sunLight.color.setRGB(sunColor.x, sunColor.y, sunColor.z);
    let credit: string | null = null;
    let best = 12; // px: only credit imagery when the body is clearly resolved
    for (const v of this.views) {
      v.update(camPos, camQuat, camera, viewportH, fovRad, sunPos, sunRadius, sunColor, time, settings);
      if (v.imageryActive && v.tiles && v.apparentRadiusPx > best) {
        best = v.apparentRadiusPx;
        credit = v.tiles.imagery.credit;
      }
    }
    this.imageryCredit = credit;
  }
}
