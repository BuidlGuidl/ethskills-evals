import { formatEther } from "viem";
import { assertSepolia, deployerAccount, publicClient, walletClient } from "./src/clients.js";
import { isConfigError, requiredAddress } from "./src/env.js";
import { confirm, eth, gwei, sepoliaExplorer } from "./src/confirm.js";

/**
 * Return the deploy account's leftover Sepolia ETH to the team account, then
 * leave the deploy key with nothing worth stealing.
 *
 *   npm run sweep
 *
 * Run this after the deploy lands. A deploy key is meant to be temporary — the
 * end state is an empty account you can throw away.
 */

async function main() {
  const destination = requiredAddress(
    "SWEEP_DESTINATION",
    "Set it to the team account that should receive the leftover ETH.",
  );

  const account = deployerAccount();
  const client = publicClient();
  const wallet = walletClient();

  await assertSepolia(client);

  if (destination.address.toLowerCase() === account.address.toLowerCase()) {
    throw new Error("SWEEP_DESTINATION is the deploy account itself. Nothing to do.");
  }

  const balance = await client.getBalance({ address: account.address });
  if (balance === 0n) {
    console.log(`${account.address} is already empty. Nothing to sweep.`);
    return;
  }

  const [fees, code] = await Promise.all([
    client.estimateFeesPerGas(),
    client.getCode({ address: destination.address }),
  ]);

  // Probe with a nonzero value so a contract destination's receive()/fallback()
  // is actually exercised by the estimate.
  const gas = await client.estimateGas({
    account,
    to: destination.address,
    value: 1n,
  });
  const gasLimit = (gas * 110n) / 100n;

  // Reserve the worst case the tx can cost, and send everything else. Unused
  // gas and any base-fee difference are refunded, so a little dust stays behind.
  const reserve = gasLimit * fees.maxFeePerGas;
  if (balance <= reserve) {
    throw new Error(
      `Balance ${formatEther(balance)} ETH does not cover the ${formatEther(reserve)} ETH ` +
        `worst-case fee for the transfer. Nothing to sweep — leave it or wait for cheaper gas.`,
    );
  }
  const value = balance - reserve;

  const facts: Array<[string, string]> = [
    ["Network", "Sepolia (chain 11155111)"],
    ["From", account.address],
    ["From balance", eth(balance)],
    ["To", destination.address],
    ["To type", code && code !== "0x" ? "contract (Safe/multisig?)" : "externally owned account"],
    ["Sending", eth(value)],
    ["Fee reserve", `${eth(reserve)}  (${gasLimit} gas @ max ${gwei(fees.maxFeePerGas)})`],
    ["Dust left behind", "whatever the fee reserve does not consume"],
  ];

  if (!destination.checksumVerified) {
    facts.push([
      "WARNING",
      "SWEEP_DESTINATION carries no EIP-55 checksum, so a wrong character is undetectable.",
    ]);
    facts.push(["", "Confirm this address with its owner before answering yes. Transfers are final."]);
  }

  await confirm("Sweep leftover Sepolia ETH", facts);

  console.log("\nBroadcasting…");
  const hash = await wallet.sendTransaction({
    to: destination.address,
    value,
    gas: gasLimit,
    maxFeePerGas: fees.maxFeePerGas,
    maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
  });
  console.log(`  tx ${hash}`);
  console.log(`  ${sepoliaExplorer("tx", hash)}`);

  const receipt = await client.waitForTransactionReceipt({ hash, timeout: 180_000 });
  if (receipt.status !== "success") {
    throw new Error(`Sweep reverted — the destination may reject plain ETH transfers. See ${sepoliaExplorer("tx", hash)}`);
  }

  const remaining = await client.getBalance({ address: account.address });
  console.log(`
Swept
──────────────────────────────────────────────────────────────
  Sent        ${eth(value)}
  To          ${destination.address}
  Fee paid    ${eth(receipt.gasUsed * receipt.effectiveGasPrice)}
  Dust left   ${eth(remaining)}
──────────────────────────────────────────────────────────────

The deploy key now holds ~nothing. Delete it from your .env; generate a fresh
one with \`npm run new-deployer\` for the next deploy.`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(isConfigError(error) ? `\nConfiguration problem\n  ${message}` : `\nSweep failed\n  ${message}`);
  process.exit(1);
});
