import type { Vector3 } from 'three';
import type { BodyData } from './types';
import type { StarInfo } from './StarCatalog';
import { starBody, syntheticInfo } from './blackholes';
import { PULSARS, pulsarBodies, pulsarInfo, type PulsarParams } from './pulsars';

/**
 * Real, named deep-sky landmarks: nebulae, clusters, supernova remnants and a few record-holding
 * stars — in the Milky Way and in the nearby galaxies. Nebulae/clusters/remnants are drawn as
 * sprites and are destinations; stars become visitable systems (`l{n}` ids).
 */
export type LandmarkKind = 'nebula' | 'cluster' | 'remnant' | 'star' | 'pulsar';

export const LANDMARK_KIND_LABEL: Record<LandmarkKind, string> = {
  nebula: 'Bulutsu',
  cluster: 'Yıldız kümesi',
  remnant: 'Süpernova / gezegenimsi bulutsu kalıntısı',
  star: 'Yıldız',
  pulsar: 'Pulsar / nötron yıldızı',
};

export interface LandmarkStar {
  massSolar: number;
  radiusSolar: number;
  temperature: number;
  luminosity: number;
  spectral: string;
}

export interface LandmarkDef {
  id: string;
  name: string;
  kind: LandmarkKind;
  /** substring of the host galaxy's catalogue name; null = Milky Way */
  galaxy: string | null;
  ra: number;
  dec: number;
  /** distance (pc) from the Sun; omitted for objects in other galaxies (sightline ∩ galaxy plane) */
  distancePc?: number;
  /** visual radius (pc) of the sprite */
  radiusPc: number;
  /** integrated absolute magnitude (V) */
  absMag: number;
  /** sprite tint (linear RGB) */
  color: [number, number, number];
  summary: string;
  description: string;
  facts: Record<string, string>;
  /** physical parameters when `kind === 'star'` (makes the landmark a visitable system) */
  star?: LandmarkStar;
  /** physical parameters when `kind === 'pulsar'` (visitable system, see data/pulsars.ts) */
  pulsar?: PulsarParams;
}

/** landmark is a visitable system (`l{n}` id) */
export function isSystemLandmark(def: LandmarkDef): boolean {
  return def.star !== undefined || def.pulsar !== undefined;
}

/** Sky position → sprite colour presets */
const EMISSION: [number, number, number] = [1.0, 0.45, 0.55];   // Hα + [O III]
const OLD_CLUSTER: [number, number, number] = [1.0, 0.9, 0.7];
const YOUNG_CLUSTER: [number, number, number] = [0.75, 0.85, 1.0];
const PLANETARY: [number, number, number] = [0.5, 0.95, 0.9];
const SNR: [number, number, number] = [0.9, 0.8, 1.0];

const KPC_M31 = 765_000;

export const LANDMARKS: LandmarkDef[] = [
  /* ---------------- Milky Way ---------------- */
  {
    id: 'l-m42', name: 'Orion Bulutsusu (M42)', kind: 'nebula', galaxy: null, ra: 83.822, dec: -5.391, distancePc: 412, radiusPc: 6, absMag: -4.1, color: EMISSION,
    summary: 'Bize en yakın dev yıldız oluşum bölgesi',
    description: 'Orion\'un kılıcındaki çıplak gözle görülebilen bulutsu; 1 300 ışık yılı uzaklıkta, 24 ışık yılı genişliğinde bir yıldız fabrikası. Merkezindeki Trapezium kümesinin dört sıcak yıldızı bulutu iyonize edip parlatır; yüzlerce protogezegen diski (proplyd) Hubble tarafından görüntülenmiştir.',
    facts: { 'Uzaklık': '412 pc (1 340 ışık yılı)', 'Görünür kadir': '4,0', 'Çap': '~24 ışık yılı', 'Kütle': '~2 000 M☉', 'Keşif': '1610, Peiresc' },
  },
  {
    id: 'l-pleiades', name: 'Ülker (Pleiades, M45)', kind: 'cluster', galaxy: null, ra: 56.75, dec: 24.117, distancePc: 136, radiusPc: 7, absMag: -4.1, color: YOUNG_CLUSTER,
    summary: 'Yedi Kız Kardeş — en ünlü açık küme',
    description: 'Boğa takımyıldızındaki 100 milyon yaşındaki açık küme; ~1 000 yıldızdan oluşur, parlak B-türü üyeleri önlerinden geçtikleri toz bulutunu mavi bir yansıma bulutsusu olarak aydınlatır. İnsanlık tarihinin her kültüründe adı vardır.',
    facts: { 'Uzaklık': '136 pc (444 ışık yılı)', 'Görünür kadir': '1,6', 'Yaş': '~100 milyon yıl', 'Yıldız sayısı': '~1 000', 'Çekirdek yarıçapı': '~2,5 pc' },
  },
  {
    id: 'l-carina', name: 'Karina Bulutsusu (NGC 3372)', kind: 'nebula', galaxy: null, ra: 161.1, dec: -59.6, distancePc: 2600, radiusPc: 45, absMag: -11.1, color: EMISSION,
    summary: 'Güney gökyüzünün dev bulutsusu; Eta Carinae\'nin evi',
    description: 'Orion Bulutsusu\'ndan dört kat daha büyük ve çok daha parlak; Samanyolu\'nun en kütleli yıldızlarından onlarcasını (Eta Carinae, WR 25, Trumpler 14/16 kümeleri) barındırır. JWST\'nin ilk görüntülerindeki "Kozmik Kayalıklar" bu bulutsunun kenarındadır.',
    facts: { 'Uzaklık': '2 600 pc (8 500 ışık yılı)', 'Görünür kadir': '1,0', 'Çap': '~300 ışık yılı', 'Keşif': '1752, Lacaille' },
  },
  {
    id: 'l-etacar', name: 'Eta Carinae', kind: 'star', galaxy: null, ra: 161.265, dec: -59.684, distancePc: 2300, radiusPc: 0.05, absMag: -8.5, color: [1, 0.85, 0.7],
    summary: 'Samanyolu\'nun en parlak ve en kararsız yıldızı',
    description: 'Yaklaşık 100 ve 30 güneş kütleli iki dev yıldızdan oluşan çift. 1843\'teki "Büyük Patlama"da gökyüzünün ikinci en parlak yıldızı oldu ve 10 güneş kütlesinden fazla madde fırlatarak Homunculus Bulutsusu\'nu oluşturdu. Yakın gelecekte (astronomik ölçekte) süpernova olması beklenir.',
    facts: { 'Uzaklık': '2 300 pc (7 500 ışık yılı)', 'Parlaklık': '~5 milyon L☉', 'Kütle': '~100 + 30 M☉', 'Yörünge periyodu (çift)': '5,54 yıl', 'Tür': 'Parlak mavi değişen (LBV)' },
    star: { massSolar: 100, radiusSolar: 300, temperature: 15_000, luminosity: 5e6, spectral: 'LBV' },
  },
  {
    id: 'l-m1', name: 'Yengeç Bulutsusu (M1)', kind: 'remnant', galaxy: null, ra: 83.633, dec: 22.0145, distancePc: 2000, radiusPc: 1.7, absMag: -3.1, color: SNR,
    summary: '1054 süpernovasının kalıntısı ve pulsarı',
    description: '1054 yılında Çinli gökbilimcilerin gündüz bile gördüğü süpernovanın kalıntısı. Merkezinde saniyede 30 kez dönen Yengeç Pulsarı bulutsuyu senkrotron ışımasıyla besler; 1 500 km/s hızla hâlâ genişlemektedir. Messier kataloğunun ilk nesnesi.',
    facts: { 'Uzaklık': '2 000 pc (6 500 ışık yılı)', 'Görünür kadir': '8,4', 'Patlama': '4 Temmuz 1054', 'Pulsar periyodu': '33,5 ms', 'Genişleme hızı': '~1 500 km/s' },
  },
  {
    id: 'l-m16', name: 'Kartal Bulutsusu (M16)', kind: 'nebula', galaxy: null, ra: 274.7, dec: -13.807, distancePc: 1740, radiusPc: 10, absMag: -5.2, color: EMISSION,
    summary: '"Yaratılış Sütunları"nın bulunduğu bulutsu',
    description: 'Hubble\'ın 1995\'teki ikonik "Yaratılış Sütunları" fotoğrafı bu bulutsunun merkezindeki 4–5 ışık yılı uzunluğundaki soğuk gaz sütunlarıdır; içlerinde yeni yıldızlar doğmaktadır. Genç küme NGC 6611 bulutsuyu aydınlatır.',
    facts: { 'Uzaklık': '1 740 pc (5 700 ışık yılı)', 'Görünür kadir': '6,0', 'Yaş (küme)': '~1–2 milyon yıl' },
  },
  {
    id: 'l-m8', name: 'Lagün Bulutsusu (M8)', kind: 'nebula', galaxy: null, ra: 270.92, dec: -24.38, distancePc: 1250, radiusPc: 17, absMag: -4.5, color: EMISSION,
    summary: 'Yay takımyıldızında çıplak gözle görülen dev H II bölgesi',
    description: 'Galaktik merkez yönünde, Yay takımyıldızında; 110 × 50 ışık yılı boyutunda parlak bir emisyon bulutsusu. İçindeki "Kum Saati" yapısı ve Bok globülleri yıldız oluşumunun erken evrelerini gösterir.',
    facts: { 'Uzaklık': '1 250 pc (4 100 ışık yılı)', 'Görünür kadir': '6,0', 'Boyut': '110 × 50 ışık yılı' },
  },
  {
    id: 'l-omegacen', name: 'Omega Centauri (NGC 5139)', kind: 'cluster', galaxy: null, ra: 201.697, dec: -47.48, distancePc: 5240, radiusPc: 30, absMag: -10.3, color: OLD_CLUSTER,
    summary: 'Samanyolu\'nun en büyük küresel kümesi',
    description: '10 milyon yıldızlı, 4 milyon güneş kütleli dev küresel küme — muhtemelen Samanyolu\'nun yuttuğu bir cüce galaksinin çekirdeği. Merkezinde orta kütleli bir kara delik (~40 000 M☉) bulunduğuna dair güçlü kanıtlar var.',
    facts: { 'Uzaklık': '5 240 pc (17 000 ışık yılı)', 'Görünür kadir': '3,9', 'Kütle': '~4 × 10⁶ M☉', 'Yıldız sayısı': '~10 milyon', 'Yaş': '~12 milyar yıl' },
  },
  {
    id: 'l-47tuc', name: '47 Tucanae (NGC 104)', kind: 'cluster', galaxy: null, ra: 6.024, dec: -72.081, distancePc: 4450, radiusPc: 25, absMag: -9.4, color: OLD_CLUSTER,
    summary: 'Gökyüzündeki ikinci en parlak küresel küme',
    description: 'Küçük Macellan Bulutu\'nun hemen yanında görünse de ondan 15 kat daha yakın, Samanyolu\'nun halesine ait bir küresel küme. Yoğun çekirdeği onlarca milisaniye pulsarı barındırır.',
    facts: { 'Uzaklık': '4 450 pc (14 500 ışık yılı)', 'Görünür kadir': '4,1', 'Kütle': '~7 × 10⁵ M☉', 'Milisaniye pulsarları': '25+' },
  },
  {
    id: 'l-wd1', name: 'Westerlund 1', kind: 'cluster', galaxy: null, ra: 251.767, dec: -45.851, distancePc: 3900, radiusPc: 1.5, absMag: -11, color: YOUNG_CLUSTER,
    summary: 'Samanyolu\'nun en kütleli genç süper yıldız kümesi',
    description: 'Yalnızca 3–5 milyon yaşında, ~60 000 güneş kütleli bir "süper yıldız kümesi": yüzlerce dev yıldız, 24 Wolf-Rayet yıldızı, sarı hiperdevler ve bir magnetar (CXOU J1647). Toz nedeniyle optikte çok sönüktür; kızılötesinde parlar.',
    facts: { 'Uzaklık': '3 900 pc (12 700 ışık yılı)', 'Kütle': '~6 × 10⁴ M☉', 'Yaş': '3–5 milyon yıl', 'Wolf-Rayet yıldızı': '24' },
  },
  {
    id: 'l-m57', name: 'Halka Bulutsusu (M57)', kind: 'remnant', galaxy: null, ra: 283.396, dec: 33.029, distancePc: 787, radiusPc: 0.4, absMag: -0.7, color: PLANETARY,
    summary: 'En tanınmış gezegenimsi bulutsu',
    description: 'Çalgı takımyıldızında, ömrünün sonundaki Güneş benzeri bir yıldızın fırlattığı dış katmanlar. Ortadaki 120 000 K sıcaklığındaki beyaz cüce halkayı iyonize eder; Güneş\'in ~5 milyar yıl sonraki kaderinin bir ön izlemesidir.',
    facts: { 'Uzaklık': '787 pc (2 570 ışık yılı)', 'Görünür kadir': '8,8', 'Yaş': '~7 000 yıl', 'Merkez yıldız': 'Beyaz cüce, ~120 000 K' },
  },
  {
    id: 'l-m27', name: 'Dambıl Bulutsusu (M27)', kind: 'remnant', galaxy: null, ra: 299.90, dec: 22.72, distancePc: 380, radiusPc: 0.7, absMag: -0.4, color: PLANETARY,
    summary: 'Keşfedilen ilk gezegenimsi bulutsu (1764)',
    description: 'Messier\'nin 1764\'te keşfettiği, türünün ilk örneği. 380 pc uzaklığıyla en yakın ve en parlak gezegenimsi bulutsulardan biri; ~10 000 yıldır genişliyor.',
    facts: { 'Uzaklık': '380 pc (1 240 ışık yılı)', 'Görünür kadir': '7,5', 'Yaş': '~10 000 yıl' },
  },
  {
    id: 'l-helix', name: 'Helis Bulutsusu (NGC 7293)', kind: 'remnant', galaxy: null, ra: 337.411, dec: -20.837, distancePc: 200, radiusPc: 0.9, absMag: 1.1, color: PLANETARY,
    summary: '"Tanrı\'nın Gözü" — en yakın gezegenimsi bulutsulardan',
    description: 'Kova takımyıldızında, yalnızca 650 ışık yılı uzaklıkta; gökyüzünde Ay\'ın yarısı kadar yer kaplar. İç kenarındaki binlerce kuyruklu yıldız benzeri düğüm merkez yıldızın rüzgârıyla şekillenir.',
    facts: { 'Uzaklık': '200 pc (650 ışık yılı)', 'Görünür kadir': '7,6', 'Yaş': '~10 600 yıl' },
  },
  {
    id: 'l-casa', name: 'Cassiopeia A', kind: 'remnant', galaxy: null, ra: 350.85, dec: 58.815, distancePc: 3400, radiusPc: 2.5, absMag: -6, color: SNR,
    summary: 'Gökyüzünün en parlak radyo kaynağı; ~1680 süpernovasının kalıntısı',
    description: 'Yaklaşık 340 yıl önce patlayan bir süpernovanın kalıntısı — Samanyolu\'da gözlenen son süpernovalardan; tozdan dolayı patlama görülmemiş olabilir. Merkezindeki nötron yıldızı Chandra\'nın ilk ışık görüntüsünde keşfedildi; JWST kalıntının "Yeşil Canavar" yapısını ortaya çıkardı.',
    facts: { 'Uzaklık': '3 400 pc (11 000 ışık yılı)', 'Patlama': '~1680', 'Genişleme hızı': '4 000–6 000 km/s', 'Merkez': 'Nötron yıldızı' },
  },

  /* ---------------- Large Magellanic Cloud ---------------- */
  {
    id: 'l-30dor', name: 'Tarantula Bulutsusu (30 Doradus)', kind: 'nebula', galaxy: 'Büyük Macellan', ra: 84.76, dec: -69.14, radiusPc: 100, absMag: -10.5, color: EMISSION,
    summary: 'Yerel Grup\'un en büyük yıldız oluşum bölgesi',
    description: 'Büyük Macellan Bulutu\'nun 1 000 ışık yılı genişliğindeki dev H II bölgesi; Orion Bulutsusu\'nun yerinde olsaydı gölge düşürecek kadar parlak olurdu. Merkezindeki R136 kümesi bilinen en kütleli yıldızları barındırır; yakınında SN 1987A patladı.',
    facts: { 'Uzaklık': '49,6 kpc (LMC)', 'Görünür kadir': '8,0', 'Çap': '~1 000 ışık yılı', 'Kütle (gaz)': '~10⁶ M☉' },
  },
  {
    id: 'l-r136a1', name: 'R136a1', kind: 'star', galaxy: 'Büyük Macellan', ra: 84.6767, dec: -69.1008, radiusPc: 0.05, absMag: -12.5, color: [0.7, 0.8, 1],
    summary: 'Bilinen en kütleli ve en parlak yıldız',
    description: 'Tarantula Bulutsusu\'nun kalbindeki R136 kümesinin en parlak üyesi: yaklaşık 200 güneş kütlesi, 4,7 milyon güneş parlaklığı, 46 000 K yüzey sıcaklığı. Hidrojen yakan bir Wolf-Rayet yıldızı (WN5h); 1 milyon yıldan genç ve rüzgârlarıyla her yıl Dünya\'nın kütlesinin binlerce katını kaybediyor.',
    facts: { 'Kütle': '~196 M☉ (170–230)', 'Parlaklık': '4,7 × 10⁶ L☉', 'Sıcaklık': '46 000 K', 'Yarıçap': '~39 R☉', 'Tayf': 'WN5h', 'Yaş': '< 1 milyon yıl' },
    star: { massSolar: 196, radiusSolar: 39, temperature: 46_000, luminosity: 4.7e6, spectral: 'WN5h' },
  },
  {
    id: 'l-sn1987a', name: 'SN 1987A', kind: 'remnant', galaxy: 'Büyük Macellan', ra: 83.8667, dec: -69.2697, radiusPc: 0.6, absMag: -6, color: SNR,
    summary: 'Teleskop çağının en yakın süpernovası (1987)',
    description: '23 Şubat 1987\'de patlayan mavi süperdev Sanduleak −69° 202\'nin kalıntısı; nötrinoları ilk kez bir süpernovadan yakalanan nesne. Hubble ve JWST, patlama dalgasının 20 000 yıl önce fırlatılmış halkalara çarpışını ve 2024\'te merkezdeki nötron yıldızının izlerini gösterdi.',
    facts: { 'Uzaklık': '51,4 kpc', 'Patlama': '23 Şubat 1987', 'Ata yıldız': 'Sanduleak −69° 202 (mavi süperdev)', 'Tepe kadir': '2,9', 'Nötrino': '25 adet (Kamiokande, IMB, Baksan)' },
  },
  {
    id: 'l-wohg64', name: 'WOH G64', kind: 'star', galaxy: 'Büyük Macellan', ra: 73.294, dec: -68.3417, radiusPc: 0.05, absMag: -8.5, color: [1, 0.6, 0.4],
    summary: 'Bilinen en büyük yıldızlardan — 1 500 güneş yarıçapı',
    description: 'Büyük Macellan Bulutu\'nda, Güneş\'in yerine konsa Jüpiter\'in yörüngesini yutacak bir kırmızı hiperdev. 2024\'te VLTI ile Samanyolu dışında yakından görüntülenen ilk yıldız oldu: kalın bir toz kozasıyla sarılı ve süpernova öncesi son evrelerinde.',
    facts: { 'Yarıçap': '~1 540 R☉', 'Kütle': '~25 M☉', 'Parlaklık': '2,8 × 10⁵ L☉', 'Sıcaklık': '~3 400 K', 'Tayf': 'M7.5 I' },
    star: { massSolar: 25, radiusSolar: 1540, temperature: 3400, luminosity: 2.8e5, spectral: 'M7.5 I' },
  },
  {
    id: 'l-ngc1850', name: 'NGC 1850', kind: 'cluster', galaxy: 'Büyük Macellan', ra: 77.19, dec: -68.76, radiusPc: 12, absMag: -9.6, color: YOUNG_CLUSTER,
    summary: 'LMC\'nin genç çift kümesi — Samanyolu\'nda benzeri yok',
    description: 'Yalnızca 100 milyon yaşında ama küresel küme kadar kütleli bir yıldız kümesi; yanında 4 milyon yaşında daha da genç bir eşlikçi küme vardır. Samanyolu\'nda böyle genç, kütleli kümeler artık oluşmuyor.',
    facts: { 'Uzaklık': '49,6 kpc (LMC)', 'Görünür kadir': '9,0', 'Yaş': '~100 milyon yıl', 'Kütle': '~10⁵ M☉' },
  },

  /* ---------------- Small Magellanic Cloud ---------------- */
  {
    id: 'l-ngc346', name: 'NGC 346', kind: 'nebula', galaxy: 'Küçük Macellan', ra: 14.77, dec: -72.18, radiusPc: 50, absMag: -9, color: EMISSION,
    summary: 'Küçük Macellan Bulutu\'nun en parlak yıldız oluşum bölgesi',
    description: 'Metal fakiri Küçük Macellan Bulutu\'ndaki en aktif yıldız fabrikası; JWST burada erken evrendekine benzer koşullarda gezegen oluşturacak kadar toz bulunduğunu gösterdi.',
    facts: { 'Uzaklık': '62 kpc (SMC)', 'Görünür kadir': '10,3', 'Genç yıldız': '2 500+' },
  },
  {
    id: 'l-ngc602', name: 'NGC 602', kind: 'cluster', galaxy: 'Küçük Macellan', ra: 22.37, dec: -73.56, radiusPc: 30, absMag: -7, color: YOUNG_CLUSTER,
    summary: 'SMC\'nin kenarında yıldız oluşturan genç küme (Hubble klasiği)',
    description: 'Küçük Macellan Bulutu\'nun dış kanadında, çevresindeki N90 bulutsusunu oyarak büyüyen 5 milyon yaşındaki küme. Arka planda uzak galaksilerin göründüğü Hubble fotoğrafıyla ünlüdür.',
    facts: { 'Uzaklık': '61 kpc (SMC)', 'Yaş': '~5 milyon yıl' },
  },

  /* ---------------- Andromeda (M31) ---------------- */
  {
    id: 'l-g1', name: 'Mayall II (G1)', kind: 'cluster', galaxy: 'Andromeda', ra: 10.0942, dec: 39.5742, distancePc: KPC_M31, radiusPc: 15, absMag: -10.9, color: OLD_CLUSTER,
    summary: 'Yerel Grup\'un en kütleli küresel kümesi',
    description: 'Andromeda\'nın halesinde, merkezden 130 000 ışık yılı uzakta; Omega Centauri\'nin iki katı kütlede, 10 milyon güneş kütleli bir küresel küme. Omega Centauri gibi muhtemelen yutulmuş bir cüce galaksinin çekirdeği; merkezinde ~20 000 M☉\'lik bir kara delik olabilir.',
    facts: { 'Uzaklık': '765 kpc (M31 halesi)', 'Görünür kadir': '13,7', 'Kütle': '~10⁷ M☉', 'Yaş': '~12 milyar yıl' },
  },
  {
    id: 'l-ngc206', name: 'NGC 206', kind: 'cluster', galaxy: 'Andromeda', ra: 10.1, dec: 40.73, radiusPc: 500, absMag: -14, color: YOUNG_CLUSTER,
    summary: 'Andromeda\'nın dev yıldız bulutu',
    description: 'Andromeda\'nın güneybatı sarmal kolunda 4 000 ışık yılı genişliğinde bir OB yıldız bulutu; Yerel Grup\'taki en zengin genç yıldız topluluğu. Küçük bir teleskopla bile M31 diskinde parlak bir leke olarak seçilir.',
    facts: { 'Uzaklık': '765 kpc (M31)', 'Çap': '~4 000 ışık yılı', 'Yaş': '~10–50 milyon yıl' },
  },
  {
    id: 'l-m31v1', name: 'Hubble\'ın V1 Sefeidi', kind: 'star', galaxy: 'Andromeda', ra: 10.3638, dec: 41.1696, radiusPc: 0.05, absMag: -5.5, color: [1, 0.95, 0.8],
    summary: 'Evrenin boyutunu değiştiren yıldız (1923)',
    description: 'Edwin Hubble\'ın 1923\'te Andromeda\'da bulduğu değişen yıldız; periyot-parlaklık ilişkisi "Andromeda Bulutsusu"nun Samanyolu dışında ayrı bir galaksi olduğunu kanıtladı. 31,4 günlük bir Sefeid; bugün Hubble Uzay Teleskobu da onu gözledi.',
    facts: { 'Uzaklık': '765 kpc (M31)', 'Periyot': '31,4 gün', 'Görünür kadir': '18,5–19,5', 'Tür': 'Klasik Sefeid', 'Keşif': 'Ekim 1923, Hubble, 100 inç Hooker' },
    star: { massSolar: 7, radiusSolar: 110, temperature: 5800, luminosity: 1.2e4, spectral: 'F–G Ib' },
  },
  {
    id: 'l-sandr', name: 'S Andromedae (SN 1885A)', kind: 'remnant', galaxy: 'Andromeda', ra: 10.6797, dec: 41.2678, radiusPc: 1.2, absMag: -4, color: SNR,
    summary: 'Samanyolu dışında gözlenen ilk süpernova',
    description: '1885\'te Andromeda\'nın merkezine 16 yay saniyesi uzaklıkta parlayan, çıplak gözle neredeyse görülebilen (kadir 5,8) süpernova. Hubble 1988\'de kalıntısını Andromeda\'nın şişkinliğine karşı karanlık bir demir bulutu olarak buldu.',
    facts: { 'Patlama': '20 Ağustos 1885', 'Tepe kadir': '5,8', 'Tür': 'Ia (alt-ışıklı)', 'Kalıntı': 'Demir zengini, ~13 000 km/s' },
  },

  /* ---------------- Triangulum (M33) ---------------- */
  {
    id: 'l-ngc604', name: 'NGC 604', kind: 'nebula', galaxy: 'M33', ra: 23.6396, dec: 30.7833, radiusPc: 230, absMag: -12.6, color: EMISSION,
    summary: 'Yerel Grup\'un en büyük H II bölgelerinden',
    description: 'Üçgen Galaksisi\'nde 1 500 ışık yılı genişliğinde, Orion Bulutsusu\'ndan 100 kat daha büyük bir yıldız doğumevi; 200\'den fazla sıcak dev yıldızın oyduğu dev bir gaz kabarcığı. Tarantula ile birlikte Yerel Grup\'un en büyük bulutsularından biridir.',
    facts: { 'Uzaklık': '840 kpc (M33)', 'Çap': '~1 500 ışık yılı', 'Görünür kadir': '12', 'Kütleli yıldız': '200+' },
  },
  ...PULSARS,
];

/* ---------------- helpers for star-type landmarks ---------------- */

export function landmarkStarBodies(def: LandmarkDef): BodyData[] {
  if (def.pulsar) return pulsarBodies(def);
  const s = def.star!;
  return [starBody(def.id, def.name, s.massSolar, s.radiusSolar, s.temperature, def.description, { ...def.facts, 'Tayf': s.spectral })];
}

export function landmarkStarInfo(def: LandmarkDef, positionPc: Vector3): StarInfo {
  if (def.pulsar) return pulsarInfo(def, positionPc);
  const s = def.star!;
  return syntheticInfo(def.name, positionPc, s.massSolar, s.radiusSolar, s.temperature, s.luminosity, s.spectral);
}
