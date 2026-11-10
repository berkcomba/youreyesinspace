import {
  ClampToEdgeWrapping, ImageBitmapLoader, LinearFilter, Matrix3, Matrix4, NoColorSpace, RepeatWrapping, SRGBColorSpace, Texture, Vector3, Vector4, type IUniform,
} from 'three';
import type { Appearance } from '../data/types';

/**
 * Surface maps baked in Blender (Planet Gen's planet types, Brent Patterson's gas giants) that
 * dress the generated worlds: each `skin` family of the generator draws one of several library
 * variants (public/skins, see scripts in the asset notes), turned about the pole by the body's
 * seed. The surface baker reads them instead of the procedural model; until they arrive, or if
 * they never do, the procedural surface stays.
 */
interface Variant {
  v: number;
  /** mean land albedo, linear */
  mean: [number, number, number];
  /** fraction of open water / glowing lava */
  water: number;
  glow: number;
  /** the sea surface on the height scale (0 … 1) of a map with open water */
  sea?: number;
}

interface Family {
  /** the library types it draws from */
  from: string[];
  /** 0 … 1: how far the skin's colours move toward the body's own palette */
  tint: number;
  /** 1 as baked, < 1 flattened toward the mean */
  contrast?: number;
  minWater?: number;
  /** the maps' seas are ice here (airless and frozen worlds) */
  frozen?: boolean;
}

const BRENT = ['brent-gas-giant', 'brent-gas-giant-2', 'brent-gas-giant-3'];
const GAS = [...BRENT, 'gas-giant', 'gas-giant-2'];

const FAMILIES: Record<string, Family> = {
  'temperate-life': { from: ['earth-like-planet', 'green-planet', 'island-planet', 'swamp-planet', 'tundra-planet'], tint: 0 },
  temperate: { from: ['beach-planet', 'tundra-planet', 'earth-like-planet'], tint: 0 },
  ocean: { from: ['island-planet', 'earth-like-planet'], tint: 0, minWater: 0.45 },
  eyeball: { from: ['ice-planet', 'tundra-planet'], tint: 0 },
  // the generator's crust palettes (SystemGenerator: varyRocky) carry the variety of these
  desert: { from: ['desert-planet', 'red-planet', 'dust-planet'], tint: 0.5 },
  ice: { from: ['ice-planet', 'salt-planet'], tint: 0.6, frozen: true },
  lava: { from: ['lava-planet'], tint: 0 },
  venusian: { from: ['toxic-planet', 'desert-planet'], tint: 0.4 },
  carbon: { from: ['tectonic-planet', 'barren-planet'], tint: 0.8 },
  barren: { from: ['barren-planet', 'simple-rocky-planet', 'dust-planet', 'tectonic-planet'], tint: 0.75 },
  'dwarf-red': { from: ['dust-planet', 'red-planet', 'simple-rocky-planet'], tint: 0.7 },
  'moon-rocky': { from: ['barren-planet', 'simple-rocky-planet', 'dust-planet'], tint: 0.8 },
  'moon-icy': { from: ['ice-planet', 'salt-planet'], tint: 0.7, frozen: true },
  // sulphur plains: no water skins here (a volcanic world reads the map's flag as glow)
  'moon-volcanic': { from: ['desert-planet', 'red-planet'], tint: 0.85 },
  gas: { from: BRENT, tint: 1 },
  icegiant: { from: GAS, tint: 1, contrast: 0.7 },
  subneptune: { from: GAS, tint: 1, contrast: 0.3 },
};

/**
 * Real global maps of solar-system worlds the imagery tiles do not cover (public/maps, see
 * NOTICE): `skin: 'map:<name>'` dresses the body in `<name>-c.webp` / `<name>-n.webp`, as they are.
 */
const MAPS = `${import.meta.env.BASE_URL}maps/`;
const MAP_CREDITS: Record<string, string> = {
  pluto: 'NASA/JHUAPL/SwRI New Horizons, USGS',
  charon: 'NASA/JHUAPL/SwRI New Horizons, USGS',
  triton: 'NASA/JPL Voyager 2, USGS',
  hd189733b: 'Your Eyes In Space, after NASA/ESA/M. Kornmesser',
};
const SSS_CREDIT = 'Solar System Scope (CC BY 4.0)';
const BRENT_CREDIT = 'Brent Patterson (CC BY 3.0)';

export interface Skin {
  c: Texture;
  n: Texture;
  rot: Matrix3;
  mean: Vector3;
  tint: Vector3;
  contrast: number;
  /** the sea surface on the height scale, −1 without open water or where its water is lakes */
  sea: number;
  /** fraction of open water */
  water: number;
  /** whether the body's own craters go over it (not over a real map) */
  craters: boolean;
  /** its seas are frozen over */
  frozen: boolean;
  /** source to credit on screen while the body is in view (null: none owed) */
  credit: string | null;
  /** false once the library dropped the textures (the view asks again) */
  alive: boolean;
  /** the body's own landforms and colours over the map */
  geo: Geology;
}

/** The uniforms of skin_common.glsl's geology (see there) */
interface Geology {
  seed: number;
  warp: number;
  tintA: Vector3;
  tintB: Vector3;
  chroma: Vector3;
  rift: Vector4;
  riftMid: Vector4;
  riftWidth: number;
  lineae: number;
  volc: Vector4[];
  volcH: number;
  cap: Vector3;
  hemi: Vector4;
  hemiTint: Vector3;
  hemiDrop: number;
}

const zero4 = (): Vector4 => new Vector4(0, 0, 0, 0);
const flat = (): Geology => ({
  seed: 0, warp: 0, tintA: new Vector3(1, 1, 1), tintB: new Vector3(1, 1, 1), chroma: new Vector3(0, 1, 0),
  rift: zero4(), riftMid: zero4(), riftWidth: 0, lineae: 0, volc: [zero4(), zero4(), zero4()], volcH: 0,
  cap: new Vector3(), hemi: zero4(), hemiTint: new Vector3(1, 1, 1), hemiDrop: 0,
});

/** albedo gains of icy provinces: tholin-stained, blue, dirty grey, pink nitrogen frost, clean, sulphur-yellow */
const ICE_TINTS: [number, number, number][] = [[1.15, 0.86, 0.66], [0.9, 1.0, 1.12], [0.78, 0.78, 0.8], [1.08, 0.93, 0.92], [1.1, 1.1, 1.1], [1.08, 1.02, 0.8]];

type GeoKind = 'wet' | 'red' | 'rock' | 'ice' | 'hot' | 'none';
const GEO_KIND: Record<string, GeoKind> = {
  temperate: 'wet', 'temperate-life': 'wet', ocean: 'wet', eyeball: 'wet',
  desert: 'red', 'dwarf-red': 'red',
  barren: 'rock', 'moon-rocky': 'rock', carbon: 'rock',
  ice: 'ice', 'moon-icy': 'ice',
  lava: 'hot', 'moon-volcanic': 'hot', venusian: 'hot',
};

/**
 * What a body lays over the skin it draws, from its seed: so the worlds that share one of the
 * library's few maps of their kind still differ — the map bent at the scale of continents, its
 * colours turned, provinces; rift valleys and shield volcanoes on the dry worlds, fracture bands
 * and dark hemispheres on the icy ones, polar caps of any size.
 */
function geology(family: string, seed: number): Geology {
  const g = flat();
  const kind = GEO_KIND[family] ?? 'none';
  if (kind === 'none') return g;
  let salt = 0x3a7;
  const r = (): number => hash(seed, salt++) / 4294967296;
  const range = (a: number, b: number): number => a + (b - a) * r();
  const unit = (): Vector3 => {
    const z = 2 * r() - 1, phi = 2 * Math.PI * r(), s = Math.sqrt(1 - z * z);
    return new Vector3(s * Math.cos(phi), z, s * Math.sin(phi));
  };
  const tint = (amp: number): Vector3 => {
    const v = new Vector3(r(), r(), r());
    const m = (v.x + v.y + v.z) / 3;
    return v.subScalar(m).multiplyScalar(2 * amp).addScalar(1 + (r() - 0.5) * amp);
  };
  // `tropic`: the trough runs roughly east–west within that latitude of the equator (Valles
  // Marineris along the Tharsis bulge's flank); else anywhere
  const rift = (width: [number, number], depth: [number, number], half: [number, number], tropic = 0) => {
    let a: Vector3, m: Vector3;
    if (tropic > 0) {
      const lat = range(-tropic, tropic), lon = range(0, 2 * Math.PI), head = range(-0.6, 0.6);
      m = new Vector3(Math.cos(lat) * Math.cos(lon), Math.sin(lat), Math.cos(lat) * Math.sin(lon));
      const east = new Vector3(-Math.sin(lon), 0, Math.cos(lon));
      const north = new Vector3().crossVectors(m, east);
      a = new Vector3().crossVectors(m, east.multiplyScalar(Math.cos(head)).addScaledVector(north, Math.sin(head))).normalize();
    } else {
      a = unit();
      m = new Vector3().crossVectors(a, unit()).normalize();
    }
    g.rift.set(a.x, a.y, a.z, range(...depth));
    g.riftMid.set(m.x, m.y, m.z, range(...half));
    g.riftWidth = range(...width);
  };
  const volcanoes = (n: number, h: [number, number]) => {
    const centre = unit();
    for (let k = 0; k < n; k++) {
      const v = centre.clone().addScaledVector(unit(), k ? 0.35 : 0).normalize();
      g.volc[k].set(v.x, v.y, v.z, range(0.05, 0.13) * (k ? 0.7 : 1));
    }
    g.volcH = range(...h);
  };
  g.seed = (hash(seed, 0x9e01) % 10000) / 100;
  g.warp = range(0.04, 0.09);
  switch (kind) {
    case 'wet':
      g.chroma.set((r() - 0.5) * 0.9, range(0.75, 1.3), (r() - 0.5) * 0.7);
      g.tintA = tint(0.08);
      g.tintB = tint(0.08);
      if (r() < 0.5) g.cap.set(range(0.62, 0.9), 0, 0.02);
      break;
    case 'red':
      g.chroma.set((r() - 0.5) * 0.4, range(0.75, 1.1), 0);
      g.tintA = tint(0.15);
      g.tintB = tint(0.15);
      if (r() < 0.75) rift([0.018, 0.03], [0.3, 0.5], [0.4, 0.8], 0.45);
      if (r() < 0.6) volcanoes(1 + Math.floor(r() * 3), [0.35, 0.7]);
      if (r() < 0.8) g.cap.set(range(0.9, 0.97), 1, 0.04);
      if (r() < 0.5) {
        const apex = new Vector3(range(-0.5, 0.5), r() < 0.5 ? 1 : -1, range(-0.5, 0.5)).normalize();
        g.hemi.set(apex.x, apex.y, apex.z, 1);
        g.hemiTint.setScalar(range(0.75, 0.9));
        g.hemiDrop = range(0.08, 0.15);
      }
      break;
    case 'rock':
      g.tintA = tint(0.12);
      g.tintB = tint(0.12).multiplyScalar(range(0.7, 0.95));
      if (r() < 0.35) rift([0.006, 0.012], [0.2, 0.3], [0.3, 0.7]);
      if (r() < 0.3) {
        const apex = unit();
        g.hemi.set(apex.x, apex.y, apex.z, 0.8);
        g.hemiTint.setScalar(range(0.6, 0.8));
        g.hemiDrop = 0.08;
      }
      break;
    case 'ice': {
      g.chroma.set(0, range(0.6, 1.1), 0);
      const a = Math.floor(r() * ICE_TINTS.length);
      const b = (a + 1 + Math.floor(r() * (ICE_TINTS.length - 1))) % ICE_TINTS.length;
      g.tintA.set(...ICE_TINTS[a]);
      g.tintB.set(...ICE_TINTS[b]);
      if (r() < 0.65) g.lineae = range(0.6, 1);
      if (r() < 0.45) rift([0.008, 0.016], [0.25, 0.4], [0.4, 1.2]);
      if (r() < 0.3) {
        // a dark leading hemisphere (Iapetus): dust swept up along the orbit
        const apex = new Vector3(range(-0.3, 0.3), range(-0.2, 0.2), 1).normalize();
        g.hemi.set(apex.x, apex.y, apex.z, range(0.7, 0.95));
        g.hemiTint.set(0.32, 0.25, 0.19);
      }
      break;
    }
    case 'hot':
      g.chroma.set((r() - 0.5) * 0.3, range(0.85, 1.2), 0);
      g.tintA = tint(0.12);
      g.tintB = tint(0.12);
      if (family === 'venusian') {
        if (r() < 0.4) rift([0.006, 0.012], [0.2, 0.3], [0.4, 1.0]);
        if (r() < 0.5) volcanoes(1 + Math.floor(r() * 3), [0.25, 0.45]);
      }
      break;
  }
  return g;
}

/** The skin uniforms of skin_common.glsl (`gas`: the slopes of a gas giant's map are gentler). */
export function skinUniforms(skin: Skin, gas: boolean): Record<string, IUniform> {
  const g = skin.geo;
  return {
    uSkinC: { value: skin.c }, uSkinN: { value: skin.n }, uSkinRot: { value: skin.rot },
    uSkinMean: { value: skin.mean }, uSkinTint: { value: skin.tint }, uSkinContrast: { value: skin.contrast },
    // slopes in the surface shaders' units: the normal's tilt over their bump scale
    uSkinSlope: { value: gas ? 1 / 0.012 : 1 / 0.02 },
    uSkinSea: { value: skin.sea }, uSkinWater: { value: skin.water }, uSkinCraters: { value: skin.craters ? 1 : 0 },
    uSkinFrozen: { value: skin.frozen ? 1 : 0 },
    uGeoSeed: { value: g.seed }, uGeoWarp: { value: g.warp }, uGeoTintA: { value: g.tintA }, uGeoTintB: { value: g.tintB },
    uGeoChroma: { value: g.chroma }, uGeoRift: { value: g.rift }, uGeoRiftMid: { value: g.riftMid }, uGeoRiftWidth: { value: g.riftWidth },
    uGeoLineae: { value: g.lineae }, uGeoVolc: { value: g.volc }, uGeoVolcH: { value: g.volcH }, uGeoCap: { value: g.cap },
    uGeoHemi: { value: g.hemi }, uGeoHemiTint: { value: g.hemiTint }, uGeoHemiDrop: { value: g.hemiDrop },
  };
}

interface Entry {
  key: string;
  maps: Promise<[Texture, Texture]>;
  lastUsed: number;
  skins: Skin[];
}

/** skins whose textures stay resident (2 × 8 MB each at 2048 × 1024) */
const KEEP = 4;

const BASE = `${import.meta.env.BASE_URL}skins/`;
let index: Promise<Record<string, Variant[]> | null> | null = null;
const entries = new Map<string, Entry>();

function loadIndex(): Promise<Record<string, Variant[]> | null> {
  index ??= fetch(`${BASE}index.json`)
    .then((r) => (r.ok ? r.json() as Promise<Record<string, Variant[]>> : null))
    .catch(() => null);
  return index;
}

function loadMap(url: string, srgb: boolean): Promise<Texture> {
  const loader = new ImageBitmapLoader();
  // straight alpha: the flag / height in A must not wipe the colour where it is 0
  loader.setOptions({ premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
  return loader.loadAsync(url).then((bmp) => {
    const t = new Texture(bmp);
    t.flipY = false;
    t.generateMipmaps = false;
    t.minFilter = LinearFilter;
    t.magFilter = LinearFilter;
    t.wrapS = RepeatWrapping;
    t.wrapT = ClampToEdgeWrapping;
    t.colorSpace = srgb ? SRGBColorSpace : NoColorSpace;
    t.needsUpdate = true;
    return t;
  });
}

function evict(): void {
  while (entries.size > KEEP) {
    let victim: Entry | null = null;
    for (const e of entries.values()) if (!victim || e.lastUsed < victim.lastUsed) victim = e;
    if (!victim) return;
    entries.delete(victim.key);
    for (const s of victim.skins) s.alive = false;
    victim.maps.then(([c, n]) => {
      for (const t of [c, n]) { (t.image as ImageBitmap).close?.(); t.dispose(); }
    }).catch(() => {});
  }
}

function hash(seed: number, salt: number): number {
  let h = Math.imul(seed ^ salt, 0x9e3779b1);
  h ^= h >>> 15;
  h = Math.imul(h, 0x85ebca6b);
  return (h ^ (h >>> 13)) >>> 0;
}

function palette(a: Appearance): Vector3 | null {
  const cols = a.kind === 'gas' ? a.bands : a.kind === 'terrestrial' ? [a.landLow, a.landMid ?? a.landLow, a.landHigh] : null;
  if (!cols?.length) return null;
  const m = new Vector3();
  for (const c of cols) m.add(new Vector3(c[0], c[1], c[2]));
  return m.divideScalar(cols.length);
}

/**
 * The skin for a body's appearance, or null when it has none (or the library is missing). The
 * same body always gets the same variant and turn.
 */
export async function loadSkin(a: Appearance): Promise<Skin | null> {
  if ((a.kind !== 'terrestrial' && a.kind !== 'gas') || !a.skin) return null;
  const real = a.skin.startsWith('map:') ? a.skin.slice(4) : null;
  const fam: Family | undefined = real ? { from: [], tint: 0 } : FAMILIES[a.skin];
  const idx = real ? null : await loadIndex();
  if (!fam || (!real && !idx)) return null;
  const pool: Array<{ slug: string; v: Variant }> = [];
  for (const slug of fam.from) for (const v of idx![slug] ?? []) if (v.water >= (fam.minWater ?? 0)) pool.push({ slug, v });
  if (real) pool.push({ slug: real, v: { v: -1, mean: [0.5, 0.5, 0.5], water: 0, glow: 0 } });
  if (!pool.length) return null;
  const pick = pool[hash(a.seed, 0x5157) % pool.length];
  const key = real ? `map:${real}` : `${pick.slug}-${pick.v.v}`;
  const url = real ? `${MAPS}${real}` : `${BASE}${key}`;
  let e = entries.get(key);
  if (!e) {
    e = { key, maps: Promise.all([loadMap(`${url}-c.webp`, true), loadMap(`${url}-n.webp`, false)]), lastUsed: performance.now(), skins: [] };
    entries.set(key, e);
    evict();
  }
  e.lastUsed = performance.now();
  let maps: [Texture, Texture];
  try {
    maps = await e.maps;
  } catch {
    entries.delete(key);
    return null;
  }
  const mean = new Vector3(...pick.v.mean);
  const tint = new Vector3(1, 1, 1);
  const pal = palette(a);
  if (pal && fam.tint > 0) {
    for (const k of ['x', 'y', 'z'] as const) {
      const g = Math.min(10, Math.max(0.15, pal[k] / Math.max(mean[k], 1e-3)));
      tint[k] = 1 + (g - 1) * fam.tint;
    }
  }
  // a real map keeps its longitudes: u = 0 at −X is 180° W, the body's prime meridian faces +X;
  // a library one is turned about the pole, and half the time mirrored
  const turn = real ? 0 : ((hash(a.seed, 0x7a11) % 3600) / 3600) * Math.PI * 2;
  const rot = new Matrix4().makeRotationY(turn);
  if (!real && hash(a.seed, 0x3171) & 1) rot.multiply(new Matrix4().makeScale(1, 1, -1));
  const skin: Skin = {
    c: maps[0], n: maps[1], rot: new Matrix3().setFromMatrix4(rot),
    mean, tint, contrast: fam.contrast ?? 1,
    // a "sea" at the top of the height range is lakes and frozen ponds on the uplands
    sea: !fam.frozen && pick.v.water > 0 && (pick.v.sea ?? 1) < 0.9 ? pick.v.sea! : -1,
    water: fam.frozen ? 0 : pick.v.water, craters: !real, frozen: !!fam.frozen, alive: entries.has(key),
    credit: real ? MAP_CREDITS[real] ?? SSS_CREDIT : BRENT.includes(pick.slug) ? BRENT_CREDIT : null,
    geo: real ? flat() : geology(a.skin, a.seed),
  };
  e.skins.push(skin);
  return skin;
}

/** keep a skin's textures resident a while longer (it is being baked from) */
export function touchSkin(skin: Skin): void {
  for (const e of entries.values()) if (e.skins.includes(skin)) e.lastUsed = performance.now();
}
