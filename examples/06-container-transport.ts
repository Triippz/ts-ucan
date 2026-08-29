/**
 * UCAN WG container v0.1.0 transport.
 *
 * Bundles signed tokens for NATS, AMQP, gRPC, files, websockets, or any other
 * byte pipe. This example shows both the raw-bytes and base64-url container
 * variants, then unpacks them on the receiving side.
 *
 * Run:
 *   node examples/06-container-transport.ts
 */
import assert from "node:assert/strict";
import {
  Delegation,
  DelegationBuilder,
  Ed25519Signer,
  Invocation,
  InvocationBuilder,
  MapDelegationStore,
  check,
  containerFromBytes,
  containerToBase64Url,
  containerToBytes,
  insert,
  ipldToPredicate,
} from "@marktripoli/ucan";

function signer(seed: number): Ed25519Signer {
  return new Ed25519Signer(new Uint8Array(32).fill(seed));
}

function payloadOf(invocation: Invocation) {
  return {
    issuer: invocation.issuer,
    audience: invocation.audience,
    subject: invocation.subject,
    command: invocation.command,
    arguments: invocation.arguments,
    proofs: invocation.proofs,
    cause: invocation.cause,
    issuedAt: invocation.issuedAt,
    expiration: invocation.expiration,
    meta: invocation.meta,
    nonce: invocation.nonce,
  };
}

function decodeToken(bytes: Uint8Array): Delegation | Invocation {
  try {
    return Delegation.decode(bytes);
  } catch {
    return Invocation.decode(bytes);
  }
}

async function unpackAndCheck(label: string, wire: Uint8Array, originalDelegation: Delegation, originalInvocation: Invocation): Promise<void> {
  const tokens = await containerFromBytes(wire);
  let decodedDelegation: Delegation | undefined;
  let decodedInvocation: Invocation | undefined;

  for (const tokenBytes of tokens) {
    const token = decodeToken(tokenBytes);
    if (token instanceof Delegation) {
      decodedDelegation = token;
    } else {
      decodedInvocation = token;
    }
  }

  if (!decodedDelegation || !decodedInvocation) {
    throw new Error(`${label}: missing delegation or invocation`);
  }
  assert.equal(decodedDelegation.toCid().toString(), originalDelegation.toCid().toString(), `${label}: delegation CID`);
  assert.equal(decodedInvocation.toCid().toString(), originalInvocation.toCid().toString(), `${label}: invocation CID`);

  const store = new MapDelegationStore();
  await insert(store, decodedDelegation);
  await check(payloadOf(decodedInvocation), store);

  console.log(`${label}: decoded delegation + invocation, then check() passed ✓`);
}

const alice = signer(1);
const bob = signer(2);
const delegation = new DelegationBuilder()
  .issuer(alice)
  .audience(bob.did)
  .subject({ kind: "specific", did: alice.did })
  .commandFromStr("/projects/create")
  .policy([ipldToPredicate(["like", ".name", "demo-*"])])
  .tryBuild();

const invocation = new InvocationBuilder()
  .issuer(bob)
  .audience(alice.did)
  .subject(alice.did)
  .commandFromStr("/projects/create")
  .arguments(new Map([
    ["name", "demo-container"],
    ["owner", "bob"],
  ]))
  .proofs([delegation.toCid()])
  .tryBuild();

const rawContainer = await containerToBytes([delegation.encode(), invocation.encode()]);
console.log("raw container:", rawContainer.length, "bytes");
await unpackAndCheck("raw bytes", rawContainer, delegation, invocation);

const base64Container = await containerToBase64Url([delegation.encode(), invocation.encode()]);
const transportedText = Buffer.from(base64Container).toString("utf8");
const textWire = new Uint8Array(Buffer.from(transportedText, "utf8"));
console.log("base64-url container:", transportedText.length, "text bytes");
await unpackAndCheck("base64-url text", textWire, delegation, invocation);
