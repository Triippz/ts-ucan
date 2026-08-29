import { describe, it, expect } from "vitest";
import { Selector, ParseError } from "../src/index.js";

describe("Selector.isRelated", () => {
  it("treats prefix selectors as related", () => {
    expect(Selector.fromString(".foo").isRelated(Selector.fromString(".foo.bar"))).toBe(true);
  });

  it("treats empty selector as related to any prefix", () => {
    expect(Selector.fromString(".").isRelated(Selector.fromString(".foo.bar"))).toBe(true);
  });
});

describe("Selector serialization", () => {
  it("testBareDot", () => {
    expect(Selector.fromString(".")).toEqual(new Selector([]));  
  });

  it("testDotTry", () => {
    expect(Selector.fromString(".?")).toEqual(new Selector([]));  
  });

  it("testDotManyTries", () => {
    expect(Selector.fromString(".?????????????????????")).toEqual(new Selector([]));  
  });

  it("testInnerTryIsNull", () => {
    const expected = new Selector([
      { kind: "try", inner: { kind: "field", key: "nope" } },
      { kind: "field", key: "not" },
    ]);
    expect(Selector.fromString(".nope?.not")).toEqual(expected);  
  });

  it("testDotManyTriesAndDotField", () => {
    const expected = new Selector([{ kind: "field", key: "foo" }]);
    expect(Selector.fromString(".?????????????????????.foo")).toEqual(expected);  
  });

  it("testMultipleQuestionMarks", () => {
    const expected = new Selector([
      { kind: "try", inner: { kind: "field", key: "foo" } },
    ]);
    expect(Selector.fromString(".foo??????????????")).toEqual(expected);  
  });

  it("testFailsTrailingDot", () => {
    expect(() => Selector.fromString(".foo.")).toThrow(ParseError);  
  });

  it("testFailsLeadingDoubleDot", () => {
    expect(() => Selector.fromString("..foo")).toThrow(ParseError);  
  });

  it("testFailsInnerDoubleDot", () => {
    expect(() => Selector.fromString(".foo..bar")).toThrow(ParseError);  
  });

  it("testFailsMultipleLeadingDots", () => {
    expect(() => Selector.fromString("..")).toThrow(ParseError);  
  });

  it("testFailMissingLeadingDot", () => {
    expect(() => Selector.fromString("[22]")).toThrow(ParseError);  
  });

  it("testDotField", () => {
    const expected = new Selector([{ kind: "field", key: "foo" }]);
    expect(Selector.fromString(".foo")).toEqual(expected);  
  });

  it("testMultipleDotFields", () => {
    const expected = new Selector([
      { kind: "field", key: "foo" },
      { kind: "field", key: "bar" },
      { kind: "field", key: "baz" },
    ]);
    expect(Selector.fromString(".foo.bar.baz")).toEqual(expected);  
  });

  it("testFairlyComplex", () => {
    const expected = new Selector([
      { kind: "field", key: "foo" },
      { kind: "field", key: "bar" },
      { kind: "values" },
      { kind: "field", key: "baz" },
      { kind: "arrayIndex", index: 0 },
      { kind: "values" },
      { kind: "field", key: "42" },
      { kind: "try", inner: { kind: "field", key: "_quux" } },
      { kind: "arrayIndex", index: 8 },
    ]);
    expect(Selector.fromString(`.foo.bar[].baz[0][]["42"]._quux?[8]`)).toEqual(expected);  
  });

  it("testVeryComplex", () => {
    const expected = new Selector([
      { kind: "field", key: "foo" },
      { kind: "field", key: "bar" },
      { kind: "values" },
      { kind: "field", key: "baz" },
      { kind: "arrayIndex", index: 0 },
      { kind: "values" },
      { kind: "field", key: "42" },
      { kind: "try", inner: { kind: "field", key: "_quux" } },
      { kind: "arrayIndex", index: 8 },
    ]);
    expect(Selector.fromString(`.???.foo.bar[].baz[0][]["42"]._quux??[8]`)).toEqual(expected);  
  });
});
