#include <logdepthbuf_pars_fragment>

uniform vec3 uColor;        // ring material colour
uniform vec3 uPlaneNormal;  // ring plane normal (world)

varying vec3 vNormal;
varying vec3 vWorldPos;
varying float vAlpha;
varying vec3 vTint;

void main() {
  #include <logdepthbuf_fragment>
  if (vAlpha < 0.004) discard;

  vec3 P = vWorldPos;
  vec3 N = normalize(vNormal);
  vec3 L = normalize(uSunPos - P);
  vec3 V = normalize(-P);

  float sunAng = uSunRadius / max(length(uSunPos - P), 1.0);
  float shadow = sphereShadow(P, L, uBodyPos, uBodyRadius, sunAng);
  for (int i = 0; i < 4; i++) {
    if (uOccluders[i].w > 0.0) shadow *= sphereShadow(P, L, uOccluders[i].xyz, uOccluders[i].w, sunAng);
  }

  float diffuse = max(dot(N, L), 0.0);
  // the ring sheet itself is a soft secondary light from both faces
  float sheet = 0.18 * (0.5 + 0.5 * abs(dot(N, uPlaneNormal)));
  // planet-shine from the lit side of the planet
  vec3 toPlanet = normalize(uBodyPos - P);
  float planetShine = 0.12 * max(dot(N, toPlanet), 0.0) * max(dot(-toPlanet, L) * 0.5 + 0.5, 0.0);
  // opposition surge: ring particles brighten sharply near zero phase angle
  float phase = max(dot(L, V), 0.0);
  float surge = 0.25 * pow(phase, 24.0);

  vec3 albedo = uColor * vTint;
  vec3 col = albedo * uSunColor * (fillLit(diffuse) * (1.0 + surge) * shadow + sheet * shadow + planetShine) * uAlpha;

  gl_FragColor = vec4(col, vAlpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
