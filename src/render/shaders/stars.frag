#include <logdepthbuf_pars_fragment>
// Star sprite of stars.vert: the round star of points.frag, drawn out along its motion-blur trail.
uniform float uSoftness; // 0 = hard star, 1 = soft glow
uniform vec4 uTint;      // rgb + strength: "procedural content" highlight (0 = off, default)
uniform float uDaylight; // 0 = night sky; 1 = drowned in a bright daytime sky (seen from inside an atmosphere)
varying vec3 vColor;
varying float vAlpha;
varying vec4 vTrail;     // xy: trail direction on screen (unit, y up), z: half its length (px), w: the star's own diameter (px)
varying float vPoint;    // sprite size (px)
void main() {
  #include <logdepthbuf_fragment>
  // px from the sprite's centre, y up (gl_PointCoord runs downwards)
  vec2 p = (gl_PointCoord - 0.5) * vPoint;
  p.y = -p.y;
  // distance to the trail: a segment through the centre, so a star at rest is the plain round sprite
  p -= vTrail.xy * clamp(dot(p, vTrail.xy), -vTrail.z, vTrail.z);
  float r = length(p) / (0.5 * vTrail.w);
  if (r > 1.0) discard;
  float core = exp(-r * r * 8.0);
  float halo = exp(-r * 3.0) * 0.5;
  float a = mix(core + halo * 0.4, core * 0.6 + halo, uSoftness);
  vec3 col = mix(vColor, uTint.rgb * max(vColor.r, max(vColor.g, vColor.b)), uTint.a);
  gl_FragColor = vec4(col * a * vAlpha * (1.0 - uDaylight), 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
