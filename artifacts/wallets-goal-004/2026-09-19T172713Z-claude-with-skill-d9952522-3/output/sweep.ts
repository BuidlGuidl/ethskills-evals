/**
 * Sends the deployer's whole balance, minus gas, to SWEEP_TO.
 *
 *   npm run sweep
 *
 * Shows the amount, the checksummed destination, and the gas cost, and waits
 * for you to type "yes" before signing. It uses a legacy (type 0) transaction
 * with a fixed gas price so the fee is known in advance and the account ends
 * at exactly 0.
 */
import { formatGwei } from "viem";
import {
  confirmOrExit,
  connect,
  eth,
  explorerLink,
  fail,
  loadDeployer,
  parseAddress,
  requireEnv,
} from "./scripts/common.js";

const account = loadDeployer();
const to = parseAddress("SWEEP_TO", requireEnv("SWEEP_TO"));
if (to === account.address) fail("SWEEP_TO is the deployer's own address.");

const { chain, publicClient, walletClient } = await connect(account);

const [balance, gasPrice, pending, latest] = await Promise.all([
  publicClient.getBalance({ address: account.address }),
  publicClient.getGasPrice(),
  publicClient.getTransactionCount({ address: account.address, blockTag: "pending" }),
  publicClient.getTransactionCount({ address: account.address, blockTag: "latest" }),
]);
if (pending !== latest) {
  fail(`The deployer has ${pending - latest} pending transaction(s). Wait for them to confirm, then sweep.`);
}

// Estimate with a nominal value. The destination might be a contract whose
// receive() needs more than 21000 gas.
const gas = await publicClient.estimateGas({ account, to, value: 1n });
const fee = gas * gasPrice;
const value = balance - fee;

console.log(`
Sweep
  network      ${chain.name} (chain id ${chain.id})
  from         ${account.address}
  balance      ${eth(balance)}
  to           ${to}
  amount       ${eth(value > 0n ? value : 0n)}
  gas          ${gas} @ ${formatGwei(gasPrice)} gwei
  gas cost     ${eth(fee)}`);

if (value <= 0n) {
  console.log(`\nThe balance doesn't cover the gas cost. Nothing to sweep.`);
  process.exit(0);
}

await confirmOrExit(`Send ${eth(value)} to ${to}?`);

const hash = await walletClient.sendTransaction({ to, value, gas, gasPrice, type: "legacy" });
console.log(`\nSent: ${explorerLink(chain, "tx", hash)}\nWaiting for confirmation...`);

const receipt = await publicClient.waitForTransactionReceipt({ hash });
if (receipt.status !== "success") fail(`Sweep transaction ${hash} reverted.`);

const remaining = await publicClient.getBalance({ address: account.address });
console.log(`\nSwept ${eth(value)} to ${to}. Deployer balance is now ${eth(remaining)}.`);
