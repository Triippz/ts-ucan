/**
 * The `Selectable` trait — types that can be selected from Ipld.
 *
 * Port of selector/selectable.rs.
 */

import type { Ipld } from "../../../ipld.js";
import type { UcanNumber } from "../../../number.js";
import type { Collection } from "../../../collection.js";
import type { SelectorErrorReason } from "./error.js";

/**
 * A function type for selecting a value of type T from Ipld.
 * Throws SelectorErrorReason if the shape doesn't match.
 */
export type Selectable<T> = (ipld: Ipld) => T;

/**
 * Select Ipld — identity.
 */
export function selectIpld(ipld: Ipld): Ipld {
  return ipld;
}

/**
 * Select UcanNumber from Ipld.
 *
 * Port of `impl Selectable for Number`.
 */
export function selectNumber(ipld: Ipld): UcanNumber {
  if (typeof ipld === "bigint") {
    return { kind: "integer", value: ipld };
  }
  if (typeof ipld === "number") {
    return { kind: "float", value: ipld };
  }
  throw "notANumber" as SelectorErrorReason;
}

/**
 * Select string from Ipld.
 *
 * Port of `impl Selectable for String`.
 */
export function selectString(ipld: Ipld): string {
  if (typeof ipld === "string") {
    return ipld;
  }
  throw "notAString" as SelectorErrorReason;
}

/**
 * Select Collection from Ipld.
 *
 * Port of `impl Selectable for Collection`.
 */
export function selectCollection(ipld: Ipld): Collection {
  if (Array.isArray(ipld)) {
    const values: Ipld[] = ipld.map((v) => selectIpld(v));
    return { kind: "array", values };
  }
  if (ipld instanceof Map) {
    const values = new Map<string, Ipld>();
    for (const [k, v] of ipld) {
      values.set(k, selectIpld(v));
    }
    return { kind: "map", values };
  }
  throw "notACollection" as SelectorErrorReason;
}