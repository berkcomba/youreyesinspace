#include <common>
#include <logdepthbuf_pars_vertex>
varying vec3 vWorldPos;
varying float vRadius; // km from centre in object units
void main() {
  vRadius = length(position.xy);
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
  #include <logdepthbuf_vertex>
}
