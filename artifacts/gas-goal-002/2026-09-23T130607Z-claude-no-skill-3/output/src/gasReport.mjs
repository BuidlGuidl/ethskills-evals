/**
 * Gas accounting for finance.
 *
 * Every Base receipt carries the two cost components separately:
 *   l2 = gasUsed * effectiveGasPrice   (execution, paid to the sequencer)
 *   l1 = l1Fee                         (data availability, paid to post to L1)
 * Totalling those over a period is the actual spend -- no estimation involved.
 */

export const WEI_PER_ETH = 10n ** 18n;

/**
 * @param {Array<{gasUsed: bigint, effectiveGasPrice: bigint, l1Fee?: bigint, batchSize?: number}>} receipts
 * @param {number} ethUsd
 */
export function summarise(receipts, ethUsd) {
  let l2 = 0n, l1 = 0n, gas = 0n, payouts = 0;
  for (const r of receipts) {
    const g = BigInt(r.gasUsed);
    gas += g;
    l2 += g * BigInt(r.effectiveGasPrice);
    l1 += BigInt(r.l1Fee ?? 0n);
    payouts += r.batchSize ?? 1;
  }
  const total = l2 + l1;
  const usd = (wei) => (Number(wei) / Number(WEI_PER_ETH)) * ethUsd;
  return {
    transactions: receipts.length,
    payouts,
    gasUnits: Number(gas),
    l2FeeWei: l2, l1FeeWei: l1, totalFeeWei: total,
    l2FeeUsd: usd(l2), l1FeeUsd: usd(l1), totalFeeUsd: usd(total),
    l1SharePct: total === 0n ? 0 : 100 * (Number(l1) / Number(total)),
    usdPerPayout: payouts === 0 ? 0 : usd(total) / payouts,
    gasPerPayout: payouts === 0 ? 0 : Number(gas) / payouts,
  };
}

/** Project an annual run-rate from a per-payout cost. */
export function annualise(usdPerPayout, payoutsPerDay) {
  return {
    perDayUsd: usdPerPayout * payoutsPerDay,
    perMonthUsd: usdPerPayout * payoutsPerDay * 30,
    perYearUsd: usdPerPayout * payoutsPerDay * 365,
  };
}

/** Fetch receipts for a list of hashes and summarise. */
export async function reportFromChain(rpcUrl, hashes, ethUsd, batchSizes = {}) {
  const receipts = [];
  for (let i = 0; i < hashes.length; i += 20) {
    const chunk = hashes.slice(i, i + 20);
    const res = await fetch(rpcUrl, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(chunk.map((h, k) => ({
        jsonrpc: '2.0', id: i + k, method: 'eth_getTransactionReceipt', params: [h],
      }))),
    });
    for (const x of await res.json()) {
      if (!x.result) continue;
      receipts.push({
        gasUsed: BigInt(x.result.gasUsed),
        effectiveGasPrice: BigInt(x.result.effectiveGasPrice),
        l1Fee: BigInt(x.result.l1Fee ?? '0x0'),
        batchSize: batchSizes[x.result.transactionHash] ?? 1,
      });
    }
  }
  return summarise(receipts, ethUsd);
}
