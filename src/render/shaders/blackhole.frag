// Screen-space gravitational lensing + accretion disk for one Schwarzschild black hole.
// Units: Schwarzschild radius r_s = 1. Camera space: +x right, +y up, −z forward.
uniform sampler2D tDiffuse;
uniform float uTanHalfFov;
uniform float uAspect;
uniform vec3 uBHPos;        // camera-space position of the black hole (r_s)
uniform vec3 uDiskNormal;   // camera-space disk axis (unit)
uniform float uDiskInner;   // r_s
uniform float uDiskOuter;   // r_s
uniform float uDiskTemp;    // K at the inner edge
uniform float uDiskBright;  // 0 = no disk
uniform float uRegionAngle; // rays within this angle of the hole are ray-traced; outside: weak-field lens
uniform float uTime;
uniform float uSeed;

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

// disk emission at radius r, azimuth phi (disk frame); returns linear RGB
vec3 diskEmission(float r, float phi) {
  float x = uDiskInner / r;
  // Shakura–Sunyaev-like temperature profile, hot inner edge
  float T = uDiskTemp * pow(x, 0.75);
  float I = pow(x, 1.5) * (1.0 - 0.6 * sqrt(uDiskInner / max(r, uDiskInner)));
  // turbulent streaks that rotate faster inside (Keplerian shear)
  float omega = 0.9 / pow(r, 1.5);
  // keep trig arguments small: GPU sin/cos lose precision past a few thousand radians
  float a = phi - mod(uTime * omega * 25.0, 2.0 * PI);
  float n = snoise(vec3(cos(a) * r * 0.9, sin(a) * r * 0.9, uSeed + r * 0.35 + mod(uTime, 50.0) * 0.02));
  float n2 = snoise(vec3(cos(a * 3.0) * r * 1.7, sin(a * 3.0) * r * 1.7, uSeed * 1.7 + 11.0));
  float streaks = 0.75 + 0.35 * n + 0.2 * n2;
  // fade in from the inner edge, soft outer edge
  float edge = smoothstep(uDiskInner, uDiskInner * 1.12, r) * (1.0 - smoothstep(uDiskOuter * 0.72, uDiskOuter, r));
  // blackbody() is a display-referred tint; square it so the oranges survive tone mapping
  vec3 tint = pow(blackbody(T), vec3(2.0));
  return tint * I * streaks * edge * 6.0;
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

  // disk-plane height of the current point
  vec3 p = e1 * D;
  float hPrev = dot(p, uDiskNormal);
  bool captured = false;
  bool escaped = false;

  for (int i = 0; i < 260; i++) {
    float h = mix(0.12, 0.03, smoothstep(0.0, 0.7, s.x));
    vec2 sn = rk4(s, h);
    float phiN = phi + h;
    if (sn.x > 1.0) { captured = true; break; }
    float rN = 1.0 / sn.x;
    vec3 pN = rN * (cos(phiN) * e1 + sin(phiN) * e2);
    if (uDiskBright > 0.0) {
      float hN = dot(pN, uDiskNormal);
      if (hN * hPrev < 0.0) {
        // crossing of the disk plane: interpolate the radius
        float f = hPrev / (hPrev - hN);
        vec3 pc = mix(p, pN, f);
        float rc = length(pc);
        if (rc > uDiskInner && rc < uDiskOuter) {
          // Keplerian velocity and relativistic Doppler + gravitational shift
          vec3 radialDir = pc / rc;
          vec3 vel = normalize(cross(uDiskNormal, radialDir));
          float v = sqrt(0.5 / rc);
          vec3 kPh = -normalize(pN - p);      // photon direction toward the observer
          float gamma = 1.0 / sqrt(1.0 - v * v);
          float g = sqrt(max(1.0 - 1.0 / rc, 0.0)) / (gamma * (1.0 - v * dot(vel, kPh)));
          // azimuth in the disk frame
          vec3 ref = normalize(cross(uDiskNormal, abs(uDiskNormal.y) < 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0)));
          float az = atan(dot(pc, cross(uDiskNormal, ref)), dot(pc, ref));
          vec3 em = diskEmission(rc, az);
          // Doppler boosting (I ∝ g^3.5 for a visual compromise) and colour shift
          em *= pow(g, 3.5) * uDiskBright;
          em *= pow(blackbody(uDiskTemp * g) / max(blackbody(uDiskTemp), vec3(0.05)), vec3(1.5));
          float opacity = mix(0.985, 0.25, smoothstep(uDiskOuter * 0.55, uDiskOuter, rc));
          col += trans * em;
          trans *= 1.0 - opacity;
        }
      }
      hPrev = dot(pN, uDiskNormal);
    }
    s = sn; phi = phiN; p = pN;
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
