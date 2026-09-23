// Base EIP-1559 fee strategy for the relayer.
//
// Why this matters: Base's sequencer orders transactions first-come-first-served
// within a block, so large priority fees buy almost nothing. Wallet/library
// defaults (0.1 gwei, or ethers' 1.5 gwei fallback) massively overpay on every
// one of our 40k daily transfers.
//
// Dependency-free: talks raw JSON-RPC via fetch so it drops into any stack.
// With ethers/viem already present, use the exported `computeFees` directly.

const GWEI = 1_000_000_000n;

// Conservative defaults for Base mainnet.
const DEFAULTS = {
  tipFloorWei: GWEI / 1000n, // 0.001 gwei — enough for FCFS inclusion
  tipCapWei: GWEI / 10n, // 0.1 gwei — never tip more than this on Base
  baseFeeMultiplier: 2n, // headroom over current base fee for maxFeePerGas
  maxFeeCapWei: 2n * GWEI, // hard ceiling: refuse to send above 2 gwei total
};

function clamp(x, lo, hi) {
  return x < lo ? lo : x > hi ? hi : x;
}

/**
 * Compute EIP-1559 fees for a Base transaction.
 * @param {bigint} baseFeeWei   baseFeePerGas of the latest block
 * @param {bigint} suggestedTipWei  eth_maxPriorityFeePerGas result
 * @param {object} [opts]  override DEFAULTS
 */
function computeFees(baseFeeWei, suggestedTipWei, opts = {}) {
  const o = { ...DEFAULTS, ...opts };
  const tip = clamp(suggestedTipWei, o.tipFloorWei, o.tipCapWei);
  let maxFee = baseFeeWei * o.baseFeeMultiplier + tip;
  if (maxFee > o.maxFeeCapWei) maxFee = o.maxFeeCapWei;
  if (maxFee < tip) maxFee = tip;
  return { maxFeePerGas: maxFee, maxPriorityFeePerGas: tip };
}

/**
 * Fees for a replacement (speed-up / cancel) transaction. Base requires the
 * usual >=10% bump on both fields; we use 12.5% for margin, still clamped.
 */
function bumpFees(prev, opts = {}) {
  const o = { ...DEFAULTS, ...opts };
  const bump = (v) => (v * 9n) / 8n; // +12.5%
  const tip = clamp(bump(prev.maxPriorityFeePerGas), o.tipFloorWei, o.tipCapWei);
  let maxFee = bump(prev.maxFeePerGas);
  if (maxFee < tip) maxFee = tip;
  if (maxFee > o.maxFeeCapWei) maxFee = o.maxFeeCapWei;
  return { maxFeePerGas: maxFee, maxPriorityFeePerGas: tip };
}

// --- minimal JSON-RPC client (optional convenience, no dependency) ---

async function rpc(url, method, params = []) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const json = await res.json();
  if (json.error) throw new Error(`${method}: ${json.error.message}`);
  return json.result;
}

/** Fetch live Base fees and compute the EIP-1559 fields. */
async function getFees(rpcUrl, opts = {}) {
  const [block, tipHex] = await Promise.all([
    rpc(rpcUrl, "eth_getBlockByNumber", ["latest", false]),
    rpc(rpcUrl, "eth_maxPriorityFeePerGas").catch(() => "0x0"),
  ]);
  return computeFees(BigInt(block.baseFeePerGas), BigInt(tipHex), opts);
}

module.exports = { computeFees, bumpFees, getFees, DEFAULTS, GWEI };
