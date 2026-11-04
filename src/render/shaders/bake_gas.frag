// Bakes a gas giant's cloud deck into cube maps (see bake_common.glsl):
//   pass 0  cloud-top height (16 bit) → the scratch cube
//   pass 1  albedo (sRGB) → the A map
void main() {
  vec3 p = faceDir(gl_FragCoord.xy);
  float h;
  vec3 albedo = gasAlbedo(p, h);
  if (uPass == 0) {
    gl_FragColor = packHeight(h, 0.0, 0.0);
    return;
  }
  gl_FragColor = vec4(max(albedo, 0.0), 0.0);
}
