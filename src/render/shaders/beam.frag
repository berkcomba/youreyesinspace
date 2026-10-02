#include <logdepthbuf_pars_fragment>
// Pulsar radiation beam: additive, bright at the apex, fading along the length and toward
// the silhouette (reads as a filled, glowing cone). Faint pulses race outward.
uniform vec3 uColor;
uniform float uTime;
uniform float uIntensity;
varying vec2 vUv;
varying float vFacing;
void main() {
  #include <logdepthbuf_fragment>
  // uv.y: 1 at the far end (wide top), 0 at the apex
  float along = 1.0 - vUv.y;
  float len = pow(along, 2.2);
  float core = pow(vFacing, 2.2);
  float streak = 0.9 + 0.1 * sin(vUv.y * 40.0 - uTime * 30.0);
  float a = len * core * streak * 0.6 * uIntensity;
  vec3 col = mix(uColor, vec3(1.0), along * along * 0.35);
  gl_FragColor = vec4(col * a, a);
}
