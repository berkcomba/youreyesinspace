import { AU_KM, C_KM_S, G, PARSEC_KM } from '../../src/core/constants';
import { fixed, fmtNum } from '../../src/i18n';
import { schwarzschildKm } from '../../src/data/blackholes';
import { KIND_LABELS, STATUS_LABELS, type SkyEvent } from '../../src/data/events';
import { LANDMARK_KIND_LABEL } from '../../src/data/landmarks';
import type { BodyData } from '../../src/data/types';
import { GALAXY_TYPE_LABEL } from '../../src/galaxy/GalaxyModel';
import { typeLabel } from '../../src/ui/format';
import { CONSTELLATIONS, PC_LY, constellationAt, epochFor, fmtDec, fmtRa, midnightMonth, sceneToRaDec, visibility } from './astro';
import { a, appUrl, currentLang, esc, factTable, linkList, openButton, section, t, url, w, type Page } from './html';
import { tidyBayer } from './catalog';
import { AZ_PATH, searchForm } from './az';
import { dateLong, lat, ly, mag, monthName, pc, plain, sig, years } from './format';
import type { ConstellationEntry, DsoEntry, GalaxyEntry, PlanetEntry, Site, StarEntry } from './model';

const VOYAGER_KMS = 16.9;
const YEAR_S = 3.15576e7;
const EARTH_KG = 5.97237e24, EARTH_KM = 6371, JUP_KG = 1.89813e27, JUP_RE = 11.209;
const MW_DIAMETER_KPC = 26.8, MW_ABS_MAG = -20.9;

/* ------------------------------------------------------------------ shared */

export function conName(abbr: string): string {
  const c = CONSTELLATIONS[abbr];
  if (!c) return abbr;
  return currentLang() === 'tr' ? c[1] : c[0];
}

function conLink(site: Site, abbr: string): string {
  const c = site.constellations.get(abbr);
  return c ? a(url(`/constellations/${c.slug}`), conName(abbr)) : esc(conName(abbr));
}

function starHref(s: StarEntry): string { return url(`/stars/${s.slug}`); }

/** "seen from Earth" paragraph: latitudes and the month of the midnight culmination */
function skyParagraph(ra: number, dec: number, magnitude: number | null): string {
  const v = visibility(dec);
  const parts: string[] = [];
  if (magnitude !== null) {
    parts.push(magnitude <= 6.5 ? w('Karanlık bir gökyüzünde çıplak gözle görülebilir (görünür parlaklığı {m} kadir).', { m: mag(magnitude) })
      : magnitude <= 9 ? w('Çıplak gözle görülemeyecek kadar sönük ({m} kadir); bir dürbünle bulunabilir.', { m: mag(magnitude) })
        : w('Görmek için teleskop gerekir: görünür parlaklığı {m} kadir.', { m: mag(magnitude) }));
  }
  if (v.south <= -89.5) parts.push(w('Güney Yarımküre\'nin her yerinden ve kuzeyde {north} enlemine kadar görülebilir.', { north: lat(v.north) }));
  else if (v.north >= 89.5) parts.push(w('Kuzey Yarımküre\'nin her yerinden ve güneyde {south} enlemine kadar görülebilir.', { south: lat(v.south) }));
  else parts.push(w('{south} ile {north} enlemleri arasından görülebilir.', { south: lat(v.south), north: lat(v.north) }));
  if (v.circumpolar !== null && Math.abs(v.circumpolar) < 80) {
    parts.push(v.circumpolar > 0 ? w('{lat} enleminin kuzeyinde hiç batmaz.', { lat: lat(v.circumpolar) }) : w('{lat} enleminin güneyinde hiç batmaz.', { lat: lat(v.circumpolar) }));
  }
  if (Math.abs(dec) < 75) parts.push(w('Gece yarısı gökyüzünde en yüksek noktasına {month} ayında ulaşır; gözlem için en iyi dönem budur.', { month: monthName(midnightMonth(ra)) }));
  return `<p>${parts.map(esc).join(' ')}</p>`;
}

/** when the light seen tonight set out */
function lightParagraph(lightYears: number, buildYear: number): string {
  const parts: string[] = [];
  if (lightYears < 1) parts.push(w('Işığı bize birkaç ay içinde ulaşır.'));
  else if (lightYears < 4000) {
    const y = Math.round(buildYear - lightYears);
    parts.push(y > 0 ? w('Bu gece gördüğünüz ışık yaklaşık {year} yılında yola çıktı.', { year: y }) : w('Bu gece gördüğünüz ışık yaklaşık MÖ {year} yılında yola çıktı.', { year: -y + 1 }));
  } else {
    parts.push(w('Bu gece gördüğünüz ışık {ago} önce yola çıktı.', { ago: years(lightYears) }), w(epochFor(lightYears)));
  }
  const voyager = (lightYears / PC_LY) * PARSEC_KM / VOYAGER_KMS / YEAR_S;
  parts.push(w('Güneş Sistemi\'nden ayrılan en hızlı araç Voyager 1\'in hızıyla (saniyede 16,9 km) oraya varmak {t} sürerdi.', { t: years(voyager) }));
  return `<p>${parts.map(esc).join(' ')}</p>`;
}

function coordRows(ra: number, dec: number): Array<[string, string]> {
  return [[w('Sağ açıklık (J2000)'), fmtRa(ra)], [w('Dik açıklık (J2000)'), fmtDec(dec)]];
}

function thing(name: string, description: string, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return { '@context': 'https://schema.org', '@type': 'Thing', name, description, ...extra };
}

/* ------------------------------------------------------------------ stars */

const LUM_KIND: Record<number, string> = { 1: 'süperdev yıldız', 2: 'parlak dev yıldız', 3: 'dev yıldız', 4: 'alt dev yıldız', 5: 'anakol yıldızı' };

export function starPage(s: StarEntry, site: Site): Page {
  const cat = site.cat, i = s.i;
  const ph = cat.physics(i);
  const h = s.host;
  const names = cat.names.get(i);
  const temperature = h?.teff ?? ph.temperature;
  const radius = h?.rad ?? ph.radius;
  const mass = h?.mass ?? ph.mass;
  const luminosity = h?.lum !== undefined ? 10 ** h.lum : ph.luminosity;
  const spect = h?.spect || cat.catalogSpectral(i) || ph.spectral;
  const kind = ph.wd ? w('beyaz cüce') : w(LUM_KIND[ph.lumClass] ?? 'yıldız');
  const lyDist = s.dist * PC_LY;
  const buildYear = +site.buildDate.slice(0, 4);

  const lede = esc(w('{name}, {con} takımyıldızında, Güneş\'ten {dist} uzaklıkta, {spect} tayf türünde bir {kind}.', { name: s.name, con: conName(s.con), dist: ly(lyDist), spect, kind }))
    + (h ? ` ${esc(w('Çevresinde {n} doğrulanmış ötegezegen dolanır.', { n: h.planets.length }))}` : '');

  const others = [names?.proper, names?.bayer && tidyBayer(names.bayer), names?.host, names?.gliese, cat.hip[i] ? `HIP ${cat.hip[i]}` : '']
    .filter((x): x is string => !!x && x !== s.name);
  const speed = cat.speed(i);
  const measured = !!h?.teff;
  const facts = factTable([
    others.length ? [w('Diğer adlar'), esc([...new Set(others)].join(' · '))] : null,
    [w('Takımyıldız'), conLink(site, s.con)],
    [w('Uzaklık'), `${esc(ly(lyDist))} (${esc(pc(s.dist))})`],
    [w('Görünür parlaklık'), esc(w('{m} kadir', { m: mag(s.mag) }))],
    [w('Mutlak parlaklık'), esc(w('{m} kadir', { m: mag(ph.absMag) }))],
    [w('Tayf türü'), esc(spect)],
    [w('Yüzey sıcaklığı'), esc(`${fmtNum(Math.round(temperature / 10) * 10)} K`)],
    [w('Işıma gücü'), esc(`${sig(luminosity)} L☉`)],
    [w('Yarıçap'), esc(`${sig(radius)} R☉`)],
    [w('Kütle'), esc(`${sig(mass)} M☉${measured ? '' : ` (${w('tahmini')})`}`)],
    h?.age !== undefined ? [w('Yaş'), esc(w('{n} milyar yıl', { n: fixed(h.age, 1) }))] : null,
    h?.met !== undefined ? [w('Metallik [Fe/H]'), esc(fixed(h.met, 2))] : null,
    ...coordRows(s.ra, s.dec),
    speed !== null ? [w('Uzay hızı (Güneş\'e göre)'), esc(`${fixed(speed, 1)} km/s`)] : null,
  ]);

  // the Sun from there
  const p = cat.pos;
  const back = sceneToRaDec(-p[i * 3], -p[i * 3 + 1], -p[i * 3 + 2]);
  const sunMag = 4.83 + 5 * Math.log10(s.dist / 10);
  const sunCon = constellationAt(back.ra, back.dec);
  const fromThere = `<p>${esc(w('{name} çevresindeki bir gezegenden bakan biri Güneş\'i {m} kadirlik bir yıldız olarak görürdü; bizim gökyüzümüzde {con} takımyıldızının bulunduğu yönde.', { name: s.name, m: mag(sunMag), con: conName(sunCon) }))} ${esc(sunMag <= 6.5 ? w('Çıplak gözle görülebilirdi.') : w('Çıplak gözle görülemezdi.'))}</p>`;

  const planets = site.planetsByHost.get(i) ?? [];
  const planetList = linkList(planets.map((pl) => ({ href: url(`/exoplanets/${pl.slug}`), label: pl.planet.name, note: planetNote(pl) })));

  let neigh = '';
  if (s.dist <= 100) {
    const nb = cat.neighbours(i, 8, 20 / PC_LY);
    neigh = nb.length
      ? `<p>${esc(w('Katalogdaki en yakın komşuları (20 ışık yılı içinde):'))}</p>` + linkList(nb.map(({ j, d }) => {
        const e = site.starByIndex.get(j);
        return { href: j === 0 ? url('/solar-system/sun') : e ? starHref(e) : null, label: j === 0 ? t('Güneş') : cat.nameOf(j), note: ly(d * PC_LY) };
      }))
      : `<p>${esc(w('Katalogda 20 ışık yılı içinde başka yıldız yok.'))}</p>`;
  }

  const body = [
    facts,
    section(w('Gökyüzünde'), skyParagraph(s.ra, s.dec, s.mag)),
    section(w('Işığın yolculuğu'), lightParagraph(lyDist, buildYear)),
    section(w('Oradan bakınca Güneş'), fromThere),
    planets.length ? section(w('Gezegenleri'), planetList) : '',
    neigh ? section(w('Komşuları'), neigh) : '',
    openButton(appUrl({ open: `star:c${i}` })),
    `<p class="w-src">${esc(measured ? w('Yıldız parametreleri NASA Exoplanet Archive\'dan; konum ve parlaklık HYG / AT-HYG kataloğundan.') : w('Konum, parlaklık ve renk HYG / AT-HYG kataloğundan; sıcaklık, ışıma gücü, yarıçap ve kütle bu gözlemlerden hesaplanmış yaklaşık değerlerdir.'))}</p>`,
  ].join('\n');

  return {
    path: `/stars/${s.slug}`,
    title: w('{name} yıldızı: uzaklık, parlaklık ve gökyüzündeki yeri', { name: s.name }),
    description: plain(lede),
    h1: s.name,
    eyebrow: `${w('Yıldız')} · ${spect}`,
    lede,
    body,
    crumbs: [[w('Yıldızlar'), '/stars'], [conName(s.con), `/constellations/${site.constellations.get(s.con)?.slug ?? ''}`]],
    jsonld: [thing(s.name, plain(lede), { alternateName: others, url: `https://youreyesinspace.com${url(`/stars/${s.slug}`)}` })],
  };
}

/* ------------------------------------------------------------------ exoplanets */

function planetClass(R?: number, M?: number): string {
  if (R !== undefined) {
    if (R < 1.25) return 'Dünya boyutunda kayalık gezegen';
    if (R < 2) return 'süper-Dünya';
    if (R < 4) return 'mini-Neptün';
    if (R < 8) return 'Neptün benzeri gezegen';
    return 'gaz devi';
  }
  if (M !== undefined) {
    if (M < 2) return 'Dünya kütlesinde gezegen';
    if (M < 10) return 'süper-Dünya';
    if (M < 50) return 'Neptün benzeri gezegen';
    return 'gaz devi';
  }
  return 'ötegezegen';
}

function planetNote(pl: PlanetEntry): string {
  const p = pl.planet;
  const bits: string[] = [];
  if (p.P !== undefined) bits.push(w('{n} günlük yörünge', { n: sig(p.P) }));
  if (p.R !== undefined) bits.push(`${sig(p.R)} R⊕`);
  return bits.join(' · ');
}

/** stellar flux at the planet, Earth = 1 */
function insolation(pl: PlanetEntry): number | null {
  const p = pl.planet;
  if (p.S !== undefined) return p.S;
  if (p.a !== undefined && pl.host.lum !== undefined) return 10 ** pl.host.lum / (p.a * p.a);
  return null;
}

export function planetPage(pl: PlanetEntry, site: Site): Page {
  const p = pl.planet, h = pl.host;
  const hostName = pl.star?.name ?? h.name;
  const dist = h.dist ?? site.cat.dist(h.i);
  const cls = w(planetClass(p.R, p.M));
  const S = insolation(pl);
  const lede = esc(w('{name}, {host} yıldızının çevresinde dolanan bir {cls}.', { name: p.name, host: hostName, cls }))
    + (p.P !== undefined ? ` ${esc(w('Bir yılı {n} Dünya günü sürer.', { n: sig(p.P) }))}` : '')
    + (p.year ? ` ${esc(w('{year} yılında {method} yöntemiyle keşfedildi.', { year: p.year, method: t(p.method ?? '') }))}` : '');

  const msini = p.Mprov === 'Msini';
  const g = p.M !== undefined && p.R !== undefined && p.Mprov === 'Mass' ? p.M / (p.R * p.R) : null;
  const facts = factTable([
    [w('Yıldızı'), pl.star ? a(url(`/stars/${pl.star.slug}`), hostName) : esc(hostName)],
    [w('Uzaklık'), `${esc(ly(dist * PC_LY))} (${esc(pc(dist))})`],
    p.P !== undefined ? [w('Yörünge periyodu'), esc(p.P < 2 ? w('{n} saat', { n: sig(p.P * 24) }) : p.P > 730 ? w('{n} yıl', { n: sig(p.P / 365.25) }) : w('{n} gün', { n: sig(p.P) }))] : null,
    p.a !== undefined ? [w('Yörünge yarıçapı'), esc(`${sig(p.a)} AU`)] : null,
    p.e !== undefined ? [w('Dış merkezlik'), esc(fixed(p.e, 3))] : null,
    p.R !== undefined ? [w('Yarıçap'), esc(`${sig(p.R)} R⊕ · ${sig(p.R / JUP_RE)} R♃`)] : null,
    p.M !== undefined ? [w(msini ? 'Kütle (en az)' : 'Kütle'), esc(`${sig(p.M)} M⊕ · ${sig(p.M * EARTH_KG / JUP_KG)} M♃${p.Mprov === 'M-R relationship' ? ` (${w('yarıçaptan tahmini')})` : ''}`)] : null,
    p.rho !== undefined ? [w('Yoğunluk'), esc(`${sig(p.rho)} g/cm³`)] : null,
    g !== null ? [w('Yüzey çekimi'), esc(w('Dünya\'nın {n} katı', { n: sig(g) }))] : null,
    p.Teq !== undefined ? [w('Denge sıcaklığı'), esc(`${fmtNum(Math.round(p.Teq))} K (${fmtNum(Math.round(p.Teq - 273.15))} °C)`)] : null,
    S !== null ? [w('Aldığı ışınım'), esc(w('Dünya\'nın {n} katı', { n: sig(S) }))] : null,
    p.method ? [w('Keşif yöntemi'), esc(t(p.method))] : null,
    p.year ? [w('Keşif yılı'), esc(String(p.year))] : null,
    p.facility ? [w('Keşfeden'), esc(p.facility)] : null,
  ]);

  // habitable zone (Kopparapu et al. 2013): conservative 0.36–1.07 S⊕, optimistic 0.32–1.78 S⊕
  let hz = '';
  if (S !== null) {
    hz = S >= 0.36 && S <= 1.07 ? w('Yıldızının yaşanabilir bölgesinin içinde: yüzeyinde, uygun bir atmosferle sıvı su bulunabilecek kadar ışık alıyor.')
      : S >= 0.32 && S <= 1.78 ? w('Yaşanabilir bölgenin kenarında (iyimser sınırlar içinde): sıvı su ancak elverişli bir atmosferle mümkün olabilir.')
        : S > 1.78 ? w('Yaşanabilir bölgenin iç tarafında: Dünya\'nın {n} katı ışık alıyor; yüzeyinde sıvı su tutamayacak kadar sıcak.', { n: sig(S) })
          : w('Yaşanabilir bölgenin dışında: Dünya\'nın aldığı ışığın yalnızca {pct}\'i kadarını alıyor; donmuş bir dünya.', { pct: `%${sig(S * 100, 2)}` });
    hz = `<p>${esc(hz)}</p>`;
  }

  // the star in its sky
  let sky = '';
  if (p.a !== undefined && h.rad !== undefined) {
    const angDeg = 2 * Math.atan((h.rad * 695_700) / (p.a * AU_KM)) * 180 / Math.PI;
    const ratio = angDeg / 0.533;
    sky = `<p>${esc(w('Gezegenin gökyüzünde yıldızı {deg}° genişliğinde bir disk olarak görünür: Dünya\'dan gördüğümüz Güneş\'in {x} katı.', { deg: sig(angDeg, 2), x: sig(ratio, 2) }))}</p>`;
  }

  const siblings = (site.planetsByHost.get(h.i) ?? []).filter((x) => x !== pl);
  const body = [
    facts,
    hz ? section(w('Yaşanabilir bölge'), hz) : '',
    sky ? section(w('Gökyüzünde yıldızı'), sky) : '',
    section(w('Işığın yolculuğu'), lightParagraph(dist * PC_LY, +site.buildDate.slice(0, 4))),
    siblings.length ? section(w('Aynı sistemdeki gezegenler'), linkList(siblings.map((x) => ({ href: url(`/exoplanets/${x.slug}`), label: x.planet.name, note: planetNote(x) })))) : '',
    openButton(appUrl({ open: `planet:c${h.i}/${p.name}` })),
    `<p class="w-src">${esc(w('Veriler: {src}. Simülasyondaki görünüm ölçülen yarıçap, kütle ve sıcaklığa dayanan bir temsildir.', { src: site.exoSource }))}</p>`,
  ].join('\n');

  return {
    path: `/exoplanets/${pl.slug}`,
    title: w('{name}: {host} yıldızının ötegezegeni', { name: p.name, host: hostName }),
    description: plain(lede),
    h1: p.name,
    eyebrow: `${w('Ötegezegen')} · ${cls}`,
    lede,
    body,
    crumbs: [[w('Ötegezegenler'), '/exoplanets'], ...(pl.star ? [[hostName, `/stars/${pl.star.slug}`] as [string, string]] : [])],
    jsonld: [thing(p.name, plain(lede))],
  };
}

/* ------------------------------------------------------------------ constellations */

export function constellationPage(c: ConstellationEntry, site: Site): Page {
  const [latin, tr] = CONSTELLATIONS[c.abbr];
  const name = conName(c.abbr);
  const byMag = [...c.stars].sort((x, y) => x.mag - y.mag);
  const brightest = byMag[0];
  // circular mean of the member positions
  let sx = 0, sy = 0, sd = 0;
  for (const s of c.stars) { sx += Math.cos(s.ra * Math.PI / 180); sy += Math.sin(s.ra * Math.PI / 180); sd += s.dec; }
  const ra = ((Math.atan2(sy, sx) * 180 / Math.PI) + 360) % 360;
  const dec = c.stars.length ? sd / c.stars.length : 0;
  const lede = esc(w('{name} ({abbr}), Uluslararası Astronomi Birliği\'nin tanıdığı 88 takımyıldızdan biri.', { name: currentLang() === 'tr' ? `${tr} (${latin})` : latin, abbr: c.abbr }))
    + (brightest ? ` ${esc(w('En parlak yıldızı {star} ({m} kadir).', { star: brightest.name, m: mag(brightest.mag) }))}` : '');
  const hosts = c.stars.filter((s) => s.host);
  const body = [
    factTable([
      [w('Latince adı'), esc(latin)],
      [w('Kısaltma'), esc(c.abbr)],
      brightest ? [w('En parlak yıldız'), a(starHref(brightest), brightest.name)] : null,
      [w('Bu ansiklopedideki yıldızlar'), esc(fmtNum(c.stars.length))],
      [w('Ötegezegenli yıldızlar'), esc(fmtNum(hosts.length))],
      [w('Derin gökyüzü cisimleri'), esc(fmtNum(c.dsos.length))],
      [w('Galaksiler'), esc(fmtNum(c.galaxies.length))],
    ]),
    section(w('Gökyüzünde'), skyParagraph(ra, dec, null)),
    section(w('En parlak yıldızları'), linkList(byMag.slice(0, 25).map((s) => ({ href: starHref(s), label: s.name, note: `${mag(s.mag)} · ${ly(s.dist * PC_LY)}` })))),
    hosts.length ? section(w('Ötegezegenli yıldızları'), linkList(hosts.map((s) => ({ href: starHref(s), label: s.name, note: w('{n} gezegen', { n: s.host!.planets.length }) })), 'w-list w-cols')) : '',
    c.dsos.length ? section(w('Derin gökyüzü cisimleri'), linkList(c.dsos.map((d) => {
      const def = site.dsoDefs.get(d.id)!;
      return { href: url(`/deep-sky/${d.slug}`), label: t(def.name), note: t(LANDMARK_KIND_LABEL[def.kind]).split(' /')[0] };
    }), 'w-list w-cols')) : '',
    c.galaxies.length ? section(w('Galaksiler'), linkList(c.galaxies.map((g) => ({ href: url(`/galaxies/${g.slug}`), label: t(g.name), note: ly(g.distMpc * 1e6 * PC_LY) })), 'w-list w-cols')) : '',
    byMag.length > 25 ? section(w('Diğer yıldızları'), linkList(byMag.slice(25).map((s) => ({ href: starHref(s), label: s.name })), 'w-list w-cols')) : '',
  ].join('\n');
  return {
    path: `/constellations/${c.slug}`,
    title: w('{name} takımyıldızı: yıldızları, gezegenleri ve derin gökyüzü cisimleri', { name }),
    description: plain(lede),
    h1: currentLang() === 'tr' ? tr : latin,
    eyebrow: currentLang() === 'tr' ? `${w('Takımyıldız')} · ${latin}` : w('Takımyıldız'),
    lede,
    body,
    crumbs: [[w('Takımyıldızlar'), '/constellations']],
    jsonld: [thing(latin, plain(lede), { alternateName: [tr, c.abbr] })],
  };
}

/* ------------------------------------------------------------------ deep sky */

export function dsoPage(d: DsoEntry, site: Site): Page {
  const def = site.dsoDefs.get(d.id)!;
  const name = t(def.name);
  const kind = t(LANDMARK_KIND_LABEL[def.kind]).split(' /')[0];
  const lede = esc(t(def.summary));
  const factRows: Array<[string, string] | null> = Object.entries(def.facts).map(([k, v]) => [t(k), esc(t(v))]);
  const hostGalaxy = def.galaxy ? site.galaxies.find((g) => g.name.includes(def.galaxy!) || t(g.name).includes(def.galaxy!)) : undefined;
  const body = [
    def.description ? `<p>${esc(t(def.description))}</p>` : '',
    factTable([
      [w('Tür'), esc(kind)],
      [w('Takımyıldız'), conLink(site, d.con)],
      hostGalaxy ? [w('Bulunduğu galaksi'), a(url(`/galaxies/${hostGalaxy.slug}`), t(hostGalaxy.name))] : null,
      def.distancePc !== undefined && !Object.keys(def.facts).some((k) => k === 'Uzaklık') ? [w('Uzaklık'), `${esc(ly(def.distancePc * PC_LY))} (${esc(pc(def.distancePc))})`] : null,
      ...factRows,
      ...coordRows(def.ra, def.dec),
    ]),
    section(w('Gökyüzünde'), skyParagraph(def.ra, def.dec, null)),
    def.distancePc !== undefined ? section(w('Işığın yolculuğu'), lightParagraph(def.distancePc * PC_LY, +site.buildDate.slice(0, 4))) : '',
    openButton(appUrl({ open: `landmark:${def.id}` })),
  ].join('\n');
  return {
    path: `/deep-sky/${d.slug}`,
    title: w('{name}: {kind}', { name, kind }),
    description: plain(`${t(def.summary)}. ${t(def.description)}`),
    h1: name,
    eyebrow: kind,
    lede,
    body,
    crumbs: [[w('Derin gökyüzü'), '/deep-sky'], [conName(d.con), `/constellations/${site.constellations.get(d.con)?.slug ?? ''}`]],
    jsonld: [thing(name, plain(t(def.description) || t(def.summary)))],
  };
}

/* ------------------------------------------------------------------ galaxies */

export function galaxyPage(g: GalaxyEntry, site: Site): Page {
  const name = t(g.name);
  const type = t(GALAXY_TYPE_LABEL[g.type]);
  const dPc = g.distMpc * 1e6;
  const lyDist = dPc * PC_LY;
  const appMag = g.absMag + 5 * Math.log10(dPc / 10);
  const lede = esc(w('{name}, {con} takımyıldızı yönünde, {dist} uzaklıkta bir galaksi.', { name, con: conName(g.con), dist: ly(lyDist) }))
    + (g.desc ? ` ${esc(t(g.desc))}` : '');
  const lum = 10 ** (-0.4 * (g.absMag - MW_ABS_MAG));
  const body = [
    factTable([
      [w('Tür'), esc(type + (g.typeGuessed ? ` (${w('tahmini')})` : ''))],
      [w('Takımyıldız'), conLink(site, g.con)],
      [w('Uzaklık'), `${esc(ly(lyDist))} (${esc(pc(dPc))})`],
      g.diameterKpc > 0 ? [w('Çap'), esc(`${ly(g.diameterKpc * 1000 * PC_LY)} · ${w('Samanyolu\'nun {n} katı', { n: sig(g.diameterKpc / MW_DIAMETER_KPC, 2) })}`)] : null,
      [w('Mutlak parlaklık'), esc(w('{m} kadir', { m: mag(g.absMag) }))],
      [w('Görünür parlaklık'), esc(w('{m} kadir', { m: mag(appMag) }))],
      [w('Işıma gücü'), esc(w('Samanyolu\'nun {n} katı', { n: sig(lum, 2) }))],
      ...coordRows(g.ra, g.dec),
      [w('Kaynak'), esc(g.source === 'curated' ? w('Derlenmiş katalog (NED, yaklaşık değerler)') : g.source === 'ungc' ? 'Updated Nearby Galaxy Catalog (Karachentsev et al. 2013)' : '2MASS Redshift Survey (Huchra et al. 2012)')],
    ]),
    section(w('Gökyüzünde'), skyParagraph(g.ra, g.dec, appMag)),
    section(w('Işığın yolculuğu'), lightParagraph(lyDist, +site.buildDate.slice(0, 4))),
    openButton(appUrl({ open: `galaxy:${g.name}` })),
  ].join('\n');
  return {
    path: `/galaxies/${g.slug}`,
    title: w('{name} galaksisi: uzaklık, tür ve boyut', { name }),
    description: plain(lede),
    h1: name,
    eyebrow: `${w('Galaksi')} · ${type}`,
    lede,
    body,
    crumbs: [[w('Galaksiler'), '/galaxies']],
    jsonld: [thing(name, plain(lede))],
  };
}

/* ------------------------------------------------------------------ black holes */

export function blackHolePage(entry: Site['blackHoles'][number], site: Site): Page {
  const e = entry.entry;
  const bh = e.bodies?.().find((b) => b.type === 'blackhole') ?? e.companionBody?.('host', 2e31);
  const rs = schwarzschildKm(e.massSolar);
  const lede = esc(t(e.summary));
  const scale = rs < 1e6 ? w('{km} km: bir şehir büyüklüğünde', { km: fmtNum(Math.round(rs)) })
    : rs < AU_KM * 0.5 ? w('{n} milyon km: Güneş\'in yarıçapının {x} katı', { n: sig(rs / 1e6), x: sig(rs / 695_700, 2) })
      : w('{n} AU: Neptün yörüngesinin {x} katı', { n: sig(rs / AU_KM, 3), x: sig(rs / AU_KM / 30.07, 2) });
  const crossing = (2 * Math.PI * rs) / C_KM_S;
  const body = [
    bh?.description ? `<p>${esc(t(bh.description))}</p>` : '',
    factTable([
      [w('Kütle'), esc(e.massSolar >= 1e6 ? w('{n} milyon güneş kütlesi', { n: sig(e.massSolar / 1e6) }) : w('{n} güneş kütlesi', { n: sig(e.massSolar) }))],
      [w('Olay ufku yarıçapı'), esc(scale)],
      [w('Işığın olay ufkunu bir kez dolanması'), esc(crossing < 120 ? w('{n} saniye', { n: sig(crossing, 2) }) : crossing < 7200 ? w('{n} dakika', { n: sig(crossing / 60, 2) }) : w('{n} saat', { n: sig(crossing / 3600, 2) }))],
      ...Object.entries(bh?.facts ?? {}).map(([k, v]) => [t(k), esc(t(v))] as [string, string]),
      bh?.discovered ? [w('Keşif'), esc(t(bh.discovered))] : null,
    ]),
    `<p>${esc(w('Olay ufku, kaçış hızının ışık hızına eşit olduğu sınırdır: içeriden hiçbir şey, ışık bile dışarı çıkamaz. Yarıçapı kütleyle doğru orantılıdır (Schwarzschild yarıçapı, dönmeyen bir kara delik için).'))}</p>`,
    openButton(appUrl({ open: `bh:${e.id}` })),
  ].join('\n');
  return {
    path: `/black-holes/${entry.slug}`,
    title: w('{name} kara deliği', { name: e.name }),
    description: plain(`${t(e.summary)}. ${bh?.description ? t(bh.description) : ''}`),
    h1: e.name,
    eyebrow: w('Kara delik'),
    lede,
    body,
    crumbs: [[w('Kara delikler'), '/black-holes']],
    jsonld: [thing(e.name, plain(t(e.summary)))],
  };
}

/* ------------------------------------------------------------------ solar system */

function rotation(b: BodyData): string | null {
  const r = b.rotationPeriod;
  if (r === undefined) return null;
  if (r === 'sync') return w('Kütleçekimsel kilitli (hep aynı yüzü döner)');
  const h = Math.abs(r);
  const s = h < 48 ? w('{n} saat', { n: sig(h) }) : w('{n} gün', { n: sig(h / 24) });
  return r < 0 ? `${s} (${w('ters yönde')})` : s;
}

export function solarPage(entry: Site['solar'][number], site: Site): Page {
  const b = entry.body;
  const name = t(b.name);
  const parent = b.parent ? site.solarById.get(b.parent) : undefined;
  const craft = b.type === 'spacecraft';
  const r = b.radius, m = b.mass;
  const gSurf = (G * m) / (r * 1000) ** 2;
  const vEsc = Math.sqrt((2 * G * m) / (r * 1000)) / 1000;
  const rho = m / ((4 / 3) * Math.PI * (r * 1e5) ** 3) * 1000;
  const o = b.orbit;
  const orbitRows: Array<[string, string] | null> = [];
  if (o?.kind === 'jpl') {
    orbitRows.push([w('Güneş\'e ortalama uzaklık'), esc(`${sig(o.a)} AU (${w('{n} milyon km', { n: fmtNum(Math.round(o.a * AU_KM / 1e6)) })})`)]);
    orbitRows.push([w('Dış merkezlik'), esc(fixed(o.e, 3))]);
    orbitRows.push([w('Yörünge periyodu'), esc(o.a ** 1.5 < 2 ? w('{n} gün', { n: sig(o.a ** 1.5 * 365.25) }) : w('{n} yıl', { n: sig(o.a ** 1.5) }))]);
  } else if (o?.kind === 'simple') {
    const around = parent ? t(parent.body.name) : '';
    orbitRows.push([w('Yörünge yarıçapı'), esc(o.a > AU_KM * 0.1 ? `${sig(o.a / AU_KM)} AU` : `${fmtNum(Math.round(o.a))} km`) + (around ? ` (${esc(around)})` : '')]);
    if (o.e) orbitRows.push([w('Dış merkezlik'), esc(fixed(o.e, 3))]);
    orbitRows.push([w('Yörünge periyodu'), esc(o.period < 2 ? w('{n} saat', { n: sig(o.period * 24) }) : o.period > 730 ? w('{n} yıl', { n: sig(o.period / 365.25) }) : w('{n} gün', { n: sig(o.period) }))]);
  }
  const facts = factTable([
    [w('Tür'), esc(typeLabel(b.type))],
    parent ? [w('Bağlı olduğu cisim'), a(url(`/solar-system/${parent.slug}`), t(parent.body.name))] : null,
    !craft && r > 0 ? [w('Yarıçap'), esc(`${fmtNum(Math.round(r))} km · ${sig(r / EARTH_KM)} R⊕`)] : null,
    !craft && m > 0 ? [w('Kütle'), esc(`${sig(m, 4)} kg · ${sig(m / EARTH_KG)} M⊕`)] : null,
    !craft && m > 0 && r > 0 ? [w('Ortalama yoğunluk'), esc(`${sig(rho)} g/cm³`)] : null,
    !craft && m > 1e19 && r > 0 ? [w('Yüzey çekimi'), esc(`${sig(gSurf)} m/s² · ${w('Dünya\'nın {n} katı', { n: sig(gSurf / 9.81, 2) })}`)] : null,
    !craft && m > 1e19 && r > 0 ? [w('Kaçış hızı'), esc(`${sig(vEsc)} km/s`)] : null,
    !craft ? (rotation(b) ? [w('Dönme periyodu'), esc(rotation(b)!)] : null) : null,
    ...orbitRows,
    b.temperature ? [w('Sıcaklık'), esc(`${fmtNum(Math.round(b.temperature))} K (${fmtNum(Math.round(b.temperature - 273.15))} °C)`)] : null,
    ...Object.entries(b.facts ?? {}).map(([k, v]) => [t(k), esc(t(v))] as [string, string]),
    b.discovered ? [w('Keşif'), esc(t(b.discovered))] : null,
  ]);
  const children = site.solar.filter((s) => s.body.parent === b.id && s.body.type !== 'barycenter');
  const lede = b.description ? esc(t(b.description)) : esc(typeLabel(b.type));
  const body = [
    facts,
    children.length ? section(b.type === 'star' ? w('Çevresinde dolananlar') : w('Uyduları ve çevresindekiler'), linkList(children.map((c) => ({ href: url(`/solar-system/${c.slug}`), label: t(c.body.name), note: typeLabel(c.body.type) })), 'w-list w-cols')) : '',
    openButton(appUrl({ target: b.id })),
  ].join('\n');
  return {
    path: `/solar-system/${entry.slug}`,
    title: craft ? w('{name} uzay aracı', { name }) : w('{name}: {type}', { name, type: typeLabel(b.type) }),
    description: plain(lede),
    h1: name,
    eyebrow: typeLabel(b.type),
    lede,
    body,
    crumbs: [[w('Güneş Sistemi'), '/solar-system'], ...(parent && parent.body.type !== 'star' ? [[t(parent.body.name), `/solar-system/${parent.slug}`] as [string, string]] : [])],
    jsonld: [thing(name, plain(lede))],
  };
}

/* ------------------------------------------------------------------ events */

export function eventPage(entry: Site['events'][number], site: Site): Page {
  const e: SkyEvent = entry.e;
  const title = t(e.title);
  const lede = esc(t(e.kicker));
  const bodies = e.bodies.map((id) => site.solarById.get(id)).filter((x): x is NonNullable<typeof x> => !!x);
  const body = [
    `<p>${esc(t(e.summary))}</p>`,
    factTable([
      [w('Tür'), esc(t(KIND_LABELS[e.kind]))],
      [w('Tarih'), esc(dateLong(e.time, true))],
      e.window ? [w('Görülebilir dönem'), esc(`${dateLong(e.window[0])} – ${dateLong(e.window[1])}`)] : null,
      [w('Durum'), esc(t(STATUS_LABELS[e.status]))],
      ...e.facts.map(([k, v]) => [t(k), esc(t(v))] as [string, string]),
      bodies.length ? [w('İlgili cisimler'), bodies.map((x) => a(url(`/solar-system/${x.slug}`), t(x.body.name))).join(', ')] : null,
      [w('Kaynak'), `<a href="${esc(e.source.url)}" rel="noopener">${esc(e.source.name)}</a>`],
    ]),
    openButton(appUrl({ event: e.id }), w('Simülasyonda izle')),
  ].join('\n');
  return {
    path: `/sky-events/${entry.slug}`,
    title: `${title} · ${dateLong(e.time)}`,
    description: plain(`${t(e.kicker)} ${t(e.summary)}`),
    h1: title,
    eyebrow: `${t(KIND_LABELS[e.kind])} · ${dateLong(e.time)}`,
    lede,
    body,
    crumbs: [[w('Gök olayları'), '/sky-events']],
    jsonld: [{
      '@context': 'https://schema.org', '@type': 'Event', name: title, description: plain(t(e.summary)),
      startDate: e.window?.[0] ?? e.time, endDate: e.window?.[1] ?? e.time,
      eventAttendanceMode: 'https://schema.org/OnlineEventAttendanceMode', eventStatus: 'https://schema.org/EventScheduled',
      location: { '@type': 'VirtualLocation', url: `https://youreyesinspace.com${appUrl({ event: e.id })}` },
      image: 'https://youreyesinspace.com/og-image.jpg',
      organizer: { '@type': 'Organization', name: 'Your Eyes In Space', url: 'https://youreyesinspace.com' },
    }],
  };
}

/* ------------------------------------------------------------------ hubs */

function hub(p: Omit<Page, 'eyebrow'>): Page { return { ...p }; }

export function hubPages(site: Site): Page[] {
  const out: Page[] = [];
  const named = site.stars.filter((s) => site.cat.names.get(s.i)?.proper);
  const brightest = [...site.stars].sort((x, y) => x.mag - y.mag).slice(0, 60);
  const nearest = [...site.stars].sort((x, y) => x.dist - y.dist).slice(0, 60);
  const cons = [...site.constellations.values()].sort((x, y) => conName(x.abbr).localeCompare(conName(y.abbr), currentLang()));
  const conList = linkList(cons.map((c) => ({ href: url(`/constellations/${c.slug}`), label: conName(c.abbr), note: currentLang() === 'tr' ? CONSTELLATIONS[c.abbr][0] : undefined })), 'w-list w-cols');

  const lede = esc(w('Simülasyonun kullandığı gerçek kataloglardan derlenmiş bir gökyüzü ansiklopedisi: her sayfadaki uzaklık, parlaklık ve yörünge değerleri ölçümlerden hesaplanır ve tek tıkla 3B simülasyonda açılır.'));
  out.push(hub({
    path: '/encyclopedia', title: w('Gökyüzü ansiklopedisi: yıldızlar, ötegezegenler, takımyıldızlar ve galaksiler'), description: plain(lede),
    h1: w('Gökyüzü ansiklopedisi'), lede, crumbs: [],
    body: searchForm(false) + `<ol class="w-index">${([
      [AZ_PATH, w('A\'dan Z\'ye tüm maddeler'), site.stars.length + site.planets.length + site.constellations.size + site.solar.length + site.dsos.length + site.galaxies.length + site.blackHoles.length + site.events.length],
      ['/stars', w('Yıldızlar'), site.stars.length],
      ['/exoplanets', w('Ötegezegenler'), site.planets.length],
      ['/constellations', w('Takımyıldızlar'), site.constellations.size],
      ['/solar-system', w('Güneş Sistemi'), site.solar.length],
      ['/deep-sky', w('Derin gökyüzü'), site.dsos.length],
      ['/galaxies', w('Galaksiler'), site.galaxies.length],
      ['/black-holes', w('Kara delikler'), site.blackHoles.length],
      ['/sky-events', w('Gök olayları'), site.events.length],
    ] as Array<[string, string, number]>).map(([p, label, n]) => `<li>${a(url(p), label)}<span>${esc(fmtNum(n))}</span></li>`).join('')}</ol>`
      + section(w('Takımyıldızlar'), conList),
  }));

  const sLede = esc(w('Gökyüzünün en parlak ve en yakın yıldızları, adı olan {n} yıldız ve ötegezegen barındıran yıldızlar; takımyıldızlarına göre.', { n: fmtNum(named.length) }));
  out.push(hub({
    path: '/stars', title: w('Yıldızlar: en parlak ve en yakın yıldızlar'), description: plain(sLede), h1: w('Yıldızlar'), lede: sLede,
    crumbs: [],
    body: [
      section(w('En parlak yıldızlar'), linkList(brightest.map((s) => ({ href: starHref(s), label: s.name, note: `${mag(s.mag)} · ${conName(s.con)}` })), 'w-list w-cols')),
      section(w('En yakın yıldızlar'), linkList(nearest.map((s) => ({ href: starHref(s), label: s.name, note: ly(s.dist * PC_LY) })), 'w-list w-cols')),
      section(w('Takımyıldızlarına göre'), conList),
    ].join('\n'),
  }));

  const hz = site.planets.filter((pl) => { const S = insolation(pl); return S !== null && S >= 0.32 && S <= 1.78; }).sort((x, y) => (x.host.dist ?? 1e9) - (y.host.dist ?? 1e9));
  const nearPl = [...site.planets].sort((x, y) => (x.host.dist ?? 1e9) - (y.host.dist ?? 1e9)).slice(0, 80);
  const pLede = esc(w('NASA Exoplanet Archive\'daki {n} doğrulanmış ötegezegen: yörüngeleri, boyutları, sıcaklıkları ve yaşanabilir bölgeye göre konumları.', { n: fmtNum(site.planets.length) }));
  const byYear: Record<number, number> = {};
  for (const pl of site.planets) if (pl.planet.year) byYear[pl.planet.year] = (byYear[pl.planet.year] ?? 0) + 1;
  out.push(hub({
    path: '/exoplanets', title: w('Ötegezegenler: en yakın ve yaşanabilir bölgedeki gezegenler'), description: plain(pLede), h1: w('Ötegezegenler'), lede: pLede,
    crumbs: [],
    body: [
      section(w('Yaşanabilir bölgedeki ötegezegenler'), linkList(hz.map((pl) => ({ href: url(`/exoplanets/${pl.slug}`), label: pl.planet.name, note: ly((pl.host.dist ?? 0) * PC_LY) })), 'w-list w-cols')),
      section(w('En yakın ötegezegenler'), linkList(nearPl.map((pl) => ({ href: url(`/exoplanets/${pl.slug}`), label: pl.planet.name, note: ly((pl.host.dist ?? 0) * PC_LY) })), 'w-list w-cols')),
      section(w('Yıllara göre keşifler'), factTable(Object.entries(byYear).sort((x, y) => +y[0] - +x[0]).map(([y, n]) => [y, esc(fmtNum(n))]))),
    ].join('\n'),
  }));

  const cLede = esc(w('Gökyüzünü bölen 88 resmî takımyıldız: her birinin yıldızları, ötegezegenleri, bulutsuları, kümeleri ve galaksileri.'));
  out.push(hub({ path: '/constellations', title: w('88 takımyıldız: yıldızları ve derin gökyüzü cisimleri'), description: plain(cLede), h1: w('Takımyıldızlar'), lede: cLede, crumbs: [], body: conList }));

  const groups: Array<[string, Array<Site['solar'][number]>]> = [
    [w('Güneş ve gezegenler'), site.solar.filter((s) => s.body.type === 'star' || s.body.type === 'planet')],
    [w('Cüce gezegenler'), site.solar.filter((s) => s.body.type === 'dwarf')],
    [w('Uydular'), site.solar.filter((s) => s.body.type === 'moon')],
    [w('Asteroitler ve kuyruklu yıldızlar'), site.solar.filter((s) => s.body.type === 'asteroid' || s.body.type === 'comet')],
    [w('Uzay araçları'), site.solar.filter((s) => s.body.type === 'spacecraft')],
  ];
  const ssLede = esc(w('Güneş, gezegenler, uydular, cüce gezegenler, kuyruklu yıldızlar ve uzay araçları: NASA/JPL yörünge verileriyle.'));
  out.push(hub({
    path: '/solar-system', title: w('Güneş Sistemi: gezegenler, uydular ve uzay araçları'), description: plain(ssLede), h1: w('Güneş Sistemi'), lede: ssLede, crumbs: [],
    body: groups.filter(([, l]) => l.length).map(([g, l]) => section(g, linkList(l.map((s) => ({ href: url(`/solar-system/${s.slug}`), label: t(s.body.name) })), 'w-list w-cols'))).join('\n'),
  }));

  const hand = site.dsos.filter((d) => d.handMade);
  const kinds = new Map<string, DsoEntry[]>();
  for (const d of site.dsos) {
    const k = site.dsoDefs.get(d.id)!.kind;
    const list = kinds.get(k) ?? [];
    list.push(d);
    kinds.set(k, list);
  }
  const dLede = esc(w('Bulutsular, yıldız kümeleri, süpernova kalıntıları, gezegenimsi bulutsular ve pulsarlar: {n} cisim.', { n: fmtNum(site.dsos.length) }));
  out.push(hub({
    path: '/deep-sky', title: w('Derin gökyüzü: bulutsular, yıldız kümeleri ve pulsarlar'), description: plain(dLede), h1: w('Derin gökyüzü'), lede: dLede, crumbs: [],
    body: [
      section(w('Öne çıkanlar'), linkList(hand.map((d) => ({ href: url(`/deep-sky/${d.slug}`), label: t(site.dsoDefs.get(d.id)!.name), note: t(LANDMARK_KIND_LABEL[site.dsoDefs.get(d.id)!.kind]).split(' /')[0] })), 'w-list w-cols')),
      section(w('Türlerine göre'), factTable([...kinds.entries()].map(([k, l]) => [t(LANDMARK_KIND_LABEL[k as keyof typeof LANDMARK_KIND_LABEL]).split(' /')[0], esc(fmtNum(l.length))]))),
      `<p>${esc(w('Tüm cisimler takımyıldız sayfalarında listelenir.'))}</p>`,
      section(w('Takımyıldızlar'), conList),
    ].join('\n'),
  }));

  const curated = site.galaxies.filter((g) => g.source === 'curated');
  const nearG = site.galaxies.filter((g) => g.source !== 'curated').sort((x, y) => x.distMpc - y.distMpc).slice(0, 120);
  const gLede = esc(w('Yerel Grup\'tan Başak Kümesi\'ne gerçek galaksiler: {n} galaksi, uzaklıkları, türleri ve boyutlarıyla.', { n: fmtNum(site.galaxies.length) }));
  out.push(hub({
    path: '/galaxies', title: w('Galaksiler: Andromeda\'dan Başak Kümesi\'ne'), description: plain(gLede), h1: w('Galaksiler'), lede: gLede, crumbs: [],
    body: [
      section(w('Öne çıkanlar'), linkList(curated.map((g) => ({ href: url(`/galaxies/${g.slug}`), label: t(g.name), note: ly(g.distMpc * 1e6 * PC_LY) })), 'w-list w-cols')),
      section(w('En yakın galaksiler'), linkList(nearG.map((g) => ({ href: url(`/galaxies/${g.slug}`), label: t(g.name), note: ly(g.distMpc * 1e6 * PC_LY) })), 'w-list w-cols')),
    ].join('\n'),
  }));

  const bLede = esc(w('Samanyolu\'nun merkezindeki Sagittarius A*\'dan ilk görüntülenen M87*\'ya, X-ışını çiftlerinden süper kütleli devlere: kütleleri ve olay ufuklarıyla bilinen kara delikler.'));
  out.push(hub({
    path: '/black-holes', title: w('Kara delikler: Sagittarius A*, M87* ve diğerleri'), description: plain(bLede), h1: w('Kara delikler'), lede: bLede, crumbs: [],
    body: linkList(site.blackHoles.map((b) => ({ href: url(`/black-holes/${b.slug}`), label: b.entry.name, note: t(b.entry.summary) }))),
  }));

  const now = site.buildDate;
  const upcoming = site.events.filter((x) => x.e.time >= now), past = site.events.filter((x) => x.e.time < now).reverse();
  const eLede = esc(w('Yaklaşan gök ve uzay olayları: meteor yağmurları, kavuşumlar, tutulmalar ve uzay araçlarının kritik anları; her biri simülasyonda izlenebilir.'));
  const evList = (l: typeof site.events) => linkList(l.map((x) => ({ href: url(`/sky-events/${x.slug}`), label: t(x.e.title), note: dateLong(x.e.time) })));
  out.push(hub({
    path: '/sky-events', title: w('Gök olayları takvimi: meteor yağmurları, tutulmalar, kavuşumlar'), description: plain(eLede), h1: w('Gök olayları'), lede: eLede, crumbs: [],
    body: [upcoming.length ? section(w('Yaklaşanlar'), evList(upcoming)) : '', past.length ? section(w('Geçmiş olaylar'), evList(past)) : ''].join('\n'),
  }));
  return out;
}

/** /stars/<anything not generated>: the long tail of the 2.8 million stars (noindex, filled in by /wiki/star.js) */
export function fallbackStarPage(): Page {
  return {
    path: '/stars/_',
    title: w('Katalog yıldızı'),
    description: w('Gaia ve Tycho-2 kataloglarındaki 2,8 milyon yıldızdan biri.'),
    h1: w('Katalog yıldızı'),
    eyebrow: w('Yıldız'),
    lede: esc(w('Gaia ve Tycho-2 kataloglarındaki 2,8 milyon yıldızdan biri. Bu yıldızın ayrıntılı sayfası henüz yok; simülasyonda açıp konumunu, parlaklığını ve çevresini görebilirsiniz.')),
    body: `${openButton(appUrl({}))}<script src="/wiki/star.js" defer></script>`,
    crumbs: [[w('Yıldızlar'), '/stars']],
    noindex: true,
  };
}
