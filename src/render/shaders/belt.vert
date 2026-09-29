#include <common>
#include <logdepthbuf_pars_vertex>
attribute vec4 elems0; // a (km), e, i (rad), node (rad)
attribute vec4 elems1; // argPeri (rad), M0 (rad), n (rad/s), brightness
uniform float uTime;   // seconds since J2000
uniform vec3 uSunPos;  // camera-relative
uniform float uPixelRatio;
uniform mat3 uBasis;   // orbit reference plane → scene (identity = ecliptic)
varying float vBright;
varying float vFade;

void main() {
  float a = elems0.x, e = elems0.y, inc = elems0.z, node = elems0.w;
  float w = elems1.x, M0 = elems1.y, n = elems1.z;
  float M = M0 + n * uTime;
  M = mod(M, 6.28318530718);
  // Kepler: 4 Newton iterations is plenty for e < 0.4
  float E = M + e * sin(M);
  for (int k = 0; k < 4; k++) {
    E = E - (E - e * sin(E) - M) / (1.0 - e * cos(E));
  }
  float P = a * (cos(E) - e);
  float Q = a * sqrt(1.0 - e * e) * sin(E);
  float cw = cos(w), sw = sin(w), cO = cos(node), sO = sin(node), ci = cos(inc), si = sin(inc);
  float xw = P * cw - Q * sw;
  float yw = P * sw + Q * cw;
  vec3 m = vec3(xw * cO - yw * ci * sO, xw * sO + yw * ci * cO, yw * si);
  vec3 scenePos = uBasis * vec3(m.x, m.z, -m.y) + uSunPos;

  vec4 mv = modelViewMatrix * vec4(scenePos, 1.0);
  gl_Position = projectionMatrix * mv;
  float dist = length(mv.xyz);
  // Points shrink when very close (they are km-scale rocks) and stay ~1px far away
  float px = clamp(1.6 - dist / a * 0.6, 0.6, 1.8) * (0.7 + 0.6 * elems1.w);
  gl_PointSize = px * uPixelRatio;
  vBright = elems1.w;
  // fade out when the camera is far outside the belt so it doesn't become a solid disc
  float camToStar = length(uSunPos);
  vFade = 1.0 - smoothstep(a * 15.0, a * 80.0, camToStar);
  if (vFade <= 0.0) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
  #include <logdepthbuf_vertex>
}
