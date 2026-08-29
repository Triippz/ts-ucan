import { describe, it, expect } from "vitest";
import { Selector } from "../src/index.js";

describe("Selector.isRelated", () => {
  it("treats prefix selectors as related", () => {
    expect(Selector.fromString(".foo").isRelated(Selector.fromString(".foo.bar"))).toBe(true);
  });

  it("treats empty selector as related to any prefix", () => {
    expect(Selector.fromString(".").isRelated(Selector.fromString(".foo.bar"))).toBe(true);
  });
});
