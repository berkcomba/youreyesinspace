#include <logdepthbuf_pars_fragment>
varying vec3 vColor;
varying float vAlpha;
varying vec4 vInvSig;
varying vec4 vDiscInv;
varying float vEdge;
varying float vScale;
varying float vType;
varying float vSeed;
varying float vPx;
varying vec2 vMajor;
varying vec3 vSpiral;
varying float vProc;
uniform vec4 uTint;

float hash1(float n) { return fract(sin(n * 12.9898 + 78.233) * 43758.5453); }

// Angular distance (rad, weighted) to the nearest arm ridge — mirrors GalaxyModel.armDistance so
// the sprite fades into a point cloud with the very same arms. rho in galaxy radii.
float armDistance(float rho, float theta, bool barred) {
  float n = max(vSpiral.x, 1.0);
  float tanP = max(vSpiral.y, 0.05);
  float r0 = barred ? 0.3 : 0.072;          // bar length / 0.8 × bulge radius
  float base = log(max(rho, r0) / r0) / tanP;
  float phase0 = barred ? 0.0 : 0.3;
  float best = 3.14159265;
  for (int k = 0; k < 6; k++) {
    if (float(k) >= n) break;
    float d = theta - (base + 6.2831853 * float(k) / n + phase0);
    d = atan(sin(d), cos(d));
    float w = (barred && n > 2.5 && mod(float(k), 2.0) > 0.5) ? vSpiral.z : 1.0;
    best = min(best, abs(d) / w);
  }
  return best;
}

void main() {
  #include <logdepthbuf_fragment>
  // p: offset in units of the galaxy radius (|p| = 1 ↔ visible edge). gl_PointCoord has its
  // origin top-left (y down) while the projected axes in vInvSig/vDiscInv are view-space (y up),
  // so flip y — otherwise the sprite is a mirror image of the point cloud it hands over to.
  vec2 p = (gl_PointCoord * 2.0 - 1.0) * vScale;
  p.y = -p.y;
  float rr = length(p);
  if (length(gl_PointCoord * 2.0 - 1.0) > 1.0) discard;

  mat2 invSig = mat2(vInvSig.xy, vInvSig.zw);
  float q = dot(p, invSig * p);      // squared "ellipsoidal" radius
  float s = sqrt(max(q, 0.0));

  vec3 col = vColor;
  float b;
  if (vType < 0.5) {
    // elliptical: Sérsic n≈2 profile, Re = 0.5 R
    float x = sqrt((s + 0.03) / 0.5);
    b = exp(-3.67 * (x - 1.0)) / 16.0;
  } else if (vType > 3.5) {
    // irregular: a few bright clumps
    b = 0.0;
    for (int k = 0; k < 4; k++) {
      float fk = float(k) + vSeed * 0.013;
      vec2 c = (vec2(hash1(fk * 1.7), hash1(fk * 3.1 + 5.0)) - 0.5) * 0.9;
      float sg = 0.18 + 0.2 * hash1(fk * 7.3);
      b += (0.5 + 0.5 * hash1(fk * 2.9)) * exp(-dot(p - c, p - c) / (2.0 * sg * sg));
    }
    b = min(b, 1.0) * 0.8;
    col = mix(vColor, vec3(1.0, 0.7, 0.8), 0.25);
  } else {
    // disc: exponential profile in the ellipsoidal radius
    float disc = exp(-3.2 * s);
    // spiral arms (disc-plane coordinates via the inverse projection)
    mat2 dinv = mat2(vDiscInv.xy, vDiscInv.zw);
    vec2 uv = dinv * p;
    float rho = length(uv);
    // atan(0,0) is undefined (NaN on some GPUs) – nudge the centre pixel
    float theta = rho > 1e-6 ? atan(uv.y, uv.x) : 0.0;
    bool barred = vType > 2.5;
    float da = armDistance(rho, theta, barred);
    float arm = exp(-da * da / (2.0 * 0.34 * 0.34));   // GalaxyModel: armW = 0.34
    float armStrength = (vType > 1.5 ? 0.85 : 0.2) * vEdge * smoothstep(0.08, 0.25, rho) * smoothstep(3.0, 14.0, vPx);
    disc *= mix(1.0, 0.41 + 1.19 * arm, armStrength);  // (0.55 + 1.6·arm) / 1.35
    // bar along the local x axis, width 0.25 × bar length (GalaxyModel)
    if (barred) {
      float bar = exp(-pow(uv.y / 0.075, 2.0)) * smoothstep(0.4, 0.15, rho) * vEdge;
      disc += bar * 0.6;
    }
    // bulge (spherical)
    float bulgeW = vType < 1.5 ? 0.9 : 0.55;
    float bulge = exp(-rr * (vType < 1.5 ? 5.0 : 9.0)) * bulgeW;
    b = min(1.0, disc * 0.6 + bulge);
    // colour: warm core, bluer arms
    vec3 discCol = vType < 1.5 ? vec3(1.0, 0.9, 0.75) : mix(vec3(0.95, 0.9, 0.8), vec3(0.72, 0.8, 1.0), armStrength * arm);
    col = mix(discCol, vec3(1.0, 0.85, 0.65), clamp(bulge / max(b, 1e-3), 0.0, 1.0));
    // dust lane for near-edge-on discs
    vec2 perp = vec2(-vMajor.y, vMajor.x);
    float dust = (1.0 - vEdge) * exp(-pow(dot(p, perp) / 0.035, 2.0)) * smoothstep(0.0, 0.5, rr) * smoothstep(8.0, 30.0, vPx);
    b *= 1.0 - 0.55 * dust;
  }
  // unresolved galaxies: blend toward a plain gaussian blob so tiny sprites still show up
  float small = 1.0 - smoothstep(1.5, 5.0, vPx);
  b = mix(b, exp(-rr * rr * 2.5), small);
  // soft outer edge of the sprite so a clamped sprite doesn't show a hard border
  float edge = 1.0 - smoothstep(0.85, 1.0, length(gl_PointCoord * 2.0 - 1.0));
  float a = b * vAlpha * edge;
  col = mix(col, uTint.rgb, vProc);
  gl_FragColor = vec4(col * a, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
