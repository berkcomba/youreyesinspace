// Depth floor under a lander's terrain patch (colour untouched): drawn with depthFunc ALWAYS a
// little below the lowest relief, it replaces the planet globe's depth so the patch — which
// follows the real relief above and below the globe's ellipsoid — can be depth-tested on its own,
// while anything drawn later against the depth buffer (stars, far bodies) still stays behind.
#include <logdepthbuf_pars_fragment>
void main() {
  #include <logdepthbuf_fragment>
  gl_FragColor = vec4(0.0);
}
