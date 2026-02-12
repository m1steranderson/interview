const EXPIRY_SECONDS = 5;

/**
 * Sign pathname + timestamp with HMAC-SHA256.
 * Uses Web Crypto API (works in CF Workers, Node 18+, Bun).
 */
export async function signHmac(
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

  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(`${pathname}${timestamp}`),
  );

  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Verify HMAC-SHA256 signature with timestamp expiry.
 * Uses Web Crypto API (available in CF Workers).
 */
export async function verifyHmac(
  pathname: string,
  token: string,
  timestamp: string,
  secret: string,
): Promise<{ valid: boolean; error?: string }> {
  const now = Math.floor(Date.now() / 1000);

  if (now > parseInt(timestamp, 10) + EXPIRY_SECONDS) {
    return { valid: false, error: "Token expired" };
  }

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );

  const sigBytes = new Uint8Array(
    token.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16)),
  );

  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    sigBytes,
    encoder.encode(`${pathname}${timestamp}`),
  );

  return valid ? { valid: true } : { valid: false, error: "Invalid signature" };
}
