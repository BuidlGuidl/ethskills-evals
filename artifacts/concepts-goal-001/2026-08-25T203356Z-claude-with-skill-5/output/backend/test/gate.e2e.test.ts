import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { ChildProcess } from "node:child_process";
import { createPublicClient, getAddress, http, type Address, type PublicClient } from "viem";
import { foundry } from "viem/chains";
import { SubscriptionGate } from "../src/gate.ts";
import { SubscriptionAuth } from "../src/auth.ts";
import { subscriptionBillingAbi } from "../src/abi.ts";
import {
  artifact,
  chainNow,
  CUSTOMER,
  DEPLOYER,
  deploy,
  RPC_URL,
  startAnvil,
  testClient,
  walletFor,
  warp,
} from "./anvil.ts";

const MONTH = 30 * 24 * 60 * 60;
const HOBBY = 1;
const TREASURY = getAddress("0x000000000000000000000000000000000000beef");

describe("subscription gate against a live chain", () => {
  let anvil: ChildProcess;
  let usdc: Address;
  let billing: Address;
  let client: PublicClient;
  let gate: SubscriptionGate;
  /** Chain time, so the gate's clock moves with anvil's rather than the wall's. */
  let now = 0;

  before(async () => {
    anvil = await startAnvil();

    usdc = await deploy("MockUSDC", []);
    billing = await deploy("SubscriptionBilling", [usdc, TREASURY, [5_000_000n, 20_000_000n]]);

    const usdcAbi = artifact("MockUSDC").abi;
    const deployerWallet = walletFor(DEPLOYER);
    const customerWallet = walletFor(CUSTOMER);

    await testClient.waitForTransactionReceipt({
      hash: await deployerWallet.writeContract({
        address: usdc,
        abi: usdcAbi,
        functionName: "mint",
        args: [CUSTOMER.address, 1_000_000_000n],
        chain: foundry,
        account: DEPLOYER,
      }),
    });
    await testClient.waitForTransactionReceipt({
      hash: await customerWallet.writeContract({
        address: usdc,
        abi: usdcAbi,
        functionName: "approve",
        args: [billing, 2n ** 256n - 1n],
        chain: foundry,
        account: CUSTOMER,
      }),
    });

    // Short polling so AccountUpdated invalidation lands quickly over plain HTTP.
    client = createPublicClient({
      chain: foundry,
      transport: http(RPC_URL),
      pollingInterval: 100,
    }) as PublicClient;

    now = await chainNow();
    gate = new SubscriptionGate({
      client,
      address: billing,
      maxPositiveTtlMs: 50,
      negativeTtlMs: 50,
      nowSeconds: () => now,
    });
  });

  after(() => {
    gate?.stop();
    anvil?.kill();
  });

  async function subscribe(amount: bigint, plan: number): Promise<void> {
    await testClient.waitForTransactionReceipt({
      hash: await walletFor(CUSTOMER).writeContract({
        address: billing,
        abi: artifact("SubscriptionBilling").abi,
        functionName: "depositAndSubscribe",
        args: [amount, plan],
        chain: foundry,
        account: CUSTOMER,
      }),
    });
    now = await chainNow();
  }

  it("refuses an address that has never paid", async () => {
    const status = await gate.check(CUSTOMER.address);
    assert.equal(status.active, false);
    assert.equal(status.paidThrough, 0);
  });

  it("admits an address after it subscribes", async () => {
    await subscribe(15_000_000n, HOBBY); // three months of hobby
    gate.invalidate(CUSTOMER.address);

    const status = await gate.check(CUSTOMER.address);
    assert.equal(status.active, true);
    assert.equal(status.plan, HOBBY);
    assert.ok(status.paidThrough >= now + 3 * MONTH - 5);
  });

  it("serves repeat requests from cache without hitting the RPC", async () => {
    const before = gate.stats.rpcCalls;
    for (let i = 0; i < 25; i++) await gate.check(CUSTOMER.address);
    assert.equal(gate.stats.rpcCalls, before, "25 API requests, zero eth_calls");
  });

  it("expires the address when the prepaid balance runs out, with no transaction", async () => {
    await warp(3 * MONTH + 60);
    now = await chainNow();

    // Nobody sent anything. The chain was not touched. The customer is simply out.
    const status = await gate.check(CUSTOMER.address);
    assert.equal(status.active, false);
  });

  it("reactivates on a top-up", async () => {
    await subscribe(5_000_000n, HOBBY);
    gate.invalidate(CUSTOMER.address);

    assert.equal((await gate.check(CUSTOMER.address)).active, true);
  });

  it("invalidates the cache from the AccountUpdated event when a customer cancels", async () => {
    assert.equal((await gate.check(CUSTOMER.address)).active, true);
    const invalidationsBefore = gate.stats.eventInvalidations;

    await testClient.waitForTransactionReceipt({
      hash: await walletFor(CUSTOMER).writeContract({
        address: billing,
        abi: artifact("SubscriptionBilling").abi,
        functionName: "cancelAndWithdraw",
        chain: foundry,
        account: CUSTOMER,
      }),
    });

    // Wait for the log to reach the gate rather than for the TTL to lapse.
    const deadline = Date.now() + 5_000;
    while (gate.stats.eventInvalidations === invalidationsBefore && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 50));
    }
    assert.ok(gate.stats.eventInvalidations > invalidationsBefore, "cancel was not observed");

    now = await chainNow();
    assert.equal((await gate.check(CUSTOMER.address)).active, false);
  });

  it("reads the same answer as the contract itself", async () => {
    await subscribe(5_000_000n, HOBBY);
    gate.invalidate(CUSTOMER.address);

    const onchain = await client.readContract({
      address: billing,
      abi: subscriptionBillingAbi,
      functionName: "isSubscribed",
      args: [CUSTOMER.address],
    });
    assert.equal((await gate.check(CUSTOMER.address)).active, onchain);
  });

  it("keeps serving a known-good customer through an RPC outage, and only them", async () => {
    const dead = createPublicClient({
      chain: foundry,
      transport: http("http://127.0.0.1:1"),
    }) as PublicClient;

    const outageGate = new SubscriptionGate({
      client,
      address: billing,
      maxPositiveTtlMs: 1,
      nowSeconds: () => now,
      watchEvents: false,
    });
    assert.equal((await outageGate.check(CUSTOMER.address)).active, true);

    // Point the same gate at an unreachable node.
    (outageGate as unknown as { opts: { client: PublicClient } }).opts.client = dead;

    const stale = await outageGate.check(CUSTOMER.address);
    assert.equal(stale.active, true);
    assert.equal(stale.source, "stale", "paying customers ride out a provider blip");

    // An address we have never seen gets refused, not waved through.
    await assert.rejects(() => outageGate.check(DEPLOYER.address));
  });
});

describe("address authentication", () => {
  let anvil: ChildProcess;
  let auth: SubscriptionAuth;

  before(async () => {
    anvil = await startAnvil();
    const client = createPublicClient({ chain: foundry, transport: http(RPC_URL) }) as PublicClient;
    auth = new SubscriptionAuth(client, Buffer.alloc(32, 7), "weather.example");
  });

  after(() => anvil?.kill());

  it("issues a token for a correctly signed challenge", async () => {
    const challenge = auth.issueChallenge(CUSTOMER.address);
    const signature = await CUSTOMER.signMessage({ message: challenge.message });

    const { token } = await auth.verifyChallenge(CUSTOMER.address, challenge.nonce, signature);
    assert.equal(auth.verifyToken(token), CUSTOMER.address);
  });

  it("rejects a signature from a different key", async () => {
    const challenge = auth.issueChallenge(CUSTOMER.address);
    const signature = await DEPLOYER.signMessage({ message: challenge.message });

    await assert.rejects(
      () => auth.verifyChallenge(CUSTOMER.address, challenge.nonce, signature),
      /bad signature/,
    );
  });

  it("burns the nonce so a captured signature cannot be replayed", async () => {
    const challenge = auth.issueChallenge(CUSTOMER.address);
    const signature = await CUSTOMER.signMessage({ message: challenge.message });

    await auth.verifyChallenge(CUSTOMER.address, challenge.nonce, signature);
    await assert.rejects(
      () => auth.verifyChallenge(CUSTOMER.address, challenge.nonce, signature),
      /already-used/,
    );
  });

  it("rejects a token with a tampered address", async () => {
    const forged = `${Buffer.from(`${DEPLOYER.address}|${Date.now() + 60_000}`).toString(
      "base64url",
    )}.${Buffer.alloc(32).toString("base64url")}`;
    assert.throws(() => auth.verifyToken(forged), /bad token signature/);
  });
});
