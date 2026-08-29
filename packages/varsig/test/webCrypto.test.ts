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
});
