/**
 * UCAN Container module (v0.1.0).
 *
 * Implements container format for bundling signed DAG-CBOR token bytes.
 * §2.1: tokens serialized to DAG-CBOR, assembled in CBOR array, wrapped under "ctn-v1" key.
 * §2.2: optional gzip compression and/or base64 encoding with 1-byte header indicating variant.
 */

import * as dagCbor from "@ipld/dag-cbor";
import { gzip, gunzip } from "node:zlib";
import { promisify } from "node:util";

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

/**
 * Header byte values per spec §2.2 table.
 */
export enum ContainerHeader {
  Bytes = 0x40, // '@' - raw bytes, no compression
  Base64StdPadding = 0x42, // 'B' - base64 std, no compression
  Base64Url = 0x43, // 'C' - base64 url (no padding), no compression
  BytesGzipped = 0x4d, // 'M' - raw bytes, gzipped
  Base64StdPaddingGzipped = 0x4f, // 'O' - base64 std, gzipped
  Base64UrlGzipped = 0x50, // 'P' - base64 url, gzipped
}

export type CompressionAlgorithm = "gzip" | "none";
export type BaseEncoding = "bytes" | "base64-std" | "base64-url";

export interface ContainerOptions {
  compression?: CompressionAlgorithm;
  encoding?: BaseEncoding;
}

/**
 * Serialize tokens into a UCAN container with optional compression/encoding.
 *
 * §2.1: Tokens assembled in CBOR array under "ctn-v1" key, ordered bytewise.
 * §2.2: Result prepended with header byte, optionally compressed/encoded.
 *
 * @param tokens - Array of signed DAG-CBOR token bytes
 * @param options - Compression and encoding options (default: raw bytes)
 * @returns Container bytes with header prefix
 */
export async function containerToBytes(
  tokens: Uint8Array[],
  options?: ContainerOptions,
): Promise<Uint8Array> {
  const compression = options?.compression ?? "none";
  const encoding = options?.encoding ?? "bytes";

  // §2.1: Sort tokens bytewise and wrap in CBOR map under "ctn-v1"
  const sortedTokens = [...tokens].sort((a, b) => {
    for (let i = 0; i < Math.min(a.length, b.length); i++) {
      if (a[i] !== b[i]) return a[i] - b[i];
    }
    return a.length - b.length;
  });

  // Build CBOR structure: { "ctn-v1": [token1, token2, ...] }
  // dag-cbor encodes objects as maps; we pass a plain object.
  const containerMap = { "ctn-v1": sortedTokens };
  let cbor = dagCbor.encode(containerMap);

  // §2.2: Optional gzip compression
  if (compression === "gzip") {
    cbor = await gzipAsync(cbor);
  }

  // §2.2: Optional base64 encoding and select header
  let header: ContainerHeader;
  let payload: Uint8Array;

  if (encoding === "base64-std") {
    const b64String = Buffer.from(cbor).toString("base64");
    payload = new Uint8Array(Buffer.from(b64String));
    header = compression === "gzip" ? ContainerHeader.Base64StdPaddingGzipped : ContainerHeader.Base64StdPadding;
  } else if (encoding === "base64-url") {
    // §2.2: base64 URL without padding
    const b64 = Buffer.from(cbor).toString("base64");
    const b64url = b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
    payload = new Uint8Array(Buffer.from(b64url));
    header = compression === "gzip" ? ContainerHeader.Base64UrlGzipped : ContainerHeader.Base64Url;
  } else {
    // Raw bytes
    payload = cbor;
    header = compression === "gzip" ? ContainerHeader.BytesGzipped : ContainerHeader.Bytes;
  }

  // Prepend header byte
  const result = new Uint8Array(payload.length + 1);
  result[0] = header;
  result.set(payload, 1);

  return result;
}

/**
 * Deserialize tokens from a UCAN container.
 *
 * Reads header byte to determine compression/encoding, decodes payload,
 * extracts token array from "ctn-v1" key, and returns tokens.
 *
 * @param bytes - Container bytes with header prefix
 * @returns Array of token bytes
 * @throws If format is invalid or tokens cannot be extracted
 */
export async function containerFromBytes(bytes: Uint8Array): Promise<Uint8Array[]> {
  if (bytes.length < 1) {
    throw new Error("container bytes too short, need at least 1 byte for header");
  }

  const header = bytes[0];
  const payload = bytes.slice(1);

  let cbor = payload;
  let isGzipped = false;

  switch (header) {
    case ContainerHeader.Bytes:
      break;
    case ContainerHeader.Base64StdPadding:
      cbor = new Uint8Array(Buffer.from(Buffer.from(payload).toString("utf-8"), "base64"));
      break;
    case ContainerHeader.Base64Url: {
      let b64url = Buffer.from(payload).toString("utf-8");
      const padding = (4 - (b64url.length % 4)) % 4;
      b64url += "=".repeat(padding);
      const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
      cbor = new Uint8Array(Buffer.from(b64, "base64"));
      break;
    }
    case ContainerHeader.BytesGzipped:
      isGzipped = true;
      break;
    case ContainerHeader.Base64StdPaddingGzipped:
      isGzipped = true;
      cbor = new Uint8Array(Buffer.from(Buffer.from(payload).toString("utf-8"), "base64"));
      break;
    case ContainerHeader.Base64UrlGzipped: {
      let b64url = Buffer.from(payload).toString("utf-8");
      const padding = (4 - (b64url.length % 4)) % 4;
      b64url += "=".repeat(padding);
      const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
      cbor = new Uint8Array(Buffer.from(b64, "base64"));
      isGzipped = true;
      break;
    }
    default:
      throw new Error(`unknown container header 0x${header.toString(16).padStart(2, "0")}`);
  }

  if (isGzipped) {
    cbor = await gunzipAsync(cbor);
  }

  // §2.1: Decode CBOR and extract tokens from "ctn-v1" key
  const decoded = dagCbor.decode(cbor);

  if (typeof decoded !== "object" || decoded === null || Array.isArray(decoded)) {
    throw new Error('container must be a CBOR map with exactly one key "ctn-v1"');
  }
  const keys = Object.keys(decoded as Record<string, unknown>);
  if (keys.length !== 1 || !Object.prototype.hasOwnProperty.call(decoded, "ctn-v1")) {
    throw new Error('container must be a CBOR map with exactly one key "ctn-v1"');
  }

  const tokens = (decoded as Record<string, any>)["ctn-v1"];
  if (!Array.isArray(tokens)) {
    throw new Error('"ctn-v1" must be an array');
  }

  // Ensure all elements are Uint8Array (DAG-CBOR encodes bytes as Uint8Array)
  for (const token of tokens) {
    if (!(token instanceof Uint8Array)) {
      throw new Error("all tokens in container must be byte arrays");
    }
  }

  return tokens;
}

/**
 * Convenience wrapper: containerToBytes with base64-std encoding.
 */
export function containerToBase64StdPadding(
  tokens: Uint8Array[],
  gzipped = false,
): Promise<Uint8Array> {
  return containerToBytes(tokens, {
    encoding: "base64-std",
    compression: gzipped ? "gzip" : "none",
  });
}

/**
 * Convenience wrapper: containerToBytes with base64-url encoding.
 */
export function containerToBase64Url(tokens: Uint8Array[], gzipped = false): Promise<Uint8Array> {
  return containerToBytes(tokens, {
    encoding: "base64-url",
    compression: gzipped ? "gzip" : "none",
  });
}

/**
 * Convenience wrapper: containerToBytes with gzip only (raw bytes).
 */
export function containerToBytesGzipped(tokens: Uint8Array[]): Promise<Uint8Array> {
  return containerToBytes(tokens, { compression: "gzip" });
}

/**
 * Convenience wrapper: containerToBytes with no encoding/compression (raw bytes).
 */
export function containerToRawBytes(tokens: Uint8Array[]): Promise<Uint8Array> {
  return containerToBytes(tokens);
}

/**
 * Convenience wrapper accepting Delegation/Invocation instances.
 *
 * Each token is encoded via its .encode() method before bundling.
 */
export async function containerFromTokens(
  tokens: Array<{ encode(): Uint8Array }>,
  options?: ContainerOptions,
): Promise<Uint8Array> {
  const encoded = tokens.map((t) => t.encode());
  return containerToBytes(encoded, options);
}
