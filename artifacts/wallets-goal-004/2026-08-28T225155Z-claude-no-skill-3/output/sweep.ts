/**
 * Returns the deployer's leftover Sepolia ETH to the team account.
 *
 *   npm run sweep            # prompts before sending
 *   npm run sweep -- --yes   # no prompt (CI)
 *
 * Sends balance minus the maximum the transfer itself can cost. A little dust
 * is left behind because the transaction is priced at maxFeePerGas but usually
 * settles below it — that's expected, not a bug.
 */
import {
  assertSepolia,
  confirm,
  estimateGasFunded,
  eth,
  explorerTx,
  fail,
  getAccount,
  getWalletClient,
  publicClient,
  rpcUrl,
  teamAccount,
} from "./config.js";

async function main(): Promise<void> {
  await assertSepolia();

  const account = getAccount();
  const wallet = getWalletClient();
  const destination = teamAccount();

  if (destination.toLowerCase() === account.address.toLowerCase()) {
    fail("TEAM_ACCOUNT is the deployer's own address — nothing to sweep.");
  }

  const balance = await publicClient.getBalance({ address: account.address });

  console.log(`\nSweeping leftover Sepolia ETH`);
  console.log(`  RPC       ${rpcUrl}`);
  console.log(`  from      ${account.address}`);
  console.log(`  to        ${destination}`);
  console.log(`  balance   ${eth(balance)}`);

  if (balance === 0n) {
    console.log("\n  Nothing to sweep — balance is zero.\n");
    return;
  }

  // Price the transfer, then send everything that isn't reserved for gas.
  let gas: bigint;
  try {
    gas = await estimateGasFunded({ address: account.address, to: destination });
  } catch (error) {
    const reason = ((error as Error).message ?? String(error)).split("\n")[0];
    fail(`Could not estimate gas for the transfer.\n  RPC said: ${reason}`);
  }
  const { maxFeePerGas, maxPriorityFeePerGas } =
    await publicClient.estimateFeesPerGas();
  const reserve = gas * maxFeePerGas;
  const value = balance - reserve;

  console.log(`  gas       ${gas} @ max ${maxFeePerGas} wei`);
  console.log(`  reserved  ${eth(reserve)} for fees`);

  if (value <= 0n) {
    fail(
      `Balance ${eth(balance)} does not cover the ${eth(reserve)} fee reserve.\n` +
        "  Nothing to sweep.",
    );
  }

  console.log(`  sending   ${eth(value)}`);

  if (!(await confirm(`\nSend ${eth(value)} to ${destination}?`))) {
    console.log("Aborted.\n");
    return;
  }

  // Pin gas and fees so the wallet doesn't re-price the tx and overdraw.
  const hash = await wallet.sendTransaction({
    to: destination,
    value,
    gas,
    maxFeePerGas,
    maxPriorityFeePerGas,
  });

  console.log(`\n  tx sent   ${hash}`);
  console.log(`            ${explorerTx(hash)}`);
  console.log("  waiting for confirmation…");

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") {
    fail(`Sweep reverted. See ${explorerTx(hash)}`);
  }

  const remaining = await publicClient.getBalance({ address: account.address });
  console.log(`\n✔ Swept ${eth(value)} to ${destination}`);
  console.log(`  dust left behind: ${eth(remaining)}\n`);
}

main().catch((error: unknown) => {
  fail((error as Error).message ?? String(error));
});
