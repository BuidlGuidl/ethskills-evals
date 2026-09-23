import { PayoutQueue, type Payout, type PayoutBatch, type QueueOptions } from "./batch-queue.ts";
import { encodeBatchTransfer, encodeErc20Transfer, type Hex } from "./encoder.ts";
import { quoteFees, defaultFeePolicy, type FeePolicy, type FeeQuote } from "./fees.ts";
import { estimateBatchGasLimit, estimateIndividualTxGas } from "./gas-model.ts";

export interface TxRequest {
  to: string;
  data: Hex;
  gasLimit: bigint;
  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
}

export interface RelayerSigner {
  address(): string;
  sendTransaction(request: TxRequest): Promise<string>;
}

export interface BaseFeeSource {
  baseFeeWei(): Promise<bigint>;
}

export interface FlusherHooks {
  onBatchSent?: (batch: PayoutBatch, txHash: string, quote: FeeQuote) => void;
  onBatchDeferred?: (batch: PayoutBatch, quote: FeeQuote) => void;
  onFlushError?: (batch: PayoutBatch, error: unknown) => void;
}

export interface FlusherOptions extends Partial<QueueOptions> {
  feePolicy?: FeePolicy;
  freshRatio?: number;
  hooks?: FlusherHooks;
  validatePayout?: (payout: Payout) => Promise<void>;
}

export interface FlushResult {
  sent: { batch: PayoutBatch; txHash: string }[];
  deferred: number;
}

export class BatchingFlusher {
  private readonly queue: PayoutQueue;
  private readonly signer: RelayerSigner;
  private readonly feeSource: BaseFeeSource;
  private readonly dispatcher: string;
  private readonly options: FlusherOptions;
  private timer: ReturnType<typeof setInterval> | undefined;

  constructor(
    signer: RelayerSigner,
    feeSource: BaseFeeSource,
    dispatcherAddress: string,
    options: FlusherOptions = {},
  ) {
    this.signer = signer;
    this.feeSource = feeSource;
    this.dispatcher = dispatcherAddress;
    this.options = options;
    this.queue = new PayoutQueue(options);
  }

  async enqueue(payout: Payout, nowMs = Date.now()): Promise<void> {
    if (this.options.validatePayout) {
      await this.options.validatePayout(payout);
    }
    this.queue.add(payout, nowMs);
  }

  pendingCount(): number {
    return this.queue.pendingCount();
  }

  async flushOnce(nowMs = Date.now()): Promise<FlushResult> {
    const result: FlushResult = { sent: [], deferred: 0 };
    const batches = this.queue.due(nowMs);
    if (batches.length === 0) return result;

    let baseFee: bigint;
    try {
      baseFee = await this.feeSource.baseFeeWei();
    } catch (error) {
      for (const batch of batches) {
        this.queue.add(...placeholderPayouts(batch));
        this.options.hooks?.onFlushError?.(batch, error);
      }
      return result;
    }

    const policy = this.options.feePolicy ?? defaultFeePolicy();
    const quote = quoteFees(baseFee, policy);
    if (quote.defer) {
      for (const batch of batches) {
        this.queue.add(...placeholderPayouts(batch));
        this.options.hooks?.onBatchDeferred?.(batch, quote);
      }
      return { sent: [], deferred: batches.length };
    }

    for (const batch of batches) {
      try {
        const single = batch.recipients.length === 1;
        const request: TxRequest = {
          to: single ? batch.token : this.dispatcher,
          data: single
            ? encodeErc20Transfer(batch.recipients[0], batch.amounts[0])
            : encodeBatchTransfer(batch.token, batch.recipients, batch.amounts),
          gasLimit: single
            ? (estimateIndividualTxGas(this.options.freshRatio ?? 0) * 12_000n) / 10_000n
            : estimateBatchGasLimit(batch.recipients.length, this.options.freshRatio ?? 0),
          maxFeePerGas: quote.maxFeePerGas,
          maxPriorityFeePerGas: quote.maxPriorityFeePerGas,
        };
        const txHash = await this.signer.sendTransaction(request);
        result.sent.push({ batch, txHash });
        this.options.hooks?.onBatchSent?.(batch, txHash, quote);
      } catch (error) {
        this.queue.add(...placeholderPayouts(batch));
        this.options.hooks?.onFlushError?.(batch, error);
      }
    }
    return result;
  }

  start(intervalMs = 1_000): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      void this.flushOnce().catch(() => {});
    }, intervalMs);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }
}

function placeholderPayouts(batch: PayoutBatch): Payout[] {
  return batch.recipients.map((recipient, i) => ({
    token: batch.token,
    recipient,
    amount: batch.amounts[i],
    ref: batch.refs[i],
  }));
}
