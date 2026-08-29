# PARITY_CHECKLIST.md — rs-ucan → ts one-for-one parity

Status values: `todo`, `done`, `n/a — <reason>`. Reviewers flip `todo`→`done` only with
evidence (file + test). Reference commit: `59ff9b9`.

## varsig crate

### varsig/src/lib.rs
| Rust item | Target TS item | Status |
|---|---|---|
| module re-exports (`pub use header::Varsig`, pub mods) | packages/varsig/src/index.ts re-exports | todo |
| doc example (sign/verify roundtrip) | varsig/test/header.test.ts `docExampleRoundtrip` | todo |

### varsig/src/header.rs
| Rust item | Target TS item | Status |
|---|---|---|
| struct `Varsig<V, C, T>` | class `Varsig<V>` (header.ts) | todo |
| `Varsig::new` | `new Varsig(verifierCfg, codec)` | todo |
| `Varsig::verifier_cfg` | `varsig.verifierCfg` getter | todo |
| `Varsig::codec` | `varsig.codec` getter | todo |
| `Varsig::try_sign` | `varsig.trySign(sk, payload)` | todo |
| `Varsig::try_sign_async` | `varsig.trySignAsync(sk, payload)` | todo |
| `Varsig::try_verify` | `varsig.tryVerify(verifier, payload, sig)` | todo |
| `impl Default for Varsig<V, DagCborCodec, T>` | n/a — TS has explicit constructor; provide `Varsig.default(cfg)` only if a caller needs it | todo |
| `impl Default for Varsig<V, DagJsonCodec, T>` | n/a — same as above | n/a — no implicit defaults in TS |
| `impl Serialize for Varsig` (LEB128 0x34,0x01,prefix,tags,codec) | `varsig.encode(): Uint8Array` | todo |
| `impl Deserialize for Varsig` | `Varsig.decode(bytes, tryFromTags)` | todo |
| test `test_ed25519_varsig_header_round_trip` | header.test.ts | todo |
| test `test_ed25519_varsig_header_fixture` (bytes 48 34 01 ed 01 ed 01 13 71) | header.test.ts | todo |
| test `test_verifier_reader` | header.test.ts | todo |
| test `test_codec_reader` | header.test.ts | todo |
| test `test_try_verify` | header.test.ts | todo |

### varsig/src/codec.rs
| Rust item | Target TS item | Status |
|---|---|---|
| const `DAG_CBOR_CODE` (0x71) | `DAG_CBOR_CODE` | todo |
| const `DAG_JSON_CODE` (0x0129) | `DAG_JSON_CODE` | todo |
| trait `Codec<T>` (multicodec_code, try_from_tags, encode_payload, decode_payload) | interface `Codec` + `codecFromTags` | todo |
| struct/re-export `DagCborCodec` + `impl Codec` (std) | `DagCborCodec` singleton via @ipld/dag-cbor | todo |
| `impl Codec for DagCborCodec` (no_std variant) | n/a — single impl in TS | n/a — no_std |
| struct `DagCborEncodeError` / `DagCborDecodeError` | n/a — @ipld/dag-cbor throws native Error; wrapped by SignerError/VerificationError reasons | n/a — error-wrapper plumbing |
| `DagJsonCodec` + `impl Codec` | `DagJsonCodec` via @ipld/dag-json | todo |

### varsig/src/verify.rs
| Rust item | Target TS item | Status |
|---|---|---|
| trait `Verify` (Signature, Verifier, prefix, config_tags, try_from_tags, try_verify) | interface `Verify<Verifier>` + per-alg `TryFromTags` fns; Signature = Uint8Array | todo |
| default method `try_verify` (encode-then-verify) | shared helper `defaultTryVerify(codec, verifier, sig, payload, verifyFn)` used by all impls | todo |
| enum `VerificationError` (EncodingError, VerificationError) | class `VerificationError { reason }` | todo |

### varsig/src/signer.rs
| Rust item | Target TS item | Status |
|---|---|---|
| trait `Sign` (Signer, SignError, try_sign) | interface `Sign<Verifier, Signer>` | todo |
| trait `AsyncSign` (AsyncSigner, AsyncSignError, try_sign_async) | interface `AsyncSign<Verifier, AsyncSigner>` | todo |
| enum `SignerError` (EncodingError, SigningError, VarsigError) | class `SignerError { reason }` | todo |

### varsig/src/hash.rs
| Rust item | Target TS item | Status |
|---|---|---|
| trait `Multihasher` (MULTIHASH_TAG) | `MULTIHASH_TAG` const table | todo |
| structs Sha2_256(0x12)/Sha2_384(0x15)/Sha2_512(0x13)/Shake256(0x19)/Blake2b(0xb220)/Blake3(0x1e)/Keccak256(0x1b)/Keccak384(0x1c)/Keccak512(0x1d)/Sha3_256(0x16)/Sha3_384(0x15)/Sha3_512(0x14) | keys in `MULTIHASH_TAG` (12 entries, same codes incl. the Sha2_384/Sha3_384 = 0x15 duplication) | todo |

### varsig/src/curve.rs
| Rust item | Target TS item | Status |
|---|---|---|
| structs Secp256k1/Secp256r1/Secp384r1/Secp521r1/Edwards25519/Edwards448 + aliases P256/P384/P521 | `Curve` string union + `P256`/`P384`/`P521` type aliases | todo |

### varsig/src/encoding.rs
| Rust item | Target TS item | Status |
|---|---|---|
| enum `Encoding` (DagCbor 0x71, DagJson 0x0129, Jwt 0x6a77, Eip191 0xe191) | class/object `Encoding` implementing `Codec` with runtime code | todo |
| `impl Codec for Encoding` (jwt/eip191 `unimplemented!`) | encode/decode throw "not yet supported" for jwt/eip191 | todo |
| enum `EncodingError` / `DecodingError` | n/a — native errors propagate (see codec.rs note) | n/a — error-wrapper plumbing |

### varsig/src/signature.rs
| Rust item | Target TS item | Status |
|---|---|---|
| enum `Common` (Es256/Es256k/Ed25519) | `Common` discriminated union (signature/index.ts) | todo |

### varsig/src/signature/eddsa.rs
| Rust item | Target TS item | Status |
|---|---|---|
| struct `EdDsa<C, H>` + `EdDsa::new` | n/a — generic zero-sized config collapses; only Ed25519 alias is constructible | n/a — merged into Ed25519 |
| trait `EdDsaCurve` + impl for Edwards25519 | n/a — type-level marker | n/a — type machinery |
| type `Ed25519` | class `Ed25519` | todo |
| `impl Verify for Ed25519` (prefix 0xed, tags [0xed,0x13], try_from_tags [0xed,0xed,0x13]) | `Ed25519.prefix/configTags` + `ed25519TryFromTags` | todo |
| `impl Sign for Ed25519` (ed25519_dalek::SigningKey) | `Ed25519.trySign` via @noble/curves ed25519 | todo |

### varsig/src/signature/ecdsa.rs
| Rust item | Target TS item | Status |
|---|---|---|
| struct `EcDsa<C, H>` / trait `EcDsaCurve` + 4 curve impls | n/a — merged into the four concrete classes | n/a — type machinery |
| type `Es256` + `impl Verify` (0xec, [0x1201,0x15]) | class `Es256` + `es256TryFromTags` (p256) | todo |
| type `Es384` + `impl Verify` (0xec, [0x1202,0x20]) | class `Es384` + `es384TryFromTags` (p384) | todo |
| type `Es512` + `impl Verify` (0xec, [0x1202,0x13]) | class `Es512` + `es512TryFromTags` (p521) | todo |
| struct `P521VerifyingKey` (+Debug/Verifier/From impls) | n/a — noble p521 keys are plain bytes; Debug newtype unneeded | n/a — Rust Debug workaround |
| type `Es256k` + `impl Verify` (0xec, [0xe7,0x12]) | class `Es256k` + `es256kTryFromTags` (secp256k1) | todo |
| (no `impl Sign` for the ECDSA types) | n/a — rs-ucan implements `Verify` only for ECDSA (ecdsa.rs:51, :77, :139, :165); the four TS classes are VERIFY-ONLY, no `trySign` | n/a — verify-only upstream |

### varsig/src/signature/web_crypto.rs
| Rust item | Target TS item | Status |
|---|---|---|
| enum `WebCrypto` (Es256/Es384/Es512/Ed25519) | `WebCrypto` union | todo |
| enum `WebCryptoSignature` | n/a — signatures are raw bytes in TS | n/a — SignatureEncoding collapses to Uint8Array |
| enum `WebCryptoVerifier` | `WebCryptoVerifier` union `{ alg, key: Uint8Array }` | todo |
| `impl SignatureEncoding for WebCryptoSignature` + TryFrom impls (length-sniffing decode) | n/a — bytes stay bytes; algorithm chosen by header | n/a — collapses |
| `impl Verifier<WebCryptoSignature> for WebCryptoVerifier` (matching-variant dispatch) | `webCryptoVerify(verifier, msg, sig)` with variant-mismatch error | todo |
| `impl Verify for WebCrypto` (prefix/config_tags/try_from_tags dispatch) | `WebCrypto` methods + `webCryptoTryFromTags` | todo |

## ucan crate

### ucan/src/lib.rs
| Rust item | Target TS item | Status |
|---|---|---|
| pub mods + `pub use Delegation`, `DelegationBuilder` | packages/ucan/src/index.ts | todo |
| private mods `ipld`, `sealed` | exported in TS (ipld.ts is the shared Ipld type) — deliberate visibility widening, note in doc | todo |

### ucan/src/cid.rs
| Rust item | Target TS item | Status |
|---|---|---|
| fn `to_dagcbor_cid` (dag-cbor + sha2-256 + CIDv1 0x71) | `toDagCborCid(value)` | todo |

### ucan/src/ipld.rs
| Rust item | Target TS item | Status |
|---|---|---|
| enum `InternalIpld` (9 variants) | `Ipld` union type — defined in packages/varsig/src/ipld.ts (cycle-free seam, §5.1), re-exported by ucan/src/ipld.ts; Rust newtype exists only for trait impls | todo |
| fn `eq_with_float_nans_and_infinities` | `ipldEqualsWithFloatNansAndInfinities` | todo |
| `From<InternalIpld> for Ipld` / `From<Ipld> for InternalIpld` | n/a — one type in TS | n/a — merged |
| `impl Selectable for InternalIpld` | covered by `selectIpld` | todo |

### ucan/src/number.rs
| Rust item | Target TS item | Status |
|---|---|---|
| enum `Number` (Float, Integer) | `UcanNumber` union | todo |
| `impl PartialOrd for Number` (f64::MAX bound logic) | `numberCompare` | todo |
| `From<Number> for Ipld` | `numberToIpld` | todo |
| `TryFrom<Ipld> for Number` | `numberFromIpld` | todo |
| struct `NotANumber` error | `NotANumberError` | todo |
| `From<i128> for Number` / `From<f64> for Number` | literal construction (`{kind:"integer",value}`) | n/a — trivial constructors |

### ucan/src/unset.rs
| Rust item | Target TS item | Status |
|---|---|---|
| struct `Unset` | `Unset` unique symbol + type | todo |

### ucan/src/sealed.rs
| Rust item | Target TS item | Status |
|---|---|---|
| traits DidOrUnset / DidSignerOrUnset / DelegatedSubjectOrUnset / CommandOrUnset / ProofsOrUnset (+impls) | type aliases in sealed.ts (`D | Unset` unions) used by builder generics | todo |

### ucan/src/collections.rs
| Rust item | Target TS item | Status |
|---|---|---|
| std/no_std `Map`/`Set`/`Entry` aliases | `UcanMap`/`UcanSet` type aliases; `Entry` n/a (no entry API in JS Map) | todo |

### ucan/src/collection.rs
| Rust item | Target TS item | Status |
|---|---|---|
| enum `Collection` (Array, Map) | `Collection` union | todo |
| derived `Serialize`/`Deserialize` for Collection (collection.rs:17; externally tagged) | `collectionToWireIpld`/`wireIpldToCollection` (`{"Array": [...]}` / `{"Map": {...}}`) | todo |
| `Collection::to_vec` | `collectionToVec` | todo |
| `Collection::is_empty` | `collectionIsEmpty` | todo |
| `impl FromIterator<Ipld>` (map-merge or single-array fallback) | `collectionFromIterable(iter)` exact-port semantics | todo |
| `From<Collection> for Vec<Ipld>` / `From<&Collection> for Vec<&Ipld>` | `collectionToVec` covers both | todo |
| `From<Vec<Ipld>>` / `From<BTreeMap>` / `From<HashMap>` for Collection | literal construction | n/a — trivial constructors |
| `From<Collection> for Ipld` | `collectionToIpld` | todo |
| `impl Arbitrary for Collection` | n/a — proptest support | n/a — property testing skipped |

### ucan/src/command.rs
| Rust item | Target TS item | Status |
|---|---|---|
| enum `CommandParseError` (4 variants) | `CommandParseError { reason }` | todo |
| struct `Command` | class `Command` | todo |
| `Command::parse` | `Command.parse` | todo |
| `Command::new` | `new Command(segments)` | todo |
| `Command::segments` | `.segments` | todo |
| `Command::starts_with` | `.startsWith` | todo |
| `From<Vec<String>>`/`From<Command> for Vec<String>` | constructor / `.segments` | n/a — trivial |
| `impl Display` | `.toString()` | todo |
| `impl Serialize`/`Deserialize`/`FromStr` | `toIpld`/`fromIpld`/`parse` | todo |
| tests: test_valid_root_command, test_valid_single_segment, test_valid_two_segments, test_valid_many_segments, test_valid_unicode, test_invalid_missing_leading_slash, test_invalid_trailing_slash, test_invalid_trailing_slash_nested, test_invalid_uppercase, test_invalid_mixed_case, test_invalid_empty_segment, test_json_roundtrip, test_json_roundtrip_root, test_cbor_roundtrip, test_cbor_roundtrip_root, test_deserialize_rejects_missing_leading_slash, test_deserialize_rejects_trailing_slash, test_deserialize_rejects_uppercase, test_deserialize_rejects_empty_segment, test_starts_with_root_matches_all, test_starts_with_prefix_matches, test_starts_with_different_prefix_no_match, test_starts_with_similar_prefix_no_match | command.test.ts (23 tests, same names camelCased) | todo |

### ucan/src/crypto.rs
| Rust item | Target TS item | Status |
|---|---|---|
| `pub mod nonce` | crypto/nonce.ts re-export from index | todo |

### ucan/src/crypto/nonce.rs
| Rust item | Target TS item | Status |
|---|---|---|
| enum `Nonce` (Nonce16, Custom) | class `Nonce { kind }` | todo |
| `impl PartialEq` (cross-variant byte equality) | `.equals` | todo |
| `From<[u8;16]>`/`From<Vec<u8>>`/`From<Nonce> for Vec<u8>` | `Nonce.fromBytes` / `.toBytes` | todo |
| `Nonce::from_bytes` | `Nonce.fromBytes` | todo |
| `Nonce::generate_16` | `Nonce.generate16` (crypto.getRandomValues) | todo |
| `impl Display` (hex, `{:#}` adds 0x) | `.toString()` hex (no alternate mode; document) | todo |
| `From<Nonce> for Ipld` / `TryFrom<Ipld>` | `.toIpld` / `Nonce.fromIpld` | todo |
| struct `NoncesMustBeBytes` | `NoncesMustBeBytesError` | todo |
| `impl Hash for Nonce` | n/a — JS has no Hash trait | n/a — trait plumbing |
| struct `SerialNonce` (serde bytes helper) | n/a — toIpld handles bytes directly | n/a — serde plumbing |
| test `ipld_roundtrip_16` | nonce.test.ts | todo |
| proptest `proptest_roundtrip_serde` | deterministic loop over sample byte lengths (0,1,15,16,17,32) | todo |

### ucan/src/time.rs, time/timestamp.rs, time/error.rs
| Rust item | Target TS item | Status |
|---|---|---|
| struct `Timestamp` | class `Timestamp` | todo |
| `Timestamp::from_unix` (2^53 bound) | `Timestamp.fromUnix` | todo |
| `Timestamp::new(SystemTime)` | `Timestamp.fromDate(Date)` | todo |
| `Timestamp::now` | `Timestamp.now` | todo |
| `Timestamp::five_minutes_from_now` | `Timestamp.fiveMinutesFromNow` | todo |
| `Timestamp::five_years_from_now` | `Timestamp.fiveYearsFromNow` | todo |
| `Timestamp::to_unix` | `.toUnix()` | todo |
| `Timestamp::postel_unix` | `Timestamp.postelUnix(number \| bigint)` — no 2^53 bound; bigint-capable storage preserves values through u64::MAX (timestamp.rs:114) | todo |
| wasm32 `from_date`/`to_date` (js_sys) | `Timestamp.fromDate`/`.toDate()` (native Date; ms-bound check ported) | todo |
| `TryFrom<SystemTime>` / `From<Timestamp> for SystemTime` | fromDate/toDate | n/a — merged above |
| `From<Timestamp> for Ipld` / `TryFrom<Ipld>` | `.toIpld` / `Timestamp.fromIpld` | todo |
| enum `TimestampFromIpldError` | `TimestampFromIpldError { reason }` | todo |
| `From<Timestamp> for i128` / `TryFrom<i128>` | number/bigint accepted by fromUnix | todo |
| `impl Serialize`/`Deserialize` (postel on decode) | encode = toUnix int; decode = postelUnix (u64 semantics: bigint-capable, timestamp.rs:238-239) | todo |
| `impl Arbitrary` | n/a — property testing skipped | n/a |
| enum `OutOfRangeError` (TooLarge, BeforeEpoch) | `OutOfRangeError { reason }` | todo |
| enum `NumberIsNotATimestamp` | `NumberIsNotATimestampError` | todo |
| enum `TimeBoundError` (Expired, NotYetValid) | `TimeBoundError { reason }` | todo |
| struct `Expired` | `ExpiredError` | todo |

### ucan/src/promise.rs
| Rust item | Target TS item | Status |
|---|---|---|
| enum `Promise<T,E>` (6 variants) | `Promise_<T,E>` union | todo |
| derived `Serialize`/`Deserialize` for `Promise<T,E>` (promise.rs:9-10; externally tagged) | `promiseToWireIpld`/`wireIpldToPromise` (parameterized by T/E converters) | todo |
| enum `Promised` (12 variants) | `Promised` union | todo |
| `TryFrom<&Promised> for Ipld` | `promisedToIpld` (throws WaitingOnError) | todo |
| serde `Serialize`/`Deserialize` for Promised (promise.rs:33-55; externally tagged for EVERY variant) | `promisedToWireIpld`/`wireIpldToPromised` — `Bool(true)` → `{"Bool": true}`, unit `Null` → `"Null"`; locked by Rust-derived dag-cbor byte fixture | todo |
| enum `WaitingOn` (WaitOk/WaitErr/WaitAny) | `WaitingOnError { reason, cid }` | todo |

### ucan/src/did.rs
| Rust item | Target TS item | Status |
|---|---|---|
| trait `Did` (VarsigConfig, did_method, varsig_config) | interface `Did` | todo |
| trait `DidSigner` (Did, did, signer) | interface `DidSigner` | todo |
| struct `Ed25519Did` | class `Ed25519Did` | todo |
| `From<VerifyingKey>` / `From<SigningKey>` for Ed25519Did | `new Ed25519Did(pubkey)` / `Ed25519Did.fromSecretKey(sk)` | todo |
| `impl Display for Ed25519Did` (did:key:z + base58btc of 0xed01‖pk) | `.toString()` | todo |
| `impl FromStr for Ed25519Did` | `Ed25519Did.fromString` | todo |
| enum `Ed25519DidFromStrError` (4 variants) | `Ed25519DidFromStrError { reason }` | todo |
| `impl Did for Ed25519Did` | class implements Did | todo |
| `impl Serialize`/`Deserialize` for Ed25519Did (strict visitor: 34 bytes, 0xED01 header) | `toString`/`fromString` with identical validation messages | todo |
| struct `Ed25519Signer` (new, did, signer accessors) | class `Ed25519Signer` | todo |
| `From<SigningKey> for Ed25519Signer` | constructor | n/a — trivial |
| `impl Display`/`DidSigner`/`Serialize` for Ed25519Signer | `.toString()` / implements DidSigner / toIpld via did | todo |

### ucan/src/envelope.rs + envelope/payload_tag.rs
| Rust item | Target TS item | Status |
|---|---|---|
| struct `Envelope<V,T,S>` (sig, payload tuple) | interface `Envelope<V,T>` | todo |
| `impl Serialize for Envelope` (2-tuple, bytes sig) | `envelopeToIpld` | todo |
| `impl Deserialize for Envelope` (seq visitor) | `envelopeFromIpld` | todo |
| struct `EnvelopePayload<V,T>` (header, payload) | interface `EnvelopePayload` | todo |
| `impl Serialize for EnvelopePayload` ({"h": varsig, tag: payload}) | inside `envelopeToIpld` | todo |
| `impl Deserialize for EnvelopePayload` (envelope.rs:161-184: ANY non-"h" key is the payload — key name NOT validated; errors only on dup "h", second payload field, missing "h"/payload, non-bytes header) | inside `envelopeFromIpld` (no wrong-tag rejection) | todo |
| trait `PayloadTag` (spec_id, version, tag) | interface `PayloadTag` + `tagOf` | todo |

### ucan/src/delegation.rs
| Rust item | Target TS item | Status |
|---|---|---|
| struct `Delegation<D>` | class `Delegation<D>` | todo |
| `Delegation::builder` | `Delegation.builder()` | todo |
| getters issuer/audience/subject/command/policy/expiration/not_before/meta/nonce | same-named getters (notBefore) | todo |
| `Delegation::to_cid` | `.toCid()` | todo |
| `impl Debug/Clone` | n/a — JS objects | n/a |
| `impl Serialize`/`Deserialize` for Delegation | `.encode()` / `Delegation.decode()` (+ toIpld/fromIpld) | todo |
| struct `DelegationPayload<D>` + all getters | interface `DelegationPayload` (plain fields) | todo |
| `impl Serialize for DelegationPayload` (serde rename iss/aud/sub/cmd/pol/exp/nbf/meta/nonce; `nbf` key ALWAYS emitted — int or null, no skip_serializing_if, delegation.rs:130-151) | `delegationPayloadToIpld` | todo |
| `impl Deserialize for DelegationPayload` (custom visitor: dup keys, unknown keys, strict nonce-bytes, nbf missing or null → null (delegation.rs:245, :391), meta optional, exp required) | `ipldToDelegationPayload` with identical rules | todo |
| `impl PayloadTag for DelegationPayload` ("dlg","1.0.0-rc.1") | `delegationPayloadTag` | todo |
| test `issuer_round_trip` | delegation.test.ts | todo |
| test `delegation_b64_fixture_roundtrip` (byte-exact) | delegation.test.ts | todo |
| test `delegation_payload_any_subject_serializes_to_null` | delegation.test.ts | todo |

### ucan/src/delegation/subject.rs
| Rust item | Target TS item | Status |
|---|---|---|
| enum `DelegatedSubject<D>` (Specific, Any) | `DelegatedSubject` union | todo |
| `DelegatedSubject::allows` | `subjectAllows` | todo |
| `DelegatedSubject::coherent` | `subjectCoherent` | todo |
| `From<D> for DelegatedSubject<D>` | literal construction | n/a — trivial |
| `impl Display` (Any → "Null") | `subjectToString` | todo |
| `impl Serialize` (Any → null) / `Deserialize` (null/str visitor) | `subjectToIpld` / `ipldToSubject` | todo |
| tests any_serializes_to_null (0xf6), any_deserializes_from_null, any_roundtrip, specific_roundtrip | subject.test.ts (4 tests) | todo |

### ucan/src/delegation/builder.rs
| Rust item | Target TS item | Status |
|---|---|---|
| struct `DelegationBuilder<D,A,S,C>` typestate | class `DelegationBuilder` (runtime checks + generic tracking where cheap) | todo |
| `new`/`default` | `new DelegationBuilder()` | todo |
| setters issuer/audience/subject/command/command_from_str/policy/expiration/not_before/meta/nonce/issue_now | same-named methods (commandFromStr, notBefore, issueNow) | todo |
| `into_payload` (auto nonce) | `.intoPayload()` | todo |
| `try_build` (sign + wrap envelope) | `.tryBuild()` | todo |

### ucan/src/delegation/store.rs
| Rust item | Target TS item | Status |
|---|---|---|
| trait `DelegationStore<K,D,T>` (get_all, insert_by_cid) | interface `DelegationStore<D>` (async) | todo |
| fn `insert` | `insert(store, delegation): Promise<CID>` | todo |
| impl for `Rc<RefCell<BTreeMap>>` | `MapDelegationStore` | todo |
| impl for `Rc<RefCell<HashMap>>` | n/a — one Map-backed store in TS | n/a — duplicate std impl |
| impl for `Arc<Mutex<HashMap>>` (future_form Local/Sendable) | n/a — no Send/Sync distinction in JS | n/a — concurrency plumbing |
| struct `StorePoisoned` | n/a — no mutex poisoning | n/a |
| struct `Missing(Cid)` | `MissingError { cid }` | todo |
| enum `LockedStoreGetError` | n/a — collapses with StorePoisoned | n/a |

### ucan/src/delegation/policy.rs
| Rust item | Target TS item | Status |
|---|---|---|
| pub mods predicate/selector | policy/index.ts re-exports | todo |

### ucan/src/delegation/policy/predicate.rs
| Rust item | Target TS item | Status |
|---|---|---|
| enum `Predicate` (11 variants) | `Predicate` union | todo |
| `impl Serialize` (tuple forms; Not(Equal)→"!=") | `predicateToWireIpld` (used by dag-cbor encode) | todo |
| `impl Deserialize` (seq visitor, 12 tags incl "!=") | `wireIpldToPredicate` | todo |
| `impl Arbitrary` | n/a — property testing skipped | n/a |
| `Predicate::run` (all 11 semantics incl. int/whole-float Equal coercion, empty Or/Any → true) | `runPredicate` | todo |
| fn `glob` (escaping, fold algorithm) | `glob` exact port | todo |
| `TryFrom<Ipld> for Predicate` (string-selector triple form) | `ipldToPredicate` | todo |
| enum `FromIpldError` (10 variants) | `FromIpldError { reason }` | todo |
| `From<Predicate> for Ipld` | `predicateToIpld` | todo |
| enum `RunError` (3 variants) | `RunError { reason }` | todo |
| glob tests: test_concrete, test_concrete_fail, test_empty_pattern_fail, test_escaped_star, test_inner_escaped_star, test_empty_string_fail, test_left_star, test_left_star_failure, test_right_star, test_right_star_failure, test_only_star, test_two_stars, test_two_stars_fail, test_multiple_inner_stars, test_multiple_inner_stars_fail, test_concrete_with_multiple_inner_stars | predicate.test.ts (16) | todo |
| run tests: test_eq, test_eq_try_null, test_eq_dot_field_ending_try_null, test_eq_dot_field_inner_try_null, test_eq_root_try_not_null, test_eq_try_not_null, test_eq_nested_try_null, test_eq_fail_same_type, test_eq_bad_selector, test_eq_fail_different_type, test_gt, test_gt_fail, test_gte, test_gte_fail, test_lt, test_lt_fail, test_lte, test_lte_fail, test_like, test_like_fail_concrete, test_like_fail_left_star, test_like_fail_right_star, test_like_fail_both_stars, test_not, test_double_negative, test_not_fail, test_and_both_succeed, test_and_left_fail, test_and_right_fail, test_and_both_fail, test_or_both_succeed, test_or_left_fail, test_or_right_fail, test_or_both_fail, test_all, test_all_failure, test_any_all_succeed, test_any_not_all, test_any_all_fail, test_alternate_all_and_any, test_alternate_fail_all_and_any, test_alternate_any_and_all, test_alternate_fail_any_and_all, test_deeply_alternate_any_and_all | predicate.test.ts (44) | todo |
| roundtrip tests: test_not_equal_dagcbor_roundtrip, test_not_equal_ipld_roundtrip | predicate.test.ts (2) | todo |

### ucan/src/delegation/policy/selector.rs
| Rust item | Target TS item | Status |
|---|---|---|
| struct `Selector(Vec<Filter>)` + `new` + `is_related` | class `Selector` — `constructor(filters: Filter[] = [])`; `new Selector()` = identity selector (selector.rs:35-36) | todo |
| `impl Display` | `.toString()` | todo |
| `impl FromStr` (nom grammar: leading dot, `..` rejection, `?` prefixes, try-dot-field) | `Selector.fromString` hand parser | todo |
| `impl Serialize`/`Deserialize` (string form) | toIpld/fromIpld = string | todo |
| struct `SelectorError` + `from_refs` | `SelectorError` | todo |
| derived `Serialize`/`Deserialize` for SelectorError (selector.rs:121-128) | `selectorErrorToIpld`/`ipldToSelectorError` (`{"selector": <string form>, "reason": <reason wire>}`) | todo |
| `impl PartialOrd for Selector` (prefix ordering) | `.compare()` | todo |
| tests: test_bare_dot, test_dot_try, test_dot_many_tries, test_inner_try_is_null, test_dot_many_tries_and_dot_field, test_multiple_question_marks, test_fails_trailing_dot, test_fails_leading_double_dot, test_fails_inner_double_dot, test_fails_multiple_leading_dots, test_fail_missing_leading_dot, test_dot_field, test_multiple_dot_fields, test_fairly_complex, test_very_complex | selector.test.ts (15) | todo |

### ucan/src/delegation/policy/selector/error.rs
| Rust item | Target TS item | Status |
|---|---|---|
| enum `ParseError` (4 variants; each carries the offending input string) | `ParseError { reason, input }` | todo |
| derived `Serialize`/`Deserialize` for ParseError (selector/error.rs:8-24) | `parseErrorToIpld`/`ipldToParseError` (externally tagged with input string, e.g. `{"TrailingInput": s}`) | todo |
| enum `SelectorErrorReason` (7 variants) | `SelectorErrorReason` union | todo |
| derived `Serialize`/`Deserialize` for SelectorErrorReason (selector/error.rs:26-37) | `selectorErrorReasonToIpld`/`ipldToSelectorErrorReason` (Rust variant-name strings, e.g. `"IndexOutOfBounds"`) | todo |

### ucan/src/delegation/policy/selector/selectable.rs
| Rust item | Target TS item | Status |
|---|---|---|
| trait `Selectable` | `Selectable<T>` fn type | todo |
| impls for Ipld / Number / String / Collection | `selectIpld`/`selectNumber`/`selectString`/`selectCollection` | todo |

### ucan/src/delegation/policy/selector/filter.rs
| Rust item | Target TS item | Status |
|---|---|---|
| enum `Filter` (5 variants) | `Filter` union | todo |
| `Filter::is_in` | `filterIsIn` | todo |
| `Filter::is_dot_field` | `filterIsDotField` | todo |
| fn `write_json_string` | JSON-string escape in `filterToString` | todo |
| `impl Display for Filter` (dot-safe heuristic) | `filterToString` | todo |
| parser fns: parse, parse_try, parse_try_dot_field, parse_slice(+inner, opt_signed_int), parse_non_try, parse_array_index, parse_values, parse_field, parse_dot_field, parse_dot_alpha_field, parse_dot_underscore_field, parse_empty_quotes_field, unicode_or_space, parse_delim_field, json_string/decode_json_string_literal, hex4 | hand-written parser in filter.ts exposing `parseFilter` + internal helpers with same coverage (incl. surrogate pairs, `?` collapsing to single Try) | todo |
| `impl Serialize for Filter` (tagged seq) | `filterToIpld` | todo |
| `impl Deserialize for Filter` | `ipldToFilter` | todo |
| enum `FilterTextError` / `FilterParseError` | `FilterParseError { reason }` (merged; both are parse-internal) | todo |
| `impl FromStr for Filter` (rejects trailing input) | `parseFilter` | todo |
| `impl Arbitrary` + 2 proptests | n/a — property testing skipped | n/a |
| tests: test_fails_on_empty, test_fails_on_bare_dot, test_fails_on_multiple_bare_dots, test_fails_on_leading_dots, test_fails_on_empty_whitespace, test_fails_leading_whitespace, test_fails_trailing_whitespace, test_values, test_values_fails_inner_whitespace, test_array_index_zero, test_array_index_small, test_array_index_large, test_array_from_end, test_array_fails_spaces, test_dot_field, test_dot_field_starting_underscore, test_dot_field_trailing_underscore, test_fails_dot_field_with_leading_number, test_fails_dot_field_with_inner_symbol, test_delim_field, test_delim_field_fails_without_quotes, test_delim_field_fails_if_missing_right_brace, test_delim_field_starting_underscore, test_delim_field_trailing_underscore, test_delim_field_with_leading_number, test_delim_field_with_inner_symbol, test_try, test_parse_try, test_multiple_tries_after_dot_field, test_parse_multiple_tries_after_dot_field, test_parse_multiple_tries_after_dot_field_trailing, test_parse_many0_multiple_tries_after_dot_field, test_multiple_tries_after_delim_field, test_multiple_tries_after_delim_field_inner_questionmarks, test_multiple_tries_after_values, test_multiple_tries_after_index, test_slice_both, test_slice_start_only, test_slice_end_only, test_slice_both_negative, test_slice_open, test_slice_negative_start, test_slice_display_roundtrip, test_fails_bare_try, test_fails_dot_try | filter.test.ts (45) | todo |

### ucan/src/delegation/policy/selector/select.rs
| Rust item | Target TS item | Status |
|---|---|---|
| fn `resolve_slice_indices` | `resolveSliceIndices` | todo |
| struct `Select<T>` + `new` + `is_related` | class `Select<T>` | todo |
| `impl Serialize`/`Deserialize` for Select | toIpld/fromString | todo |
| `Select::get` (try→root-retry→null semantics; bytes index→Integer; slice clamp) | `.get(ctx)` exact port | todo |
| `From<Select<T>> for Ipld` | `.toIpld()` (selector string) | todo |
| `impl FromStr for Select` + struct `ParseError` wrapper | `Select.fromString` (reuses selector ParseError) | todo |
| `impl PartialOrd for Select` | `.compare()` | todo |
| `impl Arbitrary` + 3 proptests (identity, try_missing_is_null, try_missing_plus_trailing) | n/a — property tests skipped; identity + try-null covered deterministically | todo |
| tests: test_slice_list, test_slice_list_open_end, test_slice_list_open_start, test_slice_negative_end, test_byte_index, test_byte_slice, test_slice_both_negative, test_slice_negative_start_open_end, test_slice_full_copy, test_slice_empty_when_start_ge_end, test_slice_out_of_bounds_clamps, test_byte_negative_index, test_byte_slice_negative, test_byte_index_out_of_bounds_with_try, test_slice_on_non_list_fails, test_slice_on_non_list_with_try_returns_null, test_byte_index_spec_example | select.test.ts (17) | todo |

### ucan/src/invocation.rs
| Rust item | Target TS item | Status |
|---|---|---|
| struct `Invocation<D>` + builder() + 9 getters | class `Invocation` | todo |
| `impl Debug/Clone/Serialize/Deserialize` | encode/decode/toIpld/fromIpld | todo |
| struct `InvocationPayload<D>` + 10 getters + serde renames (iss/aud/sub/cmd/arg/prf/cause/iat/exp/meta/nonce) | interface `InvocationPayload` + `invocationPayloadToIpld`/`ipldToInvocationPayload` | todo |
| `InvocationPayload::to_cid` | `invocationPayloadToCid` | todo |
| `InvocationPayload::check` (store-backed) | `check(payload, store)` | todo |
| `InvocationPayload::syntatic_checks` (subject-allows, issuer chain, command prefix, policy run, final issuer==invoker) | `syntaticChecks(payload, proofs)` — keep Rust misspelling | todo |
| `impl PayloadTag` ("inv","1.0.0-rc.1") | `invocationPayloadTag` | todo |
| enum `CheckFailed` (7 variants) | `CheckFailed { reason }` | todo |
| enum `StoredCheckError` (GetError, CheckFailed) | `StoredCheckError` | todo |
| test `issuer_round_trip` | invocation.test.ts | todo |

### ucan/src/invocation/builder.rs
| Rust item | Target TS item | Status |
|---|---|---|
| struct `InvocationBuilder` typestate + `new` | class `InvocationBuilder` | todo |
| 11 public fields issuer/audience/subject/command/arguments/proofs/cause/expiration/issued_at/meta/nonce (all `pub`, builder.rs:36-66) | public mutable properties on `InvocationBuilder`, same names camelCased | todo |
| public mutable `cause` field with NO fluent setter (builder.rs:54) | public `cause` property, settable directly; no `cause()` method | todo |
| setters issuer/audience/subject/command/command_from_str/arguments/proofs/expiration/issued_at/issue_now/meta/nonce | same-named methods (no `cause` setter — see row above) | todo |
| `build` (unsigned payload, auto nonce) | `.build()` | todo |
| `try_build` (signed Invocation) | `.tryBuild()` | todo |

### ucan/tests
| Rust item | Target TS item | Status |
|---|---|---|
| delegation_conformance: test_expected_version, test_top_level_parse | test/delegationConformance.test.ts | todo |
| policy_conformance: full valid scenarios 0..5 & invalid scenarios 0..3 (every `#[test]` inside, one per policy index) | test/policyConformance.test.ts (enumerate all scenarios/policies from fixture, same granularity) | todo |
| fixtures delegation.json / policy.json | test/fixtures/*.json verbatim copies | todo |

### ucan_wasm crate (entire)
| Rust item | Target TS item | Status |
|---|---|---|
| ucan_wasm/src/lib.rs (wasm-bindgen exports) | n/a — wasm→JS bindings are obsolete when the library is native TypeScript | n/a |

### Old ts-ucan packages
| Item | Target | Status |
|---|---|---|
| packages/core, packages/default-plugins, packages/ucans (UCAN 0.x JWT) | deleted; replaced by packages/varsig + packages/ucan | todo |
| root package.json (old scripts, engines >=15, ts-node) | rewritten by Lane C: workspaces, `engines.node >=18`, root build/test scripts, pinned dev deps (`typescript@^5`, `vitest@^3`) | todo |
