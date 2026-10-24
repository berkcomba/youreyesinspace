#include <common>
#include <logdepthbuf_pars_vertex>
// Rover panorama strip: a band of a sphere around the vehicle (vehicle frame, km, +Y up, −Z north).
varying vec3 vDir;            // direction from the dome's centre (the mast)
varying vec3 vViewPos;
void main() {
  vDir = position;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vViewPos = mv.xyz;
  gl_Position = projectionMatrix * mv;
  #include <logdepthbuf_vertex>
}
