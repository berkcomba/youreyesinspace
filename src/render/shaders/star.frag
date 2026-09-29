#include <logdepthbuf_pars_fragment>

uniform float uSeed;
uniform float uTime;
uniform float uTemperature;
uniform float uIntensity;

varying vec3 vObjPos;
varying vec3 vWorldPos;
varying vec3 vWorldNormal;

void main() {
  #include <logdepthbuf_fragment>

  vec3 p = normalize(vObjPos);
  vec3 N = normalize(vWorldNormal);
  vec3 V = normalize(-vWorldPos);
  float NdotV = max(dot(N, V), 0.0);

  // Granulation: multi-scale animated noise
  float t = uTime * 0.05;
  float g1 = fbm(p * 12.0 + uSeed + vec3(t, -t * 0.7, t * 0.3), 4);
  float g2 = fbm(p * 45.0 - uSeed + vec3(-t * 1.3, t, t * 0.5), 3);
  float g3 = snoise(p * 140.0 + vec3(t * 2.0));
  // Granulation cells: bright centres, dark inter-granular lanes
  float cells = 1.0 - abs(g2) * 1.6;
  float gran = 0.62 + 0.30 * g1 + 0.28 * cells + 0.06 * g3;
  gran = clamp(gran, 0.3, 1.25);

  // Sunspots: dark umbra + penumbra that slowly drift
  float spotField = fbm(p * 5.0 + uSeed * 3.0 + vec3(t * 0.15), 3) * 0.5 + 0.5;
  float spots = smoothstep(0.74, 0.86, spotField);
  float penumbra = smoothstep(0.66, 0.76, spotField) - spots;
  gran *= 1.0 - spots * 0.88;
  gran *= 1.0 - penumbra * 0.45;

  // Limb darkening
  float limb = 0.3 + 0.7 * pow(NdotV, 0.55);

  // Photosphere colour: blackbody with boosted saturation so it survives tone mapping
  // (G2V → warm yellow-white, M dwarfs → deep orange, A/B stars → blue-white)
  vec3 bb = blackbody(uTemperature);
  vec3 base = pow(bb, vec3(3.0));
  vec3 hot = mix(base, bb, 0.6);
  vec3 color = mix(base * 0.35, hot, gran) * limb;
  // bright faculae near the limb
  float faculae = smoothstep(0.55, 0.9, cells) * (1.0 - NdotV) * 0.5;
  color += hot * faculae;

  // Saturation boost: ACES + bloom pull bright surfaces toward white, so push hue back
  float lum = dot(color, vec3(0.299, 0.587, 0.114));
  color = max(mix(vec3(lum), color, 1.6), 0.0);

  // Hotter photospheres are brighter per unit area (kept mild: tone mapping would clip anyway)
  color *= uIntensity * mix(0.85, 1.45, smoothstep(3000.0, 12000.0, uTemperature));

  gl_FragColor = vec4(color, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
