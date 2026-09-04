/**
 * Returns the deployer's leftover Sepolia ETH to the team account.
 *
 *   npm run sweep
 *
 * Sends `balance - (gas limit x max fee)`, so a little dust is left behind:
 * the transaction has to be able to pay the worst-case fee it was signed for,
 * and the difference between that cap and the price actually paid stays put.
 */
import {
  createPublicClient,
  createWalletClient,
  formatEther,
  http,
} from "viem";
import { sepolia } from "viem/chains";
import { deployerAccount, rpcUrl, address } from "./src/env.js";
import { confirmSpend } from "./src/confirm.js";

async function main() {
  const account = deployerAccount();
  const to = address("TEAM_ACCOUNT");
  const transport = http(rpcUrl());

  const publicClient = createPublicClient({ chain: sepolia, transport });
  const walletClient = createWalletClient({ account, chain: sepolia, transport });

  const chainId = await publicClient.getChainId();
  if (chainId !== sepolia.id) {
    throw new Error(
      `SEPOLIA_RPC_URL points at chain ${chainId}, not Sepolia (${sepolia.id}).`,
    );
  }
  if (to === account.address) {
    throw new Error("TEAM_ACCOUNT is the deployer itself — nothing to sweep.");
  }

  const [balance, fees] = await Promise.all([
    publicClient.getBalance({ address: account.address }),
    publicClient.estimateFeesPerGas(),
  ]);

  console.log(`deployer:  ${account.address}`);
  console.log(`balance:   ${formatEther(balance)} ETH`);
  console.log(`recipient: ${to}`);

  if (balance === 0n) {
    console.log("\nNothing to sweep.");
    return;
  }

  // Estimate against the real recipient: a plain EOA costs 21000, a contract
  // with a receive() hook costs more, and one that cannot accept ETH fails
  // here rather than after we have burned the gas.
  const gasEstimate = await publicClient.estimateGas({
    account,
    to,
    value: 1n,
  });
  const gasLimit = (gasEstimate * 110n) / 100n;
  const gasCost = gasLimit * fees.maxFeePerGas;

  if (balance <= gasCost) {
    throw new Error(
      `Balance ${formatEther(balance)} ETH does not cover the ${formatEther(gasCost)} ` +
        `ETH fee cap for the transfer. Leave it — sweeping would cost more than it returns.`,
    );
  }

  const value = balance - gasCost;

  await confirmSpend({
    action: "Sweep leftover Sepolia ETH to the team account",
    to,
    value,
    gasLimit,
    maxFeePerGas: fees.maxFeePerGas,
    gasCost,
  });

  const hash = await walletClient.sendTransaction({
    to,
    value,
    gas: gasLimit,
    maxFeePerGas: fees.maxFeePerGas,
    maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
  });
  console.log(`\nsent:      ${hash}`);
  console.log("waiting for confirmation...");

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") {
    throw new Error(`Sweep reverted. Receipt status: ${receipt.status}`);
  }

  const remaining = await publicClient.getBalance({ address: account.address });
  console.log(`\n✔ swept ${formatEther(value)} ETH to ${to}`);
  console.log(`  explorer:  https://sepolia.etherscan.io/tx/${hash}`);
  console.log(`  dust left: ${formatEther(remaining)} ETH`);
}

main().catch((error) => {
  console.error(`\n✖ ${error instanceof Error ? error.message : error}`);
  process.exit(1);
});
