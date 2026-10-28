// ---------------------------------------------------------------------------
// Cloud deck density field, shared by the deck itself and the shadows it throws on the ground.
// p: unit direction in the body frame, t: scaled time, oct: detail octaves (the deck uses 4,
// the ground shadow 2 — soft anyway).
// ---------------------------------------------------------------------------
float sq01(float x) { return x * x; }

vec3 rotateAbout(vec3 v, vec3 a, float ang) {
  float c = cos(ang), s = sin(ang);
  return v * c + cross(a, v) * s + a * dot(a, v) * (1.0 - c);
}

// Local Y is the spin axis. Weather: a few cyclones spiral the cloud field (counter-clockwise in
// the north), the general circulation sets the latitude bands (wet equatorial convergence, dry
// subtropics, mid-latitude storm tracks), and convection breaks the deck into cells.
float cloudField(vec3 p, float t, float seed, int oct) {
  vec3 w = p;
  float eyes = 1.0;
  for (int i = 0; i < 4; i++) {
    vec3 h = hash33(vec3(seed * 1.31 + float(i) * 7.13, seed * 0.7 + 3.1, float(i) * 1.7));
    float sl = mix(0.3, 0.9, h.x) * (h.y > 0.5 ? 1.0 : -1.0);
    float lon = h.z * 6.2831853 + t * (0.05 + 0.1 * h.x);
    float cl = sqrt(1.0 - sl * sl);
    vec3 c = vec3(cl * cos(lon), sl, cl * sin(lon));
    float d = acos(clamp(dot(w, c), -1.0, 1.0));
    float R = 0.14 + 0.18 * h.x;
    float strength = step(0.25, h.z) * (4.0 + 3.0 * h.y);
    w = rotateAbout(w, c, exp(-d * d / (R * R)) * strength * sign(sl));
    eyes *= mix(1.0, smoothstep(0.004, 0.025, d), step(0.25, h.z) * step(0.6, h.x));
  }
  // fronts: the large-scale flow bends the cloud bands
  w += 0.16 * vec3(snoise(w * 2.6 + seed), snoise(w * 2.6 + seed + 5.2), snoise(w * 2.6 + seed + 9.7));
  vec3 q = vec3(w.x, w.y * 2.0, w.z) * 2.2 + seed;
  float base = fbm(q + vec3(t, 0.0, -t * 0.4), oct + 1) * 0.5 + 0.5;
  float detail = fbm(w * 9.0 + seed * 1.7 + vec3(-t * 2.0, t, 0.0), oct) * 0.5 + 0.5;
  float swirl = fbm(w * 4.0 + vec3(0.0, t * 0.5, 0.0), 3);
  // convective puffs (popcorn cumulus) where the large systems are
  float lat = abs(p.y);
  float zonal = 0.11 * exp(-sq01(p.y / 0.13)) - 0.13 * exp(-sq01((lat - 0.45) / 0.13)) + 0.07 * exp(-sq01((lat - 0.78) / 0.14));
  float puffs = smoothstep(0.05, 0.7, snoise(w * 24.0 + seed * 2.9 + vec3(t * 3.0, 0.0, 0.0)));
  float f = base * 0.62 + detail * 0.3 + swirl * 0.12 + (puffs - 0.25) * 0.12 * smoothstep(0.35, 0.6, base) + zonal;
  return f * eyes;
}

// Opacity of the deck for a field value (same curve everywhere)
float cloudAlpha(float cloud, float coverage) {
  float threshold = 1.0 - coverage;
  float a = smoothstep(threshold - 0.08, threshold + 0.25, cloud);
  return pow(a, 1.2);
}

// Shadow factor (0..1) the deck throws on the ground point p (body frame) lit from Lobj.
// uCloud = (coverage, opacity, seed, height / R); opacity 0 = no deck.
float cloudShadow(vec3 p, vec3 Lobj, float time, vec4 cloud) {
  if (cloud.y <= 0.0) return 1.0;
  float mu = dot(p, Lobj);
  // the deck floats above the ground: the shadow comes from the cloud up-sun of the point
  float s = cloud.w / max(mu, 0.25);
  vec3 pc = normalize(p + Lobj * s);
  float a = cloudAlpha(cloudField(pc, mod(time, 16384.0) * 0.01, cloud.z, 2), cloud.x) * cloud.y;
  // thin edges let light through; the core of a system darkens the ground ~70 %
  return 1.0 - a * 0.7;
}
