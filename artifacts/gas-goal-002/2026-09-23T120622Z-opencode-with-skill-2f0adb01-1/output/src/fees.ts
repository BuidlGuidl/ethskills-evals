// Fee policy for the Base relayer.
//
// Why this exists: we observed real Base senders paying 0.19 gwei when the
// median tip was 0.001 gwei (38x overpay) and wallets that hardcode tips from
// 2024 defaults. This module caps what we will ever pay and defers non-urgent
// sends during fee spikes.

import { createPublicClient, http, parseGwei, formatGwei } from "viem";
import { base as baseChain } from "viem/chains";

export interface FeePolicy {
  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
  spiked: boolean;
  baseFee: bigint;
}

export interface FeeConfig {
  rpcUrl: string;
  /** Never set maxFeePerGas above this; default 0.5 gwei. */
  maxFeeCeiling?: string; // in gwei
  /** If current base fee exceeds this, non-urgent sends are deferred. Default 0.02 gwei. */
  spikeDeferThreshold?: string; // in gwei
}

const DEFAULT_CEILING = parseGwei("0.5");
const DEFAULT_SPIKE = parseGwei("0.02");
const MIN_TIP = parseGwei("0.0005"); // never tip less than this
const MAX_TIP = parseGwei("0.02"); // never tip more than this

/** Compute sane EIP-1559 fee params from recent feeHistory percentiles. */
export async function computeFees(cfg: FeeConfig): Promise<FeePolicy> {
  const ceiling = cfg.maxFeeCeiling ? parseGwei(cfg.maxFeeCeiling) : DEFAULT_CEILING;
  const spikeAt = cfg.spikeDeferThreshold
    ? parseGwei(cfg.spikeDeferThreshold)
    : DEFAULT_SPIKE;

  const client = createPublicClient({ chain: baseChain, transport: http(cfg.rpcUrl) });
  const history = await client.getFeeHistory({
    blockCount: 20,
    rewardPercentiles: [50],
  });
  const baseFee = history.baseFeePerGas[history.baseFeePerGas.length - 1];
  const tipP50 = history.reward?.[history.reward.length - 1]?.[0] ?? MIN_TIP;

  // Tip: clamp the p50 observed tip into [MIN_TIP, MAX_TIP].
  let tip = tipP50 < MIN_TIP ? MIN_TIP : tipP50 > MAX_TIP ? MAX_TIP : tipP50;
  // maxFee: 2x current base + tip, then hard-capped at ceiling.
  let maxFee = baseFee * 2n + tip;
  if (maxFee > ceiling) maxFee = ceiling;

  return {
    maxFeePerGas: maxFee,
    maxPriorityFeePerGas: tip,
    spiked: baseFee > spikeAt,
    baseFee,
  };
}

/** Loggable summary for ops. */
export function describe(p: FeePolicy): string {
  return `base=${formatGwei(p.baseFee)}gwei tip=${formatGwei(
    p.maxPriorityFeePerGas
  )}gwei maxFee=${formatGwei(p.maxFeePerGas)}gwei${p.spiked ? " [SPIKE: deferring non-urgent]" : ""}`;
}
