import './style.css';
import { Matrix3, Matrix4, Quaternion, Vector2, Vector3 } from 'three';
import { Engine } from './core/Engine';
import { TimeSystem } from './core/TimeSystem';
import { Universe, catalogIndexOf, type Landmark, type StarId } from './core/Universe';
import type { StarSystem } from './core/StarSystem';
import { CelestialBody } from './core/CelestialBody';
import { StarCatalog } from './data/StarCatalog';
import { LightPulse } from './render/TourEffects';
import { Relief } from './render/Relief';
import { MeteorShower } from './render/MeteorShower';
import { raDecToScene } from './math/frames';
import { BodyRenderer, type BodyView } from './render/BodyRenderer';
import { generateGround, geodetic, groundRingSizes, groundSite, landable } from './render/GroundGen';
import { BodyPoints } from './render/BodyPoints';
import { OrbitLines } from './render/OrbitLines';
import { StarPoints } from './render/StarPoints';
import { ProcStarPoints } from './render/ProcStarPoints';
import { GalaxySprites } from './render/GalaxySprites';
import { LandmarkSprites } from './render/LandmarkSprites';
import { ProcClouds } from './render/ProcClouds';
import { Volumes } from './render/Volumes';
import { ClusterStarPoints } from './render/ClusterStarPoints';
import { hashStr, isMemberId } from './galaxy/ClusterStars';
import { Rng } from './gen/SystemGenerator';
import type { BodyData } from './data/types';
import { LANDMARK_KIND_LABEL, type LandmarkKind } from './data/landmarks';
import type { DiscoveryEntry } from './ui/UI';
import { NebulaClouds } from './render/NebulaClouds';
import { GalaxyCloud } from './render/GalaxyCloud';
import { FarUniverse, localFade } from './galaxy/FarUniverse';
import { LensFlare } from './render/LensFlare';
import { better, type PickHit } from './render/pickHit';
import { ADOPT_RATIO, FarCluster, RESOLVE_RATIO, farKey, farKindLabel, nearestFarPoint, type FarRef } from './galaxy/FarClusters';
import { Belts, type BeltParticle } from './render/Belts';
import { CometTails } from './render/CometTails';
import { SkyGrid } from './render/SkyGrid';
import { Overlay, type StarSelectionScreen, type SunMarkerScreen } from './render/Overlay';
import type { NamedStarScreen } from './render/StarPoints';
import { Input } from './input/Input';
import { CameraController, type SurfaceStand } from './camera/CameraController';
import { UI, type UIHost } from './ui/UI';
import { loadSettings, saveSettings, type Settings } from './ui/Settings';
import { AU_KM, DAY_S, DEG, J2000_JD, PARSEC_KM } from './core/constants';
import { starLightColor } from './astro/stellar';
import { fmtDuration, fmtLightYears, fmtScaleDistance } from './ui/format';
import { _, applyDom, fixed, initI18n } from './i18n';
import { Missions, type ActiveMission } from './core/Missions';
import { TrajectoryLines } from './render/TrajectoryLines';
import { EphemerisLines } from './render/EphemerisLines';
import { TourPlayer, type ReadoutKind, type SurfacePin, type TourOverrides } from './core/TourPlayer';
import { ephemeris } from './core/Ephemeris';
import { fmtDistance } from './ui/format';
import { eventById, eventTour, KIND_LABELS, type SkyEvent } from './data/events';
import { fmtEventDate } from './ui/EventPanel';
import { SOLAR_SYSTEM } from './data/solarSystem';
import { applyEventMeta, beacon, eventUrl, parseLaunch, type LaunchParams } from './app/share';
import { EmbedUI } from './ui/EmbedUI';
import { C_KM_S } from './core/constants';
import { LessonPlayer } from './core/LessonPlayer';
import type { MissionPlan } from './astro/mission';

const IDENTITY = new Matrix3();

/** short kind labels for the discovery list (Turkish source strings) */
const DISCOVERY_KIND: Partial<Record<LandmarkKind, string>> = {
  nebula: 'Bulutsu', remnant: 'Kalıntı', cluster: 'Açık küme', globular: 'Küresel küme', planetary: 'Gezegenimsi bulutsu', star: 'Yıldız', pulsar: 'Magnetar',
};
/** Flight time of a tour cue's hop (overview and back): a slow, even glide rather than a snap */
const TOUR_HOP_S = 2.8;
/** Closer than this many body radii, the night side is lit (see `updateFill`) */
const NEAR_LIGHT_RADII = 9;
/** auto-orbit speed (rad/s) of the opening backdrop */
const BACKDROP_ORBIT = 0.03;
/** camera distance from the Sun (pc, ≈ 200 AU: beyond the planets) from which the Sun is marked with its distance */
const SUN_MARKER_PC = 0.001;
/** scratch */
const _dir = new Vector3(), _up = new Vector3(), _zero = new Vector3(), _v3 = new Vector3();
const _m4 = new Matrix4();
const smooth01 = (x: number): number => { const t = Math.min(1, Math.max(0, x)); return t * t * (3 - 2 * t); };

class App implements UIHost {
  readonly universe: Universe;
  readonly time = new TimeSystem();
  readonly settings: Settings = loadSettings();
  readonly engine: Engine;
  readonly starPoints: StarPoints;
  readonly procPoints: ProcStarPoints;
  readonly galaxySprites: GalaxySprites;
  readonly farUniverse: FarUniverse;
  readonly farSprites: GalaxySprites[];
  readonly clouds = new Map<number, GalaxyCloud>();
  readonly bodies: BodyRenderer;
  private readonly lensFlare: LensFlare;
  private readonly flareNdc = new Vector2();
  readonly points: BodyPoints;
  readonly orbits: OrbitLines;
  readonly belts: Belts;
  readonly cometTails: CometTails;
  readonly grid: SkyGrid;
  readonly overlay: Overlay;
  readonly input: Input;
  readonly camera: CameraController;
  readonly ui: UI;
  selected: CelestialBody | null = null;
  selectedStar: StarId | null = null;
  selectedGalaxy: number | null = null;
  /** selected far-universe knot / member galaxy when nothing else is selected */
  selectedFar: FarRef | null = null;
  /** the far-universe knot the camera is close to, resolved into its member galaxies */
  private farCluster: FarCluster | null = null;
  private farClusterSprites: GalaxySprites | null = null;
  private farCheckAcc = 1;
  /** clusters built for info panels of selected-but-unresolved knots */
  private readonly farCache = new Map<string, FarCluster>();
  /** selected deep-sky landmark (index into universe.landmarks) when nothing else is selected */
  selectedLandmark: number | null = null;
  readonly landmarkSprites: LandmarkSprites;
  readonly nebulaClouds: NebulaClouds;
  readonly procClouds: ProcClouds;
  readonly volumes: Volumes;
  readonly clusterPoints: ClusterStarPoints;
  readonly missions: Missions;
  readonly trajectories: TrajectoryLines;
  readonly ephemLines: EphemerisLines;
  readonly tours: TourPlayer;
  readonly lessons: LessonPlayer;
  /** event scene currently playing (Events tab / ?event=) */
  currentEvent: SkyEvent | null = null;
  /** iframe chrome when launched with ?embed=1 */
  embed: EmbedUI | null = null;
  private persistSettings = true;
  /** render settings forced by the running tour (empty when none) */
  private tourOverrides: TourOverrides = {};
  /** labelled surface feature the overlay points at (tours) */
  private surfacePin: SurfacePin | null = null;
  private readonly pinScreen = { dir: new Vector3(), label: '', alpha: 1, visible: false, ring: null as Array<Vector3 | null> | null };
  private readonly ringPts = Array.from({ length: 97 }, () => new Vector3());
  private readonly ringOut: Array<Vector3 | null> = [];
  private readonly sunScreen: SunMarkerScreen = { dir: new Vector3(), label: '', selected: false };
  /** tour size comparison: a true-scale stand-in of `ref` kept at the screen-right of `beside` */
  /** tour comparison copy; `side` pins it beside its anchor in space (over-the-shoulder shot) instead of beside it on screen */
  private ghost: { body: CelestialBody; ref: CelestialBody; beside: CelestialBody; alpha: number; leaving: boolean; side: Vector3 | null } | null = null;
  private pulse: LightPulse | null = null;
  private relief: Relief | null = null;
  private meteors: MeteorShower | null = null;
  /** camera offset from the followed vehicle, kept across frame switches */
  private readonly followOffset = new Vector3();
  private followOffsetValid = false;
  uiVisible = true;
  private wantScreenshot = false;
  private last = performance.now();
  private readonly camPosTmp = new Vector3();
  private readonly camPc = new Vector3();
  private readonly camForward = new Vector3();
  private readonly sunColor = new Vector3(1, 1, 1);
  private starLuminosity = 1;
  /** the current system has more than one star (per-body host lighting) */
  private multiple = false;

  /** Luminosity (solar units) of a star body of the current system */
  private hostLuminosity(star: CelestialBody): number {
    if (star === this.universe.star) return this.starLuminosity;
    const a = star.data.appearance;
    const T = a.kind === 'star' ? a.temperature : 5772;
    return Math.pow(star.radius / 695_700, 2) * Math.pow(T / 5772, 4);
  }
  private frameCheckAcc = 0;
  private galaxyCheckAcc = 1;
  private galaxyBoost = 0;
  private readonly maxPointPx: number;
  private readonly starSel: StarSelectionScreen = { name: '', dir: new Vector3() };

  constructor(catalog: StarCatalog) {
    const sceneCanvas = document.getElementById('scene') as HTMLCanvasElement;
    const overlayCanvas = document.getElementById('overlay') as HTMLCanvasElement;
    this.engine = new Engine(sceneCanvas);
    const scene = this.engine.scene;
    const gl = this.engine.renderer.getContext();
    const range = gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE) as Float32Array | number[];
    this.maxPointPx = Math.max(32, Math.min(256, (range?.[1] ?? 64) / this.engine.pixelRatio));

    this.universe = new Universe(catalog);
    // Evaluate once so orbital elements exist before building renderers
    this.universe.update(this.time.jd, this.time.t);

    this.galaxySprites = new GalaxySprites(this.universe.galaxies, scene, this.maxPointPx);
    this.landmarkSprites = new LandmarkSprites(this.universe.landmarks, scene);
    this.nebulaClouds = new NebulaClouds(this.universe.landmarks, scene, this.maxPointPx);
    this.nebulaClouds.onReady = () => this.landmarkSprites.setCloudHandover(true);
    this.volumes = new Volumes(scene);
    this.volumes.warm(this.engine.renderer);
    this.procClouds = new ProcClouds(this.universe.landmarks, scene, this.maxPointPx, this.volumes);
    this.clusterPoints = new ClusterStarPoints(this.universe.landmarks, this.universe.clusterStars, scene);
    this.landmarkSprites.discoveries = this.discoveries;
    this.farUniverse = new FarUniverse();
    this.farSprites = this.farUniverse.tiers.map((t) => {
      const s = new GalaxySprites(t, scene, this.maxPointPx, t.spec.boostMag);
      s.setFade(0);
      return s;
    });
    this.starPoints = new StarPoints(catalog, scene);
    this.procPoints = new ProcStarPoints(this.universe.procStars, scene);
    this.grid = new SkyGrid(scene);
    this.belts = new Belts(scene);
    this.cometTails = new CometTails(scene);
    this.orbits = new OrbitLines(scene);
    this.bodies = new BodyRenderer(scene, this.engine.renderer.capabilities.getMaxAnisotropy());
    this.lensFlare = new LensFlare(scene);
    this.points = new BodyPoints(scene);
    this.overlay = new Overlay(overlayCanvas);
    this.input = new Input(sceneCanvas);
    this.camera = new CameraController(this.universe);
    this.trajectories = new TrajectoryLines(scene);
    this.ephemLines = new EphemerisLines(scene);
    this.missions = new Missions(this.universe, {
      spawned: (m, b) => this.onMissionSpawned(m, b),
      despawned: (m, b) => this.onMissionDespawned(m, b),
      frameSwitch: (m, systemId) => this.onMissionFrameSwitch(m, systemId),
      arrived: (m) => this.onMissionArrived(m),
    });
    this.tours = new TourPlayer(this);
    this.tours.onEnd = (why) => {
      const wasEvent = this.currentEvent !== null;
      if (wasEvent) this.endEvent();
      if (why === 'finished' && !wasEvent) {
        // the support nudge is shown at most once a week per browser; the rest of the time it's a plain toast
        const KEY = 'yeits.supportNudge';
        const last = Number(localStorage.getItem(KEY) ?? 0);
        if (Date.now() - last > 7 * 86400_000) {
          localStorage.setItem(KEY, String(Date.now()));
          this.ui.showToast(_('Tur tamamlandı'), 7000, { label: _('Beğendiyseniz projeyi destekleyin'), href: 'https://github.com/sponsors/berkcomba' });
        } else {
          this.ui.showToast(_('Tur tamamlandı'), 2400);
        }
      } else {
        this.ui.showToast(why === 'finished' ? _('Sahne tamamlandı') : _('Tur bitirildi'), 2400);
      }
      // a finished tour hands back to the circling backdrop; an interrupted one (or an event
      // scene, which is a single composed shot) leaves the camera where it is
      if (why === 'finished' && !wasEvent) this.showBackdrop(true);
    };
    this.lessons = new LessonPlayer(this, this.tours);
    this.ui = new UI(this);

    this.loadSystemRenderables(this.universe.current);
    this.universe.onSystemChange((sys) => this.loadSystemRenderables(sys));

    this.resizeOverlay();
    window.addEventListener('resize', () => this.resizeOverlay());
    window.visualViewport?.addEventListener('resize', () => { this.engine.resize(); this.resizeOverlay(); });

    // Opening view: the planetary system as a slowly circling backdrop until the visitor picks a
    // destination (and again after a tour has finished)
    this.showBackdrop(false);

    this.input.onClick = (x, y, dbl) => this.onClick(x, y, dbl);
    this.input.onKey = (code, e) => this.onKey(code, e);
    this.input.onLockChange = (locked) => this.onLockChange(locked);
    let hoverAt = 0;
    sceneCanvas.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse' || this.input.dragging || this.input.locked) { this.overlay.hoverId = null; return; }
      // every layer is scanned (hundreds of thousands of points): a few checks a second suffice
      const now = performance.now();
      if (now - hoverAt < 60) return;
      hoverAt = now;
      const b = this.overlay.pick(e.clientX, e.clientY, 16);
      this.overlay.hoverId = b?.id ?? null;
      // stars, landmarks and galaxies have no hover ring, but the pointer tells which dots can be clicked
      sceneCanvas.style.cursor = b || this.overlay.hitSun(e.clientX, e.clientY) || this.hitSky(e.clientX, e.clientY)
        || this.belts.pick(e.clientX, e.clientY, this.engine.camera, this.engine.width, this.engine.height, 9) ? 'pointer' : 'default';
    });

    // Galaxy-scale state for the first frame
    this.universe.toParsecs(this.camera.position, this.camPc);
    this.updateGalaxyScale(true);

    this.applySettings();
    requestAnimationFrame(this.frame);
    document.getElementById('loader')?.classList.add('done');
  }

  /**
   * The planetary system out to Jupiter from ~40° above the ecliptic, leaning to Earth's side so the
   * inner planets sit in the foreground, slowly circling the Sun. Orbit lines are forced on while
   * it shows (the backdrop is meaningless without them). `fly` eases there instead of cutting.
   */
  showBackdrop(fly: boolean): void {
    const u = this.universe;
    if (u.current.catalogIndex !== 0) return; // only meaningful in the home system
    const sun = u.star;
    const earth = u.get('earth');
    if (!earth) return;
    const outer = u.get('jupiter') ?? earth;
    const span = outer.resolved?.a ?? outer.localPosition.length();
    const north = earth.orbitNormal.lengthSq() > 1e-6 ? earth.orbitNormal : sun.pole;
    const toEarth = new Vector3().copy(earth.position).sub(sun.position).normalize();
    const dir = north.clone().addScaledVector(toEarth, 0.85).normalize();
    this.select(null);
    this.selectedStar = null; this.selectedGalaxy = null; this.selectedLandmark = null; this.selectedFar = null;
    if (fly) {
      this.camera.goToVantage(sun, dir, span * 2.5, 4);
      this.backdropPending = true;
    } else {
      this.camera.placeAt(sun, dir.multiplyScalar(span * 2.5));
      this.camera.autoOrbit = BACKDROP_ORBIT;
      this.backdrop = true;
    }
  }
  /** the backdrop is on screen (cleared by any new flight, which also stops the auto-orbit) */
  private backdrop = false;
  private backdropPending = false;

  /** The 2D overlay always draws at device resolution (crisp text), whatever the 3D render scale. */
  private resizeOverlay(): void {
    this.overlay.resize(this.engine.width, this.engine.height, Math.min(window.devicePixelRatio || 1, 2));
  }

  /** (Re)build every per-system renderable when the current frame changes. */
  private loadSystemRenderables(sys: StarSystem): void {
    this.bodies.setSystem(sys);
    this.orbits.setSystem(sys);
    this.points.setViews(this.bodies.views);
    this.ephemLines.track(sys.bodies);
    this.belts.setSystem(sys.belts, (s) => (s.centerId && sys.get(s.centerId)) || sys.star, (c) => (sys.catalogIndex === 0 ? IDENTITY : c.poleBasis));
    this.restoreAsteroids(sys);
    const [r, g, b] = starLightColor(sys.starTemperature);
    this.sunColor.set(r, g, b);
    this.starLuminosity = sys.catalogIndex === 0 ? 1 : this.universe.starInfo(sys.starId).luminosity;
    this.multiple = sys.bodies.some((b) => b.data.type === 'barycenter');
    this.noteSystemDiscoveries(sys);
  }

  /* ---------------- UIHost ---------------- */
  select(b: CelestialBody | null): void {
    this.selected = b;
    if (b) { this.selectedStar = null; this.selectedGalaxy = null; this.selectedLandmark = null; this.selectedFar = null; }
  }

  selectStar(id: StarId | null): void {
    this.selectedStar = id;
    if (id !== null) { this.selected = null; this.selectedGalaxy = null; this.selectedLandmark = null; this.selectedFar = null; }
  }

  selectGalaxy(i: number | null): void {
    this.selectedGalaxy = i;
    if (i !== null) { this.selected = null; this.selectedStar = null; this.selectedLandmark = null; this.selectedFar = null; }
  }

  selectLandmark(i: number | null): void {
    // star-type landmarks are real systems: select them as stars
    const sysId = i !== null ? this.universe.landmarks[i].systemId : null;
    if (sysId !== null) { this.selectStar(sysId); return; }
    this.selectedLandmark = i;
    if (i !== null) { this.selected = null; this.selectedStar = null; this.selectedGalaxy = null; this.selectedFar = null; }
  }

  /* ---------------- Far universe: clusters and their member galaxies ---------------- */
  selectFar(ref: FarRef | null): void {
    this.selectedFar = ref;
    if (ref) { this.selected = null; this.selectedStar = null; this.selectedGalaxy = null; this.selectedLandmark = null; }
  }

  /** The resolved cluster for a far reference (the live one, or a cached build for the info panel) */
  farClusterOf(ref: FarRef): FarCluster {
    const live = this.farCluster;
    if (live && live.tierIndex === ref.tier && live.index === ref.index) return live;
    const key = `${ref.tier}:${ref.index}`;
    let c = this.farCache.get(key);
    if (!c) {
      c = new FarCluster(this.farUniverse.tiers[ref.tier], ref.index, ref.tier);
      if (this.farCache.size > 6) this.farCache.delete(this.farCache.keys().next().value!);
      this.farCache.set(key, c);
    }
    return c;
  }

  /** Position (pc, scene frame) of a far knot or member galaxy */
  farPositionPc(ref: FarRef, out = new Vector3()): Vector3 {
    if (ref.member >= 0) {
      const c = this.farClusterOf(ref);
      const p = c.positions, m = Math.min(ref.member, c.count - 1);
      return out.set(p[m * 3], p[m * 3 + 1], p[m * 3 + 2]);
    }
    const t = this.farUniverse.tiers[ref.tier];
    return out.set(t.positions[ref.index * 3], t.positions[ref.index * 3 + 1], t.positions[ref.index * 3 + 2]);
  }

  farRadiusPc(ref: FarRef): number {
    if (ref.member >= 0) { const c = this.farClusterOf(ref); return c.radius[Math.min(ref.member, c.count - 1)]; }
    return this.farUniverse.tiers[ref.tier].radius[ref.index];
  }

  farName(ref: FarRef): string {
    if (ref.member >= 0) { const c = this.farClusterOf(ref); return c.name(Math.min(ref.member, c.count - 1)); }
    return this.farUniverse.tiers[ref.tier].name(ref.index);
  }

  /** Camera-relative position (km, current frame) */
  private farRelative(ref: FarRef, localKm: Vector3, out = new Vector3()): Vector3 {
    this.farPositionPc(ref, out).multiplyScalar(PARSEC_KM);
    return out.sub(this.universe.current.origin).sub(localKm);
  }

  goToFar(ref: FarRef): void {
    this.selectFar(ref);
    const centre = this.farRelative(ref, _zero);
    const R = this.farRadiusPc(ref) * PARSEC_KM;
    const fromCam = new Vector3().copy(this.camera.position).sub(centre).normalize();
    // a cluster: stop where it resolves into galaxies; a member galaxy: like any galaxy (the
    // wheel may then descend deep into it — by then it has been adopted as a real galaxy)
    const arrive = ref.member >= 0 ? R * 2.6 : R * 3;
    this.camera.goToPoint(centre, arrive, fromCam, { radius: R * (ref.member >= 0 ? 0.02 : 0.05), name: this.farName(ref) });
    const dist = new Vector3().copy(centre).sub(this.camera.position).length();
    this.ui.showToast(_('{name} hedefine uçuluyor… ({dist})', { name: this.farName(ref), dist: fmtLightYears(dist) }), 2600);
  }

  centerFar(ref: FarRef): void {
    this.selectFar(ref);
    this.camera.centerOnDirection(this.farRelative(ref, this.camera.position).normalize());
  }

  /** Numbers for the info panel */
  farInfo(ref: FarRef): { name: string; kind: string; distKm: number; distSunPc: number; radiusPc: number; absMag: number; luminosity: number; massSolar: number; richness: number; typeCode: number | null; resolved: boolean; apparentMag: number } {
    const tier = this.farUniverse.tiers[ref.tier];
    const pos = this.farPositionPc(ref);
    const distKm = this.farRelative(ref, this.camera.position).length();
    const c = this.farClusterOf(ref);
    const live = this.farCluster === c;
    if (ref.member >= 0) {
      const m = Math.min(ref.member, c.count - 1);
      const absMag = c.absMag[m];
      return {
        name: c.name(m), kind: _('Küme üyesi galaksi'), distKm, distSunPc: pos.length(), radiusPc: c.radius[m], absMag,
        luminosity: Math.pow(10, (4.83 - absMag) / 2.5), massSolar: 0, richness: 0, typeCode: c.type[m], resolved: live,
        apparentMag: absMag + 5 * Math.log10(Math.max(distKm / PARSEC_KM, 1e-3)) - 5,
      };
    }
    const absMag = tier.absMag[ref.index];
    return {
      name: tier.name(ref.index), kind: farKindLabel(tier), distKm, distSunPc: pos.length(), radiusPc: tier.radius[ref.index], absMag,
      luminosity: c.luminosity, massSolar: c.massSolar, richness: c.richness, typeCode: null, resolved: live,
      apparentMag: absMag + 5 * Math.log10(Math.max(distKm / PARSEC_KM, 1e-3)) - 5,
    };
  }

  /** Resolve the far knot the camera is close to (one at a time) into member galaxies */
  private updateFarClusters(dt: number): void {
    this.farCheckAcc += dt;
    if (this.farCheckAcc < 0.25) return;
    this.farCheckAcc = 0;
    const dSunPc = this.camPc.length();
    const on = this.settings.galaxies && this.settings.procedural && dSunPc > 80e6;
    let want = on ? nearestFarPoint(this.farUniverse.tiers, this.camPc, (k) => this.farUniverse.tiers[k].fade(dSunPc) > 0.05) : null;
    // the knot the user selected (or is flying to) wins over an overlapping neighbour
    const sel = this.selectedFar;
    if (on && sel) {
      const t = this.farUniverse.tiers[sel.tier];
      const ratio = this.farPositionPc({ ...sel, member: -1 }, _dir).distanceTo(this.camPc) / Math.max(t.radius[sel.index], 1);
      if (ratio <= RESOLVE_RATIO && t.fade(dSunPc) > 0.05) want = { tier: sel.tier, index: sel.index, ratio };
    }
    const cur = this.farCluster;
    if (!want || want.ratio > RESOLVE_RATIO) {
      if (cur) this.disposeFarCluster();
      return;
    }
    if (!cur || cur.tierIndex !== want.tier || cur.index !== want.index) {
      if (cur) this.disposeFarCluster();
      const c = this.farClusterOf({ tier: want.tier, index: want.index, member: -1 });
      this.farCluster = c;
      this.farClusterSprites = new GalaxySprites(c, this.engine.scene, this.maxPointPx, 0);
      // member sprites hand over to the adopted galaxy's star cloud up close (same LOD as any galaxy)
      this.farClusterSprites.setNearLod(true);
    }
    this.adoptNearMembers(this.farCluster!);
    // arriving at a knot is a discovery
    if (want.ratio < 6) this.noteDiscovery(farKey({ tier: want.tier, index: want.index, member: -1 }), this.farCluster!.clusterName, false, this.farUniverse.tiers[want.tier].spec.mode === 'web' ? 'Galaksi kümesi' : 'Süperküme düğümü');
  }

  /**
   * Member galaxies within a few radii of the camera become real galaxies for a while (guest slots
   * of the galaxy index): the ordinary cloud / procedural-star / "inside a galaxy" machinery takes
   * over from the sprite, so a far-cluster galaxy can be entered like any other.
   */
  private adoptNearMembers(c: FarCluster): void {
    const g = this.universe.galaxies;
    const near: Array<{ m: number; ratio: number }> = [];
    const p = c.positions;
    for (let m = 0; m < c.count; m++) {
      const ratio = Math.hypot(p[m * 3] - this.camPc.x, p[m * 3 + 1] - this.camPc.y, p[m * 3 + 2] - this.camPc.z) / Math.max(c.radius[m], 1);
      if (ratio < ADOPT_RATIO) near.push({ m, ratio });
    }
    near.sort((a, b) => a.ratio - b.ratio).length = Math.min(near.length, g.guestSlots);
    const keep = new Set(near.map((n) => farKey({ tier: c.tierIndex, index: c.index, member: n.m })));
    // release guests we have left (hysteresis: a bit beyond the adoption distance)
    for (let k = 0; k < g.guestSlots; k++) {
      const slot = g.guestBase + k;
      if (!g.isGuest(slot)) continue;
      const ratio = Math.hypot(g.positions[slot * 3] - this.camPc.x, g.positions[slot * 3 + 1] - this.camPc.y, g.positions[slot * 3 + 2] - this.camPc.z) / g.radius[slot];
      if (ratio > ADOPT_RATIO * 1.25) this.releaseGuest(slot);
    }
    for (const n of near) {
      const ref = { tier: c.tierIndex, index: c.index, member: n.m };
      if (g.adopt(c, n.m, farKey(ref), c.name(n.m), keep) >= 0 && n.ratio < 6) this.noteDiscovery(farKey(ref), c.name(n.m), false, 'Küme üyesi galaksi');
    }
  }

  private releaseGuest(slot: number): void {
    const g = this.universe.galaxies;
    if (this.selectedGalaxy === slot) this.selectGalaxy(null);
    const cloud = this.clouds.get(slot);
    if (cloud) { cloud.dispose(this.engine.scene); this.clouds.delete(slot); }
    g.release(slot);
  }

  private disposeFarCluster(): void {
    if (this.farClusterSprites) {
      this.engine.scene.remove(this.farClusterSprites.points);
      this.farClusterSprites.points.geometry.dispose();
      (this.farClusterSprites.points.material as { dispose(): void }).dispose();
    }
    this.farClusterSprites = null;
    this.farCluster = null;
    const g = this.universe.galaxies;
    for (let k = 0; k < g.guestSlots; k++) if (g.isGuest(g.guestBase + k)) this.releaseGuest(g.guestBase + k);
  }

  /** Fly to a nebula / cluster / remnant (or into a landmark star's system). */
  goToLandmark(i: number): void {
    const u = this.universe;
    const l = u.landmarks[i];
    if (l.systemId !== null) { this.goToStar(l.systemId); return; }
    this.selectLandmark(i);
    const centre = u.landmarkRelative(i, new Vector3(0, 0, 0));
    const R = l.def.radiusPc * PARSEC_KM;
    const fromCam = new Vector3().copy(this.camera.position).sub(centre).normalize();
    // stop where the object fills a good part of the view (sprites fade when we are inside)
    const arrive = l.def.kind === 'remnant' ? R * 5 : R * 3.2;
    this.camera.goToPoint(centre, arrive, fromCam, { radius: R * 0.3, name: _(l.def.name) });
    const dist = new Vector3().copy(centre).sub(this.camera.position).length();
    this.ui.showToast(_('{name} hedefine uçuluyor… ({dist})', { name: l.def.name, dist: fmtLightYears(dist) }), 2600);
  }

  centerLandmark(i: number): void {
    const l = this.universe.landmarks[i];
    if (l.systemId !== null) { this.centerStar(l.systemId); return; }
    this.selectLandmark(i);
    const dir = this.universe.landmarkRelative(i, this.camera.position).normalize();
    this.camera.centerOnDirection(dir);
  }

  goTo(b: CelestialBody): void {
    this.select(b);
    this.camera.goTo(b, this.universe.hostStar(b).position);
    this.ui.showToast(_('{name} hedefine uçuluyor…', { name: b.name }));
  }

  /** Solid worlds the visitor can land on */
  canLand(b: CelestialBody | null): boolean {
    return !!b && landable(b) && this.universe.current.bodies.includes(b);
  }

  /** The body the visitor stands on (or is descending to), if any */
  get landedOn(): CelestialBody | null {
    const cam = this.camera;
    return cam.surface && (cam.mode === 'surface' || cam.autopilot?.kind === 'land') ? cam.surface.body : null;
  }

  /**
   * Land on `b` (the selection by default): where the view meets its surface — or straight below
   * the camera — the ground is generated and the camera descends to stand on it. From there the
   * sky is the real one: run the clock and the Sun, the moons and the stars wheel overhead.
   */
  land(b: CelestialBody | null = this.selected ?? this.camera.target ?? this.camera.nearest, at?: { lat: number; lon: number }): void {
    if (!b || !this.canLand(b)) return;
    if (this.tours.active) this.tours.stop();
    const view = this.bodies.byId.get(b.id);
    if (!view?.surfaceMat) return;
    const cam = this.camera;
    // landing point: the view ray's hit on the body, else the point under the camera
    const rel = new Vector3().copy(cam.position).sub(b.position);
    const fwd = new Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
    const R = b.radius;
    const bq = fwd.dot(rel), c = rel.lengthSq() - R * R;
    const disc = bq * bq - c;
    const hit = new Vector3();
    if (disc > 0 && -bq - Math.sqrt(disc) > 0) hit.copy(rel).addScaledVector(fwd, -bq - Math.sqrt(disc));
    else hit.copy(rel);
    hit.applyQuaternion(new Quaternion().copy(b.rotation).invert());
    const aim = at ?? geodetic(b, hit);
    const half = Math.max(...groundRingSizes(b)) / 2;
    const dLat = (half / b.radius) / DEG * 1.05;
    const groundAt = (lat: number, lon: number) => {
      const site = groundSite(b, lat, lon);
      // real imagery where the globe has it: the patch must lie inside one tile
      const real = view.tiles?.tileCovering(lat, lon, dLat, Math.min(180, dLat / Math.max(0.05, Math.cos(lat * DEG)))) ?? null;
      return { site, ground: generateGround(this.engine.renderer, b, view.surfaceMat!.uniforms, site, this.engine.renderer.capabilities.getMaxAnisotropy(), real) };
    };
    // dry land wanted: when the aimed point is open sea, try a spiral of nearby spots (an ocean
    // world finds none and lands on the water)
    let { site, ground } = groundAt(aim.lat, aim.lon);
    if (!at && ground.water > 0.5) {
      const steps: Array<[number, number]> = [];
      for (const r of [3, 8, 16, 30]) for (let k = 0; k < 6; k++) steps.push([r * Math.cos((k / 6) * Math.PI * 2 + r), r * Math.sin((k / 6) * Math.PI * 2 + r)]);
      for (const [dlat, dlon] of steps) {
        const lat2 = Math.max(-85, Math.min(85, aim.lat + dlat));
        const lon2 = aim.lon + dlon / Math.max(0.2, Math.cos(lat2 * DEG));
        const cand = groundAt(lat2, lon2);
        if (cand.ground.water > 0.5) { cand.ground.dispose(); continue; }
        ground.dispose();
        ({ site, ground } = cand);
        break;
      }
    }
    const terrain = view.landAt(ground);
    // stand on open ground: of the spots within a few hundred metres, the one least walled in by
    // its surroundings (a crater floor or a gully would hide the whole horizon)
    let sx = 0, sz = 0, best = -Infinity;
    for (let zi = -15; zi <= 15; zi++) {
      for (let xi = -15; xi <= 15; xi++) {
        const x = xi * 0.016, z = zi * 0.016;
        const h = terrain.surfaceY(x, z);
        let wall = -Infinity;
        for (let k = 0; k < 8; k++) {
          const c = Math.cos(k * Math.PI / 4), s = Math.sin(k * Math.PI / 4);
          wall = Math.max(wall, terrain.surfaceY(x + c * 0.04, z + s * 0.04), terrain.surfaceY(x + c * 0.09, z + s * 0.09));
        }
        const score = h - wall - 0.02 * Math.hypot(x, z);
        if (score > best) { best = score; sx = x; sz = z; }
      }
    }
    // face the Sun if it is anywhere near the sky, else keep the heading we arrive with
    const siteWorld = new Vector3().copy(site.pos).applyQuaternion(b.rotation).add(b.position);
    const sunLocal = new Vector3().copy(this.universe.hostStar(b).position).sub(siteWorld).normalize().applyQuaternion(new Quaternion().copy(b.rotation).multiply(site.quat).invert());
    let yaw = Math.atan2(sunLocal.x, -sunLocal.z);
    if (sunLocal.y < -0.25) {
      const f = fwd.clone().applyQuaternion(new Quaternion().copy(b.rotation).multiply(site.quat).invert());
      if (Math.hypot(f.x, f.z) > 0.2) yaw = Math.atan2(f.x, -f.z);
    }
    const stand: SurfaceStand = {
      body: b, sitePos: site.pos, siteQuat: site.quat,
      ground: (x, z) => terrain.surfaceY(x, z),
      x: sx, z: sz, eye: CameraController.EYE_KM, yaw, pitch: 0.05, zoom: 1,
    };
    this.select(b);
    cam.land(stand);
    this.ui.showToast(_('{name} yüzeyine iniliyor…', { name: b.name }));
    if (!this.landingHintShown) {
      this.landingHintShown = true;
      window.setTimeout(() => {
        if (this.landedOn) this.ui.showToast(_('Yüzeydesiniz: fareyle bakın · W A S D yürü · tekerlek yakınlaştır · zamanı hızlandırıp gökyüzünü izleyin · I kalk'), 7000);
      }, 4000);
    }
  }
  private landingHintShown = false;
  /** sky brightness at the camera this frame (see skyDaylight) */
  daylight = 0;

  /** Leave the ground: back up to the orbit view of the body. */
  takeOff(): void {
    const b = this.landedOn;
    if (!b) return;
    const cam = this.camera;
    cam.surface = null;
    cam.mode = 'orbit';
    // climb straight up first so the ground falls away under us rather than sliding past
    const up = new Vector3().copy(cam.position).sub(b.position).normalize();
    const dur = 4.5;
    cam.goToVantage(b, up, b.radius * 3.6, dur, new Vector3().copy(b.pole));
    this.ui.showToast(_('Kalkış…'));
  }

  /** HUD line while on the ground: where we stand and the local solar time there. */
  surfaceStatus(): { place: string; clock: string } | null {
    const st = this.camera.surface;
    if (!st || this.camera.mode !== 'surface') return null;
    const { lat, lon } = this.camera.standLatLon(st);
    const b = st.body;
    const place = `${Math.abs(lat).toFixed(2)}° ${lat >= -0.005 ? _('K') : _('G')}, ${Math.abs(lon).toFixed(2)}° ${lon >= 0 ? _('D') : _('B')}`;
    // local solar time from the sub-solar longitude: noon where the Sun crosses the meridian
    _dir.copy(this.universe.hostStar(b).position).sub(b.position).applyQuaternion(this.tmpQ.copy(b.rotation).invert());
    const subsolar = Math.atan2(-_dir.z, _dir.x) / DEG;
    let h = 12 + (lon - subsolar) / 15;
    h = ((h % 24) + 24) % 24;
    const hh = Math.floor(h), mm = Math.floor((h - hh) * 60);
    return { place, clock: `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}` };
  }
  private readonly tmpQ = new Quaternion();
  private readonly standUp = new Vector3();

  /**
   * How bright the sky is where the camera stands (0 night / space … 1 full daylight inside a
   * dense atmosphere): the stars, the Milky Way and the galaxies are drowned accordingly.
   */
  private skyDaylight(camPos: Vector3): number {
    const b = this.camera.nearest;
    const atm = b?.data.atmosphere;
    if (!b || !atm || atm.density <= 0) return 0;
    const alt = Math.max(0, this.camera.altitude);
    const host = this.universe.hostStar(b);
    _up.copy(camPos).sub(b.position).normalize();
    _dir.copy(host.position).sub(camPos).normalize();
    const sinElev = _up.dot(_dir);
    // dusk: the Milky Way is gone before the Sun is 12° down, the last stars at about −6°
    let day = smooth01((sinElev + 0.21) / 0.24);
    // under a permanent overcast (Venus, Titan) the stars never show
    if (atm.density >= 1.5) day = Math.max(day, 0.9);
    const thin = Math.exp(-alt / Math.max(b.radius * atm.height * 0.25, 1));
    // far from the Sun the air is lit too faintly to drown the stars (Pluto's noon is a deep dusk)
    // (scaled by the host's luminosity: a dim red dwarf's noon is faint at 1 AU already)
    const dAU = b.position.distanceTo(host.position) / AU_KM;
    const faint = Math.min(1, (100 * this.hostLuminosity(host)) / Math.max(dAU * dAU, 1));
    return Math.min(1, atm.density * 3) * day * thin * faint;
  }

  /** Interstellar travel: switch the reference frame to the target system, then autopilot to its star. */
  goToStar(id: StarId): void {
    const u = this.universe;
    if (id === u.current.starId) {
      this.goTo(u.star);
      return;
    }
    const delta = u.switchTo(id, this.time.jd, this.time.t);
    this.camera.shiftFrame(delta, u.star);
    this.select(u.star);
    this.camera.goTo(u.star, u.star.position);
    this.ui.showToast(_('{name} sistemine uçuluyor… ({dist})', { name: u.star.name, dist: fmtLightYears(delta.length()) }), 2600);
  }

  /** Intergalactic travel: fly to a vantage point ~2.5 radii from the galaxy centre, above its disc. */
  goToGalaxy(i: number): void {
    const u = this.universe;
    this.selectGalaxy(i);
    const g = u.galaxies;
    const centre = u.galaxyRelative(i, new Vector3(0, 0, 0)); // km, current frame
    const R = g.radius[i] * PARSEC_KM;
    const fromCam = new Vector3().copy(this.camera.position).sub(centre).normalize();
    const normal = new Vector3(g.normal[i * 3], g.normal[i * 3 + 1], g.normal[i * 3 + 2]);
    if (fromCam.dot(normal) < 0) normal.negate();
    const approach = fromCam.lerp(normal, 0.55).normalize();
    // arrive in orbit around the centre; the wheel may descend deep into the galaxy
    this.camera.goToPoint(centre, R * 2.6, approach, { radius: R * 0.02, name: g.name(i) });
    const dist = new Vector3().copy(centre).sub(this.camera.position).length();
    this.ui.showToast(_('{name} galaksisine uçuluyor… ({dist})', { name: g.name(i), dist: fmtLightYears(dist) }), 2600);
  }

  center(b: CelestialBody): void {
    this.select(b);
    this.camera.centerOn(b);
  }

  centerStar(id: StarId): void {
    this.selectStar(id);
    const dir = this.universe.starRelative(id, this.camera.position).normalize();
    this.camera.centerOnDirection(dir);
  }

  centerGalaxy(i: number): void {
    this.selectGalaxy(i);
    const dir = this.universe.galaxyRelative(i, this.camera.position).normalize();
    this.camera.centerOnDirection(dir);
  }

  starApparentMag(id: StarId): number | null {
    const ci = catalogIndexOf(id);
    return ci >= 0 ? this.starPoints.apparentMag(ci) : isMemberId(id) ? this.clusterPoints.apparentMag(id) : this.procPoints.apparentMag(id);
  }

  get freeRoam(): boolean {
    return this.input.locked;
  }

  /**
   * Free roam: the pointer is captured so the mouse steers directly (no dragging), WASD/RF fly,
   * Q/E roll, wheel changes speed. Clicking selects whatever is under the crosshair.
   */
  toggleFreeRoam(): void {
    if (this.input.locked) {
      this.input.unlockPointer();
      return;
    }
    if (this.landedOn) {
      // on foot the pointer lock just means mouse look without holding a button
      this.input.lockPointer();
      return;
    }
    this.camera.autopilot = null;
    this.camera.setMode('free');
    this.input.lockPointer();
  }

  private onLockChange(locked: boolean): void {
    this.overlay.crosshair = locked;
    if (locked) {
      this.ui.showToast(_('Serbest dolaşım: fare ile bak · W A S D uç · R F yukarı/aşağı · Q E yatış · tekerlek hız · Esc çık'), 4200);
    } else {
      this.ui.showToast(_('Serbest dolaşım kapatıldı'));
    }
  }

  /** Fly to a black hole: switch to its system's frame first, then autopilot to the hole itself. */
  goToBlackHole(id: string): void {
    const u = this.universe;
    const bh = u.blackHole(id);
    if (!bh) { this.ui.showToast(_('Kara delik bulunamadı')); return; }
    if (bh.systemStarId !== u.current.starId) {
      const delta = u.switchTo(bh.systemStarId, this.time.jd, this.time.t);
      this.camera.shiftFrame(delta, u.star);
    }
    const body = u.get(bh.entry.bodyId);
    if (!body) { this.ui.showToast(_('Kara delik bulunamadı')); return; }
    this.select(body);
    this.camera.goTo(body, u.hostStar(body).position);
    const dist = body.position.distanceTo(this.camera.position);
    this.ui.showToast(_('{name} kara deliğine uçuluyor… ({dist})', { name: body.name, dist: fmtLightYears(dist) }), 2600);
  }

  /** Point the camera at a black hole (no travel). */
  centerBlackHole(id: string): void {
    const u = this.universe;
    const bh = u.blackHole(id);
    if (!bh) return;
    const body = bh.systemStarId === u.current.starId ? u.get(bh.entry.bodyId) : null;
    if (body) { this.center(body); return; }
    this.selectStar(bh.systemStarId);
    const dir = u.starRelative(bh.systemStarId, this.camera.position).normalize();
    this.camera.centerOnDirection(dir);
  }

  goToBodyId(id: string): void {
    this.goToSystemBody('c0', id);
  }

  /* ---------------- streamer-mode expedition ---------------- */

  /** Catalogue index of the star named exactly `name` (search is fuzzy: "Ran" also finds Rana). */
  private starNamed(name: string): number | null {
    const c = this.universe.catalog;
    const hits = c.search(name, 5);
    return hits.find((i) => c.nameOf(i) === name) ?? hits[0] ?? null;
  }

  hasStar(name: string): boolean {
    return this.starNamed(name) !== null;
  }

  hasLandmark(id: string): boolean {
    return !!this.universe.landmark(id);
  }

  /** Fly into the system of the star named `name`; returns the star's body id. */
  flyToStarNamed(name: string): string | null {
    const i = this.starNamed(name);
    if (i === null) return null;
    this.goToStar(`c${i}`);
    return this.universe.star.id;
  }

  /** The star's body id when we are already in its system, otherwise null. */
  starBodyIn(name: string): string | null {
    const i = this.starNamed(name);
    return i !== null && this.universe.current.starId === `c${i}` ? this.universe.star.id : null;
  }

  /** Back to the Sun's frame (no flight) so Solar System bodies resolve again. */
  goHome(): void {
    const u = this.universe;
    if (u.current.starId === 'c0') return;
    const delta = u.switchTo('c0', this.time.jd, this.time.t);
    this.camera.shiftFrame(delta, u.star);
  }

  /** Stop `radii` landmark radii from a nebula / cluster, the approach swung `swing`° around it. */
  goToLandmarkAt(id: string, radii: number, swing: number): boolean {
    const u = this.universe;
    const l = u.landmark(id);
    if (!l) return false;
    const i = u.landmarks.indexOf(l);
    this.selectLandmark(i);
    const centre = u.landmarkRelative(i, new Vector3(0, 0, 0));
    const R = l.def.radiusPc * PARSEC_KM;
    const from = new Vector3().copy(this.camera.position).sub(centre).normalize();
    const side = new Vector3().crossVectors(from, Math.abs(from.z) < 0.9 ? new Vector3(0, 0, 1) : new Vector3(1, 0, 0)).normalize();
    const dir = from.multiplyScalar(Math.cos(swing * DEG)).addScaledVector(side, Math.sin(swing * DEG)).normalize();
    this.camera.goToPoint(centre, R * radii, dir, { radius: R * 0.3, name: _(l.def.name) });
    return true;
  }

  /** Galaxy by catalogue name fragment, or `#i` (`#0` = the Milky Way). */
  private galaxyNamed(ref: string): number | null {
    if (ref.startsWith('#')) return parseInt(ref.slice(1), 10);
    const g = this.universe.galaxies;
    for (let i = 1; i < g.catalogCount; i++) if (g.rawName(i).includes(ref)) return i;
    return null;
  }

  hasGalaxy(ref: string): boolean {
    return this.galaxyNamed(ref) !== null;
  }

  hasBlackHole(id: string): boolean {
    return !!this.universe.blackHole(id);
  }

  /** The black hole's body id when we are already in its system, otherwise null. */
  blackHoleBody(id: string): string | null {
    const bh = this.universe.blackHole(id);
    return bh && bh.systemStarId === this.universe.current.starId ? bh.entry.bodyId : null;
  }

  /** Stop `radii` galaxy radii from its centre, above the disc, the approach swung `swing`° around it. */
  goToGalaxyAt(ref: string, radii: number, swing: number): boolean {
    const i = this.galaxyNamed(ref);
    if (i === null) return false;
    const u = this.universe;
    const g = u.galaxies;
    this.selectGalaxy(i);
    const centre = u.galaxyRelative(i, new Vector3(0, 0, 0));
    const R = g.radius[i] * PARSEC_KM;
    const normal = new Vector3(g.normal[i * 3], g.normal[i * 3 + 1], g.normal[i * 3 + 2]);
    const from = new Vector3().copy(this.camera.position).sub(centre);
    if (from.lengthSq() === 0) from.copy(normal);
    from.normalize();
    if (from.dot(normal) < 0) normal.negate();
    const base = from.lerp(normal, 0.55).normalize();
    const side = new Vector3().crossVectors(normal, base);
    if (side.lengthSq() < 1e-6) side.crossVectors(normal, new Vector3(1, 0, 0));
    side.normalize();
    const dir = base.multiplyScalar(Math.cos(swing * DEG)).addScaledVector(side, Math.sin(swing * DEG)).normalize();
    this.camera.goToPoint(centre, R * radii, dir, { radius: R * 0.02, name: g.name(i) });
    return true;
  }

  /**
   * Pull back `distPc` from the Sun, above the galactic plane and leaning away from the galactic
   * centre by `lean`°, looking home: the scale shots (our arm, the Local Group, the cosmic web).
   * With `aim` (a galaxy) the camera looks at the midpoint between home and that galaxy instead,
   * from across the line joining them, so both are in frame.
   */
  goToVista(distPc: number, lean: number, name: string, aim?: string): void {
    const u = this.universe;
    const sun = u.starRelative('c0', new Vector3(0, 0, 0));
    const north = raDecToScene(192.859, 27.128, new Vector3());
    const gc = raDecToScene(266.405, -28.936, new Vector3());
    const gi = aim ? this.galaxyNamed(aim) : null;
    this.selectGalaxy(gi);
    let centre = sun;
    let dir: Vector3;
    if (gi === null) {
      dir = north.multiplyScalar(Math.cos(lean * DEG)).addScaledVector(gc, -Math.sin(lean * DEG)).normalize();
    } else {
      const g = u.galaxyRelative(gi, new Vector3(0, 0, 0));
      const axis = new Vector3().copy(g).sub(sun).normalize();
      const up = north.addScaledVector(axis, -north.dot(axis)).normalize();
      const side = new Vector3().crossVectors(axis, up);
      centre = sun.add(g).multiplyScalar(0.5);
      dir = up.multiplyScalar(Math.cos(lean * DEG)).addScaledVector(side, Math.sin(lean * DEG)).normalize();
    }
    const D = distPc * PARSEC_KM;
    this.camera.goToPoint(centre, D, dir, { radius: D * 0.02, name });
  }

  /** The autopilot leg in progress: km still to go to its arrival distance, seconds left. */
  flightTelemetry(): { remainingKm: number; etaS: number } | null {
    const ap = this.camera.autopilot;
    if (!ap || (ap.kind !== 'goto' && ap.kind !== 'gotoPoint')) return null;
    const at = ap.point ?? ap.target?.position;
    if (!at) return null;
    return { remainingKm: Math.max(0, this.camera.position.distanceTo(at) - ap.dist1), etaS: Math.max(0, ap.duration - ap.t) };
  }

  /**
   * Inside a galaxy cluster: `distPc` from the centroid of its catalogued `members`, on our
   * side of it, swung `swing`° around the line of sight so the members spread around the frame.
   */
  goToCluster(members: string[], distPc: number, swing: number, name: string): boolean {
    const u = this.universe;
    const idx = members.map((m) => this.galaxyNamed(m)).filter((i): i is number => i !== null);
    if (!idx.length) return false;
    this.selectGalaxy(null);
    const centre = new Vector3();
    for (const i of idx) centre.add(u.galaxyRelative(i, new Vector3(0, 0, 0)));
    centre.divideScalar(idx.length);
    const sun = u.starRelative('c0', new Vector3(0, 0, 0));
    const axis = sun.sub(centre).normalize();
    const north = raDecToScene(192.859, 27.128, new Vector3());
    const up = north.addScaledVector(axis, -north.dot(axis)).normalize();
    const dir = axis.multiplyScalar(Math.cos(swing * DEG)).addScaledVector(up, Math.sin(swing * DEG)).normalize();
    const D = distPc * PARSEC_KM;
    this.camera.goToPoint(centre, D, dir, { radius: D * 0.02, name });
    return true;
  }

  /* ---------------- tour cues ---------------- */

  /** Planets, moons and small bodies get the backlit tour composition (Sun over the limb). */
  private static backlitKind(b: CelestialBody): boolean {
    const t = b.data.type;
    return (t === 'planet' || t === 'dwarf' || t === 'moon' || t === 'asteroid' || t === 'comet') && b.data.orbit?.kind !== 'surface';
  }

  /** Tour step arrival: like goTo, but worlds are framed with the Sun in the sky behind them. */
  goToTourBody(id: string): void {
    const u = this.universe;
    if (u.current.starId !== 'c0') {
      const delta = u.switchTo('c0', this.time.jd, this.time.t);
      this.camera.shiftFrame(delta, u.star);
    }
    const b = u.get(id);
    if (!b) { this.ui.showToast(_('Hedef bulunamadı')); return; }
    if (b.data.orbit?.kind === 'ephemeris') void ephemeris.prioritize(b.data.orbit.table);
    this.select(b);
    if (App.backlitKind(b)) this.camera.goToBacklit(b, u.hostStar(b).position);
    else this.camera.goTo(b, u.hostStar(b).position);
    this.ui.showToast(_('{name} hedefine uçuluyor…', { name: b.name }));
  }

  /** Pull back above `bodyId`'s orbit around its parent so the whole orbit is in view. */
  goToOverview(bodyId: string, seconds = TOUR_HOP_S): void {
    const b = this.universe.get(bodyId);
    const p = b?.parent;
    if (!b || !p) return;
    const a = b.resolved?.a ?? b.localPosition.length();
    // ~70° above the orbital plane, leaning away from the body so it sits on the far side of
    // the orbit — the upper half of the frame, clear of the subtitles; 2.7 a keeps the whole
    // orbit inside a ~50° field of view
    const toBody = new Vector3().copy(b.position).sub(p.position).normalize();
    const normal = new Vector3().copy(b.orbitNormal);
    if (normal.lengthSq() < 1e-6) normal.copy(p.pole);
    // ~70° above the plane on the body's side: the flight swings up from the body without ever
    // passing over the pole (looking straight down the "up" axis would flip the frame mid-flight)
    const dir = new Vector3().copy(normal).addScaledVector(toBody, 0.35).normalize();
    this.select(b);
    // roll: screen-up toward the body's side of the orbit, tilted 40° below the plane so it is
    // never parallel to the line of sight along the way; otherwise the roll inherited from the
    // previous shot (e.g. a retrograde comet seen from the south) can leave the frame upside down
    const up = new Vector3().copy(toBody).multiplyScalar(Math.cos(40 * DEG)).addScaledVector(normal, -Math.sin(40 * DEG));
    this.camera.goToVantage(p, dir, Math.max(a * 2.7, p.radius * 6), seconds, up);
  }

  /** Hop back to `bodyId` after an overview/pin cue (quick flight, no toast). */
  returnTo(bodyId: string): void {
    const b = this.universe.get(bodyId);
    if (!b) return;
    this.select(b);
    if (App.backlitKind(b)) this.camera.goToBacklit(b, this.universe.hostStar(b).position, TOUR_HOP_S);
    else this.camera.goTo(b, this.universe.hostStar(b).position, TOUR_HOP_S);
  }

  /** Camera `elev`° above the equator plane, `az`° around the pole from the noon meridian, `dist` radii out. */
  goToVantageOf(bodyId: string, elev: number, az: number, dist: number, seconds = TOUR_HOP_S * 1.5, inside = false): void {
    const b = this.universe.get(bodyId);
    if (!b) return;
    const noon = this.noonDirection(b, new Vector3());
    const east = new Vector3().crossVectors(b.pole, noon).normalize();
    const ce = Math.cos(elev * DEG);
    const dir = new Vector3()
      .addScaledVector(noon, ce * Math.cos(az * DEG))
      .addScaledVector(east, ce * Math.sin(az * DEG))
      .addScaledVector(b.pole, Math.sin(elev * DEG))
      .normalize();
    const minD = b.data.rings && !inside ? Math.max(b.radius * dist, b.data.rings.outer * 1.15) : b.radius * dist;
    this.select(b);
    // on a surface the horizon must end up level: roll to the local vertical
    this.camera.goToVantage(b, dir, minD, seconds, b.data.orbit?.kind === 'surface' ? b.pole : undefined);
  }

  goToLimb(bodyId: string, elev: number, az: number, dist: number, aimR: number, aimAz: number, seconds = TOUR_HOP_S * 1.5): void {
    const b = this.universe.get(bodyId);
    if (!b) return;
    const noon = this.noonDirection(b, new Vector3());
    const east = new Vector3().crossVectors(b.pole, noon).normalize();
    const around = (deg: number, out: Vector3) => out.copy(noon).multiplyScalar(Math.cos(deg * DEG)).addScaledVector(east, Math.sin(deg * DEG));
    const R = b.radius;
    const pos = around(az, new Vector3()).multiplyScalar(dist * R * Math.cos(elev * DEG)).addScaledVector(b.pole, dist * R * Math.sin(elev * DEG));
    const look = around(az + aimAz, new Vector3()).multiplyScalar(aimR * R);
    // world → the body's object frame, frozen there (spin: false) so the shot holds while time runs
    const inv = new Quaternion().copy(b.rotation).invert();
    this.select(b);
    this.camera.goToPose(b, pos.applyQuaternion(inv), look.applyQuaternion(inv), b.pole.clone().applyQuaternion(inv), seconds, { spin: false });
  }

  /**
   * Over-the-shoulder shot: camera `dist` radii from `refId` on the side facing away from
   * `towardId`, so the latter fills the background; `az`/`elev` (degrees) swing it off that axis
   * (az around ecliptic north, elev toward it) so the subject does not hide its backdrop.
   */
  goToShot(refId: string, towardId: string, dist: number, az: number, elev: number, seconds = TOUR_HOP_S * 1.5): void {
    const ref = this.universe.get(refId), toward = this.universe.get(towardId);
    if (!ref || !toward) return;
    const away = new Vector3().copy(ref.position).sub(toward.position).normalize();
    if (away.lengthSq() < 0.5) away.set(1, 0, 0);
    // screen-up: ecliptic north made perpendicular to the line of sight
    const up = new Vector3(0, 1, 0).addScaledVector(away, -away.y);
    if (up.lengthSq() < 1e-6) up.set(1, 0, 0).addScaledVector(away, -away.x);
    up.normalize();
    const right = new Vector3().crossVectors(away, up).normalize();
    const ce = Math.cos(elev * DEG);
    const dir = new Vector3()
      .addScaledVector(away, ce * Math.cos(az * DEG))
      .addScaledVector(right, ce * Math.sin(az * DEG))
      .addScaledVector(up, Math.sin(elev * DEG))
      .normalize();
    if (ref.data.orbit?.kind === 'ephemeris') void ephemeris.prioritize(ref.data.orbit.table);
    this.select(ref);
    this.camera.goToVantage(ref, dir, ref.radius * dist, seconds, up);
  }

  currentFov(): number {
    return this.tourOverrides.fov ?? this.settings.fov;
  }

  setClock(d: Date): void {
    this.time.setDate(d);
    this.universe.update(this.time.jd, this.time.t);
  }

  /** Unit vector from `b` toward the Sun, projected onto its equator plane (the sub-solar meridian). */
  private noonDirection(b: CelestialBody, out: Vector3): Vector3 {
    const star = this.universe.hostStar(b);
    if (star === b) {
      const e = this.universe.get('earth');
      out.copy(e ? e.position : new Vector3(1, 0, 0)).sub(b.position);
    } else out.copy(star.position).sub(b.position);
    out.addScaledVector(b.pole, -out.dot(b.pole));
    if (out.lengthSq() < 1e-6) out.set(1, 0, 0).addScaledVector(b.pole, -b.pole.x);
    return out.normalize();
  }

  setComparison(refId: string | null, besideId?: string, shoulder = false): void {
    if (this.ghost) {
      if (!refId) {
        // fade out; the body is removed once it has gone dark (see the frame loop)
        this.ghost.leaving = true;
        return;
      }
      this.dropGhost();
    }
    if (!refId || !besideId) return;
    const ref = this.universe.get(refId);
    const beside = this.universe.get(besideId);
    if (!ref || !beside || ref === beside) return;
    // a detached copy: same appearance and radius, no orbit, positioned by hand every frame
    const body = new CelestialBody({ ...ref.data, id: 'tour-ghost', orbit: undefined });
    body.pole.copy(ref.pole);
    body.rotation.copy(ref.rotation);
    const cam = this.camera;
    const side = shoulder ? new Vector3(1, 0, 0).applyQuaternion(cam.quaternion) : null;
    this.ghost = { body, ref, beside, alpha: 0, leaving: false, side };
    this.placeGhost();
    this.bodies.addBody(body, this.universe.current);
    this.points.setViews(this.bodies.views);
    if (side) { this.shoulderOnGhost(); return; }
    // back off until both fit side by side (≈ 60 % of a ~70° horizontal field)
    const width = 2 * this.ghostAnchorRadius(beside) + 2.7 * ref.radius;
    const need = width * 1.25;
    const ap = cam.autopilot;
    if (ap && ap.kind === 'goto' && ap.target === beside) {
      // still on the way in: just stop the approach further out
      ap.dist1 = Math.max(ap.dist1, need);
      return;
    }
    const cur = cam.position.distanceTo(beside.position);
    if (need > cur * 1.05) {
      const dir = new Vector3().copy(cam.position).sub(beside.position).normalize();
      cam.goToVantage(beside, dir, need, TOUR_HOP_S);
    }
  }

  /**
   * Over-the-shoulder comparison: the copy (e.g. Earth beside the Sun, where at true scale and a
   * distance that fits the Sun it would be a speck lost in the glare) is approached to ~22 of
   * its radii, swung round until a clear gap of sky separates it from the anchor's limb. The
   * anchor then fills one side of the frame behind it.
   */
  private shoulderOnGhost(): void {
    const g = this.ghost!;
    const side = g.side!;
    const P = g.body.position, S = g.beside.position;
    const Ra = this.ghostAnchorRadius(g.beside), Rr = g.ref.radius;
    // the side we look from: the current view direction, made perpendicular to the pair
    const v = new Vector3().copy(this.camera.position).sub(S);
    v.addScaledVector(side, -v.dot(side));
    if (v.lengthSq() < 1e-6) v.set(0, 1, 0).addScaledVector(side, -side.y);
    v.normalize();
    const d = Rr * 22;
    const dir = new Vector3(), C = new Vector3(), toS = new Vector3(), toP = new Vector3();
    const ghostAng = Math.asin(Math.min(1, Rr / d));
    // swing either way (the clear side depends on where we came from), keeping off the anchor
    let best = -Infinity;
    const pick = new Vector3().copy(v);
    for (let i = 0; i <= 80; i++) {
      const deg = (i % 2 ? -1 : 1) * Math.ceil(i / 2) * 2;
      dir.copy(v).multiplyScalar(Math.cos(deg * DEG)).addScaledVector(side, Math.sin(deg * DEG));
      C.copy(P).addScaledVector(dir, d);
      toS.copy(S).sub(C);
      toP.copy(P).sub(C).normalize();
      const sDist = toS.length();
      if (sDist < Ra * 1.12) continue;
      const gap = Math.acos(Math.min(1, Math.max(-1, toS.normalize().dot(toP)))) - Math.asin(Math.min(1, Ra / sDist)) - ghostAng;
      if (gap >= ghostAng * 5) { pick.copy(dir); break; }
      if (gap > best) { best = gap; pick.copy(dir); }
    }
    dir.copy(pick);
    const up = new Vector3(0, 1, 0).applyQuaternion(this.camera.quaternion);
    this.camera.goToVantage(g.body, dir, d, TOUR_HOP_S * 1.4, up);
  }

  private ghostAnchorRadius(b: CelestialBody): number {
    return b.data.rings ? Math.max(b.radius, b.data.rings.outer) : b.radius;
  }

  private dropGhost(): void {
    if (!this.ghost) return;
    this.bodies.removeBody(this.ghost.body.id);
    this.points.setViews(this.bodies.views);
    this.ghost = null;
  }

  /** Fade the comparison body in over ~1.2 s, out over ~0.8 s, and drop it once invisible. */
  private updateGhost(dt: number): void {
    const g = this.ghost;
    if (!g) return;
    if (g.leaving) {
      g.alpha -= dt / 0.8;
      if (g.alpha <= 0) { this.dropGhost(); return; }
    } else g.alpha = Math.min(1, g.alpha + dt / 1.2);
    this.placeGhost();
  }

  /**
   * Keep the comparison body at the screen-right of its anchor, at the anchor's distance from the
   * camera and just clear of its limb (a near sphere looks wider than its radius: placing the copy
   * one radius out would sink it into the disc), spinning like the original. In a shoulder shot
   * it stays put in space instead, a small gap off the anchor's surface.
   */
  private placeGhost(): void {
    const g = this.ghost;
    if (!g) return;
    const Ra = this.ghostAnchorRadius(g.beside), Rr = g.ref.radius;
    if (g.side) {
      g.body.position.copy(g.beside.position).addScaledVector(g.side, Ra * 1.08 + Rr);
    } else {
      const cam = this.camera.position;
      const toA = _dir.copy(g.beside.position).sub(cam);
      const d = toA.length();
      const right = new Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
      if (d <= Ra * 1.02) {
        g.body.position.copy(g.beside.position).addScaledVector(right, Ra + Rr * 1.35);
      } else {
        toA.multiplyScalar(1 / d);
        const ang = Math.asin(Ra / d) + 1.6 * Math.asin(Math.min(1, Rr / d));
        const axis = _up.crossVectors(toA, right).normalize();
        const q = this.tmpQ.setFromAxisAngle(axis, ang);
        g.body.position.copy(toA.applyQuaternion(q)).multiplyScalar(d).add(cam);
      }
    }
    g.body.rotation.copy(g.ref.rotation);
    g.body.pole.copy(g.ref.pole);
    g.body.distanceToStar = g.body.position.distanceTo(this.universe.hostStar(g.ref).position);
  }

  /**
   * Tour postcard: raise the shield volcano's relief and glide down to a telephoto view of it —
   * the camera `dist` km from the summit, `alt` km above the ground, a little off the Sun's
   * bearing so the flanks are side-lit, looking across the horizon at the upper slopes.
   */
  setPostcard(p: { ref: string; lat: number; lon: number; relief: string; peak: number; scale: number; dist: number; alt: number; fov?: number; seconds?: number } | null): void {
    if (!p) { this.relief?.hide(); return; }
    const b = this.universe.get(p.ref);
    if (!b) return;
    const dir = b.surfaceDirection(p.lat, p.lon, new Vector3());
    // mid-morning: a side-lit mountain under a Sun ~35° up in the east
    this.bringIntoDaylight(b, dir, 50);
    this.relief ??= new Relief(this.engine.scene);
    const ground = this.relief.show({ body: b, source: p.relief, scale: p.scale });
    // body frame: summit, local vertical, the Sun's bearing in the tangent plane
    const site = groundSite(b, p.lat, p.lon);
    const up = site.up.clone();
    const inv = new Quaternion().copy(b.rotation).invert();
    const sun = new Vector3().copy(this.universe.hostStar(b).position).sub(b.position).applyQuaternion(inv);
    sun.addScaledVector(up, -sun.dot(up));
    if (sun.lengthSq() < 1e-6) sun.copy(site.east);
    sun.normalize();
    const across = new Vector3().crossVectors(up, sun);
    // swing off the Sun's bearing toward the equator (Olympus: the smooth plains to the south-east,
    // clear of the aureole's ridged lobes to the north and west)
    const bearing = 55 * DEG * (across.y * Math.sign(p.lat || 1) > 0 ? -1 : 1);
    const h = sun.multiplyScalar(Math.cos(bearing)).addScaledVector(across, Math.sin(bearing)).normalize();
    // great-circle step from the summit to the viewpoint
    const R = site.pos.length();
    const q = new Quaternion().setFromAxisAngle(new Vector3().crossVectors(up, h).normalize(), p.dist / R);
    const camUp = up.clone().applyQuaternion(q);
    const camPos = camUp.clone().multiplyScalar(R + p.alt);
    const summit = Relief.summit(b, p.lat, p.lon, p.peak, p.scale, new Vector3());
    // aim a little below the summit: the mountain stands in the upper part of the frame
    const look = site.pos.clone().addScaledVector(up, summit.distanceTo(site.pos) * 0.35);
    this.select(b);
    this.camera.goToPose(b, camPos, look, camUp, p.seconds ?? 6, { descend: true });
    // the viewpoint stands on the relief: once its heights are in, lift the end of the flight
    // (or the camera, if already there) onto that ground
    const ap = this.camera.autopilot;
    void ground.then((groundAt) => {
      const lift = groundAt(camPos);
      if (lift <= 0) return;
      if (this.camera.autopilot === ap && ap?.pose) ap.pose.pos.addScaledVector(camUp, lift);
      else if (!this.camera.autopilot && this.camera.reference === b) this.camera.position.addScaledVector(camUp.clone().applyQuaternion(b.rotation), lift);
    }).catch(() => {});
  }

  setPulse(p: { from: string; to: string; seconds: number } | null): void {
    if (!p) { this.pulse?.stop(); return; }
    const a = this.universe.get(p.from);
    const b = this.universe.get(p.to);
    if (!a || !b) return;
    this.pulse ??= new LightPulse(this.engine.scene);
    this.pulse.start(a, b, p.seconds);
  }

  setMeteors(m: { ref: string; ra: number; dec: number; speed: number; rate: number; fireballs?: number; approach?: boolean; seconds?: number } | null): void {
    if (!m) { this.meteors?.stop(); return; }
    const b = this.universe.get(m.ref);
    if (!b) return;
    const radiant = raDecToScene(m.ra, m.dec);
    this.meteors ??= new MeteorShower(this.engine.scene);
    this.meteors.start(b, { radiant, speed: m.speed, rate: m.rate, fireballs: m.fireballs });
    if (!m.approach) return;
    // Viewing spot: the streaks all fly away from the radiant, so stand roughly side-on to them
    // (perpendicular to the radiant), on the night side so they burn against a dark globe, and a
    // little toward the radiant and the pole so the hemisphere being hit faces us.
    const night = this.noonDirection(b, new Vector3()).negate();
    const side = new Vector3().copy(night).addScaledVector(radiant, -night.dot(radiant));
    if (side.lengthSq() < 0.05) side.copy(b.pole).addScaledVector(radiant, -b.pole.dot(radiant));
    side.normalize();
    const dir = new Vector3().copy(side).addScaledVector(radiant, 0.35).addScaledVector(b.pole, 0.3).normalize();
    const up = new Vector3().copy(b.pole).addScaledVector(dir, -b.pole.dot(dir)).normalize();
    this.select(b);
    this.camera.goToVantage(b, dir, b.radius * 2.7, m.seconds ?? TOUR_HOP_S * 2.5, up);
  }

  /** Fly in above a surface point (lat/lon, degrees) of `bodyId`, looking down at it. */
  goToSurface(bodyId: string, lat: number, lon: number, storm = false): void {
    const b = this.universe.get(bodyId);
    if (!b) return;
    const dir = this.pinDirection(b, lat, lon, storm, new Vector3());
    this.bringIntoDaylight(b, dir);
    // Stand a little south and screen-left of the feature so, looking at the body's centre, the pin
    // lands in the upper right of the screen, clear of the info panel and the tour bar.
    // (camera up ≈ pole, so screen-right = forward × pole = pole × camDir; we move the opposite way)
    const south = new Vector3().copy(b.pole).addScaledVector(dir, -b.pole.dot(dir)).multiplyScalar(-1);
    const left = new Vector3().crossVectors(dir, b.pole);
    if (left.lengthSq() < 1e-4) {
      // polar feature: any tangent will do — lean toward the Sun so the area is lit
      left.copy(this.universe.hostStar(b).position).sub(b.position).normalize();
      left.addScaledVector(dir, -left.dot(dir)).normalize();
    } else left.normalize();
    const camDir = dir.clone().addScaledVector(south, 0.18).addScaledVector(left, 0.26).normalize();
    this.select(b);
    this.camera.goToVantage(b, camDir, b.radius * 1.9);
  }

  /**
   * If the surface point `dir` is in the dark, advance the clock by less than one rotation so the
   * Sun is high over it (tours already fast-forward time; a feature in the night is useless).
   * `dir` is rotated in place to where it will be after the jump.
   */
  private bringIntoDaylight(b: CelestialBody, dir: Vector3, morningDeg?: number): void {
    // tidally locked moons spin once per orbit (prograde about the pole): the Sun sweeps their
    // surface once per orbital period, so the same jump logic applies with that period
    const spinS = b.data.rotationPeriod === 'sync' ? b.periodDays * DAY_S : b.rotationPeriodS;
    if (!spinS || !Number.isFinite(spinS) || b.data.type === 'star') return;
    const toSun = new Vector3().copy(this.universe.hostStar(b).position).sub(b.position).normalize();
    // `morningDeg`: always go to that hour angle before noon (the sub-solar meridian that far east)
    if (morningDeg === undefined && dir.dot(toSun) > 0.5) return; // Sun already more than 30° up
    const sunT = toSun.clone().addScaledVector(b.pole, -toSun.dot(b.pole));
    const dirT = dir.clone().addScaledVector(b.pole, -dir.dot(b.pole));
    if (sunT.lengthSq() < 1e-6 || dirT.lengthSq() < 1e-6) return; // polar: no rotation helps
    sunT.normalize(); dirT.normalize();
    // signed angle from the feature to the sub-solar meridian about the pole (spin is +about pole)
    const phi = Math.atan2(b.pole.dot(new Vector3().crossVectors(dirT, sunT)), dirT.dot(sunT));
    const omega = (2 * Math.PI) / spinS;
    let dt = (phi - (morningDeg ?? 0) * DEG * Math.sign(omega)) / omega;
    const period = Math.abs(spinS);
    while (dt < 0) dt += period;
    this.time.jump(dt);
    dir.applyQuaternion(new Quaternion().setFromAxisAngle(b.pole, omega * dt));
  }

  /**
   * While a tour pin is shown and the camera has settled, keep the feature in the upper right of
   * the view — clear of the info panel, the tour bar and the corner card — whatever roll the
   * camera ended the flight with. Eased, and suspended while the user is dragging.
   */
  private aimAtPin(dt: number, fovRad: number, aspect: number): void {
    const pin = this.surfacePin;
    const cam = this.camera;
    if (!pin || cam.autopilot || this.input.dragging || !this.tours.state.tour || this.tours.state.paused) return;
    const b = this.universe.get(pin.bodyId);
    if (!b || cam.target !== b) return;
    // the feature's direction in camera space
    const d = this.pinPoint(b, pin.lat, pin.lon, pin.storm ?? false, this.aimDir).sub(cam.position).normalize();
    d.applyQuaternion(this.aimQ.copy(cam.quaternion).invert());
    if (d.z > -0.3) return; // off to the side or behind: not ours to fix
    // where it should sit: a fixed fraction of the half-field to the right and up
    const th = Math.tan(fovRad / 2);
    const t = this.aimTarget.set(th * aspect * 0.2, th * 0.26, -1).normalize();
    if (d.distanceToSquared(t) < 1e-6) return;
    // rotating the camera by R (local) moves the feature from d to R⁻¹·d; we need R⁻¹·d = t
    this.aimQ.setFromUnitVectors(t, d);
    this.aimEase.identity().slerp(this.aimQ, Math.min(1, dt * 3.5));
    cam.quaternion.multiply(this.aimEase);
  }
  private readonly aimDir = new Vector3();
  private readonly aimTarget = new Vector3();

  /**
   * Work light: whatever brought the camera here — free flight, Go, a tour or a lesson — a body
   * we are close to has its shadows lifted to near-noon over ~2 s (backlit compositions and
   * Mercury's / Venus's slow days would otherwise leave it black), fading back down as we
   * leave. Tours add their comparison copy and any pinned body, and may opt a shot out.
   */
  private updateFill(dt: number): void {
    const want = this.fillWant;
    want.clear();
    const cam = this.camera;
    const star = this.universe.star;
    const touring = this.tours.state.tour !== null || this.lessons.active;
    const skip = touring && this.tourOverrides.fill === false ? cam.target : null;
    // (the world under our feet keeps the same lamp as from orbit: the night is dark, not black)
    for (const b of this.universe.current.bodies) {
      if (b === star || b === skip || b.data.type === 'star' || b.data.type === 'barycenter' || b.data.type === 'blackhole') continue;
      // spacecraft and small rocks: a floor on the reach so a few hundred metres count as close
      if (cam.position.distanceTo(b.position) < Math.max(b.radius * NEAR_LIGHT_RADII, 5)) want.add(b.id);
    }
    this.fillFull.clear();
    if (touring) {
      if (this.ghost && !this.ghost.leaving) {
        want.add(this.ghost.body.id); this.fillFull.add(this.ghost.body.id);
        // the camera backs off to fit the pair: the compared world must not go dark meanwhile
        const anchor = this.ghost.beside;
        if (anchor.data.type !== 'star') { want.add(anchor.id); this.fillFull.add(anchor.id); }
      }
      if (this.surfacePin && !this.pinLeaving) { want.add(this.surfacePin.bodyId); this.fillFull.add(this.surfacePin.bodyId); }
      // a tour's camera target keeps the full work light so its pinned features stay readable
      if (cam.target && this.tourOverrides.fill !== false) this.fillFull.add(cam.target.id);
    }
    // proximity lamp: the user's strength; tours and pinned features: full
    const near = this.settings.nightLight;
    const step = dt / 2;
    for (const id of want) if (!this.fill.has(id)) this.fill.set(id, 0);
    for (const [id, v] of this.fill) {
      const nv = want.has(id) ? Math.min(1, v + step) : v - step;
      if (nv <= 0) this.fill.delete(id);
      else this.fill.set(id, nv);
    }
    this.fillOut.clear();
    for (const [id, v] of this.fill) {
      const strength = this.fillFull.has(id) ? 1 : near;
      if (strength > 0) this.fillOut.set(id, v * v * (3 - 2 * v) * strength);
    }
  }
  private readonly fill = new Map<string, number>();
  private readonly fillWant = new Set<string>();
  private readonly fillFull = new Set<string>();
  private readonly fillOut = new Map<string, number>();
  private readonly aimQ = new Quaternion();
  private readonly aimEase = new Quaternion();

  /**
   * World position of a surface point on the rendered (oblate) globe: the mesh is a unit sphere
   * squashed along the pole, so the point of the sphere at lat/lon lands at (a·x, c·y, a·z) —
   * not one mean radius out, which on Jupiter sits ~900 km inside the clouds and swims against
   * them as the camera moves.
   */
  private pinPoint(b: CelestialBody, lat: number, lon: number, storm: boolean, out: Vector3): Vector3 {
    this.pinDirection(b, lat, lon, storm, out).applyQuaternion(this.pinQ.copy(b.rotation).invert());
    const a = b.equatorialRadius, c = b.polarRadius;
    out.set(out.x * a, out.y * c, out.z * a);
    return out.applyQuaternion(b.rotation).add(b.position);
  }
  private readonly pinQ = new Quaternion();
  private readonly reliefHaze = new Vector3();

  /** A small circle `radiusKm` round a surface point, camera-relative; points on the far side are null. */
  private pinRing(b: CelestialBody, lat: number, lon: number, radiusKm: number, camPos: Vector3): Array<Vector3 | null> {
    const out = this.ringOut;
    out.length = 0;
    const d = radiusKm / b.radius, la = lat * DEG, lo = lon * DEG;
    const n = this.ringPts.length - 1;
    for (let i = 0; i <= n; i++) {
      const brg = (i / n) * 2 * Math.PI;
      const la2 = Math.asin(Math.sin(la) * Math.cos(d) + Math.cos(la) * Math.sin(d) * Math.cos(brg));
      const lo2 = lo + Math.atan2(Math.sin(brg) * Math.sin(d) * Math.cos(la), Math.cos(d) - Math.sin(la) * Math.sin(la2));
      const p = this.pinPoint(b, la2 / DEG, lo2 / DEG, false, this.ringPts[i]);
      const facing = _dir.copy(p).sub(b.position).dot(_up.copy(camPos).sub(p)) > 0;
      out.push(facing ? p.sub(camPos) : null);
    }
    return out;
  }

  /** Outward unit vector of a surface point; gas-giant storms follow the shader's drifting spot. */
  private pinDirection(b: CelestialBody, lat: number, lon: number, storm: boolean, out: Vector3): Vector3 {
    const app = b.data.appearance;
    if (storm && app.kind === 'gas' && app.storm) {
      // gasgiant.frag: lon = atan(z, x), storm at uStorm.y + hours * 0.004 rad — our east longitude is the negative
      const hours = this.time.t / 3600;
      lat = app.storm[0];
      lon = -(app.storm[1] + (hours * 0.004) / DEG);
    }
    return b.surfaceDirection(lat, lon, out);
  }

  /**
   * Bodies a tour step is about. Only they carry a tag while the step plays (with the comparison
   * copy and the other half of a binary); their primaries and moons / companion stars are also
   * kept on screen by the small-body filter, while everything else on the sky rests. `null` ends
   * the scoping.
   */
  setTourScope(ids: string[] | null): void {
    if (!ids) { this.overlay.scope = null; this.tourScope = null; return; }
    const tags = new Set<string>(['tour-ghost']);
    const scope = new Set<string>(['tour-ghost']);
    const u = this.universe;
    for (const id of ids) {
      tags.add(id);
      const b = u.get(id);
      if (!b) { scope.add(id); continue; }
      // its primaries, except an (empty) barycentre, whose cross and name would sit on the star's face
      for (let p: CelestialBody | null = b; p; p = p.parent) if (p === b || p.data.type !== 'barycenter') scope.add(p.id);
      const kin = (c: CelestialBody): boolean => {
        const t = c.data.type;
        return t === 'moon' || t === 'planet' || t === 'star' || t === 'blackhole';
      };
      // its moons (a planet), its planets (the star) — not the dwarfs, rocks and probes of the whole system
      for (const c of b.children) if (kin(c)) scope.add(c.id);
      // the other half of a binary (both circle a barycentre): the companion is part of the story
      if (b.parent?.data.type === 'barycenter') {
        for (const c of b.parent.children) if (kin(c) || c.data.type === 'dwarf') { scope.add(c.id); tags.add(c.id); }
      }
    }
    this.tourScope = scope;
    this.overlay.scope = tags;
  }
  private tourScope: Set<string> | null = null;

  setTourOverrides(o: TourOverrides): void {
    this.tourOverrides = o;
    const s = this.settings;
    this.grid.setVisible(o.eclipticGrid ?? s.eclipticGrid, o.equatorialGrid ?? s.equatorialGrid);
    this.engine.setFov(o.fov ?? s.fov);
  }

  /** Sky view: camera `alt` km above `refId`, on the side facing the `toward` bodies, aimed at their midpoint. */
  lookFrom(refId: string, toward: string[], alt: number): void {
    const ref = this.universe.get(refId);
    if (!ref) return;
    const aim = new Vector3();
    let n = 0;
    for (const id of toward) {
      const b = this.universe.get(id);
      if (!b) continue;
      // average of unit directions: the midpoint on the sky, not the midpoint in space
      aim.add(_dir.copy(b.position).sub(ref.position).normalize());
      n++;
    }
    if (!n) return;
    aim.normalize();
    const cam = this.camera;
    cam.position.copy(ref.position).addScaledVector(aim, ref.radius + alt);
    // keep the reference body's pole as screen-up so the horizon reads naturally
    const up = _up.copy(ref.pole).addScaledVector(aim, -ref.pole.dot(aim));
    if (up.lengthSq() < 1e-6) up.set(0, 1, 0);
    // Matrix4.lookAt(eye, target, up): the camera's -Z ends up pointing from eye toward target
    _m4.lookAt(_zero, aim, up.normalize());
    cam.quaternion.setFromRotationMatrix(_m4);
    cam.setReference(ref);
    cam.target = null;
    cam.anchor = null;
    cam.autopilot = null;
    cam.autoOrbit = 0;
    cam.mode = 'free';
  }

  /** Live measurement for the `readout` tour cue. */
  measure(kind: ReadoutKind, aId: string, bId: string, fromId = 'earth'): string {
    const a = this.universe.get(aId), b = this.universe.get(bId);
    if (!a || !b) return '';
    switch (kind) {
      case 'distance': return fmtDistance(a.position.distanceTo(b.position));
      case 'altitude': return fmtDistance(Math.max(0, a.position.distanceTo(b.position) - b.radius));
      case 'light': {
        const sec = a.position.distanceTo(b.position) / C_KM_S;
        if (sec < 90) return `${sec.toFixed(1)} s`;
        const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), ss = Math.floor(sec % 60);
        return h >= 24
          ? `${Math.floor(h / 24)} ${_('gün')} ${String(h % 24).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
          : `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
      }
      case 'separation': {
        const o = this.universe.get(fromId);
        if (!o) return '';
        const da = _dir.copy(a.position).sub(o.position).normalize();
        const db = _up.copy(b.position).sub(o.position).normalize();
        const deg = Math.acos(Math.min(1, Math.max(-1, da.dot(db)))) / DEG;
        if (deg < 1) return `${(deg * 60).toFixed(1)}′`;
        return `${deg.toFixed(deg < 10 ? 2 : 1)}°`;
      }
    }
  }

  setSurfacePin(pin: SurfacePin | null): void {
    if (pin) {
      // a new pin fades in; replacing one mid-fade just continues from the current alpha
      if (!this.surfacePin || this.pinLeaving) this.pinAlpha = this.pinLeaving ? this.pinAlpha : 0;
      this.surfacePin = pin;
      this.pinLeaving = false;
    } else if (this.surfacePin) {
      // keep the pin for its fade-out; it is dropped when fully transparent (see the frame loop)
      this.pinLeaving = true;
    }
  }
  private pinAlpha = 0;
  private pinLeaving = false;

  /** Fly to a body of any system, switching the reference frame to that system first if needed. */
  goToSystemBody(starId: StarId, bodyId: string): void {
    const u = this.universe;
    if (starId !== u.current.starId) {
      const delta = u.switchTo(starId, this.time.jd, this.time.t);
      this.camera.shiftFrame(delta, u.star);
    }
    const b = u.get(bodyId);
    if (b) this.goTo(b);
    else this.ui.showToast(_('Hedef bulunamadı'));
  }

  toggleFollow(): void {
    const cam = this.camera;
    if (this.landedOn) { this.takeOff(); return; }
    if (this.selected) {
      if (cam.mode === 'orbit' && cam.target === this.selected) {
        cam.setMode('free');
        this.ui.showToast(_('Serbest uçuş'));
      } else {
        cam.anchor = null;
        cam.target = this.selected;
        cam.setMode('orbit');
        this.ui.showToast(_('{name} takip ediliyor', { name: this.selected.name }));
      }
      return;
    }
    // galaxies / nebulae: orbit a fixed point of the current frame
    const u = this.universe;
    let centre: Vector3 | null = null, radius = 0, name = '';
    if (this.selectedGalaxy !== null) {
      const i = this.selectedGalaxy;
      centre = u.galaxyRelative(i, new Vector3());
      radius = u.galaxies.radius[i] * PARSEC_KM * 0.02;
      name = u.galaxies.name(i);
    } else if (this.selectedLandmark !== null) {
      const i = this.selectedLandmark;
      centre = u.landmarkRelative(i, new Vector3());
      radius = u.landmarks[i].def.radiusPc * PARSEC_KM * 0.3;
      name = _(u.landmarks[i].def.name);
    } else if (this.selectedFar !== null) {
      centre = this.farRelative(this.selectedFar, _zero);
      radius = this.farRadiusPc(this.selectedFar) * PARSEC_KM * 0.05;
      name = this.farName(this.selectedFar);
    }
    if (!centre) return;
    if (cam.mode === 'orbit' && cam.anchor && cam.anchor.position.distanceToSquared(centre) < 1e-6 * Math.max(1, centre.lengthSq())) {
      cam.setMode('free');
      this.ui.showToast(_('Serbest uçuş'));
    } else {
      cam.orbitPoint(centre, radius, name);
      this.ui.showToast(_('{name} takip ediliyor', { name }));
    }
  }

  /* ---------------- Missions ---------------- */
  launchMission(plan: MissionPlan, follow: boolean, fitSeconds: number): ActiveMission {
    const t = this.time;
    const rate = fitSeconds > 0 ? Math.max(1, plan.durationS / fitSeconds) : 1;
    // start a few real seconds before departure so the launch is visible
    const preRoll = (3 * rate) / 86400;
    if (t.jd < plan.departureJd - preRoll || t.jd > plan.departureJd) t.jd = plan.departureJd - preRoll;
    if (rate > 1) t.setRate(rate); else t.setRate(1);
    const m = this.missions.launch(plan, t.jd, t.t);
    m.autoRate = rate > 1;
    this.trajectories.add(m);
    if (follow) this.followMission(m);
    this.ui.showToast(`${_('{name} fırlatıldı', { name: m.name })} · ${plan.originName} → ${plan.targetName} · ${fmtDuration(plan.durationS)}${rate > 1 ? ` · ${_('zaman')} ${t.rateLabel()}` : ''}`, 3200);
    return m;
  }

  followMission(m: ActiveMission): void {
    this.missions.followed = m;
    this.followOffsetValid = false;
    if (!m.body) {
      // vehicle lives in another system right now: go there
      const ph = m.phase;
      if (ph && 'system' in ph && ph.system !== this.universe.current.starId) {
        const delta = this.universe.switchTo(ph.system, this.time.jd, this.time.t);
        this.camera.shiftFrame(delta, this.universe.star);
      }
      this.missions.update(this.time.jd, this.time.t);
    }
    if (m.body) {
      this.select(m.body);
      this.camera.goTo(m.body, this.universe.star.position);
    }
  }

  cancelMission(m: ActiveMission): void {
    const b = m.body;
    if (this.missions.followed === m && m.autoRate) this.time.setRate(1);
    this.missions.cancel(m);
    this.trajectories.remove(m);
    if (b) {
      if (this.selected === b) this.select(null);
      if (this.camera.target === b) { this.camera.target = null; this.camera.setMode('free'); this.camera.setReference(null); }
    }
    this.ui.showToast(_('{name} görevi kaldırıldı', { name: m.name }));
  }

  showToast(msg: string, ms?: number): void { this.ui.showToast(msg, ms); }

  private onMissionSpawned(m: ActiveMission, b: CelestialBody): void {
    this.bodies.addBody(b, this.universe.current);
    this.points.setViews(this.bodies.views);
    if (this.missions.followed === m) {
      if (this.followOffsetValid) {
        this.camera.placeAt(b, this.followOffset);
        this.followOffsetValid = false;
      }
      if (this.selected === null || this.selected.id === b.id) this.select(b);
    }
  }

  private onMissionDespawned(m: ActiveMission, b: CelestialBody): void {
    this.bodies.removeBody(b.id);
    this.points.setViews(this.bodies.views);
    if (this.camera.target === b) {
      this.followOffset.copy(this.camera.position).sub(b.position);
      const d = this.followOffset.length();
      // keep a sensible viewing distance for the respawned vehicle
      if (!(d > b.radius * 1.2 && d < b.radius * 400)) this.followOffset.normalize().multiplyScalar(b.radius * 5);
      this.followOffsetValid = this.missions.followed === m;
      if (!this.followOffsetValid) { this.camera.target = null; this.camera.setMode('free'); this.camera.setReference(null); }
    }
    if (this.selected === b) this.selected = null;
  }

  private onMissionFrameSwitch(_m: ActiveMission, systemId: StarId): void {
    const u = this.universe;
    if (systemId === u.current.starId) return;
    try {
      const delta = u.switchTo(systemId, this.time.jd, this.time.t);
      this.camera.shiftFrame(delta, u.star);
      this.selectStar(null); this.selectGalaxy(null); this.selectLandmark(null);
      this.ui.showToast(_('Referans çerçevesi: {name} sistemi', { name: u.star.name }), 2600);
    } catch (e) {
      console.error(e);
    }
  }

  private onMissionArrived(m: ActiveMission): void {
    if (m.autoRate && this.missions.followed === m) {
      this.time.setRate(1);
      m.autoRate = false;
    }
    this.ui.showToast(`${m.name}: ${_('{name} hedefine varıldı', { name: m.plan.targetName })}`, 3200);
  }

  /* ---------------- events (Events tab, ?event=, embed) ---------------- */

  hasBody(id: string): boolean {
    return SOLAR_SYSTEM.some((b) => b.id === id);
  }

  /** Play an event scene: fetch its Horizons tables first, then run it as a one-step tour. */
  playEvent(e: SkyEvent, from: 'panel' | 'url' = 'panel'): void {
    for (const id of e.bodies) {
      const d = SOLAR_SYSTEM.find((b) => b.id === id);
      if (d?.orbit?.kind === 'ephemeris') void ephemeris.prioritize(d.orbit.table);
    }
    if (this.lessons.active) this.ui.toggleAcademy(false);
    // a running tour/scene ends first (its onEnd must not clear the state set below)
    if (this.tours.active) this.tours.stop();
    this.currentEvent = e;
    applyEventMeta(e);
    this.embed?.setEvent(e);
    const embed = this.embed !== null;
    beacon(from === 'url' && embed ? 'embed_open' : 'event_open', e.id, embed);
    if (!embed) {
      const u = new URL(eventUrl(e));
      history.replaceState(null, '', `${u.pathname}${u.search}`);
    }
    document.body.classList.add('event-scene');
    this.overlay.cinematic = true;
    // chapter card: "YAKIN GEÇİŞ · 4 KAS 2026 · 00:00 UTC" above the event title
    this.tours.startDef({ ...eventTour(e), eyebrow: `${_(KIND_LABELS[e.kind])} · ${fmtEventDate(e)}` });
  }

  /** The current event scene again from the start (embed "replay") */
  replayEvent(): void {
    const e = this.currentEvent ?? this.lastEvent;
    if (e) this.playEvent(e);
  }
  private lastEvent: SkyEvent | null = null;

  private endEvent(): void {
    this.lastEvent = this.currentEvent;
    this.currentEvent = null;
    document.body.classList.remove('event-scene');
    this.overlay.cinematic = false;
    if (!this.embed) {
      applyEventMeta(null);
      const lang = new URLSearchParams(location.search).get('lang');
      history.replaceState(null, '', lang ? `/?lang=${lang}` : '/');
    }
  }

  /** Camera direction from `b` (scene axes, unit) and distance in radii (share links) */
  viewOf(b: CelestialBody): { dir: [number, number, number]; radii: number } {
    const d = _dir.copy(this.camera.position).sub(b.position);
    const len = Math.max(d.length(), b.radius * 1.01);
    return { dir: [d.x / len, d.y / len, d.z / len], radii: len / b.radius };
  }

  /** Apply the launch URL (?event=, ?target=, &t=, &rate=, &cam=, &embed=1) once the app is up. */
  launch(p: LaunchParams): void {
    if (p.embed) {
      this.persistSettings = false;
      // iframe: light on traffic (no NASA tiles, no background Horizons tables), silent narration,
      // and the host page keeps its scrolling until the visitor clicks the view
      this.settings.imagery = false;
      this.applySettings();
      ephemeris.deferBackground = true;
      this.input.setArmOnClick(true);
      this.tours.muted = true;
      this.embed = new EmbedUI(this);
    }
    const e = p.event ? eventById(p.event) : undefined;
    if (e) {
      if (!e.bodies.every((id) => this.hasBody(id))) { this.ui.showToast(_('Bu olay bu sürümde gösterilemiyor')); return; }
      this.playEvent(e, 'url');
      if (p.time) this.time.setDate(p.time);
      if (p.rate !== null) { if (p.rate === 0) { if (!this.time.paused) this.time.togglePause(); } else this.time.setRate(p.rate); }
      return;
    }
    if (p.event) this.ui.showToast(_('Olay bulunamadı'), 3000);
    if (p.time) this.time.setDate(p.time);
    if (p.target) {
      const b = this.universe.get(p.target);
      if (b) {
        if (b.data.orbit?.kind === 'ephemeris') void ephemeris.prioritize(b.data.orbit.table);
        this.select(b);
        if (p.cam) {
          this.universe.update(this.time.jd, this.time.t);
          this.camera.placeAt(b, _dir.set(p.cam.dir[0], p.cam.dir[1], p.cam.dir[2]).multiplyScalar(p.cam.radii * b.radius));
          this.camera.autoOrbit = 0;
        } else this.camera.goTo(b, this.universe.hostStar(b).position);
      } else this.ui.showToast(_('Hedef bulunamadı'));
    }
    if (p.rate !== null) { if (p.rate === 0) { if (!this.time.paused) this.time.togglePause(); } else this.time.setRate(p.rate); }
  }

  applySettings(): void {
    const s = this.settings;
    if (this.persistSettings) saveSettings(s);
    this.engine.setFov(s.fov);
    this.engine.bloom.enabled = s.bloom;
    this.volumes.enabled = s.volumetrics;
    this.volumes.scale = this.engine.mobile ? 0.35 : 0.5;
    this.engine.setRenderScale(s.renderScale * (s.autoResolution ? this.autoScale : 1));
    this.resizeOverlay();
    this.engine.renderer.toneMappingExposure = s.exposure;
    this.overlay.showLabels = s.labels;
    this.overlay.showMarkers = s.markers;
    this.overlay.showStarNames = s.starNames;
    this.overlay.showGalaxyNames = s.galaxyNames;
    this.overlay.showDistances = s.distances;
    this.overlay.clean = s.cleanView;
    const ov = this.tourOverrides;
    this.grid.setVisible(this.uiVisible && (ov.eclipticGrid ?? s.eclipticGrid), this.uiVisible && (ov.equatorialGrid ?? s.equatorialGrid));
    this.galaxySprites.setVisible(s.galaxies);
    // generated content: procedural stars, the procedural galaxy field and the far cosmic-web tiers
    this.galaxySprites.setProcedural(s.procedural);
    for (const sp of this.farSprites) sp.setVisible(s.galaxies && s.procedural);
    this.procPoints.setVisible(s.procedural);
    this.clusterPoints.setVisible(s.procedural);
    if (!s.procedural && this.selectedGalaxy !== null && this.selectedGalaxy >= this.universe.galaxies.catalogCount) this.selectGalaxy(null);
    if ((!s.procedural || !s.galaxies) && this.selectedFar) this.selectFar(null);
    // "what is real?" view: generated stars & galaxies in green
    this.procPoints.setHighlight(s.highlightProcedural);
    this.clusterPoints.setHighlight(s.highlightProcedural);
    this.galaxySprites.setHighlight(s.highlightProcedural);
    for (const sp of this.farSprites) sp.setHighlight(s.highlightProcedural);
    for (const c of this.clouds.values()) c.setHighlight(s.highlightProcedural);
    this.overlay.highlightProcedural = s.highlightProcedural;
    this.camera.mouseSensitivity = 0.0032 * s.mouseSensitivity;
    this.camera.invertY = s.invertY;
    this.ui.syncSettings();
  }

  screenshot(): void {
    this.wantScreenshot = true;
  }

  /** Streamer Mode: only body labels over the sky, without saving over the visitor's settings */
  streamView(): void {
    this.persistSettings = false;
    Object.assign(this.settings, { starNames: false, galaxyNames: false, markers: false, distances: false });
    this.applySettings();
  }

  toggleUI(): void {
    this.uiVisible = !this.uiVisible;
    document.getElementById('ui')?.classList.toggle('hidden', !this.uiVisible);
    this.applySettings();   // grids follow the UI
  }

  /* ---------------- Input ---------------- */
  private onClick(x: number, y: number, dbl: boolean): void {
    // fingers are less precise than a mouse pointer
    const tol = this.input.coarse ? 2 : 1;
    if (this.overlay.hitSun(x, y)) { this.faceSun(dbl); return; }
    const b = this.overlay.pick(x, y, 22 * tol);
    if (b) {
      this.select(b);
      if (dbl) this.goTo(b);
      return;
    }
    const eng = this.engine;
    // a belt rock the visitor is close to: it becomes a real (discovered) asteroid
    const rock = this.belts.pick(x, y, eng.camera, eng.width, eng.height, 9 * tol);
    if (rock) {
      const nb = this.discoverAsteroid(rock);
      if (nb) { this.select(nb); if (dbl) this.goTo(nb); return; }
    }
    const hit = this.hitSky(x, y, tol);
    if (hit) {
      switch (hit.kind) {
        case 'star': this.selectStar(hit.id); if (dbl) this.goToStar(hit.id); break;
        case 'blackhole': { const bh = this.universe.blackHole(hit.id); if (bh) { this.selectStar(bh.systemStarId); if (dbl) this.goToBlackHole(hit.id); } break; }
        case 'landmark': this.selectLandmark(hit.index); if (dbl) this.goToLandmark(hit.index); break;
        case 'galaxy': this.selectGalaxy(hit.index); if (dbl) this.goToGalaxy(hit.index); break;
        case 'far': this.selectFar(hit.ref); if (dbl) this.goToFar(hit.ref); break;
      }
      return;
    }
    const fovRad = eng.camera.fov * DEG;
    const pxPerRad = eng.height / 2 / Math.tan(fovRad / 2);
    // Inside a nebula / cluster the gas and the unresolved glow fill the view: a click on them is a
    // click on the object itself
    const around = this.landmarkAround();
    if (around >= 0) {
      this.selectLandmark(around);
      if (dbl) this.goToLandmark(around);
      return;
    }
    // Inside / next to a galaxy its glow is a statistical point cloud, not stars: say so instead of
    // silently ignoring the click, and tell the visitor where the selectable stars are
    if (this.clouds.size && this.cloudUnderPointer(x, y, pxPerRad)) {
      const any = this.universe.procStars.tiers.some((t) => t.count > 0);
      this.ui.showToast(!any
        ? _('Çözümlenmemiş yıldız alanı · tekil yıldızlar için galaksinin içine uçun')
        : this.settings.proceduralNames
          ? _('Çözümlenmemiş yıldız alanı · tıklanabilir yıldızlar isimleriyle (YE …) işaretli')
          : _('Çözümlenmemiş yıldız alanı · yakındaki tekil yıldızlar tıklanabilir (imleç değişir)'), 3200);
      return;
    }
    // inside a resolved far cluster a click on nothing in particular is a click on the cluster
    if (this.farCluster && this.farCluster.ratio(this.camPc) < 1.6) {
      const ref = { tier: this.farCluster.tierIndex, index: this.farCluster.index, member: -1 };
      this.selectFar(ref);
      if (dbl) this.goToFar(ref);
    }
  }

  /** Anything selectable on the sky at a screen point: catalogue / generated star, landmark, galaxy */
  private hitSky(x: number, y: number, tol = 1): { kind: 'star' | 'blackhole'; id: string } | { kind: 'landmark' | 'galaxy'; index: number } | { kind: 'far'; ref: FarRef } | null {
    const eng = this.engine;
    const u = this.universe;
    // the label text counts as the object: from afar the dot itself is a sub-pixel target
    const lbl = this.overlay.hitLabel(x, y, 3 * tol);
    if (lbl) {
      switch (lbl.kind) {
        case 'star': if (lbl.index >= 0) return { kind: 'star', id: `c${lbl.index}` }; if (lbl.id) return { kind: 'star', id: lbl.id }; break;
        case 'blackhole': if (lbl.id) return { kind: 'blackhole', id: lbl.id }; break;
        default: return { kind: lbl.kind, index: lbl.index };
      }
    }
    // every layer proposes its best candidate as drawn (size, alpha); the best score wins across
    // layers, so a faint dot near a bright nebula / galaxy no longer steals the click
    type SkyHit = NonNullable<ReturnType<App['hitSky']>>;
    const slack = 5 * tol;
    let best: PickHit<SkyHit> | null = null;
    const offer = <T,>(h: PickHit<T> | null, wrap: (v: T) => SkyHit): void => {
      if (h) best = better(best, { ...h, value: wrap(h.value) });
    };
    offer(this.starPoints.pickHit(x, y, eng.camera, eng.width, eng.height, u.current.catalogIndex, slack), (i) => ({ kind: 'star', id: `c${i}` }));
    offer(this.procPoints.pickHit(x, y, eng.camera, eng.width, eng.height, u.current.starId, slack), (id) => ({ kind: 'star', id }));
    offer(this.clusterPoints.pickHit(x, y, eng.camera, eng.width, eng.height, u.current.starId, slack), (id) => ({ kind: 'star', id }));
    offer(this.landmarkSprites.pickHit(x, y, eng.camera, eng.width, eng.height, slack), (index) => ({ kind: 'landmark', index }));
    const pxPerRad = eng.height / 2 / Math.tan((eng.camera.fov * DEG) / 2);
    offer(this.galaxySprites.pickHit(x, y, eng.camera, eng.width, eng.height, pxPerRad, this.galaxyBoost, u.currentGalaxy ?? -1, slack, this.clouds),
      (index) => ({ kind: 'galaxy', index }));
    // far universe: member galaxies of the resolved cluster, then the aggregated knots themselves
    if (this.settings.galaxies && this.settings.procedural) {
      const fc = this.farCluster, fs = this.farClusterSprites;
      if (fc && fs) {
        offer(fs.pickHit(x, y, eng.camera, eng.width, eng.height, pxPerRad, this.galaxyBoost, -1, slack),
          (m) => ({ kind: 'far', ref: { tier: fc.tierIndex, index: fc.index, member: m } }));
      }
      for (let k = 0; k < this.farSprites.length; k++) {
        offer(this.farSprites[k].pickHit(x, y, eng.camera, eng.width, eng.height, pxPerRad, 1, fc && fc.tierIndex === k ? fc.index : -1, slack),
          (index) => ({ kind: 'far', ref: { tier: k, index, member: -1 } }));
      }
    }
    return (best as PickHit<SkyHit> | null)?.value ?? null;
  }

  /** Index of the extended landmark (nebula, cluster, remnant) the camera is inside of, or -1 */
  private landmarkAround(): number {
    const u = this.universe;
    let best = -1, bestRatio = 1.6;
    for (let i = 0; i < u.landmarks.length; i++) {
      const l = u.landmarks[i];
      if (l.def.kind === 'star' || l.def.kind === 'pulsar' || l.def.radiusPc < 0.2) continue;
      const ratio = l.positionPc.distanceTo(this.camPc) / l.def.radiusPc;
      if (ratio < bestRatio) { bestRatio = ratio; best = i; }
    }
    return best;
  }

  /** Is the screen point on the resolved point cloud of a nearby galaxy (unresolved star light)? */
  private cloudUnderPointer(x: number, y: number, pxPerRad: number): boolean {
    const eng = this.engine;
    for (const i of this.clouds.keys()) {
      const { angRad, ratio } = this.galaxySprites.apparent(i);
      if (ratio < 1.2) return true; // inside: the whole sky is the cloud
      this.galaxySprites.direction(i, _dir).multiplyScalar(1e11).project(eng.camera);
      if (_dir.z > 1 || _dir.z < -1) continue;
      const sx = (_dir.x * 0.5 + 0.5) * eng.width, sy = (-_dir.y * 0.5 + 0.5) * eng.height;
      if (Math.hypot(sx - x, sy - y) < angRad * pxPerRad) return true;
    }
    return false;
  }

  private onKey(code: string, e: KeyboardEvent): void {
    const s = this.settings;
    const sel = this.selected;
    switch (code) {
      case 'KeyG':
        if (sel) this.goTo(sel);
        else if (this.selectedStar !== null) this.goToStar(this.selectedStar);
        else if (this.selectedGalaxy !== null) this.goToGalaxy(this.selectedGalaxy);
        else if (this.selectedLandmark !== null) this.goToLandmark(this.selectedLandmark);
        else if (this.selectedFar !== null) this.goToFar(this.selectedFar);
        break;
      case 'KeyC':
        if (sel) this.center(sel);
        else if (this.selectedStar !== null) this.centerStar(this.selectedStar);
        else if (this.selectedGalaxy !== null) this.centerGalaxy(this.selectedGalaxy);
        else if (this.selectedLandmark !== null) this.centerLandmark(this.selectedLandmark);
        else if (this.selectedFar !== null) this.centerFar(this.selectedFar);
        break;
      case 'KeyT': this.toggleFollow(); break;
      case 'KeyI': if (this.landedOn) this.takeOff(); else this.land(); break;
      case 'KeyV': this.toggleFreeRoam(); break;
      case 'KeyH': case 'Home': {
        e.preventDefault();
        if (this.universe.current.catalogIndex === 0) this.goTo(this.universe.get('earth')!);
        else this.goToStar('c0');
        break;
      }
      case 'KeyU': this.ui.toggleMission(); break;
      case 'KeyM':
        // Milky Way overview
        this.goToGalaxy(0);
        break;
      case 'Escape':
        if (this.tours.active) this.tours.stop();
        else if (this.lessons.active) this.ui.toggleAcademy(false);
        else if (this.camera.autopilot) this.camera.autopilot = null;
        else { this.select(null); this.selectStar(null); this.selectGalaxy(null); this.selectLandmark(null); }
        this.ui.toggleHelp(false);
        this.ui.toggleAbout(false);
        this.ui.toggleChangelog(false);
        break;
      case 'KeyJ': this.time.reverseWarp(); break;
      case 'KeyK': this.time.togglePause(); break;
      case 'KeyL': this.time.forwardWarp(); break;
      case 'Backslash': this.time.setNow(); this.ui.showToast(_('Gerçek zaman')); break;
      case 'KeyO': s.orbits = !s.orbits; this.applySettings(); this.ui.showToast(`${_('Yörüngeler')}: ${s.orbits ? _('açık') : _('kapalı')}`); break;
      case 'KeyN': s.cleanView = !s.cleanView; this.applySettings(); this.ui.showToast(s.cleanView ? _('Temiz görünüm: işaretler ve isimler gizli') : _('İşaretler ve isimler görünür')); break;
      case 'Semicolon': s.eclipticGrid = !s.eclipticGrid; this.applySettings(); break;
      case 'Quote': s.equatorialGrid = !s.equatorialGrid; this.applySettings(); break;
      case 'KeyB': s.bloom = !s.bloom; this.applySettings(); break;
      case 'KeyP': this.screenshot(); break;
      case 'Tab': e.preventDefault(); this.toggleUI(); break;
      case 'F1': e.preventDefault(); this.ui.toggleHelp(); break;
      case 'Slash': e.preventDefault(); (document.getElementById('search-input') as HTMLInputElement).focus(); break;
      case 'Equal': case 'NumpadAdd': this.time.faster(); break;
      case 'Minus': case 'NumpadSubtract': this.time.slower(); break;
      case 'BracketLeft': s.fov = Math.max(20, s.fov - 5); this.applySettings(); break;
      case 'BracketRight': s.fov = Math.min(110, s.fov + 5); this.applySettings(); break;
      default: {
        const m = /^Digit(\d)$/.exec(code);
        if (m) {
          const ids = this.universe.current.planetIds;
          const idx = m[1] === '0' ? 9 : parseInt(m[1], 10) - 1;
          const id = idx === 9 && this.universe.current.catalogIndex !== 0 ? this.universe.star.id : ids[idx];
          const b = id && this.universe.get(id);
          if (b) this.goTo(b);
        }
      }
    }
  }

  /**
   * Free flight between systems: when another star becomes clearly the nearest one,
   * hand the camera over to that system's frame.
   */
  private checkFrameSwitch(dt: number): void {
    this.frameCheckAcc += dt;
    if (this.frameCheckAcc < 0.5 || this.camera.autopilot || this.camera.mode !== 'free') return;
    this.frameCheckAcc = 0;
    const u = this.universe;
    const curDistPc = this.camera.position.length() / PARSEC_KM;
    if (curDistPc < 0.02) return; // still deep inside the current system
    const n = u.nearestStar(this.camera.position);
    // Only re-anchor when we are actually close to another star (a few pc): switching on every
    // nearest-neighbour change while cruising through a galaxy would reset velocity constantly.
    if (n.id === u.current.starId || n.distPc > 3 || n.distPc > curDistPc * 0.7) return;
    // …and not while flying past it at cruising speed (re-anchoring would throttle the flight
    // speed to the new star's altitude); switch once we linger (< ~0.5 s to cross the gap)
    if (this.camera.speed > n.distPc * PARSEC_KM * 2) return;
    const delta = u.switchTo(n.id, this.time.jd, this.time.t);
    this.camera.shiftFrame(delta, u.star);
    this.select(null);
    this.selectStar(null);
    this.selectGalaxy(null);
    this.ui.showToast(_('Referans çerçevesi: {name} sistemi', { name: u.star.name }));
  }

  /**
   * Galaxy-scale bookkeeping (a few times per second): which galaxy are we in, which clouds
   * to keep alive, procedural star cells, speed hint, sprite boost.
   */
  private updateGalaxyScale(force: boolean): void {
    const u = this.universe;
    const g = u.galaxies;
    const camPc = this.camPc;
    const scene = this.engine.scene;

    // containing galaxy (score < 1 ⇒ inside 3 radii)
    const inside = g.containing(camPc, 3);
    u.currentGalaxy = inside;

    // clouds for the (at most 3) galaxies nearest in radii, within 18 radii (sprite ↔ cloud
    // crossfade range): in a crowded cluster the one we're at must not lose its slot to bystanders
    const close: Array<[number, number]> = [];
    const cloudCount = this.settings.procedural ? g.count : g.catalogCount;
    for (let i = 0; i < cloudCount; i++) {
      const dx = g.positions[i * 3] - camPc.x, dy = g.positions[i * 3 + 1] - camPc.y, dz = g.positions[i * 3 + 2] - camPc.z;
      const ratio = Math.sqrt(dx * dx + dy * dy + dz * dz) / g.radius[i];
      if (ratio < 18) close.push([i, ratio]);
    }
    close.sort((a, b) => a[1] - b[1]);
    const wanted = new Set(close.slice(0, 3).map(([i]) => i));
    for (const [i, c] of this.clouds) if (!wanted.has(i)) { c.dispose(scene); this.clouds.delete(i); }
    for (const i of wanted) {
      if (this.clouds.has(i)) continue;
      const n = i === 0 ? 260_000 : Math.round(Math.min(160_000, 40_000 + g.radius[i] * 6));
      const cloud = new GalaxyCloud(i, g.model(i), scene, n, this.maxPointPx, this.volumes);
      cloud.setHighlight(this.settings.highlightProcedural);
      this.clouds.set(i, cloud);
    }

    // procedural stars for the galaxy we're in (none at all when generated content is switched off)
    u.procStars.update(camPc, this.settings.procedural ? inside : null);
    // generated deep-sky objects of the neighbourhood (nebulae, clusters, remnants, exotic stars)
    const selectedId = this.selectedLandmark !== null ? u.landmarks[this.selectedLandmark]?.def.id : null;
    if (u.procLandmarks.update(camPc, this.settings.procedural ? inside : null) || this.landmarkSprites.count !== u.landmarks.length) {
      u.setProcLandmarks(u.procLandmarks.list);
      if (selectedId) {
        const idx = u.landmarks.findIndex((l) => l.def.id === selectedId);
        this.selectedLandmark = idx >= 0 ? idx : null;
      }
      this.landmarkSprites.rebuild();
    }
    this.checkDiscoveries(camPc);

    // sprite exaggeration: physical inside a galaxy, boosted in intergalactic space
    let nearestRatio = Infinity;
    for (let i = 0; i < g.count; i++) {
      const dx = g.positions[i * 3] - camPc.x, dy = g.positions[i * 3 + 1] - camPc.y, dz = g.positions[i * 3 + 2] - camPc.z;
      const r = Math.sqrt(dx * dx + dy * dy + dz * dz) / g.radius[i];
      if (r < nearestRatio) nearestRatio = r;
    }
    const targetBoost = Math.min(1, Math.max(0, (nearestRatio - 4) / 8));
    this.galaxyBoost = force ? targetBoost : this.galaxyBoost + (targetBoost - this.galaxyBoost) * 0.35;

    // speed hint: galaxy scale while cruising; a nearby generated star only matters when we are
    // practically on top of it (< 1 pc) – otherwise every passing star would yank the speed around
    let hintPc = Infinity;
    const near = u.procStars.nearest(camPc);
    if (near && near.distPc < 1) hintPc = Math.min(hintPc, Math.max(near.distPc, 0.01));
    if (inside !== null) hintPc = Math.min(hintPc, g.radius[inside] * 0.08);
    else hintPc = Math.min(hintPc, Math.max(g.nearestSurfaceDistance(camPc), 1000));
    const targetKm = hintPc * PARSEC_KM;
    // smooth in log space so the free-flight speed never jumps
    const cur = this.camera.speedHintKm;
    this.camera.speedHintKm = force || !Number.isFinite(cur) || !Number.isFinite(targetKm)
      ? targetKm
      : Math.exp(Math.log(cur) + (Math.log(targetKm) - Math.log(cur)) * 0.4);
  }

  /* ---------------- Discoveries ---------------- */
  /* ---------------- Discovered belt asteroids ---------------- */
  private asteroidStore: Record<string, Array<[number, number]>> | null = null;

  /** per system: [belt, particle] pairs of the rocks the visitor has turned into bodies (persisted) */
  private get asteroids(): Record<string, Array<[number, number]>> {
    if (!this.asteroidStore) {
      this.asteroidStore = {};
      try { this.asteroidStore = JSON.parse(localStorage.getItem('yeits.asteroids') ?? '{}') as Record<string, Array<[number, number]>>; } catch { /* ignore */ }
    }
    return this.asteroidStore;
  }

  private asteroidId(starId: string, p: BeltParticle): string { return `ast~${starId}~${p.belt}~${p.index}`; }

  /** BodyData for a belt particle: a small rock on exactly the particle's orbit */
  private asteroidData(sys: StarSystem, p: BeltParticle): BodyData {
    const id = this.asteroidId(sys.starId, p);
    const rng = new Rng(hashStr(id) >>> 0);
    const belt = sys.belts[p.belt];
    const center = this.belts.centers[p.belt] ?? sys.star;
    const outer = p.a / AU_KM > 15 * Math.sqrt(this.starLuminosity);
    // size: mostly sub-10 km rocks, the brightest particles are the bigger ones
    const radius = Math.exp(Math.log(0.3) + (Math.log(60) - Math.log(0.3)) * Math.pow(p.size, 2.2) * rng.range(0.7, 1)) * (outer ? 2.5 : 1);
    const density = outer ? 900 : rng.range(1400, 3200);
    const mass = (4 / 3) * Math.PI * Math.pow(radius * 1000, 3) * density;
    const period = (2 * Math.PI) / p.n / DAY_S;
    const sol = sys.catalogIndex === 0;
    const date = TimeSystem.jdToDate(this.time.jd);
    const letters = 'ABCDEFGHJKLMNOPQRSTUVWXYZ';
    const code = `${letters[rng.int(0, letters.length - 1)]}${letters[rng.int(0, letters.length - 1)]}${rng.int(1, 999)}`;
    const name = sol ? `${date.getUTCFullYear()} ${code}` : `${_(sys.star.data.name)} ${code}`;
    const base = outer ? [0.3, 0.2, 0.15] : rng.chance(0.3) ? [0.3, 0.29, 0.27] : [0.14, 0.13, 0.12];
    const tint = (k: number) => rng.tint([base[0] * k, base[1] * k, base[2] * k]) as [number, number, number];
    const aAU = p.a / AU_KM;
    return {
      id, name, type: 'asteroid', parent: center.id,
      radius, mass, albedo: outer ? 0.08 : base[0] > 0.2 ? 0.25 : 0.05,
      rotationPeriod: rng.range(2.5, 40), tilt: rng.range(0, 180),
      orbit: {
        kind: 'simple', a: p.a, e: p.e, i: p.i / DEG, node: p.node / DEG, argPeri: p.argPeri / DEG, M0: p.M0 / DEG,
        epoch: J2000_JD, period, frame: sol ? 'ecliptic' : 'parentEquator',
      },
      appearance: { kind: 'terrestrial', seed: hashStr(id) & 0xffff, landLow: tint(0.7), landMid: tint(1), landHigh: tint(1.5), craters: 1.0, roughness: 2.4, variation: 0.5 },
      description: `${_('{belt} içinde keşfettiğiniz küçük bir cisim.', { belt: _(belt?.name ?? 'Kuşak') })} ${_('Çapı yaklaşık {d} km; yıldızını {a} AU yarı-büyük eksenli, {e} dış merkezlilikli bir yörüngede {p} yılda dolanır.', { d: fixed(radius * 2, radius < 5 ? 1 : 0), a: fixed(aAU, 2), e: fixed(p.e, 3), p: fixed(period / 365.25, 1) })} ${outer ? _('Buz ve tholinlerden oluşan koyu, kızıl bir yüzey.') : _('Kraterli, düzensiz biçimli bir kaya.')}`,
      discovered: `${date.getUTCFullYear()}, ${_('siz')}`,
      facts: { 'Sınıf': outer ? _('Trans-Neptün cismi') : belt?.trojan ? _('Truva asteroiti') : _('Asteroit'), 'Keşif': `${date.getUTCFullYear()}, ${_('siz')}`, 'Kaynak': _('Prosedürel (keşif)') },
    };
  }

  /** Turn a picked belt particle into a body of the current system (remembered for this system) */
  private discoverAsteroid(p: BeltParticle): CelestialBody | null {
    const sys = this.universe.current;
    const list = (this.asteroids[sys.starId] ??= []);
    const id = this.asteroidId(sys.starId, p);
    const existing = sys.get(id);
    if (existing) return existing;
    if (list.length >= 40) {
      this.ui.showToast(_('Bu sistemde en fazla 40 asteroit keşfedebilirsiniz'), 3000);
      return null;
    }
    list.push([p.belt, p.index]);
    try { localStorage.setItem('yeits.asteroids', JSON.stringify(this.asteroids)); } catch { /* ignore */ }
    const b = this.spawnAsteroid(sys, p);
    this.noteDiscovery(id, b.data.name, false, b.data.facts?.['Sınıf'] ?? 'Asteroit');
    return b;
  }

  private spawnAsteroid(sys: StarSystem, p: BeltParticle): CelestialBody {
    const b = sys.addBody(this.asteroidData(sys, p));
    sys.update(this.time.jd, this.time.t);
    this.belts.hide(p.belt, p.index);
    this.bodies.addBody(b, sys);
    this.points.setViews(this.bodies.views);
    return b;
  }

  /** Re-create the asteroids discovered earlier in this system */
  private restoreAsteroids(sys: StarSystem): void {
    const list = this.asteroids[sys.starId];
    if (!list) return;
    for (const [belt, index] of list) {
      const p = this.belts.particle(belt, index);
      if (!p) continue;
      if (sys.get(this.asteroidId(sys.starId, p))) { this.belts.hide(belt, index); continue; }
      this.spawnAsteroid(sys, p);
    }
  }

  private discovered: Set<string> | null = null;
  private lastDiscoveryToast = 0;

  /** Ids of generated landmarks the visitor has already come close to (persisted) */
  private get discoveries(): Set<string> {
    if (!this.discovered) {
      this.discovered = new Set();
      try { for (const id of JSON.parse(localStorage.getItem('yeits.discoveries') ?? '[]') as string[]) this.discovered.add(id); } catch { /* ignore */ }
    }
    return this.discovered;
  }

  /** A generated landmark within a few radii (about where the autopilot parks) counts as discovered: toast once, remember it */
  private checkDiscoveries(camPc: Vector3): void {
    const u = this.universe;
    const now = performance.now();
    for (let i = u.realLandmarkCount; i < u.landmarks.length; i++) {
      const l = u.landmarks[i];
      const reach = Math.max(l.def.radiusPc * 6, 0.6);
      if (l.positionPc.distanceToSquared(camPc) > reach * reach) continue;
      if (this.discoveries.has(l.def.id)) continue;
      // record stars and magnetars are the rare finds
      const rare = l.def.kind === 'star' || l.def.kind === 'pulsar';
      this.noteDiscovery(l.def.id, l.def.name, now - this.lastDiscoveryToast < 4000, DISCOVERY_KIND[l.def.kind] ?? LANDMARK_KIND_LABEL[l.def.kind], rare);
    }
    // the nearest generated object not visited yet: the "next" hint of the HUD and the toasts
    if (((this.nextTick = (this.nextTick + 1) & 7)) === 0) {
      let best: Landmark | null = null, bestD = Infinity;
      for (let i = u.realLandmarkCount; i < u.landmarks.length; i++) {
        const l = u.landmarks[i];
        if (this.discoveries.has(l.def.id)) continue;
        const d = l.positionPc.distanceToSquared(camPc);
        if (d < bestD) { bestD = d; best = l; }
      }
      this.nextTarget = best ? { name: best.def.name, distKm: Math.sqrt(bestD) * PARSEC_KM } : null;
    }
  }

  private nextTarget: { name: string; distKm: number } | null = null;
  private nextTick = 0;
  private discoveryMetaStore: Record<string, { name: string; kind: string; t: number }> | null = null;

  private get discoveryMeta(): Record<string, { name: string; kind: string; t: number }> {
    if (!this.discoveryMetaStore) {
      this.discoveryMetaStore = {};
      try { this.discoveryMetaStore = JSON.parse(localStorage.getItem('yeits.discoveryMeta') ?? '{}') as Record<string, { name: string; kind: string; t: number }>; } catch { /* ignore */ }
    }
    return this.discoveryMetaStore;
  }

  /**
   * Entering a generated system with something rare in it counts as a discovery: a black hole or
   * neutron star companion, a Wolf-Rayet star, a quadruple (or richer) hierarchy.
   */
  private noteSystemDiscoveries(sys: StarSystem): void {
    if (sys.catalogIndex === 0 || this.universe.extraSystem(sys.starId)) return;
    const comps = sys.bodies.filter((b) => b !== sys.star && b.data.orbit && (b.data.type === 'star' || b.data.type === 'pulsar' || b.data.type === 'blackhole'));
    if (!comps.length) return;
    const procedural = comps.every((b) => (b.data.facts?.['Kaynak'] ?? '').startsWith('Prosedürel'));
    if (!procedural) return;
    for (const b of comps) {
      const cls = b.data.facts?.['Sınıf'];
      const kind = b.data.type === 'blackhole' ? 'Kara delik yoldaşı' : b.data.type === 'pulsar' ? 'Nötron yıldızı yoldaşı' : cls === 'Wolf-Rayet yıldızı' ? 'Wolf-Rayet yıldızı' : null;
      if (kind) this.noteDiscovery(`${sys.starId}:${b.id}`, b.name, false, kind, true);
    }
    if (comps.length >= 3) this.noteDiscovery(`${sys.starId}:multi`, sys.star.name.replace(/ A$/, ''), false, comps.length === 3 ? 'Dörtlü sistem' : 'Çoklu sistem', false);
  }

  /** Remember a discovery and announce it */
  private noteDiscovery(id: string, name: string, quiet: boolean, kind = 'Nesne', rare = false): void {
    const set = this.discoveries;
    if (set.has(id)) return;
    set.add(id);
    const meta = this.discoveryMeta;
    meta[id] = { name, kind, t: Date.now() };
    for (const k of Object.keys(meta)) if (!set.has(k)) delete meta[k];
    try {
      localStorage.setItem('yeits.discoveries', JSON.stringify(Array.from(set).slice(-600)));
      localStorage.setItem('yeits.discoveryMeta', JSON.stringify(meta));
    } catch { /* ignore */ }
    if (quiet) return;
    this.lastDiscoveryToast = performance.now();
    let msg = rare ? _('Nadir keşif: {name} · {n}. keşfiniz', { name, n: set.size }) : _('Yeni keşif: {name} · {n}. keşfiniz', { name, n: set.size });
    const next = this.nextTarget;
    if (next && next.name !== name) msg += ` · ${_('sıradaki: {name} ({dist})', { name: next.name, dist: fmtScaleDistance(next.distKm) })}`;
    this.ui.showToast(msg, rare ? 7000 : 5500);
  }

  discoveryLog(): DiscoveryEntry[] {
    const meta = this.discoveryMeta;
    const out: DiscoveryEntry[] = [];
    for (const id of this.discoveries) {
      const m = meta[id];
      if (m) out.push({ id, name: m.name, kind: m.kind, t: m.t });
    }
    return out.sort((a, b) => b.t - a.t);
  }

  nextDiscovery(): { name: string; distKm: number } | null { return this.nextTarget; }

  goToDiscovery(id: string): void {
    if (id.startsWith('ast~')) {
      const [, starId, belt, index] = id.split('~');
      const sys = this.universe.current;
      if (sys.starId === starId) {
        const b = sys.get(id) ?? (() => { const p = this.belts.particle(+belt, +index); return p ? this.spawnAsteroid(sys, p) : undefined; })();
        if (b) { this.select(b); this.goTo(b); }
      } else this.goToSystemBody(starId, id);
      return;
    }
    if (/^f\d+:\d+$/.test(id)) {
      const [t, i] = id.slice(1).split(':');
      if (this.farUniverse.tiers[+t] && +i < this.farUniverse.tiers[+t].count) this.goToFar({ tier: +t, index: +i, member: -1 });
      return;
    }
    const l = this.universe.landmark(id);
    if (l) this.goToLandmark(this.universe.landmarks.indexOf(l));
  }

  /* ---------------- Dynamic resolution ---------------- */
  /** multiplier the frame-rate governor applies under the user's render scale (1 = none) */
  private autoScale = 1;
  private fpsAcc = 0;
  /** consecutive one-second windows comfortably above the target (recovery needs several) */
  private fastWindows = 0;
  private autoToastShown = false;

  /** Pixels actually rendered: the window at the device pixel ratio × user scale × automatic drop */
  renderSize(): [number, number] {
    const eng = this.engine;
    return [Math.round(eng.width * eng.pixelRatio), Math.round(eng.height * eng.pixelRatio)];
  }

  /**
   * Frame-rate governor: when the machine cannot keep up, the render resolution steps down
   * (to 40 % of the chosen scale at most) and climbs back once the frame rate has been
   * comfortable for a while. Measured over one-second windows; the first seconds after load
   * and tab switches (huge gaps) are ignored.
   */
  private adaptResolution(now: number, rawDt: number): void {
    const s = this.settings;
    if (!s.autoResolution) {
      if (this.autoScale !== 1) { this.autoScale = 1; this.applyRenderScale(); }
      return;
    }
    if (now < 6000 || rawDt > 0.5 || document.hidden) { this.fpsAcc = 0; this.frameTimes.length = 0; return; }
    this.fpsAcc += rawDt;
    this.frameTimes.push(rawDt);
    if (this.fpsAcc < 1) return;
    // the median frame: one-off hitches (content generation, shader uploads while racing between
    // stars) are CPU stalls that a lower resolution would not cure, and must not cost quality
    const ts = this.frameTimes.sort((a, b) => a - b);
    const fps = 1 / Math.max(ts[ts.length >> 1], 1e-4);
    this.fpsAcc = 0;
    this.frameTimes.length = 0;
    const slow = fps < 27 && this.autoScale > 0.4;
    this.slowWindows = slow ? this.slowWindows + 1 : 0;
    if (slow && (this.slowWindows >= 2 || fps < 15)) {
      this.autoScale = Math.max(0.4, +(this.autoScale - 0.15).toFixed(2));
      this.slowWindows = 0;
      this.fastWindows = 0;
      this.applyRenderScale();
      if (!this.autoToastShown) {
        this.autoToastShown = true;
        this.ui.showToast(_('Akıcılık için render çözünürlüğü düşürüldü · Ayarlar'), 3200);
      }
    } else if (this.autoScale < 1) {
      // climb back once the next step up (pixel cost ∝ scale²) would still run comfortably
      const next = Math.min(1, this.autoScale + 0.15);
      const predicted = fps * (this.autoScale / next) ** 2;
      if (predicted > 33 && ++this.fastWindows >= 3) {
        this.autoScale = +next.toFixed(2);
        this.fastWindows = 0;
        this.applyRenderScale();
      } else if (predicted <= 33) this.fastWindows = 0;
    }
  }
  private readonly frameTimes: number[] = [];
  private slowWindows = 0;

  private applyRenderScale(): void {
    this.engine.setRenderScale(this.settings.renderScale * this.autoScale);
    this.ui.syncSettings();
  }

  /* ---------------- Frame ---------------- */
  private frame = (now: number): void => {
    requestAnimationFrame(this.frame);
    const rawDt = (now - this.last) / 1000;
    const dt = Math.min(0.1, Math.max(0.0001, rawDt));
    this.last = now;
    this.adaptResolution(now, rawDt);

    // Simulation
    this.time.advance(dt);
    this.missions.update(this.time.jd, this.time.t);
    this.universe.update(this.time.jd, this.time.t);
    this.tours.update(dt);
    this.lessons.update(dt);

    // Camera
    const eng = this.engine;
    const fovRad = eng.camera.fov * DEG;
    this.camera.update(dt, this.input, eng.width, eng.height, fovRad);
    // on foot the wheel zooms the view like binoculars
    {
      const zoom = this.camera.surface?.zoom ?? 1;
      const wantFov = (this.tourOverrides.fov ?? this.settings.fov) / zoom;
      if (Math.abs(eng.camera.fov - wantFov) > 1e-4) eng.setFov(wantFov);
    }
    this.aimAtPin(dt, fovRad, eng.width / Math.max(1, eng.height));
    // backdrop bookkeeping: start circling once the return flight has arrived; any other flight
    // (or re-targeting) stops the auto-orbit, which ends the backdrop
    if (this.backdropPending && !this.camera.autopilot) {
      this.backdropPending = false;
      this.camera.autoOrbit = BACKDROP_ORBIT;
      this.backdrop = true;
    }
    if (this.backdrop && this.camera.autoOrbit === 0) this.backdrop = false;
    this.checkFrameSwitch(dt);
    eng.camera.quaternion.copy(this.camera.quaternion);
    eng.camera.position.set(0, 0, 0);
    eng.camera.updateMatrixWorld();

    const camPos = this.camPosTmp.copy(this.camera.position);
    const star = this.universe.star;
    const pxPerRad = eng.height / 2 / Math.tan(fovRad / 2);
    const s = this.settings;
    this.universe.toParsecs(camPos, this.camPc);

    // Galaxy-scale bookkeeping
    this.galaxyCheckAcc += dt;
    if (this.galaxyCheckAcc >= 0.12) {
      this.galaxyCheckAcc = 0;
      this.updateGalaxyScale(false);
    }

    // Renderables
    const ov = this.tourOverrides;
    this.updateGhost(dt);
    if (this.relief?.body) {
      const rb = this.relief.body;
      const haze = this.reliefHaze.set(...(rb.data.atmosphere?.color ?? [0, 0, 0])).multiplyScalar(0.45 * Math.min(1, rb.data.atmosphere?.density ?? 0) * 2);
      this.relief.update(dt, camPos, star.position, this.sunColor, this.fillOut.get(rb.id) ?? 0, haze);
    }
    if (this.pulse?.active) this.pulse.update(dt, camPos, pxPerRad);
    if (this.meteors?.active) this.meteors.update(dt, camPos, pxPerRad);
    this.updateFill(dt);
    this.applyBodyFilter();
    const g = this.ghost;
    this.bodies.update(camPos, this.camera.quaternion, eng.camera, eng.height, fovRad, star.position, star.radius, this.sunColor, this.time.t / 3600, {
      atmospheres: s.atmospheres, clouds: ov.clouds ?? s.clouds, rings: s.rings, ringParticles: s.ringParticles, shadows: s.shadows, imagery: s.imagery,
      fill: this.fillOut.size ? this.fillOut : null,
      ghost: g ? { id: g.body.id, alpha: g.alpha * g.alpha * (3 - 2 * g.alpha) } : null,
    }, this.multiple ? (b) => b.hostStar : undefined);
    this.updateLensing(fovRad);
    this.updateLensFlare(camPos, dt);
    // ground left behind: drop the generated patch once we are well away from it
    const stood = this.landedOn;
    for (const v of this.bodies.views) if (v.landing && v.body !== stood && v.landing.fade <= 0 && v.distance - v.body.radius > v.landing.ground.half * 3) v.releaseLanding();
    // daytime sky: the stars go out
    const daylight = this.skyDaylight(camPos);
    this.daylight = daylight;
    this.points.setDaylight(daylight);
    this.starPoints.setDaylight(daylight);
    this.procPoints.setDaylight(daylight);
    this.nebulaClouds.setDaylight(daylight);
    this.procClouds.setDaylight(daylight);
    this.clusterPoints.setDaylight(daylight);
    this.landmarkSprites.setDaylight(daylight);
    for (const c of this.clouds.values()) c.setDaylight(daylight);
    this.volumes.setDaylight(daylight);
    this.points.setPixelRatio(eng.pixelRatio);
    this.points.update(star.position, camPos, this.starLuminosity);
    this.starPoints.setPixelRatio(eng.pixelRatio);
    this.starPoints.update(this.camPc, this.universe.current.catalogIndex);
    this.procPoints.update(this.camPc, eng.pixelRatio, this.universe.current.starId, dt);
    for (const c of this.clouds.values()) c.update(this.camPc, pxPerRad, eng.pixelRatio, s.milkyWay, fovRad / DEG);
    this.galaxySprites.update(this.camPc, pxPerRad, eng.pixelRatio, this.galaxyBoost, this.universe.currentGalaxy ?? -1);
    this.landmarkSprites.update(this.camPc, pxPerRad, this.universe.current.starId, (gi) => this.galaxySprites.apparent(gi).ratio);
    this.nebulaClouds.update(this.camPc, pxPerRad, eng.pixelRatio, this.landmarkSprites.k, this.landmarkSprites.mesh.visible);
    this.landmarkSprites.setCloudFlags(this.procClouds.update(this.camPc, pxPerRad, eng.pixelRatio, this.landmarkSprites.k, this.landmarkSprites.mesh.visible));
    this.clusterPoints.update(this.camPc, pxPerRad, eng.pixelRatio, this.universe.current.starId, this.landmarkSprites.mesh.visible);
    // bottom-left credit: streamed planetary imagery first, otherwise a resolved landmark photograph
    if (this.bodies.imageryCredit) this.ui.setImageryCredit(this.bodies.imageryCredit);
    else {
      this.camForward.set(0, 0, -1).applyQuaternion(this.camera.quaternion);
      const photo = this.landmarkSprites.photoCredit(this.camForward);
      this.ui.setImageryCredit(photo ? _('Fotoğraf: {source}', { source: photo }) : null, true);
    }
    // LOD hand-over between the detailed local volume and the aggregated far-universe tiers
    const dSunPc = this.camPc.length();
    this.galaxySprites.setFade(localFade(dSunPc) * (1 - daylight));
    this.updateFarClusters(dt);
    const fc = this.farCluster;
    this.farSprites.forEach((sp, k) => {
      sp.setFade(this.farUniverse.tiers[k].fade(dSunPc));
      // the knot we have resolved is drawn as its member galaxies instead
      sp.update(this.camPc, pxPerRad, eng.pixelRatio, this.galaxyBoost, fc && fc.tierIndex === k ? fc.index : -1);
    });
    if (fc && this.farClusterSprites) {
      const ratio = fc.ratio(this.camPc);
      this.farClusterSprites.setFade(Math.min(1, Math.max(0, (RESOLVE_RATIO - ratio) / (RESOLVE_RATIO * 0.4))) * (1 - daylight));
      this.farClusterSprites.setVisible(s.galaxies && s.procedural);
      this.farClusterSprites.update(this.camPc, pxPerRad, eng.pixelRatio, this.galaxyBoost, -1);
    }
    // on the ground the sky is the sky: no orbit lines across it (the switch comes back on take-off)
    // Tab (UI hidden) is the clean screenshot: orbit lines, trajectories and grids go with the panels
    // a tour draws orbit lines only where a step asks for them (overviews, `orbits` cues)
    const touring = this.tours.active;
    const orbitsOn = (ov.orbits ?? (touring ? false : s.orbits || this.backdrop || this.backdropPending)) && !stood && this.uiVisible;
    const moonLines = ov.moonOrbits === true && !stood && this.uiVisible;
    this.orbits.update(camPos, orbitsOn, ov.moonOrbits ?? (touring ? false : s.moonOrbits), pxPerRad, (id) => this.bodies.byId.get(id)?.apparentRadiusPx ?? 0, this.selected?.id ?? null, moonLines);
    this.trajectories.update(camPos, this.time.jd, this.missions.lookup, s.orbits && !stood && this.uiVisible, eng.width * eng.pixelRatio, eng.height * eng.pixelRatio);
    // Horizons trails only inside an event scene, or for the spacecraft the visitor has selected:
    // on the everyday sky the stacked capture orbits read as clutter
    const selOrbit = this.selected?.data.orbit;
    const selTable = selOrbit?.kind === 'ephemeris' ? selOrbit.table : null;
    const inScene = this.currentEvent !== null;
    // an event scene's spacecraft track is its subject: drawn unless a cue turns the lines off
    const tracksOn = (ov.orbits ?? (s.orbits || this.backdrop || this.backdropPending)) && !stood && this.uiVisible;
    this.ephemLines.update(camPos, this.time.jd, this.universe.current.get, (table) => (inScene ? tracksOn : orbitsOn && table === selTable));
    this.belts.update(this.time.t, camPos, eng.pixelRatio, s.belts, stood ? 1 : daylight);
    this.cometTails.update(this.bodies.views.map((v) => v.body), this.time.jd, camPos, pxPerRad, eng.pixelRatio, Math.min(eng.width, eng.height), s.minorBodies, daylight);

    // Render
    this.volumes.render(eng.renderer, eng.camera);
    eng.render();

    if (this.wantScreenshot) {
      this.wantScreenshot = false;
      this.saveScreenshot();
    }

    // Overlay & UI
    let starSel: StarSelectionScreen | null = null;
    if (this.selectedStar !== null) {
      this.starSel.name = this.universe.starName(this.selectedStar);
      this.starSel.distKm = this.universe.starRelative(this.selectedStar, camPos, this.starSel.dir).length();
      this.starSel.dir.normalize();
      this.starSel.kind = 'star';
      this.starSel.radiusPx = 0;
      starSel = this.starSel;
    } else if (this.selectedGalaxy !== null) {
      const i = this.selectedGalaxy;
      this.starSel.name = this.universe.galaxies.name(i);
      this.galaxySprites.direction(i, this.starSel.dir);
      this.starSel.distKm = this.galaxySprites.apparent(i).distPc * PARSEC_KM;
      this.starSel.kind = 'galaxy';
      this.starSel.radiusPx = Math.min(this.galaxySprites.apparent(i).angRad * pxPerRad, eng.height);
      starSel = this.starSel;
    } else if (this.selectedLandmark !== null) {
      const i = this.selectedLandmark;
      this.starSel.name = this.universe.landmarks[i].def.name;
      this.landmarkSprites.direction(i, this.starSel.dir);
      this.starSel.distKm = this.landmarkSprites.distancePc(i) * PARSEC_KM;
      this.starSel.kind = 'landmark';
      this.starSel.radiusPx = Math.min(this.landmarkSprites.angularRadius(i) * pxPerRad, eng.height);
      starSel = this.starSel;
    } else if (this.selectedFar !== null) {
      const ref = this.selectedFar;
      this.starSel.name = this.farName(ref);
      this.farRelative(ref, camPos, this.starSel.dir);
      this.starSel.distKm = this.starSel.dir.length();
      this.starSel.dir.normalize();
      this.starSel.kind = 'galaxy';
      this.starSel.radiusPx = Math.min((this.farRadiusPc(ref) * PARSEC_KM / Math.max(this.starSel.distKm, 1)) * pxPerRad, eng.height);
      starSel = this.starSel;
    }
    let namedStars = s.proceduralNames && this.procPoints.namedStars.length
      ? this.starPoints.namedStars.concat(this.procPoints.namedStars)
      : this.starPoints.namedStars;
    if (daylight > 0.02) { const lim = 8.5 - 13 * daylight; namedStars = namedStars.filter((n) => n.mag < lim); }
    // tour surface pin: world point on the body, hidden when it faces away from us
    const pin = this.pinScreen;
    pin.visible = false;
    if (this.surfacePin) {
      // fade in over 0.6 s, out over 0.5 s
      this.pinAlpha = this.pinLeaving ? this.pinAlpha - dt / 0.5 : Math.min(1, this.pinAlpha + dt / 0.6);
      if (this.pinAlpha <= 0) { this.surfacePin = null; this.pinLeaving = false; this.pinAlpha = 0; }
    }
    if (this.surfacePin) {
      const b = this.universe.get(this.surfacePin.bodyId);
      if (b) {
        const sp = this.surfacePin;
        const n = this.pinDirection(b, sp.lat, sp.lon, !!sp.storm, this.camForward);
        const at = this.pinPoint(b, sp.lat, sp.lon, !!sp.storm, _v3);
        pin.visible = n.dot(_dir.copy(camPos).sub(at)) > 0;
        pin.dir.copy(at).sub(camPos);
        pin.label = _(sp.label);
        pin.alpha = this.pinAlpha;
        pin.ring = sp.extent ? this.pinRing(b, sp.lat, sp.lon, sp.extent, camPos) : null;
      }
    }
    const dim = daylight > 0.5;
    const groundUp = stood && this.camera.surface ? { body: stood, up: this.standUp.set(0, 1, 0).applyQuaternion(this.tmpQ.copy(stood.rotation).multiply(this.camera.surface.siteQuat)) } : null;
    this.overlay.draw(this.bodies.views, eng.camera, this.selected, namedStars, starSel, this.uiVisible, s.galaxies && !dim ? this.galaxySprites.named : [], this.blackHoleMarkers(camPos), dim ? [] : this.landmarkSprites.named, pin.visible ? pin : null, this.overlay.scope && !this.overlay.scope.has('sun') ? null : this.sunMarker(camPos), groundUp);
    const selDist = this.selected ? this.bodies.byId.get(this.selected.id)?.distance ?? 0 : 0;
    this.ui.update(now, dt, selDist);
    this.embed?.update();
  };

  /**
   * The "dwarf planets / asteroids & comets / spacecraft" switches: a body goes with its
   * category, a barycentre with its members, moons and landers with their primary. The current
   * selection and the camera's target always stay. Guided tours, event scenes and lessons are
   * composed shots and show what they need, so the switches rest while one plays.
   */
  private applyBodyFilter(): void {
    const s = this.settings;
    const bodies = this.universe.current.bodies;
    const touring = this.tours.active || this.lessons.active;
    // a tour step keeps the small fry it is about (the overlay scope) and clears the rest away:
    // comet ellipses and probe markers through an overview of the planets are noise
    const scope = touring ? this.tourScope : null;
    const noDwarfs = scope ? true : !touring && !s.dwarfs;
    const noMinor = scope ? true : !touring && !s.minorBodies;
    const noCraft = scope ? true : !touring && !s.spacecraft;
    if (!noDwarfs && !noMinor && !noCraft) {
      for (const b of bodies) b.filtered = false;
      return;
    }
    const off = (b: CelestialBody): boolean => {
      const t = b.data.type;
      // Pluto–Charon: the pair's barycentre (and so Charon) goes with its primary
      if (t === 'barycenter') return b.children.some((c) => c.data.type !== 'moon' && off(c));
      return (t === 'dwarf' && noDwarfs) || ((t === 'asteroid' || t === 'comet') && noMinor) || (t === 'spacecraft' && noCraft);
    };
    const keep = this.selected ?? null, target = this.camera.target;
    // parents come before children in the system's list, so the inherited flag is already final
    for (const b of bodies) {
      const f = (b.parent?.filtered ?? false) || off(b);
      b.filtered = f && b !== keep && b !== target && !scope?.has(b.id);
    }
  }

  /** Hand the most prominent black hole in the current system to the lensing pass. */
  /** Glare of the brightest star in front of the camera, dimmed by whatever body covers it */
  private updateLensFlare(camPos: Vector3, dt: number): void {
    const eng = this.engine;
    if (!this.settings.lensFlare || this.engine.blackHole.enabled) { this.lensFlare.update(null, 0, 0, this.sunColor, eng.width / eng.height, dt); return; }
    let best: { ndc: Vector2; radius: number; intensity: number; color: Vector3 } | null = null;
    for (const v of this.bodies.views) {
      const star = v.body;
      if (star.data.type !== 'star' || star.hidden || star.filtered) continue;
      _dir.copy(star.position).sub(camPos);
      const d = _dir.length();
      if (d <= star.radius * 1.02) continue;
      _up.copy(_dir).project(eng.camera);
      if (_up.z > 1 || !Number.isFinite(_up.x)) continue;        // behind the camera
      if (Math.abs(_up.x) > 1.6 || Math.abs(_up.y) > 1.6) continue;
      // irradiance relative to the Sun at 1 AU, compressed: the flare is a glare, not a photometer
      const E = this.hostLuminosity(star) / Math.pow(d / AU_KM, 2);
      let vis = 1;
      const sunAng = star.radius / d;
      for (const o of this.bodies.views) {
        const b = o.body;
        if (b === star || b.hidden || b.filtered || b.data.type === 'star' || b.data.type === 'barycenter' || b.data.type === 'spacecraft') continue;
        _v3.copy(b.position).sub(camPos);
        const db = _v3.length();
        if (db >= d || b.radius / db < 2e-4) continue;
        const sep = _v3.angleTo(_dir);
        // true angular radius: from the ground a world fills the whole lower hemisphere, not 57°
        const angR = Math.asin(Math.min(1, b.radius / db));
        vis *= smooth01((sep - (angR - sunAng)) / (2 * sunAng + 1e-9));
        if (vis < 0.002) break;
      }
      const intensity = Math.min(1.1, Math.pow(Math.max(E, 1e-6), 0.3)) * vis;
      if (!best || intensity > best.intensity) {
        best = { ndc: this.flareNdc.set(_up.x, _up.y), radius: (star.radius / d) / Math.tan((eng.camera.fov * DEG) / 2) / (eng.width / eng.height), intensity, color: this.lightColorOf(star) };
      }
    }
    this.lensFlare.update(best ? best.ndc : null, best ? best.radius : 0, best ? best.intensity : 0, best ? best.color : this.sunColor, eng.width / eng.height, dt);
  }

  private readonly flareColors = new Map<string, Vector3>();
  private lightColorOf(star: CelestialBody): Vector3 {
    if (star === this.universe.star) return this.sunColor;
    let c = this.flareColors.get(star.id);
    if (!c) {
      const a = star.data.appearance;
      const [r, g, b] = starLightColor(a.kind === 'star' ? a.temperature : 5772);
      c = new Vector3(r, g, b);
      this.flareColors.set(star.id, c);
    }
    return c;
  }

  private updateLensing(fovRad: number): void {
    const eng = this.engine;
    let best: BodyView | null = null;
    let bestScore = 0;
    for (const v of this.bodies.views) {
      if (v.body.data.type !== 'blackhole') continue;
      // Einstein angle ∝ sqrt(r_s / D)
      const score = Math.sqrt(v.body.radius / Math.max(v.distance, 1e-3));
      if (score > bestScore) { bestScore = score; best = v; }
    }
    if (!best) { eng.blackHole.enabled = false; return; }
    eng.blackHole.target(best.body, best.relPos, this.camera.quaternion, fovRad, eng.camera.aspect, eng.height, this.time.t / 3600);
  }

  /**
   * The Sun with its distance, from just outside the planets (~0.001 pc) all the way out: the one
   * reference that tells you how far from home you are when nothing else gives a sense of scale.
   */
  private sunMarker(camPos: Vector3): SunMarkerScreen | null {
    // a tour is a composed shot: no home-compass over its subtitles
    if (!this.settings.sunMarker || this.tours.active) return null;
    const dPc = this.camPc.length();
    if (dPc < SUN_MARKER_PC) return null;
    const m = this.sunScreen;
    this.universe.starRelative('c0', camPos, m.dir).normalize();
    m.label = `${_('Güneş')} · ${fmtScaleDistance(dPc * PARSEC_KM)}`;
    m.selected = this.selectedStar === 'c0' || this.selected?.id === 'sun';
    return m;
  }

  /** Turn the camera towards the Sun (sun marker / compass click). */
  private faceSun(dbl: boolean): void {
    const u = this.universe;
    if (u.current.catalogIndex === 0) {
      const sun = u.get('sun');
      if (sun) { this.center(sun); if (dbl) this.goTo(sun); }
    } else {
      this.centerStar('c0');
      if (dbl) this.goToStar('c0');
    }
  }

  /** Sky markers for black holes that live in other systems (the current one is a body). */
  private blackHoleMarkers(camPos: Vector3): NamedStarScreen[] {
    const u = this.universe;
    const out = this.bhMarkers;
    out.length = 0;
    for (let i = 0; i < u.blackHoles.length; i++) {
      const bh = u.blackHoles[i];
      if (bh.systemStarId === u.current.starId) continue;
      let m = this.bhMarkerPool[i];
      if (!m) { m = { index: -1, id: bh.entry.id, name: bh.entry.name, dir: new Vector3(), mag: 0 }; this.bhMarkerPool[i] = m; }
      m.distKm = u.starRelative(bh.systemStarId, camPos, m.dir).length();
      m.dir.normalize();
      out.push(m);
    }
    return out;
  }

  private readonly bhMarkers: NamedStarScreen[] = [];
  private readonly bhMarkerPool: NamedStarScreen[] = [];

  private saveScreenshot(): void {
    try {
      const url = this.engine.renderer.domElement.toDataURL('image/png');
      const a = document.createElement('a');
      const stamp = this.time.formatDate().replace(/[: ]/g, '-');
      a.download = `yeits-${stamp}.png`;
      a.href = url;
      a.click();
      this.ui.showToast(_('Ekran görüntüsü kaydedildi'));
    } catch {
      this.ui.showToast(_('Ekran görüntüsü alınamadı'));
    }
  }
}

async function boot(): Promise<void> {
  const loaderText = document.querySelector('#loader .loader-text');
  try {
    await initI18n();
    applyDom();
    document.title = _('Your Eyes In Space — Gözlemlenebilir evreni tarayıcıda gez');
    if (loaderText) loaderText.textContent = _('Yıldız kataloğu yükleniyor…');
    const catalog = await StarCatalog.load(import.meta.env.BASE_URL);
    if (loaderText) loaderText.textContent = _('Evren hazırlanıyor…');
    const launch = parseLaunch();
    if (launch.embed) document.body.classList.add('embed');
    const app = new App(catalog);
    // Expose for debugging / console experiments
    (window as unknown as { yeits: App }).yeits = app;
    app.launch(launch);
    // Streamer Mode (The Great Expedition): stream.* host or ?stream; its UI replaces the app's
    if (location.hostname.startsWith('stream.') || new URLSearchParams(location.search).has('stream')) {
      const { startCockpit } = await import('./expedition/host');
      app.streamView();
      startCockpit(app);
    }
  } catch (err) {
    console.error(err);
    if (loaderText) loaderText.textContent = `${_('Yükleme hatası')}: ${(err as Error).message}`;
  }
}

void boot();
