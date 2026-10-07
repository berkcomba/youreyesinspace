/**
 * Minimal gettext-style i18n.
 *
 * Source strings are Turkish (the language the app was written in); dictionaries map them to the
 * other locales. `_()` is identity for Turkish and for any string without a translation, so new
 * text degrades gracefully. Dictionaries are code-split and loaded once in `initI18n()` before
 * the app boots — therefore `_()` must only be called at *runtime* (render / event time), never
 * at module top level.
 */

export type Locale = 'tr' | 'en' | 'de' | 'es' | 'fr';

export interface LocaleInfo {
  code: Locale;
  /** native name shown in the selector */
  label: string;
  /** BCP-47 tag for Intl formatting */
  tag: string;
}

export const LOCALES: readonly LocaleInfo[] = [
  { code: 'tr', label: 'Türkçe', tag: 'tr-TR' },
  { code: 'en', label: 'English', tag: 'en-US' },
  { code: 'de', label: 'Deutsch', tag: 'de-DE' },
  { code: 'es', label: 'Español', tag: 'es-ES' },
  { code: 'fr', label: 'Français', tag: 'fr-FR' },
];

const STORAGE_KEY = 'yeits.locale';
let current: Locale = 'tr';
let dict: Record<string, string> = {};
const missing = new Set<string>();

export function isLocale(x: string | null | undefined): x is Locale {
  return !!x && LOCALES.some((l) => l.code === x);
}

/** `?lang=` → saved preference → browser languages → English (Turkish for Turkish browsers) */
export function detectLocale(): Locale {
  try {
    const q = new URLSearchParams(location.search).get('lang');
    if (isLocale(q)) return q;
    const saved = localStorage.getItem(STORAGE_KEY);
    if (isLocale(saved)) return saved;
  } catch { /* private mode etc. */ }
  const langs = typeof navigator !== 'undefined' ? navigator.languages ?? [navigator.language] : [];
  for (const l of langs) {
    const code = (l ?? '').slice(0, 2).toLowerCase();
    if (isLocale(code)) return code;
  }
  return 'en';
}

/** Load the dictionary for the detected locale (call once, before building the UI). */
export async function initI18n(forced?: Locale): Promise<Locale> {
  current = forced ?? detectLocale();
  dict = {};
  if (current !== 'tr') {
    const mod = await loadDict(current);
    dict = mod;
  }
  try { document.documentElement.lang = current; } catch { /* no DOM */ }
  return current;
}

/** `locales/<code>/*.json` — split by domain (ui / data) to keep files reviewable; merged at load */
const DICTS = import.meta.glob<{ default: Record<string, string> }>('./locales/*/*.json');

async function loadDict(code: Locale): Promise<Record<string, string>> {
  const parts = await Promise.all(
    Object.entries(DICTS).filter(([path]) => path.includes(`/locales/${code}/`)).map(([, load]) => load()),
  );
  return Object.assign({}, ...parts.map((m) => m.default));
}

export function currentLocale(): Locale {
  return current;
}

export function localeTag(): string {
  return LOCALES.find((l) => l.code === current)?.tag ?? 'en-US';
}

/** Persist the preference and reload: all rendered text is rebuilt from scratch. */
export function setLocale(code: Locale): void {
  try { localStorage.setItem(STORAGE_KEY, code); } catch { /* ignore */ }
  const url = new URL(location.href);
  url.searchParams.delete('lang');
  location.replace(url.toString());
}

/**
 * Translate a source (Turkish) string. `{name}` placeholders are substituted from `params`
 * after translation, so word order can differ per language.
 */
export function _(key: string, params?: Record<string, string | number>): string {
  let s = dict[key];
  if (s === undefined) {
    s = key;
    if (current !== 'tr' && import.meta.env.DEV && /\p{L}{2}/u.test(key)) missing.add(key);
  }
  if (params) {
    for (const k of Object.keys(params)) s = s.split(`{${k}}`).join(String(params[k]));
  }
  return s;
}

/** Keys seen without a translation in this session (dev aid). */
export function missingKeys(): string[] {
  return Array.from(missing).sort();
}
// dev console aid: `__i18n.missingKeys()`
if (import.meta.env.DEV) (globalThis as unknown as { __i18n: unknown }).__i18n = { missingKeys, currentLocale };

/** `toLocaleString` with the active locale */
export function fmtNum(n: number, opts?: Intl.NumberFormatOptions): string {
  return n.toLocaleString(localeTag(), opts);
}

/** Locale-aware `n.toFixed(digits)` (decimal separator + grouping follow the UI language). */
export function fixed(n: number, digits: number): string {
  if (!Number.isFinite(n)) return String(n);
  return n.toLocaleString(localeTag(), { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

/**
 * Translate static markup: elements carrying `data-i18n` (text), `data-i18n-html` (innerHTML),
 * `data-i18n-title`, `data-i18n-placeholder`, `data-i18n-content` (meta tags). The attribute
 * value is the source string; when it is empty the element's current text is used as the key
 * and written back so the markup can stay in Turkish.
 *
 * Elements with an explicit key may carry *English* static content (so crawlers and link
 * previews, which don't run JS, see English); they are rewritten for every locale including
 * Turkish, where `_()` is the identity and therefore yields the Turkish key itself.
 */
export function applyDom(root: ParentNode = document): void {
  const tr = current === 'tr';
  const norm = (s: string) => s.replace(/\s+/g, ' ').trim();
  root.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => {
    if (tr && !el.dataset.i18n) return;
    const key = el.dataset.i18n || norm(el.textContent ?? '');
    if (!el.dataset.i18n) el.dataset.i18n = key;
    el.textContent = _(key);
  });
  root.querySelectorAll<HTMLElement>('[data-i18n-html]').forEach((el) => {
    if (tr && !el.dataset.i18nHtml) return;
    const key = el.dataset.i18nHtml || norm(el.innerHTML);
    if (!el.dataset.i18nHtml) el.dataset.i18nHtml = key;
    el.innerHTML = _(key);
  });
  root.querySelectorAll<HTMLElement>('[data-i18n-title]').forEach((el) => {
    if (tr && !el.dataset.i18nTitle) return;
    const key = el.dataset.i18nTitle || el.title;
    if (!el.dataset.i18nTitle) el.dataset.i18nTitle = key;
    el.title = _(key);
  });
  root.querySelectorAll<HTMLInputElement>('[data-i18n-placeholder]').forEach((el) => {
    if (tr && !el.dataset.i18nPlaceholder) return;
    const key = el.dataset.i18nPlaceholder || el.placeholder;
    if (!el.dataset.i18nPlaceholder) el.dataset.i18nPlaceholder = key;
    el.placeholder = _(key);
  });
  root.querySelectorAll<HTMLMetaElement>('[data-i18n-content]').forEach((el) => {
    if (tr && !el.dataset.i18nContent) return;
    const key = el.dataset.i18nContent || el.content;
    if (!el.dataset.i18nContent) el.dataset.i18nContent = key;
    el.content = _(key);
  });
}
