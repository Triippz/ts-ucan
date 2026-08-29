/**
 * Command tests.
 *
 * Ported from ucan/src/command.rs
 */

import { describe, it, expect } from "vitest";
import { Command, CommandParseError } from "../src/command.js";

describe("Command", () => {
  // Valid command examples
  describe("valid commands", () => {
    it("test_valid_root_command", () => {
      const cmd = Command.parse("/");
      expect(cmd.segments.length).toBe(0);
      expect(cmd.toString()).toBe("/");
    });

    it("test_valid_single_segment", () => {
      const cmd = Command.parse("/crud");
      expect(cmd.segments).toEqual(["crud"]);
      expect(cmd.toString()).toBe("/crud");
    });

    it("test_valid_two_segments", () => {
      const cmd = Command.parse("/crud/create");
      expect(cmd.segments).toEqual(["crud", "create"]);
      expect(cmd.toString()).toBe("/crud/create");
    });

    it("test_valid_many_segments", () => {
      const cmd = Command.parse("/foo/bar/baz/qux/quux");
      expect(cmd.segments).toEqual(["foo", "bar", "baz", "qux", "quux"]);
      expect(cmd.toString()).toBe("/foo/bar/baz/qux/quux");
    });

    it("test_valid_unicode", () => {
      const cmd = Command.parse("/ほげ/ふが");
      expect(cmd.segments).toEqual(["ほげ", "ふが"]);
      expect(cmd.toString()).toBe("/ほげ/ふが");
    });
  });

  // Invalid command examples
  describe("invalid commands", () => {
    it("test_invalid_missing_leading_slash", () => {
      expect(() => Command.parse("crud")).toThrow(CommandParseError);
      try {
        Command.parse("crud");
      } catch (e) {
        if (e instanceof CommandParseError) {
          expect(e.reason).toBe("missingLeadingSlash");
        }
      }
    });

    it("test_invalid_trailing_slash", () => {
      expect(() => Command.parse("/crud/")).toThrow(CommandParseError);
      try {
        Command.parse("/crud/");
      } catch (e) {
        if (e instanceof CommandParseError) {
          expect(e.reason).toBe("trailingSlash");
        }
      }
    });

    it("test_invalid_trailing_slash_nested", () => {
      expect(() => Command.parse("/crud/create/")).toThrow(CommandParseError);
      try {
        Command.parse("/crud/create/");
      } catch (e) {
        if (e instanceof CommandParseError) {
          expect(e.reason).toBe("trailingSlash");
        }
      }
    });

    it("test_invalid_uppercase", () => {
      expect(() => Command.parse("/CRUD")).toThrow(CommandParseError);
      try {
        Command.parse("/CRUD");
      } catch (e) {
        if (e instanceof CommandParseError) {
          expect(e.reason).toBe("notLowercase");
        }
      }
    });

    it("test_invalid_mixed_case", () => {
      expect(() => Command.parse("/Crud/Create")).toThrow(CommandParseError);
      try {
        Command.parse("/Crud/Create");
      } catch (e) {
        if (e instanceof CommandParseError) {
          expect(e.reason).toBe("notLowercase");
        }
      }
    });

    it("test_invalid_empty_segment", () => {
      expect(() => Command.parse("/crud//create")).toThrow(CommandParseError);
      try {
        Command.parse("/crud//create");
      } catch (e) {
        if (e instanceof CommandParseError) {
          expect(e.reason).toBe("emptySegment");
        }
      }
    });
  });

  // Roundtrip tests
  describe("roundtrips", () => {
    it("test_cbor_roundtrip", async () => {
      const cmd = Command.parse("/store/put");
      const ipld = cmd.toIpld();
      const cmd2 = Command.fromIpld(ipld);
      expect(cmd.equals(cmd2)).toBe(true);
    });

    it("test_cbor_roundtrip_root", async () => {
      const cmd = Command.parse("/");
      const ipld = cmd.toIpld();
      const cmd2 = Command.fromIpld(ipld);
      expect(cmd.equals(cmd2)).toBe(true);
    });
  });

  // startsWith tests
  describe("startsWith", () => {
    it("test_starts_with_root_matches_all", () => {
      const root = Command.parse("/");
      const cmd = Command.parse("/crypto/sign");
      expect(cmd.startsWith(root)).toBe(true);
    });

    it("test_starts_with_prefix_matches", () => {
      const prefix = Command.parse("/crypto");
      const cmd = Command.parse("/crypto/sign");
      expect(cmd.startsWith(prefix)).toBe(true);
    });

    it("test_starts_with_different_prefix_no_match", () => {
      const prefix = Command.parse("/crypto");
      const cmd = Command.parse("/stack/pop");
      expect(cmd.startsWith(prefix)).toBe(false);
    });

    it("test_starts_with_similar_prefix_no_match", () => {
      const prefix = Command.parse("/crypto");
      const cmd = Command.parse("/cryptocurrency");
      expect(cmd.startsWith(prefix)).toBe(false);
    });
  });
});
