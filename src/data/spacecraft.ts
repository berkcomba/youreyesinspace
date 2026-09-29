import type { BodyData, LinearState, SimpleElements } from './types';
import { AU_KM, J2000_JD } from '../core/constants';
import { raDecToEclipticMath } from '../math/frames';

/**
 * Human-made spacecraft, shown at their (approximate) present positions.
 * Sources: NASA/JPL Horizons & mission pages, state as of 2025-01-01 (JD 2460676.5).
 * 3D models: NASA 3D Resources (public domain), served from /models.
 */

const EPOCH_2025 = 2_460_676.5;

/**
 * Interstellar probe: geocentric RA/Dec (≈ heliocentric at these distances), heliocentric
 * distance in AU and radial speed in km/s → straight-line heliocentric state.
 */
function probe(raDeg: number, decDeg: number, distAU: number, speedKmS: number): LinearState {
  const u = raDecToEclipticMath(raDeg, decDeg);
  const d = distAU * AU_KM;
  return {
    kind: 'linear', epoch: EPOCH_2025,
    pos: [u.x * d, u.y * d, u.z * d],
    vel: [u.x * speedKmS, u.y * speedKmS, u.z * speedKmS],
  };
}

function orbit(a: number, e: number, i: number, period: number, M0: number, node: number, argPeri: number, frame: SimpleElements['frame'] = 'parentEquator', epoch = J2000_JD): SimpleElements {
  return { kind: 'simple', a, e, i, period, M0, node, argPeri, epoch, frame };
}

const M = (file: string) => `/models/${file}.glb`;

export const SPACECRAFT: BodyData[] = [
  /* ---------------- interstellar / outer probes ---------------- */
  {
    id: 'voyager1', name: 'Voyager 1', type: 'spacecraft', parent: 'sun',
    radius: 0.0065, mass: 825, albedo: 0.3,
    orbit: probe(258.3, 12.3, 166.0, 16.96),
    appearance: { kind: 'spacecraft', model: M('voyager'), seed: 901 },
    description: 'İnsan yapımı en uzak nesne. 5 Eylül 1977\'de fırlatıldı; Jüpiter (1979) ve Satürn (1980) geçişlerinden sonra 2012\'de heliopause\'u aşarak yıldızlararası uzaya çıktı. Altın Plak\'ı taşır.',
    facts: { 'Fırlatma': '5 Eylül 1977 (Titan IIIE)', 'Ajans': 'NASA / JPL', 'Durum': 'Aktif – yıldızlararası uzay', 'Sinyal gecikmesi': '~23 saat (tek yön)' },
  },
  {
    id: 'voyager2', name: 'Voyager 2', type: 'spacecraft', parent: 'sun',
    radius: 0.0065, mass: 825, albedo: 0.3,
    orbit: probe(300.3, -59.0, 138.5, 15.35),
    appearance: { kind: 'spacecraft', model: M('voyager'), seed: 902 },
    description: 'Dört dev gezegeni de ziyaret eden tek araç (Jüpiter 1979, Satürn 1981, Uranüs 1986, Neptün 1989). 2018\'de heliopause\'u geçti; güney ekliptik yarıkürede yıldızlararası uzayda.',
    facts: { 'Fırlatma': '20 Ağustos 1977 (Titan IIIE)', 'Ajans': 'NASA / JPL', 'Durum': 'Aktif – yıldızlararası uzay', 'Sinyal gecikmesi': '~19 saat (tek yön)' },
  },
  {
    id: 'pioneer10', name: 'Pioneer 10', type: 'spacecraft', parent: 'sun',
    radius: 0.0015, mass: 258, albedo: 0.3,
    orbit: probe(78.8, 25.9, 136.5, 11.9),
    appearance: { kind: 'spacecraft', model: M('pioneer'), seed: 903 },
    description: 'Asteroit kuşağını ve Jüpiter\'i geçen ilk araç (1973). Son sinyal 23 Ocak 2003\'te alındı; Aldebaran yönünde sessizce uzaklaşıyor.',
    facts: { 'Fırlatma': '2 Mart 1972 (Atlas-Centaur)', 'Ajans': 'NASA / Ames', 'Durum': 'Pasif (2003\'ten beri sessiz)' },
  },
  {
    id: 'pioneer11', name: 'Pioneer 11', type: 'spacecraft', parent: 'sun',
    radius: 0.0015, mass: 259, albedo: 0.3,
    orbit: probe(282.5, -8.9, 114.6, 11.1),
    appearance: { kind: 'spacecraft', model: M('pioneer'), seed: 904 },
    description: 'Satürn\'e ulaşan ilk araç (1979). 1995\'te güç azalması nedeniyle görevi sona erdi; Kartal takımyıldızı yönünde sürükleniyor.',
    facts: { 'Fırlatma': '6 Nisan 1973 (Atlas-Centaur)', 'Ajans': 'NASA / Ames', 'Durum': 'Pasif (1995\'ten beri sessiz)' },
  },
  {
    id: 'newhorizons', name: 'New Horizons', type: 'spacecraft', parent: 'sun',
    radius: 0.0015, mass: 478, albedo: 0.4,
    orbit: probe(293.8, -20.6, 61.3, 13.8),
    appearance: { kind: 'spacecraft', model: M('pioneer'), seed: 905, representative: true },
    description: 'Plüton\'un (2015) ve Kuiper Kuşağı cismi Arrokoth\'un (2019) yanından geçen sonda. Kuiper Kuşağı\'nın dış kısmında heliosferi incelemeye devam ediyor. (Model temsilîdir.)',
    facts: { 'Fırlatma': '19 Ocak 2006 (Atlas V)', 'Ajans': 'NASA / APL', 'Durum': 'Aktif – Kuiper Kuşağı' },
  },

  /* ---------------- inner Solar System ---------------- */
  {
    id: 'parker', name: 'Parker Solar Probe', type: 'spacecraft', parent: 'sun',
    radius: 0.0015, mass: 685, albedo: 0.5,
    // final 88-day orbit; perihelion 2024-12-24 (6.1 million km from the photosphere)
    orbit: orbit(0.388 * AU_KM, 0.882, 3.4, 88.0, 0, 70, 40, 'ecliptic', 2_460_668.5),
    appearance: { kind: 'spacecraft', model: M('parker'), seed: 906 },
    description: 'Güneş\'e en çok yaklaşan ve en hızlı insan yapımı araç: perihelyonda ~6,9 milyon km ve 690.000 km/sa. Karbon-kompozit ısı kalkanı arkasında Güneş koronasını yerinde inceliyor.',
    facts: { 'Fırlatma': '12 Ağustos 2018 (Delta IV Heavy)', 'Ajans': 'NASA / APL', 'Durum': 'Aktif – korona geçişleri', 'Rekor hız': '192 km/s' },
  },

  /* ---------------- Earth orbit & L2 ---------------- */
  {
    id: 'iss', name: 'ISS', type: 'spacecraft', parent: 'earth',
    radius: 0.055, mass: 419_725, albedo: 0.6,
    orbit: orbit(6_789, 0.0006, 51.64, 0.0645, 40, 120, 30),
    appearance: { kind: 'spacecraft', model: M('iss'), seed: 907 },
    description: 'Uluslararası Uzay İstasyonu: alçak Dünya yörüngesindeki modüler araştırma istasyonu; 2000\'den beri kesintisiz mürettebatlı. 109 m genişliğinde, günde ~16 kez Dünya\'yı dolaşır.',
    facts: { 'İlk modül': '20 Kasım 1998 (Zarya)', 'Ortaklar': 'NASA, Roskosmos, ESA, JAXA, CSA', 'Durum': 'Aktif – mürettebatlı', 'Yörünge hızı': '7,66 km/s' },
  },
  {
    id: 'hubble', name: 'Hubble', type: 'spacecraft', parent: 'earth',
    radius: 0.0067, mass: 11_110, albedo: 0.7,
    orbit: orbit(6_891, 0.0003, 28.47, 0.0661, 200, 60, 10),
    appearance: { kind: 'spacecraft', model: M('hubble'), seed: 908 },
    description: 'Hubble Uzay Teleskobu: 2,4 m aynalı görünür/UV uzay teleskobu; 1990\'dan beri yörüngede. Derin Alan görüntüleri ve evrenin genişleme hızı ölçümleriyle modern kozmolojiyi şekillendirdi.',
    facts: { 'Fırlatma': '24 Nisan 1990 (STS-31 Discovery)', 'Ajans': 'NASA / ESA', 'Durum': 'Aktif' },
  },
  {
    id: 'jwst', name: 'JWST', type: 'spacecraft', parent: 'earth',
    radius: 0.011, mass: 6_500, albedo: 0.5,
    orbit: { kind: 'lagrange', point: 'L2', distance: 1_500_000 },
    appearance: { kind: 'spacecraft', model: M('jwst'), seed: 909 },
    description: 'James Webb Uzay Teleskobu: 6,5 m katlanır altın kaplı aynasıyla kızılötesi uzay teleskobu. Güneş–Dünya L2 noktası çevresinde halo yörüngede; ilk galaksileri ve ötegezegen atmosferlerini gözlüyor.',
    facts: { 'Fırlatma': '25 Aralık 2021 (Ariane 5)', 'Ajans': 'NASA / ESA / CSA', 'Durum': 'Aktif – L2', 'Ayna': '18 altıgen segment, 6,5 m' },
  },

  /* ---------------- Mars ---------------- */
  {
    id: 'perseverance', name: 'Perseverance', type: 'spacecraft', parent: 'mars',
    radius: 0.0015, mass: 1_025, albedo: 0.4,
    orbit: { kind: 'surface', lat: 18.4447, lon: 77.4508, alt: 0.0011 },
    appearance: { kind: 'spacecraft', model: M('perseverance'), seed: 910 },
    description: 'Jezero Krateri\'nde eski bir göl deltasında yaşam izleri arayan ve örnek tüpleri biriktiren gezici. Ingenuity helikopterini taşıdı.',
    facts: { 'Fırlatma': '30 Temmuz 2020 (Atlas V)', 'İniş': '18 Şubat 2021 – Jezero Krateri', 'Ajans': 'NASA / JPL', 'Durum': 'Aktif' },
  },
  {
    id: 'curiosity', name: 'Curiosity', type: 'spacecraft', parent: 'mars',
    radius: 0.0015, mass: 899, albedo: 0.4,
    orbit: { kind: 'surface', lat: -4.5895, lon: 137.4417, alt: 0.0011 },
    appearance: { kind: 'spacecraft', model: M('perseverance'), seed: 911, representative: true },
    description: 'Gale Krateri\'nde Aeolis Mons\'un (Mount Sharp) eteklerini tırmanan, radyoizotop güçlü gezici. Antik akarsu yatakları ve organik moleküller keşfetti. (Model temsilîdir.)',
    facts: { 'Fırlatma': '26 Kasım 2011 (Atlas V)', 'İniş': '6 Ağustos 2012 – Gale Krateri', 'Ajans': 'NASA / JPL', 'Durum': 'Aktif' },
  },

  /* ---------------- Jupiter ---------------- */
  {
    id: 'juno', name: 'Juno', type: 'spacecraft', parent: 'jupiter',
    radius: 0.01, mass: 1_593, albedo: 0.5,
    // highly elliptical polar orbit; ~33 d since 2023
    orbit: orbit(4_050_000, 0.9815, 90.0, 33.0, 0, 20, 270, 'parentEquator', 2_460_000.5),
    appearance: { kind: 'spacecraft', model: M('juno'), seed: 912 },
    description: 'Jüpiter\'in kutup yörüngesinde dönen güneş enerjili sonda. Kutup fırtınalarını, iç yapısını ve manyetik alanını haritaladı; uzatılmış görevde Galileo uydularına yakın geçişler yapıyor.',
    facts: { 'Fırlatma': '5 Ağustos 2011 (Atlas V)', 'Varış': '5 Temmuz 2016', 'Ajans': 'NASA / JPL', 'Durum': 'Aktif' },
  },
];
