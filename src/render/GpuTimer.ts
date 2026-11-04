import type { WebGLRenderer } from 'three';

/**
 * GPU time of a render pass, measured with EXT_disjoint_timer_query_webgl2 where the driver offers
 * it (desktop Chrome / Edge; Safari and most mobiles do not). Queries are read back a few frames
 * later, so `ms` is a short running mean rather than the last frame. Harmless no-op without the
 * extension (`supported` false, `ms` NaN).
 */
export class GpuTimer {
  readonly supported: boolean;
  /** running mean of the pass in milliseconds (NaN until the first result) */
  ms = NaN;
  /** most recent single result (ms) */
  last = NaN;
  samples = 0;
  private readonly gl: WebGL2RenderingContext;
  private readonly ext: { TIME_ELAPSED_EXT: number; GPU_DISJOINT_EXT: number } | null;
  private readonly pending: WebGLQuery[] = [];
  private open = false;

  constructor(renderer: WebGLRenderer) {
    this.gl = renderer.getContext() as WebGL2RenderingContext;
    this.ext = typeof WebGL2RenderingContext !== 'undefined' && this.gl instanceof WebGL2RenderingContext
      ? (this.gl.getExtension('EXT_disjoint_timer_query_webgl2') as { TIME_ELAPSED_EXT: number; GPU_DISJOINT_EXT: number } | null)
      : null;
    this.supported = this.ext !== null;
  }

  /** Start timing; nested / overlapping queries are not allowed, so a second begin is ignored */
  begin(): void {
    if (!this.ext || this.open || this.pending.length > 8) return;
    this.poll();
    const q = this.gl.createQuery();
    if (!q) return;
    this.gl.beginQuery(this.ext.TIME_ELAPSED_EXT, q);
    this.pending.push(q);
    this.open = true;
  }

  end(): void {
    if (!this.ext || !this.open) return;
    this.gl.endQuery(this.ext.TIME_ELAPSED_EXT);
    this.open = false;
  }

  /** Collect finished queries (called from begin; cheap) */
  private poll(): void {
    const gl = this.gl, ext = this.ext!;
    while (this.pending.length) {
      const q = this.pending[0];
      const available = gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE) as boolean;
      const disjoint = gl.getParameter(ext.GPU_DISJOINT_EXT) as boolean;
      if (!available && !disjoint) break;
      this.pending.shift();
      if (available && !disjoint) {
        const ns = gl.getQueryParameter(q, gl.QUERY_RESULT) as number;
        this.last = ns / 1e6;
        this.ms = Number.isNaN(this.ms) ? this.last : this.ms * 0.9 + this.last * 0.1;
        this.samples++;
      }
      gl.deleteQuery(q);
    }
  }

  stats(): { supported: boolean; ms: number; last: number; samples: number } {
    return { supported: this.supported, ms: +this.ms.toFixed(3), last: +this.last.toFixed(3), samples: this.samples };
  }

  dispose(): void {
    for (const q of this.pending) this.gl.deleteQuery(q);
    this.pending.length = 0;
  }
}
