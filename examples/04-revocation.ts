/**
 * Revocation chain: delegated proofs, encoded revocations, and revocation-aware
 * authorization checks.
 *
 * Alice delegates to Bob, Bob delegates to Carol, and the checker walks that
 * proof chain end-to-end.
 * Then Bob revokes Carol's proof, and only that revoker should matter.
 *
 * Run:
 *   node examples/04-revocation.ts
 */
import assert from "node:assert/strict";
import {
  DelegationBuilder,
  Ed25519Signer,
  Invocation,
  InvocationBuilder,
  MapDelegationStore,
  MapRevocationStore,
  checkWithRevocations,
  insert,
  revoke,
  RevokedError,
} from "@marktripoli/ucan";

function signer(seed: number): Ed25519Signer {
  return new Ed25519Signer(new Uint8Array(32).fill(seed));
}

function specific(did: Ed25519Signer["did"]) {
  return { kind: "specific", did } as const;
}

const alice = signer(1);
const bob = signer(2);
const carol = signer(3);
const mallory = signer(9);

// Alice grants Bob read access on Alice's subject.
const aliceToBob = new DelegationBuilder()
  .issuer(alice)
  .audience(bob.did)
  .subject(specific(alice.did))
  .commandFromStr("/documents/read")
  .tryBuild();

// Bob extends the same authority to Carol.
const bobToCarol = new DelegationBuilder()
  .issuer(bob)
  .audience(carol.did)
  .subject(specific(alice.did))
  .commandFromStr("/documents/read")
  .tryBuild();

const delegationStore = new MapDelegationStore();
// Store both proofs so the checker can follow the full delegation chain.
await insert(delegationStore, aliceToBob);
await insert(delegationStore, bobToCarol);

// Carol invokes using the chain that points back to Alice.
const payload = new InvocationBuilder()
  .issuer(carol)
  .audience(alice.did)
  .subject(alice.did)
  .commandFromStr("/documents/read")
  .arguments(new Map([["docId", "handbook"]]))
  .proofs([aliceToBob.toCid(), bobToCarol.toCid()])
  .build();

const emptyRevocations = new MapRevocationStore();
// With no revocations recorded, the chain should verify.
await checkWithRevocations(payload, delegationStore, emptyRevocations);
console.log("chain    : carol can invoke through alice → bob → carol ✓");

// Revocation is itself an invocation, so decode the token the same way.
const bobRevocation = revoke(
  new InvocationBuilder()
    .issuer(bob)
    .subject(alice.did)
    .audience(alice.did)
    .proofs([aliceToBob.toCid()]),
  bobToCarol.toCid(),
);
const bobRevocationRoundTrip = Invocation.decode(bobRevocation.encode());
assert.equal(bobRevocationRoundTrip.command.toString(), "/ucan/revoke");
assert.equal(bobRevocationRoundTrip.arguments.get("revoke")?.toString(), bobToCarol.toCid().toString());
console.log("revoke   : encoded revocation decodes back as an Invocation ✓");

// Record the revocation under the proof it cancels.
const revokedStore = new MapRevocationStore();
await revokedStore.insert(bobToCarol.toCid(), bobRevocation);
await assert.rejects(checkWithRevocations(payload, delegationStore, revokedStore), RevokedError);
console.log("revoked  : bob's revocation now blocks carol ✓");

// Mallory can target the same CID, but she never issued the proof.
const unrelatedStore = new MapRevocationStore();
const malloryRevocation = revoke(
  new InvocationBuilder()
    .issuer(mallory)
    .subject(mallory.did)
    .audience(mallory.did)
    .proofs([]),
  bobToCarol.toCid(),
);
await unrelatedStore.insert(bobToCarol.toCid(), malloryRevocation);
// Only the matching issuer in the revocation chain should count.
await checkWithRevocations(payload, delegationStore, unrelatedStore);
console.log("unrelated: Mallory's revocation is ignored ✓");
