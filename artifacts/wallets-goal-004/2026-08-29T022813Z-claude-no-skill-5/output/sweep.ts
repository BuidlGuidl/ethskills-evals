import "dotenv/config";
import { createInterface } from "node:readline/promises";
import {
  createPublicClient,
  createWalletClient,
  formatEther,
  http,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import { deployerPrivateKey, rpcUrl, teamAccount } from "./scripts/env.js";

/**
 * Returns the deployer's leftover Sepolia ETH to the team account.
 *
 * Usage:
 *   npm run sweep -- --dry-run    # show what would be sent, send nothing
 *   npm run sweep                 # prompts for confirmation
 *   npm run sweep -- --yes        # skip the prompt (for CI)
 *
 * The amount sent is (balance - gasLimit * maxFeePerGas), i.e. the whole
 * balance minus the worst-case cost of the sweep itself. Because EIP-1559
 * refunds the unused portion of maxFeePerGas, a small amount of dust is left
 * behind. That is expected; re-running the sweep later collects it.
 */

const DRY_RUN = process.argv.includes("--dry-run");
const ASSUME_YES = process.argv.includes("--yes") || process.argv.includes("-y");

async function confirm(question: string): Promise<boolean> {
  if (ASSUME_YES) return true;
  if (!process.stdin.isTTY) {
    throw new Error("Not a TTY and --yes not passed; refusing to sweep unattended.");
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
  const account = privateKeyToAccount(deployerPrivateKey());
  const recipient = teamAccount();
  const transport = http(rpcUrl());

  const publicClient = createPublicClient({ chain: sepolia, transport });
  const walletClient = createWalletClient({ account, chain: sepolia, transport });

  const chainId = await publicClient.getChainId();
  if (chainId !== sepolia.id) {
    throw new Error(
      `SEPOLIA_RPC_URL is connected to chain ${chainId}, expected ${sepolia.id} (Sepolia).`,
    );
  }

  if (recipient.toLowerCase() === account.address.toLowerCase()) {
    throw new Error("TEAM_ACCOUNT is the deployer itself — nothing to sweep.");
  }

  const balance = await publicClient.getBalance({ address: account.address });
  console.log(`from    : ${account.address}`);
  console.log(`to      : ${recipient}`);
  console.log(`balance : ${formatEther(balance)} ETH`);

  if (balance === 0n) {
    console.log("\nNothing to sweep.");
    return;
  }

  const { maxFeePerGas, maxPriorityFeePerGas } = await publicClient.estimateFeesPerGas();

  // 21000 for an EOA recipient; estimate in case the team account is a
  // contract (e.g. a Safe) whose receive hook costs more.
  const gasLimit = await publicClient
    .estimateGas({ account, to: recipient, value: 1n })
    .catch(() => 21_000n);

  const maxCost = gasLimit * maxFeePerGas;
  const value = balance - maxCost;

  console.log(`gas     : ${gasLimit} units @ up to ${formatEther(maxFeePerGas)} ETH/unit`);
  console.log(`reserve : ${formatEther(maxCost)} ETH held back for fees`);
  console.log(`sending : ${formatEther(value)} ETH`);

  if (value <= 0n) {
    throw new Error(
      `Balance (${formatEther(balance)} ETH) does not cover the worst-case sweep fee ` +
        `(${formatEther(maxCost)} ETH). Wait for a cheaper block or top the account up.`,
    );
  }

  if (DRY_RUN) {
    console.log("\n--dry-run: no transaction sent.");
    return;
  }

  if (!(await confirm(`\nSend ${formatEther(value)} ETH to ${recipient}?`))) {
    console.log("Aborted.");
    return;
  }

  const hash = await walletClient.sendTransaction({
    to: recipient,
    value,
    gas: gasLimit,
    maxFeePerGas,
    maxPriorityFeePerGas,
  });
  console.log(`\ntx hash : ${hash}`);
  console.log(`explorer: https://sepolia.etherscan.io/tx/${hash}`);

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") {
    throw new Error(`Sweep reverted. See https://sepolia.etherscan.io/tx/${hash}`);
  }

  const remaining = await publicClient.getBalance({ address: account.address });
  console.log(`\n✅ swept ${formatEther(value)} ETH to ${recipient}`);
  console.log(`deployer now holds ${formatEther(remaining)} ETH (fee refund dust)`);
}

main().catch((error: unknown) => {
  console.error(`\n❌ ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
