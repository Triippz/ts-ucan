/**
 * IPLD helpers and utilities.
 *
 * Re-exports the Ipld type from @marktripoli/varsig (the seam file per §5.1).
 */

export type { Ipld } from "@marktripoli/varsig";

import { CID } from "multiformats/cid";
import * as dagCbor from "@ipld/dag-cbor";
import * as dagJson from "@ipld/dag-json";
import type { Ipld } from "@marktripoli/varsig";

/**
 * Decode DAG-CBOR bytes into Ipld, converting objects to Map.
 */
export function ipldFromDagCbor(bytes: Uint8Array): Ipld {
  const decoded = dagCbor.decode(bytes);
  return objectsToMaps(decoded);
}

/**
 * Encode Ipld to DAG-CBOR bytes, converting Map to objects.
 *
 * @ipld/dag-cbor encodes maps as plain objects and decodes them back as objects,
 * but we use Map<string, Ipld> internally. This function converts before encoding.
 */
export function ipldToDagCbor(value: Ipld): Uint8Array {
  const prepared = mapsToObjects(value);
  return dagCbor.encode(prepared);
}

/**
 * Decode DAG-JSON bytes into Ipld, converting objects to Map.
 */
export function ipldFromDagJson(bytes: Uint8Array): Ipld {
  const decoded = dagJson.decode(bytes);
  return objectsToMaps(decoded);
}

/**
 * Encode Ipld to DAG-JSON bytes, converting Map to objects.
 */
export function ipldToDagJson(value: Ipld): Uint8Array {
  const prepared = mapsToObjects(value);
  return dagJson.encode(prepared);
}

/**
 * Deep equality check for Ipld values, handling bytes and CID aware.
 *
 * Treats number 1 === bigint 1n (both are integers).
 * NaN !== NaN (IEEE semantics).
 */
export function ipldEquals(a: Ipld, b: Ipld): boolean {
  if (a === b) return true;

  // Handle number vs bigint (both are integers)
  if (typeof a === "number" && typeof b === "bigint") {
    return Number.isSafeInteger(a) && BigInt(a) === b;
  }
  if (typeof a === "bigint" && typeof b === "number") {
    return Number.isSafeInteger(b) && a === BigInt(b);
  }

  if (typeof a !== "object" || typeof b !== "object") {
    return false;
  }

  if (a === null || b === null) {
    return a === b;
  }

  // Bytes
  if (a instanceof Uint8Array && b instanceof Uint8Array) {
    return bytesEqual(a, b);
  }

  // CID
  if (CID.asCID(a) && CID.asCID(b)) {
    return a.toString() === b.toString();
  }

  // Array
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((v, i) => ipldEquals(v, b[i]));
  }

  // Map
  if (a instanceof Map && b instanceof Map) {
    if (a.size !== b.size) return false;
    for (const [k, v] of a) {
      if (!b.has(k) || !ipldEquals(v, b.get(k)!)) return false;
    }
    return true;
  }

  return false;
}

/**
 * Byte equality check.
 */
export function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/**
 * Permissive equality for floats including NaN and Infinity (test helper).
 *
 * Ported from Rust's eq_with_float_nans_and_infinities.
 * Used in tests to compare Ipld values where NaN === NaN.
 */
export function ipldEqualsWithFloatNansAndInfinities(a: Ipld, b: Ipld): boolean {
  if (a === b) return true;

  // Handle number vs bigint (both are integers)
  if (typeof a === "number" && typeof b === "bigint") {
    return Number.isSafeInteger(a) && BigInt(a) === b;
  }
  if (typeof a === "bigint" && typeof b === "number") {
    return Number.isSafeInteger(b) && a === BigInt(b);
  }

  // Special case: NaN === NaN for testing; all infinities compare equal.
  if (typeof a === "number" && typeof b === "number") {
    if (Number.isNaN(a) && Number.isNaN(b)) return true;
    if (!Number.isFinite(a) && !Number.isFinite(b)) return true;
    return a === b;
  }

  if (typeof a !== "object" || typeof b !== "object") {
    return false;
  }

  if (a === null || b === null) {
    return a === b;
  }

  // Bytes
  if (a instanceof Uint8Array && b instanceof Uint8Array) {
    return bytesEqual(a, b);
  }

  // CID
  if (CID.asCID(a) && CID.asCID(b)) {
    return a.toString() === b.toString();
  }

  // Array
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((v, i) => ipldEqualsWithFloatNansAndInfinities(v, b[i]));
  }

  // Map
  if (a instanceof Map && b instanceof Map) {
    if (a.size !== b.size) return false;
    for (const [k, v] of a) {
      if (!b.has(k) || !ipldEqualsWithFloatNansAndInfinities(v, b.get(k)!)) return false;
    }
    return true;
  }

  return false;
}

/**
 * Convert plain objects to Map in decoded IPLD.
 *
 * @ipld/dag-cbor decodes maps as plain objects; we convert them to ES Map.
 */
export function objectsToMaps(value: any): Ipld {
  if (value === null || value === undefined) return null;
  if (typeof value !== "object") return value as Ipld;

  if (value instanceof Uint8Array || CID.asCID(value)) return value;
  if (Array.isArray(value)) {
    return value.map(objectsToMaps);
  }

  // Plain object → Map (with recursive conversion)
  const map = new Map<string, Ipld>();
  for (const [k, v] of Object.entries(value)) {
    map.set(k, objectsToMaps(v));
  }
  return map;
}

/**
 * Convert Map to plain objects for DAG-CBOR encoding.
 *
 * @ipld/dag-cbor encodes plain objects as maps; we convert Map back to objects.
 */
function mapsToObjects(value: Ipld): any {
  if (value === null || value === undefined) return value;
  if (typeof value !== "object") return value;

  if (value instanceof Uint8Array || CID.asCID(value)) return value;
  if (Array.isArray(value)) {
    return value.map(mapsToObjects);
  }

  if (value instanceof Map) {
    // Object.create(null): a plain {} would treat a map key of "__proto__"
    // (and other prototype members) as the special prototype setter, silently
    // dropping that argument on encode and desyncing the signed bytes from the
    // in-memory payload. A null-prototype object round-trips arbitrary string
    // keys faithfully.
    const obj: Record<string, any> = Object.create(null);
    for (const [k, v] of value) {
      obj[k] = mapsToObjects(v);
    }
    return obj;
  }

  return value;
}
