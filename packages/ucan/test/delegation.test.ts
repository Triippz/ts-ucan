/**
 * Delegation tests.
 *
 * Ported from ucan/src/delegation.rs
 */

import { describe, it, expect } from "vitest";
import { DelegationBuilder } from "../src/index.js";
import { Ed25519Signer, Ed25519Did } from "../src/did.js";
import { DelegatedSubject } from "../src/delegation/subject.js";
import { ipldFromDagCbor } from "../src/ipld.js";

function base64ToBytes(b64: string): Uint8Array {
  const binaryString = atob(b64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

describe("Delegation", () => {
  it("issuer_round_trip", () => {
    // Create a signer from fixed bytes
    const secretKey = new Uint8Array(32).fill(0);
    const iss = new Ed25519Signer(secretKey);

    const aud = new Ed25519Signer(new Uint8Array(32).fill(0)).did;
    const sub = new Ed25519Signer(new Uint8Array(32).fill(0)).did;

    const builder = new DelegationBuilder()
      .issuer(iss)
      .audience(aud)
      .subject({ kind: "specific", did: sub } as DelegatedSubject<Ed25519Did>)
      .commandFromStr("/read/write");

    const delegation = builder.tryBuild();

    expect(delegation.issuer.toString()).toBe(iss.toString());
  });

  it("legacy_rc1_fixture_parse_shape_only", () => {
    // rc-era legacy vector; final-spec decode rejects the old payload tag.
    const b64 =
      "glhA0rict5hwniXnh54Y7b0v/ZEDNSlPdBx0rsoWDYC2Ylv+UzDr00s7ojPsfvNwrofqKItK911ZGJggZSkeQIB3DqJhaEg0Ae0B7QETcXN1Y2FuL2RsZ0AxLjAuMC1yYy4xqWNhdWR4OGRpZDprZXk6ejZNa2ZGSkJ4U0JGZ29BcVRRTFM3YlRmUDhNZ3lEeXB2YTVpNkNMNVBKTjhSSlpyY2NtZGEvY2V4cPZjaXNzeDhkaWQ6a2V5Ono2TWtyQXNxMU03dEVmUHZXNWRSMlVGQ3daU3pSTU5YWWVUVzh0R1pTS3ZVbTlFWmNuYmYaaSTxp2Nwb2yAY3N1YvZkbWV0YaBlbm9uY2VMVkDFeab+58p8SMpW";
    const bytes = base64ToBytes(b64);
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

  it("delegation_payload_any_subject_serializes_to_null", () => {
    const aud = new Ed25519Signer(new Uint8Array(32).fill(0)).did;

    const builder = new DelegationBuilder()
      .issuer(new Ed25519Signer(new Uint8Array(32).fill(0)))
      .audience(aud)
      .subject({ kind: "any" } as DelegatedSubject<Ed25519Did>)
      .commandFromStr("/");

    const delegation = builder.tryBuild();

    expect(delegation.subject.kind).toBe("any");

    // Serialize and deserialize to verify roundtrip
    const bytes = delegation.encode();
    const parsed = ipldFromDagCbor(bytes);

    // The envelope is a 2-tuple [signature, envelopePayload]
    // The envelopePayload map has: {"h": varsigHeader, "ucan/dlg@1.0.0": delegationPayloadMap}
    if (Array.isArray(parsed) && parsed.length === 2) {
      const envelopePayload = parsed[1];
      if (envelopePayload instanceof Map) {
        // Find the ucan/dlg tag (skip "h")
        let delegationPayloadMap: any;
        for (const [key, value] of envelopePayload) {
          if (key.startsWith("ucan/dlg")) {
            delegationPayloadMap = value;
            break;
          }
        }
        if (delegationPayloadMap instanceof Map) {
          const sub = delegationPayloadMap.get("sub");
          expect(sub).toBe(null);
        } else {
          throw new Error("Expected delegation payload to be a Map");
        }
      } else {
        throw new Error("Expected envelopePayload to be a Map");
      }
    } else {
      throw new Error("Expected parsed Ipld to be an array with 2 elements");
    }
  });
});
