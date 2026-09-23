export interface FeePolicy {
  tipFloorWei: bigint;
  tipMaxWei: bigint;
  tipBpsOfBase: bigint;
  maxFeeMultiplierBps: bigint;
  hardMaxFeeWei: bigint;
}

export interface FeeQuote {
  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
  defer: boolean;
}

export const GWEI = 1_000_000_000n;

export function defaultFeePolicy(): FeePolicy {
  return {
    tipFloorWei: 1_000_000n,
    tipMaxWei: (5n * GWEI) / 100n,
    tipBpsOfBase: 1_000n,
    maxFeeMultiplierBps: 12_500n,
    hardMaxFeeWei: (25n * GWEI) / 100n,
  };
}

export function quoteFees(baseFeeWei: bigint, policy: FeePolicy): FeeQuote {
  const scaledTip = (baseFeeWei * policy.tipBpsOfBase) / 10_000n;
  const tip =
    scaledTip > policy.tipFloorWei
      ? scaledTip < policy.tipMaxWei
        ? scaledTip
        : policy.tipMaxWei
      : policy.tipFloorWei;
  const maxFee = (baseFeeWei * policy.maxFeeMultiplierBps) / 10_000n + tip;
  return {
    maxFeePerGas: maxFee,
    maxPriorityFeePerGas: tip,
    defer: maxFee > policy.hardMaxFeeWei,
  };
}
