import { describe, it, expect } from "vitest";
import type { Ipld } from "../src/index.js";
import { Select, SelectorError } from "../src";
import { selectIpld } from "../src/delegation/policy";

/**
 * Property tests from Rust that are not ported:
 * - test_identity (n/a — property test)
 * - test_try_missing_is_null (n/a — property test)
 * - test_try_missing_plus_trailing_is_null (n/a — property test)
 */

describe("Select", () => {
  // Deterministic tests from the Rust test suite

  it("testSliceList", () => {
    const data: Ipld = [10, 20, 30, 40];
    const selector = Select.fromString(".[1:3]", selectIpld);
    const result = selector.get(data);
    expect(result).toEqual([20, 30]);
  });

  it("testSliceListOpenEnd", () => {
    const data: Ipld = [10, 20, 30];
    const selector = Select.fromString(".[1:]", selectIpld);
    const result = selector.get(data);
    expect(result).toEqual([20, 30]);
  });

  it("testSliceListOpenStart", () => {
    const data: Ipld = [10, 20, 30];
    const selector = Select.fromString(".[:2]", selectIpld);
    const result = selector.get(data);
    expect(result).toEqual([10, 20]);
  });

  it("testSliceNegativeEnd", () => {
    const data: Ipld = [10, 20, 30];
    const selector = Select.fromString(".[0:-1]", selectIpld);
    const result = selector.get(data);
    expect(result).toEqual([10, 20]);
  });

  it("testByteIndex", () => {
    const data: Ipld = new Uint8Array([0xd6, 0xa9, 0xc1, 0x8c, 0xf8, 0xc4]);
    const selector = Select.fromString(".[3]", selectIpld);
    const result = selector.get(data);
    expect(result).toEqual(BigInt(0x8c));
  });

  it("testByteSlice", () => {
    const data: Ipld = new Uint8Array([0xd6, 0xa9, 0xc1, 0x8c, 0xf8, 0xc4]);
    const selector = Select.fromString(".[1:3]", selectIpld);
    const result = selector.get(data);
    expect(result).toEqual(new Uint8Array([0xa9, 0xc1]));
  });

  it("testSliceBothNegative", () => {
    const data: Ipld = [10, 20, 30, 40, 50];
    const selector = Select.fromString(".[-3:-1]", selectIpld);
    const result = selector.get(data);
    expect(result).toEqual([30, 40]);
  });

  it("testSliceNegativeStartOpenEnd", () => {
    const data: Ipld = [10, 20, 30];
    const selector = Select.fromString(".[-2:]", selectIpld);
    const result = selector.get(data);
    expect(result).toEqual([20, 30]);
  });

  it("testSliceFullCopy", () => {
    const data: Ipld = [10, 20];
    const selector = Select.fromString(".[:]" , selectIpld);
    const result = selector.get(data);
    expect(result).toEqual(data);
  });

  it("testSliceEmptyWhenStartGeEnd", () => {
    const data: Ipld = [10, 20, 30];
    const selector = Select.fromString(".[2:1]", selectIpld);
    const result = selector.get(data);
    expect(result).toEqual([]);
  });

  it("testSliceOutOfBoundsClamps", () => {
    const data: Ipld = [10, 20];
    const selector = Select.fromString(".[0:100]", selectIpld);
    const result = selector.get(data);
    expect(result).toEqual(data);
  });

  it("testByteNegativeIndex", () => {
    const data: Ipld = new Uint8Array([0xaa, 0xbb, 0xcc]);
    const selector = Select.fromString(".[-1]", selectIpld);
    const result = selector.get(data);
    expect(result).toEqual(BigInt(0xcc));
  });

  it("testByteSliceNegative", () => {
    const data: Ipld = new Uint8Array([0xaa, 0xbb, 0xcc, 0xdd]);
    const selector = Select.fromString(".[-2:]", selectIpld);
    const result = selector.get(data);
    expect(result).toEqual(new Uint8Array([0xcc, 0xdd]));
  });

  it("testByteIndexOutOfBoundsWithTry", () => {
    const data: Ipld = new Uint8Array([0xaa, 0xbb]);
    const selector = Select.fromString(".[99]?", selectIpld);
    const result = selector.get(data);
    expect(result).toBeNull();
  });

  it("testSliceOnNonListFails", () => {
    const data: Ipld = 42;
    const selector = Select.fromString(".[0:2]", selectIpld);
    expect(() => selector.get(data)).toThrow();
  });

  it("testSliceOnNonListWithTryReturnsNull", () => {
    const data: Ipld = 42;
    const selector = Select.fromString(".[0:2]?", selectIpld);
    const result = selector.get(data);
    expect(result).toBeNull();
  });

  it("testByteIndexSpecExample", () => {
    // From the spec: bytes 0xd6a9c18cf8c4, selector .[3] => 0x8c = 140
    const data: Ipld = new Uint8Array([0xd6, 0xa9, 0xc1, 0x8c, 0xf8, 0xc4]);
    const selector = Select.fromString(".[3]", selectIpld);
    const result = selector.get(data);
    expect(result).toEqual(BigInt(140));
  });

  // Original tests that were already in the file (kept for backward compatibility)

  it("test_identity", () => {
    const data = new Map<string, any>([
      ["answer", 42],
      ["nested", new Map([["ok", true]])],
    ]);
    const selector = Select.fromString(".", selectIpld);
    expect(selector.get(data)).toEqual(data);
  });

  it("test_try_missing_is_null", () => {
    const selector = Select.fromString(".foo?", selectIpld);
    expect(selector.get(new Map())).toBeNull();
  });

  it("test_try_missing_plus_trailing_is_null", () => {
    const selector = Select.fromString(".foo?.bar.baz?", selectIpld);
    expect(selector.get(new Map([["baz", 42]]))).toBeNull();
  });

  it("optional_that_HITS_does_not_swallow_a_later_required_miss", () => {
    // spec :619/:649 — `.account?` present, `.owner` (required) missing MUST
    // fail the predicate, not resolve to null. An optional only null-swallows
    // when it itself misses; a hit must not broaden `== null` policies.
    const selector = Select.fromString(".account?.owner", selectIpld);
    expect(() => selector.get(new Map([["account", new Map()]]))).toThrow(SelectorError);
  });
});
