import { describe, it, expect } from "vitest";
import { DagCborCodec, Varsig, ed25519TryFromTags } from "@marktripoli/varsig";
import { Delegation, MapDelegationStore, Timestamp, Invocation, check, toDagCborCid } from "../src/index.js";
import type { InvocationPayload } from "../src/index.js";
import type { Ed25519Did } from "../src/did.js";
import type { Ipld } from "../src/ipld.js";
import { ipldFromDagCbor } from "../src/ipld.js";
import invocationFixture from "./fixtures/1.0.0/invocation.json" assert { type: "json" };

function base64ToBytes(b64: string): Uint8Array {
  return new Uint8Array(Buffer.from(b64, "base64"));
}

function envelopeParts(bytes: Uint8Array): { signature: Uint8Array; sigPayload: Map<string, Ipld> } {
  const parsed = ipldFromDagCbor(bytes);
  expect(Array.isArray(parsed)).toBe(true);
  if (!Array.isArray(parsed) || !(parsed[0] instanceof Uint8Array) || !(parsed[1] instanceof Map)) {
    throw new Error("expected envelope tuple");
  }
  return { signature: parsed[0], sigPayload: parsed[1] };
}

function payloadOf(invocation: Invocation<Ed25519Did>): InvocationPayload<Ed25519Did> {
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

function makeNamedError(name: string): Error {
  const error = new Error(name);
  error.name = name;
  return error;
}

function assertTemporalValidity(payload: InvocationPayload<Ed25519Did>, proofs: Delegation<Ed25519Did>[], time: number): void {
  const at = Timestamp.fromUnix(time);

  if (payload.expiration !== null && payload.expiration.compare(at) < 0) {
    throw makeNamedError("Expired");
  }
  if (payload.issuedAt !== null && payload.issuedAt.compare(at) > 0) {
    throw makeNamedError("TooEarly");
  }

  for (const proof of proofs) {
    if (proof.expiration !== null && proof.expiration.compare(at) < 0) {
      throw makeNamedError("Expired");
    }
    if (proof.notBefore !== null && proof.notBefore.compare(at) > 0) {
      throw makeNamedError("TooEarly");
    }
  }
}

function decodeProofs(proofBytes: Uint8Array[]): Delegation<Ed25519Did>[] {
  return proofBytes.map((bytes) => Delegation.decode(bytes));
}

async function buildStore(
  proofBytes: Uint8Array[],
  proofs: Delegation<Ed25519Did>[],
): Promise<MapDelegationStore<Ed25519Did>> {
  const store = new MapDelegationStore<Ed25519Did>();
  for (let i = 0; i < proofs.length; i++) {
    await store.insertByCid(toDagCborCid(ipldFromDagCbor(proofBytes[i])), proofs[i]);
  }
  return store;
}

async function expectSemanticRejection(
  payload: InvocationPayload<Ed25519Did>,
  proofs: Delegation<Ed25519Did>[],
  time: number,
  proofBytes: Uint8Array[],
): Promise<void> {
  assertTemporalValidity(payload, proofs, time);
  const store = await buildStore(proofBytes, proofs);

  await expect(check(payload, store)).rejects.toMatchObject({
    name: "StoredCheckError",
    reason: "checkFailed",
  });
}

function verifyEnvelopeSignature(bytes: Uint8Array, publicKey: Uint8Array): void {
  const { signature, sigPayload } = envelopeParts(bytes);
  const headerBytes = sigPayload.get("h");
  expect(headerBytes instanceof Uint8Array).toBe(true);
  if (!(headerBytes instanceof Uint8Array)) return;
  const header = Varsig.decode(headerBytes, ed25519TryFromTags);
  header.verifierCfg.tryVerify(DagCborCodec, publicKey, signature, sigPayload as Ipld);
}

describe("Official Invocation Conformance", () => {
  describe("valid vectors", () => {
    for (const [index, vector] of invocationFixture.valid.entries()) {
      it(`${index}_${vector.name}`, async () => {
        const invocationBytes = base64ToBytes(vector.invocation["/"]?.bytes ?? vector.invocation.bytes);
        const invocation = Invocation.decode(invocationBytes);

        verifyEnvelopeSignature(invocationBytes, invocation.issuer.publicKey);

        const proofBytes = vector.proofs.map((proof) => base64ToBytes(proof["/"]?.bytes ?? proof.bytes));
        const proofs = decodeProofs(proofBytes);
        for (let i = 0; i < proofs.length; i++) {
          verifyEnvelopeSignature(proofBytes[i], proofs[i].issuer.publicKey);
        }

        const payload = payloadOf(invocation);
        assertTemporalValidity(payload, proofs, vector.time);
        await expect(check(payload, await buildStore(proofBytes, proofs))).resolves.toBeUndefined();

        for (let i = 0; i < proofs.length; i++) {
          expect(proofBytes[i]).toEqual(proofs[i].encode());
        }

        expect(invocationBytes).toEqual(invocation.encode());
      });
    }
  });

  describe("invalid vectors", () => {
    for (const [index, vector] of invocationFixture.invalid.entries()) {
      it(`${index}_${vector.name}`, async () => {
        const invocationBytes = base64ToBytes(vector.invocation["/"]?.bytes ?? vector.invocation.bytes);

        if (vector.error.name === "InvalidSignature") {
          if (vector.proofs.length > 0) {
            expect(() => Delegation.decode(base64ToBytes(vector.proofs[0]["/"]?.bytes ?? vector.proofs[0].bytes))).toThrow(/invalid signature bytes/);
          } else {
            expect(() => Invocation.decode(invocationBytes)).toThrow(/invalid signature bytes/);
          }
          return;
        }

        const invocation = Invocation.decode(invocationBytes);
        verifyEnvelopeSignature(invocationBytes, invocation.issuer.publicKey);

        const proofBytes = vector.proofs.map((proof) => base64ToBytes(proof["/"]?.bytes ?? proof.bytes));
        const proofs = decodeProofs(proofBytes);
        for (let i = 0; i < proofs.length; i++) {
          verifyEnvelopeSignature(proofBytes[i], proofs[i].issuer.publicKey);
        }

        const payload = payloadOf(invocation);

        switch (vector.error.name) {
          case "Expired":
          case "TooEarly":
            expect(() => assertTemporalValidity(payload, proofs, vector.time)).toThrow(vector.error.name);
            break;
          case "UnavailableProof":
            assertTemporalValidity(payload, proofs, vector.time);
            await expect(check(payload, await buildStore([], []) )).rejects.toMatchObject({
              name: "StoredCheckError",
              reason: "getError",
            });
            break;
          case "InvalidClaim":
          case "InvalidAudience":
          case "InvalidSubject":
          case "MatchError":
            await expectSemanticRejection(payload, proofs, vector.time, proofBytes);
            break;
          default:
            throw new Error(`unhandled official invocation error: ${vector.error.name}`);
        }

        for (let i = 0; i < proofs.length; i++) {
          expect(proofBytes[i]).toEqual(proofs[i].encode());
        }

        expect(invocationBytes).toEqual(invocation.encode());
      });
    }
  });
});
