/**
 * Semantic checks: a valid delegation passes, a policy mismatch fails, and an
 * expired proof fails.
 *
 * Alice delegates to Bob; Bob invokes on Alice's behalf. `check()` validates
 * the delegation chain, predicate, and time bounds.
 *
 * WARNING: `check()` is SEMANTIC-ONLY. It does NOT verify envelope signatures,
 * proof CIDs, the executor audience, or replay. It MUST NOT be used as an
 * authorization gate on untrusted input. For real authorization, use
 * `verifyInvocation()` (see examples/05-rest-api.ts).
 *
 * Run:
 *   node examples/02-invocation-and-check.ts
 */
import assert from "node:assert/strict";
import {
  CheckFailed,
  DelegationBuilder,
  Ed25519Signer,

  InvocationBuilder,
  MapDelegationStore,
  StoredCheckError,
  Timestamp,
  check,
  insert,
  ipldToPredicate,
} from "@marktripoli/ucan";

function signer(seed: number): Ed25519Signer {
  return new Ed25519Signer(new Uint8Array(32).fill(seed));
}

function specific(did: Ed25519Signer["did"]) {
  return { kind: "specific", did } as const;
}

const alice = signer(1);
const bob = signer(2);

// Deterministic actors keep the walkthrough stable.
const delegationStore = new MapDelegationStore();
// Alice grants Bob create rights, limited to draft titles and a short lifetime.
const freshDelegation = new DelegationBuilder()
  .issuer(alice)
  .audience(bob.did)
  .subject(specific(alice.did))
  .commandFromStr("/crud/create")
  .policy([ipldToPredicate(["like", ".title", "draft:*"])])
  .expiration(Timestamp.fiveMinutesFromNow())
  .issueNow()
  .tryBuild();

await insert(delegationStore, freshDelegation);
console.log("delegation:", freshDelegation.toCid().toString());

// Bob invokes with a title that satisfies the delegated policy.
const successPayload = new InvocationBuilder()
  .issuer(bob)
  .audience(alice.did)
  .subject(alice.did)
  .commandFromStr("/crud/create")
  .arguments(new Map([
    ["title", "draft:launch"],
    ["body", "green light"],
  ]))
  .proofs([freshDelegation.toCid()])
  .build();

await check(successPayload, delegationStore);
console.log("success   : check() accepted the delegated invocation ✓");

// Same chain, but the invocation no longer matches the policy.
const policyViolation = new InvocationBuilder()
  .issuer(bob)
  .audience(alice.did)
  .subject(alice.did)
  .commandFromStr("/crud/create")
  .arguments(new Map([
    ["title", "published:launch"],
    ["body", "too soon"],
  ]))
  .proofs([freshDelegation.toCid()]);

// check() should fail because the predicate rejects the title.
await assert.rejects(
  check(policyViolation.build(), delegationStore),
  (error: unknown) =>
    error instanceof StoredCheckError &&
    error.reason === "checkFailed" &&
    error.detail instanceof CheckFailed &&
    error.detail.reason === "predicateFailed",
);
console.log("policy    : rejected a title that missed the predicate ✓");

const expiredDelegationStore = new MapDelegationStore();
// Rebuild the same delegation shape, but with an already expired token.
const expiredDelegation = new DelegationBuilder()
  .issuer(alice)
  .audience(bob.did)
  .subject(specific(alice.did))
  .commandFromStr("/crud/create")
  .policy([ipldToPredicate(["like", ".title", "draft:*"])])
  .expiration(Timestamp.fromUnix(1))
  .tryBuild();
await insert(expiredDelegationStore, expiredDelegation);

// The invocation still looks valid, but its proof is stale.
const expiredPayload = new InvocationBuilder()
  .issuer(bob)
  .audience(alice.did)
  .subject(alice.did)
  .commandFromStr("/crud/create")
  .arguments(new Map([
    ["title", "draft:stale"],
    ["body", "already expired"],
  ]))
  .proofs([expiredDelegation.toCid()]);

// check() also enforces exp at execution time.
await assert.rejects(
  () => check(expiredPayload.build(), expiredDelegationStore),
  (e: Error) => e.name === "StoredCheckError",
);
console.log("expired   : rejected the stale delegation ✓");
