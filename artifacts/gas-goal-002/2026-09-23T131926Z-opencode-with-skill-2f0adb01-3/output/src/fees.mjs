// Fee configuration for the Base relayer. Zero dependencies.
//
// Why this exists: ethers.js defaults maxPriorityFeePerGas to 1.5 gwei. On
// Base the base fee is ~0.005 gwei and ~0.001 gwei of priority gets you
// included in the next block. Paying library defaults would cost ~300x more
// than necessary on the priority component.
//
// Usage:
//   import { getFeeOverrides } from "./fees.mjs";
//   const fees = await getFeeOverrides();           // { maxFeePerGas, maxPriorityFeePerGas }
//   await wallet.sendTransaction({ ...tx, ...fees });

const RPCS = process.env.BASE_RPC_URL
  ? [process.env.BASE_RPC_URL]
  : ["https://mainnet.base.org", "https://base.llamarpc.com", "https://base-rpc.publicnode.com"];

// Caps (wei). Base blocks are 2s and rarely full; these are generous.
const PRIORITY_FEE_CAP = 2_000_000n; // 0.002 gwei — well above the ~0.001 gwei needed
const MAX_FEE_MULTIPLIER = 4n; // headroom over base fee for short spikes
const MAX_FEE_FLOOR = 20_000_000n; // 0.02 gwei minimum maxFee
const SPIKE_THRESHOLD_GWEI = 0.5; // warn+backoff above this effective gas price

async function rpc(method, params = []) {
  let lastErr;
  for (const url of RPCS) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error.message);
      return json.result;
    } catch (err) {
      lastErr = err;
    }
  }
  throw new Error(`${method}: ${lastErr.message} (all RPCs failed)`);
}

export async function getFeeOverrides() {
  const block = await rpc("eth_getBlockByNumber", ["latest", false]);
  const baseFee = BigInt(block.baseFeePerGas);

  let priority = BigInt(await rpc("eth_maxPriorityFeePerGas"));
  if (priority > PRIORITY_FEE_CAP) priority = PRIORITY_FEE_CAP;
  if (priority < 500_000n) priority = 500_000n; // 0.0005 gwei floor

  let maxFee = baseFee * MAX_FEE_MULTIPLIER + priority;
  if (maxFee < MAX_FEE_FLOOR) maxFee = MAX_FEE_FLOOR;

  return { maxFeePerGas: maxFee, maxPriorityFeePerGas: priority };
}

// Returns true when gas is spiking; caller should delay non-urgent batches.
export async function isGasSpike() {
  const gasPrice = BigInt(await rpc("eth_gasPrice"));
  return Number(gasPrice) / 1e9 > SPIKE_THRESHOLD_GWEI;
}

// CLI: node src/fees.mjs
if (import.meta.url === `file://${process.argv[1]}`) {
  const fees = await getFeeOverrides();
  console.log(`maxFeePerGas:         ${Number(fees.maxFeePerGas) / 1e9} gwei`);
  console.log(`maxPriorityFeePerGas: ${Number(fees.maxPriorityFeePerGas) / 1e9} gwei`);
  console.log(`gas spike:            ${await isGasSpike()}`);
}
