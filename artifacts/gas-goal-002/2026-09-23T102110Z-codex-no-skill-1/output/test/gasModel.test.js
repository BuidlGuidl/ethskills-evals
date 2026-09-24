import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildBaseFeeParams, gweiToWei } from '../src/baseFeePolicy.js';
import { compareCosts, staticGasPriceWaste } from '../src/gasModel.js';
import {
  encodePackedTransfers,
  packedTransferCount
} from '../src/packedTransfers.js';

test('packed batching saves money under current Base assumptions', () => {
  const report = compareCosts();

  assert.equal(report.direct.gasPerTransfer, 45_065);
  assert.equal(report.batch.batchSize, 200);
  assert.ok(report.savings.usdPerDay > 13);
  assert.ok(report.savings.percent > 0.45);
});

test('static gas price waste models overtipping', () => {
  const waste = staticGasPriceWaste({ staticGasPriceGwei: 0.1 });

  assert.ok(waste.wastedUsdPerDay > 460);
  assert.ok(waste.wastedUsdPerMonth > 13_000);
});

test('Base fee policy caps priority fees and leaves headroom', () => {
  const params = buildBaseFeeParams(gweiToWei(0.005), {
    priorityFeePerGasWei: gweiToWei(0.01)
  });

  assert.equal(params.maxPriorityFeePerGas, 2_000_000n);
  assert.equal(params.maxFeePerGas, 12_000_000n);
});

test('packed transfer encoder emits 32 bytes per recipient', () => {
  const packed = encodePackedTransfers([
    {
      to: '0x1111111111111111111111111111111111111111',
      amount: 1_000_000n
    },
    {
      to: '0x2222222222222222222222222222222222222222',
      amount: 2_500_000n
    }
  ]);

  assert.equal(packedTransferCount(packed), 2);
  assert.equal((packed.length - 2) / 2, 64);
  assert.equal(
    packed,
    '0x1111111111111111111111111111111111111111' +
      '0000000000000000000f4240' +
      '2222222222222222222222222222222222222222' +
      '0000000000000000002625a0'
  );
});
