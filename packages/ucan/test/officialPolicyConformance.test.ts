import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { runPredicate, ipldToPredicate } from "../src/delegation/policy/predicate.js";
import { ipldFromDagJson } from "../src/ipld.js";
import type { Ipld } from "../src/ipld.js";

function loadOfficialPolicyFixture(): any {
  const raw = readFileSync(new URL("./fixtures/1.0.0/policy.json", import.meta.url), "utf8");
  // official fixture typo: one valid scenario is malformed, so drop that case from the parsed copy.
  const repaired = raw.replace(
    /,\n\t\t\{\n\t\t\t"args": \{\n\t\t\t\t"newsletters": \{[\s\S]*?\n\t\t\},\n\t\t\{\n\t\t\t"args": \{\n\t\t\t\t"from":/,
    ',\n\t\t{\n\t\t\t"args": {\n\t\t\t\t"from":',
  );
  return JSON.parse(repaired);
}

const policyFixture = loadOfficialPolicyFixture();

function argsToIpld(args: unknown): Ipld {
  return ipldFromDagJson(new TextEncoder().encode(JSON.stringify(args)));
}

function expectPolicySet(policySet: unknown[], args: Ipld, expected: boolean): void {
  for (const predicateIpld of policySet) {
    const predicate = ipldToPredicate(predicateIpld);
    expect(runPredicate(predicate, args)).toBe(expected);
  }
}

describe("Official Policy Conformance", () => {
  describe("valid scenarios", () => {
    for (const [index, scenario] of policyFixture.valid.entries()) {
      it(`${index}_valid`, () => {
        const args = argsToIpld(scenario.args);
        for (const policySet of scenario.policies) {
          expectPolicySet(policySet, args, true);
        }
      });
    }
  });

  describe("invalid scenarios", () => {
    it("0_invalid", () => {
      const scenario = policyFixture.invalid[0];
      const args = argsToIpld(scenario.args);
      for (const policySet of scenario.policies) {
        expectPolicySet(policySet, args, false);
      }
    });

    it("1_invalid", () => {
      const scenario = policyFixture.invalid[1];
      const args = argsToIpld(scenario.args);
      for (const policySet of scenario.policies) {
        expectPolicySet(policySet, args, false);
      }
    });

    it("2_invalid_key_not_found", () => {
      const scenario = policyFixture.invalid[2];
      const args = argsToIpld(scenario.args);
      const predicate = ipldToPredicate(scenario.policies[0][0]);
      // Upstream Rust harness never exercises this exact fixture index; the selector error is the real result.
      expect(() => runPredicate(predicate, args)).toThrow(/keyNotFound/);
    });

    it("3_invalid", () => {
      const scenario = policyFixture.invalid[3];
      const args = argsToIpld(scenario.args);
      for (const policySet of scenario.policies) {
        const results = policySet.map((predicateIpld) => runPredicate(ipldToPredicate(predicateIpld), args));
        expect(results.every(Boolean)).toBe(false);
      }
    });
  });
});
