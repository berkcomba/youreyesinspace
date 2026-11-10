// Bakes a gas giant's cloud deck into cube maps (see bake_common.glsl):
//   pass 0  cloud-top height (16 bit) → the scratch cube (a skin: + its slopes in g, b)
//   pass 1  albedo (sRGB) → the A map
void main() {
  vec3 p = faceDir(gl_FragCoord.xy);
#ifdef SKIN
  Geo g = geoAt(p);
  if (uPass == 0) {
    vec3 r = skinReliefG(p, g);
    gl_FragColor = packHeight(r.x, r.y, r.z);
    return;
  }
  gl_FragColor = vec4(skinColorG(p, g).rgb, 0.0);
#else
  float h;
  vec3 albedo = gasAlbedo(p, h);
  if (uPass == 0) {
    gl_FragColor = packHeight(h, 0.0, 0.0);
    return;
  }
  gl_FragColor = vec4(max(albedo, 0.0), 0.0);
#endif
}
