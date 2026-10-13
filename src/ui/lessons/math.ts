/**
 * A small LaTeX subset → MathML, for the Academy lessons. Enough for an astrophysics course:
 * fractions, roots, sub/superscripts, Greek letters, functions, text, common relations and
 * operators. Browsers render MathML natively, so no library is shipped.
 *
 *   tex('\\frac{1}{S} = \\frac{1}{P} - \\frac{1}{P_\\oplus}')
 */

const GREEK: Record<string, string> = {
  alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε', varepsilon: 'ε', zeta: 'ζ', eta: 'η', theta: 'θ',
  vartheta: 'ϑ', iota: 'ι', kappa: 'κ', lambda: 'λ', mu: 'μ', nu: 'ν', xi: 'ξ', pi: 'π', rho: 'ρ', sigma: 'σ',
  tau: 'τ', upsilon: 'υ', phi: 'ϕ', varphi: 'φ', chi: 'χ', psi: 'ψ', omega: 'ω',
  Gamma: 'Γ', Delta: 'Δ', Theta: 'Θ', Lambda: 'Λ', Xi: 'Ξ', Pi: 'Π', Sigma: 'Σ', Phi: 'Φ', Psi: 'Ψ', Omega: 'Ω',
};

/** symbols rendered as operators / relations */
const SYMBOL: Record<string, string> = {
  cdot: '·', times: '×', pm: '±', mp: '∓', approx: '≈', simeq: '≃', sim: '∼', propto: '∝', neq: '≠', ne: '≠',
  le: '≤', leq: '≤', ge: '≥', geq: '≥', ll: '≪', gg: '≫', to: '→', rightarrow: '→', Rightarrow: '⇒', leftarrow: '←',
  Leftrightarrow: '⇔', Longleftrightarrow: '⟺', iff: '⟺', longrightarrow: '⟶', Longrightarrow: '⟹',
  infty: '∞', partial: '∂', nabla: '∇', int: '∫', sum: '∑', prod: '∏', circ: '∘', degree: '°', deg: '°',
  ldots: '…', cdots: '⋯', dots: '…', equiv: '≡', in: '∈', langle: '⟨', rangle: '⟩', vert: '|', mid: '|',
  odot: '⊙', oplus: '⊕', hbar: 'ℏ', ell: 'ℓ', prime: '′', star: '⋆',
};

/** spacing commands → mspace width ('' = none) */
const SPACES: Record<string, string> = { ',': '0.17em', ';': '0.28em', '!': '', ' ': '0.33em', quad: '1em', qquad: '2em' };

/** identifiers that are set upright (function names) */
const FUNCS = new Set(['sin', 'cos', 'tan', 'arcsin', 'arccos', 'arctan', 'sinh', 'cosh', 'tanh', 'log', 'ln', 'exp', 'lim', 'max', 'min', 'det', 'arg']);

/** symbols that are identifiers rather than operators */
const IDENT_SYMBOLS = new Set(['infty', 'partial', 'nabla', 'odot', 'oplus', 'hbar', 'ell', 'star']);

const TEXT_CMDS = new Set(['text', 'mathrm', 'textrm', 'mbox', 'mathbf', 'operatorname']);

type Tok =
  | { t: 'cmd'; v: string }
  | { t: 'text'; cmd: string; v: string }
  | { t: 'num'; v: string }
  | { t: 'id'; v: string }
  | { t: 'op'; v: string }
  | { t: '{' } | { t: '}' } | { t: '^' } | { t: '_' };

function tokenize(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === ' ' || c === '\n' || c === '\t') { i++; continue; }
    if (c === '\\') {
      let j = i + 1;
      if (j < src.length && !/[A-Za-z]/.test(src[j])) { out.push({ t: 'cmd', v: src[j] }); i = j + 1; continue; }
      while (j < src.length && /[A-Za-z]/.test(src[j])) j++;
      const name = src.slice(i + 1, j);
      // \text{…} keeps its spaces: capture the raw group here
      if (TEXT_CMDS.has(name) && src[j] === '{') {
        let depth = 0, k = j;
        for (; k < src.length; k++) {
          if (src[k] === '{') depth++;
          else if (src[k] === '}' && --depth === 0) break;
        }
        out.push({ t: 'text', cmd: name, v: src.slice(j + 1, k).replace(/~/g, ' ') });
        i = k + 1;
        continue;
      }
      out.push({ t: 'cmd', v: name });
      i = j;
      continue;
    }
    if (c === '{') { out.push({ t: '{' }); i++; continue; }
    if (c === '}') { out.push({ t: '}' }); i++; continue; }
    if (c === '^') { out.push({ t: '^' }); i++; continue; }
    if (c === '_') { out.push({ t: '_' }); i++; continue; }
    if (/[0-9]/.test(c)) {
      let j = i;
      while (j < src.length && /[0-9.]/.test(src[j])) j++;
      out.push({ t: 'num', v: src.slice(i, j) });
      i = j;
      continue;
    }
    if (/[A-Za-z]/.test(c)) { out.push({ t: 'id', v: c }); i++; continue; }
    out.push({ t: 'op', v: c });
    i++;
  }
  return out;
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

class Parser {
  private i = 0;
  constructor(private readonly toks: Tok[]) {}

  parse(): string {
    return this.row(this.sequence(() => this.i < this.toks.length));
  }

  private row(parts: string[]): string {
    return parts.length === 1 ? parts[0] : `<mrow>${parts.join('')}</mrow>`;
  }

  /** items until `more()` is false or a closing brace is reached */
  private sequence(more: () => boolean): string[] {
    const out: string[] = [];
    while (more()) {
      const t = this.toks[this.i];
      if (t.t === '}') break;
      out.push(this.item());
    }
    return out;
  }

  /** read a `{ … }` group (or a single atom) as an argument */
  private arg(): string {
    const t = this.toks[this.i];
    if (!t) return '<mrow></mrow>';
    if (t.t === '{') {
      this.i++;
      const parts = this.sequence(() => this.i < this.toks.length);
      if (this.toks[this.i]?.t === '}') this.i++;
      return this.row(parts.length ? parts : ['<mrow></mrow>']);
    }
    return this.atom();
  }

  /** atom with optional sub/superscripts */
  private item(): string {
    let base = this.atom();
    let sub: string | null = null;
    let sup: string | null = null;
    for (;;) {
      const t = this.toks[this.i];
      if (t?.t === '^' && sup === null) { this.i++; sup = this.arg(); continue; }
      if (t?.t === '_' && sub === null) { this.i++; sub = this.arg(); continue; }
      break;
    }
    if (sub !== null && sup !== null) base = `<msubsup>${base}${sub}${sup}</msubsup>`;
    else if (sub !== null) base = `<msub>${base}${sub}</msub>`;
    else if (sup !== null) base = `<msup>${base}${sup}</msup>`;
    return base;
  }

  private atom(): string {
    const t = this.toks[this.i++];
    if (!t) return '<mrow></mrow>';
    switch (t.t) {
      case 'num': return `<mn>${t.v}</mn>`;
      case 'id': return `<mi>${t.v}</mi>`;
      case 'op': return `<mo>${esc(t.v)}</mo>`;
      case '{': {
        const parts = this.sequence(() => this.i < this.toks.length);
        if (this.toks[this.i]?.t === '}') this.i++;
        return this.row(parts.length ? parts : ['<mrow></mrow>']);
      }
      case '}': return '<mrow></mrow>';
      case '^': case '_': return '<mrow></mrow>';
      case 'cmd': return this.command(t.v);
      case 'text': {
        const v = esc(t.v.replace(/\\([A-Za-z]+)/g, (_m, n: string) => SYMBOL[n] ?? GREEK[n] ?? n));
        if (t.cmd === 'mathbf') return `<mi mathvariant="bold">${v}</mi>`;
        if (t.cmd === 'operatorname') return `<mrow><mi>${v}</mi><mo>\u2061</mo></mrow>`;
        return `<mtext>${v}</mtext>`;
      }
    }
  }

  private command(name: string): string {
    switch (name) {
      case 'frac': case 'dfrac': case 'tfrac': { const a = this.arg(); const b = this.arg(); return `<mfrac>${a}${b}</mfrac>`; }
      case 'sqrt': {
        if (this.toks[this.i]?.t === 'op' && (this.toks[this.i] as { v: string }).v === '[') {
          this.i++;
          const idx: string[] = [];
          while (this.i < this.toks.length && !(this.toks[this.i].t === 'op' && (this.toks[this.i] as { v: string }).v === ']')) idx.push(this.item());
          this.i++;
          return `<mroot>${this.arg()}${this.row(idx)}</mroot>`;
        }
        return `<msqrt>${this.arg()}</msqrt>`;
      }
      case 'vec': return `<mover accent="true">${this.arg()}<mo>→</mo></mover>`;
      case 'hat': return `<mover accent="true">${this.arg()}<mo>^</mo></mover>`;
      case 'bar': case 'overline': return `<mover accent="true">${this.arg()}<mo>¯</mo></mover>`;
      case 'dot': return `<mover accent="true">${this.arg()}<mo>˙</mo></mover>`;
      case 'left': case 'right': {
        // \left( … \right) → stretchy fences
        const d = this.toks[this.i++];
        const ch = d?.t === 'op' ? d.v : d?.t === 'cmd' ? SYMBOL[d.v] ?? '' : '';
        return ch === '.' ? '' : `<mo stretchy="true">${esc(ch)}</mo>`;
      }
      case 'big': case 'Big': case 'bigl': case 'bigr': case 'displaystyle': return '';
    }
    if (GREEK[name]) return `<mi>${GREEK[name]}</mi>`;
    if (FUNCS.has(name)) return `<mrow><mi>${name}</mi><mo>\u2061</mo></mrow>`;
    if (name in SPACES) return SPACES[name] ? `<mspace width="${SPACES[name]}"></mspace>` : '';
    if (name in SYMBOL) {
      const s = SYMBOL[name];
      if (IDENT_SYMBOLS.has(name)) return `<mi>${s}</mi>`;
      return `<mo>${esc(s)}</mo>`;
    }
    return `<mi>${esc(name)}</mi>`;
  }
}

/** Display-style MathML for a LaTeX string. */
export function tex(src: string, display = true): string {
  const inner = new Parser(tokenize(src)).parse();
  return `<math xmlns="http://www.w3.org/1998/Math/MathML" display="${display ? 'block' : 'inline'}">${inner}</math>`;
}

/** Inline formula for use inside prose. */
export function itex(src: string): string {
  return tex(src, false);
}
