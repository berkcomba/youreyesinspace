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
uniform float uCoreFade;  // share of the bulge glow left, from the camera's depth in the core (GalaxyCloud)
uniform vec4 uBlobs[6];   // irregulars: centre, size
uniform float uBlobW[6];
uniform float uNBlobs;
// peculiar galaxies (src/galaxy/peculiar.ts): the host above is drawn in its own radius `uBody`
// (the uniforms above are in host radii), the rings and tails below in the whole galaxy's
uniform float uPec;       // 1: rings / tails / warp present
uniform float uBody;
uniform float uBend;
uniform float uPecFlat;   // 1: every component lies near the host's plane (mid-plane bunching still works)
uniform float uPecH;      // their thickness there
uniform float uDustR;     // components' dust opacity per unit length at profile 1
uniform vec4 uRingA[2];   // offset x, z, radius, width
uniform vec4 uRingB[2];   // thickness, cos/sin tilt azimuth, amplitude
uniform vec4 uRingC[2];   // cos/sin tilt, arc, bright side
uniform vec4 uRingD[2];   // spokes, spoke start, spoke width, young
uniform vec4 uRingE[2];   // knots, dust, inner / outer width
uniform vec4 uRingF[2];   // wobble, strands, twist, strand amplitude
uniform float uNRings;
uniform vec4 uTailA[2];   // phase, sweep, r0, r1
uniform vec4 uTailB[2];   // width start, end, lift, amplitude
uniform vec4 uTailC[2];   // young, knots, dust
uniform float uNTails;

const float BULGE_C = 0.5;
const float BULGE_CORE = 0.3;
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
void bodyAt(vec3 p, float t, float dt, out vec3 e, out float k) {
  e = vec3(0.0); k = 0.0;
  float r = length(p.xz);
  if (uType < 0.5) {
    float rr = length(vec2(r, p.y / max(0.3, uAxis))) / uBulge + 1e-3;
    e = OLD * 6.0 / (rr * pow(1.0 + rr, 3.0)) * uCoreFade;
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
  // the cusp is softened over a core (a few hundred pc): the column through the very centre
  // would otherwise be hundreds of times the disc's, a flat white disc at any exposure
  float rb = sqrt(dot(vec2(r, p.y / 0.6), vec2(r, p.y / 0.6)) / (uBulge * uBulge * BULGE_C * BULGE_C) + BULGE_CORE * BULGE_CORE);
  float bulge = 12.0 * (0.7 / 0.6) / (BULGE_C * BULGE_C * BULGE_C) / (rb * pow(1.0 + rb, 3.0));
  float base = exp(-(r - 0.5467) / uHs);
  if (r > 1.25) base *= exp(-(r - 1.25) / 0.1);
  float sy = abs(p.y) / uHz;
  e = OLD * bulge * uCoreFade;
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
  // the inner disc (and bar: several times the solar neighbourhood's density) dims with the core too, by less
  e += (DISC * oldDisc * clumpO + YOUNG * youngDisc * clumpY) * pow(uCoreFade, 0.75);
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

vec3 starColour(float young) {
  return mix(mix(OLD, DISC, clamp(young * 2.0, 0.0, 1.0)), YOUNG, clamp(young * 2.0 - 1.0, 0.0, 1.0));
}

// a component's stars: `f` its smooth density, `q` where to read its clumps (its own frame, so
// they ride along it), young / knots / dust its make-up, `prof` its unit-crest profile for the dust
void componentLight(float f, float prof, vec3 q, float young, float knots, float dust, float salt, float t, float dt, inout vec3 e, inout float k) {
  float n1 = snoise(q * 22.0 + uSeed + salt);
  float w2 = lod(60.0, dt);
  float n2 = w2 > 0.0 ? snoise(q * 60.0 - uSeed * 0.7 + salt) * w2 : 0.0;
  // star-forming complexes: a beaded string rather than a smooth band
  float clump = mix(0.9 + 0.1 * n1, clamp(0.45 + 0.85 * n1 + 0.35 * n2, 0.0, 2.6), knots);
  e += starColour(young) * f * clump;
  float hiiW = f * young * knots * smoothstep(uNear * 1.5, uNear * 4.0, t);
  if (hiiW > 1e-5) e += HII * hiiW * pow(max(snoise(q * 75.0 + uSeed * 2.3 + salt) + 0.3 * n2 + 0.2 * n1, 0.0), 3.0) * 7.0;
  if (dust > 0.0) {
    float fil = max(0.0, 0.4 + 0.6 * n1 + 0.35 * n2);
    k += uDustR * dust * prof * fil * fil;
  }
}

// a ring's strands (Peculiar.strand): F = wobble, count, twist, amplitude; x widths off the crest
float strandAt(vec4 F, float x, float phi) {
  if (F.y < 0.5) return 1.0;
  float c = 1.0 + cos(F.y * phi + F.z * x + 1.2 * sin(2.0 * phi + 0.5));
  float seg = 0.3 + 0.35 * (1.0 + sin(3.0 * phi + 2.1 + 0.9 * sin(5.0 * phi + 0.3)));
  return 1.0 + F.w * seg * exp(-0.5 * x * x) * (c * c / 1.5 - 1.0);
}

// rings and tidal tails (p in galaxy radii, host-local)
void pecAt(vec3 p, float t, float dt, inout vec3 e, inout float k) {
  for (int i = 0; i < 2; i++) {
    if (float(i) >= uNRings) break;
    vec4 A = uRingA[i], B = uRingB[i], C = uRingC[i], D = uRingD[i], E = uRingE[i], F = uRingF[i];
    float qx = p.x - A.x, qz = p.z - A.y;
    float x1 = B.y * qx + B.z * qz, z1 = -B.z * qx + B.y * qz;
    vec3 q = vec3(x1, C.x * p.y + C.y * z1, -C.y * p.y + C.x * z1);
    float v = exp(-q.y * q.y / (2.0 * B.x * B.x));
    if (v < 1e-4) continue;
    float rho = length(q.xz);
    float phi = rho > 1e-6 ? atan(q.z, q.x) : 0.0;
    // the width wobbles round the ring and its crest wanders (Peculiar.widthAt / crestAt)
    float wf = 1.0 + F.x * sin(3.0 * phi + 0.4);
    float dr = rho - (A.z + F.x * A.w * sin(2.0 * phi + 1.9));
    float sp = 0.0;
    if (D.x > 0.5 && rho > D.y && rho < A.z) {
      float kk = phi * D.x / 6.2831853;
      float across = rho * (kk - floor(kk + 0.5)) * 6.2831853 / D.x;
      float win = smoothstep(D.y, D.y + 0.06, rho) * (1.0 - smoothstep(A.z - 2.5 * A.w, A.z - A.w, rho));
      sp = exp(-across * across / (2.0 * D.z * D.z)) * win;
    }
    float ws = (dr < 0.0 ? E.z : E.w) * wf;
    if (abs(dr) > 4.5 * ws && sp < 1e-3) continue;
    float side = 1.0 - (1.0 - C.z) * 0.5 * (1.0 - cos(phi - C.w));
    float st = strandAt(F, dr / (A.w * wf), phi);
    float prof = exp(-dr * dr / (2.0 * ws * ws)) * side * st + 0.35 * sp;
    // the dust sits in a thinner layer than the stars
    float vd = exp(-q.y * q.y / (0.72 * B.x * B.x));
    // the strands are where the young stars are; between them the light is older
    float young = clamp(D.w * (0.75 + 0.25 * st), 0.0, 1.0);
    componentLight(B.w * v * prof, vd * prof, q, young, E.x, E.y, float(i) * 17.0, t, dt, e, k);
  }
  for (int i = 0; i < 2; i++) {
    if (float(i) >= uNTails) break;
    vec4 A = uTailA[i], B = uTailB[i], C = uTailC[i];
    float rho = length(p.xz);
    float dr = A.w - A.z;
    float s = (rho - A.z) / dr;
    if (s < -0.15 || s > 1.0) continue;
    float sc = max(s, 0.0);
    float w = mix(B.x, B.y, sc);
    float dd = atan(p.z, p.x) - (A.x + A.y * s);
    dd = atan(sin(dd), cos(dd));
    float across = rho * dd * dr / length(vec2(dr, rho * A.y));
    float dy = p.y - B.z * sc * sc;
    float g2 = (across * across + dy * dy) / (2.0 * w * w);
    if (g2 > 9.0) continue;
    float env = smoothstep(-0.15, 0.08, s) * pow(1.0 - clamp(s, 0.0, 1.0), 0.7);
    float prof = env * exp(-g2);
    componentLight(B.w * prof, prof, p, C.x, C.y, C.z, 41.0 + float(i) * 23.0, t, dt, e, k);
  }
}

void galaxyAt(vec3 p, float t, float dt, out vec3 e, out float k) {
  if (uPec < 0.5) { bodyAt(p, t, dt, e, k); return; }
  vec3 pb = p;
  // integral-sign warp: the rim rises on one side of the major axis and sinks on the other
  if (uBend != 0.0) { float r = length(p.xz); pb.y -= uBend * (r > 0.0 ? p.x / r : 0.0) * sq(max(0.0, r / uBody - 0.4) / 0.6); }
  bodyAt(pb / uBody, t, dt / uBody, e, k);
  pecAt(p, t, dt, e, k);
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
  bool planar = uPec > 0.5 ? uPecFlat > 0.5 : uType > 0.5 && uType < 3.5;
  bool bunch = !inside && planar && tc > t0 && tc < t1;
  float hz = uPec > 0.5 ? max(uType > 0.5 && uType < 3.5 ? uHz * uBody : 0.0, uPecH) : uHz;
  float a = max(hz * 1.5 / max(abs(d.y), 1e-3), (t1 - t0) * 0.02);
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
