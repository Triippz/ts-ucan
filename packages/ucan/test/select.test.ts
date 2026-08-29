import { describe, it, expect } from "vitest";
import { Select } from "../src/index.js";
import { selectIpld } from "../src/delegation/policy/selector/selectable.js";

describe("Select", () => {
  it("test_identity", () => {
    const data = new Map<string, any>([["answer", 42], ["nested", new Map([["ok", true]])]]);
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
});
