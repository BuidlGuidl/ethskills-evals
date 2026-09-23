import { Rpc } from "./rpc.ts";
import { decideFeesLive, type FeePolicy } from "./fees.ts";
import { padAddress, padUint } from "./abi.ts";
import type { UnsignedTx } from "./transfer.ts";

// keccak256("batchTransfer(address,address[],uint256[])")[0:4]
const BATCH_SELECTOR = "1239ec8c";

/**
 * Encode Batcher.batchTransfer(token, to[], amounts[]).
 *
 * Layout: head = token | offset(to[]) | offset(amounts[]), then each dynamic
 * array as length-prefixed items. offset(to[]) is always 0x60 (3 head slots).
 */
export function encodeBatchTransfer(
  token: string,
  to: string[],
  amounts: bigint[],
): `0x${string}` {
  if (to.length !== amounts.length) throw new Error("to/amounts length mismatch");
  if (to.length === 0) throw new Error("empty batch");
  const n = BigInt(to.length);
  const offTo = 96n; // 3 * 32
  const offAmounts = offTo + 32n + 32n * n;
  const head = padAddress(token) + padUint(offTo) + padUint(offAmounts);
  const toArr = padUint(n) + to.map(padAddress).join("");
  const amtArr = padUint(n) + amounts.map(padUint).join("");
  return `0x${BATCH_SELECTOR}${head}${toArr}${amtArr}`;
}

/**
 * Gas model for a batch of N transfers vs N standalone txs.
 *
 * Per standalone transfer: intrinsic 21,000 + ~45–62k execution (measured
 * avg ~49–54k gasUsed for USDC transfers on Base, 2026-09-23).
 * In a batch the 21,000 intrinsic and the fixed L1 tx overhead are paid once,
 * offset by ~2,000 gas/item of loop overhead in the batcher.
 */
export function batchSavingPerTransfer(
  n: number,
  standaloneGas: number,
  loopOverheadPerItem = 2_000,
  intrinsic = 21_000,
): number {
  if (n < 2) return 0;
  const saved = (intrinsic * (n - 1)) / n - loopOverheadPerItem;
  return Math.min(saved, standaloneGas);
}

/** Build an unsigned call to the deployed Batcher. Same fee discipline as singles. */
export async function buildBatchTx(
  rpc: Rpc,
  batcher: string,
  token: string,
  to: string[],
  amounts: bigint[],
  policy?: FeePolicy,
): Promise<UnsignedTx> {
  const decision = await decideFeesLive(rpc, policy);
  if (!decision.send) throw new Error(`fee hold: ${decision.reason}`);
  return {
    to: batcher,
    data: encodeBatchTransfer(token, to, amounts),
    maxFeePerGas: decision.maxFeePerGas,
    maxPriorityFeePerGas: decision.maxPriorityFeePerGas,
    type: 2,
  };
}
