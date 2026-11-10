#include <common>
#include <logdepthbuf_pars_vertex>
// A nebula's frame on the night sky of a world inside it: a square fixed among the stars toward
// uDir (camera at the origin), spanning uHalf (tangent of the half-angle) along uT and uB.
uniform vec3 uDir;
uniform vec3 uT;
uniform vec3 uB;
uniform float uHalf;
uniform float uDist;
varying vec2 vUv;

void main() {
  vec3 p = (uDir + (uT * position.x + uB * position.y) * uHalf) * uDist;
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
  vUv = uv;
  #include <logdepthbuf_vertex>
}
