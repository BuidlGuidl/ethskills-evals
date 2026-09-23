import { encodeFunctionData, decodeFunctionResult, parseAbi, type Address, type Hex } from "viem";
import type { RpcClient, Hex as RpcHex } from "./rpc.ts";
import { recommendFees, isSpike } from "./fees.ts";

export interface Payout {
  id: string;
  token: Address;
  recipient: Address;
  amount: bigint;
  queuedAt: number;
}

export function netPayouts(payouts: Payout[]): Payout[] {
  const merged = new Map<string, Payout>();
  const order: string[] = [];
  for (const p of payouts) {
    const key = `${p.token.toLowerCase()}:${p.recipient.toLowerCase()}`;
    const existing = merged.get(key);
    if (existing) {
      existing.amount += p.amount;
    } else {
      merged.set(key, { ...p });
      order.push(key);
    }
  }
  return order.map((k) => merged.get(k)!);
}

export function chunkBatch(payouts: Payout[], maxItems: number): Payout[][] {
  const chunks: Payout[][] = [];
  for (let i = 0; i < payouts.length; i += maxItems) {
    chunks.push(payouts.slice(i, i + maxItems));
  }
  return chunks;
}

const multiSenderAbi = parseAbi([
  "function payout(address token, address[] recipients, uint256[] amounts)",
  "function payoutPartial(address token, address[] recipients, uint256[] amounts) returns (uint256[])",
  "function payoutMixed((address token, address recipient, uint256 amount)[] payments) returns (uint256[])",
]) as const;

const erc20Abi = parseAbi([
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
]) as const;

export function encodePayout(token: Address, recipients: Address[], amounts: bigint[]): Hex {
  return encodeFunctionData({
    abi: multiSenderAbi,
    functionName: "payout",
    args: [token, recipients, amounts],
  });
}

export function encodePayoutPartial(token: Address, recipients: Address[], amounts: bigint[]): Hex {
  return encodeFunctionData({
    abi: multiSenderAbi,
    functionName: "payoutPartial",
    args: [token, recipients, amounts],
  });
}

export function decodeFailedBitmap(result: RpcHex): boolean[] {
  const words = decodeFunctionResult({
    abi: multiSenderAbi,
    functionName: "payoutPartial",
    data: result,
  }) as bigint[];
  const failed: boolean[] = [];
  for (let i = 0; i < words.length * 256; i++) {
    const word = words[Number(BigInt(i) >> 8n)];
    failed.push(((word >> BigInt(i & 255)) & 1n) === 1n);
  }
  return failed;
}

export interface RelayerSigner {
  address: Address;
  sendTransaction(tx: {
    to: Address;
    data: RpcHex;
    gas: bigint;
    maxFeePerGas: bigint;
    maxPriorityFeePerGas: bigint;
  }): Promise<RpcHex>;
}

export interface BatcherOptions {
  multiSender: Address;
  rpc: RpcClient;
  signer: RelayerSigner;
  batchMaxItems?: number;
  gasLimitCap?: bigint;
  minQueueAgeMs?: number;
  flushIntervalMs?: number;
  mode?: "atomic" | "partial";
  onSettled?: (ids: string[], ok: boolean) => void;
  onDeferred?: (reason: string, count: number) => void;
  logger?: (msg: string) => void;
}

export interface BatchResult {
  token: Address;
  count: number;
  txHash: RpcHex | null;
  gasUsed: bigint | null;
  feeWei: bigint | null;
  failedIds: string[];
}

const DEFAULTS = {
  batchMaxItems: 250,
  gasLimitCap: 30_000_000n,
  minQueueAgeMs: 15_000,
  flushIntervalMs: 30_000,
  mode: "atomic" as const,
};

export class PayoutBatcher {
  private queue = new Map<string, Payout>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private flushing = false;
  private opts: BatcherOptions;

  constructor(opts: BatcherOptions) {
    this.opts = { ...DEFAULTS, ...opts };
  }

  enqueue(payout: Omit<Payout, "queuedAt">): string {
    const id = payout.id;
    this.queue.set(id, { ...payout, queuedAt: Date.now() });
    return id;
  }

  pending(): number {
    return this.queue.size;
  }

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => void this.flushOnce(), this.opts.flushIntervalMs);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async flushOnce(): Promise<BatchResult[]> {
    if (this.flushing) return [];
    this.flushing = true;
    try {
      const now = Date.now();
      const ready = [...this.queue.values()].filter(
        (p) => now - p.queuedAt >= this.opts.minQueueAgeMs
      );
      if (ready.length === 0) return [];

      const baseFee = await this.opts.rpc.getBaseFee();
      if (isSpike(baseFee)) {
        this.opts.onDeferred?.("gas spike", ready.length);
        return [];
      }
      const fees = recommendFees(baseFee);

      const results: BatchResult[] = [];
      for (const chunk of chunkBatch(netPayouts(ready), this.opts.batchMaxItems)) {
        const byToken = new Map<Address, Payout[]>();
        for (const p of chunk) {
          const list = byToken.get(p.token) ?? [];
          list.push(p);
          byToken.set(p.token, list);
        }
        for (const [token, group] of byToken) {
          const res = await this.sendGroup(token, group, fees);
          results.push(res);
        }
      }
      return results;
    } finally {
      this.flushing = false;
    }
  }

  private async sendGroup(
    token: Address,
    group: Payout[],
    fees: { maxFeePerGas: bigint; maxPriorityFeePerGas: bigint }
  ): Promise<BatchResult> {
    const rpc = this.opts.rpc;
    const recipients = group.map((p) => p.recipient);
    const amounts = group.map((p) => p.amount);
    const total = amounts.reduce((a, b) => a + b, 0n);

    const approveNeeded = await this.checkAllowance(token, total);
    if (approveNeeded) {
      const approveData = encodeFunctionData({
        abi: erc20Abi,
        functionName: "approve",
        args: [this.opts.multiSender, total * 2n],
      });
      await this.send(approveData, token, 80_000n, fees);
    }

    const data =
      this.opts.mode === "partial"
        ? encodePayoutPartial(token, recipients, amounts)
        : encodePayout(token, recipients, amounts);

    let gasEstimate: bigint;
    try {
      gasEstimate = await rpc.estimateGas({
        from: this.opts.signer.address,
        to: this.opts.multiSender,
        data,
      });
    } catch (err) {
      const failedIds = group.map((p) => p.id);
      this.markSettled(group, false, failedIds);
      return { token, count: group.length, txHash: null, gasUsed: null, feeWei: null, failedIds };
    }
    const gas = (gasEstimate * 120n) / 100n;
    if (gas > this.opts.gasLimitCap) {
      const half = Math.ceil(group.length / 2);
      const results = await Promise.all([
        this.sendGroup(token, group.slice(0, half), fees),
        this.sendGroup(token, group.slice(half), fees),
      ]);
      return results[0];
    }

    const txHash = await this.send(data, this.opts.multiSender, gas, fees);
    const receipt = await this.waitForReceipt(txHash);
    const gasUsed = receipt ? BigInt(receipt.gasUsed) : null;
    const feeWei =
      receipt && gasUsed !== null ? gasUsed * BigInt(receipt.effectiveGasPrice) : null;
    const failedIds: string[] = [];
    this.markSettled(group, receipt?.status === "0x1", failedIds);
    return { token, count: group.length, txHash, gasUsed, feeWei, failedIds };
  }

  private async send(
    data: RpcHex,
    to: Address,
    gas: bigint,
    fees: { maxFeePerGas: bigint; maxPriorityFeePerGas: bigint }
  ): Promise<RpcHex> {
    return this.opts.signer.sendTransaction({
      to,
      data,
      gas,
      maxFeePerGas: fees.maxFeePerGas,
      maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
    });
  }

  private async checkAllowance(token: Address, needed: bigint): Promise<boolean> {
    const data = encodeFunctionData({
      abi: erc20Abi,
      functionName: "allowance",
      args: [this.opts.signer.address, this.opts.multiSender],
    });
    const result = await this.opts.rpc.ethCall({ to: token, data });
    const allowance = BigInt(result === "0x" ? 0n : result);
    return allowance < needed;
  }

  private async waitForReceipt(txHash: RpcHex): Promise<{ status: string; gasUsed: string; effectiveGasPrice: string } | null> {
    for (let i = 0; i < 120; i++) {
      const receipt = await this.opts.rpc.getReceipt(txHash);
      if (receipt) return receipt;
      await new Promise((r) => setTimeout(r, 1_000));
    }
    return null;
  }

  private markSettled(group: Payout[], ok: boolean, failedIds: string[]): void {
    for (const p of group) {
      this.queue.delete(p.id);
    }
    this.opts.onSettled?.(group.map((p) => p.id), ok);
    if (failedIds.length > 0) {
      for (const id of failedIds) this.opts.logger?.(`payout failed: ${id}`);
    }
  }
}
