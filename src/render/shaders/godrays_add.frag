// Lays the light shafts over the frame: the sky's aureole around the star is scattered sunlight,
// so where a cloud or a hill shadows the air along a ray it goes dark, and where the light gets
// through it is added — the bright-and-dark fan of crepuscular rays.
uniform sampler2D tDiffuse;
uniform sampler2D tRays;   // blurred source as seen (carved by the ground and the clouds)
uniform sampler2D tFull;   // the same, unoccluded
uniform vec3 uColor;       // the star's light × strength
uniform float uShadow;     // how dark the shadowed sectors get (0 … 1)
uniform sampler2D tDepth;  // scene depth: the fan is in the air, the ground only catches a little of it
uniform float uSunDepth;
varying vec2 vUv;

void main() {
  vec4 c = texture2D(tDiffuse, vUv);
  float r = texture2D(tRays, vUv).r;
  float f = texture2D(tFull, vUv).r;
  if (!(r >= 0.0) || r > 1e4) r = 0.0;
  if (!(f >= 0.0) || f > 1e4) f = 0.0;
  // share of the light that gets through along this ray (1 where nothing is in the way)
  float through = f > 1e-4 ? clamp(r / f, 0.0, 1.0) : 1.0;
  // the shadow only matters inside the aureole, where the sky is lit by forward scattering
  float aureole = min(f * 2.0, 1.0);
  float sky = step(uSunDepth - 2e-5, texture2D(tDepth, vUv).r);
  c.rgb *= mix(1.0, through, uShadow * aureole * mix(0.3, 1.0, sky));
  c.rgb += uColor * r;
  gl_FragColor = c;
}
