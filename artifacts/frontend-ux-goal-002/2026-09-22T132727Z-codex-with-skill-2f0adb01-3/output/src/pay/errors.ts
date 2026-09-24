export function getFriendlyTxError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();

  if (lower.includes("user rejected") || lower.includes("user denied") || lower.includes("rejected the request")) {
    return "Transaction rejected in wallet.";
  }

  if (lower.includes("insufficient funds")) {
    return "Your wallet does not have enough ETH to pay gas for this transfer.";
  }

  if (lower.includes("execution reverted") || lower.includes("transfer amount exceeds balance")) {
    return "USDC transfer failed. Check that your USDC balance covers the amount.";
  }

  if (lower.includes("network changed") || lower.includes("chain mismatch")) {
    return "Network changed before the transaction finished. Switch back to Ethereum mainnet and try again.";
  }

  return "Transfer could not be submitted. Check the details and try again.";
}
