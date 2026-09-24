/**
 * Send the deployer's leftover Sepolia ETH to the team account.
 *
 *   npm run sweep            # asks for confirmation
 *   npm run sweep -- --yes   # non-interactive
 *
 * Destination is SWEEP_TO from .env (the team account by default).
 */
import { formatEther, getAddress, isAddress } from "viem";
import { confirm, explorer, makeClients, requireEnv } from "./common.ts";

async function main() {
  const rawTo = requireEnv("SWEEP_TO");
  if (!isAddress(rawTo)) throw new Error(`SWEEP_TO is not a valid address: ${rawTo}`);
  const to = getAddress(rawTo);

  const { account, publicClient, walletClient } = await makeClients();
  if (to === account.address) throw new Error("SWEEP_TO is the deployer itself.");

  const balance = await publicClient.getBalance({ address: account.address });
  if (balance === 0n) {
    console.log("Deployer balance is 0, nothing to sweep.");
    return;
  }

  // Estimate gas rather than assuming 21000, in case the team account is a
  // contract wallet (e.g. a Safe) whose receive() costs more.
  const gas = await publicClient.estimateGas({ account, to, value: 1n });
  const { maxFeePerGas, maxPriorityFeePerGas } = await publicClient.estimateFeesPerGas();

  // Reserve the worst-case fee so the tx can't fail for insufficient funds.
  // Whatever part of that reserve isn't actually charged (base fee < max fee)
  // stays behind as a small amount of dust.
  const maxCost = gas * maxFeePerGas;
  if (balance <= maxCost) {
    console.log(
      `Balance ${formatEther(balance)} ETH doesn't cover the ~${formatEther(maxCost)} ETH fee; nothing to sweep.`,
    );
    return;
  }
  const value = balance - maxCost;

  console.log(`From:    ${account.address}`);
  console.log(`To:      ${to}`);
  console.log(`Balance: ${formatEther(balance)} ETH`);
  console.log(`Sending: ${formatEther(value)} ETH (reserving up to ${formatEther(maxCost)} ETH for gas)`);
  if (!(await confirm("Send?"))) {
    console.log("Aborted.");
    return;
  }

  const hash = await walletClient.sendTransaction({
    to,
    value,
    gas,
    maxFeePerGas,
    maxPriorityFeePerGas,
  });
  console.log(`Sent tx ${hash}\n  ${explorer(`tx/${hash}`)}\nWaiting for confirmation...`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("Sweep transaction reverted.");

  const left = await publicClient.getBalance({ address: account.address });
  console.log(`Swept ${formatEther(value)} ETH to ${to}. Deployer now holds ${formatEther(left)} ETH.`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
