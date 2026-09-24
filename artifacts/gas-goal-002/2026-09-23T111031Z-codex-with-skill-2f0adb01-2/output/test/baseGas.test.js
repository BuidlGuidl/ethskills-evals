const assert = require("node:assert/strict");
const test = require("node:test");

const {
  buildBaseRelayerFeePolicy,
  erc20TransferCalldata,
  estimateTransferSpend,
  gweiToWei,
  summarizeSamples,
} = require("../src/baseGas");
const { chunkTransfers, coalesceTransfers, coalescingSavings } = require("../src/transferPlanning");

test("encodes ERC-20 transfer calldata", () => {
  const data = erc20TransferCalldata("0x1111111111111111111111111111111111111111", 1n);

  assert.equal(data.length, 138);
  assert.equal(data.slice(0, 10), "0xa9059cbb");
  assert.equal(data.slice(10, 74), "0000000000000000000000001111111111111111111111111111111111111111");
  assert.equal(data.slice(74), "0000000000000000000000000000000000000000000000000000000000000001");
});

test("estimates daily and monthly spend from fee inputs", () => {
  const spend = estimateTransferSpend({
    transfersPerDay: 40_000,
    executionGas: 45_576,
    effectiveGasPriceWei: gweiToWei(0.006),
    l1FeeWei: 3_047_631_766n,
    ethUsd: 2733.79,
  });

  assert.equal(spend.perTransferWei, 276_503_631_766n);
  assert.ok(spend.dailyUsd > 30);
  assert.ok(spend.dailyUsd < 31);
  assert.ok(spend.monthlyUsd > 900);
  assert.ok(spend.monthlyUsd < 910);
});

test("summarizes transfer receipt samples", () => {
  const summary = summarizeSamples([
    { gasUsed: 30_000, effectiveGasPriceGwei: 0.006, executionFeeEth: 1, l1FeeEth: 0.1, totalEth: 1.1, calldataBytes: 68 },
    { gasUsed: 50_000, effectiveGasPriceGwei: 0.008, executionFeeEth: 2, l1FeeEth: 0.1, totalEth: 2.1, calldataBytes: 68 },
    { gasUsed: 70_000, effectiveGasPriceGwei: 0.01, executionFeeEth: 3, l1FeeEth: 0.1, totalEth: 3.1, calldataBytes: 68 },
  ]);

  assert.equal(summary.count, 3);
  assert.equal(summary.average.gasUsed, 50_000);
  assert.equal(summary.p50.totalEth, 2.1);
  assert.equal(summary.p90.gasUsed, 50_000);
});

test("builds conservative Base relayer fee caps", () => {
  const policy = buildBaseRelayerFeePolicy({
    baseFeeWei: gweiToWei(0.005),
    gasPriceWei: gweiToWei(0.006),
    priorityFeeWei: gweiToWei(0.001),
    rewardP50Wei: gweiToWei(0.001),
  });

  assert.equal(policy.maxPriorityFeePerGasGwei, 0.001);
  assert.equal(policy.maxFeePerGasGwei, 0.016);
  assert.equal(policy.shouldDeferNonUrgent, false);
});

test("coalesces same token and recipient transfers", () => {
  const transfers = coalesceTransfers([
    {
      id: "a",
      token: "0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
      to: "0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB",
      amount: 10n,
    },
    {
      id: "b",
      token: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      to: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      amount: "15",
    },
    {
      id: "c",
      token: "0xCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC",
      to: "0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB",
      amount: 1n,
    },
  ]);

  assert.equal(transfers.length, 2);
  assert.equal(transfers[0].amount, 25n);
  assert.deepEqual(transfers[0].sourceIds, ["a", "b"]);
  assert.equal(transfers[0].count, 2);
});

test("chunks transfers and estimates coalescing savings", () => {
  assert.deepEqual(chunkTransfers([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
  assert.deepEqual(coalescingSavings(100, 95, 0.001), {
    skippedTransfers: 5,
    savingsUsd: 0.005,
    reductionFraction: 0.05,
  });
});
