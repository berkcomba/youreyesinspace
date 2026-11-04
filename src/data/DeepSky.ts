import { PARSEC_KM } from '../core/constants';
import { SUN_MASS_KG } from '../astro/stellar';
import { Rng } from '../gen/SystemGenerator';
import { catalogueCluster, globularCount, hashStr, nebulaCluster } from '../galaxy/ClusterStars';
import { _, fixed, fmtNum } from '../i18n';
import { fmtLightYears, fmtSci } from '../ui/format';
import { decimalYearJd, semiMajorKm, starBody } from './blackholes';
import { EMISSION, OLD_CLUSTER, PLANETARY, SNR, YOUNG_CLUSTER, type LandmarkDef, type LandmarkKind } from './landmarks';
import { GAMMA, MAGNETAR, PULSAR_SPRITE, RADIO } from './pulsars';
import type { BodyData } from './types';

/**
 * The survey catalogues of the Milky Way's deep-sky objects (public/data/deepsky.json, built by
 * scripts/build-deepsky.mjs): every ATNF pulsar with a distance, the MWSC open clusters, the
 * Harris globulars, the Strasbourg–ESO planetary nebulae, Green's supernova remnants and the WISE
 * H II regions. They become landmarks after the hand-made ones (which win where both exist);
 * pulsars are visitable systems with their measured binary companions.
 */

type Opt = number | null;
/** J-name, B-name, ra, dec, pc, P (s), Ṗ, τ (yr), B (G), Ė (erg/s), DM, type, host, year, survey, binary, galaxy */
type PulsarRow = [string, string, number, number, number, number, Opt, Opt, Opt, Opt, Opt, string, string, number, string, 0 | [number, Opt, number, Opt, string], string];
/** name, ra, dec, pc, r (pc), log age, members, E(B−V), [Fe/H], MWSC type */
type OpenRow = [string, number, number, number, number, Opt, number, Opt, Opt, string];
/** name, alt, ra, dec, pc, M_V, r_h (pc), [Fe/H], c, core-collapsed, v_r */
type GlobularRow = [string, string, number, number, number, Opt, Opt, Opt, Opt, number, Opt];
/** name, PN G, ra, dec, pc, r (pc), central star V, its type, v_exp, distance method */
type PnRow = [string, string, number, number, number, Opt, Opt, string, Opt, string];
/** G-name, alt, ra, dec, pc, r (pc), type, S1GHz (mJy), distance method (L literature, S Σ–D) */
type SnrRow = [string, string, number, number, number, number, string, Opt, string];
/** name, WISE name, ra, dec, pc, r (pc), WISE class, distance method */
type HiiRow = [string, string, number, number, number, number, string, string];

export interface DeepSkyData {
  sources: Record<string, string>;
  pulsars: PulsarRow[];
  open: OpenRow[];
  globular: GlobularRow[];
  pn: PnRow[];
  snr: SnrRow[];
  hii: HiiRow[];
}

export async function loadDeepSky(baseUrl: string): Promise<DeepSkyData> {
  const res = await fetch(`${baseUrl}data/deepsky.json`);
  if (!res.ok) throw new Error(`deepsky.json: ${res.status}`);
  return res.json() as Promise<DeepSkyData>;
}

/** Info-panel rows (keys are translated at display) */
const DS_FACTS = {
  dist: 'Uzaklık',
  period: 'Periyot',
  pdot: 'Periyot türevi',
  age: 'Karakteristik yaş',
  field: 'Manyetik alan',
  edot: 'Dönme-enerjisi kaybı',
  dm: 'Dağılım ölçüsü',
  companion: 'Yoldaş',
  mass: 'Kütle',
  orbit: 'Yörünge periyodu',
  ecc: 'Dış merkezlik',
  host: 'Bulunduğu yer',
  disc: 'Keşif',
  source: 'Kaynak',
  clAge: 'Yaş',
  members: 'Üye yıldız (MWSC)',
  redden: 'Kızarma E(B−V)',
  feh: 'Metallik [Fe/H]',
  rh: 'Yarı-ışık yarıçapı',
  conc: 'Merkezî yoğunlaşma (c)',
  vr: 'Dikine hız',
  diam: 'Çap',
  cstar: 'Merkez yıldızı',
  vexp: 'Genişleme hızı',
  pn: 'PN G adı',
  type: 'Tür',
  flux: 'Radyo akısı (1 GHz)',
  wise: 'WISE adı',
  status: 'Katalog durumu',
} as const;

const COMPANION_LABEL: Record<string, string> = {
  MS: 'anakol yıldızı',
  NS: 'nötron yıldızı',
  CO: 'CO beyaz cücesi',
  He: 'helyum beyaz cücesi',
  ONeMg: 'ONeMg beyaz cücesi',
  UL: 'çok düşük kütleli yoldaş',
  BH: 'kara delik',
};

const SNR_TYPE: Record<string, string> = {
  S: 'Kabuk tipi',
  C: 'Bileşik (kabuk + pulsar rüzgârı bulutsusu)',
  F: 'Dolu merkezli (pulsar rüzgârı bulutsusu)',
};

const HII_STATUS: Record<string, string> = {
  K: 'Bilinen H II bölgesi',
  G: 'Bilinen bir H II bölge grubunun üyesi',
  C: 'Aday',
  Q: 'Radyo-sessiz aday',
};

const EPOCH = decimalYearJd(2000.0);

function pcFact(pc: number, estimate = false): string {
  const s = `${fmtNum(Math.round(pc))} pc (${fmtLightYears(pc * PARSEC_KM)})`;
  return estimate ? `${s} · ${_('tahmini')}` : s;
}

function years(y: number): string {
  if (y >= 1e9) return _('{n} milyar yıl', { n: fixed(y / 1e9, 1) });
  if (y >= 1e6) return _('{n} milyon yıl', { n: fixed(y / 1e6, y < 1e7 ? 1 : 0) });
  if (y >= 1e4) return _('{n} bin yıl', { n: fmtNum(Math.round(y / 1e3)) });
  return _('{n} yıl', { n: fmtNum(Math.round(y)) });
}

function periodText(P: number): string {
  if (P < 0.1) return `${fixed(P * 1000, 3)} ms (${fmtNum(Math.round(1 / P))} Hz)`;
  return P < 1 ? `${fixed(P * 1000, 1)} ms` : `${fixed(P, 3)} s`;
}

/* ------------------------------------------------------------------ pulsars */

/** most likely companion from the median mass (ATNF leaves most types blank) */
function guessCompanion(m: number | null, e: number): string {
  if (m === null) return 'He';
  if (m < 0.08) return 'UL';
  if (m < 0.45) return 'He';
  if (m < 1.2 && e < 0.05) return 'CO';
  return m >= 1.0 ? 'NS' : 'CO';
}

function companionBody(pulsarId: string, name: string, code: string, m: number, Pb: number, e: number, rng: Rng, facts: Record<string, string>, note: string): BodyData {
  const id = `${pulsarId}-comp`;
  const orbit = {
    kind: 'simple' as const, a: semiMajorKm(Pb, (1.4 + m) * SUN_MASS_KG), e, i: rng.range(20, 85), node: rng.range(0, 360), argPeri: rng.range(0, 360),
    M0: rng.range(0, 360), epoch: EPOCH, period: Pb, frame: 'ecliptic' as const,
  };
  if (code === 'NS') {
    return {
      id, name, type: 'pulsar', parent: pulsarId,
      radius: 12, mass: m * SUN_MASS_KG, rotationPeriod: 1, pole: { ra: rng.range(0, 360), dec: rng.range(-60, 60) },
      orbit,
      appearance: { kind: 'pulsar', seed: hashStr(id) % 991, magneticTilt: 0, beamHalfAngle: 0, beamLength: 0, beamColor: RADIO, quiet: true },
      temperature: 5e5,
      description: `${_('İkinci bir nötron yıldızı: atımları bize ulaşmıyor; varlığı ve kütlesi pulsarın atım zamanlamasından biliniyor.')} ${note}`,
      facts,
    };
  }
  let radius: number, T: number, desc: string;
  if (code === 'MS') {
    radius = Math.pow(m, 0.8); T = 5772 * Math.pow(m, 0.505);
    desc = _('Pulsarla birlikte dolanan sıradan bir anakol yıldızı.');
  } else if (code === 'UL') {
    // "black widow": a stripped, irradiated remnant a few tens of Jupiter masses
    radius = 0.12; T = 3000;
    desc = _('Pulsarın rüzgârı ve ışınımıyla buharlaştırılan, birkaç on Jüpiter kütlesine inmiş bir yoldaş ("kara dul" sistemi).');
  } else {
    // white dwarf: Eggleton's zero-temperature mass–radius relation
    const x = Math.min(m, 1.38) / 1.44;
    radius = 0.0127 * Math.pow(x * 1.44, -1 / 3) * Math.sqrt(1 - Math.pow(x, 4 / 3));
    if (code === 'He') radius = Math.max(radius, 0.02);
    T = 6000;
    desc = _('Pulsarı milisaniye hızına çıkaran madde aktarımından geriye kalan beyaz cüce.');
  }
  return starBody(id, name, m, radius, T, `${desc} ${note}`, facts, { parent: pulsarId, orbit });
}

function pulsarDef(r: PulsarRow): LandmarkDef {
  const [jname, bname, ra, dec, pc, P, Pdot, age, B, Edot, DM, type, host, year, survey, bin, galaxy] = r;
  const id = `n${jname}`;
  const rng = new Rng(hashStr(id));
  const name = bname ? `PSR ${bname} (${jname})` : `PSR ${jname}`;
  const magnetar = type.includes('AXP');
  const quiet = type.includes('NRAD');
  const msp = P < 0.03;
  const [hostKind, hostName] = host ? host.split(':') : ['', ''];

  const label = magnetar ? _('Magnetar') : msp ? _('Milisaniye pulsarı') : quiet ? _('Radyo-sessiz pulsar') : age !== null && age < 1e5 ? _('Genç pulsar') : _('Radyo pulsarı');
  const where = hostKind === 'GC' ? _('{name} küresel kümesinde', { name: hostName }) : hostKind === 'SNR' || hostKind === 'PWN' ? _('{name} kalıntısında', { name: hostName }) : '';
  const summary = where ? `${label} · ${where}` : bin ? `${label} · ${_('çift sistem')}` : label;

  const parts: string[] = [];
  if (magnetar) parts.push(_('Manyetik alanı {b} gauss olan bir magnetar: yavaş döner, ama manyetik enerjisi X-ışını ve gama patlamalarıyla boşalır.', { b: B !== null ? fmtSci(B, '', 2) : '10¹⁴' }));
  else if (msp) parts.push(_('Saniyede {hz} kez dönen bir milisaniye pulsarı: bir yoldaştan aktarılan maddeyle yeniden hızlandırılmış ("geri dönüştürülmüş") yaşlı bir nötron yıldızı.', { hz: fmtNum(Math.round(1 / P)) }));
  else parts.push(_('{p} saniyede bir dönen bir nötron yıldızı; manyetik kutuplarından çıkan ışınlar her turda Dünya\'yı süpürür.', { p: fixed(P, P < 1 ? 3 : 2) }));
  if (quiet && !magnetar) parts.push(_('Radyo ışınları Dünya\'yı süpürmüyor; atımları yalnızca X-ışını ya da gama bandında görülür.'));
  if (galaxy) parts.push(_('Samanyolu\'nda değil, {name} içinde.', { name: _(galaxy === 'Büyük Macellan' ? 'Büyük Macellan Bulutu' : 'Küçük Macellan Bulutu') }));

  const facts: Record<string, string> = {};
  facts[DS_FACTS.period] = periodText(P);
  if (Pdot !== null && Pdot > 0) facts[DS_FACTS.pdot] = `${fmtSci(Pdot, 's/s', 2)}`;
  if (age !== null && age > 0) facts[DS_FACTS.age] = years(age);
  if (B !== null && B > 0) facts[DS_FACTS.field] = `${fmtSci(B, 'G', 2)}`;
  if (Edot !== null && Edot > 0) facts[DS_FACTS.edot] = `${fmtSci(Edot, 'erg/s', 2)}`;
  if (DM !== null) facts[DS_FACTS.dm] = `${fixed(DM, 1)} pc/cm³`;
  facts[DS_FACTS.dist] = pcFact(pc);
  if (where) facts[DS_FACTS.host] = where;

  let companions: ((pid: string) => BodyData[]) | undefined;
  if (bin) {
    const [Pb, , e, mMed] = bin;
    const code = bin[4] || guessCompanion(mMed, e);
    const guessed = !bin[4];
    const m = mMed ?? (code === 'UL' ? 0.03 : code === 'NS' ? 1.3 : 0.25);
    const cLabel = `${_(COMPANION_LABEL[code])}${guessed ? ` (${_('tahmini')})` : ''}`;
    facts[DS_FACTS.companion] = `${cLabel}, ~${fixed(m, m < 0.1 ? 3 : 2)} M☉`;
    facts[DS_FACTS.orbit] = Pb < 1 ? _('{n} saat', { n: fixed(Pb * 24, 2) }) : _('{n} gün', { n: fixed(Pb, Pb < 100 ? 3 : 0) });
    if (e > 0) facts[DS_FACTS.ecc] = fixed(e, e < 0.001 ? 6 : 4);
    parts.push(_('Bir {companion} ile {orbit} süren bir yörüngede dolanır.', { companion: _(COMPANION_LABEL[code]), orbit: facts[DS_FACTS.orbit] }));
    if (code !== 'BH') {
      const note = guessed
        ? _('Kütlesi, 60° yörünge eğimi varsayımıyla ölçülen kütle fonksiyonundan; türü bu kütleden tahmin edildi.')
        : _('Kütlesi, 60° yörünge eğimi varsayımıyla ölçülen kütle fonksiyonundan.');
      const cFacts = { [DS_FACTS.mass]: `~${fixed(m, m < 0.1 ? 3 : 2)} M☉`, [DS_FACTS.orbit]: facts[DS_FACTS.orbit], [DS_FACTS.type]: cLabel };
      companions = (pid) => [companionBody(pid, _('{name} yoldaşı', { name }), code, m, Pb, e, new Rng(hashStr(pid) ^ 0x2b), cFacts, note)];
    }
  }
  if (year) facts[DS_FACTS.disc] = survey ? `${year} · ${survey.replace(/,/g, ', ')}` : String(year);
  facts[DS_FACTS.source] = 'ATNF Pulsar Catalogue';
  parts.push(_('Periyot, yavaşlama, uzaklık ve yörünge ATNF Pulsar Kataloğu\'ndan; ışın geometrisi temsilîdir.'));

  // Rankin (1993): beam half-opening ≈ 5.4° · P^-1/2
  const beamHalfAngle = Math.min(Math.max(5.4 / Math.sqrt(P), 3), 25);
  const temperature = msp ? 8e5 : age === null ? 6e5 : age < 1e4 ? 2e6 : age < 1e5 ? 1.2e6 : age < 1e6 ? 8e5 : 5e5;
  return {
    id, name, kind: 'pulsar', galaxy: galaxy || null, ra, dec, distancePc: pc, radiusPc: 0.05,
    absMag: magnetar ? 5 : msp ? 7 : 6.5, color: magnetar ? [1, 0.75, 0.85] : PULSAR_SPRITE,
    summary, description: parts.join(' '), facts, catalog: true,
    pulsar: {
      periodMs: P * 1000, massSolar: 1.4, radiusKm: 12, temperature,
      pole: { ra: rng.range(0, 360), dec: rng.range(-70, 70) }, magneticTilt: rng.range(20, 85),
      beamHalfAngle, beamLength: 50, beamColor: magnetar ? MAGNETAR : quiet || type.includes('HE') ? GAMMA : RADIO,
      companions,
    },
  };
}

/* ------------------------------------------------------------------ clusters */

function openDef(r: OpenRow): LandmarkDef {
  const [name, ra, dec, pc, rPc, logAge, members, ebv, feh] = r;
  const ageYr = logAge !== null ? Math.pow(10, logAge) : null;
  const young = logAge !== null && logAge < 8;
  // integrated brightness, rough: member count and youth (the survey has no total magnitudes)
  const absMag = Math.min(Math.max(-2 * Math.log10(Math.max(members, 5)) - Math.max(0, 9 - (logAge ?? 9)), -10), -0.5);
  const facts: Record<string, string> = { [DS_FACTS.dist]: pcFact(pc) };
  if (ageYr !== null) facts[DS_FACTS.clAge] = years(ageYr);
  if (members) facts[DS_FACTS.members] = fmtNum(members);
  if (ebv !== null) facts[DS_FACTS.redden] = fixed(ebv, 2);
  if (feh !== null) facts[DS_FACTS.feh] = fixed(feh, 2);
  facts[DS_FACTS.source] = 'MWSC (Kharchenko et al. 2013)';
  return {
    id: `d-oc-${name.replace(/\s+/g, '_')}`, name, kind: 'cluster', galaxy: null, ra, dec, distancePc: pc, radiusPc: Math.max(rPc, 0.5), absMag,
    color: young ? YOUNG_CLUSTER : logAge !== null && logAge > 9 ? OLD_CLUSTER : [0.9, 0.9, 0.9],
    // the member stars: generated below the catalogue's completeness limit, selectable
    cluster: catalogueCluster(pc, { ageMyr: ageYr !== null ? Math.max(ageYr / 1e6, 1) : 200, count: Math.max(members || 0, 80), feh: feh ?? undefined }),
    summary: ageYr !== null ? `${_('Açık yıldız kümesi')} · ${years(ageYr)}` : _('Açık yıldız kümesi'),
    description: `${_('Samanyolu diskinde aynı gaz bulutundan birlikte doğmuş yıldızların oluşturduğu bir açık küme; Galaksi\'nin gelgit kuvvetleri onu birkaç yüz milyon yıl içinde dağıtır.')} ${_('Konum, uzaklık, yaş ve üye sayısı MWSC kataloğundan; toplam parlaklık üye sayısından kabaca tahmin edildi.')}`,
    facts, catalog: true,
  };
}

function globularDef(r: GlobularRow): LandmarkDef {
  const [id0, alt, ra, dec, pc, Mv, rh, feh, c, cc, vr] = r;
  const name = alt ? `${alt} (${id0})` : id0;
  const facts: Record<string, string> = { [DS_FACTS.dist]: pcFact(pc) };
  if (feh !== null) facts[DS_FACTS.feh] = fixed(feh, 2);
  if (rh !== null) facts[DS_FACTS.rh] = `${fixed(rh, 1)} pc`;
  if (c !== null) facts[DS_FACTS.conc] = `${fixed(c, 2)}${cc ? ` · ${_('çekirdek çökmüş')}` : ''}`;
  if (vr !== null) facts[DS_FACTS.vr] = `${fixed(vr, 1)} km/s`;
  facts[DS_FACTS.source] = 'Harris 1996 (2010)';
  const parts = [_('Galaksi\'nin halesinde dolanan, yüz binlerce yaşlı yıldızdan oluşan küresel bir küme: Samanyolu\'nun en eski nesnelerinden, yaklaşık 12 milyar yaşında.')];
  if (feh !== null) parts.push(_('Metal bolluğu Güneş\'inkinin yüzde {pct}\'i kadar.', { pct: fixed(100 * Math.pow(10, feh), feh < -1 ? 1 : 0) }));
  parts.push(_('Uzaklık, parlaklık ve yapı Harris kataloğundan.'));
  return {
    id: `d-gc-${id0.replace(/\s+/g, '_')}`, name, kind: 'globular', galaxy: null, ra, dec, distancePc: pc,
    radiusPc: rh !== null ? Math.max(rh * 3, 3) : 10, absMag: Mv ?? -7, color: OLD_CLUSTER,
    cluster: catalogueCluster(pc, { ageMyr: 12_000, count: globularCount(Mv ?? -7), feh: feh ?? undefined }),
    summary: _('Küresel küme'), description: parts.join(' '), facts, catalog: true,
  };
}

/* ------------------------------------------------------------------ nebulae */

function pnDef(r: PnRow): LandmarkDef {
  const [name, png, ra, dec, pc, rPc, cV, cType, vexp, method] = r;
  const stat = method === 'S';
  const facts: Record<string, string> = { [DS_FACTS.dist]: pcFact(pc, stat) };
  if (rPc !== null) facts[DS_FACTS.diam] = fmtLightYears(rPc * 2 * PARSEC_KM);
  if (cV !== null || cType) facts[DS_FACTS.cstar] = [cV !== null ? `V ${fixed(cV, 1)}` : '', cType].filter(Boolean).join(' · ');
  if (vexp !== null) facts[DS_FACTS.vexp] = `${fixed(vexp, 0)} km/s`;
  if (png && png !== name) facts[DS_FACTS.pn] = `PN ${png}`;
  facts[DS_FACTS.source] = 'Strasbourg–ESO PN Catalogue';
  const parts = [_('Ölmekte olan Güneş benzeri bir yıldızın dışarı attığı gaz kabuğu: merkezdeki sıcak çekirdeğin morötesi ışığıyla parlıyor. Birkaç on bin yıl içinde dağılıp görünmez olacak.')];
  if (stat) parts.push(_('Uzaklık istatistiksel yöntemle tahmin edildi; belirsizliği yüzde 30–50.'));
  return {
    id: `d-pn-${png || name.replace(/\s+/g, '_')}`, name, kind: 'planetary', galaxy: null, ra, dec, distancePc: pc,
    radiusPc: Math.max(rPc ?? 0.15, 0.03), absMag: 0, color: PLANETARY,
    summary: _('Gezegenimsi bulutsu'), description: parts.join(' '), facts, catalog: true,
  };
}

function snrDef(r: SnrRow): LandmarkDef {
  const [gname, alt, ra, dec, pc, rPc, type, flux, method] = r;
  const estimate = method === 'S';
  const name = alt ? `${alt} (SNR ${gname})` : `SNR ${gname}`;
  const facts: Record<string, string> = { [DS_FACTS.dist]: pcFact(pc, estimate) };
  facts[DS_FACTS.diam] = fmtLightYears(rPc * 2 * PARSEC_KM);
  const t = SNR_TYPE[type.replace('?', '')];
  if (t) facts[DS_FACTS.type] = `${_(t)}${type.endsWith('?') ? ' ?' : ''}`;
  if (flux !== null) facts[DS_FACTS.flux] = `${fmtNum(flux / 1000, { maximumSignificantDigits: 3 })} Jy`;
  facts[DS_FACTS.source] = "Green's SNR Catalogue";
  const parts = [_('Bir süpernova patlamasının saniyede binlerce kilometreyle genişleyen şok dalgası: yıldızlararası gazı süpürüp ısıtıyor ve radyo dalgalarında parlıyor.')];
  if (estimate) parts.push(_('Uzaklık, radyo yüzey parlaklığı–çap (Σ–D) bağıntısından tahmin edildi; iki kat yanılabilir.'));
  return {
    id: `d-snr-${gname}`, name, kind: 'remnant', galaxy: null, ra, dec, distancePc: pc, radiusPc: Math.max(rPc, 0.3),
    absMag: Math.min(Math.max(-3 - 2.5 * Math.log10(rPc / 5), -7), -1), color: SNR,
    summary: _('Süpernova kalıntısı'), description: parts.join(' '), facts, catalog: true,
  };
}

function hiiDef(r: HiiRow): LandmarkDef {
  const [nice, wise, ra, dec, pc, rPc, cls, method] = r;
  const facts: Record<string, string> = { [DS_FACTS.dist]: pcFact(pc, method !== 'Parallax') };
  facts[DS_FACTS.diam] = fmtLightYears(rPc * 2 * PARSEC_KM);
  if (nice) facts[DS_FACTS.wise] = wise;
  if (HII_STATUS[cls]) facts[DS_FACTS.status] = _(HII_STATUS[cls]);
  facts[DS_FACTS.source] = 'WISE H II Catalog v3.0';
  const parts = [_('İyonlaşmış hidrojen bulutu (H II bölgesi): içindeki genç, sıcak O ve B yıldızlarının morötesi ışığıyla parlayan bir yıldız doğumevi.')];
  parts.push(method === 'Parallax'
    ? _('Uzaklık, bölgedeki maserlerin paralaksından ölçüldü.')
    : _('Uzaklık, gazın dikine hızından Galaksi\'nin dönme eğrisiyle (kinematik yöntem) bulundu.'));
  return {
    id: `d-hii-${wise}`, name: nice || `WISE ${wise}`, kind: 'nebula', galaxy: null, ra, dec, distancePc: pc, radiusPc: Math.max(rPc, 0.2),
    absMag: Math.min(Math.max(-4.1 - 5 * Math.log10(rPc / 6), -11), 0), color: EMISSION,
    summary: _('H II bölgesi'), description: parts.join(' '), facts, catalog: true,
    // the exciting cluster inside: generated members below the star catalogue's completeness limit
    cluster: nebulaCluster(Math.max(rPc, 0.2), pc),
  };
}

/* ------------------------------------------------------------------ assembly */

const FAMILY: Record<LandmarkKind, number> = { cluster: 1, globular: 1, nebula: 2, remnant: 2, planetary: 2, pulsar: 3, star: 4 };

function unit(ra: number, dec: number): [number, number, number] {
  const a = ra * Math.PI / 180, d = dec * Math.PI / 180;
  return [Math.cos(d) * Math.cos(a), Math.cos(d) * Math.sin(a), Math.sin(d)];
}

/**
 * The catalogue landmarks, minus the objects the hand-made list already has (same family of
 * kinds, same place on the sky, similar distance).
 */
export function deepSkyLandmarks(data: DeepSkyData, handMade: readonly LandmarkDef[]): LandmarkDef[] {
  const defs = [
    ...data.pulsars.map(pulsarDef),
    ...data.globular.map(globularDef),
    ...data.open.map(openDef),
    ...data.pn.map(pnDef),
    ...data.snr.map(snrDef),
    ...data.hii.map(hiiDef),
  ];
  const mine = handMade.filter((h) => h.galaxy === null && h.distancePc !== undefined).map((h) => ({
    fam: FAMILY[h.kind], u: unit(h.ra, h.dec), d: h.distancePc!,
    // match radius: the object's own angular size, at least a few arcminutes (pulsars: an arcminute)
    r: h.kind === 'pulsar' ? 0.02 : Math.max(0.1, 0.6 * Math.atan(h.radiusPc / h.distancePc!) * 180 / Math.PI),
  }));
  const ids = new Set<string>();
  return defs.filter((d) => {
    if (ids.has(d.id)) return false;
    ids.add(d.id);
    const u = unit(d.ra, d.dec);
    for (const h of mine) {
      if (h.fam !== FAMILY[d.kind]) continue;
      const sep = Math.acos(Math.min(1, u[0] * h.u[0] + u[1] * h.u[1] + u[2] * h.u[2])) * 180 / Math.PI;
      if (sep < h.r && d.distancePc! / h.d < 3 && h.d / d.distancePc! < 3) return false;
    }
    return true;
  });
}
