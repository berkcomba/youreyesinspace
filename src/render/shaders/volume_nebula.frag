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

// thickness of the thin sheets (object radii): no thinner than the ray step can resolve
float gSheetW = 0.03;
// the view ray (local frame): a thin sheet is brightest where the ray runs along it (the limb)
vec3 gDir = vec3(0.0, 0.0, 1.0);

void nebulaAt(vec3 p, out vec3 e, out float k) {
  e = vec3(0.0); k = 0.0;
  float r = length(p);
  if (r > 1.3) return;
  if (uKind > 2.5) {
    // remnant: the shocked shell is a thin, wrinkled sheet (Hester 1987). Seen edge-on at the limb
    // the wrinkles are the bright tangential filaments; face-on they are faint broad arcs. Three
    // nested sheets — the outer Hα/[S II] shock, the [O III] cooling layers behind it — broken into
    // patches where the blast ran into thin gas, squashed toward the denser side; a faint
    // synchrotron interior
    vec3 u = p / max(r, 1e-4);
    float side = dot(u, uAxis);
    float base = 0.92 - 0.1 * side;
    // deep interior: only the faint synchrotron glow (the sheets live in 0.62 … 1.12 base)
    if (r < 0.6 * base) { e = mix(OIII, BLUE, 0.5) * 0.02; return; }
    if (r > 1.14 * base) return;
    vec3 q = u * 2.6 + uSeed;
    float rip1 = fbm(q * 1.3, 2), rip2 = snoise(q * 2.9 + 5.0);
    float R1 = base * (1.0 + 0.07 * rip1 + 0.035 * rip2);
    float R2 = base * (0.9 + 0.08 * fbm(q * 1.7 + 11.0, 2) + 0.03 * rip2);
    float R3 = base * (0.8 + 0.1 * fbm(q * 2.3 + 23.0, 2));
    float w = gSheetW;
    float s1 = exp(-sq((r - R1) / w)), s2 = exp(-sq((r - R2) / w)), s3 = exp(-sq((r - R3) / (w * 1.3)));
    float dense = 0.7 + 0.5 * side;
    float p1 = smoothstep(-0.4, 0.55, snoise(u * 2.0 + uSeed)) * dense;
    float p2 = smoothstep(-0.15, 0.6, snoise(u * 2.4 + uSeed + 7.0)) * dense;
    float p3 = smoothstep(0.0, 0.65, snoise(u * 2.8 + uSeed + 13.0)) * dense;
    // the sheets are far thinner than the march resolves: the limb brightening of a thin sheet
    // (path length ∝ 1/cos) is applied explicitly
    float tang = 0.4 / (abs(dot(gDir, u)) + 0.12);
    // thread-like structure running along the sheets
    float f1 = 0.35 + 1.3 * pow(1.0 - abs(snoise(u * 7.0 + uSeed * 1.3)), 3.0);
    float f2 = 0.35 + 1.3 * pow(1.0 - abs(snoise(u * 9.0 + uSeed * 1.7 + 3.0)), 3.0);
    float f3 = 0.5 + 0.8 * (snoise(u * 6.0 + uSeed) * 0.5 + 0.5);
    vec3 red = mix(HALPHA, SII, 0.35), cyan = mix(OIII, BLUE, 0.45), teal = mix(OIII, uColor, 0.5);
    e = (red * s1 * p1 * f1 + cyan * s2 * p2 * f2 * 0.8 + teal * s3 * p3 * f3 * 0.5) * 14.0 * tang;
    e += mix(OIII, BLUE, 0.5) * 0.02 * (1.0 - smoothstep(0.45, 0.85, r));
    return;
  }
  if (uKind > 1.5) {
    // planetary: a thin bright shell (bipolar lobes), patchy with cometary knots, the [O III] teal
    // fill inside, the low-ionisation Hα / [N II] red rim just outside, a faint older halo
    vec3 u = p / max(r, 1e-4);
    float mu = abs(dot(u, uAxis));
    float lobe = 1.0 + uBipolar * 0.75 * pow(mu, 4.0);
    float ang = fbm(u * 3.0 + uSeed, 3);                 // the shell is not a perfect sphere
    float shellR = 0.7 * lobe * (1.0 + 0.05 * ang);
    float x = r / shellR;
    vec3 q = warp(p * 3.0, 0.2);
    float n = fbm4(q * 2.0) * 0.5 + 0.5;
    float equator = 1.0 - uBipolar * 0.45 * mu;
    float w = max(0.06, gSheetW / shellR);
    float patchy = 0.35 + 0.9 * smoothstep(-0.5, 0.6, snoise(u * 4.0 + uSeed * 0.7));
    float shell = exp(-sq((x - 1.0) / w)) * (0.45 + n) * equator * patchy;
    float knots = pow(1.0 - abs(snoise(u * 12.0 + uSeed)), 6.0) * exp(-sq((x - 0.97) / (w * 1.5))) * equator;
    float inner = (1.0 - smoothstep(0.45, 1.0, x)) * 0.07 * (0.7 + 0.6 * n);
    float rim = exp(-sq((x - 1.1) / (w * 1.2))) * patchy * (0.5 + n);
    float halo = exp(-sq((x - 1.35) / 0.2)) * 0.05;
    float tang = 0.45 / (abs(dot(gDir, u)) + 0.15);
    e = mix(OIII, uColor, 0.25) * (inner + (shell * 0.9 + knots * 0.6) * tang) + mix(HALPHA, uColor, 0.3) * (rim * 1.1 * tang + halo) + mix(SII, HALPHA, 0.5) * knots * 0.5 * tang;
    e *= 3.2;
    k = uDust * 0.5 * knots;
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
  // the medium ends at r = 1.3 whatever the kind: march the sphere's chord, not the box's
  // (half the samples, and a finer step for the thin shells)
  vec2 hit = sphereHit(uOrigin, d, 1.3);
  if (hit.y <= hit.x || uFade <= 0.0) { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }
  // uSteps is the budget of the full diameter: a constant step length, so the short chords
  // (the limb, and every ray once the camera is inside) take only the samples they need
  float t0 = hit.x, t1 = hit.y;
  int N = int(clamp(ceil((t1 - t0) * uSteps / 2.6), 4.0, uSteps));
  float jit = stepJitter();
  vec3 L = vec3(0.0);
  float T = 1.0;
  float dt = (t1 - t0) / float(N);
  gSheetW = max(0.03, dt * 0.75);
  gDir = d;
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
