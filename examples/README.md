# Examples

Run these after `npm install && npm run build`. Each script is a plain TypeScript file you can execute directly with Node and it shows one end-to-end UCAN flow.

| File | What it shows | Run command |
|---|---|---|
| `01-delegation-roundtrip.ts` | delegation encode/decode byte-exact roundtrip | `node examples/01-delegation-roundtrip.ts` |
| `02-invocation-and-check.ts` | delegation → invocation → `check()` with success, policy failure, and expiry | `node examples/02-invocation-and-check.ts` |
| `03-policy-language.ts` | `ipldToPredicate()` and `runPredicate()` on the policy language | `node examples/03-policy-language.ts` |
| `04-revocation.ts` | chained delegations, revocation invocations, and `checkWithRevocations()` | `node examples/04-revocation.ts` |
| `05-rest-api.ts` | UCANs over HTTP with bearer/proof headers and live `fetch()` | `node examples/05-rest-api.ts` |
| `06-container-transport.ts` | container v0.1.0 raw/base64 transport and unpacking | `node examples/06-container-transport.ts` |
