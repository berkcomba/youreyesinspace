import fs from 'node:fs';
import path from 'node:path';
import { _, LOCALES, type Locale } from '../../src/i18n';

export const SITE = 'https://youreyesinspace.com';
export const LANGS: Locale[] = ['en', 'tr', 'de', 'es', 'fr'];

/* ------------------------------------------------------------------ strings */

let wiki: Record<string, string> = {};
let lang: Locale = 'en';
export const missing = new Map<Locale, Set<string>>();

export function setWikiLocale(root: string, l: Locale): void {
  lang = l;
  const f = path.join(root, `scripts/ssg/locales/${l}.json`);
  wiki = l !== 'tr' && fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : {};
}

export function currentLang(): Locale { return lang; }

/** wiki template strings first (scripts/ssg/locales), then the app's dictionaries */
export function t(key: string, params?: Record<string, string | number>): string {
  const s = wiki[key];
  if (s !== undefined) {
    if (!params) return s;
    let out = s;
    for (const k of Object.keys(params)) out = out.split(`{${k}}`).join(String(params[k]));
    return out;
  }
  return _(key, params);
}

/** a wiki template string: must exist in every dictionary (reported at the end of the run) */
export function w(key: string, params?: Record<string, string | number>): string {
  if (lang !== 'tr' && wiki[key] === undefined) {
    let m = missing.get(lang);
    if (!m) missing.set(lang, (m = new Set()));
    m.add(key);
  }
  return t(key, params);
}

export function esc(s: string | number): string {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* ------------------------------------------------------------------ urls */

export function url(p: string, l: Locale = lang): string {
  return l === 'en' ? p : `/${l}${p}`;
}

export function homeUrl(l: Locale = lang): string {
  return l === 'en' ? '/' : `/?lang=${l}`;
}

/** link into the simulation (`?open=…`, `?target=…`, `?event=…`) in the page language */
export function appUrl(query: Record<string, string>): string {
  const q = new URLSearchParams(query);
  if (lang !== 'en') q.set('lang', lang);
  return `/?${q.toString()}`;
}

export function a(href: string, label: string, cls = ''): string {
  return `<a href="${esc(href)}"${cls ? ` class="${cls}"` : ''}>${esc(label)}</a>`;
}

/* ------------------------------------------------------------------ building blocks */

export function factTable(rows: Array<[string, string | null | undefined] | null>): string {
  const body = rows
    .filter((r): r is [string, string] => !!r && r[1] !== null && r[1] !== undefined && r[1] !== '')
    .map(([k, v]) => `<tr><th scope="row">${esc(k)}</th><td>${v}</td></tr>`)
    .join('');
  return body ? `<table class="w-facts"><tbody>${body}</tbody></table>` : '';
}

export function section(title: string, html: string): string {
  return html ? `<section class="w-sec"><h2>${esc(title)}</h2>${html}</section>` : '';
}

export function linkList(items: Array<{ href: string | null; label: string; note?: string }>, cls = 'w-list'): string {
  if (!items.length) return '';
  return `<ul class="${cls}">${items.map((i) => `<li>${i.href ? a(i.href, i.label) : esc(i.label)}${i.note ? ` <span class="w-note">${esc(i.note)}</span>` : ''}</li>`).join('')}</ul>`;
}

/** the locator widget (/wiki/locator.js): every parameter comes from the page, the sky from /encyclopedia/sky.json */
export function locator(o: { ra: number; dec: number; ly?: number; mag?: number | null; con: string; name: string; fov?: number; area?: boolean }): string {
  const attrs = [`data-ra="${o.ra.toFixed(3)}"`, `data-dec="${o.dec.toFixed(3)}"`, `data-con="${esc(o.con)}"`, `data-name="${esc(o.name)}"`];
  if (o.ly !== undefined && o.ly > 0) attrs.push(`data-ly="${Number(o.ly.toPrecision(4))}"`);
  if (o.mag !== undefined && o.mag !== null && Number.isFinite(o.mag)) attrs.push(`data-mag="${o.mag.toFixed(2)}"`);
  if (o.fov) attrs.push(`data-fov="${o.fov}"`);
  if (o.area) attrs.push('data-area="1"');
  return `<figure class="w-loc" ${attrs.join(' ')}></figure>`;
}

export function locatorStrings(): Record<string, string> {
  return {
    sky: w('Gökyüzünde'), all: w('Tüm gökyüzü'), top: w('Yukarıdan'), fov: w('Görüş alanı'), scale: w('Ölçek'), reset: w('Ortala'),
    ra: w('Sağ açıklık'), dec: w('Dik açıklık'), con: w('Takımyıldız'), mag: w('Görünür parlaklık'), dist: w('Uzaklık'),
    l: w('Galaktik boylam'), b: w('Galaktik enlem'),
    ly: w('ışık yılı'), kly: w('bin ışık yılı'), Mly: w('milyon ışık yılı'), Gly: w('milyar ışık yılı'),
    hintSky: w('Sürükleyerek gezinin; bir yıldıza tıklayınca sayfası açılır.'),
    hintAll: w('Tüm gökyüzü: bir noktaya tıklayınca o bölgeye yakınlaşır. Kesikli çizgi Samanyolu\'nun düzlemi, noktalı çizgi ekliptik.'),
    hintTop: w('Galaksiye tepeden bakış: Güneş ortada, Samanyolu\'nun merkezi yukarıda. Kollar şematiktir; cismin konumu galaksi düzlemine izdüşürülmüştür.'),
    north: w('K'), east: w('D'), gc: w('Samanyolu merkezi'), ecl: w('Ekliptik'), mw: w('Samanyolu'), sun: w('Güneş'),
    embed: w('Yerleştir'), embedHint: w('Bu haritayı kendi sitenizde göstermek için kodu sayfanıza yapıştırın.'), copy: w('Kopyala'), copied: w('Kopyalandı'),
    more: w('Ansiklopedide aç'),
  };
}

/**
 * /embed/locator/?embed=1&p=<page path>: the locator of an encyclopedia page alone, for an iframe
 * on another site (nginx allows framing only with `embed=1`). Language-free: the page path says
 * which page (and language) to take the widget from.
 */
export function renderEmbed(buildId: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex" />
    <title>Your Eyes In Space</title>
    <link rel="stylesheet" href="/wiki/wiki.css?v=${buildId}" />
  </head>
  <body class="w-embed">
    <figure class="w-loc" data-embed="1"></figure>
    <script src="/wiki/embed.js?v=${buildId}"></script>
    <script src="/wiki/locator.js?v=${buildId}" defer></script>
  </body>
</html>
`;
}

export function openButton(href: string, label = w('Simülasyonda aç')): string {
  return `<p class="w-open"><a class="w-btn" href="${esc(href)}">${esc(label)} <span aria-hidden="true">→</span></a></p>`;
}

/* ------------------------------------------------------------------ page */

export interface Page {
  /** language-independent path, e.g. /stars/sirius */
  path: string;
  title: string;
  description: string;
  h1: string;
  /** small line above the title (kind of object) */
  eyebrow?: string;
  lede?: string;
  body: string;
  crumbs: Array<[string, string]>;
  jsonld?: Array<Record<string, unknown>>;
  noindex?: boolean;
  /** full-width body instead of text column + data sheet */
  wide?: boolean;
  /** scripts under /wiki (versioned with the build) */
  scripts?: string[];
}

const NAV: Array<[string, string]> = [
  ['/stars', 'Yıldızlar'], ['/exoplanets', 'Ötegezegenler'], ['/constellations', 'Takımyıldızlar'], ['/solar-system', 'Güneş Sistemi'],
  ['/deep-sky', 'Derin gökyüzü'], ['/galaxies', 'Galaksiler'], ['/black-holes', 'Kara delikler'], ['/sky-events', 'Gök olayları'],
  ['/encyclopedia/a-z', 'A\'dan Z\'ye'],
];

export function render(p: Page, buildId: string, available: Locale[] = LANGS): string {
  const self = SITE + url(p.path);
  const alternates = available.map((l) => `<link rel="alternate" hreflang="${l}" href="${SITE}${url(p.path, l)}" />`).join('\n    ')
    + `\n    <link rel="alternate" hreflang="x-default" href="${SITE}${url(p.path, 'en')}" />`;
  const crumbs = p.path === '/encyclopedia' ? [] : [[w('Ansiklopedi'), '/encyclopedia'] as [string, string], ...p.crumbs];
  const crumbLd = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [...crumbs, [p.h1, p.path]].map(([name, cp], k) => ({ '@type': 'ListItem', position: k + 1, name, item: SITE + url(cp) })),
  };
  const ld = [crumbLd, ...(p.jsonld ?? [])].map((o) => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, '\\u003c')}</script>`).join('\n    ');
  const tag = LOCALES.find((l) => l.code === lang)?.tag.replace('-', '_') ?? 'en_US';
  const langLinks = available.map((l) => l === lang
    ? `<span aria-current="true">${esc(LOCALES.find((x) => x.code === l)!.label)}</span>`
    : `<a href="${esc(url(p.path, l))}" hreflang="${l}" lang="${l}">${esc(LOCALES.find((x) => x.code === l)!.label)}</a>`).join('');
  const nav = NAV.map(([np, label]) => `<a href="${url(np)}"${p.path.startsWith(np) ? ' aria-current="page"' : ''}>${esc(w(label))}</a>`).join('');
  const title = `${p.title} · Your Eyes In Space`;
  return `<!doctype html>
<html lang="${lang}">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="theme-color" content="#090b0f" />
    <title>${esc(title)}</title>
    <meta name="description" content="${esc(p.description)}" />
    ${p.noindex ? '<meta name="robots" content="noindex, follow" />' : `<link rel="canonical" href="${self}" />\n    ${alternates}`}
    <meta property="og:type" content="article" />
    <meta property="og:site_name" content="Your Eyes In Space" />
    <meta property="og:title" content="${esc(p.title)}" />
    <meta property="og:description" content="${esc(p.description)}" />
    <meta property="og:url" content="${self}" />
    <meta property="og:image" content="${SITE}/og-image.jpg" />
    <meta property="og:locale" content="${tag}" />
    <meta name="twitter:card" content="summary_large_image" />
    <link rel="icon" type="image/png" href="/favicon.png" />
    <link rel="stylesheet" href="/wiki/wiki.css?v=${buildId}" />
    ${ld}
  </head>
  <body>
    <header class="w-top">
      <div class="w-mast">
        <a class="w-brand" href="${homeUrl()}"><img src="/logo-white.png" alt="" /><span>Your Eyes In Space</span></a>
        <a class="w-cta" href="${homeUrl()}">${esc(w('Simülasyonu aç'))} <span aria-hidden="true">→</span></a>
      </div>
      <nav class="w-nav" aria-label="${esc(w('Ansiklopedi'))}">${nav}</nav>
    </header>
    <main class="w-main">
      <nav class="w-crumbs" aria-label="breadcrumb">${crumbs.map(([n, cp]) => `<a href="${url(cp)}">${esc(n)}</a>`).join('<span aria-hidden="true">/</span>')}</nav>
      <article${p.wide ? ' class="w-wide"' : ''}>
        ${p.eyebrow ? `<p class="w-eyebrow">${esc(p.eyebrow)}</p>` : ''}
        <h1>${esc(p.h1)}</h1>
        ${p.lede ? `<p class="w-lede">${p.lede}</p>` : ''}
        ${p.body}
      </article>
    </main>
    <footer class="w-foot">
      <div class="w-langs">${langLinks}</div>
      <p>${esc(w('Your Eyes In Space, gözlemlenebilir evreni gerçek verilerle tarayıcıda gezdiren ücretsiz ve açık kaynaklı bir simülasyondur. Bu sayfadaki değerler simülasyonun kullandığı kataloglardan hesaplanmıştır.'))}</p>
      <p>${esc(w('Kaynaklar'))}: HYG / AT-HYG (David Nash, CC BY-SA 4.0) · ESA Gaia · NASA Exoplanet Archive · NASA/JPL · ATNF Pulsar Catalogue · HEASARC · NED · IAU. <a href="https://github.com/berkcomba/youreyesinspace">${esc(w('Kaynak kodu'))}</a> (AGPL-3.0)</p>
    </footer>${[...(p.scripts ?? []), ...(p.body.includes('class="w-loc"') ? ['/wiki/locator.js'] : [])].map((s) => `\n    <script src="${s}?v=${buildId}" defer></script>`).join('')}
  </body>
</html>
`;
}
