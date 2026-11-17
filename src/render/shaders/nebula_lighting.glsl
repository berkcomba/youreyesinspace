// ---------------------------------------------------------------------------
// Nebula Engine 2.0 — lighting. Linear HDR. The gas emits by recombination / collisional lines
// whose mix follows the local ionisation (how much starlight reaches the sample); the dust emits
// nothing of its own but single-scatters the local stars' light (reflection) and extinguishes
// everything behind it. Per step the raymarcher integrates
//   ext = gas·σ_gas + dust·σ_dust;  T_s = exp(-ext·ds);  L += T·source·(1 - T_s)/ext;  T *= T_s
// ---------------------------------------------------------------------------
uniform float uPalette;    // PALETTE_CODE
uniform vec3 uTint;        // catalogue tint, blended lightly into the palette
uniform vec4 uLines;       // excitation 0…1, low-ionisation share 0…1, remnant class (REMNANT_CODE), dust scattering 0…1; 0.5, 0.5, 0, 0 = reference mix
uniform float uEmission;   // profile emissionScale
uniform float uExtinction; // profile extinctionScale
uniform vec2 uChroma;      // procedural colour: hue turn (rad) about the grey axis, saturation gain (0, 1 = as is)
uniform sampler3D uShadow; // baked transmittance star → sample (rgba: lights 0–3), NebulaShadows
uniform float uShadowOn;   // 0 … 1: how much of it applies (fades in once the bake is complete)
uniform float uAbsorb;     // (< 0: uFade) share of the medium's extinction applied (uFade for glowing nebulae; the visibility alone for dark clouds)
uniform float uDebug;      // 0 off, 1 gas, 2 dust, 3 ionisation, 4 transmittance

// emission-line colours (linear RGB)
const vec3 L_HA = vec3(1.0, 0.17, 0.2);    // Hα (+ [N II])
const vec3 L_OIII = vec3(0.25, 0.9, 0.85);  // [O III]
const vec3 L_SII = vec3(1.0, 0.3, 0.12);    // [S II]
const vec3 L_HB = vec3(0.45, 0.6, 1.0);     // Hβ / scattered blue
const vec3 L_SYNC = vec3(0.55, 0.65, 1.0);  // synchrotron / X-ray hot interior

// extinction cross sections per unit density per object radius
const float SIG_GAS = 0.12;
const float SIG_DUST = 3.2;
const float DUST_ALBEDO = 0.55;

// how much ionising light reaches p: Σ I / (d² + ε), with the primary light normalised so the
// cavity wall sits near U ≈ 1
float ionisation(vec3 p, out vec3 starlight) {
  float U = 0.0;
  starlight = vec3(0.0);
  // the dust between each star and p (a baked grid; 1 where there is none)
  vec4 sh = vec4(1.0);
  if (uShadowOn > 0.0) sh = mix(vec4(1.0), texture(uShadow, clamp(p / 2.6 + 0.5, 0.0, 1.0)), uShadowOn);
  for (int i = 0; i < 4; i++) {
    if (i >= uNLights) break;
    vec3 d = p - uLights[i].xyz;
    float inv = uLights[i].w / (dot(d, d) + 0.004);
    float t = i == 0 ? sh.x : i == 1 ? sh.y : i == 2 ? sh.z : sh.w;
    // ionising photons (λ < 91 nm) are stopped by dust several times more readily than visible
    // light, and by the neutral gas on top: the ionisation shadow is far deeper than the visible one
    U += inv * t * sqrt(t);
    starlight += uLightCol[i] * inv * t;
  }
  return U * sq(max(uCavity, 0.08));
}

// gas colour for ionisation U (0 far / shielded … ≫1 next to the stars) and front share `hot`
vec3 gasColor(float U, float hot) {
  float ion = U / (U + 1.0);                      // 0 … 1
  // metal-rich gas puts more of its light into [S II] / [N II]
  float lowIon = 0.5 * max(uLines.y - 0.5, 0.0);
  vec3 col;
  if (uPalette < 0.5) {
    // Hα–[O III]: red over most of the cloud, teal next to the exciting stars (further out the
    // hotter they are), pink-white fronts
    float o3 = mix(0.88, 0.36, uLines.x);
    col = mix(mix(L_SII, L_HA, smoothstep(0.0, max(0.24 * uLines.y, 0.02), ion)), L_OIII, smoothstep(o3, o3 + 0.33, ion));
    col = mix(col, L_SII, lowIon);
    col = mix(col, vec3(0.9, 0.75, 0.8), hot * 0.22);
  } else if (uPalette < 1.5) {
    // Hα–[S II]: the low-excitation, dusty variant — red to orange
    col = mix(L_SII, L_HA, smoothstep(0.05, 0.6, ion));
    col = mix(col, L_SII, lowIon);
    col = mix(col, vec3(1.0, 0.75, 0.6), hot * 0.4);
  } else if (uPalette < 2.5) {
    // shells (planetaries, bubbles) are stratified: `hot` runs from the high-excitation interior
    // (He II / [O III], carrying the object's own tint) through the teal [O III] zone and the
    // orange inner edge of the shell to the red [N II] / Hα rim
    // A hotter central star pushes every zone outward: the blue-teal interior grows, the red rim thins
    // Below ~60 kK the star barely ionises O⁺ to O²⁺: no [O III] zone, the shell is Hα / [N II] pink
    // throughout (IC 418, M2-9); above ~150 kK He II deepens the interior to violet-blue
    float x = uLines.x;
    float o3w = smoothstep(0.1, 0.45, x);
    vec3 he2 = mix(vec3(0.22, 0.5, 1.0), vec3(0.32, 0.36, 1.0), smoothstep(0.7, 1.0, x));
    vec3 inner = mix(mix(vec3(1.0, 0.68, 0.7), he2, o3w), uTint, 0.45);
    vec3 zone = mix(vec3(1.0, 0.4, 0.48), L_OIII, o3w);
    float a = mix(0.2, 0.7, x);
    col = mix(inner, zone, smoothstep(0.0, a, hot));
    col = mix(col, vec3(1.0, 0.55, 0.22), smoothstep(a, a + 0.35, hot));
    col = mix(col, L_HA, smoothstep(a + 0.3, 1.0, hot));
    // nitrogen-rich shells (the bipolar ones of massive progenitors) glow red in [N II]
    return mix(col, mix(L_HA, L_SII, 0.3), lowIon * smoothstep(0.2, 0.7, hot));
  } else if (uPalette < 3.5) {
    col = L_HB;   // reflection: the gas (if any) is a faint blue haze
  } else {
    // remnants (`hot`: 0 … 0.8 the strands, 1 the shock front and the interior)
    if (uLines.z < 0.5) {
      // radiative: [S II]/Hα red filaments, [O III] teal ones (more of them behind a faster shock), blue front
      float o3 = mix(0.45, 0.05, uLines.x);
      col = mix(mix(L_SII, L_HA, 0.5), L_OIII, smoothstep(o3, o3 + 0.35, hot));
      col = mix(col, L_SYNC, smoothstep(0.85, 1.0, hot));
    } else if (uLines.z < 1.5) {
      // Balmer-dominated: the shock runs into neutral gas, almost nothing but Hα and Hβ
      col = mix(L_HA, L_HB, 0.2 + 0.25 * smoothstep(0.85, 1.0, hot));
    } else if (uLines.z < 2.5) {
      // oxygen-rich ejecta: green-blue [O III] knots beside red-orange [S II] ones
      col = mix(L_SII, mix(L_OIII, L_HB, 0.35), smoothstep(0.2, 0.45, hot));
      col = mix(col, L_SYNC, smoothstep(0.9, 1.0, hot));
    } else if (uLines.z < 3.5) {
      // pulsar wind nebula: red-orange Hα / [S II] filaments around blue-white synchrotron light
      col = mix(mix(L_HA, L_SII, 0.35), vec3(0.75, 0.8, 1.0), smoothstep(0.8, 1.0, hot));
    } else {
      // faded: slow shocks light only Hα and [S II], a faint red web
      col = mix(mix(L_HA, L_SII, 0.3), L_HA, smoothstep(0.85, 1.0, hot));
    }
    return mix(col, uTint, 0.06);
  }
  return mix(col, uTint, 0.12);
}

// turn a colour's hue about the grey axis and scale its saturation, luminance kept
vec3 chroma(vec3 c) {
  if (uChroma.y <= 0.0 || (uChroma.y == 1.0 && uChroma.x == 0.0)) return c;   // (0, 0): a material without the uniform
  float m = (c.r + c.g + c.b) / 3.0;
  vec2 xy = vec2((c.r - c.g) * 0.70710678, (c.r + c.g - 2.0 * c.b) * 0.40824829);
  float cs = cos(uChroma.x), sn = sin(uChroma.x);
  xy = vec2(xy.x * cs - xy.y * sn, xy.x * sn + xy.y * cs) * uChroma.y;
  vec3 o = vec3(m + xy.x * 0.70710678 + xy.y * 0.40824829, m - xy.x * 0.70710678 + xy.y * 0.40824829, m - xy.y * 0.81649658);
  float l0 = dot(c, vec3(0.2126, 0.7152, 0.0722)), l1 = dot(o, vec3(0.2126, 0.7152, 0.0722));
  return max(o * (l1 > 1e-5 ? l0 / l1 : 1.0), 0.0);
}

// radiance emitted per unit length at the sample
vec3 nebulaSource(vec3 p, Medium m) {
  vec3 starlight;
  float U = ionisation(p, starlight);
  vec3 src = vec3(0.0);
  if (m.gas > 1e-4) {
    // recombination ∝ n², and only the ionised share glows: the gas deep in the shadow is dark
    // (the floor stands for the diffuse ionising field; with the shadows baked, the gas they hide goes darker)
    float floorIon = mix(0.3, 0.2, uShadowOn);
    float ion = uPalette > 3.5 ? 1.0 : (floorIon + (1.0 - floorIon) * U / (U + 0.4));
    // a pulsar's synchrotron nebula fills the interior a shell remnant leaves dark
    // (the interior is the thin gas inside the shell, ≤ 0.012; the shock front is denser)
    float fill = uPalette > 3.5 && abs(uLines.z - 3.0) < 0.5 ? mix(1.0, 10.0, step(0.999, m.hot) * step(m.gas, 0.013)) : 1.0;
    src += gasColor(U, m.hot) * m.gas * (0.6 + 0.4 * m.gas) * ion * fill * uEmission;
  }
  if (m.dust > 1e-4) {
    // single scattering of the local stars (reflection), bluer than the stars themselves
    // (normalised like the ionisation; in emission nebulae the scattered light is a faint sheen)
    bool refl = uPalette > 2.5 && uPalette < 3.5;
    // a reflection nebula takes the colour of its star, bluer for the scattering: deep blue around
    // an early B star, yellow-orange around a cool supergiant (the Antares nebula)
    vec3 starTint = mix(mix(vec3(1.0, 0.6, 0.28), vec3(0.5, 0.72, 1.0), smoothstep(0.25, 0.6, uLines.x)), vec3(0.4, 0.62, 1.0), smoothstep(0.6, 1.0, uLines.x));
    vec3 scatterTint = refl ? starTint : mix(vec3(0.9, 0.9, 1.0), vec3(0.5, 0.72, 1.0), uLines.w);
    float k = refl ? 0.5 : 0.06 + 0.4 * uLines.w;
    src += starlight * sq(max(uCavity, 0.08)) * scatterTint * m.dust * DUST_ALBEDO * k * uEmission;
    // the rest of a reflection nebula's cloud is not black: the galaxy's own starlight gives the
    // dust the faint brown glow deep photographs show around the blue core
    if (refl) src += vec3(0.42, 0.33, 0.26) * m.dust * 0.012 * uEmission;
    // a dark cloud's surface catches the Galaxy's own starlight (deep images show it faintly
    // brown, the integrated flux nebulae); the inside, shielded on all sides, stays black
    if (uMorph > 1.5 && uMorph < 2.5) src += vec3(0.4, 0.31, 0.24) * m.dust * m.hot * m.hot * 0.012 * uEmission;
  }
  return chroma(src);
}

float nebulaExtinction(Medium m) {
  return max(1e-4, m.gas * SIG_GAS + m.dust * SIG_DUST * uExtinction);
}
