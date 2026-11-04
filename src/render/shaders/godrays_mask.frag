// Light-shaft source: the star's disc (with a small glow) where nothing in the scene stands in
// front of it — the depth buffer carries the ground, the horizon, moons and rings; the cloud deck
// is drawn over this mask afterwards (clouds.frag in mask mode) and takes its share.
uniform sampler2D tDepth;   // resolved scene depth (logarithmic)
uniform vec2 uSun;          // star centre (NDC)
uniform float uSunDepth;    // the star's encoded depth
uniform float uRadius;      // apparent radius of the disc (NDC x units)
uniform float uAspect;      // width / height
uniform float uOpen;        // 1: ignore the depth (the unoccluded reference the shafts are measured against)
varying vec2 vUv;

void main() {
  vec2 ndc = vUv * 2.0 - 1.0;
  vec2 d = (ndc - uSun) * vec2(1.0, 1.0 / uAspect);
  float r = length(d);
  float R = uRadius;
  float disc = 1.0 - smoothstep(R * 0.8, R * 1.25, r);
  // the aureole: the air's forward scattering around the disc is what the shafts are cut from
  // (a bare disc a few pixels wide would seed nothing visible); carved by whatever covers it
  float glow = exp(-r / max(R * 3.0, 0.11));
  float depth = texture2D(tDepth, vUv).r;
  float open = uOpen > 0.5 ? 1.0 : step(uSunDepth - 2e-5, depth);
  gl_FragColor = vec4(vec3((disc + glow) * open), 1.0);
}
