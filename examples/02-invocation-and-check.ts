/**
 * Full authorization flow: delegation, invocation, policy enforcement, and
 * an expired-delegation branch.
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

const delegationStore = new MapDelegationStore();
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
const expiredDelegation = new DelegationBuilder()
  .issuer(alice)
  .audience(bob.did)
  .subject(specific(alice.did))
  .commandFromStr("/crud/create")
  .policy([ipldToPredicate(["like", ".title", "draft:*"])])
  .expiration(Timestamp.fromUnix(1))
  .tryBuild();
await insert(expiredDelegationStore, expiredDelegation);

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

// check() enforces time bounds per the delegation spec's Token Validation
// rules: proofs must be within [nbf, exp] at execution time.
await assert.rejects(
  () => check(expiredPayload.build(), expiredDelegationStore),
  (e: Error) => e.name === "StoredCheckError",
);
console.log("expired   : rejected the stale delegation ✓");
