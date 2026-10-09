import './style.css';
import { Matrix3, Quaternion, Vector3 } from 'three';
import { Engine } from './core/Engine';
import { TimeSystem } from './core/TimeSystem';
import { Universe, catalogIndexOf, type StarId } from './core/Universe';
import type { StarSystem } from './core/StarSystem';
import { CelestialBody } from './core/CelestialBody';
import { StarCatalog } from './data/StarCatalog';
import { LightPulse } from './render/TourEffects';
import { BodyRenderer, type BodyView } from './render/BodyRenderer';
import { BodyPoints } from './render/BodyPoints';
import { OrbitLines } from './render/OrbitLines';
import { StarPoints } from './render/StarPoints';
import { ProcStarPoints } from './render/ProcStarPoints';
import { GalaxySprites } from './render/GalaxySprites';
import { LandmarkSprites } from './render/LandmarkSprites';
import { NebulaClouds } from './render/NebulaClouds';
import { GalaxyCloud } from './render/GalaxyCloud';
import { FarUniverse, localFade } from './galaxy/FarUniverse';
import { Belts } from './render/Belts';
import { SkyGrid } from './render/SkyGrid';
import { Overlay, type StarSelectionScreen } from './render/Overlay';
import type { NamedStarScreen } from './render/StarPoints';
import { Input } from './input/Input';
import { CameraController } from './camera/CameraController';
import { UI, type UIHost } from './ui/UI';
import { loadSettings, saveSettings, type Settings } from './ui/Settings';
import { DAY_S, DEG, PARSEC_KM } from './core/constants';
import { starLightColor } from './astro/stellar';
import { fmtDuration, fmtLightYears } from './ui/format';
import { _, applyDom, initI18n } from './i18n';
import { Missions, type ActiveMission } from './core/Missions';
import { TrajectoryLines } from './render/TrajectoryLines';
import { TourPlayer, type SurfacePin, type TourOverrides } from './core/TourPlayer';
import type { MissionPlan } from './astro/mission';

const IDENTITY = new Matrix3();
/** Flight time of a tour cue's hop (overview and back): quick, so the demo fits in one sentence */
const TOUR_HOP_S = 1.6;

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
  readonly points: BodyPoints;
  readonly orbits: OrbitLines;
  readonly belts: Belts;
  readonly grid: SkyGrid;
  readonly overlay: Overlay;
  readonly input: Input;
  readonly camera: CameraController;
  readonly ui: UI;
  selected: CelestialBody | null = null;
  selectedStar: StarId | null = null;
  selectedGalaxy: number | null = null;
  /** selected deep-sky landmark (index into universe.landmarks) when nothing else is selected */
  selectedLandmark: number | null = null;
  readonly landmarkSprites: LandmarkSprites;
  readonly nebulaClouds: NebulaClouds;
  readonly missions: Missions;
  readonly trajectories: TrajectoryLines;
  readonly tours: TourPlayer;
  /** render settings forced by the running tour (empty when none) */
  private tourOverrides: TourOverrides = {};
  /** labelled surface feature the overlay points at (tours) */
  private surfacePin: SurfacePin | null = null;
  private readonly pinScreen = { dir: new Vector3(), label: '', visible: false };
  /** tour size comparison: a true-scale stand-in of `ref` kept at the screen-right of `beside` */
  private ghost: { body: CelestialBody; ref: CelestialBody; beside: CelestialBody } | null = null;
  private pulse: LightPulse | null = null;
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
    this.orbits = new OrbitLines(scene);
    this.bodies = new BodyRenderer(scene, this.engine.renderer.capabilities.getMaxAnisotropy());
    this.points = new BodyPoints(scene);
    this.overlay = new Overlay(overlayCanvas);
    this.input = new Input(sceneCanvas);
    this.camera = new CameraController(this.universe);
    this.trajectories = new TrajectoryLines(scene);
    this.missions = new Missions(this.universe, {
      spawned: (m, b) => this.onMissionSpawned(m, b),
      despawned: (m, b) => this.onMissionDespawned(m, b),
      frameSwitch: (m, systemId) => this.onMissionFrameSwitch(m, systemId),
      arrived: (m) => this.onMissionArrived(m),
    });
    this.tours = new TourPlayer(this);
    this.tours.onEnd = (why) => this.ui.showToast(why === 'finished' ? _('Tur tamamlandı') : _('Tur bitirildi'), 2400);
    this.ui = new UI(this);

    this.loadSystemRenderables(this.universe.current);
    this.universe.onSystemChange((sys) => this.loadSystemRenderables(sys));

    this.resizeOverlay();
    window.addEventListener('resize', () => this.resizeOverlay());
    window.visualViewport?.addEventListener('resize', () => { this.engine.resize(); this.resizeOverlay(); });

    // Opening view: the planetary system out to Jupiter from above the ecliptic, slowly circling
    // the Sun as a backdrop until the visitor picks a destination
    const sun = this.universe.star;
    const earth = this.universe.get('earth')!;
    const outer = this.universe.get('jupiter') ?? earth;
    const span = outer.resolved?.a ?? outer.localPosition.length();
    const north = earth.orbitNormal.lengthSq() > 1e-6 ? earth.orbitNormal : sun.pole;
    const toEarth = new Vector3().copy(earth.position).sub(sun.position).normalize();
    // ~40° from the pole, leaning to Earth's side so the inner system sits in the foreground
    const dir = north.clone().addScaledVector(toEarth, 0.85).normalize();
    this.camera.placeAt(sun, dir.multiplyScalar(span * 2.5));
    this.camera.autoOrbit = 0.03;

    this.input.onClick = (x, y, dbl) => this.onClick(x, y, dbl);
    this.input.onKey = (code, e) => this.onKey(code, e);
    this.input.onLockChange = (locked) => this.onLockChange(locked);
    sceneCanvas.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse' || this.input.dragging || this.input.locked) { this.overlay.hoverId = null; return; }
      const b = this.overlay.pick(e.clientX, e.clientY, 16);
      this.overlay.hoverId = b?.id ?? null;
      sceneCanvas.style.cursor = b ? 'pointer' : 'default';
    });

    // Galaxy-scale state for the first frame
    this.universe.toParsecs(this.camera.position, this.camPc);
    this.updateGalaxyScale(true);

    this.applySettings();
    requestAnimationFrame(this.frame);
    document.getElementById('loader')?.classList.add('done');
  }

  /** The 2D overlay always draws at device resolution (crisp text), whatever the 3D render scale. */
  private resizeOverlay(): void {
    this.overlay.resize(this.engine.width, this.engine.height, Math.min(window.devicePixelRatio || 1, 2));
  }

  /** (Re)build every per-system renderable when the current frame changes. */
  private loadSystemRenderables(sys: StarSystem): void {
    this.bodies.setSystem(sys);
    this.orbits.setSystem(sys);
    this.points.setViews(this.bodies.views);
    this.belts.setSystem(sys.belts, sys.star.gm, sys.catalogIndex === 0 ? IDENTITY : sys.star.poleBasis);
    const [r, g, b] = starLightColor(sys.starTemperature);
    this.sunColor.set(r, g, b);
    this.starLuminosity = sys.catalogIndex === 0 ? 1 : this.universe.starInfo(sys.starId).luminosity;
  }

  /* ---------------- UIHost ---------------- */
  select(b: CelestialBody | null): void {
    this.selected = b;
    if (b) { this.selectedStar = null; this.selectedGalaxy = null; this.selectedLandmark = null; }
  }

  selectStar(id: StarId | null): void {
    this.selectedStar = id;
    if (id !== null) { this.selected = null; this.selectedGalaxy = null; this.selectedLandmark = null; }
  }

  selectGalaxy(i: number | null): void {
    this.selectedGalaxy = i;
    if (i !== null) { this.selected = null; this.selectedStar = null; this.selectedLandmark = null; }
  }

  selectLandmark(i: number | null): void {
    // star-type landmarks are real systems: select them as stars
    const sysId = i !== null ? this.universe.landmarks[i].systemId : null;
    if (sysId !== null) { this.selectStar(sysId); return; }
    this.selectedLandmark = i;
    if (i !== null) { this.selected = null; this.selectedStar = null; this.selectedGalaxy = null; }
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
    this.camera.goTo(b, this.universe.star.position);
    this.ui.showToast(_('{name} hedefine uçuluyor…', { name: b.name }));
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
    return ci >= 0 ? this.starPoints.apparentMag(ci) : this.procPoints.apparentMag(id);
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
    this.camera.goTo(body, u.star.position);
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

  /* ---------------- tour cues ---------------- */

  /** Pull back above `bodyId`'s orbit around its parent so the whole orbit is in view. */
  goToOverview(bodyId: string): void {
    const b = this.universe.get(bodyId);
    const p = b?.parent;
    if (!b || !p) return;
    const a = b.resolved?.a ?? b.localPosition.length();
    // ~70° above the orbital plane, leaning to the body's side so it sits in the foreground;
    // 2.7 a keeps the whole orbit inside a ~50° field of view
    const toBody = new Vector3().copy(b.position).sub(p.position).normalize();
    const dir = new Vector3().copy(b.orbitNormal);
    if (dir.lengthSq() < 1e-6) dir.copy(p.pole);
    dir.addScaledVector(toBody, 0.35).normalize();
    this.select(b);
    this.camera.goToVantage(p, dir, Math.max(a * 2.7, p.radius * 6), TOUR_HOP_S);
  }

  /** Hop back to `bodyId` after an overview/pin cue (quick flight, no toast). */
  returnTo(bodyId: string): void {
    const b = this.universe.get(bodyId);
    if (!b) return;
    this.select(b);
    this.camera.goTo(b, this.universe.star.position, TOUR_HOP_S);
  }

  /** Camera `elev`° above the equator plane, `az`° around the pole from the noon meridian, `dist` radii out. */
  goToVantageOf(bodyId: string, elev: number, az: number, dist: number): void {
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
    const minD = b.data.rings ? Math.max(b.radius * dist, b.data.rings.outer * 1.15) : b.radius * dist;
    this.select(b);
    this.camera.goToVantage(b, dir, minD, TOUR_HOP_S * 1.5);
  }

  /** Unit vector from `b` toward the Sun, projected onto its equator plane (the sub-solar meridian). */
  private noonDirection(b: CelestialBody, out: Vector3): Vector3 {
    const star = this.universe.star;
    if (star === b) {
      const e = this.universe.get('earth');
      out.copy(e ? e.position : new Vector3(1, 0, 0)).sub(b.position);
    } else out.copy(star.position).sub(b.position);
    out.addScaledVector(b.pole, -out.dot(b.pole));
    if (out.lengthSq() < 1e-6) out.set(1, 0, 0).addScaledVector(b.pole, -b.pole.x);
    return out.normalize();
  }

  setComparison(refId: string | null, besideId?: string): void {
    if (this.ghost) {
      this.bodies.removeBody(this.ghost.body.id);
      this.points.setViews(this.bodies.views);
      this.ghost = null;
    }
    if (!refId || !besideId) return;
    const ref = this.universe.get(refId);
    const beside = this.universe.get(besideId);
    if (!ref || !beside || ref === beside) return;
    // a detached copy: same appearance and radius, no orbit, positioned by hand every frame
    const body = new CelestialBody({ ...ref.data, id: 'tour-ghost', orbit: undefined });
    body.pole.copy(ref.pole);
    body.rotation.copy(ref.rotation);
    this.ghost = { body, ref, beside };
    this.placeGhost();
    this.bodies.addBody(body, this.universe.current);
    this.points.setViews(this.bodies.views);
    // back off until both fit side by side (≈ 60 % of a ~70° horizontal field)
    const width = 2 * this.ghostAnchorRadius(beside) + 2.7 * ref.radius;
    const need = width * 1.25;
    const ap = this.camera.autopilot;
    if (ap && ap.kind === 'goto' && ap.target === beside) {
      // still on the way in: just stop the approach further out
      ap.dist1 = Math.max(ap.dist1, need);
      return;
    }
    const cur = this.camera.position.distanceTo(beside.position);
    if (need > cur * 1.05) {
      const dir = new Vector3().copy(this.camera.position).sub(beside.position).normalize();
      this.camera.goToVantage(beside, dir, need, TOUR_HOP_S);
    }
  }

  private ghostAnchorRadius(b: CelestialBody): number {
    return b.data.rings ? Math.max(b.radius, b.data.rings.outer) : b.radius;
  }

  /** Keep the comparison body at the screen-right of its anchor, at the same depth, spinning like the original. */
  private placeGhost(): void {
    const g = this.ghost;
    if (!g) return;
    const right = new Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
    const gap = this.ghostAnchorRadius(g.beside) + g.ref.radius * 1.35;
    g.body.position.copy(g.beside.position).addScaledVector(right, gap);
    g.body.rotation.copy(g.ref.rotation);
    g.body.pole.copy(g.ref.pole);
    g.body.distanceToStar = g.body.position.distanceTo(this.universe.star.position);
  }

  setPulse(p: { from: string; to: string; seconds: number } | null): void {
    if (!p) { this.pulse?.stop(); return; }
    const a = this.universe.get(p.from);
    const b = this.universe.get(p.to);
    if (!a || !b) return;
    this.pulse ??= new LightPulse(this.engine.scene);
    this.pulse.start(a, b, p.seconds);
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
      left.copy(this.universe.star.position).sub(b.position).normalize();
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
  private bringIntoDaylight(b: CelestialBody, dir: Vector3): void {
    // tidally locked moons spin once per orbit (prograde about the pole): the Sun sweeps their
    // surface once per orbital period, so the same jump logic applies with that period
    const spinS = b.data.rotationPeriod === 'sync' ? b.periodDays * DAY_S : b.rotationPeriodS;
    if (!spinS || !Number.isFinite(spinS) || this.universe.star === b) return;
    const toSun = new Vector3().copy(this.universe.star.position).sub(b.position).normalize();
    if (dir.dot(toSun) > 0.5) return; // Sun already more than 30° up
    const sunT = toSun.clone().addScaledVector(b.pole, -toSun.dot(b.pole));
    const dirT = dir.clone().addScaledVector(b.pole, -dir.dot(b.pole));
    if (sunT.lengthSq() < 1e-6 || dirT.lengthSq() < 1e-6) return; // polar: no rotation helps
    sunT.normalize(); dirT.normalize();
    // signed angle from the feature to the sub-solar meridian about the pole (spin is +about pole)
    const phi = Math.atan2(b.pole.dot(new Vector3().crossVectors(dirT, sunT)), dirT.dot(sunT));
    const omega = (2 * Math.PI) / spinS;
    let dt = phi / omega;
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
    const d = this.pinDirection(b, pin.lat, pin.lon, pin.storm ?? false, this.aimDir).multiplyScalar(b.radius).add(b.position).sub(cam.position).normalize();
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
  private readonly aimQ = new Quaternion();
  private readonly aimEase = new Quaternion();

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

  setTourOverrides(o: TourOverrides): void {
    this.tourOverrides = o;
  }

  setSurfacePin(pin: SurfacePin | null): void {
    this.surfacePin = pin;
  }

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

  applySettings(): void {
    const s = this.settings;
    saveSettings(s);
    this.engine.setFov(s.fov);
    this.engine.bloom.enabled = s.bloom;
    this.engine.setRenderScale(s.renderScale);
    this.resizeOverlay();
    this.engine.renderer.toneMappingExposure = s.exposure;
    this.overlay.showLabels = s.labels;
    this.overlay.showMarkers = s.markers;
    this.overlay.showStarNames = s.starNames;
    this.overlay.showGalaxyNames = s.galaxyNames;
    this.grid.setVisible(s.eclipticGrid, s.equatorialGrid);
    this.galaxySprites.setVisible(s.galaxies);
    for (const sp of this.farSprites) sp.setVisible(s.galaxies);
    // "what is real?" view: generated stars & galaxies in green
    this.procPoints.setHighlight(s.highlightProcedural);
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

  toggleUI(): void {
    this.uiVisible = !this.uiVisible;
    document.getElementById('ui')?.classList.toggle('hidden', !this.uiVisible);
  }

  /* ---------------- Input ---------------- */
  private onClick(x: number, y: number, dbl: boolean): void {
    // fingers are less precise than a mouse pointer
    const tol = this.input.coarse ? 2 : 1;
    const b = this.overlay.pick(x, y, 22 * tol);
    if (b) {
      this.select(b);
      if (dbl) this.goTo(b);
      return;
    }
    const eng = this.engine;
    const u = this.universe;
    const star = this.starPoints.pick(x, y, eng.camera, eng.width, eng.height, u.current.catalogIndex, 14 * tol);
    if (star !== null) {
      this.selectStar(`c${star}`);
      if (dbl) this.goToStar(`c${star}`);
      return;
    }
    const proc = this.procPoints.pick(x, y, eng.camera, eng.width, eng.height, u.current.starId, 14 * tol);
    if (proc !== null) {
      this.selectStar(proc);
      if (dbl) this.goToStar(proc);
      return;
    }
    const lm = this.landmarkSprites.pick(x, y, eng.camera, eng.width, eng.height, 14 * tol);
    if (lm !== null) {
      this.selectLandmark(lm);
      if (dbl) this.goToLandmark(lm);
      return;
    }
    const fovRad = eng.camera.fov * DEG;
    const pxPerRad = eng.height / 2 / Math.tan(fovRad / 2);
    const gal = this.galaxySprites.pick(x, y, eng.camera, eng.width, eng.height, pxPerRad, this.galaxyBoost, u.currentGalaxy ?? -1, 14 * tol);
    if (gal !== null) {
      this.selectGalaxy(gal);
      if (dbl) this.goToGalaxy(gal);
    }
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
        break;
      case 'KeyC':
        if (sel) this.center(sel);
        else if (this.selectedStar !== null) this.centerStar(this.selectedStar);
        else if (this.selectedGalaxy !== null) this.centerGalaxy(this.selectedGalaxy);
        else if (this.selectedLandmark !== null) this.centerLandmark(this.selectedLandmark);
        break;
      case 'KeyT': this.toggleFollow(); break;
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
        if (this.tours.active) { this.tours.stop(); this.ui.showToast(_('Tur bitirildi')); }
        else if (this.camera.autopilot) this.camera.autopilot = null;
        else { this.select(null); this.selectStar(null); this.selectGalaxy(null); this.selectLandmark(null); }
        this.ui.toggleHelp(false);
        break;
      case 'KeyJ': this.time.reverseWarp(); break;
      case 'KeyK': this.time.togglePause(); break;
      case 'KeyL': this.time.forwardWarp(); break;
      case 'Backslash': this.time.setNow(); this.ui.showToast(_('Gerçek zaman')); break;
      case 'KeyO': s.orbits = !s.orbits; this.applySettings(); this.ui.showToast(`${_('Yörüngeler')}: ${s.orbits ? _('açık') : _('kapalı')}`); break;
      case 'KeyN': s.labels = !s.labels; s.markers = s.labels; this.applySettings(); this.ui.showToast(`${_('Etiketler')}: ${s.labels ? _('açık') : _('kapalı')}`); break;
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

    // clouds for every galaxy within 18 radii (sprite ↔ cloud crossfade range)
    const wanted = new Set<number>();
    for (let i = 0; i < g.count; i++) {
      const dx = g.positions[i * 3] - camPc.x, dy = g.positions[i * 3 + 1] - camPc.y, dz = g.positions[i * 3 + 2] - camPc.z;
      if (Math.sqrt(dx * dx + dy * dy + dz * dz) < g.radius[i] * 18) wanted.add(i);
    }
    for (const [i, c] of this.clouds) if (!wanted.has(i)) { c.dispose(scene); this.clouds.delete(i); }
    for (const i of wanted) {
      if (this.clouds.has(i) || this.clouds.size >= 3) continue;
      const n = i === 0 ? 260_000 : Math.round(Math.min(160_000, 40_000 + g.radius[i] * 6));
      const cloud = new GalaxyCloud(i, g.model(i), scene, n, this.maxPointPx);
      cloud.setHighlight(this.settings.highlightProcedural);
      this.clouds.set(i, cloud);
    }

    // procedural stars for the galaxy we're in
    u.procStars.update(camPc, inside);

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

  /* ---------------- Frame ---------------- */
  private frame = (now: number): void => {
    requestAnimationFrame(this.frame);
    const dt = Math.min(0.1, Math.max(0.0001, (now - this.last) / 1000));
    this.last = now;

    // Simulation
    this.time.advance(dt);
    this.missions.update(this.time.jd, this.time.t);
    this.universe.update(this.time.jd, this.time.t);
    this.tours.update(dt);

    // Camera
    const eng = this.engine;
    const fovRad = eng.camera.fov * DEG;
    this.camera.update(dt, this.input, eng.width, eng.height, fovRad);
    this.aimAtPin(dt, fovRad, eng.width / Math.max(1, eng.height));
    this.checkFrameSwitch(dt);
    eng.camera.quaternion.copy(this.camera.quaternion);
    eng.camera.position.set(0, 0, 0);
    eng.camera.updateMatrixWorld();

    const camPos = this.camPosTmp.copy(this.camera.position);
    const star = this.universe.star;
    const sunRel = new Vector3().copy(star.position).sub(camPos);
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
    if (this.ghost) this.placeGhost();
    if (this.pulse?.active) this.pulse.update(dt, camPos, pxPerRad);
    this.bodies.update(camPos, this.camera.quaternion, eng.camera, eng.height, fovRad, star.position, star.radius, this.sunColor, this.time.t / 3600, {
      atmospheres: s.atmospheres, clouds: ov.clouds ?? s.clouds, rings: s.rings, shadows: s.shadows, imagery: s.imagery,
    });
    this.updateLensing(fovRad);
    this.points.setPixelRatio(eng.pixelRatio);
    this.points.update(star.position, camPos, this.starLuminosity);
    this.starPoints.setPixelRatio(eng.pixelRatio);
    this.starPoints.update(this.camPc, this.universe.current.catalogIndex);
    this.procPoints.update(this.camPc, eng.pixelRatio, this.universe.current.starId, dt);
    for (const c of this.clouds.values()) c.update(this.camPc, pxPerRad, eng.pixelRatio, s.milkyWay);
    this.galaxySprites.update(this.camPc, pxPerRad, eng.pixelRatio, this.galaxyBoost, this.universe.currentGalaxy ?? -1);
    this.landmarkSprites.update(this.camPc, pxPerRad, this.universe.current.starId, (gi) => this.galaxySprites.apparent(gi).ratio);
    this.nebulaClouds.update(this.camPc, pxPerRad, eng.pixelRatio, this.landmarkSprites.k, this.landmarkSprites.mesh.visible);
    // bottom-left credit: streamed planetary imagery first, otherwise a resolved landmark photograph
    if (this.bodies.imageryCredit) this.ui.setImageryCredit(this.bodies.imageryCredit);
    else {
      this.camForward.set(0, 0, -1).applyQuaternion(this.camera.quaternion);
      const photo = this.landmarkSprites.photoCredit(this.camForward);
      this.ui.setImageryCredit(photo ? _('Fotoğraf: {source}', { source: photo }) : null, true);
    }
    // LOD hand-over between the detailed local volume and the aggregated far-universe tiers
    const dSunPc = this.camPc.length();
    this.galaxySprites.setFade(localFade(dSunPc));
    this.farSprites.forEach((sp, k) => {
      sp.setFade(this.farUniverse.tiers[k].fade(dSunPc));
      sp.update(this.camPc, pxPerRad, eng.pixelRatio, this.galaxyBoost, -1);
    });
    this.orbits.update(camPos, ov.orbits ?? s.orbits, ov.moonOrbits ?? s.moonOrbits, pxPerRad, (id) => this.bodies.byId.get(id)?.apparentRadiusPx ?? 0, this.selected?.id ?? null);
    this.trajectories.update(camPos, this.time.jd, this.missions.lookup, s.orbits, eng.width * eng.pixelRatio, eng.height * eng.pixelRatio);
    this.belts.update(this.time.t, sunRel, eng.pixelRatio, s.belts);

    // Render
    eng.render();

    if (this.wantScreenshot) {
      this.wantScreenshot = false;
      this.saveScreenshot();
    }

    // Overlay & UI
    let starSel: StarSelectionScreen | null = null;
    if (this.selectedStar !== null) {
      this.starSel.name = this.universe.starName(this.selectedStar);
      this.universe.starRelative(this.selectedStar, camPos, this.starSel.dir).normalize();
      this.starSel.kind = 'star';
      this.starSel.radiusPx = 0;
      starSel = this.starSel;
    } else if (this.selectedGalaxy !== null) {
      const i = this.selectedGalaxy;
      this.starSel.name = this.universe.galaxies.name(i);
      this.galaxySprites.direction(i, this.starSel.dir);
      this.starSel.kind = 'galaxy';
      this.starSel.radiusPx = Math.min(this.galaxySprites.apparent(i).angRad * pxPerRad, eng.height);
      starSel = this.starSel;
    } else if (this.selectedLandmark !== null) {
      const i = this.selectedLandmark;
      this.starSel.name = this.universe.landmarks[i].def.name;
      this.landmarkSprites.direction(i, this.starSel.dir);
      this.starSel.kind = 'landmark';
      this.starSel.radiusPx = Math.min(this.landmarkSprites.angularRadius(i) * pxPerRad, eng.height);
      starSel = this.starSel;
    }
    const namedStars = this.procPoints.namedStars.length
      ? this.starPoints.namedStars.concat(this.procPoints.namedStars)
      : this.starPoints.namedStars;
    // tour surface pin: world point on the body, hidden when it faces away from us
    const pin = this.pinScreen;
    pin.visible = false;
    if (this.surfacePin) {
      const b = this.universe.get(this.surfacePin.bodyId);
      if (b) {
        const sp = this.surfacePin;
        const n = this.pinDirection(b, sp.lat, sp.lon, !!sp.storm, this.camForward);
        const toCam = new Vector3().copy(camPos).sub(b.position).addScaledVector(n, -b.radius);
        pin.visible = n.dot(toCam) > 0;
        pin.dir.copy(b.position).addScaledVector(n, b.radius).sub(camPos);
        pin.label = _(sp.label);
      }
    }
    this.overlay.draw(this.bodies.views, eng.camera, this.selected, namedStars, starSel, this.uiVisible, s.galaxies ? this.galaxySprites.named : [], this.blackHoleMarkers(camPos), this.landmarkSprites.named, pin.visible ? pin : null);
    const selDist = this.selected ? this.bodies.byId.get(this.selected.id)?.distance ?? 0 : 0;
    this.ui.update(now, dt, selDist);
  };

  /** Hand the most prominent black hole in the current system to the lensing pass. */
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

  /** Sky markers for black holes that live in other systems (the current one is a body). */
  private blackHoleMarkers(camPos: Vector3): NamedStarScreen[] {
    const u = this.universe;
    const out = this.bhMarkers;
    out.length = 0;
    for (let i = 0; i < u.blackHoles.length; i++) {
      const bh = u.blackHoles[i];
      if (bh.systemStarId === u.current.starId) continue;
      let m = this.bhMarkerPool[i];
      if (!m) { m = { index: -1, name: bh.entry.name, dir: new Vector3(), mag: 0 }; this.bhMarkerPool[i] = m; }
      u.starRelative(bh.systemStarId, camPos, m.dir).normalize();
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
    const app = new App(catalog);
    // Expose for debugging / console experiments
    (window as unknown as { yeits: App }).yeits = app;
  } catch (err) {
    console.error(err);
    if (loaderText) loaderText.textContent = `${_('Yükleme hatası')}: ${(err as Error).message}`;
  }
}

void boot();
