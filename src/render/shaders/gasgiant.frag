#include <logdepthbuf_pars_fragment>

uniform float uSeed;
uniform float uTime;
uniform vec3 uBands[6];
uniform int uBandCount;
uniform float uBandFreq;
uniform float uTurbulence;
uniform vec4 uStorm;        // lat(rad), lon(rad), size, enabled
uniform vec3 uStormColor;
uniform vec3 uAtmColor;
uniform float uAtmDensity;

varying vec3 vObjPos;
varying vec3 vWorldPos;
varying vec3 vWorldNormal;

vec3 bandColor(float k) {
  float n = float(uBandCount);
  float kk = mod(k, n);
  int i0 = int(floor(kk));
  int i1 = int(mod(floor(kk) + 1.0, n));
  float f = smoothstep(0.15, 0.85, fract(kk));
  vec3 c0 = uBands[0], c1 = uBands[0];
  for (int i = 0; i < 6; i++) {
    if (i == i0) c0 = uBands[i];
    if (i == i1) c1 = uBands[i];
  }
  return mix(c0, c1, f);
}

void main() {
  #include <logdepthbuf_fragment>

  vec3 p = normalize(vObjPos);
  float lat = asin(clamp(p.y, -1.0, 1.0));
  float lon = atan(p.z, p.x);

  // Zonal flow: shear increases with latitude; time-animated drift
  float drift = uTime * 0.02 * (0.5 + cos(lat * 3.0));
  vec3 q = vec3(p.x, p.y * 4.0, p.z);
  float warp = fbm(q * 1.5 + uSeed + vec3(drift, 0.0, 0.0), 4) * uTurbulence;
  float swirl = fbm(vec3(lon * 2.0 + drift * 3.0, lat * 12.0, uSeed), 3) * uTurbulence * 0.35;

  float k = (p.y * 0.5 + 0.5) * uBandFreq + warp * 0.9 + swirl;
  vec3 albedo = bandColor(k);

  // Fine streaks stretched along longitude
  float streak = snoise(vec3(lon * 2.0 + drift * 2.0, lat * 60.0 + warp * 6.0, uSeed * 3.0)) * 0.09
               + snoise(vec3(lon * 6.0 + drift * 4.0, lat * 180.0 + warp * 14.0, uSeed * 5.0)) * 0.03;
  albedo *= 1.0 + streak;
  // Contrast & saturation so the palette doesn't wash out under tone mapping
  float lum = dot(albedo, vec3(0.299, 0.587, 0.114));
  albedo = mix(vec3(lum), albedo, 1.45);
  albedo = pow(max(albedo, 0.0), vec3(1.25));

  // Storm (Great Red Spot / Great Dark Spot)
  if (uStorm.w > 0.5) {
    float stormLon = uStorm.y + uTime * 0.004;
    float dLon = mod(lon - stormLon + 3.14159265, 6.2831853) - 3.14159265;
    float dLat = lat - uStorm.x;
    vec2 d = vec2(dLon * cos(uStorm.x) / 1.7, dLat) / uStorm.z;
    float r = length(d);
    float angle = atan(d.y, d.x);
    float spiral = fbm(vec3(r * 4.0 - uTime * 0.05, angle * 1.5, uSeed * 9.0), 3);
    float mask = smoothstep(1.15, 0.7, r + spiral * 0.25);
    vec3 stormCol = uStormColor * (0.85 + 0.3 * spiral);
    // darker collar around the storm, brighter eye
    stormCol *= 0.8 + 0.35 * smoothstep(0.8, 0.2, r);
    albedo = mix(albedo, stormCol, mask * 0.95);
    // turbulent wake
    float wake = smoothstep(2.4, 1.0, r) * (1.0 - mask) * smoothstep(0.0, 0.5, abs(spiral));
    albedo = mix(albedo, albedo * 0.85 + stormCol * 0.15, wake * 0.6);
  }

  // Lighting
  vec3 P = vWorldPos;
  vec3 N = normalize(vWorldNormal);
  vec3 L = normalize(uSunPos - P);
  vec3 V = normalize(-P);
  float NdotL = dot(N, L);
  float shadow = shadowAt(P, L);
  float terminator = smoothstep(-0.05, 0.25, NdotL);
  float diffuse = max(NdotL, 0.0);
  // limb darkening typical for thick atmospheres
  float NdotV = max(dot(N, V), 0.0);
  float limb = 0.5 + 0.5 * pow(NdotV, 0.45);

  vec3 color = albedo * fillLit(diffuse * terminator * shadow) * limb;
  color += albedo * 0.002;

  // Rim haze
  float rim = pow(1.0 - NdotV, 4.0);
  float dayFactor = smoothstep(-0.2, 0.3, NdotL);
  color += uAtmColor * rim * dayFactor * uAtmDensity * 0.35 * shadow;
  color *= uSunColor;

  gl_FragColor = vec4(color * uAlpha, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
