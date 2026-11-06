import { currentLocale } from '../i18n';

/** `?open=` key → encyclopedia path, written by the static site build; loaded on first use */
let index: Record<string, string> | null = null;
let loading = false;

function localized(p: string): string {
  const l = currentLocale();
  return l === 'en' ? p : `/${l}${p}`;
}

export function wikiHome(): string {
  return localized('/encyclopedia');
}

/** the encyclopedia page for a selection, or null while the index loads or when it has no page */
export function wikiPage(key: string | null): string | null {
  if (!key) return null;
  if (!index) {
    if (!loading) {
      loading = true;
      fetch('/encyclopedia/index.json')
        .then((r) => (r.ok ? r.json() : {}))
        .then((j: Record<string, string>) => { index = j; })
        .catch(() => { index = {}; });
    }
    return null;
  }
  const p = index[key];
  return p ? localized(p) : null;
}
