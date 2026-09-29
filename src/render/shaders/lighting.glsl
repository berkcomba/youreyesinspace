// ---------------------------------------------------------------------------
// Shared lighting uniforms & shadow evaluation for body surfaces.
// Camera is always at the origin (floating origin), positions are km.
// ---------------------------------------------------------------------------
uniform vec3 uSunPos;
uniform float uSunRadius;
uniform vec3 uSunColor;       // normalised star light colour (1,1,1 for a G2V star)
uniform vec3 uBodyPos;
uniform float uBodyRadius;
uniform vec4 uOccluders[4];   // xyz = position, w = radius (0 = none)
uniform vec4 uRing;           // inner, outer, opacity, seed  (inner<=0 => no ring)
uniform vec3 uRingNormal;
uniform vec4 uRingGaps[4];

float sunAngularRadius(vec3 P) {
  return uSunRadius / max(length(uSunPos - P), 1.0);
}

// Returns fraction of sunlight reaching P (0..1)
float shadowAt(vec3 P, vec3 L) {
  float s = 1.0;
  float sunAng = sunAngularRadius(P);
  for (int i = 0; i < 4; i++) {
    if (uOccluders[i].w <= 0.0) continue;
    s *= sphereShadow(P, L, uOccluders[i].xyz, uOccluders[i].w, sunAng);
  }
  if (uRing.x > 0.0) {
    float denom = dot(L, uRingNormal);
    if (abs(denom) > 1e-5) {
      float t = dot(uBodyPos - P, uRingNormal) / denom;
      if (t > 0.0) {
        vec3 hit = P + L * t;
        float r = length(hit - uBodyPos);
        float r01 = (r - uRing.x) / (uRing.y - uRing.x);
        float d = ringDensity(r01, uRing.w, uRingGaps) * uRing.z;
        s *= 1.0 - d * 0.92;
      }
    }
  }
  return s;
}
