import { AU_KM, DAY_S, G, J2000_JD, PARSEC_KM } from '../core/constants';
import { fmtDistance, fmtLightYears } from '../ui/format';
import type { StarInfo } from '../data/StarCatalog';
import type { Appearance, Atmosphere, BodyData, Clouds, Rings, SimpleElements } from '../data/types';
import { LUM_CLASS_DESC } from '../astro/stellar';

/* ------------------------------------------------------------------ */
/*  Deterministic PRNG                                                 */
/* ------------------------------------------------------------------ */

export class Rng {
  private a: number;
  constructor(seed: number) { this.a = seed >>> 0; }
  next(): number {
    this.a = (this.a + 0x6d2b79f5) >>> 0;
    let t = this.a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(lo: number, hi: number): number { return lo + (hi - lo) * this.next(); }
  logRange(lo: number, hi: number): number { return Math.exp(this.range(Math.log(lo), Math.log(hi))); }
  chance(p: number): boolean { return this.next() < p; }
  int(lo: number, hi: number): number { return Math.floor(this.range(lo, hi + 1)); }
  pick<T>(arr: T[]): T { return arr[Math.min(arr.length - 1, Math.floor(this.next() * arr.length))]; }
  /** jittered colour */
  tint(c: [number, number, number], amt = 0.08): [number, number, number] {
    return [
      clamp01(c[0] + this.range(-amt, amt)), clamp01(c[1] + this.range(-amt, amt)), clamp01(c[2] + this.range(-amt, amt)),
    ];
  }
}

function clamp01(x: number): number { return Math.min(1, Math.max(0, x)); }

export function hashSeed(...parts: number[]): number {
  let h = 0x811c9dc5;
  for (const p of parts) {
    h ^= Math.floor(p) >>> 0;
    h = Math.imul(h, 0x01000193) >>> 0;
    h ^= h >>> 13;
  }
  return h >>> 0;
}

/* ------------------------------------------------------------------ */
/*  Output                                                             */
/* ------------------------------------------------------------------ */

export interface GeneratedBelt {
  name: string;
  count: number;
  aMin: number; // AU
  aMax: number; // AU
  eMax: number;
  iSigmaDeg: number;
  color: [number, number, number];
  opacity: number;
  seed: number;
  /** Kirkwood-like gaps: [a AU, halfwidth AU] */
  gaps?: Array<[number, number]>;
  /** Co-orbital (Trojan) cloud locked to a planet's mean longitude */
  trojan?: { aAU: number; meanLongitudeDeg: number };
}

export interface GeneratedSystem {
  id: string;
  bodies: BodyData[];
  belts: GeneratedBelt[];
  /** ids of planets ordered by semi-major axis (hotkeys 1..9) */
  planetIds: string[];
}

const EARTH_MASS = 5.97237e24;
const EARTH_RADIUS = 6371;
const JUPITER_MASS = 1.8982e27;
const JUPITER_RADIUS = 69_911;

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
const LETTERS = 'bcdefghijklmnop';

type PlanetClass = 'lava' | 'venusian' | 'temperate' | 'desert' | 'ice' | 'barren' | 'gasgiant' | 'icegiant' | 'hotjupiter';

const CLASS_LABEL: Record<PlanetClass, string> = {
  lava: 'Lav gezegeni', venusian: 'Venüs benzeri (sera)', temperate: 'Ilıman (okyanuslu)', desert: 'Soğuk çöl gezegeni',
  ice: 'Buz dünyası', barren: 'Çorak kaya', gasgiant: 'Gaz devi', icegiant: 'Buz devi', hotjupiter: 'Sıcak Jüpiter',
};

/* ------------------------------------------------------------------ */
/*  Generator                                                          */
/* ------------------------------------------------------------------ */

export function generateSystem(star: StarInfo): GeneratedSystem {
  const rng = new Rng(hashSeed(star.index, star.hip, 0x5eed));
  const sysId = `s${star.index}`;
  const starId = `${sysId}-star`;
  const bodies: BodyData[] = [];
  const belts: GeneratedBelt[] = [];
  const planetIds: string[] = [];

  const gmStar = (G * star.massKg) / 1e9; // km³/s²
  const sqrtL = Math.sqrt(Math.max(star.luminosity, 1e-5));
  const frostAU = 2.7 * sqrtL;
  const starRadiusAU = star.radiusKm / AU_KM;

  /* ---- star ---- */
  const isGiant = star.lumClass <= 3;
  const rotHours = star.isWhiteDwarf ? rng.range(2, 30) : isGiant ? rng.range(2000, 12_000) : rng.range(150, 1200) / Math.max(0.3, star.massSolar);
  bodies.push({
    id: starId,
    name: star.name,
    type: 'star',
    radius: star.radiusKm,
    mass: star.massKg,
    rotationPeriod: rotHours,
    pole: { ra: rng.range(0, 360), dec: rng.range(-90, 90) },
    appearance: { kind: 'star', temperature: star.temperature, seed: star.index % 997 + 3 },
    temperature: star.temperature,
    description: starDescription(star),
    facts: starFacts(star),
  });

  /* ---- how many planets ---- */
  let nPlanets: number;
  const roll = rng.next();
  if (star.isWhiteDwarf || star.temperature > 25_000) nPlanets = rng.chance(0.6) ? 0 : rng.int(1, 2);
  else if (isGiant) nPlanets = rng.chance(0.4) ? 0 : rng.int(1, 4);
  else if (roll < 0.08) nPlanets = 0;
  else if (roll < 0.40) nPlanets = rng.int(1, 3);
  else if (roll < 0.78) nPlanets = rng.int(4, 6);
  else nPlanets = rng.int(7, 9);

  /* ---- orbital ladder ---- */
  let a = Math.max((0.035 + 0.3 * Math.pow(rng.next(), 1.6)) * sqrtL, starRadiusAU * 5);
  const aMax = 70 * sqrtL;
  const planets: Array<{ id: string; aAU: number; cls: PlanetClass; data: BodyData }> = [];
  for (let k = 0; k < nPlanets && a < aMax; k++) {
    const id = `${sysId}-p${k}`;
    const name = `${star.name} ${LETTERS[k]}`;
    const res = makePlanet(rng, star, id, name, starId, a, frostAU, gmStar, bodies);
    planets.push({ id, aAU: a, cls: res.cls, data: res.data });
    planetIds.push(id);
    a *= rng.range(1.4, 2.15);
  }

  /* ---- belts ---- */
  if (planets.length >= 2 && rng.chance(0.55)) {
    // Find the widest relative gap; put a belt there if it is wide enough
    let best = -1, bestRatio = 0;
    for (let i = 0; i + 1 < planets.length; i++) {
      const r = planets[i + 1].aAU / planets[i].aAU;
      if (r > bestRatio) { bestRatio = r; best = i; }
    }
    if (best >= 0 && bestRatio > 1.9) {
      const lo = planets[best].aAU, hi = planets[best + 1].aAU;
      belts.push({
        name: 'Asteroit kuşağı', count: 9000, aMin: lo * 1.28, aMax: hi * 0.78, eMax: 0.2, iSigmaDeg: rng.range(3, 10),
        color: rng.tint([0.72, 0.68, 0.6], 0.06), opacity: 0.75, seed: hashSeed(star.index, 77),
      });
    }
  }
  if (planets.length && rng.chance(0.5)) {
    const last = planets[planets.length - 1].aAU;
    belts.push({
      name: 'Dış kuşak', count: 12_000, aMin: last * 1.5, aMax: last * 2.4, eMax: 0.2, iSigmaDeg: rng.range(4, 12),
      color: rng.tint([0.55, 0.62, 0.8], 0.06), opacity: 0.6, seed: hashSeed(star.index, 78),
    });
  }

  return { id: sysId, bodies, belts, planetIds };
}

/* ------------------------------------------------------------------ */
/*  Planets                                                            */
/* ------------------------------------------------------------------ */

function orbit(rng: Rng, aKm: number, gm: number, eMax: number, iSigma: number, frame: SimpleElements['frame']): SimpleElements {
  const period = (2 * Math.PI * Math.sqrt((aKm * aKm * aKm) / gm)) / DAY_S;
  return {
    kind: 'simple', a: aKm, e: Math.pow(rng.next(), 2) * eMax, i: Math.abs(gauss(rng)) * iSigma,
    node: rng.range(0, 360), argPeri: rng.range(0, 360), M0: rng.range(0, 360), epoch: J2000_JD, period, frame,
  };
}

function gauss(rng: Rng): number {
  const u1 = Math.max(rng.next(), 1e-9), u2 = rng.next();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function equilibriumT(star: StarInfo, aAU: number, albedo: number): number {
  const d = aAU * AU_KM;
  return star.temperature * Math.pow(1 - albedo, 0.25) * Math.sqrt(star.radiusKm / (2 * d));
}

function makePlanet(
  rng: Rng, star: StarInfo, id: string, name: string, parent: string, aAU: number, frostAU: number, gmStar: number,
  bodies: BodyData[],
): { cls: PlanetClass; data: BodyData } {
  const beyondFrost = aAU > frostAU;
  let cls: PlanetClass;
  const r = rng.next();
  if (!beyondFrost) {
    if (aAU < 0.12 * Math.sqrt(star.luminosity) && r < 0.10) cls = 'hotjupiter';
    else cls = 'barren'; // refined by temperature below
  } else {
    cls = r < 0.5 ? 'gasgiant' : r < 0.8 ? 'icegiant' : 'ice';
  }

  const aKm = aAU * AU_KM;
  const tidallyLocked = aAU < 0.09 * Math.sqrt(star.massSolar);
  const tilt = rng.chance(0.08) ? rng.range(60, 120) : Math.abs(gauss(rng)) * 14;
  let data: BodyData;

  if (cls === 'gasgiant' || cls === 'hotjupiter') {
    const massJ = rng.logRange(0.25, 8);
    const radius = JUPITER_RADIUS * Math.min(1.35, Math.max(0.65, Math.pow(massJ, 0.12))) * (cls === 'hotjupiter' ? 1.25 : 1);
    const albedo = cls === 'hotjupiter' ? rng.range(0.05, 0.2) : rng.range(0.35, 0.55);
    const T = equilibriumT(star, aAU, albedo);
    const flattening = rng.range(0.03, 0.09);
    const rotation = rng.range(8, 16);
    const rings = cls === 'gasgiant' && rng.chance(0.4) ? makeRings(rng, radius) : undefined;
    data = {
      id, name, type: 'planet', parent, radius, flattening, mass: massJ * JUPITER_MASS, albedo, rotationPeriod: rotation,
      tilt, orbit: orbit(rng, aKm, gmStar, cls === 'hotjupiter' ? 0.05 : 0.09, 2.5, 'parentEquator'),
      appearance: gasAppearance(rng, T, false, id),
      atmosphere: { color: T > 600 ? [0.6, 0.55, 0.7] : T > 130 ? rng.tint([0.95, 0.88, 0.75]) : rng.tint([0.7, 0.85, 1.0]), height: 0.012, density: 0.45 },
      rings, temperature: T,
      description: `${CLASS_LABEL[cls]}. ${(massJ).toFixed(2)} Jüpiter kütlesinde; ${describeTemp(T)}.`,
      facts: { 'Sınıf': CLASS_LABEL[cls], 'Kaynak': 'Prosedürel (tahmini)' },
    };
    bodies.push(data);
    makeMoons(rng, data, beyondFrost, rng.int(2, 6), bodies, 'giant');
  } else if (cls === 'icegiant') {
    const massE = rng.logRange(6, 30);
    const radius = 24_622 * Math.pow(massE / 17, 0.4);
    const albedo = rng.range(0.28, 0.42);
    const T = equilibriumT(star, aAU, albedo);
    data = {
      id, name, type: 'planet', parent, radius, flattening: rng.range(0.015, 0.03), mass: massE * EARTH_MASS, albedo,
      rotationPeriod: rng.range(12, 20) * (rng.chance(0.15) ? -1 : 1),
      tilt, orbit: orbit(rng, aKm, gmStar, 0.08, 3, 'parentEquator'),
      appearance: gasAppearance(rng, T, true, id),
      atmosphere: { color: rng.tint([0.55, 0.75, 1.0]), height: 0.02, density: 0.5 },
      rings: rng.chance(0.3) ? makeRings(rng, radius, true) : undefined,
      temperature: T,
      description: `${CLASS_LABEL[cls]}. ${massE.toFixed(1)} Dünya kütlesinde, metan katkılı hidrojen-helyum atmosferi; ${describeTemp(T)}.`,
      facts: { 'Sınıf': CLASS_LABEL[cls], 'Kaynak': 'Prosedürel (tahmini)' },
    };
    bodies.push(data);
    makeMoons(rng, data, true, rng.int(1, 4), bodies, 'giant');
  } else {
    // Rocky worlds; sub-class by equilibrium temperature
    const massE = cls === 'ice' ? rng.logRange(0.01, 1.5) : rng.logRange(0.05, 5);
    const radius = EARTH_RADIUS * Math.pow(massE, massE < 1 ? 0.3 : 0.27);
    let albedo = rng.range(0.1, 0.35);
    let T = equilibriumT(star, aAU, albedo);
    if (T > 750) cls = 'lava';
    else if (T > 330) cls = massE > 0.3 && rng.chance(0.7) ? 'venusian' : 'barren';
    else if (T > 235) cls = massE > 0.25 && rng.chance(0.75) ? 'temperate' : 'barren';
    else if (T > 140) cls = massE > 0.08 ? 'desert' : 'barren';
    else cls = 'ice';
    if (cls === 'venusian') albedo = rng.range(0.6, 0.75);
    if (cls === 'temperate') albedo = rng.range(0.28, 0.38);
    if (cls === 'ice') albedo = rng.range(0.45, 0.7);
    T = equilibriumT(star, aAU, albedo);
    if (cls === 'venusian') T *= rng.range(1.6, 2.4); // greenhouse
    if (cls === 'temperate') T += rng.range(15, 40);

    const { appearance, atmosphere, clouds } = rockyAppearance(rng, cls, massE, id);
    const type = massE < 0.02 ? 'dwarf' : 'planet';
    data = {
      id, name, type, parent, radius, flattening: massE > 0.5 ? rng.range(0.001, 0.006) : undefined,
      mass: massE * EARTH_MASS, albedo,
      rotationPeriod: tidallyLocked ? 'sync' : rng.logRange(9, 900) * (rng.chance(0.1) ? -1 : 1),
      tilt, orbit: orbit(rng, aKm, gmStar, 0.18, 3.5, 'parentEquator'),
      appearance, atmosphere, clouds, temperature: T,
      description: `${CLASS_LABEL[cls]}. ${massE.toFixed(2)} Dünya kütlesinde; ${describeTemp(T)}${tidallyLocked ? '; yıldızına gelgitle kilitli' : ''}.`,
      facts: { 'Sınıf': CLASS_LABEL[cls], 'Kaynak': 'Prosedürel (tahmini)' },
    };
    bodies.push(data);
    if (massE > 0.4 && rng.chance(0.45)) makeMoons(rng, data, beyondFrost, rng.int(1, 2), bodies, 'rocky');
  }
  return { cls, data };
}

function describeTemp(T: number): string {
  if (T > 1500) return 'yüzeyi erimiş kaya sıcaklığında';
  if (T > 700) return 'kavurucu sıcak';
  if (T > 330) return 'çok sıcak';
  if (T > 235) return 'ılıman sıcaklıkta';
  if (T > 140) return 'soğuk';
  return 'dondurucu soğuk';
}

/* ------------------------------------------------------------------ */
/*  Appearance palettes                                                */
/* ------------------------------------------------------------------ */

function gasAppearance(rng: Rng, T: number, iceGiant: boolean, id: string): Appearance {
  const seed = hashSeed(...id.split('').map((c) => c.charCodeAt(0))) % 10_000;
  let bands: Array<[number, number, number]>;
  if (iceGiant) {
    const hue = rng.next();
    bands = hue < 0.5
      ? [[0.55, 0.78, 0.9], [0.62, 0.84, 0.92], [0.5, 0.72, 0.86], [0.7, 0.88, 0.95]]
      : [[0.2, 0.35, 0.85], [0.25, 0.45, 0.95], [0.18, 0.3, 0.75], [0.35, 0.55, 1.0]];
  } else if (T > 900) {
    bands = [[0.35, 0.3, 0.32], [0.25, 0.18, 0.2], [0.5, 0.42, 0.4], [0.2, 0.15, 0.18], [0.6, 0.5, 0.45]];
  } else if (T > 250) {
    bands = [[0.9, 0.85, 0.75], [0.8, 0.7, 0.55], [0.95, 0.92, 0.85], [0.7, 0.55, 0.4], [0.85, 0.75, 0.6]];
  } else if (T > 120) {
    bands = [[0.86, 0.78, 0.64], [0.58, 0.38, 0.26], [0.92, 0.86, 0.74], [0.42, 0.25, 0.17], [0.76, 0.62, 0.48], [0.52, 0.32, 0.22]];
  } else {
    bands = [[0.6, 0.72, 0.85], [0.45, 0.6, 0.78], [0.7, 0.8, 0.9], [0.35, 0.5, 0.7], [0.55, 0.68, 0.82]];
  }
  bands = bands.map((b) => rng.tint(b, 0.06));
  const storm = rng.chance(0.5)
    ? ([rng.range(-35, 35), rng.range(0, 360), rng.range(0.05, 0.13), ...rng.tint(bands[1], 0.15)] as [number, number, number, number, number, number])
    : undefined;
  return { kind: 'gas', seed, bands, bandFreq: rng.range(5, 14), turbulence: rng.range(0.3, 1.0), storm };
}

function rockyAppearance(rng: Rng, cls: PlanetClass, massE: number, id: string): { appearance: Appearance; atmosphere?: Atmosphere; clouds?: Clouds } {
  const seed = hashSeed(...id.split('').map((c) => c.charCodeAt(0))) % 10_000;
  const canHoldAir = massE > 0.1;
  switch (cls) {
    case 'lava':
      return {
        appearance: {
          kind: 'terrestrial', seed, landLow: rng.tint([0.12, 0.08, 0.07]), landMid: rng.tint([0.25, 0.18, 0.15]), landHigh: rng.tint([0.4, 0.32, 0.28]),
          craters: rng.range(0.1, 0.5), roughness: 1.2, volcanic: true, variation: 0.6,
        },
        atmosphere: canHoldAir && rng.chance(0.5) ? { color: [0.8, 0.5, 0.3], height: 0.02, density: 0.4 } : undefined,
      };
    case 'venusian':
      return {
        appearance: {
          kind: 'terrestrial', seed, landLow: rng.tint([0.45, 0.30, 0.15]), landMid: rng.tint([0.62, 0.45, 0.25]), landHigh: rng.tint([0.8, 0.65, 0.4]),
          craters: 0.1, roughness: 0.8, variation: 0.5,
        },
        atmosphere: { color: rng.tint([0.95, 0.85, 0.6]), height: 0.04, density: rng.range(1.2, 1.8) },
        clouds: { seed: seed + 1, color: rng.tint([0.96, 0.9, 0.72], 0.05), coverage: 1.0, height: 0.012, speed: rng.range(20, 80), opacity: 0.97 },
      };
    case 'temperate': {
      const life = rng.chance(0.35);
      const land = life ? rng.tint([0.14, 0.32, 0.1]) : rng.tint([0.45, 0.36, 0.25]);
      return {
        appearance: {
          kind: 'terrestrial', seed, ocean: rng.tint([0.02, 0.1, 0.3], 0.04), landLow: land, landMid: rng.tint(life ? [0.42, 0.38, 0.2] : [0.6, 0.5, 0.35]),
          landHigh: rng.tint([0.6, 0.57, 0.52]), ice: [0.92, 0.95, 1.0], seaLevel: rng.range(0.35, 0.72), iceCaps: rng.range(0.65, 0.85),
          craters: 0, roughness: 1.0, variation: 0.4, cityLights: life && rng.chance(0.1),
        },
        atmosphere: { color: rng.tint([0.3, 0.55, 1.0], 0.1), height: 0.025, density: rng.range(0.7, 1.3), sunsetColor: [1.0, 0.45, 0.2] },
        clouds: { seed: seed + 1, color: [1, 1, 1], coverage: rng.range(0.3, 0.65), height: 0.006, speed: rng.range(0.8, 1.6), opacity: 0.88 },
      };
    }
    case 'desert':
      return {
        appearance: {
          kind: 'terrestrial', seed, landLow: rng.tint([0.4, 0.16, 0.08]), landMid: rng.tint([0.72, 0.34, 0.14]), landHigh: rng.tint([0.85, 0.58, 0.38]),
          ice: [0.95, 0.93, 0.9], iceCaps: rng.range(0.8, 0.92), craters: rng.range(0.3, 0.8), roughness: 1.1, variation: 0.6,
        },
        atmosphere: canHoldAir ? { color: rng.tint([0.85, 0.6, 0.45]), height: 0.02, density: rng.range(0.15, 0.5) } : undefined,
      };
    case 'ice':
      return {
        appearance: {
          kind: 'terrestrial', seed, landLow: rng.tint([0.55, 0.6, 0.68]), landMid: rng.tint([0.78, 0.82, 0.88]), landHigh: rng.tint([0.95, 0.96, 0.98]),
          ice: [0.97, 0.98, 1.0], iceCaps: rng.range(0.3, 0.6), craters: rng.range(0.2, 0.7), roughness: 0.9, variation: 0.5,
        },
        atmosphere: canHoldAir && rng.chance(0.4) ? { color: [0.55, 0.65, 0.95], height: 0.03, density: 0.2 } : undefined,
      };
    default:
      return {
        appearance: {
          kind: 'terrestrial', seed, landLow: rng.tint([0.3, 0.29, 0.28]), landMid: rng.tint([0.42, 0.41, 0.4]), landHigh: rng.tint([0.55, 0.54, 0.52]),
          craters: rng.range(0.6, 1.0), roughness: 1.2, variation: 0.3,
        },
      };
  }
}

function makeRings(rng: Rng, radius: number, faint = false): Rings {
  const inner = radius * rng.range(1.25, 1.6);
  const outer = inner + radius * rng.range(0.5, 1.4);
  const gaps: Array<[number, number]> = [];
  const n = rng.int(0, 3);
  for (let i = 0; i < n; i++) gaps.push([rng.range(inner + (outer - inner) * 0.2, outer - (outer - inner) * 0.1), (outer - inner) * rng.range(0.01, 0.05)]);
  return {
    inner, outer, color: faint ? rng.tint([0.5, 0.5, 0.55]) : rng.tint([0.85, 0.8, 0.7], 0.08),
    opacity: faint ? rng.range(0.25, 0.5) : rng.range(0.7, 0.95), seed: rng.int(1, 999), gaps,
  };
}

/* ------------------------------------------------------------------ */
/*  Moons                                                              */
/* ------------------------------------------------------------------ */

function makeMoons(
  rng: Rng, planet: BodyData, icy: boolean, count: number, bodies: BodyData[], kind: 'giant' | 'rocky',
): void {
  const gm = (G * planet.mass) / 1e9;
  const R = planet.radius;
  let a = kind === 'giant' ? R * rng.range(2.6, 5) : R * rng.range(8, 30);
  const maxA = kind === 'giant' ? R * 60 : R * 90;
  for (let j = 0; j < count && a < maxA; j++) {
    const id = `${planet.id}-m${j}`;
    const name = `${planet.name} ${ROMAN[j] ?? j + 1}`;
    const radius = kind === 'giant' ? rng.logRange(120, 2600) : rng.logRange(80, Math.max(90, planet.radius * 0.28));
    const density = icy ? rng.range(1200, 2200) : rng.range(2600, 3500); // kg/m³
    const mass = (4 / 3) * Math.PI * Math.pow(radius * 1000, 3) * density;
    const seed = hashSeed(...id.split('').map((c) => c.charCodeAt(0))) % 10_000;
    const volcanic = kind === 'giant' && j === 0 && !icy && rng.chance(0.3);
    const appearance: Appearance = volcanic
      ? { kind: 'terrestrial', seed, landLow: [0.85, 0.75, 0.3], landMid: [0.95, 0.88, 0.55], landHigh: [0.6, 0.35, 0.15], craters: 0, roughness: 0.9, volcanic: true, variation: 1.0 }
      : icy
        ? { kind: 'terrestrial', seed, landLow: rng.tint([0.5, 0.55, 0.62]), landMid: rng.tint([0.75, 0.78, 0.84]), landHigh: rng.tint([0.92, 0.94, 0.97]), craters: rng.range(0.4, 1.0), roughness: 1.0, variation: 0.5 }
        : { kind: 'terrestrial', seed, landLow: rng.tint([0.22, 0.22, 0.23]), landMid: rng.tint([0.38, 0.38, 0.38]), landHigh: rng.tint([0.58, 0.57, 0.55]), craters: 1.0, roughness: 1.0, variation: 0.6 };
    const period = (2 * Math.PI * Math.sqrt((a * a * a) / gm)) / DAY_S;
    bodies.push({
      id, name, type: 'moon', parent: planet.id, radius, mass, albedo: icy ? rng.range(0.4, 0.8) : rng.range(0.08, 0.3),
      rotationPeriod: 'sync',
      orbit: {
        kind: 'simple', a, e: Math.pow(rng.next(), 2) * 0.08, i: Math.abs(gauss(rng)) * 1.5, node: rng.range(0, 360), argPeri: rng.range(0, 360),
        M0: rng.range(0, 360), epoch: J2000_JD, period, frame: 'parentEquator',
      },
      appearance,
      description: `${planet.name} gezegeninin ${j + 1}. uydusu. ${volcanic ? 'Gelgit ısıtmasıyla volkanik olarak aktif.' : icy ? 'Buzlu, kraterli yüzey.' : 'Kraterli kaya yüzeyi.'}`,
      facts: { 'Kaynak': 'Prosedürel (tahmini)' },
    });
    a *= rng.range(1.5, 2.4);
  }
}

/* ------------------------------------------------------------------ */
/*  Star text                                                          */
/* ------------------------------------------------------------------ */

function starDescription(s: StarInfo): string {
  const cls = s.isWhiteDwarf ? 'beyaz cüce' : (LUM_CLASS_DESC[s.lumClass] ?? 'yıldız').toLowerCase();
  const parts = [`${s.catalogSpectral || s.spectral} sınıfı ${cls}`];
  parts.push(`Güneş'e uzaklığı ${fmtLightYears(s.distancePc * PARSEC_KM)} (${fmtDistance(s.distancePc * PARSEC_KM)})`);
  if (s.names?.constellation) parts.push(`${s.names.constellation} takımyıldızında`);
  const tail = s.procedural
    ? 'Yıldız ve gezegen sistemi, galaksi modelinden deterministik olarak prosedürel üretilmiştir.'
    : 'Gezegen sistemi gerçek yıldız verilerinden (HYG) türetilerek prosedürel olarak üretilmiştir.';
  return parts.join('. ') + '. ' + tail;
}

function starFacts(s: StarInfo): Record<string, string> {
  const f: Record<string, string> = {
    'Spektral sınıf': s.catalogSpectral || s.spectral,
    'Görünür kadir': s.mag.toFixed(2),
    'Mutlak kadir': s.absMag.toFixed(2),
    'Parlaklık': `${fmtLum(s.luminosity)} L☉`,
    'B−V': s.bv.toFixed(2),
  };
  if (s.hip) f['Hipparcos'] = `HIP ${s.hip}`;
  if (s.names?.bayer) f['Bayer/Flamsteed'] = s.names.bayer;
  if (s.names?.gliese) f['Gliese'] = s.names.gliese;
  return f;
}

function fmtLum(l: number): string {
  if (l >= 100) return l.toFixed(0);
  if (l >= 1) return l.toFixed(2);
  if (l >= 0.001) return l.toFixed(4);
  return l.toExponential(2);
}
