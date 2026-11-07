// /embed/locator/?embed=1&p=/tr/stars/sirius — the locator of one encyclopedia page, alone in an
// iframe on another site. Runs before locator.js: sets the language from the page path at once and
// leaves `window.yeisEmbed`, which resolves once the page's widget parameters are on the figure.
(() => {
  const fig = document.querySelector('.w-loc[data-embed]');
  if (!fig) return;
  const p = new URLSearchParams(location.search).get('p') || '';
  const m = /^\/(?:(tr|de|es|fr)\/)?[a-z-]+\/[\w.~%-]+\/?$/.exec(p);
  if (!m) { fig.hidden = true; return; }
  document.documentElement.lang = m[1] || 'en';
  fig.dataset.page = p;
  window.yeisEmbed = fetch(p)
    .then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.text(); })
    .then((html) => {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const src = doc.querySelector('.w-loc');
      if (!src) throw new Error('no locator');
      for (const k of ['ra', 'dec', 'ly', 'mag', 'con', 'name', 'fov', 'area']) if (src.dataset[k] !== undefined) fig.dataset[k] = src.dataset[k];
      const h1 = doc.querySelector('h1')?.textContent?.trim();
      document.title = `${h1 || fig.dataset.name || ''} · Your Eyes In Space`;
    });
})();
