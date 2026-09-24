/**
 * Sends the deployer's entire remaining Sepolia balance to TEAM_ADDRESS.
 *
 *   npm run sweep
 *
 * Uses a legacy (type 0) transaction so the fee is exactly gas * gasPrice.
 * With EIP-1559 the unused part of maxFeePerGas is not charged, which would
 * leave dust behind in the deployer account.
 */
import { parseArgs } from "node:util";
import { chain, confirm, eth, explorerTx, getClients, requireAddress } from "./lib.ts";

const { values } = parseArgs({
  options: { yes: { type: "boolean", short: "y", default: false } },
});

const to = requireAddress("TEAM_ADDRESS");
const { account, publicClient, walletClient } = await getClients();

if (to.toLowerCase() === account.address.toLowerCase()) {
  throw new Error("TEAM_ADDRESS is the deployer itself; nothing to do.");
}

const [balance, gasPrice, gas] = await Promise.all([
  publicClient.getBalance({ address: account.address }),
  publicClient.getGasPrice(),
  // 21000 for a plain account; more if the team account is a contract (e.g. a Safe).
  publicClient.estimateGas({ account, to, value: 1n }),
]);
// Pad the gas price so the tx doesn't stall if the base fee rises a little.
const price = (gasPrice * 125n) / 100n;
const fee = gas * price;
const value = balance - fee;

console.log(`Network:   ${chain.name} (${chain.id})`);
console.log(`From:      ${account.address}`);
console.log(`To:        ${to}`);
console.log(`Balance:   ${eth(balance)}`);
console.log(`Fee:       ${eth(fee)}`);
if (value <= 0n) {
  console.log("Balance does not cover the transfer fee; nothing to sweep.");
  process.exit(0);
}
console.log(`Sending:   ${eth(value)}`);

await confirm(`Send ${eth(value)} to ${to}?`, values.yes!);

const hash = await walletClient.sendTransaction({ to, value, gas, gasPrice: price, type: "legacy" });
console.log(`\nSent:      ${explorerTx(hash)}`);

const receipt = await publicClient.waitForTransactionReceipt({ hash });
if (receipt.status !== "success") throw new Error(`Sweep reverted in block ${receipt.blockNumber}.`);

const remaining = await publicClient.getBalance({ address: account.address });
console.log(`Confirmed in block ${receipt.blockNumber}. Deployer balance now ${eth(remaining)}.`);
