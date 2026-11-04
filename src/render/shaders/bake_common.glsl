// ---------------------------------------------------------------------------
// Surface baking: a full-screen pass per cube face. The direction of a texel follows the WebGL
// cube-map convention (row 0 of the framebuffer is t = −1), so textureCube(dir) at run time lands
// on the texel baked for dir.
// ---------------------------------------------------------------------------
uniform int uFace;      // 0 +X, 1 −X, 2 +Y, 3 −Y, 4 +Z, 5 −Z
uniform float uRes;     // texels per face edge
uniform int uPass;      // 0: height, 1: albedo

vec3 faceDir(vec2 fragCoord) {
  vec2 st = fragCoord / uRes * 2.0 - 1.0;
  float sc = st.x, tc = st.y;
  vec3 d;
  if (uFace == 0) d = vec3(1.0, -tc, -sc);
  else if (uFace == 1) d = vec3(-1.0, -tc, sc);
  else if (uFace == 2) d = vec3(sc, 1.0, tc);
  else if (uFace == 3) d = vec3(sc, -1.0, -tc);
  else if (uFace == 4) d = vec3(sc, -tc, 1.0);
  else d = vec3(-sc, -tc, -1.0);
  return normalize(d);
}

// the tangent frame every surface shader derives from the direction (bake and run time agree)
void tangentFrame(vec3 p, out vec3 T, out vec3 B) {
  T = normalize(cross(abs(p.y) < 0.99 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0), p));
  B = cross(p, T);
}

// the scratch height cube is half-float: the height sits in R (bilinear filtering stays exact)
vec4 packHeight(float h, float extra0, float extra1) {
  return vec4(h, extra0, extra1, 1.0);
}

float unpackHeight(vec4 c) {
  return c.r;
}
