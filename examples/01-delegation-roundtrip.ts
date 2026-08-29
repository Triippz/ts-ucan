/**
 * Delegation roundtrip: Alice grants Bob a constrained delegation, then we
 * encode and decode it to prove the wire form preserves the same authority.
 *
 * Alice is both the issuer and subject; Bob is the audience.
 * This example proves the DAG-CBOR bytes roundtrip without changing the CID.
 *
 * Run (after `npm run build` at the repo root):
 *   node examples/01-delegation-roundtrip.ts
 */
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import {
  DelegationBuilder,
  Delegation,
  Ed25519Signer,
  ipldToPredicate,
} from "@marktripoli/ucan";

function newSigner(): Ed25519Signer {
  const secret = new Uint8Array(32);
  webcrypto.getRandomValues(secret);
  return new Ed25519Signer(secret);
}

const alice = newSigner();
const bob = newSigner();

// Create fresh signers so the delegation is the only moving part.
// Alice grants Bob /crud/create, but only when the invocation stays in draft.
const delegation = new DelegationBuilder()
  .issuer(alice)
  .audience(bob.did)
  .subject({ kind: "specific", did: alice.did })
  .commandFromStr("/crud/create")
  .policy([ipldToPredicate(["==", ".status", "draft"])])
  .tryBuild();

console.log("issuer   :", delegation.issuer.toString());
console.log("audience :", delegation.audience.toString());
console.log("command  :", delegation.command.toString());
console.log("cid      :", delegation.toCid().toString());

// Serialize the delegation the same way it would travel over the wire.
const bytes = delegation.encode();
console.log("encoded  :", bytes.length, "bytes of DAG-CBOR");

// Decode on the other side and verify the authority stayed intact.
const decoded = Delegation.decode(bytes);
assert.equal(decoded.issuer.toString(), delegation.issuer.toString());
assert.equal(decoded.command.toString(), "/crud/create");
assert.deepEqual(decoded.encode(), bytes); // byte-exact re-serialization
console.log("roundtrip: byte-exact ✓");
