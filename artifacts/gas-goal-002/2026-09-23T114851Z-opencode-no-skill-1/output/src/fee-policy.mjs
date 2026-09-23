export const DEFAULT_POLICY = {
  priorityCapGwei: 0.01,
  maxFeeBufferMult: 1.25,
  hardCeilingGwei: 0.5,
  staleBlockTolerance: 4,
};

export function computeFeePolicy(feeHistory, overrides = {}) {
  const p = { ...DEFAULT_POLICY, ...overrides };
  const baseFees = feeHistory.baseFeePerGasWei.map((x) => BigInt(x));
  const rewards = (feeHistory.rewardsWei ?? []).flat().filter((x) => x !== null && x !== undefined);
  if (baseFees.length === 0) throw new Error("no base fees");
  const latestBaseFee = baseFees[baseFees.length - 1];
  let nextBaseFee = estimateNextBaseFee(baseFees, feeHistory.gasUsedRatio ?? []);
  if (nextBaseFee <= 0n) nextBaseFee = latestBaseFee;
  const priorityWei = rewards.length
    ? percentile(rewards.map((x) => BigInt(x)), 75)
    : 1_000_000n;
  const priorityCapWei = gwei(p.priorityCapGwei);
  const maxPriorityFeePerGasWei = priorityWei > priorityCapWei ? priorityCapWei : priorityWei;
  const maxFeePerGasWei =
    nextBaseFee * BigInt(Math.round(p.maxFeeBufferMult * 100)) / 100n + maxPriorityFeePerGasWei;
  const ceilingWei = gwei(p.hardCeilingGwei);
  return {
    maxPriorityFeePerGasWei: maxPriorityFeePerGasWei.toString(),
    maxFeePerGasWei: maxFeePerGasWei.toString(),
    maxFeePerGasCeilingWei: ceilingWei.toString(),
    effectiveFloorWei: (latestBaseFee + maxPriorityFeePerGasWei).toString(),
    acceptable: maxFeePerGasWei <= ceilingWei,
  };
}

export function estimateNextBaseFee(baseFeesRaw, gasUsedRatios) {
  const baseFees = baseFeesRaw.map((b) => toBigInt(b));
  if (baseFees.length < 2) return baseFees[baseFees.length - 1];
  const last = baseFees[baseFees.length - 1];
  const r = gasUsedRatios[gasUsedRatios.length - 1] ?? 0.5;
  const clamped = Math.min(1, Math.max(0, r));
  const t = BigInt(Math.round(clamped * 1000));
  const slope = 2n * t - 1000n;
  return last + (last * slope) / 8000n;
}

function toBigInt(v) {
  if (typeof v === "bigint") return v;
  const s = String(v);
  return BigInt(s.startsWith("0x") ? s : s.match(/^[0-9]+$/) ? s : "0x" + s);
}

function gwei(x) {
  return BigInt(Math.round(x * 1e9));
}

function percentile(values, q) {
  const sorted = [...values].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const idx = Math.min(sorted.length - 1, Math.floor((q / 100) * sorted.length));
  return sorted[idx];
}

export function fromFeeHistoryRpc(rpcResult) {
  const baseFeePerGasWei = rpcResult.baseFeePerGas.map((h) => toBigInt(h));
  const rewardsWei = rpcResult.reward.map((block) => block.map((r) => toBigInt(r)));
  return {
    baseFeePerGasWei: baseFeePerGasWei.map((b) => b.toString()),
    rewardsWei: rewardsWei.map((b) => b.map((r) => r.toString())),
    gasUsedRatio: rpcResult.gasUsedRatio,
  };
}
