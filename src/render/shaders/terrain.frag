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
uniform float uProcedural;    // 1: generated ground (maps already globe-toned; add fine grain and water glitter)
uniform float uSeed;
uniform vec3 uCamLocal;       // camera in the patch's frame (km)
uniform float uTime;          // seconds (water ripples, the lava's flicker)
uniform float uMistLevel;     // y (km, patch frame) below which the hollows fill with morning mist
varying vec3 vLocal;
varying vec3 vNormal;
varying float vAlpha;
varying vec3 vViewPos;
varying vec3 vUpView;

vec4 ring(sampler2D t, float halfSize, out float inside) {
  vec2 uv = vLocal.xz / (2.0 * halfSize) + 0.5;
  float m = max(abs(uv.x - 0.5), abs(uv.y - 0.5)) * 2.0;   // 0 centre … 1 edge
  inside = 1.0 - smoothstep(0.82, 0.98, m);
  return texture2D(t, uv);
}

void main() {
  #include <logdepthbuf_fragment>
  // coarsest ring first, each finer one blended over it inside its own square
  float w; vec4 c;
  vec4 tex = vec4(0.0);
  if (uRings >= 5) tex = ring(uTex4, uHalf[4], w);
  if (uRings >= 4) { c = ring(uTex3, uHalf[3], w); tex = uRings == 4 ? c : mix(tex, c, w); }
  if (uRings >= 3) { c = ring(uTex2, uHalf[2], w); tex = uRings == 3 ? c : mix(tex, c, w); }
  if (uRings >= 2) { c = ring(uTex1, uHalf[1], w); tex = uRings == 2 ? c : mix(tex, c, w); }
  c = ring(uTex0, uHalf[0], w); tex = uRings == 1 ? c : mix(tex, c, w);
  vec3 albedo = tex.rgb;
  float lava = uProcedural * (1.0 - smoothstep(0.2, 0.4, tex.a));
  float water = uProcedural * (1.0 - smoothstep(0.6, 0.9, tex.a)) * (1.0 - lava);
  if (uProcedural > 0.5) {
    // the maps carry the globe's colours; the last metres under the visitor get grain the
    // texels cannot hold (fading out with distance so it never shimmers)
    float dist = length(vViewPos);
    float near = (1.0 - smoothstep(0.05, 0.6, dist)) * (1.0 - water);
    float grain = (snoise(vLocal * 900.0) * 0.5 + snoise(vLocal * 3600.0 + 4.0) * 0.3) * near;
    // pebbles and the odd stone, a metre apart and smaller
    float pebbles = smoothstep(0.45, 0.8, snoise(vLocal * 2200.0 + 11.0)) * near;
    albedo *= (1.0 + grain * 0.16) * (1.0 - pebbles * 0.35);
  } else {
    // the maps are stored at a mid level: from altitude the patch takes the globe's tone, on the
    // ground the brighter natural colour the rover's own cameras show (and its panorama has)
    albedo *= mix(uGlobeGain, uNearGain, uNear);
    // as tile.frag: mild contrast/saturation compensation for the ACES tone mapper
    float lum = dot(albedo, vec3(0.299, 0.587, 0.114));
    albedo = mix(vec3(lum), albedo, 1.2);
    albedo = pow(max(albedo, 0.0), vec3(1.08));
  }

  vec3 N = normalize(vNormal);
  float NdotL = dot(N, uSunDir);
  float terminator = smoothstep(-0.08, 0.15, uSunDir.y);   // day/night from the local vertical
  // level ground is lit exactly like the globe (no seam); slopes facing away from the Sun are
  // only partly darkened, as the bright Martian sky would have it
  float level = max(uSunDir.y, 0.0), nl = max(NdotL, 0.0);
  // (under no air at all the slopes keep their full contrast: lunar shadows are black)
  float lit = nl < level ? mix(nl, level, 0.4 * min(1.0, uAtmDensity * 2.5)) : nl;
  // night lamp (the user's "night side" setting): hemispheric, so slopes and rocks keep their
  // shape, and a touch stronger on what faces the visitor — a torch, not a flat floor
  vec3 Vn = normalize(uCamLocal - vLocal);
  float lamp = uFill * 0.9 * (0.55 + 0.45 * N.y) * (0.7 + 0.3 * max(dot(N, Vn), 0.0));
  float diffuse = max(lit * terminator, lamp);
  vec3 color = albedo * diffuse * uSunColor + albedo * 0.0025;
  // skylight: a bright sky lights what the Sun does not reach — shadows, dusk, the minutes
  // before sunrise (airless worlds have none: their shadows stay black)
  float skyUp = smoothstep(-0.2, 0.3, uSunDir.y);
  color += albedo * uAtmColor * uSunColor * (uAtmDensity * (0.08 + 0.16 * uHaze) * skyUp * (0.55 + 0.45 * N.y));
  if (lava > 0.0) {
    // molten rock: its own light, flickering, brightest in the cracks between crust plates
    float cracks = 1.0 - smoothstep(0.0, 0.25, abs(snoise(vLocal * 120.0 + uSeed)));
    float flicker = 0.8 + 0.2 * sin(uTime * 2.3 + snoise(vLocal * 40.0) * 6.0);
    color += vec3(1.0, 0.32, 0.04) * lava * (0.35 + 1.6 * cracks) * flicker;
  }
  if (water > 0.0) {
    // open water: the Sun's glitter path, broad and bright at low Sun, over wind ripples
    vec3 V = normalize(uCamLocal - vLocal);
    float r1 = snoise(vec3(vLocal.xz * 1500.0, uTime * 0.35));
    float r2 = snoise(vec3(vLocal.xz * 4200.0 + 7.0, uTime * 0.6));
    float ripple = 0.08 * (1.0 - smoothstep(0.2, 3.0, length(vViewPos)));
    vec3 Nw = normalize(mix(vec3(0.0, 1.0, 0.0), N, 0.2) + vec3(r1, 0.0, r2) * ripple);
    // the sky in the water
    color = mix(color, color * 0.6 + uAtmColor * uSunColor * 0.12 * terminator, 0.5 * water * min(1.0, uAtmDensity * 2.0));
    vec3 Hh = normalize(uSunDir + V);
    float spec = pow(max(dot(Nw, Hh), 0.0), 320.0) * 0.6 + pow(max(dot(Nw, Hh), 0.0), 30.0) * 0.08;
    color += vec3(1.0, 0.98, 0.9) * uSunColor * spec * terminator * water;
  }

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
    // morning mist: the hollows below the visitor fill with a pale layer while the Sun is low
    float low = 1.0 - smoothstep(0.12, 0.35, uSunDir.y);
    float depth = clamp((uMistLevel - vLocal.y) / 0.12, 0.0, 1.0);
    float mist = (1.0 - exp(-dist * 0.35 * uAtmDensity * depth)) * low * uHaze * max(dayFactor, 0.15);
    vec3 mistColor = mix(uAtmColor * 0.9 + 0.3, uSunsetColor * 0.6 + 0.3, sunset) * uSunColor * (0.3 + 0.7 * dayFactor);
    color = mix(color, mistColor, mist * 0.7);
  }

  gl_FragColor = vec4(color, vAlpha * uOpacity);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
