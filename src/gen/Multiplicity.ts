/**
 * Stellar multiplicity: how many companions a star has, on what orbits, and what they are.
 *
 * Statistics follow the field surveys as compiled by Duchêne & Kraus (2013) and Moe & Di Stefano
 * (2017): the multiplicity fraction climbs from ~22 % for the lowest-mass stars to >80 % for
 * O stars; solar-type periods are log-normal (Raghavan et al. 2010: ⟨log P/d⟩ = 5.03, σ = 2.28),
 * M dwarfs peak at a few tens of AU (Winters et al. 2019), massive stars are heavily weighted to
 * short periods (Sana et al. 2012); mass ratios are close to flat with a twin excess at short
 * periods; orbits shorter than ~10 days are tidally circularised; hierarchical triples obey the
 * Mardling & Aarseth (2001) stability criterion. Compact companions (white dwarfs, neutron stars,
 * brown dwarfs) appear at their observed rates — including the brown-dwarf desert.
 *
 * Well-known systems come from the literature instead (`KNOWN_MULTIPLES`).
 */
import { AU_KM, G } from '../core/constants';
import type { StarInfo } from '../data/StarCatalog';
import { SUN_MASS_KG, SUN_RADIUS_KM, spectralFromTemperature } from '../astro/stellar';
import type { Rng } from './SystemGenerator';

export type CompKind = 'ms' | 'giant' | 'wd' | 'bd' | 'ns' | 'bh' | 'wr';

export interface CompanionSpec {
  kind: CompKind;
  massSolar: number;
  /** explicit physical parameters (curated systems); otherwise derived from the mass */
  radiusSolar?: number;
  temperature?: number;
  spectral?: string;
  /** one-line literature note (curated systems) */
  note?: string;
}

export interface PairSpec {
  pair: [NodeSpec, NodeSpec];
  periodDays: number;
  e: number;
  /** curated: the orbit is poorly constrained */
  uncertain?: boolean;
}

/** `'primary'` stands for the catalogue star itself */
export type NodeSpec = 'primary' | CompanionSpec | PairSpec;

export function isPair(n: NodeSpec): n is PairSpec { return typeof n === 'object' && 'pair' in n; }

/* ------------------------------------------------------------------ */
/*  Physical parameters                                                */
/* ------------------------------------------------------------------ */

export interface CompanionPhysics {
  kind: CompKind;
  massSolar: number;
  radiusKm: number;
  temperature: number;
  /** solar units (bolometric) */
  luminosity: number;
  spectral: string;
}

/** Zero-age-ish main-sequence luminosity (solar units) */
export function mainSequenceL(m: number): number {
  return m < 0.43 ? 0.23 * Math.pow(m, 2.3) : m < 2 ? Math.pow(m, 4) : m < 55 ? 1.4 * Math.pow(m, 3.5) : 32_000 * m;
}

export function mainSequenceR(m: number): number {
  return m < 1 ? Math.pow(m, 0.8) : Math.pow(m, 0.57);
}

/** Nauenberg (1972) mass–radius relation of a carbon–oxygen white dwarf (solar radii) */
export function whiteDwarfR(m: number): number {
  const x = Math.pow(m / 1.44, 4 / 3);
  return 0.0126 * Math.pow(m, -1 / 3) * Math.sqrt(Math.max(1 - x, 0.02));
}

function lumOf(radiusSolar: number, T: number): number {
  return radiusSolar * radiusSolar * Math.pow(T / 5772, 4);
}

function bdSpectral(T: number): string {
  return T > 2100 ? 'L0' : T > 1300 ? `L${Math.min(9, Math.round((2100 - T) / 90))}` : T > 500 ? `T${Math.min(9, Math.round((1300 - T) / 90))}` : 'Y0';
}

/** Fill in the physics of a companion from its mass (and the explicit curated values, when given) */
export function companionPhysics(s: CompanionSpec, rng: Rng): CompanionPhysics {
  const m = s.massSolar;
  let R: number, T: number, spectral: string;
  switch (s.kind) {
    case 'wd':
      R = s.radiusSolar ?? whiteDwarfR(m);
      T = s.temperature ?? rng.logRange(5500, 28_000);
      spectral = s.spectral ?? (T > 12_000 ? 'DA' : T > 8000 ? 'DA/DB' : 'DC');
      break;
    case 'bd': {
      R = s.radiusSolar ?? 0.1;
      T = s.temperature ?? Math.max(400, 2300 * Math.pow(m / 0.075, 0.9) * rng.range(0.5, 1.0));
      spectral = s.spectral ?? bdSpectral(T);
      break;
    }
    case 'ns':
      R = s.radiusSolar ?? 12 / SUN_RADIUS_KM;
      T = s.temperature ?? 1e6;
      spectral = s.spectral ?? 'NS';
      break;
    case 'bh':
      // Schwarzschild radius; no photosphere
      R = (2.953 * m) / SUN_RADIUS_KM;
      T = 0;
      spectral = s.spectral ?? 'BH';
      return { kind: s.kind, massSolar: m, radiusKm: R * SUN_RADIUS_KM, temperature: 0, luminosity: 0, spectral };
    case 'giant':
    case 'wr':
      // red-clump / RGB giants: ~10 R☉ for solar-mass stars, growing with mass
      R = s.radiusSolar ?? (s.kind === 'wr' ? 2 + m * 0.3 : 10 * Math.pow(Math.max(m, 0.8), 0.7) * rng.range(0.7, 1.6));
      T = s.temperature ?? (s.kind === 'wr' ? rng.range(40_000, 90_000) : rng.range(4000, 5200));
      spectral = s.spectral ?? (s.kind === 'wr' ? (rng.chance(0.5) ? 'WN' : 'WC') : spectralFromTemperature(T) + ' III');
      break;
    default: {
      R = s.radiusSolar ?? mainSequenceR(m);
      const L = mainSequenceL(m);
      T = s.temperature ?? 5772 * Math.pow(L / (R * R), 0.25);
      spectral = s.spectral ?? spectralFromTemperature(T) + ' V';
    }
  }
  return { kind: s.kind, massSolar: m, radiusKm: R * SUN_RADIUS_KM, temperature: T, luminosity: lumOf(R, T), spectral };
}

/* ------------------------------------------------------------------ */
/*  Statistics                                                         */
/* ------------------------------------------------------------------ */

/** Fraction of primaries of mass m (M☉) that have at least one stellar/substellar companion */
export function multiplicityFraction(m: number): number {
  // Duchêne & Kraus 2013, Table 1 (log-linear between the bins)
  const pts: Array<[number, number]> = [[0.07, 0.22], [0.3, 0.26], [0.6, 0.35], [1.0, 0.44], [2.0, 0.55], [5.0, 0.65], [12, 0.72], [30, 0.85]];
  if (m <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    if (m <= pts[i][0]) {
      const t = (Math.log(m) - Math.log(pts[i - 1][0])) / (Math.log(pts[i][0]) - Math.log(pts[i - 1][0]));
      return pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t;
    }
  }
  return pts[pts.length - 1][1];
}

/** Number of companions of a multiple system (1 … 3) */
function companionCount(rng: Rng, m: number): number {
  const u = rng.next();
  if (m < 1.3) return u < 0.75 ? 1 : u < 0.93 ? 2 : 3;        // Raghavan 2010: 33 % / 8 % / 3 % of all FGK
  if (m < 8) return u < 0.6 ? 1 : u < 0.87 ? 2 : 3;
  return u < 0.5 ? 1 : u < 0.8 ? 2 : 3;                        // O/B stars: triples and quadruples are common
}

function gauss(rng: Rng): number {
  const u1 = Math.max(rng.next(), 1e-9), u2 = rng.next();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

/** log10 of an orbital period in days, drawn for a primary of mass m */
function drawLogP(rng: Rng, m: number): number {
  let lp: number;
  if (m < 0.5) lp = 4.3 + 1.6 * gauss(rng);                            // M dwarfs: peak ~20 AU, narrow
  else if (m < 1.5) lp = 5.03 + 2.28 * gauss(rng);                     // Raghavan et al. 2010
  else if (m < 5) lp = 5.6 + 2.3 * gauss(rng);                         // A stars (De Rosa et al. 2014)
  else if (rng.chance(0.6)) lp = 0.15 + 3.35 * Math.pow(rng.next(), 1 / 0.45); // Sana et al. 2012: f ∝ (log P)^-0.55
  else lp = 6.0 + 1.5 * gauss(rng);
  return Math.min(Math.max(lp, 0.1), 8.0);
}

/** Mass ratio q = m₂/m₁ */
function drawQ(rng: Rng, m: number, logP: number): number {
  // twin excess at short periods (Moe & Di Stefano 2017: ~10–20 % for P < 10⁵ d around solar type)
  if (logP < 5 && rng.chance(m < 5 ? 0.15 : 0.08)) return rng.range(0.95, 1.0);
  return rng.range(0.1, 1.0);
}

/** Eccentricity for a period: circularised below ~10 d, else a rising distribution capped by periastron contact */
function drawE(rng: Rng, logP: number): number {
  if (logP < 1.0) return Math.abs(gauss(rng)) * 0.02;
  const P = Math.pow(10, logP);
  const eMax = Math.min(0.95, 1 - Math.pow(P / 2, -2 / 3));
  const eta = 0.4 + 0.6 * Math.min(1, Math.max(0, (logP - 2) / 4)); // thermal-ish for wide pairs
  return eMax * Math.pow(rng.next(), 1 / (1 + eta));
}

/** Semi-major axis (AU) from the period (days) and the total mass (M☉) */
export function semiMajorAU(periodDays: number, totalMassSolar: number): number {
  const P = periodDays * 86_400;
  const gm = (G * totalMassSolar * SUN_MASS_KG) / 1e9; // km³/s²
  return Math.cbrt((gm * P * P) / (4 * Math.PI * Math.PI)) / AU_KM;
}

export function periodDaysOf(aAU: number, totalMassSolar: number): number {
  const a = aAU * AU_KM;
  const gm = (G * totalMassSolar * SUN_MASS_KG) / 1e9;
  return (2 * Math.PI * Math.sqrt((a * a * a) / gm)) / 86_400;
}

/* ------------------------------------------------------------------ */
/*  Procedural trees                                                   */
/* ------------------------------------------------------------------ */

interface Draft { spec: CompanionSpec; logP: number; e: number }

/** A companion for a given primary: kind, mass and orbit draw */
function draftCompanion(rng: Rng, star: StarInfo): Draft {
  const m1 = star.massSolar;
  const evolved = star.lumClass <= 3 && !star.isWhiteDwarf;
  const logP = drawLogP(rng, m1);
  const e = drawE(rng, logP);
  let spec: CompanionSpec;
  // the companion that was once the more massive star and has already died
  const pWD = star.isWhiteDwarf ? 0.2 : evolved ? 0.1 : m1 > 0.9 ? 0.05 : 0.02;
  if (rng.chance(pWD)) spec = { kind: 'wd', massSolar: Math.min(1.25, Math.max(0.4, 0.62 + 0.12 * gauss(rng))) };
  else if (m1 > 8 && rng.chance(0.03)) spec = { kind: 'ns', massSolar: rng.range(1.25, 1.9) };
  // stellar-mass black holes: ~1 % of the companions of massive stars (Cyg X-1, HD 130298 …),
  // a few 10⁻⁴ for solar-type primaries (Gaia BH1/BH2 — dormant, no disk)
  else if (rng.chance(m1 > 15 ? 0.012 : m1 > 5 ? 0.004 : 0.0004)) spec = { kind: 'bh', massSolar: rng.range(5, m1 > 15 ? 21 : 12) };
  else {
    let m2 = star.isWhiteDwarf ? rng.logRange(0.1, 1.0) : drawQ(rng, m1, logP) * m1;
    const aAU = semiMajorAU(Math.pow(10, logP), m1 + m2);
    // brown-dwarf desert: almost no substellar companions inside ~5 AU
    if (m2 < 0.075 && aAU < 5 && rng.chance(0.95)) m2 = rng.range(0.25, 1.0) * Math.max(m1, 0.3);
    if (m2 < 0.013) m2 = rng.range(0.013, 0.075);
    if (m2 < 0.075) spec = { kind: 'bd', massSolar: m2 };
    // a near-twin of an evolved primary left the main sequence with it (Capella, Almach …)
    else if (evolved && m2 > 0.93 * m1) spec = { kind: 'giant', massSolar: Math.min(m2, m1 * 0.999) };
    // the hot, short-lived companions of O stars: some are already stripped Wolf-Rayet stars
    else if (m1 > 20 && m2 > 15 && rng.chance(0.15)) spec = { kind: 'wr', massSolar: Math.min(m2, m1 * 0.999) * 0.5 };
    else spec = { kind: 'ms', massSolar: Math.min(m2, Math.max(m1 * 0.999, 0.08)) };
  }
  return { spec, logP, e };
}

interface Node { spec: NodeSpec; mass: number; radiusKm: number }

function nodeOf(spec: NodeSpec, star: StarInfo, rng: Rng): Node {
  if (spec === 'primary') return { spec, mass: star.massSolar, radiusKm: star.radiusKm };
  if (isPair(spec)) {
    const a = nodeOf(spec.pair[0], star, rng), b = nodeOf(spec.pair[1], star, rng);
    return { spec, mass: a.mass + b.mass, radiusKm: Math.max(a.radiusKm, b.radiusKm) };
  }
  const p = companionPhysics(spec, rng);
  return { spec, mass: p.massSolar, radiusKm: p.radiusKm };
}

/**
 * Make `outer` a stable, detached orbit around `inner` (a pair or a star of total mass / size as
 * given): periastron clear of the stellar surfaces, and — for a pair inside — the Mardling &
 * Aarseth (2001) criterion with a margin.
 */
function stabilise(pair: PairSpec, inner: Node, outer: Node, innerPair: PairSpec | null, innerMass: number): void {
  const M = inner.mass + outer.mass;
  let a = semiMajorAU(pair.periodDays, M);
  const peri = a * (1 - pair.e);
  // detached: no contact at periastron (a few radii of the bigger star)
  const minPeri = (2.5 * (inner.radiusKm + outer.radiusKm)) / AU_KM;
  let need = minPeri;
  if (innerPair) {
    const aIn = semiMajorAU(innerPair.periodDays, innerMass);
    const qOut = outer.mass / innerMass;
    const crit = 2.8 * Math.pow(((1 + qOut) * (1 + pair.e)) / Math.sqrt(1 - pair.e), 0.4) * aIn * 1.2;
    need = Math.max(need, crit);
  }
  if (peri < need) {
    a = need / (1 - pair.e);
    pair.periodDays = periodDaysOf(a, M);
  }
}

/**
 * The multiplicity tree of a star: `'primary'` for a single star, otherwise a hierarchy of pairs.
 * Deterministic for a given rng state. `single` forces a lone star (hand-made companions exist,
 * or a catalogue neighbour already is the companion).
 */
export function multiplicityTree(rng: Rng, star: StarInfo, single = false): NodeSpec {
  const known = knownMultiple(star);
  if (known) return known;
  if (single) return 'primary';
  const m1 = star.massSolar;
  if (!rng.chance(multiplicityFraction(m1))) return 'primary';
  const n = companionCount(rng, m1);
  const drafts: Draft[] = [];
  for (let i = 0; i < n; i++) drafts.push(draftCompanion(rng, star));
  drafts.sort((p, q) => p.logP - q.logP);
  const pairOf = (a: NodeSpec, b: NodeSpec, d: Draft): PairSpec => ({ pair: [a, b], periodDays: Math.pow(10, d.logP), e: d.e });

  // innermost companion pairs with the primary
  let tree: PairSpec = pairOf('primary', drafts[0].spec, drafts[0]);
  stabilise(tree, nodeOf('primary', star, rng), nodeOf(drafts[0].spec, star, rng), null, 0);
  if (n === 1) return tree;

  if (n === 3 && rng.chance(0.55)) {
    // 2+2 quadruple: the second and third companions form their own pair
    const [c1, c2] = drafts[1].spec.massSolar >= drafts[2].spec.massSolar ? [drafts[1], drafts[2]] : [drafts[2], drafts[1]];
    const second = pairOf(c1.spec, c2.spec, { ...c1, logP: Math.min(drafts[1].logP, drafts[2].logP) - 0.3 });
    stabilise(second, nodeOf(c1.spec, star, rng), nodeOf(c2.spec, star, rng), null, 0);
    const inner = nodeOf(tree, star, rng), other = nodeOf(second, star, rng);
    const outer = pairOf(tree, second, { ...drafts[2], logP: Math.max(drafts[2].logP, drafts[1].logP) + 0.5 });
    stabilise(outer, inner, other, tree, inner.mass);
    // the wider inner pair must also be stable against the outer orbit
    const aOut = semiMajorAU(outer.periodDays, inner.mass + other.mass) * (1 - outer.e);
    const aSecond = semiMajorAU(second.periodDays, other.mass);
    if (aSecond * 4 > aOut) { outer.periodDays = periodDaysOf((aSecond * 4.5) / (1 - outer.e), inner.mass + other.mass); }
    return outer;
  }
  // 2+1 (+1): each further companion orbits everything inside
  for (let i = 1; i < n; i++) {
    const inner = nodeOf(tree, star, rng);
    const comp = nodeOf(drafts[i].spec, star, rng);
    const next = pairOf(tree, drafts[i].spec, drafts[i]);
    stabilise(next, inner, comp, tree, inner.mass);
    tree = next;
  }
  return tree;
}

/* ------------------------------------------------------------------ */
/*  Known systems (literature values; see the notes on each)           */
/* ------------------------------------------------------------------ */

const YR = 365.25;
const ms = (massSolar: number, spectral: string, radiusSolar?: number, temperature?: number, note?: string): CompanionSpec =>
  ({ kind: 'ms', massSolar, spectral, radiusSolar, temperature, note });
const giant = (massSolar: number, spectral: string, radiusSolar: number, temperature: number, note?: string): CompanionSpec =>
  ({ kind: 'giant', massSolar, spectral, radiusSolar, temperature, note });
const wd = (massSolar: number, radiusSolar: number, temperature: number, spectral: string, note?: string): CompanionSpec =>
  ({ kind: 'wd', massSolar, radiusSolar, temperature, spectral, note });
const bd = (massSolar: number, temperature: number, spectral: string, note?: string): CompanionSpec =>
  ({ kind: 'bd', massSolar, temperature, spectral, radiusSolar: 0.1, note });
const pair = (a: NodeSpec, b: NodeSpec, periodDays: number, e: number, uncertain = false): PairSpec => ({ pair: [a, b], periodDays, e, uncertain });

/** keyed by the HYG proper name (or Gliese designation) of the catalogue star */
export const KNOWN_MULTIPLES: Record<string, NodeSpec> = {
  'Sirius': pair('primary', wd(1.018, 0.0084, 25_200, 'DA2', 'Bilinen ilk beyaz cüce (Clark, 1862); Güneş kütlesinde, Dünya boyutunda'), 50.13 * YR, 0.5914),
  'Procyon': pair('primary', wd(0.602, 0.01234, 7740, 'DQZ', 'Yörünge sarsıntısından 1844\'te öngörülen, 1896\'da görülen beyaz cüce'), 40.84 * YR, 0.40),
  'Capella': pair('primary', giant(2.4826, 'G1 III', 8.83, 5730, 'İki sarı dev; 104 günlük dairesel yörünge, 0,74 AU ayrıklık'), 104.022, 0.0009),
  'Algol': pair(pair('primary', giant(0.70, 'K0 IV', 3.48, 4500, 'Her 2,87 günde ana yıldızın önünden geçer: ilk bilinen örten çift (Goodricke, 1783)'), 2.867328, 0),
    ms(1.76, 'A7m', 1.73, 7500), 680.17, 0.227),
  'Spica': pair('primary', ms(7.21, 'B2 V', 3.74, 20_900, 'Dört günlük yörüngede gelgitle çarpılmış iki sıcak yıldız'), 4.01454, 0.133),
  'Polaris': pair('primary', ms(1.26, 'F6 V', 1.04, 6900, 'Hubble\'ın 2006\'da çözümlediği yakın yoldaş; 18,8 AU'), 29.59 * YR, 0.608),
  'Regulus': pair('primary', wd(0.30, 0.05, 15_000, 'He ön-beyaz cüce', 'Kütlesini Regulus\'a aktarmış, 40 günlük yörüngedeki ölü çekirdek (Gies vd. 2008)'), 40.11, 0),
  'Castor': pair(
    pair(
      pair('primary', ms(0.5, 'M0 V', undefined, undefined, 'Castor Aa\'nın 9,2 günlük kırmızı cüce yoldaşı'), 9.2128, 0.499),
      pair(ms(2.0, 'A2 Vm', 1.6, 8800), ms(0.6, 'M3 V'), 2.9283, 0),
      445 * YR, 0.343),
    pair(ms(0.60, 'M1 V'), ms(0.60, 'M1 V'), 0.8143, 0),
    14_000 * YR, 0.5, true),
  'Mizar': pair('primary', ms(2.2, 'A2 V', 2.4, 9000, 'İlk tayfsal çift yıldız (Pickering, 1889)'), 20.5386, 0.5415),
  'Albireo': pair('primary', ms(2.7, 'B9.5 V', 2.6, 10_500, 'Turuncu devin yakın yoldaşı; yörüngesi belirsiz'), 213 * YR, 0.2, true),
  'Antares': pair('primary', ms(7.2, 'B2.5 V', 5.2, 18_500, 'Kızıl üstdevin ~550 AU\'daki mavi yoldaşı; birkaç bin yıllık yörünge'), 1800 * YR, 0.4, true),
  'Rigel': pair('primary', pair(ms(3.84, 'B9 V', 3.0, 10_500), ms(2.9, 'B9 V'), 9.86, 0.1), 24_000 * YR, 0.3, true),
  'Acrux': pair('primary', ms(6.05, 'B1 V', 4.8, 24_000, 'α¹ Cru\'nun 76 günlük tayfsal yoldaşı'), 75.7794, 0.46),
  'Mintaka': pair(pair('primary', ms(8.4, 'B1 V', 4.0, 25_000, '5,7 günlük örten yoldaş'), 5.732436, 0.0838), ms(12, 'B0 IV', 5.5, 29_000), 346 * YR, 0.6, true),
  'Alnitak': pair(pair('primary', ms(14, 'B1 IV', 7.3, 29_000, '7,3 yıllık yörüngedeki yakın yoldaş'), 2687.3, 0.338), ms(16, 'B0 III', 8, 29_000), 1500 * YR, 0.5, true),
  'Aldebaran': pair('primary', ms(0.45, 'M2 V', undefined, undefined, 'Ortak öz hareketle doğrulanan uzak kırmızı cüce (~600 AU)'), 11_600 * YR, 0.3, true),
  'Almaaz': pair('primary', ms(5.9, 'B5 V', 3.9, 15_000, 'Dev bir toz diskine gömülü; 27 yılda bir ana yıldızı iki yıl boyunca örter'), 27.1 * YR, 0.227),
  'Sheliak': pair('primary', ms(13.2, 'B0.5 V', 6, 30_000, 'Yığılma diskine saklı kütle alıcı; yarı-ayrık etkileşen çift'), 12.9414, 0),
  'Menkalinan': pair('primary', ms(2.33, 'A1 IV', 2.6, 9200, 'Neredeyse eş iki yıldız, 3,96 günlük örten yörünge'), 3.96, 0),
  'Alcor': pair('primary', ms(0.25, 'M3 V', undefined, undefined, '2009\'da keşfedilen kırmızı cüce yoldaş'), 90 * YR, 0.3, true),
  'Hadar': pair(pair('primary', giant(10.3, 'B1 III', 7.4, 25_000, 'Çok dış merkezli (e = 0,83) 357 günlük yörünge'), 357.0, 0.825), ms(5, 'B1 V', 3.5, 17_000), 250 * YR, 0.4, true),
  'Mira': pair('primary', wd(0.7, 0.012, 10_000, 'DA (yığılma)', 'Mira\'nın rüzgârından madde toplayan beyaz cüce (VZ Ceti)'), 500 * YR, 0.3, true),
  'Alpheratz': pair('primary', ms(1.8, 'A3 V', 1.65, 8500), 96.7015, 0.535),
  'Thuban': pair('primary', ms(2.4, 'A1 V', 2.2, 9500), 51.4167, 0.43),
  'Dubhe': pair('primary', ms(1.7, 'F0 V', 1.5, 7300, '23 AU ayrıklıkta, 44 yıllık yörünge'), 44.4 * YR, 0.4),
  'Shaula': pair(pair('primary', ms(1.8, 'ön-anakol', 1.6, 8000, 'Henüz anakola oturmamış genç yoldaş'), 5.9525, 0), ms(8.1, 'B2 IV', 4.5, 22_000), 1053, 0.23),
  'Rasalgethi': pair('primary', pair(giant(2.5, 'G8 III', 10, 4900), ms(1.6, 'F2 V', 1.5, 7000), 51.578, 0.1), 3600 * YR, 0.3, true),
  'Achernar': pair('primary', ms(2.0, 'A3 IV', 1.8, 8500, '14,7 yıllık, çok dış merkezli yörünge (Kervella vd. 2022)'), 14.7 * YR, 0.73),
  'Gl 229': pair('primary', pair(bd(0.0363, 900, 'T7', 'İlk kesin kahverengi cüce (1995) — 2024\'te kendisi de ikili çıktı'), bd(0.0325, 900, 'T7'), 12.1, 0.1), 235 * YR, 0.85),
};

export function knownMultiple(star: StarInfo): NodeSpec | null {
  if (star.procedural) return null;
  const n = star.names;
  return (n?.proper && KNOWN_MULTIPLES[n.proper]) || (n?.gliese && KNOWN_MULTIPLES[n.gliese]) || KNOWN_MULTIPLES[star.name] || null;
}

/* ------------------------------------------------------------------ */
/*  Dynamical limits for planets (Holman & Wiegert 1999)               */
/* ------------------------------------------------------------------ */

/** Largest stable circumstellar (S-type) orbit around one component of a binary, in units of the binary's a */
export function sTypeLimit(e: number, mu: number): number {
  return Math.max(0.05, 0.464 - 0.380 * mu - 0.631 * e + 0.586 * mu * e + 0.150 * e * e - 0.198 * mu * e * e);
}

/** Smallest stable circumbinary (P-type) orbit, in units of the binary's a */
export function pTypeLimit(e: number, mu: number): number {
  return 1.60 + 5.10 * e - 2.22 * e * e + 4.12 * mu - 4.27 * e * mu - 5.09 * mu * mu + 4.61 * e * e * mu * mu;
}
