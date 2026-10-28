#include <logdepthbuf_pars_fragment>

// Plume parcels: fine dust and ice lit by the Sun — brightest when seen against it (forward
// scattering, as Enceladus' jets in Cassini's backlit views), dark in the body's shadow.
uniform vec3 uColor;
uniform float uIntensity;

varying vec3 vWorldPos;
varying float vAlpha;
varying float vT;

void main() {
  #include <logdepthbuf_fragment>
  if (vAlpha < 0.004) discard;
  vec2 d = gl_PointCoord - 0.5;
  float disc = 1.0 - smoothstep(0.15, 0.5, length(d));
  if (disc < 0.01) discard;

  vec3 P = vWorldPos;
  vec3 L = normalize(uSunPos - P);
  float sunAng = uSunRadius / max(length(uSunPos - P), 1.0);
  float shadow = sphereShadow(P, L, uBodyPos, uBodyRadius, sunAng);
  for (int i = 0; i < 4; i++) {
    if (uOccluders[i].w > 0.0) shadow *= sphereShadow(P, L, uOccluders[i].xyz, uOccluders[i].w, sunAng);
  }
  vec3 V = normalize(-P);                     // toward the camera
  float back = max(-dot(L, V), 0.0);          // Sun behind the plume
  float forward = pow(back, 5.0) * 3.0;
  float lit = (0.35 + 0.25 * max(dot(L, V), 0.0) + forward) * shadow + 0.015;
  vec3 col = uColor * uSunColor * fillLit(lit) * uAlpha;
  // the canopy thins toward its rim; the fresh column near the vent is densest
  float dens = mix(1.0, 0.55, vT);
  gl_FragColor = vec4(col, vAlpha * disc * dens * uIntensity * 0.26);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
