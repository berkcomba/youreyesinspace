#include <logdepthbuf_pars_fragment>

uniform float uSeed;
uniform float uTime;
uniform vec3 uColor;
uniform float uCoverage;
uniform float uOpacity;
uniform float uMask;   // 1: light-shaft mask pass — only the deck's opacity, in black
uniform float uNear;   // 0 from orbit … 1 under the deck: ground-scale structure fades in
uniform float uDeckKm; // height of the deck above the surface (km)

varying vec3 vObjPos;
varying vec3 vWorldPos;
varying vec3 vWorldNormal;

void main() {
  #include <logdepthbuf_fragment>

  vec3 p = normalize(vObjPos);
  float t = mod(uTime, 16384.0) * 0.01;   // wrapped: keeps the noise coordinates within float precision
  // Large-scale weather systems, stretched zonally (clouds_common.glsl)
  float cloud = cloudField(p, t, uSeed, 4);
  // from the ground the weather systems are hundreds of kilometres wide — one even veil over the
  // whole sky; the cells and streets a few kilometres across that a sky actually shows
  if (uNear > 0.001) {
    float fine = fbm(p * 420.0 + uSeed * 3.1 + vec3(t * 6.0, 0.0, -t * 2.0), 4);
    // toward the horizon the cells merge into a band (and the fine octaves would alias)
    float far = smoothstep(8.0, 25.0, length(vWorldPos) / max(uDeckKm, 1.0));
    cloud += fine * 0.5 * uNear * (1.0 - 0.7 * far);
  }
  float threshold = 1.0 - uCoverage;
  float alpha = cloudAlpha(cloud, uCoverage) * uOpacity;
  if (alpha < 0.005) discard;
  if (uMask > 0.5) { gl_FragColor = vec4(0.0, 0.0, 0.0, alpha * uAlpha); return; }

  vec3 P = vWorldPos;
  vec3 N = normalize(vWorldNormal);
  vec3 L = normalize(uSunPos - P);
  vec3 V = normalize(-P);
  float NdotL = dot(N, L);
  float shadow = shadowAt(P, L);
  // |N·V|: the deck is seen from below as well (from the ground)
  float NdotV = abs(dot(N, V));
  float diffuse = fillLitV(max(NdotL, 0.0) * smoothstep(-0.1, 0.2, NdotL) * shadow, NdotV);
  // low sun: the deck is lit by reddened light
  vec3 sunlight = uSunColor * mix(vec3(1.0), vec3(1.0, 0.62, 0.38), smoothstep(0.35, -0.02, NdotL) * 0.8);
  // self-shadowing within the cloud deck
  float thick = smoothstep(threshold, 1.0, cloud);
  // a complete deck (Venus, Titan) is a smooth veil from orbit, not a quilt of thick and thin
  float full = smoothstep(0.85, 1.0, uCoverage);
  vec3 col = uColor * mix(0.55 + 0.45 * (1.0 - thick * 0.6), 0.95 - 0.1 * thick, full) * diffuse;
  // forward scattering: thin cloud edges glow when the sun is behind them
  float through = pow(max(dot(V, -L), 0.0), 6.0) * (1.0 - thick) * 0.35;
  col += uColor * through * shadow;
  // silver lining at the terminator / limb
  float rim = pow(1.0 - NdotV, 3.0);
  col += uColor * rim * max(NdotL, 0.0) * 0.25;
  col += uColor * 0.002;
  col *= sunlight;

  gl_FragColor = vec4(col, alpha * uAlpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
