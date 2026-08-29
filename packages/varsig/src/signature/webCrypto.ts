import type { TryFromTags } from "../header.js";
import type { Ipld } from "../ipld.js";
import { Ed25519 } from "./eddsa.js";
import { Es256, Es384, Es512, Es256k } from "./ecdsa.js";

/**
 * WebCrypto-compatible signature algorithm configuration.
 *
 * In Rust this is a runtime enum whose variants implement `Verify`.
 * In TS we reuse the concrete algorithm classes directly.
 */
export type WebCrypto = Ed25519 | Es256 | Es384 | Es512 | Es256k;

/**
 * WebCrypto verifier — algorithm + raw key bytes.
 */
export type WebCryptoVerifier =
  | { alg: "es256"; key: Uint8Array }
  | { alg: "es384"; key: Uint8Array }
  | { alg: "es512"; key: Uint8Array }
  | { alg: "es256k"; key: Uint8Array }
  | { alg: "ed25519"; key: Uint8Array };

/**
 * Tag parser for WebCrypto.
 */
export const webCryptoTryFromTags: TryFromTags<WebCrypto> = (tags: number[]) => {
  if (tags.length < 3) return null;

  const [first, second, third] = tags;
  const rest = tags.slice(3);

  switch (first) {
    case 0xec:
      if (second === 0x1201 && third === 0x15) return { config: new Es256(), rest };
      if (second === 0x1202 && third === 0x20) return { config: new Es384(), rest };
      if (second === 0x1202 && third === 0x13) return { config: new Es512(), rest };
      if (second === 0xe7 && third === 0x12) return { config: new Es256k(), rest };
      return null;
    case 0xed:
      if (second === 0xed && third === 0x13) return { config: new Ed25519(), rest };
      return null;
    default:
      return null;
  }
};
