import { describe, it, expect } from "vitest";
import { encode as dagCborEncode } from "@ipld/dag-cbor";
import { promisedToWireIpld, wireIpldToPromised } from "../src/promise.js";

describe("Promised wire format", () => {
  it("encodes Bytes as a byte list", () => {
    const wire = promisedToWireIpld({ kind: "bytes", value: Uint8Array.from([1, 2, 3]) });
    expect(wire).toBeInstanceOf(Map);
    expect((wire as Map<string, unknown>).get("Bytes")).toEqual([1, 2, 3]);
  });

  it("matches Rust dag-cbor fixtures", () => {
    const cases: Array<[Parameters<typeof promisedToWireIpld>[0], number[]]> = [
      [{ kind: "null" }, [0x64, 0x4e, 0x75, 0x6c, 0x6c]],
      [{ kind: "bool", value: true }, [0xa1, 0x64, 0x42, 0x6f, 0x6f, 0x6c, 0xf5]],
      [
        { kind: "bytes", value: Uint8Array.from([1, 2, 3]) },
        [0xa1, 0x65, 0x42, 0x79, 0x74, 0x65, 0x73, 0x83, 0x01, 0x02, 0x03],
      ],
    ];

    for (const [promised, expected] of cases) {
      const wire = promisedToWireIpld(promised);
      expect(Array.from(dagCborEncode(wire))).toEqual(expected);
    }
  });

  it("rejects raw null on decode", () => {
    expect(() => wireIpldToPromised(null)).toThrow();
  });
});
