import { Ephemeris, planMission, phaseLabel, type FarTarget, type MissionPlan, type MissionRequest } from '../astro/mission';
import type { ActiveMission, Missions } from '../core/Missions';
import { AU_KM, C_KM_S, DAY_S, LIGHT_YEAR_KM, PARSEC_KM } from '../core/constants';
import type { CelestialBody } from '../core/CelestialBody';
import type { StarSystem } from '../core/StarSystem';
import type { TimeSystem } from '../core/TimeSystem';
import type { StarId, Universe } from '../core/Universe';
import { SHIPS, isFtl, shipById, type ShipDef } from '../data/ships';
import { fmtDistance, fmtDuration, fmtLightYears, fmtSpeed } from './format';
import { _, fixed, fmtNum } from '../i18n';

export interface MissionPanelHost {
  universe: Universe;
  time: TimeSystem;
  missions: Missions;
  readonly selected: CelestialBody | null;
  readonly selectedStar: StarId | null;
  readonly selectedGalaxy: number | null;
  readonly selectedLandmark: number | null;
  /** launch a computed plan; `fitSeconds` > 0 speeds time up so the trip takes about that long */
  launchMission(plan: MissionPlan, follow: boolean, fitSeconds: number): ActiveMission;
  followMission(m: ActiveMission): void;
  cancelMission(m: ActiveMission): void;
  showToast(msg: string, ms?: number): void;
}

const $ = <T extends HTMLElement = HTMLElement>(id: string): T => document.getElementById(id) as T;

/** named stars offered as interstellar destinations (resolved against the HYG catalogue) */
const STAR_TARGETS = [
  'Proxima Centauri', 'Rigil Kentaurus', "Barnard's Star", 'Wolf 359', 'Sirius', 'Procyon', 'Altair', 'Vega', 'Fomalhaut',
  'Arcturus', 'Capella', 'Aldebaran', 'Pollux', 'Spica', 'Regulus', 'Antares', 'Betelgeuse', 'Rigel', 'Polaris', 'Deneb',
];
const GALAXY_TARGETS = ['Büyük Macellan', 'Küçük Macellan', 'Andromeda', 'Üçgen', 'Centaurus A', 'Sombrero', 'M87', 'Girdap'];

interface FarOption { key: string; label: string; make: () => FarTarget | null }

export class MissionPanel {
  readonly panel = $('mission');
  private readonly originSel = $<HTMLSelectElement>('m-origin');
  private readonly targetSel = $<HTMLSelectElement>('m-target');
  private readonly shipSel = $<HTMLSelectElement>('m-ship');
  private readonly windowSel = $<HTMLSelectElement>('m-window');
  private readonly flybySel = $<HTMLSelectElement>('m-flyby');
  private readonly arrivalSel = $<HTMLSelectElement>('m-arrival');
  private readonly optSel = $<HTMLSelectElement>('m-opt');
  private readonly speedSel = $<HTMLSelectElement>('m-speed');
  private readonly fitSel = $<HTMLSelectElement>('m-fit');
  private readonly computeBtn = $<HTMLButtonElement>('m-compute');
  private readonly launchBtn = $<HTMLButtonElement>('m-launch');
  private readonly result = $('m-result');
  private readonly active = $('m-active');
  private readonly shipInfo = $('m-ship-info');
  private readonly departEl = $('m-depart');

  private plan: MissionPlan | null = null;
  private system: StarSystem | null = null;
  private eph: Ephemeris | null = null;
  private farOptions = new Map<string, FarOption>();
  private lastTick = 0;
  private lastActiveKey = '';

  constructor(private readonly host: MissionPanelHost) {
    this.buildShips();
    this.shipSel.addEventListener('change', () => { this.onShipChange(); this.invalidate(); });
    for (const el of [this.originSel, this.targetSel, this.windowSel, this.flybySel, this.arrivalSel, this.optSel, this.speedSel]) {
      el.addEventListener('change', () => this.invalidate());
    }
    this.computeBtn.addEventListener('click', () => this.compute());
    this.launchBtn.addEventListener('click', () => this.launch());
    $('mission-close').addEventListener('click', () => this.toggle(false));
    $('m-use-selected').addEventListener('click', () => this.useSelected());
    this.onShipChange();
  }

  toggle(force?: boolean): void {
    const show = force ?? this.panel.hidden === true;
    this.panel.hidden = !show;
    $('btn-mission').classList.toggle('active', show);
    if (show) this.refresh();
  }

  get visible(): boolean { return !this.panel.hidden; }

  /** Rebuild the body lists for the current reference frame */
  refresh(): void {
    const sys = this.host.universe.current;
    if (sys !== this.system) {
      this.system = sys;
      this.eph = null;
      this.plan = null;
      this.buildBodies(sys);
      this.invalidate();
    }
    this.departEl.textContent = this.host.time.formatDate();
    this.renderActive(true);
  }

  /** Called from the UI loop */
  update(now: number): void {
    if (this.panel.hidden) return;
    if (now - this.lastTick < 0.5) return;
    this.lastTick = now;
    if (this.host.universe.current !== this.system) this.refresh();
    else {
      this.departEl.textContent = this.host.time.formatDate();
      this.renderActive(false);
    }
  }

  /* ------------------------------------------------------------------ lists */

  private buildShips(): void {
    const real = document.createElement('optgroup');
    real.label = _('Gerçek araçlar');
    const fiction = document.createElement('optgroup');
    fiction.label = _('Bilim kurgu (warp / hiper sürüş)');
    for (const s of SHIPS) {
      const o = document.createElement('option');
      o.value = s.id;
      o.textContent = _(s.name);
      (s.origin === 'real' ? real : fiction).appendChild(o);
    }
    this.shipSel.append(real, fiction);
    this.shipSel.value = 'starship';
  }

  private bodyLabel(b: CelestialBody): string {
    return b.depth >= 2 ? `${'\u2003'.repeat(b.depth - 1)}↳ ${b.name}` : b.name;
  }

  private listBodies(sys: StarSystem): CelestialBody[] {
    const out: CelestialBody[] = [];
    const walk = (b: CelestialBody) => {
      for (const c of b.children) {
        const t = c.data.type;
        if (t === 'spacecraft' || t === 'barycenter') continue;
        if (t === 'planet' || t === 'dwarf' || t === 'moon' || t === 'asteroid' || t === 'comet') out.push(c);
        walk(c);
      }
    };
    for (const r of sys.roots) {
      if (r.data.type !== 'spacecraft') { if (r !== sys.star) out.push(r); walk(r); }
    }
    return out;
  }

  private buildBodies(sys: StarSystem): void {
    const u = this.host.universe;
    const bodies = this.listBodies(sys);
    const prevOrigin = this.originSel.value, prevTarget = this.targetSel.value;
    this.originSel.innerHTML = '';
    this.targetSel.innerHTML = '';

    const local = document.createElement('optgroup');
    local.label = _('{name} sistemi', { name: sys.star.name });
    const localT = local.cloneNode() as HTMLOptGroupElement;
    for (const b of bodies) {
      const o = document.createElement('option');
      o.value = b.id;
      o.textContent = this.bodyLabel(b);
      local.appendChild(o);
      localT.appendChild(o.cloneNode(true));
    }
    // the star itself can be a destination (close solar pass)
    const starOpt = document.createElement('option');
    starOpt.value = sys.star.id;
    starOpt.textContent = `${sys.star.name} ${_('(yakın geçiş)')}`;
    localT.appendChild(starOpt);
    this.originSel.appendChild(local);
    this.targetSel.appendChild(localT);

    // far targets
    this.farOptions.clear();
    const far = (group: HTMLOptGroupElement, opt: FarOption) => {
      this.farOptions.set(opt.key, opt);
      const o = document.createElement('option');
      o.value = opt.key;
      o.textContent = opt.label;
      o.className = 'far';
      group.appendChild(o);
    };
    const gStars = document.createElement('optgroup');
    gStars.label = _('Yıldızlar (yalnızca FTL)');
    const seen = new Set<string>();
    for (const name of STAR_TARGETS) {
      const idx = u.catalog.search(name, 1)[0];
      if (idx === undefined) continue;
      const id = `c${idx}`;
      if (id === sys.starId || seen.has(id)) continue;
      seen.add(id);
      far(gStars, { key: `star:${id}`, label: `${u.starName(id)} · ${fmtLightYears(u.starPositionPc(id).length() * PARSEC_KM)}`, make: () => this.starTarget(id) });
    }
    const gExotic = document.createElement('optgroup');
    gExotic.label = _('Kara delikler & pulsarlar (FTL)');
    for (const bh of u.blackHoles) {
      if (!bh.info || bh.systemStarId === sys.starId) continue;
      const id = bh.systemStarId;
      far(gExotic, { key: `star:${id}`, label: `${bh.entry.name} · ${fmtLightYears(bh.positionPc.length() * PARSEC_KM)}`, make: () => this.starTarget(id) });
    }
    for (const lm of u.landmarks) {
      if (!lm.systemId || lm.systemId === sys.starId || lm.def.kind !== 'pulsar') continue;
      const id = lm.systemId;
      far(gExotic, { key: `star:${id}`, label: `${lm.def.name} · ${fmtLightYears(lm.positionPc.length() * PARSEC_KM)}`, make: () => this.starTarget(id) });
    }
    const gGal = document.createElement('optgroup');
    gGal.label = _('Galaksiler (FTL)');
    for (const name of GALAXY_TARGETS) {
      let i = -1;
      for (let k = 1; k < u.galaxies.catalogCount; k++) if (u.galaxies.rawName(k).includes(name)) { i = k; break; }
      if (i < 1) continue;
      const pos = u.galaxies.position(i).multiplyScalar(PARSEC_KM);
      far(gGal, { key: `gal:${i}`, label: u.galaxies.name(i), make: () => ({ kind: 'point', name: u.galaxies.name(i), positionKm: pos }) });
    }
    const gLm = document.createElement('optgroup');
    gLm.label = _('Bulutsular & kümeler (FTL)');
    let nLm = 0;
    for (let i = 0; i < u.landmarks.length && nLm < 10; i++) {
      const lm = u.landmarks[i];
      if (lm.systemId || lm.galaxy !== 0) continue;
      const pos = lm.positionPc.clone().multiplyScalar(PARSEC_KM);
      far(gLm, { key: `lm:${i}`, label: lm.def.name, make: () => ({ kind: 'point', name: lm.def.name, positionKm: pos }) });
      nLm++;
    }
    this.targetSel.append(gStars, gExotic, gGal, gLm);

    // flyby bodies: planets of this system
    this.flybySel.innerHTML = `<option value="">${_('Yok (doğrudan)')}</option>`;
    for (const b of bodies) {
      if (b.data.type !== 'planet') continue;
      const o = document.createElement('option');
      o.value = b.id;
      o.textContent = b.name;
      this.flybySel.appendChild(o);
    }

    // defaults: Earth → Mars in the Solar System, otherwise first two bodies
    const ids = bodies.map((b) => b.id);
    this.originSel.value = ids.includes(prevOrigin) ? prevOrigin : ids.includes('earth') ? 'earth' : ids[0] ?? '';
    const tDefault = ids.includes('mars') ? 'mars' : ids.find((i) => i !== this.originSel.value) ?? sys.star.id;
    this.targetSel.value = this.targetOptionExists(prevTarget) ? prevTarget : tDefault;
    this.applyFtlAvailability();
  }

  private targetOptionExists(v: string): boolean {
    return v !== '' && Array.from(this.targetSel.options).some((o) => o.value === v);
  }

  private starTarget(id: StarId): FarTarget | null {
    const u = this.host.universe;
    try {
      const sys = u.system(id);
      const info = u.starInfo(id);
      const starR = sys.star.radius;
      // a comfortable "standard orbit": far enough to stay out of the photosphere glare, inside the inner system
      const orbitR = Math.max(starR * 25, Math.sqrt(Math.max(info.luminosity, 1e-4)) * AU_KM * 0.6);
      return {
        kind: 'star', id, name: u.starName(id), positionKm: u.starPositionPc(id).multiplyScalar(PARSEC_KM),
        starBodyId: sys.star.id, orbitRadiusKm: orbitR, starMassKg: info.massKg,
      };
    } catch {
      return null;
    }
  }

  /* --------------------------------------------------------------- selection */

  private useSelected(): void {
    const h = this.host;
    const u = h.universe;
    if (h.selected) {
      if (h.selected.data.type === 'spacecraft') { h.showToast(_('Uzay aracı hedef olamaz')); return; }
      if (this.targetOptionExists(h.selected.id)) { this.targetSel.value = h.selected.id; this.invalidate(); return; }
    }
    const addFar = (opt: FarOption) => {
      if (!this.farOptions.has(opt.key)) {
        this.farOptions.set(opt.key, opt);
        let g = this.targetSel.querySelector<HTMLOptGroupElement>('optgroup[data-sel]');
        if (!g) { g = document.createElement('optgroup'); g.label = _('Seçilen (FTL)'); g.dataset.sel = '1'; this.targetSel.appendChild(g); }
        const o = document.createElement('option');
        o.value = opt.key; o.textContent = opt.label; o.className = 'far';
        g.appendChild(o);
      }
      this.targetSel.value = opt.key;
      this.applyFtlAvailability();
      this.invalidate();
    };
    if (h.selectedStar) {
      const id = h.selectedStar;
      if (id === u.current.starId) { h.showToast(_('Zaten bu sistemdesiniz')); return; }
      addFar({ key: `star:${id}`, label: u.starName(id), make: () => this.starTarget(id) });
      return;
    }
    if (h.selectedGalaxy !== null) {
      const i = h.selectedGalaxy;
      const pos = u.galaxies.position(i).multiplyScalar(PARSEC_KM);
      addFar({ key: `gal:${i}`, label: u.galaxies.name(i), make: () => ({ kind: 'point', name: u.galaxies.name(i), positionKm: pos }) });
      return;
    }
    if (h.selectedLandmark !== null) {
      const i = h.selectedLandmark;
      const lm = u.landmarks[i];
      if (lm.systemId) { const id = lm.systemId; addFar({ key: `star:${id}`, label: lm.def.name, make: () => this.starTarget(id) }); return; }
      const pos = lm.positionPc.clone().multiplyScalar(PARSEC_KM);
      addFar({ key: `lm:${i}`, label: lm.def.name, make: () => ({ kind: 'point', name: lm.def.name, positionKm: pos }) });
      return;
    }
    h.showToast(_('Önce bir hedef seçin (gezegen, yıldız, galaksi…)'));
  }

  /* ------------------------------------------------------------------- ship */

  private get ship(): ShipDef { return shipById(this.shipSel.value) ?? SHIPS[0]; }

  private onShipChange(): void {
    const s = this.ship;
    const p = s.propulsion;
    const ftl = isFtl(s);
    this.shipInfo.textContent = `${_(s.tagline)} · ${s.lengthM} m · ${p.kind === 'impulsive' ? `${_('Δv bütçesi')} ${fixed(p.dvBudget, 1)} km/s${p.lowThrust ? ' ' + _('(iyon, yaklaşık)') : ''}` : p.kind === 'brachistochrone' ? _('sürekli ivme, azami {c} c', { c: p.maxC }) : p.kind === 'warp' ? _('itki {c} c · warp', { c: p.impulseC }) : `${_(p.hyperLabel)} · ${_('{c} c alt-ışık', { c: p.sublightC })}`}`;
    // speed / mode select
    this.speedSel.innerHTML = '';
    const add = (v: string, label: string) => { const o = document.createElement('option'); o.value = v; o.textContent = label; this.speedSel.appendChild(o); };
    if (p.kind === 'warp') {
      add('-1', _('İtki sürüşü ({c} c)', { c: p.impulseC }));
      p.warpFactors.forEach((w, i) => add(String(i), `${_(w.label)} · ${w.c >= 10 ? fmtNum(w.c) : w.c} c`));
      this.speedSel.value = String(Math.min(5, p.warpFactors.length - 1));
    } else if (p.kind === 'hyperdrive') {
      add('sub', _('Alt-ışık ({c} c)', { c: p.sublightC }));
      add('hyper', `${_(p.hyperLabel)} (~${p.hyperC.toExponential(0).replace('e+', '×10^')} c)`);
      this.speedSel.value = 'hyper';
    } else if (p.kind === 'brachistochrone') {
      for (const g of p.accelsG) add(String(g), _('{g} g sürekli ivme', { g }));
      this.speedSel.value = String(p.accelsG[Math.min(1, p.accelsG.length - 1)]);
    }
    $('m-speed-row').hidden = p.kind === 'impulsive';
    $('m-flyby-row').hidden = p.kind !== 'impulsive';
    $('m-opt-row').hidden = p.kind !== 'impulsive';
    $('m-window-row').hidden = p.kind !== 'impulsive';
    this.panel.classList.toggle('ftl', ftl);
    this.applyFtlAvailability();
  }

  private applyFtlAvailability(): void {
    const ftl = isFtl(this.ship);
    for (const o of Array.from(this.targetSel.options)) {
      if (o.className === 'far') o.disabled = !ftl;
    }
    if (!ftl && this.targetSel.selectedOptions[0]?.disabled) {
      const first = Array.from(this.targetSel.options).find((o) => !o.disabled);
      if (first) this.targetSel.value = first.value;
    }
  }

  /* ---------------------------------------------------------------- compute */

  private invalidate(): void {
    this.plan = null;
    this.launchBtn.disabled = true;
    this.result.hidden = true;
  }

  private request(): MissionRequest | null {
    const ship = this.ship;
    const p = ship.propulsion;
    const tv = this.targetSel.value;
    let far: FarTarget | null = null;
    let targetId: string | null = tv;
    if (this.farOptions.has(tv)) {
      far = this.farOptions.get(tv)!.make();
      if (!far) { this.host.showToast(_('Hedef sistem oluşturulamadı')); return null; }
      targetId = null;
    }
    const sv = this.speedSel.value;
    return {
      originId: this.originSel.value,
      targetId,
      far,
      ship,
      departureJd: this.host.time.jd,
      windowDays: p.kind === 'impulsive' ? Number(this.windowSel.value) : 0,
      flybyId: p.kind === 'impulsive' && this.flybySel.value ? this.flybySel.value : null,
      arrival: this.arrivalSel.value as 'orbit' | 'flyby',
      optimize: this.optSel.value as 'dv' | 'time',
      warpIndex: p.kind === 'warp' ? Number(sv) : -1,
      hyperspace: p.kind === 'hyperdrive' ? sv === 'hyper' : false,
      accelG: p.kind === 'brachistochrone' ? Number(sv) : 1,
    };
  }

  private compute(): void {
    const req = this.request();
    if (!req) return;
    const sys = this.host.universe.current;
    if (req.targetId === req.originId) { this.host.showToast(_('Kalkış ve hedef aynı')); return; }
    if (req.flybyId && (req.flybyId === req.originId || req.flybyId === req.targetId)) { this.host.showToast(_('Sapan gezegeni kalkış/hedef olamaz')); return; }
    if (!this.eph) this.eph = new Ephemeris(sys);
    this.computeBtn.disabled = true;
    this.computeBtn.textContent = _('Hesaplanıyor…');
    // let the button repaint before the (possibly 100+ ms) search
    requestAnimationFrame(() => {
      const t0 = performance.now();
      let plan: MissionPlan;
      try {
        plan = planMission(req, sys, this.eph!);
      } catch (e) {
        console.error(e);
        plan = { ...planMission({ ...req, far: null, targetId: req.originId }, sys, this.eph!), ok: false, error: `${_('Hesaplama hatası')}: ${(e as Error).message}` };
      }
      this.computeBtn.disabled = false;
      this.computeBtn.textContent = _('Hesapla');
      this.plan = plan.ok ? plan : null;
      this.renderPlan(plan, performance.now() - t0);
      this.launchBtn.disabled = !plan.ok;
    });
  }

  private renderPlan(plan: MissionPlan, ms: number): void {
    const r = this.result;
    r.hidden = false;
    r.innerHTML = '';
    if (!plan.ok) {
      r.innerHTML = `<div class="m-error">${esc(plan.error ?? _('Rota bulunamadı'))}</div>`;
      return;
    }
    const rows: Array<[string, string, string?]> = [];
    const kms = (v: number) => `${fixed(v, 2)} km/s`;
    const ftl = isFtl(plan.ship) || plan.ship.propulsion.kind === 'brachistochrone';
    const title = document.createElement('div');
    title.className = 'm-route';
    title.innerHTML = `<b>${esc(plan.originName)}</b> → <b>${esc(plan.targetName)}</b>${plan.flyby ? ` <span class="muted">${esc(_('({name} sapanı ile)', { name: plan.flyby.bodyName }))}</span>` : ''}`;
    r.appendChild(title);

    rows.push(['Kalkış', jdStr(plan.departureJd)]);
    rows.push(['Varış', jdStr(plan.arrivalJd)]);
    rows.push(['Süre', fmtDuration(plan.durationS)]);
    rows.push(['Yol', plan.distanceKm > LIGHT_YEAR_KM * 0.05 ? fmtLightYears(plan.distanceKm) : `${fixed((plan.distanceKm / AU_KM), 3)} AU (${_('{n} milyon km', { n: fmtNum(plan.distanceKm / 1e6, { maximumFractionDigits: 1 }) })})`]);
    rows.push(['Azami hız', plan.maxSpeedKms >= C_KM_S * 0.05 ? `${fmtNum(plan.maxSpeedKms / C_KM_S, { maximumFractionDigits: 2 })} c` : fmtSpeed(plan.maxSpeedKms)]);
    if (ftl) {
      const light = plan.distanceKm / C_KM_S;
      rows.push(['Işığın aynı yolu alması', fmtDuration(light)]);
      if (plan.ship.propulsion.kind === 'brachistochrone') rows.push(['Not', 'Görelilik ihmal edildi (v ≤ 0,2 c)']);
    } else {
      rows.push(['sep', '']);
      rows.push(['Δv fırlatma (300 km park)', kms(plan.dvLaunch)]);
      if (plan.flyby) rows.push(['Δv sapan düzeltmesi', kms(plan.dvFlyby)]);
      rows.push([plan.request.arrival === 'orbit' ? _('Δv varış (yakalama)') : _('Δv varış (geçiş)'), kms(plan.dvArrival)]);
      rows.push(['Δv toplam / bütçe', `${kms(plan.dvTotal)} / ${Number.isFinite(plan.budget) ? kms(plan.budget) : '—'}`, plan.feasible ? 'ok' : 'bad']);
      rows.push(['v∞ kalkış / varış', `${kms(plan.vInfDep)} / ${kms(plan.vInfArr)}`]);
      if (plan.flyby) {
        rows.push(['sep', '']);
        rows.push([_('{name} geçişi', { name: plan.flyby.bodyName }), jdStr(plan.flyby.jd)]);
        rows.push(['Geçiş irtifası', fmtDistance(plan.flyby.altitudeKm)]);
        rows.push(['Sapma açısı / v∞', `${fixed(plan.flyby.turnDeg, 1)}° / ${kms(plan.flyby.vInf)}`]);
      }
    }
    const dl = document.createElement('dl');
    dl.className = 'info-grid';
    for (const [k, v, cls] of rows) {
      if (k === 'sep') { const s = document.createElement('div'); s.className = 'sep'; dl.appendChild(s); continue; }
      const dt = document.createElement('dt'); dt.textContent = _(k);
      const dd = document.createElement('dd'); dd.textContent = _(v); if (cls) dd.className = cls;
      dl.append(dt, dd);
    }
    r.appendChild(dl);
    const verdict = document.createElement('div');
    verdict.className = `m-verdict ${plan.feasible ? 'ok' : 'bad'}`;
    verdict.textContent = plan.feasible
      ? (ftl ? _('Rota hazır.') : _('Rota araç bütçesi içinde.'))
      : _('Δv bütçesi yetersiz – yine de fırlatabilirsiniz (hayali yakıt) ya da sapan/pencere deneyin.');
    r.appendChild(verdict);
    if (plan.notes.length) {
      const ul = document.createElement('ul');
      ul.className = 'm-notes';
      for (const n of plan.notes) { const li = document.createElement('li'); li.textContent = n; ul.appendChild(li); }
      r.appendChild(ul);
    }
    const foot = document.createElement('div');
    foot.className = 'm-foot muted';
    foot.textContent = `${_('{n} evre', { n: plan.phases.length })} · ${fixed(ms, 0)} ms`;
    r.appendChild(foot);
  }

  /* ----------------------------------------------------------------- launch */

  private launch(): void {
    if (!this.plan) return;
    const fit = Number(this.fitSel.value);
    this.host.launchMission(this.plan, true, fit);
    this.plan = null;
    this.launchBtn.disabled = true;
    this.renderActive(true);
  }

  private renderActive(force: boolean): void {
    const ms = this.host.missions;
    const jd = this.host.time.jd;
    const key = ms.list.map((m) => `${m.id}:${m.phase?.kind}:${ms.followed === m}`).join('|');
    if (!force && key === this.lastActiveKey) {
      // only refresh the live numbers
      for (const m of ms.list) {
        const el = this.active.querySelector<HTMLElement>(`[data-eta="${m.id}"]`);
        if (el) el.textContent = this.etaText(m, jd);
      }
      return;
    }
    this.lastActiveKey = key;
    this.active.innerHTML = '';
    if (!ms.list.length) return;
    const h = document.createElement('div');
    h.className = 'panel-title small';
    h.textContent = _('Aktif görevler');
    this.active.appendChild(h);
    for (const m of ms.list) {
      const row = document.createElement('div');
      row.className = `m-mission${ms.followed === m ? ' followed' : ''}`;
      const info = document.createElement('div');
      info.className = 'm-mission-info';
      info.innerHTML = `<div class="m-mission-name">${esc(m.name)} <span class="muted">${esc(m.plan.originName)} → ${esc(m.plan.targetName)}</span></div><div class="m-mission-phase">${esc(m.phase ? phaseLabel(m.phase, m.plan) : '')} · <span data-eta="${m.id}">${this.etaText(m, jd)}</span></div>`;
      const btns = document.createElement('div');
      btns.className = 'm-mission-btns';
      const follow = document.createElement('button');
      follow.textContent = ms.followed === m ? _('Takipte') : _('Takip');
      follow.classList.toggle('active', ms.followed === m);
      follow.addEventListener('click', () => { this.host.followMission(m); this.renderActive(true); });
      const cancel = document.createElement('button');
      cancel.textContent = _('Kaldır');
      cancel.addEventListener('click', () => { this.host.cancelMission(m); this.renderActive(true); });
      btns.append(follow, cancel);
      row.append(info, btns);
      this.active.appendChild(row);
    }
  }

  private etaText(m: ActiveMission, jd: number): string {
    const eta = (m.plan.arrivalJd - jd) * DAY_S;
    if (jd < m.plan.departureJd) return _('kalkışa {t}', { t: fmtDuration((m.plan.departureJd - jd) * DAY_S) });
    if (eta > 0) return _('varışa {t}', { t: fmtDuration(eta) });
    return _('varıldı');
  }
}

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
}

function jdStr(jd: number): string {
  const d = new Date((jd - 2_440_587.5) * 86_400_000);
  if (!Number.isFinite(d.getTime())) return '—';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`;
}
