// Locator: one widget for every page with a position on the sky. The page gives the parameters
// (<figure class="w-loc" data-ra data-dec data-ly data-mag data-con data-name>); the sky itself
// (naked-eye stars, IAU boundaries, labels) comes from /encyclopedia/sky.json.
(() => {
  const figs = [...document.querySelectorAll('.w-loc')];
  if (!figs.length) return;
  const lang = document.documentElement.lang || 'en';
  const base = lang === 'en' ? '' : `/${lang}`;
  const DEG = Math.PI / 180, TAU = Math.PI * 2;
  const C = {
    bg: '#0b0e13', grid: '#1a1f27', line: '#3a414d', text: '#e4e4de', dim: '#8a929c', faint: '#4a515c',
    accent: '#bd9b6c', sun: '#f2c45a', band: 'rgba(185, 194, 201, 0.06)',
  };
  const sky = fetch(`${base}/encyclopedia/sky.json`).then((r) => r.json());

  const num = (x, d = 0) => x.toLocaleString(lang, { minimumFractionDigits: d, maximumFractionDigits: d });
  const wrap360 = (a) => ((a % 360) + 360) % 360;
  const wrap180 = (a) => { const x = wrap360(a); return x > 180 ? x - 360 : x; };
  const hms = (ra) => {
    const h = wrap360(ra) / 15, hh = Math.floor(h), m = (h - hh) * 60, mm = Math.floor(m), s = Math.round((m - mm) * 60);
    return `${hh}h ${String(s === 60 ? mm + 1 : mm).padStart(2, '0')}m ${String(s === 60 ? 0 : s).padStart(2, '0')}s`;
  };
  const dms = (dec) => {
    const a = Math.abs(dec), d = Math.floor(a), m = Math.round((a - d) * 60);
    return `${dec < 0 ? '−' : '+'}${m === 60 ? d + 1 : d}° ${String(m === 60 ? 0 : m).padStart(2, '0')}′`;
  };

  /* -- frames -- */
  const unit = (lon, lat) => { const a = lon * DEG, d = lat * DEG; return [Math.cos(d) * Math.cos(a), Math.cos(d) * Math.sin(a), Math.sin(d)]; };
  const angles = (v) => [wrap360(Math.atan2(v[1], v[0]) / DEG), Math.asin(Math.max(-1, Math.min(1, v[2]))) / DEG];
  const GAL = [[-0.0548755604, -0.8734370902, -0.4838350155], [0.4941094279, -0.44482963, 0.7469822445], [-0.867666149, -0.1980763734, 0.4559837762]];
  const toGal = (ra, dec) => { const v = unit(ra, dec); return angles(GAL.map((r) => r[0] * v[0] + r[1] * v[1] + r[2] * v[2])); };
  const fromGal = (l, b) => { const v = unit(l, b); return angles([0, 1, 2].map((k) => GAL[0][k] * v[0] + GAL[1][k] * v[1] + GAL[2][k] * v[2])); };
  const OBL = 23.4393 * DEG;
  const fromEcl = (lam) => angles([Math.cos(lam * DEG), Math.sin(lam * DEG) * Math.cos(OBL), Math.sin(lam * DEG) * Math.sin(OBL)]);
  const ECLIPTIC = Array.from({ length: 181 }, (_, k) => fromEcl(k * 2));
  const GPLANE = [-8, 0, 8].map((b) => Array.from({ length: 181 }, (_, k) => fromGal(k * 2, b)));

  function starColor(bv) {
    const t = Math.max(0, Math.min(1, (bv + 0.3) / 2));
    const stops = [[0, [170, 191, 255]], [0.4, [248, 246, 240]], [0.7, [255, 222, 170]], [1, [255, 176, 112]]];
    let k = 0;
    while (k < stops.length - 2 && t > stops[k + 1][0]) k++;
    const [t0, c0] = stops[k], [t1, c1] = stops[k + 1], f = (t - t0) / (t1 - t0);
    return `rgb(${c0.map((c, i) => Math.round(c + (c1[i] - c) * f)).join(',')})`;
  }

  function fmtLy(x, T) {
    if (x < 1000) return `${num(x, x < 10 ? 1 : 0)} ${T.ly}`;
    if (x < 1e6) return `${num(x / 1000, x < 1e4 ? 1 : 0)} ${T.kly}`;
    if (x < 1e9) return `${num(x / 1e6, x < 1e7 ? 1 : 0)} ${T.Mly}`;
    return `${num(x / 1e9, 1)} ${T.Gly}`;
  }
  function niceStep(span) {
    const p = 10 ** Math.floor(Math.log10(span));
    const f = span / p;
    return (f < 2 ? 1 : f < 5 ? 2 : 5) * p;
  }

  class Locator {
    constructor(fig, data) {
      const d = fig.dataset;
      this.fig = fig;
      this.D = data;
      this.T = data.t;
      this.ra = +d.ra; this.dec = +d.dec;
      this.ly = d.ly ? +d.ly : null;
      this.mag = d.mag ? +d.mag : null;
      this.con = d.con || '';
      this.name = d.name || '';
      this.area = d.area === '1';
      this.fov0 = d.fov ? +d.fov : this.mag !== null && this.mag > 6 ? 30 : 50;
      this.view = 'sky';
      this.c0 = [this.ra, this.dec];
      this.fov = this.fov0;
      this.scale0 = this.ly ? Math.max(this.ly * 1.7, 30) : 1e5;
      this.scale = this.scale0;
      this.hits = [];
      this.hover = null;
      this.gal = toGal(this.ra, this.dec);
      this.build();
    }

    build() {
      const T = this.T;
      this.canvas = document.createElement('canvas');
      this.readout = document.createElement('div');
      this.readout.className = 'w-loc-ro';
      this.controls = document.createElement('div');
      this.controls.className = 'w-loc-ctl';
      const seg = document.createElement('div');
      seg.className = 'w-loc-seg';
      const views = [['sky', T.sky], ['all', T.all], ...(this.ly ? [['top', T.top]] : [])];
      this.btns = views.map(([v, label]) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = label;
        b.addEventListener('click', () => this.setView(v));
        seg.appendChild(b);
        return [v, b];
      });
      this.slider = document.createElement('label');
      this.slider.className = 'w-loc-slider';
      this.sliderName = document.createElement('span');
      this.range = document.createElement('input');
      this.range.type = 'range';
      this.sliderVal = document.createElement('span');
      this.sliderVal.className = 'v';
      this.slider.append(this.sliderName, this.range, this.sliderVal);
      this.range.addEventListener('input', () => {
        const v = +this.range.value;
        if (this.view === 'sky') this.fov = v; else this.scale = 10 ** v;
        this.sliderText();
        this.draw();
      });
      const reset = document.createElement('button');
      reset.type = 'button';
      reset.className = 'w-loc-reset';
      reset.textContent = T.reset;
      reset.addEventListener('click', () => { this.c0 = [this.ra, this.dec]; this.fov = this.fov0; this.scale = this.scale0; this.setView(this.view); });
      this.caption = document.createElement('p');
      this.caption.className = 'w-loc-cap';
      this.controls.append(seg, this.slider, reset);
      this.fig.replaceChildren(this.canvas, this.readout, this.controls, this.caption);
      this.ctx = this.canvas.getContext('2d');

      let drag = null;
      this.canvas.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, c0: [...this.c0], moved: false }; });
      this.canvas.addEventListener('pointermove', (e) => {
        const r = this.canvas.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
        if (drag && this.view === 'sky') {
          const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
          if (Math.hypot(dx, dy) > 3) drag.moved = true;
          if (drag.moved) {
            const s = this.pxPerRad();
            this.c0 = [wrap360(drag.c0[0] + dx / s / DEG / Math.max(0.2, Math.cos(drag.c0[1] * DEG))), Math.max(-89.5, Math.min(89.5, drag.c0[1] + dy / s / DEG))];
            this.draw();
            return;
          }
        }
        let best = null, bd = 9;
        for (const h of this.hits) { const dd = Math.hypot(h.x - x, h.y - y); if (dd < bd) { bd = dd; best = h; } }
        if (best !== this.hover) { this.hover = best; this.canvas.style.cursor = best?.slug ? 'pointer' : this.view === 'sky' ? 'grab' : this.view === 'all' ? 'crosshair' : 'default'; this.draw(); }
      });
      const up = (e) => {
        if (!drag) return;
        const moved = drag.moved;
        drag = null;
        if (moved) return;
        const r = this.canvas.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
        if (this.hover?.slug) { location.href = `${base}/stars/${this.hover.slug}`; return; }
        if (this.view === 'all') {
          const p = this.hammerInverse(x, y);
          if (p) { this.c0 = p; this.fov = 40; this.setView('sky'); }
        }
      };
      this.canvas.addEventListener('pointerup', up);
      this.canvas.addEventListener('pointercancel', () => { drag = null; });
      this.canvas.addEventListener('pointerleave', () => { if (this.hover) { this.hover = null; this.draw(); } });
      new ResizeObserver(() => this.resize()).observe(this.fig);
      this.setView('sky');
    }

    setView(v) {
      const T = this.T;
      this.view = v;
      this.hover = null;
      for (const [k, b] of this.btns) b.classList.toggle('active', k === v);
      this.slider.hidden = v === 'all';
      if (v === 'sky') {
        this.sliderName.textContent = T.fov;
        Object.assign(this.range, { min: 3, max: 140, step: 1 });
        this.range.value = this.fov;
      } else if (v === 'top') {
        this.sliderName.textContent = T.scale;
        const hi = Math.max(Math.log10(this.ly * 6), 5.2);
        Object.assign(this.range, { min: 0.7, max: hi, step: 0.01 });
        this.range.value = Math.log10(this.scale);
      }
      this.sliderText();
      this.caption.textContent = v === 'sky' ? T.hintSky : v === 'all' ? T.hintAll : T.hintTop;
      this.canvas.style.cursor = v === 'sky' ? 'grab' : v === 'all' ? 'crosshair' : 'default';
      this.readoutFor();
      this.draw();
    }

    sliderText() {
      this.sliderVal.textContent = this.view === 'sky' ? `${num(this.fov)}°` : fmtLy(this.scale, this.T);
    }

    readoutFor() {
      const T = this.T, rows = [[T.ra, hms(this.ra)], [T.dec, dms(this.dec)]];
      if (this.con) rows.push([T.con, this.D.n[this.con] || this.con]);
      if (this.mag !== null) rows.push([T.mag, num(this.mag, 2)]);
      if (this.ly !== null) rows.push([T.dist, fmtLy(this.ly, T)]);
      rows.push([T.l, `${num(this.gal[0], 1)}°`], [T.b, `${num(this.gal[1], 1)}°`]);
      this.readout.replaceChildren(...rows.map(([k, v]) => {
        const d = document.createElement('div');
        const a = document.createElement('span'), b = document.createElement('span');
        a.textContent = k; b.textContent = v; b.className = 'v';
        d.append(a, b);
        return d;
      }));
    }

    resize() {
      const w = this.fig.clientWidth;
      if (!w) return;
      const h = Math.round(Math.min(w / 1.6, 460));
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.canvas.style.height = `${h}px`;
      this.canvas.width = Math.round(w * dpr);
      this.canvas.height = Math.round(h * dpr);
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.w = w; this.h = h;
      this.draw();
    }

    draw() {
      if (!this.w || this.pending) return;
      this.pending = true;
      requestAnimationFrame(() => {
        this.pending = false;
        const c = this.ctx;
        c.fillStyle = C.bg;
        c.fillRect(0, 0, this.w, this.h);
        this.hits = [];
        if (this.view === 'sky') this.drawSky();
        else if (this.view === 'all') this.drawAll();
        else this.drawTop();
      });
    }

    /* -- helpers -- */
    text(s, x, y, color, size = 11, align = 'left', serif = false) {
      const c = this.ctx;
      c.fillStyle = color;
      c.font = `${size}px ${serif ? '"Iowan Old Style", Palatino, Georgia, serif' : '-apple-system, system-ui, sans-serif'}`;
      c.textAlign = align;
      c.textBaseline = 'middle';
      c.fillText(s, x, y);
    }
    path(points, project, stroke, width = 1, dash = [], maxJump = Infinity) {
      const c = this.ctx;
      c.beginPath();
      let pen = false, last = null;
      for (const p of points) {
        const q = project(p[0], p[1]);
        if (!q || (last && Math.hypot(q[0] - last[0], q[1] - last[1]) > maxJump)) { pen = false; last = q; continue; }
        if (pen) c.lineTo(q[0], q[1]); else c.moveTo(q[0], q[1]);
        pen = true; last = q;
      }
      c.strokeStyle = stroke; c.lineWidth = width; c.setLineDash(dash); c.stroke(); c.setLineDash([]);
    }
    marker(x, y, label, sub) {
      const c = this.ctx;
      c.strokeStyle = C.accent; c.lineWidth = 1.4;
      c.beginPath(); c.arc(x, y, 9, 0, TAU); c.stroke();
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        c.beginPath(); c.moveTo(x + dx * 12, y + dy * 12); c.lineTo(x + dx * 18, y + dy * 18); c.stroke();
      }
      const right = x < this.w - 140;
      this.text(label, x + (right ? 22 : -22), y - (sub ? 7 : 0), C.text, 13, right ? 'left' : 'right', true);
      if (sub) this.text(sub, x + (right ? 22 : -22), y + 9, C.dim, 10.5, right ? 'left' : 'right');
    }
    edgeArrow(x, y, label) {
      // clamp an off-canvas point to the border and point at it
      const cx = this.w / 2, cy = this.h / 2, dx = x - cx, dy = y - cy;
      const k = Math.min((this.w / 2 - 22) / Math.abs(dx || 1e-9), (this.h / 2 - 22) / Math.abs(dy || 1e-9));
      const ax = cx + dx * k, ay = cy + dy * k, a = Math.atan2(dy, dx), c = this.ctx;
      c.fillStyle = C.accent;
      c.beginPath();
      c.moveTo(ax + Math.cos(a) * 8, ay + Math.sin(a) * 8);
      c.lineTo(ax + Math.cos(a + 2.5) * 8, ay + Math.sin(a + 2.5) * 8);
      c.lineTo(ax + Math.cos(a - 2.5) * 8, ay + Math.sin(a - 2.5) * 8);
      c.fill();
      this.text(label, ax - Math.cos(a) * 14, ay - Math.sin(a) * 14, C.text, 11, dx > 0 ? 'right' : 'left');
    }
    starHit(x, y, r, s) { this.hits.push({ x, y, r, slug: s[4], name: s[5], mag: s[2] }); }
    tooltip() {
      const h = this.hover;
      if (!h) return;
      const c = this.ctx;
      c.strokeStyle = C.text; c.lineWidth = 1;
      c.beginPath(); c.arc(h.x, h.y, h.r + 4, 0, TAU); c.stroke();
      const label = `${h.name} · ${num(h.mag, 1)}`;
      c.font = '11px -apple-system, system-ui, sans-serif';
      const tw = c.measureText(label).width;
      const x = Math.min(h.x + 10, this.w - tw - 14), y = Math.max(h.y - 26, 6);
      c.fillStyle = 'rgba(11, 14, 19, 0.92)'; c.fillRect(x, y, tw + 12, 20);
      c.strokeStyle = C.line; c.strokeRect(x + 0.5, y + 0.5, tw + 11, 19);
      this.text(label, x + 6, y + 10, C.text, 11);
    }

    /* -- the neighbourhood on the sky: stereographic, north up, east left -- */
    pxPerRad() { return (this.w / 2) / (2 * Math.tan((this.fov / 4) * DEG)); }
    drawSky() {
      const [ra0, de0] = this.c0, s = this.pxPerRad(), cx = this.w / 2, cy = this.h / 2;
      const sd0 = Math.sin(de0 * DEG), cd0 = Math.cos(de0 * DEG);
      const proj = (ra, dec) => {
        const dr = (ra - ra0) * DEG, sd = Math.sin(dec * DEG), cd = Math.cos(dec * DEG);
        const cosc = sd0 * sd + cd0 * cd * Math.cos(dr);
        if (cosc < -0.2) return null;
        const k = 2 / (1 + cosc);
        return [cx - k * cd * Math.sin(dr) * s, cy - k * (cd0 * sd - sd0 * cd * Math.cos(dr)) * s];
      };
      const jump = this.w;
      // coordinate grid
      const fov = this.fov;
      const dStep = fov > 60 ? 15 : fov > 25 ? 10 : fov > 10 ? 5 : 2;
      const rStep = fov > 60 ? 30 : fov > 25 ? 15 : fov > 10 ? 7.5 : 2.5;
      const fine = Math.max(0.25, Math.min(2, fov / 40));
      for (let d = -90 + dStep; d < 90; d += dStep) this.path(Array.from({ length: Math.ceil(360 / fine) + 1 }, (_, k) => [k * fine, d]), proj, C.grid, 1, [], jump);
      for (let r = 0; r < 360; r += rStep) this.path(Array.from({ length: Math.ceil(176 / fine) + 1 }, (_, k) => [r, -88 + k * fine]), proj, C.grid, 1, [], jump);
      // the ecliptic and the plane of the Milky Way
      this.path(ECLIPTIC, proj, C.faint, 1, [2, 4], jump);
      this.path(GPLANE[1], proj, 'rgba(185, 194, 201, 0.16)', 1, [6, 4], jump);
      // constellation boundaries; the object's own constellation drawn in brass
      const { b, c: labels, n, s: stars } = this.D;
      for (const line of b) {
        const own = line[0] === this.con || line[1] === this.con;
        const pts = [];
        for (let k = 2; k < line.length; k += 2) pts.push([line[k], line[k + 1]]);
        this.path(pts, proj, own ? 'rgba(189, 155, 108, 0.55)' : 'rgba(74, 81, 92, 0.75)', 1, own ? [] : [3, 3], jump);
      }
      for (const abbr in labels) {
        const [lra, ldec] = labels[abbr], q = proj(lra, ldec);
        if (!q || q[0] < 0 || q[0] > this.w || q[1] < 0 || q[1] > this.h) continue;
        this.text((n[abbr] || labels[abbr][2]).toLocaleUpperCase(lang), q[0], q[1], abbr === this.con ? 'rgba(189, 155, 108, 0.8)' : C.faint, 10, 'center');
      }
      // stars down to a limit that follows the zoom
      const lim = fov > 90 ? 4.8 : fov > 45 ? 5.5 : 6.1;
      const boost = Math.max(0.85, Math.min(1.6, (50 / fov) ** 0.25));
      const c = this.ctx;
      for (const st of stars) {
        if (st[2] > lim) continue;
        const q = proj(st[0], st[1]);
        if (!q || q[0] < -10 || q[0] > this.w + 10 || q[1] < -10 || q[1] > this.h + 10) continue;
        const r = Math.max(0.7, 0.62 * (6.4 - st[2])) * boost;
        c.fillStyle = starColor(st[3]);
        c.beginPath(); c.arc(q[0], q[1], r, 0, TAU); c.fill();
        this.starHit(q[0], q[1], r, st);
        const self = Math.abs(st[0] - this.ra) < 0.05 && Math.abs(st[1] - this.dec) < 0.05;
        if (st[6] && !self && st[2] < (fov > 60 ? 1.6 : fov > 25 ? 2.6 : 4)) this.text(st[5], q[0] + r + 5, q[1], C.dim, 10.5);
      }
      const t = proj(this.ra, this.dec);
      if (this.area) { /* a constellation: its outline is the marker */ }
      else if (t && t[0] > -20 && t[0] < this.w + 20 && t[1] > -20 && t[1] < this.h + 20) this.marker(t[0], t[1], this.name);
      else {
        // off the chart after a drag: point the way back
        const dr = (this.ra - ra0) * DEG, sd = Math.sin(this.dec * DEG), cd = Math.cos(this.dec * DEG);
        this.edgeArrow(cx - cd * Math.sin(dr) * 1e4, cy - (cd0 * sd - sd0 * cd * Math.cos(dr)) * 1e4, this.name);
      }
      // compass and scale
      this.text(this.T.north, cx, 12, C.dim, 10, 'center');
      this.text(this.T.east, 12, cy, C.dim, 10, 'left');
      this.tooltip();
    }

    /* -- the whole sky: Hammer projection centred on the object's hour of RA -- */
    hammerSize() {
      const R = Math.min((this.w - 24) / (4 * Math.SQRT2), (this.h - 24) / (2 * Math.SQRT2));
      return { R, cx: this.w / 2, cy: this.h / 2, lc: Math.round(this.ra / 15) * 15 };
    }
    hammer(ra, dec) {
      const { R, cx, cy, lc } = this.hammerSize();
      const l = wrap180(ra - lc) * DEG, p = dec * DEG;
      const z = Math.sqrt(1 + Math.cos(p) * Math.cos(l / 2));
      return [cx - R * (2 * Math.SQRT2 * Math.cos(p) * Math.sin(l / 2)) / z, cy - R * (Math.SQRT2 * Math.sin(p)) / z];
    }
    hammerInverse(x, y) {
      const { R, cx, cy, lc } = this.hammerSize();
      const X = -(x - cx) / R, Y = -(y - cy) / R;
      if ((X * X) / 8 + (Y * Y) / 2 > 1) return null;
      const z = Math.sqrt(1 - (X / 4) ** 2 - (Y / 2) ** 2);
      const l = 2 * Math.atan2(z * X, 2 * (2 * z * z - 1));
      return [wrap360(lc + l / DEG), Math.asin(Math.max(-1, Math.min(1, z * Y))) / DEG];
    }
    drawAll() {
      const c = this.ctx, proj = (ra, dec) => this.hammer(ra, dec), jump = this.w / 3;
      const { R, cx, cy, lc } = this.hammerSize();
      c.strokeStyle = C.line; c.lineWidth = 1;
      c.beginPath(); c.ellipse(cx, cy, R * 2 * Math.SQRT2, R * Math.SQRT2, 0, 0, TAU); c.stroke();
      for (let d = -60; d <= 60; d += 30) this.path(Array.from({ length: 121 }, (_, k) => [lc - 180 + k * 3, d]), proj, C.grid, 1, [], jump);
      for (let r = 0; r < 360; r += 30) {
        if (wrap180(r - lc) === -180) continue;
        this.path(Array.from({ length: 61 }, (_, k) => [r, -90 + k * 3]), proj, C.grid, 1, [], jump);
      }
      for (let r = 0; r < 360; r += 60) {
        const q = proj(r, 0);
        if (Math.abs(wrap180(r - lc)) < 170) this.text(`${r / 15}h`, q[0], q[1] + 10, C.faint, 9.5, 'center');
      }
      this.path(GPLANE[0], proj, 'rgba(185, 194, 201, 0.14)', 1, [], jump);
      this.path(GPLANE[2], proj, 'rgba(185, 194, 201, 0.14)', 1, [], jump);
      this.path(GPLANE[1], proj, 'rgba(185, 194, 201, 0.28)', 1, [6, 4], jump);
      this.path(ECLIPTIC, proj, C.faint, 1, [2, 4], jump);
      const gq = proj(...fromGal(0, 0));
      this.text(this.T.gc, gq[0], gq[1] - 10, C.dim, 10, 'center');
      const eq = proj(...fromEcl(lc + 90 > 360 ? lc - 90 : lc + 90));
      this.text(this.T.ecl, eq[0], eq[1] - 10, C.faint, 10, 'center');
      for (const line of this.D.b) {
        if (line[0] !== this.con && line[1] !== this.con) continue;
        const pts = [];
        for (let k = 2; k < line.length; k += 2) pts.push([line[k], line[k + 1]]);
        this.path(pts, proj, 'rgba(189, 155, 108, 0.7)', 1, [], jump);
      }
      for (const st of this.D.s) {
        if (st[2] > 4.3) continue;
        const q = proj(st[0], st[1]), r = Math.max(0.6, 0.42 * (4.8 - st[2]));
        c.fillStyle = starColor(st[3]);
        c.beginPath(); c.arc(q[0], q[1], r, 0, TAU); c.fill();
        this.starHit(q[0], q[1], r, st);
      }
      const t = proj(this.ra, this.dec);
      if (this.area) this.text(this.name, t[0], t[1] - 14, C.text, 12, 'center', true);
      else this.marker(t[0], t[1], this.name, this.D.n[this.con] || '');
      this.tooltip();
    }

    /* -- from above the galactic plane: the Sun in the middle, the centre of the Milky Way up -- */
    drawTop() {
      const c = this.ctx, T = this.T, cx = this.w / 2, cy = this.h / 2;
      const R0 = 26700, ppl = (Math.min(this.w, this.h) / 2 - 18) / this.scale;
      const P = (x, y) => [cx - y * ppl, cy - x * ppl];
      // the Milky Way: disc, bar and four logarithmic arms (schematic)
      const [gx, gy] = P(R0, 0);
      if (50000 * ppl <= 6) {
        // seen from millions of light-years the whole galaxy is a speck around the Sun
        c.fillStyle = 'rgba(185, 194, 201, 0.35)';
        c.beginPath(); c.arc(gx, gy, Math.max(3, 50000 * ppl), 0, TAU); c.fill();
        this.text(T.mw, cx + 10, cy - 12, C.dim, 10.5, 'left');
      } else if (this.scale >= 12000) {
        c.fillStyle = C.band;
        c.beginPath(); c.arc(gx, gy, 50000 * ppl, 0, TAU); c.fill();
        const pitch = Math.tan(12.5 * DEG);
        for (let arm = 0; arm < 4; arm++) {
          const pts = [];
          for (let k = 0; k <= 160; k++) {
            const th = k * 0.035, r = 11000 * Math.exp(pitch * th);
            if (r > 52000) break;
            const a = th + arm * Math.PI / 2 + 2.1;
            pts.push(P(R0 - r * Math.cos(a), r * Math.sin(a)));
          }
          c.beginPath();
          pts.forEach((p, k) => (k ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])));
          c.strokeStyle = 'rgba(185, 194, 201, 0.15)'; c.lineWidth = Math.max(1, Math.min(6, 1800 * ppl)); c.stroke();
        }
        const bar = 13000, ba = 30 * DEG;
        const [b0x, b0y] = P(R0 - bar * Math.cos(ba), bar * Math.sin(ba)), [b1x, b1y] = P(R0 + bar * Math.cos(ba), -bar * Math.sin(ba));
        c.beginPath(); c.moveTo(b0x, b0y); c.lineTo(b1x, b1y);
        c.strokeStyle = 'rgba(185, 194, 201, 0.2)'; c.lineWidth = Math.max(1, Math.min(8, 2500 * ppl)); c.stroke();
      }
      if (50000 * ppl > 6) {
        if (gy > 16) this.text(T.gc, gx, gy, C.dim, 10.5, 'center');
        else this.edgeArrow(gx, gy, `${T.gc} · ${fmtLy(R0, T)}`);
      }
      // distance rings around the Sun, labelled on the lower right diagonal
      const step = niceStep(this.scale / 2.2);
      c.setLineDash([2, 4]);
      for (let r = step; r <= this.scale * 1.45; r += step) {
        c.strokeStyle = C.line; c.lineWidth = 1;
        c.beginPath(); c.arc(cx, cy, r * ppl, 0, TAU); c.stroke();
        this.text(fmtLy(r, T), cx + r * ppl * 0.71 + 4, cy + r * ppl * 0.71 + 4, C.faint, 9.5, 'left');
      }
      c.setLineDash([]);
      // the Sun
      c.fillStyle = C.sun;
      c.beginPath(); c.arc(cx, cy, 3, 0, TAU); c.fill();
      this.text(T.sun, cx + 7, cy + 9, C.dim, 10.5, 'left');
      // the object, projected onto the plane
      const [l, b] = this.gal, dp = this.ly * Math.cos(b * DEG);
      const [tx, ty] = P(dp * Math.cos(l * DEG), dp * Math.sin(l * DEG));
      const inside = tx > 10 && tx < this.w - 10 && ty > 10 && ty < this.h - 10;
      c.strokeStyle = 'rgba(189, 155, 108, 0.6)'; c.setLineDash([4, 3]);
      c.beginPath(); c.moveTo(cx, cy); c.lineTo(tx, ty); c.stroke(); c.setLineDash([]);
      if (inside) this.marker(tx, ty, this.name, fmtLy(this.ly, T));
      else this.edgeArrow(tx, ty, `${this.name} · ${fmtLy(this.ly, T)}`);
    }
  }

  sky.then((data) => { for (const f of figs) new Locator(f, data); }).catch(() => { for (const f of figs) f.hidden = true; });
})();
