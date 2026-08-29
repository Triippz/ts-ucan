# PORT_PLAN.md — rs-ucan → TypeScript one-for-one port

Authoritative build plan. Workers implement from this document without reading each
other's code. If a signature here conflicts with your intuition, **this document wins**;
if it conflicts with the Rust source in `.reference/rs-ucan`, escalate — do not improvise.

Reference: `.reference/rs-ucan` (commit `59ff9b9`). Spec version: UCAN **1.0.0-rc.1**.

---

## 1. Target layout

Yarn workspaces (replace the existing `packages/{core,default-plugins,ucans}` entirely —
they are UCAN 0.x JWT and are deleted). ESM TypeScript, `vitest` for tests, `tsc` build.

```
package.json                 (workspace root: "workspaces": ["packages/*"])
packages/
  varsig/                    (@ucans/varsig — port of the varsig crate)
    package.json  tsconfig.json
    src/
      index.ts               (re-exports; mirrors varsig/src/lib.rs)
      codec.ts  curve.ts  encoding.ts  hash.ts  header.ts
      ipld.ts  signer.ts  verify.ts
      signature/
        index.ts  ecdsa.ts  eddsa.ts  webCrypto.ts
    test/*.test.ts
  ucan/                      (@ucans/ucan — port of the ucan crate)
    package.json  tsconfig.json
    src/
      index.ts               (mirrors ucan/src/lib.rs re-exports)
      cid.ts  collection.ts  collections.ts  command.ts  did.ts
      ipld.ts  number.ts  promise.ts  unset.ts  sealed.ts
      crypto/nonce.ts
      time/index.ts  time/error.ts  time/timestamp.ts
      envelope/index.ts  envelope/payloadTag.ts
      delegation/index.ts  delegation/builder.ts  delegation/store.ts  delegation/subject.ts
      delegation/policy/index.ts  delegation/policy/predicate.ts
      delegation/policy/selector/index.ts  .../error.ts  .../filter.ts  .../select.ts  .../selectable.ts
      invocation/index.ts  invocation/builder.ts
    test/
      *.test.ts              (ported inline #[cfg(test)] tests, source-named)
      delegationConformance.test.ts
      policyConformance.test.ts
      fixtures/delegation.json  fixtures/policy.json   (copied verbatim from rs-ucan)
```

`ucan_wasm` crate: **SKIPPED** — it is wasm-bindgen glue exposing the Rust crate to JS.
A native TypeScript library *is* the JS surface; the bindings are meaningless here.

## 2. Module map (every Rust file → TS file)

| Rust file | TS file |
|---|---|
| varsig/src/lib.rs | packages/varsig/src/index.ts |
| varsig/src/header.rs | packages/varsig/src/header.ts |
| varsig/src/codec.rs | packages/varsig/src/codec.ts |
| varsig/src/verify.rs | packages/varsig/src/verify.ts |
| varsig/src/signer.rs | packages/varsig/src/signer.ts |
| varsig/src/hash.rs | packages/varsig/src/hash.ts |
| varsig/src/curve.rs | packages/varsig/src/curve.ts |
| varsig/src/encoding.rs | packages/varsig/src/encoding.ts |
| varsig/src/signature.rs | packages/varsig/src/signature/index.ts |
| varsig/src/signature/eddsa.rs | packages/varsig/src/signature/eddsa.ts |
| varsig/src/signature/ecdsa.rs | packages/varsig/src/signature/ecdsa.ts |
| varsig/src/signature/web_crypto.rs | packages/varsig/src/signature/webCrypto.ts |
| (no Rust counterpart) | packages/varsig/src/ipld.ts (`Ipld` type seam, see §5.1) |
| ucan/src/lib.rs | packages/ucan/src/index.ts |
| ucan/src/cid.rs | packages/ucan/src/cid.ts |
| ucan/src/ipld.rs | packages/ucan/src/ipld.ts |
| ucan/src/number.rs | packages/ucan/src/number.ts |
| ucan/src/unset.rs | packages/ucan/src/unset.ts |
| ucan/src/sealed.rs | packages/ucan/src/sealed.ts |
| ucan/src/collection.rs | packages/ucan/src/collection.ts |
| ucan/src/collections.rs | packages/ucan/src/collections.ts |
| ucan/src/command.rs | packages/ucan/src/command.ts |
| ucan/src/promise.rs | packages/ucan/src/promise.ts |
| ucan/src/did.rs | packages/ucan/src/did.ts |
| ucan/src/crypto.rs | (folded into crypto/nonce.ts re-export from index) |
| ucan/src/crypto/nonce.rs | packages/ucan/src/crypto/nonce.ts |
| ucan/src/time.rs | packages/ucan/src/time/index.ts |
| ucan/src/time/timestamp.rs | packages/ucan/src/time/timestamp.ts |
| ucan/src/time/error.rs | packages/ucan/src/time/error.ts |
| ucan/src/envelope.rs | packages/ucan/src/envelope/index.ts |
| ucan/src/envelope/payload_tag.rs | packages/ucan/src/envelope/payloadTag.ts |
| ucan/src/delegation.rs | packages/ucan/src/delegation/index.ts |
| ucan/src/delegation/subject.rs | packages/ucan/src/delegation/subject.ts |
| ucan/src/delegation/builder.rs | packages/ucan/src/delegation/builder.ts |
| ucan/src/delegation/store.rs | packages/ucan/src/delegation/store.ts |
| ucan/src/delegation/policy.rs | packages/ucan/src/delegation/policy/index.ts |
| ucan/src/delegation/policy/predicate.rs | packages/ucan/src/delegation/policy/predicate.ts |
| ucan/src/delegation/policy/selector.rs | packages/ucan/src/delegation/policy/selector/index.ts |
| ucan/src/delegation/policy/selector/error.rs | .../selector/error.ts |
| ucan/src/delegation/policy/selector/filter.rs | .../selector/filter.ts |
| ucan/src/delegation/policy/selector/select.rs | .../selector/select.ts |
| ucan/src/delegation/policy/selector/selectable.rs | .../selector/selectable.ts |
| ucan/src/invocation.rs | packages/ucan/src/invocation/index.ts |
| ucan/src/invocation/builder.rs | packages/ucan/src/invocation/builder.ts |
| ucan/tests/delegation_conformance.rs | packages/ucan/test/delegationConformance.test.ts |
| ucan/tests/policy_conformance.rs | packages/ucan/test/policyConformance.test.ts |
| ucan/tests/fixtures/*.json | packages/ucan/test/fixtures/*.json (verbatim copies) |
| ucan_wasm/** | SKIPPED (wasm→JS bindings; TS library is the JS surface) |

## 3. Rust → TS translation rules

1. **traits → interfaces**; associated types → generic parameters on the interface.
2. **enums → discriminated unions** with a `kind` tag, unless the enum is data-free
   (then a string-literal union) or a wire format dictates otherwise (see contracts).
3. **serde → explicit `toIpld`/`fromIpld` + `encode`/`decode` functions** using
   `@ipld/dag-cbor`. Every type that had `Serialize`/`Deserialize` in Rust gets
   `xToIpld(x): Ipld` and `ipldToX(ipld): X` (throwing) in its module, named after the
   type (e.g. `commandToIpld`, `ipldToCommand`). Envelope-level byte encode/decode lives
   in `envelope/index.ts`.
4. **error enums → typed `Error` subclasses**, one class per Rust error enum, with a
   `reason` (string-literal union) field mirroring the variants. Functions throw; no
   Result type. Example:
   `class CommandParseError extends Error { reason: "missingLeadingSlash"|"trailingSlash"|"notLowercase"|"emptySegment" }`.
5. **`no_std` plumbing → n/a** (alloc/std cfg splits collapse to one impl).
6. **proptest / `Arbitrary` impls → skip** (n/a in checklist). Port every deterministic
   `#[test]` one-for-one, keeping the Rust test name in camelCase.
7. **`PhantomData` / typestate builders**: keep the builder ergonomics but implement as a
   single class whose `tryBuild()` throws `MissingFieldError` listing unset required
   fields at runtime, plus TS generics for compile-time tracking where cheap (see lane
   specs). Do not replicate the sealed-trait machinery beyond `unset.ts`/`sealed.ts`
   markers documented below.
8. **`u64` LEB128 / integers**: varsig header tags fit in small integers → use `number`
   with LEB128 encode/decode helpers (implement ~15-line leb128 in `varsig/src/header.ts`;
   `multiformats` varint is unsigned-varint = LEB128, reuse `multiformats/varint` instead
   of hand-rolling). IPLD integers: `number | bigint` (see contracts).
9. **`BTreeMap<String, X>` → `Map<string, X>`**, and encoding must sort keys — @ipld/dag-cbor
   already canonically sorts map keys on encode. Use plain `Map`, never `{}` records, for
   payload `meta` / `arguments` (preserves non-identifier keys and ordering semantics).
10. **`async` traits (`AsyncSign`, `FutureForm`)**: TS is natively async; `FutureForm`
    Local/Sendable machinery is n/a. Store methods return `Promise`.
11. Byte equality helpers: use a tiny local `bytesEqual(a, b)` in `ucan/src/ipld.ts`.

## 4. Dependencies (exact, minimal — pinned majors)

Workspace dev (root): `typescript@^5`, `vitest@^3`. Root package.json (Lane C, Wave 1):
`"engines": { "node": ">=18" }` (Node 18 needs `--experimental-global-webcrypto` for
`crypto.getRandomValues`; unflagged from Node 19). Test-only deps go in the consuming
package's `devDependencies`, never `dependencies`.

| Package | Version | Used by | Justification |
|---|---|---|---|
| `@ipld/dag-cbor` | `^9` | both (runtime) | canonical DAG-CBOR encode/decode (replaces serde_ipld_dagcbor). |
| `@ipld/dag-json` | `^10` | varsig runtime (encoding.ts DagJsonCodec); ucan **devDependency** (policy fixture args only) | DAG-JSON codec + fixtures. |
| `multiformats` | `^13` | both (runtime) | `CID`, sha2-256 via `multiformats/hashes/sha2` for CIDs, base58btc for did:key, `varint` (LEB128). |
| `@noble/curves` | `^1` | varsig, ucan/did (runtime) | ed25519 sign/verify; p256/p384/p521/secp256k1 **verify-only** (rs-ucan ECDSA has no Sign impls — see §5.7). |

`@noble/hashes` is DROPPED as a direct dependency (reassessed): CID hashing uses
`multiformats/hashes/sha2`, and `@noble/curves` bundles its own hash primitives
(sha512 for ed25519, sha2 for ECDSA prehash). Nothing else. `bs58` →
`multiformats/bases/base58`. `getrandom` → `crypto.getRandomValues`. `nom` →
hand-written parser. `thiserror` → Error classes. `future_form` → Promise.

## 5. SHARED TYPE CONTRACTS (exact TS signatures — do not drift)

These are the cross-lane seams. Every lane imports these exact names/shapes.

### 5.1 `Ipld` — type in packages/varsig/src/ipld.ts (Lane V); helpers in ucan/src/ipld.ts (Lane C)
The `Ipld` type itself lives in `@ucans/varsig`: varsig's public `Codec` interface
consumes it, and varsig must not import ucan — defining it in varsig and re-exporting
from ucan keeps the package graph acyclic.
```ts
// packages/varsig/src/ipld.ts (no Rust counterpart; seam file).
// Mirrors ipld_core::ipld::Ipld and @ipld/dag-cbor's decoded shape.
// Integers: number when |x| <= Number.MAX_SAFE_INTEGER, bigint otherwise
// (this is what @ipld/dag-cbor produces). Maps are ES Map<string, Ipld>.
import { CID } from "multiformats/cid";
export type Ipld =
  | null | boolean | number | bigint | string | Uint8Array | CID
  | Ipld[] | Map<string, Ipld>;

// packages/ucan/src/ipld.ts (Lane C): re-export the type + own all helpers.
export type { Ipld } from "@ucans/varsig";
// dag-cbor decodes maps as plain objects; conversion helpers (Lane C):
export function ipldFromDagCbor(bytes: Uint8Array): Ipld;   // decode + objects→Map
export function ipldToDagCbor(value: Ipld): Uint8Array;     // Map→objects + encode
export function ipldEquals(a: Ipld, b: Ipld): boolean;      // deep; bytes/CID aware; number 1 === bigint 1n
export function bytesEqual(a: Uint8Array, b: Uint8Array): boolean;
// Port of eq_with_float_nans_and_infinities (test helper, exported for tests):
export function ipldEqualsWithFloatNansAndInfinities(a: Ipld, b: Ipld): boolean;
```
Note: Rust's `InternalIpld` exists only because ipld-core lacks trait impls; in TS the
`Ipld` union above IS both. `InternalIpld` items map to this type (checklist: merged).

### 5.2 CID helpers (ucan/src/cid.ts) — Lane C
```ts
export function toDagCborCid(value: Ipld): CID; // dag-cbor(0x71) + sha2-256(0x12), CIDv1
```

### 5.3 Did (ucan/src/did.ts) — Lane C
```ts
import type { Sign } from "@ucans/varsig";
export interface Did<V extends Sign<any, any> = Sign<any, any>> {
  readonly didMethod: string;                 // "key"
  readonly varsigConfig: V;
  toString(): string;                         // "did:key:z…"
  equals(other: Did): boolean;
}
export interface DidSigner<D extends Did = Did> {
  readonly did: D;
  readonly signer: unknown;                   // key material consumed by varsigConfig.trySign
}
export class Ed25519Did implements Did<Ed25519> {
  constructor(publicKey: Uint8Array /* 32 bytes */);
  readonly publicKey: Uint8Array;
  readonly didMethod: "key";
  readonly varsigConfig: Ed25519;
  toString(): string;                         // 0xed 0x01 prefix + base58btc, "did:key:z…"
  equals(other: Did): boolean;
  static fromString(s: string): Ed25519Did;   // throws Ed25519DidFromStrError
}
export class Ed25519DidFromStrError extends Error {
  reason: "invalidDidHeader" | "missingBase58Prefix" | "invalidBase58" | "invalidKey";
}
export class Ed25519Signer implements DidSigner<Ed25519Did> {
  constructor(secretKey: Uint8Array /* 32 bytes */);
  readonly did: Ed25519Did;
  readonly signer: Uint8Array;                // the 32-byte secret key
  toString(): string;                         // delegates to did
}
// Extracts the varsig config type of a Did (Rust's D::VarsigConfig):
export type VarsigConfigOf<D extends Did> = D["varsigConfig"];
```
DID parse/format rules are exactly the Rust ones: `did:key:z` + base58btc of
`[0xed, 0x01, ...32 pubkey bytes]`; parse validates 34 bytes and the 0xED 0x01 header.

### 5.4 Timestamp (ucan/src/time/timestamp.ts) — Lane C
```ts
// Unix SECONDS (not ms). Canonical constructors bound at 2^53-1
// (0x001F_FFFF_FFFF_FFFF), but internal storage is number | bigint: the
// permissive Postel decode path must preserve values through u64::MAX exactly
// (Rust deserializes a plain u64 and only skips the 2^53 check —
// timestamp.rs:114, :238-239).
export class Timestamp {
  private constructor(secs: number | bigint);
  static fromUnix(secs: number | bigint): Timestamp;  // throws OutOfRangeError if >2^53-1, <0, or non-integer
  static fromDate(date: Date): Timestamp;             // throws OutOfRangeError (BeforeEpoch if < epoch)
  static now(): Timestamp;
  static fiveMinutesFromNow(): Timestamp;
  static fiveYearsFromNow(): Timestamp;
  static postelUnix(secs: number | bigint): Timestamp; // permissive decode path: NO 2^53 bound; >2^53-1 kept as bigint
  toUnix(): number | bigint;                          // number when <= 2^53-1, bigint above
  toDate(): Date;                                     // throws OutOfRangeError if ms > 2^53
  toIpld(): Ipld;                                     // integer seconds (number or bigint)
  static fromIpld(ipld: Ipld): Timestamp;             // throws TimestampFromIpldError; decode goes through postelUnix
  equals(o: Timestamp): boolean;
  compare(o: Timestamp): -1 | 0 | 1;
}
export class OutOfRangeError extends Error { reason: "tooLarge" | "beforeEpoch"; }
export class NumberIsNotATimestampError extends Error {}   // time/error.ts
export class TimeBoundError extends Error { reason: "expired" | "notYetValid"; }
export class ExpiredError extends Error {}
export class TimestampFromIpldError extends Error { reason: "notAnInteger" | "notATimestamp"; }
```

### 5.5 Nonce (ucan/src/crypto/nonce.ts) — Lane C
```ts
export class Nonce {
  readonly kind: "nonce16" | "custom";
  readonly bytes: Uint8Array;                 // 16 bytes iff kind === "nonce16"
  static fromBytes(bytes: Uint8Array): Nonce; // 16 bytes → nonce16, else custom
  static generate16(): Nonce;                 // crypto.getRandomValues
  toBytes(): Uint8Array;
  toString(): string;                         // lowercase hex, no 0x prefix
  toIpld(): Ipld;                             // bytes
  static fromIpld(ipld: Ipld): Nonce;         // throws NoncesMustBeBytesError
  equals(o: Nonce): boolean;                  // byte equality across kinds (Rust PartialEq)
}
export class NoncesMustBeBytesError extends Error {}
```

### 5.6 Command (ucan/src/command.ts) — Lane C
```ts
export class Command {
  constructor(segments: string[]);            // unvalidated, = Command::new
  static parse(s: string): Command;           // throws CommandParseError
  readonly segments: string[];
  startsWith(prefix: Command): boolean;
  toString(): string;                         // "/" or "/a/b"
  toIpld(): Ipld;                             // the string form
  static fromIpld(ipld: Ipld): Command;
  equals(o: Command): boolean;
}
export class CommandParseError extends Error {
  reason: "missingLeadingSlash" | "trailingSlash" | "notLowercase" | "emptySegment";
}
```

### 5.7 varsig interfaces (packages/varsig) — Lane V owns
```ts
// codec.ts
export interface Codec {                       // Codec<T> collapses: payload is Ipld
  readonly multicodecCode: number;             // 0x71 dag-cbor, 0x0129 dag-json
  encodePayload(payload: Ipld): Uint8Array;    // throws EncodingError
  decodePayload(bytes: Uint8Array): Ipld;      // throws DecodingError
}
export const DAG_CBOR_CODE = 0x71;
export const DAG_JSON_CODE = 0x0129;
export const DagCborCodec: Codec;              // singleton object
export const DagJsonCodec: Codec;
export function codecFromTags(tags: number[]): Codec; // throws if not exactly [known code]

// verify.ts — Verify trait. Signature = raw Uint8Array everywhere (SignatureEncoding
// collapses to bytes; noble produces/consumes compact raw bytes).
export interface Verify<Verifier> {
  prefix(): number;                            // e.g. 0xed
  configTags(): number[];                      // e.g. [0xed, 0x13]
  // static in Rust; here a standalone per-algorithm export: see tryFromTags below
  tryVerify(codec: Codec, verifier: Verifier, signature: Uint8Array, payload: Ipld): void; // throws VerificationError
}
export class VerificationError extends Error { reason: "encodingError" | "verificationError"; }
// Helper extractor (Rust's V::Verifier associated type):
export type VerifierOf<V> = V extends Verify<infer Vr> ? Vr : never;

// signer.ts
export interface Sign<Verifier, Signer> extends Verify<Verifier> {
  trySign(codec: Codec, signer: Signer, payload: Ipld): { signature: Uint8Array; encoded: Uint8Array }; // throws SignerError
}
export interface AsyncSign<Verifier, AsyncSigner> extends Verify<Verifier> {
  trySignAsync(codec: Codec, signer: AsyncSigner, payload: Ipld): Promise<{ signature: Uint8Array; encoded: Uint8Array }>;
}
export class SignerError extends Error { reason: "encodingError" | "signingError" | "varsigError"; }
// Helper extractors (Rust's V::Signer / V::AsyncSigner associated types):
export type SignerOf<V> = V extends Sign<any, infer S> ? S : never;
export type AsyncSignerOf<V> = V extends AsyncSign<any, infer S> ? S : never;

// Per-algorithm tag parsing (Rust's static V::try_from_tags):
export type TryFromTags<V> = (tags: number[]) => { config: V; rest: number[] } | null;

// header.ts — Varsig<V, C, T> header
export class Varsig<V extends Verify<any>> {
  constructor(verifierCfg: V, codec: Codec);
  readonly verifierCfg: V;
  readonly codec: Codec;
  trySign(sk: SignerOf<V>, payload: Ipld): { signature: Uint8Array; encoded: Uint8Array };
  trySignAsync(sk: AsyncSignerOf<V>, payload: Ipld): Promise<{ signature: Uint8Array; encoded: Uint8Array }>;
  tryVerify(verifier: VerifierOf<V>, payload: Ipld, signature: Uint8Array): void;
  encode(): Uint8Array;      // LEB128 [0x34, 0x01, prefix, ...configTags, codecCode]
  static decode<V extends Verify<any>>(bytes: Uint8Array, tryFromTags: TryFromTags<V>): Varsig<V>; // throws on bad tag/version
}

// hash.ts — data-free structs → constant tag table
export const MULTIHASH_TAG: {
  sha2_256: 0x12; sha2_384: 0x15; sha2_512: 0x13; shake_256: 0x19;
  blake2b: 0xb220; blake3: 0x1e; keccak256: 0x1b; keccak384: 0x1c; keccak512: 0x1d;
  sha3_256: 0x16; sha3_384: 0x15; sha3_512: 0x14;
};
// curve.ts — marker union
export type Curve = "secp256k1" | "secp256r1" | "secp384r1" | "secp521r1" | "edwards25519" | "edwards448";

// signature/eddsa.ts — verifier/signer = raw key bytes
export class Ed25519 implements Sign<Uint8Array /*32B pubkey*/, Uint8Array /*32B secret*/> {
  prefix(): 0xed; configTags(): [0xed, 0x13];
}
export const ed25519TryFromTags: TryFromTags<Ed25519>;   // matches [0xed,0xed,0x13]
// signature/ecdsa.ts — VERIFY-ONLY: rs-ucan implements only Verify for ECDSA
// (ecdsa.rs:51, :77, :139, :165); no Sign impls, so no trySign here.
// verifier = SEC1 pubkey bytes, sig = compact raw.
export class Es256  implements Verify<Uint8Array> { prefix(): 0xec; configTags(): [0x1201, 0x15]; /* p256  + sha256 */ }
export class Es384  implements Verify<Uint8Array> { prefix(): 0xec; configTags(): [0x1202, 0x20]; /* p384  + sha384 */ }
export class Es512  implements Verify<Uint8Array> { prefix(): 0xec; configTags(): [0x1202, 0x13]; /* p521  + sha512 */ }
export class Es256k implements Verify<Uint8Array> { prefix(): 0xec; configTags(): [0xe7,   0x12]; /* secp256k1 + sha256 */ }
export const es256TryFromTags: TryFromTags<Es256>;   // [0xec,0x1201,0x15]  etc.
// signature/webCrypto.ts — runtime-dispatch enum over the four above:
export type WebCrypto =
  | { alg: "es256"; config: Es256 } | { alg: "es384"; config: Es384 }
  | { alg: "es512"; config: Es512 } | { alg: "ed25519"; config: Ed25519 };
export const webCryptoTryFromTags: TryFromTags<WebCrypto>;
// signature/index.ts — Common enum:
export type Common =
  | { alg: "es256"; config: Es256 } | { alg: "es256k"; config: Es256k }
  | { alg: "ed25519"; config: Ed25519 };
```

### 5.8 Envelope (ucan/src/envelope) — Lane E owns
Wire format (must byte-roundtrip the fixtures):
- Envelope = CBOR 2-tuple `[ signatureBytes, payloadMap ]`.
- payloadMap = `{ "h": <varsig header bytes>, "<tag>": <payload map> }` where tag is
  `` `ucan/${specId}@${version}` `` (`ucan/dlg@1.0.0-rc.1`, `ucan/inv@1.0.0-rc.1`).
```ts
// envelope/payloadTag.ts
export interface PayloadTag { specId: string; version: string; }
export function tagOf(t: PayloadTag): string;   // `ucan/${specId}@${version}`

// envelope/index.ts
export interface EnvelopePayload<V extends Verify<any>, T> { header: Varsig<V>; payload: T; }
export interface Envelope<V extends Verify<any>, T> { signature: Uint8Array; payload: EnvelopePayload<V, T>; }
// Generic codec parameterized by the payload's Ipld converters:
export function envelopeToIpld<V extends Verify<any>, T>(e: Envelope<V, T>, tag: PayloadTag, payloadToIpld: (t: T) => Ipld): Ipld;
export function envelopeFromIpld<V extends Verify<any>, T>(
  ipld: Ipld,
  ipldToPayload: (i: Ipld) => T,
  tryFromTags: TryFromTags<V>,
): Envelope<V, T>;
// Decode rules — exact Rust parity (envelope.rs:161-184): ANY non-"h" key is the
// payload; the key name is NOT validated against the tag (no wrong-tag rejection).
// Throws on: duplicate "h", a second non-"h" (payload) field, missing "h", missing
// payload, non-bytes "h" value, non-bytes signature. `tag` is used only on encode.
```

### 5.9 DelegationPayload / Delegation — Lane E owns
Serialized field names & rules (CBOR map): `iss` (DID string), `aud` (DID string),
`sub` (DID string or **null** for Any), `cmd` (string), `pol` (list of predicates),
`exp` (int or null; REQUIRED key), `nbf` (int or null; the key is ALWAYS emitted on
encode — Rust derive has no skip_serializing_if, delegation.rs:130-151 — and decode
maps a missing key or null to `null`, delegation.rs:245, :391),
`meta` (map, optional; absent → empty Map), `nonce` (bytes; REQUIRED). Unknown keys
and duplicate keys are decode errors. Missing iss/aud/sub/cmd/pol/nonce/exp are errors.
```ts
export type DelegatedSubject<D extends Did> = { kind: "specific"; did: D } | { kind: "any" };
export function subjectAllows<D extends Did>(s: DelegatedSubject<D>, subject: D): boolean;
export function subjectCoherent<D extends Did>(a: DelegatedSubject<D>, b: DelegatedSubject<D>): boolean;

export interface DelegationPayload<D extends Did> {
  issuer: D; audience: D; subject: DelegatedSubject<D>; command: Command;
  policy: Predicate[]; expiration: Timestamp | null; notBefore: Timestamp | null;
  meta: Map<string, Ipld>; nonce: Nonce;
}
export class Delegation<D extends Did> {
  constructor(envelope: Envelope<VarsigConfigOf<D>, DelegationPayload<D>>);
  // getters mirroring Rust: issuer, audience, subject, command, policy,
  // expiration, notBefore, meta, nonce  (all readonly accessors)
  toCid(): CID;
  static builder(): DelegationBuilder;        // Lane E
  encode(): Uint8Array;                       // dag-cbor of envelope
  static decode(bytes: Uint8Array): Delegation<Ed25519Did>;   // Ed25519 default, matches conformance use
}
export const delegationPayloadTag: PayloadTag; // { specId: "dlg", version: "1.0.0-rc.1" }
```

### 5.10 InvocationPayload / Invocation — Lane I owns
Field names: `iss`, `aud`, `sub` (all DID strings, sub NOT nullable), `cmd`, `arg`
(map of Promised), `prf` (list of CID links), `cause` (CID or null), `iat` (int|null),
`exp` (int|null), `meta` (map), `nonce` (bytes). Serde-derive semantics: all keys
present on encode (Options encode as null); decode via generic map matching.
```ts
export interface InvocationPayload<D extends Did> {
  issuer: D; audience: D; subject: D; command: Command;
  arguments: Map<string, Promised>; proofs: CID[]; cause: CID | null;
  issuedAt: Timestamp | null; expiration: Timestamp | null;
  meta: Map<string, Ipld>; nonce: Nonce;
}
export class Invocation<D extends Did> { /* getters as in Rust + toCid on payload */ }
export const invocationPayloadTag: PayloadTag; // { specId: "inv", version: "1.0.0-rc.1" }
// Payload methods:
//   invocationPayloadToCid(p): CID
//   check(p, store: DelegationStore<D>): Promise<void>          — throws StoredCheckError
//   syntaticChecks(p, proofs: Iterable<Delegation<D>>): void    — throws CheckFailed (keep Rust's spelling "syntatic")
export class CheckFailed extends Error {
  reason: "waitingOnPromise" | "commandMismatch" | "predicateRunError" | "predicateFailed"
        | "invalidProofIssuerChain" | "subjectNotAllowedByProof" | "rootProofIssuerIsNotSubject";
}
```

### 5.11 Promise types (ucan/src/promise.ts) — Lane C
```ts
export type Promise_<T, E> =            // Rust Promise<T,E>; underscore avoids global clash
  | { kind: "ok"; value: T } | { kind: "err"; error: E }
  | { kind: "pendingOk"; cid: CID } | { kind: "pendingErr"; cid: CID }
  | { kind: "pendingAny"; cid: CID } | { kind: "pendingTagged"; cid: CID };
export type Promised =
  | { kind: "null" } | { kind: "bool"; value: boolean }
  | { kind: "integer"; value: number | bigint } | { kind: "float"; value: number }
  | { kind: "string"; value: string } | { kind: "bytes"; value: Uint8Array }
  | { kind: "link"; cid: CID }
  | { kind: "waitOk"; cid: CID } | { kind: "waitErr"; cid: CID } | { kind: "waitAny"; cid: CID }
  | { kind: "list"; values: Promised[] } | { kind: "map"; values: Map<string, Promised> };
export function promisedToIpld(p: Promised): Ipld;      // throws WaitingOnError; From-impl (plain Ipld), NOT the wire form
export function ipldToPromised(i: Ipld): Promised;
export class WaitingOnError extends Error { reason: "waitOk" | "waitErr" | "waitAny"; cid: CID; }
// Wire (serde-derive) forms:
export function promisedToWireIpld(p: Promised): Ipld;   // externally tagged, EVERY variant
export function wireIpldToPromised(i: Ipld): Promised;
export function promiseToWireIpld<T, E>(p: Promise_<T, E>, tToIpld: (t: T) => Ipld, eToIpld: (e: E) => Ipld): Ipld;
export function wireIpldToPromise<T, E>(i: Ipld, ipldToT: (i: Ipld) => T, ipldToE: (i: Ipld) => E): Promise_<T, E>;
```
Wire encoding: Rust applies ordinary derived externally-tagged serde to the WHOLE
`Promised` enum (promise.rs:33-55) — EVERY variant is tagged, including resolved ones:
`Promised::Bool(true)` → `{"Bool": true}`, `WaitOk(cid)` → `{"WaitOk": <cid>}`, and the
unit variant `Null` → the string `"Null"`. Resolved variants are NOT plain values.
`Promise<T,E>` (promise.rs:9-10) is likewise externally tagged. Lane T locks this with
a Rust-derived dag-cbor byte fixture.

### 5.12 Number (ucan/src/number.ts) — Lane C
```ts
export type UcanNumber = { kind: "float"; value: number } | { kind: "integer"; value: number | bigint };
export function numberCompare(a: UcanNumber, b: UcanNumber): -1 | 0 | 1 | null;  // null = incomparable (NaN)
export function numberFromIpld(ipld: Ipld): UcanNumber;   // throws NotANumberError
export function numberToIpld(n: UcanNumber): Ipld;
export class NotANumberError extends Error {}
```
Cross-type comparison must mirror Rust's f64::MAX bounds logic for int↔float.

### 5.13 Collection / collections — Lane C
```ts
// collection.ts
export type Collection = { kind: "array"; values: Ipld[] } | { kind: "map"; values: Map<string, Ipld> };
export function collectionToVec(c: Collection): Ipld[];   // array elems or map values
export function collectionIsEmpty(c: Collection): boolean;
export function collectionToIpld(c: Collection): Ipld;   // From-impl: bare contents (untagged)
// Derived serde on the enum (collection.rs:17) is externally tagged — distinct wire form:
export function collectionToWireIpld(c: Collection): Ipld; // {"Array": [...]} | {"Map": {...}}
export function wireIpldToCollection(i: Ipld): Collection;
// collections.ts: Rust's std/no_std Map/Set alias → n/a in TS; export type aliases
export type UcanMap<K, V> = Map<K, V>;  export type UcanSet<T> = Set<T>;
```

### 5.14 Unset / sealed — Lane C
```ts
// unset.ts
export const Unset: unique symbol; export type Unset = typeof Unset;
// sealed.ts — doc-only marker types used by builders:
export type DidOrUnset<D> = D | Unset;  // etc. (see checklist; these are type aliases)
```

### 5.15 Policy AST — Lane P owns
```ts
// selector/filter.ts
export type Filter =
  | { kind: "arrayIndex"; index: number }
  | { kind: "field"; key: string }
  | { kind: "slice"; start: number | null; end: number | null }
  | { kind: "values" }
  | { kind: "try"; inner: Filter };
export function filterToString(f: Filter): string;        // Display impl incl. JSON-string escaping
export function parseFilter(s: string): Filter;            // FromStr; throws ParseError
export function filterIsIn(a: Filter, b: Filter): boolean;
export function filterIsDotField(f: Filter): boolean;
export function filterToIpld(f: Filter): Ipld;             // ["idx",i] ["field",k] ["slice",s,e] ["values"] ["try",inner]
export function ipldToFilter(i: Ipld): Filter;

// selector/index.ts
export class Selector {
  constructor(filters: Filter[] = []);   // new Selector() = identity selector (selector.rs:35-36)
  readonly filters: Filter[];
  isRelated(other: Selector): boolean;
  toString(): string;
  static fromString(s: string): Selector;                  // throws ParseError (nom port)
  compare(other: Selector): -1 | 0 | 1 | null;             // PartialOrd (prefix ordering)
}
export class SelectorError extends Error { selector: Selector; reason: SelectorErrorReason; }
export type SelectorErrorReason =  // selector/error.ts
  "indexOutOfBounds" | "keyNotFound" | "notAList" | "notAMap" | "notACollection" | "notANumber" | "notAString";
export class ParseError extends Error {
  reason: "trailingInput" | "unknownPattern" | "missingStartingDot" | "startsWithDoubleDot";
  input: string;   // the offending input (Rust variants carry it; needed for serde roundtrip)
}
// Derived serde (selector.rs:121-128; selector/error.rs:8-37):
export function selectorErrorToIpld(e: SelectorError): Ipld;        // {"selector": <string form>, "reason": <reason wire>}
export function ipldToSelectorError(i: Ipld): SelectorError;
export function selectorErrorReasonToIpld(r: SelectorErrorReason): Ipld; // Rust variant-name string, e.g. "IndexOutOfBounds"
export function ipldToSelectorErrorReason(i: Ipld): SelectorErrorReason;
export function parseErrorToIpld(e: ParseError): Ipld;              // externally tagged: {"TrailingInput": input} etc.
export function ipldToParseError(i: Ipld): ParseError;

// selector/selectable.ts
export type Selectable<T> = (ipld: Ipld) => T;             // throws SelectorErrorReason via SelectableError
export const selectIpld: Selectable<Ipld>;
export const selectNumber: Selectable<UcanNumber>;
export const selectString: Selectable<string>;
export const selectCollection: Selectable<Collection>;

// selector/select.ts
export class Select<T> {
  constructor(filters: Filter[], selectable: Selectable<T>);
  get(ctx: Ipld): T;                                       // throws SelectorError; try→null semantics per select.rs
  isRelated<U>(other: Select<U>): boolean;
  toString(): string;
  static fromString<T>(s: string, selectable: Selectable<T>): Select<T>;
  compare(other: Select<T>): -1 | 0 | 1 | null;
  toIpld(): Ipld;                                          // the selector string
}

// predicate.ts
export type Predicate =
  | { kind: "equal"; select: Select<Ipld>; value: Ipld }
  | { kind: "greaterThan"; select: Select<UcanNumber>; value: UcanNumber }
  | { kind: "greaterThanOrEqual"; select: Select<UcanNumber>; value: UcanNumber }
  | { kind: "lessThan"; select: Select<UcanNumber>; value: UcanNumber }
  | { kind: "lessThanOrEqual"; select: Select<UcanNumber>; value: UcanNumber }
  | { kind: "like"; select: Select<string>; pattern: string }
  | { kind: "not"; inner: Predicate }
  | { kind: "and"; inner: Predicate[] }
  | { kind: "or"; inner: Predicate[] }
  | { kind: "all"; select: Select<Collection>; inner: Predicate }
  | { kind: "any"; select: Select<Collection>; inner: Predicate };
export function runPredicate(p: Predicate, data: Ipld): boolean;  // throws RunError
export function glob(input: string, pattern: string): boolean;    // exact port incl. backslash escaping
export function predicateToIpld(p: Predicate): Ipld;   // tuple form; not(equal) → "!="
export function ipldToPredicate(i: Ipld): Predicate;   // throws FromIpldError; accepts both wire & string-selector forms per try_from
export class RunError extends Error { reason: "cannotCompareNonwholeFloatToInt" | "cannotCompareNaNs" | "selectorError"; }
export class FromIpldError extends Error { /* variants per predicate.rs FromIpldError */ }
```
Semantics that MUST match select.rs / predicate.rs exactly: try-filter restarts from
root ctx (`Select::<Ipld>::new(vec![op]).get(ctx)`) and null-fallback on error; slice
resolution (Python-style, clamped, `e.max(s)`); bytes indexing/slicing; `Equal`
int↔whole-float coercion (error on non-whole/NaN/∞ float); empty `Or`/`Any` → true;
empty `And`/`All` → true (fold identity).

### 5.16 DelegationStore — Lane E
```ts
export interface DelegationStore<D extends Did> {
  getAll(cids: CID[]): Promise<Delegation<D>[]>;          // throws MissingError
  insertByCid(cid: CID, delegation: Delegation<D>): Promise<void>;
}
export function insert<D extends Did>(store: DelegationStore<D>, d: Delegation<D>): Promise<CID>;
export class MapDelegationStore<D extends Did> implements DelegationStore<D> { }  // Map<string(cid), Delegation>
export class MissingError extends Error { cid: CID; }
```
Rust's four Rc/Arc/BTreeMap/HashMap impls collapse to `MapDelegationStore` (checklist:
n/a duplicates). `StorePoisoned`/`LockedStoreGetError` are n/a (no mutex poisoning).

## 6. Build lanes (disjoint file ownership)

### Wave 1

**Lane V — packages/varsig (everything except the barrel)**
- Rust files: entire `varsig/src/**`, incl. its inline `#[cfg(test)]` tests (header.rs).
- TS files owned: `packages/varsig/**` — package.json, tsconfig.json, all of `src/`
  EXCEPT `src/index.ts` (Lane C's barrel, see below), plus `packages/varsig/test/**`
  (Lane V ports varsig's inline tests, incl. the header byte fixture below). Also owns
  `src/ipld.ts` (the §5.1 `Ipld` seam). No other lane touches varsig except Lane C's
  barrel file.
- Public API: everything in contract §5.7 (+ §5.1 `Ipld` type). Also `Varsig` header LEB128 encode/decode with
  the byte fixture test `[0x48,0x34,0x01,0xed,0x01,0xed,0x01,0x13,0x71]` (dag-cbor byte
  string wrapping `34 01 ed01 ed01 13 71` — note tags 0xed01? NO: tags are LEB128 of
  0x34,0x01,0xed,0xed,0x13,0x71 → bytes `34 01 ed 01 ed 01 13 71`; 0xed encodes as
  `ed 01`). Implement exactly and keep the fixture test.
- Consumes: nothing from ucan. Deps: @ipld/dag-cbor, @ipld/dag-json, multiformats, @noble/curves.
- Note: `jwt`/`eip191` Encoding variants exist but `encodePayload/decodePayload` throw
  `new Error("… not yet supported")` exactly as Rust `unimplemented!`.

**Lane C — ucan core primitives + all shared files**
- Rust files: cid.rs, ipld.rs (helpers; the type lives in varsig, §5.1), number.rs,
  time/*, crypto.rs, crypto/nonce.rs, unset.rs, sealed.rs, collection.rs, collections.rs,
  command.rs, promise.rs, did.rs, plus both crates' lib.rs re-export surfaces.
- TS files owned: root `package.json` (workspaces, `"engines": { "node": ">=18" }`, root
  `build`/`test` scripts, pinned dev deps), packages/ucan/{package.json,tsconfig.json},
  src/{cid,ipld,number,unset,sealed,collection,collections,command,promise,did}.ts,
  src/crypto/nonce.ts, src/time/*, and BOTH package barrels:
  `packages/ucan/src/index.ts` and `packages/varsig/src/index.ts`.
- Barrels are written COMPLETE in Wave 1: they re-export every public name per the §5
  contracts from their per-module files (`export * from "./envelope/index.js"` etc.),
  including modules that Wave-2 lanes will create. Later lanes create those module files
  but NEVER edit a barrel, a package.json, or any other lane's file. (Consequence: the
  ucan package typechecks only once Wave 2 lands; Wave-1 validation for Lane C is
  per-module tests.) Sub-`index.ts` files that port a real Rust module —
  signature/index.ts, time/index.ts, envelope/index.ts, delegation/index.ts,
  policy/index.ts, selector/index.ts, invocation/index.ts — are module ports owned by
  their module's lane, not barrels.
- Public API: contracts §5.1–5.6, §5.11–5.14. `did.ts` imports Ed25519 from @ucans/varsig.

### Wave 2 (after Wave 1 lands)

**Lane E — envelope + delegation (except policy)**
- Rust files: envelope.rs, envelope/payload_tag.rs, delegation.rs, delegation/subject.rs,
  delegation/store.rs, delegation/builder.rs.
- TS files owned: src/envelope/* and src/delegation/{index,subject,store,builder}.ts
  only (`src/index.ts` is Lane C's barrel — do not edit it).
- Public API: §5.8, §5.9, §5.16, plus `DelegationBuilder` with methods
  `issuer/audience/subject/command/commandFromStr/policy/expiration/notBefore/meta/nonce/issueNow/intoPayload/tryBuild`
  (runtime-checked required fields: issuer, audience, subject, command; auto
  `Nonce.generate16()` when unset).
- Consumes: Lane V (Varsig, Codec, Ed25519), Lane C (all), Lane P types only via
  `Predicate` import (may stub-import; Lane P lands in same wave — coordinate on the
  §5.15 contract, not code).

**Lane P — delegation/policy/****
- Rust files: policy.rs, predicate.rs, selector.rs, selector/{error,filter,select,selectable}.rs.
- TS files owned: src/delegation/policy/** (all five files).
- Public API: §5.15. Hand-port the nom parser (selector & filter grammars incl.
  `?` collapsing, `._foo`, `["json string"]` with full JSON-string escape decoding,
  slices, negative indices). Port `write_json_string` escaping for Display.
- Consumes: Lane C (Ipld, UcanNumber, Collection, ipldEquals).

**Lane I — invocation**
- Rust files: invocation.rs, invocation/builder.rs.
- TS files owned: src/invocation/*.
- Public API: §5.10 plus `InvocationBuilder` with methods
  `issuer/audience/subject/command/commandFromStr/arguments/proofs/expiration/issuedAt/issueNow/meta/nonce/build/tryBuild`
  (required: issuer, audience, subject, command, proofs).
  NOTE: ALL 11 builder fields are `pub` in Rust (builder.rs:36-66): issuer, audience,
  subject, command, arguments, proofs, cause, expiration, issued_at, meta, nonce.
  Mirror exactly: public mutable properties for all 11. `cause` (builder.rs:54) has NO
  fluent setter — settable only via the public property. Record in checklist.
- Consumes: Lane V, Lane C, Lane E (Envelope, Delegation, DelegationStore), Lane P (Predicate.run).

### Wave 3

**Lane T — ucan tests + conformance**
- Rust files: ucan's inline `#[cfg(test)]` modules (command.rs, nonce.rs, delegation.rs,
  subject.rs, invocation.rs, selector.rs, filter.rs, select.rs, predicate.rs)
  and ucan/tests/{delegation_conformance.rs,policy_conformance.rs} + fixtures.
  (varsig's header.rs tests belong to Lane V — see Wave 1.)
- TS files owned: packages/ucan/test/** ONLY, plus
  `cp .reference/rs-ucan/ucan/tests/fixtures/*.json packages/ucan/test/fixtures/`.
  `packages/varsig/test/**` is Lane V's.
- Port every deterministic `#[test]`; skip `proptest!` blocks (note them in the checklist
  as n/a) but port their fixed-seed spirit only where a deterministic equivalent is a
  one-liner. Key byte-exact tests: `delegation_b64_fixture_roundtrip`
  (base64 blob in delegation.rs tests — byte-exact re-serialize), subject null = `0xf6`,
  the Promised wire-encoding fixture (Rust-derived dag-cbor bytes, §5.11),
  all conformance fixtures (valid + invalid policy scenarios).
- Runner: vitest at each package root; the root `yarn test` script lives in the root
  package.json (Lane C's, written in Wave 1) and runs both workspaces.

## 7. Validation gates
- `yarn build` (tsc, both packages) clean.
- `yarn test` green: all ported unit tests + both conformance suites.
- Byte-exact roundtrip of the delegation fixture token is the master integration gate.
