import { fixed, fmtNum, localeTag } from '../../src/i18n';
import { w } from './html';

/** distance in light-years, scaled */
export function ly(v: number): string {
  if (v >= 1e9) return w('{n} milyar ışık yılı', { n: fixed(v / 1e9, 2) });
  if (v >= 1e6) return w('{n} milyon ışık yılı', { n: fixed(v / 1e6, v < 1e7 ? 2 : 1) });
  if (v >= 1e4) return w('{n} ışık yılı', { n: fmtNum(Math.round(v / 100) * 100) });
  return w('{n} ışık yılı', { n: v < 10 ? fixed(v, 2) : v < 1000 ? fixed(v, 1) : fmtNum(Math.round(v)) });
}

export function pc(v: number): string {
  if (v >= 1e6) return `${fixed(v / 1e6, 2)} Mpc`;
  if (v >= 1e4) return `${fixed(v / 1e3, 1)} kpc`;
  return `${v < 10 ? fixed(v, 2) : v < 1000 ? fixed(v, 1) : fmtNum(Math.round(v))} pc`;
}

export function num(v: number, digits = 2): string {
  if (!Number.isFinite(v)) return '—';
  const a = Math.abs(v);
  if (a !== 0 && (a >= 1e6 || a < 10 ** -digits)) return sci(v, 3);
  return fixed(v, digits);
}

/** 3 significant figures */
export function sig(v: number, n = 3): string {
  if (!Number.isFinite(v)) return '—';
  if (Math.abs(v) >= 1e6 || (v !== 0 && Math.abs(v) < 1e-3)) return sci(v, n);
  return fmtNum(v, { maximumSignificantDigits: n });
}

export function sci(x: number, digits = 3): string {
  if (x === 0) return '0';
  const e = Math.floor(Math.log10(Math.abs(x)));
  const m = x / 10 ** e;
  const sup = String(e).replace(/-/g, '⁻').replace(/\d/g, (d) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[+d]);
  return `${fixed(m, digits - 1)} × 10${sup}`;
}

export function mag(v: number): string {
  return fixed(v, 2).replace(/^-/, '−');
}

export function monthName(m: number): string {
  return new Intl.DateTimeFormat(localeTag(), { month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(2026, m, 15)));
}

export function dateLong(iso: string, withTime = false): string {
  const d = new Date(iso);
  const s = d.toLocaleDateString(localeTag(), { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  return withTime ? `${s}, ${d.toLocaleTimeString(localeTag(), { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })} UTC` : s;
}

/** a latitude, e.g. "40° K" / "40° N" */
export function lat(v: number): string {
  const r = Math.round(v);
  if (r === 0) return w('ekvator');
  return r > 0 ? w('{n}° K', { n: r }) : w('{n}° G', { n: -r });
}

/** a duration in years, scaled */
export function years(y: number): string {
  if (y >= 1e9) return w('{n} milyar yıl', { n: fixed(y / 1e9, 1) });
  if (y >= 1e6) return w('{n} milyon yıl', { n: fixed(y / 1e6, y < 1e7 ? 1 : 0) });
  if (y >= 1e4) return w('{n} bin yıl', { n: fmtNum(Math.round(y / 1e3)) });
  if (y >= 2) return w('{n} yıl', { n: fmtNum(Math.round(y)) });
  return w('{n} gün', { n: fmtNum(Math.round(y * 365.25)) });
}

export function plain(html: string, max = 158): string {
  const s = html.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();
  if (s.length <= max) return s;
  const cut = s.slice(0, max - 1);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), max - 20))}…`;
}
