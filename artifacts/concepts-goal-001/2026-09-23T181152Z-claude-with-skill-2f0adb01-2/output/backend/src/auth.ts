import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { type Address } from "viem";
import { publicClient } from "./billing.js";
import { config } from "./config.js";

/**
 * The contract answers "is this ADDRESS subscribed". It cannot answer "is this HTTP
 * request coming from that address" -- that part is ordinary web auth, and skipping
 * it is the classic way an onchain paywall ends up not being a paywall at all.
 *
 * Flow: the customer requests a nonce, signs a short message with the wallet that
 * holds the subscription, and swaps the signature for a bearer token. From then on
 * it is a normal API key, except we never had to issue or store one.
 *
 * `publicClient.verifyMessage` checks EOA signatures *and* the ERC-1271/6492
 * contract-account paths, so Safes and smart wallets work without a separate code
 * path. Do not hand-roll ecrecover, and do not reach for the top-level
 * `verifyMessage` util -- both silently reject every contract wallet.
 */

const TOKEN_TTL_SECONDS = 15 * 60;
const NONCE_TTL_MS = 5 * 60 * 1000;

// Single-process store. Behind more than one instance, move both to Redis --
// see NOTES.md. Reusing a nonce must be impossible, not just unlikely.
const nonces = new Map<string, number>();

function secret(): Buffer {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) {
    throw new Error("AUTH_SECRET must be set to at least 32 random characters");
  }
  return Buffer.from(s, "utf8");
}

export function issueNonce(): string {
  const nonce = randomBytes(16).toString("hex");
  nonces.set(nonce, Date.now() + NONCE_TTL_MS);
  // Opportunistic sweep; the map would otherwise grow without bound.
  if (nonces.size > 10_000) {
    const now = Date.now();
    for (const [k, exp] of nonces) if (exp < now) nonces.delete(k);
  }
  return nonce;
}

export function loginMessage(address: Address, nonce: string): string {
  return [
    `${config.authDomain} wants you to sign in with your Ethereum account:`,
    address,
    "",
    "Signing proves you control this address. It does not move any funds.",
    "",
    `Nonce: ${nonce}`,
  ].join("\n");
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

/** Verifies the wallet signature and mints a bearer token. */
export async function login(
  address: Address,
  nonce: string,
  signature: `0x${string}`,
): Promise<string> {
  const expiry = nonces.get(nonce);
  if (!expiry || expiry < Date.now()) throw new Error("unknown or expired nonce");
  nonces.delete(nonce); // single use, always -- consume before verifying

  // Must be the *client* action, not the top-level `verifyMessage` util from
  // "viem" -- that one is EOA-only and would reject every Safe and smart account.
  // This path handles EOAs, ERC-1271 and ERC-6492 (not-yet-deployed accounts).
  const valid = await publicClient.verifyMessage({
    address,
    message: loginMessage(address, nonce),
    signature,
  });
  if (!valid) throw new Error("bad signature");

  const exp = Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS;
  const payload = `${address.toLowerCase()}.${exp}`;
  return `${payload}.${sign(payload)}`;
}

/** Returns the authenticated address, or null. */
export function verifyToken(token: string): Address | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [address, expStr, mac] = parts;

  const expected = Buffer.from(sign(`${address}.${expStr}`));
  const given = Buffer.from(mac);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;

  if (Number(expStr) < Math.floor(Date.now() / 1000)) return null;
  return address as Address;
}
