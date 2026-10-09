#include <common>
#include <logdepthbuf_pars_vertex>
// Image-based nebula point cloud. `position` is nebula-local (pc; x right, y up as seen from
// Earth, z toward Earth); each point is a soft gas blob of radius uBlobRadius·size (pc) whose
// surface brightness is kept distance-independent, like the galaxy clouds.
attribute vec3 color;
attribute float weight;
attribute float size;
uniform mat3 uBasis;        // nebula-local → scene
uniform vec3 uCenterRel;    // nebula centre − camera (pc)
uniform float uPixelRatio;
uniform float uSkyRadius;   // km
uniform float uPxPerRad;
uniform float uBlobRadius;  // pc
uniform float uAlpha;       // per-blob peak alpha at unit weight/size
uniform float uFade;        // LOD crossfade with the photo sprite × brightness scale
uniform float uMaxPx;
varying vec3 vColor;
varying float vAlpha;

void main() {
  vec3 rel = uBasis * position + uCenterRel;
  float d = max(length(rel), 1e-5);
  vec3 dir = rel / d;
  vec4 mv = modelViewMatrix * vec4(dir * uSkyRadius, 1.0);
  gl_Position = projectionMatrix * mv;
  float rb = uBlobRadius * size;
  float physPx = uPxPerRad * rb / d;          // blob radius on screen
  float px = clamp(physPx, 0.75, uMaxPx * 0.5);
  // a point's total light is independent of its size; conserve it when the sprite is clamped
  float a = uAlpha * weight / (size * size) * (physPx * physPx) / (px * px);
  // blobs right at the camera would fill the screen: thin them out
  a *= smoothstep(rb * 0.4, rb * 2.5, d);
  a *= uFade;
  if (a < 0.0005) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    px = 0.0;
  }
  gl_PointSize = 2.0 * px * uPixelRatio;      // point size is a diameter
  vColor = color;
  vAlpha = min(a, 1.0);
  #include <logdepthbuf_vertex>
}
