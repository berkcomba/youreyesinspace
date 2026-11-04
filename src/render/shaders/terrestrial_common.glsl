// ---------------------------------------------------------------------------
// Terrestrial body: the procedural height field and albedo shared by the globe (terrestrial.frag),
// its baked surface maps (bake_terrestrial.frag) and the ground generated under a visitor who
// lands on it (groundheight.frag / groundalbedo.frag), so the patch under their feet carries on the
// globe's own continents, craters and colours.
// ---------------------------------------------------------------------------
uniform float uSeed;
uniform vec3 uOcean;
uniform vec3 uLandLow;
uniform vec3 uLandMid;
uniform vec3 uLandHigh;
uniform vec3 uIce;
uniform float uSeaLevel;     // <0 => no ocean
uniform float uIceCaps;      // 0 => none, else latitude threshold (0..1)
uniform float uCraters;
uniform float uRoughness;
uniform float uVolcanic;
uniform float uVariation;
uniform float uStyle;        // surface regime: 0 generic, 1 temperate (climate biomes), 2 Mars-like desert, 3 icy crust, 4 lava world
uniform float uLife;         // 1 = vegetation paints the temperate biomes

float sqf(float x) { return x * x; }

// Domain warp: provinces and coastlines get organic, eroded outlines instead of noise blobs
// (airless worlds warp less: their provinces are old basins and highlands, not eroded coasts)
vec3 warpedCoord(vec3 q) {
  vec3 w = vec3(fbm(q * 1.1 + 7.3, 3), fbm(q * 1.1 + 19.7, 3), fbm(q * 1.1 + 31.1, 3));
  return q + (uSeaLevel >= 0.0 ? 0.45 : 0.25) * w;
}

// Impact basins: a few giant, shallow bowls (Imbrium, Hellas, Caloris) with a broad raised ring
float basinField(vec3 p, float seed, float density) {
  float c = 0.0;
  vec3 q = p * 1.4 + seed * 0.53;
  vec3 cell = floor(q);
  vec3 f = fract(q);
  for (int x = -1; x <= 1; x++)
  for (int y = -1; y <= 1; y++)
  for (int z = -1; z <= 1; z++) {
    vec3 off = vec3(float(x), float(y), float(z));
    vec3 h = hash33(cell + off + seed * 1.7 + 3.0);
    if (h.z > density * 0.55) continue;
    float d = length(f - (off + h));
    float r = 0.35 + 0.4 * h.x;
    float t = d / r;
    if (t > 1.6) continue;
    float bowl = (smoothstep(0.0, 1.0, t) - 1.0) * 0.6;
    float ring = exp(-pow((t - 1.0) * 4.0, 2.0)) * 0.22;
    c += (bowl + ring) * (1.0 - smoothstep(1.2, 1.6, t));
  }
  return c;
}

// Height field on unit sphere, 0..1
float heightAt(vec3 p) {
  vec3 q = p * uRoughness + uSeed;
  vec3 qw = warpedCoord(q);
  // Continental scale (warped), medium detail, and mountain ranges where a slow mask allows them
  float continents = fbm(qw * 1.35, 5);
  float detail = fbm(q * 4.5 + 11.0, 6);
  float h = 0.5 + 0.36 * continents + 0.14 * detail;
  float land = smoothstep(0.42, 0.62, h);
  float ranges = smoothstep(-0.1, 0.45, fbm(qw * 2.2 + 5.0, 3));
  // Mountain ranges: tectonic worlds get ridged chains; heavily cratered airless worlds hardly any
  // (their highlands are rough with craters instead of ridges, otherwise the globe reads as marble)
  float cratered = uSeaLevel < 0.0 ? clamp(uCraters, 0.0, 1.0) : 0.0;
  float mountains = ridged(qw * 6.0 + 3.1, 5);
  h += mountains * 0.17 * land * (0.3 + 0.7 * ranges) * (1.0 - 0.75 * cratered);
  // plateaus: part of the land is flattened toward a shelf height (otherwise fbm is bumpy everywhere)
  float plateau = smoothstep(0.2, 0.6, fbm(qw * 1.7 + 41.0, 3)) * land;
  h = mix(h, 0.62 + 0.25 * (h - 0.62), plateau * 0.6);
  if (uCraters > 0.0) {
    h += craterField(p, uSeed, uCraters * 0.85) * (0.12 + 0.1 * cratered);
    h += basinField(p, uSeed, uCraters) * (0.1 + 0.06 * cratered);
  }
  return h;
}

// Bright ejecta rays of the youngest large craters (Tycho, Copernicus): radial streaks that fade
// with distance, only for a few of the craters of the largest scale
float craterRays(vec3 p, float seed, float density) {
  vec3 q = p * 2.5 + seed * 0.37;
  vec3 cell = floor(q);
  vec3 f = fract(q);
  float rays = 0.0;
  for (int x = -1; x <= 1; x++)
  for (int y = -1; y <= 1; y++)
  for (int z = -1; z <= 1; z++) {
    vec3 off = vec3(float(x), float(y), float(z));
    vec3 h = hash33(cell + off + seed);
    if (h.z > density || h.y > 0.22) continue;   // the young ones
    vec3 center = off + h;
    vec3 d = f - center;
    float r = 0.15 + 0.35 * h.x;
    float t = length(d) / r;
    if (t < 0.9 || t > 6.0) continue;
    vec3 dir = normalize(d);
    // streaks: angular noise around the crater, stretched radially
    float streak = snoise(dir * 9.0 + h * 50.0) * 0.5 + 0.5;
    streak = smoothstep(0.55, 0.9, streak);
    rays += streak * exp(-(t - 1.0) * 0.55) * smoothstep(0.9, 1.2, t);
  }
  return clamp(rays, 0.0, 1.0);
}

// ---- surface regimes -------------------------------------------------------------------------

// Temperate world: biomes from a simple climate. Moisture follows the general circulation
// (wet equatorial convergence, dry subtropics, wetter mid-latitude storm tracks) with
// continental interiors drier than coasts; temperature falls with latitude and altitude.
// `t` is the height above sea level, 0 at the coast … 1 at the summits.
vec3 temperateBiomes(vec3 p, float h, float t, vec3 base) {
  float lat = abs(p.y);
  float moist = fbm(p * 1.7 + uSeed * 1.9, 4) * 0.5 + 0.5;
  moist += 0.22 * exp(-sqf(lat / 0.12)) - 0.3 * exp(-sqf((lat - 0.42) / 0.13)) + 0.12 * exp(-sqf((lat - 0.75) / 0.15));
  moist += 0.12 * (1.0 - smoothstep(0.0, 0.3, t));
  float temp = 1.0 - lat * lat * 1.15 - t * 0.95 + 0.08 * fbm(p * 3.0 + uSeed * 0.4, 2);
  // soils: the planet's own tint sets sand and bare rock
  vec3 sand = mix(uLandMid, vec3(0.80, 0.68, 0.46), 0.55);
  vec3 redSand = mix(uLandMid, vec3(0.62, 0.40, 0.24), 0.6);
  vec3 rock = mix(uLandHigh, vec3(0.42, 0.40, 0.37), 0.5);
  vec3 soil = mix(sand, redSand, smoothstep(0.3, 0.7, fbm(p * 2.3 + uSeed * 2.2, 3) * 0.5 + 0.5));
  // wet bare ground is darker; salt flats bright in the driest basins
  soil *= 1.0 - 0.3 * smoothstep(0.45, 0.8, moist);
  soil = mix(soil, vec3(0.9, 0.9, 0.88), smoothstep(0.12, 0.0, moist) * smoothstep(0.12, 0.02, t) * 0.6);
  vec3 col = soil;
  if (uLife > 0.5) {
    // seen from orbit vegetation is dark: olive steppe, near-black forest, blue-green taiga
    vec3 steppe = mix(uLandLow, vec3(0.36, 0.36, 0.16), 0.5);
    vec3 forest = mix(uLandLow, vec3(0.07, 0.14, 0.04), 0.6);
    vec3 taiga = mix(uLandLow, vec3(0.09, 0.14, 0.09), 0.6);
    vec3 tundra = vec3(0.38, 0.34, 0.28);
    float warm = smoothstep(0.15, 0.45, temp);
    col = mix(soil, steppe, smoothstep(0.3, 0.5, moist) * smoothstep(0.05, 0.3, temp));
    col = mix(col, forest, smoothstep(0.5, 0.75, moist) * warm);
    col = mix(col, taiga, smoothstep(0.4, 0.6, moist) * smoothstep(0.35, 0.1, temp) * smoothstep(0.0, 0.12, temp));
    col = mix(col, tundra, smoothstep(0.15, 0.02, temp) * smoothstep(0.0, 0.1, temp + 0.05));
  }
  // bare rock on the steep high ground, snow above the treeline and toward the poles
  col = mix(col, rock, smoothstep(0.45, 0.8, t));
  float snow = smoothstep(0.06, -0.06, temp) + smoothstep(0.8, 0.95, t);
  col = mix(col, uIce * (0.92 + 0.08 * fbm(p * 9.0 + uSeed, 3)), clamp(snow, 0.0, 1.0));
  // fine texture: field/forest patchwork, dune and drainage lines
  col *= 1.0 + 0.08 * snoise(p * 60.0 * uRoughness + uSeed) + 0.05 * snoise(p * 180.0 + uSeed * 2.0);
  return mix(base, col, 0.92);
}

// Mars-like desert: bright oxidised dust over dark basaltic plains (Syrtis Major), dust blown
// into zonal streaks, a thin frost tint toward the poles under the seasonal cap.
vec3 marsSurface(vec3 p, float h, vec3 base) {
  float plains = smoothstep(0.35, 0.65, fbm(p * 1.4 + uSeed * 1.1, 4) * 0.5 + 0.5);
  vec3 basalt = mix(uLandLow, vec3(0.22, 0.17, 0.14), 0.5);
  vec3 col = mix(base, basalt, plains * 0.8);
  // dust pools in the lowlands and brightens the basins
  float dust = smoothstep(0.5, 0.38, h) * (0.5 + 0.5 * fbm(p * 5.0 + uSeed * 2.4, 3));
  col = mix(col, uLandHigh * 1.05, dust * 0.5 * (1.0 - plains));
  // wind streaks: albedo stretched along the circulation
  float streak = snoise(vec3(p.x * 4.0, p.y * 40.0, p.z * 4.0) + uSeed * 0.7) * 0.5 + snoise(vec3(p.x * 9.0, p.y * 120.0, p.z * 9.0) + uSeed) * 0.3;
  col *= 1.0 + 0.07 * streak;
  // thin water-ice frost toward the poles
  col = mix(col, col * 0.7 + vec3(0.25, 0.25, 0.27), smoothstep(0.55, 0.85, abs(p.y)) * 0.35);
  return col;
}

// Icy crust: dark lineae (Europa), mottled chaos terrain, a faint reddish salt stain along the
// fractures; craters stay bright and sharp.
vec3 icyCrust(vec3 p, float h, vec3 base) {
  float l1 = 1.0 - smoothstep(0.0, 0.03, abs(snoise(p * 6.0 + uSeed * 0.8)));
  float l2 = 1.0 - smoothstep(0.0, 0.02, abs(snoise(p * 14.0 + uSeed * 1.6)));
  float lineae = clamp(l1 * 0.8 + l2 * 0.5, 0.0, 1.0);
  vec3 stain = mix(uLandLow, vec3(0.5, 0.33, 0.22), 0.55);
  vec3 col = mix(base, stain, lineae * 0.75);
  float chaos = smoothstep(0.5, 0.8, fbm(p * 4.0 + uSeed * 2.7, 3) * 0.5 + 0.5);
  col = mix(col, mix(col, stain, 0.4) * (0.9 + 0.2 * snoise(p * 40.0 + uSeed)), chaos * 0.6);
  col *= 1.0 + 0.05 * snoise(p * 90.0 + uSeed * 3.0);
  return col;
}

// Surface colour at unit direction p with height h. `ocean` is true for open water on entry
// (h below sea level) and may be cleared where an ice cap covers it; `lavaGlow` is the volcanic
// emission mask (0 for most worlds).
vec3 terrestrialAlbedo(vec3 p, float h, inout bool ocean, out float lavaGlow) {
  bool hasOcean = uSeaLevel >= 0.0;
  vec3 albedo;
  float variation = fbm(p * 1.3 + uSeed * 2.7, 3) * uVariation;
  if (ocean) {
    float depth = clamp((uSeaLevel - h) / max(uSeaLevel, 0.01), 0.0, 1.0);
    // the open sea is dark; continental shelves and banks turn turquoise where the floor shows
    albedo = mix(uOcean * 1.2, uOcean * 0.45, smoothstep(0.0, 0.35, depth));
    vec3 shelf = mix(uOcean * 2.2 + vec3(0.02, 0.12, 0.1), uLandLow * 0.6 + uOcean, 0.4);
    albedo = mix(albedo, shelf, smoothstep(0.06, 0.0, depth) * 0.75);
    // slow large-scale colour drift (sediment, plankton blooms)
    albedo *= 1.0 + 0.1 * fbm(p * 3.0 + uSeed * 1.3, 3);
  } else {
    float t = hasOcean ? clamp((h - uSeaLevel) / max(1.0 - uSeaLevel, 0.01), 0.0, 1.0) : h;
    vec3 low = uLandLow * (1.0 + variation * 0.35);
    vec3 mid = uLandMid * (1.0 - variation * 0.25);
    albedo = t < 0.5 ? mix(low, mid, smoothstep(0.0, 0.5, t)) : mix(mid, uLandHigh, smoothstep(0.5, 1.0, t));
    // fine surface detail
    float detail = snoise(p * 40.0 * uRoughness + uSeed) * 0.06 + snoise(p * 120.0 + uSeed) * 0.03;
    albedo *= 1.0 + detail;
    if (uStyle > 0.5 && uStyle < 1.5) {
      albedo = temperateBiomes(p, h, t, albedo);
    } else if (hasOcean) {
      // Climate zones: arid belts at low latitudes where the variation noise is high
      vec3 sand = mix(uLandMid, vec3(0.78, 0.66, 0.42), 0.6);
      float arid = smoothstep(0.05, 0.45, variation) * (1.0 - smoothstep(0.25, 0.6, abs(p.y))) * (1.0 - smoothstep(0.55, 0.85, t));
      albedo = mix(albedo, sand, arid * 0.85);
      // Lush variation elsewhere
      albedo = mix(albedo, albedo * vec3(0.85, 1.05, 0.8), smoothstep(-0.1, -0.5, variation) * 0.5);
    } else if (uStyle > 1.5 && uStyle < 2.5) {
      albedo = marsSurface(p, h, albedo);
    } else if (uStyle > 2.5 && uStyle < 3.5) {
      albedo = icyCrust(p, h, albedo);
    } else if (uStyle > 3.5) {
      // lava world: fresh basalt crust, no bright crater rays or maria contrast
      albedo *= 1.0 + variation * 0.3;
    } else {
      // Large-scale tonal variation (regolith maturity, terrain provinces)
      albedo *= 1.0 + variation * 0.45;
      albedo = mix(albedo, albedo.bgr * 0.35 + albedo * 0.65, clamp(variation * 0.3, 0.0, 0.4));
      if (uCraters > 0.0) {
        // maria: dark lava plains flooding the low ground of the old basins
        float mare = smoothstep(0.5, 0.36, h) * smoothstep(0.0, 0.45, fbm(p * 1.6 + uSeed * 3.3, 3) + 0.2 * uVariation);
        albedo *= 1.0 - 0.55 * mare * clamp(uVariation * 0.5 + 0.6, 0.0, 1.0);
        // the craters themselves: bright rims and fresh ejecta blankets, slightly darker floors,
        // so they read at full phase too, where the relief shading vanishes
        float cf = craterField(p, uSeed, uCraters * 0.85);
        albedo *= 1.0 + smoothstep(0.04, 0.3, cf) * 0.22 - smoothstep(-0.15, -0.6, cf) * 0.1;
        // bright rays of the young craters
        float rays = craterRays(p, uSeed, uCraters * 0.85);
        albedo = mix(albedo, albedo * 1.45 + 0.08, rays * 0.55);
      }
    }
  }

  // Ice caps (latitude in object space) + high altitude snow
  if (uIceCaps > 0.0) {
    float lat = abs(p.y);
    float capNoise = fbm(p * 4.0 + uSeed * 0.3, 3) * 0.08;
    float capEdge = uIceCaps + capNoise - (ocean ? 0.02 : (h - 0.5) * 0.25);
    float cap = smoothstep(capEdge - 0.02, capEdge + 0.02, lat);
    float snowline = hasOcean ? smoothstep(0.86, 0.96, h) : 0.0;
    // the ice is not one white: sublimation pits, dust, pressure ridges
    vec3 ice = uIce * (0.9 + 0.1 * fbm(p * 7.0 + uSeed * 0.7, 3) + 0.05 * snoise(p * 45.0 + uSeed));
    albedo = mix(albedo, ice, max(cap, snowline * 0.8));
    ocean = ocean && cap < 0.5;
  }

  // Contrast / saturation compensation for tone mapping
  {
    float lum = dot(albedo, vec3(0.299, 0.587, 0.114));
    albedo = mix(vec3(lum), albedo, 1.3);
    albedo = pow(max(albedo, 0.0), vec3(1.15));
  }

  lavaGlow = 0.0;
  if (uStyle > 3.5 && uStyle < 4.5) {
    // Lava world: a thin dark crust over magma, broken by a glowing crack network; the lowlands
    // are open magma seas (the day side of a tidally locked one is molten anyway)
    float n1 = snoise(p * 5.0 + uSeed * 0.9), n2 = snoise(p * 13.0 + uSeed * 1.7);
    float cracks = (1.0 - smoothstep(0.0, 0.045, abs(n1))) * 0.8 + (1.0 - smoothstep(0.0, 0.03, abs(n2))) * 0.5;
    float crusted = smoothstep(0.3, 0.7, fbm(p * 2.5 + uSeed * 3.1, 3) * 0.5 + 0.5);   // older, cooler plates
    cracks *= 1.0 - 0.7 * crusted;
    float seas = smoothstep(0.46, 0.38, h) * (0.6 + 0.4 * fbm(p * 8.0 + uSeed, 3));
    lavaGlow = clamp(cracks + seas, 0.0, 1.0);
    albedo = mix(albedo * (0.7 + 0.5 * crusted), vec3(0.04, 0.02, 0.015), lavaGlow);
  }
  // Volcanic hot-spots (Io)
  if (uVolcanic > 0.0 && uStyle < 3.5) {
    float spots = smoothstep(0.62, 0.9, fbm(p * 6.0 + uSeed * 4.1, 4) * 0.5 + 0.5);
    vec3 dark = vec3(0.25, 0.12, 0.05);
    albedo = mix(albedo, dark, spots * 0.8);
    float vent = smoothstep(0.86, 0.97, fbm(p * 14.0 + uSeed * 1.9, 3) * 0.5 + 0.5) * spots;
    lavaGlow = max(lavaGlow, vent);
    albedo = mix(albedo, vec3(0.05, 0.03, 0.02), vent);
  }
  return albedo;
}
