/**
 * Policy conformance tests.
 *
 * Ported from ucan/tests/policy_conformance.rs
 */

import { describe, it, expect, beforeAll } from "vitest";
import policyFixture from "./fixtures/policy.json" assert { type: "json" };
import { runPredicate, ipldToPredicate } from "../src/delegation/policy/predicate.js";
import type { Ipld } from "@ucans/varsig";
import { ipldFromDagJson } from "../src/ipld.js";

async function loadFixture(
  idx: number,
  mode: "valid" | "invalid"
): Promise<{
  args: Ipld;
  policies: any[][];
}> {
  const fixture = (policyFixture as any)[mode][idx];
  if (!fixture) {
    throw new Error(`fixture missing ${mode}/${idx}`);
  }

  // Convert args from JSON to Ipld via DAG-JSON
  const argsDagJson = JSON.stringify(fixture.args);
  const argsIpld = ipldFromDagJson(new TextEncoder().encode(argsDagJson));

  // Parse policies (keep as Ipld for now, will convert to predicates during tests)
  const policiesIpld = fixture.policies;
  if (!Array.isArray(policiesIpld)) {
    throw new Error("expected policies to be an array");
  }

  return { args: argsIpld, policies: policiesIpld };
}

describe("Policy Conformance - Valid Scenarios", () => {
  describe("Scenario 0", () => {
    let fixture: { args: Ipld; policies: any[][] };

    beforeAll(async () => {
      fixture = await loadFixture(0, "valid");
    });

    it("test_zeroth_policy", async () => {
      const policySet = fixture.policies[0];
      expect(policySet).toBeDefined();
      for (const predicateIpld of policySet) {
        const predicate = ipldToPredicate(predicateIpld);
        const result = runPredicate(predicate, fixture.args);
        expect(result).toBe(true);
      }
    });

    it("test_first_policy", async () => {
      const policySet = fixture.policies[1];
      expect(policySet).toBeDefined();
      for (const predicateIpld of policySet) {
        const predicate = ipldToPredicate(predicateIpld);
        const result = runPredicate(predicate, fixture.args);
        expect(result).toBe(true);
      }
    });

    it("test_second_policy", async () => {
      const policySet = fixture.policies[2];
      expect(policySet).toBeDefined();
      for (const predicateIpld of policySet) {
        const predicate = ipldToPredicate(predicateIpld);
        const result = runPredicate(predicate, fixture.args);
        expect(result).toBe(true);
      }
    });

    it("test_third_policy", async () => {
      const policySet = fixture.policies[3];
      expect(policySet).toBeDefined();
      for (const predicateIpld of policySet) {
        const predicate = ipldToPredicate(predicateIpld);
        const result = runPredicate(predicate, fixture.args);
        expect(result).toBe(true);
      }
    });

    it("test_fourth_policy", async () => {
      const policySet = fixture.policies[4];
      expect(policySet).toBeDefined();
      for (const predicateIpld of policySet) {
        const predicate = ipldToPredicate(predicateIpld);
        const result = runPredicate(predicate, fixture.args);
        expect(result).toBe(true);
      }
    });

    it("test_fifth_policy", async () => {
      const policySet = fixture.policies[5];
      expect(policySet).toBeDefined();
      for (const predicateIpld of policySet) {
        const predicate = ipldToPredicate(predicateIpld);
        const result = runPredicate(predicate, fixture.args);
        expect(result).toBe(true);
      }
    });
  });

  describe("Scenario 1", () => {
    let fixture: { args: Ipld; policies: any[][] };

    beforeAll(async () => {
      fixture = await loadFixture(1, "valid");
    });

    it("test_the_lone_policy", async () => {
      const policySet = fixture.policies[0];
      expect(policySet).toBeDefined();
      for (const predicateIpld of policySet) {
        const predicate = ipldToPredicate(predicateIpld);
        const result = runPredicate(predicate, fixture.args);
        expect(result).toBe(true);
      }
    });
  });

  describe("Scenario 2", () => {
    let fixture: { args: Ipld; policies: any[][] };

    beforeAll(async () => {
      fixture = await loadFixture(2, "valid");
    });

    it("test_zeroth_policy", async () => {
      const policySet = fixture.policies[0];
      expect(policySet).toBeDefined();
      for (const predicateIpld of policySet) {
        const predicate = ipldToPredicate(predicateIpld);
        const result = runPredicate(predicate, fixture.args);
        expect(result).toBe(true);
      }
    });

    it("test_first_policy", async () => {
      const policySet = fixture.policies[1];
      expect(policySet).toBeDefined();
      for (const predicateIpld of policySet) {
        const predicate = ipldToPredicate(predicateIpld);
        const result = runPredicate(predicate, fixture.args);
        expect(result).toBe(true);
      }
    });

    it("test_second_policy", async () => {
      const policySet = fixture.policies[2];
      expect(policySet).toBeDefined();
      for (const predicateIpld of policySet) {
        const predicate = ipldToPredicate(predicateIpld);
        const result = runPredicate(predicate, fixture.args);
        expect(result).toBe(true);
      }
    });

    it("test_third_policy", async () => {
      const policySet = fixture.policies[3];
      expect(policySet).toBeDefined();
      for (const predicateIpld of policySet) {
        const predicate = ipldToPredicate(predicateIpld);
        const result = runPredicate(predicate, fixture.args);
        expect(result).toBe(true);
      }
    });

    it("test_fourth_policy", async () => {
      const policySet = fixture.policies[4];
      expect(policySet).toBeDefined();
      for (const predicateIpld of policySet) {
        const predicate = ipldToPredicate(predicateIpld);
        const result = runPredicate(predicate, fixture.args);
        expect(result).toBe(true);
      }
    });

    it("test_fifth_policy", async () => {
      const policySet = fixture.policies[5];
      expect(policySet).toBeDefined();
      for (const predicateIpld of policySet) {
        const predicate = ipldToPredicate(predicateIpld);
        const result = runPredicate(predicate, fixture.args);
        expect(result).toBe(true);
      }
    });

    it("test_sixth_policy", async () => {
      const policySet = fixture.policies[6];
      expect(policySet).toBeDefined();
      for (const predicateIpld of policySet) {
        const predicate = ipldToPredicate(predicateIpld);
        const result = runPredicate(predicate, fixture.args);
        expect(result).toBe(true);
      }
    });
  });

  describe("Scenario 3", () => {
    let fixture: { args: Ipld; policies: any[][] };

    beforeAll(async () => {
      fixture = await loadFixture(3, "valid");
    });

    it("test_zeroth_policy", async () => {
      const policySet = fixture.policies[0];
      expect(policySet).toBeDefined();
      for (const predicateIpld of policySet) {
        const predicate = ipldToPredicate(predicateIpld);
        const result = runPredicate(predicate, fixture.args);
        expect(result).toBe(true);
      }
    });
  });

  describe("Scenario 4", () => {
    let fixture: { args: Ipld; policies: any[][] };

    beforeAll(async () => {
      fixture = await loadFixture(4, "valid");
    });

    it("test_zeroth_policy", async () => {
      const policySet = fixture.policies[0];
      expect(policySet).toBeDefined();
      for (const predicateIpld of policySet) {
        const predicate = ipldToPredicate(predicateIpld);
        const result = runPredicate(predicate, fixture.args);
        expect(result).toBe(true);
      }
    });
  });

  describe("Scenario 5", () => {
    let fixture: { args: Ipld; policies: any[][] };

    beforeAll(async () => {
      fixture = await loadFixture(5, "valid");
    });

    it("test_zeroth_policy", async () => {
      const policySet = fixture.policies[0];
      expect(policySet).toBeDefined();
      for (const predicateIpld of policySet) {
        const predicate = ipldToPredicate(predicateIpld);
        const result = runPredicate(predicate, fixture.args);
        expect(result).toBe(true);
      }
    });
  });
});

describe("Policy Conformance - Invalid Scenarios", () => {
  describe("Scenario 0", () => {
    let fixture: { args: Ipld; policies: any[][] };

    beforeAll(async () => {
      fixture = await loadFixture(0, "invalid");
    });

    it("test_zeroth_policy", async () => {
      const policySet = fixture.policies[0];
      expect(policySet).toBeDefined();
      for (const predicateIpld of policySet) {
        const predicate = ipldToPredicate(predicateIpld);
        const result = runPredicate(predicate, fixture.args);
        expect(result).toBe(false);
      }
    });

    it("test_first_policy", async () => {
      const policySet = fixture.policies[1];
      expect(policySet).toBeDefined();
      for (const predicateIpld of policySet) {
        const predicate = ipldToPredicate(predicateIpld);
        const result = runPredicate(predicate, fixture.args);
        expect(result).toBe(false);
      }
    });

    it("test_second_policy", async () => {
      const policySet = fixture.policies[2];
      expect(policySet).toBeDefined();
      for (const predicateIpld of policySet) {
        const predicate = ipldToPredicate(predicateIpld);
        const result = runPredicate(predicate, fixture.args);
        expect(result).toBe(false);
      }
    });

    it("test_third_policy", async () => {
      const policySet = fixture.policies[3];
      expect(policySet).toBeDefined();
      for (const predicateIpld of policySet) {
        const predicate = ipldToPredicate(predicateIpld);
        const result = runPredicate(predicate, fixture.args);
        expect(result).toBe(false);
      }
    });

    it("test_fourth_policy", async () => {
      const policySet = fixture.policies[4];
      expect(policySet).toBeDefined();
      for (const predicateIpld of policySet) {
        const predicate = ipldToPredicate(predicateIpld);
        const result = runPredicate(predicate, fixture.args);
        expect(result).toBe(false);
      }
    });
  });

  describe("Scenario 1", () => {
    let fixture: { args: Ipld; policies: any[][] };

    beforeAll(async () => {
      fixture = await loadFixture(1, "invalid");
    });

    it("test_zeroth_policy", async () => {
      const policySet = fixture.policies[0];
      expect(policySet).toBeDefined();
      for (const predicateIpld of policySet) {
        const predicate = ipldToPredicate(predicateIpld);
        const result = runPredicate(predicate, fixture.args);
        expect(result).toBe(false);
      }
    });
  });

  describe("Scenario 2", () => {
    let fixture: { args: Ipld; policies: any[][] };

    beforeAll(async () => {
      fixture = await loadFixture(2, "invalid");
    });

    it("test_zeroth_policy", async () => {
      const policySet = fixture.policies[0];
      expect(policySet).toBeDefined();
      for (const predicateIpld of policySet) {
        const predicate = ipldToPredicate(predicateIpld);
        const result = runPredicate(predicate, fixture.args);
        expect(result).toBe(false);
      }
    });
  });

  describe("Scenario 3", () => {
    let fixture: { args: Ipld; policies: any[][] };

    beforeAll(async () => {
      fixture = await loadFixture(3, "invalid");
    });

    it("test_zeroth_policy", async () => {
      const policySet = fixture.policies[0];
      expect(policySet).toBeDefined();
      for (const predicateIpld of policySet) {
        const predicate = ipldToPredicate(predicateIpld);
        const result = runPredicate(predicate, fixture.args);
        expect(result).toBe(false);
      }
    });
  });
});
