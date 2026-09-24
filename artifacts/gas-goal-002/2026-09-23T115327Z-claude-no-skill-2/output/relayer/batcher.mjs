/**
 * Batch payout submission.
 *
 * Replaces "one transaction per payout" with "one transaction per N payouts", which is
 * where nearly all of the gas saving comes from: the 21,000 intrinsic cost is paid once
 * per transaction rather than once per recipient.
 *
 * THE FAILURE MODE THIS CODE EXISTS TO HANDLE
 *
 * Batching couples payouts that used to be independent. One bad recipient — a USDC
 * blacklisted address, a token with a transfer hook that reverts — takes down the whole
 * batch, and with it 249 payouts that were perfectly fine. So every batch is simulated
 * with eth_call first; BatchTransfer reverts with `TransferFailed(index)`, which names
 * the offender, and we quarantine it and retry the remainder. A batch is only broadcast
 * once it has simulated cleanly.
 */
import { decodeErrorResult, encodeFunctionData, getAddress } from "viem";
import { BATCH_TRANSFER_ABI, packPayouts, MAX_PACKED_AMOUNT } from "./encode.mjs";

/**
 * Default recipients per transaction.
 *
 * Not bounded by block space — Base blocks are 400M gas and a 250-payout batch is ~4M.
 * It is bounded by blast radius and by retry cost: the per-payout saving is already
 * within a few percent of its asymptote by 250 (see bench/out/results.json), so a larger
 * batch buys almost nothing while putting more payouts behind a single point of failure.
 */
export const DEFAULT_BATCH_SIZE = 250;

/** Split a payout list into batches, keeping input order. */
export function planBatches(payouts, batchSize = DEFAULT_BATCH_SIZE) {
  if (batchSize < 1) throw new Error("batchSize must be >= 1");
  const batches = [];
  for (let i = 0; i < payouts.length; i += batchSize) {
    batches.push(payouts.slice(i, i + batchSize));
  }
  return batches;
}

/** Amounts above uint96 cannot use the packed path; route them separately. */
export function partitionByEncodability(payouts) {
  const packable = [], oversized = [];
  for (const p of payouts) (BigInt(p.amount) > MAX_PACKED_AMOUNT ? oversized : packable).push(p);
  return { packable, oversized };
}

function buildCalldata(token, payouts) {
  return encodeFunctionData({
    abi: BATCH_TRANSFER_ABI,
    functionName: "batchTransferPacked",
    args: [getAddress(token), packPayouts(payouts)],
  });
}

/**
 * Pull the failing index out of a reverted simulation, or null if unrecognised.
 *
 * The revert data is buried at varying depths in viem's error `cause` chain depending on
 * which action threw, so walk the chain rather than guessing at a fixed shape.
 */
function failedIndexFrom(err) {
  for (let node = err, depth = 0; node && depth < 10; node = node.cause, depth++) {
    const raw = node.data;
    const hex = typeof raw === "string" ? raw : raw?.data;
    if (typeof hex !== "string" || !hex.startsWith("0x") || hex === "0x") continue;
    try {
      const decoded = decodeErrorResult({ abi: BATCH_TRANSFER_ABI, data: hex });
      if (decoded.errorName === "TransferFailed") return Number(decoded.args[0]);
    } catch {
      // Not our error selector; keep walking.
    }
  }
  return null;
}

/**
 * Simulate a batch, dropping individually-failing payouts until the rest succeeds.
 * Returns the surviving payouts plus whatever was quarantined, so the caller can
 * alert on the quarantine rather than silently skipping someone's money.
 */
export async function simulateAndPrune(client, { token, batcher, relayer, payouts, maxDrops = 10 }) {
  let current = [...payouts];
  const quarantined = [];

  for (let attempt = 0; attempt <= maxDrops; attempt++) {
    if (current.length === 0) return { payouts: [], quarantined, gas: 0n };
    try {
      const data = buildCalldata(token, current);
      const gas = await client.estimateGas({ account: relayer, to: batcher, data });
      return { payouts: current, quarantined, gas };
    } catch (err) {
      const idx = failedIndexFrom(err);
      if (idx === null || idx < 0 || idx >= current.length) {
        // Not a per-recipient failure (bad allowance, insufficient balance, RPC issue).
        // Nothing to prune — surface it rather than shrinking the batch blindly.
        throw err;
      }
      quarantined.push({ ...current[idx], reason: "transferFrom reverted in simulation" });
      current = current.filter((_, i) => i !== idx);
    }
  }
  throw new Error(`simulateAndPrune: more than ${maxDrops} failing payouts; aborting batch`);
}

/**
 * Submit one batch. Returns the receipt plus the quarantine list.
 * `feeParams` comes from relayer/fees.mjs.
 */
export async function submitBatch(
  { publicClient, walletClient },
  { token, batcher, payouts, feeParams, gasBufferPct = 15n },
) {
  const relayer = walletClient.account.address;
  const pruned = await simulateAndPrune(publicClient, { token, batcher, relayer, payouts });
  if (pruned.payouts.length === 0) {
    return { receipt: null, sent: [], quarantined: pruned.quarantined };
  }

  const hash = await walletClient.sendTransaction({
    to: getAddress(batcher),
    data: buildCalldata(token, pruned.payouts),
    gas: (pruned.gas * (100n + gasBufferPct)) / 100n,
    maxFeePerGas: feeParams.maxFeePerGas,
    maxPriorityFeePerGas: feeParams.maxPriorityFeePerGas,
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  return { receipt, sent: pruned.payouts, quarantined: pruned.quarantined };
}
