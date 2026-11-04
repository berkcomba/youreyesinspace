/**
 * Background parser for the deep star catalogue tiers (see StarCatalog.loadTiers): decodes one
 * tier file into typed arrays and keeps every tier's positions so it can rebuild the 5 pc cell
 * grid over all of them. Both jobs are a few hundred milliseconds for the two-million-star tiers,
 * far too long for the main thread while a flight is on screen.
 *
 * Messages in:  { tier, core, buf }   (buf is transferred)
 * Messages out: { tier, arrays…, gridKeys, gridStart, gridIdx }  (all transferred)
 */
import { absoluteMagnitude, bvToRgb } from '../astro/stellar';
import { STAR_GAIA_DIST, STAR_VELOCITY, STAR_WD, cellKey, guessBv, type CatalogTier } from './starTierFormat';

export interface TierRequest { tier: CatalogTier; core: number; buf: ArrayBuffer }
export interface TierResult {
  tier: CatalogTier;
  positions: Float32Array; velocities: Int16Array; mags: Float32Array; absMags: Float32Array; flux0: Float32Array; bvs: Float32Array;
  /** the stars' rgb (StarPoints' colour attribute) and their catalogue indices as floats (its starIndex attribute) */
  colors: Float32Array; indices: Float32Array;
  spectClass: Uint8Array; spectSub: Uint8Array; lumClass: Uint8Array; flags: Uint8Array; extIds: Uint32Array; extHi: Uint32Array;
  gridKeys: Float64Array; gridStart: Uint32Array; gridIdx: Uint32Array;
}

/** positions of every tier parsed so far (tier order), for the grid */
let allPositions = new Float32Array(0);
let allCount = 0;

function parse(t: CatalogTier, buf: ArrayBuffer): Omit<TierResult, 'gridKeys' | 'gridStart' | 'gridIdx'> {
  const dv = new DataView(buf);
  if (dv.getUint32(4, true) !== 3 || dv.getUint32(8, true) !== t.count || dv.getUint32(16, true) !== t.first) throw new Error(`${t.file}: unexpected layout`);
  const REC = dv.getUint32(12, true);
  const gaiaIds = dv.getUint32(20, true) === 2;
  const HEAD = 24;
  const n = t.count;
  const positions = new Float32Array(n * 3), velocities = new Int16Array(n * 3);
  const mags = new Float32Array(n), absMags = new Float32Array(n), flux0 = new Float32Array(n), bvs = new Float32Array(n);
  const spectClass = new Uint8Array(n), spectSub = new Uint8Array(n), lumClass = new Uint8Array(n), flags = new Uint8Array(n);
  const extIds = new Uint32Array(n), extHi = new Uint32Array(n);
  const colors = new Float32Array(n * 3), indices = new Float32Array(n);
  for (let k = 0; k < n; k++) {
    const o = HEAD + k * REC;
    const x = dv.getFloat32(o, true), y = dv.getFloat32(o + 4, true), z = dv.getFloat32(o + 8, true);
    positions[k * 3] = x; positions[k * 3 + 1] = y; positions[k * 3 + 2] = z;
    const mag = dv.getUint8(o + 12) / 10 - 5;
    const ci = dv.getUint8(o + 13);
    const sp = dv.getUint8(o + 14);
    const lf = dv.getUint8(o + 15);
    mags[k] = mag;
    const cls = sp === 255 ? 255 : Math.floor(sp / 10), sub = sp === 255 ? 255 : sp % 10;
    spectClass[k] = cls; spectSub[k] = sub;
    lumClass[k] = lf & 7;
    flags[k] = (lf & 8 ? STAR_WD : 0) | (lf & 16 ? STAR_GAIA_DIST : 0) | (lf & 32 ? STAR_VELOCITY : 0);
    let q = o + 16;
    if (gaiaIds) { extHi[k] = dv.getUint32(q, true); extIds[k] = dv.getUint32(q + 4, true); q += 8; }
    else { extIds[k] = dv.getUint32(q, true); q += 4; }
    velocities[k * 3] = dv.getInt16(q, true); velocities[k * 3 + 1] = dv.getInt16(q + 2, true); velocities[k * 3 + 2] = dv.getInt16(q + 4, true);
    const d = Math.sqrt(x * x + y * y + z * z);
    absMags[k] = absoluteMagnitude(mag, d);
    flux0[k] = Math.pow(10, -0.4 * absMags[k]);
    bvs[k] = ci === 255 ? guessBv(cls, sub) : ci / 60 - 0.6;
    const [r, g, b] = bvToRgb(bvs[k]);
    colors[k * 3] = r; colors[k * 3 + 1] = g; colors[k * 3 + 2] = b;
    indices[k] = t.first + k;
  }
  return { tier: t, positions, velocities, mags, absMags, flux0, bvs, colors, indices, spectClass, spectSub, lumClass, flags, extIds, extHi };
}

/** Sort every tier star into cells (one native sort of packed cell·index keys) */
function buildGrid(): Pick<TierResult, 'gridKeys' | 'gridStart' | 'gridIdx'> {
  const n = allCount;
  const packed = new Float64Array(n);
  const p = allPositions;
  for (let k = 0; k < n; k++) packed[k] = cellKey(p[k * 3], p[k * 3 + 1], p[k * 3 + 2]) * 4194304 + k;
  packed.sort();
  const keys: number[] = [];
  const starts: number[] = [];
  const gridIdx = new Uint32Array(n);
  let last = -1;
  for (let k = 0; k < n; k++) {
    const key = Math.floor(packed[k] / 4194304);
    gridIdx[k] = packed[k] - key * 4194304;
    if (key !== last) { keys.push(key); starts.push(k); last = key; }
  }
  starts.push(n);
  return { gridKeys: Float64Array.from(keys), gridStart: Uint32Array.from(starts), gridIdx };
}

self.onmessage = (e: MessageEvent<TierRequest>) => {
  const { tier, core, buf } = e.data;
  try {
    const parsed = parse(tier, buf);
    // the tiers arrive in order, so their stars are contiguous after the core
    const need = tier.first - core + tier.count;
    if (allPositions.length < need * 3) {
      const grown = new Float32Array(need * 3);
      grown.set(allPositions.subarray(0, allCount * 3));
      allPositions = grown;
    }
    allPositions.set(parsed.positions, (tier.first - core) * 3);
    allCount = Math.max(allCount, need);
    const result: TierResult = { ...parsed, ...buildGrid() };
    const transfer = Object.values(result).filter((v): v is ArrayBufferView => ArrayBuffer.isView(v)).map((v) => v.buffer as ArrayBuffer);
    (self as unknown as Worker).postMessage(result, transfer);
  } catch (err) {
    (self as unknown as Worker).postMessage({ tier, error: (err as Error).message });
  }
};
