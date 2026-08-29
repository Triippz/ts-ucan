/**
 * Policy predicates.
 *
 * Port of predicate.rs.
 */

import type { Ipld } from "../../ipld.js";
import type { UcanNumber } from "../../number.js";
import type { Collection } from "../../collection.js";
import { ipldEquals, objectsToMaps } from "../../ipld.js";
import { numberCompare } from "../../number.js";
import { collectionToVec, collectionIsEmpty } from "../../collection.js";
import { Select, SelectorError } from "./selector/select.js";
import { selectIpld, selectNumber, selectString, selectCollection } from "./selector/selectable.js";

/**
 * Validator for Ipld values.
 *
 * Port of Predicate enum.
 */
export type Predicate =
  | { kind: "equal"; select: Select<Ipld>; value: Ipld }
  | { kind: "greaterThan"; select: Select<UcanNumber>; value: UcanNumber }
  | { kind: "greaterThanOrEqual"; select: Select<UcanNumber>; value: UcanNumber }
  | { kind: "lessThan"; select: Select<UcanNumber>; value: UcanNumber }
  | { kind: "lessThanOrEqual"; select: Select<UcanNumber>; value: UcanNumber }
  | { kind: "like"; select: Select<string>; pattern: string }
  | { kind: "not"; inner: Predicate }
  | { kind: "and"; inner: Predicate[] }
  | { kind: "or"; inner: Predicate[] }
  | { kind: "all"; select: Select<Collection>; inner: Predicate }
  | { kind: "any"; select: Select<Collection>; inner: Predicate };

// ═══════════════════════════════════════════════════════════════════════
// runPredicate
// ═══════════════════════════════════════════════════════════════════════

/**
 * Run the predicate against concrete data.
 *
 * Port of Predicate::run.
 * Throws RunError if the predicate cannot be evaluated.
 */
export function runPredicate(p: Predicate, data: Ipld): boolean {
  switch (p.kind) {
    case "equal": {
      let focused: Ipld;
      try {
        focused = p.select.get(data);
      } catch (e) {
        if (e instanceof SelectorError) {
          // selectorError →적인 RunError
          throw new RunError("selectorError", e);
        }
        throw e;
      }
      // int↔whole-float coercion
      if ((typeof focused === "number" && typeof p.value === "bigint") ||
          (typeof focused === "bigint" && typeof p.value === "number")) {
        const floatVal = typeof focused === "number" ? focused : (p.value as number);
        const intVal = typeof focused === "number" ? (p.value as bigint) : (focused as bigint);
        if (!Number.isNaN(floatVal) && Number.isFinite(floatVal) && floatVal % 1 === 0) {
          return BigInt(Math.trunc(floatVal)) === intVal;
        }
        throw new RunError("cannotCompareNonwholeFloatToInt");
      }
      return ipldEquals(focused, p.value);
    }

    case "greaterThan": {
      const focused = getNumber(p.select, data);
      return numberCompare(focused, p.value) === 1;
    }

    case "greaterThanOrEqual": {
      const focused = getNumber(p.select, data);
      const cmp = numberCompare(focused, p.value);
      return cmp === 1 || cmp === 0;
    }

    case "lessThan": {
      const focused = getNumber(p.select, data);
      return numberCompare(focused, p.value) === -1;
    }

    case "lessThanOrEqual": {
      const focused = getNumber(p.select, data);
      const cmp = numberCompare(focused, p.value);
      return cmp === -1 || cmp === 0;
    }

    case "like": {
      const focused = getString(p.select, data);
      return glob(focused, p.pattern);
    }

    case "not":
      return !runPredicate(p.inner, data);

    case "and":
      return p.inner.reduce((acc: boolean, pred) => acc && runPredicate(pred, data), true);

    case "or": {
      if (p.inner.length === 0) return true;
      return p.inner.reduce((acc: boolean, pred) => acc || runPredicate(pred, data), false);
    }

    case "all": {
      const focus = getCollection(p.select, data);
      return collectionToVec(focus).reduce((acc: boolean, each) => acc && runPredicate(p.inner, each), true);
    }

    case "any": {
      const focus = getCollection(p.select, data);
      if (collectionIsEmpty(focus)) return true;
      return collectionToVec(focus).reduce((acc: boolean, each) => acc || runPredicate(p.inner, each), false);
    }
  }
}

function getNumber(sel: Select<UcanNumber>, data: Ipld): UcanNumber {
  try {
    return sel.get(data);
  } catch (e) {
    if (e instanceof SelectorError) throw new RunError("selectorError", e);
    throw e;
  }
}

function getString(sel: Select<string>, data: Ipld): string {
  try {
    return sel.get(data);
  } catch (e) {
    if (e instanceof SelectorError) throw new RunError("selectorError", e);
    throw e;
  }
}

function getCollection(sel: Select<Collection>, data: Ipld): Collection {
  try {
    return sel.get(data);
  } catch (e) {
    if (e instanceof SelectorError) throw new RunError("selectorError", e);
    throw e;
  }
}

// ═══════════════════════════════════════════════════════════════════════
// glob
// ═══════════════════════════════════════════════════════════════════════

/**
 * Check if a string matches a glob pattern.
 *
 * Port of predicate::glob with exact escape and fold semantics.
 */
export function glob(input: string, pattern: string): boolean {
  if (pattern.length === 0) return input.length === 0;

  // Parse pattern into fragments separated by '*'
  const patterns: string[] = [];
  let working = "";
  let sawEscape = false;

  for (const c of pattern) {
    if (c === '*') {
      if (sawEscape) {
        working += '*';
      } else {
        patterns.push(working);
        working = "";
      }
      sawEscape = false;
    } else if (c === '\\') {
      if (sawEscape) {
        working += '\\';
      }
      sawEscape = true;
    } else {
      if (sawEscape) {
        working += '\\';
      }
      working += c;
      sawEscape = false;
    }
  }

  if (sawEscape) {
    working += '\\';
  }
  patterns.push(working);

  // Test input against the pattern
  let remaining = input;
  for (let idx = 0; idx < patterns.length; idx++) {
    const frag = patterns[idx];
    const pos = remaining.indexOf(frag);

    if (pos === -1) return false;

    const pre = remaining.slice(0, pos);
    const post = remaining.slice(pos + frag.length);

    if (idx === 0 && !pattern.startsWith('*') && pre.length > 0) return false;
    if (idx === patterns.length - 1 && !pattern.endsWith('*') && post.length > 0) return false;

    remaining = post;
  }

  return true;
}

// ═══════════════════════════════════════════════════════════════════════
// predicateToIpld (From<Predicate> for Ipld)
// ═══════════════════════════════════════════════════════════════════════

/**
 * Convert Predicate to Ipld (string-selector triple form).
 *
 * Port of `From<Predicate> for Ipld`.
 */
export function predicateToIpld(p: Predicate): Ipld {
  switch (p.kind) {
    case "equal":
      return ["==", p.select.toIpld(), p.value];
    case "greaterThan":
      return [">", p.select.toIpld(), numberToIpldLocal(p.value)];
    case "greaterThanOrEqual":
      return [">=", p.select.toIpld(), numberToIpldLocal(p.value)];
    case "lessThan":
      return ["<", p.select.toIpld(), numberToIpldLocal(p.value)];
    case "lessThanOrEqual":
      return ["<=", p.select.toIpld(), numberToIpldLocal(p.value)];
    case "like":
      return ["like", p.select.toIpld(), p.pattern];
    case "not": {
      if (p.inner.kind === "equal") {
        return ["!=", p.inner.select.toIpld(), p.inner.value];
      }
      return ["not", predicateToIpld(p.inner)];
    }
    case "and":
      return ["and", p.inner.map(predicateToIpld)];
    case "or":
      return ["or", p.inner.map(predicateToIpld)];
    case "all":
      return ["all", p.select.toIpld(), predicateToIpld(p.inner)];
    case "any":
      return ["any", p.select.toIpld(), predicateToIpld(p.inner)];
  }
}

/** Wire form: Number → its value (integer or float). */
function numberToIpldLocal(n: UcanNumber): Ipld {
  return n.value;
}

// ═══════════════════════════════════════════════════════════════════════
// ipldToPredicate (TryFrom<Ipld> for Predicate)
// ═══════════════════════════════════════════════════════════════════════

/**
 * Convert Ipld to Predicate.
 *
 * Port of TryFrom<Ipld> for Predicate.
 * Accepts both wire form (tagged tuples) and string-selector triple form.
 * Throws FromIpldError on failure.
 */
export function ipldToPredicate(i: Ipld): Predicate {
  // Normalize plain objects to Maps (JSON imports may not have been through DAG-JSON)
  i = objectsToMaps(i);
  if (!Array.isArray(i)) throw new FromIpldError("notATuple", String(i));

  const arr = i as Ipld[];
  if (arr.length === 0) throw new FromIpldError("unrecognizedShape");

  if (arr.length === 2 && typeof arr[0] === "string") {
    const tag = arr[0];
    if (tag === "not") {
      const inner = ipldToPredicate(arr[1]);
      return { kind: "not", inner };
    }
    if (tag === "and" && Array.isArray(arr[1])) {
      return { kind: "and", inner: (arr[1] as Ipld[]).map(ipldToPredicate) };
    }
    if (tag === "or" && Array.isArray(arr[1])) {
      return { kind: "or", inner: (arr[1] as Ipld[]).map(ipldToPredicate) };
    }
    throw new FromIpldError("unrecognizedPairTag", tag);
  }

  if (arr.length >= 3 && typeof arr[0] === "string" && typeof arr[1] === "string") {
    const opStr = arr[0];
    const selStr = arr[1];
    const val = arr[2];

    switch (opStr) {
      case "==": {
        const sel = parseSelectIpld(selStr);
        return { kind: "equal", select: sel, value: val };
      }
      case "!=": {
        const sel = parseSelectIpld(selStr);
        return { kind: "not", inner: { kind: "equal", select: sel, value: val } };
      }
      case ">": {
        const sel = parseSelectNumber(selStr);
        const num = parseNumber(val);
        return { kind: "greaterThan", select: sel, value: num };
      }
      case ">=": {
        const sel = parseSelectNumber(selStr);
        const num = parseNumber(val);
        return { kind: "greaterThanOrEqual", select: sel, value: num };
      }
      case "<": {
        const sel = parseSelectNumber(selStr);
        const num = parseNumber(val);
        return { kind: "lessThan", select: sel, value: num };
      }
      case "<=": {
        const sel = parseSelectNumber(selStr);
        const num = parseNumber(val);
        return { kind: "lessThanOrEqual", select: sel, value: num };
      }
      case "like": {
        const sel = parseSelectString(selStr);
        if (typeof val !== "string") throw new FromIpldError("notAString", JSON.stringify(val));
        return { kind: "like", select: sel, pattern: val };
      }
      case "all": {
        const sel = parseSelectCollection(selStr);
        const inner = ipldToPredicate(val);
        return { kind: "all", select: sel, inner };
      }
      case "any": {
        const sel = parseSelectCollection(selStr);
        const inner = ipldToPredicate(val);
        return { kind: "any", select: sel, inner };
      }
      default:
        throw new FromIpldError("unrecognizedTripleTag", opStr);
    }
  }

  throw new FromIpldError("unrecognizedShape");
}

// ─── parse helpers (uses dynamic Select constructor) ──────────────────

function parseSelectIpld(selStr: string): Select<Ipld> {
  try {
    return createSelect(selStr, selectIpld);
  } catch (e: any) {
    throw new FromIpldError("invalidIpldSelector", e.message);
  }
}

function parseSelectNumber(selStr: string): Select<UcanNumber> {
  try {
    return createSelect(selStr, selectNumber);
  } catch (e: any) {
    throw new FromIpldError("invalidNumberSelector", e.message);
  }
}

function parseSelectString(selStr: string): Select<string> {
  try {
    return createSelect(selStr, selectString);
  } catch (e: any) {
    throw new FromIpldError("invalidStringSelector", e.message);
  }
}

function parseSelectCollection(selStr: string): Select<Collection> {
  try {
    return createSelect(selStr, selectCollection);
  } catch (e: any) {
    throw new FromIpldError("invalidCollectionSelector", e.message);
  }
}

function parseNumber(ipld: Ipld): UcanNumber {
  if (typeof ipld === "bigint") return { kind: "integer", value: ipld };
  if (typeof ipld === "number") return { kind: "float", value: ipld };
  throw new FromIpldError("cannotParseIpldNumber", JSON.stringify(ipld));
}

import { parseSelector } from "./selector/filter.js";

function createSelect<T>(selStr: string, selectable: (ipld: Ipld) => T): Select<T> {
  const filters = parseSelector(selStr);
  return new Select<T>(filters, selectable);
}

// ═══════════════════════════════════════════════════════════════════════
// Error types
// ═══════════════════════════════════════════════════════════════════════

/**
 * Runtime error from predicate evaluation.
 */
export class RunError extends Error {
  readonly reason: "cannotCompareNonwholeFloatToInt" | "cannotCompareNaNs" | "selectorError";

  constructor(reason: RunError["reason"], cause?: Error) {
    const msgs: Record<RunError["reason"], string> = {
      cannotCompareNonwholeFloatToInt: "cannot compare non-whole float to integer",
      cannotCompareNaNs: "cannot compare NaNs",
      selectorError: cause?.message ?? "selector error",
    };
    super(msgs[reason]);
    this.name = "RunError";
    this.reason = reason;
    if (cause) this.cause = cause;
  }
}

/**
 * Error converting from Ipld to Predicate.
 */
export class FromIpldError extends Error {
  readonly reason:
    | "invalidIpldSelector" | "invalidNumberSelector" | "invalidCollectionSelector"
    | "invalidStringSelector" | "cannotParseIpldNumber" | "notAString"
    | "unrecognizedPairTag" | "unrecognizedTripleTag" | "unrecognizedShape"
    | "notATuple";
  readonly detail?: string;

  constructor(reason: FromIpldError["reason"], detail?: string) {
    const msgs: Record<FromIpldError["reason"], string> = {
      invalidIpldSelector: `Invalid Ipld selector: ${detail ?? ""}`,
      invalidNumberSelector: `Invalid Number selector: ${detail ?? ""}`,
      invalidCollectionSelector: `Invalid Collection selector: ${detail ?? ""}`,
      invalidStringSelector: `Invalid String selector: ${detail ?? ""}`,
      cannotParseIpldNumber: `Cannot parse Number: ${detail ?? ""}`,
      notAString: `Not a string: ${detail ?? ""}`,
      unrecognizedPairTag: `Unrecognized pair tag: ${detail ?? ""}`,
      unrecognizedTripleTag: `Unrecognized triple tag: ${detail ?? ""}`,
      unrecognizedShape: "Unrecognized shape",
      notATuple: `Not a predicate tuple: ${detail ?? ""}`,
    };
    super(msgs[reason]);
    this.name = "FromIpldError";
    this.reason = reason;
    this.detail = detail;
  }
}