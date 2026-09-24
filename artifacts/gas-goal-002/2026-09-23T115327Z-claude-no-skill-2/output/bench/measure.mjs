/**
 * Gas benchmark for the relayer payout path.
 *
 * Runs against an anvil fork of Base mainnet and reads REAL TRANSACTION RECEIPTS, so
 * every number is directly comparable to a mainnet receipt's `gasUsed`. We deliberately
 * do not use `forge test` gas numbers here: the Foundry harness meters a top-level call
 * as a pseudo-transaction and adds ~21.7k even to a no-op, which silently inflates
 * anything measured with `gasleft()`.
 *
 * Usage:
 *   anvil --fork-url https://mainnet.base.org --port 8545 --silent &
 *   node bench/measure.mjs
 */
import {
  createWalletClient, createPublicClient, http, encodeFunctionData,
  parseAbi, concatHex, pad, toHex, numberToHex, getAddress, keccak256, encodeAbiParameters,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const LOCAL = "http://127.0.0.1:8545";
// Fork source; a throttled endpoint will stall anvil mid-run.
const FORK_RPC = process.env.BASE_RPC_URL || "https://base-rpc.publicnode.com";
const USDC = getAddress("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913");
const AMOUNT = 5_000_000n; // 5 USDC, a realistic payout size

const relayer = privateKeyToAccount("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80");

const pub = createPublicClient({ chain: base, transport: http(LOCAL), pollingInterval: 50 });
const wallet = createWalletClient({ account: relayer, chain: base, transport: http(LOCAL) });

const erc20 = parseAbi([
  "function transfer(address,uint256) returns (bool)",
  "function approve(address,uint256) returns (bool)",
  "function balanceOf(address) view returns (uint256)",
]);
const batchAbi = parseAbi([
  "function batchTransfer(address token, address[] recipients, uint256[] amounts)",
  "function batchTransferPacked(address token, bytes payload)",
]);

/**
 * JSON-RPC against the fork, with backoff.
 *
 * Retries matter here even though the endpoint is local: any call that misses the fork
 * cache is served by an upstream fetch, so a public RPC's rate limit surfaces as a
 * transient local error rather than a clean one.
 */
async function rpc(method, params = []) {
  let lastErr;
  for (let attempt = 0; attempt < 7; attempt++) {
    try {
      const res = await fetch(LOCAL, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      });
      const json = await res.json();
      if (json.error) throw new Error(`${method}: ${JSON.stringify(json.error)}`);
      return json.result;
    } catch (err) {
      lastErr = err;
      await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
    }
  }
  throw lastErr;
}

/** Send a tx and return its receipt gasUsed plus the calldata we sent. */
async function send(to, data, from = relayer.address) {
  const hash = await rpc("eth_sendTransaction", [{ from, to, data, gas: numberToHex(100_000_000) }]);
  const r = await pub.waitForTransactionReceipt({ hash, timeout: 600_000, pollingInterval: 50 });
  if (r.status !== "success") throw new Error("tx reverted: " + hash);
  return { gasUsed: Number(r.gasUsed), data };
}

/**
 * USDC (FiatTokenV2_2) keeps balances in `balanceAndBlacklistStates` at storage slot 9:
 * the low 255 bits are the balance, the top bit is the blacklist flag. Verified against
 * the live contract — slot 9 for a known holder equals their balanceOf exactly.
 */
const USDC_BALANCE_SLOT = 9n;
const balanceSlotOf = (addr) =>
  keccak256(encodeAbiParameters([{ type: "address" }, { type: "uint256" }], [addr, USDC_BALANCE_SLOT]));

/**
 * Seed a recipient's USDC balance directly as state.
 *
 * Both the "does this address exist" and "what is its token balance" lookups otherwise
 * miss the fork cache and go upstream. A 250-recipient batch needs 250 of them in a burst,
 * which trips the public RPC's rate limit and wedges anvil mid-run. Writing the slot
 * locally produces exactly the state a prefunding transfer would have left behind — and
 * the only thing that matters for gas is whether the slot is zero or non-zero.
 */
async function seedBalances(addrs, balance) {
  // Only the token's storage slot is touched. Deliberately no anvil_setBalance here:
  // it makes anvil load the recipient's account from upstream, and an ERC-20 transfer
  // never reads the recipient account anyway — only the token's balance mapping.
  const word = pad(toHex(balance), { size: 32 });
  for (let i = 0; i < addrs.length; i += 50) {
    await Promise.all(
      addrs.slice(i, i + 50).map((a) => rpc("anvil_setStorageAt", [USDC, balanceSlotOf(a), word])),
    );
  }
}

let nonce = 0;
function freshAddrs(n) {
  return Array.from({ length: n }, () => {
    nonce++;
    return getAddress(pad(toHex(BigInt("0x" + nonce.toString(16).padStart(8, "0")) + 0x1000000000n), { size: 20 }));
  });
}

function packPayload(recipients, amount) {
  return concatHex(recipients.map((r) => concatHex([r.toLowerCase(), pad(toHex(amount), { size: 12 })])));
}

async function setup() {
  await rpc("anvil_setBalance", [relayer.address, numberToHex(10n ** 20n)]);
  // Fund the relayer by writing the balance slot directly. Draining a real whale instead
  // makes the run depend on that account's current balance and on how many times the
  // benchmark has already been run against the same fork.
  await seedBalances([relayer.address], 10_000_000_000_000n); // 10M USDC
  const funded = await pub.readContract({ address: USDC, abi: erc20, functionName: "balanceOf", args: [relayer.address] });
  if (funded === 0n) throw new Error("relayer funding failed — check USDC_BALANCE_SLOT");

  const art = JSON.parse(readFileSync("out/BatchTransfer.sol/BatchTransfer.json", "utf8"));
  const hash = await rpc("eth_sendTransaction", [{ from: relayer.address, data: art.bytecode.object, gas: numberToHex(5_000_000) }]);
  const rec = await pub.waitForTransactionReceipt({ hash });
  const batcher = getAddress(rec.contractAddress);
  await send(USDC, encodeFunctionData({ abi: erc20, functionName: "approve", args: [batcher, 2n ** 256n - 1n] }));
  console.log(`deployed BatchTransfer at ${batcher} (deploy gas ${rec.gasUsed})`);
  return batcher;
}

/**
 * Give recipients a non-zero balance slot (rewriting it costs 2,900 gas; writing a zero
 * slot costs 20,000). This is the single biggest driver of per-payout cost variance.
 */
const prefund = (addrs) => seedBalances(addrs, 1n);

async function measureBaseline(existing) {
  const addrs = freshAddrs(12);
  await (existing ? prefund(addrs) : seedBalances(addrs, 0n));
  const runs = [];
  for (const a of addrs) {
    runs.push(await send(USDC, encodeFunctionData({ abi: erc20, functionName: "transfer", args: [a, AMOUNT] })));
  }
  const g = runs.map((r) => r.gasUsed).sort((x, y) => x - y);
  return { perTransfer: g[Math.floor(g.length / 2)], sample: runs[0] };
}

async function measureBatch(batcher, n, packed, existing) {
  const addrs = freshAddrs(n);
  await (existing ? prefund(addrs) : seedBalances(addrs, 0n));
  const data = packed
    ? encodeFunctionData({ abi: batchAbi, functionName: "batchTransferPacked", args: [USDC, packPayload(addrs, AMOUNT)] })
    : encodeFunctionData({ abi: batchAbi, functionName: "batchTransfer", args: [USDC, addrs, addrs.map(() => AMOUNT)] });
  const r = await send(batcher, data);
  return { total: r.gasUsed, perTransfer: r.gasUsed / n, data };
}

/**
 * Exact L1 data fee for a payload, from Base's GasPriceOracle predeploy.
 *
 * Queried on the fork, not upstream: the predeploy carries the real oracle state from the
 * fork block, so the answer is the same, and it keeps a per-measurement remote call out of
 * the loop. Routing this to a public RPC previously got rate-limited and hung the run.
 */
async function l1Fee(data) {
  return pub.readContract({
    address: "0x420000000000000000000000000000000000000F",
    abi: parseAbi(["function getL1Fee(bytes) view returns (uint256)"]),
    functionName: "getL1Fee",
    args: [data],
  });
}

const batcher = await setup();
const results = { baseline: {}, batch: [] };

for (const existing of [true, false]) {
  const key = existing ? "existingRecipient" : "newRecipient";
  const b = await measureBaseline(existing);
  results.baseline[key] = { perTransferL2: b.perTransfer, l1Fee: (await l1Fee(b.sample.data)).toString() };
  console.log(`baseline (${key}): ${b.perTransfer} gas/transfer`);
}

const SIZES = [1, 2, 3, 5, 10, 25, 50, 100, 250];
for (const existing of [true, false]) {
  for (const packed of [false, true]) {
    for (const n of SIZES) {
      const r = await measureBatch(batcher, n, packed, existing);
      const fee = await l1Fee(r.data);
      results.batch.push({
        n, packed, existingRecipient: existing,
        totalL2: r.total,
        perTransferL2: Math.round(r.perTransfer),
        l1FeeWei: fee.toString(),
        l1FeePerTransferWei: (Number(fee) / n).toFixed(0),
      });
      console.log(`batch n=${String(n).padStart(3)} ${packed ? "packed  " : "unpacked"} ${existing ? "existing" : "new     "}: ${String(r.total).padStart(9)} total, ${String(Math.round(r.perTransfer)).padStart(6)} gas/transfer`);
    }
  }
}

mkdirSync("bench/out", { recursive: true });
writeFileSync("bench/out/results.json", JSON.stringify(results, null, 2));
console.log("\nwrote bench/out/results.json");
