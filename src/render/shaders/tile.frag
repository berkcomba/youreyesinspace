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
  float shadow = shadowAt(P, L);
  float terminator = smoothstep(-0.08, 0.15, NdotLgeo);
  float diffuse = fillLit(max(NdotLgeo, 0.0) * terminator * shadow);

  vec3 color = albedo * diffuse * uSunColor;

  // Water: Blue Marble oceans are very dark and blue-dominant; lift them toward a deep sea blue
  // and add sun glint
  if (uOceanSpec > 0.0) {
    float lum = dot(albedo, vec3(0.299, 0.587, 0.114));
    float water = smoothstep(0.01, 0.08, albedo.b - albedo.r) * (1.0 - smoothstep(0.12, 0.3, lum));
    albedo = mix(albedo, vec3(0.025, 0.09, 0.24), water * 0.55);
    color = albedo * diffuse * uSunColor;
    vec3 H = normalize(L + V);
    float spec = pow(max(dot(Ngeo, H), 0.0), 260.0) * 0.45 + pow(max(dot(Ngeo, H), 0.0), 24.0) * 0.05;
    color += vec3(1.0, 0.98, 0.9) * uSunColor * spec * terminator * shadow * water * uOceanSpec;
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
    color += scatter * shadow * uSunColor;
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
