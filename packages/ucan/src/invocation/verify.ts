/**
 * Full cryptographic verification of an invocation and its proof chain.
 *
 * Unlike `check`, which only validates time bounds, chain relationships,
 * command attenuation, and predicates, `verifyInvocation` also authenticates
 * the invocation envelope signature, each delegation envelope signature, that
 * every fetched delegation matches its requested CID, that the executor is the
 * intended audience, and that the invocation has not been replayed.
 *
 * IMPORTANT: pass an invocation produced by `Invocation.decode`, whose bytes
 * were canonically validated at the trust boundary. Verifying a hand-built
 * `Invocation` only proves whatever its in-memory envelope claims.
 */

import { CID } from "multiformats/cid";
import type { Ed25519Did } from "../did.js";
import { Timestamp } from "../time/index.js";
import { Delegation } from "../delegation/index.js";
import type { DelegationStore } from "../delegation/store.js";
import type { RevocationStore } from "../revocation/index.js";
import { checkRevocations } from "../revocation/index.js";
import { checkResolved, StoredCheckError, Invocation } from "./index.js";

export class VerifyError extends Error {
  constructor(
    readonly reason:
      | "invalidInvocationSignature"
      | "invalidProofSignature"
      | "proofCidMismatch"
      | "proofCountMismatch"
      | "audienceMismatch"
      | "replay",
    readonly detail?: unknown,
  ) {
    super(reason);
    this.name = "VerifyError";
  }
}

/**
 * Tracks invocation CIDs already executed, to satisfy the spec's REQUIRED
 * replay prevention (spec §Replay Attack Prevention): each invocation MUST
 * hash to a unique CID and the executor MUST reject a repeat.
 */
export interface ReplayStore {
  /**
   * Atomically record `cid` as seen. MUST throw if `cid` was already claimed.
   */
  claim(cid: CID): Promise<void>;
}

export class MapReplayStore implements ReplayStore {
  private readonly seen = new Set<string>();

  async claim(cid: CID): Promise<void> {
    const key = cid.toString();
    // ponytail: single-process atomicity via Set; a shared/distributed store
    // needs its own atomic claim if multiple executors run concurrently.
    if (this.seen.has(key)) {
      throw new VerifyError("replay", cid);
    }
    this.seen.add(key);
  }
}

/**
 * Verify an invocation end to end:
 *
 * 1. Verify the invocation envelope signature against `invocation.issuer`.
 * 2. Require the invocation audience to equal the executing agent (`executor`).
 * 3. Load every proof by CID, exactly once.
 * 4. Require the returned count to match, recompute each proof's CID, and
 *    compare with the requested CID in order.
 * 5. Verify every delegation envelope signature against its issuer.
 * 6. Run the time, chain, command, and predicate checks against that same
 *    verified proof array (never re-fetched from the store).
 * 7. Run revocation checks against the verified proofs when a store is supplied.
 * 8. Claim the invocation CID in the replay store (last, so a rejected
 *    invocation does not burn its CID).
 *
 * Structured failures: `VerifyError` (signature/CID/count/audience/replay),
 * `StoredCheckError` (time/chain/command/predicate), or `RevokedError`.
 *
 * Returns the authenticated, caller-detached `Invocation` snapshot. Consumers
 * MUST read command/arguments/etc. from the RETURNED value, not the object they
 * passed in: the input is mutable and a hostile `DelegationStore` could mutate
 * it during an internal await. The returned snapshot is the exact bytes whose
 * signature was verified.
 */
export async function verifyInvocation(
  invocation: Invocation<Ed25519Did>,
  delegationStore: DelegationStore<Ed25519Did>,
  options: {
    executor: Ed25519Did;
    replayStore: ReplayStore;
    revocationStore?: RevocationStore<Ed25519Did>;
    now?: Timestamp;
    leewaySeconds?: number;
  },
): Promise<Invocation<Ed25519Did>> {
  // Capture every option field synchronously, before any await. `options` is
  // caller-owned and could be mutated across an await (e.g. a hostile store
  // clearing revocationStore, swapping replayStore, or moving now/leeway).
  const executor = options.executor;
  const leewaySeconds = options.leewaySeconds ?? 0;
  // Snapshot `now` BY VALUE: Timestamp uses TS-private (not #private) state, so
  // a caller/store sharing the reference could mutate its seconds across an
  // await to defeat exp/nbf. A fresh Timestamp cannot be reached by anyone else.
  const now = options.now === undefined ? undefined : Timestamp.postelUnix(options.now.toUnix());
  // Bind every external callable to its original store NOW, before any await, so
  // a hostile store closing over shared `options` cannot swap a method (claim /
  // lookup) between the field capture and its late use to suppress a replay
  // record or bypass an existing revocation.
  const replayClaim: (cid: CID) => Promise<void> = options.replayStore.claim.bind(options.replayStore);
  const revocationLookup: RevocationStore<Ed25519Did>["lookup"] | undefined =
    options.revocationStore === undefined ? undefined : options.revocationStore.lookup.bind(options.revocationStore);

  // Detach a private canonical snapshot BEFORE any await. The public API takes a
  // mutable Invocation whose nonce/maps/arrays are reachable by the caller; if
  // we authenticated that object and then yielded at an await, the caller (or a
  // malicious DelegationStore) could mutate it between the signature check and
  // the CID/replay/revocation steps. `encode()` is synchronous, so this freezes
  // the exact bytes we authenticate; nothing else references `verified`.
  let verified: Invocation<Ed25519Did>;
  try {
    verified = Invocation.decode(invocation.encode());
    verified.verifySignature();
  } catch (error) {
    throw new VerifyError("invalidInvocationSignature", error);
  }

  // spec §FAQ: "The recipient (the aud field DID) is required to check that the
  // field matches their DID." Mandatory, so it cannot be silently skipped.
  if (!verified.audience.equals(executor)) {
    throw new VerifyError("audienceMismatch", { expected: executor, found: verified.audience });
  }

  const payload = verified.payload;
  // Capture the CID we will claim now, from the detached snapshot, so no later
  // mutation can make us claim a different (unsigned) CID.
  const invocationCid = verified.toCid();
  // Capture the requested proof CIDs as immutable STRINGS pre-await. A CID's
  // `multihash.bytes` is a public mutable Uint8Array, so copying the array is
  // not enough: a malicious store could overwrite a handed CID's digest in
  // place to make a substituted (but validly signed) proof's CID compare equal.
  // We compare against these strings and hand the store independently parsed
  // clones, so nothing the store mutates is ever trusted afterwards.
  const requestedStrings = payload.proofs.map((cid) => cid.toString());
  const storeArg = requestedStrings.map((s) => CID.parse(s));

  let fetched: Delegation<Ed25519Did>[];
  try {
    fetched = await delegationStore.getAll(storeArg);
  } catch (error) {
    throw new StoredCheckError("getError", error);
  }

  if (fetched.length !== requestedStrings.length) {
    throw new VerifyError("proofCountMismatch", { requested: requestedStrings.length, returned: fetched.length });
  }

  // Detach each proof into a private snapshot, then check CID + signature on the
  // snapshot, so a store that retains references cannot mutate a proof after the
  // checks (which would change revocation authority or chain semantics).
  const verifiedProofs: Delegation<Ed25519Did>[] = [];
  for (let i = 0; i < requestedStrings.length; i++) {
    let snap: Delegation<Ed25519Did>;
    try {
      snap = Delegation.decode(fetched[i].encode());
    } catch (error) {
      throw new VerifyError("invalidProofSignature", { cid: requestedStrings[i], error });
    }
    if (snap.toCid().toString() !== requestedStrings[i]) {
      throw new VerifyError("proofCidMismatch", { requested: requestedStrings[i], actual: snap.toCid().toString() });
    }
    try {
      snap.verifySignature();
    } catch (error) {
      throw new VerifyError("invalidProofSignature", { cid: requestedStrings[i], error });
    }
    verifiedProofs.push(snap);
  }

  // Run the semantic checks against the detached snapshots, never the store, so
  // a store cannot swap in different delegations after CID/signature checks.
  checkResolved(payload, verifiedProofs, now, leewaySeconds);

  if (revocationLookup !== undefined) {
    // Pass a bound-method facade so checkRevocations calls the original lookup.
    const revocationFacade: RevocationStore<Ed25519Did> = {
      lookup: revocationLookup,
      insert() {
        throw new Error("insert not available during verification");
      },
    };
    await checkRevocations(payload, delegationStore, revocationFacade, verifiedProofs);
  }

  await replayClaim(invocationCid);

  // Return the authenticated snapshot; consumers must act on THIS, not the
  // mutable input they passed.
  return verified;
}
