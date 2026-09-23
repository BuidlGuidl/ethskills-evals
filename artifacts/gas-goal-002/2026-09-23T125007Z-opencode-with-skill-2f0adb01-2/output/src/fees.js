import { parseGwei } from 'viem';

/**
 * Fee policy for Base (EIP-1559).
 *
 * Live conditions (2026-09): base fee ~0.005 gwei, priority ~0.001 gwei.
 * The defaults below are tuned for that reality — NOT for 2021 mainnet.
 * Hardcoding 1-2 gwei priority (ethers' old default) would overpay ~1000x.
 */

export class GasSpikeError extends Error {
  constructor(baseFeeGwei, thresholdGwei) {
    super(`Base fee ${baseFeeGwei} gwei exceeds spike threshold ${thresholdGwei} gwei — deferring`);
    this.name = 'GasSpikeError';
    this.baseFeeGwei = baseFeeGwei;
  }
}

export const DEFAULT_FEE_POLICY = {
  // Defer sends when base fee exceeds this. Normal is ~0.005 gwei; 0.1 gwei = 20x normal.
  maxBaseFeeGwei: '0.1',
  // Never pay more than this total, no matter what.
  maxFeeCapGwei: '1',
  // Floor for priority fee (below this the sequencer may ignore you).
  minPriorityGwei: '0.0005',
  // Cap for priority fee — on Base, inclusion is FCFS; big tips buy nothing.
  maxPriorityGwei: '0.01',
};

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

/**
 * Returns { maxFeePerGas, maxPriorityFeePerGas, baseFeePerGas } in wei.
 * Throws GasSpikeError if the current base fee is above the spike threshold.
 */
export async function getFeeConfig(publicClient, policy = {}) {
  const p = { ...DEFAULT_FEE_POLICY, ...policy };
  const block = await publicClient.getBlock({ blockTag: 'latest' });
  const baseFee = block.baseFeePerGas;

  const maxBaseFee = parseGwei(p.maxBaseFeeGwei);
  if (baseFee > maxBaseFee) {
    throw new GasSpikeError(Number(baseFee) / 1e9, Number(p.maxBaseFeeGwei));
  }

  let priority;
  try {
    priority = await publicClient.estimateMaxPriorityFeePerGas();
  } catch {
    priority = parseGwei(p.minPriorityGwei); // RPC doesn't support it — use floor
  }
  const maxPriorityFeePerGas = clamp(priority, parseGwei(p.minPriorityGwei), parseGwei(p.maxPriorityGwei));

  // 2x base fee headroom so the tx survives a few blocks of fee drift.
  let maxFeePerGas = baseFee * 2n + maxPriorityFeePerGas;
  const cap = parseGwei(p.maxFeeCapGwei);
  if (maxFeePerGas > cap) maxFeePerGas = cap;

  return { maxFeePerGas, maxPriorityFeePerGas, baseFeePerGas: baseFee };
}
