#include <common>
#include <logdepthbuf_pars_vertex>
// Rocks strewn over the landing ground (GroundRocks.ts): instanced in the patch frame (km, +Y
// up). Each takes the ground's own colour where it lies and the ground's sunlight there.
attribute vec2 aRock;          // x: shade against the ground (≈ 0.6 … 1.1), y: size (km)
uniform sampler2D uTex0;
uniform sampler2D uTex1;
uniform sampler2D uTex2;
uniform sampler2D uTex3;
uniform sampler2D uTex4;
uniform sampler2D uSun0;
uniform sampler2D uSun1;
uniform sampler2D uSun2;
uniform sampler2D uSun3;
uniform sampler2D uSun4;
uniform float uHalf[5];
uniform int uRings;
uniform float uSunlit;
uniform float uProcedural;
varying vec3 vLocal;
varying vec3 vRel;             // from the rock's centre (km): small numbers, for exact derivatives
varying vec3 vNormal;
varying vec3 vObj;             // the rock's own frame (1 = its width): its grain
varying vec3 vAlbedo;
varying vec3 vGround;          // the ground's albedo around the rock
varying float vSun;
varying float vSize;
varying vec3 vViewPos;
varying vec2 vUv;
// the rock's frame → the patch frame for normals (the instance matrix's inverse transpose: its
// columns are orthogonal, each over its squared length)
varying vec3 vNx;
varying vec3 vNy;
varying vec3 vNz;

vec4 ringAt(sampler2D t, float halfSize, vec2 xz, float lod, out float inside) {
  vec2 uv = xz / (2.0 * halfSize) + 0.5;
  float m = max(abs(uv.x - 0.5), abs(uv.y - 0.5)) * 2.0;
  inside = 1.0 - smoothstep(0.82, 0.98, m);
  return textureLod(t, uv, lod);
}

void main() {
  vec2 c = instanceMatrix[3].xz;
  float w; vec4 s; float lod = 1.5;
  vec4 tex = vec4(0.0);
  if (uRings >= 5) tex = ringAt(uTex4, uHalf[4], c, lod, w);
  if (uRings >= 4) { s = ringAt(uTex3, uHalf[3], c, lod, w); tex = uRings == 4 ? s : mix(tex, s, w); }
  if (uRings >= 3) { s = ringAt(uTex2, uHalf[2], c, lod, w); tex = uRings == 3 ? s : mix(tex, s, w); }
  if (uRings >= 2) { s = ringAt(uTex1, uHalf[1], c, lod, w); tex = uRings == 2 ? s : mix(tex, s, w); }
  s = ringAt(uTex0, uHalf[0], c, lod, w); tex = uRings == 1 ? s : mix(tex, s, w);
  // none in the seas or on molten ground (marked in the maps' alpha)
  if (uProcedural > 0.5 && tex.a < 0.9) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  float sun = 1.0;
  if (uSunlit > 0.5) {
    if (uRings >= 5) sun = ringAt(uSun4, uHalf[4], c, 0.0, w).r;
    if (uRings >= 4) { float r = ringAt(uSun3, uHalf[3], c, 0.0, w).r; sun = uRings == 4 ? r : mix(sun, r, w); }
    if (uRings >= 3) { float r = ringAt(uSun2, uHalf[2], c, 0.0, w).r; sun = uRings == 3 ? r : mix(sun, r, w); }
    if (uRings >= 2) { float r = ringAt(uSun1, uHalf[1], c, 0.0, w).r; sun = uRings == 2 ? r : mix(sun, r, w); }
    float r0 = ringAt(uSun0, uHalf[0], c, 0.0, w).r; sun = uRings == 1 ? r0 : mix(sun, r0, w);
  }
  vSun = sun;
  vGround = tex.rgb;
  vAlbedo = tex.rgb * aRock.x;
  vSize = aRock.y;
  vObj = position;
  vec4 local = instanceMatrix * vec4(position, 1.0);
  vLocal = local.xyz;
  mat3 m = mat3(instanceMatrix);
  vRel = m * position;
  vNx = m[0] / dot(m[0], m[0]);
  vNy = m[1] / dot(m[1], m[1]);
  vNz = m[2] / dot(m[2], m[2]);
  vNormal = normalize(vNx * normal.x + vNy * normal.y + vNz * normal.z);
  vUv = uv;
  vec4 mv = modelViewMatrix * local;
  vViewPos = mv.xyz;
  gl_Position = projectionMatrix * mv;
  #include <logdepthbuf_vertex>
}
