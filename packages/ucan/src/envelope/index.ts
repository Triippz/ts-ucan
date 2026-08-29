/**
 * Envelope module.
 */

import type { Ipld } from "../ipld.js";
import { Varsig, type TryFromTags, type Verify } from "@marktripoli/varsig";
import { tagOf } from "./payloadTag.js";

export { tagOf } from "./payloadTag.js";
export type { PayloadTag } from "./payloadTag.js";

export interface EnvelopePayload<V extends Verify<any>, T> {
  readonly header: Varsig<V>;
  readonly payload: T;
  /** The wire tag key from decode (e.g. "ucan/dlg@1.0.0-rc.1"), preserved for exact roundtrip.  */
  readonly tag?: string;
}

export interface Envelope<V extends Verify<any>, T> {
  readonly signature: Uint8Array;
  readonly payload: EnvelopePayload<V, T>;
}

export function envelopeToIpld<V extends Verify<any>, T>(
  e: Envelope<V, T>,
  tag: import("./payloadTag.js").PayloadTag,
  payloadToIpld: (t: T) => Ipld,
): Ipld {
  // Use stored tag from decode for exact roundtrip, otherwise compute from PayloadTag
  const tagString = e.payload.tag ?? tagOf(tag);
  return [
    e.signature,
    new Map<string, Ipld>([
      ["h", e.payload.header.encode()],
      [tagString, payloadToIpld(e.payload.payload)],
    ]),
  ];
}

export function envelopeFromIpld<V extends Verify<any>, T>(
  ipld: Ipld,
  ipldToPayload: (i: Ipld) => T,
  tryFromTags: TryFromTags<V>,
): Envelope<V, T> {
  if (!Array.isArray(ipld) || ipld.length !== 2) {
    throw new Error("expected envelope to be a 2-tuple");
  }

  const [signatureIpld, payloadIpld] = ipld;
  if (!(signatureIpld instanceof Uint8Array)) {
    throw new Error("expected signature to be bytes");
  }
  if (!(payloadIpld instanceof Map)) {
    throw new Error("expected envelope payload to be a map");
  }

  let headerBytes: Uint8Array | undefined;
  let payloadValue: Ipld | undefined;
  let sawPayload = false;
  // Preserve the original tag key for byte-exact roundtrip of decoded tokens
  let tagKey: string | undefined;

  for (const [key, value] of payloadIpld) {
    if (key === "h") {
      if (headerBytes !== undefined) {
        throw new Error("duplicate field h");
      }
      if (!(value instanceof Uint8Array)) {
        throw new Error("expected varsig header to be bytes");
      }
      headerBytes = value;
      continue;
    }

    if (sawPayload) {
      throw new Error("multiple payload fields");
    }
    sawPayload = true;
    payloadValue = value;
    tagKey = key;
  }

  if (headerBytes === undefined) {
    throw new Error("missing field h");
  }
  if (!sawPayload) {
    throw new Error("missing payload");
  }

  const header = Varsig.decode(headerBytes, tryFromTags);
  header.verifierCfg.tryDecodeSignature(signatureIpld);
  return {
    signature: signatureIpld,
    payload: {
      header,
      payload: ipldToPayload(payloadValue!),
      tag: tagKey,
    },
  };
}
