#include <common>
#include <logdepthbuf_pars_vertex>

uniform float uIrregular;
uniform float uSeed;
uniform float uFlattening;

varying vec3 vObjPos;
varying vec3 vWorldPos;
varying vec3 vWorldNormal;

void main() {
  vec3 p = position;
  vec3 n = normal;
  if (uIrregular > 0.0) {
    float d = fbm(p * 1.6 + uSeed, 4) + 0.5 * fbm(p * 5.0 + uSeed * 1.7, 3);
    p *= 1.0 + uIrregular * d * 0.45;
  }
  vObjPos = p;
  // Oblateness: squash along the local pole (Y)
  vec3 ps = vec3(p.x, p.y * (1.0 - uFlattening), p.z);
  vec3 ns = normalize(vec3(n.x, n.y / max(1.0 - uFlattening, 1e-3), n.z));
  vec4 wp = modelMatrix * vec4(ps, 1.0);
  vWorldPos = wp.xyz;
  vWorldNormal = normalize(mat3(modelMatrix) * ns);
  gl_Position = projectionMatrix * viewMatrix * wp;
  #include <logdepthbuf_vertex>
}
