import fs from 'node:fs';
import path from 'node:path';
import { initI18n, type Locale } from '../../src/i18n';
import { BLACK_HOLES } from '../../src/data/blackholes';
import { deepSkyLandmarks, type DeepSkyData } from '../../src/data/DeepSky';
import { EVENTS } from '../../src/data/events';
import type { ExoHost } from '../../src/data/Exoplanets';
import { LANDMARKS, type LandmarkDef } from '../../src/data/landmarks';
import { SOLAR_SYSTEM } from '../../src/data/solarSystem';
import { CATALOG, TYPE_BY_CODE, type SurveyGalaxies } from '../../src/galaxy/galaxies';
import { CONSTELLATIONS, constellationAt, setBoundaries, setReferenceStars, slugify, unitRaDec } from './astro';
import { SEARCH_PATH, azEntries, azPages, searchJson } from './az';
import { CoreCatalog } from './catalog';
import { LANGS, SITE, missing, render, setWikiLocale, t, url, type Page } from './html';
import type { ConstellationEntry, DsoEntry, GalaxyEntry, PlanetEntry, Site, StarEntry } from './model';
import {
  blackHolePage, constellationPage, dsoPage, eventPage, fallbackStarPage, galaxyPage, hubPages, planetPage, solarPage, starPage,
} from './pages';

interface Options { langs: Locale[]; limit: number; out: string; strict: boolean }

function parseArgs(root: string, args: string[]): Options {
  const get = (k: string) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
  return {
    langs: (get('--langs')?.split(',') as Locale[] | undefined) ?? LANGS,
    limit: get('--limit') ? parseInt(get('--limit')!, 10) : Infinity,
    out: path.resolve(get('--out') ?? path.join(root, 'dist')),
    strict: args.includes('--strict'),
  };
}

const json = <T>(f: string): T => JSON.parse(fs.readFileSync(f, 'utf8')) as T;

/** unique slugs within a section: the first (most important) entry gets the plain one */
function slugger(): (s: string, alt: string) => string {
  const used = new Set<string>();
  return (s, alt) => {
    let slug = slugify(s) || slugify(alt) || 'x';
    if (used.has(slug)) slug = `${slug}-${slugify(alt)}`;
    let k = 2;
    while (used.has(slug)) slug = `${slug.replace(/-\d+$/, '')}-${k++}`;
    used.add(slug);
    return slug;
  };
}

/** catalogue pulsars, open clusters and H II regions that people actually look up */
function notable(d: LandmarkDef): boolean {
  if (!d.catalog) return true;
  if (d.kind === 'pulsar') return /^PSR B/.test(d.name) || 'Bulunduğu yer' in d.facts || 'Yoldaş' in d.facts || d.absMag === 5;
  if (d.kind === 'cluster') return !/^MWSC/.test(d.name);
  if (d.kind === 'nebula') return !/^WISE/.test(d.name);
  return true;
}

async function buildSite(root: string, buildDate: string): Promise<{ site: Site; dsoIds: string[] }> {
  await initI18n('en');
  setWikiLocale(root, 'en');
  const data = path.join(root, 'public/data');
  const cat = new CoreCatalog(fs.readFileSync(path.join(data, 'stars.bin')), json(path.join(data, 'star-names.json')));
  const exo = json<{ source?: string; fetched: string; hosts: ExoHost[] }>(path.join(data, 'exoplanets.json'));
  const hosts = new Map(exo.hosts.map((h) => [h.i, h]));

  const bounds = path.join(root, 'scripts/ssg/data/constellations.dat');
  if (fs.existsSync(bounds)) setBoundaries(fs.readFileSync(bounds, 'utf8'));
  const refs: Array<{ ra: number; dec: number; c: string }> = [];
  for (const [i, n] of cat.names) if (n.constellation && CONSTELLATIONS[n.constellation] && i > 0) refs.push({ ...cat.raDec(i), c: n.constellation });
  setReferenceStars(refs);

  // stars: named, naked-eye, exoplanet hosts and any promoted ones; brightest first for the clean slugs
  const promoteFile = path.join(root, 'scripts/ssg/promote.json');
  const promoted = new Set<number>(fs.existsSync(promoteFile) ? json<{ hip: number[] }>(promoteFile).hip : []);
  const picks: number[] = [];
  for (let i = 1; i < cat.n; i++) if (cat.names.has(i) || cat.mag[i] <= 6.5 || hosts.has(i) || promoted.has(cat.hip[i])) picks.push(i);
  picks.sort((x, y) => cat.mag[x] - cat.mag[y]);
  const starSlug = slugger();
  const stars: StarEntry[] = picks.map((i) => {
    const { ra, dec } = cat.raDec(i);
    const named = cat.names.get(i)?.constellation;
    const con = named && CONSTELLATIONS[named] ? named : constellationAt(ra, dec);
    const name = cat.nameOf(i);
    return { i, slug: starSlug(name, cat.hip[i] ? `hip-${cat.hip[i]}` : `hyg-${i}`), name, con, ra, dec, dist: cat.dist(i), mag: cat.mag[i], host: hosts.get(i) };
  });
  const starByIndex = new Map(stars.map((s) => [s.i, s]));

  const planetSlug = slugger();
  const planets: PlanetEntry[] = [];
  const planetsByHost = new Map<number, PlanetEntry[]>();
  for (const h of [...exo.hosts].sort((x, y) => (x.dist ?? 1e9) - (y.dist ?? 1e9))) {
    const list = [...h.planets].sort((x, y) => (x.a ?? x.P ?? 0) - (y.a ?? y.P ?? 0)).map((planet) => ({ host: h, planet, slug: planetSlug(planet.name, h.name), star: starByIndex.get(h.i) ?? null }));
    planets.push(...list);
    planetsByHost.set(h.i, list);
  }

  // deep sky (the texts are rebuilt per language; ids, names and positions are not)
  const deepSky = json<DeepSkyData>(path.join(data, 'deepsky.json'));
  const defs = [...LANDMARKS.filter((d) => !d.procedural), ...deepSkyLandmarks(deepSky, LANDMARKS)].filter(notable);
  const dsoSlug = slugger();
  const dsos: DsoEntry[] = defs.map((d) => ({ id: d.id, slug: dsoSlug(t(d.name), d.id), con: constellationAt(d.ra, d.dec), ra: d.ra, dec: d.dec, handMade: !d.catalog }));

  // galaxies: the hand-made list, every UNGC galaxy, the NGC/IC/Messier ones of 2MRS
  const survey = json<SurveyGalaxies>(path.join(data, 'galaxies.json'));
  const galSlug = slugger();
  const galaxies: GalaxyEntry[] = CATALOG.map((g) => ({
    name: g.name, slug: galSlug(t(g.name), g.name), con: constellationAt(g.ra, g.dec), ra: g.ra, dec: g.dec, distMpc: g.distMpc,
    type: g.type, typeGuessed: false, diameterKpc: g.diameterKpc, absMag: g.absMag, axis: g.axis, desc: g.desc, source: 'curated' as const,
  }));
  const curatedU = CATALOG.map((g) => unitRaDec(g.ra, g.dec));
  for (const [ra, dec, dMpc, rKpc, absMag, type, axis, name, src] of survey.rows) {
    if (src !== 0 && !/^(NGC|IC|M)\s?\d/.test(name)) continue;
    const u = unitRaDec(ra, dec);
    if (curatedU.some((c) => c[0] * u[0] + c[1] * u[1] + c[2] * u[2] > Math.cos(0.15 * Math.PI / 180))) continue;
    galaxies.push({
      name, slug: galSlug(name, `${ra.toFixed(2)}-${dec.toFixed(2)}`), con: constellationAt(ra, dec), ra, dec, distMpc: dMpc,
      type: TYPE_BY_CODE[type & 7] ?? 'S', typeGuessed: (type & 8) !== 0, diameterKpc: rKpc * 2, absMag, axis, source: src === 0 ? 'ungc' : '2mrs',
    });
  }

  const constellations = new Map<string, ConstellationEntry>();
  for (const abbr of Object.keys(CONSTELLATIONS)) constellations.set(abbr, { abbr, slug: slugify(CONSTELLATIONS[abbr][0]), stars: [], dsos: [], galaxies: [] });
  for (const s of stars) constellations.get(s.con)?.stars.push(s);
  for (const d of dsos) constellations.get(d.con)?.dsos.push(d);
  for (const g of galaxies) constellations.get(g.con)?.galaxies.push(g);

  const bhSlug = slugger();
  const blackHoles = BLACK_HOLES.map((entry) => ({ entry, slug: bhSlug(entry.name, entry.id) }));
  const solSlug = slugger();
  const solar = SOLAR_SYSTEM.filter((b) => b.type !== 'barycenter').map((body) => ({ body, slug: solSlug(t(body.name), body.id) }));
  const events = [...EVENTS].sort((x, y) => x.time.localeCompare(y.time)).map((e) => ({ e, slug: e.id }));

  return {
    site: {
      cat, exoSource: exo.source ?? `NASA Exoplanet Archive (${exo.fetched})`, exoFetched: exo.fetched, stars, starByIndex, planets, planetsByHost, constellations, dsos, galaxies,
      blackHoles, solar, solarById: new Map(solar.map((s) => [s.body.id, s])), events, dsoDefs: new Map(), buildDate,
    },
    dsoIds: dsos.map((d) => d.id),
  };
}

function writePage(out: string, html: string, p: string): void {
  const dir = path.join(out, p);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), html);
}

function sitemaps(out: string, urls: Map<string, string[]>): void {
  const dir = path.join(out, 'sitemaps');
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const files: string[] = [];
  const write = (name: string, list: string[]) => {
    fs.writeFileSync(path.join(dir, name), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${list.map((u) => `  <url><loc>${u}</loc></url>`).join('\n')}\n</urlset>\n`);
    files.push(name);
  };
  write('home.xml', [`${SITE}/`]);
  for (const [sec, list] of urls) for (let k = 0; k * 40_000 < list.length; k++) write(`${sec}-${k + 1}.xml`, list.slice(k * 40_000, (k + 1) * 40_000));
  fs.writeFileSync(path.join(out, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${files.map((f) => `  <sitemap><loc>${SITE}/sitemaps/${f}</loc></sitemap>`).join('\n')}\n</sitemapindex>\n`);
}

export async function generate({ root, args, buildId }: { root: string; args: string[]; buildId: string }): Promise<void> {
  const t0 = Date.now();
  const opt = parseArgs(root, args);
  const buildDate = new Date().toISOString().slice(0, 10);
  const { site, dsoIds } = await buildSite(root, buildDate);
  const lim = <T>(l: T[]) => (Number.isFinite(opt.limit) ? l.slice(0, opt.limit) : l);
  const urls = new Map<string, string[]>();
  let pages = 0, bytes = 0;

  for (const lang of opt.langs) {
    await initI18n(lang);
    setWikiLocale(root, lang);
    const defs = new Map([...LANDMARKS.filter((d) => !d.procedural), ...deepSkyLandmarks(json<DeepSkyData>(path.join(root, 'public/data/deepsky.json')), LANDMARKS)].map((d) => [d.id, d]));
    site.dsoDefs = new Map(dsoIds.map((id) => [id, defs.get(id)!]));
    const entries = azEntries(site);
    const search = searchJson(entries);
    fs.mkdirSync(path.join(opt.out, url('/encyclopedia', lang)), { recursive: true });
    fs.writeFileSync(path.join(opt.out, url(SEARCH_PATH, lang)), search);
    bytes += search.length;
    const list: Array<[string, () => Page]> = [
      ...hubPages(site).map((p) => ['hubs', () => p] as [string, () => Page]),
      ...azPages(entries).map((p) => ['hubs', () => p] as [string, () => Page]),
      ...lim(site.stars).map((s) => ['stars', () => starPage(s, site)] as [string, () => Page]),
      ...lim(site.planets).map((p) => ['exoplanets', () => planetPage(p, site)] as [string, () => Page]),
      ...[...site.constellations.values()].map((c) => ['constellations', () => constellationPage(c, site)] as [string, () => Page]),
      ...lim(site.dsos).map((d) => ['deep-sky', () => dsoPage(d, site)] as [string, () => Page]),
      ...lim(site.galaxies).map((g) => ['galaxies', () => galaxyPage(g, site)] as [string, () => Page]),
      ...site.blackHoles.map((b) => ['black-holes', () => blackHolePage(b, site)] as [string, () => Page]),
      ...site.solar.map((s) => ['solar-system', () => solarPage(s, site)] as [string, () => Page]),
      ...site.events.map((e) => ['sky-events', () => eventPage(e, site)] as [string, () => Page]),
    ];
    for (const [sec, make] of list) {
      const p = make();
      const html = render(p, buildId);
      writePage(opt.out, html, url(p.path, lang));
      pages++; bytes += html.length;
      if (!p.noindex) {
        const l = urls.get(sec) ?? [];
        l.push(SITE + url(p.path, lang));
        urls.set(sec, l);
      }
    }
    const fb = fallbackStarPage();
    writePage(opt.out, render(fb, buildId), url(fb.path, lang));
    console.log(`ssg: ${lang} done (${pages} pages so far)`);
  }
  sitemaps(opt.out, urls);
  // `?open=` key → page path, so the simulation's info panel can link a selection to its page
  const index: Record<string, string> = {};
  for (const s of lim(site.stars)) index[`star:c${s.i}`] = `/stars/${s.slug}`;
  for (const p of lim(site.planets)) index[`planet:c${p.host.i}/${p.planet.name}`] = `/exoplanets/${p.slug}`;
  for (const d of lim(site.dsos)) index[`landmark:${d.id}`] = `/deep-sky/${d.slug}`;
  for (const g of lim(site.galaxies)) index[`galaxy:${g.name}`] = `/galaxies/${g.slug}`;
  for (const b of site.blackHoles) index[`bh:${b.entry.id}`] = `/black-holes/${b.slug}`;
  for (const s of site.solar) index[`target:${s.body.id}`] = `/solar-system/${s.slug}`;
  fs.mkdirSync(path.join(opt.out, 'encyclopedia'), { recursive: true });
  fs.writeFileSync(path.join(opt.out, 'encyclopedia/index.json'), JSON.stringify(index));
  if (opt.out !== path.join(root, 'dist')) fs.cpSync(path.join(root, 'public/wiki'), path.join(opt.out, 'wiki'), { recursive: true });

  const counts = { stars: site.stars.length, exoplanets: site.planets.length, constellations: site.constellations.size, deepSky: site.dsos.length, galaxies: site.galaxies.length, blackHoles: site.blackHoles.length, solar: site.solar.length, events: site.events.length };
  console.log(`ssg: ${pages} pages, ${(bytes / 1e6).toFixed(0)} MB, ${((Date.now() - t0) / 1000).toFixed(1)} s`, counts);
  for (const [l, m] of missing) {
    console.log(`ssg: ${l}: ${m.size} untranslated template strings`, [...m].slice(0, 12));
  }
  const report = args.indexOf('--report');
  if (report >= 0) fs.writeFileSync(args[report + 1], JSON.stringify(Object.fromEntries([...missing].map(([l, m]) => [l, [...m]])), null, 2));
  if (opt.strict && missing.size) process.exit(1);
}
