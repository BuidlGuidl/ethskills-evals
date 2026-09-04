import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { Address, Hex, PublicClient } from "viem";
import { getAddress } from "viem";

/**
 * Proving that the caller *is* the address.
 *
 * `isSubscribed(0xAlice)` answers a question about Alice, not about whoever is holding
 * the API connection. Onchain state is public: anyone can read the logs, find a funded
 * subscriber and send `X-Address: 0xAlice`. Without this step the billing contract is
 * a list of addresses that get free weather data.
 *
 * So: sign a nonce once with the key that controls the account, get a short-lived
 * bearer token, present the token per request. Signature verification goes through
 * `verifyMessage`, which handles EOAs and — via ERC-1271 — smart accounts, which is
 * most of the audience for an onchain-billed API.
 */

const CHALLENGE_TTL_MS = 5 * 60_000;

export interface Challenge {
  address: Address;
  nonce: string;
  message: string;
  expiresAt: number;
}

export class SubscriptionAuth {
  private readonly challenges = new Map<string, Challenge>();
  private readonly client: PublicClient;
  /** HMAC key for session tokens. Load from the environment; rotating it logs everyone out. */
  private readonly sessionSecret: Buffer;
  private readonly domain: string;
  /** How long a session token is good for. Keep it short-ish: a token outlives a cancel. */
  private readonly sessionTtlMs: number;

  constructor(
    client: PublicClient,
    sessionSecret: Buffer,
    domain: string,
    sessionTtlMs = 60 * 60_000,
  ) {
    if (sessionSecret.length < 32) throw new Error("sessionSecret must be >= 32 bytes");
    this.client = client;
    this.sessionSecret = sessionSecret;
    this.domain = domain;
    this.sessionTtlMs = sessionTtlMs;
  }

  /** Step 1: hand out a nonce to sign. */
  issueChallenge(rawAddress: Address): Challenge {
    const address = getAddress(rawAddress);
    const nonce = randomBytes(16).toString("hex");
    const expiresAt = Date.now() + CHALLENGE_TTL_MS;
    const message = [
      `${this.domain} wants you to sign in with your Ethereum account:`,
      address,
      "",
      "Sign in to use the weather API. This does not authorise any transaction and costs no gas.",
      "",
      `Nonce: ${nonce}`,
      `Expires: ${new Date(expiresAt).toISOString()}`,
    ].join("\n");

    const challenge: Challenge = { address, nonce, message, expiresAt };
    this.challenges.set(this.key(address, nonce), challenge);
    this.sweepExpired();
    return challenge;
  }

  /** Step 2: verify the signature, burn the nonce, return a bearer token. */
  async verifyChallenge(
    rawAddress: Address,
    nonce: string,
    signature: Hex,
  ): Promise<{ token: string; expiresAt: number }> {
    const address = getAddress(rawAddress);
    const key = this.key(address, nonce);
    const challenge = this.challenges.get(key);
    if (!challenge) throw new Error("unknown or already-used nonce");
    // Single use: a replayed signature must not mint a second session.
    this.challenges.delete(key);
    if (Date.now() > challenge.expiresAt) throw new Error("challenge expired");

    const valid = await this.client.verifyMessage({
      address,
      message: challenge.message,
      signature,
    });
    if (!valid) throw new Error("bad signature");

    return this.issueToken(address);
  }

  /** Step 3: check the token on each request. Returns the address it is bound to. */
  verifyToken(token: string): Address {
    const [body, mac] = token.split(".");
    if (!body || !mac) throw new Error("malformed token");

    const expected = this.sign(body);
    const given = Buffer.from(mac, "base64url");
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
      throw new Error("bad token signature");
    }

    const [address, expiresAt] = Buffer.from(body, "base64url").toString().split("|");
    if (Number(expiresAt) < Date.now()) throw new Error("token expired");
    return getAddress(address as Address);
  }

  private issueToken(address: Address): { token: string; expiresAt: number } {
    const expiresAt = Date.now() + this.sessionTtlMs;
    const body = Buffer.from(`${address}|${expiresAt}`).toString("base64url");
    return { token: `${body}.${this.sign(body).toString("base64url")}`, expiresAt };
  }

  private sign(body: string): Buffer {
    return createHmac("sha256", this.sessionSecret).update(body).digest();
  }

  private key(address: Address, nonce: string): string {
    return `${address}:${nonce}`;
  }

  private sweepExpired(): void {
    const now = Date.now();
    for (const [key, challenge] of this.challenges) {
      if (challenge.expiresAt < now) this.challenges.delete(key);
    }
  }
}
