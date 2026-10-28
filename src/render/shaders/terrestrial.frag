#include <logdepthbuf_pars_fragment>

uniform mat4 modelMatrix;
uniform float uTime;
uniform float uCityLights;
uniform float uIrregular;
uniform vec3 uAtmColor;
uniform float uAtmDensity;
uniform vec3 uSunsetColor;
uniform vec4 uCloud;   // coverage, opacity, seed, height/R of the cloud deck (opacity 0 = none)

varying vec3 vObjPos;
varying vec3 vWorldPos;
varying vec3 vWorldNormal;

// heightAt / terrestrialAlbedo and the palette uniforms: terrestrial_common.glsl

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
  float lavaGlow;
  vec3 albedo = terrestrialAlbedo(p, h, ocean, lavaGlow);

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
  float terminator = smoothstep(-0.08, 0.15, NdotLgeo);
  float NdotV = max(dot(Ngeo, V), 0.0);
  float diffuse = fillLitV(max(NdotL, 0.0) * terminator * shadow, NdotV);

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
    float NdotV = max(dot(Ngeo, V), 0.0);
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
