import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  parseAbi,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { SubscriptionGate } from "../src/gate.js";
import { subscriptionBillingAbi } from "../src/abi.js";

/**
 * End-to-end: real contract on a real (local) chain, driven by the real gate.
 *
 * Requires `anvil` and `forge` on PATH. Skipped automatically if they are missing, so this does
 * not become the test that blocks people who only touch the backend.
 */

const PORT = 8555;
const RPC = `http://127.0.0.1:${PORT}`;
/** Walk up to the foundry project root, so this works from src/ or from dist/. */
const ROOT = (() => {
  let dir = import.meta.dirname;
  for (let i = 0; i < 6; i++) {
    if (existsSync(resolve(dir, "foundry.toml"))) return dir;
    dir = dirname(dir);
  }
  throw new Error("could not locate foundry.toml above " + import.meta.dirname);
})();

const anvilChain = defineChain({
  id: 31337,
  name: "anvil",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [RPC] } },
});

const ANVIL_KEYS: Hex[] = [
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
  "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a",
  "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6",
];

const erc20 = parseAbi(["function approve(address,uint256) returns (bool)"]);

const haveTools = (() => {
  try {
    execFileSync("anvil", ["--version"], { stdio: "ignore" });
    execFileSync("forge", ["--version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
})();

describe("SubscriptionGate against a live contract", { skip: !haveTools }, () => {
  let anvil: ChildProcess;
  let billing: Address;
  let token: Address;
  let gate: SubscriptionGate;

  const publicClient = () => createPublicClient({ chain: anvilChain, transport: http(RPC) });
  const wallet = (key: Hex) =>
    createWalletClient({ account: privateKeyToAccount(key), chain: anvilChain, transport: http(RPC) });

  before(async () => {
    anvil = spawn("anvil", ["--port", String(PORT), "--silent", "--block-time", "1"], {
      stdio: "ignore",
    });
    await waitFor(async () => {
      await publicClient().getBlockNumber();
    });

    execFileSync(
      "forge",
      ["script", "script/LocalDev.s.sol", "--rpc-url", RPC, "--broadcast", "--silent"],
      { cwd: ROOT, stdio: "ignore" },
    );
    const dep = JSON.parse(readFileSync(resolve(ROOT, "deployments/31337.json"), "utf8"));
    billing = dep.billing;
    token = dep.token;

    gate = new SubscriptionGate({
      contract: billing,
      chain: anvilChain,
      rpcUrl: RPC,
      gracePeriodSeconds: 0,
      revalidateAfterSeconds: 60,
      negativeCacheSeconds: 1,
    });
  });

  after(() => {
    gate?.stop();
    anvil?.kill("SIGKILL");
  });

  async function subscribe(key: Hex, planId: number, amount: bigint) {
    const w = wallet(key);
    const pc = publicClient();
    let hash = await w.writeContract({ address: token, abi: erc20, functionName: "approve", args: [billing, amount] });
    await pc.waitForTransactionReceipt({ hash });
    hash = await w.writeContract({
      address: billing,
      abi: subscriptionBillingAbi,
      functionName: "subscribeWithDeposit",
      args: [planId, amount],
    });
    await pc.waitForTransactionReceipt({ hash });
    return w.account.address;
  }

  it("says no for an address that has never paid", async () => {
    const stranger = "0x000000000000000000000000000000000000dEaD" as Address;
    assert.equal(await gate.isActive(stranger), false);
  });

  it("says yes once a customer tops up and subscribes", async () => {
    const addr = await subscribe(ANVIL_KEYS[1], 1, 50_000_000n); // $50 on hobby
    gate.invalidate(addr);
    assert.equal(await gate.isActive(addr), true);

    const status = await gate.statusOf(addr);
    assert.equal(status.planId, 1);
    // $50 at $5 per 30 days is 10 periods of runway.
    assert.ok(status.activeUntil > Math.floor(Date.now() / 1000) + 299 * 86400);
  });

  it("serves repeat requests from cache instead of hammering the RPC", async () => {
    const addr = await subscribe(ANVIL_KEYS[2], 2, 100_000_000n);
    gate.invalidate(addr);

    await gate.isActive(addr);
    const before = gate.stats.rpcCalls;
    for (let i = 0; i < 500; i++) assert.equal(await gate.isActive(addr), true);
    assert.equal(gate.stats.rpcCalls, before, "500 requests, zero extra RPC calls");
  });

  it("coalesces a burst of distinct addresses into one batched read", async () => {
    const addrs = Array.from(
      { length: 40 },
      (_, i) => `0x${(i + 0x1000).toString(16).padStart(40, "0")}` as Address,
    );
    const before = gate.stats.rpcCalls;
    const results = await Promise.all(addrs.map((a) => gate.isActive(a)));
    assert.equal(gate.stats.rpcCalls - before, 1, "40 addresses, one statusOfMany call");
    assert.ok(results.every((r) => r === false));
  });

  it("lapses on its own when the money runs out, with nobody sending a transaction", async () => {
    // 30 units of USDC on the $5/30d plan buys ~15 seconds of service — enough that the
    // approve and subscribe transactions do not eat the whole runway before we can look.
    const addr = await subscribe(ANVIL_KEYS[3], 1, 30n);
    gate.invalidate(addr);

    const status = await gate.statusOf(addr);
    const runway = status.activeUntil - Math.floor(Date.now() / 1000);
    assert.ok(runway > 2 && runway < 20, `expected a few seconds of runway, got ${runway}`);
    assert.equal(await gate.isActive(addr), true);

    // No transaction is sent here. Nothing runs. The subscription ends anyway.
    await sleep((runway + 2) * 1000);
    assert.equal(await gate.isActive(addr), false, "lapsed with no keeper and no cron");
  });

  it("honours the allowlist without touching the chain at all", async () => {
    const free = "0x00000000000000000000000000000000000F4EE0" as Address;
    const g = new SubscriptionGate({
      contract: billing,
      chain: anvilChain,
      rpcUrl: RPC,
      allowlist: [free],
    });
    const before = g.stats.rpcCalls;
    assert.equal(await g.isActive(free), true);
    assert.equal(g.stats.rpcCalls, before);
    g.stop();
  });

  it("fails open when the RPC is unreachable and there is no cache", async () => {
    const g = new SubscriptionGate({
      contract: billing,
      chain: anvilChain,
      rpcUrl: "http://127.0.0.1:1", // nothing listening
      onRpcFailure: "allow",
    });
    assert.equal(await g.isActive("0x000000000000000000000000000000000000dEaD"), true);
    assert.ok(g.stats.failOpen > 0);
    g.stop();
  });

  it("fails closed instead, if that is what you configured", async () => {
    const g = new SubscriptionGate({
      contract: billing,
      chain: anvilChain,
      rpcUrl: "http://127.0.0.1:1",
      onRpcFailure: "deny",
    });
    assert.equal(await g.isActive("0x000000000000000000000000000000000000dEaD"), false);
    g.stop();
  });
});

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitFor(fn: () => Promise<unknown>, tries = 60) {
  for (let i = 0; i < tries; i++) {
    try {
      await fn();
      return;
    } catch {
      await sleep(250);
    }
  }
  throw new Error("timed out waiting for anvil");
}
