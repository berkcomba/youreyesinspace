// Light meter: the HDR frame reduced to a small buffer of log luminance. Its top mip level is the
// frame's geometric-mean brightness — the measure the eye adapts to (a few bright stars do not
// move it, a sky full of glow does).
uniform sampler2D tDiffuse;
uniform vec2 uStep; // half a meter texel in frame UV: four bilinear taps spread over the block
varying vec2 vUv;

const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);

float lum(vec2 uv) {
  float l = dot(texture2D(tDiffuse, uv).rgb, LUMA);
  return (l >= 0.0 && l < 1e5) ? l : 0.0;
}

void main() {
  float l = 0.25 * (lum(vUv + uStep * vec2(-1.0, -1.0)) + lum(vUv + uStep * vec2(1.0, -1.0))
    + lum(vUv + uStep * vec2(-1.0, 1.0)) + lum(vUv + uStep * vec2(1.0, 1.0)));
  // centre-weighted: the eye looks at the middle of the frame (weights average to 1 over the frame)
  vec2 d = vUv - 0.5;
  float w = 1.3 - 1.8 * dot(d, d);
  gl_FragColor = vec4(w * log(l + 0.002), 0.0, 0.0, 1.0);
}
