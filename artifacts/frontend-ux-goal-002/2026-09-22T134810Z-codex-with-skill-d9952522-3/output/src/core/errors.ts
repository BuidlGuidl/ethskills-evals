export function toHumanError(error: unknown) {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    if (message.includes("user rejected") || message.includes("rejected the request")) {
      return "The wallet request was rejected.";
    }

    if (message.includes("insufficient funds")) {
      return "There is not enough ETH to pay gas for this transfer.";
    }

    if (message.includes("execution reverted")) {
      return "The USDC contract rejected the transfer. Check the amount and recipient.";
    }

    if (message.includes("chain") && message.includes("unsupported")) {
      return "Switch to Ethereum mainnet before sending USDC.";
    }

    return error.message;
  }

  return "Something went wrong. Please try again.";
}
