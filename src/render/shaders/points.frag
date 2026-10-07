#include <logdepthbuf_pars_fragment>
uniform float uSoftness; // 0 = hard star, 1 = soft glow
uniform vec4 uTint;      // rgb + strength: "procedural content" highlight (0 = off, default)
varying vec3 vColor;
varying float vAlpha;
void main() {
  #include <logdepthbuf_fragment>
  vec2 c = gl_PointCoord * 2.0 - 1.0;
  float r = length(c);
  if (r > 1.0) discard;
  float core = exp(-r * r * 8.0);
  float halo = exp(-r * 3.0) * 0.5;
  float a = mix(core + halo * 0.4, core * 0.6 + halo, uSoftness);
  vec3 col = mix(vColor, uTint.rgb * max(vColor.r, max(vColor.g, vColor.b)), uTint.a);
  gl_FragColor = vec4(col * a * vAlpha, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
