/**
 * Send the deployer's leftover Sepolia ETH to the team account (TEAM_ADDRESS).
 *
 *   npm run sweep
 *
 * Sends balance minus the worst-case gas fee. Because the actual fee is usually
 * below the max fee, a few gwei of dust may stay behind — that's expected.
 */
import { formatEther, formatGwei } from "viem";
import {
  assertSepolia,
  clients,
  confirm,
  fail,
  loadDeployer,
  parseAddress,
  requireEnv,
} from "./utils/common.ts";

const team = parseAddress("TEAM_ADDRESS", requireEnv("TEAM_ADDRESS"));

const account = await loadDeployer();
if (account.address === team) fail("TEAM_ADDRESS is the deployer itself — nothing to sweep.");

const { publicClient, walletClient } = clients(account);
await assertSepolia(publicClient);

const balance = await publicClient.getBalance({ address: account.address });
if (balance === 0n) fail(`Deployer ${account.address} has no balance.`);

// Estimate rather than hardcode 21000 in case TEAM_ADDRESS is a contract (e.g. a Safe).
const gas = await publicClient.estimateGas({ account, to: team, value: 1n });
const fees = await publicClient.estimateFeesPerGas();
const maxFee = gas * fees.maxFeePerGas;
const value = balance - maxFee;
if (value <= 0n) {
  fail(`Balance ${formatEther(balance)} ETH doesn't cover the gas fee (${formatEther(maxFee)} ETH).`);
}

await confirm(
  [
    `Network:  Sepolia (${publicClient.chain.id})`,
    `From:     ${account.address}  (balance ${formatEther(balance)} ETH)`,
    `To:       ${team}`,
    `Amount:   ${formatEther(value)} ETH`,
    `Gas:      ${gas} @ max ${formatGwei(fees.maxFeePerGas)} gwei (≤ ${formatEther(maxFee)} ETH)`,
  ].join("\n"),
);

const hash = await walletClient!.sendTransaction({
  to: team,
  value,
  gas,
  maxFeePerGas: fees.maxFeePerGas,
  maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
});
console.log(`\nTx sent: https://sepolia.etherscan.io/tx/${hash}`);

const receipt = await publicClient.waitForTransactionReceipt({ hash });
if (receipt.status !== "success") fail(`Sweep reverted in block ${receipt.blockNumber}.`);

const remaining = await publicClient.getBalance({ address: account.address });
console.log(`\n✔ Sent ${formatEther(value)} ETH to ${team} in block ${receipt.blockNumber}`);
console.log(`  Deployer dust remaining: ${formatEther(remaining)} ETH`);
