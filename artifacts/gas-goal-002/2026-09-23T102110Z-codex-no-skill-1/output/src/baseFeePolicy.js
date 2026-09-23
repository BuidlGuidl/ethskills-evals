const GWEI = 1_000_000_000n;

export const BASE_FEE_POLICY = Object.freeze({
  minPriorityFeePerGasWei: 1_000_000n,
  maxPriorityFeePerGasWei: 2_000_000n,
  maxFeeMultiplier: 2n,
  maxFeeCeilingWei: 20_000_000n
});

export function gweiToWei(gwei) {
  return BigInt(Math.round(gwei * 1e9));
}

export function weiToGwei(wei) {
  return Number(wei) / Number(GWEI);
}

export function buildBaseFeeParams(baseFeePerGasWei, options = {}) {
  const policy = { ...BASE_FEE_POLICY, ...options };
  const baseFee = BigInt(baseFeePerGasWei);
  const priorityFee = clampBigInt(
    BigInt(policy.priorityFeePerGasWei ?? policy.minPriorityFeePerGasWei),
    BigInt(policy.minPriorityFeePerGasWei),
    BigInt(policy.maxPriorityFeePerGasWei)
  );
  const uncappedMaxFee =
    baseFee * BigInt(policy.maxFeeMultiplier) + priorityFee;
  const maxFeePerGas = minBigInt(
    uncappedMaxFee,
    BigInt(policy.maxFeeCeilingWei)
  );

  if (maxFeePerGas < baseFee + priorityFee) {
    throw new Error('Base fee policy ceiling is below the required fee');
  }

  return {
    maxFeePerGas,
    maxPriorityFeePerGas: priorityFee
  };
}

function clampBigInt(value, min, max) {
  return maxBigInt(min, minBigInt(value, max));
}

function minBigInt(a, b) {
  return a < b ? a : b;
}

function maxBigInt(a, b) {
  return a > b ? a : b;
}
