#include <common>
#include <logdepthbuf_pars_vertex>
// Depth floor under a lander's terrain patch (see depthclear.frag).
void main() {
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  #include <logdepthbuf_vertex>
}
