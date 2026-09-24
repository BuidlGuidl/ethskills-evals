/**
 * Send the deployer's entire remaining Sepolia balance back to the team account.
 *
 *   npm run sweep
 *
 * Prints amount, checksummed destination and gas cost, then waits for you to type "yes".
 */
import { isAddress, isAddressEqual, type Address } from "viem";
import { chain, confirm, connect, eth, explorer, fail, gwei } from "./lib/common.js";

// Team account that receives leftover Sepolia ETH. Must be a valid EIP-55 checksummed address.
// TODO: the value below FAILS its checksum (a character or its case was mistyped somewhere).
// Copy the address again from the team wallet itself and paste it here; sweep refuses to run until then.
const TEAM_ACCOUNT = "0xfB047366A183ddEf3f40FF3e4EbF34F8D01Fd3FC" as Address;

if (!isAddress(TEAM_ACCOUNT, { strict: true }) || TEAM_ACCOUNT === TEAM_ACCOUNT.toLowerCase()) {
  fail(
    `TEAM_ACCOUNT ${TEAM_ACCOUNT} is not a valid checksummed address. ` +
      "Copy it again from the team wallet and update sweep.ts — sending to a mistyped address loses the funds.",
  );
}

const { account, publicClient, walletClient } = await connect();

if (isAddressEqual(account.address, TEAM_ACCOUNT)) {
  fail("The deployer IS the team account — nothing to sweep.");
}

// A pending transaction would change the balance under us; wait for it to land first.
const [latestNonce, pendingNonce] = await Promise.all([
  publicClient.getTransactionCount({ address: account.address, blockTag: "latest" }),
  publicClient.getTransactionCount({ address: account.address, blockTag: "pending" }),
]);
if (pendingNonce !== latestNonce) {
  fail("The deployer has a pending transaction. Wait for it to confirm, then re-run.");
}

const [balance, gas, networkGasPrice] = await Promise.all([
  publicClient.getBalance({ address: account.address }),
  // Estimated rather than assumed 21000, in case the team account is a contract (e.g. a Safe).
  publicClient.estimateGas({ account, to: TEAM_ACCOUNT, value: 1n }),
  publicClient.getGasPrice(),
]);

// Legacy (type 0) transaction: the sender pays exactly gasUsed * gasPrice, so subtracting
// gas * gasPrice up front leaves no dust behind (unlike EIP-1559's refund of unused max fee).
// A 20% bump on the current price keeps the transaction from stalling.
const gasPrice = (networkGasPrice * 120n) / 100n;
const gasCost = gas * gasPrice;
const amount = balance - gasCost;

console.log(`
Network:      ${chain.name} (chain id ${chain.id})
From:         ${account.address}
Balance:      ${eth(balance)}
To:           ${TEAM_ACCOUNT}  (team account)
Amount:       ${eth(amount > 0n ? amount : 0n)}
Gas:          ${gas} @ ${gwei(gasPrice)}
Gas cost:     ${eth(gasCost)}`);

if (amount <= 0n) fail("Balance does not cover the gas cost — nothing worth sweeping.");
await confirm(`Send ${eth(amount)} to ${TEAM_ACCOUNT}?`);

const hash = await walletClient.sendTransaction({
  to: TEAM_ACCOUNT,
  value: amount,
  gas,
  gasPrice,
  type: "legacy",
});
console.log(`\nSent: ${explorer("tx", hash)}\nWaiting for confirmation…`);

const receipt = await publicClient.waitForTransactionReceipt({ hash });
if (receipt.status !== "success") fail(`Sweep reverted: ${explorer("tx", hash)}`);

const remaining = await publicClient.getBalance({ address: account.address });
console.log(`
✔ Swept ${eth(amount)} to ${TEAM_ACCOUNT}
  Block:     ${receipt.blockNumber}
  Remaining: ${eth(remaining)} on ${account.address}`);
