#include <logdepthbuf_pars_fragment>

uniform mat4 modelMatrix;
uniform float uSeed;
uniform float uTime;
uniform vec3 uOcean;
uniform vec3 uLandLow;
uniform vec3 uLandMid;
uniform vec3 uLandHigh;
uniform vec3 uIce;
uniform float uSeaLevel;     // <0 => no ocean
uniform float uIceCaps;      // 0 => none, else latitude threshold (0..1)
uniform float uCraters;
uniform float uRoughness;
uniform float uCityLights;
uniform float uVolcanic;
uniform float uVariation;
uniform float uIrregular;
uniform vec3 uAtmColor;
uniform float uAtmDensity;
uniform vec3 uSunsetColor;

varying vec3 vObjPos;
varying vec3 vWorldPos;
varying vec3 vWorldNormal;

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

void main() {
  #include <logdepthbuf_fragment>

  vec3 p = normalize(vObjPos);
  // irregular bodies: the vertex shader already derives a smooth normal from the displaced shape
  vec3 Ngeo = normalize(vWorldNormal);

  // --- height & normal perturbation ---
  float h = heightAt(p);
  vec3 T = normalize(cross(abs(p.y) < 0.99 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0), p));
  vec3 B = cross(p, T);
  // scale epsilon with screen-space derivative so bump detail doesn't alias at distance
  float eps = clamp(length(fwidth(p)) * 1.5, 0.0015, 0.03);
  float hT = heightAt(normalize(p + T * eps));
  float hB = heightAt(normalize(p + B * eps));
  float bumpScale = 0.02 / eps;
  // small bodies: regolith-softened relief — the mesh already carries the big shape
  if (uIrregular > 0.0) bumpScale *= mix(1.0, 0.4, uIrregular);

  // Transform tangent-space bump into world: world tangents via modelMatrix rotation
  vec3 Tw = normalize(mat3(modelMatrix) * T);
  vec3 Bw = normalize(mat3(modelMatrix) * B);
  vec3 N = normalize(Ngeo - (hT - h) * bumpScale * Tw - (hB - h) * bumpScale * Bw);

  bool hasOcean = uSeaLevel >= 0.0;
  bool ocean = hasOcean && h < uSeaLevel;
  if (ocean) N = Ngeo; // flat water

  // --- albedo ---
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
  float lavaGlow = 0.0;
  if (uVolcanic > 0.0) {
    float spots = smoothstep(0.62, 0.9, fbm(p * 6.0 + uSeed * 4.1, 4) * 0.5 + 0.5);
    vec3 dark = vec3(0.25, 0.12, 0.05);
    albedo = mix(albedo, dark, spots * 0.8);
    float vent = smoothstep(0.86, 0.97, fbm(p * 14.0 + uSeed * 1.9, 3) * 0.5 + 0.5) * spots;
    lavaGlow = vent;
    albedo = mix(albedo, vec3(0.05, 0.03, 0.02), vent);
  }

  // --- lighting ---
  vec3 P = vWorldPos;
  vec3 L = normalize(uSunPos - P);
  vec3 V = normalize(-P);
  float NdotL = dot(N, L);
  float NdotLgeo = dot(Ngeo, L);
  float shadow = shadowAt(P, L);
  float terminator = smoothstep(-0.08, 0.15, NdotLgeo);
  float diffuse = fillLit(max(NdotL, 0.0) * terminator * shadow);

  vec3 color = albedo * diffuse * uSunColor;

  // Ocean specular
  if (ocean) {
    vec3 H = normalize(L + V);
    float spec = pow(max(dot(N, H), 0.0), 260.0) * 0.45 + pow(max(dot(N, H), 0.0), 24.0) * 0.05;
    color += vec3(1.0, 0.98, 0.9) * uSunColor * spec * terminator * shadow;
  }

  // Wrap-around ambient (starlight / planetshine) so night side isn't pure black
  color += albedo * 0.0025;

  // Atmosphere on the surface: rim scattering + sunset tint near terminator
  if (uAtmDensity > 0.0) {
    float NdotV = max(dot(Ngeo, V), 0.0);
    float rim = pow(1.0 - NdotV, 3.0);
    float dayFactor = smoothstep(-0.25, 0.35, NdotLgeo);
    vec3 scatter = uAtmColor * rim * dayFactor * uAtmDensity * 0.45;
    float sunset = smoothstep(0.35, -0.05, NdotLgeo) * smoothstep(-0.35, 0.0, NdotLgeo);
    scatter += uSunsetColor * sunset * rim * uAtmDensity * 0.4;
    // mild haze across the disc on the day side (stronger toward the limb)
    float haze = uAtmDensity * 0.12 * (1.0 - NdotV * 0.7) * dayFactor;
    color = mix(color, color * 0.9 + uAtmColor * 0.08, haze);
    color += scatter * shadow * uSunColor;
  }

  // City lights on the night side
  if (uCityLights > 0.0 && !ocean) {
    float night = smoothstep(0.08, -0.12, NdotLgeo);
    float towns = smoothstep(0.55, 0.95, fbm(p * 18.0 + uSeed * 5.3, 4) * 0.5 + 0.5);
    towns *= smoothstep(0.45, 0.8, fbm(p * 5.0 + uSeed * 0.9, 3) * 0.5 + 0.5);
    // fewer lights at high latitudes / altitudes
    towns *= 1.0 - smoothstep(0.75, 0.92, abs(p.y));
    towns *= 1.0 - smoothstep(0.75, 0.9, h);
    color += vec3(1.0, 0.82, 0.55) * towns * night * 0.9 * uCityLights;
  }

  if (lavaGlow > 0.0) {
    color += vec3(1.0, 0.35, 0.05) * lavaGlow * (0.6 + 0.4 * sin(uTime * 0.7 + h * 40.0));
  }

  gl_FragColor = vec4(color * uAlpha, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
