import type { CelestialBody } from '../core/CelestialBody';
import { catalogIndexOf, type StarId, type Universe } from '../core/Universe';
import { SOLAR_SYSTEM } from '../data/solarSystem';
import { CATALOG } from '../galaxy/galaxies';
import { _ } from '../i18n';
import { OBLIQUITY_J2000 } from '../core/constants';
import { scopeStrings } from '../scope/strings';
import { blackHoleTarget, galaxyTarget, landmarkTarget, solarTarget, starTarget } from '../scope/targets';
import type { ScopeTarget } from '../scope/types';
import type { ScopeView } from '../scope/ScopeView';

const OPEN_KEY = 'yeits.scopeOpen';

/** scene-frame direction (pc or km, from the Sun) → ICRF RA/Dec, degrees */
function sceneToRaDec(v: { x: number; y: number; z: number }): [number, number] {
  const x = v.x, y = -v.z, z = v.y;
  const c = Math.cos(OBLIQUITY_J2000), s = Math.sin(OBLIQUITY_J2000);
  const ye = y * c - z * s, ze = y * s + z * c;
  const r = Math.hypot(x, ye, ze) || 1;
  return [((Math.atan2(ye, x) * 180) / Math.PI + 360) % 360, (Math.asin(ze / r) * 180) / Math.PI];
}

export interface ScopeSelection {
  universe: Universe;
  selected: CelestialBody | null;
  star: StarId | null;
  galaxy: number | null;
  landmark: number | null;
}

/** what the info card's selection looks like from the ground (null: nothing to show) */
export function scopeTargetFor(s: ScopeSelection): ScopeTarget | null {
  const u = s.universe;
  const fromStar = (id: StarId): ScopeTarget | null => {
    const bh = u.blackHoles.find((b) => b.systemStarId === id);
    if (bh) return blackHoleTarget(bh.entry.bodyId, bh.entry.name);
    if (catalogIndexOf(id) <= 0) return null;
    const info = u.starInfo(id);
    const [ra, dec] = sceneToRaDec(info.position);
    return starTarget({ name: info.name, ra, dec, mag: info.mag, bv: info.bv });
  };
  if (s.selected) {
    const sys = u.current;
    if (sys.catalogIndex === 0) return solarTarget(s.selected.id, SOLAR_SYSTEM, _);
    const bh = u.blackHoles.find((b) => b.entry.bodyId === s.selected!.id && b.systemStarId === sys.starId);
    if (bh) return blackHoleTarget(bh.entry.bodyId, bh.entry.name);
    return s.selected === sys.star ? fromStar(sys.starId) : null;
  }
  if (s.star !== null) return fromStar(s.star);
  if (s.galaxy !== null) {
    const g = u.galaxies, i = s.galaxy;
    if (i === 0 || !g.isReal(i)) return null;
    const cat = CATALOG.find((c) => c.name === g.rawName(i));
    const [ra, dec] = cat ? [cat.ra, cat.dec] : sceneToRaDec(g.position(i));
    return galaxyTarget({
      name: g.rawName(i), ra, dec, distMpc: g.distancePc(i) / 1e6, type: g.typeOf(i),
      diameterKpc: (2 * g.radius[i]) / 1000, absMag: g.absMag[i], axis: cat?.axis, pa: cat?.pa, inc: cat?.inc,
    }, g.name(i));
  }
  if (s.landmark !== null) {
    const l = u.landmarks[s.landmark];
    return landmarkTarget(l.def, _(l.def.name), l.galaxy ? u.galaxies.distancePc(l.galaxy) : undefined);
  }
  return null;
}

/**
 * "Teleskopla bak" in the info card: a toggle that remembers itself, and the telescope view of
 * the selection, loaded on first use.
 */
export class ScopeCard {
  private key: string | null = null;
  private target: ScopeTarget | null = null;
  private view: ScopeView | null = null;
  private open: boolean;
  private jdAt = 0;
  private jdNow = 0;

  constructor(private box: HTMLElement, private btn: HTMLButtonElement, private host: HTMLElement) {
    try { this.open = localStorage.getItem(OPEN_KEY) === '1'; } catch { this.open = false; }
    btn.addEventListener('click', () => {
      this.open = !this.open;
      try { localStorage.setItem(OPEN_KEY, this.open ? '1' : '0'); } catch { /* private mode */ }
      if (this.open) void this.mount(this.jdNow);
      else this.unmount();
      this.label();
    });
    this.label();
  }

  private label(): void {
    this.btn.textContent = this.open ? _('Teleskop görünümünü kapat') : _('Teleskopla bak');
    this.btn.classList.toggle('active', this.open);
  }

  /** per frame: `key` names the selection, `make` builds its target when it changed */
  sync(key: string | null, make: () => ScopeTarget | null, jd: number, now: number): void {
    this.jdNow = jd;
    if (key !== this.key) {
      this.key = key;
      this.unmount();
      this.target = key ? make() : null;
      this.box.hidden = !this.target;
      if (this.target && this.open) void this.mount(jd);
      this.label();
    }
    if (this.view && now - this.jdAt > 400) {
      this.jdAt = now;
      this.view.setJd(jd);
    }
  }

  private async mount(jd: number): Promise<void> {
    const key = this.key, target = this.target;
    if (!target || this.view) return;
    const { mountScope } = await import('../scope/ScopeView');
    if (key !== this.key || !this.open || this.view) return;
    this.view = mountScope(this.host, target, scopeStrings(), { jd, compact: true, lang: document.documentElement.lang || 'en' });
  }

  private unmount(): void {
    this.view?.destroy();
    this.view = null;
    this.host.replaceChildren();
  }
}
