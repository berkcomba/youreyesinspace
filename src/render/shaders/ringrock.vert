#include <common>
#include <logdepthbuf_pars_vertex>

// Ring particles: a sliding window of procedurally placed boulders around the camera.
// Cells are laid out in (annulus, co-rotating azimuth); each cell's content is a pure
// function of its integer address, so particles are stable as the window slides, and
// each annulus revolves at its own Kepler rate (phase supplied per annulus).

#define N_ANN 32

attribute vec3 aCell;            // (annulus slot 0..N_ANN-1, azimuth slot 0..B-1, particle index)

uniform float uPhase[N_ANN];     // Kepler phase (rad) of each annulus slot
uniform float uCamCell[N_ANN];   // camera's co-rotating azimuth cell for each annulus slot
uniform float uCamAnnulus;       // absolute annulus index under the camera (floored)
uniform float uSlotsB;           // azimuth slots in the window
uniform float uInner, uOuter;    // ring radii (km)
uniform float uDr;               // annulus width == cell arc length (km)
uniform float uHeight;           // vertical half-thickness (km)
uniform float uSeed, uOpacity;
uniform vec4 uGaps[4];
uniform float uSizeMin, uSizeMax; // boulder radii (km)
uniform float uPxPerRad;
uniform float uVis;              // overall visibility 0..1
uniform float uRealTime;

varying vec3 vNormal;
varying vec3 vWorldPos;
varying float vAlpha;
varying vec3 vTint;

mat3 rotAxis(vec3 axis, float ang) {
  float s = sin(ang), c = cos(ang), oc = 1.0 - c;
  return mat3(
    oc * axis.x * axis.x + c,          oc * axis.x * axis.y + axis.z * s, oc * axis.z * axis.x - axis.y * s,
    oc * axis.x * axis.y - axis.z * s, oc * axis.y * axis.y + c,          oc * axis.y * axis.z + axis.x * s,
    oc * axis.z * axis.x + axis.y * s, oc * axis.y * axis.z - axis.x * s, oc * axis.z * axis.z + c);
}

void main() {
  int slot = int(aCell.x + 0.5);
  float a = uCamAnnulus + aCell.x - float(N_ANN) * 0.5;          // absolute annulus index
  float nAnn = floor((uOuter - uInner) / uDr);
  float rA = uInner + (a + 0.5) * uDr;
  float dth = uDr / max(rA, 1.0);
  float ti = uCamCell[slot] + aCell.y - uSlotsB * 0.5;           // absolute co-rotating azimuth cell

  vec3 h  = hash33(vec3(a, ti, aCell.z) * 0.731 + uSeed);
  vec3 h2 = hash33(vec3(ti, aCell.z, a) * 1.173 + uSeed + 19.0);
  vec3 h3 = hash33(vec3(aCell.z, a, ti) * 0.517 - uSeed + 7.0);

  float r = rA + (h.x - 0.5) * uDr;
  float th = (ti + h.y) * dth + uPhase[slot];
  float r01 = (r - uInner) / (uOuter - uInner);
  float dens = ringDensity(r01, uSeed, uGaps) * uOpacity;
  // thin the population in translucent regions; nothing in the gaps
  float keep = step(h2.x, dens * 1.25);

  // vertical distribution: triangular, so the mid-plane is denser
  float y = (h.z - 0.5 + h2.y - 0.5) * uHeight;
  // size: truncated power law N(>s) ∝ s⁻² (inverse CDF), as in the real rings — many pebbles, few giants
  float qmin = uSizeMin / uSizeMax;
  float sz = uSizeMin * inversesqrt(max(1.0 - h2.z * (1.0 - qmin * qmin), 1e-6));

  // shape: a deformed sphere, tumbling slowly
  vec3 axis = normalize(h3 - 0.5 + 1e-3);
  mat3 R = rotAxis(axis, h3.x * 6.2831853 + uRealTime * (0.05 + 0.25 * h3.y));
  vec3 pl = R * position;
  float bump = 1.0 + 0.42 * snoise(position * 1.7 + h * 41.0) + 0.14 * snoise(position * 4.3 + h2 * 67.0);
  vec3 p = pl * bump * sz;
  vec3 n = R * normal;

  vec3 centre = vec3(r * cos(th), y, r * sin(th));
  vec4 wp = modelMatrix * vec4(centre + p, 1.0);
  float dist = length(wp.xyz);
  float px = sz / max(dist, 1e-3) * uPxPerRad;

  bool cull = a < 0.0 || a >= nAnn || keep < 0.5 || px < 0.6 || uVis <= 0.001;
  if (cull) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    vAlpha = 0.0; vNormal = vec3(0.0, 1.0, 0.0); vWorldPos = vec3(0.0); vTint = vec3(1.0);
    return;
  }
  // boulders fade in gently as they grow on screen instead of popping at the pixel threshold
  vAlpha = uVis * smoothstep(0.6, 3.0, px);
  vNormal = normalize(mat3(modelMatrix) * n);
  vWorldPos = wp.xyz;
  // icy boulders, some dirtier
  vTint = mix(vec3(1.0), vec3(0.78, 0.68, 0.56), smoothstep(0.55, 0.95, h3.z));
  gl_Position = projectionMatrix * viewMatrix * wp;
  #include <logdepthbuf_vertex>
}
