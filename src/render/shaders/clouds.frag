#include <logdepthbuf_pars_fragment>

uniform float uSeed;
uniform float uTime;
uniform vec3 uColor;
uniform float uCoverage;
uniform float uOpacity;

varying vec3 vObjPos;
varying vec3 vWorldPos;
varying vec3 vWorldNormal;

void main() {
  #include <logdepthbuf_fragment>

  vec3 p = normalize(vObjPos);
  float t = mod(uTime, 16384.0) * 0.01;   // wrapped: keeps the noise coordinates within float precision
  // Large-scale weather systems, stretched zonally (clouds_common.glsl)
  float cloud = cloudField(p, t, uSeed, 4);
  float threshold = 1.0 - uCoverage;
  float alpha = cloudAlpha(cloud, uCoverage) * uOpacity;
  if (alpha < 0.005) discard;

  vec3 P = vWorldPos;
  vec3 N = normalize(vWorldNormal);
  vec3 L = normalize(uSunPos - P);
  vec3 V = normalize(-P);
  float NdotL = dot(N, L);
  float shadow = shadowAt(P, L);
  float diffuse = fillLitV(max(NdotL, 0.0) * smoothstep(-0.1, 0.2, NdotL) * shadow, dot(N, V));
  // low sun: the deck is lit by reddened light
  vec3 sunlight = uSunColor * mix(vec3(1.0), vec3(1.0, 0.62, 0.38), smoothstep(0.35, -0.02, NdotL) * 0.8);
  // self-shadowing within the cloud deck
  float thick = smoothstep(threshold, 1.0, cloud);
  vec3 col = uColor * (0.55 + 0.45 * (1.0 - thick * 0.6)) * diffuse;
  // forward scattering: thin cloud edges glow when the sun is behind them
  float through = pow(max(dot(V, -L), 0.0), 6.0) * (1.0 - thick) * 0.35;
  col += uColor * through * shadow;
  // silver lining at the terminator / limb
  float rim = pow(1.0 - max(dot(N, V), 0.0), 3.0);
  col += uColor * rim * max(NdotL, 0.0) * 0.25;
  col += uColor * 0.002;
  col *= sunlight;

  gl_FragColor = vec4(col, alpha * uAlpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
