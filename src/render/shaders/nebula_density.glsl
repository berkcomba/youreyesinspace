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
  float hot;   // 0 … 1: share of the gas that sits on an ionisation / shock front (palette shift)
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
    // ----- reflection nebula: fibrous dust around a few stars -----
    float env = nebEnvelope(p, 1.25);
    if (env < 1e-3) return m;
    vec3 q = nebWarp(p * uFilScale, uTurb * 0.5, 1.5);
    // fibres: elongated along the warp, two scales
    vec3 s = vec3(q.x * 3.2, q.y * 1.1, q.z * 3.2);
    float fib = 0.55 + 0.6 * snoise(s * 1.6 + uSeed) + 0.35 * fbm(q * 3.0, 3);
    fib = pow(max(fib, 0.0), 2.2);
    float dust = env * fib * 1.3;
    m.dust = dust;
    // the star's immediate surroundings are swept clean
    m.dust *= smoothstep(0.04, 0.12, d0);
    m.gas = 0.0;
    return m;
  }
  if (uMorph < 5.5) {
    // ----- planetary nebula -----
    float mu = abs(dot(p, uAxis)) / max(r, 1e-4);
    float bip = uMorph > 4.5 ? 1.0 : 0.0;
    float lobe = 1.0 + bip * 0.9 * pow(mu, 4.0);
    float shellR = uCavity * lobe;
    float x = r / shellR;
    vec3 q = nebWarp(p * 3.0, uTurb * 0.25, 2.2);
    float n = fbm(q * 2.4, 4);
    // thin bright shell, thinner at the poles when bipolar; the equator carries the dense torus
    float equ = 1.0 - bip * 0.5 * mu;
    float n01 = n * 0.5 + 0.5;
    float shell = exp(-sq((x - 1.0) / 0.08)) * (0.15 + 1.6 * n01 * n01) * equ;
    // a second, older shell farther out (concentric)
    float shell2 = uDoubleShell * exp(-sq((x - 1.45) / 0.09)) * (0.2 + 0.8 * n01 * n01) * 0.4;
    // hot thin interior gas (the [O III] glow), cometary knots in the shell
    float inner = (1.0 - smoothstep(0.3, 1.0, x)) * 0.05;
    float halo = exp(-sq((x - 1.2) / 0.22)) * 0.04;
    float knots = pow(max(snoise(q * 6.0 + 3.0), 0.0), 2.0) * shell;
    float gas = shell * 1.6 + knots * 1.5 + shell2 + inner + halo;
    // equatorial dust torus pinching the lobes
    vec3 e = p - uAxis * dot(p, uAxis);
    float rho = length(e), z = dot(p, uAxis);
    float torus = bip * exp(-(sq((rho - uCavity * 0.85) / (0.18 * uCavity)) + sq(z / (0.2 * uCavity))));
    m.gas = gas;
    m.dust = knots * 0.5 + torus * 1.6 * (0.6 + 0.6 * n01);
    m.hot = clamp(shell * 0.9 * smoothstep(0.95, 1.08, x), 0.0, 1.0);   // the rim (outer edge) is the low-ionisation side
    return m;
  }
  if (uMorph < 6.5) {
    // ----- supernova remnant: shocked filamentary shell, hot interior -----
    float side = dot(p, uAxis) / max(r, 1e-4);
    float shellR = uCavity * (1.0 - 0.1 * side);          // squashed toward the denser ISM
    vec3 q = nebWarp(p * 2.2 * uFilScale, uTurb * 0.55, 1.3);
    float ridge = 1.0 - abs(snoise(q * 2.0));
    float ridge2 = 1.0 - abs(snoise(q * 5.3 + 3.3));
    float ridge3 = 1.0 - abs(snoise(q * 11.0 + 9.1));
    float shell = exp(-sq((r - shellR) / 0.055));
    float thick = exp(-sq((r - shellR * 0.93) / 0.12));
    float fil = pow(ridge, 8.0) * 2.4 + pow(ridge2, 10.0) * 1.4 + pow(ridge3, 12.0) * 0.7;
    // the shock front: a smooth faint rim just outside the filaments
    float front = exp(-sq((r - shellR * 1.04) / 0.025)) * 0.35;
    float gas = (shell * fil + thick * fil * 0.35) * (0.6 + 0.6 * side) + front;
    // hot X-ray / synchrotron interior
    float interior = (1.0 - smoothstep(0.4, shellR, r)) * 0.02;
    m.gas = gas + interior;
    // dust: a little swept-up ISM on the dense side
    m.dust = thick * smoothstep(0.3, 0.9, ridge2) * 0.35 * max(side, 0.0);
    m.hot = clamp(fil * 0.4 + front * 2.0, 0.0, 1.0);
    return m;
  }
  // ----- wind bubble: smoother, slightly lumpy thin shell around the star -----
  float shellR = uCavity;
  vec3 q = nebWarp(p * 2.0, uTurb * 0.4, 1.6);
  float n = fbm(q * 3.0, 3);
  float shell = exp(-sq((d0 - shellR) / 0.07)) * (0.6 + 0.6 * (n * 0.5 + 0.5));
  // the bubble is leaking on one side (blow-out)
  float blow = smoothstep(0.55, 0.95, dot(toC / max(d0, 1e-4), uAxis));
  shell *= 1.0 - 0.7 * blow;
  float inner = (1.0 - smoothstep(0.3, shellR, d0)) * 0.05;
  m.gas = shell * 1.4 + inner;
  m.dust = shell * pow(max(snoise(q * 5.0), 0.0), 2.0) * 0.5;
  m.hot = clamp(shell, 0.0, 1.0);
  return m;
}
