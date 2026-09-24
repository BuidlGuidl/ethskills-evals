import { getAddress, isAddress } from "viem";
import { confirm, eth, makeClients, requireEnv } from "./lib.ts";

const rawTo = requireEnv("TEAM_ADDRESS");
if (!isAddress(rawTo)) {
  console.error(`TEAM_ADDRESS is not a valid address (or its mixed-case checksum is wrong — a sign of a typo): ${rawTo}`);
  process.exit(1);
}
const to = getAddress(rawTo); // checksummed

const { account, publicClient, walletClient } = await makeClients();
if (to === account.address) {
  console.error("TEAM_ADDRESS is the deployer itself; nothing to do.");
  process.exit(1);
}

const [balance, fees, gas] = await Promise.all([
  publicClient.getBalance({ address: account.address }),
  publicClient.estimateFeesPerGas(),
  publicClient.estimateGas({ account, to, value: 1n }),
]);

// Reserve the worst-case fee so the tx can't fail for insufficient funds. Whatever
// isn't actually charged (maxFee − effective price) stays behind as a little dust.
const maxGasCost = gas * fees.maxFeePerGas;
const value = balance - maxGasCost;

console.log(`Network:       Sepolia (chain ${publicClient.chain.id})`);
console.log(`From:          ${account.address}`);
console.log(`To:            ${to}`);
console.log(`Balance:       ${eth(balance)}`);
console.log(`Gas:           ${gas} @ max ${eth(fees.maxFeePerGas)}/gas = ${eth(maxGasCost)} max`);
if (value <= 0n) {
  console.log("Balance does not cover the gas to send it. Nothing to sweep.");
  process.exit(0);
}
console.log(`Amount to send: ${eth(value)}`);

await confirm(`Send ${eth(value)} to ${to}?`);

const hash = await walletClient.sendTransaction({
  to,
  value,
  gas,
  maxFeePerGas: fees.maxFeePerGas,
  maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
});
console.log(`Sent: ${hash} — waiting for confirmation…`);
const receipt = await publicClient.waitForTransactionReceipt({ hash });
if (receipt.status !== "success") {
  console.error(`Sweep failed (tx ${hash}).`);
  process.exit(1);
}
const left = await publicClient.getBalance({ address: account.address });
console.log(`Swept ${eth(value)} to ${to}`);
console.log(`  https://sepolia.etherscan.io/tx/${hash}`);
console.log(`  deployer balance now ${eth(left)}`);
