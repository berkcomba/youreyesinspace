#include <common>
#include <logdepthbuf_pars_vertex>
// Meteor streak: one camera-facing ribbon per instance, stretched from the glowing head back
// along the flight direction. Every meteor of a shower flies parallel (uDir = away from the
// radiant); positions are kilometres relative to the body's centre (uBodyRel = centre − camera).
//
// position.x: 0 = end of the trail … 1 = head;  position.y: −1 … 1 across the ribbon
attribute vec3 iStart;   // where the streak begins (km, body-relative)
attribute float iBirth;  // uTime at which it appeared (s)
attribute float iLife;   // visible duration (s)
attribute float iTravel; // distance flown over its life (km)
attribute float iLen;    // full trail length (km)
attribute float iWidth;  // ribbon width (px)
attribute float iKind;   // 0 = ordinary, 1 = fireball
attribute float iSeed;

uniform vec3 uBodyRel;
uniform vec3 uDir;
uniform float uTime;
uniform float uPxPerRad;

varying float vAlong;
varying float vAcross;
varying float vGlow;
varying float vKind;
varying float vSeed;

void main() {
  float p = (uTime - iBirth) / max(iLife, 1e-3);
  if (p <= 0.0 || p >= 1.0 || iLife <= 0.0) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    vAlong = vAcross = vGlow = vKind = vSeed = 0.0;
    return;
  }
  // the head decelerates slightly as it burns; the trail grows in behind it and is swallowed at the end
  float travel = iTravel * (p - 0.12 * p * p);
  float trail = iLen * smoothstep(0.0, 0.35, p) * (1.0 - smoothstep(0.78, 1.0, p));
  vec3 head = uBodyRel + iStart + uDir * travel;
  vec3 tail = head - uDir * trail;
  vec3 pos = mix(tail, head, position.x);
  // camera at the origin: screen-perpendicular to the streak
  vec3 side = normalize(cross(uDir, normalize(head)));
  float widthKm = iWidth * length(pos) / uPxPerRad;
  pos += side * position.y * widthKm;

  // brightness over life: flares up as it bites into the air, peaks, then dies out quickly.
  float rise = smoothstep(0.0, 0.3, p);
  float die = 1.0 - smoothstep(0.82, 1.0, p);
  float glow = rise * die;
  // a fireball bursts just before the end
  float burst = exp(-pow((p - 0.8) / 0.06, 2.0)) * iKind;
  vGlow = glow + burst * 2.2;
  vAlong = position.x;
  vAcross = position.y;
  vKind = iKind;
  vSeed = iSeed;

  vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mvPos;
  #include <logdepthbuf_vertex>
}
