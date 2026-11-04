// ---------------------------------------------------------------------------
// Baked surface maps (PlanetBake.ts): A = albedo + material flag, N = slopes + cavity.
// uBaked fades the maps in once they are ready; before that the shader evaluates its procedural
// model per pixel.
// ---------------------------------------------------------------------------
uniform samplerCube uBakeA;
uniform samplerCube uBakeN;
uniform float uBaked;      // 0 … 1
uniform float uBakeRes;    // texels per cube face edge

const float BAKE_SLOPE_RANGE = 48.0;

struct Baked {
  vec3 albedo;
  float flag;      // terrestrial: 1 open water, < 0.5 lava glow × 2
  vec2 slope;      // height gradient along the tangent frame (per radian)
  float cavity;    // 1 = flat, < 1 hollow, > 1 ridge
  float height;    // 0 … 1, coarse
};

Baked sampleBaked(vec3 dir) {
  vec4 a = textureCube(uBakeA, dir);
  vec4 n = textureCube(uBakeN, dir);
  Baked b;
  b.albedo = a.rgb;
  b.flag = a.a;
  b.slope = (n.rg - 0.5) * BAKE_SLOPE_RANGE;
  b.cavity = n.b * 1.5;
  b.height = n.a;
  return b;
}

// how much the screen magnifies a texel at direction p (> 1: closer than the bake resolves)
float bakeMagnification(vec3 p) {
  float texel = 1.5707963 / uBakeRes;
  return texel / max(length(fwidth(p)), 1e-6);
}
