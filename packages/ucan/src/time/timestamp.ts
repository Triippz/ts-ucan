/**
 * Timestamp with safe JavaScript interop.
 *
 * Timestamps MUST respect IEEE-754 (64-bit double precision) for JS interop.
 * Maximum safe range: 2^53 - 1 seconds (about 285 million years).
 *
 * Internally can store values up to u64::MAX for Postel deserialization.
 */

import type { Ipld } from "../ipld.js";
import {
  OutOfRangeError,
  TimestampFromIpldError,
  TimeBoundError,
} from "./error.js";

const MAX_SAFE_TIMESTAMP = 0x001f_ffff_ffff_ffff;
const MAX_U64 = (1n << 64n) - 1n;

function toNonNegativeInteger(secs: number | bigint): bigint {
  if (typeof secs === "number") {
    if (!Number.isInteger(secs)) {
      throw new OutOfRangeError("beforeEpoch");
    }
    if (!Number.isFinite(secs) || secs < 0) {
      throw new OutOfRangeError("beforeEpoch");
    }
    return BigInt(secs);
  }
  if (secs < 0n) {
    throw new OutOfRangeError("beforeEpoch");
  }
  return secs;
}

/**
 * A Unix timestamp in seconds.
 */
export class Timestamp {
  private secs: number | bigint;

  private constructor(secs: number | bigint) {
    this.secs = secs;
  }

  /**
   * Create from Unix seconds.
   *
   * Enforces the 2^53-1 bound for safe JavaScript interop.
   *
   * Throws OutOfRangeError if value exceeds bounds or is negative.
   */
  static fromUnix(secs: number | bigint): Timestamp {
    const val = toNonNegativeInteger(secs);

    if (val > BigInt(MAX_SAFE_TIMESTAMP)) {
      throw new OutOfRangeError("tooLarge");
    }

    return new Timestamp(Number(val));
  }

  /**
   * Create from JavaScript Date.
   *
   * Throws OutOfRangeError if the date is before epoch or exceeds bounds.
   */
  static fromDate(date: Date): Timestamp {
    const ms = date.getTime();
    if (ms < 0) {
      throw new OutOfRangeError("beforeEpoch");
    }
    const secs = Math.floor(ms / 1000);
    return Timestamp.fromUnix(secs);
  }

  /**
   * Get current time as Timestamp.
   */
  static now(): Timestamp {
    return Timestamp.fromDate(new Date());
  }

  /**
   * Get Timestamp 5 minutes from now.
   */
  static fiveMinutesFromNow(): Timestamp {
    return Timestamp.fromDate(
      new Date(Date.now() + 5 * 60 * 1000)
    );
  }

  /**
   * Get Timestamp 5 years from now.
   */
  static fiveYearsFromNow(): Timestamp {
    return Timestamp.fromDate(
      new Date(Date.now() + 5 * 365 * 24 * 60 * 60 * 1000)
    );
  }

  /**
   * Permissive constructor for deserialization.
   *
   * Skips the 2^53 bound check (Postel's law).
   * Preserves values through u64::MAX as bigint.
   */
  static postelUnix(secs: number | bigint): Timestamp {
    const val = toNonNegativeInteger(secs);

    if (val > MAX_U64) {
      throw new OutOfRangeError("tooLarge");
    }

    return new Timestamp(val <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(val) : val);
  }

  /**
   * Convert to Unix seconds.
   *
   * Returns number if <= 2^53-1, bigint otherwise.
   */
  toUnix(): number | bigint {
    return this.secs;
  }

  /**
   * Convert to JavaScript Date.
   *
   * Throws OutOfRangeError if the value in milliseconds would exceed 2^53.
   */
  toDate(): Date {
    // Max seconds that fit in JS Date (2^53 / 1000)
    const MAX_SAFE_SECS = 0x001f_ffff_ffff_ffff / 1000;

    const secsNum =
      typeof this.secs === "number" ? this.secs : Number(this.secs);

    if (secsNum > MAX_SAFE_SECS) {
      throw new OutOfRangeError("tooLarge");
    }

    return new Date(secsNum * 1000);
  }

  /**
   * Convert to IPLD (integer seconds).
   */
  toIpld(): Ipld {
    return this.secs;
  }

  /**
   * Create from IPLD integer.
   *
   * Uses postelUnix path (no 2^53 bound).
   */
  static fromIpld(ipld: Ipld): Timestamp {
    if (typeof ipld === "number") {
      if (!Number.isInteger(ipld)) {
        throw new TimestampFromIpldError("notAnInteger");
      }
    } else if (typeof ipld !== "bigint") {
      throw new TimestampFromIpldError("notAnInteger");
    }

    try {
      return Timestamp.postelUnix(ipld as number | bigint);
    } catch {
      throw new TimestampFromIpldError("notATimestamp");
    }
  }

  /**
   * Check equality.
   */
  equals(other: Timestamp): boolean {
    return this.compare(other) === 0;
  }

  /**
   * Compare with another Timestamp.
   *
   * Returns -1 if this < other, 0 if equal, 1 if this > other.
   */
  compare(other: Timestamp): -1 | 0 | 1 {
    const a = typeof this.secs === "number" ? BigInt(this.secs) : this.secs;
    const b = typeof other.secs === "number" ? BigInt(other.secs) : other.secs;

    if (a < b) return -1;
    if (a > b) return 1;
    return 0;
  }

  /**
   * Check if this timestamp has expired (is before now).
   */
  isExpired(): boolean {
    const now = Timestamp.now();
    return this.compare(now) < 0;
  }

  /**
   * Check if this timestamp is in the future.
   */
  isNotYetValid(): boolean {
    const now = Timestamp.now();
    return this.compare(now) > 0;
  }
}
