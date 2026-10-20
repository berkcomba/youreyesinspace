#include <logdepthbuf_pars_fragment>

uniform float uTime;        // simulation hours (slow streamer rotation)
uniform float uRealTime;    // wall-clock seconds (shimmer, spicules, prominence motion)
uniform float uSeed;
uniform vec3 uColor;
uniform vec3 uRimColor;     // chromosphere / prominence tint (Hα pink for cool stars)
uniform float uProminence;  // 0..1 strength of the chromospheric rim and prominences
uniform float uIntensity;
uniform float uCoreRadius;  // fraction of quad half-size occupied by the star disc

varying vec2 vUv;

void main() {
  #include <logdepthbuf_fragment>

  vec2 c = vUv * 2.0 - 1.0;
  float r = length(c);
  if (r > 1.0) discard;
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
  float streaks2 = fbm(vec3(ang * 9.0 + 3.0 + rot * 1.5, rr * 14.0, 7.0) + drift * 1.7, 3) * 0.5 + 0.5;
  float rays = pow(0.5 + 0.5 * snoise(vec3(ang * 22.0 + rot * 2.0, 2.0 + tR * 0.03, uSeed)), 3.0);
  rays *= smoothstep(0.0, 0.25, rr) * (1.0 - smoothstep(0.3, 1.0, rr));

  float glow = exp(-rr * 16.0) * 0.9 + exp(-rr * 7.0) * 0.05;
  glow *= 0.6 + 0.6 * streaks + 0.3 * streaks2;
  glow += exp(-rr * 2.5) * 0.002 * (0.5 + streaks);
  glow += rays * exp(-rr * 5.0) * 0.06;
  glow *= 1.0 - smoothstep(0.7, 1.0, r);
  vec3 tint = mix(vec3(1.0), vec3(1.0, 0.8, 0.55), smoothstep(0.0, 0.6, rr));
  vec3 col = uColor * tint * glow;

  // --- Chromosphere: thin, ragged rim of spicules just above the limb ---------------------
  // spicule forest: fine angular noise, flickering upward motion
  float spic = fbm(vec3(ang * 60.0 + rot, h * 40.0 - tR * 0.9, uSeed + 11.0), 3) * 0.5 + 0.5;
  float rimH = 0.012 + 0.03 * spic;                         // rim thickness in stellar radii
  float rim = (1.0 - smoothstep(0.0, rimH, h)) * smoothstep(-0.004, 0.0, h);
  rim *= 0.7 + 0.6 * spic;

  // --- Prominences: a few arching clouds reaching 0.05–0.3 R above the limb ---------------
  float arcs = fbm(vec3(ang * 5.0 + rot * 0.5, 3.0, uSeed + 23.0), 3) * 0.5 + 0.5;   // where along the limb
  float promMask = smoothstep(0.62, 0.78, arcs);
  float promDetail = fbm(vec3(ang * 40.0 + rot, h * 12.0 - tR * 0.15, uSeed + 31.0), 4) * 0.5 + 0.5;
  float promHeight = 0.08 + 0.25 * arcs;
  float prom = promMask * (1.0 - smoothstep(0.0, promHeight, h)) * smoothstep(0.3, 0.75, promDetail) * smoothstep(0.0, 0.015, h);
  prom *= 0.6 + 0.4 * sin(tR * 0.35 + ang * 7.0);

  float chromo = (rim * 3.0 + prom * 1.6) * uProminence;
  col += uRimColor * chromo * (0.6 + 0.4 * streaks);

  col *= uIntensity;
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
