/**
 * Time-related errors.
 */

export class OutOfRangeError extends Error {
  constructor(readonly reason: "tooLarge" | "beforeEpoch") {
    const messages = {
      tooLarge: "timestamp out of range (too large)",
      beforeEpoch: "timestamp out of range (before epoch)",
    };
    super(messages[reason]);
    this.name = "OutOfRangeError";
  }
}

export class NumberIsNotATimestampError extends Error {
  constructor() {
    super("number is not a valid timestamp");
    this.name = "NumberIsNotATimestampError";
  }
}

export class TimeBoundError extends Error {
  constructor(readonly reason: "expired" | "notYetValid") {
    const messages = {
      expired: "timestamp has expired",
      notYetValid: "timestamp is not yet valid",
    };
    super(messages[reason]);
    this.name = "TimeBoundError";
  }
}

export class ExpiredError extends Error {
  constructor() {
    super("delegation has expired");
    this.name = "ExpiredError";
  }
}

export class TimestampFromIpldError extends Error {
  constructor(readonly reason: "notAnInteger" | "notATimestamp") {
    const messages = {
      notAnInteger: "timestamp is not an integer",
      notATimestamp: "value is not a valid timestamp",
    };
    super(messages[reason]);
    this.name = "TimestampFromIpldError";
  }
}
