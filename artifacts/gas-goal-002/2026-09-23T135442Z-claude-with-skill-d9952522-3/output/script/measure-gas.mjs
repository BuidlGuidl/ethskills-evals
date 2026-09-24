/**
 * Measures real per-payment gas for one-tx-per-payment vs batched payouts.
 *
 * Every number comes from an actual transaction receipt on an anvil fork of
 * Base, not from a gasleft() delta: only a real transaction charges the 21,000
 * intrinsic gas, prices calldata bytes, and resets the EIP-2929 access list,
 * and those are exactly the costs batching is supposed to amortise.
 *
 * Usage:
 *   anvil --fork-url https://mainnet.base.org --silent &
 *   node script/measure-gas.mjs
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const RPC = process.env.RPC || "http://127.0.0.1:8545";
const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const BALANCES_SLOT = 9n; // FiatTokenV2.balances, confirmed against a live holder
const RELAYER = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"; // anvil account #0
const AMOUNT = 1_000_000n; // 1 USDC (6dp)
const MAX_UINT = (1n << 256n) - 1n;

let id = 1;
async function rpc(method, params = []) {
  const r = await fetch(RPC, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: id++, method, params }),
  });
  const j = await r.json();
  if (j.error) throw new Error(`${method}: ${JSON.stringify(j.error)}`);
  return j.result;
}

const hex = (n) => "0x" + n.toString(16);
const pad = (v) => (typeof v === "bigint" ? v.toString(16) : v.replace(/^0x/, "")).padStart(64, "0");
const keccak = (h) => execFileSync("cast", ["keccak", "0x" + h], { encoding: "utf8" }).trim();
const balanceSlot = (addr) => keccak(pad(addr) + pad(BALANCES_SLOT));

/** Deterministic throwaway recipient addresses; they never send, so no key is needed. */
const recipient = (tag, i) =>
  "0x" + Buffer.from(`${tag}:${i}`).toString("hex").padStart(40, "0").slice(-40);

async function setBalance(addr, amount) {
  await rpc("anvil_setStorageAt", [USDC, balanceSlot(addr), "0x" + pad(amount)]);
}

/** Polls for the receipt: anvil returns the hash before the block is sealed. */
async function receipt(h) {
  for (let i = 0; i < 200; i++) {
    const rc = await rpc("eth_getTransactionReceipt", [h]);
    if (rc) return rc;
    await new Promise((r) => setTimeout(r, 25));
  }
  throw new Error("no receipt for " + h);
}

async function send(tx) {
  const rc = await receipt(await rpc("eth_sendTransaction", [tx]));
  if (rc.status !== "0x1") throw new Error("tx reverted: " + rc.transactionHash);
  return parseInt(rc.gasUsed, 16);
}

const selector = (sig) => keccak(Buffer.from(sig).toString("hex")).slice(0, 10);
const encTransfer = (to, amt) => selector("transfer(address,uint256)") + pad(to) + pad(amt);

/** ABI-encodes (address token, address[] recipients, uint256[] amounts) or the uniform variant. */
function encBatch(uniform, recipients, amount) {
  const head = uniform
    ? selector("payUniform(address,address[],uint256)")
    : selector("pay(address,address[],uint256[])");
  const n = BigInt(recipients.length);
  const arr = (vals) => pad(BigInt(vals.length)) + vals.map(pad).join("");
  if (uniform) {
    // token, offset(recipients)=0x60, amount
    return head + pad(USDC) + pad(0x60n) + pad(amount) + arr(recipients);
  }
  const recOff = 0x60n;
  const amtOff = recOff + 32n + n * 32n;
  return (
    head + pad(USDC) + pad(recOff) + pad(amtOff) +
    arr(recipients) + arr(recipients.map(() => amount))
  );
}

// ---------------------------------------------------------------- setup ----
await rpc("anvil_setBalance", [RELAYER, hex(10n ** 18n)]);
await setBalance(RELAYER, 10n ** 15n); // 1e9 USDC, plenty for every scenario

const artifact = JSON.parse(readFileSync("out/BatchPayer.sol/BatchPayer.json", "utf8"));
const deployHash = await rpc("eth_sendTransaction", [
  { from: RELAYER, data: artifact.bytecode.object + pad(RELAYER), gas: hex(2_000_000n) },
]);
const deployRc = await receipt(deployHash);
const PAYER = deployRc.contractAddress;
console.log(`BatchPayer deployed at ${PAYER} (deploy gas ${parseInt(deployRc.gasUsed, 16)})`);

// One-time infinite approval. A finite allowance would add an SSTORE per leg.
await send({
  from: RELAYER, to: USDC, gas: hex(200_000n),
  data: selector("approve(address,uint256)") + pad(PAYER) + pad(MAX_UINT),
});

// ------------------------------------------------- baseline: one tx each ----
async function measureSingles(n, warm, tag) {
  const used = [];
  for (let i = 0; i < n; i++) {
    const to = recipient(tag, i);
    await setBalance(to, warm ? AMOUNT : 0n);
    used.push(await send({ from: RELAYER, to: USDC, gas: hex(200_000n), data: encTransfer(to, AMOUNT) }));
  }
  used.sort((a, b) => a - b);
  return used[Math.floor(used.length / 2)];
}

const singleWarm = await measureSingles(15, true, "ws");
const singleCold = await measureSingles(15, false, "cs");
console.log("\n== baseline: one transaction per payment (median gasUsed) ==");
console.log(`  existing recipient   : ${singleWarm}`);
console.log(`  first-time recipient : ${singleCold}`);

// ----------------------------------------------------------- batched -------
async function measureBatch(n, warm, uniform, tag) {
  const rs = [];
  for (let i = 0; i < n; i++) {
    const to = recipient(tag, i);
    await setBalance(to, warm ? AMOUNT : 0n);
    rs.push(to);
  }
  const total = await send({
    from: RELAYER, to: PAYER, gas: hex(30_000_000n), data: encBatch(uniform, rs, AMOUNT),
  });
  return { total, per: total / n };
}

const SIZES = [1, 5, 10, 25, 50, 100, 200, 400];
const warmBatch = {};
console.log("\n== batched, existing recipients ==");
console.log("    n |  total gas | gas/payment | vs one-tx-each");
for (const n of SIZES) {
  const { total, per } = await measureBatch(n, true, false, `bw${n}`);
  warmBatch[n] = per;
  const save = (1 - per / singleWarm) * 100;
  console.log(
    `${String(n).padStart(5)} | ${String(total).padStart(10)} | ${per.toFixed(0).padStart(11)} | ${save.toFixed(1).padStart(5)}% cheaper`
  );
}

const coldBatch = {};
console.log("\n== batched, first-time recipients ==");
for (const n of [50, 100, 200]) {
  const { per } = await measureBatch(n, false, false, `bc${n}`);
  coldBatch[n] = per;
  const save = (1 - per / singleCold) * 100;
  console.log(`${String(n).padStart(5)} | gas/payment ${per.toFixed(0).padStart(6)} | ${save.toFixed(1)}% cheaper`);
}

console.log("\n== pay vs payUniform (100 existing recipients) ==");
const payPer = (await measureBatch(100, true, false, "u1")).per;
const uniPer = (await measureBatch(100, true, true, "u2")).per;
console.log(`  pay        : ${payPer.toFixed(0)} gas/payment`);
console.log(`  payUniform : ${uniPer.toFixed(0)} gas/payment  (${((1 - uniPer / payPer) * 100).toFixed(1)}% cheaper)`);

console.log("\nRESULT " + JSON.stringify({
  singleWarm, singleCold, warmBatch, coldBatch, payPer, uniPer,
  deployGas: parseInt(deployRc.gasUsed, 16),
}));
