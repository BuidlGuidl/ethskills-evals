import type { PublicClient } from "viem";

/**
 * EIP-1559 fee fields for Base, derived from the chain immediately before
 * submission.
 *
 * Base's base fee sat at its 0.005 gwei floor for every block we sampled over
 * 24h, and 9.3% of user transactions in our sample landed with a zero tip. The
 * relayer was paying a 0.001 gwei tip, i.e. 1/6 of every transaction's
 * execution cost, for priority it does not need on a payments flow.
 *
 * We therefore bid a small tip rather than a proportional one, and keep a
 * generous maxFeePerGas headroom so the transaction survives a base-fee spike
 * without being repriced (headroom costs nothing -- you are only charged the
 * base fee that actually applies).
 */
export interface FeeParams {
  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
}

export interface FeeOptions {
  /** Tip in wei. Default 100_000 (0.0001 gwei). */
  tipWei?: bigint;
  /** Multiple of current base fee allowed in maxFeePerGas. Default 4x. */
  baseFeeMultiplier?: bigint;
  /** Absolute ceiling, a guard against a runaway spike draining the relayer. */
  maxFeeCapWei?: bigint;
}

export const DEFAULT_TIP_WEI = 100_000n; // 0.0001 gwei
export const DEFAULT_BASE_FEE_MULTIPLIER = 4n;
export const DEFAULT_MAX_FEE_CAP_WEI = 5_000_000_000n; // 5 gwei

export async function getFeeParams(
  client: PublicClient,
  opts: FeeOptions = {},
): Promise<FeeParams> {
  const {
    tipWei = DEFAULT_TIP_WEI,
    baseFeeMultiplier = DEFAULT_BASE_FEE_MULTIPLIER,
    maxFeeCapWei = DEFAULT_MAX_FEE_CAP_WEI,
  } = opts;

  const block = await client.getBlock({ blockTag: "latest" });
  const baseFee = block.baseFeePerGas;
  if (baseFee === null || baseFee === undefined) {
    throw new Error("chain did not report baseFeePerGas; refusing to guess fees");
  }

  let maxFeePerGas = baseFee * baseFeeMultiplier + tipWei;
  if (maxFeePerGas > maxFeeCapWei) maxFeePerGas = maxFeeCapWei;

  // maxFeePerGas must always cover the tip, even if the cap clamped it.
  const maxPriorityFeePerGas = tipWei > maxFeePerGas ? maxFeePerGas : tipWei;

  return { maxFeePerGas, maxPriorityFeePerGas };
}
