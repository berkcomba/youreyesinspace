// ---------------------------------------------------------------------------
// Terrestrial body: the procedural height field and albedo shared by the globe (terrestrial.frag)
// and the ground generated under a visitor who lands on it (groundheight.frag / groundalbedo.frag),
// so the patch under their feet carries on the globe's own continents, craters and colours.
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

// Height field on unit sphere, 0..1
float heightAt(vec3 p) {
  vec3 q = p * uRoughness + uSeed;
  // Continental scale, medium detail and ridged mountains
  float continents = fbm(q * 1.35, 4);
  float detail = fbm(q * 4.5 + 11.0, 6);
  float h = 0.5 + 0.36 * continents + 0.16 * detail;
  float land = smoothstep(0.42, 0.62, h);
  float mountains = ridged(q * 6.0 + 3.1, 5);
  h += mountains * 0.14 * land;
  if (uCraters > 0.0) {
    h += craterField(p, uSeed, uCraters * 0.85) * 0.12;
  }
  return h;
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
    albedo = mix(uOcean * 1.6, uOcean * 0.55, smoothstep(0.0, 0.5, depth));
    // shallow shelf tint
    albedo = mix(albedo, uLandLow * 0.6 + uOcean, smoothstep(0.04, 0.0, depth) * 0.5);
  } else {
    float t = hasOcean ? clamp((h - uSeaLevel) / max(1.0 - uSeaLevel, 0.01), 0.0, 1.0) : h;
    vec3 low = uLandLow * (1.0 + variation * 0.35);
    vec3 mid = uLandMid * (1.0 - variation * 0.25);
    albedo = t < 0.5 ? mix(low, mid, smoothstep(0.0, 0.5, t)) : mix(mid, uLandHigh, smoothstep(0.5, 1.0, t));
    // fine surface detail
    float detail = snoise(p * 40.0 * uRoughness + uSeed) * 0.06 + snoise(p * 120.0 + uSeed) * 0.03;
    albedo *= 1.0 + detail;
    if (hasOcean) {
      // Climate zones: arid belts at low latitudes where the variation noise is high
      vec3 sand = mix(uLandMid, vec3(0.78, 0.66, 0.42), 0.6);
      float arid = smoothstep(0.05, 0.45, variation) * (1.0 - smoothstep(0.25, 0.6, abs(p.y))) * (1.0 - smoothstep(0.55, 0.85, t));
      albedo = mix(albedo, sand, arid * 0.85);
      // Lush variation elsewhere
      albedo = mix(albedo, albedo * vec3(0.85, 1.05, 0.8), smoothstep(-0.1, -0.5, variation) * 0.5);
    } else {
      // Large-scale tonal variation (regolith maturity, terrain provinces)
      albedo *= 1.0 + variation * 0.45;
      albedo = mix(albedo, albedo.bgr * 0.35 + albedo * 0.65, clamp(variation * 0.3, 0.0, 0.4));
    }
  }

  // Ice caps (latitude in object space) + high altitude snow
  if (uIceCaps > 0.0) {
    float lat = abs(p.y);
    float capNoise = fbm(p * 4.0 + uSeed * 0.3, 3) * 0.08;
    float capEdge = uIceCaps + capNoise - (ocean ? 0.02 : (h - 0.5) * 0.25);
    float cap = smoothstep(capEdge - 0.03, capEdge + 0.03, lat);
    float snowline = hasOcean ? smoothstep(0.86, 0.96, h) : 0.0;
    albedo = mix(albedo, uIce, max(cap, snowline * 0.8));
    ocean = ocean && cap < 0.5;
  }

  // Contrast / saturation compensation for tone mapping
  {
    float lum = dot(albedo, vec3(0.299, 0.587, 0.114));
    albedo = mix(vec3(lum), albedo, 1.3);
    albedo = pow(max(albedo, 0.0), vec3(1.15));
  }

  // Volcanic hot-spots (Io)
  lavaGlow = 0.0;
  if (uVolcanic > 0.0) {
    float spots = smoothstep(0.62, 0.9, fbm(p * 6.0 + uSeed * 4.1, 4) * 0.5 + 0.5);
    vec3 dark = vec3(0.25, 0.12, 0.05);
    albedo = mix(albedo, dark, spots * 0.8);
    float vent = smoothstep(0.86, 0.97, fbm(p * 14.0 + uSeed * 1.9, 3) * 0.5 + 0.5) * spots;
    lavaGlow = vent;
    albedo = mix(albedo, vec3(0.05, 0.03, 0.02), vent);
  }
  return albedo;
}
