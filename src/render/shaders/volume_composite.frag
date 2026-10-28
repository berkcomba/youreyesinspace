// Lays the low-resolution volume buffer over the sky: dst · transmittance + emitted light.
uniform sampler2D uVol;
uniform float uDaylight;
uniform vec2 uTexel;     // 1 / buffer size  // a bright daytime sky drowns both the glow and the dust
uniform samplerCube uCube;  // cached backdrop (the galaxy we are inside), scene directions
uniform float uUseCube;
uniform mat4 uInvProj;
uniform mat3 uCamRot;
uniform vec2 uUvScale;   // part of the buffer that was rendered this frame
uniform float uRtLod;    // top mip level of the buffer (its mean)
uniform float uRtUsed;   // 0: nothing was raymarched this frame (stale mipmaps)
uniform float uCubeLod;  // top mip level of the cube (face means)
varying vec2 vUv;

const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);
// mean glow the eye adapts to: the Milky Way band from Earth is ~0.025, a galaxy seen from
// outside ~0.01; deep inside a bulge the sky reaches ~0.5 and would be one white wall
const float ADAPT_LUM = 0.12;

vec4 tap(vec2 uv) { return texture2D(uVol, clamp(uv, uTexel * 0.5, uUvScale - uTexel * 0.5)); }

// Eye adaptation for the glow alone (the stars, planets and HUD keep their exposure): exactly 1
// below ADAPT_LUM, then the mean is held near it
float adaptation() {
  float light = 0.0, trans = 1.0;
  if (uRtUsed > 0.5) {
    vec4 m = textureLod(uVol, vec2(0.5), uRtLod);
    float area = uUvScale.x * uUvScale.y;
    // the unrendered part of the buffer is empty (light 0, transmittance 1)
    light = dot(m.rgb, LUMA) / area;
    trans = clamp(1.0 - (1.0 - m.a) / area, 0.0, 1.0);
  }
  if (uUseCube > 0.5) {
    // what is on screen: the centre and four points toward the corners, from coarse mip levels
    float lod = uCubeLod - 2.0;
    vec3 c = vec3(0.0);
    for (int i = 0; i < 5; i++) {
      vec2 o = i == 0 ? vec2(0.0) : vec2(i == 1 || i == 3 ? -0.6 : 0.6, i < 3 ? -0.6 : 0.6);
      c += textureLod(uCube, uCamRot * normalize(vec3(o.x * uInvProj[0][0], o.y * uInvProj[1][1], -1.0)), lod).rgb;
    }
    light += trans * dot(c, LUMA) / 5.0;
  }
  if (!(light >= 0.0) || light > 1e6) return 1.0;
  float x = light / ADAPT_LUM;
  x *= x;
  return inversesqrt(sqrt(1.0 + x * x));
}

void main() {
  // 4 bilinear taps = a 3×3 tent over the buffer: smooths the raymarch jitter
  vec2 uv = vUv * uUvScale;
  vec4 v = 0.25 * (tap(uv + uTexel * vec2(-0.5, -0.5)) + tap(uv + uTexel * vec2(0.5, -0.5))
    + tap(uv + uTexel * vec2(-0.5, 0.5)) + tap(uv + uTexel * vec2(0.5, 0.5)));
  // one bad sample would be smeared over the whole frame by the bloom
  if (any(isnan(v)) || any(isinf(v))) v = vec4(0.0, 0.0, 0.0, 1.0);
  if (uUseCube > 0.5) {
    vec2 ndc = vUv * 2.0 - 1.0;
    vec3 dir = normalize(uCamRot * normalize(vec3(ndc.x * uInvProj[0][0], ndc.y * uInvProj[1][1], -1.0)));
    vec4 b = textureCube(uCube, dir);
    if (any(isnan(b)) || any(isinf(b))) b = vec4(0.0, 0.0, 0.0, 1.0);
    // the buffer's volumes are in front of the backdrop
    v = vec4(v.rgb + v.a * b.rgb, v.a * b.a);
  }
  v.rgb *= adaptation();
  gl_FragColor = vec4(v.rgb * (1.0 - uDaylight), mix(v.a, 1.0, uDaylight));
}
