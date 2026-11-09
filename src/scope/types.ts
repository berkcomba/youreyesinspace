/**
 * The telescope view: what a chosen object looks like from the ground, through a chosen
 * instrument. One serialisable description of the object (`ScopeTarget`) feeds both hosts: the
 * simulation's info card builds it from live data, the encyclopedia writes it into the page.
 */

export type DeepKind = 'star' | 'galaxy' | 'globular' | 'open' | 'pn' | 'nebula' | 'snr' | 'pulsar' | 'bh';

/** Keplerian elements as the catalogue gives them (heliocentric `jpl`, or `simple` in km/deg/days) */
export type ScopeOrbit =
  | { kind: 'jpl'; a: number; e: number; i: number; L: number; lonPeri: number; node: number; da: number; de: number; di: number; dL: number; dLonPeri: number; dNode: number }
  | { kind: 'simple'; a: number; e: number; i: number; node: number; argPeri: number; M0: number; epoch: number; period: number; frame: string };

/** How a resolved disk is painted */
export type DiskLook = 'sun' | 'moon' | 'mercury' | 'venus' | 'mars' | 'jupiter' | 'saturn' | 'uranus' | 'neptune' | 'rock' | 'ice' | 'titan' | 'io';

export interface ScopeBody {
  id: string;
  name: string;
  /** km */
  radius: number;
  albedo: number;
  look: DiskLook;
  /** ICRF pole, degrees */
  pole?: { ra: number; dec: number };
  /** prime meridian at J2000 (deg) and rotation (deg/day) */
  w0?: number;
  wRate?: number;
  orbit?: ScopeOrbit;
  rings?: { inner: number; outer: number; gaps: Array<[number, number]> };
}

export interface ScopeSolar {
  kind: 'solar';
  /** the selected body: the primary or one of the moons */
  target: string;
  /** the body whose disk sits in the field: the Sun, the Moon (own ephemeris), a planet, or the planet of a selected moon */
  primary: ScopeBody;
  /** moons drawn around the primary (catalogue moons with their orbits around it) */
  moons: ScopeBody[];
}

export interface ScopeDeep {
  kind: DeepKind;
  name: string;
  ra: number;
  dec: number;
  /** integrated V magnitude */
  mag: number;
  /** major-axis diameter, arcsec (0: point-like) */
  size: number;
  /** minor/major axis ratio */
  axis?: number;
  /** position angle of the major axis, degrees east of north */
  pa?: number;
  bv?: number;
  galType?: 'E' | 'S0' | 'S' | 'SB' | 'Irr';
  /** photograph (url) and the width it spans on the sky, arcsec */
  img?: string;
  imgSpan?: number;
  /** distance, pc (scales member stars of clusters, galaxy radio flux) */
  distPc?: number;
  /** a few special cases the models know by name */
  special?: 'sgra' | 'm87' | 'cena' | 'crab' | 'casa' | 'pleiades';
  /** instrument to open with (a black hole's page: the Event Horizon Telescope) */
  prefer?: string;
}

export type ScopeTarget = ScopeSolar | ScopeDeep;

/** the strings the widget shows, already in the page language */
export type ScopeStrings = Record<string, string>;
