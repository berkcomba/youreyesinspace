#include <logdepthbuf_pars_fragment>

uniform float uSeed;
uniform float uTime;       // simulation time (hours) — slow evolution: spot drift
uniform float uRealTime;   // wall-clock seconds — granulation boils even when the clock is paused
uniform float uTemperature;
uniform float uIntensity;

varying vec3 vObjPos;
varying vec3 vWorldPos;
varying vec3 vWorldNormal;

// Animated 3-D Worley (cellular) noise. Cell centres wander inside their cell with
// per-cell phase and speed, so the lattice deforms continuously and seamlessly.
// Returns (F1, F2, id-hash of the nearest cell).
vec3 cellsAt(vec3 p, float t) {
  vec3 ip = floor(p);
  vec3 fp = fract(p);
  float f1 = 8.0, f2 = 8.0, id = 0.0;
  for (int z = -1; z <= 1; z++)
  for (int y = -1; y <= 1; y++)
  for (int x = -1; x <= 1; x++) {
    vec3 g = vec3(float(x), float(y), float(z));
    vec3 h = hash33(ip + g);
    float spd = 0.25 + 0.35 * hash13(ip + g + 7.1);
    vec3 o = 0.5 + 0.38 * sin(6.2831853 * h + t * spd * vec3(1.0, 1.31, 0.83));
    vec3 r = g + o - fp;
    float d = dot(r, r);
    if (d < f1) { f2 = f1; f1 = d; id = h.x; }
    else if (d < f2) { f2 = d; }
  }
  return vec3(sqrt(f1), sqrt(f2), id);
}

// one granulation layer at frequency k: bright convective cells, dark intergranular lanes
// returns (brightness 0..~1.2, lane mask 0..1)
vec2 granuleLayer(vec3 p, float k, float t, float seed, float laneWidth, float laneDepth) {
  vec3 c = cellsAt(p * k + seed, t);
  float lane = 1.0 - smoothstep(0.0, laneWidth, c.y - c.x);    // 1 in the dark lanes
  float dome = 1.0 - smoothstep(0.0, 0.85, c.x);               // bright centre, dim toward the edge
  float flicker = 0.88 + 0.24 * sin(6.2831853 * c.z + t * (0.6 + 0.8 * c.z));
  float b = (0.65 + 0.35 * dome) * flicker;
  b *= 1.0 - laneDepth * lane;
  return vec2(b, lane);
}

void main() {
  #include <logdepthbuf_fragment>

  vec3 p = normalize(vObjPos);
  vec3 N = normalize(vWorldNormal);
  vec3 V = normalize(-vWorldPos);
  float mu = max(dot(N, V), 0.0);
  float T = uTemperature;

  // How much of the object sphere one pixel covers — used to fade sub-pixel detail out
  float aa = length(fwidth(p));
  float tR = uRealTime;

  // --- Supergranulation / large-scale brightness, slowly flowing ---------------------
  vec3 flow = 0.6 * vec3(cos(tR * 0.021), sin(tR * 0.017), cos(tR * 0.013 + 1.7));
  float superG = fbm(p * 5.0 + uSeed + flow, 3);
  // domain-warped mid-scale: makes the cells cluster into irregular patches
  vec3 warp = vec3(fbm(p * 3.0 + uSeed * 1.3 + flow.yzx, 2), fbm(p * 3.0 - uSeed + flow.zxy, 2), fbm(p * 3.0 + 4.2 + flow, 2));
  vec3 pw = p + 0.08 * warp;

  // --- Granulation: three cellular octaves, each faded out as it becomes sub-pixel -------
  float gran = 0.0, lanes = 0.0, wsum = 0.0;
  float w1 = 1.0 - smoothstep(0.25, 0.65, aa * 18.0);
  float w2 = 1.0 - smoothstep(0.25, 0.65, aa * 60.0);
  float w3 = 1.0 - smoothstep(0.25, 0.65, aa * 200.0);
  // the coarse layer is soft (it only hints at structure from afar); the fine ones carry the crisp lanes
  if (w1 > 0.001) { vec2 g = granuleLayer(pw, 18.0, tR * 0.45, uSeed, 0.36, 0.35);        gran += w1 * 0.70 * g.x; lanes += w1 * 0.5 * g.y; wsum += w1 * 0.70; }
  if (w2 > 0.001) { vec2 g = granuleLayer(pw, 60.0, tR * 0.7, uSeed + 3.7, 0.34, 0.55);   gran += w2 * 1.00 * g.x; lanes += w2 * g.y; wsum += w2 * 1.00; }
  if (w3 > 0.001) { vec2 g = granuleLayer(pw, 200.0, tR * 1.0, uSeed - 5.1, 0.3, 0.6);   gran += w3 * 0.60 * g.x; lanes += w3 * g.y; wsum += w3 * 0.60; }
  gran = wsum > 0.001 ? gran / wsum : 0.8;
  lanes = wsum > 0.001 ? lanes / max(w1 + w2 + w3, 1e-3) : 0.0;
  // when every layer is sub-pixel, fall back to a smooth fbm so distant stars do not sparkle
  float far = 1.0 - clamp(wsum, 0.0, 1.0);
  gran = mix(gran, 0.8 + 0.15 * superG, far);

  // hot (radiative-envelope) stars show far less surface structure
  float contrast = mix(1.0, 0.3, smoothstep(7000.0, 12000.0, T));
  float surf = 0.9 + contrast * (0.9 * (gran - 0.8) + 0.14 * superG);
  surf = clamp(surf, 0.2, 1.3);

  // --- Starspots: umbra + filamentary penumbra, confined to two activity belts -----------
  float lat = asin(clamp(p.y, -1.0, 1.0));
  float belt = exp(-pow((abs(lat) - 0.33) / 0.22, 2.0));
  float tS = uTime * 0.0015;
  float spotField = fbm(p * 4.0 + uSeed * 3.0 + vec3(tS, -tS * 0.6, tS * 0.3), 3) * 0.5 + 0.5;
  // seed-dependent activity level, cool dwarfs spottier than the Sun
  float activity = 0.25 + 0.5 * fract(uSeed * 0.731) + 0.25 * smoothstep(5500.0, 3200.0, T);
  float thr = mix(0.86, 0.70, activity);
  float sf = spotField * mix(0.6, 1.0, belt);
  float umbra = smoothstep(thr + 0.04, thr + 0.10, sf);
  float penumbra = smoothstep(thr - 0.05, thr + 0.05, sf) - umbra;
  // radial filaments in the penumbra
  float fil = 0.5 + 0.5 * snoise(p * 90.0 + uSeed + vec3(tR * 0.05));
  surf *= 1.0 - umbra * 0.92;
  surf *= 1.0 - penumbra * (0.35 + 0.3 * fil);

  // --- Limb darkening, stronger for cool stars, with a reddening toward the limb ----------
  // (exaggerated relative to the Eddington law so the edge reads as a glowing orange rim
  //  even after the tone curve compresses the contrast)
  float hotStar = smoothstep(3000.0, 12000.0, T);
  float limb = mix(mix(0.1, 0.45, hotStar), 1.0, pow(mu, mix(1.5, 0.75, hotStar)));

  // --- Colour ------------------------------------------------------------------------
  // Stylised photosphere colour: the blackbody hue, deepened so the disc still reads as
  // golden / orange / blue-white after ACES and bloom have pulled the highlights toward white.
  vec3 bb = blackbody(T);
  float k = mix(8.0, 3.0, smoothstep(5200.0, 3000.0, T));   // cool stars are saturated already
  k = mix(k, 2.5, smoothstep(7500.0, 14000.0, T));          // hot stars: keep the blue, lightly
  vec3 sat = pow(bb, vec3(k));
  sat.b *= mix(0.5, 1.0, smoothstep(6500.0, 9000.0, T));    // golden rather than tan for G/K stars
  sat /= max(max(sat.r, sat.g), max(sat.b, 1e-3));
  float whiten = mix(0.35, 0.12, smoothstep(5000.0, 3200.0, T));   // red dwarfs stay deep orange
  vec3 hot = mix(sat, vec3(1.0), whiten) * 1.45;             // cell centres: brighter and whiter
  vec3 color = mix(sat * 0.25, hot, surf);
  // intergranular lanes and spots are cooler → slightly redder
  vec3 cool = mix(vec3(1.0), vec3(1.0, 0.72, 0.48), smoothstep(12000.0, 3500.0, T) * 0.8);
  color *= mix(vec3(1.0), cool, clamp(lanes * 0.5 + umbra + penumbra * 0.6, 0.0, 1.0));
  color *= limb * mix(vec3(1.0), cool * vec3(1.0, 0.85, 0.7), pow(1.0 - mu, 1.3) * 0.9);

  // faculae: bright lanes seen near the limb (the classic solar limb brightening of plage)
  float faculae = lanes * pow(1.0 - mu, 2.0) * (1.0 - umbra) * 0.7 * contrast;
  color += hot * faculae;

  // saturation boost against the tone mapper
  float lum = dot(color, vec3(0.299, 0.587, 0.114));
  color = max(mix(vec3(lum), color, 1.25), 0.0);

  color *= uIntensity * mix(0.9, 1.5, smoothstep(3000.0, 12000.0, T));

  gl_FragColor = vec4(color, 1.0);
  #include <tonemapping_fragment>
  // ACES pulls bright surfaces toward white; restore the hue after the curve
  float lumT = dot(gl_FragColor.rgb, vec3(0.299, 0.587, 0.114));
  gl_FragColor.rgb = clamp(mix(vec3(lumT), gl_FragColor.rgb, 1.3), 0.0, 1.0);
  #include <colorspace_fragment>
}
