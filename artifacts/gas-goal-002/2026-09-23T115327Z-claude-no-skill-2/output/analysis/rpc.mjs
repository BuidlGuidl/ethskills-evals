/** Tiny retrying JSON-RPC helper. Public Base endpoints rate-limit aggressively. */
export const RPC_URL = process.env.BASE_RPC_URL || "https://mainnet.base.org";

export async function rpc(method, params = [], url = RPC_URL) {
  let lastErr;
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      });
      const json = await res.json();
      if (json.error) throw new Error(`${method}: ${JSON.stringify(json.error)}`);
      return json.result;
    } catch (err) {
      lastErr = err;
      await new Promise((r) => setTimeout(r, 300 * 2 ** attempt));
    }
  }
  throw lastErr;
}

export const quantile = (sorted, q) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))];
export const hexToNum = (h) => parseInt(h, 16);
