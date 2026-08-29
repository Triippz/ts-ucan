/**
 * Invocation module (Lane I).
 *
 * Placeholder file created by Lane C.
 * To be implemented by Lane I (invocation.rs).
 */

import type { Ipld } from "../ipld.js";
import type { Did } from "../did.js";
import type { Command } from "../command.js";
import type { Nonce } from "../crypto/nonce.js";
import type { Timestamp } from "../time/index.js";
import type { PayloadTag } from "../envelope/index.js";
import type { DelegationStore } from "../delegation/store.js";
import { CID } from "multiformats/cid";

export interface InvocationPayload<D extends Did = Did> {
  issuer: D;
  audience: D;
  subject: D;
  command: Command;
  arguments: Map<string, any>;
  proofs: CID[];
  cause: CID | null;
  issuedAt: Timestamp | null;
  expiration: Timestamp | null;
  meta: Map<string, Ipld>;
  nonce: Nonce;
}

export function invocationPayloadToIpld<D extends Did>(p: InvocationPayload<D>): Ipld {
  throw new Error("Not yet implemented");
}

export function ipldToInvocationPayload<D extends Did>(i: Ipld): InvocationPayload<D> {
  throw new Error("Not yet implemented");
}

export function invocationPayloadToCid<D extends Did>(p: InvocationPayload<D>): CID {
  throw new Error("Not yet implemented");
}

export async function check<D extends Did>(
  payload: InvocationPayload<D>,
  store: DelegationStore<D>
): Promise<void> {
  throw new Error("Not yet implemented");
}

export function syntaticChecks<D extends Did>(
  payload: InvocationPayload<D>,
  proofs: Iterable<any>
): void {
  throw new Error("Not yet implemented");
}

export const invocationPayloadTag: PayloadTag = {
  specId: "inv",
  version: "1.0.0-rc.1",
};

export class CheckFailed extends Error {
  constructor(readonly reason: string) {
    super(`check failed: ${reason}`);
    this.name = "CheckFailed";
  }
}

export class StoredCheckError extends Error {
  constructor(readonly reason: string) {
    super(`stored check error: ${reason}`);
    this.name = "StoredCheckError";
  }
}

export class Invocation<D extends Did = Did> {
  constructor(envelope: any) {
    throw new Error("Not yet implemented");
  }

  static builder() {
    throw new Error("Not yet implemented");
  }

  encode(): Uint8Array {
    throw new Error("Not yet implemented");
  }

  static decode(bytes: Uint8Array): Invocation<Did> {
    throw new Error("Not yet implemented");
  }

  toCid(): CID {
    throw new Error("Not yet implemented");
  }
}
