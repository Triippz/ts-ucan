/**
 * Delegation store helpers.
 */

import { CID } from "multiformats/cid";
import type { Delegation } from "./index.js";
import type { Did } from "../did.js";

export interface DelegationStore<D extends Did = Did> {
  getAll(cids: CID[]): Promise<Delegation<D>[]>;
  insertByCid(cid: CID, delegation: Delegation<D>): Promise<void>;
}

export async function insert<D extends Did>(
  store: DelegationStore<D>,
  d: Delegation<D>,
): Promise<CID> {
  const cid = d.toCid();
  await store.insertByCid(cid, d);
  return cid;
}

export class MapDelegationStore<D extends Did = Did> implements DelegationStore<D> {
  private readonly map = new Map<string, Delegation<D>>();

  async getAll(cids: CID[]): Promise<Delegation<D>[]> {
    const delegations: Delegation<D>[] = [];
    for (const cid of cids) {
      const delegation = this.map.get(cid.toString());
      if (delegation === undefined) {
        throw new MissingError(cid);
      }
      delegations.push(delegation);
    }
    return delegations;
  }

  async insertByCid(cid: CID, delegation: Delegation<D>): Promise<void> {
    this.map.set(cid.toString(), delegation);
  }
}

export class MissingError extends Error {
  constructor(readonly cid: CID) {
    super(`delegation with cid ${cid} is missing`);
    this.name = "MissingError";
  }
}
