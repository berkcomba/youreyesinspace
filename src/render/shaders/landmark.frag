#include <logdepthbuf_pars_fragment>
// Deep-sky landmark sprite: procedural shape by kind, additive.
varying vec2 vUv;
flat varying vec3 vColor;
flat varying float vAlpha;
flat varying float vKind;
flat varying float vSeed;
flat varying float vImg;
flat varying float vSpan;
flat varying float vPx;
uniform float uTime;
uniform sampler2D uAtlas;
uniform float uAtlasReady;
uniform float uAtlasGrid;
uniform float uShapes;   // 1: draw the shell / ring / filament shapes (no raymarched clouds); 0: gas is the unresolved blob only

void main() {
  #include <logdepthbuf_fragment>
  vec2 p = vUv * 2.0 - 1.0;      // −1..1 across the sprite (= vSpan object radii)
  float r = length(p) * vSpan;   // 1 at the object's radius
  float a;
  vec3 col = vColor;
  // Resolution: below a few pixels every nebula is a soft blob; the shell / lobe / knot
  // structure only appears as the object grows, and its thin features are blurred by the pixel
  // footprint rather than aliasing into a crisp drawn circle
  float pxP = length(fwidth(p)) * 0.7071;   // sprite units per pixel
  float blur = pxP * vSpan * 1.2;           // in object radii
  float res0 = smoothstep(2.5, 10.0, vPx);
  float res = res0 * uShapes;
  float rr = length(p);
  float blob = exp(-rr * rr * 6.0);
  if (vImg >= 0.0 && uAtlasReady > 0.5) {
    // photograph from the atlas (flipY canvas texture: slot rows count from the top)
    float g = uAtlasGrid;
    float slotCol = mod(vImg, g);
    float slotRow = floor(vImg / g);
    vec2 uv = vec2((slotCol + vUv.x) / g, 1.0 - (slotRow + 1.0 - vUv.y) / g);
    vec3 tex = texture2D(uAtlas, uv).rgb;
    tex = pow(tex, vec3(2.2));   // sRGB → linear (the composer's output pass re-encodes)
    // the output pass applies ACES filmic, which pre-scales by 1/0.6 and lifts the mid-tones;
    // compensate so the photograph keeps its published contrast and colour
    tex *= 0.55;
    // soft superellipse vignette hides the frame without reading as a disc; the photo's own
    // sky is additive-black anyway
    vec2 q = p * p; q *= q;
    float mask = smoothstep(1.0, 0.68, pow(q.x + q.y, 0.25));
    gl_FragColor = vec4(tex * mask * vAlpha, 1.0);
    return;
  }
  if (vKind < 0.5) {
    // nebula: irregular glowing cloud with brighter knots
    float n = snoise(vec3(p * 2.4 + vSeed, vSeed * 0.37)) * 0.5 + 0.5;
    float n2 = snoise(vec3(p * 5.5 - vSeed, vSeed * 0.11 + 3.0)) * 0.5 + 0.5;
    float core = exp(-r * r * 1.1);
    float structured = core * (0.45 + 0.55 * n) * (0.6 + 0.6 * n2) * smoothstep(1.6, 0.5, r);
    a = mix(blob, structured, res);
    // ionised core slightly whiter than the Hα rim
    col = mix(col, vec3(1.0, 0.95, 0.95), core * 0.5 * res);
  } else if (vKind < 1.5) {
    // open cluster: the unresolved light of its stars, a Plummer sphere like the members drawn
    // one by one on top of it (ClusterStars: a = 0.45 R). No stars are painted here: the only
    // stars a cluster shows are its real, selectable members
    float pl = 1.0 + r * r * 5.0;
    a = mix(blob, 0.7 / (pl * pl) * smoothstep(1.5, 0.8, r), res0);
  } else if (vKind < 2.5) {
    // remnant: a shocked shell that is neither round nor complete — the rim wanders with
    // azimuth, whole arcs have faded where the blast ran into thin gas, the bright arcs are
    // filamentary; a faint hot interior. Hα-red filaments outside, [O III] / synchrotron blue inside
    float ang = atan(p.y, p.x);
    vec2 c = vec2(cos(ang), sin(ang));
    float az1 = snoise(vec3(c * 1.6, vSeed * 0.5 + 1.0));
    float az2 = snoise(vec3(c * 3.0, vSeed * 0.9 + 7.0));
    float rim = 0.8 + 0.1 * az1;
    float w0 = 0.06 + 0.05 * (snoise(vec3(c * 2.2, vSeed * 1.3 + 19.0)) * 0.5 + 0.5);
    float w = sqrt(w0 * w0 + blur * blur);
    float dr = (r - rim) / w;
    float shell = exp(-dr * dr) * (w0 / w);
    float arcs = smoothstep(-0.35, 0.45, az2 + 0.4 * az1);
    // filaments: threads running along the shell (fast across it, slow around it)
    float fil = 1.0 - abs(snoise(vec3(c * 4.0, (r - rim) * 14.0 + vSeed * 2.0)));
    fil = 0.3 + 1.2 * fil * fil;
    shell *= (0.2 + 1.0 * arcs) * fil;
    // a delicate outer thread where the shock has run ahead
    float rim2 = rim * (1.1 + 0.04 * snoise(vec3(c * 2.6, vSeed * 0.7 + 3.0)));
    float w2 = sqrt(0.0009 + blur * blur);
    float dr2 = (r - rim2) / w2;
    shell += exp(-dr2 * dr2) * (0.03 / w2) * 0.35 * smoothstep(-0.1, 0.5, snoise(vec3(c * 3.4, vSeed * 1.1 + 5.0)));
    float inner = exp(-r * r * 2.0) * 0.16 * (0.6 + 0.7 * (snoise(vec3(p * 3.5, vSeed + 5.0)) * 0.5 + 0.5));
    float structured = (shell * 1.1 + inner) * smoothstep(1.5, 0.95, r);
    a = mix(blob, structured, res);
    vec3 outer = col * vec3(1.15, 0.85, 0.8), innerC = col * vec3(0.8, 0.9, 1.2);
    col = mix(col, mix(innerC, outer, smoothstep(rim - 0.15, rim + 0.05, r)), res);
  } else if (vKind < 3.5) {
    // star: compact gaussian point
    float rr = length(p);
    a = exp(-rr * rr * 7.0) + 0.15 * exp(-rr * 2.5);
  } else if (vKind > 4.5 && vKind < 5.5) {
    // planetary nebula: bright thin shell, faint bipolar lobes, hot central star
    float n = snoise(vec3(p * 6.0, vSeed)) * 0.5 + 0.5;
    float w0 = 0.12;
    float w = sqrt(w0 * w0 + blur * blur);
    float dr = (r - 0.62) / w;
    float shell = exp(-dr * dr) * (w0 / w) * (0.7 + 0.6 * n);
    float ca = cos(vSeed * 1.7), sa = sin(vSeed * 1.7);
    vec2 q = vec2(ca * p.x - sa * p.y, sa * p.x + ca * p.y) * vSpan;
    float lobes = exp(-pow(abs(q.x) / 0.35, 2.0)) * exp(-pow((abs(q.y) - 0.95) / 0.35, 2.0)) * 0.35;
    float fill = exp(-r * r * 3.0) * 0.18;
    float cs = exp(-r * r * 90.0) * 1.2 * res;
    float structured = (shell + lobes + fill) * smoothstep(1.5, 1.0, r);
    a = mix(blob, structured, res);
    col = mix(col, vec3(0.75, 0.85, 1.0), clamp(cs, 0.0, 1.0));
    a += cs;
  } else if (vKind > 5.5 && vKind < 6.5) {
    // globular cluster: King profile truncated at the tidal radius, as concentrated as its
    // member stars are (ClusterStars: core ≈ 0.07 R), with the faint halo of the outer members
    float king = (1.0 / (1.0 + r * r * 70.0) + 0.05 / (1.0 + r * r * 6.0)) * smoothstep(1.15, 0.35, r);
    a = mix(blob, king, res0);
    col = mix(col, vec3(1.0, 0.93, 0.8), 0.5);
  } else {
    // pulsar: gaussian point with a sharp periodic flash and a faint cross-shaped glint
    float rr = length(p);
    float phase = fract(uTime * (0.9 + 0.35 * fract(vSeed * 0.731)) + vSeed);
    float flash = exp(-phase * 14.0) + 0.35 * exp(-fract(phase + 0.5) * 20.0);
    float cross = exp(-abs(p.x) * 9.0) * exp(-abs(p.y) * 1.2) + exp(-abs(p.y) * 9.0) * exp(-abs(p.x) * 1.2);
    a = (exp(-rr * rr * 7.0) + 0.15 * exp(-rr * 2.5)) * (0.55 + 0.9 * flash) + cross * 0.22 * flash;
  }
  a *= vAlpha;
  gl_FragColor = vec4(col * a, 1.0);
}
