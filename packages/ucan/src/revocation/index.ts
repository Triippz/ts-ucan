/**
 * UCAN revocation helpers.
 */

import { CID } from "multiformats/cid";
import type { Did, DidSigner } from "../did.js";
import { Command } from "../command.js";
import { Nonce } from "../crypto/nonce.js";
import type { InvocationPayload, Invocation } from "../invocation/index.js";
import { check } from "../invocation/index.js";
import { InvocationBuilder } from "../invocation/builder.js";
import type { DelegationStore } from "../delegation/store.js";
import type { Promised } from "../promise.js";

// Revocation/README.md still spells the command as "ucan/revoke" in prose, while
// spec/README.md requires commands to be slash-delimited. Parse the final UCAN
// grammar form here so it survives Command.parse.
export const REVOKE_COMMAND = Command.parse("/ucan/revoke");

export function revoke<DSigner extends DidSigner>(
  builder: InvocationBuilder<DSigner>,
  revoked: CID,
  path: CID[] = [],
): Invocation<DSigner["did"]> {
  const args = new Map<string, Promised>([["revoke", link(revoked)]]);

  if (path.length > 0) {
    args.set("path", { kind: "list", values: path.map(link) });
  }

  // Revocation/README.md §Invoking Revocation: nonce MUST be empty bytes because
  // revocation is idempotent.
  return builder
    .command(REVOKE_COMMAND)
    .arguments(args)
    .nonce(Nonce.fromBytes(new Uint8Array()))
    .tryBuild();
}

export interface RevocationStore<D extends Did = Did> {
  insert(revoked: CID, revocation: Invocation<D>): Promise<void>;
  lookup(revoked: CID): Promise<Invocation<D> | undefined>;
}

export class MapRevocationStore<D extends Did = Did> implements RevocationStore<D> {
  private readonly map = new Map<string, Invocation<D>>();

  async insert(revoked: CID, revocation: Invocation<D>): Promise<void> {
    const key = revoked.toString();
    if (!this.map.has(key)) {
      this.map.set(key, revocation);
    }
  }

  async lookup(revoked: CID): Promise<Invocation<D> | undefined> {
    return this.map.get(revoked.toString());
  }
}

export class RevokedError extends Error {
  constructor(readonly revoked: CID, readonly revoker: Did) {
    super(`delegation ${revoked.toString()} revoked by ${revoker.toString()}`);
    this.name = "RevokedError";
  }
}

export async function checkWithRevocations<D extends Did>(
  payload: InvocationPayload<D>,
  delegationStore: DelegationStore<D>,
  revocationStore: RevocationStore<D>,
): Promise<void> {
  await check(payload, delegationStore);

  const proofs = await delegationStore.getAll(payload.proofs);
  const proofIssuers = proofs.map((proof) => proof.issuer);
  const proofCidStrings = new Set(payload.proofs.map((cid) => cid.toString()));

  // Revocation/README.md §Store: a revoked delegation invalidates the chain if
  // the revoker is one of the proof-chain delegators. §Path Witness: delegated
  // revocations may also invalidate when their path witness overlaps the chain.
  for (const proofCid of payload.proofs) {
    const revocation = await revocationStore.lookup(proofCid);
    if (revocation === undefined) continue;

    if (proofIssuers.some((issuer) => issuer.equals(revocation.issuer))) {
      throw new RevokedError(proofCid, revocation.issuer);
    }

    if (pathWitnessOverlapsProofChain(revocation, proofCidStrings)) {
      throw new RevokedError(proofCid, revocation.issuer);
    }
  }
}

function link(cid: CID): Promised {
  return { kind: "link", cid };
}

function pathWitnessOverlapsProofChain(revocation: Invocation<Did>, proofCidStrings: Set<string>): boolean {
  const path = revocation.arguments.get("path");
  if (path === undefined) return false;
  if (path.kind !== "list") {
    throw new Error("expected revocation path to be a list");
  }

  for (const item of path.values) {
    if (item.kind !== "link") {
      throw new Error("expected revocation path entries to be CIDs");
    }
    if (proofCidStrings.has(item.cid.toString())) {
      return true;
    }
  }

  return false;
}
