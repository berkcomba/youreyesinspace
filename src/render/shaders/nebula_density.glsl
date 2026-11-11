// ---------------------------------------------------------------------------
// Nebula Engine 2.0 — density model. Local units: object radius = 1, the object centred at 0.
// The medium is sampled as separate gas (ionised / shocked, it glows) and dust (it extinguishes
// and scatters starlight); what the gas emits is decided in nebula_lighting.glsl from the local
// ionisation. Morphology families (uMorph):
//   0 hii-cavity   1 hii-pillars   2 molecular-dark   3 reflection-wisps
//   4 planetary-shell   5 planetary-bipolar   6 snr-filaments   7 wind-bubble
// Structure = family envelope → domain warp (turbulence) → filament erosion → dust sheets.
// ---------------------------------------------------------------------------
uniform float uMorph;
uniform float uTurb;        // domain-warp amplitude (0 … 1)
uniform float uFilScale;    // filament / pillar frequency relative to the extent
uniform float uCavity;      // cavity radius around the primary light / shell radius (radii)
uniform vec3 uAxis;         // bipolar axis / the denser side of the ISM
uniform float uDoubleShell; // planetary: 1 with a second, outer shell
uniform vec4 uLights[4];    // xyz position (radii), w relative intensity; [0] is the primary
uniform vec3 uLightCol[4];
uniform int uNLights;

struct Medium {
  float gas;   // glowing gas density (0 … ~2)
  float dust;  // extinguishing dust density (0 … ~2)
  // 0 … 1, the palette coordinate of the gas. H II: share sitting on an ionisation front.
  // Shells (planetaries, bubbles): 0 the hot interior … 1 the low-ionisation outer rim.
  // Remnants: 0 red ([S II] / Hα) filaments … 0.8 teal ([O III]) ones … 1 the blue shock front.
  float hot;
};

// three-channel domain warp: turns blobs into wisps, pillars and sheets
vec3 nebWarp(vec3 p, float amt, float f) {
  vec3 q = p * f + uSeed;
  return p + amt * vec3(snoise(q), snoise(q + 17.1), snoise(q + 31.7));
}

// soft irregular outer boundary: the cloud is no sphere
float nebEnvelope(vec3 p, float flatten) {
  vec3 s = p; s.y *= flatten;
  float r = length(s);
  // the boundary noise cannot pull the edge inside r = 0.5·0.55: the core is solid without it
  if (r < 0.27) return 1.0;
  float bnd = 0.8 + 0.3 * fbm(s / r * 1.4 + uSeed * 0.37, 2);
  return 1.0 - smoothstep(bnd * 0.55, bnd * 1.05, r);
}

Medium sampleMedium(vec3 p) {
  Medium m; m.gas = 0.0; m.dust = 0.0; m.hot = 0.0;
  float r = length(p);
  if (r > 1.3) return m;
  vec3 c0 = uLights[0].xyz;
  vec3 toC = p - c0;
  float d0 = length(toC);
  // nothing reaches the marched sphere's surface: no family shows a cut edge
  float edge = 1.0 - smoothstep(1.08, 1.28, r);

  if (uMorph < 2.5) {
    // ----- H II region / dark molecular cloud -----
    float env = nebEnvelope(p, 1.45);
    if (env < 1e-3) return m;
    // large wisps first (low-frequency warp), detail on top
    vec3 q = nebWarp(p * uFilScale, uTurb * 0.7, 1.1);
    float n = fbm(q * 1.7, 4);                        // -1 … 1 gas texture
    float dn = fbm(q * 2.3 + vec3(7.0, 2.0, 5.0), 3); // dust lanes
    // the cluster's wind has swept a cavity; its wall is the brightest, hottest gas
    float cav = smoothstep(uCavity * 0.4, uCavity * 1.05, d0);
    float wall = exp(-sq((d0 - uCavity) / (0.2 * uCavity))) * smoothstep(-0.5, 0.3, n);
    // pillars: dust columns that point at the cluster, sculpted at the cavity edge
    float pillarZone = exp(-sq((d0 - uCavity * 1.3) / (0.5 * uCavity)));
    float pillars = 0.0;
    if (pillarZone > 0.03) {
      vec3 u = toC / max(d0, 1e-4);
      vec3 qp = p - u * dot(toC, u) * 0.8;            // squeeze the radial coordinate: elongated along u
      float pil = ridged(qp * 4.0 * uFilScale + uSeed * 0.11, 2);
      pillars = pow(pil, 3.0) * pillarZone * (uMorph > 0.5 ? 2.6 : 1.0);
    }
    // dust: sharp-edged lanes of the parent cloud away from the cavity, plus the pillars
    float outer = smoothstep(uCavity * 0.6, uCavity * 1.3, d0);
    float lanes = smoothstep(0.14, 0.28, dn) * outer;
    float dust = env * (lanes * 2.6 + pillars * smoothstep(uCavity * 0.5, uCavity * 0.95, d0));
    // gas: clumpy Hα (high contrast) with the bright wall; thin where the dust is thick
    float clumps = pow(smoothstep(-0.55, 0.75, n), 1.7);
    float gas = env * cav * clumps * 0.8 * (1.0 - 0.7 * smoothstep(0.5, 1.5, dust)) + env * wall * 3.0;
    // ionisation fronts: the gas evaporating off the lane edges that face the stars glows brightest
    float rim = (1.0 - smoothstep(0.0, 0.07, abs(dn - 0.17))) * outer * cav * (1.0 - 0.5 * smoothstep(-0.4, 0.4, n));
    gas += env * rim * 2.5;
    if (uMorph > 1.5) {
      // dark cloud: everything is dust, with the faintest glow at the lit surface
      dust = env * (smoothstep(-0.15, 0.4, dn) * 1.6 + pillars * 0.5);
      gas = env * rim * 0.4 + env * clumps * 0.08;
    }
    m.gas = gas; m.dust = dust;
    m.hot = clamp(wall * 0.9 + rim * 1.2, 0.0, 1.0);
    return m;
  }
  if (uMorph < 3.5) {
    // ----- reflection nebula: fibrous dust lit by a few stars, the rest of the cloud dark -----
    float env = nebEnvelope(p, 1.25);
    if (env < 1e-3) return m;
    vec3 q = nebWarp(p * uFilScale, uTurb * 0.6, 1.4);
    // fibres: combed along one direction (the local magnetic field), two scales
    vec3 s = vec3(q.x * 3.4, q.y * 0.9, q.z * 3.4);
    float fib = 0.5 + 0.65 * snoise(s * 1.5 + uSeed) + 0.4 * fbm(q * 3.2, 3);
    fib = pow(max(fib, 0.0), 2.4);
    // the denser parent cloud: lanes that stay dark away from the stars and cut into the glow
    float lane = smoothstep(0.12, 0.5, fbm(q * 1.2 + vec3(9.0, 4.0, 1.0), 2));
    m.dust = env * (fib * 1.2 + lane * 0.9);
    // the star's immediate surroundings are swept clean
    m.dust *= smoothstep(0.03, 0.11, d0);
    m.gas = 0.0;
    return m;
  }
  if (uMorph < 5.5) {
    // ----- planetary nebula -----
    float z = dot(p, uAxis);
    float rs = max(r, 1e-4);
    float mu = abs(z) / rs;
    vec3 dir = p / rs;
    // structure laid out on the direction from the star: spokes, cometary knots, streaks
    float spoke = snoise(dir * 6.5 + uSeed * 1.3);
    float tex = fbm(nebWarp(p * 1.7, uTurb * 0.22, 2.0) * 1.9, 3) * 0.5 + 0.5;
    if (uMorph < 4.5) {
      // round / elliptical: a bright main shell around a hot thin interior, a faint streaked halo
      float shellR = uCavity * (0.92 + 0.2 * mu * mu + 0.06 * snoise(dir * 1.7 + uSeed));
      float x = r / shellR;
      if (x > 2.2) return m;
      float w = 0.08 + 0.03 * (spoke * 0.5 + 0.5);
      // a barrel rather than a ball: dense around the equator, thin over the poles (a ring seen
      // along the axis, two bright bars from the side)
      float barrel = 1.0 - 0.7 * smoothstep(0.35, 0.95, mu);
      float shell = exp(-sq((x - 1.0) / w)) * (0.3 + 1.5 * tex * tex) * (0.75 + 0.45 * spoke) * barrel;
      // the [O III] glow filling the cavity, brighter toward the inner edge of the shell
      float inner = (1.0 - smoothstep(0.6, 1.0, x)) * (0.1 + 0.16 * smoothstep(0.2, 0.9, x)) * (0.6 + 0.8 * tex);
      // knots just inside the rim with tails pointing away from the star (Helix)
      float knot = pow(max(spoke, 0.0), 3.0) * exp(-sq((x - 0.86) / 0.1));
      // the older, slower wind outside: radial streaks fading out
      float halo = smoothstep(1.0, 1.08, x) * exp(-(x - 1.0) / 0.2) * (0.05 + 0.12 * max(spoke, 0.0)) * (0.5 + tex);
      // a second, older shell farther out (concentric)
      float shell2 = uDoubleShell * exp(-sq((x - 1.42) / 0.08)) * (0.2 + 0.7 * tex) * 0.45;
      m.gas = (shell * 1.5 + inner + knot * 0.9 + halo + shell2) * edge;
      m.dust = knot * 0.5 * edge;
      m.hot = 0.45 * smoothstep(0.45, 0.9, x) + 0.55 * smoothstep(0.93, 1.1, x);
      return m;
    }
    // bipolar: two lobes blown out through a dense equatorial waist (an hourglass)
    vec3 e = p - uAxis * z;
    float rho = length(e);
    float lobeR = uCavity * (0.3 + 1.15 * pow(mu, 1.3)) * (1.0 + 0.07 * snoise(dir * 2.1 + uSeed));
    float x = r / lobeR;
    if (x > 2.4) return m;
    // streaks running along the lobe walls from the waist to the tips
    float streak = snoise(e / max(rho, 1e-4) * 4.5 + uAxis * (mu * 1.4) + uSeed * 0.7) * 0.5 + 0.5;
    float wall = exp(-sq((r - lobeR) / 0.055)) * (0.25 + 1.3 * tex * streak + 0.5 * streak * streak);
    wall *= 1.0 - 0.7 * smoothstep(0.82, 1.0, mu);            // the tips are open
    float inner = (1.0 - smoothstep(0.4, 1.0, x)) * 0.14 * (0.5 + tex);
    float halo = smoothstep(0.0, 0.05, r - lobeR) * exp(-(r - lobeR) / 0.13) * 0.06 * (0.4 + streak);
    // the waist: a bright dusty ring the lobes are pinched by
    float torus = exp(-(sq((rho - uCavity * 0.34) / (0.13 * uCavity)) + sq(z / (0.12 * uCavity))));
    m.gas = (wall * 1.4 + inner + halo + torus * (0.8 + 1.2 * tex)) * edge;
    m.dust = (torus * 1.3 * (0.5 + tex) + wall * pow(max(spoke, 0.0), 3.0) * 0.4) * edge;
    m.hot = max(0.45 * smoothstep(0.4, 0.85, x) + 0.55 * smoothstep(0.9, 1.1, x), torus * 0.9);
    return m;
  }
  if (uMorph < 6.5) {
    // ----- supernova remnant: a thin shocked shell seen as a net of filaments -----
    float rs = max(r, 1e-4);
    vec3 dir = p / rs;
    float side = dot(dir, uAxis);
    float shellR = uCavity * (0.97 - 0.08 * side + 0.09 * snoise(dir * 1.9 + uSeed));   // squashed toward the denser ISM
    float x = r - shellR;
    // hot X-ray / synchrotron interior
    float interior = (1.0 - smoothstep(0.3, 0.95, r / shellR)) * 0.012;
    if (x < -0.34 || x > 0.14) { m.gas = interior; m.hot = 1.0; return m; }
    // the shell is a crumpled sheet: where the sheets of the noise cut it we look along the gas
    vec3 q = nebWarp(p * 1.5 * uFilScale, uTurb * 0.5, 1.2);
    float f1 = pow(1.0 - abs(snoise(q * 1.7)), 10.0);
    float f2 = pow(1.0 - abs(snoise(q * 3.9 + 3.3)), 14.0);
    // whole arcs have faded where the blast ran into thin gas
    float lit = 0.12 + smoothstep(-0.3, 0.35, snoise(q * 0.8 + 11.0));
    float layer = exp(-sq(x / 0.05));
    float thick = exp(-sq((x + 0.08) / 0.12));
    float fil = f1 * 2.2 + f2 * 1.3;
    // the shock front: a smooth faint rim just ahead of the filaments
    float front = exp(-sq((x - 0.045) / 0.022)) * 0.2 * lit;
    m.gas = ((layer * fil + thick * f1 * 0.45) * lit * (0.75 + 0.45 * side) + front) * edge + interior;
    // dust: a little swept-up ISM on the dense side
    m.dust = thick * f2 * 0.5 * max(side, 0.0) * edge;
    // red and teal strands side by side, the smooth front blue
    float hue = clamp(0.4 + 0.9 * snoise(q * 0.65 + 5.0), 0.0, 0.8);
    m.hot = mix(hue, 1.0, clamp(front * 5.0 / max(m.gas, 1e-3), 0.0, 1.0));
    return m;
  }
  // ----- wind bubble: a thin [O III] skin around a wrinkled layer of red filaments -----
  vec3 dir0 = toC / max(d0, 1e-4);
  // the bubble is leaking on one side (blow-out): it bulges there and its shell thins out
  float blow = smoothstep(0.45, 0.95, dot(dir0, uAxis));
  float shellR = uCavity * (0.93 + 0.1 * snoise(dir0 * 2.1 + uSeed) + 0.14 * blow);
  float x = d0 / shellR;
  if (x > 1.25) return m;
  float inner = (1.0 - smoothstep(0.3, 1.0, x)) * 0.03;
  if (x < 0.6) { m.gas = inner; m.hot = 0.2; return m; }
  vec3 q = nebWarp(p * 1.5 * uFilScale, uTurb * 0.45, 1.5);
  float c1 = pow(1.0 - abs(snoise(q * 2.0)), 9.0);
  float c2 = pow(1.0 - abs(snoise(q * 4.4 + 2.0)), 12.0);
  float skin = exp(-sq((x - 1.0) / 0.05)) * (0.6 + 0.5 * c1);
  float layer = exp(-sq((x - 0.86) / 0.1)) * (c1 * 1.3 + c2 * 0.8);
  float thin = 1.0 - 0.75 * blow;
  m.gas = ((skin * 0.7 + layer * 1.2) * thin + inner) * edge;
  m.dust = layer * c2 * 0.4 * edge;
  m.hot = clamp((skin * 0.25 + layer * 1.2) / max(skin + layer * 1.2, 1e-3), 0.0, 1.0);
  return m;
}
