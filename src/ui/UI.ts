import type { CelestialBody } from '../core/CelestialBody';
import { MissionPanel, type MissionPanelHost } from './MissionPanel';
import { TourPanel } from './TourPanel';
import type { TourPlayer } from '../core/TourPlayer';
import { phaseLabel } from '../astro/mission';
import { binaryPartner } from '../astro/binary';
import { _, fixed, fmtNum, LOCALES, currentLocale, setLocale, type Locale } from '../i18n';
import type { TimeSystem } from '../core/TimeSystem';
import type { Universe } from '../core/Universe';
import type { CameraController } from '../camera/CameraController';
import type { StarPoints } from '../render/StarPoints';
import type { GalaxySprites } from '../render/GalaxySprites';
import type { LandmarkSprites } from '../render/LandmarkSprites';
import { LANDMARK_KIND_LABEL } from '../data/landmarks';
import { AU_KM, LIGHT_YEAR_KM, PARSEC_KM, RAD } from '../core/constants';
import { LUM_CLASS_DESC, SUN_MASS_KG } from '../astro/stellar';
import { GALAXY_TYPE_LABEL } from '../galaxy/GalaxyModel';
import { catalogIndexOf, type StarId } from '../core/Universe';
import type { Settings } from './Settings';
import {
  fmtDeg, fmtDistance, fmtSolarMass, fmtDuration, fmtLightYears, fmtMass, fmtRadius, fmtSci, fmtSpeed, fmtTemp, TYPE_LABELS, typeLabel,
} from './format';
import { PLACES } from './places';

/** body types that act as the light source / primary of a system */
function isPrimaryType(t: string): boolean {
  return t === 'star' || t === 'pulsar' || t === 'blackhole' || t === 'barycenter';
}

export interface UIHost extends MissionPanelHost {
  universe: Universe;
  time: TimeSystem;
  camera: CameraController;
  settings: Settings;
  tours: TourPlayer;
  starPoints: StarPoints;
  galaxySprites: GalaxySprites;
  landmarkSprites: LandmarkSprites;
  readonly selected: CelestialBody | null;
  /** selected star (universal id) when no body is selected */
  readonly selectedStar: StarId | null;
  /** selected galaxy (index) when nothing else is selected */
  readonly selectedGalaxy: number | null;
  /** selected deep-sky landmark (index) when nothing else is selected */
  readonly selectedLandmark: number | null;
  select(b: CelestialBody | null): void;
  selectStar(id: StarId | null): void;
  selectGalaxy(i: number | null): void;
  selectLandmark(i: number | null): void;
  goToLandmark(i: number): void;
  centerLandmark(i: number): void;
  goTo(b: CelestialBody): void;
  goToStar(id: StarId): void;
  goToGalaxy(i: number): void;
  center(b: CelestialBody): void;
  centerStar(id: StarId): void;
  centerGalaxy(i: number): void;
  /** apparent magnitude of a star from the camera (null if not currently generated) */
  starApparentMag(id: StarId): number | null;
  toggleFollow(): void;
  /** fly to a Solar-System body by id (switching back to the Solar System frame if needed) */
  goToBodyId(id: string): void;
  /** fly to a body of any system (switching the reference frame to that system first) */
  goToSystemBody(starId: StarId, bodyId: string): void;
  /** fly to a black hole by universal id (`b0`, `cygx1`, …), switching frames if needed */
  goToBlackHole(id: string): void;
  centerBlackHole(id: string): void;
  /** free roam: pointer-locked mouse look + WASD flight */
  toggleFreeRoam(): void;
  readonly freeRoam: boolean;
  applySettings(): void;
  screenshot(): void;
  toggleUI(): void;
}

function $<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element #${id}`);
  return el as T;
}

interface SettingDef {
  key: keyof Settings;
  label: string;
  kind: 'bool' | 'range';
  min?: number;
  max?: number;
  step?: number;
  group?: string;
}

const SETTING_DEFS: SettingDef[] = [
  { key: 'orbits', label: 'Yörüngeler', kind: 'bool', group: 'Görüntü' },
  { key: 'moonOrbits', label: 'Uydu yörüngeleri', kind: 'bool' },
  { key: 'labels', label: 'Etiketler', kind: 'bool' },
  { key: 'markers', label: 'İşaretçiler', kind: 'bool' },
  { key: 'starNames', label: 'Yıldız isimleri', kind: 'bool' },
  { key: 'galaxyNames', label: 'Galaksi isimleri', kind: 'bool' },
  { key: 'eclipticGrid', label: 'Ekliptik ızgara', kind: 'bool' },
  { key: 'equatorialGrid', label: 'Ekvatoral ızgara', kind: 'bool' },
  { key: 'belts', label: 'Asteroit / Kuiper kuşağı', kind: 'bool' },
  { key: 'milkyWay', label: 'Galaksi yıldız bulutları', kind: 'bool' },
  { key: 'galaxies', label: 'Uzak galaksiler', kind: 'bool' },
  { key: 'highlightProcedural', label: 'Prosedürel nesneleri yeşile boya', kind: 'bool' },
  { key: 'atmospheres', label: 'Atmosferler', kind: 'bool', group: 'Render' },
  { key: 'clouds', label: 'Bulutlar', kind: 'bool' },
  { key: 'rings', label: 'Halkalar', kind: 'bool' },
  { key: 'shadows', label: 'Tutulma / halka gölgeleri', kind: 'bool' },
  { key: 'imagery', label: 'Uydu görüntüleri (NASA)', kind: 'bool' },
  { key: 'bloom', label: 'Bloom (parıltı)', kind: 'bool' },
  { key: 'exposure', label: 'Pozlama', kind: 'range', min: 0.3, max: 2.5, step: 0.05 },
  { key: 'renderScale', label: 'Render çözünürlüğü', kind: 'range', min: 0.5, max: 1, step: 0.05 },
  { key: 'fov', label: 'Görüş açısı', kind: 'range', min: 20, max: 110, step: 1, group: 'Kamera' },
  { key: 'mouseSensitivity', label: 'Fare hassasiyeti', kind: 'range', min: 0.2, max: 3, step: 0.1 },
  { key: 'invertY', label: 'Y eksenini ters çevir', kind: 'bool' },
];

/** Info-grid rows → HTML; labels and plain-text values are run through the dictionary */
function rowsHtml(rows: Array<[string, string] | 'sep'>): string {
  return rows
    .map((r) => (r === 'sep' ? '<div class="sep"></div>' : `<dt>${_(r[0])}</dt><dd>${_(r[1])}</dd>`))
    .join('');
}

export class UI {
  private readonly info = $('info');
  private readonly infoName = $('info-name');
  private readonly infoType = $('info-type');
  private readonly infoParent = $('info-parent');
  private readonly infoBody = $('info-body');
  private readonly infoDesc = $('info-desc');
  private readonly settingsPanel = $('settings');
  private readonly help = $('help');
  private readonly toast = $('toast');
  private readonly searchInput = $<HTMLInputElement>('search-input');
  private readonly searchResults = $<HTMLUListElement>('search-results');
  private readonly followBtn = $<HTMLButtonElement>('act-follow');
  private readonly brandSub = $('brand-sub');
  private readonly pauseBtn = $<HTMLButtonElement>('t-pause');
  private readonly roamBtn = $<HTMLButtonElement>('btn-roam');
  private readonly placesBtn = $<HTMLButtonElement>('btn-places');
  private readonly placesMenu = $('places-menu');
  readonly missionPanel: MissionPanel;
  readonly tourPanel: TourPanel;
  private lastInfoUpdate = 0;
  private toastTimer = 0;
  private searchIndex = -1;
  private fpsAcc = 0;
  private fpsCount = 0;
  private fps = 0;

  constructor(private readonly host: UIHost) {
    this.bindTime();
    this.bindActions();
    this.bindSearch();
    this.buildSettings();
    this.buildPlaces();
    this.roamBtn.addEventListener('click', () => host.toggleFreeRoam());
    $('btn-help').addEventListener('click', () => this.toggleHelp());
    $('help-close').addEventListener('click', () => this.toggleHelp(false));
    this.help.addEventListener('click', (e) => { if (e.target === this.help) this.toggleHelp(false); });
    $('btn-settings').addEventListener('click', () => this.toggleSettings());
    this.missionPanel = new MissionPanel(host);
    $('btn-mission').addEventListener('click', () => this.toggleMission());
    this.tourPanel = new TourPanel(host.tours, (show) => { if (show) { this.toggleSettings(false); this.missionPanel.toggle(false); } });
    $('btn-tours').addEventListener('click', () => this.toggleTours());
    // phones: the info sheet starts folded (name + actions) so the view stays visible
    if (window.matchMedia('(max-width: 700px)').matches) this.info.classList.add('collapsed');
    $('info-expand').addEventListener('click', () => this.info.classList.toggle('collapsed'));
    $('info-close').addEventListener('click', () => { host.select(null); host.selectStar(null); host.selectGalaxy(null); host.selectLandmark(null); });
  }

  /* ---------------- Time ---------------- */
  private bindTime(): void {
    const t = this.host.time;
    $('t-rev').addEventListener('click', () => t.reverseWarp());
    $('t-slow').addEventListener('click', () => t.slower());
    $('t-pause').addEventListener('click', () => t.togglePause());
    $('t-fast').addEventListener('click', () => t.faster());
    $('t-fwd').addEventListener('click', () => t.forwardWarp());
    $('t-now').addEventListener('click', () => { t.setNow(); this.showToast(_('Gerçek zamana dönüldü')); });
    $('time-date').addEventListener('click', () => {
      const cur = t.date.toISOString().slice(0, 16);
      const v = window.prompt(_('Tarih/saat (UTC, ISO 8601):'), cur);
      if (!v) return;
      const d = new Date(v.endsWith('Z') ? v : v + 'Z');
      if (Number.isFinite(d.getTime())) t.setDate(d);
      else this.showToast(_('Geçersiz tarih'));
    });
    $('time-date').style.cursor = 'pointer';
    $('time-date').title = _('Tarih ayarlamak için tıkla');
  }

  /* ---------------- Actions ---------------- */
  private bindActions(): void {
    const h = this.host;
    $('act-goto').addEventListener('click', () => {
      if (h.selected) h.goTo(h.selected);
      else if (h.selectedStar !== null) h.goToStar(h.selectedStar);
      else if (h.selectedGalaxy !== null) h.goToGalaxy(h.selectedGalaxy);
      else if (h.selectedLandmark !== null) h.goToLandmark(h.selectedLandmark);
    });
    $('act-center').addEventListener('click', () => {
      if (h.selected) h.center(h.selected);
      else if (h.selectedStar !== null) h.centerStar(h.selectedStar);
      else if (h.selectedGalaxy !== null) h.centerGalaxy(h.selectedGalaxy);
      else if (h.selectedLandmark !== null) h.centerLandmark(h.selectedLandmark);
    });
    this.followBtn.addEventListener('click', () => h.toggleFollow());
  }

  /* ---------------- "Görmeye değecek yerler" ---------------- */
  private buildPlaces(): void {
    const h = this.host;
    const u = h.universe;
    const menu = this.placesMenu;
    menu.innerHTML = '';
    const resolveGalaxy = (ref: string): number | null => {
      if (ref.startsWith('#')) return parseInt(ref.slice(1), 10);
      const g = u.galaxies;
      for (let i = 1; i < g.catalogCount; i++) if (g.rawName(i).includes(ref)) return i;
      return null;
    };
    for (const group of PLACES) {
      const head = document.createElement('div');
      head.className = 'dropdown-group';
      head.textContent = _(group.title);
      menu.appendChild(head);
      for (const p of group.items) {
        // skip destinations this build cannot resolve
        if (p.kind === 'galaxy' && resolveGalaxy(p.ref) === null) continue;
        if (p.kind === 'star' && u.catalog.search(p.ref, 1).length === 0) continue;
        if (p.kind === 'blackhole' && !u.blackHole(p.ref)) continue;
        if (p.kind === 'landmark' && !u.landmark(p.ref)) continue;
        const item = document.createElement('div');
        item.className = 'dropdown-item';
        item.setAttribute('role', 'option');
        item.innerHTML = `<span>${_(p.label)}</span>${p.note ? `<span class="n">${_(p.note)}</span>` : ''}`;
        item.addEventListener('click', () => {
          this.togglePlaces(false);
          if (p.kind === 'body') h.goToBodyId(p.ref);
          else if (p.kind === 'blackhole') h.goToBlackHole(p.ref);
          else if (p.kind === 'landmark') h.goToLandmark(u.landmarks.indexOf(u.landmark(p.ref)!));
          else if (p.kind === 'star') {
            const hits = u.catalog.search(p.ref, 1);
            if (hits.length) h.goToStar(`c${hits[0]}`);
          } else {
            const gi = resolveGalaxy(p.ref);
            if (gi !== null) h.goToGalaxy(gi);
          }
        });
        menu.appendChild(item);
      }
    }
    this.placesBtn.addEventListener('click', (e) => { e.stopPropagation(); this.togglePlaces(); });
    document.addEventListener('pointerdown', (e) => {
      if (!menu.hidden && !menu.contains(e.target as Node) && e.target !== this.placesBtn) this.togglePlaces(false);
    });
  }

  togglePlaces(force?: boolean): void {
    const show = force ?? this.placesMenu.hidden === true;
    this.placesMenu.hidden = !show;
    this.placesBtn.classList.toggle('active', show);
    this.placesBtn.setAttribute('aria-expanded', String(show));
  }

  /* ---------------- Search ---------------- */
  private bindSearch(): void {
    const input = this.searchInput;
    const list = this.searchResults;
    const render = () => {
      const q = input.value.trim().toLowerCase();
      list.innerHTML = '';
      this.searchIndex = -1;
      if (!q) { list.hidden = true; return; }
      const norm = (s: string) => s.toLowerCase().replace(/ı/g, 'i').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const nq = norm(q);
      const u = this.host.universe;
      const hits = u.bodies
        .filter((b) => norm(b.name).includes(nq) || norm(b.data.name).includes(nq) || b.id.includes(nq) || norm(typeLabel(b.data.type)).includes(nq) || (TYPE_LABELS[b.data.type] ?? '').toLowerCase().includes(q))
        .slice(0, 8);
      for (const b of hits) {
        const li = document.createElement('li');
        li.innerHTML = `<span>${b.name}</span><span class="t">${typeLabel(b.data.type)}${b.parent ? ' · ' + b.parent.name : ''}</span>`;
        li.addEventListener('click', () => { this.pick(b); });
        list.appendChild(li);
      }
      // Bodies of other systems (the Solar System from elsewhere, companion stars, pulsar planets …)
      const foreign = u.searchForeignBodies(q, 6);
      for (const f of foreign) {
        const li = document.createElement('li');
        li.innerHTML = `<span>${f.name}</span><span class="t">${typeLabel(f.body.type)} · ${f.systemName}</span>`;
        li.addEventListener('click', () => { this.host.goToSystemBody(f.starId, f.body.id); this.closeSearch(); });
        list.appendChild(li);
      }
      // Catalogue stars (other systems)
      const stars = u.catalog.search(q, 8).filter((i) => i !== u.current.catalogIndex);
      for (const i of stars) {
        const li = document.createElement('li');
        const spect = u.catalog.catalogSpectral(i);
        const ly = u.catalog.distancePc(i) * 3.26156;
        li.innerHTML = `<span>${u.catalog.nameOf(i)}</span><span class="t">${_('Yıldız')}${spect ? ' · ' + spect : ''} · ${fixed(ly, 1)} ly</span>`;
        li.addEventListener('click', () => { this.pickStar(`c${i}`); });
        list.appendChild(li);
      }
      // Black holes (other systems)
      const bhs = u.searchBlackHoles(q, 5).filter((b) => b.systemStarId !== u.current.starId);
      for (const b of bhs) {
        const li = document.createElement('li');
        const dist = fmtLightYears(b.positionPc.length() * PARSEC_KM);
        li.innerHTML = `<span>${b.entry.name}</span><span class="t">${_('Kara Delik')} · ${fmtSolarMass(b.entry.massSolar)} · ${dist}</span>`;
        li.addEventListener('click', () => { this.host.goToBlackHole(b.entry.id); this.closeSearch(); });
        list.appendChild(li);
      }
      // Deep-sky landmarks
      const lms = u.searchLandmarks(q, 5);
      for (const i of lms) {
        const l = u.landmarks[i];
        const li = document.createElement('li');
        const where = u.galaxies.name(l.galaxy);
        li.innerHTML = `<span>${l.def.name}</span><span class="t">${_(LANDMARK_KIND_LABEL[l.def.kind]).split(' /')[0]} · ${where} · ${fmtLightYears(l.positionPc.length() * PARSEC_KM)}</span>`;
        li.addEventListener('click', () => { this.host.goToLandmark(i); this.closeSearch(); });
        list.appendChild(li);
      }
      // Galaxies
      const gals = u.galaxies.search(q, 6);
      for (const i of gals) {
        const li = document.createElement('li');
        const dist = fmtLightYears(u.galaxies.distancePc(i) * PARSEC_KM);
        li.innerHTML = `<span>${u.galaxies.name(i)}</span><span class="t">${_('Galaksi')} · ${_(GALAXY_TYPE_LABEL[u.galaxies.typeOf(i)])} · ${dist}</span>`;
        li.addEventListener('click', () => { this.host.selectGalaxy(i); this.host.goToGalaxy(i); this.closeSearch(); });
        list.appendChild(li);
      }
      list.hidden = hits.length + foreign.length + stars.length + bhs.length + lms.length + gals.length === 0;
    };
    input.addEventListener('input', render);
    input.addEventListener('focus', render);
    input.addEventListener('keydown', (e) => {
      const items = Array.from(list.children) as HTMLLIElement[];
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (!items.length) return;
        this.searchIndex = (this.searchIndex + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
        items.forEach((li, i) => li.classList.toggle('active', i === this.searchIndex));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const li = items[this.searchIndex >= 0 ? this.searchIndex : 0];
        li?.click();
      } else if (e.key === 'Escape') {
        input.blur();
        list.hidden = true;
      }
    });
    document.addEventListener('pointerdown', (e) => {
      if (!(e.target as HTMLElement).closest('#search')) list.hidden = true;
    });
  }

  private pick(b: CelestialBody): void {
    this.host.select(b);
    this.host.goTo(b);
    this.closeSearch();
  }

  private pickStar(id: StarId): void {
    this.host.selectStar(id);
    this.host.goToStar(id);
    this.closeSearch();
  }

  private closeSearch(): void {
    this.searchInput.value = '';
    this.searchResults.hidden = true;
    this.searchInput.blur();
  }

  /* ---------------- Settings ---------------- */
  private buildSettings(): void {
    const body = $('settings-body');
    body.innerHTML = '';
    const s = this.host.settings;
    // language
    const langRow = document.createElement('div');
    langRow.className = 'setting-row';
    const langLabel = document.createElement('label');
    langLabel.textContent = _('Dil');
    langLabel.htmlFor = 'set-lang';
    const langSel = document.createElement('select');
    langSel.id = 'set-lang';
    langSel.className = 'lang-select';
    for (const l of LOCALES) {
      const o = document.createElement('option');
      o.value = l.code;
      o.textContent = l.label;
      o.selected = l.code === currentLocale();
      langSel.appendChild(o);
    }
    langSel.addEventListener('change', () => setLocale(langSel.value as Locale));
    langRow.append(langLabel, langSel);
    body.appendChild(langRow);
    for (const def of SETTING_DEFS) {
      if (def.group) {
        const g = document.createElement('div');
        g.className = 'setting-group';
        g.textContent = _(def.group);
        body.appendChild(g);
      }
      const row = document.createElement('div');
      row.className = 'setting-row';
      const label = document.createElement('label');
      label.textContent = _(def.label);
      const id = `set-${def.key}`;
      label.htmlFor = id;
      row.appendChild(label);
      if (def.kind === 'bool') {
        // a <label> wrapping the input so clicking the knob itself toggles it
        const sw = document.createElement('label');
        sw.className = 'switch';
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.id = id;
        input.checked = s[def.key] as boolean;
        input.addEventListener('change', () => {
          (s as unknown as Record<string, unknown>)[def.key] = input.checked;
          this.host.applySettings();
        });
        const knob = document.createElement('span');
        sw.appendChild(input);
        sw.appendChild(knob);
        row.appendChild(sw);
      } else {
        const input = document.createElement('input');
        input.type = 'range';
        input.id = id;
        input.min = String(def.min);
        input.max = String(def.max);
        input.step = String(def.step);
        input.value = String(s[def.key]);
        const val = document.createElement('span');
        val.style.fontFamily = 'var(--mono)';
        val.style.fontSize = '11px';
        val.style.minWidth = '34px';
        val.style.textAlign = 'right';
        val.textContent = String(s[def.key]);
        input.addEventListener('input', () => {
          (s as unknown as Record<string, unknown>)[def.key] = parseFloat(input.value);
          val.textContent = input.value;
          this.host.applySettings();
        });
        row.appendChild(input);
        row.appendChild(val);
      }
      body.appendChild(row);
    }
  }

  /** Reflect programmatic setting changes (hotkeys) into the panel */
  syncSettings(): void {
    const s = this.host.settings;
    for (const def of SETTING_DEFS) {
      const el = document.getElementById(`set-${def.key}`) as HTMLInputElement | null;
      if (!el) continue;
      if (def.kind === 'bool') el.checked = s[def.key] as boolean;
      else el.value = String(s[def.key]);
    }
  }

  private creditText: string | null = null;
  private readonly creditEl = $('imagery-credit');

  /** Bottom-left credit for streamed imagery (null hides it) */
  setImageryCredit(text: string | null, translated = false): void {
    if (text === this.creditText) return;
    this.creditText = text;
    this.creditEl.hidden = text === null;
    if (text !== null) this.creditEl.textContent = translated ? text : _(text);
  }

  toggleMission(force?: boolean): void {
    const show = force ?? this.missionPanel.panel.hidden === true;
    if (show) { this.toggleSettings(false); this.tourPanel.toggle(false); }
    this.missionPanel.toggle(show);
  }

  toggleTours(force?: boolean): void {
    const show = force ?? this.tourPanel.panel.hidden === true;
    this.tourPanel.toggle(show);
  }

  toggleSettings(force?: boolean): void {
    const show = force ?? this.settingsPanel.hidden === true;
    if (show) { this.missionPanel.toggle(false); this.tourPanel.toggle(false); }
    this.settingsPanel.hidden = !show;
    $('btn-settings').classList.toggle('active', show);
  }

  toggleHelp(force?: boolean): void {
    const show = force ?? this.help.hidden === true;
    this.help.hidden = !show;
  }

  showToast(msg: string, ms = 1800): void {
    this.toast.textContent = msg;
    this.toast.hidden = false;
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => { this.toast.hidden = true; }, ms);
  }

  /* ---------------- Per-frame ---------------- */
  update(now: number, dt: number, camDistanceToSelected: number): void {
    const { time, camera, selected } = this.host;
    this.fpsAcc += dt;
    this.fpsCount++;
    if (this.fpsAcc >= 0.5) {
      this.fps = this.fpsCount / this.fpsAcc;
      this.fpsAcc = 0;
      this.fpsCount = 0;
    }

    $('time-date').textContent = time.formatDate();
    $('time-rate').textContent = time.rateLabel();
    this.pauseBtn.textContent = time.paused ? '▶\uFE0E' : '❚❚';
    this.pauseBtn.classList.toggle('active', time.paused);

    $('nav-mode').textContent = camera.autopilot ? _('Otopilot') : camera.mode === 'orbit' ? _('Takip / Yörünge') : this.host.freeRoam ? _('Serbest dolaşım') : _('Serbest uçuş');
    this.roamBtn.classList.toggle('active', this.host.freeRoam);
    $('nav-ref').textContent = camera.reference?.name ?? camera.anchor?.name ?? '—';
    $('nav-speed').textContent = camera.mode === 'free' ? `${fmtSpeed(camera.speed)}  (×${camera.speedMultiplier.toPrecision(2)})` : '—';
    $('nav-alt').textContent = camera.nearest ? `${fmtDistance(camera.altitude)} · ${camera.nearest.name}` : '—';
    $('nav-fps').textContent = fixed(this.fps, 0);
    this.missionPanel.update(now);

    const pointSel = this.host.selectedGalaxy !== null || this.host.selectedLandmark !== null;
    this.followBtn.classList.toggle('active', camera.mode === 'orbit' && (selected ? camera.target === selected : pointSel && camera.anchor !== null));
    this.followBtn.disabled = !selected && !pointSel;

    const u = this.host.universe;
    const sys = u.current;
    const sysLabel = sys.catalogIndex === 0 ? _('Güneş Sistemi') : _('{name} sistemi', { name: sys.star.name });
    const gal = u.currentGalaxy;
    const dSunPc = this.host.camera.position.length() / PARSEC_KM;
    const scaleLabel = dSunPc > 3.0e9 ? _('Gözlemlenebilir evren') : dSunPc > 3.0e8 ? _('Süperküme ölçeği') : _('Galaksiler arası uzay');
    const label = gal === null ? `${scaleLabel} · ${sysLabel}` : gal === 0 ? sysLabel : `${u.galaxies.name(gal)} · ${sysLabel}`;
    if (this.brandSub.textContent !== label) this.brandSub.textContent = label;

    if (selected) {
      this.info.hidden = false;
      if (now - this.lastInfoUpdate > 120) {
        this.lastInfoUpdate = now;
        this.renderInfo(selected, camDistanceToSelected);
      }
    } else if (this.host.selectedStar !== null) {
      this.info.hidden = false;
      if (now - this.lastInfoUpdate > 250) {
        this.lastInfoUpdate = now;
        this.renderStarInfo(this.host.selectedStar);
      }
    } else if (this.host.selectedGalaxy !== null) {
      this.info.hidden = false;
      if (now - this.lastInfoUpdate > 250) {
        this.lastInfoUpdate = now;
        this.renderGalaxyInfo(this.host.selectedGalaxy);
      }
    } else if (this.host.selectedLandmark !== null) {
      this.info.hidden = false;
      if (now - this.lastInfoUpdate > 250) {
        this.lastInfoUpdate = now;
        this.renderLandmarkInfo(this.host.selectedLandmark);
      }
    } else {
      this.info.hidden = true;
    }
  }

  private renderGalaxyInfo(i: number): void {
    const u = this.host.universe;
    const g = u.galaxies;
    const type = g.typeOf(i);
    this.infoName.textContent = g.name(i);
    this.infoType.textContent = `${_('Galaksi')} · ${_(GALAXY_TYPE_LABEL[type])}`;
    this.infoParent.textContent = i === 0 ? _('Ev galaksimiz') : i < g.catalogCount ? _('Gerçek galaksi kataloğu') : _('Prosedürel kozmik ağ');

    const rel = u.galaxyRelative(i, this.host.camera.position);
    const camDist = rel.length();
    const distSunKm = g.distancePc(i) * PARSEC_KM;
    const R = g.radius[i];
    const absMag = g.absMag[i];
    const lum = Math.pow(10, (4.83 - absMag) / 2.5);
    const rows: Array<[string, string] | 'sep'> = [];
    rows.push(['Uzaklık', `${fmtLightYears(camDist)} (${fmtDistance(camDist)})`]);
    rows.push(['Kadir (buradan)', fixed(this.host.galaxySprites.apparentMag(i), 1)]);
    rows.push(['Görünür yarıçap', fmtDeg(this.host.galaxySprites.apparent(i).angRad * RAD, 2)]);
    rows.push('sep');
    rows.push(['Güneş\'e uzaklık', `${fmtLightYears(distSunKm)} (${fixed((g.distancePc(i) / 1e6), 3)} Mpc)`]);
    rows.push(['Hubble tipi', _(GALAXY_TYPE_LABEL[type])]);
    rows.push(['Çap', `${fixed(((R * 2) / 1000), 1)} kpc (${fmtLightYears(R * 2 * PARSEC_KM)})`]);
    rows.push(['Mutlak kadir', fixed(absMag, 1)]);
    rows.push(['Parlaklık', `${lum.toExponential(2)} L☉`]);
    rows.push(['Yıldız sayısı (tahmini)', `~${(lum * 3).toExponential(1).replace('e+', '×10^')}`]);
    if (i < g.catalogCount && i !== 0) rows.push(['Kaynak', 'Messier / NGC (yaklaşık parametreler)']);
    rows.push(['Işık gecikmesi', fmtDuration(camDist / 299_792.458)]);
    this.infoBody.innerHTML = rowsHtml(rows);
    this.infoDesc.textContent = g.model(i).p.description ?? '';
  }

  private renderLandmarkInfo(i: number): void {
    const u = this.host.universe;
    const l = u.landmarks[i];
    const d = l.def;
    this.infoName.textContent = d.name;
    this.infoType.textContent = _(LANDMARK_KIND_LABEL[d.kind]);
    this.infoParent.textContent = `${u.galaxies.name(l.galaxy)} · ${_('gerçek nesne')}`;
    const rel = u.landmarkRelative(i, this.host.camera.position);
    const camDist = rel.length();
    const rows: Array<[string, string] | 'sep'> = [];
    rows.push(['Uzaklık', `${fmtLightYears(camDist)} (${fmtDistance(camDist)})`]);
    rows.push(['Görünür yarıçap', fmtDeg(this.host.landmarkSprites.angularRadius(i) * RAD, 2)]);
    const appMag = d.absMag + 5 * Math.log10(Math.max(camDist / PARSEC_KM, 1e-7)) - 5;
    rows.push(['Kadir (buradan)', fixed(appMag, 1)]);
    rows.push('sep');
    rows.push(['Güneş\'e uzaklık', fmtLightYears(l.positionPc.length() * PARSEC_KM)]);
    rows.push(['Yarıçap (görsel)', fmtLightYears(d.radiusPc * PARSEC_KM)]);
    rows.push(['Mutlak kadir', fixed(d.absMag, 1)]);
    rows.push('sep');
    for (const [k, v] of Object.entries(d.facts)) rows.push([k, v]);
    rows.push(['Işık gecikmesi', fmtDuration(camDist / 299_792.458)]);
    this.infoBody.innerHTML = rowsHtml(rows);
    this.infoDesc.textContent = `${d.description} ${_('(Görsel: gerçek konum ve boyutta prosedürel bir temsil; fotoğraf değildir.)')}`;
  }

  private renderStarInfo(id: StarId): void {
    const u = this.host.universe;
    const s = u.starInfo(id);
    const ci = catalogIndexOf(id);
    const isBH = u.blackHole(id) !== undefined;
    const isExtra = u.extraSystem(id) !== undefined;
    const isProc = ci < 0 && !isExtra;
    this.infoName.textContent = s.name;
    this.infoType.textContent = isBH ? _('Kara delik sistemi') : _('Yıldız') + ' · ' + (s.isWhiteDwarf ? _('Beyaz cüce') : _(LUM_CLASS_DESC[s.lumClass] ?? ''));
    const galName = ci < 0 ? u.galaxies.name(u.galaxyOfStar(id)) : '';
    this.infoParent.textContent = isExtra ? `${_('Gerçek nesne')} · ${galName}` : isProc ? `${_('Prosedürel yıldız')} · ${galName}` : s.names?.constellation ? _('{name} takımyıldızı', { name: s.names.constellation }) : _('Yıldız kataloğu (HYG)');

    const rel = u.starRelative(id, this.host.camera.position);
    const camDist = rel.length();
    const rows: Array<[string, string] | 'sep'> = [];
    rows.push(['Uzaklık', fmtDistance(camDist)]);
    const appMag = this.host.starApparentMag(id) ?? (s.absMag + 5 * Math.log10(Math.max(camDist / PARSEC_KM, 1e-7)) - 5);
    rows.push(['Kadir (buradan)', fixed(appMag, 2)]);
    rows.push('sep');
    rows.push(['Güneş\'e uzaklık', isProc ? fmtLightYears(s.distancePc * PARSEC_KM) : `${fixed((s.distancePc * PARSEC_KM / LIGHT_YEAR_KM), 2)} ly (${fixed(s.distancePc, 2)} pc)`]);
    rows.push(['Spektral sınıf', s.catalogSpectral || s.spectral]);
    if (!isProc) rows.push(['Kadir (Dünya\'dan)', fixed(s.mag, 2)]);
    rows.push(['Mutlak kadir', fixed(s.absMag, 2)]);
    rows.push(['B−V renk', fixed(s.bv, 2)]);
    rows.push('sep');
    rows.push(['Sıcaklık*', `${fixed(s.temperature, 0)} K`]);
    rows.push(['Parlaklık*', `${s.luminosity >= 1 ? fixed(s.luminosity, 2) : s.luminosity.toPrecision(3)} L☉`]);
    rows.push(['Yarıçap*', `${fixed(s.radiusSolar, 2)} R☉`]);
    rows.push(['Kütle*', `${fixed(s.massSolar, 2)} M☉`]);
    if (s.hip) rows.push(['Hipparcos', `HIP ${s.hip}`]);
    if (s.names?.bayer) rows.push(['Bayer / Flamsteed', s.names.bayer]);
    if (s.names?.gliese) rows.push(['Gliese', s.names.gliese]);
    rows.push('sep');
    const sys = u.system(id);
    const planets = sys.bodies.filter((b) => b.data.type === 'planet' || b.data.type === 'dwarf').length;
    const moons = sys.bodies.filter((b) => b.data.type === 'moon').length;
    rows.push(['Gezegenler', planets ? `${planets}${moons ? ` ${_('(+{n} uydu)', { n: moons })}` : ''}` : 'Yok']);
    if (sys.belts.length) rows.push(['Kuşaklar', sys.belts.map((b) => _(b.name)).join(', ')]);
    rows.push(['Işık gecikmesi', fmtDuration(camDist / 299_792.458)]);

    this.infoBody.innerHTML = rowsHtml(rows);
    this.infoDesc.textContent = isProc
      ? `${_(sys.star.data.description ?? '')} ${_('(* Bu yıldız {galaxy} galaksisinin yoğunluk modelinden deterministik olarak üretilmiştir; kimliği kalıcıdır, aynı yere dönünce aynı yıldızı bulursunuz.)', { galaxy: galName })}`
      : u.hasMeasuredInfo(id)
        ? `${_(sys.star.data.description ?? '')} ${_('(* Tayf ve yörünge ölçümlerinden gelen değerler; katalog tahminlerinin yerini alır.)')}`
        : `${_(sys.star.data.description ?? '')} ${_('(* Kadir, uzaklık ve B−V renginden türetilen tahminler.)')}`;
  }

  private renderInfo(b: CelestialBody, camDist: number): void {
    const u = this.host.universe;
    const star = u.star;
    const starTemp = u.current.starTemperature;
    this.infoName.textContent = b.name;
    this.infoType.textContent = typeLabel(b.data.type);
    const partner = binaryPartner(b);
    this.infoParent.textContent = partner
      ? _('{name} ile çift sistem', { name: partner.name })
      : b.parent ? _('{name} sisteminde', { name: b.parent.name }) : _('Sistem merkezi');

    const rows: Array<[string, string] | 'sep'> = [];
    if (b.data.type === 'spacecraft') {
      this.renderSpacecraftInfo(b, camDist, rows);
      return;
    }
    if (b.data.type === 'barycenter') {
      this.renderBarycenterInfo(b, camDist, rows);
      return;
    }
    if (b.data.type === 'blackhole') {
      this.renderBlackHoleInfo(b, camDist, rows);
      return;
    }
    if (b.data.type === 'pulsar') {
      this.renderPulsarInfo(b, camDist, rows);
      return;
    }
    rows.push(['Kameraya uzaklık', fmtDistance(camDist)]);
    rows.push(['Yüzeye uzaklık', fmtDistance(Math.max(0, camDist - b.radius))]);
    rows.push('sep');
    rows.push(['Ortalama yarıçap', fmtRadius(b.radius, b.data.type !== 'star')]);
    if (b.data.flattening) rows.push(['Basıklık', fixed(b.data.flattening, 4)]);
    rows.push(['Kütle', fmtMass(b.data.mass)]);
    rows.push(['Yoğunluk', `${fixed(b.density, 2)} g/cm³`]);
    rows.push(['Yüzey çekimi', `${fixed(b.surfaceGravity, 2)} m/s² (${fixed((b.surfaceGravity / 9.80665), 2)} g)`]);
    rows.push(['Kaçış hızı', `${fixed(b.escapeVelocity, 2)} km/s`]);
    if (b.data.albedo !== undefined) rows.push(['Albedo', fixed(b.data.albedo, 2)]);
    const temp = b.data.temperature ?? (b.parent ? b.equilibriumTemperature(star.radius, starTemp) : 0);
    rows.push([b.data.temperature ? 'Yüzey sıcaklığı' : 'Denge sıcaklığı', fmtTemp(temp)]);
    rows.push('sep');
    if (b.resolved && b.parent) {
      const r = b.resolved;
      rows.push(['Yörünge periyodu', b.periodDisplay()]);
      rows.push(['Yarı-büyük eksen', isPrimaryType(b.parent.data.type) ? `${fixed((r.a / AU_KM), 4)} AU` : fmtDistance(r.a)]);
      rows.push(['Dış merkezlik', fixed(r.e, 4)]);
      rows.push(['Eğiklik', fmtDeg(r.i * RAD)]);
      rows.push(['Düğüm boylamı', fmtDeg(((r.node * RAD) % 360 + 360) % 360)]);
      rows.push(['Perihelion', isPrimaryType(b.parent.data.type) ? `${fixed(((r.a * (1 - r.e)) / AU_KM), 4)} AU` : fmtDistance(r.a * (1 - r.e))]);
      rows.push(['Aphelion', isPrimaryType(b.parent.data.type) ? `${fixed(((r.a * (1 + r.e)) / AU_KM), 4)} AU` : fmtDistance(r.a * (1 + r.e))]);
      rows.push(['Anlık yörünge hızı', `${fixed(b.orbitalSpeed, 3)} km/s`]);
      rows.push([_("{name}'a uzaklık", { name: b.parent.name }), fmtDistance(b.localPosition.length())]);
      if (!isPrimaryType(b.parent.data.type)) rows.push([_("{name}'a uzaklık", { name: star.name }), `${fixed((b.distanceToStar / AU_KM), 4)} AU`]);
      rows.push(['Etki küresi (SOI)', fmtDistance(b.soiRadius)]);
      rows.push('sep');
    }
    rows.push(['Yıldız günü', b.data.rotationPeriod === 'sync' ? `${b.siderealDayDisplay} ${_('(kilitli)')}` : b.siderealDayDisplay]);
    if (typeof b.data.rotationPeriod === 'number' && b.data.rotationPeriod < 0) rows.push(['Dönüş', 'Retrograd']);
    if (b.parent) {
      const tilt = Math.acos(Math.min(1, Math.max(-1, b.pole.dot(b.orbitNormal)))) * RAD;
      rows.push(['Eksen eğikliği', fmtDeg(tilt, 1)]);
    }
    if (b.data.rings) rows.push(['Halkalar', `${fmtDistance(b.data.rings.inner)} – ${fmtDistance(b.data.rings.outer)}`]);
    if (b.data.atmosphere) rows.push(['Atmosfer', b.data.atmosphere.density >= 1 ? 'Yoğun' : b.data.atmosphere.density > 0.3 ? 'Orta' : 'İnce']);
    if (b.children.length) rows.push(['Uydular (katalog)', String(b.children.length)]);
    if (b.data.facts) {
      rows.push('sep');
      for (const [k, v] of Object.entries(b.data.facts)) rows.push([k, v]);
    }
    if (b.parent && camDist > 0) {
      const lightTime = camDist / 299_792.458;
      rows.push(['Işık gecikmesi', fmtDuration(lightTime)]);
    }

    this.infoBody.innerHTML = rowsHtml(rows);
    this.infoDesc.textContent = _(b.data.description ?? '');
  }

  private renderBarycenterInfo(b: CelestialBody, camDist: number, rows: Array<[string, string] | 'sep'>): void {
    this.infoParent.textContent = _('Sistem merkezi');
    rows.push(['Kameraya uzaklık', fmtDistance(camDist)]);
    rows.push('sep');
    rows.push(['Toplam kütle', fmtSolarMass(b.data.mass / SUN_MASS_KG)]);
    const comps = b.children.filter((c) => c.resolved);
    for (const c of comps) {
      const frac = c.data.mass / b.data.mass;
      rows.push([c.name, `${fmtSolarMass(c.data.mass / SUN_MASS_KG)} · ${_('%{n}', { n: fixed(frac * 100, 1) })}`]);
    }
    const first = comps[0];
    if (first?.resolved) {
      rows.push('sep');
      rows.push(['Yörünge periyodu', first.periodDisplay()]);
      const aTotal = comps.reduce((s, c) => s + (c.resolved?.a ?? 0), 0);
      rows.push(['Bileşenler arası uzaklık', aTotal > AU_KM * 0.05 ? `${fixed(aTotal / AU_KM, 3)} AU` : fmtDistance(aTotal)]);
      for (const c of comps) rows.push([_("{name}'ın yörünge yarıçapı", { name: c.name }), c.resolved!.a > AU_KM * 0.05 ? `${fixed(c.resolved!.a / AU_KM, 3)} AU` : fmtDistance(c.resolved!.a)]);
      rows.push(['Dış merkezlik', fixed(first.resolved.e, 3)]);
    }
    rows.push(['Işık gecikmesi', fmtDuration(camDist / 299_792.458)]);
    this.infoBody.innerHTML = rowsHtml(rows);
    this.infoDesc.textContent = _('Çift sistemin ortak kütle merkezi: iki bileşen de bu görünmez noktanın etrafında, kütleleriyle ters orantılı yarıçaplarda ve her zaman karşılıklı konumlarda dolanır. Ağır bileşen küçük, hafif bileşen büyük bir yörünge çizer.');
  }

  private renderBlackHoleInfo(b: CelestialBody, camDist: number, rows: Array<[string, string] | 'sep'>): void {
    const rs = b.radius;
    const mSun = b.data.mass / SUN_MASS_KG;
    const partner = binaryPartner(b) ?? b.parent;
    this.infoParent.textContent = partner ? _('{name} ile çift sistem', { name: partner.name }) : _('Sistem merkezi');
    rows.push(['Kameraya uzaklık', fmtDistance(camDist)]);
    rows.push(['Olay ufkuna uzaklık', `${fmtDistance(Math.max(0, camDist - rs))} (${fixed((camDist / rs), 1)} r_s)`]);
    rows.push('sep');
    rows.push(['Kütle', fmtSolarMass(mSun)]);
    rows.push(['Schwarzschild yarıçapı', fmtDistance(rs)]);
    rows.push(['Foton küresi', `${fmtDistance(rs * 1.5)} (${fmtNum(1.5)} r_s)`]);
    rows.push(['ISCO (en iç kararlı yörünge)', `${fmtDistance(rs * 3)} (3 r_s)`]);
    rows.push(['Gölge çapı', `${fmtDistance(rs * 5.196)} (√27 r_s)`]);
    const hawking = 6.17e-8 / mSun;
    rows.push(['Hawking sıcaklığı', hawking >= 1e-3 ? `${hawking.toExponential(2)} K` : `${hawking.toExponential(1)} K`]);
    const evap = 2.1e67 * mSun ** 3;
    rows.push(['Buharlaşma süresi', _('{n} yıl', { n: evap.toExponential(1) })]);
    if (b.data.appearance.kind === 'blackhole') {
      const d = b.data.appearance.disk;
      rows.push(['Akreasyon diski', d.brightness > 0 ? `${d.inner}–${d.outer} r_s · ~${fmtNum(d.temperature)} K` : 'Yok (uykuda)']);
    }
    rows.push('sep');
    if (b.resolved && b.parent) {
      const r = b.resolved;
      rows.push(['Yörünge periyodu', b.periodDisplay()]);
      rows.push(['Yarı-büyük eksen', `${fixed((r.a / AU_KM), 3)} AU`]);
      rows.push(['Dış merkezlik', fixed(r.e, 3)]);
      rows.push(['Anlık yörünge hızı', `${fixed(b.orbitalSpeed, 1)} km/s`]);
      rows.push('sep');
    } else if (b.children.length) {
      rows.push(['Yörüngedeki yıldızlar', b.children.map((c) => c.name).join(', ')]);
      rows.push('sep');
    }
    if (b.data.facts) for (const [k, v] of Object.entries(b.data.facts)) if (k !== 'Kütle') rows.push([k, v]);
    rows.push(['Işık gecikmesi', fmtDuration(camDist / 299_792.458)]);
    this.infoBody.innerHTML = rowsHtml(rows);
    this.infoDesc.textContent = `${_(b.data.description ?? '')} ${_('Görüntü: Schwarzschild metriğinde ışık yollarının (null jeodezikler) ekran uzayında gerçek zamanlı izlenmesi; diskte Doppler ışıması ve kütleçekimsel kırmızıya kayma uygulanır.')}`;
  }

  private renderPulsarInfo(b: CelestialBody, camDist: number, rows: Array<[string, string] | 'sep'>): void {
    const a = b.data.appearance.kind === 'pulsar' ? b.data.appearance : null;
    const P = b.rotationPeriodS; // s
    const mSun = b.data.mass / SUN_MASS_KG;
    const partner = binaryPartner(b) ?? b.parent;
    this.infoParent.textContent = partner ? _('{name} ile çift sistem', { name: partner.name }) : _('Sistem merkezi');
    rows.push(['Kameraya uzaklık', fmtDistance(camDist)]);
    rows.push(['Yüzeye uzaklık', fmtDistance(Math.max(0, camDist - b.radius))]);
    rows.push('sep');
    const periodTxt = P >= 1 ? `${fixed(P, 4)} s` : `${fixed((P * 1e3), 3)} ms`;
    rows.push(['Dönme periyodu', `${periodTxt} (${fixed((1 / P), P >= 1 ? 3 : 1)} Hz)`]);
    const vEq = (2 * Math.PI * b.radius) / P;
    rows.push(['Ekvator hızı', `${fmtNum(vEq, { maximumFractionDigits: 0 })} km/s (${_('%{n} c', { n: fixed(vEq / 299_792.458 * 100, 1) })})`]);
    if (a) rows.push(['Manyetik eksen eğikliği', a.quiet ? '— (ışın yok)' : fmtDeg(a.magneticTilt, 0)]);
    rows.push('sep');
    rows.push(['Kütle', fmtSolarMass(mSun)]);
    rows.push(['Yarıçap', `${fixed(b.radius, 0)} km`]);
    rows.push(['Yoğunluk', fmtSci(b.density * 1e3, 'kg/m³')]);
    rows.push(['Yüzey çekimi', fmtSci(b.surfaceGravity / 9.80665, 'g')]);
    rows.push(['Kaçış hızı', `${fmtNum(b.escapeVelocity, { maximumFractionDigits: 0 })} km/s (${_('%{n} c', { n: fixed(b.escapeVelocity / 299_792.458 * 100, 0) })})`]);
    const rs = (2 * 6.674e-11 * b.data.mass) / (299_792_458 ** 2) / 1e3;
    rows.push(['Schwarzschild yarıçapı', `${fixed(rs, 2)} km (R / r_s = ${fixed((b.radius / rs), 1)})`]);
    if (b.data.temperature) rows.push(['Yüzey sıcaklığı', _('{n} milyon K', { n: fixed((b.data.temperature / 1e6), 1) })]);
    rows.push('sep');
    if (b.resolved && b.parent) {
      const r = b.resolved;
      rows.push(['Yörünge periyodu', b.periodDisplay()]);
      rows.push(['Yarı-büyük eksen', fmtDistance(r.a)]);
      rows.push(['Dış merkezlik', fixed(r.e, 3)]);
      rows.push(['Anlık yörünge hızı', `${fixed(b.orbitalSpeed, 1)} km/s`]);
      rows.push('sep');
    } else if (b.children.length) {
      rows.push(['Yörüngedekiler', b.children.map((c) => c.name).join(', ')]);
      rows.push('sep');
    }
    if (b.data.facts) for (const [k, v] of Object.entries(b.data.facts)) if (k !== 'Kütle' && k !== 'Periyot') rows.push([k, v]);
    rows.push(['Işık gecikmesi', fmtDuration(camDist / 299_792.458)]);
    this.infoBody.innerHTML = rowsHtml(rows);
    this.infoDesc.textContent = `${_(b.data.description ?? '')} ${_('Görüntü: dönme ekseninden eğik manyetik eksen boyunca iki ışın konisi; koni her dönüşte bakış doğrultusunu süpürdüğünde parlaklık atar (deniz feneri etkisi). Işın geometrisi temsilîdir.')}`;
  }

  private renderSpacecraftInfo(b: CelestialBody, camDist: number, rows: Array<[string, string] | 'sep'>): void {
    const u = this.host.universe;
    const star = u.star;
    const earth = u.current.byId.get('earth');
    const o = b.data.orbit;
    const mission = o?.kind === 'trajectory' ? this.host.missions.byBody(b) : undefined;
    this.infoParent.textContent = o?.kind === 'surface' ? _('{name} yüzeyinde', { name: b.parent!.name })
      : o?.kind === 'lagrange' ? _('{a}–{b} {point} noktası', { a: star.name, b: b.parent!.name, point: o.point })
      : o?.kind === 'linear' ? _('Yıldızlararası / hiperbolik yörünge')
      : mission ? `${_('Görev')}: ${mission.plan.originName} → ${mission.plan.targetName}`
      : b.parent ? _('{name} yörüngesinde', { name: b.parent.name }) : '';
    if (mission) {
      rows.push(['Evre', mission.phase ? phaseLabel(mission.phase, mission.plan) : '—']);
      const jd = this.host.time.jd;
      const eta = (mission.plan.arrivalJd - jd) * 86400;
      rows.push(['Varış', eta > 0 ? _('{t} sonra', { t: fmtDuration(eta) }) : 'varıldı']);
      rows.push([_('Hız ({name} referansı)', { name: star.name }), fmtSpeed(b.orbitalSpeed)]);
      rows.push(['Kameraya uzaklık', fmtDistance(camDist)]);
      rows.push('sep');
      rows.push(['Yol / süre', `${fmtDistance(mission.plan.distanceKm)} · ${fmtDuration(mission.plan.durationS)}`]);
      if (Number.isFinite(mission.plan.budget)) rows.push(['Δv toplam / bütçe', `${fixed(mission.plan.dvTotal, 2)} / ${fixed(mission.plan.budget, 2)} km/s`]);
      if (b.data.facts) {
        rows.push('sep');
        for (const [k, v] of Object.entries(b.data.facts)) rows.push([k, v]);
      }
      this.infoBody.innerHTML = rowsHtml(rows);
      const model = mission.plan.ship.model;
      this.infoDesc.textContent = `${_(b.data.description ?? '')} ${model.kind === 'glb' ? `${_('3B model: NASA 3D Resources')}${model.representative ? ' ' + _('(temsilî)') : ''}.` : _('Model özgün, şematik bir temsildir.')} ${_('Rota patched-conic yaklaşımıyla hesaplanmıştır.')}`;
      return;
    }

    rows.push(['Kameraya uzaklık', fmtDistance(camDist)]);
    rows.push('sep');
    const au = (km: number) => km > AU_KM * 0.05
      ? `${fixed((km / AU_KM), km > AU_KM ? 2 : 4)} AU`
      : `${fmtDistance(km)} (${fixed((km / AU_KM), 4)} AU)`;
    rows.push([_("{name}'a uzaklık", { name: star.name }), au(b.distanceToStar)]);
    if (earth && b !== earth) {
      const dEarth = b.position.distanceTo(earth.position);
      rows.push(['Dünya\'ya uzaklık', au(dEarth)]);
      rows.push(['Işık gecikmesi (Dünya)', fmtDuration(dEarth / 299_792.458)]);
    }
    if (o?.kind === 'linear') {
      rows.push([_('Hız ({name} referansı)', { name: star.name }), `${fixed(b.orbitalSpeed, 2)} km/s (${fixed((b.orbitalSpeed * 3600), 0)} ${_('km/sa')})`]);
      rows.push(['Yörünge', 'Bağlı değil – Güneş Sistemi\'ni terk ediyor']);
    } else if (o?.kind === 'surface') {
      rows.push(['Konum', `${fixed(Math.abs(o.lat), 4)}° ${o.lat >= 0 ? _('K') : _('G')}, ${fixed(Math.abs(o.lon), 4)}° ${o.lon >= 0 ? _('D') : _('B')}`]);
    } else if (b.parent && b.resolved) {
      const r = b.resolved;
      rows.push(['Yörünge periyodu', b.periodDisplay()]);
      if (b.parent !== star) rows.push([_("{name}'a uzaklık", { name: b.parent.name }), fmtDistance(b.localPosition.length())]);
      rows.push(['Periapsis / apoapsis', `${fmtDistance(r.a * (1 - r.e))} / ${fmtDistance(r.a * (1 + r.e))}`]);
      rows.push(['Eğiklik', fmtDeg(r.i * RAD)]);
      rows.push(['Anlık yörünge hızı', `${fixed(b.orbitalSpeed, 2)} km/s`]);
    } else if (b.parent) {
      rows.push([_("{name}'a uzaklık", { name: b.parent.name }), fmtDistance(b.localPosition.length())]);
    }
    rows.push('sep');
    rows.push(['Kütle', b.data.mass >= 1000 ? `${fmtNum(b.data.mass / 1000, { maximumFractionDigits: 1 })} ${_('ton')}` : `${b.data.mass} kg`]);
    rows.push(['Boyut (yarıçap)', `${fixed((b.radius * 1000), 1)} m`]);
    if (b.data.facts) {
      rows.push('sep');
      for (const [k, v] of Object.entries(b.data.facts)) rows.push([k, v]);
    }
    this.infoBody.innerHTML = rowsHtml(rows);
    const rep = b.data.appearance.kind === 'spacecraft' && b.data.appearance.representative;
    this.infoDesc.textContent = `${_(b.data.description ?? '')} ${_('Konum, 2025 başı JPL Horizons verilerinden yaklaşık olarak türetilmiştir;')} ${_('3B model: NASA 3D Resources')}${rep ? ' ' + _('(temsilî)') : ''}.`;
  }
}
