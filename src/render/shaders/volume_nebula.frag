// Volumetric nebula: glowing gas and the dust inside it, raymarched. Local units: object radius = 1.
// Kinds: 0 emission (H II), 1 reflection, 2 planetary, 3 supernova remnant / wind bubble.
uniform float uKind;
uniform vec3 uColor;      // catalogue tint
uniform vec4 uClumps[6];  // emission / reflection: gas clumps (centre, size); [0] is the ionised core
uniform float uClumpW[6];
uniform float uNClumps;
uniform vec3 uAxis;       // planetary: symmetry axis; remnant: the denser side
uniform float uBipolar;
uniform float uDust;

const vec3 HALPHA = vec3(1.0, 0.28, 0.32);
const vec3 OIII = vec3(0.30, 0.95, 0.85);
const vec3 SII = vec3(1.0, 0.45, 0.2);
const vec3 BLUE = vec3(0.45, 0.62, 1.0);

float fbm4(vec3 p) {
  return snoise(p) * 0.5 + snoise(p * 2.03 + 11.7) * 0.25 + snoise(p * 4.07 + 5.3) * 0.125 + snoise(p * 8.13 + 2.1) * 0.0625;
}

// domain warp: turns blobs into wisps and pillars
vec3 warp(vec3 p, float amt) {
  return p + amt * vec3(snoise(p * 1.7 + uSeed), snoise(p * 1.7 + uSeed + 17.1), snoise(p * 1.7 + uSeed + 31.7));
}

void nebulaAt(vec3 p, out vec3 e, out float k) {
  e = vec3(0.0); k = 0.0;
  float r = length(p);
  if (r > 1.3) return;
  if (uKind > 2.5) {
    // remnant: thin filamentary shell, lopsided toward the denser interstellar medium
    float side = dot(normalize(p + 1e-5), uAxis);
    float shellR = 0.95 - 0.12 * side;
    vec3 q = warp(p * 2.2, 0.35);
    float ridge = 1.0 - abs(snoise(q * 2.0));
    float ridge2 = 1.0 - abs(snoise(q * 5.1 + 3.3));
    float shell = exp(-sq((r - shellR) / 0.06));
    float fil = pow(ridge, 7.0) * 1.3 + pow(ridge2, 9.0) * 0.6;
    float g = shell * fil * (0.7 + 0.5 * side);
    vec3 col = mix(mix(OIII, uColor, 0.4), mix(HALPHA, SII, 0.4), smoothstep(0.2, 0.9, ridge2 * (0.6 + 0.4 * side)));
    e = col * g * 5.0 + mix(OIII, BLUE, 0.5) * 0.05 * (1.0 - smoothstep(0.5, 0.9, r));
    return;
  }
  if (uKind > 1.5) {
    // planetary: bright shell (bipolar lobes), [O III] teal inside, H-alpha / [N II] red rim
    float mu = abs(dot(p, uAxis)) / max(r, 1e-4);
    float lobe = 1.0 + uBipolar * 0.75 * pow(mu, 4.0);
    float shellR = 0.72 * lobe;
    float x = r / shellR;
    vec3 q = warp(p * 3.0, 0.2);
    float n = fbm4(q * 2.0) * 0.5 + 0.5;
    float equator = 1.0 - uBipolar * 0.45 * mu;
    float shell = exp(-sq((x - 1.0) / 0.1)) * (0.45 + n) * equator;
    float inner = (1.0 - smoothstep(0.6, 1.0, x)) * 0.25;
    float halo = exp(-sq((x - 1.25) / 0.2)) * 0.08;
    e = mix(OIII, uColor, 0.25) * (inner + shell * 0.6) + mix(HALPHA, uColor, 0.3) * (shell * smoothstep(0.92, 1.05, x) * 1.4 + halo);
    e *= 3.0;
    // knots of cold gas in the shell absorb a little
    k = uDust * 0.5 * shell * pow(max(snoise(q * 6.0), 0.0), 2.0);
    return;
  }
  // emission / reflection: clumps in a warped, flattened sheet of gas, carved by noise
  vec3 q = warp(p * 1.4, uKind > 0.5 ? 0.35 : 0.75);
  float env = 0.0;
  for (int c = 0; c < 6; c++) {
    if (float(c) >= uNClumps) break;
    vec3 dc = (q / 1.4) - uClumps[c].xyz;
    dc.y *= 2.2;
    env += uClumpW[c] * exp(-dot(dc, dc) / (2.0 * uClumps[c].w * uClumps[c].w));
  }
  env *= 1.0 - smoothstep(1.0, 1.3, r);
  if (env < 2e-3) return;
  float n = fbm4(q * 2.4);
  vec3 dc = p - uClumps[0].xyz;
  float dcore = length(dc);
  float coreR = uClumps[0].w * 0.8;
  float core = exp(-dcore * dcore / (2.0 * coreR * coreR * 0.5));
  if (uKind > 0.5) {
    // reflection: blue starlight scattered by fibrous dust
    vec3 s = vec3(q.x * 3.5, q.y * 0.9, q.z * 3.5);
    float fib = pow(max(0.0, 0.55 + 0.6 * snoise(s * 2.0) + 0.3 * n), 2.0);
    float g = env * fib;
    e = mix(BLUE, uColor, 0.4) * g * (0.5 + 1.6 * core);
    k = uDust * g * 1.6;
    return;
  }
  // H II: the young cluster's winds blow a cavity; its wall is the brightest, hottest gas
  // (O III teal-white), H-alpha red further out
  float cavity = smoothstep(coreR * 0.35, coreR * 1.05, dcore);
  float wall = exp(-sq((dcore - coreR) / (0.18 * coreR))) * smoothstep(-0.3, 0.3, n);
  float gas = env * smoothstep(-0.35, 0.45, n) * (0.6 + 0.8 * max(n, 0.0)) * cavity + env * wall * 1.2;
  // dark dust: pillars and lanes, strongest away from the ionised core
  float dn = fbm4(q * 3.3 + 7.0);
  float dust = env * smoothstep(0.05, 0.4, dn) * cavity;
  // ionisation fronts: bright rims where the gas meets the dust
  float front = dust * (1.0 - smoothstep(0.0, 0.25, abs(dn - 0.12))) * 2.0;
  vec3 hot = mix(mix(OIII, vec3(1.0), 0.45), uColor, 0.2);
  vec3 warm = mix(HALPHA, uColor, 0.2);
  e = mix(warm, hot, clamp(core * 1.3 + wall * 0.5, 0.0, 1.0)) * gas * 1.4 + warm * front * 1.2 + mix(SII, HALPHA, 0.5) * dust * 0.05;
  k = uDust * dust * 1.6;
}

void main() {
  vec3 d = viewRay();
  vec2 hit = boxHit(uOrigin, d, uBox);
  if (hit.y <= hit.x || uFade <= 0.0) { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }
  int N = int(uSteps);
  float jit = stepJitter();
  float t0 = hit.x, t1 = hit.y;
  vec3 L = vec3(0.0);
  float T = 1.0;
  float dt = (t1 - t0) / float(N);
  for (int i = 0; i < 128; i++) {
    if (i >= N) break;
    float t = t0 + (float(i) + jit) * dt;
    vec3 e; float k;
    nebulaAt(uOrigin + d * t, e, k);
    float tau = k * dt;
    // gas right at the camera would fill the view with one blur: thin it out
    L += T * e * dt * stepWeight(tau) * smoothstep(0.0, 0.08, t);
    T *= exp(-tau);
    if (T < 0.01) break;
  }
  gl_FragColor = vec4(L * uEmit * uFade, mix(1.0, T, uFade));
}
