/**
 * Policy-language tour: each case maps a wire predicate onto sample data.
 *
 * The examples cover equality, prefix matches, array traversal, and boolean
 * composition.
 * This proves the predicate evaluator matches the UCAN policy surface.
 *
 * Run:
 *   node examples/03-policy-language.ts
 */
import assert from "node:assert/strict";
import { ipldToPredicate, runPredicate } from "@marktripoli/ucan";

const cases = [
  // Equality against a nested path in the invocation data.
  {
    name: "==",
    predicate: ipldToPredicate(["==", ".user.name", "alice"]),
    data: new Map([["user", new Map([["name", "alice"]])]]),
    expected: true,
  },
  // Prefix matching keeps the policy focused on draft titles.
  {
    name: "like",
    predicate: ipldToPredicate(["like", ".title", "draft:*"]),
    data: new Map([["title", "draft:launch"]]),
    expected: true,
  },
  // all() requires every selected array item to satisfy the nested test.
  {
    name: "all",
    predicate: ipldToPredicate(["all", ".tags[]", ["like", ".", "pro*"]]),
    data: new Map([["tags", ["prod", "program"]]]),
    expected: true,
  },
  // any() fails when none of the candidates match.
  {
    name: "any",
    predicate: ipldToPredicate(["any", ".tags[]", ["==", ".", "orange"]]),
    data: new Map([["tags", ["green", "blue"]]]),
    expected: false,
  },
  // and/or/not let a policy combine multiple branches cleanly.
  {
    name: "and/or/not",
    predicate: ipldToPredicate([
      "and",
      [
        ["not", ["==", ".archived", true]],
        ["or", [["==", ".status", "draft"], ["==", ".status", "pending"]]],
      ],
    ]),
    data: new Map([["archived", false], ["status", "draft"]]),
    expected: true,
  },
  // Negative indices address the last item in the sequence.
  {
    name: "negative index",
    predicate: ipldToPredicate(["==", ".steps[-1]", "ship"]),
    data: new Map([["steps", ["plan", "build", "ship"]]]),
    expected: true,
  },
  // Optional chaining keeps a missing nested field from blowing up the lookup.
  // The `?` must sit on the segment that may be absent (`.missing?`): the
  // optional only null-swallows when it itself misses, so a hit on `[-1]`
  // followed by a required `.missing` would (correctly) fail the predicate.
  {
    name: "negative index + ?",
    predicate: ipldToPredicate(["==", ".steps[-1].missing?", null]),
    data: new Map([["steps", ["plan", "build", "ship"]]]),
    expected: true,
  },
] as const;

// Run each predicate against the sample data and assert the expected result.
const results = cases.map(({ name, predicate, data, expected }) => {
  const actual = runPredicate(predicate, data);
  assert.equal(actual, expected, name);
  return { predicate: name, expected, actual, ok: actual === expected };
});

// The table makes the policy behavior easy to scan.
console.table(results);
