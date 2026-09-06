import {base, baseSepolia, foundry} from "viem/chains";

const CHAINS = {8453: base, 84532: baseSepolia, 31337: foundry};

function required(name) {
  const v = process.env[name];
  if (!v) throw new Error(`missing required env var ${name}`);
  return v;
}

const num = (name, fallback) => Number(process.env[name] ?? fallback);

// Required values are getters, not eagerly-read constants, so importing this module never throws
// and the config can be exercised in tests without a full environment.
export const config = {
  get chainId() {
    return num("CHAIN_ID", 8453);
  },
  get chain() {
    const c = CHAINS[this.chainId];
    if (!c) throw new Error(`unsupported CHAIN_ID ${this.chainId}`);
    return c;
  },
  get rpcUrl() {
    return required("RPC_URL");
  },
  // A second, independent RPC provider. Not redundancy theatre: the gate reads subscription state
  // from an RPC endpoint, so whoever runs that endpoint is in a position to tell you a paying
  // customer is unsubscribed, by serving stale or wrong data. Two unrelated providers turns that
  // from a silent outage into a logged discrepancy.
  get fallbackRpcUrl() {
    return process.env.FALLBACK_RPC_URL || null;
  },
  get billingAddress() {
    return required("BILLING_ADDRESS");
  },
  get startBlock() {
    return BigInt(process.env.BILLING_START_BLOCK ?? 0);
  },

  // Signs session tokens. Rotating it logs everybody out. It protects nothing onchain — losing it
  // does not put a single customer's USDC at risk, only your own API's access control.
  get sessionSecret() {
    return required("SESSION_SECRET");
  },
  get sessionTtlSeconds() {
    return num("SESSION_TTL_SECONDS", 3600);
  },
  get nonceTtlSeconds() {
    return num("NONCE_TTL_SECONDS", 300);
  },

  // How long a cached "yes, subscribed" is trusted while the event watcher is healthy. Events
  // normally invalidate sooner; this is the backstop.
  get cacheTtlMs() {
    return num("CACHE_TTL_MS", 60_000);
  },
  // The backstop's backstop, used when the watcher is not confirming it is alive.
  get degradedCacheTtlMs() {
    return num("DEGRADED_CACHE_TTL_MS", 5_000);
  },
  // If the watcher has not reported in this long, stop trusting long cache entries.
  get watcherStaleMs() {
    return num("WATCHER_STALE_MS", 120_000);
  },

  get port() {
    return num("PORT", 8080);
  },

  // Requests per minute by plan id. Plan 0 is "no plan" and never reaches the meter.
  get quotaPerMinute() {
    return {1: num("QUOTA_HOBBY", 60), 2: num("QUOTA_PRO", 600)};
  },
};
