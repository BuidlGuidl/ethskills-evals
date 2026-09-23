// Derives EIP-1559 fee fields from the chain at send time.
//
// Never hardcode gas prices for Base: the base fee moves and a stale constant
// either overpays (common: mainnet-style 1-2 gwei tips are ~200x too high) or
// gets transactions stuck. Typical Base reading today: base fee ~0.005 gwei,
// suggested tip ~0.001 gwei.
//
// Zero dependencies — plain JSON-RPC over fetch (Node >= 18).

async function rpc(rpcUrl, method, params = []) {
  const res = await fetch(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const json = await res.json();
  if (json.error) throw new Error(`${method}: ${json.error.message}`);
  return json.result;
}

/**
 * Returns { maxFeePerGas, maxPriorityFeePerGas } in wei (bigint).
 *
 * eth_gasPrice on Base returns baseFee + suggested tip, so:
 *   tip            = gasPrice - baseFee   (never add a tip on top of gasPrice)
 *   maxFeePerGas   = 2 * baseFee + tip    (headroom for base-fee drift)
 */
export async function getFees(rpcUrl) {
  const [gasPriceHex, block] = await Promise.all([
    rpc(rpcUrl, "eth_gasPrice"),
    rpc(rpcUrl, "eth_getBlockByNumber", ["latest", false]),
  ]);
  const gasPrice = BigInt(gasPriceHex);
  const baseFee = BigInt(block.baseFeePerGas);
  const tip = gasPrice > baseFee ? gasPrice - baseFee : 0n;
  return {
    maxFeePerGas: 2n * baseFee + tip,
    maxPriorityFeePerGas: tip,
  };
}

/** Convenience: fees formatted for `cast send` flags. */
export async function getCastFeeArgs(rpcUrl) {
  const { maxFeePerGas, maxPriorityFeePerGas } = await getFees(rpcUrl);
  return [
    "--gas-price", maxFeePerGas.toString(),
    "--priority-gas-price", maxPriorityFeePerGas.toString(),
  ];
}

// CLI: `node fees.js [rpcUrl]` prints the current fields.
if (import.meta.url === `file://${process.argv[1]}`) {
  const rpcUrl = process.argv[2] ?? process.env.BASE_RPC ?? "https://mainnet.base.org";
  const fees = await getFees(rpcUrl);
  const gwei = (wei) => `${Number(wei) / 1e9} gwei`;
  console.log(`maxFeePerGas:             ${fees.maxFeePerGas} wei (${gwei(fees.maxFeePerGas)})`);
  console.log(`maxPriorityFeePerGas:     ${fees.maxPriorityFeePerGas} wei (${gwei(fees.maxPriorityFeePerGas)})`);
}
