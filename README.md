# ts-ucan

TypeScript implementation of [UCAN](https://github.com/ucan-wg/spec) (User-Controlled Authorization Networks) v1.0 — a trustless, secure, local-first, user-originated authorization and revocation scheme maintained by the [UCAN Working Group](https://github.com/ucan-wg).

UCANs are capability tokens: instead of asking a central server for permission, principals delegate authority directly to one another and invoke it offline-verifiably. Tokens are content-addressed, cryptographically signed, and chain together into verifiable proofs.

## Specifications

This library implements the UCAN 1.0 family of specifications:

- [UCAN core spec](https://github.com/ucan-wg/spec) — high-level semantics, principals, capabilities
- [Delegation](https://github.com/ucan-wg/delegation) — granting authority between principals, including the policy language
- [Invocation](https://github.com/ucan-wg/invocation) — exercising delegated authority, proof chains, promises/pipelining
- [Container / Envelope](https://github.com/ucan-wg/container) — the signed DAG-CBOR token envelope
- [Varsig](https://github.com/ChainAgnostic/varsig) — self-describing signature headers (algorithm, hash, payload encoding)
- [did:key](https://w3c-ccg.github.io/did-method-key/) — principal identifiers

## Packages

| Package | Contents |
|---|---|
| `@marktripoli/varsig` | Varsig headers, payload codecs (DAG-CBOR, DAG-JSON), EdDSA sign/verify, ECDSA verify (P-256/P-384/P-521/secp256k1), WebCrypto integration |
| `@marktripoli/ucan` | Delegation and invocation tokens with builders, the policy language (predicates + selectors), envelopes, `did:key` principals, timestamps, nonces, proof-chain checking |

## Wire format

Tokens are DAG-CBOR envelopes: a varsig header describing the signature scheme plus a tagged payload (`ucan/dlg@1.0.0-rc.1`, `ucan/inv@1.0.0-rc.1`), signed over the canonical encoding. Encoding and decoding round-trip byte-exactly and are covered by conformance fixtures.

## Usage

```ts
import { DelegationBuilder, InvocationBuilder } from "@marktripoli/ucan";

// Delegate a capability
const delegation = new DelegationBuilder()
  .issuer(aliceSigner)
  .audience(bobDid)
  .subject({ kind: "specific", did: aliceDid })
  .commandFromStr("/crud/create")
  .tryBuild();

// Invoke it (proofs reference delegations by CID)
const invocation = new InvocationBuilder()
  .issuer(bobSigner)
  .audience(aliceDid)
  .subject(aliceDid)
  .commandFromStr("/crud/create")
  .proofs([delegationCid])
  .issueNow()
  .tryBuild();
```

## Build

```sh
npm install
npm run build
```

## Test

```sh
npm test
```

Runs the unit suites for both packages plus the delegation and policy conformance fixtures.

## License

[Apache-2.0](LICENSE)
