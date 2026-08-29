import { describe, it, expect } from "vitest";
import { ipldToPredicate, predicateToIpld, runPredicate } from "../src/index.js";

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
});
