import { isAddress, type Address } from "viem";
import { publicClient } from "./chain";
import { db, nowSeconds } from "./db";
import { authMessage } from "./auth-message";

/**
 * Write authentication without a session store: the client signs a canonical
 * statement with the same wallet it transacts with, and we verify it here.
 *
 * The wallet is already the member's identity onchain, so introducing a second
 * credential (password, email link) would only add something else to lose.
 *
 * Verification goes through the public client rather than viem's offline
 * `verifyMessage`, because most members will be on a Coinbase Smart Wallet:
 * those sign via EIP-1271/ERC-6492, which needs a chain read to check.
 */

const MAX_SKEW_SECONDS = 5 * 60;

export { authMessage };

export type SignedRequest = {
  address: string;
  nonce: string;
  issuedAt: number;
  signature: `0x${string}`;
};

export class AuthError extends Error {
  constructor(message: string, readonly status = 401) {
    super(message);
  }
}

/**
 * Verifies the signature and burns the nonce. Returns the authenticated
 * address, lowercased.
 */
export async function requireSigner(action: string, body: Partial<SignedRequest>): Promise<string> {
  const { address, nonce, issuedAt, signature } = body;

  if (!address || !isAddress(address)) throw new AuthError("missing or malformed address");
  if (!nonce || !signature || typeof issuedAt !== "number") throw new AuthError("missing signature fields");

  const drift = Math.abs(nowSeconds() - issuedAt);
  if (drift > MAX_SKEW_SECONDS) throw new AuthError("signature expired; sign again");

  const valid = await publicClient.verifyMessage({
    address: address as Address,
    message: authMessage(action, address, nonce, issuedAt),
    signature,
  });
  if (!valid) throw new AuthError("signature does not match address");

  // Burn the nonce. The unique constraint is what actually prevents replay,
  // so a race between two identical requests still lets only one through.
  try {
    db()
      .prepare("INSERT INTO used_nonces (nonce, address, created_at) VALUES (?, ?, ?)")
      .run(nonce, address.toLowerCase(), nowSeconds());
  } catch {
    throw new AuthError("nonce already used");
  }

  // Housekeeping: nonces older than the skew window can never be valid again.
  db().prepare("DELETE FROM used_nonces WHERE created_at < ?").run(nowSeconds() - MAX_SKEW_SECONDS * 2);

  return address.toLowerCase();
}

/**
 * Membership gate. The association vouches for who actually lives in the
 * neighborhood; the contract itself is open, so this check is what keeps the
 * *app* to ~300 real neighbors.
 *
 * Set TOOLSHED_OPEN_SIGNUP=1 for a pilot where anyone who shows up is a member.
 */
export function requireApprovedMember(address: string): void {
  if (process.env.TOOLSHED_OPEN_SIGNUP === "1") return;

  const row = db().prepare("SELECT approved FROM members WHERE address = ?").get(address) as
    | { approved: number }
    | undefined;

  if (!row) throw new AuthError("not a member; ask an association admin to add you", 403);
  if (!row.approved) throw new AuthError("membership pending approval", 403);
}

export function isAdmin(address: string): boolean {
  const admins = (process.env.TOOLSHED_ADMIN_ADDRESSES ?? "")
    .split(",")
    .map((a) => a.trim().toLowerCase())
    .filter(Boolean);
  return admins.includes(address.toLowerCase());
}
