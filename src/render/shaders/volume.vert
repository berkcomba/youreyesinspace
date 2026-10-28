// Full-screen triangle at the far plane (depth 1): passes only where nothing opaque was drawn,
// so volumes stay behind planets, moons and ships.
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 1.0, 1.0);
}
