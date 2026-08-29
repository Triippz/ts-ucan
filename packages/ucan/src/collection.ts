/**
 * Collection types for Ipld values.
 */

import type { Ipld } from "./ipld.js";

export type Collection =
  | { kind: "array"; values: Ipld[] }
  | { kind: "map"; values: Map<string, Ipld> };

/**
 * Convert Collection to array of values.
 *
 * Returns array elements for array collections,
 * or map values for map collections.
 */
export function collectionToVec(c: Collection): Ipld[] {
  if (c.kind === "array") {
    return c.values;
  }
  return Array.from(c.values.values());
}

/**
 * Check if collection is empty.
 */
export function collectionIsEmpty(c: Collection): boolean {
  if (c.kind === "array") {
    return c.values.length === 0;
  }
  return c.values.size === 0;
}

/**
 * Convert Collection to Ipld (untagged From-impl form).
 */
export function collectionToIpld(c: Collection): Ipld {
  if (c.kind === "array") {
    return c.values;
  }
  return c.values;
}

/**
 * Convert Collection to wire Ipld (externally tagged).
 *
 * Rust derives serde with external tags for the enum:
 * Array → {"Array": [...]}
 * Map → {"Map": {...}}
 */
export function collectionToWireIpld(c: Collection): Ipld {
  if (c.kind === "array") {
    return new Map([["Array", c.values]]);
  }
  return new Map([["Map", c.values]]);
}

/**
 * Convert wire Ipld to Collection.
 */
export function wireIpldToCollection(i: Ipld): Collection {
  if (!(i instanceof Map) || i.size !== 1) {
    throw new Error("Expected Collection wire format");
  }

  for (const [key, value] of i) {
    if (key === "Array" && Array.isArray(value)) {
      return { kind: "array", values: value };
    }
    if (key === "Map" && value instanceof Map) {
      return { kind: "map", values: value };
    }
  }

  throw new Error("Expected Collection wire format");
}

/**
 * Create Collection from iterable of Ipld values.
 *
 * Implements FromIterator semantics from Rust:
 * - If we see a Map value, merge it and return a Map
 * - Otherwise, return an array with the first non-map element
 * - If all are maps, merge them into one Map
 */
export function collectionFromIterable(iter: Iterable<Ipld>): Collection {
  const map = new Map<string, Ipld>();

  for (const item of iter) {
    if (item instanceof Map) {
      for (const [k, v] of item) {
        map.set(k, v);
      }
    } else {
      return { kind: "array", values: [item] };
    }
  }

  return { kind: "map", values: map };
}
