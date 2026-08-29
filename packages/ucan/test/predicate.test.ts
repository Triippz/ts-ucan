import { describe, it, expect } from "vitest";
import {
  glob,
  ipldToPredicate,
  predicateToIpld,
  runPredicate,
  RunError,
  ipldToDagCbor,
  ipldFromDagCbor,
} from "../src/index.js";
import type { Ipld } from "../src/index.js";

// ══════════════════════════════════════════════════════════════════════════
// Helpers — ported from Rust test helper functions
// ══════════════════════════════════════════════════════════════════════════

function simple(): Ipld {
  return new Map<string, Ipld>([
    ["foo", 42],
    ["bar", "baz"],
    ["qux", true],
  ]);
}

function email(): Ipld {
  return new Map<string, Ipld>([
    ["from", "alice@example.com"],
    ["to", ["bob@example.com", "fraud@example.com"]],
    ["cc", ["carol@example.com"]],
    ["subject", "Quarterly Reports"],
    ["body", "Here's Q2 the reports ..."],
  ]);
}

function wasm(): Ipld {
  return new Map<string, Ipld>([
    ["mod", "data:application/wasm;base64,ANYBASE64GOESHERE"],
    ["fun", "test"],
    ["input", [0, 1, 2, 3]],
  ]);
}


describe("Predicate", () => {
  it("test_eq", () => {
    const pred = ipldToPredicate(["==", ".foo", 42]);
    const data = new Map<string, any>([["foo", 42]]);
    expect(runPredicate(pred, data)).toBe(true);
    expect(predicateToIpld(pred)).toEqual(["==", ".foo", 42]);
  });

  it("test_gt", () => {
    const pred = ipldToPredicate([">", ".foo", 10]);
    const data = new Map<string, any>([["foo", 11]]);
    expect(runPredicate(pred, data)).toBe(true);
  });

  it("test_like", () => {
    const pred = ipldToPredicate(["like", ".foo", "h*o"]);
    const data = new Map<string, any>([["foo", "hello"]]);
    expect(runPredicate(pred, data)).toBe(true);
  });

  it("test_not", () => {
    const pred = ipldToPredicate(["!=" , ".foo", 1]);
    const data = new Map<string, any>([["foo", 2]]);
    expect(runPredicate(pred, data)).toBe(true);
  });

  it("test_and_both_succeed", () => {
    const pred = ipldToPredicate(["and", [["==", ".foo", 1], ["like", ".bar", "b*"]]]);
    const data = new Map<string, any>([["foo", 1], ["bar", "baz"]]);
    expect(runPredicate(pred, data)).toBe(true);
  });

  it("test_or_both_fail", () => {
    const pred = ipldToPredicate(["or", [["==", ".foo", 1], ["==", ".bar", 2]]]);
    const data = new Map<string, any>([["foo", 0], ["bar", 0]]);
    expect(runPredicate(pred, data)).toBe(false);
  });

  // ══════════════════════════════════════════════════════════════════════
  // glob module — 16 tests
  // ══════════════════════════════════════════════════════════════════════

  describe("glob", () => {
    it("test_concrete", () => {
      const got = glob("hello world", "hello world");
      expect(got).toBe(true);
    });

    it("test_concrete_fail", () => {
      const got = glob("hello world", "NOPE");
      expect(got).toBe(false);
    });

    it("test_empty_pattern_fail", () => {
      const got = glob("hello world", "");
      expect(got).toBe(false);
    });

    it("test_escaped_star", () => {
      const got = glob("*", "\\*");
      expect(got).toBe(true);
    });

    it("test_inner_escaped_star", () => {
      const got = glob("hello, * world*", "hello*\\**\\*");
      expect(got).toBe(true);
    });

    it("test_empty_string_fail", () => {
      const got = glob("", "NOPE");
      expect(got).toBe(false);
    });

    it("test_left_star", () => {
      const got = glob("hello world", "*world");
      expect(got).toBe(true);
    });

    it("test_left_star_failure", () => {
      const got = glob("hello world", "*NOPE");
      expect(got).toBe(false);
    });

    it("test_right_star", () => {
      const got = glob("hello world", "hello*");
      expect(got).toBe(true);
    });

    it("test_right_star_failure", () => {
      const got = glob("hello world", "NOPE*");
      expect(got).toBe(false);
    });

    it("test_only_star", () => {
      const got = glob("hello world", "*");
      expect(got).toBe(true);
    });

    it("test_two_stars", () => {
      const got = glob("hello world", "* *");
      expect(got).toBe(true);
    });

    it("test_two_stars_fail", () => {
      const got = glob("hello world", "*@*");
      expect(got).toBe(false);
    });

    it("test_multiple_inner_stars", () => {
      const got = glob("hello world", "h*l*o*w*r*d");
      expect(got).toBe(true);
    });

    it("test_multiple_inner_stars_fail", () => {
      const got = glob("hello world", "a*b*c*d*e*f");
      expect(got).toBe(false);
    });

    it("test_concrete_with_multiple_inner_stars", () => {
      const got = glob("hello world", "hello* *world");
      expect(got).toBe(true);
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // run module — 42 tests
  // ══════════════════════════════════════════════════════════════════════

  describe("run", () => {
    it("test_eq", () => {
      const p = ipldToPredicate(["==", ".from", "alice@example.com"]);
      expect(runPredicate(p, email())).toBe(true);
    });

    it("test_eq_try_null", () => {
      const p = ipldToPredicate(["==", ".not_from?", null]);
      expect(runPredicate(p, email())).toBe(true);
    });

    it("test_eq_dot_field_ending_try_null", () => {
      const p = ipldToPredicate(["==", ".from.not?", null]);
      expect(runPredicate(p, email())).toBe(true);
    });

    it("test_eq_dot_field_inner_try_null", () => {
      const p = ipldToPredicate(["==", ".nope?.not", null]);
      expect(runPredicate(p, email())).toBe(true);
    });

    it("test_eq_root_try_not_null", () => {
      const p = ipldToPredicate(["==", ".?", null]);
      expect(runPredicate(p, email())).toBe(false);
    });

    it("test_eq_try_not_null", () => {
      const p = ipldToPredicate(["==", ".from?", "alice@example.com"]);
      expect(runPredicate(p, email())).toBe(true);
    });

    it("test_eq_nested_try_null", () => {
      const p = ipldToPredicate(["==", ".from?.not?", null]);
      expect(runPredicate(p, email())).toBe(true);
    });

    it("test_eq_fail_same_type", () => {
      const p = ipldToPredicate(["==", ".from", "NOPE"]);
      expect(runPredicate(p, email())).toBe(false);
    });

    it("test_eq_bad_selector", () => {
      const p = ipldToPredicate(["==", ".NOPE", "alice@example.com"]);
      expect(() => runPredicate(p, email())).toThrow(RunError);
    });

    it("test_eq_fail_different_type", () => {
      const p = ipldToPredicate(["==", ".from", 42]);
      expect(runPredicate(p, email())).toBe(false);
    });

    it("test_gt", () => {
      const p = ipldToPredicate([">", ".foo", 41.9]);
      expect(runPredicate(p, simple())).toBe(true);
    });

    it("test_gt_fail", () => {
      const p = ipldToPredicate([">", ".foo", 42]);
      expect(runPredicate(p, simple())).toBe(false);
    });

    it("test_gte", () => {
      const p = ipldToPredicate([">=", ".foo", 42]);
      expect(runPredicate(p, simple())).toBe(true);
    });

    it("test_gte_fail", () => {
      const p = ipldToPredicate([">=", ".foo", 42.1]);
      expect(runPredicate(p, simple())).toBe(false);
    });

    it("test_lt", () => {
      const p = ipldToPredicate(["<", ".foo", 42.1]);
      expect(runPredicate(p, simple())).toBe(true);
    });

    it("test_lt_fail", () => {
      const p = ipldToPredicate(["<", ".foo", 42]);
      expect(runPredicate(p, simple())).toBe(false);
    });

    it("test_lte", () => {
      const p = ipldToPredicate(["<=", ".foo", 42]);
      expect(runPredicate(p, simple())).toBe(true);
    });

    it("test_lte_fail", () => {
      const p = ipldToPredicate(["<=", ".foo", 41.9]);
      expect(runPredicate(p, simple())).toBe(false);
    });

    it("test_like", () => {
      const p = ipldToPredicate(["like", ".from", "alice@*"]);
      expect(runPredicate(p, email())).toBe(true);
    });

    it("test_like_fail_concrete", () => {
      const p = ipldToPredicate(["like", ".from", "NOPE"]);
      expect(runPredicate(p, email())).toBe(false);
    });

    it("test_like_fail_left_star", () => {
      const p = ipldToPredicate(["like", ".from", "*NOPE"]);
      expect(runPredicate(p, email())).toBe(false);
    });

    it("test_like_fail_right_star", () => {
      const p = ipldToPredicate(["like", ".from", "NOPE*"]);
      expect(runPredicate(p, email())).toBe(false);
    });

    it("test_like_fail_both_stars", () => {
      const p = ipldToPredicate(["like", ".from", "*NOPE*"]);
      expect(runPredicate(p, email())).toBe(false);
    });

    it("test_not", () => {
      const p = ipldToPredicate(["not", ["==", ".from", "NOPE"]]);
      expect(runPredicate(p, email())).toBe(true);
    });

    it("test_double_negative", () => {
      const p = ipldToPredicate(["not", ["not", ["==", ".from", "alice@example.com"]]]);
      expect(runPredicate(p, email())).toBe(true);
    });

    it("test_not_fail", () => {
      const p = ipldToPredicate(["not", ["==", ".from", "alice@example.com"]]);
      expect(runPredicate(p, email())).toBe(false);
    });

    it("test_and_both_succeed", () => {
      const p = ipldToPredicate(["and", [
        ["==", ".from", "alice@example.com"],
        ["==", ".subject", "Quarterly Reports"],
      ]]);
      expect(runPredicate(p, email())).toBe(true);
    });

    it("test_and_left_fail", () => {
      const p = ipldToPredicate(["and", [
        ["==", ".from", "NOPE"],
        ["==", ".subject", "Quarterly Reports"],
      ]]);
      expect(runPredicate(p, email())).toBe(false);
    });

    it("test_and_right_fail", () => {
      const p = ipldToPredicate(["and", [
        ["==", ".from", "alice@example.com"],
        ["==", ".subject", "NOPE"],
      ]]);
      expect(runPredicate(p, email())).toBe(false);
    });

    it("test_and_both_fail", () => {
      const p = ipldToPredicate(["and", [
        ["==", ".from", "NOPE"],
        ["==", ".subject", "NOPE"],
      ]]);
      expect(runPredicate(p, email())).toBe(false);
    });

    it("test_or_both_succeed", () => {
      const p = ipldToPredicate(["or", [
        ["==", ".from", "alice@example.com"],
        ["==", ".subject", "Quarterly Reports"],
      ]]);
      expect(runPredicate(p, email())).toBe(true);
    });

    it("test_or_left_fail", () => {
      const p = ipldToPredicate(["or", [
        ["==", ".from", "NOPE"],
        ["==", ".subject", "Quarterly Reports"],
      ]]);
      expect(runPredicate(p, email())).toBe(true);
    });

    it("test_or_right_fail", () => {
      const p = ipldToPredicate(["or", [
        ["==", ".from", "alice@example.com"],
        ["==", ".subject", "NOPE"],
      ]]);
      expect(runPredicate(p, email())).toBe(true);
    });

    it("test_or_both_fail", () => {
      const p = ipldToPredicate(["or", [
        ["==", ".from", "NOPE"],
        ["==", ".subject", "NOPE"],
      ]]);
      expect(runPredicate(p, email())).toBe(false);
    });

    it("test_all", () => {
      const p = ipldToPredicate(["all", ".input[]", ["<", ".", 100]]);
      expect(runPredicate(p, wasm())).toBe(true);
    });

    it("test_all_failure", () => {
      const p = ipldToPredicate(["all", ".input[]", ["<", ".", 1]]);
      expect(runPredicate(p, wasm())).toBe(false);
    });

    it("test_any_all_succeed", () => {
      const p = ipldToPredicate(["any", ".input[]", ["<", ".", 100]]);
      expect(runPredicate(p, wasm())).toBe(true);
    });

    it("test_any_not_all", () => {
      const p = ipldToPredicate(["any", ".input[]", ["<", ".", 1]]);
      expect(runPredicate(p, wasm())).toBe(true);
    });

    it("test_any_all_fail", () => {
      const p = ipldToPredicate(["any", ".input[]", ["<", ".", 0]]);
      expect(runPredicate(p, wasm())).toBe(false);
    });

    it("test_alternate_all_and_any", () => {
      // ["all", ".a", ["any", ".b[]", ["==", ".", 0]]]
      const p = ipldToPredicate(["all", ".a", ["any", ".b[]", ["==", ".", 0]]]);

      // port of ipld!({ "a": [ { "b": { "c": 0, "d": 0, "e": 1 }, "not-b": "ignore" }, { "also-not-b": "ignore", "b": [-1, 0, 1] } ] })
      const elem0: Ipld = new Map([
        ["b", new Map([["c", 0], ["d", 0], ["e", 1]])],
        ["not-b", "ignore"],
      ]);
      const elem1: Ipld = new Map([
        ["also-not-b", "ignore"],
        ["b", [-1, 0, 1]],
      ]);
      const nestedData: Ipld = new Map([["a", [elem0, elem1]]]);
      expect(runPredicate(p, nestedData)).toBe(true);
    });

    it("test_alternate_fail_all_and_any", () => {
      // ["all", ".a", ["any", ".b[]", ["==", ".", 0]]]
      const p = ipldToPredicate(["all", ".a", ["any", ".b[]", ["==", ".", 0]]]);

      const elem0: Ipld = new Map([
        ["b", new Map([["c",0], ["d",0], ["e",1]])],
        ["not-b", "ignore"],
      ]);
      const elem1: Ipld = new Map([
        ["also-not-b", "ignore"],
        ["b", [-1, 42, 1]],
      ]);
      const nestedData: Ipld = new Map([["a", [elem0, elem1]]]);
      expect(runPredicate(p, nestedData)).toBe(false);
    });

    it("test_alternate_any_and_all", () => {
      // ["any", ".a", ["all", ".b[]", ["==", ".", 0]]]
      const p = ipldToPredicate(["any", ".a", ["all", ".b[]", ["==", ".", 0]]]);

      const elem0: Ipld = new Map([
        ["b", new Map([["c",0], ["d",0], ["e",1]])],
        ["not-b", "ignore"],
      ]);
      const elem1: Ipld = new Map([
        ["also-not-b", "ignore"],
        ["b", [0, 0, 0]],
      ]);
      const nestedData: Ipld = new Map([["a", [elem0, elem1]]]);
      expect(runPredicate(p, nestedData)).toBe(true);
    });

    it("test_alternate_fail_any_and_all", () => {
      // ["any", ".a", ["all", ".b[]", ["==", ".", 0]]]
      const p = ipldToPredicate(["any", ".a", ["all", ".b[]", ["==", ".", 0]]]);

      const elem0: Ipld = new Map([
        ["b", new Map([["c",0], ["d",0], ["e",1]])],
        ["not-b", "ignore"],
      ]);
      const elem1: Ipld = new Map([
        ["also-not-b", "ignore"],
        ["b", [-1, 42, 1]],
      ]);
      const nestedData: Ipld = new Map([["a", [elem0, elem1]]]);
      expect(runPredicate(p, nestedData)).toBe(false);
    });

    it("test_deeply_alternate_any_and_all", () => {
      // ["any", ".a",
      //   ["all", ".b.c[]",
      //     ["any", ".d",
      //       ["all", ".e[]",
      //         ["==", ".f.g", 0]
      //       ]
      //     ]
      //   ]
      // ]
      const p = ipldToPredicate(["any", ".a", [
        "all", ".b.c[]", [
          "any", ".d", [
            "all", ".e[]", [
              "==", ".f.g", 0,
            ],
          ],
        ],
      ]]);

      // Build deeply nested data bottom-up
      const e1_f: Ipld = new Map([["g", 0]]);
      const e1: Ipld = new Map([["f", e1_f], ["nope", -10]]);
      const e2_f: Ipld = new Map([["g", 0]]);
      const e2: Ipld = new Map([["_", "not selected"], ["f", e2_f]]);
      const e: Ipld = new Map([["e1", e1], ["e2", e2]]);
      const d_elem: Ipld = new Map([["e", e]]);
      const d: Ipld = [d_elem];
      const c1: Ipld = new Map([["d", d]]);
      const c2: Ipld = new Map([["*", "avoid"], ["d", d]]);
      const c: Ipld = new Map([["c1", c1], ["c2", c2]]);
      const b: Ipld = new Map([["c", c]]);
      const a_elem: Ipld = new Map([["b", b]]);
      const a: Ipld = [a_elem];
      const deeplyNestedData: Ipld = new Map([["a", a], ["z", "doesn't read this"]]);

      expect(runPredicate(p, deeplyNestedData)).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // roundtrip module — 2 tests
  // ══════════════════════════════════════════════════════════════════════

  describe("roundtrip", () => {
    it("test_not_equal_dagcbor_roundtrip", () => {
      const pred = ipldToPredicate(["!=", ".foo", 42]);
      const ipld = predicateToIpld(pred);
      const cbor = ipldToDagCbor(ipld as any);
      const backIpld = ipldFromDagCbor(cbor);
      const back = ipldToPredicate(backIpld);
      expect(back).toEqual(pred);
    });

    it("test_not_equal_ipld_roundtrip", () => {
      const pred = ipldToPredicate(["!=", ".bar", "hello"]);
      const ipld = predicateToIpld(pred);
      const back = ipldToPredicate(ipld);
      expect(back).toEqual(pred);
    });
  });
});