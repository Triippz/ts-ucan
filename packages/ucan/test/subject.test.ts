/**
 * DelegatedSubject tests.
 *
 * Ported from ucan/src/delegation/subject.rs
 */

import { describe, it, expect } from "vitest";
import { ipldToSubject, subjectToIpld } from "../src/delegation/subject.js";
import { ipldFromDagCbor, ipldToDagCbor } from "../src/ipld.js";
import type { DelegatedSubject } from "../src/delegation/subject.js";
import type { Ed25519Did } from "../src/did.js";
import { Ed25519Did as Ed25519DidClass } from "../src/did.js";

describe("DelegatedSubject", () => {
  it("any_serializes_to_null", () => {
    const subject: DelegatedSubject<Ed25519Did> = { kind: "any" };
    const bytes = ipldToDagCbor(subjectToIpld(subject));
    // CBOR null is encoded as 0xf6
    expect(bytes.length).toBe(1);
    expect(bytes[0]).toBe(0xf6);
  });

  it("any_deserializes_from_null", () => {
    // CBOR null is encoded as 0xf6
    const bytes = new Uint8Array([0xf6]);
    const ipld = ipldFromDagCbor(bytes);
    const subject = ipldToSubject(ipld);
    expect(subject.kind).toBe("any");
  });

  it("any_roundtrip", () => {
    const subject: DelegatedSubject<Ed25519Did> = { kind: "any" };
    const bytes = ipldToDagCbor(subjectToIpld(subject));
    const decoded = ipldFromDagCbor(bytes);
    const roundtripped = ipldToSubject(decoded);
    expect(roundtripped.kind).toBe("any");
  });

  it("specific_roundtrip", () => {
    // Create a DID with known bytes
    const publicKeyBytes = new Uint8Array([
      215, 90, 152, 1, 130, 177, 10, 183, 213, 75, 254, 211, 201, 100, 7, 58, 14, 225, 114,
      243, 218, 166, 35, 37, 175, 2, 26, 104, 247, 7, 81, 26,
    ]);
    const did = new Ed25519DidClass(publicKeyBytes);
    const subject: DelegatedSubject<Ed25519Did> = { kind: "specific", did };

    const bytes = ipldToDagCbor(subjectToIpld(subject));
    const decoded = ipldFromDagCbor(bytes);
    const roundtripped = ipldToSubject(decoded) as { kind: "specific"; did: Ed25519Did };

    expect(roundtripped.kind).toBe("specific");
    expect(roundtripped.did.toString()).toBe(did.toString());
  });
});
