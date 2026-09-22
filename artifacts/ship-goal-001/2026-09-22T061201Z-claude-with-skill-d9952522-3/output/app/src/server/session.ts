import crypto from "node:crypto";
import {cookies} from "next/headers";

import {db, normaliseAddress, now} from "./db.ts";

/**
 * Sign-in with an Ethereum signature, held in an HMAC-signed cookie.
 *
 * Deliberately small: a neighbourhood association should not have to run an identity provider,
 * and the wallet is already the identity that matters — it is the thing that signs loan terms and
 * receives refunds. There is no password to reset and no email to leak.
 */

const COOKIE = "toolshed_session";
const TTL_SECONDS = 60 * 60 * 24 * 30;
const NONCE_TTL_SECONDS = 10 * 60;

interface SessionPayload {
  address: string;
  expiresAt: number;
}

function secret(): string {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 16) {
    throw new Error("SESSION_SECRET must be set to a random string of at least 16 characters");
  }
  return value;
}

function sign(body: string): string {
  return crypto.createHmac("sha256", secret()).update(body).digest("base64url");
}

function seal(payload: SessionPayload): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

function unseal(token: string): SessionPayload | null {
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;
  const expected = sign(body);
  // Constant-time compare; both are fixed-length base64url of a sha256 digest.
  if (
    expected.length !== signature.length ||
    !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
  ) {
    return null;
  }
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString()) as SessionPayload;
    if (payload.expiresAt < now()) return null;
    return payload;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- nonces

/**
 * Issue a single-use nonce for an address to sign. Stored server-side so a signature captured
 * from one sign-in cannot be replayed into another.
 */
export function issueNonce(address: string): string {
  const nonce = crypto.randomBytes(16).toString("hex");
  const database = db();
  database
    .prepare("DELETE FROM auth_nonces WHERE expires_at < ?")
    .run(now());
  database
    .prepare("INSERT INTO auth_nonces (nonce, address, expires_at) VALUES (?, ?, ?)")
    .run(nonce, normaliseAddress(address), now() + NONCE_TTL_SECONDS);
  return nonce;
}

/** Consumes the nonce. Returns false if it is unknown, expired, or for a different address. */
export function consumeNonce(address: string, nonce: string): boolean {
  const row = db()
    .prepare("SELECT address, expires_at FROM auth_nonces WHERE nonce = ?")
    .get(nonce) as {address: string; expires_at: number} | undefined;
  db().prepare("DELETE FROM auth_nonces WHERE nonce = ?").run(nonce);
  if (!row) return false;
  if (row.expires_at < now()) return false;
  return row.address === normaliseAddress(address);
}

/** The exact text the wallet is asked to sign. Shown to the member, so keep it readable. */
export function signInMessage(address: string, nonce: string): string {
  return [
    "Sign in to Toolshed",
    "",
    `Address: ${address}`,
    `Nonce: ${nonce}`,
    "",
    "Signing this proves you control this wallet. It does not move any funds.",
  ].join("\n");
}

// ---------------------------------------------------------------- cookie

export async function startSession(address: string): Promise<void> {
  const store = await cookies();
  store.set(COOKIE, seal({address: normaliseAddress(address), expiresAt: now() + TTL_SECONDS}), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: TTL_SECONDS,
  });
}

export async function endSession(): Promise<void> {
  (await cookies()).delete(COOKIE);
}

/** The signed-in address, or null. Does not check membership status — use `requireMember`. */
export async function sessionAddress(): Promise<string | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  return unseal(token)?.address ?? null;
}
