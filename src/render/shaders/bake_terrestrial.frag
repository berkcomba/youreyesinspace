// Bakes a terrestrial body's surface into cube maps (one face per pass, see bake_common.glsl):
//   pass 0  height (16 bit) → the scratch cube
//   pass 1  albedo (sRGB) + material flag → the A map  (flag: 1 open water, <0.5 lava glow ×2)
uniform samplerCube uHeightMap;   // pass 1: the height cube baked by pass 0

void main() {
  vec3 p = faceDir(gl_FragCoord.xy);
  if (uPass == 0) {
    gl_FragColor = packHeight(heightAt(p), 0.0, 0.0);
    return;
  }
  float h = unpackHeight(textureLod(uHeightMap, p, 0.0));
  bool ocean = uSeaLevel >= 0.0 && h < uSeaLevel;
  float lavaGlow;
  vec3 albedo = terrestrialAlbedo(p, h, ocean, lavaGlow);
  float flag = ocean ? 1.0 : lavaGlow * 0.5;
  // linear RGB: the target is an sRGB render target, the hardware encodes
  gl_FragColor = vec4(max(albedo, 0.0), flag);
}
