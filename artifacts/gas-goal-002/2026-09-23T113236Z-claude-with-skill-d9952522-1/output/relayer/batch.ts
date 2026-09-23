import { encodeFunctionData, type Address, type Hex } from "viem";

/**
 * Encodes payouts for PayoutBatcher.batchTransferPacked.
 *
 * Each record is 31 bytes: 20-byte recipient ++ 11-byte amount, rather than the
 * 64 bytes an ABI array would spend per entry. That halves the L1 data fee
 * component, which matters only at the margin -- on current Base pricing the L1
 * data fee is ~1% of the cost of a transfer and execution gas is the other 99%.
 * The real saving is amortising the 21,000 gas intrinsic cost and the cold
 * token-contract access across the whole batch.
 */

export const MAX_PACKED_AMOUNT = (1n << 88n) - 1n;

export interface Payout {
  to: Address;
  amount: bigint;
}

/**
 * Batch size. Measured per-transfer gas on Base flattens out past ~100:
 * n=50 -> 11,657 | n=100 -> 11,258 | n=200 -> 11,060 | n=400 -> 10,961 (warm
 * recipients). Beyond 100 the extra ~2% is not worth widening the blast radius
 * of a single reverting batch or the retry cost when one does fail.
 */
export const DEFAULT_BATCH_SIZE = 100;

export function packPayouts(payouts: readonly Payout[]): Hex {
  if (payouts.length === 0) throw new Error("refusing to encode an empty batch");

  let out = "";
  for (const { to, amount } of payouts) {
    if (amount <= 0n) throw new Error(`non-positive payout amount for ${to}`);
    if (amount > MAX_PACKED_AMOUNT) {
      throw new Error(
        `payout ${amount} to ${to} exceeds the 11-byte packed amount field`,
      );
    }
    if (!/^0x[0-9a-fA-F]{40}$/.test(to)) throw new Error(`bad address: ${to}`);
    out += to.slice(2).toLowerCase() + amount.toString(16).padStart(22, "0");
  }
  return `0x${out}`;
}

export function chunk<T>(items: readonly T[], size = DEFAULT_BATCH_SIZE): T[][] {
  if (size <= 0) throw new Error("batch size must be positive");
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export const batchTransferPackedAbi = [
  {
    type: "function",
    name: "batchTransferPacked",
    stateMutability: "nonpayable",
    inputs: [{ name: "payload", type: "bytes" }],
    outputs: [],
  },
] as const;

export function encodeBatch(payouts: readonly Payout[]): Hex {
  return encodeFunctionData({
    abi: batchTransferPackedAbi,
    functionName: "batchTransferPacked",
    args: [packPayouts(payouts)],
  });
}
