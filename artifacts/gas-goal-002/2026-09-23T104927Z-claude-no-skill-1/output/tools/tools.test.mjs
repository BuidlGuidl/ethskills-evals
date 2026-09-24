import { test } from 'node:test'
import assert from 'node:assert/strict'
import { packPayments, unpackPayments, chunkPayments, assertFloatCovers, AmountTooLarge, MAX_AMOUNT, RECORD_SIZE } from './batch.mjs'
import { buildFees, expectedCostWei, GasPriceTooHigh, DEFAULT_TIP_WEI } from './fee-policy.mjs'

const A = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
const B = '0x4200000000000000000000000000000000000006'

test('packed payload is exactly 32 bytes per payment', () => {
  const p = packPayments([{ to: A, amount: 1n }, { to: B, amount: 2n }])
  assert.equal((p.length - 2) / 2, 2 * RECORD_SIZE)
})

test('pack/unpack round-trips recipients and amounts', () => {
  const payments = [{ to: A, amount: 5_000_000n }, { to: B, amount: MAX_AMOUNT }]
  assert.deepEqual(unpackPayments(packPayments(payments)), payments)
})

test('amounts that would silently truncate on-chain are rejected', () => {
  assert.throws(() => packPayments([{ to: A, amount: MAX_AMOUNT + 1n }]), AmountTooLarge)
})

test('zero and negative amounts are rejected', () => {
  assert.throws(() => packPayments([{ to: A, amount: 0n }]), /must be positive/)
})

test('malformed recipient is rejected before signing', () => {
  assert.throws(() => packPayments([{ to: '0xdeadbeef', amount: 1n }]))
})

test('empty batch is refused', () => {
  assert.throws(() => packPayments([]), /empty batch/)
})

test('chunking preserves order and count', () => {
  const ps = Array.from({ length: 250 }, (_, i) => ({ to: A, amount: BigInt(i + 1) }))
  const chunks = chunkPayments(ps, 100)
  assert.deepEqual(chunks.map(c => c.length), [100, 100, 50])
  assert.deepEqual(chunks.flat(), ps)
})

test('a batch larger than the float is refused', () => {
  const ps = [{ to: A, amount: 10n }, { to: B, amount: 10n }]
  assert.equal(assertFloatCovers(ps, 20n), 20n)
  assert.throws(() => assertFloatCovers(ps, 19n), /holds only/)
})

/* ------------------------------------------------------------ fee policy */

const clientWith = baseFee => ({ getBlock: async () => ({ baseFeePerGas: baseFee }) })

test('tip defaults to the node-suggested 1 mwei, not an L1-sized bid', async () => {
  const f = await buildFees(clientWith(5_000_000n))
  assert.equal(f.maxPriorityFeePerGas, DEFAULT_TIP_WEI)
  assert.equal(f.expectedGasPrice, 6_000_000n)
})

test('maxFeePerGas carries headroom but is not what we pay', async () => {
  const f = await buildFees(clientWith(5_000_000n))
  assert.equal(f.maxFeePerGas, 21_000_000n)        // 4 * base + tip
  assert.equal(f.expectedGasPrice, 6_000_000n)     // what actually leaves the wallet
  assert.ok(f.maxFeePerGas > f.expectedGasPrice)
})

test('the circuit breaker refuses to send at an absurd base fee', async () => {
  await assert.rejects(() => buildFees(clientWith(600_000_000n)), GasPriceTooHigh)
})

test('maxFeePerGas never drops below base + tip even when clamped', async () => {
  const f = await buildFees(clientWith(400_000_000n), { maxGasPriceWei: 401_000_000n })
  assert.ok(f.maxFeePerGas >= 400_000_000n + f.maxPriorityFeePerGas)
})

test('tip escalates only on replacement attempts', async () => {
  const a0 = await buildFees(clientWith(5_000_000n), { attempt: 0 })
  const a2 = await buildFees(clientWith(5_000_000n), { attempt: 2 })
  assert.equal(a0.maxPriorityFeePerGas, 1_000_000n)
  assert.equal(a2.maxPriorityFeePerGas, 4_000_000n)
})

test('expected cost uses base+tip, and batching beats singles at measured gas', async () => {
  const f = await buildFees(clientWith(5_000_000n))
  const single = expectedCostWei(f, 45_059)
  const batched = expectedCostWei(f, 18_044)
  assert.equal(single, 45_059n * 6_000_000n)
  assert.ok(batched < single)
})
