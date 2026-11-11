#include <common>
#include <logdepthbuf_pars_vertex>
// Catalogue stars: `position` is the star's J2000 location in parsecs (scene frame, relative to the Sun).
attribute vec3 velocity;   // space velocity, 0.1 km/s
attribute float absMag;
attribute vec3 color;
attribute float starIndex;
uniform float uDrift;      // pc per (0.1 km/s) since J2000
uniform vec3 uCamPc;       // camera position in parsecs
uniform float uPixelRatio;
uniform float uSkyRadius;  // km – stars are projected onto a sphere of this radius (depth-safe)
uniform float uHideIndex;  // index of the current system's star (rendered as a real body instead)
uniform float uMagLimit;   // faintest apparent magnitude drawn
uniform float uFade;       // overall alpha (LOD cross-fade), 1 = full
uniform float uMagBoost;   // magnitudes added to every star's brightness (0 for the catalogue)
// Motion blur: the way the camera travels while the shutter is open (pc, scene frame; 0 = sharp).
// A star is drawn as the trail it leaves across the view in that time, so the near ones stretch
// into long streaks and the far ones stay points, and nothing happens until the camera is fast
// enough to cross a good part of the distance to a star within one exposure.
uniform vec3 uStreak;
uniform vec2 uViewport;    // drawing buffer size (px)
uniform float uMaxPoint;   // largest point the GPU draws (px)
uniform float uStarScale;  // star size setting: 1 = the plain magnitude-to-size scale
varying vec3 vColor;
varying float vAlpha;
varying vec4 vTrail;       // xy: trail direction on screen (unit, y up), z: half its length (px), w: the star's own diameter (px)
varying float vPoint;      // gl_PointSize

void main() {
  vec3 rel = position + velocity * uDrift - uCamPc;
  float d = max(length(rel), 1e-7);
  vec3 dir = rel / d;
  // apparent magnitude from absolute magnitude and distance (pc)
  float m = absMag + 5.0 * (log(d) / log(10.0)) - 5.0 - uMagBoost;
  vec4 mv = modelViewMatrix * vec4(dir * uSkyRadius, 1.0);
  gl_Position = projectionMatrix * mv;
  float flux = pow(10.0, -0.4 * m);
  float size = min(30.0, 1.3 + 3.0 * pow(flux, 0.4));
  // star size setting: the faint stars grow in full; the brightest, already large discs, only a little
  size = min(30.0 * pow(uStarScale, 0.4), size * uStarScale);
  float alpha = min(1.0, 0.16 + 0.9 * pow(flux, 0.45)) * uFade;
  if (abs(starIndex - uHideIndex) < 0.5 || m > uMagLimit) {
    size = 0.0;
    alpha = 0.0;
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0); // clip
  }
  float px = size * uPixelRatio;
  vec3 trail = vec3(1.0, 0.0, 0.0);
  float travel = length(uStreak);
  if (travel > 0.0 && px > 0.0) {
    // the star's direction at the two ends of the exposure. A star passed closely swings through
    // a wide arc that a straight trail cannot show: the travel counts up to a part of its distance.
    vec3 h = uStreak * (0.5 * min(1.0, 0.7 * d / travel));
    vec4 a = projectionMatrix * modelViewMatrix * vec4(normalize(rel + h) * uSkyRadius, 1.0);
    vec4 b = projectionMatrix * modelViewMatrix * vec4(normalize(rel - h) * uSkyRadius, 1.0);
    if (a.w > 0.0 && b.w > 0.0) {
      vec2 t = (a.xy / a.w - b.xy / b.w) * 0.25 * uViewport; // half the trail, px
      float len = length(t);
      if (len > 0.05) {
        // the light of a faint star spread along a long trail is lost: the trail ends where it would be
        trail = vec3(t / len, min(len, max(0.0, min(px * 14.0, (uMaxPoint - px) * 0.5))));
        // the same light over a longer mark: dimmer, though less than in proportion (the eye follows a streak)
        alpha *= pow(px / (px + 2.0 * trail.z), 0.4);
      }
    }
  }
  gl_PointSize = px + 2.0 * trail.z;
  vTrail = vec4(trail, max(px, 1e-3));
  vPoint = gl_PointSize;
  vColor = color;
  vAlpha = alpha;
  #include <logdepthbuf_vertex>
}
