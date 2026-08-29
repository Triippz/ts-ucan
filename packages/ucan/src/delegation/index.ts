/**
 * Delegation module.
 */

import type { CID } from "multiformats/cid";
import type { Ipld } from "../ipld.js";
import { ipldFromDagCbor, ipldToDagCbor } from "../ipld.js";
import type { Did, VarsigConfigOf } from "../did.js";
import { Ed25519Did } from "../did.js";
import { Command } from "../command.js";
import { Nonce } from "../crypto/nonce.js";
import { Timestamp } from "../time/index.js";
import type { PayloadTag } from "../envelope/payloadTag.js";
import { envelopeFromIpld, envelopeToIpld, type Envelope } from "../envelope/index.js";
import { toDagCborCid } from "../cid.js";
import { ed25519TryFromTags } from "@marktripoli/varsig";
import type { Predicate } from "./policy/index.js";
import { ipldToPredicate, predicateToIpld } from "./policy/index.js";
import { ipldToSubject, subjectToIpld, type DelegatedSubject } from "./subject.js";
import { DelegationBuilder } from "./builder.js";

export type { DelegatedSubject } from "./subject.js";
export { subjectAllows, subjectCoherent, subjectToString, subjectToIpld, ipldToSubject } from "./subject.js";

export interface DelegationPayload<D extends Did = Did> {
  readonly issuer: D;
  readonly audience: D;
  readonly subject: DelegatedSubject<D>;
  readonly command: Command;
  readonly policy: Predicate[];
  readonly expiration: Timestamp | null;
  readonly notBefore: Timestamp | null;
  readonly meta: Map<string, Ipld>;
  readonly nonce: Nonce;
}

export function delegationPayloadToIpld<D extends Did>(p: DelegationPayload<D>): Ipld {
  return new Map<string, Ipld>([
    ["iss", p.issuer.toString()],
    ["aud", p.audience.toString()],
    ["sub", subjectToIpld(p.subject)],
    ["cmd", p.command.toString()],
    ["pol", p.policy.map(predicateToIpld)],
    ["exp", p.expiration === null ? null : p.expiration.toIpld()],
    ["nbf", p.notBefore === null ? null : p.notBefore.toIpld()],
    ["meta", p.meta],
    ["nonce", p.nonce.toIpld()],
  ]);
}

export function ipldToDelegationPayload<D extends Did>(i: Ipld): DelegationPayload<D> {
  if (!(i instanceof Map)) {
    throw new Error("expected delegation payload to be a map");
  }

  let issuer: D | undefined;
  let audience: D | undefined;
  let subject: DelegatedSubject<D> | undefined;
  let command: Command | undefined;
  let policy: Predicate[] | undefined;
  let expiration: Timestamp | null | undefined;
  let notBefore: Timestamp | null | undefined;
  let notBeforeSeen = false;
  let meta = new Map<string, Ipld>();
  let metaSeen = false;
  let nonce: Nonce | undefined;

  for (const [key, value] of i) {
    switch (key) {
      case "iss":
        if (issuer !== undefined) {
          throw new Error("duplicate field iss");
        }
        if (typeof value !== "string") {
          throw new Error("expected iss to be a DID string");
        }
        issuer = Ed25519Did.fromString(value) as unknown as D;
        break;
      case "aud":
        if (audience !== undefined) {
          throw new Error("duplicate field aud");
        }
        if (typeof value !== "string") {
          throw new Error("expected aud to be a DID string");
        }
        audience = Ed25519Did.fromString(value) as unknown as D;
        break;
      case "sub":
        if (subject !== undefined) {
          throw new Error("duplicate field sub");
        }
        subject = ipldToSubject<D>(value);
        break;
      case "cmd":
        if (command !== undefined) {
          throw new Error("duplicate field cmd");
        }
        if (typeof value !== "string") {
          throw new Error("expected cmd to be a string");
        }
        command = Command.parse(value);
        break;
      case "pol":
        if (policy !== undefined) {
          throw new Error("duplicate field pol");
        }
        if (!Array.isArray(value)) {
          throw new Error("expected pol to be an array");
        }
        policy = value.map((item) => ipldToPredicate(item));
        break;
      case "exp":
        if (expiration !== undefined) {
          throw new Error("duplicate field exp");
        }
        expiration = value === null ? null : Timestamp.fromWireIpld(value);
        break;
      case "nbf":
        if (notBeforeSeen) {
          throw new Error("duplicate field nbf");
        }
        notBeforeSeen = true;
        notBefore = value === null ? null : Timestamp.fromWireIpld(value);
        break;
      case "meta":
        if (metaSeen) {
          throw new Error("duplicate field meta");
        }
        metaSeen = true;
        if (!(value instanceof Map)) {
          throw new Error("expected meta to be a map");
        }
        meta = value;
        break;
      case "nonce":
        if (nonce !== undefined) {
          throw new Error("duplicate field nonce");
        }
        nonce = Nonce.fromIpld(value);
        break;
      default:
        throw new Error(`unknown field ${key}`);
    }
  }

  if (issuer === undefined) {
    throw new Error("missing field iss");
  }
  if (audience === undefined) {
    throw new Error("missing field aud");
  }
  if (subject === undefined) {
    throw new Error("missing field sub");
  }
  if (command === undefined) {
    throw new Error("missing field cmd");
  }
  if (policy === undefined) {
    throw new Error("missing field pol");
  }
  if (expiration === undefined) {
    throw new Error("missing field exp");
  }
  if (nonce === undefined) {
    throw new Error("missing field nonce");
  }

  return {
    issuer,
    audience,
    subject,
    command,
    policy,
    expiration,
    notBefore: notBefore ?? null,
    meta,
    nonce,
  };
}

/**
 * Spec §Type Tag: "The UCAN envelope tag for UCAN Delegation MUST be set to ucan/dlg@1.0.0"
 */
export const delegationPayloadTag: PayloadTag = {
  specId: "dlg",
  version: "1.0.0",
};

export class Delegation<D extends Did = Did> {
  constructor(
    private readonly envelope: Envelope<VarsigConfigOf<D>, DelegationPayload<D>>,
  ) {}

  static builder(): DelegationBuilder {
    return new DelegationBuilder();
  }

  get issuer(): D {
    return this.envelope.payload.payload.issuer;
  }

  get audience(): D {
    return this.envelope.payload.payload.audience;
  }

  get subject(): DelegatedSubject<D> {
    return this.envelope.payload.payload.subject;
  }

  get command(): Command {
    return this.envelope.payload.payload.command;
  }

  get policy(): Predicate[] {
    return this.envelope.payload.payload.policy;
  }

  get expiration(): Timestamp | null {
    return this.envelope.payload.payload.expiration;
  }

  get notBefore(): Timestamp | null {
    return this.envelope.payload.payload.notBefore;
  }

  get meta(): Map<string, Ipld> {
    return this.envelope.payload.payload.meta;
  }

  get nonce(): Nonce {
    return this.envelope.payload.payload.nonce;
  }

  encode(): Uint8Array {
    return ipldToDagCbor(envelopeToIpld(this.envelope, delegationPayloadTag, delegationPayloadToIpld));
  }

  toCid(): CID {
    return toDagCborCid(envelopeToIpld(this.envelope, delegationPayloadTag, delegationPayloadToIpld));
  }

  static decode(bytes: Uint8Array): Delegation<Ed25519Did> {
    const ipld = ipldFromDagCbor(bytes);
    const envelope = envelopeFromIpld(ipld, ipldToDelegationPayload<Ed25519Did>, ed25519TryFromTags);
    return new Delegation<Ed25519Did>(envelope);
  }
}
