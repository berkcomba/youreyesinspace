#include <logdepthbuf_pars_fragment>
varying vec3 vColor;
varying float vAlpha;
void main() {
  #include <logdepthbuf_fragment>
  if (vAlpha < 0.002) discard;
  vec2 d = gl_PointCoord - 0.5;
  float r2 = dot(d, d) * 4.0;
  if (r2 > 1.0) discard;
  // gaussian-ish parcel
  float disc = exp(-r2 * 3.0) * (1.0 - r2);
  gl_FragColor = vec4(vColor * vAlpha * disc, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
