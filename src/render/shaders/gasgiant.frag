#include <logdepthbuf_pars_fragment>

uniform mat4 modelMatrix;
uniform float uSeed;
uniform float uTime;
uniform vec3 uBands[6];
uniform int uBandCount;
uniform float uBandFreq;
uniform float uTurbulence;
uniform vec4 uStorm;        // lat(rad), lon(rad), size, enabled
uniform vec3 uStormColor;
uniform float uHexagon;
uniform vec3 uAtmColor;
uniform float uAtmDensity;

varying vec3 vObjPos;
varying vec3 vWorldPos;
varying vec3 vWorldNormal;

// Cloud-top relief: the large flow pattern plus the eddies, as a height field (2 octaves each)
float gasHeight(vec3 p, float seed, float drift, float turb) {
  float lat = asin(clamp(p.y, -1.0, 1.0));
  float lon = atan(p.z, p.x);
  vec3 q = vec3(p.x, p.y * 4.0, p.z);
  return fbm(q * 1.5 + seed + vec3(drift, 0.0, 0.0), 2) * 0.6 + fbm(vec3(lon * 7.0 + drift * 2.5, lat * 36.0, seed * 2.0 + 3.0), 2) * 0.4 * turb;
}

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

  // Zonal flow: shear increases with latitude; time-animated drift. The clock is wrapped (~1.9 yr):
  // decades of hours pushed the noise coordinates past float precision and the bands broke into speckle
  float drift = mod(uTime, 16384.0) * 0.02 * (0.5 + cos(lat * 3.0));
  vec3 q = vec3(p.x, p.y * 4.0, p.z);
  float warp = fbm(q * 1.5 + uSeed + vec3(drift, 0.0, 0.0), 4) * uTurbulence;
  float swirl = fbm(vec3(lon * 2.0 + drift * 3.0, lat * 12.0, uSeed), 3) * uTurbulence * 0.35;

  // eddies and festoons between the bands, only where they are resolved
  float aa = length(fwidth(p));
  float fine = 1.0 - smoothstep(0.002, 0.008, aa);
  float eddy = fine > 0.001 ? fbm(vec3(lon * 7.0 + drift * 2.5 + warp * 2.5, lat * 36.0 + warp * 7.0, uSeed * 2.0 + 3.0), 3) * uTurbulence * 0.5 * fine : 0.0;
  float k = (p.y * 0.5 + 0.5) * uBandFreq + warp * 0.9 + swirl + eddy;
  vec3 albedo = bandColor(k);

  // Fine streaks stretched along longitude
  float streak = snoise(vec3(lon * 2.0 + drift * 2.0, lat * 60.0 + warp * 6.0, uSeed * 3.0)) * 0.09
               + snoise(vec3(lon * 6.0 + drift * 4.0, lat * 180.0 + warp * 14.0, uSeed * 5.0)) * mix(0.03, 0.012, fine);
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

  // Saturn's north polar hexagon: a jet stream at 78° N that runs in six straight sides of about
  // 14 500 km, the air inside bluish-grey (Cassini, 2012–13) with its own concentric cloud
  // streets, and a dark-eyed vortex right on the pole. Fixed in the System III frame.
  if (uHexagon > 0.5 && p.y > 0.85) {
    float colat = acos(clamp(p.y, -1.0, 1.0));
    const float SEG = 1.0471976;
    float k = mod(lon + 0.35, SEG) - SEG * 0.5;
    // the sides meander a little and the corners are rounded, as in the Cassini mosaics
    float meander = fbm(vec3(lon * 5.0, colat * 30.0, uSeed + 7.0), 3);
    float edge = 0.208 / mix(cos(k), 0.93, smoothstep(0.3, 0.52, abs(k)) * 0.5);
    float dEdge = colat + meander * 0.006 - edge;
    float inside = smoothstep(0.014, -0.014, dEdge);
    // concentric cloud streets inside: hexagonal near the rim, rounding off toward the pole,
    // modulating the zonal bands rather than replacing them
    float shape = mix(colat, colat * cos(k) / 0.866, smoothstep(0.06, 0.2, colat));
    float wv = fbm(vec3(p.xz * 22.0, uSeed + 11.0), 3);
    float streets = 0.5 + 0.5 * sin(shape * 150.0 + wv * 5.0);
    albedo *= mix(vec3(1.0), vec3(0.80, 0.86, 0.90) * (0.88 + 0.2 * streets + 0.1 * wv), inside * 0.85);
    // the jet: a darker lane streaked along the side, a brighter cloud band just outside it
    float lane = snoise(vec3(dEdge * 320.0, lon * 5.0, uSeed + 13.0));
    float jet = exp(-pow(dEdge / 0.013, 2.0));
    float rimCloud = exp(-pow((dEdge - 0.024) / 0.011, 2.0));
    albedo *= 1.0 - jet * (0.24 + 0.1 * lane);
    albedo = mix(albedo, vec3(0.84, 0.78, 0.64), rimCloud * (0.22 + 0.08 * lane));
    // polar vortex: spiral cloud arms round a bright eyewall and a dark eye ~2000 km across
    float vr = colat / 0.035;
    float arms = snoise(vec3(lon * 2.0 + log(max(vr, 0.05)) * 5.0, vr * 2.5, uSeed + 5.0));
    albedo *= mix(1.0, 0.8 + 0.14 * arms, smoothstep(3.0, 1.0, vr));
    albedo = mix(albedo, vec3(0.80, 0.74, 0.62), exp(-pow((vr - 0.85) / 0.25, 2.0)) * 0.45);
    albedo = mix(albedo, albedo * 0.3, smoothstep(0.55, 0.25, vr));
  }

  // Lighting
  vec3 P = vWorldPos;
  vec3 N = normalize(vWorldNormal);
  vec3 L = normalize(uSunPos - P);
  vec3 V = normalize(-P);
  // cloud-top relief: a height field sampled at three points (screen derivatives of noise are
  // too noisy for a normal), only where the disc is resolved
  if (fine > 0.001) {
    vec3 T = normalize(cross(abs(p.y) < 0.99 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0), p));
    vec3 B = cross(p, T);
    float eps = clamp(aa * 2.5, 0.003, 0.03);
    float h0 = gasHeight(p, uSeed, drift, uTurbulence);
    float hT = gasHeight(normalize(p + T * eps), uSeed, drift, uTurbulence);
    float hB = gasHeight(normalize(p + B * eps), uSeed, drift, uTurbulence);
    vec3 Tw = normalize(mat3(modelMatrix) * T);
    vec3 Bw = normalize(mat3(modelMatrix) * B);
    float bumpScale = 0.012 / eps * fine;
    N = normalize(N - (hT - h0) * bumpScale * Tw - (hB - h0) * bumpScale * Bw);
  }
  float NdotL = dot(N, L);
  float shadow = shadowAt(P, L);
  float terminator = smoothstep(-0.05, 0.25, NdotL);
  float diffuse = max(NdotL, 0.0);
  // limb darkening typical for thick atmospheres
  float NdotV = max(dot(N, V), 0.0);
  float limb = 0.5 + 0.5 * pow(NdotV, 0.45);

  vec3 color = albedo * fillLitV(diffuse * terminator * shadow, NdotV) * limb;
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
