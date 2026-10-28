#include <common>
#include <logdepthbuf_pars_vertex>
// Comet coma and tails: soft parcels of dust / ions with a physical size (km), projected.
attribute float aSize;      // km
attribute vec3 color;
attribute float alpha;
uniform float uPxPerRad;
uniform float uPixelRatio;
uniform float uMaxPx;
uniform float uVis;
varying vec3 vColor;
varying float vAlpha;
void main() {
  vColor = color;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  float dist = max(length(mv.xyz), 1e-3);
  float px = aSize / dist * uPxPerRad;
  // inside the cloud a parcel would cover the screen: cap it and dim it by the area lost
  float capped = min(px, uMaxPx);
  float dim = px > uMaxPx ? pow(uMaxPx / px, 2.0) : 1.0;
  gl_PointSize = max(capped, 1.0) * uPixelRatio;
  float thin = px < 1.0 ? px * px : 1.0;
  vAlpha = alpha * dim * thin * uVis;
  gl_Position = projectionMatrix * mv;
  #include <logdepthbuf_vertex>
}
