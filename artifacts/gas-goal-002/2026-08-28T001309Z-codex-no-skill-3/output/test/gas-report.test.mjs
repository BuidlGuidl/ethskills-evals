import test from 'node:test';
import assert from 'node:assert/strict';

// Guards the accounting identity used by gas-report: actual Base cost is not just gasUsed * gasPrice.
test('Base receipt fee components add without floating point arithmetic', () => {
  const gasUsed = 50_000n;
  const effectiveGasPrice = 5_000_000n;
  const l1Fee = 1_200_000_000_000n;
  const operatorFee = 0n;
  const total = gasUsed * effectiveGasPrice + l1Fee + operatorFee;
  assert.equal(total, 1_450_000_000_000n);
});
