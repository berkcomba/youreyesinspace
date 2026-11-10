// The shadows of the rocks strewn over a landing ground (GroundRocks.ts): their depth seen from
// the Sun over a few tens of metres around the visitor.
uniform sampler2D uRockShadow;
uniform mat4 uRockShadowMat;   // patch frame → the Sun's view (clip space)
uniform float uRockShadowOn;   // 1 while the map is current
uniform float uRockShadowTexel;

// 1 in the Sun, 0 in a rock's shadow (`p`: patch frame, km; `bias` in depth units)
float rockShadow(vec3 p, float bias) {
  if (uRockShadowOn < 0.5) return 1.0;
  vec4 s = uRockShadowMat * vec4(p, 1.0);
  float edge = 1.0 - smoothstep(0.8, 0.98, max(abs(s.x), abs(s.y)));
  if (edge <= 0.0 || s.z > 1.0) return 1.0;
  vec3 c = s.xyz * 0.5 + 0.5;
  float d = c.z - bias, t = uRockShadowTexel, lit = 0.0;
  lit += step(d, texture2D(uRockShadow, c.xy + vec2(-0.6, -1.4) * t).r);
  lit += step(d, texture2D(uRockShadow, c.xy + vec2(1.4, -0.6) * t).r);
  lit += step(d, texture2D(uRockShadow, c.xy + vec2(0.6, 1.4) * t).r);
  lit += step(d, texture2D(uRockShadow, c.xy + vec2(-1.4, 0.6) * t).r);
  return mix(1.0, lit * 0.25, edge);
}
