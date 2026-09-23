import type { RpcClient } from "./rpc.ts";

export const GWEI = 1_000_000_000n;

export interface FeePolicyConfig {
  priorityFeeGwei: number;
  headroomBps: number;
  maxMaxFeeGwei: number;
  spikeDeferGwei: number;
}

export const DEFAULT_FEE_POLICY: FeePolicyConfig = {
  priorityFeeGwei: 0.001,
  headroomBps: 2_500,
  maxMaxFeeGwei: 0.05,
  spikeDeferGwei: 0.05,
};

export interface RecommendedFees {
  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
}

export function gweiToWei(gwei: number): bigint {
  return BigInt(Math.round(gwei * 1e9));
}

export function recommendFees(baseFeeWei: bigint, cfg: FeePolicyConfig = DEFAULT_FEE_POLICY): RecommendedFees {
  const priority = gweiToWei(cfg.priorityFeeGwei);
  const headroomNumerator = 10_000n + BigInt(cfg.headroomBps);
  const withHeadroom = (baseFeeWei * headroomNumerator) / 10_000n + priority;
  const cap = gweiToWei(cfg.maxMaxFeeGwei);
  const maxFeePerGas = withHeadroom > cap ? cap : withHeadroom;
  const maxPriorityFeePerGas = priority > maxFeePerGas ? maxFeePerGas : priority;
  return { maxFeePerGas, maxPriorityFeePerGas };
}

export function isSpike(baseFeeWei: bigint, cfg: FeePolicyConfig = DEFAULT_FEE_POLICY): boolean {
  return baseFeeWei > gweiToWei(cfg.spikeDeferGwei);
}

export async function fetchBaseFee(rpc: RpcClient): Promise<bigint> {
  return rpc.getBaseFee();
}
