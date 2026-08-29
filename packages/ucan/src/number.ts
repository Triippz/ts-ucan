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
  const aVal = a.kind === "float" ? a.value : a.value;
  const bVal = b.kind === "float" ? b.value : b.value;

  // Both floats
  if (a.kind === "float" && b.kind === "float") {
    if (Number.isNaN(aVal) || Number.isNaN(bVal)) return null;
    if (aVal < bVal) return -1;
    if (aVal > bVal) return 1;
    return 0;
  }

  // Both integers
  if (a.kind === "integer" && b.kind === "integer") {
    if (aVal < bVal) return -1;
    if (aVal > bVal) return 1;
    return 0;
  }

  // Float vs integer
  const floatVal = a.kind === "float" ? (aVal as number) : (bVal as number);
  const intVal = a.kind === "float" ? bVal : aVal;

  if (Number.isNaN(floatVal)) return null;

  // Check if integer exceeds f64 bounds
  const MAX_F64_AS_INT = BigInt("0x1FFFFFFFFFFFFF"); // 2^53 - 1
  const MIN_F64_AS_INT = -MAX_F64_AS_INT;

  const intBig = typeof intVal === "bigint" ? intVal : BigInt(intVal as number);

  if (intBig > MAX_F64_AS_INT) {
    return a.kind === "integer" ? 1 : -1;
  }
  if (intBig < MIN_F64_AS_INT) {
    return a.kind === "integer" ? -1 : 1;
  }

  // Safe to convert to f64
  const intAsFloat = Number(intBig);
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
