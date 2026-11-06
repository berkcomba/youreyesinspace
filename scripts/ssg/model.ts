import type { ExoHost, ExoPlanet } from '../../src/data/Exoplanets';
import type { BlackHoleEntry } from '../../src/data/blackholes';
import type { SkyEvent } from '../../src/data/events';
import type { LandmarkDef } from '../../src/data/landmarks';
import type { BodyData } from '../../src/data/types';
import type { GalaxyType } from '../../src/galaxy/GalaxyModel';
import type { CoreCatalog } from './catalog';

export interface StarEntry {
  i: number;
  slug: string;
  name: string;
  con: string;
  ra: number;
  dec: number;
  /** pc */
  dist: number;
  mag: number;
  host?: ExoHost;
}

export interface PlanetEntry { host: ExoHost; planet: ExoPlanet; slug: string; star: StarEntry | null }

export interface DsoEntry {
  id: string;
  slug: string;
  con: string;
  ra: number;
  dec: number;
  handMade: boolean;
}

export interface GalaxyEntry {
  /** name as the app knows it (search key) */
  name: string;
  slug: string;
  con: string;
  ra: number;
  dec: number;
  distMpc: number;
  type: GalaxyType;
  typeGuessed: boolean;
  diameterKpc: number;
  absMag: number;
  axis?: number;
  desc?: string;
  source: 'curated' | 'ungc' | '2mrs';
}

export interface ConstellationEntry {
  abbr: string;
  slug: string;
  stars: StarEntry[];
  dsos: DsoEntry[];
  galaxies: GalaxyEntry[];
}

export interface Site {
  cat: CoreCatalog;
  exoSource: string;
  exoFetched: string;
  stars: StarEntry[];
  starByIndex: Map<number, StarEntry>;
  planets: PlanetEntry[];
  planetsByHost: Map<number, PlanetEntry[]>;
  constellations: Map<string, ConstellationEntry>;
  dsos: DsoEntry[];
  galaxies: GalaxyEntry[];
  blackHoles: Array<{ entry: BlackHoleEntry; slug: string }>;
  solar: Array<{ body: BodyData; slug: string }>;
  solarById: Map<string, { body: BodyData; slug: string }>;
  events: Array<{ e: SkyEvent; slug: string }>;
  /** per language: the deep-sky definitions (their texts are translated at construction) */
  dsoDefs: Map<string, LandmarkDef>;
  buildDate: string;
}
