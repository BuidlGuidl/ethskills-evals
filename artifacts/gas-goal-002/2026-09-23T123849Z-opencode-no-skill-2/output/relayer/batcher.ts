import { packBatch, type Transfer } from "./packer";

export type BatcherConfig = {
  maxBatchSize: number;
  flushIntervalMs: number;
  maxEffectiveGasPriceGwei: number;
};

export const DEFAULT_BATCHER_CONFIG: BatcherConfig = {
  maxBatchSize: 250,
  flushIntervalMs: 30_000,
  maxEffectiveGasPriceGwei: 0.25,
};

export type PlannedBatch = {
  transfers: Transfer[];
  packed: `0x${string}`;
  strict: boolean;
  queuedAt: number;
  drainedAt: number;
};

export class BatchQueue {
  private readonly queue: Transfer[] = [];
  private readonly queuedAt: number[] = [];
  private oldestEnqueuedAt: number | null = null;
  private clock: () => number;

  constructor(
    private readonly config: BatcherConfig = DEFAULT_BATCHER_CONFIG,
    clock: () => number = () => Date.now(),
  ) {
    this.clock = clock;
  }

  add(transfer: Transfer): number {
    if (this.queue.length >= this.config.maxBatchSize) {
      throw new Error("queue full; flush first");
    }
    this.queue.push(transfer);
    this.queuedAt.push(this.clock());
    if (this.oldestEnqueuedAt === null) {
      this.oldestEnqueuedAt = this.clock();
    }
    return this.queue.length;
  }

  get size(): number {
    return this.queue.length;
  }

  get ageMs(): number {
    if (this.oldestEnqueuedAt === null) {
      return 0;
    }
    return this.clock() - this.oldestEnqueuedAt;
  }

  shouldFlush(): boolean {
    if (this.queue.length === 0) {
      return false;
    }
    if (this.queue.length >= this.config.maxBatchSize) {
      return true;
    }
    return this.ageMs >= this.config.flushIntervalMs;
  }

  drain(): PlannedBatch | null {
    if (this.queue.length === 0) {
      return null;
    }
    const drainedAt = this.clock();
    const transfers = this.queue.splice(0, this.queue.length);
    this.queuedAt.splice(0, this.queuedAt.length);
    const queuedAt = this.oldestEnqueuedAt ?? drainedAt;
    this.oldestEnqueuedAt = null;
    return {
      transfers,
      packed: packBatch(transfers),
      strict: false,
      queuedAt,
      drainedAt,
    };
  }
}

export type FeeGate = {
  isOpen(): Promise<boolean>;
};

export class GasPriceGate implements FeeGate {
  constructor(
    private readonly fetchGasPriceGwei: () => Promise<number>,
    private readonly maxGasPriceGwei: number,
  ) {}

  async isOpen(): Promise<boolean> {
    const gwei = await this.fetchGasPriceGwei();
    return gwei <= this.maxGasPriceGwei;
  }
}
