import { Quaternion, Vector3 } from 'three';
import type { LandmarkDef } from '../../data/landmarks';
import type { ProcKind } from '../../galaxy/ProcLandmarks';
import { Rng } from '../../gen/SystemGenerator';

/**
 * Nebula Engine 2.0 — the data contract between an object's identity and its volumetric look.
 *
 * A profile is derived from the landmark id alone (plus the generator's class when it is a
 * procedural object), so the same nebula looks the same on every visit, in every saved place and
 * in every deep link. The visual algorithm is versioned separately from the id: bumping
 * `NEBULA_ALGORITHM_VERSION` may change what a nebula looks like, never where it is, what it is
 * called or which stars belong to it.
 *
 * Every random draw inside the profile is taken from its own salted stream (shape, dust, lights,
 * filaments, micro detail), so tuning the number of draws in one of them does not reshuffle the
 * others.
 */
export const NEBULA_ALGORITHM_VERSION = 1;

export type NebulaMorphology =
  | 'hii-cavity'        // a young cluster has blown a cavity; bright ionisation front on its wall
  | 'hii-pillars'       // the same, with the molecular cloud still pressing in: pillars and globules
  | 'molecular-dark'    // cold dust with hardly any glow of its own
  | 'reflection-wisps'  // dust wisps scattering the blue light of embedded stars
  | 'planetary-shell'   // thin (possibly concentric) shells around a hot core
  | 'planetary-bipolar' // two lobes pinched by an equatorial dust torus
  | 'snr-filaments'     // supernova remnant: shocked filamentary shell, hot interior
  | 'wind-bubble';      // Wolf–Rayet / O-star wind bubble: smoother, [O III]-bright shell

export const MORPHOLOGY_CODE: Record<NebulaMorphology, number> = {
  'hii-cavity': 0, 'hii-pillars': 1, 'molecular-dark': 2, 'reflection-wisps': 3,
  'planetary-shell': 4, 'planetary-bipolar': 5, 'snr-filaments': 6, 'wind-bubble': 7,
};

/** Emission-line palettes (linear RGB, roughly the colours photographic Hα / [O III] / [S II] composites give) */
export type NebulaPalette = 'halpha-oiii' | 'halpha-sii' | 'oiii-blue' | 'reflection-blue' | 'snr-mixed';
export const PALETTE_CODE: Record<NebulaPalette, number> = { 'halpha-oiii': 0, 'halpha-sii': 1, 'oiii-blue': 2, 'reflection-blue': 3, 'snr-mixed': 4 };

/** A star lighting the medium from inside; positions in object radii, the object centre at 0 */
export interface NebulaLight {
  position: Vector3;
  /** linear RGB */
  color: Vector3;
  /** relative to the brightest light of the profile (1) */
  intensity: number;
}

export interface NebulaProfile {
  /** the landmark id this profile belongs to (never an id of its own) */
  id: string;
  source: 'catalog' | 'procedural';
  morphology: NebulaMorphology;
  /** hash of id and algorithm version: the root of the salted streams */
  seed: number;
  algorithmVersion: number;
  extentPc: number;
  orientation: Quaternion;
  /** strength of the intrinsic line emission (1 = the kind's reference) */
  emissionScale: number;
  /** strength of the dust extinction (1 = the kind's reference) */
  extinctionScale: number;
  /** domain-warp amplitude: 0 smooth blobs … 1 heavily wisped */
  turbulence: number;
  /** spatial frequency of filaments / pillars relative to the extent */
  filamentScale: number;
  /** cavity radius around the primary light, in object radii (H II / bubbles) */
  cavityScale: number;
  paletteId: NebulaPalette;
  /** catalogue tint (the sprite's colour), blended into the palette */
  tint: [number, number, number];
  /** 1 … 4 local lights, brightest first */
  lights: NebulaLight[];
  /** second concentric shell (planetaries) / the denser side of the ISM (remnants): a unit axis */
  axis: Vector3;
  /** planetary: 1 when a second, older shell surrounds the main one */
  doubleShell: number;
  /** photograph / catalogue the reconstruction is fitted to (phase 2) */
  observationId?: string;
}

// salts of the independent random streams
const SALT_SHAPE = 0x5a1e, SALT_DUST = 0xd057, SALT_LIGHTS = 0x11f5, SALT_FILAMENTS = 0xf11a, SALT_MICRO = 0x3c80;

/** FNV-1a of a string */
export function hashId(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h >>> 0;
}

function mixSeed(a: number, b: number): number {
  let h = (Math.imul(a | 0, 0x9e3779b1) ^ Math.imul(b | 0, 0x85ebca6b)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
  return (h ^ (h >>> 12)) >>> 0;
}

/**
 * Which family a landmark belongs to. Procedural objects say so explicitly (their generator's
 * class); catalogue objects are read from their id prefix and kind, with the colour deciding
 * between an emission and a reflection nebula where the catalogue only says "nebula".
 */
function family(def: LandmarkDef, procKind: ProcKind | undefined, shape: Rng): NebulaMorphology {
  const id = def.id;
  const kind = procKind ?? (
    id.startsWith('d-hii-') ? 'hii'
      : id.startsWith('d-pn-') ? 'planetary'
        : id.startsWith('d-snr-') ? 'snr'
          : def.kind === 'planetary' ? 'planetary'
            // a few hand-picked remnants carry the planetary tint (M57, M27, Helix)
            : def.kind === 'remnant' ? (def.color[1] > def.color[0] ? 'planetary' : 'snr')
              : def.color[2] > def.color[0] * 1.1 ? 'reflection' : 'hii');
  switch (kind) {
    case 'hii': return shape.chance(0.55) ? 'hii-cavity' : 'hii-pillars';
    case 'reflection': return 'reflection-wisps';
    case 'planetary': return shape.chance(0.45) ? 'planetary-bipolar' : 'planetary-shell';
    case 'snr': return 'snr-filaments';
    case 'bubble': return 'wind-bubble';
    default: return 'hii-cavity';
  }
}

function ballPoint(rng: Rng, out = new Vector3()): Vector3 {
  for (;;) {
    out.set(rng.range(-1, 1), rng.range(-1, 1), rng.range(-1, 1));
    if (out.lengthSq() <= 1) return out;
  }
}

/** blackbody-ish star colours in linear RGB by rough spectral class */
const STAR_O = new Vector3(0.62, 0.72, 1.0), STAR_B = new Vector3(0.72, 0.8, 1.0), STAR_A = new Vector3(0.9, 0.93, 1.0), STAR_WD = new Vector3(0.75, 0.85, 1.0);

/**
 * Resolve the profile of a nebula landmark. Deterministic: the same (id, class, algorithm version)
 * always gives the same profile.
 */
export function resolveNebulaProfile(def: LandmarkDef, procKind?: ProcKind): NebulaProfile {
  // SHAPE and LIGHTS are part of the object's identity (the exciting cluster — real, selectable
  // stars — sits where the primary light is), so they are seeded from the id alone and never
  // move with the algorithm version; the texture streams (DUST, FILAMENTS, MICRO) may.
  const identity = hashId(def.id);
  const seed = mixSeed(identity, NEBULA_ALGORITHM_VERSION * 0x1003f);
  const shape = new Rng(mixSeed(identity, SALT_SHAPE));
  const lightsRng = new Rng(mixSeed(identity, SALT_LIGHTS));
  const dust = new Rng(mixSeed(seed, SALT_DUST));
  const fil = new Rng(mixSeed(seed, SALT_FILAMENTS));
  const micro = new Rng(mixSeed(seed, SALT_MICRO));
  const morphology = family(def, procKind, shape);
  const orientation = new Quaternion().setFromAxisAngle(ballPoint(shape).normalize(), shape.range(0, Math.PI * 2));
  const axis = ballPoint(shape).normalize();
  const lights: NebulaLight[] = [];
  let paletteId: NebulaPalette = 'halpha-oiii';
  let emissionScale = 1, extinctionScale = 1, cavityScale = 0.3, doubleShell = 0;
  const turbulence = fil.range(0.35, 0.8);
  const filamentScale = fil.range(0.8, 1.4);
  switch (morphology) {
    case 'hii-cavity':
    case 'hii-pillars': {
      // the exciting cluster sits off-centre; it is the brightest light, 1–3 fainter B stars around
      const core = ballPoint(lightsRng).multiplyScalar(morphology === 'hii-cavity' ? 0.25 : 0.4);
      lights.push({ position: core, color: STAR_O.clone(), intensity: 1 });
      const n = lightsRng.int(1, 3);
      for (let i = 0; i < n; i++) lights.push({ position: ballPoint(lightsRng).multiplyScalar(0.7), color: STAR_B.clone(), intensity: lightsRng.range(0.08, 0.3) });
      cavityScale = morphology === 'hii-cavity' ? shape.range(0.3, 0.45) : shape.range(0.15, 0.28);
      paletteId = shape.chance(0.3) ? 'halpha-sii' : 'halpha-oiii';
      emissionScale = micro.range(0.8, 1.25);
      extinctionScale = dust.range(0.7, 1.4) * (morphology === 'hii-pillars' ? 1.3 : 1);
      break;
    }
    case 'molecular-dark':
      lights.push({ position: ballPoint(lightsRng).multiplyScalar(0.9), color: STAR_B.clone(), intensity: 1 });
      paletteId = 'halpha-sii';
      emissionScale = 0.15;
      extinctionScale = dust.range(1.8, 2.6);
      break;
    case 'reflection-wisps': {
      const n = lightsRng.int(1, 3);
      for (let i = 0; i < n; i++) lights.push({ position: ballPoint(lightsRng).multiplyScalar(i === 0 ? 0.3 : 0.7), color: (i === 0 ? STAR_B : STAR_A).clone(), intensity: i === 0 ? 1 : lightsRng.range(0.2, 0.5) });
      paletteId = 'reflection-blue';
      emissionScale = micro.range(0.8, 1.2);
      extinctionScale = dust.range(0.8, 1.3);
      break;
    }
    case 'planetary-shell':
    case 'planetary-bipolar':
      lights.push({ position: new Vector3(0, 0, 0), color: STAR_WD.clone(), intensity: 1 });
      // (the draw stays: the shape stream's later values must not move) every planetary is
      // stratified from its interior to its rim; the variety comes from the tint and the family
      shape.chance(0.25);
      paletteId = 'oiii-blue';
      doubleShell = morphology === 'planetary-shell' && shape.chance(0.4) ? 1 : 0;
      emissionScale = micro.range(0.85, 1.2);
      extinctionScale = dust.range(0.6, 1.2);
      cavityScale = shape.range(0.55, 0.72);   // main shell radius
      break;
    case 'snr-filaments':
      // no central light to speak of: the glow is shock-heated; a faint blue synchrotron interior
      lights.push({ position: new Vector3(0, 0, 0), color: new Vector3(0.6, 0.7, 1.0), intensity: 0.15 });
      paletteId = 'snr-mixed';
      emissionScale = micro.range(0.8, 1.3);
      extinctionScale = dust.range(0.3, 0.7);
      cavityScale = shape.range(0.82, 0.95);   // shell radius
      break;
    case 'wind-bubble':
      lights.push({ position: ballPoint(lightsRng).multiplyScalar(0.12), color: STAR_O.clone(), intensity: 1 });
      paletteId = 'oiii-blue';
      emissionScale = micro.range(0.8, 1.2);
      extinctionScale = dust.range(0.4, 0.8);
      cavityScale = shape.range(0.7, 0.85);
      break;
  }
  return {
    id: def.id,
    source: def.procedural ? 'procedural' : 'catalog',
    morphology, seed, algorithmVersion: NEBULA_ALGORITHM_VERSION,
    extentPc: def.radiusPc,
    orientation, emissionScale, extinctionScale, turbulence, filamentScale, cavityScale, paletteId,
    tint: [def.color[0], def.color[1], def.color[2]],
    lights, axis, doubleShell,
  };
}

/** Position of one of the profile's lights relative to the object centre, in parsecs, scene frame */
export function lightPositionPc(profile: NebulaProfile, i: number): Vector3 {
  const l = profile.lights[Math.min(i, profile.lights.length - 1)];
  return l.position.clone().applyQuaternion(_inv.copy(profile.orientation).invert()).multiplyScalar(profile.extentPc);
}
const _inv = new Quaternion();
