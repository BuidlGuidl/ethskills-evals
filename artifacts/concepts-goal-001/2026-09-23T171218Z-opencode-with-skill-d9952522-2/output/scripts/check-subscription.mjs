#!/usr/bin/env node
/**
 * Per-request subscription check for the API backend. Zero dependencies —
 * a plain JSON-RPC eth_call, which costs no gas and never writes onchain.
 *
 * Usage:
 *   BILLING_ADDRESS=0x... RPC_URL=https://mainnet.base.org \
 *     node scripts/check-subscription.mjs 0xCustomerAddress
 *
 * Prints { subscribed, secondsUntilLapse } and exits 0 when subscribed, 1 when not.
 * In the real API, call this in your auth middleware; caching the result for a
 * few seconds per address is fine and cuts RPC load (see NOTES.md).
 */

const [address] = process.argv.slice(2);
const { BILLING_ADDRESS, RPC_URL } = process.env;

if (!address || !BILLING_ADDRESS || !RPC_URL) {
  console.error("usage: BILLING_ADDRESS=0x... RPC_URL=... node check-subscription.mjs 0xAddress");
  process.exit(2);
}

// Function selectors (cast sig): isSubscribed(address), timeUntilLapse(address)
const IS_SUBSCRIBED = "0xb92ae87c";
const TIME_UNTIL_LAPSE = "0x3325cd57";
const arg = address.toLowerCase().replace("0x", "").padStart(64, "0");

async function ethCall(data) {
  const res = await fetch(RPC_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_call",
      params: [{ to: BILLING_ADDRESS, data }, "latest"],
    }),
  });
  const json = await res.json();
  if (json.error) throw new Error(JSON.stringify(json.error));
  return BigInt(json.result);
}

const [subscribed, secondsUntilLapse] = await Promise.all([
  ethCall(IS_SUBSCRIBED + arg),
  ethCall(TIME_UNTIL_LAPSE + arg),
]);

console.log(
  JSON.stringify({ subscribed: subscribed !== 0n, secondsUntilLapse: Number(secondsUntilLapse) })
);
process.exit(subscribed !== 0n ? 0 : 1);
