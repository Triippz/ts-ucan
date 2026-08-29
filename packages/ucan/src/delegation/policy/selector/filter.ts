/**
 * jq-inspired filters + Selector-level parser.
 *
 * Port of selector/filter.rs + the Selector::from_str parser logic.
 */

import type { Ipld } from "../../../ipld.js";
import { ParseError } from "./error.js";

export type Filter =
  | { kind: "arrayIndex"; index: number }
  | { kind: "field"; key: string }
  | { kind: "slice"; start: number | null; end: number | null }
  | { kind: "values" }
  | { kind: "try"; inner: Filter };

// ─── parseFilter (Filter::from_str) ────────────────────────────────────

/**
 * Parse a single filter from a string.
 *
 * Port of Filter::from_str (FromStr impl).
 * Rejects trailing input.
 */
export function parseFilter(s: string): Filter {
  const result = parse(s, 0);
  if (!result) throw new ParseError("unknownPattern", s);
  const [found, pos] = result;
  if (pos !== s.length) throw new ParseError("trailingInput", s.slice(pos));
  return found;
}

// ─── parseSelector (Selector::from_str) ────────────────────────────────

/**
 * Parse a full Selector string into a list of Filters.
 *
 * Port of Selector::from_str.
 */
export function parseSelector(s: string): Filter[] {
  if (!s.startsWith(".")) {
    throw new ParseError("missingStartingDot", s);
  }
  if (s.startsWith("..")) {
    throw new ParseError("startsWithDoubleDot", s);
  }

  const filters: Filter[] = [];
  let working: string;

  // Try to parse first filter as try-dot-field or dot-field
  const first = parseTryDotField(s, 0) ?? parseDotFieldOnly(s, 0);
  if (first) {
    filters.push(first[0]);
    working = s.slice(first[1]);
  } else {
    // skip leading '.' — bare dot selector
    working = s.slice(1);
  }

  // Strip leading '?' characters (silently consumed in Rust's preceded(many0(char('?')), ...))
  let stripPos = 0;
  while (stripPos < working.length && working.charCodeAt(stripPos) === 0x3f) stripPos++;
  working = working.slice(stripPos);

  // Parse remaining filters with many0(parse)
  if (working.length > 0) {
    const [remaining, restPos] = parseMany(working, 0);
    for (const f of remaining) filters.push(f);
    if (restPos !== working.length) {
      throw new ParseError("trailingInput", working.slice(restPos));
    }
  }

  return filters;
}

// ─── filterToString (Display impl) ─────────────────────────────────────

/** JSON-string-escape helper — mirrors Rust's write_json_string. */
function writeJsonString(s: string): string {
  let out = '"';
  for (let i = 0; i < s.length; i++) {
    const cp = s.codePointAt(i)!;
    if (cp > 0xffff) i++;
    switch (cp) {
      case 0x22: out += '\\"'; break;
      case 0x5c: out += "\\\\"; break;
      case 0x0a: out += "\\n"; break;
      case 0x0d: out += "\\r"; break;
      case 0x09: out += "\\t"; break;
      case 0x08: out += "\\b"; break;
      case 0x0c: out += "\\f"; break;
      default:
        if (cp < 0x20) out += "\\u" + cp.toString(16).toUpperCase().padStart(4, "0");
        else out += String.fromCodePoint(cp);
        break;
    }
  }
  out += '"';
  return out;
}

export function filterIsDotField(f: Filter): boolean {
  if (f.kind !== "field") return false;
  const k = f.key;
  if (k.length === 0) return false;
  const first = k.charCodeAt(0);
  if (!((first >= 65 && first <= 90) || (first >= 97 && first <= 122) || first === 0x5f)) return false;
  for (let i = 1; i < k.length; i++) {
    const c = k.charCodeAt(i);
    if (!((c >= 48 && c <= 57) || (c >= 65 && c <= 90) || (c >= 97 && c <= 122) || c === 0x5f)) return false;
  }
  return true;
}

export function filterToString(f: Filter): string {
  switch (f.kind) {
    case "arrayIndex": return `[${f.index}]`;
    case "slice": {
      const s = f.start !== null ? String(f.start) : "";
      const e = f.end !== null ? String(f.end) : "";
      return `[${s}:${e}]`;
    }
    case "field": {
      const dotOk = filterIsDotField(f) && !/[".\\\x00-\x1f]/.test(f.key);
      return dotOk ? `.${f.key}` : `[${writeJsonString(f.key)}]`;
    }
    case "values": return "[]";
    case "try": return `${filterToString(f.inner)}?`;
  }
}

// ─── filterIsIn ────────────────────────────────────────────────────────

export function filterIsIn(a: Filter, b: Filter): boolean {
  if (a.kind === "arrayIndex" && b.kind === "arrayIndex") return a.index === b.index;
  if (a.kind === "field" && b.kind === "field") return a.key === b.key;
  if (b.kind === "values" &&
    (a.kind === "values" || a.kind === "arrayIndex" || a.kind === "field" || a.kind === "slice")) return true;
  if (a.kind === "try" && b.kind === "try") return filterIsIn(a.inner, b.inner);
  return false;
}

// ─── IPLD wire format ──────────────────────────────────────────────────

export function filterToIpld(f: Filter): Ipld {
  switch (f.kind) {
    case "arrayIndex": return ["idx", f.index];
    case "field": return ["field", f.key];
    case "slice": return ["slice", f.start, f.end];
    case "values": return ["values"];
    case "try": return ["try", filterToIpld(f.inner)];
  }
}

export function ipldToFilter(i: Ipld): Filter {
  if (!Array.isArray(i) || i.length < 1 || typeof i[0] !== "string") {
    throw new Error("expected tagged sequence for Filter");
  }
  const tag = i[0];
  switch (tag) {
    case "idx": {
      if (i.length < 2 || typeof i[1] !== "number") throw new Error("missing index");
      return { kind: "arrayIndex", index: i[1] };
    }
    case "field": {
      if (i.length < 2 || typeof i[1] !== "string") throw new Error("missing field");
      return { kind: "field", key: i[1] };
    }
    case "slice": {
      const start = (i.length > 1 && i[1] !== null && typeof i[1] === "number") ? i[1] : null;
      const end = (i.length > 2 && i[2] !== null && typeof i[2] === "number") ? i[2] : null;
      return { kind: "slice", start, end };
    }
    case "values": return { kind: "values" };
    case "try": {
      if (i.length < 2) throw new Error("missing inner for try");
      return { kind: "try", inner: ipldToFilter(i[1]) };
    }
    default: throw new Error(`unknown filter tag: ${tag}`);
  }
}

// ═══════════════════════════════════════════════════════════════════════
// INTERNAL PARSER
// ═══════════════════════════════════════════════════════════════════════

type ParseResult<T> = [T, number] | null;

// ─── JSON string decoder ──────────────────────────────────────────────

function hex4(s: string, start: number): [number, number] {
  if (start + 4 > s.length) throw 1; // Eof
  let v = 0;
  for (let j = 0; j < 4; j++) {
    const b = s.charCodeAt(start + j);
    if (b >= 0x30 && b <= 0x39) v = (v << 4) | (b - 0x30);
    else if (b >= 0x61 && b <= 0x66) v = (v << 4) | (b - 0x61 + 10);
    else if (b >= 0x41 && b <= 0x46) v = (v << 4) | (b - 0x41 + 10);
    else throw 2; // BadUnicode
  }
  return [v, start + 4];
}

function decodeJsonStringLiteral(input: string, pos: number): [string, number] {
  if (pos >= input.length || input.charCodeAt(pos) !== 0x22) throw 0; // Expected('"')
  let i = pos + 1;
  let out = "";
  while (i < input.length) {
    const b = input.charCodeAt(i);
    if (b === 0x22) return [out, i + 1];
    if (b === 0x5c) { // backslash
      i++;
      if (i >= input.length) throw 1; // Eof
      switch (input.charCodeAt(i)) {
        case 0x22: out += '"'; i++; break;
        case 0x5c: out += '\\'; i++; break;
        case 0x2f: out += '/'; i++; break;
        case 0x62: out += '\b'; i++; break;
        case 0x66: out += '\f'; i++; break;
        case 0x6e: out += '\n'; i++; break;
        case 0x72: out += '\r'; i++; break;
        case 0x74: out += '\t'; i++; break;
        case 0x75: {
          const [cu1, next] = hex4(input, i + 1);
          if (cu1 >= 0xd800 && cu1 <= 0xdbff) {
            if (next + 2 > input.length || input.charCodeAt(next) !== 0x5c || input.charCodeAt(next + 1) !== 0x75) throw 2;
            const [cu2, next2] = hex4(input, next + 2);
            if (cu2 < 0xdc00 || cu2 > 0xdfff) throw 2;
            const hi = cu1 - 0xd800, lo = cu2 - 0xdc00;
            out += String.fromCodePoint(0x10000 + ((hi << 10) | lo));
            i = next2;
          } else if (cu1 >= 0xdc00 && cu1 <= 0xdfff) {
            throw 2;
          } else {
            out += String.fromCodePoint(cu1);
            i = next;
          }
          break;
        }
        default: throw 3; // BadEscape
      }
    } else {
      const cp = input.codePointAt(i);
      if (cp === undefined) throw 1;
      out += String.fromCodePoint(cp);
      i += cp > 0xffff ? 2 : 1;
    }
  }
  throw 1; // Eof
}

// ─── Character predicates ──────────────────────────────────────────────

const isAlpha = (c: number) => (c >= 65 && c <= 90) || (c >= 97 && c <= 122);
const isDigit = (c: number) => c >= 48 && c <= 57;
const isAlnum = (c: number) => isAlpha(c) || isDigit(c);
const isDotFieldChar = (c: number) => isAlnum(c) || c === 0x5f;

// ─── Int parsing ───────────────────────────────────────────────────────

function parseOptSignedInt(input: string, pos: number): [number | null, number] | null {
  let p = pos, neg = false;
  if (p < input.length && input.charCodeAt(p) === 0x2d) { neg = true; p++; }
  if (p >= input.length || !isDigit(input.charCodeAt(p))) {
    return neg ? null : [null, pos];
  }
  let val = 0;
  while (p < input.length && isDigit(input.charCodeAt(p))) {
    val = val * 10 + (input.charCodeAt(p) - 0x30);
    p++;
  }
  return [neg ? -val : val, p];
}

// ─── Filter parsers ────────────────────────────────────────────────────

function parseArrayIndex(input: string, pos: number): ParseResult<Filter> {
  if (pos >= input.length || input.charCodeAt(pos) !== 0x5b) return null;
  const r = parseOptSignedInt(input, pos + 1);
  if (!r || r[0] === null) return null;
  if (r[1] >= input.length || input.charCodeAt(r[1]) !== 0x5d) return null;
  return [{ kind: "arrayIndex", index: r[0] }, r[1] + 1];
}

function parseValues(input: string, pos: number): ParseResult<Filter> {
  return input.startsWith("[]", pos) ? [{ kind: "values" }, pos + 2] : null;
}

function parseSlice(input: string, pos: number): ParseResult<Filter> {
  if (pos >= input.length || input.charCodeAt(pos) !== 0x5b) return null;
  const sR = parseOptSignedInt(input, pos + 1);
  if (!sR) return null;
  const [start, p1] = sR;
  if (p1 >= input.length || input.charCodeAt(p1) !== 0x3a) return null;
  const eR = parseOptSignedInt(input, p1 + 1);
  if (!eR) return null;
  const [end, p2] = eR;
  if (p2 >= input.length || input.charCodeAt(p2) !== 0x5d) return null;
  return [{ kind: "slice", start, end }, p2 + 1];
}

function parseEmptyQuotesField(input: string, pos: number): ParseResult<Filter> {
  return input.startsWith('[""]', pos) ? [{ kind: "field", key: "" }, pos + 4] : null;
}

function parseDotAlphaField(input: string, pos: number): ParseResult<Filter> {
  if (pos >= input.length || input.charCodeAt(pos) !== 0x2e) return null;
  const p1 = pos + 1;
  if (p1 >= input.length) return null;
  const c1 = input.charCodeAt(p1);
  if (!(isAlpha(c1) || c1 === 0x5f)) return null;
  let p = p1 + 1;
  while (p < input.length && isDotFieldChar(input.charCodeAt(p))) p++;
  return [{ kind: "field", key: input.slice(p1, p) }, p];
}

function parseDotUnderscoreField(input: string, pos: number): ParseResult<Filter> {
  let p = tag("._", input, pos);
  if (p === null || p >= input.length || !isAlnum(input.charCodeAt(p))) return null;
  let start = p;
  while (p < input.length && isAlnum(input.charCodeAt(p))) p++;
  return [{ kind: "field", key: "_" + input.slice(start, p) }, p];
}

function parseDelimField(input: string, pos: number): ParseResult<Filter> {
  if (pos >= input.length || input.charCodeAt(pos) !== 0x5b) return null;
  try {
    const [decoded, afterQuote] = decodeJsonStringLiteral(input, pos + 1);
    if (afterQuote < input.length && input.charCodeAt(afterQuote) === 0x5d) {
      return [{ kind: "field", key: decoded }, afterQuote + 1];
    }
  } catch { /* fall through */ }
  return parseEmptyQuotesField(input, pos);
}

function parseField(input: string, pos: number): ParseResult<Filter> {
  return parseDelimField(input, pos) ?? parseDotAlphaField(input, pos) ?? parseDotUnderscoreField(input, pos);
}

function parseNonTry(input: string, pos: number): ParseResult<Filter> {
  return parseValues(input, pos) ?? parseSlice(input, pos)
    ?? parseField(input, pos) ?? parseArrayIndex(input, pos);
}

function parseTry(input: string, pos: number): ParseResult<Filter> {
  const inner = parseNonTry(input, pos);
  if (!inner) return null;
  const [found, p1] = inner;
  const afterQ = many1Q(input, p1);
  if (afterQ === null) return null;
  // Collapse nested Tries: if Try(Try(x)) -> Try(x)
  let work = found;
  if (work.kind === "try" && work.inner.kind === "try") work = work.inner.inner;
  return [{ kind: "try", inner: work }, afterQ];
}

function parse(input: string, pos: number): ParseResult<Filter> {
  return parseTry(input, pos) ?? parseNonTry(input, pos);
}

function parseMany(input: string, pos: number): [Filter[], number] {
  const filters: Filter[] = [];
  let p = pos;
  while (true) {
    const r = parse(input, p);
    if (!r) break;
    filters.push(r[0]);
    p = r[1];
  }
  return [filters, p];
}

// ─── Helpers ───────────────────────────────────────────────────────────

function tag(t: string, input: string, pos: number): number | null {
  return input.startsWith(t, pos) ? pos + t.length : null;
}

function many1Q(input: string, pos: number): number | null {
  if (pos >= input.length || input.charCodeAt(pos) !== 0x3f) return null;
  let p = pos;
  while (p < input.length && input.charCodeAt(p) === 0x3f) p++;
  return p;
}

function parseTryDotField(input: string, pos: number): ParseResult<Filter> {
  const inner = parseDotAlphaField(input, pos) ?? parseDotUnderscoreField(input, pos);
  if (!inner) return null;
  const [found, p1] = inner;
  const afterQ = many1Q(input, p1);
  if (afterQ === null) return null;
  return [{ kind: "try", inner: found }, afterQ];
}

// parse_dot_field for selector initial element (no try)
function parseDotFieldOnly(input: string, pos: number): ParseResult<Filter> {
  return parseDotAlphaField(input, pos) ?? parseDotUnderscoreField(input, pos);
}