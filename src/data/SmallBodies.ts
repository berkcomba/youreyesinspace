import { AU_KM, DEG, J2000_JD } from '../core/constants';
import { hashStr } from '../galaxy/ClusterStars';
import type { GeneratedBelt } from '../gen/SystemGenerator';
import { Rng } from '../gen/SystemGenerator';
import { _, fixed } from '../i18n';
import type { BodyData } from './types';

/** GM of the Sun, km³/s² */
const GM_SUN = 1.32712440018e11;

interface Group { key: string; name: string; first: number; count: number }

/** Physical / naming data of one body (the sidecar row) */
export interface SmallBodyInfo {
  pdes: string; name: string;
  diameter: number | null; albedo: number | null; rotation: number | null; spectral: string;
  /** id of the hand-made body in solarSystem.ts that stands for it */
  hand: string;
}

/**
 * Per population: colour, the opacity of one particle, and the absolute magnitude drawn at
 * brightness 1. The belt shader adds the particles (a floor of 0.4 × opacity each, more for the
 * bright ones), so a population's light is roughly count × opacity × 0.45: the opacities are set
 * for the same total as the hand-made belts of the generated systems (24 000 rocks at 0.9 for a
 * main belt, 5 000 Trojans at 0.7) — nine times the rocks must not mean nine times the glare.
 * `hRef` sits near each population's bright tail, so the typical member is a faint speck and the
 * largest bodies (Vesta, Hektor, the big TNOs) stand out from the haze.
 */
const GROUP_LOOK: Record<string, { color: [number, number, number]; opacity: number; hRef: number }> = {
  main: { color: [0.75, 0.70, 0.62], opacity: 0.16, hRef: 12 },
  neo: { color: [0.95, 0.62, 0.38], opacity: 0.15, hRef: 20 },
  trojan: { color: [0.62, 0.56, 0.5], opacity: 0.33, hRef: 12 },
  outer: { color: [0.55, 0.62, 0.85], opacity: 0.8, hRef: 7.5 },
  comet: { color: [0.6, 0.85, 1.0], opacity: 0.9, hRef: 10 },
};
/** brightness cap: 0.4 + 0.6 × 2 = 1.6 × opacity, and 1.9× the point size of a faint speck */
const BRIGHT_MAX = 2;

const CLASS_LABEL: Record<string, string> = {
  IEO: 'Atira asteroiti (Dünya yörüngesinin içinde)', ATE: 'Aten asteroiti (Dünya yörüngesini keser)', APO: 'Apollo asteroiti (Dünya yörüngesini keser)',
  AMO: 'Amor asteroiti (Dünya yörüngesine yaklaşır)', MCA: 'Mars yörüngesini kesen asteroit', IMB: 'İç ana kuşak asteroiti', MBA: 'Ana kuşak asteroiti',
  OMB: 'Dış ana kuşak asteroiti', TJN: 'Jüpiter Truva asteroiti', CEN: 'Kentaur', TNO: 'Trans-Neptün cismi', PAA: 'Parabolik asteroit', HYA: 'Hiperbolik asteroit',
  AST: 'Asteroit', JFc: 'Jüpiter ailesi kuyruklu yıldızı', JFC: 'Jüpiter ailesi kuyruklu yıldızı', HTC: 'Halley tipi kuyruklu yıldız', ETc: 'Encke tipi kuyruklu yıldız',
  CTc: 'Kiron tipi kuyruklu yıldız', COM: 'Kuyruklu yıldız', PAR: 'Kuyruklu yıldız', HYP: 'Kuyruklu yıldız',
};

/**
 * Every Solar System small body the app carries from the JPL Small-Body Database: all NEOs,
 * Mars-crossers, Jupiter Trojans, Centaurs and trans-Neptunian objects, the main belt down to
 * H 16 and the periodic comets (`scripts/build-smallbodies.mjs`). Drawn as GPU belts; a picked or
 * searched body becomes a full body of the Solar System on its real orbit.
 */
export class SmallBodyCatalog {
  readonly count: number;
  readonly groups: Group[];
  readonly classes: string[];
  readonly source: string;
  readonly fetched: string;
  /** elements: a (AU), e, i, Ω, ω (rad), mean anomaly at J2000 (rad) */
  readonly a: Float32Array; readonly e: Float32Array; readonly inc: Float32Array;
  readonly node: Float32Array; readonly peri: Float32Array; readonly M0: Float32Array;
  /** absolute magnitude H (total magnitude M1 for comets) ×100, 32767 = unknown */
  readonly H: Int16Array;
  readonly cls: Uint8Array;
  /** bit0 NEO, bit1 potentially hazardous, bit2 modelled by hand in solarSystem.ts */
  readonly flags: Uint8Array;
  private readonly rowText: string;
  private rowStart: Int32Array | null = null;
  private keys: string[] | null = null;
  private byHand: Map<string, number> | null = null;

  private constructor(bin: ArrayBuffer, meta: { source: string; fetched: string; classes: string[]; groups: Group[]; rows: string }) {
    const dv = new DataView(bin);
    if (dv.getUint32(0, true) !== 0x42534559) throw new Error('smallbodies.bin: bad magic');
    this.count = dv.getUint32(8, true);
    const rec = dv.getUint32(12, true);
    this.groups = meta.groups; this.classes = meta.classes; this.source = meta.source; this.fetched = meta.fetched;
    this.rowText = meta.rows;
    const n = this.count;
    this.a = new Float32Array(n); this.e = new Float32Array(n); this.inc = new Float32Array(n);
    this.node = new Float32Array(n); this.peri = new Float32Array(n); this.M0 = new Float32Array(n);
    this.H = new Int16Array(n); this.cls = new Uint8Array(n); this.flags = new Uint8Array(n);
    for (let k = 0, o = 16; k < n; k++, o += rec) {
      this.a[k] = dv.getFloat32(o, true); this.e[k] = dv.getFloat32(o + 4, true); this.inc[k] = dv.getFloat32(o + 8, true);
      this.node[k] = dv.getFloat32(o + 12, true); this.peri[k] = dv.getFloat32(o + 16, true); this.M0[k] = dv.getFloat32(o + 20, true);
      this.H[k] = dv.getInt16(o + 24, true); this.cls[k] = dv.getUint8(o + 26); this.flags[k] = dv.getUint8(o + 27);
    }
  }

  static async load(baseUrl: string): Promise<SmallBodyCatalog> {
    const [bin, meta] = await Promise.all([
      fetch(`${baseUrl}data/smallbodies.bin`).then((r) => { if (!r.ok) throw new Error(`smallbodies.bin ${r.status}`); return r.arrayBuffer(); }),
      fetch(`${baseUrl}data/smallbodies.json`).then((r) => { if (!r.ok) throw new Error(`smallbodies.json ${r.status}`); return r.json(); }),
    ]);
    return new SmallBodyCatalog(bin, meta);
  }

  /** The GPU belts of the Solar System, one per population (real orbits, brightness from H) */
  belts(): GeneratedBelt[] {
    return this.groups.map((g) => {
      const look = GROUP_LOOK[g.key] ?? GROUP_LOOK.main;
      const e0 = new Float32Array(g.count * 4), e1 = new Float32Array(g.count * 4);
      for (let j = 0; j < g.count; j++) {
        const k = g.first + j;
        const aKm = this.a[k] * AU_KM;
        e0[j * 4] = aKm; e0[j * 4 + 1] = this.e[k]; e0[j * 4 + 2] = this.inc[k]; e0[j * 4 + 3] = this.node[k];
        const H = this.H[k] === 32767 ? look.hRef + 4 : this.H[k] / 100;
        // brightness draw: the flux relative to the population's reference magnitude (1 at hRef,
        // 0.025 four magnitudes fainter, capped above); hand-made bodies are drawn as bodies
        const bright = Math.min(BRIGHT_MAX, Math.pow(10, 0.4 * (look.hRef - H)));
        e1[j * 4] = this.peri[k]; e1[j * 4 + 1] = this.M0[k]; e1[j * 4 + 2] = Math.sqrt(GM_SUN / (aKm * aKm * aKm));
        e1[j * 4 + 3] = this.flags[k] & 4 ? -bright : bright;
      }
      return {
        name: g.name, count: g.count, aMin: 0, aMax: 0, eMax: 0, iSigmaDeg: 0, seed: 0,
        color: look.color, opacity: look.opacity, real: { e0, e1, first: g.first },
      };
    });
  }

  private rows(): Int32Array {
    if (this.rowStart) return this.rowStart;
    const starts = new Int32Array(this.count + 1);
    let k = 0;
    starts[k++] = 0;
    for (let p = this.rowText.indexOf('\n'); p >= 0 && k < this.count; p = this.rowText.indexOf('\n', p + 1)) starts[k++] = p + 1;
    starts[this.count] = this.rowText.length + 1;
    return (this.rowStart = starts);
  }

  info(k: number): SmallBodyInfo {
    const s = this.rows();
    const f = this.rowText.slice(s[k], s[k + 1] - 1).split('\t');
    const n = (v: string | undefined) => (v ? +v : null);
    return { pdes: f[0], name: f[1] ?? '', diameter: n(f[2]), albedo: n(f[3]), rotation: n(f[4]), spectral: f[5] ?? '', hand: f[6] ?? '' };
  }

  isComet(k: number): boolean { const g = this.groups[this.groups.length - 1]; return g.key === 'comet' && k >= g.first; }

  /** "433 Eros", "2024 YR4", "(12345)", "29P/Schwassmann-Wachmann" */
  label(k: number): string {
    const { pdes, name } = this.info(k);
    if (this.isComet(k)) return name ? (/^\d+[PCDXI]$/.test(pdes) ? `${pdes}/${name}` : `${pdes} (${name})`) : pdes;
    if (/^\d+$/.test(pdes)) return name ? `${pdes} ${name}` : `(${pdes})`;
    return name ? `${name} (${pdes})` : pdes;
  }

  /** body id in the Solar System (the hand-made body when there is one) */
  bodyId(k: number): string {
    const { pdes, hand } = this.info(k);
    return hand || `sb-${pdes.replace(/\s+/g, '_')}`;
  }

  /** index of a body id created by `bodyId` (−1 = not a catalogue small body) */
  indexOfId(id: string): number {
    if (!id.startsWith('sb-')) return this.handIndex(id);
    const key = id.slice(3).replace(/_/g, ' ').toLowerCase();
    const keys = this.searchKeys();
    for (let k = 0; k < this.count; k++) if (keys[k].startsWith(key + '\t')) return k;
    return -1;
  }

  private handIndex(id: string): number {
    if (!this.byHand) {
      this.byHand = new Map();
      for (let k = 0; k < this.count; k++) if (this.flags[k] & 4) this.byHand.set(this.info(k).hand, k);
    }
    return this.byHand.get(id) ?? -1;
  }

  private searchKeys(): string[] {
    if (this.keys) return this.keys;
    const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const s = this.rows();
    const keys = new Array<string>(this.count);
    for (let k = 0; k < this.count; k++) {
      const f = this.rowText.slice(s[k], s[k + 1] - 1).split('\t', 2);
      keys[k] = `${f[0].toLowerCase()}\t${norm(f[1] ?? '')}`;
    }
    return (this.keys = keys);
  }

  /** Bodies whose designation or name matches (exact designation / name first, then prefixes, then substrings) */
  search(q: string, limit: number): number[] {
    const nq = q.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/^\((\d+)\)$/, '$1');
    if (nq.length < 2) return [];
    const keys = this.searchKeys();
    // exact / prefix / substring, each split into hand-made bodies and numbered periodic comets first, then the rest
    const tiers: number[][] = [[], [], [], [], [], []];
    for (let k = 0; k < this.count; k++) {
      const key = keys[k];
      const tab = key.indexOf('\t');
      const des = key.slice(0, tab), name = key.slice(tab + 1);
      const tier = des === nq || name === nq || `${des} ${name}` === nq || `${des}/${name}` === nq || name.split('-').includes(nq) ? 0
        : name.startsWith(nq) || des.startsWith(nq) ? 2
        : nq.length >= 4 && name.includes(nq) ? 4 : -1;
      if (tier < 0) continue;
      const list = tiers[tier + ((this.flags[k] & 4) || /^\d+p$/.test(des) ? 0 : 1)];
      if (list.length < limit) list.push(k);
    }
    return tiers.flat().slice(0, limit);
  }

  className(k: number): string { return CLASS_LABEL[this.classes[this.cls[k]]] ?? 'Asteroit'; }

  /** A full body on the real orbit, sized from the measured diameter (or from H and a typical albedo) */
  bodyData(k: number): BodyData {
    const info = this.info(k);
    const comet = this.isComet(k);
    const cls = this.classes[this.cls[k]];
    const outer = cls === 'TNO' || cls === 'CEN';
    const H = this.H[k] === 32767 ? null : this.H[k] / 100;
    const albedo = info.albedo ?? (comet || outer ? 0.06 : cls === 'TJN' ? 0.07 : 0.14);
    const diameter = info.diameter ?? (comet ? 2 + 4 * new Rng(hashStr(info.pdes) >>> 0).next() : H !== null ? (1329 / Math.sqrt(albedo)) * Math.pow(10, -H / 5) : 1);
    const radius = Math.max(diameter / 2, 0.005);
    const density = comet || outer ? 600 : 2000;
    const mass = (4 / 3) * Math.PI * Math.pow(radius * 1000, 3) * density;
    const a = this.a[k];
    const periodDays = (2 * Math.PI * Math.pow(a, 1.5)) / 0.01720209895;
    const rng = new Rng(hashStr(info.pdes) >>> 0);
    const spec = info.spectral.toUpperCase();
    // reflectance by spectral class: C/B/D dark, S/Q/K/L stony-red, X/M/E metallic or bright, V basaltic
    const base: [number, number, number] = comet ? [0.08, 0.075, 0.07]
      : /^[VR]/.test(spec) ? [0.55, 0.5, 0.45]
      : /^[SQKLA]/.test(spec) ? [0.48, 0.4, 0.32]
      : /^[XME]/.test(spec) ? [0.42, 0.41, 0.4]
      : /^D|^T/.test(spec) || outer ? [0.32, 0.2, 0.14]
      : [0.2, 0.19, 0.18];
    const tint = (m: number) => rng.tint([base[0] * m, base[1] * m, base[2] * m]) as [number, number, number];
    const neo = !!(this.flags[k] & 1), pha = !!(this.flags[k] & 2);
    const facts: Record<string, string> = { 'Sınıf': _(this.className(k)) };
    if (info.spectral) facts['Spektral tür'] = info.spectral;
    if (H !== null) facts[comet ? 'Toplam mutlak parlaklık (M1)' : 'Mutlak parlaklık (H)'] = fixed(H, 1);
    facts['Çap'] = `${fixed(diameter, diameter < 10 ? 2 : 0)} km${info.diameter === null ? ` (${_('H ve tipik albedodan tahmin')})` : ''}`;
    if (info.albedo !== null) facts['Albedo'] = fixed(info.albedo, 3);
    if (info.rotation !== null) facts['Dönme periyodu'] = `${fixed(info.rotation, info.rotation < 10 ? 2 : 1)} ${_('saat')}`;
    if (pha) facts['Tehlike'] = _('Potansiyel olarak tehlikeli asteroit (PHA)');
    else if (neo) facts['Tehlike'] = _("Dünya'ya yakın cisim (NEO)");
    facts['Kaynak'] = 'NASA/JPL Small-Body Database';
    const q = a * (1 - this.e[k]), Q = a * (1 + this.e[k]);
    const description = `${_(this.className(k))}. ${_('Güneş\'i {q}–{Q} AU arasında, {p} yılda bir dolanır; yörünge eğimi {i}°.', {
      q: fixed(q, 2), Q: fixed(Q, Q < 10 ? 2 : 1), p: fixed(periodDays / 365.25, periodDays < 3650 ? 2 : 0), i: fixed(this.inc[k] / DEG, 1),
    })} ${_('Yörünge JPL\'in oskülatör elemanlarından iki cisim çözümüyle yürütülür; gezegen yakın geçişleri yaklaşıktır. Yüzey görünümü temsilîdir.')}`;
    return {
      id: this.bodyId(k), name: this.label(k), type: comet ? 'comet' : 'asteroid', parent: 'sun',
      radius, mass, albedo,
      rotationPeriod: info.rotation ?? rng.range(3, 30), tilt: rng.range(0, 180),
      orbit: {
        kind: 'simple', a: a * AU_KM, e: this.e[k], i: this.inc[k] / DEG, node: this.node[k] / DEG, argPeri: this.peri[k] / DEG, M0: this.M0[k] / DEG,
        epoch: J2000_JD, period: periodDays, frame: 'ecliptic',
      },
      appearance: { kind: 'terrestrial', seed: hashStr(info.pdes) & 0xffff, landLow: tint(0.7), landMid: tint(1), landHigh: tint(1.4), craters: comet ? 0.6 : 1.0, roughness: comet ? 2.5 : 2.2, variation: 0.45 },
      description,
      facts,
    };
  }
}
