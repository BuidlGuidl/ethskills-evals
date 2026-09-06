#!/usr/bin/env node
/**
 * One-off subscription lookup, straight from the chain, no cache, no server.
 *
 *   RPC_URL=... BILLING_ADDRESS=0x... node backend/scripts/check.js 0xCustomer
 *
 * Worth keeping around: when a customer says "I paid and it says I'm not subscribed", this
 * separates "the chain disagrees" from "my cache is stale" in one command.
 */
import {createPublicClient, http, getAddress} from "viem";
import {config} from "../src/config.js";
import {billingAbi} from "../src/abi.js";

const target = process.argv[2];
if (!target) {
  console.error("usage: node scripts/check.js <address>");
  process.exit(1);
}

const client = createPublicClient({chain: config.chain, transport: http(config.rpcUrl)});
const [subscribed, planId, expiry, refundable, rate] = await client.readContract({
  address: getAddress(config.billingAddress),
  abi: billingAbi,
  functionName: "statusOf",
  args: [getAddress(target)],
});

const now = Math.floor(Date.now() / 1000);
console.log({
  address: getAddress(target),
  subscribed,
  planId: Number(planId),
  expiresAt: expiry ? new Date(Number(expiry) * 1000).toISOString() : null,
  secondsRemaining: expiry > now ? Number(expiry) - now : 0,
  refundableUsdc: (Number(refundable) / 1e6).toFixed(6),
  monthlyUsdc: (Number(rate) / 1e6).toFixed(2),
  blockTimeChecked: new Date().toISOString(),
});
