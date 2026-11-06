#include <common>
#include <logdepthbuf_pars_vertex>
// Deep-sky landmarks (nebulae, clusters, remnants, record stars) as instanced billboards.
// `position` is the unit quad; instance attributes give the object in parsecs (scene frame).
attribute vec3 iPos;      // pc
attribute float iRadius;  // pc
attribute vec3 iColor;
attribute float iKind;    // 0 nebula, 1 cluster, 2 remnant, 3 star, 4 pulsar, 5 planetary nebula, 6 globular cluster
attribute float iAbsMag;
attribute float iSeed;
attribute float iIndex;
attribute float iImg;     // atlas slot of the photograph, −1 = procedural
attribute float iSpan;    // half-width of the sprite in object radii
attribute float iCloud;   // 0…1 share with which a volumetric cloud currently stands in for this object up close
attribute float iCat;     // 1: a survey-catalogue object (thousands of them), 0: hand-picked or generated landmark
uniform vec3 uCamPc;
uniform float uSkyRadius;
uniform float uPxPerRad;
uniform float uK;         // flux → alpha·px² calibration (shared with the galaxy sprites)
uniform float uHideIndex; // instance to hide (we are inside its system)
uniform float uCloudOn;   // 1 once the volumetric clouds exist: photographed sprites yield to them when resolved
uniform float uDaylight;  // 0 night sky … 1 drowned in a daytime sky
varying vec2 vUv;
// per-instance values: flat, since D3D11 (ANGLE) interpolates even a constant inexactly across
// the quad (2.9999 instead of 3) — enough to pick the wrong atlas slot or reseed the member stars
flat varying vec3 vColor;
flat varying float vAlpha;
flat varying float vKind;
flat varying float vSeed;
flat varying float vImg;
flat varying float vSpan;
flat varying float vPx;   // the object's radius on screen (px): the shape resolves with it

void main() {
  vec3 rel = iPos - uCamPc;
  float d = max(length(rel), 1e-6);
  vec3 dir = rel / d;
  float ratio = d / iRadius;
  float ang = atan(iRadius / d);
  float px = ang * uPxPerRad;
  bool star = iKind > 2.5 && iKind < 4.5;
  // the sprite reaches `iSpan` radii (1.6 for procedural shapes, the photo's field otherwise);
  // never smaller than a few pixels
  bool cat = iCat > 0.5;
  float halfPx = max(px * iSpan, star || cat ? 2.6 : 3.5);
  float halfAng = min(halfPx / uPxPerRad, 1.2);
  vec4 mv = modelViewMatrix * vec4(dir * uSkyRadius, 1.0);
  mv.xy += position.xy * uSkyRadius * tan(halfAng);
  gl_Position = projectionMatrix * mv;

  float m = iAbsMag + 5.0 * (log(d) / log(10.0)) - 5.0;
  float flux = pow(10.0, -0.4 * m);
  float alpha;
  if (star) {
    // navigation floor: record stars and pulsars stay findable from anywhere inside the Galaxy,
    // but from outside it thousands of them would pile up into a white blob – out there only
    // their physical flux counts
    float nav = 1.0 - smoothstep(8000.0, 40000.0, d);
    // the catalogue's thousands of pulsars only announce themselves in the neighbourhood: all
    // over the Galaxy they would grain the whole band with dots
    if (cat) nav *= 1.0 - smoothstep(150.0, 400.0, d);
    alpha = min(1.0, 0.2 * nav + 0.9 * pow(flux, 0.45));
  } else {
    // clusters spread their light over the drawn sprite: a tiny one stays a faint fuzzy point
    // instead of a minimum-size sprite at full surface brightness
    bool cluster = (iKind > 0.5 && iKind < 1.5) || (iKind > 5.5 && iKind < 6.5);
    // an unresolved nebula is drawn as a ~1 px blob, not a point
    float pxc = cluster ? max(px, halfPx / iSpan) : max(px, 1.2);
    float physical = min(uK * flux / (0.61 * pxc * pxc), 1.0);
    // navigation aid: stays clearly visible once we are within a few hundred radii (generated
    // globulars reach across the whole galaxy: theirs is tighter, farther out they are physical).
    // Remnants and planetaries are large and faint: a weaker floor, weaker still while they are
    // unresolved, so a few hundred of them don't tile the sky with grey rings
    bool shell = (iKind > 1.5 && iKind < 2.5) || (iKind > 4.5 && iKind < 5.5);
    float nearR = iKind > 5.5 ? 150.0 : shell ? 400.0 : 600.0;
    // … but up close, where the volumetric cloud carries them, they come up to full brightness
    float floorA = cluster ? 0.3 : shell ? 0.4 * mix(0.5, 1.0, smoothstep(1.5, 8.0, px)) + 0.45 * smoothstep(60.0, 12.0, ratio) : 0.6;
    float near = floorA * smoothstep(nearR, nearR * 0.1, ratio);
    if (cat) {
      // survey objects come in thousands along the band: one is no brighter than a star of its
      // integrated magnitude (the star shader's curve) — the surface-brightness calibration above
      // is the galaxy glow's, twenty times stronger — and the navigation floor only holds close
      // by, else they tile the Milky Way with white and pink blobs
      // resolved, the same curve on the flux per 2-px disc of the object's area
      float fluxEq = flux * 4.0 / max(px * px, 4.0);
      physical = min(1.0, 0.9 * pow(fluxEq, 0.45));
      near *= 0.5 * smoothstep(60.0, 6.0, ratio);
      // once its member stars are drawn one by one (ClusterStarPoints: 10 → 30 px), a cluster's
      // sprite steps back: an open cluster to a trace, a globular keeps its dense core's glow
      if (cluster) alpha = 0.0, physical *= 1.0 - (iKind > 5.5 ? 0.65 : 0.9) * smoothstep(10.0, 30.0, px), near *= 1.0 - 0.9 * smoothstep(10.0, 30.0, px);
    }
    alpha = max(physical, near);
  }
  // fade out when flying through it (a flat sprite would otherwise fill the screen)
  alpha *= smoothstep(0.8, 2.2, ratio);
  // the photograph is only the far LOD of its 3-D cloud (same curve as NebulaClouds.handover)
  float cloud = max(iCloud, (iImg >= 0.0 && uCloudOn > 0.5) ? 1.0 : 0.0);
  alpha *= 1.0 - cloud * smoothstep(8.0, 20.0, px);
  alpha *= 1.0 - uDaylight;
  if (abs(iIndex - uHideIndex) < 0.5) alpha = 0.0;
  if (alpha < 0.002) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);

  vUv = uv;
  vColor = iColor;
  vAlpha = alpha;
  vKind = iKind;
  vSeed = iSeed;
  vImg = iImg;
  vSpan = iSpan;
  vPx = px;
  #include <logdepthbuf_vertex>
}
