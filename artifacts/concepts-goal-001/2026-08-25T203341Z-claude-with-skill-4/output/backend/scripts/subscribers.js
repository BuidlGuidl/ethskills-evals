#!/usr/bin/env node
/**
 * Print the addresses worth settling, one per line, for `script/Sweep.s.sol`.
 *
 * The contract keeps no array of subscribers on purpose: a loop over every account that ever
 * subscribed would grow without bound and eventually cost more gas than a block holds, at which
 * point the operator could no longer get paid at all. The list lives off-chain instead, rebuilt
 * from the event log — which is public, so anyone can rebuild it, including whoever picks this
 * up if I disappear.
 *
 *   RPC_URL=... BILLING_ADDRESS=0x... node backend/scripts/subscribers.js > accounts.txt
 *
 * Options via env:
 *   BILLING_START_BLOCK  block the contract was deployed at (skips pointless log scanning)
 *   MIN_PENDING          skip accounts owing less than this many base units (default 100000 = $0.10)
 *   LOG_CHUNK            blocks per getLogs call (default 50000; lower it if your RPC complains)
 */
import {createPublicClient, http, parseAbiItem, getAddress} from "viem";
import {config} from "../src/config.js";
import {billingAbi} from "../src/abi.js";

const client = createPublicClient({chain: config.chain, transport: http(config.rpcUrl)});
const address = getAddress(config.billingAddress);
const minPending = BigInt(process.env.MIN_PENDING ?? 100_000n);
const chunk = BigInt(process.env.LOG_CHUNK ?? 50_000n);

// Every account that has ever subscribed. Cancelling deletes the onchain account but not the log,
// so the set only grows; `pendingOfMany` below is what filters it down to accounts worth gas.
const subscribed = parseAbiItem("event Subscribed(address indexed account, uint8 indexed planId, uint64 ratePerPeriod)");

const head = await client.getBlockNumber();
const accounts = new Set();

for (let from = config.startBlock; from <= head; from += chunk) {
  const to = from + chunk - 1n > head ? head : from + chunk - 1n;
  const logs = await client.getLogs({address, event: subscribed, fromBlock: from, toBlock: to});
  for (const l of logs) accounts.add(getAddress(l.args.account));
  process.stderr.write(`scanned ${from}-${to} (${accounts.size} accounts)\r`);
}
process.stderr.write("\n");

// Ask the contract which of them actually owe anything, so the sweep does not burn gas writing
// zeroes. Batched, because `pendingOfMany` over thousands of addresses can exceed the node's
// eth_call gas cap.
const all = [...accounts];
const worth = [];
let total = 0n;

for (let i = 0; i < all.length; i += 200) {
  const batch = all.slice(i, i + 200);
  const perAccount = await Promise.all(
    batch.map((a) =>
      client.readContract({address, abi: billingAbi, functionName: "pendingOfMany", args: [[a]]}),
    ),
  );
  perAccount.forEach((pending, j) => {
    if (pending >= minPending) {
      worth.push(batch[j]);
      total += pending;
    }
  });
}

for (const a of worth) console.log(a);

const claimable = await client.readContract({address, abi: billingAbi, functionName: "claimable"});
process.stderr.write(
  `\n${worth.length} of ${all.length} accounts worth settling` +
    `\npending:   ${fmt(total)} USDC` +
    `\nclaimable: ${fmt(claimable)} USDC (already settled, waiting on collect())\n`,
);

function fmt(units) {
  return (Number(units) / 1e6).toFixed(2);
}
