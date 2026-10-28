// Volumetric galaxy: unresolved starlight (old disc, young arms, bulge, H II knots) and the dust
// that absorbs it, integrated along the view ray. Local units: galaxy radius = 1, Y = disc normal.
// The smooth stellar density is the same as GalaxyModel.density(), so uEmit (from its integral)
// gives the galaxy its catalogue luminosity.
uniform float uType;      // 0 E, 1 S0, 2 S, 3 SB, 4 Irr
uniform float uArms;
uniform float uTanPitch;
uniform float uR0;        // arm start radius
uniform float uPhase0;    // phase of arm 0
uniform float uMinorOdd;  // 1: odd arms are minor (barred, > 2 arms)
uniform float uBar;       // bar half-length (0: none)
uniform float uBulge;     // bulge scale radius
uniform float uHs;        // disc scale length
uniform float uHz;        // disc scale height
uniform float uAxis;      // ellipticals: b/a
uniform float uDust;      // dust opacity per unit length at reference density
uniform float uWarp;      // arm-phase distortion (lopsided, irregular arms)
uniform float uFloc;      // 0 grand design … 1 flocculent
uniform float uRing;      // inner ring at the bar's end
uniform float uNear;      // camera distance under which the procedural stars carry the light
uniform vec4 uBlobs[6];   // irregulars: centre, size
uniform float uBlobW[6];
uniform float uNBlobs;

const float BULGE_C = 0.5;
const vec3 OLD = vec3(1.0, 0.80, 0.58);
const vec3 DISC = vec3(1.0, 0.91, 0.78);
const vec3 YOUNG = vec3(0.62, 0.76, 1.0);
const vec3 HII = vec3(1.0, 0.34, 0.52);

float armDist(float r, float th) {
  float base = log(max(r, uR0) / uR0) / max(uTanPitch, 0.05);
  float best = 3.14159;
  for (int k = 0; k < 6; k++) {
    if (float(k) >= uArms) break;
    float w = (uMinorOdd > 0.5 && mod(float(k), 2.0) > 0.5) ? 0.4 : 1.0;
    float d = th - (base + 6.2831853 * float(k) / uArms + uPhase0);
    d = atan(sin(d), cos(d));
    best = min(best, abs(d) / w);
  }
  return best;
}

float sech2(float x) { float c = cosh(clamp(x, -15.0, 15.0)); return 1.0 / (c * c); }

// Weight of a noise octave of frequency f sampled every `dt` along the ray: once a step spans
// a couple of its periods the integral averages it to its mean (0), so it is not evaluated
float lod(float f, float dt) { return 1.0 - smoothstep(0.8, 2.0, f * dt); }

// e: emitted light (density units × colour), k: dust opacity; dt: step length here
void galaxyAt(vec3 p, float t, float dt, out vec3 e, out float k) {
  e = vec3(0.0); k = 0.0;
  float r = length(p.xz);
  if (uType < 0.5) {
    float rr = length(vec2(r, p.y / max(0.3, uAxis))) / uBulge + 1e-3;
    e = OLD * 6.0 / (rr * pow(1.0 + rr, 3.0));
    return;
  }
  if (uType > 3.5) {
    float d = 0.0;
    for (int b = 0; b < 6; b++) {
      if (float(b) >= uNBlobs) break;
      vec3 q = p - uBlobs[b].xyz; q.y *= 2.0;
      d += uBlobW[b] * exp(-dot(q, q) / (2.0 * uBlobs[b].w * uBlobs[b].w));
    }
    d *= 3.0;
    if (d < 1e-3) return;
    // a ragged outline and big star-forming complexes, not a smooth ball
    float shape = snoise(p * 2.2 + uSeed) * 0.6 + snoise(p * 5.0 - uSeed) * 0.3;
    float n1 = snoise(p * 9.0 + uSeed * 1.7);
    float body = smoothstep(-0.45, 0.35, shape);
    float complexes = pow(max(n1 + 0.4 * shape, 0.0), 2.0);
    e = DISC * d * body * 0.55 + YOUNG * d * (0.25 + 1.6 * complexes) * body;
    e += HII * d * pow(max(snoise(p * 14.0 + uSeed * 3.1) + 0.5 * n1, 0.0), 3.0) * 2.5 * body;
    k = uDust * 0.12 * d * body * max(0.0, 0.2 + n1);
    return;
  }
  // a more compact bulge than the model's (same light): a bright core instead of a sky-wide haze
  float rb = length(vec2(r, p.y / 0.6)) / (uBulge * BULGE_C) + 1e-3;
  float bulge = 12.0 * (0.7 / 0.6) / (BULGE_C * BULGE_C * BULGE_C) / (rb * pow(1.0 + rb, 3.0));
  float base = exp(-(r - 0.5467) / uHs);
  if (r > 1.25) base *= exp(-(r - 1.25) / 0.1);
  float sy = abs(p.y) / uHz;
  e = OLD * bulge;
  // far above the disc only the bulge / halo light matters
  if (sy > 9.0) return;
  float arm = 0.0, lane = 0.0, barMod = 1.0;
  if (uType > 1.5) {
    float th = atan(p.z, p.x) + uWarp * snoise(vec3(p.xz * 1.6, uSeed));
    float da = armDist(r, th);
    arm = exp(-da * da / 0.2312);
    // flocculent discs: short, broken arm segments instead of two clean spirals
    float floc = uFloc > 0.0 ? smoothstep(-0.1, 0.6, snoise(vec3(p.xz * 9.0, uSeed * 1.3)) + 0.5 * arm) : 0.0;
    arm = mix(arm, floc * (0.4 + 0.6 * arm), uFloc);
    // dust lanes trail on the inner (concave) edge of the arms
    float dl = armDist(r, th + 0.22);
    lane = mix(exp(-dl * dl / 0.06), floc, uFloc * 0.7);
    if (uBar > 0.0 && r < uBar) barMod = 0.6 + 2.5 * exp(-sq(p.z / (uBar * 0.25)));
    if (uRing > 0.0) { float ring = exp(-sq((r - max(uBar, uBulge) * 1.15) / 0.035)); arm = max(arm, ring * uRing); lane = max(lane, ring * uRing * 0.8); }
  }
  float oldDisc = base * sech2(sy) * (uType > 1.5 ? 0.55 : 1.0) * barMod;
  // young stars sit in a thinner layer (same column density)
  float youngDisc = uType > 1.5 ? base * 1.6 * arm * barMod * sech2(sy / 0.6) / 0.6 : 0.0;
  float dy = abs(p.y) / (uHz * 0.42);
  float dbase = 0.0;
  if (dy < 8.0) {
    dbase = exp(-(r - 0.5467) / (uHs * 1.25)) * sech2(dy) * smoothstep(uBulge * 0.3, uBulge * 1.6, r);
    if (r > 1.15) dbase *= exp(-(r - 1.15) / 0.07);
  }
  // nothing left here that the noise could shape
  if (oldDisc + youngDisc < 1e-5 && dbase < 1e-6) return;
  float n1 = snoise(p * 16.0 + uSeed);
  float w2 = lod(41.0, dt);
  float n2 = w2 > 0.0 ? snoise(p * 41.0 - uSeed * 0.7) * w2 : 0.0;
  // star clouds: the arms break up into clumps, the old disc only slightly
  float clumpY = clamp(0.62 + 0.45 * n1 + 0.3 * n2, 0.0, 2.0);
  float clumpO = 0.88 + 0.12 * n1;
  e += DISC * oldDisc * clumpO + YOUNG * youngDisc * clumpY;
  // H II regions: pink knots strung along the arms; nearby ones are landmarks of their own,
  // only distant ones are part of the glow
  float hiiW = youngDisc * smoothstep(uNear * 1.5, uNear * 4.0, t);
  if (hiiW > 1e-5) {
    float knots = pow(max(snoise(p * 70.0 + uSeed * 2.3) + 0.3 * n2, 0.0), 3.0);
    e += HII * hiiW * knots * 9.0;
  }
  // dust: thinner than the stars, concentrated in lanes, filamentary
  if (dbase > 1e-6) {
    float w3 = lod(110.0, dt);
    float n3 = w3 > 0.0 ? snoise(p * 110.0 + uSeed * 1.9) * w3 : 0.0;
    float fil = max(0.0, 0.45 + 0.55 * n1 + 0.4 * n2 + 0.25 * n3);
    float laneMod = uType > 1.5 ? 0.25 + 3.2 * lane + 0.6 * arm : 0.6;
    k = uDust * dbase * laneMod * fil * fil;
  }
}

void main() {
  vec3 d = viewRay();
  vec2 hit = boxHit(uOrigin, d, uBox);
  if (hit.y <= hit.x || uFade <= 0.0) { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }
  float t0 = hit.x, t1 = hit.y;
  int N = int(uSteps);
  float jit = stepJitter();
  bool inside = t0 <= 0.0;
  // inside: geometric steps (fine near the camera, coarse far away); outside a disc: samples
  // bunched around the mid-plane crossing (the dust lane is thin)
  float tmin = max(uNear * 0.05, 1e-4);
  float lg = log(max(t1, tmin * 1.01) / tmin);
  float tc = abs(d.y) > 1e-4 ? -uOrigin.y / d.y : -1.0;
  bool bunch = !inside && uType > 0.5 && uType < 3.5 && tc > t0 && tc < t1;
  float a = max(uHz * 1.5 / max(abs(d.y), 1e-3), (t1 - t0) * 0.02);
  float u0 = bunch ? asinh((t0 - tc) / a) : 0.0, u1 = bunch ? asinh((t1 - tc) / a) : 1.0;
  vec3 L = vec3(0.0);
  float T = 1.0;
  for (int i = 0; i < 160; i++) {
    if (i >= N) break;
    float u = (float(i) + jit) / float(N);
    float t, dt;
    if (inside) { t = tmin * exp(lg * u); dt = t * lg / float(N); }
    else if (bunch) { float uu = mix(u0, u1, u); t = tc + a * sinh(uu); dt = a * cosh(uu) * (u1 - u0) / float(N); }
    else { t = mix(t0, t1, u); dt = (t1 - t0) / float(N); }
    vec3 e; float k;
    galaxyAt(uOrigin + d * t, t, dt, e, k);
    float tau = k * dt;
    // the stars around the camera are drawn one by one: their share of the glow fades out
    L += T * e * dt * stepWeight(tau) * smoothstep(uNear * 0.3, uNear, t);
    T *= exp(-tau);
    if (T < 0.01) break;
  }
  gl_FragColor = vec4(L * uEmit * uFade, mix(1.0, T, uFade));
}
