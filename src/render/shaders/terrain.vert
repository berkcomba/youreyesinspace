#include <common>
#include <logdepthbuf_pars_vertex>
// Lander terrain: a grid displaced on the CPU from HiRISE heights (vehicle frame, km, +Y up).
attribute float alpha;        // 1 inside, fading to 0 at the patch edge (meets the globe there)
varying vec3 vLocal;
varying vec3 vNormal;
varying float vAlpha;
varying vec3 vViewPos;        // camera-relative, for the atmosphere's rim scattering (as tile.frag)
varying vec3 vUpView;         // local vertical in view space
void main() {
  vLocal = position;
  vNormal = normal;
  vAlpha = alpha;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vViewPos = mv.xyz;
  vUpView = normalMatrix * vec3(0.0, 1.0, 0.0);
  gl_Position = projectionMatrix * mv;
  #include <logdepthbuf_vertex>
}
