import { baseFeeOverrides, receiptCost, rpc } from "./base-relayer-fees.js";

// Adapter points: pass `feeOverrides` to your ethers/viem sendTransaction call.
export async function submitPayment(sendErc20Transfer, transfer) {
  const feeOverrides = await baseFeeOverrides();
  const { observedBaseFeePerGas, ...transactionFees } = feeOverrides;
  const tx = await sendErc20Transfer(transfer, transactionFees);
  const receipt = await tx.wait();
  const cost = receiptCost(receipt);
  // Send this record to the finance ledger. A null total flags an RPC that
  // omits l1Fee and must be changed before all-in reporting is trusted.
  return { hash: tx.hash, observedBaseFeePerGas, ...cost };
}

// For providers whose normal receipt object omits Base's l1Fee extension.
export async function baseReceiptWithL1Fee(hash) {
  return rpc("eth_getTransactionReceipt", [hash]);
}
