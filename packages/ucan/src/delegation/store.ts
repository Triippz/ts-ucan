/**
 * Delegation store module (Lane E).
 *
 * Placeholder file created by Lane C.
 * To be implemented by Lane E (delegation/store.rs).
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
  d: Delegation<D>
): Promise<CID> {
  throw new Error("Not yet implemented");
}

export class MapDelegationStore<D extends Did = Did> implements DelegationStore<D> {
  private map = new Map<string, Delegation<D>>();

  async getAll(cids: CID[]): Promise<Delegation<D>[]> {
    throw new Error("Not yet implemented");
  }

  async insertByCid(cid: CID, delegation: Delegation<D>): Promise<void> {
    throw new Error("Not yet implemented");
  }
}

export class MissingError extends Error {
  constructor(readonly cid: CID) {
    super(`missing delegation: ${cid}`);
    this.name = "MissingError";
  }
}
