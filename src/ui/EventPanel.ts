import { applyOverrides, EVENTS, KIND_LABELS, STATUS_LABELS, type EventOverride, type SkyEvent } from '../data/events';
import { _, currentLocale } from '../i18n';
import { beacon, copyText, embedCode, eventUrl } from '../app/share';

function $<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element #${id}`);
  return el as T;
}

const DAY_MS = 86_400_000;
/** past events stay in "Recent" this long */
const RECENT_DAYS = 45;

export interface EventPanelHost {
  /** play the event's scene */
  playEvent(e: SkyEvent): void;
  showToast(msg: string, ms?: number): void;
  /** the simulation universe has this body (events whose bodies are missing are not offered) */
  hasBody(id: string): boolean;
}

/** Date + time of an event in the UI language, UTC */
export function fmtEventDate(e: SkyEvent, withTime = true): string {
  const d = new Date(e.time);
  const loc = currentLocale();
  const date = d.toLocaleDateString(loc, { day: 'numeric', month: 'short', year: d.getUTCFullYear() !== new Date().getUTCFullYear() ? 'numeric' : undefined, timeZone: 'UTC' });
  if (!withTime) return date;
  // showers / all-day events are given at a round hour: show the date only
  const allDay = /T(00|06|12):00:00Z$/.test(e.time) && e.kind !== 'moon' && e.kind !== 'solstice';
  if (allDay) return date;
  return `${date} · ${d.toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit', timeZone: 'UTC', hour12: false })} UTC`;
}

/** "in 29 days" / "in 3 hours" / "2 days ago" */
export function fmtRelative(iso: string, now = Date.now()): string {
  const ms = new Date(iso).getTime() - now;
  const abs = Math.abs(ms);
  const future = ms > 0;
  let s: string;
  if (abs < 3600_000) s = _('{n} dk', { n: Math.max(1, Math.round(abs / 60_000)) });
  else if (abs < DAY_MS) s = _('{n} saat', { n: Math.round(abs / 3600_000) });
  else s = _('{n} gün', { n: Math.round(abs / DAY_MS) });
  return future ? _('{t} sonra', { t: s }) : _('{t} önce', { t: s });
}

/** Events that this build can show, newest first within each section */
export function listEvents(hasBody: (id: string) => boolean): { upcoming: SkyEvent[]; recent: SkyEvent[] } {
  const now = Date.now();
  const ok = EVENTS.filter((e) => !e.tags?.includes('hidden') && e.bodies.every(hasBody));
  const upcoming = ok.filter((e) => new Date(e.time).getTime() >= now).sort((a, b) => a.time.localeCompare(b.time));
  const recent = ok.filter((e) => new Date(e.time).getTime() < now && now - new Date(e.time).getTime() < RECENT_DAYS * DAY_MS).sort((a, b) => b.time.localeCompare(a.time));
  return { upcoming, recent };
}

export function nextEvent(hasBody: (id: string) => boolean): SkyEvent | null {
  return listEvents(hasBody).upcoming[0] ?? null;
}

/** Side panel with the event cards + the "next event" badge on the main screen */
export class EventPanel {
  readonly panel = $('events');
  private readonly list = $('events-list');
  private readonly btn = $<HTMLButtonElement>('btn-events');
  private readonly badge = $<HTMLButtonElement>('next-event');
  private readonly embedDialog = $('embed-dialog');
  private readonly embedCodeEl = $<HTMLTextAreaElement>('embed-code');
  private embedFor: SkyEvent | null = null;

  constructor(private readonly host: EventPanelHost, private readonly onToggle: (show: boolean) => void) {
    $('events-close').addEventListener('click', () => this.toggle(false));
    this.btn.addEventListener('click', () => this.toggle(this.panel.hidden === true));
    this.badge.addEventListener('click', () => this.toggle(true));
    $('next-event-close').addEventListener('click', (ev) => { ev.stopPropagation(); this.badge.hidden = true; try { sessionStorage.setItem('yeits.badge', '0'); } catch { /* ignore */ } });
    $('embed-close').addEventListener('click', () => this.closeEmbed());
    this.embedDialog.addEventListener('click', (e) => { if (e.target === this.embedDialog) this.closeEmbed(); });
    $('embed-copy').addEventListener('click', () => {
      void copyText(this.embedCodeEl.value).then((ok) => {
        this.host.showToast(ok ? _('Embed kodu kopyalandı') : _('Kopyalanamadı; kodu elle seçip kopyalayın'));
        if (ok && this.embedFor) beacon('embed_copy', this.embedFor.id);
      });
    });
    this.embedCodeEl.addEventListener('focus', () => this.embedCodeEl.select());
    this.build();
    this.renderBadge();
    void this.loadOverrides();
    // keep "in N days" fresh while the tab stays open
    window.setInterval(() => this.renderBadge(), 60_000);
  }

  toggle(show: boolean): void {
    this.panel.hidden = !show;
    this.btn.classList.toggle('active', show);
    if (show) this.build();
    this.onToggle(show);
  }

  /** Runtime patches to dates/status (public/events/overrides.json, short cache) */
  private async loadOverrides(): Promise<void> {
    try {
      const r = await fetch(`${import.meta.env.BASE_URL}events/overrides.json`, { cache: 'no-cache' });
      if (!r.ok) return;
      const patch = (await r.json()) as Record<string, EventOverride>;
      if (patch && typeof patch === 'object') {
        applyOverrides(patch);
        this.build();
        this.renderBadge();
      }
    } catch { /* offline */ }
  }

  private build(): void {
    const { upcoming, recent } = listEvents((id) => this.host.hasBody(id));
    this.list.innerHTML = '';
    if (!upcoming.length && !recent.length) {
      const p = document.createElement('p');
      p.className = 'events-empty';
      p.textContent = _('Yakın dönemde gösterilecek olay yok.');
      this.list.appendChild(p);
      return;
    }
    if (upcoming.length) this.section(_('Yaklaşan'), upcoming);
    if (recent.length) this.section(_('Yakın geçmiş'), recent, true);
  }

  private section(title: string, events: SkyEvent[], past = false): void {
    const h = document.createElement('div');
    h.className = 'events-section';
    h.textContent = title;
    this.list.appendChild(h);
    for (const e of events) this.list.appendChild(this.cardFor(e, past));
  }

  private cardFor(e: SkyEvent, past: boolean): HTMLElement {
    const el = document.createElement('article');
    el.className = `event-card kind-${e.kind}${past ? ' past' : ''}`;
    el.dataset.event = e.id;
    const status = e.status === 'scheduled' ? `${_(STATUS_LABELS.scheduled)} (${e.source.name})` : e.status === 'happened' || past ? _(STATUS_LABELS.happened) : '';
    el.innerHTML = `
      <div class="event-top">
        <span class="event-date">${fmtEventDate(e)}</span>
        <span class="event-kind">${_(KIND_LABELS[e.kind])}</span>
      </div>
      <h3 class="event-title"></h3>
      <p class="event-summary"></p>
      <dl class="event-facts"></dl>
      <div class="event-foot">
        <span class="event-source"><a target="_blank" rel="noopener noreferrer"></a>${status ? ` · <span class="event-status">${status}</span>` : ''}${e.epoch ? ` · <span class="event-epoch" title="${_('Yörünge verisinin kaynağı ve epoğu')}">${e.epoch}</span>` : ''}</span>
        <span class="event-rel">${fmtRelative(e.time)}</span>
      </div>
      <div class="event-actions seg">
        <button class="ev-watch" data-act="watch">${past ? _('Yeniden izle') : _('İzle')}</button>
        <button data-act="share" title="${_('Bağlantıyı kopyala')}">${_('Paylaş')}</button>
        <button data-act="embed" title="${_('Sitenize gömmek için iframe kodu')}">${_('Göm')}</button>
      </div>`;
    el.querySelector<HTMLElement>('.event-title')!.textContent = _(e.title);
    el.querySelector<HTMLElement>('.event-summary')!.textContent = _(e.summary);
    // the three figures that make the event graspable before pressing play
    el.querySelector<HTMLElement>('.event-facts')!.replaceChildren(...e.facts.slice(0, 3).map(([k, v]) => {
      const d = document.createElement('div');
      const dt = document.createElement('dt'); dt.textContent = _(k);
      const dd = document.createElement('dd'); dd.textContent = _(v);
      d.append(dt, dd);
      return d;
    }));
    const a = el.querySelector<HTMLAnchorElement>('.event-source a')!;
    a.href = e.source.url;
    a.textContent = e.source.name;
    el.addEventListener('click', (ev) => {
      const b = (ev.target as HTMLElement).closest<HTMLButtonElement>('button[data-act]');
      if (!b) return;
      ev.stopPropagation();
      if (b.dataset.act === 'watch') { this.host.playEvent(e); this.toggle(false); }
      else if (b.dataset.act === 'share') {
        void copyText(eventUrl(e)).then((ok) => {
          this.host.showToast(ok ? _('Bağlantı kopyalandı') : eventUrl(e), ok ? 1800 : 5000);
          if (ok) beacon('share', e.id);
        });
      } else if (b.dataset.act === 'embed') this.openEmbed(e);
    });
    return el;
  }

  private openEmbed(e: SkyEvent): void {
    this.embedFor = e;
    $('embed-title').textContent = _(e.title);
    this.embedCodeEl.value = embedCode(e);
    const prev = $<HTMLIFrameElement>('embed-preview');
    prev.src = eventUrl(e, { embed: true });
    this.embedDialog.hidden = false;
  }

  private closeEmbed(): void {
    this.embedDialog.hidden = true;
    $<HTMLIFrameElement>('embed-preview').removeAttribute('src');
    this.embedFor = null;
  }

  /** Small "Next: … · in N days" chip on the main screen while the panel is closed */
  renderBadge(): void {
    let dismissed = false;
    try { dismissed = sessionStorage.getItem('yeits.badge') === '0'; } catch { /* ignore */ }
    const e = nextEvent((id) => this.host.hasBody(id));
    if (!e || dismissed) { this.badge.hidden = true; return; }
    $('next-event-text').textContent = `${_('Sıradaki')}: ${_(e.title)} · ${fmtRelative(e.time)}`;
    this.badge.hidden = false;
  }
}
