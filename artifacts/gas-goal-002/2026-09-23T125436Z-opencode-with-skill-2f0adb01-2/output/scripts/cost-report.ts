import { createPublicClient, http, formatGwei } from "viem";
import { base } from "viem/chains";
import {
  STANDALONE_TX_GAS,
  BATCH_FIXED_GAS,
  BATCH_MARGINAL_GAS,
  STANDALONE_L1_BYTES,
  BATCHED_L1_BYTES_PER_TRANSFER,
  TRANSFERS_PER_DAY_DEFAULT,
  batchedGasPerTransfer,
  gasCostWei,
  weiToUsd,
  fmtUsd,
} from "../src/index.js";

const RPC_URL = process.env.BASE_RPC_URL ?? "https://base-rpc.publicnode.com";
const TRANSFERS_PER_DAY = Number(process.env.TRANSFERS_PER_DAY ?? TRANSFERS_PER_DAY_DEFAULT);
const BATCH_SIZES = (process.env.BATCH_SIZES ?? "20,100,200").split(",").map((s) => Number(s.trim()));

async function ethUsd(): Promise<number> {
  if (process.env.ETH_USD) return Number(process.env.ETH_USD);
  try {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd",
    );
    const json = (await res.json()) as { ethereum?: { usd?: number } };
    if (json.ethereum?.usd) return json.ethereum.usd;
  } catch {}
  return 2719;
}

async function main() {
  const client = createPublicClient({ chain: base, transport: http(RPC_URL) });
  const [gasPrice, block, price] = await Promise.all([
    client.getGasPrice(),
    client.getBlock({ blockTag: "latest" }),
    ethUsd(),
  ]);
  const baseFee = block.baseFeePerGas ?? gasPrice;

  const gwei = Number(formatGwei(gasPrice));
  const baseGwei = Number(formatGwei(baseFee));

  console.log("Relayer gas cost report (Base)");
  console.log("================================");
  console.log(`Transfers/day:          ${TRANSFERS_PER_DAY.toLocaleString()}`);
  console.log(`Base gas price:         ${gwei.toFixed(4)} gwei (base fee ${baseGwei.toFixed(4)} gwei)`);
  console.log(`ETH price:              $${price.toFixed(0)}`);
  console.log(`Measured gas:           standalone ${STANDALONE_TX_GAS} | batch fixed ${BATCH_FIXED_GAS} + marginal ${BATCH_MARGINAL_GAS}/transfer`);
  console.log(`L1 data bytes/transfer: standalone ~${STANDALONE_L1_BYTES}B | batched ~${BATCHED_L1_BYTES_PER_TRANSFER}B`);
  console.log("");

  const standaloneWei = gasCostWei(STANDALONE_TX_GAS, gwei);
  const standaloneUsd = weiToUsd(standaloneWei, price);
  console.log("Current (one tx per transfer)");
  console.log(`  per transfer:         ${fmtUsd(standaloneUsd)}`);
  console.log(`  per day:              ${fmtUsd(standaloneUsd * TRANSFERS_PER_DAY)}`);
  console.log(`  per month (30d):      ${fmtUsd(standaloneUsd * TRANSFERS_PER_DAY * 30)}`);
  console.log(`  per year:             ${fmtUsd(standaloneUsd * TRANSFERS_PER_DAY * 365)}`);
  console.log("");

  console.log("After batching (BatchRelayer)");
  for (const n of BATCH_SIZES) {
    const gas = batchedGasPerTransfer(n);
    const usd = weiToUsd(gasCostWei(gas, gwei), price);
    const savings = (1 - Number(gas) / Number(STANDALONE_TX_GAS)) * 100;
    console.log(
      `  batch=${String(n).padStart(3)}: gas ${String(gas).padStart(6)}/transfer | ${fmtUsd(usd)}/tx | ${fmtUsd(
        usd * TRANSFERS_PER_DAY * 365,
      )}/yr | saves ${savings.toFixed(0)}% of L2 execution gas`,
    );
  }

  const batchedUsd = weiToUsd(gasCostWei(batchedGasPerTransfer(BATCH_SIZES[BATCH_SIZES.length - 1] ?? 100), gwei), price);
  console.log("");
  console.log(
    `Savings with batching at current fees: ~${fmtUsd(
      (standaloneUsd - batchedUsd) * TRANSFERS_PER_DAY,
    )}/day, ~${fmtUsd((standaloneUsd - batchedUsd) * TRANSFERS_PER_DAY * 30)}/month`,
  );
  console.log("");
  console.log("Notes:");
  console.log("  - L2 execution gas only; Base L1 data fee adds ~1-5% at current blob prices");
  console.log("    (spikes to 10-100x during L1 congestion; batching cuts that component ~3x too)");
  console.log("  - Assumes first-payout recipients; repeat recipients are ~17k gas cheaper in both modes");
  console.log("  - Verify actual spend: pull effectiveGasPrice * gasUsed from recent relayer txs vs block baseFee");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});