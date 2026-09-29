#include <common>
#include <logdepthbuf_pars_vertex>
attribute float size;      // pixels
attribute vec3 color;
attribute float alpha;
uniform float uPixelRatio;
varying vec3 vColor;
varying float vAlpha;
void main() {
  vColor = color;
  vAlpha = alpha;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = size * uPixelRatio;
  #include <logdepthbuf_vertex>
}
