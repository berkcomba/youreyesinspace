import { AU_KM, C_KM_S, LIGHT_YEAR_KM, PARSEC_KM } from '../core/constants';

export function fmtDistance(km: number): string {
  const a = Math.abs(km);
  if (a < 1) return `${(km * 1000).toFixed(1)} m`;
  if (a < 1e4) return `${km.toFixed(2)} km`;
  if (a < 1e6) return `${km.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} km`;
  if (a < AU_KM * 0.05) return `${(km / 1e6).toFixed(3)} milyon km`;
  if (a < LIGHT_YEAR_KM * 0.1) return `${(km / AU_KM).toFixed(km / AU_KM < 10 ? 4 : 2)} AU`;
  if (a < PARSEC_KM * 1000) return `${(km / LIGHT_YEAR_KM).toFixed(2)} ly`;
  if (a < PARSEC_KM * 1e6) return `${(km / PARSEC_KM / 1000).toFixed(2)} kpc`;
  return `${(km / PARSEC_KM / 1e6).toFixed(2)} Mpc`;
}

/** Distance in light-years, scaled (ly / kly / Mly) */
export function fmtLightYears(km: number): string {
  const ly = km / LIGHT_YEAR_KM;
  if (ly < 1000) return `${ly.toFixed(1)} ly`;
  if (ly < 1e6) return `${(ly / 1000).toFixed(1)} bin ly`;
  return `${(ly / 1e6).toFixed(2)} milyon ly`;
}

export function fmtSpeed(kms: number): string {
  if (kms === 0) return '0 m/s';
  const a = Math.abs(kms);
  if (a < 1) return `${(kms * 1000).toFixed(1)} m/s`;
  if (a < 1000) return `${kms.toFixed(2)} km/s`;
  if (a < C_KM_S * 0.5) return `${(kms / 1000).toFixed(1)}k km/s`;
  if (a < C_KM_S * 1000) return `${(kms / C_KM_S).toFixed(2)} c`;
  if (a < AU_KM * 100) return `${(kms / AU_KM).toFixed(2)} AU/s`;
  if (a < LIGHT_YEAR_KM * 1000) return `${(kms / LIGHT_YEAR_KM).toFixed(3)} ly/s`;
  if (a < PARSEC_KM * 1e6) return `${(kms / PARSEC_KM / 1000).toFixed(2)} kpc/s`;
  return `${(kms / PARSEC_KM / 1e6).toFixed(2)} Mpc/s`;
}

export function fmtSci(x: number, unit = '', digits = 3): string {
  if (x === 0) return `0 ${unit}`;
  const exp = Math.floor(Math.log10(Math.abs(x)));
  const mant = x / Math.pow(10, exp);
  const sup = String(exp).replace(/-/g, '⁻').replace(/\d/g, (d) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[+d]);
  return `${mant.toFixed(digits - 1)}×10${sup} ${unit}`.trim();
}

export function fmtMass(kg: number): string {
  const earth = 5.97237e24;
  const sun = 1.9885e30;
  if (kg > sun * 0.01) return `${(kg / sun).toFixed(3)} M☉`;
  if (kg > earth * 0.001) return `${(kg / earth).toFixed(kg / earth < 1 ? 4 : 2)} M⊕ (${fmtSci(kg, 'kg')})`;
  return fmtSci(kg, 'kg');
}

export function fmtRadius(km: number, earthRel = true): string {
  const s = km >= 1000 ? `${km.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} km` : `${km.toFixed(1)} km`;
  if (!earthRel) return s;
  const re = km / 6371;
  return re > 0.05 ? `${s} (${re.toFixed(2)} R⊕)` : s;
}

export function fmtTemp(k: number): string {
  if (!Number.isFinite(k) || k <= 0) return '—';
  return `${k.toFixed(0)} K (${(k - 273.15).toFixed(0)} °C)`;
}

export function fmtDeg(d: number, digits = 2): string {
  return `${d.toFixed(digits)}°`;
}

export function fmtDuration(seconds: number): string {
  const a = Math.abs(seconds);
  if (a < 60) return `${seconds.toFixed(1)} s`;
  if (a < 3600) return `${(seconds / 60).toFixed(1)} dk`;
  if (a < 86400 * 2) return `${(seconds / 3600).toFixed(2)} sa`;
  if (a < 86400 * 365.25 * 2) return `${(seconds / 86400).toFixed(2)} gün`;
  const years = seconds / (86400 * 365.25);
  if (a < 86400 * 365.25 * 1e4) return `${years.toFixed(2)} yıl`;
  if (years < 1e6) return `${(years / 1e3).toFixed(1)} bin yıl`;
  if (years < 1e9) return `${(years / 1e6).toFixed(2)} milyon yıl`;
  return `${(years / 1e9).toFixed(2)} milyar yıl`;
}

export const TYPE_LABELS: Record<string, string> = {
  star: 'Yıldız',
  planet: 'Gezegen',
  dwarf: 'Cüce Gezegen',
  moon: 'Uydu',
  asteroid: 'Asteroit',
  comet: 'Kuyruklu Yıldız',
  barycenter: 'Kütle Merkezi',
  spacecraft: 'Uzay Aracı',
  blackhole: 'Kara Delik',
  pulsar: 'Pulsar / Nötron Yıldızı',
};

/** Mass in solar masses, e.g. "9,6 M☉" or "4,3 milyon M☉" */
export function fmtSolarMass(m: number): string {
  if (m >= 1e9) return `${(m / 1e9).toLocaleString('tr-TR', { maximumFractionDigits: 1 })} milyar M☉`;
  if (m >= 1e6) return `${(m / 1e6).toLocaleString('tr-TR', { maximumFractionDigits: 2 })} milyon M☉`;
  return `${m.toLocaleString('tr-TR', { maximumFractionDigits: 1 })} M☉`;
}
