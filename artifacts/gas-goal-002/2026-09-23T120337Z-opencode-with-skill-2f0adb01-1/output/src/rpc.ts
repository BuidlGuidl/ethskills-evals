export type Hex = `0x${string}`;

export interface Block {
  number: string;
  baseFeePerGas?: string;
  gasLimit: string;
  timestamp: string;
}

export interface Receipt {
  transactionHash: Hex;
  from: Hex;
  to: Hex | null;
  status: string;
  gasUsed: string;
  effectiveGasPrice: string;
  l1Fee?: string;
  l1GasUsed?: string;
  l1GasPrice?: string;
  l1BlobBaseFee?: string;
  blockNumber: string;
}

export interface Transaction {
  hash: Hex;
  from: Hex;
  to: Hex | null;
  input: string;
  gas: string;
  gasPrice?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  blockNumber: string;
}

export class RpcClient {
  private urls: string[];
  private next = 0;
  private maxRetries: number;
  private backoffMs: number;

  constructor(urls: string | string[], maxRetries = 3, backoffMs = 500) {
    this.urls = Array.isArray(urls) ? urls : [urls];
    this.maxRetries = maxRetries;
    this.backoffMs = backoffMs;
  }

  private async raw<T>(method: string, params: unknown[]): Promise<T> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      const url = this.urls[this.next % this.urls.length];
      this.next++;
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jsonrpc: "2.0", id: attempt, method, params }),
          signal: AbortSignal.timeout(20_000),
        });
        const json = await res.json();
        if (json.error) {
          throw new Error(`${method}: ${JSON.stringify(json.error)}`);
        }
        return json.result as T;
      } catch (err) {
        lastError = err;
        await new Promise((r) => setTimeout(r, this.backoffMs * 2 ** attempt));
      }
    }
    throw lastError;
  }

  async blockNumber(): Promise<bigint> {
    return BigInt(await this.raw<string>("eth_blockNumber", []));
  }

  async getBlock(tag: "latest" | bigint = "latest"): Promise<Block> {
    return this.raw<Block>("eth_getBlockByNumber", [tag === "latest" ? tag : `0x${tag.toString(16)}`, false]);
  }

  async getBaseFee(): Promise<bigint> {
    const block = await this.getBlock("latest");
    return BigInt(block.baseFeePerGas ?? "0x0");
  }

  async getReceipt(hash: Hex): Promise<Receipt | null> {
    return this.raw<Receipt | null>("eth_getTransactionReceipt", [hash]);
  }

  async getTransaction(hash: Hex): Promise<Transaction | null> {
    return this.raw<Transaction | null>("eth_getTransactionByHash", [hash]);
  }

  async getGasPrice(): Promise<bigint> {
    return BigInt(await this.raw<string>("eth_gasPrice", []));
  }

  async estimateGas(tx: { from: Hex; to: Hex; data: Hex }): Promise<bigint> {
    return BigInt(await this.raw<string>("eth_estimateGas", [tx]));
  }

  async ethCall(tx: { from?: Hex; to: Hex; data: Hex }): Promise<Hex> {
    return this.raw<Hex>("eth_call", [tx, "latest"]);
  }

  async sendRawTransaction(signed: Hex): Promise<Hex> {
    return this.raw<Hex>("eth_sendRawTransaction", [signed]);
  }

  async chainId(): Promise<number> {
    return Number(await this.raw<string>("eth_chainId", []));
  }
}
