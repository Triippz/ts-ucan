/**
 * Delegation module.
 */

import type { CID } from "multiformats/cid";
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
  /**
   * Whether `meta` was present on the wire. The delegation spec marks `meta`
   * optional but (unlike invocation) does not require an empty map to be
   * omitted, so a signer MAY include `meta: {}`. We preserve that presence so
   * the re-encoded CID/SigPayload matches the exact bytes that were signed.
   * Undefined (builder-created) behaves as "omit when empty".
   */
  readonly metaPresent?: boolean;
}

export function delegationPayloadToIpld<D extends Did>(p: DelegationPayload<D>): Ipld {
  const entries: [string, Ipld][] = [
    ["iss", p.issuer.toString()],
    ["aud", p.audience.toString()],
    ["sub", subjectToIpld(p.subject)],
    ["cmd", p.command.toString()],
    ["pol", p.policy.map(predicateToIpld)],
    ["exp", p.expiration === null ? null : p.expiration.toIpld()],
    ["nonce", p.nonce.toIpld()],
  ];
  // meta is optional. Builder-created payloads omit an empty map (matching the
  // official 1.0.0 fixture bytes); decoded payloads preserve the presence seen
  // on the wire so an explicit `meta: {}` re-encodes byte-identically.
  if (p.metaPresent || p.meta.size > 0) {
    entries.push(["meta", p.meta]);
  }
  if (p.notBefore !== null) {
    entries.push(["nbf", p.notBefore.toIpld()]);
  }
  return new Map<string, Ipld>(entries);
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
  let notBefore: Timestamp | null = null;
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
        if (value === null) {
          throw new Error("expected nbf to be an integer");
        }
        notBefore = Timestamp.fromWireIpld(value);
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
    notBefore,
    meta,
    nonce,
    metaPresent: metaSeen,
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
    const envelope = envelopeFromIpld(ipld, tagOf(delegationPayloadTag), ipldToDelegationPayload<Ed25519Did>, ed25519TryFromTags);
    const delegation = new Delegation<Ed25519Did>(envelope);
    // spec §Encoding: signing is over canonical DAG-CBOR. Reject any wire form
    // that is not the exact canonical encoding so the bytes we verify a
    // signature over are exactly the bytes that were signed.
    if (!bytesEqual(delegation.encode(), bytes)) {
      throw new Error("delegation is not canonically encoded");
    }
    if (envelope.payload.header.codec.multicodecCode !== DAG_CBOR_CODE) {
      throw new Error("delegation varsig header must select DAG-CBOR");
    }
    return delegation;
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
      throw new Error("delegation varsig header must select DAG-CBOR");
    }
    const sigPayload = sigPayloadToIpld(this.envelope.payload.header, delegationPayloadTag, this.envelope.payload.payload, delegationPayloadToIpld);
    new Ed25519().tryVerify(DagCborCodec, issuer.publicKey, this.envelope.signature, sigPayload);
  }
}
