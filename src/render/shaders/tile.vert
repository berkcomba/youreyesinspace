#include <common>
#include <logdepthbuf_pars_vertex>

// Tile patch: positions are metres-precise offsets from the patch centre in the body-fixed
// frame (the mesh is positioned at the centre), already on the ellipsoid.
varying vec3 vWorldPos;
varying vec3 vWorldNormal;
varying vec2 vUv;

void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  vWorldNormal = normalize(mat3(modelMatrix) * normal);
  vUv = uv;
  gl_Position = projectionMatrix * viewMatrix * wp;
  #include <logdepthbuf_vertex>
}
