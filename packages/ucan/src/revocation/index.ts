/**
 * UCAN revocation helpers.
 */

import { CID } from "multiformats/cid";
import type { Did, DidSigner } from "../did.js";
import { Command } from "../command.js";
import { Nonce } from "../crypto/nonce.js";
import type { Ipld } from "../ipld.js";
import type { InvocationPayload, Invocation } from "../invocation/index.js";
import { check } from "../invocation/index.js";
import { InvocationBuilder } from "../invocation/builder.js";
import type { DelegationStore } from "../delegation/store.js";
import { subjectCoherent } from "../delegation/subject.js";

/*
 * Spec conflict, resolved deliberately:
 * - core command grammar requires a leading slash: .reference/spec/README.md:405
 * - revocation prose predates that grammar and still shows "ucan/revoke"
 * We keep the grammar form "/ucan/revoke" here so Command.parse accepts the final spec.
 */
export const REVOKE_COMMAND = Command.parse("/ucan/revoke");

export function revoke<DSigner extends DidSigner>(
  builder: InvocationBuilder<DSigner>,
  revoked: CID,
  path: CID[] = [],
): Invocation<DSigner["did"]> {
  const args = new Map<string, Ipld>([["revoke", revoked]]);

  if (path.length > 0) {
    args.set("path", path);
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

  // Revocation/README.md §Store: a revoked delegation invalidates the chain if
  // the revoker is one of the proof-chain delegators. §Path Witness: delegated
  // revocations may also invalidate when their path witness resolves to a valid
  // delegation chain that reaches the revoked CID.
  for (const proofCid of payload.proofs) {
    const revocation = await revocationStore.lookup(proofCid);
    if (revocation === undefined) continue;

    if (proofs.some((proof) => proof.issuer.equals(revocation.issuer))) {
      throw new RevokedError(proofCid, revocation.issuer);
    }

    if (await pathWitnessInvalidates(revocation, proofCid, delegationStore)) {
      throw new RevokedError(proofCid, revocation.issuer);
    }
  }
}

async function pathWitnessInvalidates<D extends Did>(
  revocation: Invocation<D>,
  revoked: CID,
  delegationStore: DelegationStore<D>,
): Promise<boolean> {
  const path = revocation.arguments.get("path");
  if (!Array.isArray(path) || path.length === 0) return false;

  const pathCids: CID[] = [];
  for (const item of path) {
    const cid = CID.asCID(item);
    if (!cid) return false;
    pathCids.push(cid);
  }

  if (!pathCids[pathCids.length - 1].equals(revoked)) return false;

  let delegations;
  try {
    delegations = await delegationStore.getAll(pathCids);
  } catch {
    return false;
  }

  if (delegations.length !== pathCids.length) return false;
  if (!delegations.some((delegation) => delegation.issuer.equals(revocation.issuer))) return false;

  for (let i = 1; i < delegations.length; i++) {
    const previous = delegations[i - 1];
    const current = delegations[i];
    if (!previous.audience.equals(current.issuer)) return false;
    if (!subjectCoherent(previous.subject, current.subject)) return false;
  }

  return true;
}
