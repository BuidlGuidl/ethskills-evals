#!/usr/bin/env node
/*
 * Models only the execution-gas saving, using measurements from a fork or Base.
 * Example: node scripts/estimate-batch-savings.mjs 40000 51000 35000 200
 */
const [daily, directGas, batchGasPerPayment, batchSize] = process.argv.slice(2).map(Number);
if (![daily, directGas, batchGasPerPayment, batchSize].every(Number.isFinite) || batchSize < 2) {
  console.error("Usage: node scripts/estimate-batch-savings.mjs <daily-payments> <direct-gas/payment> <batch-gas/payment> <batch-size>");
  process.exit(1);
}
const direct = daily * directGas;
const batched = daily * batchGasPerPayment;
const saved = direct - batched;
console.log(JSON.stringify({ dailyPayments: daily, batchSize, directExecutionGas: direct, batchedExecutionGas: batched, executionGasSavedPerDay: saved, executionSavingPercent: +(100 * saved / direct).toFixed(2), executionGasSavedPer30DayMonth: saved * 30 }, null, 2));
