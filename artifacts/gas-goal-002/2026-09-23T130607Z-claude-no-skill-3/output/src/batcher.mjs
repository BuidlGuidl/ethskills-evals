/**
 * Batching relayer for ERC-20 payouts on Base.
 *
 * Replaces one transaction per payout with one transaction per batch. The 21,000
 * gas intrinsic cost and the per-transaction L1 data-availability cost are paid
 * once per batch instead of once per payout, which is where essentially all of
 * the saving comes from (see PLAN.md for measured figures).
 *
 * The client is deliberately transport-agnostic: pass in anything that can read
 * chain state and send a transaction. `adapters/viem.mjs` wires it to viem.
 */
import { encodePayouts, decodePayouts, MAX_AMOUNT } from './encode.mjs';
import { FeeStrategy } from './feeStrategy.mjs';

/** Selector of `TransferFailed(uint256)`, thrown by BatchTransfer. */
const TRANSFER_FAILED_SIG = '0xc39ba1a9';

export const BATCH_DEFAULTS = {
  /** Payouts per transaction. See scripts/sweep.mjs for why this number. */
  maxBatchSize: 200,
  /** Send a partial batch rather than wait longer than this. */
  maxWaitMs: 15_000,
  /** Gas limit headroom over the estimate. */
  gasLimitMultiplier: 130n,
  /** Retries after a failed send before giving up on a batch. */
  maxAttempts: 5,
  /** Drop individually-failing payouts and send the rest, rather than failing the batch. */
  dropFailingPayouts: true,
};

export class BatchRelayer {
  /**
   * @param {object} opts
   * @param {object} opts.client         chain client (see adapters/viem.mjs)
   * @param {`0x${string}`} opts.batchTransfer  deployed BatchTransfer address
   * @param {`0x${string}`} opts.token   ERC-20 to pay out
   * @param {'float'|'pull'} [opts.mode] custody model
   * @param {`0x${string}`} [opts.fundingAccount] required when mode==='pull'
   */
  constructor(opts) {
    const { client, batchTransfer, token, mode = 'pull', fundingAccount } = opts;
    if (mode === 'pull' && !fundingAccount) {
      throw new Error("mode 'pull' requires fundingAccount");
    }
    this.client = client;
    this.batchTransfer = batchTransfer;
    this.token = token;
    this.mode = mode;
    this.fundingAccount = fundingAccount;
    this.cfg = { ...BATCH_DEFAULTS, ...opts };
    this.fees = opts.feeStrategy ?? new FeeStrategy();
    this.onEvent = opts.onEvent ?? (() => {});

    /** @type {{payout: import('./encode.mjs').Payout, resolve: Function, reject: Function}[]} */
    this.queue = [];
    this.timer = null;
    this.draining = false;
  }

  /**
   * Enqueue one payout. Resolves with the batch receipt once it lands.
   * @param {`0x${string}`} to
   * @param {bigint} amount
   */
  enqueue(to, amount) {
    if (amount > MAX_AMOUNT) throw new Error(`amount ${amount} exceeds uint96`);
    return new Promise((resolve, reject) => {
      this.queue.push({ payout: { to, amount }, resolve, reject });
      if (this.queue.length >= this.cfg.maxBatchSize) {
        this._drainSoon(0);
      } else if (!this.timer) {
        this.timer = setTimeout(() => this._drainSoon(0), this.cfg.maxWaitMs);
      }
    });
  }

  _drainSoon(delay) {
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    setTimeout(() => { this.drain().catch((e) => this.onEvent({ type: 'drain_error', error: e })); }, delay);
  }

  /** Send everything currently queued, in batches. */
  async drain() {
    if (this.draining) return;
    this.draining = true;
    try {
      while (this.queue.length > 0) {
        const items = this.queue.splice(0, this.cfg.maxBatchSize);
        await this._sendBatch(items);
      }
    } finally {
      this.draining = false;
      if (this.queue.length > 0 && !this.timer) {
        this.timer = setTimeout(() => this._drainSoon(0), this.cfg.maxWaitMs);
      }
    }
  }

  _encodeCall(payouts) {
    const blob = encodePayouts(payouts);
    return this.mode === 'float'
      ? { fn: 'payout', args: [this.token, blob] }
      : { fn: 'payoutFrom', args: [this.token, this.fundingAccount, blob] };
  }

  /**
   * Simulate the batch and, if a single payout is what reverts it, drop that
   * payout and retry. Without this one blacklisted or frozen recipient would
   * block every other payout sharing its batch -- a real hazard with USDC.
   */
  async _preflight(items) {
    const dropped = [];
    let current = items;
    for (let round = 0; round < 8 && current.length > 0; round++) {
      const { fn, args } = this._encodeCall(current.map((i) => i.payout));
      const err = await this.client.simulate({ to: this.batchTransfer, fn, args });
      if (!err) return { ok: current, dropped };
      const idx = decodeTransferFailedIndex(err.data);
      if (idx === null || idx >= current.length) {
        throw Object.assign(new Error(`batch preflight failed: ${err.message ?? err.data}`), { cause: err });
      }
      const [bad] = current.splice(idx, 1);
      dropped.push({ item: bad, reason: err.data });
      this.onEvent({ type: 'payout_dropped', to: bad.payout.to, reason: err.data });
    }
    return { ok: current, dropped };
  }

  /** Did any previously broadcast attempt actually land? */
  async _findLanded(hashes) {
    if (!this.client.receiptOf) return null;
    for (const h of hashes) {
      const r = await this.client.receiptOf(h).catch(() => null);
      if (r && r.status === 'success') return r;
    }
    return null;
  }

  async _sendBatch(items) {
    let ok = items;
    let dropped = [];
    try {
      if (this.cfg.dropFailingPayouts) {
        ({ ok, dropped } = await this._preflight(items));
      }
    } catch (e) {
      for (const it of items) it.reject(e);
      return;
    }
    for (const d of dropped) {
      d.item.reject(Object.assign(new Error('payout reverted in preflight'), { reason: d.reason }));
    }
    if (ok.length === 0) return;

    const { fn, args } = this._encodeCall(ok.map((i) => i.payout));
    let previousFees = null;
    let lastErr = null;

    // Pin the nonce for the whole batch. Without this, a send that times out
    // while still in the mempool would be retried under a *fresh* nonce and
    // both could land -- paying everyone twice. Reusing the nonce makes every
    // retry a replacement, so exactly one of them can ever be mined.
    let nonce;
    try {
      nonce = await this.client.pendingNonce();
    } catch (e) {
      for (const it of ok) it.reject(e);
      return;
    }
    const sentHashes = [];

    for (let attempt = 0; attempt < this.cfg.maxAttempts; attempt++) {
      try {
        // If an earlier attempt landed after we stopped waiting, use it.
        const landed = await this._findLanded(sentHashes);
        if (landed) {
          this.onEvent({ type: 'batch_sent', size: ok.length, attempt, gasUsed: landed.gasUsed, receipt: landed });
          for (const it of ok) it.resolve(landed);
          return;
        }
        const baseFee = await this.client.baseFeePerGas();
        const fees = previousFees
          ? this.fees.replacementFees(baseFee, attempt, previousFees)
          : this.fees.fees(baseFee, attempt);
        previousFees = fees;

        const gas = await this.client.estimateGas({ to: this.batchTransfer, fn, args });
        const receipt = await this.client.sendAndWait({
          to: this.batchTransfer, fn, args,
          gas: (gas * this.cfg.gasLimitMultiplier) / 100n,
          ...fees, nonce,
          waitBlocks: this.fees.cfg.blocksPerRung,
        });
        if (receipt.hash) sentHashes.push(receipt.hash);
        if (receipt.status !== 'success') throw new Error(`batch reverted: ${receipt.transactionHash}`);

        this.onEvent({ type: 'batch_sent', size: ok.length, attempt, gasUsed: receipt.gasUsed, receipt });
        for (const it of ok) it.resolve(receipt);
        return;
      } catch (e) {
        lastErr = e;
        if (e?.hash) sentHashes.push(e.hash);
        this.onEvent({ type: 'batch_retry', attempt, error: e });
      }
    }
    // Last look before giving up: a late inclusion still counts as success.
    const landed = await this._findLanded(sentHashes);
    if (landed) {
      for (const it of ok) it.resolve(landed);
      return;
    }
    for (const it of ok) it.reject(lastErr);
  }
}

/** Pull the payout index out of a `TransferFailed(uint256)` revert. */
export function decodeTransferFailedIndex(data) {
  if (typeof data !== 'string' || !data.startsWith(TRANSFER_FAILED_SIG) || data.length < 10 + 64) return null;
  return Number(BigInt('0x' + data.slice(10, 10 + 64)));
}
