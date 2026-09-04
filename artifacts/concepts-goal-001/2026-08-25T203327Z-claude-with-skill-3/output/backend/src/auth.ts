import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { createPublicClient, http, type Address, type Hex, type PublicClient } from "viem";

/**
 * Knowing that an address is subscribed says nothing about who is holding the connection.
 * Without this step anyone could paste a paying customer's address into a header and read their
 * quota — addresses are public, so an unauthenticated address check is not authentication at all.
 *
 * So: nonce -> signature -> short-lived bearer token. Signature verification goes through the RPC
 * (`publicClient.verifyMessage`) so ERC-1271 smart accounts work as well as plain EOAs.
 */

const NONCE_TTL_MS = 5 * 60_000;
const SESSION_TTL_MS = 60 * 60_000;

type Nonce = { value: string; expiresAt: number };

export class Auth {
  private readonly client: PublicClient;
  private readonly nonces = new Map<Address, Nonce>();

  // Plain fields rather than TS parameter properties: `node --experimental-strip-types`
  // runs this file as-is and cannot desugar them.
  private readonly secret: string;
  private readonly domain: string;
  private readonly chainId: number;

  constructor(secret: string, rpcUrl: string, domain: string, chainId: number) {
    if (secret.length < 32) throw new Error("SESSION_SECRET must be at least 32 characters");
    this.secret = secret;
    this.domain = domain;
    this.chainId = chainId;
    this.client = createPublicClient({ transport: http(rpcUrl) }) as PublicClient;
  }

  /** Step 1: hand out a nonce bound to the address that asked for it. */
  challenge(addressRaw: Address): string {
    const address = addressRaw.toLowerCase() as Address;
    const value = randomBytes(16).toString("hex");
    this.nonces.set(address, { value, expiresAt: Date.now() + NONCE_TTL_MS });
    return this.message(address, value);
  }

  private message(address: Address, nonce: string): string {
    return [
      `${this.domain} wants you to sign in with your Ethereum account:`,
      address,
      "",
      "Sign in to the Weather API. This does not move any funds.",
      "",
      `URI: https://${this.domain}`,
      "Version: 1",
      `Chain ID: ${this.chainId}`,
      `Nonce: ${nonce}`,
    ].join("\n");
  }

  /** Step 2: check the signature over the exact message we issued, then mint a bearer token. */
  async verify(addressRaw: Address, signature: Hex): Promise<{ token: string; expiresAt: number }> {
    const address = addressRaw.toLowerCase() as Address;
    const nonce = this.nonces.get(address);
    if (!nonce || nonce.expiresAt < Date.now()) throw new Error("no live nonce for this address");
    this.nonces.delete(address); // single use

    const valid = await this.client.verifyMessage({
      address,
      message: this.message(address, nonce.value),
      signature,
    });
    if (!valid) throw new Error("bad signature");

    const expiresAt = Date.now() + SESSION_TTL_MS;
    return { token: this.mint(address, expiresAt), expiresAt };
  }

  /** Step 3: on each request, unwrap the token. Cheap, local, no RPC. */
  authenticate(header: string | undefined): Address | null {
    const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
    if (!token) return null;

    const [payload, mac] = token.split(".");
    if (!payload || !mac) return null;
    const expected = this.sign(payload);
    const a = Buffer.from(mac);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

    const [address, expiresAt] = Buffer.from(payload, "base64url").toString().split("|");
    if (!address || Number(expiresAt) < Date.now()) return null;
    return address as Address;
  }

  private mint(address: Address, expiresAt: number): string {
    const payload = Buffer.from(`${address}|${expiresAt}`).toString("base64url");
    return `${payload}.${this.sign(payload)}`;
  }

  private sign(payload: string): string {
    return createHmac("sha256", this.secret).update(payload).digest("base64url");
  }
}
