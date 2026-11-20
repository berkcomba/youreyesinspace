// Nebula Engine 2.0 — source bake for the point-cloud nebulae (volumetrics off): the raymarched
// medium's own emission and extinction on a coarse grid over the object's cube [-1.3, 1.3]³, so
// the points that stand in for the volume have its shape and colours. All z slices side by side
// in one row (x = layer · grid + i), read back once.
// Composed after common.glsl, volume_common.glsl, nebula_density.glsl and nebula_lighting.glsl.
uniform float uGrid;

void main() {
  float layer = floor(gl_FragCoord.x / uGrid);
  vec2 xy = vec2(gl_FragCoord.x - layer * uGrid, gl_FragCoord.y);
  vec3 p = (vec3(xy / uGrid, (layer + 0.5) / uGrid) - 0.5) * 2.6;
  Medium m = sampleMedium(p);
  if (m.gas + m.dust < 2e-4) { gl_FragColor = vec4(0.0); return; }
  // rgb: radiance emitted per unit length (object radii); a: extinction per unit length
  gl_FragColor = vec4(nebulaSource(p, m), nebulaExtinction(m));
}
