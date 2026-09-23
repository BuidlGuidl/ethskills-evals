const test = require("node:test");
const assert = require("node:assert");
const { computeFees, bumpFees, DEFAULTS, GWEI } = require("./fees");
const { packTransfers, MAX_UINT96 } = require("./batch");

test("computeFees clamps an oversized suggested tip to the cap", () => {
  const f = computeFees(5_000_000n, 1_500_000_000n); // 0.005 gwei base, 1.5 gwei tip
  assert.equal(f.maxPriorityFeePerGas, DEFAULTS.tipCapWei);
  assert.equal(f.maxFeePerGas, 5_000_000n * 2n + DEFAULTS.tipCapWei);
});

test("computeFees enforces the tip floor", () => {
  const f = computeFees(5_000_000n, 1n);
  assert.equal(f.maxPriorityFeePerGas, GWEI / 1000n);
});

test("computeFees respects the max fee ceiling", () => {
  const f = computeFees(10n * GWEI, GWEI / 1000n); // 10 gwei base fee spike
  assert.equal(f.maxFeePerGas, DEFAULTS.maxFeeCapWei);
  assert.ok(f.maxFeePerGas >= f.maxPriorityFeePerGas);
});

test("bumpFees raises both fields by >=10% for replacements", () => {
  const prev = { maxFeePerGas: 100_000_000n, maxPriorityFeePerGas: 1_000_000n };
  const next = bumpFees(prev);
  assert.ok(next.maxFeePerGas >= (prev.maxFeePerGas * 11n) / 10n);
  assert.ok(next.maxPriorityFeePerGas >= (prev.maxPriorityFeePerGas * 11n) / 10n);
});

test("packTransfers matches the Solidity word layout (address << 96 | amount)", () => {
  const to = "0x" + "ab".repeat(20);
  const packed = packTransfers([{ to, amount: 5_000_000n }]);
  const word = BigInt(packed);
  assert.equal(word >> 96n, BigInt(to));
  assert.equal(word & ((1n << 96n) - 1n), 5_000_000n);
  assert.equal((packed.length - 2) / 2, 32); // one 32-byte word
});

test("packTransfers rejects bad input", () => {
  assert.throws(() => packTransfers([]));
  assert.throws(() => packTransfers([{ to: "0x1234", amount: 1n }]));
  assert.throws(() =>
    packTransfers([{ to: "0x" + "ab".repeat(20), amount: MAX_UINT96 + 1n }])
  );
});
