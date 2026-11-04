/** A confirmed exoplanet (NASA Exoplanet Archive, Planetary Systems Composite Parameters) */
export interface ExoPlanet {
  name: string;
  method?: string;
  year?: number;
  facility?: string;
  /** orbital period, days */
  P?: number;
  /** semi-major axis, AU */
  a?: number;
  e?: number;
  /** inclination to the sky plane, deg (90 = edge-on) */
  i?: number;
  /** argument of periastron, deg */
  w?: number;
  /** mid-transit time / time of periastron, BJD */
  tc?: number;
  tp?: number;
  /** radius, Earth radii */
  R?: number;
  /** mass, Earth masses (see Mprov) */
  M?: number;
  /** "Mass", "Msini", "M-R relationship", … */
  Mprov?: string;
  /** density g/cm³ */
  rho?: number;
  /** equilibrium temperature K */
  Teq?: number;
  /** insolation, Earth = 1 */
  S?: number;
  /** projected spin–orbit angle, deg */
  lambda?: number;
  tran?: 1;
  rv?: 1;
  ima?: 1;
  ttv?: 1;
  /** circumbinary */
  cb?: 1;
  /** existence disputed */
  controv?: 1;
}

export interface ExoHost {
  /** catalogue index (core) */
  i: number;
  name: string;
  teff?: number;
  /** solar radii */
  rad?: number;
  /** solar masses */
  mass?: number;
  /** log10 L/L☉ */
  lum?: number;
  /** [Fe/H] */
  met?: number;
  /** Gyr */
  age?: number;
  /** rotation period, days */
  rotp?: number;
  logg?: number;
  spect?: string;
  /** stars in the system */
  snum?: number;
  /** pc */
  dist?: number;
  planets: ExoPlanet[];
}

/** Confirmed exoplanets keyed by the catalogue index of their host star */
export class ExoplanetCatalog {
  readonly hosts = new Map<number, ExoHost>();
  readonly fetched: string;
  readonly planetCount: number;

  private constructor(json: { fetched: string; hosts: ExoHost[] }) {
    for (const h of json.hosts) this.hosts.set(h.i, h);
    this.fetched = json.fetched;
    this.planetCount = json.hosts.reduce((s, h) => s + h.planets.length, 0);
  }

  static async load(baseUrl: string): Promise<ExoplanetCatalog> {
    const r = await fetch(`${baseUrl}data/exoplanets.json?v=${__BUILD_ID__}`);
    if (!r.ok) throw new Error('exoplanets.json yüklenemedi');
    return new ExoplanetCatalog(await r.json());
  }

  host(index: number): ExoHost | undefined {
    return this.hosts.get(index);
  }

  /** A planet by its exact archive name */
  byName(name: string): { host: ExoHost; planet: ExoPlanet } | null {
    for (const host of this.hosts.values()) {
      const planet = host.planets.find((p) => p.name === name);
      if (planet) return { host, planet };
    }
    return null;
  }

  /** Planets whose name matches (case-insensitive), with their host index */
  search(q: string, limit = 6): Array<{ host: ExoHost; planet: ExoPlanet }> {
    const s = q.trim().toLowerCase();
    const out: Array<{ host: ExoHost; planet: ExoPlanet }> = [];
    if (s.length < 2) return out;
    for (const h of this.hosts.values()) {
      for (const p of h.planets) {
        if (p.name.toLowerCase().includes(s)) {
          out.push({ host: h, planet: p });
          if (out.length >= limit * 4) break;
        }
      }
      if (out.length >= limit * 4) break;
    }
    out.sort((a, b) => (a.planet.name.toLowerCase().startsWith(s) ? 0 : 1) - (b.planet.name.toLowerCase().startsWith(s) ? 0 : 1) || a.planet.name.length - b.planet.name.length);
    return out.slice(0, limit);
  }
}
