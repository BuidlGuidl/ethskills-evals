import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { formatEther, formatGwei, type Address } from "viem";

export type Spend = {
  action: string;
  to: Address | "new contract";
  value?: bigint;
  gasLimit: bigint;
  maxFeePerGas: bigint;
  /** Native-token price of gas at the fee cap: gasLimit * maxFeePerGas. */
  gasCost: bigint;
};

/**
 * Prints exactly what is about to be signed and blocks until a human types
 * "yes". There is no environment variable or flag that skips this — a script
 * that spends funds without a person watching needs a different design (see
 * "Running this unattended" in the README), not a bypass here.
 */
export async function confirmSpend(spend: Spend): Promise<void> {
  const lines = [
    "",
    "──────────────────────────────────────────────",
    `  ${spend.action}`,
    "──────────────────────────────────────────────",
    `  to:        ${spend.to}`,
  ];
  if (spend.value !== undefined) {
    lines.push(`  value:     ${formatEther(spend.value)} ETH`);
  }
  lines.push(
    `  gas limit: ${spend.gasLimit}`,
    `  max fee:   ${formatGwei(spend.maxFeePerGas)} gwei/gas`,
    `  gas cost:  up to ${formatEther(spend.gasCost)} ETH`,
  );
  if (spend.value !== undefined) {
    lines.push(
      `  total:     up to ${formatEther(spend.value + spend.gasCost)} ETH`,
    );
  }
  lines.push("──────────────────────────────────────────────", "");
  console.log(lines.join("\n"));

  if (!stdin.isTTY) {
    throw new Error(
      "Not attached to a terminal, so nobody can approve this. Aborting.",
    );
  }

  const rl = createInterface({ input: stdin, output: stdout });
  try {
    const answer = await rl.question('Type "yes" to sign and broadcast: ');
    if (answer.trim().toLowerCase() !== "yes") {
      throw new Error("Aborted — nothing was signed or broadcast.");
    }
  } finally {
    rl.close();
  }
}
