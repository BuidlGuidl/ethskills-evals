/**
 * Calldata encoding for BatchTransfer.
 *
 * The packed layout puts one payout in one 32-byte word:
 *
 *   [ 20-byte recipient address | 12-byte uint96 amount ]
 *
 * That is half the calldata of two dynamic arrays (`address[]` + `uint256[]`), which
 * spend 12 zero-padding bytes on every address and 20+ on every realistic amount.
 */
import { concatHex, pad, toHex, getAddress, encodeFunctionData, parseAbi } from "viem";

export const BATCH_TRANSFER_ABI = parseAbi([
  "function batchTransfer(address token, address[] recipients, uint256[] amounts)",
  "function batchTransferPacked(address token, bytes payload)",
  "error LengthMismatch()",
  "error MalformedPayload()",
  "error EmptyBatch()",
  "error TransferFailed(uint256 index)",
]);

/** Largest amount representable in the packed layout's 12-byte field. */
export const MAX_PACKED_AMOUNT = (1n << 96n) - 1n;

/**
 * Pack payouts into the calldata payload.
 *
 * Amounts are validated rather than truncated: a value above uint96 would silently
 * overflow into the next word's address bytes and send money to a wrong recipient,
 * so it must fail loudly here instead.
 */
export function packPayouts(payouts) {
  if (payouts.length === 0) throw new Error("packPayouts: empty batch");

  return concatHex(
    payouts.map(({ recipient, amount }, i) => {
      const value = BigInt(amount);
      if (value < 0n) throw new Error(`payout ${i}: negative amount`);
      if (value > MAX_PACKED_AMOUNT) {
        throw new Error(
          `payout ${i}: amount ${value} exceeds uint96; use batchTransfer() for this batch`,
        );
      }
      // getAddress throws on a bad checksum / malformed address.
      return concatHex([getAddress(recipient).toLowerCase(), pad(toHex(value), { size: 12 })]);
    }),
  );
}

/** Build the full calldata for a packed batch. */
export function encodeBatch(token, payouts) {
  return encodeFunctionData({
    abi: BATCH_TRANSFER_ABI,
    functionName: "batchTransferPacked",
    args: [getAddress(token), packPayouts(payouts)],
  });
}

/** Inverse of {@link packPayouts}; used by tests and by the post-send audit log. */
export function unpackPayload(payload) {
  const hex = payload.slice(2);
  if (hex.length % 64 !== 0) throw new Error("unpackPayload: not a whole number of words");
  const out = [];
  for (let i = 0; i < hex.length; i += 64) {
    out.push({
      recipient: getAddress("0x" + hex.slice(i, i + 40)),
      amount: BigInt("0x" + hex.slice(i + 40, i + 64)),
    });
  }
  return out;
}
