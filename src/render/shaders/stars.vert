#include <common>
#include <logdepthbuf_pars_vertex>
// Catalogue stars: `position` is the star's location in parsecs (scene frame, relative to the Sun).
attribute float absMag;
attribute vec3 color;
attribute float starIndex;
uniform vec3 uCamPc;       // camera position in parsecs
uniform float uPixelRatio;
uniform float uSkyRadius;  // km – stars are projected onto a sphere of this radius (depth-safe)
uniform float uHideIndex;  // index of the current system's star (rendered as a real body instead)
uniform float uMagLimit;   // faintest apparent magnitude drawn
varying vec3 vColor;
varying float vAlpha;

void main() {
  vec3 rel = position - uCamPc;
  float d = max(length(rel), 1e-7);
  vec3 dir = rel / d;
  // apparent magnitude from absolute magnitude and distance (pc)
  float m = absMag + 5.0 * (log(d) / log(10.0)) - 5.0;
  vec4 mv = modelViewMatrix * vec4(dir * uSkyRadius, 1.0);
  gl_Position = projectionMatrix * mv;
  float flux = pow(10.0, -0.4 * m);
  float size = min(30.0, 1.3 + 3.0 * pow(flux, 0.4));
  float alpha = min(1.0, 0.16 + 0.9 * pow(flux, 0.45));
  if (abs(starIndex - uHideIndex) < 0.5 || m > uMagLimit) {
    size = 0.0;
    alpha = 0.0;
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0); // clip
  }
  gl_PointSize = size * uPixelRatio;
  vColor = color;
  vAlpha = alpha;
  #include <logdepthbuf_vertex>
}
