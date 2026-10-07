#include <common>
#include <logdepthbuf_pars_vertex>
// Galaxy sprites. One point per galaxy; `position` is the centre in parsecs (scene frame,
// relative to the Sun). The fragment shader draws an analytic disc/ellipsoid with spiral arms.
attribute float radius;     // pc
attribute float absMag;
attribute float gtype;      // 0 E, 1 S0, 2 S, 3 SB, 4 Irr
attribute vec3 gnormal;     // disc normal (scene)
attribute vec3 gmajor;      // in-plane major axis (scene)
attribute float axisRatio;  // thickness (discs) or b/a (ellipticals)
attribute float seed;
attribute float gindex;
attribute vec3 spiral;      // (arm count, tan pitch, minor-arm weight) — same numbers as GalaxyModel
uniform vec3 uCamPc;
uniform float uPixelRatio;
uniform float uSkyRadius;
uniform float uPxPerRad;
uniform float uBoost;       // 0 = physical brightness, 1 = exaggerated (intergalactic view)
uniform float uK;           // flux → alpha·px² calibration (gain·π·pxPerRad²/1.17)
uniform float uMaxPx;
uniform float uHideIndex;
uniform float uTierFade;    // whole-layer LOD fade (local index ↔ far-universe tiers)
uniform float uBoostMag;    // magnitude offset of the boosted visibility scale (aggregated tiers)
uniform float uCatalogCount; // galaxies with index ≥ this are procedural
uniform vec4 uTint;         // rgb + strength: "procedural content" highlight
varying vec3 vColor;
varying float vAlpha;       // peak alpha
varying vec4 vInvSig;       // inverse 2x2 covariance (screen ellipse), columns
varying vec4 vDiscInv;      // inverse of [a c] (screen → disc plane), columns
varying float vEdge;        // 0 = edge-on (arms unusable), 1 = face-on
varying float vScale;       // sprite radius in units of galaxy radius
varying float vType;
varying float vSeed;
varying float vPx;          // apparent galaxy radius (px)
varying vec2 vMajor;        // projected major axis (screen, unit)
varying vec3 vSpiral;
varying float vProc;        // highlight strength (procedural galaxies only)

void main() {
  vSpiral = spiral;
  vec3 rel = position - uCamPc;
  float d = max(length(rel), 1e-3);
  vec3 dir = rel / d;
  vec4 mv = modelViewMatrix * vec4(dir * uSkyRadius, 1.0);
  gl_Position = projectionMatrix * mv;

  float px = uPxPerRad * radius / d;
  float ratio = d / radius;
  // hide when close: the point cloud takes over
  float lod = smoothstep(6.0, 12.0, ratio);
  // apparent magnitude → flux; spread over the apparent area gives a physically consistent
  // surface brightness (same calibration constant uK as the GalaxyCloud blobs)
  float m = absMag + 5.0 * (log(d) / log(10.0)) - 5.0;
  float flux = pow(10.0, -0.4 * m);
  float pxc = max(px, 0.75);
  float area = 0.61 * pxc * pxc;          // ∫ exp(-3.2 s) over the unit disc ≈ 0.61 R²
  float physical = min(uK * flux / area, 1.0);
  // exaggerated view for the cosmic web: m≈7 → fully bright, m≈17 → gone (nearer structure
  // dominates, which is what makes the web readable); uBoostMag shifts the scale per tier
  float boostA = clamp(1.0 - (m - uBoostMag - 7.0) / 10.0, 0.0, 1.0);
  float peak = mix(physical, max(physical, boostA), uBoost) * lod * uTierFade;

  // screen-space axes (view rotation only)
  mat3 R = mat3(modelViewMatrix);
  vec3 a = R * gmajor;
  vec3 n = R * gnormal;
  vec3 c = R * cross(gmajor, gnormal);
  // for a sphere-ish elliptical, thickness = axisRatio along the normal; discs: thin
  float t = gtype < 0.5 ? axisRatio : max(axisRatio, 0.06);
  // 2x2 covariance of the projected ellipsoid
  vec2 A = a.xy, N = n.xy * t, C = c.xy;
  float sxx = A.x * A.x + N.x * N.x + C.x * C.x;
  float sxy = A.x * A.y + N.x * N.y + C.x * C.y;
  float syy = A.y * A.y + N.y * N.y + C.y * C.y;
  float det = sxx * syy - sxy * sxy;
  det = max(det, 1e-5);
  vInvSig = vec4(syy, -sxy, -sxy, sxx) / det;
  // disc-plane inverse for arm pattern
  float ddet = A.x * C.y - A.y * C.x;
  vEdge = smoothstep(0.08, 0.45, abs(ddet));
  float sd = abs(ddet) < 1e-4 ? 1e-4 : ddet;
  vDiscInv = vec4(C.y, -A.y, -C.x, A.x) / sd;
  // the longest projected in-plane direction (for the dust lane of edge-on discs)
  vMajor = normalize(length(A) > length(C) ? A + vec2(1e-6, 0.0) : C + vec2(1e-6, 0.0));

  // unresolved galaxies get a minimum footprint (larger in the boosted intergalactic view)
  float pxDraw = max(px, mix(1.0, 3.5, uBoost));
  float spritePx = min(pxDraw * 2.1, uMaxPx);
  vScale = spritePx / pxDraw;
  vPx = px;
  vType = gtype;
  vSeed = seed;
  vAlpha = peak;
  if (peak < 0.002 || abs(gindex - uHideIndex) < 0.5) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    spritePx = 0.0;
  }
  gl_PointSize = spritePx * uPixelRatio;
  // colour: ellipticals & bulges warm, spiral discs bluish-white, irregulars blue
  vColor = gtype < 1.5 ? vec3(1.0, 0.86, 0.68) : gtype < 3.5 ? vec3(0.92, 0.92, 1.0) : vec3(0.78, 0.86, 1.0);
  // cosmological redshift: light from Gpc distances arrives reddened (z ≈ 0.25 at 1 Gpc … ≫1 at the horizon)
  float redshift = smoothstep(8.0e8, 1.3e10, d);
  vColor = mix(vColor, vec3(1.0, 0.42, 0.22), redshift * 0.85);
  vProc = gindex >= uCatalogCount - 0.5 ? uTint.a : 0.0;
  #include <logdepthbuf_vertex>
}
