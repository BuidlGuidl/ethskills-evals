#!/usr/bin/env node
//
// batch — relayer-side encoding for BatchPay.
//
// Turns a list of {to, amount} payments into the packed calldata BatchPay.pay
// expects, splits it into transaction-sized chunks, and provides the bisect
// routine that a batch needs in order to survive one bad recipient.
//
// Usable as a library:
//   import { encodeBatch, chunk, payBatchesWithBisect } from "./tools/batch.mjs";
//
// Or as a CLI smoke test:
//   node tools/batch.mjs --demo
//
// No dependencies.

/** Largest amount expressible in the packed uint96 field. */
export const MAX_AMOUNT = (1n << 96n) - 1n;

/**
 * Default payments per transaction.
 *
 * Chosen from test/GasBenchmark.t.sol: savings flatten out by ~100 payments
 * (73% at 100, 73% at 250, 73% at 500), so going bigger buys nothing while
 * raising the cost of a batch that has to be retried. 250 payments is roughly
 * 3.14M gas — 0.8% of Base's 400M block limit, so it will not struggle for
 * inclusion — and caps the blast radius of a revert at one 250-payment retry.
 */
export const DEFAULT_BATCH_SIZE = 250;

const HEX = /^0x[0-9a-fA-F]{40}$/;

/**
 * Encode payments as concatenated 32-byte words: address (20B) || uint96 (12B).
 * @param {{to: string, amount: bigint|string|number}[]} payments
 * @returns {string} 0x-prefixed calldata for BatchPay.pay
 */
export function encodeBatch(payments) {
  if (!Array.isArray(payments) || payments.length === 0) {
    throw new Error("encodeBatch: expected a non-empty array of payments");
  }
  let out = "";
  payments.forEach((p, i) => {
    if (!HEX.test(p.to)) throw new Error(`payment ${i}: malformed address ${p.to}`);
    const amount = BigInt(p.amount);
    if (amount < 0n) throw new Error(`payment ${i}: negative amount`);
    // The contract silently truncates above 2^96; reject here so an overflow
    // can never become an underpayment that looks successful on-chain.
    if (amount > MAX_AMOUNT) throw new Error(`payment ${i}: amount ${amount} exceeds uint96`);
    if (amount === 0n) throw new Error(`payment ${i}: zero amount wastes gas`);
    out += p.to.slice(2).toLowerCase() + amount.toString(16).padStart(24, "0");
  });
  return "0x" + out;
}

/** Split an array into fixed-size chunks. */
export function chunk(items, size = DEFAULT_BATCH_SIZE) {
  if (size < 1) throw new Error("chunk: size must be >= 1");
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** Decode BatchPay's `TransferFailed(uint256)` revert into the failing index. */
export function parseFailedIndex(err) {
  // selector for TransferFailed(uint256)
  const SELECTOR = "0xc39ba1a9";
  const data =
    err?.data?.data ?? err?.data ?? err?.error?.data ?? err?.info?.error?.data ?? null;
  if (typeof data !== "string" || !data.startsWith(SELECTOR)) return null;
  return Number(BigInt("0x" + data.slice(10)));
}

/**
 * Send a set of payments, tolerating individual bad recipients.
 *
 * BatchPay is deliberately atomic, which means one blacklisted or reverting
 * recipient fails the whole batch. Rather than dropping the batch or retrying
 * blindly, use the index the contract reports: quarantine that payment and
 * re-send the rest. Falls back to halving when the index is unavailable.
 *
 * @param {{to:string, amount:bigint}[]} payments
 * @param {(calldata: string, payments: object[]) => Promise<any>} send
 *        Submits one transaction; should reject on revert.
 * @param {object} [opts]
 * @returns {Promise<{sent: object[], quarantined: {payment: object, reason: string}[]}>}
 */
export async function payBatchesWithBisect(payments, send, opts = {}) {
  const size = opts.batchSize ?? DEFAULT_BATCH_SIZE;
  const sent = [];
  const quarantined = [];

  const attempt = async (group, depth = 0) => {
    if (group.length === 0) return;
    try {
      await send(encodeBatch(group), group);
      sent.push(...group);
      return;
    } catch (err) {
      if (group.length === 1) {
        quarantined.push({ payment: group[0], reason: err?.shortMessage || String(err) });
        return;
      }
      const idx = parseFailedIndex(err);
      if (idx !== null && idx >= 0 && idx < group.length) {
        // The contract told us exactly which payment is bad. Quarantine it and
        // retry the remainder as one batch — no halving needed.
        quarantined.push({ payment: group[idx], reason: "reverted in BatchPay" });
        await attempt([...group.slice(0, idx), ...group.slice(idx + 1)], depth + 1);
        return;
      }
      // Cause unknown (out of gas, allowance, funder balance). Halve and retry.
      const mid = Math.floor(group.length / 2);
      await attempt(group.slice(0, mid), depth + 1);
      await attempt(group.slice(mid), depth + 1);
    }
  };

  for (const group of chunk(payments, size)) await attempt(group);
  return { sent, quarantined };
}

/**
 * Fee overrides for the relayer.
 *
 * Measured on Base 2026-09-23: blocks run ~18% full against a 400M gas limit,
 * and 9.2% of transactions are included paying a zero priority fee. A tip is
 * buying position in a queue that does not exist. 0.0001 gwei stays strictly
 * above zero — so the transaction is never mistaken for an underpriced one by
 * a node's mempool policy — while costing ~2% of the base fee instead of 20%.
 *
 * maxFeePerGas keeps wide headroom because it is a ceiling, not a payment:
 * under EIP-1559 the relayer is refunded the difference, so over-provisioning
 * costs nothing and protects against a base-fee spike stranding a payment run.
 */
export function feeOverrides({ l2BaseFeeGwei = 0.005 } = {}) {
  const gwei = (n) => BigInt(Math.round(n * 1e9));
  return {
    maxPriorityFeePerGas: gwei(0.0001),
    maxFeePerGas: gwei(Math.max(l2BaseFeeGwei * 4, 0.05)),
  };
}

// ---------------------------------------------------------------------------
// CLI smoke test
// ---------------------------------------------------------------------------
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop())) {
  if (process.argv.includes("--demo")) {
    const payments = Array.from({ length: 600 }, (_, i) => ({
      to: "0x" + (i + 1).toString(16).padStart(40, "0"),
      amount: BigInt(25_500_000 + i),
    }));
    const groups = chunk(payments);
    console.log(`payments            ${payments.length}`);
    console.log(`transactions        ${groups.length} (batch size ${DEFAULT_BATCH_SIZE})`);
    const cd = encodeBatch(groups[0]);
    console.log(`first tx calldata   ${(cd.length - 2) / 2} bytes for ${groups[0].length} payments`);
    console.log(`bytes per payment   ${(cd.length - 2) / 2 / groups[0].length}`);
    console.log(`fee overrides       ${JSON.stringify(feeOverrides(), (k, v) => (typeof v === "bigint" ? v.toString() : v))}`);

    // Exercise the bisect path: recipient #7 always reverts.
    const bad = payments[7].to;
    const { sent, quarantined } = await payBatchesWithBisect(
      payments.slice(0, 20),
      async (_cd, group) => {
        const i = group.findIndex((p) => p.to === bad);
        if (i >= 0) {
          const e = new Error("revert");
          e.data = "0xc39ba1a9" + BigInt(i).toString(16).padStart(64, "0");
          throw e;
        }
      },
      { batchSize: 20 }
    );
    console.log(`bisect: sent ${sent.length}, quarantined ${quarantined.length} (${quarantined[0]?.payment.to})`);
  } else {
    console.log("usage: node tools/batch.mjs --demo");
  }
}
