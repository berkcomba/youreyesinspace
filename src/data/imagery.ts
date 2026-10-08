/**
 * Real surface imagery providers (WMTS/XYZ tiles in a geographic, equirectangular grid).
 *
 * All providers below are key-free NASA services with CORS enabled and public-domain imagery.
 * Grid convention (OGC WMTS geographic): tile (z, x, y) covers
 *   lon ∈ [-180 + x·s, -180 + (x+1)·s],  lat ∈ [90 - (y+1)·s, 90 - y·s],  s = span0 / 2^z degrees,
 * row 0 at the north pole. Tiles past the antimeridian / south pole are padded by the server
 * (GIBS level 0 is 2 tiles of 288°), so the visible part is clipped to the globe.
 */
export interface TileProvider {
  /** Absolute tile URL */
  url: (z: number, x: number, y: number) => string;
  /** Tile edge in pixels */
  tileSize: number;
  /** Degrees covered by one tile at level 0 */
  span0: number;
  /** Deepest level to request */
  maxLevel: number;
}

export interface BodyImagery {
  day: TileProvider;
  /** Night lights (added on the dark side) */
  night?: TileProvider;
  /** Short credit shown on screen while the layer is visible */
  credit: string;
  /** Add sun glint on water (detected from the imagery colour) */
  hasOceanSpecular?: boolean;
}

const GIBS = 'https://gibs.earthdata.nasa.gov/wmts/epsg4326/best';
const TREK = 'https://trek.nasa.gov/tiles';

function gibs(layer: string, ext: string, maxLevel: number): TileProvider {
  return {
    url: (z, x, y) => `${GIBS}/${layer}/default/500m/${z}/${y}/${x}.${ext}`,
    tileSize: 512,
    span0: 288,
    maxLevel,
  };
}

/**
 * NASA Solar System Treks WMTS (https://trek.nasa.gov/tiles/apidoc/). Layer ids, formats and
 * the deepest level that actually serves tiles were taken from each layer's WMTSCapabilities.
 */
function trek(body: string, layer: string, maxLevel: number, ext: 'jpg' | 'png' = 'jpg'): TileProvider {
  return {
    url: (z, x, y) => `${TREK}/${body}/EQ/${layer}/1.0.0//default/default028mm/${z}/${y}/${x}.${ext}`,
    tileSize: 256,
    span0: 180,
    maxLevel,
  };
}

/** Imagery by body id */
export const IMAGERY: Record<string, BodyImagery> = {
  // --- inner planets
  mercury: {
    // the monochrome BDR basemap: Mercury is grey to the eye (the "enhanced colour" product is a mineral map)
    day: trek('Mercury', 'Mercury_MESSENGER_MDIS_Basemap_BDR_Mosaic_Global_166m', 7),
    credit: 'Merkür görüntüsü: NASA Trek · MESSENGER MDIS mozaiği (166 m/px)',
  },
  venus: {
    day: trek('Venus', 'Venus_Magellan_C3-MDIR_Colorized_Global_Mosaic_4641m', 4, 'png'),
    credit: 'Venüs yüzeyi: NASA Trek · Magellan radar mozaiği, yapay renk (4.6 km/px)',
  },
  earth: {
    day: gibs('BlueMarble_NextGeneration', 'jpeg', 7),
    night: gibs('VIIRS_Black_Marble', 'png', 7),
    credit: 'Dünya görüntüsü: NASA GIBS · Blue Marble NG, VIIRS Black Marble',
    hasOceanSpecular: true,
  },
  moon: {
    day: trek('Moon', 'LRO_WAC_Mosaic_Global_303ppd_v02', 8),
    credit: 'Ay görüntüsü: NASA Trek · LRO WAC mozaiği (100 m/px)',
  },
  mars: {
    day: trek('Mars', 'Mars_Viking_MDIM21_ClrMosaic_global_232m', 7),
    credit: 'Mars görüntüsü: NASA Trek · Viking MDIM 2.1 (232 m/px)',
  },
  // --- Jupiter's Galilean moons (Voyager + Galileo SSI mosaics)
  io: {
    day: trek('Io', 'Io_GalileoSSI_Voyager_Global_Mosaic_ClrMerge_1km', 4, 'png'),
    credit: 'Io görüntüsü: NASA Trek · Galileo SSI / Voyager renk mozaiği (1 km/px)',
  },
  europa: {
    day: trek('Europa', 'Europa_Voyager_GalileoSSI_global_mosaic_500m', 5, 'png'),
    credit: 'Europa görüntüsü: NASA Trek · Galileo SSI / Voyager mozaiği (500 m/px)',
  },
  ganymede: {
    day: trek('Ganymede', 'Ganymede_Voyager_GalileoSSI_global_mosaic_1km', 5, 'png'),
    credit: 'Ganymede görüntüsü: NASA Trek · Galileo SSI / Voyager mozaiği (1 km/px)',
  },
  callisto: {
    day: trek('Callisto', 'Callisto_Voyager_GalileoSSI_global_mosaic_1km', 5, 'png'),
    credit: 'Callisto görüntüsü: NASA Trek · Galileo SSI / Voyager mozaiği (1 km/px)',
  },
  // --- Saturn's moons (Cassini ISS mosaics)
  mimas: {
    day: trek('Mimas', 'MI_170630_DLR_basemap', 4),
    credit: 'Mimas görüntüsü: NASA Trek · Cassini ISS mozaiği (DLR)',
  },
  enceladus: {
    day: trek('Enceladus', 'Enceladus_Cassini_mosaic_global_110m', 5),
    credit: 'Enceladus görüntüsü: NASA Trek · Cassini ISS mozaiği (110 m/px)',
  },
  tethys: {
    day: trek('Tethys', 'Tethys_Cassini_mosaic_global_293m', 4),
    credit: 'Tethys görüntüsü: NASA Trek · Cassini ISS mozaiği (293 m/px)',
  },
  dione: {
    day: trek('Dione', 'Dione_Cassini_Voyageglobal_154m', 5),
    credit: 'Dione görüntüsü: NASA Trek · Cassini / Voyager mozaiği (154 m/px)',
  },
  rhea: {
    day: trek('Rhea', 'RH_120803_DLR_basemap', 4),
    credit: 'Rhea görüntüsü: NASA Trek · Cassini ISS mozaiği (DLR)',
  },
  // Titan: Trek's Cassini ISS mosaic is grayscale near-IR with heavy seams; the procedural surface reads better under the haze.
  iapetus: {
    day: trek('Iapetus', 'Iapetus_Cassini_Voyager_mosaic_global_783m', 3),
    credit: 'Iapetus görüntüsü: NASA Trek · Cassini / Voyager mozaiği (783 m/px)',
  },
  // --- small bodies (Dawn)
  ceres: {
    day: trek('Ceres', 'Ceres_Dawn_FC_DLR_global_59ppd_Feb2016', 5),
    credit: 'Ceres görüntüsü: NASA Trek · Dawn FC mozaiği (140 m/px)',
  },
  vesta: {
    day: trek('Vesta', 'Vesta_Dawn_FC_HAMO_Mosaic_Global_74ppd', 6),
    credit: 'Vesta görüntüsü: NASA Trek · Dawn FC HAMO mozaiği (60 m/px)',
  },
};

/** Hosts that must be allowed by the CSP img-src directive */
export const IMAGERY_HOSTS = ['https://gibs.earthdata.nasa.gov', 'https://trek.nasa.gov'];
