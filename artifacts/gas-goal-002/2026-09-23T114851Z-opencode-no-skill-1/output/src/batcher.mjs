export const DEFAULT_FLUSH_POLICY = {
  maxItems: 200,
  maxAgeMs: 5 * 60 * 1000,
  maxBatchValueAtRisk: null,
};

export function createBatcher(options = {}) {
  const policy = { ...DEFAULT_FLUSH_POLICY, ...options.policy };
  const now = options.now ?? (() => Date.now());
  let pending = new Map();
  let firstEnqueuedAt = null;
  let droppedSinceLastFlush = 0;

  function key(item) {
    return item.token.toLowerCase() + ":" + item.recipient.toLowerCase();
  }

  function add(item) {
    if (!item || typeof item.token !== "string" || typeof item.recipient !== "string") {
      throw new TypeError("item needs token and recipient");
    }
    if (typeof item.amount !== "bigint" && typeof item.amount !== "number") {
      throw new TypeError("item.amount must be bigint or number");
    }
    if (item.amount <= 0) throw new RangeError("amount must be positive");
    const k = key(item);
    if (firstEnqueuedAt === null) firstEnqueuedAt = now();
    const existing = pending.get(k);
    if (existing) {
      existing.amount = BigInt(existing.amount) + BigInt(item.amount);
      existing.sources.push(item.source);
    } else {
      pending.set(k, {
        token: item.token,
        recipient: item.recipient,
        amount: BigInt(item.amount),
        sources: item.source ? [item.source] : [],
      });
    }
  }

  function size() {
    return pending.size;
  }

  function nettedFrom() {
    return droppedSinceLastFlush;
  }

  function shouldFlush(t = now()) {
    if (pending.size === 0) return false;
    if (pending.size >= policy.maxItems) return true;
    if (firstEnqueuedAt !== null && t - firstEnqueuedAt >= policy.maxAgeMs) return true;
    return false;
  }

  function peek() {
    return [...pending.values()];
  }

  function drain() {
    const items = [...pending.values()];
    droppedSinceLastFlush = items.length;
    pending = new Map();
    firstEnqueuedAt = null;
    return items;
  }

  return { add, size, shouldFlush, drain, peek, nettedFrom, policy };
}

export function planTopUps(batches, token, currentBalance, safetyMultiple = 2) {
  const byToken = new Map();
  for (const b of batches) {
    const t = b.token.toLowerCase();
    byToken.set(t, (byToken.get(t) ?? 0n) + BigInt(b.total));
  }
  const need = byToken.get(token.toLowerCase()) ?? 0n;
  const target = need * BigInt(Math.max(1, safetyMultiple));
  return currentBalance >= target ? 0n : target - currentBalance;
}
