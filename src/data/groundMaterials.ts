import type { BodyData, GroundMaterial } from './types';

/**
 * Photoscanned ground (Poly Haven, CC0) packed by scripts/ground-photoscan.py into
 * `public/ground/cc0/`: only the scans' relief and their grain's light and dark are used — the
 * colour is the globe's, so the ground underfoot is the world seen from orbit, up close.
 */
const cc0 = (name: string, slope: number, albedo: number, height: number): GroundMaterial =>
  ({ file: `cc0/${name}.webp`, slope, albedo, height });

export const GROUND_MATERIALS = {
  regolith: cc0('regolith', 0.7651, 1.0773, 0.0287),             // moon_01
  regolithRocky: cc0('regolith-rocky', 0.6513, 1.0941, 0.03175), // moon_meteor_01
  sandRipples: cc0('sand-ripples', 0.532, 1.6602, 0.01355),      // aerial_sand
  gravel: cc0('gravel', 0.7748, 2.9397, 0.01518),                // dry_ground_rocks
  redStones: cc0('red-stones', 0.9586, 2.6491, 0.0134),          // red_laterite_soil_stones
  rockyTrail: cc0('rocky-trail', 2.032, 2.0637, 0.02594),        // rocky_trail
  pebbles: cc0('pebbles', 1.912, 2.2335, 0.03361),               // river_small_rocks
  crackedMud: cc0('cracked-mud', 2.513, 1.5322, 0.02051),        // mud_cracked_dry_03
  crackedRock: cc0('cracked-rock', 1.5313, 1.8458, 0.05469),     // rock_boulder_cracked
  snow: cc0('snow', 0.3435, 2.2462, 0.00894),                    // snow_field_aerial
  iceRubble: cc0('ice-rubble', 1.2559, 1.8476, 0.01617),         // snow_03
  cliff: cc0('cliff', 1.2447, 2.4225, 0.03625),                  // cliff_side
  rockFace: cc0('rock-face', 0.8205, 1.8582, 0.03008),           // rock_face
};

type Regime = 'airless' | 'icy' | 'desert' | 'dunes' | 'mars' | 'lava' | 'temperate' | 'venus' | 'carbon' | 'titan';

/**
 * The rock families of scripts/rocks-gen.py (`public/ground/rocks/rocks-<family>`): fractured
 * blocks and vesicular basalt, bedded sandstone, weathered boulders and cobbles.
 */
export type RockFamily = 'angular' | 'layered' | 'rounded';

export interface GroundDress {
  flat: GroundMaterial;
  steep: GroundMaterial;
  /** how strewn with rocks, 0…1 */
  rocks: number;
  rockFamily: RockFamily;
}

const M = GROUND_MATERIALS;
/** what covers the level ground, what the slopes (past ~25°) are, and how rocky it is, by kind of world */
const BY_REGIME: Record<Regime, GroundDress> = {
  airless: { flat: M.regolith, steep: M.regolithRocky, rocks: 1, rockFamily: 'angular' },
  icy: { flat: M.snow, steep: M.iceRubble, rocks: 0.35, rockFamily: 'rounded' },
  desert: { flat: M.gravel, steep: M.cliff, rocks: 0.7, rockFamily: 'layered' },
  dunes: { flat: M.sandRipples, steep: M.cliff, rocks: 0.08, rockFamily: 'layered' },
  mars: { flat: M.redStones, steep: M.rockFace, rocks: 0.85, rockFamily: 'layered' },
  lava: { flat: M.crackedRock, steep: M.rockFace, rocks: 0.6, rockFamily: 'angular' },
  temperate: { flat: M.rockyTrail, steep: M.rockFace, rocks: 0.4, rockFamily: 'rounded' },
  venus: { flat: M.crackedMud, steep: M.crackedRock, rocks: 0.5, rockFamily: 'angular' },
  carbon: { flat: M.redStones, steep: M.crackedRock, rocks: 0.6, rockFamily: 'angular' },
  titan: { flat: M.pebbles, steep: M.rockyTrail, rocks: 0.3, rockFamily: 'rounded' },
};

const BY_ID: Record<string, Regime> = {
  mercury: 'airless', venus: 'venus', earth: 'temperate', moon: 'airless', mars: 'mars',
  io: 'lava', europa: 'icy', ganymede: 'icy', callisto: 'airless', titan: 'titan', enceladus: 'icy',
  mimas: 'icy', tethys: 'icy', dione: 'icy', rhea: 'icy', iapetus: 'icy', miranda: 'icy', ariel: 'icy',
  umbriel: 'airless', titania: 'icy', oberon: 'airless', triton: 'icy', pluto: 'icy', charon: 'airless',
  ceres: 'airless', vesta: 'airless', eris: 'icy', makemake: 'icy', haumea: 'icy',
};

const BY_SKIN: Record<string, Regime> = {
  lava: 'lava', 'moon-volcanic': 'lava', venusian: 'venus', temperate: 'temperate', 'temperate-life': 'temperate',
  ocean: 'temperate', eyeball: 'desert', carbon: 'carbon', desert: 'mars', ice: 'icy', barren: 'airless',
  'dwarf-red': 'desert', 'moon-icy': 'icy', 'moon-rocky': 'airless',
  jungle: 'temperate', dune: 'dunes', salt: 'venus', toxic: 'venus', geothermal: 'desert', titan: 'titan',
  iron: 'airless', magmaeye: 'lava',
};

/**
 * The two ground materials of a landable world (one for the level ground, one for the slopes) and
 * its rockiness. A world's own baked material (`appearance.ground`) takes the level ground.
 */
export function groundMaterials(d: BodyData): GroundDress | null {
  const a = d.appearance;
  if (a.kind !== 'terrestrial') return null;
  const skin = a.skin?.startsWith('map:') ? undefined : a.skin;
  let regime: Regime = BY_ID[d.id] ?? (skin ? BY_SKIN[skin] : undefined) ?? (a.volcanic ? 'lava'
    : a.style === 'ice' ? 'icy' : a.style === 'desert' ? 'mars' : a.style === 'temperate' ? 'temperate'
      : lum(a.landMid ?? a.landLow) > 0.6 ? 'icy' : 'airless');
  // half the dry worlds are sand seas rather than stony plains
  if (regime === 'desert' && (a.seed & 1)) regime = 'dunes';
  const pick = BY_REGIME[regime];
  return a.ground ? { ...pick, flat: a.ground } : pick;
}

const lum = (c: [number, number, number]): number => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
