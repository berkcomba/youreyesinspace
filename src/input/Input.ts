/** Low-level keyboard/mouse state for the 3D view. */
export class Input {
  readonly keys = new Set<string>();
  /** accumulated mouse drag since last frame (pixels) */
  dragX = 0;
  dragY = 0;
  /** accumulated wheel delta since last frame */
  wheel = 0;
  dragging = false;
  private downX = 0;
  private downY = 0;
  private moved = false;
  private lastClickTime = 0;

  onClick: ((x: number, y: number, double: boolean) => void) | null = null;
  onKey: ((code: string, e: KeyboardEvent) => void) | null = null;
  /** pointer-lock state changed (free roam) */
  onLockChange: ((locked: boolean) => void) | null = null;

  constructor(private readonly el: HTMLElement) {
    el.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointerup', this.onPointerUp);
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

  private onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0 && e.button !== 2) return;
    this.moved = false;
    this.downX = e.clientX;
    this.downY = e.clientY;
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
    this.dragging = true;
    (document.activeElement as HTMLElement | null)?.blur?.();
    this.el.setPointerCapture(e.pointerId);
  };

  private onPointerMove = (e: PointerEvent) => {
    if (this.locked) {
      this.dragX += e.movementX;
      this.dragY += e.movementY;
      return;
    }
    if (!this.dragging) return;
    const dx = e.clientX - this.downX;
    const dy = e.clientY - this.downY;
    if (!this.moved && Math.hypot(dx, dy) > 4) this.moved = true;
    if (this.moved) {
      this.dragX += e.movementX;
      this.dragY += e.movementY;
    }
  };

  private onPointerUp = (e: PointerEvent) => {
    if (!this.dragging) return;
    this.dragging = false;
    try { this.el.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    if (!this.moved && e.button === 0) {
      const now = performance.now();
      const dbl = now - this.lastClickTime < 320;
      this.lastClickTime = dbl ? 0 : now;
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
  flush(): { dx: number; dy: number; wheel: number } {
    const r = { dx: this.dragX, dy: this.dragY, wheel: this.wheel };
    this.dragX = 0;
    this.dragY = 0;
    this.wheel = 0;
    return r;
  }

  down(code: string): boolean {
    return this.keys.has(code);
  }
}
