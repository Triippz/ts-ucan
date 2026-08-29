import { describe, it, expect } from "vitest";
import { parseFilter, filterToString, filterToIpld, ipldToFilter } from "../src/index.js";

describe("Filter", () => {
  it("test_fails_on_empty", () => {
    expect(() => parseFilter("")).toThrow();
  });

  it("test_values", () => {
    const filter = parseFilter("[]");
    expect(filterToString(filter)).toBe("[]");
    expect(ipldToFilter(filterToIpld(filter))).toEqual(filter);
  });

  it("test_array_index_zero", () => {
    const filter = parseFilter("[0]");
    expect(filterToString(filter)).toBe("[0]");
    expect(ipldToFilter(filterToIpld(filter))).toEqual(filter);
  });

  it("test_dot_field", () => {
    const filter = parseFilter(".foo");
    expect(filterToString(filter)).toBe(".foo");
    expect(ipldToFilter(filterToIpld(filter))).toEqual(filter);
  });

  it("test_try", () => {
    const filter = parseFilter(".foo?");
    expect(filterToString(filter)).toBe(".foo?");
    expect(ipldToFilter(filterToIpld(filter))).toEqual(filter);
  });

  it("test_slice_both", () => {
    const filter = parseFilter("[1:3]");
    expect(filterToString(filter)).toBe("[1:3]");
    expect(ipldToFilter(filterToIpld(filter))).toEqual(filter);
  });
});
