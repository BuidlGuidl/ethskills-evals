import { createInterface } from "node:readline/promises";
import { formatEther, parseEther } from "viem";
import {
  chain,
  deployerAccount,
  explorer,
  publicClient,
  reportAndExit,
  teamAccount,
  walletClient,
} from "./config.js";

/**
 * Returns the deployer's leftover Sepolia ETH to the team account.
 *
 *   npm run sweep            # asks for confirmation
 *   npm run sweep -- --yes   # no prompt, for CI
 *
 * A plain ETH transfer costs exactly 21,000 gas, so we send
 * (balance - 21000 * maxFeePerGas) and let the unused fee margin stay behind
 * as dust. Sweeping the balance to exactly zero is not possible: the fee is
 * only known for certain once the transaction is mined.
 */

const TRANSFER_GAS = 21_000n;

/** Below this, the fee to move the funds is worth more than the funds. */
const DUST_THRESHOLD = parseEther("0.00001");

async function confirm(question: string): Promise<boolean> {
  if (process.argv.includes("--yes")) return true;
  if (!process.stdin.isTTY) {
    console.error("Not a terminal — re-run with --yes to skip confirmation.");
    return false;
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await rl.question(`${question} [y/N] `);
    return answer.trim().toLowerCase() === "y";
  } finally {
    rl.close();
  }
}

async function main(): Promise<void> {
  const account = deployerAccount();
  const destination = teamAccount();
  const client = publicClient();
  const wallet = walletClient(account);

  console.log(`\nSweeping leftover ${chain.name} ETH`);
  console.log(`  from: ${account.address} (deployer)`);
  console.log(`  to:   ${destination} (team account)`);

  const balance = await client.getBalance({ address: account.address });
  console.log(`  balance: ${formatEther(balance)} ETH`);

  const fees = await client.estimateFeesPerGas();
  const maxFeePerGas = fees.maxFeePerGas;
  const maxPriorityFeePerGas = fees.maxPriorityFeePerGas;
  if (maxFeePerGas === undefined || maxPriorityFeePerGas === undefined) {
    throw new Error("RPC did not return EIP-1559 fee data.");
  }

  const reserve = TRANSFER_GAS * maxFeePerGas;
  const value = balance - reserve;

  if (value <= 0n) {
    console.log(
      `\nNothing to sweep: the balance does not cover the ` +
        `${formatEther(reserve)} ETH transfer fee.\n`,
    );
    return;
  }
  if (value < DUST_THRESHOLD) {
    console.log(
      `\nNothing worth sweeping: only ${formatEther(value)} ETH would ` +
        `arrive, below the ${formatEther(DUST_THRESHOLD)} ETH threshold.\n`,
    );
    return;
  }

  console.log(`  fee reserve: ${formatEther(reserve)} ETH`);
  console.log(`  sending:     ${formatEther(value)} ETH`);

  if (!(await confirm(`\nSend ${formatEther(value)} ETH to ${destination}?`))) {
    console.log("Aborted, nothing sent.\n");
    return;
  }

  const hash = await wallet.sendTransaction({
    account,
    chain,
    to: destination,
    value,
    gas: TRANSFER_GAS,
    maxFeePerGas,
    maxPriorityFeePerGas,
  });
  console.log(`\n  tx sent: ${explorer}/tx/${hash}`);
  console.log("  waiting for confirmation...");

  const receipt = await client.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") {
    throw new Error(`Sweep transaction reverted: ${explorer}/tx/${hash}`);
  }

  const remaining = await client.getBalance({ address: account.address });
  console.log(`\nSwept ${formatEther(value)} ETH to ${destination}`);
  console.log(`  deployer now holds ${formatEther(remaining)} ETH\n`);
}

main().catch(reportAndExit);
