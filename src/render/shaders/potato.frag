// A small body's radius along one object-frame direction (surface.vert's shape), for the landing
// site: 16 bits over 0.25 … 1.75 radii in R and G.
uniform vec3 uDir;
uniform float uSeed;
uniform float uIrregular;

void main() {
  float r = smallBodyRadius(normalize(uDir), uSeed, uIrregular);
  float v = floor(clamp((r - 0.25) / 1.5, 0.0, 1.0) * 65535.0 + 0.5);
  gl_FragColor = vec4(floor(v / 256.0) / 255.0, mod(v, 256.0) / 255.0, 0.0, 1.0);
}
