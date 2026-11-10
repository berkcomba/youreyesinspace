export type BodyType = 'star' | 'planet' | 'dwarf' | 'moon' | 'asteroid' | 'comet' | 'barycenter' | 'spacecraft' | 'blackhole' | 'pulsar';

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
  /**
   * Sampled JPL Horizons table (`/ephem/<table>.json`, centred on the parent) that replaces the
   * Keplerian position wherever it covers the date; the elements remain the fallback and the
   * drawn orbit. Used for the Moon, whose perturbations reach a degree and spoil eclipses.
   */
  table?: string;
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

/**
 * Mission trajectory (planner-launched vehicles): the position is produced by an external
 * evaluator (piecewise conics, warp legs, parking orbits). `evaluate` writes the absolute position
 * (km, current system frame) and velocity (km/s) and returns false when the vehicle cannot be
 * represented in the current frame (it is in another star system).
 */
export interface TrajectoryOrbit {
  kind: 'trajectory';
  evaluate: (jd: number, outPos: Vector3Like, outVel: Vector3Like) => boolean;
}

/** minimal mutable vector (three.js Vector3 satisfies it) */
export interface Vector3Like { x: number; y: number; z: number; set(x: number, y: number, z: number): unknown }

/**
 * Sampled ephemeris (JPL Horizons): positions tabulated in `public/ephem/<file>` relative to
 * named bodies, interpolated at run time (src/core/Ephemeris.ts). The table is fetched lazily;
 * outside its time span the body is hidden rather than extrapolated.
 */
export interface EphemerisOrbit {
  kind: 'ephemeris';
  /** table id → /ephem/<table>.json */
  table: string;
}

export type OrbitElements = JplElements | SimpleElements | LinearState | SurfaceFix | LagrangeFix | TrajectoryOrbit | EphemerisOrbit;

export interface PoleRaDec { ra: number; dec: number }

/**
 * Close-range ground of a landable world: a seamless tile baked from a Blender surface material
 * (scripts/ground-bake.py, ground-pack.py) into `public/ground/<file>.png` — RG the slope, B an
 * albedo factor about 1, A the height — laid at several sizes under the visitor's feet. The
 * numbers are the pack's encoding ranges.
 */
export interface GroundMaterial {
  file: string;
  /** slopes span ±slope (rise over run: the same at every size the tile is laid at) */
  slope: number;
  /** albedo factors span 0…albedo */
  albedo: number;
  /** the height range, as a fraction of the tile's size */
  height: number;
}

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
      /**
       * surface regime for the generated worlds: climate biomes on a temperate world, bright dust
       * over dark basalt on a Mars-like desert, lineae on an icy crust, a glowing crack network on
       * a lava world. Omitted → the generic palette-only look (the hand-made solar-system bodies).
       */
      style?: 'temperate' | 'desert' | 'ice' | 'lava';
      /** vegetation paints the temperate biomes */
      life?: boolean;
      /** a baked material laid over the landing ground at metre scales (see GroundMaterial) */
      ground?: GroundMaterial;
      /** generated worlds: the family of baked surface maps that dresses the globe (SkinLibrary) */
      skin?: string;
    }
  | {
      kind: 'gas';
      seed: number;
      bands: Array<[number, number, number]>;
      bandFreq: number;
      turbulence: number;
      /** Great-red-spot style storm: [lat deg, lon deg, size, r,g,b] */
      storm?: [number, number, number, number, number, number];
      /** where the storm sits on a real map skin ([lat, east lon] deg, body frame): it does not drift there */
      mapStorm?: [number, number];
      /** Saturn's north polar hexagon (the jet at 78° N) and the polar vortex inside it */
      hexagon?: boolean;
      hazeColor?: [number, number, number];
      /** generated worlds: the family of baked cloud decks (SkinLibrary), recoloured to `bands` */
      skin?: string;
    }
  | {
      kind: 'star';
      temperature: number; // K
      seed: number;
      /** perceived photosphere colour (sRGB 0…1) where it is not the blackbody's: the colourful white dwarfs */
      tint?: [number, number, number];
    }
  | {
      kind: 'spacecraft';
      /** glTF/GLB model URL (public domain NASA 3D Resources); scaled so its bounding radius = body.radius */
      model: string;
      seed: number;
      /** model is a stand-in for a different vehicle (no free model available) */
      representative?: boolean;
      /** built from primitives instead of a model file (fictional ships); `model` is ignored */
      procedural?: 'saucer' | 'freighter' | 'xwing' | 'corvette' | 'capsule' | 'rocket';
      /** engine glow tint for procedural ships (linear RGB) */
      glow?: [number, number, number];
      /**
       * Landers / rovers: the real ground around the vehicle — HiRISE relief and orthophotos in
       * nested rings (`dir` holds `meta.json` plus the maps, built by scripts/terrain-scene.py),
       * lazily loaded when the camera comes near.
       */
      terrain?: { dir: string; credit: string };
    }
  | {
      /** Nothing drawn: an invisible marker body (centre of mass of a binary) */
      kind: 'none';
      seed: number;
    }
  | {
      /**
       * Black hole: `radius` of the body is the Schwarzschild radius. Rendered entirely by the
       * gravitational-lensing post-process (geodesic ray tracing + accretion disk); the disk
       * normal is the body's pole.
       */
      kind: 'blackhole';
      seed: number;
      /** accretion disk, radii in Schwarzschild radii (0 brightness = dormant, no disk) */
      disk: { inner: number; outer: number; temperature: number; brightness: number };
      /** absolute magnitude of the disk glow for the distant point sprite */
      diskAbsMag: number;
    }
  | {
      /**
       * Pulsar / neutron star: a ~10 km star with two radio/X-ray beams along a magnetic axis
       * that is tilted from the spin axis (`pole`); the body's `rotationPeriod` is the pulse period.
       */
      kind: 'pulsar';
      seed: number;
      /** angle between magnetic and spin axis (deg) */
      magneticTilt: number;
      /** half opening angle of each beam cone (deg) */
      beamHalfAngle: number;
      /** beam length in body radii */
      beamLength: number;
      /** beam tint (linear RGB) */
      beamColor: [number, number, number];
      /** no radio beams drawn (radio-quiet companion, magnetar in quiescence …) */
      quiet?: boolean;
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

/**
 * Eruptive activity: volcanic plumes (Io's umbrellas of SO₂ and ash rising hundreds of km) or
 * cryovolcanic jets (Enceladus' water-ice geysers, Triton's nitrogen plumes).
 */
export interface Activity {
  kind: 'volcanic' | 'cryo';
  /** vents as [latitude, east longitude] (deg); omitted → `count` seeded vents */
  vents?: Array<[number, number]>;
  count?: number;
  /** plume height (km) and radius of the canopy / fallout ring (km) */
  height: number;
  spread: number;
  /** 1 = fountain falling back (an umbrella), 0 = jets escaping into space */
  fall: number;
  color: [number, number, number];
  /** overall brightness / density (1 = Io's Pele) */
  intensity?: number;
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
  activity?: Activity;
  /** Surface temperature (K) if known; otherwise computed */
  temperature?: number;
  description?: string;
  discovered?: string;
  /** Extra "Space Engine style" facts */
  facts?: Record<string, string>;
}
