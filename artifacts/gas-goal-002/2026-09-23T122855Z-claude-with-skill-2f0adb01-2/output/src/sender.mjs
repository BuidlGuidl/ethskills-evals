/**
 * Batching sender for the relayer: accumulates pending transfers, flushes them
 * through BatchTransfer, and prices each send with the fee policy.
 *
 * Two knobs decide the cost/latency trade-off:
 *   batchSize  -- transfers per transaction. Measured cost per transfer falls
 *                 steeply to ~25 and is flat past ~100.
 *   maxWaitMs  -- how long a transfer may sit in the queue before we flush a
 *                 partial batch. This is the latency you are buying the saving
 *                 with; at 40k/day (~28/min) a 60s window fills ~28 slots.
 *
 * A batch is all-or-nothing on chain: BatchTransfer reverts the whole call if
 * any single transfer fails, so a batch either settles completely or not at all.
 * `onSettled` / `onFailed` are where you reconcile that against your ledger.
 */

import { encodeFunctionData } from "viem";
import { computeFees, shouldPause, DEFAULT_POLICY } from "./feePolicy.mjs";

export const BATCH_TRANSFER_ABI = [
  {
    type: "function", name: "dispersePacked", stateMutability: "nonpayable",
    inputs: [{ type: "address", name: "token" }, { type: "uint256[]", name: "entries" }],
    outputs: [],
  },
];

const U96_MAX = (1n << 96n) - 1n;

export function packEntry(to, amount) {
  if (amount < 0n || amount > U96_MAX) {
    throw new RangeError(`amount ${amount} does not fit in 96 bits; use disperse() for this token`);
  }
  return (BigInt(to) << 96n) | amount;
}

export class BatchingSender {
  /**
   * @param {object} o
   * @param {import("viem").WalletClient} o.wallet
   * @param {import("viem").PublicClient} o.publicClient
   * @param {`0x${string}`} o.batchTransfer  deployed BatchTransfer address
   * @param {`0x${string}`} o.token
   * @param {number} [o.batchSize=100]
   * @param {number} [o.maxWaitMs=60000]
   * @param {number} [o.maxAttempts=5]
   * @param {object} [o.policy]
   * @param {(b:object)=>void} [o.onSettled]
   * @param {(b:object, e:Error)=>void} [o.onFailed]
   */
  constructor(o) {
    Object.assign(this, {
      batchSize: 100, maxWaitMs: 60_000, maxAttempts: 5,
      policy: DEFAULT_POLICY, onSettled: () => {}, onFailed: () => {},
      ...o,
    });
    this.queue = [];
    this.timer = null;
    this.flushing = false;
  }

  /** Queue one transfer. Resolves when the batch containing it settles. */
  enqueue(to, amount) {
    return new Promise((resolve, reject) => {
      this.queue.push({ to, amount: BigInt(amount), resolve, reject });
      if (this.queue.length >= this.batchSize) {
        this.flush();
      } else if (!this.timer) {
        this.timer = setTimeout(() => this.flush(), this.maxWaitMs);
      }
    });
  }

  async flush() {
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    if (this.flushing || this.queue.length === 0) return;
    this.flushing = true;
    const batch = this.queue.splice(0, this.batchSize);

    try {
      const receipt = await this.#send(batch);
      this.onSettled({ size: batch.length, hash: receipt.transactionHash, gasUsed: receipt.gasUsed });
      for (const t of batch) t.resolve(receipt);
    } catch (e) {
      this.onFailed({ size: batch.length }, e);
      for (const t of batch) t.reject(e);
    } finally {
      this.flushing = false;
      if (this.queue.length > 0) {
        if (this.queue.length >= this.batchSize) queueMicrotask(() => this.flush());
        else this.timer = setTimeout(() => this.flush(), this.maxWaitMs);
      }
    }
  }

  async #send(batch) {
    const data = encodeFunctionData({
      abi: BATCH_TRANSFER_ABI,
      functionName: "dispersePacked",
      args: [this.token, batch.map((t) => packEntry(t.to, t.amount))],
    });

    // One nonce for the whole escalation ladder: each attempt replaces the
    // previous transaction rather than adding another one.
    const nonce = await this.publicClient.getTransactionCount({
      address: this.wallet.account.address, blockTag: "pending",
    });

    let lastError;
    for (let attempt = 0; attempt < this.maxAttempts; attempt++) {
      const block = await this.publicClient.getBlock();
      const baseFee = block.baseFeePerGas ?? 0n;
      if (shouldPause(baseFee, this.policy)) {
        throw new Error(`base fee ${Number(baseFee) / 1e9} gwei is above the circuit breaker; not sending`);
      }

      const fees = computeFees(baseFee, attempt, this.policy);
      try {
        const hash = await this.wallet.sendTransaction({
          to: this.batchTransfer, data, nonce, ...fees,
        });
        return await this.publicClient.waitForTransactionReceipt({
          hash, timeout: this.policy.inclusionTimeoutMs,
        });
      } catch (e) {
        // A timeout means "not included yet" -- bump the tip and replace. Any
        // other error (revert, bad nonce, insufficient funds) is not a fee
        // problem and retrying at a higher tip would just burn more money.
        if (!/timed out|timeout|replacement/i.test(e.message ?? "")) throw e;
        lastError = e;
      }
    }
    throw lastError ?? new Error("batch not included after maxAttempts");
  }
}
