import { _, currentLocale } from '../i18n';
import type { SkyEvent } from '../data/events';

/**
 * Shareable URLs, the embed (iframe) mode and the tiny usage beacon.
 *
 *   ?event=<id>[&t=<ISO>][&rate=<s/s>][&embed=1][&lang=xx]   play an event scene
 *   ?target=<bodyId>[&t=<ISO>][&cam=dx,dy,dz,r][&rate=…]      a view of a body (cam: unit direction
 *                                                            from the body in scene axes, r in radii)
 *
 * The canonical site is https://youreyesinspace.com; links are built from `location.origin` so
 * previews and staging deployments link to themselves.
 */

export const SITE = 'https://youreyesinspace.com';
export const SITE_NAME = 'Your Eyes In Space';

export interface LaunchParams {
  event: string | null;
  target: string | null;
  /** simulation clock (valid Date) */
  time: Date | null;
  /** simulation rate, s/s */
  rate: number | null;
  /** camera: unit direction from the target (scene axes) and distance in radii */
  cam: { dir: [number, number, number]; radii: number } | null;
  embed: boolean;
  /** how the visitor got here (utm_source), for the beacon */
  utm: string | null;
}

export function parseLaunch(search = location.search): LaunchParams {
  const q = new URLSearchParams(search);
  const safeId = (s: string | null) => (s && /^[a-z0-9-]{1,64}$/i.test(s) ? s : null);
  let time: Date | null = null;
  const t = q.get('t');
  if (t) {
    const d = new Date(t);
    if (!Number.isNaN(d.getTime())) time = d;
  }
  let rate: number | null = null;
  const r = q.get('rate');
  if (r !== null) {
    const v = parseFloat(r);
    if (Number.isFinite(v) && v >= 0 && v <= 1e12) rate = v;
  }
  let cam: LaunchParams['cam'] = null;
  const c = q.get('cam');
  if (c) {
    const p = c.split(',').map(parseFloat);
    if (p.length === 4 && p.every(Number.isFinite) && p[3] > 1.001 && p[3] < 1e9) {
      const n = Math.hypot(p[0], p[1], p[2]);
      if (n > 1e-6) cam = { dir: [p[0] / n, p[1] / n, p[2] / n], radii: p[3] };
    }
  }
  return {
    event: safeId(q.get('event')),
    target: safeId(q.get('target')),
    time, rate, cam,
    embed: q.get('embed') === '1',
    utm: q.get('utm_source'),
  };
}

export function eventUrl(e: SkyEvent, opts: { embed?: boolean; lang?: string; origin?: string } = {}): string {
  const u = new URL(opts.origin ?? location.origin);
  u.pathname = '/';
  u.searchParams.set('event', e.id);
  const lang = opts.lang ?? currentLocale();
  if (lang !== 'en') u.searchParams.set('lang', lang);
  if (opts.embed) u.searchParams.set('embed', '1');
  return u.toString();
}

export function viewUrl(targetId: string, time: Date, cam: { dir: [number, number, number]; radii: number } | null, rate: number): string {
  const u = new URL(location.origin);
  u.pathname = '/';
  u.searchParams.set('target', targetId);
  u.searchParams.set('t', time.toISOString().replace(/\.\d{3}Z$/, 'Z'));
  if (cam) u.searchParams.set('cam', `${cam.dir.map((x) => x.toFixed(4)).join(',')},${cam.radii >= 100 ? Math.round(cam.radii) : cam.radii.toFixed(2)}`);
  if (rate !== 1) u.searchParams.set('rate', String(rate));
  const lang = currentLocale();
  if (lang !== 'en') u.searchParams.set('lang', lang);
  return u.toString();
}

/** Ready-to-paste iframe snippet (16:9, responsive) */
export function embedCode(e: SkyEvent): string {
  const src = eventUrl(e, { embed: true });
  return `<iframe src="${src}" title="${escapeAttr(_(e.title))} — ${SITE_NAME}" style="width:100%;aspect-ratio:16/9;border:0;border-radius:8px" allow="fullscreen" allowfullscreen loading="lazy"></iframe>`;
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

/** "Open in Your Eyes In Space" link target from an embed */
export function openFromEmbedUrl(e: SkyEvent | null): string {
  const u = new URL(e ? eventUrl(e) : location.origin);
  u.searchParams.set('utm_source', 'embed');
  u.searchParams.set('utm_medium', 'iframe');
  try { if (document.referrer) u.searchParams.set('utm_campaign', new URL(document.referrer).host); } catch { /* ignore */ }
  return u.toString();
}

/** Copy text to the clipboard; resolves false when the browser refuses. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

/* ------------------------------------------------------------------ document metadata */

const baseTitle = document.title;
const baseDesc = document.querySelector<HTMLMetaElement>('meta[name="description"]')?.content ?? '';

/** Title / canonical / Open Graph for an event page (or back to the site defaults). */
export function applyEventMeta(e: SkyEvent | null): void {
  const set = (sel: string, attr: string, value: string) => {
    const el = document.querySelector<HTMLElement>(sel);
    if (el) el.setAttribute(attr, value);
  };
  if (!e) {
    document.title = baseTitle;
    set('link[rel="canonical"]', 'href', `${SITE}/`);
    set('meta[property="og:url"]', 'content', `${SITE}/`);
    set('meta[property="og:title"]', 'content', baseTitle);
    set('meta[property="og:description"]', 'content', baseDesc);
    set('meta[name="description"]', 'content', baseDesc);
    return;
  }
  const title = `${_(e.title)} — ${SITE_NAME}`;
  const canonical = eventUrl(e, { origin: SITE, lang: 'en' });
  document.title = title;
  set('link[rel="canonical"]', 'href', canonical);
  set('meta[property="og:url"]', 'content', canonical);
  set('meta[property="og:title"]', 'content', title);
  set('meta[property="og:description"]', 'content', _(e.summary));
  set('meta[name="description"]', 'content', _(e.summary));
  set('meta[property="og:image"]', 'content', `${SITE}/og-image.jpg`);
  set('meta[property="og:image:secure_url"]', 'content', `${SITE}/og-image.jpg`);
  set('meta[property="og:image:alt"]', 'content', _(e.title));
}

/* ------------------------------------------------------------------ beacon */

export type BeaconKind = 'event_open' | 'embed_open' | 'open_click' | 'share' | 'embed_copy';

/**
 * Anonymous one-pixel GET (`/_b.gif`, nginx `empty_gif`, no cookies, no store): which event, whether
 * it ran inside an iframe and where the iframe lives. Nothing identifies the visitor.
 */
export function beacon(kind: BeaconKind, id = '', embed = false): void {
  if (import.meta.env.DEV) return;
  const q = new URLSearchParams({ e: kind, id, em: embed ? '1' : '0', l: currentLocale() });
  try {
    const host = document.referrer ? new URL(document.referrer).host : '';
    if (host && host !== location.host) q.set('ref', host);
  } catch { /* ignore */ }
  const img = new Image(1, 1);
  img.src = `${import.meta.env.BASE_URL}_b.gif?${q.toString()}&_=${Date.now().toString(36)}`;
}
