#include <common>
#include <logdepthbuf_pars_vertex>

// Eruptive plumes (Io's umbrellas, Enceladus' jets): each point is one parcel of gas and dust on
// a ballistic arc from its vent, a pure function of its phase in the flight. Body frame (km).

#define N_VENT 8

attribute float aVent;          // vent slot
attribute vec4 aRand;           // phase, launch azimuth, launch angle (0 straight up … 1 wide), size

uniform vec4 uVent[N_VENT];     // xyz = vent on the surface (body frame, km), w = 1 active
uniform float uHeight;          // plume height (km)
uniform float uSpread;          // radius of the canopy / fallout ring (km)
uniform float uFall;            // 1 = fountain falling back, 0 = jets escaping
uniform float uTime;            // seconds
uniform float uVis;             // 0..1
uniform float uPxPerKmAt1;      // px per km at 1 km (projection scale)

varying vec3 vWorldPos;
varying float vAlpha;
varying float vT;

void main() {
  vec4 vent = uVent[int(aVent + 0.5)];
  vec3 up = normalize(vent.xyz);
  vec3 ref = abs(up.y) < 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
  vec3 e1 = normalize(cross(up, ref));
  vec3 e2 = cross(up, e1);
  // one flight takes ~90 s of wall time (the real arcs last tens of minutes; the eye wants motion)
  float t = fract(aRand.x + uTime / 90.0);
  float a = aRand.z * aRand.z;              // most parcels go up nearly straight
  float ang = aRand.y * 6.2831853;
  // the arc: a fountain rises and falls back; an escaping jet just keeps going (then fades)
  float rise = mix(t, 4.0 * t * (1.0 - t), uFall);
  float y = uHeight * rise * (1.0 - 0.45 * a * uFall);
  // lateral: launch angle sets how far out it lands; escaping jets spread as a cone
  float r = uSpread * t * mix(0.15 + 0.85 * a, 0.25 + 0.75 * a, uFall);
  // a light wind: the whole column leans a little downrange (visible on the low Triton plumes)
  float lean = (1.0 - uFall) * uSpread * 0.5 * t * t;
  vec3 pos = vent.xyz + up * y + e1 * (cos(ang) * r + lean) + e2 * (sin(ang) * r);

  vec4 wp = modelMatrix * vec4(pos, 1.0);
  float dist = max(length(wp.xyz), 1e-3);
  if (vent.w < 0.5 || uVis <= 0.001) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    gl_PointSize = 1.0; vAlpha = 0.0; vWorldPos = vec3(0.0); vT = 0.0;
    return;
  }
  // parcels expand as they climb; the column thins accordingly
  float sizeKm = (0.02 + 0.09 * t) * max(uHeight, uSpread) * (0.6 + 0.8 * aRand.w);
  float px = sizeKm / dist * uPxPerKmAt1;
  gl_PointSize = clamp(px, 1.5, 90.0);
  float thin = px < 1.5 ? px / 1.5 : 1.0;
  // up close the parcels overlap heavily: thin them so the column stays translucent
  thin *= 1.0 - 0.6 * smoothstep(20.0, 90.0, px);
  vAlpha = uVis * pow(1.0 - t, 1.3) * smoothstep(0.0, 0.03, t) * (0.6 + 0.4 * aRand.w) * thin * thin;
  vT = t;
  vWorldPos = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
  #include <logdepthbuf_vertex>
}
