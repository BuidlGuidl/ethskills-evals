import {
  type Account,
  type Address,
  type Chain,
  type Hash,
  type PublicClient,
  type Transport,
  type WalletClient,
  erc20Abi,
} from "viem";
import { quoteFees, defaultFeePolicy, type FeePolicy, type FeeQuote } from "./fees.js";

export const batchRelayerAbi = [
  {
    type: "function",
    name: "batchTransfer",
    stateMutability: "nonpayable",
    inputs: [
      { name: "token", type: "address" },
      { name: "recipients", type: "address[]" },
      { name: "amounts", type: "uint256[]" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "batchTransferMulti",
    stateMutability: "nonpayable",
    inputs: [
      { name: "tokens", type: "address[]" },
      { name: "recipients", type: "address[]" },
      { name: "amounts", type: "uint256[]" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "owner",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "withdraw",
    stateMutability: "nonpayable",
    inputs: [
      { name: "token", type: "address" },
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "transferOwnership",
    stateMutability: "nonpayable",
    inputs: [{ name: "next", type: "address" }],
    outputs: [],
  },
  {
    type: "event",
    name: "BatchTransferred",
    inputs: [
      { name: "token", type: "address", indexed: true },
      { name: "count", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "MultiBatchTransferred",
    inputs: [{ name: "count", type: "uint256", indexed: false }],
  },
] as const;

export interface PendingTransfer {
  token: Address;
  recipient: Address;
  amount: bigint;
}

export interface BatcherOptions {
  relayerAddress: Address;
  maxBatchSize?: number;
  flushIntervalMs?: number;
  netSameRecipient?: boolean;
  policy?: FeePolicy;
  skipOnSpike?: boolean;
}

export interface FlushResult {
  skipped: boolean;
  reason?: string;
  batchHash?: Hash;
  topupHashes?: Hash[];
  transfersSent?: number;
  transfersQueued?: number;
  feeQuote?: FeeQuote;
}

export class TransferBatcher {
  private queue: PendingTransfer[] = [];
  private readonly opts: Required<Omit<BatcherOptions, "policy">> & { policy: FeePolicy };
  private timer?: ReturnType<typeof setInterval>;
  private flushing = false;

  constructor(
    private readonly publicClient: PublicClient,
    private readonly walletClient: WalletClient<Transport, Chain, Account>,
    opts: BatcherOptions,
  ) {
    this.opts = {
      relayerAddress: opts.relayerAddress,
      maxBatchSize: opts.maxBatchSize ?? 200,
      flushIntervalMs: opts.flushIntervalMs ?? 60_000,
      netSameRecipient: opts.netSameRecipient ?? false,
      policy: opts.policy ?? defaultFeePolicy,
      skipOnSpike: opts.skipOnSpike ?? true,
    };
    if (this.opts.maxBatchSize < 1) throw new Error("maxBatchSize must be >= 1");
  }

  get pendingCount(): number {
    return this.queue.length;
  }

  enqueue(transfer: PendingTransfer): void {
    if (transfer.amount <= 0n) throw new Error("amount must be positive");
    this.queue.push(transfer);
  }

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => void this.flush().catch(() => {}), this.opts.flushIntervalMs);
    if (typeof this.timer === "object" && "unref" in this.timer) {
      (this.timer as unknown as { unref: () => void }).unref();
    }
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }

  buildBatch(): { plan: Map<Address, { recipient: Address; amount: bigint }[]>; itemCount: number } {
    const n = Math.min(this.queue.length, this.opts.maxBatchSize);
    const plan = new Map<Address, { recipient: Address; amount: bigint }[]>();
    for (const t of this.queue.slice(0, n)) {
      const group = plan.get(t.token) ?? [];
      if (this.opts.netSameRecipient) {
        const existing = group.find((g) => g.recipient === t.recipient);
        if (existing) {
          existing.amount += t.amount;
          continue;
        }
      }
      group.push({ recipient: t.recipient, amount: t.amount });
      plan.set(t.token, group);
    }
    return { plan, itemCount: n };
  }

  async flush(): Promise<FlushResult> {
    if (this.flushing) return { skipped: true, reason: "flush-in-progress", transfersQueued: this.queue.length };
    if (this.queue.length === 0) return { skipped: true, reason: "empty-queue", transfersQueued: 0 };
    this.flushing = true;
    try {
      const quote = await quoteFees(this.publicClient, this.opts.policy);
      if (this.opts.skipOnSpike && quote.spiking) {
        return { skipped: true, reason: "gas-spike", feeQuote: quote, transfersQueued: this.queue.length };
      }

      const { plan, itemCount } = this.buildBatch();
      const tokens: Address[] = [];
      const recipients: Address[] = [];
      const amounts: bigint[] = [];
      const totals = new Map<Address, bigint>();
      for (const [token, items] of plan) {
        for (const item of items) {
          tokens.push(token);
          recipients.push(item.recipient);
          amounts.push(item.amount);
        }
        totals.set(
          token,
          items.reduce((sum, i) => sum + i.amount, 0n),
        );
      }
      if (tokens.length === 0) return { skipped: true, reason: "empty-queue", transfersQueued: this.queue.length };

      const topupHashes: Hash[] = [];
      for (const [token, total] of totals) {
        const float = (await this.publicClient.readContract({
          address: token,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [this.opts.relayerAddress],
        })) as bigint;
        if (float < total) {
          topupHashes.push(
            await this.walletClient.writeContract({
              address: token,
              abi: erc20Abi,
              functionName: "transfer",
              args: [this.opts.relayerAddress, total - float],
              maxFeePerGas: quote.maxFeePerGas,
              maxPriorityFeePerGas: quote.maxPriorityFeePerGas,
            }),
          );
        }
      }

      const uniqueTokens = [...new Set(tokens)];
      const batchHash = await this.walletClient.writeContract({
        address: this.opts.relayerAddress,
        abi: batchRelayerAbi,
        functionName: uniqueTokens.length === 1 ? "batchTransfer" : "batchTransferMulti",
        args:
          uniqueTokens.length === 1
            ? [uniqueTokens[0]!, recipients, amounts]
            : [tokens, recipients, amounts],
        maxFeePerGas: quote.maxFeePerGas,
        maxPriorityFeePerGas: quote.maxPriorityFeePerGas,
      });

      const receipt = await this.publicClient.waitForTransactionReceipt({ hash: batchHash });
      if (receipt.status !== "success") {
        throw new Error(`batch tx reverted: ${batchHash}`);
      }
      this.queue.splice(0, itemCount);

      return {
        skipped: false,
        batchHash,
        topupHashes,
        transfersSent: recipients.length,
        transfersQueued: this.queue.length,
        feeQuote: quote,
      };
    } finally {
      this.flushing = false;
    }
  }
}