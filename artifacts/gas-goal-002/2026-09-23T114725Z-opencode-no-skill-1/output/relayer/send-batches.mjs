// SPDX-License-Identifier: MIT
// Batch payment sender for the relayer.
// Replaces one-tx-per-transfer with packed batches of N transfers through the
// BatchTransfer contract, pays zero (configurable) priority fee, and defers
// sending while the L1 data fee is above a configurable ceiling.
//
// Usage:
//   RELAYER_PRIVATE_KEY=0x... BATCH_CONTRACT=0x... node relayer/send-batches.mjs payments.jsonl
//   node relayer/send-batches.mjs payments.jsonl --dry-run
//
// payments.jsonl: one {"to":"0x...","amount":"25000000"} per line (token base units).
//
// Env:
//   BASE_RPC             (default https://mainnet.base.org)
//   RELAYER_PRIVATE_KEY  (required unless --dry-run)
//   BATCH_CONTRACT       (deployed BatchTransfer address; required)
//   TOKEN                (default: USDC on Base)
//   BATCH_SIZE           (default 50)
//   PRIORITY_FEE_WEI     (default 0 — Base includes zero-tip txs at typical load)
//   MAX_L1_GWEI_PER_TRANSFER  (default 50 — defer batches while L1 data fee/transfer exceeds this)
//   L1_POLL_SECONDS      (default 30 — how often to re-check the L1 fee while deferring)

import { readFileSync } from "node:fs";
import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbi,
  encodePacked,
  formatEther,
} from "viem";
import { base } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

const RPC = process.env.BASE_RPC ?? "https://mainnet.base.org";
const BATCH_CONTRACT = process.env.BATCH_CONTRACT;
const TOKEN = process.env.TOKEN ?? "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"; // USDC on Base
const BATCH_SIZE = Number(process.env.BATCH_SIZE ?? 50);
const PRIORITY_FEE_WEI = BigInt(process.env.PRIORITY_FEE_WEI ?? 0);
const MAX_L1_WEI_PER_TRANSFER = BigInt(
  Math.round(Number(process.env.MAX_L1_GWEI_PER_TRANSFER ?? 50) * 1e9)
);
const L1_POLL_SECONDS = Number(process.env.L1_POLL_SECONDS ?? 30);
const DRY_RUN = process.argv.includes("--dry-run");

const GAS_PRICE_ORACLE = "0x420000000000000000000000000000000000000F";

const batchAbi = parseAbi([
  "function batchTransferPacked(address token, bytes entries) external",
]);
const erc20Abi = parseAbi(["function balanceOf(address) view returns (uint256)"]);
const oracleAbi = parseAbi(["function getL1FeeUpperBound(uint256 txSize) view returns (uint256)"]);

if (!BATCH_CONTRACT) {
  console.error("BATCH_CONTRACT env var (deployed BatchTransfer address) is required");
  process.exit(1);
}
const queuePath = process.argv.find((a) => a.endsWith(".jsonl"));
if (!queuePath) {
  console.error("usage: node relayer/send-batches.mjs payments.jsonl [--dry-run]");
  process.exit(1);
}

const payments = readFileSync(queuePath, "utf8")
  .split("\n")
  .filter((l) => l.trim())
  .map((l) => JSON.parse(l));

const publicClient = createPublicClient({ chain: base, transport: http(RPC) });

function packEntries(chunk) {
  // 32 bytes per entry: 20-byte recipient ++ 12-byte big-endian uint96 amount.
  return encodePacked(
    chunk.flatMap(() => ["address", "uint96"]),
    chunk.flatMap((p) => [p.to, BigInt(p.amount)])
  );
}

async function waitForL1Fee(txSize) {
  for (;;) {
    const fee = await publicClient.readContract({
      address: GAS_PRICE_ORACLE,
      abi: oracleAbi,
      functionName: "getL1FeeUpperBound",
      args: [BigInt(txSize)],
    });
    const perTransfer = fee / BigInt(BATCH_SIZE);
    if (perTransfer <= MAX_L1_WEI_PER_TRANSFER) return fee;
    console.log(
      `L1 data fee ${formatEther(perTransfer)} ETH/transfer exceeds ceiling; ` +
        `re-checking in ${L1_POLL_SECONDS}s (Ethereum mainnet congestion)...`
    );
    await new Promise((r) => setTimeout(r, L1_POLL_SECONDS * 1000));
  }
}

async function main() {
  console.log(`${payments.length} payments queued, batch size ${BATCH_SIZE}`);
  const total = payments.reduce((a, p) => a + BigInt(p.amount), 0n);

  const float = await publicClient.readContract({
    address: TOKEN,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [BATCH_CONTRACT],
  });
  if (float < total) {
    console.error(`Batch contract underfunded: holds ${float}, needs ${total}. Fund it first.`);
    process.exit(1);
  }

  const walletClient = DRY_RUN
    ? null
    : createWalletClient({
        account: privateKeyToAccount(process.env.RELAYER_PRIVATE_KEY),
        chain: base,
        transport: http(RPC),
      });

  let sent = 0;
  let totalGas = 0n;
  for (let i = 0; i < payments.length; i += BATCH_SIZE) {
    const chunk = payments.slice(i, i + BATCH_SIZE);
    const entries = packEntries(chunk);
    // Approximate serialized tx size for the L1 fee estimate.
    const txSize = 150 + (entries.length - 2) / 2;
    const l1Fee = await waitForL1Fee(txSize);

    const { request } = await publicClient.simulateContract({
      address: BATCH_CONTRACT,
      abi: batchAbi,
      functionName: "batchTransferPacked",
      args: [TOKEN, entries],
      ...(DRY_RUN ? {} : { account: walletClient.account }),
    });

    if (DRY_RUN) {
      console.log(`[dry-run] batch ${i / BATCH_SIZE + 1}: ${chunk.length} transfers ok, est. L1 fee ${formatEther(l1Fee)} ETH`);
      continue;
    }

    const baseFee = (await publicClient.getBlock()).baseFeePerGas;
    const hash = await walletClient.writeContract({
      ...request,
      maxFeePerGas: baseFee * 2n + PRIORITY_FEE_WEI, // headroom; you only pay base+tip
      maxPriorityFeePerGas: PRIORITY_FEE_WEI,
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    totalGas += receipt.gasUsed;
    sent += chunk.length;
    console.log(
      `batch ${i / BATCH_SIZE + 1}: ${chunk.length} transfers | gasUsed ${receipt.gasUsed} ` +
        `(${Number(receipt.gasUsed) / chunk.length}/transfer) | ${hash}`
    );
  }

  if (!DRY_RUN) {
    console.log(`\nDone: ${sent} transfers, ${totalGas} total L2 gas, ${Number(totalGas) / sent} gas/transfer`);
  }
}

main().catch((e) => {
  console.error(e.shortMessage ?? e.message ?? e);
  process.exit(1);
});
