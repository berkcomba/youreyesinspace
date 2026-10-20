#include <logdepthbuf_pars_fragment>

uniform vec3 uColor;
uniform float uOpacity;
uniform float uSeed;
uniform float uInner;
uniform float uOuter;
uniform vec4 uGaps[4];
uniform vec3 uNormal;   // ring plane normal (world)
uniform vec2 uLocalFade; // x = strength 0..1, y = radius (km): thin the sheet around a camera inside the ring, where boulders take over

varying vec3 vWorldPos;
varying float vRadius;

void main() {
  #include <logdepthbuf_fragment>

  float r01 = (vRadius - uInner) / (uOuter - uInner);
  float dens = ringDensity(r01, uSeed, uGaps);
  // very fine azimuth-independent grooves
  dens *= 0.85 + 0.15 * snoise(vec3(r01 * 1800.0, uSeed, 1.0));
  float alpha = dens * uOpacity;
  if (alpha < 0.003) discard;

  vec3 P = vWorldPos;
  if (uLocalFade.x > 0.0) {
    float q = length(P) / uLocalFade.y;
    alpha *= 1.0 - uLocalFade.x * exp(-q * q);
  }
  vec3 L = normalize(uSunPos - P);
  vec3 V = normalize(-P);
  float sunAng = uSunRadius / max(length(uSunPos - P), 1.0);
  float shadow = sphereShadow(P, L, uBodyPos, uBodyRadius, sunAng);

  float NdotL = dot(uNormal, L);
  float NdotV = dot(uNormal, V);
  bool sameSide = (NdotL * NdotV) > 0.0;
  // The sheet stands in for a layer many particles thick: multiple scattering keeps it from
  // going black at grazing illumination (Saturn near equinox has the Sun only a few degrees
  // above the plane), so the diffuse term has a floor instead of following cos(i) to zero.
  float lit = mix(0.5, 1.0, abs(NdotL));
  // Lit face: diffuse. Unlit face: light scattered through — the sparse regions (C ring,
  // Cassini division) transmit more than the dense B ring.
  float direct = sameSide ? lit : lit * mix(0.85, 0.5, dens);
  // Opposition surge / backscatter
  float back = pow(max(dot(-L, -V), 0.0), 3.0) * 0.15;
  // colour variation with radius (icy vs dusty)
  vec3 tint = uColor * (0.85 + 0.3 * snoise(vec3(r01 * 12.0, uSeed * 2.0, 3.0)));
  tint = mix(tint, tint * vec3(0.9, 0.8, 0.7), smoothstep(0.0, 0.2, r01) * (1.0 - smoothstep(0.2, 0.4, r01)) * 0.5);

  vec3 col = (tint * fillLit((direct + back) * shadow) + tint * 0.003) * uSunColor;
  gl_FragColor = vec4(col, alpha * uAlpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
