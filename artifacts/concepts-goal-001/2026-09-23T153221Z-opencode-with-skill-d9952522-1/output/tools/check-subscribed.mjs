#!/usr/bin/env node
// Per-request subscription check for the weather API backend.
//
// Calls WeatherBilling.isSubscribed(address) over a plain JSON-RPC eth_call.
// Read-only, costs no gas, works with any RPC provider. No dependencies -
// needs only Node 18+ (global fetch).
//
// Usage:
//   node tools/check-subscribed.mjs <customer-address> [--billing 0x...] [--rpc URL]
//
//   --billing  billing contract address (or BILLING_ADDRESS env var)
//   --rpc      RPC URL (or RPC_URL env var; default Base mainnet public RPC)
//
// Exit code 0 = subscribed, 1 = not subscribed, 2 = error.
//
// In production, import `checkSubscribed` and call it in your request path,
// optionally behind a short-TTL cache - isSubscribed only changes when the
// customer sends a transaction, so a 30-60s cache is safe.

const IS_SUBSCRIBED_SELECTOR = "0xb92ae87c"; // isSubscribed(address)
const GET_ACCOUNT_SELECTOR = "0xfbcbc0f1"; // getAccount(address)

function parseArgs(argv) {
  const args = { address: null, billing: null, rpc: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--billing") args.billing = argv[++i];
    else if (a === "--rpc") args.rpc = argv[++i];
    else if (!args.address) args.address = a;
  }
  args.billing = args.billing || process.env.BILLING_ADDRESS;
  args.rpc = args.rpc || process.env.RPC_URL || "https://mainnet.base.org";
  return args;
}

function padAddress(address) {
  return address.toLowerCase().replace(/^0x/, "").padStart(64, "0");
}

async function ethCall(rpc, to, data) {
  const res = await fetch(rpc, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_call",
      params: [{ to, data }, "latest"],
    }),
  });
  const json = await res.json();
  if (json.error) throw new Error(`RPC error: ${json.error.message}`);
  return json.result;
}

export async function checkSubscribed(rpc, billing, address) {
  const result = await ethCall(rpc, billing, IS_SUBSCRIBED_SELECTOR + padAddress(address));
  return BigInt(result) === 1n;
}

export async function getAccount(rpc, billing, address) {
  const result = await ethCall(rpc, billing, GET_ACCOUNT_SELECTOR + padAddress(address));
  // getAccount returns (uint8 plan, uint256 paidUntil, uint256 credit, uint256 monthlyPrice)
  const body = result.slice(2);
  const word = (i) => BigInt("0x" + body.slice(64 * i, 64 * (i + 1)));
  return {
    plan: ["none", "hobby", "pro"][Number(word(0))],
    paidUntil: Number(word(1)),
    creditUsdc: Number(word(2)) / 1e6,
    monthlyPriceUsdc: Number(word(3)) / 1e6,
  };
}

const isMain = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;

if (isMain) {
  const { address, billing, rpc } = parseArgs(process.argv.slice(2));
  if (!address || !billing) {
    console.error(
      "Usage: node tools/check-subscribed.mjs <customer-address> --billing 0x... [--rpc URL]"
    );
    process.exit(2);
  }
  try {
    const subscribed = await checkSubscribed(rpc, billing, address);
    const detail = subscribed ? await getAccount(rpc, billing, address) : null;
    console.log(
      `${address}: ${subscribed ? "SUBSCRIBED" : "not subscribed"}` +
        (detail ? ` (plan=${detail.plan}, paid until ${new Date(detail.paidUntil * 1000).toISOString()}, credit=$${detail.creditUsdc})` : "")
    );
    process.exit(subscribed ? 0 : 1);
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(2);
  }
}