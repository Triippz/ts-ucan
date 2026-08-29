/**
 * Delegation tests.
 *
 * Ported from ucan/src/delegation.rs
 */

import { describe, it, expect, beforeAll } from "vitest";
import { Delegation } from "../src/delegation/index.js";
import { DelegationBuilder } from "../src/index.js";
import { Ed25519Signer, Ed25519Did } from "../src/did.js";
import { Command } from "../src/command.js";
import { DelegatedSubject } from "../src/delegation/subject.js";
import { ipldFromDagCbor, ipldToDagCbor } from "../src/ipld.js";
import { Nonce } from "../src/crypto/nonce.js";

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

    const publicKey = new Uint8Array(32).fill(0);
    const aud = new Ed25519Did(publicKey);
    const sub = new Ed25519Did(publicKey);

    const builder = new DelegationBuilder()
      .issuer(iss)
      .audience(aud)
      .subject({ kind: "specific", did: sub } as DelegatedSubject<Ed25519Did>)
      .commandFromStr("/read/write");

    const delegation = builder.tryBuild();

    expect(delegation.issuer.toString()).toBe(iss.toString());
  });

  it("delegation_b64_fixture_roundtrip", () => {
    // Sample delegation with sub: null, cmd: "/", exp: null, meta: {}
    const b64 =
      "glhA0rict5hwniXnh54Y7b0v/ZEDNSlPdBx0rsoWDYC2Ylv+UzDr00s7ojPsfvNwrofqKItK911ZGJggZSkeQIB3DqJhaEg0Ae0B7QETcXN1Y2FuL2RsZ0AxLjAuMC1yYy4xqWNhdWR4OGRpZDprZXk6ejZNa2ZGSkJ4U0JGZ29BcVRRTFM3YlRmUDhNZ3lEeXB2YTVpNkNMNVBKTjhSSlpyY2NtZGEvY2V4cPZjaXNzeDhkaWQ6a2V5Ono2TWtyQXNxMU03dEVmUHZXNWRSMlVGQ3daU3pSTU5YWWVUVzh0R1pTS3ZVbTlFWmNuYmYaaSTxp2Nwb2yAY3N1YvZkbWV0YaBlbm9uY2VMVkDFeab+58p8SMpW";
    const bytes = base64ToBytes(b64);

    // Parse as Delegation
    const delegation = Delegation.decode(bytes);

    // Verify fields parsed correctly
    expect(delegation.subject.kind).toBe("any"); // sub: null
    expect(delegation.command.toString()).toBe("/"); // cmd: "/"
    expect(delegation.expiration).toBe(null); // exp: null
    expect(delegation.notBefore).not.toBe(null); // nbf: 1764028839

    // Serialize back
    const reserialized = delegation.encode();

    // Verify byte-exact roundtrip
    expect(bytes).toEqual(reserialized);
  });

  it("delegation_payload_any_subject_serializes_to_null", () => {
    const publicKey = new Uint8Array(32).fill(0);
    const iss = new Ed25519Did(publicKey);
    const aud = new Ed25519Did(publicKey);

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
    // The envelopePayload map has: {"h": varsigHeader, "ucan/dlg@1.0.0-rc.1": delegationPayloadMap}
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
