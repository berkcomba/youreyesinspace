#include <logdepthbuf_pars_fragment>

uniform vec3 uColor;
uniform vec3 uColor2;
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
  float px = fwidth(r01);
  float dens = ringDensityAA(r01, uSeed, uGaps, px);
  // very fine azimuth-independent grooves (faded out where they would be finer than a pixel)
  dens *= 0.85 + 0.15 * snoise(vec3(r01 * 1800.0, uSeed, 1.0)) * ringBand(1800.0, px);
  float alpha = dens * uOpacity;
  if (alpha < 0.003) discard;

  vec3 P = vWorldPos;
  vec3 V = normalize(-P);
  // seen obliquely, the line of sight crosses the sheet along a longer path: α = 1 − e^(−τ/μ)
  alpha = 1.0 - pow(1.0 - min(alpha, 0.999), 1.0 / max(abs(dot(uNormal, V)), 0.05));
  if (uLocalFade.x > 0.0) {
    float q = length(P) / uLocalFade.y;
    alpha *= 1.0 - uLocalFade.x * exp(-q * q);
  }
  vec3 L = normalize(uSunPos - P);
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
  // Faint rings are mostly micron-sized dust, which scatters forward (Henyey–Greenstein, g ≈ 0.7):
  // seen against the Sun they light up many times over, as Jupiter's ring and Saturn's E ring do
  // (Uranus' narrow rings, 0.35, are dust-poor boulders; Neptune's, 0.25, largely dust)
  float dusty = 1.0 - smoothstep(0.22, 0.4, uOpacity);
  float g = 0.7;
  float fwd = dusty * 0.3 * (1.0 - g * g) / pow(1.0 + g * g - 2.0 * g * dot(-L, V), 1.5);
  // colour variation with radius (icy vs dusty)
  // two materials in alternating bands (clean ice against tholin-stained, rock against frost)
  float band = smoothstep(-0.25, 0.35, snoise(vec3(r01 * 7.0, uSeed * 1.7, 5.0)) + 0.5 * snoise(vec3(r01 * 23.0, uSeed, 7.0)) * ringBand(23.0, px));
  vec3 tint = mix(uColor, uColor2, band) * (0.85 + 0.3 * snoise(vec3(r01 * 12.0, uSeed * 2.0, 3.0)) * ringBand(12.0, px));
  tint = mix(tint, tint * vec3(0.9, 0.8, 0.7), smoothstep(0.0, 0.2, r01) * (1.0 - smoothstep(0.2, 0.4, r01)) * 0.5);

  vec3 col = (tint * fillLit((direct + back + fwd) * shadow) + tint * 0.003) * uSunColor;
  gl_FragColor = vec4(col, alpha * uAlpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
