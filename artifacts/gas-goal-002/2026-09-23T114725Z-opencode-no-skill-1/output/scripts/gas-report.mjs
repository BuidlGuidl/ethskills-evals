// SPDX-License-Identifier: MIT
// Gas spend report for the payments relayer on Base.
// Pulls live values from the Base RPC + GasPriceOracle predeploy + ETH/USD spot,
// then prints current vs optimized daily/monthly spend. Zero-dependency (node >= 18).
//
// Usage: node scripts/gas-report.mjs [transfersPerDay]

const RPC = process.env.BASE_RPC ?? "https://mainnet.base.org";
const GAS_PRICE_ORACLE = "0x420000000000000000000000000000000000000F";
const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

// Measured on a Base mainnet fork (anvil), real USDC, warm recipients, 2026-09:
const GAS_STANDALONE = 45_071; // 1 tx per transfer (from receipt gasUsed)
const GAS_BATCHED_PER_TRANSFER = 11_906; // batchTransferPacked, 50 transfers in 1 tx
const BATCH_SIZE = 50;
// Serialized tx sizes for L1 data fee:
const BYTES_STANDALONE_TX = 112;
const BYTES_BATCHED_TX = 100 + 32 * BATCH_SIZE; // envelope+fixed args + 32B/entry

const TRANSFERS_PER_DAY = Number(process.argv[2] ?? 40_000);

async function rpc(method, params) {
  const res = await fetch(RPC, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const json = await res.json();
  if (json.error) throw new Error(`${method}: ${json.error.message}`);
  return json.result;
}

const gwei = (wei) => Number(wei) / 1e9;

async function main() {
  const [block, l1FeeStandaloneHex, l1FeeBatchedHex, l1BaseFeeHex, priceJson] = await Promise.all([
    rpc("eth_getBlockByNumber", ["latest", false]),
    // getL1FeeUpperBound(uint256) selector 0xf1c7a58b
    rpc("eth_call", [
      { to: GAS_PRICE_ORACLE, data: "0xf1c7a58b" + BYTES_STANDALONE_TX.toString(16).padStart(64, "0") },
      "latest",
    ]),
    rpc("eth_call", [
      { to: GAS_PRICE_ORACLE, data: "0xf1c7a58b" + BYTES_BATCHED_TX.toString(16).padStart(64, "0") },
      "latest",
    ]),
    // l1BaseFee() selector 0x519b4bd3
    rpc("eth_call", [{ to: GAS_PRICE_ORACLE, data: "0x519b4bd3" }, "latest"]),
    fetch("https://api.coinbase.com/v2/prices/ETH-USD/spot").then((r) => r.json()),
  ]);

  const baseFee = BigInt(block.baseFeePerGas); // wei
  const tip = 1_000_000n; // 0.001 gwei: what RPC-suggested gas price adds over base fee
  const l1FeeStandalone = BigInt(l1FeeStandaloneHex); // wei per tx
  const l1FeeBatchedTx = BigInt(l1FeeBatchedHex); // wei per 50-transfer tx
  const l1BaseFee = BigInt(l1BaseFeeHex);
  const ethUsd = Number(priceJson.data.amount);
  const utilization = Number(BigInt(block.gasUsed)) / Number(BigInt(block.gasLimit));

  const usd = (wei) => (Number(wei) / 1e18) * ethUsd;

  const rows = [
    {
      name: "Today: 1 tx per transfer, RPC-suggested price (base+0.001 tip)",
      l2WeiPerTransfer: BigInt(GAS_STANDALONE) * (baseFee + tip),
      l1WeiPerTransfer: l1FeeStandalone,
    },
    {
      name: "Zero tip only: 1 tx per transfer, priority fee = 0",
      l2WeiPerTransfer: BigInt(GAS_STANDALONE) * baseFee,
      l1WeiPerTransfer: l1FeeStandalone,
    },
    {
      name: "Batched only: 50 transfers/tx, still paying 0.001 tip",
      l2WeiPerTransfer: BigInt(GAS_BATCHED_PER_TRANSFER) * (baseFee + tip),
      l1WeiPerTransfer: l1FeeBatchedTx / BigInt(BATCH_SIZE),
    },
    {
      name: "Full optimization: 50 transfers/tx, zero tip, packed calldata",
      l2WeiPerTransfer: BigInt(GAS_BATCHED_PER_TRANSFER) * baseFee,
      l1WeiPerTransfer: l1FeeBatchedTx / BigInt(BATCH_SIZE),
    },
  ];

  console.log(`\nBase gas spend report — ${new Date().toISOString()}`);
  console.log(`ETH/USD: $${ethUsd} | L2 base fee: ${gwei(baseFee)} gwei | L1 base fee (Ethereum): ${gwei(l1BaseFee)} gwei | block utilization: ${(utilization * 100).toFixed(1)}%`);
  console.log(`Volume: ${TRANSFERS_PER_DAY.toLocaleString()} transfers/day\n`);
  console.log(`${"scenario".padEnd(64)} ${"$/transfer".padStart(10)} ${"$/day".padStart(9)} ${"$/month".padStart(10)} ${"saving/mo".padStart(10)}`);

  const baselineDaily = usd(rows[0].l2WeiPerTransfer + rows[0].l1WeiPerTransfer) * TRANSFERS_PER_DAY;
  for (const r of rows) {
    const perTransfer = usd(r.l2WeiPerTransfer + r.l1WeiPerTransfer);
    const daily = perTransfer * TRANSFERS_PER_DAY;
    const monthly = daily * 30;
    const saving = (baselineDaily - daily) * 30;
    console.log(
      `${r.name.padEnd(64)} ${perTransfer.toFixed(6).padStart(10)} ${daily.toFixed(2).padStart(9)} ${monthly.toFixed(0).padStart(10)} ${("-" + saving.toFixed(0)).padStart(10)}`
    );
  }

  console.log(`\nL1 data fee now: standalone ${gwei(l1FeeStandalone)} gwei/tx | batched ${gwei(l1FeeBatchedTx)} gwei/tx (${gwei(l1FeeBatchedTx / BigInt(BATCH_SIZE))} gwei/transfer)`);
  console.log(`Note: L1 fee scales with Ethereum mainnet congestion (l1BaseFee currently ${gwei(l1BaseFee)} gwei).`);
  console.log(`A 30 gwei mainnet spike multiplies the L1 rows ~${Math.round(30e9 / Number(l1BaseFee))}x; batching + scheduling caps that exposure.`);
  console.log(`\nGas assumptions (measured on Base mainnet fork, real USDC, warm recipients):`);
  console.log(`  standalone transfer tx: ${GAS_STANDALONE} gas | batched: ${GAS_BATCHED_PER_TRANSFER} gas/transfer (${BATCH_SIZE}/tx)`);
  console.log(`  New (zero-balance) recipients add ~15-17k gas each to both scenarios; savings shrink to ~55-60% but hold.\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
