// Nebula Engine 2.0 — density bake. One z slice of the object's cube [-1.3, 1.3]³ per draw: the
// procedural medium (sampleMedium, the dearest part of a raymarch step) stored once, so the
// raymarch reads a texel instead of evaluating a dozen noise octaves per sample.
// Encoding: r = √(gas/4), g = √(dust/4) (resolution where the medium is thin), b = hot.
// Composed after common.glsl, volume_common.glsl, nebula_density.glsl and nebula_lighting.glsl.
uniform float uLayer;
uniform float uGrid;

void main() {
  vec3 uvw = vec3(gl_FragCoord.xy / uGrid, (uLayer + 0.5) / uGrid);
  Medium m = sampleMedium((uvw - 0.5) * 2.6);
  gl_FragColor = vec4(sqrt(clamp(m.gas * 0.25, 0.0, 1.0)), sqrt(clamp(m.dust * 0.25, 0.0, 1.0)), clamp(m.hot, 0.0, 1.0), 1.0);
}
