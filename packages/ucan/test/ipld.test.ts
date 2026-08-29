/**
 * IPLD conversion tests — focus on prototype-member map keys.
 */

import { describe, it, expect } from "vitest";
import {
  ipldFromDagCbor,
  ipldToDagCbor,
  Ed25519Signer,
  InvocationBuilder,
  Invocation,
} from "../src";
import type { Ipld } from "../src/index.js";

describe("IPLD map-key handling", () => {
  it("does_not_pollute_Object_prototype_and_uses_Map", () => {
    // A "__proto__" argument key must not touch Object.prototype and must be
    // held as an ordinary Map key on decode.
    const m = new Map<string, Ipld>([
      ["__proto__", new Map<string, Ipld>([["admin", true]])],
      ["constructor", 5n],
      ["ok", 1n],
    ]);
    const back = ipldFromDagCbor(ipldToDagCbor(m));
    expect(back instanceof Map).toBe(true);
    // No prototype pollution occurred.
    expect(({} as Record<string, unknown>).admin).toBeUndefined();
    // Non-prototype keys always round-trip (dag-cbor decodes small ints as number).
    if (back instanceof Map) {
      expect(Number(back.get("ok"))).toBe(1);
      expect(Number(back.get("constructor"))).toBe(5);
    }
  });

  it("invocation_with_proto_arg_key_is_rejected_fail_closed_at_decode", () => {
    // @ipld/dag-cbor cannot round-trip a "__proto__" map key. Rather than
    // silently dropping it (desyncing the signed bytes), decode's canonical
    // check rejects such a token. Fail-closed, no bypass.
    const s = new Ed25519Signer(new Uint8Array(32).fill(9));
    const args = new Map<string, Ipld>([["__proto__", 1n], ["ok", 2n]]);
    const inv = new InvocationBuilder()
      .issuer(s).subject(s.did).audience(s.did).commandFromStr("/x").proofs([]).arguments(args).tryBuild();
    expect(() => Invocation.decode(inv.encode())).toThrow(/not canonically encoded/);
  });
});
