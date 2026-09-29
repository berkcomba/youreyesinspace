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

function trek(body: string, layer: string, maxLevel: number): TileProvider {
  return {
    url: (z, x, y) => `${TREK}/${body}/EQ/${layer}/1.0.0//default/default028mm/${z}/${y}/${x}.jpg`,
    tileSize: 256,
    span0: 180,
    maxLevel,
  };
}

/** Imagery by body id */
export const IMAGERY: Record<string, BodyImagery> = {
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
};

/** Hosts that must be allowed by the CSP img-src directive */
export const IMAGERY_HOSTS = ['https://gibs.earthdata.nasa.gov', 'https://trek.nasa.gov'];
