/**
 * Ed25519 did:key tests.
 *
 * Ported from ucan/src/did.rs
 */

import { base58btc } from "multiformats/bases/base58";
import { describe, expect, it } from "vitest";
import {
  Ed25519Did,
  Ed25519DidFromStrError,
  type Ed25519DidFromStrErrorReason,
} from "../src/did.js";

const DID_PREFIX = "did:key:z";
const FIXTURE = "did:key:z6MkmT9j6fVZqzXV8u2wVVSu49gYSRYGSQnduWXF6foAJrqz";

function didFromBytes(bytes: Uint8Array): string {
  return `${DID_PREFIX}${base58btc.baseEncode(bytes)}`;
}

function bytesFromDid(did: string): Uint8Array {
  return base58btc.baseDecode(did.slice(DID_PREFIX.length));
}

function expectParseReason(input: string, reason: Ed25519DidFromStrErrorReason): void {
  try {
    Ed25519Did.fromString(input);
    throw new Error("expected Ed25519Did.fromString to throw");
  } catch (error) {
    expect(error).toBeInstanceOf(Ed25519DidFromStrError);
    expect((error as Ed25519DidFromStrError).reason).toBe(reason);
  }
}

describe("Ed25519Did", () => {
  it("rejects_bad_prefix", () => {
    expectParseReason("did:web:z6MkmT9j6fVZqzXV8u2wVVSu49gYSRYGSQnduWXF6foAJrqz", "invalidDidHeader");
  });

  it("rejects_missing_base58_prefix", () => {
    expectParseReason("did:key:6MkmT9j6fVZqzXV8u2wVVSu49gYSRYGSQnduWXF6foAJrqz", "missingBase58Prefix");
  });

  it("rejects_bad_multicodec_header_bytes", () => {
    const bytes = bytesFromDid(FIXTURE);
    bytes[0] = 0xee;
    expectParseReason(didFromBytes(bytes), "invalidKey");
  });

  it("rejects_bad_length", () => {
    const bytes = bytesFromDid(FIXTURE).slice(0, 33);
    expectParseReason(didFromBytes(bytes), "invalidKey");
  });

  it("rejects_invalid_point", () => {
    const bytes = new Uint8Array(34);
    bytes[0] = 0xed;
    bytes[1] = 0x01;
    bytes.set(Buffer.from("27b25ebe1f27ddf0710325e0d4e9f8423d2e556ad98149fcf2e6c50c9c736fd0", "hex"), 2);
    expectParseReason(didFromBytes(bytes), "invalidKey");
  });

  it("roundtrips_valid_fixture", () => {
    expect(Ed25519Did.fromString(FIXTURE).toString()).toBe(FIXTURE);
  });
});
