/**
 * Fee policy for the Base relayer.
 *
 * The thing that actually costs money is the PRIORITY FEE (the tip). `maxFeePerGas`
 * is only a ceiling: you are charged `baseFee + min(tip, maxFeePerGas - baseFee)`.
 * Raising maxFeePerGas therefore buys reliability for free, while raising the tip
 * is a direct, permanent cost. Most SDK defaults get this backwards and bid a tip
 * sized for Ethereum L1 congestion.
 *
 * Measured on Base (see tools/measured.json):
 *   - base fee sits pinned at its 5 mwei floor
 *   - blocks run ~8.7% full against a 400M gas limit
 *   - all 60 blocks sampled contained at least one zero-tip transaction
 *
 * So a tip above ~1 mwei buys nothing. 1 mwei is what the Base node's own
 * eth_gasPrice suggests, and is the default here.
 */

/** Node-suggested tip on Base. Inclusion is not tip-constrained at current load. */
export const DEFAULT_TIP_WEI = 1_000_000n

/** Ceiling multiple applied to the current base fee. Costs nothing unless the base fee actually rises. */
export const DEFAULT_BASE_FEE_HEADROOM = 4n

/**
 * Hard ceiling on gas price, as a circuit breaker. If Base ever repriced far above
 * this, we would rather have transactions stall visibly than silently burn the float.
 */
export const DEFAULT_MAX_GAS_PRICE_WEI = 500_000_000n // 0.5 gwei

export class GasPriceTooHigh extends Error {
  constructor(baseFee, cap) {
    super(`Base fee ${baseFee} wei exceeds the configured ceiling ${cap} wei; refusing to send.`)
    this.name = 'GasPriceTooHigh'
    this.baseFee = baseFee
    this.cap = cap
  }
}

/**
 * Build EIP-1559 fee fields for a Base transaction.
 *
 * @param {import('viem').PublicClient} client
 * @param {object} [opts]
 * @param {bigint} [opts.tipWei]        priority fee to bid
 * @param {bigint} [opts.headroom]      multiple of base fee allowed in maxFeePerGas
 * @param {bigint} [opts.maxGasPriceWei] circuit breaker
 * @param {number} [opts.attempt]       replacement attempt; only this escalates the tip
 */
export async function buildFees(client, opts = {}) {
  const {
    tipWei = DEFAULT_TIP_WEI,
    headroom = DEFAULT_BASE_FEE_HEADROOM,
    maxGasPriceWei = DEFAULT_MAX_GAS_PRICE_WEI,
    attempt = 0,
  } = opts

  const block = await client.getBlock({ blockTag: 'latest' })
  const baseFee = block.baseFeePerGas
  if (baseFee === null || baseFee === undefined) throw new Error('no baseFeePerGas on latest block')
  if (baseFee > maxGasPriceWei) throw new GasPriceTooHigh(baseFee, maxGasPriceWei)

  // Escalate only on replacement: each retry doubles the tip so a genuinely stuck
  // transaction can clear the replacement rule, without inflating the steady state.
  const maxPriorityFeePerGas = tipWei * (1n << BigInt(attempt))

  let maxFeePerGas = baseFee * headroom + maxPriorityFeePerGas
  if (maxFeePerGas > maxGasPriceWei) maxFeePerGas = maxGasPriceWei
  if (maxFeePerGas < baseFee + maxPriorityFeePerGas) maxFeePerGas = baseFee + maxPriorityFeePerGas

  return { maxFeePerGas, maxPriorityFeePerGas, baseFee, expectedGasPrice: baseFee + maxPriorityFeePerGas }
}

/** What a transaction of `gas` units would actually cost under these fees, in wei. */
export function expectedCostWei(fees, gas) {
  return fees.expectedGasPrice * BigInt(gas)
}
