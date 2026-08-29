/**
 * Typesafe selection via Ipld selectors.
 *
 * Port of selector/select.rs.
 */

import type { Ipld } from "../../../ipld.js";
import type { Filter } from "./filter.js";
import type { Selectable } from "./selectable.js";
import type { SelectorErrorReason } from "./error.js";
import { filterToString, filterIsDotField, parseSelector } from "./filter.js";
import { selectIpld } from "./selectable.js";

// ─── SelectorError ─────────────────────────────────────────────────────

export class SelectorError extends Error {
  readonly selector: string;
  readonly reason: SelectorErrorReason;

  constructor(selector: string, reason: SelectorErrorReason) {
    super(`Selector ${selector} encountered runtime error: ${reason}`);
    this.name = "SelectorError";
    this.selector = selector;
    this.reason = reason;
  }

  static fromRefs(filters: Filter[], reason: SelectorErrorReason): SelectorError {
    const sel = filters.map(f => filterToString(f)).join("");
    const selector = (filters.length > 0 && !filterIsDotField(filters[0]))
      ? "." + sel : sel;
    return new SelectorError(selector, reason);
  }
}

export function selectorErrorToIpld(e: SelectorError): Map<string, Ipld> {
  const reasonWire = ({
    indexOutOfBounds: "IndexOutOfBounds",
    keyNotFound: "KeyNotFound",
    notAList: "NotAList",
    notAMap: "NotAMap",
    notACollection: "NotACollection",
    notANumber: "NotANumber",
    notAString: "NotAString",
  } as Record<SelectorErrorReason, string>)[e.reason];
  return new Map([["selector", e.selector], ["reason", reasonWire]]);
}

export function ipldToSelectorError(i: Ipld): SelectorError {
  if (!(i instanceof Map)) throw new Error("expected map for SelectorError");
  const sel = i.get("selector");
  const reason = i.get("reason");
  if (typeof sel !== "string" || typeof reason !== "string") throw new Error("invalid SelectorError format");
  const m: Record<string, SelectorErrorReason> = {
    IndexOutOfBounds: "indexOutOfBounds", KeyNotFound: "keyNotFound",
    NotAList: "notAList", NotAMap: "notAMap", NotACollection: "notACollection",
    NotANumber: "notANumber", NotAString: "notAString",
  };
  if (!(reason in m)) throw new Error(`unknown SelectorErrorReason: ${reason}`);
  return new SelectorError(sel, m[reason]);
}

// ─── Slice resolution ──────────────────────────────────────────────────

export function resolveSliceIndices(
  start: number | null, end: number | null, len: number,
): [number, number] {
  const resolve = (idx: number, len: number): number =>
    idx >= 0 ? Math.min(idx, len) : Math.max(0, len + idx);
  const s = start !== null ? resolve(start, len) : 0;
  const e = end !== null ? resolve(end, len) : len;
  return [s, Math.max(e, s)];
}

// ─── Select<T> ─────────────────────────────────────────────────────────

export class Select<T> {
  readonly filters: Filter[];
  private _selectable: Selectable<T>;

  constructor(filters: Filter[], selectable: Selectable<T>) {
    this.filters = filters;
    this._selectable = selectable;
  }

  get(ctx: Ipld): T {
    const seenOps: Filter[] = [];
    let isTry = false;
    let current: Ipld = ctx;

    for (const op of this.filters) {
      seenOps.push(op);

      if (op.kind === "try") {
        try {
          const innerSelect = new Select<Ipld>([op.inner], selectIpld);
          current = innerSelect.get(ctx);
        } catch {
          current = null as unknown as Ipld;
        }
        isTry = true;
        continue;
      }

      try {
        current = applyFilter(current, op, seenOps, isTry);
      } catch (e) {
        if (isTry && e instanceof SelectorError) {
          current = null as unknown as Ipld;
          break;
        }
        throw e;
      }
    }

    try {
      return this._selectable(current);
    } catch (e) {
      throw SelectorError.fromRefs(seenOps, e as SelectorErrorReason);
    }
  }

  isRelated<U>(other: Select<U>): boolean {
    const len = Math.min(this.filters.length, other.filters.length);
    for (let i = 0; i < len; i++) {
      if (!filterEquals(this.filters[i], other.filters[i])) return false;
    }
    return true;
  }

  toString(): string {
    if (this.filters.length === 0) return ".";
    let out = "";
    for (let i = 0; i < this.filters.length; i++) {
      const f = this.filters[i];
      if (i === 0) {
        if (!filterIsDotField(f)) out += ".";
        out += filterToString(f);
      } else {
        out += filterToString(f);
      }
    }
    return out;
  }

  static fromString<T>(s: string, selectable: Selectable<T>): Select<T> {
    return new Select(parseSelector(s), selectable);
  }

  compare(other: Select<T>): -1 | 0 | 1 | null {
    const a = this.filters, b = other.filters;
    if (a.length === b.length && a.every((f, i) => filterEquals(f, b[i]))) return 0;
    if (startsWithFilter(b, a)) return -1;
    if (startsWithFilter(a, b)) return 1;
    return null;
  }

  toIpld(): Ipld {
    return this.toString();
  }
}

// ─── Internal filter application ──────────────────────────────────────

function applyFilter(ipld: Ipld, op: Filter, seenOps: Filter[], _isTry: boolean): Ipld {
  switch (op.kind) {
    case "arrayIndex": {
      if (Array.isArray(ipld)) {
        const xs = ipld;
        if (xs.length > 0x7fffffff) throw SelectorError.fromRefs(seenOps, "indexOutOfBounds");
        const i = op.index;
        if (Math.abs(i) > xs.length) throw SelectorError.fromRefs(seenOps, "indexOutOfBounds");
        const idx = i >= 0 ? i : xs.length + i;
        if (idx < 0 || idx >= xs.length) throw SelectorError.fromRefs(seenOps, "indexOutOfBounds");
        return xs[idx];
      }
      if (ipld instanceof Uint8Array) {
        const bs = ipld;
        if (bs.length > 0x7fffffff) throw SelectorError.fromRefs(seenOps, "indexOutOfBounds");
        const i = op.index;
        if (Math.abs(i) > bs.length) throw SelectorError.fromRefs(seenOps, "indexOutOfBounds");
        const idx = i >= 0 ? i : bs.length + i;
        if (idx < 0 || idx >= bs.length) throw SelectorError.fromRefs(seenOps, "indexOutOfBounds");
        return BigInt(bs[idx]);
      }
      throw SelectorError.fromRefs(seenOps, "notAList");
    }
    case "field": {
      if (ipld instanceof Map) {
        if (!ipld.has(op.key)) throw SelectorError.fromRefs(seenOps, "keyNotFound");
        return ipld.get(op.key)!;
      }
      throw SelectorError.fromRefs(seenOps, "notAMap");
    }
    case "slice": {
      if (Array.isArray(ipld)) {
        const [s, e] = resolveSliceIndices(op.start, op.end, ipld.length);
        return ipld.slice(s, e);
      }
      if (ipld instanceof Uint8Array) {
        const [s, e] = resolveSliceIndices(op.start, op.end, ipld.length);
        return ipld.slice(s, e);
      }
      throw SelectorError.fromRefs(seenOps, "notAList");
    }
    case "values": {
      if (Array.isArray(ipld)) return ipld;
      if (ipld instanceof Map) return Array.from(ipld.values());
      throw SelectorError.fromRefs(seenOps, "notACollection");
    }
    default:
      throw SelectorError.fromRefs(seenOps, "keyNotFound");
  }
}

function filterEquals(a: Filter, b: Filter): boolean {
  if (a.kind !== b.kind) return false;
  switch (a.kind) {
    case "arrayIndex": return a.index === (b as typeof a).index;
    case "field": return a.key === (b as typeof a).key;
    case "slice": return a.start === (b as typeof a).start && a.end === (b as typeof a).end;
    case "values": return true;
    case "try": return filterEquals(a.inner, (b as typeof a).inner);
  }
}

function startsWithFilter(haystack: Filter[], needle: Filter[]): boolean {
  if (needle.length > haystack.length) return false;
  return needle.every((f, i) => filterEquals(haystack[i], f));
}