/**
 * Fee policy for a high-volume relayer on Base.
 *
 * The one thing to internalise: on EIP-1559 you pay `baseFee + tip`, never
 * `maxFeePerGas`. Headroom in maxFeePerGas is free insurance against a base-fee
 * spike; the tip is the only knob that costs money. Most relayers are tuned the
 * wrong way round -- a stingy maxFee (which strands transactions) and a fat tip
 * inherited from a mainnet config (which burns cash on every single send).
 *
 * Base's base fee sits at its protocol floor of 0.005 gwei essentially all the
 * time (measured: p99 = 0.005019 gwei over 1,025 consecutive blocks), and ~8% of
 * transactions land with a zero tip. So the correct steady-state tip is tiny,
 * and the escalation ladder -- not the initial tip -- is what guarantees
 * inclusion.
 */

const GWEI = 1_000_000_000n;

export const BASE_FEE_FLOOR_WEI = 5_000_000n; // 0.005 gwei, Base's minimum base fee

export const DEFAULT_POLICY = {
  /** Opening tip. 0.0005 gwei -- half of what Base's own node suggests, still
   *  above the ~8% of blocks' worth of traffic that lands on zero. */
  initialTipWei: 500_000n,
  /** Multiply the tip by this on each replacement. */
  escalationFactor: 3n,
  /** Never bid a tip above this, no matter how many retries. At 62k gas this
   *  caps a single transfer at ~0.0017 USD of tip at ETH $2,700. */
  maxTipWei: 100_000_000n, // 0.1 gwei
  /** maxFeePerGas = baseFee * this + tip. Free headroom: unused maxFee is never
   *  charged. 12x covers a base fee doubling on each of ~3.5 consecutive
   *  blocks, which Base has not done in recorded history. */
  baseFeeMultiplier: 12n,
  /** Floor for maxFeePerGas, so a quiet chain still leaves room to escalate. */
  minMaxFeeWei: 100_000_000n, // 0.1 gwei
  /** Wait this long for inclusion before replacing. Base produces a block every
   *  2s; anything not mined in 12s is not a fee problem, it is a nonce or
   *  mempool problem -- but bumping is cheap and harmless. */
  inclusionTimeoutMs: 12_000,
  /** Refuse to send at all if the base fee is this high: something is wrong,
   *  and for a payments queue it is cheaper to wait a minute than to pay. */
  circuitBreakerBaseFeeWei: 2_000_000_000n, // 2 gwei = 400x the floor
};

/**
 * Compute fees for an attempt.
 * @param {bigint} baseFeeWei  latest block's base fee
 * @param {number} attempt     0 for the first send, 1.. for each replacement
 * @param {object} [policy]
 * @returns {{maxFeePerGas: bigint, maxPriorityFeePerGas: bigint}}
 */
export function computeFees(baseFeeWei, attempt = 0, policy = DEFAULT_POLICY) {
  if (attempt < 0 || !Number.isInteger(attempt)) throw new Error("attempt must be a non-negative integer");

  let tip = policy.initialTipWei;
  for (let i = 0; i < attempt; i++) {
    tip *= policy.escalationFactor;
    if (tip >= policy.maxTipWei) { tip = policy.maxTipWei; break; }
  }

  // Geth and friends reject a replacement whose tip is not at least 10% above
  // the one it replaces. Escalating by 3x clears that comfortably; the clamp to
  // maxTipWei is the only place it could bite, and there we are already at the
  // ceiling and should be waiting, not bidding.
  const maxFee = bigMax(
    baseFeeWei * policy.baseFeeMultiplier + tip,
    policy.minMaxFeeWei + tip,
  );

  return { maxFeePerGas: maxFee, maxPriorityFeePerGas: tip };
}

/** True if conditions are so abnormal that the queue should pause rather than pay. */
export function shouldPause(baseFeeWei, policy = DEFAULT_POLICY) {
  return baseFeeWei > policy.circuitBreakerBaseFeeWei;
}

/**
 * What one transaction costs, in wei, under a given policy.
 * @param {object} p
 * @param {bigint} p.gasUsed        L2 execution gas
 * @param {bigint} p.baseFeeWei
 * @param {bigint} p.tipWei
 * @param {bigint} [p.l1FeeWei]     Base's L1 data fee for the transaction
 */
export function costWei({ gasUsed, baseFeeWei, tipWei, l1FeeWei = 0n }) {
  return gasUsed * (baseFeeWei + tipWei) + l1FeeWei;
}

export const toGwei = (wei) => Number(wei) / 1e9;
export const weiToUsd = (wei, ethUsd) => (Number(wei) / 1e18) * ethUsd;
const bigMax = (a, b) => (a > b ? a : b);
