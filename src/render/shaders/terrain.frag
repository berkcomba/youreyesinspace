// Lander terrain: nested orthophoto rings (finest wins, cross-faded at its edge), lit the same way
// as the planet's imagery tiles so the patch meets the globe without a visible seam, with the
// atmosphere's haze thickening toward the horizon.
#include <logdepthbuf_pars_fragment>
uniform sampler2D uTex0;
uniform sampler2D uTex1;
uniform sampler2D uTex2;
uniform sampler2D uTex3;
uniform sampler2D uTex4;
uniform float uHalf[5];       // half-size (km) of each ring
uniform int uRings;
uniform vec3 uSunDir;         // unit, vehicle frame
uniform vec3 uSunColor;
uniform float uFill;          // near-body work light (see lighting.glsl)
uniform float uOpacity;
uniform vec3 uAtmColor;       // the planet's atmosphere, as its imagery tiles see it
uniform float uAtmDensity;
uniform vec3 uSunsetColor;
uniform float uHaze;          // 1 at ground level → 0 from altitude (the globe's tiles have no haze)
uniform vec3 uGlobeGain;      // maps → the globe's own tone (what the patch must match from altitude)
uniform vec3 uNearGain;       // maps → the rover panorama's ground tone (the view from the ground)
uniform float uNear;          // 1 on the ground → 0 a few km up
varying vec3 vLocal;
varying vec3 vNormal;
varying float vAlpha;
varying vec3 vViewPos;
varying vec3 vUpView;

vec3 ring(sampler2D t, float halfSize, out float inside) {
  vec2 uv = vLocal.xz / (2.0 * halfSize) + 0.5;
  float m = max(abs(uv.x - 0.5), abs(uv.y - 0.5)) * 2.0;   // 0 centre … 1 edge
  inside = 1.0 - smoothstep(0.82, 0.98, m);
  return texture2D(t, uv).rgb;
}

void main() {
  #include <logdepthbuf_fragment>
  // coarsest ring first, each finer one blended over it inside its own square
  float w; vec3 c;
  vec3 albedo = vec3(0.0);
  if (uRings >= 5) albedo = ring(uTex4, uHalf[4], w);
  if (uRings >= 4) { c = ring(uTex3, uHalf[3], w); albedo = uRings == 4 ? c : mix(albedo, c, w); }
  if (uRings >= 3) { c = ring(uTex2, uHalf[2], w); albedo = uRings == 3 ? c : mix(albedo, c, w); }
  if (uRings >= 2) { c = ring(uTex1, uHalf[1], w); albedo = uRings == 2 ? c : mix(albedo, c, w); }
  c = ring(uTex0, uHalf[0], w); albedo = uRings == 1 ? c : mix(albedo, c, w);
  // the maps are stored at a mid level: from altitude the patch takes the globe's tone, on the
  // ground the brighter natural colour the rover's own cameras show (and its panorama has)
  albedo *= mix(uGlobeGain, uNearGain, uNear);
  // as tile.frag: mild contrast/saturation compensation for the ACES tone mapper
  float lum = dot(albedo, vec3(0.299, 0.587, 0.114));
  albedo = mix(vec3(lum), albedo, 1.2);
  albedo = pow(max(albedo, 0.0), vec3(1.08));

  vec3 N = normalize(vNormal);
  float NdotL = dot(N, uSunDir);
  float terminator = smoothstep(-0.08, 0.15, uSunDir.y);   // day/night from the local vertical
  // level ground is lit exactly like the globe (no seam); slopes facing away from the Sun are
  // only partly darkened, as the bright Martian sky would have it
  float level = max(uSunDir.y, 0.0), nl = max(NdotL, 0.0);
  float lit = nl < level ? mix(nl, level, 0.4) : nl;
  float diffuse = max(lit * terminator, uFill * 0.9);
  vec3 color = albedo * diffuse * uSunColor + albedo * 0.0025;

  if (uAtmDensity > 0.0) {
    float NdotV = max(dot(normalize(vUpView), normalize(-vViewPos)), 0.0);
    float NdotLgeo = uSunDir.y;
    float dayFactor = smoothstep(-0.25, 0.35, NdotLgeo);
    float sunset = smoothstep(0.35, -0.05, NdotLgeo) * smoothstep(-0.35, 0.0, NdotLgeo);
    // as tile.frag: rim scattering + sunset tint near the terminator — the globe's limb glow, which
    // from the ground would whiten every surface seen at a grazing angle; there the distance haze
    // below takes over, so the rim term is reduced as the camera nears the ground
    float rim = pow(1.0 - NdotV, 3.0) * (1.0 - 0.85 * uHaze);
    vec3 scatter = uAtmColor * rim * dayFactor * uAtmDensity * 0.45;
    scatter += uSunsetColor * sunset * rim * uAtmDensity * 0.4;
    float haze = uAtmDensity * 0.12 * (1.0 - NdotV * 0.7) * dayFactor;
    color = mix(color, color * 0.9 + uAtmColor * 0.08, haze);
    color += scatter * uSunColor;
    // aerial perspective: dust scatters sunlight into the line of sight; a few tens of km of air
    // turn distant rims into pale silhouettes, as in every rover panorama
    float dist = length(vViewPos);
    float fog = (1.0 - exp(-dist / (38.0 / uAtmDensity))) * uHaze * max(terminator, uFill * 0.9);
    vec3 fogColor = mix(uAtmColor * 0.3, uSunsetColor * 0.22, sunset) * uSunColor * (0.55 + 0.45 * dayFactor);
    color = mix(color, fogColor, fog * 0.85);
  }

  gl_FragColor = vec4(color, vAlpha * uOpacity);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
