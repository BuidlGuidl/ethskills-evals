/**
 * Sends the deployer's leftover Sepolia ETH back to the team account.
 *
 *   npm run sweep           # dry run: prints exactly what would be sent
 *   npm run sweep -- --yes  # actually broadcasts
 *
 * Destination is TEAM_ADDRESS from .env, or --to <address>, defaulting to the
 * team account in lib/config.ts. Run this only after the deploy has landed —
 * it leaves the deployer with a zero balance.
 */
import { formatEther, type Address } from "viem";
import {
  checkedAddress,
  deployerAccount,
  explorerAddress,
  explorerTx,
  fail,
  publicClient,
  teamAddress,
  walletClient,
} from "./lib/config.js";

/** A plain ETH transfer to an EOA always costs exactly 21000 gas. */
const TRANSFER_GAS = 21_000n;

function destination(): Address {
  const flag = process.argv.indexOf("--to");
  if (flag === -1) return teamAddress();
  const value = process.argv[flag + 1];
  if (!value) fail("--to needs an address, e.g. --to 0xfB04...");
  return checkedAddress(value, "--to");
}

async function main() {
  const confirmed = process.argv.includes("--yes");
  const to = destination();
  const account = deployerAccount();
  const client = publicClient();

  const chainId = await client.getChainId();
  if (chainId !== 11155111) {
    fail(`SEPOLIA_RPC_URL points at chain ${chainId}, not Sepolia (11155111).`);
  }

  const balance = await client.getBalance({ address: account.address });
  console.log(`From     ${account.address}`);
  console.log(`To       ${to}`);
  console.log(`Balance  ${formatEther(balance)} ETH`);

  if (to.toLowerCase() === account.address.toLowerCase()) {
    fail("Destination is the deployer itself — nothing to sweep.");
  }
  if (balance === 0n) {
    console.log("\nNothing to sweep: balance is already 0.");
    return;
  }

  // Sending the *whole* balance means paying for gas out of that same balance,
  // so reserve the worst case the transaction can cost. Any difference between
  // maxFeePerGas and the price actually paid stays with the deployer as dust.
  const fees = await client.estimateFeesPerGas();
  const maxFee = fees.maxFeePerGas;
  const reserve = TRANSFER_GAS * maxFee;
  const value = balance - reserve;

  console.log(`Max fee  ${formatEther(reserve)} ETH (21000 gas @ ${maxFee} wei)`);

  if (value <= 0n) {
    fail(
      `Balance ${formatEther(balance)} ETH does not cover the ` +
        `${formatEther(reserve)} ETH gas reserve. Nothing to sweep.`,
    );
  }
  console.log(`Send     ${formatEther(value)} ETH`);

  if (!confirmed) {
    console.log("\nDry run — nothing sent. Re-run with --yes to broadcast:");
    console.log("  npm run sweep -- --yes");
    return;
  }

  const hash = await walletClient().sendTransaction({
    to,
    value,
    gas: TRANSFER_GAS,
    maxFeePerGas: maxFee,
    maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
  });
  console.log(`\nSent ${explorerTx(hash)}`);

  const receipt = await client.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") {
    fail(`Sweep transaction reverted. See ${explorerTx(hash)}`);
  }

  const remaining = await client.getBalance({ address: account.address });
  console.log(`\n✔ Swept ${formatEther(value)} ETH to ${to}`);
  console.log(`  ${explorerAddress(to)}`);
  console.log(`  deployer left with ${formatEther(remaining)} ETH`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
