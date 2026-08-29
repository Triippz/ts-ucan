/**
 * Nonce tests.
 *
 * Ported from ucan/src/crypto/nonce.rs
 */

import { describe, it, expect } from "vitest";
import { Nonce, NoncesMustBeBytesError } from "../src/crypto/nonce.js";

describe("Nonce", () => {
  it("test_ipld_roundtrip_16", () => {
    const nonce = Nonce.generate16();
    const ipld = nonce.toIpld();

    expect(nonce.kind).toBe("nonce16");
    expect(ipld).toEqual(nonce.bytes);

    const roundtripped = Nonce.fromIpld(ipld);
    expect(nonce.equals(roundtripped)).toBe(true);
  });

  it("proptest_roundtrip_serde", () => {
    const testLengths = [0, 1, 15, 16, 17, 32];

    for (const len of testLengths) {
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = Math.floor(Math.random() * 256);
      }

      const nonce = Nonce.fromBytes(bytes);
      const ipld = nonce.toIpld();
      const de = Nonce.fromIpld(ipld);

      expect(nonce.equals(de)).toBe(true);
    }
  });

  it("test_generate_16_length", () => {
    const nonce = Nonce.generate16();
    expect(nonce.kind).toBe("nonce16");
    expect(nonce.bytes.length).toBe(16);
  });

  it("test_custom_nonce", () => {
    const bytes = new Uint8Array([1, 2, 3]);
    const nonce = Nonce.fromBytes(bytes);
    expect(nonce.kind).toBe("custom");
    expect(nonce.bytes).toEqual(bytes);
  });

  it("test_to_string_hex", () => {
    const bytes = new Uint8Array([0x12, 0x34, 0xab, 0xcd]);
    const nonce = Nonce.fromBytes(bytes);
    expect(nonce.toString()).toBe("1234abcd");
  });

  it("test_from_ipld_invalid", () => {
    expect(() => Nonce.fromIpld("not bytes")).toThrow(NoncesMustBeBytesError);
    expect(() => Nonce.fromIpld(42)).toThrow(NoncesMustBeBytesError);
  });

  it("test_cross_variant_equality", () => {
    const bytes16 = new Uint8Array(16);
    bytes16[0] = 1;

    const nonce16 = Nonce.fromBytes(bytes16);
    const custom16 = Nonce.fromBytes(Uint8Array.from(bytes16));

    expect(nonce16.kind).toBe("nonce16");
    expect(custom16.kind).toBe("nonce16"); // 16 bytes always → nonce16
    expect(nonce16.equals(custom16)).toBe(true);
  });
});
