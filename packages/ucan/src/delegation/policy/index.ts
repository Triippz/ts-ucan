/**
 * Policy module (Lane P).
 *
 * Placeholder file created by Lane C.
 * To be implemented by Lane P (delegation/policy.rs).
 */

import type { Ipld } from "../../ipld.js";

export type Predicate = any;
export type Filter = any;
export type Selector = any;
export type SelectorError = any;
export type Select<T = any> = any;
export type Selectable<T = any> = any;

export function runPredicate(p: Predicate, data: Ipld): boolean {
  throw new Error("Not yet implemented");
}

export function glob(input: string, pattern: string): boolean {
  throw new Error("Not yet implemented");
}

export function predicateToIpld(p: Predicate): Ipld {
  throw new Error("Not yet implemented");
}

export function ipldToPredicate(i: Ipld): Predicate {
  throw new Error("Not yet implemented");
}

export class RunError extends Error {
  constructor(readonly reason: string) {
    super(`run error: ${reason}`);
    this.name = "RunError";
  }
}

export class FromIpldError extends Error {
  constructor(readonly reason: string) {
    super(`from ipld error: ${reason}`);
    this.name = "FromIpldError";
  }
}

export function filterToString(f: Filter): string {
  throw new Error("Not yet implemented");
}

export function parseFilter(s: string): Filter {
  throw new Error("Not yet implemented");
}

export function filterIsIn(a: Filter, b: Filter): boolean {
  throw new Error("Not yet implemented");
}

export function filterIsDotField(f: Filter): boolean {
  throw new Error("Not yet implemented");
}

export function filterToIpld(f: Filter): Ipld {
  throw new Error("Not yet implemented");
}

export function ipldToFilter(i: Ipld): Filter {
  throw new Error("Not yet implemented");
}

export class filterParseError extends Error {
  constructor(readonly reason: string) {
    super(`filter parse error: ${reason}`);
  }
}
