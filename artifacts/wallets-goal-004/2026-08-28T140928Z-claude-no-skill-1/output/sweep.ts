/**
 * Return the deployer's leftover Sepolia ETH to the team account.
 *
 *   npm run sweep              # asks for confirmation first
 *   npm run sweep -- --dry-run # show the numbers, send nothing
 *   npm run sweep -- --yes     # no prompt (for CI)
 *   npm run sweep -- --keep 0.01
 *
 * Sends `balance - (gas * maxFeePerGas)`. Because the network usually charges
 * less than maxFeePerGas, a little dust is normally left behind — that is
 * expected, and it is the price of never having the transaction fail for
 * insufficient funds.
 */
import { createInterface } from "node:readline/promises";
import { formatEther, parseEther, type Address } from "viem";
import { assertSepolia, loadConfig, reportFatal, UserError } from "./src/config.js";

const EXPLORER = "https://sepolia.etherscan.io";

interface Options {
  dryRun: boolean;
  skipPrompt: boolean;
  keep: bigint;
}

function parseArgs(argv: string[]): Options {
  const options: Options = { dryRun: false, skipPrompt: false, keep: 0n };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (arg === "--yes" || arg === "-y") {
      options.skipPrompt = true;
    } else if (arg === "--keep" || arg.startsWith("--keep=")) {
      const value = arg.startsWith("--keep=") ? arg.slice(7) : argv[++i];
      if (!value) throw new UserError("--keep needs an amount in ETH, e.g. --keep 0.01");
      options.keep = parseEther(value);
    } else {
      throw new UserError(
        `Unknown option: ${arg}. Supported: --dry-run, --yes, --keep <eth>.`,
      );
    }
  }
  return options;
}

async function confirm(question: string): Promise<boolean> {
  if (!process.stdin.isTTY) {
    throw new UserError(
      "Not running interactively. Re-run with --yes to confirm, or --dry-run to preview.",
    );
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
  const options = parseArgs(process.argv.slice(2));
  const config = loadConfig();
  const { account, publicClient, walletClient, teamAddress } = config;
  await assertSepolia(config);

  if (teamAddress.toLowerCase() === account.address.toLowerCase()) {
    throw new UserError(
      "TEAM_ADDRESS is the same as the deployer address — nothing to sweep.",
    );
  }

  const balance = await publicClient.getBalance({ address: account.address });
  console.log(`From    : ${account.address}`);
  console.log(`To      : ${teamAddress}`);
  console.log(`Balance : ${formatEther(balance)} ETH`);

  if (balance === 0n) {
    console.log("\nNothing to sweep — the deployer is empty.");
    return;
  }

  // Estimate against the real recipient: if the team account is a contract
  // (e.g. a Safe), its receive hook costs more than a 21000-gas EOA transfer.
  const gas = await publicClient.estimateGas({
    account,
    to: teamAddress as Address,
    value: 1n,
  });
  const fees = await publicClient.estimateFeesPerGas();
  const maxFee = gas * fees.maxFeePerGas;
  const value = balance - maxFee - options.keep;

  console.log(`Gas     : ${gas} @ up to ${fees.maxFeePerGas} wei`);
  console.log(`Fee cap : ${formatEther(maxFee)} ETH`);
  if (options.keep > 0n) {
    console.log(`Keeping : ${formatEther(options.keep)} ETH`);
  }

  if (value <= 0n) {
    throw new UserError(
      `Balance of ${formatEther(balance)} ETH does not cover the ` +
        `${formatEther(maxFee + options.keep)} ETH fee cap` +
        (options.keep > 0n ? " plus the amount to keep." : ".") +
        " Nothing to sweep.",
    );
  }
  console.log(`Sending : ${formatEther(value)} ETH`);

  if (options.dryRun) {
    console.log("\nDry run — nothing sent.");
    return;
  }

  if (!options.skipPrompt) {
    const ok = await confirm(
      `\nSend ${formatEther(value)} ETH to ${teamAddress}?`,
    );
    if (!ok) {
      console.log("Aborted.");
      return;
    }
  }

  const hash = await walletClient.sendTransaction({
    to: teamAddress,
    value,
    gas,
    maxFeePerGas: fees.maxFeePerGas,
    maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
  });
  console.log(`\nSent    : ${EXPLORER}/tx/${hash}`);
  console.log("Waiting for confirmation…");

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") {
    throw new Error(`Sweep reverted. See ${EXPLORER}/tx/${hash}.`);
  }

  const remaining = await publicClient.getBalance({ address: account.address });
  console.log(`\n✓ Swept ${formatEther(value)} ETH to ${teamAddress}`);
  console.log(
    `  Deployer now holds ${formatEther(remaining)} ETH` +
      (options.keep > 0n ? " (kept + dust)." : " (dust)."),
  );
}

main().catch(reportFatal);
