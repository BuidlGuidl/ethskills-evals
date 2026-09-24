import { test } from "node:test";
import assert from "node:assert/strict";
import type { Address } from "viem";
import { SubscriptionGate } from "../src/subscriptionGate.js";

const ADDR = "0x00000000000000000000000000000000000000b0" as Address;

/** Stands in for viem's PublicClient; counts calls so we can assert on caching. */
function fakeClient(activeUntilSeconds: () => bigint) {
  let calls = 0;
  let fail = false;
  return {
    get calls() {
      return calls;
    },
    setFail(v: boolean) {
      fail = v;
    },
    client: {
      async readContract() {
        calls++;
        if (fail) throw new Error("rpc down");
        return activeUntilSeconds();
      },
    } as any,
  };
}

function gateWith(fake: ReturnType<typeof fakeClient>, opts: Record<string, unknown> = {}) {
  return new SubscriptionGate({
    contract: "0x0000000000000000000000000000000000000001" as Address,
    rpcUrl: "http://unused",
    client: fake.client,
    ...opts,
  });
}

test("an active address is served from cache without further RPC calls", async () => {
  const future = BigInt(Math.floor(Date.now() / 1000) + 3600);
  const fake = fakeClient(() => future);
  const gate = gateWith(fake, { refreshAfterMs: 60_000 });

  assert.equal(await gate.isActive(ADDR), true);
  for (let i = 0; i < 50; i++) await gate.isActive(ADDR);

  assert.equal(fake.calls, 1, "50 requests cost one RPC call");
  assert.equal(gate.stats().cacheHits, 50);
});

test("expiry is respected even while the cache entry is fresh", async () => {
  // activeUntil is one second away; the refresh window is much longer.
  const soon = BigInt(Math.floor(Date.now() / 1000) + 1);
  const fake = fakeClient(() => soon);
  const gate = gateWith(fake, { refreshAfterMs: 600_000, negativeTtlMs: 600_000 });

  assert.equal(await gate.isActive(ADDR), true);
  await new Promise((r) => setTimeout(r, 1100));
  assert.equal(await gate.isActive(ADDR), false, "cache must not keep a lapsed address alive");
});

test("concurrent misses collapse into a single RPC call", async () => {
  const future = BigInt(Math.floor(Date.now() / 1000) + 3600);
  const fake = fakeClient(() => future);
  const gate = gateWith(fake);

  const results = await Promise.all(Array.from({ length: 20 }, () => gate.isActive(ADDR)));
  assert.ok(results.every(Boolean));
  assert.equal(fake.calls, 1, "a burst for one address is one RPC call");
});

test("a stale-but-active entry survives an RPC outage", async () => {
  const future = BigInt(Math.floor(Date.now() / 1000) + 3600);
  const fake = fakeClient(() => future);
  const gate = gateWith(fake, { refreshAfterMs: 1 });

  assert.equal(await gate.isActive(ADDR), true);
  fake.setFail(true);
  await new Promise((r) => setTimeout(r, 5));

  assert.equal(await gate.isActive(ADDR), true, "known-good customer is not cut off by our outage");
  assert.equal(gate.stats().rpcFailures, 1, "but the failure is counted for alerting");
});

test("fail-closed rejects when the RPC is down and nothing is cached", async () => {
  const fake = fakeClient(() => 0n);
  fake.setFail(true);
  const gate = gateWith(fake, { onRpcFailure: "closed" });

  await assert.rejects(() => gate.isActive(ADDR), /rpc down/);
});

test("fail-open serves when the RPC is down and nothing is cached", async () => {
  const fake = fakeClient(() => 0n);
  fake.setFail(true);
  const gate = gateWith(fake, { onRpcFailure: "open" });

  assert.equal(await gate.isActive(ADDR), true);
});
