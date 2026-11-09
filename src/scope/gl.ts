/**
 * The GPU half of the telescope view. Three passes into a half-float target and out:
 *  1. the extended sky through the atmosphere: a moving displacement field (image motion and the
 *     "boiling" of seeing), a blur of the seeing, diffraction and the eye, colour dispersion;
 *  2. point sources as instanced sprites: Airy pattern (with the central obstruction), the seeing
 *     disk, a Moffat halo, spider spikes, scintillation;
 *  3. the eye (visual), the detector stretch, or the radio colour map, with the field stop.
 * Surface brightness is carried multiplied by ENC so the night sky stays in half-float range.
 */

export const ENC = 1e5;

const VS_QUAD = `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main() { vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }`;

const NOISE = `
vec3 hash3(vec3 p) {
  p = vec3(dot(p, vec3(127.1, 311.7, 74.7)), dot(p, vec3(269.5, 183.3, 246.1)), dot(p, vec3(113.5, 271.9, 124.6)));
  return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
}
float gnoise(vec3 x) {
  vec3 i = floor(x), f = fract(x);
  vec3 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(dot(hash3(i), f), dot(hash3(i + vec3(1,0,0)), f - vec3(1,0,0)), u.x),
                 mix(dot(hash3(i + vec3(0,1,0)), f - vec3(0,1,0)), dot(hash3(i + vec3(1,1,0)), f - vec3(1,1,0)), u.x), u.y),
             mix(mix(dot(hash3(i + vec3(0,0,1)), f - vec3(0,0,1)), dot(hash3(i + vec3(1,0,1)), f - vec3(1,0,1)), u.x),
                 mix(dot(hash3(i + vec3(0,1,1)), f - vec3(0,1,1)), dot(hash3(i + vec3(1,1,1)), f - vec3(1,1,1)), u.x), u.y), u.z);
}
float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
`;

const FS_EXT = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uSky;
uniform vec2 uRes;
uniform vec2 uTexRes;
uniform float uScale;
uniform float uTime;
uniform vec2 uTilt;
uniform float uBoil;
uniform float uIso;
uniform vec3 uSigma;
uniform vec3 uDisp;
uniform vec3 uExt;
uniform float uLas;
uniform int uRadio;
out vec4 o;
${NOISE}
// a Gaussian blur of sigma (px) at p (px): 13 taps on a golden-angle spiral over a prefiltered level
float tapc(vec2 p, float s, int ch) {
  float lod = log2(max(1.0, s * 0.55));
  float acc = 0.0, wsum = 0.0;
  float rot = hash12(floor(p)) * 6.2831;
  for (int k = 0; k < 13; k++) {
    float fk = float(k);
    float r = k == 0 ? 0.0 : sqrt(fk / 12.0) * 2.2 * s;
    float a = fk * 2.39996 + rot;
    vec2 q = p + r * vec2(cos(a), sin(a));
    float w = exp(-r * r / (2.0 * s * s + 1e-6));
    vec4 c = textureLod(uSky, q / uTexRes, lod);
    acc += w * (ch == 0 ? c.r : ch == 1 ? c.g : c.b);
    wsum += w;
  }
  return acc / wsum;
}
void main() {
  vec2 p = vec2(vUv.x, 1.0 - vUv.y) * uRes;
  if (uRadio == 1) {
    float v = tapc(p, uSigma.g / uScale, 0);
    if (uLas > 0.0) v -= tapc(p, uLas / uScale, 0);
    o = vec4(v, v, v, 1.0);
    return;
  }
  vec2 a = p * uScale;
  vec2 d = uTilt;
  if (uBoil > 0.0) {
    vec3 q = vec3(a / uIso + vec2(uTime * 1.9, uTime * 0.6), uTime * 1.3);
    d += uBoil * vec2(gnoise(q), gnoise(q + 17.3)) * 1.6;
  }
  // image motion (arcsec) → pixels; the texture's rows run north to south
  vec2 dp = vec2(d.x, -d.y) / uScale;
  vec3 c;
  c.r = tapc(p - dp - vec2(0.0, -uDisp.r / uScale), uSigma.r / uScale, 0);
  c.g = tapc(p - dp - vec2(0.0, -uDisp.g / uScale), uSigma.g / uScale, 1);
  c.b = tapc(p - dp - vec2(0.0, -uDisp.b / uScale), uSigma.b / uScale, 2);
  o = vec4(c * uExt, 1.0);
}`;

const VS_STAR = `#version 300 es
precision highp float;
in vec2 aPos;
in vec4 aA; // x, y (px, rows down), flux, seed
in vec4 aB; // r, g, b, -
uniform vec2 uRes;
uniform float uScale;
uniform float uTime;
uniform vec2 uTilt;
uniform float uJit;
uniform float uScint;
uniform float uColorTw;
uniform float uExtent;
uniform float uSkyY;
uniform float uHaloA;
uniform float uHaloW;
uniform float uSpikeLen;
out vec2 vOff;
flat out vec3 vCol;
flat out float vSeed;
flat out float vR;
float wob(float t, float s) {
  return (sin(t * 7.3 + s * 1.7) + 0.6 * sin(t * 13.1 + s * 4.1) + 0.35 * sin(t * 23.7 + s * 2.9) + 0.2 * sin(t * 41.3 + s * 7.7)) / 1.25;
}
void main() {
  float s = aA.w;
  vec2 jit = uTilt + uJit * vec2(wob(uTime, s), wob(uTime + 11.0, s * 1.37));
  vec3 tw = vec3(1.0);
  if (uScint > 0.0) {
    float base = wob(uTime * 1.6, s * 2.1);
    tw = exp(uScint * (base + uColorTw * vec3(wob(uTime * 2.2, s + 3.0), wob(uTime * 2.2, s + 5.0), wob(uTime * 2.2, s + 7.0))) - 0.5 * uScint * uScint);
  }
  vec3 col = aB.rgb * aA.z * tw;
  // how far the light of this star matters: the halo down to a fraction of the sky
  float f = aA.z;
  float peakHalo = f * uHaloW * 1.5 / (3.14159265 * uHaloA * uHaloA);
  float rHalo = uHaloA * sqrt(max(0.0, pow(max(peakHalo / (uSkyY * 0.03 + 1e-12), 1.0), 1.0 / 2.5) - 1.0));
  float rSpike = uSpikeLen * sqrt(0.2 * f / (uSkyY + 1e-12));
  float r = clamp(max(uExtent, max(rHalo, rSpike)), 2.5 * uScale, 260.0 * uScale);
  vOff = aPos * r;
  vR = r;
  vCol = col;
  vSeed = s;
  vec2 c = aA.xy + vec2(jit.x, -jit.y) / uScale + vec2(aPos.x, -aPos.y) * r / uScale;
  gl_Position = vec4(c.x / uRes.x * 2.0 - 1.0, 1.0 - c.y / uRes.y * 2.0, 0.0, 1.0);
}`;

const FS_STAR = `#version 300 es
precision highp float;
in vec2 vOff; // arcsec from the star, +x west, +y north
flat in vec3 vCol;
flat in float vSeed;
flat in float vR;
uniform float uScale;
uniform float uTime;
uniform vec3 uLamD;     // λ/D per channel, arcsec
uniform float uObs;
uniform float uStrehl;
uniform float uSigSe;   // arcsec
uniform float uSpeck;
uniform float uHaloA;
uniform float uHaloW;
uniform int uSpikes;
uniform float uSpikeAng;
uniform vec3 uDisp;
uniform vec3 uExt;
out vec4 o;
${NOISE}
float j1(float x) {
  float ax = abs(x);
  if (ax < 8.0) {
    float y = x * x;
    float a = x * (72362614232.0 + y * (-7895059235.0 + y * (242396853.1 + y * (-2972611.439 + y * (15704.48260 + y * (-30.16036606))))));
    float b = 144725228442.0 + y * (2300535178.0 + y * (18583304.74 + y * (99447.43394 + y * (376.9991397 + y))));
    return a / b;
  }
  float z = 8.0 / ax, y = z * z, xx = ax - 2.356194491;
  float p = 1.0 + y * (0.183105e-2 + y * (-0.3516396496e-4 + y * (0.2457520174e-5 + y * (-0.240337019e-6))));
  float q = 0.04687499995 + y * (-0.2002690873e-3 + y * (0.8449199096e-5 + y * (-0.88228987e-6 + y * 0.105787412e-6)));
  return sqrt(0.636619772 / ax) * (cos(xx) * p - z * sin(xx) * q) * sign(x);
}
// Airy pattern with a central obstruction, normalised to unit volume (per arcsec²)
float airy(float r, float lamD) {
  float x = 3.14159265 * r / lamD;
  float e = uObs;
  float norm = 3.14159265 * (1.0 - e * e) / (4.0 * lamD * lamD);
  if (x < 1e-4) return norm;
  float a = 2.0 * j1(x) / x;
  if (e > 0.0) a -= e * e * 2.0 * j1(e * x) / (e * x);
  a /= (1.0 - e * e);
  return norm * a * a;
}
float gauss(float r, float s) { return exp(-r * r / (2.0 * s * s)) / (6.2831853 * s * s); }
float psf(vec2 off, float lamD) {
  float r = length(off);
  float px = uScale;
  // rings narrower than the pixels: a Gaussian of the same width
  float core = lamD > 1.3 * px ? airy(r, lamD) : gauss(r, max(0.45 * lamD, 0.5 * px));
  float s2 = max(uSigSe, 0.5 * px);
  float seeing = gauss(r, s2);
  if (uSpeck > 0.0) {
    float n = gnoise(vec3(off / max(lamD, px * 0.8), uTime * 6.0 + vSeed));
    seeing *= max(0.0, 1.0 + uSpeck * n * 2.2);
  }
  float halo = (1.5 / (3.14159265 * uHaloA * uHaloA)) * pow(1.0 + r * r / (uHaloA * uHaloA), -2.5);
  float v = uStrehl * core + (1.0 - uStrehl - uHaloW) * seeing + uHaloW * halo;
  if (uSpikes > 0) {
    int lines = uSpikes / 2;
    float w = max(0.35 * lamD, 0.6 * px);
    for (int k = 0; k < 3; k++) {
      if (k >= lines) break;
      float a = uSpikeAng + 3.14159265 * float(k) / float(lines);
      vec2 dir = vec2(cos(a), sin(a));
      float along = abs(dot(off, dir)), perp = dot(off, vec2(-dir.y, dir.x));
      v += 0.012 * exp(-perp * perp / (w * w)) * (lamD / (lamD + along)) * (lamD / (lamD + along)) / (2.0 * lamD * w * 1.7725);
    }
  }
  return v;
}
void main() {
  vec3 c;
  c.r = psf(vOff - vec2(0.0, uDisp.r), uLamD.r) * vCol.r;
  c.g = psf(vOff - vec2(0.0, uDisp.g), uLamD.g) * vCol.g;
  c.b = psf(vOff - vec2(0.0, uDisp.b), uLamD.b) * vCol.b;
  // the sprite is a square: fade the far wings out before its edge
  c *= 1.0 - smoothstep(0.7 * vR, vR, length(vOff));
  o = vec4(min(c * uExt, vec3(60000.0)), 1.0);
}`;

const FS_OUT = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uImg;
uniform vec2 uRes;
uniform vec2 uFlip;
uniform int uMode;      // 0 eye, 1 detector, 2 radio
uniform vec3 uSky;
uniform float uGain;
uniform float uK;
uniform float uStop;
uniform float uTime;
uniform float uNoise;
uniform float uSoft;
uniform float uWhite;
uniform float uMono;
out vec4 o;
${NOISE}
vec3 cmap(float t) {
  t = clamp(t, 0.0, 1.0);
  vec3 c0 = vec3(0.016, 0.02, 0.035), c1 = vec3(0.05, 0.08, 0.17), c2 = vec3(0.32, 0.2, 0.13), c3 = vec3(0.68, 0.5, 0.28), c4 = vec3(1.0, 0.95, 0.82);
  if (t < 0.25) return mix(c0, c1, t / 0.25);
  if (t < 0.5) return mix(c1, c2, (t - 0.25) / 0.25);
  if (t < 0.75) return mix(c2, c3, (t - 0.5) / 0.25);
  return mix(c3, c4, (t - 0.75) / 0.25);
}
float lum(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
void main() {
  vec2 uv = 0.5 + (vUv - 0.5) * uFlip;
  vec2 fc = gl_FragCoord.xy;
  vec3 s = texture(uImg, uv).rgb;
  vec3 col;
  float g1 = hash12(fc + fract(uTime * 7.13) * 917.0) - 0.5;
  float g2 = hash12(fc * 1.37 + fract(uTime * 3.71) * 533.0) - 0.5;
  if (uMode == 2) {
    // an asinh stretch, so lobes show next to a bright core
    float v = s.r / uWhite + uNoise * (g1 + g2) * 1.7;
    col = cmap(uSoft >= 1.0 ? v : asinh(max(v, -0.02) / uSoft) / asinh(1.0 / uSoft));
  } else if (uMode == 1) {
    float st = hash12(fc) - 0.5, st2 = hash12(fc * 1.91 + 7.0) - 0.5;
    vec3 v = s + uNoise * (st + st2) * 1.7;
    float y = lum(v);
    float m = asinh(max(y, -uSoft) / uSoft) / asinh(uWhite / uSoft);
    vec3 hue = y > 1e-9 ? clamp(v / y, 0.0, 3.0) : vec3(1.0);
    hue = mix(hue, vec3(1.0, 0.97, 0.92), uMono);
    col = clamp(m, 0.0, 1.0) * mix(vec3(1.0), hue, clamp(m * 1.4, 0.0, 1.0));
  } else {
    vec3 e = (s + uSky) * uGain;
    float y = max(lum(e), 1e-12);
    float ys = lum(uSky) * uGain;
    float v = y / (y + uK);
    float vs = ys / (ys + uK);
    float d = clamp((v - vs * 0.82) / (1.0 - vs * 0.82), 0.0, 1.0);
    // colour only where the light is bright enough for the cones
    float mu = -2.5 * log(y / ${ENC.toExponential()}) / log(10.0);
    float sat = smoothstep(17.5, 13.0, mu);
    vec3 hue = mix(vec3(0.93, 0.97, 1.06), clamp(e / y, 0.0, 4.0), sat);
    col = clamp(pow(d, 0.9) * hue, 0.0, 1.0);
  }
  col = pow(col, vec3(1.0 / 2.2));
  // the dark-adapted eye's own noise, in display space so that it stays faint
  if (uMode == 0) col = clamp(col + (g1 + g2) * 0.035 * (1.0 - smoothstep(0.05, 0.5, lum(col))), 0.0, 1.0);
  if (uStop > 0.0) {
    float r = length(fc - uRes * 0.5);
    col *= (1.0 - smoothstep(uStop - 1.5, uStop + 0.5, r)) * (1.0 - 0.12 * smoothstep(uStop * 0.6, uStop, r));
  }
  o = vec4(col, 1.0);
}`;

function compile(gl: WebGL2RenderingContext, vs: string, fs: string): WebGLProgram {
  const p = gl.createProgram()!;
  for (const [type, src] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]] as const) {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'shader');
    gl.attachShader(p, s);
  }
  gl.bindAttribLocation(p, 0, 'aPos');
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) ?? 'link');
  return p;
}

export interface FrameParams {
  mode: 0 | 1 | 2;
  time: number;
  scale: number;
  tilt: [number, number];
  boil: number;
  iso: number;
  sigma: [number, number, number];
  disp: [number, number, number];
  ext: [number, number, number];
  las: number;
  // stars
  jit: number;
  scint: number;
  colorTw: number;
  lamD: [number, number, number];
  obs: number;
  strehl: number;
  sigSe: number;
  speck: number;
  haloA: number;
  haloW: number;
  spikes: number;
  spikeAng: number;
  // output
  flip: [number, number];
  sky: [number, number, number];
  gain: number;
  k: number;
  stop: number;
  noise: number;
  soft: number;
  white: number;
  mono: number;
}

export class ScopeGL {
  readonly gl: WebGL2RenderingContext;
  private ext: WebGLProgram;
  private star: WebGLProgram;
  private out: WebGLProgram;
  private quad: WebGLBuffer;
  private vaoQuad: WebGLVertexArrayObject;
  private vaoStar: WebGLVertexArrayObject;
  private starBuf: WebGLBuffer;
  private skyTex: WebGLTexture;
  private fbo: WebGLFramebuffer;
  private fboTex: WebGLTexture;
  private W = 0;
  private H = 0;
  private TW = 1;
  private TH = 1;
  private nStars = 0;
  private u = new Map<WebGLProgram, Map<string, WebGLUniformLocation | null>>();

  constructor(readonly canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, premultipliedAlpha: false, preserveDrawingBuffer: false, powerPreference: 'low-power' });
    if (!gl || !gl.getExtension('EXT_color_buffer_float')) throw new Error('webgl2');
    this.gl = gl;
    this.ext = compile(gl, VS_QUAD, FS_EXT);
    this.star = compile(gl, VS_STAR, FS_STAR);
    this.out = compile(gl, VS_QUAD, FS_OUT);
    this.quad = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    this.vaoQuad = gl.createVertexArray()!;
    gl.bindVertexArray(this.vaoQuad);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    this.starBuf = gl.createBuffer()!;
    this.vaoStar = gl.createVertexArray()!;
    gl.bindVertexArray(this.vaoStar);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.starBuf);
    const la = gl.getAttribLocation(this.star, 'aA'), lb = gl.getAttribLocation(this.star, 'aB');
    gl.enableVertexAttribArray(la);
    gl.vertexAttribPointer(la, 4, gl.FLOAT, false, 32, 0);
    gl.vertexAttribDivisor(la, 1);
    gl.enableVertexAttribArray(lb);
    gl.vertexAttribPointer(lb, 4, gl.FLOAT, false, 32, 16);
    gl.vertexAttribDivisor(lb, 1);
    gl.bindVertexArray(null);
    this.skyTex = gl.createTexture()!;
    this.fboTex = gl.createTexture()!;
    this.fbo = gl.createFramebuffer()!;
  }

  private loc(p: WebGLProgram, name: string): WebGLUniformLocation | null {
    let m = this.u.get(p);
    if (!m) this.u.set(p, (m = new Map()));
    if (!m.has(name)) m.set(name, this.gl.getUniformLocation(p, name));
    return m.get(name)!;
  }

  /** new picture of the sky (W×H×4, already ×ENC) and its point sources */
  setScene(W: number, H: number, sky: Float32Array, stars: Float32Array, nStars: number): void {
    const gl = this.gl;
    if (W !== this.W || H !== this.H) {
      this.W = W; this.H = H;
      gl.bindTexture(gl.TEXTURE_2D, this.fboTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, W, H, 0, gl.RGBA, gl.HALF_FLOAT, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.fboTex, 0);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }
    // a power-of-two texture: mipmaps of odd sizes drop rows and columns, and point sources with them
    this.TW = 1 << Math.ceil(Math.log2(W));
    this.TH = 1 << Math.ceil(Math.log2(H));
    gl.bindTexture(gl.TEXTURE_2D, this.skyTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, this.TW, this.TH, 0, gl.RGBA, gl.HALF_FLOAT, null);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, W, H, gl.RGBA, gl.FLOAT, sky);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.starBuf);
    gl.bufferData(gl.ARRAY_BUFFER, stars.length ? stars : new Float32Array(8), gl.STATIC_DRAW);
    this.nStars = nStars;
  }

  draw(f: FrameParams, skyY: number): void {
    const gl = this.gl;
    if (!this.W) return;
    const u1 = (p: WebGLProgram, n: string, v: number) => gl.uniform1f(this.loc(p, n), v);
    const u2 = (p: WebGLProgram, n: string, v: [number, number]) => gl.uniform2f(this.loc(p, n), v[0], v[1]);
    const u3 = (p: WebGLProgram, n: string, v: [number, number, number]) => gl.uniform3f(this.loc(p, n), v[0], v[1], v[2]);

    // 1. the extended sky
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.viewport(0, 0, this.W, this.H);
    gl.disable(gl.BLEND);
    gl.useProgram(this.ext);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.skyTex);
    gl.uniform1i(this.loc(this.ext, 'uSky'), 0);
    u2(this.ext, 'uRes', [this.W, this.H]);
    u2(this.ext, 'uTexRes', [this.TW, this.TH]);
    u1(this.ext, 'uScale', f.scale);
    u1(this.ext, 'uTime', f.time);
    u2(this.ext, 'uTilt', f.tilt);
    u1(this.ext, 'uBoil', f.boil);
    u1(this.ext, 'uIso', f.iso);
    u3(this.ext, 'uSigma', f.sigma);
    u3(this.ext, 'uDisp', f.disp);
    u3(this.ext, 'uExt', f.ext);
    u1(this.ext, 'uLas', f.las);
    gl.uniform1i(this.loc(this.ext, 'uRadio'), f.mode === 2 ? 1 : 0);
    gl.bindVertexArray(this.vaoQuad);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    // 2. point sources, added
    if (f.mode !== 2 && this.nStars > 0) {
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE);
      const p = this.star;
      gl.useProgram(p);
      u2(p, 'uRes', [this.W, this.H]);
      u1(p, 'uScale', f.scale);
      u1(p, 'uTime', f.time);
      u2(p, 'uTilt', f.tilt);
      u1(p, 'uJit', f.jit);
      u1(p, 'uScint', f.scint);
      u1(p, 'uColorTw', f.colorTw);
      u1(p, 'uExtent', Math.max(4 * Math.max(f.sigSe, f.lamD[1]), 3 * f.scale));
      u1(p, 'uSkyY', skyY);
      u1(p, 'uHaloA', f.haloA);
      u1(p, 'uHaloW', f.haloW);
      u1(p, 'uSpikeLen', f.spikes ? 1 : 0);
      u3(p, 'uLamD', f.lamD);
      u1(p, 'uObs', f.obs);
      u1(p, 'uStrehl', f.strehl);
      u1(p, 'uSigSe', f.sigSe);
      u1(p, 'uSpeck', f.speck);
      gl.uniform1i(this.loc(p, 'uSpikes'), f.spikes);
      u1(p, 'uSpikeAng', f.spikeAng);
      u3(p, 'uDisp', f.disp);
      u3(p, 'uExt', f.ext);
      gl.bindVertexArray(this.vaoStar);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, this.nStars);
      gl.disable(gl.BLEND);
    }

    // 3. out to the screen
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    const p = this.out;
    gl.useProgram(p);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.fboTex);
    gl.uniform1i(this.loc(p, 'uImg'), 0);
    u2(p, 'uRes', [this.canvas.width, this.canvas.height]);
    u2(p, 'uFlip', f.flip);
    gl.uniform1i(this.loc(p, 'uMode'), f.mode);
    u3(p, 'uSky', f.sky);
    u1(p, 'uGain', f.gain);
    u1(p, 'uK', f.k);
    u1(p, 'uStop', f.stop);
    u1(p, 'uTime', f.time);
    u1(p, 'uNoise', f.noise);
    u1(p, 'uSoft', f.soft);
    u1(p, 'uWhite', f.white);
    u1(p, 'uMono', f.mono);
    gl.bindVertexArray(this.vaoQuad);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.bindVertexArray(null);
  }

  dispose(): void {
    const gl = this.gl;
    gl.deleteTexture(this.skyTex);
    gl.deleteTexture(this.fboTex);
    gl.deleteFramebuffer(this.fbo);
    gl.deleteBuffer(this.quad);
    gl.deleteBuffer(this.starBuf);
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  }
}
