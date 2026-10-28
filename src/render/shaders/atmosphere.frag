#include <logdepthbuf_pars_fragment>

// Single-scattering atmosphere shell (Rayleigh-like, wavelength dependent).
// The scattering colour of the air is also its extinction spectrum: what is scattered toward us is
// blue (for Earth), what has travelled a long way through the air has lost its blue and arrives
// orange — the day-side limb, the twilight band and the sunset glow all come out of the same
// integral. For Mars (butterscotch air) the same maths gives its bluish sunsets.

uniform vec3 uSunPos;
uniform float uSunRadius;
uniform vec3 uSunColor;
uniform vec3 uBodyPos;
uniform float uBodyRadius;    // equatorial radius
uniform float uOuterRadius;   // equatorial radius of the shell's top
uniform vec3 uPole;           // the body's north pole (scene frame)
uniform float uPolarScale;    // equatorial / polar radius: the body (and its air) is an oblate ellipsoid
uniform vec3 uColor;
uniform vec3 uSunsetColor;
uniform float uDensity;
uniform vec4 uOccluders[4];
uniform float uAlpha;   // brightness (tours fade comparison bodies in/out)
uniform float uGround;  // 1 with the camera on the surface: the daytime sky dome

varying vec3 vWorldPos;

// Stretch along the pole turns the ellipsoid (and its shell) into spheres of equatorial radius;
// rays are intersected there, their parameters t stay valid in the real frame.
vec3 stretch(vec3 p) {
  return p + (uPolarScale - 1.0) * dot(p, uPole) * uPole;
}

// returns true if hit; t0 <= t1 (rd need not be unit length)
bool raySphere(vec3 oc, vec3 rd, float r, out float t0, out float t1) {
  float a = dot(rd, rd);
  float b = dot(oc, rd);
  float cc = dot(oc, oc) - r * r;
  float disc = b * b - a * cc;
  if (disc < 0.0) return false;
  float s = sqrt(disc);
  t0 = (-b - s) / a;
  t1 = (-b + s) / a;
  return true;
}

void main() {
  #include <logdepthbuf_fragment>

  vec3 rd = normalize(vWorldPos);
  vec3 ro = vec3(0.0);
  vec3 ocS = stretch(ro - uBodyPos), rdS = stretch(rd);
  float tOut0, tOut1;
  if (!raySphere(ocS, rdS, uOuterRadius, tOut0, tOut1)) discard;
  float tEntry = max(tOut0, 0.0);
  float tExit = tOut1;
  float tIn0, tIn1;
  // standing in a hollow below the ellipsoid, the ground is still right under our feet
  float rIn = min(uBodyRadius, length(ocS) * 0.99995);
  bool hitPlanet = raySphere(ocS, rdS, rIn, tIn0, tIn1) && tIn1 > 0.0;
  if (hitPlanet) tExit = min(tExit, max(tIn0, 0.0));
  float path = tExit - tEntry;
  if (path <= 0.0) discard;

  vec3 L = normalize(uSunPos - uBodyPos);
  float H = uOuterRadius - uBodyRadius;
  float R = uBodyRadius;

  // extinction spectrum = scattering colour, normalised so the strongest channel has depth tau0
  vec3 beta = pow(uColor / max(max(uColor.r, uColor.g), max(uColor.b, 1e-3)), vec3(1.4));
  float tau0 = uDensity * 0.22;         // vertical optical depth of the column (strongest channel)
  // density profile exp(-S·alt): scale height H/S — steep enough that the top of the shell holds
  // almost nothing (else the air 300 km up, sunlit with the Sun 20° below the horizon, glows all night)
  const float S = 7.0;
  float k = tau0 * S / H;               // per-km coefficient of the profile
  // horizontal air mass of this exponential atmosphere (Chapman): sqrt(πR/(2h)), h = H/S
  float X = sqrt(3.14159265 * R * S / (2.0 * H));

  float cosTheta = dot(rd, L);
  float rayleigh = 0.0596831 * (1.0 + cosTheta * cosTheta);            // 3/(16π)(1+cos²)
  float g = 0.72;
  float mie = 0.0795775 * (1.0 - g * g) / pow(1.0 + g * g - 2.0 * g * cosTheta, 1.5);   // HG, 1/(4π)
  // aerosol haze: a little, grey, forward-peaked (the bright halo toward the sun at the limb)
  vec3 betaM = vec3(0.06);

  const int STEPS = 10;
  float dt = path / float(STEPS);
  float sunAng = uSunRadius / max(length(uSunPos - uBodyPos), 1.0);
  float odView = 0.0;
  vec3 col = vec3(0.0);
  for (int i = 0; i < STEPS; i++) {
    float t = tEntry + path * (float(i) + 0.5) / float(STEPS);
    vec3 s = ro + rd * t;
    vec3 sS = stretch(s - uBodyPos);
    float rs = length(sS);
    vec3 up = sS / max(rs, 1e-3);
    float alt = (rs - R) / H;
    float dens = exp(-alt * S) * (1.0 - smoothstep(0.85, 1.0, alt));
    float mu = dot(up, L);

    // optical depth from the sample toward the sun
    float colAbove = tau0 * exp(-alt * S);
    float odSun;
    float light = 1.0;
    if (mu >= 0.0) {
      odSun = colAbove / (mu + 1.0 / X);
    } else {
      // the sun below the sample's horizon: the ray dips to a tangent altitude first; below the
      // ground it is cut (twilight softens the edge over a fraction of the shell)
      float b = rs * sqrt(max(1.0 - mu * mu, 0.0));
      float altT = (b - R) / H;
      // continuous with the lit branch at mu = 0 (altT = alt ≥ 0); the sun's angular size softens the edge
      light = smoothstep(-0.06, 0.0, altT);
      odSun = X * (2.0 * tau0 * exp(-max(altT, 0.0) * S) - colAbove);
    }
    odSun = min(odSun, 40.0);

    float shadow = 1.0;
    for (int j = 0; j < 4; j++) {
      if (uOccluders[j].w <= 0.0) continue;
      shadow *= sphereShadow(s, L, uOccluders[j].xyz, uOccluders[j].w, sunAng);
    }

    vec3 Tsun = exp(-beta * odSun);
    vec3 Tview = exp(-beta * odView);
    float seg = dens * k * dt;
    col += Tsun * Tview * (beta * rayleigh + betaM * mie) * seg * light * shadow;
    odView += seg;
  }

  // the sheet of light per unit solar irradiance → our surface convention (albedo·cosθ, no 1/π);
  // the ground dome is brighter: the whole sky is in view and the eye adapts to it
  col *= 5.5 * (1.0 + uGround * 0.3) * uSunColor;
  // authored sunset hue (data) nudges the reddened light, never replaces it
  float warm = clamp((col.r - col.b) / max(col.r + col.b, 1e-5), 0.0, 1.0);
  col *= mix(vec3(1.0), uSunsetColor / max(max(uSunsetColor.r, uSunsetColor.g), max(uSunsetColor.b, 1e-3)), warm * 0.3);

  gl_FragColor = vec4(col * uAlpha, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
