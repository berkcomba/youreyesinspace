#include <logdepthbuf_pars_fragment>

uniform vec3 uColor;
uniform float uOpacity;
uniform float uSeed;
uniform float uInner;
uniform float uOuter;
uniform vec4 uGaps[4];
uniform vec3 uNormal;   // ring plane normal (world)

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
  vec3 L = normalize(uSunPos - P);
  vec3 V = normalize(-P);
  float sunAng = uSunRadius / max(length(uSunPos - P), 1.0);
  float shadow = sphereShadow(P, L, uBodyPos, uBodyRadius, sunAng);

  float NdotL = dot(uNormal, L);
  float NdotV = dot(uNormal, V);
  bool sameSide = (NdotL * NdotV) > 0.0;
  // Lit face: diffuse; unlit face: light transmitted through the (thin) ring
  float lit = abs(NdotL);
  float direct = sameSide ? lit : lit * 0.35 * (1.0 - dens * 0.6);
  // Opposition surge / backscatter
  float back = pow(max(dot(-L, -V), 0.0), 3.0) * 0.15;
  // colour variation with radius (icy vs dusty)
  vec3 tint = uColor * (0.85 + 0.3 * snoise(vec3(r01 * 12.0, uSeed * 2.0, 3.0)));
  tint = mix(tint, tint * vec3(0.9, 0.8, 0.7), smoothstep(0.0, 0.2, r01) * (1.0 - smoothstep(0.2, 0.4, r01)) * 0.5);

  vec3 col = (tint * (direct + back) * shadow + tint * 0.003) * uSunColor;
  gl_FragColor = vec4(col, alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
