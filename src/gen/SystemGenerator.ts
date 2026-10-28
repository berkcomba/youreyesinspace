import { AU_KM, DAY_S, DEG, G, J2000_JD, PARSEC_KM } from '../core/constants';
import { fmtDistance, fmtLightYears } from '../ui/format';
import type { StarInfo } from '../data/StarCatalog';
import type { Activity, Appearance, Atmosphere, BodyData, Clouds, PoleRaDec, Rings, SimpleElements } from '../data/types';
import { LUM_CLASS_DESC, SUN_MASS_KG, SUN_RADIUS_KM } from '../astro/stellar';
import { companionPhysics, isPair, knownMultiple, multiplicityTree, pTypeLimit, sTypeLimit, semiMajorAU, type CompKind, type CompanionPhysics, type CompanionSpec, type NodeSpec, type PairSpec } from './Multiplicity';
import { _, fixed, localeTag } from '../i18n';

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
  /** body the belt circles (a star or a pair's barycentre); the primary star when absent */
  centerId?: string;
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

type PlanetClass = 'lava' | 'venusian' | 'temperate' | 'ocean' | 'eyeball' | 'carbon' | 'desert' | 'ice' | 'barren' | 'gasgiant' | 'icegiant' | 'hotjupiter';

const CLASS_LABEL: Record<PlanetClass, string> = {
  lava: 'Lav gezegeni', venusian: 'Venüs benzeri (sera)', temperate: 'Ilıman (okyanuslu)', ocean: 'Okyanus dünyası',
  eyeball: 'Göz küresi gezegeni (gelgit kilitli)', carbon: 'Karbon gezegeni', desert: 'Soğuk çöl gezegeni',
  ice: 'Buz dünyası', barren: 'Çorak kaya', gasgiant: 'Gaz devi', icegiant: 'Buz devi', hotjupiter: 'Sıcak Jüpiter',
};

/** Extra flavour sentence per class (shown after the standard description) */
const CLASS_NOTE: Partial<Record<PlanetClass, string>> = {
  ocean: 'Yüzeyin tamamı yüzlerce kilometre derinlikte bir okyanusla kaplı; kara yok, tabanda yüksek basınç buzu.',
  eyeball: 'Yıldıza hep aynı yüzünü dönüyor: gündüz yarıküresinin ortasında sıvı bir okyanus "göz bebeği", çevresinde ve gece tarafında kalıcı buz.',
  carbon: 'Oksijenden çok karbon içeren bir diskten doğdu: grafit ve karbür kabuk, katran rengi okyanuslar; derinlerde elmas tabakaları.',
  hotjupiter: 'Yıldızına çok yakın; atmosferi kavrulup uzaya kaçıyor, gece tarafına rüzgârlar binlerce km/s hızla ısı taşıyor.',
};

/* ------------------------------------------------------------------ */
/*  Generator                                                          */
/* ------------------------------------------------------------------ */

export interface GenerateOptions {
  /** no procedural stellar companions: a hand-made companion exists, or a catalogue neighbour already is the companion */
  single?: boolean;
  /** outer limit for planets (AU) when a catalogue neighbour truncates the system (α Cen A/B …) */
  maxPlanetAU?: number;
}

/** Something planets can orbit: a star, or the barycentre of a close pair (circumbinary) */
interface Host {
  /** parent body id for the planets */
  id: string;
  /** planet name stem: "Vega", "Sirius A", "Kepler-16 (AB)" */
  name: string;
  /** id fragment: '', 'A', 'AB' */
  tag: string;
  massSolar: number;
  gm: number;
  /** total luminosity lighting the planets (solar units) */
  luminosity: number;
  temperature: number;
  evolved: boolean;
  compact: boolean;
  /** radius of the (largest) star, AU */
  radiusAU: number;
  /** dynamically allowed range for planets (AU) */
  aMinAU: number;
  aMaxAU: number;
  /** planet-occurrence multiplier relative to a single star */
  occurrence: number;
  /** the system's main host (gets the comets) */
  primary: boolean;
}

export function generateSystem(star: StarInfo, opts: GenerateOptions = {}): GeneratedSystem {
  const rng = new Rng(hashSeed(star.index, star.hip, 0x5eed));
  const sysId = `s${star.index}`;
  const starId = `${sysId}-star`;
  const bodies: BodyData[] = [];
  const belts: GeneratedBelt[] = [];
  const planetIds: string[] = [];

  /* ---- primary star ---- */
  const isGiant = star.lumClass <= 3 && !star.isWhiteDwarf;
  const rotHours = star.isWhiteDwarf ? rng.range(2, 30) : isGiant ? rng.range(2000, 12_000) : rng.range(150, 1200) / Math.max(0.3, star.massSolar);
  const primary: BodyData = {
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
  };
  bodies.push(primary);

  /* ---- companions: the multiplicity tree, emitted as barycentres + stars ---- */
  const tree = multiplicityTree(new Rng(hashSeed(star.index, star.hip, 0xb1a)), star, opts.single);
  const hosts = emitHierarchy(rng, star, tree, sysId, primary, bodies, opts.maxPlanetAU);

  /* ---- planets, belts, small bodies around every host ---- */
  for (const host of hosts) populateHost(rng, star, host, sysId, bodies, belts, planetIds);

  return { id: sysId, bodies, belts, planetIds };
}

/* ------------------------------------------------------------------ */
/*  Multiple stars                                                     */
/* ------------------------------------------------------------------ */

const KIND_LABEL: Record<CompKind, string> = {
  ms: 'Anakol yıldızı', giant: 'Dev yıldız', wd: 'Beyaz cüce', bd: 'Kahverengi cüce', ns: 'Nötron yıldızı', bh: 'Kara delik', wr: 'Wolf-Rayet yıldızı',
};

const KIND_NOTE: Record<CompKind, string> = {
  ms: 'Ana yıldızla aynı buluttan, aynı anda doğdu; daha az kütleli olduğu için anakolda ondan çok daha uzun kalacak.',
  giant: 'Çekirdeğindeki hidrojeni tüketmiş, şişmiş ve soğumuş bir yıldız.',
  wd: 'Bir zamanlar çiftin daha kütleli üyesiydi; önce o evrimleşti, dış katmanlarını yitirdi ve geriye Dünya boyutunda, bir ton/cm³ yoğunlukta sönmekte olan çekirdeği kaldı.',
  bd: 'Hidrojen füzyonunu tutuşturamayacak kadar hafif (< 0,075 M☉); doğumundan kalan ısıyla kızılötesinde soluk soluk parlar, Jüpiter boyutundadır.',
  ns: 'Daha kütleli doğan yoldaşın süpernova artığı: şehir boyutunda, Güneş kütlesinden ağır bir nötron yıldızı. Ana yıldızın rüzgârını yutarak X-ışını saçar.',
  bh: 'Çiftin bir zamanlar çok daha kütleli olan üyesi çöktü: geriye birkaç on kilometrelik olay ufkuyla yıldız kütleli bir kara delik kaldı. Yoldaşın rüzgârından madde toplarsa X-ışınında parlar; toplamazsa yalnızca yıldızın sallanan yörüngesinden fark edilir.',
  wr: 'Güçlü rüzgârlarıyla dış katmanlarını atmış, çıplak helyum çekirdeği görünen çok sıcak bir yıldız.',
};

interface RLeaf { kind: 'leaf'; spec: 'primary' | CompanionSpec; label: string; id: string; mass: number; lum: number; radiusKm: number; temperature: number; phys: CompanionPhysics | null }
interface RPair { kind: 'pair'; spec: PairSpec; a: RNode; b: RNode; label: string; id: string; mass: number; lum: number; radiusKm: number; aAU: number }
type RNode = RLeaf | RPair;

/** Resolve masses / physics and assign the Washington-style labels (A, B, … leaves; AB, CD pairs) */
function resolveTree(node: NodeSpec, star: StarInfo, rng: Rng, sysId: string, primary: BodyData, counter: { n: number }, root: boolean): RNode {
  if (isPair(node)) {
    const a = resolveTree(node.pair[0], star, rng, sysId, primary, counter, false);
    const b = resolveTree(node.pair[1], star, rng, sysId, primary, counter, false);
    const label = a.label + b.label;
    const mass = a.mass + b.mass;
    return { kind: 'pair', spec: node, a, b, label, id: root ? `${sysId}-bary` : `${sysId}-bary${label}`, mass, lum: a.lum + b.lum, radiusKm: Math.max(a.radiusKm, b.radiusKm), aAU: semiMajorAU(node.periodDays, mass) };
  }
  const label = String.fromCharCode(65 + counter.n++);
  if (node === 'primary') return { kind: 'leaf', spec: node, label, id: primary.id, mass: star.massSolar, lum: star.luminosity, radiusKm: star.radiusKm, temperature: star.temperature, phys: null };
  const phys = companionPhysics(node, rng);
  return { kind: 'leaf', spec: node, label, id: `${sysId}-star${label}`, mass: phys.massSolar, lum: phys.luminosity, radiusKm: phys.radiusKm, temperature: phys.temperature, phys };
}

function jitterPole(rng: Rng, pole: PoleRaDec, sigmaDeg: number): PoleRaDec {
  const dec = Math.max(-89, Math.min(89, pole.dec + gauss(rng) * sigmaDeg));
  return { ra: (pole.ra + (gauss(rng) * sigmaDeg) / Math.max(0.2, Math.cos(dec * DEG)) + 360) % 360, dec };
}

function fmtPeriod(days: number): string {
  if (days < 2) return _('{n} saat', { n: fixed(days * 24, 1) });
  if (days < 1000) return _('{n} gün', { n: fixed(days, days < 20 ? 2 : 1) });
  const y = days / 365.25;
  return _('{n} yıl', { n: y < 100 ? fixed(y, 1) : fixed(y, 0) });
}

function fmtAU(a: number): string {
  return a < 0.1 ? `${fixed(a, 3)} AU` : a < 10 ? `${fixed(a, 2)} AU` : `${fixed(a, 0)} AU`;
}

/**
 * Turn the multiplicity tree into bodies (barycentres with the components on their orbits) and
 * list the places planets may orbit, with their Holman & Wiegert stability limits.
 */
function emitHierarchy(rng: Rng, star: StarInfo, tree: NodeSpec, sysId: string, primary: BodyData, bodies: BodyData[], maxPlanetAU?: number): Host[] {
  const hosts: Host[] = [];
  const starRadiusAU = star.radiusKm / AU_KM;
  const evolved = star.lumClass <= 3 && !star.isWhiteDwarf;
  if (!isPair(tree)) {
    hosts.push({
      id: primary.id, name: star.name, tag: '', massSolar: star.massSolar, gm: (G * star.massKg) / 1e9, luminosity: star.luminosity,
      temperature: star.temperature, evolved, compact: star.isWhiteDwarf, radiusAU: starRadiusAU, aMinAU: starRadiusAU * 5,
      aMaxAU: Math.min(70 * Math.sqrt(Math.max(star.luminosity, 1e-5)), maxPlanetAU ?? Infinity),
      occurrence: maxPlanetAU !== undefined && maxPlanetAU < 20 ? 0.4 : 1, primary: true,
    });
    return hosts;
  }

  const root = resolveTree(tree, star, rng, sysId, primary, { n: 0 }, true) as RPair;
  const known = knownMultiple(star) !== null;
  const leaves: RLeaf[] = [];
  const pairs: RPair[] = [];
  const collect = (n: RNode) => { if (n.kind === 'leaf') leaves.push(n); else { pairs.push(n); collect(n.a); collect(n.b); } };
  collect(root);
  const order = leaves.length === 2 ? 'İkili sistem' : leaves.length === 3 ? 'Üçlü sistem' : leaves.length === 4 ? 'Dörtlü sistem' : 'Çoklu sistem';
  const hierarchy = pairs.map((p) => `${p.a.label}–${p.b.label}`).join(', ');
  const source = known ? 'Gözlem (literatür)' : 'Prosedürel (tahmini)';

  // the primary is now "Name A" (or whichever component it is)
  const primaryLeaf = leaves.find((l) => l.spec === 'primary')!;
  primary.name = `${star.name} ${primaryLeaf.label}`;
  const pf = primary.facts!;
  pf['Çokluluk'] = `${_(order)} (${hierarchy})`;
  for (const l of leaves) {
    if (!l.phys) continue;
    const pr = pairs.find((p) => p.a === l || p.b === l)!;
    pf[`Yoldaş ${l.label}`] = `${l.phys.spectral} · ${fixed(l.mass, l.mass < 0.1 ? 3 : 2)} M☉ · ${fmtPeriod(pr.spec.periodDays)}, ${fmtAU(pr.aAU)}, e = ${fixed(pr.spec.e, 2)}`;
  }
  primary.description += ' ' + _('{order}: {n} yıldızdan oluşur; bileşenler ortak kütle merkezleri etrafında dolanır.', { order: _(order), n: leaves.length });

  const emit = (node: RNode, parent: RPair | null, parentPole: PoleRaDec, first: boolean, argPeri: number, M0: number, outerLimitAU: number | null): void => {
    // orbit of this node around the parent barycentre (the pair's relative orbit scaled by the partner's mass share)
    let orbit: SimpleElements | undefined;
    let pole: PoleRaDec;
    if (parent) {
      const partner = first ? parent.b : parent.a;
      const aKm = (parent.aAU * AU_KM * partner.mass) / parent.mass;
      orbit = { kind: 'simple', a: aKm, e: parent.spec.e, i: Math.abs(gauss(rng)) * 0.3, node: 0, argPeri: (argPeri + (first ? 180 : 0)) % 360, M0, epoch: J2000_JD, period: parent.spec.periodDays, frame: 'parentEquator' };
      // spin–orbit alignment for close pairs; wide companions spin any which way
      pole = parent.aAU < 50 ? jitterPole(rng, parentPole, node.kind === 'pair' ? 12 : 6) : { ra: rng.range(0, 360), dec: rng.range(-90, 90) };
    } else {
      pole = { ra: rng.range(0, 360), dec: rng.range(-90, 90) };
    }

    if (node.kind === 'leaf') {
      const sLimit = parent ? parent.aAU * sTypeLimit(parent.spec.e, (first ? parent.b : parent.a).mass / parent.mass) : Infinity;
      const kind: CompKind = node.phys?.kind ?? (star.isWhiteDwarf ? 'wd' : evolved ? 'giant' : 'ms');
      const kindFactor = kind === 'wd' ? 0.15 : kind === 'bd' ? 0.3 : kind === 'ns' ? 0.05 : kind === 'bh' ? 0 : 1;
      const rAU = node.radiusKm / AU_KM;
      // a white dwarf's inner few AU were inside its red-giant envelope: nothing survives there
      const aMin = kind === 'wd' ? Math.max(rAU * 5, 2) : rAU * 5;
      const aMax = Math.min(70 * Math.sqrt(Math.max(node.lum, 1e-5)), sLimit);
      if (node.spec === 'primary') {
        primary.parent = parent!.id;
        primary.orbit = orbit;
        primary.pole = pole;
      } else {
        const ph = node.phys!;
        const pr = parent!;
        const rSolar = ph.radiusKm / SUN_RADIUS_KM;
        const facts: Record<string, string> = {
          'Sınıf': KIND_LABEL[ph.kind], 'Spektral sınıf': ph.spectral, 'Kütle': `${fixed(ph.massSolar, ph.massSolar < 0.1 ? 3 : 2)} M☉`,
          'Yarıçap': ph.radiusKm < 100 ? `${fixed(ph.radiusKm, 0)} km` : `${fixed(rSolar, rSolar < 0.1 ? 4 : 2)} R☉`,
          'Parlaklık': `${fmtLum(ph.luminosity)} L☉`, 'Yörünge periyodu': fmtPeriod(pr.spec.periodDays), 'Ayrıklık (a)': fmtAU(pr.aAU), 'Dış merkezlilik': fixed(pr.spec.e, 3),
          'Kaynak': pr.spec.uncertain ? `${_(source)}; ${_('yörünge belirsiz')}` : source,
        };
        const spec = node.spec as CompanionSpec;
        const desc = `${_('{name} sisteminin {label} bileşeni', { name: star.name, label: node.label })}: ${_(KIND_LABEL[ph.kind]).toLocaleLowerCase(localeTag())}, ${ph.spectral}. ${spec.note ? `${_(spec.note)}. ` : ''}${_(KIND_NOTE[ph.kind])}`;
        const isNS = ph.kind === 'ns', isBH = ph.kind === 'bh';
        // an accreting compact companion (X-ray binary) needs a close orbit; wide ones are dormant
        const accreting = (isNS || isBH) && pr.aAU < 0.5;
        if (isBH) {
          facts['Olay ufku'] = `${fixed(ph.radiusKm, 0)} km`;
          facts['Durum'] = accreting ? _('X-ışını çifti (madde topluyor)') : _('Sessiz (madde toplamıyor)');
          delete facts['Yarıçap']; delete facts['Parlaklık']; delete facts['Spektral sınıf'];
        }
        bodies.push({
          id: node.id, name: `${star.name} ${node.label}`, type: isNS ? 'pulsar' : isBH ? 'blackhole' : 'star', parent: pr.id,
          radius: ph.radiusKm, mass: ph.massSolar * SUN_MASS_KG,
          rotationPeriod: isNS ? rng.logRange(0.002, 2) / 3600 : isBH ? 24 : ph.kind === 'wd' ? rng.range(2, 30) : ph.kind === 'bd' ? rng.range(2, 12) : ph.kind === 'giant' ? rng.range(2000, 12_000) : rng.range(150, 1200) / Math.max(0.3, ph.massSolar),
          pole, orbit,
          appearance: isNS
            ? { kind: 'pulsar', seed: hashSeed(star.index, node.label.charCodeAt(0)) % 991 + 3, magneticTilt: rng.range(20, 80), beamHalfAngle: rng.range(6, 14), beamLength: 40, beamColor: [0.55, 0.85, 1.0], quiet: rng.chance(0.5) }
            : isBH
              ? { kind: 'blackhole', seed: hashSeed(star.index, node.label.charCodeAt(0)) % 991 + 3, disk: accreting ? { inner: 3, outer: rng.range(10, 20), temperature: rng.range(8000, 30_000), brightness: rng.range(0.5, 1.4) } : { inner: 3, outer: 8, temperature: 3000, brightness: 0 }, diskAbsMag: accreting ? rng.range(-1, 2) : 20 }
              : { kind: 'star', temperature: ph.temperature, seed: hashSeed(star.index, node.label.charCodeAt(0)) % 997 + 3 },
          temperature: isBH ? undefined : ph.temperature, description: desc, facts,
        });
      }
      hosts.push({
        id: node.id, name: `${star.name} ${node.label}`, tag: node.label, massSolar: node.mass, gm: (G * node.mass * SUN_MASS_KG) / 1e9, luminosity: node.lum,
        temperature: node.temperature, evolved: node.spec === 'primary' ? evolved : kind === 'giant', compact: kind === 'wd' || kind === 'ns' || kind === 'bd' || kind === 'bh',
        radiusAU: rAU, aMinAU: aMin, aMaxAU: aMax,
        // planets are rarer in close binaries (Kraus et al. 2016: about a third of the single-star rate inside ~50 AU)
        occurrence: (aMax < 20 ? 0.4 : 1) * kindFactor * (aMax > aMin * 1.5 ? 1 : 0), primary: false,
      });
      return;
    }

    // a pair: its barycentre, then the two members
    const mu = Math.min(node.a.mass, node.b.mass) / node.mass;
    const pMin = node.aAU * pTypeLimit(node.spec.e, mu);
    const pMax = outerLimitAU ?? 70 * Math.sqrt(Math.max(node.lum, 1e-5));
    bodies.push({
      id: node.id, name: parent ? `${star.name} ${node.label}` : star.name, type: 'barycenter', parent: parent?.id, radius: 0, mass: node.mass * SUN_MASS_KG,
      pole, orbit, appearance: { kind: 'none', seed: 0 },
      description: _('{a} ve {b} bileşenlerinin ortak kütle merkezi: ikisi de bu noktanın etrafında {p} periyotla dolanır (ayrıklık {au}, e = {e}).', { a: node.a.label, b: node.b.label, p: fmtPeriod(node.spec.periodDays), au: fmtAU(node.aAU), e: fixed(node.spec.e, 2) }),
      facts: { 'Bileşenler': `${node.a.label} + ${node.b.label}`, 'Periyot': fmtPeriod(node.spec.periodDays), 'Ayrıklık (a)': fmtAU(node.aAU), 'Dış merkezlilik': fixed(node.spec.e, 3), 'Toplam kütle': `${fixed(node.mass, 2)} M☉`, 'Kaynak': source },
    });
    if (pMax > pMin * 1.6) {
      // circumbinary planets: common around tight pairs (Kepler-16, -34, -35 …), rare around wide ones
      const tA = node.a.kind === 'leaf' ? node.a.temperature : 0, tB = node.b.kind === 'leaf' ? node.b.temperature : 0;
      hosts.push({
        id: node.id, name: `${star.name} (${node.label})`, tag: node.label, massSolar: node.mass, gm: (G * node.mass * SUN_MASS_KG) / 1e9, luminosity: node.lum,
        temperature: Math.max(tA, tB) || star.temperature, evolved: false, compact: false,
        radiusAU: node.radiusKm / AU_KM, aMinAU: pMin, aMaxAU: pMax,
        occurrence: node.aAU < 1 ? 0.5 : node.aAU < 10 ? 0.15 : 0.08, primary: !parent,
      });
    }
    const w = rng.range(0, 360), m0 = rng.range(0, 360);
    const limitA = node.aAU * sTypeLimit(node.spec.e, node.b.mass / node.mass);
    const limitB = node.aAU * sTypeLimit(node.spec.e, node.a.mass / node.mass);
    emit(node.a, node, pole, true, w, m0, limitA);
    emit(node.b, node, pole, false, w, m0, limitB);
  };
  emit(root, null, { ra: 0, dec: 90 }, true, 0, 0, null);
  // the comets live with the primary star when there is no circumbinary host
  if (!hosts.some((h) => h.primary)) { const h = hosts.find((x) => x.id === primary.id); if (h) h.primary = true; }
  return hosts;
}

/* ------------------------------------------------------------------ */
/*  Planetary systems                                                  */
/* ------------------------------------------------------------------ */

function populateHost(rng: Rng, star: StarInfo, host: Host, sysId: string, bodies: BodyData[], belts: GeneratedBelt[], planetIds: string[]): void {
  const sqrtL = Math.sqrt(Math.max(host.luminosity, 1e-5));
  const frostAU = 2.7 * sqrtL;
  const gmStar = host.gm;
  const idStem = host.tag ? `${sysId}-${host.tag}` : sysId;

  /* ---- how many planets ---- */
  let nPlanets: number;
  const roll = rng.next();
  if (host.compact || host.temperature > 25_000) nPlanets = rng.chance(0.6) ? 0 : rng.int(1, 2);
  else if (host.evolved) nPlanets = rng.chance(0.4) ? 0 : rng.int(1, 4);
  else if (roll < 0.08) nPlanets = 0;
  else if (roll < 0.40) nPlanets = rng.int(1, 3);
  else if (roll < 0.78) nPlanets = rng.int(4, 6);
  else nPlanets = rng.int(7, 9);
  if (host.occurrence <= 0) nPlanets = 0;
  else if (host.occurrence < 1 && !rng.chance(host.occurrence)) nPlanets = Math.min(nPlanets, rng.int(0, 1));

  /* ---- orbital ladder ---- */
  let a = Math.max((0.035 + 0.3 * Math.pow(rng.next(), 1.6)) * sqrtL, host.radiusAU * 5, host.aMinAU);
  const aMax = Math.min(70 * sqrtL, host.aMaxAU);
  const planets: Array<{ id: string; aAU: number; cls: PlanetClass; data: BodyData }> = [];
  for (let k = 0; k < nPlanets && a < aMax; k++) {
    const id = `${idStem}-p${k}`;
    const name = `${host.name} ${LETTERS[k]}`;
    const res = makePlanet(rng, host, id, name, host.id, a, frostAU, gmStar, bodies);
    planets.push({ id, aAU: a, cls: res.cls, data: res.data });
    planetIds.push(id);
    a *= rng.range(1.4, 2.15);
  }

  /* ---- belts ---- */
  const seedBase = hashSeed(star.index, host.tag.length ? host.tag.charCodeAt(0) * 31 + host.tag.length : 7);
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
        color: rng.tint([0.72, 0.68, 0.6], 0.06), opacity: 0.75, seed: hashSeed(seedBase, 77), centerId: host.id,
      });
    }
  }
  let outerBelt: GeneratedBelt | null = null;
  if (planets.length && rng.chance(0.5)) {
    const last = planets[planets.length - 1].aAU;
    if (last * 1.5 < aMax) {
      outerBelt = {
        name: 'Dış kuşak', count: 12_000, aMin: last * 1.5, aMax: Math.min(last * 2.4, aMax), eMax: 0.2, iSigmaDeg: rng.range(4, 12),
        color: rng.tint([0.55, 0.62, 0.8], 0.06), opacity: 0.6, seed: hashSeed(seedBase, 78), centerId: host.id,
      };
      belts.push(outerBelt);
    }
  }

  /* ---- Trojan clouds of the most massive giant ---- */
  const giants = planets.filter((p) => p.cls === 'gasgiant');
  if (giants.length && rng.chance(0.45)) {
    const g = giants.reduce((a, b) => (a.data.mass > b.data.mass ? a : b));
    const o = g.data.orbit as SimpleElements;
    const L0 = o.node + o.argPeri + o.M0;
    for (const side of [60, -60]) {
      belts.push({
        name: side > 0 ? 'Truva kampı (L4)' : 'Truva kampı (L5)', count: 2500, aMin: g.aAU * 0.985, aMax: g.aAU * 1.015, eMax: 0.12, iSigmaDeg: rng.range(6, 18),
        color: rng.tint([0.6, 0.55, 0.5], 0.05), opacity: 0.7, seed: hashSeed(seedBase, side > 0 ? 81 : 82), trojan: { aAU: g.aAU, meanLongitudeDeg: L0 + side }, centerId: host.id,
      });
    }
  }

  /* ---- dwarf planets in the outer belt (Pluto-like, sometimes with a big moon) ---- */
  if (outerBelt) {
    const n = rng.int(0, 3);
    for (let k = 0; k < n; k++) {
      const id = `${idStem}-d${k}`;
      const aAU = rng.range(outerBelt.aMin, outerBelt.aMax);
      const radius = rng.logRange(400, 1400);
      const mass = (4 / 3) * Math.PI * Math.pow(radius * 1000, 3) * rng.range(1600, 2400);
      const T = equilibriumT(host.luminosity, aAU, 0.6);
      const seed = hashSeed(seedBase, 0xd0 + k) % 10_000;
      const reddish = rng.chance(0.5);
      const data: BodyData = {
        id, name: `${host.name} ${LETTERS[planets.length + k] ?? `d${k + 1}`}`, type: 'dwarf', parent: host.id, radius, mass, albedo: rng.range(0.4, 0.8),
        rotationPeriod: rng.range(6, 200) * (rng.chance(0.3) ? -1 : 1), tilt: rng.range(0, 120),
        orbit: orbit(rng, aAU * AU_KM, gmStar, 0.3, outerBelt.iSigmaDeg * 1.5, 'parentEquator'),
        appearance: reddish
          ? { kind: 'terrestrial', seed, landLow: rng.tint([0.35, 0.2, 0.12]), landMid: rng.tint([0.6, 0.42, 0.3]), landHigh: rng.tint([0.9, 0.88, 0.85]), ice: [0.95, 0.95, 0.98], iceCaps: rng.range(0.5, 0.8), craters: rng.range(0.3, 0.7), roughness: 0.9, variation: 0.7 }
          : { kind: 'terrestrial', seed, landLow: rng.tint([0.55, 0.58, 0.62]), landMid: rng.tint([0.8, 0.82, 0.86]), landHigh: [0.97, 0.98, 1.0], ice: [0.97, 0.98, 1.0], iceCaps: rng.range(0.3, 0.6), craters: rng.range(0.4, 0.9), roughness: 0.9, variation: 0.5 },
        atmosphere: T > 35 && rng.chance(0.4) ? { color: [0.55, 0.65, 0.95], height: 0.05, density: 0.08 } : undefined,
        temperature: T,
        description: `${_('Cüce gezegen')}. ${_('Dış kuşağın içinde dolanan, {r} km yarıçaplı buzlu bir dünya', { r: fixed(radius, 0) })}; ${describeTemp(T)}. ${reddish ? _('Yüzeyini kozmik ışınların kızıllaştırdığı tholin örtüyor.') : _('Parlak, taze buzla kaplı.')}`,
        facts: { 'Sınıf': 'Cüce gezegen', 'Kaynak': 'Prosedürel (tahmini)' },
      };
      bodies.push(data);
      if (rng.chance(0.5)) makeMoons(rng, data, true, 1, bodies, 'rocky');
    }
  }

  /* ---- comets: a few on long, eccentric orbits (their tails switch on near perihelion) ---- */
  if (!host.primary) return;
  const nComets = rng.chance(0.75) ? rng.int(1, 3) : 0;
  for (let k = 0; k < nComets; k++) {
    const id = `${idStem}-c${k}`;
    const q = Math.max(rng.logRange(0.25, 1.6) * sqrtL, host.aMinAU * 1.1);   // perihelion (AU)
    const Q = rng.logRange(Math.max(4, q * 4), Math.max(60, q * 8)) * sqrtL;   // aphelion (AU)
    const aC = (q + Q) / 2, e = (Q - q) / (Q + q);
    const aKm = aC * AU_KM;
    const period = (2 * Math.PI * Math.sqrt((aKm * aKm * aKm) / gmStar)) / DAY_S;
    const retro = rng.chance(0.3);
    const radius = rng.logRange(1, 12);
    const seed = hashSeed(seedBase, 0xc0 + k) % 10_000;
    bodies.push({
      id, name: `${LETTERS[k].toUpperCase()}/${star.name}`, type: 'comet', parent: host.id, radius, mass: (4 / 3) * Math.PI * Math.pow(radius * 1000, 3) * 500,
      albedo: 0.04, rotationPeriod: rng.range(6, 60), tilt: rng.range(0, 180),
      orbit: {
        kind: 'simple', a: aKm, e, i: retro ? rng.range(120, 170) : Math.abs(gauss(rng)) * 25, node: rng.range(0, 360), argPeri: rng.range(0, 360),
        M0: rng.range(0, 360), epoch: J2000_JD, period, frame: 'parentEquator',
      },
      appearance: { kind: 'terrestrial', seed, landLow: [0.05, 0.05, 0.05], landMid: [0.12, 0.11, 0.1], landHigh: [0.25, 0.24, 0.22], craters: 0.6, roughness: 2.5, variation: 0.4 },
      description: `${_('Kuyruklu yıldız')}. ${_('Günberi {q} AU, günöte {Q} AU; periyodu {p} yıl', { q: fixed(q, 2), Q: fixed(Q, 1), p: fixed(period / 365.25, 1) })}${retro ? `; ${_('retrograd yörünge')}` : ''}. ${_('Yıldızına yaklaştıkça buzları süblimleşir, toz ve iyon kuyrukları açılır.')}`,
      facts: { 'Sınıf': 'Kuyruklu yıldız', 'Kaynak': 'Prosedürel (tahmini)' },
    });
  }
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

/** Equilibrium temperature at aAU from a source of luminosity L (solar units): 278 K · ((1−A)·L)^¼ / √a */
function equilibriumT(luminosity: number, aAU: number, albedo: number): number {
  return 278.3 * Math.pow((1 - albedo) * Math.max(luminosity, 1e-9), 0.25) / Math.sqrt(aAU);
}

function makePlanet(
  rng: Rng, host: Host, id: string, name: string, parent: string, aAU: number, frostAU: number, gmStar: number,
  bodies: BodyData[],
): { cls: PlanetClass; data: BodyData } {
  const beyondFrost = aAU > frostAU;
  let cls: PlanetClass;
  const r = rng.next();
  if (!beyondFrost) {
    if (aAU < 0.12 * Math.sqrt(host.luminosity) && r < 0.10) cls = 'hotjupiter';
    else cls = 'barren'; // refined by temperature below
  } else {
    cls = r < 0.5 ? 'gasgiant' : r < 0.8 ? 'icegiant' : 'ice';
  }

  const aKm = aAU * AU_KM;
  const tidallyLocked = aAU < 0.09 * Math.sqrt(host.massSolar);
  const tilt = rng.chance(0.08) ? rng.range(60, 120) : Math.abs(gauss(rng)) * 14;
  let data: BodyData;

  if (cls === 'gasgiant' || cls === 'hotjupiter') {
    const massJ = rng.logRange(0.25, 8);
    const radius = JUPITER_RADIUS * Math.min(1.35, Math.max(0.65, Math.pow(massJ, 0.12))) * (cls === 'hotjupiter' ? 1.25 : 1);
    const albedo = cls === 'hotjupiter' ? rng.range(0.05, 0.2) : rng.range(0.35, 0.55);
    const T = equilibriumT(host.luminosity, aAU, albedo);
    const flattening = rng.range(0.03, 0.09);
    const rotation = rng.range(8, 16);
    const rings = cls === 'gasgiant' && rng.chance(0.4) ? makeRings(rng, radius) : undefined;
    data = {
      id, name, type: 'planet', parent, radius, flattening, mass: massJ * JUPITER_MASS, albedo, rotationPeriod: rotation,
      tilt, orbit: orbit(rng, aKm, gmStar, cls === 'hotjupiter' ? 0.05 : 0.09, 2.5, 'parentEquator'),
      appearance: gasAppearance(rng, T, false, id),
      atmosphere: { color: T > 600 ? [0.6, 0.55, 0.7] : T > 130 ? rng.tint([0.95, 0.88, 0.75]) : rng.tint([0.7, 0.85, 1.0]), height: 0.012, density: 0.45 },
      rings, temperature: T,
      description: `${_(CLASS_LABEL[cls])}. ${_('{m} Jüpiter kütlesinde', { m: fixed(massJ, 2) })}; ${describeTemp(T)}.${CLASS_NOTE[cls] ? ` ${_(CLASS_NOTE[cls]!)}` : ''}`,
      facts: { 'Sınıf': CLASS_LABEL[cls], 'Kaynak': 'Prosedürel (tahmini)' },
    };
    bodies.push(data);
    makeMoons(rng, data, beyondFrost, rng.int(2, 6), bodies, 'giant');
  } else if (cls === 'icegiant') {
    const massE = rng.logRange(6, 30);
    const radius = 24_622 * Math.pow(massE / 17, 0.4);
    const albedo = rng.range(0.28, 0.42);
    const T = equilibriumT(host.luminosity, aAU, albedo);
    data = {
      id, name, type: 'planet', parent, radius, flattening: rng.range(0.015, 0.03), mass: massE * EARTH_MASS, albedo,
      rotationPeriod: rng.range(12, 20) * (rng.chance(0.15) ? -1 : 1),
      tilt, orbit: orbit(rng, aKm, gmStar, 0.08, 3, 'parentEquator'),
      appearance: gasAppearance(rng, T, true, id),
      atmosphere: { color: rng.tint([0.55, 0.75, 1.0]), height: 0.02, density: 0.5 },
      rings: rng.chance(0.3) ? makeRings(rng, radius, true) : undefined,
      temperature: T,
      description: `${_(CLASS_LABEL[cls])}. ${_('{m} Dünya kütlesinde, metan katkılı hidrojen-helyum atmosferi', { m: fixed(massE, 1) })}; ${describeTemp(T)}.`,
      facts: { 'Sınıf': CLASS_LABEL[cls], 'Kaynak': 'Prosedürel (tahmini)' },
    };
    bodies.push(data);
    makeMoons(rng, data, true, rng.int(1, 4), bodies, 'giant');
  } else {
    // Rocky worlds; sub-class by equilibrium temperature
    const massE = cls === 'ice' ? rng.logRange(0.01, 1.5) : rng.logRange(0.05, 5);
    const radius = EARTH_RADIUS * Math.pow(massE, massE < 1 ? 0.3 : 0.27);
    let albedo = rng.range(0.1, 0.35);
    let T = equilibriumT(host.luminosity, aAU, albedo);
    const carbonRich = rng.chance(0.06);
    if (T > 750) cls = 'lava';
    else if (T > 330) cls = massE > 0.3 && rng.chance(0.7) ? 'venusian' : 'barren';
    else if (T > 235) cls = massE > 0.25 && rng.chance(0.75) ? (tidallyLocked ? 'eyeball' : rng.chance(0.2) ? 'ocean' : 'temperate') : 'barren';
    else if (T > 140) cls = massE > 0.08 ? 'desert' : 'barren';
    else cls = 'ice';
    if (carbonRich && (cls === 'barren' || cls === 'desert' || cls === 'venusian')) cls = 'carbon';
    if (cls === 'venusian') albedo = rng.range(0.6, 0.75);
    if (cls === 'temperate' || cls === 'ocean') albedo = rng.range(0.28, 0.38);
    if (cls === 'eyeball') albedo = rng.range(0.4, 0.55);
    if (cls === 'carbon') albedo = rng.range(0.04, 0.1);
    if (cls === 'ice') albedo = rng.range(0.45, 0.7);
    T = equilibriumT(host.luminosity, aAU, albedo);
    if (cls === 'venusian') T *= rng.range(1.6, 2.4); // greenhouse
    if (cls === 'temperate' || cls === 'ocean') T += rng.range(15, 40);

    const { appearance, atmosphere, clouds } = rockyAppearance(rng, cls, massE, id);
    const type = massE < 0.02 ? 'dwarf' : 'planet';
    const activity: Activity | undefined = cls === 'lava' && rng.chance(0.7)
      ? { kind: 'volcanic', count: rng.int(3, 7), height: radius * rng.range(0.03, 0.08), spread: radius * rng.range(0.06, 0.15), fall: 1, color: rng.tint([0.55, 0.5, 0.5], 0.05), intensity: rng.range(0.6, 1.0) }
      : undefined;
    data = {
      id, name, type, parent, radius, flattening: massE > 0.5 ? rng.range(0.001, 0.006) : undefined,
      mass: massE * EARTH_MASS, albedo, activity,
      rotationPeriod: tidallyLocked ? 'sync' : rng.logRange(9, 900) * (rng.chance(0.1) ? -1 : 1),
      tilt, orbit: orbit(rng, aKm, gmStar, 0.18, 3.5, 'parentEquator'),
      appearance, atmosphere, clouds, temperature: T,
      // a few rocky worlds keep a thin ring of debris (a shattered moon)
      rings: massE > 0.5 && T < 400 && rng.chance(0.05) ? makeRings(rng, radius, true) : undefined,
      description: `${_(CLASS_LABEL[cls])}. ${_('{m} Dünya kütlesinde', { m: fixed(massE, 2) })}; ${describeTemp(T)}${tidallyLocked && cls !== 'eyeball' ? `; ${_('yıldızına gelgitle kilitli')}` : ''}.${CLASS_NOTE[cls] ? ` ${_(CLASS_NOTE[cls]!)}` : ''}`,
      facts: { 'Sınıf': CLASS_LABEL[cls], 'Kaynak': 'Prosedürel (tahmini)' },
    };
    bodies.push(data);
    if (massE > 0.4 && rng.chance(0.45)) makeMoons(rng, data, beyondFrost, rng.int(1, 2), bodies, 'rocky');
  }
  return { cls, data };
}

function describeTemp(T: number): string {
  if (T > 1500) return _('yüzeyi erimiş kaya sıcaklığında');
  if (T > 700) return _('kavurucu sıcak');
  if (T > 330) return _('çok sıcak');
  if (T > 235) return _('ılıman sıcaklıkta');
  if (T > 140) return _('soğuk');
  return _('dondurucu soğuk');
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
    case 'ocean':
      return {
        appearance: {
          kind: 'terrestrial', seed, ocean: rng.tint([0.01, 0.08, 0.28], 0.03), landLow: rng.tint([0.2, 0.3, 0.3]), landMid: rng.tint([0.3, 0.35, 0.3]),
          landHigh: rng.tint([0.5, 0.5, 0.45]), ice: [0.92, 0.95, 1.0], seaLevel: rng.range(0.93, 0.985), iceCaps: rng.range(0.7, 0.9),
          craters: 0, roughness: 0.6, variation: 0.3,
        },
        atmosphere: { color: rng.tint([0.35, 0.6, 1.0], 0.08), height: 0.03, density: rng.range(0.9, 1.6), sunsetColor: [1.0, 0.5, 0.25] },
        clouds: { seed: seed + 1, color: [1, 1, 1], coverage: rng.range(0.45, 0.75), height: 0.007, speed: rng.range(1.0, 2.0), opacity: 0.9 },
      };
    case 'eyeball':
      return {
        appearance: {
          // mostly ice, a low sea level makes the "pupil" show where the terrain dips
          kind: 'terrestrial', seed, ocean: rng.tint([0.03, 0.14, 0.32], 0.04), landLow: rng.tint([0.7, 0.76, 0.84]), landMid: rng.tint([0.85, 0.88, 0.93]),
          landHigh: [0.96, 0.97, 1.0], ice: [0.96, 0.97, 1.0], seaLevel: rng.range(0.3, 0.45), iceCaps: rng.range(0.35, 0.5),
          craters: 0.05, roughness: 0.8, variation: 0.4,
        },
        atmosphere: { color: rng.tint([0.5, 0.65, 0.95], 0.08), height: 0.02, density: rng.range(0.5, 1.0), sunsetColor: [1.0, 0.55, 0.3] },
        clouds: { seed: seed + 1, color: [1, 1, 1], coverage: rng.range(0.2, 0.4), height: 0.006, speed: rng.range(1.5, 3), opacity: 0.8 },
      };
    case 'carbon':
      return {
        appearance: {
          kind: 'terrestrial', seed, ocean: [0.03, 0.02, 0.015], landLow: rng.tint([0.06, 0.055, 0.05], 0.02), landMid: rng.tint([0.14, 0.13, 0.12], 0.03),
          landHigh: rng.tint([0.3, 0.3, 0.32], 0.04), seaLevel: rng.chance(0.5) ? rng.range(0.3, 0.5) : undefined,
          craters: rng.range(0.2, 0.6), roughness: 1.1, variation: 0.5,
        },
        atmosphere: canHoldAir && rng.chance(0.6) ? { color: rng.tint([0.6, 0.45, 0.3], 0.05), height: 0.025, density: rng.range(0.3, 1.0) } : undefined,
      };
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
    // the inner icy moons of giants: some vent their buried oceans (Enceladus); volcanic ones erupt
    const cryo = icy && j <= 1 && radius > 150 && rng.chance(0.22);
    const activity: Activity | undefined = volcanic
      ? { kind: 'volcanic', count: rng.int(3, 6), height: radius * rng.range(0.1, 0.2), spread: radius * rng.range(0.2, 0.4), fall: 1, color: rng.tint([0.78, 0.82, 0.92], 0.05), intensity: rng.range(0.6, 1.1) }
      : cryo
        ? { kind: 'cryo', count: rng.int(3, 6), height: radius * rng.range(0.8, 2.0), spread: radius * rng.range(0.15, 0.3), fall: 0, color: [0.9, 0.95, 1.0], intensity: rng.range(0.5, 0.9) }
        : undefined;
    bodies.push({
      id, name, type: 'moon', parent: planet.id, radius, mass, albedo: icy ? rng.range(0.4, 0.8) : rng.range(0.08, 0.3),
      activity,
      rotationPeriod: 'sync',
      orbit: {
        kind: 'simple', a, e: Math.pow(rng.next(), 2) * 0.08, i: Math.abs(gauss(rng)) * 1.5, node: rng.range(0, 360), argPeri: rng.range(0, 360),
        M0: rng.range(0, 360), epoch: J2000_JD, period, frame: 'parentEquator',
      },
      appearance,
      description: `${_('{name} gezegeninin {n}. uydusu.', { name: _(planet.name), n: j + 1 })} ${volcanic ? _('Gelgit ısıtmasıyla volkanik olarak aktif.') : cryo ? _('Buzlu kabuğun çatlaklarından su buharı ve buz püskürten gayzerler: altında bir okyanus saklı.') : icy ? _('Buzlu, kraterli yüzey.') : _('Kraterli kaya yüzeyi.')}`,
      facts: { 'Kaynak': 'Prosedürel (tahmini)' },
    });
    a *= rng.range(1.5, 2.4);
  }
  // giants also trap a swarm of small captured bodies on distant, tilted (often retrograde) orbits
  if (kind === 'giant' && rng.chance(0.6)) {
    const n = rng.int(1, 3);
    for (let j = 0; j < n; j++) {
      const id = `${planet.id}-i${j}`;
      const radius = rng.logRange(15, 120);
      const aI = R * rng.range(80, 260);
      const period = (2 * Math.PI * Math.sqrt((aI * aI * aI) / gm)) / DAY_S;
      const retro = rng.chance(0.65);
      const seed = hashSeed(...id.split('').map((c) => c.charCodeAt(0))) % 10_000;
      bodies.push({
        id, name: `${planet.name} ${ROMAN[count + j] ?? count + j + 1}`, type: 'moon', parent: planet.id, radius,
        mass: (4 / 3) * Math.PI * Math.pow(radius * 1000, 3) * 1500, albedo: rng.range(0.04, 0.12),
        rotationPeriod: rng.range(5, 40), tilt: rng.range(0, 180),
        orbit: {
          kind: 'simple', a: aI, e: rng.range(0.1, 0.5), i: retro ? rng.range(140, 175) : rng.range(25, 55), node: rng.range(0, 360), argPeri: rng.range(0, 360),
          M0: rng.range(0, 360), epoch: J2000_JD, period, frame: 'parentEquator',
        },
        appearance: { kind: 'terrestrial', seed, landLow: rng.tint([0.12, 0.11, 0.1]), landMid: rng.tint([0.22, 0.2, 0.18]), landHigh: rng.tint([0.35, 0.33, 0.3]), craters: 1.0, roughness: 2.0, variation: 0.5 },
        description: `${_('{name} gezegeninin düzensiz uydusu: yakalanmış bir asteroit.', { name: _(planet.name) })} ${retro ? _('Uzak, eğik ve retrograd bir yörüngede dolanır.') : _('Uzak ve eğik bir yörüngede dolanır.')}`,
        facts: { 'Kaynak': 'Prosedürel (tahmini)' },
      });
    }
  }
}

/* ------------------------------------------------------------------ */
/*  Star text                                                          */
/* ------------------------------------------------------------------ */

function starDescription(s: StarInfo): string {
  const lumDesc = LUM_CLASS_DESC[s.lumClass];
  const cls = s.isWhiteDwarf ? _('beyaz cüce') : (lumDesc ? _(lumDesc) : _('yıldız')).toLocaleLowerCase(localeTag());
  const parts = [_('{sp} sınıfı {cls}', { sp: s.catalogSpectral || s.spectral, cls })];
  parts.push(_("Güneş'e uzaklığı {ly} ({km})", { ly: fmtLightYears(s.distancePc * PARSEC_KM), km: fmtDistance(s.distancePc * PARSEC_KM) }));
  if (s.names?.constellation) parts.push(_('{name} takımyıldızında', { name: s.names.constellation }));
  const tail = s.procedural
    ? _('Yıldız ve gezegen sistemi, galaksi modelinden deterministik olarak prosedürel üretilmiştir.')
    : _('Gezegen sistemi gerçek yıldız verilerinden (HYG) türetilerek prosedürel olarak üretilmiştir.');
  return parts.join('. ') + '. ' + tail;
}

function starFacts(s: StarInfo): Record<string, string> {
  const f: Record<string, string> = {
    'Spektral sınıf': s.catalogSpectral || s.spectral,
    'Görünür kadir': fixed(s.mag, 2),
    'Mutlak kadir': fixed(s.absMag, 2),
    'Parlaklık': `${fmtLum(s.luminosity)} L☉`,
    'B−V': fixed(s.bv, 2),
  };
  if (s.hip) f['Hipparcos'] = `HIP ${s.hip}`;
  if (s.names?.bayer) f['Bayer/Flamsteed'] = s.names.bayer;
  if (s.names?.gliese) f['Gliese'] = s.names.gliese;
  return f;
}

function fmtLum(l: number): string {
  if (l >= 100) return fixed(l, 0);
  if (l >= 1) return fixed(l, 2);
  if (l >= 0.001) return fixed(l, 4);
  return l.toExponential(2);
}
