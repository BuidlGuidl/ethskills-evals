import { createPublicClient, encodeFunctionData, http, type PublicClient } from "viem";

export const BASE_CHAIN_ID = 8453;
export const BASE_RPC = "https://mainnet.base.org";
export const GAS_PRICE_ORACLE = "0x420000000000000000000000000000000000000F" as const;
export const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as const;
export const MAX_BATCH = 256n;
export const UINT96_MAX = (1n << 96n) - 1n;

export type Payout = { token: `0x${string}`; to: `0x${string}`; amount: bigint };

export const BATCH_SENDER_ABI = [
  {
    type: "function",
    name: "send",
    inputs: [
      { name: "token", type: "address" },
      { name: "items", type: "bytes32[]" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "sendSafe",
    inputs: [
      { name: "token", type: "address" },
      { name: "items", type: "bytes32[]" },
    ],
    outputs: [{ name: "failures", type: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "event",
    name: "Failures",
    inputs: [{ name: "bitmap", type: "uint256", indexed: false }],
  },
] as const;

export function validatePayout(p: Payout): void {
  if (!/^0x[0-9a-fA-F]{40}$/.test(p.to)) throw new Error(`invalid recipient: ${p.to}`);
  if (p.amount <= 0n) throw new Error(`non-positive amount for ${p.to}`);
  if (p.amount > UINT96_MAX) throw new Error(`amount exceeds uint96 for ${p.to}`);
}

export function packItem(to: `0x${string}`, amount: bigint): `0x${string}` {
  const word = (BigInt(to) << 96n) | amount;
  return `0x${word.toString(16).padStart(64, "0")}` as `0x${string}`;
}

export function unpackItem(item: `0x${string}`): { to: `0x${string}`; amount: bigint } {
  const word = BigInt(item);
  const to = `0x${(word >> 96n).toString(16).padStart(40, "0")}` as `0x${string}`;
  const amount = word & UINT96_MAX;
  return { to, amount };
}

export function chunk<T>(list: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

export function groupByToken(payouts: Payout[]): Map<`0x${string}`, Payout[]> {
  const groups = new Map<`0x${string}`, Payout[]>();
  for (const p of payouts) {
    validatePayout(p);
    const list = groups.get(p.token) ?? [];
    list.push(p);
    groups.set(p.token, list);
  }
  return groups;
}

export function encodeSend(
  fn: "send" | "sendSafe",
  token: `0x${string}`,
  items: `0x${string}`[],
): `0x${string}` {
  return encodeFunctionData({
    abi: BATCH_SENDER_ABI,
    functionName: fn,
    args: [token, items],
  });
}

export function basePublicClient(rpc: string): PublicClient {
  return createPublicClient({ transport: http(rpc, { batch: true }) });
}
