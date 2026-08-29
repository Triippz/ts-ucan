/**
 * Timestamp tests.
 */

import { describe, it, expect } from "vitest";
import { Timestamp, OutOfRangeError, TimestampFromIpldError } from "../src/time/index.js";

describe("Timestamp", () => {
  describe("construction", () => {
    it("can create from unix seconds", () => {
      const ts = Timestamp.fromUnix(1000);
      expect(ts.toUnix()).toBe(1000);
    });

    it("can create from Date", () => {
      const date = new Date(1000 * 1000); // 1000 seconds = 1000000 ms
      const ts = Timestamp.fromDate(date);
      expect(ts.toUnix()).toBe(1000);
    });

    it("rejects negative timestamps", () => {
      expect(() => Timestamp.fromUnix(-1)).toThrow(OutOfRangeError);
    });

    it("rejects fractional timestamps", () => {
      expect(() => Timestamp.fromUnix(1.5)).toThrow(OutOfRangeError);
    });

    it("rejects timestamps > 2^53-1", () => {
      const MAX_SAFE = BigInt(0x001f_ffff_ffff_ffff);
      expect(() => Timestamp.fromUnix(MAX_SAFE + 1n)).toThrow(OutOfRangeError);
    });

    it("accepts max safe value", () => {
      const MAX_SAFE = 0x001f_ffff_ffff_ffff;
      const ts = Timestamp.fromUnix(MAX_SAFE);
      expect(ts.toUnix()).toBe(MAX_SAFE);
    });
  });

  describe("postel_unix permissive path", () => {
    it("accepts values > 2^53 as bigint", () => {
      const BIG_VAL = 9007199254740992n; // 2^53
      const ts = Timestamp.postelUnix(BIG_VAL);
      expect(ts.toUnix()).toBe(BIG_VAL);
    });

    it("stores normal values as number", () => {
      const ts = Timestamp.postelUnix(1000);
      expect(typeof ts.toUnix()).toBe("number");
    });
  });

  describe("conversions", () => {
    it("can convert to/from Date", () => {
      const date = new Date("2023-01-01T00:00:00Z");
      const ts = Timestamp.fromDate(date);
      const date2 = ts.toDate();
      expect(date2.getTime()).toBe(date.getTime());
    });

    it("can convert to/from IPLD", () => {
      const ts = Timestamp.fromUnix(1000);
      const ipld = ts.toIpld();
      const ts2 = Timestamp.fromIpld(ipld);
      expect(ts.equals(ts2)).toBe(true);
    });

    it("strict fromIpld rejects values past 2^53-1", () => {
      expect(() => Timestamp.fromIpld(9007199254740992n)).toThrow(TimestampFromIpldError);
    });

    it("wire fromIpld accepts bigint values past 2^53-1", () => {
      const big = 9007199254740992n;
      const ts = Timestamp.fromWireIpld(big);
      expect(ts.toUnix()).toBe(big);
    });
  });

  describe("comparison", () => {
    it("can compare timestamps", () => {
      const ts1 = Timestamp.fromUnix(1000);
      const ts2 = Timestamp.fromUnix(2000);
      expect(ts1.compare(ts2)).toBe(-1);
      expect(ts2.compare(ts1)).toBe(1);
      expect(ts1.compare(ts1)).toBe(0);
    });

    it("compares number and bigint values consistently", () => {
      const ts1 = Timestamp.fromWireIpld(9007199254740992n);
      const ts2 = Timestamp.fromWireIpld(9007199254740993n);
      expect(ts1.compare(ts2)).toBe(-1);
      expect(ts2.compare(ts1)).toBe(1);
    });

    it("equals method works", () => {
      const ts1 = Timestamp.fromUnix(1000);
      const ts2 = Timestamp.fromUnix(1000);
      expect(ts1.equals(ts2)).toBe(true);
    });
  });

  describe("helpers", () => {
    it("now() returns recent timestamp", () => {
      const before = Math.floor(Date.now() / 1000);
      const ts = Timestamp.now();
      const after = Math.floor(Date.now() / 1000);
      const val = typeof ts.toUnix() === "number" ? ts.toUnix() : Number(ts.toUnix());
      expect(val).toBeGreaterThanOrEqual(before);
      expect(val).toBeLessThanOrEqual(after + 1);
    });

    it("fiveMinutesFromNow() returns future timestamp", () => {
      const now = Timestamp.now();
      const future = Timestamp.fiveMinutesFromNow();
      expect(now.compare(future)).toBe(-1);
    });

    it("fiveYearsFromNow() returns far future timestamp", () => {
      const now = Timestamp.now();
      const future = Timestamp.fiveYearsFromNow();
      expect(now.compare(future)).toBe(-1);
    });
  });

  describe("isExpired/isNotYetValid", () => {
    it("can check if expired", () => {
      const pastTs = Timestamp.fromUnix(1000);
      expect(pastTs.isExpired()).toBe(true);
    });

    it("can check if not yet valid", () => {
      const futureTs = Timestamp.fiveYearsFromNow();
      expect(futureTs.isNotYetValid()).toBe(true);
    });
  });

  describe("IPLD conversions", () => {
    it("rejects non-integer IPLD values", () => {
      expect(() => Timestamp.fromIpld("not an integer")).toThrow(TimestampFromIpldError);
      expect(() => Timestamp.fromIpld(null)).toThrow(TimestampFromIpldError);
    });

    it("accepts integer IPLD", () => {
      const ts = Timestamp.fromIpld(1000);
      expect(ts.toUnix()).toBe(1000);
    });
  });
});
