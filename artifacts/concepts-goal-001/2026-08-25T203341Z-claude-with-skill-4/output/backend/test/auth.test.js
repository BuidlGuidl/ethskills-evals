import test from "node:test";
import assert from "node:assert/strict";
import {privateKeyToAccount} from "viem/accounts";

process.env.SESSION_SECRET ??= "test-secret";
process.env.CHAIN_ID ??= "31337";

const {issueNonce, redeemNonce, verifyToken, mintToken, AuthError} = await import("../src/auth.js");
const {QuotaMeter} = await import("../src/quota.js");

const account = privateKeyToAccount("0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d");

// Stands in for a viem public client; EOA recovery only, which is all these tests need.
const fakeClient = {
  async verifyMessage({address, message, signature}) {
    const {verifyMessage} = await import("viem");
    return verifyMessage({address, message, signature});
  },
};

test("a valid signature over the issued nonce mints a working token", async () => {
  const {message} = issueNonce(account.address);
  const signature = await account.signMessage({message});
  const {token} = await redeemNonce(fakeClient, account.address, signature);
  assert.equal(verifyToken(token), account.address);
});

test("a nonce is single use", async () => {
  const {message} = issueNonce(account.address);
  const signature = await account.signMessage({message});
  await redeemNonce(fakeClient, account.address, signature);
  await assert.rejects(() => redeemNonce(fakeClient, account.address, signature), AuthError);
});

test("a signature from a different key is rejected", async () => {
  const other = privateKeyToAccount("0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba");
  const {message} = issueNonce(account.address);
  const signature = await other.signMessage({message});
  await assert.rejects(() => redeemNonce(fakeClient, account.address, signature), AuthError);
});

test("a tampered token is rejected", () => {
  const {token} = mintToken(account.address);
  const [body, mac] = token.split(".");
  const forged = Buffer.from(JSON.stringify({sub: account.address, exp: 2 ** 40})).toString("base64url");
  assert.throws(() => verifyToken(`${forged}.${mac}`), AuthError);
  assert.throws(() => verifyToken(`${body}.${"a".repeat(mac.length)}`), AuthError);
  assert.throws(() => verifyToken("garbage"), AuthError);
});

test("an expired token is rejected", () => {
  const {token} = mintToken(account.address, -1);
  assert.throws(() => verifyToken(token), AuthError);
});

test("quota is enforced per plan and resets with the window", () => {
  const meter = new QuotaMeter({1: 2, 2: 5});
  const t0 = 60_000;
  assert.equal(meter.check("a", 1, t0).allowed, true);
  assert.equal(meter.check("a", 1, t0).allowed, true);
  assert.equal(meter.check("a", 1, t0).allowed, false, "third hobby request in the window is over");
  assert.equal(meter.check("a", 2, t0).allowed, true, "pro has more room");
  assert.equal(meter.check("a", 1, t0 + 60_000).allowed, true, "next window is fresh");
  assert.equal(meter.check("a", 9, t0).allowed, true, "unknown plans are not throttled here");
});
