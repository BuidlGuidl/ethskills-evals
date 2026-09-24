import { verifyMessage, type Address } from "viem";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Proving which address a request belongs to.
 *
 * `isActive(address)` answers "is this address paid up" — it does NOT answer "is
 * the person making this request that address". Without this step, anyone could
 * read a paying customer's address off the block explorer (every subscriber is
 * public) and use their subscription. The contract cannot help here; this is
 * ordinary API authentication and it has to exist on your side.
 *
 * Flow: the customer signs a one-off challenge with their wallet, once. You
 * verify the signature and hand back a long-lived API key bound to that address.
 * From then on they send the key as a normal bearer token, exactly like Stripe —
 * no wallet, no signing, no web3 on the hot path.
 */

const CHALLENGE_TTL_MS = 5 * 60_000;

export function buildChallenge(address: Address, nonce: string, issuedAt = Date.now()): string {
  return [
    "weather-api.example wants you to sign in.",
    "",
    `Address: ${address}`,
    `Nonce: ${nonce}`,
    `Issued At: ${new Date(issuedAt).toISOString()}`,
  ].join("\n");
}

export function newNonce(): string {
  return randomBytes(16).toString("hex");
}

export async function verifyChallenge(params: {
  address: Address;
  message: string;
  signature: `0x${string}`;
  expectedNonce: string;
}): Promise<boolean> {
  const { address, message, signature, expectedNonce } = params;

  // Bind the signature to the nonce we issued, so a signature captured elsewhere
  // cannot be replayed here.
  if (!message.includes(`Nonce: ${expectedNonce}`)) return false;

  const issuedAtLine = message.split("\n").find((l) => l.startsWith("Issued At: "));
  if (!issuedAtLine) return false;
  const issuedAt = Date.parse(issuedAtLine.slice("Issued At: ".length));
  if (!Number.isFinite(issuedAt) || Date.now() - issuedAt > CHALLENGE_TTL_MS) return false;

  // Note: `verifyMessage` also handles ERC-1271, so smart contract wallets
  // (Safe, Coinbase Smart Wallet) can authenticate too — a plain ecrecover
  // would reject them.
  return verifyMessage({ address, message, signature });
}

/**
 * API keys are `<addressPrefix>.<random>`; you store only the HMAC, so a leak of
 * your key table does not let anyone authenticate.
 */
export function issueApiKey(address: Address, serverSecret: string) {
  const secret = randomBytes(24).toString("base64url");
  const key = `${address.toLowerCase()}.${secret}`;
  return { key, lookupHash: hashApiKey(key, serverSecret) };
}

export function hashApiKey(key: string, serverSecret: string): string {
  return createHmac("sha256", serverSecret).update(key).digest("hex");
}

export function addressFromApiKey(key: string): Address | null {
  const [addr] = key.split(".");
  return /^0x[0-9a-f]{40}$/.test(addr ?? "") ? (addr as Address) : null;
}

export function constantTimeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}
