/**
 * IPLD numeric utilities.
 */

import type { Ipld } from "./ipld.js";

export type UcanNumber = 
  | { kind: "float"; value: number }
  | { kind: "integer"; value: number | bigint };

/**
 * Compare two numbers, accounting for mixed float/integer types.
 *
 * Uses IEEE-754 MAX/MIN bounds logic: if an integer exceeds f64::MAX,
 * it's greater than any float, and vice versa.
 *
 * Returns null if comparison is undefined (e.g., NaN).
 */
export function numberCompare(a: UcanNumber, b: UcanNumber): -1 | 0 | 1 | null {
  if (a.kind === "float" && b.kind === "float") {
    if (Number.isNaN(a.value) || Number.isNaN(b.value)) return null;
    if (a.value < b.value) return -1;
    if (a.value > b.value) return 1;
    return 0;
  }

  if (a.kind === "integer" && b.kind === "integer") {
    if (a.value < b.value) return -1;
    if (a.value > b.value) return 1;
    return 0;
  }

  const floatVal = a.kind === "float" ? a.value : b.value;
  const intVal = a.kind === "integer" ? a.value : b.value;

  if (Number.isNaN(floatVal)) return null;

  const intAsFloat = Number(intVal);
  if (floatVal < intAsFloat) return a.kind === "float" ? -1 : 1;
  if (floatVal > intAsFloat) return a.kind === "float" ? 1 : -1;
  return 0;
}

/**
 * Convert Ipld to UcanNumber.
 *
 * Throws NotANumberError if the value is not a number or bigint.
 */
export function numberFromIpld(ipld: Ipld): UcanNumber {
  if (typeof ipld === "number") {
    return { kind: "float", value: ipld };
  }
  if (typeof ipld === "bigint") {
    return { kind: "integer", value: ipld };
  }
  throw new NotANumberError();
}

/**
 * Convert UcanNumber to Ipld.
 */
export function numberToIpld(n: UcanNumber): Ipld {
  return n.value;
}

/**
 * Error thrown when a value cannot be converted to UcanNumber.
 */
export class NotANumberError extends Error {
  constructor() {
    super("expected Ipld numeric");
    this.name = "NotANumberError";
  }
}
