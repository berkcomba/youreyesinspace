#include <logdepthbuf_pars_fragment>

uniform mat4 modelMatrix;
uniform float uTime;
uniform vec3 uAtmColor;
uniform float uAtmDensity;
uniform vec4 uGlow;   // a deck that shines by its own heat: its colour, the palette's mean luminance (a)

varying vec3 vObjPos;
varying vec3 vWorldPos;
varying vec3 vWorldNormal;

// the deck model and its palette uniforms: gas_common.glsl; the baked maps: baked_common.glsl

vec3 rotateY(vec3 v, float a) {
  float c = cos(a), s = sin(a);
  return vec3(c * v.x + s * v.z, v.y, -s * v.x + c * v.z);
}

void main() {
  #include <logdepthbuf_fragment>

  vec3 p = normalize(vObjPos);
  float lat = asin(clamp(p.y, -1.0, 1.0));

  // Motion: the jets shear the deck back and forth by latitude (a slow, bounded wobble rather
  // than a run-away differential rotation that would smear the storms) and the eddies roll on.
  // The clock is wrapped (~1.9 yr) so the noise coordinates stay within float precision.
  float tt = mod(uTime, 16384.0);
  float jet = cos(lat * 3.0) * (0.5 + 0.5 * cos(lat * 11.0 + uSeed));
  float dlon = 0.22 * jet * sin(tt * 0.0016 + lat * 5.0 + uSeed);
  vec3 ps = rotateY(p, dlon);
  vec3 roll = vec3(snoise(p * 7.0 + vec3(tt * 0.003, 0.0, uSeed)), snoise(p * 7.0 + vec3(0.0, tt * 0.003, uSeed + 5.0)), snoise(p * 7.0 + vec3(uSeed + 9.0, 0.0, tt * 0.003)));
  ps = normalize(ps + roll * 0.006 * uTurbulence);

  vec3 albedo;
  vec2 slope;
  // only where the disc is resolved: the relief would alias into speckle from afar
  float aa = length(fwidth(p));
  float fine = 1.0 - smoothstep(0.002, 0.008, aa);
  if (uBaked > 0.999) {
    Baked b = sampleBaked(ps);
    albedo = b.albedo;
    slope = b.slope;
  } else {
    float h0;
    albedo = gasAlbedo(ps, h0);
    slope = vec2(0.0);
    if (fine > 0.001) {
      vec3 T = normalize(cross(abs(ps.y) < 0.99 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0), ps));
      vec3 B = cross(ps, T);
      float eps = clamp(aa * 2.5, 0.003, 0.03);
      float hT, hB;
      gasAlbedo(normalize(ps + T * eps), hT);
      gasAlbedo(normalize(ps + B * eps), hB);
      slope = vec2(hT - h0, hB - h0) / eps;
    }
    if (uBaked > 0.001) {
      Baked b = sampleBaked(ps);
      albedo = mix(albedo, b.albedo, uBaked);
      slope = mix(slope, b.slope, uBaked);
    }
  }

  // Lighting
  vec3 P = vWorldPos;
  vec3 N = normalize(vWorldNormal);
  vec3 L = normalize(uSunPos - P);
  vec3 V = normalize(-P);
  {
    // cloud-top relief, gentle: the deck is lit from a low sun only near the terminator
    vec3 T = normalize(cross(abs(p.y) < 0.99 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0), p));
    vec3 B = cross(p, T);
    vec3 Tw = normalize(mat3(modelMatrix) * T);
    vec3 Bw = normalize(mat3(modelMatrix) * B);
    float bump = 0.012 * fine;
    N = normalize(N - slope.x * bump * Tw - slope.y * bump * Bw);
  }
  float NdotL = dot(N, L);
  float NdotLgeo = dot(normalize(vWorldNormal), L);
  float shadow = shadowAt(P, L);
  float terminator = smoothstep(-0.05, 0.25, NdotLgeo);
  float diffuse = max(NdotL, 0.0);
  float NdotV = max(dot(normalize(vWorldNormal), V), 0.0);
  // Minnaert-style limb darkening of a deep, scattering atmosphere
  float limb = 0.55 + 0.45 * pow(NdotV, 0.5);

  vec3 color = albedo * fillLitV(diffuse * terminator * shadow, NdotV) * limb;
  color += albedo * 0.002;

  // Rim haze
  float rim = pow(1.0 - NdotV, 4.0);
  float dayFactor = smoothstep(-0.2, 0.3, NdotLgeo);
  color += uAtmColor * rim * dayFactor * uAtmDensity * 0.35 * shadow;
  color *= uSunColor;

  // Thermal glow (the hottest giants, 1000 K and up): the night side is not dark but embers,
  // brightest where the deck is thin and the eye reaches deeper, hotter gas — the dark belts
  if (uGlow.a > 0.0) {
    float thin = clamp(1.4 - dot(albedo, vec3(0.299, 0.587, 0.114)) / uGlow.a * 0.8, 0.25, 1.3);
    color += uGlow.rgb * thin * (0.45 + 0.55 * NdotV) * (1.0 - 0.85 * smoothstep(-0.15, 0.35, NdotLgeo));
  }

  gl_FragColor = vec4(color * uAlpha, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
