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
    const av = BigInt(a.value);
    const bv = BigInt(b.value);
    if (av < bv) return -1;
    if (av > bv) return 1;
    return 0;
  }

  const floatVal: number = a.kind === "float" ? a.value : (b.value as number);
  const intVal = BigInt(a.kind === "integer" ? a.value : b.value);

  if (Number.isNaN(floatVal)) return null;
  if (floatVal === Infinity) return a.kind === "float" ? 1 : -1;
  if (floatVal === -Infinity) return a.kind === "float" ? -1 : 1;

  // Compare exactly: converting a large bigint to f64 loses precision, so
  // 2^53 (float) would wrongly equal 2^53+1 (int). Split the float into its
  // integer floor and fractional remainder and compare against the bigint.
  const floor = Math.floor(floatVal);
  const floorInt = BigInt(floor);
  let cmp: -1 | 0 | 1;
  if (floorInt < intVal) cmp = -1;
  else if (floorInt > intVal) cmp = 1;
  else cmp = floatVal > floor ? 1 : 0; // equal floor: fractional part breaks the tie

  return a.kind === "float" ? cmp : (-cmp as -1 | 0 | 1);
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
