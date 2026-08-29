import type { Ed25519 } from "./eddsa.js";
import type { Es256, Es256k } from "./ecdsa.js";

/**
 * Common signature type enum.
 *
 * The most common signature configurations (ES256, ES256K, Ed25519).
 * Mirrors Rust `signature::Common`.
 */
export type Common =
  | { alg: "es256"; config: Es256 }
  | { alg: "es256k"; config: Es256k }
  | { alg: "ed25519"; config: Ed25519 };