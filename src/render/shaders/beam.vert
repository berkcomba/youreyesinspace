#include <common>
#include <logdepthbuf_pars_vertex>
// Pulsar beam cone (apex at the star, y = 0 … length)
varying vec2 vUv;
varying float vFacing;
void main() {
  vUv = uv;
  vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
  vec3 n = normalize(normalMatrix * normal);
  // 1 = surface facing the camera head-on (centre of the beam), 0 = silhouette
  vFacing = abs(dot(n, normalize(-mvPos.xyz)));
  gl_Position = projectionMatrix * mvPos;
  #include <logdepthbuf_vertex>
}
