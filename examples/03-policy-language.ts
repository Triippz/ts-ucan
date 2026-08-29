/**
 * Tour of the policy language: wire-form predicates, selectors, and nested
 * boolean logic.
 *
 * Run:
 *   node examples/03-policy-language.ts
 */
import assert from "node:assert/strict";
import { ipldToPredicate, runPredicate } from "@marktripoli/ucan";

const cases = [
  {
    name: "==",
    predicate: ipldToPredicate(["==", ".user.name", "alice"]),
    data: new Map([["user", new Map([["name", "alice"]])]]),
    expected: true,
  },
  {
    name: "like",
    predicate: ipldToPredicate(["like", ".title", "draft:*"]),
    data: new Map([["title", "draft:launch"]]),
    expected: true,
  },
  {
    name: "all",
    predicate: ipldToPredicate(["all", ".tags[]", ["like", ".", "pro*"]]),
    data: new Map([["tags", ["prod", "program"]]]),
    expected: true,
  },
  {
    name: "any",
    predicate: ipldToPredicate(["any", ".tags[]", ["==", ".", "orange"]]),
    data: new Map([["tags", ["green", "blue"]]]),
    expected: false,
  },
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
  {
    name: "negative index",
    predicate: ipldToPredicate(["==", ".steps[-1]", "ship"]),
    data: new Map([["steps", ["plan", "build", "ship"]]]),
    expected: true,
  },
  {
    name: "negative index + ?",
    predicate: ipldToPredicate(["==", ".steps[-1]?.missing", null]),
    data: new Map([["steps", ["plan", "build", "ship"]]]),
    expected: true,
  },
] as const;

const results = cases.map(({ name, predicate, data, expected }) => {
  const actual = runPredicate(predicate, data);
  assert.equal(actual, expected, name);
  return { predicate: name, expected, actual, ok: actual === expected };
});

console.table(results);
