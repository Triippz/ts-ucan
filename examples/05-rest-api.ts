/**
 * UCAN over HTTP: a service accepts a note-creation invocation plus proof
 * bytes in headers.
 *
 * The user is the subject of the invocation; the service is the executor.
 * The server checks the delegation chain and revocations before creating a note.
 * This example shows success, policy failure, and revocation failure over one
 * REST route.
 *
 * Run:
 *   node examples/05-rest-api.ts
 */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import {
  Command,
  DelegationBuilder,
  Delegation,
  Ed25519Signer,
  Invocation,
  InvocationBuilder,
  MapDelegationStore,
  MapReplayStore,
  MapRevocationStore,
  RevokedError,
  StoredCheckError,
  VerifyError,
  insert,
  ipldToPredicate,
  revoke,
  verifyInvocation,
} from "@marktripoli/ucan";

function signer(seed: number): Ed25519Signer {
  return new Ed25519Signer(new Uint8Array(32).fill(seed));
}

const service = signer(10);
const user = signer(11);
const routeCommand = Command.parse("/notes/create");
const notePolicy = ipldToPredicate(["like", ".title", "draft:*"]);

const delegationStore = new MapDelegationStore();
const revocationStore = new MapRevocationStore();
// Persistent replay store: the executor MUST reject a repeated invocation CID
// (spec §Replay Attack Prevention).
const replayStore = new MapReplayStore();
const notes = new Map<string, { title: string; body: string }>();

// The service grants note creation, but only for draft titles.
const delegation = new DelegationBuilder()
  .issuer(service)
  .audience(user.did)
  .subject({ kind: "specific", did: service.did })
  .command(routeCommand)
  .policy([notePolicy])
  .tryBuild();

const delegationCid = delegation.toCid();
// Encode the proof once for header transport.
const delegationWire = Buffer.from(delegation.encode()).toString("base64url");

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    if (request.method !== "POST" || url.pathname !== "/notes") {
      response.statusCode = 404;
      response.end("not found");
      return;
    }

    // Require both the invocation and the proof header before doing any work.
    const authorization = request.headers.authorization;
    const proofsHeader = request.headers["x-ucan-proofs"];
    if (typeof authorization !== "string" || !authorization.startsWith("Bearer ")) {
      response.statusCode = 403;
      response.end("forbidden");
      return;
    }
    if (typeof proofsHeader !== "string" || proofsHeader.length === 0) {
      response.statusCode = 403;
      response.end("forbidden");
      return;
    }

    const invocationBytes = new Uint8Array(Buffer.from(authorization.slice(7), "base64url"));
    const proofBytes = proofsHeader.split(",").filter(Boolean).map((token) => new Uint8Array(Buffer.from(token, "base64url")));

    // Decode the transported proofs so the server can verify the chain.
    for (const bytes of proofBytes) {
      const proof = Delegation.decode(bytes);
      await insert(delegationStore, proof);
    }

    const invocation = Invocation.decode(invocationBytes);
    // The route only accepts the UCAN command it was built for.
    if (!invocation.command.equals(routeCommand)) {
      response.statusCode = 403;
      response.end("forbidden");
      return;
    }

    // Full authorization: verifyInvocation() authenticates the invocation and
    // every proof signature, recomputes proof CIDs, requires the executor to be
    // the audience (`service.did`), runs the time/chain/command/predicate
    // checks, applies revocations, and claims the CID for replay prevention.
    // (`check`/`checkWithRevocations` are semantic-only and MUST NOT be used as
    // the authorization gate — they verify no signatures.)
    //
    // IMPORTANT: execute from the RETURNED authenticated snapshot, never the
    // decoded input, whose fields a hostile store could have mutated mid-verify.
    const verified = await verifyInvocation(invocation, delegationStore, {
      executor: service.did,
      replayStore,
      revocationStore,
    });

    const title = String(verified.arguments.get("title"));
    const body = String(verified.arguments.get("body") ?? "");
    const id = String(notes.size + 1);
    notes.set(id, { title, body });

    response.statusCode = 201;
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify({ id }));
  } catch (error) {
    // Any authorization failure (bad signature/CID/audience/replay, or a
    // time/chain/command/predicate/revocation failure) is a 403.
    if (error instanceof VerifyError || error instanceof StoredCheckError || error instanceof RevokedError) {
      response.statusCode = 403;
      response.end("forbidden");
      return;
    }
    response.statusCode = 500;
    response.end("internal error");
  }
});

await new Promise<void>((resolve) => {
  server.listen(0, "127.0.0.1", resolve);
});

const address = server.address();
assert.ok(address && typeof address !== "string");
const baseUrl = `http://127.0.0.1:${address.port}`;
console.log("server   :", baseUrl);

try {
  const makeRequest = async (title: string) => {
    const invocation = new InvocationBuilder()
      .issuer(user)
      .audience(service.did)
      .subject(service.did)
      .command(routeCommand)
      .arguments(new Map([
        ["title", title],
        ["body", "hello from a browser, queue, or CLI"],
      ]))
      .proofs([delegationCid])
      .tryBuild();

    const response = await fetch(`${baseUrl}/notes`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${Buffer.from(invocation.encode()).toString("base64url")}`,
        "X-UCAN-Proofs": delegationWire,
      },
      body: "",
    });

    return response;
  };

  // Success path: a draft title satisfies the delegation policy.
  const accepted = await makeRequest("draft:first note");
  assert.equal(accepted.status, 201);
  assert.equal(notes.size, 1);
  assert.deepEqual(notes.get("1"), {
    title: "draft:first note",
    body: "hello from a browser, queue, or CLI",
  });
  console.log("POST /notes 201 ✓");

  // A forged invocation with a flipped signature byte must be rejected. This is
  // exactly what a semantic-only check would have accepted, so it proves the
  // authorization gate authenticates signatures.
  {
    const forged = new InvocationBuilder()
      .issuer(user).audience(service.did).subject(service.did).command(routeCommand)
      .arguments(new Map([["title", "draft:forged"], ["body", "x"]]))
      .proofs([delegationCid]).tryBuild();
    const bytes = forged.encode();
    bytes[4] ^= 0x01; // flip a byte inside the 64-byte signature
    const response = await fetch(`${baseUrl}/notes`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${Buffer.from(bytes).toString("base64url")}`,
        "X-UCAN-Proofs": delegationWire,
      },
      body: "",
    });
    assert.equal(response.status, 403);
    assert.equal(notes.size, 1);
    console.log("POST /notes forged signature => 403 ✓");
  }

  // The same route rejects a title that misses the policy.
  const rejectedByPolicy = await makeRequest("published:not allowed");
  assert.equal(rejectedByPolicy.status, 403);
  assert.equal(notes.size, 1);
  console.log("POST /notes policy violation => 403 ✓");

  // Revoke the proof, then keep the route behavior unchanged.
  const revocation = revoke(
    new InvocationBuilder()
      .issuer(service)
      .subject(service.did)
      .audience(service.did)
      .proofs([]),
    delegationCid,
  );
  await revocationStore.insert(delegationCid, revocation);

  // After revocation, even a valid draft must be denied.
  const rejectedByRevocation = await makeRequest("draft:revoked note");
  assert.equal(rejectedByRevocation.status, 403);
  assert.equal(notes.size, 1);
  console.log("POST /notes revoked delegation => 403 ✓");
} finally {
  await new Promise<void>((resolve) => server.close(() => resolve()));
}
