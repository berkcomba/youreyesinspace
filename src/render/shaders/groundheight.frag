// Height map of one ground ring (see ground_common.glsl): the height in km above the ellipsoid,
// encoded as 24 bits over uRange (hmin, hmax) in R, G, B; A = 1 on open water.
uniform vec2 uRange;
void main() {
  bool water; float hn;
  float h = groundHeight(localXZ(), water, hn);
  float t = clamp((h - uRange.x) / (uRange.y - uRange.x), 0.0, 1.0);
  float v = floor(t * 16777215.0 + 0.5);
  float r = floor(v / 65536.0);
  float g = floor((v - r * 65536.0) / 256.0);
  float b = v - r * 65536.0 - g * 256.0;
  gl_FragColor = vec4(r, g, b, water ? 255.0 : 0.0) / 255.0;
}
