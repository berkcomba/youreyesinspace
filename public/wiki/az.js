// A–Z index: searches every entry of the encyclopedia (data from the static build, loaded on first use)
(() => {
  const form = document.querySelector('.w-search[data-src]');
  if (!form) return;
  const input = form.querySelector('input');
  const body = document.querySelector('.w-az-body');
  const bar = document.querySelector('.w-az');
  const out = document.querySelector('.w-az-results');
  const kinds = JSON.parse(form.dataset.kinds);
  const norm = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/ı/g, 'i');
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  let data = null, loading = null, timer = 0, first = null;

  const load = () => (loading ??= fetch(form.dataset.src)
    .then((r) => r.json())
    .then((rows) => { data = rows.map(([name, path, kind, alt]) => ({ name, path, kind, key: norm(alt ? `${name} ${alt}` : name) })); }));

  function show() {
    const q = norm(input.value.trim());
    const searching = q.length > 0;
    body.hidden = bar.hidden = searching;
    out.hidden = !searching;
    first = null;
    if (!searching) return;
    if (!data) { load().then(show); return; }
    // whole-name prefix first, then word prefix, then anywhere
    const hits = [];
    for (const e of data) {
      const k = e.key.indexOf(q);
      if (k < 0) continue;
      hits.push([k === 0 ? 0 : e.key[k - 1] === ' ' || e.key[k - 1] === '-' ? 1 : 2, e]);
    }
    hits.sort((x, y) => x[0] - y[0] || x[1].name.length - y[1].name.length);
    first = hits[0]?.[1] ?? null;
    const shown = hits.slice(0, 400);
    out.innerHTML = `<h2>${esc(hits.length ? form.dataset.count.replace('{n}', hits.length.toLocaleString(document.documentElement.lang)) : form.dataset.none)}</h2>`
      + `<ul class="w-list w-cols">${shown.map(([, e]) => `<li><a href="${esc(e.path)}">${esc(e.name)}</a> <span class="w-note">${esc(kinds[e.kind])}</span></li>`).join('')}</ul>`;
  }

  input.addEventListener('focus', load, { once: true });
  input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(show, 120); });
  form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    clearTimeout(timer);
    show();
    if (first) location.href = first.path;
  });
  const q = new URLSearchParams(location.search).get('q');
  if (q) { input.value = q; show(); }
})();
