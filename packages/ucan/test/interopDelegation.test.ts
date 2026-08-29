import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import * as dagJson from "@ipld/dag-json";
import { ipldFromDagCbor, ipldToDagCbor } from "../src/ipld.js";

function base64ToBytes(b64: string): Uint8Array {
  return new Uint8Array(Buffer.from(b64, "base64"));
}

function loadBytes(file: string): Uint8Array {
  return readFileSync(new URL(file, import.meta.url));
}

describe("Interop Delegation", () => {
  it("roundtrips the legacy rc delegation manifest", () => {
    const manifest = JSON.parse(readFileSync(new URL("./fixtures/interop/interop_delegation.json", import.meta.url), "utf8"));
    const tokenBytes = base64ToBytes(manifest.valid[0].token);
    const parsed = ipldFromDagCbor(tokenBytes);

    expect(Array.isArray(parsed)).toBe(true);
    if (!Array.isArray(parsed) || !(parsed[0] instanceof Uint8Array) || !(parsed[1] instanceof Map)) {
      throw new Error("expected DAG-CBOR envelope tuple");
    }

    expect(parsed[1].has("h")).toBe(true);
    expect(parsed[1].has("ucan/dlg@1.0.0-rc.1")).toBe(true);
    expect(ipldToDagCbor(parsed)).toEqual(tokenBytes);
  });

  for (const name of ["new", "root", "powerline"] as const) {
    it(`decodes and re-encodes ${name}.dagjson byte-exact`, () => {
      const raw = loadBytes(`./fixtures/interop/${name}.dagjson`);
      const decoded = dagJson.decode(raw);

      expect(Array.isArray(decoded)).toBe(true);
      expect(Buffer.from(dagJson.encode(decoded))).toEqual(Buffer.from(raw));
    });
  }
});
