/**
 * Delegation conformance tests.
 *
 * Ported from ucan/tests/delegation_conformance.rs
 */

import { describe, it, expect } from "vitest";
import { DagCborCodec, Varsig, ed25519TryFromTags } from "@marktripoli/varsig";
import type { Ipld } from "../src/ipld.js";
import { Delegation } from "../src/delegation/index.js";
import { DelegationBuilder } from "../src/index.js";
import { Ed25519Signer, Ed25519Did } from "../src/did.js";
import { DelegatedSubject } from "../src/delegation/subject.js";
import { Nonce } from "../src/crypto/nonce.js";
import { ipldFromDagCbor } from "../src/ipld.js";
import delegationFixture from "./fixtures/delegation.json" assert { type: "json" };
import generatedFixture from "./fixtures/generated.json" assert { type: "json" };

function did(seed: number): Ed25519Did {
  return new Ed25519Signer(new Uint8Array(32).fill(seed)).did;
}

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

  it("legacy_rc1_fixture_parse_shape_only", () => {
    // rc-era legacy vector; final-spec decode rejects the old payload tag.
    const validDelegations = (delegationFixture as any).valid;
    const b64Token = validDelegations[0].token;
    const bytes = base64ToBytes(b64Token);
    const parsed = ipldFromDagCbor(bytes);

    expect(Array.isArray(parsed)).toBe(true);
    if (!Array.isArray(parsed)) return;

    expect(parsed.length).toBe(2);
    const envelopePayload = parsed[1];
    expect(envelopePayload instanceof Map).toBe(true);
    if (envelopePayload instanceof Map) {
      expect(envelopePayload.has("h")).toBe(true);
      expect(envelopePayload.has("ucan/dlg@1.0.0-rc.1")).toBe(true);
      expect(envelopePayload.has("ucan/dlg@1.0.0")).toBe(false);
    }
  });

  it("deterministic_builder_roundtrip_matches_fixture", () => {
    const iss = new Ed25519Signer(new Uint8Array(32).fill(7));
    const aud = did(8);
    const sub = did(9);
    const nonce = Nonce.fromBytes(Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]));

    const delegation = new DelegationBuilder()
      .issuer(iss)
      .audience(aud)
      .subject({ kind: "specific", did: sub } as DelegatedSubject<Ed25519Did>)
      .commandFromStr("/read")
      .expiration(null)
      .nonce(nonce)
      .tryBuild();

    const bytes = delegation.encode();
    expect(bytes).toEqual(new Uint8Array(Buffer.from(generatedFixture.delegationBytes, "base64")));

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
    if (!(headerBytes instanceof Uint8Array)) return;

    const header = Varsig.decode(headerBytes, ed25519TryFromTags);
    header.verifierCfg.tryVerify(DagCborCodec, iss.did.publicKey, signature, sigPayload as Ipld);

    const roundTripped = Delegation.decode(bytes);
    expect(roundTripped.issuer.toString()).toBe(iss.toString());
    expect(roundTripped.audience.toString()).toBe(aud.toString());
    expect(roundTripped.subject.kind).toBe("specific");
    expect(roundTripped.command.toString()).toBe("/read");
    expect(roundTripped.expiration).toBe(null);
    expect(roundTripped.notBefore).toBe(null);
    expect(roundTripped.nonce.toBytes()).toEqual(nonce.toBytes());
  });
});
