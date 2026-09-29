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
  float t = uTime * 0.01;
  // Large-scale weather systems, stretched zonally
  vec3 q = vec3(p.x, p.y * 1.6, p.z) * 2.2 + uSeed;
  float base = fbm(q + vec3(t, 0.0, -t * 0.4), 5) * 0.5 + 0.5;
  float detail = fbm(p * 9.0 + uSeed * 1.7 + vec3(-t * 2.0, t, 0.0), 4) * 0.5 + 0.5;
  float swirl = fbm(p * 4.0 + vec3(0.0, t * 0.5, 0.0), 3);
  float cloud = base * 0.65 + detail * 0.35 + swirl * 0.12;
  float threshold = 1.0 - uCoverage;
  float alpha = smoothstep(threshold - 0.08, threshold + 0.25, cloud);
  alpha = pow(alpha, 1.2) * uOpacity;
  if (alpha < 0.005) discard;

  vec3 P = vWorldPos;
  vec3 N = normalize(vWorldNormal);
  vec3 L = normalize(uSunPos - P);
  vec3 V = normalize(-P);
  float NdotL = dot(N, L);
  float shadow = shadowAt(P, L);
  float diffuse = max(NdotL, 0.0) * smoothstep(-0.1, 0.2, NdotL) * shadow;
  // self-shadowing within the cloud deck
  float thick = smoothstep(threshold, 1.0, cloud);
  vec3 col = uColor * (0.55 + 0.45 * (1.0 - thick * 0.6)) * diffuse;
  // silver lining at the terminator / limb
  float rim = pow(1.0 - max(dot(N, V), 0.0), 3.0);
  col += uColor * rim * max(NdotL, 0.0) * 0.25;
  col += uColor * 0.002;
  col *= uSunColor;

  gl_FragColor = vec4(col, alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
