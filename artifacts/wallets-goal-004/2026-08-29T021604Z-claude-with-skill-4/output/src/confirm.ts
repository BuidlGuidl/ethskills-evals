import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { formatEther, formatGwei } from "viem";

/**
 * The human gate. Every script here that spends funds routes through this:
 * print what is about to happen in full, then block until a person types
 * "yes".
 *
 * There is deliberately no --yes / FORCE flag. If you need this to run
 * unattended, that is a different design problem (a bounded-allowance signer,
 * a Safe module, a relayer) and it should be solved there, not by removing the
 * gate here.
 */
export async function confirm(
  title: string,
  facts: Array<[string, string]>,
): Promise<void> {
  const width = Math.max(...facts.map(([label]) => label.length));

  console.log(`\n${title}`);
  console.log("─".repeat(Math.max(title.length, 60)));
  for (const [label, value] of facts) {
    console.log(`  ${label.padEnd(width)}  ${value}`);
  }
  console.log("─".repeat(Math.max(title.length, 60)));

  if (!stdin.isTTY) {
    throw new Error(
      "Refusing to sign without an interactive confirmation " +
        "(stdin is not a TTY). Run this from a terminal.",
    );
  }

  const rl = createInterface({ input: stdin, output: stdout });
  try {
    const answer = await rl.question('Type "yes" to sign and broadcast: ');
    if (answer.trim().toLowerCase() !== "yes") {
      console.log("Aborted. Nothing was signed.");
      process.exit(1);
    }
  } finally {
    rl.close();
  }
}

export function eth(wei: bigint): string {
  return `${formatEther(wei)} ETH`;
}

export function gwei(wei: bigint): string {
  return `${Number(formatGwei(wei)).toFixed(3)} gwei`;
}

export function sepoliaExplorer(kind: "tx" | "address", value: string): string {
  return `https://sepolia.etherscan.io/${kind}/${value}`;
}
