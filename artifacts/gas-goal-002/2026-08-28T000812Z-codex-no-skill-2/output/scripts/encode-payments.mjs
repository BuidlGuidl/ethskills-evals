#!/usr/bin/env node
/*
 * Convert a payout JSON array into the compact calldata used by
 * ERC20BatchDistributor.batchTransfer(address,bytes).
 *
 * Input:  [{"recipient":"0x...20-byte address...", "amount":"1230000"}]
 * Output: 0x{20-byte recipient}{32-byte uint256}...
 */
import { readFileSync } from "node:fs";

const [inputFile] = process.argv.slice(2);
if (!inputFile) {
  console.error("Usage: node scripts/encode-payments.mjs payouts.json");
  process.exit(1);
}

let payments;
try {
  payments = JSON.parse(readFileSync(inputFile, "utf8"));
} catch (error) {
  console.error(`Cannot read payout JSON: ${error.message}`);
  process.exit(1);
}

if (!Array.isArray(payments) || payments.length === 0) {
  console.error("Payout JSON must be a non-empty array.");
  process.exit(1);
}

const encoded = payments.map((payment, index) => {
  if (!payment || typeof payment.recipient !== "string" || !/^0x[0-9a-fA-F]{40}$/.test(payment.recipient)) {
    throw new Error(`Payment ${index}: recipient must be a 20-byte 0x address.`);
  }
  let amount;
  try {
    amount = BigInt(payment.amount);
  } catch {
    throw new Error(`Payment ${index}: amount must be an integer accepted by BigInt.`);
  }
  if (amount < 0n || amount >= (1n << 256n)) {
    throw new Error(`Payment ${index}: amount is outside uint256.`);
  }
  return payment.recipient.slice(2).toLowerCase() + amount.toString(16).padStart(64, "0");
});

console.log(`0x${encoded.join("")}`);
