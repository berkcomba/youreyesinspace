#include <common>
#include <logdepthbuf_pars_vertex>

// Far ring particles: a sparse, fixed cloud of unresolved specks spread over the whole ring, so a
// handful of drifting dots hint at the granular nature of the rings from outside. Points are a
// pure function of their (annulus, azimuth cell, index) address; each annulus revolves at its
// own Kepler rate (phase supplied per annulus, computed on the CPU in double precision).

#define N_ANN 32

attribute vec3 aCell;            // (annulus 0..N_ANN-1, azimuth cell 0..B-1, particle index)

uniform float uPhase[N_ANN];
uniform float uSlotsB;           // azimuth cells around the full circle
uniform float uInner, uOuter;
uniform float uHeight;           // vertical half-thickness (km)
uniform float uSeed, uOpacity;
uniform vec4 uGaps[4];
uniform float uVis;              // overall visibility 0..1
uniform float uPointPx;          // point diameter in device pixels
uniform float uNearKm;           // specks closer than this hide (the boulder layer takes over)

varying vec3 vWorldPos;
varying float vAlpha;

void main() {
  int slot = int(aCell.x + 0.5);
  float dr = (uOuter - uInner) / float(N_ANN);
  float rA = uInner + (aCell.x + 0.5) * dr;
  float dth = 6.2831853 / uSlotsB;

  vec3 h  = hash33(aCell * 0.611 + uSeed + 3.0);
  vec3 h2 = hash33(aCell.yzx * 1.397 + uSeed + 29.0);

  float r = rA + (h.x - 0.5) * dr;
  float th = (aCell.y + h.y) * dth + uPhase[slot];
  float r01 = (r - uInner) / (uOuter - uInner);
  float dens = ringDensity(r01, uSeed, uGaps) * uOpacity;
  float keep = step(h2.x, dens * 1.1);
  float y = (h.z - 0.5 + h2.y - 0.5) * uHeight;

  vec3 centre = vec3(r * cos(th), y, r * sin(th));
  vec4 wp = modelMatrix * vec4(centre, 1.0);
  float dist = length(wp.xyz);

  if (keep < 0.5 || uVis <= 0.001) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    gl_PointSize = 1.0; vAlpha = 0.0; vWorldPos = vec3(0.0);
    return;
  }
  // mostly faint specks, a few brighter ones; hide those close enough to be boulders
  float bright = 0.3 + 0.7 * h2.z * h2.z;
  vAlpha = uVis * bright * smoothstep(uNearKm, uNearKm * 3.0, dist);
  gl_PointSize = uPointPx * (0.7 + 0.6 * h2.z);
  vWorldPos = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
  #include <logdepthbuf_vertex>
}
