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
    // displace along the direction and rebuild a smooth normal from neighbouring samples
    vec3 d = normalize(position);
    vec3 T = normalize(cross(abs(d.y) < 0.99 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0), d));
    vec3 B = cross(d, T);
    const float e = 0.015;
    vec3 dT = normalize(d + T * e);
    vec3 dB = normalize(d + B * e);
    p = d * smallBodyRadius(d, uSeed, uIrregular);
    vec3 pT = dT * smallBodyRadius(dT, uSeed, uIrregular);
    vec3 pB = dB * smallBodyRadius(dB, uSeed, uIrregular);
    n = normalize(cross(pT - p, pB - p));
    if (dot(n, d) < 0.0) n = -n;
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
