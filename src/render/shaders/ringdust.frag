#include <logdepthbuf_pars_fragment>

uniform vec3 uColor;        // ring material colour

varying vec3 vWorldPos;
varying float vAlpha;

void main() {
  #include <logdepthbuf_fragment>
  if (vAlpha < 0.004) discard;
  // round, soft speck
  vec2 d = gl_PointCoord - 0.5;
  float disc = 1.0 - smoothstep(0.2, 0.5, length(d));
  if (disc < 0.01) discard;

  vec3 P = vWorldPos;
  vec3 L = normalize(uSunPos - P);
  float sunAng = uSunRadius / max(length(uSunPos - P), 1.0);
  float shadow = sphereShadow(P, L, uBodyPos, uBodyRadius, sunAng);
  for (int i = 0; i < 4; i++) {
    if (uOccluders[i].w > 0.0) shadow *= sphereShadow(P, L, uOccluders[i].xyz, uOccluders[i].w, sunAng);
  }
  // an unresolved particle is lit on average half-way; opposition surge when the Sun is behind us
  vec3 V = normalize(-P);
  float phase = max(dot(L, V), 0.0);
  float lit = (0.55 + 0.45 * phase) * (1.0 + 0.3 * pow(phase, 24.0));
  vec3 col = uColor * uSunColor * fillLit(lit) * shadow * uAlpha;

  gl_FragColor = vec4(col, vAlpha * disc);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
