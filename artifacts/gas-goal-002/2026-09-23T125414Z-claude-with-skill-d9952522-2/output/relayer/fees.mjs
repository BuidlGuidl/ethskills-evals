// EIP-1559 fee fields for Base, derived from the chain immediately before submission.
//
// Why this exists: sampling live Base traffic (tools/measure-base.mjs) shows the
// median sender paying ~1.2x the base fee while the worst pays 81x. That spread is
// almost entirely senders carrying a hardcoded mainnet-style priority fee (1-2 gwei)
// onto a chain whose base fee is ~0.005 gwei. Nothing here is hardcoded except the
// safety ceilings.

const GWEI = 1_000_000_000n;

export const DEFAULTS = {
  // Headroom on the base fee so the tx survives a few blocks of base-fee growth.
  // Base's base fee moves by at most 12.5% per 2s block; 2x covers ~6 blocks.
  baseFeeMultiplier: 2n,
  // Floor for the tip. Base sequencer accepts very small tips; this keeps us
  // above zero without importing a mainnet constant.
  minPriorityFeeWei: 1_000_000n, // 0.001 gwei
  // Hard ceiling on the tip. Catches a misbehaving eth_maxPriorityFeePerGas and
  // the classic "someone pasted a mainnet value" bug.
  maxPriorityFeeWei: 50_000_000n, // 0.05 gwei
  // Absolute ceiling on maxFeePerGas. A payout is worth cents; refuse to bid more
  // than this regardless of what the chain reports.
  maxFeeCeilingWei: 500_000_000n, // 0.5 gwei
};

const hexToBigInt = (h) => BigInt(h);
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

/**
 * @param {(method: string, params: unknown[]) => Promise<any>} rpc
 * @param {Partial<typeof DEFAULTS>} [opts]
 * @returns {Promise<{maxFeePerGas: bigint, maxPriorityFeePerGas: bigint, baseFeePerGas: bigint, capped: boolean}>}
 */
export async function suggestFees(rpc, opts = {}) {
  const cfg = { ...DEFAULTS, ...opts };

  const [block, tipHex] = await Promise.all([
    rpc('eth_getBlockByNumber', ['latest', false]),
    // Not every RPC implements this; fall back to the floor rather than a guess.
    rpc('eth_maxPriorityFeePerGas', []).catch(() => null),
  ]);

  const baseFeePerGas = hexToBigInt(block.baseFeePerGas);
  const suggestedTip = tipHex === null ? cfg.minPriorityFeeWei : hexToBigInt(tipHex);

  const maxPriorityFeePerGas = clamp(suggestedTip, cfg.minPriorityFeeWei, cfg.maxPriorityFeeWei);

  let maxFeePerGas = baseFeePerGas * cfg.baseFeeMultiplier + maxPriorityFeePerGas;
  let capped = false;
  if (maxFeePerGas > cfg.maxFeeCeilingWei) {
    maxFeePerGas = cfg.maxFeeCeilingWei;
    capped = true;
  }
  // The ceiling must never land below the current base fee, or the tx is unmineable.
  if (maxFeePerGas < baseFeePerGas + maxPriorityFeePerGas) {
    throw new Error(
      `Base fee ${baseFeePerGas} wei exceeds the configured ceiling ${cfg.maxFeeCeilingWei} wei. ` +
        `Pause payouts or raise maxFeeCeilingWei deliberately -- do not widen it automatically.`,
    );
  }

  return { maxFeePerGas, maxPriorityFeePerGas, baseFeePerGas, capped };
}

/** Fee bump for a stuck tx. EIP-1559 replacement requires >=10% on BOTH fields. */
export function bumpFees(prev, attempt = 1) {
  const factor = 11n ** BigInt(attempt);
  const div = 10n ** BigInt(attempt);
  return {
    maxFeePerGas: (prev.maxFeePerGas * factor) / div + 1n,
    maxPriorityFeePerGas: (prev.maxPriorityFeePerGas * factor) / div + 1n,
  };
}

export const formatGwei = (wei) => `${Number(wei) / Number(GWEI)} gwei`;
