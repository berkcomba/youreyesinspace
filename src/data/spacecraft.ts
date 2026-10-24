import type { BodyData, LinearState, SimpleElements } from './types';
import { J2000_JD } from '../core/constants';

/**
 * Human-made spacecraft, shown at their (approximate) present positions.
 * Sources: NASA/JPL Horizons & mission pages. Interstellar probes: heliocentric state vectors
 * of 2026-10-22 (JD 2461335.5) extrapolated in a straight line; BepiColombo, Europa Clipper and
 * Hera: sampled Horizons ephemerides in /ephem (scripts/fetch-horizons.mjs).
 * 3D models: NASA 3D Resources (public domain), served from /models.
 */

/** Horizons epoch of the probe states below */
export const PROBE_EPOCH_JD = 2_461_335.5;
export const PROBE_EPOCH_LABEL = '2026-10-22';

/** Straight-line heliocentric state (km, km/s; ecliptic J2000) */
function state(pos: [number, number, number], vel: [number, number, number]): LinearState {
  return { kind: 'linear', epoch: PROBE_EPOCH_JD, pos, vel };
}

function orbit(a: number, e: number, i: number, period: number, M0: number, node: number, argPeri: number, frame: SimpleElements['frame'] = 'parentEquator', epoch = J2000_JD): SimpleElements {
  return { kind: 'simple', a, e, i, period, M0, node, argPeri, epoch, frame };
}

const M = (file: string) => `/models/${file}.glb`;
const HORIZONS = 'NASA/JPL Horizons';

export const SPACECRAFT: BodyData[] = [
  /* ---------------- interstellar / outer probes ---------------- */
  {
    id: 'voyager1', name: 'Voyager 1', type: 'spacecraft', parent: 'sun',
    radius: 0.0065, mass: 825, albedo: 0.3,
    orbit: state([-4.815275e9, -2.049336e10, 1.482731e10], [-2.0697, -13.6113, 9.8318]),
    appearance: { kind: 'spacecraft', model: M('voyager'), seed: 901 },
    description: 'İnsan yapımı en uzak nesne. 5 Eylül 1977\'de fırlatıldı; Jüpiter (1979) ve Satürn (1980) geçişlerinden sonra 2012\'de heliopause\'u aşarak yıldızlararası uzaya çıktı. Altın Plak\'ı taşır.',
    facts: { 'Fırlatma': '5 Eylül 1977 (Titan IIIE)', 'Ajans': 'NASA / JPL', 'Durum': 'Aktif – yıldızlararası uzay', 'Sinyal gecikmesi': '~23 saat (tek yön)' },
  },
  {
    id: 'voyager2', name: 'Voyager 2', type: 'spacecraft', parent: 'sun',
    radius: 0.0065, mass: 825, albedo: 0.3,
    orbit: state([5.975126e9, -1.579419e10, -1.343996e10], [4.2034, -9.3402, -11.3165]),
    appearance: { kind: 'spacecraft', model: M('voyager'), seed: 902 },
    description: 'Dört dev gezegeni de ziyaret eden tek araç (Jüpiter 1979, Satürn 1981, Uranüs 1986, Neptün 1989). 2018\'de heliopause\'u geçti; güney ekliptik yarıkürede yıldızlararası uzayda.',
    facts: { 'Fırlatma': '20 Ağustos 1977 (Titan IIIE)', 'Ajans': 'NASA / JPL', 'Durum': 'Aktif – yıldızlararası uzay', 'Sinyal gecikmesi': '~19 saat (tek yön)' },
  },
  {
    id: 'pioneer10', name: 'Pioneer 10', type: 'spacecraft', parent: 'sun',
    radius: 0.0015, mass: 258, albedo: 0.3,
    orbit: state([3.603206e9, 2.091676e10, 1.106985e9], [1.2270, 11.7699, 0.6030]),
    appearance: { kind: 'spacecraft', model: M('pioneer'), seed: 903 },
    description: 'Asteroit kuşağını ve Jüpiter\'i geçen ilk araç (1973). Son sinyal 23 Ocak 2003\'te alındı; Aldebaran yönünde sessizce uzaklaşıyor.',
    facts: { 'Fırlatma': '2 Mart 1972 (Atlas-Centaur)', 'Ajans': 'NASA / Ames', 'Durum': 'Pasif (2003\'ten beri sessiz)' },
  },
  {
    id: 'pioneer11', name: 'Pioneer 11', type: 'spacecraft', parent: 'sun',
    radius: 0.0015, mass: 259, albedo: 0.3,
    orbit: state([4.358680e9, -1.658905e10, 4.227442e9], [4.0374, -10.0955, 2.4312]),
    appearance: { kind: 'spacecraft', model: M('pioneer'), seed: 904 },
    description: 'Satürn\'e ulaşan ilk araç (1979). 1995\'te güç azalması nedeniyle görevi sona erdi; Kartal takımyıldızı yönünde sürükleniyor.',
    facts: { 'Fırlatma': '6 Nisan 1973 (Atlas-Centaur)', 'Ajans': 'NASA / Ames', 'Durum': 'Pasif (1995\'ten beri sessiz)' },
  },
  {
    id: 'newhorizons', name: 'New Horizons', type: 'spacecraft', parent: 'sun',
    radius: 0.0015, mass: 478, albedo: 0.4,
    orbit: state([3.128322e9, -9.338993e9, 3.435486e8], [5.3071, -12.4873, 0.4914]),
    appearance: { kind: 'spacecraft', model: M('pioneer'), seed: 905, representative: true },
    description: 'Plüton\'un (2015) ve Kuiper Kuşağı cismi Arrokoth\'un (2019) yanından geçen sonda. Kuiper Kuşağı\'nın dış kısmında heliosferi incelemeye devam ediyor. (Model temsilîdir.)',
    facts: { 'Fırlatma': '19 Ocak 2006 (Atlas V)', 'Ajans': 'NASA / APL', 'Durum': 'Aktif – Kuiper Kuşağı' },
  },

  /* ---------------- Events: sampled Horizons ephemerides ---------------- */
  {
    id: 'bepicolombo', name: 'BepiColombo', type: 'spacecraft', parent: 'mercury',
    radius: 0.004, mass: 4_100, albedo: 0.5,
    orbit: { kind: 'ephemeris', table: 'bepicolombo' },
    appearance: { kind: 'spacecraft', model: M('dawn'), seed: 920, representative: true },
    description: 'ESA ve JAXA\'nın ortak Merkür görevi. 2018\'de fırlatıldı; dokuz gezegen geçişinin ardından Kasım 2026\'da Merkür yörüngesine yavaşça yakalanıyor. İki yörünge aracı taşır: ESA\'nın MPO\'su ve JAXA\'nın Mio\'su. Konum, JPL Horizons\'ın yayımladığı örneklenmiş yörüngeden türetilir; veri aralığı dışında araç gösterilmez. (Model temsilîdir.)',
    facts: { 'Fırlatma': '20 Ekim 2018 (Ariane 5)', 'Ajans': 'ESA / JAXA', 'Durum': 'Merkür yörüngesine giriş – Kasım 2026', 'Kaynak': `${HORIZONS}, 2026-10-22` },
  },
  {
    id: 'europaclipper', name: 'Europa Clipper', type: 'spacecraft', parent: 'earth',
    radius: 0.015, mass: 6_065, albedo: 0.5,
    orbit: { kind: 'ephemeris', table: 'europaclipper' },
    appearance: { kind: 'spacecraft', model: M('juno'), seed: 921, representative: true },
    description: 'NASA\'nın Jüpiter\'in uydusu Europa\'yı inceleyecek sondası; 30 m açıklığındaki güneş panelleriyle NASA\'nın gezegenler arası en büyük aracı. Mart 2025\'te Mars\'ın, Aralık 2026\'da Dünya\'nın yanından geçerek hız kazanır; Jüpiter\'e 2030\'da varır. Konum, JPL Horizons\'ın örneklenmiş yörüngesinden türetilir. (Model temsilîdir.)',
    facts: { 'Fırlatma': '14 Ekim 2024 (Falcon Heavy)', 'Ajans': 'NASA / JPL', 'Durum': 'Dünya yakın geçişi – 3 Aralık 2026', 'Kaynak': `${HORIZONS}, 2026-10-22` },
  },
  {
    id: 'hera', name: 'Hera', type: 'spacecraft', parent: 'didymos',
    radius: 0.003, mass: 1_128, albedo: 0.5,
    orbit: { kind: 'ephemeris', table: 'hera' },
    appearance: { kind: 'spacecraft', model: M('dawn'), seed: 922, representative: true },
    description: 'ESA\'nın gezegen savunması görevi: DART\'ın 2022\'de çarptığı Dimorphos\'u ve ana cismi Didymos\'u yakından inceler. Kasım 2026\'da ikili asteroite varır; Milani ve Juventas adlı iki küp uydu taşır. Konum, JPL Horizons\'ın 4 Kasım 2026\'ya kadar yayımladığı yörüngeden türetilir. (Model temsilîdir.)',
    facts: { 'Fırlatma': '7 Ekim 2024 (Falcon 9)', 'Ajans': 'ESA', 'Durum': 'Didymos\'a yaklaşma – Kasım 2026', 'Kaynak': `${HORIZONS}, 2026-10-22` },
  },

  /* ---------------- inner Solar System ---------------- */
  {
    id: 'parker', name: 'Parker Solar Probe', type: 'spacecraft', parent: 'sun',
    radius: 0.0015, mass: 685, albedo: 0.5,
    // final 88-day orbit; perihelion 2024-12-24 (6.1 million km from the photosphere)
    orbit: orbit(58_044_000, 0.882, 3.4, 88.0, 0, 70, 40, 'ecliptic', 2_460_668.5),
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
    appearance: {
      kind: 'spacecraft', model: M('perseverance'), seed: 910,
      terrain: { dir: '/tour-media/terrain/perseverance', credit: 'Jezero arazisi: HiRISE DTM ve ortofoto (NASA/JPL-Caltech/UArizona/USGS) · CTX mozaik (NASA/JPL/MSSS) · HRSC+MOLA (ESA/DLR/FU Berlin, USGS) · Ufuk: Mastcam-Z "Van Zyl Overlook" panoraması (NASA/JPL-Caltech/ASU/MSSS)' },
    },
    description: 'Jezero Krateri\'nde eski bir göl deltasında yaşam izleri arayan ve örnek tüpleri biriktiren gezici. Ingenuity helikopterini taşıdı.',
    facts: { 'Fırlatma': '30 Temmuz 2020 (Atlas V)', 'İniş': '18 Şubat 2021 – Jezero Krateri', 'Ajans': 'NASA / JPL', 'Durum': 'Aktif' },
  },
  {
    id: 'curiosity', name: 'Curiosity', type: 'spacecraft', parent: 'mars',
    radius: 0.0015, mass: 899, albedo: 0.4,
    orbit: { kind: 'surface', lat: -4.5895, lon: 137.4417, alt: 0.0011 },
    appearance: {
      kind: 'spacecraft', model: M('perseverance'), seed: 911, representative: true,
      terrain: { dir: '/tour-media/terrain/curiosity', credit: 'Gale arazisi: HiRISE DEM ve renkli mozaik (NASA/JPL-Caltech/UArizona/USGS) · CTX mozaik (NASA/JPL/MSSS) · HRSC+MOLA (ESA/DLR/FU Berlin, USGS) · Ufuk: Mont Mercou 360° panoraması (NASA/JPL-Caltech/MSSS)' },
    },
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
