// Fee selection for the Base relayer.
//
// Base's sequencer takes transactions at a very small priority fee - at the time
// of writing the L2 base fee is ~0.005 gwei and a 0.001 gwei tip is enough for
// next-block inclusion. The common failure mode is not paying too little, it is
// carrying over a mainnet-era constant (1-2 gwei) and paying ~150x the going
// rate forever. This module makes the paid price track the chain.
//
// computeFees() is deliberately pure so it can be unit-tested without a node;
// getFeeOverrides() is the thin ethers adapter the relayer actually calls.

const GWEI = 1_000_000_000n;

export const DEFAULTS = {
  // Floor for the tip. Base accepts ~0.001 gwei; going lower saves nothing
  // meaningful and risks the sequencer deprioritising the tx.
  minPriorityFeeWei: GWEI / 1000n, // 0.001 gwei
  // Ceiling for the tip. A tip above this is almost certainly a config bug
  // rather than a real market condition on an L2.
  maxPriorityFeeWei: GWEI / 20n, // 0.05 gwei
  // Headroom multiplier on base fee, as a percentage. Base fee can rise at most
  // 12.5% per block; 3x covers a sustained climb over several blocks while the
  // tx sits in the mempool. Unused headroom is refunded - maxFeePerGas is a cap,
  // not a price - so being generous here costs nothing.
  baseFeeHeadroomPct: 300n,
  // Refuse to send above this total price. At 50 gwei a transfer costs ~$6
  // instead of ~$0.0008; that is a broken chain condition, not something to pay
  // through automatically.
  maxFeePerGasCeilingWei: 50n * GWEI,
};

/**
 * @param {object} p
 * @param {bigint} p.baseFeeWei        current L2 base fee
 * @param {bigint} [p.suggestedTipWei] eth_maxPriorityFeePerGas, if available
 * @param {object} [p.opts]            overrides for DEFAULTS
 * @returns {{maxFeePerGas: bigint, maxPriorityFeePerGas: bigint, spike: boolean}}
 */
export function computeFees({ baseFeeWei, suggestedTipWei, opts = {} }) {
  const cfg = { ...DEFAULTS, ...opts };

  if (typeof baseFeeWei !== 'bigint' || baseFeeWei < 0n) {
    throw new TypeError('baseFeeWei must be a non-negative bigint');
  }

  // Track the sequencer's suggestion, but clamp it into a sane band.
  let tip = suggestedTipWei ?? cfg.minPriorityFeeWei;
  if (tip < cfg.minPriorityFeeWei) tip = cfg.minPriorityFeeWei;
  if (tip > cfg.maxPriorityFeeWei) tip = cfg.maxPriorityFeeWei;

  const maxFeePerGas = (baseFeeWei * cfg.baseFeeHeadroomPct) / 100n + tip;

  // A spike is judged on the base fee, not on our own cap: maxFeePerGas is
  // inflated by design and would false-positive.
  const spike = baseFeeWei + tip > cfg.maxFeePerGasCeilingWei;

  return { maxFeePerGas, maxPriorityFeePerGas: tip, spike };
}

/**
 * Fee overrides for an ethers v6 ContractTransaction / TransactionRequest.
 * Throws on a genuine fee spike so the caller can queue rather than overpay.
 *
 * @param {import('ethers').Provider} provider
 * @param {object} [opts] overrides for DEFAULTS
 */
export async function getFeeOverrides(provider, opts = {}) {
  const block = await provider.getBlock('latest');
  const baseFeeWei = block?.baseFeePerGas ?? 0n;

  let suggestedTipWei;
  try {
    const hex = await provider.send('eth_maxPriorityFeePerGas', []);
    suggestedTipWei = BigInt(hex);
  } catch {
    // Not every Base RPC exposes it; the clamp handles the fallback.
    suggestedTipWei = undefined;
  }

  const { maxFeePerGas, maxPriorityFeePerGas, spike } = computeFees({ baseFeeWei, suggestedTipWei, opts });

  if (spike) {
    const err = new Error(
      `Base fee spike: ${Number(baseFeeWei) / 1e9} gwei. Refusing to send; retry when it settles.`
    );
    err.code = 'FEE_SPIKE';
    err.baseFeeWei = baseFeeWei;
    throw err;
  }

  return { maxFeePerGas, maxPriorityFeePerGas };
}
