// ---------------------------------------------------------------------------
// Ground generated under a landing site (see render/GroundGen.ts): the maps of one square ring
// around the site, in the site's frame (km, +X east, +Z south). Each texel's spot on the globe is
// found by walking out along the tangent plane and reading the globe's own height field there.
// ---------------------------------------------------------------------------
uniform vec3 uSitePos;       // the site on the ellipsoid (object frame, km)
uniform vec3 uEast;          // unit east at the site (object frame)
uniform vec3 uNorth;         // unit north at the site (object frame)
uniform float uUnsquash;     // 1 / (1 − flattening): back to the sphere the noise is sampled on
uniform float uHalf;         // half-size of this ring (km)
uniform float uAmp;          // relief amplitude (km) for the height field's 0…1
uniform float uDetail;       // ground-scale relief amplitude (km); 0 = none
uniform float uRes;          // texels per side; > 0: texel i sits exactly at x = −half + i·cell (height maps)
varying vec2 vUv;

// local (x east, z south) km of this texel
vec2 localXZ() {
  if (uRes > 0.0) {
    vec2 i = floor(gl_FragCoord.xy); // 0 … uRes−1
    return (i / (uRes - 1.0) - 0.5) * 2.0 * uHalf;
  }
  return (vUv - 0.5) * 2.0 * uHalf;
}

// unit direction on the noise sphere for a local offset
vec3 noiseDir(vec2 xz) {
  vec3 obj = uSitePos + uEast * xz.x - uNorth * xz.y;
  return normalize(vec3(obj.x, obj.y * uUnsquash, obj.z));
}

// metre-scale relief: dunes, hummocks, gullies, boulders — what the globe's field, whose finest
// feature spans tens of kilometres, has no word for. km-space noise so it is the same on every ring.
float groundDetail(vec2 xz, float h) {
  if (uDetail <= 0.0) return 0.0;
  vec3 q = vec3(xz.x, xz.y, uSeed * 0.13);
  float d = 0.0;
  // hills and ridges the globe's field (finest feature: tens of km) smooths away
  d += snoise(q / 22.0) * 0.32;
  d += snoise(q / 7.0 + 1.0) * 0.11;
  d += snoise(q / 2.8) * 0.04;
  d += snoise(q / 0.75 + 3.1) * 0.013;
  d += snoise(q / 0.21 + 7.7) * 0.004;
  d += snoise(q / 0.055 + 1.9) * 0.0011;
  d += snoise(q / 0.014 + 5.3) * 0.0003;
  // rougher on the highlands, gentler on the plains
  d *= 0.55 + 0.9 * smoothstep(0.35, 0.8, h);
  // cratered worlds: bowls and rims from a few km across down to a few hundred metres
  if (uCraters > 0.0) {
    d += craterField(vec3(xz.x, xz.y, 0.0) / 12.0, uSeed + 3.0, uCraters) * 0.22;
    d += craterField(vec3(xz.x, xz.y, 0.0) / 1.3, uSeed + 5.0, uCraters * 0.6) * 0.02;
  }
  return d * uDetail;
}

// Real imagery around the site (a tile of the globe's imagery layer), sampled by latitude /
// longitude: uRealRect = (lon0, latBottom, span, mode) with mode 0 = none, 1 = colours,
// 2 = colours and water told from land by colour (Blue Marble).
uniform sampler2D uRealMap;
uniform vec4 uRealRect;

// linear RGB of the imagery at unit direction p (false if there is none)
bool realColour(vec3 p, out vec3 rgb) {
  if (uRealRect.w < 0.5) { rgb = vec3(0.0); return false; }
  float lat = degrees(asin(clamp(p.y, -1.0, 1.0)));
  float lon = degrees(atan(-p.z, p.x));
  if (lon < uRealRect.x) lon += 360.0;
  vec2 uv = vec2(lon - uRealRect.x, lat - uRealRect.y) / uRealRect.z;
  rgb = texture2D(uRealMap, clamp(uv, 0.0, 1.0)).rgb;
  // the globe's own contrast compensation (tile.frag)
  float lum = dot(rgb, vec3(0.299, 0.587, 0.114));
  rgb = pow(max(mix(vec3(lum), rgb, 1.2), 0.0), vec3(1.08));
  return true;
}

// open water according to the imagery (dark, blue-dominant pixels of Blue Marble)
bool realWater(vec3 rgb) {
  if (uRealRect.w < 1.5) return false;
  float lum = dot(rgb, vec3(0.299, 0.587, 0.114));
  return rgb.b - rgb.r > 0.03 && lum < 0.2;
}

// Shield volcanoes on volcanic worlds: broad cones a few hundred metres to a kilometre high with
// a caldera at the summit; `lava` (0..1) marks the caldera floor and the channels down the flanks.
float volcanoes(vec2 xz, out float lava) {
  lava = 0.0;
  if (uVolcanic <= 0.0) return 0.0;
  vec3 q = vec3(xz.x, xz.y, uSeed * 0.21);
  float v = snoise(q / 16.0 + 23.0) * 0.7 + snoise(q / 5.0 + 2.0) * 0.3;
  float cone = smoothstep(0.3, 0.9, v);
  float h = pow(cone, 1.4) * min(1.2, 0.3 + uAmp * 0.15);
  float caldera = smoothstep(0.78, 0.9, v);
  h -= caldera * 0.3 * min(1.2, 0.3 + uAmp * 0.15);
  // channels: narrow ridges of a noise field, only on the flanks of a cone
  float ch = 1.0 - abs(snoise(q / 1.6 + 7.0));
  float channel = smoothstep(0.9, 0.99, ch) * smoothstep(0.1, 0.5, cone) * (1.0 - caldera);
  lava = max(caldera, channel * 0.9);
  return h;
}

// Lakes in the lowlands of worlds with seas: one per ~24 km cell where the land is flat enough,
// filled to a single level (the land's own height at the lake's centre). Returns the water level
// and `inside` (0 outside the shore … 1 well inside); the floor is dished below the level.
float lakeAt(vec2 xz, out float inside) {
  inside = 0.0;
  if (uSeaLevel < 0.0) return 0.0;
  const float CELL = 24.0;
  vec2 cell = floor(xz / CELL);
  vec3 hsh = hash33(vec3(cell, uSeed * 0.31));
  if (hsh.x < 0.45) return 0.0;
  vec2 centre = (cell + 0.5) * CELL + (hsh.yz - 0.5) * CELL * 0.5;
  float R = 1.5 + hsh.y * 4.5;
  float d = length(xz - centre);
  if (d > R * 1.3) return 0.0;
  // the level: the land at the centre, a little below it so the basin holds water
  vec3 pc = noiseDir(centre);
  float hc = heightAt(pc);
  if (hc < uSeaLevel + 0.03 || hc > 0.8) return 0.0;   // not on the coast, not in the mountains
  float level = (hc - 0.5) * uAmp + groundDetail(centre, hc) - 0.02;
  inside = 1.0 - smoothstep(R * 0.9, R * 1.3, d);
  return level;
}

// land or sea at p: the imagery decides where it can, the globe's own field elsewhere
bool openWater(vec3 p, float h) {
  vec3 rc;
  if (realColour(p, rc) && uRealRect.w > 1.5) return realWater(rc);
  return uSeaLevel >= 0.0 && h < uSeaLevel;
}

// height (km above the ellipsoid) and whether the spot is open water
float groundHeight(vec2 xz, out bool water, out float hNoise) {
  vec3 p = noiseDir(xz);
  float h = heightAt(p);
  hNoise = h;
  water = openWater(p, h);
  if (water) return (uSeaLevel - 0.5) * uAmp;
  // imagery land where the field says sea: a low plain just above it
  if (uSeaLevel >= 0.0 && h < uSeaLevel) h = uSeaLevel + 0.02;
  float g = (h - 0.5) * uAmp + groundDetail(xz, h);
  float lava;
  g += volcanoes(xz, lava);
  // the shore: the last metres of beach slope into the water instead of stepping down
  if (uSeaLevel >= 0.0) g = max(g, (uSeaLevel - 0.5) * uAmp + 0.0005);
  // lakes (not where real imagery decides land and water)
  if (uRealRect.w < 1.5) {
    float inside;
    float level = lakeAt(xz, inside);
    if (inside > 0.0) {
      float bowl = level - 0.04 * inside;
      g = mix(g, min(g, bowl), inside);
      if (g < level - 0.0003) { water = true; return level; }
    }
  }
  return g;
}

// the lava mask of the ground at xz (0 none … 1 molten), for the colour map
float lavaAt(vec2 xz) {
  float lava;
  volcanoes(xz, lava);
  return lava;
}
