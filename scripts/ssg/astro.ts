import { Vector3 } from 'three';
import { raDecToScene } from '../../src/math/frames';
import { LIGHT_YEAR_KM, PARSEC_KM } from '../../src/core/constants';

/* ------------------------------------------------------------------ frames */

const EX = raDecToScene(0, 0), EY = raDecToScene(90, 0), EZ = raDecToScene(0, 90);

/** scene-frame vector → ICRF RA/Dec (deg) */
export function sceneToRaDec(x: number, y: number, z: number): { ra: number; dec: number } {
  const v = new Vector3(x, y, z);
  const n = v.length() || 1;
  const a = v.dot(EX) / n, b = v.dot(EY) / n, c = v.dot(EZ) / n;
  let ra = Math.atan2(b, a) * 180 / Math.PI;
  if (ra < 0) ra += 360;
  return { ra, dec: Math.asin(Math.max(-1, Math.min(1, c))) * 180 / Math.PI };
}

export function unitRaDec(ra: number, dec: number): [number, number, number] {
  const a = ra * Math.PI / 180, d = dec * Math.PI / 180;
  return [Math.cos(d) * Math.cos(a), Math.cos(d) * Math.sin(a), Math.sin(d)];
}

export const PC_LY = PARSEC_KM / LIGHT_YEAR_KM;

/* ------------------------------------------------------------------ constellations */

/** IAU abbreviation → Latin name and Turkish name */
export const CONSTELLATIONS: Record<string, [string, string]> = {
  And: ['Andromeda', 'Andromeda'], Ant: ['Antlia', 'Hava Pompası'], Aps: ['Apus', 'Cennet Kuşu'], Aqr: ['Aquarius', 'Kova'],
  Aql: ['Aquila', 'Kartal'], Ara: ['Ara', 'Sunak'], Ari: ['Aries', 'Koç'], Aur: ['Auriga', 'Arabacı'],
  Boo: ['Boötes', 'Çoban'], Cae: ['Caelum', 'Oymacı Kalemi'], Cam: ['Camelopardalis', 'Zürafa'], Cnc: ['Cancer', 'Yengeç'],
  CVn: ['Canes Venatici', 'Av Köpekleri'], CMa: ['Canis Major', 'Büyük Köpek'], CMi: ['Canis Minor', 'Küçük Köpek'], Cap: ['Capricornus', 'Oğlak'],
  Car: ['Carina', 'Karina'], Cas: ['Cassiopeia', 'Kraliçe'], Cen: ['Centaurus', 'Erboğa'], Cep: ['Cepheus', 'Kral'],
  Cet: ['Cetus', 'Balina'], Cha: ['Chamaeleon', 'Bukalemun'], Cir: ['Circinus', 'Pergel'], Col: ['Columba', 'Güvercin'],
  Com: ['Coma Berenices', 'Berenis\'in Saçı'], CrA: ['Corona Australis', 'Güney Tacı'], CrB: ['Corona Borealis', 'Kuzey Tacı'], Crv: ['Corvus', 'Karga'],
  Crt: ['Crater', 'Kupa'], Cru: ['Crux', 'Güney Haçı'], Cyg: ['Cygnus', 'Kuğu'], Del: ['Delphinus', 'Yunus'],
  Dor: ['Dorado', 'Kılıçbalığı'], Dra: ['Draco', 'Ejderha'], Equ: ['Equuleus', 'Tay'], Eri: ['Eridanus', 'Irmak'],
  For: ['Fornax', 'Ocak'], Gem: ['Gemini', 'İkizler'], Gru: ['Grus', 'Turna'], Her: ['Hercules', 'Herkül'],
  Hor: ['Horologium', 'Saat'], Hya: ['Hydra', 'Suyılanı'], Hyi: ['Hydrus', 'Küçük Suyılanı'], Ind: ['Indus', 'Hintli'],
  Lac: ['Lacerta', 'Kertenkele'], Leo: ['Leo', 'Aslan'], LMi: ['Leo Minor', 'Küçük Aslan'], Lep: ['Lepus', 'Tavşan'],
  Lib: ['Libra', 'Terazi'], Lup: ['Lupus', 'Kurt'], Lyn: ['Lynx', 'Vaşak'], Lyr: ['Lyra', 'Çalgı'],
  Men: ['Mensa', 'Masa Dağı'], Mic: ['Microscopium', 'Mikroskop'], Mon: ['Monoceros', 'Tekboynuzlu At'], Mus: ['Musca', 'Sinek'],
  Nor: ['Norma', 'Gönye'], Oct: ['Octans', 'Sekizlik'], Oph: ['Ophiuchus', 'Yılancı'], Ori: ['Orion', 'Avcı'],
  Pav: ['Pavo', 'Tavus'], Peg: ['Pegasus', 'Kanatlı At'], Per: ['Perseus', 'Kahraman'], Phe: ['Phoenix', 'Anka'],
  Pic: ['Pictor', 'Ressam'], Psc: ['Pisces', 'Balıklar'], PsA: ['Piscis Austrinus', 'Güney Balığı'], Pup: ['Puppis', 'Pupa'],
  Pyx: ['Pyxis', 'Pusula'], Ret: ['Reticulum', 'Ağ'], Sge: ['Sagitta', 'Ok'], Sgr: ['Sagittarius', 'Yay'],
  Sco: ['Scorpius', 'Akrep'], Scl: ['Sculptor', 'Heykeltıraş'], Sct: ['Scutum', 'Kalkan'], Ser: ['Serpens', 'Yılan'],
  Sex: ['Sextans', 'Sekstant'], Tau: ['Taurus', 'Boğa'], Tel: ['Telescopium', 'Teleskop'], Tri: ['Triangulum', 'Üçgen'],
  TrA: ['Triangulum Australe', 'Güney Üçgeni'], Tuc: ['Tucana', 'Tukan'], UMa: ['Ursa Major', 'Büyük Ayı'], UMi: ['Ursa Minor', 'Küçük Ayı'],
  Vel: ['Vela', 'Yelken'], Vir: ['Virgo', 'Başak'], Vol: ['Volans', 'Uçan Balık'], Vul: ['Vulpecula', 'Tilki'],
};

/** Roman (1987) boundaries, B1875: [RA low h, RA high h, Dec low °, abbreviation], in table order */
type Boundary = [number, number, number, string];
let BOUNDS: Boundary[] | null = null;

export function setBoundaries(text: string): void {
  const rows: Boundary[] = [];
  for (const line of text.split('\n')) {
    const p = line.trim().split(/\s+/);
    if (p.length < 4) continue;
    const abbr = p[3].length === 3 ? p[3][0].toUpperCase() + p[3].slice(1).toLowerCase() : p[3];
    const key = Object.keys(CONSTELLATIONS).find((k) => k.toLowerCase() === abbr.toLowerCase());
    if (key) rows.push([+p[0], +p[1], +p[2], key]);
  }
  BOUNDS = rows.length > 300 ? rows : null;
}

export function boundaryTable(): Boundary[] {
  return BOUNDS ?? [];
}

/** J2000 → B1875 (IAU 1976 precession) */
export function toB1875(ra: number, dec: number): [number, number] {
  const T = (2405889.258550475 - 2451545.0) / 36525;
  const as = Math.PI / 180 / 3600;
  const zeta = (2306.2181 * T + 0.30188 * T * T + 0.017998 * T ** 3) * as;
  const z = (2306.2181 * T + 1.09468 * T * T + 0.018203 * T ** 3) * as;
  const th = (2004.3109 * T - 0.42665 * T * T - 0.041833 * T ** 3) * as;
  const a0 = ra * Math.PI / 180, d0 = dec * Math.PI / 180;
  const A = Math.cos(d0) * Math.sin(a0 + zeta);
  const B = Math.cos(th) * Math.cos(d0) * Math.cos(a0 + zeta) - Math.sin(th) * Math.sin(d0);
  const C = Math.sin(th) * Math.cos(d0) * Math.cos(a0 + zeta) + Math.cos(th) * Math.sin(d0);
  let a = (Math.atan2(A, B) + z) * 180 / Math.PI;
  a = ((a % 360) + 360) % 360;
  return [a, Math.asin(C) * 180 / Math.PI];
}

/** fallback when the boundary table is missing: the constellation of the nearest named star */
let NEAR: Array<{ u: [number, number, number]; c: string }> = [];
export function setReferenceStars(list: Array<{ ra: number; dec: number; c: string }>): void {
  NEAR = list.map((s) => ({ u: unitRaDec(s.ra, s.dec), c: s.c }));
}

/** IAU constellation containing a J2000 position */
export function constellationAt(ra: number, dec: number): string {
  if (BOUNDS) {
    const [a, d] = toB1875(ra, dec);
    const h = a / 15;
    for (const [lo, hi, dl, c] of BOUNDS) if (d >= dl && h >= lo && h < hi) return c;
    return 'Oct';
  }
  const u = unitRaDec(ra, dec);
  let best = -2, c = '';
  for (const s of NEAR) {
    const dot = u[0] * s.u[0] + u[1] * s.u[1] + u[2] * s.u[2];
    if (dot > best) { best = dot; c = s.c; }
  }
  return c;
}

/* ------------------------------------------------------------------ the sky from Earth */

/** month (0–11) in which an object stands highest at midnight */
export function midnightMonth(ra: number): number {
  // the Sun is at RA 0 on ~20 March and moves ~0.9856°/day; opposite it at midnight
  const days = (((ra + 180) % 360) / 0.98565);
  const d = new Date(Date.UTC(2026, 2, 20) + days * 86400e3);
  return d.getUTCMonth();
}

/** latitudes from which a declination rises at all, and from which it never sets */
export function visibility(dec: number): { south: number; north: number; circumpolar: number | null } {
  return {
    south: Math.max(-90, dec - 90),
    north: Math.min(90, dec + 90),
    circumpolar: Math.abs(dec) < 1 ? null : dec > 0 ? 90 - dec : -(90 + dec),
  };
}

export function fmtRa(ra: number): string {
  const h = ra / 15;
  const hh = Math.floor(h), mm = Math.floor((h - hh) * 60), ss = ((h - hh) * 60 - mm) * 60;
  return `${hh}h ${String(mm).padStart(2, '0')}m ${ss.toFixed(1).padStart(4, '0')}s`;
}

export function fmtDec(dec: number): string {
  const s = dec < 0 ? '−' : '+';
  const a = Math.abs(dec);
  const dd = Math.floor(a), mm = Math.floor((a - dd) * 60), ss = Math.round(((a - dd) * 60 - mm) * 60);
  return `${s}${dd}° ${String(mm).padStart(2, '0')}′ ${String(Math.min(ss, 59)).padStart(2, '0')}″`;
}

/* ------------------------------------------------------------------ light travel */

/** what was happening on Earth when light that left `yearsAgo` ago set out (source strings) */
const EPOCHS: Array<[number, string]> = [
  [4.54e9, 'O sırada Dünya henüz oluşmamıştı.'],
  [3.7e9, 'O sırada Dünya yeni oluşmuştu ve henüz yaşam yoktu.'],
  [5.4e8, 'O sırada Dünya\'da yalnızca tek hücreli ve ilk çok hücreli canlılar vardı.'],
  [2.3e8, 'O sırada karmaşık hayvanlar denizlerde ve karada yayılıyordu; dinozorlar henüz yoktu.'],
  [6.6e7, 'O sırada dinozorlar Dünya\'ya hâkimdi.'],
  [2.5e6, 'O sırada dinozorlar yok olmuştu, memeliler çeşitleniyordu; insan soyu henüz yoktu.'],
  [3e5, 'O sırada atalarımız taş aletler kullanıyordu; Homo sapiens henüz yoktu.'],
  [1.2e4, 'O sırada Homo sapiens Afrika\'dan dünyaya yayılıyordu; tarım henüz yoktu.'],
  [0, 'O sırada ilk tarım köyleri kuruluyordu; yazı henüz yoktu.'],
];

export function epochFor(yearsAgo: number): string {
  for (const [y, s] of EPOCHS) if (yearsAgo >= y) return s;
  return EPOCHS[EPOCHS.length - 1][1];
}

/* ------------------------------------------------------------------ slugs */

const GREEK: Record<string, string> = {
  α: 'alpha', β: 'beta', γ: 'gamma', δ: 'delta', ε: 'epsilon', ζ: 'zeta', η: 'eta', θ: 'theta', ι: 'iota', κ: 'kappa',
  λ: 'lambda', μ: 'mu', ν: 'nu', ξ: 'xi', ο: 'omicron', π: 'pi', ρ: 'rho', σ: 'sigma', τ: 'tau', υ: 'upsilon',
  φ: 'phi', χ: 'chi', ψ: 'psi', ω: 'omega',
};

export function slugify(s: string): string {
  return s
    .replace(/([α-ω])([⁰¹²³⁴⁵⁶⁷⁸⁹]*)/g, (_m, c: string, sup: string) => `${GREEK[c] ?? ''}${[...sup].map((d) => '⁰¹²³⁴⁵⁶⁷⁸⁹'.indexOf(d)).join('')} `)
    .replace(/ı/g, 'i').replace(/ş/g, 's').replace(/ğ/g, 'g').replace(/ç/g, 'c').replace(/ö/g, 'o').replace(/ü/g, 'u')
    .replace(/[İ]/g, 'i').replace(/\*/g, '-star')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\+/g, '-plus-')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}
