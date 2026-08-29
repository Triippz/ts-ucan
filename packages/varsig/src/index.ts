/**
 * Varsig — variable-signature UCAN headers.
 *
 * This is the primary entry point for the varsig library.
 */

// Types
export type { Ipld } from "./ipld.js";

// Codec
export { DAG_CBOR_CODE, DAG_JSON_CODE } from "./codec.js";
export type { Codec } from "./codec.js";
export { DagCborCodec, DagJsonCodec, codecFromTags } from "./codec.js";

// Verify
export type { Verify } from "./verify.js";
export { VerificationError } from "./verify.js";
export type { VerifierOf } from "./verify.js";

// Signer
export type { Sign, AsyncSign } from "./signer.js";
export type { SignerOf, AsyncSignerOf } from "./signer.js";
export { SignerError } from "./signer.js";

// Header
export { Varsig } from "./header.js";
export type { TryFromTags } from "./header.js";

// Hash
export { MULTIHASH_TAG } from "./hash.js";

// Curve
export type { Curve, P256, P384, P521 } from "./curve.js";

// Encoding
export { Encoding } from "./encoding.js";

// Signature — Ed25519
export { Ed25519, ed25519TryFromTags } from "./signature/eddsa.js";

// Signature — ECDSA
export { Es256, es256TryFromTags } from "./signature/ecdsa.js";
export { Es384, es384TryFromTags } from "./signature/ecdsa.js";
export { Es512, es512TryFromTags } from "./signature/ecdsa.js";
export { Es256k, es256kTryFromTags } from "./signature/ecdsa.js";

// Signature — WebCrypto
export type { WebCrypto, WebCryptoVerifier, WebCryptoSignature } from "./signature/webCrypto.js";
export { webCryptoTryFromTags, webCryptoVerify } from "./signature/webCrypto.js";

// Signature — Common
export type { Common } from "./signature/index.js";
