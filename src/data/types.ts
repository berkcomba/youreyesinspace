export type BodyType = 'star' | 'planet' | 'dwarf' | 'moon' | 'asteroid' | 'comet' | 'barycenter' | 'spacecraft';

/**
 * JPL "approximate elements" style: mean elements at J2000 + secular rates per Julian century.
 * Units: a in AU, angles in degrees. Frame: ecliptic J2000.
 */
export interface JplElements {
  kind: 'jpl';
  a: number; e: number; i: number; L: number; lonPeri: number; node: number;
  da: number; de: number; di: number; dL: number; dLonPeri: number; dNode: number;
}

/**
 * Classic Keplerian set at a given epoch with a fixed period.
 * Units: a in km, angles in degrees, epoch as Julian Date, period in days.
 * frame: which plane i/node are measured against.
 */
export interface SimpleElements {
  kind: 'simple';
  a: number; e: number; i: number; node: number; argPeri: number; M0: number;
  epoch: number; period: number;
  frame: 'ecliptic' | 'parentEquator' | 'laplace';
  /** Optional nodal precession (deg/day) for a bit of realism on inner moons */
  nodeRate?: number;
  /** Optional apsidal precession (deg/day) */
  periRate?: number;
}

/**
 * Straight-line (unbound) trajectory: heliocentric state vector at an epoch, ecliptic J2000
 * math frame (x → equinox, z → ecliptic north). Used for the interstellar probes, whose
 * motion is asymptotically linear far from the Sun.
 */
export interface LinearState {
  kind: 'linear';
  epoch: number;        // JD
  pos: [number, number, number]; // km
  vel: [number, number, number]; // km/s
}

/** Fixed to the parent's surface (rovers, landers). Longitude east-positive, degrees. */
export interface SurfaceFix {
  kind: 'surface';
  lat: number;
  lon: number;
  /** altitude above the mean radius, km */
  alt?: number;
}

/** Sun–parent Lagrange point (L1 toward the star, L2 away from it) */
export interface LagrangeFix {
  kind: 'lagrange';
  point: 'L1' | 'L2';
  /** distance from the parent, km */
  distance: number;
}

export type OrbitElements = JplElements | SimpleElements | LinearState | SurfaceFix | LagrangeFix;

export interface PoleRaDec { ra: number; dec: number }

export type Appearance =
  | {
      kind: 'terrestrial';
      seed: number;
      /** Base palettes as [r,g,b] 0..1 */
      ocean?: [number, number, number];
      landLow: [number, number, number];
      landHigh: [number, number, number];
      landMid?: [number, number, number];
      ice?: [number, number, number];
      /** 0..1, sea-level threshold in noise space. undefined => no ocean */
      seaLevel?: number;
      /** ice cap extent 0..1 (0 none) */
      iceCaps?: number;
      /** crater density 0..1 */
      craters?: number;
      /** overall roughness scale */
      roughness?: number;
      /** night-side emissive lights (cities) */
      cityLights?: boolean;
      /** volcanic glow (Io) */
      volcanic?: boolean;
      /** large-scale colour variation strength */
      variation?: number;
    }
  | {
      kind: 'gas';
      seed: number;
      bands: Array<[number, number, number]>;
      bandFreq: number;
      turbulence: number;
      /** Great-red-spot style storm: [lat deg, lon deg, size, r,g,b] */
      storm?: [number, number, number, number, number, number];
      hazeColor?: [number, number, number];
    }
  | {
      kind: 'star';
      temperature: number; // K
      seed: number;
    }
  | {
      kind: 'spacecraft';
      /** glTF/GLB model URL (public domain NASA 3D Resources); scaled so its bounding radius = body.radius */
      model: string;
      seed: number;
      /** model is a stand-in for a different vehicle (no free model available) */
      representative?: boolean;
    };

export interface Atmosphere {
  color: [number, number, number];
  /** Scale height as fraction of radius (visual) */
  height: number;
  /** 0..2 visual density multiplier */
  density: number;
  /** night-side glow (aurora-ish) */
  sunsetColor?: [number, number, number];
}

export interface Clouds {
  seed: number;
  color: [number, number, number];
  coverage: number; // 0..1
  /** altitude as fraction of radius */
  height: number;
  /** relative rotation speed vs planet (1 = locked) */
  speed: number;
  opacity: number;
}

export interface Rings {
  inner: number; // km
  outer: number; // km
  color: [number, number, number];
  opacity: number;
  seed: number;
  /** Named gaps as [radiusKm, widthKm] */
  gaps?: Array<[number, number]>;
}

export interface BodyData {
  id: string;
  name: string;
  type: BodyType;
  parent?: string;
  radius: number; // km (mean)
  /** Equatorial flattening (Re-Rp)/Re */
  flattening?: number;
  mass: number; // kg
  albedo?: number;
  /** Sidereal rotation period in hours; negative = retrograde; 'sync' = tidally locked */
  rotationPeriod?: number | 'sync';
  /** Rotation phase at J2000 (deg) */
  primeMeridian?: number;
  /** North pole direction (ICRF RA/Dec, degrees). If undefined for moons => orbit normal */
  pole?: PoleRaDec;
  /** Alternative to pole: obliquity to own orbit (deg) */
  tilt?: number;
  orbit?: OrbitElements;
  appearance: Appearance;
  atmosphere?: Atmosphere;
  clouds?: Clouds;
  rings?: Rings;
  /** Surface temperature (K) if known; otherwise computed */
  temperature?: number;
  description?: string;
  discovered?: string;
  /** Extra "Space Engine style" facts */
  facts?: Record<string, string>;
}
