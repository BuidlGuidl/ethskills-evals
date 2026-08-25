import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { createPublicClient, http, getAddress, type Address, type Chain, type Hex } from "viem";

/**
 * Proving that an API caller controls an address.
 *
 * The contract answers "is address X subscribed?". It cannot answer "is the person holding this
 * API key address X?" — that half is entirely yours, and skipping it is the obvious way to get
 * robbed: without it, anyone who reads the chain can see a paying address and claim to be it.
 *
 * Flow: the customer signs a short login message once, and gets back a bearer token. The token
 * is an HMAC over (address, expiry) with a server secret, so there is no session table to keep
 * and nothing to replicate across your API instances.
 *
 * Verification goes through `publicClient.verifyMessage`, which handles both plain EOA
 * signatures and ERC-1271 contract signatures — so a customer paying from a Safe or a smart
 * account works without a second code path.
 */

const DOMAIN = "weather-api";

export interface AuthConfig {
  /** Server secret for token HMAC. 32+ random bytes. Rotating it logs everyone out. */
  secret: string;
  chain: Chain;
  rpcUrl: string;
  /** How long an issued token stays valid. Default 7 days. */
  tokenTtlSeconds?: number;
  /** How long a login message stays signable after issue. Default 5 minutes. */
  challengeTtlSeconds?: number;
}

export interface Challenge {
  address: Address;
  nonce: string;
  issuedAt: number;
  expiresAt: number;
  message: string;
  /** HMAC proving this server issued this exact challenge. Keeps the flow stateless. */
  stamp: string;
}

export class Authenticator {
  private readonly client;
  private readonly tokenTtl: number;
  private readonly challengeTtl: number;
  /** Spent nonces, so one signature cannot be replayed into a second token. */
  private readonly usedNonces = new Map<string, number>();

  constructor(private readonly cfg: AuthConfig) {
    if (cfg.secret.length < 32) throw new Error("auth secret must be at least 32 characters");
    this.client = createPublicClient({ chain: cfg.chain, transport: http(cfg.rpcUrl) });
    this.tokenTtl = cfg.tokenTtlSeconds ?? 7 * 24 * 3600;
    this.challengeTtl = cfg.challengeTtlSeconds ?? 300;
  }

  /** Step 1: hand the customer something to sign. */
  challenge(address: Address): Challenge {
    const a = getAddress(address);
    const nonce = randomBytes(16).toString("hex");
    const issuedAt = nowSec();
    const expiresAt = issuedAt + this.challengeTtl;
    const message = [
      `${DOMAIN} wants you to sign in with your Ethereum account:`,
      a,
      "",
      "Signing this proves you control this address. It does not move any funds,",
      "grant any approval, or cost any gas.",
      "",
      `Nonce: ${nonce}`,
      `Issued At: ${new Date(issuedAt * 1000).toISOString()}`,
      `Expiration Time: ${new Date(expiresAt * 1000).toISOString()}`,
    ].join("\n");
    const stamp = this.sign(`challenge.${a}.${nonce}.${expiresAt}`);
    return { address: a, nonce, issuedAt, expiresAt, message, stamp };
  }

  /** Step 2: check the signature and mint a bearer token. */
  async verify(challenge: Challenge, signature: Hex): Promise<{ token: string; expiresAt: number }> {
    const now = nowSec();

    // The client hands the challenge back to us, so check we are the ones who wrote it.
    // Without this a caller could mint themselves a challenge that never expires.
    const expectedStamp = this.sign(
      `challenge.${challenge.address}.${challenge.nonce}.${challenge.expiresAt}`,
    );
    if (!constantTimeEqual(challenge.stamp ?? "", expectedStamp)) {
      throw new AuthError("challenge was not issued by this server");
    }
    if (now > challenge.expiresAt) throw new AuthError("challenge expired");

    this.sweepNonces(now);
    if (this.usedNonces.has(challenge.nonce)) throw new AuthError("nonce already used");

    const ok = await this.client.verifyMessage({
      address: challenge.address,
      message: challenge.message,
      signature,
    });
    if (!ok) throw new AuthError("signature does not match address");

    this.usedNonces.set(challenge.nonce, challenge.expiresAt);
    const expiresAt = now + this.tokenTtl;
    return { token: this.mint(challenge.address, expiresAt), expiresAt };
  }

  /** On every API request: turn a bearer token back into an address, or reject it. */
  addressFromToken(token: string): Address {
    const parts = token.split(".");
    if (parts.length !== 3) throw new AuthError("malformed token");
    const [addr, expStr, mac] = parts;

    if (!constantTimeEqual(mac, this.sign(`${addr}.${expStr}`))) {
      throw new AuthError("bad token signature");
    }
    if (nowSec() > Number(expStr)) throw new AuthError("token expired");

    return getAddress(addr as Address);
  }

  private mint(address: Address, expiresAt: number): string {
    const body = `${address}.${expiresAt}`;
    return `${body}.${this.sign(body)}`;
  }

  private sign(body: string): string {
    return createHmac("sha256", this.cfg.secret).update(body).digest("hex");
  }

  private sweepNonces(now: number): void {
    for (const [nonce, exp] of this.usedNonces) {
      if (exp < now) this.usedNonces.delete(nonce);
    }
  }
}

export class AuthError extends Error {}

function constantTimeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a, "hex");
  const y = Buffer.from(b, "hex");
  return x.length === y.length && x.length > 0 && timingSafeEqual(x, y);
}

function nowSec(): number {
  return Math.floor(Date.now() / 1000);
}
