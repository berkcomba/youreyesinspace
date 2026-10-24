#include <logdepthbuf_pars_fragment>
// Meteor streak: additive. A hot white head, a trail that cools from pale green-white (ionised
// air) through amber to nothing. Fireballs are wider, brighter, with an orange smoke-like trail.
uniform float uIntensity;
varying float vAlong;
varying float vAcross;
varying float vGlow;
varying float vKind;
varying float vSeed;

void main() {
  #include <logdepthbuf_fragment>
  if (vGlow <= 0.0) discard;
  // soft across the ribbon; the trail thins toward its end
  float core = 1.0 - vAcross * vAcross;
  float taper = mix(0.2, 1.0, vAlong);
  float across = smoothstep(0.0, 1.0, core * taper);
  // bright head, long fading trail
  float along = pow(vAlong, 1.6);
  float head = exp(-pow((1.0 - vAlong) / 0.04, 2.0)) * (0.9 + 0.8 * vKind);
  float a = (along * 0.8 + head) * across * vGlow * uIntensity;
  // flicker along the trail
  a *= 0.9 + 0.1 * sin(vAlong * 60.0 + vSeed * 50.0);

  vec3 headCol = vec3(1.0, 0.98, 0.92);
  vec3 trailCol = mix(vec3(0.72, 0.95, 0.80), vec3(1.0, 0.72, 0.42), vKind * 0.7);
  vec3 tailEnd = mix(vec3(0.95, 0.60, 0.30), vec3(1.0, 0.45, 0.20), vKind);
  vec3 col = mix(mix(tailEnd, trailCol, smoothstep(0.0, 0.6, vAlong)), headCol, smoothstep(0.75, 1.0, vAlong));
  gl_FragColor = vec4(col, min(a, 1.0) * (1.0 + 0.6 * vKind));
}
