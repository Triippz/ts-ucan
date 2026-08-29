import { encode as dagCborEncode, decode as dagCborDecode } from "@ipld/dag-cbor";
import { encode as dagJsonEncode, decode as dagJsonDecode } from "@ipld/dag-json";
import type { Ipld } from "./ipld.js";

/** DAG-CBOR multicodec code. */
export const DAG_CBOR_CODE = 0x71;

/** DAG-JSON multicodec code. */
export const DAG_JSON_CODE = 0x0129;

/**
 * IPLD codec interface.
 *
 * Generalization of `libipld_core::codec::Codec` allowing runtime codec dispatch.
 * Payload is always `Ipld` (collapses the Rust `T` type parameter).
 */
export interface Codec {
  /** Multicodec code for this codec. */
  readonly multicodecCode: number;

  /** Encode an Ipld value to bytes. */
  encodePayload(payload: Ipld): Uint8Array;

  /** Decode bytes to an Ipld value. */
  decodePayload(bytes: Uint8Array): Ipld;
}

// ---------------------------------------------------------------------------
// DAG-CBOR singleton
// ---------------------------------------------------------------------------

class DagCborCodecImpl implements Codec {
  readonly multicodecCode = DAG_CBOR_CODE;

  encodePayload(payload: Ipld): Uint8Array {
    return dagCborEncode(payload);
  }

  decodePayload(bytes: Uint8Array): Ipld {
    return dagCborDecode(bytes) as Ipld;
  }
}

/** DAG-CBOR codec singleton. */
export const DagCborCodec: Codec = new DagCborCodecImpl();

// ---------------------------------------------------------------------------
// DAG-JSON singleton
// ---------------------------------------------------------------------------

class DagJsonCodecImpl implements Codec {
  readonly multicodecCode = DAG_JSON_CODE;

  encodePayload(payload: Ipld): Uint8Array {
    return dagJsonEncode(payload) as Uint8Array;
  }

  decodePayload(bytes: Uint8Array): Ipld {
    return dagJsonDecode(bytes) as Ipld;
  }
}

/** DAG-JSON codec singleton. */
export const DagJsonCodec: Codec = new DagJsonCodecImpl();

// ---------------------------------------------------------------------------
// Tag parsing
// ---------------------------------------------------------------------------

/**
 * Create a codec from a slice of tags.
 *
 * Throws if the tag slice does not contain exactly one known multicodec code.
 */
export function codecFromTags(tags: number[]): Codec {
  if (tags.length !== 1) {
    throw new Error("unable to create codec from tags");
  }
  const code = tags[0];
  if (code === DAG_CBOR_CODE) return DagCborCodec;
  if (code === DAG_JSON_CODE) return DagJsonCodec;
  throw new Error("unable to create codec from tags");
}