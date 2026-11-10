import { Vector3 } from 'three';
import { AU_KM, DEG, J2000_JD, OBLIQUITY_J2000, PARSEC_KM } from '../core/constants';
import type { StarInfo } from '../data/StarCatalog';
import type { ExoHost, ExoPlanet } from '../data/Exoplanets';
import type { Appearance, Atmosphere, BodyData, Clouds, SimpleElements } from '../data/types';
import { LUM_CLASS_DESC } from '../astro/stellar';
import { fmtLightYears } from '../ui/format';
import { _, fixed, localeTag } from '../i18n';
import {
  CLASS_LABEL, EARTH_MASS, EARTH_RADIUS, Rng, describeTemp, fmtPeriod, gasAppearance, hashSeed, rockyAppearance, varyRocky,
  starFacts, SUDARSKY_BANDS, type GeneratedSystem, type PlanetClass,
} from './SystemGenerator';

const SOURCE = 'NASA Exoplanet Archive (PSCompPars)';

/** Info-panel rows of the real planets and their stars (keys are translated at display) */
const EXO_FACTS = {
  mass: 'Kütle (ölçülen)',
  radius: 'Yarıçap (ölçülen)',
  incl: 'Bakış eğimi (i)',
  insol: 'Işınım (Dünya = 1)',
  planets: 'Ötegezegenler',
  met: 'Metallik [Fe/H]',
  stars: 'Yıldız sayısı',
} as const;

/* ------------------------------------------------------------------ */
/*  Mass ↔ radius (Chen & Kipping 2017, mean relations)                */
/* ------------------------------------------------------------------ */

function radiusFromMass(mE: number): number {
  if (mE < 2.04) return Math.pow(mE, 0.279);
  if (mE < 131.6) return 0.808 * Math.pow(mE, 0.589);
  // degenerate giants: radius almost independent of mass (~1 R_J)
  return 17.4 * Math.pow(mE / 131.6, -0.044);
}

function massFromRadius(rE: number): number {
  if (rE < 1.23) return Math.pow(rE, 1 / 0.279);
  if (rE < 14) return Math.pow(rE / 0.808, 1 / 0.589);
  return 318; // a giant: the radius says nothing about the mass
}

/* ------------------------------------------------------------------ */
/*  Sky-plane orbit → ecliptic elements                                */
/* ------------------------------------------------------------------ */

const CE = Math.cos(OBLIQUITY_J2000), SE = Math.sin(OBLIQUITY_J2000);

/** scene → ecliptic math frame (x, −z, y) */
function sceneToEcl(v: Vector3): [number, number, number] {
  return [v.x, -v.z, v.y];
}

/** ecliptic math unit vector → ICRF RA/Dec (deg) */
function eclToRaDec([x, y, z]: [number, number, number]): { ra: number; dec: number } {
  const ye = y * CE - z * SE, ze = y * SE + z * CE;
  return { ra: ((Math.atan2(ye, x) / DEG) + 360) % 360, dec: Math.asin(Math.max(-1, Math.min(1, ze))) / DEG };
}

/**
 * Orbit given in the observer's frame — z toward the Sun (the observer), inclination i to the sky
 * (90° = edge-on), node Ω on the sky, argument of periastron ω (radial-velocity convention: the
 * planet transits at true anomaly 90° − ω) — re-expressed as ecliptic J2000 elements.
 */
function skyToEcliptic(toSun: Vector3, iSky: number, nodeSky: number, w: number): { i: number; node: number; argPeri: number; normal: [number, number, number] } {
  const e3 = toSun.clone().normalize();
  const ref = Math.abs(e3.y) > 0.99 ? new Vector3(1, 0, 0) : new Vector3(0, 1, 0);
  const e1 = new Vector3().crossVectors(ref, e3).normalize();
  const e2 = new Vector3().crossVectors(e3, e1);
  const ci = Math.cos(iSky * DEG), si = Math.sin(iSky * DEG), cO = Math.cos(nodeSky * DEG), sO = Math.sin(nodeSky * DEG);
  const cw = Math.cos(w * DEG), sw = Math.sin(w * DEG);
  const sky = (xw: number, yw: number) => {
    const x = xw * cO - yw * ci * sO, y = xw * sO + yw * ci * cO, z = yw * si;
    return sceneToEcl(new Vector3().addScaledVector(e1, x).addScaledVector(e2, y).addScaledVector(e3, z));
  };
  const P = sky(cw, sw); // periastron direction
  const Q = sky(-sw, cw);
  const n: [number, number, number] = [P[1] * Q[2] - P[2] * Q[1], P[2] * Q[0] - P[0] * Q[2], P[0] * Q[1] - P[1] * Q[0]];
  const i = Math.acos(Math.max(-1, Math.min(1, n[2])));
  const node = Math.atan2(n[0], -n[1]);
  const N: [number, number, number] = [Math.cos(node), Math.sin(node), 0];
  // ω: from the ascending node to periastron, positive along the motion
  const cross = [N[1] * P[2] - N[2] * P[1], N[2] * P[0] - N[0] * P[2], N[0] * P[1] - N[1] * P[0]];
  const argPeri = Math.atan2(cross[0] * n[0] + cross[1] * n[1] + cross[2] * n[2], N[0] * P[0] + N[1] * P[1] + N[2] * P[2]);
  const deg = (r: number) => ((r / DEG) % 360 + 360) % 360;
  return { i: i / DEG, node: deg(node), argPeri: deg(argPeri), normal: n };
}

/** Mean anomaly (deg) at J2000 from a mid-transit time, a periastron time, or nothing (seeded) */
function meanAnomalyJ2000(p: ExoPlanet, P: number, e: number, w: number, rng: Rng): number {
  const n = 360 / P;
  if (p.tc !== undefined) {
    const f = (90 - w) * DEG;
    const E = 2 * Math.atan(Math.sqrt((1 - e) / (1 + e)) * Math.tan(f / 2));
    const Mc = (E - e * Math.sin(E)) / DEG;
    return ((Mc + n * (J2000_JD - p.tc)) % 360 + 360) % 360;
  }
  if (p.tp !== undefined) return ((n * (J2000_JD - p.tp)) % 360 + 360) % 360;
  return rng.range(0, 360);
}

/* ------------------------------------------------------------------ */
/*  Classes and looks                                                  */
/* ------------------------------------------------------------------ */

type RealClass = PlanetClass | 'subneptune' | 'neptune' | 'sudarsky1' | 'sudarsky2' | 'sudarsky3' | 'sudarsky4' | 'sudarsky5';

const REAL_LABEL: Partial<Record<RealClass, string>> = {
  subneptune: 'Mini-Neptün (kalın H/He zarfı)',
  neptune: 'Neptün benzeri',
  sudarsky1: 'Gaz devi (Sudarsky I: amonyak bulutları)',
  sudarsky2: 'Gaz devi (Sudarsky II: su bulutları)',
  sudarsky3: 'Gaz devi (Sudarsky III: bulutsuz)',
  sudarsky4: 'Sıcak Jüpiter (Sudarsky IV: alkali metal atmosfer)',
  sudarsky5: 'Çok sıcak Jüpiter (Sudarsky V: silikat bulutları)',
};

/** Sudarsky et al. (2000) classes: cloud chemistry set by temperature (SystemGenerator.SUDARSKY_BANDS) */
const SUDARSKY: Record<string, Array<[number, number, number]>> = {
  sudarsky1: SUDARSKY_BANDS[1], sudarsky2: SUDARSKY_BANDS[2], sudarsky3: SUDARSKY_BANDS[3], sudarsky4: SUDARSKY_BANDS[4], sudarsky5: SUDARSKY_BANDS[5],
};

function bandsLook(rng: Rng, id: string, bands: Array<[number, number, number]>, turbulence = 0.5): Appearance {
  const seed = hashSeed(...id.split('').map((c) => c.charCodeAt(0))) % 10_000;
  return { kind: 'gas', seed, bands: bands.map((b) => rng.tint(b, 0.04)), bandFreq: rng.range(5, 12), turbulence, skin: 'gas' };
}

/** What has actually been measured for a handful of famous worlds */
interface Observed {
  note: string;
  cls?: RealClass;
  bands?: Array<[number, number, number]>;
  albedo?: number;
  airless?: boolean;
}

const OBSERVED: Record<string, Observed> = {
  '55 Cnc e': { cls: 'lava', note: 'JWST ölçümleri yüzeyin bir magma okyanusu olduğunu ve muhtemelen ikincil (CO/CO₂) bir atmosfer taşıdığını gösteriyor (Hu ve ark. 2024).' },
  'LHS 3844 b': { cls: 'barren', airless: true, albedo: 0.1, note: 'Spitzer gece–gündüz sıcaklık farkı kalın bir atmosferi dışlıyor: çıplak, koyu bazaltik kaya (Kreidberg ve ark. 2019).' },
  'TRAPPIST-1 b': { cls: 'barren', airless: true, albedo: 0.1, note: 'JWST 15 µm ölçümü: gündüz yüzü kara cisim gibi ışıyor, kalın atmosfer yok (Greene ve ark. 2023).' },
  'TRAPPIST-1 c': { cls: 'barren', airless: true, albedo: 0.15, note: 'JWST: kalın CO₂ atmosferi yok; Venüs benzeri olma ihtimali düşük (Zieba ve ark. 2023).' },
  'GJ 1132 b': { cls: 'barren', airless: true, albedo: 0.1, note: 'JWST tayfında atmosfer izi bulunamadı; büyük olasılıkla çıplak kaya.' },
  'K2-18 b': { cls: 'subneptune', bands: [[0.45, 0.62, 0.8], [0.5, 0.68, 0.84], [0.42, 0.58, 0.76], [0.55, 0.7, 0.86]], note: 'Hubble ve JWST atmosferde metan ve CO₂ buldu; su okyanuslu "hycean" bir dünya mı, gaz zarflı bir mini-Neptün mü olduğu tartışmalı (Madhusudhan ve ark. 2023).' },
  'GJ 1214 b': { cls: 'subneptune', albedo: 0.5, bands: [[0.8, 0.8, 0.76], [0.74, 0.74, 0.7], [0.85, 0.84, 0.8]], note: 'Tayfı düz: yüksek irtifada kalın pus/bulut katmanı; JWST yansıtıcı, metalce zengin bir atmosfer görüyor (Kempton ve ark. 2023).' },
  'Kepler-7 b': { albedo: 0.35, bands: [[0.9, 0.88, 0.82], [0.82, 0.8, 0.74], [0.95, 0.94, 0.9], [0.76, 0.72, 0.66]], note: 'Kepler evre eğrisi: yüksek albedo, batı yarıküresinde parlak bulutlar (Demory ve ark. 2013).' },
  'HD 189733 b': { albedo: 0.4, bands: [[0.16, 0.32, 0.72], [0.12, 0.26, 0.62], [0.2, 0.38, 0.8], [0.14, 0.28, 0.66]], note: 'Hubble yansıma tayfı: derin lacivert renk, silikat pusundan saçılma (Evans ve ark. 2013).' },
  'WASP-12 b': { albedo: 0.05, bands: [[0.08, 0.07, 0.07], [0.06, 0.05, 0.05], [0.1, 0.08, 0.08]], note: 'Neredeyse ışık yansıtmıyor (albedo < 0,064): asfalt kadar koyu. Gelgitle yumurta biçimine çekilmiş, yörüngesi küçülüyor.' },
  'TrES-2 b': { albedo: 0.01, bands: [[0.05, 0.03, 0.03], [0.04, 0.025, 0.025], [0.07, 0.035, 0.03]], note: "Bilinen en karanlık ötegezegenlerden: ışığın %1'inden azını yansıtır (Kipping ve Spiegel 2011)." },
  'HD 209458 b': { note: 'Geçişi gözlenen ilk ötegezegen (2000) ve atmosferi tespit edilen ilki: sodyum ve uzaya kaçan bir hidrojen kuyruğu.' },
  'WASP-121 b': { note: 'Stratosferinde demir ve magnezyum buharı; gündüz yüzünde su molekülleri parçalanıyor, gece yüzünde metal bulutları (JWST).' },
  'WASP-76 b': { note: 'Gündüz yüzünde buharlaşan demir, daha serin gece yüzünde yoğunlaşıp "demir yağmuru" olarak düşüyor (Ehrenreich ve ark. 2020).' },
  'KELT-9 b': { bands: [[0.95, 0.72, 0.45], [0.9, 0.62, 0.38], [1.0, 0.8, 0.55]], note: 'Bilinen en sıcak gaz devi: gündüz yüzü ~4600 K, birçok yıldızdan sıcak; moleküller atomlarına ayrışıyor.' },
  'LTT 9779 b': { albedo: 0.8, bands: [[0.88, 0.88, 0.9], [0.82, 0.83, 0.86], [0.93, 0.93, 0.95]], note: 'Ölçülen en yüksek albedolardan (~0,8): silikat ve titanyum bulutlarından oluşan "metal ayna" (Hoyer ve ark. 2023).' },
  'GJ 504 b': { bands: [[0.6, 0.3, 0.5], [0.52, 0.24, 0.44], [0.68, 0.36, 0.56]], note: 'Doğrudan görüntülendi; genç, sıcak metan atmosferi insan gözüne koyu macenta görünür.' },
  'bet Pic b': { bands: [[0.7, 0.32, 0.2], [0.6, 0.26, 0.16], [0.78, 0.4, 0.26]], note: 'Doğrudan görüntülenen genç bir dev: oluşum ısısıyla hâlâ ~1700 K, kızıl parlıyor.' },
  'bet Pic c': { bands: [[0.7, 0.34, 0.22], [0.6, 0.28, 0.18], [0.78, 0.42, 0.28]], note: 'Doğrudan görüntülenen genç bir dev: oluşum ısısıyla hâlâ ~1200 K.' },
};
for (const l of ['b', 'c', 'd', 'e']) {
  OBSERVED[`HR 8799 ${l}`] = {
    bands: [[0.66, 0.36, 0.24], [0.56, 0.28, 0.2], [0.74, 0.44, 0.3]],
    note: 'Doğrudan görüntülenen dört dev gezegenden biri; genç (~30 milyon yıl), oluşum ısısıyla kızıl parlıyor.',
  };
}

/* ------------------------------------------------------------------ */
/*  System                                                             */
/* ------------------------------------------------------------------ */

/** Body id of a real planet: `s<host index>-<letter>` ("Kepler-11 b" → s111002-b) */
export function exoBodyId(hostIndex: number, planetName: string): string {
  return `s${hostIndex}-${planetName.slice(planetName.lastIndexOf(' ') + 1).replace(/[^\w]/g, '') || 'p'}`;
}

/**
 * The real planetary system of an exoplanet host: the measured planets on their measured orbits,
 * oriented as seen from the Sun (transits happen when the archive says they do), with looks
 * chosen from measured radius, mass and temperature. No invented planets, moons or belts.
 *
 * @param toSun unit vector from the star toward the Sun (scene frame)
 */
export function realSystem(star: StarInfo, host: ExoHost, toSun: Vector3): GeneratedSystem {
  const rng = new Rng(hashSeed(star.index, star.hip, 0xe7a));
  const sysId = `s${star.index}`;
  const starId = `${sysId}-star`;
  const bodies: BodyData[] = [];
  const planetIds: string[] = [];
  const massSolar = host.mass ?? star.massSolar;
  const lum = host.lum !== undefined ? Math.pow(10, host.lum) : star.luminosity;
  const nodeSky = rng.range(0, 360);

  // inclination shared by siblings without one (planets of one system are nearly coplanar)
  const knownI = host.planets.find((p) => p.i !== undefined)?.i;
  const fallbackI = knownI ?? Math.acos(rng.next()) / DEG;

  const primary: BodyData = {
    id: starId,
    name: star.name,
    type: 'star',
    radius: star.radiusKm,
    mass: star.massKg,
    rotationPeriod: host.rotp ? host.rotp * 24 : rng.range(150, 1200) / Math.max(0.3, star.massSolar),
    pole: { ra: 0, dec: 90 },
    appearance: { kind: 'star', temperature: star.temperature, seed: star.index % 997 + 3 },
    temperature: star.temperature,
    description: '',
    facts: realStarFacts(star, host),
  };
  bodies.push(primary);

  let innermostNormal: [number, number, number] | null = null;
  const notes: string[] = [];
  for (const p of host.planets) {
    const P = p.P ?? (p.a !== undefined ? 365.25 * Math.sqrt((p.a ** 3) / massSolar) : undefined);
    const aAU = p.a ?? (P !== undefined ? Math.cbrt(massSolar * (P / 365.25) ** 2) : undefined);
    if (P === undefined || aAU === undefined) continue;
    const e = Math.min(0.95, Math.max(0, p.e ?? 0));
    const w = p.w ?? 90;
    const iSky = p.i ?? (p.tran ? 89 : fallbackI);
    const iAssumed = p.i === undefined && !p.tran;
    const prng = new Rng(hashSeed(star.index, ...p.name.split('').map((c) => c.charCodeAt(0))));

    // mass and radius: measured where possible, the other from the mass–radius relation
    const msini = !!p.Mprov && /sin/i.test(p.Mprov) && p.M !== undefined;
    let massE = p.M;
    if (massE !== undefined && msini) massE /= Math.max(0.17, Math.sin(iSky * DEG));
    const radiusE = p.R ?? (massE !== undefined ? radiusFromMass(massE) : undefined);
    if (radiusE === undefined) continue;
    if (massE === undefined) massE = massFromRadius(radiusE);
    const massMeasured = p.M !== undefined && p.Mprov !== 'M-R relationship';

    const albedoGuess = radiusE < 1.6 ? 0.25 : 0.3;
    const Teq = p.Teq ?? 278.3 * Math.pow((1 - albedoGuess) * lum, 0.25) / Math.sqrt(aAU * (1 - e * e) ** 0.25);
    const locked = P < 25 || aAU < 0.1;
    const obs = OBSERVED[p.name];

    let cls: RealClass;
    if (obs?.cls) cls = obs.cls;
    else if (radiusE < 1.6) {
      if (Teq > 850) cls = 'lava';
      else if (Teq > 400) cls = 'barren';
      else if (Teq > 300) cls = (star.temperature > 4000 && massE > 0.5) ? 'venusian' : 'barren';
      else if (Teq > 180) cls = locked ? 'eyeball' : 'temperate';
      else if (Teq > 140) cls = 'desert';
      else cls = 'ice';
    } else if (radiusE < 4) cls = 'subneptune';
    else if (radiusE < 8) cls = 'neptune';
    else cls = Teq < 150 ? 'sudarsky1' : Teq < 350 ? 'sudarsky2' : Teq < 800 ? 'sudarsky3' : Teq < 1400 ? 'sudarsky4' : 'sudarsky5';

    const id = exoBodyId(star.index, p.name);
    const radius = radiusE * EARTH_RADIUS;
    const rocky = radiusE < 1.6 || (obs?.cls !== undefined && ['lava', 'barren', 'venusian', 'eyeball', 'temperate', 'desert', 'ice'].includes(obs.cls));
    let appearance: Appearance;
    let atmosphere: Atmosphere | undefined;
    let clouds: Clouds | undefined;
    let albedo: number;
    if (rocky) {
      const look = rockyAppearance(prng, cls as PlanetClass, massE, id, false);
      appearance = look.appearance;
      atmosphere = obs?.airless ? undefined : look.atmosphere;
      clouds = obs?.airless ? undefined : look.clouds;
      varyRocky(appearance, atmosphere, id, !obs);
      albedo = obs?.albedo ?? (cls === 'venusian' ? 0.7 : cls === 'eyeball' ? 0.45 : cls === 'ice' ? 0.55 : cls === 'temperate' ? 0.3 : 0.12);
    } else {
      const sub = cls === 'subneptune' || cls === 'neptune';
      appearance = obs?.bands ? bandsLook(prng, id, obs.bands, 0.4)
        : sub ? gasAppearance(prng, Teq, Teq < 700, id)
          : bandsLook(prng, id, SUDARSKY[cls], cls === 'sudarsky1' ? 0.8 : 0.45);
      albedo = obs?.albedo ?? (cls === 'sudarsky2' ? 0.8 : cls === 'sudarsky1' ? 0.5 : cls === 'sudarsky3' ? 0.12 : cls === 'sudarsky4' ? 0.05 : cls === 'sudarsky5' ? 0.4 : 0.3);
      atmosphere = { color: sub ? [0.55, 0.72, 1.0] : Teq > 800 ? [0.7, 0.5, 0.45] : [0.85, 0.85, 0.9], height: sub ? 0.03 : 0.012, density: 0.5 };
    }

    const el = skyToEcliptic(toSun, iSky, nodeSky, w);
    if (!innermostNormal) innermostNormal = el.normal;
    const orbit: SimpleElements = {
      kind: 'simple', a: aAU * AU_KM, e, i: el.i, node: el.node, argPeri: el.argPeri,
      M0: meanAnomalyJ2000(p, P, e, w, prng), epoch: J2000_JD, period: P, frame: 'ecliptic',
    };

    const label = REAL_LABEL[cls] ?? CLASS_LABEL[cls as PlanetClass];
    const parts: string[] = [`${_(label)}; ${describeTemp(Teq)}.`];
    if (p.controv) parts.push(_('Varlığı tartışmalı.'));
    if (p.tran) parts.push(_("Yıldızının önünden geçiyor: Dünya'dan bakınca her {p} bir kez yıldızı hafifçe karartır.", { p: fmtPeriod(P) }));
    if (msini) parts.push(_('Kütlesi dikine hız yöntemiyle ölçüldü; bu yalnızca alt sınırı (M sin i) verir. Gösterilen kütle varsayılan eğimle hesaplandı.'));
    else if (!massMeasured) parts.push(_('Kütlesi ölçülmedi; yarıçapından kütle–yarıçap ilişkisiyle tahmin edildi.'));
    if (p.R === undefined) parts.push(_('Yarıçapı ölçülmedi; kütlesinden tahmin edildi, görünümü sınıfına göre temsilîdir.'));
    else parts.push(_('Yüzey ve bulut görünümü ölçülen yarıçap, kütle ve sıcaklığa göre seçildi; ayrıntıları temsilîdir.'));
    if (iAssumed) parts.push(_('Yörüngenin gökyüzüne göre eğimi bilinmiyor; rastgele bir eğim varsayıldı.'));
    if (p.cb) parts.push(_('Gerçekte iki yıldızın birlikte çevresinde dolanır; burada yalnızca ana yıldız gösteriliyor.'));
    if (obs) parts.push(_(obs.note));

    const facts: Record<string, string> = { 'Sınıf': label };
    if (p.M !== undefined) facts[EXO_FACTS.mass] = msini ? `M sin i = ${fixed(p.M, 2)} M⊕` : `${fixed(p.M, p.M < 10 ? 2 : 1)} M⊕${p.M > 50 ? ` (${fixed(p.M / 317.83, 2)} M♃)` : ''}`;
    if (p.R !== undefined) facts[EXO_FACTS.radius] = `${fixed(p.R, 2)} R⊕${p.R > 6 ? ` (${fixed(p.R / 11.209, 2)} R♃)` : ''}`;
    facts[EXO_FACTS.incl] = `${fixed(iSky, 1)}°${iAssumed ? ' ?' : ''}`;
    if (p.S !== undefined) facts[EXO_FACTS.insol] = fixed(p.S, p.S < 10 ? 2 : 0);
    if (p.Teq !== undefined) facts['Denge sıcaklığı'] = `${Math.round(p.Teq)} K`;
    if (p.year) facts['Keşif'] = [p.year, p.method, p.facility].filter(Boolean).join(' · ');
    facts['Kaynak'] = SOURCE;

    bodies.push({
      id, name: p.name, type: 'planet', parent: starId, radius,
      flattening: rocky ? undefined : locked ? 0.01 : 0.05,
      mass: massE * EARTH_MASS, albedo,
      rotationPeriod: locked ? 'sync' : rocky ? prng.logRange(9, 900) : prng.range(9, 18),
      tilt: locked ? 0 : Math.abs(prng.range(-1, 1)) * 25,
      orbit, appearance, atmosphere, clouds,
      temperature: cls === 'venusian' ? Teq * 1.8 : Teq,
      description: parts.join(' '),
      facts,
    });
    planetIds.push(id);
  }
  if (host.snum && host.snum > 1) notes.push(_('Sistemde {n} yıldız var; yoldaş yıldızlar burada gösterilmiyor.', { n: host.snum }));

  // the star spins in the plane of its planets (true for most measured systems)
  if (innermostNormal) primary.pole = eclToRaDec(innermostNormal);
  primary.description = [realStarDescription(star, planetIds.length), ...notes].join(' ');

  // planets in order of distance (hotkeys 1…9)
  planetIds.sort((a, b) => {
    const oa = bodies.find((x) => x.id === a)!.orbit as SimpleElements, ob = bodies.find((x) => x.id === b)!.orbit as SimpleElements;
    return oa.a - ob.a;
  });
  return { id: sysId, bodies, belts: [], planetIds };
}

function realStarDescription(s: StarInfo, n: number): string {
  const lumDesc = LUM_CLASS_DESC[s.lumClass];
  const cls = s.isWhiteDwarf ? _('beyaz cüce') : (lumDesc ? _(lumDesc) : _('yıldız')).toLocaleLowerCase(localeTag());
  return [
    _('{sp} sınıfı {cls}', { sp: s.catalogSpectral || s.spectral, cls }) + '.',
    _("Güneş'e uzaklığı {ly}.", { ly: fmtLightYears(s.distancePc * PARSEC_KM) }),
    _('Çevresinde {n} doğrulanmış ötegezegen biliniyor. Yıldızın ve gezegenlerin değerleri NASA Ötegezegen Arşivi ölçümleridir; yörüngeler Güneş’ten görüldüğü yönde kuruldu, geçişler arşivdeki zamanlarda olur.', { n }),
  ].join(' ');
}

function realStarFacts(s: StarInfo, h: ExoHost): Record<string, string> {
  const f = starFacts(s);
  f[EXO_FACTS.planets] = String(h.planets.length);
  if (h.met !== undefined) f[EXO_FACTS.met] = fixed(h.met, 2);
  if (h.age !== undefined) f['Yaş'] = _('{n} milyar yıl', { n: fixed(h.age, 1) });
  if (h.snum && h.snum > 1) f[EXO_FACTS.stars] = String(h.snum);
  f['Kaynak'] = SOURCE;
  return f;
}
