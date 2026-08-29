/**
 * Invocation tests.
 *
 * Ported from ucan/src/invocation.rs
 */

import { describe, it, expect } from "vitest";
import { InvocationBuilder } from "../src/index.js";
import { Ed25519Signer, Ed25519Did } from "../src/did.js";
import { ipldFromDagCbor } from "../src/ipld.js";

describe("Invocation", () => {
  it("issuer_round_trip", () => {
    // Create a signer from fixed bytes
    const secretKey = new Uint8Array(32).fill(0);
    const iss = new Ed25519Signer(secretKey);

    const publicKey = new Uint8Array(32).fill(0);
    const aud = new Ed25519Did(publicKey);
    const sub = new Ed25519Did(publicKey);

    const builder = new InvocationBuilder()
      .issuer(iss)
      .audience(aud)
      .subject(sub)
      .commandFromStr("/read/write")
      .proofs([]);

    const invocation = builder.tryBuild();

    expect(invocation.issuer.toString()).toBe(iss.toString());
  });

  it("built_token_uses_1_0_0_tag", () => {
    // Final spec §Type Tag: "The UCAN envelope's payload tag MUST be ucan/inv@1.0.0"
    const publicKey = new Uint8Array(32).fill(0);
    const iss = new Ed25519Signer(new Uint8Array(32).fill(0));
    const aud = new Ed25519Did(publicKey);
    const sub = new Ed25519Did(publicKey);

    const builder = new InvocationBuilder()
      .issuer(iss)
      .audience(aud)
      .subject(sub)
      .commandFromStr("/")
      .proofs([]);

    const invocation = builder.tryBuild();
    const bytes = invocation.encode();
    const parsed = ipldFromDagCbor(bytes);

    expect(Array.isArray(parsed)).toBe(true);
    if (Array.isArray(parsed)) {
      const envelopePayload = parsed[1];
      expect(envelopePayload instanceof Map).toBe(true);
      if (envelopePayload instanceof Map) {
        expect(envelopePayload.has("ucan/inv@1.0.0")).toBe(true);
        expect(envelopePayload.has("ucan/inv@1.0.0-rc.1")).toBe(false);
      }
    }
  });

  it("wire_field_is_args_not_arg", () => {
    // Final spec §Invocation Payload: field is "args" not "arg"
    const publicKey = new Uint8Array(32).fill(0);
    const iss = new Ed25519Signer(new Uint8Array(32).fill(0));
    const aud = new Ed25519Did(publicKey);
    const sub = new Ed25519Did(publicKey);

    const builder = new InvocationBuilder()
      .issuer(iss)
      .audience(aud)
      .subject(sub)
      .commandFromStr("/")
      .arguments(new Map([["foo", { kind: "string", value: "bar" } as import("../src/promise.js").Promised]]))
      .proofs([]);

    const invocation = builder.tryBuild();
    const bytes = invocation.encode();
    const parsed = ipldFromDagCbor(bytes);

    // Drill into payload
    expect(Array.isArray(parsed)).toBe(true);
    if (Array.isArray(parsed)) {
      const envelopePayload = parsed[1];
      if (envelopePayload instanceof Map) {
        // Find the invocation payload (skip "h")
        let invPayload: any;
        for (const [key, value] of envelopePayload) {
          if (key.startsWith("ucan/inv")) {
            invPayload = value;
            break;
          }
        }
        expect(invPayload instanceof Map).toBe(true);
        if (invPayload instanceof Map) {
          expect(invPayload.has("args")).toBe(true);
          expect(invPayload.has("arg")).toBe(false);
        }
      }
    }
  });

  it("omits_aud_when_equal_to_sub", () => {
    // Spec §Audience: "If intended Executor is the Subject the aud field MUST be omitted"
    const publicKey = new Uint8Array(32).fill(0);
    const iss = new Ed25519Signer(new Uint8Array(32).fill(0));
    const did = new Ed25519Did(publicKey);

    const builder = new InvocationBuilder()
      .issuer(iss)
      .audience(did) // same as sub
      .subject(did)
      .commandFromStr("/")
      .proofs([]);

    const invocation = builder.tryBuild();
    const bytes = invocation.encode();
    const parsed = ipldFromDagCbor(bytes);

    expect(Array.isArray(parsed)).toBe(true);
    if (Array.isArray(parsed)) {
      const envelopePayload = parsed[1];
      if (envelopePayload instanceof Map) {
        let invPayload: any;
        for (const [key, value] of envelopePayload) {
          if (key.startsWith("ucan/inv")) {
            invPayload = value;
            break;
          }
        }
        expect(invPayload instanceof Map).toBe(true);
        if (invPayload instanceof Map) {
          // aud must be absent when aud === sub
          expect(invPayload.has("aud")).toBe(false);
          expect(invPayload.get("sub")).toBe(did.toString());
        }
      }
    }
  });

  it("includes_aud_when_different_from_sub", () => {
    // Spec §Audience: include aud when different from sub
    const iss = new Ed25519Signer(new Uint8Array(32).fill(0));
    const aud = new Ed25519Did(new Uint8Array(32).fill(1));
    const sub = new Ed25519Did(new Uint8Array(32).fill(0));

    const builder = new InvocationBuilder()
      .issuer(iss)
      .audience(aud)
      .subject(sub)
      .commandFromStr("/")
      .proofs([]);

    const invocation = builder.tryBuild();
    const bytes = invocation.encode();
    const parsed = ipldFromDagCbor(bytes);

    expect(Array.isArray(parsed)).toBe(true);
    if (Array.isArray(parsed)) {
      const envelopePayload = parsed[1];
      if (envelopePayload instanceof Map) {
        let invPayload: any;
        for (const [key, value] of envelopePayload) {
          if (key.startsWith("ucan/inv")) {
            invPayload = value;
            break;
          }
        }
        expect(invPayload instanceof Map).toBe(true);
        if (invPayload instanceof Map) {
          expect(invPayload.get("aud")).toBe(aud.toString());
        }
      }
    }
  });
});
