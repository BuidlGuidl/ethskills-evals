// Appends every confirmed send to a ledger so finance can answer
// "what do we actually spend" without archive queries.

import { appendFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname } from "node:path";

export interface LedgerEntry {
  txHash: string;
  payments: number; // payments included in this tx
  gasUsed: bigint;
  effectiveGasPriceWei: bigint;
  l1FeeWei: bigint; // Base receipts expose this explicitly
  ethUsd: number; // price used for conversion at send time
}

const HEADER = "timestamp,txhash,payments,gas_used,exec_price_wei,l1_fee_wei,exec_cost_wei,total_cost_wei,total_cost_usd\n";

export function logToLedger(path: string, e: LedgerEntry): void {
  if (!existsSync(path)) {
    mkdirSync(dirname(path), { recursive: true });
    appendFileSync(path, HEADER);
  }
  const execCost = e.gasUsed * e.effectiveGasPriceWei;
  const total = execCost + e.l1FeeWei;
  const usd = (Number(total) / 1e18) * e.ethUsd;
  appendFileSync(
    path,
    `${new Date().toISOString()},${e.txHash},${e.payments},${e.gasUsed},` +
      `${e.effectiveGasPriceWei},${e.l1FeeWei},${execCost},${total},${usd.toFixed(6)}\n`
  );
}
