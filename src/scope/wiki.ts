/**
 * Encyclopedia entry (bundled to /wiki/scope.js by scripts/ssg/build.mjs): every
 * `<figure class="w-scope" data-t="<ScopeTarget JSON>">` on the page becomes a telescope view
 * once it scrolls near; the strings come from /encyclopedia/scope.json in the page language.
 */
import { mountScope } from './ScopeView';
import type { ScopeStrings, ScopeTarget } from './types';

const figs = [...document.querySelectorAll<HTMLElement>('.w-scope[data-t]')];
if (figs.length) {
  const lang = document.documentElement.lang || 'en';
  const base = lang === 'en' ? '' : `/${lang}`;
  const strings = fetch(`${base}/encyclopedia/scope.json`).then((r) => r.json() as Promise<ScopeStrings>);
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      const fig = e.target as HTMLElement;
      io.unobserve(fig);
      strings.then((T) => {
        const target = JSON.parse(fig.dataset.t!) as ScopeTarget;
        mountScope(fig, target, T, { lang });
      }).catch(() => { fig.hidden = true; });
    }
  }, { rootMargin: '300px' });
  for (const f of figs) io.observe(f);
}
