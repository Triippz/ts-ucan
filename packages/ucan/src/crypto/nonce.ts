/**
 * Cryptographic nonce utilities.
 *
 * A nonce is a unique value used with a cryptographic function.
 * Known types: 128-bit (16-byte) nonce and custom (dynamic) nonces.
 */

import { getRandomValues } from "crypto";
import type { Ipld } from "../ipld.js";

/**
 * Cryptographic nonce.
 */
export class Nonce {
  readonly kind: "nonce16" | "custom";
  readonly bytes: Uint8Array;

  private constructor(kind: "nonce16" | "custom", bytes: Uint8Array) {
    this.kind = kind;
    this.bytes = bytes;
  }

  /**
   * Create a nonce from raw bytes.
   *
   * If bytes is exactly 16 bytes, a nonce16 is created;
   * otherwise a custom nonce is created.
   */
  static fromBytes(bytes: Uint8Array): Nonce {
    const kind = bytes.length === 16 ? "nonce16" : "custom";
    return new Nonce(kind, bytes);
  }

  /**
   * Generate a 128-bit, 16-byte nonce using crypto.getRandomValues.
   */
  static generate16(): Nonce {
    const bytes = new Uint8Array(16);
    getRandomValues(bytes);
    return new Nonce("nonce16", bytes);
  }

  /**
   * Convert to bytes.
   */
  toBytes(): Uint8Array {
    return this.bytes;
  }

  /**
   * Convert to hex string (lowercase, no 0x prefix).
   */
  toString(): string {
    return Array.from(this.bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  /**
   * Convert to IPLD (bytes).
   */
  toIpld(): Ipld {
    return this.bytes;
  }

  /**
   * Create from IPLD (bytes).
   */
  static fromIpld(ipld: Ipld): Nonce {
    if (!(ipld instanceof Uint8Array)) {
      throw new NoncesMustBeBytesError();
    }
    return Nonce.fromBytes(ipld);
  }

  /**
   * Check equality with another Nonce.
   *
   * Cross-variant equality: nonce16 === custom if bytes match.
   */
  equals(other: Nonce): boolean {
    if (this.bytes.length !== other.bytes.length) return false;
    for (let i = 0; i < this.bytes.length; i++) {
      if (this.bytes[i] !== other.bytes[i]) return false;
    }
    return true;
  }
}

/**
 * Error thrown when a nonce must be bytes.
 */
export class NoncesMustBeBytesError extends Error {
  constructor() {
    super("nonces must be byte arrays");
    this.name = "NoncesMustBeBytesError";
  }
}
