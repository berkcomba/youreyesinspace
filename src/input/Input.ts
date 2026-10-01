/** Low-level keyboard / mouse / touch state for the 3D view. */
export class Input {
  readonly keys = new Set<string>();
  /** accumulated one-finger / mouse drag since last frame (pixels) */
  dragX = 0;
  dragY = 0;
  /** accumulated wheel delta since last frame */
  wheel = 0;
  /** accumulated two-finger pinch since last frame: ln(d1/d0), > 0 when fingers spread */
  pinch = 0;
  /** accumulated two-finger pan (centroid movement, pixels) since last frame */
  panX = 0;
  panY = 0;
  dragging = false;
  /** last pointer was a finger (coarse pointer): larger pick tolerances, no hover */
  coarse = false;
  private downX = 0;
  private downY = 0;
  private moved = false;
  private lastClickTime = 0;
  private lastClickX = 0;
  private lastClickY = 0;
  /** active pointers (multi-touch) */
  private readonly pointers = new Map<number, { x: number; y: number }>();
  private pinchDist = 0;
  private pinchCx = 0;
  private pinchCy = 0;

  onClick: ((x: number, y: number, double: boolean) => void) | null = null;
  onKey: ((code: string, e: KeyboardEvent) => void) | null = null;
  /** pointer-lock state changed (free roam) */
  onLockChange: ((locked: boolean) => void) | null = null;

  constructor(private readonly el: HTMLElement) {
    el.style.touchAction = 'none';
    el.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('pointercancel', this.onPointerUp);
    window.addEventListener('pointermove', this.onPointerMove);
    el.addEventListener('wheel', this.onWheel, { passive: false });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', () => this.keys.clear());
    document.addEventListener('pointerlockchange', () => this.onLockChange?.(this.locked));
  }

  /** True while the pointer is captured (mouse-look without dragging). */
  get locked(): boolean {
    return document.pointerLockElement === this.el;
  }

  lockPointer(): void {
    if (this.locked) return;
    try {
      const p = (this.el as HTMLElement & { requestPointerLock(o?: { unadjustedMovement?: boolean }): Promise<void> | void })
        .requestPointerLock({ unadjustedMovement: true });
      if (p && typeof (p as Promise<void>).catch === 'function') {
        (p as Promise<void>).catch(() => { this.el.requestPointerLock(); });
      }
    } catch {
      this.el.requestPointerLock();
    }
  }

  unlockPointer(): void {
    if (this.locked) document.exitPointerLock();
  }

  static isTyping(): boolean {
    const a = document.activeElement;
    return !!a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || (a as HTMLElement).isContentEditable);
  }

  private get tapSlop(): number {
    return this.coarse ? 10 : 4;
  }

  private beginPinch(): void {
    const [a, b] = [...this.pointers.values()];
    this.pinchDist = Math.max(1, Math.hypot(b.x - a.x, b.y - a.y));
    this.pinchCx = (a.x + b.x) / 2;
    this.pinchCy = (a.y + b.y) / 2;
  }

  private onPointerDown = (e: PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0 && e.button !== 2) return;
    this.coarse = e.pointerType === 'touch';
    if (this.locked) {
      // captured pointer: a press is a click on the crosshair, never a drag
      if (e.button === 0) {
        const now = performance.now();
        const dbl = now - this.lastClickTime < 320;
        this.lastClickTime = dbl ? 0 : now;
        const r = this.el.getBoundingClientRect();
        this.onClick?.(r.left + r.width / 2, r.top + r.height / 2, dbl);
      }
      return;
    }
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try { this.el.setPointerCapture(e.pointerId); } catch { /* synthetic events */ }
    if (this.pointers.size === 1) {
      this.moved = false;
      this.downX = e.clientX;
      this.downY = e.clientY;
      this.dragging = true;
      (document.activeElement as HTMLElement | null)?.blur?.();
    } else {
      // second finger: the gesture becomes a pinch/pan, never a tap
      this.moved = true;
      if (this.pointers.size === 2) this.beginPinch();
    }
  };

  private onPointerMove = (e: PointerEvent) => {
    if (this.locked) {
      this.dragX += e.movementX;
      this.dragY += e.movementY;
      return;
    }
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    const prevX = p.x, prevY = p.y;
    p.x = e.clientX;
    p.y = e.clientY;
    if (this.pointers.size >= 2) {
      const [a, b] = [...this.pointers.values()];
      const dist = Math.max(1, Math.hypot(b.x - a.x, b.y - a.y));
      const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
      this.pinch += Math.log(dist / this.pinchDist);
      this.panX += cx - this.pinchCx;
      this.panY += cy - this.pinchCy;
      this.pinchDist = dist;
      this.pinchCx = cx;
      this.pinchCy = cy;
      return;
    }
    if (!this.dragging) return;
    const dx = e.clientX - this.downX;
    const dy = e.clientY - this.downY;
    if (!this.moved && Math.hypot(dx, dy) > this.tapSlop) this.moved = true;
    if (this.moved) {
      // movementX/Y is unreliable for touch on some browsers: use our own deltas
      this.dragX += e.clientX - prevX;
      this.dragY += e.clientY - prevY;
    }
  };

  private onPointerUp = (e: PointerEvent) => {
    if (!this.pointers.has(e.pointerId)) return;
    this.pointers.delete(e.pointerId);
    try { this.el.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    if (this.pointers.size >= 2) { this.beginPinch(); return; }
    if (this.pointers.size === 1) {
      // back to one finger: continue as a drag from the remaining finger, no tap on release
      this.moved = true;
      return;
    }
    this.dragging = false;
    if (!this.moved && e.type === 'pointerup' && (e.pointerType !== 'mouse' || e.button === 0)) {
      const now = performance.now();
      const near = Math.hypot(e.clientX - this.lastClickX, e.clientY - this.lastClickY) < (this.coarse ? 40 : 12);
      const dbl = now - this.lastClickTime < 320 && near;
      this.lastClickTime = dbl ? 0 : now;
      this.lastClickX = e.clientX;
      this.lastClickY = e.clientY;
      this.onClick?.(e.clientX, e.clientY, dbl);
    }
  };

  private onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const d = e.deltaMode === 1 ? e.deltaY * 20 : e.deltaY;
    this.wheel += d;
  };

  private onKeyDown = (e: KeyboardEvent) => {
    if (Input.isTyping()) return;
    if (e.metaKey || (e.ctrlKey && /Key[RLTW]/.test(e.code))) return; // browser shortcuts
    this.keys.add(e.code);
    this.onKey?.(e.code, e);
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
  };

  /** Consume per-frame accumulators. */
  flush(): { dx: number; dy: number; wheel: number; pinch: number; panX: number; panY: number } {
    const r = { dx: this.dragX, dy: this.dragY, wheel: this.wheel, pinch: this.pinch, panX: this.panX, panY: this.panY };
    this.dragX = 0;
    this.dragY = 0;
    this.wheel = 0;
    this.pinch = 0;
    this.panX = 0;
    this.panY = 0;
    return r;
  }

  down(code: string): boolean {
    return this.keys.has(code);
  }
}
