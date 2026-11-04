// Eye adaptation state (one texel): the mean glow of the volumes around us this frame, pulled
// toward over time so a turn of the head or a step closer never changes the exposure in a jump.
uniform sampler2D uVol;
uniform float uRtLod;    // top mip level of the volume buffer (its mean)
uniform float uRtUsed;   // share of the buffer the frame was drawn into (the rest is cleared); 0: nothing was raymarched this frame (stale mipmaps)
uniform sampler2D uVol2; // the backdrop galaxy raymarched directly
uniform float uRt2Lod;
uniform float uDirectW;  // its weight (0 … 1): only while no cube exists yet, or once we are leaving
uniform samplerCube uCube;  // cached backdrop (the galaxy we are inside)
uniform float uCubeW;    // weight of its whole-sky mean (0 … 1), independent of how the backdrop is drawn
uniform float uCubeLod;  // top mip level of the cube
uniform sampler2D uPrev; // previous adaptation state
uniform float uBlend;    // 1 − exp(−dt / τ): a short τ only irons out single-frame glitches; 1 resets to this frame's value
varying vec2 vUv;

const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);

void main() {
  float light = 0.0, trans = 1.0;
  if (uRtUsed > 0.001) {
    // the top mip averages the cleared (0, 0, 0, 1) rest of the buffer in: undo that share
    vec4 m = textureLod(uVol, vec2(0.5), uRtLod);
    light = dot(m.rgb, LUMA) / uRtUsed;
    trans = clamp(1.0 - (1.0 - m.a) / uRtUsed, 0.0, 1.0);
  }
  if (uDirectW > 0.001) {
    vec4 m = textureLod(uVol2, vec2(0.5), uRt2Lod);
    light += trans * uDirectW * dot(m.rgb, LUMA);
  }
  if (uCubeW > 0.001) {
    // the whole sky around us (the six face means): the backdrop's exposure depends on where we
    // are, not on where we look, so turning never changes its brightness
    vec3 c = textureLod(uCube, vec3(1.0, 0.0, 0.0), uCubeLod).rgb + textureLod(uCube, vec3(-1.0, 0.0, 0.0), uCubeLod).rgb
      + textureLod(uCube, vec3(0.0, 1.0, 0.0), uCubeLod).rgb + textureLod(uCube, vec3(0.0, -1.0, 0.0), uCubeLod).rgb
      + textureLod(uCube, vec3(0.0, 0.0, 1.0), uCubeLod).rgb + textureLod(uCube, vec3(0.0, 0.0, -1.0), uCubeLod).rgb;
    light += trans * uCubeW * dot(c, LUMA) / 6.0;
  }
  if (!(light >= 0.0) || light > 1e6) light = 0.0;
  float prev = texture2D(uPrev, vec2(0.5)).r;
  if (!(prev >= 0.0) || prev > 1e6) prev = light;
  gl_FragColor = vec4(mix(prev, light, uBlend), 0.0, 0.0, 1.0);
}
