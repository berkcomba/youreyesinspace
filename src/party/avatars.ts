import {
  AdditiveBlending, AnimationMixer, Box3, BoxGeometry, Color, ConeGeometry, CylinderGeometry, Group, LoopOnce, Mesh, MeshBasicMaterial, MeshStandardMaterial,
  Quaternion, SphereGeometry, Vector3, type AnimationAction, type AnimationClip, type BufferGeometry, type Material, type Object3D, type PerspectiveCamera, type Scene, type SkinnedMesh,
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { PARSEC_KM } from '../core/constants';
import type { Universe } from '../core/Universe';
import { fmtDistance, fmtScaleDistance } from '../ui/format';
import { PARTY_COLORS, type AvatarId, type Emote, type Member, type Pose } from './protocol';

/** an astronaut is this tall (km) when close enough to be seen at its true size */
const TRUE_HEIGHT_KM = 0.0018;
/** and never smaller than this on screen, so players can always find each other */
const MIN_PX = 46;
/** beyond this the model is drawn at this distance along the same direction (same apparent size) */
const FAR_KM = 1e9;
/** the kit's characters do not share clip names: the first one a model has wins */
const BASE_CLIPS = ['Jump_Idle', 'Idle_Neutral', 'Idle'];
const EMOTE_CLIPS: Record<Emote, string[]> = { wave: ['Wave', 'Hello'], yes: ['Yes', 'Interact'], no: ['No', 'HitRecieve'], jump: ['Jump', 'Roll'] };
/** the bone a jetpack rides on, by preference */
const PACK_BONES = ['Chest', 'Torso', 'Body'];

interface Model {
  scene: Object3D;
  clips: AnimationClip[];
  scale: number;
  centre: Vector3;
  /** where the jetpack sits (model space, model units) and on which bone */
  pack: { bone: string; at: Vector3; h: number } | null;
}

const loader = new GLTFLoader();
const models = new Map<AvatarId, Promise<Model>>();

export function loadAvatar(id: AvatarId): Promise<Model> {
  let p = models.get(id);
  if (!p) {
    p = loader.loadAsync(`${import.meta.env.BASE_URL}models/astronauts/${id}.glb`).then((gltf) => {
      const scene = gltf.scene;
      // the kit's characters carry a pistol: not in this universe
      scene.getObjectByName('Pistol')?.removeFromParent();
      scene.traverse((o) => {
        const mat = (o as { material?: Material | Material[] }).material;
        for (const m of Array.isArray(mat) ? mat : mat ? [mat] : []) {
          const s = m as MeshStandardMaterial;
          // lit by the system's star, plus a glow of their own so a player on the night side is not a black hole
          if (s.isMeshStandardMaterial && s.map) { s.emissive.set(0xffffff); s.emissiveMap = s.map; s.emissiveIntensity = 0.32; }
          else if (s.isMeshStandardMaterial) { s.emissive.copy(s.color); s.emissiveIntensity = 0.32; }
        }
        o.frustumCulled = false;
      });
      scene.updateMatrixWorld(true);
      const box = new Box3().setFromObject(scene);
      const h = Math.max(1e-6, box.max.y - box.min.y);
      return { scene, clips: gltf.animations, scale: 1 / h, centre: box.getCenter(new Vector3()), pack: packSpot(scene, box, h) };
    });
    models.set(id, p);
  }
  return p;
}

/** the middle of the back at chest height: the furthest-back vertex near the chest bone (characters face +Z) */
function packSpot(scene: Object3D, box: Box3, h: number): Model['pack'] {
  const bone = PACK_BONES.map((n) => scene.getObjectByName(n)).find((b) => !!b);
  if (!bone) return null;
  const at = bone.getWorldPosition(new Vector3());
  at.y += 0.04 * h;
  let back = Infinity;
  const v = new Vector3();
  scene.traverse((o) => {
    const m = o as SkinnedMesh;
    if (!m.isMesh) return;
    const pos = m.geometry.getAttribute('position');
    for (let i = 0; i < pos.count; i++) {
      m.getVertexPosition(i, v).applyMatrix4(m.matrixWorld);
      if (Math.abs(v.y - at.y) < 0.07 * h && Math.abs(v.x - at.x) < 0.1 * h && v.z < back) back = v.z;
    }
  });
  at.z = Number.isFinite(back) ? back : box.min.z * 0.6;
  return { bone: bone.name, at, h };
}

const clipName = (c: AnimationClip): string => c.name.replace(/^.*\|/, '');

/* ---------------- jetpack (built in units of the character's height) ---------------- */

interface Jetpack { root: Group; flames: Object3D[] }

let packParts: { plate: BufferGeometry; tank: BufferGeometry; cap: BufferGeometry; nozzle: BufferGeometry; flame: BufferGeometry; core: BufferGeometry; metal: MeshStandardMaterial; fire: MeshBasicMaterial; hot: MeshBasicMaterial } | null = null;

function parts(): NonNullable<typeof packParts> {
  if (packParts) return packParts;
  // a flame hangs down from its nozzle (origin), tip at -1
  const flame = new ConeGeometry(0.034, 1, 12, 1, true).rotateX(Math.PI).translate(0, -0.5, 0);
  const core = new ConeGeometry(0.018, 0.6, 10, 1, true).rotateX(Math.PI).translate(0, -0.3, 0);
  packParts = {
    plate: new BoxGeometry(0.2, 0.24, 0.05),
    tank: new CylinderGeometry(0.048, 0.048, 0.2, 16),
    cap: new SphereGeometry(0.048, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2),
    nozzle: new CylinderGeometry(0.028, 0.042, 0.045, 14, 1, true),
    flame, core,
    metal: new MeshStandardMaterial({ color: 0xc9ced6, metalness: 0.55, roughness: 0.38, emissive: 0x23262c }),
    fire: new MeshBasicMaterial({ color: 0xff9a3c, transparent: true, opacity: 0.8, blending: AdditiveBlending, depthWrite: false }),
    hot: new MeshBasicMaterial({ color: 0xcfe8ff, transparent: true, opacity: 0.95, blending: AdditiveBlending, depthWrite: false }),
  };
  return packParts;
}

function buildJetpack(color: string): Jetpack {
  const P = parts();
  const root = new Group();
  root.name = 'party-jetpack';
  const paint = new MeshStandardMaterial({ color, metalness: 0.25, roughness: 0.45, emissive: new Color(color).multiplyScalar(0.28) });
  const plate = new Mesh(P.plate, P.metal);
  plate.position.z = -0.025;
  root.add(plate);
  const flames: Object3D[] = [];
  for (const side of [-1, 1]) {
    const x = side * 0.062;
    const tank = new Mesh(P.tank, paint);
    tank.position.set(x, 0.01, -0.085);
    const cap = new Mesh(P.cap, paint);
    cap.position.set(x, 0.11, -0.085);
    const nozzle = new Mesh(P.nozzle, P.metal);
    nozzle.position.set(x, -0.112, -0.085);
    const flame = new Group();
    flame.position.set(x, -0.135, -0.085);
    flame.add(new Mesh(P.flame, P.fire), new Mesh(P.core, P.hot));
    root.add(tank, cap, nozzle, flame);
    flames.push(flame);
  }
  root.traverse((o) => { o.frustumCulled = false; });
  return { root, flames };
}

/** a pose in the current frame (km): precise inside the same system, from parsecs otherwise */
function locate(u: Universe, pose: Pose, out: Vector3): Vector3 {
  if (pose.s === u.current.starId) {
    const b = pose.b ? u.get(pose.b) : null;
    if (!pose.b || b) {
      out.set(pose.o[0], pose.o[1], pose.o[2]);
      return b ? out.add(b.position) : out;
    }
  }
  return out.set(pose.g[0], pose.g[1], pose.g[2]).multiplyScalar(PARSEC_KM).sub(u.current.origin);
}

/* ---------------- players ---------------- */

interface Player {
  m: Member;
  pose: Pose | null;
  root: Group;
  /** the loaded character inside root (null while loading) */
  body: Object3D | null;
  mixer: AnimationMixer | null;
  actions: Map<string, AnimationAction>;
  base: AnimationAction | null;
  pack: Jetpack | null;
  /** smoothed position in the current frame (km), and whether it is valid */
  at: Vector3;
  placed: boolean;
  /** their speed within their own frame (km/s, from consecutive poses), smoothed, and what it drives */
  vel: Vector3;
  velWant: Vector3;
  poseAt: number;
  thrust: number;
  lean: number;
  roll: number;
  phase: number;
  /** distance from the camera (km), and where the model was drawn on screen (px; r = 0 when not drawn) */
  d: number;
  sx: number; sy: number; sr: number;
  tag: HTMLElement;
  name: HTMLElement;
  dist: HTMLElement;
  bubble: HTMLElement;
  bubbleUntil: number;
  loading: AvatarId | null;
}

const _rel = new Vector3(), _want = new Vector3(), _dir = new Vector3(), _cs = new Vector3(), _v = new Vector3();
const _q = new Quaternion(), _tilt = new Quaternion(), _camInv = new Quaternion();
const FLIP = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), Math.PI);
const X = new Vector3(1, 0, 0), Z = new Vector3(0, 0, 1);

/**
 * The other players in the scene: an astronaut where they are (in this system), a name tag with
 * the distance everywhere (clamped to the screen edge when off-screen; a click teleports there).
 */
export class Avatars {
  private readonly group = new Group();
  private readonly players = new Map<string, Player>();
  private readonly layer: HTMLElement;
  private picked: string | null = null;
  onTagClick: (pid: string, dbl: boolean) => void = () => {};
  /** the player out of sight (hide and seek) */
  hidden: string | null = null;

  constructor(private readonly scene: Scene, private readonly universe: Universe, private readonly camera: PerspectiveCamera, private readonly size: () => { w: number; h: number }) {
    this.group.name = 'party-avatars';
    scene.add(this.group);
    this.layer = document.createElement('div');
    this.layer.className = 'party-tags';
    (document.getElementById('ui') ?? document.body).appendChild(this.layer);
  }

  dispose(): void {
    this.scene.remove(this.group);
    this.layer.remove();
    this.players.clear();
  }

  set(m: Member): void {
    let p = this.players.get(m.pid);
    if (!p) {
      const tag = document.createElement('button');
      tag.className = 'party-tag';
      tag.innerHTML = '<span class="pt-bubble" hidden></span><span class="pt-name"></span><span class="pt-dist"></span>';
      tag.addEventListener('click', () => this.onTagClick(m.pid, false));
      tag.addEventListener('dblclick', () => this.onTagClick(m.pid, true));
      tag.classList.toggle('sel', this.picked === m.pid);
      this.layer.appendChild(tag);
      const root = new Group();
      this.group.add(root);
      p = {
        m, pose: null, root, body: null, mixer: null, actions: new Map(), base: null, pack: null, at: new Vector3(), placed: false,
        vel: new Vector3(), velWant: new Vector3(), poseAt: 0, thrust: 0, lean: 0, roll: 0, phase: Math.random() * 100,
        d: Infinity, sx: 0, sy: 0, sr: 0,
        tag, name: tag.querySelector('.pt-name')!, dist: tag.querySelector('.pt-dist')!, bubble: tag.querySelector('.pt-bubble')!, bubbleUntil: 0, loading: null,
      };
      this.players.set(m.pid, p);
    }
    const recolour = p.m.color !== m.color;
    p.m = m;
    p.name.textContent = m.nick;
    p.tag.style.setProperty('--c', PARTY_COLORS[m.color] ?? '#fff');
    if (p.loading !== m.avatar || (recolour && p.body)) this.dress(p, m.avatar);
  }

  remove(pid: string): void {
    const p = this.players.get(pid);
    if (!p) return;
    this.group.remove(p.root);
    p.mixer?.stopAllAction();
    p.tag.remove();
    this.players.delete(pid);
  }

  setPose(pid: string, pose: Pose): void {
    const p = this.players.get(pid);
    if (!p) return;
    const now = performance.now();
    const prev = p.pose;
    // velocity within their own frame: an orbiting planet's motion is not theirs
    if (prev && prev.s === pose.s && prev.b === pose.b && now > p.poseAt) {
      const dt = Math.max(0.06, (now - p.poseAt) / 1000);
      p.velWant.set(pose.o[0] - prev.o[0], pose.o[1] - prev.o[1], pose.o[2] - prev.o[2]).divideScalar(dt);
    } else {
      p.velWant.set(0, 0, 0);
    }
    p.pose = pose;
    p.poseAt = now;
  }

  emote(pid: string, e: Emote): void {
    const p = this.players.get(pid);
    const name = EMOTE_CLIPS[e].find((n) => p?.actions.has(n));
    const a = name ? p?.actions.get(name) : undefined;
    if (!p?.mixer || !a || !p.base) return;
    a.reset().setLoop(LoopOnce, 1).fadeIn(0.2).play();
    p.base.fadeOut(0.2);
    const back = (ev: { action: AnimationAction }): void => {
      if (ev.action !== a) return;
      p.mixer?.removeEventListener('finished', back);
      a.fadeOut(0.25);
      p.base?.reset().fadeIn(0.25).play();
    };
    p.mixer.addEventListener('finished', back);
  }

  say(pid: string, text: string): void {
    const p = this.players.get(pid);
    if (!p) return;
    p.bubble.textContent = text.length > 60 ? `${text.slice(0, 58)}…` : text;
    p.bubble.hidden = false;
    p.bubbleUntil = performance.now() + 6000;
  }

  /** a player's last pose (null before their first) */
  poseOf(pid: string): Pose | null {
    return this.players.get(pid)?.pose ?? null;
  }

  /** where a player is now in the current frame (km; null before their first pose) */
  positionOf(pid: string): Vector3 | null {
    const p = this.players.get(pid);
    return p?.placed ? p.at : null;
  }

  distanceOf(pid: string): number {
    return this.players.get(pid)?.d ?? Infinity;
  }

  /** the selected player's tag stands out */
  select(pid: string | null): void {
    this.picked = pid;
    for (const p of this.players.values()) p.tag.classList.toggle('sel', p.m.pid === pid);
  }

  /** the player drawn under a screen point (px), nearest first */
  pick(x: number, y: number, slack: number): string | null {
    let best: string | null = null, bestD = Infinity;
    for (const p of this.players.values()) {
      if (!p.sr || !p.root.visible) continue;
      const d = Math.hypot(x - p.sx, y - p.sy);
      if (d <= Math.max(p.sr, 14) + slack && d < bestD) { best = p.m.pid; bestD = d; }
    }
    return best;
  }

  /**
   * Everyone's position for this frame, before the camera moves (a camera following a player
   * must know where they are now, not where they were drawn last frame).
   */
  step(dt: number, camPos: Vector3): void {
    const blend = 1 - Math.exp(-dt * 10);
    const now = performance.now();
    for (const p of this.players.values()) {
      if (!p.pose) continue;
      locate(this.universe, p.pose, _want);
      // between the poses (~8 a second) they keep going the way they were going
      if (now - p.poseAt < 400) _want.addScaledVector(p.velWant, Math.min(0.25, (now - p.poseAt) / 1000));
      // teleports and frame changes jump; ordinary motion glides
      const jump = p.at.distanceTo(_want);
      if (!p.placed || jump > Math.max(50, 0.3 * _want.distanceTo(camPos))) { p.at.copy(_want); p.placed = true; }
      else p.at.lerp(_want, blend);
    }
  }

  update(dt: number, camPos: Vector3, pxPerRad: number, visible: boolean): void {
    const { w, h } = this.size();
    const now = performance.now();
    const blend = 1 - Math.exp(-dt * 10);
    const slow = 1 - Math.exp(-dt * 4);
    const proj = this.camera.projectionMatrix.elements;
    this.camera.getWorldQuaternion(_camInv).invert();
    for (const p of this.players.values()) {
      p.sr = 0;
      if (!p.pose || !p.placed || !visible || p.m.pid === this.hidden) { p.root.visible = false; p.tag.hidden = true; continue; }
      _rel.copy(p.at).sub(camPos);
      const d = _rel.length();
      p.d = d;
      const here = p.pose.s === this.universe.current.starId;

      p.root.visible = here && !!p.body;
      if (p.root.visible) {
        const k = Math.min(1, FAR_KM / Math.max(d, 1e-9));
        p.root.position.copy(_rel).multiplyScalar(k);
        const hKm = Math.max(TRUE_HEIGHT_KM, (d * k * MIN_PX) / pxPerRad);
        p.sr = (0.5 * hKm * pxPerRad) / Math.max(d * k, 1e-12);
        const model = p.root.userData.model as Model | undefined;
        p.root.scale.setScalar(hKm * (model?.scale ?? 1));
        this.fly(p, now, slow);
        _q.set(p.pose.q[0], p.pose.q[1], p.pose.q[2], p.pose.q[3]).normalize().multiply(FLIP);
        _q.multiply(_tilt.setFromAxisAngle(X, p.lean)).multiply(_tilt.setFromAxisAngle(Z, p.roll));
        p.root.quaternion.slerp(_q, Math.min(1, blend * 1.5));
        // hovering: a slow bob along their own up
        _v.set(0, Math.sin(now / 900 + p.phase) * 0.05 * hKm * (1 - p.thrust), 0).applyQuaternion(p.root.quaternion);
        p.root.position.add(_v);
        p.mixer?.update(dt);
      }

      // name tag: above the astronaut, or at the screen's edge pointing the way. By direction, not
      // position: a player light-years away is past the far plane, where projecting the point flips it
      _cs.copy(_dir.copy(_rel).divideScalar(Math.max(d, 1e-12))).applyQuaternion(_camInv);
      const behind = _cs.z > -1e-6;
      let x: number, y: number;
      if (behind) { x = _cs.x || 1e-6; y = _cs.y; }
      else { x = (_cs.x * proj[0]) / -_cs.z; y = (_cs.y * proj[5]) / -_cs.z; }
      if (behind) p.sr = 0;
      else { p.sx = ((x + 1) / 2) * w; p.sy = ((1 - y) / 2) * h; }
      const off = behind || Math.abs(x) > 0.96 || Math.abs(y) > 0.92;
      if (off) {
        const s = 1 / Math.max(Math.abs(x) / 0.94, Math.abs(y) / 0.88, 1e-6);
        x *= s; y *= s;
      }
      const lift = here && !off ? Math.max(MIN_PX, (TRUE_HEIGHT_KM * pxPerRad) / Math.max(d, 1e-9)) * 0.6 + 8 : 0;
      p.tag.hidden = false;
      p.tag.classList.toggle('off', off);
      p.tag.style.transform = `translate(${((x + 1) / 2) * w}px, ${((1 - y) / 2) * h - lift}px) translate(-50%, -100%)`;
      p.dist.textContent = d < 1e8 ? fmtDistance(d) : fmtScaleDistance(d);
      if (p.bubbleUntil && now > p.bubbleUntil) { p.bubble.hidden = true; p.bubbleUntil = 0; }
    }
  }

  /** thrust from their speed, a lean into the way they fly, flames to match */
  private fly(p: Player, now: number, slow: number): void {
    // poses stop coming (or come every 2 s) once they stop: the last velocity fades out
    if (now - p.poseAt > 450) p.velWant.set(0, 0, 0);
    p.vel.lerp(p.velWant, slow);
    const speed = p.vel.length();
    const want = speed > 1e-4 ? Math.min(1, Math.max(0, (Math.log10(speed) + 2.5) / 4)) : 0;
    p.thrust += (want - p.thrust) * slow;
    let lean = 0, roll = 0;
    if (speed > 1e-4 && p.pose) {
      _q.set(p.pose.q[0], p.pose.q[1], p.pose.q[2], p.pose.q[3]).normalize();
      _v.copy(p.vel).divideScalar(speed);
      const fwd = -_v.dot(_dir.set(0, 0, 1).applyQuaternion(_q));
      const side = _v.dot(_dir.set(1, 0, 0).applyQuaternion(_q));
      lean = p.thrust * (fwd >= 0 ? 1.15 * fwd : 0.45 * fwd);
      roll = p.thrust * 0.5 * side;
    }
    p.lean += (lean - p.lean) * slow;
    p.roll += (roll - p.roll) * slow;
    if (!p.pack) return;
    const t = now / 1000;
    for (let i = 0; i < p.pack.flames.length; i++) {
      const f = p.pack.flames[i];
      const flicker = 0.82 + 0.18 * Math.sin(t * 47 + i * 2.1 + p.phase) * Math.sin(t * 29 + i);
      const len = (0.12 + 0.55 * p.thrust) * flicker;
      f.scale.set(0.8 + 0.5 * p.thrust, len, 0.8 + 0.5 * p.thrust);
    }
  }

  private dress(p: Player, id: AvatarId): void {
    p.loading = id;
    void loadAvatar(id).then((model) => {
      if (p.loading !== id || !this.players.has(p.m.pid)) return;
      if (p.body) p.root.remove(p.body);
      p.mixer?.stopAllAction();
      const body = cloneSkinned(model.scene);
      body.position.copy(model.centre).negate();
      p.root.add(body);
      p.root.userData.model = model;
      p.body = body;
      p.pack = null;
      if (model.pack) {
        // placed in the model's rest pose, then carried by the bone through every animation
        const bone = body.getObjectByName(model.pack.bone);
        if (bone) {
          const pack = buildJetpack(PARTY_COLORS[p.m.color] ?? '#9ab');
          pack.root.position.copy(model.pack.at);
          pack.root.scale.setScalar(model.pack.h);
          body.add(pack.root);
          p.root.updateMatrixWorld(true);
          bone.attach(pack.root);
          p.pack = pack;
        }
      }
      p.mixer = new AnimationMixer(body);
      p.actions = new Map(model.clips.map((c) => [clipName(c), p.mixer!.clipAction(c)]));
      p.base = BASE_CLIPS.map((n) => p.actions.get(n)).find((a) => !!a) ?? null;
      p.base?.play();
    }).catch((err) => console.warn('avatar', id, err));
  }
}
