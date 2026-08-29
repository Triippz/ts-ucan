/**
 * Selector error types.
 *
 * Port of selector/error.rs.
 */

/**
 * Error type for parsing a selector or filter.
 */
export class ParseError extends Error {
  readonly reason: "trailingInput" | "unknownPattern" | "missingStartingDot" | "startsWithDoubleDot";

  /** The offending input string (Rust variants carry it; needed for serde roundtrip). */
  readonly input: string;

  constructor(
    reason: "trailingInput" | "unknownPattern" | "missingStartingDot" | "startsWithDoubleDot",
    input: string,
  ) {
    const messages: Record<ParseError["reason"], string> = {
      trailingInput: `unmatched trailing input: ${input}`,
      unknownPattern: `unknown pattern: ${input}`,
      missingStartingDot: `missing starting dot: ${input}`,
      startsWithDoubleDot: `starts with double dot: ${input}`,
    };
    super(messages[reason]);
    this.name = "ParseError";
    this.reason = reason;
    this.input = input;
  }
}

/**
 * Selector error reason when selecting into a concrete value.
 */
export type SelectorErrorReason =
  | "indexOutOfBounds"
  | "keyNotFound"
  | "notAList"
  | "notAMap"
  | "notACollection"
  | "notANumber"
  | "notAString";

/**
 * Serialize ParseError to Ipld (externally tagged with input string).
 *
 * Port of the derived Serialize in selector/error.rs:8-24.
 * e.g. {"TrailingInput": "..."} etc.
 */
export function parseErrorToIpld(e: ParseError): Map<string, string> {
  const tag = e.reason === "trailingInput" ? "TrailingInput"
    : e.reason === "unknownPattern" ? "UnknownPattern"
    : e.reason === "missingStartingDot" ? "MissingStartingDot"
    : "StartsWithDoubleDot";
  return new Map([[tag, e.input]]);
}

/**
 * Deserialize Ipld to ParseError.
 *
 * Port of derived Deserialize in selector/error.rs.
 */
export function ipldToParseError(i: unknown): ParseError {
  if (!(i instanceof Map) || i.size !== 1) {
    throw new Error("expected externally-tagged ParseError map");
  }
  for (const [tag, input] of i) {
    if (typeof input !== "string") {
      throw new Error("expected string input in ParseError");
    }
    switch (tag) {
      case "TrailingInput":
        return new ParseError("trailingInput", input);
      case "UnknownPattern":
        return new ParseError("unknownPattern", input);
      case "MissingStartingDot":
        return new ParseError("missingStartingDot", input);
      case "StartsWithDoubleDot":
        return new ParseError("startsWithDoubleDot", input);
      default:
        throw new Error(`unknown ParseError variant: ${tag}`);
    }
  }
  throw new Error("empty ParseError map");
}

/**
 * Serialize SelectorErrorReason to Ipld.
 *
 * Port of derived Serialize in selector/error.rs:26-37.
 * Wire form: Rust variant-name strings, e.g. "IndexOutOfBounds".
 */
export function selectorErrorReasonToIpld(r: SelectorErrorReason): string {
  switch (r) {
    case "indexOutOfBounds": return "IndexOutOfBounds";
    case "keyNotFound": return "KeyNotFound";
    case "notAList": return "NotAList";
    case "notAMap": return "NotAMap";
    case "notACollection": return "NotACollection";
    case "notANumber": return "NotANumber";
    case "notAString": return "NotAString";
  }
}

/**
 * Deserialize Ipld to SelectorErrorReason.
 */
export function ipldToSelectorErrorReason(i: unknown): SelectorErrorReason {
  if (typeof i !== "string") {
    throw new Error("expected string for SelectorErrorReason");
  }
  switch (i) {
    case "IndexOutOfBounds": return "indexOutOfBounds";
    case "KeyNotFound": return "keyNotFound";
    case "NotAList": return "notAList";
    case "NotAMap": return "notAMap";
    case "NotACollection": return "notACollection";
    case "NotANumber": return "notANumber";
    case "NotAString": return "notAString";
    default:
      throw new Error(`unknown SelectorErrorReason: ${i}`);
  }
}