// Bakes a terrestrial body's surface into cube maps (one face per pass, see bake_common.glsl):
//   pass 0  height (16 bit) → the scratch cube (a skin: + its slopes in g, b, the craters in a)
//   pass 1  albedo (sRGB) + material flag → the A map  (flag: 1 open water, <0.5 lava glow ×2)
uniform samplerCube uHeightMap;   // pass 1: the height cube baked by pass 0

void main() {
  vec3 p = faceDir(gl_FragCoord.xy);
#ifdef SKIN
  // the body's own craters, hills and landforms over the skin's relief, their height alone in A
  // for the normal pass to take the slopes of
  Geo g = geoAt(p);
  if (uPass == 0) {
    vec3 r = skinReliefG(p, g);
    float c = skinOverlay(p) * uSkinCraters + g.h;
    gl_FragColor = vec4(r.x + c, r.y, r.z, c);
    return;
  }
  vec4 c = skinColorG(p, g);
  if (uCraters * uSkinCraters > 0.0 && c.a < 0.75) c.rgb = craterAlbedo(p, c.rgb, 2.2);
  gl_FragColor = c;
#else
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
#endif
}
