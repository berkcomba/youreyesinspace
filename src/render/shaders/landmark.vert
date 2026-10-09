#include <common>
#include <logdepthbuf_pars_vertex>
// Deep-sky landmarks (nebulae, clusters, remnants, record stars) as instanced billboards.
// `position` is the unit quad; instance attributes give the object in parsecs (scene frame).
attribute vec3 iPos;      // pc
attribute float iRadius;  // pc
attribute vec3 iColor;
attribute float iKind;    // 0 nebula, 1 cluster, 2 remnant, 3 star
attribute float iAbsMag;
attribute float iSeed;
attribute float iIndex;
attribute float iImg;     // atlas slot of the photograph, −1 = procedural
attribute float iSpan;    // half-width of the sprite in object radii
uniform vec3 uCamPc;
uniform float uSkyRadius;
uniform float uPxPerRad;
uniform float uK;         // flux → alpha·px² calibration (shared with the galaxy sprites)
uniform float uHideIndex; // instance to hide (we are inside its system)
varying vec2 vUv;
varying vec3 vColor;
varying float vAlpha;
varying float vKind;
varying float vSeed;
varying float vImg;
varying float vSpan;

void main() {
  vec3 rel = iPos - uCamPc;
  float d = max(length(rel), 1e-6);
  vec3 dir = rel / d;
  float ratio = d / iRadius;
  float ang = atan(iRadius / d);
  float px = ang * uPxPerRad;
  bool star = iKind > 2.5;
  // the sprite reaches `iSpan` radii (1.6 for procedural shapes, the photo's field otherwise);
  // never smaller than a few pixels
  float halfPx = max(px * iSpan, star ? 2.6 : 3.5);
  float halfAng = min(halfPx / uPxPerRad, 1.2);
  vec4 mv = modelViewMatrix * vec4(dir * uSkyRadius, 1.0);
  mv.xy += position.xy * uSkyRadius * tan(halfAng);
  gl_Position = projectionMatrix * mv;

  float m = iAbsMag + 5.0 * (log(d) / log(10.0)) - 5.0;
  float flux = pow(10.0, -0.4 * m);
  float alpha;
  if (star) {
    alpha = min(1.0, 0.2 + 0.9 * pow(flux, 0.45));
  } else {
    float pxc = max(px, 0.75);
    float physical = min(uK * flux / (0.61 * pxc * pxc), 1.0);
    // navigation aid: stays clearly visible once we are within a few hundred radii
    float near = 0.6 * smoothstep(600.0, 60.0, ratio);
    alpha = max(physical, near);
  }
  // fade out when flying through it (a flat sprite would otherwise fill the screen)
  alpha *= smoothstep(0.8, 2.2, ratio);
  if (abs(iIndex - uHideIndex) < 0.5) alpha = 0.0;
  if (alpha < 0.002) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);

  vUv = uv;
  vColor = iColor;
  vAlpha = alpha;
  vKind = iKind;
  vSeed = iSeed;
  vImg = iImg;
  vSpan = iSpan;
  #include <logdepthbuf_vertex>
}
