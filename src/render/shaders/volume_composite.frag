// Lays the low-resolution volume buffers over the sky: dst · transmittance + emitted light.
uniform sampler2D uVol;    // nebulae and the galaxies seen from outside
uniform vec2 uTexel;       // 1 / buffer size
uniform vec2 uView;        // share of the buffer the frame was drawn into (viewport; the resolution follows the load)
uniform sampler2D uVol2;   // the backdrop galaxy raymarched directly (smaller buffer)
uniform vec2 uTexel2;
uniform float uDirectMix;  // share of the backdrop taken from uVol2 (0 … 1)
uniform samplerCube uCube; // cached backdrop (the galaxy we are inside), scene directions
uniform float uCubeMix;    // share of the backdrop taken from the cube; the two cross-fade
uniform sampler2D uAdapt;  // eye adaptation state (one texel, see volume_adapt.frag)
uniform float uDaylight;   // a bright daytime sky drowns both the glow and the dust
uniform mat4 uInvProj;
uniform mat3 uCamRot;
varying vec2 vUv;

// mean glow the eye adapts to: the Milky Way band from Earth is ~0.025, a galaxy seen from
// outside ~0.01; deep inside a bulge the sky reaches ~0.5 and would be one white wall
const float ADAPT_LUM = 0.12;

// 4 bilinear taps = a 3×3 tent over the buffer: smooths the raymarch jitter
vec4 tent(sampler2D s, vec2 texel, vec2 view) {
  vec2 uv = vUv * view;
  vec2 lo = texel * 0.5, hi = view - texel * 0.5;
  vec4 v = 0.25 * (texture2D(s, clamp(uv + texel * vec2(-0.5, -0.5), lo, hi)) + texture2D(s, clamp(uv + texel * vec2(0.5, -0.5), lo, hi))
    + texture2D(s, clamp(uv + texel * vec2(-0.5, 0.5), lo, hi)) + texture2D(s, clamp(uv + texel * vec2(0.5, 0.5), lo, hi)));
  // one bad sample would be smeared over the whole frame by the bloom
  if (any(isnan(v)) || any(isinf(v))) v = vec4(0.0, 0.0, 0.0, 1.0);
  return v;
}

// Eye adaptation for the glow alone (the stars, planets and HUD keep their exposure): exactly 1
// below ADAPT_LUM, then the mean is held near it. The mean comes from the adaptation state
// (volume_adapt.frag), which follows the frame's glow with a time constant: no jumps with the view
float adaptation() {
  float light = texture2D(uAdapt, vec2(0.5)).r;
  if (!(light >= 0.0) || light > 1e6) return 1.0;
  float x = light / ADAPT_LUM;
  x *= x;
  return inversesqrt(sqrt(1.0 + x * x));
}

void main() {
  vec4 v = tent(uVol, uTexel, uView);
  // the backdrop galaxy: its cached cube and its direct raymarch, cross-faded (light and
  // transmittance alike), behind everything in the buffer
  if (uCubeMix + uDirectMix > 0.001) {
    vec4 b = vec4(0.0, 0.0, 0.0, 1.0);
    if (uCubeMix > 0.001) {
      vec2 ndc = vUv * 2.0 - 1.0;
      vec3 dir = normalize(uCamRot * normalize(vec3(ndc.x * uInvProj[0][0], ndc.y * uInvProj[1][1], -1.0)));
      vec4 c = textureCube(uCube, dir);
      if (any(isnan(c)) || any(isinf(c))) c = vec4(0.0, 0.0, 0.0, 1.0);
      b.rgb += c.rgb * uCubeMix;
      b.a -= (1.0 - c.a) * uCubeMix;
    }
    if (uDirectMix > 0.001) {
      vec4 d = tent(uVol2, uTexel2, vec2(1.0));
      b.rgb += d.rgb * uDirectMix;
      b.a -= (1.0 - d.a) * uDirectMix;
    }
    v = vec4(v.rgb + v.a * b.rgb, v.a * b.a);
  }
  v.rgb *= adaptation();
  gl_FragColor = vec4(v.rgb * (1.0 - uDaylight), mix(v.a, 1.0, uDaylight));
}
