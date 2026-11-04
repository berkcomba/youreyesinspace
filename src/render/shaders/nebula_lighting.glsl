// ---------------------------------------------------------------------------
// Nebula Engine 2.0 — lighting. Linear HDR. The gas emits by recombination / collisional lines
// whose mix follows the local ionisation (how much starlight reaches the sample); the dust emits
// nothing of its own but single-scatters the local stars' light (reflection) and extinguishes
// everything behind it. Per step the raymarcher integrates
//   ext = gas·σ_gas + dust·σ_dust;  T_s = exp(-ext·ds);  L += T·source·(1 - T_s)/ext;  T *= T_s
// ---------------------------------------------------------------------------
uniform float uPalette;    // PALETTE_CODE
uniform vec3 uTint;        // catalogue tint, blended lightly into the palette
uniform float uEmission;   // profile emissionScale
uniform float uExtinction; // profile extinctionScale
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
  for (int i = 0; i < 4; i++) {
    if (i >= uNLights) break;
    vec3 d = p - uLights[i].xyz;
    float inv = uLights[i].w / (dot(d, d) + 0.004);
    U += inv;
    starlight += uLightCol[i] * inv;
  }
  return U * sq(max(uCavity, 0.08));
}

// gas colour for ionisation U (0 far / shielded … ≫1 next to the stars) and front share `hot`
vec3 gasColor(float U, float hot) {
  float ion = U / (U + 1.0);                      // 0 … 1
  vec3 col;
  if (uPalette < 0.5) {
    // Hα–[O III]: red over most of the cloud, teal only next to the exciting stars, pink-white fronts
    col = mix(mix(L_SII, L_HA, smoothstep(0.0, 0.12, ion)), L_OIII, smoothstep(0.62, 0.95, ion));
    col = mix(col, vec3(0.9, 0.75, 0.8), hot * 0.22);
  } else if (uPalette < 1.5) {
    // Hα–[S II]: the low-excitation, dusty variant — red to orange
    col = mix(L_SII, L_HA, smoothstep(0.05, 0.6, ion));
    col = mix(col, vec3(1.0, 0.75, 0.6), hot * 0.4);
  } else if (uPalette < 2.5) {
    // [O III]-blue (planetaries, bubbles): teal inside, red [N II] rim
    col = mix(L_HA, L_OIII, smoothstep(0.1, 0.7, ion));
    col = mix(col, L_HA, hot * 0.8);
  } else if (uPalette < 3.5) {
    col = L_HB;   // reflection: the gas (if any) is a faint blue haze
  } else {
    // remnant: [S II]/Hα red filaments, [O III] green ones, blue shock front
    col = mix(mix(L_SII, L_HA, 0.5), L_OIII, smoothstep(0.3, 0.8, hot));
    col = mix(col, L_SYNC, smoothstep(0.85, 1.0, hot));
  }
  return mix(col, uTint, 0.12);
}

// radiance emitted per unit length at the sample
vec3 nebulaSource(vec3 p, Medium m) {
  vec3 starlight;
  float U = ionisation(p, starlight);
  vec3 src = vec3(0.0);
  if (m.gas > 1e-4) {
    // recombination ∝ n², and only the ionised share glows: the gas deep in the shadow is dark
    float ion = uPalette > 3.5 ? 1.0 : (0.3 + 0.7 * U / (U + 0.4));
    src += gasColor(U, m.hot) * m.gas * (0.6 + 0.4 * m.gas) * ion * uEmission;
  }
  if (m.dust > 1e-4) {
    // single scattering of the local stars (reflection), bluer than the stars themselves
    // (normalised like the ionisation; in emission nebulae the scattered light is a faint sheen)
    bool refl = uPalette > 2.5 && uPalette < 3.5;
    vec3 scatterTint = refl ? vec3(0.75, 0.85, 1.0) : vec3(0.9, 0.9, 1.0);
    float k = refl ? 0.5 : 0.06;
    src += starlight * sq(max(uCavity, 0.08)) * scatterTint * m.dust * DUST_ALBEDO * k * uEmission;
  }
  return src;
}

float nebulaExtinction(Medium m) {
  return max(1e-4, m.gas * SIG_GAS + m.dust * SIG_DUST * uExtinction);
}
