/**
 * Invocation tests.
 *
 * Ported from ucan/src/invocation.rs
 */

import { describe, it, expect } from "vitest";
import { InvocationBuilder } from "../src/index.js";
import { Ed25519Signer, Ed25519Did } from "../src/did.js";

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
});
