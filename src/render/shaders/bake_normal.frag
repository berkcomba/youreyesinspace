// Slopes and cavity from a baked height cube → the N map:
//   r, g  height gradient along the tangent frame (per radian), /SLOPE_RANGE + 0.5
//   b     cavity: valleys and crater floors darker, rims and ridges brighter (1 = flat) / 1.5
//   a     height, 8 bit (coarse uses only: snow / city-light altitude limits)
uniform samplerCube uHeightMap;
uniform float uCavityScale;   // height units → cavity strength (relief amplitude dependent)

const float SLOPE_RANGE = 48.0;

float hAt(vec3 d) { return unpackHeight(textureLod(uHeightMap, normalize(d), 0.0)); }

void main() {
  vec3 p = faceDir(gl_FragCoord.xy);
  vec3 T, B;
  tangentFrame(p, T, B);
  // one texel at the face centre spans π/2 / res radians
  float texel = 1.5707963 / uRes;
  float e = 1.2 * texel;
  float h = hAt(p);
#ifdef SKIN
  // a skin's slopes come from its baked normal (pass 0 put them beside the height), the slopes of
  // the craters laid over it from their height in A
  vec4 c = textureLod(uHeightMap, p, 0.0);
  float gT = c.g + (textureLod(uHeightMap, normalize(p + T * e), 0.0).a - textureLod(uHeightMap, normalize(p - T * e), 0.0).a) / (2.0 * e);
  float gB = c.b + (textureLod(uHeightMap, normalize(p + B * e), 0.0).a - textureLod(uHeightMap, normalize(p - B * e), 0.0).a) / (2.0 * e);
#else
  float gT = (hAt(p + T * e) - hAt(p - T * e)) / (2.0 * e);
  float gB = (hAt(p + B * e) - hAt(p - B * e)) / (2.0 * e);
#endif
  // cavity: the height against the mean of three rings around it (4, 14 and 40 texels; the wide
  // one lets whole crater bowls and basin floors darken, not only their rims)
  float m1 = 0.0, m2 = 0.0, m3 = 0.0;
  for (int i = 0; i < 8; i++) {
    float a = float(i) * 0.7853982;
    vec3 dir = T * cos(a) + B * sin(a);
    m1 += hAt(p + dir * texel * 4.0);
    m2 += hAt(p + dir * texel * 14.0);
    m3 += hAt(p + dir * texel * 40.0);
  }
  float ao = h - (m1 + m2 + m3) / 24.0;
  float cavity = clamp(1.0 + ao * uCavityScale, 0.4, 1.3);
  gl_FragColor = vec4(clamp(gT / SLOPE_RANGE + 0.5, 0.0, 1.0), clamp(gB / SLOPE_RANGE + 0.5, 0.0, 1.0), cavity / 1.5, clamp(h, 0.0, 1.0));
}
