// The rocks seen from the Sun (GroundRocks.renderShadows): depth only, in a plain orthographic view.
void main() {
  gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
}
