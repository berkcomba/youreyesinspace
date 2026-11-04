// Eye adaptation state (one texel, ping-pong): R the log luminance the eye is adapted to, G the
// gain it implies. The level follows the meter's top mip (the frame's mean log luminance) with a
// time constant, quick toward the light and slow back into the dark; the output pass multiplies
// the frame by G ahead of tone mapping.
uniform sampler2D uMeter;
uniform float uLod;
uniform sampler2D uPrev;
uniform float uUp;      // 1 − exp(−dt / τ_up)
uniform float uDown;    // 1 − exp(−dt / τ_down)
uniform float uReset;   // 1: take this frame's reading as is
uniform float uActive;  // 0: metering off, gain 1
uniform float uTarget;  // log luminance where the gain starts to fall
uniform float uStrength;
uniform float uMinGain;
varying vec2 vUv;

void main() {
  float l = textureLod(uMeter, vec2(0.5), uLod).r;
  if (!(l > -20.0 && l < 20.0)) l = log(0.002);
  float prev = texture2D(uPrev, vec2(0.5)).r;
  if (!(prev > -20.0 && prev < 20.0)) prev = l;
  float a = (uReset > 0.5 || uActive < 0.5) ? l : prev + (l - prev) * (l > prev ? uUp : uDown);
  // smooth knee in log space: log(1 + e^(4x)) / 4 → 0 for x << 0, x for x >> 0
  float x = clamp(a - uTarget, -10.0, 10.0);
  float over = log(1.0 + exp(4.0 * x)) * 0.25;
  float gain = uActive > 0.5 ? max(exp(-uStrength * over), uMinGain) : 1.0;
  gl_FragColor = vec4(a, gain, 0.0, 1.0);
}
