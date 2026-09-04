/**
 * Sends the deployer's leftover Sepolia ETH back to the team account.
 *
 *   npm run sweep
 *
 * Prints the amount, the checksummed destination and the gas cost, then stops
 * until a human types "yes". Run this after the deploy has landed.
 */
import {
  chain,
  confirm,
  deployerAccount,
  eth,
  explorerAddress,
  explorerTx,
  publicClient,
  teamAccount,
  walletClient,
} from "./config.js";

const account = deployerAccount();
const to = teamAccount();
const wallet = walletClient();

if (to.toLowerCase() === account.address.toLowerCase()) {
  throw new Error("TEAM_ACCOUNT is the deployer itself -- nothing to sweep.");
}

const [balance, fees, senderCode] = await Promise.all([
  publicClient.getBalance({ address: account.address }),
  publicClient.estimateFeesPerGas(),
  publicClient.getCode({ address: account.address }),
]);

if (balance === 0n) {
  console.log(`${account.address} holds 0 ETH on ${chain.name}. Nothing to sweep.`);
  process.exit(0);
}

if (senderCode && senderCode !== "0x") {
  // An EIP-7702 authorization leaves code at an EOA until it is explicitly
  // cleared, and that code makes the transfer cost more than a plain 21000.
  console.warn(
    `Note: ${account.address} has code attached (EIP-7702 delegation). Gas is estimated, not assumed.`,
  );
}

// 21_000 is exact for EOA -> EOA. Estimate anyway: the team account may be a
// Safe or other contract whose receive() costs more.
let gas: bigint;
try {
  gas = await publicClient.estimateGas({ account, to, value: 1n });
} catch {
  console.warn("Gas estimation failed; falling back to the 21,000 baseline for a plain transfer.");
  gas = 21_000n;
}

// Reserve at the fee ceiling so the transaction cannot run out of funds mid-block.
const reserve = gas * fees.maxFeePerGas;
const value = balance - reserve;

console.log(`Network       ${chain.name} (chain id ${chain.id})`);
console.log(`From          ${account.address}`);
console.log(`To            ${to}`);
console.log(`Balance       ${eth(balance)}`);
console.log(`Gas reserve   ${gas.toLocaleString("en-US")} @ up to ${fees.maxFeePerGas} wei/gas = ${eth(reserve)}`);

if (value <= 0n) {
  throw new Error(
    `Balance ${eth(balance)} does not cover the ${eth(reserve)} gas reserve. Nothing to sweep.`,
  );
}

console.log(`Sending       ${eth(value)}`);

await confirm(`Send ${eth(value)} from ${account.address} to ${to}?`);

const hash = await wallet.sendTransaction({
  to,
  value,
  gas,
  maxFeePerGas: fees.maxFeePerGas,
  maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
});
console.log(`\nSubmitted     ${hash}`);
console.log(`              ${explorerTx(hash)}`);

const receipt = await publicClient.waitForTransactionReceipt({ hash });
if (receipt.status !== "success") {
  throw new Error(`Sweep reverted (tx ${hash}).`);
}

const remaining = await publicClient.getBalance({ address: account.address });
console.log(`\nSwept         ${eth(value)} -> ${to}`);
console.log(`              ${explorerAddress(to)}`);
console.log(`Paid          ${eth(receipt.gasUsed * receipt.effectiveGasPrice)}`);
console.log(`Dust left     ${eth(remaining)} (rounding from the fee ceiling)`);
