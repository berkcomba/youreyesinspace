/**
 * Academy — the side panel: course home (chapters → sections) and the lesson view
 * (one step at a time with formulas, callouts and an interactive widget).
 */
import type { LessonPlayer, NarrationState } from '../core/LessonPlayer';
import type { Block, Section, Step } from '../data/lessons';
import { itex, tex } from './lessons/math';
import { createWidget, type Widget } from './lessons/widgets';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, html?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
}
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** inline `$…$` → MathML, everything else passed through as authored HTML */
function inline(html: string): string {
  return html.replace(/\$([^$]+)\$/g, (_m, src: string) => itex(src));
}

function renderBlock(b: Block): HTMLElement {
  switch (b.kind) {
    case 'p': return el('p', 'ac-p', inline(b.html));
    case 'eq': {
      const f = el('figure', 'ac-eq');
      const m = el('div', 'ac-eq-math', tex(b.tex));
      f.appendChild(m);
      if (b.label) m.appendChild(el('span', 'ac-eq-label', esc(b.label)));
      if (b.note) f.appendChild(el('figcaption', 'ac-eq-note', inline(b.note)));
      return f;
    }
    case 'callout': {
      const a = el('aside', `ac-callout tone-${b.tone}`);
      const titles = { key: 'Key idea', think: 'Think about it', history: 'History', note: 'Note', example: 'Worked example' };
      a.appendChild(el('div', 'ac-callout-title', esc(b.title ?? titles[b.tone])));
      a.appendChild(el('div', 'ac-callout-body', inline(b.html)));
      return a;
    }
    case 'list': {
      const l = el(b.ordered ? 'ol' : 'ul', 'ac-list');
      for (const it of b.items) l.appendChild(el('li', undefined, inline(it)));
      return l;
    }
    case 'terms': {
      const d = el('dl', 'ac-terms');
      for (const [t, def] of b.items) { d.appendChild(el('dt', undefined, inline(t))); d.appendChild(el('dd', undefined, inline(def))); }
      return d;
    }
    case 'timeline': {
      const o = el('ol', 'ac-timeline');
      for (const it of b.items) o.appendChild(el('li', undefined, `<span class="ac-tl-when">${esc(it.when)}</span><span class="ac-tl-body"><b>${esc(it.title)}</b> ${inline(it.text)}</span>`));
      return o;
    }
    case 'table': {
      const wrap = el('div', 'ac-table-wrap');
      const t = el('table', 'ac-table');
      t.innerHTML = `<thead><tr>${b.head.map((h) => `<th>${inline(h)}</th>`).join('')}</tr></thead><tbody>${b.rows.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody>`;
      wrap.appendChild(t);
      if (b.caption) wrap.appendChild(el('div', 'ac-table-caption', inline(b.caption)));
      return wrap;
    }
    case 'compare': {
      const c = el('div', 'ac-compare');
      for (const side of [b.left, b.right]) {
        const col = el('div', 'ac-compare-col');
        col.appendChild(el('h4', undefined, esc(side.title)));
        const ul = el('ul');
        for (const it of side.items) ul.appendChild(el('li', undefined, inline(it)));
        col.appendChild(ul);
        c.appendChild(col);
      }
      return c;
    }
    case 'summary': {
      const s = el('div', 'ac-summary');
      s.appendChild(el('h4', undefined, 'In short'));
      const ul = el('ul');
      for (const it of b.items) ul.appendChild(el('li', undefined, inline(it)));
      s.appendChild(ul);
      return s;
    }
    case 'figure': {
      const f = el('figure', 'ac-figure');
      const img = el('img'); img.src = b.image; img.alt = b.caption; img.loading = 'lazy';
      f.appendChild(img);
      f.appendChild(el('figcaption', undefined, `${inline(b.caption)}${b.source ? ` <span class="ac-source">${esc(b.source)}</span>` : ''}`));
      return f;
    }
  }
}

export class LessonPanel {
  readonly panel = document.getElementById('academy') as HTMLElement;
  private readonly btn = document.getElementById('btn-academy') as HTMLButtonElement;
  private widget: Widget | null = null;
  /** chapters expanded on the course home; null until first render (then seeded with the active one) */
  private openChapters: Set<string> | null = null;
  private lec: { root: HTMLElement; play: HTMLButtonElement; time: HTMLElement; text: HTMLElement; fill: HTMLElement; auto: HTMLInputElement; mute: HTMLButtonElement } | null = null;

  constructor(private readonly player: LessonPlayer, private readonly onToggle: (show: boolean) => void) {
    this.btn.addEventListener('click', () => this.toggle(this.panel.hidden === true));
    player.onChange = () => this.render();
    player.onNarration = (n) => this.renderNarration(n);
    document.addEventListener('keydown', (e) => {
      if (this.panel.hidden || !player.active) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (e.code === 'ArrowRight' || e.code === 'PageDown') { player.next(); e.preventDefault(); }
      else if (e.code === 'ArrowLeft' || e.code === 'PageUp') { player.prev(); e.preventDefault(); }
    });
  }

  toggle(show: boolean): void {
    if (show) {
      this.panel.hidden = false;
      this.btn.classList.add('active');
      this.onToggle(true);
      this.render();
    } else {
      if (this.player.active) this.player.close();
      this.hide();
    }
  }

  private dropWidget() {
    this.widget?.destroy();
    this.widget = null;
  }

  private render(): void {
    this.dropWidget();
    this.panel.replaceChildren();
    if (this.player.active) this.renderLesson();
    else this.renderHome();
  }

  /* ------------------------------------------------------------ home ---- */
  private renderHome(): void {
    const p = this.player;
    const head = el('div', 'panel-title');
    head.innerHTML = `<span>Academy</span>`;
    const close = el('button', 'icon-btn small', '✕'); close.title = 'Close';
    close.addEventListener('click', () => this.toggle(false));
    head.appendChild(close);
    this.panel.appendChild(head);

    const scroll = el('div', 'ac-scroll');
    this.panel.appendChild(scroll);

    const hero = el('div', 'ac-hero');
    hero.appendChild(el('div', 'ac-hero-kicker', 'Course'));
    hero.appendChild(el('h2', 'ac-hero-title', esc(p.course.title)));
    hero.appendChild(el('p', 'ac-hero-sub', esc(p.course.subtitle)));
    const cp = p.courseProgress();
    const cpct = cp.totalSteps ? Math.round(cp.steps / cp.totalSteps * 100) : 0;
    const hours = (m: number) => (m >= 90 ? `${(m / 60).toFixed(m % 60 ? 1 : 0)} h` : `${m} min`);
    const tally = el('div', 'ac-course-prog');
    tally.innerHTML = `<div class="ac-bar"><div style="width:${cpct}%"></div></div>`
      + `<div class="ac-course-stats"><span><b>${cpct}%</b> complete</span><span>${cp.sections} / ${cp.totalSections} sections</span><span>${cp.steps} / ${cp.totalSteps} steps</span><span>${cp.steps ? `~${hours(cp.minutesLeft)} left` : `~${hours(cp.totalMinutes)} of material`}</span></div>`;
    hero.appendChild(tally);
    scroll.appendChild(hero);

    const last = p.resume;
    const resumeHit = last ? p.findSection(last.section) : null;
    if (last && resumeHit && p.progress(resumeHit.section) < 1) {
      const r = el('button', 'ac-resume');
      r.innerHTML = `<span class="ac-resume-k">Continue</span><span class="ac-resume-t">${esc(resumeHit.section.number)} · ${esc(resumeHit.section.title)}</span><span class="ac-resume-s">step ${last.step + 1} of ${resumeHit.section.steps.length}</span>`;
      r.addEventListener('click', () => p.open(last.section, last.step));
      scroll.appendChild(r);
    }

    // which chapters start expanded: remembered choice, else the one being studied (or the first unfinished)
    if (!this.openChapters) {
      const cur = resumeHit?.chapter ?? p.course.chapters.find((c) => p.chapterProgress(c) < 1) ?? p.course.chapters[0];
      this.openChapters = new Set(cur ? [cur.id] : []);
    }
    for (const ch of p.course.chapters) {
      const chEl = el('section', 'ac-chapter');
      const open = this.openChapters.has(ch.id);
      chEl.classList.toggle('open', open);
      const pct = Math.round(p.chapterProgress(ch) * 100);
      const done = ch.sections.filter((s) => p.progress(s) >= 1).length;
      const head = el('button', 'ac-ch-head');
      head.setAttribute('aria-expanded', String(open));
      head.innerHTML = `<span class="ac-ch-top"><span class="ac-ch-num">Chapter ${ch.number}</span><span class="ac-ch-meta">${done} / ${ch.sections.length} sections${pct > 0 ? ` · ${pct}%` : ''}</span><svg class="ac-ch-caret" viewBox="0 0 10 10" aria-hidden="true"><path d="M2 3.5 5 6.5 8 3.5" /></svg></span><h3>${esc(ch.title)}</h3><div class="ac-bar"><div style="width:${pct}%"></div></div>`;
      const body = el('div', 'ac-ch-body');
      body.hidden = !open;
      body.appendChild(el('p', 'ac-ch-sum', esc(ch.summary)));
      const list = el('div', 'ac-sections');
      for (const s of ch.sections) list.appendChild(this.sectionCard(s));
      body.appendChild(list);
      head.addEventListener('click', () => {
        const now = body.hidden === true;
        body.hidden = !now;
        chEl.classList.toggle('open', now);
        head.setAttribute('aria-expanded', String(now));
        if (now) this.openChapters!.add(ch.id); else this.openChapters!.delete(ch.id);
      });
      chEl.appendChild(head);
      chEl.appendChild(body);
      scroll.appendChild(chEl);
    }
    const soon = el('div', 'ac-soon');
    soon.innerHTML = `<span class="ac-ch-num">Coming next</span><ul><li>Chapter 7 · Binary Systems and Stellar Parameters — masses, radii and temperatures from orbiting pairs</li><li>Chapter 8 · The Classification of Stellar Spectra — OBAFGKM, the Boltzmann and Saha equations, the H–R diagram</li></ul>`;
    scroll.appendChild(soon);
  }

  private sectionCard(s: Section): HTMLElement {
    const p = this.player;
    const prog = p.progress(s);
    const b = el('button', 'ac-section');
    const state = prog >= 1 ? 'Review' : prog > 0 ? 'Continue' : 'Start';
    b.innerHTML = `<span class="ac-sec-num">${esc(s.number)}</span><span class="ac-sec-main"><span class="ac-sec-title">${esc(s.title)}</span><span class="ac-sec-sum">${esc(s.summary)}</span><span class="ac-sec-meta">${s.steps.length} steps · ${s.minutes} min${prog > 0 && prog < 1 ? ` · ${Math.round(prog * 100)}%` : ''}</span></span><span class="ac-sec-cta ${prog >= 1 ? 'done' : ''}">${prog >= 1 ? '✓ ' : ''}${state}</span>`;
    b.addEventListener('click', () => {
      // continue from the first unseen step
      let i = 0;
      if (prog > 0 && prog < 1) while (i < s.steps.length - 1 && p.isVisited(s, i)) i++;
      p.open(s.id, i);
    });
    return b;
  }

  private hide(): void {
    this.panel.hidden = true;
    this.btn.classList.remove('active');
    this.onToggle(false);
    this.dropWidget();
  }

  /* ---------------------------------------------------------- lesson ---- */
  private renderLesson(): void {
    const p = this.player;
    const sec = p.section!, step = p.step!, ch = p.chapter!;
    const i = p.stepIndex, n = sec.steps.length;

    const head = el('div', 'ac-lesson-head');
    const back = el('button', 'ac-back', '‹ Chapter ' + ch.number);
    back.title = 'Back to the course';
    back.addEventListener('click', () => p.close());
    const crumb = el('span', 'ac-crumb', `${esc(sec.number)} · ${esc(sec.title)}`);
    const close = el('button', 'icon-btn small', '✕'); close.title = 'Close';
    close.addEventListener('click', () => this.toggle(false));
    head.append(back, crumb, close);
    this.panel.appendChild(head);

    const prog = el('div', 'ac-steps');
    sec.steps.forEach((st: Step, k: number) => {
      const d = el('button', 'ac-step-dot' + (k === i ? ' current' : p.isVisited(sec, k) ? ' seen' : ''));
      d.title = st.title;
      d.addEventListener('click', () => p.go(k));
      prog.appendChild(d);
    });
    this.panel.appendChild(prog);

    const scroll = el('div', 'ac-scroll ac-lesson');
    if (step.kicker) scroll.appendChild(el('div', 'ac-kicker', esc(step.kicker)));
    scroll.appendChild(el('h2', 'ac-title', esc(step.title)));

    // widget goes after the first paragraph so the text introduces it
    let placed = !step.widget;
    step.body.forEach((b, k) => {
      scroll.appendChild(renderBlock(b));
      if (!placed && (b.kind === 'p' || k === step.body.length - 1)) {
        this.widget = createWidget(step.widget!);
        scroll.appendChild(this.widget.el);
        placed = true;
      }
    });

    const lecture = this.buildLecture();

    const foot = el('div', 'ac-foot');
    const prev = el('button', 'ac-nav', '‹ Previous');
    prev.disabled = i === 0;
    prev.addEventListener('click', () => p.prev());
    const count = el('span', 'ac-count', `${i + 1} / ${n}`);
    const nextSec = p.nextSection();
    const isLast = i === n - 1;
    const next = el('button', 'ac-nav primary', isLast ? (nextSec ? `Next: ${esc(nextSec.number)} ›` : 'Finish ✓') : 'Next ›');
    next.addEventListener('click', () => { if (isLast && !nextSec) p.close(); else p.next(); });
    foot.append(prev, count, next);
    this.panel.append(scroll, lecture, foot);
    scroll.scrollTop = 0;
    this.renderNarration(p.narration);
  }

  /* ---------------------------------------------------------- lecturer ---- */
  private buildLecture(): HTMLElement {
    const p = this.player;
    const root = el('div', 'ac-lecture');
    const play = el('button', 'ac-lec-play', '▶');
    play.title = 'Play / pause the lecturer';
    play.addEventListener('click', () => p.toggleNarration());
    const main = el('div', 'ac-lec-main');
    const head = el('div', 'ac-lec-head');
    const k = el('span', 'ac-lec-k', 'Lecturer');
    const time = el('span', 'ac-lec-time', '');
    head.append(k, time);
    const text = el('div', 'ac-lec-text', '');
    const bar = el('div', 'ac-lec-bar');
    const fill = el('div');
    bar.appendChild(fill);
    bar.addEventListener('click', (e) => {
      const r = bar.getBoundingClientRect();
      p.seekNarration(((e.clientX - r.left) / r.width) * p.narration.duration);
    });
    main.append(head, text, bar);
    const opts = el('div', 'ac-lec-opts');
    const autoL = el('label', 'ac-lec-auto');
    const auto = el('input'); auto.type = 'checkbox'; auto.checked = p.narration.auto;
    auto.addEventListener('change', () => p.setAutoAdvance(auto.checked));
    autoL.append(auto, document.createTextNode(' Auto-advance'));
    const mute = el('button', 'ac-lec-mute', '');
    mute.addEventListener('click', () => p.setNarrationEnabled(!p.narration.enabled));
    opts.append(autoL, mute);
    root.append(play, main, opts);
    this.lec = { root, play, time, text, fill, auto, mute };
    return root;
  }

  private renderNarration(n: NarrationState): void {
    const L = this.lec;
    if (!L || !L.root.isConnected) return;
    L.root.classList.toggle('off', !n.enabled);
    L.root.classList.toggle('none', !n.available && !n.loading);
    L.play.textContent = n.playing ? '❚❚' : '▶';
    L.play.disabled = !n.available;
    const fmt = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
    L.time.textContent = n.loading ? 'loading…' : n.available ? `${fmt(n.time)} / ${fmt(n.duration)}` : 'no narration for this step yet';
    L.text.textContent = n.available ? (n.enabled ? n.sentence : 'Narration is muted — press 🔊 to listen.') : '';
    L.fill.style.width = n.duration ? `${(n.time / n.duration) * 100}%` : '0%';
    L.auto.checked = n.auto;
    L.mute.textContent = n.enabled ? '🔊' : '🔇';
    L.mute.title = n.enabled ? 'Mute the lecturer' : 'Unmute the lecturer';
  }
}
