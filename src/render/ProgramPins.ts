import type { Material, ShaderMaterial, WebGLRenderer } from 'three';

/**
 * Keeps the renderer's shader programs alive across system switches.
 *
 * three.js reference-counts programs by the materials using them: when the last planet material
 * of a kind is disposed (we left a system that had a gas giant; the next has none) the program
 * goes with it, and the next system that needs it links it again — a blocking stall of 10–30 ms
 * right in the frame of the switch. Here the first *compiled* material of every program variant
 * is kept for ever instead of being disposed (a few dozen small objects at most), so every later
 * material of that kind finds its program in the cache.
 */
let renderer: WebGLRenderer | null = null;
const pins = new Map<string, Material>();

export function initProgramPins(r: WebGLRenderer): void { renderer = r; }

/** Dispose a material — unless it is the one keeping its shader program alive */
export function disposeOrPin(m: Material | null | undefined): void {
  if (!m) return;
  if (!renderer) { m.dispose(); return; }
  const key = programKey(m);
  const compiled = !!(renderer.properties.get(m) as { currentProgram?: unknown }).currentProgram;
  const held = pins.get(key);
  if (compiled && (!held || !(renderer.properties.get(held) as { currentProgram?: unknown }).currentProgram)) {
    // this one has the program: it takes over the pin (an earlier, never-rendered holder goes)
    if (held && held !== m) held.dispose();
    pins.set(key, m);
    return;
  }
  if (held === m) return;
  m.dispose();
}

/** approximation of three's program cache key: shader sources and the material flags that enter it */
function programKey(m: Material): string {
  const sm = m as Partial<ShaderMaterial> & Material;
  const src = sm.isShaderMaterial ? `${idOf(sm.vertexShader ?? '')}:${idOf(sm.fragmentShader ?? '')}` : m.type;
  return `${src}|${m.side}|${m.transparent}|${m.blending}|${m.alphaToCoverage}|${m.premultipliedAlpha}|${m.vertexColors}|${m.toneMapped}|${m.alphaTest > 0}|${JSON.stringify(m.defines ?? null)}`;
}

/** small id per distinct shader source (the sources are shared string instances: the lookup is a pointer check) */
const sourceIds = new Map<string, number>();
function idOf(src: string): number {
  let id = sourceIds.get(src);
  if (id === undefined) { id = sourceIds.size + 1; sourceIds.set(src, id); }
  return id;
}
