/**
 * Envelope payload tag helpers.
 */

export interface PayloadTag {
  readonly specId: string;
  readonly version: string;
}

export function tagOf(t: PayloadTag): string {
  return `ucan/${t.specId}@${t.version}`;
}
