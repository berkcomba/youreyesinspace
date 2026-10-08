import type { BodyData, JplElements, SimpleElements } from './types';
import type { GeneratedBelt } from '../gen/SystemGenerator';
import { J2000_JD } from '../core/constants';
import { SPACECRAFT } from './spacecraft';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function jpl(
  a: number, e: number, i: number, L: number, lonPeri: number, node: number,
  da: number, de: number, di: number, dL: number, dLonPeri: number, dNode: number,
): JplElements {
  return { kind: 'jpl', a, e, i, L, lonPeri, node, da, de, di, dL, dLonPeri, dNode };
}

function moonOrbit(
  a: number, e: number, i: number, period: number, M0: number,
  opts: Partial<SimpleElements> = {},
): SimpleElements {
  return {
    kind: 'simple', a, e, i, period, M0,
    node: opts.node ?? (M0 * 1.7) % 360,
    argPeri: opts.argPeri ?? (M0 * 2.3) % 360,
    epoch: J2000_JD,
    frame: opts.frame ?? 'parentEquator',
    nodeRate: opts.nodeRate,
    periRate: opts.periRate,
  };
}

function helio(a: number, e: number, i: number, node: number, argPeri: number, M0: number, period: number, epoch = J2000_JD): SimpleElements {
  return { kind: 'simple', a: a * 149597870.7, e, i, node, argPeri, M0, epoch, period, frame: 'ecliptic' };
}

const GRAY: [number, number, number] = [0.42, 0.41, 0.40];

/* ------------------------------------------------------------------ */
/*  Catalogue                                                          */
/* ------------------------------------------------------------------ */

export const SOLAR_SYSTEM: BodyData[] = [
  /* ---------------- Sun ---------------- */
  {
    id: 'sun', name: 'Güneş', type: 'star',
    radius: 695_700, mass: 1.9885e30, rotationPeriod: 609.12,
    pole: { ra: 286.13, dec: 63.87 },
    appearance: { kind: 'star', temperature: 5772, seed: 1 },
    temperature: 5772,
    description: 'Güneş Sistemi\'nin merkezindeki G2V sınıfı anakol yıldızı. Sistem kütlesinin %99.86\'sını içerir; çekirdeğinde hidrojen füzyonu ile saniyede ~4 milyon ton kütleyi enerjiye dönüştürür.',
    facts: { 'Spektral sınıf': 'G2V', 'Parlaklık': '1 L☉ (3.828×10²⁶ W)', 'Yaş': '~4.6 milyar yıl', 'Fotosfer sıcaklığı': '5772 K' },
  },

  /* ---------------- Mercury ---------------- */
  {
    id: 'mercury', name: 'Merkür', type: 'planet', parent: 'sun',
    radius: 2439.7, mass: 3.3011e23, albedo: 0.142, rotationPeriod: 1407.6,
    pole: { ra: 281.01, dec: 61.45 },
    orbit: jpl(0.38709927, 0.20563593, 7.00497902, 252.25032350, 77.45779628, 48.33076593,
      0.00000037, 0.00001906, -0.00594749, 149472.67411175, 0.16047689, -0.12534081),
    appearance: { kind: 'terrestrial', seed: 11, landLow: [0.30, 0.29, 0.28], landMid: [0.42, 0.41, 0.40], landHigh: [0.55, 0.54, 0.52], craters: 1.0, roughness: 1.2, variation: 0.3 },
    description: 'Güneş\'e en yakın ve en küçük gezegen. Kraterlerle kaplı yüzeyi Ay\'a benzer; 3:2 spin-yörünge rezonansı nedeniyle bir Merkür günü iki Merkür yılı sürer.',
    facts: { 'Sınıf': 'Karasal, kraterli', 'Yüzey sıcaklığı': '100–700 K', 'Uydular': '0' },
  },

  /* ---------------- Venus ---------------- */
  {
    id: 'venus', name: 'Venüs', type: 'planet', parent: 'sun',
    radius: 6051.8, mass: 4.8675e24, albedo: 0.689, rotationPeriod: -5832.5,
    pole: { ra: 272.76, dec: 67.16 },
    orbit: jpl(0.72333566, 0.00677672, 3.39467605, 181.97909950, 131.60246718, 76.67984255,
      0.00000390, -0.00004107, -0.00078890, 58517.81538729, 0.00268329, -0.27769418),
    appearance: { kind: 'terrestrial', seed: 21, landLow: [0.45, 0.30, 0.15], landMid: [0.62, 0.45, 0.25], landHigh: [0.80, 0.65, 0.40], craters: 0.1, roughness: 0.8, variation: 0.5 },
    atmosphere: { color: [0.95, 0.85, 0.60], height: 0.04, density: 1.6 },
    clouds: { seed: 22, color: [0.96, 0.90, 0.72], coverage: 1.0, height: 0.012, speed: 60, opacity: 0.97 },
    temperature: 737,
    description: 'Yoğun CO₂ atmosferi ve sülfürik asit bulutlarıyla kaplı, sera etkisi nedeniyle Güneş Sistemi\'nin en sıcak gezegeni. Retrograd döner: bir Venüs günü (243 gün) bir Venüs yılından uzundur.',
    facts: { 'Yüzey basıncı': '92 bar', 'Atmosfer': '%96.5 CO₂, %3.5 N₂', 'Uydular': '0' },
  },

  /* ---------------- Earth ---------------- */
  {
    id: 'earth', name: 'Dünya', type: 'planet', parent: 'sun',
    radius: 6371.0, flattening: 0.00335, mass: 5.97237e24, albedo: 0.306, rotationPeriod: 23.9345,
    // Greenwich meridian at J2000 (GMST 280.46°) measured from the local +X axis (RA 180°)
    primeMeridian: 100.46,
    pole: { ra: 0, dec: 90 },
    orbit: jpl(1.00000261, 0.01671123, -0.00001531, 100.46457166, 102.93768193, 0.0,
      0.00000562, -0.00004392, -0.01294668, 35999.37244981, 0.32327364, 0.0),
    appearance: { kind: 'terrestrial', seed: 31, ocean: [0.02, 0.10, 0.28], landLow: [0.12, 0.30, 0.10], landMid: [0.42, 0.36, 0.20], landHigh: [0.55, 0.52, 0.48], ice: [0.92, 0.95, 1.0], seaLevel: 0.55, iceCaps: 0.74, craters: 0, roughness: 1.0, cityLights: true, variation: 0.4 },
    atmosphere: { color: [0.30, 0.55, 1.0], height: 0.025, density: 1.0, sunsetColor: [1.0, 0.45, 0.2] },
    clouds: { seed: 32, color: [1, 1, 1], coverage: 0.5, height: 0.006, speed: 1.15, opacity: 0.88 },
    temperature: 288,
    description: 'Bilinen tek yaşam barındıran gezegen. Yüzeyinin %71\'i sıvı su ile kaplı; azot-oksijen atmosferi ve manyetik alanı yüzeyi Güneş rüzgârından korur.',
    facts: { 'Atmosfer': '%78 N₂, %21 O₂', 'Uydular': '1 (Ay)', 'Yörünge hızı': '29.78 km/s' },
  },
  {
    id: 'moon', name: 'Ay', type: 'moon', parent: 'earth',
    radius: 1737.4, mass: 7.342e22, albedo: 0.136, rotationPeriod: 'sync',
    orbit: moonOrbit(384_400, 0.0549, 5.145, 27.321661, 135.27, { frame: 'ecliptic', node: 125.08, argPeri: 318.15, nodeRate: -0.0529539, periRate: 0.1114041 }),
    appearance: { kind: 'terrestrial', seed: 33, landLow: [0.22, 0.22, 0.23], landMid: [0.38, 0.38, 0.38], landHigh: [0.58, 0.57, 0.55], craters: 1.0, roughness: 1.0, variation: 0.6 },
    description: 'Dünya\'nın tek doğal uydusu ve Güneş Sistemi\'nin beşinci büyük uydusu. Kilitli dönüş nedeniyle hep aynı yüzünü Dünya\'ya gösterir.',
    facts: { 'Yüzey çekimi': '1.62 m/s²', 'Ortalama uzaklık': '384 400 km' },
  },

  /* ---------------- Mars ---------------- */
  {
    id: 'mars', name: 'Mars', type: 'planet', parent: 'sun',
    radius: 3389.5, flattening: 0.00589, mass: 6.4171e23, albedo: 0.25, rotationPeriod: 24.6229,
    // IAU W0 = 176.63° from the ICRF node, re-expressed in the ecliptic pole basis
    primeMeridian: 135.77,
    pole: { ra: 317.68, dec: 52.89 },
    orbit: jpl(1.52371034, 0.09339410, 1.84969142, -4.55343205, -23.94362959, 49.55953891,
      0.00001847, 0.00007882, -0.00813131, 19140.30268499, 0.44441088, -0.29257343),
    appearance: { kind: 'terrestrial', seed: 41, landLow: [0.40, 0.16, 0.08], landMid: [0.72, 0.34, 0.14], landHigh: [0.85, 0.58, 0.38], ice: [0.95, 0.93, 0.90], iceCaps: 0.88, craters: 0.6, roughness: 1.1, variation: 0.6 },
    atmosphere: { color: [0.85, 0.60, 0.45], height: 0.02, density: 0.35 },
    temperature: 210,
    description: 'Demir oksitle kızıla boyanmış çöl gezegeni. Güneş Sistemi\'nin en yüksek dağı Olympus Mons ve en uzun kanyonu Valles Marineris burada bulunur.',
    facts: { 'Atmosfer': '%95 CO₂ (6 mbar)', 'Uydular': '2 (Phobos, Deimos)' },
  },
  {
    id: 'phobos', name: 'Phobos', type: 'moon', parent: 'mars',
    radius: 11.1, mass: 1.0659e16, albedo: 0.071, rotationPeriod: 'sync',
    orbit: moonOrbit(9376, 0.0151, 1.08, 0.31891, 40),
    appearance: { kind: 'terrestrial', seed: 42, landLow: [0.18, 0.17, 0.16], landMid: [0.30, 0.28, 0.26], landHigh: [0.42, 0.40, 0.38], craters: 1.0, roughness: 1.4, variation: 0.3 },
    description: 'Mars\'ın büyük ve iç uydusu. Mars\'a o kadar yakındır ki gelgit kuvvetleri onu ~50 milyon yıl içinde parçalayacak veya yüzeye düşürecek.',
  },
  {
    id: 'deimos', name: 'Deimos', type: 'moon', parent: 'mars',
    radius: 6.2, mass: 1.4762e15, albedo: 0.068, rotationPeriod: 'sync',
    orbit: moonOrbit(23_463, 0.0002, 1.79, 1.26244, 200),
    appearance: { kind: 'terrestrial', seed: 43, landLow: [0.20, 0.19, 0.18], landMid: [0.32, 0.31, 0.30], landHigh: [0.44, 0.42, 0.40], craters: 0.6, roughness: 1.2, variation: 0.3 },
    description: 'Mars\'ın küçük dış uydusu. Regolitle yumuşamış kraterli yüzeye sahip, muhtemelen yakalanmış bir asteroit.',
  },

  /* ---------------- Jupiter ---------------- */
  {
    id: 'jupiter', name: 'Jüpiter', type: 'planet', parent: 'sun',
    radius: 69_911, flattening: 0.06487, mass: 1.8982e27, albedo: 0.503, rotationPeriod: 9.925,
    pole: { ra: 268.06, dec: 64.50 },
    orbit: jpl(5.20288700, 0.04838624, 1.30439695, 34.39644051, 14.72847983, 100.47390909,
      -0.00011607, -0.00013253, -0.00183714, 3034.74612775, 0.21252668, 0.20469106),
    appearance: {
      kind: 'gas', seed: 51, bandFreq: 13.0, turbulence: 0.9,
      bands: [[0.86, 0.78, 0.64], [0.58, 0.38, 0.26], [0.92, 0.86, 0.74], [0.42, 0.25, 0.17], [0.76, 0.62, 0.48], [0.52, 0.32, 0.22]],
      storm: [-22, 20, 0.11, 0.70, 0.28, 0.16],
    },
    atmosphere: { color: [0.9, 0.8, 0.7], height: 0.015, density: 0.5 },
    temperature: 165,
    description: 'Güneş Sistemi\'nin en büyük gezegeni; diğer tüm gezegenlerin toplam kütlesinin 2.5 katı. Büyük Kırmızı Leke en az 350 yıldır süren dev bir antisiklondur.',
    facts: { 'Bileşim': '%90 H₂, %10 He', 'Uydular': '95+', 'Manyetik alan': 'Dünya\'nın 20 000 katı' },
  },
  {
    id: 'io', name: 'Io', type: 'moon', parent: 'jupiter',
    radius: 1821.6, mass: 8.9319e22, albedo: 0.63, rotationPeriod: 'sync',
    orbit: moonOrbit(421_800, 0.0041, 0.05, 1.769138, 10),
    appearance: { kind: 'terrestrial', seed: 52, landLow: [0.85, 0.75, 0.30], landMid: [0.95, 0.88, 0.55], landHigh: [0.60, 0.35, 0.15], craters: 0, roughness: 0.9, volcanic: true, variation: 1.0 },
    description: 'Güneş Sistemi\'nin jeolojik olarak en aktif cismi: 400\'den fazla aktif yanardağ. Jüpiter\'in gelgit ısıtması sülfür bileşikleriyle rengârenk bir yüzey yaratır.',
  },
  {
    id: 'europa', name: 'Europa', type: 'moon', parent: 'jupiter',
    radius: 1560.8, mass: 4.7998e22, albedo: 0.67, rotationPeriod: 'sync',
    orbit: moonOrbit(671_100, 0.0094, 0.47, 3.551181, 120),
    appearance: { kind: 'terrestrial', seed: 53, landLow: [0.60, 0.42, 0.32], landMid: [0.88, 0.86, 0.84], landHigh: [0.97, 0.97, 0.98], craters: 0.05, roughness: 0.4, variation: 0.8 },
    description: 'Buz kabuğunun altında Dünya\'nın tüm okyanuslarından fazla sıvı su barındırdığı düşünülen uydu. Yüzeyi çizgi ve çatlaklarla kaplı, çok az kraterli.',
  },
  {
    id: 'ganymede', name: 'Ganymede', type: 'moon', parent: 'jupiter',
    radius: 2634.1, mass: 1.4819e23, albedo: 0.43, rotationPeriod: 'sync',
    orbit: moonOrbit(1_070_400, 0.0013, 0.20, 7.154553, 250),
    appearance: { kind: 'terrestrial', seed: 54, landLow: [0.30, 0.27, 0.25], landMid: [0.48, 0.45, 0.42], landHigh: [0.72, 0.72, 0.72], craters: 0.5, roughness: 0.9, variation: 0.9 },
    description: 'Güneş Sistemi\'nin en büyük uydusu; Merkür\'den büyüktür. Kendi manyetik alanına sahip bilinen tek uydudur.',
  },
  {
    id: 'callisto', name: 'Callisto', type: 'moon', parent: 'jupiter',
    radius: 2410.3, mass: 1.0759e23, albedo: 0.22, rotationPeriod: 'sync',
    orbit: moonOrbit(1_882_700, 0.0074, 0.19, 16.689018, 300),
    appearance: { kind: 'terrestrial', seed: 55, landLow: [0.15, 0.14, 0.13], landMid: [0.30, 0.28, 0.26], landHigh: [0.62, 0.62, 0.62], craters: 1.0, roughness: 1.0, variation: 0.5 },
    description: 'Güneş Sistemi\'nin en yoğun kraterlenmiş yüzeyi. Jeolojik olarak ölü, ~4 milyar yıllık antik bir yüzey.',
  },

  /* ---------------- Saturn ---------------- */
  {
    id: 'saturn', name: 'Satürn', type: 'planet', parent: 'sun',
    radius: 58_232, flattening: 0.09796, mass: 5.6834e26, albedo: 0.342, rotationPeriod: 10.656,
    pole: { ra: 40.59, dec: 83.54 },
    orbit: jpl(9.53667594, 0.05386179, 2.48599187, 49.95424423, 92.59887831, 113.66242448,
      -0.00125060, -0.00050991, 0.00193609, 1222.49362201, -0.41897216, -0.28867794),
    appearance: {
      kind: 'gas', seed: 61, bandFreq: 11.0, turbulence: 0.35,
      bands: [[0.92, 0.84, 0.62], [0.78, 0.68, 0.46], [0.96, 0.90, 0.72], [0.70, 0.60, 0.42], [0.88, 0.80, 0.60]],
    },
    atmosphere: { color: [0.95, 0.9, 0.75], height: 0.015, density: 0.45 },
    rings: { inner: 74_500, outer: 140_220, color: [0.82, 0.76, 0.66], opacity: 0.95, seed: 62, gaps: [[117_500, 4_700], [133_590, 325], [90_000, 1_200]] },
    temperature: 134,
    description: 'Görkemli halka sistemiyle tanınan gaz devi. Halkalar çoğunlukla su buzundan oluşur ve 280 000 km çapa yayılsalar da ortalama kalınlıkları yalnızca ~10 metredir.',
    facts: { 'Yoğunluk': '0.687 g/cm³ (sudan az)', 'Uydular': '146+', 'Halka kütlesi': '~1.5×10¹⁹ kg' },
  },
  {
    id: 'mimas', name: 'Mimas', type: 'moon', parent: 'saturn',
    radius: 198.2, mass: 3.7493e19, albedo: 0.96, rotationPeriod: 'sync',
    orbit: moonOrbit(185_540, 0.0196, 1.57, 0.942422, 15),
    appearance: { kind: 'terrestrial', seed: 63, landLow: [0.55, 0.55, 0.56], landMid: [0.75, 0.75, 0.76], landHigh: [0.92, 0.92, 0.93], craters: 1.0, roughness: 1.4, variation: 0.2 },
    description: '130 km çapındaki Herschel krateri ile "Ölüm Yıldızı"na benzeyen buzlu uydu.',
  },
  {
    id: 'enceladus', name: 'Enceladus', type: 'moon', parent: 'saturn',
    radius: 252.1, mass: 1.0802e20, albedo: 0.99, rotationPeriod: 'sync',
    orbit: moonOrbit(238_040, 0.0047, 0.01, 1.370218, 75),
    appearance: { kind: 'terrestrial', seed: 64, landLow: [0.80, 0.85, 0.90], landMid: [0.92, 0.95, 0.98], landHigh: [1.0, 1.0, 1.0], craters: 0.2, roughness: 0.5, variation: 0.3 },
    description: 'Güney kutbundan su buharı ve buz püskürten gayzerlere sahip; yüzey altı okyanusu astrobiyolojinin öncelikli hedeflerinden. Güneş Sistemi\'nin en yansıtıcı cismi.',
  },
  {
    id: 'tethys', name: 'Tethys', type: 'moon', parent: 'saturn',
    radius: 531.1, mass: 6.1745e20, albedo: 0.80, rotationPeriod: 'sync',
    orbit: moonOrbit(294_670, 0.0001, 1.09, 1.887802, 140),
    appearance: { kind: 'terrestrial', seed: 65, landLow: [0.62, 0.63, 0.65], landMid: [0.80, 0.81, 0.83], landHigh: [0.95, 0.95, 0.96], craters: 0.8, roughness: 1.0, variation: 0.3 },
    description: 'Neredeyse tamamen su buzundan oluşan uydu. Ithaca Chasma adlı dev vadi çevresinin dörtte üçünü dolaşır.',
  },
  {
    id: 'dione', name: 'Dione', type: 'moon', parent: 'saturn',
    radius: 561.4, mass: 1.0955e21, albedo: 0.70, rotationPeriod: 'sync',
    orbit: moonOrbit(377_420, 0.0022, 0.03, 2.736915, 210),
    appearance: { kind: 'terrestrial', seed: 66, landLow: [0.55, 0.56, 0.58], landMid: [0.76, 0.77, 0.79], landHigh: [0.93, 0.93, 0.95], craters: 0.7, roughness: 0.9, variation: 0.4 },
    description: 'Parlak buz uçurumlarıyla ("wispy terrain") tanınan buzlu uydu.',
  },
  {
    id: 'rhea', name: 'Rhea', type: 'moon', parent: 'saturn',
    radius: 763.8, mass: 2.3065e21, albedo: 0.65, rotationPeriod: 'sync',
    orbit: moonOrbit(527_070, 0.0010, 0.33, 4.5175, 290),
    appearance: { kind: 'terrestrial', seed: 67, landLow: [0.55, 0.56, 0.57], landMid: [0.74, 0.75, 0.76], landHigh: [0.90, 0.90, 0.91], craters: 0.9, roughness: 1.0, variation: 0.3 },
    description: 'Satürn\'ün ikinci büyük uydusu; yoğun kraterli buz yüzeyi.',
  },
  {
    id: 'titan', name: 'Titan', type: 'moon', parent: 'saturn',
    radius: 2574.7, mass: 1.3452e23, albedo: 0.22, rotationPeriod: 'sync',
    orbit: moonOrbit(1_221_870, 0.0288, 0.31, 15.945421, 330),
    appearance: { kind: 'terrestrial', seed: 68, ocean: [0.10, 0.08, 0.05], landLow: [0.35, 0.25, 0.12], landMid: [0.55, 0.40, 0.20], landHigh: [0.70, 0.58, 0.38], seaLevel: 0.42, craters: 0.05, roughness: 0.6, variation: 0.6 },
    atmosphere: { color: [0.95, 0.65, 0.30], height: 0.10, density: 1.6 },
    clouds: { seed: 69, color: [0.90, 0.62, 0.30], coverage: 1.0, height: 0.04, speed: 1.5, opacity: 0.92 },
    temperature: 94,
    description: 'Yoğun azot atmosferine sahip tek uydu. Yüzeyinde sıvı metan-etan gölleri ve denizleri, hidrokarbon yağmuru ve kum tepeleri vardır.',
    facts: { 'Yüzey basıncı': '1.45 bar', 'Atmosfer': '%95 N₂, %5 CH₄' },
  },
  {
    id: 'iapetus', name: 'Iapetus', type: 'moon', parent: 'saturn',
    radius: 734.5, mass: 1.8056e21, albedo: 0.27, rotationPeriod: 'sync',
    orbit: moonOrbit(3_560_840, 0.0283, 15.47, 79.3215, 60, { frame: 'laplace' }),
    appearance: { kind: 'terrestrial', seed: 70, landLow: [0.08, 0.06, 0.04], landMid: [0.45, 0.42, 0.38], landHigh: [0.88, 0.88, 0.86], craters: 0.8, roughness: 1.0, variation: 1.0 },
    description: 'Bir yarısı kömür karası, diğer yarısı kar beyazı olan "yin-yang" uydu. Ekvatorunda 20 km yüksekliğinde gizemli bir sırt uzanır.',
  },

  /* ---------------- Uranus ---------------- */
  {
    id: 'uranus', name: 'Uranüs', type: 'planet', parent: 'sun',
    radius: 25_362, flattening: 0.0229, mass: 8.6810e25, albedo: 0.30, rotationPeriod: -17.24,
    pole: { ra: 257.31, dec: -15.18 },
    orbit: jpl(19.18916464, 0.04725744, 0.77263783, 313.23810451, 170.95427630, 74.01692503,
      -0.00196176, -0.00004397, -0.00242939, 428.48202785, 0.40805281, 0.04240589),
    appearance: {
      kind: 'gas', seed: 71, bandFreq: 4.0, turbulence: 0.15,
      bands: [[0.60, 0.85, 0.90], [0.55, 0.80, 0.88], [0.66, 0.88, 0.92], [0.58, 0.82, 0.90]],
    },
    atmosphere: { color: [0.6, 0.9, 1.0], height: 0.02, density: 0.5 },
    rings: { inner: 41_800, outer: 51_150, color: [0.45, 0.45, 0.48], opacity: 0.35, seed: 72, gaps: [[44_700, 2_400], [47_600, 1_600], [49_000, 1_200]] },
    temperature: 76,
    description: 'Dönme ekseni 98° yatık olan buz devi; neredeyse yörünge düzleminde "yuvarlanır". Metan atmosferi ona soluk camgöbeği rengini verir.',
    facts: { 'Bileşim': 'H₂, He, CH₄ (%2.3)', 'Uydular': '28', 'Keşif': '1781, W. Herschel' },
  },
  {
    id: 'miranda', name: 'Miranda', type: 'moon', parent: 'uranus',
    radius: 235.8, mass: 6.4e19, albedo: 0.32, rotationPeriod: 'sync',
    orbit: moonOrbit(129_900, 0.0013, 4.34, 1.413479, 30),
    appearance: { kind: 'terrestrial', seed: 73, landLow: [0.40, 0.40, 0.42], landMid: [0.60, 0.60, 0.62], landHigh: [0.82, 0.82, 0.84], craters: 0.6, roughness: 1.6, variation: 0.6 },
    description: 'Güneş Sistemi\'nin en yüksek uçurumu Verona Rupes (20 km) burada. Yüzeyi birbirinden kopuk jeolojik bölgelerin yamalı bohçası gibidir.',
  },
  {
    id: 'ariel', name: 'Ariel', type: 'moon', parent: 'uranus',
    radius: 578.9, mass: 1.251e21, albedo: 0.53, rotationPeriod: 'sync',
    orbit: moonOrbit(190_900, 0.0012, 0.04, 2.520379, 100),
    appearance: { kind: 'terrestrial', seed: 74, landLow: [0.45, 0.45, 0.46], landMid: [0.66, 0.66, 0.67], landHigh: [0.88, 0.88, 0.89], craters: 0.5, roughness: 1.0, variation: 0.3 },
    description: 'Uranüs\'ün en parlak ve jeolojik olarak en genç yüzeyli uydusu.',
  },
  {
    id: 'umbriel', name: 'Umbriel', type: 'moon', parent: 'uranus',
    radius: 584.7, mass: 1.275e21, albedo: 0.26, rotationPeriod: 'sync',
    orbit: moonOrbit(266_000, 0.0039, 0.13, 4.144177, 170),
    appearance: { kind: 'terrestrial', seed: 75, landLow: [0.20, 0.20, 0.21], landMid: [0.33, 0.33, 0.34], landHigh: [0.55, 0.55, 0.56], craters: 0.9, roughness: 1.0, variation: 0.3 },
    description: 'Uranüs\'ün en karanlık büyük uydusu. Kutbunda parlak "Wunda" halkası bulunur.',
  },
  {
    id: 'titania', name: 'Titania', type: 'moon', parent: 'uranus',
    radius: 788.9, mass: 3.400e21, albedo: 0.35, rotationPeriod: 'sync',
    orbit: moonOrbit(436_300, 0.0011, 0.08, 8.705872, 240),
    appearance: { kind: 'terrestrial', seed: 76, landLow: [0.35, 0.34, 0.34], landMid: [0.55, 0.54, 0.54], landHigh: [0.78, 0.78, 0.78], craters: 0.7, roughness: 1.0, variation: 0.3 },
    description: 'Uranüs\'ün en büyük uydusu; dev kanyonlar ve fay sistemleriyle kaplı.',
  },
  {
    id: 'oberon', name: 'Oberon', type: 'moon', parent: 'uranus',
    radius: 761.4, mass: 3.076e21, albedo: 0.31, rotationPeriod: 'sync',
    orbit: moonOrbit(583_500, 0.0014, 0.07, 13.463239, 310),
    appearance: { kind: 'terrestrial', seed: 77, landLow: [0.30, 0.29, 0.28], landMid: [0.50, 0.48, 0.47], landHigh: [0.72, 0.71, 0.70], craters: 0.9, roughness: 1.0, variation: 0.4 },
    description: 'Uranüs\'ün en dış büyük uydusu; kraterli, eski bir yüzeye ve 6 km yüksekliğinde bir dağa sahip.',
  },

  /* ---------------- Neptune ---------------- */
  {
    id: 'neptune', name: 'Neptün', type: 'planet', parent: 'sun',
    radius: 24_622, flattening: 0.0171, mass: 1.02413e26, albedo: 0.29, rotationPeriod: 16.11,
    pole: { ra: 299.36, dec: 43.46 },
    orbit: jpl(30.06992276, 0.00859048, 1.77004347, -55.12002969, 44.96476227, 131.78422574,
      0.00026291, 0.00005105, 0.00035372, 218.45945325, -0.32241464, -0.00508664),
    appearance: {
      kind: 'gas', seed: 81, bandFreq: 5.0, turbulence: 0.5,
      bands: [[0.20, 0.35, 0.85], [0.25, 0.45, 0.95], [0.18, 0.30, 0.75], [0.35, 0.55, 1.0]],
      storm: [-25, 80, 0.09, 0.08, 0.12, 0.35],
    },
    atmosphere: { color: [0.4, 0.6, 1.0], height: 0.02, density: 0.5 },
    rings: { inner: 53_000, outer: 63_000, color: [0.45, 0.42, 0.42], opacity: 0.25, seed: 82, gaps: [[56_000, 3_000], [60_500, 1_500]] },
    temperature: 72,
    description: 'Güneş\'ten en uzak gezegen. Güneş Sistemi\'nin en hızlı rüzgârları (2100 km/sa) burada eser. Teleskopla değil, matematikle keşfedilmiştir (1846).',
    facts: { 'Uydular': '16', 'Yörünge periyodu': '164.8 yıl', 'Keşif': '1846, Le Verrier / Galle' },
  },
  {
    id: 'triton', name: 'Triton', type: 'moon', parent: 'neptune',
    radius: 1353.4, mass: 2.1390e22, albedo: 0.76, rotationPeriod: 'sync',
    orbit: moonOrbit(354_760, 0.000016, 156.885, 5.876854, 90),
    appearance: { kind: 'terrestrial', seed: 83, landLow: [0.60, 0.50, 0.48], landMid: [0.82, 0.78, 0.76], landHigh: [0.95, 0.94, 0.94], ice: [0.92, 0.90, 0.95], iceCaps: 0.55, craters: 0.1, roughness: 0.6, variation: 0.6 },
    atmosphere: { color: [0.7, 0.75, 0.9], height: 0.015, density: 0.15 },
    temperature: 38,
    description: 'Neptün etrafında retrograd dönen tek büyük uydu — muhtemelen yakalanmış bir Kuiper Kuşağı cismi. Azot gayzerleri ve "kavun kabuğu" arazisi ile bilinir.',
  },

  /* ---------------- Pluto system ---------------- */
  {
    id: 'pluto', name: 'Plüton', type: 'dwarf', parent: 'sun',
    radius: 1188.3, mass: 1.303e22, albedo: 0.52, rotationPeriod: -153.2928,
    pole: { ra: 132.99, dec: -6.16 },
    orbit: jpl(39.48211675, 0.24882730, 17.14001206, 238.92903833, 224.06891629, 110.30393684,
      -0.00031596, 0.00005170, 0.00004818, 145.20780515, -0.04062942, -0.01183482),
    appearance: { kind: 'terrestrial', seed: 91, landLow: [0.35, 0.22, 0.15], landMid: [0.72, 0.60, 0.50], landHigh: [0.95, 0.93, 0.90], ice: [0.97, 0.96, 0.95], iceCaps: 0.6, craters: 0.3, roughness: 0.8, variation: 1.0 },
    atmosphere: { color: [0.55, 0.65, 0.95], height: 0.03, density: 0.2 },
    temperature: 44,
    description: 'Kuiper Kuşağı\'nın en ünlü cüce gezegeni. Azot buzundan oluşan kalp şeklindeki Sputnik Planitia, mavi katmanlı atmosfer ve Charon ile ikili sistem oluşturur.',
    facts: { 'Keşif': '1930, Clyde Tombaugh', 'Uydular': '5', 'Yeniden sınıflandırma': '2006 (cüce gezegen)' },
  },
  {
    id: 'charon', name: 'Charon', type: 'moon', parent: 'pluto',
    radius: 606, mass: 1.586e21, albedo: 0.38, rotationPeriod: 'sync',
    orbit: moonOrbit(19_591, 0.0002, 0.08, 6.387230, 180),
    appearance: { kind: 'terrestrial', seed: 92, landLow: [0.35, 0.34, 0.34], landMid: [0.55, 0.54, 0.54], landHigh: [0.78, 0.76, 0.75], craters: 0.5, roughness: 0.9, variation: 0.5 },
    description: 'Plüton\'un yarısı büyüklüğündeki uydusu; kızılımsı kutup bölgesi (Mordor Macula) Plüton\'dan kaçan metanla oluşmuştur.',
  },

  /* ---------------- Dwarf planets & asteroids ---------------- */
  {
    id: 'ceres', name: 'Ceres', type: 'dwarf', parent: 'sun',
    radius: 469.7, mass: 9.3835e20, albedo: 0.09, rotationPeriod: 9.074, tilt: 4,
    orbit: helio(2.7691, 0.0760, 10.594, 80.305, 73.597, 77.372, 1681.6),
    appearance: { kind: 'terrestrial', seed: 101, landLow: [0.22, 0.21, 0.20], landMid: [0.36, 0.35, 0.34], landHigh: [0.60, 0.60, 0.60], craters: 0.9, roughness: 1.0, variation: 0.4 },
    description: 'Asteroit Kuşağı\'nın en büyük cismi ve iç Güneş Sistemi\'nin tek cüce gezegeni. Occator kraterindeki parlak tuz birikintileri ile tanınır.',
    facts: { 'Keşif': '1801, G. Piazzi' },
  },
  {
    id: 'vesta', name: 'Vesta', type: 'asteroid', parent: 'sun',
    radius: 262.7, mass: 2.5907e20, albedo: 0.42, rotationPeriod: 5.342, tilt: 29,
    orbit: helio(2.3615, 0.0887, 7.1417, 103.81, 150.73, 20.86, 1325.75),
    appearance: { kind: 'terrestrial', seed: 102, landLow: [0.28, 0.27, 0.25], landMid: [0.45, 0.44, 0.42], landHigh: [0.68, 0.67, 0.65], craters: 1.0, roughness: 2.2, variation: 0.4 },
    description: 'Asteroit Kuşağı\'nın en parlak ve ikinci büyük cismi; farklılaşmış iç yapısıyla bir "protoplanet".',
  },
  {
    id: 'eris', name: 'Eris', type: 'dwarf', parent: 'sun',
    radius: 1163, mass: 1.6466e22, albedo: 0.96, rotationPeriod: 25.9, tilt: 78,
    orbit: helio(67.864, 0.43607, 44.040, 35.951, 151.639, 205.99, 204_199),
    appearance: { kind: 'terrestrial', seed: 103, landLow: [0.80, 0.82, 0.85], landMid: [0.92, 0.93, 0.95], landHigh: [1.0, 1.0, 1.0], craters: 0.1, roughness: 0.5, variation: 0.2 },
    description: 'Plüton\'dan daha kütleli en büyük bilinen cüce gezegen. Keşfi Plüton\'un yeniden sınıflandırılmasını tetikledi. Metan buzuyla kaplı çok parlak yüzey.',
    facts: { 'Keşif': '2005, M. Brown vd.', 'Uydu': 'Dysnomia' },
  },
  {
    id: 'haumea', name: 'Haumea', type: 'dwarf', parent: 'sun',
    radius: 780, flattening: 0.45, mass: 4.006e21, albedo: 0.66, rotationPeriod: 3.9155, tilt: 15,
    orbit: helio(43.116, 0.19642, 28.2137, 122.167, 239.041, 218.205, 103_468),
    appearance: { kind: 'terrestrial', seed: 104, landLow: [0.70, 0.70, 0.72], landMid: [0.85, 0.85, 0.87], landHigh: [0.98, 0.98, 1.0], craters: 0.1, roughness: 0.5, variation: 0.3 },
    description: 'Yalnızca 3.9 saatte dönen, bu yüzden elipsoid şeklinde uzamış cüce gezegen. Kendi halka sistemine sahip bilinen ilk trans-Neptün cismi.',
  },
  {
    id: 'makemake', name: 'Makemake', type: 'dwarf', parent: 'sun',
    radius: 715, mass: 3.1e21, albedo: 0.81, rotationPeriod: 22.83, tilt: 20,
    orbit: helio(45.430, 0.16126, 28.9835, 79.620, 294.834, 165.514, 111_845),
    appearance: { kind: 'terrestrial', seed: 105, landLow: [0.55, 0.35, 0.25], landMid: [0.78, 0.62, 0.50], landHigh: [0.92, 0.88, 0.85], craters: 0.2, roughness: 0.6, variation: 0.5 },
    description: 'Kuiper Kuşağı\'nın en parlak cisimlerinden; metan, etan ve tolinlerle kaplı kızılımsı yüzey.',
  },

  /* ---------------- Comet ---------------- */
  {
    id: 'halley', name: '1P/Halley', type: 'comet', parent: 'sun',
    radius: 5.5, mass: 2.2e14, albedo: 0.04, rotationPeriod: 52.8, tilt: 60,
    orbit: helio(17.834, 0.96714, 162.262, 58.42, 111.33, 0, 27_509, 2_446_467.395), // perihelion 1986-02-09
    appearance: { kind: 'terrestrial', seed: 111, landLow: [0.05, 0.05, 0.05], landMid: [0.12, 0.11, 0.10], landHigh: [0.25, 0.24, 0.22], craters: 0.6, roughness: 2.5, variation: 0.4 },
    description: 'Her 75–79 yılda bir görünen en ünlü periyodik kuyruklu yıldız. Retrograd yörüngesi ile 1986\'da Giotto sondası tarafından ziyaret edildi; bir sonraki perihelyonu 2061.',
  },

  /* ---------------- Spacecraft ---------------- */
  ...SPACECRAFT,
];

export const PLANET_HOTKEYS = ['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto', 'sun'];

/** Small-body populations rendered as GPU particle belts */
export const SOLAR_BELTS: GeneratedBelt[] = [
  {
    name: 'Asteroit Kuşağı', count: 24_000, aMin: 2.06, aMax: 3.28, eMax: 0.25, iSigmaDeg: 7,
    color: [0.75, 0.70, 0.62], opacity: 0.9, seed: 7,
    gaps: [[2.50, 0.02], [2.82, 0.015], [2.95, 0.012], [3.27, 0.02]],
  },
  {
    name: 'Truva Asteroitleri (L4)', count: 2_500, aMin: 5.05, aMax: 5.35, eMax: 0.12, iSigmaDeg: 10,
    color: [0.6, 0.55, 0.5], opacity: 0.7, seed: 8, trojan: { aAU: 5.2029, meanLongitudeDeg: 34.4 + 60 },
  },
  {
    name: 'Truva Asteroitleri (L5)', count: 2_500, aMin: 5.05, aMax: 5.35, eMax: 0.12, iSigmaDeg: 10,
    color: [0.6, 0.55, 0.5], opacity: 0.7, seed: 9, trojan: { aAU: 5.2029, meanLongitudeDeg: 34.4 - 60 },
  },
  {
    name: 'Kuiper Kuşağı', count: 30_000, aMin: 37, aMax: 50, eMax: 0.2, iSigmaDeg: 6,
    color: [0.55, 0.62, 0.8], opacity: 0.75, seed: 10,
  },
  {
    name: 'Saçılmış Disk', count: 5_000, aMin: 50, aMax: 120, eMax: 0.55, iSigmaDeg: 20,
    color: [0.5, 0.55, 0.75], opacity: 0.5, seed: 11,
  },
];

export { GRAY };
