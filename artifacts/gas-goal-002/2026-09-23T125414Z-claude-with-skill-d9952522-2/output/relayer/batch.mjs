// Groups pending payouts into BatchTransfer calls.
//
// Sizing rule: marginal gas per recipient measured on forked Base is ~29,000 for a
// first-time payee and ~11,900 for a repeat payee (test/BatchTransfer.t.sol). Batch
// size is bounded by the block gas limit, not by cost -- cost per payout keeps
// falling with size, so the only reason to cap is blast radius when a batch reverts.

export const MARGINAL_GAS_NEW_RECIPIENT = 29_000n;
export const MARGINAL_GAS_REPEAT_RECIPIENT = 11_900n;
export const BATCH_FIXED_GAS = 76_000n; // intrinsic + approve/pull + loop setup

export const MAX_UINT96 = (1n << 96n) - 1n;

/** Pack one payout into the calldata word `dispersePacked` expects. */
export function packPayout({ to, amount }) {
  const a = BigInt(amount);
  if (a > MAX_UINT96) throw new Error(`amount ${a} exceeds uint96; route via disperse() instead`);
  if (a === 0n) throw new Error('zero-amount payout');
  const addr = BigInt(to);
  if (addr === 0n) throw new Error('payout to zero address');
  return '0x' + ((addr << 96n) | a).toString(16).padStart(64, '0');
}

export function estimateBatchGas(payouts) {
  return payouts.reduce(
    (g, p) => g + (p.isRepeatRecipient ? MARGINAL_GAS_REPEAT_RECIPIENT : MARGINAL_GAS_NEW_RECIPIENT),
    BATCH_FIXED_GAS,
  );
}

/**
 * Split payouts into batches that stay under `maxGas` and `maxSize`.
 * A reverting batch fails every payout in it, so keep batches small enough that a
 * retry is cheap. 50-100 is the sweet spot: at 50 the fixed cost is already
 * amortised to under 1,600 gas per payout.
 */
export function planBatches(payouts, { maxGas = 8_000_000n, maxSize = 100 } = {}) {
  const batches = [];
  let current = [];
  for (const p of payouts) {
    const candidate = [...current, p];
    if (current.length > 0 && (candidate.length > maxSize || estimateBatchGas(candidate) > maxGas)) {
      batches.push(current);
      current = [p];
    } else {
      current = candidate;
    }
  }
  if (current.length > 0) batches.push(current);
  return batches;
}

/** ABI-encode `dispersePacked(address,bytes32[])` without pulling in a full ABI lib. */
export function encodeDispersePacked(token, payouts) {
  const words = payouts.map(packPayout).map((w) => w.slice(2));
  const head = [
    BigInt(token).toString(16).padStart(64, '0'), // token
    (64n).toString(16).padStart(64, '0'), // offset to array
    BigInt(words.length).toString(16).padStart(64, '0'), // array length
  ];
  // selector verified against `cast sig 'dispersePacked(address,bytes32[])'`
  return '0x8890519a' + head.join('') + words.join('');
}
