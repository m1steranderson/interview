import { describe, it, expect } from "bun:test";
import { verifyHmac } from "./hmac";

/** Helper: sign a pathname+timestamp with HMAC-SHA256 and return hex token */
async function sign(
  pathname: string,
  timestamp: string,
  secret: string,
): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(`${pathname}${timestamp}`),
  );
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

describe("verifyHmac", () => {
  const secret = "test-secret";
  const pathname = "/api/cache/purge";

  it("should accept a valid signature", async () => {
    const ts = String(Math.floor(Date.now() / 1000));
    const token = await sign(pathname, ts, secret);

    const result = await verifyHmac(pathname, token, ts, secret);
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it("should reject an expired token", async () => {
    const ts = String(Math.floor(Date.now() / 1000) - 60); // 60s ago
    const token = await sign(pathname, ts, secret);

    const result = await verifyHmac(pathname, token, ts, secret);
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Token expired");
  });

  it("should reject a wrong signature", async () => {
    const ts = String(Math.floor(Date.now() / 1000));
    const token = await sign(pathname, ts, "wrong-secret");

    const result = await verifyHmac(pathname, token, ts, secret);
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Invalid signature");
  });

  it("should reject a tampered pathname", async () => {
    const ts = String(Math.floor(Date.now() / 1000));
    const token = await sign("/other/path", ts, secret);

    const result = await verifyHmac(pathname, token, ts, secret);
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Invalid signature");
  });
});
