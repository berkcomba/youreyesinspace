#ifdef SKIN
// ---------------------------------------------------------------------------
// A library skin (SkinLibrary.ts): two 2:1 equirect maps baked in Blender, top row = north (+Y),
// u = 0 toward −X then −Z (Blender's −X, −Y with Z up). Read by the surface bake and by the
// ground generated under a landing, so both show the same world.
//   C  rgb albedo (sRGB texture), a flag (1 open water, < 0.5 lava glow / 2)
//   N  rgb normal ×0.5+0.5 in the skin's frame, a height 0 … 1
// ---------------------------------------------------------------------------
uniform sampler2D uSkinC;
uniform sampler2D uSkinN;
uniform mat3 uSkinRot;       // body direction → skin direction (a turn about the pole, maybe mirrored)
uniform vec3 uSkinMean;      // the skin's mean land albedo (linear)
uniform vec3 uSkinTint;      // per-channel gain toward the body's own palette
uniform float uSkinContrast; // 1 as baked, < 1 flattened toward the mean (hazy decks)
uniform float uSkinSlope;    // normal tilt → slope units of the surface shader (1 / its bump scale)
uniform float uSkinSea;      // the sea surface in the skin's height (< 0: its water is lakes, no one level)
uniform float uSkinWater;    // the skin's fraction of open water (0: its flag is lava glow only)
uniform float uSkinCraters;  // 1: the body's own craters and hills go over it (0: a real map, as it is)
uniform float uSkinFrozen;   // 1: the map's seas are frozen over (icy worlds: plains of clean ice)

// The body's own geology over the skin (SkinLibrary.ts: geology), so that no two worlds that draw
// the same map look alike: the map bent at the scale of continents, its colours turned, provinces,
// and the landforms of its kind of world. Directions are the body's (Y = its pole; +X faces the
// star on a tidally locked world). With SKIN_FLAT (gas giants) the deck has its own, further down.
uniform float uGeoSeed;
uniform float uGeoWarp;      // bend of the map (unit-sphere offset; 0 none)
uniform vec3 uGeoTintA;      // albedo gains of two provinces
uniform vec3 uGeoTintB;
uniform vec3 uGeoChroma;     // land: turn of hue (rad), saturation gain; the sea's turn of hue
uniform vec4 uGeoRift;       // a rift system's great circle: its pole (xyz), depth (w; 0 none)
uniform vec4 uGeoRiftMid;    // its middle (unit, on the circle), half-length (rad)
uniform float uGeoRiftWidth; // half-width of the main trough (rad)
uniform float uGeoLineae;    // strength of an icy crust's fracture bands (Europa)
uniform vec4 uGeoVolc[3];    // shield volcanoes: summit (unit), base radius (rad; 0 none)
uniform float uGeoVolcH;     // their height (skin height units)
uniform vec3 uGeoCap;        // polar caps: sin(latitude) of their edge (0 none), spiral troughs (0/1), dome height
uniform vec4 uGeoHemi;       // a hemisphere apart: its apex (unit), strength (w; 0 none)
uniform vec3 uGeoHemiTint;   // that hemisphere's albedo gain
uniform float uGeoHemiDrop;  // and how far it lies below the rest (lowlands)
uniform float uGeoFlora;     // a further turn of hue where the map is green: vegetation of another pigment
uniform vec4 uGeoSea;        // the seas' own colour and how far they take it (a; 0: the map's water)
uniform vec4 uGeoBasin;      // a giant impact basin: its centre (unit), radius (rad; 0 none)
uniform vec3 uGeoBasinLook;  // its depth (height units), its floor's albedo gain, the strength of its rays
uniform vec3 uGeoEye;        // a locked world's sub-stellar pupil: radius (rad; 0 none), kind (1 thawed sea, 2 magma ocean), raggedness
uniform vec3 uGeoEyeCol;     // the colour of the sea there

// A gas giant's deck (SKIN_FLAT): the map's latitudes stretched and squeezed, the world's own
// belts and zones (gas_common.glsl: its band colours) under the map's streaks and eddies, polar
// hoods, ovals that wind the clouds around them
uniform vec3 uGasRemap;      // latitude shift: amplitude (0 none), frequency, phase
uniform float uGasBelts;     // how far the deck takes the world's own belts (0: the map as tinted)
uniform vec3 uGasBright;     // the brightest of its colours (companion clouds)
uniform vec4 uGasPolar;      // the polar hoods' colour, strength (a)
uniform vec4 uGasStorm[3];   // ovals: latitude, longitude, half-height (rad), tone (0 none, > 0 coloured, < 0 a dark spot)
uniform vec3 uGasStormCol;

// Everything the geology lays on one point, taken once: the bake's two passes and the ground's
// height, water and colour all read it (each landform inlined once more would cost seconds of
// shader compilation on D3D)
struct Geo {
  vec3 dir;      // where to read the skin (skinDir)
  float h;       // what it adds to the skin's height (0 … 1 scale)
  float rift;    // 0 … 1 on a rift's floor
  float wall;    // its walls
  float band;    // icy fracture bands
  float ridge;   // their double ridges
  float flows;   // lava flows on a shield, −1 … 1
  float flank;   // its dark basalt
  float cap;     // polar ice
  float trough;  // the cap's spiral troughs
  float hemi;    // the hemisphere apart
  float basin;   // the floor of the giant basin
  float rays;    // its ejecta rays
  float eye;     // the pupil: open water, or how far the magma glows
};

#ifndef SKIN_FLAT
vec3 skinDir(vec3 p) {
  vec3 q = uSkinRot * p;
  if (uGeoWarp <= 0.0) return q;
  // gentle enough not to fold the map over itself (that smears it into marbling)
  vec3 s = p * 1.4 + uGeoSeed;
  vec3 w = vec3(snoise(s), snoise(s + 17.3), snoise(s + 31.7));
  return normalize(q + uGeoWarp * w);
}

// a smooth wander along a line, −1 … 1 (cheaper than noise where one dimension will do)
float wander(float x, float s) {
  return 0.6 * sin(x + s * 6.1) + 0.4 * sin(x * 2.3 + s * 3.7);
}

// A rift system (Valles Marineris, Ithaca Chasma): a main trough along an arc of a great circle,
// flanking chasmata, side canyons, a labyrinth of short troughs at one end. 0 outside … 1 on the
// floor; `wall` peaks on the walls (their layered beds).
float riftAt(vec3 p, out float wall) {
  wall = 0.0;
  if (uGeoRift.w <= 0.0) return 0.0;
  vec3 A = uGeoRift.xyz, M = uGeoRiftMid.xyz, B = cross(A, M);
  float L = uGeoRiftMid.w, W = uGeoRiftWidth;
  float s = dot(p, A);
  if (abs(s) > W * 6.0 + 0.02) return 0.0;
  float t = atan(dot(p, B), dot(p, M)) / L;   // −1 … 1 along the arc
  if (abs(t) > 1.25) return 0.0;
  // the edges wander and are bitten by spurs and alcoves
  float sw = s + W * (0.5 * snoise(p * 7.0 + uGeoSeed) + 0.25 * snoise(p * 26.0 + uGeoSeed * 1.3));
  float w = W * (1.0 - smoothstep(0.6, 1.1, abs(t))) * (0.75 + 0.4 * wander(t * 2.5, uGeoSeed));
  float d = 1.0 - smoothstep(w * 0.72, w, abs(sw));
  // flanking chasmata, parallel and narrower, along part of the length
  float w2 = w * 0.42 * smoothstep(0.0, 0.35, wander(t * 1.7, uGeoSeed + 0.3));
  d = max(d, (1.0 - smoothstep(w2 * 0.6, w2, abs(sw - w * 2.4))) * 0.85);
  float w3 = w * 0.36 * smoothstep(0.1, 0.4, wander(t * 1.9, uGeoSeed + 0.7));
  d = max(d, (1.0 - smoothstep(w3 * 0.6, w3, abs(sw + w * 2.9))) * 0.75);
  // side canyons: short branches off the main trough, their heads eaten back into the plateau
  float side = abs(snoise(vec3(t * 11.0, sw / W * 0.2, uGeoSeed)));
  d = max(d, (1.0 - smoothstep(0.08, 0.2, side)) * (1.0 - smoothstep(w, w * 2.2, abs(sw))) * 0.55);
  // the labyrinth (Noctis): a mesh of troughs at the western end
  float lab = smoothstep(-0.55, -0.9, t) * (1.0 - smoothstep(1.2, 1.25, abs(t)));
  if (lab > 0.0) {
    vec3 q = p * (0.35 / W) + uGeoSeed;
    float net = 1.0 - smoothstep(0.06, 0.16, min(abs(snoise(q)), abs(snoise(q + 41.0))));
    d = max(d, net * lab * (1.0 - smoothstep(W * 2.0, W * 4.0, abs(s))) * 0.55);
  }
  wall = d * (1.0 - d) * 4.0;
  return d;
}

// Fracture bands of an icy crust (Europa's lineae): long arcs of great circles, a bright double
// ridge between dark, reddish margins; 0 … 1 and the ridges in `ridge`
float lineaeAt(vec3 p, out float ridge) {
  ridge = 0.0;
  if (uGeoLineae <= 0.0) return 0.0;
  float band = 0.0;
  for (int k = 0; k < 6; k++) {
    vec3 h = hash33(vec3(float(k) * 3.7, uGeoSeed, 11.0));
    vec3 A = normalize(h * 2.0 - 1.0);
    float s = dot(p, A) + 0.004 * sin(dot(p, h.zxy) * 23.0 + float(k));
    float w = 0.006 + 0.009 * h.x;
    // each runs for a stretch, fades, comes back
    float on = smoothstep(-0.1, 0.25, snoise(p * 1.3 + float(k) * 7.1 + uGeoSeed));
    float b = (1.0 - smoothstep(w * 0.5, w, abs(s))) * on;
    band = max(band, b);
    ridge = max(ridge, (1.0 - smoothstep(0.0, w * 0.18, abs(abs(s) - w * 0.22))) * on);
  }
  // a finer, denser generation of cracks between them
  float fine = (1.0 - smoothstep(0.0, 0.025, abs(snoise(p * 9.0 + uGeoSeed * 1.7)))) * (0.5 + 0.5 * snoise(p * 2.0 + uGeoSeed));
  return clamp(band + fine * 0.25, 0.0, 1.0) * uGeoLineae;
}

// Shield volcanoes (Olympus, Tharsis): broad cones with a basal scarp, a summit caldera, lava
// flows down their flanks (`flows`: −1 … 1 darker or brighter flows, 0 off the cones)
float volcanoesAt(vec3 p, out float flows, out float flank) {
  flows = 0.0;
  flank = 0.0;
  float h = 0.0;
  for (int k = 0; k < 3; k++) {
    vec4 v = uGeoVolc[k];
    if (v.w <= 0.0) continue;
    float d = acos(clamp(dot(p, v.xyz), -1.0, 1.0)) / v.w;
    if (d > 1.6) continue;
    float cone = pow(max(1.0 - d, 0.0), 1.5) * smoothstep(1.02, 0.93, d) + 0.08 * smoothstep(1.6, 1.0, d);
    // a nested caldera: a pit and a ring of collapse scarps around it
    float caldera = smoothstep(0.12, 0.07, d) + 0.4 * smoothstep(0.16, 0.13, d) * smoothstep(0.1, 0.13, d);
    h += (cone - caldera * 0.14) * uGeoVolcH * (0.6 + 0.4 * hash13(v.xyz * 17.0));
    // lobes down the slope: noise of the heading, bent and broken up along the radius
    vec3 side = normalize(p - v.xyz * dot(p, v.xyz) + 1e-5);
    vec3 q = side * 9.0 + v.xyz * d * 7.0 + float(k) * 3.1 + uGeoSeed;
    float f = snoise(q + 0.8 * snoise(p * (5.0 / v.w))) + 0.4 * snoise(q * 2.7 - uGeoSeed);
    flows += f * smoothstep(1.3, 0.6, d) * smoothstep(0.0, 0.15, d);
    flank = max(flank, clamp(smoothstep(1.25, 0.85, d) - 0.6 * caldera, 0.0, 1.0));
  }
  return h;
}

// Polar caps: bright ice down to a wandering edge, cut by dark spiral troughs (Mars' north cap)
float capAt(vec3 p, out float trough) {
  trough = 0.0;
  if (uGeoCap.x <= 0.0) return 0.0;
  float lat = abs(p.y);
  if (lat < uGeoCap.x - 0.08) return 0.0;
  float edge = uGeoCap.x + 0.04 * fbm(p * 5.0 + uGeoSeed, 2);
  float cap = smoothstep(edge - 0.015, edge + 0.015, lat);
  if (uGeoCap.y > 0.5 && cap > 0.0) {
    float r = length(p.xz);
    float th = atan(p.z, p.x) * sign(p.y);
    float sp = sin(th * 3.0 + log(max(r, 1e-3)) * 9.0 + snoise(p * 6.0 + uGeoSeed) * 1.2);
    trough = smoothstep(0.82, 0.97, sp) * smoothstep(0.98, 0.9, lat) * cap;
  }
  return cap;
}

float hemiAt(vec3 p) {
  if (uGeoHemi.w <= 0.0) return 0.0;
  return smoothstep(-0.12, 0.22, dot(p, uGeoHemi.xyz) + 0.18 * fbm(p * 2.6 + uGeoSeed, 3)) * uGeoHemi.w;
}

// One giant impact (Caloris, Herschel on Mimas, Valhalla): a bowl with a central peak inside a
// raised rim and a fainter outer ring, bright rays thrown across the globe. Returns its floor
// (0 … 1), its height in `dh`, the rays in `rays`.
float basinAt(vec3 p, out float rays, out float dh) {
  rays = 0.0;
  dh = 0.0;
  if (uGeoBasin.w <= 0.0) return 0.0;
  float cd = dot(p, uGeoBasin.xyz);
  if (cd < cos(min(uGeoBasin.w * 5.0, 3.1))) return 0.0;
  float t = acos(clamp(cd, -1.0, 1.0)) / uGeoBasin.w + 0.05 * snoise(p * 6.0 + uGeoSeed);
  float r1 = (t - 1.0) * 5.0, r2 = (t - 1.45) * 6.0, pk = t * 6.0;
  dh = ((smoothstep(0.0, 1.0, t) - 1.0) * 0.8 + exp(-r1 * r1) * 0.45 + exp(-r2 * r2) * 0.18 + exp(-pk * pk) * 0.3) * uGeoBasinLook.x;
  if (t > 1.0 && uGeoBasinLook.z > 0.0) {
    vec3 side = normalize(p - uGeoBasin.xyz * cd + 1e-5);
    float streak = smoothstep(0.55, 0.9, snoise(side * 8.0 + uGeoSeed) * 0.5 + 0.5 + 0.2 * snoise(p * 14.0 + uGeoSeed));
    rays = streak * exp(-(t - 1.0) * 0.6) * smoothstep(1.0, 1.3, t);
  }
  return 1.0 - smoothstep(0.75, 1.0, t);
}

// The pupil of a world that keeps one face to its star (+X): where the star stands overhead the
// ice thaws to a sea ringed by floes, or the rock itself melts to a magma ocean rafted with
// crust. Returns open water (0 / the depth toward the middle) or the glow of the magma (0 … 1);
// `sink`: how far the ground lies under the rest.
float eyeAt(vec3 p, out float sink) {
  sink = 0.0;
  if (uGeoEye.x <= 0.0) return 0.0;
  float ang = acos(clamp(p.x, -1.0, 1.0)) + uGeoEye.z * fbm(p * 3.5 + uGeoSeed, 3);
  float inner = (uGeoEye.x - ang) / uGeoEye.x;   // 0 on the edge, 1 under the star
  if (inner <= 0.0) return 0.0;
  if (uGeoEye.y < 1.5) {
    float open = smoothstep(-0.05, 0.05, snoise(p * 24.0 + uGeoSeed) * 0.5 + inner * 1.6 - 0.35);
    sink = open * 0.02;
    return open * max(inner, 0.08);
  }
  float n1 = snoise(p * 6.0 + uGeoSeed), n2 = snoise(p * 15.0 + uGeoSeed * 1.7);
  float cracks = (1.0 - smoothstep(0.0, 0.05, abs(n1))) * 0.9 + (1.0 - smoothstep(0.0, 0.035, abs(n2))) * 0.6;
  float rafts = smoothstep(0.25, 0.6, fbm(p * 3.0 + uGeoSeed * 2.1, 3) * 0.5 + 0.5);
  float open = smoothstep(0.3, 0.75, inner + 0.3 * (0.5 - rafts));
  sink = open * 0.03;
  return clamp(open + cracks * smoothstep(0.0, 0.25, inner), 0.0, 1.0);
}

Geo geoAt(vec3 p) {
  Geo g;
  g.dir = skinDir(p);
  g.rift = riftAt(p, g.wall);
  g.band = lineaeAt(p, g.ridge);
  g.h = volcanoesAt(p, g.flows, g.flank);
  g.cap = capAt(p, g.trough);
  g.hemi = hemiAt(p);
  float dh, sink;
  g.basin = basinAt(p, g.rays, dh);
  g.eye = eyeAt(p, sink);
  g.h += -g.rift * uGeoRift.w + g.ridge * 0.012 + (g.cap - g.trough * 0.5) * uGeoCap.z - g.hemi * uGeoHemiDrop + dh - sink;
  return g;
}
#else
vec3 gasStormCentre(vec4 st) {
  return vec3(cos(st.x) * cos(st.y), sin(st.x), cos(st.x) * sin(st.y));
}

Geo geoAt(vec3 p) {
  vec3 q = p;
  // the ovals wind the deck around them
  for (int k = 0; k < 3; k++) {
    vec4 st = uGasStorm[k];
    if (st.w == 0.0) continue;
    vec3 c = gasStormCentre(st);
    float d = acos(clamp(dot(p, c), -1.0, 1.0)) / (st.z * 2.2);
    if (d >= 1.0) continue;
    float a = 2.2 * (1.0 - d) * (1.0 - d) * sign(st.x + 1e-4);
    q = q * cos(a) + cross(c, q) * sin(a) + c * dot(c, q) * (1.0 - cos(a));
  }
  // belts and zones at other latitudes on every world: the latitude scale stretched and squeezed
  if (uGasRemap.x > 0.0) {
    float y = clamp(q.y + uGasRemap.x * (1.0 - q.y * q.y) * sin(q.y * uGasRemap.y + uGasRemap.z), -1.0, 1.0);
    float s = sqrt(max(1.0 - y * y, 0.0) / max(1.0 - q.y * q.y, 1e-6));
    q = vec3(q.x * s, y, q.z * s);
  }
  return Geo(uSkinRot * q, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0);
}
#endif

// the ground under a landing reads a few km of the skin: the full-resolution level (the
// derivatives jump at the u seam); the bake minifies it to the cube's resolution
vec4 skinTex(sampler2D s, vec2 uv) {
#ifdef SKIN_GROUND
  return textureLod(s, uv, 0.0);
#else
  return texture2D(s, uv);
#endif
}

vec2 skinUV(vec3 q) {
  return vec2(fract(atan(q.z, -q.x) / 6.2831853), 0.5 - asin(clamp(q.y, -1.0, 1.0)) / 3.1415927);
}

// the geology's colours over the skin's (`c.a` the skin's flag: a cap freezes the sea over)
void geoColor(vec3 p, Geo g, inout vec4 c) {
#ifndef SKIN_FLAT
  bool sea = uSkinWater > 0.0 && c.a > 0.5;
  vec3 col = c.rgb;
  // hue and saturation turned in YIQ: the vegetation olive or teal, the sea navy or turquoise;
  // what is green on the map (its plants) may wear another pigment altogether
  float veg = clamp((col.g - max(col.r, col.b)) / max(col.g, 1e-3) * 4.0, 0.0, 1.0);
  float turn = sea ? uGeoChroma.z : uGeoChroma.x + uGeoFlora * veg;
  float sat = sea ? 1.0 : uGeoChroma.y;
  float Y = dot(col, vec3(0.299, 0.587, 0.114));
  vec2 iq = vec2(dot(col, vec3(0.596, -0.274, -0.322)), dot(col, vec3(0.211, -0.523, 0.312)));
  iq = vec2(iq.x * cos(turn) - iq.y * sin(turn), iq.x * sin(turn) + iq.y * cos(turn)) * sat;
  col = max(vec3(Y + 0.956 * iq.x + 0.621 * iq.y, Y - 0.272 * iq.x - 0.647 * iq.y, Y - 1.106 * iq.x + 1.703 * iq.y), 0.0);
  // seas that are not water (hydrocarbons, acid): their own colour, the map's depths kept as tone
  if (sea && uGeoSea.a > 0.0) col = mix(col, uGeoSea.rgb * clamp(Y / 0.05, 0.5, 1.8), uGeoSea.a);
  if (!sea) {
    col *= mix(uGeoTintA, uGeoTintB, smoothstep(-0.3, 0.3, fbm(p * 1.5 + uGeoSeed * 1.7, 3)));
    col *= mix(vec3(1.0), uGeoHemiTint, g.hemi);
    // dark floors (dunes, landslides), the walls' beds in bands
    if (g.rift > 0.0) col *= (1.0 - 0.25 * g.rift) * (1.0 + g.wall * 0.16 * sin(g.rift * 31.0 + snoise(p * 40.0) * 2.0));
    col = mix(col, col * vec3(0.72, 0.55, 0.42), g.band * 0.75);
    col *= 1.0 + g.ridge * 0.18 * uGeoLineae;
    // dark young basalt on the shields, the flows streaked darker and paler over it
    float Yc = dot(col, vec3(0.299, 0.587, 0.114));
    col = mix(col, mix(vec3(Yc), col, 0.6) * 0.62, g.flank * 0.8);
    col *= 1.0 + 0.3 * g.flows;
    // the great basin: its floor flooded dark or lined with fresh ice, its rays
    col *= mix(1.0, uGeoBasinLook.y, g.basin) * (1.0 + g.rays * uGeoBasinLook.z);
  }
  if (g.cap > 0.0) {
    vec3 ice = mix(vec3(0.93, 0.92, 0.9), col, 0.12) * (0.94 + 0.06 * snoise(p * 30.0 + uGeoSeed));
    col = mix(col, mix(ice, col * 0.7, g.trough), g.cap);
    if (g.cap > 0.5) c.a = 0.0;
  }
  if (uGeoEye.x > 0.0) {
    if (uGeoEye.y < 1.5) {
      // the thawed sea: turquoise over the shallows at the ice edge, deep under the star
      if (g.eye > 0.0) {
        col = mix(uGeoEyeCol * 2.4 + vec3(0.0, 0.05, 0.045), uGeoEyeCol, smoothstep(0.08, 0.5, g.eye));
        c.a = 1.0;
      }
    } else {
      col = mix(col, vec3(0.05, 0.03, 0.025), g.eye);
      c.a = max(c.a, g.eye * 0.5);
    }
  }
  c.rgb = col;
#else
  vec3 col = c.rgb;
  const vec3 LUM = vec3(0.299, 0.587, 0.114);
  if (uGasBelts > 0.0) {
    // the map's tone, 1 at its mean: it carries the streaks, the eddies and the ovals
    float l = dot(col, LUM) / max(dot(uSkinMean * uSkinTint, LUM), 1e-3);
    // the world's belts and zones by the deck's own latitude (wound round the ovals with it),
    // of uneven width, their edges pushed about by the map's tones
    float t = asin(clamp(g.dir.y, -1.0, 1.0)) / 1.5707963;
    float tw = t + 0.10 * snoise(vec3(t * 2.5 + 3.0, uGeoSeed * 0.13, 1.0)) + 0.045 * snoise(vec3(t * 6.0, uGeoSeed * 0.29, 5.0));
    float k = (sign(tw) * pow(abs(tw), 1.25) * 0.5 + 0.5) * uBandFreq + clamp(l - 1.0, -0.5, 0.5) * 0.4;
    // (two taps: the edge of a belt is a soft one, the map's grain does not chalk it)
    vec3 belt = 0.5 * (bandColor(k - 0.11) + bandColor(k + 0.11));
    col = mix(col, belt * clamp(0.4 + 0.6 * l, 0.6, 1.18), uGasBelts);
  }
  if (uGasPolar.a > 0.0) {
    float hood = smoothstep(0.74, 0.93, abs(p.y) + 0.04 * snoise(p * 5.0 + uGeoSeed));
    col = mix(col, uGasPolar.rgb * (0.92 + 0.16 * fbm(p * 9.0 + uGeoSeed, 3)), hood * uGasPolar.a);
  }
  float lat = asin(clamp(p.y, -1.0, 1.0)), lon = atan(p.z, p.x);
  for (int k = 0; k < 3; k++) {
    vec4 st = uGasStorm[k];
    if (st.w == 0.0) continue;
    float dLon = mod(lon - st.y + 3.14159265, 6.2831853) - 3.14159265;
    vec2 d = vec2(dLon * cos(st.x) / 1.7, lat - st.x) / st.z;
    float r = length(d);
    if (r > 2.2) continue;
    float arms = 0.5 + 0.5 * sin(atan(d.y, d.x) * 2.0 - r * 8.0 + 2.0 * snoise(vec3(d * 3.0, uGeoSeed + float(k))));
    float mask = smoothstep(1.05, 0.7, r + 0.14 * (arms - 0.5));
    // a coloured anticyclone (the Great Red Spot), or a dark hole in the deck with bright
    // companion clouds on its rim (Neptune's Great Dark Spot)
    vec3 sc = st.w > 0.0 ? uGasStormCol * (0.8 + 0.3 * arms) * (0.8 + 0.35 * smoothstep(0.8, 0.2, r))
                         : col * (0.4 + 0.15 * arms);
    col *= 1.0 - 0.2 * smoothstep(1.7, 1.05, r) * (1.0 - mask);
    col = mix(col, sc, mask * min(abs(st.w), 1.0) * 0.92);
    if (st.w < 0.0) col = mix(col, uGasBright * 1.15, smoothstep(0.25, 0.0, abs(r - 1.05) + 0.25 * (1.0 - arms)) * step(0.0, d.y * sign(st.x)) * 0.7);
  }
  c.rgb = col;
#endif
}

vec4 skinColorG(vec3 p, Geo g) {
  vec4 c = skinTex(uSkinC, skinUV(g.dir));
  if (uSkinFrozen > 0.5 && c.a > 0.5) {
    // smooth young ice, a shade brighter and bluer than the land around it
    float l = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722)) / max(dot(uSkinMean, vec3(0.2126, 0.7152, 0.0722)), 1e-3);
    c.rgb = mix(c.rgb, uSkinMean * vec3(1.08, 1.14, 1.2) * (0.92 + 0.08 * clamp(l, 0.0, 2.0)), smoothstep(0.5, 0.9, c.a));
    c.a = 0.0;
  }
  c.rgb = max((uSkinMean + (c.rgb - uSkinMean) * uSkinContrast) * uSkinTint, 0.0);
  geoColor(p, g, c);
  // a soft shoulder: the tint lifts dark skins a lot, their bright streaks must not clip to white
  vec3 over = max(c.rgb - 0.7, 0.0);
  c.rgb = min(c.rgb, 0.7) + over / (1.0 + over / 0.25);
  return c;
}

vec4 skinColor(vec3 p) { return skinColorG(p, geoAt(p)); }

float skinHeightG(Geo g) {
  return skinTex(uSkinN, skinUV(g.dir)).a;
}

// height + its gradient along the surface shaders' tangent frame, read off the baked normal
vec3 skinReliefG(vec3 p, Geo g) {
  vec4 n = skinTex(uSkinN, skinUV(g.dir));
  vec3 N = normalize(transpose(uSkinRot) * (n.xyz * 2.0 - 1.0));
  vec3 T = normalize(cross(abs(p.y) < 0.99 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0), p));
  vec3 B = cross(p, T);
  float up = max(dot(N, p), 0.2);
  vec2 s = -vec2(dot(N, T), dot(N, B)) / up * uSkinSlope * uSkinContrast;
  return vec3(n.a, s);
}
#endif
