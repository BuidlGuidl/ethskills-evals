// One-shot subscription check — used by script/e2e.sh and handy for support
// ("is this customer actually paid up right now?").
//
//   RPC_URL=... BILLING_ADDRESS=0x... CUSTOMER=0x... node backend/checkOnce.js
import { defineChain } from "viem";
import { createSubscriptionGate } from "./subscriptionGate.js";

const anvil = defineChain({
  id: 31337,
  name: "anvil",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [process.env.RPC_URL ?? "http://127.0.0.1:8545"] } },
});

const gate = createSubscriptionGate({
  rpcUrl: process.env.RPC_URL,
  contractAddress: process.env.BILLING_ADDRESS,
  chain: anvil,
});

const status = await gate.check(process.env.CUSTOMER);
console.log("   gate says:", {
  active: status.active,
  planId: status.planId,
  balanceUsdc: Number(status.balance) / 1e6,
  expiresAt: new Date(status.expiry * 1000).toISOString(),
});
if (!status.active) {
  console.error("FAIL: gate reports inactive");
  process.exit(1);
}
