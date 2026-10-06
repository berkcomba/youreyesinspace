import { Vector3 } from 'three';
import { AU_KM, C_KM_S, DAY_S, DEG, G, OBLIQUITY_J2000, RAD, YEAR_D } from '../core/constants';
import { SUN_MASS_KG, SUN_RADIUS_KM } from '../astro/stellar';
import { raDecToEclipticMath, raDecToScene } from '../math/frames';
import { _, fixed, fmtNum } from '../i18n';
import type { StarInfo } from './StarCatalog';
import type { BodyData, PoleRaDec, SimpleElements } from './types';

/** Schwarzschild radius (km) for a mass in solar masses */
export function schwarzschildKm(massSolar: number): number {
  return (2 * G * massSolar * SUN_MASS_KG) / ((C_KM_S * 1e3) ** 2) / 1e3;
}

/** Semi-major axis (km) from period (days) and total mass (kg) */
export function semiMajorKm(periodDays: number, totalMassKg: number): number {
  const T = periodDays * DAY_S;
  return Math.cbrt((G * totalMassKg * T * T) / (4 * Math.PI * Math.PI)) / 1e3;
}

/**
 * Astrometric (sky-plane) orbital elements → ecliptic J2000 elements.
 * Sky frame at the target: x = north, y = east, z = line of sight away from the observer;
 * Ω is the position angle of the ascending node (from north through east), i the tilt of the
 * orbit against the sky plane.
 */
function skyElementsToEcliptic(ra: number, dec: number, i: number, Omega: number, omega: number): { i: number; node: number; argPeri: number } {
  const L = raDecToEclipticMath(ra, dec);
  // north direction (d/dδ of the unit vector), equatorial → ecliptic (rotate about x by −ε)
  const a = ra * DEG, d = dec * DEG;
  const nx = -Math.sin(d) * Math.cos(a), ny = -Math.sin(d) * Math.sin(a), nz = Math.cos(d);
  const ce = Math.cos(OBLIQUITY_J2000), se = Math.sin(OBLIQUITY_J2000);
  const N = new Vector3(nx, ce * ny + se * nz, -se * ny + ce * nz).normalize();
  const E = new Vector3().crossVectors(N, L).normalize();
  const si = Math.sin(i * DEG), ci = Math.cos(i * DEG);
  const sO = Math.sin(Omega * DEG), cO = Math.cos(Omega * DEG);
  const sw = Math.sin(omega * DEG), cw = Math.cos(omega * DEG);
  // orbit normal and periapsis direction in the (N, E, L) basis
  const h = new Vector3().addScaledVector(N, si * sO).addScaledVector(E, -si * cO).addScaledVector(L, ci);
  const e = new Vector3()
    .addScaledVector(N, cO * cw - sO * sw * ci)
    .addScaledVector(E, sO * cw + cO * sw * ci)
    .addScaledVector(L, sw * si);
  const inc = Math.acos(Math.min(1, Math.max(-1, h.z)));
  const n = Math.abs(Math.sin(inc)) < 1e-8 ? new Vector3(1, 0, 0) : new Vector3(-h.y, h.x, 0).normalize();
  const node = Math.atan2(n.y, n.x);
  const argPeri = Math.atan2(new Vector3().crossVectors(n, e).dot(h), n.dot(e));
  return { i: inc * RAD, node: ((node * RAD) % 360 + 360) % 360, argPeri: ((argPeri * RAD) % 360 + 360) % 360 };
}

/** JD of a decimal year */
export function decimalYearJd(y: number): number {
  const year = Math.floor(y);
  const jan1 = Date.UTC(year, 0, 1) / 86_400_000 + 2_440_587.5;
  return jan1 + (y - year) * YEAR_D;
}

interface Disk { inner: number; outer: number; temperature: number; brightness: number }

interface BlackHoleBodyOpts {
  id: string;
  name: string;
  massSolar: number;
  pole: PoleRaDec;
  disk: Disk;
  diskAbsMag: number;
  parent?: string;
  orbit?: SimpleElements;
  description: string;
  facts: Record<string, string>;
  discovered?: string;
}

function blackHoleBody(o: BlackHoleBodyOpts): BodyData {
  return {
    id: o.id,
    name: o.name,
    type: 'blackhole',
    parent: o.parent,
    radius: schwarzschildKm(o.massSolar),
    mass: o.massSolar * SUN_MASS_KG,
    rotationPeriod: 24,
    pole: o.pole,
    orbit: o.orbit,
    appearance: { kind: 'blackhole', seed: o.id.length * 7 + 3, disk: o.disk, diskAbsMag: o.diskAbsMag },
    description: o.description,
    discovered: o.discovered,
    facts: o.facts,
  };
}

/** Hand-made companion / S-star body (no procedural planets) */
export function starBody(id: string, name: string, massSolar: number, radiusSolar: number, temperature: number, description: string, facts: Record<string, string>, extra: Partial<BodyData> = {}): BodyData {
  return {
    id, name, type: 'star',
    radius: radiusSolar * SUN_RADIUS_KM,
    mass: massSolar * SUN_MASS_KG,
    rotationPeriod: 400,
    pole: { ra: 120, dec: 40 },
    appearance: { kind: 'star', temperature, seed: (id.length * 31) % 997 + 5 },
    temperature,
    description,
    facts,
    ...extra,
  };
}

/** Minimal StarInfo for a system whose primary is not in the HYG catalogue */
export function syntheticInfo(name: string, positionPc: Vector3, massSolar: number, radiusSolar: number, temperature: number, luminosity: number, spectral: string): StarInfo {
  const absMag = 4.83 - 2.5 * Math.log10(Math.max(luminosity, 1e-9));
  const d = positionPc.length();
  return {
    index: -1, name, names: null, hip: 0,
    position: positionPc.clone(), distancePc: d,
    mag: absMag + 5 * Math.log10(Math.max(d, 1e-3) / 10), absMag,
    bv: 0.6, temperature, luminosity, radiusSolar, radiusKm: radiusSolar * SUN_RADIUS_KM,
    massSolar, massKg: massSolar * SUN_MASS_KG, spectral, lumClass: 5, catalogSpectral: spectral, isWhiteDwarf: false,
  };
}

/* ------------------------------------------------------------------------------------------ */

/** A black hole and where it lives */
export interface BlackHoleEntry {
  /** universal id: `b{n}` for stand-alone systems */
  id: string;
  name: string;
  massSolar: number;
  /** body id inside its system */
  bodyId: string;
  /** host: a HYG catalogue star (search ref), or a stand-alone system around `position` */
  host: { kind: 'catalog'; starRef: string; hostName?: string } | { kind: 'system'; positionPc: (ctx: PositionContext) => Vector3 };
  /** bodies of a stand-alone system (root first) */
  bodies?: () => BodyData[];
  /** StarInfo of the primary for stand-alone systems */
  info?: (positionPc: Vector3) => StarInfo;
  /** galaxy index the system belongs to (0 = Milky Way) */
  galaxy?: (ctx: PositionContext) => number;
  /** body appended to a catalogue star's generated system */
  companionBody?: (starBodyId: string, starMassKg: number) => BodyData;
  summary: string;
}

export interface PositionContext {
  milkyWayCenterPc: () => Vector3;
  galaxyPositionPc: (nameSubstring: string) => { index: number; position: Vector3 } | null;
  /** 3D point of a sky position inside a galaxy: sightline ∩ galaxy disc plane (pc) */
  galaxyPlanePoint: (nameSubstring: string, ra: number, dec: number) => Vector3;
}

const SGR_A: PoleRaDec = { ra: 266.4168, dec: -29.0078 };
const EPOCH_2020 = decimalYearJd(2020.0);

function sStar(id: string, name: string, massSolar: number, radiusSolar: number, temperature: number,
  aArcsec: number, e: number, i: number, Omega: number, omega: number, periodYr: number, tPeri: number, note: string): BodyData {
  const el = skyElementsToEcliptic(SGR_A.ra, SGR_A.dec, i, Omega, omega);
  const aKm = aArcsec * 8178 * AU_KM; // 1″ at 8.178 kpc = 8178 AU
  return starBody(id, name, massSolar, radiusSolar, temperature,
    `${note} Yörünge elemanları GRAVITY/VLT ve Keck astrometrisinden (gökyüzü düzlemi → ekliptik dönüşümü ile).`,
    { 'Yörünge periyodu': _('{n} yıl', { n: fixed(periodYr, 2) }), 'Dış merkezlik': fixed(e, 3), 'Pericentre geçişi': fmtNum(tPeri, { useGrouping: false, minimumFractionDigits: 2, maximumFractionDigits: 2 }) },
    {
      parent: 'sgra',
      orbit: { kind: 'simple', a: aKm, e, i: el.i, node: el.node, argPeri: el.argPeri, M0: 0, epoch: decimalYearJd(tPeri), period: periodYr * YEAR_D, frame: 'ecliptic' },
    });
}

/** Stellar-mass black hole with a luminous companion in another galaxy (X-ray binary) */
function xrayBinary(o: {
  id: string; name: string; galaxy: string; ra: number; dec: number; massSolar: number; summary: string;
  companion: { name: string; massSolar: number; radiusSolar: number; temperature: number; spectral: string; luminosity: number };
  periodDays: number; inc: number; node: number; disk: Disk; diskAbsMag: number; description: string; facts: Record<string, string>; discovered?: string;
}): BlackHoleEntry {
  const c = o.companion;
  return {
    id: o.id, name: o.name, massSolar: o.massSolar, bodyId: o.id,
    host: { kind: 'system', positionPc: (ctx) => ctx.galaxyPlanePoint(o.galaxy, o.ra, o.dec) },
    galaxy: (ctx) => ctx.galaxyPositionPc(o.galaxy)?.index ?? 0,
    summary: o.summary,
    info: (p) => syntheticInfo(o.name, p, c.massSolar, c.radiusSolar, c.temperature, c.luminosity, c.spectral),
    bodies: () => [
      starBody(`${o.id}-star`, c.name, c.massSolar, c.radiusSolar, c.temperature,
        `${o.name} kara deliğinin yoldaş yıldızı; Roche lobundan taşan gaz kara deliğin akreasyon diskini besler.`,
        { 'Tayf': c.spectral, 'Kütle': `~${c.massSolar} M☉` }),
      blackHoleBody({
        id: o.id, name: o.name, massSolar: o.massSolar, parent: `${o.id}-star`,
        pole: { ra: o.ra, dec: o.dec + 60 > 90 ? o.dec - 60 : o.dec + 60 },
        disk: o.disk, diskAbsMag: o.diskAbsMag,
        orbit: {
          kind: 'simple', a: semiMajorKm(o.periodDays, (c.massSolar + o.massSolar) * SUN_MASS_KG), e: 0, i: o.inc, node: o.node, argPeri: 0, M0: 0,
          epoch: EPOCH_2020, period: o.periodDays, frame: 'ecliptic',
        },
        description: o.description, facts: o.facts, discovered: o.discovered,
      }),
    ],
  };
}

/** Supermassive black hole at the centre of a catalogue galaxy */
function galaxyCore(o: { id: string; name: string; galaxy: string; massSolar: number; pole: PoleRaDec; disk: Disk; diskAbsMag: number; summary: string; description: string; facts: Record<string, string>; discovered?: string }): BlackHoleEntry {
  return {
    id: o.id, name: o.name, massSolar: o.massSolar, bodyId: o.id,
    host: { kind: 'system', positionPc: (ctx) => ctx.galaxyPositionPc(o.galaxy)?.position ?? new Vector3() },
    galaxy: (ctx) => ctx.galaxyPositionPc(o.galaxy)?.index ?? 0,
    summary: o.summary,
    info: (p) => syntheticInfo(o.name, p, o.massSolar, 0, 1, 1e-4, 'SMBH'),
    bodies: () => [blackHoleBody({ id: o.id, name: o.name, massSolar: o.massSolar, pole: o.pole, disk: o.disk, diskAbsMag: o.diskAbsMag, description: o.description, facts: o.facts, discovered: o.discovered })],
  };
}

export const BLACK_HOLES: BlackHoleEntry[] = [
  {
    id: 'b0', name: 'Sagittarius A*', massSolar: 4.297e6, bodyId: 'sgra',
    host: { kind: 'system', positionPc: (c) => c.milkyWayCenterPc() },
    galaxy: () => 0,
    summary: 'Samanyolu\'nun merkezindeki süper kütleli kara delik',
    info: (p) => syntheticInfo('Sagittarius A*', p, 4.297e6, 0, 1, 1e-6, 'SMBH'),
    bodies: () => [
      blackHoleBody({
        id: 'sgra', name: 'Sagittarius A*', massSolar: 4.297e6,
        // disk / spin axis: EHT favours a nearly face-on view (i ≲ 30°)
        pole: { ra: 86.4, dec: 52 },
        disk: { inner: 3, outer: 14, temperature: 9000, brightness: 0.55 },
        diskAbsMag: 2.0,
        description: 'Samanyolu\'nun dinamik merkezi: 4,3 milyon güneş kütleli süper kütleli kara delik. Etrafındaki S-yıldızlarının (S2, S38, S55) yörüngeleri kütlesini doğrudan ölçmemizi sağladı; 2022\'de Event Horizon Telescope gölgesini görüntüledi. Olay ufku 12,7 milyon km (Güneş yarıçapının ~18 katı), gölgesi gökyüzünde 52 mikro-yay saniyesi.',
        discovered: '1974 (Balick & Brown, radyo)',
        facts: {
          'Kütle': '4,297 × 10⁶ M☉',
          'Uzaklık': '8 178 pc (26 700 ışık yılı)',
          'Gölge çapı': '~52 µas (EHT 2022)',
          'Nobel': '2020 — Genzel & Ghez (S-yıldızı yörüngeleri)',
          'Durum': 'Sessiz (düşük akreasyon)',
        },
      }),
      sStar('s2', 'S2', 14, 7, 28_000, 0.12540, 0.88466, 134.567, 228.171, 66.263, 16.0518, 2018.379,
        'Sgr A*\'a 2018\'de 120 AU\'ya (ışık hızının %2,7\'si) yaklaşan B-türü yıldız; Schwarzschild presesyonu ve kütleçekimsel kırmızıya kayma ilk kez onun yörüngesinde ölçüldü.'),
      sStar('s38', 'S38', 10, 5, 22_000, 0.1406, 0.8201, 171.1, 101.06, 17.99, 19.2, 2003.19,
        'Neredeyse gökyüzü düzleminde, 19 yıllık yörüngesiyle Sgr A* kütlesini sınırlayan ikinci referans yıldız.'),
      sStar('s55', 'S55 (S0-102)', 9, 4.5, 20_000, 0.1078, 0.7209, 150.1, 325.5, 331.5, 12.80, 2009.34,
        'Bilinen en kısa periyotlu S-yıldızlarından biri: Sgr A* etrafında 12,8 yılda bir tur.'),
    ],
  },
  {
    id: 'b1', name: 'M87*', massSolar: 6.5e9, bodyId: 'm87star',
    host: { kind: 'system', positionPc: (c) => c.galaxyPositionPc('M87')?.position ?? new Vector3() },
    galaxy: (c) => c.galaxyPositionPc('M87')?.index ?? 0,
    summary: 'İlk görüntülenen kara delik (EHT 2019), Virgo A merkezi',
    info: (p) => syntheticInfo('M87*', p, 6.5e9, 0, 1, 1e-4, 'SMBH'),
    bodies: () => [
      blackHoleBody({
        id: 'm87star', name: 'M87*', massSolar: 6.5e9,
        // jet axis ~17° from the line of sight (toward us)
        pole: { ra: 10, dec: -4 },
        disk: { inner: 3, outer: 16, temperature: 7500, brightness: 0.9 },
        diskAbsMag: -8,
        description: 'Virgo A (M87) galaksisinin merkezindeki 6,5 milyar güneş kütleli dev; olay ufku 38 milyar km (Plüton yörüngesinin ~6 katı). 2019\'da Event Horizon Telescope\'un yayımladığı ilk kara delik görüntüsü budur: parlak fotonların halkası ve ortadaki gölge. 5 000 ışık yılı uzunluğunda göreli bir jet fırlatır.',
        discovered: '1918 (jet, Curtis) · 2019 (gölge, EHT)',
        facts: {
          'Kütle': '6,5 × 10⁹ M☉',
          'Uzaklık': '16,4 Mpc (53,5 milyon ışık yılı)',
          'Gölge çapı': '~42 µas (EHT 2019)',
          'Jet': '~5 000 ışık yılı, ışık hızının %99\'u',
          'Durum': 'Aktif galaksi çekirdeği',
        },
      }),
    ],
  },
  {
    id: 'cygx1', name: 'Cygnus X-1', massSolar: 21.2, bodyId: 'cygx1',
    host: { kind: 'catalog', starRef: 'HIP 98298', hostName: 'HDE 226868' },
    summary: 'Keşfedilen ilk kara delik — HDE 226868 ile X-ışını çifti',
    companionBody: (starId, starMassKg) => blackHoleBody({
      id: 'cygx1', name: 'Cygnus X-1', massSolar: 21.2, parent: starId,
      pole: { ra: 299.59, dec: 35.2 },
      disk: { inner: 3, outer: 28, temperature: 30_000, brightness: 1.6 },
      diskAbsMag: -3,
      orbit: {
        kind: 'simple', a: semiMajorKm(5.599829, starMassKg + 21.2 * SUN_MASS_KG), e: 0.018, i: 27.1, node: 0, argPeri: 0, M0: 0,
        epoch: EPOCH_2020, period: 5.599829, frame: 'ecliptic',
      },
      description: '1964\'te roketle keşfedilen X-ışını kaynağı; 1971\'de mavi süperdev HDE 226868\'in görünmez 21 güneş kütleli eşi olarak tanımlanan ilk kara delik adayı. Yoldaşından çektiği gaz akreasyon diskinde milyonlarca dereceye ısınır ve X-ışını yayar. Hawking ile Thorne\'un ünlü iddiasının konusuydu.',
      discovered: '1964 (Aerobee roketi) · 1971 (kara delik tanımı)',
      facts: {
        'Kütle': '21,2 M☉',
        'Yoldaş': 'HDE 226868 — O9.7 Iab mavi süperdev, ~40 M☉',
        'Yörünge periyodu': '5,6 gün',
        'Uzaklık': '2 220 pc (7 240 ışık yılı)',
        'Dönüş': 'a* > 0,99 (neredeyse maksimum)',
      },
    }),
  },
  {
    id: 'b2', name: 'Gaia BH1', massSolar: 9.62, bodyId: 'gaiabh1',
    host: { kind: 'system', positionPc: () => raDecToScene(262.1711, -0.5811).multiplyScalar(480) },
    galaxy: () => 0,
    summary: 'Bize en yakın bilinen kara delik — sessiz, disksiz (sadece mercekleme)',
    info: (p) => syntheticInfo('Gaia BH1', p, 0.93, 0.99, 5850, 1.0, 'G V'),
    bodies: () => [
      starBody('gaiabh1-star', 'Gaia BH1 (yoldaş yıldız)', 0.93, 0.99, 5850,
        'Güneş benzeri G türü yıldız; Gaia uydusunun astrometrik "sallantısı" görünmez 9,6 güneş kütleli bir eşi ortaya çıkardı.',
        { 'Tayf': 'G V', 'Kütle': '0,93 M☉', 'Görünür parlaklık': '13,8' }),
      blackHoleBody({
        id: 'gaiabh1', name: 'Gaia BH1', massSolar: 9.62, parent: 'gaiabh1-star',
        pole: { ra: 200, dec: 30 },
        disk: { inner: 3, outer: 8, temperature: 3000, brightness: 0 },
        diskAbsMag: 30,
        orbit: {
          kind: 'simple', a: semiMajorKm(185.59, (0.93 + 9.62) * SUN_MASS_KG), e: 0.451, i: 126.6, node: 97.8, argPeri: 12.8, M0: 0,
          epoch: EPOCH_2020, period: 185.59, frame: 'ecliptic',
        },
        description: 'Dünya\'ya en yakın bilinen kara delik (1 560 ışık yılı). Hiç madde yutmadığı için diski ve X-ışını yok; varlığı yalnızca yoldaş yıldızın yörüngesinden biliniyor (Gaia DR3, El-Badry ve ark. 2023). Burada da yalnızca arka plandaki yıldızları büken kütleçekimsel mercekleme ve 28 km\'lik olay ufkunun gölgesi görülür.',
        discovered: '2022 (Gaia DR3 astrometrisi)',
        facts: {
          'Kütle': '9,62 M☉',
          'Uzaklık': '480 pc (1 560 ışık yılı)',
          'Yörünge periyodu': '185,6 gün',
          'Ayrıklık': '1,4 AU',
          'Durum': 'Uykuda — akreasyon yok',
        },
      }),
    ],
  },
  {
    id: 'b3', name: 'V404 Cygni', massSolar: 9.0, bodyId: 'v404',
    host: { kind: 'system', positionPc: () => raDecToScene(306.0159, 33.8672).multiplyScalar(2390) },
    galaxy: () => 0,
    summary: '2015 patlamasıyla ünlü X-ışını novası',
    info: (p) => syntheticInfo('V404 Cygni', p, 0.7, 6.0, 4800, 16, 'K0 IV'),
    bodies: () => [
      starBody('v404-star', 'V404 Cygni (yoldaş yıldız)', 0.7, 6.0, 4800,
        'Roche lobunu dolduran K türü alt dev; 6,5 günde bir kara deliğin etrafında döner ve ona madde aktarır.',
        { 'Tayf': 'K0 IV', 'Kütle': '~0,7 M☉' }),
      blackHoleBody({
        id: 'v404', name: 'V404 Cygni', massSolar: 9.0, parent: 'v404-star',
        pole: { ra: 306, dec: 60 },
        disk: { inner: 3, outer: 30, temperature: 14_000, brightness: 1.2 },
        diskAbsMag: -1,
        orbit: {
          kind: 'simple', a: semiMajorKm(6.4714, (0.7 + 9.0) * SUN_MASS_KG), e: 0, i: 67, node: 40, argPeri: 0, M0: 0,
          epoch: EPOCH_2020, period: 6.4714, frame: 'ecliptic',
        },
        description: 'Kuğu takımyıldızındaki düşük kütleli X-ışını çifti. 1989 ve 2015\'teki patlamalarında birkaç gün içinde gökyüzünün en parlak X-ışını kaynağı oldu; 2015\'te jetlerinin saniyeler içinde yön değiştirdiği (presesyon) görüldü. Uzaklığı radyo paralaksıyla doğrudan ölçülen ilk kara delik.',
        discovered: '1989 (Ginga uydusu patlaması)',
        facts: {
          'Kütle': '9,0 M☉',
          'Uzaklık': '2 390 pc (7 800 ışık yılı)',
          'Yörünge periyodu': '6,47 gün',
          'Patlamalar': '1938, 1956, 1989, 2015',
        },
      }),
    ],
  },
  {
    id: 'b4', name: 'A0620-00', massSolar: 6.6, bodyId: 'a0620',
    host: { kind: 'system', positionPc: () => raDecToScene(95.6855, -0.3458).multiplyScalar(1060) },
    galaxy: () => 0,
    summary: 'Tekboynuz\'da sessiz bir X-ışını novası (V616 Mon)',
    info: (p) => syntheticInfo('A0620-00', p, 0.4, 0.67, 4200, 0.08, 'K5 V'),
    bodies: () => [
      starBody('a0620-star', 'V616 Monocerotis (yoldaş yıldız)', 0.4, 0.67, 4200,
        'K türü cüce; 7,75 saatlik yörüngesinde kara deliğe sürekli gaz kaybeder.',
        { 'Tayf': 'K5 V', 'Kütle': '~0,4 M☉' }),
      blackHoleBody({
        id: 'a0620', name: 'A0620-00', massSolar: 6.6, parent: 'a0620-star',
        pole: { ra: 95, dec: 51 },
        disk: { inner: 3, outer: 26, temperature: 6500, brightness: 0.35 },
        diskAbsMag: 4,
        orbit: {
          kind: 'simple', a: semiMajorKm(0.32301, (0.4 + 6.6) * SUN_MASS_KG), e: 0, i: 51, node: 300, argPeri: 0, M0: 0,
          epoch: EPOCH_2020, period: 0.32301, frame: 'ecliptic',
        },
        description: '1975\'te Ariel 5 uydusunun yakaladığı patlamayla keşfedilen X-ışını novası; patlamadan sonra sönümlenmesi yoldaş yıldızın yörüngesinin ölçülmesini ve 1986\'da kütle fonksiyonuyla kara delik olduğunun kesinleşmesini sağladı. Uzun süre bilinen en yakın kara delikti.',
        discovered: '1975 (Ariel 5) · 1986 (kütle ölçümü, McClintock & Remillard)',
        facts: {
          'Kütle': '6,6 M☉',
          'Uzaklık': '1 060 pc (3 460 ışık yılı)',
          'Yörünge periyodu': '7,75 saat',
          'Durum': 'Sessiz (zayıf disk)',
        },
      }),
    ],
  },
  xrayBinary({
    id: 'lmcx1', name: 'LMC X-1', galaxy: 'Büyük Macellan', ra: 84.9117, dec: -69.7433, massSolar: 10.9,
    summary: 'Büyük Macellan Bulutu\'nda ilk galaksi dışı kara delik',
    companion: { name: 'LMC X-1 yoldaşı (O7 III)', massSolar: 31.8, radiusSolar: 17, temperature: 33_000, spectral: 'O7 III', luminosity: 3e5 },
    periodDays: 3.9092, inc: 36.4, node: 120, disk: { inner: 3, outer: 26, temperature: 28_000, brightness: 1.4 }, diskAbsMag: -4,
    description: '1969\'da keşfedilen, Büyük Macellan Bulutu\'ndaki sürekli parlak X-ışını çifti; Samanyolu dışında kütlesi ölçülen ilk kara deliklerden. Dev O yıldızından rüzgârla beslenen diski neredeyse hep "yumuşak" (termal) hâlde kalır.',
    discovered: '1969 (Uhuru öncesi roket uçuşları)',
    facts: { 'Kütle': '10,9 M☉', 'Yoldaş': 'O7 III, ~32 M☉', 'Yörünge periyodu': '3,91 gün', 'Uzaklık': '48 kpc (LMC)', 'Dönüş': 'a* ≈ 0,92' },
  }),
  xrayBinary({
    id: 'lmcx3', name: 'LMC X-3', galaxy: 'Büyük Macellan', ra: 84.7358, dec: -64.0836, massSolar: 6.98,
    summary: 'LMC\'de B yıldızıyla çift, dönüşü yavaş kara delik',
    companion: { name: 'LMC X-3 yoldaşı (B3 V)', massSolar: 3.63, radiusSolar: 4.3, temperature: 18_000, spectral: 'B3 V', luminosity: 1800 },
    periodDays: 1.7049, inc: 69.2, node: 20, disk: { inner: 3, outer: 24, temperature: 20_000, brightness: 1.0 }, diskAbsMag: -2,
    description: 'Büyük Macellan Bulutu\'nun kuzeyinde, Roche lobunu taşıran B yıldızından beslenen kara delik. Diski Samanyolu\'ndaki benzerlerine göre şaşırtıcı derecede kararlı; kara delik dönüşü ölçülen ilk nesnelerden (a* ≈ 0,25).',
    discovered: '1971 (Uhuru)',
    facts: { 'Kütle': '6,98 M☉', 'Yoldaş': 'B3 V, ~3,6 M☉', 'Yörünge periyodu': '1,70 gün', 'Uzaklık': '48 kpc (LMC)' },
  }),
  xrayBinary({
    id: 'm33x7', name: 'M33 X-7', galaxy: 'M33', ra: 23.392, dec: 30.537, massSolar: 15.65,
    summary: 'Üçgen Galaksisi\'nde tutulmalı dev X-ışını çifti',
    companion: { name: 'M33 X-7 yoldaşı (O7-8 III)', massSolar: 70, radiusSolar: 19.6, temperature: 35_000, spectral: 'O7-8 III', luminosity: 5e5 },
    periodDays: 3.4530, inc: 74.6, node: 200, disk: { inner: 3, outer: 26, temperature: 30_000, brightness: 1.5 }, diskAbsMag: -4,
    description: 'Üçgen Galaksisi\'nde (M33) 70 güneş kütleli dev bir yıldızın etrafında 3,45 günde dönen, yoldaşının arkasında düzenli olarak tutulan kara delik. Tutulmalar yörünge eğikliğini sabitlediği için kütlesi (15,65 M☉) sıra dışı bir kesinlikle ölçülmüştür.',
    discovered: '2007 (Orosz ve ark., Chandra + Gemini)',
    facts: { 'Kütle': '15,65 M☉', 'Yoldaş': 'O7-8 III, ~70 M☉', 'Yörünge periyodu': '3,45 gün (tutulmalı)', 'Uzaklık': '840 kpc (M33)' },
  }),
  galaxyCore({
    id: 'm31star', name: 'M31*', galaxy: 'Andromeda', massSolar: 1.4e8, pole: { ra: 100, dec: 15 },
    disk: { inner: 3, outer: 12, temperature: 5000, brightness: 0.12 }, diskAbsMag: 2,
    summary: 'Andromeda\'nın merkezindeki uykulu dev (140 milyon M☉)',
    description: 'Andromeda Galaksisi\'nin çekirdeğindeki 140 milyon güneş kütleli kara delik; Sgr A*\'dan 30 kat daha ağır ama o da neredeyse hiç beslenmiyor. Çevresinde Hubble\'ın keşfettiği eksantrik yaşlı yıldız diski (P1/P2 çift çekirdek) ve mavi genç yıldızlardan oluşan P3 kümesi döner.',
    discovered: '1988 (çift çekirdek, Lauer & Dressler), 2005 (kütle, Bender ve ark.)',
    facts: { 'Kütle': '1,4 × 10⁸ M☉', 'Uzaklık': '765 kpc', 'Durum': 'Çok düşük akreasyon (L ≈ 10⁻¹⁰ L_Edd)' },
  }),
  galaxyCore({
    id: 'cenastar', name: 'Centaurus A*', galaxy: 'Centaurus A', massSolar: 5.5e7, pole: { ra: 201.4, dec: 2 },
    disk: { inner: 3, outer: 18, temperature: 8000, brightness: 1.1 }, diskAbsMag: -9,
    summary: 'En yakın aktif galaksi çekirdeği; dev radyo jetleri',
    description: 'Centaurus A\'nın tozlu merkezinde saklı 55 milyon güneş kütleli aktif kara delik. Her iki yöne fırlattığı jetler gökyüzünde Ay\'ın 20 katı genişliğinde radyo lobları oluşturur; 2021\'de EHT jetin kaynağını kara delik ölçeğinde görüntüledi.',
    discovered: '1949 (radyo kaynağı)',
    facts: { 'Kütle': '5,5 × 10⁷ M☉', 'Uzaklık': '3,8 Mpc', 'Jet': '~1 Mpc radyo lobları', 'Durum': 'Aktif (radyo galaksisi)' },
  }),
  galaxyCore({
    id: 'm104star', name: 'Sombrero kara deliği', galaxy: 'Sombrero', massSolar: 1.0e9, pole: { ra: 190, dec: 78 },
    disk: { inner: 3, outer: 12, temperature: 6000, brightness: 0.25 }, diskAbsMag: -3,
    summary: 'Sombrero Galaksisi\'nin merkezi · 1 milyar M☉',
    description: 'Sombrero Galaksisi\'nin (M104) dev şişkinliğinin ortasında, Samanyolu merkezindekinden 230 kat daha ağır bir kara delik. Düşük parlaklıklı bir aktif çekirdek (LINER) olarak hafifçe besleniyor.',
    facts: { 'Kütle': '~1 × 10⁹ M☉', 'Uzaklık': '9,6 Mpc', 'Durum': 'Düşük parlaklıklı AGN' },
  }),
  galaxyCore({
    id: 'm106star', name: 'M106 kara deliği', galaxy: 'M106', massSolar: 4.0e7, pole: { ra: 185, dec: 20 },
    disk: { inner: 3, outer: 20, temperature: 7000, brightness: 0.8 }, diskAbsMag: -7,
    summary: 'Su maserleriyle en hassas ölçülen kara delik kütlesi',
    description: 'M106 (NGC 4258) merkezindeki kara deliğin etrafında, Kepler yasalarına kusursuz uyan su maseri bulutları döner. Bu disk hem kara deliğin kütlesini (40 milyon M☉) hem de galaksinin uzaklığını geometrik olarak verir; kozmik mesafe merdiveninin çapasıdır.',
    discovered: '1995 (Miyoshi ve ark., VLBA maser diski)',
    facts: { 'Kütle': '4,0 × 10⁷ M☉', 'Uzaklık': '7,2 Mpc (maser geometrisi)', 'Durum': 'Seyfert 2 / LINER' },
  }),
  galaxyCore({
    id: 'm81star', name: 'M81*', galaxy: 'Bode', massSolar: 7.0e7, pole: { ra: 150, dec: 30 },
    disk: { inner: 3, outer: 14, temperature: 6500, brightness: 0.5 }, diskAbsMag: -5,
    summary: 'Bode Galaksisi\'nin düşük parlaklıklı çekirdeği',
    description: 'M81\'in merkezindeki 70 milyon güneş kütleli kara delik; en yakın ve en iyi incelenen düşük parlaklıklı aktif çekirdeklerden biri, Sgr A* ile parlak kuasarlar arasında bir köprü.',
    facts: { 'Kütle': '7 × 10⁷ M☉', 'Uzaklık': '3,6 Mpc', 'Durum': 'Düşük parlaklıklı AGN' },
  }),
];
