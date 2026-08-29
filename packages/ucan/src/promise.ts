/**
 * Distributed promises.
 *
 * Promise<T, E> is a union of ok/err/pending variants.
 * Promised is a recursive data structure with leaves as Ipld or promises.
 */

import { CID } from "multiformats/cid";
import type { Ipld } from "./ipld.js";

export type Promise_<T, E> =
  | { kind: "ok"; value: T }
  | { kind: "err"; error: E }
  | { kind: "pendingOk"; cid: CID }
  | { kind: "pendingErr"; cid: CID }
  | { kind: "pendingAny"; cid: CID }
  | { kind: "pendingTagged"; cid: CID };

export type Promised =
  | { kind: "null" }
  | { kind: "bool"; value: boolean }
  | { kind: "integer"; value: number | bigint }
  | { kind: "float"; value: number }
  | { kind: "string"; value: string }
  | { kind: "bytes"; value: Uint8Array }
  | { kind: "link"; cid: CID }
  | { kind: "waitOk"; cid: CID }
  | { kind: "waitErr"; cid: CID }
  | { kind: "waitAny"; cid: CID }
  | { kind: "list"; values: Promised[] }
  | { kind: "map"; values: Map<string, Promised> };

/**
 * Convert Promised to Ipld (From-impl, plain form).
 *
 * Throws WaitingOnError if the value contains a Wait* variant.
 */
export function promisedToIpld(p: Promised): Ipld {
  switch (p.kind) {
    case "null":
      return null;
    case "bool":
      return p.value;
    case "integer":
      return p.value;
    case "float":
      return p.value;
    case "string":
      return p.value;
    case "bytes":
      return p.value;
    case "link":
      return p.cid;
    case "waitOk":
      throw new WaitingOnError("waitOk", p.cid);
    case "waitErr":
      throw new WaitingOnError("waitErr", p.cid);
    case "waitAny":
      throw new WaitingOnError("waitAny", p.cid);
    case "list": {
      const resolved = [];
      for (const item of p.values) {
        resolved.push(promisedToIpld(item));
      }
      return resolved;
    }
    case "map": {
      const resolved = new Map<string, Ipld>();
      for (const [k, v] of p.values) {
        resolved.set(k, promisedToIpld(v));
      }
      return resolved;
    }
  }
}

/**
 * Convert Ipld to Promised.
 */
export function ipldToPromised(i: Ipld): Promised {
  if (i === null) {
    return { kind: "null" };
  }
  if (typeof i === "boolean") {
    return { kind: "bool", value: i };
  }
  if (typeof i === "number") {
    // Heuristic: if integer, store as integer; else float
    if (Number.isInteger(i)) {
      return { kind: "integer", value: i };
    }
    return { kind: "float", value: i };
  }
  if (typeof i === "bigint") {
    return { kind: "integer", value: i };
  }
  if (typeof i === "string") {
    return { kind: "string", value: i };
  }
  if (i instanceof Uint8Array) {
    return { kind: "bytes", value: i };
  }
  const asCid = CID.asCID(i);
  if (asCid) {
    return { kind: "link", cid: asCid };
  }
  if (Array.isArray(i)) {
    return { kind: "list", values: i.map(ipldToPromised) };
  }
  if (i instanceof Map) {
    const map = new Map<string, Promised>();
    for (const [k, v] of i) {
      map.set(k, ipldToPromised(v));
    }
    return { kind: "map", values: map };
  }

  throw new Error("Invalid Ipld for Promised conversion");
}

/**
 * Convert wire Ipld to Promise<T, E> (externally tagged).
 *
 * Each variant is tagged: {"Ok": value}, {"Err": error}, etc.
 */
export function wireIpldToPromise<T, E>(
  i: Ipld,
  ipldToT: (i: Ipld) => T,
  ipldToE: (i: Ipld) => E
): Promise_<T, E> {
  if (!(i instanceof Map) || i.size !== 1) {
    throw new Error("Expected Promise wire format");
  }

  for (const [key, value] of i) {
    switch (key) {
      case "Ok":
        return { kind: "ok", value: ipldToT(value) };
      case "Err":
        return { kind: "err", error: ipldToE(value) };
      case "PendingOk": {
        const cid = CID.asCID(value);
        if (cid) {
          return { kind: "pendingOk", cid };
        }
        break;
      }
      case "PendingErr": {
        const cid = CID.asCID(value);
        if (cid) {
          return { kind: "pendingErr", cid };
        }
        break;
      }
      case "PendingAny": {
        const cid = CID.asCID(value);
        if (cid) {
          return { kind: "pendingAny", cid };
        }
        break;
      }
      case "PendingTagged": {
        const cid = CID.asCID(value);
        if (cid) {
          return { kind: "pendingTagged", cid };
        }
        break;
      }
    }
  }

  throw new Error("Invalid Promise wire format");
}

/**
 * Convert Promise<T, E> to wire Ipld (externally tagged).
 *
 * Each variant is tagged: {"Ok": value}, etc.
 */
export function promiseToWireIpld<T, E>(
  p: Promise_<T, E>,
  tToIpld: (t: T) => Ipld,
  eToIpld: (e: E) => Ipld
): Ipld {
  switch (p.kind) {
    case "ok":
      return new Map<string, Ipld>([["Ok", tToIpld(p.value)]]);
    case "err":
      return new Map<string, Ipld>([["Err", eToIpld(p.error)]]);
    case "pendingOk":
      return new Map<string, Ipld>([["PendingOk", p.cid as any]]);
    case "pendingErr":
      return new Map<string, Ipld>([["PendingErr", p.cid as any]]);
    case "pendingAny":
      return new Map<string, Ipld>([["PendingAny", p.cid as any]]);
    case "pendingTagged":
      return new Map<string, Ipld>([["PendingTagged", p.cid as any]]);
  }
}

/**
 * Convert Promised to wire Ipld (externally tagged).
 *
 * Rust derives serde with external tags:
 * Null → "Null" (string, not a map)
 * Bool(true) → {"Bool": true}
 * WaitOk(cid) → {"WaitOk": cid}
 * etc.
 */
export function promisedToWireIpld(p: Promised): Ipld {
  switch (p.kind) {
    case "null":
      return "Null";
    case "bool":
      return new Map<string, Ipld>([["Bool", p.value as any]]);
    case "integer":
      return new Map<string, Ipld>([["Integer", p.value as any]]);
    case "float":
      return new Map<string, Ipld>([["Float", p.value]]);
    case "string":
      return new Map<string, Ipld>([["String", p.value]]);
    case "bytes":
      return new Map<string, Ipld>([["Bytes", p.value]]);
    case "link":
      return new Map<string, Ipld>([["Link", p.cid as any]]);
    case "waitOk":
      return new Map<string, Ipld>([["WaitOk", p.cid as any]]);
    case "waitErr":
      return new Map<string, Ipld>([["WaitErr", p.cid as any]]);
    case "waitAny":
      return new Map<string, Ipld>([["WaitAny", p.cid as any]]);
    case "list": {
      const wired = p.values.map(promisedToWireIpld);
      return new Map<string, Ipld>([["List", wired as any]]);
    }
    case "map": {
      const wired = new Map<string, Ipld>();
      for (const [k, v] of p.values) {
        wired.set(k, promisedToWireIpld(v));
      }
      return new Map<string, Ipld>([["Map", wired as any]]);
    }
  }
}

/**
 * Convert wire Ipld to Promised (externally tagged).
 *
 * Handles all variants, including the string "Null" for the unit variant.
 */
export function wireIpldToPromised(i: Ipld): Promised {
  if (i === "Null" || i === null) {
    return { kind: "null" };
  }

  if (!(i instanceof Map) || i.size !== 1) {
    throw new Error("Expected Promised wire format");
  }

  for (const [key, value] of i) {
    switch (key) {
      case "Bool":
        if (typeof value === "boolean") {
          return { kind: "bool", value };
        }
        break;
      case "Integer":
        if (typeof value === "number" || typeof value === "bigint") {
          return { kind: "integer", value };
        }
        break;
      case "Float":
        if (typeof value === "number") {
          return { kind: "float", value };
        }
        break;
      case "String":
        if (typeof value === "string") {
          return { kind: "string", value };
        }
        break;
      case "Bytes":
        if (value instanceof Uint8Array) {
          return { kind: "bytes", value };
        }
        break;
      case "Link": {
        const cid = CID.asCID(value);
        if (cid) {
          return { kind: "link", cid };
        }
        break;
      }
      case "WaitOk": {
        const cid = CID.asCID(value);
        if (cid) {
          return { kind: "waitOk", cid };
        }
        break;
      }
      case "WaitErr": {
        const cid = CID.asCID(value);
        if (cid) {
          return { kind: "waitErr", cid };
        }
        break;
      }
      case "WaitAny": {
        const cid = CID.asCID(value);
        if (cid) {
          return { kind: "waitAny", cid };
        }
        break;
      }
      case "List":
        if (Array.isArray(value)) {
          return { kind: "list", values: value.map(wireIpldToPromised) };
        }
        break;
      case "Map":
        if (value instanceof Map) {
          const map = new Map<string, Promised>();
          for (const [k, v] of value) {
            map.set(k, wireIpldToPromised(v));
          }
          return { kind: "map", values: map };
        }
        break;
    }
  }

  throw new Error("Invalid Promised wire format");
}

/**
 * Error thrown when trying to convert a waiting promise to Ipld.
 */
export class WaitingOnError extends Error {
  constructor(
    readonly reason: "waitOk" | "waitErr" | "waitAny",
    readonly cid: CID
  ) {
    const messages = {
      waitOk: "waiting on ok promise",
      waitErr: "waiting on err promise",
      waitAny: "waiting on any promise",
    };
    super(messages[reason]);
    this.name = "WaitingOnError";
  }
}
