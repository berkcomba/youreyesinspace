import './style.css';
import { Matrix3, Vector3 } from 'three';
import { Engine } from './core/Engine';
import { TimeSystem } from './core/TimeSystem';
import { Universe, catalogIndexOf, type StarId } from './core/Universe';
import type { StarSystem } from './core/StarSystem';
import type { CelestialBody } from './core/CelestialBody';
import { StarCatalog } from './data/StarCatalog';
import { BodyRenderer, type BodyView } from './render/BodyRenderer';
import { BodyPoints } from './render/BodyPoints';
import { OrbitLines } from './render/OrbitLines';
import { StarPoints } from './render/StarPoints';
import { ProcStarPoints } from './render/ProcStarPoints';
import { GalaxySprites } from './render/GalaxySprites';
import { LandmarkSprites } from './render/LandmarkSprites';
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
import { DEG, PARSEC_KM } from './core/constants';
import { starLightColor } from './astro/stellar';
import { fmtDuration, fmtLightYears } from './ui/format';
import { _, applyDom, initI18n } from './i18n';
import { Missions, type ActiveMission } from './core/Missions';
import { TrajectoryLines } from './render/TrajectoryLines';
import type { MissionPlan } from './astro/mission';

const IDENTITY = new Matrix3();

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
  readonly missions: Missions;
  readonly trajectories: TrajectoryLines;
  /** camera offset from the followed vehicle, kept across frame switches */
  private readonly followOffset = new Vector3();
  private followOffsetValid = false;
  uiVisible = true;
  private wantScreenshot = false;
  private last = performance.now();
  private readonly camPosTmp = new Vector3();
  private readonly camPc = new Vector3();
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
    this.ui = new UI(this);

    this.loadSystemRenderables(this.universe.current);
    this.universe.onSystemChange((sys) => this.loadSystemRenderables(sys));

    this.resizeOverlay();
    window.addEventListener('resize', () => this.resizeOverlay());
    window.visualViewport?.addEventListener('resize', () => { this.engine.resize(); this.resizeOverlay(); });

    // Initial view: Earth, with the Moon in frame
    const earth = this.universe.get('earth')!;
    const sunDir = new Vector3().copy(this.universe.star.position).sub(earth.position).normalize();
    const offset = sunDir.clone().multiplyScalar(0.6).add(earth.pole.clone().multiplyScalar(0.35)).add(new Vector3().crossVectors(earth.pole, sunDir).multiplyScalar(0.7)).normalize().multiplyScalar(earth.radius * 4.2);
    this.camera.placeAt(earth, offset);
    this.select(earth);

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
    const u = this.universe;
    if (u.current.catalogIndex !== 0) {
      // return to the Solar System frame first
      const delta = u.switchTo('c0', this.time.jd, this.time.t);
      this.camera.shiftFrame(delta, u.star);
    }
    const b = u.get(id);
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
        if (this.camera.autopilot) this.camera.autopilot = null;
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
      this.clouds.set(i, new GalaxyCloud(i, g.model(i), scene, n, this.maxPointPx));
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

    // Camera
    const eng = this.engine;
    const fovRad = eng.camera.fov * DEG;
    this.camera.update(dt, this.input, eng.width, eng.height, fovRad);
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
    this.bodies.update(camPos, this.camera.quaternion, eng.camera, eng.height, fovRad, star.position, star.radius, this.sunColor, this.time.t / 3600, {
      atmospheres: s.atmospheres, clouds: s.clouds, rings: s.rings, shadows: s.shadows, imagery: s.imagery,
    });
    this.ui.setImageryCredit(this.bodies.imageryCredit);
    this.updateLensing(fovRad);
    this.points.setPixelRatio(eng.pixelRatio);
    this.points.update(star.position, camPos, this.starLuminosity);
    this.starPoints.setPixelRatio(eng.pixelRatio);
    this.starPoints.update(this.camPc, this.universe.current.catalogIndex);
    this.procPoints.update(this.camPc, eng.pixelRatio, this.universe.current.starId, dt);
    for (const c of this.clouds.values()) c.update(this.camPc, pxPerRad, eng.pixelRatio, s.milkyWay);
    this.galaxySprites.update(this.camPc, pxPerRad, eng.pixelRatio, this.galaxyBoost, this.universe.currentGalaxy ?? -1);
    this.landmarkSprites.update(this.camPc, pxPerRad, this.universe.current.starId, (gi) => this.galaxySprites.apparent(gi).ratio);
    // LOD hand-over between the detailed local volume and the aggregated far-universe tiers
    const dSunPc = this.camPc.length();
    this.galaxySprites.setFade(localFade(dSunPc));
    this.farSprites.forEach((sp, k) => {
      sp.setFade(this.farUniverse.tiers[k].fade(dSunPc));
      sp.update(this.camPc, pxPerRad, eng.pixelRatio, this.galaxyBoost, -1);
    });
    this.orbits.update(camPos, s.orbits, s.moonOrbits, pxPerRad, (id) => this.bodies.byId.get(id)?.apparentRadiusPx ?? 0, this.selected?.id ?? null);
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
    this.overlay.draw(this.bodies.views, eng.camera, this.selected, namedStars, starSel, this.uiVisible, s.galaxies ? this.galaxySprites.named : [], this.blackHoleMarkers(camPos), this.landmarkSprites.named);
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
