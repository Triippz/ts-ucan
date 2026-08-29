/**
 * Elliptic curve identifiers.
 *
 * Each variant corresponds to a unit struct in the Rust `curve` module.
 */

export type Curve =
  | "secp256k1"
  | "secp256r1"
  | "secp384r1"
  | "secp521r1"
  | "edwards25519"
  | "edwards448";

/** NIST alias for the `secp256r1` curve. */
export type P256 = "secp256r1";

/** NIST alias for the `secp384r1` curve. */
export type P384 = "secp384r1";

/** NIST alias for the `secp521r1` curve. */
export type P521 = "secp521r1";