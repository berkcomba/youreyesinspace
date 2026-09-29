#include <logdepthbuf_pars_fragment>

uniform float uTime;
uniform vec3 uColor;
uniform float uIntensity;
uniform float uCoreRadius; // fraction of quad half-size occupied by the star disc

varying vec2 vUv;

void main() {
  #include <logdepthbuf_fragment>

  vec2 c = vUv * 2.0 - 1.0;
  float r = length(c);
  if (r > 1.0) discard;
  float ang = atan(c.y, c.x);

  // Streamers
  float streaks = fbm(vec3(ang * 3.0, r * 6.0 - uTime * 0.03, 1.0), 4) * 0.5 + 0.5;
  float streaks2 = fbm(vec3(ang * 9.0 + 3.0, r * 14.0 - uTime * 0.02, 7.0), 3) * 0.5 + 0.5;

  float rr = max(r - uCoreRadius, 0.0) / max(1.0 - uCoreRadius, 1e-3);
  // Inner corona: tight bright ring; outer: faint streamers
  float glow = exp(-rr * 16.0) * 0.9 + exp(-rr * 7.0) * 0.05;
  glow *= 0.6 + 0.6 * streaks + 0.3 * streaks2;
  glow += exp(-rr * 2.5) * 0.002 * (0.5 + streaks);
  glow *= 1.0 - smoothstep(0.7, 1.0, r);
  // slightly warmer toward the outside
  vec3 tint = mix(vec3(1.0), vec3(1.0, 0.8, 0.55), smoothstep(0.0, 0.6, rr));

  vec3 col = uColor * tint * glow * uIntensity;
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
