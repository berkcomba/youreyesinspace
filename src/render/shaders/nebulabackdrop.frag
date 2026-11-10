#include <logdepthbuf_pars_fragment>
// The frame in the nebula's own hue, its square edge lost in a wide round fade (additive).
uniform sampler2D uTex;
uniform vec3 uColor;
uniform float uAlpha;
varying vec2 vUv;

void main() {
  #include <logdepthbuf_fragment>
  vec3 tex = texture2D(uTex, vUv).rgb;
  vec3 W = vec3(0.2126, 0.7152, 0.0722);
  vec3 hue = uColor / max(dot(uColor, W), 1e-3);
  hue = max(mix(vec3(1.0), hue, 1.5), 0.0);
  // dark lanes stay dark: the gas glows in filaments, not as a veil
  float l = dot(tex, W);
  tex = mix(hue * l * l * 1.6, tex * l * 1.6, 0.25);
  float r = length(vUv * 2.0 - 1.0);
  float mask = 1.0 - smoothstep(0.35, 1.0, r);
  gl_FragColor = vec4(tex * mask * mask * uAlpha, 1.0);
}
