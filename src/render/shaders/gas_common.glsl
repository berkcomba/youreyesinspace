// ---------------------------------------------------------------------------
// Gas / ice giant cloud deck in the body-fixed frame: belts and zones of uneven width, eddies
// that gather at the shear between them, festoons across the equatorial zone, white ovals,
// mottled poles, the great storm and Saturn's hexagon. Shared by the surface shader (fallback)
// and the bake (bake_gas.frag); the run-time motion is applied to the direction before lookup.
// ---------------------------------------------------------------------------
uniform float uSeed;
uniform vec3 uBands[6];
uniform int uBandCount;
uniform float uBandFreq;
uniform float uTurbulence;
uniform vec4 uStorm;        // lat(rad), lon(rad), size, enabled
uniform vec3 uStormColor;
uniform float uHexagon;

vec3 bandColor(float k) {
  float n = float(uBandCount);
  float kk = mod(k, n);
  int i0 = int(floor(kk));
  int i1 = int(mod(floor(kk) + 1.0, n));
  float f = smoothstep(0.38, 0.62, fract(kk));
  vec3 c0 = uBands[0], c1 = uBands[0];
  for (int i = 0; i < 6; i++) {
    if (i == i0) c0 = uBands[i];
    if (i == i1) c1 = uBands[i];
  }
  return mix(c0, c1, f);
}

// mean and brightest of the palette
void paletteStats(out vec3 mean, out vec3 bright) {
  mean = vec3(0.0);
  bright = uBands[0];
  float bl = -1.0;
  for (int i = 0; i < 6; i++) {
    if (i >= uBandCount) break;
    mean += uBands[i];
    float l = dot(uBands[i], vec3(0.299, 0.587, 0.114));
    if (l > bl) { bl = l; bright = uBands[i]; }
  }
  mean /= float(uBandCount);
}

/** Cloud colour at unit direction p; `height` is the cloud-top relief (0 … 1) for the shading. */
vec3 gasAlbedo(vec3 p, out float height) {
  float lat = asin(clamp(p.y, -1.0, 1.0));
  float lon = atan(p.z, p.x);
  float t = lat / 1.5707963;
  // band coordinate: widths vary (a slow 1-D warp of latitude), the equatorial zone is the widest
  float tw = t + 0.10 * snoise(vec3(t * 2.5 + 3.0, uSeed * 0.13, 1.0)) + 0.045 * snoise(vec3(t * 6.0, uSeed * 0.29, 5.0));
  float te = sign(tw) * pow(abs(tw), 1.25);
  float k0 = (te * 0.5 + 0.5) * uBandFreq;
  float fk = fract(k0);
  // 1 at the boundary between two bands, 0 in their middle
  float bnd = 1.0 - smoothstep(0.0, 0.2, min(fk, 1.0 - fk));

  // turbulence: broad eddies everywhere, small ones mostly along the shear lines
  vec3 q = vec3(p.x, p.y * 3.0, p.z);
  float warpL = fbm(q * 2.0 + uSeed, 4);
  float warpS = fbm(vec3(lon * 5.0 + warpL * 1.5, lat * 28.0 + warpL * 2.0, uSeed * 2.0 + 3.0), 4);
  float warp = (warpL * 0.13 + warpS * 0.42 * (0.2 + 0.8 * bnd)) * uTurbulence;
  float k = k0 + warp;
  vec3 albedo = bandColor(k);
  // belts differ in brightness along latitude; a thin darker lane marks the shear between two bands
  albedo *= 1.0 + 0.08 * snoise(vec3(floor(k) * 1.7, uSeed, 2.0));
  float lane = exp(-pow(min(fract(k), 1.0 - fract(k)) / 0.05, 2.0));
  albedo *= 1.0 - 0.12 * lane * uTurbulence;
  // thin lanes of uneven tone inside each band, and eddies curling along the shear lines
  float lanes = snoise(vec3(k * 4.0 + warpS * 0.6, uSeed * 0.7, 4.0)) * 0.5 + snoise(vec3(k * 9.0 + warpS * 1.2, uSeed * 0.9, 6.0)) * 0.3;
  float eddy = fbm(vec3(lon * 9.0, lat * 60.0 + warpL * 3.0, uSeed * 4.0 + 1.0), 3);
  albedo *= 1.0 + (0.09 * lanes + 0.1 * eddy * bnd) * uTurbulence;

  vec3 mean, bright;
  paletteStats(mean, bright);

  // equatorial zone: bright, crossed by blue-grey festoons
  float ez = 1.0 - smoothstep(0.07, 0.2, abs(te));
  albedo = mix(albedo, bright * 1.04, ez * 0.55);
  float fest = smoothstep(0.55, 0.85, snoise(vec3(lon * 7.0 + lat * 30.0, lat * 45.0 + warpL * 3.0, uSeed + 9.0))) * ez * uTurbulence;
  albedo = mix(albedo, albedo * vec3(0.62, 0.66, 0.74), fest * 0.7);

  // white ovals: anticyclones strung along the mid-latitude bands
  float spotRelief = 0.0;
  if (uTurbulence > 0.4) {
    float bandIdx = floor(k0);
    float nSpots = 5.0;
    float u = (lon / 6.2831853 + 0.5) * nSpots + hash13(vec3(bandIdx, uSeed, 1.0)) * 7.0;
    vec3 hh = hash33(vec3(floor(u), bandIdx, uSeed));
    float present = step(hh.z, 0.11 * uTurbulence) * smoothstep(0.22, 0.3, abs(te)) * (1.0 - smoothstep(0.62, 0.72, abs(te)));
    if (present > 0.0) {
      float dx = (fract(u) - 0.5) * (6.2831853 / nSpots) * cos(lat);
      float dy = (fk - 0.5) * (3.1415927 / uBandFreq);
      float r = length(vec2(dx / (0.03 + 0.025 * hh.x), dy / (0.016 + 0.01 * hh.y)));
      float spot = smoothstep(1.0, 0.65, r);
      float collar = smoothstep(1.6, 1.0, r) * (1.0 - spot);
      albedo = mix(albedo, mix(bright, vec3(0.96, 0.94, 0.9), 0.5), spot * 0.7 * present);
      albedo *= 1.0 - collar * 0.18 * present;
      spotRelief = spot * present;
    }
  }

  // poles: mottled, greyer; the quiet ice giants wear a bright hood instead
  float pol = smoothstep(0.7, 0.9, abs(te));
  float mott = fbm(p * 9.0 + uSeed * 1.3, 3);
  vec3 polarCol = mix(mix(mean, vec3(0.55, 0.57, 0.62), 0.45) * (1.0 + 0.2 * mott), bright * (1.06 + 0.05 * mott), 1.0 - smoothstep(0.2, 0.6, uTurbulence));
  albedo = mix(albedo, polarCol, pol * 0.85);

  // fine streaks stretched along the flow, mostly inside the belts
  float streak = snoise(vec3(lon * 2.0, lat * 70.0 + warpL * 6.0, uSeed * 3.0)) * 0.07
               + snoise(vec3(lon * 6.0, lat * 200.0 + warpS * 10.0, uSeed * 5.0)) * 0.03;
  albedo *= 1.0 + streak * (0.6 + 0.4 * (1.0 - bnd)) * (1.0 - pol * 0.5);

  // overall contrast follows the activity: the ice giants are nearly featureless
  float con = clamp(0.35 + uTurbulence * 0.8, 0.35, 1.0);
  albedo = mix(mean, albedo, con);
  float lum = dot(albedo, vec3(0.299, 0.587, 0.114));
  albedo = mix(vec3(lum), albedo, 1.3);
  albedo = pow(max(albedo, 0.0), vec3(1.15));

  // Storm (Great Red Spot / Great Dark Spot)
  float stormRelief = 0.0;
  if (uStorm.w > 0.5) {
    float dLon = mod(lon - uStorm.y + 3.14159265, 6.2831853) - 3.14159265;
    float dLat = lat - uStorm.x;
    vec2 d = vec2(dLon * cos(uStorm.x) / 1.7, dLat) / uStorm.z;
    float r = length(d);
    float angle = atan(d.y, d.x);
    float spiral = fbm(vec3(r * 4.0, angle * 1.5, uSeed * 9.0), 3);
    float mask = smoothstep(1.15, 0.7, r + spiral * 0.25);
    // the Red Spot Hollow: the belt clears to a pale bay around the storm, without it the red
    // oval drowns in the dark South Equatorial Belt it borders
    float hollow = smoothstep(1.8, 1.05, r + spiral * 0.15) * (1.0 - mask) * step(0.6, uTurbulence);
    albedo = mix(albedo, mix(bright, mean, 0.3), hollow * 0.8);
    vec3 stormCol = uStormColor * (0.85 + 0.3 * spiral);
    // darker collar around the storm, brighter eye
    stormCol *= 0.8 + 0.35 * smoothstep(0.8, 0.2, r);
    albedo = mix(albedo, stormCol, mask * 0.95);
    // turbulent wake
    float wake = smoothstep(2.4, 1.0, r) * (1.0 - mask) * smoothstep(0.0, 0.5, abs(spiral));
    albedo = mix(albedo, albedo * 0.85 + stormCol * 0.15, wake * 0.6);
    stormRelief = mask;
  }

  // Saturn's north polar hexagon: a jet stream at 78° N that runs in six straight sides of about
  // 14 500 km, the air inside bluish-grey (Cassini, 2012–13) with its own concentric cloud
  // streets, and a dark-eyed vortex right on the pole. Fixed in the System III frame.
  if (uHexagon > 0.5 && p.y > 0.85) {
    float colat = acos(clamp(p.y, -1.0, 1.0));
    const float SEG = 1.0471976;
    float kk = mod(lon + 0.35, SEG) - SEG * 0.5;
    float meander = fbm(vec3(lon * 5.0, colat * 30.0, uSeed + 7.0), 3);
    float edge = 0.208 / mix(cos(kk), 0.93, smoothstep(0.3, 0.52, abs(kk)) * 0.5);
    float dEdge = colat + meander * 0.006 - edge;
    float inside = smoothstep(0.014, -0.014, dEdge);
    float shape = mix(colat, colat * cos(kk) / 0.866, smoothstep(0.06, 0.2, colat));
    float wv = fbm(vec3(p.xz * 22.0, uSeed + 11.0), 3);
    float streets = 0.5 + 0.5 * sin(shape * 150.0 + wv * 5.0);
    albedo *= mix(vec3(1.0), vec3(0.80, 0.86, 0.90) * (0.88 + 0.2 * streets + 0.1 * wv), inside * 0.85);
    float lane = snoise(vec3(dEdge * 320.0, lon * 5.0, uSeed + 13.0));
    float jet = exp(-pow(dEdge / 0.013, 2.0));
    float rimCloud = exp(-pow((dEdge - 0.024) / 0.011, 2.0));
    albedo *= 1.0 - jet * (0.24 + 0.1 * lane);
    albedo = mix(albedo, vec3(0.84, 0.78, 0.64), rimCloud * (0.22 + 0.08 * lane));
    float vr = colat / 0.035;
    float arms = snoise(vec3(lon * 2.0 + log(max(vr, 0.05)) * 5.0, vr * 2.5, uSeed + 5.0));
    albedo *= mix(1.0, 0.8 + 0.14 * arms, smoothstep(3.0, 1.0, vr));
    albedo = mix(albedo, vec3(0.80, 0.74, 0.62), exp(-pow((vr - 0.85) / 0.25, 2.0)) * 0.45);
    albedo = mix(albedo, albedo * 0.3, smoothstep(0.55, 0.25, vr));
  }

  // cloud-top relief: zones ride higher than belts, the eddies and ovals bulge
  height = 0.5 + 0.12 * cos(k * 6.2831853) + 0.1 * warpL + 0.08 * warpS * (0.3 + 0.7 * bnd) + 0.12 * spotRelief + 0.1 * stormRelief;
  return albedo;
}
