/**
 * Minimal JSON-RPC client. Zero dependencies (Node >= 20 fetch).
 * Used to derive fee fields from the target chain immediately before
 * submission — never from hardcoded constants.
 */
export class Rpc {
  private id = 0;
  private url: string;
  constructor(url: string) {
    this.url = url;
  }

  async call<T = unknown>(method: string, params: unknown[] = []): Promise<T> {
    const res = await fetch(this.url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: ++this.id, method, params }),
    });
    const json = (await res.json()) as {
      result?: T;
      error?: { message: string };
    };
    if (json.error) throw new Error(`${method}: ${json.error.message}`);
    return json.result as T;
  }

  /** Base fee of the latest block, in wei. */
  async baseFeeWei(): Promise<bigint> {
    const block = await this.call<{ baseFeePerGas: string }>("eth_getBlockByNumber", [
      "latest",
      false,
    ]);
    return BigInt(block.baseFeePerGas);
  }

  /** Sequencer-suggested priority fee, in wei. */
  async suggestedTipWei(): Promise<bigint> {
    return BigInt(await this.call<string>("eth_maxPriorityFeePerGas"));
  }

  async chainId(): Promise<bigint> {
    return BigInt(await this.call<string>("eth_chainId"));
  }
}
