import { describe, it, expect } from "vitest";
import { promisedToWireIpld, wireIpldToPromised } from "../src/promise.js";

describe("Promised wire format", () => {
  it("encodes Bytes as a byte list", () => {
    const wire = promisedToWireIpld({ kind: "bytes", value: Uint8Array.from([1, 2, 3]) });
    expect(wire).toBeInstanceOf(Map);
    expect((wire as Map<string, unknown>).get("Bytes")).toEqual([1, 2, 3]);
  });

  it("rejects raw null on decode", () => {
    expect(() => wireIpldToPromised(null)).toThrow();
  });
});
