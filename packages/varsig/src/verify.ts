import type { Codec } from "./codec.js";
import type { Ipld } from "./ipld.js";

/**
 * Signature verification trait.
 *
 * Each algorithm provides `prefix()`, `configTags()`, and `tryVerify()`.
 * `Signature` collapses to `Uint8Array` (raw bytes) in TS.
 * `Verifier` is algorithm-specific (e.g. public key bytes).
 */
export interface Verify<Verifier = unknown> {
  /** Signature type prefix (e.g. 0xed for EdDSA, 0xec for ECDSA). */
  prefix(): number;

  /** Configuration tags (LEB128-encoded in the Varsig header). */
  configTags(): number[];

  /**
   * Validate the raw signature byte representation for this algorithm.
   *
   * This mirrors Rust's `Signature::try_from` path and runs before payload
   * verification.
   */
  tryDecodeSignature(signature: Uint8Array): void;

  /**
   * Verify a signature for a payload.
   *
   * Encodes the payload with the given codec, then verifies the signature
   * against the encoded bytes. Throws `VerificationError` on failure.
   */
  tryVerify(
    codec: Codec,
    verifier: Verifier,
    signature: Uint8Array,
    payload: Ipld,
  ): void;
}

/**
 * Verification error.
 *
 * Mirrors Rust `VerificationError` enum.
 */
export class VerificationError extends Error {
  reason: "encodingError" | "verificationError";

  constructor(reason: "encodingError" | "verificationError", msg?: string) {
    super(msg ?? reason);
    this.reason = reason;
    this.name = "VerificationError";
  }
}

/**
 * Extract the Verifier type from a Verify implementation.
 */
export type VerifierOf<V> = V extends Verify<infer Vr> ? Vr : never;

/**
 * Default tryVerify implementation (Rust's default `Verify::try_verify` body).
 *
 * Encodes payload with the codec, then calls the algorithm-specific `verifyFn`.
 * Used by all implementations as the standard verify pipeline.
 */
export function defaultTryVerify(
  codec: Codec,
  verifier: unknown,
  signature: Uint8Array,
  payload: Ipld,
  verifyFn: (verifier: unknown, msg: Uint8Array, sig: Uint8Array) => void,
): void {
  let buffer: Uint8Array;
  try {
    buffer = codec.encodePayload(payload);
  } catch (e) {
    throw new VerificationError("encodingError", String(e));
  }
  try {
    verifyFn(verifier, buffer, signature);
  } catch (e) {
    if (e instanceof VerificationError) throw e;
    throw new VerificationError("verificationError", String(e));
  }
}