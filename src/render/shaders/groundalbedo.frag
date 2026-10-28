// Colour map of one ground ring (see ground_common.glsl): the globe's own albedo at each texel,
// with metre-scale variation it has no room for on the globe. Linear RGB (the target is sRGB);
// A < 0.75 marks open water (the terrain shader adds the Sun's glitter there).
void main() {
  vec2 xz = localXZ();
  vec3 p = noiseDir(xz);
  float h = heightAt(p);
  bool water = openWater(p, h);
  bool ocean = water;
  float lavaGlow;
  vec3 albedo = terrestrialAlbedo(p, h, ocean, lavaGlow);
  vec3 rc;
  if (realColour(p, rc)) {
    // the imagery's colours, the procedural tint only as a hint of texture
    if (water) ocean = true; else ocean = false;
    if (!ocean) albedo = mix(albedo, rc, 0.85);
  }
  if (!ocean) {
    // regolith / soil mottling, stones, the odd darker patch — km-space so every ring agrees
    vec3 q = vec3(xz.x, xz.y, uSeed * 0.37);
    float m = snoise(q / 1.9) * 0.12 + snoise(q / 0.42 + 2.0) * 0.09 + snoise(q / 0.09 + 4.0) * 0.08 + snoise(q / 0.02 + 6.0) * 0.06;
    albedo *= 1.0 + m;
    // boulder fields and the odd outcrop, a few metres across
    float stones = smoothstep(0.5, 0.8, snoise(q / 0.004 + 9.0)) * smoothstep(0.15, 0.6, snoise(q / 0.25 + 1.0));
    albedo = mix(albedo, albedo * 0.65, stones * 0.7);
    // crater floors a shade darker, rims a shade brighter (matches ground_common's bowls)
    if (uCraters > 0.0) {
      float cr = craterField(vec3(xz.x, xz.y, 0.0) / 12.0, uSeed + 3.0, uCraters);
      albedo *= 1.0 + cr * 0.35;
    }
  }
  // molten ground: dark basalt crust, the glow is the terrain shader's (A ≈ 0.25 marks it)
  float lava = ocean ? 0.0 : max(lavaAt(xz), smoothstep(0.6, 0.9, lavaGlow));
  if (lava > 0.0) {
    vec3 q = vec3(xz.x, xz.y, uSeed * 0.37);
    float crust = 0.6 + 0.4 * snoise(q / 0.03 + 3.0);
    albedo = mix(albedo, vec3(0.07, 0.06, 0.06) * crust, smoothstep(0.1, 0.5, lava));
  }
  gl_FragColor = vec4(max(albedo, 0.0), ocean ? 0.5 : lava > 0.5 ? 0.25 : 1.0);
}
