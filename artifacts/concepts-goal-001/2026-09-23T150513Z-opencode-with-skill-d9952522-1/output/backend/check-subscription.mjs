// Per-request subscription check for the API backend.
//
//   npm install viem
//   RPC_URL=https://mainnet.base.org BILLING_ADDRESS=0x... node backend/check-subscription.mjs 0xCustomerAddress
//
// This is a single `eth_call` — free, no transaction, ~50ms against any RPC.
// Call it per incoming API request (optionally behind a few-second cache).

import { createPublicClient, http } from "viem";
import { base } from "viem/chains";

const client = createPublicClient({
  chain: base,
  transport: http(process.env.RPC_URL),
});

const billingAbi = [
  {
    name: "isSubscribed",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "bool" }],
  },
  {
    name: "subscribedUntil",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
];

const billing = process.env.BILLING_ADDRESS;
const account = process.argv[2];

const [subscribed, until] = await Promise.all([
  client.readContract({
    address: billing,
    abi: billingAbi,
    functionName: "isSubscribed",
    args: [account],
  }),
  client.readContract({
    address: billing,
    abi: billingAbi,
    functionName: "subscribedUntil",
    args: [account],
  }),
]);

console.log(`${account}: subscribed=${subscribed}` +
  (subscribed ? ` until=${new Date(Number(until) * 1000).toISOString()}` : ""));
process.exit(subscribed ? 0 : 1);
