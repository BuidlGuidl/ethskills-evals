/**
 * End-to-end check of the billing loop against a local anvil, exercising the same gate the API
 * server uses. Run:
 *
 *   anvil &
 *   forge script script/LocalDev.s.sol --rpc-url http://127.0.0.1:8545 --broadcast \
 *     --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
 *   node backend/e2e.mjs
 */
import {readFileSync} from "node:fs";
import {createWalletClient, createPublicClient, http, parseUnits, getAddress} from "viem";
import {privateKeyToAccount} from "viem/accounts";
import {foundry} from "viem/chains";
import {SubscriptionGate} from "./subscriptionGate.js";
import {subscriptionBillingAbi} from "./abi.js";

const RPC = process.env.RPC_URL ?? "http://127.0.0.1:8545";
const {billing, usdc} = JSON.parse(readFileSync(new URL("../deployments/local.json", import.meta.url)));

const customer = privateKeyToAccount("0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d");
const wallet = createWalletClient({account: customer, chain: foundry, transport: http(RPC)});
const pub = createPublicClient({chain: foundry, transport: http(RPC)});

const erc20Abi = [
  {type: "function", name: "approve", stateMutability: "nonpayable", inputs: [{type: "address"}, {type: "uint256"}], outputs: [{type: "bool"}]},
  {type: "function", name: "balanceOf", stateMutability: "view", inputs: [{type: "address"}], outputs: [{type: "uint256"}]},
];
const writeAbi = [
  {type: "function", name: "subscribe", stateMutability: "nonpayable", inputs: [{type: "uint256"}, {type: "uint256"}], outputs: []},
  {type: "function", name: "cancel", stateMutability: "nonpayable", inputs: [], outputs: []},
  {type: "function", name: "settle", stateMutability: "nonpayable", inputs: [{type: "address"}], outputs: []},
];
const accruedAbi = [
  {type: "function", name: "operatorAccrued", stateMutability: "view", inputs: [], outputs: [{type: "uint256"}]},
  {type: "function", name: "pendingCharge", stateMutability: "view", inputs: [{type: "address"}], outputs: [{type: "uint256"}]},
];
const readAccrued = (name, args = []) => pub.readContract({address: billing, abi: accruedAbi, functionName: name, args});

let failures = 0;
function check(label, actual, expected) {
  const ok = actual === expected;
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `  (got ${actual}, want ${expected})`}`);
}

/** Anvil advances the clock a second per transaction, so exact-to-the-microdollar is the wrong
 *  assertion for anything time-based. A few base units of slack is a few millionths of a dollar. */
function checkNear(label, actual, expected, tolerance = 10n) {
  const delta = actual > expected ? actual - expected : expected - actual;
  const ok = delta <= tolerance;
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `  (got ${actual}, want ~${expected})`}`);
}

async function send(address, abi, functionName, args) {
  const hash = await wallet.writeContract({address, abi, functionName, args});
  return pub.waitForTransactionReceipt({hash});
}

const gate = new SubscriptionGate({address: billing, chain: foundry, rpcUrl: RPC, positiveTtlMs: 200, negativeTtlMs: 200});
gate.watch();

console.log(`billing ${billing}\ncustomer ${customer.address}\n`);

// Make the script re-runnable against a chain that already has state on it: clear any leftover
// subscription and measure revenue as a delta rather than an absolute.
if ((await gate.accountOf(customer.address)).planId !== 0n) {
  await send(usdc, erc20Abi, "approve", [billing, parseUnits("1000", 6)]);
  await send(billing, writeAbi, "cancel", []);
}
const baselineAccrued = await readAccrued("operatorAccrued");

// 1. A stranger is not subscribed, and the gate says so without any special casing.
check("unknown address is not subscribed", await gate.isSubscribed("0x000000000000000000000000000000000000dEaD"), false);

// 2. Before subscribing, the customer is not subscribed either.
check("customer not subscribed before signup", await gate.isSubscribed(customer.address), false);

// 3. Sign up for hobby with $15 — three months of runway.
await send(usdc, erc20Abi, "approve", [billing, parseUnits("1000", 6)]);
await send(billing, writeAbi, "subscribe", [1n, parseUnits("15", 6)]);
await new Promise((r) => setTimeout(r, 300)); // let the TTL lapse so we re-read
check("customer subscribed after signup", await gate.isSubscribed(customer.address), true);

// The cache is the whole reason this gate exists: a burst of requests from one subscriber costs
// one RPC call, not one per request.
const hitsBefore = gate.stats.hits;
await Promise.all(Array.from({length: 50}, () => gate.isSubscribed(customer.address)));
check("a burst of 50 requests is served from cache", gate.stats.hits >= hitsBefore + 49, true);

const acct = await gate.accountOf(customer.address);
check("plan id is hobby", acct.planId, 1n);
check("prepaid balance is $15", acct.balance, parseUnits("15", 6));
const runwayDays = Number(acct.activeUntil - BigInt((await pub.getBlock()).timestamp)) / 86400;
check("about 90 days of runway", Math.round(runwayDays), 90);

// 4. Two months pass with nobody sending a single transaction. The charge accrued anyway.
await pub.request({method: "evm_increaseTime", params: [`0x${(60 * 86400).toString(16)}`]});
await pub.request({method: "evm_mine", params: []});
const afterTwoMonths = await gate.accountOf(customer.address);
checkNear("two months billed with zero transactions", afterTwoMonths.balance - afterTwoMonths.unusedBalance, parseUnits("10", 6));
check("still subscribed on the last month", afterTwoMonths.active, true);

// 5. Cancel: refund is exactly the unused month, and the gate flips immediately on the event.
const before = await pub.readContract({address: usdc, abi: erc20Abi, functionName: "balanceOf", args: [customer.address]});
await send(billing, writeAbi, "cancel", []);
const after = await pub.readContract({address: usdc, abi: erc20Abi, functionName: "balanceOf", args: [customer.address]});
checkNear("cancel refunds the unused month", after - before, parseUnits("5", 6));

await new Promise((r) => setTimeout(r, 300));
check("gate reports cancelled customer as unsubscribed", await gate.isSubscribed(customer.address), false);

// 6. The prepaid runway lapses on its own, with no cancel and no keeper.
await send(usdc, erc20Abi, "approve", [billing, parseUnits("1000", 6)]);
await send(billing, writeAbi, "subscribe", [1n, parseUnits("5", 6)]); // exactly one month
check("subscribed again", (await gate.accountOf(customer.address)).active, true);
await pub.request({method: "evm_increaseTime", params: [`0x${(31 * 86400).toString(16)}`]});
await pub.request({method: "evm_mine", params: []});
check("lapses by itself when the prepayment runs out", (await gate.accountOf(customer.address)).active, false);
check("nothing left to refund", (await gate.accountOf(customer.address)).unusedBalance, 0n);

// 7. The operator has not sent a single transaction in this whole script, yet the two months the
//    customer used before cancelling are already booked as withdrawable revenue — `cancel` settled
//    them on the way out.
checkNear("revenue booked by the customer's own cancel", (await readAccrued("operatorAccrued")) - baselineAccrued, parseUnits("10", 6));

// 8. The month consumed by the lapsed second subscription is earned but not yet written down.
//    That is the intended steady state: it is owed, it cannot be spent by the customer, and
//    nothing degrades while it sits there.
checkNear("lapsed month is earned but unsettled", await readAccrued("pendingCharge", [customer.address]), parseUnits("5", 6));

// 9. Anyone at all can write it down — here the customer's own key does it, to make the point
//    that settlement needs no privileged caller and no scheduler.
await send(billing, writeAbi, "settle", [customer.address]);
checkNear("settling books the rest, from any caller", (await readAccrued("operatorAccrued")) - baselineAccrued, parseUnits("15", 6));
check("nothing left unsettled", await readAccrued("pendingCharge", [customer.address]), 0n);

gate.stop();
console.log(`\ngate stats: ${JSON.stringify(gate.stats)}`);
console.log(failures === 0 ? "\nall e2e checks passed" : `\n${failures} e2e check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
