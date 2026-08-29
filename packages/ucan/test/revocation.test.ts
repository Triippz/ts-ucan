/**
 * Revocation tests.
 */

import { describe, expect, it } from "vitest";
import {
  Command,
  CommandParseError,
  Delegation,
  DelegationBuilder,
  Ed25519Did,
  Ed25519Signer,
  Invocation,
  InvocationBuilder,
  MapDelegationStore,
} from "../src";
import { checkWithRevocations, checkRevocations, MapRevocationStore, REVOKE_COMMAND, revoke, RevokedError } from "../src";
import type { DelegationStore } from "../src";
import { CID } from "multiformats/cid";

function signer(seed: number): Ed25519Signer {
  return new Ed25519Signer(new Uint8Array(32).fill(seed));
}

function specificSubject(did: Ed25519Did) {
  return { kind: "specific", did } as const;
}

describe("Revocation", () => {
  it("command_uses_final_ucan_grammar", () => {
    expect(REVOKE_COMMAND.toString()).toBe("/ucan/revoke");
    expect(REVOKE_COMMAND.equals(Command.parse("/ucan/revoke"))).toBe(true);
    expect(() => Command.parse("ucan/revoke")).toThrow(CommandParseError);
  });

  it("revoke_invocation_roundtrips_with_empty_nonce", () => {
    const alice = signer(1);
    const bob = signer(2);

    const aliceToBob = new DelegationBuilder()
      .issuer(alice)
      .audience(bob.did)
      .subject(specificSubject(alice.did))
      .commandFromStr("/")
      .tryBuild();

    const bobRevocation = revoke(
      new InvocationBuilder()
        .issuer(bob)
        .subject(alice.did)
        .audience(alice.did)
        .proofs([aliceToBob.toCid()]),
      aliceToBob.toCid(),
    );

    const roundTripped = Invocation.decode(bobRevocation.encode());

    expect(roundTripped.command.equals(REVOKE_COMMAND)).toBe(true);
    expect(roundTripped.nonce.toBytes()).toEqual(new Uint8Array());
    expect(roundTripped.arguments.get("revoke")?.toString()).toBe(aliceToBob.toCid().toString());
    expect(roundTripped.proofs.map((cid) => cid.toString())).toEqual([aliceToBob.toCid().toString()]);
  });

  it("check_with_revocations_rejects_revoked_chain", async () => {
    const alice = signer(1);
    const bob = signer(2);
    const carol = signer(3);

    const aliceToBob = new DelegationBuilder()
      .issuer(alice)
      .audience(bob.did)
      .subject(specificSubject(alice.did))
      .commandFromStr("/")
      .tryBuild();

    const bobToCarol = new DelegationBuilder()
      .issuer(bob)
      .audience(carol.did)
      .subject(specificSubject(alice.did))
      .commandFromStr("/")
      .tryBuild();

    const delegationStore = new MapDelegationStore();
    await delegationStore.insertByCid(aliceToBob.toCid(), aliceToBob);
    await delegationStore.insertByCid(bobToCarol.toCid(), bobToCarol);

    const revocationStore = new MapRevocationStore();
    const bobRevocation = revoke(
      new InvocationBuilder()
        .issuer(bob)
        .subject(alice.did)
        .audience(alice.did)
        .proofs([aliceToBob.toCid()]),
      bobToCarol.toCid(),
    );
    await revocationStore.insert(bobToCarol.toCid(), bobRevocation);

    const payload = new InvocationBuilder()
      .issuer(carol)
      .subject(alice.did)
      .audience(alice.did)
      .commandFromStr("/")
      .proofs([aliceToBob.toCid(), bobToCarol.toCid()])
      .build();

    await expect(checkWithRevocations(payload, delegationStore, revocationStore)).rejects.toBeInstanceOf(RevokedError);

    try {
      await checkWithRevocations(payload, delegationStore, revocationStore);
    } catch (error) {
      expect(error).toBeInstanceOf(RevokedError);
      if (error instanceof RevokedError) {
        expect(error.revoked.toString()).toBe(bobToCarol.toCid().toString());
        expect(error.revoker.toString()).toBe(bob.did.toString());
      }
    }
  });

  it("revoker_not_in_proof_chain_does_not_invalidate", async () => {
    // Revocation/README.md §Scope: only a delegator that appears (transitively)
    // in the invocation's proof chain may revoke. Mallory is not in Bob's chain,
    // so her (authenticated) revocation MUST NOT invalidate it.
    const bob = signer(2);
    const carol = signer(3);
    const dave = signer(4);
    const mallory = signer(5);

    const bobRoot = new DelegationBuilder()
      .issuer(bob)
      .audience(carol.did)
      .subject(specificSubject(bob.did))
      .commandFromStr("/")
      .tryBuild();

    const carolToDave = new DelegationBuilder()
      .issuer(carol)
      .audience(dave.did)
      .subject(specificSubject(bob.did))
      .commandFromStr("/")
      .tryBuild();

    const delegationStore = new MapDelegationStore();
    for (const delegation of [bobRoot, carolToDave]) {
      await delegationStore.insertByCid(delegation.toCid(), delegation);
    }

    const revocationStore = new MapRevocationStore();
    // Mallory's revocation is authenticated (signed, correct command/target)
    // but she is not a delegator in the chain, so it must be ignored.
    const malloryRevocation = revoke(
      new InvocationBuilder().issuer(mallory).subject(mallory.did).audience(mallory.did).proofs([]).expiration(null),
      carolToDave.toCid(),
    );
    await revocationStore.insert(carolToDave.toCid(), malloryRevocation);

    const payload = new InvocationBuilder()
      .issuer(dave)
      .subject(bob.did)
      .audience(bob.did)
      .commandFromStr("/")
      .proofs([bobRoot.toCid(), carolToDave.toCid()])
      .expiration(null)
      .build();

    await expect(checkWithRevocations(payload, delegationStore, revocationStore)).resolves.toBeUndefined();
  });

  it("transitive_issuer_revocation_invalidates", async () => {
    // Bob is the root delegator and appears in the chain, so Bob revoking the
    // downstream carol->dave delegation invalidates the invocation.
    const bob = signer(2);
    const carol = signer(3);
    const dave = signer(4);

    const bobRoot = new DelegationBuilder()
      .issuer(bob)
      .audience(carol.did)
      .subject(specificSubject(bob.did))
      .commandFromStr("/")
      .tryBuild();

    const carolToDave = new DelegationBuilder()
      .issuer(carol)
      .audience(dave.did)
      .subject(specificSubject(bob.did))
      .commandFromStr("/")
      .tryBuild();

    const delegationStore = new MapDelegationStore();
    for (const delegation of [bobRoot, carolToDave]) {
      await delegationStore.insertByCid(delegation.toCid(), delegation);
    }

    const revocationStore = new MapRevocationStore();
    const bobRevocation = revoke(
      new InvocationBuilder().issuer(bob).subject(bob.did).audience(bob.did).proofs([]).expiration(null),
      carolToDave.toCid(),
    );
    await revocationStore.insert(carolToDave.toCid(), bobRevocation);

    const payload = new InvocationBuilder()
      .issuer(dave)
      .subject(bob.did)
      .audience(bob.did)
      .commandFromStr("/")
      .proofs([bobRoot.toCid(), carolToDave.toCid()])
      .expiration(null)
      .build();

    await expect(checkWithRevocations(payload, delegationStore, revocationStore)).rejects.toBeInstanceOf(RevokedError);
  });

  it("outsider_revocation_with_missing_path_does_not_deny_valid_chain", async () => {
    // A DoS-poisoning guard: an outsider inserts an authenticated revocation for
    // a victim CID whose `path` references a CID not in the store. Because the
    // path witness is never consulted for invalidation, the direct-issuer check
    // is simply false and the valid chain resolves — no store error, no denial.
    const bob = signer(2);
    const carol = signer(3);
    const dave = signer(4);
    const mallory = signer(5);

    const bobRoot = new DelegationBuilder()
      .issuer(bob)
      .audience(carol.did)
      .subject(specificSubject(bob.did))
      .commandFromStr("/")
      .tryBuild();
    const carolToDave = new DelegationBuilder()
      .issuer(carol)
      .audience(dave.did)
      .subject(specificSubject(bob.did))
      .commandFromStr("/")
      .tryBuild();

    const delegationStore = new MapDelegationStore();
    for (const d of [bobRoot, carolToDave]) {
      await delegationStore.insertByCid(d.toCid(), d);
    }

    // A dangling CID that is NOT in the delegation store.
    const missing = new DelegationBuilder()
      .issuer(mallory)
      .audience(bob.did)
      .subject(specificSubject(mallory.did))
      .commandFromStr("/")
      .tryBuild();

    const revocationStore = new MapRevocationStore();
    const malloryRevocation = revoke(
      new InvocationBuilder().issuer(mallory).subject(mallory.did).audience(mallory.did).proofs([]).expiration(null),
      carolToDave.toCid(),
      [missing.toCid(), carolToDave.toCid()],
    );
    await revocationStore.insert(carolToDave.toCid(), malloryRevocation);

    const payload = new InvocationBuilder()
      .issuer(dave)
      .subject(bob.did)
      .audience(bob.did)
      .commandFromStr("/")
      .proofs([bobRoot.toCid(), carolToDave.toCid()])
      .expiration(null)
      .build();

    await expect(checkWithRevocations(payload, delegationStore, revocationStore)).resolves.toBeUndefined();
  });

  it("downstream_delegate_cannot_revoke_upstream_proof", async () => {
    // Revocation/README.md §Scope + diagram: authority flows ancestor→descendant.
    // In alice(root)→bob→carol→dan→erin, Dan (downstream) revoking alice→bob
    // (an upstream/root proof) MUST NOT invalidate erin's chain. A root/ancestor
    // revoking a downstream proof still does.
    const alice = signer(1);
    const bob = signer(2);
    const carol = signer(3);
    const dan = signer(4);
    const erin = signer(5);
    const sub = alice.did;

    const ab = new DelegationBuilder().issuer(alice).audience(bob.did).subject(specificSubject(sub)).commandFromStr("/").tryBuild();
    const bc = new DelegationBuilder().issuer(bob).audience(carol.did).subject(specificSubject(sub)).commandFromStr("/").tryBuild();
    const cd = new DelegationBuilder().issuer(carol).audience(dan.did).subject(specificSubject(sub)).commandFromStr("/").tryBuild();
    const de = new DelegationBuilder().issuer(dan).audience(erin.did).subject(specificSubject(sub)).commandFromStr("/").tryBuild();

    const delegationStore = new MapDelegationStore();
    for (const d of [ab, bc, cd, de]) await delegationStore.insertByCid(d.toCid(), d);

    const payload = new InvocationBuilder()
      .issuer(erin).subject(sub).audience(sub).commandFromStr("/")
      .proofs([ab.toCid(), bc.toCid(), cd.toCid(), de.toCid()]).expiration(null).build();

    // Dan revokes the upstream alice->bob: no authority, must not invalidate.
    const downstream = new MapRevocationStore();
    await downstream.insert(ab.toCid(), revoke(
      new InvocationBuilder().issuer(dan).subject(dan.did).audience(dan.did).proofs([]).expiration(null), ab.toCid()));
    await expect(checkWithRevocations(payload, delegationStore, downstream)).resolves.toBeUndefined();

    // Alice (root/ancestor) revokes carol->dan: authorized, must invalidate.
    const ancestor = new MapRevocationStore();
    await ancestor.insert(cd.toCid(), revoke(
      new InvocationBuilder().issuer(alice).subject(alice.did).audience(alice.did).proofs([]).expiration(null), cd.toCid()));
    await expect(checkWithRevocations(payload, delegationStore, ancestor)).rejects.toBeInstanceOf(RevokedError);
  });

  it("generic_checkRevocations_resists_getAll_cid_mutation_and_lookup_swap", async () => {
    // In the semantic-only generic path (no resolvedProofs), a hostile
    // delegationStore.getAll mutates the handed proof CID digest AND swaps
    // revocationStore.lookup mid-flight. checkRevocations binds lookup and
    // passes CID clones before the await, so the genuine revocation still fires.
    const bob = signer(2);
    const carol = signer(3);
    const dave = signer(4);

    const bobRoot = new DelegationBuilder().issuer(bob).audience(carol.did).subject(specificSubject(bob.did)).commandFromStr("/").tryBuild();
    const carolToDave = new DelegationBuilder().issuer(carol).audience(dave.did).subject(specificSubject(bob.did)).commandFromStr("/").tryBuild();

    const revocations = new MapRevocationStore();
    await revocations.insert(carolToDave.toCid(), revoke(
      new InvocationBuilder().issuer(bob).subject(bob.did).audience(bob.did).proofs([]), carolToDave.toCid()));

    const payload = new InvocationBuilder()
      .issuer(dave).subject(bob.did).audience(bob.did).commandFromStr("/")
      .proofs([bobRoot.toCid(), carolToDave.toCid()]).expiration(null).build();

    // Hostile array whose own `map` returns [] AND whose `length` get-trap
    // returns 0 (Proxy), which would suppress every ancestor set if trusted.
    class EvilArray<T> extends Array<T> {
      map<U>(): U[] {
        return [] as U[];
      }
    }

    const evil: DelegationStore = {
      async getAll(cids: CID[]) {
        // Mutate the handed target CID digest, swap the revocation lookup, and
        // return a hostile array (map()→[]) wrapped in a Proxy whose length
        // trap returns 0. checkRevocations iterates the TRUSTED CID count and
        // never reads fetched.length/.map, so the genuine revocation fires.
        cids[1].multihash.bytes.set(bobRoot.toCid().multihash.bytes);
        (revocations as unknown as { lookup: () => Promise<never[]> }).lookup = async () => [];
        const arr = new EvilArray<Delegation>();
        arr.push(bobRoot as Delegation, carolToDave as Delegation);
        return new Proxy(arr, {
          get(target, prop, recv) {
            if (prop === "length") return 0;
            return Reflect.get(target, prop, recv);
          },
        });
      },
      async insertByCid() {},
    };

    await expect(checkRevocations(payload, evil, revocations)).rejects.toBeInstanceOf(RevokedError);
  });

  it("store_is_append_only", async () => {
    const store = new MapRevocationStore();
    expect("delete" in store).toBe(false);
    expect((store as unknown as { delete?: unknown }).delete).toBeUndefined();
  });

  it("store_returns_immutable_snapshots_not_live_aliases", async () => {
    // Revocation/README.md §Semantics: revocations are immutable and the store
    // is monotonically growing. Mutating a looked-up result must not retract or
    // alter the stored record.
    const bob = signer(2);
    const carol = signer(3);
    const dave = signer(4);

    const bobRoot = new DelegationBuilder()
      .issuer(bob).audience(carol.did).subject(specificSubject(bob.did)).commandFromStr("/").tryBuild();
    const carolToDave = new DelegationBuilder()
      .issuer(carol).audience(dave.did).subject(specificSubject(bob.did)).commandFromStr("/").tryBuild();

    const delegationStore = new MapDelegationStore();
    for (const d of [bobRoot, carolToDave]) await delegationStore.insertByCid(d.toCid(), d);

    const revocationStore = new MapRevocationStore();
    const bobRevocation = revoke(
      new InvocationBuilder().issuer(bob).subject(bob.did).audience(bob.did).proofs([]).expiration(null),
      carolToDave.toCid(),
    );
    await revocationStore.insert(carolToDave.toCid(), bobRevocation);

    // Attempt retraction via the returned array and via the Invocation object.
    const looked = await revocationStore.lookup(carolToDave.toCid());
    expect(looked.length).toBe(1);
    looked.length = 0;
    const again = await revocationStore.lookup(carolToDave.toCid());
    expect(again.length).toBe(1);

    const payload = new InvocationBuilder()
      .issuer(dave).subject(bob.did).audience(bob.did).commandFromStr("/")
      .proofs([bobRoot.toCid(), carolToDave.toCid()]).expiration(null).build();
    await expect(checkWithRevocations(payload, delegationStore, revocationStore)).rejects.toBeInstanceOf(RevokedError);
  });
});
