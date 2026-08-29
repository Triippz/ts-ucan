import type { CID } from "multiformats/cid";

/**
 * IPLD data model type.
 *
 * Mirrors `ipld_core::ipld::Ipld` and `@ipld/dag-cbor`'s decoded shape.
 * Integers: `number` when |x| <= Number.MAX_SAFE_INTEGER, `bigint` otherwise
 * (this is what `@ipld/dag-cbor` produces). Maps are ES `Map<string, Ipld>`.
 */
export type Ipld =
  | null
  | boolean
  | number
  | bigint
  | string
  | Uint8Array
  | CID
  | Ipld[]
  | Map<string, Ipld>;