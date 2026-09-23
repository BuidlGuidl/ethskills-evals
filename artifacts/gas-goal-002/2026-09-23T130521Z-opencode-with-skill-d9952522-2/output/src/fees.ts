import { Rpc } from "./rpc.ts";

/**
 * Relayer fee policy for Base (or any OP-stack L2).
 *
 * Measured context (Base mainnet, 2026-09-23):
 *   - base fee pinned at its 0.005 gwei floor for 600+ consecutive blocks
 *   - sequencer-suggested tip: 0.001 gwei
 *   - senders in the same block paid effective prices of 0.006–0.0252 gwei:
 *     up to 4x overpayment driven entirely by oversized priority fees.
 *
 * So: tip tiny, maxFee = baseFee * multiplier + tip, and hard guards so a
 * fee spike degrades to "queue and retry" instead of "overpay".
 */
export interface FeePolicy {
  /** Never pay a tip above this, whatever the sequencer suggests. */
  maxTipWei: bigint;
  /** maxFeePerGas = baseFee * maxFeeMultiplier + tip (buffer for the next blocks). */
  maxFeeMultiplier: number;
  /** If the current base fee is above this, hold the tx and retry later. */
  baseFeeCapWei: bigint;
  /** Absolute ceiling on maxFeePerGas. Above it, hold. Hard budget guard. */
  maxFeeCeilingWei: bigint;
}

export const BASE_FEE_POLICY: FeePolicy = {
  maxTipWei: 1_000_000n, // 0.001 gwei — sequencer suggestion when blocks aren't full
  maxFeeMultiplier: 2,
  baseFeeCapWei: 10_000_000n, // 0.01 gwei — 2x the floor; queue rather than chase congestion
  maxFeeCeilingWei: 50_000_000n, // 0.05 gwei — absolute never-exceed
};

export type FeeDecision =
  | { send: true; maxFeePerGas: bigint; maxPriorityFeePerGas: bigint }
  | { send: false; reason: string };

/**
 * Pure fee decision. `baseFeeWei` and `suggestedTipWei` must be read from the
 * target chain immediately before calling this (see `decideFeesLive`).
 */
export function deriveFees(
  baseFeeWei: bigint,
  suggestedTipWei: bigint,
  policy: FeePolicy = BASE_FEE_POLICY,
): FeeDecision {
  if (baseFeeWei > policy.baseFeeCapWei) {
    return {
      send: false,
      reason: `base fee ${formatGwei(baseFeeWei)} gwei above cap ${formatGwei(policy.baseFeeCapWei)} gwei — queue and retry`,
    };
  }
  // Never pay more tip than our cap; the sequencer suggestion can spike.
  const tip = suggestedTipWei < policy.maxTipWei ? suggestedTipWei : policy.maxTipWei;
  const maxFeePerGas = baseFeeWei * BigInt(policy.maxFeeMultiplier) + tip;
  if (maxFeePerGas > policy.maxFeeCeilingWei) {
    return {
      send: false,
      reason: `maxFeePerGas ${formatGwei(maxFeePerGas)} gwei above ceiling ${formatGwei(policy.maxFeeCeilingWei)} gwei — queue and retry`,
    };
  }
  return { send: true, maxFeePerGas, maxPriorityFeePerGas: tip };
}

/** Read fee inputs from the chain and decide. Call immediately before signing. */
export async function decideFeesLive(
  rpc: Rpc,
  policy: FeePolicy = BASE_FEE_POLICY,
): Promise<FeeDecision> {
  const [baseFeeWei, suggestedTipWei] = await Promise.all([
    rpc.baseFeeWei(),
    rpc.suggestedTipWei(),
  ]);
  return deriveFees(baseFeeWei, suggestedTipWei, policy);
}

export function formatGwei(wei: bigint): string {
  return (Number(wei) / 1e9).toFixed(4);
}
