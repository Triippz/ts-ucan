/**
 * Delegation conformance tests.
 *
 * Ported from ucan/tests/delegation_conformance.rs
 */

import { describe, it, expect } from "vitest";
import { Delegation } from "../src/delegation/index.js";
import delegationFixture from "./fixtures/delegation.json" assert { type: "json" };
import { ipldFromDagCbor } from "../src/ipld.js";

function base64ToBytes(b64: string): Uint8Array {
  const binaryString = atob(b64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

describe("Delegation Conformance", () => {
  it("test_expected_version", () => {
    expect(delegationFixture.version).toBe("1.0.0-rc.1");
  });

  it("test_top_level_parse", () => {
    const validDelegations = (delegationFixture as any).valid;
    expect(validDelegations).toBeDefined();
    expect(validDelegations.length).toBeGreaterThan(0);

    const first = validDelegations[0];
    const b64Token = first.token;
    expect(b64Token).toBeDefined();

    // Decode base64 to bytes
    const uint8Bytes = base64ToBytes(b64Token);

    // Parse as Delegation (decode expects DAG-CBOR bytes)
    const delegation = Delegation.decode(uint8Bytes);

    // Verify fields
    expect(delegation.policy).toBeDefined();
    expect(delegation.policy.length).toBe(0);
  });
});
