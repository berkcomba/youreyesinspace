import {
  BufferAttribute, BufferGeometry, Group, IcosahedronGeometry, InstancedBufferAttribute, InstancedBufferGeometry, Mesh, Points,
  Quaternion, ShaderMaterial, Vector3, Vector4,
} from 'three';
import type { IUniform } from 'three';
import { Shaders } from './shaders';
import type { CelestialBody } from '../core/CelestialBody';

/** Number of annulus slots in the window (must match N_ANN in ringrock.vert). */
const N_ANN = 32;
/** Azimuth slots in the window. */
const N_AZ = 32;
/** Particles per cell. */
const PER_CELL = 128;
/** Range (km) around the camera in which boulders exist; also the altitude at which the layer fades in. */
const RANGE_KM = 600;
/** Cell size (km): annulus width and arc length. The window is N_ANN × N_AZ cells. */
const CELL_KM = (2 * RANGE_KM) / N_ANN;
/** Vertical half-thickness of the boulder layer (km). Exaggerated (the real rings are ~10 m thick). */
const HEIGHT_KM = 80;
/**
 * Boulder radii (km). Real ring particles run from dust to ~10 m; at any feasible instance count
 * those would be invisible, so the range is scaled up while keeping the real shape of the
 * distribution — a power law with N(>s) ∝ s⁻² (many pebbles, very few giants).
 */
const SIZE_MIN_KM = 0.1;
const SIZE_MAX_KM = 3.0;

/**
 * Far layer: a sparse, fixed cloud of unresolved specks (GL points, 4k of them) over the whole
 * ring, so the rings read as granular from outside too — a few drifting dots, nothing more.
 */
const FAR_N_AZ = 64;
const FAR_PER_CELL = 2;
const FAR_HEIGHT_KM = 120;
/** camera distance from the body (km) where the far specks start to fade / vanish */
const FAR_FADE_START_KM = 320000;
const FAR_FADE_END_KM = 400000;

const _y = new Vector3(0, 1, 0);
const _q = new Quaternion();
const _v = new Vector3();

type Uniforms = Record<string, IUniform>;

/**
 * Boulder layer for ring systems. Only populated near the camera: when the camera is within
 * a few thousand km of the ring plane the sheet texture thins out locally and ~100k procedurally
 * placed boulders (deterministic per cell, so nothing pops as the window slides) take over,
 * each annulus revolving at its own Kepler rate.
 */
export class RingParticles {
  readonly group = new Group();
  readonly mesh: Mesh;
  readonly mat: ShaderMaterial;
  /** 0..1 visibility this frame (also used to fade the sheet texture locally) */
  visibility = 0;
  /** camera distance from the ring plane this frame (km) */
  altitude = Infinity;

  readonly far: Points;
  readonly farMat: ShaderMaterial;

  private readonly body: CelestialBody;
  private readonly phase = new Array<number>(N_ANN).fill(0);
  private readonly camCell = new Array<number>(N_ANN).fill(0);
  private readonly farPhase = new Array<number>(N_ANN).fill(0);

  constructor(body: CelestialBody, lit: Uniforms, gaps: Vector4[]) {
    this.body = body;
    const r = body.data.rings!;
    const base = new IcosahedronGeometry(1, 1);
    const geo = new InstancedBufferGeometry();
    geo.index = base.index;
    geo.setAttribute('position', base.getAttribute('position'));
    geo.setAttribute('normal', base.getAttribute('normal'));
    const n = N_ANN * N_AZ * PER_CELL;
    const cell = new Float32Array(n * 3);
    let k = 0;
    for (let a = 0; a < N_ANN; a++) for (let t = 0; t < N_AZ; t++) for (let j = 0; j < PER_CELL; j++) {
      cell[k++] = a; cell[k++] = t; cell[k++] = j;
    }
    geo.setAttribute('aCell', new InstancedBufferAttribute(cell, 3));
    geo.instanceCount = n;

    this.mat = new ShaderMaterial({
      vertexShader: Shaders.ringRockVert,
      fragmentShader: Shaders.ringRockFrag,
      uniforms: {
        ...lit,
        uPhase: { value: this.phase },
        uCamCell: { value: this.camCell },
        uCamAnnulus: { value: 0 },
        uSlotsB: { value: N_AZ },
        uInner: { value: r.inner },
        uOuter: { value: r.outer },
        uDr: { value: CELL_KM },
        uHeight: { value: HEIGHT_KM },
        uSeed: { value: r.seed },
        uOpacity: { value: r.opacity },
        uGaps: { value: gaps },
        uSizeMin: { value: SIZE_MIN_KM },
        uSizeMax: { value: SIZE_MAX_KM },
        uPxPerRad: { value: 1000 },
        uVis: { value: 0 },
        uRealTime: { value: 0 },
        uColor: { value: new Vector3(r.color[0], r.color[1], r.color[2]) },
        uPlaneNormal: { value: new Vector3(0, 1, 0) },
      },
      transparent: true,
      depthWrite: true,
    });
    this.mesh = new Mesh(geo, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 2;
    this.group.add(this.mesh);

    // far specks
    const nFar = N_ANN * FAR_N_AZ * FAR_PER_CELL;
    const farCell = new Float32Array(nFar * 3);
    k = 0;
    for (let a = 0; a < N_ANN; a++) for (let t = 0; t < FAR_N_AZ; t++) for (let j = 0; j < FAR_PER_CELL; j++) {
      farCell[k++] = a; farCell[k++] = t; farCell[k++] = j;
    }
    const farGeo = new BufferGeometry();
    farGeo.setAttribute('aCell', new BufferAttribute(farCell, 3));
    // Points needs a position attribute to count vertices; the real position comes from aCell
    farGeo.setAttribute('position', new BufferAttribute(new Float32Array(nFar * 3), 3));
    this.farMat = new ShaderMaterial({
      vertexShader: Shaders.ringDustVert,
      fragmentShader: Shaders.ringDustFrag,
      uniforms: {
        ...lit,
        uPhase: { value: this.farPhase },
        uSlotsB: { value: FAR_N_AZ },
        uInner: { value: r.inner },
        uOuter: { value: r.outer },
        uHeight: { value: FAR_HEIGHT_KM },
        uSeed: { value: r.seed },
        uOpacity: { value: r.opacity },
        uGaps: { value: gaps },
        uVis: { value: 0 },
        uPointPx: { value: 1.6 },
        uNearKm: { value: RANGE_KM },
        uColor: { value: new Vector3(r.color[0], r.color[1], r.color[2]) },
      },
      transparent: true,
      depthWrite: false,
    });
    this.far = new Points(farGeo, this.farMat);
    this.far.frustumCulled = false;
    this.far.renderOrder = 2;
    this.group.add(this.far);
    this.group.visible = false;
  }

  /**
   * @param relPos body position relative to the camera (km)
   * @param simSeconds simulation time (s) for the Kepler phases
   * @param pxPerRad pixels per radian of the current view
   */
  update(relPos: Vector3, simSeconds: number, pxPerRad: number, enabled: boolean): void {
    const b = this.body;
    const r = b.data.rings!;
    // ring frame: +Y along the pole, azimuth reference arbitrary but stable
    _q.setFromUnitVectors(_y, b.pole);
    this.group.position.copy(relPos);
    this.group.quaternion.copy(_q);
    // camera in the ring frame
    _v.copy(relPos).negate().applyQuaternion(_q.clone().invert());
    const camR = Math.hypot(_v.x, _v.z);
    const camTheta = Math.atan2(_v.z, _v.x);
    this.altitude = Math.abs(_v.y);
    const halfWindow = RANGE_KM;
    // fade the layer in as the camera descends through RANGE_KM toward the plane, and only over the rings
    const altFade = 1 - smooth01((this.altitude - RANGE_KM * 0.35) / (RANGE_KM * 0.65));
    const radialFade = smooth01((camR - (r.inner - halfWindow)) / halfWindow) * (1 - smooth01((camR - (r.outer)) / halfWindow));
    this.visibility = enabled ? altFade * radialFade : 0;

    // far specks: visible whenever the camera is within FAR_FADE_END_KM of the body
    const farVis = enabled ? 1 - smooth01((relPos.length() - FAR_FADE_START_KM) / (FAR_FADE_END_KM - FAR_FADE_START_KM)) : 0;

    this.mesh.visible = this.visibility > 0.002;
    this.far.visible = farVis > 0.002;
    this.group.visible = this.mesh.visible || this.far.visible;
    if (!this.group.visible) return;

    const gm = b.gm; // km³/s²
    const twoPi = 2 * Math.PI;
    const camAnnulus = Math.floor((camR - r.inner) / CELL_KM);
    const farDr = (r.outer - r.inner) / N_ANN;
    for (let s = 0; s < N_ANN; s++) {
      if (this.mesh.visible) {
        const a = camAnnulus + s - N_ANN / 2;
        const rA = r.inner + (a + 0.5) * CELL_KM;
        const omega = Math.sqrt(gm / Math.max(rA, 1) ** 3);
        // phase in double precision, wrapped to [0, 2π) before it reaches the GPU
        const ph = (omega * simSeconds) % twoPi;
        this.phase[s] = ph < 0 ? ph + twoPi : ph;
        this.camCell[s] = Math.floor((camTheta - this.phase[s]) / (CELL_KM / Math.max(rA, 1)));
      }
      if (this.far.visible) {
        const rA = r.inner + (s + 0.5) * farDr;
        const ph = (Math.sqrt(gm / rA ** 3) * simSeconds) % twoPi;
        this.farPhase[s] = ph < 0 ? ph + twoPi : ph;
      }
    }
    if (this.mesh.visible) {
      const u = this.mat.uniforms;
      u.uCamAnnulus.value = camAnnulus;
      u.uPxPerRad.value = pxPerRad;
      u.uVis.value = this.visibility;
      u.uRealTime.value = (performance.now() * 1e-3) % 86400;
      u.uPlaneNormal.value.copy(b.pole);
    }
    if (this.far.visible) {
      const f = this.farMat.uniforms;
      f.uVis.value = farVis;
      f.uPointPx.value = 1.6 * Math.min(window.devicePixelRatio || 1, 2);
    }
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.mat.dispose();
    this.far.geometry.dispose();
    this.farMat.dispose();
  }
}

function smooth01(x: number): number {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
}
