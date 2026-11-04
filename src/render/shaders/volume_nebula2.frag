// Nebula Engine 2.0 raymarcher: a participating medium (gas + dust) lit by its own emission lines
// and 1–4 embedded stars. Composed after common.glsl, volume_common.glsl, nebula_density.glsl
// and nebula_lighting.glsl. Output is premultiplied (L, T) like the other volumes.
void main() {
  vec3 d = viewRay();
  // sampleMedium is empty beyond r = 1.3: march the sphere's chord, not the box's (half the samples)
  vec2 hit = sphereHit(uOrigin, d, 1.3);
  if (hit.y <= hit.x || uFade <= 0.0) { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }
  // uSteps is the budget of the full diameter: a constant step length, so the short chords
  // (the limb, and every ray once the camera is inside) take only the samples they need
  float t0 = hit.x, t1 = hit.y;
  int N = int(clamp(ceil((t1 - t0) * uSteps / 2.6), 4.0, uSteps));
  float jit = stepJitter();
  vec3 L = vec3(0.0);
  float T = 1.0;
  float ds = (t1 - t0) / float(N);
  float dbg = 0.0;
  for (int i = 0; i < 160; i++) {
    if (i >= N) break;
    float t = t0 + (float(i) + jit) * ds;
    vec3 p = uOrigin + d * t;
    Medium m = sampleMedium(p);
    if (m.gas + m.dust < 2e-4) continue;
    float ext = nebulaExtinction(m);
    float Ts = exp(-ext * ds);
    // medium right at the camera would fill the view with one blur: thin it out
    float nearFade = smoothstep(0.0, 0.06, t);
    vec3 src = nebulaSource(p, m) * nearFade;
    L += T * src * ((1.0 - Ts) / ext);
    T *= mix(1.0, Ts, nearFade);
    if (uDebug > 0.5) {
      vec3 sl; float U = ionisation(p, sl);
      dbg += (uDebug < 1.5 ? m.gas : uDebug < 2.5 ? m.dust : uDebug < 3.5 ? U : 0.0) * ds;
    }
    if (T < 0.015) break;
  }
  if (uDebug > 0.5) {
    vec3 c = uDebug < 1.5 ? vec3(1.0, 0.4, 0.3) : uDebug < 2.5 ? vec3(0.6, 0.45, 0.3) : uDebug < 3.5 ? vec3(0.3, 0.7, 1.0) : vec3(1.0);
    gl_FragColor = uDebug < 3.5 ? vec4(c * dbg * 0.6, 1.0 - min(dbg * 0.3, 0.9)) : vec4(c * (1.0 - T), T);
    return;
  }
  gl_FragColor = vec4(L * uEmit * uFade, mix(1.0, T, uFade));
}
