import {
  AmbientLight, AnimationMixer, DirectionalLight, Group, LoopOnce, PerspectiveCamera, Quaternion, Scene, Vector2, Vector3, WebGLRenderer,
  type AnimationClip, type Object3D,
} from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { CameraController } from '../camera/CameraController';
import type { CelestialBody } from '../core/CelestialBody';
import { PARSEC_KM } from '../core/constants';
import type { Engine } from '../core/Engine';
import type { TimeSystem } from '../core/TimeSystem';
import type { StarId, Universe } from '../core/Universe';
import { _ } from '../i18n';
import { fmtDistance, fmtScaleDistance } from '../ui/format';
import { Avatars, loadAvatar } from './avatars';
import { PartySocket, createRoom, ensureId, keyOf, listRooms, partyAvailable, roomInfo, shotUrl, store, uploadShot, type PartyStatus } from './net';
import {
  AVATARS, EMOTES, MAX_CHAT, MAX_ROOM_NAME, MAX_TITLE, MODES, PARTY_COLORS, PARTY_MAX,
  type AvatarId, type ChatLine, type Clock, type Emote, type Hide, type HideHint, type Hunt, type Member, type Mode, type Place, type Pose, type RoomInfo, type ServerMsg, type Shot, type Vote,
} from './protocol';
import { HUNT_LABELS, huntCheck } from './hunt';
import './party.css';

/** what the app calls every frame / on a click */
export interface PartyHooks {
  /** before the camera moves: everyone's position for this frame, and the camera of a follower */
  beforeCamera(dt: number): void;
  update(dt: number, camPos: Vector3, pxPerRad: number): void;
  /** a click on another player selects them (true: the click is taken) */
  pick(x: number, y: number, dbl: boolean): boolean;
}

/** what the party needs from the app (src/main.ts) */
export interface PartyApp {
  readonly universe: Universe;
  readonly time: TimeSystem;
  readonly camera: CameraController;
  readonly engine: Engine;
  readonly ui: { showToast(text: string, ms?: number): void };
  readonly selected: CelestialBody | null;
  readonly uiVisible: boolean;
  party: PartyHooks | null;
  readonly landedOn: CelestialBody | null;
  captureFrame(maxW?: number): Promise<Blob | null>;
  teleportTo(starId: StarId, bodyId: string | null, pos: Vector3, pc: Vector3, quat: Quaternion): void;
  goToStar(id: StarId): void;
  landedSite(): { body: string; lat: number; lon: number } | null;
  landAt(bodyId: string, lat: number, lon: number): void;
  landmarkHere(): { kind: string; name: string } | null;
}

const NICK_KEY = 'yeis.party.nick';
const AVATAR_KEY = 'yeis.party.avatar';
const SITEKEY = (import.meta.env.VITE_TURNSTILE_SITEKEY as string | undefined) ?? '';
const POSE_EVERY_MS = 125;
const POSE_IDLE_MS = 2000;
const CLOCK_EVERY_MS = 4000;
/** following someone farther than this starts with a jump to just behind them */
const FOLLOW_NEAR_KM = 20_000;
const OBLIQUITY = 23.4392911 * (Math.PI / 180);

const AVATAR_NAMES: Record<AvatarId, string> = {
  frog: 'Finn', bee: 'Barbara', flamingo: 'Fernando', spacesuit: 'Nova',
  'mech-panda': 'Rae', 'mech-frog': 'Mech Finn', 'mech-bee': 'Mech Barbara', 'mech-flamingo': 'Mech Fernando',
};
const EMOTE_LABELS: Record<Emote, string> = { wave: 'El salla', yes: 'Evet', no: 'Hayır', jump: 'Zıpla' };
const MODE_LABELS: Record<Mode, string> = { free: 'Serbest', hunt: 'Hazine avı', hide: 'Saklambaç' };
const MODE_HINTS: Record<Mode, string> = {
  free: 'Herkes istediği yere uçar',
  hunt: 'Tur tur hedefler: ilk bulan puanı alır',
  hide: 'Biri saklanır, diğerleri sıcak/soğuk ipuçlarıyla arar',
};

const esc = (s: string): string => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const el = <T extends HTMLElement = HTMLElement>(root: ParentNode, sel: string): T => root.querySelector(sel) as T;

let session: Session | null = null;
let lobby: Lobby | null = null;

/** The top bar's button / a shared link: the lobby, or straight into room `code` */
export function openParty(app: PartyApp, code: string): void {
  if (!partyAvailable) { app.ui.showToast(_('Çok oyunculu sunucusu bu kurulumda yapılandırılmamış'), 4000); return; }
  const c = code.trim().toUpperCase();
  if (session && (!c || c === session.code)) { session.hud.show(); return; }
  session?.leave();
  lobby ??= new Lobby(app);
  lobby.open(c);
}

/* ---------------- Turnstile ---------------- */

interface TurnstileApi { render(el: Element, o: Record<string, unknown>): string; remove(id: string): void }
let turnstile: Promise<TurnstileApi> | null = null;

function loadTurnstile(): Promise<TurnstileApi> {
  turnstile ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    s.async = true;
    s.onload = () => resolve((window as unknown as { turnstile: TurnstileApi }).turnstile);
    s.onerror = () => { turnstile = null; reject(new Error('blocked')); };
    document.head.appendChild(s);
  });
  return turnstile;
}

/** A signed player id, solving a challenge in `box` first when the relay asks for one */
async function identity(box: HTMLElement): Promise<boolean> {
  const first = await ensureId();
  if (first === 'ok') return true;
  if (first === 'error' || !SITEKEY) return false;
  const ts = await loadTurnstile().catch(() => null);
  if (!ts) return false;
  const token = await new Promise<string>((resolve) => {
    box.innerHTML = '';
    const id = ts.render(box, { sitekey: SITEKEY, theme: 'dark', action: 'party', callback: (t: string) => { ts.remove(id); box.innerHTML = ''; resolve(t); } });
  });
  return (await ensureId(token)) === 'ok';
}

/* ---------------- avatar thumbnails (rendered once, off-screen) ---------------- */

let thumbs: Promise<Partial<Record<AvatarId, string>>> | null = null;

function avatarThumbs(): Promise<Partial<Record<AvatarId, string>>> {
  thumbs ??= (async () => {
    const out: Partial<Record<AvatarId, string>> = {};
    const r = new WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
    r.setSize(152, 172, false);
    const scene = new Scene();
    scene.add(new AmbientLight(0xffffff, 1.4));
    const key = new DirectionalLight(0xffffff, 2.2);
    key.position.set(1, 2, 3);
    scene.add(key);
    const cam = new PerspectiveCamera(30, 152 / 172, 0.1, 10);
    cam.position.set(0.7, 0.2, 2.15);
    cam.lookAt(0, 0, 0);
    try {
      for (const id of AVATARS) {
        const model = await loadAvatar(id).catch(() => null);
        if (!model) continue;
        const body = cloneSkinned(model.scene);
        body.scale.setScalar(model.scale);
        body.position.copy(model.centre).multiplyScalar(-model.scale);
        const mixer = new AnimationMixer(body);
        const idle = model.clips.find((c) => c.name.endsWith('|Idle')) ?? model.clips[0];
        if (idle) { mixer.clipAction(idle).play(); mixer.update(0.4); }
        scene.add(body);
        r.render(scene, cam);
        out[id] = r.domElement.toDataURL('image/png');
        scene.remove(body);
      }
    } finally {
      r.dispose();
      r.forceContextLoss();
    }
    return out;
  })();
  return thumbs;
}

/* ---------------- the chosen character, live ---------------- */

const clipNamed = (clips: AnimationClip[], names: string[]): AnimationClip | undefined => clips.find((c) => names.includes(c.name.replace(/^.*\|/, '')));

/** The lobby's preview: the chosen astronaut turning slowly (a drag turns it), waving hello when picked */
class AvatarPreview {
  readonly root: HTMLElement;
  private canvas: HTMLCanvasElement;
  private readonly name: HTMLElement;
  private renderer: WebGLRenderer | null = null;
  private readonly scene = new Scene();
  private readonly cam = new PerspectiveCamera(28, 1, 0.1, 10);
  private readonly turn = new Group();
  private body: Object3D | null = null;
  private mixer: AnimationMixer | null = null;
  private id: AvatarId | null = null;
  private raf = 0;
  private last = 0;
  private yaw = 0.45;
  private dragX: number | null = null;
  private dragEnd = 0;

  constructor() {
    const r = document.createElement('div');
    r.className = 'party-preview';
    r.innerHTML = '<canvas></canvas><span class="ppv-name"></span>';
    this.root = r;
    this.canvas = el<HTMLCanvasElement>(r, 'canvas');
    this.name = el(r, '.ppv-name');
    this.scene.add(new AmbientLight(0xffffff, 1.4));
    const key = new DirectionalLight(0xffffff, 2.2);
    key.position.set(1, 2, 3);
    this.scene.add(key, this.turn);
    this.cam.position.set(0, 0.04, 2.45);
    this.cam.lookAt(0, 0, 0);
    r.addEventListener('pointerdown', (e) => { this.dragX = e.clientX; r.setPointerCapture(e.pointerId); });
    r.addEventListener('pointermove', (e) => {
      if (this.dragX === null) return;
      this.yaw += (e.clientX - this.dragX) * 0.012;
      this.dragX = e.clientX;
    });
    const up = (): void => { this.dragX = null; this.dragEnd = performance.now(); };
    r.addEventListener('pointerup', up);
    r.addEventListener('pointercancel', up);
  }

  show(id: AvatarId, name: string): void {
    this.id = id;
    this.name.textContent = name;
    void loadAvatar(id).then((model) => {
      if (this.id !== id) return;
      this.mixer?.stopAllAction();
      if (this.body) this.turn.remove(this.body);
      const body = cloneSkinned(model.scene);
      body.scale.setScalar(model.scale);
      body.position.copy(model.centre).multiplyScalar(-model.scale);
      this.turn.add(body);
      this.body = body;
      const mixer = new AnimationMixer(body);
      this.mixer = mixer;
      const idle = clipNamed(model.clips, ['Idle', 'Idle_Neutral', 'Jump_Idle']) ?? model.clips[0];
      const base = idle ? mixer.clipAction(idle).play() : null;
      const hi = clipNamed(model.clips, ['Wave', 'Hello']);
      if (!hi || !base) return;
      const wave = mixer.clipAction(hi).setLoop(LoopOnce, 1);
      wave.reset().fadeIn(0.2).play();
      base.fadeOut(0.2);
      mixer.addEventListener('finished', (e) => {
        if (e.action !== wave) return;
        wave.fadeOut(0.3);
        base.reset().fadeIn(0.3).play();
      });
    }).catch((err) => console.warn('avatar preview', id, err));
  }

  start(): void {
    if (!this.renderer) {
      // a lost context cannot be had again from the same canvas: a fresh one each time
      const c = document.createElement('canvas');
      this.canvas.replaceWith(c);
      this.canvas = c;
      this.renderer = new WebGLRenderer({ canvas: c, alpha: true, antialias: true });
      this.renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
    }
    cancelAnimationFrame(this.raf);
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  stop(): void {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.renderer?.dispose();
    this.renderer?.forceContextLoss();
    this.renderer = null;
  }

  private readonly frame = (t: number): void => {
    this.raf = requestAnimationFrame(this.frame);
    const r = this.renderer;
    if (!r) return;
    const dt = Math.min(0.1, Math.max(0, (t - this.last) / 1000));
    this.last = t;
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    if (!w || !h) return;
    const size = r.getSize(_size);
    if (size.x !== w || size.y !== h) {
      r.setSize(w, h, false);
      this.cam.aspect = w / h;
      this.cam.updateProjectionMatrix();
    }
    if (this.dragX === null && t - this.dragEnd > 1200) this.yaw += dt * 0.45;
    this.turn.rotation.y = this.yaw;
    this.mixer?.update(dt);
    r.render(this.scene, this.cam);
  };
}

const _size = new Vector2();

/* ---------------- lobby ---------------- */

class Lobby {
  private readonly root: HTMLElement;
  private timer = 0;
  private avatar: AvatarId = (AVATARS as readonly string[]).includes(store.get(AVATAR_KEY)) ? (store.get(AVATAR_KEY) as AvatarId) : 'frog';
  private busy = false;
  private readonly preview = new AvatarPreview();

  constructor(private readonly app: PartyApp) {
    const r = document.createElement('div');
    r.className = 'modal party-modal';
    r.hidden = true;
    r.innerHTML = `
      <div class="modal-card party-card" role="dialog" aria-modal="true">
        <div class="panel-title"><span>${esc(_('Çok oyunculu'))}</span><button class="icon-btn small" data-close aria-label="Close">×</button></div>
        <div class="party-profile">
          <div class="party-me">
            <label class="party-field">${esc(_('Adın'))}<input type="text" data-nick maxlength="20" autocomplete="nickname" spellcheck="false" /></label>
            <div data-preview></div>
          </div>
          <div class="party-field">${esc(_('Astronotun'))}<div class="party-skins">${AVATARS.map((id) => `
            <button class="party-skin" data-skin="${id}"><span class="ps-ph"></span>${esc(AVATAR_NAMES[id])}</button>`).join('')}
          </div></div>
        </div>
        <div class="party-ts"></div>
        <div class="party-body"></div>
        <div class="party-msg" aria-live="polite"></div>
      </div>`;
    document.getElementById('ui')?.appendChild(r);
    this.root = r;
    const nick = el<HTMLInputElement>(r, '[data-nick]');
    nick.value = store.get(NICK_KEY);
    nick.addEventListener('change', () => store.set(NICK_KEY, nick.value.trim()));
    el(r, '[data-preview]').replaceWith(this.preview.root);
    r.querySelectorAll<HTMLButtonElement>('[data-skin]').forEach((b) => b.addEventListener('click', () => {
      this.avatar = b.dataset.skin as AvatarId;
      store.set(AVATAR_KEY, this.avatar);
      this.markSkin();
    }));
    this.markSkin();
    el(r, '[data-close]').addEventListener('click', () => this.close());
    r.addEventListener('pointerdown', (e) => { if (e.target === r) this.close(); });
    r.addEventListener('keydown', (e) => { if (e.key === 'Escape') this.close(); e.stopPropagation(); });
  }

  open(code: string): void {
    this.root.hidden = false;
    this.preview.start();
    this.say('');
    void avatarThumbs().then((t) => {
      this.root.querySelectorAll<HTMLButtonElement>('[data-skin]').forEach((b) => {
        const src = t[b.dataset.skin as AvatarId];
        const ph = b.querySelector('.ps-ph');
        if (src && ph) { const img = new Image(); img.src = src; img.alt = ''; ph.replaceWith(img); }
      });
    });
    if (code) void this.join(code);
    else this.showRooms();
  }

  close(): void {
    this.root.hidden = true;
    this.preview.stop();
    clearInterval(this.timer);
  }

  private markSkin(): void {
    this.root.querySelectorAll<HTMLButtonElement>('[data-skin]').forEach((b) => b.classList.toggle('active', b.dataset.skin === this.avatar));
    this.preview.show(this.avatar, AVATAR_NAMES[this.avatar]);
  }

  private say(text: string, ok = false): void {
    const m = el(this.root, '.party-msg');
    m.textContent = text;
    m.classList.toggle('ok', ok);
  }

  private nick(): string {
    const v = el<HTMLInputElement>(this.root, '[data-nick]').value.trim();
    store.set(NICK_KEY, v);
    return v;
  }

  private showRooms(): void {
    const body = el(this.root, '.party-body');
    body.innerHTML = `
      <div class="party-cols">
        <section class="party-col">
          <div class="caption"><span>${esc(_('Açık odalar'))}</span><button class="small-btn" data-refresh>${esc(_('Yenile'))}</button></div>
          <ul class="party-rooms"><li><span class="pr-empty">${esc(_('Yükleniyor…'))}</span></li></ul>
          <div class="caption">${esc(_('Kodla katıl'))}</div>
          <form class="party-row" data-code-form><input type="text" data-code maxlength="6" placeholder="ABC234" spellcheck="false" autocomplete="off" /><button class="primary" type="submit">${esc(_('Katıl'))}</button></form>
        </section>
        <section class="party-col">
          <div class="caption">${esc(_('Oda kur'))}</div>
          <form class="party-col" data-create>
            <label class="party-field">${esc(_('Oda adı'))}<input type="text" data-name maxlength="${MAX_ROOM_NAME}" spellcheck="false" /></label>
            <label class="party-field">${esc(_('Şifre (isteğe bağlı)'))}<input type="password" data-pass maxlength="64" autocomplete="new-password" /></label>
            <div class="party-field">${esc(_('Oyun'))}<div class="party-modes">${MODES.map((m, i) => `
              <label class="party-mode"><input type="radio" name="party-mode" value="${m}"${i === 0 ? ' checked' : ''} /><b>${esc(_(MODE_LABELS[m]))}</b><small>${esc(_(MODE_HINTS[m]))}</small></label>`).join('')}
            </div></div>
            <label class="party-field">${esc(_('Kişi sınırı'))}<select data-max>${Array.from({ length: PARTY_MAX - 1 }, (_v, i) => i + 2).map((n) => `<option value="${n}"${n === PARTY_MAX ? ' selected' : ''}>${n}</option>`).join('')}</select></label>
            <label class="party-check"><input type="checkbox" data-listed checked /> ${esc(_('Oda listesinde görünsün'))}</label>
            <button class="primary" type="submit">${esc(_('Oda kur'))}</button>
          </form>
        </section>
      </div>`;
    el(body, '[data-refresh]').addEventListener('click', () => void this.refresh());
    el(body, '[data-code-form]').addEventListener('submit', (e) => {
      e.preventDefault();
      const code = el<HTMLInputElement>(body, '[data-code]').value.trim().toUpperCase();
      if (/^[A-Z2-9]{6}$/.test(code)) void this.join(code);
      else this.say(_('Oda kodu 6 karakterdir'));
    });
    el(body, '[data-create]').addEventListener('submit', (e) => { e.preventDefault(); void this.create(); });
    const name = el<HTMLInputElement>(body, '[data-name]');
    name.placeholder = _('{nick} ve arkadaşları', { nick: this.nick() || _('Kaşifler') });
    void this.refresh();
    clearInterval(this.timer);
    this.timer = window.setInterval(() => { if (!this.root.hidden) void this.refresh(); }, 8000);
  }

  private async refresh(): Promise<void> {
    const list = this.root.querySelector('.party-rooms');
    if (!list) return;
    const rooms = await listRooms();
    if (!rooms) { list.innerHTML = `<li><span class="pr-empty">${esc(_('Sunucuya ulaşılamadı'))}</span></li>`; return; }
    list.innerHTML = rooms.length ? rooms.map((r) => `
      <li><span class="pr-name">${esc(r.name)}${r.locked ? ` <small class="pr-meta">${esc(_('şifreli'))}</small>` : ''}</span><span class="pr-mode pr-${esc(r.mode ?? 'free')}">${esc(_(MODE_LABELS[r.mode ?? 'free'] ?? MODE_LABELS.free))}</span><span class="pr-meta">${r.count}/${r.max}</span>
      <button class="small-btn" data-join="${esc(r.code)}"${r.count >= r.max ? ' disabled' : ''}>${esc(r.count >= r.max ? _('Dolu') : _('Katıl'))}</button></li>`).join('')
      : `<li><span class="pr-empty">${esc(_('Şu an açık oda yok. İlkini sen kur!'))}</span></li>`;
    list.querySelectorAll<HTMLButtonElement>('[data-join]').forEach((b) => b.addEventListener('click', () => void this.join(b.dataset.join!)));
  }

  private async create(): Promise<void> {
    if (this.busy) return;
    const body = el(this.root, '.party-body');
    const name = el<HTMLInputElement>(body, '[data-name]');
    const pass = el<HTMLInputElement>(body, '[data-pass]').value;
    this.busy = true;
    this.say(_('Oda kuruluyor…'), true);
    try {
      if (!(await identity(el(this.root, '.party-ts')))) { this.say(_('Doğrulama tamamlanamadı')); return; }
      const res = await createRoom({
        name: name.value.trim() || name.placeholder,
        pass, max: Number(el<HTMLSelectElement>(body, '[data-max]').value), listed: el<HTMLInputElement>(body, '[data-listed]').checked,
        mode: (body.querySelector<HTMLInputElement>('input[name="party-mode"]:checked')?.value as Mode | undefined) ?? 'free',
      });
      if ('error' in res) {
        this.say(res.error === 'busy' ? _('Şu an yeni oda kurulamıyor, biraz sonra deneyin') : res.error === 'name' ? _('Bir oda adı yazın') : _('Oda kurulamadı'));
        return;
      }
      this.start(res.code, pass);
    } finally {
      this.busy = false;
    }
  }

  /** a room from the list, a typed code or a link: ask for its password if it has one */
  async join(code: string, pass?: string, wrong = false): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.root.hidden = false;
    this.say(_('Bağlanılıyor…'), true);
    try {
      if (!(await identity(el(this.root, '.party-ts')))) { this.say(_('Doğrulama tamamlanamadı')); this.showRooms(); return; }
      const info = await roomInfo(code);
      if (info === 'error') { this.say(_('Sunucuya ulaşılamadı')); this.showRooms(); return; }
      if (!info) { this.say(_('{code} kodlu oda bulunamadı (kapanmış olabilir)', { code })); this.showRooms(); return; }
      if (info.count >= info.max) { this.say(_('Oda dolu')); this.showRooms(); return; }
      if (info.locked && pass === undefined && !keyOf(code)) { this.askPassword(info, wrong); return; }
      this.start(code, pass ?? '');
    } finally {
      this.busy = false;
    }
  }

  askPassword(info: RoomInfo, wrong: boolean): void {
    this.root.hidden = false;
    const body = el(this.root, '.party-body');
    body.innerHTML = `
      <form class="party-lock">
        <div>${esc(_('“{name}” şifreli bir oda.', { name: info.name }))}</div>
        <input type="password" data-pass maxlength="64" autocomplete="off" placeholder="${esc(_('Şifre'))}" />
        <div class="party-row"><button type="button" data-back>${esc(_('Geri'))}</button><button class="primary" type="submit">${esc(_('Katıl'))}</button></div>
      </form>`;
    this.say(wrong ? _('Şifre yanlış') : '');
    const input = el<HTMLInputElement>(body, '[data-pass]');
    input.focus();
    el(body, '[data-back]').addEventListener('click', () => { this.say(''); this.showRooms(); });
    el(body, 'form').addEventListener('submit', (e) => { e.preventDefault(); void this.join(info.code, input.value); });
  }

  private start(code: string, pass: string): void {
    this.close();
    session = new Session(this.app, code, this.nick(), this.avatar, pass, (why) => this.ended(code, why));
  }

  /** the room ended for us: back to the lobby with the reason, or just a toast */
  private ended(code: string, why: PartyStatus | 'left'): void {
    session = null;
    if (why === 'left') return;
    if (why === 'password') { void roomInfo(code).then((info) => { if (info && info !== 'error') this.askPassword(info, true); }); return; }
    const text: Partial<Record<PartyStatus, string>> = {
      gone: _('Oda kapanmış'), kicked: _('Oda sahibi seni odadan çıkardı'), full: _('Oda dolu'),
      replaced: _('Bu oda başka bir sekmede açıldı'), challenge: _('Oturumun yenilenmeli, tekrar katılın'),
    };
    this.app.ui.showToast(text[why] ?? _('Bağlantı kesildi'), 4000);
    if (why === 'gone' || why === 'full' || why === 'challenge') this.open('');
  }
}

/* ---------------- a room ---------------- */

const _pos = new Vector3(), _pc = new Vector3(), _q = new Quaternion(), _back = new Vector3(), _hp = new Vector3();
const r4 = (x: number): number => Math.round(x * 1e4) / 1e4;

/** a scene-frame direction (from the Sun) as right ascension (h) / declination (deg) */
function raDec(v: number[]): { ra: number; dec: number } {
  // scene → ecliptic (x, -z, y) → equatorial (about x by +ε)
  const x = v[0], y = -v[2], z = v[1];
  const ye = y * Math.cos(OBLIQUITY) - z * Math.sin(OBLIQUITY);
  const ze = y * Math.sin(OBLIQUITY) + z * Math.cos(OBLIQUITY);
  const n = Math.hypot(x, ye, ze) || 1;
  return { ra: ((Math.atan2(ye, x) * 12) / Math.PI + 24) % 24, dec: (Math.asin(ze / n) * 180) / Math.PI };
}

const fmtSeconds = (ms: number): string => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return s >= 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : `${s} s`;
};

class Session {
  readonly sock: PartySocket;
  readonly hud: Hud;
  private readonly avatars: Avatars;
  me = '';
  room: RoomInfo | null = null;
  readonly members = new Map<string, Member>();
  chat: ChatLine[] = [];
  shots: Shot[] = [];
  vote: Vote | null = null;
  private clock: Clock | null = null;
  /** server clock − ours (ms) */
  private skew = 0;
  private poseAt = 0;
  private poseKey = '';
  private clockAt = 0;
  private clockRate = NaN;
  private clockCheckAt = 0;
  private clockNagged = false;
  private status: PartyStatus = 'connecting';

  private joinedAt = 0;
  /** the player clicked on, and the one the camera rides with (their position + an offset the visitor can fly around) */
  picked: string | null = null;
  following: string | null = null;
  private readonly followOff = new Vector3();
  private followReady = false;
  private followFrame = '';

  /* the games */
  hunt: Hunt | null = null;
  private huntSent = 0;
  private huntCheckAt = 0;
  hide: Hide | null = null;
  /** hide and seek: this seeker's distance to the hider (km), and the one before */
  heat: number | null = null;
  prevHeat: number | null = null;

  constructor(readonly app: PartyApp, readonly code: string, nick: string, private avatar: AvatarId, pass: string, private readonly onEnd: (why: PartyStatus | 'left') => void) {
    this.hud = new Hud(this);
    const eng = app.engine;
    this.avatars = new Avatars(eng.scene, app.universe, eng.camera, () => ({ w: eng.width, h: eng.height }));
    this.avatars.onTagClick = (pid, dbl) => { this.select(pid); if (dbl) this.teleportToPlayer(pid); };
    this.sock = new PartySocket(code, () => ({ t: 'hello', nick, avatar: this.avatar, pass: pass || undefined, key: keyOf(code) }));
    this.sock.onMessage = (m) => this.receive(m);
    this.sock.onStatus = (s) => this.onStatus(s);
    app.party = this;
    const url = new URL(location.href);
    url.searchParams.set('party', code);
    history.replaceState(history.state, '', url);
  }

  get isOwner(): boolean { return this.members.get(this.me)?.owner === true; }
  get link(): string { return `${location.origin}/?party=${this.code}`; }
  get connected(): boolean { return this.status === 'open'; }
  get mode(): Mode { return this.room?.mode ?? 'free'; }
  /** the server's clock now (ms) */
  get serverNow(): number { return Date.now() + this.skew; }

  leave(): void { this.end('left'); }

  private end(why: PartyStatus | 'left'): void {
    if (this.app.party !== this) return;
    this.sock.close();
    this.avatars.dispose();
    this.hud.dispose();
    this.app.party = null;
    const url = new URL(location.href);
    url.searchParams.delete('party');
    history.replaceState(history.state, '', url);
    this.onEnd(why);
  }

  private onStatus(s: PartyStatus): void {
    this.status = s;
    if (s === 'open' || s === 'connecting' || s === 'closed') { this.hud.renderHead(); return; }
    // a lost id can be fixed without leaving: get a fresh one and reconnect
    this.end(s);
  }

  /* ---- per frame ---- */

  beforeCamera(dt: number): void {
    const cam = this.app.camera, u = this.app.universe;
    this.avatars.step(dt, cam.position);
    const pid = this.following;
    if (!pid) return;
    const pose = this.avatars.poseOf(pid);
    if (!pose || !this.members.has(pid)) { this.follow(null); return; }
    // a flight, an orbit or a landing of one's own ends it; turning to look does not
    const ap = cam.autopilot;
    if ((ap && ap.kind !== 'center' && ap.kind !== 'centerDir') || cam.mode !== 'free' || cam.surface) { this.follow(null); return; }
    if (pose.s !== u.current.starId) {
      // they crossed into another system: so does the camera, the same offset away
      this.app.teleportTo(pose.s, pose.b, _pos.set(pose.o[0], pose.o[1], pose.o[2]).add(this.followOff),
        _pc.set(pose.g[0], pose.g[1], pose.g[2]).addScaledVector(this.followOff, 1 / PARSEC_KM), _q.copy(cam.quaternion));
      cam.setReference(null);
      this.followReady = false;
      if (u.current.starId !== pose.s) { this.follow(null); this.app.ui.showToast(_('Bu sistem burada açılamıyor, takip bırakıldı')); }
      return;
    }
    const at = this.avatars.positionOf(pid);
    if (!at) return;
    if (!this.followReady) { this.followOff.copy(cam.position).sub(at); this.followReady = true; cam.setReference(null); }
    cam.position.copy(at).add(this.followOff);
    this.followFrame = u.current.starId;
  }

  pick(x: number, y: number, dbl: boolean): boolean {
    const pid = this.avatars.pick(x, y, 6);
    if (!pid) return false;
    this.select(pid);
    if (dbl) this.teleportToPlayer(pid);
    return true;
  }

  update(dt: number, camPos: Vector3, pxPerRad: number): void {
    this.avatars.update(dt, camPos, pxPerRad, this.app.uiVisible);
    // the visitor's own flying around the followed player moves the offset
    if (this.following && this.followReady) {
      const at = this.avatars.positionOf(this.following);
      if (at && this.app.universe.current.starId === this.followFrame) this.followOff.copy(this.app.camera.position).sub(at);
      else this.followReady = false;
    }
    const now = performance.now();
    if (this.sock.open && this.me) {
      this.sendPose(now);
      this.syncClock(now);
      this.huntTick(now);
    }
    this.hud.tick();
  }

  /** where the camera is, relative to the body it moves with (so a player in orbit stays in orbit for everyone) */
  here(): Pose {
    const u = this.app.universe, cam = this.app.camera;
    const site = this.app.landedSite();
    const stand = site ? u.get(site.body) ?? null : null;
    const ref = stand ?? (cam.reference && u.get(cam.reference.id) === cam.reference ? cam.reference : null);
    _pos.copy(cam.position);
    if (ref) _pos.sub(ref.position);
    u.toParsecs(cam.position, _pc);
    const q = cam.quaternion;
    const pose: Pose = { s: u.current.starId, b: ref?.id ?? null, o: [r4(_pos.x), r4(_pos.y), r4(_pos.z)], g: [_pc.x, _pc.y, _pc.z], q: [r4(q.x), r4(q.y), r4(q.z), r4(q.w)] };
    // standing on the ground: where, so a visitor lands there too instead of hovering above it
    if (site && stand) pose.l = [r4(site.lat), r4(site.lon)];
    return pose;
  }

  /* ---- the games ---- */

  /** treasure hunt: is the camera at the round's target? (twice a second; the server takes the first report) */
  private huntTick(now: number): void {
    const h = this.hunt;
    if (!h?.target || this.serverNow >= h.ends || this.huntSent === h.round || h.found.some((f) => f.pid === this.me) || now - this.huntCheckAt < 500) return;
    this.huntCheckAt = now;
    const u = this.app.universe, cam = this.app.camera;
    const name = huntCheck(h.target, { universe: u, cam: cam.position, pc: u.toParsecs(cam.position, _hp), landed: this.app.landedOn, landmark: this.app.landmarkHere() });
    if (!name) return;
    this.huntSent = h.round;
    this.sock.send({ t: 'found', round: h.round, place: { ...this.here(), name } });
  }

  nextRound(): void { this.sock.send({ t: 'round' }); }

  /** what a hide-and-seek hint says */
  hintText(x: HideHint): string {
    const u = this.app.universe;
    if (x.kind === 'ly' && x.v) return _('Güneş’e uzaklığı yaklaşık {d} ışık yılı', { d: x.v[0].toLocaleString() });
    if (x.kind === 'dir' && x.v) {
      const { ra, dec } = raDec(x.v);
      return _('Güneş’ten bakınca yönü: sağ açıklık {ra} sa, dik açıklık {dec}°', { ra: ra.toFixed(1), dec: Math.round(dec) });
    }
    if (x.kind === 'spectral' && x.s) {
      let sp = '';
      try { sp = u.starInfo(x.s).spectral; } catch { /* not a star */ }
      return sp ? _('Saklandığı yıldızın tayf sınıfı: {sp}', { sp }) : _('Saklandığı yer bir yıldız sistemi değil');
    }
    if (x.kind === 'star' && x.s) {
      let name = '';
      try { name = u.starName(x.s); } catch { /* not a star */ }
      return _('Saklandığı sistem: {name}', { name: name || x.s });
    }
    return '';
  }

  /** the hint's star system, to fly to */
  hintStar(): string | null {
    return this.hide?.hints.find((x) => x.kind === 'star')?.s ?? null;
  }

  /** a name for where the camera is: the selection, the body it moves with, the nearest, the system */
  hereName(): string {
    const u = this.app.universe, cam = this.app.camera;
    return this.app.selected?.name ?? cam.reference?.name ?? cam.nearest?.name ?? u.starName(u.current.starId);
  }

  private sendPose(now: number): void {
    if (now - this.poseAt < POSE_EVERY_MS) return;
    const p = this.here();
    const key = JSON.stringify(p);
    if (key === this.poseKey && now - this.poseAt < POSE_IDLE_MS) return;
    this.poseAt = now;
    this.poseKey = key;
    this.sock.send({ t: 'pose', ...p });
  }

  /** the owner's clock is the room's: sent every few seconds and on every change; the others follow it */
  private syncClock(now: number): void {
    const t = this.app.time;
    if (this.isOwner) {
      const r = t.effectiveRate;
      const predicted = this.clock ? this.clockJd(this.clock) : NaN;
      const drifted = !(Math.abs(t.jd - predicted) * 86400 < Math.max(30, Math.abs(r) * 1.5));
      if (r !== this.clockRate || drifted || now - this.clockAt > CLOCK_EVERY_MS) {
        this.clockAt = now;
        this.clockRate = r;
        this.clock = { jd: t.jd, r, at: Date.now() + this.skew };
        this.sock.send({ t: 'clock', jd: t.jd, r });
      }
      return;
    }
    if (!this.clock || now - this.clockCheckAt < 1000) return;
    this.clockCheckAt = now;
    this.applyClock(this.clock);
  }

  private clockJd(c: Clock): number {
    return c.jd + (((Date.now() + this.skew) - c.at) / 1000) * c.r / 86400;
  }

  private applyClock(c: Clock): void {
    const t = this.app.time;
    const jd = this.clockJd(c);
    let changed = false;
    if (Math.abs(t.jd - jd) * 86400 > Math.max(2, Math.abs(c.r) * 0.25)) { t.jd = jd; changed = true; }
    if (c.r === 0) { if (!t.paused) { t.paused = true; changed = true; } }
    else if (t.effectiveRate !== c.r) { t.setRate(Math.abs(c.r), c.r < 0 ? -1 : 1); changed = true; }
    // the first sync on arrival is expected; a correction later means this visitor touched the clock
    if (changed && !this.clockNagged && performance.now() - this.joinedAt > 5000) {
      this.clockNagged = true;
      this.app.ui.showToast(_('Bu odada zamanı oda sahibi yönetiyor'), 3000);
    }
  }

  /* ---- messages ---- */

  private receive(m: ServerMsg): void {
    switch (m.t) {
      case 'welcome': {
        this.me = m.you;
        this.skew = m.now - Date.now();
        this.room = m.room;
        this.members.clear();
        for (const mem of m.members) this.members.set(mem.pid, mem);
        for (const mem of m.members) if (mem.pid !== this.me) this.avatars.set(mem);
        for (const [pid, pose] of m.poses) this.avatars.setPose(pid, pose);
        this.hunt = m.hunt;
        this.huntSent = 0;
        this.setHide(m.hide, false);
        this.chat = m.chat;
        this.shots = m.shots;
        this.vote = m.vote;
        this.clock = m.clock;
        this.clockNagged = false;
        this.joinedAt = performance.now();
        // the room's clock wins whenever someone is already in it; an owner alone starts it from their own
        if (m.clock && (!this.isOwner || this.members.size > 1)) this.applyClock(m.clock);
        if (this.isOwner) this.clockRate = NaN;
        this.poseKey = '';
        this.hud.renderAll();
        break;
      }
      case 'join':
        if (!this.members.has(m.m.pid) && m.m.pid !== this.me) this.system(_('{nick} katıldı', { nick: m.m.nick }));
        this.members.set(m.m.pid, m.m);
        if (m.m.pid !== this.me) this.avatars.set(m.m);
        this.hud.renderPlayers();
        break;
      case 'leave': {
        const who = this.members.get(m.pid);
        this.members.delete(m.pid);
        if (this.following === m.pid) this.follow(null);
        if (this.picked === m.pid) this.select(null);
        this.avatars.remove(m.pid);
        if (who) this.system(_('{nick} ayrıldı', { nick: who.nick }));
        this.hud.renderPlayers();
        break;
      }
      case 'member': {
        const before = this.members.get(m.m.pid);
        this.members.set(m.m.pid, m.m);
        if (m.m.pid !== this.me) this.avatars.set(m.m);
        if (m.m.owner && !before?.owner) {
          this.system(m.m.pid === this.me ? _('Artık oda sahibi sensin') : _('{nick} artık oda sahibi', { nick: m.m.nick }));
          if (m.m.pid === this.me) this.clockRate = NaN;
        }
        if (m.m.pid === this.me && before && m.m.muted !== before.muted) this.system(m.m.muted ? _('Oda sahibi seni susturdu') : _('Artık yazabilirsin'));
        this.hud.renderPlayers();
        break;
      }
      case 'poses':
        for (const [pid, pose] of m.list) this.avatars.setPose(pid, pose);
        break;
      case 'hunt': {
        const old = this.hunt;
        this.hunt = m.hunt;
        const h = m.hunt;
        if (h.target && h.round !== old?.round) {
          this.system(_('Hazine avı, tur {n}: {target}', { n: h.round, target: _(HUNT_LABELS[h.target]) }));
          this.app.ui.showToast(_('Yeni hedef: {target}', { target: _(HUNT_LABELS[h.target]) }), 4000);
        } else {
          for (const f of h.found.slice(old?.found.length ?? 0)) {
            this.system(_('{nick} buldu: {name} (+{pts})', { nick: f.nick, name: f.name, pts: f.pts }));
            if (f.pid === this.me) this.app.ui.showToast(_('Buldun! +{pts} puan', { pts: f.pts }), 3000);
          }
        }
        this.hud.renderGame();
        break;
      }
      case 'hide':
        this.setHide(m.hide, true);
        break;
      case 'heat':
        this.prevHeat = this.heat;
        this.heat = m.km;
        break;
      case 'chat':
        this.chat = [...this.chat.slice(-80), m.line];
        if (m.line.pid !== this.me) this.avatars.say(m.line.pid, m.line.text);
        this.hud.addChat(m.line);
        break;
      case 'shot':
        this.shots = [...this.shots, m.shot];
        this.hud.renderShots();
        if (m.shot.pid !== this.me) this.system(_('{nick} bir keşif paylaştı: {title}', { nick: m.shot.nick, title: m.shot.title }));
        break;
      case 'vote':
        this.vote = m.vote;
        this.hud.renderVote();
        break;
      case 'voted':
        if (this.vote?.id === m.id) this.vote = null;
        this.hud.renderVote();
        if (m.passed) {
          this.system(_('Oylama kabul edildi: {title}', { title: m.title }));
          this.goTo(m.place);
          this.app.ui.showToast(_('Herkes {name} konumuna ışınlanıyor', { name: m.place.name || m.title }), 3200);
        } else {
          this.system(_('Oylama reddedildi: {title}', { title: m.title }));
        }
        break;
      case 'clock':
        this.clock = m.clock;
        if (!this.isOwner) this.applyClock(m.clock);
        break;
      case 'emote':
        this.avatars.emote(m.pid, m.e);
        break;
      case 'notice': {
        const text = {
          muted: _('Oda sahibi seni susturdu'), slow: _('Biraz yavaş, lütfen'), 'vote-busy': _('Zaten bir oylama sürüyor'), 'shot-missing': _('Görüntü gönderilemedi'),
          'need-two': _('Bu oyun için en az iki oyuncu gerekli'),
        }[m.code];
        this.app.ui.showToast(text, 2600);
        break;
      }
    }
  }

  /** hide and seek: the round's news, and the hider out of sight while it runs */
  private setHide(h: Hide | null, news: boolean): void {
    const old = this.hide;
    this.hide = h;
    const hider = h && (h.phase === 'hide' || h.phase === 'seek') ? h.hider : null;
    this.avatars.hidden = hider;
    if (hider && this.following === hider) this.follow(null);
    if (hider && this.picked === hider) this.select(null);
    if (h && (h.round !== old?.round || h.phase !== old?.phase)) {
      this.heat = this.prevHeat = null;
      const nick = (pid: string | null): string => (pid && this.members.get(pid)?.nick) || '?';
      if (news && h.phase === 'hide') {
        if (h.hider === this.me) this.app.ui.showToast(_('Saklanma sırası sende! {s} saniye içinde uzaklaş ve bir yere saklan.', { s: Math.round((h.ends - this.serverNow) / 1000) }), 5000);
        this.system(_('Saklambaç, tur {n}: {nick} saklanıyor. Arama {s} saniye sonra başlıyor.', { n: h.round, nick: nick(h.hider), s: Math.round((h.ends - this.serverNow) / 1000) }));
      } else if (news && h.phase === 'seek') {
        this.system(_('Arama başladı! Uzaklık göstergesi ve ipuçlarıyla {nick} oyuncusunu bul.', { nick: nick(h.hider) }));
      } else if (news && h.phase === 'over' && old) {
        this.system(h.caught
          ? _('{catcher}, {nick} oyuncusunu buldu! (+3)', { catcher: nick(h.caught), nick: nick(h.hider) })
          : _('Süre doldu: {nick} bulunamadı (+3)', { nick: nick(h.hider) }));
        if (h.caught === this.me) this.app.ui.showToast(_('Buldun! +3 puan'), 3000);
      }
    }
    if (news && h) for (const x of h.hints.slice(h.round === old?.round ? old.hints.length : 0)) this.system(_('İpucu: {text}', { text: this.hintText(x) }));
    this.hud.renderGame();
  }

  private system(text: string): void {
    const line: ChatLine = { pid: '', nick: '', color: 0, text, at: Date.now(), sys: true };
    this.chat = [...this.chat.slice(-80), line];
    this.hud.addChat(line);
  }

  /* ---- actions (from the panel) ---- */

  say(text: string): void {
    const t = text.trim().slice(0, MAX_CHAT);
    if (t) this.sock.send({ t: 'chat', text: t });
  }

  emote(e: Emote): void { this.sock.send({ t: 'emote', e }); }
  kick(pid: string): void { this.sock.send({ t: 'kick', pid }); }
  mute(pid: string, on: boolean): void { this.sock.send({ t: 'mute', pid, on }); }
  ballot(yes: boolean): void { if (this.vote) this.sock.send({ t: 'ballot', id: this.vote.id, yes }); }

  /** a vote to bring everyone here (or to a shot's place) */
  propose(place: Place, title: string, shot?: string): void {
    this.sock.send({ t: 'vote', place, title: title.slice(0, MAX_TITLE), shot });
  }

  proposeHere(): void {
    const name = this.hereName();
    this.propose({ ...this.here(), name }, _('{name} konumuna gidelim mi?', { name }));
  }

  /** frame grab → R2 → everyone's discoveries */
  async share(title: string): Promise<boolean> {
    const place: Place = { ...this.here(), name: this.hereName() };
    const blob = await this.app.captureFrame(1280);
    if (!blob) { this.app.ui.showToast(_('Ekran görüntüsü alınamadı')); return false; }
    const up = await uploadShot(this.code, blob);
    if ('error' in up) {
      this.app.ui.showToast(up.error === 'slow' ? _('Bir sonraki görüntü için birkaç saniye bekleyin') : _('Görüntü yüklenemedi'), 3000);
      return false;
    }
    this.sock.send({ t: 'shot', id: up.id, title: title.trim().slice(0, MAX_TITLE), place });
    return true;
  }

  private hiding(pid: string): boolean {
    if (pid !== this.avatars.hidden) return false;
    this.app.ui.showToast(_('Saklambaç sürüyor: onu bulman gerek!'), 2600);
    return true;
  }

  goTo(p: Pose): void {
    if (this.following) this.follow(null);
    this.app.teleportTo(p.s, p.b, _pos.set(p.o[0], p.o[1], p.o[2]), _pc.set(p.g[0], p.g[1], p.g[2]), _q.set(p.q[0], p.q[1], p.q[2], p.q[3]).normalize());
    if (p.l && p.b) this.app.landAt(p.b, p.l[0], p.l[1]);
  }

  /** a few metres behind them, looking where they look (on the ground beside them when they stand on it) */
  teleportToPlayer(pid: string, quiet = false): void {
    if (this.hiding(pid)) return;
    const pose = this.avatars.poseOf(pid);
    const who = this.members.get(pid);
    if (!pose || !who) { this.app.ui.showToast(_('Konumu henüz bilinmiyor')); return; }
    _q.set(pose.q[0], pose.q[1], pose.q[2], pose.q[3]).normalize();
    _back.set(0, 0.002, 0.009).applyQuaternion(_q);
    this.app.teleportTo(pose.s, pose.b, _pos.set(pose.o[0], pose.o[1], pose.o[2]).add(_back), _pc.set(pose.g[0], pose.g[1], pose.g[2]), _q);
    this.followReady = false;
    if (pose.l && pose.b) this.app.landAt(pose.b, pose.l[0], pose.l[1]);
    if (!quiet) this.app.ui.showToast(_('{nick} yanına ışınlandın', { nick: who.nick }), 2200);
  }

  select(pid: string | null): void {
    if (pid === this.me) pid = null;
    this.picked = pid;
    this.avatars.select(pid);
    this.hud.renderPick();
  }

  /** ride along with a player: wherever they fly, the camera keeps its place beside them */
  follow(pid: string | null): void {
    const u = this.app.universe, cam = this.app.camera;
    const was = this.following;
    if (!pid) {
      this.following = null;
      // let go where they were: moving on with the body they were moving with
      const pose = was ? this.avatars.poseOf(was) : null;
      const b = pose?.b && pose.s === u.current.starId ? u.get(pose.b) ?? null : null;
      if (was && b && !cam.reference) cam.setReference(b);
      this.hud.renderPick();
      return;
    }
    if (this.hiding(pid)) return;
    const pose = this.avatars.poseOf(pid);
    const who = this.members.get(pid);
    if (!pose || !who) { this.app.ui.showToast(_('Konumu henüz bilinmiyor')); return; }
    const at = this.avatars.positionOf(pid);
    if (pose.s !== u.current.starId || !at || at.distanceTo(cam.position) > FOLLOW_NEAR_KM) this.teleportToPlayer(pid, true);
    cam.autopilot = null;
    cam.mode = 'free';
    this.following = pid;
    this.followReady = false;
    this.select(pid);
    this.app.ui.showToast(_('{nick} takip ediliyor', { nick: who.nick }), 2200);
  }

  /** turn to face a player, wherever they are */
  lookAt(pid: string): void {
    if (this.hiding(pid)) return;
    const at = this.avatars.positionOf(pid);
    if (!at) { this.app.ui.showToast(_('Konumu henüz bilinmiyor')); return; }
    this.app.camera.centerOnDirection(_pos.copy(at).sub(this.app.camera.position));
  }

  distanceTo(pid: string): number {
    return this.avatars.distanceOf(pid);
  }
}

/* ---------------- the side panel ---------------- */

type Tab = 'chat' | 'players' | 'shots';

class Hud {
  private readonly root: HTMLElement;
  private readonly voteBar: HTMLElement;
  private tab: Tab = 'chat';
  private unseenShots = 0;
  private unseenChat = 0;
  private sharing = false;

  constructor(private readonly s: Session) {
    const r = document.createElement('aside');
    r.className = 'party-hud';
    r.innerHTML = `
      <div class="ph-head">
        <div class="ph-title"><span class="ph-name"></span><span class="ph-sub"></span></div>
        <button class="small-btn" data-copy title="${esc(_('Davet bağlantısını kopyala'))}">${esc(_('Davet et'))}</button>
        <button class="icon-btn small" data-min title="${esc(_('Küçült'))}">–</button>
        <button class="icon-btn small" data-leave title="${esc(_('Odadan ayrıl'))}">×</button>
      </div>
      <div class="ph-game" hidden></div>
      <div class="ph-pick" hidden></div>
      <div class="ph-tabs">
        <button data-tab="chat">${esc(_('Sohbet'))}<span class="badge" data-badge="chat"></span></button>
        <button data-tab="players">${esc(_('Oyuncular'))}<span class="badge" data-badge="players"></span></button>
        <button data-tab="shots">${esc(_('Keşifler'))}<span class="badge" data-badge="shots"></span></button>
      </div>
      <div class="ph-body"></div>
      <div class="ph-foot">
        <form class="party-row" data-chat><input type="text" maxlength="${MAX_CHAT}" placeholder="${esc(_('Mesaj yaz…'))}" autocomplete="off" /></form>
        <div class="ph-emotes">${EMOTES.map((e) => `<button data-emote="${e}">${esc(_(EMOTE_LABELS[e]))}</button>`).join('')}</div>
        <div class="party-row"><button class="primary" data-share style="flex:1">${esc(_('Keşfini paylaş'))}</button><button data-call style="flex:1" title="${esc(_('Herkesi bulunduğun yere çağırmak için oylama başlat'))}">${esc(_('Herkesi çağır'))}</button></div>
      </div>`;
    const ui = document.getElementById('ui') ?? document.body;
    ui.appendChild(r);
    this.root = r;
    const v = document.createElement('div');
    v.className = 'party-vote';
    v.hidden = true;
    ui.appendChild(v);
    this.voteBar = v;

    r.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((b) => b.addEventListener('click', () => this.setTab(b.dataset.tab as Tab)));
    el(r, '[data-min]').addEventListener('click', () => r.classList.toggle('min'));
    el(r, '[data-leave]').addEventListener('click', () => s.leave());
    el(r, '[data-copy]').addEventListener('click', () => {
      void navigator.clipboard?.writeText(s.link).then(
        () => s.app.ui.showToast(_('Davet bağlantısı kopyalandı: {link}', { link: s.link }), 3000),
        () => prompt(_('Davet bağlantısı'), s.link),
      );
    });
    const chat = el<HTMLFormElement>(r, '[data-chat]');
    chat.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = el<HTMLInputElement>(chat, 'input');
      s.say(input.value);
      input.value = '';
    });
    chat.addEventListener('keydown', (e) => { if (e.key === 'Escape') (e.target as HTMLInputElement).blur(); });
    r.querySelectorAll<HTMLButtonElement>('[data-emote]').forEach((b) => b.addEventListener('click', () => s.emote(b.dataset.emote as Emote)));
    el(r, '[data-share]').addEventListener('click', () => this.openShare());
    el(r, '[data-call]').addEventListener('click', () => s.proposeHere());
    this.renderAll();
  }

  dispose(): void {
    this.root.remove();
    this.voteBar.remove();
  }

  show(): void {
    this.root.hidden = false;
    this.root.classList.remove('min');
  }

  /** the selected player: who, how far, and what to do with them */
  renderPick(): void {
    const s = this.s;
    const box = el(this.root, '.ph-pick');
    const m = s.picked ? s.members.get(s.picked) : undefined;
    if (!m) { box.hidden = true; box.innerHTML = ''; return; }
    const on = s.following === m.pid;
    box.hidden = false;
    box.style.setProperty('--c', PARTY_COLORS[m.color] ?? '#fff');
    box.innerHTML = `
      <div class="pp-who"><span class="ph-dot"></span><b>${esc(m.nick)}</b><span class="pp-skin">${esc(AVATAR_NAMES[m.avatar] ?? '')}</span><span class="pp-dist"></span><button class="icon-btn small" data-unpick title="${esc(_('Seçimi kaldır'))}">×</button></div>
      <div class="pp-actions">
        <button class="${on ? 'active' : 'primary'}" data-follow>${esc(on ? _('Takibi bırak') : _('Takip et'))}</button>
        <button data-look>${esc(_('Ona bak'))}</button>
        <button data-go>${esc(_('Yanına ışınlan'))}</button>
      </div>`;
    el(box, '[data-unpick]').addEventListener('click', () => { if (s.following === m.pid) s.follow(null); s.select(null); });
    el(box, '[data-follow]').addEventListener('click', () => s.follow(s.following === m.pid ? null : m.pid));
    el(box, '[data-look]').addEventListener('click', () => s.lookAt(m.pid));
    el(box, '[data-go]').addEventListener('click', () => { if (s.following === m.pid) s.follow(null); s.teleportToPlayer(m.pid); });
    this.tickPick();
  }

  private tickPick(): void {
    const pid = this.s.picked;
    const dist = pid ? this.root.querySelector('.pp-dist') : null;
    if (!pid || !dist) return;
    const d = this.s.distanceTo(pid);
    dist.textContent = Number.isFinite(d) ? (d < 1e8 ? fmtDistance(d) : fmtScaleDistance(d)) : '';
  }

  /** the room's game: the hunt's target, the hide-and-seek round */
  renderGame(): void {
    const s = this.s;
    const box = el(this.root, '.ph-game');
    const mode = s.mode;
    if (mode === 'free' || !s.me) { box.hidden = true; box.innerHTML = ''; return; }
    box.hidden = false;
    box.dataset.mode = mode;
    const nick = (pid: string | null | undefined): string => (pid && s.members.get(pid)?.nick) || '';
    const scores = (sc: Record<string, number>): string => {
      const top = Object.entries(sc).filter(([pid]) => s.members.has(pid)).sort((a, b) => b[1] - a[1]).slice(0, 6);
      return top.length ? `<div class="pg-scores">${top.map(([pid, n]) => `<span style="--c:${PARTY_COLORS[s.members.get(pid)!.color] ?? '#fff'}"><b>${esc(nick(pid))}</b> ${n}</span>`).join('')}</div>` : '';
    };
    const roundBtn = (started: boolean): string => s.isOwner ? `<button class="primary" data-round>${esc(started ? _('Yeni tur') : _('Turu başlat'))}</button>` : '';
    let html = '';
    if (mode === 'hunt') {
      const h = s.hunt;
      const t = h?.target;
      html = `
        <div class="pg-head"><b>${esc(_('Hazine avı'))}${h?.round ? ` · ${esc(_('Tur {n}', { n: h.round }))}` : ''}</b><span class="pg-time"></span></div>
        ${t ? `<div class="pg-target">${esc(_(HUNT_LABELS[t]))}</div><div class="pg-note">${esc(_('Hedefin yakınına git; doğru yerdeysen kendiliğinden sayılır. İlk bulan 3, sonrakiler 2 ve 1 puan alır.'))}</div>`
          : `<div class="pg-note">${esc(s.isOwner ? _('Turu başlat: herkese aynı hedef verilir, ilk bulan kazanır.') : _('Oda sahibi turu başlatınca hedef burada görünür.'))}</div>`}
        ${h?.found.length ? `<ol class="pg-found">${h.found.map((f) => `<li style="--c:${PARTY_COLORS[f.color] ?? '#fff'}"><b>${esc(f.nick)}</b> ${esc(f.name)} <small>+${f.pts}</small></li>`).join('')}</ol>` : ''}
        ${h ? scores(h.scores) : ''}
        <div class="pg-actions">${roundBtn(!!h?.round)}</div>`;
    } else {
      const h = s.hide;
      const me = h?.hider === s.me;
      const running = h && (h.phase === 'hide' || h.phase === 'seek');
      let state = '';
      if (!h || h.phase === 'idle') state = s.isOwner ? _('Turu başlat: biri saklanır, diğerleri uzaklık göstergesi ve ipuçlarıyla arar.') : _('Oda sahibi turu başlatınca biri saklanır, diğerleri arar.');
      else if (h.phase === 'hide') state = me ? _('Saklan! Başka bir yıldıza ya da gezegene kaç. Arama başlayınca uzaklığın her saniye arayanlara söylenir.') : _('{nick} saklanıyor… Arama başlayınca uzaklık göstergesi açılır.', { nick: nick(h.hider) });
      else if (h.phase === 'seek') state = me ? _('Seni arıyorlar! Biri {km} yakınına gelirse yakalanırsın.', { km: fmtDistance(200_000) }) : _('{nick} oyuncusunu bul: {km} yakınına gelmen yeterli.', { nick: nick(h.hider), km: fmtDistance(200_000) });
      else state = h.caught ? _('{catcher}, {nick} oyuncusunu buldu!', { catcher: nick(h.caught), nick: nick(h.hider) }) : _('Süre doldu: {nick} bulunamadı.', { nick: nick(h.hider) });
      const star = s.hintStar();
      html = `
        <div class="pg-head"><b>${esc(_('Saklambaç'))}${h?.round ? ` · ${esc(_('Tur {n}', { n: h.round }))}` : ''}</b><span class="pg-time"></span></div>
        <div class="pg-note">${esc(state)}</div>
        ${h?.phase === 'seek' && !me ? '<div class="pg-heat"></div>' : ''}
        ${h?.hints.length && running ? `<ul class="pg-hints">${h.hints.map((x) => `<li>${esc(s.hintText(x))}</li>`).join('')}</ul>` : ''}
        ${star && running && !me ? `<div class="pg-actions"><button data-star>${esc(_('O sisteme uç'))}</button></div>` : ''}
        ${h ? scores(h.scores) : ''}
        <div class="pg-actions">${running ? '' : roundBtn(!!h?.round)}</div>`;
    }
    box.innerHTML = html;
    box.querySelector('[data-round]')?.addEventListener('click', () => s.nextRound());
    box.querySelector('[data-star]')?.addEventListener('click', () => { const id = s.hintStar(); if (id) s.app.goToStar(id); });
    this.tickGame();
  }

  private tickGame(): void {
    const s = this.s;
    const box = this.root.querySelector<HTMLElement>('.ph-game');
    if (!box || box.hidden) return;
    const time = box.querySelector('.pg-time');
    const ends = s.mode === 'hunt' ? (s.hunt?.target ? s.hunt.ends : 0) : s.mode === 'hide' && s.hide && (s.hide.phase === 'hide' || s.hide.phase === 'seek') ? s.hide.ends : 0;
    if (time) time.textContent = ends ? (ends > s.serverNow ? fmtSeconds(ends - s.serverNow) : _('bitti')) : '';
    const heat = box.querySelector<HTMLElement>('.pg-heat');
    if (heat) {
      const km = s.heat, prev = s.prevHeat;
      const trend = km === null || prev === null || Math.abs(km - prev) < km * 0.002 ? '' : km < prev ? 'hot' : 'cold';
      heat.className = `pg-heat ${trend}`;
      heat.textContent = km === null ? _('Uzaklık ölçülüyor…')
        : `${_('Uzaklık: {d}', { d: km < 1e8 ? fmtDistance(km) : fmtScaleDistance(km) })}${trend === 'hot' ? ` · ${_('ısınıyor')}` : trend === 'cold' ? ` · ${_('soğuyor')}` : ''}`;
    }
  }

  tick(): void {
    this.tickPick();
    this.tickGame();
    const v = this.s.vote;
    if (v && !this.voteBar.hidden) {
      const left = Math.max(0, Math.ceil((v.ends - Date.now() - 0) / 1000));
      const sub = this.voteBar.querySelector('.pvote-sub');
      if (sub) sub.textContent = `${_('{yes} evet · {no} hayır', { yes: v.yes.length, no: v.no.length })} · ${left} s`;
    }
  }

  renderAll(): void {
    this.renderHead();
    this.renderGame();
    this.renderBody();
    this.renderVote();
    this.renderBadges();
  }

  renderHead(): void {
    const s = this.s;
    el(this.root, '.ph-name').textContent = s.room?.name ?? s.code;
    const sub = el(this.root, '.ph-sub');
    const st = s.connected ? `${s.code} · ${_(MODE_LABELS[s.mode])} · ${s.members.size}/${s.room?.max ?? PARTY_MAX}` : `${s.code} · ${_('Bağlanılıyor…')}`;
    sub.textContent = st;
    sub.classList.toggle('warn', !s.connected);
  }

  renderPlayers(): void {
    this.renderHead();
    this.renderGame();
    this.renderPick();
    this.renderBadges();
    if (this.tab === 'players') this.renderBody();
  }

  renderShots(): void {
    if (this.tab === 'shots') this.renderBody();
    else this.unseenShots++;
    this.renderBadges();
  }

  addChat(line: ChatLine): void {
    if (this.tab !== 'chat') { this.unseenChat++; this.renderBadges(); return; }
    const box = this.root.querySelector('.ph-chat');
    if (!box) return;
    const body = el(this.root, '.ph-body');
    const atEnd = body.scrollTop + body.clientHeight >= body.scrollHeight - 30;
    box.querySelector('.ph-empty')?.remove();
    box.insertAdjacentHTML('beforeend', this.chatLine(line));
    while (box.children.length > 120) box.firstElementChild?.remove();
    if (atEnd) body.scrollTop = body.scrollHeight;
  }

  private setTab(t: Tab): void {
    this.tab = t;
    if (t === 'shots') this.unseenShots = 0;
    if (t === 'chat') this.unseenChat = 0;
    this.root.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((b) => b.classList.toggle('active', b.dataset.tab === t));
    this.root.classList.remove('min');
    this.renderBody();
    this.renderBadges();
  }

  private renderBadges(): void {
    el(this.root, '[data-badge="players"]').textContent = String(this.s.members.size || '');
    el(this.root, '[data-badge="shots"]').textContent = this.unseenShots ? `+${this.unseenShots}` : String(this.s.shots.length || '');
    el(this.root, '[data-badge="chat"]').textContent = this.unseenChat ? `+${this.unseenChat}` : '';
    this.root.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((b) => b.classList.toggle('active', b.dataset.tab === this.tab));
  }

  private chatLine(l: ChatLine): string {
    return l.sys
      ? `<div class="ph-line sys">${esc(l.text)}</div>`
      : `<div class="ph-line" style="--c:${PARTY_COLORS[l.color] ?? '#fff'}"><b>${esc(l.nick)}</b>${esc(l.text)}</div>`;
  }

  private renderBody(): void {
    const s = this.s;
    const body = el(this.root, '.ph-body');
    if (this.tab === 'chat') {
      body.innerHTML = `<div class="ph-chat">${s.chat.length ? s.chat.map((l) => this.chatLine(l)).join('') : `<div class="ph-empty">${esc(_('Henüz mesaj yok. Selam ver!'))}</div>`}</div>`;
      body.scrollTop = body.scrollHeight;
      return;
    }
    if (this.tab === 'players') {
      const list = [...s.members.values()].sort((a, b) => Number(b.owner) - Number(a.owner) || a.nick.localeCompare(b.nick));
      body.innerHTML = `<ul class="ph-players">${list.map((m) => `
        <li style="--c:${PARTY_COLORS[m.color] ?? '#fff'}"><span class="ph-dot"></span>
          <span class="ph-nick"${m.pid !== s.me ? ` data-pick="${m.pid}" title="${esc(_('Seç'))}"` : ''}>${esc(m.nick)}${m.pid === s.me ? `<small>${esc(_('sen'))}</small>` : ''}${m.owner ? `<small>${esc(_('oda sahibi'))}</small>` : ''}${m.muted ? `<small>${esc(_('susturuldu'))}</small>` : ''}</span>
          ${m.pid !== s.me ? `<button data-go="${m.pid}">${esc(_('Işınlan'))}</button>` : ''}
          ${s.isOwner && m.pid !== s.me ? `<button data-mute="${m.pid}">${esc(m.muted ? _('Sesi aç') : _('Sustur'))}</button><button data-kick="${m.pid}">${esc(_('At'))}</button>` : ''}
        </li>`).join('')}</ul>`;
      body.querySelectorAll<HTMLElement>('[data-pick]').forEach((b) => b.addEventListener('click', () => s.select(b.dataset.pick!)));
      body.querySelectorAll<HTMLButtonElement>('[data-go]').forEach((b) => b.addEventListener('click', () => s.teleportToPlayer(b.dataset.go!)));
      body.querySelectorAll<HTMLButtonElement>('[data-mute]').forEach((b) => b.addEventListener('click', () => s.mute(b.dataset.mute!, !s.members.get(b.dataset.mute!)?.muted)));
      body.querySelectorAll<HTMLButtonElement>('[data-kick]').forEach((b) => b.addEventListener('click', () => {
        const who = s.members.get(b.dataset.kick!);
        if (who && confirm(_('{nick} odadan çıkarılsın mı? Bir daha katılamaz.', { nick: who.nick }))) s.kick(who.pid);
      }));
      return;
    }
    const shots = [...s.shots].reverse();
    body.innerHTML = shots.length
      ? `<div class="ph-shots">${shots.map((sh) => `
          <button class="ph-shot" data-shot="${esc(sh.id)}" style="--c:${PARTY_COLORS[sh.color] ?? '#fff'}"><img src="${esc(shotUrl(sh.url))}" alt="" loading="lazy" /><span><b>${esc(sh.nick)}</b> ${esc(sh.title)}</span></button>`).join('')}</div>`
      : `<div class="ph-empty">${esc(_('Bir şey bulduğunda “Keşfini paylaş” ile herkese göster. Görüntüler burada birikir; oylamayla hep birlikte oraya gidebilirsiniz.'))}</div>`;
    body.querySelectorAll<HTMLButtonElement>('[data-shot]').forEach((b) => b.addEventListener('click', () => {
      const sh = s.shots.find((x) => x.id === b.dataset.shot);
      if (sh) this.view(sh);
    }));
  }

  renderVote(): void {
    const v = this.s.vote;
    const bar = this.voteBar;
    if (!v) { bar.hidden = true; bar.innerHTML = ''; return; }
    const shot = v.shot ? this.s.shots.find((x) => x.id === v.shot) : null;
    const mine = v.yes.includes(this.s.me) ? 'yes' : v.no.includes(this.s.me) ? 'no' : '';
    bar.hidden = false;
    bar.innerHTML = `
      ${shot ? `<img src="${esc(shotUrl(shot.url))}" alt="" />` : ''}
      <div class="pvote-text"><span class="pvote-q">${esc(v.title)}</span><span class="pvote-sub"></span></div>
      <button data-yes class="${mine === 'yes' ? 'mine' : ''}">${esc(_('Evet, gidelim'))}</button>
      <button data-no class="${mine === 'no' ? 'mine' : ''}">${esc(_('Hayır'))}</button>`;
    el(bar, '[data-yes]').addEventListener('click', () => this.s.ballot(true));
    el(bar, '[data-no]').addEventListener('click', () => this.s.ballot(false));
    this.tick();
  }

  /** caption, then the frame: the panel hides for the grab so only the universe is in it */
  private openShare(): void {
    if (this.sharing) return;
    const foot = el(this.root, '.ph-foot');
    if (foot.querySelector('.ph-share')) return;
    foot.insertAdjacentHTML('afterbegin', `
      <form class="ph-share"><input type="text" maxlength="${MAX_TITLE}" placeholder="${esc(_('Ne buldun? (isteğe bağlı)'))}" /><button class="primary" type="submit">${esc(_('Gönder'))}</button><button type="button" data-cancel>×</button></form>`);
    const form = el<HTMLFormElement>(foot, '.ph-share');
    const input = el<HTMLInputElement>(form, 'input');
    input.focus();
    el(form, '[data-cancel]').addEventListener('click', () => form.remove());
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      this.sharing = true;
      input.blur();
      void this.s.share(input.value)
        .then((ok) => { if (ok) { form.remove(); this.setTab('shots'); } })
        .catch((err) => { console.warn('party share', err); this.s.app.ui.showToast(_('Görüntü yüklenemedi')); })
        .finally(() => { this.sharing = false; });
    });
  }

  private view(sh: Shot): void {
    const m = document.createElement('div');
    m.className = 'modal party-modal party-view';
    m.innerHTML = `
      <div class="modal-card">
        <img src="${esc(shotUrl(sh.url))}" alt="${esc(sh.title)}" />
        <div class="pv-meta">
          <div><div class="pv-title">${esc(sh.title)}</div><div class="pv-by">${esc(_('{nick} paylaştı · {place}', { nick: sh.nick, place: sh.place.name }))}</div></div>
          <div class="pv-actions">
            <button data-go>${esc(_('Oraya ışınlan'))}</button>
            <button class="primary" data-vote>${esc(_('Oylamaya aç'))}</button>
            <a class="small-btn" href="${esc(shotUrl(sh.url))}" target="_blank" rel="noopener">${esc(_('Bağlantı'))}</a>
            <button data-close>×</button>
          </div>
        </div>
      </div>`;
    (document.getElementById('ui') ?? document.body).appendChild(m);
    const close = (): void => m.remove();
    m.addEventListener('pointerdown', (e) => { if (e.target === m) close(); });
    el(m, '[data-close]').addEventListener('click', close);
    el(m, '[data-go]').addEventListener('click', () => { this.s.goTo(sh.place); close(); });
    el(m, '[data-vote]').addEventListener('click', () => {
      this.s.propose(sh.place, _('{title}: oraya gidelim mi?', { title: sh.title }), sh.id);
      close();
    });
  }
}
