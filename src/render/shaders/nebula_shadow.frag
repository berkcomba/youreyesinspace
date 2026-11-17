// Nebula Engine 2.0 — light transmittance bake. One layer (z slice) of the object's cube
// [-1.3, 1.3]³ per draw: for every voxel, how much of each embedded star's light gets through the
// medium on the way from the star (exp(−τ) along the segment star → voxel, the same extinction the
// raymarch uses). Channel i holds light i; the raymarch reads it in ionisation(), so the dust
// casts shadows: pillars lit on the side facing the cluster and dark behind, light escaping
// through the gaps of a cloud in shafts.
// Composed after common.glsl, volume_common.glsl, nebula_density.glsl and nebula_lighting.glsl.
uniform float uLayer;      // z slice index
uniform float uGrid;       // voxels per side
uniform float uBakeSteps;  // samples per star → voxel segment

float lightT(vec3 p, int i) {
  vec3 a = uLights[i].xyz;
  vec3 seg = p - a;
  float len = length(seg);
  if (len < 1e-4) return 1.0;
  // the segment inside the medium's sphere only (the stars are inside it; a voxel may be outside)
  vec2 hit = sphereHit(a, seg / len, 1.3);
  float t1 = min(len, max(hit.y, 0.0));
  if (t1 <= 0.0) return 1.0;
  float ds = t1 / uBakeSteps;
  float tau = 0.0;
  // fixed mid-point samples: every voxel of a slice must see the same pattern, or the jitter
  // becomes grain once the grid is magnified
  for (int k = 0; k < 64; k++) {
    if (float(k) >= uBakeSteps) break;
    vec3 q = a + seg / len * ((float(k) + 0.5) * ds);
    Medium m = mediumAt(q, false);
    if (m.gas + m.dust < 2e-4) continue;
    tau += nebulaExtinction(m) * ds;
    if (tau > 8.0) break;
  }
  return exp(-tau);
}

void main() {
  vec3 uvw = vec3(gl_FragCoord.xy / uGrid, (uLayer + 0.5) / uGrid);
  vec3 p = (uvw - 0.5) * 2.6;
  vec4 T = vec4(1.0);
  for (int i = 0; i < 4; i++) {
    if (i >= uNLights) break;
    float t = lightT(p, i);
    if (i == 0) T.x = t; else if (i == 1) T.y = t; else if (i == 2) T.z = t; else T.w = t;
  }
  gl_FragColor = T;
}
