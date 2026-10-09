#include <logdepthbuf_pars_fragment>
// Deep-sky landmark sprite: procedural shape by kind, additive.
varying vec2 vUv;
varying vec3 vColor;
varying float vAlpha;
varying float vKind;
varying float vSeed;
varying float vImg;
varying float vSpan;
uniform float uTime;
uniform sampler2D uAtlas;
uniform float uAtlasReady;
uniform float uAtlasGrid;

void main() {
  #include <logdepthbuf_fragment>
  vec2 p = vUv * 2.0 - 1.0;      // −1..1 across the sprite (= vSpan object radii)
  float r = length(p) * vSpan;   // 1 at the object's radius
  float a;
  vec3 col = vColor;
  if (vImg >= 0.0 && uAtlasReady > 0.5) {
    // photograph from the atlas (flipY canvas texture: slot rows count from the top)
    float g = uAtlasGrid;
    float slotCol = mod(vImg, g);
    float slotRow = floor(vImg / g);
    vec2 uv = vec2((slotCol + vUv.x) / g, 1.0 - (slotRow + 1.0 - vUv.y) / g);
    vec3 tex = texture2D(uAtlas, uv).rgb;
    tex = pow(tex, vec3(2.2));   // sRGB → linear (the composer's output pass re-encodes)
    // the output pass applies ACES filmic, which pre-scales by 1/0.6 and lifts the mid-tones;
    // compensate so the photograph keeps its published contrast and colour
    tex *= 0.55;
    // soft superellipse vignette hides the frame without reading as a disc; the photo's own
    // sky is additive-black anyway
    vec2 q = p * p; q *= q;
    float mask = smoothstep(1.0, 0.68, pow(q.x + q.y, 0.25));
    gl_FragColor = vec4(tex * mask * vAlpha, 1.0);
    return;
  }
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
  } else if (vKind < 3.5) {
    // star: compact gaussian point
    float rr = length(p);
    a = exp(-rr * rr * 7.0) + 0.15 * exp(-rr * 2.5);
  } else {
    // pulsar: gaussian point with a sharp periodic flash and a faint cross-shaped glint
    float rr = length(p);
    float phase = fract(uTime * (0.9 + 0.35 * fract(vSeed * 0.731)) + vSeed);
    float flash = exp(-phase * 14.0) + 0.35 * exp(-fract(phase + 0.5) * 20.0);
    float cross = exp(-abs(p.x) * 9.0) * exp(-abs(p.y) * 1.2) + exp(-abs(p.y) * 9.0) * exp(-abs(p.x) * 1.2);
    a = (exp(-rr * rr * 7.0) + 0.15 * exp(-rr * 2.5)) * (0.55 + 0.9 * flash) + cross * 0.22 * flash;
  }
  a *= vAlpha;
  gl_FragColor = vec4(col * a, 1.0);
}
