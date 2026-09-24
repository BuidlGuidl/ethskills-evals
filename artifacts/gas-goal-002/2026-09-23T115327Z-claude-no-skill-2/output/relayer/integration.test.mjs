/**
 * End-to-end test of the shipped payout path against a Base fork.
 *
 * Proves the operational claim the batching plan rests on: one bad recipient inside a
 * batch is quarantined and everybody else still gets paid, rather than the whole batch
 * reverting. Uses real Base USDC, including its real blacklist behaviour.
 *
 *   anvil --fork-url https://base-rpc.publicnode.com --port 8545 --silent &
 *   node relayer/integration.test.mjs
 */
import {
  createPublicClient, createWalletClient, http, parseAbi, getAddress,
  keccak256, encodeAbiParameters, pad, toHex, numberToHex, encodeFunctionData,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";
import { readFileSync } from "node:fs";
import { runPayoutCycle } from "./run-payouts.mjs";
import { planBatches, partitionByEncodability } from "./batcher.mjs";
import { packPayouts, unpackPayload, MAX_PACKED_AMOUNT } from "./encode.mjs";

const LOCAL = "http://127.0.0.1:8545";
const USDC = getAddress("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913");
const BALANCE_SLOT = 9n;
/** FiatTokenV2_2 packs the blacklist flag into the top bit of the balance word. */
const BLACKLIST_BIT = 1n << 255n;

const relayer = privateKeyToAccount("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80");
const publicClient = createPublicClient({ chain: base, transport: http(LOCAL), pollingInterval: 50 });
const walletClient = createWalletClient({ account: relayer, chain: base, transport: http(LOCAL) });
const erc20 = parseAbi(["function balanceOf(address) view returns (uint256)", "function approve(address,uint256) returns (bool)"]);

const rpc = (method, params) =>
  fetch(LOCAL, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) })
    .then((r) => r.json()).then((j) => { if (j.error) throw new Error(JSON.stringify(j.error)); return j.result; });

const slotOf = (a) => keccak256(encodeAbiParameters([{ type: "address" }, { type: "uint256" }], [a, BALANCE_SLOT]));
const setBalanceWord = (a, word) => rpc("anvil_setStorageAt", [USDC, slotOf(a), pad(toHex(word), { size: 32 })]);

let failures = 0;
const check = (name, cond, detail = "") => {
  console.log(`${cond ? "  ok  " : "FAIL  "}${name}${detail ? " — " + detail : ""}`);
  if (!cond) failures++;
};

// ---------------------------------------------------------------- pure unit checks
{
  const payouts = Array.from({ length: 7 }, (_, i) => ({ recipient: pad(toHex(i + 1), { size: 20 }), amount: 1n }));
  check("planBatches splits on the boundary", JSON.stringify(planBatches(payouts, 3).map((b) => b.length)) === "[3,3,1]");
  check("packed payload is 32 bytes per payout", (packPayouts(payouts).length - 2) / 2 === 7 * 32);
  check("pack/unpack round-trips", unpackPayload(packPayouts(payouts)).length === 7);

  const over = [{ recipient: pad(toHex(1), { size: 20 }), amount: MAX_PACKED_AMOUNT + 1n }];
  let threw = false;
  try { packPayouts(over); } catch { threw = true; }
  check("oversized amount is rejected, not truncated", threw);
  check("partitionByEncodability routes oversized separately", partitionByEncodability([...payouts, ...over]).oversized.length === 1);
}

// ---------------------------------------------------------------- on-fork behaviour
await rpc("anvil_setBalance", [relayer.address, numberToHex(10n ** 20n)]);
await setBalanceWord(relayer.address, 10_000_000_000_000n);

const art = JSON.parse(readFileSync(new URL("../out/BatchTransfer.sol/BatchTransfer.json", import.meta.url)));
const deployHash = await rpc("eth_sendTransaction", [{ from: relayer.address, data: art.bytecode.object, gas: numberToHex(5_000_000) }]);
const batcher = getAddress((await publicClient.waitForTransactionReceipt({ hash: deployHash })).contractAddress);

await walletClient.sendTransaction({
  to: USDC,
  data: encodeFunctionData({ abi: erc20, functionName: "approve", args: [batcher, 2n ** 256n - 1n] }),
});

const good = Array.from({ length: 6 }, (_, i) => getAddress(pad(toHex(BigInt(0xaa0000) + BigInt(i)), { size: 20 })));
const blacklisted = getAddress(pad(toHex(0xbb0001n), { size: 20 }));
await Promise.all(good.map((a) => setBalanceWord(a, 1n)));
await setBalanceWord(blacklisted, BLACKLIST_BIT); // blacklisted, zero balance

// Put the bad recipient in the middle so we also prove ordering is preserved around it.
const payouts = [
  ...good.slice(0, 3).map((r) => ({ recipient: r, amount: 5_000_000n })),
  { recipient: blacklisted, amount: 5_000_000n },
  ...good.slice(3).map((r) => ({ recipient: r, amount: 5_000_000n })),
];

const result = await runPayoutCycle({ publicClient, walletClient }, { token: USDC, batcher, payouts, batchSize: 250 });

check("batch was broadcast despite the bad recipient", result.receipts.length === 1);
check("the blacklisted payout was quarantined", result.quarantined.length === 1,
  result.quarantined.map((q) => q.recipient).join(","));
check("quarantined entry is the blacklisted address",
  result.quarantined[0]?.recipient?.toLowerCase() === blacklisted.toLowerCase());

const paid = await Promise.all(good.map((a) => publicClient.readContract({ address: USDC, abi: erc20, functionName: "balanceOf", args: [a] })));
check("all six good recipients were paid", paid.every((b) => b === 5_000_001n), paid.map(String).join(","));

const badBal = await publicClient.readContract({ address: USDC, abi: erc20, functionName: "balanceOf", args: [blacklisted] });
check("blacklisted recipient received nothing", badBal === 0n);

const perPayout = Number(result.gasUsed) / good.length;
console.log(`\ngas: ${result.gasUsed} total for ${good.length} payouts (${perPayout.toFixed(0)}/payout)`);

console.log(failures === 0 ? "\nAll integration checks passed." : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
