/**
 * Sends the deployer's entire remaining Sepolia ETH balance to the team account.
 *
 *   npm run sweep              # dry run: shows what would be sent
 *   npm run sweep -- --send    # actually sends
 *
 * Destination is SWEEP_TO from .env.
 */
import { formatEther, formatGwei, isAddress, type Address } from "viem";
import { requireEnv, sepoliaClients } from "./env.js";

async function main() {
  const send = process.argv.includes("--send");
  const to = requireEnv("SWEEP_TO") as Address;
  // Strict EIP-55 check: a mixed-case address whose checksum doesn't match usually means a typo.
  // Don't "fix" it -- confirm the address from a trusted source instead.
  if (!isAddress(to, { strict: true })) {
    throw new Error(`SWEEP_TO (${to}) is not a valid checksummed address. Double-check it before sweeping.`);
  }

  const { account, publicClient, walletClient } = await sepoliaClients();
  if (to.toLowerCase() === account.address.toLowerCase()) throw new Error("SWEEP_TO is the deployer itself.");

  const balance = await publicClient.getBalance({ address: account.address });
  // Estimate with a token value; a plain EOA costs 21000, a smart-wallet recipient may cost more.
  const gas = await publicClient.estimateGas({ account, to, value: 1n });

  // Set maxFeePerGas == maxPriorityFeePerGas so the effective price is exactly maxFeePerGas.
  // The fee is then exactly gas * maxFeePerGas and the account ends at 0 instead of
  // keeping an unspent refund. Headroom of 2x base fee keeps it includable if base fee rises.
  const block = await publicClient.getBlock();
  const priority = await publicClient.estimateMaxPriorityFeePerGas();
  const maxFeePerGas = (block.baseFeePerGas ?? 0n) * 2n + priority;
  const fee = gas * maxFeePerGas;

  console.log(`From:    ${account.address}`);
  console.log(`To:      ${to}`);
  console.log(`Balance: ${formatEther(balance)} ETH`);
  console.log(`Fee:     ${formatEther(fee)} ETH (${gas} gas @ ${formatGwei(maxFeePerGas)} gwei)`);

  if (balance <= fee) {
    console.log("Nothing to sweep: balance does not cover the transfer fee.");
    return;
  }
  const value = balance - fee;
  console.log(`Send:    ${formatEther(value)} ETH`);

  if (!send) {
    console.log("\nDry run. Re-run with `npm run sweep -- --send` to send.");
    return;
  }

  const hash = await walletClient.sendTransaction({
    to,
    value,
    gas,
    maxFeePerGas,
    maxPriorityFeePerGas: maxFeePerGas,
  });
  console.log(`\nSweep tx: https://sepolia.etherscan.io/tx/${hash}`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("Sweep transaction reverted.");

  const remaining = await publicClient.getBalance({ address: account.address });
  console.log(`Done. Deployer balance now ${formatEther(remaining)} ETH.`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
