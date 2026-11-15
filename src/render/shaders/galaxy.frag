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
varying float vPec;
varying vec4 vAxes;
varying vec2 vNormal;
varying vec4 vRing0;
varying vec4 vRing1;
varying vec4 vRingOff;
uniform vec4 uTint;
uniform sampler2D uPec;

float hash1(float n) { n = fract(n * 0.1031); n *= n + 33.33; n *= n + n; return fract(n); }

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

// The galaxy itself (a peculiar one's host): p in its radii, px its apparent radius (px)
float bodyLight(vec2 p, float px, out vec3 col) {
  float rr = length(p);
  mat2 invSig = mat2(vInvSig.xy, vInvSig.zw);
  float q = dot(p, invSig * p);      // squared "ellipsoidal" radius
  float s = sqrt(max(q, 0.0));
  col = vColor;
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
    float armStrength = (vType > 1.5 ? 0.85 : 0.2) * vEdge * smoothstep(0.08, 0.25, rho) * smoothstep(3.0, 14.0, px);
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
    float dust = (1.0 - vEdge) * exp(-pow(dot(p, perp) / 0.035, 2.0)) * smoothstep(0.0, 0.5, rr) * smoothstep(8.0, 30.0, px);
    b *= 1.0 - 0.55 * dust;
  }
  return b;
}

vec4 pecTexel(int k, int row) { return texelFetch(uPec, ivec2(k, row), 0); }

// a plane's coordinates (x, z) under screen point u, from its projected axes ax = (x axis, z axis);
// `cosI` gets the area factor, held off zero so an edge-on plane stays a line of finite brightness
vec2 planeCoords(vec2 u, vec4 ax, out float cosI) {
  float det = ax.x * ax.w - ax.y * ax.z;
  float sd = (det < 0.0 ? -1.0 : 1.0) * max(abs(det), 0.12);
  cosI = abs(sd);
  return vec2(ax.w * u.x - ax.z * u.y, -ax.y * u.x + ax.x * u.y) / sd;
}

// star-forming complexes round a ring: one in each of 22 cells, at a random place in it (across
// the ring too: x in widths off the crest) and of random strength; mean ≈ 0.5 on the crest
float ringKnots(float phi, float x, float salt) {
  float u = (phi / 6.2831853 + 0.5) * 22.0;
  float c0 = floor(u);
  float s = 0.0;
  for (int j = -1; j <= 1; j++) {
    float c = c0 + float(j);
    float cm = mod(c, 22.0);
    float h3 = hash1(cm * 5.3 + salt + 3.0);
    float du = u - c - hash1(cm * 1.37 + salt);
    float dx = x - (hash1(cm * 2.91 + salt + 7.0) - 0.5) * 1.6;
    s += (0.2 + 2.4 * h3 * h3) * exp(-du * du / 0.0968 - dx * dx / 0.405);
  }
  return s;
}

vec3 youngColour(float young) {
  return mix(vec3(1.0, 0.86, 0.68), vec3(0.62, 0.76, 1.0), young);
}

// Rings and tidal tails of a peculiar galaxy (src/galaxy/peculiar.ts) over its host. Each part
// carries its share of the light: the in-plane integral of its profile was normalised to it.
float peculiarLight(vec2 p, out vec3 col) {
  int row = int(vPec + 0.5) - 1;
  vec4 head = pecTexel(0, row);   // host radius, rings, tails, host's share of the light
  float body = head.x;
  vec2 pb = p;
  float bend = pecTexel(15, row).x;
  if (bend != 0.0) {
    // integral-sign warp: along the major axis the rim leaves the plane, up on one side, down on the other
    float x = dot(p, vAxes.xy) / max(dot(vAxes.xy, vAxes.xy), 1e-6);
    float h = max(0.0, abs(x) / body - 0.4) / 0.6;
    pb -= vNormal * bend * sign(x) * h * h;
  }
  vec3 bc;
  // the host's profile at its own scale, its light scaled to its share
  float b = bodyLight(pb / body, vPx * body, bc) * head.w / (body * body);
  vec3 acc = bc * b;
  // features thinner than a pixel are widened (same light), or they would shimmer
  float wMin = 0.8 / max(vPx, 1.0);
  float beads = smoothstep(8.0, 40.0, vPx);
  for (int i = 0; i < 2; i++) {
    if (float(i) >= head.y) break;
    int k = 1 + 5 * i;
    vec4 ax = i == 0 ? vRing0 : vRing1;
    vec2 off = i == 0 ? vRingOff.xy : vRingOff.zw;
    float cosI;
    vec2 uv = planeCoords(p - off, ax, cosI);
    float r = pecTexel(k, row).w, w = pecTexel(k + 1, row).w;
    vec4 t2 = pecTexel(k + 2, row), t3 = pecTexel(k + 3, row), t4 = pecTexel(k + 4, row);
    vec4 t5 = pecTexel(16 + 2 * i, row), t6 = pecTexel(17 + 2 * i, row);
    float rho = length(uv);
    float phi = rho > 1e-6 ? atan(uv.y, uv.x) : 0.0;
    // wobbling width and wandering crest, a sharper inner than outer edge (Peculiar.ringPlane)
    float wf = 1.0 + t5.z * sin(3.0 * phi + 0.4);
    float dr = rho - (r + t5.z * w * sin(2.0 * phi + 1.9));
    float ws = (dr < 0.0 ? t5.x : t5.y) * wf;
    float we = max(ws, wMin);
    // tightly wound strands, resolved once the ring is some pixels wide
    float x = dr / (w * wf);
    float st = 1.0;
    if (t6.x > 0.5) {
      float c = 1.0 + cos(t6.x * phi + t6.y * x + 1.2 * sin(2.0 * phi + 0.5));
      float seg = 0.3 + 0.35 * (1.0 + sin(3.0 * phi + 2.1 + 0.9 * sin(5.0 * phi + 0.3)));
      st = 1.0 + t6.z * beads * seg * exp(-0.5 * x * x) * (c * c / 1.5 - 1.0);
    }
    float prof = exp(-dr * dr / (2.0 * we * we)) * (ws / we) * st * (1.0 - (1.0 - t3.x) * 0.5 * (1.0 - cos(phi - t3.y)));
    if (t3.z > 0.5) {
      float kk = phi * t3.z / 6.2831853;
      float across = rho * (kk - floor(kk + 0.5)) * 6.2831853 / t3.z;
      float win = smoothstep(t3.w, t3.w + 0.06, rho) * (1.0 - smoothstep(r - 2.5 * w, r - w, rho));
      float swe = max(t4.x, wMin);
      prof += 0.35 * exp(-across * across / (2.0 * swe * swe)) * (t4.x / swe) * win;
    }
    // star-forming complexes scattered along it (≈ the same light)
    float kn = ringKnots(phi, x, vSeed + float(i) * 3.0);
    prof *= mix(1.0, 0.4 + kn, t4.z * beads);
    float f = t2.w * prof / cosI;
    float young = clamp(t4.y * (0.75 + 0.25 * st), 0.0, 1.0);
    acc += f * mix(youngColour(young), vec3(1.0, 0.45, 0.65), 0.15 * t4.z * t4.y * min(kn, 1.5) * beads);
    b += f;
  }
  for (int i = 0; i < 2; i++) {
    if (float(i) >= head.z) break;
    int k = 11 + 2 * i;
    vec4 t0 = pecTexel(k, row), t1 = pecTexel(k + 1, row);
    float cosI;
    vec2 uv = planeCoords(p, vAxes, cosI);
    float rho = length(uv);
    float dr = t0.w - t0.z;
    float s = (rho - t0.z) / dr;
    if (s < -0.15 || s > 1.0) continue;
    float sc = max(s, 0.0);
    float w = mix(t1.x, t1.y, sc);
    float we = max(w, wMin);
    float d = (rho > 1e-6 ? atan(uv.y, uv.x) : 0.0) - (t0.x + t0.y * s);
    d = atan(sin(d), cos(d));
    float across = rho * d * dr / length(vec2(dr, rho * t0.y));
    float env = smoothstep(-0.15, 0.08, s) * pow(1.0 - clamp(s, 0.0, 1.0), 0.7);
    float f = t1.z * env * exp(-across * across / (2.0 * we * we)) * (w / we) / cosI;
    acc += f * youngColour(t1.w);
    b += f;
  }
  col = acc / max(b, 1e-6);
  return b;
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

  vec3 col;
  float b = vPec > 0.5 ? peculiarLight(p, col) : bodyLight(p, vPx, col);
  // unresolved galaxies: blend toward a plain gaussian blob so tiny sprites still show up
  float small = 1.0 - smoothstep(1.5, 5.0, vPx);
  b = mix(b, exp(-rr * rr * 2.5), small);
  // soft outer edge of the sprite so a clamped sprite doesn't show a hard border
  float edge = 1.0 - smoothstep(0.85, 1.0, length(gl_PointCoord * 2.0 - 1.0));
  float a = min(b * vAlpha, 1.0) * edge;
  col = mix(col, uTint.rgb, vProc);
  gl_FragColor = vec4(col * a, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
