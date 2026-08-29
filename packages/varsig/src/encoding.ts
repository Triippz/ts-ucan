import type { Ipld } from "./ipld.js";
import type { Codec } from "./codec.js";
import {
  DAG_CBOR_CODE,
  DAG_JSON_CODE,
  DagCborCodec,
  DagJsonCodec,
} from "./codec.js";

/**
 * Runtime IPLD encoding enum.
 *
 * Each variant corresponds to a Rust `Encoding` enum variant.
 * JWT and EIP-191 throw `"not yet supported"` on encode/decode,
 * mirroring Rust's `unimplemented!`.
 */
export class Encoding implements Codec {
  readonly multicodecCode: number;

  private constructor(code: number) {
    this.multicodecCode = code;
  }

  static readonly DagCbor = new Encoding(DAG_CBOR_CODE);
  static readonly DagJson = new Encoding(DAG_JSON_CODE);

  /** JWT encoding — not yet supported. */
  static readonly Jwt = new Encoding(0x6a77);

  /** EIP-191 encoding — not yet supported. */
  static readonly Eip191 = new Encoding(0xe191);

  /**
   * Try to construct an `Encoding` from a slice of tags.
   *
   * Returns `null` if the tags do not describe a known encoding
   * (mirrors Rust `Codec::try_from_tags` returning `Option`).
   */
  static tryFromTags(tags: number[]): Encoding | null {
    if (tags.length !== 1) return null;
    switch (tags[0]) {
      case DAG_CBOR_CODE:
        return Encoding.DagCbor;
      case DAG_JSON_CODE:
        return Encoding.DagJson;
      case 0x6a77:
        return Encoding.Jwt;
      case 0xe191:
        return Encoding.Eip191;
      default:
        return null;
    }
  }

  encodePayload(payload: Ipld): Uint8Array {
    if (this === Encoding.DagCbor) return DagCborCodec.encodePayload(payload);
    if (this === Encoding.DagJson) return DagJsonCodec.encodePayload(payload);
    if (this === Encoding.Jwt) throw new Error("JWT encoding is not yet supported");
    if (this === Encoding.Eip191)
      throw new Error("EIP-191 encoding is not yet supported");
    throw new Error("unknown encoding");
  }

  decodePayload(bytes: Uint8Array): Ipld {
    if (this === Encoding.DagCbor) return DagCborCodec.decodePayload(bytes);
    if (this === Encoding.DagJson) return DagJsonCodec.decodePayload(bytes);
    if (this === Encoding.Jwt) throw new Error("JWT decoding is not yet supported");
    if (this === Encoding.Eip191)
      throw new Error("EIP-191 decoding is not yet supported");
    throw new Error("unknown encoding");
  }
}