import { describe, it, expect } from "vitest";
import { DagCborCodec, Varsig, ed25519TryFromTags } from "@marktripoli/varsig";
import type { Ipld } from "../src/ipld.js";
import { Delegation } from "../src/delegation/index.js";
import { Ed25519Signer } from "../src/did.js";
import { ipldFromDagCbor } from "../src/ipld.js";
import delegationFixture from "./fixtures/1.0.0/delegation.json" assert { type: "json" };

function base64ToBytes(b64: string): Uint8Array {
  return new Uint8Array(Buffer.from(b64, "base64"));
}

function principalSigner(name: keyof typeof delegationFixture.principals): Ed25519Signer {
  return new Ed25519Signer(base64ToBytes(delegationFixture.principals[name]).slice(2));
}

describe("Official Delegation Conformance", () => {
  it("decodes the published 1.0.0 delegation vector", () => {
    expect(delegationFixture.version).toBe("1.0.0");

    const [vector] = delegationFixture.valid;
    const bytes = base64ToBytes(vector.token);
    const delegation = Delegation.decode(bytes);

    expect(delegation.issuer.toString()).toBe(vector.envelope.payload.iss);
    expect(delegation.audience.toString()).toBe(vector.envelope.payload.aud);
    expect(delegation.subject.kind).toBe("specific");
    if (delegation.subject.kind === "specific") {
      expect(delegation.subject.did.toString()).toBe(vector.envelope.payload.sub);
    }
    expect(delegation.command.toString()).toBe(vector.envelope.payload.cmd);
    expect(delegation.policy).toEqual([]);
    expect(delegation.expiration?.toIpld()).toBe(vector.envelope.payload.exp);
    expect(delegation.notBefore).toBeNull();
    expect(delegation.meta.size).toBe(0);
    expect(delegation.nonce.toIpld()).toEqual(base64ToBytes(vector.envelope.payload.nonce));

    const parsed = ipldFromDagCbor(bytes);
    expect(Array.isArray(parsed)).toBe(true);
    if (!Array.isArray(parsed)) return;

    const signature = parsed[0];
    const sigPayload = parsed[1];
    expect(signature instanceof Uint8Array).toBe(true);
    expect(sigPayload instanceof Map).toBe(true);
    if (!(signature instanceof Uint8Array) || !(sigPayload instanceof Map)) return;

    const headerBytes = sigPayload.get("h");
    expect(headerBytes instanceof Uint8Array).toBe(true);
    expect(sigPayload.has("ucan/dlg@1.0.0")).toBe(true);
    expect(sigPayload.has("ucan/dlg@1.0.0-rc.1")).toBe(false);
    if (!(headerBytes instanceof Uint8Array)) return;

    const header = Varsig.decode(headerBytes, ed25519TryFromTags);
    header.verifierCfg.tryVerify(DagCborCodec, principalSigner("bob").did.publicKey, signature, sigPayload as Ipld);

    expect(bytes).toEqual(delegation.encode());
  });
});
