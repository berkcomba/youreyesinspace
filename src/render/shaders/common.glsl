// ---------------------------------------------------------------------------
// Shared GLSL: hashing, simplex noise, fbm, craters, shadows, ring density
// ---------------------------------------------------------------------------

vec3 hash33(vec3 p) {
  p = vec3(dot(p, vec3(127.1, 311.7, 74.7)),
           dot(p, vec3(269.5, 183.3, 246.1)),
           dot(p, vec3(113.5, 271.9, 124.6)));
  return fract(sin(p) * 43758.5453123);
}

float hash13(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

// Ashima Arts simplex 3D noise
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(
      i.z + vec4(0.0, i1.z, i2.z, 1.0))
    + i.y + vec4(0.0, i1.y, i2.y, 1.0))
    + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}

float fbm(vec3 p, int octaves) {
  float v = 0.0;
  float a = 0.5;
  float sum = 0.0;
  for (int i = 0; i < 10; i++) {
    if (i >= octaves) break;
    v += a * snoise(p);
    sum += a;
    p = p * 2.03 + vec3(17.3, 9.1, 5.7);
    a *= 0.5;
  }
  return v / sum;
}

float ridged(vec3 p, int octaves) {
  float v = 0.0;
  float a = 0.5;
  float sum = 0.0;
  for (int i = 0; i < 8; i++) {
    if (i >= octaves) break;
    float n = 1.0 - abs(snoise(p));
    n *= n;
    v += a * n;
    sum += a;
    p = p * 2.1 + vec3(3.1, 7.7, 1.3);
    a *= 0.5;
  }
  return v / sum;
}

// Craters: cellular bowls with rims, three scales
float craterField(vec3 p, float seed, float density) {
  float c = 0.0;
  float amp = 1.0;
  float freq = 2.5;
  for (int oct = 0; oct < 3; oct++) {
    vec3 q = p * freq + seed * 0.37;
    vec3 cell = floor(q);
    vec3 f = fract(q);
    float best = 10.0;
    float bestR = 0.0;
    for (int x = -1; x <= 1; x++)
    for (int y = -1; y <= 1; y++)
    for (int z = -1; z <= 1; z++) {
      vec3 off = vec3(float(x), float(y), float(z));
      vec3 h = hash33(cell + off + seed);
      if (h.z > density) continue; // sparse craters
      vec3 center = off + h;
      float d = length(f - center);
      float r = 0.15 + 0.35 * h.x;
      if (d - r < best - bestR) { best = d; bestR = r; }
    }
    if (best < 5.0) {
      float t = best / bestR;
      float bowl = (smoothstep(0.0, 1.0, t) - 1.0) * 0.7;
      float rim = exp(-pow((t - 1.0) * 5.0, 2.0)) * 0.35;
      float mask = 1.0 - smoothstep(1.0, 1.5, t);
      c += amp * (bowl + rim) * mask;
    }
    amp *= 0.5;
    freq *= 2.7;
  }
  return c;
}

// Fraction of sun visible from P in direction L given a spherical occluder
float sphereShadow(vec3 P, vec3 L, vec3 occPos, float occR, float sunAng) {
  vec3 toOcc = occPos - P;
  float t = dot(toOcc, L);
  if (t <= 0.0 || occR <= 0.0) return 1.0;
  float d = length(toOcc - L * t);
  float occAng = occR / t;
  float sepAng = d / t;
  return smoothstep(occAng - sunAng, occAng + sunAng, sepAng);
}

// Ring density profile along normalised radius r01
float ringDensity(float r01, float seed, vec4 gaps[4]) {
  if (r01 < 0.0 || r01 > 1.0) return 0.0;
  float n1 = snoise(vec3(r01 * 38.0, seed, 0.0));
  float n2 = snoise(vec3(r01 * 140.0, seed * 1.3, 2.0));
  float n3 = snoise(vec3(r01 * 520.0, seed * 0.7, 4.0));
  float d = 0.55 + 0.30 * n1 + 0.18 * n2 + 0.08 * n3;
  // broad structure: inner C-ring translucent, B bright, A medium
  d *= 0.35 + 0.65 * smoothstep(0.0, 0.25, r01);
  d *= 1.0 - 0.35 * smoothstep(0.62, 0.75, r01);
  d *= smoothstep(0.0, 0.02, r01) * (1.0 - smoothstep(0.97, 1.0, r01));
  for (int i = 0; i < 4; i++) {
    float gc = gaps[i].x;
    float hw = gaps[i].y;
    if (hw <= 0.0) continue;
    float dist = abs(r01 - gc);
    d *= smoothstep(hw * 0.5, hw, dist);
  }
  return clamp(d, 0.0, 1.0);
}

// Blackbody-ish colour from temperature (K)
vec3 blackbody(float T) {
  T = clamp(T, 1000.0, 40000.0) / 100.0;
  vec3 c;
  if (T <= 66.0) {
    c.r = 1.0;
    c.g = clamp((99.4708025861 * log(T) - 161.1195681661) / 255.0, 0.0, 1.0);
    c.b = T <= 19.0 ? 0.0 : clamp((138.5177312231 * log(T - 10.0) - 305.0447927307) / 255.0, 0.0, 1.0);
  } else {
    c.r = clamp(329.698727446 * pow(T - 60.0, -0.1332047592) / 255.0, 0.0, 1.0);
    c.g = clamp(288.1221695283 * pow(T - 60.0, -0.0755148492) / 255.0, 0.0, 1.0);
    c.b = 1.0;
  }
  return c;
}
