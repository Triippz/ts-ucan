/**
 * Selector — extract values from a data structure.
 *
 * Port of selector.rs.
 */

import type { Ipld } from "../../../ipld.js";
import type { Filter } from "./filter.js";
import { filterToString, filterIsDotField, parseSelector as _parseSelector } from "./filter.js";
import { SelectorError, ipldToSelectorError, selectorErrorToIpld } from "./select.js";

export { SelectorError, ipldToSelectorError, selectorErrorToIpld } from "./select.js";
export type { SelectorErrorReason } from "./error.js";

/**
 * Selector for extracting values from a data structure.
 *
 * Port of Selector(pub Vec<Filter>).
 */
export class Selector {
  readonly filters: Filter[];

  constructor(filters: Filter[] = []) {
    this.filters = filters;
  }

  /**
   * Create a new, empty selector (identity).
   */
  static new(): Selector {
    return new Selector([]);
  }

  /**
   * Check if two selectors are related (all filters match pairwise).
   */
  isRelated(other: Selector): boolean {
    const len = Math.min(this.filters.length, other.filters.length);
    for (let i = 0; i < len; i++) {
      if (!filtersEqual(this.filters[i], other.filters[i])) return false;
    }
    return true;
  }

  /**
   * Parses a Selector from a string.
   *
   * Port of Selector::from_str.
   * Throws ParseError on failure.
   */
  static fromString(s: string): Selector {
    return new Selector(_parseSelector(s));
  }

  /**
   * Serialize to Ipld (the string form).
   */
  toIpld(): Ipld {
    return this.toString();
  }

  /**
   * Deserialize from Ipld.
   */
  static fromIpld(i: Ipld): Selector {
    if (typeof i !== "string") throw new Error("expected string for Selector");
    return Selector.fromString(i);
  }

  /**
   * Display as a dot-separated selector string.
   *
   * Port of Display impl for Selector.
   */
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

  /**
   * Prefix ordering comparison.
   *
   * Port of PartialOrd for Selector.
   */
  compare(other: Selector): -1 | 0 | 1 | null {
    const a = this.filters;
    const b = other.filters;
    if (a.length === b.length && a.every((f, i) => filtersEqual(f, b[i]))) return 0;
    if (startsWith(b, a)) return -1; // self is prefix of other → Less
    if (startsWith(a, b)) return 1;  // other is prefix of self → Greater
    return null;
  }
}

// Re-export parseSelector for use by Select<T>.fromString
export { _parseSelector as parseSelector };

function filtersEqual(a: Filter, b: Filter): boolean {
  if (a.kind !== b.kind) return false;
  switch (a.kind) {
    case "arrayIndex": return a.index === (b as typeof a).index;
    case "field": return a.key === (b as typeof a).key;
    case "slice": return a.start === (b as typeof a).start && a.end === (b as typeof a).end;
    case "values": return true;
    case "try": return filtersEqual(a.inner, (b as typeof a).inner);
  }
}

function startsWith(haystack: Filter[], needle: Filter[]): boolean {
  if (needle.length > haystack.length) return false;
  return needle.every((f, i) => filtersEqual(haystack[i], f));
}