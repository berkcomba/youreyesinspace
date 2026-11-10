// Seen from inside an atmosphere's shell, its rays that miss the planet are sky and stop behind any
// relief rising above the horizon (atmosphere.frag); that relief adds the air in front of it here.
uniform vec4 uSky;   // the shell's extinction per km at the ground (0: none), horizontal air mass,
                     // the planet's radius over the shell's thickness, sin of the elevation below
                     // which the shell's rays end on the planet

// `el` sin of the ray's elevation at the camera, `c` cos of its angle to the Sun, `mu` sin of the
// Sun's elevation, `d` km of air: the shell's sum for a level path of constant density, in closed form
vec3 skyHaze(float el, float c, float mu, float d, vec3 atmColor, float density, vec3 sunsetColor, vec3 sunColor) {
  float above = smoothstep(uSky.w - 0.002, uSky.w + 0.002, el);
  if (uSky.x <= 0.0 || above <= 0.0) return vec3(0.0);
  vec3 beta = pow(atmColor / max(max(atmColor.r, atmColor.g), max(atmColor.b, 1e-3)), vec3(1.4));
  float tau0 = density * 0.22;
  float light = 1.0, odSun;
  if (mu >= 0.0) {
    odSun = tau0 / (mu + 1.0 / uSky.y);
  } else {
    light = smoothstep(-0.06, 0.0, (sqrt(max(1.0 - mu * mu, 0.0)) - 1.0) * uSky.z);
    odSun = uSky.y * tau0;
  }
  odSun = clamp(odSun, 0.0, 40.0);
  float g = 0.72;
  vec3 phase = beta * 0.0596831 * (1.0 + c * c) + vec3(0.06) * 0.0795775 * (1.0 - g * g) / pow(1.0 + g * g - 2.0 * g * c, 1.5);
  vec3 col = exp(-beta * odSun) * phase / beta * (1.0 - exp(-beta * uSky.x * d)) * light;
  col *= 5.5 * 1.3 * sunColor;
  float warm = clamp((col.r - col.b) / max(col.r + col.b, 1e-5), 0.0, 1.0);
  return col * mix(vec3(1.0), sunsetColor / max(max(sunsetColor.r, sunsetColor.g), max(sunsetColor.b, 1e-3)), warm * 0.3) * above;
}
