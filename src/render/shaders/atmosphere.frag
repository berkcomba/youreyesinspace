#include <logdepthbuf_pars_fragment>

uniform vec3 uSunPos;
uniform float uSunRadius;
uniform vec3 uSunColor;
uniform vec3 uBodyPos;
uniform float uBodyRadius;
uniform float uOuterRadius;
uniform vec3 uColor;
uniform vec3 uSunsetColor;
uniform float uDensity;
uniform vec4 uOccluders[4];
uniform float uAlpha;   // brightness (tours fade comparison bodies in/out)

varying vec3 vWorldPos;

// returns true if hit; t0 <= t1
bool raySphere(vec3 ro, vec3 rd, vec3 c, float r, out float t0, out float t1) {
  vec3 oc = ro - c;
  float b = dot(oc, rd);
  float cc = dot(oc, oc) - r * r;
  float disc = b * b - cc;
  if (disc < 0.0) return false;
  float s = sqrt(disc);
  t0 = -b - s;
  t1 = -b + s;
  return true;
}

void main() {
  #include <logdepthbuf_fragment>

  vec3 rd = normalize(vWorldPos);
  vec3 ro = vec3(0.0);
  float tOut0, tOut1;
  if (!raySphere(ro, rd, uBodyPos, uOuterRadius, tOut0, tOut1)) discard;
  float tEntry = max(tOut0, 0.0);
  float tExit = tOut1;
  float tIn0, tIn1;
  bool hitPlanet = raySphere(ro, rd, uBodyPos, uBodyRadius, tIn0, tIn1) && tIn1 > 0.0;
  if (hitPlanet) tExit = min(tExit, max(tIn0, 0.0));
  float path = tExit - tEntry;
  if (path <= 0.0) discard;

  vec3 L = normalize(uSunPos - uBodyPos);
  float H = uOuterRadius - uBodyRadius;
  const int STEPS = 8;
  vec3 col = vec3(0.0);
  float sunAng = uSunRadius / max(length(uSunPos - uBodyPos), 1.0);
  for (int i = 0; i < STEPS; i++) {
    float t = tEntry + path * (float(i) + 0.5) / float(STEPS);
    vec3 s = ro + rd * t;
    vec3 up = normalize(s - uBodyPos);
    float alt = (length(s - uBodyPos) - uBodyRadius) / H;
    float dens = exp(-alt * 3.5) * (1.0 - smoothstep(0.85, 1.0, alt));
    float mu = dot(up, L);
    float light = smoothstep(-0.22, 0.25, mu);
    float shadow = 1.0;
    for (int k = 0; k < 4; k++) {
      if (uOccluders[k].w <= 0.0) continue;
      shadow *= sphereShadow(s, L, uOccluders[k].xyz, uOccluders[k].w, sunAng);
    }
    float sunset = smoothstep(0.3, -0.05, mu) * smoothstep(-0.3, 0.0, mu);
    // forward scattering brightens the limb toward the sun
    float forward = pow(max(dot(rd, L), 0.0), 8.0) * 0.6;
    vec3 c = mix(uColor, uSunsetColor, sunset * 0.7) * (1.0 + forward);
    col += c * dens * light * shadow;
  }
  // Optical depth scales with the path length through the shell relative to its thickness:
  // ~1 at the disc centre (thin haze), ~2*sqrt(2R/H) at the limb (bright rim).
  col *= (path / H) / float(STEPS) * uDensity * 0.16 * uSunColor;

  // soften extreme values
  col = col / (1.0 + col * 0.6);

  gl_FragColor = vec4(col * uAlpha, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
