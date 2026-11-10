#include <logdepthbuf_pars_fragment>
// Rocks strewn over the landing ground (see groundrock.vert), lit as terrain.frag lights the
// ground around them.
uniform vec3 uSunDir;          // unit, patch frame
uniform vec3 uSunColor;
uniform float uFill;
uniform float uOpacity;
uniform vec3 uAtmColor;
uniform float uAtmDensity;
uniform float uHaze;
uniform float uNear;
uniform vec3 uCamLocal;
varying vec3 vLocal;
varying vec3 vRel;
varying vec3 vNormal;
varying vec3 vObj;
varying vec3 vAlbedo;
varying vec3 vGround;
varying float vSun;
varying float vSize;
varying vec3 vViewPos;
varying vec2 vUv;
varying vec3 vNx;
varying vec3 vNy;
varying vec3 vNz;
uniform sampler2D uRockMap;    // the family's atlas: rgb normal in the rock's frame × 0.5 + 0.5, a albedo ÷ 2
uniform float uRockMapOn;

void main() {
  #include <logdepthbuf_fragment>
  // the decimated mesh's facets are smoothed away: the detailed rock's surface from the atlas, or
  // (plain scans) grain and pits as a bump, each octave fading out before it shrinks to a pixel
  float px = length(fwidth(vObj));
  float g1 = snoise(vObj * 7.0), g2 = snoise(vObj * 23.0 + 5.0), g3 = snoise(vObj * 71.0 - 3.0);
  float fine = 1.0 - smoothstep(0.003, 0.012, px);
  vec3 N = normalize(vNormal);
  vec3 tone = vec3(1.0 + 0.18 * g2 + 0.1 * g3);
  float bump;
  if (uRockMapOn > 0.5) {
    vec4 t = texture2D(uRockMap, vUv);
    vec3 n = t.rgb * 2.0 - 1.0;
    N = normalize(vNx * n.x + vNy * n.y + vNz * n.z);
    tone = vec3(mix(1.0, t.a * 2.0, 0.85));
    bump = g3 * 0.06 * fine * vSize * 0.035;
  } else {
    bump = (g1 * 0.5 * (1.0 - smoothstep(0.03, 0.12, px)) + g2 * 0.3 * (1.0 - smoothstep(0.01, 0.04, px)) + g3 * 0.15 * fine) * vSize * 0.035;
  }
  vec3 dpx = dFdx(vRel), dpy = dFdy(vRel);
  vec3 r1 = cross(dpy, N), r2 = cross(N, dpx);
  float det = dot(dpx, r1);
  vec3 grad = sign(det) * (dFdx(bump) * r1 + dFdy(bump) * r2);
  N = normalize(abs(det) * N - grad);

  // weathered tops, dust-filled hollows, a darker foot where the rock meets the ground
  vec3 albedo = vAlbedo * tone * mix(0.7, 1.0, smoothstep(-0.15, 0.04, vObj.y));
  float atm = min(1.0, uAtmDensity * 2.0);
  float terminator = smoothstep(-0.08, 0.15, uSunDir.y);
  float sunVis = mix(terminator, min(terminator, vSun), uNear);
  float level = max(uSunDir.y, 0.0);
  // (sampled a little off the surface: the rock does not shadow itself where it faces the Sun)
  float nl = max(dot(N, uSunDir), 0.0) * rockShadow(vLocal + normalize(vNormal) * max(vSize * 0.04, 0.00003), 0.0003);
  vec3 V = normalize(uCamLocal - vLocal);
  float lamp = uFill * 0.9 * (0.55 + 0.45 * N.y) * (0.7 + 0.3 * max(dot(N, V), 0.0));
  lamp *= 1.0 - mix(0.88, 0.95, smoothstep(0.0, 0.08, uSunDir.y)) * uNear;
  vec3 color = albedo * uSunColor * max(nl * sunVis, lamp) + albedo * 0.0025;
  // the sunlit ground all around lights the rock's sides and underside (bright ice a lot, dark
  // basalt hardly), the sky its top
  color += albedo * uSunColor * level * terminator * (0.04 + 0.9 * vGround * (0.5 - 0.5 * N.y));
  float skyUp = smoothstep(-0.2, 0.3, uSunDir.y);
  color += albedo * uAtmColor * uSunColor * (uAtmDensity * (0.08 + 0.16 * uHaze) * skyUp * (0.55 + 0.45 * N.y));
  // the dust of the air between (as the ground's aerial perspective, only nearer)
  float dist = length(vViewPos);
  float fog = (1.0 - exp(-dist / (38.0 / max(uAtmDensity, 1e-3)))) * uHaze * terminator * atm;
  color = mix(color, uAtmColor * 0.3 * uSunColor, fog * 0.85);
  gl_FragColor = vec4(color, uOpacity);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
