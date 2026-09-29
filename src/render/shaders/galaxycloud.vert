#include <common>
#include <logdepthbuf_pars_vertex>
// Far-tier galaxy point cloud. `position` is galaxy-local (pc); each point is an unresolved
// blob of stars with radius uBlobRadius (pc). Surface brightness is kept distance-independent.
attribute vec3 color;
attribute float weight;
uniform mat3 uBasis;        // galaxy-local → scene
uniform vec3 uCenterRel;    // galaxy centre − camera (pc)
uniform float uPixelRatio;
uniform float uSkyRadius;   // km
uniform float uPxPerRad;
uniform float uBlobRadius;  // pc
uniform float uAlpha;       // per-blob alpha at unit weight when unclamped
uniform float uFade;        // global fade (LOD crossfade with the sprite)
uniform float uMaxPx;
uniform float uExtinction;  // 1/pc – dust extinction along the line of sight when inside the disc
varying vec3 vColor;
varying float vAlpha;

void main() {
  vec3 rel = uBasis * position + uCenterRel;
  float d = max(length(rel), 1e-4);
  vec3 dir = rel / d;
  vec4 mv = modelViewMatrix * vec4(dir * uSkyRadius, 1.0);
  gl_Position = projectionMatrix * mv;
  float physPx = uPxPerRad * uBlobRadius / d;
  // nearby blobs shrink (grainy star clouds instead of huge soft discs); only half of the
  // flux is conserved so they don't turn into bright fake stars
  float shrink = mix(0.12, 1.0, smoothstep(6.0 * uBlobRadius, 80.0 * uBlobRadius, d));
  float drawPx = physPx * shrink;
  float px = clamp(drawPx, 1.5, uMaxPx);
  // conserve total flux when the sprite is clamped (far: bigger than physical → dimmer; near: smaller → brighter)
  float a = uAlpha * weight * (drawPx * drawPx) / (px * px) / shrink;
  // inside the blob's neighbourhood the procedural stars take over
  a *= smoothstep(uBlobRadius * 3.0, uBlobRadius * 10.0, d);
  a *= uFade * exp(-d * uExtinction);
  // dust reddening of distant light seen through the disc
  vec3 col = color * mix(vec3(1.0), vec3(1.0, 0.82, 0.62), clamp(d * uExtinction * 0.5, 0.0, 1.0));
  if (a < 0.0005) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    px = 0.0;
  }
  gl_PointSize = px * uPixelRatio;
  vColor = col;
  vAlpha = min(a, 1.0);
  #include <logdepthbuf_vertex>
}
