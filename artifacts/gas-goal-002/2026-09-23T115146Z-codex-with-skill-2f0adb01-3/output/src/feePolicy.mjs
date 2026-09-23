import { toBigInt } from "./gasMath.mjs";

export const DEFAULT_PRIORITY_FEE_WEI = 1_000_000n; // 0.001 gwei.
export const DEFAULT_MAX_EXECUTION_GAS_PRICE_WEI = 20_000_000n; // 0.02 gwei.

export function buildBaseFeeOverrides({
  baseFeeWei,
  priorityFeeWei = DEFAULT_PRIORITY_FEE_WEI,
  maxExecutionGasPriceWei = DEFAULT_MAX_EXECUTION_GAS_PRICE_WEI,
  urgent = false,
} = {}) {
  const baseFee = toBigInt(baseFeeWei, "baseFeeWei");
  const priorityFee = toBigInt(priorityFeeWei, "priorityFeeWei");
  const cap = toBigInt(maxExecutionGasPriceWei, "maxExecutionGasPriceWei");
  const suggestedMaxFee = baseFee * 2n + priorityFee;

  if (!urgent && suggestedMaxFee > cap) {
    return {
      shouldSubmit: false,
      reason: `Suggested maxFeePerGas ${suggestedMaxFee} wei exceeds cap ${cap} wei`,
      maxFeePerGas: cap,
      maxPriorityFeePerGas: priorityFee,
    };
  }

  return {
    shouldSubmit: true,
    reason: urgent && suggestedMaxFee > cap ? "urgent payment bypassed gas cap" : "within gas cap",
    maxFeePerGas: urgent ? suggestedMaxFee : suggestedMaxFee < cap ? suggestedMaxFee : cap,
    maxPriorityFeePerGas: priorityFee,
  };
}

export function rejectLegacyGasPrice({ gasPriceWei, maxExecutionGasPriceWei = DEFAULT_MAX_EXECUTION_GAS_PRICE_WEI } = {}) {
  const gasPrice = toBigInt(gasPriceWei, "gasPriceWei");
  const cap = toBigInt(maxExecutionGasPriceWei, "maxExecutionGasPriceWei");

  if (gasPrice > cap) {
    return {
      shouldSubmit: false,
      reason: `Legacy gasPrice ${gasPrice} wei exceeds cap ${cap} wei`,
    };
  }

  return {
    shouldSubmit: true,
    reason: "legacy gasPrice within cap",
  };
}
