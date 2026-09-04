import {createHmac, randomBytes, timingSafeEqual} from "node:crypto";
import {getAddress, verifyMessage} from "viem";
import {config} from "./config.js";

/**
 * Proving control of an address.
 *
 * The contract says whether an *address* is subscribed. It cannot say whether the person holding
 * this HTTP connection is that address — anyone can put someone else's address in a header. So
 * the customer signs a nonce once, and gets a short-lived bearer token bound to their address.
 *
 * This part is ordinary offchain auth and it is worth being clear-eyed about it: it is the piece
 * of the system that only I run. See NOTES.md.
 */

const nonces = new Map(); // address -> {nonce, expiresAt}

export function issueNonce(rawAddress) {
  const address = getAddress(rawAddress);
  const nonce = randomBytes(16).toString("hex");
  const expiresAt = Date.now() + config.nonceTtlSeconds * 1000;
  nonces.set(address, {nonce, expiresAt});
  return {address, nonce, expiresAt, message: buildMessage(address, nonce, expiresAt)};
}

export function buildMessage(address, nonce, expiresAt) {
  // Deliberately human-readable and self-describing: a wallet prompt that just says "sign this
  // hex blob" trains people to sign anything.
  return [
    "hobbyweather.example wants you to sign in with your Ethereum account:",
    address,
    "",
    "Signing this proves you control this address. It does not move any funds and it does not",
    "approve any token. Your subscription is billed by the contract, not by this signature.",
    "",
    `Chain ID: ${config.chainId}`,
    `Nonce: ${nonce}`,
    `Expires: ${new Date(expiresAt).toISOString()}`,
  ].join("\n");
}

/**
 * Verify the signature and mint a session token.
 * Uses viem's `verifyMessage` through a public client so ERC-1271 smart accounts (Safe, most
 * modern wallets) work, not just EOAs.
 */
export async function redeemNonce(client, rawAddress, signature) {
  const address = getAddress(rawAddress);
  const entry = nonces.get(address);
  if (!entry) throw new AuthError("no pending nonce for this address; request one first");
  if (Date.now() > entry.expiresAt) {
    nonces.delete(address);
    throw new AuthError("nonce expired");
  }

  const message = buildMessage(address, entry.nonce, entry.expiresAt);
  const valid = await client.verifyMessage({address, message, signature});
  if (!valid) throw new AuthError("signature does not match address");

  nonces.delete(address); // single use
  return mintToken(address);
}

export function mintToken(address, ttlSeconds = config.sessionTtlSeconds) {
  const payload = {sub: getAddress(address), exp: Math.floor(Date.now() / 1000) + ttlSeconds};
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return {token: `${body}.${sign(body)}`, expiresAt: payload.exp};
}

export function verifyToken(token) {
  if (typeof token !== "string" || !token.includes(".")) throw new AuthError("malformed token");
  const [body, mac] = token.split(".");
  const expected = sign(body);
  const a = Buffer.from(mac ?? "", "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new AuthError("bad token signature");

  let payload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    throw new AuthError("malformed token payload");
  }
  if (typeof payload.exp !== "number" || Math.floor(Date.now() / 1000) >= payload.exp) {
    throw new AuthError("token expired");
  }
  return getAddress(payload.sub);
}

function sign(body) {
  return createHmac("sha256", config.sessionSecret).update(body).digest("base64url");
}

export function pruneNonces(now = Date.now()) {
  for (const [address, entry] of nonces) if (now > entry.expiresAt) nonces.delete(address);
}

export class AuthError extends Error {
  constructor(message) {
    super(message);
    this.name = "AuthError";
    this.status = 401;
  }
}
