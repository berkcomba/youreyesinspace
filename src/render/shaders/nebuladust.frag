#include <logdepthbuf_pars_fragment>
// Dust of a point-cloud nebula (volumetrics off): each blob dims what lies behind it by its
// opacity (blending: dst · (1 − a)), as the raymarched medium's extinction does.
uniform float uDaylight;
varying vec3 vColor;
varying float vAlpha;
void main() {
  #include <logdepthbuf_fragment>
  vec2 c = gl_PointCoord * 2.0 - 1.0;
  float r2 = dot(c, c);
  if (r2 > 1.0) discard;
  float a = vAlpha * exp(-r2 * 3.0) * (1.0 - r2) * (1.0 - uDaylight);
  gl_FragColor = vec4(0.0, 0.0, 0.0, a);
}
