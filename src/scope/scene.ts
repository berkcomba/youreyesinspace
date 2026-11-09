/**
 * The sky above the atmosphere, as a picture: surface brightness (V, linear, a 0-mag star = 1 per
 * arcsec²) on a W×H grid north up and east left, plus a list of point sources. The GPU adds the
 * atmosphere, the optics and the eye (gl.ts); this module only paints what is there.
 */
import type { Instrument } from './instruments';
import type { MoonSpot, SolarGeo, V3 } from './ephem';
import { raDecVec, vec } from './ephem';
import type { DiskLook, ScopeDeep, ScopeTarget } from './types';
import { fbm3, gauss, hashStr, noise3, rng } from './noise';

const DEG = Math.PI / 180;
const ARCSEC = 206_264.806;

/** a photograph / map: 8-bit sRGB RGBA, decoded when sampled */
export interface Raster { w: number; h: number; data: Uint8ClampedArray }
const LIN = Float32Array.from({ length: 256 }, (_, i) => { const s = i / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; });
export type Images = Map<string, Raster>;

export interface SceneInput {
  target: ScopeTarget;
  geo: SolarGeo | null;
  ins: Instrument;
  W: number;
  H: number;
  /** arcsec per pixel */
  scale: number;
  /** faintest star worth drawing */
  lim: number;
  images: Images;
  jd: number;
  visual: boolean;
}

export type Note = [string, Record<string, string | number>?];

export interface Scene {
  /** W*H*4, rgb surface brightness */
  sky: Float32Array;
  /** per star: x, y (px), flux, seed, r, g, b (Y = 1), 0 */
  stars: Float32Array;
  nStars: number;
  /** brightest extended surface brightness (eye adaptation) */
  peak: number;
  /** radio: brightest value after the beam */
  radioPeak: number;
  notes: Note[];
}

/* ------------------------------------------------------------------ colour */

/** linear RGB with luminance 1 for a B−V colour index */
export function bvRgb(bv: number): [number, number, number] {
  const b = Math.max(-0.4, Math.min(2.2, bv));
  const T = 4600 * (1 / (0.92 * b + 1.7) + 1 / (0.92 * b + 0.62));
  const t = T / 100;
  let r: number, g: number, bl: number;
  if (t <= 66) { r = 255; g = 99.47 * Math.log(t) - 161.12; bl = t <= 19 ? 0 : 138.52 * Math.log(t - 10) - 305.04; }
  else { r = 329.7 * (t - 60) ** -0.1332; g = 288.12 * (t - 60) ** -0.0755; bl = 255; }
  const lin = (c: number) => { const s = Math.max(0, Math.min(255, c)) / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
  return norm3([lin(r), lin(g), lin(bl)]);
}

const lum = (c: ArrayLike<number>) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
function norm3(c: [number, number, number]): [number, number, number] {
  const y = lum(c) || 1;
  return [c[0] / y, c[1] / y, c[2] / y];
}
const srgb = (r: number, g: number, b: number): [number, number, number] => {
  const l = (s: number) => (s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4);
  return [l(r), l(g), l(b)];
};

function sample(img: Raster, u: number, v: number, out: number[]): void {
  const x = (((u % 1) + 1) % 1) * img.w - 0.5, y = Math.max(0, Math.min(img.h - 1.001, v * img.h - 0.5));
  const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
  const xa = ((x0 % img.w) + img.w) % img.w, xb = (xa + 1) % img.w, ya = Math.max(0, y0), yb = Math.min(img.h - 1, y0 + 1);
  const d = img.data;
  for (let c = 0; c < 3; c++) {
    const p = (yy: number, xx: number) => LIN[d[(yy * img.w + xx) * 4 + c]];
    out[c] = (p(ya, xa) * (1 - fx) + p(ya, xb) * fx) * (1 - fy) + (p(yb, xa) * (1 - fx) + p(yb, xb) * fx) * fy;
  }
}

/* ------------------------------------------------------------------ painting */

type Shade = (x: number, y: number, out: number[]) => boolean;

class Canvas {
  readonly sky: Float32Array;
  stars: number[] = [];
  peak = 0;
  constructor(readonly W: number, readonly H: number, readonly s: number) {
    this.sky = new Float32Array(W * H * 4);
  }

  /** pixel centre → sky offset from the field centre, arcsec (+x west, +y north) */
  px(i: number): number { return (i + 0.5 - this.W / 2) * this.s; }
  py(j: number): number { return (this.H / 2 - j - 0.5) * this.s; }

  star(x: number, y: number, flux: number, rgb: [number, number, number], seed: number): void {
    const X = this.W / 2 + x / this.s, Y = this.H / 2 - y / this.s;
    const m = 400; // stars well off the field still throw light into it
    if (X < -m || X > this.W + m || Y < -m || Y > this.H + m || !(flux > 0)) return;
    this.stars.push(X, Y, flux, seed % 9973, rgb[0], rgb[1], rgb[2], 0);
  }

  /**
   * Paints an extended source given by `shade` (unnormalised surface brightness) inside a box of
   * half-size `ext` arcsec around (cx, cy), scaled so that it adds up to `flux`. Too small to be
   * resolved on this grid, it becomes a point source of the same colour.
   */
  extended(cx: number, cy: number, ext: number, flux: number, shade: Shade, seed = 1): void {
    if (!(flux > 0)) return;
    const c = [0, 0, 0];
    // normalisation over the whole object (it may overflow the field)
    const n = 96, step = (2 * ext) / n;
    let sy = 0, sr = 0, sg = 0, sb = 0;
    for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) {
      if (!shade(-ext + (a + 0.5) * step, -ext + (b + 0.5) * step, c)) continue;
      sr += c[0]; sg += c[1]; sb += c[2]; sy += lum(c);
    }
    if (!(sy > 0)) return;
    const k = flux / (sy * step * step);
    if (ext / this.s < 1.6) {
      this.star(cx, cy, flux, norm3([sr, sg, sb]), seed);
      return;
    }
    const sub = ext / this.s < 24 ? 3 : 1, w = 1 / (sub * sub);
    const i0 = Math.max(0, Math.floor((cx - ext) / this.s + this.W / 2)), i1 = Math.min(this.W - 1, Math.ceil((cx + ext) / this.s + this.W / 2));
    const j0 = Math.max(0, Math.floor(this.H / 2 - (cy + ext) / this.s)), j1 = Math.min(this.H - 1, Math.ceil(this.H / 2 - (cy - ext) / this.s));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      let r = 0, g = 0, b = 0;
      for (let u = 0; u < sub; u++) for (let v = 0; v < sub; v++) {
        const x = (i + (u + 0.5) / sub - this.W / 2) * this.s - cx, y = (this.H / 2 - j - (v + 0.5) / sub) * this.s - cy;
        if (!shade(x, y, c)) continue;
        r += c[0]; g += c[1]; b += c[2];
      }
      if (!r && !g && !b) continue;
      const o = (j * this.W + i) * 4;
      this.sky[o] += r * w * k; this.sky[o + 1] += g * w * k; this.sky[o + 2] += b * w * k;
      const yv = lum(this.sky.subarray(o, o + 3));
      if (yv > this.peak) this.peak = yv;
    }
  }
}

/* ------------------------------------------------------------------ the Solar System */

/** colour (linear, roughly the albedo) of a disk look */
const LOOK_RGB: Record<DiskLook, [number, number, number]> = {
  sun: [1, 1, 1], moon: srgb(0.62, 0.6, 0.57), mercury: srgb(0.66, 0.6, 0.55), venus: srgb(0.98, 0.95, 0.85),
  mars: srgb(0.8, 0.5, 0.33), jupiter: srgb(0.88, 0.82, 0.72), saturn: srgb(0.9, 0.83, 0.65),
  uranus: srgb(0.7, 0.88, 0.9), neptune: srgb(0.5, 0.66, 0.95), rock: srgb(0.6, 0.58, 0.55), ice: srgb(0.85, 0.86, 0.88),
  titan: srgb(0.85, 0.65, 0.35), io: srgb(0.92, 0.85, 0.5),
};

/** Jupiter's belts and zones: latitude (deg, planetographic) → [brightness, redness] */
function jupiterBand(lat: number, lon: number): [number, number] {
  const B: Array<[number, number, number, number]> = [
    // centre, half-width, darkening, redness
    [-14, 6.5, 0.42, 0.55], [12, 5.5, 0.38, 0.5], [27, 2.6, 0.22, 0.3], [-29, 2.8, 0.2, 0.3], [37, 2.2, 0.14, 0.2], [-38, 2.4, 0.14, 0.2],
  ];
  let d = 0, red = 0;
  const wob = (fbm3(lon / 25, lat / 3, 3.1, 3) - 0.5) * 3;
  for (const [c, hw, k, rr] of B) {
    const t = Math.exp(-(((lat + wob - c) / hw) ** 4));
    d += k * t * (0.8 + 0.4 * noise3(lon / 9, lat / 2, c));
    red += rr * t;
  }
  // polar regions darken and grey
  const pol = Math.max(0, (Math.abs(lat) - 42) / 40);
  d += 0.35 * pol;
  // Great Red Spot near 22°S
  const dl = ((((lon - 60) % 360) + 540) % 360) - 180;
  const grs = Math.exp(-((dl / 9) ** 2 + ((lat + 22.5) / 4.5) ** 2));
  red += 0.9 * grs;
  d += 0.1 * grs;
  // equatorial festoons
  if (Math.abs(lat - 7) < 4) d += 0.12 * Math.max(0, noise3(lon / 5, lat / 2, 9) - 0.55) * 4;
  return [Math.max(0.2, 1 - d), Math.min(1, red)];
}

function saturnBand(lat: number): number {
  return 1 - 0.12 * Math.exp(-(((lat - 22) / 6) ** 2)) - 0.1 * Math.exp(-(((lat + 20) / 7) ** 2)) - 0.25 * Math.max(0, (Math.abs(lat) - 55) / 35);
}

/** Saturn's ring brightness and opacity at a radius in km */
function saturnRing(rkm: number): [number, number] {
  if (rkm < 74_500 || rkm > 136_800) return [0, 0];
  if (rkm < 92_000) return [0.18, 0.12]; // C ring
  if (rkm < 117_580) return [0.9 + 0.1 * Math.sin(rkm / 900), 0.9]; // B ring
  if (rkm < 122_170) return [0.08, 0.1]; // Cassini division
  if (rkm > 133_400 && rkm < 133_730) return [0, 0]; // Encke gap
  return [0.62, 0.55]; // A ring
}

function paintSolar(cv: Canvas, inp: SceneInput, notes: Note[]): void {
  const t = inp.target;
  if (t.kind !== 'solar') return;
  const g = inp.geo!;
  const p = t.primary;
  const look = p.look;
  const { E, N, n } = g.basis;
  const W = vec.scale(E, -1);
  const R = g.diam / 2;
  const kmPerArc = g.dist / ARCSEC;
  const cx = -g.center[0], cy = -g.center[1];
  const tint = LOOK_RGB[look];
  const map = look === 'moon' ? inp.images.get('moon') : look === 'mars' ? inp.images.get('mars') : undefined;
  const Z = g.axes?.Z ?? null;
  const flat = look === 'jupiter' ? 0.0649 : look === 'saturn' ? 0.098 : look === 'uranus' ? 0.023 : look === 'neptune' ? 0.017 : 0;
  // projected pole on the sky, for the oblate outline
  let qx = 0, qy = 1, L2 = 0;
  if (Z) {
    const zx = vec.dot(Z, W), zy = vec.dot(Z, N), l = Math.hypot(zx, zy);
    if (l > 1e-6) { qx = zx / l; qy = zy / l; }
    L2 = l * l;
  }
  const squash = 1 - flat * L2;
  const sun = g.sun;
  const rings = look === 'saturn' && p.rings && Z ? p.rings : null;
  const nZ = Z ? vec.dot(n, Z) : 0;
  const ringsLit = Z ? Math.sign(vec.dot(sun, Z)) === Math.sign(-nZ) : true;
  const tmp = [0, 0, 0];
  const P: V3 = [0, 0, 0];

  // sunspots: a new set every Carrington rotation, latitudes of a declining cycle
  const spots: Array<[V3, number]> = [];
  if (look === 'sun' && g.axes) {
    const r = rng(Math.floor((inp.jd - 2_398_140) / 27.2753));
    const nGroups = 3 + Math.floor(r() * 6);
    for (let k = 0; k < nGroups; k++) {
      const lat = (r() < 0.5 ? -1 : 1) * (6 + r() * 20) * DEG, lon = r() * 2 * Math.PI;
      const members = 1 + Math.floor(r() * 5);
      for (let m = 0; m < members; m++) {
        const la = lat + gauss(r) * 1.2 * DEG, lo = lon + gauss(r) * 3 * DEG;
        const { X, Y, Z: Zs } = g.axes;
        const v = vec.add(vec.add(vec.scale(X, Math.cos(la) * Math.cos(lo)), vec.scale(Y, Math.cos(la) * Math.sin(lo))), vec.scale(Zs, Math.sin(la)));
        // 1 − cos of the spot's angular radius: a leader of ~25 000 km, smaller followers
        spots.push([v, (m === 0 ? 1 : 0.15 + 0.4 * r()) * 6e-4]);
      }
    }
  }

  /** disk only, at unit-disk coordinates; false off the disk */
  const disk = (u0: number, v0: number, out: number[]): boolean => {
    // undo the oblateness along the projected pole
    const s = u0 * qx + v0 * qy, tt = u0 * -qy + v0 * qx;
    const s2 = s / squash;
    const u = s2 * qx - tt * qy, v = s2 * qy + tt * qx;
    const rr = u * u + v * v;
    if (rr > 1) return false;
    const w = Math.sqrt(1 - rr);
    P[0] = u * W[0] + v * N[0] - w * n[0]; P[1] = u * W[1] + v * N[1] - w * n[1]; P[2] = u * W[2] + v * N[2] - w * n[2];
    const mu = w, mu0 = vec.dot(P, sun);
    if (look === 'sun') {
      const ld = (k: number) => 1 - k * (1 - mu);
      let f = 1;
      for (const [c, size] of spots) {
        const d = 1 - vec.dot(P, c);
        if (d < size * 2.6) f *= d < size ? 0.25 : 0.65 + 0.35 * Math.min(1, (d - size) / (size * 1.6));
      }
      // faculae: bright mottling seen near the limb
      const fac = 1 + 0.08 * (1 - mu) ** 2 * Math.max(0, noise3(P[0] * 40, P[1] * 40, P[2] * 40) - 0.4) * 3;
      out[0] = ld(0.47) * f * fac; out[1] = ld(0.58) * f * fac; out[2] = ld(0.72) * f * fac;
      return true;
    }
    let lat = 0, lon = 0;
    if (g.axes) {
      lat = Math.asin(Math.max(-1, Math.min(1, vec.dot(P, g.axes.Z)))) / DEG;
      lon = Math.atan2(vec.dot(P, g.axes.Y), vec.dot(P, g.axes.X)) / DEG;
    }
    let alb0 = tint[0], alb1 = tint[1], alb2 = tint[2];
    if (map) {
      sample(map, lon / 360 + 0.5, 0.5 - lat / 180, tmp);
      if (look === 'moon') { alb0 = alb1 = alb2 = tmp[0] * 1.6; alb0 *= 1.04; alb2 *= 0.94; }
      else { alb0 = tmp[0] * 1.3; alb1 = tmp[1] * 1.3; alb2 = tmp[2] * 1.3; }
    } else if (look === 'jupiter') {
      const [b, red] = jupiterBand(lat, lon);
      alb0 *= b * (1 + 0.12 * red); alb1 *= b * (1 - 0.1 * red); alb2 *= b * (1 - 0.3 * red);
    } else if (look === 'saturn') {
      const b = saturnBand(lat);
      alb0 *= b; alb1 *= b; alb2 *= b * (0.92 + 0.08 * b);
    } else if (look === 'mercury' || look === 'rock' || look === 'ice') {
      const b = 0.8 + 0.4 * fbm3(P[0] * 3 + 5, P[1] * 3, P[2] * 3, 4);
      alb0 *= b; alb1 *= b; alb2 *= b;
    }
    if (mu0 <= 0) {
      // the night side: earthshine on the Moon, nothing elsewhere
      if (look !== 'moon') { out[0] = out[1] = out[2] = 0; return true; }
      const es = 1.5e-4 * (1 + Math.cos(g.phase * DEG)) * 0.5 + 6e-5;
      out[0] = alb0 * es * 0.9; out[1] = alb1 * es; out[2] = alb2 * es * 1.15;
      return true;
    }
    let f: number;
    if (look === 'moon' || look === 'mercury' || look === 'rock' || look === 'ice' || look === 'io') f = mu0 / (mu0 + mu); // Lommel–Seeliger
    else if (look === 'mars') f = 0.6 * mu0 / (mu0 + mu) + 0.25 * mu0;
    else {
      const k = look === 'venus' ? 0.72 : look === 'jupiter' || look === 'saturn' ? 0.9 : 0.85; // Minnaert
      f = mu0 ** k * Math.max(mu, 0.02) ** (k - 1) * 0.5;
    }
    // soft terminator (the atmosphere / the rough surface)
    f *= Math.min(1, mu0 * (look === 'venus' ? 6 : 30));
    out[0] = alb0 * f; out[1] = alb1 * f; out[2] = alb2 * f;
    if (look === 'mars') { const h = 0.12 * (1 - mu) ** 3 * mu0 ** 0.5; out[0] += h * 0.5; out[1] += h * 0.6; out[2] += h; }
    // the shadow of Saturn's rings on the globe
    if (rings && Z) {
      const S = vec.scale(P, p.radius);
      const sz = vec.dot(sun, Z);
      if (Math.abs(sz) > 1e-4) {
        const k = -vec.dot(S, Z) / sz;
        if (k > 0) {
          const rr2 = vec.len(vec.add(S, vec.scale(sun, k)));
          const [, op] = saturnRing(rr2);
          if (op > 0) { out[0] *= 1 - op * 0.85; out[1] *= 1 - op * 0.85; out[2] *= 1 - op * 0.85; }
        }
      }
    }
    return true;
  };

  /** the full picture in arcsec around the primary: disk and rings */
  const shade: Shade = (x, y, out) => {
    const onDisk = disk(x / R, y / R, out);
    if (!rings || !Z || Math.abs(nZ) < 1e-3) return onDisk;
    // the line of sight through this point meets the ring plane at distance k (km) along n
    const Q = vec.add(vec.scale(W, x * kmPerArc), vec.scale(N, y * kmPerArc));
    const k = -vec.dot(Q, Z) / nZ;
    const Rp = vec.add(Q, vec.scale(n, k));
    const rkm = vec.len(Rp);
    const [br, op] = saturnRing(rkm);
    if (!br && !op) return onDisk;
    // in front of the globe (k < 0: nearer the Earth), or behind it and hidden
    if (onDisk && k > 0) return true;
    // the globe's shadow on the rings
    const sp = vec.dot(Rp, sun);
    const dperp = Math.sqrt(Math.max(0, rkm * rkm - sp * sp));
    const shadow = sp < 0 && dperp < p.radius ? 0.05 : 1;
    const ringB = br * (ringsLit ? 0.55 : 0.06) * shadow * Math.abs(vec.dot(sun, Z)) ** 0.25;
    const rc = [0.95, 0.88, 0.74];
    if (onDisk) {
      out[0] = out[0] * (1 - op) + ringB * rc[0]; out[1] = out[1] * (1 - op) + ringB * rc[1]; out[2] = out[2] * (1 - op) + ringB * rc[2];
    } else {
      out[0] = ringB * rc[0]; out[1] = ringB * rc[1]; out[2] = ringB * rc[2];
    }
    return true;
  };

  const ext = rings ? (rings.outer / kmPerArc) * 1.02 : R * 1.01;
  // the Sun only through a full-aperture filter (~10⁻⁵)
  cv.extended(cx, cy, ext, 10 ** (-0.4 * g.mag) * (look === 'sun' ? 1e-5 : 1), shade, hashStr(p.id));

  // moons around the primary
  for (const m of g.moons) {
    if (m.hidden || m.front) continue;
    paintMoon(cv, m, cx, cy, sun, g, t.moons.find((b) => b.id === m.id)?.look ?? 'rock');
  }
  if (look === 'sun') notes.push(['nFilter']);
  else if (g.elong < 12) notes.push(['nGlare', { e: Math.round(g.elong) }]);
}

function paintMoon(cv: Canvas, m: MoonSpot, cx: number, cy: number, sun: V3, g: SolarGeo, look: DiskLook): void {
  const flux = 10 ** (-0.4 * m.mag);
  const col = LOOK_RGB[look] ?? LOOK_RGB.rock;
  const R = m.diam / 2;
  const { E, N, n } = g.basis;
  const W = vec.scale(E, -1);
  cv.extended(cx + m.x, cy + m.y, R * 1.01, flux, (x, y, out) => {
    const u = x / R, v = y / R, rr = u * u + v * v;
    if (rr > 1) return false;
    const w = Math.sqrt(1 - rr);
    const P: V3 = [u * W[0] + v * N[0] - w * n[0], u * W[1] + v * N[1] - w * n[1], u * W[2] + v * N[2] - w * n[2]];
    const mu0 = vec.dot(P, sun);
    const f = mu0 > 0 ? mu0 / (mu0 + w) : 0;
    out[0] = col[0] * f; out[1] = col[1] * f; out[2] = col[2] * f;
    return true;
  }, hashStr(m.id));
}

/* ------------------------------------------------------------------ deep sky */

const GAL: number[][] = [[-0.0548755604, -0.8734370902, -0.4838350155], [0.4941094279, -0.44482963, 0.7469822445], [-0.867666149, -0.1980763734, 0.4559837762]];
function galacticLat(ra: number, dec: number): number {
  const v = raDecVec(ra, dec);
  return Math.asin(Math.max(-1, Math.min(1, GAL[2][0] * v[0] + GAL[2][1] * v[1] + GAL[2][2] * v[2]))) / DEG;
}

/** stars per square degree brighter than m (an average sky) */
const logN = (m: number) => (m <= 12 ? -0.7 + 0.43 * (m - 6) : m <= 18 ? 1.88 + 0.35 * (m - 12) : 3.98 + 0.25 * (m - 18));
const invLogN = (l: number) => (l <= 1.88 ? 6 + (l + 0.7) / 0.43 : l <= 3.98 ? 12 + (l - 1.88) / 0.35 : 18 + (l - 3.98) / 0.25);

function fieldStars(cv: Canvas, seed: number, ra: number, dec: number, lim: number, boost = 1): void {
  const b = galacticLat(ra, dec);
  const dens = (0.6 + 3.2 * Math.exp(-Math.abs(b) / 12)) * boost;
  const wDeg = (cv.W * cv.s) / 3600 + 0.1, hDeg = (cv.H * cv.s) / 3600 + 0.1;
  const nMax = 10 ** logN(Math.min(lim, 24)) * dens;
  const n = Math.min(2600, Math.round(nMax * wDeg * hDeg));
  const r = rng(seed ^ 0x5bd1e995);
  for (let k = 0; k < n; k++) {
    const m = invLogN(Math.log10(Math.max(1e-9, r() * nMax / dens)));
    const x = (r() - 0.5) * wDeg * 3600, y = (r() - 0.5) * hDeg * 3600;
    cv.star(x, y, 10 ** (-0.4 * Math.max(m, -1)), bvRgb(0.65 + gauss(r) * 0.38), Math.floor(r() * 9973));
  }
}

const S_BULGE = srgb(1.0, 0.88, 0.72), S_DISK = srgb(0.84, 0.88, 1.0);

function paintGalaxy(cv: Canvas, t: ScopeDeep, visual: boolean): void {
  const R = Math.max(t.size / 2, cv.s);
  let q = Math.max(0.12, t.axis ?? 1);
  const pa = (t.pa ?? 0) * DEG;
  const type = t.galType ?? 'S';
  const flux = 10 ** (-0.4 * t.mag);
  const sp = Math.sin(pa), cp = Math.cos(pa);
  const lane = t.special === 'cena';
  if (lane) q = 0.82;
  const elliptical = type === 'E' || lane;
  const Re = elliptical ? R / 2.8 : R * 0.1;
  const qb = elliptical ? q : Math.max(q, 0.62);
  const h = R / 3.2;
  const BT = elliptical ? 1 : type === 'S0' ? 0.55 : type === 'Irr' ? 0 : 0.22;
  const Ib = BT / (22.66 * Re * Re * qb), Id = (1 - BT) / (2 * Math.PI * h * h * q);
  const pitch = Math.tan(16 * DEG);
  const seed = hashStr(t.name) % 1000;
  const minR = cv.s * 0.5;
  const lanePa = 122 * DEG, ls = Math.sin(lanePa), lc = Math.cos(lanePa);
  cv.extended(0, 0, R * 1.6, flux, (x, y, out) => {
    const a = -x * sp + y * cp, b = x * cp + y * sp;
    const rb = Math.max(minR, Math.hypot(a, b / qb));
    const bulge = BT > 0 ? Ib * Math.exp(-7.669 * ((rb / Re) ** 0.25 - 1)) : 0;
    let disk = 0;
    if (BT < 1) {
      const rd = Math.max(minR, Math.hypot(a, b / q));
      disk = Id * Math.exp(-rd / h);
      if (type === 'S' || type === 'SB') {
        const th = Math.atan2(b / q, a);
        const ph = 2 * (th - Math.log(rd / h + 0.05) / pitch);
        const arm = Math.cos(ph);
        const on = Math.min(1, Math.max(0, (rd / h - 0.4)));
        disk *= 1 + 0.7 * arm * on * (0.7 + 0.6 * noise3(a / h * 2, b / q / h * 2, seed));
        // dust on the inner edge of the arms, star-forming knots along their crests
        disk *= 1 - 0.45 * on * Math.max(0, Math.cos(ph - 0.9)) ** 6;
        disk *= 1 + 1.6 * on * Math.max(0, arm) ** 3 * Math.max(0, noise3(a / h * 9, b / q / h * 9, seed + 7) - 0.15) * 2;
        if (type === 'SB') disk += Id * 0.9 * Math.exp(-((a / (0.45 * h * 2.2)) ** 2 + (b / (0.12 * h * 2.2)) ** 2) * 2);
        if (q < 0.4) disk *= 1 - 0.65 * Math.exp(-(((b - 0.03 * R) / (0.05 * R)) ** 2)) * Math.min(1, rd / (0.15 * R));
      } else if (type === 'Irr') {
        disk *= 0.35 + 1.3 * fbm3(a / h * 1.6, b / q / h * 1.6, seed, 4) ** 2;
      }
    }
    // fade out before the edge of the painted box
    const re = Math.hypot(a, b / q) / R;
    let f = re < 1.15 ? 1 : Math.max(0, 1 - (re - 1.15) / 0.4) ** 2;
    if (lane) {
      const la = -x * ls + y * lc, lb = x * lc + y * ls;
      f *= 1 - 0.85 * Math.exp(-(((lb + 0.02 * R) / (0.075 * R)) ** 2)) * Math.exp(-((la / (0.62 * R)) ** 6)) * (0.75 + 0.5 * noise3(la / R * 8, lb / R * 8, 3));
    }
    const blue = visual ? 0.6 : 1;
    out[0] = (bulge * S_BULGE[0] + disk * (S_DISK[0] + (1 - blue) * 0.2)) * f;
    out[1] = (bulge * S_BULGE[1] + disk * S_DISK[1]) * f;
    out[2] = (bulge * S_BULGE[2] + disk * S_DISK[2] * blue) * f;
    return bulge + disk > 0;
  }, seed);
  if (t.special === 'm87') {
    // the jet: ~20″ to the west-north-west, a knotty thread of synchrotron light
    const jp = 290 * DEG, js = Math.sin(jp), jc = Math.cos(jp);
    cv.extended(0, 0, 24, flux * 0.0025, (x, y, out) => {
      const a = -x * js + y * jc, b = x * jc + y * js;
      if (a < 0.5 || a > 21) return false;
      const v = Math.exp(-((b / 0.45) ** 2)) * (0.4 + Math.exp(-(((a - 12) / 1.2) ** 2)) + 0.6 * Math.exp(-(((a - 17) / 1.5) ** 2)) + 0.5 * Math.exp(-(((a - 2.5) / 1) ** 2)));
      out[0] = v * 0.9; out[1] = v; out[2] = v * 1.2;
      return v > 0;
    }, 87);
  }
}

function paintGlobular(cv: Canvas, t: ScopeDeep, lim: number): void {
  const rt = Math.max(t.size / 2, cv.s * 2), rc = rt / 22;
  const flux = 10 ** (-0.4 * t.mag);
  const r = rng(hashStr(t.name));
  // resolved members: the red-giant tip ~6 mag below the integrated light
  const tip = t.mag + 6.1;
  const deepest = Math.min(lim + 0.4, tip + 7.5);
  let resolved = 0;
  if (deepest > tip) {
    const n = Math.min(3200, Math.round(22 * 10 ** (0.32 * (deepest - tip))));
    // projected King profile, sampled by rejection
    const king = (x: number) => (1 / Math.sqrt(1 + (x / rc) ** 2) - 1 / Math.sqrt(1 + (rt / rc) ** 2)) ** 2;
    const k0 = king(0);
    for (let k = 0, guard = 0; k < n && guard < n * 40; guard++) {
      const rr = rt * Math.sqrt(r());
      if (r() * k0 > king(rr) * Math.max(1, (rr / rc))) continue;
      const th = r() * 2 * Math.PI;
      const m = tip + Math.log10(Math.max(1e-6, (r() * (10 ** (0.32 * (deepest - tip)) - 1) + 1))) / 0.32;
      const dm = m - tip;
      const bv = dm < 1.5 ? 1.25 + 0.3 * r() : dm > 2.7 && dm < 3.3 && r() < 0.35 ? 0.1 + 0.2 * r() : 0.7 + 0.25 * r();
      const f = 10 ** (-0.4 * m);
      resolved += f;
      cv.star(rr * Math.cos(th), rr * Math.sin(th), f, bvRgb(bv), Math.floor(r() * 9973));
      k++;
    }
  }
  const glow = Math.max(flux * 0.3, flux - resolved);
  const king = (x: number) => Math.max(0, 1 / Math.sqrt(1 + (x / rc) ** 2) - 1 / Math.sqrt(1 + (rt / rc) ** 2)) ** 2;
  const c = bvRgb(0.72);
  cv.extended(0, 0, rt, glow, (x, y, out) => {
    const v = king(Math.hypot(x, y));
    out[0] = v * c[0]; out[1] = v * c[1]; out[2] = v * c[2];
    return v > 0;
  });
}

function paintOpen(cv: Canvas, t: ScopeDeep, lim: number): void {
  const R = Math.max(t.size / 2, cv.s * 4);
  const r = rng(hashStr(t.name));
  const top = t.mag + 1.6;
  const deepest = Math.min(lim + 0.4, top + 11);
  if (deepest <= top) return;
  const n = Math.min(1500, Math.round(4 * 10 ** (0.24 * (deepest - top))));
  for (let k = 0; k < n; k++) {
    const m = top + Math.log10(r() * (10 ** (0.24 * (deepest - top)) - 1) + 1) / 0.24;
    const rr = R * 0.45 * Math.abs(gauss(r)) * (k < 8 ? 0.6 : 1), th = r() * 2 * Math.PI;
    const dm = m - top;
    const bv = dm < 0.8 && r() < 0.25 ? 1.1 + r() * 0.4 : -0.12 + dm * 0.09 + gauss(r) * 0.08;
    cv.star(rr * Math.cos(th), rr * Math.sin(th), 10 ** (-0.4 * m), bvRgb(bv), Math.floor(r() * 9973));
  }
}

function paintPhoto(cv: Canvas, t: ScopeDeep, img: Raster, visual: boolean): void {
  const span = t.imgSpan!;
  // background: a low percentile per channel
  const bg = [0, 0, 0];
  for (let c = 0; c < 3; c++) {
    const vals: number[] = [];
    for (let k = c; k < img.data.length; k += 4 * 7) vals.push(LIN[img.data[k]]);
    vals.sort((a, b) => a - b);
    bg[c] = vals[Math.floor(vals.length * 0.25)] ?? 0;
  }
  const tmp = [0, 0, 0];
  const red = visual && t.kind !== 'galaxy' ? 0.42 : 1;
  cv.extended(0, 0, span / 2, 10 ** (-0.4 * t.mag), (x, y, out) => {
    const u = 0.5 + x / span, v = 0.5 - y / span;
    if (u < 0 || u > 1 || v < 0 || v > 1) return false;
    sample(img, u, v, tmp);
    // fade the frame's edges so it does not show as a square
    const e = Math.min(u, 1 - u, v, 1 - v);
    const fade = Math.min(1, e / 0.08);
    out[0] = Math.max(0, tmp[0] - bg[0]) * red * fade;
    out[1] = Math.max(0, tmp[1] - bg[1]) * fade;
    out[2] = Math.max(0, tmp[2] - bg[2]) * fade;
    return true;
  }, hashStr(t.name));
}

function paintNebula(cv: Canvas, t: ScopeDeep, visual: boolean): void {
  const R = Math.max(t.size / 2, cv.s * 2);
  const seed = hashStr(t.name) % 1000;
  const q = t.axis ?? 0.85, pa = (t.pa ?? 30) * DEG, sp = Math.sin(pa), cp = Math.cos(pa);
  const flux = 10 ** (-0.4 * t.mag);
  const oiii = srgb(0.55, 1.0, 0.85), ha = visual ? srgb(0.75, 0.62, 0.7) : srgb(1.0, 0.45, 0.55), snr = srgb(0.85, 0.85, 1.0);
  cv.extended(0, 0, R * 1.2, flux, (x, y, out) => {
    const a = -x * sp + y * cp, b = x * cp + y * sp;
    const rr = Math.hypot(a, b / q) / R;
    let v: number, c: [number, number, number];
    if (t.kind === 'pn') {
      v = Math.exp(-(((rr - 0.62) / 0.2) ** 2)) * (0.85 + 0.3 * noise3(a / R * 5, b / R * 5, seed)) + 0.25 * Math.exp(-((rr / 0.55) ** 2));
      c = oiii;
    } else if (t.kind === 'snr') {
      v = Math.exp(-(((rr - 0.85) / 0.1) ** 2)) * Math.max(0, fbm3(a / R * 4, b / R * 4, seed, 5) - 0.35) * 3;
      c = snr;
    } else {
      v = Math.exp(-(rr * rr) * 2.2) * (0.25 + fbm3(a / R * 2.5, b / R * 2.5, seed, 5)) ** 2.2;
      c = ha;
    }
    out[0] = v * c[0]; out[1] = v * c[1]; out[2] = v * c[2];
    return v > 0;
  }, seed);
  if (t.kind === 'pn' && t.size > 8) cv.star(0, 0, flux * 0.03, bvRgb(-0.3), 7);
}

function paintDeep(cv: Canvas, inp: SceneInput, notes: Note[]): void {
  const t = inp.target as ScopeDeep;
  const seed = hashStr(t.name);
  const img = t.img ? inp.images.get(t.img) : undefined;
  switch (t.kind) {
    case 'star': case 'pulsar':
      cv.star(0, 0, 10 ** (-0.4 * t.mag), bvRgb(t.bv ?? (t.kind === 'pulsar' ? 0 : 0.65)), seed % 9973);
      break;
    case 'galaxy':
      paintGalaxy(cv, t, inp.visual);
      break;
    case 'globular':
      paintGlobular(cv, t, inp.lim);
      break;
    case 'open':
      paintOpen(cv, t, inp.lim);
      break;
    case 'bh':
      if (t.special === 'sgra') notes.push(['nDust']);
      break;
    default:
      if (img && t.imgSpan) paintPhoto(cv, t, img, inp.visual);
      else paintNebula(cv, t, inp.visual);
      if (t.special === 'crab') cv.star(0, 0, 10 ** (-0.4 * 16.5), bvRgb(0.3), 31);
  }
  fieldStars(cv, seed, t.ra, t.dec, inp.lim, t.special === 'sgra' ? 6 : 1);
}

/* ------------------------------------------------------------------ radio */

type RadioFn = (x: number, y: number) => number;

function radioModel(inp: SceneInput, cv: Canvas, notes: Note[]): RadioFn | null {
  const t = inp.target;
  const ins = inp.ins;
  const cm = (ins.lambda ?? 0.21) > 0.01;
  const eht = ins.id === 'eht';
  if (t.kind === 'solar') {
    const g = inp.geo!;
    const R = g.diam / 2, cx = -g.center[0], cy = -g.center[1];
    const id = t.primary.id;
    const fbmSeed = hashStr(id) % 100;
    if (id === 'sun') {
      const r = rng(Math.floor(inp.jd / 27.3));
      const ar: Array<[number, number]> = Array.from({ length: 5 }, () => [(r() - 0.5) * 1.4 * R, (r() - 0.5) * 0.8 * R]);
      return (x, y) => {
        const d = Math.hypot(x - cx, y - cy) / R;
        let v = cm ? (d < 1 ? 1 : Math.exp(-(d - 1) / 0.32)) * (d < 1.6 ? 1 : 0.3) : d < 1 ? 0.9 + 0.1 * d * d + 0.08 * fbm3(x / R * 9, y / R * 9, 2) : d < 1.02 ? 1 : 0;
        if (cm) for (const [ax, ay] of ar) v += 1.4 * Math.exp(-(((x - cx - ax) ** 2 + (y - cy - ay) ** 2) / (0.06 * R * R)));
        return v;
      };
    }
    const jup = id === 'jupiter' && cm;
    const axes = g.axes;
    let ex = 1, ey = 0;
    if (axes) {
      const W = vec.scale(g.basis.E, -1), zx = vec.dot(axes.Z, W), zy = vec.dot(axes.Z, g.basis.N), l = Math.hypot(zx, zy) || 1;
      ex = zy / l; ey = -zx / l;
    }
    const base: RadioFn = (x, y) => {
      const d = Math.hypot(x - cx, y - cy) / R;
      let v = d < 1 ? 1 - 0.12 * d * d : 0;
      if (jup) {
        const a = ((x - cx) * ex + (y - cy) * ey) / R, b = ((x - cx) * -ey + (y - cy) * ex) / R;
        v = v * 0.35 + 1.1 * (Math.exp(-(((Math.abs(a) - 1.55) / 0.42) ** 2 + (b / 0.4) ** 2))) + 0.25 * Math.exp(-((a / 1.5) ** 2 + (b / 0.55) ** 2));
      }
      return v * (1 + 0.04 * fbmSeed / 100);
    };
    return base;
  }
  const d = t as ScopeDeep;
  const R = Math.max(d.size / 2, 1e-6);
  const seed = hashStr(d.name) % 1000;
  const img = d.img ? inp.images.get(d.img) : undefined;
  const tmp = [0, 0, 0];
  const point = (flux: number, sigma = 0): RadioFn => (x, y) => {
    const s = Math.max(sigma, cv.s * 0.7);
    return (flux * Math.exp(-(x * x + y * y) / (2 * s * s))) / (2 * Math.PI * s * s);
  };
  if ((d.special === 'sgra' || d.special === 'm87') && eht) {
    // the shadow: a bright ring of lensed light, brighter where the gas comes towards us
    const ring = d.special === 'sgra' ? 52e-6 / 2 : 42e-6 / 2;
    const bright = d.special === 'sgra' ? 200 * DEG : 180 * DEG;
    return (x, y) => {
      const r = Math.hypot(x, y), th = Math.atan2(-x, y);
      const v = Math.exp(-(((r - ring) / (ring * 0.28)) ** 2)) * (1 + 0.65 * Math.cos(th - bright));
      return v + 0.08 * Math.exp(-((r / ring) ** 2));
    };
  }
  if (d.special === 'sgra') {
    const core = point(1);
    // Sgr A West, the "mini-spiral" of ionised gas, ~1.5′ across
    return (x, y) => {
      const r = Math.hypot(x, y) / 45, th = Math.atan2(y, x);
      const arm = Math.exp(-(((r - 0.25 - 0.35 * ((th + Math.PI) / (2 * Math.PI))) / 0.08) ** 2)) * Math.exp(-r * r * 1.5);
      return core(x, y) + 2e-4 * arm + 4e-5 * Math.exp(-((Math.hypot(x, y) / 200) ** 2));
    };
  }
  if (d.kind === 'bh') {
    if (eht) notes.push(['nEht']);
    return point(1);
  }
  if (eht) { notes.push(['nEht']); return (x, y) => 1 + 0 * x * y; }
  switch (d.kind) {
    case 'star': case 'open': case 'globular':
      notes.push(['nRadioDark']);
      return null;
    case 'pulsar':
      return point(1);
    case 'galaxy': {
      if (d.special === 'm87') {
        const jp = 290 * DEG, js = Math.sin(jp), jc = Math.cos(jp);
        const core = point(1);
        return (x, y) => {
          const a = -x * js + y * jc, b = x * jc + y * js;
          const jet = a > 0 && a < 22 ? Math.exp(-((b / 0.6) ** 2)) * (0.3 + Math.exp(-(((a - 12) / 1.5) ** 2))) * 0.02 : 0;
          return core(x, y) + jet + 1.5e-4 * Math.exp(-((Math.hypot(x, y) / 110) ** 2)) * (0.6 + 0.8 * fbm3(x / 60, y / 60, 4));
        };
      }
      if (d.special === 'cena') {
        const lp = 55 * DEG, ls = Math.sin(lp), lc = Math.cos(lp);
        const core = point(1);
        return (x, y) => {
          const a = -x * ls + y * lc, b = x * lc + y * ls;
          const inner = Math.exp(-(((Math.abs(a) - 260) / 110) ** 2 + (b / 90) ** 2));
          const giant = Math.exp(-(((Math.abs(a) - 9000) / 3500) ** 2 + (b / 3000) ** 2)) * 0.02;
          return core(x, y) + 5e-3 * inner * (0.7 + 0.6 * fbm3(a / 80, b / 80, 2)) + 5e-3 * giant;
        };
      }
      if (d.galType === 'E' || d.galType === 'S0') {
        notes.push(['nRadioDark']);
        return null;
      }
      const q = Math.max(0.15, d.axis ?? 1), pa = (d.pa ?? 0) * DEG, sp = Math.sin(pa), cp = Math.cos(pa);
      // neutral hydrogen: a disk twice the stars' size, thin in the middle
      return (x, y) => {
        const a = -x * sp + y * cp, b = x * cp + y * sp;
        const r = Math.hypot(a, b / q) / R;
        return Math.exp(-r / 0.6) * (1 - 0.65 * Math.exp(-((r / 0.28) ** 2))) * (0.65 + 0.7 * fbm3(a / R * 3, b / q / R * 3, seed, 4));
      };
    }
    case 'snr': {
      if (d.special === 'crab') {
        const psr = point(0.02);
        return (x, y) => {
          const r = Math.hypot(x / 1.0, y / 0.72) / R;
          return (r < 1 ? (1 - r * r) ** 0.6 * (0.7 + 0.6 * fbm3(x / R * 4, y / R * 4, 5, 4)) : 0) * 1e-3 + psr(x, y);
        };
      }
      return (x, y) => {
        const r = Math.hypot(x, y) / R;
        return Math.exp(-(((r - 0.78) / 0.12) ** 2)) * (0.4 + 1.2 * fbm3(x / R * 5, y / R * 5, seed, 4) ** 1.5);
      };
    }
    default: {
      // ionised gas (HII regions, planetary nebulae): free–free emission follows the Hα light
      if (img && d.imgSpan) {
        const span = d.imgSpan;
        return (x, y) => {
          const u = 0.5 + x / span, v = 0.5 - y / span;
          if (u < 0 || u > 1 || v < 0 || v > 1) return 0;
          sample(img, u, v, tmp);
          return Math.max(0, tmp[0] * 0.8 + tmp[1] * 0.2 - 0.03);
        };
      }
      return (x, y) => Math.exp(-((Math.hypot(x, y) / (R * 0.7)) ** 2));
    }
  }
}

/** a coarse blur of the painted map by a Gaussian (arcsec), to know the brightest beam */
function blurredPeak(src: Float32Array, W: number, H: number, s: number, sigma: number, las: number | undefined): number {
  const f = Math.max(1, Math.ceil(Math.max(W, H) / 160));
  const w = Math.ceil(W / f), h = Math.ceil(H / f);
  const a = new Float32Array(w * h);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) a[Math.floor(j / f) * w + Math.floor(i / f)] += src[(j * W + i) * 4] / (f * f);
  const blur = (img: Float32Array, sg: number): Float32Array => {
    const sp = sg / (s * f);
    if (sp < 0.3) return img;
    const rad = Math.min(60, Math.ceil(sp * 3));
    const k = Array.from({ length: 2 * rad + 1 }, (_, i) => Math.exp(-((i - rad) ** 2) / (2 * sp * sp)));
    const ks = k.reduce((x, y) => x + y, 0);
    const t1 = new Float32Array(w * h), t2 = new Float32Array(w * h);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      let v = 0;
      for (let d = -rad; d <= rad; d++) { const ii = Math.min(w - 1, Math.max(0, i + d)); v += img[j * w + ii] * k[d + rad]; }
      t1[j * w + i] = v / ks;
    }
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      let v = 0;
      for (let d = -rad; d <= rad; d++) { const jj = Math.min(h - 1, Math.max(0, j + d)); v += t1[jj * w + i] * k[d + rad]; }
      t2[j * w + i] = v / ks;
    }
    return t2;
  };
  const b = blur(a, sigma);
  const big = las ? blur(a, las / 2.355) : null;
  let peak = 0;
  for (let k = 0; k < b.length; k++) peak = Math.max(peak, b[k] - (big ? big[k] : 0));
  return peak;
}

function paintRadio(cv: Canvas, inp: SceneInput, notes: Note[]): number {
  const fn = radioModel(inp, cv, notes);
  if (!fn) return 0;
  const sub = 2;
  for (let j = 0; j < cv.H; j++) for (let i = 0; i < cv.W; i++) {
    let v = 0;
    for (let u = 0; u < sub; u++) for (let w = 0; w < sub; w++) v += fn((i + (u + 0.5) / sub - cv.W / 2) * cv.s, (cv.H / 2 - j - (w + 0.5) / sub) * cv.s);
    const o = (j * cv.W + i) * 4;
    cv.sky[o] = cv.sky[o + 1] = cv.sky[o + 2] = Math.max(0, v / (sub * sub));
  }
  const beam = inp.ins.beam ?? 1;
  return blurredPeak(cv.sky, cv.W, cv.H, cv.s, beam / 2.355, inp.ins.las);
}

/* ------------------------------------------------------------------ entry */

export function buildScene(inp: SceneInput): Scene {
  const cv = new Canvas(inp.W, inp.H, inp.scale);
  const notes: Note[] = [];
  let radioPeak = 0;
  if (inp.ins.mode === 'radio') radioPeak = paintRadio(cv, inp, notes);
  else if (inp.target.kind === 'solar') {
    paintSolar(cv, inp, notes);
    if (inp.target.primary.id !== 'sun' && inp.geo) fieldStars(cv, hashStr(inp.target.target), inp.geo.ra, inp.geo.dec, inp.lim);
  } else paintDeep(cv, inp, notes);
  const stars = new Float32Array(cv.stars);
  return { sky: cv.sky, stars, nStars: stars.length / 8, peak: cv.peak, radioPeak, notes };
}
