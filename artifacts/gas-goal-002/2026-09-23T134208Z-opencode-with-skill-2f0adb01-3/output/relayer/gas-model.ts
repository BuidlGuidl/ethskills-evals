import { encodeBatchTransfer, type Hex } from "./encoder.ts";

export interface GasPoints {
  emptyCall: number;
  individualExecExisting: number;
  individualExecFresh: number;
  batchExecExisting: [number, number][];
  batchExecFresh: [number, number][];
}

export const GAS_CONSTANTS = {
  individualExisting: 40_259n,
  individualFresh: 62_183n,
  batchFixedExec: 19_996n,
  batchPerEntryExisting: 11_689n,
  batchPerEntryFresh: 28_789n,
  coldAccessAllowance: 2_500n,
  intrinsicBase: 21_000n,
  l1FeeIndividualWei: 2_870_786_300n,
  l1FeePerBatchEntryWei: 855_800_000n,
  individualExecHarnessed: 44_356n,
  emptyCallHarnessed: 21_284n,
};

export function calldataGas(data: Hex): bigint {
  const hex = data.slice(2);
  let gas = 0n;
  for (let i = 0; i < hex.length; i += 2) {
    gas += hex.slice(i, i + 2) === "00" ? 4n : 16n;
  }
  return gas;
}

function batchCalldata(entryCount: number): Hex {
  const recipients = Array.from(
    { length: entryCount },
    (_, i) => `0x${(0x1111 + i).toString(16).padStart(40, "0")}`,
  );
  const amounts = Array.from({ length: entryCount }, () => 1_000_000n);
  return encodeBatchTransfer("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", recipients, amounts);
}

export function estimateBatchTxGas(entryCount: number, freshRatio = 0): bigint {
  const perEntry =
    BigInt(Math.round((1 - freshRatio) * Number(GAS_CONSTANTS.batchPerEntryExisting))) +
    BigInt(Math.round(freshRatio * Number(GAS_CONSTANTS.batchPerEntryFresh)));
  const data = batchCalldata(entryCount);
  return (
    GAS_CONSTANTS.intrinsicBase +
    calldataGas(data) +
    GAS_CONSTANTS.batchFixedExec +
    GAS_CONSTANTS.coldAccessAllowance +
    BigInt(entryCount) * perEntry
  );
}

export function estimateBatchGasLimit(entryCount: number, freshRatio = 0, marginBps = 2_000): bigint {
  return (estimateBatchTxGas(entryCount, freshRatio) * (10_000n + BigInt(marginBps))) / 10_000n;
}

export function estimateIndividualTxGas(freshRatio = 0): bigint {
  return (
    GAS_CONSTANTS.individualExisting * BigInt(Math.round((1 - freshRatio) * 1e6)) +
    GAS_CONSTANTS.individualFresh * BigInt(Math.round(freshRatio * 1e6))
  ) / 1_000_000n;
}

export function estimateBatchTxWeiL1Fee(entryCount: number): bigint {
  return GAS_CONSTANTS.l1FeePerBatchEntryWei * BigInt(entryCount);
}
