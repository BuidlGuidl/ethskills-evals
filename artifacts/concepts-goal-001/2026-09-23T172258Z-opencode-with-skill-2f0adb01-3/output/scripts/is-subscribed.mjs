#!/usr/bin/env node
// Per-request subscription check for the API backend.
// Zero dependencies — talks plain JSON-RPC (eth_call), so it costs no gas
// and takes ~1 round trip to your RPC endpoint. Safe to call per request;
// add a few seconds of caching if you want to cut RPC load.
//
// Usage:
//   RPC_URL=https://mainnet.base.org BILLING_CONTRACT=0x... \
//     node scripts/is-subscribed.mjs 0xCustomerAddress
//
// Exit code 0 + prints "true"/"false".

const [customer] = process.argv.slice(2);
const { RPC_URL, BILLING_CONTRACT } = process.env;

if (!customer || !RPC_URL || !BILLING_CONTRACT) {
  console.error("Usage: RPC_URL=... BILLING_CONTRACT=... node scripts/is-subscribed.mjs <address>");
  process.exit(1);
}

// keccak("isActive(address)")[0:4]
const IS_ACTIVE_SELECTOR = "0x9f8a13d7";

const calldata = IS_ACTIVE_SELECTOR + customer.toLowerCase().replace(/^0x/, "").padStart(64, "0");

const res = await fetch(RPC_URL, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "eth_call",
    params: [{ to: BILLING_CONTRACT, data: calldata }, "latest"],
  }),
});

const { result, error } = await res.json();
if (error) {
  console.error("RPC error:", error);
  process.exit(1);
}

const active = BigInt(result) !== 0n;
console.log(active);
process.exit(active ? 0 : 0);
