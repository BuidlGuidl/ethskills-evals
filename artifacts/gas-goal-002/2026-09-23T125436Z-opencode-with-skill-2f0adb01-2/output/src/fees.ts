import { type PublicClient, type Hex, fromHex } from "viem";

export interface FeePolicy {
  priorityFeeGwei: number;
  maxFeeHeadroomX: number;
  spikeSkipX: number;
  lookbackBlocks: number;
}

export const defaultFeePolicy: FeePolicy = {
  priorityFeeGwei: 0.001,
  maxFeeHeadroomX: 2,
  spikeSkipX: 5,
  lookbackBlocks: 32,
};

export interface FeeQuote {
  baseFeePerGas: bigint;
  medianBaseFeePerGas: bigint;
  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
  spiking: boolean;
}

export async function quoteFees(client: PublicClient, policy: FeePolicy = defaultFeePolicy): Promise<FeeQuote> {
  const [block, history] = await Promise.all([
    client.getBlock({ blockTag: "latest" }),
    client.request({
      method: "eth_feeHistory",
      params: [toHexQuantity(policy.lookbackBlocks), "latest", []],
    }) as Promise<{ baseFeePerGas: (Hex | null)[] }>,
  ]);

  const baseFee = block.baseFeePerGas ?? 0n;
  const medians = (history.baseFeePerGas ?? [])
    .map((x) => (x === null ? null : fromHex(x, "bigint")))
    .filter((x): x is bigint => x !== null)
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const median = medians.length > 0 ? medians[Math.floor(medians.length / 2)]! : baseFee;

  const tip = BigInt(Math.round(policy.priorityFeeGwei * 1e9));
  const maxFee = baseFee * BigInt(Math.max(1, Math.round(policy.maxFeeHeadroomX))) + tip;

  return {
    baseFeePerGas: baseFee,
    medianBaseFeePerGas: median,
    maxFeePerGas: maxFee,
    maxPriorityFeePerGas: tip,
    spiking: median > 0n && baseFee > median * BigInt(Math.max(1, Math.round(policy.spikeSkipX))),
  };
}

function toHexQuantity(n: number): Hex {
  return `0x${n.toString(16)}` as Hex;
}