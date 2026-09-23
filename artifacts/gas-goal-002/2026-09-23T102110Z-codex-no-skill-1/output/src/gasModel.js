const WEI_PER_ETH = 1e18;
const GWEI_TO_WEI = 1e9;

export const DEFAULT_ASSUMPTIONS = Object.freeze({
  transfersPerDay: 40_000,
  daysPerMonth: 30,
  ethUsd: 2746.43,
  gasPriceGwei: 0.006,
  directGasUsed: 45_065,
  directL1FeeWei: 2_925_030_248,
  directTxBytes: 188,
  batchSize: 200,
  batchFixedGas: 35_000,
  directTxFixedGas: 21_000,
  directCalldataGas: 600,
  internalCallOverheadGas: 900,
  batchEnvelopeBytes: 188,
  packedPaymentBytes: 32
});

export function weiToEth(wei) {
  return Number(wei) / WEI_PER_ETH;
}

export function weiToUsd(wei, ethUsd) {
  return weiToEth(wei) * ethUsd;
}

export function executionFeeWei(gasUsed, gasPriceGwei) {
  return gasUsed * gasPriceGwei * GWEI_TO_WEI;
}

export function directTransferCost(input = {}) {
  const a = { ...DEFAULT_ASSUMPTIONS, ...input };
  const executionWei = executionFeeWei(a.directGasUsed, a.gasPriceGwei);
  const totalWei = executionWei + a.directL1FeeWei;

  return {
    gasPerTransfer: a.directGasUsed,
    l1FeeWeiPerTransfer: a.directL1FeeWei,
    totalWeiPerTransfer: totalWei,
    usdPerTransfer: weiToUsd(totalWei, a.ethUsd),
    usdPerDay: weiToUsd(totalWei * a.transfersPerDay, a.ethUsd),
    usdPerMonth: weiToUsd(totalWei * a.transfersPerDay * a.daysPerMonth, a.ethUsd)
  };
}

export function packedBatchCost(input = {}) {
  const a = { ...DEFAULT_ASSUMPTIONS, ...input };
  const perRecipientExecutionGas =
    a.directGasUsed -
    a.directTxFixedGas -
    a.directCalldataGas +
    a.internalCallOverheadGas;
  const gasPerTransfer =
    perRecipientExecutionGas + a.batchFixedGas / a.batchSize;
  const executionWei = executionFeeWei(gasPerTransfer, a.gasPriceGwei);
  const bytesPerTransfer =
    (a.batchEnvelopeBytes + a.packedPaymentBytes * a.batchSize) / a.batchSize;
  const l1FeeWeiPerTransfer =
    a.directL1FeeWei * (bytesPerTransfer / a.directTxBytes);
  const totalWei = executionWei + l1FeeWeiPerTransfer;

  return {
    batchSize: a.batchSize,
    gasPerTransfer,
    perRecipientExecutionGas,
    l1FeeWeiPerTransfer,
    totalWeiPerTransfer: totalWei,
    usdPerTransfer: weiToUsd(totalWei, a.ethUsd),
    usdPerDay: weiToUsd(totalWei * a.transfersPerDay, a.ethUsd),
    usdPerMonth: weiToUsd(totalWei * a.transfersPerDay * a.daysPerMonth, a.ethUsd)
  };
}

export function compareCosts(input = {}) {
  const direct = directTransferCost(input);
  const batch = packedBatchCost(input);
  const savedWeiPerTransfer =
    direct.totalWeiPerTransfer - batch.totalWeiPerTransfer;

  return {
    assumptions: { ...DEFAULT_ASSUMPTIONS, ...input },
    direct,
    batch,
    savings: {
      weiPerTransfer: savedWeiPerTransfer,
      percent: savedWeiPerTransfer / direct.totalWeiPerTransfer,
      usdPerTransfer: direct.usdPerTransfer - batch.usdPerTransfer,
      usdPerDay: direct.usdPerDay - batch.usdPerDay,
      usdPerMonth: direct.usdPerMonth - batch.usdPerMonth
    }
  };
}

export function staticGasPriceWaste(input = {}) {
  const a = { ...DEFAULT_ASSUMPTIONS, ...input };
  if (a.staticGasPriceGwei <= a.gasPriceGwei) {
    return {
      wastedUsdPerDay: 0,
      wastedUsdPerMonth: 0,
      wastedWeiPerTransfer: 0
    };
  }

  const wastedWeiPerTransfer = executionFeeWei(
    a.directGasUsed,
    a.staticGasPriceGwei - a.gasPriceGwei
  );

  return {
    wastedWeiPerTransfer,
    wastedUsdPerTransfer: weiToUsd(wastedWeiPerTransfer, a.ethUsd),
    wastedUsdPerDay: weiToUsd(wastedWeiPerTransfer * a.transfersPerDay, a.ethUsd),
    wastedUsdPerMonth: weiToUsd(
      wastedWeiPerTransfer * a.transfersPerDay * a.daysPerMonth,
      a.ethUsd
    )
  };
}
