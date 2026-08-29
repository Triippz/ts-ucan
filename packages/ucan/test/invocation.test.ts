/**
 * Invocation tests.
 *
 * Ported from ucan/src/invocation.rs
 */

import { describe, it, expect } from "vitest";
import { DagCborCodec, Varsig, ed25519TryFromTags } from "@marktripoli/varsig";
import type { Ipld } from "../src/ipld.js";
import { Invocation, InvocationBuilder } from "../src/index.js";
import { Ed25519Signer, Ed25519Did } from "../src/did.js";
import { ipldFromDagCbor, ipldToDagCbor } from "../src/ipld.js";
import { Nonce } from "../src/crypto/nonce.js";
import generatedFixture from "./fixtures/generated.json" assert { type: "json" };

function did(seed: number): Ed25519Did {
  return new Ed25519Signer(new Uint8Array(32).fill(seed)).did;
}

function envelopeParts(bytes: Uint8Array): { signature: Uint8Array; sigPayload: Map<string, Ipld> } {
  const parsed = ipldFromDagCbor(bytes);
  expect(Array.isArray(parsed)).toBe(true);
  if (!Array.isArray(parsed) || !(parsed[0] instanceof Uint8Array) || !(parsed[1] instanceof Map)) {
    throw new Error("expected envelope tuple");
  }
  return { signature: parsed[0], sigPayload: parsed[1] };
}

function invocationPayload(sigPayload: Map<string, Ipld>): Map<string, Ipld> {
  const payload = sigPayload.get("ucan/inv@1.0.0");
  if (!(payload instanceof Map)) {
    throw new Error("expected invocation payload map");
  }
  return payload;
}

describe("Invocation", () => {
  it("issuer_round_trip", () => {
    const iss = new Ed25519Signer(new Uint8Array(32).fill(0));
    const aud = did(1);
    const sub = did(2);

    const builder = new InvocationBuilder()
      .issuer(iss)
      .audience(aud)
      .subject(sub)
      .commandFromStr("/read/write")
      .proofs([])
      .expiration(null);

    const invocation = builder.tryBuild();

    expect(invocation.issuer.toString()).toBe(iss.toString());
  });

  it("deterministic_builder_roundtrip_matches_fixture", () => {
    const iss = new Ed25519Signer(new Uint8Array(32).fill(7));
    const aud = did(8);
    const sub = did(9);
    const nonce = Nonce.fromBytes(Uint8Array.from([16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1]));

    const invocation = new InvocationBuilder()
      .issuer(iss)
      .audience(aud)
      .subject(sub)
      .commandFromStr("/read")
      .proofs([])
      .expiration(null)
      .nonce(nonce)
      .tryBuild();

    const bytes = invocation.encode();
    expect(bytes).toEqual(new Uint8Array(Buffer.from(generatedFixture.invocationBytes, "base64")));

    const { signature, sigPayload } = envelopeParts(bytes);
    const headerBytes = sigPayload.get("h");
    expect(headerBytes instanceof Uint8Array).toBe(true);
    if (!(headerBytes instanceof Uint8Array)) return;

    const header = Varsig.decode(headerBytes, ed25519TryFromTags);
    header.verifierCfg.tryVerify(DagCborCodec, iss.did.publicKey, signature, sigPayload as Ipld);

    const roundTripped = Invocation.decode(bytes);
    expect(roundTripped.issuer.toString()).toBe(iss.toString());
    expect(roundTripped.audience.toString()).toBe(aud.toString());
    expect(roundTripped.subject.toString()).toBe(sub.toString());
    expect(roundTripped.command.toString()).toBe("/read");
    expect(roundTripped.expiration).toBe(null);
    expect(roundTripped.issuedAt).toBe(null);
    expect(roundTripped.cause).toBe(null);
    expect(roundTripped.meta.size).toBe(0);
    expect(roundTripped.nonce.toBytes()).toEqual(nonce.toBytes());
  });

  it("wire_field_is_args_not_arg", () => {
    const iss = new Ed25519Signer(new Uint8Array(32).fill(1));
    const subject = did(2);

    const invocation = new InvocationBuilder()
      .issuer(iss)
      .audience(subject)
      .subject(subject)
      .commandFromStr("/")
      .arguments(new Map([["foo", "bar"]]))
      .proofs([])
      .expiration(null)
      .tryBuild();

    const payload = invocationPayload(envelopeParts(invocation.encode()).sigPayload);
    expect(payload.has("args")).toBe(true);
    expect(payload.has("arg")).toBe(false);
  });

  it("omits_optional_fields_when_absent", () => {
    const iss = new Ed25519Signer(new Uint8Array(32).fill(3));
    const subject = did(4);

    const invocation = new InvocationBuilder()
      .issuer(iss)
      .audience(subject)
      .subject(subject)
      .commandFromStr("/")
      .proofs([])
      .expiration(null)
      .tryBuild();

    const payload = invocationPayload(envelopeParts(invocation.encode()).sigPayload);
    expect(payload.has("cause")).toBe(false);
    expect(payload.has("iat")).toBe(false);
    expect(payload.has("meta")).toBe(false);
    expect(payload.has("exp")).toBe(true);
  });

  it("omits_aud_when_equal_to_sub", () => {
    const iss = new Ed25519Signer(new Uint8Array(32).fill(0));
    const subject = did(0);

    const invocation = new InvocationBuilder()
      .issuer(iss)
      .audience(subject)
      .subject(subject)
      .commandFromStr("/")
      .proofs([])
      .expiration(null)
      .tryBuild();

    const payload = invocationPayload(envelopeParts(invocation.encode()).sigPayload);
    expect(payload.has("aud")).toBe(false);
    expect(payload.get("sub")).toBe(subject.toString());
  });

  it("includes_aud_when_different_from_sub", () => {
    const iss = new Ed25519Signer(new Uint8Array(32).fill(0));
    const aud = did(1);
    const sub = did(0);

    const invocation = new InvocationBuilder()
      .issuer(iss)
      .audience(aud)
      .subject(sub)
      .commandFromStr("/")
      .proofs([])
      .expiration(null)
      .tryBuild();

    const payload = invocationPayload(envelopeParts(invocation.encode()).sigPayload);
    expect(payload.get("aud")).toBe(aud.toString());
  });

  it("decode_rejects_missing_exp", () => {
    const iss = new Ed25519Signer(new Uint8Array(32).fill(6));
    const subject = did(5);

    const invocation = new InvocationBuilder()
      .issuer(iss)
      .audience(subject)
      .subject(subject)
      .commandFromStr("/")
      .proofs([])
      .expiration(null)
      .tryBuild();

    const { signature, sigPayload } = envelopeParts(invocation.encode());
    const payload = invocationPayload(sigPayload);
    payload.delete("exp");
    const mutated = ipldToDagCbor([signature, sigPayload]);

    expect(() => Invocation.decode(mutated)).toThrow("missing field exp");
  });

  it("decode_rejects_aud_equal_to_sub_on_wire", () => {
    const iss = new Ed25519Signer(new Uint8Array(32).fill(6));
    const subject = did(5);

    const invocation = new InvocationBuilder()
      .issuer(iss)
      .audience(subject)
      .subject(subject)
      .commandFromStr("/")
      .proofs([])
      .expiration(null)
      .tryBuild();

    const { signature, sigPayload } = envelopeParts(invocation.encode());
    const payload = invocationPayload(sigPayload);
    payload.set("aud", subject.toString());
    const mutated = ipldToDagCbor([signature, sigPayload]);

    expect(() => Invocation.decode(mutated)).toThrow("aud must be omitted when equal to sub");
  });
});
