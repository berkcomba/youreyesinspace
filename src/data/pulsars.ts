import type { Vector3 } from 'three';
import { AU_KM } from '../core/constants';
import { SUN_MASS_KG, SUN_RADIUS_KM } from '../astro/stellar';
import type { StarInfo } from './StarCatalog';
import type { BodyData, PoleRaDec } from './types';
import type { LandmarkDef } from './landmarks';
import { decimalYearJd, semiMajorKm, starBody, syntheticInfo } from './blackholes';

/**
 * Real pulsars (rotating neutron stars). Each one is a deep-sky landmark of kind `pulsar`
 * and a visitable system: the neutron star itself (with its sweeping beams), plus real
 * companions – the first exoplanets ever found (PSR B1257+12), the Hulse–Taylor binary
 * neutron star, white-dwarf companions of millisecond pulsars.
 *
 * Periods, distances, ages and field strengths follow the ATNF Pulsar Catalogue; beam
 * geometry (magnetic tilt, opening angle) is illustrative.
 */
export interface PulsarParams {
  /** spin period (ms) */
  periodMs: number;
  massSolar: number;
  radiusKm: number;
  /** effective surface temperature (K) used for the thermal glow */
  temperature: number;
  /** spin axis */
  pole: PoleRaDec;
  /** angle between magnetic and spin axis (deg) */
  magneticTilt: number;
  /** half opening angle of each beam (deg) */
  beamHalfAngle: number;
  /** beam length in stellar radii */
  beamLength: number;
  beamColor: [number, number, number];
  /** extra bodies of the system; `parent` must reference the pulsar id */
  companions?: (pulsarId: string) => BodyData[];
}

const EARTH_MASS_KG = 5.9722e24;
const EPOCH = decimalYearJd(2000.0);
const RADIO: [number, number, number] = [0.55, 0.85, 1.0];
const GAMMA: [number, number, number] = [0.85, 0.6, 1.0];
const MAGNETAR: [number, number, number] = [1.0, 0.55, 0.75];
const PULSAR_SPRITE: [number, number, number] = [0.65, 0.9, 1.0];

function pulsarBody(def: LandmarkDef): BodyData {
  const p = def.pulsar!;
  return {
    id: def.id, name: def.name, type: 'pulsar',
    radius: p.radiusKm,
    mass: p.massSolar * SUN_MASS_KG,
    rotationPeriod: p.periodMs / 3.6e6,
    pole: p.pole,
    appearance: { kind: 'pulsar', seed: (def.id.length * 17) % 991 + 3, magneticTilt: p.magneticTilt, beamHalfAngle: p.beamHalfAngle, beamLength: p.beamLength, beamColor: p.beamColor },
    temperature: p.temperature,
    description: def.description,
    facts: def.facts,
  };
}

export function pulsarBodies(def: LandmarkDef): BodyData[] {
  const p = def.pulsar!;
  return [pulsarBody(def), ...(p.companions?.(def.id) ?? [])];
}

export function pulsarInfo(def: LandmarkDef, positionPc: Vector3): StarInfo {
  const p = def.pulsar!;
  const rSolar = p.radiusKm / SUN_RADIUS_KM;
  const lum = rSolar * rSolar * (p.temperature / 5772) ** 4;
  return syntheticInfo(def.name, positionPc, p.massSolar, rSolar, p.temperature, lum, 'NS');
}

/** A rocky pulsar planet (PSR B1257+12 system) */
function pulsarPlanet(id: string, name: string, parent: string, massEarth: number, radiusKm: number, aAU: number, e: number, periodDays: number, M0: number, seed: number, description: string, facts: Record<string, string>): BodyData {
  return {
    id, name, type: 'planet', parent,
    radius: radiusKm, mass: massEarth * EARTH_MASS_KG, albedo: 0.2, rotationPeriod: 'sync',
    orbit: { kind: 'simple', a: aAU * AU_KM, e, i: 50, node: 110, argPeri: 0, M0, epoch: EPOCH, period: periodDays, frame: 'ecliptic' },
    appearance: { kind: 'terrestrial', seed, landLow: [0.18, 0.17, 0.2], landMid: [0.3, 0.28, 0.32], landHigh: [0.45, 0.42, 0.46], craters: 0.8, roughness: 1.1, variation: 0.4 },
    description, facts,
  };
}

/** White-dwarf companion */
function whiteDwarf(id: string, name: string, parent: string, massSolar: number, radiusSolar: number, temperature: number, periodDays: number, totalMassSolar: number, e: number, description: string, facts: Record<string, string>): BodyData {
  return starBody(id, name, massSolar, radiusSolar, temperature, description, facts, {
    parent,
    orbit: { kind: 'simple', a: semiMajorKm(periodDays, totalMassSolar * SUN_MASS_KG), e, i: 42, node: 20, argPeri: 0, M0: 0, epoch: EPOCH, period: periodDays, frame: 'ecliptic' },
  });
}

export const PULSARS: LandmarkDef[] = [
  {
    id: 'l-crabpsr', name: 'Yengeç Pulsarı (PSR B0531+21)', kind: 'pulsar', galaxy: null, ra: 83.633, dec: 22.0145, distancePc: 2000, radiusPc: 0.05, absMag: 4.5, color: PULSAR_SPRITE,
    summary: '1054 süpernovasının kalbindeki saniyede 30 dönen nötron yıldızı',
    description: 'Yengeç Bulutsusu\'nu besleyen genç pulsar: 1054 süpernovasında çöken çekirdek, bugün saniyede 30 kez dönüyor ve dönme enerjisini (Güneş\'in toplam ışınımının 100 000 katı) rüzgâr ve ışınlarla bulutsuya pompalıyor. Radyo, optik, X-ışını ve gama bandında atan ilk pulsarlardan; optik atımlarıyla keşfedilen (1969) ilk pulsardır.',
    facts: { 'Periyot': '33,4 ms (30 Hz)', 'Yavaşlama': '4,2 × 10⁻¹³ s/s', 'Karakteristik yaş': '~1 240 yıl (gerçek: 970)', 'Manyetik alan': '3,8 × 10¹² G', 'Dönme-enerjisi kaybı': '4,5 × 10³⁸ erg/s', 'Uzaklık': '2 000 pc (6 500 ışık yılı)', 'Keşif': '1968, Staelin & Reifenstein (NRAO)' },
    pulsar: { periodMs: 33.392, massSolar: 1.4, radiusKm: 12, temperature: 1.6e6, pole: { ra: 83.633, dec: 22.0145 + 64 }, magneticTilt: 55, beamHalfAngle: 12, beamLength: 60, beamColor: RADIO },
  },
  {
    id: 'l-vela', name: 'Vela Pulsarı (PSR B0833-45)', kind: 'pulsar', galaxy: null, ra: 128.836, dec: -45.176, distancePc: 287, radiusPc: 0.05, absMag: 5, color: PULSAR_SPRITE,
    summary: 'Gökyüzünün en parlak gama-ışını kaynağı; "glitch" yapan pulsar',
    description: 'Vela Süpernova Kalıntısı\'nın merkezindeki 11 000 yaşındaki pulsar. Gökyüzünün en parlak sürekli gama-ışını kaynağıdır ve düzenli olarak "glitch" yapar: dönüşü aniden hızlanır — nötron yıldızının süperakışkan iç yapısının en doğrudan kanıtı. Keşfi (1968) pulsarların süpernovalarda doğduğunu kanıtladı.',
    facts: { 'Periyot': '89,3 ms', 'Karakteristik yaş': '11 300 yıl', 'Manyetik alan': '3,4 × 10¹² G', 'Uzaklık': '287 pc (936 ışık yılı)', 'Glitch sıklığı': '~3 yılda bir', 'Keşif': '1968, Large, Vaughan & Mills (Molonglo)' },
    pulsar: { periodMs: 89.33, massSolar: 1.4, radiusKm: 12, temperature: 1.1e6, pole: { ra: 128.836, dec: -45.176 + 70 }, magneticTilt: 70, beamHalfAngle: 10, beamLength: 50, beamColor: RADIO },
  },
  {
    id: 'l-b1919', name: 'PSR B1919+21 (LGM-1)', kind: 'pulsar', galaxy: null, ra: 290.437, dec: 21.884, distancePc: 300, radiusPc: 0.05, absMag: 6, color: PULSAR_SPRITE,
    summary: 'Keşfedilen ilk pulsar — Jocelyn Bell Burnell, 1967',
    description: '28 Kasım 1967\'de Cambridge\'de doktora öğrencisi Jocelyn Bell Burnell\'in kayıt kâğıtlarında fark ettiği 1,337 saniyelik düzenli atımlar. Yarı şaka "LGM-1" (Little Green Men) adı verildi; dönen nötron yıldızı açıklaması 1968\'de geldi ve Hewish 1974 Nobel\'ini aldı. Atım profilleri Joy Division\'ın "Unknown Pleasures" kapağında ölümsüzleşti.',
    facts: { 'Periyot': '1,3373 s', 'Karakteristik yaş': '16 milyon yıl', 'Manyetik alan': '1,4 × 10¹² G', 'Uzaklık': '~300 pc (~1 000 ışık yılı)', 'Keşif': '28 Kasım 1967, Bell Burnell & Hewish (Mullard, Cambridge)' },
    pulsar: { periodMs: 1337.3, massSolar: 1.4, radiusKm: 12, temperature: 6e5, pole: { ra: 290.437, dec: 21.884 - 60 }, magneticTilt: 40, beamHalfAngle: 7, beamLength: 45, beamColor: RADIO },
  },
  {
    id: 'l-lich', name: 'PSR B1257+12 (Lich)', kind: 'pulsar', galaxy: null, ra: 195.013, dec: 12.682, distancePc: 600, radiusPc: 0.05, absMag: 6, color: PULSAR_SPRITE,
    summary: 'İlk keşfedilen ötegezegenlerin yıldızı (1992)',
    description: 'Aleksander Wolszczan\'ın 1990\'da Arecibo ile bulduğu milisaniye pulsarı; atımlarındaki mikrosaniyelik düzensizlikler 1992\'de Güneş Sistemi dışındaki ilk gezegenleri ortaya çıkardı. Üç gezegeni (Draugr, Poltergeist, Phobetor) muhtemelen süpernovadan arta kalan diskte oluştu; pulsarın ışınımıyla sürekli yıkanan ölü dünyalar.',
    facts: { 'Periyot': '6,219 ms (161 Hz)', 'Karakteristik yaş': '~3 milyar yıl', 'Manyetik alan': '8,8 × 10⁸ G', 'Uzaklık': '~600 pc (~2 000 ışık yılı)', 'Gezegenler': 'Draugr, Poltergeist, Phobetor', 'Keşif': '1990, Wolszczan & Frail (Arecibo)' },
    pulsar: {
      periodMs: 6.219, massSolar: 1.4, radiusKm: 12, temperature: 8e5, pole: { ra: 195.013, dec: 12.682 + 50 }, magneticTilt: 60, beamHalfAngle: 14, beamLength: 60, beamColor: RADIO,
      companions: (id) => [
        pulsarPlanet(`${id}-a`, 'Draugr (PSR B1257+12 b)', id, 0.02, 1500, 0.19, 0.0, 25.262, 40, 71,
          'Bilinen en küçük kütleli ötegezegen: Ay\'ın yaklaşık iki katı kütlede. 1994\'te keşfedildi.', { 'Kütle': '0,020 M⊕', 'Yörünge': '0,19 AU · 25,26 gün' }),
        pulsarPlanet(`${id}-b`, 'Poltergeist (PSR B1257+12 c)', id, 4.3, 9500, 0.36, 0.0186, 66.5419, 200, 72,
          '1992\'de duyurulan ilk ötegezegenlerden biri; dört Dünya kütlesinde bir süper-Dünya.', { 'Kütle': '4,3 M⊕', 'Yörünge': '0,36 AU · 66,54 gün', 'Keşif': '1992' }),
        pulsarPlanet(`${id}-c`, 'Phobetor (PSR B1257+12 d)', id, 3.9, 9300, 0.46, 0.0252, 98.2114, 310, 73,
          '1992\'de Poltergeist ile birlikte keşfedilen ikinci gezegen; Poltergeist ile 3:2 rezonansa yakındır.', { 'Kütle': '3,9 M⊕', 'Yörünge': '0,46 AU · 98,21 gün', 'Keşif': '1992' }),
      ],
    },
  },
  {
    id: 'l-j1748', name: 'PSR J1748-2446ad', kind: 'pulsar', galaxy: null, ra: 267.02, dec: -24.768, distancePc: 5900, radiusPc: 0.05, absMag: 6, color: PULSAR_SPRITE,
    summary: 'Bilinen en hızlı dönen pulsar: saniyede 716 tur',
    description: 'Terzan 5 küresel kümesinde 2004\'te keşfedilen milisaniye pulsarı. Saniyede 716 kez döner; ekvatoru ışık hızının dörtte birine yakın hızda hareket eder — nötron yıldızı maddesinin dayanabileceği sınıra çok yakın. Şişmiş bir yoldaş yıldızla 26 saatlik tutulmalı bir yörüngededir.',
    facts: { 'Periyot': '1,396 ms (716 Hz)', 'Ekvator hızı': '~0,24 c', 'Yoldaş': '~0,14 M☉, 1,09 günlük yörünge', 'Küme': 'Terzan 5', 'Uzaklık': '~5 900 pc (~19 000 ışık yılı)', 'Keşif': '2004, Hessels ve ark. (GBT)' },
    pulsar: {
      periodMs: 1.3961, massSolar: 1.4, radiusKm: 12, temperature: 9e5, pole: { ra: 267.02, dec: -24.768 + 75 }, magneticTilt: 75, beamHalfAngle: 16, beamLength: 60, beamColor: RADIO,
      companions: (id) => [
        starBody(`${id}-comp`, 'PSR J1748-2446ad yoldaşı', 0.14, 0.3, 3600, 'Pulsarın ışınımıyla şişmiş, Roche lobunu dolduran düşük kütleli yoldaş; yörüngenin %40\'ında pulsarı tutar.', { 'Kütle': '~0,14 M☉', 'Yörünge periyodu': '26,3 saat' }, {
          parent: id,
          orbit: { kind: 'simple', a: semiMajorKm(1.0944, 1.54 * SUN_MASS_KG), e: 0, i: 65, node: 30, argPeri: 0, M0: 0, epoch: EPOCH, period: 1.0944, frame: 'ecliptic' },
        }),
      ],
    },
  },
  {
    id: 'l-hulsetaylor', name: 'Hulse–Taylor Çifti (PSR B1913+16)', kind: 'pulsar', galaxy: null, ra: 288.867, dec: 16.1075, distancePc: 5250, radiusPc: 0.05, absMag: 6, color: PULSAR_SPRITE,
    summary: 'Kütleçekim dalgalarının ilk kanıtı — 1993 Nobel',
    description: '1974\'te Hulse ve Taylor\'ın Arecibo ile bulduğu ilk çift nötron yıldızı: 59 ms\'lik pulsar, görünmeyen bir nötron yıldızının etrafında 7,75 saatte, Güneş\'in çapından biraz büyük bir yörüngede döner. Yörünge, genel göreliliğin kütleçekim dalgası öngörüsüyle tam uyumlu olarak yılda 3,5 m küçülür; ~300 milyon yıl sonra birleşecekler.',
    facts: { 'Periyot': '59,03 ms', 'Yörünge periyodu': '7,75 saat', 'Dış merkezlik': '0,617', 'Kütleler': '1,440 + 1,389 M☉', 'Periastron ilerlemesi': '4,2°/yıl', 'Yörünge küçülmesi': '3,5 m/yıl', 'Birleşme': '~300 milyon yıl sonra', 'Uzaklık': '~5 kpc (belirsiz)', 'Keşif': '1974, Hulse & Taylor (Arecibo)' },
    pulsar: {
      periodMs: 59.03, massSolar: 1.44, radiusKm: 12, temperature: 7e5, pole: { ra: 288.867, dec: 16.1075 + 55 }, magneticTilt: 50, beamHalfAngle: 9, beamLength: 50, beamColor: RADIO,
      companions: (id) => [{
        id: `${id}-comp`, name: 'PSR B1913+16 yoldaşı', type: 'pulsar', parent: id,
        radius: 12, mass: 1.389 * SUN_MASS_KG, rotationPeriod: 1, pole: { ra: 288.867, dec: 16.1075 + 55 },
        orbit: { kind: 'simple', a: semiMajorKm(0.322997, 2.83 * SUN_MASS_KG), e: 0.6171, i: 47, node: 15, argPeri: 226, M0: 0, epoch: EPOCH, period: 0.322997, frame: 'ecliptic' },
        appearance: { kind: 'pulsar', seed: 44, magneticTilt: 0, beamHalfAngle: 0, beamLength: 0, beamColor: RADIO, quiet: true },
        temperature: 5e5,
        description: 'Hulse–Taylor çiftinin görünmeyen ikinci nötron yıldızı; atımları bize ulaşmaz (ışınları Dünya\'yı süpürmüyor ya da radyo-sessiz). Varlığı pulsarın atım zamanlamasındaki Doppler kaymalarından bilinir.',
        facts: { 'Kütle': '1,389 M☉', 'Tür': 'Nötron yıldızı (sessiz)' },
      }],
    },
  },
  {
    id: 'l-geminga', name: 'Geminga (PSR J0633+1746)', kind: 'pulsar', galaxy: null, ra: 98.476, dec: 17.77, distancePc: 250, radiusPc: 0.05, absMag: 6, color: PULSAR_SPRITE,
    summary: 'Radyo-sessiz gama pulsarı; adı Milano lehçesinde "orada yok"',
    description: '1972\'de SAS-2 uydusunun bulduğu gizemli gama-ışını kaynağı; 20 yıl boyunca hiçbir radyo ya da optik karşılığı bulunamadı ("Geminga": İkizler\'deki gama kaynağı — ve Milano lehçesinde "gh\'è minga", yani "orada yok"). 1992\'de ROSAT ile 237 ms\'lik X-ışını atımları saptandı. Bize en yakın pulsarlardan biridir.',
    facts: { 'Periyot': '237 ms', 'Karakteristik yaş': '342 000 yıl', 'Manyetik alan': '1,6 × 10¹² G', 'Uzaklık': '250 pc (815 ışık yılı)', 'Bant': 'Gama ve X-ışını (radyo-sessiz)', 'Keşif': '1972 (SAS-2) · pulsar: 1992, Halpern & Holt (ROSAT)' },
    pulsar: { periodMs: 237.1, massSolar: 1.4, radiusKm: 12, temperature: 5e5, pole: { ra: 98.476, dec: 17.77 + 60 }, magneticTilt: 80, beamHalfAngle: 20, beamLength: 50, beamColor: GAMMA },
  },
  {
    id: 'l-j0437', name: 'PSR J0437-4715', kind: 'pulsar', galaxy: null, ra: 69.316, dec: -47.2525, distancePc: 156.8, radiusPc: 0.05, absMag: 7, color: PULSAR_SPRITE,
    summary: 'En yakın ve en parlak milisaniye pulsarı; beyaz cüce yoldaşı var',
    description: '1993\'te Parkes ile keşfedilen, bize en yakın milisaniye pulsarı. 5,76 ms\'lik periyodu bir atom saati kadar kararlıdır; yörüngesi ve uzaklığı pulsar zamanlamasıyla mikrosaniye hassasiyetle bilinir. Pulsar zamanlama dizilerinin (nanohertz kütleçekim dalgası dedektörleri) temel direğidir. 5,74 günde bir dolanan 0,25 güneş kütleli helyum beyaz cücesi vardır.',
    facts: { 'Periyot': '5,757 ms (174 Hz)', 'Karakteristik yaş': '6,7 milyar yıl', 'Kütle': '1,44 M☉', 'Yoldaş': 'He beyaz cücesi, 0,25 M☉, 5,74 gün', 'Uzaklık': '156,8 pc (511 ışık yılı)', 'Keşif': '1993, Johnston ve ark. (Parkes)' },
    pulsar: {
      periodMs: 5.7575, massSolar: 1.44, radiusKm: 12, temperature: 7e5, pole: { ra: 69.316, dec: -47.2525 + 48 }, magneticTilt: 35, beamHalfAngle: 15, beamLength: 60, beamColor: RADIO,
      companions: (id) => [whiteDwarf(`${id}-wd`, 'PSR J0437-4715 B (beyaz cüce)', id, 0.254, 0.02, 4000, 5.7410, 1.69, 0,
        'Pulsarı milisaniye hızına çıkaran madde aktarımının kalıntısı: artık soğuk bir helyum beyaz cücesi.', { 'Kütle': '0,254 M☉', 'Yörünge periyodu': '5,741 gün', 'Tür': 'He beyaz cücesi' })],
    },
  },
  {
    id: 'l-sgr1806', name: 'SGR 1806−20 (Magnetar)', kind: 'pulsar', galaxy: null, ra: 272.164, dec: -20.411, distancePc: 8700, radiusPc: 0.05, absMag: 5, color: [1, 0.75, 0.85],
    summary: 'Evrenin en güçlü mıknatısı; 2004 dev patlaması Dünya\'nın iyonosferini sarstı',
    description: 'Manyetik alanı 10¹⁵ gauss\'u aşan bir magnetar — Dünya\'nınkinin katrilyon katı. 27 Aralık 2004\'te yüzeyindeki kabuk kırılmasıyla 0,2 saniyede Güneş\'in 250 000 yılda yaydığı enerjiyi saldı; 50 000 ışık yılı öteden Dünya\'nın üst atmosferini iyonize etti ve uyduların dedektörlerini doyurdu. Yavaş dönen (7,56 s) ama muazzam alanlı bu yıldızlar yumuşak gama tekrarlayıcılarıdır (SGR).',
    facts: { 'Periyot': '7,56 s', 'Manyetik alan': '~2 × 10¹⁵ G', 'Karakteristik yaş': '~1 500 yıl', 'Dev patlama': '27 Aralık 2004 · ~10⁴⁶ erg', 'Uzaklık': '~8 700 pc (~28 000 ışık yılı)', 'Keşif': '1979 (gama patlamaları) · periyot: 1998, Kouveliotou ve ark.' },
    pulsar: { periodMs: 7560, massSolar: 1.4, radiusKm: 12, temperature: 4e6, pole: { ra: 272.164, dec: -20.411 + 65 }, magneticTilt: 30, beamHalfAngle: 18, beamLength: 40, beamColor: MAGNETAR },
  },
];
