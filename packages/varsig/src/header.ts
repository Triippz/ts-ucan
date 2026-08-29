import { varint } from "multiformats";
import type { Codec } from "./codec.js";
import { codecFromTags } from "./codec.js";
import type { Ipld } from "./ipld.js";
import type { Verify, VerifierOf } from "./verify.js";
import type { Sign, AsyncSign, SignerOf, AsyncSignerOf } from "./signer.js";

/**
 * Tag-parsing function type.
 *
 * Given a slice of tags, returns the parsed config and remaining tags,
 * or `null` if the tags don't match the algorithm.
 */
export type TryFromTags<V> = (
  tags: number[],
) => { config: V; rest: number[] } | null;

/**
 * Top-level Varsig header.
 *
 * Combines a verifier configuration and a codec. Supports
 * sign, verify, and LEB128 header encoding/decoding.
 */
export class Varsig<V extends Verify<any>> {
  readonly verifierCfg: V;
  readonly codec: Codec;

  constructor(verifierCfg: V, codec: Codec) {
    this.verifierCfg = verifierCfg;
    this.codec = codec;
  }

  /**
   * Try to synchronously sign a payload.
   *
   * Delegates to the verifier config's `trySign` method.
   * Throws `SignerError` on failure.
   */
  trySign(
    sk: SignerOf<V>,
    payload: Ipld,
  ): { signature: Uint8Array; encoded: Uint8Array } {
    const signCfg = this.verifierCfg as unknown as Sign<
      VerifierOf<V>,
      SignerOf<V>
    >;
    return signCfg.trySign(this.codec, sk, payload);
  }

  /**
   * Try to asynchronously sign a payload.
   *
   * Delegates to the verifier config's `trySignAsync` method.
   * Throws `SignerError` on failure.
   */
  async trySignAsync(
    sk: AsyncSignerOf<V>,
    payload: Ipld,
  ): Promise<{ signature: Uint8Array; encoded: Uint8Array }> {
    const signCfg = this.verifierCfg as unknown as AsyncSign<
      VerifierOf<V>,
      AsyncSignerOf<V>
    >;
    return signCfg.trySignAsync(this.codec, sk, payload);
  }

  /**
   * Try to verify a signature for a payload.
   *
   * Delegates to the verifier config's `tryVerify` method.
   * Throws `VerificationError` on failure.
   */
  tryVerify(
    verifier: VerifierOf<V>,
    payload: Ipld,
    signature: Uint8Array,
  ): void {
    this.verifierCfg.tryVerify(this.codec, verifier, signature, payload);
  }

  /**
   * Encode the Varsig header as LEB128 bytes.
   *
   * Format: `[0x34, 0x01, prefix, ...configTags, codecCode]`
   * — all encoded as unsigned LEB128 integers concatenated.
   */
  encode(): Uint8Array {
    const parts: number[] = [
      0x34, // Varsig tag
      0x01, // Version tag
      this.verifierCfg.prefix(),
      ...this.verifierCfg.configTags(),
      this.codec.multicodecCode,
    ];

    // Calculate total encoded length
    let totalLen = 0;
    for (const n of parts) {
      totalLen += varint.encodingLength(n);
    }

    const result = new Uint8Array(totalLen);
    let offset = 0;
    for (const n of parts) {
      varint.encodeTo(n, result, offset);
      offset += varint.encodingLength(n);
    }
    return result;
  }

  /**
   * Decode a Varsig header from LEB128 bytes.
   *
   * The `tryFromTags` function is the algorithm-specific tag parser
   * (e.g. `ed25519TryFromTags`).
   * Throws on bad tag/version/unknown codec.
   */
  static decode<V extends Verify<any>>(
    bytes: Uint8Array,
    tryFromTags: TryFromTags<V>,
  ): Varsig<V> {
    const tags: number[] = [];
    let offset = 0;
    while (offset < bytes.length) {
      const [value, len] = varint.decode(bytes, offset);
      tags.push(Number(value));
      offset += len;
    }

    if (tags.length < 2) {
      throw new Error(
        "unable to deserialize varsig header: insufficient tags",
      );
    }

    const varsigTag = tags[0];
    if (varsigTag !== 0x34) {
      throw new Error(
        `expected varsig tag 0x34, found 0x${varsigTag.toString(16)}`,
      );
    }

    const versionTag = tags[1];
    if (versionTag !== 0x01) {
      throw new Error(
        `expected varsig version tag 0x01, found 0x${versionTag.toString(16)}`,
      );
    }

    const remaining = tags.slice(2);
    const parsed = tryFromTags(remaining);
    if (!parsed) {
      throw new Error("unable to create verifier from tags");
    }

    const codec = codecFromTags(parsed.rest);
    return new Varsig(parsed.config, codec);
  }
}