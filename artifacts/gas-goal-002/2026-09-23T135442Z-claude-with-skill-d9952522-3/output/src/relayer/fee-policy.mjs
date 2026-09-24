/**
 * EIP-1559 fee policy for Base.
 *
 * Two facts drive this, both measured on Base rather than assumed:
 *
 *  1. `maxFeePerGas` is a CAP, not a price. A transaction pays
 *     `baseFee + tip`, refunding the rest. Raising the cap costs nothing and
 *     buys protection against being stuck when the base fee climbs.
 *  2. `maxPriorityFeePerGas` IS paid in full, every time. It is the only fee
 *     field where a too-large number turns directly into spend.
 *
 * So: set the cap generously, and set the tip as low as inclusion allows.
 *
 * Do not port a mainnet tip constant here. Base blocks run far below target,
 * so the tip needed for timely inclusion is orders of magnitude smaller than
 * on L1. Re-run `script/measure-fees.mjs` to re-derive MIN_TIP_WEI if Base's
 * congestion profile changes.
 */

/** Floor tip, in wei. Measured: Base blocks routinely include zero-tip
 *  transactions, so this is a safety margin rather than a requirement. */
export const MIN_TIP_WEI = 1_000n;

/** Ceiling on the tip we will ever volunteer, in wei. Guards against a bad
 *  oracle reading turning into a 100x overpay on 40k transactions a day. */
export const MAX_TIP_WEI = 2_000_000n;

/** Multiple of the current base fee used for `maxFeePerGas`. Base's fee can
 *  at most ~1.125x per 2s block, so 4x absorbs roughly 12 consecutive full
 *  blocks. It is a cap, so unused headroom is refunded, not spent. */
export const BASE_FEE_MULTIPLIER = 4n;

/**
 * @param {(method: string, params?: unknown[]) => Promise<any>} rpc
 * @param {{urgent?: boolean}} [opts] `urgent` raises the tip percentile for
 *        payments that must land in the next block or two.
 * @returns {Promise<{maxFeePerGas: bigint, maxPriorityFeePerGas: bigint, baseFeePerGas: bigint}>}
 */
export async function computeFees(rpc, opts = {}) {
  const percentile = opts.urgent ? 50 : 20;
  const history = await rpc("eth_feeHistory", ["0x14", "latest", [percentile]]);

  const baseFeePerGas = BigInt(history.baseFeePerGas.at(-1));

  const rewards = history.reward
    .map((r) => BigInt(r[0]))
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const observed = rewards.length ? rewards[Math.floor(rewards.length / 2)] : 0n;

  let maxPriorityFeePerGas = observed > MIN_TIP_WEI ? observed : MIN_TIP_WEI;
  if (maxPriorityFeePerGas > MAX_TIP_WEI) maxPriorityFeePerGas = MAX_TIP_WEI;

  return {
    baseFeePerGas,
    maxPriorityFeePerGas,
    maxFeePerGas: baseFeePerGas * BASE_FEE_MULTIPLIER + maxPriorityFeePerGas,
  };
}

/**
 * Replacement fee for a stuck transaction. Geth requires both fields to rise
 * by >=10%; bumping the tip alone is the cheap way to do that, because the
 * base-fee portion of the cap is still only charged at the prevailing rate.
 */
export function bumpFees(prev) {
  const bump = (v) => (v * 112n) / 100n + 1n;
  return {
    maxFeePerGas: bump(prev.maxFeePerGas),
    maxPriorityFeePerGas: bump(prev.maxPriorityFeePerGas),
  };
}
