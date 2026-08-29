import type { Verify } from "../verify.js";
import type { TryFromTags } from "../header.js";
import type { Codec } from "../codec.js";
import type { Ipld } from "../ipld.js";
import { Ed25519 } from "./eddsa.js";
import { Es256, Es384, Es512 } from "./ecdsa.js";

/**
 * WebCrypto-compatible signature algorithm configuration.
 *
 * Runtime enum wrapping individual algorithm configs so that
 * `prefix()`, `configTags()`, and `tryFromTags` can dispatch at runtime.
 */
export type WebCrypto =
  | { alg: "es256"; config: Es256 }
  | { alg: "es384"; config: Es384 }
  | { alg: "es512"; config: Es512 }
  | { alg: "ed25519"; config: Ed25519 };

/**
 * WebCrypto verifier — algorithm + raw key bytes.
 *
 * `alg` determines the concrete algorithm variant; the verifier
 * method asserts it matches the Varsig header config.
 */
export type WebCryptoVerifier =
  | { alg: "es256"; key: Uint8Array }
  | { alg: "es384"; key: Uint8Array }
  | { alg: "es512"; key: Uint8Array }
  | { alg: "ed25519"; key: Uint8Array };

/**
 * Extract the verifier type from a WebCrypto variant.
 */
function verifierKey(verifier: WebCryptoVerifier): Uint8Array {
  return verifier.key;
}

/** Implement `Verify` for `WebCrypto` via runtime dispatch. */
export const WebCryptoVerify: Verify<WebCryptoVerifier> = {
  prefix(): number {
    // Must not be called on the bare object; use the variant's prefix via dispatch.
    return 0;
  },

  configTags(): number[] {
    return [];
  },

  tryVerify(
    codec: Codec,
    verifier: WebCryptoVerifier,
    signature: Uint8Array,
    payload: Ipld,
  ): void {
    const key = verifierKey(verifier);
    switch (verifier.alg) {
      case "es256":
        new Es256().tryVerify(codec, key, signature, payload);
        return;
      case "es384":
        new Es384().tryVerify(codec, key, signature, payload);
        return;
      case "es512":
        new Es512().tryVerify(codec, key, signature, payload);
        return;
      case "ed25519":
        new Ed25519().tryVerify(codec, key, signature, payload);
        return;
      default:
        throw new Error(`unknown WebCrypto algorithm: ${(verifier as any).alg}`);
    }
  },
};

/**
 * Tag parser for WebCrypto.
 *
 * Dispatches on the first tag (0xec → ECDSA variants; 0xed → Ed25519).
 */
export const webCryptoTryFromTags: TryFromTags<WebCrypto> = (
  tags: number[],
) => {
  if (tags.length < 3) return null;

  const [first, second, third] = tags;
  const rest = tags.slice(3);

  switch (first) {
    // ECDSA prefix
    case 0xec:
      if (second === 0x1201 && third === 0x15) {
        return { config: { alg: "es256", config: new Es256() }, rest };
      }
      if (second === 0x1202 && third === 0x20) {
        return { config: { alg: "es384", config: new Es384() }, rest };
      }
      if (second === 0x1202 && third === 0x13) {
        return { config: { alg: "es512", config: new Es512() }, rest };
      }
      return null;
    // EdDSA prefix
    case 0xed:
      if (second === 0xed && third === 0x13) {
        return { config: { alg: "ed25519", config: new Ed25519() }, rest };
      }
      return null;
    default:
      return null;
  }
};