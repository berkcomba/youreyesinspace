// ---------------------------------------------------------------------------
// Shared raymarching helpers for the volumetric galaxies and nebulae. Every volume renders into a
// low-resolution buffer holding (emitted light, transmittance); see Volumes.ts.
// ---------------------------------------------------------------------------
varying vec2 vUv;
uniform mat4 uInvProj;   // camera projection inverse
uniform mat3 uCamRot;    // camera → scene rotation
uniform mat3 uToLocal;   // scene → object-local rotation
uniform vec3 uOrigin;    // camera in object-local units (object radius = 1)
uniform vec3 uBox;       // half extents of the object's bounding box (local units)
uniform float uSteps;
uniform float uFade;     // LOD / visibility (0 … 1)
uniform float uEmit;     // emission calibration
uniform float uSeed;

// from the projection's tan(half fov) terms: unprojecting a clip point would divide by w ≈ 0
// with the astronomical far plane
vec3 viewRay() {
  vec2 ndc = vUv * 2.0 - 1.0;
  vec3 v = vec3(ndc.x * uInvProj[0][0], ndc.y * uInvProj[1][1], -1.0);
  return normalize(uToLocal * (uCamRot * normalize(v)));
}

// slab test: (tNear, tFar), tFar < tNear on a miss
vec2 boxHit(vec3 o, vec3 d, vec3 b) {
  vec3 inv = 1.0 / (abs(d) + 1e-9) * sign(d + 1e-12);
  vec3 t0 = (-b - o) * inv, t1 = (b - o) * inv;
  vec3 tmin = min(t0, t1), tmax = max(t0, t1);
  return vec2(max(max(tmin.x, tmin.y), max(tmin.z, 0.0)), min(min(tmax.x, tmax.y), tmax.z));
}

// ray ∩ sphere of radius R about the origin: (tNear, tFar), tFar < tNear on a miss
vec2 sphereHit(vec3 o, vec3 d, float R) {
  float b = dot(o, d);
  // from the line's closest point to the centre: b² − (|o|² − R²) loses the sphere to rounding once
  // the camera is hundreds of radii away (the small, distant nebulae)
  vec3 q = o - b * d;
  float h = R * R - dot(q, q);
  if (h < 0.0) return vec2(1.0, -1.0);
  h = sqrt(h);
  return vec2(max(-b - h, 0.0), -b + h);
}

float sq(float x) { return x * x; }

float stepJitter() {
  // white noise: a structured pattern would turn into visible hatching once upscaled
  vec2 q = fract(gl_FragCoord.xy * vec2(0.1031, 0.1030));
  q += dot(q, q.yx + 33.33);
  return fract((q.x + q.y) * q.x);
}

// Light emitted along a step of optical depth tau, seen through the medium in front of it
float stepWeight(float tau) {
  return tau > 1e-4 ? (1.0 - exp(-tau)) / tau : 1.0 - 0.5 * tau;
}
