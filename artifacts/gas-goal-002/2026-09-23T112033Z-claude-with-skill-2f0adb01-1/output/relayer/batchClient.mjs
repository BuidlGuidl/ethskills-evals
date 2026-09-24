// Batching client for the payout relayer.
//
// Accumulates payouts and flushes them through BatchTransfer in one transaction.
// Two knobs, and they trade cost against latency:
//   maxBatchSize - larger batches amortise the ~21k intrinsic + ~54k dispatch
//                  cost over more payouts. Returns flatten past ~100.
//   maxWaitMs    - how long a payout may sit waiting for the batch to fill.
//
// At 40,000 payouts/day (~28/min) a batch of 100 fills in ~3.6 minutes, so
// maxWaitMs is what actually bounds latency, not the size.

import { getFeeOverrides } from './feeStrategy.mjs';

export const BATCH_TRANSFER_ABI = [
  'function batchTransfer(address token, address[] recipients, uint256[] amounts)',
  'function batchTransferSameAmount(address token, address[] recipients, uint256 amount)',
  'function relayer() view returns (address)',
];

export class BatchPayoutQueue {
  /**
   * @param {object} p
   * @param {import('ethers').Contract} p.batchTransfer BatchTransfer, connected to the relayer signer
   * @param {string} p.token          ERC-20 being paid out
   * @param {number} [p.maxBatchSize] default 100
   * @param {number} [p.maxWaitMs]    default 60_000
   * @param {(info: object) => void} [p.onFlush]
   * @param {(err: Error, payouts: object[]) => void} [p.onError]
   */
  constructor({ batchTransfer, token, maxBatchSize = 100, maxWaitMs = 60_000, onFlush, onError }) {
    if (maxBatchSize < 1) throw new RangeError('maxBatchSize must be >= 1');
    this.batchTransfer = batchTransfer;
    this.token = token;
    this.maxBatchSize = maxBatchSize;
    this.maxWaitMs = maxWaitMs;
    this.onFlush = onFlush ?? (() => {});
    this.onError = onError ?? ((e) => { throw e; });
    this.pending = [];
    this.timer = null;
  }

  /** Queue one payout. Resolves when its batch has been mined. */
  enqueue(recipient, amount) {
    return new Promise((resolve, reject) => {
      this.pending.push({ recipient, amount, resolve, reject });
      if (this.pending.length >= this.maxBatchSize) {
        this.flush();
      } else if (!this.timer) {
        this.timer = setTimeout(() => this.flush(), this.maxWaitMs);
        // Do not hold the process open just to wait for a partial batch.
        this.timer.unref?.();
      }
    });
  }

  /** Send whatever is queued now. */
  async flush() {
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    if (!this.pending.length) return;

    // Take the batch before any await, so payouts arriving mid-send land in the
    // next batch instead of being silently dropped or double-sent.
    const batch = this.pending.splice(0, this.maxBatchSize);
    const recipients = batch.map((p) => p.recipient);
    const amounts = batch.map((p) => p.amount);

    try {
      const overrides = await getFeeOverrides(this.batchTransfer.runner.provider);

      // Uniform payouts save one calldata word per recipient.
      const uniform = amounts.every((a) => a === amounts[0]);
      const tx = uniform
        ? await this.batchTransfer.batchTransferSameAmount(this.token, recipients, amounts[0], overrides)
        : await this.batchTransfer.batchTransfer(this.token, recipients, amounts, overrides);

      const receipt = await tx.wait();
      this.onFlush({
        hash: receipt.hash,
        count: batch.length,
        uniform,
        gasUsed: receipt.gasUsed,
        gasPerPayout: receipt.gasUsed / BigInt(batch.length),
      });
      for (const p of batch) p.resolve(receipt);
    } catch (err) {
      // BatchTransfer is atomic: if the tx reverted, no payout in this batch
      // settled, so it is safe for the caller to retry the whole set.
      this.onError(err, batch.map(({ recipient, amount }) => ({ recipient, amount })));
      for (const p of batch) p.reject(err);
    } finally {
      // More arrived while we were sending.
      if (this.pending.length) {
        if (this.pending.length >= this.maxBatchSize) this.flush();
        else if (!this.timer) {
          this.timer = setTimeout(() => this.flush(), this.maxWaitMs);
          this.timer.unref?.();
        }
      }
    }
  }
}
