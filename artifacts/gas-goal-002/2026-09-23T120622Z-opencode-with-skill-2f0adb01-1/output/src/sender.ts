// Batching sender for the relayer. Groups queued payments by token, sends one
// batchTransfer tx per token group (default batch of up to 20), falls back to a
// direct ERC-20 transfer when the queue is too small, applies the fee policy,
// defers non-urgent payments during fee spikes, and records spend to the ledger.

import {
  Address,
  createWalletClient,
  createPublicClient,
  http,
  parseAbiItem,
  parseEventLogs,
  Hex,
} from "viem";
import { base } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { batcherAbi, erc20Abi } from "./abi.js";
import { computeFees, describe, FeeConfig } from "./fees.js";
import { logToLedger } from "./ledger.js";

export interface Payment {
  token: Address;
  to: Address;
  amount: bigint;
  urgent?: boolean;
}

export interface SenderConfig {
  rpcUrl: string;
  privateKey: Hex;
  batcherAddress?: Address; // once deployed; falls back to direct transfers otherwise
  ledgerPath: string;
  batchTarget: number; // fork-measured optimum ~20
  flushIntervalMs: number;
  ethUsd: number; // price for ledger conversion
  fee: FeeConfig;
}

const FAILED_EVENT = parseAbiItem(
  "event Failed(address indexed token, address indexed to, uint256 amount)"
);

export class PaymentSender {
  private queue: Payment[] = [];
  private flushing = false;
  private wallet;
  private public;
  private account;

  constructor(private cfg: SenderConfig) {
    this.account = privateKeyToAccount(cfg.privateKey);
    this.wallet = createWalletClient({
      account: this.account,
      chain: base,
      transport: http(cfg.rpcUrl),
    });
    this.public = createPublicClient({ chain: base, transport: http(cfg.rpcUrl) });
  }

  enqueue(p: Payment): void {
    this.queue.push(p);
  }

  /** One-time per token: approve the batcher contract. */
  async approveToken(token: Address): Promise<Hex> {
    if (!this.cfg.batcherAddress) throw new Error("batcher not configured");
    const hash = await this.wallet.writeContract({
      address: token,
      abi: erc20Abi,
      functionName: "approve",
      args: [this.cfg.batcherAddress, 2n ** 256n - 1n],
    });
    return hash;
  }

  /** Drain the queue respecting fee policy and batch targets. */
  async flush(): Promise<void> {
    if (this.flushing || this.queue.length === 0) return;
    this.flushing = true;
    try {
      const fees = await computeFees(this.cfg.fee);
      console.log(describe(fees));
      const hasUrgent = this.queue.some((p) => p.urgent);
      if (fees.spiked && !hasUrgent) return; // hold until cheaper

      // Group by token so each batchTransfer gets a single token.
      const groups = new Map<Address, Payment[]>();
      for (const p of this.queue) {
        const g = groups.get(p.token) ?? [];
        g.push(p);
        groups.set(p.token, g);
      }
      for (const [token, payments] of groups) {
        while (payments.length > 0) {
          if (this.cfg.batcherAddress && payments.length >= this.cfg.batchTarget) {
            const chunk = payments.splice(0, this.cfg.batchTarget);
            await this.sendBatch(token, chunk);
            this.queue = this.queue.filter((q) => !chunk.includes(q));
          } else {
            // below batch target (or no batcher deployed): direct transfers
            const p = payments.shift()!;
            await this.sendDirect(p);
            this.queue = this.queue.filter((q) => q !== p);
          }
        }
      }
    } finally {
      this.flushing = false;
    }
  }

  private async sendBatch(token: Address, payments: Payment[]): Promise<void> {
    const fees = await computeFees(this.cfg.fee);
    const hash = await this.wallet.writeContract({
      address: this.cfg.batcherAddress!,
      abi: batcherAbi,
      functionName: "batchTransfer",
      args: [token, payments.map((p) => p.to), payments.map((p) => p.amount)],
      maxFeePerGas: fees.maxFeePerGas,
      maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
    });
    const receipt = await this.public.waitForTransactionReceipt({ hash });
    this.record(hash, payments.length, receipt);
    const failed = parseEventLogs({
      abi: [FAILED_EVENT],
      logs: receipt.logs,
    });
    if (failed.length > 0) {
      console.warn(
        `batch ${hash}: ${failed.length}/${payments.length} payments failed (skipped on-chain)`
      );
    }
  }

  private async sendDirect(p: Payment): Promise<void> {
    const fees = await computeFees(this.cfg.fee);
    const hash = await this.wallet.writeContract({
      address: p.token,
      abi: erc20Abi,
      functionName: "transfer",
      args: [p.to, p.amount],
      maxFeePerGas: fees.maxFeePerGas,
      maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
    });
    const receipt = await this.public.waitForTransactionReceipt({ hash });
    this.record(hash, 1, receipt);
  }

  private record(hash: Hex, count: number, receipt: any): void {
    const l1Fee = (receipt?.l1Fee ?? 0n) as bigint;
    logToLedger(this.cfg.ledgerPath, {
      txHash: hash,
      payments: count,
      gasUsed: receipt.gasUsed,
      effectiveGasPriceWei: receipt.effectiveGasPrice,
      l1FeeWei: l1Fee,
      ethUsd: this.cfg.ethUsd,
    });
  }
}
