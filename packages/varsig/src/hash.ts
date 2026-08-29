/**
 * Multihash tag constants.
 *
 * Mirrors the `Multihasher` trait + 12 struct impls in Rust `hash.rs`.
 * All 12 entries, including the Sha2_384/Sha3_384 = 0x15 duplication.
 */
export const MULTIHASH_TAG = {
  sha2_256: 0x12,
  sha2_384: 0x15,
  sha2_512: 0x13,
  shake_256: 0x19,
  blake2b: 0xb220,
  blake3: 0x1e,
  keccak256: 0x1b,
  keccak384: 0x1c,
  keccak512: 0x1d,
  sha3_256: 0x16,
  sha3_384: 0x15,
  sha3_512: 0x14,
} as const;