/**
 * Delegation module (Lane E).
 *
 * Placeholder file created by Lane C.
 * To be implemented by Lane E (delegation.rs).
 */

import type { Ipld } from "../ipld.js";
import type { Did } from "../did.js";
import type { Command } from "../command.js";
import type { Nonce } from "../crypto/nonce.js";
import type { Timestamp } from "../time/index.js";
import type { PayloadTag } from "../envelope/index.js";

export interface DelegatedSubject<D extends Did = Did> {
  kind: "specific" | "any";
  did?: D;
}

export function subjectAllows<D extends Did>(s: DelegatedSubject<D>, subject: D): boolean {
  throw new Error("Not yet implemented");
}

export function subjectCoherent<D extends Did>(a: DelegatedSubject<D>, b: DelegatedSubject<D>): boolean {
  throw new Error("Not yet implemented");
}

export function subjectToString<D extends Did>(s: DelegatedSubject<D>): string {
  throw new Error("Not yet implemented");
}

export function subjectToIpld<D extends Did>(s: DelegatedSubject<D>): Ipld {
  throw new Error("Not yet implemented");
}

export function ipldToSubject<D extends Did>(i: Ipld): DelegatedSubject<D> {
  throw new Error("Not yet implemented");
}

export interface DelegationPayload<D extends Did = Did> {
  issuer: D;
  audience: D;
  subject: DelegatedSubject<D>;
  command: Command;
  policy: any[]; // Predicate[]
  expiration: Timestamp | null;
  notBefore: Timestamp | null;
  meta: Map<string, Ipld>;
  nonce: Nonce;
}

export function delegationPayloadToIpld<D extends Did>(p: DelegationPayload<D>): Ipld {
  throw new Error("Not yet implemented");
}

export function ipldToDelegationPayload<D extends Did>(i: Ipld): DelegationPayload<D> {
  throw new Error("Not yet implemented");
}

export const delegationPayloadTag: PayloadTag = {
  specId: "dlg",
  version: "1.0.0-rc.1",
};

export class Delegation<D extends Did = Did> {
  constructor(envelope: any) {
    throw new Error("Not yet implemented");
  }

  static builder() {
    throw new Error("Not yet implemented");
  }

  encode(): Uint8Array {
    throw new Error("Not yet implemented");
  }

  static decode(bytes: Uint8Array): Delegation<Did> {
    throw new Error("Not yet implemented");
  }

  toCid(): any {
    throw new Error("Not yet implemented");
  }
}
