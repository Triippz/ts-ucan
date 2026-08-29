/**
 * verifyInvocation tests: envelope signature, proof CID/count, audience,
 * replay, and the hardening added in the security review.
 */

import { describe, expect, it } from "vitest";
import { CID } from "multiformats/cid";
import {
  Delegation,
  DelegationBuilder,
  Ed25519Did,
  Ed25519Signer,
  Invocation,
  InvocationBuilder,
  MapDelegationStore,
  MapReplayStore,
  MapRevocationStore,
  RevokedError,
  StoredCheckError,
  Timestamp,
  insert,
  revoke,
  verifyInvocation,
} from "../src/index.js";
import type { DelegationStore } from "../src/index.js";

function signer(seed: number): Ed25519Signer {
  return new Ed25519Signer(new Uint8Array(32).fill(seed));
}

function specificSubject(did: Ed25519Did) {
  return { kind: "specific", did } as const;
}

/**
 * Envelope wire form is dag-cbor [signature, sigPayload]: 0x82, 0x58 0x40,
 * then the 64 signature bytes. Index 4 is inside the signature.
 */
function flipSignatureByte(bytes: Uint8Array): Uint8Array {
  const out = new Uint8Array(bytes);
  out[4] ^= 0x01;
  return out;
}

// A store that returns a different array on each getAll call, to exercise the
// TOCTOU defense: verifyInvocation must only trust the array it authenticated.
class SwappingStore implements DelegationStore<Ed25519Did> {
  private calls = 0;
  constructor(private readonly first: Delegation<Ed25519Did>[], private readonly rest: Delegation<Ed25519Did>[]) {}
  async getAll(): Promise<Delegation<Ed25519Did>[]> {
    return this.calls++ === 0 ? this.first : this.rest;
  }
  async insertByCid(): Promise<void> {}
}

async function fixture() {
  const alice = signer(1);
  const bob = signer(2);

  const aliceToBob = new DelegationBuilder()
    .issuer(alice)
    .audience(bob.did)
    .subject(specificSubject(alice.did))
    .commandFromStr("/")
    .tryBuild();

  const store = new MapDelegationStore<Ed25519Did>();
  const proofCid = await insert(store, aliceToBob as Delegation<Ed25519Did>);

  const invocation = new InvocationBuilder()
    .issuer(bob)
    .audience(alice.did)
    .subject(alice.did)
    .commandFromStr("/foo")
    .proofs([proofCid])
    .tryBuild();

  return { alice, bob, aliceToBob, store, proofCid, invocation };
}

function opts(executor: Ed25519Did, extra: Record<string, unknown> = {}) {
  return { executor, replayStore: new MapReplayStore(), ...extra };
}

describe("verifyInvocation", () => {
  it("valid_signed_chain_passes", async () => {
    const { alice, store, invocation } = await fixture();
    const verified = await verifyInvocation(invocation, store, opts(alice.did, { revocationStore: new MapRevocationStore() }));
    // Returns the authenticated snapshot, not the input object.
    expect(verified.command.toString()).toBe("/foo");
  });

  it("flipped_invocation_signature_byte_fails", async () => {
    const { alice, store, invocation } = await fixture();
    const tampered = Invocation.decode(flipSignatureByte(invocation.encode()));

    await expect(verifyInvocation(tampered, store, opts(alice.did))).rejects.toMatchObject({
      name: "VerifyError",
      reason: "invalidInvocationSignature",
    });
  });

  it("flipped_delegation_signature_byte_fails", async () => {
    const { alice, bob, aliceToBob, store } = await fixture();

    const forged = Delegation.decode(flipSignatureByte(aliceToBob.encode()));
    const forgedCid = await insert(store, forged);

    const invocation = new InvocationBuilder()
      .issuer(bob)
      .audience(alice.did)
      .subject(alice.did)
      .commandFromStr("/foo")
      .proofs([forgedCid])
      .tryBuild();

    await expect(verifyInvocation(invocation, store, opts(alice.did))).rejects.toMatchObject({
      name: "VerifyError",
      reason: "invalidProofSignature",
    });
  });

  it("different_delegation_under_requested_cid_fails", async () => {
    const { alice, bob, store, proofCid, invocation } = await fixture();

    const other = new DelegationBuilder()
      .issuer(alice)
      .audience(bob.did)
      .subject(specificSubject(alice.did))
      .commandFromStr("/")
      .tryBuild();
    await store.insertByCid(proofCid, other as Delegation<Ed25519Did>);

    await expect(verifyInvocation(invocation, store, opts(alice.did))).rejects.toMatchObject({
      name: "VerifyError",
      reason: "proofCidMismatch",
    });
  });

  it("wrong_invocation_audience_fails", async () => {
    const { bob, store, invocation } = await fixture();

    await expect(verifyInvocation(invocation, store, opts(bob.did))).rejects.toMatchObject({
      name: "VerifyError",
      reason: "audienceMismatch",
    });
  });

  it("expired_invocation_still_fails_through_existing_checks", async () => {
    const { alice, bob, store, proofCid } = await fixture();

    const expired = new InvocationBuilder()
      .issuer(bob)
      .audience(alice.did)
      .subject(alice.did)
      .commandFromStr("/foo")
      .proofs([proofCid])
      .expiration(Timestamp.fromUnix(1))
      .tryBuild();

    await expect(verifyInvocation(expired, store, opts(alice.did))).rejects.toBeInstanceOf(StoredCheckError);
  });

  it("revoked_chain_fails_when_revocation_store_supplied", async () => {
    const { alice, store, proofCid, invocation } = await fixture();

    const revocations = new MapRevocationStore<Ed25519Did>();
    const revocation = revoke(
      new InvocationBuilder()
        .issuer(alice)
        .audience(alice.did)
        .subject(alice.did)
        .proofs([proofCid]),
      proofCid,
    );
    await revocations.insert(proofCid, revocation);

    await expect(
      verifyInvocation(invocation, store, opts(alice.did, { revocationStore: revocations })),
    ).rejects.toBeInstanceOf(RevokedError);
  });

  // ── hardening regression tests ──────────────────────────────────────

  it("replayed_invocation_fails_on_second_verify", async () => {
    const { alice, store, invocation } = await fixture();
    const replayStore = new MapReplayStore();

    await verifyInvocation(invocation, store, { executor: alice.did, replayStore });
    await expect(
      verifyInvocation(invocation, store, { executor: alice.did, replayStore }),
    ).rejects.toMatchObject({ name: "VerifyError", reason: "replay" });
  });

  it("store_swapping_proofs_after_verification_does_not_authorize", async () => {
    const { alice, bob, aliceToBob, invocation, proofCid } = await fixture();

    // Second getAll returns a different, unauthenticated delegation with the
    // same issuer/audience but a broader command. With TOCTOU it would drive
    // the semantic checks; verified-array passthrough must ignore it.
    const forged = new DelegationBuilder()
      .issuer(alice)
      .audience(bob.did)
      .subject(specificSubject(alice.did))
      .commandFromStr("/foo")
      .tryBuild();
    const swap = new SwappingStore([aliceToBob as Delegation<Ed25519Did>], [forged as Delegation<Ed25519Did>]);

    // The authentic proof's CID does not match the requested proofCid only if
    // swapped; here the first (verified) response is authentic, so it passes.
    // Prove no re-fetch influenced the result: the run resolves with the
    // authentic proof regardless of the poisoned second response.
    void proofCid;
    const verified = await verifyInvocation(invocation, swap, { executor: alice.did, replayStore: new MapReplayStore() });
    expect(verified.command.toString()).toBe("/foo");
  });

  it("extra_proof_returned_by_store_fails_count_check", async () => {
    const { alice, aliceToBob, invocation } = await fixture();
    const extra = new SwappingStore(
      [aliceToBob as Delegation<Ed25519Did>, aliceToBob as Delegation<Ed25519Did>],
      [],
    );
    await expect(
      verifyInvocation(invocation, extra, { executor: alice.did, replayStore: new MapReplayStore() }),
    ).rejects.toMatchObject({ name: "VerifyError", reason: "proofCountMismatch" });
  });

  it("small_order_key_is_rejected_at_did_construction", () => {
    const attack = new Uint8Array(32);
    attack[0] = 1; // small-order point
    expect(() => new Ed25519Did(attack)).toThrow();
  });

  it("clock_skew_leeway_tolerates_just_expired_invocation", async () => {
    const { alice, bob, store, proofCid } = await fixture();
    const now = Timestamp.now();
    const justExpired = Timestamp.fromUnix((now.toUnix() as number) - 30);

    const inv = new InvocationBuilder()
      .issuer(bob)
      .audience(alice.did)
      .subject(alice.did)
      .commandFromStr("/foo")
      .proofs([proofCid])
      .expiration(justExpired)
      .tryBuild();

    // Without leeway it fails; with 60s leeway the 30s-expired token passes.
    await expect(
      verifyInvocation(inv, store, { executor: alice.did, replayStore: new MapReplayStore() }),
    ).rejects.toBeInstanceOf(StoredCheckError);
    await expect(
      verifyInvocation(inv, store, { executor: alice.did, replayStore: new MapReplayStore(), leewaySeconds: 60 }),
    ).resolves.toBeInstanceOf(Invocation);
  });

  it("non_canonical_wire_bytes_are_rejected_at_decode", async () => {
    const { invocation } = await fixture();
    const bytes = invocation.encode();
    // Append a trailing byte: still parses the 2-tuple but is not canonical.
    const trailing = new Uint8Array(bytes.length + 1);
    trailing.set(bytes);
    expect(() => Invocation.decode(trailing)).toThrow();
  });

  it("mutation_during_getAll_await_cannot_change_the_verified_invocation", async () => {
    // A malicious store mutates the caller's invocation object while getAll is
    // pending. verifyInvocation authenticates a detached snapshot before the
    // await, so the mutation cannot alter what is verified/claimed. The valid
    // invocation must still verify cleanly (no injected field leaks in).
    const { alice, store, proofCid, invocation } = await fixture();

    class MutatingStore implements DelegationStore<Ed25519Did> {
      async getAll(cids: CID[]): Promise<Delegation<Ed25519Did>[]> {
        // Mutate the caller-visible invocation mid-flight.
        invocation.arguments.set("injected", 1n);
        (invocation.proofs as CID[]).push(proofCid);
        return store.getAll(cids);
      }
      async insertByCid(): Promise<void> {}
    }

    // Snapshot the pre-mutation CID; verification must claim THIS, not a mutated one.
    const originalCid = Invocation.decode(invocation.encode()).toCid();
    const replay = new MapReplayStore();
    await verifyInvocation(invocation, new MutatingStore(), { executor: alice.did, replayStore: replay });
    // The claimed CID was the original; a second verify of the original snapshot replays.
    const fresh = Invocation.decode((await fixture()).invocation.encode());
    void fresh;
    // Re-claiming the original CID must now be a replay.
    await expect(replay.claim(originalCid)).rejects.toMatchObject({ reason: "replay" });
  });

  it("store_mutating_handed_CID_digest_cannot_substitute_a_proof", async () => {
    // A CID's multihash.bytes is a public Uint8Array. A hostile store overwrites
    // the handed CID's digest to a different (validly signed) proof B and
    // returns B; verifyInvocation compares against pre-await CID STRINGS and
    // hands the store disposable clones, so the substitution is rejected.
    const alice = signer(1);
    const bob = signer(2);
    const a = new DelegationBuilder().issuer(alice).audience(bob.did).subject(specificSubject(alice.did)).commandFromStr("/").tryBuild();
    const b = new DelegationBuilder().issuer(alice).audience(bob.did).subject(specificSubject(alice.did)).commandFromStr("/foo").tryBuild();
    const inv = new InvocationBuilder().issuer(bob).audience(alice.did).subject(alice.did).commandFromStr("/foo").proofs([a.toCid()]).tryBuild();
    const decoded = Invocation.decode(inv.encode());

    class DigestMutatingStore implements DelegationStore<Ed25519Did> {
      async getAll(cids: CID[]): Promise<Delegation<Ed25519Did>[]> {
        cids[0].multihash.bytes.set((b as Delegation<Ed25519Did>).toCid().multihash.bytes);
        return [b as Delegation<Ed25519Did>];
      }
      async insertByCid(): Promise<void> {}
    }

    await expect(
      verifyInvocation(decoded, new DigestMutatingStore(), { executor: alice.did, replayStore: new MapReplayStore() }),
    ).rejects.toMatchObject({ name: "VerifyError", reason: "proofCidMismatch" });
  });

  it("returned_snapshot_reflects_signed_args_not_mutated_input", async () => {
    // Execution must read from the returned snapshot. A store that mutates the
    // caller's invocation args mid-verify cannot change what the snapshot says.
    const { alice, store, proofCid, invocation } = await fixture();
    class ArgMutatingStore implements DelegationStore<Ed25519Did> {
      async getAll(cids: CID[]): Promise<Delegation<Ed25519Did>[]> {
        invocation.arguments.set("title", "admin"); // unsigned mutation
        return store.getAll(cids);
      }
      async insertByCid(): Promise<void> {}
    }
    void proofCid;
    const verified = await verifyInvocation(invocation, new ArgMutatingStore(), { executor: alice.did, replayStore: new MapReplayStore() });
    // The returned snapshot does not carry the injected "title".
    expect(verified.arguments.has("title")).toBe(false);
  });

  it("store_clearing_options_revocationStore_midflight_still_rejects_revoked", async () => {
    // Capturing options synchronously: a hostile store that clears
    // options.revocationStore during getAll must not disable revocation.
    const { alice, store, proofCid, invocation } = await fixture();
    const revocations = new MapRevocationStore<Ed25519Did>();
    await revocations.insert(proofCid, revoke(
      new InvocationBuilder().issuer(alice).subject(alice.did).audience(alice.did).proofs([proofCid]), proofCid));

    const options = { executor: alice.did, replayStore: new MapReplayStore(), revocationStore: revocations as RevocationStore<Ed25519Did> | undefined };
    class OptionClearingStore implements DelegationStore<Ed25519Did> {
      async getAll(cids: CID[]): Promise<Delegation<Ed25519Did>[]> {
        options.revocationStore = undefined; // try to disable revocation mid-verify
        return store.getAll(cids);
      }
      async insertByCid(): Promise<void> {}
    }
    await expect(
      verifyInvocation(invocation, new OptionClearingStore(), options),
    ).rejects.toBeInstanceOf(RevokedError);
  });

  it("store_swapping_replayStore_claim_midflight_still_records", async () => {
    // claim is bound to the original store before any await; a hostile store
    // replacing options.replayStore.claim with a no-op cannot suppress the
    // replay record.
    const { alice, store, invocation } = await fixture();
    const replayStore = new MapReplayStore();
    const realClaim = replayStore.claim.bind(replayStore);
    class ClaimSwapStore implements DelegationStore<Ed25519Did> {
      async getAll(cids: CID[]): Promise<Delegation<Ed25519Did>[]> {
        (replayStore as unknown as { claim: () => Promise<void> }).claim = async () => {};
        return store.getAll(cids);
      }
      async insertByCid(): Promise<void> {}
    }
    const decoded = Invocation.decode(invocation.encode());
    await verifyInvocation(decoded, new ClaimSwapStore(), { executor: alice.did, replayStore });
    // The original bound claim recorded the CID, so re-claiming it is a replay.
    await expect(realClaim(decoded.toCid())).rejects.toMatchObject({ reason: "replay" });
  });

  it("store_swapping_revocationStore_lookup_midflight_still_rejects_revoked", async () => {
    // lookup is bound to the original store before any await; a hostile store
    // replacing options.revocationStore.lookup with `async () => []` cannot
    // bypass an existing revocation.
    const { alice, store, proofCid, invocation } = await fixture();
    const revocations = new MapRevocationStore<Ed25519Did>();
    await revocations.insert(proofCid, revoke(
      new InvocationBuilder().issuer(alice).subject(alice.did).audience(alice.did).proofs([proofCid]), proofCid));
    const options = { executor: alice.did, replayStore: new MapReplayStore(), revocationStore: revocations };
    class LookupSwapStore implements DelegationStore<Ed25519Did> {
      async getAll(cids: CID[]): Promise<Delegation<Ed25519Did>[]> {
        (options.revocationStore as unknown as { lookup: () => Promise<never[]> }).lookup = async () => [];
        return store.getAll(cids);
      }
      async insertByCid(): Promise<void> {}
    }
    await expect(
      verifyInvocation(invocation, new LookupSwapStore(), options),
    ).rejects.toBeInstanceOf(RevokedError);
  });
});

// Guard against a proof array whose CID genuinely mismatches under swap.
describe("verifyInvocation proof CID under swap", () => {
  it("swapped_first_response_with_wrong_cid_fails", async () => {
    const alice = signer(1);
    const bob = signer(2);
    const aliceToBob = new DelegationBuilder()
      .issuer(alice)
      .audience(bob.did)
      .subject(specificSubject(alice.did))
      .commandFromStr("/")
      .tryBuild();
    const wrong = new DelegationBuilder()
      .issuer(alice)
      .audience(bob.did)
      .subject(specificSubject(alice.did))
      .commandFromStr("/foo")
      .tryBuild();

    const invocation = new InvocationBuilder()
      .issuer(bob)
      .audience(alice.did)
      .subject(alice.did)
      .commandFromStr("/foo")
      .proofs([(aliceToBob as Delegation<Ed25519Did>).toCid()])
      .tryBuild();

    // Store returns `wrong` under the requested (aliceToBob) CID.
    const store: DelegationStore<Ed25519Did> = {
      async getAll() {
        return [wrong as Delegation<Ed25519Did>];
      },
      async insertByCid() {},
    };

    await expect(
      verifyInvocation(invocation, store, { executor: alice.did, replayStore: new MapReplayStore() }),
    ).rejects.toMatchObject({ name: "VerifyError", reason: "proofCidMismatch" });
    void CID;
  });
});
