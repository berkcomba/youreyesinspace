#!/usr/bin/env node
/**
 * i18n key extraction & dictionary check.
 *
 *   node scripts/i18n-check.mjs            → report missing / unused keys per locale
 *   node scripts/i18n-check.mjs --dump     → print all source keys (JSON array) to stdout
 *   node scripts/i18n-check.mjs --missing en → print keys missing from en.json (JSON object, key: "")
 *
 * Source strings are Turkish. Keys are collected from:
 *   - `_('…')` calls in src/**\/*.ts
 *   - `rows.push(['label', 'value'])` info-grid rows (labels and literal values)
 *   - display fields in data files (name/summary/description/desc/tagline/label/title/note/group/credit/
 *     hyperLabel/hostName/text) and `facts: { 'k': 'v' }` objects
 *   - label tables (TYPE_LABELS, CLASS_LABEL, LUM_CLASS_DESC, LANDMARK_KIND_LABEL, GALAXY_TYPE_LABEL)
 *   - `data-i18n*` attributes in index.html
 */
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const SRC = join(ROOT, 'src');
const LOCALES = ['en', 'de', 'es', 'fr'];

/* ------------------------------------------------------------------ helpers */

function walk(dir, out = []) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith('.ts') && !p.includes('/i18n/')) out.push(p);
  }
  return out;
}

/**
 * Skip a template literal body starting right after the opening backtick; `${…}` expressions are
 * scanned recursively so string literals inside them are still collected.
 */
function skipTemplate(code, i, out) {
  const n = code.length;
  while (i < n) {
    if (code[i] === '\\') { i += 2; continue; }
    if (code[i] === '`') return i + 1;
    if (code[i] === '$' && code[i + 1] === '{') {
      i = scan(code, i + 2, out, true);
      continue;
    }
    i++;
  }
  return n;
}

/** All plain string literals ('…' / "…") with their offset, skipping comments, regex literals and template text. */
function literals(code) {
  const out = [];
  scan(code, 0, out, false);
  return out;
}

/** scan code from i; when `inExpr`, stop after the `}` that closes the enclosing `${` and return the index after it */
function scan(code, i, out, inExpr) {
  const n = code.length;
  let depth = 0;
  while (i < n) {
    const c = code[i];
    if (c === '/' && code[i + 1] === '/') { while (i < n && code[i] !== '\n') i++; continue; }
    if (c === '/' && code[i + 1] === '*') { const e = code.indexOf('*/', i + 2); i = e < 0 ? n : e + 2; continue; }
    if (c === '/') { // regex literal? (heuristic: follows an operator / opening bracket)
      let k = i - 1;
      while (k >= 0 && (code[k] === ' ' || code[k] === '\t')) k--;
      const prev = k >= 0 ? code[k] : '(';
      if ('(,=:[!&|?{};\n'.includes(prev) || code.slice(Math.max(0, k - 5), k + 1).match(/return$/)) {
        i++;
        let inClass = false;
        while (i < n && code[i] !== '\n') {
          if (code[i] === '\\') { i += 2; continue; }
          if (code[i] === '[') inClass = true;
          else if (code[i] === ']') inClass = false;
          else if (code[i] === '/' && !inClass) { i++; break; }
          i++;
        }
        while (i < n && /[a-z]/.test(code[i])) i++; // flags
        continue;
      }
    }
    if (c === '`') { i = skipTemplate(code, i + 1, out); continue; }
    if (inExpr) {
      if (c === '{') depth++;
      else if (c === '}') { if (depth === 0) return i + 1; depth--; }
    }
    if (c === "'" || c === '"') {
      const start = i;
      const q = c;
      i++;
      let s = '';
      while (i < n && code[i] !== q) {
        if (code[i] === '\\') {
          const e = code[i + 1];
          s += e === 'n' ? '\n' : e === 't' ? '\t' : e;
          i += 2;
          continue;
        }
        if (code[i] === '\n') break;
        s += code[i++];
      }
      i++;
      out.push({ value: s, start, end: i });
      continue;
    }
    i++;
  }
  return n;
}

// two consecutive letters, or a Turkish-style percentage (`%78 N₂`) that needs locale reformatting
const hasWords = (s) => /\p{L}{2}/u.test(s) || /%\d/.test(s);
/** identifiers, paths, css selectors, urls, hex colours … are never keys */
function looksLikeText(s) {
  if (!hasWords(s)) return false;
  if (/^[a-z0-9_.:/#-]+$/.test(s)) return false; // ids, paths, css classes, data keys (all lower-case, no spaces)
  if (/^https?:/.test(s) || s.startsWith('#') || s.startsWith('/') || s.includes('://')) return false;
  if (/^[A-Z][A-Za-z0-9]*[a-z]+[A-Z]\w*$/.test(s)) return false; // CamelCase identifiers
  return true;
}

/* ------------------------------------------------------------------ TS sources */

const DATA_FILE = /\/src\/(data\/|galaxy\/galaxies\.ts|ui\/places\.ts|ui\/UI\.ts|gen\/SystemGenerator\.ts|astro\/stellar\.ts|ui\/format\.ts|ui\/MissionPanel\.ts)/;
const FIELD_RE = /(?:^|[\s,{(])(name|summary|description|desc|tagline|label|title|note|group|credit|hyperLabel|hostName|text)\s*:\s*$/;
const TABLE_NAMES = ['TYPE_LABELS', 'CLASS_LABEL', 'LUM_CLASS_DESC', 'LANDMARK_KIND_LABEL', 'GALAXY_TYPE_LABEL', 'LETTERS_TR'];

const keys = new Map(); // key -> Set(files)
const add = (k, file, force = false) => {
  if (!k || (!force && !looksLikeText(k))) return;
  if (force && !/\p{L}/u.test(k)) return;
  if (!keys.has(k)) keys.set(k, new Set());
  keys.get(k).add(relative(ROOT, file));
};

for (const file of walk(SRC)) {
  const code = readFileSync(file, 'utf8');
  const lits = literals(code);
  const isData = DATA_FILE.test(file);

  // regions: facts objects and label tables → every literal inside is a key
  const regions = [];
  const addRegion = (re) => {
    let m;
    while ((m = re.exec(code))) {
      const open = code.indexOf('{', m.index + m[0].length - 1);
      if (open < 0) continue;
      let depth = 0, j = open;
      for (; j < code.length; j++) { if (code[j] === '{') depth++; else if (code[j] === '}') { depth--; if (depth === 0) break; } }
      regions.push([open, j]);
    }
  };
  addRegion(/\bfacts\s*:\s*\{/g);
  for (const t of TABLE_NAMES) addRegion(new RegExp(`\\b${t}\\b[^=\\n]*=\\s*\\{`, 'g'));
  const inRegion = (pos) => regions.some(([a, b]) => pos > a && pos < b);

  for (let idx = 0; idx < lits.length; idx++) {
    const { value, start } = lits[idx];
    const before = code.slice(Math.max(0, start - 60), start);
    // _('…')  /  _("…")
    if (/(?:^|[^\w$])_\(\s*$/.test(before)) { add(value, file, true); continue; }
    // rows.push(['label', 'value'])   (labels in every file, literal values too)
    if (/rows\.push\(\[\s*$/.test(before)) {
      add(value, file);
      // every text-like literal up to the closing `])` (plain value, or ternary / `??` branches)
      const close = code.indexOf('])', lits[idx].end);
      for (let k = idx + 1; k < lits.length && close >= 0 && lits[k].start < close; k++) add(lits[k].value, file);
      continue;
    }
    if (/\[\s*_\([^)]*\)\s*,\s*$/.test(before) && /rows\.push/.test(code.slice(Math.max(0, start - 120), start))) { add(value, file); continue; }
    if (inRegion(start)) { add(value, file); continue; }
    if (isData && FIELD_RE.test(before)) { add(value, file); continue; }
  }
}

/* ------------------------------------------------------------------ index.html */

const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
const norm = (s) => s.replace(/\s+/g, ' ').trim();
const decode = (s) => s.replace(/&nbsp;/g, '\u00a0').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
let m;
const reText = /<(\w+)([^>]*)\sdata-i18n(?:="")?(?=[\s>])[^>]*>([^<]*)<\/\1>/g;
while ((m = reText.exec(html))) add(norm(decode(m[3])), 'index.html', true);
// implicit key: `data-i18n-x title="…"`; explicit key (English static content): `data-i18n-x="<Turkish key>" …`
const reAttr = /data-i18n-(title|placeholder|content)(?:="")?\s+(?:title|placeholder|content)="([^"]*)"/g;
while ((m = reAttr.exec(html))) add(decode(m[2]), 'index.html', true);
const reAttrKey = /data-i18n-(?:title|placeholder|content)="([^"]+)"/g;
while ((m = reAttrKey.exec(html))) add(decode(m[1]), 'index.html', true);
// title set from main.ts via _(); meta/og handled above

/* ------------------------------------------------------------------ report */

const allKeys = Array.from(keys.keys()).sort((a, b) => a.localeCompare(b, 'tr'));
const args = process.argv.slice(2);

if (args[0] === '--dump') {
  console.log(JSON.stringify(allKeys, null, 2));
  process.exit(0);
}

const LOC_DIR = join(SRC, 'i18n', 'locales');
/** proper names / designations that are identical in every language (never translated) */
const NAMES = new Set(existsSync(join(LOC_DIR, 'names.json')) ? JSON.parse(readFileSync(join(LOC_DIR, 'names.json'), 'utf8')) : []);

/** merged dictionary of locales/<code>/*.json (null when the folder is missing) */
function loadDict(code) {
  const dir = join(LOC_DIR, code);
  if (!existsSync(dir)) return null;
  const d = {};
  for (const f of readdirSync(dir).filter((f) => f.endsWith('.json')).sort()) {
    const part = JSON.parse(readFileSync(join(dir, f), 'utf8'));
    for (const [k, v] of Object.entries(part)) {
      if (k in d) console.warn(`  ${code}/${f}: duplicate key "${k}"`);
      d[k] = v;
    }
  }
  return d;
}

if (args[0] === '--missing') {
  const d = loadDict(args[1]) ?? {};
  const out = {};
  for (const k of allKeys) if (!(k in d) && !NAMES.has(k)) out[k] = '';
  console.log(JSON.stringify(out, null, 2));
  process.exit(0);
}

let fail = false;
console.log(`${allKeys.length} source keys (${NAMES.size} untranslated names)`);
const unusedNames = Array.from(NAMES).filter((k) => !keys.has(k));
if (unusedNames.length) console.log(`  names.json: ${unusedNames.length} unused: ${unusedNames.join(' | ')}`);
for (const code of LOCALES) {
  const d = loadDict(code);
  if (!d) { console.log(`  ${code}: dictionary missing`); fail = true; continue; }
  const missing = allKeys.filter((k) => !(k in d) && !NAMES.has(k));
  const unused = Object.keys(d).filter((k) => !keys.has(k));
  const empty = Object.entries(d).filter(([, v]) => !v).map(([k]) => k);
  // placeholder parity
  const badParams = [];
  for (const [k, v] of Object.entries(d)) {
    const a = (k.match(/\{\w+\}/g) ?? []).sort().join(',');
    const b = (v.match(/\{\w+\}/g) ?? []).sort().join(',');
    if (a !== b) badParams.push(k);
  }
  console.log(`  ${code}: ${Object.keys(d).length} entries · missing ${missing.length} · unused ${unused.length} · empty ${empty.length} · placeholder mismatch ${badParams.length}`);
  if (args.includes('-v')) {
    for (const k of missing) console.log(`    - ${k}   [${Array.from(keys.get(k)).join(', ')}]`);
    for (const k of unused) console.log(`    ~ ${k}`);
    for (const k of badParams) console.log(`    ! ${k}`);
  }
  if (missing.length || empty.length || badParams.length) fail = true;
}
process.exit(fail ? 1 : 0);
