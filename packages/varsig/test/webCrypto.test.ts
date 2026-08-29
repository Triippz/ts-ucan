import { describe, it, expect } from "vitest";
import { ed25519 } from "@noble/curves/ed25519";
import { webCryptoTryFromTags, webCryptoVerify } from "../src/index.js";

describe("WebCrypto", () => {
  it("rejects Es256k tag parsing", () => {
    expect(webCryptoTryFromTags([0xec, 0xe7, 0x12])).toBeNull();
  });

  it("rejects verifier/signature algorithm mismatches", () => {
    const secretKey = ed25519.utils.randomPrivateKey();
    const publicKey = ed25519.getPublicKey(secretKey);
    const message = new TextEncoder().encode("hello");
    const signature = ed25519.sign(message, secretKey);

    expect(() =>
      webCryptoVerify(
        { alg: "ed25519", key: publicKey },
        message,
        { alg: "ed25519", signature },
      ),
    ).not.toThrow();

    expect(() =>
      webCryptoVerify(
        { alg: "es256", key: new Uint8Array(33) },
        message,
        { alg: "ed25519", signature },
      ),
    ).toThrowError("variant mismatch");
  });

  it("rejects the Ed25519 small-order universal forgery (zip215:false)", () => {
    // Identity public key [1,0,...] + signature R=identity,S=0 verifies for
    // every message under noble's default zip215:true. Strict mode must reject.
    const identityKey = new Uint8Array(32);
    identityKey[0] = 1;
    const forgery = new Uint8Array(64);
    forgery[0] = 1;
    expect(() =>
      webCryptoVerify(
        { alg: "ed25519", key: identityKey },
        new TextEncoder().encode("any message"),
        { alg: "ed25519", signature: forgery },
      ),
    ).toThrowError("signature verification failed");
  });
});
