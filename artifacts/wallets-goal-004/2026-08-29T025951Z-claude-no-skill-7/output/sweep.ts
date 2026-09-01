import { createInterface } from "node:readline/promises";
import { formatEther } from "viem";
import { account, assertSepolia, explorer, publicClient, teamAddress, walletClient } from "./config.js";

/**
 * Sends the deployer's leftover Sepolia ETH back to TEAM_ADDRESS.
 *
 * Usage:
 *   npm run sweep          # prints the plan and asks for confirmation
 *   npm run sweep -- --yes # skip the prompt (CI)
 *
 * A plain ETH transfer costs 21000 gas, so we send (balance - 21000 * maxFeePerGas)
 * and let the difference between maxFeePerGas and the actual base fee come back
 * as dust. Sweeping to exactly zero isn't possible when the base fee can move
 * between building and mining the transaction.
 */

const GAS_LIMIT = 21_000n;

async function confirm(question: string): Promise<boolean> {
  if (process.argv.includes("--yes") || process.env.CI === "true") return true;
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(`${question} [y/N] `);
  rl.close();
  return answer.trim().toLowerCase() === "y";
}

async function main(): Promise<void> {
  await assertSepolia();

  const to = teamAddress();
  if (to.toLowerCase() === account.address.toLowerCase()) {
    throw new Error("TEAM_ADDRESS is the deployer itself — nothing to sweep.");
  }

  const balance = await publicClient.getBalance({ address: account.address });
  const { maxFeePerGas, maxPriorityFeePerGas } = await publicClient.estimateFeesPerGas();
  const reserve = GAS_LIMIT * maxFeePerGas;

  console.log(`From:    ${account.address}`);
  console.log(`To:      ${to}`);
  console.log(`Balance: ${formatEther(balance)} ETH`);
  console.log(`Fee reserve: ${formatEther(reserve)} ETH (${GAS_LIMIT} gas @ ${formatEther(maxFeePerGas)} ETH)`);

  if (balance <= reserve) {
    console.log("Balance does not cover the transfer fee. Nothing to sweep.");
    return;
  }

  const value = balance - reserve;
  console.log(`Sending: ${formatEther(value)} ETH`);

  if (!(await confirm("Sweep leftover balance?"))) {
    console.log("Aborted.");
    return;
  }

  const hash = await walletClient.sendTransaction({
    to,
    value,
    gas: GAS_LIMIT,
    maxFeePerGas,
    maxPriorityFeePerGas,
  });
  console.log(`Tx sent: ${hash}`);
  console.log(`  ${explorer(`tx/${hash}`)}`);

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") {
    throw new Error(`Sweep transaction reverted (${hash}).`);
  }

  const remaining = await publicClient.getBalance({ address: account.address });
  console.log(`Swept ${formatEther(value)} ETH to ${to}.`);
  console.log(`Deployer balance now: ${formatEther(remaining)} ETH`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
