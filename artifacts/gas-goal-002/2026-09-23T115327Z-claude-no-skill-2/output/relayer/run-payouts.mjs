/**
 * Payout cycle entry point: takes a queue of pending payouts and settles them in batches.
 *
 * Wire this in place of the current "loop over payouts, send a transfer each" path.
 * It is deliberately a thin orchestrator — the decisions live in the modules it calls:
 *
 *   encode.mjs   packed calldata + amount validation
 *   fees.mjs     tip policy (zero by default; escalates only if blocks actually fill)
 *   batcher.mjs  batch planning, pre-flight simulation, per-payout quarantine
 */
import { createPublicClient, createWalletClient, http, encodeFunctionData, parseAbi, getAddress } from "viem";
import { base } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { buildFeeParams } from "./fees.mjs";
import { planBatches, submitBatch, partitionByEncodability, DEFAULT_BATCH_SIZE } from "./batcher.mjs";

/**
 * Below this many payouts a batch costs MORE than plain transfers: routing through the
 * contract adds a call frame and an allowance write per payout, which a single payout has
 * nothing to amortise it against. Measured per payout: 1 batched = 59,188 gas vs 44,843
 * sent directly, but 2 batched = 36,355 and 5 batched = 22,658. So the crossover sits at
 * two. See bench/out/results.json.
 */
export const MIN_BATCH_SIZE = 2;

const ERC20_ABI = parseAbi(["function transfer(address,uint256) returns (bool)"]);

/** Fallback for a handful of payouts: plain transfers, no contract hop. */
async function sendDirect({ publicClient, walletClient }, { token, payouts, feeParams }) {
  const receipts = [];
  for (const p of payouts) {
    const hash = await walletClient.sendTransaction({
      to: getAddress(token),
      data: encodeFunctionData({ abi: ERC20_ABI, functionName: "transfer", args: [getAddress(p.recipient), BigInt(p.amount)] }),
      maxFeePerGas: feeParams.maxFeePerGas,
      maxPriorityFeePerGas: feeParams.maxPriorityFeePerGas,
    });
    receipts.push(await publicClient.waitForTransactionReceipt({ hash }));
  }
  return receipts;
}

/**
 * Settle every pending payout for one token.
 * Returns the receipts, the total gas burned, and anything quarantined for review.
 */
export async function runPayoutCycle(clients, { token, batcher, payouts, batchSize = DEFAULT_BATCH_SIZE }) {
  if (payouts.length === 0) return { receipts: [], quarantined: [], gasUsed: 0n };

  const feeParams = await buildFeeParams(clients.publicClient);
  // Amounts too large for the packed layout are rare but must not be silently dropped.
  const { packable, oversized } = partitionByEncodability(payouts);

  const receipts = [];
  const quarantined = oversized.map((p) => ({ ...p, reason: "amount exceeds uint96; needs manual handling" }));

  if (packable.length < MIN_BATCH_SIZE) {
    receipts.push(...(await sendDirect(clients, { token, payouts: packable, feeParams })));
  } else {
    for (const batch of planBatches(packable, batchSize)) {
      const r = await submitBatch(clients, { token, batcher, payouts: batch, feeParams });
      if (r.receipt) receipts.push(r.receipt);
      quarantined.push(...r.quarantined);
    }
  }

  const gasUsed = receipts.reduce((sum, r) => sum + r.gasUsed, 0n);
  return { receipts, quarantined, gasUsed, feeParams };
}

/** Convenience factory for the two viem clients this module expects. */
export function makeClients({ rpcUrl = process.env.BASE_RPC_URL, privateKey = process.env.RELAYER_KEY } = {}) {
  const account = privateKeyToAccount(privateKey);
  return {
    publicClient: createPublicClient({ chain: base, transport: http(rpcUrl) }),
    walletClient: createWalletClient({ account, chain: base, transport: http(rpcUrl) }),
  };
}
