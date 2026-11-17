#include <logdepthbuf_pars_fragment>

uniform float uTime;        // simulation hours (slow streamer rotation)
uniform float uRealTime;    // wall-clock seconds (shimmer, spicules, prominence motion)
uniform float uSeed;
uniform vec3 uColor;
uniform vec3 uRimColor;     // chromosphere / prominence tint (Hα pink for cool stars)
uniform float uProminence;  // 0..1 strength of the chromospheric rim and prominences
uniform float uIntensity;
uniform float uCoreRadius;  // fraction of quad half-size occupied by the star disc
uniform float uEUV;         // 0 visible light … 1 the extreme-ultraviolet view (SDO/AIA 304 Å)

varying vec2 vUv;

void main() {
  #include <logdepthbuf_fragment>

  vec2 c = vUv * 2.0 - 1.0;
  float r = length(c);
  if (r > 1.0) discard;
  // inside the silhouette the star itself stands in front (the log depth buffer writes depth here,
  // so the GPU cannot skip these fragments on its own)
  if (r < uCoreRadius * 0.995) discard;
  float ang = atan(c.y, c.x);
  float tR = uRealTime;
  // slow rigid rotation of the whole streamer pattern with the simulation clock
  float rot = uTime * 0.004 + uSeed;

  // normalised distance outside the photosphere: 0 at the limb, 1 at the quad edge
  float rr = max(r - uCoreRadius, 0.0) / max(1.0 - uCoreRadius, 1e-3);
  // distance in units of the star radius (how far out we are in stellar radii)
  float h = max(r - uCoreRadius, 0.0) / max(uCoreRadius, 1e-4);

  // --- Streamers: radial, slowly drifting, shimmering -----------------------------------
  vec3 drift = vec3(0.0, -tR * 0.012, tR * 0.004);
  float streaks  = fbm(vec3(ang * 3.0 + rot, rr * 6.0, 1.0) + drift, 4) * 0.5 + 0.5;
  float rays = pow(0.5 + 0.5 * snoise(vec3(ang * 22.0 + rot * 2.0, 2.0 + tR * 0.03, uSeed)), 3.0);
  rays *= smoothstep(0.0, 0.25, rr) * (1.0 - smoothstep(0.3, 1.0, rr));

  // --- Chromosphere: thin, ragged rim of spicules just above the limb ---------------------
  // spicule forest: fine angular noise, flickering upward motion
  float spic = h < 0.08 ? fbm(vec3(ang * 60.0 + rot, h * 40.0 - tR * 0.9, uSeed + 11.0), 3) * 0.5 + 0.5 : 0.5;
  float rimH = 0.012 + 0.03 * spic;                         // rim thickness in stellar radii
  float rim = (1.0 - smoothstep(0.0, rimH, h)) * smoothstep(-0.004, 0.0, h);
  rim *= 0.7 + 0.6 * spic;
  float arcs = fbm(vec3(ang * 5.0 + rot * 0.5, 3.0, uSeed + 23.0), 3) * 0.5 + 0.5;   // where along the limb

  vec3 col = vec3(0.0);
  // the visible-light corona is skipped once the ultraviolet view has fully taken over
  if (uEUV < 0.999) {
    float streaks2 = fbm(vec3(ang * 9.0 + 3.0 + rot * 1.5, rr * 14.0, 7.0) + drift * 1.7, 3) * 0.5 + 0.5;
    float glow = exp(-rr * 16.0) * 0.9 + exp(-rr * 7.0) * 0.05;
    glow *= 0.6 + 0.6 * streaks + 0.3 * streaks2;
    glow += exp(-rr * 2.5) * 0.002 * (0.5 + streaks);
    glow += rays * exp(-rr * 5.0) * 0.06;
    glow *= 1.0 - smoothstep(0.7, 1.0, r);
    vec3 tint = mix(vec3(1.0), vec3(1.0, 0.8, 0.55), smoothstep(0.0, 0.6, rr));
    col = uColor * tint * glow;

    // --- Prominences: a few arching clouds reaching 0.05–0.3 R above the limb ---------------
    float promMask = smoothstep(0.62, 0.78, arcs);
    float promDetail = fbm(vec3(ang * 40.0 + rot, h * 12.0 - tR * 0.15, uSeed + 31.0), 4) * 0.5 + 0.5;
    float promHeight = 0.08 + 0.25 * arcs;
    float prom = promMask * (1.0 - smoothstep(0.0, promHeight, h)) * smoothstep(0.3, 0.75, promDetail) * smoothstep(0.0, 0.015, h);
    prom *= 0.6 + 0.4 * sin(tR * 0.35 + ang * 7.0);

    float chromo = (rim * 3.0 + prom * 1.6) * uProminence;
    col += uRimColor * chromo * (0.6 + 0.4 * streaks);
  }

  // --- Extreme ultraviolet (He II 304 Å) ----------------------------------------------
  // The million-degree corona is faint here; the limb is a bright, ragged fringe of spicules and
  // the prominences, cool dense plasma held up by the field, shine as large twisted clouds
  if (uEUV > 0.001) {
    // loop arcades over the active longitudes: nested arches standing on the limb, leaning a little
    float loops = 0.0;
    float cellW = 0.26;                                   // radians of limb per arcade slot
    float u = (ang + rot) / cellW;
    float cell = floor(u);
    float hc = hash13(vec3(cell, uSeed, 3.0));
    float arcade = step(0.6, hc) * smoothstep(0.35, 0.6, arcs + 0.3 * hc);
    if (arcade > 0.0 && h < 0.3) {
      float x = (fract(u) - 0.5) * cellW - h * (hc - 0.8) * 1.5;
      float rho = cellW * (0.22 + 0.2 * hash13(vec3(cell, uSeed, 7.0)));
      float tall = 0.8 + 0.8 * hash13(vec3(cell, uSeed, 11.0));
      for (int i = 0; i < 4; i++) {
        float ri = rho * (1.0 - 0.22 * float(i));
        vec2 e = vec2(x, h * tall);
        float d = abs(length(e) - ri);
        // threads brighten and fade along the arch
        float along = 0.35 + 0.65 * smoothstep(-0.2, 0.6, snoise(vec3(atan(e.y, e.x) * 2.5, cell + float(i) * 3.1, uSeed + tR * 0.01)));
        loops += exp(-d * d / (ri * ri * 0.005)) * along * (1.0 - 0.2 * float(i));
      }
      loops *= arcade * smoothstep(0.0, 0.004, h) * (0.75 + 0.25 * sin(tR * 0.2 + cell));
    }
    // a few large prominences: cool, dense plasma held up by the field, ragged and twisted
    float promE = smoothstep(0.64, 0.8, arcs);
    float hE = 0.1 + 0.35 * arcs;
    float body = 0.0, fibre = 0.0;
    if (promE > 0.0 && h < hE * 1.45) {
      float twist = fbm(vec3(ang * 18.0 + h * 6.0 + rot, h * 5.0 - tR * 0.04, uSeed + 41.0), 3) * 0.5 + 0.5;
      fibre = pow(1.0 - abs(snoise(vec3(ang * 40.0 + 20.0 * twist, h * 40.0 + 8.0 * twist, uSeed + 53.0))), 3.0);
      body = promE * (1.0 - smoothstep(0.0, hE, h * (0.7 + 0.6 * twist))) * smoothstep(0.42 - 0.3 * (1.0 - smoothstep(0.0, 0.05, h)), 0.7, twist);
    }
    float I = exp(-h * 70.0) * 0.95 + rim * (0.55 + 0.5 * spic) + exp(-h * 12.0) * 0.08 * (0.6 + streaks);
    I += body * (0.5 + 0.8 * fibre) + loops * 0.4;
    I *= uProminence * 0.6 + 0.4;
    // the warm haze behind and around the disc: the transition region and the lower corona
    // glowing through the same filter, streaked along the field
    float haze = (exp(-h * 6.0) * 0.8 + exp(-h * 1.8) * 0.2 + exp(-rr * 3.0) * 0.02) * (0.65 + 0.5 * streaks + 0.6 * rays);
    vec3 euv = aia304(min(I, 1.3)) * 1.1 + vec3(1.0, 0.38, 0.05) * haze;
    col = mix(col, euv * (1.0 - smoothstep(0.7, 1.0, r)), uEUV);
  }

  col *= uIntensity;
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
