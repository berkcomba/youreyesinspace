import { AU_KM, C_KM_S, LIGHT_YEAR_KM, PARSEC_KM } from '../core/constants';
import { _, fixed, fmtNum } from '../i18n';

export function fmtDistance(km: number): string {
  const a = Math.abs(km);
  if (a < 1) return `${fixed((km * 1000), 1)} m`;
  if (a < 1e4) return `${fixed(km, 2)} km`;
  if (a < 1e6) return `${fmtNum(km, { maximumFractionDigits: 0 })} km`;
  if (a < AU_KM * 0.05) return _('{n} milyon km', { n: fixed((km / 1e6), 3) });
  if (a < LIGHT_YEAR_KM * 0.1) return `${fixed((km / AU_KM), km / AU_KM < 10 ? 4 : 2)} AU`;
  if (a < PARSEC_KM * 1000) return `${fixed((km / LIGHT_YEAR_KM), 2)} ly`;
  if (a < PARSEC_KM * 1e6) return `${fixed((km / PARSEC_KM / 1000), 2)} kpc`;
  return `${fixed((km / PARSEC_KM / 1e6), 2)} Mpc`;
}

/** Distance in light-years, scaled (ly / kly / Mly) */
export function fmtLightYears(km: number): string {
  const ly = km / LIGHT_YEAR_KM;
  if (ly < 1000) return `${fixed(ly, 1)} ly`;
  if (ly < 1e6) return _('{n} bin ly', { n: fixed((ly / 1000), 1) });
  return _('{n} milyon ly', { n: fixed((ly / 1e6), 2) });
}

export function fmtSpeed(kms: number): string {
  if (kms === 0) return '0 m/s';
  const a = Math.abs(kms);
  if (a < 1) return `${fixed((kms * 1000), 1)} m/s`;
  if (a < 1000) return `${fixed(kms, 2)} km/s`;
  if (a < C_KM_S * 0.5) return `${fixed((kms / 1000), 1)}k km/s`;
  if (a < C_KM_S * 1000) return `${fixed((kms / C_KM_S), 2)} c`;
  if (a < AU_KM * 100) return `${fixed((kms / AU_KM), 2)} AU/s`;
  if (a < LIGHT_YEAR_KM * 1000) return `${fixed((kms / LIGHT_YEAR_KM), 3)} ly/s`;
  if (a < PARSEC_KM * 1e6) return `${fixed((kms / PARSEC_KM / 1000), 2)} kpc/s`;
  return `${fixed((kms / PARSEC_KM / 1e6), 2)} Mpc/s`;
}

export function fmtSci(x: number, unit = '', digits = 3): string {
  if (x === 0) return `0 ${unit}`;
  const exp = Math.floor(Math.log10(Math.abs(x)));
  const mant = x / Math.pow(10, exp);
  const sup = String(exp).replace(/-/g, '⁻').replace(/\d/g, (d) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[+d]);
  return `${fixed(mant, digits - 1)}×10${sup} ${unit}`.trim();
}

export function fmtMass(kg: number): string {
  const earth = 5.97237e24;
  const sun = 1.9885e30;
  if (kg > sun * 0.01) return `${fixed((kg / sun), 3)} M☉`;
  if (kg > earth * 0.001) return `${fixed((kg / earth), kg / earth < 1 ? 4 : 2)} M⊕ (${fmtSci(kg, 'kg')})`;
  return fmtSci(kg, 'kg');
}

export function fmtRadius(km: number, earthRel = true): string {
  const s = km >= 1000 ? `${fmtNum(km, { maximumFractionDigits: 0 })} km` : `${fixed(km, 1)} km`;
  if (!earthRel) return s;
  const re = km / 6371;
  return re > 0.05 ? `${s} (${fixed(re, 2)} R⊕)` : s;
}

export function fmtTemp(k: number): string {
  if (!Number.isFinite(k) || k <= 0) return '—';
  return `${fixed(k, 0)} K (${fixed((k - 273.15), 0)} °C)`;
}

export function fmtDeg(d: number, digits = 2): string {
  return `${fixed(d, digits)}°`;
}

export function fmtDuration(seconds: number): string {
  const a = Math.abs(seconds);
  if (a < 60) return `${fixed(seconds, 1)} s`;
  if (a < 3600) return _('{n} dk', { n: fixed((seconds / 60), 1) });
  if (a < 86400 * 2) return _('{n} sa', { n: fixed((seconds / 3600), 2) });
  if (a < 86400 * 365.25 * 2) return _('{n} gün', { n: fixed((seconds / 86400), 2) });
  const years = seconds / (86400 * 365.25);
  if (a < 86400 * 365.25 * 1e4) return _('{n} yıl', { n: fixed(years, 2) });
  if (years < 1e6) return _('{n} bin yıl', { n: fixed((years / 1e3), 1) });
  if (years < 1e9) return _('{n} milyon yıl', { n: fixed((years / 1e6), 2) });
  return _('{n} milyar yıl', { n: fixed((years / 1e9), 2) });
}

/** Source (Turkish) labels — display through `typeLabel()` */
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

export function typeLabel(type: string): string {
  return TYPE_LABELS[type] ? _(TYPE_LABELS[type]) : type;
}

/** Mass in solar masses, e.g. "9,6 M☉" or "4,3 milyon M☉" */
export function fmtSolarMass(m: number): string {
  if (m >= 1e9) return _('{n} milyar M☉', { n: fmtNum(m / 1e9, { maximumFractionDigits: 1 }) });
  if (m >= 1e6) return _('{n} milyon M☉', { n: fmtNum(m / 1e6, { maximumFractionDigits: 2 }) });
  return `${fmtNum(m, { maximumFractionDigits: 1 })} M☉`;
}
