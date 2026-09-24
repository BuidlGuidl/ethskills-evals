/**
 * Priority-fee strategy for a Base relayer.
 *
 * Measured on Base mainnet (see scripts/priority-floor.mjs): the L2 base fee
 * sits pinned at the 5,000,000 wei (0.005 gwei) protocol floor, blocks run ~12%
 * full, and ~8% of user transactions land with a *zero* priority fee. A relayer
 * paying the 1,000,000 wei tip that `eth_maxPriorityFeePerGas` suggests is
 * therefore paying ~17% more per unit of gas than the network requires.
 *
 * Bidding zero outright is not free, though: it has no headroom if the
 * sequencer ever backs up. So this strategy opens low and escalates only when a
 * transaction actually fails to land, which bounds the tail latency while
 * keeping the steady-state tip near zero.
 */

/** Escalation ladder in wei. Index 0 is the opening bid. */
export const DEFAULT_TIP_LADDER = [1_000n, 100_000n, 1_000_000n, 5_000_000n, 25_000_000n];

export const DEFAULTS = {
  tipLadder: DEFAULT_TIP_LADDER,
  /** Blocks to wait at a rung before escalating. Base blocks are 2s. */
  blocksPerRung: 3,
  /** maxFeePerGas = baseFee * this + tip. Covers base-fee growth while queued. */
  baseFeeMultiplier: 3n,
  /** Never bid above this tip, whatever happens. */
  maxTipWei: 100_000_000n,
};

export class FeeStrategy {
  /** @param {Partial<typeof DEFAULTS>} [opts] */
  constructor(opts = {}) {
    this.cfg = { ...DEFAULTS, ...opts };
  }

  /**
   * Fee fields for an attempt.
   * @param {bigint} baseFeePerGas current L2 base fee
   * @param {number} attempt 0-based resend counter
   */
  fees(baseFeePerGas, attempt = 0) {
    const ladder = this.cfg.tipLadder;
    let tip = ladder[Math.min(attempt, ladder.length - 1)];
    if (tip > this.cfg.maxTipWei) tip = this.cfg.maxTipWei;
    return {
      maxPriorityFeePerGas: tip,
      maxFeePerGas: baseFeePerGas * this.cfg.baseFeeMultiplier + tip,
    };
  }

  /**
   * A replacement must beat the previous bid by >=10% on both fields or the
   * sequencer rejects it as an underpriced replacement.
   */
  replacementFees(baseFeePerGas, attempt, previous) {
    const next = this.fees(baseFeePerGas, attempt);
    const bump = (a, b) => {
      const floor = (b * 110n) / 100n + 1n;
      return a > floor ? a : floor;
    };
    return {
      maxPriorityFeePerGas: bump(next.maxPriorityFeePerGas, previous.maxPriorityFeePerGas),
      maxFeePerGas: bump(next.maxFeePerGas, previous.maxFeePerGas),
    };
  }

  /** Whether to escalate after waiting `blocksWaited` blocks at `attempt`. */
  shouldEscalate(blocksWaited) {
    return blocksWaited >= this.cfg.blocksPerRung;
  }
}
