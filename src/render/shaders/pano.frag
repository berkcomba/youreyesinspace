// Rover panorama strip: the real view from the vehicle's mast (NASA/JPL 360° panoramas), drawn
// on a band of a sphere around it when the camera stands on the ground. Lit exactly as the
// terrain's level ground (terrain.frag) and levelled to the same tone offline, so the photo
// continues the relief without a step; its lower edge fades in just below the horizon, its
// upper edge fades into the sky.
#include <common>
#include <logdepthbuf_pars_fragment>
uniform sampler2D uTex;
uniform float uNorth;         // u of the strip's column that looks north
uniform vec2 uElev;           // elevation (deg) at the strip's bottom and top rows
uniform vec4 uBand;           // alpha: 0 → 1 between .x and .y, 1 → 0 between .z and .w (deg)
uniform vec3 uSunDir;         // unit, vehicle frame
uniform vec3 uSunColor;
uniform float uFill;
uniform float uOpacity;
uniform vec3 uAtmColor;
uniform float uAtmDensity;
varying vec3 vDir;
varying vec3 vViewPos;

void main() {
  #include <logdepthbuf_fragment>
  vec3 d = normalize(vDir);
  float az = atan(d.x, -d.z);                       // 0 north, clockwise through east
  float elev = degrees(asin(clamp(d.y, -1.0, 1.0)));
  vec2 uv = vec2(fract(uNorth + az / (2.0 * PI)), (uElev.y - elev) / (uElev.y - uElev.x));
  vec3 albedo = texture2D(uTex, uv).rgb;
  // as terrain.frag / tile.frag
  float lum = dot(albedo, vec3(0.299, 0.587, 0.114));
  albedo = mix(vec3(lum), albedo, 1.2);
  albedo = pow(max(albedo, 0.0), vec3(1.08));

  float terminator = smoothstep(-0.08, 0.15, uSunDir.y);
  float level = max(uSunDir.y, 0.0);
  float diffuse = max(level * terminator, uFill * 0.9);
  vec3 color = albedo * diffuse * uSunColor + albedo * 0.0025;
  if (uAtmDensity > 0.0) {
    float dayFactor = smoothstep(-0.25, 0.35, uSunDir.y);
    float haze = uAtmDensity * 0.12 * dayFactor;
    color = mix(color, color * 0.9 + uAtmColor * 0.08, haze);
  }

  float band = smoothstep(uBand.x, uBand.y, elev) * (1.0 - smoothstep(uBand.z, uBand.w, elev));
  gl_FragColor = vec4(color, band * uOpacity);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
