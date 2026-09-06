/**
 * Per-plan rate limiting. The contract sells *access*, not request volume — metering calls
 * onchain would mean a transaction per API call, which costs more than the weather is worth. So
 * volume limits live here, keyed off the plan id the contract reports.
 *
 * Fixed-window counter, in memory. Fine for one process; if you run several, move this to Redis
 * or accept that each replica enforces the limit separately.
 */
export class QuotaMeter {
  constructor(perMinuteByPlan, windowMs = 60_000) {
    this.limits = perMinuteByPlan;
    this.windowMs = windowMs;
    this.buckets = new Map(); // address -> {windowStart, count}
  }

  check(address, planId, now = Date.now()) {
    const limit = this.limits[planId];
    if (!limit) return {allowed: true, limit: null, remaining: null, resetsAt: null};

    const windowStart = Math.floor(now / this.windowMs) * this.windowMs;
    let bucket = this.buckets.get(address);
    if (!bucket || bucket.windowStart !== windowStart) {
      bucket = {windowStart, count: 0};
      this.buckets.set(address, bucket);
    }
    bucket.count++;

    return {
      allowed: bucket.count <= limit,
      limit,
      remaining: Math.max(0, limit - bucket.count),
      resetsAt: windowStart + this.windowMs,
    };
  }

  prune(now = Date.now()) {
    const cutoff = Math.floor(now / this.windowMs) * this.windowMs;
    for (const [key, bucket] of this.buckets) if (bucket.windowStart < cutoff) this.buckets.delete(key);
  }
}
