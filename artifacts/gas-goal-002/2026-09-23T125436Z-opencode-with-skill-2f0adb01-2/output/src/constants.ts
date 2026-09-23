export const STANDALONE_TX_GAS = 52_000n;
export const STANDALONE_L1_BYTES = 210;

export const BATCH_FIXED_GAS = 27_600n;
export const BATCH_MARGINAL_GAS = 24_700n;
export const BATCHED_L1_BYTES_PER_TRANSFER = 69;

export const TRANSFERS_PER_DAY_DEFAULT = 40_000;

export function batchedGasPerTransfer(batchSize: bigint | number): bigint {
  const n = BigInt(batchSize);
  if (n <= 0n) throw new Error("batchSize must be positive");
  return BATCH_FIXED_GAS / n + BATCH_MARGINAL_GAS;
}

export function gasCostWei(gas: bigint, gasPriceGwei: number): bigint {
  return gas * BigInt(Math.round(gasPriceGwei * 1e9));
}

export function weiToUsd(wei: bigint, ethUsd: number): number {
  return Number(wei) / 1e18 * ethUsd;
}

export function fmtUsd(x: number): string {
  const abs = Math.abs(x);
  if (abs >= 100) return `$${x.toFixed(0)}`;
  if (abs >= 10) return `$${x.toFixed(1)}`;
  if (abs >= 1) return `$${x.toFixed(2)}`;
  return `$${x.toFixed(4)}`;
}