/**
 * Envelope module (Lane E).
 *
 * Placeholder file created by Lane C.
 * To be implemented by Lane E (envelope.rs).
 */

import type { Ipld } from "../ipld.js";
import type { Verify } from "@ucans/varsig";
import type { TryFromTags } from "@ucans/varsig";

export interface PayloadTag {
  specId: string;
  version: string;
}

export function tagOf(t: PayloadTag): string {
  return `ucan/${t.specId}@${t.version}`;
}

export interface EnvelopePayload<V extends Verify<any>, T> {
  header: any; // Varsig<V>
  payload: T;
}

export interface Envelope<V extends Verify<any>, T> {
  signature: Uint8Array;
  payload: EnvelopePayload<V, T>;
}

export function envelopeToIpld<V extends Verify<any>, T>(
  e: Envelope<V, T>,
  tag: PayloadTag,
  payloadToIpld: (t: T) => Ipld
): Ipld {
  throw new Error("Not yet implemented");
}

export function envelopeFromIpld<V extends Verify<any>, T>(
  ipld: Ipld,
  ipldToPayload: (i: Ipld) => T,
  tryFromTags: TryFromTags<V>
): Envelope<V, T> {
  throw new Error("Not yet implemented");
}
