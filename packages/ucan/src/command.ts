/**
 * Command helpers.
 *
 * Commands MUST be lowercase, and begin with a slash (`/`).
 * Segments MUST be separated by a slash.
 * A trailing slash MUST NOT be present.
 */

import type { Ipld } from "./ipld.js";

export type CommandParseErrorReason =
  | "missingLeadingSlash"
  | "trailingSlash"
  | "notLowercase"
  | "emptySegment";

/**
 * Error type for Command.parse failures.
 */
export class CommandParseError extends Error {
  constructor(readonly reason: CommandParseErrorReason) {
    const messages: Record<CommandParseErrorReason, string> = {
      missingLeadingSlash: "command must begin with a slash",
      trailingSlash: "command must not have a trailing slash",
      notLowercase: "command must be lowercase",
      emptySegment: "command segments must not be empty",
    };
    super(messages[reason]);
    this.name = "CommandParseError";
  }
}

/**
 * Command type representing a sequence of command segments.
 *
 * Commands are `/`-delimited paths that describe a set of commands.
 * Examples: `/`, `/crud`, `/crud/create`, `/msg/send`.
 */
export class Command {
  constructor(readonly segments: string[]) {}

  /**
   * Parse a command string into a Command.
   *
   * Returns error if:
   * - Missing leading slash
   * - Has trailing slash (except for root `/`)
   * - Contains uppercase characters
   * - Contains empty segments
   */
  static parse(s: string): Command {
    // Must begin with a slash
    if (!s.startsWith("/")) {
      throw new CommandParseError("missingLeadingSlash");
    }

    // Root command "/" is valid
    if (s === "/") {
      return new Command([]);
    }

    // Must not have trailing slash (except root)
    if (s.endsWith("/")) {
      throw new CommandParseError("trailingSlash");
    }

    // Must be lowercase
    if (s !== s.toLowerCase()) {
      throw new CommandParseError("notLowercase");
    }

    // Parse segments (skip first empty segment from leading slash)
    const segments = s.slice(1).split("/");

    // Check for empty segments
    if (segments.some((seg) => seg === "")) {
      throw new CommandParseError("emptySegment");
    }

    return new Command(segments);
  }

  /**
   * Check if this command starts with the given prefix.
   */
  startsWith(prefix: Command): boolean {
    if (prefix.segments.length > this.segments.length) {
      return false;
    }
    for (let i = 0; i < prefix.segments.length; i++) {
      if (this.segments[i] !== prefix.segments[i]) {
        return false;
      }
    }
    return true;
  }

  /**
   * Convert to string representation.
   */
  toString(): string {
    if (this.segments.length === 0) {
      return "/";
    }
    return "/" + this.segments.join("/");
  }

  /**
   * Convert to IPLD (string form).
   */
  toIpld(): Ipld {
    return this.toString();
  }

  /**
   * Create from IPLD (string).
   */
  static fromIpld(ipld: Ipld): Command {
    if (typeof ipld !== "string") {
      throw new Error("Expected string for Command");
    }
    return Command.parse(ipld);
  }

  /**
   * Check equality with another Command.
   */
  equals(other: Command): boolean {
    if (this.segments.length !== other.segments.length) return false;
    return this.segments.every((s, i) => s === other.segments[i]);
  }
}
