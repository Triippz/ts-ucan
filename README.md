# UCAN TS

This repository is a UCAN 1.0 one-for-one TypeScript port of [`rs-ucan`](.reference/rs-ucan).

Packages:
- `@ucans/varsig` — varsig headers, codecs, signatures
- `@ucans/ucan` — delegation, invocation, policy, envelopes

Notes:
- wire format is DAG-CBOR envelope + varsig
- delegation / invocation / policy semantics follow `rs-ucan`
- `ucan_wasm` is not applicable here

## Build

```sh
npm run build
```

## Test

```sh
npm test
```
