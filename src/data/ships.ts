import { C_KM_S } from '../core/constants';

/**
 * Vehicles for the mission planner.
 *
 * Real spacecraft are modelled with an impulsive Δv budget measured from a 300 km Earth parking
 * orbit (launch-vehicle upper stage + on-board propellant), so Lambert / patched-conic transfers
 * can be checked against what the vehicle could really do. Fictional ships carry their
 * franchise's stated performance (warp factors, hyperdrive class, continuous-thrust drive);
 * their names are used only to identify the vehicles and their models are original
 * approximations (see NOTICE.md).
 */
export type ProceduralShip = 'saucer' | 'freighter' | 'xwing' | 'corvette' | 'capsule' | 'rocket';

export interface WarpFactor {
  label: string;
  /** speed in units of c */
  c: number;
}

export type Propulsion =
  | {
      kind: 'impulsive';
      /** total Δv available from a 300 km Earth parking orbit (km/s) */
      dvBudget: number;
      /** low-thrust vehicle: the impulsive numbers are an approximation */
      lowThrust?: boolean;
    }
  | {
      kind: 'brachistochrone';
      /** available continuous accelerations (g) */
      accelsG: number[];
      /** maximum speed as fraction of c (relativity is ignored below this) */
      maxC: number;
    }
  | {
      kind: 'warp';
      /** sub-light cruise as fraction of c */
      impulseC: number;
      warpFactors: WarpFactor[];
    }
  | {
      kind: 'hyperdrive';
      sublightC: number;
      /** effective hyperspace speed (c) */
      hyperC: number;
      hyperLabel: string;
    };

export interface ShipDef {
  id: string;
  name: string;
  /** short line under the name */
  tagline: string;
  origin: 'real' | 'fiction';
  franchise?: string;
  lengthM: number;
  massKg: number;
  /** bounding radius used for the body (km) */
  radiusKm: number;
  model: { kind: 'glb'; file: string; representative?: boolean } | { kind: 'procedural'; shape: ProceduralShip };
  propulsion: Propulsion;
  description: string;
  facts: Record<string, string>;
}

const TNG_WARP: WarpFactor[] = [
  { label: 'Warp 1', c: 1 }, { label: 'Warp 2', c: 10 }, { label: 'Warp 3', c: 39 }, { label: 'Warp 4', c: 102 },
  { label: 'Warp 5', c: 214 }, { label: 'Warp 6', c: 392 }, { label: 'Warp 7', c: 656 }, { label: 'Warp 8', c: 1024 },
  { label: 'Warp 9', c: 1516 }, { label: 'Warp 9,6 (azami)', c: 1909 }, { label: 'Warp 9,9 (acil)', c: 3053 },
];
const TOS_WARP: WarpFactor[] = [1, 2, 3, 4, 5, 6, 7, 8].map((w) => ({ label: `Warp ${w}${w === 8 ? ' (acil)' : ''}`, c: w * w * w }));

export const SHIPS: ShipDef[] = [
  /* ---------------- real vehicles ---------------- */
  {
    id: 'voyager', name: 'Voyager', tagline: 'Titan IIIE-Centaur · 1977 · Büyük Tur', origin: 'real',
    lengthM: 3.7, massKg: 825, radiusKm: 0.0065,
    model: { kind: 'glb', file: 'voyager' },
    propulsion: { kind: 'impulsive', dvBudget: 7.3 },
    description: 'İki Voyager, Titan IIIE-Centaur ile Jüpiter\'e doğrudan (C3 ≈ 102 km²/s²) fırlatıldı; Jüpiter ve Satürn sapanlarıyla dış Güneş Sistemi\'ni geçip yıldızlararası uzaya çıktılar.',
    facts: { 'Kalkış Δv (300 km park yörüngesinden)': '~7,1 km/s', 'Araç üstü Δv': '~0,2 km/s', 'Güç': 'RTG, 470 W (1977)' },
  },
  {
    id: 'newhorizons', name: 'New Horizons', tagline: 'Atlas V 551 + Star 48B · 2006 · en hızlı fırlatma', origin: 'real',
    lengthM: 2.7, massKg: 478, radiusKm: 0.0015,
    model: { kind: 'glb', file: 'pioneer', representative: true },
    propulsion: { kind: 'impulsive', dvBudget: 9.2 },
    description: 'Dünya\'dan şimdiye kadar en yüksek hızla (16,26 km/s) ayrılan araç; Jüpiter sapanıyla Plüton\'a 9,5 yılda ulaştı.',
    facts: { 'Fırlatma C3': '158 km²/s²', 'Kalkış Δv': '~8,9 km/s', 'Araç üstü Δv': '~0,3 km/s' },
  },
  {
    id: 'parker', name: 'Parker Solar Probe', tagline: 'Delta IV Heavy + Star 48BV · 2018', origin: 'real',
    lengthM: 3, massKg: 685, radiusKm: 0.0015,
    model: { kind: 'glb', file: 'parker' },
    propulsion: { kind: 'impulsive', dvBudget: 9.0 },
    description: 'Güneş\'e yaklaşmak için Dünya\'nın yörünge hızını yedi Venüs sapanıyla söndürdü; insan yapımı en hızlı nesne (192 km/s).',
    facts: { 'Fırlatma C3': '154 km²/s²', 'Kalkış Δv': '~8,8 km/s', 'Venüs sapanı': '7 kez' },
  },
  {
    id: 'juno', name: 'Juno', tagline: 'Atlas V 551 · 2011 · Jüpiter yörüngesi', origin: 'real',
    lengthM: 20, massKg: 3625, radiusKm: 0.01,
    model: { kind: 'glb', file: 'juno' },
    propulsion: { kind: 'impulsive', dvBudget: 6.6 },
    description: 'Doğrudan Jüpiter\'e yetecek enerjiyle fırlatılamadı: 2 yıl sonra Dünya sapanıyla 3,9 km/s kazandı ve 2016\'da Jüpiter yörüngesine girdi.',
    facts: { 'Fırlatma C3': '31 km²/s²', 'Kalkış Δv': '~4,6 km/s', 'Araç üstü Δv': '~2,0 km/s (JOI 0,54)' },
  },
  {
    id: 'galileo', name: 'Galileo', tagline: 'Uzay Mekiği + IUS · 1989 · VEEGA', origin: 'real',
    lengthM: 5.3, massKg: 2380, radiusKm: 0.005,
    model: { kind: 'glb', file: 'galileo' },
    propulsion: { kind: 'impulsive', dvBudget: 5.3 },
    description: 'Mekiğin yük bölmesinden küçük bir IUS kademesiyle bırakıldı; Jüpiter\'e ancak Venüs–Dünya–Dünya sapan zinciriyle (VEEGA) 6 yılda ulaşabildi.',
    facts: { 'Fırlatma C3': '~14 km²/s²', 'Kalkış Δv': '~3,8 km/s', 'Araç üstü Δv': '~1,5 km/s' },
  },
  {
    id: 'cassini', name: 'Cassini–Huygens', tagline: 'Titan IVB-Centaur · 1997 · Satürn', origin: 'real',
    lengthM: 6.8, massKg: 5712, radiusKm: 0.006,
    model: { kind: 'glb', file: 'galileo', representative: true },
    propulsion: { kind: 'impulsive', dvBudget: 6.4 },
    description: 'Venüs–Venüs–Dünya–Jüpiter sapanlarıyla Satürn\'e 6,7 yılda vardı; 13 yıl Satürn sistemini inceledi, Huygens Titan\'a indi.',
    facts: { 'Fırlatma C3': '16,6 km²/s²', 'Kalkış Δv': '~4,0 km/s', 'Araç üstü Δv': '~2,4 km/s' },
  },
  {
    id: 'dawn', name: 'Dawn', tagline: 'Delta II · 2007 · iyon motoru · Vesta + Ceres', origin: 'real',
    lengthM: 19.7, massKg: 1218, radiusKm: 0.01,
    model: { kind: 'glb', file: 'dawn' },
    propulsion: { kind: 'impulsive', dvBudget: 14.3, lowThrust: true },
    description: 'Ksenon iyon motorlarıyla 11 km/s Δv üretti — kimyasal roketin erişemeyeceği bütçe; iki ayrı gövdenin yörüngesine giren ilk araç. (Düşük itki: buradaki anlık-itki hesabı yaklaşıktır.)',
    facts: { 'Fırlatma C3': '11 km²/s²', 'Araç üstü Δv': '11,5 km/s (iyon)', 'İtki': '90 mN' },
  },
  {
    id: 'orion', name: 'Orion + SLS', tagline: 'Artemis · mürettebatlı · 2022–', origin: 'real',
    lengthM: 8, massKg: 26_500, radiusKm: 0.012,
    model: { kind: 'procedural', shape: 'capsule' },
    propulsion: { kind: 'impulsive', dvBudget: 4.6 },
    description: 'NASA\'nın derin uzay mürettebat kapsülü; SLS\'in üst kademesi Ay\'a transfer (TLI) için ~3,2 km/s, Orion\'un servis modülü ~1,3 km/s sağlar. Mars için tek başına yetersiz.',
    facts: { 'Mürettebat': '4', 'Servis modülü Δv': '~1,3 km/s', 'TLI (ICPS)': '~3,2 km/s' },
  },
  {
    id: 'starship', name: 'Starship (yörüngede ikmalli)', tagline: 'SpaceX · tam yakıtlı · 100 t yük', origin: 'real',
    lengthM: 52, massKg: 1_300_000, radiusKm: 0.03,
    model: { kind: 'procedural', shape: 'rocket' },
    propulsion: { kind: 'impulsive', dvBudget: 6.9 },
    description: 'Alçak Dünya yörüngesinde tankerlerle tam doldurulmuş Starship, 100 t yükle ~6,9 km/s Δv taşır: Mars\'a doğrudan gidip atmosferik frenlemeyle inebilir.',
    facts: { 'Yük': '100 t', 'Tam yakıtlı Δv (LEO)': '~6,9 km/s', 'Motor': '6 × Raptor' },
  },

  /* ---------------- fiction ---------------- */
  {
    id: 'enterprise-d', name: 'USS Enterprise NCC-1701-D', tagline: 'Star Trek: TNG · Galaxy sınıfı', origin: 'fiction', franchise: 'Star Trek',
    lengthM: 642.5, massKg: 4.5e9, radiusKm: 0.32,
    model: { kind: 'procedural', shape: 'saucer' },
    propulsion: { kind: 'warp', impulseC: 0.25, warpFactors: TNG_WARP },
    description: 'Galaxy sınıfı yıldız gemisi; impulse motorlarla 0,25c, warp motoruyla uzayı bükerek ışıktan hızlı. TNG ölçeğinde warp 9,6 ≈ 1 909 c: Proxima\'ya 19 saat, galaksinin karşı ucuna ~50 yıl.',
    facts: { 'Mürettebat': '1 014', 'Seyir hızı': 'Warp 6 (392 c)', 'Azami': 'Warp 9,6 · 12 saat', 'Hizmete giriş': '2363' },
  },
  {
    id: 'enterprise', name: 'USS Enterprise NCC-1701', tagline: 'Star Trek (1966) · Constitution sınıfı', origin: 'fiction', franchise: 'Star Trek',
    lengthM: 289, massKg: 1.9e8, radiusKm: 0.145,
    model: { kind: 'procedural', shape: 'saucer' },
    propulsion: { kind: 'warp', impulseC: 0.25, warpFactors: TOS_WARP },
    description: 'Kirk\'ün gemisi. Orijinal dizinin warp ölçeğinde hız = warp³ × c: warp 6 = 216 c, warp 8 = 512 c (acil durum).',
    facts: { 'Mürettebat': '430', 'Seyir hızı': 'Warp 6 (216 c)', 'Azami': 'Warp 8 (512 c)', 'Beş yıllık görev': '2265–2270' },
  },
  {
    id: 'falcon', name: 'Millennium Falcon', tagline: 'Star Wars · YT-1300 hafif yük gemisi', origin: 'fiction', franchise: 'Star Wars',
    lengthM: 34.75, massKg: 1.05e6, radiusKm: 0.018,
    model: { kind: 'procedural', shape: 'freighter' },
    propulsion: { kind: 'hyperdrive', sublightC: 0.05, hyperC: 2e7, hyperLabel: 'Hiperuzay (sınıf 0,5)' },
    description: '"Kessel Koşusu\'nu 12 parsekten kısa sürede yapan gemi." Sınıf 0,5 hiperitici: galaksinin bir ucundan diğerine birkaç günde — burada ~2×10⁷ c olarak alındı.',
    facts: { 'Hiperitici': 'Sınıf 0,5', 'Hiperuzay hızı (varsayım)': '2 × 10⁷ c', 'Alt ışık hızı (varsayım)': '0,05 c', 'Kaptan': 'Han Solo' },
  },
  {
    id: 'xwing', name: 'T-65B X-wing', tagline: 'Star Wars · Asi İttifakı yıldız avcısı', origin: 'fiction', franchise: 'Star Wars',
    lengthM: 12.5, massKg: 10_000, radiusKm: 0.007,
    model: { kind: 'procedural', shape: 'xwing' },
    propulsion: { kind: 'hyperdrive', sublightC: 0.04, hyperC: 1e7, hyperLabel: 'Hiperuzay (sınıf 1)' },
    description: 'Astromek droid destekli sınıf 1 hiperitici; Falcon\'un yarı hızında. Burada ~10⁷ c alındı.',
    facts: { 'Hiperitici': 'Sınıf 1', 'Hiperuzay hızı (varsayım)': '10⁷ c', 'Alt ışık hızı (varsayım)': '0,04 c', 'Silah': '4 lazer topu, 2 proton torpido fırlatıcı' },
  },
  {
    id: 'rocinante', name: 'Rocinante', tagline: 'The Expanse · MCRN korveti · Epstein sürücüsü', origin: 'fiction', franchise: 'The Expanse',
    lengthM: 46, massKg: 2.5e6, radiusKm: 0.024,
    model: { kind: 'procedural', shape: 'corvette' },
    propulsion: { kind: 'brachistochrone', accelsG: [0.3, 1, 3, 6], maxC: 0.2 },
    description: 'Füzyon tahrikli Epstein sürücüsü: yolun yarısında sürekli ivmelenir, "flip" yapıp yarısında yavaşlar (brakistokron rota). 1 g\'de Mars 2–4 gün, Jüpiter ~1 hafta. Işıktan hızlı değil; Güneş Sistemi içi.',
    facts: { 'Seyir ivmesi': '0,3 g', 'Savaş ivmesi': '≥ 3 g ("meyve suyu" ile)', 'Mürettebat': '4–6', 'Sınıf': 'Corvette (eski Tachi)' },
  },
];

export function shipById(id: string): ShipDef | undefined {
  return SHIPS.find((s) => s.id === id);
}

/** maximum speed (km/s) a ship can reach, for feasibility / interstellar checks */
export function shipMaxSpeedKms(s: ShipDef): number {
  const p = s.propulsion;
  switch (p.kind) {
    case 'warp': return Math.max(...p.warpFactors.map((w) => w.c)) * C_KM_S;
    case 'hyperdrive': return p.hyperC * C_KM_S;
    case 'brachistochrone': return p.maxC * C_KM_S;
    default: return 0;
  }
}

/** can the ship leave the Solar System in a human lifetime (FTL)? */
export function isFtl(s: ShipDef): boolean {
  return s.propulsion.kind === 'warp' || s.propulsion.kind === 'hyperdrive';
}
