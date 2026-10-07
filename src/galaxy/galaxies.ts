import { Matrix3, Vector3 } from 'three';
import { _ } from '../i18n';
import { raDecToScene } from '../math/frames';
import { Rng, hashSeed } from '../gen/SystemGenerator';
import { GalaxyModel, type GalaxyParams, type GalaxyType } from './GalaxyModel';
import { galaxyBasisFromSky, milkyWayBasis, milkyWayCenterPc } from './frames';

const MPC = 1e6;

interface CatalogGalaxy {
  name: string; ra: number; dec: number; distMpc: number; type: GalaxyType;
  diameterKpc: number; absMag: number; pa?: number; inc?: number; axis?: number; desc?: string;
}

/** Real galaxies: Local Group + bright Messier/NGC objects (approximate parameters). */
const CATALOG: CatalogGalaxy[] = [
  { name: 'Andromeda (M31)', ra: 10.685, dec: 41.269, distMpc: 0.78, type: 'S', diameterKpc: 46, absMag: -21.5, pa: 35, inc: 77, desc: 'Yerel Grup\'un en büyük galaksisi; Samanyolu ile ~4.5 milyar yıl sonra birleşecek.' },
  { name: 'Üçgen (M33)', ra: 23.462, dec: 30.660, distMpc: 0.84, type: 'S', diameterKpc: 18, absMag: -18.9, pa: 23, inc: 54, desc: 'Yerel Grup\'un üçüncü büyük üyesi; çıplak gözle görülebilen en uzak cisimlerden biri.' },
  { name: 'Büyük Macellan Bulutu', ra: 80.894, dec: -69.756, distMpc: 0.050, type: 'Irr', diameterKpc: 9.9, absMag: -18.1, pa: 170, inc: 35, desc: 'Samanyolu\'nun en parlak uydu galaksisi. Tarantula Bulutsusu gibi dev yıldız oluşum bölgeleri barındırır.' },
  { name: 'Küçük Macellan Bulutu', ra: 13.187, dec: -72.829, distMpc: 0.061, type: 'Irr', diameterKpc: 5.8, absMag: -16.8, pa: 45, inc: 60, desc: 'Samanyolu\'nun cüce düzensiz uydu galaksisi.' },
  { name: 'M32', ra: 10.674, dec: 40.865, distMpc: 0.76, type: 'E', diameterKpc: 2.5, absMag: -16.4, axis: 0.75, desc: 'Andromeda\'nın kompakt eliptik uydusu.' },
  { name: 'M110', ra: 10.092, dec: 41.685, distMpc: 0.82, type: 'E', diameterKpc: 5.2, absMag: -16.5, pa: 170, inc: 60, axis: 0.5, desc: 'Andromeda\'nın cüce eliptik uydusu.' },
  { name: 'Barnard Galaksisi (NGC 6822)', ra: 296.235, dec: -14.789, distMpc: 0.50, type: 'Irr', diameterKpc: 2.2, absMag: -15.2 },
  { name: 'IC 1613', ra: 16.199, dec: 2.118, distMpc: 0.73, type: 'Irr', diameterKpc: 2.6, absMag: -14.5 },
  { name: 'WLM', ra: 0.492, dec: -15.461, distMpc: 0.93, type: 'Irr', diameterKpc: 3.1, absMag: -14.2 },
  { name: 'Heykeltıraş Cücesi', ra: 15.039, dec: -33.709, distMpc: 0.086, type: 'E', diameterKpc: 1.5, absMag: -11.1, axis: 0.7 },
  { name: 'Fornax Cücesi', ra: 39.997, dec: -34.449, distMpc: 0.14, type: 'E', diameterKpc: 2.0, absMag: -13.4, axis: 0.7 },
  { name: 'Leo I', ra: 152.117, dec: 12.306, distMpc: 0.25, type: 'E', diameterKpc: 1.0, absMag: -12.0, axis: 0.8 },
  { name: 'Yay Cüce Galaksisi', ra: 283.76, dec: -30.48, distMpc: 0.020, type: 'E', diameterKpc: 3.0, absMag: -13.5, axis: 0.5, desc: 'Samanyolu tarafından parçalanmakta olan cüce uydu; Galaktik merkezin arkasında.' },
  { name: 'Heykeltıraş Galaksisi (NGC 253)', ra: 11.888, dec: -25.288, distMpc: 3.5, type: 'SB', diameterKpc: 27, absMag: -21.0, pa: 52, inc: 78, desc: 'Yoğun yıldız oluşumlu "starburst" galaksi.' },
  { name: 'NGC 55', ra: 3.723, dec: -39.197, distMpc: 2.1, type: 'Irr', diameterKpc: 20, absMag: -18.5, pa: 108, inc: 80 },
  { name: 'NGC 300', ra: 13.723, dec: -37.684, distMpc: 1.9, type: 'S', diameterKpc: 20, absMag: -18.5, pa: 111, inc: 42 },
  { name: 'Centaurus A (NGC 5128)', ra: 201.365, dec: -43.019, distMpc: 3.8, type: 'S0', diameterKpc: 25, absMag: -21.0, pa: 35, inc: 60, desc: 'En yakın aktif galaksi çekirdeği; dev radyo lobları ve belirgin toz şeridi.' },
  { name: 'Güney Fırıldak (M83)', ra: 204.254, dec: -29.866, distMpc: 4.6, type: 'SB', diameterKpc: 26, absMag: -20.8, pa: 45, inc: 24 },
  { name: 'Bode Galaksisi (M81)', ra: 148.888, dec: 69.065, distMpc: 3.6, type: 'S', diameterKpc: 27, absMag: -21.1, pa: 157, inc: 60 },
  { name: 'Puro Galaksisi (M82)', ra: 148.968, dec: 69.680, distMpc: 3.5, type: 'Irr', diameterKpc: 11, absMag: -19.6, pa: 65, inc: 80, desc: 'M81 ile etkileşim sonucu patlayıcı yıldız oluşumu yaşayan galaksi.' },
  { name: 'NGC 2403', ra: 114.214, dec: 65.603, distMpc: 3.2, type: 'S', diameterKpc: 21, absMag: -19.3, pa: 127, inc: 60 },
  { name: 'Fırıldak (M101)', ra: 210.802, dec: 54.349, distMpc: 6.4, type: 'S', diameterKpc: 52, absMag: -21.5, pa: 35, inc: 18, desc: 'Samanyolu\'nun neredeyse iki katı büyüklüğünde, yüzümüze dönük dev sarmal.' },
  { name: 'Girdap (M51)', ra: 202.470, dec: 47.195, distMpc: 8.6, type: 'S', diameterKpc: 23, absMag: -21.0, pa: 163, inc: 22, desc: 'Küçük eşlikçisi NGC 5195 ile etkileşen klasik "büyük tasarım" sarmalı.' },
  { name: 'Sombrero (M104)', ra: 189.998, dec: -11.623, distMpc: 9.6, type: 'S0', diameterKpc: 29, absMag: -21.7, pa: 89, inc: 84, desc: 'Devasa şişkinliği ve keskin toz halkasıyla tanınır.' },
  { name: 'Virgo A (M87)', ra: 187.706, dec: 12.391, distMpc: 16.4, type: 'E', diameterKpc: 40, absMag: -22.3, axis: 0.85, desc: 'Başak Kümesi\'nin devi; 6.5 milyar güneş kütleli kara deliği ilk görüntülenen kara deliktir.' },
  { name: 'M49', ra: 187.445, dec: 8.000, distMpc: 17.1, type: 'E', diameterKpc: 47, absMag: -22.6, axis: 0.8 },
  { name: 'M60', ra: 190.917, dec: 11.553, distMpc: 16.8, type: 'E', diameterKpc: 35, absMag: -22.2, axis: 0.8 },
  { name: 'M86', ra: 186.549, dec: 12.946, distMpc: 15.2, type: 'S0', diameterKpc: 39, absMag: -22.0, axis: 0.65 },
  { name: 'M84', ra: 186.266, dec: 12.887, distMpc: 16.8, type: 'E', diameterKpc: 30, absMag: -21.8, axis: 0.9 },
  { name: 'M100', ra: 185.729, dec: 15.822, distMpc: 16.0, type: 'S', diameterKpc: 32, absMag: -21.7, pa: 30, inc: 28 },
  { name: 'M99', ra: 184.707, dec: 14.416, distMpc: 15.2, type: 'S', diameterKpc: 27, absMag: -21.2, pa: 50, inc: 20 },
  { name: 'M61', ra: 185.479, dec: 4.474, distMpc: 16.0, type: 'SB', diameterKpc: 30, absMag: -21.3, pa: 10, inc: 20 },
  { name: 'Kara Göz (M64)', ra: 194.182, dec: 21.683, distMpc: 5.3, type: 'S', diameterKpc: 16, absMag: -20.3, pa: 115, inc: 60 },
  { name: 'Ayçiçeği (M63)', ra: 198.955, dec: 42.029, distMpc: 8.9, type: 'S', diameterKpc: 29, absMag: -21.0, pa: 105, inc: 55 },
  { name: 'M94', ra: 192.721, dec: 41.120, distMpc: 4.7, type: 'S', diameterKpc: 15, absMag: -19.9, pa: 120, inc: 35 },
  { name: 'M106', ra: 184.740, dec: 47.304, distMpc: 7.2, type: 'SB', diameterKpc: 40, absMag: -21.3, pa: 150, inc: 70 },
  { name: 'Hayalet (M74)', ra: 24.174, dec: 15.783, distMpc: 9.0, type: 'S', diameterKpc: 26, absMag: -20.8, pa: 25, inc: 20 },
  { name: 'M77', ra: 40.670, dec: -0.013, distMpc: 12.9, type: 'SB', diameterKpc: 27, absMag: -21.5, pa: 70, inc: 30, desc: 'En yakın ve en parlak Seyfert galaksilerinden biri.' },
  { name: 'M65', ra: 169.733, dec: 13.092, distMpc: 10.7, type: 'SB', diameterKpc: 28, absMag: -21.0, pa: 174, inc: 70 },
  { name: 'M66', ra: 170.063, dec: 12.991, distMpc: 10.7, type: 'SB', diameterKpc: 29, absMag: -21.3, pa: 173, inc: 55 },
  { name: 'NGC 3628', ra: 170.071, dec: 13.589, distMpc: 10.7, type: 'S', diameterKpc: 30, absMag: -20.6, pa: 104, inc: 87 },
  { name: 'M95', ra: 160.990, dec: 11.704, distMpc: 10.0, type: 'SB', diameterKpc: 21, absMag: -20.4, pa: 13, inc: 45 },
  { name: 'M96', ra: 161.691, dec: 11.820, distMpc: 9.4, type: 'SB', diameterKpc: 22, absMag: -20.7, pa: 176, inc: 50 },
  { name: 'M105', ra: 161.957, dec: 12.582, distMpc: 10.6, type: 'E', diameterKpc: 16, absMag: -20.6, axis: 0.9 },
  { name: 'M108', ra: 167.879, dec: 55.674, distMpc: 14.1, type: 'SB', diameterKpc: 35, absMag: -21.0, pa: 80, inc: 80 },
  { name: 'M109', ra: 179.400, dec: 53.375, distMpc: 16.9, type: 'SB', diameterKpc: 37, absMag: -21.5, pa: 63, inc: 45 },
  { name: 'NGC 891', ra: 35.639, dec: 42.349, distMpc: 9.1, type: 'S', diameterKpc: 33, absMag: -20.9, pa: 22, inc: 89, desc: 'Tam kenardan görülen, Samanyolu\'na çok benzeyen sarmal.' },
  { name: 'İğne Galaksisi (NGC 4565)', ra: 189.087, dec: 25.988, distMpc: 11.9, type: 'S', diameterKpc: 55, absMag: -21.7, pa: 136, inc: 88 },
  { name: 'NGC 1300', ra: 49.921, dec: -19.411, distMpc: 18.7, type: 'SB', diameterKpc: 33, absMag: -21.3, pa: 106, inc: 35, desc: 'Ders kitabı çubuklu sarmal.' },
  { name: 'NGC 7331', ra: 339.267, dec: 34.416, distMpc: 12.2, type: 'S', diameterKpc: 37, absMag: -21.6, pa: 171, inc: 70 },
  { name: 'Fornax A (NGC 1316)', ra: 50.674, dec: -37.208, distMpc: 19.0, type: 'S0', diameterKpc: 45, absMag: -22.8, axis: 0.7 },
  { name: 'NGC 1365', ra: 53.402, dec: -36.140, distMpc: 17.9, type: 'SB', diameterKpc: 60, absMag: -22.3, pa: 32, inc: 40 },
  { name: 'M58', ra: 189.431, dec: 11.818, distMpc: 19.1, type: 'SB', diameterKpc: 34, absMag: -21.5, pa: 95, inc: 40 },
  { name: 'Antenler (NGC 4038/4039)', ra: 180.470, dec: -18.867, distMpc: 22, type: 'Irr', diameterKpc: 30, absMag: -21.0, desc: 'Birleşmekte olan iki sarmal galaksi.' },
];

export const TYPE_CODE: Record<GalaxyType, number> = { E: 0, S0: 1, S: 2, SB: 3, Irr: 4 };
const TYPE_BY_CODE: GalaxyType[] = ['E', 'S0', 'S', 'SB', 'Irr'];

/** Anything the galaxy sprite renderer can draw (the local index and the far-universe tiers). */
export interface GalaxySource {
  readonly count: number;
  /** entries [0, catalogCount) may be labelled */
  readonly catalogCount: number;
  /** pc, scene frame, relative to the Sun */
  readonly positions: Float32Array;
  readonly radius: Float32Array;
  readonly absMag: Float32Array;
  readonly type: Uint8Array;
  readonly seed: Uint32Array;
  readonly normal: Float32Array;
  readonly major: Float32Array;
  readonly axisRatio: Float32Array;
  /** spiral arm count / pitch angle (deg) — absent for unresolved aggregate tiers */
  readonly arms?: Float32Array;
  readonly pitch?: Float32Array;
  name(i: number): string;
}

/** Cheap 3D value noise for the cosmic web */
export function vnoise(x: number, y: number, z: number): number {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = x - xi, yf = y - yi, zf = z - zi;
  const h = (a: number, b: number, c: number) => {
    let n = (a * 374761393 + b * 668265263 + c * 2147483647) | 0;
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  };
  const s = (t: number) => t * t * (3 - 2 * t);
  const u = s(xf), v = s(yf), w = s(zf);
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  return lerp(
    lerp(lerp(h(xi, yi, zi), h(xi + 1, yi, zi), u), lerp(h(xi, yi + 1, zi), h(xi + 1, yi + 1, zi), u), v),
    lerp(lerp(h(xi, yi, zi + 1), h(xi + 1, yi, zi + 1), u), lerp(h(xi, yi + 1, zi + 1), h(xi + 1, yi + 1, zi + 1), u), v),
    w,
  );
}

/**
 * Flat index of every galaxy: index 0 = Milky Way, then the real catalogue, then a procedural
 * cosmic web out to ~250 Mpc. Full `GalaxyModel`s are built lazily.
 */
export class GalaxyIndex {
  readonly count: number;
  readonly catalogCount: number;
  /** pc, scene frame, relative to the Sun */
  readonly positions: Float32Array;
  readonly radius: Float32Array;      // pc
  readonly absMag: Float32Array;
  readonly type: Uint8Array;
  readonly seed: Uint32Array;
  /** disc normal (scene frame) */
  readonly normal: Float32Array;
  /** in-plane major axis (scene frame) */
  readonly major: Float32Array;
  readonly axisRatio: Float32Array;
  /** spiral arm count (S / SB; shared by the analytic model and the sprite shader) */
  readonly arms: Float32Array;
  /** pitch angle (deg) */
  readonly pitch: Float32Array;
  private readonly models = new Map<number, GalaxyModel>();

  constructor(proceduralCount = 110_000) {
    const N = 1 + CATALOG.length + proceduralCount;
    this.positions = new Float32Array(N * 3);
    this.radius = new Float32Array(N);
    this.absMag = new Float32Array(N);
    this.type = new Uint8Array(N);
    this.seed = new Uint32Array(N);
    this.normal = new Float32Array(N * 3);
    this.major = new Float32Array(N * 3);
    this.axisRatio = new Float32Array(N);
    this.catalogCount = 1 + CATALOG.length;

    const basis = new Matrix3();
    const setBasis = (i: number, b: Matrix3) => {
      const m = b.elements;
      this.major[i * 3] = m[0]; this.major[i * 3 + 1] = m[1]; this.major[i * 3 + 2] = m[2];
      this.normal[i * 3] = m[3]; this.normal[i * 3 + 1] = m[4]; this.normal[i * 3 + 2] = m[5];
    };

    // 0: Milky Way
    const mwC = milkyWayCenterPc();
    this.positions.set([mwC.x, mwC.y, mwC.z], 0);
    this.radius[0] = 15_000;
    this.absMag[0] = -20.9;
    this.type[0] = TYPE_CODE.SB;
    this.seed[0] = 1;
    this.axisRatio[0] = 0.1;
    setBasis(0, milkyWayBasis(basis));

    // Real galaxies
    const dir = new Vector3();
    CATALOG.forEach((g, k) => {
      const i = 1 + k;
      raDecToScene(g.ra, g.dec, dir);
      const d = g.distMpc * MPC;
      this.positions[i * 3] = dir.x * d; this.positions[i * 3 + 1] = dir.y * d; this.positions[i * 3 + 2] = dir.z * d;
      this.radius[i] = (g.diameterKpc * 1000) / 2;
      this.absMag[i] = g.absMag;
      this.type[i] = TYPE_CODE[g.type];
      this.seed[i] = hashSeed(i, 0x6a1a);
      this.axisRatio[i] = g.axis ?? (g.type === 'E' ? 0.75 : 0.12);
      setBasis(i, galaxyBasisFromSky(dir, g.pa ?? 0, g.inc ?? (g.type === 'E' ? 40 : 45), basis));
    });

    // Procedural cosmic web: cluster nodes, filaments between neighbouring nodes, and a sparse
    // field population. `env` (0 field … 1 cluster core) biases luminosity and Hubble type.
    const rng = new Rng(0xC05A11C);
    const box = 250 * MPC;
    let i = this.catalogCount;
    const gauss = () => {
      const u1 = Math.max(rng.next(), 1e-9), u2 = rng.next();
      return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    };
    const place = (x: number, y: number, z: number, env: number): void => {
      if (i >= N) return;
      const dSun = Math.sqrt(x * x + y * y + z * z);
      // spherical local volume (a cube would be visible from outside as a box of galaxies)
      if (dSun < 2.5 * MPC || dSun > box) return;
      const M = -16.5 - 6.2 * Math.pow(rng.next(), 0.55 + 0.45 * (1 - env)) - env * 0.6;
      const tr = rng.next();
      const pE = 0.1 + 0.35 * env, pS0 = pE + 0.1 + 0.2 * env, pS = pS0 + 0.36 * (1 - env * 0.6), pSB = pS + 0.24 * (1 - env * 0.6);
      const t: GalaxyType = tr < pE ? 'E' : tr < pS0 ? 'S0' : tr < pS ? 'S' : tr < pSB ? 'SB' : 'Irr';
      this.positions[i * 3] = x; this.positions[i * 3 + 1] = y; this.positions[i * 3 + 2] = z;
      this.radius[i] = 2000 * Math.pow(10, (-M - 16) / 5) * (t === 'Irr' ? 0.6 : 1);
      this.absMag[i] = M;
      this.type[i] = TYPE_CODE[t];
      this.seed[i] = hashSeed(i, 0x9a1a, Math.floor(x / 1e5));
      this.axisRatio[i] = t === 'E' ? 0.5 + rng.next() * 0.5 : 0.08 + rng.next() * 0.08;
      // random orientation
      const nrm = new Vector3(rng.next() * 2 - 1, rng.next() * 2 - 1, rng.next() * 2 - 1).normalize();
      const tmp = Math.abs(nrm.y) < 0.9 ? new Vector3(0, 1, 0) : new Vector3(1, 0, 0);
      const maj = new Vector3().crossVectors(tmp, nrm).normalize();
      this.normal[i * 3] = nrm.x; this.normal[i * 3 + 1] = nrm.y; this.normal[i * 3 + 2] = nrm.z;
      this.major[i * 3] = maj.x; this.major[i * 3 + 1] = maj.y; this.major[i * 3 + 2] = maj.z;
      i++;
    };

    // 1. nodes (cluster / group centres) – denser where the large-scale noise is high
    const nodeCount = 1100;
    const nodes: Array<{ x: number; y: number; z: number; rich: number; r: number }> = [];
    while (nodes.length < nodeCount) {
      const x = (rng.next() * 2 - 1) * box, y = (rng.next() * 2 - 1) * box, z = (rng.next() * 2 - 1) * box;
      const s1 = 1 / (45 * MPC);
      const n1 = vnoise(x * s1 + 13.1, y * s1 + 7.7, z * s1 + 3.3);
      if (rng.next() > 0.15 + 0.85 * n1 * n1) continue;
      const rich = Math.pow(rng.next(), 2.2); // few rich clusters, many poor groups
      nodes.push({ x, y, z, rich, r: (0.8 + 2.2 * rich) * MPC });
    }
    // the Virgo cluster (real) is a node too, so procedural filaments lead toward it
    raDecToScene(187.7, 12.4, dir);
    nodes.push({ x: dir.x * 16.5 * MPC, y: dir.y * 16.5 * MPC, z: dir.z * 16.5 * MPC, rich: 0.9, r: 2.2 * MPC });

    const clusterBudget = Math.floor(proceduralCount * 0.42);
    const filamentBudget = Math.floor(proceduralCount * 0.40);
    const richSum = nodes.reduce((s, n) => s + 0.15 + n.rich, 0);

    // 2. cluster members: roughly NFW-like (steep core, r^-2.5 wings)
    for (const n of nodes) {
      const members = Math.max(6, Math.round(clusterBudget * (0.15 + n.rich) / richSum));
      for (let k = 0; k < members && i < N; k++) {
        const u = rng.next();
        const rad = n.r * 1.4 * Math.pow(u, 0.75) * (1 + 0.5 * Math.abs(gauss()));
        const v = new Vector3(gauss(), gauss(), gauss()).normalize().multiplyScalar(rad);
        const env = Math.max(0, 1 - rad / (n.r * 2.5));
        place(n.x + v.x, n.y + v.y, n.z + v.z, 0.5 + 0.5 * env);
      }
    }

    // 3. filaments: each node connects to its 2–3 nearest neighbours
    const edges: Array<[number, number]> = [];
    const seen = new Set<number>();
    for (let a = 0; a < nodes.length; a++) {
      const na = nodes[a];
      const near: Array<[number, number]> = [];
      for (let b = 0; b < nodes.length; b++) {
        if (a === b) continue;
        const nb = nodes[b];
        const d2 = (na.x - nb.x) ** 2 + (na.y - nb.y) ** 2 + (na.z - nb.z) ** 2;
        near.push([d2, b]);
      }
      near.sort((p, q) => p[0] - q[0]);
      const links = 2 + (rng.next() < 0.5 ? 1 : 0);
      for (let k = 0; k < links; k++) {
        const b = near[k][1];
        const key = a < b ? a * 4096 + b : b * 4096 + a;
        if (seen.has(key)) continue;
        seen.add(key);
        edges.push([a, b]);
      }
    }
    const lengthSum = edges.reduce((s, [a, b]) => s + Math.hypot(nodes[a].x - nodes[b].x, nodes[a].y - nodes[b].y, nodes[a].z - nodes[b].z), 0);
    for (const [a, b] of edges) {
      const na = nodes[a], nb = nodes[b];
      const L = Math.hypot(na.x - nb.x, na.y - nb.y, na.z - nb.z);
      const count = Math.round(filamentBudget * L / lengthSum);
      // slight bow so filaments aren't perfectly straight
      const bow = new Vector3(gauss(), gauss(), gauss()).normalize().multiplyScalar(L * 0.08 * rng.next());
      for (let k = 0; k < count && i < N; k++) {
        const t = rng.next();
        const sig = (1.2 + 0.8 * rng.next()) * MPC;
        const bx = bow.x * 4 * t * (1 - t), by = bow.y * 4 * t * (1 - t), bz = bow.z * 4 * t * (1 - t);
        place(
          na.x + (nb.x - na.x) * t + bx + gauss() * sig,
          na.y + (nb.y - na.y) * t + by + gauss() * sig,
          na.z + (nb.z - na.z) * t + bz + gauss() * sig,
          0.25,
        );
      }
    }

    // 4. field galaxies (avoid the emptiest voids)
    let tries = 0;
    while (i < N && tries < proceduralCount * 20) {
      tries++;
      const x = (rng.next() * 2 - 1) * box, y = (rng.next() * 2 - 1) * box, z = (rng.next() * 2 - 1) * box;
      const s2 = 1 / (18 * MPC);
      const n2 = vnoise(x * s2 + 101.5, y * s2 + 55.2, z * s2 + 9.9);
      if (rng.next() > n2 * n2) continue;
      place(x, y, z, 0.05);
    }
    this.count = i;

    // spiral geometry, derived from the seed exactly as the GalaxyModel always did
    this.arms = new Float32Array(N);
    this.pitch = new Float32Array(N);
    for (let k = 0; k < this.count; k++) {
      const t = this.typeOf(k);
      const r = new Rng(this.seed[k]);
      this.arms[k] = k === 0 ? 4 : t === 'SB' ? 2 : 2 + Math.floor(r.next() * 3);
      this.pitch[k] = k === 0 ? 14 : 10 + r.next() * 14;
    }
  }

  /** untranslated (source) name — use for matching catalogue references */
  rawName(i: number): string {
    if (i === 0) return 'Samanyolu';
    if (i < this.catalogCount) return CATALOG[i - 1].name;
    return `Galaksi YE-${(this.seed[i] % 0xffffff).toString(16).toUpperCase().padStart(6, '0')}`;
  }

  name(i: number): string {
    if (i >= this.catalogCount) return _('Galaksi YE-{code}', { code: (this.seed[i] % 0xffffff).toString(16).toUpperCase().padStart(6, '0') });
    if (i === 0) return _('Samanyolu');
    return _(this.rawName(i));
  }

  typeOf(i: number): GalaxyType { return TYPE_BY_CODE[this.type[i]]; }

  position(i: number, out = new Vector3()): Vector3 {
    return out.set(this.positions[i * 3], this.positions[i * 3 + 1], this.positions[i * 3 + 2]);
  }

  distancePc(i: number): number {
    return Math.hypot(this.positions[i * 3], this.positions[i * 3 + 1], this.positions[i * 3 + 2]);
  }

  /** Lazily build the analytic model of galaxy i */
  model(i: number): GalaxyModel {
    let m = this.models.get(i);
    if (m) return m;
    const t = this.typeOf(i);
    const major = new Vector3(this.major[i * 3], this.major[i * 3 + 1], this.major[i * 3 + 2]);
    const normal = new Vector3(this.normal[i * 3], this.normal[i * 3 + 1], this.normal[i * 3 + 2]);
    const z = new Vector3().crossVectors(major, normal).normalize();
    const basis = new Matrix3().set(major.x, normal.x, z.x, major.y, normal.y, z.y, major.z, normal.z, z.z);
    const params: GalaxyParams = {
      id: `g${i}`,
      name: this.name(i),
      type: t,
      seed: this.seed[i],
      center: this.position(i),
      basis,
      radius: this.radius[i],
      absMag: this.absMag[i],
      arms: this.arms[i],
      pitchDeg: this.pitch[i],
      axisRatio: this.axisRatio[i],
      description: i === 0
        ? _('Ev galaksimiz: ~13 milyar yıllık, 100–400 milyar yıldızlı çubuklu sarmal. Güneş, merkezden ~8.2 kpc uzakta Orion Kolu\'nda yer alır.')
        : i < this.catalogCount ? (CATALOG[i - 1].desc ? _(CATALOG[i - 1].desc!) : undefined) : _('Prosedürel olarak üretilmiş galaksi; konumu kozmik ağ yoğunluk modelinden, yapısı Hubble tipinden türetildi.'),
      catalog: i < this.catalogCount,
      distancePc: this.distancePc(i),
    };
    m = new GalaxyModel(params);
    if (this.models.size > 12) {
      for (const k of this.models.keys()) { if (k !== 0) { this.models.delete(k); break; } }
    }
    this.models.set(i, m);
    return m;
  }

  /**
   * Galaxy that "owns" a point (pc, relative to the Sun): the one with the smallest
   * distance / (k·radius). Returns null when the point is in intergalactic space.
   */
  containing(p: Vector3, k = 3): number | null {
    let best = -1, bestScore = Infinity;
    for (let i = 0; i < this.count; i++) {
      const dx = this.positions[i * 3] - p.x, dy = this.positions[i * 3 + 1] - p.y, dz = this.positions[i * 3 + 2] - p.z;
      const score = Math.sqrt(dx * dx + dy * dy + dz * dz) / (k * this.radius[i]);
      if (score < bestScore) { bestScore = score; best = i; }
    }
    return bestScore < 1 ? best : null;
  }

  /** Nearest galaxy surface distance (pc) from a point – used for speed scaling */
  nearestSurfaceDistance(p: Vector3): number {
    let best = Infinity;
    for (let i = 0; i < this.count; i++) {
      const dx = this.positions[i * 3] - p.x, dy = this.positions[i * 3 + 1] - p.y, dz = this.positions[i * 3 + 2] - p.z;
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz) - this.radius[i];
      if (d < best) best = d;
    }
    return Math.max(best, 0);
  }

  search(query: string, limit = 6): number[] {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const hits: number[] = [];
    for (let i = 0; i < this.catalogCount; i++) {
      if (this.name(i).toLowerCase().includes(q) || this.rawName(i).toLowerCase().includes(q)) hits.push(i);
    }
    const m = /^ye-([0-9a-f]{6})$/i.exec(q);
    if (m) {
      const code = parseInt(m[1], 16);
      for (let i = this.catalogCount; i < this.count; i++) if (this.seed[i] % 0xffffff === code) { hits.push(i); break; }
    }
    return hits.slice(0, limit);
  }
}
