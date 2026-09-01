/**
 * Sends the deploy account's leftover Sepolia ETH back to the team account.
 *
 *   npm run sweep                 # sweep everything the gas cost allows
 *   npm run sweep -- --keep 0.05  # leave 0.05 ETH behind for the next deploy
 *   npm run sweep -- --yes        # skip the interactive prompt
 *
 * This empties an account. It prints the amount, the destination and the gas
 * cost and then waits for a human. Do not run it from CI.
 */
import { parseEther } from "viem";
import {
  TEAM_ACCOUNT,
  assertSepolia,
  confirm,
  deployer,
  eth,
  explorerAddress,
  explorerTx,
  publicClient,
} from "./config.js";

function keepAmount(): bigint {
  const index = process.argv.indexOf("--keep");
  if (index === -1) return 0n;
  const value = process.argv[index + 1];
  if (!value) throw new Error("--keep needs an amount in ETH, e.g. --keep 0.05");
  return parseEther(value);
}

async function main() {
  const keep = keepAmount();

  const client = publicClient();
  await assertSepolia(client);
  const { account, wallet } = deployer();

  const balance = await client.getBalance({ address: account.address });
  if (balance === 0n) {
    console.log(`${account.address} is already empty. Nothing to sweep.`);
    return;
  }

  // Price the transfer live. A plain ETH send to an EOA is 21000 gas, but
  // estimate anyway: if the team account is a contract (a Safe, say), its
  // receive hook costs more and a hardcoded 21000 would strand the send.
  const gas = await client.estimateGas({
    account,
    to: TEAM_ACCOUNT,
    value: 1n,
  });
  const fees = await client.estimateFeesPerGas();

  // Reserve the worst case (gas x maxFeePerGas), not the expected case. If we
  // budgeted at the base fee and the next block's fee rose, the transaction
  // would be unaffordable and fail. Whatever is not spent is refunded to the
  // deployer, so a little dust stays behind by design.
  const maxCost = gas * fees.maxFeePerGas;
  const value = balance - maxCost - keep;

  if (value <= 0n) {
    throw new Error(
      `Balance ${eth(balance)} does not cover the ${eth(maxCost)} gas reserve` +
        `${keep > 0n ? ` plus the ${eth(keep)} you asked to keep` : ""}. Nothing to sweep.`,
    );
  }

  console.log("");
  console.log(`Network      Sepolia (chain 11155111)`);
  console.log(`From         ${account.address}`);
  console.log(`             ${explorerAddress(account.address)}`);
  console.log(`To           ${TEAM_ACCOUNT}   <- team account`);
  console.log(`             ${explorerAddress(TEAM_ACCOUNT)}`);
  console.log("");
  console.log(`Balance      ${eth(balance)}`);
  console.log(`Gas reserve  ${eth(maxCost)}  (${gas} units @ up to ${fees.maxFeePerGas} wei)`);
  if (keep > 0n) console.log(`Keeping      ${eth(keep)}`);
  console.log(`Sending      ${eth(value)}`);
  console.log("");
  console.log("Check the destination above character by character before continuing.");

  if (!(await confirm("Send this amount to the team account?"))) {
    console.log("Aborted. Nothing was sent.");
    process.exit(1);
  }

  const hash = await wallet.sendTransaction({
    to: TEAM_ACCOUNT,
    value,
    gas,
    maxFeePerGas: fees.maxFeePerGas,
    maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
  });
  console.log(`\nSent  ${explorerTx(hash)}`);
  console.log("Waiting for confirmation...");

  const receipt = await client.waitForTransactionReceipt({ hash, confirmations: 1 });
  if (receipt.status !== "success") {
    throw new Error(`Sweep reverted. See ${explorerTx(hash)}`);
  }

  console.log("");
  console.log(`Swept        ${eth(value)} to ${TEAM_ACCOUNT}`);
  console.log(`Block        ${receipt.blockNumber}`);
  console.log(`Gas used     ${receipt.gasUsed} (${eth(receipt.gasUsed * receipt.effectiveGasPrice)})`);
  console.log(`Left behind  ${eth(await client.getBalance({ address: account.address }))}`);
}

main().catch((error) => {
  console.error(`\n${error instanceof Error ? error.message : error}`);
  process.exit(1);
});
