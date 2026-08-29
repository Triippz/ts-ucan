/**
 * Delegation subject helpers.
 */

import type { Ipld } from "../ipld.js";
import type { Did } from "../did.js";
import { Ed25519Did } from "../did.js";

export type DelegatedSubject<D extends Did = Did> =
  | { kind: "specific"; did: D }
  | { kind: "any" };

export function subjectAllows<D extends Did>(s: DelegatedSubject<D>, subject: D): boolean {
  return s.kind === "any" || s.did.equals(subject);
}

export function subjectCoherent<D extends Did>(a: DelegatedSubject<D>, b: DelegatedSubject<D>): boolean {
  return a.kind === "any" || b.kind === "any" || a.did.equals(b.did);
}

export function subjectToString<D extends Did>(s: DelegatedSubject<D>): string {
  return s.kind === "any" ? "Null" : s.did.toString();
}

export function subjectToIpld<D extends Did>(s: DelegatedSubject<D>): Ipld {
  return s.kind === "any" ? null : s.did.toString();
}

export function ipldToSubject<D extends Did>(i: Ipld): DelegatedSubject<D> {
  if (i == null) {
    return { kind: "any" };
  }
  if (typeof i === "string") {
    return { kind: "specific", did: Ed25519Did.fromString(i) as unknown as D };
  }
  throw new Error("expected DID string or null");
}
