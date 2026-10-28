import {
  AdditiveBlending, BufferAttribute, BufferGeometry, Mesh, ShaderMaterial, Vector2, Vector3, type Scene,
} from 'three';

/**
 * Screen-space glare of the brightest star in view: a soft HDR core with faint, thin
 * diffraction spikes (the bloom pass spreads it a little further) and a wide, very dim halo.
 * Deliberately restrained — no ghosts or streaks; it reads as the eye's glare, not a camera lens.
 * Quads positioned directly in clip space; the caller supplies the star's screen position, size
 * and an occlusion factor.
 */

// f: offset along the star→centre axis (1 = at the star), size (NDC), kind, strength, colour
const ELEMENTS: Array<[number, number, number, number, [number, number, number]]> = [
  [1.0, 0.1, 0, 1.0, [1, 1, 1]],           // glare core + spikes
  [1.0, 0.3, 1, 0.12, [1, 0.95, 0.85]],    // wide soft halo
];

const VERT = /* glsl */ `
attribute vec2 corner;
attribute vec4 elem;     // f, size, kind, strength
attribute vec3 ecol;
uniform vec2 uStar;      // star position (NDC)
uniform float uAspect;   // width / height
uniform float uRadius;   // apparent radius of the star disc (NDC, x units)
varying vec2 vUv;
varying vec4 vElem;
varying vec3 vCol;
void main() {
  vUv = corner;
  vElem = elem;
  vCol = ecol;
  vec2 centre = uStar * elem.x;
  float kind = elem.z;
  float size = elem.y;
  size = max(size, uRadius * (kind < 0.5 ? 1.6 : 3.0));
  vec2 pos = centre + corner * size * vec2(1.0, uAspect);
  gl_Position = vec4(pos, 0.0, 1.0);
}`;

const FRAG = /* glsl */ `
precision highp float;
uniform float uIntensity;
uniform vec3 uColor;
varying vec2 vUv;
varying vec4 vElem;
varying vec3 vCol;
void main() {
  float r = length(vUv);
  float kind = vElem.z;
  float a = 0.0;
  vec3 col = uColor * vCol;
  if (kind < 0.5) {
    // core: a bright centre with a short skirt; four thin, faint diffraction spikes
    float ang = atan(vUv.y, vUv.x);
    float spikes = pow(abs(cos(ang * 2.0)), 220.0) * exp(-r * 4.5) * 0.28;
    a = exp(-r * 11.0) * 1.3 + exp(-r * 4.0) * 0.1 + spikes;
    a *= 1.0 - smoothstep(0.8, 1.0, r);
    col = mix(col, vec3(1.0), 0.5);
  } else {
    // wide halo: smooth falloff, no visible edge
    float d = max(1.0 - r, 0.0);
    a = d * d * d * 0.5;
  }
  gl_FragColor = vec4(col * a * vElem.w * uIntensity, 1.0);
}`;

export class LensFlare {
  readonly mesh: Mesh;
  private readonly mat: ShaderMaterial;
  private readonly star = new Vector2();
  private level = 0;

  constructor(scene: Scene) {
    const n = ELEMENTS.length;
    const corner = new Float32Array(n * 4 * 2);
    const elem = new Float32Array(n * 4 * 4);
    const ecol = new Float32Array(n * 4 * 3);
    const idx = new Uint16Array(n * 6);
    const C = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
    for (let i = 0; i < n; i++) {
      const [f, size, kind, strength, col] = ELEMENTS[i];
      for (let v = 0; v < 4; v++) {
        const k = i * 4 + v;
        corner[k * 2] = C[v][0]; corner[k * 2 + 1] = C[v][1];
        elem[k * 4] = f; elem[k * 4 + 1] = size; elem[k * 4 + 2] = kind; elem[k * 4 + 3] = strength;
        ecol[k * 3] = col[0]; ecol[k * 3 + 1] = col[1]; ecol[k * 3 + 2] = col[2];
      }
      idx.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3], i * 6);
    }
    const geo = new BufferGeometry();
    geo.setAttribute('corner', new BufferAttribute(corner, 2));
    geo.setAttribute('elem', new BufferAttribute(elem, 4));
    geo.setAttribute('ecol', new BufferAttribute(ecol, 3));
    geo.setIndex(new BufferAttribute(idx, 1));
    this.mat = new ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: {
        uStar: { value: this.star },
        uAspect: { value: 1 },
        uRadius: { value: 0 },
        uIntensity: { value: 0 },
        uColor: { value: new Vector3(1, 1, 1) },
      },
      transparent: true,
      blending: AdditiveBlending,
      depthTest: false,
      depthWrite: false,
    });
    this.mesh = new Mesh(geo, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 60;
    this.mesh.visible = false;
    scene.add(this.mesh);
  }

  /**
   * @param ndc star position in normalised device coordinates (null: no star in front of the camera)
   * @param radiusNdc apparent radius of the disc in NDC x units
   * @param intensity brightness (1 ≈ the Sun from Earth), already multiplied by the unocculted fraction
   * @param dt real seconds since the last frame (the flare eases in and out)
   */
  update(ndc: Vector2 | null, radiusNdc: number, intensity: number, color: Vector3, aspect: number, dt: number): void {
    let target = 0;
    if (ndc) {
      // fade as the star leaves the frame; a disc filling the screen glares less (we are inside its glow)
      const edge = Math.max(Math.abs(ndc.x), Math.abs(ndc.y) * 1);
      const inFrame = 1 - smooth(0.95, 1.35, edge);
      const big = radiusNdc > 0.04 ? Math.max(0.08, Math.pow(0.04 / radiusNdc, 1.3)) : 1;
      target = intensity * inFrame * big;
      this.star.copy(ndc);
      this.mat.uniforms.uRadius.value = Math.min(radiusNdc, 0.6);
      this.mat.uniforms.uColor.value.copy(color);
    }
    const k = Math.min(1, dt * 6);
    this.level += (target - this.level) * k;
    if (this.level < 0.002 && target === 0) this.level = 0;
    this.mat.uniforms.uIntensity.value = this.level;
    this.mat.uniforms.uAspect.value = aspect;
    this.mesh.visible = this.level > 0.002;
  }

  setEnabled(on: boolean): void { if (!on) { this.level = 0; this.mesh.visible = false; } this.enabled = on; }
  enabled = true;
}

function smooth(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}
