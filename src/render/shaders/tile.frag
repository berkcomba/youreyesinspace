#include <logdepthbuf_pars_fragment>

// Surface imagery tile (Blue Marble / LRO / Viking ...). Lighting mirrors terrestrial.frag so
// the switch from the procedural globe is seamless.
uniform sampler2D uDay;
uniform vec3 uDayMap;        // xy = uv offset, z = uv scale into the (ancestor) day tile
uniform sampler2D uNight;
uniform vec3 uNightMap;
uniform float uHasNight;
uniform float uOceanSpec;
uniform vec3 uAtmColor;
uniform float uAtmDensity;
uniform vec3 uSunsetColor;
uniform vec4 uCloud;   // coverage, opacity, seed, height/R of the cloud deck (opacity 0 = none)
uniform float uTime;
uniform mat4 modelMatrix;

varying vec3 vWorldPos;
varying vec3 vWorldNormal;
varying vec2 vUv;

void main() {
  #include <logdepthbuf_fragment>

  vec2 uvDay = uDayMap.xy + vUv * uDayMap.z;
  vec3 albedo = texture2D(uDay, uvDay).rgb;   // sRGB texture → sampled linear by the GPU

  // Mild contrast/saturation compensation for the ACES tone mapper (as the procedural globe)
  {
    float lum = dot(albedo, vec3(0.299, 0.587, 0.114));
    albedo = mix(vec3(lum), albedo, 1.2);
    albedo = pow(max(albedo, 0.0), vec3(1.08));
  }

  vec3 Ngeo = normalize(vWorldNormal);
  vec3 P = vWorldPos;
  vec3 L = normalize(uSunPos - P);
  vec3 V = normalize(-P);
  float NdotLgeo = dot(Ngeo, L);
  float eclipse = shadowAt(P, L);
  float shadow = eclipse;
  // cloud shadows of the procedural deck above the imagery
  vec3 Lobj = normalize(transpose(mat3(modelMatrix)) * L);
  vec3 pObj = normalize(transpose(mat3(modelMatrix)) * Ngeo);
  shadow *= cloudShadow(pObj, Lobj, uTime, uCloud);
  float terminator = smoothstep(-0.08, 0.15, NdotLgeo);
  float NdotV = max(dot(Ngeo, V), 0.0);
  float diffuse = fillLitV(max(NdotLgeo, 0.0) * terminator * shadow, NdotV);

  // low sun through a thick atmosphere arrives reddened
  float lowSun = smoothstep(0.35, -0.05, NdotLgeo) * clamp(uAtmDensity, 0.0, 1.0);
  vec3 warm = uSunsetColor / max(max(uSunsetColor.r, uSunsetColor.g), max(uSunsetColor.b, 1e-3));
  vec3 sunlight = uSunColor * mix(vec3(1.0), warm, lowSun * 0.85);

  vec3 color = albedo * diffuse * sunlight;

  // Water: Blue Marble oceans are very dark and blue-dominant; lift them toward a deep sea blue,
  // add a Fresnel-weighted sun glint and the reflected sky
  if (uOceanSpec > 0.0) {
    float lum = dot(albedo, vec3(0.299, 0.587, 0.114));
    float water = smoothstep(0.01, 0.08, albedo.b - albedo.r) * (1.0 - smoothstep(0.12, 0.3, lum));
    albedo = mix(albedo, vec3(0.025, 0.09, 0.24), water * 0.55);
    color = albedo * diffuse * sunlight;
    vec3 H = normalize(L + V);
    float ndh = max(dot(Ngeo, H), 0.0);
    float fres = 0.03 + 0.97 * pow(1.0 - NdotV, 5.0);
    float spec = pow(ndh, 420.0) * 0.55 + pow(ndh, 48.0) * 0.1 + pow(ndh, 6.0) * 0.012;
    color += vec3(1.0, 0.97, 0.9) * sunlight * spec * mix(0.5, 2.5, fres) * terminator * shadow * water * uOceanSpec;
    float dayF = smoothstep(-0.2, 0.3, NdotLgeo);
    color += uAtmColor * fres * dayF * uAtmDensity * 0.35 * uSunColor * water;
  }

  // Wrap-around ambient (starlight / planetshine)
  color += albedo * 0.0025;

  // Atmosphere on the surface: rim scattering + sunset tint near the terminator
  if (uAtmDensity > 0.0) {
    float NdotV = max(dot(Ngeo, V), 0.0);
    float rim = pow(1.0 - NdotV, 3.0);
    float dayFactor = smoothstep(-0.25, 0.35, NdotLgeo);
    vec3 scatter = uAtmColor * rim * dayFactor * uAtmDensity * 0.45;
    float sunset = smoothstep(0.35, -0.05, NdotLgeo) * smoothstep(-0.35, 0.0, NdotLgeo);
    scatter += uSunsetColor * sunset * rim * uAtmDensity * 0.4;
    float haze = uAtmDensity * 0.12 * (1.0 - NdotV * 0.7) * dayFactor;
    color = mix(color, color * 0.9 + uAtmColor * 0.08, haze);
    color += scatter * eclipse * uSunColor;
  }

  // Night lights
  if (uHasNight > 0.0) {
    vec2 uvNight = uNightMap.xy + vUv * uNightMap.z;
    vec3 lights = texture2D(uNight, uvNight).rgb;
    float night = smoothstep(0.1, -0.1, NdotLgeo);
    color += lights * vec3(1.0, 0.9, 0.72) * night * 1.1;
  }

  gl_FragColor = vec4(color * uAlpha, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
