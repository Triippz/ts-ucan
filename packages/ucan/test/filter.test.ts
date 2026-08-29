import { describe, it, expect } from "vitest";
import type { Filter } from "../src/index.js";
import { filterToString, parseFilter } from "../src/index.js";

// n/a — property test:
// - test_filter_round_trip_display_parse
// - test_filter_round_trip_dag_cbor

function parseFilterWithRest(input: string): [Filter, string] {
  // ponytail: brute-force prefix scan for test-only parse() parity; upgrade if a non-consuming parser is exported.
  for (let end = input.length; end >= 0; end--) {
    try {
      return [parseFilter(input.slice(0, end)), input.slice(end)];
    } catch {
      // keep scanning
    }
  }
  throw new Error(`no valid filter prefix: ${input}`);
}

describe("Filter", () => {
  it("test_fails_on_empty", () => {
    expect(() => parseFilter("")).toThrow();
  });

  it("test_fails_on_bare_dot", () => {
    expect(() => parseFilter(".")).toThrow();
  });

  it("test_fails_on_multiple_bare_dots", () => {
    expect(() => parseFilter("..")).toThrow();
  });

  it("test_fails_on_leading_dots", () => {
    expect(() => parseFilter("..foo")).toThrow();
  });

  it("test_fails_on_empty_whitespace", () => {
    expect(() => parseFilter(" ")).toThrow();
  });

  it("test_fails_leading_whitespace", () => {
    expect(() => parseFilter(" .foo")).toThrow();
  });

  it("test_fails_trailing_whitespace", () => {
    expect(() => parseFilter(".foo ")).toThrow();
  });

  it("test_values", () => {
    expect(parseFilter("[]")).toEqual({ kind: "values" });
  });

  it("test_values_fails_inner_whitespace", () => {
    expect(() => parseFilter("[ ]")).toThrow();
  });

  it("test_array_index_zero", () => {
    expect(parseFilter("[0]")).toEqual({ kind: "arrayIndex", index: 0 });
  });

  it("test_array_index_small", () => {
    expect(parseFilter("[2]")).toEqual({ kind: "arrayIndex", index: 2 });
  });

  it("test_array_index_large", () => {
    expect(parseFilter("[1234567890]")).toEqual({ kind: "arrayIndex", index: 1234567890 });
  });

  it("test_array_from_end", () => {
    expect(parseFilter("[-42]")).toEqual({ kind: "arrayIndex", index: -42 });
  });

  it("test_array_fails_spaces", () => {
    expect(() => parseFilter("[ 42]")).toThrow();
  });

  it("test_dot_field", () => {
    expect(parseFilter(".F0o")).toEqual({ kind: "field", key: "F0o" });
  });

  it("test_dot_field_starting_underscore", () => {
    expect(parseFilter("._foo")).toEqual({ kind: "field", key: "_foo" });
  });

  it("test_dot_field_trailing_underscore", () => {
    expect(parseFilter(".fO0_")).toEqual({ kind: "field", key: "fO0_" });
  });

  it("test_fails_dot_field_with_leading_number", () => {
    expect(() => parseFilter(".1foo")).toThrow();
  });

  it("test_fails_dot_field_with_inner_symbol", () => {
    expect(() => parseFilter(".fo%o")).toThrow();
  });

  it("test_delim_field", () => {
    expect(parseFilter('["F0o"]')).toEqual({ kind: "field", key: "F0o" });
  });

  it("test_delim_field_fails_without_quotes", () => {
    expect(() => parseFilter("[F0o]")).toThrow();
  });

  it("test_delim_field_fails_if_missing_right_brace", () => {
    expect(() => parseFilter('["F0o"')).toThrow();
  });

  it("test_delim_field_starting_underscore", () => {
    expect(parseFilter('["_foo"]')).toEqual({ kind: "field", key: "_foo" });
  });

  it("test_delim_field_trailing_underscore", () => {
    expect(parseFilter('["fO0_"]')).toEqual({ kind: "field", key: "fO0_" });
  });

  it("test_delim_field_with_leading_number", () => {
    expect(parseFilter('["1foo"]')).toEqual({ kind: "field", key: "1foo" });
  });

  it("test_delim_field_with_inner_symbol", () => {
    expect(parseFilter('[".fo%o"]')).toEqual({ kind: "field", key: ".fo%o" });
  });

  it("test_try", () => {
    expect(parseFilter(".foo?")).toEqual({ kind: "try", inner: { kind: "field", key: "foo" } });
  });

  it("test_parse_try", () => {
    expect(parseFilterWithRest(".foo?")).toEqual([
      { kind: "try", inner: { kind: "field", key: "foo" } },
      "",
    ]);
  });

  it("test_multiple_tries_after_dot_field", () => {
    expect(parseFilter(".foo???????????????????")).toEqual({ kind: "try", inner: { kind: "field", key: "foo" } });
  });

  it("test_parse_multiple_tries_after_dot_field", () => {
    expect(parseFilterWithRest(".foo???????????????????")).toEqual([
      { kind: "try", inner: { kind: "field", key: "foo" } },
      "",
    ]);
  });

  it("test_parse_multiple_tries_after_dot_field_trailing", () => {
    expect(parseFilterWithRest(".foo???????????????????abc")).toEqual([
      { kind: "try", inner: { kind: "field", key: "foo" } },
      "abc",
    ]);
  });

  it("test_parse_many0_multiple_tries_after_dot_field", () => {
    expect(parseFilterWithRest(".foo???????????????????abc")).toEqual([
      { kind: "try", inner: { kind: "field", key: "foo" } },
      "abc",
    ]);
  });

  it("test_multiple_tries_after_delim_field", () => {
    expect(parseFilter('["foo"]???????')).toEqual({ kind: "try", inner: { kind: "field", key: "foo" } });
  });

  it("test_multiple_tries_after_delim_field_inner_questionmarks", () => {
    expect(parseFilter('["f?o"]???????')).toEqual({ kind: "try", inner: { kind: "field", key: "f?o" } });
  });

  it("test_multiple_tries_after_values", () => {
    expect(parseFilter("[]???????")).toEqual({ kind: "try", inner: { kind: "values" } });
  });

  it("test_multiple_tries_after_index", () => {
    expect(parseFilter("[42]???????")).toEqual({ kind: "try", inner: { kind: "arrayIndex", index: 42 } });
  });

  it("test_slice_both", () => {
    expect(parseFilter("[2:5]")).toEqual({ kind: "slice", start: 2, end: 5 });
  });

  it("test_slice_start_only", () => {
    expect(parseFilter("[2:]" )).toEqual({ kind: "slice", start: 2, end: null });
  });

  it("test_slice_end_only", () => {
    expect(parseFilter("[:5]")).toEqual({ kind: "slice", start: null, end: 5 });
  });

  it("test_slice_both_negative", () => {
    expect(parseFilter("[0:-2]")).toEqual({ kind: "slice", start: 0, end: -2 });
  });

  it("test_slice_open", () => {
    expect(parseFilter("[:]" )).toEqual({ kind: "slice", start: null, end: null });
  });

  it("test_slice_negative_start", () => {
    expect(parseFilter("[-3:]" )).toEqual({ kind: "slice", start: -3, end: null });
  });

  it("test_slice_display_roundtrip", () => {
    const cases: Filter[] = [
      { kind: "slice", start: 2, end: 5 },
      { kind: "slice", start: 2, end: null },
      { kind: "slice", start: null, end: 5 },
      { kind: "slice", start: null, end: null },
      { kind: "slice", start: 0, end: -2 },
      { kind: "slice", start: -3, end: null },
    ];

    for (const filter of cases) {
      const displayed = filterToString(filter);
      const parsed = parseFilter(displayed);
      expect(parsed).toEqual(filter);
    }
  });

  it("test_fails_bare_try", () => {
    expect(() => parseFilter("?")).toThrow();
  });

  it("test_fails_dot_try", () => {
    expect(() => parseFilter(".?" )).toThrow();
  });
});
