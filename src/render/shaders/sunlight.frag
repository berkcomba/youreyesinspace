// Sunlight over one ring of a lander's terrain: the share of the Sun's disc each texel sees past the
// relief. From the texel the ground is marched toward the Sun — the finest height field covering
// each step, bent down with the planet's curvature, and beyond the patch the bare sphere — and the
// highest elevation it reaches is the local horizon in that direction.
uniform sampler2D uH0;
uniform sampler2D uH1;
uniform sampler2D uH2;
uniform sampler2D uH3;
uniform sampler2D uH4;
uniform float uHalf[5];       // half-size (km) of each height field (0: none)
uniform float uN[5];          // its vertices per side
uniform float uOuter;         // half-size of the whole patch; its relief fades out over the last uEdge of it
uniform float uEdge;
uniform float uCurv;          // 1 / (2 × the curvature radius)
uniform float uRingHalf;      // the ring this map covers
uniform vec3 uSunDir;         // unit, patch frame
uniform float uSunAng;        // the Sun's angular radius (rad)
uniform float uT0;            // first step (km) and the growth of each next one
uniform float uGrow;
varying vec2 vUv;

// height at p from field `t`: bilinear near the start of the march, where its grid shows
float field(sampler2D t, float size, float n, vec2 p, bool fine) {
  vec2 g = (p + size) / (2.0 * size) * (n - 1.0);
  vec2 i = fine ? floor(g) : floor(g + 0.5);
  float h = texture2D(t, (i + 0.5) / n).r;
  if (fine) {
    vec2 f = g - i;
    float b = texture2D(t, (i + vec2(1.5, 0.5)) / n).r;
    float c = texture2D(t, (i + vec2(0.5, 1.5)) / n).r, d = texture2D(t, (i + 1.5) / n).r;
    h = mix(mix(h, b, f.x), mix(c, d, f.x), f.y);
  }
  return h;
}

float relief(vec2 p, bool fine) {
  float m = max(abs(p.x), abs(p.y));
  float h = 0.0;
  if (m < uHalf[0] * 0.98) h = field(uH0, uHalf[0], uN[0], p, fine);
  else if (m < uHalf[1] * 0.98) h = field(uH1, uHalf[1], uN[1], p, fine);
  else if (m < uHalf[2] * 0.98) h = field(uH2, uHalf[2], uN[2], p, fine);
  else if (m < uHalf[3] * 0.98) h = field(uH3, uHalf[3], uN[3], p, fine);
  else if (m < uHalf[4] * 0.98) h = field(uH4, uHalf[4], uN[4], p, fine);
  return h * (1.0 - smoothstep(1.0 - uEdge, 1.0, m / uOuter));
}

void main() {
  vec2 p = (vUv - 0.5) * 2.0 * uRingHalf;
  float y0 = relief(p, true) - dot(p, p) * uCurv;
  float len = max(length(uSunDir.xz), 1e-5);
  vec2 d = uSunDir.xz / len;
  float horizon = -1.5707963;
  float t = uT0;
  for (int k = 0; k < 64; k++) {
    vec2 q = p + d * t;
    float y = relief(q, k < 10) - dot(q, q) * uCurv;
    horizon = max(horizon, atan(y - y0, t));
    t *= uGrow;
  }
  float sunEl = atan(uSunDir.y, len);
  gl_FragColor = vec4(clamp((sunEl - horizon) / (2.0 * uSunAng) + 0.5, 0.0, 1.0), 0.0, 0.0, 1.0);
}
