/**
 * Invocation module.
 */

import { CID } from "multiformats/cid";
import type { Ipld } from "../ipld.js";
import { ipldFromDagCbor, ipldToDagCbor, bytesEqual } from "../ipld.js";
import type { Did, VarsigConfigOf } from "../did.js";
import { Ed25519Did } from "../did.js";
import { Command } from "../command.js";
import { Nonce } from "../crypto/nonce.js";
import { Timestamp } from "../time/index.js";
import type { PayloadTag } from "../envelope/index.js";
import { envelopeFromIpld, envelopeToIpld, sigPayloadToIpld, tagOf, type Envelope } from "../envelope/index.js";
import { toDagCborCid } from "../cid.js";
import { ed25519TryFromTags, Ed25519, DagCborCodec, DAG_CBOR_CODE } from "@marktripoli/varsig";
import type { Delegation } from "../delegation/index.js";
import type { DelegationStore } from "../delegation/store.js";
import { subjectAllows } from "../delegation/subject.js";
import { runPredicate, RunError } from "../delegation/policy/index.js";
import { InvocationBuilder } from "./builder.js";

export interface InvocationPayload<D extends Did = Did> {
  readonly issuer: D;
  readonly audience: D;
  readonly subject: D;
  readonly command: Command;
  readonly arguments: Map<string, Ipld>;
  readonly proofs: CID[];
  readonly cause: CID | null;
  readonly issuedAt: Timestamp | null;
  readonly expiration: Timestamp | null;
  readonly meta: Map<string, Ipld>;
  readonly nonce: Nonce;
}

export function invocationPayloadToIpld<D extends Did>(p: InvocationPayload<D>): Ipld {
  // Spec §Audience: omit aud when same as sub
  const entries: [string, Ipld][] = [
    ["iss", p.issuer.toString()],
    ["sub", p.subject.toString()],
    ["cmd", p.command.toString()],
    ["args", p.arguments],
    ["prf", p.proofs],
    ["exp", p.expiration === null ? null : p.expiration.toIpld()],
    ["nonce", p.nonce.toIpld()],
  ];
  if (p.cause !== null) {
    entries.push(["cause", p.cause]);
  }
  if (p.issuedAt !== null) {
    entries.push(["iat", p.issuedAt.toIpld()]);
  }
  if (p.meta.size > 0) {
    entries.push(["meta", p.meta]);
  }
  if (!p.audience.equals(p.subject)) {
    entries.splice(1, 0, ["aud", p.audience.toString()]);
  }
  return new Map<string, Ipld>(entries);
}

export function ipldToInvocationPayload<D extends Did>(i: Ipld): InvocationPayload<D> {
  if (!(i instanceof Map)) {
    throw new Error("expected invocation payload to be a map");
  }

  let issuer: D | undefined;
  let audience: D | undefined;
  let subject: D | undefined;
  let command: Command | undefined;
  let argumentsValue: Map<string, Ipld> | undefined;
  let proofs: CID[] | undefined;
  let cause: CID | null | undefined;
  let issuedAt: Timestamp | null | undefined;
  let expiration: Timestamp | null | undefined;
  let meta: Map<string, Ipld> | undefined;
  let nonce: Nonce | undefined;

  for (const [key, value] of i) {
    switch (key) {
      case "iss":
        if (issuer !== undefined) throw new Error("duplicate field iss");
        if (typeof value !== "string") throw new Error("expected iss to be a DID string");
        issuer = Ed25519Did.fromString(value) as unknown as D;
        break;
      case "aud":
        if (audience !== undefined) throw new Error("duplicate field aud");
        if (typeof value !== "string") throw new Error("expected aud to be a DID string");
        audience = Ed25519Did.fromString(value) as unknown as D;
        break;
      case "sub":
        if (subject !== undefined) throw new Error("duplicate field sub");
        if (typeof value !== "string") throw new Error("expected sub to be a DID string");
        subject = Ed25519Did.fromString(value) as unknown as D;
        break;
      case "cmd":
        if (command !== undefined) throw new Error("duplicate field cmd");
        if (typeof value !== "string") throw new Error("expected cmd to be a string");
        command = Command.parse(value);
        break;
      case "args":
        if (argumentsValue !== undefined) throw new Error("duplicate field args");
        if (!(value instanceof Map)) throw new Error("expected args to be a map");
        argumentsValue = new Map(value);
        break;
      case "prf":
        if (proofs !== undefined) throw new Error("duplicate field prf");
        if (!Array.isArray(value)) throw new Error("expected prf to be an array");
        proofs = value.map((item) => {
          const cid = CID.asCID(item);
          if (!cid) throw new Error("expected prf items to be CIDs");
          return cid;
        });
        break;
      case "cause":
        if (cause !== undefined) throw new Error("duplicate field cause");
        if (value === null) throw new Error("expected cause to be a CID");
        {
          const cid = CID.asCID(value);
          if (!cid) throw new Error("expected cause to be a CID");
          cause = cid;
        }
        break;
      case "iat":
        if (issuedAt !== undefined) throw new Error("duplicate field iat");
        if (value === null) throw new Error("expected iat to be an integer");
        issuedAt = Timestamp.fromWireIpld(value);
        break;
      case "exp":
        if (expiration !== undefined) throw new Error("duplicate field exp");
        expiration = value === null ? null : Timestamp.fromWireIpld(value);
        break;
      case "meta":
        if (meta !== undefined) throw new Error("duplicate field meta");
        if (!(value instanceof Map)) throw new Error("expected meta to be a map");
        meta = new Map(value);
        break;
      case "nonce":
        if (nonce !== undefined) throw new Error("duplicate field nonce");
        nonce = Nonce.fromIpld(value);
        break;
      default:
        break;
    }
  }

  if (issuer === undefined) throw new Error("missing field iss");
  if (subject === undefined) throw new Error("missing field sub");
  if (audience === undefined) {
    audience = subject;
  } else if (audience.equals(subject)) {
    throw new Error("aud must be omitted when equal to sub");
  }
  if (command === undefined) throw new Error("missing field cmd");
  if (argumentsValue === undefined) throw new Error("missing field args");
  if (proofs === undefined) throw new Error("missing field prf");
  if (expiration === undefined) throw new Error("missing field exp");
  if (nonce === undefined) throw new Error("missing field nonce");
  if (meta === undefined) {
    meta = new Map();
  }

  return {
    issuer,
    audience,
    subject,
    command,
    arguments: argumentsValue,
    proofs,
    cause: cause ?? null,
    issuedAt: issuedAt ?? null,
    expiration,
    meta,
    nonce,
  };
}

export function invocationPayloadToCid<D extends Did>(p: InvocationPayload<D>): CID {
  return toDagCborCid(invocationPayloadToIpld(p));
}

/**
 * SEMANTIC-ONLY chain/predicate/time validation. This does NOT verify envelope
 * signatures, proof CIDs, the executor audience, or replay, and MUST NOT be used
 * as an authorization gate on untrusted input. Use `verifyInvocation` for
 * authorization.
 */
export async function check<D extends Did>(payload: InvocationPayload<D>, store: DelegationStore<D>, now: Timestamp = Timestamp.now()): Promise<void> {
  let realizedProofs: Delegation<D>[];
  try {
    realizedProofs = await store.getAll(payload.proofs);
  } catch (error) {
    throw new StoredCheckError("getError", error);
  }

  checkResolved(payload, realizedProofs, now);
}

/**
 * Run the time and semantic checks against an already-resolved proof array,
 * wrapping CheckFailed as StoredCheckError to match `check`'s contract.
 *
 * Callers that authenticate proofs themselves (e.g. verifyInvocation) pass the
 * exact verified array here so the checks never route back through a store whose
 * responses could differ from the ones whose CIDs/signatures were verified.
 */
export function checkResolved<D extends Did>(payload: InvocationPayload<D>, proofs: Delegation<D>[], now: Timestamp = Timestamp.now(), leewaySeconds = 0): void {
  try {
    timeBoundChecks(payload, proofs, now, leewaySeconds);
    syntaticChecks(payload, proofs);
  } catch (error) {
    if (error instanceof CheckFailed) {
      throw new StoredCheckError("checkFailed", error);
    }
    throw error;
  }
}

function shiftSeconds(t: Timestamp, deltaSeconds: number): Timestamp {
  const raw = t.toUnix();
  const cur = typeof raw === "bigint" ? raw : BigInt(raw);
  const shifted = cur + BigInt(deltaSeconds);
  return Timestamp.fromUnix(shifted < 0n ? 0n : shifted);
}

/**
 * Time-bounds validation per the delegation spec's Token Validation section:
 * a proof is invalid before its `nbf` or after its `exp`; the invocation's own
 * `exp` must also not have passed. All proofs must be valid at execution time.
 *
 * `leewaySeconds` widens both bounds symmetrically to tolerate clock drift
 * (spec §Time Bounds RECOMMENDS a ±60s buffer). Default 0 preserves exact bounds.
 */
export function timeBoundChecks<D extends Did>(payload: InvocationPayload<D>, proofs: Iterable<Delegation<D>>, now: Timestamp = Timestamp.now(), leewaySeconds = 0): void {
  const earliest = leewaySeconds > 0 ? shiftSeconds(now, -leewaySeconds) : now;
  const latest = leewaySeconds > 0 ? shiftSeconds(now, leewaySeconds) : now;
  if (payload.expiration !== null && payload.expiration.compare(earliest) < 0) {
    throw new CheckFailed("invocationExpired", payload.expiration);
  }
  for (const proof of proofs) {
    if (proof.notBefore !== null && proof.notBefore.compare(latest) > 0) {
      throw new CheckFailed("proofNotYetValid", proof);
    }
    if (proof.expiration !== null && proof.expiration.compare(earliest) < 0) {
      throw new CheckFailed("proofExpired", proof);
    }
  }
}

export function syntaticChecks<D extends Did>(payload: InvocationPayload<D>, proofs: Iterable<Delegation<D>>): void {
  const args = payload.arguments;

  let expectedIssuer = payload.subject;
  let previous: Delegation<D> | null = null;

  for (const proof of proofs) {
    // delegation spec §Powerline: `sub: null` MUST NOT be the root delegation.
    if (previous === null && proof.subject.kind === "any") {
      throw new CheckFailed("rootProofIssuerIsNotSubject", proof);
    }

    if (!subjectAllows(proof.subject, payload.subject)) {
      throw new CheckFailed("subjectNotAllowedByProof", proof);
    }

    if (!proof.issuer.equals(expectedIssuer)) {
      throw new CheckFailed("invalidProofIssuerChain", { expectedIssuer, found: proof.issuer });
    }

    // spec §Attenuation: each direct delegation MUST restate or attenuate the
    // parent command; a child may only equal or extend its parent's path.
    if (previous !== null && !proof.command.startsWith(previous.command)) {
      throw new CheckFailed("commandMismatch", { expected: previous.command, found: proof.command });
    }

    if (!payload.command.startsWith(proof.command)) {
      throw new CheckFailed("commandMismatch", { expected: payload.command, found: proof.command });
    }

    for (const predicate of proof.policy) {
      let passed: boolean;
      try {
        passed = runPredicate(predicate, args);
      } catch (error) {
        if (error instanceof RunError) {
          throw new CheckFailed("predicateRunError", error);
        }
        throw error;
      }
      if (!passed) {
        throw new CheckFailed("predicateFailed", predicate);
      }
    }

    expectedIssuer = proof.audience;
    previous = proof;
  }

  if (!expectedIssuer.equals(payload.issuer)) {
    throw new CheckFailed("invalidProofIssuerChain", { expectedIssuer, found: payload.issuer });
  }
}

/**
 * Spec §Type Tag: "The UCAN envelope's payload tag MUST be ucan/inv@1.0.0"
 */
export const invocationPayloadTag: PayloadTag = {
  specId: "inv",
  version: "1.0.0",
};

export class CheckFailed extends Error {
  constructor(
    readonly reason:
      | "waitingOnPromise"
      | "commandMismatch"
      | "predicateRunError"
      | "predicateFailed"
      | "invalidProofIssuerChain"
      | "subjectNotAllowedByProof"
      | "rootProofIssuerIsNotSubject"
      | "invocationExpired"
      | "proofNotYetValid"
      | "proofExpired",
    readonly detail?: unknown,
  ) {
    super(reason);
    this.name = "CheckFailed";
  }
}

export class StoredCheckError extends Error {
  constructor(readonly reason: "getError" | "checkFailed", readonly detail?: unknown) {
    super(reason);
    this.name = "StoredCheckError";
  }
}

export class Invocation<D extends Did = Did> {
  constructor(
    private readonly envelope: Envelope<VarsigConfigOf<D>, InvocationPayload<D>>,
  ) {}

  static builder<DSigner extends import("../did.js").DidSigner = import("../did.js").DidSigner>() {
    return new InvocationBuilder<DSigner>();
  }

  get payload(): InvocationPayload<D> {
    return this.envelope.payload.payload;
  }

  get issuer(): D {
    return this.envelope.payload.payload.issuer;
  }

  get audience(): D {
    return this.envelope.payload.payload.audience;
  }

  get subject(): D {
    return this.envelope.payload.payload.subject;
  }

  get command(): Command {
    return this.envelope.payload.payload.command;
  }

  get arguments(): Map<string, Ipld> {
    return this.envelope.payload.payload.arguments;
  }

  get proofs(): CID[] {
    return this.envelope.payload.payload.proofs;
  }

  get cause(): CID | null {
    return this.envelope.payload.payload.cause;
  }

  get expiration(): Timestamp | null {
    return this.envelope.payload.payload.expiration;
  }

  get issuedAt(): Timestamp | null {
    return this.envelope.payload.payload.issuedAt;
  }

  get meta(): Map<string, Ipld> {
    return this.envelope.payload.payload.meta;
  }

  get nonce(): Nonce {
    return this.envelope.payload.payload.nonce;
  }

  encode(): Uint8Array {
    return ipldToDagCbor(envelopeToIpld(this.envelope, invocationPayloadTag, invocationPayloadToIpld));
  }

  toCid(): CID {
    return toDagCborCid(envelopeToIpld(this.envelope, invocationPayloadTag, invocationPayloadToIpld));
  }

  static decode(bytes: Uint8Array): Invocation<Ed25519Did> {
    const ipld = ipldFromDagCbor(bytes);
    const envelope = envelopeFromIpld(ipld, tagOf(invocationPayloadTag), ipldToInvocationPayload<Ed25519Did>, ed25519TryFromTags);
    const invocation = new Invocation<Ed25519Did>(envelope);
    // spec §Encoding: signing is over canonical DAG-CBOR. Reject any wire form
    // that is not the exact canonical encoding (unknown fields, empty `meta`,
    // non-canonical varsig LEB128, etc.), so the bytes we verify a signature
    // over are exactly the bytes that were signed.
    if (!bytesEqual(invocation.encode(), bytes)) {
      throw new Error("invocation is not canonically encoded");
    }
    if (envelope.payload.header.codec.multicodecCode !== DAG_CBOR_CODE) {
      throw new Error("invocation varsig header must select DAG-CBOR");
    }
    return invocation;
  }

  /**
   * Cryptographically verify the envelope signature against the issuer's key.
   *
   * Verification does not trust the envelope's header object: it re-derives a
   * fresh Ed25519/DAG-CBOR verifier and checks the signature against the
   * issuer's key over the canonical SigPayload. Throws on failure.
   */
  verifySignature(): void {
    const issuer: Did = this.envelope.payload.payload.issuer;
    if (!(issuer instanceof Ed25519Did)) {
      throw new Error("signature verification requires an Ed25519 issuer");
    }
    if (this.envelope.payload.header.codec.multicodecCode !== DAG_CBOR_CODE) {
      throw new Error("invocation varsig header must select DAG-CBOR");
    }
    const sigPayload = sigPayloadToIpld(this.envelope.payload.header, invocationPayloadTag, this.envelope.payload.payload, invocationPayloadToIpld);
    new Ed25519().tryVerify(DagCborCodec, issuer.publicKey, this.envelope.signature, sigPayload);
  }
}

