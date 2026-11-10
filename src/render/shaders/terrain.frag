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
uniform float uMist;          // 0 … 1: how humid the world is (mist needs water)
uniform sampler2D uSun0;      // per ring: the share of the Sun's disc seen past the relief (sunlight.frag)
uniform sampler2D uSun1;
uniform sampler2D uSun2;
uniform sampler2D uSun3;
uniform sampler2D uSun4;
uniform float uSunlit;        // 1 once every ring has its sunlight map
uniform sampler2D uGround;    // the world's close-range material (RG slope, B albedo factor, A height)
uniform vec4 uGroundRange;    // its slope, albedo and height (÷ tile size) ranges; w: 1 once loaded
uniform sampler2D uGroundB;   // the slopes' material, the same way
uniform vec4 uGroundRangeB;
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

// The ground materials at `uv`, decoded: slope (∂h/∂x, ∂h/∂y), albedo factor, height (÷ tile
// size) — the level ground's blended into the slopes' by `steep` (only what is used is fetched)
vec4 groundTexel(vec2 uv, vec2 gx, vec2 gy, float steep) {
  vec4 a = vec4(0.0, 0.0, 1.0, 0.0), b = a;
  if (steep < 0.999) {
    vec4 t = textureGrad(uGround, uv, gx, gy);
    a = vec4((t.rg * 2.0 - 1.0) * uGroundRange.x, t.b * uGroundRange.y, t.a * uGroundRange.z);
  }
  if (steep > 0.001) {
    vec4 t = textureGrad(uGroundB, uv, gx, gy);
    b = vec4((t.rg * 2.0 - 1.0) * uGroundRangeB.x, t.b * uGroundRangeB.y, t.a * uGroundRangeB.z);
  }
  return mix(a, b, steep);
}

// One layer of the ground material, laid `size` km wide and turned by `rot`, its relief scaled by
// `amp`: adds its slope (∂h/∂x, ∂h/∂z) with weight `w`, scales the albedo, and darkens what its
// own relief hides from the Sun with weight `ws` (`sunH` the Sun's horizontal direction, `sunTan`
// its height over the horizon as a slope). `px`, `py`: the screen derivatives of `p`, taken where
// every pixel still runs the same code (the mip level must not depend on the branches here).
void groundLayer(vec2 p, vec2 px, vec2 py, float size, float rot, float amp, float w, float ws, vec2 sunH, float sunTan, float steep,
                 inout vec2 slope, inout float albedo, inout float shade) {
  if (w <= 0.0) return;
  float c = cos(rot), s = sin(rot);
  mat2 toTile = mat2(c, s, -s, c);
  vec2 uv = toTile * (p / size) + vec2(0.37, 0.71) * rot;
  vec2 gx = toTile * (px / size), gy = toTile * (py / size);
  vec4 t = groundTexel(uv, gx, gy, steep);
  slope += w * amp * (mat2(c, -s, s, c) * t.xy);
  albedo *= mix(1.0, t.z, w * 0.3);
  if (ws <= 0.0) return;
  // march toward the Sun over the tile's heights; the Sun's half-degree disc softens the edge
  vec2 d = toTile * sunH;
  float h0 = t.w * amp, run = 0.002, lit = 1.0;
  for (int k = 0; k < 12; k++) {
    float hk = groundTexel(uv + d * run, gx, gy, steep).w * amp;
    lit = min(lit, (h0 + run * sunTan - hk) / (run * 0.02) + 0.5);
    run *= 1.5;
  }
  shade *= mix(1.0, clamp(lit, 0.0, 1.0), ws);
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
    float near = (1.0 - smoothstep(0.05, 0.6, dist)) * (1.0 - water) * (1.0 - uGroundRange.w);
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
  // the baked ground material at three sizes (its craters from tens of centimetres to tens of
  // metres), each fading out before it would shrink to a texel
  float shade = 1.0;
  vec2 px = dFdx(vLocal.xz), py = dFdy(vLocal.xz);
  if (uGroundRange.w > 0.0 && water < 0.5) {
    float dist = length(vViewPos);
    float sunLen = max(length(uSunDir.xz), 1e-3);
    vec2 sunH = uSunDir.xz / sunLen;
    float sunTan = uSunDir.y / sunLen;
    float shadows = smoothstep(-0.01, 0.03, uSunDir.y);
    vec2 slope = vec2(0.0);
    float gAlbedo = 1.0;
    // the slopes' material past ~20–35°, its edge ragged, and in outcrops here and there on the level
    float steep = smoothstep(0.94, 0.8, N.y) + snoise(vLocal * 60.0 + uSeed) * 0.15
      + smoothstep(0.45, 0.8, snoise(vLocal * 9.0 - uSeed)) * 0.6;
    steep = uGroundRangeB.w * clamp(steep, 0.0, 1.0);
    // (shadows fade first: far off, the mipmapped heights would cast them in streaks)
    groundLayer(vLocal.xz, px, py, 0.004, 0.0, 0.6, 1.0 - smoothstep(0.03, 0.12, dist), shadows * (1.0 - smoothstep(0.012, 0.04, dist)), sunH, sunTan, steep, slope, gAlbedo, shade);
    groundLayer(vLocal.xz, px, py, 0.031, 2.1, 0.3, 1.0 - smoothstep(0.15, 0.6, dist), shadows * (1.0 - smoothstep(0.08, 0.3, dist)), sunH, sunTan, steep, slope, gAlbedo, shade);
    groundLayer(vLocal.xz, px, py, 0.23, 4.2, 0.25, 1.0 - smoothstep(1.2, 5.0, dist), shadows * (1.0 - smoothstep(0.6, 2.0, dist)), sunH, sunTan, steep, slope, gAlbedo, shade);
    albedo *= gAlbedo;
    // seen at a grazing angle the slopes would only streak: real relief there hides itself, a
    // flat map cannot
    float graze = smoothstep(0.03, 0.15, dot(N, normalize(uCamLocal - vLocal)));
    N = normalize(N + vec3(-slope.x, 0.0, -slope.y) * graze);
  }
  shade *= rockShadow(vLocal, 0.0002);
  float NdotL = dot(N, uSunDir);
  float terminator = smoothstep(-0.08, 0.15, uSunDir.y);   // day/night from the local vertical
  float daylight = terminator;
  if (uSunlit > 0.5) {
    // the relief's own horizon: hills hide the Sun from the hollows behind them while the peaks
    // beyond still catch it (on the ground this replaces the globe's soft day/night ramp)
    float sw; float sun = 1.0;
    if (uRings >= 5) sun = ring(uSun4, uHalf[4], sw).r;
    if (uRings >= 4) { float s = ring(uSun3, uHalf[3], sw).r; sun = uRings == 4 ? s : mix(sun, s, sw); }
    if (uRings >= 3) { float s = ring(uSun2, uHalf[2], sw).r; sun = uRings == 3 ? s : mix(sun, s, sw); }
    if (uRings >= 2) { float s = ring(uSun1, uHalf[1], sw).r; sun = uRings == 2 ? s : mix(sun, s, sw); }
    float s0 = ring(uSun0, uHalf[0], sw).r; sun = uRings == 1 ? s0 : mix(sun, s0, sw);
    terminator = mix(terminator, mix(terminator, sun, vAlpha), uNear);
  }
  // the low Sun seen from the ground through air: its light reddens over the long path, the
  // shadows turn blue with skylight and keep their depth — the golden hour (from altitude the
  // patch stays toned like the globe)
  float atm = min(1.0, uAtmDensity * 2.0);
  float lowSun = (1.0 - smoothstep(0.0, 0.3, uSunDir.y)) * smoothstep(-0.06, 0.01, uSunDir.y) * uNear;
  vec3 warm = min(uSunsetColor / max(dot(uSunsetColor, vec3(0.299, 0.587, 0.114)), 0.05), vec3(2.2));
  vec3 sunTint = mix(vec3(1.0), warm, lowSun * atm * 0.75);
  // level ground is lit exactly like the globe (no seam); slopes facing away from the Sun are
  // only partly darkened, as the bright Martian sky would have it
  float level = max(uSunDir.y, 0.0), nl = max(NdotL, 0.0);
  // (under no air at all the slopes keep their full contrast: lunar shadows are black)
  float lit = (nl < level ? mix(nl, level, 0.4 * min(1.0, uAtmDensity * 2.5) * (1.0 - 0.6 * lowSun)) : nl) * shade;
  // night lamp (the user's "night side" setting): hemispheric, so slopes and rocks keep their
  // shape, and a touch stronger on what faces the visitor — a torch, not a flat floor
  vec3 Vn = normalize(uCamLocal - vLocal);
  float lamp = uFill * 0.9 * (0.55 + 0.45 * N.y) * (0.7 + 0.3 * max(dot(N, Vn), 0.0));
  // on the ground the lamp steps aside: in daylight the Sun draws the relief and its shadows, at
  // night it is a dim glow, not a floodlight brighter than the day (from altitude it stays, as on
  // the globe the patch must match)
  lamp *= 1.0 - mix(0.88, 0.95, smoothstep(0.0, 0.08, uSunDir.y)) * uNear;
  float diffuse = max(lit * terminator, lamp);
  vec3 color = albedo * diffuse * uSunColor * sunTint + albedo * 0.0025;
  // what the sunlit ground all around throws back into the shadows (with no sky, all there is)
  color += albedo * uSunColor * sunTint * 0.1 * level * daylight * (0.6 + 0.4 * N.y);
  // skylight: a bright sky lights what the Sun does not reach — shadows, dusk, the minutes
  // before sunrise (airless worlds have none: their shadows stay black)
  float skyUp = smoothstep(-0.2, 0.3, uSunDir.y);
  vec3 sky = uAtmColor * mix(vec3(1.0), vec3(0.75, 0.9, 1.25), lowSun * atm) * (1.0 - 0.35 * lowSun);
  color += albedo * sky * uSunColor * (uAtmDensity * (0.08 + 0.16 * uHaze) * skyUp * (0.55 + 0.45 * N.y));
  // regolith in the full Sun: looking away from it the ground flares up as every grain hides its
  // own shadow (the opposition surge round the Moon's anti-solar point); looking into it, the
  // ground and dust toward the Sun glow with forward-scattered light
  float phase = dot(Vn, uSunDir);
  float opposition = pow(max(phase, 0.0), 24.0) * (1.0 - atm) * 0.35;
  float forward = pow(max(-phase, 0.0), 6.0) * pow(1.0 - max(dot(N, Vn), 0.0), 3.0) * (0.06 + 0.12 * atm);
  color += albedo * uSunColor * sunTint * (opposition * lit + forward * level) * terminator * uNear;
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

  float alpha = vAlpha;
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
    vec3 fogColor = mix(uAtmColor * 0.3, uSunsetColor * 0.22, sunset) * uSunColor * (0.55 + 0.45 * dayFactor);    color = mix(color, fogColor, fog * 0.85);
    // morning mist: the hollows below the visitor fill with a pale layer while the Sun is low
    float low = 1.0 - smoothstep(0.12, 0.35, uSunDir.y);
    float depth = clamp((uMistLevel - vLocal.y) / 0.12, 0.0, 1.0);
    float mist = (1.0 - exp(-dist * 0.35 * uAtmDensity * depth)) * low * uHaze * max(dayFactor, 0.15);
    vec3 mistColor = mix(uAtmColor * 0.9 + 0.3, uSunsetColor * 0.6 + 0.3, sunset) * uSunColor * (0.3 + 0.7 * dayFactor);
    color = mix(color, mistColor, mist * 0.7 * uMist);
    float el = dot(normalize(vViewPos), normalize(vUpView)), sunC = dot(normalize(vLocal - uCamLocal), uSunDir);
    color += skyHaze(el, sunC, uSunDir.y, dist, uAtmColor, uAtmDensity, uSunsetColor, uSunColor);
    // above the horizon the patch's fading edge stands against the sky (which it hides), not the
    // globe: it fades into the sky's colour there, a horizontal path through the whole shell
    if (uSky.x > 0.0) {
      float above = smoothstep(uSky.w - 0.002, uSky.w + 0.002, el);
      vec3 sky = skyHaze(el, sunC, uSunDir.y, uSky.y * uAtmDensity * 0.22 / uSky.x, uAtmColor, uAtmDensity, uSunsetColor, uSunColor);
      color = mix(color, sky, (1.0 - vAlpha) * above);
      alpha = mix(alpha, 1.0, above);
    }
  }

  gl_FragColor = vec4(color, alpha * uOpacity);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
