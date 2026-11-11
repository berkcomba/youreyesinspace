// Screen-space gravitational lensing + accretion disk for one Schwarzschild black hole.
// Units: Schwarzschild radius r_s = 1. Camera space: +x right, +y up, −z forward.
uniform sampler2D tDiffuse;
uniform float uTanHalfFov;
uniform float uAspect;
uniform vec3 uBHPos;        // camera-space position of the black hole (r_s)
uniform vec3 uDiskNormal;   // camera-space disk axis (unit); the gas orbits prograde about it
uniform vec3 uDiskRef;      // camera-space unit vector in the disk plane, fixed in the world: azimuth 0
uniform float uDiskInner;   // r_s
uniform float uDiskOuter;   // r_s
uniform float uDiskTemp;    // K, the hottest ring of the disk (just outside the inner edge)
uniform float uDiskBright;  // display gain; 0 = no disk
uniform float uRegionAngle; // rays within this angle of the hole are ray-traced; outside: weak-field lens
// The gas pattern is carried round by the orbital motion, faster inside (Ω ∝ r^-3/2). Left alone
// that winds any pattern into an ever tighter spiral, so two layers take turns: each is born
// unsheared, is wound for a while and fades out as the other, half a life behind, takes over.
// Per layer: (angle the inner edge has turned since the layer was born, noise offset, weight).
uniform vec3 uFlow[2];
uniform float uSeed;
uniform float uQuality;     // 1 = full ray march; < 1 = fewer, longer steps (mobile)
uniform float uPixAngle;    // angle one pixel subtends (rad)

varying vec2 vUv;

const float PI = 3.14159265359;

vec3 rayDir(vec2 uv) {
  vec2 n = uv * 2.0 - 1.0;
  return normalize(vec3(n.x * uTanHalfFov * uAspect, n.y * uTanHalfFov, -1.0));
}

// background colour in a camera-space direction (black outside the frustum)
vec3 background(vec3 v) {
  if (v.z >= -1e-4) return vec3(0.0);
  vec2 s = vec2(v.x / (-v.z) / (uTanHalfFov * uAspect), v.y / (-v.z) / uTanHalfFov);
  vec2 uv = s * 0.5 + 0.5;
  if (any(lessThan(uv, vec2(0.0))) || any(greaterThan(uv, vec2(1.0)))) return vec3(0.0);
  return texture2D(tDiffuse, uv).rgb;
}

// geodesic equation in u = 1/r:  u'' = -u + 1.5 u²
vec2 geo(vec2 s) { return vec2(s.y, -s.x + 1.5 * s.x * s.x); }

vec2 rk4(vec2 s, float h) {
  vec2 k1 = geo(s);
  vec2 k2 = geo(s + 0.5 * h * k1);
  vec2 k3 = geo(s + 0.5 * h * k2);
  vec2 k4 = geo(s + h * k3);
  return s + h / 6.0 * (k1 + 2.0 * k2 + 2.0 * k3 + k4);
}

// Energy a thin disk around a non-spinning hole radiates per unit area (Shakura–Sunyaev with a
// zero-torque inner edge): ∝ r^-3 (1 − sqrt(r_in / r)), here 1 at its peak, r = 49/36 r_in.
float diskFlux(float r) {
  float x = clamp(uDiskInner / r, 0.0, 1.0);
  return x * x * x * (1.0 - sqrt(x)) / 0.05666;
}

// Visible-light (550 nm) radiance of a black body, Planck's law without the constants
float planck(float T) {
  return 1.0 / (exp(min(26160.0 / max(T, 300.0), 80.0)) - 1.0);
}

// One generation of the turbulence: streaks far longer along the orbit than across it, as shear
// makes them. `a` is the azimuth in the frame turning with the gas, `lr` = ln(r / r_in),
// `wind` how tightly the differential rotation has wound this layer so far, `res` the radius
// over the pixel footprint: an octave finer than the pixels is left out instead of shimmering.
float gasLayer(float lr, float a, float off, float wind, float res) {
  float ca = cos(a), sa = sin(a);
  float n = 0.0;
  // (turns of the cylinder, radial frequency, amplitude)
  n += smoothstep(0.8, 2.2, res / (4.5 + 1.3 * wind)) * snoise(vec3(ca * 1.3, sa * 1.3, lr * 4.5 + off));
  n += smoothstep(0.8, 2.2, res / (11.0 + 3.1 * wind)) * 0.62 * snoise(vec3(ca * 3.1, sa * 3.1, lr * 11.0 + off * 1.7 + 7.0));
  n += smoothstep(0.8, 2.2, res / (25.0 + 7.3 * wind)) * 0.36 * snoise(vec3(ca * 7.3, sa * 7.3, lr * 25.0 + off * 2.3 + 19.0));
  if (uQuality > 0.75) n += smoothstep(0.8, 2.2, res / (56.0 + 17.0 * wind)) * 0.2 * snoise(vec3(ca * 17.0, sa * 17.0, lr * 56.0 + off * 3.1 + 41.0));
  return n;
}

// The gas at radius r, azimuth az (disk frame):
// (column density relative to the mean, temperature factor, brightness factor)
vec3 diskGas(float r, float az, float foot) {
  float x = uDiskInner / r;
  float lr = -log(x);
  float kepler = x * sqrt(x);
  float acc = 0.0, wsum = 0.0;
  for (int k = 0; k < 2; k++) {
    vec3 f = uFlow[k];
    float n = gasLayer(lr, az - f.x * kepler, f.y + uSeed, 1.5 * abs(f.x) * kepler, r / max(foot, 1e-5));
    acc += f.z * n;
    wsum += f.z * f.z;
  }
  // two unrelated patterns averaged are flatter than either: keep the contrast through the hand-over
  float n = acc / sqrt(max(wsum, 1e-4));
  // turbulent gas is log-normal: thin bright filaments, wide dim lanes
  float dens = exp(1.0 * n - 0.25);
  // a ragged outer rim, and no gas to speak of inside the last stable orbit (it falls in within one turn)
  float rim = 1.0 - smoothstep(uDiskOuter * 0.6, uDiskOuter, r * (1.0 + 0.09 * n));
  float inner = smoothstep(uDiskInner, uDiskInner * 1.22, r);
  // The dense filaments are where the turbulence is dumping its heat: hotter, and brighter. The
  // brightness is given apart from the temperature because a hot disk's visible light barely
  // answers to temperature (Rayleigh–Jeans tail), and its filaments would wash out.
  return vec3(dens * rim * rim * inner, 1.0 + 0.12 * n, exp(0.5 * n));
}

void main() {
  vec3 base = texture2D(tDiffuse, vUv).rgb;
  vec3 d = rayDir(vUv);
  float D = length(uBHPos);
  vec3 toBH = uBHPos / D;
  float cosT = clamp(dot(d, toBH), -1.0, 1.0);
  float theta = acos(cosT);

  if (theta > uRegionAngle) {
    // Weak-field lens: the observed direction θ came from a source at β = θ − θ_E²/θ
    float thetaE2 = 2.0 / D;
    float delta = thetaE2 / max(theta, 1e-4);
    if (delta < 1e-5 || (uBHPos.z > 0.0 && theta > PI * 0.5)) { gl_FragColor = vec4(base, 1.0); return; }
    vec3 perp = normalize(toBH - cosT * d); // in-plane direction from d toward the hole
    vec3 src = normalize(d * cos(delta) + perp * sin(delta));
    gl_FragColor = vec4(background(src), 1.0);
    return;
  }

  // ---- null geodesic in the plane spanned by the camera–hole line and the ray ----
  vec3 e1 = -toBH;                       // radial unit vector at the camera
  vec3 e2 = d - dot(d, e1) * e1;
  float tang = length(e2);
  if (tang < 1e-5) { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; } // straight into the hole
  e2 /= tang;
  float radial = dot(d, e1);

  vec2 s = vec2(1.0 / D, -radial / (D * tang)); // (u, du/dφ)
  float phi = 0.0;
  vec3 col = vec3(0.0);
  float trans = 1.0;                      // remaining transparency
  float escapeU = min(0.5 / D, 1.0 / 60.0);

  // The ray's height above the disk is r(φ)·(A cos φ + B sin φ): it meets the disk plane exactly
  // at φ = atan(−A / B) + kπ, so the crossings need no searching (and show no step pattern)
  float A = dot(e1, uDiskNormal), B = dot(e2, uDiskNormal);
  float nextCross = 1e9;
  if (uDiskBright > 0.0 && abs(A) + abs(B) > 1e-6) {
    nextCross = atan(-A, B);
    nextCross -= PI * floor(nextCross / PI);
    if (nextCross < 1e-3) nextCross += PI;
  }
  float tPeak = planck(uDiskTemp);
  bool captured = false;
  bool escaped = false;

  float maxSteps = 260.0 * uQuality;
  for (int i = 0; i < 260; i++) {
    if (float(i) >= maxSteps) break;
    float h = mix(0.12, 0.03, smoothstep(0.0, 0.7, s.x)) / uQuality;
    vec2 sn = rk4(s, h);
    float phiN = phi + h;
    if (phiN >= nextCross) {
      vec2 sc = rk4(s, nextCross - phi);
      float rc = 1.0 / max(sc.x, 1e-4);
      if (sc.x < 1.0 && rc > uDiskInner && rc < uDiskOuter) {
        float cp = cos(nextCross), sp = sin(nextCross);
        vec3 er = cp * e1 + sp * e2;        // radial unit vector at the crossing
        vec3 ep = cp * e2 - sp * e1;        // direction of increasing φ
        float lapse = sqrt(1.0 - sc.x);
        float dr = -sc.y / (sc.x * sc.x);   // dr/dφ
        // photon direction toward the observer, as a static observer at the crossing measures it
        vec3 kPh = -normalize(dr / lapse * er + rc * ep);
        // circular orbit: v = sqrt(M / (r − 2M)), half the speed of light at the last stable orbit
        vec3 vel = cross(uDiskNormal, er);
        float v = min(0.95, sqrt(0.5 / (rc - 1.0)));
        // frequency shift: gravitational redshift × Doppler
        float g = lapse * sqrt(1.0 - v * v) / (1.0 - v * dot(vel, kPh));
        float mu = abs(dot(kPh, uDiskNormal));
        float az = atan(dot(er, cross(uDiskNormal, uDiskRef)), dot(er, uDiskRef));
        // Pixel footprint on the disk, measured along the radius (the streaks run along the orbit,
        // so that is the direction the detail is in): foreshortened only where the line of sight
        // lies along the radius. The images that went round the hole are squeezed many times over.
        vec3 kIn = kPh - uDiskNormal * dot(kPh, uDiskNormal);
        float along = dot(kIn, er);
        float foot = uPixAngle * length(rc * er - D * e1) * sqrt(1.0 + along * along / max(mu * mu, 0.01))
          * (1.0 + 14.0 * smoothstep(0.8 * PI, 1.7 * PI, nextCross));
        vec3 gas = diskGas(rc, az, foot);
        // An optically thick disk shines as a black body, and a black body seen with every
        // frequency shifted by g is exactly a black body g times as hot: the Doppler beaming,
        // the redshift and the colour change all follow from the one temperature.
        float Trel = pow(diskFlux(rc), 0.25) * gas.y * g;
        float L = planck(uDiskTemp * Trel) / tPeak;
        // Colour: a few r_s of disk span less than a factor two in temperature, a real one a
        // thousand. The colour temperature is stretched so the picture reads as the whole disk
        // does: white-hot inside, red outside, bluer where the gas comes at us.
        // blackbody() is a display-referred tint; raise it so the oranges survive tone mapping.
        vec3 em = pow(blackbody(uDiskTemp * pow(Trel, 2.1)), vec3(1.8)) * pow(L, 0.62) * gas.z * uDiskBright;
        // limb darkening of a scattering atmosphere
        em *= (1.0 + 2.06 * mu) / 3.06;
        // the gas is a thin slab: the longer the path through it, the more opaque
        float opacity = 1.0 - exp(-2.4 * gas.x / max(mu, 0.06));
        col += trans * opacity * em;
        trans *= 1.0 - opacity;
      }
      nextCross += PI;
    }
    if (sn.x > 1.0) { captured = true; break; }
    s = sn; phi = phiN;
    if (trans < 0.03) break;
    if (s.x < escapeU && s.y < 0.0) { escaped = true; break; }
    if (phi > 3.0 * PI) { captured = true; break; }
  }

  vec3 bg = vec3(0.0);
  if (escaped || (!captured && trans >= 0.03)) {
    // outgoing direction = d(position)/dφ
    float r = 1.0 / s.x;
    float dr = -s.y / (s.x * s.x);
    vec3 outDir = normalize(dr * (cos(phi) * e1 + sin(phi) * e2) + r * (-sin(phi) * e1 + cos(phi) * e2));
    bg = background(outDir);
    // higher-order images (rays that looped around the hole) are dimmed: with a sprite-based
    // background they would otherwise turn into a noisy moiré band at the photon ring
    bg *= 1.0 - 0.7 * smoothstep(1.4 * PI, 2.2 * PI, phi);
  }
  gl_FragColor = vec4(col + trans * bg, 1.0);
}
