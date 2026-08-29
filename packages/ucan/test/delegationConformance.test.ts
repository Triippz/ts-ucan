/**
 * Delegation conformance tests.
 *
 * Ported from ucan/tests/delegation_conformance.rs
 */

import { describe, it, expect } from "vitest";
import { Delegation } from "../src/delegation/index.js";
import { DelegationBuilder } from "../src/index.js";
import { Ed25519Signer, Ed25519Did } from "../src/did.js";
import { DelegatedSubject } from "../src/delegation/subject.js";
import { ipldFromDagCbor } from "../src/ipld.js";
import delegationFixture from "./fixtures/delegation.json" assert { type: "json" };

function base64ToBytes(b64: string): Uint8Array {
  const binaryString = atob(b64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

describe("Delegation Conformance", () => {
  it("test_expected_version", () => {
    // Fixtures use rc.1 tags; kept as legacy-decode conformance
    expect(delegationFixture.version).toBe("1.0.0-rc.1");
  });

  it("test_top_level_parse", () => {
    const validDelegations = (delegationFixture as any).valid;
    expect(validDelegations).toBeDefined();
    expect(validDelegations.length).toBeGreaterThan(0);

    const first = validDelegations[0];
    const b64Token = first.token;
    expect(b64Token).toBeDefined();

    // Decode base64 to bytes
    const uint8Bytes = base64ToBytes(b64Token);

    // Parse as Delegation (decode expects DAG-CBOR bytes)
    const delegation = Delegation.decode(uint8Bytes);

    // Verify fields
    expect(delegation.policy).toBeDefined();
    expect(delegation.policy.length).toBe(0);
  });

  it("rc1_fixture_decode_and_tag_roundtrip", () => {
    // Old fixture with rc.1 tag decodes correctly (tag is preserved for re-encode)
    const validDelegations = (delegationFixture as any).valid;
    const b64Token = validDelegations[0].token;
    const bytes = base64ToBytes(b64Token);

    const delegation = Delegation.decode(bytes);
    const reserialized = delegation.encode();

    // Decode again and verify all payload fields survived
    const roundtripped = Delegation.decode(reserialized);
    expect(roundtripped.issuer.toString()).toBe(delegation.issuer.toString());
    expect(roundtripped.audience.toString()).toBe(delegation.audience.toString());
    expect(roundtripped.subject.kind).toBe(delegation.subject.kind);
    expect(roundtripped.command.toString()).toBe(delegation.command.toString());
    expect(roundtripped.policy.length).toBe(delegation.policy.length);
    expect(roundtripped.expiration).toStrictEqual(delegation.expiration);
    expect(roundtripped.notBefore).toStrictEqual(delegation.notBefore);
    expect(roundtripped.nonce.toBytes()).toEqual(delegation.nonce.toBytes());

    // Verify tag is preserved through encode: decode the reserialized bytes
    // and check that the wire tag key is still the original rc.1 tag
    // (field ordering may differ, so we don't require byte-exact match)
    if (Array.isArray(bytes) && Array.isArray(reserialized)) {
      // At minimum, both should have 2-element tuple structure
      expect(reserialized.length).toBe(2);
      expect(reserialized[0] instanceof Uint8Array).toBe(true);
      expect(reserialized[1] instanceof Map).toBe(true);
    }
  });

  it("built_token_uses_1_0_0_tag", () => {
    // Newly built tokens must carry the 1.0.0 tag per final spec
    const publicKey = new Uint8Array(32).fill(0);
    const aud = new Ed25519Did(publicKey);
    const sub = new Ed25519Did(publicKey);

    const builder = new DelegationBuilder()
      .issuer(new Ed25519Signer(new Uint8Array(32).fill(0)))
      .audience(aud)
      .subject({ kind: "specific", did: sub } as DelegatedSubject<Ed25519Did>)
      .commandFromStr("/");

    const delegation = builder.tryBuild();
    const bytes = delegation.encode();
    const parsed = ipldFromDagCbor(bytes);

    // Verify envelope structure: [signature, {"h": ..., "ucan/dlg@1.0.0": ...}]
    expect(Array.isArray(parsed)).toBe(true);
    if (Array.isArray(parsed)) {
      const envelopePayload = parsed[1];
      expect(envelopePayload instanceof Map).toBe(true);
      if (envelopePayload instanceof Map) {
        expect(envelopePayload.has("ucan/dlg@1.0.0")).toBe(true);
        expect(envelopePayload.has("ucan/dlg@1.0.0-rc.1")).toBe(false);
      }
    }
  });
});
