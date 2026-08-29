/**
 * CID helpers.
 */

import { CID } from "multiformats/cid";
import { sha256 } from "multiformats/hashes/sha2";
import type { Ipld } from "@marktripoli/varsig";
import { ipldToDagCbor } from "./ipld.js";

/**
 * Serialize a value to a DAG-CBOR/SHA2-256 CID (CIDv1).
 */
export function toDagCborCid(value: Ipld): CID {
  const bytes = ipldToDagCbor(value);
  const hash = sha256.digest(bytes) as any;
  return CID.create(1, 0x71, hash); // 0x71 = dag-cbor multicodec
}
