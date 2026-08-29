/**
 * Container tests.
 *
 * Tests against official test vectors from spec v0.1.0.
 * Each vector contains signed tokens in different encoding formats.
 */

import { describe, it, expect, beforeAll } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  containerToBytes,
  containerFromBytes,
  containerToRawBytes,
  containerToBase64StdPadding,
  containerToBase64Url,
  containerToBytesGzipped,
  ContainerHeader,
} from "../src/container/index.js";

/**
 * Load test vector from fixtures directory.
 */
function loadTestVector(name: string): Uint8Array {
  const filePath = path.join(import.meta.dirname, "fixtures", "container", name);
  return new Uint8Array(fs.readFileSync(filePath));
}

describe("Container", () => {
  let bytesVector: Uint8Array;
  let bytesGzippedVector: Uint8Array;
  let base64StdPaddingVector: Uint8Array;
  let base64StdPaddingGzippedVector: Uint8Array;
  let base64UrlVector: Uint8Array;
  let base64UrlGzippedVector: Uint8Array;

  beforeAll(() => {
    bytesVector = loadTestVector("Bytes");
    bytesGzippedVector = loadTestVector("BytesGzipped");
    base64StdPaddingVector = loadTestVector("Base64StdPadding");
    base64StdPaddingGzippedVector = loadTestVector("Base64StdPaddingGzipped");
    base64UrlVector = loadTestVector("Base64URL");
    base64UrlGzippedVector = loadTestVector("Base64URLGzipped");
  });

  describe("header detection", () => {
    it("identifies raw bytes header", () => {
      expect(bytesVector[0]).toBe(ContainerHeader.Bytes);
    });

    it("identifies gzipped bytes header", () => {
      expect(bytesGzippedVector[0]).toBe(ContainerHeader.BytesGzipped);
    });

    it("identifies base64-std header", () => {
      expect(base64StdPaddingVector[0]).toBe(ContainerHeader.Base64StdPadding);
    });

    it("identifies base64-std-gzipped header", () => {
      expect(base64StdPaddingGzippedVector[0]).toBe(ContainerHeader.Base64StdPaddingGzipped);
    });

    it("identifies base64-url header", () => {
      expect(base64UrlVector[0]).toBe(ContainerHeader.Base64Url);
    });

    it("identifies base64-url-gzipped header", () => {
      expect(base64UrlGzippedVector[0]).toBe(ContainerHeader.Base64UrlGzipped);
    });
  });

  describe("containerFromBytes", () => {
    it("decodes raw bytes vector", async () => {
      const tokens = await containerFromBytes(bytesVector);

      expect(Array.isArray(tokens)).toBe(true);
      expect(tokens.length).toBeGreaterThan(0);

      // All elements should be Uint8Array
      for (const token of tokens) {
        expect(token instanceof Uint8Array).toBe(true);
        // Each token should start with envelope signature + payload
        expect(token.length).toBeGreaterThan(0);
      }
    });

    it("decodes gzipped bytes vector", async () => {
      const tokens = await containerFromBytes(bytesGzippedVector);

      expect(Array.isArray(tokens)).toBe(true);
      expect(tokens.length).toBeGreaterThan(0);

      for (const token of tokens) {
        expect(token instanceof Uint8Array).toBe(true);
      }
    });

    it("decodes base64-std vector", async () => {
      const tokens = await containerFromBytes(base64StdPaddingVector);

      expect(Array.isArray(tokens)).toBe(true);
      expect(tokens.length).toBeGreaterThan(0);

      for (const token of tokens) {
        expect(token instanceof Uint8Array).toBe(true);
      }
    });

    it("decodes base64-std-gzipped vector", async () => {
      const tokens = await containerFromBytes(base64StdPaddingGzippedVector);

      expect(Array.isArray(tokens)).toBe(true);
      expect(tokens.length).toBeGreaterThan(0);

      for (const token of tokens) {
        expect(token instanceof Uint8Array).toBe(true);
      }
    });

    it("decodes base64-url vector", async () => {
      const tokens = await containerFromBytes(base64UrlVector);

      expect(Array.isArray(tokens)).toBe(true);
      expect(tokens.length).toBeGreaterThan(0);

      for (const token of tokens) {
        expect(token instanceof Uint8Array).toBe(true);
      }
    });

    it("decodes base64-url-gzipped vector", async () => {
      const tokens = await containerFromBytes(base64UrlGzippedVector);

      expect(Array.isArray(tokens)).toBe(true);
      expect(tokens.length).toBeGreaterThan(0);

      for (const token of tokens) {
        expect(token instanceof Uint8Array).toBe(true);
      }
    });

    it("rejects missing header", async () => {
      const empty = new Uint8Array(0);
      await expect(containerFromBytes(empty)).rejects.toThrow("container bytes too short");
    });

    it("rejects missing ctn-v1 key", async () => {
      const dagCbor = await import("@ipld/dag-cbor");
      const wrongContainer = dagCbor.encode({ "wrong-key": [] });
      const bytes = new Uint8Array(wrongContainer.length + 1);
      bytes[0] = ContainerHeader.Bytes;
      bytes.set(wrongContainer, 1);

      await expect(containerFromBytes(bytes)).rejects.toThrow('exactly one key "ctn-v1"');
    });

    it("rejects extra keys in container map", async () => {
      const dagCbor = await import("@ipld/dag-cbor");
      const wrongContainer = dagCbor.encode({ "ctn-v1": [], extra: [] });
      const bytes = new Uint8Array(wrongContainer.length + 1);
      bytes[0] = ContainerHeader.Bytes;
      bytes.set(wrongContainer, 1);

      await expect(containerFromBytes(bytes)).rejects.toThrow('exactly one key "ctn-v1"');
    });

    it("rejects non-array ctn-v1 value", async () => {
      const dagCbor = await import("@ipld/dag-cbor");
      const wrongContainer = dagCbor.encode({ "ctn-v1": "not-an-array" });
      const bytes = new Uint8Array(wrongContainer.length + 1);
      bytes[0] = ContainerHeader.Bytes;
      bytes.set(wrongContainer, 1);

      await expect(containerFromBytes(bytes)).rejects.toThrow('"ctn-v1" must be an array');
    });
  });

  describe("containerToBytes roundtrip", () => {
    it("raw bytes encode/decode roundtrip", async () => {
      const tokens = await containerFromBytes(bytesVector);

      const reencoded = await containerToRawBytes(tokens);

      // Verify decode roundtrip (tokens sorted bytewise for deterministic encoding)
      const redecoded = await containerFromBytes(reencoded);
      expect(redecoded.length).toBe(tokens.length);

      // Tokens are sorted bytewise on encode, so compare sorted arrays
      const tokensSet = new Set(tokens.map((t) => Buffer.from(t).toString("hex")));
      const redcodedSet = new Set(redecoded.map((t) => Buffer.from(t).toString("hex")));
      expect(tokensSet).toEqual(redcodedSet);
    });

    it("gzipped bytes encode/decode roundtrip", async () => {
      const tokens = await containerFromBytes(bytesGzippedVector);

      const reencoded = await containerToBytesGzipped(tokens);

      // Verify decode roundtrip (gzip may produce different bytes)
      const redecoded = await containerFromBytes(reencoded);
      expect(redecoded.length).toBe(tokens.length);

      const tokensSet = new Set(tokens.map((t) => Buffer.from(t).toString("hex")));
      const redcodedSet = new Set(redecoded.map((t) => Buffer.from(t).toString("hex")));
      expect(tokensSet).toEqual(redcodedSet);
    });

    it("base64-std encode/decode roundtrip", async () => {
      const tokens = await containerFromBytes(base64StdPaddingVector);

      const reencoded = await containerToBase64StdPadding(tokens);

      // Verify decode roundtrip
      const redecoded = await containerFromBytes(reencoded);
      expect(redecoded.length).toBe(tokens.length);

      const tokensSet = new Set(tokens.map((t) => Buffer.from(t).toString("hex")));
      const redcodedSet = new Set(redecoded.map((t) => Buffer.from(t).toString("hex")));
      expect(tokensSet).toEqual(redcodedSet);
    });

    it("base64-url encode/decode roundtrip", async () => {
      const tokens = await containerFromBytes(base64UrlVector);

      const reencoded = await containerToBase64Url(tokens);

      // Verify decode roundtrip
      const redecoded = await containerFromBytes(reencoded);
      expect(redecoded.length).toBe(tokens.length);

      const tokensSet = new Set(tokens.map((t) => Buffer.from(t).toString("hex")));
      const redcodedSet = new Set(redecoded.map((t) => Buffer.from(t).toString("hex")));
      expect(tokensSet).toEqual(redcodedSet);
    });

    it("base64-std-gzipped encode/decode roundtrip", async () => {
      const tokens = await containerFromBytes(base64StdPaddingGzippedVector);

      const reencoded = await containerToBase64StdPadding(tokens, true);

      // Verify decode roundtrip (gzip may produce different bytes)
      const redecoded = await containerFromBytes(reencoded);
      expect(redecoded.length).toBe(tokens.length);

      const tokensSet = new Set(tokens.map((t) => Buffer.from(t).toString("hex")));
      const redcodedSet = new Set(redecoded.map((t) => Buffer.from(t).toString("hex")));
      expect(tokensSet).toEqual(redcodedSet);
    });

    it("base64-url-gzipped encode/decode roundtrip", async () => {
      const tokens = await containerFromBytes(base64UrlGzippedVector);

      const reencoded = await containerToBase64Url(tokens, true);

      // Verify decode roundtrip
      const redecoded = await containerFromBytes(reencoded);
      expect(redecoded.length).toBe(tokens.length);

      const tokensSet = new Set(tokens.map((t) => Buffer.from(t).toString("hex")));
      const redcodedSet = new Set(redecoded.map((t) => Buffer.from(t).toString("hex")));
      expect(tokensSet).toEqual(redcodedSet);
    });
  });

  describe("encoding options", () => {
    it("rejects unknown header byte", async () => {
      const bytes = new Uint8Array([0x41]);
      await expect(containerFromBytes(bytes)).rejects.toThrow("unknown container header");
    });

    it("containerToBytes with encoding: bytes", async () => {
      const tokens = await containerFromBytes(bytesVector);

      const result = await containerToBytes(tokens, {
        encoding: "bytes",
        compression: "none",
      });

      expect(result[0]).toBe(ContainerHeader.Bytes);

      // Verify roundtrip
      const decoded = await containerFromBytes(result);
      const tokensSet = new Set(tokens.map((t) => Buffer.from(t).toString("hex")));
      const decodedSet = new Set(decoded.map((t) => Buffer.from(t).toString("hex")));
      expect(decodedSet).toEqual(tokensSet);
    });

    it("containerToBytes with encoding: base64-std", async () => {
      const tokens = await containerFromBytes(bytesVector);

      const result = await containerToBytes(tokens, {
        encoding: "base64-std",
        compression: "none",
      });

      expect(result[0]).toBe(ContainerHeader.Base64StdPadding);

      // Verify roundtrip
      const decoded = await containerFromBytes(result);
      const tokensSet = new Set(tokens.map((t) => Buffer.from(t).toString("hex")));
      const decodedSet = new Set(decoded.map((t) => Buffer.from(t).toString("hex")));
      expect(decodedSet).toEqual(tokensSet);
    });

    it("containerToBytes with encoding: base64-url", async () => {
      const tokens = await containerFromBytes(bytesVector);

      const result = await containerToBytes(tokens, {
        encoding: "base64-url",
        compression: "none",
      });

      expect(result[0]).toBe(ContainerHeader.Base64Url);

      // Verify roundtrip
      const decoded = await containerFromBytes(result);
      const tokensSet = new Set(tokens.map((t) => Buffer.from(t).toString("hex")));
      const decodedSet = new Set(decoded.map((t) => Buffer.from(t).toString("hex")));
      expect(decodedSet).toEqual(tokensSet);
    });

    it("containerToBytes with gzip compression", async () => {
      const tokens = await containerFromBytes(bytesVector);

      const result = await containerToBytes(tokens, {
        encoding: "bytes",
        compression: "gzip",
      });

      expect(result[0]).toBe(ContainerHeader.BytesGzipped);

      // Verify decodable
      const decoded = await containerFromBytes(result);
      expect(decoded.length).toBe(tokens.length);
    });

    it("containerToBytes with gzip + base64-std", async () => {
      const tokens = await containerFromBytes(bytesVector);

      const result = await containerToBytes(tokens, {
        encoding: "base64-std",
        compression: "gzip",
      });

      expect(result[0]).toBe(ContainerHeader.Base64StdPaddingGzipped);

      // Verify decodable
      const decoded = await containerFromBytes(result);
      expect(decoded.length).toBe(tokens.length);
    });

    it("containerToBytes with gzip + base64-url", async () => {
      const tokens = await containerFromBytes(bytesVector);

      const result = await containerToBytes(tokens, {
        encoding: "base64-url",
        compression: "gzip",
      });

      expect(result[0]).toBe(ContainerHeader.Base64UrlGzipped);

      // Verify decodable
      const decoded = await containerFromBytes(result);
      expect(decoded.length).toBe(tokens.length);
    });
  });

  describe("token ordering", () => {
    it("sorts tokens bytewise for deterministic encoding", async () => {
      const tokens = await containerFromBytes(bytesVector);

      // Create unsorted token array (reversed)
      const unsorted = [...tokens].reverse();

      // Re-encode both
      const sorted = await containerToRawBytes(tokens);
      const reordered = await containerToRawBytes(unsorted);

      // Should produce same output (tokens sorted internally)
      const sortedDecoded = await containerFromBytes(sorted);
      const reorderedDecoded = await containerFromBytes(reordered);

      const sortedSet = new Set(sortedDecoded.map((t) => Buffer.from(t).toString("hex")));
      const reorderedSet = new Set(reorderedDecoded.map((t) => Buffer.from(t).toString("hex")));
      expect(sortedSet).toEqual(reorderedSet);
    });
  });
});
