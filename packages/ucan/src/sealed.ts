/**
 * Sealed type aliases used by builders for compile-time tracking.
 *
 * These marker types mirror Rust sealed trait patterns for builder type states.
 * In TypeScript, they're just type aliases used as constraints on generics.
 */

import type { Did, DidSigner } from "./did.js";
import type { Command } from "./command.js";
import type { Unset } from "./unset.js";
import type { CID } from "multiformats/cid";
import type { DelegatedSubject as DelegatedSubjectType } from "./delegation/subject.js";

export type DelegatedSubject<D extends Did = Did> = DelegatedSubjectType<D>;

export type DidOrUnset<D extends Did = Did> = D | Unset;
export type DidSignerOrUnset<D extends DidSigner = DidSigner> = D | Unset;
export type DelegatedSubjectOrUnset<D extends Did = Did> = DelegatedSubject<D> | Unset;
export type CommandOrUnset = Command | Unset;
export type ProofsOrUnset = CID[] | Unset;
