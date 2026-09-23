/**
 * Fee policy for the relayer.
 *
 * Measured on Base mainnet (see analysis/congestion.mjs):
 *   - base fee sits at the 0.005 gwei floor in >90% of sampled blocks
 *   - blocks run ~8% full at the median and never exceeded 27% in the sample
 *   - ~10% of transactions land with a zero priority fee
 *
 * A block with 92% of its gas spare does not need to be bid into. The historical
 * relayer setting of 1 mwei (0.001 gwei) on top of a 5 mwei base fee was a ~20%
 * surcharge buying no measurable inclusion benefit, so the default tip here is 0 with
 * a congestion-triggered escalation path rather than a permanent premium.
 */

/** Priority fee ladder, in wei. Escalate only when blocks actually fill up. */
export const TIP_LADDER = [
  { fullnessPct: 0, tip: 0n },
  { fullnessPct: 40, tip: 1_000_000n },   // 0.001 gwei
  { fullnessPct: 70, tip: 10_000_000n },  // 0.01 gwei
  { fullnessPct: 90, tip: 100_000_000n }, // 0.1 gwei
];

/** Multiplier on base fee to absorb the ~12.5% per-block rise while queued. */
const BASE_FEE_HEADROOM = 2n;

/** Mean gas fullness of the most recent `n` blocks, as a percentage. */
export async function recentFullness(client, n = 10) {
  const head = await client.getBlockNumber();
  const blocks = await Promise.all(
    Array.from({ length: n }, (_, i) => client.getBlock({ blockNumber: head - BigInt(i) })),
  );
  const pct = blocks.map((b) => Number((b.gasUsed * 100n) / b.gasLimit));
  return pct.reduce((a, b) => a + b, 0) / pct.length;
}

export function tipForFullness(fullnessPct) {
  let tip = TIP_LADDER[0].tip;
  for (const step of TIP_LADDER) if (fullnessPct >= step.fullnessPct) tip = step.tip;
  return tip;
}

/**
 * EIP-1559 fields for the next relayer transaction.
 *
 * `maxFeePerGas` is deliberately generous (2x base + tip): it is only a ceiling, and the
 * sender is refunded the difference. Being stingy here risks a stuck transaction during
 * a base-fee spike, which costs far more in operational pain than the headroom does in
 * gas — the relayer is never actually charged the ceiling.
 */
export async function buildFeeParams(client, { urgent = false } = {}) {
  const [block, fullness] = await Promise.all([
    client.getBlock({ blockTag: "latest" }),
    recentFullness(client),
  ]);
  const baseFee = block.baseFeePerGas ?? 0n;
  const tip = urgent ? (tipForFullness(fullness) || 1_000_000n) : tipForFullness(fullness);

  return {
    maxPriorityFeePerGas: tip,
    maxFeePerGas: baseFee * BASE_FEE_HEADROOM + tip,
    observed: { baseFee, fullnessPct: Number(fullness.toFixed(1)), tip },
  };
}
