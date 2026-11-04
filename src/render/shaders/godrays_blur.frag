// Radial blur of the light-shaft source toward the star (GPU Gems 3, ch. 13): every pixel sums
// the mask along the line to the star, the samples fading with distance.
uniform sampler2D tDiffuse;
uniform vec2 uSun;      // star centre (UV)
uniform float uDensity; // share of the way to the star covered by the samples
uniform float uDecay;
varying vec2 vUv;

const int N = 48;

void main() {
  vec2 delta = (vUv - uSun) * (uDensity / float(N));
  vec2 uv = vUv;
  float w = 1.0, sum = 0.0, wsum = 0.0;
  for (int i = 0; i < N; i++) {
    uv -= delta;
    vec2 c = clamp(uv, 0.0, 1.0);
    // outside the frame the mask is unknown: count it as empty
    float inside = (c == uv) ? 1.0 : 0.0;
    sum += texture2D(tDiffuse, c).r * inside * w;
    wsum += w;
    w *= uDecay;
  }
  gl_FragColor = vec4(vec3(sum / wsum), 1.0);
}
