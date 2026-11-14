import { Vector3 } from 'three';
import { PARSEC_KM } from '../core/constants';
import type { LandmarkDef, LandmarkKind, NebulaGas, RemnantClass } from '../data/landmarks';
import { Rng, hashSeed } from '../gen/SystemGenerator';
import { _, fixed, fmtNum } from '../i18n';
import { fmtLightYears } from '../ui/format';
import type { GalaxyIndex } from './galaxies';
import type { GalaxyModel } from './GalaxyModel';
import { MAX_GLOBULAR, MAX_OPEN } from './ClusterStars';
import { lightPositionPc, resolveNebulaProfile } from '../render/nebula/NebulaProfile';

/**
 * Procedural deep-sky objects: every galaxy is seeded with nebulae, clusters, remnants and a few
 * exotic stars, generated deterministically per cell (like the procedural stars) so a traveller
 * far from the real catalogues keeps finding things. Ids `q{galaxy}:{ci}:{cj}:{ck}:{n}`.
 *
 * In the Milky Way nothing is generated within the radius the real catalogues cover for each class
 * (COVERAGE_EXCLUDE_PC).
 */
export const PROC_LANDMARK_CELL_PC = 600;
/** cells generated around the camera's, per axis: everything within REACH cells of the camera exists */
const REACH = 3;
/** generated objects kept at once (the nearest cells first), globulars aside */
const MAX_TOTAL = 1600;
/**
 * Globular clusters are generated on a coarser grid with a far longer reach: a −8 mag globular
 * is a naked-eye object from 10 kpc, so (unlike a planetary nebula) it must not pop out of
 * existence when the camera leaves its 600 pc neighbourhood. Ids `qg{galaxy}:{ci}:{cj}:{ck}:{n}`.
 */
export const GLOBULAR_CELL_PC = 2400;
const GLOBULAR_REACH = 6;
/** the cell offsets of the neighbourhood, nearest first: shell by shell (Chebyshev), so a cap leaves a complete cube */
const CELL_ORDER: Array<[number, number, number, number]> = [];
for (let i = -REACH; i <= REACH; i++) for (let j = -REACH; j <= REACH; j++) for (let k = -REACH; k <= REACH; k++) CELL_ORDER.push([i, j, k, Math.max(Math.abs(i), Math.abs(j), Math.abs(k))]);
CELL_ORDER.sort((a, b) => a[3] - b[3] || (a[0] * a[0] + a[1] * a[1] + a[2] * a[2]) - (b[0] * b[0] + b[1] * b[1] + b[2] * b[2]));
const MAX_GLOBULARS = 320;
export type ProcKind = 'hii' | 'reflection' | 'planetary' | 'open' | 'globular' | 'snr' | 'bubble' | 'hypergiant' | 'wr' | 'magnetar';

/**
 * Coverage policy (Milky Way only): inside the radius where the real catalogues are reasonably
 * complete for a class, nothing of that class is generated; outside, the generator fills the gap.
 * Radii from the distance distributions of public/data/deepsky.json (scripts/build-deepsky.mjs):
 *   open clusters  MWSC is complete to ≈1.8 kpc (median 2.0 kpc, 2047 of 2922 inside 2.7 kpc)
 *   H II regions   WISE catalogue: 306 inside 2.7 kpc, density halves beyond → 2.7 kpc
 *   planetaries    HASH distances: 321 inside 2.7 kpc, ≈ the expected local population → 2.7 kpc
 *   remnants       25 known inside 2.7 kpc ≈ the ≈30 expected from the Galactic SN rate → 2.7 kpc
 *   reflection     no reflection-nebula catalogue is loaded (a handful of hand-picked ones) → 1.2 kpc
 *   wind bubbles   not catalogued at all → 1.5 kpc
 *   exotic stars   hypergiants / WR stars / magnetars: the known ones are landmarks → 2.7 kpc
 *   globulars      157 of the ≈160 known are real landmarks; the generated halo population is kept
 *                  beyond 2.7 kpc for now (dropping it would void existing discoveries) — revisit
 * Ids never depend on the policy (they come from the cell grid), so a version bump only changes
 * which objects exist, never where an existing one is or what it is called.
 */
export const COVERAGE_POLICY_VERSION = 2;
const COVERAGE_EXCLUDE_PC: Record<ProcKind, number> = {
  hii: 2700, reflection: 1200, planetary: 2700, open: 2000, globular: 2700,
  snr: 2700, bubble: 1500, hypergiant: 2700, wr: 2700, magnetar: 2700,
};

/** Visual landmark kind of each generated class */
const KIND_OF: Record<ProcKind, LandmarkKind> = {
  hii: 'nebula', reflection: 'nebula', planetary: 'planetary', open: 'cluster', globular: 'globular',
  snr: 'remnant', bubble: 'remnant', hypergiant: 'star', wr: 'star', magnetar: 'pulsar',
};

/** Expected objects per cell at unit density: [base, young-weighted] */
const RATE: Record<ProcKind, [number, number]> = {
  hii: [0, 1.2], reflection: [0, 0.8], planetary: [1.0, 0], open: [0.6, 1.0], globular: [0, 0],
  snr: [0.15, 0.4], bubble: [0, 0.3], hypergiant: [0, 0.14], wr: [0, 0.12], magnetar: [0.05, 0.03],
};
const ORDER: ProcKind[] = ['hii', 'reflection', 'planetary', 'open', 'globular', 'snr', 'bubble', 'hypergiant', 'wr', 'magnetar'];

/* ---------------- naming ---------------- */

const ADJ = [
  'Kızıl', 'Mavi', 'Zümrüt', 'Kehribar', 'Gümüş', 'Altın', 'Uyuyan', 'Yitik', 'Fısıldayan', 'Donmuş', 'Kırık', 'Sessiz',
  'Yalnız', 'Çifte', 'Ters', 'Gölge', 'Yanık', 'Soluk', 'Parlak', 'Gizli', 'Uzak', 'Dönen', 'Ağlayan', 'Kör', 'Uyanan', 'Yırtık',
];
/** adjectives that name a colour: a drawn one is swapped for the one matching the object's actual tint */
const COLOUR_ADJ = ['Kızıl', 'Mavi', 'Zümrüt', 'Kehribar', 'Gümüş', 'Altın'];

function colourAdjective(c: readonly number[] | undefined): string {
  if (!c) return 'Gümüş';
  const [r, g, b] = c, max = Math.max(r, g, b), min = Math.min(r, g, b);
  if (max - min < 0.14 * max) return 'Gümüş';
  if (b >= r && b >= g) return 'Mavi';
  if (g >= r) return 'Zümrüt';
  if (g < 0.62 * r) return 'Kızıl';
  return b < 0.55 * r && g < 0.82 * r ? 'Kehribar' : 'Altın';
}

const NOUN = [
  'Kelebek', 'Göz', 'Taç', 'Yelken', 'Fener', 'Çan', 'Kalp', 'Kuğu', 'Yılan', 'Kılıç', 'Kapı', 'Ayna', 'Kanat', 'Çiçek', 'Kum Saati',
  'Örümcek', 'Halka', 'Mızrak', 'Deniz Kabuğu', 'Ejderha', 'Kule', 'Balina', 'Köpük', 'Mum', 'Pusula', 'Köprü', 'Tilki', 'Baykuş', 'Nar', 'Lamba',
];

const NAME_TEMPLATE: Record<ProcKind, string> = {
  hii: '{adj} {noun} Bulutsusu', reflection: '{adj} {noun} Bulutsusu', planetary: '{adj} {noun} Bulutsusu',
  open: '{adj} {noun} Kümesi', globular: '{adj} {noun} Küresel Kümesi', snr: '{adj} {noun} Kalıntısı', bubble: '{adj} {noun} Kabarcığı',
  hypergiant: 'Hiperdev YE-H {code}', wr: 'Wolf–Rayet YE-WR {code}', magnetar: 'Magnetar YE-M {code}',
};

/* ---------------- colours ---------------- */

const C = {
  open: [[0.75, 0.85, 1.0], [0.9, 0.93, 1.0], [1.0, 0.95, 0.85]] as Array<[number, number, number]>,
  globular: [[1.0, 0.9, 0.7], [1.0, 0.86, 0.62], [0.98, 0.93, 0.8]] as Array<[number, number, number]>,
};

type RGB = [number, number, number];
const mixRgb = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/** sprite colour of an H II region: Hα pink, whiter where [O III] reaches far, orange where [S II] is strong */
function hiiTint(gas: NebulaGas): RGB {
  let c = mixRgb([1.0, 0.4, 0.48], [0.78, 0.74, 0.86], clamp01((gas.excitation - 0.4) / 0.55));
  c = mixRgb(c, [1.0, 0.5, 0.32], 0.8 * Math.max(gas.lowIon - 0.5, 0));
  return mixRgb(c, [0.62, 0.7, 1.0], 0.3 * (gas.scatter ?? 0));
}

/**
 * Stars lighting reflection nebulae, weighted roughly as in van den Bergh's catalogue: mostly B,
 * some A, a few cool giants and supergiants. `e`: the colour they give the dust (see NebulaGas).
 */
const REFLECTION_STARS: Array<{ type: string; w: number; e: number }> = [
  { type: 'B1 V', w: 2, e: 1.0 }, { type: 'B2 V', w: 3, e: 0.92 }, { type: 'B5 V', w: 3, e: 0.82 },
  { type: 'B8 III', w: 2, e: 0.72 }, { type: 'A0 V', w: 2, e: 0.62 }, { type: 'A2 Ia', w: 1, e: 0.55 },
  { type: 'F0 Ib', w: 1, e: 0.38 }, { type: 'G8 Ib', w: 0.6, e: 0.22 }, { type: 'K1 III', w: 0.6, e: 0.12 },
  { type: 'M1 Iab', w: 0.6, e: 0.03 },
];

/** Wolf–Rayet stars of wind-blown bubbles: excitation `e` and nitrogen-rich ejecta `n` */
const WOLF_RAYET: Array<{ type: string; e: number; n: number }> = [
  { type: 'WN4', e: 0.85, n: 0.4 }, { type: 'WN5', e: 0.75, n: 0.5 }, { type: 'WN8', e: 0.35, n: 0.85 },
  { type: 'WC6', e: 0.65, n: 0.3 }, { type: 'WO2', e: 0.98, n: 0.2 },
];

function weightedPick<T extends { w: number }>(list: readonly T[], u: number): T {
  let total = 0;
  for (const x of list) total += x.w;
  let t = u * total;
  for (const x of list) { t -= x.w; if (t < 0) return x; }
  return list[list.length - 1];
}

/** sprite colour of a reflection nebula: its star's colour, bluer from the scattering */
function reflectionTint(e: number): RGB {
  const c = mixRgb([1.0, 0.78, 0.5], [0.58, 0.74, 1.0], clamp01(e / 0.5));
  return mixRgb(c, [0.48, 0.66, 1.0], clamp01((e - 0.5) / 0.5));
}

/** sprite colour of a planetary / wind bubble: red-orange at low excitation, teal, then blue as it rises */
function shellTint(gas: NebulaGas): RGB {
  let c = mixRgb([1.0, 0.56, 0.45], [0.5, 0.95, 0.82], clamp01((gas.excitation - 0.1) / 0.4));
  c = mixRgb(c, [0.58, 0.78, 1.0], clamp01((gas.excitation - 0.55) / 0.4));
  return mixRgb(c, [1.0, 0.45, 0.42], 0.8 * Math.max(gas.lowIon - 0.5, 0));
}

const REMNANT_TINT: Record<Exclude<RemnantClass, 'radiative'>, RGB> = {
  balmer: [1.0, 0.42, 0.5],
  oxygen: [0.55, 0.88, 0.86],
  plerion: [0.78, 0.82, 1.0],
  faded: [0.95, 0.42, 0.36],
};

/**
 * What a remnant shows, from how it exploded and how old it is: a Type Ia shell runs into neutral
 * gas and glows in Balmer lines for its first few thousand years; a core-collapse one shows its
 * oxygen-rich ejecta, or the synchrotron nebula of the pulsar it left. Once the shock slows below
 * a few hundred km/s it cools and radiates in filaments, [O III] only behind the faster parts
 * (≳ 100 km/s); after some tens of thousands of years only a faint red web remains.
 */
function remnantGas(rng: Rng, typeIa: boolean, age: number, v: number): NebulaGas {
  let remnant: RemnantClass;
  if (age > 30_000) remnant = 'faded';
  else if (typeIa) remnant = age < 4000 ? 'balmer' : 'radiative';
  else if (age < 3000) remnant = rng.chance(0.5) ? 'oxygen' : 'plerion';
  else remnant = age < 15_000 && rng.chance(0.3) ? 'plerion' : 'radiative';
  const excitation = 0.1 + 0.8 * clamp01(Math.log10(v / 80) / Math.log10(1500 / 80));
  return { excitation, lowIon: rng.range(0.3, 0.8), remnant };
}

function remnantTint(gas: NebulaGas): RGB {
  return gas.remnant && gas.remnant !== 'radiative' ? REMNANT_TINT[gas.remnant] : mixRgb([1.0, 0.55, 0.5], [0.7, 0.85, 0.95], gas.excitation);
}

export interface ProcLandmark {
  def: LandmarkDef;
  positionPc: Vector3;
  galaxy: number;
  procKind: ProcKind;
}

const _local = new Vector3();
const _sunLocal = new Vector3();
const _tmp = new Vector3();

export class ProcLandmarks {
  /** currently generated objects (camera neighbourhood) */
  readonly list: ProcLandmark[] = [];
  /**
   * Camera distance (pc) within which the list is complete, whichever way the camera moves inside
   * its cell: the layers drawing the objects fade them out toward it, so nothing pops in or out
   * when the neighbourhood is regenerated. Globulars have their own, far longer one.
   */
  reachPc = REACH * PROC_LANDMARK_CELL_PC;
  readonly globularReachPc = GLOBULAR_REACH * GLOBULAR_CELL_PC;
  private galaxy = -1;
  private cell = [NaN, NaN, NaN];
  /** generated cells, remembered: a crossing only generates the new slab (descriptions are the cost) */
  private readonly cellCache = new Map<string, ProcLandmark[]>();

  constructor(private readonly galaxies: GalaxyIndex) {}

  /** Regenerate when the camera changed cell / galaxy. Returns true when `list` changed. */
  update(camPc: Vector3, galaxy: number | null): boolean {
    if (galaxy === null) {
      if (this.galaxy === -1 && this.list.length === 0) return false;
      this.list.length = 0; this.galaxy = -1; this.cell = [NaN, NaN, NaN];
      return true;
    }
    const model = this.galaxies.model(galaxy);
    model.toLocal(camPc, _local);
    const s = PROC_LANDMARK_CELL_PC;
    const ci = Math.floor(_local.x / s), cj = Math.floor(_local.y / s), ck = Math.floor(_local.z / s);
    if (this.galaxy === galaxy && this.cell[0] === ci && this.cell[1] === cj && this.cell[2] === ck) return false;
    this.galaxy = galaxy; this.cell = [ci, cj, ck];
    this.list.length = 0;
    const sg = GLOBULAR_CELL_PC;
    const gi = Math.floor(_local.x / sg), gj = Math.floor(_local.y / sg), gk = Math.floor(_local.z / sg);
    const globulars: ProcLandmark[] = [];
    for (let i = gi - GLOBULAR_REACH; i <= gi + GLOBULAR_REACH; i++) {
      for (let j = gj - GLOBULAR_REACH; j <= gj + GLOBULAR_REACH; j++) {
        for (let k = gk - GLOBULAR_REACH; k <= gk + GLOBULAR_REACH; k++) globulars.push(...this.cached(`g${galaxy}:${i}:${j}:${k}`, () => { const o: ProcLandmark[] = []; this.generateGlobularCell(model, galaxy, i, j, k, o); return o; }));
      }
    }
    // the nearest first, so a cap leaves the sky around the camera complete
    if (globulars.length > MAX_GLOBULARS) {
      globulars.sort((a, b) => a.positionPc.distanceToSquared(camPc) - b.positionPc.distanceToSquared(camPc)).length = MAX_GLOBULARS;
    }
    this.list.push(...globulars);
    // nearest cells first, whole shells: in a crowded region the cap gives up the far shells (and
    // the reach shrinks with it) instead of a slab on one side of the camera
    let shell = 0, done = REACH;
    for (const [oi, oj, ok, ring] of CELL_ORDER) {
      if (ring !== shell) {
        if (this.list.length >= MAX_TOTAL + globulars.length) { done = shell; break; }
        shell = ring;
      }
      const i = ci + oi, j = cj + oj, k = ck + ok;
      this.list.push(...this.cached(`${galaxy}:${i}:${j}:${k}`, () => { const o: ProcLandmark[] = []; this.generateCell(model, galaxy, i, j, k, o); return o; }));
    }
    this.reachPc = Math.max(done, 1) * s;
    return true;
  }

  private cached(key: string, make: () => ProcLandmark[]): ProcLandmark[] {
    let v = this.cellCache.get(key);
    if (v) { this.cellCache.delete(key); this.cellCache.set(key, v); return v; }
    v = make();
    if (this.cellCache.size >= 4000) this.cellCache.delete(this.cellCache.keys().next().value!);
    this.cellCache.set(key, v);
    return v;
  }

  /** Globular clusters of one coarse cell (deterministic): the halo population, thinning outward. */
  private generateGlobularCell(model: GalaxyModel, g: number, i: number, j: number, k: number, out: ProcLandmark[]): void {
    const s = GLOBULAR_CELL_PC;
    _tmp.set((i + 0.5) * s, (j + 0.5) * s, (k + 0.5) * s);
    const rGal = _tmp.length() / model.p.radius;
    if (rGal > 2.5) return;
    const rng = new Rng(hashSeed(g, i, j, k, 0x6b));
    // a galaxy's whole globular system is ~160 clusters (Milky Way; ellipticals a few times more),
    // distributed as n(r) ∝ r⁻³ out to 2.5 radii: K·r⁻³·(cell volume / R³) with K chosen so the
    // integral over the halo gives that total
    const K = 3.3 * (model.p.type === 'E' ? 3 : 1);
    const vol = Math.pow(s / model.p.radius, 3);
    const expected = K * Math.pow(Math.max(rGal, 0.05), -3) * vol;
    const n = Math.min(12, Math.floor(expected + rng.next()));
    for (let q = 0; q < n; q++) {
      const o = this.makeObject(rng, model, g, i, j, k, q, 'globular', s, `qg${g}:${i}:${j}:${k}:${q}`, 0x1a7e);
      if (o.positionPc.lengthSq() > 0) out.push(o);
    }
  }

  /** Objects of one cell (deterministic). */
  private generateCell(model: GalaxyModel, g: number, i: number, j: number, k: number, out: ProcLandmark[]): void {
    const s = PROC_LANDMARK_CELL_PC;
    _tmp.set((i + 0.5) * s, (j + 0.5) * s, (k + 0.5) * s);
    const rho = model.density(_tmp);
    // the halo holds nothing but globular clusters, and those come from the coarse grid
    if (rho < 0.01) return;
    const youth = model.youth(_tmp);
    const rng = new Rng(hashSeed(g, i, j, k, 0x61));
    let q = 0;
    for (const kind of ORDER) {
      if (kind === 'globular') continue;
      const [base, young] = RATE[kind];
      const expected = rho * (base + young * youth);
      const n = Math.min(6, Math.floor(expected + rng.next()));
      for (let m = 0; m < n; m++) {
        const o = this.makeObject(rng, model, g, i, j, k, q++, kind);
        if (o.positionPc.lengthSq() > 0) out.push(o);
      }
    }
  }

  /**
   * One object. Its RNG is derived from the id, so a landmark can be rebuilt from the id alone
   * (deep links, saved places) regardless of the order inside the cell.
   */
  private makeObject(
    cellRng: Rng, model: GalaxyModel, g: number, i: number, j: number, k: number, q: number, kind: ProcKind,
    s = PROC_LANDMARK_CELL_PC, id = `q${g}:${i}:${j}:${k}:${q}`, salt = 0x1a7d,
  ): ProcLandmark {
    const rng = new Rng(hashSeed(g, i, j, k, q, salt));
    // position inside the cell; young objects hug the mid-plane
    const local = new Vector3((i + cellRng.next()) * s, (j + cellRng.next()) * s, (k + cellRng.next()) * s);
    if (KIND_OF[kind] !== 'globular' && model.p.type !== 'E' && j * s <= 0 && (j + 1) * s > 0) {
      const hz = model.scaleHeight * (RATE[kind][1] > 0 ? 0.8 : 1.6);
      local.y = Math.max(j * s, Math.min((j + 1) * s, gauss(rng) * hz));
    }
    const positionPc = model.toScene(local);
    // inside the real catalogue's reach for this class we leave the sky to the real objects
    if (g === 0) {
      model.toLocal(_sunLocal.set(0, 0, 0), _sunLocal);
      if (local.distanceTo(_sunLocal) < COVERAGE_EXCLUDE_PC[kind]) positionPc.set(0, 0, 0);
    }
    const code = (hashSeed(g, i, j, k, q, 0x9e37) & 0x7fffffff).toString(36).toUpperCase().slice(0, 5);
    const adjKey = ADJ[rng.int(0, ADJ.length - 1)];
    const noun = _(NOUN[rng.int(0, NOUN.length - 1)]);
    const distKm = positionPc.length() * PARSEC_KM;
    const def = this.describe(rng, kind, id, '', distKm);
    const adj = _(COLOUR_ADJ.includes(adjKey) ? colourAdjective(def.color) : adjKey);
    def.name = _(NAME_TEMPLATE[kind], { adj, noun, code });
    return { def, positionPc, galaxy: g, procKind: kind };
  }

  private describe(rng: Rng, kind: ProcKind, id: string, name: string, distKm: number): LandmarkDef {
    const base = { id, name, galaxy: null, ra: 0, dec: 0, procedural: true as const };
    const ly = (pc: number) => fmtLightYears(pc * PARSEC_KM);
    const dist = fmtLightYears(distKm);
    switch (kind) {
      case 'hii': {
        const R = rng.logRange(3, 45);
        const stars = rng.int(4, 60 + Math.round(R * 8));
        const mass = Math.round(R * R * rng.range(8, 30) / 10) * 10;
        const age = rng.range(0.5, 6);
        const variant = rng.int(0, 2);
        const absMag = -4 - 6.5 * Math.log10(R / 6) + rng.range(-0.6, 0.6);
        // a rich cluster holds the hottest O stars, whose light ionises oxygen twice over far out
        const gas: NebulaGas = { excitation: clamp01(0.05 + 0.28 * Math.log10(stars) + rng.range(-0.15, 0.15)), lowIon: rng.range(0.15, 0.9) };
        // where dust still lies beside the cluster it scatters the blue starlight (the Trifid's blue lobe)
        if (rng.chance(0.35)) gas.scatter = rng.range(0.3, 1);
        const def: LandmarkDef = {
          ...base, kind: 'nebula', radiusPc: R, absMag, color: hiiTint(gas), gas,
          summary: _('Genç yıldızların iyonize ettiği yıldız oluşum bölgesi'),
          description: [
            _('{n} sıcak O/B yıldızının morötesi ışığıyla parlayan {d} genişliğinde bir hidrojen bulutu. Kenarlarındaki karanlık toz sütunlarında hâlâ yeni yıldızlar doğuyor.', { n: stars, d: ly(R * 2) }),
            _('Bir dev moleküler bulutun yakın zamanda ateşlenmiş köşesi: en kütleli yıldızları çevrelerindeki gazı oyarak {d} çapında bir boşluk açmış. Rüzgârlarıyla sıkışan kabukta ikinci bir yıldız kuşağı oluşuyor.', { d: ly(R * 2) }),
            _('Kızıl Hα ışığı ve yeşilimsi [O III] çizgileriyle parlayan, {d} genişliğinde bir yıldız doğumevi. Merkezindeki genç küme birkaç milyon yıl içinde bulutun kalanını dağıtacak.', { d: ly(R * 2) }),
          ][variant],
          facts: { 'Uzaklık': dist, 'Çap': ly(R * 2), 'Yaş': _('~{n} milyon yıl', { n: fixed(age, 1) }), 'Kütle': `~${fmtNum(mass)} M☉`, 'Uyarıcı yıldız': `${stars}`, 'Kaynak': _('Prosedürel (keşif)') },
        };
        // the exciting cluster: real, selectable member stars (ClusterStars) sitting where the
        // nebula's primary light is, inside the cavity they have blown
        const profile = resolveNebulaProfile(def, 'hii');
        const centre = lightPositionPc(profile, 0);
        const count = Math.min(MAX_OPEN, stars * 12);
        def.cluster = { ageMyr: age, count, centrePc: [centre.x, centre.y, centre.z], radiusPc: R * profile.cavityScale * 0.6 };
        def.facts['Seçilebilen üye'] = fmtNum(count);
        return def;
      }
      case 'reflection': {
        const R = rng.logRange(0.8, 5);
        const absMag = -1.5 - 5 * Math.log10(R / 2) + rng.range(-0.5, 0.5);
        const star = weightedPick(REFLECTION_STARS, rng.next());
        const gas: NebulaGas = { excitation: star.e, lowIon: 0.5 };
        const cool = star.e < 0.3;
        return {
          ...base, kind: 'nebula', radiusPc: R, absMag, color: reflectionTint(star.e), gas,
          summary: cool ? _('Soğuk dev bir yıldızın ışığını saçan sarımsı toz bulutu') : _('Yakındaki yıldızların ışığını saçan mavi toz bulutu'),
          description: cool
            ? _('Kendi ışığı olmayan bir toz bulutu: içindeki soğuk dev yıldızın ışığını saçıyor. Toz mavi ışığı daha çok saçsa da yıldızın kendisi sarı-turuncu olduğu için bulut da sarımsı görünüyor (Antares bulutsusu gibi). {d} genişliğinde.', { d: ly(R * 2) })
            : _('Kendi ışığı olmayan bir toz bulutu: içine gömülü birkaç parlak yıldızın ışığını saçıyor, mavi ışığı daha çok saçtığı için gökyüzünün mavisi gibi görünüyor. {d} genişliğinde; yıldızları onu iyonize edecek kadar sıcak değil.', { d: ly(R * 2) }),
          facts: { 'Uzaklık': dist, 'Çap': ly(R * 2), 'Aydınlatan yıldız': star.type, 'Kaynak': _('Prosedürel (keşif)') },
        };
      }
      case 'planetary': {
        const R = rng.logRange(0.12, 0.7);
        const T = Math.round(rng.range(60, 180)) * 1000;
        const age = Math.round(R / rng.range(15, 35) * 978_000 / 1000) * 1000; // expansion age at 15–35 km/s
        const shape = rng.int(0, 2);
        const absMag = -0.8 + rng.range(-0.6, 1.6);
        // the central star's temperature sets the excitation; bipolar shells come from more massive,
        // nitrogen-enriched progenitors (Peimbert type I) and glow red in [N II]
        const gas: NebulaGas = { excitation: clamp01((T - 50_000) / 140_000 + rng.range(-0.08, 0.08)), lowIon: shape === 1 ? rng.range(0.65, 0.95) : rng.range(0.2, 0.6) };
        return {
          ...base, kind: 'planetary', radiusPc: R, absMag, color: shellTint(gas), gas,
          summary: _('Ölmekte olan bir yıldızın savurduğu parlayan kabuk'),
          description: [
            _('Güneş benzeri bir yıldızın son nefesi: dış katmanlarını saniyede onlarca kilometreyle savurmuş, ortada kalan {T} K sıcaklığındaki çıplak çekirdek bu kabuğu iyonize edip parlatıyor. Halka biçimli, {d} genişliğinde.', { T: fmtNum(T), d: ly(R * 2) }),
            _('Çift loblu (bipolar) bir gezegenimsi bulutsu: merkezdeki yıldızın (muhtemelen bir çift yıldızın) savurduğu gaz, ekvator çevresindeki yoğun bir kuşak yüzünden iki yöne fışkırmış. Beyaz cüce adayı çekirdek {T} K sıcaklığında.', { T: fmtNum(T) }),
            _('Eşmerkezli kabuklardan oluşan bir gezegenimsi bulutsu; her kabuk merkez yıldızın bir başka kütle kaybı nöbetini kaydediyor. Kızıl dış kenar [N II] ve Hα, yeşilimsi iç kısım [O III] ışığında parlıyor.'),
          ][shape],
          facts: { 'Uzaklık': dist, 'Çap': ly(R * 2), 'Merkez yıldız sıcaklığı': `${fmtNum(T)} K`, 'Genişleme yaşı': _('~{n} yıl', { n: fmtNum(age) }), 'Kaynak': _('Prosedürel (keşif)') },
        };
      }
      case 'open': {
        const R = rng.logRange(1.8, 8);
        const age = rng.logRange(5, 1500); // Myr
        const n = rng.int(40, 2500);
        const young = age < 100;
        return {
          ...base, kind: 'cluster', radiusPc: R, absMag: -(young ? 5 : 3.5) - 1.3 * Math.log10(n / 300) + rng.range(-0.5, 0.5), color: C.open[young ? 0 : age < 600 ? 1 : 2],
          summary: young ? _('Aynı buluttan doğmuş genç, mavi yıldızlar topluluğu') : _('Dağılmakta olan orta yaşlı açık küme'),
          description: young
            ? _('{n} yıldızlık, yalnızca {a} milyon yaşında bir açık küme: en parlak üyeleri hâlâ mavi-beyaz B yıldızları. Doğdukları bulutun kalıntıları kümeyi soluk bir yansıma bulutsusu olarak sarıyor.', { n: fmtNum(n), a: fixed(age, 0) })
            : _('{a} milyon yaşında, {n} üyeli açık küme. Kütleli yıldızları çoktan kırmızı dev olup tükenmiş; kalan Güneş benzeri yıldızlar galaksinin gelgit kuvvetleriyle yavaş yavaş dağılıyor.', { a: fixed(age, 0), n: fmtNum(n) }),
          facts: { 'Uzaklık': dist, 'Çap': ly(R * 2), 'Yaş': _('~{n} milyon yıl', { n: fixed(age, 0) }), 'Yıldız sayısı': `~${fmtNum(n)}`, 'Seçilebilen üye': fmtNum(Math.min(n, MAX_OPEN)), 'Kaynak': _('Prosedürel (keşif)') },
          cluster: { ageMyr: age, count: n },
        };
      }
      case 'globular': {
        const R = rng.logRange(9, 40);
        const mass = rng.logRange(5e4, 2e6);
        const age = rng.range(10.5, 13);
        const feh = -rng.range(0.6, 2.3);
        return {
          ...base, kind: 'globular', radiusPc: R, absMag: -7.2 - 2.5 * Math.log10(mass / 2e5) + rng.range(-0.3, 0.3), color: rng.pick(C.globular),
          summary: _('Galaksinin halesinde dolanan yüz binlerce yaşlı yıldızın küresi'),
          description: _('{m} Güneş kütlesinde, {a} milyar yaşında bir küresel küme: galaksinin kendisi kadar yaşlı. Demir bolluğu Güneş\'in {z} katı — ilk yıldız kuşaklarından. Çekirdeğinde yıldızlar o kadar sıkışık ki gece gökyüzünde binlerce Sirius parlar.', { m: fmtNum(Math.round(mass / 1e4) * 1e4), a: fixed(age, 1), z: fixed(Math.pow(10, feh), 3) }),
          facts: { 'Uzaklık': dist, 'Çap': ly(R * 2), 'Kütle': `~${fmtNum(Math.round(mass / 1e4) * 1e4)} M☉`, 'Yaş': _('~{n} milyar yıl', { n: fixed(age, 1) }), '[Fe/H]': fixed(feh, 2), 'Seçilebilen üye': fmtNum(Math.min(Math.round(mass / 2.5), MAX_GLOBULAR)), 'Kaynak': _('Prosedürel (keşif)') },
          cluster: { ageMyr: age * 1000, count: Math.round(mass / 2.5), feh },
        };
      }
      case 'snr': {
        const R = rng.logRange(2.5, 30);
        const v = Math.round(rng.range(200, 6000) / (R / 5) / 10) * 10;
        const age = Math.round(R * 3.086e13 / (v * 3.156e7) / 100) * 100;
        const typeIa = rng.chance(0.35);
        const absMag = -3 - 3 * Math.log10(R / 5) + rng.range(-0.6, 0.6);
        const gas = remnantGas(rng, typeIa, age, v);
        return {
          ...base, kind: 'remnant', radiusPc: R, absMag, color: remnantTint(gas), gas,
          summary: typeIa ? _('Bir beyaz cücenin termonükleer patlamasının genişleyen kabuğu') : _('Çökmüş bir dev yıldızın süpernova kalıntısı'),
          description: typeIa
            ? _('Yaklaşık {a} yıl önce bir beyaz cüce eşinden çaldığı maddeyle sınırı aşıp tümüyle patladı. Geriye yıldız kalmadı: yalnızca saniyede {v} km ile genişleyen, demir ve silisyumca zengin, {d} çapında bir kabuk.', { a: fmtNum(age), v: fmtNum(v), d: ly(R * 2) })
            : _('Yaklaşık {a} yıl önce patlayan kütleli bir yıldızın kabuğu; {d} çapına ulaştı ve hâlâ saniyede {v} km ile yıldızlararası ortama çarpıyor. Şok dalgası gazı milyonlarca dereceye ısıtıyor; merkezde bir nötron yıldızı saklanıyor olmalı.', { a: fmtNum(age), d: ly(R * 2), v: fmtNum(v) }),
          facts: { 'Uzaklık': dist, 'Çap': ly(R * 2), 'Yaş': _('~{n} yıl', { n: fmtNum(age) }), 'Genişleme hızı': `${fmtNum(v)} km/s`, 'Tür': typeIa ? 'Ia' : 'II / Ib/c', 'Kaynak': _('Prosedürel (keşif)') },
        };
      }
      case 'bubble': {
        const R = rng.logRange(1.5, 9);
        const absMag = -2.5 - 3 * Math.log10(R / 3) + rng.range(-0.5, 0.5);
        // an early, hot WN / WO star lights its bubble in [O III] and He II (Thor's Helmet); a late
        // WN star's is cooler and full of the nitrogen-rich gas it shed, red in Hα and [N II]
        const wr = rng.pick(WOLF_RAYET);
        const gas: NebulaGas = { excitation: clamp01(wr.e + rng.range(-0.1, 0.1)), lowIon: wr.n + rng.range(-0.1, 0.1) };
        return {
          ...base, kind: 'remnant', radiusPc: R, absMag, color: shellTint(gas), gas,
          summary: _('Bir Wolf–Rayet yıldızının rüzgârının şişirdiği kabarcık'),
          description: _('Merkezdeki dev yıldız dış katmanlarını saniyede binlerce kilometreyle üflüyor; bu rüzgâr daha önce savurduğu yavaş gazı önüne katıp {d} çapında parlayan bir kabarcık oluşturdu. Yıldız birkaç yüz bin yıl içinde süpernova olacak.', { d: ly(R * 2) }),
          facts: { 'Uzaklık': dist, 'Çap': ly(R * 2), 'Merkez yıldız': wr.type, 'Rüzgâr hızı': `${fmtNum(rng.int(12, 30) * 100)} km/s`, 'Kaynak': _('Prosedürel (keşif)') },
        };
      }
      case 'hypergiant': {
        const red = rng.chance(0.55);
        const T = red ? rng.range(3300, 4200) : rng.range(5500, 8500);
        const Rs = red ? rng.range(900, 1700) : rng.range(300, 700);
        const L = Rs * Rs * Math.pow(T / 5772, 4);
        const mass = rng.range(18, 40);
        return {
          ...base, kind: 'star', radiusPc: 0.05, absMag: 4.74 - 2.5 * Math.log10(L) - (red ? 1.3 : 0.1), color: red ? [1, 0.6, 0.4] : [1, 0.92, 0.75],
          summary: red ? _('Galaksinin en büyük yıldızlarından: kırmızı bir hiperdev') : _('Kararsız sarı hiperdev — bir süpernova adayı'),
          description: red
            ? _('Güneş\'in {r} katı yarıçapında bir kırmızı hiperdev: Güneş\'in yerine konsa Jüpiter\'in yörüngesini yutardı. Yılda bir Dünya kütlesinden fazla gazı tozlu bir rüzgârla kaybediyor; birkaç yüz bin yıl içinde patlayacak.', { r: fmtNum(Math.round(Rs)) })
            : _('Güneş\'in {l} katı ışınım gücünde sarı bir hiperdev. Kararsız evrede: birkaç on yılda bir dış katmanlarını fırlatıp görünür parlaklığını yüzlerce kat değiştiriyor; çevresinde bu nöbetlerin bıraktığı gaz kabukları var.', { l: fmtNum(Math.round(L / 1000) * 1000) }),
          facts: { 'Uzaklık': dist, 'Yarıçap': `${fmtNum(Math.round(Rs))} R☉`, 'Parlaklık': `${fmtNum(Math.round(L / 1000) * 1000)} L☉`, 'Kütle': `~${fixed(mass, 0)} M☉`, 'Sıcaklık': `${fmtNum(Math.round(T / 50) * 50)} K`, 'Kaynak': _('Prosedürel (keşif)') },
          star: { massSolar: mass, radiusSolar: Rs, temperature: T, luminosity: L, spectral: red ? 'M2 Ia-0' : 'F8 Ia-0' },
        };
      }
      case 'wr': {
        const T = rng.range(40_000, 110_000);
        const Rs = rng.range(2, 12);
        const L = Rs * Rs * Math.pow(T / 5772, 4);
        const mass = rng.range(10, 30);
        return {
          ...base, kind: 'star', radiusPc: 0.05, absMag: 4.74 - 2.5 * Math.log10(L) + 3.5, color: [0.7, 0.8, 1.0],
          summary: _('Zarfını yitirmiş, çıplak helyum çekirdeğiyle yanan Wolf–Rayet yıldızı'),
          description: _('Hidrojen zarfını güçlü rüzgârlarla çoktan savurmuş kütleli bir yıldız; {T} K\'lik yüzeyinden saniyede binlerce kilometreyle gaz fışkırıyor. Tayfında geniş helyum ve karbon salma çizgileri var. Son evre: önümüzdeki birkaç yüz bin yıl içinde Ib/c tipi bir süpernova ya da gama ışını patlaması.', { T: fmtNum(Math.round(T / 1000) * 1000) }),
          facts: { 'Uzaklık': dist, 'Sıcaklık': `${fmtNum(Math.round(T / 1000) * 1000)} K`, 'Parlaklık': `${fmtNum(Math.round(L / 1000) * 1000)} L☉`, 'Kütle': `~${fixed(mass, 0)} M☉`, 'Kütle kaybı': `10⁻⁵ M☉/yıl`, 'Kaynak': _('Prosedürel (keşif)') },
          star: { massSolar: mass, radiusSolar: Rs, temperature: T, luminosity: L, spectral: rng.pick(['WN5', 'WN7', 'WC8', 'WO3']) },
        };
      }
      case 'magnetar': {
        const periodMs = rng.range(2000, 12_000);
        const B = rng.range(1, 8);
        return {
          ...base, kind: 'pulsar', radiusPc: 0.05, absMag: 5, color: [1.0, 0.6, 0.8],
          summary: _('Evrenin en güçlü mıknatısı: bir magnetar'),
          description: _('Yüzey manyetik alanı {B} × 10¹⁴ gauss olan genç bir nötron yıldızı — Dünya\'nınkinin katrilyon katı. Kabuğu alanın gerilimiyle kırıldıkça dev X-ışını patlamaları saçıyor; {p} saniyelik ağır dönüşü alanın onu hızla frenlediğini gösteriyor.', { B: fixed(B, 1), p: fixed(periodMs / 1000, 2) }),
          facts: { 'Uzaklık': dist, 'Periyot': `${fixed(periodMs / 1000, 2)} s`, 'Manyetik alan': `${fixed(B, 1)} × 10¹⁴ G`, 'Yaş': _('~{n} yıl', { n: fmtNum(rng.int(2, 30) * 1000) }), 'Kaynak': _('Prosedürel (keşif)') },
          pulsar: { periodMs, massSolar: 1.4, radiusKm: 12, temperature: 4e6, pole: { ra: rng.range(0, 360), dec: rng.range(-90, 90) }, magneticTilt: rng.range(20, 80), beamHalfAngle: rng.range(8, 16), beamLength: 40, beamColor: [1.0, 0.55, 0.75] },
        };
      }
    }
  }

  static isProc(id: string): boolean { return id.startsWith('q'); }

  /** Rebuild one object from its id (returns null for malformed ids or empty cells). */
  derive(id: string): ProcLandmark | null {
    const m = /^q(g?)(\d+):(-?\d+):(-?\d+):(-?\d+):(\d+)$/.exec(id);
    if (!m) return null;
    const g = +m[2], i = +m[3], j = +m[4], k = +m[5];
    if (g >= this.galaxies.count) return null;
    const out: ProcLandmark[] = [];
    if (m[1]) this.generateGlobularCell(this.galaxies.model(g), g, i, j, k, out);
    else this.generateCell(this.galaxies.model(g), g, i, j, k, out);
    return out.find((o) => o.def.id === id) ?? null;
  }
}

function gauss(rng: Rng): number {
  return Math.sqrt(-2 * Math.log(Math.max(rng.next(), 1e-9))) * Math.cos(2 * Math.PI * rng.next());
}
