#include <logdepthbuf_pars_fragment>
// Deep-sky landmark sprite: procedural shape by kind, additive.
varying vec2 vUv;
varying vec3 vColor;
varying float vAlpha;
varying float vKind;
varying float vSeed;

void main() {
  #include <logdepthbuf_fragment>
  vec2 p = vUv * 2.0 - 1.0;      // −1..1 across the sprite (= 1.6 object radii)
  float r = length(p) * 1.6;     // 1 at the object's radius
  float a;
  vec3 col = vColor;
  if (vKind < 0.5) {
    // nebula: irregular glowing cloud with brighter knots
    float n = snoise(vec3(p * 2.4 + vSeed, vSeed * 0.37)) * 0.5 + 0.5;
    float n2 = snoise(vec3(p * 5.5 - vSeed, vSeed * 0.11 + 3.0)) * 0.5 + 0.5;
    float core = exp(-r * r * 1.1);
    a = core * (0.45 + 0.55 * n) * (0.6 + 0.6 * n2) * smoothstep(1.6, 0.5, r);
    // ionised core slightly whiter than the Hα rim
    col = mix(col, vec3(1.0, 0.95, 0.95), core * 0.5);
  } else if (vKind < 1.5) {
    // cluster: concentrated core, extended halo, resolved-star speckle
    float core = exp(-r * r * 7.0);
    float halo = exp(-r * 1.7) * 0.4;
    float s = snoise(vec3(p * 16.0, vSeed));
    float speck = smoothstep(0.5, 0.95, s) * 0.8 * exp(-r * 1.4);
    a = (core + halo + speck) * smoothstep(1.6, 1.0, r);
    col = mix(col, vec3(1.0), core * 0.6);
  } else if (vKind < 2.5) {
    // remnant: expanding shell / ring with filaments and a faint fill
    float n = snoise(vec3(p * 4.0, vSeed)) * 0.5 + 0.5;
    float ring = exp(-pow((r - 0.78) / 0.17, 2.0)) * (0.5 + 0.8 * n);
    float fill = exp(-r * r * 2.2) * 0.22;
    a = (ring + fill) * smoothstep(1.5, 0.95, r);
  } else {
    // star: compact gaussian point
    float rr = length(p);
    a = exp(-rr * rr * 7.0) + 0.15 * exp(-rr * 2.5);
  }
  a *= vAlpha;
  gl_FragColor = vec4(col * a, 1.0);
}
