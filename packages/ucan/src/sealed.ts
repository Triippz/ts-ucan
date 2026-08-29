/**
 * Sealed type aliases used by builders for compile-time tracking.
 *
 * These marker types mirror Rust sealed trait patterns for builder type states.
 * In TypeScript, they're just type aliases used as constraints on generics.
 */

import type { Did } from "./did.js";
import type { Command } from "./command.js";
import type { Unset } from "./unset.js";
import type { CID } from "multiformats/cid";

// DelegatedSubject will be defined in delegation/index.ts (Wave 2)
export type DelegatedSubject<D extends Did = Did> = any;

export type DidOrUnset<D extends Did = Did> = D | Unset;
export type DelegatedSubjectOrUnset<D extends Did = Did> = DelegatedSubject<D> | Unset;
export type CommandOrUnset = Command | Unset;
export type ProofsOrUnset = CID[] | Unset;
