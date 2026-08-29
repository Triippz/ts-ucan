/**
 * Revocation tests.
 */

import { describe, expect, it } from "vitest";
import {
  Command,
  CommandParseError,
  DelegationBuilder,
  Ed25519Did,
  Ed25519Signer,
  Invocation,
  InvocationBuilder,
  MapDelegationStore,
} from "../src/index.js";
import { checkWithRevocations, MapRevocationStore, REVOKE_COMMAND, revoke, RevokedError } from "../src/revocation/index.js";

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
    expect(roundTripped.arguments.get("revoke")?.kind).toBe("link");
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

  it("unrelated_revoker_does_not_invalidate_and_alternate_chain_passes", async () => {
    const alice = signer(1);
    const bob = signer(2);
    const carol = signer(3);
    const dave = signer(4);
    const mallory = signer(5);

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

    const bobToDave = new DelegationBuilder()
      .issuer(bob)
      .audience(dave.did)
      .subject(specificSubject(alice.did))
      .commandFromStr("/")
      .tryBuild();

    const daveToCarol = new DelegationBuilder()
      .issuer(dave)
      .audience(carol.did)
      .subject(specificSubject(alice.did))
      .commandFromStr("/")
      .tryBuild();

    const delegationStore = new MapDelegationStore();
    for (const delegation of [aliceToBob, bobToCarol, bobToDave, daveToCarol]) {
      await delegationStore.insertByCid(delegation.toCid(), delegation);
    }

    const revocationStore = new MapRevocationStore();
    const malloryRevocation = revoke(
      new InvocationBuilder()
        .issuer(mallory)
        .subject(mallory.did)
        .audience(mallory.did)
        .proofs([]),
      bobToCarol.toCid(),
    );
    await revocationStore.insert(bobToCarol.toCid(), malloryRevocation);

    const directPayload = new InvocationBuilder()
      .issuer(carol)
      .subject(alice.did)
      .audience(alice.did)
      .commandFromStr("/")
      .proofs([aliceToBob.toCid(), bobToCarol.toCid()])
      .build();

    await expect(checkWithRevocations(directPayload, delegationStore, revocationStore)).resolves.toBeUndefined();

    const alternatePayload = new InvocationBuilder()
      .issuer(carol)
      .subject(alice.did)
      .audience(alice.did)
      .commandFromStr("/")
      .proofs([aliceToBob.toCid(), bobToDave.toCid(), daveToCarol.toCid()])
      .build();

    await expect(checkWithRevocations(alternatePayload, delegationStore, revocationStore)).resolves.toBeUndefined();
  });

  it("store_is_append_only", async () => {
    const store = new MapRevocationStore();
    expect("delete" in store).toBe(false);
    expect((store as unknown as { delete?: unknown }).delete).toBeUndefined();
  });
});
