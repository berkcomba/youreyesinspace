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

float hash1(float n) { return fract(sin(n * 12.9898 + 78.233) * 43758.5453); }

void main() {
  #include <logdepthbuf_fragment>
  // p: offset in units of the galaxy radius (|p| = 1 ↔ visible edge)
  vec2 p = (gl_PointCoord * 2.0 - 1.0) * vScale;
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
    float arms = vType > 2.5 ? 2.0 : 2.0 + floor(hash1(vSeed) * 2.0);
    float pitch = 0.2 + 0.18 * hash1(vSeed + 3.0);
    float phase = theta - log(max(rho, 0.02)) / pitch + vSeed * 0.1;
    float arm = clamp(0.5 + 0.5 * cos(arms * phase), 0.0, 1.0);
    arm = pow(arm, 2.5);
    float armStrength = (vType > 1.5 ? 0.85 : 0.2) * vEdge * smoothstep(0.08, 0.25, rho) * smoothstep(3.0, 14.0, vPx);
    disc *= mix(1.0, 0.35 + 1.5 * arm, armStrength);
    // bar
    if (vType > 2.5) {
      float bar = exp(-pow(uv.y / 0.06, 2.0)) * smoothstep(0.4, 0.15, rho) * vEdge;
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
  gl_FragColor = vec4(col * a, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
