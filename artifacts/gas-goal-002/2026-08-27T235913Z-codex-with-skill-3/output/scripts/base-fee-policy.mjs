#!/usr/bin/env node

// Gets current Base fee data at submission time. It intentionally does not use
// a copied mainnet priority fee or a static gwei constant.
const rpcUrl = process.env.BASE_RPC_URL ?? "https://mainnet.base.org";
const urgency = process.env.FEE_URGENCY ?? "standard";
const percentile = { economical: 25, standard: 50, urgent: 90 }[urgency];
if (percentile === undefined) throw new Error("FEE_URGENCY must be economical, standard, or urgent");

async function rpc(method, params) {
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const payload = await response.json();
  if (!response.ok || payload.error) throw new Error(payload.error?.message ?? response.statusText);
  return payload.result;
}

const [latest, history, suggestedGasPrice] = await Promise.all([
  rpc("eth_getBlockByNumber", ["latest", false]),
  rpc("eth_feeHistory", ["0x5", "latest", [percentile]]),
  rpc("eth_gasPrice", []),
]);
const toBigInt = (hex) => BigInt(hex);
const baseFee = toBigInt(latest.baseFeePerGas);
const rewards = history.reward.map((row) => toBigInt(row[0]));
const priorityFee = rewards.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))[Math.floor(rewards.length / 2)];
// Two blocks of base-fee headroom avoids a replacement storm while retaining a
// current-chain derived cap. Base may enforce a network minimum gas price, so
// never set a cap below its current suggestion.
const maxFeePerGas = [baseFee * 2n + priorityFee, toBigInt(suggestedGasPrice)].reduce((a, b) => a > b ? a : b);

const asGwei = (value) => Number(value) / 1e9;
console.log(JSON.stringify({
  chainId: 8453,
  sampledAt: new Date().toISOString(),
  urgency,
  baseFeePerGasWei: baseFee.toString(),
  maxPriorityFeePerGasWei: priorityFee.toString(),
  maxFeePerGasWei: maxFeePerGas.toString(),
  suggestedGasPriceWei: suggestedGasPrice,
  displayGwei: {
    baseFee: asGwei(baseFee),
    maxPriorityFee: asGwei(priorityFee),
    maxFee: asGwei(maxFeePerGas),
  },
}, null, 2));
