#include <logdepthbuf_pars_fragment>

uniform mat4 modelMatrix;
uniform float uTime;
uniform float uCityLights;
uniform float uIrregular;
uniform vec3 uAtmColor;
uniform float uAtmDensity;
uniform vec3 uSunsetColor;
uniform vec4 uCloud;   // coverage, opacity, seed, height/R of the cloud deck (opacity 0 = none)
uniform float uHaze;   // 0 … 1: an opaque haze deck hides the ground (Titan, Venus)

varying vec3 vObjPos;
varying vec3 vWorldPos;
varying vec3 vWorldNormal;

// heightAt / terrestrialAlbedo and the palette uniforms: terrestrial_common.glsl
// the baked maps: baked_common.glsl

void main() {
  #include <logdepthbuf_fragment>

  vec3 p = normalize(vObjPos);
  // irregular bodies: the vertex shader already derives a smooth normal from the displaced shape
  vec3 Ngeo = normalize(vWorldNormal);
  vec3 T = normalize(cross(abs(p.y) < 0.99 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0), p));
  vec3 B = cross(p, T);
  vec3 Tw = normalize(mat3(modelMatrix) * T);
  vec3 Bw = normalize(mat3(modelMatrix) * B);

  // --- surface: baked maps once ready, the procedural model until then ---
  vec3 albedo;
  vec2 slope;
  float cavity = 1.0;
  float height;
  bool ocean;
  float lavaGlow;
  float bumpScale = 0.02;
  // small bodies: regolith-softened relief — the mesh already carries the big shape
  if (uIrregular > 0.0) bumpScale *= mix(1.0, 0.4, uIrregular);

  if (uBaked > 0.999) {
    Baked b = sampleBaked(p);
    albedo = b.albedo;
    slope = b.slope;
    cavity = b.cavity;
    height = b.height;
    ocean = b.flag > 0.75;
    lavaGlow = ocean ? 0.0 : b.flag * 2.0;
    // closer than the bake resolves: the procedural grain carries on underneath
    float mag = bakeMagnification(p);
    float close = smoothstep(1.5, 6.0, mag);
    if (close > 0.001 && !ocean) {
      float g = snoise(p * 40.0 * uRoughness + uSeed) * 0.05 + snoise(p * 160.0 + uSeed) * 0.04 + snoise(p * 600.0 + uSeed) * 0.03;
      albedo *= 1.0 + g * close;
      float eps = clamp(length(fwidth(p)) * 1.5, 0.0005, 0.01);
      float h0 = snoise(p * 300.0 + uSeed) * 0.004 + snoise(p * 900.0 + uSeed) * 0.0015;
      float hT = snoise(normalize(p + T * eps) * 300.0 + uSeed) * 0.004 + snoise(normalize(p + T * eps) * 900.0 + uSeed) * 0.0015;
      float hB = snoise(normalize(p + B * eps) * 300.0 + uSeed) * 0.004 + snoise(normalize(p + B * eps) * 900.0 + uSeed) * 0.0015;
      slope += vec2(hT - h0, hB - h0) / eps * close;
    }
  } else {
    float h = heightAt(p);
    // scale epsilon with screen-space derivative so bump detail doesn't alias at distance
    float eps = clamp(length(fwidth(p)) * 1.5, 0.0015, 0.03);
    float hT = heightAt(normalize(p + T * eps));
    float hB = heightAt(normalize(p + B * eps));
    slope = vec2(hT - h, hB - h) / eps;
    height = h;
    ocean = uSeaLevel >= 0.0 && h < uSeaLevel;
    albedo = terrestrialAlbedo(p, h, ocean, lavaGlow);
    if (uBaked > 0.001) {
      Baked b = sampleBaked(p);
      albedo = mix(albedo, b.albedo, uBaked);
      slope = mix(slope, b.slope, uBaked);
      cavity = mix(1.0, b.cavity, uBaked);
    }
  }

  vec3 N = normalize(Ngeo - slope.x * bumpScale * Tw - slope.y * bumpScale * Bw);
  if (ocean) N = Ngeo; // flat water
  else albedo *= mix(1.0, cavity, 0.75);

  // --- lighting ---
  vec3 P = vWorldPos;
  vec3 L = normalize(uSunPos - P);
  vec3 V = normalize(-P);
  float NdotL = dot(N, L);
  float NdotLgeo = dot(Ngeo, L);
  float shadow = shadowAt(P, L);
  // cloud shadows drift over the ground (same field as the deck above)
  vec3 Lobj = normalize(transpose(mat3(modelMatrix)) * L);
  shadow *= cloudShadow(p, Lobj, uTime, uCloud);
  float NdotV = max(dot(Ngeo, V), 0.0);
  // an atmosphere softens the terminator (twilight); airless ground cuts it sharp
  float air = clamp(uAtmDensity * 1.5, 0.0, 1.0);
  float terminator = smoothstep(mix(-0.015, -0.08, air), mix(0.05, 0.16, air), NdotLgeo);
  // regolith scatters back toward the light (Lommel–Seeliger): the full Moon is flat and bright
  // to the limb; a Lambert surface would fall off toward it
  float lambert = max(NdotL, 0.0);
  float ls = 2.0 * lambert / max(lambert + max(dot(N, V), 0.0), 1e-3);
  float phase = acos(clamp(dot(L, V), -1.0, 1.0));
  float surge = 1.0 + 0.15 * exp(-phase / 0.12);
  float airless = (1.0 - air) * (ocean ? 0.0 : 1.0);
  float lit = mix(lambert, min(ls, 1.4) * 0.88 * surge, airless * 0.6);
  float diffuse = fillLitV(lit * terminator * shadow, NdotV);

  // low sun through a thick atmosphere arrives reddened
  float lowSun = smoothstep(0.35, -0.05, NdotLgeo) * clamp(uAtmDensity, 0.0, 1.0);
  vec3 warm = uSunsetColor / max(max(uSunsetColor.r, uSunsetColor.g), max(uSunsetColor.b, 1e-3));
  vec3 sunlight = uSunColor * mix(vec3(1.0), warm, lowSun * 0.85);

  vec3 color = albedo * diffuse * sunlight;

  // Ocean: Fresnel-weighted sun glint (a tight core on a rough-sea lobe) and a sky reflection
  if (ocean) {
    vec3 H = normalize(L + V);
    float ndh = max(dot(N, H), 0.0);
    float fres = 0.03 + 0.97 * pow(1.0 - NdotV, 5.0);
    float spec = pow(ndh, 420.0) * 0.55 + pow(ndh, 48.0) * 0.1 + pow(ndh, 6.0) * 0.012;
    color += vec3(1.0, 0.97, 0.9) * sunlight * spec * mix(0.5, 2.5, fres) * terminator * shadow;
    float dayF = smoothstep(-0.2, 0.3, NdotLgeo);
    color += uAtmColor * fres * dayF * uAtmDensity * 0.35 * uSunColor;
  }

  // Wrap-around ambient (starlight / planetshine) so night side isn't pure black
  color += albedo * 0.0025;

  // Atmosphere on the surface: rim scattering + sunset tint near terminator
  if (uAtmDensity > 0.0) {
    float rim = pow(1.0 - NdotV, 3.0);
    float dayFactor = smoothstep(-0.25, 0.35, NdotLgeo);
    vec3 scatter = uAtmColor * rim * dayFactor * uAtmDensity * 0.45;
    float sunset = smoothstep(0.35, -0.05, NdotLgeo) * smoothstep(-0.35, 0.0, NdotLgeo);
    scatter += uSunsetColor * sunset * rim * uAtmDensity * 0.4;
    // mild haze across the disc on the day side (stronger toward the limb)
    float haze = uAtmDensity * 0.12 * (1.0 - NdotV * 0.7) * dayFactor;
    color = mix(color, color * 0.9 + uAtmColor * 0.08, haze);
    color += scatter * shadowAt(P, L) * uSunColor;
  }

  // An opaque haze deck (Titan's tholins, Venus' sulphuric clouds): the ground is a faint
  // suggestion under a smooth, forward-scattering veil that is brightest where the sun is high
  if (uHaze > 0.0) {
    float veilLit = fillLitV(smoothstep(-0.25, 0.6, NdotLgeo) * shadow, NdotV);
    float limb = 0.75 + 0.25 * pow(NdotV, 0.4);
    vec3 veil = uAtmColor * veilLit * limb * sunlight;
    // a little structure: bands and swirls stretched along the flow
    float lat = asin(clamp(p.y, -1.0, 1.0));
    float band = snoise(vec3(p.x * 2.0, lat * 14.0 + fbm(p * 3.0 + uSeed, 2) * 2.0, uSeed)) * 0.05;
    veil *= 1.0 + band;
    color = mix(color, veil, uHaze * (0.8 + 0.12 * (1.0 - NdotV)));
  }

  // City lights on the night side
  if (uCityLights > 0.0 && !ocean) {
    float night = smoothstep(0.08, -0.12, NdotLgeo);
    float towns = smoothstep(0.55, 0.95, fbm(p * 18.0 + uSeed * 5.3, 4) * 0.5 + 0.5);
    towns *= smoothstep(0.45, 0.8, fbm(p * 5.0 + uSeed * 0.9, 3) * 0.5 + 0.5);
    // fewer lights at high latitudes / altitudes
    towns *= 1.0 - smoothstep(0.75, 0.92, abs(p.y));
    towns *= 1.0 - smoothstep(0.75, 0.9, height);
    color += vec3(1.0, 0.82, 0.55) * towns * night * 0.9 * uCityLights;
  }

  if (lavaGlow > 0.0) {
    color += vec3(1.0, 0.35, 0.05) * lavaGlow * (0.6 + 0.4 * sin(uTime * 0.7 + height * 40.0));
  }

  gl_FragColor = vec4(color * uAlpha, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
