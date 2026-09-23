export interface Payout {
  token: string;
  recipient: string;
  amount: bigint;
  ref?: string;
}

export interface PayoutBatch {
  token: string;
  recipients: string[];
  amounts: bigint[];
  refs: (string | undefined)[];
}

export interface QueueOptions {
  maxEntries: number;
  maxWaitMs: number;
  netDuplicates: boolean;
}

export function defaultQueueOptions(): QueueOptions {
  return { maxEntries: 100, maxWaitMs: 30_000, netDuplicates: false };
}

interface GroupedEntry {
  amount: bigint;
  refs: (string | undefined)[];
  displayRecipient: string;
}

interface TokenBucket {
  firstAddMs: number;
  entries: Map<string, GroupedEntry>;
  order: string[];
  seq: number;
}

export class PayoutQueue {
  private readonly options: QueueOptions;
  private readonly buckets = new Map<string, TokenBucket>();

  constructor(options: Partial<QueueOptions> = {}) {
    this.options = { ...defaultQueueOptions(), ...options };
    if (this.options.maxEntries < 2) {
      throw new Error("maxEntries must be >= 2");
    }
  }

  add(payout: Payout, nowMs = Date.now()): void {
    if (payout.amount <= 0n) {
      throw new Error("payout amount must be positive");
    }
    const tokenKey = payout.token.toLowerCase();
    let bucket = this.buckets.get(tokenKey);
    if (!bucket) {
      bucket = { firstAddMs: nowMs, entries: new Map(), order: [], seq: 0 };
      this.buckets.set(tokenKey, bucket);
    }
    if (bucket.entries.size === 0) {
      bucket.firstAddMs = nowMs;
    }
    const recipientKey = payout.recipient.toLowerCase();
    const key = this.options.netDuplicates ? recipientKey : `${recipientKey}#${bucket.seq++}`;
    const existing = bucket.entries.get(key);
    if (existing && this.options.netDuplicates) {
      existing.amount += payout.amount;
      existing.refs.push(payout.ref);
    } else {
      bucket.entries.set(key, {
        amount: payout.amount,
        refs: [payout.ref],
        displayRecipient: payout.recipient,
      });
      bucket.order.push(key);
    }
  }

  pendingCount(): number {
    let total = 0;
    for (const bucket of this.buckets.values()) {
      total += bucket.entries.size;
    }
    return total;
  }

  tokenCount(): number {
    return this.buckets.size;
  }

  due(nowMs = Date.now()): PayoutBatch[] {
    const batches: PayoutBatch[] = [];
    for (const [tokenKey, bucket] of this.buckets) {
      const entryCount = bucket.entries.size;
      if (entryCount === 0) continue;
      const full = entryCount >= this.options.maxEntries;
      const expired = nowMs - bucket.firstAddMs >= this.options.maxWaitMs;
      if (!full && !expired) continue;

      const takeCount = Math.min(entryCount, this.options.maxEntries);
      const recipients: string[] = [];
      const amounts: bigint[] = [];
      const refs: (string | undefined)[] = [];
      const remainingOrder: string[] = [];
      let emitted = 0;
      for (const key of bucket.order) {
        const entry = bucket.entries.get(key);
        if (!entry) continue;
        if (emitted < takeCount) {
          recipients.push(entry.displayRecipient);
          amounts.push(entry.amount);
          refs.push(entry.refs.length === 1 ? entry.refs[0] : undefined);
          bucket.entries.delete(key);
          emitted += 1;
        } else {
          remainingOrder.push(key);
        }
      }
      bucket.order = remainingOrder;
      if (recipients.length > 0) {
        batches.push({ token: tokenKey, recipients, amounts, refs });
      }
      bucket.firstAddMs = nowMs;
      if (bucket.entries.size === 0) {
        this.buckets.delete(tokenKey);
      }
    }
    return batches;
  }

  clear(): void {
    this.buckets.clear();
  }
}
