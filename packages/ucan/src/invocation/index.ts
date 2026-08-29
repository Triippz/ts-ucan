/**
 * Invocation module.
 */

import { CID } from "multiformats/cid";
import type { Ipld } from "../ipld.js";
import { ipldFromDagCbor, ipldToDagCbor } from "../ipld.js";
import type { Did, VarsigConfigOf } from "../did.js";
import { Ed25519Did } from "../did.js";
import { Command } from "../command.js";
import { Nonce } from "../crypto/nonce.js";
import { Timestamp } from "../time/index.js";
import type { PayloadTag } from "../envelope/index.js";
import { envelopeFromIpld, envelopeToIpld, type Envelope } from "../envelope/index.js";
import { toDagCborCid } from "../cid.js";
import { ed25519TryFromTags, Varsig } from "@ucans/varsig";
import type { Delegation } from "../delegation/index.js";
import type { DelegationStore } from "../delegation/store.js";
import { subjectAllows } from "../delegation/subject.js";
import { runPredicate, RunError, type Predicate } from "../delegation/policy/index.js";
import { promisedToIpld, promisedToWireIpld, wireIpldToPromised, type Promised, WaitingOnError } from "../promise.js";
import { InvocationBuilder } from "./builder.js";

export interface InvocationPayload<D extends Did = Did> {
  readonly issuer: D;
  readonly audience: D;
  readonly subject: D;
  readonly command: Command;
  readonly arguments: Map<string, Promised>;
  readonly proofs: CID[];
  readonly cause: CID | null;
  readonly issuedAt: Timestamp | null;
  readonly expiration: Timestamp | null;
  readonly meta: Map<string, Ipld>;
  readonly nonce: Nonce;
}

export function invocationPayloadToIpld<D extends Did>(p: InvocationPayload<D>): Ipld {
  return new Map<string, Ipld>([
    ["iss", p.issuer.toString()],
    ["aud", p.audience.toString()],
    ["sub", p.subject.toString()],
    ["cmd", p.command.toString()],
    ["arg", mapToIpld(p.arguments, promisedToWireIpld)],
    ["prf", p.proofs],
    ["cause", p.cause],
    ["iat", p.issuedAt === null ? null : p.issuedAt.toIpld()],
    ["exp", p.expiration === null ? null : p.expiration.toIpld()],
    ["meta", p.meta],
    ["nonce", p.nonce.toIpld()],
  ]);
}

export function ipldToInvocationPayload<D extends Did>(i: Ipld): InvocationPayload<D> {
  if (!(i instanceof Map)) {
    throw new Error("expected invocation payload to be a map");
  }

  let issuer: D | undefined;
  let audience: D | undefined;
  let subject: D | undefined;
  let command: Command | undefined;
  let argumentsValue: Map<string, Promised> | undefined;
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
      case "arg":
        if (argumentsValue !== undefined) throw new Error("duplicate field arg");
        if (!(value instanceof Map)) throw new Error("expected arg to be a map");
        argumentsValue = mapToValue(value, wireIpldToPromised);
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
        if (value === null) {
          cause = null;
        } else {
          const cid = CID.asCID(value);
          if (!cid) throw new Error("expected cause to be a CID or null");
          cause = cid;
        }
        break;
      case "iat":
        if (issuedAt !== undefined) throw new Error("duplicate field iat");
        issuedAt = value === null ? null : Timestamp.fromIpld(value);
        break;
      case "exp":
        if (expiration !== undefined) throw new Error("duplicate field exp");
        expiration = value === null ? null : Timestamp.fromIpld(value);
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
  if (audience === undefined) throw new Error("missing field aud");
  if (subject === undefined) throw new Error("missing field sub");
  if (command === undefined) throw new Error("missing field cmd");
  if (argumentsValue === undefined) throw new Error("missing field arg");
  if (proofs === undefined) throw new Error("missing field prf");
  if (meta === undefined) throw new Error("missing field meta");
  if (nonce === undefined) throw new Error("missing field nonce");

  return {
    issuer,
    audience,
    subject,
    command,
    arguments: argumentsValue,
    proofs,
    cause: cause ?? null,
    issuedAt: issuedAt ?? null,
    expiration: expiration ?? null,
    meta,
    nonce,
  };
}

export function invocationPayloadToCid<D extends Did>(p: InvocationPayload<D>): CID {
  return toDagCborCid(invocationPayloadToIpld(p));
}

export async function check<D extends Did>(payload: InvocationPayload<D>, store: DelegationStore<D>): Promise<void> {
  let realizedProofs: Delegation<D>[];
  try {
    realizedProofs = await store.getAll(payload.proofs);
  } catch (error) {
    throw new StoredCheckError("getError", error);
  }

  try {
    syntaticChecks(payload, realizedProofs);
  } catch (error) {
    if (error instanceof CheckFailed) {
      throw new StoredCheckError("checkFailed", error);
    }
    throw error;
  }
}

export function syntaticChecks<D extends Did>(payload: InvocationPayload<D>, proofs: Iterable<Delegation<D>>): void {
  let args: Ipld;
  try {
    args = mapToIpld(payload.arguments, promisedToIpld);
  } catch (error) {
    if (error instanceof WaitingOnError) {
      throw new CheckFailed("waitingOnPromise", error);
    }
    throw error;
  }

  let expectedIssuer = payload.subject;

  for (const proof of proofs) {
    if (!subjectAllows(proof.subject, payload.subject)) {
      throw new CheckFailed("subjectNotAllowedByProof", proof);
    }

    if (!proof.issuer.equals(expectedIssuer)) {
      throw new CheckFailed("invalidProofIssuerChain", { expectedIssuer, found: proof.issuer });
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
  }

  if (!expectedIssuer.equals(payload.issuer)) {
    throw new CheckFailed("invalidProofIssuerChain", { expectedIssuer, found: payload.issuer });
  }
}

export const invocationPayloadTag: PayloadTag = {
  specId: "inv",
  version: "1.0.0-rc.1",
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
      | "rootProofIssuerIsNotSubject",
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

  get arguments(): Map<string, Promised> {
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
    const envelope = envelopeFromIpld(ipld, ipldToInvocationPayload<Ed25519Did>, ed25519TryFromTags);
    return new Invocation<Ed25519Did>(envelope);
  }
}

function mapToIpld<T>(map: Map<string, T>, convert: (value: T) => Ipld): Map<string, Ipld> {
  const out = new Map<string, Ipld>();
  for (const [key, value] of map) {
    out.set(key, convert(value));
  }
  return out;
}

function mapToValue<T>(map: Map<string, Ipld>, convert: (value: Ipld) => T): Map<string, T> {
  const out = new Map<string, T>();
  for (const [key, value] of map) {
    out.set(key, convert(value));
  }
  return out;
}
